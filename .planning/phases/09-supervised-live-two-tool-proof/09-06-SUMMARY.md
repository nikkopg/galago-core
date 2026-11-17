---
phase: 09-supervised-live-two-tool-proof
plan: 06
subsystem: infra
tags: [lanes, freeze-drill, uat-sim, galago-web-dev, live-evidence, d-11, d-14, scenario-1]

requires:
  - phase: 09-supervised-live-two-tool-proof
    provides: 09-05 sim rig (SIM-STACK, SIM-FAST in uat-sim) on the lanes-on galago-web-dev; 09-03 phase9-ctl.sh
provides:
  - Drill protocol imported into uat-sim only (protocol id 8, workcell id 3) and the pre-GO baseline and queue snapshot
  - The operator's typed go recorded verbatim with its UTC time (D-14)
  - Drill scenario 1 judged PASS from three operator snapshots plus the sim server logs, with the post-drill-s1 baseline
  - Freeze drill sections of 09-LIVE-EVIDENCE.md (import and pre-GO, Drill GO, Scenario 1) and evidence index rows
affects: [09-07, 09-09, 09-10, 09-11, 09-12]

actuals:
  tokens: 20000
  tasks: 3
  commits: 3
plan_head_before: 2de6b0bb1387609e0f9b823ff324c80ee0333b40
plan_head_after: d76d949a07e68ba9c2bdef1eec312f0d6d2d40d1

tech-stack:
  added: []
  patterns:
    - "Judge a lane drill from operator-taken snapshots (row status plus raw ms timestamps plus laneStatus) and corroborate one-send-per-queueId from the sim servers' own logs"
    - "Snapshot at the halt and again before the operator Start, because a retry overwrites startedAt"

key-files:
  created:
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T085940Z-drill-import.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T085943Z-pre-drill-go.baseline.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T093751Z-drill-s1-at-halt.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T093850Z-drill-s1-halted.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T094242Z-drill-s1-done.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T094420Z-post-drill-s1.baseline.txt
  modified:
    - .planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md

key-decisions:
  - "Scenario 1 verdict PASS: all D-11 scenario 1 criteria are met on the deployed lanes-on build, with no real tool contacted"
  - "LIV-02 is NOT marked complete: scenarios 2 and 3 are in 09-07"

patterns-established:
  - "Retry rows keep the stale failedAt and error: read row status, not failedAt, as the outcome"

requirements-completed: []  # LIV-02 is declared by this plan but is NOT complete: scenarios 2 and 3 (09-07) remain

coverage:
  - id: D1
    description: "The drill protocol is imported into uat-sim only (id 8, workcell 3) and the queue is clean (halted false, no CREATED or STARTED row) before the GO"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "evidence/20261117T085940Z-drill-import.json and 20261117T085944Z-pre-drill-go.queue.json; GET /api/settings/workcell = uat-sim"
        status: pass
    human_judgment: false
  - id: D2
    description: "The drill ran only after the operator's literal typed go, recorded with its UTC time"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "09-LIVE-EVIDENCE.md Drill GO (D-14): verbatim go at 2026-11-17T09:24:03Z, orchestrator-recorded"
        status: pass
    human_judgment: false
  - id: D3
    description: "Scenario 1: d-x1 FAILED with the lanes halted (haltReason failure) while the SIM-FAST step was STARTED; SIM-FAST then ended COMPLETED, never ABORTED; d-out1 stayed CREATED until the operator Start"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "evidence/20261117T093751Z-drill-s1-at-halt.queue.json and 20261117T093850Z-drill-s1-halted.queue.json (row status, raw ms timestamps, laneStatus)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Scenario 1 re-arm: only the operator Start retried d-x1 once, then d-out1 ran; every row COMPLETED and halted false; one send per queueId except the retried d-x1; no send during the halt"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "evidence/20261117T094242Z-drill-s1-done.queue.json; sim logs ~/.local/state/galago-phase9/sim-stack-20261117T083904Z.log, sim-fast-20261117T083905Z.log, sim-stack-20261117T093900Z.log (5 Transfer sends for 4 transfer queueIds)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No real tool was touched: real listener PIDs, STACK2-6.log and FA100056.log Transfer counts and the ledger sha256 equal the pre-drill-go baseline"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "diff of evidence/20261117T085943Z-pre-drill-go.baseline.txt vs 20261117T094420Z-post-drill-s1.baseline.txt (only label, time, HEAD and the SIM-STACK pid 23042 to 101131 differ)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The operator's UI observations (run card, Lanes panel banner) matched the snapshots"
    requirement: "LIV-02"
    verification: []
    human_judgment: true
    rationale: "Claude did not observe the UI; the operator reported no deviations. The snapshots and sim logs are consistent with that account"

duration: about 90min (including the GO and scenario waits)
completed: 2026-11-17
status: complete
---

# Phase 9 Plan 06: Drill GO and Scenario 1 Summary

