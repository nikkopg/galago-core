---
phase: 01-queue-control-path-run-state
reviewed: 2026-10-13T14:50:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - bin/make
  - controller/server/command_queue.ts
  - controller/server/runState.ts
  - controller/server/tools.ts
  - controller/test/runState.test.ts
  - controller/test/toolControl.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 01: Code Review Report (incremental re-review)

**Reviewed:** 2026-10-13T14:50:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found (1 carried-forward Info item; all prior Warnings fixed and verified)

## Summary

This is a follow-up review of the fixes applied in `01-REVIEW-FIX.md` (commits `62e505c`,
`42fd1af`, `003e500`) against the original `01-REVIEW.md` findings (WR-01, WR-02, WR-03). Scope was
`git diff 46052e0` for the six listed files.

All three fixes were independently verified by reading the actual diff hunks (not just trusting the
fix report) and by running the real test suite:

- **WR-01 (`command_queue.ts:467-475`)** — The identity re-check `if (this._runningStep !== step)`
  is inserted exactly where it needs to be: after the tool-lookup/"not connected" check and before
  the `await tool.controlCommand(...)` network call. It compares only the frozen `RunningStep`
  object's identity — no instrument/run-state read is involved, preserving D-04. This narrows the
  race window (it still can't fully close it, since there's no gRPC cancellation — the remaining
  window is the actual network round trip of `controlCommand`, which was already true of the
  original fix recommendation and is not a new gap introduced here) but correctly converts "silently
  send to the wrong step" into a logged, fail-closed `PRECONDITION_FAILED` refusal for the
  synchronous portion of the race.
  The companion test (`toolControl.test.ts`, "refuses when the running step moves on before
  dispatch") exercises the fix for real: it mocks `Tool.lookup` — the last synchronous call made
  before the new check — to mutate the queue's private `_runningStep` to a *new, frozen* object with
  different identity (but the same `toolId`) as its side effect, then lets the real lookup proceed.
  This reproduces "the busy loop moved on to a new step on the same tool" without relying on real
  timing, and correctly asserts `PRECONDITION_FAILED` plus `grpc.executeCommand` never being called.
  Traced through the surrounding code to confirm `_runningStep` is reassigned to a brand-new
  `Object.freeze({...})` on every step (`command_queue.ts` busy loop), so the identity check is
  meaningful rather than vacuously true.

- **WR-02 (`runState.ts:191-200`)** — `_poll`'s `finally` block now only clears `this.inFlight` when
  `generation === this.generation`, matching the suggested fix verbatim. Manually traced the new
  regression test ("a stale poll from a superseded generation does not clear inFlight...")
  instruction-by-instruction against `start()`/`stop()`/`_poll()`: poll A is left outstanding at
  generation 2, `start(stepB)` bumps to generation 4 (via `stop()`'s internal `+1` then `start()`'s
  own `+1`) and issues poll B's own outstanding call; when poll A's stale response resolves first,
  its `finally` now correctly leaves `inFlight` untouched because `2 !== 4`, so the next interval
  tick for the live generation does *not* fire a second concurrent `getStatus` call — which is
  exactly the invariant D-11 requires and exactly what would fail under the old unconditional
  `finally { this.inFlight = false }`. This is a read-only polling path; the fix does not add or
  change any command-sending behavior, preserving D-14.

- **WR-03 (`bin/make:36-40`)** — `test_ts()` now runs `npm run test:unit` (vitest) after `npm run
  test` (tsc) and before `build_prod`, in the same `&&` chain so a vitest failure now fails the
  build. Confirmed `controller/package.json`'s `test:unit` script is `vitest run`, matching the
  invocation used by CI once `./bin/make test` runs. No changes were needed to
  `.github/workflows/main.yml` since it already calls `./bin/make test` unconditionally.

- **Prettier-only commit (`55422e2`)** — Confirmed via `git diff` that the only non-test-file hunk
  outside `command_queue.ts`/`runState.ts`/`bin/make` touches `tools.ts`, and it is purely
  whitespace: `controlCommand`'s signature is reformatted from multi-line to single-line with no
  change to parameter names, types, or body. No logic changes anywhere in `tools.ts`.

Ran the full affected suite directly (`npm run test:unit -- toolControl runState` under Node
v24.14.1): **47/47 tests pass** (12 in `toolControl.test.ts`, 35 in `runState.test.ts`), including
both new regression tests, confirming the fixes are live in the working tree and not just described
in the fix report.

None of the four safety invariants called out for this re-review were weakened by these changes:
operator-only control sends still route exclusively through `CommandQueue.toolControl` →
`Tool.controlCommand`; `validateControlRequest`'s exact `"yes"`/`"no"` decision matching is untouched
(not part of this diff); `RunStateMonitor` still only ever calls `tool.grpc.getStatus(...)` (no
instrument-state check or command was added for either fix); and the busy loop / modal
(`_isWaitingForInput`, `_currentMessage`, `_messageResolve`) code is completely untouched by this
diff.

The three Warnings from the original review (WR-01, WR-02, WR-03) are **fixed and verified** — they
are not re-reported below. One previously-logged Info item remains unaddressed by design (excluded
from the prior fix pass's scope) and is carried forward here unchanged.

## Info

### IN-01 (carried forward, still unfixed): `RunStateMonitor.snapshot()` returns a shallow copy

**File:** `controller/server/runState.ts:166-168`

**Issue:** `snapshot()` still does `return { ...this.envelope };` — only the top-level envelope
object is copied; `runState`, `runState.pause`, and `runState.pause.detail` remain shared references
with the monitor's internal state. A caller that mutates `commandQueue.runState.runState.pause` (or
deep-mutates it while serializing elsewhere) would corrupt the monitor's cached value for all other
readers, defeating the "N readers, one poll" cache design. No current caller does this (the tRPC
`runState` query only reads), so this remains latent rather than currently triggered. Verified
unchanged by diffing current `runState.ts` against the version reviewed in the prior pass — no edits
were made to `snapshot()` by this round's fixes.

**Fix:** Either document that the returned envelope (and its nested fields) must be treated as
immutable by all consumers, or deep-clone (`structuredClone(this.envelope)`) if a stronger guarantee
is wanted before this is consumed by more call sites in a later phase.

---

_Reviewed: 2026-10-13T14:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
