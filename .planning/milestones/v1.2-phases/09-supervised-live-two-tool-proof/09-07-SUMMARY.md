---
phase: 09-supervised-live-two-tool-proof
plan: 07
subsystem: infra
tags: [lanes, freeze-drill, uat-sim, galago-web-dev, live-evidence, d-11, d-10, liv-02, scenario-2, scenario-3]

requires:
  - phase: 09-supervised-live-two-tool-proof
    provides: 09-06 drill GO and scenario 1 (PASS); 09-05 sim rig; 09-03 phase9-ctl.sh
provides:
  - Drill scenarios 2 (fast-step failure while stack runs) and 3 (operator Freeze lanes mid-overlap) judged PASS from six operator snapshots plus the sim server logs
  - Drill teardown: sim servers stopped by the guarded stop-sim, untouched-real-tools proof (V-10), clean-exit proof (V-11), both pre-flight forms PREFLIGHT OK
  - LIV-02 verdict PASS in 09-LIVE-EVIDENCE.md (one row per D-11 clause per scenario), data for runbook row 3a-12
  - Finding recorded: the stored run record stays CREATED in lanes mode after every row COMPLETED
affects: [09-08, 09-09, 09-10, 09-11, 09-12]

actuals:
  tokens: 30000
  tasks: 3
  commits: 3
plan_head_before: d190b91d4a2d1daf1356ea14197f05ac10b56a1d
plan_head_after: 2b747451681c27e5bcfb1a93a25e7e2823b9334c

tech-stack:
  added: []
  patterns:
    - "Judge a lane drill from operator-taken snapshots (row status, raw ms timestamps, laneStatus) and corroborate one-send-per-queueId from the sim servers' own logs"
    - "Prove real tools untouched by comparing PIDs, Running-command counts, trace folder and file names, and ledger sha256, and explain any other drift (log line count) from the lines themselves"

key-files:
  created:
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T095103Z-drill-s2-at-halt.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T095130Z-drill-s2-halted.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T095421Z-drill-s2-done.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T095615Z-drill-s3-at-freeze.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T095709Z-drill-s3-frozen.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T095753Z-drill-s3-done.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T095938Z-post-drill-s2-and-s3-before-teardown.baseline.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T100156Z-post-drill.baseline.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T100156Z-post-drill.tracefiles.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T100157Z-post-drill.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T100221Z-post-drill-final.baseline.txt
  modified:
    - .planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md

key-decisions:
  - "LIV-02 verdict PASS: every D-11 clause holds in all three scenarios, V-10 and V-11 hold"
  - "FA100056.log line growth (171341 to 172478+) is read-only GET /status polling after the operator switched back to the test workcell, not a command; judged not a V-10 failure because the V-10 criteria (PIDs, Running command counts, trace folder and files, ledger sha256) are equal"
  - "Scenario 2 PASS despite a second failed retry (ECONNREFUSED before Configure, no send reached the sim server): still only operator Starts re-armed and the lanes never auto-resumed"

patterns-established:
  - "A baseline taken after both scenarios is labelled for what it is (post-drill-s2-and-s3-before-teardown), not post-drill-s2"

requirements-completed: [LIV-02]

