---
phase: 07-f-a-s-t-plate-dropdowns
reviewed: 2026-11-12T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - controller/components/protocols/AddToolCommandModal.tsx
  - controller/components/protocols/CommandDetailsDrawer.tsx
  - controller/components/tools/OptionsSelect.tsx
  - controller/components/tools/StaticSelect.tsx
  - controller/components/tools/TipReuseCheckbox.tsx
  - controller/components/tools/WellPicker.tsx
  - controller/components/tools/commandParams.ts
  - controller/components/tools/fieldOptions.ts
  - controller/components/tools/wellGeometry.ts
  - controller/pages/tools/[id].tsx
  - controller/server/toolOptions.ts
  - controller/test/commandParams.test.ts
  - controller/test/fastFieldOptions.test.ts
  - controller/test/fieldOptions.test.ts
  - controller/test/fixtures/fastPlates.ts
  - controller/test/staticScan.test.ts
  - controller/test/toolOptions.parse.test.ts
  - controller/test/toolOptions.read.test.ts
  - controller/test/toolOptionsRouter.test.ts
  - controller/test/wellGeometry.test.ts
  - controller/test/wire.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-11-12
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the Phase 7 diff (since 43549fa) for the F.A.S.T. plate dropdowns, deck select, tip-reuse checkbox and well picker, plus the server-side `fast.plates` parser. The 9 relevant vitest files pass (471 tests). The server parser (`parsePlates`) is careful: ids are bounded to 1..INT32_MAX, caps are enforced, and nothing is truncated. The geometry core is pure and well covered.

The main defect is on the client side. The typed-fallback and typed-well numeric paths accept unbounded digit strings. The generated protobuf encoder wraps them modulo 2^32, so an oversized id silently becomes a different plate on the wire. This contradicts the phase's own "never truncated or rounded" rule (PLT-04). It was reproduced against the real encoder. The remaining findings are robustness issues in the picker's pointer handling and a silent overwrite of variable references.

## Critical Issues

### CR-01: Typed plate id / well count is not range-bounded and wraps to a different value on the wire

**File:** `controller/components/tools/fieldOptions.ts:674-678` (also `controller/components/tools/wellGeometry.ts:178-182`, `controller/components/tools/fieldOptions.ts:393-396`)
**Issue:** The typed fallback for a plate id (`applyChange`, `role.kind === "plate"`, `kind === "typed"`) strips non-digits and returns `Number(digits)` with no upper bound. `wellFieldPatch` does the same for `source_start_col`, `dest_start_col`, `num_rows` and `num_cols`. `parsePlates` caps ids at INT32_MAX on the server side, but this typed path bypasses that rule. protobufjs `Writer.int32` for a non-negative number calls `uint32`, which does `value >>> 0`, so the value wraps modulo 2^32.

I verified this against the real generated encoder. Typing `4294967297` into `source_plate_id` produced `{ source_plate_id: 4294967297 }`, and after `Command.encode` and `decode` it came back as `1`. An operator who types an over-long id, or pastes one, would silently transfer from plate 1. This is a physical robot action, and the `T-07-24` / PLT-04 claim that no malformed value reaches the wire is false for this path. Digit strings above 2^53 also lose precision in `Number(...)`.
**Fix:** Reject or keep verbatim any value outside 1..2147483647, the same way the server drops an out-of-range id.
```ts
const INT32_MAX = 2147483647;
function intPatchValue(digits: string): number | string {
  if (digits === "") return "";
  const n = Number(digits);
  return Number.isSafeInteger(n) && n <= INT32_MAX ? n : digits; // keep verbatim, it is flagged, never wrapped
}
```
Use it in the typed-plate branch of `applyChange`, in `wellFieldPatch` and in `numericPatch`. `classifyWellValue` should also flag a value above INT32_MAX, and the host should refuse to send it. A string that is kept verbatim still reaches the encoder as `"4294967297" >>> 0`, so also refuse or flag it at send time, or clamp the typed input with a `maxLength`.

## Warnings

### WR-01: Source-grid drag can get stuck and keep rewriting the selection when pointer capture is refused

