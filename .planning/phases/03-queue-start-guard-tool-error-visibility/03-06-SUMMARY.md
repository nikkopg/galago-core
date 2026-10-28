---
phase: 03-queue-start-guard-tool-error-visibility
plan: 06
subsystem: ui
tags: [f3, error-banner, step-card, ui, pure-logic, static-scan, vitest]
status: complete

requires:
  - phase: 03-queue-start-guard-tool-error-visibility
    provides: "03-04 getError payload with seq, userFriendlyMessage and codeString; 03-05 storedErrorText and run outcome wiring"
provides:
  - "controller/components/runs/queueError.ts: shouldShowErrorBanner, errorSeq, UNSEQUENCED_ERROR_SEQ, describeQueueError, QUEUE_ERROR_FALLBACK_MESSAGE, stepErrorText, SKIPPED_AFTER_FAILURE_PREFIX"
  - "Error banner that re-arms on every new failure seq after a dismiss, shows the server-composed tool text and the real code, scrolls long text"
  - "Step card error line (FAILED, and 'Skipped after failure: ...' for SKIPPED) read from the persisted row"
  - "error visibility static scans, including the 03-05 run outcome wiring"
affects: [verify-work for ERR-03, ERR-04, ERR-05]

actuals:
  tokens: 5500
  tasks: 3
  commits: 4
plan_head_before: d6cea71369a8284f091bdbf9a713b8157f477314
plan_head_after: 0e48d9514d0dcbc563737c10cc0d1e3a8a6ceabb

tech-stack:
  added: []
  patterns:
    - "Banner visibility is a pure function of the server error seq and a locally stored dismissedSeq"
    - "Pure React-free modules with static scans pinning the wiring (no jsdom by project decision)"

key-files:
  created:
    - controller/components/runs/queueError.ts
    - controller/test/queueError.test.ts
  modified:
    - controller/components/runs/RunsComponent.tsx
    - controller/components/runs/list/SwimLaneCommandComponent.tsx
    - controller/test/staticScan.test.ts

key-decisions:
  - "Dismiss stores only dismissedSeq (errorSeq of the shown payload); it never clears the queue error, restarts or acts on the queue (scan forbids clearError/restart/mutate in ErrorBanner)"
  - "Step error text sits between CommandImage and the sticky label so it scrolls with the 165px card (UI-SPEC UA2 deviation from 'under the label')"
  - "A skipped step with a stored error renders at full opacity; plain operator Skip and COMPLETED keep the 0.55 dimmed look (UA3)"
  - "Payload without a numeric seq maps to -1 and shows until dismissed; covers only a failed getError request"
  - "Code badge excludes exactly SUCCESS and UNKNOWN; UNKNOWN_RESPONSE is kept"

requirements-completed: [ERR-03, ERR-04, ERR-05]

coverage:
  - id: D1
    description: "Banner shows when FAILED, an error exists and seq differs from dismissedSeq; re-shows on the next failure seq even with identical text; hidden with no error or non-FAILED state"
    requirement: "ERR-04"
    verification:
      - kind: unit
        ref: "controller/test/queueError.test.ts#shouldShowErrorBanner (D-16)"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts#banner re-arms on a failure seq"
        status: pass
    human_judgment: false
  - id: D2
    description: "Banner message is the server text verbatim (never empty), code badge is the real code name and never SUCCESS or UNKNOWN"
    requirement: "ERR-05"
    verification:
      - kind: unit
        ref: "controller/test/queueError.test.ts#describeQueueError (D-16, ERR-02, ERR-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Failed step card shows its stored error; SKIPPED with an error shows 'Skipped after failure: <text>'; stale errors on COMPLETED/STARTED/CREATED rows are hidden; the stored error survives clearError and a reopened SQLite file"
    requirement: "ERR-03"
    verification:
      - kind: unit
        ref: "controller/test/queueError.test.ts#stepErrorText (D-17)"
        status: pass
      - kind: unit
        ref: "controller/test/queueError.test.ts#stored step error persistence (ERR-03, D-17)"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts#step card shows the stored error and checks only completed steps"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rendered banner (160px scroll region with close button and badge visible), 3-line clamped card text inside the 165px card, colours, and skipped-with-error full opacity on /runs"
    requirement: "ERR-03"
    verification: []
    human_judgment: true
    rationale: "Rendered layout, clamping and colour; no jsdom/RTL by project decision (UI-08). Plan 03-06 Task 2 human-check not yet performed."

duration: 10min
completed: 2026-10-28
---

# Phase 3 Plan 06: Error Banner Re-arm and Step Error Card Summary

**Error banner re-armed per failure via a seq-based dismissedSeq predicate that shows the tool's own text and real code, plus a stored-error line on failed and skipped-after-failure step cards, closed out by the phase's static scans and full regression gate.**

## Performance

- **Duration:** about 10 min
- **Completed:** 2026-10-28
- **Tasks:** 3 (Task 1 TDD: RED then GREEN)
- **Files:** 2 created, 3 modified

## Accomplishments

