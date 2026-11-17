---
phase: 07-f-a-s-t-plate-dropdowns
plan: 03
subsystem: controller-ui
tags: [fast, protocol-modal, command-drawer, local-bindings, no-zero-fill, static-scan]
requires:
  - phase: 07-f-a-s-t-plate-dropdowns
    provides: "07-01 LOCAL_BINDINGS, StaticSelect, TipReuseCheckbox, applyLocalChange, newStepDefaults"
provides:
  - "Deck selects and Reuse tips checkbox in AddToolCommandModal and the edit-mode CommandDetailsDrawer"
  - "fillMissingParams: modal save-time fill-in with the D-07 no-zero-fill exception"
  - "NO_ZERO_FILL_FIELDS and isNoZeroFillField"
  - "Static scans for local fields, moved fill-ins and get_plates absence"
affects: [07-06, 07-07, 07-08]
tech-stack:
  added: []
  patterns:
    - "Save-time fill-in extracted to a pure structural-typed helper so a D-07 exception is unit-testable"
    - "no-zero-fill check precedes the number fill-in (RESEARCH Pitfall 4)"
key-files:
  created: []
  modified:
    - controller/components/protocols/AddToolCommandModal.tsx
    - controller/components/protocols/CommandDetailsDrawer.tsx
    - controller/components/tools/commandParams.ts
    - controller/components/tools/fieldOptions.ts
    - controller/test/commandParams.test.ts
    - controller/test/fastFieldOptions.test.ts
    - controller/test/staticScan.test.ts
key-decisions:
  - "The four legacy fill-in statements moved byte-identical into fillMissingParams; the scan now pins them in the helper and pins that handleSubmit calls it"
  - "Modal number input for a no-zero-fill field shows an empty box when unset and writes '' when cleared; every other number field keeps its display and parseFloat-or-0 write"
  - "Initialisation effect dependency array not widened (RESEARCH Pitfall 10); newStepDefaults merged after the defaultValue loop"
requirements-completed: [PLT-04, PLT-05, PLT-06, PLT-07]
duration: 3 min
completed: 2026-11-12
status: complete
commits: 4
plan_head_before: 20d1cf6b2459509dafb7c1de288cc049b024f082
plan_head_after: 093ddb50bf783f8a349a798594c73fe8fc0d8998
actuals:
  tokens: 6500
  tasks: 3
  commits: 4
coverage:
  - id: D1
    description: "Unset source_deck, dest_deck, source_plate_id, dest_plate_id are saved as '' (never 0); every other field keeps the legacy fill-in"
    requirement: PLT-04
    verification:
      - kind: unit
        ref: "controller/test/commandParams.test.ts#fillMissingParams (D-07: unset plate/deck saved as blank, never 0)"
        status: pass
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#isNoZeroFillField (D-07, PLT-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "get_plates appears in no client file and is no commandFields key"
    requirement: PLT-05
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#F.A.S.T. local field invariants (D-07, D-08, D-09, D-17) > get_plates is in no client file and is no commandFields key (PLT-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Decks and Reuse tips checkbox render in the modal and edit-mode drawer; new modal step gets tip_reuse reuse; drawer writes nothing on open"
    requirement: PLT-06
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#F.A.S.T. local field invariants (host wiring, newStepDefaults never in drawer, isEditing-only lookup)"
        status: pass
    human_judgment: true
    rationale: "Rendered Chakra controls in the modal and drawer cannot be observed under the node-only vitest setup; Task 1 human-check is deferred to end-of-phase UAT"
---

# Phase 7 Plan 03: Protocol Hosts for Decks, Reuse Tips and No-Zero-Fill Summary

The F.A.S.T. transfer deck selects and "Reuse tips" checkbox now render in `AddToolCommandModal` and the edit-mode `CommandDetailsDrawer` beside the unchanged variable picker, a new modal step starts with tip_reuse "reuse", and the modal's save-time fill-in lives in a tested `fillMissingParams` that saves an unset plate or deck as "" instead of 0.

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-12T04:40:10Z
- **Completed:** 2026-11-12T04:43:09Z
- **Tasks:** 3
- **Files modified:** 7 (0 new)

## Accomplishments

- **Task 1 (hosts):** In both hosts a local binding is looked up before the instrument-fed branch. A static binding renders `StaticSelect`, a checkbox binding renders `TipReuseCheckbox`, each in an HStack with the 180px "No Variable" select (its "" choice writes "" through `applyLocalChange`; a variable binds as `{{name}}` and the control shows disabled). The modal merges `newStepDefaults` into the initialisation effect after the defaultValue loop (dependency array unchanged). The drawer looks bindings up only while `isEditing`, never calls `newStepDefaults`, and keeps `handleSaveInputs` untouched.
- **Task 2 (TDD):** `NO_ZERO_FILL_FIELDS` / `isNoZeroFillField` (own-property lookups) and `fillMissingParams` (no-zero-fill check before the number fill-in; four legacy fill-ins verbatim). `handleSubmit` calls the helper; the modal's number input for those four fields shows blank when unset and writes "" when cleared.
- **Task 3 (scans):** the old handleSubmit scan replaced by two cases; new describe block "F.A.S.T. local field invariants (D-07, D-08, D-09, D-17)" with seven cases.

