---
phase: 02-run-page-live-controls
reviewed: 2026-10-15T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - controller/components/runs/ControlBar.tsx
  - controller/components/runs/InstrumentStopModal.tsx
  - controller/components/runs/RunControlConfirmModal.tsx
  - controller/components/runs/RunsComponent.tsx
  - controller/components/runs/controlDecision.ts
  - controller/components/runs/status/QueueStatuscomponent.tsx
  - controller/components/runs/stopInterception.ts
  - controller/server/recoveryControl.ts
  - controller/server/routers/tool.ts
  - controller/server/toolKey.ts
  - controller/test/stopInterception.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 2: Code Review Report (re-review after fix pass)

**Reviewed:** 2026-10-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This is a re-review scoped to what changed since `94f920d` (`git diff 94f920d HEAD -- controller`): the six fixes applied against the original `02-REVIEW.md` (WR-01, WR-02, WR-03, WR-04, WR-06, WR-07) plus the control-bar styling commit `d4726ff`. The safety invariants re-checked directly against the diff all hold: no control action is built or sent without an operator's completed, explicit choice (the `completeDecisions`/`allDecisionsChosen` gate is untouched by this diff); no timers or auto-confirm were introduced anywhere in the changed code; no instrument-state check was added to any galago-core module (`recoveryControl.ts`'s refusal check still reads only queue state, per its own comment); and Stop/Clear-All/Delete-Run still only run their queue-side follow-up after `runAfterAccepted` reports an accepted abort (`runAfterAccepted` itself is untouched).

