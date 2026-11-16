---
phase: 08-concurrency-lanes
verified: 2026-11-17T01:10:00Z
status: human_needed
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
  - "controller/types/run.ts"
  - "docker-compose.dev.yml"
  - "docker-compose.yml"
covered_digest: "v3:sha256:8c2a266b9c9cd1fcb3b2291aff810daca5610cc0f3a3282a7ae0996f0acd7dee"
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items:
  - truth: "Any failure, a primary-lane modal or the freeze control stops new dispatch on every lane"
    reason: undeclared-precondition
    harden: "Review IN-01: after _shouldSkip (awaited drizzle queries) and before executeCommand, the side lane does not re-check _laneHalt/state. The no-dispatch-after-halt guarantee holds only because better-sqlite3 resolves every await as a microtask. Declare the precondition or re-check the latch after the await and publish _sideRunning.set immediately after the claim."
human_verification:
  - test: "Freeze lanes dialog and effect (08-09 item 1). With GALAGO_PARALLEL_LANES=1 and simulated tools, run the lane-tagged headline cycle, press Freeze lanes, check the dialog, press Enter, then press Freeze lanes again and confirm."
    expected: "Enter in the dialog does not freeze (lanes keep running). Confirming shows the 'Lanes frozen' badge with the freeze sentence, nothing is aborted, and Start appears."
    why_human: "Dialog focus, keyboard behaviour and visual badge state cannot be checked by grep or unit tests."
  - test: "Failure list across lanes (08-09 item 2). Let a simulated step fail on one lane while the other lane runs."
    expected: "The banner keeps the first failure. 'Failures by lane (2)' lists both lanes. The Lanes panel shows the failure sentence."
    why_human: "Live two-lane interaction and rendered banner/list content."
  - test: "Layout and dark mode (08-09 item 3). Widen and narrow the window and switch to dark mode on the run page."
    expected: "Sticky 120px label column, captions aligned under cards, badge and chips keep contrast, Freeze button wraps under the title, no flicker on partial data."
    why_human: "Visual layout, responsive behaviour and contrast."
  - test: "Gantt chart under overlap (08-09 item 4). Open RunQueueGanttChart while two steps on different lanes overlap."
    expected: "Record how overlapping steps render (UI-SPEC unresolved row). No crash or misleading bars."
    why_human: "Visual rendering of overlapping intervals; the spec left this open."
  - test: "'Skip to this command' across lanes (08-09 item 5). Use Skip to this command on a card of the other lane."
    expected: "Record the pre-existing skipUntil behaviour (it skips every lower queue position). Confirm it does not strand or double-dispatch a lane."
    why_human: "Operator-flow behaviour on a pre-existing control with lanes on; needs a running simulated run."
  - test: "Drawer lane controls (08-10 item 1). In the visual editor edit a tool step: type a 32-character lane, then 'Fast', then clear it; toggle 'Wait for all earlier steps'; open a Tool Box step."
    expected: "Long name fits the input and the 120px label column. 'Fast' is stored as 'fast'. Clearing restores the 'primary' placeholder. Tool Box step shows no lane controls. The inert note shows for tool steps."
    why_human: "Interactive input behaviour and layout. Note review IN-02: typing 'primary' fully wipes the field as you type."
  - test: "Lane summary and refusal copy (08-10 item 2). Save a lane-tagged protocol and read the Lane summary. Put a Tool Box note on lane 'fast' via JSON import."
    expected: "Summary shows first-appearance order, barrier suffixes and global positions. The refusal sentence shows in the warning Alert and saving still works."
    why_human: "Rendered copy and import flow."
  - test: "Script preview with and without the flag, and the env flag in Docker (08-10 item 3, assumption A1). Preview a script using galago.lane('fast') once with GALAGO_PARALLEL_LANES unset and once set to 1 in the dev compose environment after restarting the controller."
    expected: "Unset: 'Lane tags ignored: parallel lanes disabled'. Set: grouped Generated Commands, commandQueue.laneStatus reports laneMode true, and the run page shows the Lanes panel."
    why_human: "Needs the Docker compose environment variable to actually reach the controller process."
---

