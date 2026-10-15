---
phase: 02-run-page-live-controls
fixed_at: 2026-10-15T05:00:00Z
review_path: .planning/phases/02-run-page-live-controls/02-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-15T05:00:00Z
**Source review:** .planning/phases/02-run-page-live-controls/02-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 3 — `IN-01`, `IN-02`, `WR-05`. Iteration 1 (`16318a8`) fixed IN-01 and
  skipped IN-02 (needed a new field type) and WR-05 (needed a product decision). On 2026-10-15 the
  user asked for both to be fixed and chose a per-action head-movement flag for WR-05, so this
  iteration fixes them.
- Fixed: 3
- Skipped: 0
- **Supersedes D-08's blanket rule** ("All actions move the head, so the copy says so", 02-CONTEXT.md):
  the head-moves note is now driven by a per-action declaration, and the F.A.S.T. soft Pause does
  not show it.

## Fixed Issues

### IN-01: Dead state and legacy debug artifact in `RunsComponent.tsx` (carried forward, unresolved, pre-existing, out of this round's file scope)

**Files modified:** `controller/components/runs/RunsComponent.tsx`
**Commit:** `16318a8` (iteration 1)
**Applied fix:** Removed the write-only `_userFormError` state (`UserFormModal` already shows its own
"Form Not Found" alert when `form` is null); replaced the emoji-prefixed `console.error` with the
plain `console.error("Failed to load form:", ...)` style used by sibling calls; reworded the TODO
into an accurate comment (submitting just resumes the queue; form data is not persisted). No
behavior change.

### IN-02: `tip_reuse` command field has no enum/select type despite only two valid values (carried forward, unresolved, pre-existing, out of this round's file scope)

**Files modified:** `controller/components/tools/types.ts`, `controller/components/tools/constants.ts`,
`controller/components/protocols/AddToolCommandModal.tsx`, `controller/pages/tools/[id].tsx`,
`controller/test/commandFields.test.ts` (new)
**Commit:** `957636d`
**Applied fix:** `Field` gains a `"select"` type with an `options` list (`FieldType` updated to
match). `commandFields.fast.transfer.tip_reuse` is now `{ type: "select", options: ["fresh", "reuse"] }`
— exactly the values the F.A.S.T. adapter accepts (`fast_mcp` `_TIP_REUSE_MODES`, confirmed by
`vendor/galago-tools/tools/tests/fast_test.py` "one of fresh, reuse"). Both renderers that show
F.A.S.T. fields render it as a dropdown: the protocol `AddToolCommandModal` (with the existing
variable picker) and the tool page command form. Nothing is preselected; an untouched field still
saves `""` as before. The teach-pendant `CommandModal` is PF400-only and was not changed.
**Tests:** `test/commandFields.test.ts` asserts the tip_reuse declaration and that every select
field has a non-empty, duplicate-free options list.

### WR-05: `HEAD_MOVES_NOTE` is shown unconditionally, including for Pause

**Files modified:** `controller/server/runControl.ts`, `controller/components/runs/controlDecision.ts`,
`controller/components/runs/RunControlConfirmModal.tsx`, `controller/test/runControl.test.ts`,
`controller/test/controlDecision.test.ts`
**Commit:** `d400c42`
**Applied fix:** Added `runControlMovesHead` (deep-frozen, beside `runControl` so the action specs
stay "decision name -> kind") with F.A.S.T. `pause: false`, `resume: true`, `abort: true`, and
`actionMovesHead(toolType, action)`, which returns false only for an explicit own-property `false`.
Undeclared tool types, undeclared actions and inherited names (`constructor`, `__proto__`, …) all
return true, so the copy fails toward warning. `controlDecision.headMovesNote()` returns
`HEAD_MOVES_NOTE` or null, and `RunControlConfirmModal` renders the note only when non-null. No
decision, gate or send path changed.
**Tests:** `runControl.test.ts` (map shape, frozen, key parity with `runControl.fast`, safe
defaults) and `controlDecision.test.ts` (note omitted for F.A.S.T. pause, shown for resume/abort
and for undeclared tool/action).

## Verification

- `npm --prefix controller run test:unit`: **221/221 passed** (12 files).
- `npm --prefix controller test` (`tsc --noEmit`): clean.
- `prettier --check` (repo-root `.prettierrc`) on every touched file: passes.
- `eslint` on the touched UI files: 0 errors; 1 pre-existing warning (`pages/tools/[id].tsx:93`
  exhaustive-deps, untouched line).

---

_Fixed: 2026-10-15T05:00:00Z_
_Fixer: Claude (orchestrator, user-directed)_
_Iteration: 2_
