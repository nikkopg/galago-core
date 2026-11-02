---
phase: 03-queue-start-guard-tool-error-visibility
plan: 02
subsystem: testing
tags: [f3, error-path, failing-test-first, response-code, vitest]

requires:
  - phase: 02-run-control
    provides: "FakeGrpc harness (installFakeTool), queue busy loop, retry-after-failure semantics"
provides:
  - "controller/test/errorPath.test.ts: 45-case failing-first table over every ResponseCode through a real queue._start(), the real Tool reply switch and the real getError router"
  - "Pinned operator-text contract (generic sentence + ' Tool said: ' + tool text, ERROR_FROM_TOOL prefix, empty/blank fallbacks, SUCCESS-with-text maps to ERROR_FROM_TOOL)"
  - "Pinned thrown-instance code name (codeString equals the code name) and getError seq contract"
affects: [03-04 error visibility fixes (must turn this file green with no expectation edits), verify-work for ERR-01]

actuals:
  tokens: 3203
  tasks: 2
  commits: 2
plan_head_before: 230d7d9ff67190786d9beef5d70bcbb0791b12ec
plan_head_after: 8eb3432c99f20299491badb43cf6a1dcf7262751

tech-stack:
  added: []
  patterns:
    - "Typed Record<ResponseCode, CodeCase> table plus a runtime key-equality test, so a new code without a row fails"
    - "Real reply switch under test: grpc.executeCommand.mockResolvedValueOnce, no Tool.executeCommand spy"
    - "Fresh in-memory CommandQueue per case; fake setTimeout only, advanceTimersByTimeAsync(3000) drives the 1500 ms busy loop"

key-files:
  created:
    - controller/test/errorPath.test.ts
  modified: []

key-decisions:
  - "The file is committed RED by design (D-10); no production file was touched, no assertion weakened, skipped or marked todo"
  - "Two commits, one per task: the queue-level table first, then the instance/seq/exhaustiveness groups"

requirements-completed: [ERR-01]

duration: 15min
completed: 2026-10-28
status: complete
---

# Phase 3 Plan 02: Failing-first ERR-01 Error-Path Test Summary

**A 45-case table test that drives every tool ResponseCode through a real queue start against a FakeGrpc tool and pins the getError payload, stored row error, both error log lines, the thrown error's code name and the failure seq, committed red (30 failed, 15 passed) until plan 03-04.**

## Performance

- **Duration:** about 15 min
- **Tasks:** 2
- **Files:** 1 created (339 lines), 0 production files changed

## Accomplishments

- ERR-01 queue-level table: for each of the 9 ResponseCode values, "with tool text", "with empty text" and "with blank text" cases, plus a verbatim-encoding group (INVALID_ARGUMENTS, ERROR_FROM_TOOL, DRIVER_ERROR) carrying leading/trailing spaces, markup, quotes, unicode and a newline. Each failing case asserts queue state FAILED, the getError payload (message, userFriendlyMessage, code, codeString, name), the row staying queued as FAILED with the stored Error's message and name, and the exact "Tool Command Execution Error" and "Command Failed" log details.
- ERR-02 thrown-instance group: calls `Tool.executeCommand` directly so `ToolCommandExecutionError.codeString` is asserted against the real code name (not vacuous; at HEAD it is "UNKNOWN" because the enum is string-valued).
- ERR-04 seq group: numeric safe integer seeded at or after construction time, exactly +1 across two identical failures, null after `clearError`, plain object with a seq and no code badge for non-tool errors, numeric gRPC transport code preserved.
- Exhaustiveness: typed `Record<ResponseCode, CodeCase>` plus a runtime key-equality check.

## Task Commits

1. **Task 1: queue-level table, red at HEAD** - `f21a4be` (test)
2. **Task 2: thrown code name, failure seq, exhaustiveness** - `8eb3432` (test)

## Red Baseline

