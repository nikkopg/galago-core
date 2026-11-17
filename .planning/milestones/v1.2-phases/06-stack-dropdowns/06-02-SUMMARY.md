---
phase: 06-stack-dropdowns
plan: 02
subsystem: api
tags: [trpc, grpc, cache, vitest, stack, dropdowns]
status: complete

requires:
  - phase: 06-stack-dropdowns
    provides: "06-01 tracer: OPTION_SOURCES registry, parsers, fetchOptions, Tool.readOptions, tool.options query"
provides:
  - "Reply caps MAX_LIST_ITEMS 1000 / MAX_TREE_NODES 10000 / MAX_NAME_LENGTH 256 with boundary tests (too_large, never truncated)"
  - "Own-property reads of every reply key (inherited kind is bad_reply)"
  - "ok-only 15 s TTL cache keyed by normalized tool, epoch, configure generation and source on globalThis.__tool_options_state"
  - "In-flight dedupe with a separate :refresh key; 2 s reuse of the last successful refresh"
  - "Eviction on any failed live read; throttled, sanitized audit rows for failures and refreshes"
  - "Generation bumps in tool.configure (finally, both branches), tool.edit (old and new name), tool.delete and tool.clearToolStore (epoch)"
  - "D-17 server static scans in staticScan.test.ts"
affects: [06-03, 06-04, phase-07-fast-plates]

actuals:
  tokens: 16945
  tasks: 3
  commits: 5
plan_head_before: 982399ecc7382a00edfbbc6362028410012aa8b5
plan_head_after: 137ed3e3d9cf485deffcf3ab3f77c956aaf459fc

tech-stack:
  added: []
  patterns:
    - "Module state on a globalThis key (__tool_options_state) shared across Next route bundles"
    - "Cache key embeds epoch + generation, so a read started before a bump compares keys at settle time and is never stored"
    - "readThrough is synchronous up to in-flight registration so same-tick callers join"

key-files:
  created:
    - controller/test/fixtures/stackOptions.ts
    - controller/test/toolOptions.parse.test.ts
    - controller/test/toolOptions.read.test.ts
  modified:
    - controller/server/toolOptions.ts
    - controller/server/routers/tool.ts
    - controller/test/toolOptionsRouter.test.ts
    - controller/test/staticScan.test.ts

key-decisions:
  - "Reply keys are read through an own-property helper; a kind inherited through the prototype is bad_reply (T-06-09 hardening beyond the plan's no-spread rule)"
  - "MAX_LIST_ITEMS applies to the top-level lists (robots, profiles, devices); decks and nests are bounded only by the MAX_TREE_NODES count"
  - "Tree nodes are counted with length reads in a pre-pass that stops as soon as the cap is passed"
  - "A refresh audit row is written for any live refresh (ok or failed), throttled per (tool, source); a failed refresh also writes its own failure row"
  - "Pre-send outcomes (not_connected, wrong_tool_type) return before the cache layer: no cache read, no eviction, no log"

patterns-established:
  - "Lifecycle routes call bumpGeneration / bumpAllGenerations to invalidate server-side option caches"

requirements-completed: [DRP-04, DRP-06, DRP-07]

coverage:
  - id: D1
    description: "Over-cap replies are unavailable too_large at 1001 items / 10001 nodes; 256-char names kept, 257 dropped and degraded"
    requirement: DRP-07
    verification:
      - kind: unit
        ref: "controller/test/toolOptions.parse.test.ts"
        status: pass
  - id: D2
    description: "A failed live read evicts the cache and never serves a cached list; the next read recovers live"
    requirement: DRP-04
    verification:
      - kind: unit
        ref: "controller/test/toolOptions.read.test.ts#a failed refresh after a success returns unavailable, evicts, and the next read recovers live"
        status: pass
  - id: D3
    description: "Refresh bypasses the cache, sends refresh:true to list_devices / list_labware_profiles / list_transfer_profiles and {} to get_robot_states, with a 2 s reuse of the last successful refresh"
    requirement: DRP-06
    verification:
      - kind: unit
        ref: "controller/test/toolOptions.read.test.ts"
        status: pass
  - id: D4
    description: "configure (success, failure, refused), edit (old and new name), delete and clearToolStore make the next tool.options read go live"
    requirement: DRP-04
    verification:
      - kind: integration
        ref: "controller/test/toolOptionsRouter.test.ts#tool lifecycle routes invalidate cached options (06-02)"
        status: pass
  - id: D5
    description: "D-17 server scans: single readOptions caller, no queue reference, four-source registry, strict options input above latchStatus"
    requirement: DRP-07
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#tool options read path (D-17)"
        status: pass

