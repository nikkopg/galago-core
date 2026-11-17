---
phase: 08-concurrency-lanes
plan: 10
subsystem: ui
tags: [lanes, chakra, react, protocol-editor, preview, phase-gate]

requires:
  - phase: 08-concurrency-lanes
    provides: "08-07 protocol.preview laneWarnings and validateLanes; 08-08 pure laneFields helpers (setLane, setBarrier, suggestLanes, laneFlag, buildLaneSummary, laneWarningText); 08-09 run-page lane UI"
provides:
  - "CommandDetailsDrawer Lane input (datalist), Wait for all earlier steps switch, flag line and inert note for tool steps"
  - "ProtocolDetailView visual Lane summary, per-lane Generated Commands and laneWarnings Alert"
  - "Phase 8 gate: full suite, 20x engine loop, golden fixture, tsc, prettier, lint, build"
affects: [uat, phase-9]

status: complete
plan_head_before: 1f71928d88c7a0c140a95fdd734bd8fa3fc6d566
plan_head_after: d78d793c676743266dd994a82ce97218d03f7d7e

actuals:
  tokens: 2700
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Drawer lane edits go only through setLane / setBarrier so blank/primary and off delete the keys; the dead runAsynchronously switch is untouched"
    - "Lane suggestions and flags are pure derivations from an optional protocolCommands prop; the run-page drawer passes nothing and stays read-only with no flags"
    - "Preview renders per-lane groups only when buildLaneSummary returns groups, otherwise the legacy output"

key-files:
  created: []
  modified:
    - controller/components/protocols/CommandDetailsDrawer.tsx
    - controller/components/protocols/ProtocolDetailView.tsx
    - controller/test/laneUi.test.ts

key-decisions:
  - "A trailing Divider follows the lane group (before Run Asynchronously) as in the UI-SPEC S1 sketch, in addition to the leading Divider the plan names"
  - "A script preview whose lane summary has no groups (only an invalid-tag refusal) falls back to the legacy command list so no step is ever hidden; its sentences still arrive through laneWarnings"
  - "The visual Lane summary block is a sibling of the step-strip Box inside the existing VStack, so the strip Box is textually unchanged"

requirements-completed: [LUI-01, LUI-03, LUI-04]

duration: 8min
completed: 2026-11-16
---

# Phase 8 Plan 10: Editor lane controls, per-lane previews and the phase gate Summary

**Visual-protocol authors can put a tool step on a lane and mark it as a barrier from the step drawer, and both visual and script protocols show per-lane previews with the refusal sentences as warnings; the whole Phase 8 gate is green.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-11-16T14:28Z
- **Completed:** 2026-11-16T14:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- CommandDetailsDrawer: for tool steps only, inside Advanced Parameters after "Value to Match" and before the unchanged "Run Asynchronously" row, a Lane `Input` (controlled, placeholder "primary", maxLength 32, native datalist `lane-suggestions` only when editing, aria-describedby linked helper and flag), the teal "Wait for all earlier steps" switch with its help line, and the permanent inert note with an aria-hidden InfoIcon. Read-only (run-page) drawer renders both controls disabled with saved values and no datalist. Tool Box steps show nothing new. Save Inputs, the dead switch and its stored `false` are untouched.
- Flag line (orange, WarningTwoIcon aria-hidden) from `laneFlag` over the protocol's own steps, passed through the new optional `protocolCommands` prop (identity match, queueId fallback). Never blocks saving.
- ProtocolDetailView: visual "Lane summary" below the step strip (group header bar plus 12px mono lines, spacing 6, warnings Alert), absent for untagged protocols; script "Generated Commands" box unchanged when untagged, otherwise grouped per lane inside the same 300px scroll; `protocol.preview` `laneWarnings` render verbatim (first letter capitalised) in a warning Alert below the box. `previewLaneWarnings` is set and reset wherever `previewCommands` is.
- laneUi.test.ts: new describe "editor lane wiring pins (D-18, D-20)" with six pins (drawer wiring and order, never writes `lane: ""` / `laneBarrier: false` / defaultValue, view wiring and exactly two `runAsynchronously: false`, no dangerouslySetInnerHTML, run-page drawer host passes no protocolCommands).

## Task Commits

1. **Task 1: Lane input, barrier switch, inert note and flags in the step drawer** - `d24bc85` (feat)
2. **Task 2: per-lane preview, warnings Alert, editor pins** - `d78d793` (feat)

