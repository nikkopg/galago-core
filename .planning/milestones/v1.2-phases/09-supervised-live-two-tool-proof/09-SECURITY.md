---
phase: "09"
slug: "supervised-live-two-tool-proof"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-17"
---

# Phase 09 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| protocol JSON -> production store | the operator / Claude imports these files; the script runs server-side in the vm sandbox | 09-01 |
| run-form parameters -> script | operator-typed spare nests and tool names cross into emitted STACK and F.A.S.T. commands | 09-01 |
| production galago-web -> repo | the read-back of protocol 15 is copied into a committed file | 09-01 |
| test harness -> CommandQueue | the harness drives the real queue; only fake tools are reachable | 09-02 |
| future edits -> dispatch span | a later refactor could add an async boundary the latch check does not cover | 09-02 |
| Claude shell -> host processes | phase9-ctl.sh can send a signal; only to a sim server | 09-03 |
| galago-web / tool logs / ledger -> repo evidence | read data is copied into committed files | 09-03 |
| operator tool-page reads -> STACK manager | real-mode reads reach the manager | 09-03 |
| working tree -> image | docker compose builds from the working tree, not from git | 09-04 |
| Claude -> production container | Claude runs the rebuild only after the operator's typed go | 09-04 |
| environment -> galago-web | the lanes flag is read once in the CommandQueue constructor | 09-04 |
| galago-web container -> host ports 40000-40099 | the container can reach both sim and real tool servers | 09-05 |
| sim tool config -> instrument hosts | a non-simulated Configure would dial the configured instrument host | 09-05 |
| Claude -> production store | protocol import writes a protocol row; no tool contact | 09-06 |
| operator -> queue | queueing, Start and re-arm are operator actions | 09-06 |
| operator shell -> sim processes | stop-sim / start-sim restricted to 40091 / 40092 | 09-06 |
| operator -> queue and Freeze dialog | every queue action is the operator's | 09-07 |
| Claude shell -> sim processes | stop-sim restricted to 40091 / 40092 | 09-07 |
| drill state -> live run | a latch, a stale run or the uat-sim selection could leak into event 1 | 09-07 |
| galago-core evidence -> galago-tools runbook | facts are copied across repos into an operator document | 09-08 |
| dirty galago-tools tree -> commit | unrelated changes could be swept into the commit | 09-08 |
| operator -> STACK2-6 tool page | readiness reads and the round trip: real motion by the operator only, before the baseline | 09-09 |
| operator -> queue -> STACK2-6 / FA100056 | real motion starts only from the operator's action after the typed go | 09-09 |
| Claude -> galago-web-dev store | protocol import only (workcell test, id 1) | 09-09 |
| host edits -> galago-web-dev | ./controller is bind-mounted with hot reload; any edit changes the running server | 09-09 |
| tool logs / ledger -> evidence | raw evidence copied before truncation or pruning | 09-09 |
| raw evidence -> verdict | the verdict is computed from copied rows, logs and ledger records | 09-10 |
| operator hands and eyes -> rig | plate positions are confirmed (and the third plate placed, if needed) by hand before the one-way event | 09-10 |
| run form -> STACK transfer fields | operator-typed overlap and out1 triples become arm targets | 09-11 |
| evidence -> project records | verdicts become claims in PROJECT.md and the runbook | 09-12 |
| galago-core -> galago-tools runbook | operator procedure is published for future live runs | 09-12 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|----------|-------------|------------|--------|----------|
| T-09-01 | Tampering (to hardware) | event-1/event-2 scripts, spare parameters | critical | mitigate | In-script spare guard refuses spare A = spare B, a spare equal to a plate home, or a spare on the F.A.S.T.-side device, before any galago call; offline cases (g)/(e)/(f) pin it; spare params have no default | closed | D-02 spare/overlap guard in 09-live-lanes-event1/2.protocol.json; liveLanesProtocol.test.ts (34/34 pass) |
| T-09-02 | Tampering | sticky galago.lane | high | mitigate | galago.lane() reset before the overlap step; tests assert no STACK row carries a lane key and the overlap call is in flight with the F.A.S.T. call | closed | galago.lane() reset present in both event protocols; liveLanesProtocol.test.ts |
| T-09-03 | Tampering | step keys | high | mitigate | Per-run base with per-leg suffixes; tests assert distinct keys within a run and disjoint keys across two runs | closed | per-run key base + leg suffixes; liveLanesProtocol.test.ts |
| T-09-04 | Tampering (to hardware) | sim-drill script | high | mitigate | Script refuses STACK2-6 / FA100056 as tool names; defaults are SIM-STACK / SIM-FAST; test (d) pins it | closed | toolKey() normalized refusal of stack26/fa100056 + SIM allow-list (CR-01 fix 4474bc9); tests (d),(d2) |
| T-09-05 | Information disclosure | store-protocol-15.export.json | medium | mitigate | Credential pattern grep must print 0 before commit (acceptance criterion) | closed | credential grep over store-protocol-15.export.json = 0 |
| T-09-06 | Tampering (to hardware) | queue dispatch under lanes | critical | mitigate | laneOneSend.test.ts tallies sends per queueId across overlap, run N+1 and the retry path; the mutation check proves it fails when claimEligible re-claims a COMPLETED or STARTED row | closed | controller/test/laneOneSend.test.ts passes |
| T-09-07 | Elevation of privilege (dispatch after halt) | _pickNext / _runSideLane | high | mitigate | dispatch-span pin with a region-text negative control; side-lane single-await pin bounds the accepted IN-01 window to _shouldSkip | closed | dispatch-span pin in controller/test/staticScan.test.ts |
| T-09-08 | Repudiation | 08-REVIEW-DISPOSITION.md | low | mitigate | IN-01 row and front matter updated together with the pin reference; counts adjusted | closed | 08-REVIEW-DISPOSITION.md IN-01 row updated |
| T-09-09 | Tampering (to hardware) | test runs | high | mitigate | createLaneHarness spies Tool.executeCommand and @/db/client throws in tests; no endpoint reachable | closed | createLaneHarness fakes only; tests pass offline |
| T-09-10 | Denial of service / safety | phase9-ctl.sh stop-sim | critical | mitigate | PID resolved from the sim port listener only; refuses unless /proc cmdline names that port and the PID owns no real port; check-guards self-test; no name-pattern kill (grep gate) | closed | phase9-ctl.sh refuse_reason(): port-resolved PID, /proc cmdline --port check, real-port refusal; check-guards fails closed (WR-02 fix 88a972d) |
| T-09-11 | Tampering | phase9-ctl.sh reads | high | mitigate | GET-only curl, no container CLI, no gRPC; grep gate in verify | closed | phase9-ctl.sh web_get is curl GET-only; no docker/grpc/pkill in script |
| T-09-12 | Information disclosure | evidence/ files | medium | mitigate | Redaction in logs-since; credential grep over evidence/ must print 0 | closed | credential grep over evidence/ = 0 |
| T-09-13 | Tampering (to hardware) | spare-nest choice | critical | mitigate | Operator-run reads plus a standalone estimate before any GO; D-02 decision checkpoint without auto_select; no-pair stops LIV-01 | closed | evidence/*spare-check* baselines; D-02 decision recorded in 09-CONTEXT.md |
| T-09-14 | Repudiation | spare-check reads | low | mitigate | Pre/post baselines prove no Transfer line and no ledger write | closed | pre/post spare-check baselines in evidence/ |
| T-09-15 | Tampering | build inputs | high | mitigate | .dockerignore tracked; git status --porcelain -- controller empty; no production diff since d09a047; HEAD recorded | closed | D-13 amended (decision B): no image build; controller git status empty at every baseline (09-LIVE-EVIDENCE.md) |
| T-09-16 | Tampering (config) | GALAGO_PARALLEL_LANES persistence | medium | mitigate | Operator chooses env or once at the GO; printenv check in the container; choice recorded for row 3a-11 | closed | printenv GALAGO_PARALLEL_LANES=1 (09-LIVE-EVIDENCE.md Deploy check 1) |
| T-09-17 | Denial of service / safety | container recreate | high | mitigate | Pre-flight check 7 (no RUNNING run) and a snapshot before the build; typed go first; tool-server PIDs compared before and after | closed | pre-deploy baseline + typed go; listener PIDs unchanged post-deploy (Deploy check 6) |
| T-09-18 | Repudiation | cache-hit no-op build | medium | mitigate | New image ID must differ from the anchor ID, else STOP | closed | Superseded by D-13 amendment: no build, image a331fa4d812a unchanged, container id change verified |
| T-09-19 | Denial of service | rollback | medium | mitigate | Anchor tagged and verified equal to the running image before the build; rollback commands recorded | closed | Superseded by D-13 amendment: rollback command recorded in 09-04-SUMMARY.md |
| T-09-20 | Tampering (to hardware) | SIM-STACK / SIM-FAST tool records | critical | mitigate | Placeholder instrument hosts 192.0.2.1 / 192.0.2.2; Simulate on before Configure; Claude verifies no tool entry has host 10.150.1.125 or port 40001 / 40012 | closed | placeholder hosts + simulated before Configure (09-05-SUMMARY.md) |
| T-09-21 | Denial of service | sim launch on a busy port | high | mitigate | start-sim refuses a port that already listens; only 40091 / 40092 are mapped; precondition checks both are free | closed | start-sim refuses busy port (phase9-ctl.sh); WR-01 isolated sim state (98d0d61) |
| T-09-22 | Repudiation | real tool untouched claim | medium | mitigate | Pre-drill, post-launch and post-config baselines compare listener PIDs, trace folder and "Running command" counts | closed | pre-drill / post-launch / post-config baselines in evidence/ |
| T-09-23 | Tampering (to hardware) | drill run | critical | mitigate | Drill protocol imported into uat-sim only and refuses real tool names (09-01); uat-sim lists only SIM tools; per-scenario baseline proves no real "Running command" line | closed | drill imported into uat-sim only; refusal guard; post-drill baselines show no real Running command |
| T-09-24 | Denial of service / safety | stop-sim during the run | high | mitigate | phase9-ctl.sh stop-sim resolves the PID by sim port, checks the cmdline names the port and refuses a real-port PID | closed | phase9-ctl.sh stop-sim guard (see T-09-10) |
| T-09-25 | Repudiation | failed-attempt timestamps | medium | mitigate | Snapshots at halt and before the re-arm Start (Pitfall 3) | closed | drill-s1/s2/s3 at-halt and halted snapshots in evidence/ |
| T-09-26 | Elevation of privilege | Claude driving the queue | high | mitigate | All queue actions are in the operator's checkpoint instructions; Claude only imports and reads | closed | queue actions operator-only per 09-06-SUMMARY.md |
| T-09-27 | Denial of service / safety | sim-server stop at teardown | high | mitigate | phase9-ctl.sh stop-sim guard (port-resolved PID, cmdline check, real-port refusal); real PIDs compared afterwards | closed | stop-sim guard; post-drill baselines compare real PIDs |
| T-09-28 | Elevation of privilege | latch or run left by the drill | high | mitigate | V-11 checks: halted false, no CREATED / STARTED row, no RUNNING run, PREFLIGHT OK after the switch back (Pitfalls 5, 6) | closed | V-11 checks recorded in 09-LIVE-EVIDENCE.md |
| T-09-29 | Repudiation | "no real tool touched" claim | medium | mitigate | PIDs, "Running command" counts, trace folder listing and ledger sha256 compared pre vs post (V-10) | closed | V-10 pre/post comparison in 09-LIVE-EVIDENCE.md |
| T-09-30 | Tampering (to hardware) | Freeze dialog default | medium | mitigate | Instructions require the explicit confirm button; the frozen snapshot must show haltReason freeze | closed | drill-s3-frozen snapshot shows haltReason freeze |
| T-09-31 | Tampering | galago-tools commit | high | mitigate | Explicit-path add and commit; verify HEAD lists only the runbook | closed | galago-tools commit explicit-path; 09-08-SUMMARY.md |
| T-09-32 | Tampering | runbook D-10 gate structure | medium | mitigate | "typed go" wording; TestRunbookContent before and after; phrase count 3 | closed | TestRunbookContent pass; 09-08-SUMMARY.md |
| T-09-33 | Information disclosure | runbook rows | medium | mitigate | No env values; credential and Bearer greps print 0; the test's credential case passes | closed | credential/Bearer greps 0; 09-08-SUMMARY.md |
| T-09-34 | Tampering | vendor gitlink | low | mitigate | git diff and submodule status checks; no re-pin (D-17) | closed | no gitlink re-pin (09-08-SUMMARY.md) |
| T-09-35 | Tampering (to hardware) | event-1 run | critical | mitigate | Typed go after the operator readiness (latch false, arm idle, gripper empty, round trip done/ran), PREFLIGHT OK both forms, the pre-e1 baseline and the Preview lane check; latch and arm re-read at the GO; operator-only queue and Start | closed | e1-readiness + pre-e1 baseline + PREFLIGHT OK; operator-only Start (09-09-SUMMARY.md) |
| T-09-36 | Elevation of privilege | Claude driving motion | critical | mitigate | Claude's actions in this plan are reads (CTL, pre-flight, HTTP GET, docker exec printenv) and one protocol import, all before the go; the readiness reads and the round trip are the operator's; no queue mutation or tool command appears in any Claude step | closed | Claude reads + one import only (09-09-SUMMARY.md threat flags) |
| T-09-37 | Tampering (to hardware) | live failure recovery | critical | mitigate | Runbook D-11 by the operator; no re-send, restart or ledger deletion; the phase stops | closed | no failure occurred in event 1 (PASS); D-11 recovery in runbook |
| T-09-38 | Repudiation | evidence loss | high | mitigate | Capture right after the run; logs-since detects truncation; ledger records copied before the 7-day prune | closed | e1 logs + ledger copied to evidence/ right after the run |
| T-09-39 | Tampering | stale or wrong workcell | medium | mitigate | Workcell test asserted by name and id 1 before the import; GET /api/tools lists STACK2-6 and FA100056 with workcellId 1; pre-flight with GAL07_WEB_CONTAINER=galago-web-dev; uat-sim and its SIM tools left untouched | closed | GET /api/tools STACK2-6 / FA100056 workcellId 1 (09-LIVE-EVIDENCE.md) |
| T-09-40 | Repudiation | event-1 verdict | medium | mitigate | Clause-by-clause numbers from raw ms timestamps, converted log times (never the F.A.S.T. HTTP Date header) and the ledger copy; touching windows fail; rows and laneStatus, not the stored run status | closed | clause-by-clause raw-ms verdict in 09-LIVE-EVIDENCE.md |
| T-09-41 | Tampering (to hardware) | event 2 after a failed event 1 | critical | mitigate | Verdict gate: FAIL stops the phase; Task 2 precondition requires PASS | closed | event 2 prepared only after event-1 PASS (09-10-SUMMARY.md) |
| T-09-42 | Tampering (to hardware) | third-plate placement and arm state before event 2 | critical | mitigate | Third plate on nest-3 per the amended D-02, never on fa100056 tray1, nest-1 or nest-2, confirmed by eye (GetLabwarePresence reads the gripper only); latched:false, stack2-6 idle and hasLabware:false read by the operator; the post-e2-readiness baseline proves no transfer and no ledger write; 09-11 adds the fresh round trip before its one-way GO | closed | e2-readiness reads + post-e2-readiness baseline (09-10-SUMMARY.md) |
| T-09-43 | Tampering (to hardware) | -x1 and out1 transfers | critical | mitigate | In-script amended D-02 guard (overlap source never a plate home or on fa100056; destination plate 1's home only; out1 destination equals the overlap source), tested in liveLanesProtocol.test.ts event-2 (f); triples from the amended D-02 table with no defaults; reach confirmed by eye at the one-way GO | closed | amended D-02 guard in event2 protocol; liveLanesProtocol.test.ts event-2 (f) |
| T-09-44 | Tampering (to hardware) | re-send or key reuse | critical | mitigate | Per-run explicit keys (D-06); laneOneSend test (D-09); STACK ledger one-shot; no re-send on failure (D-18) | closed | explicit per-run keys; laneOneSend.test.ts; ledger shows 5 records, no re-send |
| T-09-45 | Elevation of privilege | Claude driving motion | critical | mitigate | Claude's actions are reads (CTL, pre-flight, HTTP GET, docker exec printenv) and one import before the go; the readiness reads, the round trip and the hand restore are the operator's; nothing from Claude during the run | closed | Claude reads + one import only (09-11-SUMMARY.md) |
| T-09-46 | Tampering (to hardware) | hot-fix during the session | high | mitigate | Any defect stops the work and returns to the user; no code or config change in this plan | closed | no controller commit after 9201bd3 (09-12-SUMMARY.md) |
| T-09-47 | Repudiation | evidence loss | high | mitigate | Capture right after the run; truncation detection; ledger copy before prune | closed | e2 raw capture in evidence/ (09-12-SUMMARY.md) |
| T-09-48 | Repudiation | LIV-01 verdict | medium | mitigate | Clause-by-clause numbers from raw evidence; PASS only if both events pass; five event-2 ledger records with no -x2 checked by the verify command | closed | LIV-01 verdict PASS from raw evidence; 5 records no -x2 |
| T-09-49 | Tampering (to hardware, future runs) | runbook parallel cycle | high | mitigate | Added only on LIV-01 PASS (precondition); it carries the amended placement rules (overlap destination plate 1's home only, out1 to the overlap source, no return leg), the readiness round trip, the typed-go discipline and the D-11 recovery; TestRunbookContent passes | closed | runbook parallel cycle added after LIV-01 PASS; TestRunbookContent pass |
| T-09-50 | Tampering | galago-tools commit | high | mitigate | Explicit-path add and commit; HEAD lists only the runbook; no re-pin check | closed | explicit-path galago-tools commit (09-12-SUMMARY.md) |
| T-09-51 | Information disclosure | runbook rows | medium | mitigate | No env values; Bearer grep prints 0; the credential test case passes | closed | Bearer grep 0; credential test passes (09-12-SUMMARY.md) |
| T-09-52 | Repudiation | PROJECT.md overclaim | medium | mitigate | Task 2 precondition requires LIV-01 PASS; partial results stay Active (flagged edge) | closed | PROJECT.md updated only after LIV-01 PASS |
| T-09-53 | Tampering (to hardware) | nest-3 / nest-1 moves (3 of 5 failed on 2026-11-17) | high | mitigate | Operator round trip nest-3 -> nest-1 -> nest-3 after any re-teach, both Transfers done/ran, checked by Claude in the ledger before the baseline; GetLabwarePresence hasLabware:false and latched:false at readiness, latched:false and stack2-6 idle again at the GO; any failed or refused move stops the work | closed | operator round trip done/ran checked in ledger before pre-e1 baseline (e1-readiness) |
| T-09-54 | Tampering | hot reload of ./controller in galago-web-dev during the event | high | mitigate | `git status --porcelain -- controller` empty at the pre-e1 baseline and after the capture (verify commands); no controller edit in this plan | closed | git status --porcelain -- controller empty at pre-e1 and after capture |
| T-09-55 | Tampering (to hardware) | nest-3 / nest-1 moves beside the running F.A.S.T. (3 of 5 failed on 2026-11-17) | critical | mitigate | Fresh operator round trip nest-3 -> nest-1 -> nest-3, both Transfers done/ran, checked by Claude in the ledger before the pre-e2 baseline; GetLabwarePresence hasLabware:false and latched:false at readiness, latched:false and stack2-6 idle again at the one-way GO; "nothing re-taught since" confirmed; any failed or refused move stops the work | closed | fresh round trip + e2-go-readiness reads in evidence/ |
| T-09-56 | Tampering (to hardware) | out1 landing plate 1 on an occupied nest-3 | critical | mitigate | out1 runs on the primary lane after -x1 COMPLETED and behind the F.A.S.T. barrier; a failed in1 or -x1 halts the run before out1 (liveLanesProtocol.test.ts event-2 (g2), (g3), (g4)); operator confirms nest-3 holds only the third plate at the start | closed | out1 behind F.A.S.T. barrier; tests event-2 (g2)-(g4); event-2 order verified |
| T-09-57 | Tampering | hot reload of ./controller in galago-web-dev during the event | high | mitigate | `git status --porcelain -- controller` empty at the pre-e2 baseline and after the capture (verify commands); no controller edit in this plan | closed | controller git status empty at pre-e2 baseline and after capture |
| T-09-58 | Repudiation | run status misread | medium | mitigate | Verdicts use row statuses and laneStatus; the stored run status (CREATED in lanes mode, 09-07 finding) is recorded as read and carried as a follow-up in the todo and row 3a-14 | closed | run-status follow-up recorded in todo and row 3a-14 |
| T-09-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package is installed (RESEARCH Package Legitimacy Audit: none) | closed | no packages installed in any plan |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Note: T-09-15, T-09-18 and T-09-19 assumed a production image build with a `rollback-pre-lanes` anchor. The user's D-13 amendment (decision B, 09-04) replaced that with recreating `galago-web-dev` with the flag set and no build, which removes the build-input and cache-hit risks; the evidence column records the replacement controls.

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-17 | 59 | 59 | 0 | gsd-secure-phase (L1 grep-depth short-circuit; laneOneSend + liveLanesProtocol 34/34 pass) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-17
