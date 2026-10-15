---
phase: 01-queue-control-path-run-state
verified: 2026-10-15T20:05:00Z
status: passed
score: 4/4 roadmap success criteria verified; 37/37 plan-level must-have truths verified; 5/5 quick-task truths verified; 3/3 code-review fix commits regression-checked
covered_files: [".planning/phases/01-queue-control-path-run-state/01-01-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-01-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-02-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-02-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-03-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-03-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-04-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-04-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-05-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-05-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-REVIEW-DISPOSITION.md", ".planning/phases/01-queue-control-path-run-state/01-REVIEW-FIX.md", "controller/server/command_queue.ts", "controller/server/runState.ts", "controller/server/utils/SqliteQueue.ts", "controller/test/queueRestart.test.ts", "controller/test/runState.test.ts", "controller/test/sqliteQueue.test.ts", "controller/test/staticScan.test.ts", "controller/test/toolControl.test.ts"]
covered_digest: "v3:sha256:635aeae666b0d014b33f04abc7d83150b0968deda776afa5202e3ccc971050d1"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: "4/4 roadmap success criteria verified; 37/37 plan-level must-have truths verified (plus 5/5 new quick-task truths)"
  gaps_closed:
    - "IN-01 (RunStateMonitor.snapshot() returned a shallow copy — latent info finding) fixed by 4a19a7e (structuredClone), with a new regression test"
    - "IN-02 (recoverInterruptedSteps could double-report a run with >1 orphaned STARTED row — latent info finding) fixed by 6738cce (reportedRunIds dedup), with a new regression test"
    - "WR-01 (goto step with missing/non-numeric targetIndex silently requeued the whole run — warning, flagged out-of-scope by the prior verification but fixed in this interval by 7c1d01b) fixed with an integer guard in both command_queue.ts and SqliteQueue.ts"
  gaps_remaining: []
  regressions: []
---

# Phase 1: Queue Control Path & Run State Verification Report

**Phase Goal:** The server side can send an operator's Pause/Resume/Abort to the running step's tool
and report that tool's live run state, without touching the queue's busy loop.
**Verified:** 2026-10-15T20:05:00Z
**Status:** passed
**Re-verification:** Yes — the prior `passed` report (2026-10-15T11:23:10Z) went stale because three
code-review fix commits landed after it: `7c1d01b` (WR-01, goto NaN guard), `4a19a7e` (IN-01,
`RunStateMonitor.snapshot()` deep copy), and `6738cce` (IN-02, `recoverInterruptedSteps` run-dedup),
plus three docs commits (`98adb30`, `3731cf3`, `99e3986`) recording the review-fix report and
disposition. This round independently re-verifies the original 37 plan-level truths, the 5 quick-task
truths, and the three fix commits for regression, since SUMMARY/REVIEW-FIX claims are not evidence.

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (authoritative contract)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---------|--------|----------|
| 1 | `toolControl` reaches the running step's tool while its `executeCommand` is still pending, and the busy loop's promise is unaffected; refuses with no running step, a tool without `runControl`, or a blank decision | ✓ VERIFIED | Ran `npx vitest run` myself this session (full suite + targeted re-run): `toolControl.test.ts` 18/18 pass, including "reaches the tool while the step is still pending" and "never touches the queue". None of the three fix commits (`7c1d01b`, `4a19a7e`, `6738cce`) touch `toolControl`'s body (`command_queue.ts:501-592`, confirmed by diff inspection — `7c1d01b`'s `command_queue.ts` hunk is the unrelated `goto` Tool Box handler at ~line 1215). |
| 2 | `runState` returns the running tool's `run_state` and is independent of `modalState` | ✓ VERIFIED | `runState.test.ts` 36/36 pass (35 prior + 1 new deep-copy regression test from `4a19a7e`), including both "runState independence" cases. The `4a19a7e` change (`snapshot()` now returns `structuredClone(this.envelope)` instead of a shallow `{...this.envelope}`) only strengthens isolation between the monitor's internal state and what callers receive — it does not change what `runState` returns or its independence from `modalState`. |
| 3 | A failed status poll shows "run state unknown" and the heartbeat keeps retrying | ✓ VERIFIED | `tools.test.ts` 6/6 pass. `tools.ts` untouched by any of the three fix commits. |
| 4 | Generated interfaces include `run_state` and `Pause` (ts-proto 1.151.1), and `tsc` reports 0 errors | ✓ VERIFIED | `wire.test.ts` 2/2 pass. I ran `npx tsc --noEmit` myself from `controller/`: exit 0, no output. |

