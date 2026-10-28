---
phase: "03"
slug: "queue-start-guard-tool-error-visibility"
overall_score: 20
max_score: 24
baseline: 03-UI-SPEC.md
screenshots: none (code-only audit; no dev server by instruction)
reviewed: "2026-10-29"
---

# Phase 3 — UI Review

Code-only 6-pillar audit against the approved `03-UI-SPEC.md` (gsd-ui-auditor). Written by the
orchestrator from the auditor's returned report (the auditor's runtime did not permit file writes).

## Scores

| Pillar | Score | Key finding |
|--------|-------|-------------|
| Copywriting | 4/4 | All contract strings match verbatim |
| Visuals | 3/4 | Banner remounts on every render; 3-line card text unverified against the 165px card |
| Color | 3/4 | `gray.500` caption text is below 4.5:1 on white |
| Typography | 4/4 | Only declared sizes and 400/700 weights added |
| Spacing | 4/4 | All new elements use declared tokens |
| Experience Design | 3/4 | Hard constraints met; remount and missing visual checks |
| **Overall** | **20/24** | |

## Priority fixes (WARNING)

1. **`ErrorBanner` is an inner component of `RunsComponent`** (`controller/components/runs/RunsComponent.tsx`,
   declared ~L228, rendered `<ErrorBanner />` ~L530). Its identity changes on each render and the page polls,
   so the banner remounts: scroll position in the 160px message region and any text selection reset.
   Fix: render via `{renderErrorBanner()}` or hoist to a props-taking component.
   *Orchestrator note:* the inner-component pattern predates this phase (present at `5726822`, L227/L542);
   Phase 3 made it more visible by adding the scrolling region.
2. **`gray.500` caption lines in the S1 Run confirmation are below 4.5:1 on white** (staleness note,
   "Checking the queue...", query-error and "still running" lines; `QueueStatuscomponent.tsx` via
   `tone: "caption"` in `queuedStartSummary.ts`). The UI-SPEC mandated this colour, so it is a contract-level
   defect. Fix: `useColorModeValue("gray.600", "gray.400")`.
3. **Step card fit unverified** (`controller/components/runs/list/SwimLaneCommandComponent.tsx`): the 3-line
   14px error `Text` (~63px) between `CommandImage` and the sticky label is not proven to fit the 165px card.
   UI-SPEC lists it as a backstop visual check. Fix: UAT with a long error, or cap the image height when
   `errorText !== null`.

## Minor

- A skipped-failure card is at full opacity and keeps the pointer cursor; confirm the click handler is
  harmless for SKIPPED rows.
- S4 long run name beside the badge remains unresolved (already flagged in the UI-SPEC).
- No visual evidence yet for backstop checks: narrow modal widths, banner overflow, badge wrapping, orange
  badge when COMPLETED steps follow the skipped one.

## Detailed findings

**Copywriting 4/4.** `queuedStartSummary.ts` matches the contract copy exactly (headline, singular/plural,
"It failed before..." for N=1/F=1, still-running line, "The queue is empty.", "Checking the queue...", the
query-error line, staleness note). `runOutcome.ts` gives "Skipped failure" with the contract tooltip. Banner
close has `aria-label="Dismiss error"`. Copy is assembled in pure helpers, not in JSX.

**Visuals 3/4.** Hierarchy follows the contract: body headline with captions in the modal, code badge hidden
when absent, orange badge next to the run name. Deductions: fixes 1 and 3.

**Color 3/4.** Red for errors, orange for skipped failures; `runOutcome.ts` types the badge `colorScheme` as
`"orange"` only and progress as `"teal" | "orange"`, so a skipped failure can never render green/teal. Error
text `red.900`/`red.50`, `orange.800`/`orange.200` as specified. No new accent use, no hardcoded hex.
Deduction: fix 2.

**Typography 4/4.** New text is `fontSize="sm"` or default 16px; no new weights. Pre-existing banner
`fontWeight="medium"` left alone, as the spec allows.

**Spacing 4/4.** `VStack spacing={2} mt={4}` (modal summary), `ml={2}` (S4 badge), `maxH="160px"` (banner
message region). Card box not resized; no arbitrary values.

**Experience Design 3/4.** Met: no timer, `autoFocus`, `defaultValue`, `<form>` or `StopRunModal` in the
modal; Accept stays enabled while the summary loads or errors; summary reads `commands` not `getAll` and is
kept out of the spinner condition; banner re-arms via `dismissedSeq` + `shouldShowErrorBanner`; stale errors
on non-FAILED/SKIPPED rows render nothing; FAILED wins in `deriveRunOutcome`; no `dangerouslySetInnerHTML`;
full card text in `title`; `userSelect="text"`. Deductions: fix 1 and the missing visual verification.

## Files audited

`controller/components/runs/status/QueueStatuscomponent.tsx`, `controller/components/runs/RunsComponent.tsx`,
`controller/components/runs/list/SwimLaneCommandComponent.tsx`, `controller/components/runs/queuedStartSummary.ts`,
`controller/components/runs/runOutcome.ts`, `controller/components/runs/queueError.ts`,
`controller/components/runs/storedError.ts`, `controller/components/runs/utils.ts`.

Registry audit: skipped (no `components.json`).
