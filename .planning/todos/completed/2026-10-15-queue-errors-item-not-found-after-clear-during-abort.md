---
created: 2026-10-15T06:00:00.000Z
title: Queue errors "Item N not found" after clear during abort
area: api
severity: minor
files:
  - controller/server/command_queue.ts:743-748
  - controller/server/command_queue.ts:1200-1213
  - controller/server/utils/SqliteQueue.ts:493-523
---

## Problem

If the operator runs Clear All or deletes a run (`clearAll` / `clearByRunId`) while an aborted
F.A.S.T. step is still finishing, the step's row is removed from `<q>_commands` before the tool
call returns. When `executeCommand` then throws (aborted), the busy-loop catch calls
`commands.fail(queueId, ...)`. `_updateItem` → `find` throws `"Item N not found"`, the error
escapes through `_start`'s catch, and the queue lands in an error state the operator didn't cause.
The rows are already gone as intended, so no data is lost; only the error state and message are
wrong.

This existed before quick task 261015-h0q and is unchanged by it; see that task's SUMMARY. The
late-reply `dequeue()` path added there is already a no-op for missing rows. Only the busy-loop's
`commands.fail` call is affected.

## Solution

TBD. Likely approach: make the busy-loop catch tolerate a step that was deleted while it ran, for
example by having `SqliteQueue.fail` (or a check before it) return without throwing when the row
no longer exists. Log it as "step removed by operator while running" instead of
"Command Failed", and don't set the queue's FAILED/error state for that case. Add a test: start a
step, run `clearAll()` while the tool call is pending, have the tool call reject, then check that
nothing throws and no bogus error state is left.

## Resolution

2026-10-15, quick task 261015-t9e. `SqliteQueue.fail` and `failAndDequeueRun` now resolve to
`false` (instead of throwing) when the row no longer exists, decided inside the same transaction
via a new private `_hasItem` existence check — no error-message matching. The busy-loop catch
checks that return value and, when the row was removed, logs "Step Removed While Running"
(warning, with the step's own error text), sets the queue OFFLINE and breaks, without setting a
queue error, marking FAILED, or notifying failure. This closes audit gap INT-01 (FLOW-d) as well,
since the same race (Clear All / delete-run landing before the step's tool call ends) is what
that gap described. Covering tests: `sqliteQueue.test.ts` ("failAndDequeueRun resolves to false
and changes nothing when the step's row was removed", "fail resolves to true for an existing row,
and to false changing nothing once the row was removed"), `stopInterception.test.ts` (describe
"Clear All / delete run during a controllable step (INT-01)"), and `toolControl.test.ts` ("a plain
step failure after Clear All removed the running step leaves no queue error", "a step that
succeeds after Clear All removed it leaves no queue error", "a late abort reply after Clear All
removed the step changes nothing and still returns ok").
