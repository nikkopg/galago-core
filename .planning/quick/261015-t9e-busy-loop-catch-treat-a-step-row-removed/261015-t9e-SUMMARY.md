---
phase: quick-261015-t9e
plan: 01
subsystem: api
tags: [sqlite, better-sqlite3, command-queue, vitest]

# Dependency graph
requires:
  - phase: quick-261015-o44
    provides: "failAndDequeueRun, fail and the busy-loop catch this plan adds a removed-row branch to"
provides:
  - "SqliteQueue.fail / failAndDequeueRun resolve to false (instead of throwing) when the row no longer exists, decided inside the same transaction via a private _hasItem existence check"
  - "Busy-loop catch removed-row branch: logs 'Step Removed While Running' and sets OFFLINE without a queue error, for an accepted abort, a plain failure, or a complete() throw from a step that succeeded, after Clear All or delete-run removed the step's row"
  - "INT-01 (FLOW-d) closed and the 'Item N not found' todo closed"
affects: [queue-control-path-run-state, run-page-live-controls]

# Actuals (#2632)
actuals:
  tokens: 6452
  tasks: 2
  commits: 2
  plan_head_before: 7daeb8d4cb6710e4b089f24b2b9d36f794e2f3d0
  plan_head_after: 5839b406dedcae8338b1155f4aa0e7537d5ffa87

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Missing-row tolerance decided as a typed return value inside the same SQLite transaction as the update (_hasItem check), never by catching a thrown error's message text"
    - "A single removed-row branch in the busy-loop catch covers every path that reaches it with a missing row (accepted abort, plain failure, success-that-still-throws-from-complete), keyed only off the SqliteQueue return value"

key-files:
  created: []
  modified:
    - controller/server/utils/SqliteQueue.ts
    - controller/server/command_queue.ts
    - controller/test/sqliteQueue.test.ts
    - controller/test/stopInterception.test.ts
    - controller/test/toolControl.test.ts

key-decisions:
  - "fail and failAndDequeueRun resolve to false on a missing row rather than throwing; the check is a new private _hasItem (SELECT 1) run as the first statement inside the existing transaction, so there is no check-then-act gap and no message-text matching anywhere in command_queue.ts"
  - "The removed-row branch sets OFFLINE (not READY and not FAILED): Clear All already clears the queue error via clearError(), so not-FAILED makes the racing and non-racing orders converge; OFFLINE (not READY) means enqueueRun cannot auto-dispatch the remaining runs after a delete-run, mirroring the sibling Pause-queue/stop flow (D-18)"
  - "The late-abort-reply path (T-01-08, dequeueFailedRun) needed no code change — it already selects the row first and returns false before any _updateItem/find call — only a new end-to-end assertion"

patterns-established:
  - "A tracer task (Task 1) proved the abort-path race end-to-end through the real tRPC router before Task 2's TDD cycle expanded the same removed-row branch to the plain-failure and success paths, mirroring the 261015-o44 precedent"

requirements-completed: [QUICK-261015-t9e]

