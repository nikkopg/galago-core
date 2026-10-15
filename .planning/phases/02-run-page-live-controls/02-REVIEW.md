---
phase: 02-run-page-live-controls
reviewed: 2026-10-15T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - controller/components/runs/RunControlConfirmModal.tsx
  - controller/components/runs/pausePrompt.ts
  - controller/server/toolKey.ts
  - controller/server/tools.ts
  - controller/test/pausePrompt.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 2: Code Review Report (incremental re-review)

**Reviewed:** 2026-10-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This is an incremental re-review scoped to `git diff bc817674 HEAD -- controller`, i.e. only the changes made since the prior `02-REVIEW.md` snapshot: `949e7c7` (WR-06 residual: `tools.ts` migrated to the shared `normalizeToolKey` from `toolKey.ts`, header comment updated), `142a7e9` (WR-07-FOLLOWUP: punctuation fix in the abort/follow-up-desync toast), and quick task `261015-f48` (`07fb7fa` + `e6b0e97`: `pausePrompt.ts`'s `describeWrongDetectionEntry` now renders the instrument's `-1`/`"-1"` no-plate sentinel as "none" instead of the literal number/string, with boundary tests added).

All three changes were verified directly against the current source, not just the commit messages:

- **WR-06 residual (now fully resolved):** `controller/server/tools.ts` no longer defines its own `normalizeToolKey`; it imports the one from `./toolKey` (line 10) and uses it at both call sites in `getToolFromStore` (lines 51, 53). A repo-wide grep confirms all four call sites previously cited in WR-06 (`controlDecision.ts`, `recoveryControl.ts`, `routers/tool.ts`, `tools.ts`) now import from the single `controller/server/toolKey.ts` module, and `toolKey.ts`'s header comment was updated to say so accurately. No stray local re-implementations remain. **Resolved.**
- **WR-07-FOLLOWUP (resolved):** `RunControlConfirmModal.tsx:46-53`'s `followUpFailureToast` now interpolates the caught message as a parenthetical clause (`` message ? ` (${message})` : "" ``) followed by a period before the next sentence, instead of the previous `: ${message}` with no trailing punctuation. This removes the run-on "`db locked This step...`" reading reported previously. **Resolved.**
- **Quick task 261015-f48 (resolved, well-tested):** `pausePrompt.ts`'s `isNoPlateDetected` (lines 198-200) now treats `null`, `undefined`, `""`, the number `-1`, and the string `"-1"` as the no-plate sentinel, rendering "found none"; all other values (including `0` and other negative numbers such as `-2`) render verbatim via `String(detectedRaw)`. `controller/test/pausePrompt.test.ts` adds direct coverage for the number sentinel, the string sentinel, a non-sentinel negative (`-2`), zero, and a multi-entry case mixing a sentinel with a real ID — all of which I re-ran (`vitest run test/pausePrompt.test.ts`, 17/17 passing) and traced against the implementation by hand; the behavior matches the stated intent exactly ("no real plate ID is hidden"). `tsc --noEmit` on the controller project is clean, and prettier (with the repo's root `.prettierrc`) reports no formatting issues in any of the five reviewed files.

No new Critical or Warning issues were introduced by this round of changes. The two pre-existing Info items from the prior review round (`RunsComponent.tsx` dead state/console artifact, `constants.ts`'s free-text `tip_reuse` field) are outside this incremental diff's file scope (not in `files_reviewed_list` for this round) and are carried forward below for continuity rather than re-verified against source in this pass. The previously-skipped WR-05 (`HEAD_MOVES_NOTE` shown unconditionally, including for Pause) is untouched by this diff and remains an open product decision, not a code defect — carried forward unchanged.

## Critical Issues

None found in this diff.

## Warnings

None found in this diff.

## Info

### IN-01: Dead state and legacy debug artifact in `RunsComponent.tsx` (carried forward, unresolved, pre-existing, out of this round's file scope)

**File:** `controller/components/runs/RunsComponent.tsx:82,142,204`
**Issue:** Not touched by this diff and not in this round's `files_reviewed_list`; carried forward from the prior review rather than re-verified. `_userFormError` is set via `setUserFormError(...)` but (as of the last verification) never read/rendered; an emoji-prefixed `console.error("❌ Failed to load form:", ...)` remains; an untracked `// TODO: Handle form submission - for now just resume` remains.
**Fix:** Unchanged from the original review: wire `_userFormError` into `UserFormModal` or remove the dead state; replace the `console.error` with the project's logging convention; resolve or ticket the TODO.

### IN-02: `tip_reuse` command field has no enum/select type despite only two valid values (carried forward, unresolved, pre-existing, out of this round's file scope)

**File:** `controller/components/tools/constants.ts:328`
**Issue:** Not touched by this diff and not in this round's `files_reviewed_list`; carried forward from the prior review rather than re-verified. `{ name: "tip_reuse", type: "text" }` was free text despite only "fresh"/"reuse" being valid values.
**Fix:** Unchanged from the original review: out of scope for this phase's safety goals; track as a follow-up to extend the field-type system with an enum/select type.

## Resolved (no longer present)

- **WR-06 (residual scope note)** — fully resolved. `controller/server/tools.ts` now imports `normalizeToolKey` from the shared `controller/server/toolKey.ts` instead of keeping its own copy; the module's header comment accurately reflects all four consuming call sites. Verified via grep across the controller tree and direct read of both files.
- **WR-07-FOLLOWUP** — resolved. The punctuation/run-on wording defect in the abort/follow-up-desync toast is fixed; the message is now parenthesized and properly terminated before the next sentence.

## Still Skipped (unchanged from prior review, no code in this diff touches it)

### WR-05: `HEAD_MOVES_NOTE` is shown unconditionally, including for Pause

**File:** `controller/components/runs/controlDecision.ts:17`, `controller/components/runs/RunControlConfirmModal.tsx:231`
**Status:** Deliberately skipped pending a product/instrument-behavior decision (per `02-REVIEW-FIX.md`); no code in this diff touches it. `HEAD_MOVES_NOTE = "The instrument head will move."` still renders unconditionally for every action, including Pause. This needs a decision from whoever owns instrument-core/firmware behavior for the F.A.S.T. (and any future `runControl` tool type), not a code-only fix from this reviewer.

---

_Reviewed: 2026-10-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
