---
phase: 08-concurrency-lanes
plan: 05
subsystem: queue
tags: [lanes, command-queue, halt-latch, freeze, fail-closed, trpc, vitest, typescript]

requires:
  - phase: 08-concurrency-lanes
    provides: "08-02 pure laneScheduling.ts (validateLanes, LaneValidationError, snapshot types), 08-03 claimEligible, 08-04 lane mode with _dispatchGate placeholders and the lane harness"
provides:
  - "_laneHalt latch set synchronously as the first statement of the primary, side-lane and supervisor catches; only an accepted operator Start clears it"
  - "Dispatch gate wired: halted from the latch, modalOpen from the primary modal flag (a STARTED Tool Box row is handled by pickEligible)"
  - "Bounded lane failure list (cap 8 plus overflow) with the first failure kept as the banner error"
  - "freezeLanes() and laneStatus() on CommandQueue and the commandQueue router; enqueue-time validateLanes refusal"
affects: [08-06, 08-09, 08-10, command-queue, run-page]

plan_head_before: db448ed70f23edc073357cad723b5266f7d3f554
plan_head_after: 2e9b04b2e1b75dbd24711828bf4469262d33f9e4

actuals:
  tokens: 10300
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Latch independent of queue state: the dispatch gate reads _laneHalt, so a state that turns READY again never re-arms dispatch"
    - "Latch-first catches: _latchFailure is the first statement of every failure catch, before any await, pinned by static scan"
    - "_recordFailure stays the single error-assignment site; lane mode adds a context argument, list append and keep-first rule"

key-files:
  created:
    - controller/test/laneHalt.test.ts
  modified:
    - controller/server/command_queue.ts
    - controller/server/routers/command_queue.ts
    - controller/test/staticScan.test.ts

key-decisions:
  - "The latch is a field of its own, not a queue state: resume, clearError, clearAll, stop and the enqueue auto-start leave it alone, and an ignored operator Start (every lane busy) changes nothing"
  - "A failure overrides a freeze (_latchFailure replaces reason freeze); a failure then a freeze returns frozen false and logs Lanes Freeze Ignored"
  - "The lane supervisor catch passes queueId 0 (no step is known) so an unexpected loop failure is still listed and latched"
  - "Modal is not latched: it is read live from _isWaitingForInput in the gate, and laneStatus reports it as haltReason modal when no latch is set"
  - "laneStatus computes hasLaneRows from the stored rows even with the flag off; the UI gates on laneMode too (shouldShowLanesPanel)"

patterns-established:
  - "Hold-the-await test technique: spy commands.fail or commands.complete with a deferred to act inside the window between a catch and the state change"
  - "afterEach releases held gates and resumes a parked modal before teardown, because stop() awaits the busy loop which is parked on an open modal"

requirements-completed: [LAN-05]

coverage:
  - id: D1
    description: "Any step failure on any lane closes dispatch on every lane before the next await; running steps finish and are recorded COMPLETED; nothing is aborted"
    requirement: "LAN-05"
    verification:
      - kind: unit
        ref: "controller/test/laneHalt.test.ts#halt window (LAN-05, Pitfall 15)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only an accepted operator Start clears the latch and failure list; resume, clearError, enqueue auto-start, clearAll and an ignored Start leave it"
    requirement: "LAN-05"
    verification:
      - kind: unit
        ref: "controller/test/laneHalt.test.ts#who clears the latch (D-13, Pitfall 16)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A primary-lane modal and a STARTED Tool Box row stop new dispatch on every lane; a Tool Box row tagged lane fast runs on the primary lane"
    requirement: "LAN-06"
    verification:
      - kind: unit
        ref: "controller/test/laneHalt.test.ts#the primary modal gate (D-14, LAN-06)"
        status: pass
    human_judgment: false
  - id: D4
    description: "freezeLanes closes dispatch without aborting or sending anything, is refused with the flag off, and failure outranks freeze"
    requirement: "LAN-09"
    verification:
      - kind: unit
        ref: "controller/test/laneHalt.test.ts#freezeLanes (D-15, LAN-09)"
        status: pass
    human_judgment: false
  - id: D5
    description: "First failure (with its STACK guid) is the banner error; later failures are listed in time order, capped at 8 with an overflow count; laneStatus carries messages only"
    requirement: "LUI-06"
    verification:
      - kind: unit
        ref: "controller/test/laneHalt.test.ts#the first failure is kept (D-16, LUI-06)"
        status: pass
      - kind: unit
        ref: "controller/test/laneHalt.test.ts#commandQueue.laneStatus (D-24, D-16)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Lane-mode enqueueRun refuses an invalid lane setup with LaneValidationError before pushing any row and audits it (stage=enqueue)"
    requirement: "LUI-03"
    verification:
      - kind: unit
        ref: "controller/test/laneHalt.test.ts#enqueue-time lane validation (D-14, D-17, LUI-03)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Static pins: latch first in all three catches, freeze and laneStatus send nothing and read no run state, gate not poll-driven, single failure site, router procedures"
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#lane halt and freeze invariants (D-12, D-15, D-16)"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-11-16
status: complete
---

