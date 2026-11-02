---
phase: 05-stack-codegen-command-forms
plan: 04
subsystem: ui
tags: [stack-tool, value-pipeline, boolean-coercion, protobufjs, omitBlankParams, tdd]

# Dependency graph
requires:
  - phase: 05-stack-codegen-command-forms (plans 05-01/02/03)
    provides: commandFields.stack, generated stack encoder, omitBlankParams STACK-scoped strip, tool-page command forms, D-04 wire pins
provides:
  - coerceBooleanParams — pure boolean-string→real-boolean coercion for STACK sends (nested one level, non-mutating)
  - isBlank treats a NaN number as blank; cleared NumberInput stores the born-empty "" instead of NaN
  - handleSubmit STACK branch sends omitBlankParams(coerceBooleanParams(formValues, fields)) — coerce before strip, STACK only
  - RED evidence records (machine-validated, RED_EVIDENCE_OK ×3) under 05-04-tdd-red/
affects: [05-VERIFICATION re-run, code-review CR-01/WR-01 disposition, any future touch of the STACK send value pipeline]

# Actuals (#2632)
actuals:
  tokens: 3974 # chars/4 over the realized controller diff (15896 chars)
  tasks: 2
  commits: 3 # MEASURED: git rev-list --count $(ledger gsd-plan-head-before-05-04)..HEAD (task commits; the plan metadata docs commit follows)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coerce-in-pipeline-not-swap-control: boolean-typed strings are converted to real booleans in handleSubmit's value pipeline (05-UI-SPEC AC-4 lock honored — the Input type=boolean text control is untouched)"
    - "Valid-RED discipline (#3770): a pass-through RED scaffold stub made the target tests fail on assertion, not on a missing export; evidence machine-validated before GREEN"

key-files:
  created:
    - .planning/phases/05-stack-codegen-command-forms/05-04-tdd-red/red-1.json
    - .planning/phases/05-stack-codegen-command-forms/05-04-tdd-red/red-2.json
    - .planning/phases/05-stack-codegen-command-forms/05-04-tdd-red/red-3.json
  modified:
    - controller/components/tools/commandParams.ts
    - controller/pages/tools/[id].tsx
    - controller/test/commandParams.test.ts
    - controller/test/wire.test.ts
    - controller/test/toolPageReply.test.ts

key-decisions:
  - "Coerce-before-strip in the STACK value pipeline, control unchanged (AC-4): the user's 2026-11-02 decision — a pure coercion step (coerceBooleanParams) runs before omitBlankParams on STACK sends only; the <Input type=\"boolean\"> text field stays verbatim"
  - "NaN-as-blank is narrow: isBlank adds only Number.isNaN(value) — a real 0 and a real false still survive the strip (verification truth 9, D-04); the cleared NumberInput stores \"\" at the source so the strip is defence in depth"
  - "Valid-RED scaffold: coerceBooleanParams landed as an explicit pass-through stub in the test(05-04) commit so the CR-01 RED fails on assertion (string passes through) rather than as an invalid-RED module error (#3770); three records validated RED_EVIDENCE_OK before GREEN"

patterns-established:
  - "Boolean field pipeline rule: STACK boolean fields store operator text as strings; coercion (exact \"true\"/\"false\" literals only) runs before the blank strip; born-empty \"\" passes both untouched and is omitted"
  - "Real-encoder page-pipeline pinning: wire tests feed page-shaped params (string booleans exactly as the page stores them) through the production coercion+strip order, and pin the un-coerced defect decoding true alongside the fixed path decoding false"

requirements-completed: [GEN-02]

