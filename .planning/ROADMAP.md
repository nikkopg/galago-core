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
- [ ] **Phase 2: Run Page Live Controls** - Control bar, `tool_paused` prompt, Stop confirmation and
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
**Plans**: 3/6 plans executed
**Wave 1**
- [x] 02-01-PLAN.md — Control bar and the shared confirmed-send path (tracer: confirmed Pause end to end)
- [x] 02-04-PLAN.md — tool.recoveryControl mutation and fast abort/resume removed from the step editor

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — tool_paused prompt: reason, plain-language detail, start time, episode lifecycle
- [ ] 02-03-PLAN.md — Stop interception: Pause queue, Clear All and running-run delete abort first
- [ ] 02-05-PLAN.md — Tool-page Run Recovery card through the shared confirm modal

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 02-06-PLAN.md — UI-08 static-scan invariants and the D-25 gate

**UI hint**: yes

## Backlog

(none)
