# Phase 4 — UI Review

**Audited:** 2026-10-30
**Baseline:** 04-UI-SPEC.md (approved design contract; Checker Sign-Off boxes still unticked)
**Screenshots:** not captured (code-only audit by instruction: no dev server started, running galago-web container untouched, no instrument contact)
**Interaction captures:** off (workflow.ui_interaction_capture is false). Interaction findings are code-derived.

Code audited at current HEAD, including gap closures 04-06 (RunRecoverySection) and 04-07.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every declared string matches the contract verbatim; one small deviation in pending-state copy |
| 2. Visuals | 3/4 | Focal point (single solid teal CTA) holds; guid input not programmatically associated with its label |
| 3. Color | 3/4 | Accent list respected; the "Read latch" and "Raw JSON" buttons use the default Button look; no new hardcoded hex |
| 4. Typography | 3/4 | Sizes {14,16,20} and bold-only additions respected; unlabeled helper/hint rhythm is flat |
| 5. Spacing | 3/4 | 4-pt scale only; bounded 160px raw panel uses the 0px-basis trick; no tokenized rhythm between card sub-blocks |
| 6. Experience Design | 3/4 | States and hard rules are solid; the guid error hint shows on pristine load, and there is no visible-run-state or aria feedback for validity |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **Pristine-state error hint and no accessible validity feedback on the guid field** — On first paint (guid is `""`) the card already shows "A guid cannot be blank..." as if the operator had erred, and the Input has no `isInvalid`, `aria-describedby` or label association (`RunRecoverySection.tsx:317-329`). Screen-reader and keyboard users get an unlabeled field. Fix: wrap in `FormControl` with `FormLabel` "Failure guid" and `FormHelperText`, pass `isInvalid` only after the field was touched. Keep the exact copy, no trimming, no onKeyDown, no `<form>`.
2. **Pending copy deviates from the contract** — Contract says "Acknowledging…"; code renders "Acknowledge in progress…" (`RunRecoverySection.tsx:351-355`), and also keeps "Resume/Abort in progress…". Fix: use "Acknowledging…" for the acknowledge branch, and update the static-scan pin if one exists.
3. **Raw JSON and Read latch controls lack state semantics beyond aria-expanded** — The `Raw JSON` toggle has `aria-expanded` but no `aria-controls`; the collapsed Collapse content stays in the accessibility tree depending on Chakra's `unmountOnExit` default (false). Fix: add `unmountOnExit` or `aria-controls` with an id, and give the latch result block `role="status"`/`aria-live="polite"` so the read result is announced.

Additional minor items (not top-3): the "guid:" label and value are two separate Text rows rather than one labeled row; no visible disabled-reason tied to the CTA other than the hint line; the contract's Checker Sign-Off remains unticked and should be closed out.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Verified verbatim in `RunRecoverySection.tsx`: "Run Recovery" (210), STACK description (214-215, as amended by 04-06), "Latched failure" (244), "Read latch" (108), "Reading latch…" (252), "No failure latched" (110, 280) with the contracted body (283-284), "Unrecognized latch reply" (265) with the contracted body (268-269), "Use this guid" (109), "Failure guid" (318), placeholder (323), helper (326), blank hint (111-112), "Acknowledge failure…" (338).
- Modal copy lives in `controlDecision.ts:261` ("Acknowledge STACK failure") and `:274` ("STACK failure acknowledged"); "Arm inspected?" radios Yes/No in `RunControlConfirmModal.tsx:305-306`.
- WARNING (minor): pending text "Acknowledge in progress…" (line 353-354) differs from the contract's "Acknowledging…". Does not break any flow, so no score impact beyond the 4/4 ceiling note.
- The apostrophe hint is pinned as a JS string (G-04-5) and renders identical text.
- Generic labels: none found on the new surface.

### Pillar 2: Visuals (3/4)
- Focal point holds: the only solid-accent (`colorScheme="teal"`) controls on a STACK card are "Acknowledge failure…" (333-339) and "Use this guid" (outline, 306-310). Resume/Abort are no longer rendered for STACK (G-04-6, lines 184-185, 218-239), which fixes the earlier visual competition.
- Reading order matches the contract: title, description, Latched failure block, guid field, CTA.
- WARNING: "Failure guid" is a bare `Text` (318), not a `FormLabel`; the Input has no accessible name other than its placeholder. No `aria-label` anywhere on the card except `aria-expanded` on Raw JSON (79).
- WARNING: the "Raw JSON" link-variant Button is small and low-emphasis but carries no `aria-controls`.
- The 04-06 bounded panel (`w="0px" minW="100%" maxH="160px" overflowY="auto"`, lines 83-93) correctly isolates long raw replies from card width. Visual confirmation is still the open human UAT check (tests 2, 5, 6) since no screenshots were taken.

