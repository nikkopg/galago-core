---
phase: 07-f-a-s-t-plate-dropdowns
plan: 06
subsystem: tool-options-server
tags: [fast, get_plates, tool.options, parser, registry, vitest, trpc]
requires:
  - phase: 07-f-a-s-t-plate-dropdowns
    provides: "07-05 frozen get_plates codec (Command_GetPlates in fast.ts) and the recorded frozen reply shape; 07-02 fixtures/fastPlates.ts"
provides:
  - "fast.plates as the fifth OPTION_SOURCES entry (toolType fast, command get_plates, acceptsRefresh true), served by tool.options with no router edit"
  - "PlateEntry, the ok 'plates' OptionsResult shape, parsePlates, MAX_PLATES / MAX_PLATE_DESCRIPTION_LENGTH / MAX_PLATE_ROWS / MAX_PLATE_COLS"
  - "fieldOptions.ts compile-required plates branches (SOURCE_LABELS, formatStatusLine count, buildFieldView typed-input fallback)"
  - "Router, parse, read-path and static-scan proofs for fast.plates"
affects: [07-07, 07-08]
tech-stack:
  added: []
  patterns:
    - "Closed registry extended by one entry; readLive list/tree branching replaced by an exhaustive switch over parsed.shape with a never check"
    - "Parser rejects, never repairs: bad id dropped + degraded, bad description -> '' + degraded, bad geometry -> null (not degraded)"
key-files:
  created: []
  modified:
    - controller/server/toolOptions.ts
    - controller/components/tools/fieldOptions.ts
    - controller/test/toolOptionsRouter.test.ts
    - controller/test/toolOptions.parse.test.ts
    - controller/test/toolOptions.read.test.ts
    - controller/test/fieldOptions.test.ts
    - controller/test/staticScan.test.ts
    - controller/test/fixtures/fastPlates.ts
key-decisions:
  - "Followed the frozen galago-tools d53da53 reply shape (no kind key; failures carry no plates key): absent kind accepted, kind present and not 'plates' is bad_reply; every non-SUCCESS code maps to tool_refused through the unchanged readLive path"
  - "acceptsRefresh true: the frozen GetPlates has optional bool refresh = 1"
  - "Existing router case that expected fast.plates to be rejected was a deliberate edit: it now uses an unknown source 'fast.nothing'"
requirements-completed: [PLT-03, PLT-04, PLT-05]
duration: 10 min
completed: 2026-11-12
status: complete
commits: 2
plan_head_before: 2dac7cede1c64a942e57fffdb04ce765a6d87c4b
plan_head_after: a5e2a685076d97a0cbddb611fe0f44e529c47127
actuals:
  tokens: 7700
  tasks: 2
  commits: 2
coverage:
  - id: D1
    description: "tool.options serves a validated plates list from a fast tool through the closed fast.plates source; exact { fast: { get_plates: {} } } payload (refresh true only on Refresh), 5 s deadline, wrong_tool_type with nothing sent for a stack tool, input stays strict"
    requirement: PLT-03
    verification:
      - kind: integration
        ref: "controller/test/toolOptionsRouter.test.ts#tool.options fast.plates (07-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "parsePlates rejects bad ids without truncation (12.7 never 12), keeps duplicates in reply order, caps the reply and each field, with every cap boundary pair tested"
    requirement: PLT-04
    verification:
      - kind: unit
        ref: "controller/test/toolOptions.parse.test.ts#parsePlates"
        status: pass
    human_judgment: false
  - id: D3
    description: "fast.plates read path behaves like the Phase 6 sources: cache within TTL, refresh bypass and throttle, failure mapping, and a failed read never returns the earlier cached list"
    requirement: PLT-03
    verification:
      - kind: unit
        ref: "controller/test/toolOptions.read.test.ts#fetchOptions fast.plates read path (07-06)"
        status: pass
    human_judgment: false
  - id: D4
    description: "get_plates is named by no file under components, hooks or pages and, among server sources, only by server/toolOptions.ts; the registry is pinned at five sources"
    requirement: PLT-05
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#get_plates is named by no non-generated server source except server/toolOptions.ts"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts#OPTION_SOURCES declares exactly the five D-02/D-03 sources"
        status: pass
    human_judgment: false
  - id: D5
    description: "The real plate list and get_plates answering mid-Transfer on a live or simulated F.A.S.T. (frozen commit); this plan proves the path on fake tools and fixtures only"
    requirement: PLT-03
    verification: []
    human_judgment: true
    rationale: "Needs a live or simulated F.A.S.T. on galago-tools d53da53; it is an end-of-phase UAT item (07-07)"
