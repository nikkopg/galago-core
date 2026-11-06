---
phase: 06-stack-dropdowns
plan: 03
subsystem: ui
tags: [react-free, view-model, cascade, vitest, stack, dropdowns]
status: complete

requires:
  - phase: 06-stack-dropdowns
    provides: "06-01 binding map (FIELD_BINDINGS with cascade roles), deriveOptionsMode, buildSelectView, listOptions, isVariableLike; 06-02 OptionsResult tree shape with ambiguous[]"
provides:
  - "buildCascadeOptions: device -> deck -> nest by position, calibrated only, ambiguity flagged with device- and deck-level prefix propagation"
  - "applyChange: the only param-patch producer (device clears the same side's deck+nest, deck clears nest)"
  - "buildSelectView extended (allowVariables, ancestorVariableBound, parentBlank, emptyNote) with 06-01 behaviour kept when omitted"
  - "buildFieldView: the single function every host renders a bound field from (view only, never a patch)"
  - "cascadeAncestorBound, firstFieldForSource, formatStatusLine, SOURCE_LABELS and the UI-SPEC copy constants"
  - "SelectOption.pathKey and SelectOption.names on cascade options"
  - "Golden-derived device-tree fixtures (duplicates, '/' collisions, uncalibrated, empty device)"
  - "DRP-09 wire proof: dropdown-chosen transfer encodes to the same bytes as typed"
affects: [06-04, 06-05]

actuals:
  tokens: 15800
  tasks: 2
  commits: 4
plan_head_before: e312123d393a16e836015c6e7fee43456fb844f1
plan_head_after: 157217baefc31609ee3645a6740f83a78a134a8d

tech-stack:
  added: []
  patterns:
    - "Pure view model: hosts render SelectView from buildFieldView and write only applyChange patches from onChange"
    - "Cascade option keys encode side, level and indices (source:nest:d:k:n) so duplicate names never share a key"
    - "Optional SelectView/SelectOption keys (note, flag, pathKey) are set only when present, so 06-01 toStrictEqual views stay identical"

key-files:
  created:
    - controller/test/fixtures/stackDeviceTrees.ts
    - controller/test/fieldOptions.test.ts
  modified:
    - controller/components/tools/fieldOptions.ts
    - controller/test/wire.test.ts

key-decisions:
  - "A nest's parentBlank is true when either the device or the deck is blank (both govern the nest list)"
  - "buildFieldView treats an ok mode whose data does not fit the binding (tree for a list, list for a cascade, or no data) as unavailable, so a mis-wired host falls back to the typed input instead of an empty select"
  - "A deck or nest emptyNote is only set when a matching calibrated parent exists; a parent value missing from the tree, or an uncalibrated saved deck, gives an empty list with no note"
  - "variable-bound and child-of-variable take precedence over loading/unavailable as well as ok, since a variable value never needs the instrument list"
  - "Ambiguous array is read defensively (non-array treated as []), so an absent array flags nothing"

patterns-established:
  - "Cascade hosts (06-04, 06-05) call buildFieldView for the view and applyChange in onChange; no effect hook ever writes a param"

requirements-completed: [DRP-01, DRP-02, DRP-03, DRP-05, DRP-09, STK-02, STK-03, STK-04, STK-07]

