# Phase 7: F.A.S.T. Plate Dropdowns - Pattern Map

**Mapped:** 2026-11-12
**Files analyzed:** 14 (all paths below are under `controller/` and git-tracked)
**Analogs found:** 13 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `server/toolOptions.ts` (add `fast.plates` entry, `parsePlates`, plate result shape) | service/registry | request-response | same file: `OPTION_SOURCES`, `parseNameList`, `parseDeviceTree` | exact |
| `components/tools/fieldOptions.ts` (add `fast.transfer` bindings, `static`/`checkbox` roles, `SOURCE_LABELS["fast.plates"]`, decks constant, plate view) | utility (React-free) | transform | same file: `FieldRole`, `list()`, `buildSelectView`, `buildFieldView` | exact |
| `components/tools/OptionsSelect.tsx` (plate list, static deck mode, checkbox mode) | component | request-response | same file | exact |
| `components/tools/wellPicker/geometry.ts` (new, React-free: row-label codec, fit, mismatch, field<->selection sync) | utility | transform | `fieldOptions.ts` (React-free, pure fns, `applyChange` patch producer) | role-match |
| `components/tools/WellPicker.tsx` (new, pointer events) | component | event-driven | `components/ui/PlateGrid.tsx` (colour tokens only, D-10) | partial |
| `hooks/useToolOptions.ts` | hook | request-response | unchanged unless the type widens | n/a |
| `components/protocols/AddToolCommandModal.tsx` (host, `handleSubmit` no-zero-fill, new-step `tip_reuse` default, `renderField`) | component | CRUD | same file lines 212-228, 310-335 | exact |
| `pages/tools/[id].tsx` (host) | component | request-response | same file (`OptionsSelect` ~line 287) | exact |
| `components/protocols/CommandDetailsDrawer.tsx` (edit-only host) | component | CRUD | same file (`OptionsSelect` ~line 250) | exact |
| `test/fixtures/fastPlates.ts` (new, golden and builders) | test fixture | transform | `test/fixtures/stackOptions.ts` | exact |
| `test/toolOptions.parse.test.ts` (add plate parser and cap tests) or new `toolOptions.plates.test.ts` | test | transform | `test/toolOptions.parse.test.ts` | exact |
| `test/fieldOptions.test.ts` (add deck/checkbox/plate view tests) | test | transform | same file | exact |
| `test/wellPicker.geometry.test.ts` (new) | test | transform | `test/fieldOptions.test.ts` (React-free, fixtures, no jsdom) | role-match |
| `test/staticScan.test.ts` (D-17 scans) | test | batch | same file `describe("tool options read path (D-17)")` L873, `describe("dropdown control invariants")` L969 | exact |
| `vendor/galago-tools` gitlink and `gen-interfaces/tools/grpc_interfaces/fast.ts` | config/generated | n/a | Phase 5 D-02 / Phase 6 D-16 ts-proto 1.151.1 regen | no code analog (see below) |

## Pattern Assignments

### `server/toolOptions.ts` (registry + parser)

**Imports and helpers to reuse** (lines 7-13, 85-117): `isPlainObject`, `own()` (own-property read, T-06-09), `checkKind`, `isUsableName`, and the caps `MAX_NAME_LENGTH`/`MAX_LIST_ITEMS`.

```typescript
function own(obj: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}
function checkKind(meta: unknown, kind: string): Record<string, unknown> | undefined {
  if (!isPlainObject(meta)) return undefined;
  if (own(meta, "kind") !== kind) return undefined;
  return meta;
}
```

**Parser shape** (`parseNameList`, line 119): `checkKind` -> `own(root, listKey)` -> `!Array.isArray` is `"bad_reply"` -> `items.length > MAX_LIST_ITEMS` is `"too_large"` -> per-entry loop that drops a bad entry and sets `degraded = true`. Never slice or repair. `parseDeviceTree` (L171-244) is the model for per-entry `degraded` with nested validation.

**Result type** (lines 42-60, 63-75): add a third `ok` shape, e.g. `shape: "plates"` with `plates: PlateEntry[]` (`id:number`, `description:string`, `rowCount?`, `colCount?`, `duplicateId:boolean`), `degraded`, `fetchedAt`. Add a `ParsedPlates` to the `Parsed` union. Contract (D-03/D-04): meta shape `meta_data.plates[]` with `id, description, rowCount, colCount, workingCapacity`. The frozen galago-tools commit wins over the contract.

