---
phase: 02-run-page-live-controls
plan: 01
subsystem: ui
tags: [chakra-ui, trpc, react-query, run-control, confirm-modal]

requires:
  - phase: 01-queue-control-path-run-state
    provides: commandQueue.toolControl mutation, commandQueue.runState query, RunStateMonitor, runControl.ts capability map
provides:
  - controlDecision.ts (pure decision state, bar visibility, button hints, copy, createConfirmedSender, runAfterAccepted)
  - useRunControl.ts (the sole commandQueue.runState reader and commandQueue.toolControl mutation user)
  - RunControlConfirmModal.tsx (shared confirm modal reused by every future control entry point)
  - ControlBar.tsx (run-page control bar: Pause/Resume/Abort, state badge, percent progress, unknown-state banner)
  - persistentErrorToast helper (duration null, closable)
  - command field on the running RunStateEnvelope
affects: [02-02, 02-03, 02-05]

actuals:
  tokens: 11432
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Shared confirmed-send gate: one createConfirmedSender instance per useConfirmedControlSend hook; every control action funnels through it (in-flight/incomplete/refused/failed handled once)"
    - "Fresh-mount confirm state: RunControlConfirmModal returns null while closed so decision state is always born empty on reopen (D-07), keyed by toolType:action"
    - "RadioGroup value normalization: value={values[name] ?? \"\"} avoids the uncontrolled->controlled warning while keeping the underlying value typed yes|no|undefined"
    - "Step-scoped confirm invalidation: confirmStillValid(openedForQueueId, envelope) closes a stale confirm from a useEffect, never from the mutation result"

key-files:
  created:
    - controller/components/runs/controlDecision.ts
    - controller/hooks/useRunControl.ts
    - controller/components/runs/RunControlConfirmModal.tsx
    - controller/components/runs/ControlBar.tsx
    - controller/test/controlDecision.test.ts
  modified:
    - controller/components/ui/Toast.tsx
    - controller/components/runs/RunsComponent.tsx
    - controller/server/runState.ts
    - controller/test/runState.test.ts

key-decisions:
  - "Task 1 (tracer) only wired Pause (empty decision spec); RadioGroup rendering and multi-decision restateChoice were deferred to Task 2's TDD cycle, since Resume/Abort are the only actions with decisions to test"
  - "useConfirmedControlSend creates its createConfirmedSender via useRef lazy init so the hook instance (and its in-flight flag) survives re-renders but is scoped to the component, not module-global"
  - "RunControlConfirmModal owns its own useConfirmedControlSend() call rather than receiving send as a prop, so every control entry point gets the hook's toast wiring for free"
  - "runAfterAccepted (D-18) is a generic accepted-then-follow-up primitive built now for plan 02-03's sequenced abort-then-stop, exercised directly in this plan's unit tests but not yet called with a real followUp"

patterns-established:
  - "Pattern 1: all run-control UI reads commandQueue.runState through exactly one hook call (useRunControlState in RunsComponent); every other consumer receives the envelope as a prop"
  - "Pattern 2: decision-bearing actions validate through completeDecisions before the confirmed-send gate ever sees them; the gate re-validates independently so a caller cannot bypass completeness"

requirements-completed: [UI-01, UI-02, UI-03, UI-08]

