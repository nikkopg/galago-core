---
phase: 03-queue-start-guard-tool-error-visibility
plan: 04
subsystem: server
tags: [f3, error-path, tool-reply, failure-seq, server, vitest]
status: complete

requires:
  - phase: 03-queue-start-guard-tool-error-visibility
    provides: "03-01 _start guard; 03-02 red errorPath.test.ts; 03-03 staticScan block"
provides:
  - "controller/server/toolReply.ts: pure describeToolReply(command, toolId, reply), TOOL_SAID_JOINER"
  - "ToolCommandExecutionError.codeString is String(code) (real code name, never UNKNOWN)"
  - "CommandQueue._recordFailure / _failureSeq (clock seeded) / failureSeq getter"
  - "commandQueue.getError returns one plain payload carrying seq, code and codeString for tool errors"
affects: [03-05, 03-06, verify-work for ERR-01, ERR-02, ERR-04, ERR-05]

actuals:
  tokens: 9500
  tasks: 2
  commits: 2
plan_head_before: 18050a387c9974dce7cbe163a94a9e76f64a4ae4
plan_head_after: cdf48db1ac6a28d93ef662a4f8750223870fec82

tech-stack:
  added: []
  patterns:
    - "One pure composer for operator-facing tool text; the tool's own text is verbatim, only appended or prefixed"
    - "Single failure-recording helper bumps a monotonically increasing, clock-seeded seq"

key-files:
  created:
    - controller/server/toolReply.ts
    - controller/test/toolReply.test.ts
  modified:
    - controller/server/tools.ts
    - controller/server/command_queue.ts
    - controller/server/routers/command_queue.ts
    - controller/components/runs/RunsComponent.tsx
    - controller/test/staticScan.test.ts

key-decisions:
  - "Whitespace-only error_message counts as empty (generic sentence, no Tool said suffix); text with content is never trimmed"
  - "SUCCESS reply carrying a non-empty error_message is thrown as ERROR_FROM_TOOL (never SUCCESS)"
  - "_failureSeq seeded from Date.now() so a restarted process never reuses a dismissed seq"
  - "getError no longer substitutes sentences; message and userFriendlyMessage are both error.message"

requirements-completed: [ERR-01, ERR-02, ERR-04, ERR-05]

coverage:
  - id: D1
    description: "errorPath.test.ts (red since 03-02) passes in full with no expectation changed"
    requirement: "ERR-01"
    verification:
      - kind: unit
        ref: "controller/test/errorPath.test.ts (45 tests green)"
  - id: D2
    description: "Operator text per ResponseCode: tool text verbatim, generic + ' Tool said: ' suffix, empty handling, real code name"
    requirement: "ERR-02"
    verification:
      - kind: unit
        ref: "controller/test/toolReply.test.ts (60 tests)"
  - id: D3
    description: "Every failure gets a distinct seq exactly +1 via a single recording site"
    requirement: "ERR-04"
    verification:
      - kind: unit
        ref: "controller/test/errorPath.test.ts seq group"
      - kind: static-scan
        ref: "controller/test/staticScan.test.ts single failure-recording site"
  - id: D4
    description: "SUCCESS-with-message is reported as ERROR_FROM_TOOL, never SUCCESS"
    requirement: "ERR-05"
    verification:
      - kind: unit
        ref: "controller/test/toolReply.test.ts SUCCESS block"
---

# Phase 3 Plan 04: Tool error text, real code names and failure seq Summary

Failed tool steps now reach the operator with the tool's own words and the real code name, via one pure composer (`describeToolReply`). Every failure goes through a single helper that bumps a clock-seeded sequence number, so the banner can re-arm on a repeat of identical text.

## What was done

- **Task 1 (c6d9404):** new `server/toolReply.ts`. `tools.ts` `executeCommand` now calls it, logs `(Code: <code>)` for every failure and throws `ToolCommandExecutionError(failure.message, failure.code)`. `codeString` is `String(code)`; the `getResponseCodeString` method (which always returned "UNKNOWN" because the enum is string valued) is gone. New `toolReply.test.ts` table (60 tests) over every `ResponseCode`.
- **Task 2 (cdf48db):** `CommandQueue._recordFailure`, `_failureSeq = Date.now()`, `failureSeq` getter; `fail()`, the `_start` catch and the busy-loop catch use it, passing a local `failure` to `_notifyFailure`. The router's `getError` returns `queueErrorPayload(error, seq)` and no longer rewrites text for four codes. Three new static scans in `staticScan.test.ts` (new `describe`, existing blocks untouched: 84 added, 0 deleted).

## Verification

- `npm run test:unit`: 18 files / 386 tests passed (errorPath: 45/45 green, no expectation edited; its history is only the two `test(03-02)` commits).
- `npx tsc --noEmit`: clean.
- Protected files (toolControl, sqliteQueue, queueRestart tests): `git diff --stat 5726822` prints nothing.
- No tool is ever acknowledged, cancelled or retried by new code; all tests use fakes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RunsComponent ErrorBanner no longer type-checked**
- **Found during:** Task 2 (`tsc --noEmit`)
- **Issue:** Both getError payload shapes now carry `userFriendlyMessage`, so the banner's `else if ("message" in ...)` branch narrowed to `never`, and `codeString` read as `string | undefined`. The plan assumed the old narrowing would keep compiling.
- **Fix:** Minimal edit of the banner extraction: read `userFriendlyMessage` directly and guard `codeString` truthiness. Behaviour is the same; 03-06 replaces the banner.
- **Files modified:** controller/components/runs/RunsComponent.tsx
- **Commit:** cdf48db

**2. [Rule 3 - Blocking] `this.error` narrowing lost after `_recordFailure`**
- **Found during:** Task 2 (`tsc`)
- **Issue:** `_notifyFailure({ error: this.error })` is now `Error | undefined`.
- **Fix:** Use a local `failure` constant for both `_recordFailure` and `_notifyFailure`; `this.error` still holds the same raw Error.
- **Commit:** cdf48db

## Known Stubs

None.

## Threat Flags

None. The getError payload still returns `stack` as before (T-03-13, accepted).

## Self-Check: PASSED

- FOUND: controller/server/toolReply.ts, controller/test/toolReply.test.ts
- FOUND commits c6d9404, cdf48db
