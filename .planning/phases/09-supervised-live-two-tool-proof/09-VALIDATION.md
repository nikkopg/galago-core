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
> Source: `09-RESEARCH.md` § Validation Architecture (V-01..V-14).

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
| V-01 | TBD | 0/1 | LIV-01 / D-09 | — | Each queueId sent exactly once; failed row re-sent once per accepted operator Start; nothing sent while halted | unit (fakes) | `cd controller && npx vitest run test/laneOneSend.test.ts` | ❌ W0 | ⬜ pending |
| V-02 | TBD | 0/1 | D-15 / IN-01 | — | No async boundary between halt-latch check and row claim | static | `cd controller && npx vitest run test/staticScan.test.ts` | ✅ (add) | ⬜ pending |
| V-03 | TBD | 0/1 | LIV-01 / D-06 | — | Live script lane layout and distinct explicit keys; validateLanes empty | unit (offline) | `cd controller && npx vitest run test/liveLanesProtocol.test.ts` | ❌ W0 | ⬜ pending |
| V-14 | TBD | late | LIV-03 | — | Runbook structure intact after edits | python unit | `cd ~/data/nikko/galago-tools && .venv/bin/python -m unittest tools.tests.gal07_live_runbook_test.TestRunbookContent` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are rebound to `09-NN-MM` by the planner.*

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
| Pre-flight `PREFLIGHT OK` before each GO (V-04) | LIV-01 | Live host | `bash docs/runbooks/gal-07-live-check.sh` (both forms) |
| Deploy with rollback anchor, new image, health, store, laneMode (V-05) | LIV-01 | Docker on production, typed GO | Runbook 1a-6 steps; `/api/health`; `commandQueue.laneStatus` |
| Overlap window on per-lane run rows (V-06) | LIV-01 | Operator presses Start on real instruments | Read `commandQueue.getAll` after run; record raw ms timestamps |
| Both tool logs in same window (V-07) | LIV-01 | Real tool logs | Baseline vs after attempt-line counts |
| Event 2 ledger: one done/ran per explicit key (V-08) | LIV-01 | Real ledger | Ledger JSON read right after event |
| Drill scenarios 1-3 freeze both lanes (V-09) | LIV-02 | Production web, sim workcell, operator | `laneStatus` + `getAll` snapshots before each Start |
| No real tool contacted during drill (V-10) | LIV-02 | Real host state | Listener PIDs, log counts, ledger unchanged |
| Drill leaves no latch/run (V-11) | LIV-02 | Production state | `laneStatus`, pre-flight check 7 |
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
