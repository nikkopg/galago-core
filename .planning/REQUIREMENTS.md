# Requirements: galago-core v1.2: Tool-inferred dropdowns + per-tool concurrency lanes

**Defined:** 2026-11-05
**Core Value:** While an instrument step runs, the operator sees what the instrument is doing and
decides every recovery action themselves. The web app never pauses, resumes or aborts an instrument
on its own, and never preselects a physical decision for the operator.
**Research:** `.planning/research/SUMMARY.md` (decisions D1-D12)

## v1.2 Requirements

### Dropdown behaviour (DRP), shared by every instrument-fed field

- [x] **DRP-01**: The operator sees a dropdown of instrument-reported values for each bound field.
  Each dropdown starts empty. Nothing is preselected, not even when only one option exists.
- [x] **DRP-02**: When the operator opens a saved step whose value the instrument no longer reports,
  the value stays selected, marked "(not reported by instrument)". It is never cleared or rewritten.
- [x] **DRP-03**: In the protocol editor the operator can still bind any dropdown field to a
  `{{variable}}`. A bound parent field turns its child fields into typed inputs.
- [x] **DRP-04**: When the instrument can't be reached, or the read fails or returns no data, the
  operator gets the plain typed input with an "instrument list unavailable" hint. A stale list is
  never shown.
- [x] **DRP-05**: Changing a parent field (device → deck → nest) clears its child fields. Loading
  options never clears a saved value.
- [x] **DRP-06**: The operator can press Refresh on a list to re-read it from the instrument
  (`refresh: true`). Refreshing never clears a selection.
- [x] **DRP-07**: Lists are read through one closed server registry of sources, using the instance
  `Tool.executeCommand` with a deadline. They never go through the command queue, and are never
  polled or retried automatically. Every reply is validated and size-capped. Instrument names that
  look like `{{x}}` are never substituted.
- [x] **DRP-08**: The same dropdowns appear when the operator edits a saved step in the step
  details drawer. The drawer reads lists only while it is in edit mode.
- [x] **DRP-09**: What is sent stays the same: the selected value is the same string or number the
  operator would have typed, so existing saved protocols load and run unchanged.

### STACK fields (STK)

- [x] **STK-01**: The operator picks `robot` from the robots the STACK manager reports
  (`get_robot_states`).
- [x] **STK-02**: The operator picks source and destination device → deck → nest from the manager's
  device tree (`list_devices`). Source and destination each have their own cascade. The values sent
  are `deviceName`/`deckName`/`nestName`, never `unifiedName`.
- [x] **STK-03**: Only calibrated decks and nests (`isCalibrated: true`) are offered. Uncalibrated
  ones are hidden, matching the manager's own refusal (stack-automation-layer `errors.py:185-191`).
  A saved uncalibrated deck or nest is kept as in DRP-02.
- [x] **STK-04**: Location names the manager reports as ambiguous are shown and flagged. They are
  never merged or silently resolved.
- [x] **STK-05**: The operator picks `labware_profile` from `list_labware_profiles`. It is never
  preselected or inferred.
- [x] **STK-06**: The operator picks source and destination transfer profiles from
  `list_transfer_profiles`.
- [x] **STK-07**: Dropdowns cover every STACK command that takes these fields (`transfer`,
  `get_transfer_estimate`, `get_labware_presence`). `step_key` and `timeout_s` stay typed inputs.
- [x] **STK-08**: `vendor/galago-tools` is pinned by SHA to `4ccd3da`, and the regenerated
  interfaces (ts-proto 1.151.1) show no diff.

### F.A.S.T. plates (PLT)

- [x] **PLT-01**: galago-tools ships a frozen `get_plates` read that answers while a Transfer is
  running. A test calls it through `ExecuteCommand` during a transfer. This is a cross-repo
  precondition (contract: `research/FAST-GET-PLATES-CONTRACT.md`).
- [x] **PLT-02**: `vendor/galago-tools` is re-pinned to that frozen commit. The interface diff is
  exactly `GetPlates` plus oneof entry 11, and `Transfer.expected_tray_id = 13` is unchanged.
- [x] **PLT-03**: The operator picks `source_plate_id` and `dest_plate_id` from the registered
  plates. The label shows the id and description, and the value is the numeric id.
- [x] **PLT-04**: Plate entries whose id is not an integer ≥ 1 are rejected, never truncated.
  Duplicate ids are flagged. An unset plate is never saved as `0`.
- [x] **PLT-05**: `get_plates` never appears as a protocol step or a tool-page command.
- [x] **PLT-06**: `source_deck` and `dest_deck` are dropdowns of deck slots 1-6 (the tool server's
  `_DECK_SLOTS`). They start empty, a saved value is kept verbatim, and this needs no `get_plates`.
