# Phase 8 — UI Review

**Audited:** 2026-11-16
**Baseline:** 08-UI-SPEC.md (approved design contract)
**Screenshots:** not captured (no dev server running; code-only audit)
**Interaction captures:** off (workflow.ui_interaction_capture is false); all interaction findings are code-derived

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract strings are verbatim and centralised; Start-confirm caption tone is not paired with dark mode and the sticky-column and summary wording is untested visually |
| 2. Visuals | 3/4 | Focal points implemented as specified; lane summary groups have no box or list semantics, headers are plain Text |
| 3. Color | 3/4 | Accent restricted correctly; Start-confirm caption uses hardcoded `gray.500` instead of the paired muted token |
| 4. Typography | 3/4 | Declared 12/14/16 scale followed; `AlertDialogHeader fontSize="lg"` (18px) is a fourth size outside the contract |
| 5. Spacing | 3/4 | Scale respected (120px column, VStack 2/4/6); sticky label column leaves a transparent 16px `mr` gap that cards scroll behind |
| 6. Experience Design | 3/4 | Loading/disabled/confirm states are solid; barrier helper not linked via `aria-describedby` and dynamically mounted live regions may not announce |

**Overall: 18/24**

---

## Top 3 Priority Fixes

1. **Barrier switch helper and inert note are not programmatically linked** — screen-reader users toggling "Wait for all earlier steps" hear no explanation of a safety-relevant setting, contradicting the Accessibility section ("Helper and flag text is linked to its control with `aria-describedby`") — give the barrier `Switch` `aria-describedby="lane-barrier-help"`, add that `id` to the `Text` at `CommandDetailsDrawer.tsx:876`, and use `FormHelperText` inside the `FormControl`.
2. **Start confirmation caption lines use hardcoded `color: "gray.500"`** (`QueueStatuscomponent.tsx:~124`) — gray.500 on white is about 4:1 (below AA for 14px) and is not dark-mode paired, while the per-lane step list is the operator's last look before physical motion — replace with `useColorModeValue("gray.600", "whiteAlpha.700")` (the muted token the spec mandates).
3. **Live regions are conditionally mounted** — in `LanesPanel.tsx` the `role="status"`/`aria-live="polite"` frozen block and disabled-reason `Text` only appear when the state changes, so many screen readers will not announce "Lanes frozen" — render an always-present `aria-live` container and swap its contents.

Further issues (lower priority): see Detailed Findings (dialog header 18px; sticky-column `mr` gap; gray `Tag` chips; summary group semantics; Tooltip on a non-focusable wrapper).

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- All S5 copy (`Freeze lanes?`, `Keep lanes running`, three halt sentences, disabled reasons, toasts) is exported from `components/runs/laneStatus.ts:19-72` and matches UI-SPEC word for word. Halt sentences never promise auto-resume (good).
- Drawer copy (`Lane`, `placeholder="primary"`, `Wait for all earlier steps`) matches; helper/flag/inert strings come from `laneFields.ts`.
- Failure list overflow and singular/plural handling are correct (`laneStatus.ts:103-107`).
- Defects: `Not started` is shown for FAILED/CREATED rows alike with no distinction (spec-compliant but ambiguous for a FAILED step that never began); `Tooltip` text duplicates visible reason (acceptable, as specified).
- No generic labels (Submit/OK) introduced.

### Pillar 2: Visuals (3/4)
- Focal points follow the contract: sticky bold lane name (`SwimLaneComponent.tsx:84-100`), orange "Lanes frozen" badge as the only filled colour (`LanesPanel.tsx:101-108`), group header bar in `LaneGroups` (`ProtocolDetailView.tsx:146-163`).
- Icons are `aria-hidden` throughout; the Freeze button has a visible label plus matching `aria-label`.
- Weaknesses: lane summary groups are `Box` + `Text` with no list/heading semantics and no outline box as drawn in the spec mock; "Lane summary" is a `Text`, not a heading. Running-now chips are default gray `Tag` and are visually weak next to the 16px frozen sentence.
- Not verified visually (no screenshots): sticky column over scrolled row in dark mode, panel wrapping on narrow windows.

