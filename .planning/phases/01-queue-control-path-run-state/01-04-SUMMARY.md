---
phase: 01-queue-control-path-run-state
plan: 04
subsystem: api
tags: [heartbeat, grpc, fast-tool, pf400, logging, vitest]

# Dependency graph
requires:
  - phase: 01-queue-control-path-run-state (plan 01)
    provides: "Vitest runner, global test mocks, and the installFakeTool/removeFakeTool fake gRPC double used to drive a real Tool instance with no network"
provides:
  - "controller/server/tools.ts: Tool.fetchStatus no longer stops the heartbeat on a failed getStatus poll (any tool type); it sets UNKNOWN_STATUS and the existing setInterval keeps its normal cadence"
  - "Tool.consecutiveStatusFailures (number) and Tool.statusUnknownSince (number | undefined) getters giving the length and start time of the current status-poll failure streak"
  - "De-duplicated audit logging: one warning logAction 'Tool Status Unknown' at the first failure of a streak, one info logAction 'Tool Status Recovered' on recovery (with the failed-poll count), no per-poll console spam"
affects: ["phase-2-ui-control-bar", "phase-2-run-page"]

# Actuals (#2632)
actuals:
  tokens: 1898
  tasks: 2
  commits: 3
plan_head_before: 7b8794f21da0c9fe3e15b086f48c0de5856d7e3b
plan_head_after: 7d3e08a747db6d1a685c68b712187cdc83265549

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Retry-without-stopping on a periodic setInterval poll: a failure sets a degraded/unknown state but never clears the interval, so the normal cadence recovers it automatically once the dependency answers again (D-15)"
    - "Streak-based audit logging: a private counter gates logAction calls to exactly one at streak-start and one at streak-end, instead of logging every tick of a periodic poll (D-16)"

key-files:
  created: []
  modified:
    - controller/server/tools.ts
    - controller/test/tools.test.ts

key-decisions:
  - "Task 1 (tracer) was executed with full RED-GREEN discipline even though only 'auto' tracer tasks strictly require it: wrote the it.each(fast, pf400) heartbeat-recovery test and the single-failure test against the unmodified buggy code first, confirmed both it.each cases failed for the planned reason (status stuck at UNKNOWN_STATUS because stopHeartbeat() killed the interval after one failure), then removed the stopHeartbeat() call."
  - "Task 2's RED phase added 2 new tests ('logs once per failure streak and once on recovery', 'tracks the failure streak') on top of Task 1's 4 passing tests (including a genuinely-true-before-implementation 'a healthy poll logs nothing', since fetchStatus called no logAction at all pre-Task-2). Both new tests failed for the planned reason (0 logAction calls recorded; consecutiveStatusFailures/statusUnknownSince undefined) before the GREEN implementation."
  - "logAction calls in fetchStatus are fire-and-forget (not awaited), per the plan's explicit instruction that the heartbeat must never block on the audit write."

requirements-completed: [QUE-05]

coverage:
  - id: D1
    description: "The heartbeat survives a failed status poll and recovers: for both ToolType.fast and ToolType.pf400, two consecutive failed getStatus polls no longer stop the 'timers'-backed setInterval, and Tool.status returns to the tool's real value (READY) as soon as getStatus answers again — with no backoff, at the same configured interval"
    requirement: "QUE-05"
    verification:
      - kind: unit
        ref: "controller/test/tools.test.ts#heartbeat > keeps polling after a failure and recovers (fast)"
        status: pass
      - kind: unit
        ref: "controller/test/tools.test.ts#heartbeat > keeps polling after a failure and recovers (pf400)"
        status: pass
      - kind: unit
        ref: "controller/test/tools.test.ts#heartbeat > a failed poll returns UNKNOWN and changes only the tool status"
        status: pass
    human_judgment: false
  - id: D2
    description: "A status-failure streak logs exactly one warning ('Tool Status Unknown', with toolId and the error text) at its first failure and exactly one info ('Tool Status Recovered', with the failed-poll count) on recovery — not one log line per 5 s poll — and Tool exposes consecutiveStatusFailures/statusUnknownSince so a future UI can show 'unknown since'"
    requirement: "QUE-05"
    verification:
      - kind: unit
        ref: "controller/test/tools.test.ts#heartbeat > logs once per failure streak and once on recovery"
        status: pass
      - kind: unit
        ref: "controller/test/tools.test.ts#heartbeat > tracks the failure streak"
        status: pass
      - kind: unit
        ref: "controller/test/tools.test.ts#heartbeat > a healthy poll logs nothing"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 4: Heartbeat Retry & Failure-Streak Logging Summary

