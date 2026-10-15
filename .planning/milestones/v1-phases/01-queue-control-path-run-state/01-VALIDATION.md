---
phase: "1"
slug: "queue-control-path-run-state"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-12"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 + vite-tsconfig-paths 5.1.4, plus `tsc --noEmit` as the final gate |
| **Config file** | `controller/vitest.config.mts` (setup: `controller/test/setup.ts`) |
| **Quick run command** | `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" && cd controller && npx vitest run <file>` |
| **Full suite command** | `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" && cd controller && npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~45 seconds (vitest 42s for 228 tests over 13 files, measured 2026-10-15) |

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
| QUE-01 | `toolControl` reaches the tool while `executeCommand` is pending, and the busy loop promise is unaffected | unit (fake Tool) | `npx vitest run test/toolControl.test.ts -t "reaches the tool"` | ✅ | ✅ green |
| QUE-01 | Every attempt is logged, including refusals | unit | `npx vitest run test/toolControl.test.ts -t "logs every attempt"` | ✅ | ✅ green |
| QUE-01 | An accepted abort removes the step from the queue; a refused one does not (261015-h0q) | unit | `npx vitest run test/toolControl.test.ts -t "abort"` | ✅ | ✅ green |
| QUE-02 | Refuses with no running step, no `runControl`, an undeclared action, or a blank or unclear decision | unit | `npx vitest run test/runControl.test.ts -t "refuses"` + `test/toolControl.test.ts -t "refuses"` | ✅ | ✅ green |
| QUE-02 | The `runningStep` accessor is set during a tool step and cleared after | unit | `npx vitest run test/toolControl.test.ts -t "runningStep"` | ✅ | ✅ green |
| QUE-03 | The `runControl` F.A.S.T. shape is exact, with fixed refusal ordering | unit | `npx vitest run test/runControl.test.ts` | ✅ | ✅ green |
| QUE-04 | `runState` envelope; independent of `modalState`; one poll for N readers | unit | `npx vitest run test/runState.test.ts` | ✅ | ✅ green |
| QUE-05 | The heartbeat keeps going after a failed poll; one log per failure streak | unit (fake timers) | `npx vitest run test/tools.test.ts -t "heartbeat"` | ✅ | ✅ green |
| QUE-06 | Regenerated interfaces carry `run_state` and `Pause` on the real wire; tsc reports 0 errors | unit + type-check | `npx vitest run test/wire.test.ts && npx tsc --noEmit` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Framework install (`vitest`, `vite-tsconfig-paths`), gated by a human-verify checkpoint (package legitimacy)
- [x] `controller/vitest.config.mts` with path aliases and a setup file mocking `@/db/client` and `@/server/logger`
- [x] A mock `ToolDriverClient`/`Tool` test double
- [x] `controller/test/toolControl.test.ts`, `controller/test/runState.test.ts`, `controller/test/tools.test.ts`, `controller/test/runControl.test.ts`, `controller/test/wire.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real F.A.S.T. control round-trip | QUE-01, QUE-04 | Needs the instrument and the galago-tools adapter; covered by the galago-tools supervised live acceptance | See design §9, supervised live acceptance |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-15 (validate-phase audit: 228/228 tests green, tsc clean)

## Validation Audit 2026-10-15

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
