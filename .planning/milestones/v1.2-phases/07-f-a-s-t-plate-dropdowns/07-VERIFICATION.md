---
phase: 07-f-a-s-t-plate-dropdowns
verified: 2026-11-13T08:10:00Z
status: passed
score: 6/6 must-haves verified
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
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-09-PLAN.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-09-SUMMARY.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-10-PLAN.md"
  - ".planning/phases/07-f-a-s-t-plate-dropdowns/07-10-SUMMARY.md"
  - "controller/components/protocols/AddToolCommandModal.tsx"
  - "controller/components/protocols/CommandDetailsDrawer.tsx"
  - "controller/components/tools/OptionsSelect.tsx"
  - "controller/components/tools/StaticSelect.tsx"
  - "controller/components/tools/TipReuseCheckbox.tsx"
  - "controller/components/tools/WellPicker.tsx"
  - "controller/components/tools/commandParams.ts"
  - "controller/components/tools/fieldOptions.ts"
  - "controller/components/tools/wellGeometry.ts"
  - "controller/components/tools/wellPointer.ts"
  - "controller/gen-interfaces/tools/grpc_interfaces/fast.ts"
  - "controller/pages/tools/[id].tsx"
  - "controller/server/toolOptions.ts"
  - "controller/server/tools.ts"
  - "controller/utils/int32.ts"
covered_digest: "v3:sha256:456ef3a6a2a350fb09f1043ce99f4e2c94382086748330ae381bfab4e804118a"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  gaps_closed:
    - "SC3 / PLT-04: typed plate id / well number wrapped modulo 2^32 into a different value (CR-01), closed by 07-09"
    - "SC5 / PLT-08: source-grid drag state and cleanup unexercised (WR-01), closed by 07-10 (pure reducer plus node tests)"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-04: the int32 refusal is applied only in Tool#executeCommand (send time). There is no enqueue-time scan in runs.ts createFromProtocol, so a saved step with a literal out-of-range id fails mid-run after earlier steps have run. Tool#estimateDuration still encodes raw, unsubstituted params, so the duration estimate can be asked for the wrapped value (an estimate, not a motion)."
    category: other
    reason: "Not required by PLT-04 or SC3 as written (the value is kept as text, flagged in the UI, and never reaches a motion command as a different value). Recommended hardening: scan literal values at enqueue and skip the estimate on a problem."
    evidence_status: "07-REVIEW.md WR-04, confirmed by reading server/tools.ts 442-506 and 680-682"
human_verification:
  - test: "Source-grid drag in a real browser, in all three hosts (tool page, AddToolCommandModal, edit-mode CommandDetailsDrawer)"
    expected: "With two registered 8x12 plates chosen: press B3, drag to D5, leave the grid past its right edge, return and release; the four source fields follow live and stop on release. Press B3, drag to C4, leave, release outside, hover back with no button: the four fields never change. Right-click a source well: nothing is written."
    why_human: "The decision logic is the pure sourcePointerStep (17 node tests). Real pointer capture, the browser's buttons value and the release-outside path cannot be produced under node-only vitest, and WellPicker.tsx has no render test."
  - test: "Plate dropdown against a live F.A.S.T. instrument, including while a Transfer is running"
    expected: "Labels read '{id} · {description}', start blank, a duplicate id is flagged, the list loads mid-Transfer (PLT-01 live)."
    why_human: "Needs a real or simulated instrument. fast-mcp was not connectable in either verification run, and the galago-tools Python suite could not be run here (generated tools.grpc_interfaces missing)."
  - test: "Deck selects and Reuse tips checkbox render; 384-well layout; size-mismatch warning; instrument-unreachable fallback; dark-mode legibility"
    expected: "Decks start blank and list 1-6; Reuse tips starts checked on a new step, unchecked sends fresh, saved blank shows indeterminate with a flag. Two 384 plates scroll inside their own boxes (side by side in the modal, stacked in the drawer). 8x12 vs 16x24 shows the -9006 warning with no footprint and saving still works. With the tool server stopped, plate fields become typed numeric inputs, the grids are hidden and 'Edit as fields' opens itself."
    why_human: "Visual rendering and layout."
  - test: "Typed out-of-range plate id in the UI"
    expected: "Typing 4294967297 into a plate field (instrument unreachable) keeps the digits, shows the 'larger than 2147483647 or not a whole number' flag, and a run that reaches the step fails with the int32 refusal and sends nothing."
    why_human: "End-to-end UI plus run path; logic and send guard are unit-tested."
---

# Phase 7: F.A.S.T. Plate Dropdowns Verification Report

