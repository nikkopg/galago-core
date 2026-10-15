---
phase: 02-run-page-live-controls
reviewed: 2026-10-15T22:38:20Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - controller/components/protocols/AddToolCommandModal.tsx
  - controller/components/runs/RunControlConfirmModal.tsx
  - controller/components/runs/RunsComponent.tsx
  - controller/components/runs/controlDecision.ts
  - controller/components/tools/constants.ts
  - controller/components/tools/types.ts
  - controller/pages/tools/[id].tsx
  - controller/server/command_queue.ts
  - controller/server/runControl.ts
  - controller/server/runState.ts
  - controller/server/utils/SqliteQueue.ts
  - controller/test/commandFields.test.ts
  - controller/test/controlDecision.test.ts
  - controller/test/queueRestart.test.ts
  - controller/test/runControl.test.ts
  - controller/test/runState.test.ts
  - controller/test/sqliteQueue.test.ts
  - controller/test/stopInterception.test.ts
  - controller/test/toolControl.test.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-10-15T22:38:20Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This is an incremental re-review of everything that changed since `3cfb240`, covering the live run-control feature (operator pause/resume/abort, run-state polling, interrupted-step recovery) and the smaller IN-01/IN-02/WR-05 cleanups (dead state removal, F.A.S.T. `tip_reuse` select field, head-moves note). The two most recent commits (`1b5048d`, `5839b40`) close a real race — an accepted abort, a plain failure, or a plain success racing an operator's Clear All / run-delete while the step is in flight — and I traced that fix end-to-end (`CommandQueue`'s busy-loop catch, `SqliteQueue.fail`/`failAndDequeueRun`/`dequeueFailedRun`, and the corresponding `toolControl.test.ts`/`stopInterception.test.ts` races) and confirmed it is correct and well covered.

I did not find any new crash, data-loss, or security-severity defect in this diff. I did find four real gaps that survived the hardening pass — one in the already-fixed-once `goto` targetIndex validation, one in the new abort-acceptance bookkeeping (a step that's aborted but then actually *succeeds* is never reconciled), one in the new `structuredClone`-based `RunStateMonitor.snapshot()`, and one in the new "row removed while running" log's error text — plus one minor UX/quality note about the new `tip_reuse` select field. None of these block shipping on their own, but each is a plausible source of a future, hard-to-reproduce bug report and is worth a follow-up.

## Warnings

### WR-01: `goto` targetIndex validation still accepts `null`/`""` as index 0

**File:** `controller/server/command_queue.ts:1217-1229`
**Issue:** The WR-01 fix (commit `7c1d01b`) changed the guard from `targetIndex !== undefined` to `rawTargetIndex !== undefined && Number.isInteger(targetIndex) && runId`, closing the case where a non-numeric string coerced to `NaN`. However, `Number(null)` and `Number("")` both evaluate to `0`, and `0` passes `Number.isInteger`. Since `null !== undefined` and `"" !== undefined` are both true, a `targetIndex` of `null` or `""` is silently accepted as index `0` and the run is requeued from its first step, instead of hitting the `else` branch's `"Goto command requires either targetId or both targetIndex and runId"` error. The current UI (`AddToolCommandModal`'s `NumberInput onChange`) always coerces the stored value to a number via `parseFloat(value) || 0` before it ever reaches a `goto` command, so this is not reachable through the normal protocol-builder flow today — but `commandInfo.params` is persisted as opaque JSON and nothing at the `command_queue.ts` boundary stops a differently-sourced `targetIndex: null` or `targetIndex: ""` (e.g. an import/clone feature, a hand-edited row, or a future authoring path) from silently jumping to step 0 instead of failing loudly, which is exactly the class of bug WR-01 set out to close.
**Fix:**
```ts
const targetIndex = Number(rawTargetIndex);
const runId = nextCommand.commandInfo.params?.runId || nextCommand.runId;

await this.commands.complete(nextCommand.queueId);
if (
  typeof rawTargetIndex === "number" &&
  Number.isInteger(targetIndex) &&
  runId
) {
  await this.gotoCommandByRunIndex(runId, targetIndex);
} else {
  throw new Error("Goto command requires either targetId or both targetIndex and runId");
}
```
(or explicitly reject `rawTargetIndex === null || rawTargetIndex === ""` alongside `undefined`).

### WR-02: An abort accepted mid-step that then actually succeeds leaves the rest of the run queued, untouched and untested

**File:** `controller/server/command_queue.ts:576-592` (`toolControl`/`_recordAcceptedAbort`) and `:1296-1319` (success path)
**Issue:** When the tool accepts an operator Abort while the step is still running, `_recordAcceptedAbort`'s layer (a) sets `this._abortAcceptedQueueId = step.queueId` so the busy-loop *catch* can later fail the step and dequeue the rest of its run. But `_abortAcceptedQueueId` is only ever read in the `catch` branch (line ~1326). If the underlying `executeCommand` promise instead *resolves* (the tool said "aborted" but the in-flight RPC had already produced its result, or the abort simply didn't stop the operation in time), execution falls through the success path at lines 1307-1319: the step is marked `COMPLETED` via `executeCommand`'s own `this.commands.complete()`, "Command Executed" is logged, and the loop continues to the next command — the rest of the run is never dequeued, and `_abortAcceptedQueueId` is silently discarded (overwritten at the top of the next loop iteration). The operator receives an "Instrument run aborted" toast (from `successTitle("abort")` in `controlDecision.ts`'s `dispatch`) implying the whole run was stopped, while the remaining queued steps of that run are left to run on the next queue start. This exact scenario (abort accepted, step then succeeds) has no test anywhere in `toolControl.test.ts`, unlike its sibling (abort accepted, step then fails) which is thoroughly covered at `toolControl.test.ts:474`.
**Fix:** In the success branch, check `this._abortAcceptedQueueId === nextCommand.queueId` (or consult `attempt`) before treating the result as a normal completion — route an accepted-but-succeeded abort through the same `failAndDequeueRun`-style dequeue (or at minimum log a "Run Still Queued After Accepted Abort" warning) so the operator's queue state matches what the toast told them, and add a regression test mirroring `toolControl.test.ts:474` but with `step.resolve(...)` instead of `step.reject(...)`.

