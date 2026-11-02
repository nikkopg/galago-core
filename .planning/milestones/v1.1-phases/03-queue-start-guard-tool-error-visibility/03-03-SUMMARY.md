---
phase: 03-queue-start-guard-tool-error-visibility
plan: 03
subsystem: ui
tags: [queue, f5, run-confirmation, ui, pure-logic, chakra, vitest]
status: complete

requires:
  - phase: 03-queue-start-guard-tool-error-visibility
    provides: "03-01 server half of QUE-08 (Start log listing, start guard)"
provides:
  - "controller/components/runs/queuedStartSummary.ts: pure summarizeQueuedStart / queuedStartLines plus the four copy constants"
  - "Run confirmation modal shows, read-only, queued steps, FAILED retries and distinct runs before Accept"
  - "UI-08 static-scan case pinning the query source, two footer buttons and no auto-confirm affordance"
affects: [03-04, 03-05, 03-06, verify-work for QUE-08]

actuals:
  tokens: 3300
  tasks: 2
  commits: 3
plan_head_before: 6294eb58292b69ef707f1bfafb329003a8de7058
plan_head_after: 51504a54b1df0f83beae055e9c55669cc8ac1eb8

tech-stack:
  added: []
  patterns:
    - "Pure React-free copy module (counts + wording) so JSX does no string math"
    - "Source-scan invariants over stripComments(read(...)) for modal safety (no timer/form/autoFocus, exact button count)"

key-files:
  created:
    - controller/components/runs/queuedStartSummary.ts
    - controller/test/queuedStartSummary.test.ts
  modified:
    - controller/components/runs/status/QueueStatuscomponent.tsx
    - controller/test/staticScan.test.ts

key-decisions:
  - "Counts come from trpc.commandQueue.commands (queue-joined), not getAll, so a dequeued FAILED row is never promised as a retry (D-06 deviation, research Pitfall 2)"
  - "STARTED rows are shown on their own caption line and excluded from 'will run' because the 03-01 guard ignores a Start while a step is in flight"
  - "The new query is not added to the Spinner condition; getAll still drives hasCommandsToClear and the spinner"

requirements-completed: [QUE-08]

coverage:
  - id: D1
    description: "Pure summarizeQueuedStart counts CREATED/FAILED as will-run, FAILED as retries, distinct runs, STARTED separately"
    requirement: "QUE-08"
    verification:
      - kind: unit
        ref: "controller/test/queuedStartSummary.test.ts#summarizeQueuedStart counts (QUE-08, D-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "queuedStartLines assembles every S1 copy branch (loading, error, empty, singular/plural, retry, still-running, note)"
    requirement: "QUE-08"
    verification:
      - kind: unit
        ref: "controller/test/queuedStartSummary.test.ts#queuedStartLines copy (UI-SPEC S1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Run confirmation modal wires the summary read-only with no timer, default, autoFocus, form or extra button"
    requirement: "QUE-08"
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#Run confirmation shows what a Start will run (QUE-08)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rendered layout, wrap at narrow widths and focus/Enter behaviour of the modal"
    requirement: "QUE-08"
    verification: []
    human_judgment: true
    rationale: "No jsdom/RTL by decision (UI-08); plan's human-check in galago-web covers wrap, focus and Enter"
---

# Phase 3 Plan 03: Run Confirmation Start Summary Summary

**Run confirmation modal now states, read-only, how many queued steps a Start will run, how many are FAILED retries and how many distinct runs, from a pure counts/copy module fed by the queue-joined `commands` query.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-10-29T05:25Z (approx.)
- **Completed:** 2026-10-29T05:29Z (approx.)
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `summarizeQueuedStart` / `queuedStartLines` in a React-free module: loading, error, empty, singular/plural headline, retry line (omitted at F = 0), separate STARTED caption, fixed note. All copy assembled there.
- `QueueStatuscomponent.tsx` adds a local `queuedCommandsQuery` (`commandQueue.commands`, 1000 ms refetch) and a read-only `VStack` of `Text` lines under the unchanged simulation-mode sentence. Header, close button, Accept (teal) then Cancel (ghost), `handleConfirmStart` and Accept's enabled state are untouched.
- New top-level `describe` in `staticScan.test.ts` (5 cases, existing blocks not edited: +41/-0) pins the query source, the warning sentence, no timer/form/autoFocus/defaultValue/defaultChecked/initialFocusRef, exactly two footer buttons, a React-free summary module and no raw HTML.

## Task Commits

1. **Task 1 RED:** `f5edd27` test(03-03): failing start-summary count and copy tests
2. **Task 1 GREEN:** `7279d30` feat(03-03): pure start-summary counts and copy lines
3. **Task 2:** `51504a5` feat(03-03): Run confirmation summary + UI-08 static scan (also applies Prettier formatting to the Task 1 test file)

No REFACTOR commit was needed.

## Verification

- `npx vitest run test/staticScan.test.ts test/queuedStartSummary.test.ts`: 33 passed (15 summary + 18 scan)
- `npx tsc --noEmit`: clean
- Wave gate `npx vitest run --exclude test/errorPath.test.ts`: 16 files, 278 tests passed
- Acceptance greps: new `commands.useQuery({}, { refetchInterval: 1000 })` = 1, existing `getAll.useQuery(undefined, ...)` = 1, simulation sentence = 1, `git diff --numstat` for staticScan = 41 added / 0 deleted; forbidden-import grep on the summary module = 0
- Prettier check clean on all four files after the style fix

## Deviations from Plan

None - plan executed exactly as written. The plan's own recorded deviations from CONTEXT wording (D-06 data source `commands` instead of `getAll`; STARTED rows on their own line; singular/plural copy) were implemented as specified.

Minor note: the Task 1 test file was committed with non-Prettier line wrapping and was reformatted in the Task 2 commit (formatting only, no assertion changes).

## Threat Flags

None. The modal renders counts and fixed copy only; no row text is interpolated (T-03-09 accepted), and T-03-07/T-03-08 mitigations are pinned by the static scan.

## Known Stubs

None.

## Issues Encountered

None. `controller/test/errorPath.test.ts` stays red by design until 03-04 and was excluded from the full-suite run as instructed.

## Human check outstanding

The plan's rendered-behaviour check (two runs queued, one FAILED, press Start on /runs; confirm lines, grey note, no focus except the close button, Enter does not confirm, wrap at narrow width) needs a human in galago-web; it is not automatable here (no jsdom/RTL by decision).

## Next Phase Readiness

Ready for 03-04. Nothing in this plan changes server behaviour.

## Self-Check: PASSED

- FOUND: controller/components/runs/queuedStartSummary.ts
- FOUND: controller/test/queuedStartSummary.test.ts
- FOUND commits: f5edd27, 7279d30, 51504a5