coverage:
  - id: D1
    description: "Scenario 2: SIM-FAST FAILED with the lanes halted (haltReason failure) while d-x1 was STARTED; d-x1 ended COMPLETED, never ABORTED; d-out1 stayed CREATED until the operator Start; done snapshot all COMPLETED, halted false"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "evidence/20261117T095103Z-drill-s2-at-halt, 095130Z-drill-s2-halted, 095421Z-drill-s2-done .queue.json; sim logs (3 stack sends for 3 queueIds; 2 SIM-FAST sends for the operator-retried queueId 55)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Scenario 3: operator Freeze lanes with SIM-FAST and d-x1 both STARTED gave halted true, haltReason freeze; both rows COMPLETED, none ABORTED; d-out1 CREATED until the operator Start; done snapshot all COMPLETED, halted false"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "evidence/20261117T095615Z-drill-s3-at-freeze, 095709Z-drill-s3-frozen, 095753Z-drill-s3-done .queue.json; sim logs (4 sends for 4 transfer queueIds, none between the rows already running and the Start)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No real tool received a command: real listener PIDs 8081=6872, 11010=7490, 40012=7491, 40001=2320808, STACK2-6.log and FA100056.log Running command counts, trace folder and file names, and ledger sha256 equal the pre-drill baseline"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "evidence/20261117T100156Z-post-drill.baseline.txt and .tracefiles.txt vs 20261117T083601Z-pre-drill.* (diff: label, time, HEAD, FA100056.log line count only; tracefiles diff empty)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The drill leaves nothing behind: sim ports 40091/40092 closed, test workcell selected, STACK2-6 and FA100056 listed, halted false, no CREATED or STARTED row, no RUNNING run, both pre-flight forms PREFLIGHT OK"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "DRILL_CLEAN check; GET /api/settings/workcell = test; getAll 21 rows all COMPLETED; /api/runs no RUNNING; gal-07-live-check.sh both forms last line PREFLIGHT OK (GAL07_WEB_CONTAINER=galago-web-dev)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The LIV-02 verdict (PASS) is written in 09-LIVE-EVIDENCE.md with one row per D-11 clause per scenario"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "09-LIVE-EVIDENCE.md section 'LIV-02 verdict'"
        status: pass
    human_judgment: true
    rationale: "The verdict applies the D-11 clauses to snapshots and logs; the operator's UI view of the run card was not observed by Claude"

duration: ~6 min (Claude's part, after the operator's report at about 09:58Z)
completed: 2026-11-17
status: complete
---

# Phase 9 Plan 07: Drill scenarios 2 and 3, teardown and the LIV-02 verdict Summary

**LIV-02 PASS: on the deployed lanes-on build a failure on either lane and the operator's Freeze both halted new dispatch on both lanes, aborted nothing, resumed only on the operator's Start, and left the real STACK2-6 and FA100056 untouched (PIDs, command counts, trace files and ledger sha256 unchanged).**

## Performance

- **Duration:** about 6 minutes for Claude's part; the operator steps (Tasks 1 and 2) ran before this executor started, between 09:50Z and 09:58Z
- **Tasks:** 3 (two operator checkpoints recorded and judged, one automated teardown and verdict)
- **Files:** 11 evidence files created, 09-LIVE-EVIDENCE.md modified

## Accomplishments

- **Scenario 2 judged PASS** (queueIds 53 to 57): SIM-FAST FAILED 2.9 s in with halted true / haltReason failure while `d-x1` (q56) was STARTED; `d-x1` finished COMPLETED 09:51:22.034, never ABORTED; `d-out1` (q57) stayed CREATED through the halt; after the operator's Starts all rows COMPLETED and halted false. Sim logs: three stack sends for three stack queueIds, two SIM-FAST sends for the operator-retried q55, none between the failure and the re-arm.
- **Scenario 3 judged PASS** (queueIds 58 to 62): the operator's Freeze lanes with SIM-FAST (q60) and `d-x1` (q61) both STARTED gave halted true / haltReason freeze with `failures:[]`; both rows ended COMPLETED, none ABORTED; `d-out1` (q62) stayed CREATED for 17 s after the fast step ended until the operator's single Start; done snapshot all COMPLETED, halted false. Four sends for four transfer queueIds, none while frozen.
- **Workcell switched back and checked:** `GET /api/settings/workcell` is `test`, `GET /api/tools` lists STACK2-6 and FA100056.
- **Teardown:** SIM-STACK (pid 101131) and SIM-FAST (pid 121058) stopped through the guarded, port-resolved `stop-sim`; 40091 and 40092 no longer listen; the real listener PIDs are the same as before the drill.
- **V-10 and V-11:** the post-drill baseline equals the pre-drill baseline except label, time, HEAD and the FA100056 line count (explained below); trace files `diff` empty; queue clean; both pre-flight forms ended `PREFLIGHT OK`.
- **LIV-02 verdict PASS** written in 09-LIVE-EVIDENCE.md as a clause-by-scenario table, plus the runbook-row-3a-12 data.

