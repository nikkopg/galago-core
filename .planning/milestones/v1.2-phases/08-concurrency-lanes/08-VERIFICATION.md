---
phase: 08-concurrency-lanes
verified: 2026-11-17T08:50:00Z
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
  - "controller/test/laneScheduling.test.ts"
  - "controller/test/laneUi.test.ts"
  - "controller/types/run.ts"
  - "docker-compose.dev.yml"
  - "docker-compose.yml"
covered_digest: "v3:sha256:94fd31e73466632a3f5e96e6aa9e2fb60fbf2ca0cceb1e9f234f8c97935c514f"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  stale_reason: "Review-fix commits 4c494a4 (WR-01), 8b8786c (WR-04), 9b25bec (WR-05) and d09a047 (WR-07) changed covered source files laneScheduling.ts, command_queue.ts, laneStatus.ts, laneFields.ts, ProtocolDetailView.tsx and RunsComponent.tsx, plus the laneScheduling, laneUi and laneReviewFixes tests, after the previous report."
coincidental_reliance_items:
  - truth: "Any failure, a primary-lane modal or the freeze control stops new dispatch on every lane"
    reason: undeclared-precondition
    harden: "Review IN-01 (open, advisory, unchanged by the fix commits): after _shouldSkip (awaited drizzle queries) and before executeCommand, the side lane does not re-check _laneHalt/state. The no-dispatch-after-halt guarantee holds only because better-sqlite3 resolves every await as a microtask. Declare the precondition, or re-check the latch after the await and publish _sideRunning.set immediately after the claim."
advisory:
  - finding: "WR-08: _recordFailure moves the banner flag only when a lane context is present. A context-free failure (the _failStart(e) call in the lane start catch, or the public fail()) after clearError() sets this.error without clearing the old banner:true flag, so that earlier entry's message is hidden in the list while the banner shows a different error."
    category: other
    reason: "Narrow (needs clearError() plus a context-free failure while two or more lane failures are listed). fail() has no production caller. Does not affect the first-failure-keeps-the-guid rule (LUI-06) or any dispatch behaviour. Fix: clear the flags whenever the error slot is refilled in lane mode, regardless of ctx."
    evidence_status: "code read by verifier (command_queue.ts 521-557, 1295); no failing test"
  - finding: "WR-09: with the server confirmed off, a summary that holds only refusals (no groups) renders an empty 'Lane summary' heading with the 'one at a time' note."
    category: other
    reason: "Cosmetic, flag-off editor only; the note itself is accurate. Fix: render the section in off mode only when groups exist."
    evidence_status: "code read by verifier (ProtocolDetailView.tsx 774-786, laneFields.ts laneSummaryView); no failing test"
  - finding: "WR-10: validateLanes rule 0 refuses lane: null and laneBarrier: null (and a present undefined laneBarrier) in lane mode, where dispatch previously treated them as primary / no barrier."
    category: other
    reason: "Not a regression of any in-repo data: setLane, setBarrier and the script executor delete the key rather than write null, JSON drops undefined, and the check runs only when laneMode is on (default off), at run creation, protocol-preview and enqueue. The refusal carries a clear sentence, which fits LUI-03. Only hand-edited or externally imported JSON with explicit nulls is affected. Policy choice (treat null/undefined as absent, or keep refusing) is left to the maintainer."
    evidence_status: "all writers grepped by verifier; no failing test"
---

# Phase 8: Concurrency Lanes Verification Report

**Phase Goal:** With the lane flag on, one run can drive two tool servers at once and any failure freezes every lane without aborting anything. Waves: lane engine first, then protocol surface and run page.
**Verified:** 2026-11-17T08:50:00Z
**Status:** passed
**Re-verification:** Yes. The previous report (passed, commit 487a1ae) went stale after four review-fix commits (4c494a4, 8b8786c, 9b25bec, d09a047). This pass read the diff `8ece3ad..HEAD` over all covered source, re-ran the lane suites and `tsc`, judged the three new review warnings (WR-08, WR-09, WR-10) against each must-have, and recomputed the fingerprint.