Of the 6 fixes claimed as applied in `02-REVIEW-FIX.md`, all 6 were verified against the actual current source and found correctly and soundly implemented:
- **WR-01** (unsound stop-request cast): `shouldInterceptRunDelete`/`shouldInterceptQueueStop` now return the type predicate `envelope is RunningEnvelope`, and `RunsComponent.tsx`'s delete-button `onClick` re-invokes the guard and returns early if false, instead of trusting an `as RunningEnvelope` cast. Confirmed fixed.
- **WR-02** (two modals open at once): `ControlBar.tsx` now gates `ToolPausedModal`'s `isOpen` on `request === null`, closing the stacking window for the bar-scenario this review flagged (and, as a side effect, also closes the previously-unflagged prompt-origin variant of the same stacking bug — clicking Resume/Abort inside `ToolPausedModal` sets a `request`, which now immediately suppresses the paused-prompt modal underneath it instead of leaving both open). The cross-component `RunsComponent`/`QueueStatusComponent` scenario was documented in place per the review's accepted option (b), with matching inline comments at both mount sites; this is deliberate, not an oversight. Confirmed fixed/documented as intended.
- **WR-03** (remount key doesn't disambiguate by identity): `RunControlConfirmModal` now bumps a ref-held counter whenever the `request` object reference changes while non-null, and folds it into the body's remount key. `InstrumentStopModal`'s previously-every-render-rebuilt request object is now `useMemo`'d on its own stable `request` prop, which is necessary for the new identity-based key to work at all (confirmed: without the memo, every poll tick would have spuriously remounted the body and wiped in-progress decisions). The ref-mutate-during-render pattern used here matches React's own documented "store information from previous renders" idiom and is idempotent under re-render/Strict-Mode double-invocation. Confirmed fixed.
- **WR-04** (`stopModalBody` hardcoded `return_liquid`): now takes `toolType`, derives decision keys from `getActionSpec(toolType, "abort")`, and falls back to a plain sentence when a tool type declares no abort decisions. Both call sites and the test suite were updated consistently; verified the new `(toolType, values)` signature end to end from `InstrumentStopModal` through to the test file. Confirmed fixed.
- **WR-06** (triplicated tool-id normalization): new zero-import `controller/server/toolKey.ts` is now the single implementation; `controlDecision.ts` re-exports it, `recoveryControl.ts` and all three inline copies in `routers/tool.ts` now import it. Verified no stray `const normalize = ...` redefinitions remain in `tool.ts`. Confirmed fixed, with one residual note below (IN-03).
- **WR-07** (failed follow-up after accepted abort leaves desync unflagged): replaced with a persistent, non-dismissable-by-timeout, explicitly-worded toast naming the desync and telling the operator what to do, at both call sites (`closeOnDispatch` and the normal path). No auto-retry was added, matching the explicit constraint. Confirmed fixed in substance, but see WR-07-FOLLOWUP below — the new copy itself has a wording bug when an error message is present.

One new, review-pass-introduced defect was found in the WR-07 fix (below), and the already-known, deliberately-skipped WR-05 is carried forward unchanged (no code in this diff touches it). The two pre-existing Info items (`RunsComponent.tsx` dead state/console artifact, `constants.ts`'s `tip_reuse` free-text field) are still present and unaffected by this diff; carried forward as still valid.

## Warnings

### WR-07-FOLLOWUP: New follow-up-desync toast runs two sentences together with no punctuation when an error message is present

**File:** `controller/components/runs/RunControlConfirmModal.tsx:46-53`
**Issue:** The new `followUpFailureToast` (added by the WR-07 fix) builds its description as:
```ts
function followUpFailureToast(message: string | undefined): void {
  persistentErrorToast(
    "Instrument aborted, but the queue did not update",
    `The instrument accepted the abort, but recording it in the queue failed${
      message ? `: ${message}` : "."
    } This step may still show as running here even though the instrument has stopped — verify the instrument directly and do not rely on this page's status for it until resolved. This was not retried automatically.`,
  );
}
```
When `message` is present (the common case — it's the caught error's `.message`, e.g. from a rejected `stopMutation.mutateAsync()`), the interpolated branch is `": ${message}"` with no trailing punctuation, and the very next character in the outer template is a space followed directly by the next sentence. The rendered text reads, e.g.:

> "The instrument accepted the abort, but recording it in the queue failed: db locked This step may still show as running here even though the instrument has stopped — verify the instrument directly and do not rely on this page's status for it until resolved. This was not retried automatically."

"`db locked This step`" runs two sentences together with no separator, which is a real readability defect specifically introduced by this fix. This is exactly the toast this fix pass added to make an instrument/queue desync "impossible to miss or forget" — a run-on, hard-to-parse message works against that goal. (The `message === undefined` branch is unaffected: it already ends in a period.)
**Fix:** Add the missing separator/period, e.g.:
```ts
message ? `: ${message}.` : "."
```
or restructure as two independent sentences so the message is clearly delimited (e.g. put it in parentheses or a quoted clause): `` `...recording it in the queue failed${message ? ` (${message})` : ""}. This step may still show...` ``.

### WR-06 (carried forward, residual scope note): a fourth independent tool-id normalization copy still exists in `server/tools.ts`

**File:** `controller/server/tools.ts:44` (`normalizeToolKey`), compare `controller/server/toolKey.ts`
**Issue:** The WR-06 fix consolidated the three copies the original review cited (`controlDecision.ts`, `recoveryControl.ts`, `routers/tool.ts` ×3) into the new shared `toolKey.ts` module. `server/tools.ts` has its own fourth, textually-identical `normalizeToolKey(id: string): string { return (id || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }` implementing an unrelated in-memory tool-store lookup, which was deliberately left untouched (per `02-REVIEW-FIX.md`, "outside this phase's `files_reviewed_list`"). This is a reasonable scoping call for a targeted fix pass, not a defect in the fix itself, but it means the "single source of truth" framing in `toolKey.ts`'s own header comment ("Single source of truth for tool-id normalization") is currently inaccurate — a future change to the normalization rule (e.g. adding diacritics folding) would still need to remember this fourth site, which is exactly the kind of drift WR-06 was raised to prevent. Downgraded to Info-adjacent since it was explicitly scoped out, but flagged as a Warning here because the comment in `toolKey.ts` overstates what was actually achieved.
**Fix:** Either migrate `server/tools.ts` to import `normalizeToolKey` from `./toolKey` too (if its lookup semantics are confirmed compatible), or soften `toolKey.ts`'s comment to acknowledge the fourth independent copy explicitly (e.g. "single source of truth for the client-bar/recovery/getToolFromDB call sites; `server/tools.ts`'s in-memory tool-store lookup keeps its own copy, scoped out of WR-06").

## Info

### IN-01: Dead state and legacy debug artifact in `RunsComponent.tsx` (carried forward, unresolved, pre-existing)

**File:** `controller/components/runs/RunsComponent.tsx:82,142,204`
**Issue:** Unchanged by this diff. `_userFormError` is still set via `setUserFormError(...)` but never read/rendered (`UserFormModal` isn't passed an error prop); line 142 still has the emoji-prefixed `console.error("❌ Failed to load form:", ...)`; line 204 still has an untracked `// TODO: Handle form submission - for now just resume`.
**Fix:** Unchanged from the original review: wire `_userFormError` into `UserFormModal` or remove the dead state; replace the `console.error` with the project's logging convention; resolve or ticket the TODO.

### IN-02: `tip_reuse` command field has no enum/select type despite only two valid values (carried forward, unresolved, pre-existing)

**File:** `controller/components/tools/constants.ts:328`
**Issue:** Unchanged by this diff. `{ name: "tip_reuse", type: "text" }` remains free text despite only "fresh"/"reuse" being valid.
**Fix:** Unchanged from the original review: out of scope for this phase's safety goals; track as a follow-up to extend the field-type system with an enum/select type.

## Resolved (no longer present)

- **WR-01** — fixed. See Summary.
- **WR-02** — fixed/documented per accepted option (b). See Summary.
- **WR-03** — fixed. See Summary.
- **WR-04** — fixed. See Summary.
- **WR-06** — fixed for the three originally-cited call sites; see the residual-scope Warning above for the one site explicitly left out of scope.
- **WR-07** — fixed in substance (persistent, explicit, no-auto-retry desync toast); see WR-07-FOLLOWUP above for a wording defect introduced by the fix itself.

## Still Skipped (unchanged from prior review)

### WR-05: `HEAD_MOVES_NOTE` is shown unconditionally, including for Pause

**File:** `controller/components/runs/controlDecision.ts:17`, `controller/components/runs/RunControlConfirmModal.tsx:231`
**Status:** Deliberately skipped pending a product/instrument-behavior decision (per `02-REVIEW-FIX.md`); no code in this diff touches it. `HEAD_MOVES_NOTE = "The instrument head will move."` still renders unconditionally for every action, including Pause. No change in position on this: it needs a decision from whoever owns instrument-core/firmware behavior for the F.A.S.T. (and any future `runControl` tool type), not a code-only fix from this reviewer.

---

_Reviewed: 2026-10-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