## Task Commits

1. **Task 1: hosts** - `bdeca92` (feat)
2. **Task 2 RED** - `69ba992` (test)
3. **Task 2 GREEN** - `627272a` (feat)
4. **Task 3: scans** - `093ddb5` (test)

**Plan metadata:** docs commit follows (this SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## TDD Gate Compliance

- **RED** `69ba992` `test(07-03)`: 6 new tests failed (4 `fillMissingParams is not a function`, 2 `isNoZeroFillField is not a function`), 32 existing passed. Semantic assessment: the target tests executed and failed because the feature was absent, not due to syntax, import or fixture faults. `gsd_run check tdd-red-evidence` was not run (default vitest reporter, not TAP); assessment is manual.
- **GREEN** `627272a` `feat(07-03)`: commandParams 16/16, fastFieldOptions 22/22, wire 8/8; full suite 930/930 after Task 3; `tsc --noEmit` clean.
- **REFACTOR:** none needed.

## Files Created/Modified

- `controller/components/protocols/AddToolCommandModal.tsx` - local-binding rows, `handleLocalSelect`, new-step default, `fillMissingParams` in `handleSubmit`, no-zero-fill number display
- `controller/components/protocols/CommandDetailsDrawer.tsx` - edit-mode local-binding rows, `handleLocalSelect`
- `controller/components/tools/commandParams.ts` - `fillMissingParams`
- `controller/components/tools/fieldOptions.ts` - `NO_ZERO_FILL_FIELDS`, `isNoZeroFillField`
- `controller/test/commandParams.test.ts`, `controller/test/fastFieldOptions.test.ts`, `controller/test/staticScan.test.ts` - tests and scans

## Decisions Made

- Legacy fill-in statements moved byte-identical into the helper (parity sweep over every `commandFields` tool/command proves no other field changed).
- The no-zero-fill number display change is scoped to the four fields only.
- A saved "" plate or deck still encodes as 0 on the wire and the adapter refuses it before any motion (accepted risk T-07-04/T-07-08 residual; PLT-04 is "never saved as 0").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deck-literal scan false positive on a 24-well plate column list**
- **Found during:** Task 3
- **Issue:** `controller/server/routers/inventory.ts` line 64 writes `columns: [1, 2, 3, 4, 5, 6]` for a 24-well plate. The planned "no scanned file contains the literal deck list" scan would fail on a list that is not a deck list.
- **Fix:** the scan excludes that one file by path, with a comment stating why.
- **Files modified:** controller/test/staticScan.test.ts
- **Verification:** staticScan 67/67.
- **Committed in:** 093ddb5

---

**Total deviations:** 1 auto-fixed (1 bug in plan's scan scope)
**Impact on plan:** None on product behavior.

Notes (not deviations): between the GREEN commit `627272a` and the Task 3 commit `093ddb5` the old handleSubmit scan ("keeps its four fill-ins") was red, as the plan intends (Task 3 replaces it).

## Issues Encountered

None.

## Human verification pending (end-of-phase UAT)

Task 1 `<human-check>`: in a protocol, Add Command, F.A.S.T. tool, transfer: decks are empty selects 1-6 with "No Variable" beside them; "Reuse tips" checked on the new step; a bound variable shows `{{name}}` disabled. Reopen a saved step in the editing drawer: same controls; deck 7 reads "7 (not a deck slot 1-6)"; saved "" or "cold" tip_reuse shows the indeterminate box with its flag and is unchanged after closing. The run-page drawer keeps the old disabled inputs (no deck select, no checkbox). Never start a run. Not executed in this run (node-only vitest cannot render Chakra).

Also for UAT (RESEARCH Pitfall 10, pre-existing): the modal initialisation effect re-runs when the labware list reference changes and re-applies "reuse", losing other picks.

## Known Stubs

None. Until 07-08, `source_plate_id` and `dest_plate_id` are still plain number fields in the modal (blank when unset by the no-zero-fill display rule).

## Threat Flags

None. No new endpoints, auth paths or schema changes; no packages installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for the remaining Phase 7 plans (07-04 onward). Hosts expose the local-field wiring that 07-07 extends with the WellPicker.

## Self-Check: PASSED

- FOUND: all seven modified files; `fillMissingParams(` in AddToolCommandModal.tsx; `lookupLocalBinding(` in both hosts; `newStepDefaults` count in the drawer is 0
- FOUND commits: bdeca92, 69ba992, 627272a, 093ddb5
- `isNoZeroFillField(` (line 109) precedes `finalParams[field.name] = 0;` (line 112) in commandParams.ts
- `tsc --noEmit` exits 0, prettier clean on the five touched source files, full `vitest run` 930/930
