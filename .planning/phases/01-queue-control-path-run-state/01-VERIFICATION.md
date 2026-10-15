---
phase: 01-queue-control-path-run-state
verified: 2026-10-15T11:23:10Z
status: passed
score: 4/4 roadmap success criteria verified; 37/37 plan-level must-have truths verified (plus 5/5 new quick-task truths from 261015-h0q and 261015-o44, all behaviorally test-verified)
covered_files: [".planning/phases/01-queue-control-path-run-state/01-01-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-01-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-02-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-02-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-03-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-03-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-04-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-04-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-05-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-05-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-REVIEW-DISPOSITION.md", ".planning/phases/01-queue-control-path-run-state/01-REVIEW.md", ".planning/phases/01-queue-control-path-run-state/01-SECURITY.md", ".planning/phases/01-queue-control-path-run-state/01-UAT.md", ".planning/phases/01-queue-control-path-run-state/01-VALIDATION.md", ".planning/quick/261015-h0q-fix-sqlitequeue-an-operator-aborted-fail/261015-h0q-PLAN.md", ".planning/quick/261015-h0q-fix-sqlitequeue-an-operator-aborted-fail/261015-h0q-SUMMARY.md", ".planning/quick/261015-o44-fix-queue-dequeue-an-aborted-run-s-remai/261015-o44-PLAN.md", ".planning/quick/261015-o44-fix-queue-dequeue-an-aborted-run-s-remai/261015-o44-SUMMARY.md", "controller/server/command_queue.ts", "controller/server/utils/SqliteQueue.ts", "controller/test/queueRestart.test.ts", "controller/test/sqliteQueue.test.ts", "controller/test/toolControl.test.ts"]
covered_digest: "v3:sha256:c3bde00c410885f084a039ceffbfd9096110a38d3718e4039001df56289a5b71"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: "4/4 roadmap success criteria verified; 37/37 plan-level must-have truths verified"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 1: Queue Control Path & Run State Verification Report

**Phase Goal:** The server side can send an operator's Pause/Resume/Abort to the running step's tool
and report that tool's live run state, without touching the queue's busy loop.
**Verified:** 2026-10-15T11:23:10Z
**Status:** passed
**Re-verification:** Yes — the prior `passed` report (2026-10-13) went stale because quick tasks
`261015-h0q` (4b575ed, 5598347, e18a177) and `261015-o44` (662bb12, 7627bf6, 38b5d17) modified
`controller/server/command_queue.ts` and `controller/server/utils/SqliteQueue.ts` after it was
written. This round re-verifies the original 37 plan-level truths for regression and independently
assesses the new queue-bookkeeping behavior against the phase goal's intent.

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (authoritative contract)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---------|--------|----------|
| 1 | `toolControl` reaches the running step's tool while its `executeCommand` is still pending, and the busy loop's promise is unaffected; refuses with no running step, a tool without `runControl`, or a blank decision | ✓ VERIFIED | Ran `npx vitest run` myself this session: `toolControl.test.ts` 18/18 pass, including "reaches the tool while the step is still pending", "never touches the queue", and the WR-01 race guard. Read `toolControl`'s full body in `command_queue.ts:501-592`: still validates via `_runningStep`/`validateControlRequest`/`Tool.lookup` only, sends, then (only on `action===abort && result.ok`) calls `_recordAcceptedAbort` in a try/catch that can never change what is returned. No status/run-state read added. |
| 2 | `runState` returns the running tool's `run_state` and is independent of `modalState` | ✓ VERIFIED | `runState.test.ts` 35/35 pass, including both "runState independence" cases. `runState.ts` unchanged by the quick tasks (confirmed: not in either quick task's `files_modified`). |
| 3 | A failed status poll shows "run state unknown" and the heartbeat keeps retrying | ✓ VERIFIED | `tools.test.ts` 6/6 pass (fast + pf400). `tools.ts` untouched by the quick tasks. |
| 4 | Generated interfaces include `run_state` and `Pause` (ts-proto 1.151.1), and `tsc` reports 0 errors | ✓ VERIFIED | `wire.test.ts` 2/2 pass. I ran `npx tsc --noEmit` myself: exit 0, no output. |