duration: 8min
completed: 2026-11-06
---

# Phase 06 Plan 02: Hardened tool options read path Summary

**The STACK option-list reads are now capped (too_large, never truncated), cached for 15 s (only ok results) under a per-tool configure generation, deduped while in flight, refreshed live with the adapter refresh flag, evicted on any failure, logged with a throttle and sanitized, and pinned by D-17 static scans.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-11-06T02:09:48Z
- **Completed:** 2026-11-06
- **Tasks:** 3/3
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `server/toolOptions.ts` exports `MAX_NAME_LENGTH` (256), `MAX_LIST_ITEMS` (1000) and `MAX_TREE_NODES` (10000). An over-cap list, devices array, node count (devices + decks + nests) or ambiguous array returns the internal `"too_large"` outcome, which `fetchOptions` maps to `{status:"unavailable", reason:"too_large"}`. Names longer than the cap are dropped and the list is marked degraded.
- Every reply key is read through `own()`, which checks own properties only. Prototype-key replies (`__proto__`, `constructor`) change nothing, and a `kind` inherited through the prototype is treated as `bad_reply`.
- Cache layer (`readThrough` / `settleLive`):
  - The cache holds only ok results, for `OPTIONS_CACHE_TTL_MS` (15000). A cache hit returns the original `fetchedAt`.
  - In-flight reads are deduped. A refresh uses its own in-flight key (`:refresh`).
  - A refresh within `REFRESH_MIN_INTERVAL_MS` (2000) of the last successful live refresh gets that refresh's result. A failed refresh is never reused.
  - Any failed live read evicts both the cache entry and the last-refresh entry.
  - A read that started before a generation bump is never stored.
- Audit rows:
  - A live-read failure writes "Tool Options Read Failed" (warning). It includes the gRPC code for transport and timeout failures.
  - A live refresh writes "Tool Options Refreshed" (info).
  - Both are throttled to one row per (tool, source, event) per `OPTIONS_LOG_THROTTLE_MS` (60000), and the whole details string goes through `sanitizeLogText`.
- Generation bumps in `server/routers/tool.ts`:
  - `edit` bumps the old and new names after `removeTool`.
  - `delete` bumps the deleted name.
  - `configure` bumps in a `finally` on both the Tool Box branch and the DB branch.
  - `clearToolStore` calls `bumpAllGenerations()`.
  - Nothing was added below `latchStatus`.
- `staticScan.test.ts` has a new "tool options read path (D-17)" block with 6 cases.

## Task Commits

1. **Task 1: Caps and golden fixtures**
   - RED `0aa4768` (test)
   - GREEN `b39dadd` (feat)
2. **Task 2: Cache, generation, dedupe, refresh, logging**
   - RED `96dcf82` (test)
   - GREEN `d3e4719` (feat)
3. **Task 3: D-17 static scans**
   - `137ed3e` (test)

## TDD Gate Compliance

**Task 1**
- RED: the full run had 14 of 28 tests failing on planned assertions: missing constants, no too_large, long names kept, inherited kind accepted.
- Vitest's `tap-flat` reporter writes multi-line YAML for object `actual` values, which the classifier rejects as malformed TAP (`invalid_record`). The single-line target was re-run with `-t "pins MAX_LIST_ITEMS"` and the classifier returned `RED_EVIDENCE_OK` (target_test_failed).
- Semantic check: the target ran and failed on `expected undefined to be 1000`, which is the planned assertion.

