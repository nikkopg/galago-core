---
phase: 09-supervised-live-two-tool-proof
plan: 11
subsystem: live-hardware-evidence
tags: [liv-01, event-2, one-way-go, third-plate, live-evidence, d-18]

requires:
  - phase: 09-supervised-live-two-tool-proof
    provides: 09-10 event-1 PASS verdict and the event-2 third-plate readiness record; event-2 protocol (id 10 in workcell test) from the amended D-02/D-03 script
provides:
  - Two operator readiness attempts recorded (attempt 1 round trip not done, plan stopped; attempt 2 round trip verified from log and ledger), pre-e2 baseline, protocol import (id 10)
  - The one-way event-2 GO (operator replies verbatim, accepted 2026-11-17T11:07:01Z) and the operator's run reply ("event 2 done, extra plate on nest-1, plate 1 on nest-3")
  - Raw event-2 capture (queue snapshot, e2-after baseline, appended STACK2-6 and FA100056 log lines, 5-record ledger copy) with key base LIV01-E2-2026-11-17T11:08:44.895Z-abf060a9, all expected count deltas matched
affects: [09-12]

actuals:
  tokens: 9000
  tasks: 3
  commits: 4
plan_head_before: 0abe851
plan_head_after: 9b929fe1491a3221ab2b28ab867d46b4cc8088a7

tech-stack:
  added: []
  patterns:
    - "Capture first, record after: the post-run capture was committed before the evidence section was written, so the operator could restore the rig"
    - "Count the deltas against the pre-run baseline by diff; add the GO-gate read lines to the expected 'Running command' total"

key-files:
  created:
    - .planning/phases/09-supervised-live-two-tool-proof/09-11-SUMMARY.md
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T111407Z-e2-after.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T111407Z-e2-after.baseline.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T111416Z-e2.ledger.json
  modified:
    - .planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md

key-decisions:
  - "No verdict in this plan: D-05, the event-2 verdict and LIV-01 are judged in 09-12 from the raw rows"
  - "The operator's reply did not mention plate 2 (expected on nest-2); recorded as not reported, not as a defect"
  - "The two tool-log copies are gitignored (*log) and stay on disk only, as for event 1"

requirements-completed: []

coverage:
  - id: D1
    description: "Operator readiness for event 2 including a verified nest-3 / nest-1 round trip, pre-e2 baseline and protocol import (Task 1, commits 356d7c6, 03a23e9)"
    requirement: "LIV-01"
    verification:
      - kind: other
        ref: "pre-e2 baseline compared with the reference; round-trip Transfers read from STACK2-6.log and ledger, both done/ran"
        status: pass
    human_judgment: true
    rationale: "Plate positions rest on the operator's confirmation; the Transfer replies were not pasted, so the round trip was read from the log and ledger"
  - id: D2
    description: "One-way typed GO recorded with the operator's latch and robot-state reads (Task 2, commit 9b929fe)"
    requirement: "LIV-01"
    verification:
      - kind: other
        ref: "GO replies and 11:07:01Z acceptance in 09-LIVE-EVIDENCE.md 'Event-2 GO'; fresh GetFailureLatch (11:02:59Z) and GetRobotStates (11:06:47Z) lines in the appended STACK2-6.log"
        status: pass
    human_judgment: true
    rationale: "Reach of the x1 path and the end state were confirmed by eye by the operator"
  - id: D3
    description: "Event-2 run captured: 7 rows COMPLETED, 5 ledger records done/ran, counts equal the expected deltas (Task 3, commits f35b22e, 9b929fe)"
    requirement: "LIV-01"
    verification:
      - kind: other
        ref: "diff of 20261117T110058Z-pre-e2.baseline.txt vs 20261117T111407Z-e2-after.baseline.txt: Transfer 20 to 25 and 2 to 3, ledger 17 to 22, PIDs and trace folder equal; no TRUNCATED-OR-RESTARTED; git status --porcelain -- controller empty"
        status: pass
    human_judgment: false

duration: about 75min across three agent sessions (readiness, GO, run and capture)
completed: 2026-11-17
status: complete
---

# Phase 09 Plan 11: Live event 2 Summary

