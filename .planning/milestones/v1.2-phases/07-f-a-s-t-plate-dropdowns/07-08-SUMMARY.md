---
phase: 07-f-a-s-t-plate-dropdowns
plan: 08
subsystem: tool-field-options-client
tags: [fast, plates, dropdown, field-bindings, OptionsSelect, vitest, tdd]
requires:
  - phase: 07-f-a-s-t-plate-dropdowns
    provides: "07-06 fast.plates source and the ok 'plates' OptionsResult shape; 07-02 plateLabel; 07-03 no-zero-fill fields"
provides:
  - "FieldRole member { kind: 'plate'; side } and FIELD_BINDINGS.fast.transfer (source_plate_id, dest_plate_id) bound to fast.plates"
  - "plateOptions with '{id} · {description}' labels and DUPLICATE_SUFFIX flags (every duplicate kept)"
  - "applyChange numeric plate writes and a digit-only typed fallback"
  - "OptionsSelect numeric inputMode for plate fields and warning colour for duplicate options"
  - "Folded todo closed in .planning/todos/completed/"
affects: [07-07]
tech-stack:
  added: []
  patterns:
    - "A new binding role is added to the existing map; the three hosts pick it up through lookupFieldBinding with no host edit"
    - "applyChange stays the only patch producer; plate role branches before the generic typed early-return"
key-files:
  created: []
  modified:
    - controller/components/tools/fieldOptions.ts
    - controller/components/tools/OptionsSelect.tsx
    - controller/test/fastFieldOptions.test.ts
    - controller/test/fieldOptions.test.ts
    - controller/test/wire.test.ts
    - .planning/todos/completed/2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md
key-decisions:
  - "Plate fields bind through FIELD_BINDINGS (instrument-fed), not LOCAL_BINDINGS; decks, tip_reuse and well fields stay local"
  - "Select choice writes Number(id) via numericPatch; typed fallback keeps ASCII digits only and writes '' when none remain, so a non-numeric string never reaches the wire"
  - "Duplicate ids are labelled and coloured, never collapsed; value stays String(id) so the stored value is only the id"
  - "fieldOptions.ts imports plateLabel from wellGeometry.ts (no import cycle) so the dropdown and grid caption share one label"
requirements-completed: [PLT-03, PLT-04]
duration: 14 min
completed: 2026-11-12
status: complete
commits: 3
plan_head_before: 10b87a4e68877ac220a74104ded2233d7b4cd476
plan_head_after: 6bd28326aad4f8f3e35d1eb59807a3e80bf79086
actuals:
  tokens: 9000
  tasks: 2
  commits: 3
coverage:
  - id: D1
    description: "source_plate_id and dest_plate_id are born-empty dropdowns of the registered plates labelled '{id} · {description}', nothing preselected (even for one plate), saved plate matched by String equality, unreported saved plate flagged, zero-plate list is ok mode with only the blank option"
    requirement: PLT-03
    verification:
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#buildFieldView for a plate binding (PLT-03, PLT-04)"
        status: pass
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#plateOptions (D-05, D-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Choosing a plate writes the NUMBER id; the typed fallback keeps digits only and writes '' for a blank, so no non-numeric string reaches the wire; unavailable list shows the typed input with the hint, never a stale list"
    requirement: PLT-03
    verification:
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#applyChange for a plate binding (T-07-24)"
        status: pass
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#buildFieldView for a plate binding (PLT-03, PLT-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Duplicate plate ids: every entry sharing an id carries the duplicate suffix and flag and stays selectable; unique ids are unflagged"
    requirement: PLT-04
    verification:
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#plateOptions (D-05, D-06)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plate bindings: exactly the two plate fields of fast transfer, source_plate_id carries the one Refresh row, both are number fields in commandFields; the three hosts and existing OptionsSelect static scans pass unedited"
    requirement: PLT-03
    verification:
      - kind: unit
        ref: "controller/test/fieldOptions.test.ts#binding coverage (STK-07, D-10)"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual result in the real selects: a 60-character description plus duplicate suffix clipped cleanly in the AddToolCommandModal [Select][180px] row, a 1000-plate list scrolling in the native Select, and the real plate list from a live or simulated F.A.S.T."
    requirement: PLT-03
    verification: []
    human_judgment: true
    rationale: "Layout and live-instrument behaviour are not asserted by any unit test; end-of-phase UAT item (07-07 / verify-work)"
---

# Phase 7 Plan 08: Plate Dropdowns Summary

