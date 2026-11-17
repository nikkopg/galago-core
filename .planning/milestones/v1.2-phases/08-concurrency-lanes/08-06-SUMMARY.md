---
phase: 08-concurrency-lanes
plan: 06
subsystem: queue
tags: [lanes, command-queue, run-control, run-state-poller, abort-markers, goto, vitest, typescript]

requires:
  - phase: 08-concurrency-lanes
    provides: "08-03 RunStateMonitor.stopIf, 08-04 side worker with _sideRunning / _sideAbortAccepted / _sideFailedAttempts, 08-05 halt latch and failure list"
provides:
  - "_controlTarget / _isRunning: toolControl reaches the one controllable step on any lane; flag off is _runningStep exactly"
  - "runningStepFor(toolName): running step on a tool from any lane, used by the recoveryControl caller"
  - "Per-queueId accepted-abort marker and late-reply token for side-lane steps (layers a and b of _recordAcceptedAbort)"
  - "Lane-mode run-state monitor ownership: started only for a controllable step, ended with stopIf(queueId) on both brackets"
  - "gotoCommand / gotoCommandByRunIndex refuse in lane mode while a side-lane step runs ('Queue Goto Refused')"
  - "controller/test/laneControl.test.ts (25 tests) and laneHarness grpcOf / replyControl"
affects: [08-07, 08-08, 08-09, 08-10, command-queue, run-page]

plan_head_before: 9f72c765a8aec9ddfc84d6a88e50fbf480115b85
plan_head_after: 85798c2109f15c1bfb6f038b1ad09833471616f8

actuals:
  tokens: 14000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Single controllable step per lane set (eligibility rule from 08-02) lets one runState envelope and one control target stay valid under lanes"
    - "Lane-mode branch beside a literal flag-off branch: the legacy start/stop lines are kept verbatim so the flag-off golden is untouched"
    - "Late-reply test technique: two held grpc control replies (deferreds) resolved after the step fails, to prove the dequeue happens once"

key-files:
  created:
    - controller/test/laneControl.test.ts
  modified:
    - controller/server/command_queue.ts
    - controller/server/routers/tool.ts
    - controller/test/helpers/laneHarness.ts

key-decisions:
  - "runningStepFor reads the primary slot through the public runningStep getter, so recoveryControl.test.ts (which mocks that getter on the prototype) passes unedited"
  - "The target resolver falls back to the first running step when none is controllable, so a STACK-only run keeps today's refusal text and an empty set keeps 'No step is currently running'"
  - "Goto refusal is the first statement of both goto mutations and throws before the legacy token reset or any log of its own, so a refused goto changes nothing"
  - "The side-lane abort branch only adds to _sideAbortAccepted and returns; the legacy _abortAcceptedQueueId / _failedAttempt fields stay the primary step's slot and are never written for a side step"

patterns-established:
  - "Harness helpers grpcOf(toolId) and replyControl(toolId) expose the fake gRPC endpoint for control calls and getStatus polls"

requirements-completed: [LAN-07, LAN-08]

coverage:
  - id: D1
    description: "Pause, Resume and Abort reach a F.A.S.T. on a side lane while STACK runs on primary; STACK-only and empty cases keep the unchanged refusal texts; identity gate refuses a replaced side step"
    requirement: "LAN-07"
    verification:
      - kind: unit
        ref: "controller/test/laneControl.test.ts#control target under lanes (LAN-07, D-11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An abort accepted on lane A survives lane B's next dispatch and completion in both orders; A's run remainder is dequeued, not retried"
    requirement: "LAN-07"
    verification:
      - kind: unit
        ref: "controller/test/laneControl.test.ts#accepted abort survives another lane's dispatch (Pitfall 12, LAN-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A late abort reply for a side-lane step that already failed dequeues its run once; a second reply logs Aborted Run Dequeue Skipped"
    requirement: "LAN-08"
    verification:
      - kind: unit
        ref: "controller/test/laneControl.test.ts#late abort replies on a side lane"
        status: pass
    human_judgment: false
  - id: D4
    description: "The single runState envelope keeps the F.A.S.T. queueId through a STACK step on the other lane in both orders, so Stop / Clear All / run delete still intercept; a lone STACK step leaves it empty"
    requirement: "LAN-08"
    verification:
      - kind: unit
        ref: "controller/test/laneControl.test.ts#the run-state envelope under lanes (LAN-08, Pitfall 13, T-08-21)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Abort on the side-lane F.A.S.T. while STACK runs on primary dequeues the F.A.S.T. run, does not abort STACK (COMPLETED), and run 2's STACK row waits"
    requirement: "LAN-08"
    verification:
      - kind: unit
        ref: "controller/test/laneControl.test.ts#abort on the side lane while STACK runs on primary (D-27, LAN-08/concurrency)"
        status: pass
    human_judgment: false
  - id: D6
    description: "runningStepFor feeds recoveryControl so a STACK acknowledge is refused while a STACK step runs on a side lane; flag off returns the primary step"
    requirement: "LAN-07"
    verification:
      - kind: unit
        ref: "controller/test/laneControl.test.ts#runningStepFor and the STACK acknowledge (T-08-20, D-11)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both goto mutations refuse in lane mode while a side-lane step runs, leaving every row unchanged and sending nothing"
    requirement: "LAN-07"
    verification:
      - kind: unit
        ref: "controller/test/laneControl.test.ts#goto refusal while a side-lane step runs (D-23, T-08-19)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Source pins and 20 consecutive green runs of lanes, laneHalt and laneControl"
    verification:
      - kind: unit
        ref: "controller/test/laneControl.test.ts#lane control source pins (D-11)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-11-16
