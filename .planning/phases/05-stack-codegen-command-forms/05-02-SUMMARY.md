---
phase: 05-stack-codegen-command-forms
plan: 02
subsystem: ui
tags: [chakra-ui, nextjs, trpc, react, vitest, stack-tool, born-empty]

# Dependency graph
requires:
  - phase: 05-stack-codegen-command-forms (plan 05-01)
    provides: commandFields.stack entry (the toolCommandsDefined key that makes the command panel render for STACK), generated ToolType.stack, green tsc/unit/prettier baseline
provides:
  - "components/ui/BoundedRawJson.tsx — the ONE shared bounded raw-JSON display (exported BoundedRawJson + formatLatchRaw), extracted from RunRecoverySection"
  - "components/tools/commandParams.ts — exported pure omitBlankParams (drops empty-string/undefined/null, keeps 0/false, one-level nested strip)"
  - "pages/tools/[id].tsx — lastReply tri-state capture from runCommand onSuccess + born-hidden Reply meta_data panel under the Send button + born-empty renderFields fallbacks"
  - "controller/test/boundedRawJson.test.ts, test/toolPageReply.test.ts, test/commandParams.test.ts — 15 new tests pinning the display contract, the panel invariants and the strip"
affects: [05-03 (D-04 blank-optional wire pin + activation tests), 05-VALIDATION (manual STACK read retest)]

# Actuals (#2632) — pairs with the plan's `estimate` (45000) to calibrate future estimates.
actuals:
  tokens: 6448        # chars/4 over the realized controller diff (25790 chars)
  tasks: 3
  commits: 3          # MEASURED: git rev-list --count 5d0a45d..HEAD at SUMMARY time
  plan_head_before: 5d0a45d16b44ce0b6dfda28d5a14fded984b98e0
  plan_head_after: 5bc837516fc01535fbf0824fc9cae232d5365e15

# Tech tracking
tech-stack:
  added: []           # zero new dependencies (UI-SPEC Registry Safety)
  patterns:
    - "One shared bounded raw-JSON display — consumers render through BoundedRawJson, never a second styled copy (D-06)"
    - "Tri-state reply capture (undefined = born hidden / null = completed send without data / reply object) set only from the mutation onSuccess"
    - "Pure param-strip module scoped at the send site to String(config?.type) === 'stack' — other tool types' payloads byte-identical"
    - "Born-empty display fallbacks: ?? '' replaces ||-painting of 0/false in shared renderFields branches"

key-files:
  created:
    - controller/components/ui/BoundedRawJson.tsx
    - controller/components/tools/commandParams.ts
    - controller/test/boundedRawJson.test.ts
    - controller/test/toolPageReply.test.ts
    - controller/test/commandParams.test.ts
  modified:
    - controller/pages/tools/[id].tsx
    - controller/components/tools/RunRecoverySection.tsx
    - controller/test/staticScan.test.ts

key-decisions:
  - "Alias import (BoundedRawJson as LatchRawJson) keeps every RunRecoverySection usage site, prop and copy constant byte-identical — D-08 do-not-restructure honored through the extraction"
  - "staticScan's G-04-2 renderer pins re-targeted to the shared module; all usage-side pins stay on the card (the extraction necessarily moved the pinned renderer — Rule 3 deviation)"
  - "lastReply is a tri-state (undefined/null/reply) so the panel is born hidden AND a data-less completed send degrades to the muted No reply data returned. line (Pitfall 6 tolerance made legible, UI-SPEC AC-3)"
  - "Muted empty-state line uses useColorModeValue(gray.500, whiteAlpha.700) — theme-consistent muted text in both color modes, no new tokens"
  - "omitBlankParams recursion applies the blank drop one level deep for parentField groups; arrays and emptied groups pass through untouched (nothing in the plan drops them)"

patterns-established:
  - "Shared bounded display (BoundedRawJson + formatLatchRaw) — any future raw reply renders here, never a second styled copy (D-06)"
  - "Pure send-param transforms live in components/tools/commandParams.ts with unit tests, scoped per tool type at the send site"
  - "Static source scans (stripComments/read) pin page-level UI invariants — no jsdom/RTL in this repo"

