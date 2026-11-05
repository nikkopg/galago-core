---
phase: "6"
slug: "stack-dropdowns"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-05"
---

# Phase 6 — Validation Strategy

> This is the validation contract for Phase 6: which checks run at each step of execution, and how often.
> The source is `06-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 (`environment: "node"`, no jsdom; `react` is not importable from tests) |
| **Config file** | `controller/vitest.config.mts` |
| **Quick run command** | `cd controller && npx vitest run test/toolOptions.parse.test.ts test/toolOptions.read.test.ts test/toolOptionsRouter.test.ts test/fieldOptions.test.ts test/staticScan.test.ts test/commandFields.test.ts test/latchStatus.test.ts test/toolPageReply.test.ts` |
| **Full suite command** | `cd controller && npx tsc --noEmit && npx vitest run && npx prettier . --check` |
| **Estimated runtime** | Quick run: about 5 s. Full suite: about 200 s (baseline 610 tests in 191 s). |

---

## Sampling Rate

- **After every task commit:** run the quick run command.
- **After every plan wave:** run `cd controller && npx tsc --noEmit && npx vitest run`.
- **Before `/gsd-verify-work`:** the full suite must pass. Also run `npm run build` once, and the STK-08 shell gate must pass.
- **Max feedback latency:** 10 seconds for the quick run.

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| DRP-01 | Every dropdown starts empty; nothing is preselected | unit + scan | `npx vitest run test/fieldOptions.test.ts test/staticScan.test.ts` | ❌ W0 | ⬜ pending |
| DRP-02 | A saved value the instrument no longer reports stays selected, marked "(not reported by instrument)" | unit | `npx vitest run test/fieldOptions.test.ts` | ❌ W0 | ⬜ pending |
| DRP-03 | A `{{var}}` binding disables the picker; a bound parent turns its children into typed inputs | unit | `npx vitest run test/fieldOptions.test.ts` | ❌ W0 | ⬜ pending |
| DRP-04 | Every failure case maps to `unavailable` | unit | `npx vitest run test/toolOptions.read.test.ts test/fieldOptions.test.ts` | ❌ W0 | ⬜ pending |
| DRP-05 | Children clear only from the parent's `onChange`; no `useEffect` drives a clear | unit + scan | `npx vitest run test/fieldOptions.test.ts test/staticScan.test.ts` | ❌ W0 | ⬜ pending |
| DRP-06 | Refresh skips the cache and sends `refresh: true` | unit | `npx vitest run test/toolOptions.read.test.ts` | ❌ W0 | ⬜ pending |
| DRP-07 | Source list is closed, every read has a deadline, replies are size-capped, `{{x}}` names are dropped, and nothing goes through the queue | unit + scan | `npx vitest run test/toolOptions.parse.test.ts test/toolOptions.read.test.ts test/toolOptionsRouter.test.ts test/staticScan.test.ts` | ❌ W0 | ⬜ pending |
| DRP-08 | The step details drawer reads lists only while `isEditing` | unit + scan | `npx vitest run test/fieldOptions.test.ts test/staticScan.test.ts` | ❌ W0 | ⬜ pending |
| DRP-09 | Saved params round-trip unchanged and the encoded bytes are identical | unit | `npx vitest run test/fieldOptions.test.ts test/wire.test.ts` | ❌ W0 | ⬜ pending |
| STK-01..06 | Each source's parser and field binding | unit | `npx vitest run test/toolOptions.parse.test.ts test/fieldOptions.test.ts` | ❌ W0 | ⬜ pending |
| STK-07 | Binding coverage; `commandFields.test.ts` is unchanged | unit | `npx vitest run test/fieldOptions.test.ts test/commandFields.test.ts` | partial | ⬜ pending |
| STK-08 | Submodule is pinned to `4ccd3da` and the regen shows no diff | shell gate | `git -C vendor/galago-tools rev-parse HEAD` plus `git diff --exit-code -- controller/gen-interfaces` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `controller/test/fixtures/stackOptions.ts`: fixtures copied from the adapter's goldens
- [ ] `controller/test/toolOptions.parse.test.ts`
- [ ] `controller/test/toolOptions.read.test.ts`
- [ ] `controller/test/toolOptionsRouter.test.ts`
- [ ] `controller/test/fieldOptions.test.ts`
- [ ] Extend `controller/test/staticScan.test.ts` with the D-17 scans

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The dropdowns render in the three hosts against a live or PAC-simulated STACK | DRP-01, DRP-08, STK-01..06 | Vitest can't render React, and a simulated STACK returns no `meta_data` | Open the tool page, `AddToolCommandModal` and the drawer in edit mode. Pick a value in each field. Check that Refresh and the "(not reported by instrument)" mark behave as specified. |
| Offline fallback in the UI | DRP-04 | It needs the rendered UI | Stop the STACK tool server and confirm each field shows a typed input and the hint. |

---

## Validation Sign-Off

- [ ] Every task has an `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers every MISSING reference
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
