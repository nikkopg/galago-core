---
phase: 08-concurrency-lanes
verified: 2026-11-17T01:30:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".planning/phases/08-concurrency-lanes/08-01-PLAN.md"
  - ".planning/phases/08-concurrency-lanes/08-01-SUMMARY.md"
  - ".planning/phases/08-concurrency-lanes/08-02-PLAN.md"
  - ".planning/phases/08-concurrency-lanes/08-02-SUMMARY.md"
  - ".planning/phases/08-concurrency-lanes/08-03-PLAN.md"
  - ".planning/phases/08-concurrency-lanes/08-03-SUMMARY.md"
  - ".planning/phases/08-concurrency-lanes/08-04-PLAN.md"
  - ".planning/phases/08-concurrency-lanes/08-04-SUMMARY.md"
  - ".planning/phases/08-concurrency-lanes/08-05-PLAN.md"
  - ".planning/phases/08-concurrency-lanes/08-05-SUMMARY.md"
  - ".planning/phases/08-concurrency-lanes/08-06-PLAN.md"
  - ".planning/phases/08-concurrency-lanes/08-06-SUMMARY.md"
  - ".planning/phases/08-concurrency-lanes/08-07-PLAN.md"
  - ".planning/phases/08-concurrency-lanes/08-07-SUMMARY.md"
  - ".planning/phases/08-concurrency-lanes/08-08-PLAN.md"
  - ".planning/phases/08-concurrency-lanes/08-08-SUMMARY.md"
  - ".planning/phases/08-concurrency-lanes/08-09-PLAN.md"
  - ".planning/phases/08-concurrency-lanes/08-09-SUMMARY.md"
  - ".planning/phases/08-concurrency-lanes/08-10-PLAN.md"
  - ".planning/phases/08-concurrency-lanes/08-10-SUMMARY.md"
  - "controller/components/protocols/CommandDetailsDrawer.tsx"
  - "controller/components/protocols/ProtocolDetailView.tsx"
  - "controller/components/protocols/laneFields.ts"
  - "controller/components/runs/LaneFailureList.tsx"
  - "controller/components/runs/LanesPanel.tsx"
  - "controller/components/runs/RunsComponent.tsx"
  - "controller/components/runs/laneStatus.ts"
  - "controller/components/runs/list/SwimLaneComponent.tsx"
  - "controller/components/runs/queuedStartSummary.ts"
  - "controller/components/runs/runOutcome.ts"
  - "controller/components/runs/status/QueueStatuscomponent.tsx"
  - "controller/components/runs/utils.ts"
  - "controller/hooks/useLaneStatus.ts"
  - "controller/pages/api/runs/index.ts"
  - "controller/server/command_queue.ts"
  - "controller/server/laneScheduling.ts"
  - "controller/server/queueStartListing.ts"
  - "controller/server/routers/command_queue.ts"
  - "controller/server/routers/protocol.ts"
  - "controller/server/routers/run.ts"
  - "controller/server/routers/tool.ts"
  - "controller/server/runState.ts"
  - "controller/server/runs.ts"
  - "controller/server/scripting/protocol-script-executor.ts"
  - "controller/server/utils/SqliteQueue.ts"
  - "controller/test/fixtures/lanesFlagOff.golden.ts"
  - "controller/test/laneReviewFixes.test.ts"
  - "controller/types/run.ts"
  - "docker-compose.dev.yml"
  - "docker-compose.yml"
covered_digest: "v3:sha256:a3d7df7e1a869d715c0b0d2c008848cc6b0dabf1396430d3b87b36fad2cee2d5"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  human_items_resolved: "8 of 8 (08-UAT.md status complete, 8 passed, 0 issues)"
  stale_reason: "Commits c438887 (WR-02, WR-06) and 773389c (WR-03) changed command_queue.ts, queueStartListing.ts, queuedStartSummary.ts, QueueStatuscomponent.tsx and ProtocolDetailView.tsx after the previous report."
coincidental_reliance_items:
  - truth: "Any failure, a primary-lane modal or the freeze control stops new dispatch on every lane"
    reason: undeclared-precondition
    harden: "Review IN-01 (still open, advisory): after _shouldSkip (awaited drizzle queries) and before executeCommand, the side lane does not re-check _laneHalt/state. The no-dispatch-after-halt guarantee holds only because better-sqlite3 resolves every await as a microtask. Declare the precondition, or re-check the latch after the await and publish _sideRunning.set immediately after the claim."
---

# Phase 8: Concurrency Lanes Verification Report

