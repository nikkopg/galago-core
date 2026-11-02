---
phase: "5"
slug: "stack-codegen-command-forms"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-02"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 (server unit suite, no jsdom/RTL) |
| **Config file** | `controller/vitest.config.ts` (existing) |
| **Quick run command** | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/<file>.test.ts` |
| **Full suite command** | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npm run test:unit` (plus `npx tsc --noEmit` and `npx prettier . --check` as the phase gate; `bin/make test` runs all) |
| **Estimated runtime** | ~60–120 seconds full suite (busy-loop tests sleep 1.5 s/iteration — use 15–30 s test timeouts) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command scoped to the task's touched test files
- **After every plan wave:** Run the full suite command + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | GEN-01 | T-{N}-SC / — | Submodule at frozen stack.proto commit; regen green | build + gate | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx tsc --noEmit` | ✅ | ⬜ pending |
| {N}-0X-XX | XX | X | GEN-02 | T-{N}-SC / — | commandFields.stack: no defaults, no select, no acknowledge_failure | unit + static scan | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/commandFields.test.ts test/staticScan.test.ts` | ✅ | ⬜ pending |
| {N}-0X-XX | XX | X | GEN-04 | T-{N}-SC / — | Ack payload survives real encoder; latch oneof key pinned; refusal on ToolType.stack | unit (wire) | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/wire.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — the planner fills the real task IDs/commands per plan; rows above are seed anchors from the phase requirements and prior-phase proven verify commands.*

---

## Wave 0 Requirements

- [ ] Regen-first tracer: submodule bump + `bin/make proto_ts` with ts-proto 1.151.1 must land before any plan that imports generated stack types
- [ ] `test/staticScan.test.ts` OPR-05 assertions updated in the same commit that adds `commandFields.stack` (research Pitfall 1)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| STACK tool page Config (host/port) saves and persists | GEN-02 | UI save flow against a running galago-web + tool server is not unit-testable without jsdom (D-24) | Open a STACK tool page, edit host/port, save, reload, confirm values persist |
| Command form submits a STACK read and shows `meta_data` reply | GEN-02/03 | Requires a live (or simulated) tool server round trip through the tool page | Run a read from the tool-page command panel; confirm the bounded raw-JSON block shows the reply |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
