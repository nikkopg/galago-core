---
phase: 01-queue-control-path-run-state
fixed_at: 2026-10-15T11:32:00Z
review_path: .planning/phases/01-queue-control-path-run-state/01-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-10-15T11:32:00Z
**Source review:** .planning/phases/01-queue-control-path-run-state/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 1 (fix_scope: critical_warning — WR-01; IN-01 and IN-02 excluded by scope,
  since this REVIEW.md cycle reported 0 critical, 1 warning, 2 info findings)
- Fixed: 1
- Skipped: 0

This report replaces the 2026-10-13 `01-REVIEW-FIX.md`, which fixed the prior review cycle's
WR-01/WR-02/WR-03 findings (now closed and not re-raised by the current `01-REVIEW.md`, dated
2026-10-15T11:18:04Z). The current review cycle found one new in-scope finding, reproduced below.

**Verification environment:** Fixes were edited and committed inside an isolated git worktree
(`.claude/worktrees/rf-01-1270568-1792063698`, branch `gsd-reviewfix/01-1270568`) created from
`feat/fast-tool`, per the fixer's worktree-isolation protocol. Since the worktree has no
`controller/node_modules` of its own, a symlink to the main checkout's
`controller/node_modules` (`/home/formulatrix/data/nikko/galago-core/controller/node_modules`)
was created for the duration of verification and removed immediately afterward (plain `unlink`,
not a recursive delete, so the main checkout's real `node_modules` directory was never touched).
`npx tsc --noEmit -p tsconfig.json` and `npm --prefix controller run test:unit` (235 tests, 14
files, all passing) were both run from inside the worktree against this symlink. The worktree's
commit was fast-forwarded onto `feat/fast-tool` and the worktree removed after the commit landed,
so the numbers below are reproducible by checking out `feat/fast-tool` in the main repo and
re-running `npm --prefix controller run test:unit`.

## Fixed Issues

### WR-01: A "goto" step with a missing `targetIndex` silently re-queues the *entire* run instead of throwing

**Files modified:** `controller/server/command_queue.ts`, `controller/server/utils/SqliteQueue.ts`
**Commit:** `7c1d01b`
**Applied fix:** Matched the REVIEW.md suggestion exactly, since the source files were unchanged
from the reviewer's cited context.

- `controller/server/command_queue.ts` (goto Tool Box command handling): captured the raw
  `params?.targetIndex` value before coercion, and changed the guard from
  `targetIndex !== undefined` (always true once `Number(undefined)` produces `NaN`, since
  `NaN !== undefined`) to `rawTargetIndex !== undefined && Number.isInteger(targetIndex) && runId`.
  A goto step with a missing or non-numeric `targetIndex` now falls through to the `else` branch
  and throws `"Goto command requires either targetId or both targetIndex and runId"` instead of
  silently calling `gotoCommandByRunIndex(runId, NaN)`.
- `controller/server/utils/SqliteQueue.ts` (`gotoCommandByIndex`, defense in depth): added
  `!Number.isInteger(targetIndex) ||` to the existing bounds check
  (`targetIndex < 0 || targetIndex >= commands.length`), both of which evaluate to `false` for
  `NaN` and would otherwise let `commands.slice(NaN)` silently requeue the entire run (per
  `Array.prototype.slice` treating `NaN` as `0`). Any non-integer `targetIndex` now throws
  `"Invalid index ... for run ..."` even if a future caller bypasses the
  `command_queue.ts` guard.

Verified: re-read both edited regions (Tier 1); `npx tsc --noEmit -p tsconfig.json` reported zero
errors project-wide, including both modified files (Tier 2); the full `test:unit` suite (235
tests across 14 files, including `sqliteQueue.test.ts`, `toolControl.test.ts`, `queueRestart.test.ts`
and `runState.test.ts`, which the current review cycle's findings are drawn from) passed with no
regressions.

## Skipped Issues

None — the one in-scope finding (WR-01) was fixed and verified.

**Findings excluded by scope** (`fix_scope: critical_warning`, not attempted by this agent):

- **IN-01** (carried forward): `RunStateMonitor.snapshot()` in `controller/server/runState.ts:168-170`
  returns a shallow copy — latent, no current caller mutates the nested fields.
- **IN-02**: `recoverInterruptedSteps` in `controller/server/utils/SqliteQueue.ts:564-605` can emit a
  duplicate, materially-empty log entry if more than one `STARTED` row for the same run is ever
  orphaned simultaneously — a diagnostic/log-noise gap, not a correctness bug, requiring a data
  anomaly that should not occur under normal single-busy-loop operation.

---

_Fixed: 2026-10-15T11:32:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