**Registry entry** (lines 248-278; the comment on 247, "No fast.plates entry", must be updated to say "five sources"):
```typescript
"stack.robots": { toolType: "stack", command: "get_robot_states", kind: "robotStates",
  acceptsRefresh: false, parse: (meta: unknown) => parseRobotStates(meta) },
...
} as const satisfies Record<string, OptionSourceEntry>;
```
Add `"fast.plates": { toolType: "fast", command: "get_plates", kind: <per frozen commit>, acceptsRefresh: true, parse: parsePlates }`. `OPTION_SOURCE_IDS` (L281) derives from the registry, so the zod enum follows automatically. `acceptsRefresh: true` is the D-03 choice (the proto keeps `refresh`).

**Plate-specific validation** (D-04): `Number.isInteger(id) && id >= 1 && id <= 2147483647`; description is a string, capped at `MAX_NAME_LENGTH`, and may be empty; rows/cols are integers in 1..cap (at least 32x48), and when invalid the plate stays selectable as "unknown geometry". Order is preserved, `[]` is `ok` with zero items. Duplicate ids are flagged and never collapsed (D-05). The `isUsableName` variable-like rejection applies to the description (T-06-03).

---

### `components/tools/fieldOptions.ts` (binding map + view builders)

**Role union to extend** (lines 33-40, 47-54):
```typescript
export type FieldRole =
  | { kind: "list" }
  | { kind: "cascade"; side: CascadeSide; level: CascadeLevel };
function list(field: string, source: OptionSourceId): FieldBinding {
  return { field, source, role: { kind: "list" } };
}
```
Add `{ kind: "static"; options: readonly number[] }`, `{ kind: "checkbox"; checked: string; unchecked: string }`, and a plate role. Static and checkbox have no read, so `FieldBinding.source` must become optional or take a nullable sentinel. Check every `binding.source` use first (`OptionsSelect` L66 `useToolOptions(toolId, binding.source, enabled)`, `SOURCE_LABELS[binding.source]`, `firstFieldForSource` L451). Deck and checkbox bindings must not feed the Refresh row.

**Binding map** (lines 56-97): `FIELD_BINDINGS.stack.transfer = byField(transferBindings())`. Add `fast: { transfer: byField([...]) }` with `source_plate_id`/`dest_plate_id` bound to `fast.plates`, `source_deck`/`dest_deck` as static 1-6, and `tip_reuse` as a checkbox. Keep `own()` lookups (`lookupFieldBinding`, L88-101). Do not touch `commandFields.fast` (D-08/D-09); `test/commandFields.test.ts:7,29-43` pins stay green.

**SOURCE_LABELS** (lines 21-26) is `Record<OptionSourceId, string>`, so adding `fast.plates` to the registry is a compile error until you add `"fast.plates": "plates"`.

**Decks constant** (D-08): one exported `DECK_SLOTS = 6` with the comment `mirrors _DECK_SLOTS = 6, vendor/galago-tools/tools/fast/server.py:129`. The static scan checks that it is the single definition.

**View builder** (`buildSelectView` L156-213 and `buildFieldView` L396-436). Copy the born-empty pattern:
```typescript
const emptyOption: SelectOption = { key: "empty", value: "", label: "" };
const options: SelectOption[] = [emptyOption, ...offered];
if (!blank && !offered.some((option) => String(option.value) === current)) {
  options.push({ key: "not-reported", value: current,
    label: current + NOT_REPORTED_SUFFIX, flag: "not-reported" });
}
```
Compare with `String(a) === String(b)` (D-06). Deck case: the same push with a "(not a deck slot 1-6)" suffix. `buildFieldView` falls back to `unavailable` when `data.shape` does not match the role (L407-420); add the plates shape there. Variable handling comes first (`allowVariables && isVariableLike`, L169-176) and gives the disabled `variable-bound` view; the checkbox needs the same.

**Patch producer**: `applyChange(binding, newValue, kind)` (L355-373) is the only patch producer. Number-writing (plates/decks write a **number**) must live here or in a sibling function; never in the renderer. Add a "Clear selection" patch that sets all six well fields to `""` (D-13), and never any effect-driven clears.

**Label**: `"{id} · {description}"`; id-only when the description is empty; duplicate suffix `" (duplicate id — check instrument)"`. Put the new constants beside `NOT_REPORTED_SUFFIX` (L13-23).

**Status line** (`formatStatusLine` L463-477) counts `data.shape === "list" ? names.length : devices.length`. Extend it for plates, or the plates shape will mis-count.

---

### `components/tools/OptionsSelect.tsx`