**Phase Goal:** The operator picks F.A.S.T. Transfer `source_plate_id` and `dest_plate_id` from the plates the instrument has registered, picks decks and tip reuse from fixed lists, and drags the well block on a grid of the chosen plate.
**Verified:** 2026-11-13
**Status:** human_needed
**Re-verification:** Yes, after gap closure (07-09, 07-10)

## Goal Achievement

Both previously failed items are closed in the code, and the six previously verified truths still hold. No gap remains. The status is `human_needed` rather than `passed` because the remaining checks (real pointer drag in a browser, rendering and layout, a live instrument) cannot be produced by grep or node vitest.

### Re-verification of the two gaps

**Gap 1, CR-01 (typed plate id / well number wraps modulo 2^32): CLOSED.**
- `controller/utils/int32.ts` (new, no imports): `int32FromDigits` returns a number only when at most 2147483647, else the digit string unchanged. `isExactInt32` rejects out-of-range, fractions, hex, whitespace, signs and booleans.
- All three previously unbounded producers now use it: `numericPatch` (fieldOptions.ts:405), the typed branch of `applyChange` (fieldOptions.ts:690), `wellFieldPatch` (wellGeometry.ts:183). Very long digit strings give `Infinity` and are kept as text.
- Flagging: `buildSelectView` path sets `plateIdFlag` for a non-exact plate id (fieldOptions.ts:771-779); `classifyWellValue` returns `too-large` (wellGeometry.ts:219-274).
- Refusal: `Tool#executeCommand` (server/tools.ts:490-506) runs `int32ParamProblems` on the substituted params before any gRPC, throws `ToolCommandExecutionError(INVALID_ARGUMENTS)`, and logs field names only. A `{{var}}` that resolves to an oversize value is refused too (int32.test.ts:368).
- Table of nine int32 fields is pinned to the generated `Command_Transfer` encoder (int32.test.ts:333). wire.test.ts:96-119 proves against the real encoder that the number 4294967297 still decodes as plate 1, and that `applyChange(plate, "4294967297", "typed")` now returns the text `"4294967297"`, never a number.
- Residual: WR-04 (see Advisory). It does not reopen the gap: no different value is ever sent on a motion command.

**Gap 2, WR-01 / SC5 unexercised drag shell: CLOSED at the logic level.**
- `controller/components/tools/wellPointer.ts` (new, only imports wellGeometry): `sourcePointerStep` ends the drag on a move with the primary bit clear, on up, cancel, lost capture and an uncaptured leave; writes a patch only while the primary button is held; never mutates input.
- `WellPicker.tsx` has one drag ref and `stepSource`; all six events plus `onPointerLeave` forward `e.button`, `e.buttons`, the cell and the capture result (lines 236-327). The old anchor ref and `onPointerMove`-without-buttons path are gone (grep for `anchor.current` / `lastRect` returns nothing).
- 17 node sequence tests in `test/wellPointer.test.ts` cover down (primary, secondary, no cell), distinct-rectangle writes, WR-01 with capture refused and held, leave with and without capture, up/cancel/lost-capture, idle no-ops, and a whole gesture producing exactly three patches. Three scans in staticScan.test.ts pin the delegation.
- What stays unproven by an automated test: the React shell glue (capture call, event wiring) and real browser pointer behavior. That is carried as human item 1.

### Observable Truths

| #   | Truth (ROADMAP success criterion) | Status | Evidence |
| --- | --------------------------------- | ------ | -------- |
| 1 | SC1 Gate: frozen galago-tools `get_plates` answers through `ExecuteCommand` mid-Transfer; submodule re-pinned with exact interface diff | VERIFIED (regression check) | `vendor/galago-tools` still at d53da5384f9f99d6751a5abfbbe0abbaa7a02389 (`git submodule status`). Earlier verification: proto diff is exactly `GetPlates` plus oneof 11, tag 13 untouched; `READ_COMMANDS` and `test_get_plates_answers_while_a_transfer_holds_the_tool_busy` present in server.py / fast_test.py. `fast.ts` untouched by 07-09/07-10. The Python suite was not run here (see human item 2). |
| 2 | SC2 Plate fields are dropdowns of registered plates (id and description, numeric id sent), starting empty | VERIFIED (regression check) | `FIELD_BINDINGS.fast.transfer` binds both plate fields to `fast.plates`; select path of `applyChange` goes through `numericPatch`, which now keeps in-range ids as numbers and is unchanged for them. Tests in fastFieldOptions.test.ts pass. |
| 3 | SC3 Invalid or duplicate plate ids rejected or flagged, unset plate never 0, `get_plates` never a step or tool-page command | VERIFIED (was FAILED) | CR-01 closed as above. `parsePlates` drops non-integer / <1 / >INT32_MAX; duplicates flagged; `NO_ZERO_FILL_FIELDS` (fieldOptions.ts:489) keeps unset plate/deck as `""`; no client file names `get_plates` (grep over components and pages returns only fieldOptions comments/bindings to `fast.plates`). |
| 4 | SC4 Deck fields are dropdowns 1-6 starting empty; `tip_reuse` checkbox starts checked (`reuse`/`fresh`) | VERIFIED (regression check) | StaticSelect, TipReuseCheckbox and `newStepDefaults` unchanged since the previous verification; commandParams tests pass. |
| 5 | SC5 Well block drag on source grid / click on destination; collapsed "Edit as fields"; sync; misfit flagged never clipped | VERIFIED at logic level (was PRESENT_BEHAVIOR_UNVERIFIED); real-browser check is human item 1 | Drag state transitions and cleanup now exercised by `wellPointer.test.ts`; geometry by wellGeometry.test.ts (typed values now also bounded). Shell wired in all three hosts. |
| 6 | SC6 Different-size plates (96 vs 384) flagged on the destination grid before the run | VERIFIED (regression check) | `sizeMismatch` / mismatch text pinned by wellGeometry tests; WellPicker `mismatchRow` renders it and `destClickable` is false. |