**Score:** 4/4 roadmap success criteria verified.

I ran the full suite and the type gate myself this session (not reused from SUMMARY or the prior VERIFICATION.md):

```
Test Files  14 passed (14)
     Tests  235 passed (235)
  Duration  46.62s
```
```
> npx tsc --noEmit
(exit 0, no output)
```
This matches the launcher's expected 235/235, tsc clean.

### Plan-Level Must-Have Truths (original 37, regression-checked this round)

| Plan | Truths (count) | Status | Regression evidence this session |
|------|------|--------|------|
| 01-01 (test infra) | 4 | ✓ VERIFIED | `test:unit`/`test` both exit 0 this session |
| 01-02 (toolControl/runControl) | 10 | ✓ VERIFIED | `runControl.ts` untouched by either quick task (not in `files_modified` of either). `toolControl`'s body re-read in full (see SC1 evidence above): D-04 ("no instrument-state check") still holds — no `runState\|_runStateMonitor\|fetchStatus\|getStatus\|\.status\b` token inside its braced body, and `staticScan.test.ts`'s "no instrument-state check before sending" test still passes (13/13 in staticScan.test.ts) |
| 01-03 (runState/poller) | 7 | ✓ VERIFIED | `runState.ts` untouched by either quick task; `runState.test.ts` 35/35 pass unchanged |
| 01-04 (heartbeat retry) | 5 | ✓ VERIFIED | `tools.ts` untouched; `tools.test.ts` 6/6 pass |
| 01-05 (QUE-06 proto) | 8 | ✓ VERIFIED | Submodule pin, regeneration idempotency, typed `statusReply.run_state` read — all unchanged; `wire.test.ts` 2/2 pass |
| WR-01/WR-02/WR-03 fix-round regressions | 3 | ✓ VERIFIED | Step-identity re-check (`command_queue.ts:539`, inlined into `toolControl` directly — functionally the same guard previously at the top of `_recordAcceptedAbort`), generation-guarded in-flight clear in `runState.ts`, and `bin/make:38` chaining `npm run test:unit` — all still present and passing |

**Combined score:** 37/37 original plan-level truths verified, no regressions.

### New Queue-Bookkeeping Truths (261015-h0q, 261015-o44 — new scope since the prior VERIFICATION.md)

These quick tasks added run-wide abort dequeue, a three-layer late-reply gate closing T-01-08, and
restart-orphan recovery. None of these were part of the original Phase 1 plans' `must_haves`, but
they modify the same files this phase's contract covers (`command_queue.ts`, `SqliteQueue.ts`), so
I verified them directly against their own quick-task `must_haves.truths` and against the phase
goal's intent.

| # | Truth (quick-task must-have) | Status | Evidence |
|---|---|---|---|
| 1 | An accepted operator Abort fails the aborted step and dequeues the rest of its run (SKIPPED), other runs stay queued, records are kept | ✓ VERIFIED | `toolControl.test.ts > an accepted abort keeps the aborted step out of the next queue start` and `sqliteQueue.test.ts` `failAndDequeueRun` cases pass (ran myself this session) |
| 2 | The same run-wide removal happens when the accepted-abort reply arrives after the step already failed, as long as nothing has happened to the queue since | ✓ VERIFIED | `toolControl.test.ts > an abort accepted after the step already ended still removes it` passes |
| 3 | T-01-08 closed: a stale abort reply never removes a re-queued (`gotoCommand`/`gotoCommandByRunIndex`), restarted, or currently-running attempt — behavior-dependent ordering invariant | ✓ VERIFIED | This is a cancellation/ordering invariant (Step 3 behavior-dependent-truth rule) — presence alone would not suffice. Two named race tests exercise it directly: `toolControl > a stale abort reply does not remove a step re-queued with gotoCommand (T-01-08)` and `toolControl > a stale abort reply does not remove a re-queued attempt that is running again (T-01-08)`, both observed passing in the full run I executed this session (not reused from SUMMARY) |
| 4 | Plain failures and refused aborts keep upstream retry unchanged | ✓ VERIFIED | `toolControl > a step failure without an accepted abort stays queued and re-runs first` and `> a refused abort does not remove the step` pass |
| 5 | After a restart, a step left STARTED is failed ("interrupted by restart"), dequeued with its run's remainder, and never re-dispatched; a persistent recovery failure fails the queue closed — state-transition truth | ✓ VERIFIED | Behavior-dependent (restart state transition). `queueRestart.test.ts` runs a *real* two-instance restart on a temp-file SQLite DB (not a mock): `a step left STARTED by a previous process is failed at construction and never re-dispatched` and `the queue will not start while interrupted-step recovery keeps failing` both pass, observed in this session's run |