coverage:
  - id: D1
    description: "Shared confirmed-send gate: refuses while in flight or decisions incomplete, notifies accepted/refused, never retries on failure"
    requirement: "UI-02"
    verification:
      - kind: unit
        ref: "test/controlDecision.test.ts#confirmed sender"
        status: pass
    human_judgment: false
  - id: D2
    description: "End-to-end confirmed Pause reaches the running F.A.S.T. tool through the real tRPC router and busy loop, proving commandQueue.toolControl wiring"
    requirement: "UI-01"
    verification:
      - kind: integration
        ref: "test/controlDecision.test.ts#confirmed pause reaches the running tool"
        status: pass
    human_judgment: false
  - id: D3
    description: "Control-bar visibility (shouldShowControlBar) and per-state button-enablement hints (controlButtonHints, D-04)"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "test/controlDecision.test.ts#bar visibility"
        status: pass
      - kind: unit
        ref: "test/controlDecision.test.ts#button hints"
        status: pass
    human_judgment: false
  - id: D4
    description: "Percent/progress clamping (progressValue) and first-failed-poll unknown-since tracking (nextUnknownSince) for the unknown-state banner (D-03)"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "test/controlDecision.test.ts#progress"
        status: pass
      - kind: unit
        ref: "test/controlDecision.test.ts#unknown since"
        status: pass
    human_judgment: false
  - id: D5
    description: "Non-defaulted Resume/Abort decisions: emptyDecisions/allDecisionsChosen/completeDecisions start empty, reject partial choices, reset on every reopen (D-07)"
    requirement: "UI-03"
    verification:
      - kind: unit
        ref: "test/controlDecision.test.ts#decision completeness"
        status: pass
    human_judgment: false
  - id: D6
    description: "Confirmation copy restatement per declared decision and decision labels (D-06, D-08)"
    requirement: "UI-03"
    verification:
      - kind: unit
        ref: "test/controlDecision.test.ts#restatement"
        status: pass
    human_judgment: false
  - id: D7
    description: "Accepted-then-follow-up sequencing primitive (runAfterAccepted, D-18) for the future sequenced abort-then-stop flow"
    verification:
      - kind: unit
        ref: "test/controlDecision.test.ts#accepted then follow-up"
        status: pass
    human_judgment: false
  - id: D8
    description: "Rendered control bar and confirm modal: Pause/Resume/Abort buttons wired to the bar, state badge + progress as the visual anchor, unknown-state Alert, per-decision RadioGroup reset on open, Confirm spinner while sending, step-scoped auto-close with the 'nothing was sent' toast"
    requirement: "UI-01"
    verification:
      - kind: other
        ref: "acceptance-criteria greps: RadioGroup value normalization, no <form>/autoFocus, initialFocusRef present, Resume/Abort button labels, NOTHING_SENT_MESSAGE wired, command field on 3 envelope literals"
        status: pass
    human_judgment: true
    rationale: "This project has no React component-rendering test harness (@testing-library/react is not installed); the underlying decision logic consumed by these components (controlButtonHints, progressValue, nextUnknownSince, confirmStillValid, emptyDecisions/completeDecisions) is unit-tested and the structural shape is grep-verified, but the actual rendered behavior (badge/progress colors and layout, RadioGroup visually resetting on reopen, modal close-button hiding while sending, the step-scoped useEffect actually firing the toast on a real poll transition) has not been exercised by an automated renderer and needs a human/UAT pass."

duration: 55min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 1: Run-Page Live Controls Summary

**Run-page control bar with state/percent display and the one shared, confirmed send path (Pause/Resume/Abort) to the running F.A.S.T., proven end to end through the real tRPC router and busy loop.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD RED-GREEN)
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- Delivered `controlDecision.ts`, the pure React-free module that owns bar visibility, button hints, decision completeness, confirmation copy, and the single `createConfirmedSender` gate every control action funnels through
- Delivered `useRunControl.ts`: the sole client reader of `commandQueue.runState` and the sole user of the `commandQueue.toolControl` mutation
- Delivered `RunControlConfirmModal.tsx` — the shared confirm modal with non-defaulted Yes/No decisions, no form wrapper, Cancel holding initial focus, and a Confirm button gated on `allDecisionsChosen`
- Delivered `ControlBar.tsx`, mounted in `RunsComponent` between the Gantt chart and Runs List cards, showing the state badge + percent progress visual anchor, the unknown-state warning banner, and Pause/Resume/Abort buttons gated by `controlButtonHints`
- Proved the confirmed Pause path end to end: `createConfirmedSender` → `caller.toolControl` → the real `CommandQueue.toolControl` → `grpc.executeCommand({ fast: { pause: {} } })`, through the real busy loop and tRPC router (not mocked)
- Added `command` to the running `RunStateEnvelope` so the control bar can show the running command label

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end confirmed Pause** - `88f85d5` (feat)
2. **Task 2 RED: failing tests for Resume/Abort, hints, display, sequencing** - `373a304` (test)
3. **Task 2 GREEN: Resume/Abort decisions, state/percent display, step-scoped confirms** - `ac38805` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

