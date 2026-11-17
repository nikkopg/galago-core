---
phase: 08-concurrency-lanes
plan: 08
subsystem: ui
tags: [lanes, pure-helpers, vitest, run-outcome, ui-copy, typescript]

requires:
  - phase: 08-concurrency-lanes
    provides: "08-02 laneScheduling.ts (laneOf, isBarrier, groupByLane, commandWords, validateLanes, snapshot types)"
provides:
  - "groupRowsByLane, lane-aware deriveRunOutcome and getRunAttributes completedAt (LUI-05 pure half)"
  - "laneStatus.ts: UI-SPEC S4/S5/S6 copy and view helpers for the Lanes panel, failure list and lane-row captions"
  - "queuedStartLines per-lane Start lines and the Lanes (first appearance) suffix on the Queue Started audit line (LUI-04 pure half)"
  - "laneFields.ts: drawer and preview helpers (setLane, setBarrier, suggestLanes, laneFlag, buildLaneSummary) (LUI-01 pure half)"
affects: [08-09, 08-10, run-page, protocol-editor]

plan_head_before: c5fcf010d41af533bbdfb4ef1185de3995f295a3
plan_head_after: e557900ac83c137430495c1ec06fb468dd030959

actuals:
  tokens: 14500
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Pure React-free helper modules importing only the import-free laneScheduling.ts; the JSX plans only wire them up"
    - "Lane branch taken only when some row has a non-primary lane, so the untagged path stays textually untouched"
    - "Stub-first RED: export-complete stubs so RED fails on assertions, then GREEN"

key-files:
  created:
    - controller/components/runs/laneStatus.ts
    - controller/components/protocols/laneFields.ts
    - controller/test/laneUi.test.ts
  modified:
    - controller/components/runs/utils.ts
    - controller/components/runs/runOutcome.ts
    - controller/components/runs/queuedStartSummary.ts
    - controller/server/queueStartListing.ts

key-decisions:
  - "deriveRunOutcome has a separate lane branch (FAILED, skipped-failure, all COMPLETED/SKIPPED, STARTED, QUEUED, CREATED) taken only when some row's laneOf is non-primary; the legacy path is unedited"
  - "getRunAttributes uses the latest completedAt over COMPLETED rows only for lane runs; untagged runs keep the last-row path"
  - "describeLaneFailures does not re-cap entries; the server caps and reports overflow, the helper counts entries plus overflow"
  - "Start-listing position is the row's 1-based index among the input rows of its own run (STARTED rows count toward position but are not listed)"
  - "suggestLanes returns primary plus at most four other lanes (the UI-SPEC engine row), not four in total"
  - "buildLaneSummary returns { groups: [], warnings } rather than null when a bad tag leaves every step on primary but validateLanes still has a refusal"

patterns-established:
  - "setLane/setBarrier delete keys (never write blank, undefined or false) and return a new object"

requirements-completed: []

duration: 22min
completed: 2026-11-16
status: complete
---

# Phase 8 Plan 08: Pure lane UI helpers Summary

**React-free helpers for lane row grouping, a lane-aware run outcome (a COMPLETED last row no longer means done), the Lanes panel and failure-list copy, per-lane Start lines with a Lanes listing on the audit line, and the drawer/preview helpers, all proven by 66 table tests with untagged output byte-identical.**

## Performance

- **Duration:** ~22 min
- **Completed:** 2026-11-16
- **Tasks:** 3 (all TDD, RED then GREEN)
- **Files:** 7 (3 new, 4 edited)

## Accomplishments
- `groupRowsByLane` returns null for empty or untagged rows and otherwise one group per lane in first-appearance order (Tool Box rows under primary).
- `deriveRunOutcome` fixes L-6 / Pitfall 23 for lane runs: `[COMPLETED, STARTED(fast), COMPLETED]` is `STARTED`, `[COMPLETED, CREATED(fast), COMPLETED]` is `CREATED`; FAILED takes precedence and the skipped-failure rule is unchanged. `getRunAttributes` takes the latest `completedAt` over COMPLETED rows for lane runs (P-6). No new badge, colour or copy; `RunStatus` not widened; `runOutcome.ts` still React-free and free of "green".
- `laneStatus.ts` holds the UI-SPEC S5 halt sentences, freeze-disabled reasons, `shouldShowLanesPanel`, running-lane chips, Freeze confirm/toast/failed copy, `describeLaneFailures` (null under two failures, first entry marked and not repeated, overflow line singular/plural), `laneCardCaption` and `laneDoneText`.
- `queuedStartLines` appends the "Steps by lane" block (headline queue gives primary 1,2,4,5,6 and fast 3 with barrier suffixes) before the note, plus the freeze line only when `laneFrozen`; `describeQueueStart` appends `. Lanes (first appearance): primary=1,2,4,5*,6; fast=3* (* waits for all earlier steps)` over the listed rows.
- `laneFields.ts`: `setLane`/`setBarrier` delete keys and never mutate, `suggestLanes`/`laneHelperText`, `laneFlag` (four S1 flags, first match, never blocking), `buildLaneSummary` (visual and script styles), `laneWarningText`.
- Full suite green (43 files, 1262 tests), `tsc --noEmit` clean, prettier clean; `runOutcome`, `queuedStartSummary`, `queueStartGuard` and `staticScan` tests pass unedited; the 08-01 golden fixture was not touched.

