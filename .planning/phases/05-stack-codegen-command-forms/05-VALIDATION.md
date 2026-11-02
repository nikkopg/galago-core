---
phase: "5"
slug: "stack-codegen-command-forms"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| 05-01-01 | 01 | 1 | GEN-01 | T-05-03 | Frozen-proto gate verified at bcbbf8e (guid/arm_inspected/latch key); pinned toolchain provisioned | gate (git show + toolchain) | `git -C vendor/galago-tools show bcbbf8e:interfaces/tools/grpc_interfaces/stack.proto \| grep -q 'optional string guid = 1'` (plus arm_inspected + get_failure_latch greps, see 05-01 Task 1) | ✅ | ✅ green (re-checked live 2026-11-02: proto grep hits) |
| 05-01-02 | 01 | 1 | GEN-01 | T-05-01 | Submodule at frozen commit; regen via pinned 1.151.1 plugin; gates green | build + gate | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx tsc --noEmit` then `npx vitest run` then `npx prettier . --check` | ✅ | ✅ green (tsc 0 errors + vitest 608/608 + prettier clean at phase verification) |
| 05-01-03 | 01 | 1 | GEN-02, GEN-04 | T-05-02 | commandFields.stack: 9 commands, no defaults, no select, no ack; scan flipped same-commit; LATCH_READ_COMMAND renamed + wire-pinned; ack payload survives real encoder | unit + static scan + wire | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/commandFields.test.ts test/staticScan.test.ts test/stackActivation.test.ts test/wire.test.ts test/latchStatus.test.ts` | ✅ | ✅ green (162/162 across the 11 map files, 2026-11-02) |
| 05-02-01 | 02 | 1 | GEN-03 | T-05-04 | One shared bounded raw-JSON display; RunRecoverySection unchanged through it | unit + static scan | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/boundedRawJson.test.ts test/staticScan.test.ts` | ✅ | ✅ green |
| 05-02-02 | 02 | 1 | GEN-03 | T-05-04 / T-05-05 | Reply panel display-only, born hidden, no timers/polling, one panel per send | static scan | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/toolPageReply.test.ts` | ✅ | ✅ green |
| 05-02-03 | 02 | 1 | GEN-02 | — | Born-empty display; omitBlankParams drops blanks, keeps 0/false; fast params untouched | unit | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/commandParams.test.ts` | ✅ | ✅ green (12/12 incl. post-bf928c0) |
| 05-03-01 | 03 | 2 | GEN-04 | T-05-06 | 7 cast retrofits; real-enum operator-only refusal with zero grpc sends | unit | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/operatorOnly.test.ts test/latchStatus.test.ts test/recoveryControl.test.ts` | ✅ | ✅ green (also in the 444/444 prior-phase regression gate) |
| 05-03-02 | 03 | 2 | GEN-02 | T-05-07 | getToolConfigDefinition(stack) 4-key default; commandFields sweeps; zToolCreate accepts stack | unit | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/tools.test.ts test/commandFields.test.ts test/stackActivation.test.ts` | ✅ (extends) | ✅ green |
| 05-03-03 | 03 | 2 | GEN-04 | — | Blank-optional wire pin (stripped absent vs unstripped present) + full phase gate | wire + gate | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/wire.test.ts` then `npx tsc --noEmit` + `npm run test:unit` + `npx prettier . --check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — the planner fills the real task IDs/commands per plan; rows above are seed anchors from the phase requirements and prior-phase proven verify commands.*

---

## Wave 0 Requirements

- [x] Regen-first tracer: submodule bump + `bin/make proto_ts` with ts-proto 1.151.1 must land before any plan that imports generated stack types — **planned as 05-01 Task 2 (wave 1, tracer)**
- [x] `test/staticScan.test.ts` OPR-05 assertions updated in the same commit that adds `commandFields.stack` (research Pitfall 1) — **planned as 05-01 Task 3 (same-commit rule in its acceptance criteria)**

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| STACK tool page Config (host/port) saves and persists | GEN-02 | UI save flow against a running galago-web + tool server is not unit-testable without jsdom (D-24) | Open a STACK tool page, edit host/port, save, reload, confirm values persist | ✅ Live-verified 2026-11-02 — UAT Test 1 passed (user: `pass`); DB row config corroborated at the data layer |
| Command form submits a STACK read and shows `meta_data` reply | GEN-02/03 | Requires a live (or simulated) tool server round trip through the tool page | Run a read from the tool-page command panel; confirm the bounded raw-JSON block shows the reply | ✅ Live-verified 2026-11-02 — UAT Test 2 passed (born hidden / panel after send / replace behavior); `get_manager_state` round trip corroborated by server logs |
| Creating a STACK tool through the add flow persists a tool row of type `stack` | GEN-04 | The tRPC add flow writes a DB row through the running tool server; in-memory workcell seeding is not proven harness territory | Use the tool add flow (NewToolModal) to create a tool of type STACK; confirm it appears in the tool list as type stack and survives a page reload | ✅ Live-verified 2026-11-02 — user created the "Stack" tool through NewToolModal; it appears in the tool list (type stack, DB id 11) and survived container recreate + page reload |
| Born-empty display: untouched STACK fields render empty; typed `0`/`false` render as typed | GEN-02 | Field rendering is page UI — the repo has no jsdom/RTL harness | Open a STACK tool page command panel without typing: no field shows a painted 0 or painted false; type 0 into a number field and false into a boolean field and confirm both render as typed | ✅ Live-verified 2026-11-02 — UAT Test 3 pass (harness + user), plus typed-then-cleared behavior in Test 4 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-11-02 (validate-phase audit: 0 gaps — 9/9 automated rows green, 4/4 manual-only items live-verified during UAT)

## Validation Audit 2026-11-02

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
