---
phase: 04-operator-only-commands-stack-acknowledge
plan: 03
subsystem: ui
tags: [recovery-card, confirm-modal, guid-entry, ui-invariants, confirmYes, single-flight]

# Dependency graph
requires:
  - phase: 04-operator-only-commands-stack-acknowledge/04-01
    provides: server/recoveryActions.ts — zero-import recovery spec (listRecoveryActions/getRecoverySpec/isRecoveryAction/isValidRecoveryGuid over jumped RecoveryParamKinds incl. confirmYes/guid), recoveryControl reroute
  - phase: 04-operator-only-commands-stack-acknowledge/04-02
    provides: operatorOnlyCommands refuse table + execute/enqueue guards (context for the operator-only stack)
provides:
  - recovery-spec-driven decision layer in controlDecision.ts (completeRecoveryEntries over declared param kinds; params data on ConfirmedControlRequest; sendRecovery widened to Record<string,string>; stack/ack copy maps; headMovesNote null for acknowledge_failure; shouldShowRecoverySection + needsGuidEntry derived from the recovery spec)
  - RunControlConfirmModal per-kind render: recovery-spec fallback with born-empty Yes/No radios gating Confirm on exactly "yes"; guid restated verbatim from request.params DATA, never an input
  - RunRecoveryCard guid entry: "Failure guid" Input born empty maxLength 256 never trimmed, "Acknowledge failure…" enabled only by the shared isValidRecoveryGuid, openConfirm carries params { guid }, afterAccepted clears the guid on accepted send
affects: [04-04, 04-05, plan-05 scans, verify-work]

# Actuals (#2632)
actuals:
  tokens: 10011    # chars/4 over the realized diff (40047 chars)
  tasks: 2
  commits: 3
  plan_head_before: b95bf972399efeb22c2b8517ad879219f5750083
  plan_head_after: 66b6ee366dd37fec2df045331c031f4261aff3e0

# Tech tracking
tech-stack:
  added: []   # no new dependencies (Chakra/lucide only, per plan)
  patterns:
    - "Client enable-check = server validator (one shared isValidRecoveryGuid import, zero-import value import)"
    - "Recovery per-kind render from the recovery spec: guid kinds travel as request data (never inputs); confirmYes kinds as born-empty radios gating Confirm on exactly \"yes\""
    - "Card visibility (shouldShowRecoverySection / needsGuidEntry) derived from listRecoveryActions, never a hard-coded tool-type list"

key-files:
  created: []
  modified:
    - controller/components/runs/controlDecision.ts
    - controller/components/runs/RunControlConfirmModal.tsx
    - controller/components/tools/RunRecoverySection.tsx
    - controller/hooks/useRunControl.ts
    - controller/test/controlDecision.test.ts

key-decisions:
  - "completeRecoveryEntries: single pure completion over declared recovery param kinds — accepted params, confirmYes only on exact \"yes\", guid validity via the shared isValidRecoveryGuid; incomplete → null so nothing can confirm
"
  - "restateChoice got an optional 4th arg (params) so the guid reaches the modal body as data and is restated byte-for-byte verbatim; the generic path is unchanged for fast actions"
  - "needsGuidEntry derives STACK-card guid-field visibility from the recovery spec (any declared guid-kind param) instead of comparing the tool type to \"stack\" in the card"
  - "headMovesNote returns null for the acknowledge_failure action token; server/runControl.ts's actionMovesHead data was not touched"

patterns-established:
  - "Recovery UI rendering is a per-kind mapping of RecoveryParamKind: guid → data restatement, confirmYes/yesno → born-empty radios"
  - "Source-invariant tests (staticScan read() idiom) pin the UI-08 absence list (no Enter-binding, preselection, form, auto focus) for the new ack surface ahead of plan 05's scan"

requirements-completed: [OPR-01]

