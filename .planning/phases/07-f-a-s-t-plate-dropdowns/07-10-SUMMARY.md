---
phase: 07-f-a-s-t-plate-dropdowns
plan: 10
subsystem: tools
tags: [pointer-events, state-machine, vitest, nextjs, chakra-ui, gap-closure]

requires:
  - phase: 07-f-a-s-t-plate-dropdowns
    provides: well picker core wellGeometry (07-02), WellPicker shell (07-07, 07-08)
provides:
  - controller/components/tools/wellPointer.ts, a React-free pure source-grid drag state machine (sourcePointerStep)
  - WellPicker source grid delegating all six pointer events to it, plus onPointerLeave
  - Node-only pointer sequence tests and delegation scans
affects: [phase-07-verification, 07-REVIEW-DISPOSITION]

plan_head_before: 45e11453a0a49a75f8485e6b8d512fd873172c19
plan_head_after: 46e24890cd6620a96bcec292345b9c86217aa156

actuals:
  tokens: 4250
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure reducer plus thin DOM shell: the shell forwards event facts (button, buttons, hit-tested cell, capture success) and applies the returned state and patch"

key-files:
  created:
    - controller/components/tools/wellPointer.ts
    - controller/test/wellPointer.test.ts
  modified:
    - controller/components/tools/WellPicker.tsx
    - controller/test/staticScan.test.ts

key-decisions:
  - "The reducer lives in a new module wellPointer.ts, not wellGeometry.ts, so it did not overlap 07-09's edits to wellGeometry.ts"
  - "A move whose buttons value has the primary bit clear ends the drag and writes nothing, whether or not capture is held (WR-01)"
  - "An uncaptured leave ends the drag; a captured leave keeps it so the edge-clamped cell keeps updating (UI-SPEC)"
  - "No jsdom or testing-library: react is not importable under this vitest setup (RESEARCH Pitfall 7) and D-10 allows no new dependency"

patterns-established:
  - "Drag state is one ref holding SourceDragState; every transition goes through sourcePointerStep"

requirements-completed: [PLT-08]

coverage:
  - id: D1
    description: "A source-grid patch is produced only while the primary button is held: a move with no button held ends the drag and writes nothing, so a hover after a release outside the grid never rewrites the four source fields (WR-01)"
    requirement: PLT-08
    verification:
      - kind: unit
        ref: "controller/test/wellPointer.test.ts#sourcePointerStep: WR-01 no button held"
        status: pass
    human_judgment: false
  - id: D2
    description: "A drag ends on up, cancel, lost capture and an uncaptured leave; a captured leave keeps it; a secondary-button or no-cell down writes nothing; the input state is never mutated"
    requirement: PLT-08
    verification:
      - kind: unit
        ref: "controller/test/wellPointer.test.ts#sourcePointerStep: leave, up/cancel/lost capture, whole gestures"
        status: pass
    human_judgment: false
  - id: D3
    description: "WellPicker delegates every source-grid event to sourcePointerStep, keeps no anchor ref, only wellGeometry and wellPointer call the patch producers, and wellPointer imports neither React nor Chakra"
    requirement: PLT-08
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#F.A.S.T. well picker invariants (D-10, D-13, D-16, D-17)"
        status: pass
    human_judgment: false
  - id: D4
    description: "In a real browser, in all three hosts, releasing the button outside the grid and hovering back over it leaves the four source fields unchanged, and a right-click writes nothing"
    requirement: PLT-08
    verification: []
    human_judgment: true
    rationale: "Real pointer capture, the browser's buttons value and the release-outside path cannot be produced under node-only vitest; carried to the end-of-phase UAT"

duration: 6min
completed: 2026-11-13
status: complete
---

# Phase 07 Plan 10: Source-grid drag state machine (WR-01) Summary

**The source-grid drag is now a pure, React-free `sourcePointerStep(state, input)` that ends the drag when no button is held, on an uncaptured leave, and on up, cancel or lost capture, so a release outside the grid followed by a hover can no longer rewrite source_start_row, source_start_col, num_rows or num_cols.**

## Performance