**source_plate_id and dest_plate_id become born-empty dropdowns of the instrument's registered plates in all three hosts, labelled `{id} · {description}`, writing the numeric id, flagging every duplicate id, and falling back to a digits-only numeric input when the list is unavailable.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-11-12T09:25Z (approx.)
- **Completed:** 2026-11-12T09:39Z
- **Tasks:** 2
- **Files modified:** 6 (2 source, 3 test, 1 planning)

## Accomplishments

- `fieldOptions.ts`: `FieldRole` gains `{ kind: "plate"; side }`; `FIELD_BINDINGS.fast.transfer` binds `source_plate_id` (side source) and `dest_plate_id` (side destination) to `fast.plates`. The three hosts already render any binding through `OptionsSelect`, so no host file changed (confirmed: no commit of this plan touches `controller/components/protocols` or `controller/pages`). `firstFieldForSource` puts the one Refresh row under `source_plate_id`.
- `plateOptions(data)`: `[]` unless an ok plates result; otherwise every entry in reply order with key `String(index)`, value `String(id)`, label from `plateLabel` (shared with the grid caption), plus `DUPLICATE_SUFFIX` and flag `"duplicate"` for every entry whose id occurs more than once. Nothing is collapsed or sorted.
- `buildFieldView` plate branch: born on the blank option with nothing preselected (also for exactly one plate); an ok list with zero plates is ok mode with only the blank option (never unavailable); a saved plate matches by `String(saved) === String(id)` with no trim; a saved plate not offered gets the flagged `(not reported by instrument)` extra option; a non-plates result for a plate binding is unavailable (typed input).
- `applyChange` returns `Record<string, string | number>`. Plate role: a select choice goes through `numericPatch` (number for all-digit, `""` for blank); typed text keeps ASCII digits only and writes `""` when none remain (T-07-24).
- `OptionsSelect.tsx`: typed Input sets `inputMode="numeric"` for plate bindings; `"duplicate"` options use the warning colour like `"ambiguous"`. Still no effect hook, no first-option construct, one `useToolOptions` call.
- Deliberate test edits: `fieldOptions.test.ts` and `fastFieldOptions.test.ts` binding-coverage pins now expect `["stack", "fast"]` (RESEARCH Pitfall 4); `wire.test.ts` only widens the local `chosen` annotation to `Record<string, string | number>`.
- Folded todo `2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md` moved to `.planning/todos/completed/` (git rename, R077) with a resolution naming 07-05, 07-06 and 07-08.
- Verification: targeted suites 183 passed; full suite 1005 passed (35 files); `tsc --noEmit` clean; `TODO_CLOSED` printed.

## Task Commits

1. **Task 1 RED: failing plate dropdown tests** - `605d647` (test)
2. **Task 1 GREEN: plate role, bindings, plateOptions, numeric writes, OptionsSelect** - `8b3ca18` (feat)
3. **Task 2: close folded todo** - `6bd2832` (docs)

**Plan metadata:** recorded in the docs(07-08) commit that follows this file.

## TDD Gate Compliance

- **RED:** `controller/test/fastFieldOptions.test.ts` added the plate cases (bindings, `plateOptions`, plate `buildFieldView`, numeric `applyChange`) plus the `["stack", "fast"]` pin. Run before implementation: 20 failed, 22 passed. Failures were the planned ones: `lookupFieldBinding("fast","transfer","source_plate_id")` undefined (thrown by the helper at the target assertion) and `plateOptions` / `DUPLICATE_SUFFIX` not yet exported. Semantic assessment: target tests executed and failed for the intended reason (missing behavior), not syntax or fixture faults. The `gsd_run check tdd-red-evidence` classifier was not run (plan frontmatter is `type: execute`, not `type: tdd`; no evidence file recorded).
- **GREEN:** the same file plus `fieldOptions.test.ts` and `wire.test.ts` pass after the implementation commit.
- **REFACTOR:** none needed.

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-07-24 (digits-only typed fallback, blank writes `""`), T-07-29 (labels are React text children; the stored value is `Number(String(id))` only) and T-07-30 (duplicates labelled, coloured and kept) are mitigated and covered by the behaviour tests.

## Issues Encountered

None.

## Next Phase Readiness

Ready for 07-07 (well picker). The unresolved human-judgment items (long-text clipping in the modal `[Select][180px]` row, 1000-entry scroll, real plate list from a live or simulated F.A.S.T.) are end-of-phase UAT items.

## Self-Check: PASSED

- FOUND: controller/components/tools/fieldOptions.ts, controller/components/tools/OptionsSelect.tsx, controller/test/fastFieldOptions.test.ts, controller/test/fieldOptions.test.ts, controller/test/wire.test.ts, .planning/todos/completed/2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md
- FOUND commits: 605d647, 8b3ca18, 6bd2832
