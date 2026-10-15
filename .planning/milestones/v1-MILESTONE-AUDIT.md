---
milestone: v1
milestone_name: Live Run Control (queue & run page)
audited: 2026-10-15T12:00:00Z
status: gaps_found
scores:
  requirements: 14/14
  phases: 2/2
  integration: 8/9
  flows: 5/6
gaps:
  requirements: []
  integration:
    - id: INT-01
      from: "Phase 2 UI-06 interception (InstrumentStopModal → followUp clearAll / clearByRunId)"
      to: "Phase 1 accepted-abort bookkeeping (busy-loop catch → SqliteQueue.failAndDequeueRun)"
      requirements: [UI-06, QUE-01]
      severity: high
      issue: >-
        runAfterAccepted fires the Clear All / per-run-delete follow-up as soon as toolControl("abort")
        resolves ok:true. If that happens before the step's executeCommand rejects, clearAll/clearByRunId
        deletes the running step's row. The busy-loop catch then calls failAndDequeueRun on that row.
        _updateItem → find returns nothing and throws "Item N not found". The throw escapes the catch
        through _start, so the queue goes to FAILED and shows the raw internal error after an operator's
        clean, confirmed Clear All.
      evidence:
        - "controller/server/command_queue.ts:1334-1336 (failAndDequeueRun in busy-loop catch, no guard)"
        - "controller/server/utils/SqliteQueue.ts:545-556, 659-663 (throws when row missing)"
        - "controller/server/utils/SqliteQueue.ts:395-448 (clearAll / clearByRunId delete STARTED rows)"
        - "controller/components/runs/status/QueueStatuscomponent.tsx:74, RunsComponent.tsx:455-457 (follow-ups)"
        - "No test races the follow-up against the step's rejection; 237/237 tests pass"
      related_todo: ".planning/todos/pending/2026-10-15-queue-errors-item-not-found-after-clear-during-abort.md (covers the plain commands.fail path only; this is the abort path)"
      impact: >-
        No safety or data impact: the instrument aborts correctly and the rows are removed as intended.
        The queue's error state and message are wrong, and the operator has to clear an error they did
        not cause. Depends on the adapter acknowledging the abort before the Transfer RPC rejects.
        02-UAT Test 3 exercised "Pause queue" (stop does not delete rows), not Clear All or delete-run.
  flows:
    - id: FLOW-d
      name: "Clear All / delete running run during a controllable step"
      breaks_at: "busy-loop catch → failAndDequeueRun on a row the follow-up already deleted (INT-01)"
      requirements: [UI-06]
tech_debt:
  - phase: 02-run-page-live-controls
    items:
      - "02-VERIFICATION.md is stale: 9 code commits landed after it (949e7c7 WR-06, 142a7e9 WR-07-FOLLOWUP, 16318a8 IN-01, d400c42 WR-05, 957636d IN-02, quick 261015-f48, plus Phase 1's h0q/o44 queue changes). The suite is still 237/237 and tsc is clean, but no one re-verified the phase."
      - "02-VERIFICATION.md frontmatter says status: passed but the body says human_needed (16/17)"
      - "Transport-error toast never observed live (02-UAT Test 8 covered only the refusal half). The code path is the same as the refusal path (controlDecision.ts dispatch catch → notify.refused)."
      - "02-03-SUMMARY.md frontmatter is not valid YAML: line 15, a list item starts with a quoted scalar (\"Pause queue\" / Clear All ...). summary-extract fails on it."
  - phase: 01-queue-control-path-run-state
    items:
      - "Pending todo: Clear All / delete-run racing an ordinary (non-abort) step failure throws 'Item N not found' via commands.fail. Same root cause as INT-01."
  - phase: milestone
    items:
      - "STATE.md is stale: current_phase 01, completed_phases 1/2, 50%, while ROADMAP marks both phases complete"
      - "Future todos (not v1 scope): F.A.S.T. plate-list dropdowns; whether expected_tray_id is still needed"
nyquist:
  compliant_phases: [01, 02]
  partial_phases: []
  not_validated_phases: []
  missing_phases: []
  overall: compliant
---

# Milestone v1 Audit: Live Run Control (queue & run page)

**Audited:** 2026-10-15
**Status:** ⚠ gaps_found. All 14 requirements are satisfied, but one cross-phase flow breaks.
**Goal:** From the run page, the operator can pause, resume and abort a running controllable step.
An instrument pause becomes a prompt with the instrument's reason. Stop never leaves an instrument run
untracked.

## Scores

