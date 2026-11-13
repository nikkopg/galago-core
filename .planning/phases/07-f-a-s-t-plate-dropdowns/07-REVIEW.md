---
phase: 07-f-a-s-t-plate-dropdowns
reviewed: 2026-11-13T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - controller/components/tools/OptionsSelect.tsx
  - controller/components/tools/WellPicker.tsx
  - controller/components/tools/fieldOptions.ts
  - controller/components/tools/wellGeometry.ts
  - controller/components/tools/wellPointer.ts
  - controller/server/tools.ts
  - controller/test/fastFieldOptions.test.ts
  - controller/test/int32.test.ts
  - controller/test/staticScan.test.ts
  - controller/test/wellGeometry.test.ts
  - controller/test/wellPointer.test.ts
  - controller/test/wire.test.ts
  - controller/utils/int32.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 7: Code Review Report (incremental re-review after 07-09 and 07-10)

**Reviewed:** 2026-11-13
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Re-reviewed the diff `ee77e17..HEAD` for the 13 scoped files. The six relevant vitest files pass (344 tests).

**Prior findings:**

- **CR-01 (int32 wrap): RESOLVED.**
  - All typed and select producers (`applyChange`, `numericPatch`, `wellFieldPatch`) now go through `int32FromDigits`. An out-of-range digit string stays as text and is flagged in the UI (`plateIdFlag`, `classifyWellValue` "too-large").
  - `Tool.executeCommand` refuses any non-exact int32 on the nine `fast.transfer` fields after variable substitution and before any gRPC send. The field table matches the generated `Command_Transfer` encoder: nine `writer.int32` fields, with `volume` and `timeout_s` as doubles. It is pinned by `int32.test.ts`.
  - I traced the edge cases: leading zeros, `Infinity` from very long digit strings, `"3.5"`, `"0x10"`, `" 3"`, trailing-newline strings (JS `$` does not match before `\n`), 0 and the number `-0`. All behave correctly.
  - One residual gap is raised as WR-04: the refusal happens only at execution time.
- **WR-01 (stuck drag): RESOLVED.**
  - `sourcePointerStep` ends the drag on a move with the primary button not held, on up, cancel, lost-capture, and on leave when capture was not taken. It never mutates its input.
  - `WellPicker` forwards `e.buttons`, `e.button` and the capture result, and has no remaining `anchor` or `lastRect` state.
  - The reducer branches are covered by 17 node tests.
- **WR-02: STILL OPEN.** `WellPicker.tsx` and `wellGeometry.ts` source patches are unchanged and still overwrite variable-bound or flagged well fields.
- **WR-03, IN-01, IN-02: STILL OPEN.** `AddToolCommandModal.tsx` and `CommandDetailsDrawer.tsx` are outside this scope. `git diff ee77e17..HEAD` shows they are unchanged, so the findings are carried forward unchanged.

New: WR-04, IN-03 (below), and IN-02 is extended with the new scan tests.

## Warnings

### WR-02: A source drag silently overwrites variable references in the well fields (carried forward, open)

**File:** `controller/components/tools/WellPicker.tsx:304-319`, `controller/components/tools/wellGeometry.ts:131-156`
**Issue:** The picker stays fully interactive when a well field holds `{{variable}}` or a flagged value, including the new "too-large" text from CR-01. `forceOpen` only expands "Edit as fields" and shows a note. A pointer-down on the source grid emits `sourcePatch(rect)`, which writes all four source fields and replaces the variable with a literal. There is no confirmation and no undo. `cellFromPoint(..., clamp = true)` also returns a clamped edge well for a point on the axis labels, gutter or header, so a stray click on a row or column label emits a patch. The WR-01 fix left this unchanged.
**Fix:** When any well field is variable-bound (with `allowVariables`), disable pointer handlers on the source grid, or require "Clear selection" first. Hit-test with `clamp` only while a drag is in progress (`drag.current !== undefined`). A first pointer-down outside the well area should return `undefined`, so `down` writes nothing.

### WR-03: "No Variable" on a local binding writes a blank that the UI then flags as invalid (carried forward, open)

