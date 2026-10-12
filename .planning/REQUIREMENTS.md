# Requirements: galago-core — v1 Live Run Control (queue & run page)

**Defined:** 2026-10-12
**Core Value:** While an instrument step runs, the operator sees what the instrument is doing and
decides every recovery action; the web app never acts on its own or pre-selects a physical decision.
**Governing design:** galago-tools `docs/specs/2026-10-12-galago-live-run-control-design.md`
**Companion:** galago-tools `.planning/REQUIREMENTS.md` (ADP-*, LIVE-*). Together the two sets carry
the 25 requirements approved on 2026-10-12; each requirement below names the original ID(s).

## Milestone Requirements

### Queue control path and run state (QUE)

- [x] **QUE-01**: A `commandQueue.toolControl({action, params})` tRPC call sends Pause/Resume/Abort straight to the tool of the currently running step (not enqueued, not stored as a step, never awaited by the busy loop) and logs the action with the operator's choices — *RCTL-01, RCTL-02, RCTL-03*
- [x] **QUE-02**: `toolControl` refuses when no step is running, when the running step's tool type has no `runControl` entry, or when a decision value is blank or unclear; the queue gains an accessor for the running (`STARTED`) step — *RCTL-08, RSAFE-02*
- [x] **QUE-03**: Each tool type declares live run control in a `runControl` entry, separate from `commandFields`; the F.A.S.T. declares pause, resume (`is_tip_broken` yes/no) and abort (`return_liquid` yes/no) — *RCTL-08*
- [ ] **QUE-04**: A `commandQueue.runState` query returns the running step's tool `run_state` (state, percent, pause info), independent of `modalState` and the queue's `UIMessage` modals — *RSTATE-01, PAUSE-03*
- [ ] **QUE-05**: A failed status poll reports "run state unknown" and keeps retrying; `Tool.fetchStatus` no longer stops the heartbeat after a single failure — *RSTATE-03*
- [ ] **QUE-06**: Generated interfaces include `StatusReply.run_state` and the F.A.S.T. `Pause` command (submodule bumped to the galago-tools commit, regenerated with ts-proto 1.151.1), and `tsc` stays at 0 errors — *RSTATE-01*

### Run page live controls (UI)

- [ ] **UI-01**: While a controllable step runs, the run page shows a control bar with its state and percent (refreshed every 2 s) and Pause/Resume/Abort enabled according to run state; tools without `runControl` show none — *RSTATE-02, RCTL-08*
- [ ] **UI-02**: Every control action asks for confirmation before anything is sent — *RCTL-04*
- [ ] **UI-03**: Resume requires "tip broken? yes/no" and Abort requires "return liquid? yes/no"; nothing is preselected and the action stays disabled until a choice is made — *RCTL-02, RCTL-03, RSAFE-02*
- [ ] **UI-04**: An instrument pause opens a `tool_paused` prompt within about 2 s with the reason (name and code), the detail in plain language (e.g. "Deck 3: expected plate 1, found none") and when it started — *PAUSE-01, PAUSE-02*
- [ ] **UI-05**: The `tool_paused` prompt offers Resume and Abort, closes when the run resumes or the step ends, and never resolves, advances or blocks the queue — *PAUSE-03*
- [ ] **UI-06**: Stop during a controllable step opens a new confirmation, "abort the instrument run (return liquid? yes/no)" or Cancel, with no timer and no default; dismissing it means Cancel; `StopRunModal` is not reused — *RCTL-06*
- [ ] **UI-07**: abort/resume are removed from the protocol step editor; the tool page offers Resume/Abort separately for crash recovery when no step is tracking a run — *RCTL-07*
- [ ] **UI-08**: No galago-core code path sends Pause/Resume/Abort except an operator's confirmed action, and galago-core adds no instrument-state check (the core gates) — *RSAFE-01, RSAFE-03*

## Future Requirements

- **Hard pause** — explicit, non-defaulted choice once `hardPause` is documented (D5)
- **Second `runControl` tool type** — prove the generic path
- **Simulated pause in the UI end to end** — galago-tools provides the hook (ADP-10); a scripted UI
  test against it could follow

## Out of Scope

| Feature | Reason |
|---------|--------|
| Software-initiated pause/resume/abort | Operator-only invariant (design §7) |
| F5 (queue re-ran a transfer 3 times), F3 (run UI hides tool errors) | Tracked debt, out by user decision (2026-10-12) |
| Adapter, re-pin, deploy and live acceptance | Planned in galago-tools' `.planning/` |
| Hard pause | Undocumented instrument behaviour (D5) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| QUE-01 | Phase 1 | Complete |
| QUE-02 | Phase 1 | Complete |
| QUE-03 | Phase 1 | Complete |
| QUE-04 | Phase 1 | Pending |
| QUE-05 | Phase 1 | Pending |
| QUE-06 | Phase 1 | Pending |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 2 | Pending |
| UI-03 | Phase 2 | Pending |
| UI-04 | Phase 2 | Pending |
| UI-05 | Phase 2 | Pending |
| UI-06 | Phase 2 | Pending |
| UI-07 | Phase 2 | Pending |
| UI-08 | Phase 2 | Pending |

**Coverage:**
- Milestone requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-12*
*Last updated: 2026-10-12 after moving the Galago planning out of fast-mcp*
