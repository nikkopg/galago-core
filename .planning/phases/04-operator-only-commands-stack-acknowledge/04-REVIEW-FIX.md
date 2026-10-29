---
phase: 04-operator-only-commands-stack-acknowledge
fixed_at: 2026-10-29T14:42:00Z
review_path: .planning/phases/04-operator-only-commands-stack-acknowledge/04-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-10-29T14:42:00Z
**Source review:** `04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01 … WR-05; IN-01 … IN-05 are out of scope for this pass)
- Fixed: 5
- Skipped: 0

**Verification:** All fixes were made and verified inside the isolated review-fix worktree
(`.claude/worktrees/rf-04-2110186-1793259117`, branch `gsd-reviewfix/04-2110186`; the
fast-forward to `feat/stack-tool` is performed by the cleanup tail, so the commits are
reproducible from the main checkout after the fast-forward). The worktree uses the main
checkout's `controller/node_modules` via symlink. Per-finding gate:
`cd controller && npx vitest run test/staticScan.test.ts` (plus finding-specific suites);
before the last fix commit the full suite (`npm run test:unit` — 23 files / 545 tests
passed), `npx tsc --noEmit` (exit 0), and `prettier --check` all ran clean. Locked design
decisions were honored: no gleam of the latch read entered the send path (the ack gate
added no latch-derived term, D-12 kept — the new unknown branch is render-only before the
not-latched branch), the refusal-order pin and D-08/D-13 semantics were preserved, and the
stage/guard static-scan pins (closed literal set, `.controlCommand(` caller set,
`/latch/i` set, single latch consumer, no-Enter card pins) stayed green.

## Fixed Issues

### WR-01: `extractLatch`'s `unknown` state was never rendered

**Files modified:** `controller/components/tools/RunRecoverySection.tsx`, `controller/test/latchStatus.test.ts`
**Commit:** 34d616d
**Status:** fixed
**Applied fix:** Added the `latchResult.unknown` branch (before the not-latched branch) to
the recovery card with truthful copy ("Unrecognized latch reply / The tool replied, but the
latch state could not be interpreted…") and the raw object rendered as one bounded
`formatLatchRaw` line — the display the D-13 contract names. No latch state reaches the
send path; the ack gate stays `!isValidRecoveryGuid(guid)` only (D-12). Pinned with a new
card source-invariant test asserting the branch's copy and its guard order
(`latchResult.unknown ?` precedes `!latchResult.latched ?`).

### WR-02: `tool.latchStatus` mapped an unreadable reply to a confident NOT-latched verdict

**Files modified:** `controller/server/routers/tool.ts`, `controller/test/latchStatus.test.ts`
**Commit:** 5a7789f
**Status:** fixed
**Applied fix:** `latchStatus` now returns `{ latched: false, unknown: true, raw: {} }`
when the gRPC reply is missing, or the reply has no `meta_data` (undefined/null) — the
D-13 unknown treatment instead of a confident not-latched verdict. Replies carrying
`meta_data` still flow through the pure `extractLatch`. FAILURE / SUCCESS-with-message
still throws via `describeToolReply` upstream. The "no meta_data" test was updated to pin
the unknown mapping.

### WR-03: `validateRecoveryRequest`'s first check was dead and semantically inverted

**Files modified:** `controller/server/recoveryActions.ts`, `controller/test/recoveryActions.test.ts`
**Commit:** 3a5cbc8
**Status:** fixed: requires human verification (logic/ordering change — confirm the
refusal semantics against a running instance)
**Applied fix:** Option (a) per the review. Renamed the parameter to `toolType`, deleted
the "No step is currently running." branch (the recovery gate intentionally has no
queue-state server-side precondition — recovery is allowed while a DIFFERENT tool runs,
D-01; the running-step refusal lives in `recoveryControl` before validation), and the
blank/undefined target type now falls into the tool-type check with a truthful message:
`Tool type "…" does not support recovery actions.` The documented refusal order is
re-lettered (a) tool type unsupported, (b) action not declared, (c) kind failure,
(d) undeclared parameter — first-failing-only kept (D-14). Tests updated: the old
"(a) no running step" test now pins the blank/undefined-as-unsupported mapping and the
order titles were re-lettered. `recoveryControl` remains the only production caller; all
recovery suites and the static-scan pins pass.

### WR-04: Client-controlled `action` interpolated unsanitized into audit-log details

**Files modified:** `controller/server/logger.ts`, `controller/server/recoveryControl.ts`,
`controller/server/command_queue.ts`, `controller/test/setup.ts`
**Commit:** b0dcc40 (plus prettier fixup 511e715)
**Status:** fixed: requires human verification (log-formatting change — confirm details
render normally in the DB)
**Applied fix:** Added `sanitizeLogText` (newlines and U+0000–U+001F → `?`) to
`server/logger.ts` and wrapped the FULL `details` composition at every `logAction` call in
`recoveryControl.ts` and inside `CommandQueue.toolControl` (refusals, transport errors,
strict-success refusals, and success/no-ok outcomes). Only the log string is flattened —
validation inputs, the send path, DB writes, and client-facing error messages stay
verbatim (D-08/D-14 untouched; no send-path behavior change). `test/setup.ts`'s logger
mock was updated to keep the real module and mock only the `logAction` sink.

### WR-05: `run.create` left `numberOfRuns` unvalidated

**Files modified:** `controller/server/routers/run.ts`
**Commit:** fcfc0b3
**Status:** fixed: requires human verification (schema-bound change — confirm the client
flow never needs > 100 runs per call)
**Applied fix:** `numberOfRuns: z.number().int().min(1).max(100).optional()` — zero and
negative values are now rejected by the input contract instead of silently no-oping, and
the upper bound stops a single request from enqueuing an unbounded flood of
instrument runs. The REST `/api/runs` POST path never accepted `numberOfRuns` (single
run), so no other site needed clamping.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-10-29T14:42:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