| Dimension | Score |
|---|---|
| Requirements | 14/14 satisfied |
| Phases verified | 2/2 (Phase 2's verification is stale; see tech debt) |
| Cross-phase links | 8/9 (each link works on its own; INT-01 breaks when two of them are combined) |
| E2E flows | 5/6 |
| Nyquist | 2/2 compliant |
| Security | 2/2 verified, threats_open 0 |
| UAT | 01: complete, 02: complete 8/8 |
| Tests / tsc (integration checker, current HEAD) | 237/237, 0 errors |

## Requirements Coverage (3-source cross-reference)

| REQ | Phase | VERIFICATION | SUMMARY `requirements-completed` | REQUIREMENTS.md | Final |
|---|---|---|---|---|---|
| QUE-01 | 1 | passed | 01-01, 01-02, 01-05 | [x] | satisfied |
| QUE-02 | 1 | passed | 01-01, 01-02 | [x] | satisfied |
| QUE-03 | 1 | passed | 01-02 | [x] | satisfied |
| QUE-04 | 1 | passed | 01-01, 01-03, 01-05 | [x] | satisfied |
| QUE-05 | 1 | passed | 01-01, 01-03, 01-04 | [x] | satisfied |
| QUE-06 | 1 | passed | 01-05 | [x] | satisfied |
| UI-01 | 2 | passed | 02-01 | [x] | satisfied |
| UI-02 | 2 | passed | 02-01, 02-06 | [x] | satisfied |
| UI-03 | 2 | passed | 02-01 | [x] | satisfied |
| UI-04 | 2 | passed | 02-02 | [x] | satisfied |
| UI-05 | 2 | passed | 02-02, 02-06 | [x] | satisfied |
| UI-06 | 2 | passed | 02-03*, 02-06 | [x] | satisfied (flow gap INT-01) |
| UI-07 | 2 | passed | 02-04, 02-05 | [x] | satisfied |
| UI-08 | 2 | passed | 02-01, 02-03*, 02-04, 02-05, 02-06 | [x] | satisfied |

\* Read by hand: 02-03-SUMMARY.md has `requirements-completed: [UI-06, UI-08]`, but the tool cannot
parse that file's frontmatter.

No requirement is orphaned: every REQ-ID in the traceability table appears in a phase VERIFICATION.

## Phase Verification Summary

| Phase | Status | Score | Notes |
|---|---|---|---|
| 01 Queue Control Path & Run State | passed | 4/4 SC, 37/37 truths, 5/5 quick-task truths | Re-verified after the h0q/o44 quick tasks and the review fixes. All review findings fixed. |
| 02 Run Page Live Controls | passed (body: human_needed) | 16/17 | 1 behavior left unverified (transport-error toast). Stale: 9 code commits landed after it. |

## Cross-Phase Integration

All expected links are wired. Nothing is orphaned or missing. The client's `controlDecision.ts`
imports the server's `runControl.ts` directly, so the capability map exists in one place and cannot
drift. `recoveryControl` reads the live `runningStep` accessor. No galago-core path reads instrument
state before it sends (UI-08 holds).

### INT-01: an accepted abort races the Clear All / delete-run follow-up (UI-06, QUE-01)

1. The operator clicks Clear All (or deletes the running run) during an F.A.S.T. step. `InstrumentStopModal`
   opens, with `followUp = clearAll` / `clearByRunId`.
2. The operator confirms the abort. `toolControl` resolves `ok:true` once the tool acknowledges.
   `runAfterAccepted` runs the follow-up right away.
3. `clearAll` / `clearByRunId` deletes the step's row while the step is still STARTED.
4. The step's `executeCommand` rejects. The busy-loop catch calls `failAndDequeueRun(queueId)`, which
   throws `Item N not found` (`SqliteQueue.ts:659-663`).
5. The throw escapes `_start`. The queue goes to FAILED and shows the raw internal error.

Verified by reading `command_queue.ts:1320-1349` and `SqliteQueue.ts:395-448, 545-556, 659-663`.
"Pause queue" (flow c) is not affected, because `stop()` does not delete rows. The pending todo
covers the same problem on the plain `commands.fail` path, so one fix should handle both. For
example, the busy-loop catch could treat a row the operator already removed as handled and log it as
"step removed by operator while running". It should also get a test that races the follow-up
against the step's rejection.

## E2E Flows

| Flow | Status |
|---|---|
| (a) Control bar Pause → Resume (tip broken?) | complete |
| (b) Instrument self-pause → `tool_paused` prompt → Abort (return liquid?) | complete |
| (c) Pause queue during a controllable step → abort → stop | complete |
| (d) Clear All / delete running run during a controllable step | **broken at INT-01** |
| (e) Crash recovery from the tool page (untracked tool) | complete |
| (f) Heartbeat failure → "run state unknown" | complete |

## Tech Debt

**Phase 02**
- 02-VERIFICATION.md is stale. Re-run it, because WR-05/06/07-FOLLOWUP, IN-01/02, quick task f48 and
  the Phase 1 queue changes all landed after it.
- The VERIFICATION frontmatter (`passed`) disagrees with its body (`human_needed`).
- The transport-error toast was never observed live. It shares its code path with the refusal toast.
- 02-03-SUMMARY.md frontmatter is not valid YAML (line 15: quote the whole list item).

**Phase 01**
- Pending todo: "Item N not found" when Clear All races an ordinary step failure. Same root cause as INT-01.

**Milestone**
- STATE.md is stale (says phase 01, 50%).
- Out of scope, kept as future todos: F.A.S.T. plate-list dropdowns, and whether `expected_tray_id`
  is still needed.

## Nyquist Coverage

| Phase | VALIDATION.md | Status | Compliant |
|---|---|---|---|
| 01 | exists | validated | true |
| 02 | exists | validated | true |
