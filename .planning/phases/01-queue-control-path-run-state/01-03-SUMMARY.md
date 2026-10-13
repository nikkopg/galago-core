---
phase: 01-queue-control-path-run-state
plan: 03
subsystem: api
tags: [trpc, grpc, fast-tool, command-queue, run-state, polling]

# Dependency graph
requires:
  - phase: 01-queue-control-path-run-state (plan 02)
    provides: "CommandQueue.runningStep (the in-memory record the busy loop sets/clears around the single tool-step dispatch) and getRunControl(toolType) from runControl.ts"
provides:
  - "controller/server/runState.ts: RUN_STATE_POLL_INTERVAL_MS (2000), extractRunState(statusReply) (the sole reader of run_state, D-13), and the RunStateMonitor class (start/stop/snapshot) implementing the 2 s poller, in-flight guard, and generation-based staleness discard"
  - "CommandQueue._runStateMonitor, started/stopped inside the plan 01-02 tool-step bracket, and CommandQueue.runState (a read-only cache getter triggering no RPC)"
  - "commandQueue.runState tRPC query returning the D-12 envelope, next to modalState"
affects: ["01-04", "01-05", "phase-2-ui-control-bar", "phase-2-run-page"]

# Actuals (#2632)
actuals:
  tokens: 7445
  tasks: 2
  commits: 3
plan_head_before: 2e9dc603651958693db75b9f306bdfa822c0c4b1
plan_head_after: f01c90759f7a2637bccfa6ca3f76cebfbdabcd77

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A generation counter on a stateful poller: every start()/stop() bumps it, and every async poll result checks it before mutating shared state, so a result that lands after a later start() or a stop() is discarded rather than corrupting the current snapshot (T-01-15)"
    - "An in-flight boolean guard around a periodic async poll so N interval ticks firing while a call is still outstanding collapse to zero extra RPCs, not N overlapping calls (T-01-13)"
    - "A tolerant adapter function (extractRunState) as the single reader of an externally-supplied, loosely-typed payload: plain-object checks, own-field reads only, and a try/catch boundary so a hostile or malformed shape degrades to a typed { ok: false } instead of throwing (T-01-14, D-13)"

key-files:
  created:
    - controller/server/runState.ts
    - controller/test/runState.test.ts
  modified:
    - controller/server/command_queue.ts
    - controller/server/routers/command_queue.ts

key-decisions:
  - "Task 1 (tracer) was deliberately scoped to the happy path only, exactly as the plan's action text specifies ('Failure handling, the in-flight guard and malformed payloads are Task 2'): extractRunState did raw property reads with no plain-object validation, and RunStateMonitor.poll() had no try/catch and no in-flight guard. This let Task 2 produce a genuine RED state (10 of 34 tests failing for the planned reason, including one caught unhandled rejection from the un-caught getStatus failure) before implementing the strict validation and failure handling — unlike plan 01-02, where Task 1's cohesive implementation left Task 2 with almost nothing new to test."
  - "RunStateEnvelope's toolType field is typed via RunningStep[\"toolType\"] (an indexed-access type) rather than importing ToolType directly from gen-interfaces/controller, keeping runState.ts's import list exactly as the plan's <action> specifies (tool_base, Tool, getRunControl, and a type-only RunningStep import)."
  - "The poller's failure/malformed-payload branches share one _applyUnknown helper and the success branch its own _applySuccess helper, both re-checking the generation internally — this collapses the 'is this poll still current' check to one place instead of duplicating it at every call site in poll()."

requirements-completed: [QUE-04, QUE-05]

