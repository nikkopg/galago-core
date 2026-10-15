---
phase: 01-queue-control-path-run-state
reviewed: 2026-10-15T11:18:04Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - controller/server/command_queue.ts
  - controller/server/utils/SqliteQueue.ts
  - controller/server/runControl.ts
  - controller/server/runState.ts
  - controller/server/tools.ts
  - controller/test/queueRestart.test.ts
  - controller/test/sqliteQueue.test.ts
  - controller/test/toolControl.test.ts
  - controller/test/runControl.test.ts
  - controller/test/runState.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-15T11:18:04Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This review replaces the 2026-10-13 `01-REVIEW.md` (whose WR-01/WR-02/WR-03 findings were
fixed and verified, and are not re-raised here) and targets everything that landed since
`25c75ab`, i.e. quick tasks `261015-h0q` (4b575ed, 5598347, e18a177) and `261015-o44` (662bb12,
7627bf6, 38b5d17): the accepted-abort run-wide dequeue, the T-01-08 three-layer late-abort-reply
gate (`_runningStep` identity → `_failedAttempt` token → `SqliteQueue.dequeueFailedRun`), and
restart-orphan recovery (`recoverInterruptedSteps`).

I traced the full state machine by hand against every test in `toolControl.test.ts`,
`sqliteQueue.test.ts`, `queueRestart.test.ts` and `runState.test.ts`, specifically hunting for:
(a) a window where a stale abort reply, a restart, or a re-queue could act on the wrong attempt;
(b) a non-atomic read/mutate pair inside `SqliteQueue`'s transactions; (c) an error path that
could leave the queue stuck rather than failing closed; (d) a test that would still pass if the
gate it names were removed.

I could not find a defect in any of those four areas for the reviewed diff. The three-layer gate
is closed correctly by **object-identity** comparisons (`_runningStep === step`,
`_failedAttempt === step`) rather than by `queueId` alone, which is what actually prevents a
re-queued/re-run attempt of the *same row* from being confused with the attempt a stale reply
targets — I specifically tried to construct a counter-example around attempt reuse on the same
`queue_id` (restart retry, `gotoCommand`, `gotoCommandByRunIndex`) and in every case the identity
check (not the numeric `queueId`) is what correctly closes the window; `_abortAcceptedQueueId`
(the one field that *is* a bare number, not an object) is provably safe because it is only ever
set from inside the same busy-loop iteration whose catch reads it, and is reset at the top of
every iteration before dispatch. `SqliteQueue`'s new methods (`failAndDequeueRun`,
`dequeueFailedRun`, `recoverInterruptedSteps`, `_dequeueRunRemainder`) each execute entirely
inside one `db.transaction()` call with no `await` in between the gate check and the mutation,
and `_dequeueRunRemainder` is only ever invoked after the caller has already removed the row's own
`queue` entry, so there is no double-counting. The known, out-of-scope "Item N not found" gap
(Clear All racing an in-flight abort) was not re-verified and is not re-reported here per the
task's instruction.

While reading the full files (not just the diff hunks), I found one pre-existing, unrelated
correctness bug in `command_queue.ts`'s "goto" Tool Box command handling (not part of this phase's
diff — present since the initial commit) that is worth flagging given the file was in scope, and
confirmed that the prior review's carried-forward Info item (`RunStateMonitor.snapshot()`'s
shallow copy) is still present, unchanged.

## Warnings

### WR-01: A "goto" step with a missing `targetIndex` silently re-queues the *entire* run instead of throwing

**File:** `controller/server/command_queue.ts:1218-1222`, `controller/server/utils/SqliteQueue.ts:176-183`

**Issue:** The built-in "goto" Tool Box command does:

```ts
const targetIndex = Number(nextCommand.commandInfo.params?.targetIndex);
const runId = nextCommand.commandInfo.params?.runId || nextCommand.runId;

await this.commands.complete(nextCommand.queueId);
if (targetIndex !== undefined && runId) {
  await this.gotoCommandByRunIndex(runId, targetIndex);
} else {
  throw new Error("Goto command requires either targetId or both targetIndex and runId");
}
```