**Score:** 4/4 roadmap success criteria verified.

I ran the full suite and the type gate myself this session (not reused from SUMMARY, REVIEW-FIX, or
the prior VERIFICATION.md):

```
Test Files  14 passed (14)
     Tests  237 passed (237)
  Duration  47.41s
```
```
> npx tsc --noEmit
(exit 0, no output)
```
237 (up from the prior round's 235) reflects the two new regression tests added by `4a19a7e` and
`6738cce`. All green; tsc clean.

### Plan-Level Must-Have Truths (original 37, regression-checked this round)

| Plan | Truths (count) | Status | Regression evidence this session |
|------|------|--------|------|
| 01-01 (test infra) | 4 | ✓ VERIFIED | `test:unit`/`test` both exit 0 this session |
| 01-02 (toolControl/runControl) | 10 | ✓ VERIFIED | `runControl.ts` untouched by any of the three fix commits. `toolControl`'s body re-read in full: D-04 ("no instrument-state check") still holds — no `runState\|_runStateMonitor\|fetchStatus\|getStatus\|\.status\b` token inside its braced body, and `staticScan.test.ts`'s "no instrument-state check before sending" test still passes (13/13) |
| 01-03 (runState/poller) | 7 | ✓ VERIFIED | `runState.ts`'s only change this round is `snapshot()`'s shallow→deep copy (`4a19a7e`); `runState.test.ts` 36/36 pass, including the new deep-copy regression test |
| 01-04 (heartbeat retry) | 5 | ✓ VERIFIED | `tools.ts` untouched; `tools.test.ts` 6/6 pass |
| 01-05 (QUE-06 proto) | 8 | ✓ VERIFIED | Submodule pin, regeneration idempotency, typed `statusReply.run_state` read — all unchanged; `wire.test.ts` 2/2 pass |
| WR-01/WR-02/WR-03 fix-round regressions | 3 | ✓ VERIFIED | Step-identity re-check (`command_queue.ts:539`), generation-guarded in-flight clear in `runState.ts`, and `bin/make:38` chaining `npm run test:unit` — all still present and passing; re-read directly this session |

**Combined score:** 37/37 original plan-level truths verified, no regressions.

### New Queue-Bookkeeping Truths (261015-h0q, 261015-o44 — carried forward, re-confirmed this round)

| # | Truth (quick-task must-have) | Status | Evidence |
|---|---|---|---|
| 1 | An accepted operator Abort fails the aborted step and dequeues the rest of its run (SKIPPED), other runs stay queued, records are kept | ✓ VERIFIED | `toolControl.test.ts > an accepted abort keeps the aborted step out of the next queue start` and `sqliteQueue.test.ts` `failAndDequeueRun` cases pass (ran myself this session) |
| 2 | The same run-wide removal happens when the accepted-abort reply arrives after the step already failed | ✓ VERIFIED | `toolControl.test.ts > an abort accepted after the step already ended still removes it` passes |
| 3 | T-01-08 closed: a stale abort reply never removes a re-queued/restarted/currently-running attempt — behavior-dependent ordering invariant | ✓ VERIFIED | Behavior-dependent (Step 3 rule). Both named race tests ("(T-01-08)") pass, observed this session, unaffected by the three fix commits (none touch the abort-dequeue path in `command_queue.ts`) |
| 4 | Plain failures and refused aborts keep upstream retry unchanged | ✓ VERIFIED | `toolControl > a step failure without an accepted abort stays queued and re-runs first` and `> a refused abort does not remove the step` pass |
| 5 | After a restart, a step left STARTED is failed, dequeued with its run's remainder, and never re-dispatched; a persistent recovery failure fails the queue closed — state-transition truth | ✓ VERIFIED | Behavior-dependent (restart state transition). `queueRestart.test.ts` 2/2 pass this session, against a real two-instance restart on a temp-file SQLite DB |

**Combined new-scope score:** 5/5 quick-task truths re-verified with behavioral test evidence, unaffected by this interval's fix commits.

### Code-Review Fix Commits This Interval (7c1d01b, 4a19a7e, 6738cce)

Independently inspected via `git show` (not reused from `01-REVIEW-FIX.md` narration) and verified
against the phase goal and the roadmap truths above:

| Commit | Finding | Files | Verdict | Evidence |
|---|---|---|---|---|
| `7c1d01b` | WR-01 — a "goto" Tool Box step with a missing/non-numeric `targetIndex` silently re-queued the entire run instead of throwing | `command_queue.ts` (goto handler, ~line 1215 — not `toolControl`, not the busy-loop dispatch/catch), `SqliteQueue.ts` (`gotoCommandByIndex` bounds check) | ✓ No regression, pre-existing bug now closed | Diff reviewed directly: adds `Number.isInteger()` guards on both the primary check and the defense-in-depth bounds check. Unrelated to any QUE-01..06 truth (goto is a Tool Box command, not Pause/Resume/Abort control or run-state reporting). `staticScan.test.ts` and full suite pass. |
| `4a19a7e` | IN-01 — `RunStateMonitor.snapshot()` returned a shallow copy, so a caller mutating the returned envelope's nested `runState`/`pause` fields would corrupt the monitor's internal state | `runState.ts:168-170`, `runState.test.ts` (+1 test) | ✓ No regression, strengthens SC2 | `snapshot()` now returns `structuredClone(this.envelope)`. New test mutates a returned snapshot's `runState.percent`/`.state` and confirms the next `snapshot()` call is unaffected — passes. Does not change `runState`'s return shape or its independence from `modalState`. |
| `6738cce` | IN-02 — `recoverInterruptedSteps` could emit a duplicate, empty result for the same run if more than one `STARTED` row was orphaned simultaneously | `SqliteQueue.ts:580-605`, `sqliteQueue.test.ts` (+1 test) | ✓ No regression, strengthens restart-recovery truth #5 | Adds a `reportedRunIds` Set so a run is reported once per `recoverInterruptedSteps()` call, while still failing every orphaned row. New test pushes two STARTED rows in the same run and asserts exactly one result entry, both rows end FAILED, and a second call returns `[]`. `queueRestart.test.ts`'s real two-instance restart test (truth #5 above) still passes unchanged. |

**Judgment:** none of the three fix commits touch `toolControl`'s decision path, the busy loop's
dispatch/await/`finally` block (`command_queue.ts:1296-1311`), or `modalState`. `7c1d01b` fixes an
unrelated Tool Box `goto` command bug that the prior verification had explicitly flagged as
"pre-existing, out of phase scope" (not a gap) — fixing it is a strict improvement, not a scope
change for Phase 1. `4a19a7e` and `6738cce` close the two Info-severity findings the prior
verification had already assessed as non-gaps ("latent", "diagnostic log-noise only") — both are now
fully closed rather than merely accepted as latent. No prior truth, artifact, or key link is weakened
by any of the three commits.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/server/runControl.ts` | Frozen, import-free capability map + validation | ✓ VERIFIED | Untouched this interval |
| `controller/server/runState.ts` | `extractRunState` + `RunStateMonitor` | ✓ VERIFIED | `snapshot()` now deep-copies (`4a19a7e`); rest unchanged |
| `controller/server/tools.ts` | `Tool.lookup`, `Tool.controlCommand`, heartbeat fix, failure-streak getters | ✓ VERIFIED | Untouched this interval |
| `controller/server/command_queue.ts` | `RunningStep`, `runningStep` getter, `toolControl`, poller lifecycle | ✓ VERIFIED | `toolControl` and busy-loop catch unchanged this interval; only the unrelated `goto` handler changed (`7c1d01b`) |
| `controller/server/utils/SqliteQueue.ts` | Queue persistence | ✓ VERIFIED | `recoverInterruptedSteps` now dedups per-run reporting (`6738cce`); `gotoCommandByIndex` gained an integer guard (`7c1d01b`); `failAndDequeueRun`/`dequeueFailedRun` unchanged |
| `controller/server/routers/command_queue.ts` | `toolControl` mutation, `runState` query | ✓ VERIFIED | Unchanged, wired to `CommandQueue.global` |
| `controller/test/{toolControl,runControl,runState,tools,wire,infra,sqliteQueue,queueRestart,staticScan}.test.ts` | Test suites proving every must-have | ✓ VERIFIED | 14 files, 237 tests, all pass when I ran them myself this session |
| `controller/gen-interfaces/tools/grpc_interfaces/{tool_base,fast}.ts` | `run_state`, `Command_Pause` | ✓ VERIFIED | Unchanged |
| `vendor/galago-tools` (submodule pin) | Human-approved commit | ✓ VERIFIED | Unchanged |
| `bin/make` | `test_ts()` runs the vitest suite | ✓ VERIFIED | `bin/make:38` still chains `npm run test:unit` after `npm run test` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `routers/command_queue.ts` | `command_queue.ts` | `toolControl` mutation → `CommandQueue.global.toolControl` | ✓ WIRED | Unchanged |
| `command_queue.ts` | `runControl.ts` | `validateControlRequest(step?.toolType, action, params)` | ✓ WIRED | Unchanged |
| `command_queue.ts` | `tools.ts` | `Tool.lookup(step.toolId)` then `tool.controlCommand(...)`, gated by the step-identity re-check | ✓ WIRED | Confirmed by direct read, unchanged |
| busy loop | `CommandQueue._runningStep` | set before / cleared in `finally` | ✓ WIRED | Unchanged |
| busy loop | `RunStateMonitor` | `_runStateMonitor.start(...)` / `.stop()` in the same bracket | ✓ WIRED | Unchanged |
| `runState.ts` `RunStateMonitor` | `tools.ts` | `Tool.lookup(...).grpc.getStatus({})` only | ✓ WIRED | Unchanged |
| `routers/command_queue.ts` | `command_queue.ts` | `runState` query → `CommandQueue.global.runState` | ✓ WIRED | Unchanged |
| `bin/make test_ts()` | `controller/package.json` `test:unit` | `&&`-chained invocation | ✓ WIRED | Unchanged |
| busy-loop catch | `SqliteQueue.failAndDequeueRun` | `abortAccepted` flag from `_abortAcceptedQueueId === nextCommand.queueId` | ✓ WIRED | Unchanged this interval |
| `CommandQueue._recordAcceptedAbort` | `SqliteQueue.dequeueFailedRun` | gated by `_runningStep !== step && _failedAttempt === step` | ✓ WIRED | Unchanged this interval |
| `CommandQueue` constructor / `_start` | `SqliteQueue.recoverInterruptedSteps` | `_recoverInterruptedSteps()` at construction, retried in `_start` | ✓ WIRED | Dedup fix (`6738cce`) is internal to `recoverInterruptedSteps`'s loop; call sites unchanged |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `commandQueue.toolControl` reply | `{ok, response, message}` | `tool.controlCommand` → real `grpc.executeCommand` (real codec proven by `wire.test.ts`) | Yes | ✓ FLOWING |
| `commandQueue.runState` envelope | `RunStateEnvelope` | `RunStateMonitor.snapshot()` (now `structuredClone`) ← `tool.grpc.getStatus` → `extractRunState` | Yes | ✓ FLOWING |
| `Tool.status` / `consecutiveStatusFailures` | heartbeat state | `fetchStatus` ← `grpc.getStatus` | Yes | ✓ FLOWING |
| queue table state after abort/restart/goto | `<q>_queue` rows | `SqliteQueue` transactions, real `better-sqlite3` DB (in-memory for unit tests, real temp file for `queueRestart.test.ts`) | Yes | ✓ FLOWING |

No static/hardcoded fallbacks found on any of the four live-control/run-state/queue-bookkeeping paths.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite is genuinely green (ran myself, this session) | `npx vitest run` (from `controller/`) | `14 files, 237 tests, all passed, 47.41s` | ✓ PASS |
| Type gate is genuinely clean (ran myself, this session) | `npx tsc --noEmit` (from `controller/`) | exit 0, no "error TS" lines | ✓ PASS |
| Targeted re-run of fix-adjacent and T-01-08/restart suites (ran myself, this session) | `npx vitest run test/toolControl.test.ts test/runState.test.ts test/sqliteQueue.test.ts test/queueRestart.test.ts test/staticScan.test.ts` | `5 files, 76 tests, all passed, 46.43s` | ✓ PASS |
| New IN-01 regression test (deep-copy isolation) passes | `runState.test.ts > snapshot is a deep copy that callers cannot use to mutate monitor state` | pass | ✓ PASS |
| New IN-02 regression test (run reported once) passes | `sqliteQueue.test.ts > recoverInterruptedSteps reports a run once when more than one of its rows was left STARTED` | pass | ✓ PASS |
| No debt markers in any fix-touched or covered file | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across `runState.ts`, `SqliteQueue.ts`, `command_queue.ts`, `runState.test.ts`, `sqliteQueue.test.ts`, `01-REVIEW-FIX.md`, `01-REVIEW-DISPOSITION.md` | no matches | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files exist in this repository and neither PLAN nor SUMMARY declares any probe script for this phase.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| QUE-01 | 01-02, 01-05 | `toolControl` sends P/R/A straight to the running step's tool, logged | ✓ SATISFIED | `toolControl.test.ts` end-to-end test + `wire.test.ts` real-wire proof; unaffected by this interval's fix commits |
| QUE-02 | 01-01, 01-02 | Refuses with no step/no runControl/blank decision; `runningStep` accessor | ✓ SATISFIED | `toolControl.test.ts` refusal tests + `runningStep` getter |
| QUE-03 | 01-02 | `runControl` separate map; F.A.S.T. declares pause/resume/abort | ✓ SATISFIED | `runControl.test.ts` |
| QUE-04 | 01-01, 01-03, 01-05 | `runState` query returns tool `run_state`, independent of `modalState` | ✓ SATISFIED | `runState.test.ts` (36/36, incl. the new deep-copy test) + `wire.test.ts` |
| QUE-05 | 01-01, 01-03, 01-04 | Failed poll → "run state unknown", heartbeat keeps retrying | ✓ SATISFIED | `tools.test.ts` + `runState.test.ts` |
| QUE-06 | 01-05 | Generated interfaces include `run_state`/`Pause`; `tsc` 0 errors | ✓ SATISFIED | Submodule pin, regeneration, `wire.test.ts`, tsc clean |

No orphaned requirements: REQUIREMENTS.md's Phase 1 traceability table lists exactly QUE-01..06, all
mapped and all claimed by at least one plan's `requirements:` frontmatter field. All six are marked
`[x]` and "Complete" in REQUIREMENTS.md, matching the evidence above.

### Anti-Patterns Found

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in any phase-covered or fix-touched file. No
placeholder/stub return values, no hardcoded-empty props flowing to output.

Carried forward and re-assessed against the three fix commits this round:

| Finding | Severity | Status | Evidence / Scope |
|---------|----------|--------|-------------------|
| WR-01 (goto NaN) | Warning | **Closed this interval** by `7c1d01b` | Previously "open, pre-existing, out of phase scope" in the prior verification. Fixed with integer guards in both `command_queue.ts` and `SqliteQueue.ts`; verified by direct diff read and the passing full suite (237/237). Disposition in `01-REVIEW-DISPOSITION.md` confirms `fixed`. |
| IN-02 (recoverInterruptedSteps double-report) | Info | **Closed this interval** by `6738cce` | Previously "open, latent" — diagnostic log-noise only. Now fixed with a `reportedRunIds` Set and a dedicated regression test; confirmed passing. |
| IN-01 (RunStateMonitor.snapshot shallow copy) | Info | **Closed this interval** by `4a19a7e` | Previously "open, latent, unchanged". Now fixed with `structuredClone` and a dedicated regression test; confirmed passing. |

No open findings remain. `01-REVIEW-DISPOSITION.md` frontmatter shows `open: 0, total: 5` across
WR-01/WR-02/WR-03/IN-01/IN-02, all `disposition: fixed` — consistent with my independent re-read of
each fix commit's diff and the passing test suite.

### Human Verification Required

None. The three items the original `human_needed` verification (2026-10-13) routed to a human remain
resolved and unaffected by this interval's fix commits:

1. **WR-01 — toolControl's step-identity race.** Still present at `command_queue.ts:539`
   (`if (this._runningStep !== step)`); unchanged by any of the three fix commits this interval
   (`7c1d01b` is a different, unrelated WR-01 — the roadmap's naming for the fix-round findings
   happened to reuse the "WR-01" id for the current review cycle's goto-NaN finding; see
   `01-REVIEW-DISPOSITION.md`). The residual round-trip-window risk remains explicitly accepted by a
   human (`01-UAT.md` test 1, "pass").
2. **WR-02 — RunStateMonitor's unconditional in-flight clear.** Still generation-guarded in
   `runState.ts`; confirmed by a human (`01-UAT.md` test 2, "pass"); untouched by `4a19a7e` (which
   only changed `snapshot()`'s copy semantics, not the generation guard).
3. **D-04 judgment-tier prohibition** ("galago-core performs no instrument-state check"). Still
   confirmed by a human (`01-UAT.md` test 3, "pass"), and independently re-confirmed by my own direct
   read of `toolControl`'s full method body this session: unchanged by any of the three fix commits.

The three fix commits this interval introduce no new judgment-tier prohibitions requiring human
sign-off: all three are plain bug fixes with mechanical, test-verified correctness criteria
(an `Number.isInteger()` guard, a `structuredClone`, and a `Set`-based dedup), each accompanied by a
new passing regression test.

### Gaps Summary

No gaps. All 4 ROADMAP Phase 1 success criteria, all 37 original plan-level must-have truths, and all
5 quick-task truths remain independently verified against the actual codebase after this interval's
three code-review fix commits (`7c1d01b`, `4a19a7e`, `6738cce`). I re-ran the full unit suite
(237/237 pass, up from 235 due to two new regression tests) and the type gate (0 errors) myself this
session, independently read each fix commit's diff (not reused from `01-REVIEW-FIX.md` narration),
and confirmed none of the three touch `toolControl`'s decision path, the busy loop's dispatch/
`finally` block, or `modalState`. The two previously-open Info findings (IN-01, IN-02) and the one
previously-open Warning (WR-01) are now fully closed, each with its own dedicated regression test.
QUE-01 through QUE-06 remain satisfied with no orphaned requirements. The phase goal — the server
side can send an operator's Pause/Resume/Abort to the running step's tool and report that tool's live
run state, without touching the queue's busy loop — remains achieved and verified after the
covered-source changes.

---

*Verified: 2026-10-15T20:05:00Z*
*Verifier: Claude (gsd-verifier)*