**Task 2**
- The first RED run failed in `beforeEach` with `resetToolOptionsStateForTest is not a function`. That is a load failure, so it does not count as RED.
- Non-behavioral interface stubs were added to the working tree to get past it: the three timing constants and no-op `bumpGeneration` / `bumpAllGenerations` / `resetToolOptionsStateForTest`. They were never committed.
- After that, 19 of 46 tests failed on planned assertions, for example "expected spy to be called 1 times, but got 2". The target "two reads within 15 s send one call..." got `RED_EVIDENCE_OK`.
- The RED commit contains test files only. The stubs were replaced by the real implementation in the GREEN commit.

**Task 3**
- Not TDD (`type="auto"` with no tdd flag). These are structural pins over code that already exists, so they passed the first time.

## Decisions Made

See `key-decisions` in the frontmatter. The main ones:
- Own-property reads go beyond what the plan's T-06-09 text asks for.
- The list cap applies only to top-level arrays. The node cap bounds nested decks and nests.
- Refresh audit rows are written for both ok and failed live refreshes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] A reply `kind` inherited through the prototype was accepted**
- **Found during:** Task 1 (a new test, "a kind inherited through the prototype is not accepted")
- **Issue:** `checkKind` and the item reads used `obj[key]`, which resolves through the prototype chain.
- **Fix:** Added an `own(obj, key)` helper and switched every reply key read to it.
- **Files modified:** `controller/server/toolOptions.ts`
- **Commit:** `b39dadd`

**2. [Rule 3 - Blocking] Edit and delete tests needed a DB client**
- **Issue:** `test/setup.ts` mocks `@/db/client` as a Proxy that throws on any access.
- **Fix:** `toolOptionsRouter.test.ts` overrides that mock with a chainable plain-function stand-in (`update/set/where/delete/insert/values/returning`), the same approach as `runCreateReload.test.ts`. It also now calls `resetToolOptionsStateForTest()` in the existing 06-01 `beforeEach`, because the new cache would otherwise carry results between tests. No 06-01 assertions were changed.
- **Commit:** `96dcf82`

**3. [Formatting] Test files formatted with prettier**
- `toolOptions.parse.test.ts` was committed in Task 1 before prettier ran. It was reformatted in the Task 2 GREEN commit. The change is whitespace only.

**Total deviations:** 3, all auto-fixed. No scope change.

## Issues Encountered

- The vitest TAP reporter's output for object diffs cannot be parsed by the RED classifier. The workaround was to re-run a single-line target. A future plan could choose RED targets with primitive `actual` values.

## Verification

- `cd controller && npx tsc --noEmit` exits 0.
- `cd controller && npx vitest run`: 31 files, 690 tests passed.
- Project pins still hold:
  - `pages/tools/[id].tsx` has exactly two `?? ""`.
  - `latchStatus.test.ts` passes unedited, and nothing was added below `latchStatus`.
  - The `.controlCommand(` caller pin passes unedited.
  - No new file contains `acknowledge_failure`.
  - `commandFields.test.ts` is unchanged: `git log 2505ceb..HEAD` is empty and `git diff --quiet` passes.
- `grep -c "stack-automation-layer" controller/test/fixtures/stackOptions.ts` returns 0.

## Known Stubs

None. The Task 2 RED interface stubs were never committed.

## Next Phase Readiness

- 06-03 and 06-04 can rely on the server behavior: `fetchedAt` stays the same on a cache hit, a refresh sends `refresh: true`, and a failure always comes back as `unavailable` with nothing cached.
- Phase 7 (`fast.plates`) only needs to add an `OPTION_SOURCES` entry. The D-17 scan pins the registry to exactly four keys, so that scan has to be updated on purpose when the fifth source is added.

## Self-Check: PASSED

- FOUND: controller/test/fixtures/stackOptions.ts
- FOUND: controller/test/toolOptions.parse.test.ts
- FOUND: controller/test/toolOptions.read.test.ts
- FOUND commits: 0aa4768, b39dadd, 96dcf82, d3e4719, 137ed3e
