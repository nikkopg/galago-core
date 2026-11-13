---
phase: 07-f-a-s-t-plate-dropdowns
plan: 09
subsystem: tools
tags: [int32, protobuf, grpc, vitest, nextjs, chakra-ui, gap-closure]

requires:
  - phase: 07-f-a-s-t-plate-dropdowns
    provides: plate bindings and applyChange (07-06), well picker core wellGeometry (07-02), three-host OptionsSelect (07-07, 07-08)
provides:
  - controller/utils/int32.ts zero-import int32 exactness rules, F.A.S.T. transfer int32 field table, send-time problem finder and refusal copy
  - Bounded patch producers (applyChange typed plate, numericPatch, wellFieldPatch) that keep out-of-range digits as typed text
  - Too-large well flags in classifyWellValue and a plate id flag on the select view, rendered by OptionsSelect
  - Send-time int32 guard in Tool#executeCommand (after variable substitution, before any gRPC)
affects: [07-10, phase-07-verification, 07-REVIEW-DISPOSITION]

plan_head_before: aaff6595b142b5af601acfa2aa7c6424c80cc12b
plan_head_after: 206107ec424a2a5dd30579b1467bb9ac3eea327c

actuals:
  tokens: 10100
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Shared zero-import utils module (like variableRef.ts) used by client patch producers and the server guard"
    - "Generated-encoder pin test: a hand table is pinned to the int32 writes in the generated protobuf file"
    - "Keep-as-text then flag then refuse-at-send for values the wire format would coerce (PLT-09 pattern)"

key-files:
  created:
    - controller/utils/int32.ts
    - controller/test/int32.test.ts
  modified:
    - controller/components/tools/fieldOptions.ts
    - controller/components/tools/wellGeometry.ts
    - controller/components/tools/OptionsSelect.tsx
    - controller/server/tools.ts
    - controller/test/wire.test.ts
    - controller/test/fastFieldOptions.test.ts
    - controller/test/wellGeometry.test.ts

key-decisions:
  - "Out-of-range digits are kept as the operator's text (never a rounded or wrapped Number); the identity model (numeric id) is unchanged for in-range ids"
  - "The guard lives in Tool#executeCommand after {{variable}} substitution, keyed on the instance's real tool type; estimateDuration and Config stay unguarded (T-07-35, accepted)"
  - "The audit row names the offending fields only, never their values (T-07-34); the thrown message caps each shown value at 40 characters"
  - "The plate flag is not shown for a variable-bound value, and a flagged value never blocks saving a step"

patterns-established:
  - "INT32_PARAM_FIELDS table pinned against fast.ts Command_Transfer encoder so a proto regen cannot silently drift"

requirements-completed: [PLT-04]

coverage:
  - id: D1
    description: "A typed plate id above 2147483647 is kept as the operator's digit text, never truncated or wrapped into a different plate (4294967297 no longer becomes plate 1)"
    requirement: PLT-04
    verification:
      - kind: unit
        ref: "controller/test/int32.test.ts#applyChange typed plate (bounded)"
        status: pass
      - kind: unit
        ref: "controller/test/wire.test.ts#pins the int32 wrap hazard and a typed 2147483647 surviving the real encoder (CR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tool#executeCommand refuses any non-exact int32 F.A.S.T. transfer field with INVALID_ARGUMENTS and zero gRPC sends, after variable substitution, audited without values"
    requirement: PLT-04
    verification:
      - kind: unit
        ref: "controller/test/int32.test.ts#Tool#executeCommand int32 guard (CR-01, T-07-31)"
        status: pass
      - kind: unit
        ref: "controller/test/int32.test.ts#guard runs after {{variable}} substitution (T-07-32)"
        status: pass
      - kind: unit
        ref: "controller/test/operatorOnly.test.ts#is deny-by-listed, not deny-all: a F.A.S.T. transfer executes normally"
        status: pass
    human_judgment: false
  - id: D3
    description: "numericPatch and wellFieldPatch keep digit strings above 2147483647 as text; classifyWellValue flags too-large columns and counts and forces Edit as fields open"
    requirement: PLT-04
    verification:
      - kind: unit
        ref: "controller/test/wellGeometry.test.ts#classifyWellValue too-large flags (CR-01, D-14)"
        status: pass
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#numericPatch and applyLocalChange are bounded to int32 (CR-01)"
        status: pass
    human_judgment: false
  - id: D4
    description: "INT32_PARAM_FIELDS.fast.transfer equals the int32 writes in the generated Command_Transfer encoder, and every accepted value round-trips the real encoder unchanged"
    requirement: PLT-04
    verification:
      - kind: unit
        ref: "controller/test/int32.test.ts#INT32_PARAM_FIELDS pin to the generated encoder (T-07-36)"
        status: pass
      - kind: unit
        ref: "controller/test/int32.test.ts#encoder soundness (T-07-33)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The plate field shows the 'Plate id ... kept as saved, it will not be sent' warning under the control in all three hosts, and Run on the tool page shows the refusal toast with nothing moving"
    requirement: PLT-04
    verification:
      - kind: unit
        ref: "controller/test/fastFieldOptions.test.ts#plate id flag (CR-01, D-06)"
        status: pass
    human_judgment: true
    rationale: "The rendered orange flag, the error toast and the absence of instrument activity cannot be observed under node-only vitest; recorded as the Task 3 human-check for end-of-phase UAT"