coverage:
  - id: D1
    description: "Device, deck and nest options are built by index from the one tree, values are plain names, keys include side and indices, and source/destination are independent"
    requirement: STK-02
    verification:
      - kind: unit
        ref: "controller/test/fieldOptions.test.ts#buildCascadeOptions: golden tree"
        status: pass
  - id: D2
    description: "Uncalibrated decks and nests are never offered; device with none still offered with the note; saved uncalibrated deck stays selected and marked not reported"
    requirement: STK-03
    verification:
      - kind: unit
        ref: "controller/test/fieldOptions.test.ts#buildCascadeOptions: calibration (D-07) and empty notes"
        status: pass
  - id: D3
    description: "Ambiguity is flagged, never hidden or picked: duplicate device, duplicate deck (prefix to nests), duplicate nest, '/' collisions; same nest under different decks not flagged"
    requirement: STK-04
    verification:
      - kind: unit
        ref: "controller/test/fieldOptions.test.ts#buildCascadeOptions: ambiguity (flag, never hide, never pick)"
        status: pass
  - id: D4
    description: "applyChange is the only patch producer and clears only the same side's children; hydrate + refresh (golden, different, empty) changes no value; round trip toStrictEqual"
    requirement: DRP-05
    verification:
      - kind: unit
        ref: "controller/test/fieldOptions.test.ts#applyChange (D-09): the only patch producer; hydrate + refresh never changes a saved step"
        status: pass
  - id: D5
    description: "Non-blank unlisted values stay selected and flagged '(not reported by instrument)'; blank values never flagged; loading/unavailable never flag"
    requirement: DRP-02
    verification:
      - kind: unit
        ref: "controller/test/fieldOptions.test.ts#buildFieldView: ok lists (E1, D-11)"
        status: pass
  - id: D6
    description: "Variable-bound and child-of-variable modes only when variables are allowed; '{{x' and 'x}}' are plain values"
    requirement: DRP-03
    verification:
      - kind: unit
        ref: "controller/test/fieldOptions.test.ts#buildFieldView: variable modes (D-13)"
        status: pass
  - id: D7
    description: "A dropdown-chosen transfer encodes through tool_base.Command to exactly the same bytes as the same strings typed"
    requirement: DRP-09
    verification:
      - kind: unit
        ref: "controller/test/wire.test.ts#encodes a dropdown-chosen STACK transfer to the same bytes as the same values typed"
        status: pass
  - id: D8
    description: "Bindings cover exactly transfer, get_transfer_estimate and get_labware_presence; every bound field is a text field in commandFields.stack; step_key, timeout_s and refresh stay typed"
    requirement: STK-07
    verification:
      - kind: unit
        ref: "controller/test/fieldOptions.test.ts#binding coverage (STK-07, D-10)"
        status: pass
  - id: D9
    description: "Born-empty: a 0- or 1-item list starts on the blank option with nothing preselected; a validated empty list is ok with status '0 items'"
    requirement: DRP-01
    verification:
      - kind: unit
        ref: "controller/test/fieldOptions.test.ts#buildFieldView: ok lists (E1, D-11); formatStatusLine"
        status: pass
    human_judgment: true
    rationale: "Rendered select behaviour is checked when 06-04 / 06-05 wire the hosts; this plan pins the pure view model only."

duration: 7min
completed: 2026-11-06
---

# Phase 6 Plan 03: Cascade core and view model Summary

**A React-free device -> deck -> nest cascade (by position, calibrated only, ambiguity flagged with device- and deck-level prefix propagation), `applyChange` as the only patch producer, and a full `buildFieldView` view model with status line, plus hydrate+refresh, round-trip and wire proofs that nothing saved or sent changes.**

## Performance

- **Duration:** about 7 min (2026-11-06T02:20Z to 02:27Z)
- **Tasks:** 2 of 2
- **Files:** 4 changed (2 created, 2 modified)

## Accomplishments

- `buildCascadeOptions(tree, binding, values)`:
  - Lists every device by index.
  - Deck level lists the calibrated decks of every device whose name String-equals the saved device, in device-then-deck index order.
  - Nest level lists the calibrated nests of every calibrated deck that matches both the device and the deck.
  - Each option's value is the plain name. It also carries a `/`-joined `pathKey`, plain `names`, and a key such as `source:nest:0:1:2`.
  - Flags follow knowledge.py: a device is flagged when its name is listed; a deck when `device/deck` or the device is listed; a nest when `device/deck/nest`, `device/deck` or the device is listed. Flagged options are never hidden, merged or picked.
- `applyChange(binding, newValue)`:
  - A device change returns `{device, deck: "", nest: ""}` for the same side.
  - A deck change returns `{deck, nest: ""}`.
  - Any other change returns only its own field.
  - It reads no option list.
- `buildSelectView` now follows this precedence: variable-bound, then child-of-variable (both only when `allowVariables`), then unavailable, loading, ok.
  - In ok mode, a blank value under a blank parent gets a disabled view with only the blank option.
  - Otherwise, a non-blank value that matches no offered option gets the not-reported extra option, and `note` holds the empty-list note.
  - When the new inputs are omitted, the output is byte-for-byte the 06-01 output.
- `buildFieldView` (the single entry for hosts), `cascadeAncestorBound`, `firstFieldForSource`, `formatStatusLine` (built from local `getHours/getMinutes/getSeconds`, zero-padded, `1 item`/`N items`, plus the degraded suffix), `SOURCE_LABELS`, and all UI-SPEC copy constants.
- Fixtures in `test/fixtures/stackDeviceTrees.ts`: the golden tree plus duplicate device, duplicate deck, duplicate nest, same nest under different decks, `/` collision, uncalibrated, empty device, refreshed, and no-devices variants.
- Wire proof: the robot and source location are chosen through the real parsers (golden replies), `listOptions` / `buildCascadeOptions` and `applyChange`. They encode to the same `tool_base.Command` bytes as the same strings typed.
- Full controller suite: 32 files, 745 tests pass. `tsc --noEmit` is clean.