**Combined new-scope score:** 5/5 quick-task truths independently verified with behavioral test evidence (not presence-only), per Step 3's behavior-dependent-truth rule for state-transition/ordering invariants.

### Judgment: does the new queue-bookkeeping violate "without touching the queue's busy loop"?

This is the key question the launcher asked me to resolve, since `command_queue.ts`'s busy-loop
catch block itself was modified by these quick tasks. My assessment, based on direct code reading
(not SUMMARY narration):

- **The busy loop's dispatch/promise path is untouched.** `_runningStep = attempt` → `_runStateMonitor.start()` → `await this.executeCommand(nextCommand)` → `finally { stop(); _runningStep = undefined }` (`command_queue.ts:1296-1311`) is byte-identical to the prior verification. `toolControl` still never awaits on, resolves, or interferes with this promise — confirmed by the still-passing `toolControl > never touches the queue` and `> reaches the tool while the step is still pending` tests.
- **The changed code is confined to the catch's post-failure bookkeeping** (`command_queue.ts:1319-1348`): after the step's own promise has already settled (failed), the catch now chooses between `commands.fail(...)` (plain failure, unchanged) and `commands.failAndDequeueRun(...)` (operator-accepted abort, new) based on a flag computed from `_abortAcceptedQueueId`. This is error-path bookkeeping on already-ended steps, not a change to how the busy loop dispatches or awaits the *currently running* step.
- **Modal state remains untouched** — `_isWaitingForInput`, `_messageResolve`, `_currentMessage` do not appear anywhere in the diff (confirmed: 0 grep hits for these identifiers outside their original declarations and existing Tool Box code).
- **The control signal is still exclusively operator-driven.** The abort-dequeue path only fires when `toolControl` (reached only via the `commandQueue.toolControl` tRPC mutation) records that the tool accepted an operator's own Abort decision — never on a timeout, poll, or automatic condition. This preserves RSAFE-01/RSAFE-03 (operator decides every recovery action; the web app never acts on its own).
- **This was itself threat-modeled and closed.** `01-SECURITY.md` T-01-08 (previously the single highest-severity open item blocking the phase at `human_needed`) is now `closed`, with `threats_open: 0` and a fresh 2026-10-15 audit trail entry. `01-REVIEW.md` (fresh, same date) found **0 critical** issues across all four race-condition/atomicity/fail-closed hunting categories it specifically targeted for this diff.

