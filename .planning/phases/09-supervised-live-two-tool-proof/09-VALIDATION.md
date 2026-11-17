---
phase: "09"
slug: "supervised-live-two-tool-proof"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-17"
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `09-RESEARCH.md` § Validation Architecture (V-01..V-14), plus V-15 (operator readiness), added
> when the plans were revised for the 2026-11-17 amendments to D-02, D-03, D-13 and D-18 (`09-CONTEXT.md`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 (controller), Python unittest (galago-tools runbook structure test) |
| **Config file** | `controller/vitest.config.mts` |
| **Quick run command** | `cd controller && npx vitest run test/laneOneSend.test.ts test/staticScan.test.ts test/lanes.test.ts test/laneHalt.test.ts` |
| **Full suite command** | `cd controller && npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~60 seconds (engine suites ~7 s) |

---

## Sampling Rate

- **After every task commit:** the task's test file(s) + `cd controller && npx tsc --noEmit`
- **After every plan wave:** `cd controller && npx vitest run && npx tsc --noEmit`
- **Before any GO gate (D-09 gate):** full suite green; `laneOneSend.test.ts` and the dispatch-span pin green; prettier clean on touched files
- **Before `/gsd-verify-work`:** Full suite must be green, `09-LIVE-EVIDENCE.md` complete for LIV-01 and LIV-02, runbook test green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-02-01 (V-01) | 09-02 | 1 | LIV-01 / D-09 | T-09-06 | Each queueId sent exactly once; failed row re-sent once per accepted operator Start; nothing sent while halted | unit (fakes) | `cd controller && npx vitest run test/laneOneSend.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-02 (V-02) | 09-02 | 1 | D-15 / IN-01 | T-09-07 | No async boundary between halt-latch check and row claim | static | `cd controller && npx vitest run test/staticScan.test.ts -t "dispatch span"` | ✅ (add) | ⬜ pending |
| 09-01-01..03 (V-03) | 09-01 | 1 | LIV-01, LIV-02 / D-02 (amended 09-03), D-04, D-06, D-10 | T-09-01..04 | Live and drill script lane layout, distinct explicit keys (event 2: five, no -x2), the amended overlap guard (overlap source never a plate home or on fa100056; destination plate 1's home only; event-1 out1 to plate 1's home, event-2 out1 to the overlap source) and real-tool guards, offline overlap through the queue | unit (offline + fakes) | `cd controller && npx vitest run test/liveLanesProtocol.test.ts` | ❌ W0 | ⬜ pending |
| 09-04-01, 09-04-03, 09-07-03, 09-09-01, 09-11-01 (V-04) | 09-04, 09-07, 09-09, 09-11 | 3, 6, 8, 10 | LIV-01 / D-13 (amended, decision B) | T-09-17 | PREFLIGHT OK both forms against the deployed container galago-web-dev before each GO and after deploy / drill | manual-only (live host) | `cd ~/data/nikko/galago-tools && GAL07_WEB_CONTAINER=galago-web-dev bash docs/runbooks/gal-07-live-check.sh` (both forms; the second adds `GAL07_REQUIRE_STACK_ENV=1`) | n/a | ⬜ pending |
| 09-04-03 (V-05) | 09-04 | 3 | LIV-01 / D-13 (amended, decision B) | T-09-18, T-09-19 | galago-web-dev recreated with `GALAGO_PARALLEL_LANES=1` (flag kept in the gitignored root `.env`), dev image id unchanged (a331fa4d812a, `--no-build`), new container id, health ok, store holds STACK2-6 + FA100056, laneMode true, tool PIDs unchanged. No image anchor: rollback is the flag-off recreate `env -u GALAGO_PARALLEL_LANES docker compose -f docker-compose.dev.yml up -d --no-build galago-web-dev` plus removing the `GALAGO_PARALLEL_LANES` line from the root `.env` | manual-only (docker, typed GO) | `docker exec galago-web-dev printenv GALAGO_PARALLEL_LANES`; `curl -fsS localhost:3010/api/health`; laneStatus GET | n/a | ⬜ pending |
| 09-10-01, 09-12-01 (V-06) | 09-10, 09-12 | 9, 11 | LIV-01 / D-05 | T-09-40, T-09-48 | Overlap row (event 1: the estimate nest-3 to nest-1; event 2: `-x1` nest-3 to nest-1) inside the F.A.S.T. row under the recorded 1500 ms rule; completion judged from row statuses and laneStatus, not the stored run status (it stays CREATED in lanes mode, 09-07 finding) | manual-only (evidence analysis) | `grep -E "^Event [12] verdict" 09-LIVE-EVIDENCE.md` | n/a | ⬜ pending |
| 09-10-01, 09-12-01 (V-07) | 09-10, 09-12 | 9, 11 | LIV-01 / D-05, D-03 (dropped) | T-09-38 | Both tool logs in the same window (log line times, UTC+7; never the F.A.S.T. HTTP Date header); "Running command Transfer" +4/+1 (event 1) and +5/+1 (event 2, no return leg), compared on "Running command" counts, never total lines | manual-only | `phase9-ctl.sh logs-since` excerpts | n/a | ⬜ pending |
| 09-12-01 (V-08) | 09-12 | 11 | LIV-01 / D-05, D-06, D-03 (dropped) | T-09-44 | Five done/ran ledger records, one per explicit key (`-in1`, `-in2`, `-x1`, `-out1`, `-out2`), no `-x2` key | manual-only | ledger copy count == 5 and no key ending in `-x2` | n/a | ⬜ pending |
| 09-06-03, 09-07-01, 09-07-02 (V-09) | 09-06, 09-07 | 5, 6 | LIV-02 / D-11 | T-09-23, T-09-25 | Other-lane row COMPLETED, later rows CREATED, halted with the right reason, only operator Start re-arms (on galago-web-dev, uat-sim workcell) | manual-only (operator) | `phase9-ctl.sh snapshot` per scenario | n/a | ⬜ pending |
| 09-05-01, 09-05-02, 09-07-03 (V-10) | 09-05, 09-07 | 4, 6 | LIV-02 / D-10 | T-09-22, T-09-29 | Real listener PIDs, Running-command counts, trace folder and ledger sha256 unchanged | manual-only | `phase9-ctl.sh baseline` pre vs post | n/a | ⬜ pending |
| 09-07-03 (V-11) | 09-07 | 6 | LIV-02 | T-09-28 | No latch, no queued row, no RUNNING run, workcell `test` (id 1, the real STACK2-6 + FA100056 workcell) selected, PREFLIGHT OK | manual-only | laneStatus GET + pre-flight | n/a | ⬜ pending |
| 09-09-01, 09-10-02, 09-11-01 (V-15, added with the 2026-11-17 amendments) | 09-09, 09-10, 09-11 | 8, 9, 10 | LIV-01 / D-02 (amended), D-14, D-18 | T-09-53, T-09-42, T-09-55 | Operator readiness before each event: latched:false, stack2-6 idle, GetLabwarePresence hasLabware:false (gripper only), plate positions by eye; before 09-09 and 09-11 baselines a nest-3 to nest-1 to nest-3 round trip whose two Transfers end done/ran (3 of 5 earlier moves between these nests failed); 09-10 runs no Transfer (post-e2-readiness baseline equals e1-after on Transfer counts and ledger sha256) | manual-only (operator) | reply files `*-e1-readiness.txt`, `*-e2-readiness.txt`, `*-e2-go-readiness.txt`; `phase9-ctl.sh baseline` comparisons | n/a | ⬜ pending |
| 09-12-02 (V-12, V-13) | 09-12 | 11 | LIV-03 / D-19 | T-09-52 | PROJECT.md Validated entry; todo resolution and move to completed | docs | `grep -c 09-LIVE-EVIDENCE.md .planning/PROJECT.md`; `test -f .planning/todos/completed/scheduler-per-tool-concurrency-lanes.md` | n/a | ⬜ pending |
| 09-08-01, 09-12-03 (V-14) | 09-08, 09-12 | 7, 11 | LIV-02, LIV-03 / D-16, D-17 | T-09-31..33, T-09-49..51 | Runbook structure intact; rows 3a-11..3a-15; variant only after LIV-01 | python unit | `cd ~/data/nikko/galago-tools && .venv/bin/python -m unittest tools.tests.gal07_live_runbook_test.TestRunbookContent` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs bound to `09-NN-MM` by the planner (2026-11-17).*

---

## Wave 0 Requirements

- [ ] `controller/test/laneOneSend.test.ts` — V-01 (D-09 gate)
- [ ] `controller/test/staticScan.test.ts` — V-02 dispatch-span pin additions (D-15)
- [ ] `controller/test/liveLanesProtocol.test.ts` (name at planner's discretion) — V-03
- [ ] Live-lanes protocol JSON and sim-drill protocol JSON

Framework install: none.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pre-flight `PREFLIGHT OK` before each GO (V-04) | LIV-01 | Live host | `GAL07_WEB_CONTAINER=galago-web-dev bash docs/runbooks/gal-07-live-check.sh` (both forms) |
| Lanes on in galago-web-dev, health, store, laneMode (V-05) | LIV-01 | Docker on the live host, typed GO | Decision B: `GALAGO_PARALLEL_LANES=1 docker compose -f docker-compose.dev.yml up -d --no-build galago-web-dev` (flag kept in the root `.env`); dev image id unchanged; `/api/health`; `commandQueue.laneStatus`. No image anchor; rollback is the flag-off recreate of galago-web-dev plus removing the `.env` line |
| Overlap window on per-lane run rows (V-06) | LIV-01 | Operator presses Start on real instruments | Read `commandQueue.getAll` after run; record raw ms timestamps; judge row statuses and laneStatus, not the stored run status |
| Both tool logs in same window (V-07) | LIV-01 | Real tool logs | Baseline vs after "Running command Transfer" counts: +4/+1 (event 1), +5/+1 (event 2) |
| Event 2 ledger: one done/ran per explicit key (V-08) | LIV-01 | Real ledger | Ledger JSON read right after event: five records, no `-x2` |
| Drill scenarios 1-3 freeze both lanes (V-09) | LIV-02 | galago-web-dev (lanes on), uat-sim workcell, operator | `laneStatus` + `getAll` snapshots before each Start |
| No real tool contacted during drill (V-10) | LIV-02 | Real host state | Listener PIDs, log counts, ledger unchanged |
| Drill leaves no latch/run (V-11) | LIV-02 | galago-web-dev state | `laneStatus`, pre-flight check 7 |
| Operator readiness before each live event (V-15) | LIV-01 | Real arm and nests, operator only (D-18) | Tool-page reads (latch, robot state, gripper) and the nest-3 / nest-1 round trip before the baseline; plate positions by eye |
| PROJECT.md updated (V-12) | LIV-03 | Docs | `grep -n "proven live" .planning/PROJECT.md` |
| Lanes todo moved to completed (V-13) | LIV-03 | Docs | `ls .planning/todos/completed` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
