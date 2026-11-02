---
phase: 03-queue-start-guard-tool-error-visibility
plan: 05
subsystem: ui
tags: [f3, run-outcome, ui, pure-logic, vitest]
status: complete

requires:
  - phase: 03-queue-start-guard-tool-error-visibility
    provides: "03-02 red errorPath.test.ts (D-10 ordering); 03-04 getError payload and RunsComponent banner edit"
provides:
  - "controller/components/runs/storedError.ts: storedErrorText(error: unknown): string | null, the one reader of a persisted row error"
  - "controller/components/runs/runOutcome.ts: RunOutcome union, deriveRunOutcome, runOutcomeBadge, runProgressColorScheme"
  - "getRunAttributes status is derived by deriveRunOutcome from the run's whole command array"
  - "Run row shows an orange 'Skipped failure' badge and an orange Progress bar for a run whose failed step was skipped"
affects: [03-06, verify-work for ERR-05]

actuals:
  tokens: 3700
  tasks: 2
  commits: 3
plan_head_before: ab2fdff3c97412cf362001bacbc9c536f6948cbe
plan_head_after: d8cff8a6e05c64a420b774624c942edfee6f4a65

tech-stack:
  added: []
  patterns:
    - "Client-only derived outcome union; the persisted RunStatus is never widened"
    - "Pure, React-free modules for display rules, unit-tested without jsdom"

key-files:
  created:
    - controller/components/runs/storedError.ts
    - controller/components/runs/runOutcome.ts
    - controller/test/runOutcome.test.ts
  modified:
    - controller/components/runs/utils.ts
    - controller/components/runs/RunsComponent.tsx

key-decisions:
  - "RunStatus is not widened; COMPLETED_WITH_SKIPPED_FAILURE is a client-only outcome derived from polled rows (D-18)"
  - "FAILED takes precedence over a COMPLETED last row (D-19), narrower than today's order"
  - "Skipped-failure rule is evaluated before both COMPLETED branches and only tests SKIPPED rows, so a COMPLETED row's stale error is ignored"
  - "storedErrorText lives in its own module so 03-06's step error card reuses the same 'has an error' rule"
  - "Badge icon omitted (no AlertTriangle) to keep the row compact; text and orange colour carry the signal"

requirements-completed: [ERR-05]

coverage:
  - id: D1
    description: "A run with a SKIPPED step carrying a stored error and nothing left to run derives COMPLETED_WITH_SKIPPED_FAILURE, including when the last step is COMPLETED; plain Skip is unchanged; FAILED wins"
    requirement: "ERR-05"
    verification:
      - kind: unit
        ref: "controller/test/runOutcome.test.ts#deriveRunOutcome (D-18, D-19)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Badge copy and orange progress colour only for the skipped-failure outcome; never teal, never a check icon"
    requirement: "ERR-05"
    verification:
      - kind: unit
        ref: "controller/test/runOutcome.test.ts#runOutcomeBadge and runProgressColorScheme"
        status: pass
    human_judgment: false
  - id: D3
    description: "RunsComponent passes run.Commands to getRunAttributes each poll so the outcome is live"
    requirement: "ERR-05"
    verification:
      - kind: command
        ref: "npx tsc --noEmit (clean); grep 'getRunAttributes(runInfo, run.Commands)' RunsComponent.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rendered orange badge, tooltip, orange bar and narrow-width wrapping on /runs"
    requirement: "ERR-05"
    verification: []
    human_judgment: true
    rationale: "Rendered colour and layout; no jsdom/RTL by project decision (UI-08). Plan human-check not yet performed."
---

# Phase 3 Plan 05: Run Outcome for Skipped Failures Summary

**Pure run-outcome derivation (FAILED precedence, SKIPPED-with-error becomes COMPLETED_WITH_SKIPPED_FAILURE) wired into the run row as an orange "Skipped failure" badge and Progress bar, with the single-command call-site bug fixed.**

## Performance

- **Duration:** about 6 min
- **Tasks:** 2 (Task 1 TDD: RED then GREEN)
- **Files:** 3 created, 2 modified

## Accomplishments

- `storedErrorText` reads an Error, string or `{message}` and returns null for empty or non-error values; never trims.
- `deriveRunOutcome` applies the D-18/D-19 order: non-array/empty is CREATED, any FAILED is FAILED, then skipped-with-error (when nothing is STARTED or CREATED) is COMPLETED_WITH_SKIPPED_FAILURE, then the legacy COMPLETED/STARTED/QUEUED/COMPLETED-by-skip/CREATED rules.
- `getRunAttributes` delegates `status` to it; timestamps are derived from the status. The run-attributes effect now passes `run.Commands` on every poll (research Pitfall 6: it used to pass one command, so status was always "CREATED") and the duplicate 1 s `getAll` query was removed.
- The run Progress uses `runProgressColorScheme(status)` and the name row renders the Chakra `Badge` from `runOutcomeBadge(status)` with the tooltip "Completed, but a failed step was skipped, not completed."

## Task Commits

1. Task 1 RED: `0081212` test(03-05): failing run outcome, badge and colour tests (fails on missing modules)
2. Task 1 GREEN: `76726fd` feat(03-05): storedError.ts and runOutcome.ts (16 tests pass)
3. Task 2: `d8cff8a` feat(03-05): utils.ts delegation and RunsComponent wiring

No REFACTOR commit (no change needed).

## Verification

- `npx vitest run test/runOutcome.test.ts test/staticScan.test.ts`: 37 passed (16 new, 21 existing staticScan, none edited).
- `npx tsc --noEmit`: clean.
- `npm run test:unit` (wave gate): 19 files, 402 tests passed.
- Acceptance criteria: COMPLETED_WITH_SKIPPED_FAILURE appears 4 times in runOutcome.ts; "green" count 0; no react/.tsx imports in the pure modules; `git diff --stat 5726822` of types/run.ts, server/utils/HasRunStatus.ts and utils/runUtils.ts prints nothing; all four RunsComponent/utils grep counts are 1.

## Deviations from Plan

None - plan executed exactly as written. Two minor notes: the RED commit fails on missing modules rather than on an assertion (the modules did not exist yet); the effect callback keeps its `async` wrapper though it no longer awaits, to keep the diff minimal.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema; the outcome is display-only and derived from rows already polled (T-03-15, T-03-16, T-03-17 mitigated as planned).

## Human verification pending

Plan `<human-check>` (rendered colour and narrow-width wrapping of the badge on /runs) has not been run; it needs a browser (S4 backstops: partial, overflow).

## Next

Ready for 03-06. Note: ERR-05 is also declared by 03-06, so the REQUIREMENTS.md ERR-05 checkbox should only be treated as final once 03-06 has its SUMMARY.

## Self-Check: PASSED

- FOUND: controller/components/runs/storedError.ts, runOutcome.ts, controller/test/runOutcome.test.ts
- FOUND commits: 0081212, 76726fd, d8cff8a