Keep: no effect hooks, no `options[0]`/`defaultValue`/`placeholder=`/`selectedIndex` (the static scan at staticScan L969-1000 enforces this on this file). The value always lives in the host, and `onSelect(value, kind)` is the only output. `useToolOptions` is called unconditionally (rules of hooks), so for static/checkbox bindings either split into small sibling components or pass `enabled={false}` (the hook disables the query, `mode` becomes `"unavailable"`). A static/checkbox branch must ignore that mode. Do not render a Refresh row for them (`showRefresh` false).

Render block to copy (L84-111): `view.mode` unavailable is `<Input type="text" onChange={(e) => onSelect(e.target.value, "typed")}>`; otherwise a native Chakra `<Select value={view.value} isDisabled={view.disabled} onChange={(e) => onSelect(e.target.value, "select")}>` mapping `view.options`. A checkbox adds Chakra `Checkbox` with `isIndeterminate`. `aria-describedby` uses `useId()` (L56-57, 71-77).

Colours: `useColorModeValue` + `useToken("colors", [...])` for native `<option>` CSS (L53-55).

---

### `components/tools/wellPicker/geometry.ts` (new, React-free)

No exact analog. Follow `fieldOptions.ts` conventions: no react import, pure functions, `import type` only for server types, own-property safety, never mutate input, never trim or rewrite saved values, copy as exported constants. Pin with Vitest without jsdom. Mockup logic to port: `.planning/research/PLT-08-WELL-PICKER-MOCKUP.html` (script).

Functions per D-12/D-13/D-15: `rowLabel(i)` (A..Z, AA..), `parseRowLabel(s)` (case-insensitive, 1-2 letters, `_ROW_RE`), `blockFits`, `sizeMismatch(src, dst)` (rowCount x colCount product differs), `fieldsToSelection(values, plate)` (returns `undefined` unless all relevant fields parse; flags labels the grid cannot show), and `selectionToPatch` (writes uppercase letters and numbers). Source drag patch has four fields; dest click has two. Clear patch is six `""`.

---

### `components/tools/WellPicker.tsx` (new)

**Analog:** `components/ui/PlateGrid.tsx` borrows only the Chakra colour-token approach (D-10). Do not reuse its plate-type string or its 96 fallback. Use pointer events (`onPointerDown/Enter/Up`, `setPointerCapture`) and a fixed 18 px well (about 12 px for 24 columns). The scroll box has `overflowX="auto"` (G-03-3 lesson). Layout is inline between the plate/deck fields and `volume`, with source and destination side by side wrapping to a stack. "Edit as fields" is a Chakra `Collapse` that is forced open under the D-14 conditions. No `useEffect` is needed if the state is derived from the form values (see the hook-scan precedent for the dropdown files; extend the scan if desired).

---

### Host integration (`AddToolCommandModal.tsx`, `pages/tools/[id].tsx`, `CommandDetailsDrawer.tsx`)

**Modal `OptionsSelect` host** (`AddToolCommandModal.tsx` 310-335):
```tsx
const binding = lookupFieldBinding(selectedToolType, selectedCommand, field.name);
if (binding !== undefined) {
  const showRefresh = firstFieldForSource(fields.map((f) => f.name),
    selectedToolType, selectedCommand, binding.source) === field.name;
  return (<HStack ...><OptionsSelect toolId={selectedToolData?.name} binding={binding}
    value={commandParams[field.name]} values={commandParams} enabled={isOpen}
    allowVariables={true} showRefresh={showRefresh}
    onSelect={(v, kind) => handleOptionSelect(binding, v, kind)} />
```
The same call shape is used in the tool page (`allowVariables={false}`) and the drawer (`enabled` only while `isEditing`). `handleOptionSelect` is where `applyChange` patches are merged.

**No-zero-fill (D-07)** (`AddToolCommandModal.tsx` 212-228):
```tsx
fields.forEach((field: Field) => {
  if (finalParams[field.name] === undefined) {
    if (field.type === "number") { finalParams[field.name] = 0; }
    else if (field.type === "boolean") ...
```
Before the `number` branch, add: if the binding map marks the field `noZeroFill` (both plate ids and both decks), save `""`. Export a helper from `fieldOptions.ts` (e.g. `isNoZeroFill(toolType, command, field)`) so the tool page and drawer can share it. Test: save with untouched plate/deck fields and assert none is `0`. Also grep the tool page and drawer for an equivalent fill-in.

**tip_reuse default (D-09)**: write `tip_reuse: "reuse"` only where a **new** step's params are initialised (find the init near `setCommandParams` when a command is picked), never when opening a saved step. The existing `case "select"` (~L641) falls back to `field.defaultValue`; the checkbox override must not inherit that.

Wire: `test/wire.test.ts:85` sends `tip_reuse: "fresh"`. Do not change the wire shape.

---

