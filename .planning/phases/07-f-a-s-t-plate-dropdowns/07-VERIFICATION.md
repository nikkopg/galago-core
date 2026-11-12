---
phase: 07-f-a-s-t-plate-dropdowns
verified: 2026-11-12T10:30:00Z
status: gaps_found
score: 4/6 must-haves verified
covered_files:
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-01-PLAN.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-01-SUMMARY.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-02-PLAN.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-02-SUMMARY.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-03-PLAN.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-03-SUMMARY.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-04-PLAN.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-04-SUMMARY.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-05-PLAN.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-05-SUMMARY.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-06-PLAN.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-06-SUMMARY.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-07-PLAN.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-07-SUMMARY.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-08-PLAN.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-08-SUMMARY.md"
  - "controller/components/protocols/AddToolCommandModal.tsx"
  - "controller/components/protocols/CommandDetailsDrawer.tsx"
  - "controller/components/tools/OptionsSelect.tsx"
  - "controller/components/tools/StaticSelect.tsx"
  - "controller/components/tools/TipReuseCheckbox.tsx"
  - "controller/components/tools/WellPicker.tsx"
  - "controller/components/tools/commandParams.ts"
  - "controller/components/tools/fieldOptions.ts"
  - "controller/components/tools/wellGeometry.ts"
  - "controller/gen-interfaces/tools/grpc_interfaces/fast.ts"
  - "controller/pages/tools/[id].tsx"
  - "controller/server/toolOptions.ts"
covered_digest: "v3:sha256:4850daab0c5612c5ad2272394d0e76bac57e7ecc7bc7ba4ad09b4b781f045110"
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "Invalid plate ids are rejected or flagged and never truncated into a different plate (SC3 / PLT-04; 07-06 prohibition: a plate id MUST NOT be truncated, rounded or repaired into a different plate)"
    status: partial
    reason: "Registered-entry path (parsePlates) is correct, but the typed fallback (instrument unreachable) and the typed well-count/column path accept unbounded digit strings. applyChange and wellFieldPatch return Number(digits) with no upper bound; the generated protobuf int32 encoder wraps modulo 2^32. Reproduced against the real encoder in this verification: typing 4294967297 into source_plate_id gives params {source_plate_id: 4294967297}, which Command.encode/decode returns as 1 (plate 1). Not flagged anywhere (classifyWellValue and checkboxes do not bound it either). This is review finding CR-01, disposition still 'open'."
    artifacts:
      - path: "controller/components/tools/fieldOptions.ts"
        issue: "applyChange (role.kind === 'plate', kind === 'typed', ~line 674-678) and numericPatch (~line 393-396) return Number(digits) with no INT32 / safe-integer bound"
      - path: "controller/components/tools/wellGeometry.ts"
        issue: "wellFieldPatch (~line 178-182) same unbounded Number(digits) for source_start_col, dest_start_col, num_rows, num_cols; classifyWellValue/wholeFromOne does not flag a value above INT32_MAX"
    missing:
      - "Keep an out-of-range digit string (> 2147483647 or not a safe integer) verbatim instead of converting to Number, in applyChange (typed plate), numericPatch and wellFieldPatch"
      - "Flag it in classifyWellValue / the plate view and refuse (or clearly flag) it at send time so it can never reach Writer.int32 as a wrapped value"
      - "Add tests: typed '4294967297' never produces a number on the wire; boundary 2147483647 / 2147483648"
behavior_unverified_items:
  - truth: "SC5 / PLT-08: dragging on the source grid sets start row/col and block size; a click on the destination grid places the same-size footprint; the drag ends cleanly"
    test: "Open the F.A.S.T. transfer on the tool page and in AddToolCommandModal with two registered plates chosen. Drag a rectangle on the source grid, release outside the grid, then move back over the grid without a button pressed. Hover and click on the destination grid."
    expected: "Source fields follow the drag live and stop changing after release; no later hover rewrites them (review WR-01). Destination shows a dashed footprint (red when it does not fit) and a fitting click writes dest_start_row/col."
    why_human: "The pure geometry (dragRect, sourcePatch, destPatch, destClickPatch, buildWellPickerView; 136 tests) is verified, but the pointer-event shell in WellPicker.tsx (anchor ref, setPointerCapture, onPointerMove with no buttons check) has no jsdom/RTL test, so the drag state transition and its cleanup are present and wired but never exercised."