## Phase gate results

| Check | Result |
|-------|--------|
| `npx vitest run` | 47 files, 1361 tests passed |
| 20x loop of lanes, laneHalt, laneControl suites | LOOP_DONE 20 of 20, no LOOP_FAIL |
| `npx tsc --noEmit` | clean |
| `npx prettier --check` (3 touched files) | clean |
| `npx next lint --no-cache --quiet` | no warnings or errors |
| `npm run build` | compiled on a mktemp copy of `controller` without `.next` (node_modules symlinked), exit 0; copy removed. In-place build not attempted (root-owned `.next`, Phase 6 / 08-09 precedent); `.next` untouched |
| Golden fixture | `git diff --exit-code 2da2ad7 -- controller/test/fixtures/lanesFlagOff.golden.ts` exit 0 (final capture commit) |
| staticScan.test.ts | append-only since 98b50d6 (157 added, 0 removed) |
| Pre-existing test files | none changed; every file changed under `controller/test` since 98b50d6 is a lane test, the harness, the golden fixture or the append-only staticScan |
| AddToolCommandModal.tsx | untouched (`git diff --quiet` exit 0) |

Acceptance greps: `id="lane-suggestions"` 1, `maxLength={32}` 1, `isToolStep(` 1, `setLane(` 1, `isChecked={advancedParams.runAsynchronously || false}` 1, `protocolCommands={commands}` 1.

## Deviations from Plan

**1. [Rule 3 - Blocking verify-command base] Golden unchanged-check baseline**
- **Found during:** Task 2 gate
- **Issue:** the plan's PHASE_TESTS_INTACT command diffs the golden fixture against its first-add commit (98b50d6), but the fixture was legitimately extended by the later capture commit 2da2ad7 (08-01), so that literal command would fail on a correct tree.
- **Fix:** diffed against 2da2ad7 as the orchestrator directed (exit 0), and ran the staticScan append-only and pre-existing-test-edit checks with the golden fixture added to the allow-list.
- **Files modified:** none

**2. [Spec alignment] Second Divider after the lane group.** The UI-SPEC S1 sketch rules the group off on both sides; one Divider was named in the plan action. Pure presentation, no behavior change.

**Total deviations:** 1 verify-baseline correction, 1 presentation addition. **Impact:** none on behavior or scope.

## Known Stubs

None.

## Threat Flags

None. T-08-33 (edits only via setLane/setBarrier, runAsynchronously and its defaults pinned unchanged) and T-08-34 (React text only, pin forbids dangerouslySetInnerHTML in both components) are implemented and pinned. T-08-35 accepted as planned (client warnings are advisory; the server refuses at run creation and enqueue).

## Human-check items for end-of-phase UAT (not a blocking checkpoint)

Simulated tools only, no instrument motion:

1. Visual editor: open a tool step's drawer in edit mode, type a 32-character lane name (expect: fits the input and the 120px run-page label column without pushing the cards; E1 long-text backstop), then "Fast" (stored as "fast"), then clear it (placeholder "primary" returns); toggle "Wait for all earlier steps" on and off; open a Tool Box step's drawer (expect: no lane controls; inert note shown for tool steps always).
2. Save a lane-tagged protocol and read the Lane summary (first-appearance order, barrier suffixes, global positions). Put a Tool Box note on lane "fast" via JSON import (expect: the refusal sentence in the warning Alert, saving still works).
3. Script protocol using `galago.lane("fast")` and Preview, once with `GALAGO_PARALLEL_LANES` unset (expect: "Lane tags ignored: parallel lanes disabled") and once with it set to 1 in the dev compose environment after restarting the controller (expect: grouped Generated Commands; `commandQueue.laneStatus` reports `laneMode` true and the run page shows the Lanes panel). This is the A1 backstop.
4. Carried from 08-09: the five run-page checks (Freeze dialog, failure list, layout and dark mode, Gantt chart under overlap, "Skip to this command" across lanes).

## Next Phase Readiness

Phase 8 is complete: flag-off byte-identity proof intact, one run can drive two tool servers, operators author lanes in the editor and scripts, are refused invalid setups and see per-lane steps in preview, Start confirmation and run page. Live STACK and F.A.S.T. concurrency on real instruments remains Phase 9.

## Self-Check: PASSED

CommandDetailsDrawer.tsx, ProtocolDetailView.tsx and laneUi.test.ts exist; commits d24bc85 and d78d793 are ancestors of HEAD.
