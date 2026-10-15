---
phase: quick-261015-h0q
plan: 01
subsystem: queue
tags: [sqlite, better-sqlite3, trpc, abort, command-queue]

# Dependency graph
requires:
  - phase: Phase 2
    provides: commandQueue.toolControl (abort/pause/resume routing, runControl capability map, audit logging)
provides:
  - "SqliteQueue.fail(id, error, { dequeue }) — fails a step and optionally removes it from the queue in one transaction"
  - "SqliteQueue.dequeue(id) — removes a step from the queue without touching its record, no-op on missing/unqueued id"
  - "CommandQueue._abortAcceptedQueueId marker + _recordAcceptedAbort — records an accepted operator abort for the running step, handling both the still-running and already-ended (race) cases"
affects: [queue, run-page, command_queue]

actuals:
  tokens: 4382
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Queue-owned abort-detection signal: toolControl records action===abort && result.ok against the queue's own running-step identity, never a run-state/status read (keeps the existing static-scan constraint on toolControl's body)"
    - "Accepted-abort marker is set-then-consumed per command iteration (cleared at the start of every busy-loop command and consumed once in the catch), so a stale marker can never match a re-queued step"

key-files:
  created:
    - controller/test/sqliteQueue.test.ts
  modified:
    - controller/server/utils/SqliteQueue.ts
    - controller/server/command_queue.ts
    - controller/test/toolControl.test.ts

key-decisions:
  - "Failed-step retry stays the default (SqliteQueue.fail without options behaves exactly as before); only a step whose Abort the tool accepted is dequeued, keeping Skip and retry intact for plain failures and refused/transport-error aborts"
  - "No new RunStatus value added for an aborted step — it stays visible as FAILED in run history and the swim lane, same as any other failure, since adding an aborted status would touch setRunStatusWithTimestamp, swim-lane colors and the queued predicate for no behavioral gain here"
  - "Run Recovery Abort and aborts made on the instrument itself are explicitly out of scope — no reliable queueId link exists for them, so they keep today's retry-plus-Skip behavior"
  - "Recording an accepted abort is wrapped in try/catch inside toolControl: on any error there the operator is never told the accepted abort failed (a warning is logged instead and the tool's own result is still returned)"

patterns-established:
  - "Pattern: an in-memory queue-owned marker (_abortAcceptedQueueId) bridges an async tRPC mutation (toolControl) and the synchronous busy-loop catch that runs in the same continuation as the step's own promise settling"

requirements-completed: [QUICK-261015-h0q]

coverage:
  - id: D1
    description: "An accepted operator Abort removes the running step from the queue end-to-end: step ends FAILED, is out of getPaginated, restarting the queue runs the next command, and the aborted step stays visible in commands.all()"
    requirement: "QUICK-261015-h0q"
    verification:
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > an accepted abort keeps the aborted step out of the next queue start"
        status: pass
    human_judgment: false
  - id: D2
    description: "Plain step failures and refused aborts keep upstream retry (step stays queued, startNext returns it first)"
    requirement: "QUICK-261015-h0q"
    verification:
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > a step failure without an accepted abort stays queued and re-runs first"
        status: pass
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > a refused abort does not remove the step"
        status: pass
    human_judgment: false
  - id: D3
    description: "SqliteQueue.fail default behavior (stays queued) and fail with { dequeue: true } (removed from queue, record kept) are unit-covered in isolation on an in-memory DB"
    requirement: "QUICK-261015-h0q"
    verification:
      - kind: unit
        ref: "controller/test/sqliteQueue.test.ts#SqliteQueue > fail keeps the step queued by default"
        status: pass
      - kind: unit
        ref: "controller/test/sqliteQueue.test.ts#SqliteQueue > fail with dequeue removes the step from the queue but keeps its record"
        status: pass
    human_judgment: false
  - id: D4
    description: "An abort accepted after the step already ended (reply-after-step-end race) still removes the step from the queue"
    requirement: "QUICK-261015-h0q"
    verification:
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > an abort accepted after the step already ended still removes it"
        status: pass
      - kind: unit
        ref: "controller/test/sqliteQueue.test.ts#SqliteQueue > dequeue removes a failed step from the queue without changing its record"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-15
status: complete
---

# Quick Task 261015-h0q: Fix operator-aborted step re-run on queue restart Summary