human_verification: []
---

# Phase 7: F.A.S.T. Plate Dropdowns Verification Report

**Phase Goal:** The operator picks F.A.S.T. Transfer `source_plate_id` and `dest_plate_id` from the plates the instrument has registered, picks decks and tip reuse from fixed lists, and drags the well block on a grid of the chosen plate.
**Verified:** 2026-11-12
**Status:** gaps_found
**Re-verification:** No, initial verification

## Goal Achievement

The feature is built and wired end to end in all three hosts, and the frozen galago-tools `get_plates` gate is satisfied. One reproduced defect (CR-01) means the typed-fallback path can still send a different plate than the operator typed, which contradicts the phase's own "never truncated" rule. Because that is a physical-robot parameter, it is recorded as a gap rather than a warning. The fix is small and localised.

### Observable Truths

| #   | Truth (ROADMAP success criterion) | Status | Evidence |
| --- | --------------------------------- | ------ | -------- |
| 1 | SC1 Gate: frozen galago-tools `get_plates` answers through `ExecuteCommand` mid-Transfer; submodule re-pinned with exact expected interface diff | VERIFIED | `vendor/galago-tools` HEAD is d53da5384f9f99d6751a5abfbbe0abbaa7a02389. `git diff 4ccd3da d53da53 -- '*.proto'` shows exactly `GetPlates get_plates = 11` plus `message GetPlates { optional bool refresh = 1; }`; `expected_tray_id = 13` untouched. `tools/fast/server.py:89` `READ_COMMANDS = frozenset({"get_plates"})`; `tools/tests/fast_test.py:899 test_get_plates_answers_while_a_transfer_holds_the_tool_busy` exists. `controller/gen-interfaces/.../fast.ts` has `Command_GetPlates` at oneof tag 90; `wire.test.ts` round-trips it. Server reply `{plates:[{id,description,rowCount,colCount,...}]}` (server.py:902-915) matches `parsePlates`. Caveat: the Python suite could not be run here (generated `tools.grpc_interfaces` missing), so the mid-Transfer proof is read-in-source plus the 07-05 record; `git branch -r --contains` printed nothing locally (no remote refs), so GitHub reachability rests on the orchestrator's statement. |
| 2 | SC2 Plate fields are dropdowns of registered plates (id and description, numeric id sent), starting empty | VERIFIED | `FIELD_BINDINGS.fast.transfer` binds `source_plate_id`/`dest_plate_id` to `fast.plates` (fieldOptions.ts:107). `plateOptions` labels via `plateLabel` ("12 · desc"), value `String(id)`; `buildSelectView` starts on the explicit empty option. `applyChange` select path writes a Number via `numericPatch`. `constants.ts` plate fields have no `defaultValue`. `fast.plates` served through closed `OPTION_SOURCES` (toolOptions.ts:367-372). 50 tests in fastFieldOptions.test.ts pass. |
| 3 | SC3 Invalid or duplicate plate ids are rejected or flagged, an unset plate never becomes 0, `get_plates` never a step or tool-page command | FAILED (partial) | Verified parts: `parsePlates` drops non-integer / <1 / >INT32_MAX ids and marks the list degraded (toolOptions.ts:308-312); duplicates flagged with `DUPLICATE_SUFFIX` (fieldOptions.ts plateOptions); `NO_ZERO_FILL_FIELDS` + `fillMissingParams` save an unset plate/deck as `""` (commandParams.ts, covered by commandParams.test.ts); `get_plates` appears in no `commandFields` and no client file (staticScan.test.ts:1145; grep confirms only server/toolOptions.ts names it). Failed part: the typed fallback and typed well numbers are unbounded (see gap CR-01); reproduced wrap 4294967297 -> plate 1. |
| 4 | SC4 Deck fields are dropdowns 1-6 starting empty; `tip_reuse` is a checkbox that starts checked (`reuse`, unchecked = `fresh`); no `get_plates` needed | VERIFIED | `DECK_SLOTS = 6` single constant, `deckBinding` for both decks (fieldOptions.ts); `StaticSelect.tsx` (47 lines) has no defaultValue / first-option selection (staticScan). `checkboxView` maps reuse/fresh exactly and flags blank/other as indeterminate without rewriting; `newStepDefaults` writes `tip_reuse: "reuse"` only at new-form init (tool page [id].tsx:132, modal AddToolCommandModal.tsx:170), never when a saved step opens. Wire value unchanged (`checked: "reuse"`, `unchecked: "fresh"`). Tests pass. |
| 5 | SC5 Well block drag on source grid / click on destination grid; collapsed "Edit as fields" that opens itself for hidden grid, `{{variable}}`, flagged value; stays in sync; misfit flagged, never clipped | PRESENT_BEHAVIOR_UNVERIFIED | Core logic VERIFIED by wellGeometry.test.ts (136 tests): `sourcePatch`, `destPatch`, `destClickPatch` (accepts only a fitting click), `forceOpen`, `statusLine` (exact PLT-08 copy), `CLEAR_PATCH` all `""`, `fitsAt` flags and never clips, `wellFieldPatch` keeps typed rows verbatim. `WellPicker.tsx` (454 lines) is substantive, built on `buildWellPickerView`, wired in the tool page, AddToolCommandModal and edit-mode CommandDetailsDrawer (read-only drawer mounts nothing and reads nothing), one `Edit as fields` Collapse with force-open. The pointer shell (anchor ref, capture, move/up/cancel) has no behavioral test; review WR-01 shows a path where the anchor stays set. See behavior_unverified_items. |
| 6 | SC6 Source and destination plates of different sizes (96 vs 384) flagged on the destination grid before the run | VERIFIED | `sizeMismatch` compares (rows, cols); `buildWellPickerView` sets `mismatch`, suppresses the footprint, sets `destClickable` false, caption without click hint; exact text "Plates differ in size (8×12 vs 16×24) — the F.A.S.T. refuses cross-format transfers (-9006)" pinned by wellGeometry.test.ts:158 and :816. Rendered in WellPicker `mismatchRow`; does not block saving. Visual rendering is a human item below. |