## Task Commits

1. **Task 1 RED:** failing lane row, outcome and run-page copy cases - `a4fd40d` (test)
2. **Task 1 GREEN:** grouping, lane-aware outcome, laneStatus copy - `c2f8557` (feat)
3. **Task 2 RED:** failing per-lane Start line and audit listing cases - `8c89739` (test)
4. **Task 2 GREEN:** per-lane Start lines and audit lane listing - `c30c91e` (feat)
5. **Task 3 RED:** failing drawer and preview helper cases - `fdd4a98` (test)
6. **Task 3 GREEN:** pure drawer and preview lane helpers - `e557900` (feat)

**Plan metadata:** committed separately (docs: complete plan)

## TDD Gate Compliance

- **Task 1 RED:** 18 of 27 failed on assertions (stub values, and today's `deriveRunOutcome`/`getRunAttributes` returning the old results for lane rows); the 9 that passed were untagged regressions, null cases and the purity pin. No import or fixture faults.
- **Task 2 RED:** 8 of 39 failed on assertions (missing lane lines, missing audit suffix); untagged and existing cases stayed green.
- **Task 3 RED:** 25 of 66 failed on assertions against the wrong-valued stub.
- The plan is `type: execute`, so `check tdd-red-evidence` was not required; RED output was inspected by hand. GREEN follows each RED; no REFACTOR commit needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] buildLaneSummary hides no refusal**
- **Found during:** Task 3
- **Issue:** The plan says `buildLaneSummary` returns null when untagged. An invalid lane name (for example "Bad Name") makes `laneOf` return primary, so `groupByLane` is null and the preview would show nothing even though run creation will refuse the protocol.
- **Fix:** Return `null` only when there are no groups and no `validateLanes` warnings; otherwise return `{ groups: [], warnings }`. A genuinely untagged protocol still gives null. 08-10 must render the warnings Alert even when `groups` is empty.
- **Files modified:** controller/components/protocols/laneFields.ts, controller/test/laneUi.test.ts
- **Commit:** e557900

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** None on the specified cases; one extra edge pinned by a test.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- 08-09 can wire `groupRowsByLane`, `laneCardCaption`, `laneDoneText`, `describeLaneFailures`, the halt/freeze copy and `queuedStartLines({ laneFrozen })` (the modal rows already carry `queueId` and `commandInfo`).
- 08-10 can wire `setLane`/`setBarrier`/`suggestLanes`/`laneFlag`/`buildLaneSummary`/`laneWarningText`; note the empty-groups-with-warnings case above.
- LUI-01, LUI-04, LUI-05 and LUI-06 are only the pure halves here, so they stay pending in REQUIREMENTS.md until 08-09 / 08-10 deliver the UI.

## Known Stubs
None. (The RED stubs were replaced in the GREEN commits.)

## Threat Flags
None. The helpers are pure, return plain strings only (T-08-26), delete keys rather than writing blank or false (T-08-27), and name every queued step per lane with no cap (T-08-28).

## Self-Check: PASSED

- FOUND: laneStatus.ts, laneFields.ts, laneUi.test.ts, utils.ts, runOutcome.ts, queuedStartSummary.ts, queueStartListing.ts
- FOUND commits a4fd40d, c2f8557, 8c89739, c30c91e, fdd4a98, e557900 (ancestors of HEAD); `git rev-list --count` over the plan range is 6
- Acceptance greps all 1: `export function groupRowsByLane`, `Failures by lane`, `Keep lanes running`, `Steps by lane (lane order is the order they first appear):`, `Lanes (first appearance)`, `Lanes take effect only when parallel lanes are enabled on the server.`, `export function setLane`, `export function buildLaneSummary`

---
*Phase: 08-concurrency-lanes*
*Completed: 2026-11-16*