# Phase 8: Concurrency Lanes Verification Report

**Phase Goal:** With the lane flag on, one run can drive two tool servers at once and any failure freezes every lane without aborting anything. Waves: lane engine first, then protocol surface and run page.
**Verified:** 2026-11-17T01:10:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

All code-observable goals are met. No gaps. The status is `human_needed` only because the UI checks the 08-09 and 08-10 plans deliberately deferred to end-of-phase UAT are still open.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1a. Flag off is byte-identical to today | VERIFIED | `_start` begins with `if (this._laneMode) return this._startLanes(source);` (command_queue.ts:1102) and `_pickNext` is the literal legacy `this.commands.startNext()` when off (line 1380). Golden fixture `test/fixtures/lanesFlagOff.golden.ts` was last touched by 2da2ad7 (the 08-01 capture); `git diff 0c1e06e HEAD -- test` shows every other test file is Added except `staticScan.test.ts`, which has zero removed lines (additive). `lanesFlagOff.test.ts` (20 tests) passes in three constructions (default, `parallelLanes:false`, `parallelLanes:true` with untagged protocols) plus the env-read edge cases (only exactly `"1"` enables). Re-run in this verification: green. |
| 2 | SC1b. Flag on, steps on different tool servers overlap, one per tool server, honouring barriers | VERIFIED | `laneScheduling.isEligible` encodes barrier, same-lane order, one STARTED per lane, busy tool-key and controllable-step rules. `_pickNext` reads `queuedRowsSync` -> `pickEligible` -> `claimEligible` with no await between (lines 1384-1394). `lanes.test.ts` "headline cycle overlaps FAST with goto-safe" asserts goto-safe is dispatched while FAST is unresolved and out1 waits for both, every row COMPLETED. `laneScheduling.test.ts` case 1 covers the same on pure rows. 08-03 `claimEligible` tests (10) cover STARTED exclusion. All green in this run. Behavior-dependent, and a behavioural test exercises it. |
| 3 | SC2a. Any failure or a primary-lane modal or the operator's freeze stops new dispatch on every lane, and nothing is aborted | VERIFIED | `_dispatchGate` feeds `halted: this._laneHalt !== undefined` and `modalOpen: this._isWaitingForInput` into `isEligible`. `_latchFailure` is the first statement of the primary catch, side-lane catch (1472) and supervisor catch (1183). `freezeLanes()` (1292) only sets the latch with reason `freeze`, sets OFFLINE, sends nothing. Only `_startLanes` clears the latch, after the enqueue-source early return (1217-1259). `laneHalt.test.ts` (30 tests) covers: primary failure stops FAST dispatch while the running FAST completes, side failure stops primary next step, latch-before-await window, resume/clearError/clearAll leave the latch, enqueue auto-start launches nothing while latched, modal gate and resume ordering, freeze mid-flight, freeze vs failure ordering. Green. See coincidental-reliance note (IN-01). |
| 4 | SC2b. Control, Stop and recovery still work on any lane | VERIFIED | `_controlTarget` picks the running step with a `runControl` entry on any lane; per-queueId side abort markers and failed-attempt tokens; poller owned per attempt with `stopIf(queueId)` (runState.ts, command_queue.ts:1463, 2004). `laneControl.test.ts` (23 tests): Pause/Resume/Abort reach a side-lane F.A.S.T. while STACK runs on primary and vice-versa, accepted abort survives another lane's dispatch in both orders, late side-lane abort replies, run-state envelope never drops, goto refused while a side step runs, busy-tool set survives an accepted abort (D-27). `runStateStopIf.test.ts` (7) covers the poller. Green. |
| 5 | SC3a. Operator can author lane-tagged protocols (visual editor and script) | VERIFIED | Visual: `CommandDetailsDrawer.tsx` Lane input + "Wait for all earlier steps" switch wired through pure `laneFields.setLane/setBarrier` (never writes empty lane or false barrier); `ProtocolDetailView.tsx` builds `buildLaneSummary` and warnings Alert. Script: `protocol-script-executor.ts` exposes `galago.lane(name)` (sticky, blank/primary resets, Tool Box never inherits) and per-call `{ lane, barrier }`, writing `advancedParameters.lane/laneBarrier` only when set. `laneScript.test.ts` + `laneUi.test.ts` green. |
| 6 | SC3b. Operator is refused invalid setups and sees per-lane steps, outcome and failures in preview, Start confirmation and run page | VERIFIED | Refusal: `runs.ts:251` and the `enqueue` router call `validateLanes` (invalid name, non-tool on secondary lane, one tool on two lanes, >4 lanes, first secondary row without barrier, goto in laned run, dead wait via `simulateDrain`) and throw `LaneValidationError` before anything is stored; `pages/api/runs/index.ts` and `routers/run.ts` map it to a clear error; `laneValidation.test.ts` and the laneHalt enqueue cases green. Preview: `protocol.preview` returns `laneWarnings`. Start confirmation: `queueStartListing.laneListing` and `queuedStartSummary` list per lane. Run page: `SwimLaneComponent` groups by `groupRowsByLane`; `deriveRunOutcome` is lane-aware (Pitfall 23 cases); `LanesPanel`, `LaneFailureList` (in `RunsComponent` banner), `useLaneStatus` poll `commandQueue.laneStatus`; `freezeLanes` and `laneStatus` procedures in `routers/command_queue.ts`. All wired; rendered behaviour is routed to human verification. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/server/laneScheduling.ts` | Pure policy: eligibility, validateLanes, grouping | VERIFIED | 376 lines, no imports (purity pinned by test), consumed by command_queue, runs, protocol router, script executor, UI helpers |
| `controller/server/command_queue.ts` | Lane engine behind `_laneMode` | VERIFIED | `_startLanes`, `_launchLane`, `_ensureLaneWorkers`, `_runSideLane`, `_pickNext`, `_dispatchGate`, `freezeLanes`, `laneStatus` present and used |
| `controller/server/utils/SqliteQueue.ts` | `claimEligible` sync claim | VERIFIED | Called at command_queue.ts:1394; 10 tests |
| `controller/server/runState.ts` | `stopIf(queueId)` | VERIFIED | Called in both dispatch brackets in lane mode; 7 tests |
| `controller/server/runs.ts`, `routers/command_queue.ts`, `routers/run.ts`, `pages/api/runs/index.ts` | Run-creation refusal, freeze and status procedures | VERIFIED | Wired as described in truth 6 |
| `controller/server/scripting/protocol-script-executor.ts` | `galago.lane` | VERIFIED | Lines 25-55 |
| `controller/components/runs/{LanesPanel,LaneFailureList,laneStatus}.tsx/ts`, `hooks/useLaneStatus.ts` | Run-page lane UI | VERIFIED | Imported and rendered from RunsComponent (lines 37-39, 261, 618) and QueueStatuscomponent |
| `controller/components/protocols/{laneFields.ts,CommandDetailsDrawer.tsx,ProtocolDetailView.tsx}` | Editor lane controls and per-lane preview | VERIFIED | Wired as described in truth 5 |
| `controller/test/fixtures/lanesFlagOff.golden.ts` | Golden transcript S0-S3 | VERIFIED | Unchanged since capture commit 2da2ad7 |
| `docker-compose.yml`, `docker-compose.dev.yml` | `GALAGO_PARALLEL_LANES=${GALAGO_PARALLEL_LANES:-}` | VERIFIED | Lines 21 and 19. End-to-end delivery into the container needs a human (see human_verification) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| command_queue `_pickNext` | laneScheduling `pickEligible` | `pickEligible(rows, lane, this._dispatchGate())` | WIRED | line 1384 |
| command_queue `_pickNext` | SqliteQueue `claimEligible` | same synchronous turn | WIRED | line 1394, no await between |
| command_queue `_ensureLaneWorkers` | `lanesWithWork` | import | WIRED | line 1203 |
| routers/command_queue `restart` | `isStartInProgress` | lane branch | WIRED | per 08-04 plan and lanes.test "restart ... not accepted" |
| routers/command_queue `freezeLanes`/`laneStatus` | CommandQueue | direct | WIRED | lines 48-50 |
| `LanesPanel`/`RunsComponent`/`QueueStatuscomponent` | `commandQueue.laneStatus` | `useLaneStatus` hook | WIRED | 1500 ms poll |
| `runs.ts` / `routers/protocol.ts` | `validateLanes` | direct | WIRED | runs.ts:252, protocol.ts:265-271 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| LanesPanel / LaneFailureList | `laneStatus` (failures, runningLanes, halted) | `CommandQueue.laneStatus()` reading `_laneFailures`, `_sideRunning`, `_laneHalt`, queued rows | Yes | FLOWING |
| SwimLaneComponent | `runCommands` grouped by lane | stored run rows with `advancedParameters.lane` | Yes | FLOWING |
| Preview lane summary | `laneWarnings` | `validateLanes` over resolved commands | Yes | FLOWING |
| Start confirmation | `queuedStartLines` | queued rows from the queue | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Engine, halt, control, policy, UI helpers, claim, stopIf | `npx vitest run test/lanes.test.ts test/laneHalt.test.ts test/laneControl.test.ts test/laneScheduling.test.ts test/laneUi.test.ts test/sqliteQueueClaim.test.ts test/runStateStopIf.test.ts` | 7 files, 205 tests passed | PASS |
| Script API, run-creation validation, flag-off golden | `npx vitest run test/laneScript.test.ts test/laneValidation.test.ts test/lanesFlagOff.test.ts` | 3 files, 44 tests passed | PASS |
| Full suite, 20x loop, tsc, lint, build | Established earlier this session (not re-run) | 47 files / 1361 tests green; 20x loop green; clean | PASS (cited) |

### Probe Execution

Step 7c: SKIPPED. No probe scripts declared in the phase plans.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| LAN-01 | 08-01, 08-04 | Flag off byte-identical | SATISFIED | Truth 1 |
| LAN-02 | 08-02, 08-04 | Cross-tool overlap, one step per tool server | SATISFIED | Delivered by the finished engine: `isEligible` busy-tool-key and per-lane STARTED rules, plus `_dispatchGate` in-memory busy set; headline tracer, "a tool server stays busy after an accepted abort" green. Not just 08-02's pure policy |
| LAN-03 | 08-02, 08-04 | Barrier or dependency; untagged waits for everything before | SATISFIED | Barrier loop in `isEligible`; untagged = primary, serialised ("serialises an untagged run on the primary lane"); out1 waits for FAST and goto-safe in the tracer. Engine wiring through `_pickNext` confirmed |
| LAN-04 | 08-03, 08-04 | Per-lane single-flight Start guard | SATISFIED | `_startLanes` per-lane guard, `Lane Start Ignored`, same-tick double Start dispatches once; `claimEligible` refuses STARTED |
| LAN-05 | 08-05 | Any failure stops dispatch on every lane, running steps not aborted, only operator Start clears | SATISFIED | Truth 3 |
| LAN-06 | 08-02, 08-05 | Primary-lane modal stops dispatch everywhere; non-tool steps primary only | SATISFIED | `laneOf` forces Tool Box to primary; `modalOpen` in gate; laneHalt modal-gate tests. 08-02 delivered the pure rule; 08-05 wired the gate in the engine, so the early completion mark is genuinely backed |
| LAN-07 | 08-03, 08-06 | Pause/resume/abort reach F.A.S.T. on any lane; poller never stopped by another lane; per-step markers | SATISFIED | Truth 4 |
| LAN-08 | 08-06 | Stop, Clear All, run delete abort first for every controllable running step | SATISFIED | laneControl "abort-first envelope", accepted-abort and envelope tests; `clearAll` handled in laneHalt tests |
| LAN-09 | 08-05, 08-09 | Operator freeze control, nothing aborted | SATISFIED | `freezeLanes` plus confirmed Freeze in `LanesPanel`; dialog behaviour is a human item |
| LUI-01 | 08-08, 08-10 | Visual editor lane and barrier | SATISFIED | Truth 5 |
| LUI-02 | 08-07 | Script protocol can tag steps with `galago.lane(...)` and declare dependencies | SATISFIED (code); REQUIREMENTS.md checkbox stale | `galago.lane()` sticky lane and `command(..., { lane, barrier })` implemented in `protocol-script-executor.ts`; barrier is the declared dependency (same mechanism LAN-03 and LUI-01 use). `laneScript.test.ts` (sticky, reset, Tool Box non-inheritance, override, no undefined/empty/false keys, preview warnings) passes. The unchecked box and "Pending" traceability row at REQUIREMENTS.md lines 125 and 212 are bookkeeping only; they should be flipped to `[x]` / Complete. No code gap |
| LUI-03 | 08-02, 08-05, 08-07, 08-10 | Run creation refuses invalid setups | SATISFIED | Truth 6 |
| LUI-04 | 08-07, 08-08, 08-09, 08-10 | Preview and Start confirmation list per lane | SATISFIED | Truth 6 (see WR-03 warning) |
| LUI-05 | 08-08, 08-09 | Run page per-lane steps, statuses, timestamps, lane-aware outcome | SATISFIED | Truth 6 |
| LUI-06 | 08-05, 08-08, 08-09 | Banner lists each lane's failure, first keeps STACK guid | SATISFIED | laneHalt "first failure is kept" tests; `LaneFailureList`. See WR-05 warning |

All 15 phase IDs appear in at least one PLAN `requirements:` field and in ROADMAP. REQUIREMENTS.md maps no other ID to Phase 8: no orphans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | `TBD`/`FIXME`/`XXX` scan over all phase production files | - | Clean |
| command_queue.ts | 1637, 1457 | Throwing calls between claim and the step's `try` (review WR-02) | Warning | A `queuedRowsSync` or monitor-start throw leaves the claimed row STARTED with no owner; the lane is then blocked until process restart. Fails closed, nothing is sent, no recovery path for the operator |
| queueStartListing.ts, queuedStartSummary.ts, ProtocolDetailView.tsx | 41-45 / 156-160 / 598-603 | Lane text not gated on `laneMode` (review WR-03) | Warning | With the flag off and a lane-tagged queue, the "Queue Started" audit line and Start confirmation describe lanes and parallel start. The golden transcript covers untagged protocols only, so SC1 byte identity for untagged runs holds, but this is operator-misleading text |
| laneScheduling.ts | 78-111 | Non-boolean `laneBarrier` or non-string `lane` silently ignored, not rejected (review WR-01) | Warning | Stored JSON could drop a barrier and run less sequentially than the author meant |
| command_queue.ts | 957-1004, 798-847 | goto methods do not clear `_sideFailedAttempts` (review WR-06) | Warning | A late abort reply for a failed side-lane step after a goto could dequeue re-queued rows |
| RunsComponent.tsx, command_queue.ts | 233 / 521-549 | ErrorBanner remount (WR-04) and first-failure assumed to be banner entry after `clearError()` (WR-05) | Warning | Scroll position loss; after clearError a failure message can be hidden |

08-REVIEW.md: 0 critical, 6 warning, 5 info; all dispositions are still `open` in 08-REVIEW-DISPOSITION.md. None breaks a stated success criterion, so none is promoted to a blocker, but WR-02 and WR-06 touch safety-adjacent recovery paths and are the first candidates for a `/gsd-code-review 8 --fix` pass before Phase 9's supervised live run.

### Human Verification Required

See the `human_verification` frontmatter list (eight items covering the five 08-09 run-page checks and the three 08-10 editor, preview and Docker env-flag checks). Use simulated tools only, never a moving instrument.

### Gaps Summary

No gaps. Every roadmap success criterion and every one of the 15 requirement IDs is backed by code that exists, is wired and is exercised by a behavioural test that passes. Two items to carry forward:

1. **Bookkeeping:** flip LUI-02 to `[x]` and "Complete" in `.planning/REQUIREMENTS.md` (lines 125 and 212). The implementation is present and tested.
2. **Open review warnings (WR-01 to WR-06):** decide fix or accept before Phase 9. WR-03 is the only one that bears on SC1 wording (flag-off text with lane-tagged queues); the untagged flag-off path is proven byte-identical.

---

_Verified: 2026-11-17T01:10:00Z_
_Verifier: Claude (gsd-verifier)_
