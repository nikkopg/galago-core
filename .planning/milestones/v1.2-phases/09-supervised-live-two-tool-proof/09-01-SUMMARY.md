---
phase: 09-supervised-live-two-tool-proof
plan: 01
subsystem: testing
tags: [lanes, script-protocol, vitest, galago-core, stack, fast, offline-proof]

requires:
  - phase: 08-concurrency-lanes
    provides: lane engine (galago.lane, laneBarrier, validateLanes, CommandQueue lane workers, laneHarness)
provides:
  - event-1 script protocol (STACK get_transfer_estimate overlaps the F.A.S.T. liquid leg)
  - event-2 script protocol (third-plate STACK transfer overlaps the F.A.S.T. leg, serial return leg)
  - sim-drill script protocol (SIM-STACK / SIM-FAST only, refuses real tool names)
  - controller/test/liveLanesProtocol.test.ts (26 offline tests through executeProtocolScript, validateLanes and the real CommandQueue with fake tools)
  - store-protocol-15.export.json read-back record (unavailable, with the fallback used)
affects: [09-03, 09-06, 09-09, 09-11]

actuals:
  tokens: 18500
  tasks: 3
  commits: 3
plan_head_before: 7fb40fe8060a57c818abf59213c15b7cb13a7b2c
plan_head_after: ecbd0fec5f30c75f5d6aaa81fe49962fb4d7b020
commits: 3

tech-stack:
  added: []
  patterns:
    - "Script protocols validate every input and build every parameter object before the first galago call"
    - "galago.lane() reset after the F.A.S.T. step so the STACK overlap step stays on the primary lane"
    - "Per-run key base (label cut to 20 code points, ISO timestamp, 8 hex random) plus a per-leg suffix"

key-files:
  created:
    - .planning/phases/09-supervised-live-two-tool-proof/protocols/store-protocol-15.export.json
    - .planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event1.protocol.json
    - .planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event2.protocol.json
    - .planning/phases/09-supervised-live-two-tool-proof/protocols/09-sim-drill.protocol.json
    - controller/test/liveLanesProtocol.test.ts
  modified: []

key-decisions:
  - "Store protocol 15 is not in the store served on localhost:3010 (NOT_FOUND; only id 4 'test' exists), so the cycle legs were authored from the GAL-02 template plus runbook rows 2a-2/3a-2 and the fallback is recorded in store-protocol-15.export.json"
  - "Cycle parameters are named plate1/plate2 (homes), tray1/tray2 (F.A.S.T.-side slots), robot, labware_profile, transfer_profile, stack_timeout_s, fast_step_*; spare_a_*/spare_b_* have no default"
  - "The D-02 guard compares byte-exact triples and refuses a spare equal to the other spare, to either plate home (either role), or on a F.A.S.T.-side device (tray1/tray2 device)"

patterns-established:
  - "Offline protocol proof: load the protocol JSON from the phase directory, run its script through executeProtocolScript, validate lanes, then push the output into the real CommandQueue via createLaneHarness"

requirements-completed: [LIV-01, LIV-02]

coverage:
  - id: D1
    description: "Event-1 protocol: STACK estimate overlaps the F.A.S.T. leg, distinct explicit keys, spare guard, proven through the real queue"
    requirement: "LIV-01"
    verification:
      - kind: unit
        ref: "controller/test/liveLanesProtocol.test.ts#event-1 protocol (D-01, D-04, D-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Event-2 protocol: third-plate transfer overlap plus serial return leg, six distinct keys, no path to tray or plate homes"
    requirement: "LIV-01"
    verification:
      - kind: unit
        ref: "controller/test/liveLanesProtocol.test.ts#event-2 protocol (D-01, D-02, D-03, D-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sim-drill protocol: SIM-only tool names, refuses STACK2-6 and FA100056, overlap and barrier proven offline"
    requirement: "LIV-02"
    verification:
      - kind: unit
        ref: "controller/test/liveLanesProtocol.test.ts#sim-drill protocol (D-10, D-11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Store protocol 15 read-back used as the template source"
    requirement: "LIV-01"
    verification: []
    human_judgment: true
    rationale: "Protocol 15 was not readable from the store, so the parameter list comes from the GAL-02 template and runbook values; 09-03's operator checkpoint must confirm the parameter list against the real LIVE-10 protocol"

duration: 7min
completed: 2026-11-17
status: complete
---

# Phase 9 Plan 01: Live and Drill Protocols Summary

**Three script protocols (event 1 estimate overlap, event 2 third-plate overlap with a serial return, sim drill) proven offline through the real script executor, lane validation and CommandQueue with fake tools, with a 26-test suite that fails if the sticky lane is not reset.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-17T04:05:00Z
- **Completed:** 2026-11-17T04:12:30Z
- **Tasks:** 3
- **Files modified:** 5 (all created)

## Accomplishments

