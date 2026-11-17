---
phase: 09-supervised-live-two-tool-proof
verified: 2026-11-17T12:15:00Z
status: passed
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
  - "controller/test/fixtures/phase9/09-live-lanes-event1.protocol.json"
  - "controller/test/fixtures/phase9/09-live-lanes-event2.protocol.json"
  - "controller/test/fixtures/phase9/09-sim-drill.protocol.json"
  - "controller/test/laneOneSend.test.ts"
  - "controller/test/liveLanesProtocol.test.ts"
  - "controller/test/staticScan.test.ts"
covered_digest: "v3:sha256:4f873f701ce468f38f97597c7e7cd6be699f82af756da92b3261af78b619ba7b"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "Protocol id 8 (the sim drill) in the live protocol store still carries the OLD upper-case deny-list guard. Only the on-disk JSON and the test fixture were fixed (4474bc9)."
    category: other
    reason: "09-REVIEW-FIX.md says to delete or re-import id 8 before any further drill. No record that this was done, and the store is not observable from the codebase. Does not affect the recorded drill, which ran on SIM-STACK/SIM-FAST with real counters unchanged."
    evidence_status: "recorded as an action item, not confirmed done"
---

# Phase 9: Supervised Live Two-Tool Proof Verification Report

**Phase Goal:** With the user present, a live run and a drill prove the overlap and the lane freeze, and the resolution is recorded.
**Verified:** 2026-11-17T12:15:00Z
**Status:** passed
**Re-verification:** Yes. The prior report was `human_needed` (one item: triage of CR-01, WR-01, WR-02). That item was resolved by the user (09-UAT.md test 1: pass) and the findings were fixed in 4474bc9, 98d0d61, 88a972d and 81e274c. This report regenerates the verdict against the current tree and covers the changed files.

The live events cannot be re-run. Truths 1 to 4 are verified from the recorded raw evidence in `evidence/`, re-parsed independently. The evidence files have no commits after the 09-12 docs commits, so they are unchanged since the prior verification. Truth 5 and the fix commits were checked against the tree.

## Goal Achievement

### Observable Truths

Source: ROADMAP Phase 9 success criteria 1 to 3, with the amended D-02, D-03, D-13 and D-18 (09-CONTEXT.md) as the governing wording.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A supervised live run shows a STACK step overlapping the F.A.S.T. transfer, with per-lane evidence rows, explicit step keys and the SHAs recorded (LIV-01) | VERIFIED | Re-parsed `20261117T111407Z-e2-after.queue.json` this run: q73 (F.A.S.T., lane fast) started 11:09:57.309, completed 11:11:08.787. q74 (STACK `-x1`) started 11:09:58.493, completed 11:10:29.196. q74 lies inside q73, a 30.7 s overlap. `laneStatus` is `laneMode:true, halted:false, haltReason:null, failures:[], runningLanes:[]`. Event 1 overlap (166 ms read-only estimate by design) from the prior verification. SHAs recorded in 09-LIVE-EVIDENCE.md. |
| 2 | Each STACK step key ran exactly once, as an explicit key (LIV-01, D-05, D-06, D-08) | VERIFIED | Ledger copies `e1.ledger.json` (4 records) and `e2.ledger.json` (5 records), all done/ran, no `-x2` (amended D-03). Unchanged since the prior verification. |
| 3 | A simulated-failure drill freezes both lanes with no automated motion (LIV-02) | VERIFIED | 8 drill snapshots (S1 stack-fail, S2 fast-fail, S3 Freeze lanes): halt or freeze latched, later row held `CREATED`, running rows completed and not aborted, only the operator's Start resumed. Unchanged since the prior verification. |
| 4 | No real tool received a command during the drill (LIV-02, D-10) | VERIFIED | `diff pre-drill-go.baseline post-drill-final.baseline` re-run this run. Differences are label, time, HEAD, sim listeners (now gone), the FA100056.log line count (status polling) and the workcell `uat-sim` to `test`. Real-tool "Running command" counters and ledger sha are not among the differences. |
| 5 | PROJECT.md, the lanes todo and (after the live run passed) the galago-tools runbook record the resolution (LIV-03) | VERIFIED | PROJECT.md line 147 "LIV-01..03" Validated bullet. `.planning/todos/completed/scheduler-per-tool-concurrency-lanes.md` exists and `todos/pending` is empty. galago-tools runbook commits are recorded in 09-LIVE-EVIDENCE.md (037ade9 records the SHA). |

**Score:** 5/5 truths verified, 0 behavior-unverified. The halt and freeze invariants are behavior-dependent and are verified by recorded timestamped live status transitions, not by symbol presence.

