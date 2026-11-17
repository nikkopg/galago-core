---
phase: "08"
slug: "concurrency-lanes"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-16"
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Operator / protocol author → stored protocol | Visual drawer and script API write `advancedParameters.lane` / `laneBarrier` | Untrusted lane tags that decide what may run concurrently |
| Protocol → run creation / enqueue | `createFromProtocol` (tRPC `run.create` and `POST /api/runs`) and `enqueueRun` validate lanes | Lane setup that becomes dispatch order |
| Command queue → tool servers (gRPC) | Lane workers dispatch steps and `toolControl` sends pause/resume/abort | Motion commands; a double send or lost control is a physical-safety issue |
| Deployment env → queue | `GALAGO_PARALLEL_LANES` read once at construction | Process-wide mode switch, default off |
| Controller server → browser | `laneStatus` payload, failure list, lane rows and warnings rendered on run page / editor | Tool error text and lane names rendered in UI |
| Browser → controller (unauthenticated router) | `freezeLanes` mutation | Can only close the dispatch gate |

---

## Threat Register

All mitigations verified in the current tree by gsd-security-auditor (evidence with file:line and test names in the audit run of 2026-11-16).

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Tampering | Golden flag-off fixture | high | mitigate | Captured at 0c1e06e before any production edit; unchanged since 2da2ad7; `GOLDEN_WRITE` refused in test | closed |
| T-08-02 | Tampering (hardware) | Test harness | high | mitigate | DB proxy throws; `installFakeTool` replaces gRPC with stubs | closed |
| T-08-03 | Tampering | Tool Box on side lane | high | mitigate | `laneOf` forces primary; `validateLanes` refuses at creation and enqueue | closed |
| T-08-04 | Denial of Service | Lane count / names | medium | mitigate | Max 4 lanes, `/^[a-z0-9_-]{1,32}$/` | closed |
| T-08-05 | Tampering (hardware) | Double dispatch on one tool | high | mitigate | Only CREATED/FAILED eligible; STARTED row blocks its lane; in-memory busy-tool set | closed |
| T-08-06 | Tampering (hardware) | Double claim | high | mitigate | Synchronous `SqliteQueue.claimEligible` re-checks membership and status | closed |
| T-08-07 | Denial of Service | Run-state poller | high | mitigate | `RunStateMonitor.stopIf(queueId)` | closed |
| T-08-08 | Tampering (hardware) | Same-tick double Start | high | mitigate | Per-lane loop guard, no await before claim | closed |
| T-08-09 | Tampering | Lane-mode flag read | medium | mitigate | Single strict `=== "1"` env read in constructor | closed |
| T-08-10 | Repudiation / Tampering | New log lines | medium | mitigate | `sanitizeLogText` on lane-derived log lines | closed |
| T-08-11 | Denial of Service | Side worker stopping all lanes | high | mitigate | Only the primary loop calls `stop()`; side drain returns WAIT | closed |
| T-08-12 | Tampering (hardware) | Halt window | high | mitigate | `_latchFailure` first statement of every catch; gate read in same turn as claim | closed |
| T-08-13 | Elevation | Silent un-halt | high | mitigate | Latch cleared only in operator `_startLanes`; resume/clearError/clearAll/enqueue leave it | closed |
| T-08-14 | Spoofing / Denial of Service | `freezeLanes` without auth | low | accept | See Accepted Risks | closed |
| T-08-15 | Denial of Service | Failure list size | low | mitigate | Cap 8 + overflow count | closed |
| T-08-16 | Information Disclosure | `laneStatus` payload | medium | mitigate | Messages only, no stack; `getError` payload unchanged | closed |
| T-08-17 | Tampering (hardware) | `toolControl` target | high | mitigate | `_controlTarget` from in-memory running steps; identity gate before single send | closed |
| T-08-18 | Tampering | Abort marker overwritten by another lane | high | mitigate | Side markers keyed by queueId | closed |
| T-08-19 | Tampering (hardware) | `goto` resetting a STARTED side row | high | mitigate | Goto refused while a side step runs; Tool Box goto refused in laned runs (D-23) | closed |
| T-08-20 | Elevation | STACK acknowledge while STACK runs on a side lane | high | mitigate | `runningStepFor(record.name)` covers every lane | closed |
| T-08-21 | Denial of Service | Poller stopped by another lane | high | mitigate | Monitor only for controllable steps, ended with `stopIf` | closed |
| T-08-22 | Tampering | `POST /api/runs` bypassing validation | high | mitigate | Validation in shared `createFromProtocol` + `enqueueRun` re-validation | closed |
| T-08-23 | Elevation | Error classified by class identity | medium | mitigate | `isLaneValidationError` name guard; no `instanceof` | closed |
| T-08-24 | Tampering | Sticky script lane on Tool Box helpers | medium | mitigate | Tool Box helpers skip `currentLane` | closed |
| T-08-25 | Repudiation | Log injection via lane names / refusal text | low | mitigate | Sanitised log details; pattern-bounded names | closed |
| T-08-26 | Tampering (XSS) | Helper output | medium | mitigate | Plain strings only; no HTML sinks | closed |
| T-08-27 | Tampering | Stored protocol data via helpers | medium | mitigate | `setLane`/`setBarrier` delete keys, never write blank/false | closed |
| T-08-28 | Repudiation | Start confirmation naming steps | low | mitigate | Every queued step listed per lane, no truncation | closed |
| T-08-29 | Tampering | Double / accidental Freeze | medium | mitigate | AlertDialog, `leastDestructiveRef` on "Keep lanes running", disabled while pending | closed |
| T-08-30 | Tampering (XSS) | Failure list, panel, lane rows | medium | mitigate | React text only; no `dangerouslySetInnerHTML` | closed |
| T-08-31 | Tampering | Freeze in ControlBar plumbing | medium | mitigate | Separate `LanesPanel`; static pins | closed |
| T-08-32 | Spoofing | Stale frozen state after failed read | low | mitigate | Panel renders only on successful read | closed |
| T-08-33 | Tampering | Drawer rewriting stored data | medium | mitigate | Edits only via `setLane`/`setBarrier` | closed |
| T-08-34 | Tampering (XSS) | Lane names / warnings in summary | medium | mitigate | React text only | closed |
| T-08-35 | Tampering | Author bypassing client warnings | low | accept | See Accepted Risks | closed |
| T-08-SC | Tampering | Package installs (all 10 plans) | high | mitigate | No dependency manifest changed since 0c1e06e | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Informational (non-blocking, not counted)
- T-08-10 residual: `_failStart` "Queue failed to start" and the all-lanes-busy "Queue Start Ignored" strings are relocated legacy strings not wrapped in `sanitizeLogText`; the primary "Command Failed" line stays unwrapped to keep the flag-off golden byte-identical. Cheap hardening candidate.
- T-08-32 adjacency: `QueueStatuscomponent.tsx` derives `laneFrozen` from `laneStatusQuery.data` without `isSuccess`, so after a failed re-read the Start confirmation may show one stale caption line. Copy only; no control enabled.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-14 | The command-queue router is unauthenticated by design (consistent with every other mutation there). `freezeLanes` can only close the dispatch gate: it throws when the flag is off, never clears a latch, aborts and sends nothing, reads no instrument state, and an unwanted freeze is released by the operator's Start. Residual risk is safe-direction nuisance on the LAN control plane. | plan 08-05 threat model; confirmed by gsd-security-auditor | 2026-11-16 |
| AR-08-02 | T-08-35 | Client lane warnings are advisory; the server refuses invalid setups at run creation and enqueue, and `laneOf` forces Tool Box steps to primary at dispatch, so bypassing the client gains nothing. | plan 08-10 threat model; confirmed by gsd-security-auditor | 2026-11-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-16 | 36 (35 + T-08-SC across 10 plans) | 36 | 0 | gsd-security-auditor (L1, block_on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-16
