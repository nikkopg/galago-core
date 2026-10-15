# Phase 2 — UI Review

**Audited:** 2026-10-14
**Baseline:** 02-UI-SPEC.md (design contract)
**Screenshots:** not captured — no dev server running (app requires a live tool server, per instructions); code-only audit performed
**Interaction captures:** off (workflow.ui_interaction_capture is false)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All declared strings (headers, restatements, toast titles/copy, hints) match the contract verbatim |
| 2. Visuals | 3/4 | State `Badge` under-weighted vs. spec's "primary visual anchor" instruction; `Progress` shares its row instead of being full-width |
| 3. Color | 2/4 | `ControlBar`'s "running" state badge uses `colorScheme="green"`, a color not declared anywhere in UI-SPEC's Color table, violating the contract's explicit "zero new colors" claim |
| 4. Typography | 4/4 | `Heading size="md"` correctly resolves to the declared 20px/bold token; Label/Body `fontSize` usage matches the usage map exactly; explicit `fontWeight="bold"` overrides added only on the three new modals as instructed |
| 5. Spacing | 3/4 | Most spacing tokens match (sm/md/lg used correctly); the spec's explicitly called-out xl (32px) gap between the control bar and Runs List card is not implemented — the page uses one uniform `spacing={6}` (24px) wrapper for everything |
| 6. Experience Design | 4/4 | Full state coverage: empty/loading (render nothing), unknown/error banner, confirm-reset-on-reopen, in-flight spinner, persistent refusal toast, auto-close-with-info-toast on stale requests, crash-recovery disabled+hint+link, stop-interception sequencing — all present and match the UI Considerations table |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Undeclared color introduced (`colorScheme="green"` on the running-state Badge)** — `controller/components/runs/ControlBar.tsx:85-90,104-106` sets the state badge to `green` when `runState.state === "running"`. UI-SPEC's Color section declares exactly five roles (dominant/secondary/accent-teal/destructive-red/warning-orange) and states "this phase introduces **zero new colors**." Green is absent from that table. User impact: a shipped color that wasn't reviewed/approved against the 60/30/10 contract, and breaks the "zero new colors" guarantee the spec hands to reviewers. Fix: reuse an already-declared semantic color for the running state (e.g. keep the badge `teal` to match the accent role, or `gray`/plain text if no color was intended to convey "running"), or get an explicit sign-off to add `green` to the Color table.

2. **Missing xl (32px) gap between ControlBar and Runs List card** — `controller/components/runs/RunsComponent.tsx:534,611,613`. The Component Layout Notes section explicitly calls out "Gap between the control bar and the Runs List card below it" as the xl/32px/token-8 spacing case, distinct from the lg/24px card-to-card rhythm used elsewhere. The implementation wraps every card (Gantt, control bar, Runs List) in a single `VStack spacing={6}` (24px/lg), so this one specifically-declared larger gap doesn't exist. Fix: either insert an explicit `Box mt={8}` /`spacing={8}` segment around `<ControlBar />`'s position, or split the outer VStack so the control-bar-to-list gap uses `spacing={8}` while the rest keeps `spacing={6}`.

3. **State badge under-weighted as the declared "primary visual anchor"** — `controller/components/runs/ControlBar.tsx:104`. The Component Layout Notes direct that the `Badge`+`Progress` row be "sized/weighted to draw the eye first... Badge sized `lg`" since it's the single glanceable answer to "what is this tool doing right now." The implementation sets `fontSize="md"` (16px) on the Badge — only marginally larger than the surrounding Label/Body text, not a strong visual anchor — and the `Progress` bar is not full-width on its own row (it shares the row with the Badge and the `%` text via `flex={1}`). User impact: the control bar's at-a-glance state signal is weaker than the contract intends. Fix: bump the Badge's `fontSize` to `lg` (or add `px`/`py` to increase its visual weight) and consider giving `Progress` its own full-width row below the Badge, per the layout note's stated intent.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- `confirmHeader()` (`controlDecision.ts:176-186`) returns exactly `"Pause Instrument"` / `"Resume Instrument"` / `"Abort Instrument Run"` — matches the Copywriting Contract's modal headers.
- `restateChoice()` (`controlDecision.ts:214-231`) produces `"Pause the F.A.S.T. run?"` and `"{Capitalized action} the F.A.S.T. run. {Label}: {Yes/No}."` — matches D-08 verbatim.
- `stopModalBody()` (`stopInterception.ts:32-36`) produces `"Abort the instrument run (return liquid? {Yes/No/not chosen})"` — matches D-17.
- `NOTHING_SENT_MESSAGE` (`controlDecision.ts:20-21`) is verbatim the D-12 string, used identically from `ControlBar.tsx:78` and `InstrumentStopModal.tsx:38`.
- `successTitle()` (`controlDecision.ts:188-198`) returns `"Instrument paused"` / `"Instrument resumed"` / `"Instrument run aborted"` — matches the Success toast default.
- `hooks/useRunControl.ts:44` calls `persistentErrorToast("Action refused", message)` — title and verbatim-message behavior match D-09 exactly.
- `RunRecoverySection.tsx:82-85` renders `"A run step is tracking this tool; use the run page."` plus an `"Open the run page"` link — matches the crash-recovery disabled hint verbatim (D-21).
- No generic `"Submit"`/`"OK"`/`"Click Here"` labels found in any of the audited files.