coverage:
  - id: D1
    description: "An accepted abort whose Clear All or delete-run follow-up removes the running step's row before the tool call ends leaves the queue OFFLINE with no error, no 'Item N not found', and dispatches nothing else; the operator's removal stands"
    requirement: "QUICK-261015-t9e"
    verification:
      - kind: unit
        ref: "controller/test/stopInterception.test.ts#an accepted abort whose Clear All follow-up finishes before the step rejects leaves no queue error"
        status: pass
      - kind: unit
        ref: "controller/test/stopInterception.test.ts#an accepted abort whose delete-run follow-up finishes before the step rejects leaves the other run queued and undispatched"
        status: pass
      - kind: unit
        ref: "controller/test/sqliteQueue.test.ts#failAndDequeueRun resolves to false and changes nothing when the step's row was removed"
        status: pass
    human_judgment: false
  - id: D2
    description: "A plain step failure, or a step that succeeds (complete() throw), after Clear All removed its row is handled the same way as an accepted abort: OFFLINE, no error, one 'Step Removed While Running' log"
    requirement: "QUICK-261015-t9e"
    verification:
      - kind: unit
        ref: "controller/test/toolControl.test.ts#a plain step failure after Clear All removed the running step leaves no queue error"
        status: pass
      - kind: unit
        ref: "controller/test/toolControl.test.ts#a step that succeeds after Clear All removed it leaves no queue error"
        status: pass
      - kind: unit
        ref: "controller/test/sqliteQueue.test.ts#fail resolves to true for an existing row, and to false changing nothing once the row was removed"
        status: pass
    human_judgment: false
  - id: D3
    description: "A late abort reply for an attempt whose row was removed changes nothing, throws nothing, logs 'Aborted Run Dequeue Skipped', and toolControl still returns the tool's ok result"
    requirement: "QUICK-261015-t9e"
    verification:
      - kind: unit
        ref: "controller/test/toolControl.test.ts#a late abort reply after Clear All removed the step changes nothing and still returns ok"
        status: pass
    human_judgment: false
  - id: D4
    description: "With the row still present, an accepted abort and a plain failure behave exactly as before (FAILED with the step's own error); no message-text matching exists in command_queue.ts; two not-found throws remain in SqliteQueue for every other caller"
    requirement: "QUICK-261015-t9e"
    verification:
      - kind: unit
        ref: "controller/test/toolControl.test.ts#an accepted abort keeps the aborted step out of the next queue start"
        status: pass
      - kind: unit
        ref: "controller/test/toolControl.test.ts#a step failure without an accepted abort stays queued and re-runs first"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*//' controller/server/utils/SqliteQueue.ts | grep -cF 'Item ${id} not found' -ge 2"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*//' controller/server/command_queue.ts | grep -cE '(includes|match|test|startsWith|endsWith|search)\\(.*not found' = 0"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-10-15
status: complete
---

# Quick Task 261015-t9e: Busy-loop catch treats a step row removed by Clear All/delete-run as already handled — Summary

**SqliteQueue.fail and failAndDequeueRun now resolve to false (instead of throwing "Item N not found") when Clear All or a run delete removed the running step's row mid-flight; the busy-loop catch takes a new removed-row branch — "Step Removed While Running", OFFLINE, no queue error — covering an accepted abort, a plain failure, and a step that still succeeds, closing both audit gap INT-01 and the matching pending todo.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-10-15 (baseline 237/237 unit tests, tsc clean, prettier clean)
- **Completed:** 2026-10-15
- **Tasks:** 2 (Task 1 tracer/tdd, Task 2 auto/tdd)
- **Files modified:** 5 (code: 2, tests: 3)