**Phase Goal:** With the lane flag on, one run can drive two tool servers at once and any failure freezes every lane without aborting anything. Waves: lane engine first, then protocol surface and run page.
**Verified:** 2026-11-17T01:30:00Z
**Status:** passed
**Re-verification:** Yes. The previous report (human_needed) went stale after review-fix commits c438887 and 773389c. This pass re-checked those fixes against the code, re-ran the phase tests and recomputed the fingerprint.

The eight human-verification items from the previous report are now closed by 08-UAT.md (status complete, 8 passed, 0 issues; seven automated against a simulated rig with `GALAGO_PARALLEL_LANES=1`, one confirmed by the user). All must-haves are verified. No gaps and no blockers.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1a. Flag off is byte-identical to today | VERIFIED | `_start` begins `if (this._laneMode) return this._startLanes(source);`, and `_pickNext` is the literal legacy `this.commands.startNext()` when off. The golden fixture `test/fixtures/lanesFlagOff.golden.ts` has only the two 08-01 capture commits in its history (98b50d6, 2da2ad7), so the post-review fixes did not touch it. `lanesFlagOff.test.ts` (20 tests) passes in this run. The WR-02 edit keeps `_ensureLaneWorkers()` behind `if (this._laneMode)`. The WR-03 edit makes the flag-off "Queue Started" audit line match legacy text, because `describeQueueStart(..., laneMode = false)` omits the lane listing. |
| 2 | SC1b. Flag on, steps on different tool servers overlap, one per tool server, honouring barriers | VERIFIED | `laneScheduling.isEligible` plus `_pickNext` (`queuedRowsSync` -> `pickEligible` -> `claimEligible`, no await between). `lanes.test.ts` (12) headline cycle: goto-safe is dispatched while FAST is unresolved, out1 waits for both, every row COMPLETED. UAT 1 and 5 show the same on a simulated rig: FAST and goto-safe STARTED together, then out1 and out2 after both ended. Behavior-dependent, exercised by a passing test. |
| 3 | SC2a. Any failure, a primary-lane modal or the operator's freeze stops new dispatch on every lane, and nothing is aborted | VERIFIED | `_latchFailure` is the first statement of each catch (primary, side lane, supervisor). `freezeLanes()` sets only the latch and sends nothing. `laneHalt.test.ts` (32 tests) passes, including failure, freeze, modal gate and latch-clearing cases. UAT 1: after the freeze the running FAST and goto-safe rows ended COMPLETED, not aborted, and out1/out2 stayed CREATED until Start. UAT 2: a primary failure halted dispatch while FAST ran. See coincidental-reliance note (IN-01, advisory). |
| 4 | SC2b. Control, Stop and recovery still work on any lane | VERIFIED | `laneControl.test.ts` (25) and `runStateStopIf.test.ts` pass. The WR-06 fix clears `_sideFailedAttempts` in `gotoCommand` and `gotoCommandByRunIndex`, so a late side-lane abort reply cannot dequeue rows the operator re-queued. `laneReviewFixes.test.ts` exercises both goto paths with a behavioural test, and it passes. |
| 5 | SC3a. Operator can author lane-tagged protocols (visual editor and script) | VERIFIED | `CommandDetailsDrawer.tsx` Lane input and barrier switch go through `laneFields.setLane/setBarrier`. `galago.lane(name)` and per-call `{ lane, barrier }` are in `protocol-script-executor.ts`. `laneScript.test.ts` and `laneUi.test.ts` pass. UAT 6 and 8 confirmed the editor controls and the script preview in the live UI. |
| 6 | SC3b. Operator is refused invalid setups and sees per-lane steps, outcome and failures in preview, Start confirmation and run page | VERIFIED | `validateLanes` is called from `runs.ts` and the enqueue router. Refusals map to 400 or BAD_REQUEST. `laneValidation.test.ts` passes. The WR-03 fix gates lane text on server lane mode: `QueueStatuscomponent` passes `laneMode` only from a successful `useLaneStatus` read, `queuedStartLines` lists lanes only when `laneMode === true`, and the editor's lane summary shows the inert note when `!lanesActive`. The only caller of `queuedStartLines` in production code passes `laneMode`, and the only caller of `describeQueueStart` passes `this._laneMode`. UAT 2, 3, 4, 7 and 8 confirmed the run-page and preview rendering. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/server/laneScheduling.ts` | Pure policy | VERIFIED | Consumed by the engine, run creation, protocol router, script executor and UI helpers. |
| `controller/server/command_queue.ts` | Lane engine behind `_laneMode` | VERIFIED | Present and used. Post-review edits (WR-02, WR-06, WR-03) read in this pass. |
| `controller/server/utils/SqliteQueue.ts` | `claimEligible` sync claim | VERIFIED | Called by `_pickNext`. `sqliteQueueClaim.test.ts` passes. |
| `controller/server/runState.ts` | `stopIf(queueId)` | VERIFIED | `runStateStopIf.test.ts` passes. |
| `controller/server/runs.ts`, `routers/command_queue.ts`, `routers/run.ts`, `pages/api/runs/index.ts` | Run-creation refusal, freeze and status procedures | VERIFIED | Unchanged since the previous report. |
| `controller/server/scripting/protocol-script-executor.ts` | `galago.lane` | VERIFIED | Unchanged. |
| `controller/components/runs/{LanesPanel,LaneFailureList,laneStatus}`, `hooks/useLaneStatus.ts` | Run-page lane UI | VERIFIED | Imported and rendered. UAT 1 and 2 saw them live. |
| `controller/components/protocols/{laneFields.ts,CommandDetailsDrawer.tsx,ProtocolDetailView.tsx}` | Editor lane controls and per-lane preview | VERIFIED | `ProtocolDetailView` now imports `useLaneStatus` and `LANE_INERT_NOTE` (WR-03). |
| `controller/server/queueStartListing.ts`, `components/runs/queuedStartSummary.ts` | Lane listing gated on lane mode | VERIFIED | Gating confirmed in the diff and in `laneUi.test.ts`. |
| `controller/test/fixtures/lanesFlagOff.golden.ts` | Golden transcript | VERIFIED | Unchanged since capture. |
| `docker-compose.yml`, `docker-compose.dev.yml` | `GALAGO_PARALLEL_LANES` passthrough | VERIFIED | UAT 8 recreated the container with the flag set and unset; `laneStatus.laneMode` followed it. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `_pickNext` | `pickEligible` / `claimEligible` | same synchronous turn | WIRED | Unchanged. |
| `_runBusyLoopWhileQueueNotEmpty` | `_ensureLaneWorkers` | before `_pickNext` (WR-02) | WIRED | Reconcile now happens before the claim, behind `if (this._laneMode)`. |
| `_runSideLane` | `_sideRunning.set` / `_runStateMonitor.start` | inside the outer try (WR-02) | WIRED | A throw is routed to the side-lane catch and fails the row. |
| `gotoCommand` / `gotoCommandByRunIndex` | `_sideFailedAttempts.clear()` | direct (WR-06) | WIRED | Both methods. |
| `_describeQueueStart` | `describeQueueStart(rows, source, this._laneMode)` | direct (WR-03) | WIRED | A `laneUi.test.ts` source check pins it. |
| `QueueStatusComponent` | `queuedStartLines({ laneMode })` | `useLaneStatus().isSuccess` | WIRED | Single production caller. |
| `ProtocolDetailView` | `useLaneStatus` | inert note when `!lanesActive` | WIRED | WR-07 (open) concerns the loading state of this note. |
| `RunsComponent` / `LanesPanel` | `commandQueue.laneStatus` | `useLaneStatus` poll | WIRED | Unchanged. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| LanesPanel / LaneFailureList | `laneStatus` | `CommandQueue.laneStatus()` | Yes | FLOWING (UAT 1, 2) |
| SwimLaneComponent | rows grouped by lane | stored run rows | Yes | FLOWING |
| Preview lane summary | `laneWarnings` | `validateLanes` | Yes | FLOWING (UAT 7, 8) |
| Start confirmation | `queuedStartLines` | queued rows plus `laneMode` from a successful status read | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase lane suites, including the review-fix tests | `npx vitest run test/lanes.test.ts test/laneHalt.test.ts test/laneControl.test.ts test/laneScheduling.test.ts test/laneUi.test.ts test/sqliteQueueClaim.test.ts test/runStateStopIf.test.ts test/laneScript.test.ts test/laneValidation.test.ts test/lanesFlagOff.test.ts test/laneReviewFixes.test.ts` | 11 files, 256 tests passed (run in this verification) | PASS |
| Type check | `npx tsc --noEmit` in `controller/` | No output, clean (run in this verification) | PASS |
| Full suite | Not re-run by this verifier. Passed in the regression gate cited by the caller | 48 files / 1368 tests green, tsc clean (2026-11-17) | PASS (cited) |

