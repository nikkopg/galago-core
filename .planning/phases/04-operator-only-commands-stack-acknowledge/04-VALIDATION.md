---
phase: "4"
slug: "operator-only-commands-stack-acknowledge"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 04-02-{missing} | 02 | 1 | OPR-01 | T-04-SC / — | refuses wrong/no/blank guid and non-"yes" arm_inspected before any send | unit | `cd controller && PATH=~/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/recoveryActions.test.ts test/recoveryControl.test.ts test/controlDecision.test.ts` | ❌ (created in-phase; mirrors `test/recoveryControl.test.ts` anchors — ✅ existing) | ⬜ pending |
| *(map completed by validate-phase §6, task IDs per plan)* | | | OPR-02 | T-04-SC / — | audit lines for refused / transport error / outcome; STACK refuse-while-running message; SUCCESS+message refusal (unit) | unit | `npx vitest run test/recoveryControl.test.ts` (extends existing :39-156 tests) | ✅ file exists, extend | ⬜ pending |
| | | | OPR-03 | T-04-SC / — | `tool.latchStatus` toolId-only; `extractLatch` shape tolerance; "Use this guid" fills-not-sends (static scan version); explicit Read-latch, no timers | unit + static scan | `npx vitest run test/latchStatus.test.ts test/staticScan.test.ts` | ❌ in-phase | ⬜ pending |
| | | | OPR-04 | T-04-SC / — | execute-time + enqueue refusals, tRPC+REST mapping, row FAILED/stays-queued semantics, mislabelled toolType, case/whitespace + prototype-chain keys | unit | `npx vitest run test/operatorOnly.test.ts test/tools.test.ts test/runs.test.ts` (or equivalents) | ❌ in-phase | ⬜ pending |
| | | | OPR-05 | T-04-SC / — | full static-scan set (exact file list, absence pins, guard placement, single reader, `/latch/i` off send path, no self-acknowledge) | static scan | `npx vitest run test/staticScan.test.ts` | ✅ file exists, extend | ⬜ pending |

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

*"Wire proof" of the acknowledge payload (real ts-proto encoder) is not manual — it is Phase 5's GEN-04
activation test, explicitly not provable before codegen.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
