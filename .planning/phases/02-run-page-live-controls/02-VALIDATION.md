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
| 02-01-T1 | 02-01 | 1 | UI-01, UI-02 | T-02-01, T-02-02, T-02-03 | Bar only for a running `runControl` tool; confirmed Pause reaches the running tool end to end; in-flight and incomplete sends are ignored; refusals verbatim | unit + e2e (router) | `npm --prefix controller run test:unit -- test/controlDecision.test.ts` | created in task (tracer) | ⬜ pending |
| 02-01-T2 | 02-01 | 1 | UI-01, UI-03 | T-02-01, T-02-04, T-02-06 | Buttons are hints, all enabled when unknown; decisions start empty, Confirm disabled until complete, reset on reopen; stale confirm closes | unit | `npm --prefix controller run test:unit -- test/controlDecision.test.ts test/runState.test.ts` | ✅ after 02-01-T1 | ⬜ pending |
| 02-02-T1 | 02-02 | 2 | UI-04 | T-02-08, T-02-09 | A paused run_state reaches the open prompt end to end; `describePauseDetail` plain language | unit + e2e (router) | `npm --prefix controller run test:unit -- test/pausePrompt.test.ts` | created in task (tracer) | ⬜ pending |
| 02-02-T2 | 02-02 | 2 | UI-04, UI-05 | T-02-07, T-02-10 | Episode open/hide/reopen/close rules; keep-open on unknown; raw fallback never drops detail | unit | `npm --prefix controller run test:unit -- test/pausePrompt.test.ts` | ✅ after 02-02-T1 | ⬜ pending |
| 02-03-T1 | 02-03 | 2 | UI-06 | T-02-11, T-02-12, T-02-13 | Abort accepted → then stop (call order proven end to end); refused → no stop; "Pause queue" label | unit + e2e (router) | `npm --prefix controller run test:unit -- test/stopInterception.test.ts` | created in task (tracer) | ⬜ pending |
| 02-03-T2 | 02-03 | 2 | UI-06 | T-02-11, T-02-14 | Clear All and the running run's delete guarded; other runs unaffected; follow-up only after accepted abort | unit | `npm --prefix controller run test:unit -- test/stopInterception.test.ts` | ✅ after 02-03-T1 | ⬜ pending |
| 02-04-T1 | 02-04 | 1 | UI-07 | T-02-15, T-02-19 | `tool.recoveryControl` reaches an untracked tool by id; no deadline | unit (server, e2e router) | `npm --prefix controller run test:unit -- test/recoveryControl.test.ts` | created in task (tracer) | ⬜ pending |
| 02-04-T2 | 02-04 | 1 | UI-07, UI-08 | T-02-15, T-02-16, T-02-17 | `recoveryControl` refusal matrix and audit; fast abort/resume removed from `commandFields` | unit (server) | `npm --prefix controller run test:unit -- test/recoveryControl.test.ts test/runControl.test.ts` | ✅ after 02-04-T1 / edit | ⬜ pending |
| 02-05-T1 | 02-05 | 2 | UI-07 | T-02-23, T-02-24 | Tool-page recovery send reaches the tool through `tool.recoveryControl`; tracked tool refused | unit + e2e (router) | `npm --prefix controller run test:unit -- test/recoveryControl.test.ts` | ✅ (02-04) | ⬜ pending |
| 02-05-T2 | 02-05 | 2 | UI-07, UI-08 | T-02-22 | Recovery card visibility independent of running state; recovery send gate | unit | `npm --prefix controller run test:unit -- test/controlDecision.test.ts test/recoveryControl.test.ts` | ✅ | ⬜ pending |
| 02-06-T1 | 02-06 | 3 | UI-02, UI-08 | T-02-25 | Single call sites for `toolControl`/`recoveryControl`/`runState`/`controlCommand`; send only from the Confirm handler | static scan | `npm --prefix controller run test:unit -- test/staticScan.test.ts` | created in task (tracer) | ⬜ pending |
| 02-06-T2 | 02-06 | 3 | UI-05, UI-06, UI-08 | T-02-26 | No timers in the control UI; countdown modal not reused; prompt outside queue modal plumbing; no instrument-state check | static scan + gate | `npm --prefix controller run test:unit -- test/staticScan.test.ts` then the full suite command and `cd controller && npx prettier . --check` | ✅ after 02-06-T1 | ⬜ pending |
| all | all | — | all | — | Type gate | typecheck | `npm --prefix controller test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each test file is created by the tracer task that first needs it (no separate Wave 0 plan):

- [ ] `controller/test/controlDecision.test.ts` — UI-01, UI-02, UI-03 pure logic and the confirmed-pause end-to-end test (02-01-T1)
- [ ] `controller/test/pausePrompt.test.ts` — UI-04, UI-05 episode rules and formatters (02-02-T1)
- [ ] `controller/test/stopInterception.test.ts` — UI-06 abort-then-stop sequencing and interception predicates (02-03-T1)
- [ ] `controller/test/recoveryControl.test.ts` — UI-07 server refusal matrix (mocked gRPC and db helpers) (02-04-T1)
- [ ] `controller/test/staticScan.test.ts` — UI-02, UI-05, UI-06, UI-08 structural invariants (02-06-T1)
- [ ] Edit `controller/test/runControl.test.ts` — flip the Phase 1 D-10 presence assertion to absence (D-20) (02-04-T2)
- [ ] Edit `controller/test/runState.test.ts` — assert the new `command` field on the running envelope (02-01-T2)

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