**Live event 2 ran to completion on the real rig: five STACK transfers (-in1, -in2, -x1, -out1, -out2) and one F.A.S.T. transfer, all 7 run rows COMPLETED, laneStatus clean, and every log and ledger count equals the expected delta; the stored run record stayed CREATED (the known lanes-mode finding). The D-05 and LIV-01 judgments are left to 09-12.**

## Performance

- **Duration:** operator readiness 10:51Z-11:01Z (two attempts), GO accepted 11:07:01Z, run 11:08:44Z-11:12:11Z, operator reply 11:13:42Z, capture 11:14:07Z-11:14:16Z
- **Tasks:** 3 (Task 1 readiness checkpoint, Task 2 GO checkpoint, Task 3 run and capture)
- **Files:** 1 modified (09-LIVE-EVIDENCE.md), 3 evidence files created and committed; 2 gitignored tool-log copies on disk

## Accomplishments

- **Readiness (Task 1).** Attempt 1 (commit `356d7c6`): the round trip was not done and the plan stopped. Attempt 2 (commit `03a23e9`): the operator replied "ready, nothing re-taught"; the nest-3 to nest-1 and nest-1 to nest-3 Transfers were read from `STACK2-6.log` and the ledger, both done/ran, 30 s and 28 s, nothing after them. Both pre-flight forms ended PREFLIGHT OK; pre-e2 baseline taken after the round trip; event-2 protocol imported (id 10, workcell test).
- **GO (Task 2).** The operator re-read `latched:false` and `stack2-6` `idle` and typed "yes 2-7, go" and "go"; the orchestrator held the go until a fresh `GetRobotStates` showed in the log (11:06:47Z) and accepted it at 11:07:01Z.
- **Run and capture (Task 3, commit `f35b22e` capture, `9b929fe` record).** Run id `1596f9bcf081e7000`, key base `LIV01-E2-2026-11-17T11:08:44.895Z-abf060a9`. Rows 70-76 all COMPLETED. The F.A.S.T. transfer (row 73) ran 11:09:57.309Z to 11:11:08.787Z; -x1 (row 74) ran 11:09:58.493Z to 11:10:29.196Z, wholly inside it; out1 started 0.9 s after it completed. `STACK2-6.log` Transfer 20 to 25, `FA100056.log` Transfer 2 to 3, ledger 17 to 22 with exactly the five expected records (each done/ran) and no `-x2`. Listener PIDs 8081=6872, 11010=7490, 40012=7491, 40001=2320808, trace folder 1794670020, controller dirty lines 0 and galago-tools HEAD `034867c` unchanged. No error, warning, refusal or retry line in the appended logs; `logs-since` did not print TRUNCATED-OR-RESTARTED.
- **Operator end state.** "event 2 done, extra plate on nest-1, plate 1 on nest-3". Plate 2 on nest-2 was not mentioned.

## Deviations from Plan

None in the work itself: no code or config changed, nothing was sent to any tool by Claude, and no failure or recovery occurred. Process notes:

- The plan-commit ledger file (`gsd-plan-head-before-09-11`) was first created at the capture commit, after the earlier 09-11 commits had landed, so `plan_head_before` above is the 09-10 final commit `0abe851` and `commits: 4` is measured from it (`356d7c6`, `03a23e9`, `f35b22e`, `9b929fe`); this summary's own commit and the state commit come after.
- The Transfer replies of the round trip were not pasted by the operator in attempt 2 (recorded in Task 1; evidence came from the log and ledger).

## Findings carried to 09-12

- The stored run status stays `CREATED` in lanes mode (known finding, see the event-1 and freeze-drill records); completion is read from the rows and `laneStatus`.
- The operator's end-state reply omitted plate 2; 09-12 should decide whether that needs a follow-up question before the LIV-01 verdict.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, file access pattern or schema change.

## Self-Check: PASSED

- FOUND: evidence/20261117T111407Z-e2-after.queue.json, evidence/20261117T111407Z-e2-after.baseline.txt, evidence/20261117T111409Z-e2.STACK2-6.log, evidence/20261117T111409Z-e2.FA100056.log, evidence/20261117T111416Z-e2.ledger.json (the two logs are gitignored, on disk only)
- FOUND commits: 356d7c6, 03a23e9, f35b22e, 9b929fe
- `git status --porcelain -- controller` is empty