- [x] **PLT-07**: `tip_reuse` is a "Reuse tips" checkbox: checked sends `reuse`, unchecked sends
  `fresh`. A new step starts checked (`reuse`) — a deliberate user decision (2026-11-06), the one
  default allowed on a Transfer field. The wire stays the same string, so saved protocols load
  unchanged: a saved `fresh` shows unchecked, and a saved blank or other value is kept verbatim and
  flagged, never rewritten by the checkbox.
- [x] **PLT-08**: The well block is picked on two plate grids, source and destination, each sized
  from its chosen plate's `rowCount` x `colCount`. The approved reference is
  `research/PLT-08-WELL-PICKER-MOCKUP.html` (user, 2026-11-06):
  - **Source grid:** the operator drags a rectangle. It sets `source_start_row`, `source_start_col`,
    `num_rows` and `num_cols`.
  - **Destination grid:** no drag, because the block size is shared. Hovering shows a dashed
    footprint of the same size (red when it would not fit), and a click places it, setting
    `dest_start_row` and `dest_start_col`.
  - A status line says what is selected ("Nothing selected", "N wells selected. Now place them on the
    destination.", "Transfer N wells: B3 -> C5").
  - The six typed fields sit below the grids in a collapsed "Edit as fields" section, stay editable,
    and sync both ways. The section opens on its own when the grid is hidden (PLT-09), when any of
    the six fields holds a `{{variable}}` (the grid cannot show one), or when a value is flagged.
    Clear selection empties both grids and all six fields.
  - Nothing is selected at start. Keyboard use goes through the typed fields, so the grid itself
    needs no keyboard navigation.
- [x] **PLT-09**: A block that does not fit the chosen plate (start or extent past `rowCount` /
  `colCount`), or a saved row label the grid cannot show, is flagged and never clipped or rewritten.
  When the source and destination plates differ in size (for example 8x12 vs 16x24), the destination
  grid shows a size-mismatch warning instead of a footprint, because fast-mcp `build_transfer` refuses
  it at run time (`-9006 LocalCrossFormatUnsupported`). The warning does not block saving, and the
  tool server stays the final check. With no plate chosen, the instrument unreachable or an unknown
  plate, the grid is hidden and the typed fields still work.

### Lane engine (LAN)

- [x] **LAN-01**: With the lane-mode env var off, the queue behaves byte-identically to today. A
  golden transcript captured before the change proves it, and every existing test passes unedited.
- [x] **LAN-02**: With lanes on, a step tagged with a lane can run while another tool's step is
  running. At most one step per tool server is in flight.
- [x] **LAN-03**: A step can declare a barrier or dependency on steps in another lane, and won't
  start until they finish. An untagged step waits for everything before it, as today.
- [x] **LAN-04**: Each lane has its own single-flight Start guard. A Start never dispatches a row
  that is already in flight (the F5 guarantee, per lane).
- [x] **LAN-05**: When any step on any lane fails, new dispatch stops on every lane. Steps already
  running are never aborted, and only the operator's Start clears the halt.
- [x] **LAN-06**: A modal on the primary lane (a form, a prompt or a pause) stops new dispatch on
  every lane. Non-tool steps run on the primary lane only.
- [x] **LAN-07**: Pause, resume and abort still reach a running F.A.S.T. on whatever lane it is on,
  and the run-state poller is never stopped by another lane's step. Abort markers and failed
  attempts are tracked per step.
- [x] **LAN-08**: Stop, Clear All and run delete still abort first for every controllable running
  step, whatever its lane.
- [ ] **LAN-09**: The operator can freeze lanes: one control that stops new dispatch on every lane,
  for example after a tool-initiated pause. Nothing is aborted.

### Lane protocol surface and run page (LUI)

- [ ] **LUI-01**: In the visual protocol editor the operator can tag a tool step with a lane and a
  barrier or dependency.
- [ ] **LUI-02**: A script protocol can tag steps with `galago.lane(...)` and declare dependencies.
- [x] **LUI-03**: Run creation refuses invalid lane setups with a clear error: a cycle, a non-tool
  step on a secondary lane, or one tool on two lanes.
- [ ] **LUI-04**: The preview and the Start confirmation list the steps per lane.
- [ ] **LUI-05**: The run page shows each lane's steps in order, with their own statuses and
  timestamps, and the run outcome takes every lane into account.
- [ ] **LUI-06**: The error banner lists each lane's failure. The first failure keeps the STACK
  guid the operator needs.

### Live proof (LIV)

- [ ] **LIV-01**: A supervised live two-tool run shows a STACK step overlapping the F.A.S.T.
  transfer, with per-lane evidence rows. Explicit step keys are used, and the galago-tools SHA and
  auto-mint status are recorded. The STACK step itself is decided in Phase 9's discussion.
- [ ] **LIV-02**: Lane-halt and freeze-lanes are shown in a drill that freezes both lanes, using a
  fake or simulated failure. No automated motion.
- [ ] **LIV-03**: PROJECT.md and the lanes todo record the resolution. The galago-tools operator
  runbook gains the parallel cycle only after LIV-01.

## Future Requirements

- Option-label context: robot state, labware has-lid, plate size and capacity.
- Cross-format F.A.S.T. transfers (96 <-> 384): needs fast-mcp to add multi-pass, pitch-aware
  authoring first (deferred in its Phase 2b spec). The destination picker would then choose a
  quadrant (A1 / A2 / B1 / B2) instead of a start well.
- Lane timeline visualisation.
- Disabling, rather than only flagging, ambiguous locations.

## Out of Scope

| Feature | Reason |
|---|---|
| Preselecting any physical value (labware, nest, plate) | Core value: the operator picks every physical choice |
| Rewriting or migrating saved protocols | Saved values are kept verbatim (DRP-02, DRP-09) |
| Polling, or showing stale lists while offline | It would mislead the operator. The typed fallback is safer |
| Software abort of a sibling lane | Only the operator aborts. Lane-halt only stops new dispatch |
| Auto-advance, auto-retry or auto-skip on failure | Core value |
| Parallel lanes by default, or across runs | The flag is opt-in, and lanes work within one run only |
| A general DAG scheduler | Lanes plus barriers and dependencies cover the workcell cycle |
| Repurposing `advancedParameters.runAsynchronously` | It is stored as `false` on every saved row (D1) |
| `stack.proto` changes | Frozen in galago-tools |
| New npm dependencies | Existing packages cover every need (STACK.md) |

## Traceability

Each v1.2 requirement maps to exactly one phase. The shared DRP-* dropdown layer is built in Phase 6;
Phase 7 reuses it for F.A.S.T. plates and owns only PLT-*. Phase 8 delivers the lane engine first, then
the protocol surface and run page, as waves inside one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DRP-01 | Phase 6 | Complete |
| DRP-02 | Phase 6 | Complete |
| DRP-03 | Phase 6 | Complete |
| DRP-04 | Phase 6 | Complete |
| DRP-05 | Phase 6 | Complete |
| DRP-06 | Phase 6 | Complete |
| DRP-07 | Phase 6 | Complete |
| DRP-08 | Phase 6 | Complete |
| DRP-09 | Phase 6 | Complete |
| STK-01 | Phase 6 | Complete |
| STK-02 | Phase 6 | Complete |
| STK-03 | Phase 6 | Complete |
| STK-04 | Phase 6 | Complete |
| STK-05 | Phase 6 | Complete |
| STK-06 | Phase 6 | Complete |
| STK-07 | Phase 6 | Complete |
| STK-08 | Phase 6 | Complete |
| PLT-01 | Phase 7 | Complete |
| PLT-02 | Phase 7 | Complete |
| PLT-03 | Phase 7 | Complete |
| PLT-04 | Phase 7 | Complete |
| PLT-05 | Phase 7 | Complete |
| PLT-06 | Phase 7 | Complete |
| PLT-07 | Phase 7 | Complete |
| PLT-08 | Phase 7 | Complete |
| PLT-09 | Phase 7 | Complete |
| LAN-01 | Phase 8 | Complete |
| LAN-02 | Phase 8 | Complete |
| LAN-03 | Phase 8 | Complete |
| LAN-04 | Phase 8 | Complete |
| LAN-05 | Phase 8 | Complete |
| LAN-06 | Phase 8 | Complete |
| LAN-07 | Phase 8 | Complete |
| LAN-08 | Phase 8 | Complete |
| LAN-09 | Phase 8 | Pending |
| LUI-01 | Phase 8 | Pending |
| LUI-02 | Phase 8 | Pending |
| LUI-03 | Phase 8 | Complete |
| LUI-04 | Phase 8 | Pending |
| LUI-05 | Phase 8 | Pending |
| LUI-06 | Phase 8 | Pending |
| LIV-01 | Phase 9 | Pending |
| LIV-02 | Phase 9 | Pending |
| LIV-03 | Phase 9 | Pending |

**Coverage:**
- v1.2 requirements: 44 total
- Mapped to phases: 40 (Phase 6: 17, Phase 7: 5, Phase 8: 15, Phase 9: 3)
- Unmapped: 0
- Duplicates: 0

---
*Requirements defined: 2026-11-05*
*Last updated: 2026-11-05 after roadmap simplification (traceability filled, Phases 6-9)*