coverage:
  - id: D1
    description: "Recovery branch of createConfirmedSender is spec-driven: a complete stack ack request carries exactly { guid, arm_inspected: \"yes\" }, incomplete data can never confirm, refusals carry the server text verbatim, single-flight holds"
    requirement: OPR-01
    verification:
      - kind: unit
        ref: "controller/test/controlDecision.test.ts#recovery send gate > sends a complete stack acknowledge with params exactly { guid, arm_inspected: \"yes\" }"
        status: pass
      - kind: unit
        ref: "controller/test/controlDecision.test.ts#recovery completion (completeRecoveryEntries)"
        status: pass
      - kind: unit
        ref: "controller/test/controlDecision.test.ts#acknowledge single-flight and refusal (T-04-09)"
        status: pass
    human_judgment: false
  - id: D2
    description: "STACK tool page shows the Run Recovery card (shouldShowRecoverySection derives from listRecoveryActions) and unique ack copy (header/title/label/display name) exists"
    requirement: OPR-01
    verification:
      - kind: unit
        ref: "controller/test/controlDecision.test.ts#recovery section visibility > derives from the recovery spec: stack qualifies without any runControl entry (D-05)"
        status: pass
      - kind: unit
        ref: "controller/test/controlDecision.test.ts#acknowledge copy and restatement (plan 04-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Operator types a guid (born empty, clipped at 256, never trimmed, blank refused), presses 'Acknowledge failure…', and the modal restates it verbatim with acknowledge-specific copy and an explicit born-empty 'Yes' choice gating Confirm"
    requirement: OPR-01
    verification:
      - kind: unit
        ref: "controller/test/controlDecision.test.ts#acknowledge UI source invariants (UI-08)"
        status: pass
      - kind: manual_procedural
        ref: "visual retest on a STACK tool page during phase verification (invalid-guid clip/refusal and long-text overflow held out by the repo's static-scan approach)"
        status: unknown
    human_judgment: true
    rationale: "No jsdom/RTL in this repo — the interaction itself (typing, clipboard paste, Enter key behaviour, modal visuals) needs a human pass"
  - id: D4
    description: "hooks/useRunControl.ts stays the only client file referencing recoveryControl; no Enter-bound default, no timer, no instrument-state gating in the card or modal"
    requirement: OPR-01
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#single confirmed send path"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts#safety invariants"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-10-29
status: complete
---

# Phase 04 Plan 03: Acknowledge Surface (Card + Modal + Recovery-Spec Decision State) Summary

**The STACK Run Recovery card now accepts the typed guid verbatim, gates "Acknowledge failure…" on the server's own validator, and sends `{ guid, arm_inspected: "yes" }` through one confirmed-send path only after an explicit, non-defaulted "Yes" — the decision layer itself became recovery-spec-driven (`completeRecoveryEntries`), replacing the hard-coded fast allowlist.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-29T06:35:19Z
- **Completed:** 2026-10-29T06:46:24Z
- **Tasks:** 2 of 2 (Task 1 tracer + Task 2 TDD)
- **Files modified:** 5

## Accomplishments
- `controlDecision.ts` is now spec-driven end to end: `RECOVERY_UI_ACTIONS` is deleted in favour of `isRecoveryAction`/`getRecoverySpec`; the pure `completeRecoveryEntries(spec, values, params)` completes declared param kinds in declaration order (guid from `params` via the shared `isValidRecoveryGuid`, `confirmYes` on exactly "yes", yesno on exact yes/no) and returns `null` when anything is incomplete — so a request can never confirm silence or "no".
- `ConfirmedControlRequest` gains `params?: Readonly<Record<string, string>>` (the guid travels as DATA, D-07) keeping the staticScan interface pins (`ControlDecisionValue` present, no `undefined` token); `sendRecovery`'s params widen to `Record<string, string>` in the hook and the gate.
- `RunControlConfirmModal` renders recovery requests per kind: the `restateChoice` body quotes the typed guid byte-for-byte, `arm_inspected` renders as born-empty Yes/No radios (nothing preselected, Confirm disabled until exactly "yes"), and the head-moves note never appears on the ack surface; remount-per-instance, Cancel focus and teal `confirmColorScheme` stay untouched.
- `RunRecoverySection` (STACK page): "Failure guid" field group — `Input` starting `""`, `maxLength={256}`, never trimmed, with the UI-SPEC helper text and disabled hint — plus the solid "Acknowledge failure…" button enabled only by the same `isValidRecoveryGuid` import the server validator runs; `openConfirm` carries `params: { guid }`, and `afterAccepted` clears the guid back to `""` only on an accepted send.
- Card visibility is spec-derived: `shouldShowRecoverySection(toolType) = listRecoveryActions(toolType).length > 0` (STACK qualifies without any runControl entry — D-05) and the new `needsGuidEntry` derives guid-field visibility from declared guid-kind params; card buttons stay enabled while a STACK step runs (tracked stays false — D-09).

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): recovery-spec decision state — completed request through createConfirmedSender to the send contract** - `74b8ffc` (feat)
2. **Task 2 (TDD RED): failing acknowledge UI source-invariant assertions** - `222731f` (test)
3. **Task 2 (TDD GREEN): modal per-kind render + card guid entry (born empty, explicit click, afterAccepted clear)** - `66b6ee3` (feat)

**Plan metadata:** committed with the final docs commit (see plan ledger: `plan_head_before` = `b95bf97`, `plan_head_after` = `66b6ee3`, 3 task commits measured across it).

