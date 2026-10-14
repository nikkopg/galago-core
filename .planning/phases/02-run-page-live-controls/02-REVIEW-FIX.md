---
phase: 02-run-page-live-controls
fixed_at: 2026-10-14T13:25:57Z
review_path: .planning/phases/02-run-page-live-controls/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-14T13:25:57Z
**Source review:** .planning/phases/02-run-page-live-controls/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (fix_scope: critical_warning — 0 critical/blocker findings, 7 warnings; the
  2 Info findings in REVIEW.md are out of scope for this pass)
- Fixed: 6
- Skipped: 1

**Verification environment:** All fixes were made and committed inside an isolated git worktree
(`.claude/worktrees/rf-02-4180752-1791983409`, branch `gsd-reviewfix/02-4180752`, forked from
`feat/fast-tool`). The worktree has no `node_modules` by design; a symlink
`controller/node_modules -> <main-repo>/controller/node_modules` was created solely to run the
verification gates below (safe on this Linux host — `rm`/`git worktree remove` do not follow
symlinks into their target) and is not part of any commit. All gates (tsc, vitest, prettier) were
run from inside the worktree against the worktree's own files. The worktree's commits were
fast-forwarded onto `feat/fast-tool` as part of this agent's cleanup; the same gate commands are
reproducible from the main checkout after that fast-forward.

**Final gate results (after all 6 fixes, run together):**
- `npm --prefix controller run test:unit` — 211/211 tests passed (11 files; baseline before any
  fix was 210/210 — WR-04 added one new test case)
- `npm --prefix controller test` (`tsc --noEmit`) — 0 errors
- `npx prettier --check` on every file touched across all 6 fixes — all pass

## Fixed Issues

### WR-01: Unsound type assertion can build a stop request with `toolType: undefined`

**Files modified:** `controller/components/runs/stopInterception.ts`, `controller/components/runs/RunsComponent.tsx`
**Commit:** `8953a59`
**Applied fix:** Changed `shouldInterceptRunDelete`'s return type to the type predicate
`envelope is RunningEnvelope` (it already only returns true when that holds), and re-invoked the
guard inside the per-run delete button's `onClick` handler (fail-closed, `return` if false) instead
of trusting the adjacent ternary's gating via an `as RunningEnvelope` cast. TypeScript's own
narrowing now does the work the cast used to paper over. Removed the now-unused `RunningEnvelope`
type import from `RunsComponent.tsx`.

### WR-02: Two independent confirm modals can be open at once with no mutual exclusion

**Files modified:** `controller/components/runs/ControlBar.tsx`, `controller/components/runs/RunsComponent.tsx`, `controller/components/runs/status/QueueStatuscomponent.tsx`
**Commit:** `2330455`
**Applied fix:** Applied REVIEW.md's option (a) for the `ControlBar` scenario: `ToolPausedModal`'s
`isOpen` is now gated by `request === null`, so an organic new pause episode arriving while a
bar-origin confirm is already open can no longer stack a second modal on top of it;
`prompt.isOpen` still tracks the episode in state and the modal renders as soon as the active
request clears. For the separate `RunsComponent`/`QueueStatusComponent` independent
`InstrumentStopModal` scenario, applied REVIEW.md's option (b): documented in place (with inline
comments at both mount sites) as accepted/self-healing behavior, since no action is ever sent
without confirmation (`confirmStillValid` closes the stale modal) and unifying the two independent
state slots would require lifting state to a shared parent/context — out of scope for a targeted
fix pass. No regression test was added for the documented scenario (see note below).

### WR-03: Confirm-modal remount key doesn't disambiguate by request identity

