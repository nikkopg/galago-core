---
phase: "1"
slug: "queue-control-path-run-state"
status: open
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 1
asvs_level: 1
created: "2026-10-13"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → galago-web tRPC | `commandQueue.toolControl` and `commandQueue.runState`, unauthenticated, the same as every existing commandQueue procedure on the LAN controller | Operator control action plus `"yes"`/`"no"` decisions in; run state out |
| galago-web → tool server (gRPC) | `Tool.controlCommand` (ExecuteCommand) and the status poll (GetStatus) to the running step's tool | Physical control commands out; `run_state` (state, percent, pause detail) in |
| Package registries → repo | vitest/vite-tsconfig-paths dev install and the ts-proto@1.151.1 scratch install | Third-party code |
| galago-tools fork → vendor submodule | Proto definitions pinned by gitlink | Generated wire interfaces |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-SC (01-01) | Tampering | npm installs (vitest, vite, vite-tsconfig-paths) | high | mitigate | Human-approved Set A; `--save-exact` pins in `controller/package.json`; lockfile committed (`99f4471`) | closed |
| T-01-SC (01-05) | Tampering | ts-proto@1.151.1 scratch install | high | mitigate | Human-approved; installed under a mktemp prefix outside the repo and never committed | closed |
| T-01-SC (01-02/03/04) | Tampering | Package installs | low | accept | No installs in these plans (`tech-stack.added: []`) | closed |
| T-01-01 | Tampering | app.db / queue.db during tests | medium | mitigate | `controller/test/setup.ts` sets `SQLITE_DB_PATH=":memory:"` and mocks `@/db/client`, `@/server/logger` and `@/logger`; `infra.test.ts` asserts the mocks | closed |
| T-01-02 | Denial of Service | Docker builder (node 22.11) | low | mitigate | vitest 2.1.9 engines are `^18 \|\| >=20`; the `test` script is unchanged | closed |
| T-01-03 | Elevation of Privilege | Decision validation | high | mitigate | `runControl.ts:108` uses strict `"yes"`/`"no"` with no default, trim or case-fold | closed |
| T-01-04 | Spoofing | toolControl target selection | high | mitigate | Target comes only from the `_runningStep` snapshot, and the zod input has no tool id. The step identity is re-checked before dispatch (WR-01, `62e505c`). The 261015-h0q dequeue also keys only off the snapshot's `step.queueId` | closed |
| T-01-05 | Tampering | Inherited-key lookups in runControl | medium | mitigate | `hasOwnProperty.call` at every lookup; tests cover `constructor`, `__proto__` and `toString` | closed |
| T-01-06 | Repudiation | Control audit trail | medium | mitigate | One `logAction` per attempt and outcome, with toolId, queueId, runId, action, decisions and outcome. The 261015-h0q paths log "Aborted Step Dequeued" / "Aborted Step Dequeue Failed" and annotate "Command Failed" | closed |
| T-01-07 | Tampering | Forwarding undeclared params | high | mitigate | Check (e) rejects undeclared keys; only `verdict.decisions` is forwarded | closed |
| T-01-08 | Denial of Service | Busy loop and modal state | high | mitigate | Modal state untouched (grep 0), and the busy-loop `fail(..., {dequeue})` path resets `_abortAcceptedQueueId` every iteration. **Gap (2026-10-15 re-audit after 261015-h0q):** `_recordAcceptedAbort`'s late-reply branch (`command_queue.ts:544`) calls `commands.dequeue(step.queueId)` unconditionally, and `gotoCommand`/`gotoCommandByIndex` re-queue the same `queue_id`, so a slow abort reply can delete a re-queued or re-running attempt's row. Untested | open |
| T-01-09 | Spoofing | Unauthenticated tRPC endpoint | medium | accept | See AR-01 | closed |
| T-01-10 | Repudiation | Duplicate sends after a transport error | medium | mitigate | Single attempt with no retry; a test asserts exactly one gRPC call | closed |
| T-01-11 | Information Disclosure | Refusal messages echo the decision value | low | accept | See AR-02 | closed |
| T-01-12 | Elevation of Privilege | Observation turning into a command | high | mitigate | The only RPC in the poller is `grpc.getStatus`; `runState` reads only the cache | closed |
| T-01-13 | Denial of Service | runState under N browser tabs | medium | mitigate | Cached snapshot and in-flight guard; the guard reset is generation-checked (WR-02, `42fd1af`) | closed |
| T-01-14 | Tampering | Malformed or hostile `run_state` | medium | mitigate | `extractRunState` uses plain-object and own-field checks inside try/catch, and returns status "unknown" | closed |
| T-01-15 | Spoofing | Stale poll showing the wrong step's state | medium | mitigate | A generation counter discards late results | closed |
| T-01-16 | Information Disclosure | Pause detail via an unauthenticated query | low | accept | See AR-03 | closed |
| T-01-17 | Denial of Service | Heartbeat stopping after one failure | medium | mitigate | `fetchStatus` never clears the interval; tested for fast and pf400 | closed |
| T-01-18 | Repudiation | Audit log flooded or silent during an outage | low | mitigate | One warning at the start of a streak and one info on recovery | closed |
| T-01-19 | Tampering | Submodule pinned to an unreviewed commit | high | mitigate | Pinned to the human-approved `cb7886d1f3bdcdeeee71c55996f0dd62cf49ba7f` | closed |
| T-01-20 | Tampering | Hand-edited generated code | medium | mitigate | Regenerated with the pinned plugin; the idempotence check leaves `git status` empty under `controller/gen-interfaces` | closed |
| T-01-21 | Tampering | Wire mismatch | medium | mitigate | `wire.test.ts` round-trips the control payloads and `run_state` through the generated codecs | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-09 | The app has no user or auth model. toolControl and runState have the same trust level as every existing commandQueue mutation on this LAN instrument controller. | Plan 01-02 threat model (auto planning); confirmed by the security auditor | 2026-10-13 |
| AR-02 | T-01-11 | The echoed value is the operator's yes/no input. It is not sensitive and helps diagnose UI bugs. | Plan 01-02 threat model | 2026-10-13 |
| AR-03 | T-01-16 | The pause detail is deck and plate information that the operator must see. It contains no secrets. | Plan 01-03 threat model | 2026-10-13 |

*Accepted risks do not resurface in future audit runs.*

Residual risk noted in UAT test 1 (accepted by the user on 2026-10-13): a control command sent while a step ends during the gRPC round trip can reach the next step on the same tool. The F.A.S.T. core's state gates are the protection, per D-04.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-13 | 24 | 24 | 0 | gsd-security-auditor (ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [ ] `threats_open: 0` confirmed (T-01-08 open since the 2026-10-15 re-audit)
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-13

## Security Audit 2026-10-15

| Metric | Count |
|---|---|
| Threats found | 24 |
| Closed | 23 |
| Open | 1 |
