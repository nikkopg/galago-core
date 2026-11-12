---
phase: 07-f-a-s-t-plate-dropdowns
plan: 04
subsystem: controller-ui
tags: [fast, well-picker, chakra, pointer-events, react]
requires: ["07-02"]
provides:
  - WellPicker pointer-event component (two plate grids, status line, Edit as fields Collapse, Clear selection) and WellPickerProps contract for 07-07
affects: [07-07]
tech-stack:
  added: []
  patterns:
    - "Thin shell over a pure core: every render decision from buildWellPickerView, hit-test from cellFromPoint, writes only from sourcePatch / destClickPatch / CLEAR_PATCH"
    - "Drag anchor and last emitted rectangle in useRef; hover is the only useState besides the Collapse flag; no effect hook"
key-files:
  created:
    - controller/components/tools/WellPicker.tsx
  modified: []
key-decisions:
  - "Internal grid component is named WellGrid (not PlateGrid) so the D-10 'not reused' grep stays literal"
  - "Hover state updates only when the cell changes, to avoid a render per pointer move inside one cell"
requirements-completed: [PLT-08, PLT-09]
duration: 12 min
completed: 2026-11-12
status: complete
commits: 1
plan_head_before: 5155c497b5c2c73786efa9cdb8ff3b5b1990223d
plan_head_after: 78a72b58021d01688eed4d328dd9ad2d57f2840f
actuals:
  tokens: 3400
  tasks: 2
  commits: 1
coverage:
  - deliverable: "WellPicker renders every UI-SPEC state from the pure view model (grids, captions, mismatch warning, hidden/loading boxes, status line, Edit as fields with forced open, flags, Clear selection)"
    verification:
      - kind: command
        ref: "cd controller && npx tsc --noEmit && npx vitest run test/wellGeometry.test.ts test/staticScan.test.ts; prettier --check; next lint --quiet"
        status: pass
    human_judgment: true
    rationale: "Rendered drag feel, dark-mode ghost/bad fills, 384-well layout and long-text wrapping have no DOM test (react is not importable in repo tests); manual UAT after 07-07 mounts the component"
---

# Phase 7 Plan 04: WellPicker Component Summary

Pointer-event `WellPicker` shell over the 07-02 `wellGeometry` core: a source grid that drags (writing the four source fields live, edge-clamped, pointer-captured), a destination grid with a dashed hover footprint and a fit-checked click that writes only the two destination fields, the size-mismatch warning, hidden/loading boxes, a polite status line, a forced-open "Edit as fields" Collapse and "Clear selection".

Start 2026-11-12 (about 12 min), 2 tasks, 1 file (new), 1 commit.

## Accomplishments

- **Grids:** one `WellGrid` used for both sides. CSS grid template built from `gridMetrics` numbers; hit-test is `cellFromPoint` over the inner grid element's `getBoundingClientRect()` (correct under horizontal scroll); each grid sits in its own `overflowX="auto"`, `maxW="100%"` box. Wells are circles with the five mockup states (empty, sel, ghost, put, bad), dark-mode alpha fills for ghost and bad; wells past the plate edge are never drawn. Axis labels every second column under 14px cells; row gutter from `gridMetrics`. `role="group"`, `aria-label` "Source plate grid" / "Destination plate grid", `aria-describedby` the status line; wells and axis labels `aria-hidden`.
- **Source drag:** primary button only; down writes the 1x1 block and captures the pointer (try/catch); move writes only when the rectangle changes; up, cancel and lost capture end the drag.
- **Destination:** hover sets UI-only state (only while `destClickable`); leave clears it; click writes via `destClickPatch` only when it returns a patch. `not-allowed` cursor when the plates mismatch.
- **Panel:** `gray.50` / `surface.section`, `borderRadius xl`, `p 4`; wrapping `Flex gap 6`; titles and captions from the view and constants; mismatch `WarningTwoIcon` + text under the destination only; dashed hidden-grid box (min 240px) for hidden and loading sides; status line (`aria-live polite`, `minH 16px`, danger tone red); action row with the "Edit as fields" link button (chevron, `aria-expanded`, `aria-controls`, `aria-disabled` while forced, "Kept open" note) and "Clear selection" (`onPatch(CLEAR_PATCH)`, disabled when all six blank, no confirmation); `Collapse` `in={open || forced}` holding the six fields via `renderField`, each with its label and warning flag text, in `SimpleGrid minChildWidth 120px` or `VStack spacing 4`.
- No effect hook, timer, DOM point lookup, raw-HTML injection, instrument read or first-option construct; no new dependency.

## Task Commits

| Task | Commit | Type | Description |
| ---- | ------ | ---- | ----------- |
| 1 + 2 | 78a72b5 | feat | WellPicker grids, pointer interaction, panel, status, Edit as fields, Clear selection |

## Verification

- `tsc --noEmit` exit 0; `vitest run test/wellGeometry.test.ts test/staticScan.test.ts` 203/203 (136 + 67); `prettier --check` clean; `next lint --no-cache --quiet` no warnings or errors.
- All acceptance greps pass (buildWellPickerView, cellFromPoint, onPointerCancel, onLostPointerCapture, setPointerCapture, overflowX, Collapse, aria-disabled, aria-live, CLEAR_PATCH, WarningTwoIcon, renderField >= 1; useEffect, elementFromPoint, dangerouslySetInnerHTML, PlateGrid, `<Input`, tool.options = 0).

## Deviations from Plan

**1. [Process] Both tasks landed in one commit.** The component was authored as one file in a single pass, so Task 1 and Task 2 share commit 78a72b5 rather than two. No behaviour change; the file passes both tasks' verify and acceptance checks.

**Total deviations:** 1 process deviation. **Impact:** none on the delivered code.

## Known Stubs

None.

## Threat Flags

None. Instrument text (plate captions, hidden-box text) is rendered only as React text children (T-07-12); writes occur only from captured pointer drags, fitting destination clicks and Clear selection (T-07-13).

## Issues Encountered

None. Manual UAT items remain for after 07-07 mounts the component: drag feel (clamping, capture, touch, scroll), dark-mode ghost/bad fills, two 384 grids in the 900px modal, long status/mismatch wrapping.

Ready for 07-05 / 07-07.

## Self-Check: PASSED

- FOUND: controller/components/tools/WellPicker.tsx
- FOUND: commit 78a72b5 (ancestor of HEAD)
