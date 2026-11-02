---
phase: "3"
slug: "queue-start-guard-tool-error-visibility"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-29"
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (`<threat_model>` in 03-01..03-06-PLAN.md); verified at ASVS L1 (grep depth).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → tRPC (`commandQueue.restart`, `getError`, `commands`) | galago-web has no authentication; any local client can call these | Queue control intent; error payloads (tool text, code, stack) |
| Tool gRPC reply → queue | Tool-supplied `error_message` and response code enter the server | Untrusted text, rendered later in the UI |
| Queue (SQLite) → run page | Stored row errors and statuses rendered on step cards and run rows | Tool text, row status |
| Tests → instrument | Tests must never reach a real tool | None (FakeGrpc only) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | `CommandQueue._start` re-entry | high | mitigate | `if (this._runningPromise)` early return is the first statement of `_start` (`server/command_queue.ts`), audited "Queue Start Ignored"; recipe D + same-tick tests in `test/queueStartGuard.test.ts` | closed |
| T-03-02 | Repudiation | Ignored / multi-row Starts unexplained | medium | mitigate | "Queue Start Ignored" with source and in-flight queue id; "Queue Started" lists rows (`server/queueStartListing.ts`) | closed |
| T-03-03 | Denial of Service | Unbounded "Queue Started" details | low | mitigate | `MAX_LISTED_QUEUE_ROWS = 50` in `server/queueStartListing.ts`, unit-tested | closed |
| T-03-04 | Tampering | Retry-after-failure changed by the guard | high | mitigate | `git diff --stat 5726822` of toolControl/sqliteQueue/queueRestart tests is empty; suites green | closed |
| T-03-05 | Tampering | errorPath test reaching real gRPC | high | mitigate | `installFakeTool` (FakeGrpc) in `test/errorPath.test.ts` | closed |
| T-03-06 | Repudiation | Red test weakened to pass | medium | mitigate | No `.skip/.todo/.only/.fails` in `test/errorPath.test.ts`; file history only `test(03-02)` commits | closed |
| T-03-07 | Spoofing | Run confirmation auto-confirms or pre-selects | high | mitigate | UI-08 static scan in `test/staticScan.test.ts` (no timers/autoFocus/defaults/form) | closed |
| T-03-08 | Tampering | Summary over-counts dequeued FAILED rows | medium | mitigate | `commandQueue.commands.useQuery(` in `QueueStatuscomponent.tsx`, scan-pinned | closed |
| T-03-09 | Tampering | Tool/run text injected into the modal | low | accept | Counts and fixed copy only; React escapes Text | closed |
| T-03-10 | Spoofing | SUCCESS+message labelled SUCCESS | high | mitigate | `describeToolReply` maps it to `ERROR_FROM_TOOL` (`server/toolReply.ts`); toolReply + errorPath tests | closed |
| T-03-11 | Repudiation | Tool text dropped for generic codes | medium | mitigate | " Tool said: " appended in `server/toolReply.ts`; `getError` no longer rewrites | closed |
| T-03-12 | Tampering | Failure site bypasses seq | medium | mitigate | Single `this.error = error` inside `_recordFailure` with `_failureSeq += 1`; static scan | closed |
| T-03-13 | Information Disclosure | `getError` returns `stack` | low | accept | Pre-existing; local lab app without auth | closed |
| T-03-14 | Denial of Service | Very long tool text in a log row | low | accept | Requirement forbids truncating tool text | closed |
| T-03-15 | Spoofing | Skipped-failure run shown as success | high | mitigate | `COMPLETED_WITH_SKIPPED_FAILURE` in `components/runs/runOutcome.ts`; orange badge/progress; tests + scan | closed |
| T-03-16 | Tampering | Widening persisted RunStatus | medium | mitigate | `types/run.ts` unchanged vs 5726822 | closed |
| T-03-17 | Spoofing | FAILED run derived COMPLETED | medium | mitigate | FAILED precedence in `deriveRunOutcome`, unit-tested | closed |
| T-03-18 | Tampering | Tool text injected as markup | medium | mitigate | React children only; no `dangerouslySetInnerHTML` in touched files (scan) | closed |
| T-03-19 | Repudiation | Dismissed banner hides later failures | high | mitigate | `dismissedSeq` + `shouldShowErrorBanner` in `RunsComponent.tsx`; `isErrorVisible` removed; unit tests | closed |
| T-03-20 | Elevation of Privilege | Dismiss becomes automatic recovery | high | mitigate | Close button only calls `setDismissedSeq`; scan forbids clearError/restart/mutate in the banner | closed |
| T-03-21 | Spoofing | Stale error / FAILED card shown completed | low | mitigate | `stepErrorText` returns null except FAILED/SKIPPED; single `<CheckCircle` under COMPLETED (scan) | closed |
| T-03-SC | Tampering | Package installs | low | accept | No package installed by any Phase 3 plan | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-09 | Modal renders counts and fixed copy only; no row text interpolated | plan 03-03 (planner, --auto) | 2026-10-28 |
| AR-03-02 | T-03-13 | `stack` already returned before this phase; local lab app, no auth project-wide | plan 03-04 (planner, --auto) | 2026-10-28 |
| AR-03-03 | T-03-14 | Tool text must not be truncated (ERR-02); one details field per entry as today | plan 03-04 (planner, --auto) | 2026-10-28 |
| AR-03-04 | T-03-SC | No package installed by this phase | plans 03-01..03-06 | 2026-10-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-29 | 22 | 22 | 0 | secure-phase (orchestrator, L1 grep verification, auditor skipped by short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-29
