---
phase: 05-stack-codegen-command-forms
reviewed: 2026-11-02T11:25:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - controller/components/tools/commandParams.ts
  - controller/pages/tools/[id].tsx
  - controller/test/commandParams.test.ts
  - controller/test/toolPageReply.test.ts
  - controller/test/wire.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 5: Code Review Report (incremental re-review, plan 05-04 gap closure)

**Reviewed:** 2026-11-02T11:25:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Incremental re-review of the 05-04 gap-closure delta (commits `2ca4e4e` → `a127fb2`
against diff_base `d0b6d7d`): `coerceBooleanParams` (CR-01 fix), NaN-as-blank in
`isBlank` (WR-01 fix), the NumberInput `""`-on-clear handler in `[id].tsx`, the
coerce-before-strip source pins in `toolPageReply.test.ts`, and the new
real-encoder boolean wire cases in `wire.test.ts`.

**Pipeline invariants verified as still holding on source inspection:**

1. **Coercion-before-strip order** — `omitBlankParams(coerceBooleanParams(formValues, fields))`
   (`[id].tsx:180-187`): coercion runs as the strip's argument (inner), so a string
   `"false"` becomes real `false` *before* the blank strip runs — and real `false`
   is not blank, so it survives. Correct.
2. **STACK-only scoping** — the ternary still falls back to `formValues` verbatim
   for every non-STACK tool type (`[id].tsx:187`); `coerceBooleanParams` and
   `omitBlankParams` are referenced only inside the `String(config?.type) === "stack"` branch
   (`[id].tsx:33, 180-187`), matching the project convention that STACK-specific
   behavior lives behind that branch.
3. **Blank semantics unchanged for non-boolean values** — `isBlank` now treats
   `undefined`, `null`, `""` and `NaN` as blank (`commandParams.ts:14-21`); `0` and
   `false` still pass through (pinned by `commandParams.test.ts:11-17, 53-58`).
4. **gen-interfaces untouched** — the delta diff touches only the five reviewed
   files; no generated encoder was hand-edited.
5. **The pinned CR-01 defect is now a test assertion** — `wire.test.ts:144-155`
   proves on the real generated encoder that the uncoerced `"false"` string encodes
   as `true` (protobufjs `Writer.prototype.bool` is `value ? 1 : 0`,
   `node_modules/protobufjs/src/writer.js:291-293`), so the fixed pipeline at
   `wire.test.ts:158-168` decoding `false` is a genuine regression guard, not a
   tautology.
6. **Display contract preserved** — the `?? ""` born-empty nullish coalescing pins,
   the no-`|| 0`/`|| "false"` scan, and the exact count-of-2 `?? ""` assertions in
   `toolPageReply.test.ts:120-124` still pass (8/8), as do all 25 tests across the
   three reviewed test files (vitest run verified).

**Verification:** CR-01 and WR-01 from the prior 05-REVIEW are fixed and pinned on
both the unit and real-encoder levels. No new critical issues found. Two warnings
remain: one carried-over defect from the prior review that this increment did not
address (WR-02), and one residual edge of the CR-01 fix itself (WR-03). All
findings below carry full file/line evidence; carried items keep their prior IDs
for traceability.

## Critical Issues

None. The prior CR-01 (typed `"false"` encoding as `true`) is closed by the
coercion-before-strip pipeline and is now pinned both ways on the real encoder
(`wire.test.ts:136-194`).

## Warnings

### WR-02 (carried, unresolved in this delta): Command-form seeding effect's nested-group branch is dead and self-overwriting; `FieldType` and `Field.type` disagree

**File:** `controller/pages/tools/[id].tsx:88-113`, `controller/components/tools/types.ts:1-7, 21`

**Issue:** Unchanged by this increment and still unaddressed. The seeding effect's
first `if (Array.isArray(field.type))` branch seeds
`newValues[field.name] = nestedFieldValues` (`[id].tsx:95-102`), but the following
`if (field.type === "text_array") ... else ...` at `[id].tsx:103-108` is *not* an
`else if` — its `else` runs for array-typed fields too (an array is not the string
`"text_array"`), overwriting the just-seeded record with
`field.defaultValue !== undefined ? field.defaultValue : ""` (`[id].tsx:107`). Since
group fields carry no `defaultValue`, the nested seeding can never survive: the
group key is born as the string `""`. `handleInputChange` partially masks this
(`{ ...newValues[parentField] ..., }` over `""` yields `{}` via spread, so each
typed nested key re-materializes a record), but untouched nested keys are born
absent instead of `""` — a divergence from the born-empty contract (UI-SPEC AC-4)
that would surface the moment anyone adds a nested group (the `Field[]` member
exists in `FieldType` precisely for that). Also still escalated: `Field["type"]`
(`types.ts:1-7`) omits `Field[]` while `FieldType` (`types.ts:21`) includes it, so
the nested-group feature is typed in one place and untyped the other.

This matters more now than it did when first reported: `coerceBooleanParams` added
a nested-walk (`commandParams.ts:49-52, 61-66`) that relies on a group value being
a plain record (`isPlainRecord(value)` guard, `[id].tsx` consuming it), and
`omitBlankParams` recursion treats the group member `""` as a top-level blank — so
today the nested coercion walk is reachable only through the spread-masking path.
The dead seeding is a live hazard for exactly the machinery this increment built.

**Fix:** Change the second `if` to `else if (field.type === "text_array")` (and
wrap it in an `else`-chain that skips array-typed fields), and add `Field[]` to
`Field["type"]` in `types.ts` so `Array.isArray(field.type)` narrows correctly in
`renderFields` (`[id].tsx:249`). Mirror the same fix shape the coercion walk
already assumes.

