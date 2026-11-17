---
phase: 08-concurrency-lanes
plan: 02
subsystem: queue
tags: [lanes, scheduling, pure-functions, vitest, validation, typescript]

requires:
  - phase: 08-concurrency-lanes
    provides: "08-01 golden flag-off transcripts (fixture commit 98b50d6, untouched by this plan)"
provides:
  - "AdvancedParameters.lane and AdvancedParameters.laneBarrier (optional stored fields, D-01)"
  - "controller/server/laneScheduling.ts: import-free lane policy (normalisation, barrier eligibility, run-creation validation sentences, dead-wait drain, grouping, name-guarded LaneValidationError, snapshot types)"
affects: [08-03, 08-04, 08-05, 08-06, 08-07, 08-08, 08-09, 08-10, command-queue, run-creation, protocol-ui]

plan_head_before: e9d8369e5ee6cc510a1be63226636a2551c4ca1d
plan_head_after: e9e44346f01198886340f771ca335814b0575bbf

actuals:
  tokens: 8700
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Import-free shared policy module (like toolKey.ts and runControl.ts): usable from server and client, no timers, no db, no React"
    - "Every lane rule is a function of the ordered row list plus a small gate, table-tested in isolation"
    - "Error classified by Error.name, never class identity (copied from OperatorOnlyCommandError)"

key-files:
  created:
    - controller/server/laneScheduling.ts
    - controller/test/laneScheduling.test.ts
  modified:
    - controller/types/run.ts

key-decisions:
  - "isEligible blocks a row on every earlier same-run row that is on its own lane or sits before the row's last barrier; a barrier is its own last barrier so it waits for everything earlier (D-03, D-04)"
  - "A STARTED Tool Box row blocks dispatch on every lane, not only fast, since the gate is global (D-11)"
  - "validateLanes dead-wait rule is a simulateDrain assertion that cannot trip under barrier-only rules; its sentence is pinned as text"
  - "One-tool-two-lanes message is emitted once per (tool, extra lane) pair, naming the first-seen lane first and the conflicting step's own toolId"

patterns-established:
  - "Stub-first RED: export-complete stub module so RED fails on assertions, then implement (repeated per task)"

requirements-completed: [LAN-02, LAN-03, LAN-06, LUI-03]

duration: 20min
completed: 2026-11-16
status: complete
---

# Phase 8 Plan 02: Pure lane scheduling policy Summary

**Import-free `laneScheduling.ts` giving barrier-based lane eligibility, the seven UI-SPEC S2c run-creation refusal sentences, a dead-wait drain assertion, lane grouping and a name-guarded `LaneValidationError`, proven by 47 table tests whose first case is the FAST / goto-safe headline cycle.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-11-16
- **Tasks:** 2 (both TDD, RED then GREEN)
- **Files modified:** 3 (2 new, 1 edited)

## Accomplishments
- `AdvancedParameters` gains optional `lane` and `laneBarrier`; `skipExecutionVariable`, `runAsynchronously` and `RunStatus` are untouched.
- `isEligible` / `pickEligible` / `lanesWithWork` implement the barrier model: FAST waits for in1 and in2, then FAST and goto-safe are eligible together, out1 waits for both, out2 waits for out1. STARTED rows are never picked, one STARTED row per lane, busy tool keys block, halted / modal / STARTED Tool Box rows close the gate, and a controllable step waits while another controllable step runs.
- `laneOf` forces every Tool Box step and every invalid lane name to primary, so a smuggled tag can only make dispatch more sequential (T-08-03, T-08-04).
- `validateLanes` returns the seven S2c sentences in fixed rule order with 1-based step numbers; `simulateDrain` backs the dead-wait rule; `groupByLane`, `commandWords`, `hasLaneTags` serve later listing and UI plans.
- Full suite green (39 files, 1145 tests), `tsc --noEmit` clean, prettier clean, `staticScan` and `runOutcome` tests pass unedited; the 08-01 golden fixture is untouched.

## Task Commits

1. **Task 1 RED: failing eligibility tests and export stub** - `646aa82` (test)
2. **Task 1 GREEN: normalisation and barrier eligibility, run.ts fields** - `08b1b05` (feat)
3. **Task 2 RED: failing validation, drain, grouping, error tests** - `25db4d0` (test)
4. **Task 2 GREEN: validation, drain, grouping, error** - `e9e4434` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## TDD Gate Compliance

- **RED (Task 1):** 19 of 28 tests failed on assertions against the wrong-valued stub (for example `expected 'wait' to be 1`, `expected [ 'stub' ] to deeply equal [ 'fast' ]`); the 9 that passed were constants, STARTED-never-picked and the purity pin, which a conservative stub satisfies trivially. Semantic assessment: target behaviours (headline cycle, normalisation, eligibility) executed and failed on the planned assertions, no import or fixture faults.
- **RED (Task 2):** 19 of 47 failed, all new tests, on assertions against the stub (empty strings, `["stub"]`, `drained: false`); the 28 Task 1 tests stayed green. Same semantic assessment.
- The plan is `type: execute` (not `type: tdd`), so the `gsd_run check tdd-red-evidence` classifier was not required; RED output was inspected by hand.
- GREEN commits follow each RED commit; no REFACTOR commit was needed.

## Files Created/Modified
- `controller/server/laneScheduling.ts` - pure lane policy, zero imports, no timers
- `controller/test/laneScheduling.test.ts` - 47 tests: headline cycle (case 1), normalisation, eligibility table, gate cases, S2c sentences, drain, error guard, grouping, purity pin
- `controller/types/run.ts` - `lane?: string`, `laneBarrier?: boolean` on `AdvancedParameters`

## Decisions Made
See `key-decisions` above. One notable reading of the plan: the "no STARTED Tool Box row" gate condition is applied to every candidate row, not just fast-lane rows, which is equivalent in practice (the Tool Box row also occupies primary) and keeps the gate uniform.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rule-order test fixture counted only four lanes**
- **Found during:** Task 2 GREEN
- **Issue:** My own "returns messages in rule order" fixture mapped an invalid lane name to primary, so it never exceeded four lanes and the "at most 4" sentence was absent.
- **Fix:** Added a fifth lane (`e`) to the fixture.
- **Files modified:** controller/test/laneScheduling.test.ts
- **Verification:** 47 of 47 pass.
- **Committed in:** e9e4434

---

**Total deviations:** 1 auto-fixed (test-data bug in a test written in this plan)
**Impact on plan:** None; production code unchanged by the fix.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 08-03 and 08-04 can import `pickEligible`, `lanesWithWork`, `laneOf`, `toolKeyOf` and the snapshot types; 08-07 can import `validateLanes`, `LaneValidationError`, `isLaneValidationError`, `LANE_TAGS_IGNORED_WARNING`; 08-08 can import `groupByLane` and `commandWords`.
- The flagged edge probe items (LAN-02 / LAN-03 `unclassified`) remain for reviewer confirmation as noted in the plan.

## Known Stubs
None. (The RED stubs were replaced in the GREEN commits.)

## Threat Flags
None - no new endpoint, auth path or file access; the module is pure.

## Self-Check: PASSED

- FOUND: controller/server/laneScheduling.ts, controller/test/laneScheduling.test.ts, controller/types/run.ts
- FOUND commits 646aa82, 08b1b05, 25db4d0, e9e4434 (ancestors of HEAD)
- `grep -cE "^import" controller/server/laneScheduling.ts` is 0; `laneBarrier?: boolean` and `runAsynchronously?: boolean` each appear once in run.ts

---
*Phase: 08-concurrency-lanes*
*Completed: 2026-11-16*