### Tests

**Parser tests** (`test/toolOptions.parse.test.ts` 1-60): header comment, `import { describe, it, expect } from "vitest"`, import the exported parsers directly, golden fixtures plus builders (`robotStatesWithCount(n)`), boundary pairs (`1000 ok, 1001 too_large`):
```typescript
const atCap = parseRobotStates(robotStatesWithCount(1000));
expect(atCap).toMatchObject({ shape: "list", degraded: false });
expect(parseRobotStates(robotStatesWithCount(1001))).toBe("too_large");
```
For plates test: id 0, -1, 12.7, 2^31, "12" dropped and `degraded: true`; order kept; `[]` ok; duplicate ids flagged; invalid geometry stays selectable; boundary at the new caps; the `__proto__` own-property case if `parseDeviceTree` tests have one.

**View tests** (`test/fieldOptions.test.ts` 1-40): imports the constants and builders; test born-empty, saved-not-reported, variable-bound, and `lookupFieldBinding` for the new `fast.transfer` fields. Add a pin that `commandFields.fast.transfer` is unchanged.

**Fixtures:** put `fastPlates.ts` beside `test/fixtures/stackOptions.ts` (golden values copied from the frozen commit's test, builders such as `platesWithCount(n)`).

**Static scan** (`test/staticScan.test.ts`). Existing helpers: `read`, `walk`, `rel`, `stripComments`. Existing groups to extend: "tool options read path (D-17)" L873 (assert `OPTION_SOURCE_IDS` or file text contains `"fast.plates"`; assert `get_plates` appears in no `commandFields`; check the decks constant is defined once) and "dropdown control invariants" L969 (add the new deck/plate/checkbox/WellPicker files to the no-first-option list: `options[0]`, `selectedIndex`, `defaultValue`, `defaultChecked`, `selected=`, `placeholder=`). The L964 test pins `describe("commandFields.stack ...")`; check that no existing scan counts sources as exactly four.

---

## Shared Patterns

### Never pick for the operator
**Source:** `fieldOptions.ts` `buildSelectView` (L195-213) and `OptionsSelect.tsx` header. **Apply to:** plate, deck, checkbox, and WellPicker. A view never carries a patch, and loading, refreshing or changing a plate never writes to a field.

### Own-property and verbatim values
**Source:** `toolOptions.ts` `own()` and `fieldOptions.ts` `own()`/`sameName()` (`String(a) === String(b)`, never trimmed). **Apply to:** parser, binding lookup, label matching.

### Variable-like handling
**Source:** `isVariableLike` from `@/utils/variableRef`, used at `fieldOptions.ts` L169 and `toolOptions.ts` L90-93. **Apply to:** the checkbox (disabled), decks, plates, and the six well fields (forces D-14 open).

### Never-throw unavailable
**Source:** `toolOptions.ts` `fetchOptions` (L557+), `unavailable()` helper, `deriveOptionsMode` (`fieldOptions.ts` L110-120). **Apply to:** `fast.plates` offline shows the plain typed input and hint (`UNAVAILABLE_HINT`), never a stale list.

### Hook/ query settings
**Source:** `hooks/useToolOptions.ts` (retry false, no refetch on focus/reconnect, `staleTime: OPTIONS_STALE_MS`, refresh writes into the shared entry via `setData`). **Apply to:** the plate dropdown (no changes needed).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Submodule re-pin of `vendor/galago-tools` and regen of `controller/gen-interfaces/tools/grpc_interfaces/fast.ts` | config/generated | n/a | Process, not code. Follow the Phase 5 D-02 and Phase 6 D-16 ts-proto 1.151.1 scratch-dir regen (see `.planning/milestones/v1.1-phases/05-stack-codegen-command-forms/05-CONTEXT.md`). The gate task (D-01) must pass first: never stub `fast.plates` and never pin to an unfrozen SHA. |
| Drag/pointer well-grid interaction | component | event-driven | No drag component exists. Port the mockup script, `.planning/research/PLT-08-WELL-PICKER-MOCKUP.html`. |

Note: `controller/gen-interfaces` is a tracked path (`git ls-files` lists `fast.ts`). All analog paths above were verified as tracked sources, not capability mirrors.

## Metadata

**Analog search scope:** `controller/server`, `controller/components/{tools,protocols,ui}`, `controller/hooks`, `controller/test`
**Files read:** `toolOptions.ts`, `fieldOptions.ts`, `OptionsSelect.tsx`, `useToolOptions.ts`, `AddToolCommandModal.tsx` (excerpts), test headers and `staticScan.test.ts` excerpts
**Pattern extraction date:** 2026-11-12
