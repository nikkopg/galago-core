---
gsd_state_version: "1.0"
milestone: v2
milestone_name: STACK tool support — codegen, operator acknowledge, error visibility, F5
current_phase: 4
current_phase_name: Operator-only Commands & STACK Acknowledge
status: planning
stopped_at: Phase 4 context gathered
last_updated: "2026-10-29T04:58:05.152Z"
last_activity: 2026-10-29
last_activity_desc: Phase 03 complete, transitioned to Phase 4
state_head: 468531e65f1ede496ca4e0882633ab0a1521e062
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 7
  completed_plans: 7
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-29)

**Core value:** While an instrument step runs, the operator sees what the instrument is doing and
decides every recovery action; the web app never acts on its own or pre-selects a physical decision.
**Current focus:** Phase 4 — Operator-only Commands & STACK Acknowledge

## Current Position

Phase: 4 — Operator-only Commands & STACK Acknowledge
Plan: Not started
Status: Ready to plan
Last activity: 2026-10-29 — Phase 03 complete, transitioned to Phase 4

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 02 | 6 | - | - |
| 03 | 7 | - | - |

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
| Phase 3 P01 | 30 min | 2 tasks | 4 files |
| Phase 3 P02 | 15 min | 2 tasks | 1 files |
| Phase 03 P03 | 3 min | 2 tasks | 4 files |
| Phase 3 P04 | 15min | 2 tasks | 8 files |
| Phase 3 P05 | 6 min | 2 tasks | 5 files |
| Phase 3 P06 | 10 min | 3 tasks | 5 files |
| Phase 03 P07 | 20 min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
v1 decisions are archived in `milestones/v1-ROADMAP.md` (Milestone Summary) and PROJECT.md.
Recent decisions affecting current work:

- [Roadmap v2]: Phase order is F5 + F3 (3) → operator acknowledge (4) → STACK codegen (5), the user's
  build order; F5 and F3 merged into one phase (2026-10-28, user decision) since they share files.
- [Roadmap v2]: Phase 4 is built on string tool types and `"stack" as ToolType` fakes, so it does not wait
  for `stack.proto`; only Phase 5 is hard-gated on galago-tools Phase 4.
- [Roadmap v2]: `stack` is NOT added to `runControl`; the acknowledge uses a recovery-only spec plus one
  operator-only command table (ACK-AND-F3.md §1.2, §2.2).
- [Phase 3]: 03-01: single-flight guard is the first statement of CommandQueue._start; an ignored Start logs 'Queue Start Ignored' and changes nothing
- [Phase 3]: 03-01: Start listing read via synchronous SqliteQueue.queuedRowsSync (no await before the _runningPromise claim), capped at 50 rows
- [Phase 3]: 03-02: errorPath.test.ts committed RED by design (D-10); 30 of 45 cases fail on assertions until 03-04, run wave gates with --exclude test/errorPath.test.ts
- [Phase 03]: 03-03: Start summary counts come from queue-joined commandQueue.commands, not getAll; STARTED rows shown on a separate line and excluded from will-run
- [Phase 3]: 03-04: whitespace-only error_message counts as empty; SUCCESS+message is thrown as ERROR_FROM_TOOL; _failureSeq seeded from Date.now()
- [Phase 3]: 03-05: RunStatus not widened; COMPLETED_WITH_SKIPPED_FAILURE is a client-only outcome derived from polled rows, FAILED takes precedence over a COMPLETED last row
- [Phase 3]: 03-05: storedErrorText is the shared reader of a persisted row error so the run outcome and 03-06 step card cannot drift
- [Phase 3]: 03-06: banner dismiss stores only dismissedSeq (errorSeq of shown payload); never clears, restarts or acts on the queue
- [Phase 3]: 03-06: step card error text placed between CommandImage and sticky label; skipped-with-error card at full opacity
- [Phase 03]: 03-07: step-card error text placed beside CommandImage in one HStack row (amends D-17/UA2) so the fixed 165px card never overflows (G-03-3)

### Pending Todos

- [2026-10-15] [ui] Evaluate whether expected_tray_id is still needed — [todo file](.planning/todos/pending/2026-10-15-evaluate-whether-expected-tray-id-is-still-needed.md) — Needs TBD. Decide before removing anything:.
- [2026-10-15] [ui] Fetch F.A.S.T. plate list for source/dest plate dropdowns — [todo file](.planning/todos/pending/2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md) — Needs TBD. A likely shape:.

### Blockers/Concerns

- [Phase 5]: Hard-gated on galago-tools Phase 4 pushing the frozen `stack.proto` to `feat/stack-tool`
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
- [Phase 3]: `03-REVIEW-DISPOSITION.md` has 4 open advisories after the 03-07 re-review: WR-01 the
  G-03-3 scan accepts `flexShrink={0}` anywhere in the row; WR-02 an 8px gap before the error text
  when a tool has no image (cosmetic); IN-01 full card error is hover-only; IN-02 label scan is
  whitespace-sensitive. The earlier WR-01/WR-02 `fixed` rows (5191ffe) were dropped by id reuse.
  The G-03-3 live fit retest was waived by the user (marked pass).
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

Last session: 2026-10-29T04:58:05.109Z
Stopped at: Phase 4 context gathered
Resume file: .planning/phases/04-operator-only-commands-stack-acknowledge/04-CONTEXT.md

## Operator Next Steps

- Plan Phase 4 with /gsd-plan-phase 4 (or /gsd-discuss-phase 4 first)