# Phase 8 Plan 05: Fail-Closed Lane Halt, Freeze and Lane Status Summary

**Any lane failure, a primary-lane modal or the operator's Freeze lanes stops new dispatch on every lane without aborting anything; only an operator Start re-arms, the first failure keeps the STACK guid, and the run page gets a messages-only lane status read model.**

## Performance

- **Duration:** about 50 min
- **Tasks:** 3 (2 TDD, 1 pin task)
- **Files modified:** 4 (1 created, 3 modified)
- **Commits:** 5 (measured from plan_head_before)

## Accomplishments

- `_laneHalt` latch (`failure` | `freeze`): `_latchFailure` is the first statement of the primary busy-loop catch, the side-worker catch and the `_launchLane` supervisor catch, ahead of the `logger.error` line and every await. A failure replaces a freeze.
- `_dispatchGate` now feeds `halted` (the latch) and `modalOpen` (`_isWaitingForInput`) into `pickEligible`; nothing in it reads run_state.
- Clearing rules enforced: `resume()` skips its `clearError` while latched, `clearError()` leaves the latch, `clearAll()`/`stop()` leave it, the enqueue auto-start logs "Queue Start Ignored" with `halted=true` and launches nothing, an operator Start with every lane busy changes nothing, and an accepted operator Start clears latch, failure list and overflow.
- `_recordFailure(error, ctx?)` stays the single `this.error =` site: lane mode lists each failure `{ lane, queueId, toolId, toolType, message, at }` (cap 8 plus overflow), bumps `failureSeq` every time, keeps the first failure as the banner error and logs "Lane Halt Additional Failure" naming both lanes.
- `freezeLanes()` (sets the latch with reason freeze, OFFLINE unless FAILED, logs "Lanes Frozen", aborts and sends nothing; PRECONDITION_FAILED with the flag off) and `laneStatus()` on both `CommandQueue` and the router; `getError` payload untouched.
- `enqueueRun` validates lane setup first in lane mode, logs "Lane Setup Refused" (stage=enqueue) and throws `LaneValidationError` before any row is pushed.
- 32 new cases in `laneHalt.test.ts` and an additive "lane halt and freeze invariants" describe in `staticScan.test.ts`. Full suite: 44 files, 1299 tests green; `tsc --noEmit` clean; golden fixture identical to 2da2ad7.

## Task Commits

1. Task 1 RED: `3c91dfc` test - failing halt window, clearing rules, first-kept list and modal gate cases (16 of 20 fail on the planned assertions)
2. Task 1 GREEN: `268497b` feat - latch, modal gate, bounded failure list
3. Task 2 RED: `ed4e6c0` test - failing freeze, laneStatus and enqueue validation cases (10 of 12 new cases fail)
4. Task 2 GREEN: `3d1c5b4` feat - freezeLanes, laneStatus, router procedures, enqueue validation
5. Task 3: `2e9b04b` test - additive static pins

## TDD Gate Compliance

RED then GREEN commits exist for Task 1 (`3c91dfc` then `268497b`) and Task 2 (`ed4e6c0` then `3d1c5b4`).

