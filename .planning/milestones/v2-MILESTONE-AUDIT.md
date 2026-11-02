---
milestone: v2
audited: 2026-11-02
status: tech_debt
scores:
  requirements: 17/17
  phases: 3/3
  integration: 19/19
  flows: 4/4
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 03-queue-start-guard-tool-error-visibility
    items:
      - "IN-01: full step-card error text is hover-only (title attr); banner and Details still carry it (03-REVIEW-DISPOSITION.md)"
      - "IN-02: sticky-label static scan is whitespace- and prop-order-sensitive (03-REVIEW-DISPOSITION.md)"
      - "IN-03: a SUCCESS reply with whitespace-only error_message fails the step — info only (03-REVIEW-DISPOSITION.md)"
      - "Override (user-accepted): G-03-3 rendered-card-geometry retest waived; layout pinned structurally by scans, never measured live (03-UAT.md test 3)"
      - "Override (user-accepted): D-02 reversed — ignored Start returns {accepted} + warning toast instead of silent undefined (03-REVIEW-DISPOSITION.md)"
  - phase: 04-operator-only-commands-stack-acknowledge
    items:
      - "WR-01 (security): operator-only refusal audit details interpolated without sanitizeLogText — log-forging via stored protocol JSON; audit record still written (04-REVIEW-DISPOSITION.md, open)"
      - "WR-02: extractLatch({}) renders a confident 'No failure latched' for empty meta_data — display-only, test-pinned (04-REVIEW-DISPOSITION.md, open)"
      - "WR-03: Acknowledge button not disabled while a send is pending; repeat confirm dropped but spinner cleared — single send still proven (04-REVIEW-DISPOSITION.md, open)"
      - "WR-04 (security): tool.latchStatus has no tool-type gate — read-only, via guarded executeCommand, direct-client reach only (04-REVIEW-DISPOSITION.md, open)"
      - "WR-05: createFromProtocol wraps unexpected failures in ProtocolGenerationFailedError → server faults mislabelled as 400; predates gap closure (04-REVIEW-DISPOSITION.md, open)"
      - "1 declared backstop truth behavior-unverified: raw-latch panel rendered width (props pinned at source; needs a browser)"
      - "5 human UAT retests pending a live rig / dev server / production image (04-VERIFICATION.md human_verification)"
      - "SUMMARY frontmatter gap: 04-01/02/05 lack requirements-completed (OPR-02, OPR-05 absent from all Phase-4 summaries; verified satisfied via 04-VERIFICATION.md requirements table)"
  - phase: 05-stack-codegen-command-forms
    items:
      - "IN-03: isBlank NaN guard admits typed 'Infinity'/'1e400' past the strip as huge finite doubles — one-line widen when triaged (05-VERIFICATION.md advisory)"
      - "WR-03 (user-locked, deferred): free-text boolean Input stays (05-UI-SPEC AC-4); non-literal strings like '0'/'no'/'TRUE' encode truthy (05-VERIFICATION.md advisory)"
      - "Stale comment at routers/tool.ts ~:545 ('zToolType rejects stack until Phase 5') — delete at next touch (integration check warning 1)"
      - "GEN-03 reply panel is adapter-dependent: populates only when the tool server sets return_reply=True — per frozen proto contract, by design (integration check warning 2)"
  - phase: open-artifacts
    items:
      - "2 diagnosed debug sessions open at audit time: run-create-operator-only-500 (fix shipped in 04-07), step-card-error-overflow (fix shipped in 03-07) — acknowledged at close, recorded in STATE.md Deferred Items"
  - phase: carried-from-v1
    items:
      - "02-REVIEW-DISPOSITION advisories WR-01..WR-04, IN-01 (queued in v1 close, still open)"
      - "2 previously acknowledged v1 todos still suppressed (STATE.md Deferred Items)"
nyquist:
  compliant_phases: 3
  partial_phases: 0
  not_validated_phases: 0
  missing_phases: 0
  overall: compliant
