---
phase: 07-f-a-s-t-plate-dropdowns
plan: 01
subsystem: controller-ui
tags: [fast, tool-page, local-bindings, static-select, checkbox, wire]
requires: []
provides:
  - DECK_SLOTS single definition and LOCAL_BINDINGS (read-free binding map) in fieldOptions.ts
  - StaticSelect (born-empty deck select) and TipReuseCheckbox (Reuse tips checkbox)
  - newStepDefaults (tip_reuse "reuse" on a new fast transfer form)
affects: [07-03, 07-06, 07-07, 07-08]
tech-stack:
  added: []
  patterns:
    - "LOCAL_BINDINGS: instrument-read-free binding map beside FIELD_BINDINGS, same own-property lookup"
    - "applyLocalChange is the only patch producer for local bindings; views never write"
key-files:
  created:
    - controller/components/tools/StaticSelect.tsx
    - controller/components/tools/TipReuseCheckbox.tsx
    - controller/test/fastFieldOptions.test.ts
  modified:
    - controller/components/tools/fieldOptions.ts
    - controller/pages/tools/[id].tsx
    - controller/test/wire.test.ts
key-decisions:
  - "numericPatch converts only all-ASCII-digit strings to numbers; every other string (including '', '3.5', ' 3', 'x') is kept verbatim"
  - "checkboxView uses strict equality (no trim, no case folding); unknown saved values show an indeterminate box with a flag and are never rewritten"
  - "newStepDefaults is merged in the existing [selectedCommand] effect, the single allowed default on a Transfer field (PLT-07)"
requirements-completed: [PLT-06, PLT-07]
duration: 14 min
completed: 2026-11-12
status: complete
commits: 3
plan_head_before: dd20d46e9d1ddba274758c4858dc9039cbc08c89
plan_head_after: 532a2a2e0aa9ae6ee89e344892fbd743394f5a0c
actuals:
  tokens: 7200
  tasks: 2
  commits: 3
coverage:
  - deliverable: "source_deck and dest_deck are born-empty 1-6 dropdowns derived from DECK_SLOTS; saved odd values kept and flagged; a choice writes a number"
    verification:
      - kind: test
        ref: "controller/test/fastFieldOptions.test.ts#buildStaticView (deck select)"
        status: pass
      - kind: test
        ref: "controller/test/wire.test.ts#encodes decks chosen through applyLocalChange as int32 on the F.A.S.T. transfer"
        status: pass
    human_judgment: false
  - deliverable: "tip_reuse is a Reuse tips checkbox with saved-value mapping; new transfer form starts with reuse"
    verification:
      - kind: test
        ref: "controller/test/fastFieldOptions.test.ts#tip_reuse checkbox view (D-09, PLT-07)"
        status: pass
      - kind: test
        ref: "controller/test/fastFieldOptions.test.ts#newStepDefaults (PLT-07)"
        status: pass
    human_judgment: false
  - deliverable: "Rendered Chakra controls (dark-mode teal fill, toggle behaviour, reset on command switch) on the live tool page"
    human_judgment: true
    rationale: "Rendered Chakra controls cannot be observed under the node-only vitest setup; plan Task 2 human-check is deferred to end-of-phase UAT"
---

# Phase 7 Plan 01: F.A.S.T. Deck Dropdowns and Reuse Tips Checkbox Summary

Tool-page F.A.S.T. transfer now offers `source_deck`/`dest_deck` as born-empty selects of slots 1-6 from one `DECK_SLOTS` constant and `tip_reuse` as a teal "Reuse tips" checkbox that starts checked on a new form, all through a new read-free `LOCAL_BINDINGS` layer and a single patch producer (`applyLocalChange`).

Start 2026-11-12 (about 14 min), 2 tasks, 6 files (3 new, 3 modified), 3 commits.

## Accomplishments