**File:** `controller/components/tools/WellPicker.tsx:304-331`
**Issue:** `onPointerDown` records `anchor.current` and then tries `setPointerCapture`, swallowing any failure ("the drag still works"). `onPointerMove` only checks `anchor.current` and never `e.buttons`. If capture fails and the button is released outside the grid, no `pointerup`, `pointercancel` or `lostpointercapture` ever reaches the element, so `anchor` stays set. The next hover back over the grid, with no button pressed, silently re-patches `source_start_row`, `source_start_col`, `num_rows` and `num_cols` through `onPatch`. That violates the "a patch exists only for an operator drag" invariant stated at the top of the file.
**Fix:** End the drag when no button is held.
```ts
onPointerMove={(e, cell) => {
  const a = anchor.current;
  if (!a) return;
  if (e.buttons === 0) { endDrag(); return; }
  if (!cell) return;
  ...
}}
```

### WR-02: A source drag silently overwrites variable references in the well fields

**File:** `controller/components/tools/WellPicker.tsx:304-309`, `controller/components/tools/wellGeometry.ts:147-154`
**Issue:** The picker stays fully interactive when a well field holds a `{{variable}}` (`forceOpen` only expands "Edit as fields" and shows a note). A pointer-down on the source grid emits `sourcePatch(rect)`, which writes all four source fields and replaces any bound variable with a literal. There is no confirmation and no undo in the modal or drawer, so the operator loses the binding. The same applies to a click on the axis labels or gutter, because `cellFromPoint` is called with `clamp: true` and clamps that point to the nearest edge well, so a mis-click on a row or column header emits a patch.
**Fix:** When any well field is variable-bound, make the source grid non-interactive, or require "Clear selection" first. Hit-test with `clamp` only while a drag is already in progress, so a first pointer-down outside the well area returns `undefined`.

### WR-03: "No Variable" on a local binding writes a blank that the UI then flags as invalid

**File:** `controller/components/protocols/AddToolCommandModal.tsx:340-350` (similarly `CommandDetailsDrawer.tsx` local-binding `Select` onChange)
**Issue:** For `tip_reuse`, choosing "No Variable" calls `handleLocalSelect(binding, "")`, which writes `""`. `checkboxView` then shows an indeterminate box with the flag "(saved value is blank — not reuse/fresh)". For a field the operator has just unbound, this puts the form straight into the flagged state. The wire sends `tip_reuse: ""` unless the operator clicks the checkbox, and the new-step default `"reuse"` is not restored.
**Fix:** For a checkbox binding, write the binding's default (`newStepDefaults`) when the variable is unbound, or at least do not present the blank as an error state. Alternatively document that "No Variable" means blank and keep the flag text neutral for a blank.

## Info

### IN-01: `isNoZeroFillField` number-input branch in the modal is unreachable for the only configured command

**File:** `controller/components/protocols/AddToolCommandModal.tsx:628-655`
**Issue:** `NO_ZERO_FILL_FIELDS` lists `source_deck`, `dest_deck`, `source_plate_id` and `dest_plate_id` for `fast.transfer`. All four are caught earlier by `lookupLocalBinding` or `lookupFieldBinding`, so the `noZeroFill ? "" : 0` display and the NaN-to-`""` write in the `case "number"` branch can never run for current config. Only `fillMissingParams` uses the list. It is dead code that is untested at the component level and can drift.
**Fix:** Drop the branch in the number `NumberInput`, or keep it with a comment that it is defence for a future unbound field.

### IN-02: Source-scanning static tests are brittle proxies for behavior

**File:** `controller/test/staticScan.test.ts:1096-1273`
**Issue:** Many of the new invariants are asserted by regex over source text, for example the absence of `defaultValue` or `options[0]` in `StaticSelect.tsx`. They pass today and guard the stated "no auto-select / no write on render" rules only textually. A rename or an equivalent construct would defeat them without failing. There is no render test for the host wiring (anchor selection, drag patch merge), so the findings above are not caught by the suite.
**Fix:** Add a few jsdom/React Testing Library cases for `WellPicker` (pointer sequence with capture refused, variable-bound fields) alongside the scans.

---

_Reviewed: 2026-11-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