### Verification of the post-review fix commits (changed since the last verifier run)

| Commit | Claim | Independent check | Status |
|--------|-------|-------------------|--------|
| 4474bc9 CR-01 | Drill compares normalized keys (`stack26`, `fa100056`) and allows only names whose key starts with `sim` | Read the diff of `09-sim-drill.protocol.json`. `toolKey` lowercases and strips non-alphanumerics, `REAL_KEYS` check and `indexOf("sim") !== 0` allow-list both run before the first `galago.*` call, and the `fast_tool` equals `stack_tool` check also uses keys. Tests (d), (d2) in `liveLanesProtocol.test.ts` run green. | VERIFIED |
| 81e274c WR-04 | Tests load protocols from `controller/test/fixtures/phase9/` | `cmp` shows all three fixtures byte-identical to the `.planning/.../protocols/` copies. The suite no longer depends on the planning path. | VERIFIED |
| 98d0d61 WR-01 | `start-sim` isolates `XDG_STATE_HOME` so a sim STACK cannot write the real ledger | `bash -n phase9-ctl.sh` passes. Not executed, because it would launch servers. Judgment-tier, per the fix report. | VERIFIED (static) |
| 88a972d WR-02 | `check-guards` fails closed on unresolved or zero real listeners | `bash -n` passes. Not executed, to avoid touching the live environment. The fix report records negative controls and a clean run. | VERIFIED (static) |