verification_staleness_note: "init.manager flags Phases 3 and 4 verification digests as stale because Phase 5 edits touched files they cover (staticScan.test.ts, RunRecoverySection.tsx, recoveryActions.ts, latchStatus/operatorOnly/recoveryControl tests). Phase 5's own verification (2026-11-02, 20/20) ran the full suite (608/608) at HEAD after those edits and re-verified the shared truths; closeout records this as a user-accepted verification override."
---

# Milestone v2 Audit: STACK tool support — codegen, operator acknowledge, error visibility, F5

**Audited:** 2026-11-02
**Status:** ⚡ tech_debt — no blockers, all requirements satisfied, accumulated advisory items recorded below
**Phases:** 3–5 (3 phases, 18 plans)

## Requirements Coverage (3-source cross-reference)

| Requirement | Phase | VERIFICATION.md | SUMMARY frontmatter | REQUIREMENTS.md | Final |
|-------------|-------|-----------------|---------------------|-----------------|-------|
| QUE-07 | 3 | SATISFIED (truth 1) | 03-01 | [x] Complete | ✅ satisfied |
| QUE-08 | 3 | SATISFIED (truth 2) | 03-01, 03-03 | [x] Complete | ✅ satisfied |
| QUE-09 | 3 | SATISFIED (truth 3, protected tests zero-diff) | 03-01 | [x] Complete | ✅ satisfied |
| ERR-01 | 3 | SATISFIED (truth 4) | 03-02, 03-04 | [x] Complete | ✅ satisfied |
| ERR-02 | 3 | SATISFIED (truth 5) | 03-04 | [x] Complete | ✅ satisfied |
| ERR-03 | 3 | SATISFIED (truths 6, 9 — 9 by user waiver) | 03-06, 03-07 | [x] Complete | ✅ satisfied |
| ERR-04 | 3 | SATISFIED (truth 6) | 03-04, 03-06 | [x] Complete | ✅ satisfied |
| ERR-05 | 3 | SATISFIED (truth 7) | 03-04, 03-05, 03-06 | [x] Complete | ✅ satisfied |
| OPR-01 | 4 | SATISFIED (truths 1, 6–9; UAT 1) | 04-03, 04-06 | [x] Complete | ✅ satisfied |
| OPR-02 | 4 | SATISFIED (truth 2; UAT 3) | _missing from all P4 summaries — manually verified via 04-VERIFICATION.md table_ | [x] Complete | ✅ satisfied |
| OPR-03 | 4 | SATISFIED (truths 3, 10–13; UAT 2) | 04-04, 04-06 | [x] Complete | ✅ satisfied |
| OPR-04 | 4 | SATISFIED (truths 4, 14–18) | 04-07 | [x] Complete | ✅ satisfied |
| OPR-05 | 4 | SATISFIED (truths 5, 13, 18) | _missing from all P4 summaries — manually verified via 04-VERIFICATION.md table_ | [x] Complete | ✅ satisfied |
| GEN-01 | 5 | SATISFIED (truth 1) | 05-01 | [x] Complete | ✅ satisfied |
| GEN-02 | 5 | SATISFIED (truths 3, 7, 9, 15–17; UAT 1/4) | 05-01, 05-02, 05-03, 05-04 | [x] Complete | ✅ satisfied |
| GEN-03 | 5 | SATISFIED (truth 10; UAT 2) | 05-02 | [x] Complete | ✅ satisfied |
| GEN-04 | 5 | SATISFIED (truths 5, 6, 13, 14, 18) | 05-01, 05-03 | [x] Complete | ✅ satisfied |

**Orphan detection:** every REQ-ID in the traceability table appears in its phase's VERIFICATION.md requirements table — 0 orphaned.

## Phase Verifications

