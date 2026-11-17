---
phase: 09-supervised-live-two-tool-proof
plan: 09
subsystem: live-hardware-evidence
tags: [liv-01, event-1, lanes, stack, fast, typed-go, d-14, d-18, live-evidence]

requires:
  - phase: 09-supervised-live-two-tool-proof
    provides: 09-07 LIV-02 PASS verdict and clean post-drill baseline; 09-08 runbook rows 3a-11 / 3a-12; 09-03 amended D-02 pair
provides:
  - Operator readiness record for event 1 (nest-3 / nest-1 round trip done/ran) and the pre-e1 baseline taken after it
  - Event-1 protocol imported into workcell test (id 1) as protocol id 9
  - Event-1 GO record (typed go at 2026-11-17T10:37:49Z) and the operator's run reply
  - Raw post-run capture (queue snapshot, baseline, tool-log lines since, ledger records) for key base LIV01-E1-2026-11-17T10:40:52.652Z-5f3509d4, every count equal to the expected deltas
affects: [09-10, 09-11, 09-12]

actuals:
  tokens: 30000
  tasks: 3
  commits: 2
plan_head_before: 9201bd30825cb73b2b950c9a452c2ce68f14a192
plan_head_after: ab801147df359c13465da3d58e71a8956c20257f

tech-stack:
  added: []
  patterns:
    - "Capture immediately after the operator's reply: snapshot, baseline, logs-since against the pre-run baseline, ledger by key base, then diff the two baselines against the expected deltas"
    - "Read completion from row statuses and laneStatus, never from the stored run status (stays CREATED in lanes mode)"

key-files:
  created:
    - .planning/phases/09-supervised-live-two-tool-proof/09-09-SUMMARY.md
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T104534Z-e1-after.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T104535Z-e1-after.baseline.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T104544Z-e1.ledger.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T104535Z-e1.STACK2-6.log (gitignored by the *log rule, on disk only)
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T104535Z-e1.FA100056.log (gitignored by the *log rule, on disk only)
  modified:
    - .planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md

key-decisions:
  - "The operator's 'go' was taken as yes to checklist items 3-5 on the orchestrator's stated understanding, and recorded that way (items 1 and 2 answered explicitly), not as three separate answers"
  - "The operator's 'stack didnt move additional plate from nest-3 to nest-1' is recorded as the expected behaviour (event 1's overlap is get_transfer_estimate only) and as the observation that the third plate stayed on nest-3, not as a defect"
  - "Judging the D-05 verdict and the event-1 verdict is left to 09-10; this plan records and compares only"

requirements-completed: []

coverage:
  - id: D1
    description: "Operator readiness, pre-flight, pre-e1 baseline and event-1 protocol import recorded before the GO (Task 1, commit 18e183a)"
    requirement: "LIV-01"
    verification:
      - kind: other
        ref: "evidence/20261117T103254Z-pre-e1.baseline.txt, 20261117T103338Z-e1-readiness.txt, 20261117T103400Z-e1-import.json; E1_PRE_OK printed in the first segment"
        status: pass
    human_judgment: false
  - id: D2
    description: "Typed go, latched:false and stack2-6 idle readings and checklist answers recorded verbatim with UTC time"
    requirement: "LIV-01"
    verification: []
    human_judgment: true
    rationale: "The go is the operator's typed decision; the record is a transcription by the orchestrator, and items 3-5 were answered by the go alone"
  - id: D3
    description: "Post-run capture complete and equal to the expected deltas: STACK Transfers 14 to 18 plus one GetTransferEstimate, FA100056 1 to 2, ledger 11 to 15, all four records done/ran, rows 63-69 COMPLETED, laneStatus clean, no TRUNCATED-OR-RESTARTED, controller tree clean"
    requirement: "LIV-01"
    verification:
      - kind: other
        ref: "diff of evidence/20261117T103254Z-pre-e1.baseline.txt vs 20261117T104535Z-e1-after.baseline.txt; E1_CAPTURED check; git status --porcelain -- controller empty"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-17
status: complete
---

# Phase 09 Plan 09: Live event 1 (GO, run, capture) Summary

**Live event 1 ran on the real STACK2-6 and FA100056 under the typed go (10:37:49Z) with operator-only control: all seven rows of run `1596ecfad681e7000` COMPLETED with the nest-3 to nest-1 `get_transfer_estimate` running inside the F.A.S.T. transfer window, four explicit-key STACK ledger records done/ran, and every post-run count equal to the expected deltas.**

## Performance

- **Duration:** about 25 min across the readiness session and this continuation (readiness 10:2xZ, GO 10:37:49Z, run 10:41-10:44Z, capture 10:45:34-10:45:44Z)
- **Tasks:** 3 (Task 1 readiness and import, Task 2 GO, Task 3 run and capture)
- **Files:** 1 modified (09-LIVE-EVIDENCE.md), 3 evidence files committed, 2 tool-log copies on disk only (gitignored)

## Accomplishments