**Score:** 6/6 truths verified, 0 present-but-behavior-unverified.

Reliance check (Step 5c): no truth rests on an undeclared precondition, incidental ordering or a fixture-only setup; none flagged.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `controller/utils/int32.ts` | int32 exactness rules and field table | VERIFIED | 100 lines, zero imports, used by fieldOptions, wellGeometry and server/tools.ts |
| `controller/components/tools/wellPointer.ts` | pure drag reducer | VERIFIED | 63 lines, used by WellPicker; imports neither React nor Chakra |
| `controller/components/tools/WellPicker.tsx` | thin pointer shell | VERIFIED | delegates all source events to `sourcePointerStep` |
| `controller/components/tools/fieldOptions.ts`, `wellGeometry.ts` | bounded patches and flags | VERIFIED | CR-01 fix in place |
| `controller/server/tools.ts` | send-time guard | VERIFIED | lines 490-506 |
| Remaining artifacts from the previous report | StaticSelect, TipReuseCheckbox, toolOptions, commandParams, fast.ts, vendor pin | VERIFIED (regression) | present and unchanged in substance |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `WellPicker` source grid | `sourcePointerStep` | `stepSource` forwarding six events | WIRED | WellPicker.tsx:250-327 |
| typed/select plate and well edits | `int32FromDigits` | `applyChange`, `numericPatch`, `wellFieldPatch` | WIRED | fieldOptions.ts:405,690; wellGeometry.ts:183 |
| non-exact plate id | UI flag | `buildSelectView` plate branch, `OptionsSelect` | WIRED | fieldOptions.ts:771 |
| `Tool#executeCommand` | `int32ParamProblems` | after variable substitution, before gRPC | WIRED | server/tools.ts:495 |
| protocol runner | `Tool.executeCommand` | `command_queue.ts:512` | WIRED | all queue steps pass through the guard |
| hosts / `fast.plates` / `FastTransferWellPicker` / `fillMissingParams` / `newStepDefaults` | as before | | WIRED (regression) | unchanged |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| plate selects, grids | `data.plates` | `tool.options` router, `get_plates` over gRPC, `parsePlates` | Yes by reply-shape match with frozen server.py | FLOWING (no live instrument available) |
| source/dest well fields | form state | drag reducer, click, typed edits via `onPatch` | Yes | FLOWING |
| wire params | substituted `command.params` | guarded in `executeCommand` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Type check | `cd controller && npx tsc --noEmit` | exit 0 | PASS |
| Full suite (run once) | `cd controller && npx vitest run` | 37 files, 1094 tests passed | PASS |
| Encoder wrap still real, typed path now text | wire.test.ts:96-119 (in the full run) | 4294967297 number decodes as 1; typed path yields `"4294967297"` | PASS |
| Send guard refuses before gRPC | int32.test.ts:207-300, 368-398 (in the full run) | oversize: 0 gRPC calls, audit row; exact: 1 call | PASS |
| Drag reducer sequences | wellPointer.test.ts (17 tests, in the full run) | pass | PASS |

### Probe Execution

No probe scripts declared by any plan. SKIPPED.

### Requirements Coverage

