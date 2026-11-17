---
phase: 07-f-a-s-t-plate-dropdowns
plan: 02
subsystem: controller-ui
tags: [fast, well-picker, geometry, pure-logic, vitest, tdd]
requires: []
provides:
  - wellGeometry.ts React-free well-picker core (row codec, geometry, arithmetic hit-test, patch producers, value classification, plate side, status line, force-open, view model)
  - fastPlates.ts fixtures (golden entry, 96/384/1536, no-size and duplicate cases, platesWithCount)
affects: [07-04, 07-06, 07-07, 07-08]
tech-stack:
  added: []
  patterns:
    - "React-free decision module: every WellPicker decision is a pure function over values and a plate list; the component only forwards numbers"
    - "View model, never a patch: buildWellPickerView returns a view; only drag, click, typed edit and Clear selection produce patches"
key-files:
  created:
    - controller/components/tools/wellGeometry.ts
    - controller/test/wellGeometry.test.ts
    - controller/test/fixtures/fastPlates.ts
  modified: []
key-decisions:
  - "A legacy or untouched number 0 in the six well fields is blank (not flagged); the string '0' is non-blank and flagged (RESEARCH Open Question 1)"
  - "sizeMismatch compares the (rows, cols) pair, so 8x12 vs 12x8 is a mismatch (refines D-15, matches fast-mcp authoring.py:66-67)"
  - "A variable well field classifies as 'variable' (no block, nothing selected for it); with variables disallowed it is a flag"
  - "A plate value of 0 is an unreported id (not-reported), not blank; usable size means integer rowCount and colCount of at least 1"
requirements-completed: [PLT-08, PLT-09]
duration: 20 min
completed: 2026-11-12
status: complete
commits: 4
plan_head_before: 57055366be32202161042ee14f4c1cfd45e395e7
plan_head_after: bc069d142304aa27534d8d3fbc57e641e474c0f1
actuals:
  tokens: 13900
  tasks: 2
  commits: 4
coverage:
  - deliverable: "Row-label codec, drag rectangle, fit, size mismatch pair compare, well size and metrics, arithmetic hit-test, and patch producers (sourcePatch, destPatch, CLEAR_PATCH, wellFieldPatch)"
    verification:
      - kind: test
        ref: "controller/test/wellGeometry.test.ts#rowLabel / parseRowLabel / dragRect / fitsAt / sizeMismatch / cellFromPoint / patch producers"
        status: pass
    human_judgment: false
  - deliverable: "Value classification and flags (legacy 0 blank, misfit kept as saved), per-side plate grid with hidden causes and duplicate handling, status line, force-open rule, composed view model and destination click acceptance"
    verification:
      - kind: test
        ref: "controller/test/wellGeometry.test.ts#classifyWellValue / plateGridSide / statusLine / forceOpen / buildWellPickerView / destClickPatch"
        status: pass
    human_judgment: false
---

# Phase 7 Plan 02: Well-Picker Geometry Core Summary

React-free, DOM-free `wellGeometry.ts` holds every decision the WellPicker will make (A..Z/AA.. row codec, arithmetic hit-test, fit and (rows, cols) pair size mismatch, blank/flag value classification, per-side plate resolution, seven-row status line, force-open rule and one composed view model), pinned by 136 Vitest cases against fixture plates.

Start 2026-11-12 (about 20 min), 2 tasks, 3 files (all new), 4 commits.

## Accomplishments