- **Readiness (Task 1, commit `18e183a`).** Operator round trip nest-3 -> nest-1 -> nest-3 done/ran (ledger `...102945344089-51bbd341` and `...103031099718-33d54943`), both pre-flight forms `PREFLIGHT OK`, pre-e1 baseline and event-1 protocol import (protocol id 9 in workcell test, id 1).
- **GO (Task 2).** `GetFailureLatch` read `latched:false`, `GetRobotStates` `stack2-6` `idle`, re-teach answer "no", and the literal "go" recorded at 2026-11-17T10:37:49Z. The go covered checklist items 3-5 on the stated understanding.
- **Run (Task 3).** Operator-queued run `1596ecfad681e7000`, key base `LIV01-E1-2026-11-17T10:40:52.652Z-5f3509d4`. Rows 63 (note) to 69: in1 10:41:14.9-10:41:45.1, in2 10:41:46.6-10:42:15.1, F.A.S.T. transfer (lane fast, barrier) 10:42:16.4-10:43:28.1, `get_transfer_estimate` 10:42:16.6-10:42:16.8 (inside the F.A.S.T. window), out1 10:43:28.8-10:43:58.2, out2 10:43:59.7-10:44:28.9. All COMPLETED; `laneStatus` `laneMode:true`, `halted:false`, `failures:[]`, `runningLanes:[]`.
- **Capture (Task 3).** `snapshot e1-after`, `baseline e1-after`, `logs-since` (no TRUNCATED-OR-RESTARTED), `ledger e1` (4 records). Diffed against the pre-e1 baseline: `STACK2-6.log` Transfer 14 -> 18, "Running command" 60 -> 68 (4 Transfer, 1 GetTransferEstimate, 3 GO-gate reads), one GetTransferEstimate line; `FA100056.log` Transfer 1 -> 2; ledger 11 -> 15 (sha256 `ec2dd278...46d1d`), the four new records `-in1`, `-in2`, `-out1`, `-out2` all done/ran; listener PIDs 8081=6872, 11010=7490, 40012=7491, 40001=2320808 and trace folder 1794670020 unchanged; controller dirty lines 0.
- **Operator observation.** "event 1 done, stack didnt move additional plate from nest-3 to nest-1 during fast transfer": expected, because event 1's overlap step is an estimate only; the third plate stayed on nest-3.

## Task Commits

1. **Task 1: operator readiness, pre-flight, pre-e1 baseline, protocol import** - `18e183a` (docs)
2. **Tasks 2 and 3: GO record, run reply and post-run capture** - `ab80114` (docs; one commit because both records live in one evidence section and were written together after the run)

The SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md update follow in the metadata commit.

## Files Created/Modified

- `.planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md` - "Live event 1" GO record, run reply, row table, comparison table, raw index rows
- `evidence/20261117T104534Z-e1-after.queue.json`, `20261117T104535Z-e1-after.baseline.txt`, `20261117T104544Z-e1.ledger.json` - committed
- `evidence/20261117T104535Z-e1.STACK2-6.log`, `20261117T104535Z-e1.FA100056.log` - on disk, ignored by the repo's `*log` rule (same as every earlier `logs-since` copy)

## Deviations from Plan

None - plan executed exactly as written. Two recorded departures from the ideal path, neither a plan deviation: the operator's readiness reply was the single word "ready" without the tool-page replies, so latch, idle and the re-teach answer were collected again at the GO (recorded in Task 1's evidence); and the operator answered checklist items 3-5 only through the typed go.

**Total deviations:** 0. **Impact:** none.

## Issues Encountered

- The stored run record still reads `CREATED` (7 commands) after every row COMPLETED: the known lanes-mode finding from 09-06/09-07, unchanged and still not fixed.
- The log timestamps are UTC+7; the evidence converts them to UTC.
- The galago-tools working tree holds unrelated pre-existing changes (deleted `.planning/phases/04-*` files and similar); `tools/` shows only the untracked `fast-mcp-locks/` runtime directory. Not touched.

## Known Stubs

None.

## Threat Flags

None. Claude's actions in this plan were reads (CTL, pre-flight, HTTP GET, docker exec printenv) and one protocol import before the go; the GO-gate reads, the round trip, the queue and Start were the operator's.

## Next Phase Readiness

Ready for 09-10: the raw evidence is captured and matches the expected deltas, so 09-10 can judge the D-05 rule (the estimate row 67 started 0.2 s after the F.A.S.T. transfer row 66 and finished inside its window, 10:42:16.6-10:42:16.8 inside 10:42:16.4-10:43:28.1) and the event-1 verdict, and check third-plate readiness (the third plate stayed on nest-3). LIV-01 is not marked complete here: the verdict is 09-12's.

## Self-Check: PASSED

- FOUND: evidence `20261117T104534Z-e1-after.queue.json`, `20261117T104535Z-e1-after.baseline.txt`, `20261117T104535Z-e1.STACK2-6.log`, `20261117T104535Z-e1.FA100056.log`, `20261117T104544Z-e1.ledger.json`
- FOUND: commits `18e183a` and `ab80114` (ancestors of HEAD)
- `git status --porcelain -- controller` empty after the capture
