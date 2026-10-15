# Milestone v1: Live Run Control (queue & run page)

**Status:** ✅ SHIPPED 2026-10-16
**Phases:** 1-2
**Total Plans:** 11 (24 tasks)

## Overview

From the run page, the operator can pause, resume and abort a running controllable step, an
instrument-initiated pause becomes a prompt with the instrument's reason, and Stop never leaves an
instrument run untracked. The full roadmap as it stood at close follows.

---

# Roadmap: galago-core (nikkopg fork) — Live Run Control

## Milestones

- 🚧 **v1 Live Run Control (queue & run page)** — Phases 1-2 (in progress)

## Phases

### 🚧 v1 Live Run Control (In Progress)

**Milestone Goal:** From the run page, the operator can pause, resume and abort a running
controllable step, an instrument pause becomes a prompt with the instrument's reason, and Stop never
leaves an instrument run untracked. Governing design: galago-tools
`docs/specs/2026-10-12-galago-live-run-control-design.md`. Companion milestone: galago-tools
"F.A.S.T. Live Run Control (adapter & rollout)".

- [x] **Phase 1: Queue Control Path & Run State** - tRPC control path to the running step's tool, a (completed 2026-10-13)
  generic `runControl` capability, a `runState` query and a heartbeat that retries.
- [x] **Phase 2: Run Page Live Controls** - Control bar, `tool_paused` prompt, Stop confirmation and (completed 2026-10-15)
  step-editor cleanup, with every decision explicit and confirmed.

## Phase Details

### Phase 1: Queue Control Path & Run State

**Goal**: The server side can send an operator's Pause/Resume/Abort to the running step's tool and
report that tool's live run state, without touching the queue's busy loop.
**Depends on**: Nothing to start (mock the tool); QUE-06 needs galago-tools Phase 1's proto commit
**Requirements**: QUE-01, QUE-02, QUE-03, QUE-04, QUE-05, QUE-06
**Success Criteria** (what must be TRUE):
  1. `toolControl` reaches the running step's tool while its `executeCommand` is still pending, and
     the busy loop's promise is unaffected; it refuses with no running step, a tool without
     `runControl`, or a blank decision.
  2. `runState` returns the running tool's `run_state` and is independent of `modalState`.
  3. A failed status poll shows "run state unknown" and the heartbeat keeps retrying.
  4. Generated interfaces include `run_state` and `Pause` (ts-proto 1.151.1), and `tsc` reports 0 errors.

**Plans**: TBD
- [x] 01-01-PLAN.md
- [x] 01-02-PLAN.md
- [x] 01-03-PLAN.md
- [x] 01-04-PLAN.md
- [x] 01-05-PLAN.md

**Research flags**: whether `runState` polling races the existing `modalState`/queue queries
(research Pitfall 9) is worth a short design spike at plan time.

### Phase 2: Run Page Live Controls

**Goal**: The operator controls a running instrument step from the run page, with explicit,
confirmed decisions, and is prompted when the instrument pauses itself.
**Depends on**: Phase 1
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08
**Success Criteria** (what must be TRUE):
  1. A controllable running step shows state, percent and Pause/Resume/Abort; every action asks for
     confirmation, Resume/Abort require a yes/no choice with nothing preselected.
  2. A pause opens the `tool_paused` prompt within about 2 s with reason, plain-language detail and
     start time; it closes on resume or step end and never resolves or blocks the queue.
  3. Stop during a controllable step opens a new no-timer, no-default confirmation; dismissing it is
     Cancel; `StopRunModal` is not used for it.
  4. abort/resume no longer appear in the protocol step editor; the tool page offers crash-recovery
     Resume/Abort.
  5. Tests show no code path sends a control action without an operator's confirmed choice, and
     galago-core holds no instrument-state check.
**Plans**: 6/6 plans complete
**Wave 1**
- [x] 02-01-PLAN.md — Control bar and the shared confirmed-send path (tracer: confirmed Pause end to end)
- [x] 02-04-PLAN.md — tool.recoveryControl mutation and fast abort/resume removed from the step editor

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — tool_paused prompt: reason, plain-language detail, start time, episode lifecycle
- [x] 02-03-PLAN.md — Stop interception: Pause queue, Clear All and running-run delete abort first
- [x] 02-05-PLAN.md — Tool-page Run Recovery card through the shared confirm modal

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-06-PLAN.md — UI-08 static-scan invariants and the D-25 gate

**UI hint**: yes

## Backlog

(none)

---

## Milestone Summary

**Decimal Phases:** none. Four quick tasks were run instead of inserted phases (archived in
`milestones/v1-quick/`): f48 (pause prompt wording for WrongPlateType), h0q (operator-aborted fail
in SqliteQueue), o44 (dequeue the rest of an aborted run), t9e (busy-loop catch treats a step row
already removed by Clear All/delete-run as handled).

**Key Decisions:**
- Plan per repo: galago-core owns queue + tRPC + run page; galago-tools owns adapter + rollout
- Running step tracked in memory, not read from SQLite `STARTED` rows
- `tool_paused` reads its own `runState` query, never the queue's blocking modal state
- Stop / Clear All / delete-running-run abort first, act on the queue only after the abort is accepted
- UI-08 proven with pure-logic tests plus static source scans (no jsdom/RTL)
- Vitest 2.1.9 as the controller's first unit-test runner; `tsc --noEmit` stays the type gate

**Issues Resolved:**
- INT-01 (milestone audit, 2026-10-15): Clear All / delete-run racing an accepted abort left the
  queue FAILED with "Item N not found" — fixed by quick task t9e (1b5048d, 5839b40)
- Heartbeat stopped after one failed status poll (all tool types) — fixed in Phase 1
- 02-03-SUMMARY.md frontmatter YAML repaired at close

**Issues Deferred:**
- Todo: evaluate whether `expected_tray_id` is still needed
- Todo: fetch the F.A.S.T. plate list for source/dest plate dropdowns
- 02-REVIEW-DISPOSITION.md advisories: WR-01 (`goto` accepts null/"" as 0), WR-02 (accepted abort
  whose step then resolves does not dequeue the rest of the run), WR-03 (`structuredClone` can throw
  on a non-cloneable `pause.detail`), WR-04 (`complete()` has no `_hasItem` guard), IN-01
  (`tip_reuse` select has no default)

**Technical Debt Incurred:**
- Phase 1 VERIFICATION.md predates t9e's `command_queue.ts` change (covered by Phase 2's
  re-verification, not by a Phase 1 re-run); milestone audit was not re-run after t9e
- Transport-error toast never observed live (same code path as the refusal toast)
- F5 (non-idempotent `transfer` re-run) and F3 (run UI hides tool errors) remain out of scope

---

_For current project status, see .planning/ROADMAP.md_
