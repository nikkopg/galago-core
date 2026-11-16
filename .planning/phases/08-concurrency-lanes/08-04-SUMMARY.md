---
phase: 08-concurrency-lanes
plan: 04
subsystem: queue
tags: [lanes, command-queue, concurrency, golden-transcript, vitest, typescript, tracer]

requires:
  - phase: 08-concurrency-lanes
    provides: "08-01 golden flag-off transcripts (final capture 2da2ad7), 08-02 pure laneScheduling.ts, 08-03 SqliteQueue.claimEligible and RunStateMonitor.stopIf"
provides:
  - "Lane mode in CommandQueue behind GALAGO_PARALLEL_LANES === '1', read once in the constructor, overridable by a second constructor argument { parallelLanes?, loopDelayMs? }"
  - "Headline cycle (in1, in2, FAST on lane fast with barrier, goto-safe, out1 barrier, out2) overlapping FAST with goto-safe on two fake tools end to end"
  - "Per-lane single-flight Start guard, lane-aware isStartInProgress, side-lane worker with the legacy failure primitives"
  - "Shared lane test harness createLaneHarness and the parameterised golden proof (three constructions)"
affects: [08-05, 08-06, 08-07, 08-08, 08-09, 08-10, command-queue]

plan_head_before: 32c22713fea8721ea9a051535641e06495f04f6b
plan_head_after: 9fe89c8a07a9d58e20824eed530184ea1a6fa185

actuals:
  tokens: 11700
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Supervised lane loops: _launchLane registers the supervisor in _laneLoops before returning, so a same-tick second Start sees it"
    - "Synchronous check-and-claim: _pickNext reads rows, runs pickEligible and claimEligible with no await between them"
    - "Every new statement sits behind _laneMode or acts only on non-primary-lane rows; the legacy path is byte-identical"

key-files:
  created:
    - controller/test/helpers/laneHarness.ts
    - controller/test/lanes.test.ts
  modified:
    - controller/server/command_queue.ts
    - controller/test/lanesFlagOff.test.ts
    - controller/test/staticScan.test.ts

key-decisions:
  - "An operator Start that launches the primary loop also launches every side lane with work in the same synchronous turn, so the second of two same-tick Starts finds every lane covered (one Queue Started, one Queue Start Ignored)"
  - "Lane runs are remembered in _laneRunIds so every step of a run that ever carried a lane tag is audited as Lane Step Dispatched, even after its tagged rows drained; the set empties with the queue"
  - "_pickNext returns WAIT whenever the queue state is not BUSY, so a failure or stop during another loop's delay can never dispatch one more step (stand-in until the 08-05 halt latch)"
  - "_startLanes does not clear _sideAbortAccepted, matching the legacy _start which leaves _abortAcceptedQueueId alone; only _failedAttempt and _sideFailedAttempts are superseded by a restart"

patterns-established:
  - "Lane test harness: one deferred per Tool.executeCommand call, tick(n) advances 1 ms at a time, teardown releases every open gate before stopping the queue"
  - "Golden proof in three constructions; GOLDEN_WRITE now throws so the fixture cannot be regenerated"

requirements-completed: [LAN-01, LAN-02, LAN-03, LAN-04]

coverage:
  - id: D1
    description: "With lanes on, the headline cycle runs FAST and goto-safe concurrently on two fake tools, out1 waits for both, every row COMPLETED, queue ends OFFLINE"
    requirement: "LAN-02"
    verification:
      - kind: unit
        ref: "controller/test/lanes.test.ts#lanes tracer headline cycle overlaps FAST with goto-safe"
        status: pass
    human_judgment: false
  - id: D2
    description: "Barrier holds: out1 is not dispatched until FAST and goto-safe have both ended; run N+1 waits for run N; a busy tool server stays busy after its run was dequeued"
    requirement: "LAN-03"
    verification:
      - kind: unit
        ref: "controller/test/lanes.test.ts#lane lifecycle"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-lane single-flight Start guard: same-tick Starts, restart router accepted flag, empty-queue Start, no recovery while a loop is alive, every queueId dispatched exactly once"
    requirement: "LAN-04"
    verification:
      - kind: unit
        ref: "controller/test/lanes.test.ts#per-lane Start guard (LAN-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Flag off (and flag on with an untagged protocol) reproduces golden transcripts S0-S3 exactly in three constructions; env flag read pinned (only exactly '1' enables)"
    requirement: "LAN-01"
    verification:
      - kind: unit
        ref: "controller/test/lanesFlagOff.test.ts#LAN-01 golden transcript (flag off) and lane-mode flag (D-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Side-lane failure path reuses fail, _recordFailure, FAILED and a non-awaited _notifyFailure; the primary step in flight is not aborted; an operator Start retries the failed row"
    requirement: "LAN-04"
    verification:
      - kind: unit
        ref: "controller/test/lanes.test.ts#side-lane failure path (D-10, D-14)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Additive static pins guard the seams: _start early return first, no await between row read and claim, side worker free of modal state, stop and Tool Box, laneScheduling import-free and timer-free"
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#concurrency lane seams (D-09, D-10, D-14)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-16
status: complete
---