## Files Created/Modified
- `controller/components/runs/controlDecision.ts` — recovery-spec imports and spec-driven recovery branch; `completeRecoveryEntries`, `needsGuidEntry`, ack copy maps, ack branch in `restateChoice`, `headMovesNote` ack-null, widened request/send types
- `controller/components/runs/RunControlConfirmModal.tsx` — `request.params` on the request interface, recovery-spec fallback with per-kind render/born-empty values/`canConfirm` recovery completion, `params: request.params` wired through `handleConfirm`
- `controller/components/tools/RunRecoverySection.tsx` — guid state + "Failure guid" field group + "Acknowledge failure…" gating + stack description copy + `afterAccepted` clear
- `controller/hooks/useRunControl.ts` — `sendRecovery` lambda param type widened to `Record<string, string>` (the hook remains the only client reference to `recoveryControl`)
- `controller/test/controlDecision.test.ts` — completion exactness/tests, ack copy pins, single-flight + refusal-notify, visibility from spec, and the UI-08 source-invariant suite (absence pins mirror the planned plan-05 scan)

## Decisions Made
- `completeRecoveryEntries` treats the guid as incomplete unless `isValidRecoveryGuid(params.guid)` passes — the client mirror is literally the server's check, so a hostile long/whitespace guid can never reach the send (or the modal's Confirm) even before the server re-validates.
- An invalid-but-nonempty guid shows the same "A guid cannot be blank…" hint (UI-SPEC names the blank case; the hint reads as guidance for any check failure and is shown whenever the button is disabled).
- `needsGuidEntry` (new pure helper in `controlDecision.ts`) derives the card's guid-field visibility from the recovery spec so future tool types with guid-kind params get the field without touching the card.
- The disabled-hint selector stayed inline in the card (single consumer; no pure helper extracted).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's prettier gate referenced a missing config**
- **Found during:** Task 1 verification
- **Issue:** The plan's verify blocks run `npx prettier --config .prettierrc` from `controller/`, but no `controller/.prettierrc` exists at HEAD (and prettier resolves that as an import — "Cannot find package 'undefined'"). The repo's formatting gate lives at the repo root (`.prettierrc`: printWidth 100, tabWidth 2, bracketSameLine).
- **Fix:** Ran the same prettier gate from the repo root with the root config; formatted the touched files when edits introduced drift (516-test full suite re-run after formatting).
- **Files modified:** controller/hooks/useRunControl.ts, controller/test/controlDecision.test.ts (formatting only)
- **Verification:** `npx prettier --config .prettierrc --check <all five files>` clean
- **Committed in:** `74b8ffc` (formatting rode the task commits)

**2. [Rule 2 - Missing critical helper] Added `needsGuidEntry` to controlDecision.ts**
- **Found during:** Task 2 (planned while finishing Task 1)
- **Issue:** The plan scoped the card's guid field to "a stack tool page", which would hard-code the tool type in the card and contradict the phase's own D-05 derived-visibility pattern.
- **Fix:** Pure spec-derived `needsGuidEntry(toolType)` (true iff any declared recovery action has a guid-kind param), pinned by tests; the card derives `showGuidField` from it.
- **Files modified:** controller/components/runs/controlDecision.ts, controller/test/controlDecision.test.ts
- **Verification:** unit tests `#the guid entry derives from the recovery spec's guid-kind params`
- **Committed in:** `74b8ffc`

---

**Total deviations:** 2 (1× Rule 3, 1× Rule 2)
**Impact on plan:** Both are small, in-pattern adjustments; all acceptance criteria verified as written. No scope creep.

## Issues Encountered
- `isValidRecoveryGuid` (plan 04-01) is a `boolean` predicate, not a type-guard, so `completeRecoveryEntries` narrows with an explicit `guid === undefined` check instead of relying on the guard — a one-line type consequence, no behavior change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 04-04/04-05 can add the latch block ("Read latch" + latch result) to the same card; the guid field group and `afterAccepted` clear are already in place (`afterAccepted` returns early when no guid action is pending, so the latch-result clear joins there).
- Plan 05's source scan can extend the pinned absence list; the repo already asserts it from `controlDecision.test.ts` (whitespace-flattened matching for JSX-wrapped prose).
- No stubs, no skipped tests, no auth gates.

---
*Phase: 04-operator-only-commands-stack-acknowledge*
*Completed: 2026-10-29*

## Self-Check: PASSED

All 5 modified files exist on disk; all 3 task commits (74b8ffc, 222731f, 66b6ee3) are ancestors of HEAD; full unit suite (22 files / 516 tests), `tsc --noEmit` and the root prettier gate are green.