**Files modified:** `controller/components/runs/RunControlConfirmModal.tsx`, `controller/components/runs/InstrumentStopModal.tsx`
**Commit:** `969ed53`
**Applied fix:** `RunControlConfirmModal` now tracks the `request` object reference across renders
and bumps an internal counter whenever it changes while non-null, folding that counter into the
body's remount key (previously only `toolType:action`). This guarantees the body always remounts
(and D-07's "decision state is always born empty" holds) even when one non-null request is
replaced directly by a different non-null request of the same `toolType`/`action` — e.g. two
buttons that both resolve to `{toolType:"fast", action:"abort"}`. Discovered during implementation
that `InstrumentStopModal` was rebuilding a brand-new request object literal on every render
(including poll-driven re-renders of an already-open confirm) — with the new identity-based key
alone, this would have spuriously remounted the body and wiped the operator's in-progress decision
on every poll tick. Fixed by memoizing that object (`useMemo`, keyed on `InstrumentStopModal`'s own
stable `request` prop) so its identity only changes when the caller actually sets a new stop
request.

### WR-04: `stopModalBody` hardcodes the `return_liquid` decision key

**Files modified:** `controller/components/runs/stopInterception.ts`, `controller/components/runs/InstrumentStopModal.tsx`, `controller/test/stopInterception.test.ts`
**Commit:** `723d0e1`
**Applied fix:** `stopModalBody` now takes a `toolType` parameter and derives the decisions to
restate from `getActionSpec(toolType, "abort")`'s declared keys (mirroring `restateChoice`),
instead of hardcoding `return_liquid`. A tool type with no declared abort decisions gets a plain
fallback sentence ("Abort the instrument run.") rather than permanently rendering "not chosen".
`InstrumentStopModal` now curries the toolType from its own request when passing `stopModalBody` as
the confirm-modal body override. Updated `stopInterception.test.ts` for the new
`(toolType, values)` signature (output casing changed slightly, from `(return liquid? Yes)` to
`(Return liquid? Yes)`, since it's now derived from the shared `decisionLabel` helper) and added a
case covering a tool type with no declared abort decisions.

### WR-06: Tool-id normalization is reimplemented independently in three places

**Files modified:** `controller/server/toolKey.ts` (new), `controller/components/runs/controlDecision.ts`, `controller/server/recoveryControl.ts`, `controller/server/routers/tool.ts`
**Commit:** `df87b45`
**Applied fix:** Added a new zero-dependency module `controller/server/toolKey.ts` exporting
`normalizeToolKey`, following the same client-safe zero-import idiom already used by
`@/server/runControl`'s `getRunControl`. `controlDecision.ts` now imports and re-exports it (so
existing importers of `normalizeToolKey` from `controlDecision.ts`, including
`test/controlDecision.test.ts`, keep working unchanged); `recoveryControl.ts` and
`routers/tool.ts` (all three of its inline copies — `getToolFromDB`, the `status` procedure, and
the `info` procedure) now import the same implementation instead of each keeping an independent
copy "in sync by convention, not import". `server/tools.ts` has its own `normalizeToolKey` for an
unrelated, pre-existing in-memory tool-store lookup — not cited in REVIEW.md and outside this
phase's `files_reviewed_list` — and was deliberately left untouched to keep this fix scoped to the
flagged call sites.

### WR-07: A failed Stop/Clear-All/Delete-Run follow-up after an accepted abort leaves queue state desynced from instrument state

**Files modified:** `controller/components/runs/RunControlConfirmModal.tsx`
**Commit:** `2ca0e57`
**Applied fix:** Per the explicit constraint that an automatic retry/re-send is never acceptable
here, replaced the generic, dismissable "Follow-up failed" toast (raw error message only) with a
single persistent toast (same non-auto-dismiss `duration: null` as before) that explicitly names
the desync ("the instrument accepted the abort, but recording it in the queue failed"), tells the
operator what to do ("verify the instrument directly and do not rely on this page's status for it
until resolved"), and states plainly that nothing was retried automatically. No automatic retry,
reconciliation, or instrument-state check was introduced — this only changes what the operator is
told at both of the two identical call sites (`closeOnDispatch` and normal paths).

## Skipped Issues

### WR-05: `HEAD_MOVES_NOTE` is shown unconditionally, including for Pause

**File:** `controller/components/runs/controlDecision.ts:16`, `controller/components/runs/RunControlConfirmModal.tsx:193-194`
**Reason:** Skipped — requires confirmation of actual instrument/firmware behavior that this fixer
cannot safely determine from the codebase alone. REVIEW.md's own fix guidance is explicitly
conditional: "If pause genuinely never causes head motion, suppress the note for `action ===
"pause"`; if it sometimes does ... confirm this with the instrument-core behavior." Neither
`runControl.ts`, `02-CONTEXT.md`, nor `PROJECT.md` state whether the F.A.S.T. (or any future
`runControl` tool type) moves its head during a pause. Changing this safety disclaimer in either
direction without that confirmation carries real risk: suppressing it could hide a true warning for
a tool/firmware combination where pause does move the head; leaving it could continue to train
operators to ignore a sometimes-inapplicable disclaimer. This needs a decision from whoever owns
the instrument-core/firmware behavior, not a code-only fix.
**Original issue:** `HEAD_MOVES_NOTE = "The instrument head will move."` renders for every action's
confirm dialog without exception, including Pause, where it reads as contradictory ("Pause the
F.A.S.T. run?" immediately followed by "The instrument head will move.") and risks training
operators to treat the disclaimer as always-on noise rather than a fact to verify before each
physically consequential confirmation.

## Notes on partial coverage

- WR-02's cross-component scenario (independent `InstrumentStopModal` state in `RunsComponent` vs.
  `QueueStatusComponent`) was documented rather than structurally fixed, and REVIEW.md's suggested
  regression test for the "pause arrives while a bar-origin confirm is open" interleaving was not
  added — the existing test suite (`controlDecision.test.ts`, `pausePrompt.test.ts`,
  `stopInterception.test.ts`, `staticScan.test.ts`, etc.) tests pure logic modules only; there is no
  React-component-rendering test harness (React Testing Library / jsdom render) currently set up in
  this project to exercise multi-modal interleaving at the component level. Adding one was judged
  out of scope for a targeted fix pass.

---

_Fixed: 2026-10-14T13:25:57Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
