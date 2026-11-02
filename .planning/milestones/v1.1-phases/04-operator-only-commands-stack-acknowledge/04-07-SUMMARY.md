---
phase: 04-operator-only-commands-stack-acknowledge
plan: 07
subsystem: api
tags: [gap-closure, run-create, trpc, error-mapping, next-dev, module-identity, vitest]

requires:
  - phase: 04-operator-only-commands-stack-acknowledge
    provides: "04-02 enqueue-time operator-only refusal (OperatorOnlyCommandError) in RunStore.createFromProtocol; 04-05 gap-closure baseline"
provides:
  - "tRPC run.create maps all four errors (operator-only refusal, not found, generation failed, params invalid) by error name, so the mapping survives a next dev recompile"
  - "Name-based guards isOperatorOnlyCommandError, isProtocolNotFoundError, isProtocolGenerationFailedError, isProtocolParamsInvalidError"
  - "runCreateReload regression that simulates the next dev require-cache purge with vi.resetModules()"
affects: [phase-04-verification, uat-test-7-retest]

actuals:
  tokens: 3932
  tasks: 2
  commits: 4

plan_head_before: 6a8e4a63d69a3dd4880c22bf67244d704e858a7c
plan_head_after: 935b4e9a6b2e205cdbdfacc9c16380d8a13d805c

tech-stack:
  added: []
  patterns:
    - "Classify errors by Error.name through exported guards next to each class, never by class identity, wherever a global-pinned singleton can belong to an older module copy"
    - "Reproduce next dev require-cache purge in vitest with vi.doUnmock + vi.resetModules so every import after the reset is a genuinely fresh copy"

key-files:
  created:
    - controller/test/runCreateReload.test.ts
  modified:
    - controller/server/operatorOnlyCommands.ts
    - controller/server/runs.ts
    - controller/server/routers/run.ts

key-decisions:
  - "Name-based guards (e instanceof Error && e.name === Class) instead of a Symbol brand or moving RunStore off global, matching pages/api/runs and tRPC's own TRPCError check"
  - "createFromProtocol's rethrow list also switched to the guards, so no class-identity classification remains on the run-create path"
  - "operatorOnlyCommands.ts stays zero-import; RunStore.global and CommandQueue.global stay on global"

requirements-completed: [OPR-04]

coverage:
  - id: D1
    description: "run.create returns BAD_REQUEST with the refusal's own message for an operator-only step after a simulated dev recompile, and in one module graph"
    requirement: OPR-04
    verification:
      - kind: unit
        ref: "controller/test/runCreateReload.test.ts#maps an operator-only step to BAD_REQUEST with the refusal's own message"
        status: pass
    human_judgment: false
  - id: D2
    description: "The other three branches (NOT_FOUND, generation-failed BAD_REQUEST, ZodError cause rethrow) map correctly in both variants"
    requirement: OPR-04
    verification:
      - kind: unit
        ref: "controller/test/runCreateReload.test.ts#run.create error mapping"
        status: pass
    human_judgment: false
  - id: D3
    description: "Four exported name-based guards and a source pin that fails if a class-identity check on the four classes returns"
    requirement: OPR-04
    verification:
      - kind: unit
        ref: "controller/test/runCreateReload.test.ts#run-create error guards"
        status: pass
      - kind: unit
        ref: "controller/test/runCreateReload.test.ts#run.create classifies errors by name, never by class identity"
        status: pass
    human_judgment: false
  - id: D4
    description: "UAT test 7 on a live next dev server (protocolId 2 -> 400, protocolId 999 -> 404 after other entries compile)"
    requirement: OPR-04
    verification: []
    human_judgment: true
    rationale: "The require-cache purge only happens in a live next dev process; vitest simulates it with vi.resetModules(), so the real server retest is a human check for /gsd-verify-work"

duration: 6min
completed: 2026-10-30
status: complete
---

# Phase 04 Plan 07: run.create module-identity gap closure Summary

**tRPC run.create now classifies its four mapped errors by `Error.name` through exported guards, so the operator-only refusal returns BAD_REQUEST (not a 500) even when next dev leaves RunStore.global on an older module copy.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-30T03:55:00Z (approx.)
- **Completed:** 2026-10-30T04:01:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- G-04-7 root cause fixed: the router's class-identity checks missed errors thrown by a stale `RunStore.global`, so every branch fell through to INTERNAL_SERVER_ERROR. All four branches now use name-based guards.
- Regression `controller/test/runCreateReload.test.ts` (21 tests) reproduces the dev purge with `vi.resetModules()`, was red first, covers all four branches in both a single module graph and the post-recompile shape, plus guard tables and a source pin.
- Unchanged by design: the enqueue refusal, its message and the `stage=enqueue` audit line; `RunStore.global`/`CommandQueue.global` on `global`; REST `POST /api/runs`; OPR-05 static scans pass unedited.

## Task Commits