### Pillar 3: Color (3/4)
- Accent teal limited to the Freeze button, confirm button and barrier Switch, as contracted. Badge orange, failure list uses gray subtle badge, no red added.
- `QueueStatuscomponent.tsx` caption tone: `color: "gray.500"` hardcoded, light-only, below spec's muted token (BLOCKER-adjacent for contrast; classified WARNING).
- Muted gray.600/whiteAlpha.700 text inside the red error Alert (`LaneFailureList.tsx:35`) sits on a tinted red background; contrast not verified.
- No hex/rgb literals found in the new components.

### Pillar 4: Typography (3/4)
- Sizes in new components: `xs`, `sm`, `md` only, weights bold/normal only, matching 12/14/16 and 400/700.
- Violation: `AlertDialogHeader fontSize="lg" fontWeight="bold"` (`LanesPanel.tsx:~139`) introduces 18px, outside the contract's three declared sizes (spec says no display/heading role added).
- Frozen sentence is 16px (`fontSize="md"`) as specified, but it visually outweighs the 14px/700 "Lanes" title, which is what the spec intended and is acceptable.

### Pillar 5: Spacing (3/4)
- 120px label column, `VStack spacing={2}`, `Wrap spacing={2}`, failure `spacing={2}`, summary spacing 3/4/6 all use multiples of 4 and the declared scale. No arbitrary `[..px]` values added.
- Sticky label column has `mr={4}` margin: the gap is transparent, so cards scrolling horizontally show through it next to the opaque label (`SwimLaneComponent.tsx:90-97`). Use padding-right with matching bg or a pseudo-element.
- Caption `maxW="300px"` with cards at 250-300px: caption can be wider than a 250px card (misalignment risk, unverified).
- Visual summary uses spacing 6 between groups, script preview 3; spec says 24px (6) for both, so the script preview deviates.

### Pillar 6: Experience Design (3/4)
- Strong: panel renders null while loading/errored (no stale frozen state); Freeze is disabled and `isLoading` during mutation; confirm dialog uses `leastDestructiveRef` on the dismiss button; both toasts on success/failure; read-only drawer disables Lane and barrier; Tool Box steps show no lane controls; datalist rendered only when editing; no timers.
- Gaps: (a) barrier helper and inert note not `aria-describedby`-linked (`CommandDetailsDrawer.tsx:870-885`); only the Lane input is linked. (b) live regions mount conditionally (`LanesPanel.tsx:84-110`). (c) Disabled Freeze button is wrapped in a non-focusable `Box` for Tooltip, so keyboard users never reach the Tooltip; mitigated because the reason is also visible text. (d) `onClose()` runs before the mutation settles, so the dialog disappears with no in-dialog progress; the button `isLoading` covers this. (e) If a later poll errors, `status.isSuccess` can flip false and the panel unmounts mid-freeze, hiding the Freeze result (spec allows, but consider keeping the last good value).
- No registry audit (shadcn not initialised).

---

## Files Audited
- controller/components/runs/LanesPanel.tsx
- controller/components/runs/LaneFailureList.tsx
- controller/components/runs/laneStatus.ts
- controller/components/runs/RunsComponent.tsx (lane hooks, banner, panel mount)
- controller/components/runs/list/SwimLaneComponent.tsx
- controller/components/runs/status/QueueStatuscomponent.tsx
- controller/components/runs/queuedStartSummary.ts (lane lines)
- controller/hooks/useLaneStatus.ts
- controller/components/protocols/CommandDetailsDrawer.tsx (lane section)
- controller/components/protocols/ProtocolDetailView.tsx (lane summary, preview)
- controller/components/protocols/laneFields.ts (referenced)