- **Task 1:** `WELL_FIELDS` (mockup order), `rowLabel`/`parseRowLabel` (strict 1-2 ASCII letters, no trim), `isBlankWell` (legacy 0 blank), `dragRect`, `fitsAt`, `sizeMismatch`/`mismatchText` (exact UI-SPEC warning, literal "(-9006)"), `wellSizePx`/`gridMetrics`, `cellFromPoint` (arithmetic over bounding box and stride, clamp option), `sourcePatch`/`destPatch`/frozen `CLEAR_PATCH`, `wellFieldText`/`wellFieldPatch` (typed rows verbatim; digit-only text becomes a number, anything else kept verbatim to be flagged).
- **Task 2:** `classifyWellValue` with the five UI-SPEC flag texts, `sourceBlock`/`destOrigin`/`fieldFlags`, `plateLabel`, `plateGridSide` (no-plate, variable, loading, unavailable, not-reported, no-size, duplicate-sizes, agreeing duplicates use the first entry's label), `statusLine` (first match of seven rows), `forceOpen` (grid, variable, attention notes in that order; loading never forces), `buildWellPickerView` and `destClickPatch`, plus the 15 copy constants.
- Fixture file `fastPlates.ts` marks only the id 1 "Default 96-Well Conical" entry as golden (fast-mcp characterization test); all other entries are labelled invented fixtures.
- Prohibitions upheld and tested: no helper clips, shifts, re-anchors or clears a saved value; a plate change produces no patch (the view API has no patch output); a size mismatch only replaces the footprint with the warning and never blocks saving.

## Task Commits

| Task | Commit | Type | Description |
| ---- | ------ | ---- | ----------- |
| 1 RED | 3777600 | test | failing tests for codec, geometry, hit-test, patch producers (throwing skeleton + fixtures) |
| 1 GREEN | 6719bac | feat | implement codec, geometry, hit-test and patch producers |
| 2 RED | 7a65dc2 | test | failing tests for flags, plate side, status line, force-open, view model |
| 2 GREEN | bc069d1 | feat | implement flags, plate side, status line, force-open, view model |

## TDD Gate Compliance

- **RED (Task 1)** `3777600` `test(07-02)`: 66 tests, all failed. Failures were `Error: not implemented` thrown from the exported skeleton functions while the target tests executed (the skeleton exists so the failure is on execution, not on import/load, which would be INVALID_RED). Semantic assessment: target tests ran and failed because the planned behaviour was absent, not a syntax, import or fixture fault. Machine classification via `gsd_run check tdd-red-evidence` was not run (Vitest default reporter output, not TAP); assessment is manual.
- **GREEN (Task 1)** `6719bac`: 66/66 pass, `tsc --noEmit` clean, prettier clean.
- **RED (Task 2)** `7a65dc2`: 70 new tests failed (66 earlier tests still passing); 69 via `not implemented` from the skeleton and the copy-constants test on an assertion (`expected '' to be 'Source plate'`). Same manual semantic assessment. Initial RED run threw at describe time (module-level `sideOf` calls); fixed by making those lazy before committing, so the suite loaded and every target test executed.
- **GREEN (Task 2)** `bc069d1`: 136/136 in the file, full controller suite 916/916 (35 files), `tsc --noEmit` clean, prettier clean on all three files.
- **REFACTOR:** none needed.

## Deviations from Plan

None - plan executed exactly as written.

Notes (not deviations): the RED commits carry an export-only throwing skeleton of `wellGeometry.ts` (the plan says write tests first and run red; a skeleton makes the failure a real assertion/execution failure rather than a module-not-found). `git status` showed pre-existing `.planning/state.json`, `.dockerignore`, `.graphifyignore`, `.opencode/` changes; none were staged.

## Known Stubs

None. This plan is pure logic: no operator-visible change lands until 07-04 renders it and 07-07 mounts it (as recorded in the plan's flagged assumptions).

## Flagged assumptions carried forward

- D-15 refinement: pair compare of (rows, cols), not total well count, awaiting user confirmation (recorded in the plan).
- A string "0" is flagged ("Column '0' is not a whole number from 1"); only the number 0 is the legacy blank.
- Plate fixtures other than id 1 are invented.

## Threat Flags

None. No new endpoints, auth paths or schema changes; no packages installed (T-07-SC).

## Next

Ready for 07-03 (modal and drawer hosts) and 07-04 (WellPicker rendering over this view model).

## Self-Check: PASSED

- FOUND: controller/components/tools/wellGeometry.ts, controller/test/wellGeometry.test.ts, controller/test/fixtures/fastPlates.ts
- FOUND commits: 3777600, 6719bac, 7a65dc2, bc069d1 (RED precedes GREEN for both tasks)
- Acceptance greps: no `from "react"`, no `chakra-ui`, no `elementFromPoint` in wellGeometry.ts; "Default 96-Well Conical" in fixtures; required copy strings present; only import is `isVariableLike`.
- `vitest run test/wellGeometry.test.ts` 136/136; `tsc --noEmit` exits 0; prettier reports all three files formatted.