Whole file: `Test Files  1 failed (1)`, `Tests  30 failed | 15 passed (45)`. Exit code 1, failures are assertion failures only (zero matches for Unhandled, timeout, module-load, SyntaxError or TypeError crashes). `tsc --noEmit` is clean.

**Passing controls (15), correct at HEAD:**
- with tool text: UNKNOWN_RESPONSE, DRIVER_ERROR, ERROR_FROM_TOOL, UNRECOGNIZED
- with empty text: UNKNOWN_RESPONSE, SUCCESS (clean-success control), WRONG_TOOL, DRIVER_ERROR, ERROR_FROM_TOOL, UNRECOGNIZED
- with blank text: WRONG_TOOL
- keeps tool text verbatim: ERROR_FROM_TOOL, DRIVER_ERROR
- ERR-04: getError is null after clearError
- covers every ResponseCode

**Failing (30), each caused by an ERR-02/04/05 defect:**
- with tool text: SUCCESS, WRONG_TOOL, UNRECOGNIZED_COMMAND, INVALID_ARGUMENTS, NOT_READY (generic sentence loses the appended tool text; SUCCESS-with-text is reported as SUCCESS without the prefix)
- with empty text: UNRECOGNIZED_COMMAND, INVALID_ARGUMENTS, NOT_READY (the router replaces the sentence with a generic userFriendlyMessage)
- with blank text: UNKNOWN_RESPONSE, SUCCESS, UNRECOGNIZED_COMMAND, INVALID_ARGUMENTS, DRIVER_ERROR, NOT_READY, ERROR_FROM_TOOL, UNRECOGNIZED (blank text passes through as the message instead of the fallback)
- INVALID_ARGUMENTS keeps tool text verbatim
- thrown instance: all 9 codes (codeString is "UNKNOWN", never the code name)
- ERR-04 seq: all four seq cases (no seq in the payload; non-tool errors returned as raw Error instances)

Note on a plan-text detail: WRONG_TOOL "with empty text" and "with blank text" pass at HEAD because its generic sentence already equals the router override, so those two are controls rather than red cases. This only widens the controls and does not hide any defect (WRONG_TOOL "with tool text" and its thrown-instance case are red).

## Verification Results

- `npx tsc --noEmit`: clean
- Control filter (4 codes with tool/empty text plus SUCCESS empty): 9 passed; extended filter with the exhaustiveness and clearError tests: 11 passed (plan minimum 9 and 11)
- `npx vitest run --exclude test/errorPath.test.ts`: 15 files, 258 tests passed
- `grep -cE "\.(skip|todo|fails)\(|it\.only|describe\.only"`: 0; no `vi.spyOn(Tool, "executeCommand")` in the file
- Production files: `git diff 230d7d9..HEAD --stat` lists only `controller/test/errorPath.test.ts`. The plan's literal check `git diff --stat 5726822 -- controller/server` is non-empty only because of plan 03-01's production changes in the same wave (queueStartListing.ts, SqliteQueue.ts, command_queue.ts); this plan changed none of them.
- Protected suites toolControl, sqliteQueue and queueRestart are unmodified.

## Deviations from Plan

None - plan executed exactly as written. The file was authored whole, then committed in two steps (table first, then the Task 2 groups) to give each task its own commit.

## Authentication Gates

None.

## Known Stubs

None. The file is intentionally red, which is the deliverable (D-10), not a stub.

## Threat Flags

None. FakeGrpc only; no real gRPC endpoint is constructed, so no instrument motion is possible.

## Issues Encountered

None.

## Next Phase Readiness

Plan 03-04 can implement ERR-02/04/05 and must turn `controller/test/errorPath.test.ts` green without editing any expectation. Until then, wave-level full-suite gates must run with `--exclude test/errorPath.test.ts`.

## Self-Check: PASSED

- FOUND: controller/test/errorPath.test.ts
- FOUND commits: f21a4be, 8eb3432 (ancestors of HEAD)