_RED evidence: `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` against a `tap-flat` run of `test/controlDecision.test.ts` — 25 of 39 tests failed for the intended reason (missing `controlButtonHints`/`progressValue`/`nextUnknownSince`/`confirmStillValid`/`decisionLabel`/`runAfterAccepted` and an unextended `restateChoice`); `test/runState.test.ts`'s new `command` assertion failed because the envelope had no `command` field yet. No REFACTOR commit was needed — the GREEN implementation needed no post-hoc cleanup._

## Files Created/Modified

- `controller/components/runs/controlDecision.ts` - Pure decision state, bar visibility, button hints, confirmation copy, `createConfirmedSender`, `runAfterAccepted`
- `controller/hooks/useRunControl.ts` - `useRunControlState()` and `useConfirmedControlSend()`
- `controller/components/runs/RunControlConfirmModal.tsx` - Shared confirm modal (decisions, copy/afterAccepted/onPendingChange props)
- `controller/components/runs/ControlBar.tsx` - Run-page control bar (badge, progress, unknown-state banner, Pause/Resume/Abort)
- `controller/test/controlDecision.test.ts` - End-to-end confirmed-pause test plus full pure-logic coverage
- `controller/components/ui/Toast.tsx` - Added `persistentErrorToast` (duration null, closable)
- `controller/components/runs/RunsComponent.tsx` - Mounted `<ControlBar>` between the Gantt and Runs List cards
- `controller/server/runState.ts` - Added `command: string` to the running `RunStateEnvelope`
- `controller/test/runState.test.ts` - Asserted `snapshot.command` on the existing paused-run_state test

## Decisions Made

- Task 1 (tracer) scoped to Pause only (empty decision spec); RadioGroup rendering and multi-decision `restateChoice` were deferred to Task 2's TDD cycle since Resume/Abort are the only decision-bearing actions
- `useConfirmedControlSend` creates one `createConfirmedSender` per hook instance via lazy `useRef` init, so the in-flight flag is stable across re-renders without being module-global
- `RunControlConfirmModal` calls `useConfirmedControlSend()` itself rather than receiving `send` as a prop, so every future control entry point gets consistent toast wiring automatically
- `runAfterAccepted` (D-18) was built now as a generic sequencing primitive for plan 02-03's abort-then-stop flow; it is unit-tested here but not yet invoked with a real follow-up

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first draft of the end-to-end "confirmed pause" test failed because `grpc.executeCommand` wasn't mocked with a resolved value (the harness only mocks `grpc.getStatus` for run-state tests); fixed by mocking `grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true })` matching the existing `toolControl.test.ts` pattern.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `controlDecision.ts`, `useRunControl.ts` and `RunControlConfirmModalProps` (including the `copy`/`afterAccepted`/`onPendingChange` extension points) are ready for plan 02-02 (`tool_paused` modal), 02-03 (Stop/D4 sequencing via `runAfterAccepted`), and 02-05 (recovery `ControlTarget` variant)
- No blockers. The control bar and confirmed-send path are proven end to end against the real tRPC router and busy loop; remaining risk is UI-rendering verification (D8 in the coverage block above) which needs a human/UAT pass since this project has no component-rendering test harness

---
*Phase: 02-run-page-live-controls*
*Completed: 2026-10-13*

## Self-Check: PASSED

- All 9 created/modified files verified present on disk.
- All 3 task commits (88f85d5, 373a304, ac38805) verified as ancestors of HEAD.
- Full unit suite (131/131) and `tsc --noEmit` re-run clean after final edits.
