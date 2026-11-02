---
phase: 05-stack-codegen-command-forms
reviewed: 2026-11-02T10:40:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - controller/components/tools/RunRecoverySection.tsx
  - controller/components/tools/commandParams.ts
  - controller/components/tools/constants.ts
  - controller/components/ui/BoundedRawJson.tsx
  - controller/pages/tools/[id].tsx
  - controller/server/recoveryActions.ts
  - controller/test/boundedRawJson.test.ts
  - controller/test/commandFields.test.ts
  - controller/test/commandParams.test.ts
  - controller/test/latchStatus.test.ts
  - controller/test/operatorOnly.test.ts
  - controller/test/recoveryControl.test.ts
  - controller/test/stackActivation.test.ts
  - controller/test/staticScan.test.ts
  - controller/test/toolPageReply.test.ts
  - controller/test/tools.test.ts
  - controller/test/wire.test.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-11-02T10:40:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the Phase 5 STACK codegen & command-forms surface at standard depth: the new
`commandFields.stack` entry (constants.ts), the `omitBlankParams` strip (commandParams.ts), the
extracted shared bounded display (BoundedRawJson.tsx), the tool page's born-empty display +
reply meta_data panel + STACK-only strip ([id].tsx), the `LATCH_READ_COMMAND` unfreeze
(recoveryActions.ts), the latch-display rewire of RunRecoverySection.tsx, and all twelve test
files. Cross-file contracts were traced into `components/runs/controlDecision.ts`,
`components/runs/RunControlConfirmModal.tsx`, `hooks/useRunControl.ts`,
`server/routers/tool.ts`, `server/tools.ts`, and the generated
`gen-interfaces/tools/grpc_interfaces/stack.ts` encoder.

The locked constraints largely hold and are well-pinned: `commandFields.stack` carries no
`defaultValue` and no `select` (D-03), `get_failure_latch` is in and `acknowledge_failure` is
out, `LATCH_READ_COMMAND = "get_failure_latch"` matches the generated oneof key exactly
(GEN-04b pins the encode/decode round trip), the `/latch/i` send-path and single-reader scans
are in place, the card and reply panel are timer-free, the meta_data panel never feeds a send,
and the born-empty render uses nullish coalescing so a typed 0/false survives the display
layer. The "No reply data returned." empty state is a documented design (RESEARCH Pitfall 6 /
assumption A1), not a defect. All 136 tests in the reviewed files pass.

Two wire-correctness defects survive that test coverage because neither the strip tests nor
the wire tests exercise the page's actual value pipeline for boolean and cleared-number
fields: a typed `"false"` in the new STACK `refresh` fields encodes as `true` on the wire
(CR-01), and a typed-then-cleared number sends `NaN` (WR-01). Both trace to the pre-existing
shared form renderer that Phase 5's new STACK field surface now exposes in its born-empty
form. Findings below are ordered by severity.

## Critical Issues

### CR-01: Typed "false" in a STACK `refresh` boolean field encodes as `true` on the wire — the operator cannot send `false`

**File:** `controller/pages/tools/[id].tsx:266-282` (renderer), with `controller/components/tools/constants.ts:364-366` (new STACK boolean fields) and `controller/components/tools/commandParams.ts:12-14` (strip keeps the string)

**Issue:** Phase 5 adds `refresh` (type `"boolean"`, no defaultValue) to the new STACK
`list_devices`, `list_labware_profiles` and `list_transfer_profiles` commands. The shared
form renderer renders boolean fields as `<Input type="boolean" ... />` — `boolean` is not a
valid HTML input type, so the browser falls back to a **text** input and `onChange` stores
`e.target.value`, a **string** (`handleInputChange` only converts `text_array`; booleans are
stored as typed text, `[id].tsx:279-281`). The value then flows:

1. `omitBlankParams` keeps it — the string `"false"` is not `undefined`/`null`/`""`
   (`commandParams.ts:12-14`, and the D-04 contract explicitly wants operator-typed false to
   survive);
2. `Tool._payloadForCommand` (`server/tools.ts:361-367`) embeds it verbatim as the oneof
   message field;
3. the generated encoder writes it whenever `message.refresh !== undefined`
   (`gen-interfaces/tools/grpc_interfaces/stack.ts:660-661`) via protobufjs
   `Writer.prototype.bool`, which is `value ? 1 : 0`
   (`node_modules/protobufjs/src/writer.js:291-293`) — the string `"false"` is truthy, so the
   wire carries `1` and the adapter reads `refresh: true`.

