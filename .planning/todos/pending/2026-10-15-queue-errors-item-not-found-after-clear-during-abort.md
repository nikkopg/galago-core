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
