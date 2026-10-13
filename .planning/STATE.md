---
gsd_state_version: "1.0"
milestone: v1
milestone_name: Live Run Control (queue & run page)
current_phase: 2
current_phase_name: Run Page Live Controls
status: planning
stopped_at: Phase 1 complete, ready to plan Phase 2
last_updated: "2026-10-13T07:53:27.122Z"
last_activity: 2026-10-13
last_activity_desc: Phase 01 complete, transitioned to Phase 2
state_head: fcf5cae75257ed49cfb74e9ff13ead3355170f56
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-13)

**Core value:** While an instrument step runs, the operator sees what the instrument is doing and
decides every recovery action; the web app never acts on its own or pre-selects a physical decision.
**Current focus:** Phase 2 — Run Page Live Controls

## Current Position

Phase: 2 — Run Page Live Controls
Plan: Not started
Status: Ready to plan
Last activity: 2026-10-13 — Phase 01 complete, transitioned to Phase 2

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Residual race accepted in UAT: a control command sent while a step ends during the
  gRPC round trip can reach the next step on the same tool; the F.A.S.T. core's state gates protect.
  Phase 2's control bar should show refusals and never update optimistically.
- [Phase 1]: IN-01 still open (info): `RunStateMonitor.snapshot()` returns a shallow copy, so Phase 2
  consumers must not mutate the nested `runState`/`pause` objects.
- [Phase 2]: Never reuse `StopRunModal` (auto-confirms after 5 s) or the `UIMessage` plumbing
  (resolves the step) for live control.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-13T07:53:27.089Z
Stopped at: Phase 1 complete, ready to plan Phase 2
Resume file: None
