---
phase: "4"
slug: "operator-only-commands-stack-acknowledge"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-29"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (repo dep; no jsdom anywhere — `environment: "node"`) |
| **Config file** | `controller/vitest.config.mts` ({ `include: ["test/**/*.test.ts"]`, `setupFiles: ["test/setup.ts"]`, `clearMocks: true`, `testTimeout: 15000` }) |
| **Quick run command** | `cd controller && npx tsc --noEmit && PATH=~/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/recoveryControl.test.ts test/staticScan.test.ts` |
| **Full suite command** | `cd controller && npx tsc --noEmit && PATH=~/.nvm/versions/node/v24.14.1/bin:$PATH npm run test:unit` |
| **Estimated runtime** | ~52 s (suite baseline at research HEAD: 20 files / 436 tests, all green) |

---

## Sampling Rate

- **After every task commit:** Run `cd controller && npx tsc --noEmit` plus the touched test files
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green (baseline 436 tests; expect ~+40..60 new)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 01 | 1 | OPR-01, OPR-02 | T-04-SC | recovery spec module + rerouted recoveryControl; one exact-payload send end-to-end | unit | `cd controller && npx vitest run test/recoveryActions.test.ts test/recoveryControl.test.ts test/runControl.test.ts test/toolControl.test.ts` | ✅ | ✅ green |
| 04-01-T2 | 01 | 1 | OPR-02 | T-04-SC | strict-success refusal (SUCCESS+message), transport-error audit, one attempt only | unit | `cd controller && npx vitest run test/recoveryControl.test.ts test/recoveryActions.test.ts` | ✅ | ✅ green |
| 04-02-T1 | 02 | 1 | OPR-04 | T-04-SC | refuse table + execute-time guard (toolType/case/whitespace/prototype keys), zero gRPC | unit | `cd controller && npx vitest run test/operatorOnly.test.ts test/tools.test.ts test/toolControl.test.ts` | ✅ | ✅ green |
| 04-02-T2 | 02 | 1 | OPR-04 | T-04-SC | enqueue-time refusal, tRPC BAD_REQUEST / REST 400, nothing stored or enqueued | unit | `cd controller && npx vitest run test/operatorOnly.test.ts test/toolControl.test.ts test/sqliteQueue.test.ts` (planned `runs.test.ts` never existed; coverage lives in operatorOnly.test.ts) | ✅ | ✅ green |
| 04-03-T1 | 03 | 2 | OPR-01 | T-04-SC | recovery-spec decision state through createConfirmedSender to the send contract | unit | `cd controller && npx vitest run test/controlDecision.test.ts test/staticScan.test.ts` | ✅ | ✅ green |
| 04-03-T2 | 03 | 2 | OPR-01 | T-04-SC | modal per-kind render; guid entry born empty, explicit click, cleared after accept | unit | `cd controller && npx vitest run test/controlDecision.test.ts test/recoveryControl.test.ts test/staticScan.test.ts` | ✅ | ✅ green |
| 04-04-T1 | 04 | 3 | OPR-03 | T-04-SC | LATCH_READ_COMMAND + extractLatch shape tolerance + toolId-only tool.latchStatus | unit | `cd controller && npx vitest run test/latchStatus.test.ts test/recoveryActions.test.ts test/recoveryControl.test.ts test/toolReply.test.ts` | ✅ | ✅ green |
| 04-04-T2 | 04 | 3 | OPR-03 | T-04-SC | latched-failure block: explicit read, read-only, "Use this guid" fills, never sends, no timers | unit | `cd controller && npx vitest run test/latchStatus.test.ts test/controlDecision.test.ts test/staticScan.test.ts` | ✅ | ✅ green |
| 04-05-T1 | 05 | 4 | OPR-05 | T-04-SC | no-Enter card coverage, /latch/i send-path ban, single latch reader | static scan | `cd controller && npx vitest run test/staticScan.test.ts` | ✅ | ✅ green |
| 04-05-T2 | 05 | 4 | OPR-05 | T-04-SC | closed file list, guard placement, no self-acknowledge; phase gate | static scan | `cd controller && npx vitest run test/staticScan.test.ts` + `npm run test:unit` | ✅ | ✅ green |
| 04-06-T1 | 06 | 5 | OPR-01, OPR-03 | — | production lint gate passes (G-04-5) | lint + build | `npx next lint --no-cache --quiet` + clean `docker compose build galago-web` of HEAD | ✅ | ✅ green |
| 04-06-T2 | 06 | 5 | OPR-01 | — | STACK card offers only declared actions (G-04-6) | static scan | `cd controller && npx vitest run test/staticScan.test.ts` ("recovery card offers only the tool type's declared actions (G-04-6)") | ✅ | ✅ green |
| 04-06-T3 | 06 | 5 | OPR-03 | — | raw latch reply in one bounded collapsible, starts collapsed (G-04-2) | static scan | `cd controller && npx vitest run test/staticScan.test.ts` ("latch raw reply stays in one bounded collapsible (G-04-2)") | ✅ | ✅ green |
| 04-07-T1 | 07 | 5 | OPR-04 | T-04-SC | run.create maps operator-only refusal to BAD_REQUEST after simulated dev recompile (G-04-7) | unit | `cd controller && npx vitest run test/runCreateReload.test.ts test/operatorOnly.test.ts` | ✅ | ✅ green |
| 04-07-T2 | 07 | 5 | OPR-04 | T-04-SC | all four run.create branches + store rethrow list classify by error name (G-04-7) | unit | `cd controller && npx vitest run test/runCreateReload.test.ts test/operatorOnly.test.ts test/staticScan.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- None — test framework, fakes (`test/helpers/fakeTool.ts`: `installFakeTool` + `FakeGrpc` + `deferred`),
  existing extended tests, and static-scan helpers all exist and are green. All ❌ items above are
  phase-created files (the implementation itself), not framework gaps.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live acceptance of the acknowledge against a real STACK adapter | OPR-01..04 | STACK/F.A.S.T. motion from tests is out of scope — live runs only in galago-tools' supervised Phase 7 | Per companion milestone: galago-tools v2 Phase 7, supervised, user present |
| UAT test 7 retest on a live `next dev` server (G-04-7) | OPR-04 | The require-cache purge only happens in a live dev process; vitest simulates it with `vi.resetModules()` (runCreateReload.test.ts) | Load /runs and /tools, then POST run.create protocolId 2 → 400 BAD_REQUEST + `stage=enqueue` audit; protocolId 999 → 404; REST POST /api/runs → 400 |

*"Wire proof" of the acknowledge payload (real ts-proto encoder) is not manual — it is Phase 5's GEN-04
activation test, explicitly not provable before codegen.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60 s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-30 (full suite 24 files / 570 tests green, `tsc --noEmit` clean)

## Validation Audit 2026-10-30

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