- `queueError.ts` is pure and React-free: `shouldShowErrorBanner`, `errorSeq`, `describeQueueError` (never empty, never a SUCCESS/UNKNOWN badge, message returned untrimmed) and `stepErrorText` (only FAILED and SKIPPED rows, reusing 03-05's `storedErrorText`).
- `RunsComponent.tsx`: `isErrorVisible` is gone; `dismissedSeq` state, `bannerError`, a 160px scrolling `AlertDescription` region with `whiteSpace="pre-wrap"`, and a `CloseButton aria-label="Dismiss error"` that only calls `setDismissedSeq(errorSeq(bannerError))`. Details modal receives the described message, code and raw JSON.
- `SwimLaneCommandComponent.tsx`: error `Text` (3-line clamp, full text in `title`) between the image and the sticky label; skipped-with-error card at full opacity; the single `CheckCircle` stays under `status === "COMPLETED"`.
- Persistence proven with real storage: the row error is readable after `clearError()` and after closing and reopening a temp SQLite file.
- New `describe("error visibility invariants (ERR-03, ERR-04, ERR-05)")` in staticScan with 5 scans (banner wiring, card wiring, 03-05 run outcome wiring, helper purity, no `dangerouslySetInnerHTML`).

## Task Commits

1. Task 1 RED: `7b2cd16` test(03-06): failing queueError tests (21 cases)
2. Task 1 GREEN: `59879f5` feat(03-06): queueError.ts helpers (21 pass)
3. Task 2: `aef01ae` feat(03-06): banner re-arm and step card error line
4. Task 3: `0e48d95` test(03-06): static scans for error visibility

No REFACTOR commit (no change needed). Plan metadata commit follows this SUMMARY.

## TDD Gate Compliance

RED commit `7b2cd16` precedes GREEN `59879f5`. RED evidence: the real RED commit contains only the test file (the module did not exist). Before committing I ran the test file against a temporary uncommitted stub with wrong behavior (all exports present, wrong values) and observed `17 failed | 4 passed (21)` on the planned assertions (for example `expected null to be 'Tool said: no plate'`); the stub was deleted before the commit. The classifier script `check tdd-red-evidence` was not run (vitest default reporter output, not TAP); semantic assessment: the failing assertions were the planned behaviors, not load or syntax faults. The 4 passing cases are the stub's coincidentally correct null/false returns.

## Verification (phase gate)

- `npm run test:unit`: 20 files, 428 tests passed (baseline 19 files / 402 tests; plan expected at least 20 files, met: queueError.test.ts added, plus the earlier-wave files).
- `npx tsc --noEmit`: clean.
- QUE-09: `git diff --stat 5726822 -- controller/test/toolControl.test.ts controller/test/sqliteQueue.test.ts controller/test/queueRestart.test.ts` printed nothing.
- errorPath.test.ts history: every commit subject starts with `test(03-02):`.
- `git diff --numstat 5726822 -- controller/test/staticScan.test.ts`: `155 0`, no existing line deleted or edited.
- Task 1 acceptance: `UNSEQUENCED_ERROR_SEQ = -1`, fallback copy and `Skipped after failure: ` present; the react/.tsx/timer grep on queueError.ts prints 0; test file contains `mkdtempSync` and `clearError`; 21 tests (>= 14).
- Task 2 acceptance: each grep count is 1 (`useState<number | null>(null)`, `setDismissedSeq(errorSeq(bannerError))`, `shouldShowErrorBanner(stateQuery.data, bannerError, dismissedSeq)`, `aria-label="Dismiss error"`, `maxH="160px"`, `const errorText = stepErrorText(command);`, `<CheckCircle`); `isErrorVisible` count 0.

## Deviations from Plan

None - plan executed exactly as written. Notes: `npx prettier --check` could not be run (the project `.prettierrc` references a package named `undefined` and errors on load, pre-existing), so formatting was matched by hand. The skipped-with-error card now takes the non-dimmed root `style` branch, which gives it `cursor: pointer` like other actionable cards; this follows the plan's instruction to use `dimmed` in the root `style`.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema. Tool text is rendered only as React children; the scan forbids `dangerouslySetInnerHTML` in all touched files (T-03-18). T-03-19 to T-03-21 mitigated as planned (seq re-arm tests, dismiss-only-stores-seq scan, stepErrorText status gating and single CheckCircle scan).

## Human verification pending

Plan 03-06 Task 2 `<human-check>` (rendered banner re-arm after dismiss, long-message scroll, 3-line card clamp and hover title, orange skipped-after-failure card, persistence across a galago-web restart) has not been run; it needs a browser and a simulated tool. Together with 03-03 Task 2 and 03-05 Task 2 it is harvested by `/gsd-verify-work` for end-of-phase UAT.

## Next

Phase 3 plans complete; ready for `/gsd-verify-work 3`.

## Self-Check: PASSED

- FOUND: controller/components/runs/queueError.ts, controller/test/queueError.test.ts
- FOUND commits: 7b2cd16, 59879f5, aef01ae, 0e48d95
