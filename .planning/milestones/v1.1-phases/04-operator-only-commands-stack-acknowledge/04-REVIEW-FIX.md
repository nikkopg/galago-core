---
phase: 04-operator-only-commands-stack-acknowledge
fixed_at: 2026-10-29T14:47:30Z
review_path: .planning/phases/04-operator-only-commands-stack-acknowledge/04-REVIEW.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-10-29T14:47:30Z
**Source review:** `04-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 5 (IN-01 … IN-05 only; WR-01 … WR-05 were fixed in iteration 1 — commits
  34d616d / 5a7789f / 3a5cbc8 / b0dcc40 / fcfc0b3 — and were NOT redone)
- Fixed: 5
- Skipped: 0

**Verification:** All fixes were made and verified inside the isolated review-fix worktree
(`.claude/worktrees/rf-04-2129470-1793259821`, branch `gsd-reviewfix/04-2129470`; the
fast-forward to `feat/stack-tool` is performed by the cleanup tail, so the commits are
reproducible from the main checkout after the fast-forward). The worktree symlinks the main
checkout's `controller/node_modules`. Per-finding gate:
`cd controller && npx vitest run test/staticScan.test.ts` (plus finding-specific suites —
recoveryControl/controlDecision/latchStatus/operatorOnly). Before the last fix commit the
full gates ran clean in the worktree: `npm run test:unit` (23 files / 545 tests passed),
`npx tsc --noEmit` (exit 0), and `prettier --check .` (clean). Locked design decisions were
honored throughout:

- `/latch/i` still appears in none of the four send-path files (recoveryControl.ts,
  controlDecision.ts, RunControlConfirmModal.tsx, hooks/useRunControl.ts) and the IN-03 catch
  gates nothing on the send path — display-only (D-12).
- D-08 guid untouched; D-09 card grey-out untouched; D-23 one-attempt no-deadline send
  untouched; D-01 fast entries remain in the refuse table.
- Static-scan pins stayed green after every change: closed 4-file `/latch/i` literal set,
  guard-first executeCommand ordering, single latch reader, no-Enter card, no
  instrument-state checks, send called only from the Confirm handler.
- Zero-import discipline kept: `server/recoveryActions.ts` and `server/operatorOnlyCommands.ts`
  still have `grep -cE '^[[:space:]]*import\b|^from '` = 0.

## Fixed Issues

### IN-01: `RECOVERY_STRICT_SUCCESS` lookup used a prototype-exposed index

**Files modified:** `controller/server/recoveryControl.ts`
**Commit:** 10b9ae3
**Status:** fixed
**Applied fix:** The (d) strict-success check now indexes through an explicit
`Object.prototype.hasOwnProperty.call(RECOVERY_STRICT_SUCCESS, String(toolType))` guard
before reading the actions array — the same D-04 discipline every sibling lookup in the
phase uses. For `toolType` values like `"toString"` or `"constructor"` the code now falls
through to the graceful result mapping instead of dereferencing an inherited `Function` and
throwing. Comment added explaining the invariant; no behavior change for real tool types.

### IN-02: Dead field `RunStore.nextRunId` was never used

**Files modified:** `controller/server/runs.ts`
**Commit:** 2e5d7e5
**Status:** fixed
**Applied fix:** Deleted the `nextRunId = 1;` class field. Run ids still come exclusively
from `snowflakeIdGenerator.nextId()`; grep confirms no `nextRunId` reference remains in
`controller/`.

### IN-03: `readClick` awaited `latchQuery.refetch()` without a catch

**Files modified:** `controller/components/tools/RunRecoverySection.tsx`
**Commit:** 2205395
**Status:** fixed
**Applied fix:** Added a `catch` alongside the existing `try/finally` in `readClick`: a
rejecting refetch now drops the previously shown latch result (`setLatchResult(null)`,
matching the `refetched.error` path) and surfaces "Latch read failed" through the existing
`persistentErrorToast` — then `finally` still resets the spinner. No timer, no new
component, no inline latch error element; the read still never gates or feeds the send path
(D-12).

### IN-04: `/api/runs` POST default branch leaked raw internal error text

**Files modified:** `controller/pages/api/runs/index.ts`
**Commit:** 5a1e317
**Status:** fixed
**Applied fix:** The unnamed-error `default` branch now responds
`res.status(500).end("Failed to create run")` and logs the raw error server-side via
`console.error("Runs API error:", e)` — the logging convention every other route under
`pages/api/` already uses. The classified branches (ProtocolNotFoundError 404, ZodError and
OperatorOnlyCommandError 400 with their operator-facing text) are untouched, and the "default
stays 500" REST test continues to pass.

### IN-05: Confirm modal resolved the action spec from `runControl` regardless of `target.kind`

**Files modified:** `controller/components/runs/RunControlConfirmModal.tsx`
**Commit:** 7e4f9fd
**Status:** fixed: requires human verification (resolution-order change — confirm on a live
instance that the recovery acknowledge/fast resume-abort modals render exactly as before)
**Applied fix:** The body now selects the spec family from `request.target.kind`: a
`"recovery"` target resolves through `getRecoverySpec` (and never touches
`getActionSpec`); a `"running"` target resolves through `getActionSpec`. The displayed
decision surface is now, by construction, the shape the send gate validates, so a future
divergence between the runControl and recovery families can no longer produce the silent
`completeRecoveryEntries → null → { status: "ignored" }` trap. Today the families are pinned
byte-identical (`recoveryActions.test.ts` "pins the fast entries as exact value copies of
runControl"), so no rendered behavior changes.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-10-29T14:47:30Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_