requirements-completed: [GEN-02, GEN-03]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "One shared bounded raw-JSON display exists (BoundedRawJson + formatLatchRaw fallback chain) with styling byte-identical to the LatchRawJson it replaces"
    requirement: GEN-03
    verification:
      - kind: unit
        ref: "test/boundedRawJson.test.ts#formatLatchRaw fallback chain (D-06) (3 tests)"
        status: pass
      - kind: unit
        ref: "test/staticScan.test.ts#both latch states render raw text only through the bounded shared panel (styling needles on the shared file)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RunRecoverySection renders through the shared component with copy constants and latch flow unchanged (D-08)"
    requirement: GEN-03
    verification:
      - kind: unit
        ref: "test/staticScan.test.ts (43 tests: G-04-2 usage pins, copy pins, readClick collapsed pin, single-send-path scans)"
        status: pass
    human_judgment: false
  - id: D3
    description: "runCommand reply is captured only from the mutation onSuccess (data ?? null), the panel is born hidden, and every new send collapses the disclosure — no timers/polling/Enter-binding added"
    requirement: GEN-03
    verification:
      - kind: unit
        ref: "test/toolPageReply.test.ts#tool page reply panel (GEN-03, UI-SPEC AC-3) (5 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reply meta_data panel renders read-only under the Send button (heading, bounded shared display or muted No reply data returned. line) in both color modes"
    requirement: GEN-03
    verification: []
    human_judgment: true
    rationale: "The repo has no jsdom/RTL — rendered appearance (born hidden, heading style, muted line, bounded 160px panel) is the manual STACK-read retest already listed in 05-VALIDATION.md's Manual-Only table"
  - id: D5
    description: "omitBlankParams drops empty-string/undefined/null keys, keeps 0/false/arrays/strings, strips one nested record level, never mutates its input; handleSubmit scopes the strip to STACK tool types so F.A.S.T. params pass verbatim"
    requirement: GEN-02
    verification:
      - kind: unit
        ref: "test/commandParams.test.ts#omitBlankParams (D-04: STACK sends omit blanks) (5 tests)"
        status: pass
      - kind: unit
        ref: "test/toolPageReply.test.ts#born-empty display contract (UI-SPEC AC-4) (2 source-scan tests incl. the STACK-only ternary pin)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Born-empty display contract on the page: untouched STACK number/boolean fields render empty — no painted 0/false — while genuinely typed values (including real 0/false) render as before"
    requirement: GEN-02
    verification:
      - kind: unit
        ref: "test/toolPageReply.test.ts#no painted false/0 fallback remains in renderFields"
        status: pass
    human_judgment: true
    rationale: "The fallback removal is machine-pinned at source level, but the on-screen empty render is visual; no jsdom/RTL in this repo — held out as the manual retest in 05-VALIDATION.md (same disposition as the UI-SPEC overflow backstop row)"

# Metrics
duration: 5 min
completed: 2026-11-02
status: complete
---

# Phase 5 Plan 02: Tool-Page STACK Display Summary

**STACK tool pages now render born-empty command fields, a born-hidden Reply meta_data panel through the ONE shared bounded raw-JSON display, and a blank-omitting STACK send that leaves F.A.S.T. wire behavior byte-identical**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-02T03:09:27Z
- **Completed:** 2026-11-02T03:14:07Z
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- Extracted `LatchRawJson` + `formatLatchRaw` from `RunRecoverySection.tsx` into the shared `components/ui/BoundedRawJson.tsx` (D-06, UI-SPEC AC-2) — the card renders through it unchanged via an alias import; the tool page reuses the same component for replies
- The tool page keeps the `runCommand` reply instead of discarding it (GEN-03): tri-state `lastReply` set only from the mutation's `onSuccess` (`data ?? null`), a born-hidden Reply meta_data panel under the Send button (read-only, display-only), a muted "No reply data returned." line when the server sends no reply data (Pitfall 6), and the disclosure collapsed again on every send (UI-SPEC rule 7)
- Born-empty display contract (GEN-02 display half, UI-SPEC AC-4): the boolean and NumberInput branches' `||`-fallbacks became `?? ""` — untouched fields render empty, real 0/false still render; no Switch; `formValues` seeding and `handleInputChange` untouched
- Blank-omitting STACK send (D-04 planner decision): pure `omitBlankParams` strips empty-string/undefined/null params (keeping operator-typed 0/false, arrays, one nested level) applied ONLY when `String(config?.type) === "stack"` — every other tool type sends `formValues` verbatim
- 15 new tests (3 + 7 + 5) plus the full suite green: 28 files / 588 tests, `tsc --noEmit` clean, `prettier . --check` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract BoundedRawJson + formatLatchRaw into one shared display** - `d461742` (feat)
2. **Task 2: Capture the runCommand reply and render the Reply meta_data panel** - `181f34a` (feat)
3. **Task 3: Born-empty field display + blank-omitting STACK send** - `5bc8375` (feat)

**Plan metadata:** the docs commit that introduces this SUMMARY file (immediately follows the task commits; see `git log --oneline`).