- **Duration:** about 6 min
- **Completed:** 2026-11-13T07:30Z
- **Tasks:** 2 (1 tracer TDD, 1 auto)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `wellPointer.ts` exports `SourceDrag`, `SourceDragState`, `SourcePointerInput`, `SourcePointerResult` and `sourcePointerStep`. Its only import is `wellGeometry` (`dragRect`, `sourcePatch`, types). It returns new objects and never mutates input.
- `WellPicker.tsx` holds one drag ref and a local `stepSource`. Pointer down tries `setPointerCapture` and reports whether it succeeded; move forwards `e.buttons`; up, cancel, lost capture and the new `onPointerLeave` forward their event. The private `sameRect`, the two drag refs, `endDrag` and the direct producer imports are gone. The destination grid, view model and rendered output are unchanged.
- 17 node sequence tests cover down (primary, secondary, no cell), distinct-rectangle writes in any direction, WR-01 with capture refused and held, leave with and without capture, up, cancel, lost capture, idle no-ops, a 3-patch whole gesture, and frozen inputs.
- Three scans pin the delegation: all six event types and `buttons: e.buttons`, no `anchor.current` or `lastRect`; only `wellGeometry.ts` and `wellPointer.ts` call `sourcePatch` and `dragRect`; `wellPointer.ts` imports neither React nor Chakra and only `wellGeometry`.

## TDD Gate Compliance

- RED: `b15a3ae` `test(07-10)` with a stub reducer returning the state unchanged. The run failed 7 of 17 on assertions (for example "expected undefined to strictly equal ..."), not on an import or syntax error. The 10 passing were the no-op and idle cases that the stub satisfies. Semantic assessment: the target tests executed and failed on the planned assertions for the intended reason. Persisted RED evidence records and `check tdd-red-evidence` were not run because `workflow.tdd_mode` is not enabled in `.planning/config.json`.
- GREEN: `55b0494` `feat(07-10)`.
- REFACTOR: not needed.

## Task Commits

1. Task 1 RED: `b15a3ae` test(07-10): failing pointer sequence tests
2. Task 1 GREEN: `55b0494` feat(07-10): drive the source-grid drag through sourcePointerStep
3. Task 2: `46e2489` test(07-10): pin source-grid delegation

## Verification

- `npx vitest run test/wellPointer.test.ts test/wellGeometry.test.ts test/staticScan.test.ts`: 237 passed after Task 1; staticScan 81 passed after Task 2.
- Full gate: `npx tsc --noEmit` clean, `npx vitest run` 37 files / 1094 tests passed, `npx prettier . --check` clean, `npx next lint --no-cache --quiet` clean, `npm run build` succeeded (it could write `.next`, so no temp copy was needed).
- `PIN_HELD` printed: vendor/galago-tools at d53da53 and `controller/gen-interfaces` unchanged.
- No commit of this plan lists `controller/package.json` or `package-lock.json`, so no dependency was added.
- Acceptance greps: `sourcePointerStep(`, `e.buttons` and `type: "leave"` each appear once in `WellPicker.tsx` (before the plan, the leave count was 0).
- The VERIFICATION `behavior_unverified` SC5 drag transitions are now covered by `controller/test/wellPointer.test.ts`. The orchestrator can mark WR-01 fixed in 07-REVIEW-DISPOSITION.md.

## Human-check carried to end-of-phase UAT

On a configured F.A.S.T. tool with two registered 8x12 plates (no motion sent), in the tool page, AddToolCommandModal and the edit-mode CommandDetailsDrawer: (1) press B3, drag to D5, leave the grid past its right edge, return and release; the four source fields follow live, clamp at the edge column outside, and stop changing on release. (2) Press B3, drag to C4, leave the grid, release outside, then hover back with no button; the four fields never change and the status line keeps the last selection. (3) Right-click a source well; nothing is written.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. T-07-37 and T-07-38 are mitigated by the reducer and its tests; T-07-39 (WR-02) remains accepted and open per the plan.

## Self-Check: PASSED

- FOUND: controller/components/tools/wellPointer.ts, controller/test/wellPointer.test.ts
- FOUND commits: b15a3ae, 55b0494, 46e2489
