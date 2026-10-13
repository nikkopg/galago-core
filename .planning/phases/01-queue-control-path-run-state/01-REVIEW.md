---
phase: 01-queue-control-path-run-state
reviewed: 2026-10-13T03:08:16Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - controller/server/command_queue.ts
  - controller/server/routers/command_queue.ts
  - controller/server/runControl.ts
  - controller/server/runState.ts
  - controller/server/tools.ts
  - controller/package.json
  - controller/vitest.config.mts
  - controller/test/setup.ts
  - controller/test/helpers/fakeTool.ts
  - controller/test/infra.test.ts
  - controller/test/runControl.test.ts
  - controller/test/runState.test.ts
  - controller/test/toolControl.test.ts
  - controller/test/tools.test.ts
  - controller/test/wire.test.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-13T03:08:16Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the server-side control path (`toolControl`, `runControl`, `runState`), the heartbeat
retry change, the router wiring, and the new vitest suite added for this phase. The four explicit
safety invariants called out for this phase all hold up under inspection and are exercised by
passing tests:

- `Tool.controlCommand` (the only path that can send Pause/Resume/Abort) is reachable from exactly
  one call site, `CommandQueue.toolControl`, which is itself reachable only from the
  `commandQueue.toolControl` tRPC mutation — confirmed by a repo-wide grep.
- `validateControlRequest` fails closed: only the literal strings `"yes"`/`"no"` are accepted for a
  declared decision (no trim/case-fold/coerce), and both a missing declaration and an extra
  undeclared parameter are refused.
- `RunStateMonitor` only ever calls `tool.grpc.getStatus(...)`; no other tool method is invoked by
  the poller (asserted directly by `tools.test.ts`/`runState.test.ts`).
- `runState`/`toolControl` never read or mutate `isWaitingForInput`/`currentMessage`, and the busy
  loop's own `_messageResolve` flow is untouched by the diff (confirmed by direct diff inspection
  against `fc8716b`).

`tsc --noEmit` is clean and the full new vitest suite (6 files, 90 tests) passes locally
(`npm run test:unit`, 29.7s). Diffs against `fc8716b` for the three pre-existing files
(`command_queue.ts`, `tools.ts`, `routers/command_queue.ts`, `package.json`) are additive only —
no unrelated pre-existing code was touched.

That said, three warnings worth fixing were found, mostly around the two new asynchronous
components (`toolControl`'s running-step snapshot and `RunStateMonitor`'s in-flight guard), plus a
CI gap: the new test suite that encodes this phase's safety guarantees is never actually run by
`bin/make test`.

## Warnings

### WR-01: `toolControl` never re-validates that the captured running step is still current

**File:** `controller/server/command_queue.ts:429-495`

**Issue:** `toolControl` takes a snapshot `const step = this._runningStep;` at the top of the
method, then performs `await tool.controlCommand(action, verdict.decisions)` — an actual gRPC
round trip — using `step.toolId`. Nothing re-checks `this._runningStep === step` either immediately
before the send or after the response comes back. Between the moment the operator's request is
accepted and the moment the gRPC reply returns, the busy loop can finish the original step (its own
`finally` clears `_runningStep` and stops the monitor) and move on to the **next** command on the
**same physical tool** (the common case — most steps in a run target the same instrument back to
back). If that happens, two things can occur:
- a success/failure outcome is logged and returned to the operator as if it still pertains to the
  step they saw, when the queue has already moved on; and
- because `Tool` instances are one persistent gRPC connection per `toolId` (`getGlobalStore`/
  `getToolFromStore` in `tools.ts`), a slow-to-arrive Pause/Resume/Abort and the next step's own
  `executeCommand` payload are in flight on the same channel at the same time, with no guarantee
  about which the tool processes first.

This doesn't violate "never send P/R/A except via toolControl," but it does mean an operator's
safety decision can be delivered to, or attributed to, a step other than the one they intended to
control. No existing test exercises the "step completes while the control request is still in
flight" scenario (every `toolControl.test.ts` case keeps `step` pending across the whole call).

**Fix:** Re-check identity right before dispatch and treat a mismatch as a refusal rather than a
silent send, e.g.:
```ts
const tool = Tool.lookup(step!.toolId);
if (!tool) { /* existing check */ }

// NEW: fail closed if the step moved on between validation and send
if (this._runningStep !== step) {
  const message = "The targeted step is no longer running.";
  await logAction({ level: "warning", action: "Tool Control Refused",
    details: `${baseDetails} outcome=refused: PRECONDITION_FAILED ${message}` });
  throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}

let result: ToolControlResult;
try {
  result = await tool.controlCommand(action, verdict.decisions);
} ...
```
This narrows (but, given the inherent lack of gRPC call cancellation here, does not fully close)
the race window from "entire network round trip" down to "the synchronous portion of the handler,"
and makes the remaining risk visible in the audit log instead of silent.

