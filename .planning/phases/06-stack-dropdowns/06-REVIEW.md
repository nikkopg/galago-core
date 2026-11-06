---
phase: 06-stack-dropdowns
reviewed: 2026-11-06T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - controller/components/protocols/AddToolCommandModal.tsx
  - controller/components/protocols/CommandDetailsDrawer.tsx
  - controller/components/tools/OptionsSelect.tsx
  - controller/components/tools/ToolsComponent.tsx
  - controller/components/tools/connectConfig.ts
  - controller/components/tools/fieldOptions.ts
  - controller/pages/tools/[id].tsx
  - controller/test/connectConfig.test.ts
  - controller/test/fieldOptions.test.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 6: Code Review Report (incremental re-review)

**Reviewed:** 2026-11-06
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Scope: the diff from 52f7029 to HEAD, which is commit faccb5e (fixes for prior WR-01 and WR-02) and commit 1c4f875 (Connect All payload). I read the changed hunks and the surrounding code in all three hosts, `OptionsSelect`, `applyChange`, `buildFieldView`, `tool.configure` in the router, and `ToolConfigEditor.toolSpecificConfig`. I also ran `connectConfig.test.ts` and `fieldOptions.test.ts`: 58 tests pass.

### Prior findings

**WR-01 (typed fallback wipes children): resolved.**
- `OptionsSelect` now passes `"typed"` from the fallback `<Input>` and `"select"` from the `<Select>`.
- `applyChange` returns `{ [binding.field]: newValue }` for `"typed"` before any cascade logic runs. A typed edit therefore cannot clear a deck or nest.
- All three hosts (modal, drawer, tool page) forward `kind` to `applyChange`.
- The new `fieldOptions` test covers device, deck and a non-cascade field.

**WR-02 (drawer unbind reverts to saved value and leaves a mismatched triple): resolved.**
- In the drawer and the modal, picking "No Variable" on a bound field now calls `handleOptionSelect(binding, "", "select")`. That writes `""` explicitly and clears the cascade children in one functional update. It no longer deletes the key.
- The old fallback to the saved value is gone, so a mismatched device/deck/nest triple is no longer possible.
- A saved `{{variable}}` can now be unbound. Before, `editedParams[key]` was undefined and the handler did nothing.
- The drawer's `isEditing` guard is kept. The handler also fires only on a real change event, so a non-variable field cannot be blanked by accident.
- I checked that the modal gives the same result as before for a non-cascade field. A missing key was already filled with `""` in `handleSubmit`.

**Connect All (1c4f875): correct.**
- `buildConnectConfig` unwraps the type-keyed stored row. That matches `ToolConfigEditor.toolSpecificConfig` (same `type in config` test) and its `saveConfig` shape (`{toolId, simulated, [toolType]: sub}`).
- It still handles a flat legacy row.
- `simulated` is read from the row's top level, which is where the editor stores it.
- The server path (`z.custom<Config>().transform(Config.fromPartial)`) preserves the `host` field. The test asserts this through `Config.fromPartial`.

No critical issues or warnings were found in the changed code.

## Info

### IN-01: Unbinding a device silently clears deck and nest variable bindings

**File:** `controller/components/protocols/AddToolCommandModal.tsx:336-340`, `controller/components/protocols/CommandDetailsDrawer.tsx:264-268`

**Issue:** "No Variable" on a cascade parent goes through `applyChange(..., "select")`, which blanks the same side's deck and nest. This is consistent with D-09. It also blanks children the operator had bound to `{{variables}}` on purpose, for example device `{{d}}`, deck `{{k}}` and nest `{{n}}`. Unbinding only the device then discards the other two bindings with no indication. The data is easy to re-enter, so this is not a defect, but the behaviour is surprising.

**Fix:** Either keep children that are `isVariableLike` when the parent is unbound, or accept the behaviour and say so in the UI hint. Whichever is chosen, record it as a decision.

### IN-02: Unbind path is duplicated inline in two hosts and has no regression test

**File:** `controller/components/protocols/AddToolCommandModal.tsx:332-343`, `controller/components/protocols/CommandDetailsDrawer.tsx:260-272`

**Issue:** The WR-02 fix is an inline `onChange` block repeated in two components. The test added for the fix covers `applyChange("typed")` but nothing exercises the host-level rule "No Variable on a bound field writes `""` and does not delete the key". A later refactor back to `handleVariableSelect("")` would not fail any test.

**Fix:** Move the rule into one helper in `fieldOptions.ts`, for example `unbindPatch(binding) => applyChange(binding, "", "select")`. Unit-test that it returns `""` for the field and for its children. Both hosts would then call the helper.

### IN-03: A bound variable that is not in the variable list cannot be unbound from the picker

**File:** `controller/components/protocols/CommandDetailsDrawer.tsx:257-272`, `controller/components/protocols/AddToolCommandModal.tsx:330-343`

**Issue:** For a bound field, `OptionsSelect` is disabled in `variable-bound` mode (`fieldOptions.ts:172-178`). The only way out is the "No Variable" picker. If a step references a variable that has since been deleted, the picker's `value` has no matching `<option>`. The browser then shows "No Variable", and choosing it fires no change event. The field is stuck until the operator picks some other variable first. This was mostly masked before because the old field was a text input.

**Fix:** When `variableName` is non-empty and absent from the variable list, add a placeholder `<option value={variableName}>{variableName} (missing)</option>`. Choosing "No Variable" then fires a real change.

---

_Reviewed: 2026-11-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