- **Tracer (Task 1):** `DECK_SLOTS = 6` (comment cites `vendor/galago-tools/tools/fast/server.py:129`), derived `DECK_SLOT_OPTIONS`, `LOCAL_BINDINGS`/`lookupLocalBinding` (own-property at every level), `buildStaticView`, `numericPatch`, `applyLocalChange`, `buildSelectView` optional `notListedSuffix`, `StaticSelect.tsx`, tool-page routing (local binding looked up before the instrument-fed binding), and a real-encoder wire case: decks chosen via `applyLocalChange` decode as `source_deck` 3 / `dest_deck` 5 (int32), `tip_reuse` unchanged.
- **Task 2 (TDD):** checkbox role, `checkboxView`/`checkboxFlag`/`checkboxNextValue`, `newStepDefaults`, `TipReuseCheckbox.tsx`, tool-page checkbox branch, and `newStepDefaults` merged inside the existing `[selectedCommand]` effect.
- `lookupFieldBinding` and `commandFields` are untouched; `commandFields.test.ts` passes unedited.

## Tracer gate

Tracer `<verify>` (automated only) passed end-to-end after Task 1 (six target test files plus `tsc --noEmit`), logged "Tracer verified end-to-end, expanding" before Task 2 started.

## TDD Gate Compliance

- **RED** `37969e6` `test(07-01)`: 8 new tests in `controller/test/fastFieldOptions.test.ts` failed, 12 existing passed. Failures were on the target tests executing: six threw "no checkbox binding" (the tip_reuse local binding did not exist yet) and two "newStepDefaults is not a function". Semantic assessment: the target tests ran and failed for the planned reason (feature absent), not a syntax, import or fixture fault. Machine classification via `gsd_run check tdd-red-evidence` was not run (vitest default reporter output, not TAP); the assessment is manual.
- **GREEN** `532a2a2` `feat(07-01)`: all 20 tests in the file pass; six target files 156/156; full controller suite 780/780 (34 files); `tsc --noEmit` clean.
- **REFACTOR:** none needed.
- Task 1 is `type="tracer"` (not `tdd="true"`), so it ships as a single `feat` commit `430b457` with its tests.

## Task Commits

| Task | Commit | Type | Description |
| ---- | ------ | ---- | ----------- |
| 1 (tracer) | 430b457 | feat | deck dropdowns 1-6 on the tool page, StaticSelect, wire case |
| 2 RED | 37969e6 | test | failing tests for tip_reuse checkbox and new-step default |
| 2 GREEN | 532a2a2 | feat | Reuse tips checkbox and newStepDefaults wiring |

## Deviations from Plan

None - plan executed exactly as written.

Notes (not deviations): `git status` showed pre-existing `.planning/STATE.md`, `.planning/state.json`, `.dockerignore`, `.graphifyignore`, `.opencode/` changes before work began; none were staged by task commits.

## Human verification pending (end-of-phase UAT)

Task 2 `<human-check>`: start the controller dev server against a configured F.A.S.T. tool, pick the transfer command (do not press send), confirm empty 1-6 deck selects, "Reuse tips" checked with its helper, click toggles unchecked/checked, switching command away and back resets to checked, teal fill in light and dark. Not executed in this run (node-only vitest cannot render Chakra; verify mode is end-of-phase).

## Known Stubs

None. Accepted risk T-07-04: an untouched tool-page deck is `""` and encodes as 0, which the adapter refuses (1-6) before any motion. Until 07-03 lands, `AddToolCommandModal` and `CommandDetailsDrawer` still render decks as number inputs and `tip_reuse` as the old select (intended tracer order).

## Threat Flags

None. No new endpoints, auth paths or schema changes; no packages installed.

## Next

Ready for 07-02 (and 07-03 for the protocol modal and drawer hosts).

## Self-Check: PASSED

- FOUND: controller/components/tools/StaticSelect.tsx, controller/components/tools/TipReuseCheckbox.tsx, controller/test/fastFieldOptions.test.ts, controller/components/tools/fieldOptions.ts
- FOUND commits: 430b457, 37969e6, 532a2a2
- Acceptance greps and `tsc --noEmit` pass; `git diff` on `constants.ts` and `commandFields.test.ts` is empty.
