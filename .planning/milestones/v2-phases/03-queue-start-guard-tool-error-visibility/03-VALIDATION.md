---
phase: "3"
slug: "queue-start-guard-tool-error-visibility"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-28"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 (`environment: "node"`, `test/setup.ts` mocks `logAction`) |
| **Config file** | `controller/vitest.config.ts` |
| **Quick run command** | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/<file>.test.ts` |
| **Full suite command** | `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npm run test:unit && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx tsc --noEmit` |
| **Estimated runtime** | ~52 s suite + ~12 s tsc (baseline 14 files / 244 tests green at `e2a93d6`) |

New queue-level tests use `vi.useFakeTimers({ toFake: ["setTimeout"] })` + `advanceTimersByTimeAsync(1500)` so they run in milliseconds.

---

## Sampling Rate

- **After every task commit:** run the touched test file's quick command; `npx tsc --noEmit` after any type-touching task
- **After every plan wave:** full suite command
- **Before `/gsd-verify-work`:** full suite green, and `git diff --stat -- controller/test/toolControl.test.ts controller/test/sqliteQueue.test.ts controller/test/queueRestart.test.ts` is empty (QUE-09)
- **Max feedback latency:** 70 seconds

---

## Per-Task Verification Map

Task IDs are filled in by the planner; requirement → test mapping is fixed here.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| QUE-07 | Second / same-tick `_start()` while in flight: one `executeCommand`, state BUSY, one "Queue Started", "Queue Start Ignored" warning | integration | `npx vitest run test/queueStartGuard.test.ts` | ✅ | ✅ green |
| QUE-07 | `_start` guard first, no `await` before claim | static scan | `npx vitest run test/staticScan.test.ts` | extend | ✅ green |
| QUE-08 | `summarizeQueuedStart` counts (rows, FAILED, distinct runs, empty) | unit | `npx vitest run test/queuedStartSummary.test.ts` | ✅ | ✅ green |
| QUE-08 | "Queue Started" details list queue_ids/run_ids; absent when ignored | integration | `npx vitest run test/queueStartGuard.test.ts` | ✅ | ✅ green |
| QUE-08 | Run modal: no timers/autoFocus/defaultValue/form, keeps warning text, uses summary | static scan | `npx vitest run test/staticScan.test.ts` | extend | ✅ green |
| QUE-09 | Retry, h0q, o44, t9e unchanged (files unmodified) | existing | `npx vitest run test/toolControl.test.ts test/sqliteQueue.test.ts test/queueRestart.test.ts` | ✅ | ✅ green |
| QUE-09 | Recipe A: FAILED retry then leftover CREATED row, in order | integration | `npx vitest run test/queueStartGuard.test.ts` | ✅ | ✅ green |
| ERR-01 | Table over every `ResponseCode` + SUCCESS-with-message pinning getError, stored row error, logs, instance codeString — committed red first | integration | `npx vitest run test/errorPath.test.ts` | ✅ | ✅ green |
| ERR-02 | `describeToolReply` wording; tool text kept; `codeString === String(code)` | unit | `npx vitest run test/errorPath.test.ts` | ✅ | ✅ green |
| ERR-03 | `stepErrorText` (FAILED, SKIPPED+error, stale error on COMPLETED ignored) | unit | `npx vitest run test/queueError.test.ts` | ✅ | ✅ green |
| ERR-03 | Card renders `stepErrorText` with wrapping text | static scan | `npx vitest run test/staticScan.test.ts` | extend | ✅ green |
| ERR-04 | `seq` increases per failure, single `this.error =` failure site; `shouldShowErrorBanner` re-arms | integration + unit + scan | `npx vitest run test/errorPath.test.ts test/queueError.test.ts test/staticScan.test.ts` | ✅ | ✅ green |
| ERR-05 | `describeQueueError` never empty / never SUCCESS; `deriveRunOutcome` skipped-with-error ≠ COMPLETED; check icon COMPLETED-only | unit + scan | `npx vitest run test/queueError.test.ts test/runOutcome.test.ts test/staticScan.test.ts` | ✅ | ✅ green |

*Status: ✅ green · ✅ green · ❌ red · ⚠️ flaky*

**Task mapping (filled by the planner):**

| Requirement / behaviour | Plan-Task |
|-------------------------|-----------|
| QUE-07 second / same-tick / pause-then-start / enqueue `_start` | 03-01-T1 (tracer) |
| QUE-07 `_start` guard-first, no await before claim (static scan) | 03-04-T2 |
| QUE-08 "Queue Started" listing, recipe A, cap 50, enqueue prefix | 03-01-T2 |
| QUE-08 `summarizeQueuedStart` / `queuedStartLines` | 03-03-T1 |
| QUE-08 Run modal wiring + UI-08 scan | 03-03-T2 |
| QUE-09 protected files unmodified + green | 03-01-T1, 03-01-T2, 03-04-T2, 03-06-T3 |
| ERR-01 table committed red (D-10) | 03-02-T1, 03-02-T2; turns green in 03-04-T2 |
| ERR-02 `describeToolReply`, `codeString = String(code)` | 03-04-T1 |
| ERR-04 `_recordFailure` / `seq` / plain getError payload + scans | 03-04-T2 |
| ERR-04 `shouldShowErrorBanner` / banner wiring | 03-06-T1, 03-06-T2 |
| ERR-03 `stepErrorText` + persistence + card wiring | 03-06-T1, 03-06-T2 |
| ERR-05 SUCCESS+message is ERROR_FROM_TOOL | 03-04-T1 |
| ERR-05 `deriveRunOutcome` / badge / progress colour | 03-05-T1, 03-05-T2 |
| ERR-05 check icon COMPLETED-only, outcome never green/teal (scans) | 03-06-T3 |

Wave-1 full-suite gate runs with `--exclude test/errorPath.test.ts` (red by design until 03-04).

---

## Wave 0 Requirements

- [x] `controller/test/errorPath.test.ts` — ERR-01/02/04/05 (red first, D-10)
- [x] `controller/test/queueStartGuard.test.ts` — QUE-07/08/09 (recipes D, same-tick, A)
- [x] `controller/test/queueError.test.ts`, `controller/test/queuedStartSummary.test.ts`, `controller/test/runOutcome.test.ts` — pure helpers
- [x] `controller/test/staticScan.test.ts` — new `it` blocks only
- Framework install: none

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rendered Run confirmation summary, banner re-arm, step-card error text, run outcome badge | QUE-08, ERR-03, ERR-04, ERR-05 | No jsdom/RTL by project decision; rendered behaviour goes to UAT | In galago-web with a fake/simulated tool: queue a failing step, Run, dismiss banner, fail again; check card text and run badge after Skip |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 70s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-29 (validate-phase: 8/8 requirements COVERED, 197/197 phase tests green, full suite 428/428)

## Validation Audit 2026-10-28

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
