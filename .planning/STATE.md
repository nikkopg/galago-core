---
gsd_state_version: "1.0"
milestone: v1
milestone_name: Live Run Control (queue & run page)
current_phase: 02
status: completed
stopped_at: Phase 02 complete — all phases complete
last_updated: "2026-10-15T22:48:56.293Z"
last_activity: 2026-10-16
last_activity_desc: Phase 02 complete
state_head: 716ef68c6cb4916ba992a6d13b09b7f6fe7f59ea
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 11
  completed_plans: 11
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-15)

**Core value:** While an instrument step runs, the operator sees what the instrument is doing and
decides every recovery action; the web app never acts on its own or pre-selects a physical decision.
**Current focus:** Milestone v1 complete — audit and close the milestone

## Current Position

Phase: 02
Plan: Not started
Status: All phases complete
Last activity: 2026-10-16 — Phase 02 re-verified after quick tasks h0q/o44/t9e (UAT 9/9, verification passed, 244 tests) and marked complete

Progress: [██████████] 100%

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
Recent decisions affecting current work:

- [Init]: Galago-side planning split per repo on 2026-10-12: this repo owns the queue, tRPC and run
  page; galago-tools owns the adapter, re-pin, deploy and live acceptance.
- [Phase 01]: Approved vitest@2.1.9 + vite-tsconfig-paths@5.1.4 (Set A) as controller's test runner, sidestepping the package-legitimacy 'too-new' flag on vitest's latest release cadence — Older, long-proven minor compatible with both node v24.14.1 (dev) and node 22.11 (Docker builder); tsc --noEmit stays the gate per D-20
- [Phase 01]: Task 1 (tracer) implemented toolControl's transport-error handling and full audit logging ahead of Task 2's planned split; Task 2's RED phase only drove the genuinely new undeclared-parameter refusal (check e)
- [Phase 01]: Heartbeat retry (D-15) and de-duplicated failure/recovery logging with a failure-streak counter (D-16) implemented in Tool.fetchStatus; the heartbeat no longer stops after a single failed poll, for every tool type.
- [Phase 01]: Pinned vendor/galago-tools to the exact human-approved SHA cb7886d1f3bdcdeeee71c55996f0dd62cf49ba7f rather than a newer FETCH_HEAD the remote had advanced to mid-task, per the checkpoint's pin-exactly instruction
- [Phase 01]: Phase 1 (Queue Control Path & Run State) complete: QUE-01 through QUE-06 proven on the real generated protobuf encoders after the galago-tools proto regeneration
- [Phase 02]: Task 1 (tracer) scoped to Pause only; RadioGroup rendering and multi-decision restateChoice deferred to Task 2's TDD cycle
- [Phase 02]: RunControlConfirmModal owns its own useConfirmedControlSend() call rather than receiving send as a prop, so every future control entry point gets consistent toast wiring
- [Phase 02]: runAfterAccepted (D-18) built now as a generic accepted-then-follow-up primitive for plan 02-03's sequenced abort-then-stop flow
- [Phase 02]: Task 1 (tracer) implemented recoveryControl's full refusal order, transport handling and audit logging in one pass; Task 2's TDD cycle was scoped to the two genuinely new assertions (commandFields.fast removal, inverted D-10 guard), mirroring the Phase 1 precedent
- [Phase 02]: tool.recoveryControl's action input stays z.string() at the schema level so a Pause attempt still reaches the handler's own refusal check and gets logged, rather than being silently rejected by zod
- [Phase 02]: Task 1 (tracer) absorbed the full pause formatters and the reducer's opening path, since the tracer's own end-to-end test needed real content formatting; Task 2's TDD cycle was scoped to the genuinely new closing/hide/reopen rules (D-11..D-13)
- [Phase 02]: Merged ControlBar's prompt-driven close effect and plan 02-01's bar-adjacency effect into one effect, so a prompt-origin confirm closed by a step-ended/queueId-change transition produces exactly one 'nothing was sent' toast, not two
- [Phase 02]: Task 1 (tracer) built the complete stopInterception.ts module up front (including shouldInterceptRunDelete), so Task 2's TDD RED phase found zero failing tests; the additions were committed as regression coverage and Task 2's GREEN commit implemented the genuinely new UI wiring (Clear All, per-run delete, stale-request close)
- [Phase 02]: Task 1 (tracer) implemented the full recovery routing and predicates needed for the end-to-end Resume path; Task 2's genuinely new RED/GREEN cycle was scoped to the normalizeToolKey export, mirroring the established tracer-preempts-TDD-RED pattern from 02-03/02-04
- [Phase 02]: useConfirmedControlSend() moved from the inner RunControlConfirmModalBody to the outer RunControlConfirmModal so a closeOnDispatch recovery send and its pending callbacks survive the modal closing
- [Phase 02-run-page-live-controls]: Scoped the countdown-stop-modal-reuse scan to callers of useConfirmedControlSend rather than any InstrumentStopModal reference, so the legitimate RunsComponent.tsx combination (InstrumentStopModal + pre-existing StopRunModal) doesn't false-fail
- [Phase 02-run-page-live-controls]: extractBracedRegion does true brace-depth, paren-aware matching (and steps past object-type return annotations) rather than textual next-declaration matching, for robust region extraction in the static scans

### Pending Todos

- [2026-10-15] [ui] Evaluate whether expected_tray_id is still needed — [todo file](.planning/todos/pending/2026-10-15-evaluate-whether-expected-tray-id-is-still-needed.md) — Needs TBD. Decide before removing anything:.
- [2026-10-15] [ui] Fetch F.A.S.T. plate list for source/dest plate dropdowns — [todo file](.planning/todos/pending/2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md) — Needs TBD. A likely shape:.

### Blockers/Concerns

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
| 261015-f48 | fix pausePrompt describeWrongDetectionEntry: render detectedPlateID -1 (no plate detected) as "none", add unit test | 2026-10-15 | e6b0e97 | [261015-f48-fix-pauseprompt-describewrongdetectionen](./quick/261015-f48-fix-pauseprompt-describewrongdetectionen/) |
| 261015-h0q | fix SqliteQueue: an operator-aborted (FAILED) command must not be re-run by startNext on the next queue start; add unit test | 2026-10-15 | e18a177 | [261015-h0q-fix-sqlitequeue-an-operator-aborted-fail](./quick/261015-h0q-fix-sqlitequeue-an-operator-aborted-fail/) |
| 261015-o44 | fix queue: on an accepted operator abort, dequeue the aborted run's remaining steps; never re-dispatch an orphaned STARTED step after a restart; gate the late-abort dequeue to the exact attempt (closes T-01-08); add tests | 2026-10-15 | 534ebd7 | [261015-o44-fix-queue-dequeue-an-aborted-run-s-remai](./quick/261015-o44-fix-queue-dequeue-an-aborted-run-s-remai/) |
| 261015-t9e | Busy-loop catch: treat a step row removed by Clear All/delete-run as already handled (abort and plain-failure paths) instead of throwing 'Item N not found'; add a test racing the follow-up against the step rejection | 2026-10-15 | 5839b40 | [261015-t9e-busy-loop-catch-treat-a-step-row-removed](./quick/261015-t9e-busy-loop-catch-treat-a-step-row-removed/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-16
Stopped at: Phase 02 complete — all phases complete, ready to complete milestone v1
Resume file: None