coverage:
  - id: D1
    description: "STACK boolean fields send a real boolean through the page value pipeline: a typed \"false\" decodes false on the real generated encoder, a typed string never encodes true by truthiness, \"true\" decodes true, born-empty \"\" is omitted; the uncoerced string sits pinned as the closed defect"
    requirement: GEN-02
    verification:
      - kind: unit
        ref: "controller/test/wire.test.ts#sends a real boolean for a STACK refresh field: a typed 'false' decodes false after coercion (and still decodes true without it)"
        status: pass
      - kind: unit
        ref: "controller/test/commandParams.test.ts#coerceBooleanParams (CR-01) all 5 cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "A visually-emptied STACK number field is omitted: isBlank treats NaN as blank, the NumberInput onChange stores \"\" when cleared, and real 0/false still pass through"
    requirement: GEN-02
    verification:
      - kind: unit
        ref: "controller/test/commandParams.test.ts#treats a NaN number as blank / drops NaN but keeps real 0 and real false"
        status: pass
      - kind: unit
        ref: "controller/test/toolPageReply.test.ts#pins the NumberInput NaN guard"
        status: pass
    human_judgment: false
  - id: D3
    description: "Non-STACK tool types remain byte-identical: every other tool type still sends formValues verbatim; the STACK-only ternary scoping is source-pinned with the coerce-before-strip wrap"
    requirement: GEN-02
    verification:
      - kind: unit
        ref: "controller/test/toolPageReply.test.ts#the STACK send coerces boolean strings then strips blanks"
        status: pass
      - kind: unit
        ref: "controller/test/wire.test.ts#encodes the control payloads into the fast Command oneof (untouched, passes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live UAT sentinel from 05-VERIFICATION item 4: type false into a STACK refresh field and send; type-and-clear a timeout_s and send — wire decodes real false / omit; born-empty display renders unchanged"
    requirement: GEN-02
    verification: []
    human_judgment: true
    rationale: "End-to-end operator-input-to-wire behavior through the live form and the real tool adapter — the repo has no jsdom/RTL, so the render and live send are human/UAT-only (05-VERIFICATION human items 1-4 stand)"

# Metrics
duration: 9min
completed: 2026-11-02
status: complete
---

# Phase 5 Plan 04: Gap-closure (CR-01/WR-01) Summary

**STACK boolean coercion in the real send pipeline: a typed "false" now decodes false on the
real generated encoder, a cleared number field is omitted instead of sending NaN, and the
`<Input type="boolean">` control stays exactly as locked (AC-4) — the CR-01 Critical / WR-01
Warning verification gap is closed with TDD (RED validated via junit + tdd-red-evidence ×3).**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-02T04:00:41Z
- **Completed:** 2026-11-02T04:09:58Z
- **Tasks:** 2
- **Files modified:** 5 (+3 RED evidence records)

## Accomplishments
- `coerceBooleanParams` (pure, non-mutating, one-level nested like omitBlankParams) converts
  boolean-typed string values to real booleans, and handleSubmit now sends
  `omitBlankParams(coerceBooleanParams(formValues, fields))` on STACK only — coercion runs
  before the strip, every non-STACK tool type still passes `formValues` verbatim
- `isBlank` treats a NaN number as blank (WR-01) while keeping real 0/false; the NumberInput
  onChange stores the born-empty `""` instead of NaN when the operator clears a field
- Real-encoder wire proof through the page-shaped pipeline the page actually produces: coerced
  `"false"` → decodes `false`; `"true"` → `true`; untouched `""` → omitted; and the un-coerced
  string sits in the same test decoding `true` — the closed CR-01 defect pinned (Pitfall 5's
  coincidental-reliance item hardened)
- Full phase gate: tsc 0 errors, 608/608 tests across 28 files, prettier clean (599 existing
  tests unregressed; +9 new)

## Task Commits

Each task was committed atomically (TDD: RED and GREEN separately):

1. **Task 1 (test RED): add failing tests for boolean coercion + NaN-as-blank** - `2ca4e4e` (test)
2. **Task 1 (feat GREEN): coerce boolean-typed strings before the STACK strip; NaN is blank** - `debc038` (feat)
3. **Task 2: pin the coerce-before-strip pipeline and NaN guard in tool-page invariants** - `a127fb2` (test, incl. prettier format pass over touched files)

## TDD Record (Task 1, tdd=true)

- **RED:** targets failed intentionally on the planned assertions (no syntax/module/invalid-RED):
  - `omitBlankParams({ timeout_s: NaN })` → `AssertionError: expected { timeout_s: NaN } to strictly equal {}` (WR-01)
  - `coerceBooleanParams({ refresh: "false" }, …)` → `expected { refresh: 'false' } to strictly equal { refresh: false }` (CR-01)
  - wire real-encoder coerced case → `expected true to be false // Object.is equality` (CR-01)
  - Records persisted at `.planning/phases/05-stack-codegen-command-forms/05-04-tdd-red/red-{1,2,3}.json`
    (junit reporter per the Phase-4 decision; vitest default/tap unparseable) and machine-validated:
    `check tdd-red-evidence` → **RED_EVIDENCE_OK** ×3, semantic assessment: every target executed and
    failed for the intended reason (NaN kept by the strip / string passed through by the scaffold
    / truthy string encoded as 1 on the real encoder).
