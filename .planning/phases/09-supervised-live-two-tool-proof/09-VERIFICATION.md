---
phase: 09-supervised-live-two-tool-proof
verified: 2026-11-17T11:45:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/09-supervised-live-two-tool-proof/09-01-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-01-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-02-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-02-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-03-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-03-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-04-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-04-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-05-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-05-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-06-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-06-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-07-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-07-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-08-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-08-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-09-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-09-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-10-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-10-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-11-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-11-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-12-PLAN.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-12-SUMMARY.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md"
  - ".planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T104534Z-e1-after.queue.json"
  - ".planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T111407Z-e2-after.queue.json"
  - ".planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event1.protocol.json"
  - ".planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event2.protocol.json"
  - ".planning/phases/09-supervised-live-two-tool-proof/protocols/09-sim-drill.protocol.json"
  - ".planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh"
  - "controller/test/laneOneSend.test.ts"
  - "controller/test/liveLanesProtocol.test.ts"
  - "controller/test/staticScan.test.ts"
covered_digest: "v3:sha256:902b2a59c301662c5f875f2289c47c6c6cf2af33e95e71bf786fecad9f0255b5"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Triage open code-review finding CR-01 (and related WR-01, WR-02): decide fix, accept or defer, and record it in 09-REVIEW-DISPOSITION.md (all 17 findings are still 'open')"
    expected: "Either the drill protocol's real-tool refusal compares normalized tool keys with a SIM allow-list (and start-sim uses an isolated XDG_STATE_HOME), or the user explicitly accepts the latent risk because protocol id 8 is single-use drill tooling"
    why_human: "Disposition is a user decision. Evidence shows the drill ran on SIM-STACK/SIM-FAST and real tools were untouched, so the phase goal is met. The guard weakness is latent: a re-run with a name variant (for example STACK_2-6 or FA-100056) would pass the deny-list. The real tool would be addressed only if its instance is still in the process-global tool store."
---

# Phase 9: Supervised Live Two-Tool Proof Verification Report

**Phase Goal:** With the user present, a live run and a drill prove the overlap and the lane freeze, and the resolution is recorded.
**Verified:** 2026-11-17T11:45:00Z
**Status:** human_needed (goal achieved; one open critical review finding needs a user disposition)
**Re-verification:** No, initial verification

The live events cannot be re-run. Verification is from the recorded raw evidence in `evidence/`, re-parsed independently
rather than read from the SUMMARY files or the narrative in 09-LIVE-EVIDENCE.md.

## Goal Achievement

### Observable Truths

