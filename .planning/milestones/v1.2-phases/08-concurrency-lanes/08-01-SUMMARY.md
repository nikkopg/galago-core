---
phase: 08-concurrency-lanes
plan: 01
subsystem: testing
tags: [vitest, golden-transcript, command-queue, fake-timers, lanes]

requires:
  - phase: 07-fast-tool
    provides: "installFakeTool helper, CommandQueue single-flight Start guard (QUE-07), queueStartGuard idiom"
provides:
  - "Golden transcripts S0-S3 of the flag-off CommandQueue, captured before any Phase 8 production edit"
  - "runScenario harness (Transcript shape, GOLDEN_WRITE capture switch) for 08-04 to parameterise over the three post-change constructions"
affects: [08-04, 08-10, lanes, command-queue]

plan_head_before: 0c1e06e5458b790be068c78341bbcb2302c77f28
plan_head_after: 2da2ad742bf6f16b49afe58a7c5618e187687898

actuals:
  tokens: 5300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Golden transcript: record logAction entries, state transitions, Tool.executeCommand dispatches, FakeGrpc payloads, mid-step snapshot, final rows and error, then toStrictEqual against a committed fixture"
    - "Deterministic queue tests: fake setTimeout/clearTimeout/setInterval/clearInterval/Date at 2026-01-01T00:00:00.000Z, in-memory SQLite, fixed getStatus reply, 100 ms advance-until helper"

key-files:
  created:
    - controller/test/lanesFlagOff.test.ts
    - controller/test/fixtures/lanesFlagOff.golden.ts
  modified: []

key-decisions:
  - "Fixture GOLDEN_CAPTURE_SHA stays 0c1e06e: the S2/S3 re-capture ran at 98b50d6, a tests-only commit on top of 0c1e06e, so production code is byte-identical at both"
  - "The fake timer set also includes clearTimeout and clearInterval, so a faked interval is actually cleared when RunStateMonitor stops"

patterns-established:
  - "GOLDEN_WRITE=1 is the only way the fixture is written, and only at the pre-change commit"

requirements-completed: [LAN-01]

duration: 25min
completed: 2026-11-16
status: complete
---

# Phase 8 Plan 01: Golden flag-off queue transcript Summary

**Four deterministic golden transcripts (empty queue, mixed Tool Box + tool run, failure then retry, Pause-queue ignored Start) of today's CommandQueue, captured at the unmodified production commit through fake tools so LAN-01 flag-off byte-identity can be proven after the lane engine lands.**

## Performance

- **Duration:** 25 min
- **Completed:** 2026-11-16T13:20:22Z
- **Tasks:** 2
- **Files modified:** 2 (both new, test-only)

## Accomplishments
- `runScenario` harness drives the real `CommandQueue._start` through `installFakeTool` fakes under fake timers and returns a Transcript (actions, states, dispatched, grpcSends, midStep, rows, error).
- S0 (Start on an empty queue), S1 (note, stack, pause then resume, fast held mid-step, show_message then resume, stack), S2 (INVALID_ARGUMENTS failure, clearError, operator Start retries), S3 (Pause queue mid-step, one "Queue Start Ignored", Start after the step ends) are captured in `controller/test/fixtures/lanesFlagOff.golden.ts` with the capture SHA in its header.
- The test is green 5 runs in a row without GOLDEN_WRITE, and each scenario also passes in isolation (`-t S1`, `-t S3`), so there is no cross-scenario ordering dependence.
- No production file was touched; no test can move an instrument (all tools are fakes, `@/db/client` throws).

## Task Commits

1. **Task 1: Golden harness and S0 / S1 captures** - `98b50d6` (test)
2. **Task 2: S2 and S3 captures, determinism proof** - `2da2ad7` (test)

**Plan metadata:** committed separately (docs: complete plan)

**Fixture adding commit (later plans assert the fixture never changes after it):** `98b50d6`

## Files Created/Modified
- `controller/test/lanesFlagOff.test.ts` - harness, GOLDEN_WRITE capture switch and per-scenario deep-equal assertion
- `controller/test/fixtures/lanesFlagOff.golden.ts` - `GOLDEN_CAPTURE_SHA`, `GOLDEN_TRANSCRIPTS` (S0-S3)

## Decisions Made
- Kept `GOLDEN_CAPTURE_SHA` at `0c1e06e` rather than the re-capture HEAD `98b50d6`: the only commit between them adds test files, so the production tree is identical.
- Faked clearTimeout and clearInterval as well as the plan's setTimeout, setInterval and Date, so RunStateMonitor's faked interval is really cleared on stop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Placeholder fixture and type-predicate fix**
- **Found during:** Task 1
- **Issue:** The test statically imports the fixture, which does not exist before the first GOLDEN_WRITE run; a first `tsc` also flagged an invalid type predicate on the `logger.info` call filter.
- **Fix:** Created a one-line placeholder fixture before the first capture (overwritten by the capture, so it never influences the recorded data); rewrote the filter as a single guarded predicate.
- **Files modified:** controller/test/lanesFlagOff.test.ts, controller/test/fixtures/lanesFlagOff.golden.ts
- **Committed in:** 98b50d6

**2. [Process] Task 1 committed with S0/S1 only**
- Scenarios S2 and S3 were developed together with S0/S1, then temporarily removed so Task 1 could be committed on its own; Task 2 restored them. The S0/S1 data did not change between the two captures.

---

**Total deviations:** 1 auto-fixed (1 blocking) plus one process note
**Impact on plan:** None on scope; fixture content is exactly the four planned scenarios.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 08-02 (pure lane scheduling) and later plans can proceed; 08-04 parameterises this test over the three post-change constructions and asserts `git diff --exit-code` of the fixture against `98b50d6`.
- Full suite (`npx vitest run`: 1098 tests), `tsc --noEmit` and prettier all green at plan end.

## Known Stubs
None.

## Self-Check: PASSED

- FOUND: controller/test/lanesFlagOff.test.ts
- FOUND: controller/test/fixtures/lanesFlagOff.golden.ts
- FOUND commits 98b50d6 and 2da2ad7 (ancestors of HEAD); neither touches controller/server, components, types, pages or hooks
- GOLDEN_TRANSCRIPTS keys are exactly S0, S1, S2, S3; S3 holds exactly one "Queue Start Ignored"; S2 has "Command Failed" before the second "Queue Started"

---
*Phase: 08-concurrency-lanes*
*Completed: 2026-11-16*
