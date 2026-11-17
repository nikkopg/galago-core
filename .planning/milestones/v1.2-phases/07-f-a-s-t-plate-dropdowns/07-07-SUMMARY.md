---
phase: 07-f-a-s-t-plate-dropdowns
plan: 07
subsystem: ui
tags: [react, chakra-ui, react-query, well-picker, fast-transfer, vitest]
status: complete

requires:
  - phase: 07-f-a-s-t-plate-dropdowns
    provides: "WellPicker + wellGeometry (07-02, 07-04), fast.plates read (07-06), plate dropdowns (07-08)"
provides:
  - "wells local binding group for the six F.A.S.T. well fields, isWellGroupAnchor, plateListInput"
  - "FastTransferWellPicker: plate-list-reading wrapper sharing the (toolId, fast.plates) query entry"
  - "Picker mounted on the tool page, in AddToolCommandModal and in CommandDetailsDrawer (edit mode only)"
  - "Static-scan invariants for the picker and its three hosts (D-10, D-13, D-16, D-17)"
  - "Green phase gate with the frozen get_plates pin held"
affects: [07-UAT, phase-08]

actuals:
  tokens: 6900
  tasks: 3
  commits: 4
plan_head_before: babebbea5e4ec539ded1ffa13f1caba08a34cadb
plan_head_after: c9c29709314a6e916f1dab1993d3b333586040a1

tech-stack:
  added: []
  patterns:
    - "Group anchor idiom: isWellGroupAnchor renders one shared control at the first member of a field group in each host's own order"
    - "Host-owned writes: every picker gesture goes through one functional state merge (handleWellPatch); no effect hook anywhere in the picker"

key-files:
  created: []
  modified:
    - controller/components/tools/fieldOptions.ts
    - controller/components/tools/WellPicker.tsx
    - controller/pages/tools/[id].tsx
    - controller/components/protocols/AddToolCommandModal.tsx
    - controller/components/protocols/CommandDetailsDrawer.tsx
    - controller/test/fastFieldOptions.test.ts
    - controller/test/staticScan.test.ts
    - controller/test/wire.test.ts

key-decisions:
  - "The six well fields are a 'wells' group in LOCAL_BINDINGS (not FIELD_BINDINGS); each host renders the picker once at the first well field and returns null for the other five"
  - "In the modal and drawer the 'No Variable' choice for a well field writes '' (mirrors the existing local-binding branches and, in the drawer, keeps the key so the save merge cannot fall back to the saved value)"
  - "ModalContent maxW stays 900px; widening only if UAT shows two 384 grids overflow (D-11)"

requirements-completed: [PLT-03, PLT-08, PLT-09]

coverage:
  - id: D1
    description: "Wells group in LOCAL_BINDINGS, anchor selection over host field order, plateListInput mapping"
    requirement: "PLT-08"
    verification:
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#wells local group (D-11)"
        status: pass
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#isWellGroupAnchor (D-11)"
        status: pass
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#plateListInput (D-16)"
        status: pass
    human_judgment: false
  - id: D2
    description: "FastTransferWellPicker mounted on the tool page, in AddToolCommandModal and in the edit-mode CommandDetailsDrawer, sharing one fast.plates read; run-page read-only drawer mounts no picker and sends no read"
    requirement: "PLT-03"
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#F.A.S.T. well picker invariants (D-10, D-13, D-16, D-17)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Drag, destination click, typed edit and Clear write the six well fields; misfit flagged and never clipped; size-mismatch warning does not block saving"
    requirement: "PLT-09"
    verification:
      - kind: other
        ref: "tsc --noEmit, full vitest, next build (rendered behaviour not observable under node-only vitest)"
        status: pass
    human_judgment: true
    rationale: "Rendered grids, drag feel, layout, dark-mode colours and the live instrument list need a human with a live or simulated F.A.S.T. (07-UAT.md)"
---

# Phase 7 Plan 07: Well picker in the three hosts Summary