`Number(undefined)` is `NaN`, and `NaN !== undefined` is `true` — so a goto step whose
`params.targetIndex` key is absent (not merely empty-string; `Number("")` is `0`, which is fine)
never reaches the `else` branch, even though the comment/error message implies it should. It
proceeds to `gotoCommandByRunIndex(runId, NaN)`, which calls
`SqliteQueue.gotoCommandByIndex(runId, NaN)`. That method's own bounds check,
`if (targetIndex < 0 || targetIndex >= commands.length)`, is also bypassed: every numeric
comparison against `NaN` is `false`, so neither branch of the `||` trips. Execution falls through
to `commands.slice(targetIndex)`, and `Array.prototype.slice(NaN)` is specified to treat `NaN` as
`0` — i.e. the *entire* run's command list is requeued from the front, silently, instead of the
intended "Invalid index" error (or the top-level "Goto command requires..." error).

Verified in Node:
```
Number(undefined)              // NaN
Number(undefined) !== undefined // true  (the guard never trips)
NaN < 0, NaN >= 5               // false, false (bounds check bypassed)
[1,2,3,4,5].slice(NaN)          // [1,2,3,4,5]  (same as slice(0))
```

This is not part of the reviewed diff (confirmed via `git log -S"targetIndex"`, present since the
initial commit) and the UI form for a "goto" step (`controller/components/tools/constants.ts:99-102`)
sets `defaultValue: 0`, so it is unlikely to be hit through the normal step-builder UI today.
However, galago-core drives a physical lab-automation robot, and anything other than the UI
builder that can produce a "goto" command without an explicit `targetIndex` (an imported/
hand-authored protocol, a future API, a bug in a different call site) would cause an entire
already-executed run to silently restart from its first step instead of failing loudly — a
real-world re-execution of physical actions, not just a logic error.

**Fix:**
```ts
const rawTargetIndex = nextCommand.commandInfo.params?.targetIndex;
const targetIndex = Number(rawTargetIndex);
const runId = nextCommand.commandInfo.params?.runId || nextCommand.runId;

await this.commands.complete(nextCommand.queueId);
if (rawTargetIndex !== undefined && Number.isInteger(targetIndex) && runId) {
  await this.gotoCommandByRunIndex(runId, targetIndex);
} else {
  throw new Error("Goto command requires either targetId or both targetIndex and runId");
}
```
and, defensively, in `SqliteQueue.gotoCommandByIndex`:
```ts
if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= commands.length) {
  throw new Error(`Invalid index ${targetIndex} for run ${runId}. Run has ${commands.length} commands.`);
}
```

## Info

### IN-01 (carried forward, still unfixed): `RunStateMonitor.snapshot()` returns a shallow copy

**File:** `controller/server/runState.ts:168-170`

**Issue:** Unchanged since the last review. `snapshot()` still does `return { ...this.envelope };`
— only the top-level envelope is copied; `runState`, `runState.pause`, and `runState.pause.detail`
remain shared references with the monitor's internal state. No current caller mutates these (the
tRPC `runState` query only reads), so this remains latent. Re-verified by reading the current file:
the method body is byte-for-byte the same as when this was first logged.

**Fix:** Document the returned envelope (and nested fields) as caller-immutable, or
`structuredClone(this.envelope)` if a stronger guarantee is wanted before more call sites consume it.

### IN-02: `recoverInterruptedSteps` can double-process a run if more than one of its rows is left `STARTED`

**File:** `controller/server/utils/SqliteQueue.ts:564-605`

**Issue:** `recoverInterruptedSteps` snapshots every `STARTED` row up front (`rows`), then iterates
it, calling `_dequeueRunRemainder(updated.runId)` per row. `_dequeueRunRemainder` dequeues *every*
currently-queued row of that `run_id`, not just rows positioned after the one being processed, and
leaves a non-`CREATED` row's status alone while still removing it from `<q>_queue`. If two orphaned
`STARTED` rows ever belonged to the same run (not possible under normal single-busy-loop operation,
where only one step is ever `STARTED` at a time, but not defended against here), processing the
first row's remainder would dequeue the second row too — then the loop's next iteration (over the
original, pre-fetched `rows` snapshot) still visits that second row, marks it `FAILED` anyway (which
is the correct end state), but emits a second, materially-empty `remainder: []` result/log entry for
what is really one incident. Final DB state converges correctly either way; this is a diagnostic/
log-noise gap, not a correctness bug, and requires a data anomaly that shouldn't occur today.

**Fix:** Either skip rows in the snapshot whose `queue_id` no longer exists in `<q>_queue` by the
time they're reached in the loop (re-check before processing), or de-duplicate by `run_id` before
iterating so each run's orphan(s) are reported once.

---

_Reviewed: 2026-10-15T11:18:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
