---
phase: "08"
slug: "concurrency-lanes"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-16"
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `08-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9, `environment: "node"`, no jsdom |
| **Config file** | `controller/vitest.config.mts` |
| **Quick run command** | `cd controller && npx vitest run <files>` |
| **Full suite command** | `cd controller && npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~60 seconds (baseline 37 files / 1094 tests ~52 s; tsc ~9 s) |

---

## Sampling Rate

- **After every task commit:** the task's new/changed test file(s) + `cd controller && npx tsc --noEmit`
- **After every plan wave:** `cd controller && npx vitest run && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** full suite green with zero edits to existing assertions; `lanesFlagOff` green in all three constructions; 20x loop green for the engine suites:
  `cd controller && for i in $(seq 20); do npx vitest run test/lanes.test.ts test/laneHalt.test.ts test/laneControl.test.ts || break; done`; prettier clean on touched files; `next build`/lint clean after the UI wave
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Filled in per plan by the planner (task IDs `08-PP-TT`). Requirement → test file map:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| LAN-01 | Golden transcript identical (env unset / option false / option true + untagged) | integration (fake tools, fake timers) | `npx vitest run test/lanesFlagOff.test.ts` | ❌ W0 (capture first) | ⬜ pending |
| LAN-01 | Existing suite passes unedited | regression | `npx vitest run` | ✅ | ⬜ pending |
| LAN-02 | Headline cycle overlaps; one step per tool; run N+1 waits | unit + integration | `npx vitest run test/laneScheduling.test.ts test/lanes.test.ts` | ❌ W0 | ⬜ pending |
| LAN-03 | Barrier table | unit | `npx vitest run test/laneScheduling.test.ts` | ❌ W0 | ⬜ pending |
| LAN-04 | `claimEligible` excludes STARTED; per-lane Start guard; one send per queueId | unit + integration | `npx vitest run test/sqliteQueueClaim.test.ts test/lanes.test.ts` | ❌ W0 | ⬜ pending |
| LAN-05 | Halt on any failure; only operator Start clears | integration | `npx vitest run test/laneHalt.test.ts` | ❌ W0 | ⬜ pending |
| LAN-06 | Primary modal / STARTED Tool Box row gates side dispatch | integration | `npx vitest run test/laneHalt.test.ts` | ❌ W0 | ⬜ pending |
| LAN-07 | Control reaches side-lane F.A.S.T.; `stopIf`; per-queueId abort markers | integration + unit | `npx vitest run test/laneControl.test.ts test/runStateStopIf.test.ts` | ❌ W0 | ⬜ pending |
| LAN-08 | Abort-first Stop/Clear All/delete on any lane | integration + pure | `npx vitest run test/laneControl.test.ts test/stopInterception.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| LAN-09 | `freezeLanes` latch + OFFLINE, nothing aborted, Start releases | integration | `npx vitest run test/laneHalt.test.ts` | ❌ W0 | ⬜ pending |
| LUI-01 | Lane field helpers, Tool Box no control, static pins | unit + static | `npx vitest run test/laneUi.test.ts test/staticScan.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| LUI-02 | `galago.lane`, per-call `{lane, barrier}` | unit | `npx vitest run test/laneScript.test.ts` | ❌ W0 | ⬜ pending |
| LUI-03 | Refusals, `LaneValidationError` mapping (router, API route) | unit + integration | `npx vitest run test/laneValidation.test.ts test/runCreateReload.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| LUI-04 | Per-lane preview / Start listing; untagged strings unchanged | unit | `npx vitest run test/laneUi.test.ts test/queueStartGuard.test.ts test/queuedStartSummary.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| LUI-05 | `groupRowsByLane`, lane-aware outcome | unit | `npx vitest run test/laneUi.test.ts test/runOutcome.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| LUI-06 | Bounded failure list, first kept | integration + unit | `npx vitest run test/laneHalt.test.ts test/laneUi.test.ts test/errorPath.test.ts` | ❌ W0 / ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `controller/test/fixtures/lanesFlagOff.golden.ts` + `controller/test/lanesFlagOff.test.ts` — captured at the unmodified commit (LAN-01), before any production edit
- [ ] `controller/test/laneScheduling.test.ts`, `controller/test/sqliteQueueClaim.test.ts`, `controller/test/runStateStopIf.test.ts`
- [ ] `controller/test/helpers/laneHarness.ts` shared by `lanes`, `laneHalt`, `laneControl` tests (injectable `{ parallelLanes, loopDelayMs: 0 }`, deferred gates, full teardown)
- [ ] `controller/test/laneValidation.test.ts`, `controller/test/laneScript.test.ts`, `controller/test/laneUi.test.ts`
- [ ] Appended `describe` blocks in `controller/test/staticScan.test.ts` (additive only)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Run page renders per-lane rows, "Lanes frozen" indicator and Freeze button readably | LUI-05, LAN-09 | No jsdom; visual layout | Dev compose with `GALAGO_PARALLEL_LANES=1`, simulated tools, run a lane-tagged protocol, inspect run page |
| `RunQueueGanttChart` with overlapping rows | LUI-05 | Not researched in depth | Same run; check Gantt shows overlap sanely |
| Env flag takes effect in the Docker image | LAN-01 | Runtime env (A1) | Start dev compose with and without the env; confirm `laneStatus` reports mode |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