- Event-1 script emits note, in1, in2, F.A.S.T. (lane fast, barrier), STACK get_transfer_estimate on the primary lane for spare A to spare B (no step_key, no timeout_s), out1 (barrier), out2. The test pins the exact seven-command list, so event 1 cannot emit a third-plate transfer.
- Event-2 script emits the same cycle with a STACK transfer -x1 right after the F.A.S.T. step and a serial return -x2 after out2. Six explicit keys share one per-run base and are disjoint across two runs.
- Sim-drill script defaults to SIM-STACK / SIM-FAST and throws before any galago call for STACK2-6 or FA100056 in any case, with surrounding whitespace trimmed.
- End-to-end tests push each script's output into the real CommandQueue with fake tools and assert: the overlap step and the F.A.S.T. step are both in flight with unsettled gates, out1 is not dispatched while the F.A.S.T. step runs, x2 runs only after out2, and every queueId is sent exactly once with every row COMPLETED.
- Mutation check (not committed): removing the `galago.lane()` reset from each script makes three tests fail per protocol (the sticky-lane trap, RESEARCH Pitfall 1).

## Task Commits

1. **Task 1: Tracer, event-1 protocol from store protocol 15 to the real queue** - `7fcc494` (feat)
2. **Task 2: Event-2 protocol with third-plate overlap and serial return** - `c8da89b` (feat)
3. **Task 3: Sim-drill protocol for uat-sim** - `ecbd0fe` (feat)

**Plan metadata:** committed separately (docs: complete plan)

Tracer gate: auto-mode re-run of the tracer verify passed before expansion (10 tests green, `tsc --noEmit` and prettier clean); logged "Tracer verified end-to-end - expanding".

## Files Created/Modified

- `.planning/phases/09-supervised-live-two-tool-proof/protocols/store-protocol-15.export.json` - read-back record: store read returned NOT_FOUND, fallback and values used
- `.planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event1.protocol.json` - event-1 script protocol (importable envelope)
- `.planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event2.protocol.json` - event-2 script protocol
- `.planning/phases/09-supervised-live-two-tool-proof/protocols/09-sim-drill.protocol.json` - sim-drill script protocol
- `controller/test/liveLanesProtocol.test.ts` - offline layout, key, guard and end-to-end overlap proofs (26 tests, three describes)

## Decisions Made

- Protocol 15 unreadable: the production store served on localhost:3010 holds only protocol id 4 ("test", visual). The fallback in the plan was applied once, with no retry loop, and written into store-protocol-15.export.json. Parameter names for the cycle are therefore the plan's fallback names, not protocol 15's. 09-03's operator checkpoint must show the parameter list and confirm it, as the plan's flagged assumption says.
- Cycle legs send transfer_profile "Default" on both ends and timeout_s 300 (stack_timeout_s default), matching runbook row 2a-2 and the dev "test" protocol; both are blank-able parameters.
- Scripts are generated from small shared helper blocks and stored as self-contained scriptContent in each JSON (no shared include at run time).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Store protocol 15 not readable**
- **Found during:** Task 1 (read-only GET of protocol.export for id 15)
- **Issue:** NOT_FOUND on localhost:3010; protocol.getAll lists only id 4.
- **Fix:** Used the plan's documented fallback (write the unavailable record, author from GAL-02 template plus runbook rows). No retry loop.
- **Files modified:** store-protocol-15.export.json
- **Verification:** credential grep prints 0; JSON parses.
- **Committed in:** 7fcc494

**2. [Rule 1 - Bug] Over-strict assertion in my own test**
- **Found during:** Task 2
- **Issue:** The event-2 test asserted the script text lacks "get_transfer_estimate", but a shared helper comment mentions it.
- **Fix:** Dropped the text assertion; case (a) already pins the exact emitted command list.
- **Files modified:** controller/test/liveLanesProtocol.test.ts
- **Committed in:** c8da89b

**3. [Rule 1 - Bug] Type errors in new test file**
- **Found during:** Tasks 1 and 3 (`tsc --noEmit`)
- **Fix:** `as unknown as Record<string, unknown>` for advancedParameters; cast for the union override list.
- **Committed in:** 7fcc494, ecbd0fe

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs). **Impact:** none on scope; the protocol-15 fallback is an open confirmation item for 09-03.

## Issues Encountered

- The full controller suite (1404 tests) was run green once before the last type-cast fix to the drill test; after the cast only the new file was re-run (26 passed, tsc and prettier clean).

## Known Stubs

None. Drill and event defaults for the sim tools are intentional placeholders (sim-dev-a, sim-deck, sim-arm), documented in the protocol parameters.

## Threat Flags

None. No production file under controller/ changed; no network endpoint, auth path or schema was added.

## Next Phase Readiness

- 09-03 must confirm the cycle parameter list against the real LIVE-10 protocol and have the operator type the spare pair.
- No production code changed, `vendor/galago-tools` and `stack.proto` untouched.

## Self-Check: PASSED

- FOUND: protocols/store-protocol-15.export.json, 09-live-lanes-event1/event2/09-sim-drill protocol JSON, controller/test/liveLanesProtocol.test.ts
- FOUND commits: 7fcc494, c8da89b, ecbd0fe (all ancestors of HEAD; 3 commits measured from plan_head_before)
- `git status --porcelain -- controller/server controller/components controller/pages controller/types controller/hooks` prints nothing
