---
phase: 02-run-page-live-controls
reviewed: 2026-10-14T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - controller/components/runs/ControlBar.tsx
  - controller/components/runs/controlDecision.ts
  - controller/components/runs/InstrumentStopModal.tsx
  - controller/components/runs/pausePrompt.ts
  - controller/components/runs/RunControlConfirmModal.tsx
  - controller/components/runs/RunsComponent.tsx
  - controller/components/runs/status/QueueStatuscomponent.tsx
  - controller/components/runs/stopInterception.ts
  - controller/components/runs/ToolPausedModal.tsx
  - controller/components/tools/constants.ts
  - controller/components/tools/RunRecoverySection.tsx
  - controller/components/ui/Toast.tsx
  - controller/hooks/useRunControl.ts
  - controller/pages/tools/[id].tsx
  - controller/server/recoveryControl.ts
  - controller/server/routers/tool.ts
  - controller/server/runState.ts
  - controller/test/controlDecision.test.ts
  - controller/test/pausePrompt.test.ts
  - controller/test/recoveryControl.test.ts
  - controller/test/runControl.test.ts
  - controller/test/runState.test.ts
  - controller/test/staticScan.test.ts
  - controller/test/stopInterception.test.ts
findings:
  critical: 0
  warning: 7
  info: 2
  total: 9
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

This phase wires operator-confirmed Pause/Resume/Abort controls into the run page and tool page, through a single confirmed-send gate (`createConfirmedSender`), a shared confirm modal (`RunControlConfirmModal`), a pause-episode reducer (`pausePrompt.ts`), and a crash-recovery path (`recoveryControl.ts`). The core safety invariants hold up under direct tracing: every send path routes through `completeDecisions` (both client-side button gating and inside the sender itself), no timers/auto-confirm exist in the control-UI modules (confirmed independently via `staticScan.test.ts` and by direct reading), the core performs no instrument-state checks before sending, and Stop/Clear All/Delete-Run during a controllable step route through an abort-then-follow-up sequence (`runAfterAccepted`) that only runs the queue-side follow-up after an accepted abort.

No BLOCKER-level defects were found — i.e., nothing that lets an instrument command escape operator confirmation, auto-sends, or stops/clears a queue without a prior accepted abort. However, several WARNING-level robustness and maintainability gaps were found, mostly around: an unsound type assertion that can build a malformed stop request, two places where simultaneous/duplicate confirm modals are structurally possible, a confirm-modal remount key that doesn't disambiguate by request identity, a hardcoded decision-field name that will silently break for any future tool type, safety copy shown unconditionally regardless of whether it's true for the action, three independent reimplementations of the same tool-id normalization logic, and a real (if rare) way for the queue's bookkeeping to desync from the instrument's actual state after an accepted abort.

## Warnings

### WR-01: Unsound type assertion can build a stop request with `toolType: undefined`

**File:** `controller/components/runs/RunsComponent.tsx:455-461`
**Issue:** The per-run delete button's `onClick` builds the stop request with a raw type assertion instead of relying on narrowing:
```tsx
onClick={() =>
  setRunStopRequest(
    buildStopRequest(runControlQuery.data as RunningEnvelope, () =>
      skipRunMutation.mutateAsync(run.Id),
    ),
  )
}
```
`shouldInterceptRunDelete(runControlQuery.data, run.Id)` is what actually narrows/gates this branch in the ternary just above it, but the `onClick` handler does not call that guard again — it just casts. If this line is ever refactored so the cast is no longer backed 1:1 by the adjacent ternary condition (e.g., the gating check is changed, or the handler is reused elsewhere), `runControlQuery.data` could in fact be `{ running: false }`, and `buildStopRequest` would read `envelope.toolType` off an object that doesn't have that property, producing `{ toolType: undefined, queueId: undefined, followUp }`. The resulting `InstrumentStopModal` would then open with `getActionSpec(undefined, "abort")` resolving to `undefined`, showing "This action is not available for this tool." with a permanently-disabled Confirm button — a silent dead-end rather than a compile-time-caught mistake.
**Fix:** Re-check the guard inside the handler itself (fail closed) instead of trusting the cast, e.g.:
```tsx
onClick={() => {
  if (!shouldInterceptRunDelete(runControlQuery.data, run.Id)) return;
  setRunStopRequest(buildStopRequest(runControlQuery.data, () => skipRunMutation.mutateAsync(run.Id)));
}}
```
This keeps TypeScript's own narrowing (the `envelope is RunningEnvelope` predicate) doing the work instead of an `as` cast that can silently go stale.

### WR-02: Two independent confirm modals can be open at once with no mutual exclusion