Result: no gap and no blocker. All six roadmap truths still hold, all 15 requirement IDs are accounted for, the flag-off path and the golden transcript are untouched, and none of the new review findings breaks a success criterion.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1a. Flag off is byte-identical to today | VERIFIED | `_start` still routes to `_startLanes` only when `_laneMode`; `_pickNext` is the legacy `startNext()` when off. The golden fixture `test/fixtures/lanesFlagOff.golden.ts` has only the two 08-01 capture commits (98b50d6, 2da2ad7) in `git log`. `lanesFlagOff.test.ts` (20 tests) passes in this run. The fix commits are gated: WR-01's rule 0 sits in `validateLanes`, whose three call sites (`runs.ts:252`, `routers/protocol.ts:270`, `command_queue.ts:2146`) are all behind `laneMode`; WR-05's flag logic is inside `if (this._laneMode && ctx)`; WR-07 changes only the editor's lane summary. |
| 2 | SC1b. Flag on, steps on different tool servers overlap, one per tool server, honouring barriers | VERIFIED | No change to `isEligible`, `_pickNext` or `claimEligible` in the fix diff. `lanes.test.ts` (12 tests, headline cycle: goto-safe dispatched while FAST is unresolved, out1 waits for both) passes in this run. Behavior-dependent and exercised by a passing test. Earlier UAT 1 and 5 showed the same live on a simulated rig. |
| 3 | SC2a. Any failure, a primary-lane modal or the operator's freeze stops new dispatch on every lane, and nothing is aborted | VERIFIED | `_latchFailure`, `freezeLanes` and the modal gate are not in the fix diff. `laneHalt.test.ts` (32 tests) passes in this run. WR-05 touches only how a failure is listed (`banner` flag in `_recordFailure`), after `_latchFailure` has run, so the halt is unaffected. See the coincidental-reliance note (IN-01, advisory, unchanged). |
| 4 | SC2b. Control, Stop and recovery still work on any lane | VERIFIED | No change to the control path in the fix diff. `laneControl.test.ts` (25) and `runStateStopIf.test.ts` pass in this run. `laneReviewFixes.test.ts` (goto paths, plus the new WR-05 behaviour tests against a real `CommandQueue`) passes. |
| 5 | SC3a. Operator can author lane-tagged protocols (visual editor and script) | VERIFIED | The writers are unchanged and still emit only canonical tags: `setLane` and `setBarrier` delete the key (never write `""`, `false` or `null`), and the script executor writes `lane` and `laneBarrier: true` only when set. They therefore pass the new rule 0. `laneScript.test.ts`, `laneUi.test.ts` and `laneScheduling.test.ts` pass. UAT 6 to 8 confirmed the controls and the script preview live. |
| 6 | SC3b. Operator is refused invalid setups and sees per-lane steps, outcome and failures in preview, Start confirmation and run page | VERIFIED | `validateLanes` now also refuses wrong-typed `lane` and `laneBarrier` tags (rule 0, WR-01), with sentences `barrierNotBoolean` and `laneNotText`, which strengthens LUI-03. The run-page failure list uses the `banner` flag so only the banner's own failure has its message hidden (WR-05); with the common case (no `clearError()`) entry 0 is the banner, so the earlier UAT 2 rendering is unchanged. `ErrorBanner` is now called as a function (WR-04); its body contains no hook calls (read in this pass), so a plain call is safe. The editor claims "one at a time" only when `laneUiState` is `off` (a successful `laneStatus` read with `laneMode` not true), and says nothing while loading or on error (WR-07). `laneUi.test.ts` and `laneValidation.test.ts` pass. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Deferred Items

None.

### Advisory (New Scope, Unevidenced)