## Accomplishments
- `SqliteQueue.fail` and `failAndDequeueRun` resolve to `false` — decided inside the same better-sqlite3 transaction as the update, via a new private `_hasItem` existence check — instead of throwing when the operator's Clear All or run-delete already removed the row. `_updateItem` and `find` are untouched and still throw for every other caller.
- The busy-loop catch adds one removed-row branch, reached by an accepted abort (`failAndDequeueRun` → false), a plain failure (`fail` → false), or a `complete()` throw from a step whose tool call succeeded after its row was removed. It logs "Step Removed While Running" (warning, with queueId/runId/toolId/abortAccepted and the step's own error text), sets the queue OFFLINE, and breaks — no `this.error`, no FAILED, no "Command Failed" log, no failure notification, and no inspection of any error's message text.
- End-to-end race tests through the real tRPC router and `CommandQueue` (abort + Clear All, abort + delete-run, plain failure + Clear All, success + Clear All, late abort reply + Clear All) confirm the queue ends OFFLINE with no error, `getError()` is null, the removed rows stay removed, and nothing else dispatches until the operator presses Run.
- Row-still-exists regressions are now pinned with explicit `queue.error` assertions and an absence check for "Step Removed While Running", confirming the unchanged FAILED path for both the accepted-abort and plain-failure tests.
- Full gates green: 244/244 unit tests (237 baseline + 7 new), `tsc --noEmit` clean, `prettier --check` clean on all five code/test files. The pending todo was moved to completed with a Resolution section (left uncommitted per the orchestrator's docs-commit convention).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end abort race (INT-01, abort path)** - `1b5048d` (fix)
2. **Task 2: Expand to plain failure/success; late-reply and row-still-exists regressions** - `5839b40` (fix)

_Note: each task's RED test changes and GREEN implementation were committed together per task, matching this plan's `tdd="true"` task-level commit scope (not a separate RED/GREEN commit pair)._

The todo move (`.planning/todos/pending/...` → `.planning/todos/completed/...`) was done as a file move (`git mv`, unstaged) per the orchestrator's instruction that it handles the docs commit; it is not part of either commit above.

## Files Created/Modified
- `controller/server/utils/SqliteQueue.ts` - new private `_hasItem(id)` existence check; `fail` and `failAndDequeueRun` both return `Promise<boolean>` / `Promise<number[] | false>` and resolve false on a missing row instead of throwing
- `controller/server/command_queue.ts` - busy-loop catch: new `rowRemoved` local, both the abort and plain branches route their SqliteQueue return value into it, and a new removed-row branch logs "Step Removed While Running", sets OFFLINE and breaks before the FAILED path
- `controller/test/sqliteQueue.test.ts` - two new unit tests: `failAndDequeueRun` false-on-removed-row (via `clearByRunId` and `clearAll`), `fail` true-on-existing / false-on-removed-row
- `controller/test/stopInterception.test.ts` - new describe "Clear All / delete run during a controllable step (INT-01)" with two end-to-end race tests (Clear All, delete-run) through `createConfirmedSender` + `runAfterAccepted` + the real tRPC router + `CommandQueue`
- `controller/test/toolControl.test.ts` - three new race tests (plain failure, success, late abort reply, all racing Clear All) plus row-still-exists regression assertions added to the two existing accepted-abort/plain-failure tests

## Decisions Made
See the plan's `<objective>` for the full Q1/Q2/Q3 reasoning (decided at planning time, implemented as specified, no deviations):
- Q1: missing-row tolerance lives in `SqliteQueue` as a typed return value, checked inside the same transaction (`_hasItem`), never by message-text matching or a check-then-act gap in `CommandQueue`.
- Q2: the removed-row branch sets OFFLINE with no error (not FAILED, not READY) — this is what makes the racing and non-racing operator-action orders converge, and mirrors the sibling Pause-queue/stop (D-18) end state.
- Q3: the late-abort-reply path (T-01-08) needed no code change; `dequeueFailedRun` already returns false safely before any `_updateItem`/`find` call. Only a new end-to-end assertion was added.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' RED/GREEN cycles, the grep gates, and the todo-close matched the plan's `<action>` blocks. Two small test-sequencing adjustments were needed while writing the sqliteQueue.test.ts unit tests (draining a still-queued row from an earlier scenario before starting a fresh one, so `startNext()` reached the intended row) — these are test-authoring details only, not deviations from the plan's specified behavior or outcome.

## Known Stubs

None.

## Issues Encountered
None of substance. Two test files needed a same-queue-instance row-draining fix (see Deviations) before the new sqliteQueue.test.ts assertions passed; both were resolved immediately and verified green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Audit gap INT-01 (FLOW-d) is closed; a milestone re-audit should now find it resolved.
- The pending todo "Queue errors 'Item N not found' after clear during abort" is moved to `.planning/todos/completed/` with a Resolution section (file move left uncommitted for the orchestrator).
- No blockers for subsequent queue or run-control work.

---
*Phase: quick-261015-t9e*
*Completed: 2026-10-15*

## Self-Check: PASSED

All five `files_modified` code/test paths and the completed-todo file exist on disk, and both
commits (`1b5048d`, `5839b40`) are ancestors of HEAD.