**File:** `controller/components/runs/ControlBar.tsx:190-224`, `controller/components/runs/RunsComponent.tsx:527-531`, `controller/components/runs/status/QueueStatuscomponent.tsx:118-122`
**Issue:** `ControlBar` always renders both `<ToolPausedModal isOpen={prompt.isOpen} ... />` and `<RunControlConfirmModal request={request} ... />` with no logic preventing both from being simultaneously open. Concretely: an operator opens a bar-origin confirm (e.g., clicks "Pause instrument", `request.origin === "bar"`) and, before they finish choosing, the instrument organically transitions into a *new* pause episode on the same step. `reducePausePrompt`'s poll branch will open `prompt.isOpen = true` for the new episode (this transition does not go through `confirmStillValid`/`promptClosedThisRequest`, since the queueId is unchanged and the episode key is simply new) while the operator's original confirm modal is still open — two Chakra `Modal`s stacked at once.

Separately, `RunsComponent.tsx` and `QueueStatuscomponent.tsx` each mount their own independent `InstrumentStopModal` (fed by independent `runStopRequest` / `stopRequest` state). "Pause queue"/"Clear All" (in `QueueStatuscomponent`) and "Delete Run" on the run containing the live step (in `RunsComponent`) are both clickable while neither modal is open yet, so two near-simultaneous clicks can set both state slots non-null before either modal's overlay has rendered to block further interaction.

