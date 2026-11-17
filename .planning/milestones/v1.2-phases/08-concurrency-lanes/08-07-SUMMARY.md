---
phase: 08-concurrency-lanes
plan: 07
subsystem: protocols
tags: [lanes, run-creation, validation, script-api, preview, trpc, compose, vitest, typescript]

requires:
  - phase: 08-concurrency-lanes
    provides: "08-02 laneScheduling.ts (validateLanes, hasLaneTags, normalizeLane, LaneValidationError, isLaneValidationError, LANE_TAGS_IGNORED_WARNING); 08-04 CommandQueue.laneMode getter; 08-05 enqueue-time validation"
provides:
  - "RunStore.createFromProtocol refuses an invalid lane setup (stage=create) with the exact S2c sentences; nothing stored or enqueued"
  - "LaneValidationError mapped by Error.name to BAD_REQUEST (run.create) and HTTP 400 (POST /api/runs)"
  - "Flag-off inert tags: one 'Lane Tags Ignored' log per created run when tags or barriers exist"
  - "galago.lane(name) sticky lane and galago.command(..., { lane, barrier }) per-call options; Tool Box helpers never inherit the lane"
  - "protocol.preview returns laneWarnings: string[]"
  - "GALAGO_PARALLEL_LANES documented in docker-compose.yml and docker-compose.dev.yml (default empty = off)"
affects: [08-08, 08-10, protocol-editor, run-creation]

plan_head_before: d765c13afd21328858ef564c779e62fe310f6f43
plan_head_after: ad724f97a0760c386177504f5bd5149627ea3b4c

actuals:
  tokens: 6950
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Name-guarded error classification (isLaneValidationError) at all three mapping sites; no instanceof, pinned by a source test"
    - "Optional advancedParameters keys written only when set, so untagged scripts stay byte-identical"
    - "Preview lazily imports CommandQueue and laneScheduling to keep the router's import shape"

key-files:
  created:
    - controller/test/laneValidation.test.ts
    - controller/test/laneScript.test.ts
  modified:
    - controller/server/runs.ts
    - controller/server/routers/run.ts
    - controller/pages/api/runs/index.ts
    - controller/server/scripting/protocol-script-executor.ts
    - controller/server/routers/protocol.ts
    - docker-compose.yml
    - docker-compose.dev.yml

key-decisions:
  - "runs.ts reads the flag as CommandQueue.global.laneMode === true, so a queue stub with no laneMode (operatorOnly.test.ts) behaves as flag off"
  - "The refusal is raised after the operator-only scan, so an operator-only refusal still wins when both apply"
  - "A per-call { lane } on a Tool Box step is honoured (not dropped) so validateLanes can refuse it with the S2c sentence; only the sticky lane is withheld from Tool Box"
  - "preview computes laneWarnings on the resolve-failure branch from the unresolved commands, and returns [] on script failure"

patterns-established:
  - "Plan-local copy of the operatorOnly.test.ts harness with a mutable fakeQueue.laneMode"

requirements-completed: [LUI-03]

coverage:
  - id: D1
    description: "Run creation refuses invalid lane setups with the exact sentences, stores and enqueues nothing, logs Lane Setup Refused stage=create"
    requirement: "LUI-03"
    verification:
      - kind: unit
        ref: "controller/test/laneValidation.test.ts#run-creation lane validation (D-17, LUI-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The refusal reaches the operator verbatim through run.create (BAD_REQUEST) and POST /api/runs (400), classified by name"
    requirement: "LUI-03"
    verification:
      - kind: unit
        ref: "controller/test/laneValidation.test.ts#entry-point mappings"
        status: pass
      - kind: unit
        ref: "controller/test/laneValidation.test.ts#LaneValidationError name-guard source pin"
        status: pass
    human_judgment: false
  - id: D3
    description: "With the flag off lane tags are inert, created runs proceed, and one Lane Tags Ignored line is logged only when tags exist"
    verification:
      - kind: unit
        ref: "controller/test/laneValidation.test.ts#run-creation lane validation (D-17, LUI-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "galago.lane and per-call lane/barrier options; untagged scripts byte-identical; Tool Box never inherits the sticky lane"
    requirement: "LUI-02"
    verification:
      - kind: unit
        ref: "controller/test/laneScript.test.ts#galago.lane and per-call lane options (D-19, LUI-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "protocol.preview laneWarnings (validateLanes on, single inert line off with tags, [] otherwise)"
    requirement: "LUI-04"
    verification:
      - kind: unit
        ref: "controller/test/laneScript.test.ts#protocol.preview laneWarnings (D-17, D-26, LUI-04)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Compose files document GALAGO_PARALLEL_LANES defaulting to empty; the runtime env read inside the image is confirmed in UAT (08-10)"
    verification:
      - kind: unit
        ref: "controller/test/laneScript.test.ts#compose documents the flag (D-06)"
        status: pass
    human_judgment: true
    rationale: "The container actually receiving the variable at runtime is an A1 UAT item in 08-10; the test only reads the compose text"