**An operator-accepted Abort now removes that step from `SqliteQueue`'s queue table so restarting the queue runs the next command instead of re-sending the aborted transfer, while every other failure keeps today's retry-plus-Skip behavior.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-10-15
- **Tasks:** 3/3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `SqliteQueue.fail(id, error, { dequeue })` now optionally removes the row from `<q>_queue` in the same transaction as the status update, mirroring `complete`/`skip`; the default (no options) is byte-identical to the old behavior.
- `SqliteQueue.dequeue(id)` removes a step from the run order without touching its record — a no-op for a missing or already-unqueued id.
- `CommandQueue` records an accepted operator abort (`action === "abort" && result.ok`) against the exact running-step object via `_abortAcceptedQueueId`, consumed once by the busy-loop catch to call `commands.fail(..., { dequeue: true })`.
- The reply-after-step-end race (abort accepted after the step's own failure was already recorded) is handled by `_recordAcceptedAbort`'s else branch, which dequeues the step directly — proven by an end-to-end test that holds the abort reply pending across the step's rejection.
- Four new queue-level tests in `controller/test/toolControl.test.ts` and a new `controller/test/sqliteQueue.test.ts` (5 unit cases) lock in both the fix and its boundary (plain failures, refused aborts, and the race case all keep or restore correct behavior).

## Task Commits

Each task was committed atomically:

1. **Task 1: An accepted Abort removes the running step from the queue end-to-end** - `4b575ed` (fix)
2. **Task 2: Guard against an over-broad fix (plain failures/refused aborts keep retry; direct SqliteQueue unit coverage)** - `5598347` (test)
3. **Task 3: Abort accepted after the step already ended still dequeues it (race), then full gates** - `e18a177` (fix)

_Note: Tasks 1 and 3 are tdd="true" tracer/auto tasks — each followed RED (failing test confirmed) then GREEN (production fix) before its commit; Task 2 is TDD guard coverage that was expected to pass on first run and did._

## Files Created/Modified

- `controller/server/utils/SqliteQueue.ts` - `fail` gained an optional `{ dequeue }` that removes the queue row in the same transaction; new `dequeue(id)` method for a status-preserving, no-throw queue removal.
- `controller/server/command_queue.ts` - new `_abortAcceptedQueueId` field, `_recordAcceptedAbort` method (identity-check branch + race-case dequeue branch), `toolControl` call site wrapped in try/catch, busy-loop marker reset/consume plus `{ dequeue: abortAccepted }` passed to `commands.fail`.
- `controller/test/toolControl.test.ts` - four new queue-level test cases (accepted abort end-to-end, plain failure retry, refused abort retry, late-accepted-abort race).
- `controller/test/sqliteQueue.test.ts` (new) - five direct unit tests of `SqliteQueue.fail` (default and `dequeue: true`) and `SqliteQueue.dequeue`.

## Decisions Made

- Kept failed-step retry as the default (per the plan's design decision, resolved from the code at planning time: `fail` has never removed the row, and the swim-lane UI already treats FAILED as still-queued/skippable). Only an operator abort the tool accepted dequeues the step.
- No new `RunStatus` value for "aborted" — the aborted step stays FAILED in run history; adding a status would have touched `setRunStatusWithTimestamp`, swim-lane colors, and the `queued` predicate for no requirement in this plan.
- The abort-detection signal is entirely queue-owned (toolControl's own `action`/`result.ok` plus the running-step identity check) — no instrument-state read was added anywhere in `toolControl`'s body, preserving the existing static-scan constraint (`no instrument-state check before sending`).
- Recording the accepted abort is wrapped in try/catch so a failure there (e.g., a `dequeue` error) is logged as a warning ("Aborted Step Dequeue Failed") but never changes what `toolControl` returns to the operator — the instrument did accept the abort.

## Deviations from Plan

None - plan executed exactly as written. Each task's RED phase was confirmed failing before the corresponding GREEN implementation, per the plan's TDD instructions.

## Issues Encountered

- `tsc --noEmit` initially flagged `failedRecord.error?.message` in `controller/test/sqliteQueue.test.ts` because `RunCommand.error` is typed `unknown`; fixed with a local `as Error` cast in the test (no production code change).
- `prettier --check` initially flagged `controller/test/toolControl.test.ts` after the Task 3 additions; ran `prettier --write` on that one file and re-checked — all four touched files now pass.

## Follow-up Candidate (observed, not fixed — out of scope per the plan)

Pre-existing, unchanged by this fix: when an aborted step's tool reply arrives **after** Clear All or a per-run delete has already removed that step's row from `<q>_commands`, `commands.fail` (called from the busy-loop catch, not from the abort-dequeue path) throws `"Item N not found"` from `_updateItem`, which surfaces through `_start`'s own catch. This plan's `_recordAcceptedAbort` else-branch `dequeue` call is itself a no-op in that situation (per its design), but the busy-loop's own `commands.fail` call on the same already-deleted step is not — that pre-existing throw path was observed during planning and is unchanged here. It is a separate, pre-existing code path and was left untouched per the plan's explicit scope boundary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The fix is self-contained to the queue/command-queue subsystem; nothing downstream (run page, Gantt, UI) needed changes since they all read `commandQueue.getAll` (`SqliteQueue.all()`), which still returns the aborted step as FAILED. No further action needed before merging.

---
*Quick task: 261015-h0q*
*Completed: 2026-10-15*

## Self-Check: PASSED

All created/modified files found on disk; all three task commits (`4b575ed`, `5598347`, `e18a177`) confirmed as ancestors of HEAD.