- Task 1 RED: the latch and clearing cases failed on `expected undefined to be 'failure'` (no latch), the first-kept cases on `expected 'boom g-2' to contain 'g-1'` (second failure overwrote the first), the modal gate cases on `expected [ { toolId: 'fast-1' ... } ] to have a length of +0 but got 1` (FAST dispatched during the modal and inside the Tool Box claim window). Semantic assessment: each target test executed and failed on the planned assertion for the intended reason (the feature did not exist). Four cases passed at RED by design of the task split (the lane/Tool Box forced-primary routing and the modal-with-no-side-work case already held through `laneOf` and `pickEligible`; the plain halt-window case is covered by the 08-04 state guard); they remain as regression cases.
- Task 2 RED: `freezeLanes`/`laneStatus` are not functions or procedures (`Cannot read properties of undefined (reading '_def')`, `h.queue.freezeLanes is not a function`) and the enqueue case failed on `expected false to be true` (no refusal). Semantic assessment: the missing method and procedure are the planned reason.
- Two test-only corrections were made in the Task 1 GREEN commit (see Deviations): both assertions were wrong in the test, not in the code, and both were re-verified failing against the pre-implementation source before commit.
- REFACTOR: none.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test-scenario errors found while turning Task 1 GREEN**
- **Found during:** Task 1 (GREEN run)
- **Issue:** (a) "operator Start while every lane is busy" asserted the failure list and error while `commands.fail` was still held, but a failure is recorded only after that await, so the list is legitimately empty then. (b) "resume with a modal open" scheduled the pause row before FAST, so the primary claimed the pause first and FAST was never in flight to fail.
- **Fix:** moved the list/error assertions after the held gate is released; reordered the rows to `[FAST, A, pause, B]` so FAST is in flight while the modal opens.
- **Files modified:** controller/test/laneHalt.test.ts
- **Verification:** both cases fail against the pre-implementation source and pass against the latch
- **Commit:** 268497b

**2. [Rule 3 - Blocker] Test teardown hung on an open modal or a held await**
- **Found during:** Task 1 (RED run)
- **Issue:** `queue.stop()` awaits the busy loop, which is parked on an open modal (or a held `commands.fail`), so a failing assertion left the hook timing out at 10 s and masked the real failure.
- **Fix:** `afterEach` releases every held gate and calls `resume()` before `teardown()`.
- **Files modified:** controller/test/laneHalt.test.ts
- **Commit:** 3c91dfc

**3. [Rule 3 - Blocker] The plan's golden/pins check compares against the wrong commit**
- **Found during:** Task 3 (Wave 4 gate)
- **Issue:** the third automated check diffs `lanesFlagOff.golden.ts` against `git log --diff-filter=A ... | tail -n 1`, the first commit that added the file, but the golden was extended after it (final capture 2da2ad7), so the check reports an expected diff.
- **Fix:** ran the same check against 2da2ad7 as the orchestrator directed: golden diff empty, and `git diff --numstat 2da2ad7 -- controller/test/staticScan.test.ts` shows 102 additions and 0 deletions. No file was edited to satisfy it.
- **Files modified:** none

**Total deviations:** 3 auto-fixed (1 bug in test scenarios, 2 blockers in verification tooling). **Impact:** none on production code or on the plan's contract.

## Behaviour Notes For Later Plans

- A step whose row the operator removed mid-run (Clear All or run delete, "Step Removed While Running") still passes through the catch, so in lane mode it latches too; the queue goes OFFLINE with no error and an operator Start clears the latch. Fail closed by design; a reader of `laneStatus` may see `halted: true, haltReason: "failure"` with an empty failure list in that case.
- The lane supervisor catch lists its failure with `queueId: 0` ("no step"); 08-09's list shows lane, tool and message, never the id.
- `freezeLanes` is an unauthenticated mutation on a router that has no auth by design (T-08-14, accepted): it can only close the gate, and only an operator Start reopens it.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model: the new `freezeLanes` and `laneStatus` procedures are the surface T-08-14 and T-08-16 already cover.

## Self-Check: PASSED

- Files: controller/test/laneHalt.test.ts, controller/server/command_queue.ts, controller/server/routers/command_queue.ts, controller/test/staticScan.test.ts exist.
- Commits 3c91dfc, 268497b, ed4e6c0, 3d1c5b4, 2e9b04b are all ancestors of HEAD.
- Acceptance greps: `_latchFailure(` 4, `if (this.error && !this._laneHalt)` 1, `Lane Halt Additional Failure` 1, `freezeLanes: procedure.mutation` 1, `laneStatus: procedure.query` 1, `CommandQueue.global.toolControl(` 1, `validateLanes(` 1.
- Plan verification: `npx vitest run` 44 files / 1299 tests passed, `npx tsc --noEmit` clean, prettier clean on the four touched files, golden identical to 2da2ad7, staticScan additive (0 deletions).