| Phase | Status | Score | Key evidence |
|-------|--------|-------|--------------|
| 3 — Queue Start Guard & Tool Error Visibility | ✅ passed (re-verified 2026-10-30) | 9/9 (2 user overrides) | 249/249 targeted suites, tsc clean, QUE-09 protected files zero-diff |
| 4 — Operator-only Commands & STACK Acknowledge | ✅ passed (re-verified 2026-10-30) | 17/18 (1 declared layout backstop) | 570/570 full suite, tsc clean, production lint gate exit 0; 5 human UAT retests recorded |
| 5 — STACK Codegen & Command Forms | ✅ passed (re-verified 2026-11-02) | 20/20 | Fresh gate at HEAD: tsc 0 errors, **608/608 tests / 28 files**, prettier clean; all 4 human UAT items passed live (headless-Chrome harness + user confirmation) |

## Cross-Phase Integration (checker verdict)

**19/19 exports connected · 0 orphaned · 0 missing · 8/8 API routes consumed · verified live at HEAD `cb21916` (608/608 green).**

Confirmed seams:
1. **P3 → P4 (OPR-03 ← ERR-03):** step-card stored error (persisted row error via `storedErrorText`) is the guid source; `GUID_BLANK_HINT` directs the operator to it — both legs live.
2. **P4 → P5:** `LATCH_READ_COMMAND` renamed to frozen `"get_failure_latch"` with a real-encoder contract test; rename + OPR-05 scan flip landed in one commit (`9529187`); all 8 `"stack" as ToolType` casts retrofitted (`f780afe`), zero remain.
3. **P5 → P4 invariants:** D-08 honored via alias import — usage sites/props/copy unchanged; G-04-2 renderer pins re-targeted to `BoundedRawJson.tsx`; ack-literal closed set intact (walk-root check: literal only in the 4 pinned files).
4. **P5 → P3 drift:** clean — `runs.ts` changed only by enqueue scan + name-based error classification; `staticScan.test.ts` append-only; h0q/o44/t9e regression files untouched since Phase 3 and green.
5. **v1 → v2 non-interference:** `runControl` declares only `fast` (scan-pinned); stack ack via the v1 `toolControl` path refused; `recoveryControl` refuses while the running step tracks the tool; `controlCommand` carries no operator-only guard (scan-pinned).

## E2E Flows

| Flow | Verdict |
|------|---------|
| A — F5/F3: confirm Start → guard rejects double-start → tool error in banner + card + real code name → banner re-arms → skipped-failure never plain success | ✅ WIRED |
| B — Operator acknowledge: guid from card/Read latch → explicit "yes" → single audited send; latch display never feeds the send | ✅ WIRED |
| C — STACK command form: Config from generated default → born-empty form → coerce-before-strip send → read-only reply meta_data panel | ✅ WIRED |
| D — Enforcement: operator-only command refused at run.create (400, visible message), refused again audited at executeCommand; REST 400 | ✅ WIRED |

## Nyquist Compliance

| Phase | VALIDATION.md | Status | Compliant |
|-------|---------------|--------|-----------|
| 3 | exists | validated | ✅ true |
| 4 | exists | validated | ✅ true |
| 5 | exists | validated | ✅ true |

Overall: **compliant** (3/3). No validate-phase action needed.

## Verification Staleness (recorded at close as user-accepted override)

Phases 3 and 4 verification digests are stale: Phase 5 edits (`05-02` BoundedRawJson extraction re-targeting staticScan pins; `05-03` cast retrofits touching latchStatus/operatorOnly/recoveryControl tests; `05-04`/`bf928c0` commandParams coercion) landed after their verifications. Phase 5's verification (2026-11-02) ran the full 608/608 suite at HEAD after all of those edits and re-verified the shared truths (operatorOnly zero-send, latchStatus contract, recoveryControl single-send, staticScan pins). User accepted closing on this basis with the override recorded in MILESTONES.md.

## Verdict

All 17 requirements satisfied across three passed phase verifications; integration and E2E flows fully wired with zero blockers. The milestone achieved its definition of done. Accumulated advisory items (2 security-category log/type-gate warnings, several display-only defects, 2 open diagnosed debug sessions whose fixes already shipped, and the v1-carried advisories) are recorded as tech debt — tracked, non-blocking, and accepted by the user at close.

---

_Audit: 2026-11-02 — complete-milestone pre-close audit (3-source requirements cross-reference, integration checker, Nyquist discovery)_