Source: ROADMAP success criteria 1 to 3, with the amended D-02, D-03, D-13 and D-18 (user decisions in 09-CONTEXT.md) as the governing wording.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A supervised live run shows a STACK step overlapping the F.A.S.T. transfer, with per-lane evidence rows, explicit step keys and the SHAs recorded (LIV-01) | VERIFIED | See "Independent re-derivation" below. Event 2: STACK `-x1` transfer (nest-3 to nest-1) 11:09:58.493 to 11:10:29.196 lies inside the F.A.S.T. row (lane `fast`, FA100056) 11:09:57.309 to 11:11:08.787, a 30.7 s strictly positive overlap. Event 1: STACK `get_transfer_estimate` 10:42:16.623 to .789 inside the F.A.S.T. row 10:42:16.425 to 10:43:28.134. The row data in the raw snapshots matches the evidence file to the millisecond. |
| 2 | Each STACK step key ran exactly once, as an explicit key, per the ledger (LIV-01, D-05, D-06, D-08) | VERIFIED | `e1.ledger.json`: 4 records (`-in1`, `-in2`, `-out1`, `-out2`), all `state=done`, `result.kind=ran`. `e2.ledger.json`: 5 records (`-in1`, `-in2`, `-x1`, `-out1`, `-out2`), all done/ran, no `-x2` (amended D-03). Baseline diffs: STACK2-6 "Running command Transfer" 14 to 18 and 20 to 25, FA100056 1 to 2 and 2 to 3, ledger 11 to 15 and 17 to 22. Auto-mint "on (not exercised)" and the galago-tools SHAs (`d53da53` tool code, `034867c` docs-only HEAD; `0604348` is an ancestor) are recorded. |
| 3 | A simulated-failure drill freezes both lanes with no automated motion (LIV-02) | VERIFIED | Raw snapshots re-parsed. S1 (stack row fails while SIM-FAST runs): at halt `halted:true, haltReason:failure`, q51 FAILED, q50 STARTED, q52 CREATED. After SIM-FAST finished, q50 COMPLETED (not aborted), q52 still CREATED. Operator Start, then all COMPLETED and `halted:false`. S2 (fast row fails while stack runs): q55 FAILED, q56 COMPLETED, q57 held CREATED, then re-armed and finished. S3 (Freeze lanes mid-overlap): `haltReason:freeze`, both lanes in `runningLanes`, both rows then COMPLETED, q62 held CREATED, then Start, all COMPLETED. |
| 4 | No real tool received a command during the drill (LIV-02, D-10) | VERIFIED | `diff` of `pre-drill-go.baseline` against `post-drill-final.baseline`: only label, time, HEAD, sim listeners, FA100056.log line count (status polling, GET /status only, per the evidence record) and the workcell `uat-sim` to `test`. Real listener PIDs (6872, 7490, 7491, 2320808), STACK2-6 "Running command" 52 and Transfer 12, FA100056 4 and 1, ledger sha `5de43c84...` (9 records) are all unchanged. |
| 5 | PROJECT.md, the lanes todo and (after the live run passed) the galago-tools runbook record the resolution (LIV-03) | VERIFIED | PROJECT.md line 147 Validated bullet "LIV-01..03" with an evidence pointer, line 11 single-flight wording per lane, key-decision rows including deploy decision B (line 252). The todo is at `.planning/todos/completed/scheduler-per-tool-concurrency-lanes.md` with the Resolution table and ticked acceptance boxes; `todos/pending` is empty. galago-tools `034867c` (rows 3a-11, 3a-12) and `69ea3b6` (rows 3a-13..3a-15 plus `### Parallel two-plate cycle (lanes, LIV-01)`, 41 insertions, one file); the parallel-cycle commit came after both events' PASS verdicts. |

**Score:** 5/5 truths verified, 0 behavior-unverified. The lane-halt and freeze invariants are behavior-dependent. They are VERIFIED by recorded live behavioral evidence (status transitions in timestamped queue snapshots plus sim-server logs), not by symbol presence.

### Independent re-derivation (spot checks, read-only)