- **GREEN:** minimal implementation (`isBlank` NaN branch + `coerceBooleanParams` real body +
  handleSubmit coerce-before-strip + NumberInput NaN guard) → 17/17 in the two touched files, tsc clean.
- **REFACTOR:** none needed (no post-GREEN source change beyond prettier formatting).

## Files Created/Modified
- `controller/components/tools/commandParams.ts` — NaN-as-blank isBlank + exported pure coerceBooleanParams
- `controller/pages/tools/[id].tsx` — handleSubmit coerce-before-strip (STACK only) + NumberInput NaN guard; control unchanged
- `controller/test/commandParams.test.ts` — coerceBooleanParams describe block + omitBlankParams NaN cases (7 new)
- `controller/test/wire.test.ts` — real-encoder CR-01 boolean case, defect pinned both ways (1 new)
- `controller/test/toolPageReply.test.ts` — coerce-before-strip params pin + NumberInput NaN-guard pin (3 new/updated assertions)

## Decisions Made
- Coerce-not-swap honored (AC-4 lock + user decision 2026-11-02): no Switch, no control change;
  `grep -c 'type="boolean"'` is exactly 1 (the handleSubmit comment originally carrying the
  literal was reworded so the control-unchanged pin keeps its single-match count)
- NaN-as-blank kept narrow: only `Number.isNaN(value)` counts as blank — a real 0 and a real
  false are choices and pass through (D-04); the NaN guard at the NumberInput source is the
  primary fix, the strip rule is defence in depth
- Exact-literal coercion only: `"true"`/`"false"` flip; every other value (born-empty `""`,
  anything else) passes to the strip untouched — no accidental truthiness coercion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED scaffold stub for valid RED (#3770)**
- **Found during:** Task 1 (RED phase)
- **Issue:** The `coerceBooleanParams` unit cases reference a not-yet-existing export; an import
  error is INVALID_RED (an unauthorized failure mode per #3770), so plain "write the test and
  run" could not authorize GREEN
- **Fix:** Added an explicit pass-through RED scaffold stub in the test commit so every target
  fails on ASSERTION; machine-validated RED evidence before GREEN; the real implementation
  replaced it in the feat commit
- **Files modified:** controller/components/tools/commandParams.ts (scaffold → real body)
- **Verification:** check tdd-red-evidence → RED_EVIDENCE_OK ×3; then GREEN 17/17
- **Committed in:** 2ca4e4e (scaffold) / debc038 (implementation)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** The scaffold is TDD-discipline plumbing, not scope creep; nothing else deviated —
all behaviors, files and pins landed exactly as planned.

## Issues Encountered
- The rewritten params-expression pin initially failed twice because prettier's arrow formatting
  puts each call argument on its own line (`),` between the two closing parens, and
  `coerceBooleanParams(\n formValues,`) — the regexes now tolerate whitespace and the trailing
  comma while still proving coercion wraps INSIDE the strip's argument and the `: formValues`
  fallback. Fixed within Task 2; resolved without changing page code.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The Phase-5 verification gap (truth 9, CR-01 + WR-01) is closed at the machine-provable layer
  and the wire hardening runs through the real page pipeline order; re-run phase verification /
  `/gsd-code-review 05` to flip CR-01/WR-01 to fixed
- Human/UAT items from 05-VERIFICATION remain live (config edit render, reply panel on a real
  adapter, born-empty on-screen render, and the CR-01/WR-01 UAT sentinel typing false on a
  refresh field) — no jsdom in the repo, so they stay human territory
- The vendor/galago-tools submodule was not touched by this plan (pinned at bcbbf8e as before)

---

## Self-Check: PASSED

All created/modified files exist on disk and all three task commits are ancestors of HEAD
(2ca4e4e, debc038, a127fb2), verified at 2026-11-02T04:11Z.

---
*Phase: 05-stack-codegen-command-forms*
*Completed: 2026-11-02*