**Conclusion:** the quick-task changes are consistent with the phase goal's intent. "Without touching
the queue's busy loop" is satisfied in the sense the ROADMAP success criteria actually test (the
running step's dispatch/promise and modal state are unaffected); the new bookkeeping is confined to
already-ended steps' queue rows and strengthens, rather than weakens, the operator-only invariant
the phase and milestone exist to protect. I did not find grounds to downgrade or override any truth.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/server/runControl.ts` | Frozen, import-free capability map + validation | ✓ VERIFIED | Untouched by either quick task |
| `controller/server/runState.ts` | `extractRunState` + `RunStateMonitor` | ✓ VERIFIED | Untouched by either quick task |
| `controller/server/tools.ts` | `Tool.lookup`, `Tool.controlCommand`, heartbeat fix, failure-streak getters | ✓ VERIFIED | Untouched by either quick task |
| `controller/server/command_queue.ts` | `RunningStep`, `runningStep` getter, `toolControl`, poller lifecycle | ✓ VERIFIED | toolControl unchanged in substance; busy-loop catch now branches on `abortAccepted`; new `_failedAttempt`, `_interruptedStepsRecovered`, `_recoverInterruptedSteps` fields/methods present and wired |
| `controller/server/utils/SqliteQueue.ts` | Queue persistence | ✓ VERIFIED | New `failAndDequeueRun`, `dequeueFailedRun`, `recoverInterruptedSteps`, private `_dequeueRunRemainder` all present (grep-confirmed at lines 497/509/545/564/615); old ungated single-row `dequeue` removed |
| `controller/server/routers/command_queue.ts` | `toolControl` mutation, `runState` query | ✓ VERIFIED | Unchanged, both present and wired to `CommandQueue.global` |
| `controller/test/{toolControl,runControl,runState,tools,wire,infra,sqliteQueue,queueRestart,staticScan}.test.ts` | Test suites proving every must-have | ✓ VERIFIED | 14 files, 235 tests, all pass when I ran them myself this session |
| `controller/gen-interfaces/tools/grpc_interfaces/{tool_base,fast}.ts` | `run_state`, `Command_Pause` | ✓ VERIFIED | Unchanged |
| `vendor/galago-tools` (submodule pin) | Human-approved commit | ✓ VERIFIED | Unchanged |
| `bin/make` | `test_ts()` runs the vitest suite | ✓ VERIFIED | `bin/make:38` still chains `npm run test:unit` after `npm run test` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `routers/command_queue.ts` | `command_queue.ts` | `toolControl` mutation → `CommandQueue.global.toolControl` | ✓ WIRED | Unchanged |
| `command_queue.ts` | `runControl.ts` | `validateControlRequest(step?.toolType, action, params)` | ✓ WIRED | Unchanged |
| `command_queue.ts` | `tools.ts` | `Tool.lookup(step.toolId)` then `tool.controlCommand(...)`, gated by the step-identity re-check | ✓ WIRED | Confirmed by direct read |
| busy loop | `CommandQueue._runningStep` | set before / cleared in `finally` | ✓ WIRED | Unchanged |
| busy loop | `RunStateMonitor` | `_runStateMonitor.start(...)` / `.stop()` in the same bracket | ✓ WIRED | Unchanged |
| `runState.ts` `RunStateMonitor` | `tools.ts` | `Tool.lookup(...).grpc.getStatus({})` only | ✓ WIRED | Unchanged |
| `routers/command_queue.ts` | `command_queue.ts` | `runState` query → `CommandQueue.global.runState` | ✓ WIRED | Unchanged |
| `bin/make test_ts()` | `controller/package.json` `test:unit` | `&&`-chained invocation | ✓ WIRED | Unchanged |
| busy-loop catch | `SqliteQueue.failAndDequeueRun` | `abortAccepted` flag from `_abortAcceptedQueueId === nextCommand.queueId` | ✓ WIRED | New this round; confirmed by direct read, `command_queue.ts:1325-1348` |
| `CommandQueue._recordAcceptedAbort` | `SqliteQueue.dequeueFailedRun` | gated by `_runningStep !== step && _failedAttempt === step`; SqliteQueue's own transactional re-check | ✓ WIRED | New this round; confirmed by direct read, `command_queue.ts:610-630` |
| `CommandQueue` constructor / `_start` | `SqliteQueue.recoverInterruptedSteps` | `_recoverInterruptedSteps()` run at construction (try/catch, never throws) and retried in `_start` until `_interruptedStepsRecovered` | ✓ WIRED | New this round; confirmed by direct read, `command_queue.ts:101-150, 890` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `commandQueue.toolControl` reply | `{ok, response, message}` | `tool.controlCommand` → real `grpc.executeCommand` (real codec proven by `wire.test.ts`) | Yes | ✓ FLOWING |
| `commandQueue.runState` envelope | `RunStateEnvelope` | `RunStateMonitor.snapshot()` ← `tool.grpc.getStatus` → `extractRunState` | Yes | ✓ FLOWING |
| `Tool.status` / `consecutiveStatusFailures` | heartbeat state | `fetchStatus` ← `grpc.getStatus` | Yes | ✓ FLOWING |
| queue table state after abort/restart | `<q>_queue` rows | `SqliteQueue` transactions, real `better-sqlite3` DB (in-memory for unit tests, real temp file for `queueRestart.test.ts`) | Yes | ✓ FLOWING |

No static/hardcoded fallbacks found on any of the four live-control/run-state/queue-bookkeeping paths.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite is genuinely green (ran myself, this session) | `npx vitest run` (from `controller/`) | `14 files, 235 tests, all passed, 46.62s` | ✓ PASS |
| Type gate is genuinely clean (ran myself, this session) | `npx tsc --noEmit` (from `controller/`) | exit 0, no "error TS" lines | ✓ PASS |
| T-01-08 race guards (R1/R2) pass | `toolControl.test.ts` → both "(T-01-08)"-named tests | pass | ✓ PASS |
| Real two-instance restart recovery passes | `queueRestart.test.ts` Q1 and Q2 | pass | ✓ PASS |
| `bin/make test_ts()` chains vitest after tsc | direct read of `bin/make:38` | `npx tsc --build --clean && npm run test && npm run test:unit` | ✓ PASS |
| No debt markers in any phase-covered file | `grep -nE "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across `command_queue.ts`, `SqliteQueue.ts`, `toolControl.test.ts`, `sqliteQueue.test.ts`, `queueRestart.test.ts` | no matches | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files exist in this repository and neither PLAN nor SUMMARY declares any probe script for this phase.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| QUE-01 | 01-02, 01-05 | `toolControl` sends P/R/A straight to the running step's tool, logged | ✓ SATISFIED | `toolControl.test.ts` end-to-end test + `wire.test.ts` real-wire proof |
| QUE-02 | 01-01, 01-02 | Refuses with no step/no runControl/blank decision; `runningStep` accessor | ✓ SATISFIED | `toolControl.test.ts` refusal tests + `runningStep` getter |
| QUE-03 | 01-02 | `runControl` separate map; F.A.S.T. declares pause/resume/abort | ✓ SATISFIED | `runControl.test.ts` |
| QUE-04 | 01-01, 01-03, 01-05 | `runState` query returns tool `run_state`, independent of `modalState` | ✓ SATISFIED | `runState.test.ts` + `wire.test.ts` |
| QUE-05 | 01-01, 01-03, 01-04 | Failed poll → "run state unknown", heartbeat keeps retrying | ✓ SATISFIED | `tools.test.ts` + `runState.test.ts` |
| QUE-06 | 01-05 | Generated interfaces include `run_state`/`Pause`; `tsc` 0 errors | ✓ SATISFIED | Submodule pin, regeneration, `wire.test.ts`, tsc clean |