Net effect: **any non-empty text the operator types — `"false"`, `"0"`, `"no"` — sends
`refresh: true`, and there is no input at all that sends `false`.** This directly violates
the phase's locked constraint that an operator-typed false must survive intact (phase context
D-04), and `wire.test.ts`'s blank-optional case never covers a boolean field, so the gap is
untested. The renderer flaw is pre-existing (other tools' booleans shared it), but the STACK
commands that newly expose it ship in this phase.

**Fix:** Make boolean fields a real boolean control and store a real boolean. Minimal, local
change in `[id].tsx` — coerce on input and render a bounded choice:

```tsx
} else if (field.type === "boolean") {
  return (
    <FormControl key={field.name} my={2}>
      <FormLabel>{field.name}</FormLabel>
      <Select
        placeholder="Select an option"
        value={
          ((parentField
            ? (formValues[parentField] as Record<string, AtomicFormValues>)?.[field.name]
            : formValues[field.name]) ?? "") as string
        }
        onChange={(e) =>
          // store a real boolean (or "" for untouched), never a truthy string
          handleInputChange(field.name, field.type, e.target.value, parentField)
        }>
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
    </FormControl>
  );
}
```

and in `handleSubmit`, before the strip, convert boolean strings to booleans (e.g.
`params[field] = value === "true" ? true : value === "false" ? false : value`), or add a
boolean-aware coercion in `omitBlankParams`'s caller for STACK. Add a `wire.test.ts` case:
`refresh: false` must decode `false`, `refresh: "false"`-typed input must never decode `true`.

## Warnings

### WR-01: A typed-then-cleared STACK number field sends `NaN` — the blank strip does not catch it

**File:** `controller/pages/tools/[id].tsx:314-330` (NumberInput onChange), with `controller/components/tools/commandParams.ts:12-14`

**Issue:** Chakra v2's `NumberInput` `onChange(valueString, valueAsNumber)` calls the
user handler with `parse(next)` (`@chakra-ui/counter`: `update` →
`onChangeProp(next.toString(), parse(next))`, where `parse("") = parseFloat("") = NaN`).
When the operator types a value and then clears it — a normal correction flow —
`handleInputChange` stores `NaN` in `formValues` (`[id].tsx:325-327`). `isBlank(NaN)` is
false (`NaN` is neither `undefined`, `null` nor `""`), so `omitBlankParams` **keeps** it and
the STACK send carries `timeout_s: NaN`, which the generated encoder writes as a raw NaN
double (`stack.ts:399-401`, `writer.double(message.timeout_s)`). The born-empty display
change (`?? ""`) fixed only the render side; the input side still poisons `formValues` with
`NaN`, so a field the operator visually emptied is still sent — the exact outcome the
omit-blanks decision exists to prevent. Pre-existing for other tool types, but the STACK
strip's contract makes this phase the place it must be handled.

**Fix:** In `handleInputChange`, store the born-empty `""` when the number is not parseable:

```tsx
<NumberInput
  ...
  onChange={(_valueString, valueNumber) =>
    handleInputChange(
      field.name,
      field.type,
      Number.isNaN(valueNumber) ? "" : valueNumber,
      parentField,
    )
  }
>
```

and/or teach the STACK strip that `Number.isNaN(value)` is blank. Add a
`commandParams.test.ts` case: `omitBlankParams({ timeout_s: NaN })` must omit.

### WR-02: Command-form seeding effect's nested-group branch is dead and self-overwriting; `FieldType` and `Field.type` disagree

**File:** `controller/pages/tools/[id].tsx:88-113` (seeding effect), `controller/components/tools/types.ts:1-20`

**Issue:** Two related defects in the form-value seeding effect:

1. **Self-overwrite (latent logic error):** the first `if (Array.isArray(field.type))`
   branch seeds `newValues[field.name] = nestedFieldValues` (a record), but the following
   `if (field.type === "text_array") ... else ...` is *not* an `else if` and its `else`
   runs for array-typed fields too, overwriting the just-seeded record with `""`
   (`field.defaultValue` is undefined for group fields). The nested seeding can never
   survive. Unreachable today — no `commandFields` entry uses a nested group — but the
   moment anyone adds one (the `Field[]` union member exists precisely for that), the
   seeding silently degrades.
2. **Type split-brain:** `renderFields` guards on `Array.isArray(field.type)`, which TS
   narrows to `never` because `Field["type"]` does not include `Field[]`; the `Field[]`
   member lives only in the separately declared `FieldType` used by `handleInputChange`.
   The nested-group feature is half-wired: executable nowhere, typed in one place,
   untyped in the other.

**Fix:** Make the chain exhaustive and the type honest — either restore nested groups
(change the second `if` to `else if (field.type === "text_array")` and add `Field[]` to
`Field["type"]`), or delete the dead nested-group branch and the `Field[]` member of
`FieldType` so the code and the type agree.

## Info

### IN-01: `omitBlankParams` comment understates its recursion; all-blank nested groups collapse to `{}` and survive

**File:** `controller/components/tools/commandParams.ts:20-23`

**Issue:** The comment says nested parent-field groups get "the same drop one level deep",
but the implementation recurses to arbitrary depth (`omitBlankParams` calls itself for every
plain-object value, line 31). Also, a nested group whose every key is blank is stripped to
`{}` and the group key itself is kept (not dropped), so an empty message still appears on
the wire. Unreachable with today's field lists (no STACK or F.A.S.T. field is a nested
group), so behaviorally harmless now.

**Fix:** Reconcile comment and behavior: either document the full-depth recursion and the
`{}` survival, or drop a now-empty nested group (`if (Object.keys(stripped).length > 0)`).

### IN-02: Dead commented-out code and set-only status state on the tool page (pre-existing)

**File:** `controller/pages/tools/[id].tsx:65-70, 179-191, 222-232, 53`

**Issue:** Three large commented-out function blocks (`doesCommandHaveParameters`,
`executeCommand`, `__handleSelectCommand`) remain from the pre-refactor page, and
`_commandExecutionStatus` is set-only state — its value is never read anywhere, so the
"idle/success/error" bookkeeping (lines 122, 131-134, 143-146) has no consumer.

**Fix:** Delete the commented-out blocks and either render the execution status or drop
`_commandExecutionStatus`/`setCommandExecutionStatus` entirely.

---

_Reviewed: 2026-11-02T10:40:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