coverage:
  - id: D1
    description: "commandQueue.runState reports a running F.A.S.T. step's live run_state end to end (through the real busy loop and tRPC caller), with the full D-12 envelope shape including queueId, and returns to {running:false} the moment the step ends"
    requirement: "QUE-04"
    verification:
      - kind: unit
        ref: "controller/test/runState.test.ts#runState > reports the running tool's paused run_state"
        status: pass
    human_judgment: false
  - id: D2
    description: "extractRunState maps the galago-tools wire shape (state, percent, pause.errorCode/errorName/eventPayload/since) to the envelope shape (state, percent, pause.code/name/detail/startedAt) for the happy path, including percent 0/finite passthrough, null pause, and unknown extra keys ignored"
    requirement: "QUE-04"
    verification:
      - kind: unit
        ref: "controller/test/runState.test.ts#extractRunState (happy-path cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "extractRunState rejects a run_state that is not a plain object, a missing/non-string state, or a pause present but not a plain object, returning {ok:false, error} and never throwing; a non-finite percent or non-numeric errorCode degrades to null rather than being rejected"
    requirement: "QUE-04"
    verification:
      - kind: unit
        ref: "controller/test/runState.test.ts#extractRunState (rejection and coercion cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "RunStateMonitor polls getStatus immediately on start() and every 2000 ms thereafter, and stop() clears the interval so no further calls occur"
    requirement: "QUE-04"
    verification:
      - kind: unit
        ref: "controller/test/runState.test.ts#RunStateMonitor > polls at start and every 2000 ms"
        status: pass
    human_judgment: false
  - id: D5
    description: "A failed poll (transport error), a missing tool, or a malformed payload sets status unknown with lastError and keeps the last good runState, and the poller keeps retrying on the next tick without stopping (D-17, the run-state half of QUE-05)"
    requirement: "QUE-05"
    verification:
      - kind: unit
        ref: "controller/test/runState.test.ts#RunStateMonitor > shows unknown on a failed poll and keeps the last good runState"
        status: pass
      - kind: unit
        ref: "controller/test/runState.test.ts#RunStateMonitor > shows unknown on a malformed payload and keeps the last good runState"
        status: pass
      - kind: unit
        ref: "controller/test/runState.test.ts#RunStateMonitor > shows unknown when the tool is not connected"
        status: pass
    human_judgment: false
  - id: D6
    description: "At most one getStatus call is in flight per poller (overlapping ticks collapse to zero extra calls), and a poll result that lands after stop() or after a new start() is discarded by the generation counter, so a stale step's state can never leak into the current snapshot"
    verification:
      - kind: unit
        ref: "controller/test/runState.test.ts#RunStateMonitor > skips a tick while a poll is in flight"
        status: pass
      - kind: unit
        ref: "controller/test/runState.test.ts#RunStateMonitor > discards a result that lands after stop"
        status: pass
    human_judgment: false
  - id: D7
    description: "runState is fully independent of modalState: a paused run_state never touches isWaitingForInput/currentMessage, a Tool Box pause modal never sets a runState (D-02 steps never set runningStep), and N concurrent commandQueue.runState readers trigger zero extra gRPC calls (the poller caches, D-11)"
    requirement: "QUE-04"
    verification:
      - kind: unit
        ref: "controller/test/runState.test.ts#runState independence > a paused run_state does not touch modalState"
        status: pass
      - kind: unit
        ref: "controller/test/runState.test.ts#runState independence > a Tool Box pause modal does not touch runState"
        status: pass
      - kind: unit
        ref: "controller/test/runState.test.ts#runState independence > N readers, one poll"
        status: pass
    human_judgment: false
  - id: D8
    description: "The poller and the runState query never send a command: the only gRPC method runState.ts ever calls is getStatus, mechanically verified by a grep over the whole file (comments included) and a dedicated test asserting executeCommand is never invoked (D-14)"
    verification:
      - kind: unit
        ref: "controller/test/runState.test.ts#RunStateMonitor > never calls any tool method other than getStatus"
        status: pass
      - kind: other
        ref: "grep -oE 'grpc\\.[a-zA-Z]+' controller/server/runState.ts | sort -u -> grpc.getStatus"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 3: Run State Reporting & Poller Summary