duration: 8min
completed: 2026-11-13
status: complete
---

# Phase 07 Plan 09: Int32 exactness for plate, deck and well fields (CR-01) Summary

**Typed or saved plate ids, decks and well numbers that the protobuf int32 encoder would wrap (4294967297 sent as plate 1) are now kept as typed text, flagged in the UI, and refused with zero gRPC sends by a guard in Tool#executeCommand that runs after variable substitution.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-13T07:16:46Z
- **Completed:** 2026-11-13T07:24:53Z (SUMMARY write time; the full gate ran inside this window)
- **Tasks:** 3 (1 tracer, 2 auto, all TDD)
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `controller/utils/int32.ts` (zero imports): `INT32_MAX`, `INT32_MIN`, `int32FromDigits`, `isExactInt32`, deep-frozen `INT32_PARAM_FIELDS` (nine `fast.transfer` fields), `int32ParamProblems` (own-property lookups, blanks skipped), `int32RefusalMessage` (40-character value cap).
- Typed plate fallback, `numericPatch` (decks and plate selects) and `wellFieldPatch` keep a digit string above 2147483647 exactly as typed; `2147483647` becomes the number. Rows, blanks and non-digit text are unchanged.
- `classifyWellValue` flags a too-large column or count (number or digit string, grid shown or hidden) before the past-the-last-column rule; the flag drives `forceOpen` (`KEPT_OPEN_FLAG`) and the can't-be-shown status through the existing `classifyAll` path with no other edits.
- `buildFieldView` sets `SelectView.flag` (via `plateIdFlag`) for a non-exact, non-blank, non-variable plate value in ok, loading and unavailable modes; `OptionsSelect` renders it in the warning colour linked by `aria-describedby`. No host file was edited.
- `Tool#executeCommand` refuses non-exact int32 values: `ToolCommandExecutionError` with `INVALID_ARGUMENTS`, one `"Int32 Param Refused"` warning that names fields but not values, no gRPC send. Blank and exact values (including legacy `0` and params `{}`) send exactly as before.
- Boundary tests use the real `tool_base.Command` encode/decode: 2147483647 accepted and decodes unchanged; 2147483648 (would decode as -2147483648), 4294967297 (would decode as 1) and the non-safe-integer `"9007199254740993"` are refused or kept as text.

## Task Commits

1. **Task 1 (tracer): kept-as-typed plate id and send-time refusal**
   - RED `cf97d64` (test): pure rules, refusal copy, typed plate bound, Tool-instance refusal, wire hazard; pass-through stub of `int32.ts`
   - GREEN `2d603bc` (feat): int32 module, bounded plate typed branch, `executeCommand` guard
2. **Task 2: bound the other patch producers, flag too-large well values, harden the guard**
   - RED `7336756` (test): numericPatch, applyLocalChange, wellFieldPatch, classifyWellValue, soundness table, generated-field pin, variable substitution
   - GREEN `bab42b3` (feat): bounded `numericPatch` and `wellFieldPatch`, three-way `wholeFromOne`, too-large flags
3. **Task 3: plate id flag in all three hosts, full gate**
   - RED `89ab3fc` (test): `plateIdFlag` and `SelectView.flag` cases; stub of `plateIdFlag`
   - GREEN `206107e` (feat): `plateIdFlag`, `buildFieldView` flag, `OptionsSelect` rendering