### Probe Execution

Step 7c: SKIPPED. No probe scripts declared in the phase plans.

### Requirements Coverage

All 15 phase IDs appear in at least one PLAN `requirements:` field and are marked `[x]` and "Complete" in REQUIREMENTS.md (lines 101-131 and 202-216). REQUIREMENTS.md maps no other ID to Phase 8: no orphans. The LUI-02 checkbox that the previous report flagged as stale is now `[x]` and Complete.

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| LAN-01 | 08-01, 08-04 | SATISFIED | Truth 1. |
| LAN-02 | 08-02, 08-04 | SATISFIED | Truth 2. |
| LAN-03 | 08-02, 08-04 | SATISFIED | Barrier loop in `isEligible`; out1 waits for FAST and goto-safe (tracer, UAT 1 and 5). |
| LAN-04 | 08-03, 08-04 | SATISFIED | Per-lane Start guard and `claimEligible`. The WR-02 fix removes the case where a claimed row stayed STARTED with no owner. |
| LAN-05 | 08-05 | SATISFIED | Truth 3. |
| LAN-06 | 08-02, 08-05 | SATISFIED | `laneOf` forces Tool Box to primary; `modalOpen` in the dispatch gate. |
| LAN-07 | 08-03, 08-06 | SATISFIED | Truth 4. |
| LAN-08 | 08-06 | SATISFIED | Abort-first envelope tests in `laneControl.test.ts`. |
| LAN-09 | 08-05, 08-09 | SATISFIED | `freezeLanes` plus the confirmed dialog. UAT 1 confirmed live (Enter dismisses, confirm freezes, nothing aborted). |
| LUI-01 | 08-08, 08-10 | SATISFIED | Truth 5; UAT 6. |
| LUI-02 | 08-07 | SATISFIED | `galago.lane()` and `{ lane, barrier }`; `laneScript.test.ts`; UAT 8. |
| LUI-03 | 08-02, 08-05, 08-07, 08-10 | SATISFIED | Truth 6. |
| LUI-04 | 08-07, 08-08, 08-09, 08-10 | SATISFIED | Truth 6. WR-03 is fixed: lane text now only appears when the server has lanes on. |
| LUI-05 | 08-08, 08-09 | SATISFIED | Truth 6; UAT 3, 4 and 5. |
| LUI-06 | 08-05, 08-08, 08-09 | SATISFIED | First failure kept as headline and the per-lane list shown (UAT 2). See WR-05 (open, advisory). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (phase production files) | - | `TBD`/`FIXME`/`XXX` scan over command_queue.ts, laneScheduling.ts, queueStartListing.ts, the run and protocol lane components, laneFields.ts and useLaneStatus.ts | - | Clean |