**`Tool.fetchStatus` no longer kills its own `setInterval` heartbeat on a single failed `getStatus` call — for every tool type — and a failure streak now logs exactly one warning and one recovery entry instead of spamming the console every 5 s, with `consecutiveStatusFailures`/`statusUnknownSince` getters for a future "unknown since" UI.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-10-13T09:33:00+07:00 (approx., first RED run)
- **Completed:** 2026-10-13T09:37:14+07:00 (last commit)
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments
- `Tool.fetchStatus`'s catch branch no longer calls `stopHeartbeat()`: a failed `getStatus` poll sets `ToolStatus.UNKNOWN_STATUS` and returns the `{uptime: 0, status: UNKNOWN_STATUS}` reply, but the `setInterval` created by `startHeartbeat` keeps firing at its normal interval, for `ToolType.fast` and `ToolType.pf400` alike (and every other tool type, since the fix touches no type-specific branch)
- `Tool._consecutiveStatusFailures`/`_statusUnknownSince` private fields plus `consecutiveStatusFailures`/`statusUnknownSince` public getters: `0`/`undefined` when healthy, incrementing count and a fixed streak-start timestamp while failing
- `fetchStatus` logs exactly one `{level: "warning", action: "Tool Status Unknown"}` at the first failure of a streak (with `toolId`, `toolType` and the error text in `details`) and exactly one `{level: "info", action: "Tool Status Recovered"}` on recovery (with the failed-poll count), both fire-and-forget (not awaited) so the heartbeat never blocks on the audit write
- The per-failure `console.error` inside `fetchStatus` is removed (replaced by a single `console.warn` at streak-start only), so a long outage no longer prints one line per 5 s poll
- 6 new unit tests in `controller/test/tools.test.ts` (`describe("heartbeat")`), exercising both tool types via `it.each`; full suite is 88/88 green; `tsc --noEmit` reports 0 errors
- `fetchStatus`'s body never calls `stopHeartbeat` (mechanically verified by the acceptance-criteria `awk`/`grep`), and `tools.ts` stays free of any `command_queue` import — the heartbeat fix has zero coupling to queue or step state, matching the plan's prohibition

## Task Commits

Each task was committed atomically:

1. **Task 1: The heartbeat survives a failed status poll and recovers (tracer)** - `877d6d6` (feat) — wrote `controller/test/tools.test.ts` against the unmodified buggy code first (confirmed RED: both `it.each` cases failed with status stuck at `UNKNOWN_STATUS`, the single-failure test passed as already-correct regression coverage), then removed the `stopHeartbeat()` call from `fetchStatus`'s catch branch
2. **Task 2: De-duplicated failure/recovery logging plus a failure-streak counter (TDD)** - `d9cdab9` (test, RED) + `7d3e08a` (feat, GREEN) — the RED commit added 2 genuinely-new-behavior tests (`logs once per failure streak and once on recovery`, `tracks the failure streak`) plus a trivially-true-pre-implementation `a healthy poll logs nothing`, confirmed failing via `npm run test:unit -- test/tools.test.ts` (2 of 6 failing: `expected [] to have a length of 2 but got +0` and `expected undefined to be +0`); the GREEN commit added the private counter/timestamp fields, the two getters, and the dedup-logging branches in `fetchStatus`, bringing the file's suite to 6/6 (full repo suite 88/88). No REFACTOR commit was needed — the GREEN implementation was already minimal.

**Plan metadata:** pending (this commit)

_Note: unlike plan 01-02's Task 1/Task 2 split, Task 1 here was scoped exactly to the plan's own task split (heartbeat-retry fix only, no logging/counter changes), so Task 2's RED phase drove genuinely new behavior rather than mostly-passing regression coverage._

## Files Created/Modified
- `controller/server/tools.ts` - Removed the `stopHeartbeat()` call from `fetchStatus`'s catch branch (D-15); added `_consecutiveStatusFailures`/`_statusUnknownSince` private fields, `consecutiveStatusFailures`/`statusUnknownSince` getters, and de-duplicated warning/recovery `logAction` calls plus a single `console.warn` at streak-start (D-16); removed the per-failure `console.error`
- `controller/test/tools.test.ts` - New: `describe("heartbeat")` with 6 tests covering heartbeat survival/recovery for `fast` and `pf400` (`it.each`), single-failure status/return-value shape, de-duplicated logging across a 3-failure-then-recover streak, the failure-streak getters' lifecycle, and the "healthy poll logs nothing" case

## Decisions Made
- Task 1 followed full RED-GREEN discipline (write test against buggy code, confirm RED, then fix) even though it is a `type="tracer"` task, to produce verifiable evidence that the `it.each` cases genuinely exercised the bug before the fix.
- `logAction` calls in `fetchStatus` are intentionally not awaited, matching the plan's explicit "the heartbeat never blocks on the audit write" instruction — this mirrors the already-established fire-and-forget pattern nowhere else in `tools.ts` needed changing.
- The catch-branch comment describing the removed `stopHeartbeat()` call avoids naming the removed call directly (per the plan's instruction), using "keep retrying at the normal interval" instead.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The heartbeat half of QUE-05 is complete and independently testable from the run-state poller half (plan 01-03, already landed) — together they fully satisfy ROADMAP Phase 1 SC3 (a failed status poll shows "unknown" and keeps retrying, for all tool types).
- `Tool.consecutiveStatusFailures`/`Tool.statusUnknownSince` are now available for Phase 2's UI to render "unknown since" against a tool's heartbeat, independent of the `runState` envelope's own `lastError`/`updatedAt` fields from plan 01-03.
- This plan does not touch `runState.ts`, `command_queue.ts`'s tool-step bracket, or the `runState`/`toolControl` tRPC procedures added in plans 01-02/01-03.
- No blockers. Plan 01-05 (QUE-06, the proto regeneration gated on the galago-tools `run_state`/`Pause` commit) is the only remaining plan in this phase.

---
*Phase: 01-queue-control-path-run-state*
*Completed: 2026-10-13*

## Self-Check: PASSED