duration: 12 min
completed: 2026-11-16
status: complete
---

# Phase 8 Plan 7: Lane Validation, Script API and Preview Warnings Summary

**Run creation now refuses invalid lane setups by name-guarded LaneValidationError through both entry points, scripts can tag lanes with galago.lane(...), and the preview reports laneWarnings, with GALAGO_PARALLEL_LANES documented in compose.**

## Performance

- **Duration:** 12 min
- **Tasks:** 2 (both TDD, RED then GREEN)
- **Files modified:** 9 (2 new test files)

## Accomplishments

- `createFromProtocol` runs `validateLanes` right after the operator-only scan when `CommandQueue.global.laneMode` is on; a refusal logs "Lane Setup Refused" (stage=create, sanitised) and throws `LaneValidationError`, so no run is stored or enqueued.
- `run.create` maps it to `BAD_REQUEST` and `POST /api/runs` to 400, both with the verbatim message and no `instanceof`.
- With the flag off, tagged protocols are created and run sequentially, with one "Lane Tags Ignored" info log per created run (D-08).
- `galago.lane(name)` sets a sticky lane (blank or "primary" resets); `galago.command(toolId, command, params, { lane, barrier })` overrides per call. `lane` and `laneBarrier` keys exist only when set. Tool Box helpers never inherit the sticky lane.
- `protocol.preview` returns `laneWarnings` on every return object.
- Both compose files list `GALAGO_PARALLEL_LANES=${GALAGO_PARALLEL_LANES:-}`.

## TDD Gate Compliance

- RED 1 `45ebb08` (7 of 11 cases failed on the planned assertions; the 4 regression cases that pass today are the unchanged-behaviour guards), GREEN 1 `c88a4e6`.
- RED 2 `93fd218` (11 of 13 failed: `galago.lane` undefined so scripts failed, `laneWarnings` undefined, compose lacked the line; the 2 passing cases are the untagged-script guards), GREEN 2 `ad724f9`.
- No REFACTOR commit needed. RED evidence was inspected from the vitest output; `gsd_run check tdd-red-evidence` was not run (vitest default reporter, not TAP).

## Task Commits

1. Task 1 RED: `45ebb08` test(08-07): add failing run-creation lane validation cases
2. Task 1 GREEN: `c88a4e6` feat(08-07): refuse invalid lane setups at run creation
3. Task 2 RED: `93fd218` test(08-07): add failing lane script API, preview warnings and compose cases
4. Task 2 GREEN: `ad724f9` feat(08-07): galago.lane script API, preview laneWarnings and compose flag docs

## Deviations from Plan

None - plan executed exactly as written. (One tsc typing fix inside Task 2: `advancedParameters` is typed `AdvancedParameters` rather than cast from `Record<string, unknown>`; no behaviour change.)

## Verification

- `npx vitest run` full suite: 46 files, 1323 tests pass; `npx tsc --noEmit` clean; prettier clean on all touched TS files.
- `operatorOnly.test.ts` and `runCreateReload.test.ts` pass unedited; `controller/test/fixtures/lanesFlagOff.golden.ts` has no diff against 2da2ad7.
- Acceptance greps: `isLaneValidationError(error)` 1, `isLaneValidationError(e)` 1, `case "LaneValidationError"` 1, "Lane Tags Ignored" 1 in runs.ts, `laneWarnings` 3 in routers/protocol.ts, `runAsynchronously: false` 1 in the executor, compose flag present in both files.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or trust boundary beyond the plan's threat model; T-08-22 to T-08-25 are mitigated as planned (shared creation path, name guards, Tool Box never inherits, sanitised log details).

## Issues Encountered

None.

## Next Phase Readiness

The server half of LUI-02 and LUI-04 is in place. The client halves (editor fields, lane summary, laneWarnings Alert) land in 08-08 and 08-10. LUI-04 and LUI-02 stay pending in REQUIREMENTS.md until those plans complete (LUI-02 is also declared by 08-10).

## Self-Check: PASSED

- FOUND: controller/test/laneValidation.test.ts, controller/test/laneScript.test.ts
- FOUND commits: 45ebb08, c88a4e6, 93fd218, ad724f9 (all ancestors of HEAD)