All nine IDs are claimed by PLAN frontmatter (07-01..07-09 and 07-10) and listed in REQUIREMENTS.md; none orphaned. 07-10 claims PLT-08, 07-09 claims PLT-04.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PLT-01 | 07-05 | Frozen `get_plates` answers during Transfer, with a test | SATISFIED (source-read; live run is human item 2) | server.py READ_COMMANDS, fast_test.py test |
| PLT-02 | 07-05 | Re-pin; diff exactly GetPlates + oneof 11; tag 13 unchanged | SATISFIED | submodule at d53da53, proto diff, wire.test.ts |
| PLT-03 | 07-06, 07-07, 07-08 | Pick plates from registered list; id + description; numeric id | SATISFIED | plateOptions, applyChange select path |
| PLT-04 | 07-03, 07-06, 07-08, 07-09 | Non-integer or <1 rejected, never truncated; duplicates flagged; unset never 0 | SATISFIED (was PARTIAL) | parsePlates, bounded typed path, plate flag, send-time refusal, no-zero-fill |
| PLT-05 | 07-03, 07-06 | `get_plates` never a step or tool-page command | SATISFIED | no commandFields key; static scans |
| PLT-06 | 07-01, 07-03 | Deck dropdowns 1-6, start empty, saved value kept | SATISFIED | StaticSelect, buildStaticView |
| PLT-07 | 07-01, 07-03 | Reuse tips checkbox | SATISFIED (see WR-03 warning) | checkboxView, newStepDefaults |
| PLT-08 | 07-02, 07-04, 07-07, 07-10 | Two grids, drag source, click-place destination, status line, Edit as fields, Clear | SATISFIED in code; real-browser pointer check is human item 1 | wellGeometry + wellPointer tests, WellPicker |
| PLT-09 | 07-02, 07-04, 07-07 | Misfit flagged never clipped; size mismatch; hidden-grid fallback | SATISFIED | fitsAt, mismatch text, forced-open |

**REQUIREMENTS.md checkbox review (commit c095b56 reverted premature marks; executors re-marked two):**
- PLT-04 `[x] / Complete`: justified by the code. The only reason it was reverted (typed fallback wrap) is fixed and tested; the rest of the requirement was already satisfied.
- PLT-08 `[x] / Complete`: justified at code level. The state-transition gap is closed by the node-tested reducer. The one caveat is that actual browser pointer behavior is still a human check, but PLT-08 as written is about what the grids set and how the fields sync, which the geometry and reducer tests pin. Acceptable to leave Complete; if the project wants requirements Complete only after UAT, flip both back until human item 1 passes.
- PLT-01, 02, 03, 05, 06, 07, 09 are still `[ ] / Gaps Found` from the revert. The code satisfies all of them (table above), so they are now stale and should be set to Complete when the phase closes (after UAT, per the human items). This is a bookkeeping change for the orchestrator, not a code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| server/tools.ts / runs.ts | 490-506 / 215-266 / 680 | int32 refusal only at execute time; `estimateDuration` unguarded (WR-04) | Warning (advisory) | Mid-run failure for a literal bad id; estimate may be asked for the wrapped value |
| WellPicker.tsx / wellGeometry.ts | 304-319 / 131-156 | source drag overwrites `{{variable}}` or flagged well fields; clamped hit-test on headers (WR-02) | Warning, open | Silent loss of a variable binding; no must-have defeated |
| AddToolCommandModal.tsx / CommandDetailsDrawer.tsx | ~340-350 | "No Variable" on `tip_reuse` writes a flagged blank (WR-03) | Warning, open | UX only; matches PLT-07 "blank kept and flagged" |
| utils/int32.ts | 46-49 | `int32FromDigits("")` returns 0 by precondition only (IN-03) | Info | All three callers guard; no live bug |
| AddToolCommandModal.tsx | 628-655 | unreachable no-zero-fill branch (IN-01) | Info | dead code |
| staticScan.test.ts | 1096-1273 | regex-over-source scans (IN-02) | Info | brittle proxy; reducer has real tests |

Debt-marker scan (`TBD|FIXME|XXX`) over the modified source files: none.

### Human Verification Required

See the `human_verification` frontmatter list: (1) real-browser source-grid drag in all three hosts, (2) plate dropdown against a live instrument including mid-Transfer, (3) deck/checkbox/384-well/size-mismatch/unreachable/dark-mode rendering, (4) typed out-of-range plate id end to end.

### Gaps Summary

No gaps. Both items from the previous report (CR-01 int32 wrap, unexercised SC5 drag) are closed with code, wiring and tests that I re-read and re-ran. Open review items WR-02, WR-03, WR-04 and IN-01..03 are quality or hardening findings that do not defeat a stated truth; WR-04 (enqueue-time int32 scan and `estimateDuration` guard) is the one worth scheduling because the failure it leaves is a physically half-run protocol.

---

_Verified: 2026-11-13T08:10:00Z_
_Verifier: Claude (gsd-verifier)_
