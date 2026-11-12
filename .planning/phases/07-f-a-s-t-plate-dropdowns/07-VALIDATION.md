---
phase: "07"
slug: "f-a-s-t-plate-dropdowns"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-12"
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `07-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9, `environment: "node"`, no jsdom; `react` is not importable under Vitest |
| **Config file** | `controller/vitest.config.mts` |
| **Quick run command** | `cd controller && npx vitest run test/wellGeometry.test.ts test/toolOptions.parse.test.ts test/toolOptions.read.test.ts test/toolOptionsRouter.test.ts test/fieldOptions.test.ts test/staticScan.test.ts test/commandFields.test.ts test/wire.test.ts` |
| **Full suite command** | `cd controller && npx tsc --noEmit && npx vitest run && npx prettier . --check && npx next lint --no-cache --quiet && npm run build` |
| **Estimated runtime** | ~5 seconds (quick), ~200 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run `cd controller && npx tsc --noEmit && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

Filled in by the planner/executor per task. Requirement → test map:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| PLT-01 | Frozen `get_plates` commit answers via `ExecuteCommand` mid-Transfer | shell gate | `git -C vendor/galago-tools log --oneline 4ccd3da..origin/feat/stack-tool` + read diff/test | n/a | ⬜ pending |
| PLT-02 | Re-pin; regen diff is exactly `GetPlates` + oneof 11 in `fast.ts` | shell gate + unit | scratch regen `diff -r`; `npx vitest run test/wire.test.ts` | ❌ W0 (gated) | ⬜ pending |
| PLT-03 | `fast.plates` → options `"{id} · {description}"`, numeric value | unit | `npx vitest run test/toolOptions.parse.test.ts test/fieldOptions.test.ts` | ❌ W0 | ⬜ pending |
| PLT-04 | Bad ids dropped/degraded, duplicates flagged, unset plate/deck never saved as `0` | unit + scan | `npx vitest run test/toolOptions.parse.test.ts test/fieldOptions.test.ts test/staticScan.test.ts` | ❌ W0 | ⬜ pending |
| PLT-05 | `get_plates` in no `commandFields`; `fast.plates` in the closed registry | scan | `npx vitest run test/staticScan.test.ts test/commandFields.test.ts` | extend existing | ⬜ pending |
| PLT-06 | Decks 1-6 from one constant, born empty, bad saved values flagged | unit + scan | `npx vitest run test/fieldOptions.test.ts test/staticScan.test.ts` | ❌ W0 | ⬜ pending |
| PLT-07 | `tip_reuse` checkbox defaults `reuse`; blank/other indeterminate + flag | unit | `npx vitest run test/fieldOptions.test.ts` | ❌ W0 | ⬜ pending |
| PLT-08 | Row codec, drag rect, hit-test, patches, status lines, force-open | unit | `npx vitest run test/wellGeometry.test.ts` | ❌ W0 | ⬜ pending |
| PLT-09 | Fit check, unshowable row, `(rows, cols)` tuple size mismatch | unit | `npx vitest run test/wellGeometry.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `controller/test/wellGeometry.test.ts` — PLT-08, PLT-09
- [ ] `controller/test/fixtures/fastPlates.ts` — golden from fast-mcp characterization test, plus a 384 entry and bad-entry variants
- [ ] Extend `test/toolOptions.parse.test.ts`, `test/toolOptions.read.test.ts`, `test/toolOptionsRouter.test.ts` — `fast.plates`
- [ ] Extend `test/fieldOptions.test.ts` — static/deck, plate options/geometry, checkbox, `newStepDefaults`, no-zero-fill; edit the three existing pins deliberately
- [ ] Extend `test/staticScan.test.ts` — five `OPTION_SOURCES`, no `get_plates` in `commandFields`, WellPicker scans (no `useEffect`, no `elementFromPoint`, handles `onPointerCancel`), `DECK_SLOTS` defined once
- [ ] Pure fill-in helper test proving untouched plate/deck fields are never saved as `0`
- Framework install: none

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Source drag, destination hover footprint/click, Clear selection | PLT-08 | No DOM in Vitest | Drag on source grid in each host; fields sync; destination click places footprint; misfit shows red and writes nothing |
| "Edit as fields" force-opens | PLT-08/09 | Rendering | Hidden grid, `{{variable}}` well field, flagged value |
| 96 vs 384 mismatch warning | PLT-09 | Needs real plate list | After gate: 8x12 source, 16x24 destination |
| Modal/drawer layout | D-11 | Visual | No horizontal overflow; 384 grids fit |
| Checkbox states | PLT-07 | Rendering | New step checked; saved `""`/`"cold"` indeterminate + flag |
| Offline numeric fallback | PLT-03 | Rendering | Stop F.A.S.T. tool server; typed fields numeric-only |
| Live plate list mid-Transfer | PLT-01 | Instrument | Supervised run after gate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
