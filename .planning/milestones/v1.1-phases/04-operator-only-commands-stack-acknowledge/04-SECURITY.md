---
phase: "04"
slug: "operator-only-commands-stack-acknowledge"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-30"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (04-01 … 04-07 `<threat_model>` blocks); verified at ASVS L1 (grep depth + passing pinned tests).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser -> tRPC `tool.recoveryControl` | Unauthenticated operator action; params arrive as `z.record(z.unknown())`, so the server validator is the gate | Recovery action + params (arm_inspected, guid) — physical-decision data |
| recoveryControl -> physical tool (gRPC controlCommand) | An accepted acknowledge clears a STACK failure latch; must never auto-retry | Acknowledge command |
| protocol JSON / script / REST -> RunStore.createFromProtocol | Untrusted step data (claimed toolType) | Protocol steps |
| SQLite rows -> busy loop -> Tool.executeCommand | Stale rows may carry operator-only steps | Queued commands |
| shared modal / card (code) -> physical decision | A UI default, timer or Enter-binding could send an unchosen acknowledge | Operator choice |
| galago-tools adapter reply (meta_data) -> card display | Unknown/abusive latch reply shape, any size | Display-only latch data |
| client -> tRPC run.create | Untrusted protocolId/parameters; response code/message shown to operator | Run creation request, refusal text |
| future edits -> source invariants | Static scans are the defence against refactor drift | Source code |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | `validateRecoveryRequest` | high | mitigate | `server/recoveryActions.ts:118` fail-closed validator; exact "yes"; guid regex `:89`; tests `test/recoveryActions.test.ts`, `test/recoveryControl.test.ts` | closed |
| T-04-02 | Repudiation | Ack attempts audit trail | medium | mitigate | 6 `logAction` outcome lines in `server/recoveryControl.ts` (46/64/76/93/123/139) | closed |
| T-04-03 | Tampering | Spoofed SUCCESS ack | medium | mitigate | `RECOVERY_STRICT_SUCCESS` (`server/recoveryActions.ts:198`) applied in `server/recoveryControl.ts:117-120` | closed |
| T-04-04 | Elevation of Privilege | Operator-only cmds via script/JSON/queue | critical | mitigate | Execute guard `server/tools.ts:416` + enqueue guard `server/runs.ts:229`; `test/operatorOnly.test.ts`; placement pinned in `test/staticScan.test.ts` | closed |
| T-04-05 | Tampering | Mislabelled toolType in stored JSON | medium | mitigate | Execute guard keys on `String(this.toolType)` (`server/tools.ts:414-416`); mislabelled case in `test/operatorOnly.test.ts` | closed |
| T-04-06 | Tampering | Prototype-chain key confusion | low | mitigate | `Object.prototype.hasOwnProperty.call` in `server/operatorOnlyCommands.ts:35` | closed |
| T-04-07 | Repudiation | Refusal audit entry | medium | mitigate | `logAction` with `stage=execute` (`server/tools.ts:420`) / `stage=enqueue` (`server/runs.ts:233`) before throw | closed |
| T-04-08 | Tampering | Defaulted / Enter-bound auto-confirm | high | mitigate | RadioGroup value `?? ""` (`components/runs/RunControlConfirmModal.tsx:297`), Confirm disabled until complete (`:323`), exact-"yes" completion in `controlDecision.ts:128`; no onKeyDown/onSubmit/form/autoFocus/type="submit" in modal or card (grep empty) | closed |
| T-04-09 | Tampering | UI retry / double-send | medium | mitigate | `createConfirmedSender` single-flight (`components/runs/controlDecision.ts:403`) used by `hooks/useRunControl.ts:39` | closed |
| T-04-10 | Repudiation | UI as only audit surface | medium | mitigate | Audit is server-side `logAction` (T-04-02/T-04-07); UI toasts are not the audit surface | closed |
| T-04-11 | Tampering | Latch reply feeding send path | medium | mitigate | Card enable-ness solely `isValidRecoveryGuid(guid)` (`RunRecoverySection.tsx:336`); `/latch/i` absence scan `test/staticScan.test.ts:378` | closed |
| T-04-12 | Denial of Service | Unbounded latch reply render | low | mitigate | Single result + `LatchRawJson` collapsible, `break-all` (`RunRecoverySection.tsx:76-94`) | closed |
| T-04-13 | Information Disclosure | Latch raw JSON on tool page | low | accept | See Accepted Risks AR-01 | closed |
| T-04-14 | Tampering | Future edit reintroducing ack / moving guard | high | mitigate | `test/staticScan.test.ts`: four-file literal pin (`:648`), absence pins (`:667`, `:677`), `extractBracedRegion` placement pins (`:688-703`) | closed |
| T-04-15 | Repudiation | Nondeterministic scan reports | low | mitigate | Determinism backstop `test/staticScan.test.ts:740` | closed |
| T-04-16 | Denial of Service | Scan runtime regression | low | accept | See Accepted Risks AR-02 | closed |
| T-04-17 | Denial of Service | Unbounded guid strings | low | mitigate | `{1,256}` linear regex `server/recoveryActions.ts:89` | closed |
| T-04-18 | Denial of Service | Oversized raw reply pushing controls off screen | low | mitigate | `LatchRawJson` collapsed, `maxH="160px"`, `overflowY="auto"`, `w="0px"`/`minW="100%"` (`RunRecoverySection.tsx:84-87`); G-04-2 scan | closed |
| T-04-19 | Tampering | Raw reply rendered as markup | low | mitigate | React child of Chakra `Text` (auto-escaped); `dangerouslySetInnerHTML` absence scans `test/staticScan.test.ts:452,566` | closed |
| T-04-20 | Elevation of Privilege | STACK card offering undeclared resume/abort | low | mitigate | `isRecoveryAction(toolType, …)` gating (`RunRecoverySection.tsx:184-185`); server refusal of undeclared actions as backstop; G-04-6 scan | closed |
| T-04-21 | Denial of Service | Production image cannot be built | high | mitigate | `next lint --no-cache --quiet` exits 0 and clean `git archive` image build succeeded (04-06-SUMMARY, G-04-5) | closed |
| T-04-22 | Information Disclosure | run.create raw stack trace in dev | low | mitigate | Name-based guards `server/runs.ts:274,317-325`, `server/routers/run.ts:94-102` → BAD_REQUEST; `test/runCreateReload.test.ts` | closed |
| T-04-23 | Repudiation | Refusal indistinguishable from 500 | low | mitigate | BAD_REQUEST with refusal text (`server/routers/run.ts:94-96`); stage=enqueue audit unchanged | closed |
| T-04-24 | Spoofing | Name-based error matching | low | accept | See Accepted Risks AR-03 | closed |
| T-04-25 | Elevation of Privilege | Mapping change weakening refusal | medium | mitigate | Enqueue/execute guards unchanged; `test/operatorOnly.test.ts` and `test/staticScan.test.ts` pass | closed |
| T-04-SC | Tampering | npm/pip/cargo installs (plans 01-07) | low | accept | See Accepted Risks AR-04 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-04-13 | Tool page is the operator surface by design (no-auth app, operator-only scope); raw latch JSON is deliberate display data per D-11 | Plan 04-04 threat model | 2026-10-30 |
| AR-02 | T-04-16 | Scan walk is the existing bounded Phase-3 helper over four directories; magnitudes unchanged | Plan 04-05 threat model | 2026-10-30 |
| AR-03 | T-04-24 | Only server code reaches the run.create catch; no client input sets an error name; worst case is a different TRPC code for a server-side error | Plan 04-07 threat model | 2026-10-30 |
| AR-04 | T-04-SC | No packages installed by any phase 04 plan; image build runs `npm ci` from the unchanged lockfile | Plans 04-01 … 04-07 threat models | 2026-10-30 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-30 | 26 | 26 | 0 | gsd-secure-phase (L1 grep + 237 passing pinned unit tests across 7 files; auditor skipped per short-circuit: plan-time register, ASVS 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-30