No orphaned requirements: REQUIREMENTS.md's Phase 1 traceability table lists exactly QUE-01..06, all mapped and all claimed by at least one plan's `requirements:` frontmatter field. All six are marked `[x]` and "Complete" in REQUIREMENTS.md, matching the evidence above.

### Anti-Patterns Found

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in any phase-covered file. No placeholder/stub return values, no hardcoded-empty props flowing to output.

Carried forward from the fresh `01-REVIEW.md` (2026-10-15T11:18:04Z, which specifically targeted the 261015-h0q/261015-o44 diff):

| Finding | Severity | Status | Evidence / Scope |
|---------|----------|--------|-------------------|
| WR-01 (goto NaN) — a "goto" step with a missing `targetIndex` silently re-queues the entire run instead of throwing | Warning | Open, pre-existing, out of phase scope | `command_queue.ts:1218-1222`, `SqliteQueue.ts:176-183`. Confirmed via `git log -S"targetIndex"`: present since the initial commit, not part of this phase's or either quick task's diff. Does not touch any QUE-01..06 truth. Not a gap for Phase 1. |
| IN-02 — `recoverInterruptedSteps` can double-process a run if >1 of its rows is left STARTED | Info | Open, latent | Requires a data anomaly (two STARTED rows in the same run) that cannot occur under normal single-busy-loop operation; converges to correct final DB state either way — diagnostic log-noise only, not a correctness defect. Not a gap. |
| IN-01 — `RunStateMonitor.snapshot()` returns only a shallow copy | Info | Open, latent, unchanged | `runState.ts:168-170`. No current caller mutates nested fields. Not a gap. |