### WR-02: `RunStateMonitor`'s in-flight guard can be cleared by a stale poll from a previous generation

**File:** `controller/server/runState.ts:170-196`

**Issue:** `_poll`'s `finally { this.inFlight = false; }` resets the flag unconditionally,
regardless of whether `generation` still matches `this.generation`. Consider: poll A (generation 1)
is awaiting a slow `getStatus` call when `stop()`/`start()` run, bumping `this.generation` to 2 and
forcing `this.inFlight = false` directly. A new poll B (generation 2) then begins, setting
`this.inFlight = true` and issuing its own `getStatus` call. If poll A's slow response now resolves
*before* poll B's, poll A's `_applyUnknown`/`_applySuccess` correctly no-ops (generation mismatch),
but its `finally` block still executes `this.inFlight = false` — even though poll B's own call is
still genuinely outstanding. The next `setInterval` tick (for the current, generation-2 step) will
then see `inFlight === false` and fire a second concurrent `getStatus` call for the same step,
violating the documented invariant ("at most one call in flight at a time", D-11) for the live
generation, not just across a stop/start boundary (which `discards a result that lands after stop`
already covers and is fine). Because two now-concurrent current-generation responses apply in
whatever order they resolve, `envelope.status`/`runState` can flicker to an older value after a
newer one was already applied, purely due to network timing, until the next tick corrects it.

This is a read-only polling path (D-14 holds — no commands are sent), so the impact is UI/telemetry
staleness rather than a safety issue, but it's a genuine, unguarded regression against the stated
single-flight invariant and isn't exercised by any current test (the existing "discards a result
that lands after stop" test only advances ~0ms and never lets two same-generation polls race).

**Fix:** Only clear the flag when the completing poll still belongs to the current generation:
```ts
} finally {
  if (generation === this.generation) {
    this.inFlight = false;
  }
}
```
`stop()`'s own direct `this.inFlight = false` already handles the generation-boundary case, so this
change doesn't reintroduce a stuck `inFlight` after a `stop()`.

### WR-03: The new vitest suite is not wired into the CI test gate

**File:** `controller/package.json:9-19`, `bin/make:32-40`, `.github/workflows/main.yml`

**Issue:** This phase's entire safety-relevant behavior (toolControl refusals, fail-closed decision
validation, run-state independence from the modal, heartbeat retry/dedup) is covered only by the
new `npm run test:unit` (vitest) script. CI (`.github/workflows/main.yml` → `./bin/make test` →
`test_ts()` → `npm run test`) runs `npm run test`, which is still just `npx tsc --noEmit` — it does
not call `npm run test:unit` anywhere. Confirmed by reading `bin/make` directly and grepping the
whole repo (including `.github/workflows/*.yml`) for `test:unit`: the only places it's invoked are
this phase's own planning-doc command transcripts, never an automated pipeline. A future change
that silently breaks `toolControl`'s refusal ordering, the `RunStateMonitor` cache, or the
heartbeat's dedup logic would pass CI (type-checks fine) while the new unit tests — which do catch
such regressions locally — are never executed.

**Fix:** Add `npm run test:unit` to `bin/make`'s `test_ts()` (or to the GitHub Actions workflow
directly) alongside the existing `tsc --build --clean && npm run test` step, e.g.:
```sh
test_ts() {
  echo "Runnning Node Tests"
  (cd controller && npx prettier . --check && npx tsc --build --clean && npm run test && npm run test:unit) &&
  build_prod
}
```

## Info

### IN-01: `RunStateMonitor.snapshot()` returns a shallow copy

**File:** `controller/server/runState.ts:166-168`

**Issue:** `snapshot()` does `return { ...this.envelope };` — only the top-level envelope is
copied; nested values (`runState`, `runState.pause`, `runState.pause.detail`) are shared references
with the monitor's internal state. A caller that mutates `commandQueue.runState.runState.pause` (or
any consumer serializing it into another structure and then mutating in place) would corrupt the
monitor's cached value for all other readers, defeating the "N readers, one poll" cache design.
Current callers (the tRPC `runState` query) don't mutate it, so this is latent rather than currently
triggered.

**Fix:** Either document that the returned envelope (and its nested fields) must be treated as
immutable by all consumers, or deep-clone (`structuredClone(this.envelope)`) if a stronger guarantee
is wanted before this is consumed by more call sites in Phase 2.

---

_Reviewed: 2026-10-13T03:08:16Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