Review status (08-REVIEW.md incremental pass, 0 critical, 2 warning, 4 info; dispositions in 08-REVIEW-DISPOSITION.md): WR-02, WR-03 and WR-06 are fixed and confirmed in this pass. These remain open and are advisory, with none breaking a success criterion:

- **WR-01** Non-canonical `lane` or `laneBarrier` stored values are ignored rather than rejected.
- **WR-04** `ErrorBanner` is declared inside render, so the failure list loses scroll position.
- **WR-05** The first failure-list entry is assumed to be the banner error, which is false after `clearError()`.
- **WR-07** The editor says "runs its steps one at a time" before the server mode is known.
- **IN-01 to IN-07** Info items. IN-01 is the coincidental-reliance note above.

None of these is a debt marker. Phase 9 owns the supervised live run, so a fix-or-accept decision on WR-01, WR-05 and IN-01 is worth making before it.

### Human Verification Required

None outstanding. The eight items from the previous report were completed in 08-UAT.md: 8 of 8 passed, 0 issues. Test 3 (layout and dark mode) was confirmed by the user. The other seven were automated in Chrome against simulated tool servers with `GALAGO_PARALLEL_LANES=1`, and real instruments were not touched.

UAT 4 recorded one non-blocking observation. At the default Minutes View span the Gantt bars for overlapping steps are thin slivers, and the per-lane timestamps on the run cards are clearer. The chart shows no misleading overlap, and it has one row per tool type.

### Gaps Summary

No gaps. Every roadmap success criterion and all 15 requirement IDs are backed by code that exists, is wired and is exercised by passing tests. The post-verification review fixes were confirmed in the diff and by tests, and they did not alter the flag-off path or the golden transcript. UAT closed the UI-dependent checks.

---

_Verified: 2026-11-17T01:30:00Z_
_Verifier: Claude (gsd-verifier)_
