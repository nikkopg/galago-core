---
phase: 08-concurrency-lanes
plan: 03
subsystem: queue
tags: [lanes, sqlite, run-state, claim, poller, vitest, typescript]

requires:
  - phase: 08-concurrency-lanes
    provides: "08-01 golden flag-off transcripts (fixture commit 98b50d6, untouched by this plan)"
provides:
  - "SqliteQueue.claimEligible(queueId): synchronous, transactional, STARTED-excluding claim of one queued row (D-10)"
  - "RunStateMonitor.stopIf(queueId): stops the run-state poller only for the exact running queueId (D-11)"
affects: [08-04, 08-06, command-queue, lanes]

plan_head_before: 1952d395cc7a2ccf210a0818aa64067d41ee63a4
plan_head_after: cca2f570f76586f3b41d9f4711831fdc4675ec5a

actuals:
  tokens: 3000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Additive-only seams: startNext, start(), stop() and queuedRowsSync are byte-unchanged"
    - "Non-async signature so the no-await guarantee is visible in the method declaration (RESEARCH Pattern 2)"

key-files:
  created:
    - controller/test/sqliteQueueClaim.test.ts
    - controller/test/runStateStopIf.test.ts
  modified:
    - controller/server/utils/SqliteQueue.ts
    - controller/server/runState.ts

key-decisions:
  - "claimEligible re-checks queue membership and status inside one better-sqlite3 transaction and refuses anything but CREATED or FAILED, so a STARTED, removed or unknown row can never become a second dispatch (T-08-06)"
  - "stopIf delegates to the unchanged stop() only when the envelope is running for exactly that queueId; a stack step never creates a running envelope so its stopIf is a no-op (T-08-07)"

patterns-established:
  - "Stub-first RED: export-complete stub so RED fails on assertions, then implement"

requirements-completed: []

duration: 8min
completed: 2026-11-16
status: complete
---

# Phase 8 Plan 03: claimEligible and stopIf seams Summary

**Two additive seams for the lane engine: `SqliteQueue.claimEligible` (synchronous, one-transaction claim that never re-claims a STARTED row) and `RunStateMonitor.stopIf` (queueId-scoped poller stop so another lane cannot stop the F.A.S.T. poller), each proven by new test files.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-11-16
- **Tasks:** 2 (both TDD, RED then GREEN)
- **Files modified:** 4 (2 new tests, 2 production files edited additively)

## Accomplishments
- `claimEligible(queueId)` is declared without `async`; inside one transaction it returns false if the row left `<q>_queue`, is unknown, or is not CREATED/FAILED, otherwise marks it STARTED and returns the stored row. FAILED rows are claimable (operator retry path).
- `stopIf(queueId)` stops only when the running envelope's queueId matches; a non-matching id keeps the envelope and the 2 s interval polling.
- `startNext`, `queuedRowsSync`, `start`, `stop`, `snapshot` and `_poll` are untouched; `git diff --numstat` against the golden fixture commit shows 27 and 8 added lines, 0 deleted.
- Full suite green (41 files, 1162 tests), `tsc --noEmit` clean, prettier clean; `sqliteQueue.test.ts`, `queueStartGuard.test.ts` and `runState.test.ts` pass unedited.

## Task Commits

1. **Task 1 RED: failing claimEligible tests and stub** - `5bc08df` (test)
2. **Task 1 GREEN: claimEligible** - `53f7008` (feat)
3. **Task 2 RED: failing stopIf tests and stub** - `108ea46` (test)
4. **Task 2 GREEN: stopIf** - `cca2f57` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## TDD Gate Compliance

- **RED (Task 1):** 4 of 10 tests failed on `expected false not to be false` (the claim assertions) against a stub returning false; the 6 refusal / pin tests pass trivially against a conservative stub. Semantic assessment: target assertions executed and failed on the planned behaviour, no import or fixture faults.
- **RED (Task 2):** 1 of 7 failed (`expected { running: true, queueId: 5 ... } to deeply equal { running: false }`) against a no-op stub; the non-matching, idle and stack cases pass trivially. Same assessment.
- The plan is `type: execute`, so the `tdd-red-evidence` classifier was not required; RED output was inspected by hand.
- GREEN commits follow each RED commit; no REFACTOR commit was needed.

## Files Created/Modified
- `controller/server/utils/SqliteQueue.ts` - added `claimEligible`
- `controller/server/runState.ts` - added `stopIf`
- `controller/test/sqliteQueueClaim.test.ts` - CREATED, FAILED retry, STARTED (claim and startNext) refused, completed/skipped refused, unknown id, only-named-row, not-a-Promise, source-text non-async pin
- `controller/test/runStateStopIf.test.ts` - matching, non-matching, never-started, already-stopped, stack-step, cross-lane and start-replacement cases with fake timers

## Decisions Made
See `key-decisions` above. `requirements-completed` is left empty on purpose: LAN-04 (per-lane single-flight Start guard) and LAN-07 (pause/resume/abort reach the lane's F.A.S.T.) are only building blocks here; the guard lands in 08-04 and the brackets wiring in 08-06, so both stay pending in REQUIREMENTS.md.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 08-04 `_pickNext` can call `claimEligible` in the same synchronous turn as `pickEligible`; 08-06 can use `stopIf` in the lane-mode step brackets.

## Known Stubs
None. (The RED stubs were replaced in the GREEN commits.)

## Threat Flags
None - no new endpoint, auth path or file access.

## Self-Check: PASSED

- FOUND: controller/test/sqliteQueueClaim.test.ts, controller/test/runStateStopIf.test.ts, claimEligible and stopIf in the production files
- FOUND commits 5bc08df, 53f7008, 108ea46, cca2f57 (ancestors of HEAD)
- `grep -cE "^  claimEligible\(queueId: number\)"` is 1; `grep -c "stopIf(queueId: number)"` is 1

---
*Phase: 08-concurrency-lanes*
*Completed: 2026-11-16*
