---
phase: "1"
slug: "queue-control-path-run-state"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-12"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (version chosen in Wave 0; see RESEARCH.md Open Question 2), plus `tsc --noEmit` as the final gate |
| **Config file** | `controller/vitest.config.ts`, none yet (Wave 0 installs) |
| **Quick run command** | `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" && cd controller && npx vitest run <file>` |
| **Full suite command** | `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" && cd controller && npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds (tsc dominates) |

---

## Sampling Rate

- **After every task commit:** Run the quick command on the touched test file
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** The full suite must pass, and `tsc` must report 0 errors
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Filled in by the planner and executor once task IDs exist. Requirement → test mapping (from RESEARCH.md):

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| QUE-01 | `toolControl` reaches the tool while `executeCommand` is pending, and the busy loop promise is unaffected | unit (mocked Tool) | `npx vitest run test/command_queue.test.ts -t "reaches the tool"` | ❌ W0 | ⬜ pending |
| QUE-01 | Every attempt is logged, including refusals | unit | `npx vitest run test/command_queue.test.ts -t "logs"` | ❌ W0 | ⬜ pending |
| QUE-02 | Refuses with no running step, no `runControl`, an undeclared action, or a blank or unclear decision | unit | `npx vitest run test/command_queue.test.ts -t "refuses"` | ❌ W0 | ⬜ pending |
| QUE-02 | The `runningStep` accessor is set during a tool step and cleared after | unit | `npx vitest run test/command_queue.test.ts -t "runningStep"` | ❌ W0 | ⬜ pending |
| QUE-03 | The `runControl` F.A.S.T. shape is exact | unit | `npx vitest run test/runControl.test.ts` | ❌ W0 | ⬜ pending |
| QUE-04 | `runState` envelope; independent of `modalState` | unit | `npx vitest run test/command_queue.test.ts -t "runState"` | ❌ W0 | ⬜ pending |
| QUE-05 | The heartbeat keeps going after a failed poll | unit (fake timers) | `npx vitest run test/tools.test.ts -t "heartbeat"` | ❌ W0 | ⬜ pending |
| QUE-06 | Regenerated interfaces include `run_state` and `Pause`; tsc reports 0 errors | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Framework install (`vitest`, `vite-tsconfig-paths`), gated by a human-verify checkpoint (package legitimacy)
- [ ] `controller/vitest.config.ts` with path aliases and a setup file mocking `@/db/client` and `@/server/logger`
- [ ] A mock `ToolDriverClient`/`Tool` test double
- [ ] `controller/test/command_queue.test.ts`, `controller/test/tools.test.ts`, `controller/test/runControl.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real F.A.S.T. control round-trip | QUE-01, QUE-04 | Needs the instrument and the galago-tools adapter; covered by the galago-tools supervised live acceptance | See design §9, supervised live acceptance |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
