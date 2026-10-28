---
gsd_state_version: "1.0"
milestone: v2
milestone_name: STACK tool support — codegen, operator acknowledge, error visibility, F5
status: planning
last_updated: "2026-10-28T13:37:01.000Z"
last_activity: 2026-10-28
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-28)

**Core value:** While an instrument step runs, the operator sees what the instrument is doing and
decides every recovery action; the web app never acts on its own or pre-selects a physical decision.
**Current focus:** Phase 3 — Queue Start Guard & Visibility (milestone v2, STACK tool support)

## Current Position

Phase: 3 of 6 (Queue Start Guard & Visibility) — first of 4 phases in v2 (Phases 3-6)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-10-28 — Roadmap v2 created (4 phases, 17/17 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 02 | 6 | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 20 min | 3 tasks | 6 files |
| Phase 01 P02 | ~35min | 2 tasks | 6 files |
| Phase 01 P03 | 18min | 2 tasks | 4 files |
| Phase 01 P04 | ~15min | 2 tasks | 2 files |
| Phase 01 P05 | ~45min | 3 tasks | 5 files |
| Phase 02 P01 | 55min | 2 tasks | 9 files |
| Phase 02 P04 | 45 min | 2 tasks | 5 files |
| Phase 02 P02 | 50min | 2 tasks | 4 files |
| Phase 02 P03 | 35 min | 2 tasks | 5 files |
| Phase 02 P05 | 40 min | 2 tasks | 7 files |
| Phase 02-run-page-live-controls P06 | 25min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
v1 decisions are archived in `milestones/v1-ROADMAP.md` (Milestone Summary) and PROJECT.md.
Recent decisions affecting current work:

- [Roadmap v2]: Phase order is F5 (3) → F3 (4) → operator acknowledge (5) → STACK codegen (6), the user's
  build order; Phases 3 and 4 have no dependency on each other.
- [Roadmap v2]: Phase 5 is built on string tool types and `"stack" as ToolType` fakes, so it does not wait
  for `stack.proto`; only Phase 6 is hard-gated on galago-tools Phase 4.
- [Roadmap v2]: `stack` is NOT added to `runControl`; the acknowledge uses a recovery-only spec plus one
  operator-only command table (ACK-AND-F3.md §1.2, §2.2).

### Pending Todos

- [2026-10-15] [ui] Evaluate whether expected_tray_id is still needed — [todo file](.planning/todos/pending/2026-10-15-evaluate-whether-expected-tray-id-is-still-needed.md) — Needs TBD. Decide before removing anything:.
- [2026-10-15] [ui] Fetch F.A.S.T. plate list for source/dest plate dropdowns — [todo file](.planning/todos/pending/2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md) — Needs TBD. A likely shape:.

### Blockers/Concerns

- [Phase 6]: Hard-gated on galago-tools Phase 4 pushing the frozen `stack.proto` to `feat/stack-tool`
  (not there yet). A needed `stack.proto` change or a stack-automation-layer gap stops the work and is
  noted for the user; it is never patched here.
- [Phase 2]: Re-review on 2026-10-16 (`02-REVIEW.md`, diff since 3cfb240) left 4 warnings and 1 info
  open in `02-REVIEW-DISPOSITION.md`: WR-01 `goto` accepts null/"" targetIndex as 0; WR-02 an
  accepted abort whose step then resolves does not dequeue the rest of the run; WR-03
  `RunStateMonitor.snapshot()` `structuredClone` can throw on a non-cloneable `pause.detail`;
  WR-04 `complete()` has no `_hasItem` guard, so the Clear All race logs "Item N not found";
  IN-01 `tip_reuse` select has no default value. Advisory; none violates a Phase 2 must-have.
- [Phase 2]: WR-05 (`d400c42`) supersedes D-08: the "head will move" note is now per-action
  (`runControlMovesHead`), hidden for the F.A.S.T. soft Pause.
- [Phase 2]: The real F.A.S.T. may still hold a paused run from the 2026-10-14 09:33 WrongPlateType
  test; clear it (Run Recovery → Abort, or on the instrument) before the next real run.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| todos | 2026-10-15-evaluate-whether-expected-tray-id-is-still-needed.md | (presence-only) | 2026-10-16 | v1 |
| todos | 2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md | (presence-only) | 2026-10-16 | v1 |

## Session Continuity

Last session: 2026-10-28
Stopped at: Roadmap v2 created; Phase 3 ready to plan
Resume file: None

## Operator Next Steps

- Plan Phase 3 with /gsd-plan-phase 3 (or /gsd-discuss-phase 3 first)
