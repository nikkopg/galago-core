---
phase: 09-supervised-live-two-tool-proof
plan: 02
subsystem: testing
tags: [vitest, command-queue, lanes, static-scan, sqlite]

requires:
  - phase: 08-concurrency-lanes
    provides: CommandQueue lane mode, createLaneHarness, pickEligible, claimEligible, 08-REVIEW-DISPOSITION.md
provides:
  - D-09 gate test: exactly one tool send per queueId under lanes (overlap, run N+1, operator-Start retry after halt)
  - D-15 dispatch-span static pin with a region-text negative control
  - IN-01 recorded as skipped (accepted and pinned) in 08-REVIEW-DISPOSITION.md
affects: [09-03 .. 09-12 live run GO gates]

actuals:
  tokens: 1800
  tasks: 2
  commits: 2
plan_head_before: 65489a4f713f6ebf3ea75100979b98ded0b368dc
plan_head_after: ac9962ba15e04e85c2d08d26564a41e94a76abec

tech-stack:
  added: []
  patterns:
    - "Tally Tool.executeCommand calls per queueId via the lane harness; gate every live GO on it"
    - "Static pin with negative control that mutates the extracted region text, never the whole file"

key-files:
  created:
    - controller/test/laneOneSend.test.ts
  modified:
    - controller/test/staticScan.test.ts
    - .planning/phases/08-concurrency-lanes/08-REVIEW-DISPOSITION.md

key-decisions:
  - "IN-01 disposition value is skipped (accepted and pinned); deferred would wrongly suggest a later fix (RESEARCH A6, flagged for plan review)"
  - "Invariant tested: every queueId sent exactly once, except a FAILED row once more per accepted operator Start; a COMPLETED row is never re-sent"
  - "No production code changed; the IN-01 window is accepted and pinned, not restructured (D-15)"

requirements-completed: [LIV-01]

coverage:
  - id: D1
    description: "With lanes on, overlap run plus run N+1 sends every queueId exactly once, ends all COMPLETED and OFFLINE"
    requirement: LIV-01
    verification:
      - kind: unit
        ref: "controller/test/laneOneSend.test.ts#overlap run plus run N+1: every row is sent exactly once"
        status: pass
    human_judgment: false
  - id: D2
    description: "After a lane failure: nothing sent while halted, enqueue auto-start refused, operator Start re-sends only the FAILED row once, second Start ignored"
    requirement: LIV-01
    verification:
      - kind: unit
        ref: "controller/test/laneOneSend.test.ts#halt, refused auto-start, operator Start and a second Start: only the failed row is sent twice"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dispatch-span pin: no async boundary from the state check through claimEligible, five anchors in order, helpers synchronous, side-lane single await is _shouldSkip, negative control fails when an await is injected"
    requirement: LIV-01
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#dispatch span (D-15, IN-01)"
        status: pass
    human_judgment: false
  - id: D4
    description: "IN-01 recorded as skipped in front matter and table, open count 11 to 10"
    requirement: LIV-01
    verification:
      - kind: other
        ref: "grep -c '^| IN-01 | info | skipped | accepted in Phase 9 D-15' 08-REVIEW-DISPOSITION.md"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-17
status: complete
---

# Phase 9 Plan 02: D-09 One-Send Gate and D-15 Dispatch-Span Pin Summary

**A per-queueId send tally under lanes (overlap, run N+1, halt and operator-Start retry) plus a five-anchor dispatch-span pin with a region-text negative control, accepting IN-01 without touching production code.**

## Performance

- **Duration:** about 6 min
- **Started:** 2026-11-17T04:10Z (approx)
- **Completed:** 2026-11-17T04:17Z
- **Tasks:** 2
- **Files modified:** 3 (1 created)

## Accomplishments

