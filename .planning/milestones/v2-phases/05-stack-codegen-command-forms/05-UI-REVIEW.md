# Phase 05 — UI Review

**Audited:** 2026-11-02
**Baseline:** `05-UI-SPEC.md` (status: approved) — Chakra UI 2.8.2 contract, no shadcn
**Screenshots:** captured (3/3 viewport captures + full/scrolled/dark-mode probes to `.planning/ui-reviews/05-20261102-121734/` from `http://localhost:3010/tools/Stack`)
**Interaction captures:** off (workflow.ui_interaction_capture is false). Interaction/selected-command findings below are code-derived; where noted they are corroborated by prior-session UAT captures at `/tmp/opencode/uat/` (`t3-transfer-born.png`, `f4a.png`, `f4b.png` — not produced by this audit).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every declared string rendered verbatim ("Send Command", "Select Command"/"Select command", "Reply meta_data", "Raw JSON", "No reply data returned."); only nit is toast chrome naming commands snake_case vs the dropdown's capitalized labels — copy the spec itself locks as "existing" |
| 2. Visuals | 3/4 | Tool status card renders a **broken-image icon** ("🖼Stack") — no fallback on the tool-page Image; command panel floats bare on the page background with no card surface, unlike the two cards above it |
| 3. Color | 4/4 | Single accent exactly per contract: solid `teal` (#44518e) Send Command is the only accent on new surfaces; zero hardcoded hex/rgb in phase files |
| 4. Typography | 4/4 | Only `fontSize="sm"` (14px) authored + body 16 + Heading sm/md; only weight 700 authored; FormLabel 500 is declared inherited chrome |
| 5. Spacing | 4/4 | All spacing strictly on the 4-pt scale (1/2/4/6); no arbitrary `[..px]` values; bounded panel keeps `mt={2} p={2}` verbatim |
| 6. Experience Design | 3/4 | All declared states implemented (born-hidden reply panel, muted data-less line, born-empty fields, toast loading/error/error copy); dark-mode visual state could **not** be verified in this harness — code-derived only |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Broken tool icon on the tool-page status card** (`controller/components/tools/ToolStatusCard.tsx:113-121`) — `/tool_icons/stack.png` returns 404 (`curl` verified) and the `Image` there carries **no `fallbackSrc`**, so every STACK tool page first-paints a broken-image glyph with raw alt text "🖼Stack" — the single most visible defect on the audited surface and it contradicts the spec's focal-point claim that the page "reads as a normal tool page". Fix: add a Chakra `fallbackSrc` to this `Image` (first-party placeholder preferred). Related hazard: the existing `fallbackSrc` in `NewToolModal.tsx:154/271` is the **external** URL `https://via.placeholder.com/40` — replace with a local asset so the fallback works offline. (Note: `fast.png` and `d400.png` also 404 — pre-existing pattern; `stack` meets it on a brand-new tool type for the first time.)
2. **Command panel has no surface** (`controller/pages/tools/[id].tsx:387-430`) — the Run Recovery card and tool card are bordered cards on `surface.section`, but the command panel renders as a bare `FormLabel` + `Select` + fields directly on `surface.canvas` white, ungrouped and visually detached. Fix: wrap the `toolCommandsDefined` block in a `Card`/`Box` with `bg surface.section`/`surface.panel` + `border.subtle` (matching the spec's Secondary 30% band). Requires a UI-SPEC amendment since the spec only defines the panel as the page column, not a card.
3. **Command-name formatting inconsistency in toast chrome** (`[id].tsx:135-144`, `Toast.tsx`) — the dropdown shows "List devices" (capitalizeFirst) but toasts say "Executing list_devices.." / "Command list_devices completed!" in raw snake_case. Locked as "existing" copy by the UI-SPEC, so not a contract violation — recommend surfacing to the user: run the same `capitalizeFirst(command.replaceAll("_", " "))` mapping over the toast titles for operator-facing consistency.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Verified against the Copywriting Contract table string-by-string:

- **CTA**: `Send Command` — `[id].tsx:402`, solid teal, `width="100%"`. ✓
- **Selector**: `FormLabel` "Select Command" (:390) + `Select placeholder="Select command"` born unselected (:391). ✓
- **Command option labels**: `capitalizeFirst(command.replaceAll("_", " "))` (:394) — live captures show "Transfer", "List devices". ✓ `acknowledge_failure` occurs **0** times in `constants.ts` (grep-verified). ✓
- **Field labels**: proto names verbatim — `step_key`, `refresh`, `timeout_s`, etc. render as `FormLabel` = `field.name` (:262, :281); captures confirm. ✓ No placeholders anywhere on STACK fields. ✓
- **Reply block**: module-top constants `REPLY_META_DATA_LABEL = "Reply meta_data"` and `NO_REPLY_DATA_LABEL = "No reply data returned."` (:44-45) — apostrophe-rule honored, both used (:414, :424). ✓ "Raw JSON" from the shared display. ✓
- **Empty state, field-less commands**: `get_manager_state`/`get_robot_states`/`get_failure_latch` declare `[]` → selector + Send Command only, no "no parameters" message (code path :400-404). ✓
- **Toast copy**: "Command {command} completed!" + "Command completed successfully" and "Failed to execute command" + "Error= {message}" — pin-verified by extant captures (f4a success toast, f4b error toast) matching ~3 s/~10 s durations in `Toast.tsx` (:90, :103).

Observation (not a violation — contract locks these strings as "existing"): toasts name commands in snake_case while the dropdown capitalizes them.

### Pillar 2: Visuals (3/4)

- **Focal point**: with a command selected, the solid full-width teal "Send Command" is unambiguous (f4a capture); born state has no button — that is the spec's own born-unselected rule, not a defect.
- **BLOCKER-adjacent visual defect**: `ToolStatusCard.tsx:113-121` — the tool-page `Image` falls back to `/tool_icons/${config.type}.png` (404 for `stack`) with **no** `fallbackSrc`; live captures show the broken-image icon + alt text "Stack" on the primary card in every viewport. (Only `NewToolModal`'s tool-picker Images have fallbackSrc — the spec's AC-5 claim that "tool-picker fallbackSrc covers the missing stack.png" did not cover the page itself.)
- **WARNING (minor)**: command panel renders bare on the page background (`FormControl` at :387) — weaker grouping than the two bordered cards; also `Box maxWidth="1800px"` + tall viewports (1600px probe) floats the content with large dead space above and below.
- **Minor**: the "Raw JSON" link-button stretches to panel width and center-aligns its label under the left-aligned "Reply meta_data" heading (visible in f4b) — the `VStack align="stretch"` (:412) stretches the button rather than hugging the label. Cosmetic.
- Icon-only controls carry aria-labels (e.g. `IconButton aria-label="Tool Box"`, `ToolStatusCard.tsx:94`). ✓

### Pillar 3: Color (4/4)

- Accent discipline: exactly one new solid-accent element — `Send Command` `colorScheme="teal"` (`[id].tsx:401`, theme-mapped #44518e). 12 total `colorScheme="teal"` app-wide in tools/pages/ui, all declared inherited chrome.
- Zero hardcoded hex/rgb in the four phase-produced UI files (grep: none). Muted line uses `useColorModeValue("gray.500", "whiteAlpha.700")` (:49) per spec. Shared panel uses `surface.panel`/`border.subtle` semantic tokens (`BoundedRawJson.tsx:51-53`). No new destructive red anywhere; fire-choice red confined to existing Abort/confirm chrome.

### Pillar 4: Typography (4/4)

- Sizes: only `fontSize="sm"` appears in authored copy across `[id].tsx` + shared files (16 occurrences); body 16 defaults + `Heading size="sm"/"md"` (16/20px). Within the declared {14, 16, 20} set — no new size.
- Weights: only `fontWeight={700}` authored (reply heading :414); Button bold is theme baseStyle; FormLabel 500 is the declared inherited-chrome exception, untouched. Within the declared {400, 700} authored set.
- Long-text handling: `fontFamily="mono"` + `wordBreak="break-all"` + `whiteSpace="pre-wrap"` in `BoundedRawJson.tsx:55`. ✓

### Pillar 5: Spacing (4/4)

- Histogram across phase files (`[id].tsx`, `RunRecoverySection.tsx`, `BoundedRawJson.tsx`): `spacing={1|2|4}`, `p={2|4|6}`, `my={2}`, `mt={2|4}`, `mb={2|4}` — all 4-pt scale (4/8/16/24px), no exceptions.
- Zero arbitrary values (`[..px]`/`[..rem]` grep: none).
- The bounded panel reuses `mt={2} p={2}` and `w="0px" minW="100%" maxH="160px" overflowY="auto"` exactly as spec'd (`BoundedRawJson.tsx:45-50`), single `type="boolean"` count = 1 (AC-4 control lock intact).

### Pillar 6: Experience Design (3/4)

- **Loading**: `loadingToast` held open (`duration: null`, `Toast.tsx:75`) until the promise settles; no inline spinner added to the panel; no timers/polling/Enter-binding/form-wrapper/autoFocus/defaultValue-submit in `[id].tsx` (grep: none). ✓
- **Error**: error toast ~10 s with retry-free copy; onError leaves `lastReply` untouched (:141-149). ✓
- **Empty**: reply panel born hidden (`lastReply === undefined`, :409); data-less completed send renders the muted "No reply data returned." line (:422-425); born-empty fields — `?? ""` fallbacks (:280-298, :308-330), live-verified (`t3-list-born.png` shows untouched `refresh` empty); NumberInput cleared → `""` not NaN (:312-320). ✓
- **Single send**: one mutation per click; each send collapses the disclosure (`setReplyOpen(false)`, :117); one reply panel replaced per send (rule 7). ✓
- **CR-01/WR-01 gap closure confirmed in-page**: `handleSubmit` coerces boolean strings then strips blanks on STACK only (:209-227); `coerceBooleanParams` exact-literal coercion (`commandParams.ts:57`), NaN-as-blank (`isBlank`, :19).
- Deductions for 3/4: (a) dark-mode rendering of the new surfaces could not be visually verified — the harness could not force Chakra's color-mode context (class-toggle probe only flipped the Idle chip), so the spec's "every new surface must work in both" claim rests on correct `useColorModeValue`/semantic-token usage, which code inspection supports but captures do not; (b) the broken status-card icon is a degraded first-paint experience even though the interaction flows themselves are complete; (c) several spec-designated human/UAT items (config editor render, bounded-panel overflow retest) remain open in 05-VALIDATION.

---

## Registry Safety

Skipped: `components.json` does not exist (NO_SHADCN) and the UI-SPEC Registry Safety table declares zero third-party registries — nothing to audit. (Related posture note, not a registry flag: `NewToolModal`'s image fallback points at the external `via.placeholder.com` service — see fix #1.)

## Verification spot-checks run this audit

- `npx vitest run test/toolPageReply.test.ts test/commandFields.test.ts test/boundedRawJson.test.ts test/commandParams.test.ts` → 28/28 pass on HEAD
- `npx vitest run test/staticScan.test.ts` → 43/43 pass (OPR-05 ack-absence scans intact)
- `curl /tool_icons/{fast,d400,stack}.png` → 404 ×3; `pf400.png` → 200 (proves the fallback gap is metric, not capture artifact)

---

## Files Audited

- `controller/pages/tools/[id].tsx` (full)
- `controller/components/ui/BoundedRawJson.tsx` (full)
- `controller/components/tools/commandParams.ts` (full)
- `controller/components/tools/constants.ts` (stack entry)
- `controller/components/tools/RunRecoverySection.tsx` (extraction/usage sites)
- `controller/components/tools/ToolStatusCard.tsx` (image render path, aria-labels)
- `controller/components/tools/NewToolModal.tsx` (icon source/fallback)
- `controller/components/ui/Toast.tsx` (loading/error toast chrome)
- Captures: desktop (1440×900), mobile (375×812), tablet (768×1024), full/scroll probes, tall-viewport probe, dark-mode probe → `.planning/ui-reviews/05-20261102-121734/`
- External corroboration (prior UAT session, not this audit's captures): `/tmp/opencode/uat/t3-list-born.png`, `t3-transfer-born.png`, `f4a.png`, `f4b.png`