**The LIV-02 drill's scenario 1 passes on the lanes-on build: a SIM-STACK failure while SIM-FAST ran halted the lanes, SIM-FAST finished uninterrupted, the later row was held until the operator's Start, and that Start alone retried the failed row and finished the run, with the real tools untouched.**

## Performance

- **Duration:** about 90 min wall clock (import 08:59Z, GO 09:24:03Z, scenario 1 run 09:36Z to 09:42:57Z, closing 09:44Z)
- **Tasks:** 3 of 3 (Task 1 auto, Task 2 typed go, Task 3 operator-run scenario)
- **Files modified:** 7 (1 planning doc, 6 evidence files)

## Accomplishments

- Imported the drill protocol into uat-sim only (protocol id 8, workcell 3) and took the pre-GO baseline and queue snapshot (halted false, no CREATED or STARTED row).
- Recorded the operator's typed `go` (2026-11-17T09:24:03Z) under Drill GO (D-14).
- Judged scenario 1 PASS. At halt: q51 `d-x1` FAILED (09:37:35.044), q50 SIM-FAST STARTED, q52 `d-out1` CREATED, `halted:true`, `haltReason:"failure"`. After SIM-FAST: COMPLETED at 09:38:45.547 (80.1 s), never ABORTED, `d-out1` still CREATED, still halted. Done: all five rows COMPLETED, `halted:false`, `failures:[]`.
- Sim server logs show five Transfer sends for four transfer queueIds, the extra one being the operator-retried `d-x1` (09:37:26Z, then 09:40:02Z), and none between the failure and the Start (77 s of that was after SIM-FAST completed).
- The post-drill-s1 baseline equals the pre-drill-go baseline except label, time, HEAD and the SIM-STACK pid: real listeners 8081 `6872`, 11010 `7490`, 40012 `7491`, 40001 `2320808`; `STACK2-6.log` 12 Transfer; `FA100056.log` 1 Transfer; ledger sha256 `5de43c84...670b`.

## Task Commits

1. **Task 1: Import the drill protocol and take the pre-GO snapshot** - `252a03a` (docs)
2. **Task 2: Drill GO (typed go)** - `8747b7f` (docs)
3. **Task 3: Drill scenario 1** (operator-run; Claude judged the snapshots) - `d76d949` (docs)

**Plan metadata:** the docs commit that follows this file (SUMMARY, STATE, ROADMAP). Measured task commits: 3 (`2de6b0b..d76d949`).

## Files Created/Modified

- `.planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md` - import and pre-GO record, Drill GO, Scenario 1 (verdict, row table, snapshot facts, send counts, baseline comparison, observations), evidence index rows
- `.planning/phases/09-supervised-live-two-tool-proof/evidence/*drill-import*`, `*pre-drill-go*` - import reply, pre-GO baseline and snapshot
- `.planning/phases/09-supervised-live-two-tool-proof/evidence/*drill-s1-*`, `*post-drill-s1*` - three scenario snapshots and the post-scenario baseline

## Decisions Made

- Scenario 1 is PASS and recorded as such; nothing in the snapshots contradicts a criterion, so no checkpoint was returned.
- LIV-02 stays open: scenarios 2 and 3 are in 09-07.

## Deviations from Plan

None - plan executed exactly as written. The operator reported no deviations. Their `CTL()` shell function only wraps the guarded `phase9-ctl.sh` with `</dev/null`.

Observations recorded in the evidence file (none a failed criterion):

- A retry overwrites `startedAt` but keeps the earlier `failedAt` and error, so a COMPLETED row can still carry a `failedAt`. Row status is authoritative; the first attempt's `startedAt` survives only in the at-halt and halted snapshots (RESEARCH Pitfall 3).
- The stored run blob (`getAllRuns`, `/api/runs`) reads `CREATED` even after every row is COMPLETED, as the two stale earlier runs do. Row statuses and `laneStatus` were used instead; the UI run card was not observed by Claude.

## Auth Gates

None. Task 2 was a typed-go decision gate and Task 3 an operator-run action, both normal checkpoint flow.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access was introduced; the plan wrote one protocol row to uat-sim and read snapshots and logs.

## Next Phase Readiness

- Sim processes now: SIM-STACK pid `101131` (port 40091, restarted 09:39Z), SIM-FAST pid `23184` (port 40092). `laneStatus` is clean (`halted:false`, no failures, nothing running), so no latch is left for scenario 2.
- Selected workcell is still `uat-sim`; 09-07 must select `test` (workcell id 1) before event 1.
- Two stale `CREATED` runs from earlier work remain in the store; nobody presses Start on them.

## Self-Check: PASSED

- FOUND: evidence files `20261117T085940Z-drill-import.json`, `20261117T085943Z-pre-drill-go.baseline.txt`, `20261117T093751Z-drill-s1-at-halt.queue.json`, `20261117T093850Z-drill-s1-halted.queue.json`, `20261117T094242Z-drill-s1-done.queue.json`, `20261117T094420Z-post-drill-s1.baseline.txt`
- FOUND commits: `252a03a`, `8747b7f`, `d76d949` (ancestors of HEAD)
