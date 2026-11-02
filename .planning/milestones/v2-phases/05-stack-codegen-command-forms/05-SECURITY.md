---
phase: "05"
slug: "stack-codegen-command-forms"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-02"
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| vendor/galago-tools → codegen | External repo's frozen proto is the input to generated source; a wrong/moved input silently changes the wire | vendor proto content |
| codegen toolchain → generated files | protoc resolves plugins from PATH; the wrong plugin version (1.153.2) emits broken output | generated TS modules |
| commandFields → command panel | Anything listed in commandFields.stack becomes operator-sendable from the tool page | operator-typed form values |
| tool-server reply → page | `meta_data` is server-produced structured data rendered on the page | server reply JSON (read-only display) |
| operator browser form → page value pipeline → tRPC runCommand → generated encoder → tool | operator-typed field values cross from the DOM into the wire payload | command params |
| generated schema → creation input | zToolCreate/zToolType accept "stack" from any caller of tool.add | tool creation records |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Tampering | protoc plugin resolution during regen | high | mitigate | Explicit `--plugin=` to the pinned 1.151.1 scratch-dir binary; `tsc --noEmit` gate immediately after regen (05-01 Task 2 evidence) | closed |
| T-05-02 | Elevation of Privilege | commandFields.stack in constants.ts | high | mitigate | Operator-only acknowledge command absent from the stack entry (line-range grep: 0 acknowledge refs in the stack block); same-commit OPR-05 scan flip keeps ack-absence assertion | closed |
| T-05-03 | Tampering | vendor/galago-tools gitlink input | medium | mitigate | Gitlink verified live at pinned hash `bcbbf8e` (D-01 gate) | closed |
| T-05-04 | Tampering | meta_data rendering in [id].tsx | medium | mitigate | Reply renders only as JSON text through shared BoundedRawJson (2 usage sites); no `dangerouslySetInnerHTML` on the tool page (grep: 0) | closed |
| T-05-05 | Elevation of Privilege | reply panel + strip logic in [id].tsx | medium | mitigate | Panel display-only, `lastReply` tri-state set only from mutation onSuccess; single confirmed send path untouched; single-send-path scans stay green (05-02 evidence) | closed |
| T-05-06 | Tampering | operatorOnly/latchStatus/recoveryControl test retrofits | high | mitigate | Mechanical cast swaps only (D-08); real-enum refusal case re-proves the guard with a zero-send assertion; ack-carrier scan and no-zToolType scan pass untouched (05-03 evidence) | closed |
| T-05-07 | Elevation of Privilege | zToolCreate accepting "stack" | low | accept | Accepting stack tool creation is the phase's intent (D-07d); operator-only commands fenced by executeCommand guard and OPR-05 scans | closed (accepted) |
| T-05-08 | Tampering | [id].tsx handleSubmit boolean value pipeline | medium | mitigate | `coerceBooleanParams` imported and applied at the send site ([id].tsx:33,182); real-encoder wire case proves false survives | closed |
| T-05-09 | Tampering | commandParams.ts omitBlankParams NaN handling | low | mitigate | `isBlank` treats NaN as blank (commandParams.ts:14-19 — NaN dropped, 0/false kept); cleared timeout_s absent from live payloads (UAT-verified) | closed |
| T-05-10 | Information disclosure | coerceBooleanParams scope | low | accept | Coercion scoped to fields declared boolean in commandFields and STACK sends only; no new data leaves the app | closed (accepted) |
| T-05-SC | Tampering | npm/pip/cargo installs | high | mitigate | Package-legitimacy gate held; phase installs no new shipped dependencies (tech-stack `added: []` across all plans; zero install tasks) | closed (non-applicable) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-05-01 | T-05-07 | STACK tool creation is the phase's intended capability; operator-only command fencing unchanged | plan disposition (05-03) | 2026-11-02 |
| R-05-02 | T-05-10 | Value-type correction on an existing send path; no new data exposure | plan disposition (05-04) | 2026-11-02 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-02 | 11 | 11 | 0 | verify-work post-UAT L1 mitigation check (short-circuit: threats_open 0, register authored at plan time, ASVS 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-02
