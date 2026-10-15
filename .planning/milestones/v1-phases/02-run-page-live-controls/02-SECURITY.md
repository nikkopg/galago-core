---
phase: "2"
slug: "run-page-live-controls"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-14"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Operator → run page / tool page UI | Every Pause/Resume/Abort, Stop, Clear All and run delete during a controllable step passes through the shared confirmation dialog; nothing is sent without a completed operator choice | Physical decisions (`is_tip_broken`, `return_liquid`) as `"yes"`/`"no"` |
| Browser → galago-web tRPC | `commandQueue.toolControl`, `commandQueue.runState`, new `tool.recoveryControl`; unauthenticated, same as every existing procedure on the LAN controller | Control action plus decisions in; run state and refusal text out |
| galago-web → tool server (gRPC) | `Tool.controlCommand` from `toolControl` and `recoveryControl` only; no deadline | Physical control commands out; tool replies in |
| Instrument → operator UI | Pause reason and detail (`eventPayload`) rendered in the `tool_paused` prompt | Untrusted instrument-supplied text and JSON |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-SC | Tampering | npm/pip/cargo installs | low | accept | No packages installed this phase (D-24); `controller/package.json` last changed in `99f4471`, before Phase 2 — see AR-02-01 | closed |
| T-02-01 | Elevation of Privilege | Confirm-modal decision state making a physical decision | high | mitigate | `controlDecision.ts` `emptyDecisions`/`completeDecisions`; `RunControlConfirmModal.tsx` empty start, `value ?? ""`, initial focus on Cancel; test "completeDecisions returns null until complete" | closed |
| T-02-02 | Tampering | Double-click sending two commands | high | mitigate | `createConfirmedSender` in-flight gate; Confirm `isLoading`; test "ignores a second send while the first is in flight" | closed |
| T-02-03 | Repudiation | Refusal or transport error not seen by the operator | medium | mitigate | `persistentErrorToast` (`duration: null`, closable) with the message verbatim; no retry | closed |
| T-02-04 | Spoofing | Optimistic UI showing a refused action as done | medium | mitigate | `ControlBar.tsx` badge/progress derived only from the polled envelope | closed |
| T-02-05 | Information Disclosure | Server modules pulled into the client bundle | low | mitigate | Client imports of `@/server/runState` are `import type`; `runControl.ts` has zero imports | closed |
| T-02-06 | Tampering | Confirm for one step sent to the next step | medium | mitigate | `confirmStillValid` closes stale confirms on `queueId` change or step end (`ControlBar.tsx`, `InstrumentStopModal.tsx`) | closed |
| T-02-07 | Tampering | `tool_paused` routed through the queue's UIMessage resolve path | high | mitigate | `pausePrompt.ts` reads only the run-state envelope; static scan "the pause prompt stays out of the queue's modal plumbing" | closed |
| T-02-08 | Information Disclosure | Instrument detail rendered as HTML | medium | mitigate | `ToolPausedModal.tsx` uses React text children and `<pre>` for raw JSON; no `dangerouslySetInnerHTML` | closed |
| T-02-09 | Repudiation | Pause reason/detail silently dropped | medium | mitigate | `describePauseDetail` never returns empty for non-null detail; falls back to pretty JSON | closed |
| T-02-10 | Tampering | Stale pause-episode confirm sending Resume | medium | mitigate | `reducePausePrompt` reports `closedBy`; `ControlBar.tsx` closes the prompt-origin confirm with the nothing-sent toast | closed |
| T-02-11 | Denial of Service | Stop/Clear All/delete orphaning a running instrument step | high | mitigate | `shouldInterceptQueueStop` gates Pause queue and Clear All; `runAfterAccepted`; test "aborts before stopping" | closed |
| T-02-12 | Elevation of Privilege | Countdown auto-confirm making the decision | high | mitigate | `InstrumentStopModal.tsx` wraps the no-timer modal; static scans "no timers in the control UI" and "the countdown stop modal is not reused" | closed |
| T-02-13 | Tampering | Queue stopped/cleared after a refused abort | high | mitigate | `runAfterAccepted` runs the follow-up only on `accepted`; test "a refused abort never stops the queue" | closed |
| T-02-14 | Denial of Service | Deleting an unrelated run forcing an abort | low | mitigate | `shouldInterceptRunDelete` scoped to the running step's `runId` | closed |
| T-02-15 | Elevation of Privilege | `recoveryControl` bypassing the run page for a tracked tool | high | mitigate | `server/recoveryControl.ts` check (b) refuses `PRECONDITION_FAILED`; test "refuses a tool tracked by a running step" | closed |
| T-02-16 | Tampering | Recovery Pause, undeclared actions or extra params | high | mitigate | Check (a) restricts to resume/abort; `validateControlRequest` checks (d)/(e); refusal-matrix tests | closed |
| T-02-17 | Repudiation | Unaudited recovery attempts | medium | mitigate | Exactly one `logAction` per attempt outcome; logging tests | closed |
| T-02-18 | Spoofing | Unauthenticated tRPC endpoint | medium | accept | See AR-02-02 | closed |
| T-02-19 | Denial of Service | Recovery Resume pending until the resumed run ends | low | accept | See AR-02-03 | closed |
| T-02-20 | Tampering | Step starting between check (b) and the send | low | accept | See AR-02-04 | closed |
| T-02-21 | Tampering | Legacy saved fast abort/resume steps running via the step path | low | accept | See AR-02-05 | closed |
| T-02-22 | Denial of Service | Recovery controls hidden after a restart (Pitfall 10) | high | mitigate | `shouldShowRecoverySection` keys on tool type only; `pages/tools/[id].tsx` renders it independent of run state | closed |
| T-02-23 | Elevation of Privilege | Recovery used on a tracked tool | medium | mitigate | `RunRecoverySection.tsx` disables via `isToolTrackedByRunningStep`; server refusal per T-02-15 | closed |
| T-02-24 | Repudiation | Close-on-dispatch hiding the outcome | low | mitigate | Pending spinner on the card; settled result via success or persistent error toast | closed |
| T-02-25 | Elevation of Privilege | A new code path sending without a confirmed choice | high | mitigate | `staticScan.test.ts` "single confirmed send path" (exact file lists) | closed |
| T-02-26 | Tampering | Timer, countdown reuse, Enter default or state check reintroduced | high | mitigate | `staticScan.test.ts` "safety invariants" | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-SC | No packages were installed in any Phase 2 plan (D-24: no new UI test dependencies); corroborated by `git log -- controller/package.json` | Phase 2 plans (gsd-planner), verified by gsd-security-auditor | 2026-10-14 |
| AR-02-02 | T-02-18 | The app has no user or auth model; `tool.recoveryControl` has the same trust level as the existing `tool.runCommand` mutation on this LAN-only controller | Phase 2 plan 02-04 (gsd-planner) | 2026-10-14 |
| AR-02-03 | T-02-19 | By design (D-23, design §5.1): a crash-recovery Resume has no deadline so the instrument run is never cut off; the tool page stays usable while it is pending | Phase 2 plan 02-04 (gsd-planner) | 2026-10-14 |
| AR-02-04 | T-02-20 | Same residual race accepted in Phase 1 UAT; the F.A.S.T. core's state gates refuse an invalid transition and galago-core adds no instrument-state check (D-04) | Phase 2 plan 02-04 (gsd-planner); Phase 1 UAT | 2026-10-14 |
| AR-02-05 | T-02-21 | D-20 decides no migration; legacy steps are operator-authored and run only when the operator runs that protocol; new protocols can no longer add them | Phase 2 plan 02-04 (gsd-planner) | 2026-10-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-14 | 27 | 27 | 0 | gsd-security-auditor (22 mitigations verified) + accepted-risk log (5) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-14
