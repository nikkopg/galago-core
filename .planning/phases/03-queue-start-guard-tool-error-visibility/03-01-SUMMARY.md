---
phase: 03-queue-start-guard-tool-error-visibility
plan: 01
subsystem: queue
tags: [queue, f5, single-flight, audit-log, sqlite, vitest]

requires:
  - phase: 02-run-control
    provides: "Queue busy loop, running-step bracket, FakeGrpc test harness, retry-after-failure semantics"
provides:
  - "Single-flight guard as the first statement of CommandQueue._start: a Start while the busy loop owns the queue is ignored and audited"
  - "'Queue Start Ignored' warning log naming source (operator|enqueue) and the in-flight queueId/runId"
  - "'Queue Started' log that lists, in queue order, queueId/runId/status of every queued row, capped at 50"
  - "SqliteQueue.queuedRowsSync(): synchronous read-only queue-joined listing"
  - "server/queueStartListing.ts: pure describeQueueStart / describeQueueStartReadFailure"
affects: [03-03 client start summary, 03-04 error visibility, verify-work for QUE-07 QUE-08 QUE-09]

actuals:
  tokens: 4400
  tasks: 2
  commits: 3
plan_head_before: 91ff9773709cfcf5b60aee08491b0ef7edc2bbd6
plan_head_after: 12fad3fa99391f5dbd6be03eb1af7c694ee41ae4

tech-stack:
  added: []
  patterns:
    - "Early-return single-flight guard keyed on _runningPromise, with no await between guard and claim"
    - "Pure formatter module for audit text, unit-tested without the queue"
    - "Fake setTimeout (vi.useFakeTimers toFake setTimeout) plus advanceTimersByTimeAsync to drive the 1500 ms busy loop"

key-files:
  created:
    - controller/server/queueStartListing.ts
    - controller/test/queueStartGuard.test.ts
  modified:
    - controller/server/command_queue.ts
    - controller/server/utils/SqliteQueue.ts

key-decisions:
  - "Guard lives inside _start only (D-01); restart router and enqueueRun auto-start are covered with no per-caller guards"
  - "Start listing is read with a new synchronous queuedRowsSync(), not await getPaginated(), so two same-tick _start() calls cannot both pass the guard (research Pitfall 1)"
  - "_start gains an optional source parameter (default operator); enqueueRun passes 'enqueue'"
  - "'Will run' counts CREATED and FAILED rows; every queued row is still listed with its status; listing capped at 50 then '... and N more'"
  - "Pause queue then Start while a step is in flight is ignored until the step ends (D-04 accepted); stop() unchanged"

patterns-established:
  - "Ignored Start is a log-and-return: no state, error, _failedAttempt or queue change, and the caller sees undefined"

requirements-completed: [QUE-07, QUE-08, QUE-09]

duration: 30min
completed: 2026-10-29
status: complete
---

# Phase 3 Plan 01: Queue Start Guard and Start Audit Summary

**Single-flight `_start` guard that ignores and audits a second Start while a step is in flight, plus a "Queue Started" log that lists the queue_ids and run_ids the Start will run, with retry-after-failure untouched.**

## Performance

- **Duration:** about 30 min of active work (interrupted once by a usage limit)
- **Tasks:** 2 (tracer plus one TDD task)
- **Files:** 4 changed (2 created, 2 modified), 478 insertions and 3 deletions under controller/

## Accomplishments

- QUE-07: `_start` returns early with a "Queue Start Ignored" warning whenever `_runningPromise` is set. Restart router, direct `_start()`, same-tick double start and the enqueueRun auto-start all dispatch the in-flight row exactly once; `restart` resolves to undefined (no toast or exception).
- QUE-08 (server half): every non-ignored Start logs an ordered, capped listing of the queued rows, read synchronously. The enqueueRun auto-start uses the "started automatically after a run was enqueued" prefix.
- QUE-09: retry-after-failure is unchanged. F5 recipe A shows a FAILED row re-runs first and a leftover plus a new row follow (row4, row4, row5, row6), with a single "Queue Started" listing all three in order with row4 marked FAILED.
- Protected suites (toolControl, sqliteQueue, queueRestart) are byte-identical to 5726822 and pass.

## Task Commits

1. **Task 1 (tracer): single-flight Start guard** - `7223e9a` (feat)
2. **Task 2 RED: failing listing tests** - `67996f0` (test)
3. **Task 2 GREEN: Queue Started listing** - `12fad3f` (feat)

Tracer verified end-to-end before expansion: queueStartGuard (4 tests), the protected regression suites (91 tests) and `tsc --noEmit` passed.

## Verification Results

- `npx vitest run test/queueStartGuard.test.ts`: 14 passed (plan minimum 12)
- `npx vitest run --exclude test/errorPath.test.ts`: 15 files, 258 tests passed
- `npx tsc --noEmit`: clean
- `git diff --stat 5726822 -- toolControl/sqliteQueue/queueRestart tests`: empty
- `git diff --numstat 5726822 -- SqliteQueue.ts`: 21 additions, 0 deletions
- Guard line (880) precedes `_failedAttempt = undefined` (889) in `_start`

## Deviations from Plan

None - plan executed exactly as written. The only adjustment was cosmetic: the recipe A tag-order assertion is written through a local `dispatched` variable so the literal `["row4", "row4", "row5", "row6"]` acceptance string appears on one line.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema; the new SQL is a read-only SELECT mirroring `getPaginated`.

## Issues Encountered

- The executor was interrupted once by a usage limit after Task 1 code and tests were written but before commit. Resumed from the working tree; no work was lost or redone.
- `test/errorPath.test.ts` (owned by 03-02) was excluded from the full run per the plan, since it is red until 03-04.

## Next Phase Readiness

Ready for the remaining Phase 3 plans. 03-03 can reuse the same counting rule (CREATED and FAILED count as "will run") for the client-side start summary.

## Self-Check: PASSED

- FOUND: controller/server/queueStartListing.ts, controller/test/queueStartGuard.test.ts, controller/server/command_queue.ts, controller/server/utils/SqliteQueue.ts
- FOUND commits: 7223e9a, 67996f0, 12fad3f (ancestors of HEAD)