### Pillar 2: Visuals (3/4)
- `ControlBar.tsx` places the Heading (tool name/command) above the Badge+Progress row, which sits above the ButtonGroup — correct secondary→primary→tertiary visual order per the layout notes.
- `ToolPausedModal.tsx:66-69` renders the `TriangleAlert` icon then the reason text at `fontSize="xl" fontWeight="bold"` centered — correctly establishes the reason line as the primary visual anchor, matching spec intent.
- Gap: Badge `fontSize="md"` (`ControlBar.tsx:104`) is a modest step up from default Badge text, not the stronger "primary visual anchor" weighting the layout notes call for (see Priority Fix #3).
- Gap: `Progress` (`ControlBar.tsx:107-112`) is `flex={1}` inside an `HStack` with the Badge and `%` text rather than full-width on its own row, slightly diluting the "glanceable state" anchor the spec describes.
- No icon-only buttons without text labels are introduced this phase (consistent with spec's D-05/D-08 "every button carries a text label" note); `ModalCloseButton` is Chakra's own default affordance, as sanctioned.

### Pillar 3: Color (2/4)
- Accent (`teal`) correctly reserved for: Resume instrument (`ControlBar.tsx:144-158`), ToolPausedModal Resume (`ToolPausedModal.tsx:108`), RunRecoverySection Resume (`RunRecoverySection.tsx:66-72`), "Paused: view reason" outline button (`ControlBar.tsx:174-184`), and the non-abort Confirm button (`RunControlConfirmModal.tsx:125`).
- Destructive (`red`) correctly reserved for: Abort instrument run (all three entry points), `InstrumentStopModal`'s Abort/Confirm button (inherited via `confirmColorScheme`), and is never used for anything else.
- Warning (`orange`) correctly reserved for: Pause instrument button (`ControlBar.tsx:129-143`), the `paused` state badge (`ControlBar.tsx:85-90`), and the unknown-state `Alert status="warning"` banners in both `ControlBar.tsx:116` and `ToolPausedModal.tsx:90`.
- **Violation:** `ControlBar.tsx:85-90` sets `badgeColorScheme = "green"` when `envelope.runState?.state === "running"`. `green` appears nowhere in UI-SPEC's Color table (Dominant/Secondary/Accent/Destructive/Warning are the only five declared roles), and the spec states explicitly: "This phase introduces **zero new colors**." This is a real, in-scope deviation, not an incidental reuse of an existing non-phase color (the codebase's pre-existing `green` usage is in `QueueStatuscomponent.tsx`'s "Start" button and `RunsComponent.tsx`'s stat number, both out of this phase's declared color scope, so "running" state existing in this list doesn't grandfather it in for a *new* component this phase built).

### Pillar 4: Typography (4/4)
- `Heading size="md"` (`ControlBar.tsx:100`, `RunRecoverySection.tsx:58`) resolves via Chakra's default Heading theme (`sizes.md.fontSize: "xl"` = 20px) to exactly the declared Heading role (20px/bold) — correct token usage, not a raw px override.
- Label-role text (`fontSize="sm"`) is used for: decision question labels (`RunControlConfirmModal.tsx:197`), pause start-time text (`ToolPausedModal.tsx:88`), the unknown-state banner body (`ControlBar.tsx:119-124`, `ToolPausedModal.tsx:93-98`), `describePauseDetail` lines (`ToolPausedModal.tsx:72-75`), and the crash-recovery disabled hint (`RunRecoverySection.tsx:82-85`) — matches the Label usage map exactly.
- Body-role text (no explicit `fontSize`, default `md`/16px) is used for the confirmation restatement (`RunControlConfirmModal.tsx:193`) and `HEAD_MOVES_NOTE` (`RunControlConfirmModal.tsx:194`) — matches.
- All three new modals (`RunControlConfirmModal.tsx:185`, `ToolPausedModal.tsx:61`) pass explicit `fontWeight="bold"` on `ModalHeader`, exactly as the spec's explicit-override note requires to opt out of Chakra's `semibold` Modal-theme default; `InstrumentStopModal` inherits this correctly since it reuses `RunControlConfirmModal`.
- No third font weight or unexpected font size introduced; everything maps to the declared two-weight, three-role scale.

### Pillar 5: Spacing (3/4)
- `VStack spacing={4}` is used for modal bodies (`RunControlConfirmModal.tsx:188`, `ControlBar.tsx:99`) — matches the declared `md` (16px) default element spacing.
- `VStack spacing={2}` is used for decision radio stacks (`RunControlConfirmModal.tsx:196,206`) — matches the declared `sm` (8px) "radio option spacing" token, mirroring `StopRunModal.tsx`'s existing pattern as directed.
- `CardBody p={6}` on the Run Recovery card (`RunRecoverySection.tsx:57`) matches the declared `lg` (24px) card-padding token.
- Gap: the explicitly-declared `xl` (32px) "gap between the control bar and the Runs List card" (Component Layout Notes) is not present — `RunsComponent.tsx:534` wraps the Gantt card, the Runs List card, and `<ControlBar />` in one `VStack spacing={6}` (24px/`lg`), so every card-to-card gap on the page — including the one spec calls out as needing to be larger — is 24px, not 32px (see Priority Fix #2).
- No arbitrary/bracketed px or rem spacing values found in the audited files (`grep` for `\[.*px\]`/`\[.*rem\]` was clean).

### Pillar 6: Experience Design (4/4)
- Empty/loading: `shouldShowControlBar()` (`controlDecision.ts:77-85`) renders nothing until `runState.running` and a declared `runControl` tool type are both true — matches D-02/E1-empty and E1-loading exactly (no flash of stale state).
- Error/unknown: `nextUnknownSince()` + the `Alert status="warning"` block (`ControlBar.tsx:115-127`) keeps the last good state visible, shows `"Run state unknown since {time}"` plus `lastError`, and `controlButtonHints()` enables all three buttons when `status !== "ok"` (`controlDecision.ts:90-106`) — matches D-03/D-04/E1-error exactly.
- Confirm modal: `emptyDecisions()`/`allDecisionsChosen()` gate the Confirm button correctly; the modal body is `key`-remounted per request (`RunControlConfirmModal.tsx:86`) so decisions are always born empty on reopen — matches D-07/E2-empty/E2-partial.
- In-flight: `isSending` drives `Button isLoading` on Confirm and disables `closeOnEsc`/`closeOnOverlayClick`/hides the close button while sending (`RunControlConfirmModal.tsx:181-186,224`) — matches D-09/E2-loading.
- Stale-request auto-close: the combined effect in `ControlBar.tsx:68-81` and `InstrumentStopModal.tsx:32-41` closes a confirm and fires the exact D-12 info toast when the underlying step moves on or the prompt closes first — matches E2/E3 "closed before confirmed" coverage, and correctly avoids double-firing per the documented adjacency comment.
- Stop/sequencing: `runAfterAccepted()` (`controlDecision.ts:397-416`) only runs the queue follow-up (stop/clear/skip) after an accepted abort, and reports follow-up failure via a separate persistent toast — matches D-18's "abort-then-stop" sequencing and E4-loading/E4-error.
- Crash recovery: `RunRecoverySection.tsx` disables Resume/Abort only when `isToolTrackedByRunningStep` is true, shows a spinner + "Resume/Abort in progress…" while pending (`closeOnDispatch` keeps the mutation running after the modal closes), and is always rendered for `runControl` tool types independent of a running step — matches D-21/D-22/D-23/E5 exactly.

---

## Registry audit
`components.json` not found — shadcn not initialized this phase (per UI-SPEC's Design System section, declined in auto-mode). Registry Safety audit skipped as not applicable.

---

## Files Audited
- `controller/components/runs/ControlBar.tsx`
- `controller/components/runs/RunControlConfirmModal.tsx`
- `controller/components/runs/ToolPausedModal.tsx`
- `controller/components/runs/InstrumentStopModal.tsx`
- `controller/components/runs/controlDecision.ts`
- `controller/components/runs/stopInterception.ts`
- `controller/components/runs/status/QueueStatuscomponent.tsx`
- `controller/components/runs/RunsComponent.tsx`
- `controller/components/tools/RunRecoverySection.tsx`
- `controller/components/ui/Toast.tsx`
- `controller/pages/tools/[id].tsx`
- `controller/hooks/useRunControl.ts`
- `.planning/phases/02-run-page-live-controls/02-UI-SPEC.md`