New findings from the incremental review of the fix commits. Reported, not blocking. Each was re-read in the code by this verifier.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | WR-08 stale `banner` flag on a context-free failure after `clearError()` | other | Narrow trigger, `fail()` has no production caller, no must-have affected |
| 2 | WR-09 empty "Lane summary" section in flag-off editor when only refusals exist | other | Cosmetic, flag-off only |
| 3 | WR-10 rule 0 refuses explicit `null`/`undefined` tags in lane mode | other | No in-repo writer produces them, flag default off, refusal is announced |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/server/laneScheduling.ts` | Pure policy plus `validateLanes` | VERIFIED | Rule 0 and `banner?: boolean` on `LaneFailureEntry` present, consumed by engine, run creation, protocol router and UI helpers. |
| `controller/server/command_queue.ts` | Lane engine behind `_laneMode` | VERIFIED | `_recordFailure` sets and moves `banner`; `enqueueRun` still applies `validateLanes` only in lane mode. |
| `controller/server/utils/SqliteQueue.ts`, `controller/server/runState.ts` | `claimEligible`, `stopIf` | VERIFIED | Unchanged; their suites pass. |
| `controller/server/runs.ts`, `routers/*`, `pages/api/runs/index.ts`, `scripting/protocol-script-executor.ts`, `queueStartListing.ts` | Refusal, freeze, status, script API, listing | VERIFIED | Unchanged by the fix commits. |
| `controller/components/runs/laneStatus.ts` | Failure list view | VERIFIED | `describeLaneFailures` keys the hidden message on `banner === true`; new `BANNER_FAILURE_NOTE`. Used by `LaneFailureList`. |
| `controller/components/runs/RunsComponent.tsx` | Run page | VERIFIED | `{ErrorBanner()}` is the only use. |
| `controller/components/protocols/laneFields.ts`, `ProtocolDetailView.tsx` | Editor lane summary | VERIFIED | `laneUiState` and `laneSummaryView` exported and used by `ProtocolDetailView`. |
| `controller/components/runs/{LanesPanel,LaneFailureList}.tsx`, `hooks/useLaneStatus.ts`, drawer, swim lane, outcome, queued summary | Lane UI | VERIFIED | Unchanged since the previous pass. |
| `controller/test/fixtures/lanesFlagOff.golden.ts` | Golden transcript | VERIFIED | Not modified since capture. |
| `docker-compose.yml`, `docker-compose.dev.yml` | Flag passthrough | VERIFIED | Unchanged; UAT 8. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `_recordFailure` | `LaneFailureEntry.banner` | `becomesBanner = !this.error` | WIRED | Flags cleared on earlier entries when a new banner failure is recorded (context-bearing path only, see WR-08). |
| `laneStatus` snapshot | `describeLaneFailures` | `failure.banner` | WIRED | The `banner` field travels in the failures array to `LaneFailureList`. |
| `validateLanes` | `runs.ts`, `routers/protocol.ts`, `enqueueRun`, editor `buildLaneSummary` | direct | WIRED | Server sites gated on `laneMode`. The client-side summary calls it ungated, and the editor now hides those warnings when the server is confirmed off. |
| `ProtocolDetailView` | `laneSummaryView(laneUiState(useLaneStatus()))` | direct | WIRED | |
| `RunsComponent` | `ErrorBanner()` | function call | WIRED | No hooks inside. |
| Earlier links (`_pickNext` to `claimEligible`, `_ensureLaneWorkers`, `gotoCommand*`, `describeQueueStart`, `queuedStartLines`) | | | WIRED | Not in the fix diff; behaviour pinned by passing suites. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| LaneFailureList | `failures[].banner` | `_recordFailure` in the live queue, served by `laneStatus` | Yes (`laneReviewFixes.test.ts` drives a real `CommandQueue` through clear-then-second-failure) | FLOWING |
| Editor lane summary | `laneUiState` | `commandQueue.laneStatus` via `useLaneStatus` | Yes | FLOWING |
| Earlier traces (LanesPanel, SwimLane, preview, start confirmation) | | | Yes | FLOWING (UAT 1 to 8) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase lane suites incl. review-fix tests | `npx vitest run test/lanes.test.ts test/laneHalt.test.ts test/laneControl.test.ts test/laneScheduling.test.ts test/laneUi.test.ts test/sqliteQueueClaim.test.ts test/runStateStopIf.test.ts test/laneScript.test.ts test/laneValidation.test.ts test/lanesFlagOff.test.ts test/laneReviewFixes.test.ts` (in `controller/`) | 11 files, 266 tests passed (run in this verification) | PASS |
| Type check | `npx tsc --noEmit` in `controller/` | No output, clean (run in this verification) | PASS |
| Full suite | Not re-run by this verifier | Caller-cited regression gate: 48 files / 1378 tests passed, tsc clean (2026-11-17, no source change since) | PASS (cited) |
| Flag-off golden untouched | `git log -- controller/test/fixtures/lanesFlagOff.golden.ts` | Only 98b50d6 and 2da2ad7 | PASS |

### Probe Execution

Step 7c: SKIPPED. No probe scripts are declared in the phase plans.

### Requirements Coverage

All 15 phase IDs (LAN-01..09, LUI-01..06) appear in at least one PLAN `requirements:` field and are `[x]` and "Complete" in REQUIREMENTS.md (checkbox lines 101-131, traceability lines 202-216). REQUIREMENTS.md maps no other ID to Phase 8: no orphans.

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| LAN-01 | 08-01, 08-04 | SATISFIED | Truth 1. |
| LAN-02 | 08-02, 08-04 | SATISFIED | Truth 2. |
| LAN-03 | 08-02, 08-04 | SATISFIED | Barrier loop in `isEligible`; headline cycle test, UAT 1 and 5. |
| LAN-04 | 08-03, 08-04 | SATISFIED | Per-lane Start guard and `claimEligible`; `sqliteQueueClaim.test.ts`. |
| LAN-05 | 08-05 | SATISFIED | Truth 3. |
| LAN-06 | 08-02, 08-05 | SATISFIED | `laneOf` forces Tool Box to primary; modal in the dispatch gate. |
| LAN-07 | 08-03, 08-06 | SATISFIED | Truth 4. |
| LAN-08 | 08-06 | SATISFIED | Abort-first envelope tests in `laneControl.test.ts`. |
| LAN-09 | 08-05, 08-09 | SATISFIED | `freezeLanes` plus the confirm dialog; UAT 1. |
| LUI-01 | 08-08, 08-10 | SATISFIED | Truth 5. |
| LUI-02 | 08-07 | SATISFIED | Truth 5; `laneScript.test.ts`; UAT 8. |
| LUI-03 | 08-02, 08-05, 08-07, 08-10 | SATISFIED | Truth 6, now also covering wrong-typed tags (rule 0). The WR-10 null/undefined refusal is a clear-message refusal in lane mode only. |
| LUI-04 | 08-07, 08-08, 08-09, 08-10 | SATISFIED | Truth 6. |
| LUI-05 | 08-08, 08-09 | SATISFIED | Truth 6; UAT 3, 4, 5. |
| LUI-06 | 08-05, 08-08, 08-09 | SATISFIED | First failure keeps the banner and the guid; the list shows per-lane failures. Correct after `clearError()` through the context-bearing path (WR-05); the context-free path is WR-08, advisory. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (changed files) | - | `TBD`/`FIXME`/`XXX` scan over `command_queue.ts`, `laneScheduling.ts`, `laneStatus.ts`, `laneFields.ts`, `ProtocolDetailView.tsx`, `RunsComponent.tsx` | - | Clean |

Review status after the fix commits (08-REVIEW.md at 59b2a2b: 0 critical, 3 warnings, 5 info): WR-01, WR-04, WR-05 and WR-07 are confirmed fixed in the diff and by tests. The review verdict that each fix is correct for its targeted case holds on the code read here.

Judgment on the new findings against the must-haves:

- **WR-08** does not break a truth. It is a defect of the same class as WR-05 on a path that needs `clearError()` plus a context-free failure; `fail()` has no production caller, and the only context-free producer in lane mode is the start-failure catch. LUI-06's rule (first failure keeps the guid) is unaffected. Worth fixing; the reviewer's one-line change is sound.
- **WR-09** is cosmetic and flag-off only.
- **WR-10** does not break a truth. The null refusal applies only when lanes are on (default off). No writer in this repo emits a null or undefined tag. Explicit nulls could arise only from hand-edited or externally imported protocol JSON, and the refusal names the step. It is a behaviour change from silently running such a step as primary, so the maintainer should pick the policy (treat null as absent, or keep refusing and document it) before Phase 9 uses imported protocols.
- Open IN-01 to IN-08 and IN-02 to IN-04 remain advisory. None is a debt marker.

### Human Verification Required

None required. 08-UAT.md (8 of 8 passed, run before these fixes) still covers the must-haves, because the fixes did not change what UAT exercised: the flag-on failure list in the common case (entry 0 is the banner, same markup, same props), the flag-on lane summary and script preview (UAT 7, 8), the editor drawer, the freeze flow and the Gantt chart.

Not covered by UAT, and judged non-blocking because each has behavioural automated evidence and no must-have depends on it:

- WR-05 clear-then-second-failure ordering: tested on a real `CommandQueue` in `laneReviewFixes.test.ts`, never seen in a browser.
- WR-07 flag-off editor note and warning suppression: pure helpers tested by behaviour, the rendering not seen in a browser.
- WR-04 no-remount: only a source-text assertion exists (node test environment, no DOM renderer). The change is behaviour-neutral for output, since the function has no hooks.

A two-minute browser re-check of those three items is cheap and fits the supervised Phase 9 session, but it is a recommendation, not a gate.

### Gaps Summary

No gaps. All roadmap success criteria and all 15 requirement IDs are backed by code that exists, is wired and is exercised by passing tests. The four review fixes were confirmed in the diff, leave the flag-off path and golden transcript untouched, and do not weaken any dispatch, halt or control behaviour. The three new review warnings are advisory.

---

_Verified: 2026-11-17T08:50:00Z_
_Verifier: Claude (gsd-verifier)_
