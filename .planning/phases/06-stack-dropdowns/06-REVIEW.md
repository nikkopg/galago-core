---
phase: 06-stack-dropdowns
reviewed: 2026-11-06T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - controller/components/protocols/AddToolCommandModal.tsx
  - controller/components/protocols/CommandDetailsDrawer.tsx
  - controller/components/tools/OptionsSelect.tsx
  - controller/components/tools/fieldOptions.ts
  - controller/hooks/useToolOptions.ts
  - controller/pages/tools/[id].tsx
  - controller/server/routers/tool.ts
  - controller/server/toolOptions.ts
  - controller/server/tools.ts
  - controller/utils/variableRef.ts
  - controller/test/fieldOptions.test.ts
  - controller/test/fixtures/stackDeviceTrees.ts
  - controller/test/fixtures/stackOptions.ts
  - controller/test/staticScan.test.ts
  - controller/test/toolOptions.parse.test.ts
  - controller/test/toolOptions.read.test.ts
  - controller/test/toolOptionsRouter.test.ts
  - controller/test/wire.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-11-06
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

I read the new server registry, parsers, cache and in-flight logic, the client binding map and view builders, the shared control and hook, and the diffs to the three hosts and the router. I did not flag any locked decision (D-01..D-17) as a bug.

The server side holds up. Reads cannot be steered from the browser, and the router input is strict and closed. Cache keys carry the epoch and generation, so a read that began before a configure is never stored. Failures evict and never fall back to stale data. Names are checked with the same `{{...}}` rule `Tool.executeCommand` uses (no trim), and the parser also rejects the trimmed form. I found no injection, prototype-key or unbounded-reply path.

The defects are on the client. The typed-input fallback shares the dropdown's cascade-clearing write path, which can silently wipe hydrated child values. The drawer's variable "unbind" also interacts badly with cascades. Both are data-quality problems on a safety-relevant form. No blockers.

## Warnings

### WR-01: Typed fallback inputs go through `applyChange`, so every keystroke in a parent field wipes its children

**File:** `controller/components/tools/OptionsSelect.tsx:92-98` (with `controller/components/tools/fieldOptions.ts:372-385` and the three hosts' `handleOptionSelect`)

**Issue:** In the `unavailable` and `child-of-variable` modes, `OptionsSelect` renders a plain `<Input>` whose `onChange` calls the same `onSelect`. Each host maps `onSelect` to `applyChange(binding, value)`. For a device or deck binding, `applyChange` blanks the same side's deck and nest, or the nest. D-09 describes that clear for an operator choosing from the dropdown. It does not describe the typed fallback.

Consequences:
- With the instrument list unavailable, an operator who fixes a typo in `source_device` silently loses `source_deck` and `source_nest`.
- In `child-of-variable` mode, typing a deck name wipes the nest on every keystroke.
- The worst case is the drawer. A saved step is hydrated, STACK is down (so the mode is `unavailable`), and one edit to the device text clears the saved deck and nest to `""`. Saving then persists the blanks.

Nothing tells the operator. This contradicts the intent of DRP-05 and D-15 (no silent rewrite of saved values).

**Fix:** Give the typed branch its own write that touches only the field, and keep `applyChange` for dropdown selections:
```tsx
// OptionsSelect props
onSelect: (value: string) => void; // dropdown choice (cascade clears)
onType: (value: string) => void;   // typed fallback (own field only)
// typed branch
<Input value={view.value} onChange={(e) => onType(e.target.value)} ... />
// hosts
onType={(v) => setCommandParams((p) => ({ ...p, [binding.field]: v }))}
```
Add a `fieldOptions.test.ts` case: typing in an unavailable device field leaves deck and nest unchanged.

### WR-02: Drawer variable "unbind" on a cascade field reverts to the saved value and leaves children inconsistent

**File:** `controller/components/protocols/CommandDetailsDrawer.tsx:93-109`, called from the new binding branch at lines 260-268

**Issue:** `handleVariableSelect("")` deletes `editedParams[field]` when the edited value is a variable. A deleted key falls back to the saved value in `currentValue` and in `handleSaveInputs`' merge. For a cascade parent, the operator can pick device A, pick deck/nest under A, bind the device to `{{v}}`, then choose "No Variable". The device silently becomes the saved device B, while deck and nest stay as edited under A. That produces a mismatched device/deck/nest triple, and nothing flags it.

Separately, if the saved value is already `{{v}}`, `editedParams[field]` is undefined, so "No Variable" does nothing. With the new variable-bound mode the dropdown is also disabled, so the field cannot be changed at all. The old text input had the same limitation, but a disabled select makes it more visible.

**Fix:** For bound fields, unbinding should write the blank explicitly and clear the children, not delete the key. This also unbinds a saved variable:
```tsx
if (binding !== undefined && variableName === "") {
  setEditedParams((p) => ({ ...p, ...applyChange(binding, "") }));
  return;
}
```

## Info

### IN-01: `refresh()` resets `isRefreshing` outside a `finally`

**File:** `controller/hooks/useToolOptions.ts:50-56`

**Issue:** `setIsRefreshing(false)` runs after `setData`. If `setData` ever throws, the Refresh button stays in its loading state permanently. Today it does not throw, but the guarantee is accidental.

**Fix:** Wrap the body in `try { ... } finally { setIsRefreshing(false); }`.

### IN-02: `clearToolStore` bumps generations only on success

**File:** `controller/server/routers/tool.ts:471-474`

**Issue:** `bumpAllGenerations()` runs after `await Tool.clearToolStore()`. `configure` already uses `try/finally` for the same reason. If `clearToolStore` rejects part-way, some tools are closed and removed but their cached lists survive for up to 15 s.

**Fix:**
```ts
try { await Tool.clearToolStore(); } finally { bumpAllGenerations(); }
return { message: "Tool store cleared successfully" };
```

### IN-03: `ambiguous` entries carry no length cap

**File:** `controller/server/toolOptions.ts:189-193`

**Issue:** The comment says an over-long entry "needs no length check". The array is bounded to 10,000 entries, but each string is unbounded apart from the gRPC 4 MB message limit. It is then forwarded to the browser and re-hashed into a `Set` on every render. Dropping, rather than failing on, entries over `MAX_NAME_LENGTH * 3 + 2` would keep the payload bounded. A path longer than that cannot match any offered path.

**Fix:** In the loop, skip entries longer than `MAX_NAME_LENGTH * 3 + 2` and mark the result degraded.

### IN-04: Wire test asserts the same thing twice

**File:** `controller/test/wire.test.ts:276-296`

**Issue:** `expect(chosen).toStrictEqual(typed)` already proves equality. The following `expect(encode(chosen)).toStrictEqual(encode(typed))` can then never fail, because it encodes two equal objects. The test adds no byte-level protection beyond the first assertion. It would only catch a regression in `_payloadForCommand` or `omitBlankParams` if the inputs differed.

**Fix:** Drop the redundant assertion, or compare the encoded bytes against a literal golden byte array.

---

_Reviewed: 2026-11-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
