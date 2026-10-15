---
phase: 02-run-page-live-controls
fixed_at: 2026-10-15T03:25:00Z
review_path: .planning/phases/02-run-page-live-controls/02-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 1
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-15T03:25:00Z
**Source review:** .planning/phases/02-run-page-live-controls/02-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope (fix_scope: critical_warning): 2 — `WR-07-FOLLOWUP` and `WR-06` (carried-forward
  residual). `WR-05` is listed under "Still Skipped" in REVIEW.md pending a product/instrument-behavior
  decision and was not attempted here (see Skipped Issues below). The 2 Info findings (`IN-01`, `IN-02`)
  are out of scope for this pass.
- Fixed: 2
- Skipped: 1 (pre-existing product-decision block, not a fix attempt failure)

**Isolation:** All edits and commits were made in an isolated git worktree
(`.claude/worktrees/rf-02-728620-1792034225`, branch `gsd-reviewfix/02-728620`) created from
`feat/fast-tool`, per `workflow.use_worktrees` (default `true`, no override present in
`.planning/config.json`). The worktree was fast-forward-merged into `feat/fast-tool` and cleanly torn
down (temp branch deleted, recovery sentinel removed) after both fixes were committed. The unrelated
pre-existing uncommitted changes in the main checkout (`.gitignore`, `.planning/config.json`,
`.dockerignore`, `.graphifyignore`, `.planning/graphs/`, `.planning/state.json`) were never staged or
touched.

## Fixed Issues

### WR-06 (carried forward, residual scope note): a fourth independent tool-id normalization copy still exists in `server/tools.ts`

**Files modified:** `controller/server/tools.ts`, `controller/server/toolKey.ts`
**Commit:** `949e7c7`
**Applied fix:** Verified the two implementations were byte-for-byte identical
(`(x || "").toLowerCase().replace(/[^a-z0-9]/g, "")`) with compatible call-site semantics (`tools.ts`'s
private helper is only ever called with real `string` arguments, so the stricter `id: string` vs.
`toolKey.ts`'s `s: string | undefined` parameter typing is a non-issue). Migrated `tools.ts` to import
`normalizeToolKey` from `./toolKey` and removed its local duplicate definition. Updated `toolKey.ts`'s
header comment to list all four consolidated call sites (`controlDecision.ts`, `recoveryControl.ts`,
`routers/tool.ts`, and now `tools.ts`'s in-memory tool-store lookup), making the "single source of
truth" framing accurate rather than overstated.

### WR-07-FOLLOWUP: New follow-up-desync toast runs two sentences together with no punctuation when an error message is present

**Files modified:** `controller/components/runs/RunControlConfirmModal.tsx`
**Commit:** `142a7e9`
**Applied fix:** Changed the interpolated error-message clause in `followUpFailureToast` from
`` `: ${message}` `` / `"."` (run-on when `message` is present) to `` ` (${message})` `` / `""`, with the
sentence-ending period moved outside the interpolation so it always terminates the clause regardless of
branch. Message-present case now reads "...recording it in the queue failed (db locked). This step
may..."; message-absent case reads "...recording it in the queue failed. This step may..." — both
grammatically correct with no run-on.

## Skipped Issues

### WR-05: `HEAD_MOVES_NOTE` is shown unconditionally, including for Pause

**File:** `controller/components/runs/controlDecision.ts:17`, `controller/components/runs/RunControlConfirmModal.tsx:231`
**Reason:** Deliberately out of scope per orchestrator instruction and per REVIEW.md's own "Still
Skipped" section — this requires a product/instrument-behavior decision (whether the F.A.S.T. head
genuinely moves on Pause) from whoever owns instrument-core/firmware behavior, not a code-only fix.
No code in this diff touches it; carried forward unchanged.
**Original issue:** `HEAD_MOVES_NOTE = "The instrument head will move."` renders unconditionally for
every control action, including Pause, which may not be instrument-behavior-accurate.

## Verification

- `npm --prefix controller run test:unit`: **211/211 tests passed** (11 test files), run in the main
  checkout after the worktree was fast-forward-merged and torn down.
- `npm --prefix controller test` (`tsc --noEmit`): **clean, no errors.**
- `npx prettier --check` on all 3 touched files (`controller/server/tools.ts`,
  `controller/server/toolKey.ts`, `controller/components/runs/RunControlConfirmModal.tsx`): **all
  matched files use Prettier code style.**

All three gates were run in the **main checkout** (`/home/formulatrix/data/nikko/galago-core`) after the
fast-forward from the isolated worktree, since the worktree had no `node_modules` (by design — it was
created fresh via `git worktree add` and never had dependencies installed). The numbers above are
reproducible from the current `feat/fast-tool` tree.

---

_Fixed: 2026-10-15T03:25:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