**`commandQueue.runState` reports a running F.A.S.T. step's live `run_state` through a new 2 s server-side `RunStateMonitor` poller — cached, independent of the queue's modal state, and honest about failures (`status: "unknown"` with the last good state kept) instead of throwing or going stale.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-10-13T05:35:00Z (approx.)
- **Completed:** 2026-10-13T05:43:17Z (last verification run)
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `controller/server/runState.ts` (new): `RUN_STATE_POLL_INTERVAL_MS` (2000), the `PauseState`/`RunState`/`RunStateEnvelope`/`ExtractRunStateResult` types, `extractRunState(statusReply)` (the sole reader of `run_state`, reading it through one narrow cast ahead of QUE-06), and `RunStateMonitor` — a per-controllable-step poller with `start(step)`, `stop()` and `snapshot()`
- `CommandQueue` gets a private `_runStateMonitor`, started right after `_runningStep` is assigned and stopped in the same `finally` (before `_runningStep` is cleared) that plan 01-02 set up, plus a read-only `runState` getter that reads the poller's cache only
- `commandQueue.runState` tRPC query added next to `modalState`, returning the D-12 envelope
- A failed poll, a missing tool, or a malformed `run_state` payload reports `status: "unknown"` with `lastError` and the last good `runState`, and the poller keeps retrying on its normal 2 s cadence — never stopping, never throwing, never touching the step
- At most one `getStatus` call is ever in flight, and a generation counter discards any poll result that lands after `stop()` or after a new `start()`, so a stale step can never leak into the current snapshot
- `runState` is proven independent of `modalState`: a paused `run_state` never touches `isWaitingForInput`/`currentMessage`, a Tool Box pause modal never produces a `runState`, and 25 concurrent `commandQueue.runState` reads trigger zero extra `getStatus` calls
- 34 new unit tests in `controller/test/runState.test.ts` (describes `runState`, `extractRunState`, `RunStateMonitor`, `runState independence`); full suite is 82/82 green; `tsc --noEmit` reports 0 errors
- The only gRPC method `runState.ts` calls, anywhere including comments, is `getStatus` — mechanically enforced by the acceptance-criteria grep and a dedicated "never calls any tool method other than getStatus" test

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end run state (tracer)** - `fca4f38` (feat) — `runState.ts` happy-path `extractRunState` and `RunStateMonitor` (no failure handling, no in-flight guard, per the plan's explicit task split), the `command_queue.ts`/`routers/command_queue.ts` wiring, and the end-to-end "reports the running tool's paused run_state" test plus 3 happy-path `extractRunState` tests
2. **Task 2: Run state stays honest (TDD)** - `ee84f69` (test, RED) + `f01c907` (feat, GREEN) — the RED commit grew `runState.test.ts` to its full 34-test form and captured a TAP report showing 10 genuine failures (6 `extractRunState` validation cases, 4 `RunStateMonitor` failure-handling/in-flight cases) plus one caught unhandled rejection from the as-yet-uncaught `getStatus` failure, confirmed via `npm run test:unit` exit 1 with no crash; the GREEN commit added plain-object/shape validation to `extractRunState`, an in-flight guard, and failure/malformed-payload handling to `RunStateMonitor.poll()`, bringing the suite to 34/34 (82/82 overall). No REFACTOR commit was needed — the GREEN implementation was already minimal.

**Plan metadata:** pending (this commit)

_Note: unlike plan 01-02, Task 1 here was deliberately scoped to the happy path only (per the plan's own task split), so Task 2's RED phase exercised genuinely new behavior rather than mostly-already-passing regression coverage — see "Deviations from Plan" for how that split was engineered and verified._

## Files Created/Modified
- `controller/server/runState.ts` - New: `extractRunState`, `RunStateMonitor`, `RunStateEnvelope`/`RunState`/`PauseState`/`ExtractRunStateResult` types, `RUN_STATE_POLL_INTERVAL_MS`
- `controller/server/command_queue.ts` - Added `_runStateMonitor` field, `runState` getter, and `start()`/`stop()` calls inside the plan 01-02 tool-step bracket
- `controller/server/routers/command_queue.ts` - Added `runState: procedure.query(...)` next to `modalState`
- `controller/test/runState.test.ts` - New: 34 tests across `describe("runState")`, `describe("extractRunState")`, `describe("RunStateMonitor")`, `describe("runState independence")`

## Decisions Made
- Task 1 was scoped strictly to the plan's literal happy-path split (no validation, no in-flight guard, no failure handling in `poll()`) specifically so Task 2 could demonstrate a genuine RED state instead of mostly-passing regression coverage — verified by running the full Task 2 test file against the Task 1 implementation and capturing a TAP report (10 failures, exit 1, no crash) before writing the GREEN implementation.
- `RunStateEnvelope`'s `toolType` is typed via `RunningStep["toolType"]` rather than a separate `ToolType` import, keeping `runState.ts`'s import list to exactly the four imports the plan's `<action>` specifies.
- The poller's unknown/success state transitions are centralized in `_applyUnknown`/`_applySuccess` helpers, each independently re-checking the generation counter, so the "is this poll still current" check lives in one place rather than being duplicated at each call site.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a comment phrase that collided with its own acceptance-criteria grep**
- **Found during:** Task 1, acceptance-criteria verification
- **Issue:** An explanatory comment in `runState.ts` read `// ... never imported from "timers": vitest fake timers ...`, and its own literal text `from "timers"` matched the acceptance criterion `grep -cE 'from "timers"' controller/server/runState.ts` (which must print 0), making the grep report 1 instead of 0.
- **Fix:** Reworded the comment to `// The GLOBAL setInterval (no module import for it): vitest fake timers only control the global.`, preserving the explanation without the colliding substring.
- **Files modified:** controller/server/runState.ts
- **Verification:** `grep -cE 'from "timers"' controller/server/runState.ts` now prints 0; full suite and tsc still green.
- **Committed in:** fca4f38 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a comment's own wording defeated its acceptance-criteria grep)
**Impact on plan:** Cosmetic fix only, no behavior change. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `commandQueue.runState`'s envelope shape (`{running, queueId, runId, toolId, toolType, status, runState, updatedAt, lastError?}`) is stable for Phase 2's run-page control bar and `tool_paused` prompt to read directly, and for correlating with the queue's step list via `queueId` (research Pitfall 9).
- `extractRunState` still reads `run_state` through one narrow cast ahead of QUE-06; plan 01-05 is the only plan expected to touch that cast once the generated `StatusReply` carries the typed field.
- Plan 01-04 (heartbeat retry in `tools.ts`, the QUE-05 heartbeat half) runs next; it does not touch `runState.ts`, `command_queue.ts`'s tool-step bracket, or the `runState` tRPC query added here.
- No blockers.

---
*Phase: 01-queue-control-path-run-state*
*Completed: 2026-10-13*