| Check | Result |
|-------|--------|
| Parsed `20261117T111407Z-e2-after.queue.json`: q73 toolId FA100056, `lane:"fast"`, `laneBarrier:true`; q74 toolId STACK2-6, `step_key ...-x1`, nest-3 to nest-1, no lane (primary) | Matches the evidence file |
| D-05 rule, event 2 | So=11:09:58.493 >= Sf-1500; Eo=11:10:29.196 <= Ef=11:11:08.787; overlap 30703 ms > 0. PASS |
| D-05 rule, event 1 | So=10:42:16.623 >= Sf=10:42:16.425; Eo=.789 <= Ef=10:43:28.134; overlap 166 ms > 0. PASS (read-only estimate by design in event 1) |
| `laneStatus` in both after-snapshots | `laneMode:true, halted:false, haltReason:null, failures:[], runningLanes:[]` |
| Controller code under test | `git diff --stat d09a047 HEAD -- controller ':!controller/test'` is empty; only three test files changed (+954 lines). No hot-fix during the GO-gated session |
| `cd controller && npx vitest run` | 50 files, 1415 tests passed |
| D-15 pin | `staticScan.test.ts` "dispatch span (D-15, IN-01)" exists; `08-REVIEW-DISPOSITION.md` IN-01 recorded `skipped`, "accepted in Phase 9 D-15; pinned by..." |
| D-09 test | `controller/test/laneOneSend.test.ts` exists and runs green |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/test/laneOneSend.test.ts` | D-09 one send per queueId under lanes | VERIFIED | Exists, 97 lines, passes |
| `controller/test/staticScan.test.ts` (dispatch span) | D-15 pin | VERIFIED | Exists, passes. WR-03 notes the pin stops before `claimEligible` and does not pin the callee (warning) |
| `controller/test/liveLanesProtocol.test.ts` | Offline proof of the three live protocols | VERIFIED | 786 lines, passes. WR-04 notes a fragile path into `.planning/` (warning) |
| `protocols/09-live-lanes-event1/event2/09-sim-drill.protocol.json` | Live and drill protocols | VERIFIED | Imported (ids 9, 10, 8) and executed live; row shapes in the snapshots match |
| `tools/phase9-ctl.sh` | Read-only evidence tooling | VERIFIED | Produced all baselines and snapshots used above |
| `09-LIVE-EVIDENCE.md` + `evidence/` | Primary record | VERIFIED | Raw files agree with the narrative on every number I re-derived |
| PROJECT.md, completed lanes todo, runbook rows 3a-11..3a-15 | LIV-03 records | VERIFIED | See truth 5 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| F.A.S.T. row (lane fast, laneBarrier) | out1 (laneBarrier) | lane barrier | WIRED | Both events: out1 started 0.7 s (event 1) and 0.9 s (event 2) after the F.A.S.T. row completed |
| in2 completion | `-x1` start | primary-lane serialization | WIRED | Event 2: x1 started 1501 ms after in2 completed |
| Halt latch | later row dispatch | no-dispatch-after-halt | WIRED | Drill snapshots: the later row stayed CREATED through the halt and the freeze; only the operator's Start re-armed |
| Phase 9 evidence | requirement records | REQUIREMENTS.md | WIRED | LIV-01, LIV-02, LIV-03 are `[x]` and "Complete" |

### Data-Flow Trace (Level 4)

Not applicable. The phase ships no rendering component. The evidence rows come from the live queue store via the API.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Controller suite | `cd controller && npx vitest run` (once) | 1415 passed, 50 files | PASS |
| Overlap windows from raw rows | Python parse of the two after-snapshots | containment and positive overlap hold | PASS |
| Drill transitions from raw rows | Python parse of 8 drill snapshots | halt, hold, resume transitions as claimed | PASS |
| Ledger records | Parse of the two ledger copies | 4 and 5 records, all done/ran, no `-x2` | PASS |

### Probe Execution

Step 7c: SKIPPED. The phase's evidence is a recorded live run. The only conventional-probe match would be `phase9-ctl.sh`, which is the evidence tool and was run live, and re-running it would contact the live server (forbidden for this verification).

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| LIV-01 | 09-01, 09-02, 09-03, 09-04, 09-09, 09-10, 09-11, 09-12 | Supervised live two-tool run shows a STACK step overlapping the F.A.S.T. transfer, per-lane rows, explicit keys, SHAs and auto-mint recorded | SATISFIED | Truths 1 and 2 |
| LIV-02 | 09-01, 09-04, 09-05, 09-06, 09-07, 09-08 | Lane-halt and freeze-lanes shown in a drill freezing both lanes, simulated failure, no automated motion | SATISFIED | Truths 3 and 4 |
| LIV-03 | 09-12 | PROJECT.md and the lanes todo record the resolution; the runbook gains the parallel cycle only after LIV-01 | SATISFIED | Truth 5 |

All three IDs appear in the PLAN frontmatter and in REQUIREMENTS.md (lines 136 to 142 and the traceability table). No orphaned requirements: REQUIREMENTS.md maps only LIV-01..03 to Phase 9, and every plan claims at least one.

### Prohibitions (ADR-550 D3, B-with-guard)

| Prohibition | Tier | Judgment | Flag |
|-------------|------|----------|------|
| Tests MUST NOT move an instrument or contact a tool server (09-02) | test | The harness spies `Tool.executeCommand`; the full suite ran offline with the real tool counters unchanged | enforcement wired; accepted |
| Queue MUST NOT be restructured to close IN-01 (09-02) | judgment | `git diff d09a047..HEAD -- controller` (non-test) is empty. Non-authoritative LLM judgment: satisfied | unverified-prohibition, human review recommended |
| Claude MUST NOT press Start, Freeze or recovery, or queue a run (09-06 and others) | judgment | The evidence attributes every Start, Freeze and stop-sim to the operator, and Claude's calls were reads, imports and sim-rig setup under the narrow amended D-18. This is not observable from the code (the operator's actions are inferred from the snapshots and sim logs, as the evidence file admits). Non-authoritative judgment: satisfied | unverified-prohibition, human review recommended |
| No real tool may receive a command during the drill (09-06, D-10) | judgment | Empirically satisfied (Truth 4). The guard that was meant to enforce it is bypassable by name variants (CR-01) | unverified-prohibition, human review recommended |

Autonomous completion therefore reads "complete with 3 flagged prohibitions". These roll into the single human item in the frontmatter, so they do not each need separate action.

### Review Findings Assessment (09-REVIEW.md, 09-REVIEW-DISPOSITION.md: 17 findings, all open)

| Finding | Undermines the phase goal? | Handling |
|---------|----------------------------|----------|
| CR-01 critical: sim drill real-tool refusal is a case-insensitive deny-list, bypassable via normalized names (`STACK_2-6`, `FA-100056`, `stack 2 6`) | No for this phase's result: the drill ran with `stack_tool=SIM-STACK` and `fast_tool=SIM-FAST` (evidence), and the real counters, PIDs and ledger sha are unchanged across the drill. It is a latent safety defect in a shipped artifact (protocol id 8 remains in the store), and it makes the evidence-file statement "Real-name refusal checked" an overstatement: it checked exact names only. | Human item (disposition). Not a gap, because no phase truth fails and the drill was not defeated. |
| WR-01 start-sim shares the real STACK ledger dir and relies on Configure for simulation; WR-02 check-guards can print GUARDS OK with zero listeners checked | No. The sims were verified `SIMULATED` through `tool.status` and the real ledger sha did not change. These weaken the safeguards for reuse. | Fold into the CR-01 triage |
| WR-03 D-15 pin does not cover `claimEligible` | No. D-15 is satisfied as specified (pin and negative control exist). The pin is shallower than ideal. | Warning only, non-blocking |
| WR-04 test depends on a `.planning/` path | No for now (suite green). It will break if the phase is archived with `/gsd-cleanup` or the tests run inside the container. | Warning, fix before archiving the phase |
| WR-05 .dockerignore, WR-06 event protocols lack tray and plate cross-checks | No. WR-06 was not triggered, since the operator-typed values were verified by the operator at the GO gates. | Warning only |
| IN-01..IN-10 | No | Informational |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Phase 9 files (`laneOneSend`, `liveLanesProtocol`, `staticScan` tests, three protocols, `phase9-ctl.sh`) | n/a | grep for `TBD`, `FIXME`, `XXX` | Info | No matches. No debt-marker blocker |

### Human Verification Required

#### 1. Disposition of CR-01 (and WR-01, WR-02)

**Test:** Read 09-REVIEW.md CR-01 and decide: fix (normalized-key allow-list for `stack_tool` and `fast_tool` in `09-sim-drill.protocol.json`, extra test cases, and `XDG_STATE_HOME` isolation in `start-sim`), accept, or defer. Record the choice in 09-REVIEW-DISPOSITION.md.
**Expected:** A recorded disposition. Until it is fixed, do not re-run the drill protocol (id 8) on a rig where the real tools may be in the global tool store.
**Why human:** A severity-critical finding with disposition `open` needs a user decision. It is not a phase-goal failure, so it is not a gap.

### Observations (not gaps, carried forward by the phase itself)

- The stored run record stays `CREATED` after every row completes (seen on all drill and live runs, and also on the two pre-lanes stale runs). Judging needed row status and `laneStatus`. The phase documents this as a follow-up. It is worth tracking as a later-phase item because a run-level "complete" read gives a wrong answer.
- Event 1's overlap is a 166 ms read-only estimate by design (D-01), and event 2 is the moving 30.7 s overlap, so LIV-01's "overlap" claim rests on event 2.
- The evidence is partly operator-reported: plate positions (no tool read exists), the Freeze press time, and the "restore after capture" ordering. The evidence file states this plainly. The D-05 clauses themselves rest on machine data (rows, logs, ledger).
- Event-1 and event-2 GO-gate checklist items 3 to 7 were answered by one typed "go". This is recorded honestly. It is accepted by the phase's own plan.
- D-02, D-03 and D-13 were amended by the user mid-phase. Verification is against the amended wording, and the amendments are recorded in 09-CONTEXT.md and applied consistently in the events (nest-3 to nest-1, no `-x2`, `galago-web-dev`).
- The deploy deviated from the original D-13 (dev container, no rollback image anchor), by user decision "B". The rollback path is a flag-off recreate. This is recorded.

### Gaps Summary

No gaps. All three requirements and all five truths hold against the raw recorded evidence, the controller suite is green, the controller production code is unchanged since Phase 8, and the LIV-03 records exist in galago-core and galago-tools. The status is `human_needed` solely because the open critical code-review finding CR-01 (and the three judgment-tier prohibitions, which depend on the same guard) needs a user disposition. The phase goal itself is achieved.

---

_Verified: 2026-11-17T11:45:00Z_
_Verifier: Claude (gsd-verifier)_