1. **Task 1 (tracer): operator-only refusal maps to BAD_REQUEST after a simulated dev recompile**
   - `f0c0887` test: reproduce run.create 500 after a dev recompile (RED, reload variant INTERNAL_SERVER_ERROR, guard table failing)
   - `c419308` fix: map the operator-only refusal by error name in run.create
2. **Task 2: all four branches and the store's rethrow list classify by name**
   - `da85c17` test: pin all run.create branches across a dev recompile (RED: 13 failing)
   - `935b4e9` fix: classify run.create errors by name in all four branches

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified

- `controller/test/runCreateReload.test.ts` - Reload regression, guard tables, source pin.
- `controller/server/operatorOnlyCommands.ts` - `isOperatorOnlyCommandError` (module still zero-import).
- `controller/server/runs.ts` - Three guards after the error classes; `createFromProtocol` rethrow list uses the four guards.
- `controller/server/routers/run.ts` - `run.create` catch maps all four branches through the guards.

## Decisions Made

- Name-based guards over a Symbol brand or a store rewrite: matches the REST handler and tRPC's own approach, changes no runtime state, and leaves the shared `RunStore`/`CommandQueue` singletons alone.
- The store's own rethrow list is converted too, leaving no class-identity classification on the run-create path; the generic wrap using the builtin `Error` check stays.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test harness did not reproduce the drift for runs.ts's own error classes**
- **Found during:** Task 2 (RED step)
- **Issue:** With the plan's file-level `vi.mock("@/server/runs", importOriginal)` passthrough, vitest caches one copy of `server/runs` across `vi.resetModules()`, so the router and the store shared the same `ProtocolNotFoundError`/`ProtocolGenerationFailedError`/`ProtocolParamsInvalidError` classes and the three RED cases passed before the fix (only the operator-only class, from the unmocked `operatorOnlyCommands`, drifted).
- **Fix:** `loadCaller` (and the post-reset guard case) call `vi.doUnmock("@/server/runs")` before `vi.resetModules()` so every import after a reset is a genuinely fresh copy, as in next dev. RED then showed the three expected INTERNAL_SERVER_ERROR / wrapper-cause failures.
- **Files modified:** controller/test/runCreateReload.test.ts
- **Verification:** 13 failing before the fix, 21/21 after.
- **Committed in:** da85c17

**2. [Plan staleness - protected-file baseline] staticScan.test.ts differs from 37581c6**
- **Found during:** Task 1 acceptance check
- **Issue:** The plan's unchanged-file check compares against 37581c6, but plan 04-06 (same wave, completed earlier) legitimately added 107 lines of scans to `controller/test/staticScan.test.ts`.
- **Fix:** None needed to code. Compared against the true pre-plan HEAD (6a8e4a6) instead: operatorOnly.test.ts, staticScan.test.ts, pages/api/runs/index.ts and server/command_queue.ts have no diff. Against 37581c6 the other three are also unchanged.
- **Files modified:** none

---

**Total deviations:** 2 (1 Rule 3 harness fix, 1 baseline note). **Impact:** no production-code deviation; no scope creep.

## Issues Encountered

None beyond the deviations above.

## Gate Results

- `npx vitest run test/runCreateReload.test.ts test/operatorOnly.test.ts test/staticScan.test.ts`: 3 files, 80 tests pass.
- `npm run test:unit`: 24 test files (23 + runCreateReload), 570 tests, all pass.
- `npx tsc --noEmit`: clean.
- `npx next lint --no-cache --quiet --dir server --dir test`: no warnings or errors.
- `npx prettier --check` on the four touched files: clean.
- Acceptance greps: `isProtocol(NotFound|GenerationFailed|ParamsInvalid)Error(e)` = 3, `isOperatorOnlyCommandError(e)` = 1, `throw e.cause` = 1 in run.ts; `stage=enqueue` and `throw new OperatorOnlyCommandError(` still in runs.ts; operatorOnlyCommands.ts has 0 imports.
- No step started, connected to or commanded a STACK or F.A.S.T. tool.

## Open Human Check (for /gsd-verify-work)

UAT test 7 retest on a live `next dev` server (scratch copy of controller/, protocol 2 = one `stack` `acknowledge_failure` step; load /runs and /tools first, then POST `run.create` with protocolId 2 and 999). Expected: 400 BAD_REQUEST with the refusal message and a `stage=enqueue` audit line; 404 NOT_FOUND for 999; REST `POST /api/runs` still 400. Not run here: it needs a live dev server and a DB.

## Known Stubs

None.

## Threat Flags

None. Mitigations T-04-22, T-04-23 and T-04-25 are implemented and pinned by the reload regression plus unchanged OPR-05 scans; T-04-24 accepted as planned.

## Next Phase Readiness

All seven plans for phase 04 (including gap closure) are complete; ready for `/gsd-verify-work` with UAT test 7 retest as the remaining human check.

## Self-Check: PASSED

- FOUND: controller/test/runCreateReload.test.ts
- FOUND commits: f0c0887, c419308, da85c17, 935b4e9