# Phase 8 Plan 04: Concurrency Lane Tracer Summary

**Lane mode in CommandQueue behind GALAGO_PARALLEL_LANES: the headline cycle overlaps FAST with goto-safe on two fake tools with the barrier honoured, and the flag-off (and untagged flag-on) transcripts match the 08-01 golden exactly.**

## Performance

- **Duration:** about 20 min
- **Tasks:** 3 (1 tracer, 1 TDD, 1 proof)
- **Files modified:** 5 (2 created, 3 modified)
- **Commits:** 5 (measured from plan_head_before)

## Accomplishments

- Lane flag read once in the constructor (`options?.parallelLanes ?? process.env.GALAGO_PARALLEL_LANES === "1"`), plus an injectable loop delay; `laneMode` getter exposed.
- `_start` begins with `if (this._laneMode) return this._startLanes(source);`; the legacy body is untouched. The busy loop gained three seams only: the `_loopDelayMs` delay, `_pickNext(PRIMARY_LANE)` with the `WAIT` sentinel, and `_ensureLaneWorkers()`.
- `_pickNext` runs the row read, `pickEligible` and `claimEligible` in one synchronous turn; with the flag off it is exactly `this.commands.startNext()`.
- `_runSideLane` runs tagged tool steps only, never touches modal state, never calls `stop()`, evaluates `skipExecutionVariable` lane-locally (`_shouldSkip`) and reuses the failure primitives on a side failure.
- Per-lane Start guard (`_startLanes`) with the legacy "Queue Start Ignored" text when every lane with work is busy and "Lane Start Ignored" per busy lane otherwise; lane-aware `isStartInProgress` so the restart router's `accepted` is false only when a Start launches nothing.
- Golden S0-S3 reproduced by `new CommandQueue({})`, `{ parallelLanes: false }` and `{ parallelLanes: true }`; env cases `'0'`, `''`, `'true'`, `' 1'`, `'1 '` and unset all give laneMode false.

## Task Commits

1. Task 1 (tracer) RED: `8dfc0c3` test - failing headline tracer and lane harness
2. Task 1 GREEN: `4ca60ce` feat - lane seams, headline overlaps
3. Task 2 RED: `78eb6f3` test - Start guard, lifecycle, failure and audit cases (2 of 12 fail against the tracer seams)
4. Task 2 GREEN: `a12fc8f` feat - launch every lane with work on one Start, audit whole lane runs
5. Task 3: `9fe89c8` test - golden in three constructions, env-read cases, additive static pins

## TDD Gate Compliance

RED then GREEN commits exist for Task 1 (`8dfc0c3` then `4ca60ce`) and Task 2 (`78eb6f3` then `a12fc8f`). Task 1 RED: the headline test failed on `expected [] to deeply equal ['in1']` because the constructor ignored the second argument (no lane mode, 1500 ms delay). Semantic assessment: the target test executed and failed on the planned assertion for the intended reason (the feature did not exist). Task 2 RED: 2 of 12 cases failed on their assertions (a second same-tick Start logged a second "Queue Started"; steps after the tagged rows drained logged no "Lane Step Dispatched"); the other 10 passed because the tracer slice already implemented those seams, so they are unexpected-green by design of the plan's task split, not wrong tests. REFACTOR: none.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Same-tick double Start logged a second "Queue Started"**
- **Found during:** Task 2 (RED run)
- **Issue:** the plan launched only the primary loop on an idle Start and left side workers to the primary's first tick. A second Start in the same tick then saw lane `fast` with work and no loop, so it was accepted and logged "Queue Started" again, contradicting the plan's own truth (one "Queue Started" over the headline run).
- **Fix:** `_startLanes` always calls `_ensureLaneWorkers()` after launching or keeping the primary, in the same synchronous turn. The primary's reconcile tick still launches workers for later runs.
- **Files modified:** controller/server/command_queue.ts
- **Commit:** a12fc8f