## Task Commits

1. **Task 1: Scenario 2** - `342c189` (docs)
2. **Task 2: Scenario 3 and the switch back** - `d98e59d` (docs)
3. **Task 3: Teardown, untouched-tools proof and the LIV-02 verdict** - `2b74745` (docs)

**Plan metadata:** committed after this summary (docs: complete plan).

## Decisions Made

See key-decisions. The substantive judgment calls: (1) the FA100056.log line-count growth is status polling, so V-10 holds; (2) scenario 2 stays PASS despite a second failed retry because it neither sent anything to a tool nor auto-resumed anything.

## Deviations from Plan

None in the plan's execution. Items worth knowing, none auto-fixed or a failed criterion:

- **Baseline label.** The plan's Task 1 says `CTL baseline post-drill-s2`. Because the operator ran scenarios 2 and 3 in one go before Claude started, the baseline was taken after both and is labelled `post-drill-s2-and-s3-before-teardown`, as instructed by the orchestrator. No per-scenario scenario 2 baseline exists.
- **Operator-reported "no deviations" vs the snapshots.** The scenario 2 done snapshot shows q55 with a `failedAt` (09:51:52.534, `14 UNAVAILABLE ... ECONNREFUSED`) later than the first failure, so a retry ran and failed again before the SIM-FAST server was Configured. No snapshot exists between the two retries, so the second halt is inferred. Recorded in the evidence as an observation to confirm with the operator; it does not break a D-11 clause.

**Total deviations:** 0 auto-fixed. **Impact:** none on the verdict.

## Issues Encountered

- **FA100056.log line count differs** (171341 before, 173292 at teardown and still growing) while the plan's V-10 expectation reads "all must be equal". The new lines are only `GET http://10.150.1.125:5003/status` polls (179 requests, one every 5 s, from 09:58:10Z, the moment of the switch back to `test`) and their httpcore debug lines; a search finds no POST, no "Running command", no Configure, no ExecuteCommand. The criteria that the plan names (PIDs, Running command counts, trace folder and files, ledger sha256) are equal, so V-10 is judged met. Flagged here because it is a literal difference in the baseline file; the next plan's baseline diff will show the same line-count drift while the UI polls the real tool.
- **Finding (not a D-11 clause): the stored run record stays CREATED in lanes mode.** All three drill runs read `CREATED` in every snapshot, including after every row COMPLETED, and still at 10:02Z. Row status and `laneStatus` are reliable; run status is not advanced. A follow-up item for a later phase; not fixed (D-10).

## Known Stubs

None. This plan wrote evidence only.

## Threat Flags

None. No file, endpoint or trust boundary was added.

## User Setup Required

None. The `uat-sim` workcell (id 3), the SIM tool records (ids 9, 10) and drill protocol 8 remain in the store, inert; the five older `CREATED` runs must not be started.

## Next Phase Readiness

09-08 (runbook rows 3a-11 and 3a-12) can now write the freeze-drill row from the LIV-02 verdict. Before event 1 (09-09): re-run the baseline, expect only the FA100056 line count to drift, and queue a fresh run; the real workcell `test` is selected and pre-flight is `PREFLIGHT OK`.

## Self-Check: PASSED

- Created files: all 11 evidence files and 09-LIVE-EVIDENCE.md exist.
- Commits `342c189`, `d98e59d`, `2b74745` are ancestors of HEAD.
- Plan automated checks: `DRILL_CLEAN`, `S2_FILES_OK`, `S3_FILES_OK` printed; both pre-flight forms ended `PREFLIGHT OK`.