**File:** `controller/components/protocols/AddToolCommandModal.tsx:340-350` (same pattern in `CommandDetailsDrawer.tsx`)
**Issue:** Choosing "No Variable" for `tip_reuse` calls `handleLocalSelect(binding, "")`, which writes `""`. `checkboxView` then shows an indeterminate box and "(saved value is blank — not reuse/fresh)". The operator has just unbound the field and lands in the flagged state, and `tip_reuse: ""` is sent unless they click the checkbox.
**Fix:** For a checkbox binding, write the binding's default (`newStepDefaults`) when the variable is unbound. Alternatively, keep the flag text neutral for a blank.

### WR-04: The int32 refusal exists only at execution time, with no enqueue-time scan and an unguarded `estimateDuration`

**File:** `controller/server/tools.ts:490-506` (guard), `controller/server/tools.ts:680-682` (`estimateDuration`), `controller/server/runs.ts:190-208`, `controller/server/runs.ts:222-230`
**Issue:** The guard is only in `Tool#executeCommand`. `createFromProtocol` already runs an enqueue-time operator-only scan (D-02b) as a "cheap early layer". The int32 guard has no such layer. A saved step with a literal `4294967297` (the UI keeps it verbatim and only flags it) therefore passes enqueue and fails when it is reached. Earlier steps of the protocol have by then physically run and the run stops halfway, which for a plate-handling robot is the worst place to discover a bad id.
Separately, `estimateDuration` sends `_payloadForCommand(command)` with raw, unsubstituted params and no int32 check. The instrument is asked to estimate for the wrapped value (plate 1) and `{{var}}` strings encode as 0. This was true before, but the CR-01 fix claims that no non-exact int32 reaches the instrument, and this path still lets one through. It is an estimate rather than a motion, so it is lower risk.
**Fix:** In `createFromProtocol`, after the operator-only scan, run `int32ParamProblems(declaredType, c.command, c.params)` on literal (non-`{{…}}`) values and reject the run before anything is enqueued. Variables can only be checked at execution time. Also call `int32ParamProblems` in `estimateDuration`, skipping `{{…}}` values, and skip the estimate on a problem instead of sending the wrapped value.

## Info

### IN-01: `isNoZeroFillField` number-input branch in the modal is unreachable for the only configured command (carried forward, open)

**File:** `controller/components/protocols/AddToolCommandModal.tsx:628-655`
**Issue:** All four `NO_ZERO_FILL_FIELDS` entries for `fast.transfer` are caught earlier by `lookupLocalBinding` or `lookupFieldBinding`. The `noZeroFill ? "" : 0` display and the NaN-to-`""` write in `case "number"` are dead for current config.
**Fix:** Remove the branch, or keep it with a comment that it is defence for a future unbound field.

### IN-02: Source-scanning static tests are brittle proxies for behaviour (carried forward, open)

**File:** `controller/test/staticScan.test.ts:1096-1273` (the 07-10 additions are at `:1233-1260`)
**Issue:** The new scan tests assert `sourcePointerStep(` and `buttons: e.buttons` as text, the absence of `anchor.current`, and the exact string `type: "leave"`. A rename or an equivalent construct would defeat them without failing. The reducer itself is covered by real behavioural tests in `wellPointer.test.ts`. The glue in `WellPicker.tsx` is not: nothing checks that `onPointerLeave` or `e.buttons` are actually wired the way the scan assumes. There is still no jsdom or RTL render test for `WellPicker`.
**Fix:** Add a small RTL pointer-sequence test for `WellPicker`, covering capture refused and variable-bound fields. It would also pin WR-02.

### IN-03: `int32FromDigits("")` returns 0, a silent blank-to-zero conversion guarded only by a comment

**File:** `controller/utils/int32.ts:46-49`
**Issue:** The function documents "Precondition: digits is one or more ASCII digits" but does not enforce it. `Number("")` is 0, so a caller that forgets the `digits === ""` guard turns a blank into 0. This is the zero-fill the phase forbids (D-13 "never 0"). All three current callers guard correctly (`numericPatch` and `wellFieldPatch` by regex or empty check, `applyChange` by `digits === ""`), so there is no live bug.
**Fix:** Make the helper total: `if (!/^[0-9]+$/.test(digits)) return digits;` at the top, so the precondition is enforced rather than documented.

---

_Reviewed: 2026-11-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
