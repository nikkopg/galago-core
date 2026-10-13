---
phase: "2"
slug: "run-page-live-controls"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-13"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 (node environment), plus `tsc --noEmit` |
| **Config file** | `controller/vitest.config.mts` |
| **Quick run command** | `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" && npm --prefix controller run test:unit` |
| **Full suite command** | `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" && npm --prefix controller run test:unit && npm --prefix controller test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** The full suite must be green, plus `bin/make test` (prettier check), per D-25
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

The planner fills in the task IDs. The requirement → test mapping comes from the RESEARCH.md Validation Architecture.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | — | UI-01 | — | Bar only for a running `runControl` tool; buttons are hints, all enabled when the state is unknown | unit | `npm --prefix controller run test:unit -- test/controlDecision.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | UI-02 | — | Control mutations sent only through the confirmed-send hook | static scan | `npm --prefix controller run test:unit -- test/staticScan.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | UI-03 | — | Decisions start empty; Confirm disabled until complete; reset on reopen | unit | `npm --prefix controller run test:unit -- test/controlDecision.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | UI-04 | — | `describePauseDetail` plain language with a raw fallback | unit | `npm --prefix controller run test:unit -- test/controlDecision.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | UI-05 | — | The pause prompt opens and closes by episode and never touches queue modal state | unit + static scan | `npm --prefix controller run test:unit -- test/controlDecision.test.ts test/staticScan.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | UI-06 | — | Abort ok → stop; refused → no stop; `StopRunModal` not reused; Clear All and skip-run guarded | unit + static scan | `npm --prefix controller run test:unit -- test/controlDecision.test.ts test/staticScan.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | UI-07 | — | `recoveryControl` refusal matrix; fast abort/resume removed from `commandFields` | unit (server) | `npm --prefix controller run test:unit -- test/recoveryControl.test.ts test/runControl.test.ts` | ❌ W0 / edit | ⬜ pending |
| TBD | TBD | — | UI-08 | — | Single call sites for `toolControl`/`recoveryControl`/`controlCommand`; no timers in the control UI | static scan | `npm --prefix controller run test:unit -- test/staticScan.test.ts` | ❌ W0 | ⬜ pending |
| all | all | — | all | — | Type gate | typecheck | `npm --prefix controller test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `controller/test/controlDecision.test.ts` — UI-01, UI-03, UI-04, UI-05, UI-06 pure logic
- [ ] `controller/test/recoveryControl.test.ts` — UI-07 server refusal matrix (mocked gRPC)
- [ ] `controller/test/staticScan.test.ts` — UI-02, UI-06, UI-08 structural invariants
- [ ] Edit `controller/test/runControl.test.ts` — flip the Phase 1 D-10 presence assertion to absence (D-20)

No framework install is needed: Vitest 2.1.9 and `vite-tsconfig-paths` are already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual layout of the control bar, the prompt and the Stop modal; no flicker between the bar and the queue lists (Pitfall 9) | UI-01, UI-04 | No jsdom/RTL (D-24); rendering not covered by node tests | Run galago-web against a simulated F.A.S.T. and observe the run page during a transfer |
| The prompt appears within about 2 s of a real instrument pause | UI-04 | Needs a real or simulated pause (galago-tools ADP-10 is future) | Supervised live acceptance in galago-tools' final phase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
