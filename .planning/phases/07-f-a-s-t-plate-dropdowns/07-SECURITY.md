---
phase: "07"
slug: "f-a-s-t-plate-dropdowns"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-16"
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Instrument → controller server | F.A.S.T. `get_plates` reply (plate ids, descriptions, geometry) parsed by `server/toolOptions.ts` | Untrusted instrument data; ids become motion parameters |
| Controller server → browser | Plate options, captions and grids rendered in selects and the well picker | Instrument text rendered in the UI |
| Operator UI → saved step params | Dropdowns, deck selects, tip-reuse checkbox, well grid drags and typed fields write step params | Motion parameters (plate ids, decks, wells) |
| Controller → tool server (gRPC) | `Tool#executeCommand` encodes Transfer params as int32 | Motion command; out-of-range values would wrap |
| Repo → vendored galago-tools | Submodule re-pin and regenerated `fast.ts` | Build-time integrity of the wire interface |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Tampering | StaticSelect / buildStaticView (deck) | high | mitigate | Explicit empty option, no default pick; write only on onChange (`fieldOptions.ts:354-397`, `StaticSelect.tsx:29-33`; `fastFieldOptions.test.ts:90`, `staticScan.test.ts:1126`) | closed |
| T-07-02 | Tampering | checkboxView / newStepDefaults (tip_reuse) | high | mitigate | Only `newStepDefaults` writes a default, never in the drawer (`fieldOptions.ts:466-523`; `staticScan.test.ts:1161`) | closed |
| T-07-03 | Tampering | numericPatch | low | mitigate | Digit-only conversion (`fieldOptions.ts:404-407`; `fastFieldOptions.test.ts:162-164`) | closed |
| T-07-04 | Tampering | saved deck values on the wire | low | accept | Adapter refuses decks outside 1-6 before motion (`vendor/galago-tools/tools/fast/server.py:207-210`) | closed |
| T-07-05 | Tampering | wellGeometry fit/patch helpers | high | mitigate | No clipping/re-anchoring; misfit flagged and forced open (`wellGeometry.ts:95-185, 449-571`; `wellGeometry.test.ts:922`) | closed |
| T-07-06 | Tampering | wellFieldPatch / classifyWellValue | medium | mitigate | Typed values kept verbatim and flagged (`wellGeometry.ts:181-281`; `wellGeometry.test.ts:279`) | closed |
| T-07-07 | Denial of Service | gridMetrics / wellSizePx | low | accept | 32x48 server cap, 8 px floor (`toolOptions.ts:107-108`, `wellGeometry.ts:114-116`) | closed |
| T-07-08 | Tampering | fillMissingParams (unset plate/deck) | high | mitigate | No-zero-fill guard precedes number fill (`commandParams.ts:109-112`; `commandParams.test.ts:141`, `staticScan.test.ts:1068`) | closed |
| T-07-09 | Tampering | modal number display, no-zero-fill fields | medium | mitigate | Unset shows "" and clear writes "" (`AddToolCommandModal.tsx:632-657`) | closed |
| T-07-10 | Tampering | drawer open path | medium | mitigate | Drawer never calls `newStepDefaults`; local controls only while editing (`staticScan.test.ts:1161-1173`) | closed |
| T-07-11 | Elevation of Privilege | get_plates as a step/command | medium | mitigate | Named only in `server/toolOptions.ts:368` (`staticScan.test.ts:939-945, 1145-1150`) | closed |
| T-07-12 | Tampering (XSS) | WellPicker captions / hidden-grid text | medium | mitigate | React text only; no raw-HTML API (`staticScan.test.ts:1186, 1262`) | closed |
| T-07-13 | Tampering | pointer writes | medium | mitigate | Writes only from captured drag, fitting click, Clear; no effect/timer (`WellPicker.tsx:250-417`; `staticScan.test.ts:1186, 1199, 1294`) | closed |
| T-07-14 | Denial of Service | 1536-well grid render | low | accept | Bounded by 32x48 cap and 8 px floor; hover updates only on cell change | closed |
| T-07-15 | Tampering | submodule re-pin | high | mitigate | Pin 4ccd3da → d53da53; proto diff +9/-0 in fast.proto only; commit 634f68d = gitlink + fast.ts | closed |
| T-07-16 | Tampering | regen toolchain | high | mitigate | Additive fast.ts (+84/-0), struct.ts not committed, ts-proto 1.151.1 recorded (`07-05-SUMMARY.md:86-92`; `wire.test.ts:165-179`) | closed |
| T-07-17 | Integrity | pin reproducibility | medium | mitigate | Pinned SHA is the tip of `feat/stack-tool` on the .gitmodules remote | closed |
| T-07-18 | Tampering | unfrozen or stubbed source | high | mitigate | Real `GetPlates` + `READ_COMMANDS` in pinned server.py; human gates recorded (`07-05-SUMMARY.md:91-92`) | closed |
| T-07-19 | Tampering | parsePlates id validation | high | mitigate | Integer, ≥1, ≤INT32_MAX; bad ids dropped, list degraded (`toolOptions.ts:279-312`; `toolOptions.parse.test.ts`) | closed |
| T-07-20 | Denial of Service | oversized plates reply | medium | mitigate | MAX_PLATES whole-reply too_large, caps, 5 s deadline, dedupe, throttle, ok-only cache (`toolOptions.ts:299-666`, `tools.ts:34`) | closed |
| T-07-21 | Tampering | prototype-chain reads | medium | mitigate | `own()` for every key (`toolOptions.ts:126-128`; own()-safety tests) | closed |
| T-07-22 | Tampering | {{variable}} via description | medium | mitigate | Variable-like description replaced by "" and degraded (`toolOptions.ts:313-324`) | closed |
| T-07-23 | Elevation of Privilege | client steering the instrument command | high | mitigate | Strict closed `z.enum` of five sources, no command/params (`routers/tool.ts:569-579`; `staticScan.test.ts:904-959`) | closed |
| T-07-24 | Tampering | non-numeric typed plate → 0 | medium | mitigate | Digits only, blank writes "" (`fieldOptions.ts:687-691`; `fastFieldOptions.test.ts:572`) | closed |
| T-07-25 | Tampering | host wiring of well writes | high | mitigate | All well writes via `handleWellPatch` from `onPatch`/`wellFieldPatch`; no effect hook in picker (`staticScan.test.ts:1186, 1244, 1294`) | closed |
| T-07-26 | Information Disclosure / Integrity | read-only run-page drawer | medium | mitigate | Picker only under `isEditing`, `enabled={isEditing}` (`CommandDetailsDrawer.tsx:680-702`; `staticScan.test.ts:1286-1292`) | closed |
| T-07-27 | Tampering (XSS) | StaticSelect / TipReuseCheckbox / WellPicker text | medium | mitigate | React text only (`staticScan.test.ts:1262-1270`) | closed |
| T-07-28 | Denial of Service | extra plate reads from the picker | low | mitigate | Shared react-query key; no retry/poll/refocus (`useToolOptions.ts`; `staticScan.test.ts:1003-1011, 1219-1225`) | closed |
| T-07-29 | Tampering (XSS) | plate labels / values in selects | medium | mitigate | `<option>` text children; value `String(id)`, write via `numericPatch` (`OptionsSelect.tsx:107-113`) | closed |
| T-07-30 | Spoofing | duplicate plate ids | medium | mitigate | All duplicates kept, suffixed and warning-coloured (`fieldOptions.ts:279-293`; `fastFieldOptions.test.ts:369`) | closed |
| T-07-31 | Tampering | typed out-of-range id reaching int32 (CR-01) | high | mitigate | `int32FromDigits` in all producers; flags; `executeCommand` refuses before gRPC on every motion path (`int32.ts:42-45`, `tools.ts:495-506`; `int32.test.ts:235, 268`, `wire.test.ts:96-119`) | closed |
| T-07-32 | Tampering | {{variable}} resolving out of range | high | mitigate | Guard runs after substitution (`tools.ts:461-495`; `int32.test.ts:381, 390`) | closed |
| T-07-33 | Tampering | non-canonical text coerced by encoder | medium | mitigate | `isExactInt32` (`int32.ts:50-58`; `int32.test.ts:87-121, 311`) | closed |
| T-07-34 | Repudiation / Information Disclosure | refusal audit row / message | low | mitigate | Field names only in audit; values capped at 40 chars (`tools.ts:497-501`, `int32.ts:87-101`) | closed |
| T-07-35 | Tampering | estimateDuration / Config unguarded | low | accept | Neither causes motion; every motion command is guarded | closed |
| T-07-36 | Tampering | guard field table drift after regen | medium | mitigate | `INT32_PARAM_FIELDS` pinned to generated encoder (`int32.test.ts:333-366`) | closed |
| T-07-37 | Tampering | source-grid pointer shell (WR-01) | high | mitigate | `sourcePointerStep` ends drag on no-button move, uncaptured leave, up/cancel/lost capture (`wellPointer.ts:35-63`; `wellPointer.test.ts`, 17 tests; UAT test 1 passed in a real browser) | closed |
| T-07-38 | Tampering | secondary-button / off-cell down | low | mitigate | Reducer and WellGrid ignore non-primary or no-cell down (`wellPointer.ts:41`, `WellPicker.tsx:167`) | closed |
| T-07-39 | Tampering | WR-02: drag overwrites {{variable}} binding; clamped header press | medium | accept | Deferred by orchestrator decision; open in `07-REVIEW-DISPOSITION.md`; values visible, tool server re-validates before motion | closed |
| T-07-SC (×10, one per plan) | Tampering | npm/pip/cargo installs | high | mitigate | No manifest or lockfile changed across the phase; 07-05 ts-proto 1.151.1 scratch-only, `--ignore-scripts`, human-approved | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-04 | An untouched tool-page deck encodes as 0; the adapter refuses decks outside 1-6 before any motion | Phase 7 plan (07-01) | 2026-11-16 |
| AR-07-02 | T-07-07, T-07-14 | Grid size bounded by the 32x48 server cap and 8 px floor (≤1536 wells per side) | Phase 7 plans (07-02, 07-04) | 2026-11-16 |
| AR-07-03 | T-07-35 | `estimateDuration` and `configure` encode without the int32 guard; neither causes motion and every motion command is guarded | Phase 7 plan (07-09) | 2026-11-16 |
| AR-07-04 | T-07-39 (WR-02) | A source drag can overwrite a {{variable}} well binding and a clamped header press writes an edge-well patch; needs a deliberate press, values are visible, tool server re-validates before motion. Deferred by orchestrator decision | Orchestrator decision (07-10, 07-REVIEW-DISPOSITION.md) | 2026-11-16 |

*Accepted risks do not resurface in future audit runs.*

**Non-blocking advisory (no threat ID):** WR-04: the int32 refusal applies only at execution time, so a saved step with a literal out-of-range id fails mid-run after earlier steps have run. Failure is safe (no wrong value is sent). Suggested hardening: scan literals at enqueue time.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-16 | 49 | 49 | 0 | gsd-security-auditor (sonnet), ASVS L1, block_on high; 11 test files / 542 tests run read-only, all passing |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-16