**The six F.A.S.T. well fields become a grouped 'wells' binding, and a plate-list-reading FastTransferWellPicker mounts once at the first well field on the tool page, in AddToolCommandModal and in the edit-mode CommandDetailsDrawer, with the full phase gate green and the frozen get_plates pin held.**

## Performance

- **Started:** 2026-11-12 (sequential executor, main tree)
- **Completed:** 2026-11-12T09:45Z
- **Tasks:** 3 (Task 1 TDD: RED then GREEN)
- **Files modified:** 8

## Accomplishments

- `fieldOptions.ts`: `WellsBinding`, `isWellsBinding`, the six `WELL_FIELDS` as a wells group in `LOCAL_BINDINGS.fast.transfer`, `applyLocalChange` routing wells to `wellFieldPatch`, `isWellGroupAnchor` (first well field in the host's own order) and `plateListInput` (loading/ok/unavailable mapping, a non-plates ok result reads as unavailable).
- `WellPicker.tsx`: `FastTransferWellPicker` calls `useToolOptions(toolId, "fast.plates", enabled)` once and feeds `WellPicker`; it shares the one react-query entry with the plate dropdowns (no extra read, poll or retry).
- Tool page: `handleWellPatch` (one functional `setFormValues` merge); inline picker between `dest_plate_id` and `volume` with `allowVariables={false}` and `fieldsLayout="grid"`.
- `AddToolCommandModal`: `handleWellPatch` (one functional merge), `renderWellField` (Input + 180px variable Select), picker at the anchor in the step-3 loop, `enabled={isOpen}`, `allowVariables`, `fieldsLayout="rows"`. The six fields no longer reach the number/text cases, so nothing paints a 0.
- `CommandDetailsDrawer`: picker at the first saved well key only while `isEditing` (`enabled={isEditing}`); typed edits and Clear merge into `editedParams`; the variable Select's "No Variable" writes `""` for the key rather than deleting it; `handleSaveInputs` untouched. Read-only drawer renders as before (no grid, no read).
- `staticScan.test.ts`: new block "F.A.S.T. well picker invariants (D-10, D-13, D-16, D-17)" with 10 cases (no effect/timer/elementFromPoint/raw HTML in WellPicker; pointer-cancel and lost-capture present; no first-option constructs; only `fast.plates` read and no `tool.options`; wellGeometry imports neither React nor Chakra; exactly three hosts render `<FastTransferWellPicker`; bare `<WellPicker` only in WellPicker.tsx; drawer element carries `enabled={isEditing}`; `CLEAR_PATCH` only in wellGeometry.ts and WellPicker.tsx).

## Task Commits

1. **Task 1 RED:** `0c9d5d3` test(07-07): failing tests for wells group, anchor and plateListInput
2. **Task 1 GREEN:** `7ba89e1` feat(07-07): wells group and FastTransferWellPicker on tool page and modal
3. **Task 2:** `c3ea24b` feat(07-07): well picker in edit-mode CommandDetailsDrawer and picker scans
4. **Task 3 (gate formatting fix):** `c9c2970` style(07-07): prettier format wire.test.ts for the phase gate

## TDD Gate Compliance

- **RED:** `0c9d5d3`. Target tests (`wells local group`, `isWellGroupAnchor`, `plateListInput`) were run before any implementation: 8 failed / 42 passed, failing with `TypeError: plateListInput is not a function` and undefined-binding assertions, i.e. on the planned behaviour (not import, syntax or fixture faults; the file loaded and 42 pre-existing tests executed). Semantic assessment: valid RED.
- **GREEN:** `7ba89e1`, all 50 tests in the file pass.
- **REFACTOR:** none needed.

## Phase gate (Task 3)

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | 35 files, 1023 tests passed |
| `npx prettier . --check` | clean (after formatting `test/wire.test.ts`, see Deviations) |
| `npx next lint --no-cache --quiet` | no warnings or errors |
| `npm run build` | exit 0 in place (`.next` writable, no mktemp copy needed; RESEARCH A6 held) |
| Pin check | `PIN_HELD d53da5384f9f99d6751a5abfbbe0abbaa7a02389`; no gen-interfaces diff; `Command_GetPlates` present |
| `maxW="900px"` in AddToolCommandModal | 1 (unchanged) |

## End-of-phase UAT (carried to 07-UAT.md)

No live or simulated F.A.S.T. tool server was available to this executor (fast-mcp/stack-mcp MCP servers failed to connect), so none of the rendered items below were observed. All eight are carried to 07-UAT.md as pending:

1. Tool page: 8x12 source and destination, drag a 2x3 block, hover/click destination, Edit as fields, lower-case row, Clear selection. Pending.
2. 16x24 destination: -9006 size-mismatch warning, no footprint, clicks inert, saving not blocked. Pending.
3. Tool server stopped and reload: numeric typed plate inputs, both grids hidden, Edit as fields forced open. Pending.
4. Protocol Add Command: variable-bound dest_start_row forces Edit as fields open; 60-char plate description; duplicate id label. Pending.
5. Drawer editing: change source plate keeps well fields and only flags misfit; run-page drawer shows no grid and sends no tool.options request. Pending.
6. Dark mode legibility of ghost and bad wells. Pending.
7. Two 384-well grids in modal (side by side) and drawer (stacked) without form overflow; ModalContent maxW unchanged unless overflow is seen. Pending.
8. Plate list loads while a supervised Transfer runs (PLT-01 live). Pending.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prettier gate failure in a prior plan's file**
- **Found during:** Task 3 (phase gate)
- **Issue:** `controller/test/wire.test.ts` (touched by 07-05/07-08, not by this plan) failed `prettier --check`, which would fail the gate.
- **Fix:** `prettier --write`, formatting only (3 lines re-wrapped), no behaviour change.
- **Files modified:** controller/test/wire.test.ts
- **Commit:** c9c2970

**2. [Minor interpretation] "No Variable" choice on a well field in the modal**
- **Found during:** Task 1
- **Issue:** The plan says the modal's variable Select calls `handleVariableSelect(name, value)`. For the "" ("No Variable") choice that helper deletes the key, leaving the field to the save-time legacy fill-in; the existing local-binding branches write a blank instead.
- **Fix:** For "", the modal writes `wellFieldPatch(name, "")` (a blank), other choices call `handleVariableSelect` as planned. Matches the existing local-branch behaviour and the drawer spec.
- **Files modified:** controller/components/protocols/AddToolCommandModal.tsx

**Total deviations:** 2 (1 Rule 3 formatting fix, 1 minor interpretation). **Impact:** none on behaviour or scope.

## Known Stubs

None. No hardcoded empty data flows to UI; the well inputs are intentionally born empty (D-13).

## Issues Encountered

- Pre-existing, out of scope and not changed: the modal still fills untouched well fields via the legacy `fillMissingParams` number fill-in at save time (the six well fields are not in `NO_ZERO_FILL_FIELDS`). The plan scopes "born empty" to display; flagged here for UAT.
- The modal no longer shows the per-field "Variable: name" badge for well fields (they render inside the picker's Edit as fields section, which shows the reference in the disabled input).

## Threat Flags

None. No new network endpoints, auth paths or schema changes. T-07-25 to T-07-28 mitigations are in place: no effect hook in the picker, writes only via `onPatch`/`wellFieldPatch`, drawer mounts the picker only under `enabled={isEditing}`, one shared `fast.plates` read, no raw HTML (all pinned by the scan block).

## Next Phase Readiness

Code is complete and the gate is green. Remaining before phase sign-off: the eight UAT items above against a live or simulated F.A.S.T. on the frozen galago-tools commit (07-UAT.md).

## Self-Check: PASSED

- Commits `0c9d5d3`, `7ba89e1`, `c3ea24b`, `c9c2970` verified as ancestors of HEAD.
- Modified files exist; `grep -c "<FastTransferWellPicker"` is 1 in each of the three hosts.
