---
phase: 01-queue-control-path-run-state
fixed_at: 2026-10-13T03:29:33Z
review_path: .planning/phases/01-queue-control-path-run-state/01-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-10-13T03:29:33Z
**Source review:** .planning/phases/01-queue-control-path-run-state/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (fix_scope: critical_warning — WR-01, WR-02, WR-03; IN-01 excluded by scope)
- Fixed: 3
- Skipped: 0

**Verification environment:** All fixes were verified and tested inside an isolated git worktree
(`.claude/worktrees/rf-01-2177233-1791861610`, branch `gsd-reviewfix/01-2177233`) created from
`feat/fast-tool`, per the fixer's worktree-isolation protocol. `npm install`, `npx tsc --noEmit`,
and the full `vitest` suite were all run from inside that worktree (with `controller/node_modules`
installed fresh there). The worktree's commits were fast-forwarded onto `feat/fast-tool` and the
worktree removed after all three commits landed, so the numbers below are reproducible by checking
out `feat/fast-tool` in the main repo and re-running `npm --prefix controller run test:unit` /
`npm --prefix controller test`.

## Fixed Issues

### WR-01: `toolControl` never re-validates that the captured running step is still current

**Files modified:** `controller/server/command_queue.ts`, `controller/test/toolControl.test.ts`
**Commit:** `62e505c`
**Applied fix:** Added an identity re-check (`if (this._runningStep !== step)`) immediately before
`tool.controlCommand(...)` is dispatched, right after the existing tool-lookup check. On mismatch it
refuses with the same `PRECONDITION_FAILED` shape and `logAction` pattern used by the other
`toolControl` refusals ("no running step", "tool not connected"), rather than silently sending a
control command to a step the operator no longer intended to target. This preserves D-04 — the new
check compares only the running-step record's identity (`this._runningStep !== step`), never any
tool/run state — and does not touch the busy loop or the `_messageResolve`/modal flow.

Added a new regression test, `toolControl > refuses when the running step moves on before dispatch
(WR-01 race guard)`, using the existing `installFakeTool`/`deferred` fakes from
`controller/test/helpers/fakeTool.ts`. Because the vulnerable window in the real control flow is
fully synchronous (no `await` separates the step snapshot from the new check), the test reproduces
"the step changed while/before the control request was dispatched" by giving `Tool.lookup` — the
last synchronous call before the new check — a one-time mock implementation whose side effect
mutates the queue's private `_runningStep` record (simulating the busy loop having moved on to a
different step on the same tool) before calling through to the real lookup. The test asserts the
call is refused with `PRECONDITION_FAILED` and that `grpc.executeCommand` is never called.
Before applying the fix, this test fails (`promise resolved { ok: true, ... } instead of rejecting`);
with the fix in place it, and all 11 other pre-existing `toolControl.test.ts` cases, pass.

### WR-02: `RunStateMonitor`'s in-flight guard can be cleared by a stale poll from a previous generation

**Files modified:** `controller/server/runState.ts`, `controller/test/runState.test.ts`
**Commit:** `42fd1af`
**Applied fix:** `_poll`'s `finally` block now only clears `this.inFlight` when the completing poll's
captured `generation` still matches `this.generation`:
```ts
} finally {
  if (generation === this.generation) {
    this.inFlight = false;
  }
}
```
This stops a stale, superseded-generation poll's response from clearing the flag while a genuinely
outstanding current-generation poll is still in flight, restoring the "at most one call in flight at
a time" invariant (D-11) for the live generation. `stop()`'s own direct `this.inFlight = false` still
handles the legitimate stop/start boundary case, so a `stop()` can never leave `inFlight` stuck. This
is a read-only polling path (D-14 untouched — still only `getStatus` is called; no instrument-state
check or command is added).

Added a new regression test, `RunStateMonitor > a stale poll from a superseded generation does not
clear inFlight for a still-outstanding current-generation poll (WR-02)`, modeled on the existing
"discards a result that lands after stop" test's two-deferred-promise pattern. It starts poll A (left
outstanding), calls `start()` again to bump the generation and start poll B's own call (also left
outstanding), resolves poll A's stale response first, then asserts the next scheduled interval tick
for the live generation does **not** issue a second concurrent `getStatus` call while poll B's own
call is still pending. Before applying the fix, this test fails (`expected "spy" to be called 2
times, but got 3 times` — the extra, bug-induced concurrent call); with the fix, it and all 34 other
pre-existing `runState.test.ts` cases pass.

### WR-03: The new vitest suite is not wired into the CI test gate

**Files modified:** `bin/make`
**Commit:** `003e500`
**Applied fix:** Added `npm run test:unit` to `test_ts()` alongside the existing `tsc --build --clean
&& npm run test` step, exactly as suggested in the review:
```sh
test_ts() {
  echo "Runnning Node Tests"
  (cd controller && npx prettier . --check && npx tsc --build --clean && npm run test && npm run test:unit) &&
  build_prod
}
```
CI (`.github/workflows/main.yml` → `./bin/make test` → `test_ts()`) now runs the full vitest suite
(including the two new regression tests above) as part of the existing automated test gate, not just
`tsc --noEmit`. No changes were needed to `.github/workflows/main.yml` itself — it already invokes
`./bin/make test` unconditionally. Verified with `bash -n bin/make` (syntax check) and by running
`test_ts()`'s updated command sequence manually (`npx tsc --noEmit && npm run test:unit`), both of
which pass.

## Skipped Issues

None — all three in-scope findings (WR-01, WR-02, WR-03) were fixed. IN-01
(`RunStateMonitor.snapshot()` returns a shallow copy) was out of scope for this run
(`fix_scope: critical_warning` excludes Info-level findings) and was not attempted.

---

_Fixed: 2026-10-13T03:29:33Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