Neither scenario lets an action be sent without confirmation (the stale modal does self-close via `confirmStillValid`'s staleness check once an accepted action moves the step on), but the user can be shown two overlapping confirmation dialogs at once, which is confusing exactly in the "I need to make a careful irreversible decision" moment this feature exists to protect.
**Fix:** Either (a) make `ToolPausedModal` only eligible to show when no `RunControlConfirmModal` request is active for the same queue step (e.g., gate `prompt.isOpen` display by `request === null`), or (b) document explicitly that this is accepted/self-healing behavior and add a regression test exercising the "pause arrives while a bar-origin confirm is open" interleaving, since it currently has no test coverage.

### WR-03: Confirm-modal remount key doesn't disambiguate by request identity

**File:** `controller/components/runs/RunControlConfirmModal.tsx:84-96`
**Issue:**
```tsx
return (
  <RunControlConfirmModalBody
    key={`${request.toolType}:${request.action}`}
    ...
```
The remount key is only `toolType:action`. The design relies on the key to guarantee "the body ... is mounted fresh on every open, so its decision state is always born empty (D-07)". That guarantee only holds because, in the current call sites, a request transitions through `null` before a logically distinct new request appears. If any caller ever replaces one non-null request directly with a different non-null request of the *same* `toolType`/`action` (for example, two buttons in `QueueStatuscomponent` — "Pause queue" and "Clear All" — both resolve to `toolType: "fast", action: "abort"` and could fire back-to-back before the first modal's overlay blocks further clicks), React will not remount `RunControlConfirmModalBody`, and any already-selected `values` (e.g. `return_liquid: "yes"`) from the first, now-replaced request would persist into the UI shown for the second, logically distinct confirmation, instead of resetting to "not chosen" as D-07 requires.
**Fix:** Include something that uniquely identifies the request instance in the key, e.g. `key={`${request.toolType}:${request.action}:${"queueId" in request.target ? "" : request.target.toolId}`}` is insufficient since `ControlTarget` for `{kind:"running"}` carries no id — simplest fix is to thread a monotonically-increasing request id (or the originating `queueId`/`toolId`) through `RunControlConfirmModalRequest` and include it in the key.

### WR-04: `stopModalBody` hardcodes the `return_liquid` decision key

**File:** `controller/components/runs/stopInterception.ts:31-36`
**Issue:**
```ts
export function stopModalBody(values: DecisionValues): string {
  const value = values.return_liquid;
  ...
}
```
This function is used as the `copy.body` override for every Stop/Clear-All/Delete-Run abort confirmation, regardless of tool type. It reads the literal key `return_liquid`, which happens to be correct only because `fast` is currently the only tool type with a `runControl` entry and its `abort` action happens to use that name. If a second tool type is ever added to `runControl` with an `abort` decision under a different name, this function will silently read `undefined` and always render "...not chosen", permanently, even after the operator makes a valid selection on the actual (differently-named) decision field — there is no type-level or runtime check tying this function to the declared decision keys for the action in question.
**Fix:** Either derive the body generically from `getActionSpec(toolType, "abort")`'s declared keys (mirroring what `restateChoice` already does), or add an explicit assertion/test that fails loudly if a future `runControl` entry's `abort` action doesn't declare exactly `return_liquid`.

### WR-05: `HEAD_MOVES_NOTE` is shown unconditionally, including for Pause

**File:** `controller/components/runs/controlDecision.ts:16`, `controller/components/runs/RunControlConfirmModal.tsx:193-194`
**Issue:** `HEAD_MOVES_NOTE = "The instrument head will move."` is rendered for every action's confirm dialog without exception:
```tsx
<Text>{bodyText}</Text>
<Text>{HEAD_MOVES_NOTE}</Text>
```
For `pause`, the restated question is `"Pause the F.A.S.T. run?"` immediately followed by "The instrument head will move." A pause is generally expected to *stop* motion, not cause it — showing this disclaimer unconditionally risks training operators to ignore it (it's technically-true-sometimes, always-shown noise), which undermines the purpose of a safety disclaimer that's meant to be read and trusted before a physically consequential confirmation.
**Fix:** If pause genuinely never causes head motion, suppress the note for `action === "pause"`; if it sometimes does (e.g., motion to a safe/parked position), confirm this with the instrument-core behavior and consider per-action copy instead of one constant for all three actions.

### WR-06: Tool-id normalization is reimplemented independently in three places

**File:** `controller/components/runs/controlDecision.ts:378-380` (`normalizeToolKey`), `controller/server/recoveryControl.ts:18` (`normalize`), `controller/server/routers/tool.ts:53` (`normalize` inside `getToolFromDB`)
**Issue:** All three functions implement the identical `(s || "").toLowerCase().replace(/[^a-z0-9]/g, "")` transform, and the correctness of "is this tool currently tracked by the running step" (client-side `isToolTrackedByRunningStep`, used to disable Run Recovery buttons) and "is this tool controlled only from the run page" (server-side `recoveryControl`'s refusal check) and "which DB row does this id refer to" (`getToolFromDB`) all depend on these three independent copies staying bit-for-bit identical. The code comments acknowledge this ("kept in sync by convention, not import") but there is no shared constant, no lint rule, and no test asserting all three stay textually identical — only tests of each individually. A future edit to one (e.g., adding a diacritics-folding step, or changing it to also strip leading/trailing whitespace differently) without updating the other two would silently desync "tracked by running step" from "resolvable DB row", which is exactly the kind of drift the comment is trying to guard against by calling it out.
**Fix:** Extract a single zero-dependency normalization helper (it is intentionally tiny and has no imports) into a shared module that both client (`controlDecision.ts`) and server (`recoveryControl.ts`, `routers/tool.ts`) can import, or at minimum add a static-scan test (alongside the existing ones in `staticScan.test.ts`) asserting the three implementations are textually identical.

### WR-07: A failed Stop/Clear-All/Delete-Run follow-up after an accepted abort leaves queue state desynced from instrument state

**File:** `controller/components/runs/controlDecision.ts:397-416` (`runAfterAccepted`), used by `controller/components/runs/InstrumentStopModal.tsx:52`
**Issue:** `runAfterAccepted` correctly only invokes the queue-side follow-up (`stop()`, `clearAll()`, or `clearByRunId()`) after the abort send is `accepted` — this is the right order and is well covered by tests. However, if the instrument **does** accept the abort but the follow-up mutation itself then rejects (e.g., a transient network/DB failure calling `stopMutation.mutateAsync()`), the only outcome is:
```ts
if (result.followUp === "failed") {
  persistentErrorToast("Follow-up failed", result.followUpMessage ?? "");
}
```
The instrument has genuinely aborted, but the command queue's own bookkeeping (`runningStep`, queue state) is never updated to reflect that, since the queue-side mutation that would have done so never completed. The operator is told "Follow-up failed" via toast but there is no automatic retry, no reconciliation, and no visual indication on the run page that the queue now disagrees with the instrument about whether a step is still "running". A subsequent poll of `commandQueue.runState` would presumably keep reporting the stale (now-incorrect) running step until something else intervenes.
**Fix:** At minimum, surface this state explicitly in the UI (e.g., an alert banner distinct from the generic toast, persisting until resolved) and/or give the operator a manual retry affordance for the follow-up specifically, rather than relying on a toast that can be dismissed and forgotten while the underlying desync persists.

## Info

### IN-01: Dead state and legacy debug artifact in `RunsComponent.tsx`

**File:** `controller/components/runs/RunsComponent.tsx:83,96,142-146,204-209`
**Issue:** `_userFormError` is set via `setUserFormError(...)` in three places (including inside a `console.error("❌ Failed to load form:", ...)` handler) but the value itself is never read/rendered anywhere in the component — `UserFormModal` is not passed an error prop. This is pre-existing legacy code that the phase-2 changes happened to pass through rather than something newly introduced, but since the whole file is in scope for this review it's worth flagging: the dead state and the emoji-prefixed `console.error` are both quality smells. Also at line 205, `handleUserFormSubmit` contains a `// TODO: Handle form submission - for now just resume` with no corresponding tracked follow-up.
**Fix:** Either wire `_userFormError` into the `UserFormModal` UI or remove the dead state; replace the `console.error` with the project's logging convention; resolve or ticket the TODO.

### IN-02: `tip_reuse` command field has no enum/select type despite only two valid values

**File:** `controller/components/tools/constants.ts:328`
**Issue:** `{ name: "tip_reuse", type: "text" }` is annotated in a comment as `// "fresh" or "reuse"; Field has no select type` — acknowledged as a known gap in the form-field type system rather than something this phase introduced. Leaving it as free text invites operator typos in a field that only has two valid values (unrelated to the pause/resume/abort decision fields, which do use the dedicated yes/no radio UI).
**Fix:** Out of scope for this phase's safety-review goals, but worth tracking as a follow-up to extend the field-type system with an enum/select type.

---

_Reviewed: 2026-10-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