- `controller/test/laneOneSend.test.ts`: describe "one send per queueId under lanes (D-09)" with two cases. Case 1: 9 calls, 9 distinct queueIds, each once, all rows COMPLETED, queue OFFLINE. Case 2: nothing sent while halted, enqueue auto-start refused, operator Start re-sends only the failed `t1` (2 sends), second Start ignored, 5 distinct queueIds, 6 calls.
- `controller/test/staticScan.test.ts`: nested describe "dispatch span (D-15, IN-01)" with four cases (span has no async boundary and keeps the anchor order; negative control injects an await at three places of the `_pickNext` text; `_dispatchGate`, `pickEligible`, `queuedRowsSync` are synchronous; `_runSideLane`'s only await between the pick and the send is `_shouldSkip`). The weaker pin at the existing "_pickNext has no await..." case is left in place.
- `08-REVIEW-DISPOSITION.md`: IN-01 skipped in front matter and table with the pin reference, `open: 10`.

## Task Commits

1. **Task 1: D-09 one tool send per queueId under lanes** - `8d96387` (test)
2. **Task 2: D-15 dispatch-span pin and IN-01 disposition** - `ac9962b` (test)

## Mutation Check (Task 1, never committed)

The plan's literal mutation (weaken `claimEligible`'s status check to also accept COMPLETED or STARTED) did NOT fail the test, and neither did the other variants tried. All were reverted with `git checkout -- controller/server`; `git diff --exit-code -- controller/server` is empty. Results, all against `laneOneSend.test.ts`:

| Mutation | Result |
|----------|--------|
| `claimEligible` status check also accepts COMPLETED/STARTED | 2 passed (masked) |
| `claimEligible` no longer sets status STARTED | 2 passed (masked) |
| `claimEligible` status check removed + `isEligible` status filter removed | 2 passed (masked) |
| above + per-lane STARTED exclusion in `isEligible` removed | 2 passed (masked) |
| `gate.halted` removed from `isEligible` | 2 passed (masked by the `state !== BUSY` check) |
| `state !== BUSY` removed from `_pickNext` | 2 passed (masked by the halted gate) |
| `_startLanes` second-Start single-flight guard (`busyLanes.length === lanes.length`) removed | 2 passed (masked) |
| **`_startLanes` enqueue-while-halted refusal removed** | **FAILED: case 2 "halt, refused auto-start, operator Start and a second Start: only the failed row is sent twice", `expected ... to have a length of 2 but got 4`** |

Why: the one-send guarantee is layered (serial per-lane loops, `pickEligible` status filter, per-lane STARTED exclusion, queue-membership join in `queuedRowsSync`, `claimEligible` status check), so weakening any single layer, including `claimEligible` alone, is invisible at the send boundary. The test is proven able to fail on a real send-after-halt regression (the enqueue auto-start refusal). The plan's acceptance wording ("which case failed with claimEligible weakened") cannot be satisfied literally; this is recorded as a deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan assumption] The claimEligible mutation cannot fail the D-09 test**
- **Found during:** Task 1 (mutation check)
- **Issue:** The plan states weakening `claimEligible`'s status check makes the test fail. Seven variants (table above) show it never does because other guards cover the same property.
- **Fix:** Ran additional mutations until one broke the one-send property observably; the removal of the `_startLanes` enqueue-while-halted refusal fails case 2. Production code restored; nothing committed.
- **Files modified:** none (mutation only)
- **Commit:** n/a

**Total deviations:** 1 (plan truth 3 satisfied with a different mutation target than named). **Impact:** none on shipped files; the D-09 test is proven able to fail, but its failure surface is the halt/Start path, not the claim check alone. A pure claim-guard regression is guarded by `sqliteQueueClaim.test.ts` (store level).

## Issues Encountered

None beyond the mutation finding above.

## Known Stubs

None.

## Threat Flags

None. Test-only changes; no new network, auth, file-access or schema surface.

## Verification

- `npx vitest run test/laneOneSend.test.ts`: 2 passed
- `npx vitest run test/staticScan.test.ts -t "dispatch span"`: 4 passed
- `npx vitest run test/staticScan.test.ts test/sqliteQueueClaim.test.ts`: 113 passed
- `npx vitest run`: 50 files, 1410 tests passed
- `npx tsc --noEmit`: 0 errors; `npx prettier --check` on both test files clean
- `git diff --exit-code -- controller/server`: clean (no production change)

## Next Phase Readiness

The D-09 and D-15 guards that gate every live GO exist and pass. Ready for 09-03 onward. The flagged assumption (skipped vs deferred for IN-01) remains open for review confirmation.

## Self-Check: PASSED

Files exist (laneOneSend.test.ts, staticScan.test.ts, 08-REVIEW-DISPOSITION.md); commits 8d96387 and ac9962b are on HEAD.