## Task Commits

1. **Task 1: Location cascade, calibration, ambiguity, applyChange**
   - RED `058cf14` (test)
   - GREEN `fa5d809` (feat)
2. **Task 2: View model, status line, coverage, hydrate+refresh, round trip, wire**
   - RED `eaf8211` (test)
   - GREEN `157217b` (feat)

## TDD Gate Compliance

**Task 1**
- Following 06-02's precedent, non-behavioral interface stubs were added to the working tree (empty constants, a `buildCascadeOptions` that returns `[]`, an `applyChange` that returns `{}`) so the RED run failed on assertions rather than on `is not a function`. They were never committed. The RED commit contains only the test and fixture files.
- RED: 22 of 25 tests failed on planned assertions.
- The first classifier attempt targeted a test with an object `expected` value. Vitest `tap-flat` writes that as multi-line YAML, which the classifier rejects (`invalid_record`).
- I re-ran with the single-line target "keeps the chosen value exactly and returns a new object each time". The classifier returned `RED_EVIDENCE_OK` (target_test_failed).
- Semantic check: the target ran and failed on `expected undefined to be ' Dev '`, the planned applyChange assertion.

**Task 2**
- Same stub approach, again uncommitted. RED: 21 of 54 tests failed on planned assertions.
- The target "formatStatusLine > reads 0 items, 1 item and N items..." got `RED_EVIDENCE_OK`.
- Semantic check: it failed on `expected '' to be 'from instrument · 0 items · fetched 09:05:07'`, the planned assertion.
- The wire byte-equality case and the binding-coverage cases passed from the start: they pin functions that already existed (listOptions, buildCascadeOptions, applyChange, FIELD_BINDINGS). They are regression proofs, not new behaviour.

**GREEN:** both tasks pass their targeted runs (`fieldOptions`, `wire`, `commandFields`: 67 tests). No REFACTOR commits were needed.

## Deviations from Plan

None. The plan was executed as written. These judgment calls fall inside its latitude:

- A nest's `parentBlank` is true when either the device or the deck is blank, not only the deck. A nest with no device has no list to come from.
- `buildFieldView` maps a shape mismatch, or ok mode with no data, to `unavailable` (the typed input). This is defensive: a mis-wired host degrades to typing instead of showing an empty select.
- Variable modes take precedence over loading and unavailable too, per the stated precedence order.
- Test files were formatted with prettier before commit. In the Task 2 RED commit this also reflowed a few long lines in the Task 1 tests (formatting only).

## Known Stubs

None. Every exported constant is UI-SPEC copy.

## Threat Flags

None. The plan creates no new network, auth or file surface. T-06-10 is mitigated by the flag-only ambiguity tests and T-06-13 by the applyChange, hydrate+refresh and round-trip tests. No package was installed (T-06-SC).

## Pins Checked

- `commandFields.stack` was not edited: `git log 2505ceb..HEAD -- constants.ts commandFields.test.ts` is empty.
- No host file (AddToolCommandModal.tsx, CommandDetailsDrawer.tsx, pages/tools/[id].tsx) appears in any of the 4 task commits.
- `fieldOptions.ts` has no react import, no `useEffect`, no `unifiedName` and no `toLocaleTimeString` outside comments. None of the new files contains `acknowledge_failure`.
- staticScan, toolPageReply and latchStatus pass inside the full run.

## Next Phase Readiness

06-04 and 06-05 can render every bound field from `buildFieldView` and write changes only through `applyChange` in onChange. `firstFieldForSource` places the one Refresh row per source, and `formatStatusLine` / `SOURCE_LABELS` / `REFRESH_LABEL` / `REFRESHING_LABEL` supply its copy.

## Self-Check: PASSED

- FOUND: controller/test/fixtures/stackDeviceTrees.ts, controller/test/fieldOptions.test.ts, controller/components/tools/fieldOptions.ts, controller/test/wire.test.ts
- FOUND (ancestors of HEAD): 058cf14, fa5d809, eaf8211, 157217b
- `npx tsc --noEmit` exit 0; `npx vitest run` 32 files / 745 tests pass