---

# Phase 7 Plan 06: fast.plates Option Source Summary

**fast.plates joins the closed tool.options registry: parsePlates validates and caps the frozen get_plates reply (bad ids rejected, never truncated; duplicates kept in order), the read path caches and fails like the Phase 6 sources, and get_plates stays internal to server/toolOptions.ts.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-11-12T09:24Z (approx.)
- **Completed:** 2026-11-12T09:35Z
- **Tasks:** 2
- **Files modified:** 8 (2 source, 6 test or fixture)

## Accomplishments

- Registry entry `"fast.plates"` (`toolType: "fast"`, `command: "get_plates"`, `kind: "plates"`, `acceptsRefresh: true`); `tool.options` accepts it with no router edit because the router input is `z.enum(OPTION_SOURCE_IDS)` and remains `.strict()`.
- `parsePlates(meta)`: own-property reads only; `kind` absent or `"plates"` accepted, anything else `bad_reply`; missing or non-array `plates` is `bad_reply`; over `MAX_PLATES` (1000) is `too_large` and never sliced. Per entry, in reply order: non-object dropped (degraded); id must be an integer in 1..2147483647 else dropped (degraded) and never repaired; description kept when a string of at most 256 UTF-16 code units and not variable-like, else `""` (degraded); `rowCount` / `colCount` kept when integers in 1..32 / 1..48, else `null` (not degraded). Duplicates kept, nothing sorted, `workingCapacity` not carried.
- `readLive` now switches exhaustively over `parsed.shape` (list, tree, plates) with a `never` check; the cache, in-flight dedupe, refresh throttle and logging are unchanged and apply to fast.plates.
- `fieldOptions.ts`: `SOURCE_LABELS["fast.plates"] = "plates"`, `formatStatusLine` counts plates (`0 items` for an empty list, degraded suffix kept), and `buildFieldView` sends a plates result to the typed-input fallback so it can never reach the list or cascade builders (the plate role itself is 07-08).
- Tests: 224 across the six targeted files, 984 in the full suite, `tsc --noEmit` clean.

## Task Commits

1. **Task 1: fast.plates end to end on the server** - `e851ee7` (feat)
2. **Task 2: Parser caps and read-path proofs** - `a5e2a685` (test)

**Plan metadata:** recorded in the docs(07-06) commit that follows this file.

## TDD Notes (Task 2, tdd="true")

- **RED:** the plan orders the parser (Task 1) before its boundary tests (Task 2) and says to record any case that is green on first run as already satisfied by Task 1. All Task 2 cases were green on first run, so there is no failing-test commit and no RED evidence file (`gsd_run check tdd-red-evidence` does not apply). Semantic assessment: the cases target behavior Task 1 already implemented.
- **Mutation check instead of RED:** to prove the new cases bite, `boundedInt` was temporarily changed to `Math.trunc` without `Number.isInteger`; four cases failed (`12.7 is dropped and the list is degraded`, `12.7 is never offered as 12`, `a bad entry among good ones...`, `geometry below 1, fractional...`). The file was restored byte-for-byte (no diff against HEAD for `server/toolOptions.ts`).
- **GREEN / REFACTOR:** no implementation change was needed in Task 2 and no refactor was made.

## Files Created/Modified

