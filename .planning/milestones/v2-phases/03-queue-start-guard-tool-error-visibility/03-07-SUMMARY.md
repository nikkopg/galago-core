---
phase: 03-queue-start-guard-tool-error-visibility
plan: 07
subsystem: ui
tags: [chakra, step-card, layout, static-scan, gap-closure, g-03-3]

requires:
  - phase: 03-queue-start-guard-tool-error-visibility
    provides: "03-06 step-card error Text (stepErrorText) stacked under CommandImage"
provides:
  - "Step card renders CommandImage and the stored error Text side by side in one HStack row above the unchanged sticky label"
  - "Static scan block pinning the row layout, card box, error Text style and label"
  - "03-UI-SPEC.md S3 / UA2 / backstop note amended for G-03-3"
affects: [verify-work UAT test 3 retest]

actuals:
  tokens: 3300
  tasks: 2
  commits: 3
plan_head_before: ddcdc031ec019b9f8c0fdcae8325f9140196450d
plan_head_after: 8bcbab9e731c4f2abb513f78a938bdfa28834c16

tech-stack:
  added: []
  patterns:
    - "Error text shares the image row so the row height (64/65px image block) absorbs the 63px clamped text"

key-files:
  created: []
  modified:
    - controller/components/runs/list/SwimLaneCommandComponent.tsx
    - controller/test/staticScan.test.ts
    - .planning/phases/03-queue-start-guard-tool-error-visibility/03-UI-SPEC.md

key-decisions:
  - "D-17 / UA2 placement amended: error text beside the image (still between image and label in DOM order) instead of stacked under it"
  - "CommandImage.tsx and the sticky label left untouched; the row reflow makes sticky inert again by removing the overflow"

requirements-completed: [ERR-03]

coverage:
  - id: D1
    description: "FAILED / skipped-after-failure step card error text sits beside the command image in one row; layout pinned by a static scan"
    requirement: ERR-03
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#step card error fits the fixed card (G-03-3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rendered card fits the fixed 165px card (scrollHeight <= clientHeight) at 250px and 300px for Tool Box and Image branches, and the label never covers the text"
    requirement: ERR-03
    verification: []
    human_judgment: true
    rationale: "Rendered layout and clamping; the project has no jsdom/RTL (UI-08), so fit is checked on the live page via the UAT test 3 retest"

duration: 20min
completed: 2026-10-29
status: complete
---

# Phase 3 Plan 07: Step-card error row fix (G-03-3) Summary

**Step-card error text moved into the CommandImage row (image left in a non-shrinking Box, clamped text right with flex 1 / minW 0) so the fixed 165px card no longer overflows and the sticky label stops covering the error.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-10-29T04:06:00Z
- **Completed:** 2026-10-29T04:26:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Root cause (card content 218px in a 151px box, sticky label painting over the text) removed: the row height is the 64/65px image block, which absorbs the 63px 3-line text, so content stays at 147-148px.
- Cards with no error look as before (row is `justifyContent="center"`).
- New static scan block `step card error fits the fixed card (G-03-3)` fails if the error is stacked under the image again or the row loses `flexShrink={0}` / `minW={0}`; the existing ERR-03/04/05 scans pass unedited.
- 03-UI-SPEC.md S3 placement, UA2 and the S3 overflow backstop note amended (3 G-03-3 references).

## Task Commits

1. **Task 1 (tracer, TDD): error text beside the image**
   - RED: `d8ecac5` (test) - both new cases failed on the old layout (HStack closed before `title={errorText}`; no `flex="1"`/`minW={0}`)
   - GREEN: `bf692ba` (fix)
2. **Task 2: S3 contract amendment + phase gate** - `8bcbab9` (docs)

**Plan metadata:** committed separately (docs: complete plan)

## Files Created/Modified
- `controller/components/runs/list/SwimLaneCommandComponent.tsx` - image + error Text in one HStack row; D-17 comment rewritten
- `controller/test/staticScan.test.ts` - new describe block (43 added lines, 0 deleted vs e25f0a4)
- `.planning/phases/03-queue-start-guard-tool-error-visibility/03-UI-SPEC.md` - S3 placement, UA2, backstop note

## Decisions Made
- Placement amended per G-03-3 (see key-decisions). CommandImage.tsx (shared with ProtocolDetailView) not edited; verified no diff from e25f0a4.

## Phase gate results
- `npm run test:unit`: 20 test files, 436 tests (434 baseline + 2 new), all passing
- `npx tsc --noEmit`: clean
- QUE-09 diff gate vs 5726822 (toolControl, sqliteQueue, queueRestart tests): no diff
- CommandImage.tsx: no diff vs e25f0a4; staticScan.test.ts: 0 deleted lines vs e25f0a4
- Acceptance greps in SwimLaneCommandComponent.tsx: flexShrink={0} 1, minW={0} 1, justifyContent="center" 1, height="165px" 1, sticky Box 1, `<CommandImage` 1, `<CheckCircle` 1, noOfLines={3} 1, title={errorText} 1, errorText decl 1
- errorPath.test.ts history gate: see Deviations (not strictly satisfied, pre-existing)
- No STACK or F.A.S.T. tool started, connected or commanded; no package installed

## Deviations from Plan

**1. [Pre-existing, not caused by this plan] errorPath.test.ts history gate**
- **Found during:** Task 2 phase gate
- **Issue:** The gate expects every commit touching `controller/test/errorPath.test.ts` to start with `test(03-02):`. Commit `5191ffe` (`fix(03): stop failure alerts holding the queue...`, the WR-01/WR-02 review fix, before 03-06 retest/03-07 planning) added 16 lines to it. 03-06's summary recorded the gate as passing because that commit landed afterwards.
- **Fix:** None; out of scope (not touched by 03-07 and the file's tests pass). Recorded for the verifier; the intent of the gate (the failing-first test was not weakened) holds since the later change is purely additive (16 insertions, 0 deletions).
- **Files modified:** none

**Total deviations:** 0 auto-fixed, 1 pre-existing gate discrepancy noted.
**Impact on plan:** None on the fix.

## Issues Encountered
None. The project prettier config does not load (pre-existing, per 03-06); the new test file lines were formatted by hand.

## Open human check (for /gsd-verify-work)
UAT test 3 retest (G-03-3), live page after `docker compose up -d --build galago-web`: use Tool Box (software-only) steps, plus an Image-branch step only if a non-Tool-Box tool with a confirmed-stopped server exists (otherwise report not checked). Run the DevTools query from the plan on cards at 300px (1-2 steps) and 250px (4+ steps) with 1-line and 3+-line errors, FAILED and skipped-after-failure. Expected: scrollHeight <= clientHeight everywhere, error right of image (max 3 lines, full text in tooltip), label below the row, no-error cards unchanged. Never run STACK or F.A.S.T. steps. This was NOT performed by the executor (no browser or docker rebuild run).

## Known Stubs
None.

## Threat Flags
None. T-03-22 and T-03-23 mitigations (break-word, minW 0, flexShrink 0, noOfLines 3, title) are in place and pinned by the new scan; tool text remains a React child (no dangerouslySetInnerHTML).

## Next Phase Readiness
Code and contract complete; pending the UAT test 3 retest to close G-03-3.

---
*Phase: 03-queue-start-guard-tool-error-visibility*
*Completed: 2026-10-29*

## Self-Check: PASSED