### WR-03 (new, residual of CR-01): STACK boolean fields remain free-text inputs — any non-exact string still silently encodes `true`

**File:** `controller/pages/tools/[id].tsx:280-296` (renderer), `controller/components/tools/commandParams.ts:57-59` (coercion)

**Issue:** The CR-01 gap-closure fixes the wire for the exact strings `"true"` /
`"false"`, but does not fix the root cause the prior review identified: the boolean
branch still renders `<Input type="boolean" ... />` (`[id].tsx:280-282`), and
`boolean` is not a valid HTML input type — the browser falls back to a **text**
input whose `onChange` stores `e.target.value` verbatim. The coercion at
`commandParams.ts:58` (`value === "true" ? true : value === "false" ? false : value`)
leaves every other string untouched, and protobufjs `Writer.prototype.bool` is
`value ? 1 : 0` (verified, `node_modules/protobufjs/src/writer.js:291-293`) — so an
operator-typed `"0"`, `"no"`, `"yes"`, `"TRUE"` or any typo in the boolean field is
a truthy string and still encodes as `refresh: true`. The prior review's CR-01
explicitly enumerated `"0"` and `"no"` among the inputs that send `true`; this
increment narrowed the blast radius to non-exact strings without eliminating it.
The free-text affordance also gives the operator no way to know a boolean field
accepts only the literal words `true`/`false` — an honest-looking input that
silently means `true` for arbitrary text is a wire-correctness hazard on real
STACK motion.

**Fix:** Replace the free-text input with a constrained control (as the prior
CR-01 fix suggested):

```tsx
<Select
  placeholder="Select an option"
  value={(parentField
    ? (formValues[parentField] as Record<string, AtomicFormValues>)?.[field.name]
    : formValues[field.name]) ?? ""}
  onChange={(e) => handleInputChange(field.name, field.type, e.target.value, parentField)}
>
  <option value="true">true</option>
  <option value="false">false</option>
</Select>
```

The existing send-time coercion can then stay as defence in depth. If the text
input must remain for some reason, reject non-`{true,false,""}` values at coerce
time (drop or blank them) rather than letting a truthy string reach
`Writer.bool`. Add a `wire.test.ts` case pinning that `refresh: "0"` / `"no"` never
decode `true`.

## Info

### IN-01 (carried, unresolved): `omitBlankParams` comment understates its recursion; all-blank nested groups collapse to `{}` and survive

**File:** `controller/components/tools/commandParams.ts:73-76, 84`

**Issue:** Still accurate after the delta. The strip comment says nested
parent-field groups get "the same drop one level deep," but the implementation
recurses to arbitrary depth (`commandParams.ts:84`), and a nested group whose every
key is blank strips to `{}` with the group key itself kept. Unreachable with
today's field lists (no STACK or F.A.S.T. field is a nested group — verified,
`constants.ts:346-381`), so behaviorally harmless now.

**Fix:** Document full-depth recursion and the `{}` survival, or drop an emptied
nested group (`if (Object.keys(stripped).length > 0)`).

### IN-02 (carried, unresolved): Dead commented-out code and set-only status state on the tool page (pre-existing)

**File:** `controller/pages/tools/[id].tsx:65-70, 193-246, 53`

**Issue:** Unchanged by this delta. Three commented-out function blocks
(`doesCommandHaveParameters`, `executeCommand`, `__handleSelectCommand`) remain,
and `_commandExecutionStatus` is set-only state — written at `[id].tsx:122, 131-146`
but never read, so the idle/success/error bookkeeping has no consumer.

**Fix:** Delete the commented-out blocks and either render the execution status or
remove `_commandExecutionStatus` / `setCommandExecutionStatus`.

### IN-03 (new): `isBlank`'s NaN guard leaves other unparseable-number outcomes — `±Infinity` passes the strip and reaches the wire

**File:** `controller/components/tools/commandParams.ts:19`, `controller/pages/tools/[id].tsx:339-349`

**Issue:** The NumberInput guard converts only `Number.isNaN(valueNumber)` to `""`;
`isBlank` likewise blanks only NaN. But Chakra's counter parse is
`parseFloat(value.toString().replace(/[^\w.-]+/g, ""))` (`@chakra-ui/counter`,
`use-counter.js:138` — verified), which, unlike `""`, yields **`Infinity`** for
operator-typed `"Infinity"` (all chars are `[\w]` and survive the strip) and
`"1e400"`. `isBlank(Infinity)` is false, so `timeout_s: Infinity` passes
`omitBlankParams` and the generated encoder writes it as a valid double on the
wire. An operator who typed an overflow expression intending a large-but-real
timeout silently sends IEEE `+Inf` as a STACK duration. Low likelihood (requires
literal garbage typing) and it is a pre-existing gap the delta didn't widen, hence
Info — but it is the same failure family WR-01 closed for NaN.

**Fix:** Blank both non-finite branches:
`isBlank` → `(typeof value === "number" && !Number.isFinite(value))` covers NaN and
±Infinity together, and/or extend the NumberInput guard to
`Number.isNaN(valueNumber) || !Number.isFinite(valueNumber) ? "" : valueNumber`.
Pin with a `commandParams.test.ts` case (`omitBlankParams({ timeout_s: Infinity })`
must omit) and optionally a real-encoder case asserting `timeout_s` decodes absent.

---

_Reviewed: 2026-11-02T11:25:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