- `controller/server/toolOptions.ts` - registry entry, `PlateEntry`, plates result shape, `parsePlates`, four caps, exhaustive `readLive` switch
- `controller/components/tools/fieldOptions.ts` - plates source label, status-line count, plates fallback in `buildFieldView`
- `controller/test/toolOptionsRouter.test.ts` - fast.plates describe (exact payload, refresh, wrong tool type, strict input); the old "fast.plates is rejected" expectation became "fast.nothing is rejected"
- `controller/test/toolOptions.parse.test.ts` - parsePlates cases and every cap boundary pair
- `controller/test/toolOptions.read.test.ts` - fast.plates cache, refresh, failure mapping, no-stale-list cases
- `controller/test/fieldOptions.test.ts` - SOURCE_LABELS pin, plates status line, plates-to-typed-input case, plates entries in the three `Record<OptionSourceId, ...>` fixtures
- `controller/test/staticScan.test.ts` - five-source pin, server-side get_plates scan
- `controller/test/fixtures/fastPlates.ts` - bad-entry builders (`platesWith`, `platesWithoutId`, `PLATES_FRACTIONAL_ID`, `platesWithDescriptionLength`, `platesWithoutGeometry`, `platesWithInheritedKeys`); existing exports untouched

## Decisions Made

- Followed the frozen d53da53 shape over the contract (07-05-SUMMARY): no `kind` key in the reply, so an absent kind is accepted; failures (`NOT_READY`, `ERROR_FROM_TOOL`, `DRIVER_ERROR`) carry no `plates` key and map to `tool_refused` via the unchanged `readLive` path. `read_failed` is still reachable only when a reply carries `kind: "readFailed"`, which the frozen tool does not send for plates; the case is kept as parity with the Phase 6 sources.
- A plates result reaching a list or cascade binding is treated as unavailable (typed input), per the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests failed to compile once the registry widened**
- **Found during:** Task 1
- **Issue:** `Record<OptionSourceId, OptionsResult>` fixtures in `controller/test/fieldOptions.test.ts` (three) lacked the new `fast.plates` key, and the router test "rejects ... an unknown source" used `fast.plates` as its unknown source.
- **Fix:** Added a `platesResult([])` entry to the three records; the router test now uses `fast.nothing`. Both are deliberate edits of pins this plan exists to change (the file is in the plan's `files_modified`).
- **Files modified:** `controller/test/fieldOptions.test.ts`, `controller/test/toolOptionsRouter.test.ts`
- **Verification:** `tsc --noEmit` exits 0; targeted and full suites green
- **Commit:** `e851ee7`

---

**Total deviations:** 1 auto-fixed (Rule 3, test pins). **Impact on plan:** none.

## Issues Encountered

- `controller/test/wire.test.ts` fails `prettier --check` (pre-existing from 07-05; out of scope, not touched). The Prettier check of every file this plan changed passes.

## Authentication Gates

None.

## Known Stubs

None. No field is bound to fast.plates yet by design (07-08 adds the plate role); `buildFieldView` returning typed input for a plates result is the documented interim behavior, not a stub.

## Threat Flags

None. The new surface (fast.plates through `tool.options`) is covered by T-07-19 to T-07-23 in the plan's threat model.

## Next Phase Readiness

- 07-07 / 07-08 can read `OptionsResult` with `shape: "plates"` (`plates: PlateEntry[]`, `degraded`, `fetchedAt`), keep duplicate ids to flag them, and bind the plate role to `fast.plates`.
- The live check (real plate list, get_plates answering mid-Transfer) remains an end-of-phase UAT item.
- The folded todo is intentionally not closed here; 07-08 closes it.

## Self-Check: PASSED

- FOUND: all eight modified files; `grep` counts: `"fast.plates"` 1, `get_plates` 3, `shape: "plates"` 4 in `controller/server/toolOptions.ts`; `parsePlates` 43 in the parse test, `fast.plates` 24 in the read test
- FOUND: commits `e851ee7` and `a5e2a685` are ancestors of HEAD; `git rev-list --count 2dac7ce..HEAD` = 2
- `tsc --noEmit` exit 0; targeted six files 224 passed; full `vitest run` 35 files, 984 tests passed

---
*Phase: 07-f-a-s-t-plate-dropdowns*
*Completed: 2026-11-12*