status: complete
---

# Phase 8 Plan 06: Lane-Aware Operator Control Summary

**Pause, Resume and Abort now reach the F.A.S.T. on whatever lane it runs on, its run-state poller survives other lanes' steps, abort markers are per queueId, a STACK acknowledge and a goto re-queue are refused while the colliding step runs on any lane, and the engine is stable across 20 consecutive runs.**

## Performance

- **Duration:** about 35 min
- **Tasks:** 3
- **Files modified:** 4 (1 created)

## Accomplishments

- `toolControl` resolves its target from every running step (`_controlTarget`) and keeps the one whose tool type has a `runControl` entry; the identity gate checks any lane (`_isRunning`). Flag off, the target is `_runningStep` and every refusal text is unchanged.
- `_recordAcceptedAbort` takes a side-lane branch: an accepted abort adds the queueId to `_sideAbortAccepted`; a late reply consumes `_sideFailedAttempts`. The legacy single fields stay the primary step's own slot, so no dispatch on one lane resets another lane's marker.
- The run-state monitor is started only for a controllable step in lane mode, on both the primary and side brackets, and ended with `stopIf(queueId)`. With the flag off the literal `start(this._runningStep)` / `stop()` are kept.
- `runningStepFor(toolName)` feeds the `recoveryControl` router caller from any lane.
- `gotoCommand` / `gotoCommandByRunIndex` refuse in lane mode while a side-lane step runs, logging "Queue Goto Refused".
- Stop, Clear All and run delete needed no change: the unedited client intercept reads the single envelope, which is now correct under lanes (proved against `shouldInterceptQueueStop` / `shouldInterceptRunDelete`).

## Task Commits

1. **Task 1 RED:** `3d96a46` test(08-06): failing lane control target, abort marker and recovery cases
2. **Task 1 GREEN:** `b6937b6` feat(08-06): lane-aware control target, per-queueId abort markers and recovery caller
3. **Task 2 RED:** `c825856` test(08-06): failing poller ownership, abort-first envelope and goto refusal cases
4. **Task 2 GREEN:** `bf794e4` feat(08-06): lane-owned run-state poller and goto refusal while a lane step runs
5. **Task 3:** `85798c2` test(08-06): pin lane control source invariants (plus the 20x flake check, which needed no code change)

## Files Created/Modified

- `controller/server/command_queue.ts` - `_controlTarget`, `_isRunning`, `_isSideRunning`, `runningStepFor`, side branch of `_recordAcceptedAbort`, lane-mode monitor brackets, `_refuseGotoWhileLaneStepRuns`
- `controller/server/routers/tool.ts` - recoveryControl caller passes `runningStepFor(record.name)`
- `controller/test/laneControl.test.ts` - new, 25 tests
- `controller/test/helpers/laneHarness.ts` - `grpcOf` and `replyControl` (existing signatures unchanged)

## Decisions Made

See `key-decisions` in the frontmatter. The notable one: `runningStepFor` reads the primary slot through the `runningStep` getter, not the private field, because `recoveryControl.test.ts` mocks that getter and must pass unedited.

## Deviations from Plan

None - plan executed exactly as written. One in-flight correction: the first `runningStepFor` read the private `_runningStep` field and failed four existing `recoveryControl.test.ts` cases that mock the getter; it was changed to the getter in the same task before the GREEN commit (no test edited).

## Verification

- `laneControl`, `toolControl`, `recoveryControl`, `latchStatus`, `staticScan`, `stopInterception`, `runState`, `lanesFlagOff` green with no existing test edited; `lanesFlagOff.golden.ts` untouched (final capture 2da2ad7).
- 20 consecutive runs of `lanes`, `laneHalt`, `laneControl`: `LOOP_OK`.
- Full suite: 47 files, 1348 tests passed. `tsc --noEmit` and prettier clean.
- Acceptance greps: one `.controlCommand(`, one `const step = this._controlTarget();`, two `stopIf(attempt.queueId)`, one `Queue Goto Refused`, one `runningStepFor(record.name)`.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema; the only new send-adjacent behaviour is the target resolver, covered by T-08-17 to T-08-21.

## Issues Encountered

None. RESEARCH P-7 (Skip / "Skip to this command" acting across lanes) is pre-existing and unchanged; it remains for UAT in 08-09.

## Next Phase Readiness

The lane engine (seams, halt, freeze, control) is complete. Ready for 08-07 follow-ons and the UI plans (08-08 to 08-10).

## Self-Check: PASSED

- FOUND: controller/test/laneControl.test.ts, controller/server/command_queue.ts, controller/server/routers/tool.ts
- FOUND commits: 3d96a46, b6937b6, c825856, bf794e4, 85798c2