### Pillar 3: Color (3/4)
- No hardcoded hex or rgb in `RunRecoverySection.tsx`; the panel uses semantic tokens `surface.panel` / `border.subtle` (90-92); card bg uses `useColorModeValue("white", "surface.section")` (115).
- Accent usage: teal in exactly 3 places in the card (Resume for F.A.S.T., Acknowledge failure, Use this guid), Resume being outside the closed STACK list but a pre-existing F.A.S.T. element. Red only on Abort (F.A.S.T.). Matches the closed list.
- WARNING: "Read latch" (246) is a default Button; the theme forces bold on every Button, so visually it can compete with the neutral-text intent, but this is spec-compliant. Score held at 3 for lack of dark-mode evidence (no screenshot) rather than a defect.

### Pillar 4: Typography (3/4)
- Sizes in use on the new surface: `Heading size="md"` (20), `Heading size="sm"` (16), `fontSize="sm"` (14), mono 14 for raw JSON. Set equals the declared {14,16,20}.
- Weights: `fontWeight={700}` explicit on the three new sub-headings (243, 264, 279); no third weight introduced.
- WARNING: heading and body hierarchy otherwise relies on UA defaults for card title; unchanged per contract.
- WARNING: four consecutive 14px lines (label, helper, hint, status) with identical weight can read as a wall in the guid block; the contract allows it, so only a minor deduction.

### Pillar 5: Spacing (3/4)
- All Chakra spacing is on the 4-pt scale: `mb={2}`, `mb={4}`, `mt={4}`, `spacing={2}`, `spacing={4}`, `p={6}`, `p={2}`, `mt={2}`. No arbitrary `[..px]` values.
- Declared exception honored: `maxH="160px"` and `w="0px"` are intentional contract values (G-04-2).
- WARNING: the Acknowledge CTA sits `mt={4}` below the guid VStack, and the Use this guid / Read latch buttons are full-width stretched inside `VStack align="stretch"`, so three stacked full-width buttons appear in the latched state; rhythm is consistent but heavy.

### Pillar 6: Experience Design (3/4)
- Loading: Read latch has `readPending` guard, Spinner plus "Reading latch…" (144-154, 249-254); send path shows Spinner and pending text (347-358).
- Error: read failure routes to `persistentErrorToast` in both the error and the catch branches (151-165); display stays blank on failure, as contracted.
- Empty / unknown: three distinct latch states rendered (unknown, not latched, latched), with unknown never rendered as "No failure latched" (D-13).
- Hard rules: no timers (`enabled:false`, `retry:false`), no `<form>`, no `onKeyDown`, no `autoFocus`, no `defaultValue`; modal `initialFocusRef={cancelRef}` retained (`RunControlConfirmModal.tsx:278`); guid never trimmed; "Use this guid" only fills state (309). Choices unpreselected per modal radios.
- Destructive: none new; ack uses teal.
- WARNING: `!isValidRecoveryGuid(guid)` shows the error hint on first paint (328) before any input, which reads as an error rather than guidance; and there is no `isInvalid` state or `aria-live` for the latch result.
- WARNING: `tracked` text links to `/runs` only when a step is tracking; per contract STACK `tracked` stays false, so fine.
- Registry audit: shadcn not initialized, no third-party registries; skipped.

---

## Registry Safety

Not applicable: no `components.json`; UI-SPEC declares zero third-party registries.

## Files Audited
- /home/formulatrix/data/nikko/galago-core/controller/components/tools/RunRecoverySection.tsx
- /home/formulatrix/data/nikko/galago-core/controller/components/runs/RunControlConfirmModal.tsx (grep spot-check only)
- /home/formulatrix/data/nikko/galago-core/controller/components/runs/controlDecision.ts (grep spot-check only)
- /home/formulatrix/data/nikko/galago-core/.planning/phases/04-operator-only-commands-stack-acknowledge/04-UI-SPEC.md
- /home/formulatrix/data/nikko/galago-core/.planning/phases/04-operator-only-commands-stack-acknowledge/04-06-SUMMARY.md (tail)