**Score:** 4/6 truths verified (1 failed-partial, 1 present but behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `controller/components/tools/wellGeometry.ts` | React-free geometry/view core | VERIFIED | 576 lines, pure, fully used by WellPicker and fieldOptions |
| `controller/components/tools/WellPicker.tsx` | Pointer-driven two-grid picker | VERIFIED (exists, substantive, wired); behavior unverified | 454 lines; imported by three hosts via `FastTransferWellPicker` |
| `controller/components/tools/StaticSelect.tsx` | Deck select | VERIFIED | Used in tool page, modal, drawer |
| `controller/components/tools/TipReuseCheckbox.tsx` | Reuse tips checkbox | VERIFIED | Used in tool page, modal, drawer |
| `controller/components/tools/fieldOptions.ts` | Bindings, plateOptions, patches, no-zero-fill, defaults | VERIFIED with gap | Unbounded typed numeric patches (CR-01) |
| `controller/server/toolOptions.ts` | `parsePlates`, `fast.plates` source | VERIFIED | Caps, int32 bound, degraded flag, closed registry |
| `controller/components/tools/commandParams.ts` | `fillMissingParams` no-zero-fill | VERIFIED | Plates and decks saved `""`; well fields still filled 0 (see Notes) |
| `controller/gen-interfaces/.../fast.ts` | Regenerated with GetPlates | VERIFIED | oneof tag 90, round-trip test |
| `vendor/galago-tools` gitlink | Pinned at frozen commit | VERIFIED | d53da53 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| tool page / modal / drawer | `FastTransferWellPicker` | anchor at first well field via `isWellGroupAnchor`; drawer only when `isEditing` | WIRED | grep + code read |
| `FastTransferWellPicker` | `fast.plates` read | `useToolOptions(toolId, "fast.plates", enabled)` shared query entry | WIRED | WellPicker.tsx:446 |
| `plateOptions` | `plateLabel` | shared label with grid caption | WIRED | fieldOptions.ts |
| hosts | `fillMissingParams` | modal `handleSubmit` line 237 | WIRED | |
| hosts | `newStepDefaults` | tool page 132, modal 170 | WIRED | |
| WellPicker onPatch | six well fields | host `handleWellPatch` functional merge | WIRED | tool page [id].tsx:292 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| plate selects, grids | `data.plates` | `tool.options` router -> `get_plates` over gRPC ExecuteCommand -> `parsePlates` | Yes (reply shape matches frozen server.py) | FLOWING (no live instrument was available, see human items) |
| deck select | `DECK_SLOT_OPTIONS` | in-code constant | Yes | FLOWING |
| well fields | form state | operator drag/click/typed via `onPatch` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Type check | `cd controller && npx tsc --noEmit` | exit 0 | PASS |
| Phase test files (9 files) | `npx vitest run` on wellGeometry, fastFieldOptions, commandParams, staticScan, toolOptions.parse/read/Router, wire, fieldOptions | 471 passed | PASS |
| Typed plate id wrap | throwaway vitest: `applyChange(plate, "4294967297", "typed")` then real `Command.encode`/`decode` | patch `4294967297` decodes as `source_plate_id: 1` | FAIL (confirms CR-01); probe file deleted |
| Typed `num_rows` | `wellFieldPatch("num_rows", "4294967298")` | `4294967298` unbounded number | FAIL (same defect) |
| galago-tools pytest `get_plates` | `python3 -m pytest tools/tests/fast_test.py -k GetPlates` | collection error: generated `tools.grpc_interfaces` not present | SKIP |

### Probe Execution

Step 7c: no probe scripts declared by any plan. SKIPPED.

### Requirements Coverage

All nine IDs appear in PLAN frontmatter and in REQUIREMENTS.md; none orphaned (REQUIREMENTS.md maps PLT-01..09 only to Phase 7 and all nine are claimed).

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PLT-01 | 07-05 | Frozen `get_plates` answers during Transfer, with a test | SATISFIED (source-read) | server.py READ_COMMANDS; fast_test.py TestGetPlatesOverGrpc; Python suite not run here |
| PLT-02 | 07-05 | Re-pin; diff exactly GetPlates + oneof 11; tag 13 unchanged | SATISFIED | proto diff above; fast.ts regen; wire.test.ts |
| PLT-03 | 07-06, 07-07, 07-08 | Pick plates from registered list; label id + description; numeric id | SATISFIED | plateOptions, applyChange select path, fast.plates source |
| PLT-04 | 07-03, 07-06, 07-08 | Reject non-integer-or-<1 entries, flag duplicates, unset never 0 | PARTIAL | Entries, duplicates, unset-as-blank satisfied; typed fallback can wrap to a different plate (CR-01) |
| PLT-05 | 07-03, 07-06 | `get_plates` never a step or tool-page command | SATISFIED | no commandFields key, static scans, grep |
| PLT-06 | 07-01, 07-03 | Deck dropdowns 1-6, start empty, saved value kept | SATISFIED | StaticSelect, buildStaticView, tests |
| PLT-07 | 07-01, 07-03 | Reuse tips checkbox, new step checked, saved values kept/flagged | SATISFIED (see WR-03) | checkboxView, newStepDefaults |
| PLT-08 | 07-02, 07-04, 07-07 | Two grids, drag source, click-place destination, status line, Edit as fields, Clear | SATISFIED in logic; pointer shell unexercised | wellGeometry tests; WellPicker.tsx |
| PLT-09 | 07-02, 07-04, 07-07 | Misfit flagged never clipped; size-mismatch warning; hidden grid fallback | SATISFIED | fitsAt, mismatchText, plateGridSide hidden causes |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| fieldOptions.ts | ~393, ~674 | `Number(digits)` with no int32 bound | BLOCKER | CR-01: typed plate id wraps to a different plate on the wire |
| wellGeometry.ts | ~178 | same unbounded numeric patch for col/rows/cols | BLOCKER (same root cause) | Typed 4294967298 num_rows wraps to 2 |
| WellPicker.tsx | 304-331 | drag anchor kept when capture refused; `onPointerMove` ignores `e.buttons` | Warning (WR-01) | Selection can be rewritten by a later hover |
| WellPicker.tsx / wellGeometry.ts | 304-309 / 147-154 | source drag overwrites `{{variable}}` in well fields, clamped hit-test turns header clicks into patches | Warning (WR-02) | Silent loss of a variable binding in modal/drawer |
| AddToolCommandModal.tsx / CommandDetailsDrawer.tsx | ~340-350 | "No Variable" on `tip_reuse` writes `""`, shown as flagged blank, `reuse` default not restored | Warning (WR-03) | Matches the PLT-07 "blank is kept and flagged" rule, but poor UX; sends `tip_reuse: ""` unless the operator clicks |
| AddToolCommandModal.tsx | 628-655 | unreachable no-zero-fill NumberInput branch | Info (IN-01) | dead code |
| staticScan.test.ts | 1096-1273 | regex-over-source proxies; no render test for WellPicker | Info (IN-02) | why CR-01 and WR-01 were not caught |

Debt-marker scan (`TBD|FIXME|XXX`) over all phase-modified source files: none.

Weighing of review findings against must-haves:
- CR-01 defeats the PLT-04 / SC3 "never truncated" must-have on the typed path. Reproduced. Gap.
- WR-01 does not fail a stated truth but is why the drag truth cannot be marked VERIFIED without a behavioral test.
- WR-02 and WR-03 do not defeat any must-have as written (PLT-08 says the section opens for a variable, not that the grid is inert; PLT-07 says a blank is kept and flagged). They are quality warnings worth triage.
- All six review items still have disposition `open` in 07-REVIEW-DISPOSITION.md.

### Human Verification Required

Recorded here for the end-of-phase UAT; the overall status is gaps_found, so these are not in the frontmatter `human_verification` list. None of this was observed: no live or simulated F.A.S.T. was available (fast-mcp failed to connect).

1. **Deck selects and Reuse tips checkbox render** — Test: open a new F.A.S.T. transfer on the tool page and in the protocol modal. Expected: both decks start on the blank option and list 1-6; Reuse tips is checked; unchecking sends `fresh`; a saved `fresh` loads unchecked; a saved blank/odd value shows indeterminate with its flag. Why human: visual rendering.
2. **Plate dropdown against a live instrument** — Test: with F.A.S.T. connected, open a transfer, pick plates. Expected: "{id} · {description}" labels, blank start, duplicate flag, list loads while a Transfer is running (PLT-01 live). Why human: needs real instrument and real timing.
3. **WellPicker feel** — Test: drag on the source grid, release outside it, hover back; hover/click the destination. Expected: see behavior_unverified_items. Also dark mode legibility of ghost/bad wells.
4. **384-well layout** — Test: choose two 384 plates in the 900px AddToolCommandModal and in the drawer. Expected: grids side by side in the modal, stacked in the drawer, each scrolling inside its own box with no form overflow.
5. **Size mismatch** — Test: choose an 8x12 and a 16x24 plate. Expected: destination shows the -9006 warning, no footprint, clicks do nothing, saving still works.
6. **Instrument unreachable** — Test: stop the tool server. Expected: plate fields become numeric typed inputs with the hint, grids hidden, "Edit as fields" forced open with "Kept open: a plate grid is unavailable".

### Gaps Summary

One gap, with a small fix:

1. **CR-01 typed-path int32 wrap (PLT-04 / SC3).** `numericPatch`, the typed plate branch of `applyChange`, and `wellFieldPatch` convert any all-digit string to `Number` with no upper bound. The generated encoder wraps it, so a pasted or over-long id such as 4294967297 silently selects plate 1. Fix: keep an out-of-range digit string verbatim (not a number), flag it in `classifyWellValue`, and refuse or flag it at send time; add boundary tests at 2147483647 and 2147483648.

Notes that do not change the verdict:
- The six well fields are not in `NO_ZERO_FILL_FIELDS`, so the modal's save-time `fillMissingParams` still saves untouched `source_start_col`, `num_rows`, `num_cols`, `dest_start_col` as `0`. `isBlankWell` treats a numeric 0 as blank so the grid shows nothing selected, and PLT-04 only mandates plates and decks. This is a conscious legacy accommodation, recorded for awareness.
- Recommend adding a jsdom/RTL test for the WellPicker pointer sequence (IN-02) when fixing WR-01; that would also turn truth 5 from behavior-unverified into verified.

---

_Verified: 2026-11-12T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