Production code unchanged: `git diff --stat d09a047 HEAD -- controller ':!controller/test'` is empty, so the controller code under live test is the code that exists now. All fix commits touch only tests, fixtures, protocols and the evidence tool.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/test/laneOneSend.test.ts` | D-09 one send per queueId under lanes | VERIFIED | 2 tests pass |
| `controller/test/staticScan.test.ts` (dispatch span) | D-15 pin | VERIFIED | 103 tests pass. WR-03 (pin ends before `claimEligible`) is still open, advisory |
| `controller/test/liveLanesProtocol.test.ts` | Offline proof of the three live protocols | VERIFIED | 32 tests pass, loading from fixtures |
| `controller/test/fixtures/phase9/*.protocol.json` | Tested copies of the protocols | VERIFIED | Byte-identical to the protocol copies in the phase directory |
| `protocols/09-*.protocol.json` | Live and drill protocols | VERIFIED | Event protocols imported (ids 9, 10) and executed live. The drill protocol on disk now has the CR-01 guard |
| `tools/phase9-ctl.sh` | Read-only evidence tooling | VERIFIED | Syntax OK, produced all baselines and snapshots |
| `09-LIVE-EVIDENCE.md` + `evidence/` | Primary record | VERIFIED | Raw snapshot values re-derived above match |
| PROJECT.md, completed lanes todo, runbook rows | LIV-03 records | VERIFIED | See truth 5 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| F.A.S.T. row (lane fast, barrier) | out1 (barrier) | lane barrier | WIRED | out1 (q75) started 11:11:09.712, 0.9 s after q73 completed 11:11:08.787 |
| in2 completion | `-x1` start | primary-lane serialization | WIRED | q72 completed 11:09:56.992, q74 started 11:09:58.493, so 1.5 s later |
| Halt latch | later row dispatch | no-dispatch-after-halt | WIRED | Drill snapshots: the later row stayed `CREATED` through halt and freeze |
| Phase 9 evidence | requirement records | REQUIREMENTS.md | WIRED | LIV-01, LIV-02, LIV-03 `[x]` (lines 136 to 142) and "Complete" in the traceability table (lines 217 to 219) |

### Data-Flow Trace (Level 4)

Not applicable. The phase ships no rendering component. Evidence rows come from the live queue store through the API.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 9 test files | `npx vitest run test/laneOneSend.test.ts test/liveLanesProtocol.test.ts test/staticScan.test.ts` | 3 files, 137 tests passed | PASS |
| Full controller suite | Not re-run by me. Reported 50 files, 1416 tests passed in the fix report and the orchestrator context | Taken as reported, since no controller production code changed | NOT RE-RUN |
| Overlap from raw rows | Python parse of the e2 after-snapshot | q74 inside q73, 30.7 s | PASS |
| Drill baseline diff | `diff` of pre-drill-go and post-drill-final baselines | No real-tool counter change | PASS |
| Debt markers | `grep TBD/FIXME/XXX` over phase test, protocol and tool files | No matches | PASS |

### Probe Execution

Step 7c: SKIPPED. The phase's evidence is a recorded live run. The only conventional probe, `phase9-ctl.sh`, is the evidence tool, and re-running it contacts the live environment.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| LIV-01 | 09-01, 09-02, 09-03, 09-04, 09-09, 09-10, 09-11, 09-12 | Supervised live two-tool run shows a STACK step overlapping the F.A.S.T. transfer, per-lane rows, explicit keys, SHAs and auto-mint recorded | SATISFIED | Truths 1 and 2 |
| LIV-02 | 09-01, 09-04, 09-05, 09-06, 09-07, 09-08 | Lane-halt and freeze-lanes shown in a drill freezing both lanes, simulated failure, no automated motion | SATISFIED | Truths 3 and 4 |
| LIV-03 | 09-12 | PROJECT.md and the lanes todo record the resolution. The runbook gains the parallel cycle only after LIV-01 | SATISFIED | Truth 5 |

Each ID appears in the PLAN frontmatter and in REQUIREMENTS.md. REQUIREMENTS.md maps only LIV-01..03 to Phase 9, so there are no orphaned requirements.

### Prohibitions (ADR-550 D3, B-with-guard)

| Prohibition | Tier | Judgment | Flag |
|-------------|------|----------|------|
| Tests MUST NOT move an instrument or contact a tool server (09-02) | test | Harness spies `Tool.executeCommand`, suite runs offline. Enforcement is wired | Accepted |
| Queue MUST NOT be restructured to close IN-01 (09-02) | judgment | `git diff d09a047..HEAD -- controller ':!controller/test'` is empty. Deterministic evidence supports it | Satisfied |
| Claude MUST NOT press Start, Freeze or recovery, or queue a run (09-06 and others) | judgment | Not observable from code. The evidence attributes every Start, Freeze and stop-sim to the operator, who was present at every GO gate. Non-authoritative judgment: satisfied | Flagged: unverified-prohibition, covered by the user's UAT acceptance |
| No real tool may receive a command during the drill (09-06, D-10) | judgment | Empirically satisfied (Truth 4). The guard is now hardened against name variants (CR-01 fix, verified above) | Flagged: unverified-prohibition, covered by the user's UAT acceptance |

The two flagged judgment items are the same ones the prior report rolled into its single human item. The user has since resolved that item (09-UAT.md test 1: pass), so no human item remains open. Autonomous completion reads "complete with 2 flagged judgment-tier prohibitions, user-reviewed".

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Phase 9 tests, fixtures, protocols, `phase9-ctl.sh` | n/a | `TBD`, `FIXME`, `XXX` | Info | No matches, so no debt-marker blocker |

### Review Findings Status (09-REVIEW-DISPOSITION.md: 4 fixed, 13 open)

| Finding | State | Effect on the goal |
|---------|-------|--------------------|
| CR-01, WR-01, WR-02, WR-04 | fixed (4474bc9, 98d0d61, 88a972d, 81e274c), verified above | None |
| WR-03 (D-15 pin stops before `claimEligible`), WR-05 (.dockerignore), WR-06 (no tray and plate cross-check in event protocols) | open | None. WR-06 was not triggered, because the operator verified the values at the GO gates |
| IN-01 to IN-10 | open | None, informational |

Open items are advisory only. None undermines a phase truth.

### Security

09-SECURITY.md (87d2802): `status: verified`, `threats_open: 0` (59 threats), as recorded in its frontmatter.

### Human Verification Required

None. The prior human item (disposition of CR-01, WR-01, WR-02) was resolved by the user in 09-UAT.md (test 1: pass, 0 issues).

### Advisory (carried forward, not blocking)

- Protocol id 8 in the live protocol store still holds the old guard until it is deleted or re-imported from the updated JSON. The fix report flags this as an action, and nothing in the repository confirms it was done. Do not re-run the drill from the store copy until it is replaced.
- The stored run record stays `CREATED` after all rows complete (seen on every drill and live run). A run-level "complete" read gives a wrong answer, so judge by row status and `laneStatus`. This is a follow-up for a later phase.
- Event 1's overlap is a 166 ms read-only estimate by design, so the LIV-01 overlap claim rests on event 2's 30.7 s window.
- Some evidence is operator-reported (plate positions, Freeze press time), as the evidence file states plainly. The D-05 clauses rest on machine data.
- D-02, D-03 and D-13 were amended by the user mid-phase and the deploy used decision "B" (dev container, flag-off recreate as the rollback). Verification is against the amended wording.

### Gaps Summary

No gaps. All five truths and all three requirements hold against the raw recorded evidence and the current tree. The post-review fixes are present, correct on inspection, and covered by passing tests, with no controller production code change since Phase 8. The prior `human_needed` item was resolved by the user.

---

_Verified: 2026-11-17T12:15:00Z_
_Verifier: Claude (gsd-verifier)_