## Files Created/Modified
- `controller/components/ui/BoundedRawJson.tsx` - created — the one shared bounded raw-JSON display (`BoundedRawJson`, `formatLatchRaw`)
- `controller/components/tools/commandParams.ts` - created — pure `omitBlankParams` (D-04 blank-omitting strip)
- `controller/pages/tools/[id].tsx` - modified — `lastReply` tri-state, Reply meta_data panel, born-empty renderFields fallbacks, STACK-scoped strip in `handleSubmit`
- `controller/components/tools/RunRecoverySection.tsx` - modified — local display definitions removed; renders through the shared component (alias import); copy constants and latch flow unchanged
- `controller/test/boundedRawJson.test.ts` - created — formatLatchRaw fallback-chain unit tests
- `controller/test/toolPageReply.test.ts` - created — static source invariants for the reply panel and the born-empty fallbacks
- `controller/test/commandParams.test.ts` - created — omitBlankParams unit tests
- `controller/test/staticScan.test.ts` - modified — G-04-2 block re-targeted to the shared module (deviation below)

## Decisions Made
- Alias import (`BoundedRawJson as LatchRawJson`) instead of renaming usage sites: the extraction stays mechanical and every card usage/copy pin stays byte-identical (D-08)
- Tri-state reply capture (`undefined` born hidden / `null` completed send without data / reply object) — satisfies both the born-hidden rule and Pitfall 6's legible empty state with one state variable
- Muted line color via `useColorModeValue("gray.500", "whiteAlpha.700")` — the UI-SPEC calls for a "muted" line without naming a token; this is theme chrome consistent with the app's light/dark text colors
- `omitBlankParams` keeps nested groups that become empty after the strip (the plan specifies only the blank drop; no group-dropping semantics were specified or pinned)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] staticScan's G-04-2 block re-targeted to the shared module**
- **Found during:** Task 1 (extraction)
- **Issue:** The plan's action ("delete the local formatLatchRaw and LatchRawJson definitions and import both from the shared module") contradicts its acceptance criterion "The existing staticScan suite passes unmodified": `staticScan.test.ts`'s "latch raw reply stays in one bounded collapsible (G-04-2)" block pinned `function LatchRawJson(`, the styling needles, and a `formatLatchRaw(`-count of 2 INSIDE `RunRecoverySection.tsx` — all necessarily removed by the extraction. No implementation could satisfy both.
- **Fix:** Re-targeted the block's renderer-internals assertions (same needles, same Collapse→bound→format ordering, same display-only scan) to `components/ui/BoundedRawJson.tsx`; kept every usage-side pin on the card (exactly 2 `<LatchRawJson` renders via the alias, unknown/latched branch ordering, no `dangerouslySetInnerHTML`) and the `readClick` collapsed-start pin unchanged. The invariant's intent — exactly one bounded display, raw text only through it — is preserved and now also covers the tool page's usage.
- **Files modified:** controller/test/staticScan.test.ts
- **Verification:** `npx vitest run test/staticScan.test.ts` → 43/43 pass
- **Committed in:** d461742 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The one deviation was forced by the plan's own action/criterion contradiction and preserves the scanned invariant's intent. No scope creep.

## Issues Encountered
- None beyond the deviation above (the prettier gate required a `--write` pass over two touched files, which then passed `--check`).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 05-03: `omitBlankParams` output shape (omitted blanks, kept 0/false) is exactly what 05-03's blank-optional wire case must pin against the real encoder; the shared `BoundedRawJson` and the captured reply are in place for the UAT STACK-read retest.
- GEN-02 is NOT marked complete yet — it is shared with 05-03 (shared-ID gate), and 05-03's own close-out will mark it when its SUMMARY exists. GEN-03 (page half) is done here; the adapter must set `return_reply` for real data at UAT (RESEARCH assumption A1, Pitfall 6).
- The command panel now renders for STACK because 05-01's `commandFields.stack` exists — the "Invalid Tool Type" alert is gone from STACK tool pages (verified indirectly via the flipped OPR-05 scan and the green suite).

---
*Phase: 05-stack-codegen-command-forms*
*Completed: 2026-11-02*

## Self-Check: PASSED

- All 5 created files exist on disk (verified with `[ -f ]`).
- All 4 commits (d461742, 181f34a, 5bc8375, f2994d0) are ancestors of HEAD.
- `gsd-tools check evaluation-scope --plan 05-02 --commits-only` → resolved, 4 commits on this branch.
- Full unit suite at close: 28 files / 588 tests passed; `tsc --noEmit` 0 errors; `prettier . --check` clean.