**Plan metadata:** recorded in the following docs commit (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## TDD Gate Compliance

All three tasks followed RED then GREEN (3 `test(07-09)` commits each before its `feat(07-09)` commit; no refactor commits).

- **RED Task 1:** 10 of 27 target tests failed on assertions (for example `expected 2147483648 to be '2147483648'`, `expected [] to strictly equal [{field: 'source_plate_id', ...}]`, `expected undefined to be an instance of ToolCommandExecutionError`) against a pass-through `int32.ts` stub. Semantic assessment: the failures are the planned behaviours, not import, syntax or fixture faults. The stub table was shaped (`{ fast: { transfer: [] } }`) so even the field-table case fails on an assertion.
- **RED Task 2:** 6 target tests failed on assertions (unbounded `Number()` conversions and no too-large flag). The int32.test.ts additions in this commit (soundness table, generated-field pin, variable substitution) passed immediately because the Task 1 guard already covers them; they are guard-hardening pins, not new behaviour, and are recorded as such. `git diff --numstat 7336756^..7336756` shows 0 deleted lines for `wellGeometry.test.ts` and `fastFieldOptions.test.ts`.
- **RED Task 3:** 3 target tests failed on assertions against a `plateIdFlag` stub returning `""` and no `flag` on the view.
- The `gsd_run check tdd-red-evidence` classifier was not run: the plan is `type: execute` (task-level `tdd="true"`), and vitest's TAP output for this suite is not in a format the classifier accepts without a rerun reporter. The evidence above is the real vitest failure output.

## Files Created/Modified

- `controller/utils/int32.ts` - shared int32 exactness rules, field table, problem finder, refusal copy
- `controller/test/int32.test.ts` - pure rules, soundness table, generated-field pin, Tool-instance refusal and variable-substitution cases
- `controller/components/tools/fieldOptions.ts` - bounded `numericPatch` and plate typed branch, `plateIdFlag`, `SelectView.flag`, flag set in `buildFieldView`
- `controller/components/tools/wellGeometry.ts` - bounded `wellFieldPatch`, three-way whole-number classifier, too-large flags
- `controller/components/tools/OptionsSelect.tsx` - renders `view.flag` in the warning colour with its own `useId`
- `controller/server/tools.ts` - int32 guard in `Tool#executeCommand`
- `controller/test/wire.test.ts`, `controller/test/fastFieldOptions.test.ts`, `controller/test/wellGeometry.test.ts` - added cases only; no existing assertion edited

## Decisions Made

- The stored value for an out-of-range id is the operator's digit string, not a number; the identity model for in-range ids (the numeric id) is unchanged (assumption-delta: no-change).
- Guard placement after the substitution loop makes variable-resolved values safe; `estimateDuration` and `Config` stay unguarded (T-07-35, accepted: neither moves anything, and `estimateDuration` sees variables before substitution).
- The `forceOpen`, `sourceBlock`, `fieldFlags` and `statusLine` functions needed no edits; they pick up the new flag through `classifyAll`.

## Deviations from Plan

None - plan executed exactly as written. The RED commits for Tasks 1 and 3 each carry a small stub of the new export, as the plan's action text prescribes, and Task 3's stub also carries the `flag?: string` type member so `tsc --noEmit` stays clean at the RED commit.

**Total deviations:** 0.
**Impact on plan:** none.

## Issues Encountered

None. Behaviour change called out by the plan and now in force: a non-blank int32 transfer value that is not a canonical in-range whole number ("abc", "3.5", " 3", "1e3", "0x10", `true`, 12.7) is refused by the controller before gRPC; previously the encoder silently coerced them (3, 3, 1000, 16, 1, 12) or the adapter refused "abc" as 0. Blank values keep today's behaviour.

## Verification (full gate, all green)

- `npx vitest run test/int32.test.ts test/wire.test.ts test/fastFieldOptions.test.ts test/wellGeometry.test.ts test/operatorOnly.test.ts test/commandParams.test.ts` green (the existing operatorOnly "deny-by-listed" test passes unedited; commandParams still saves an unset plate as "", D-07).
- `npx tsc --noEmit` exit 0; `npx vitest run` 36 files, 1074 tests passed; `npx prettier . --check` clean; `npx next lint --no-cache --quiet` no warnings or errors; `npm run build` succeeded in place (no mktemp copy needed).
- `PIN_HELD`: `vendor/galago-tools` at `d53da5384f9f99d6751a5abfbbe0abbaa7a02389`, no diff in `controller/gen-interfaces`.
- Acceptance greps: `int32ParamProblems(` 1, `INVALID_ARGUMENTS` 1, `Int32 Param Refused` 1 in `server/tools.ts`; `int32FromDigits(` 2 in `fieldOptions.ts` and 1 in `wellGeometry.ts`; `too large (max` 2 in `wellGeometry.ts`; `view.flag` 3 in `OptionsSelect.tsx`; `plateIdFlag` 2 in `fieldOptions.ts`; 0 imports in `int32.ts`. No task commit touches `controller/components/protocols` or `controller/pages`.

## Human check recorded for end-of-phase UAT

With a configured F.A.S.T. tool (never with values the instrument would accept, so nothing moves): (1) stop the tool server, type 4294967297 into source_plate_id on the tool page and press Run: expect the orange plate flag and the error toast "was not sent: source_plate_id = '4294967297'" with no motion; (2) replace with 2147483647 without running: the flag disappears; (3) in a protocol Add Command, open Edit as fields, type 4294967298 into num_rows and save: expect "num_rows '4294967298' is too large (max 2147483647) — kept as saved", "Kept open: a value needs attention", and the step saves.

## Known Stubs

None. The RED-phase stubs were replaced in the GREEN commits.

## Threat Flags

None. The only new trust-boundary behaviour is the mitigation set in the plan's threat model (T-07-31 to T-07-36); no new endpoints, auth paths or schema changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gap CR-01 / SC3 / PLT-04 can be re-verified as closed; the orchestrator can mark CR-01 fixed in `07-REVIEW-DISPOSITION.md`.
- WR-02, WR-03, IN-01 stay open by orchestrator decision; 07-10 covers the pointer sequence (IN-02).

---
*Phase: 07-f-a-s-t-plate-dropdowns*
*Completed: 2026-11-13*

## Self-Check: PASSED

All created and modified files exist on disk; commits cf97d64, 2d603bc, 7336756, bab42b3, 89ab3fc and 206107e are ancestors of HEAD; the plan-level `<verification>` commands were re-run and pass.
