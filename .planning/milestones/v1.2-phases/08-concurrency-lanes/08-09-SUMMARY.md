---
phase: 08-concurrency-lanes
plan: 09
subsystem: ui
tags: [lanes, chakra, react, trpc, run-page, freeze, static-scan]

requires:
  - phase: 08-concurrency-lanes
    provides: "08-05 commandQueue.laneStatus query and freezeLanes mutation; 08-08 pure lane helpers (laneStatus.ts, groupRowsByLane, queuedStartLines laneFrozen)"
provides:
  - "useLaneStatus: the single client reader of commandQueue.laneStatus (1500 ms poll)"
  - "LanesPanel: Freeze lanes button with AlertDialog confirm, Lanes frozen state, running-lane chips (LAN-09)"
  - "LaneFailureList inside the error banner for two or more lane failures (LUI-06)"
  - "SwimLaneComponent per-lane rows with timestamp and barrier captions (LUI-05)"
  - "Start confirmation wired to laneFrozen (LUI-04)"
affects: [08-10, uat, phase-9]

status: complete
plan_head_before: 8376375a0e1b3f5a1962905b603b2315bfb2e9af
plan_head_after: 725bca01fad3d2bdb7b93410992ccb7bc935bf34

actuals:
  tokens: 6500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Lane UI branches only when groupRowsByLane returns non-null / laneStatus says lane mode with lane rows, so the untagged and flag-off DOM stays the legacy tree"
    - "All lane copy comes from laneStatus.ts constants; components never retype UI-SPEC strings"
    - "Freeze is a Chakra AlertDialog whose initial focus is the dismiss button via leastDestructiveRef, never autoFocus"

key-files:
  created:
    - controller/hooks/useLaneStatus.ts
    - controller/components/runs/LanesPanel.tsx
    - controller/components/runs/LaneFailureList.tsx
  modified:
    - controller/components/runs/RunsComponent.tsx
    - controller/components/runs/list/SwimLaneComponent.tsx
    - controller/components/runs/status/QueueStatuscomponent.tsx
    - controller/test/staticScan.test.ts

key-decisions:
  - "LanesPanel wraps the Freeze Button in a Box inside the Tooltip so the tooltip still shows on a disabled button"
  - "SwimLaneComponent uses LANE_BARRIER_CAPTION from laneStatus.ts to place the GitMerge icon instead of importing isBarrier directly (same behavior, one fewer server import in the component)"
  - "The legacy flat DOM sits in an early-return split: the lane branch returns first, the legacy JSX is left textually as before"

patterns-established:
  - "Run-page lane surfaces render nothing on a loading or failed laneStatus read, never a stale frozen state"

requirements-completed: [LAN-09, LUI-04, LUI-05, LUI-06]

duration: 10min
completed: 2026-11-16
---

# Phase 8 Plan 09: Run-page lane UI Summary

**Lanes panel with a confirmed Freeze lanes control, per-lane failure list in the error banner, per-lane run rows with timestamp captions, and a Start confirmation that lists steps per lane, all inert for untagged runs.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-11-16T14:18Z
- **Completed:** 2026-11-16T14:28Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- LanesPanel (below ControlBar) shows only for lane runs, with the orange "Lanes frozen" badge and reason sentence in a polite status region, running-lane chips, the disabled-reason line plus Tooltip, and the Freeze AlertDialog (focus on "Keep lanes running"; confirm sends `freezeLanes` once with success and failure toasts).
- LaneFailureList renders inside the banner (after the first failure's message box) only with 2+ failures, with its own 160px scroll, pre-wrap/break-word messages and the overflow line. Banner elements, dismiss-by-seq and all pinned call sites are untouched.
- SwimLaneComponent renders one `role="group"` row per lane with a sticky 120px label column, `{done} of {total} done`, the unchanged card plus a caption stack (Started/Ended/Not started/running, barrier with GitMerge), the per-lane "All steps in this lane are complete" empty text, and the existing "No pending commands" Center when everything is filtered. Untagged runs fall through to the byte-identical 900px flat DOM.
- QueueStatuscomponent computes `laneFrozen` from laneStatus (laneMode, hasLaneRows, haltReason failure or freeze) and passes it to `queuedStartLines`.
- Seven additive static pins in a new describe "run page lane invariants (D-15, D-16, D-21)".

## Task Commits

1. **Task 1: useLaneStatus and the Lanes panel** - `ab5a889` (feat)
2. **Task 2: banner failure list, lane rows, Start wiring** - `959b99c` (feat)
3. **Task 3: run-page lane pins** - `725bca0` (test)

## Verification

- `npx vitest run`: 47 files, 1355 tests passed. `npx tsc --noEmit`: clean. `npx next lint --no-cache --quiet`: no warnings or errors. Prettier: clean on all touched files.
- `npm run build` in place failed with EACCES unlinking `controller/.next/server/_error.js` (root-owned files in `.next`, the Phase 6 precedent). The build was therefore run on a mktemp copy of `controller` without `.next` (node_modules symlinked) and compiled successfully; the temp copy was removed. The failed in-place attempt did not change any tracked file.
- ControlBar.tsx and SwimLaneCommandComponent.tsx are untouched (`git diff --quiet` exit 0). The golden fixture was not edited.

## Deviations from Plan

None - plan executed as written. Two small implementation choices (Box around the disabled Button for the Tooltip; `LANE_BARRIER_CAPTION` instead of `isBarrier` in the swim lane) are listed in the frontmatter decisions and do not change behavior.

## Edge case handled

laneStatus can report `halted: true, haltReason: "failure"` with an empty failures list (08-05: operator removed a running row). The panel renders the failure sentence normally and LaneFailureList returns null for fewer than 2 entries, so nothing crashes.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or trust boundary beyond the planned laneStatus read and the confirmed freezeLanes mutation; T-08-29 to T-08-32 mitigations are implemented and pinned (confirm dialog with dismiss focus and in-flight disable, no HTML injection, panel separate from ControlBar, panel renders nothing on a loading or failed read).

## Human-check items for end-of-phase UAT (not a blocking checkpoint)

Never with a real instrument moving: start the dev compose with `GALAGO_PARALLEL_LANES=1` and simulated tools, run a lane-tagged protocol (the headline cycle), open the run page and check:

1. Press Freeze lanes, check the dialog, press Enter (expect: lanes keep running), press Freeze lanes again and confirm (expect: "Lanes frozen" badge with the freeze sentence, nothing aborted, Start appears).
2. Let a simulated step fail on one lane while the other runs (expect: banner keeps the first failure; "Failures by lane (2)" lists both lanes; panel shows the failure sentence).
3. Widen and narrow the window and switch to dark mode (expect: sticky 120px label column, captions aligned under their cards, badge and chips keep contrast, Freeze button wraps under the title; E5, E6, dark mode, E4 backstops; also the S6/partial no-flicker backstop).
4. Look at the Gantt chart (`RunQueueGanttChart`) while two steps overlap (UI-SPEC unresolved row; record the finding).
5. Note what "Skip to this command" does on a card of the other lane (P-7: skipUntil skips every lower position; pre-existing, not changed here).

## Next Phase Readiness

The run-page half of the lane UI is complete. Plan 08-10 (drawer lane controls and protocol preview) is independent of these files. Live STACK/F.A.S.T. concurrency remains Phase 9.

## Self-Check: PASSED

All seven files exist and commits ab5a889, 959b99c and 725bca0 are ancestors of HEAD.