No critical findings in the fresh review (0 critical / 1 warning / 2 info). Both open Info items and the one open Warning are pre-existing or latent, out of this phase's diff scope, and do not affect any QUE-01..06 truth.

### Human Verification Required

None. The three items the original `human_needed` verification (2026-10-13) routed to a human were
all resolved and are reconfirmed unchanged this round:

1. **WR-01 — toolControl's step-identity race.** Still present at `command_queue.ts:539` (`if (this._runningStep !== step)`); the residual round-trip-window risk remains explicitly accepted by a human (`01-UAT.md` test 1, "pass").
2. **WR-02 — RunStateMonitor's unconditional in-flight clear.** Still generation-guarded in `runState.ts`; confirmed by a human (`01-UAT.md` test 2, "pass").
3. **D-04 judgment-tier prohibition** ("galago-core performs no instrument-state check"). Still confirmed by a human (`01-UAT.md` test 3, "pass"), and independently re-confirmed by my own direct read of `toolControl`'s full method body this session: the decision path reads only `this._runningStep`, `validateControlRequest`, and `Tool.lookup` — no `Tool.status`, run-state, or tool-reply field gates the send at any point before `await tool.controlCommand(...)`.

The new quick-task scope (`261015-h0q`, `261015-o44`) introduces no new judgment-tier prohibitions
requiring human sign-off: both quick plans' `must_haves` are entirely `verification: unit test`
(no `prohibitions` block with `verification: judgment`), and all are independently test-verified
above, including the two behavior-dependent invariants (T-01-08's race gate and restart-orphan
recovery) via their own named, passing tests.

### Gaps Summary

No gaps. All 4 ROADMAP Phase 1 success criteria, all 37 original plan-level must-have truths, and
all 5 new quick-task truths from `261015-h0q`/`261015-o44` are independently verified against the
actual codebase — not SUMMARY, REVIEW, or UAT claims. I re-ran the full unit suite (235/235 pass)
and the type gate (0 errors) myself this session, re-read the busy-loop catch, `toolControl`, and
`_recordAcceptedAbort` directly in `command_queue.ts`, confirmed the new `SqliteQueue` methods by
direct read and grep, and confirmed via `01-SECURITY.md` and the fresh `01-REVIEW.md` that T-01-08
is closed with 0 critical findings. I specifically assessed whether the quick tasks' busy-loop catch
changes are consistent with the phase goal's "without touching the queue's busy loop" clause and
concluded they are: the running step's dispatch/promise and modal state are untouched; the new
bookkeeping is confined to already-ended steps' queue rows and is driven exclusively by the
operator's own confirmed action. QUE-01 through QUE-06 are all satisfied with no orphaned
requirements. The phase goal — the server side can send an operator's Pause/Resume/Abort to the
running step's tool and report that tool's live run state, without touching the queue's busy loop —
remains achieved and verified after the covered-source changes.

---

*Verified: 2026-10-15T11:23:10Z*
*Verifier: Claude (gsd-verifier)*