**2. [Rule 1 - Bug] "Lane Step Dispatched" missing for steps after the tagged rows drained**
- **Found during:** Task 2 (RED run)
- **Issue:** the log fired only while a non-primary row was still queued, so out1 and out2 of the headline run were not audited.
- **Fix:** `_laneRunIds` remembers runs seen with a non-primary-lane row; the set empties when the queue is empty.
- **Files modified:** controller/server/command_queue.ts
- **Commit:** a12fc8f

**3. [Rule 2 - Missing critical functionality] No dispatch after a failure, stop or freeze during another loop's delay**
- **Found during:** Task 1 design review
- **Issue:** the legacy loop re-checks state only at the top of the iteration, so with several loops a side failure during the primary's 1500 ms delay would still let the primary dispatch one more step (truth: no further dispatch on any lane after a failure).
- **Fix:** in lane mode only, `_pickNext` returns `WAIT` when the state is not BUSY; `_ensureLaneWorkers` also returns early. The 08-05 halt latch supersedes this.
- **Files modified:** controller/server/command_queue.ts
- **Commit:** 4ca60ce

**4. [Rule 1 - Bug] Start must not clear another step's accepted-abort marker**
- **Found during:** Task 1
- **Issue:** the plan said a Start clears `_sideAbortAccepted`, but the legacy `_start` leaves `_abortAcceptedQueueId` alone; clearing it while a side step is in flight would turn an accepted abort into a plain failure.
- **Fix:** `_startLanes` clears only `_failedAttempt` and `_sideFailedAttempts`.
- **Commit:** 4ca60ce

**5. [Rule 3 - Blocking] Plan verification command compares the fixture against its first capture commit**
- The fixture's final capture is `2da2ad7` (per orchestrator note), so `git diff --exit-code 2da2ad7 -- controller/test/fixtures/lanesFlagOff.golden.ts` was used and passed. `staticScan.test.ts` shows 48 added lines and 0 deleted against both the first capture commit and `2da2ad7`.

**Total deviations:** 5 (3 bugs, 1 missing-critical, 1 verification-command note). **Impact:** none on scope; all resolve inconsistencies in the plan text in favour of its explicit behaviour truths. The "Queue Start Ignored" in-flight id falls back to a side-lane step when no primary step runs (same text otherwise).

## Authentication Gates

None.

## Known Stubs

None. `halted` and `modalOpen` in `_dispatchGate` are intentionally `false` here (wired in 08-05), the side worker does not start the run-state monitor and `toolControl` still targets the primary step (08-06); all documented in the plan's flagged assumptions, and the flag is default-off so nothing ships between plans.

## Threat Flags

None. No new network endpoint, auth path or schema change; the only new trust boundary is the env flag, which the threat model already covers (T-08-09). New log details pass through `sanitizeLogText` (T-08-10).

## Verification

- `cd controller && npx vitest run`: 42 files, 1196 tests passed.
- `cd controller && npx tsc --noEmit`: clean. `npx prettier --check` on the five touched files: clean.
- `git diff --exit-code 2da2ad7 -- controller/test/fixtures/lanesFlagOff.golden.ts`: no diff.
- Existing suites queueStartGuard, toolControl, errorPath, runState, queueRestart pass unedited.
- Acceptance greps: early return 1, `claimEligible(` 1, `pickEligible(` 1, env read 1, "Lane Start Ignored" 1, "Lane Step Dispatched" 1, router `return { accepted };` 1.

## Next Phase Readiness

Ready for 08-05 (halt latch, modal observation, freeze): `_dispatchGate` has the two placeholder booleans and the catch sites are in place. Tests used fake tools only; no instrument motion.

## Self-Check: PASSED

All five touched files exist; commits 8dfc0c3, 4ca60ce, 78eb6f3, a12fc8f and 9fe89c8 are ancestors of HEAD.