### WR-03: `RunStateMonitor.snapshot()`'s new `structuredClone` can throw where the old shallow copy never could

**File:** `controller/server/runState.ts:168-171`
**Issue:** `snapshot()` was changed from `{ ...this.envelope }` (shallow copy, never throws) to `structuredClone(this.envelope)` to fix IN-01's aliasing bug (good fix for the aliasing problem, confirmed correct by the new `runState.test.ts` "deep copy" test). However, `envelope.runState.pause.detail` is typed `unknown` and is populated directly from `pauseRaw["eventPayload"]` — an arbitrary, decoder-controlled value from the tool's gRPC status reply (`extractRunState`, same file, lines 76-91) with no shape validation beyond "is a plain object or not". `structuredClone` throws `DataCloneError` synchronously on values it cannot clone (functions, several exotic object types). `snapshot()` is a plain getter (`get runState()`) with no try/catch, read directly by the `commandQueue.runState` tRPC query; if a tool's status payload ever contains something `eventPayload` decodes into a non-cloneable value, every poll of `/runState` for that step will throw instead of returning the previously-guaranteed-never-throwing envelope. This is a narrower risk than a functional bug today (protobuf Struct values are ordinarily plain JSON-ish data), but it is a real behavior change — "never throws" became "throws for some arbitrary tool-controlled inputs" — on a getter whose own docstring (line 1-5) still promises it is independent of any poll outcome.
**Fix:** Either deep-clone only the known-safe shape explicitly (`{ ...envelope, runState: envelope.runState ? { ...envelope.runState, pause: envelope.runState.pause ? { ...envelope.runState.pause } : null } : null }`), or wrap `structuredClone` in a try/catch that falls back to a shallow copy (or an "unknown" pause detail) so a malformed/exotic tool payload degrades gracefully instead of throwing out of a getter.

### WR-04: "Step Removed While Running" conflates a successful completion with a generic DB not-found error

**File:** `controller/server/command_queue.ts:1296-1319, 1352-1379`; `controller/server/utils/SqliteQueue.ts:450-461, 683-687`
**Issue:** `complete(id)` (unlike the sibling `fail`/`failAndDequeueRun` added in this diff) has no `_hasItem` existence guard — it calls `_updateItem`, which calls `find(id)`, which throws the generic `Item ${id} not found` when the row was already removed by Clear All / a run delete. That thrown error is what reaches the busy-loop's `catch` for the "step succeeded, but its row was removed mid-run" race (exercised by `toolControl.test.ts:898`, "a step that succeeds after Clear All removed it leaves no queue error"). Inside the catch, `abortAccepted` is `false` (no abort was involved), so it goes through `this.commands.fail(nextCommand.queueId, err)` with `err.message === "Item <id> not found"`, and that literal, DB-internals string ends up in the `"Step Removed While Running"` log's `stepError=` field — identical in shape to the genuine-failure case (`toolControl.test.ts:856`, where `stepError` legitimately contains `"tool step failed"`). An operator or support engineer reading the log after the fact cannot tell "the step actually succeeded, we just couldn't record it" apart from "the step genuinely threw an opaque DB error", even though the two are operationally very different (one needs no instrument follow-up, the other may).
**Fix:** Distinguish the two cases before logging, e.g. have the "Regular command" success path catch `complete()`'s own failure separately (so the loop can log something like `reason=the step completed successfully but its queue row was removed before it could be marked COMPLETED` rather than always treating any exception out of the try block as "the step's own error"), or give `complete()` the same `_hasItem`-based `Promise<boolean>` contract as `fail()`/`failAndDequeueRun()` so the caller can branch on "succeeded but row gone" explicitly instead of inferring it from exception message text.

## Info

### IN-01: F.A.S.T. `tip_reuse` select field has no default value

**File:** `controller/components/tools/constants.ts:328`; `controller/components/protocols/AddToolCommandModal.tsx` (`case "select"`, handleSubmit fallback at lines 209-226); `controller/pages/tools/[id].tsx` (`field.type === "select"` branch)
**Issue:** `{ name: "tip_reuse", type: "select", options: ["fresh", "reuse"] }` has no `defaultValue`, unlike `go_to`'s `targetIndex` (`defaultValue: 0`) a few lines above. Because `AddToolCommandModal.handleSubmit`'s "fill in missing fields" pass only special-cases `"number"`/`"boolean"`/`"text_array"` and falls back to `""` for everything else (including the new `"select"` type), an operator who adds a `transfer` command without touching the `tip_reuse` dropdown submits `tip_reuse: ""` rather than one of the two values the F.A.S.T. adapter's `_TIP_REUSE_MODES` actually accepts. This matches the field's pre-existing (`type: "text"`) behavior exactly, so it is not a regression, but now that the field is a constrained two-option select it is an easy, low-cost improvement to default it (e.g. `"fresh"`) so the dropdown is never silently left unset.
**Fix:** Add `defaultValue: "fresh"` to the `tip_reuse` field definition in `constants.ts`, matching the pattern already used for `go_to.targetIndex`.

---

_Reviewed: 2026-10-15T22:38:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
