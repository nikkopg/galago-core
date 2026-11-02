---
phase: 04
plan: 01
subsystem: recovery
tags: [recovery, acknowledge, validator, one-attempt, audit-log]
status: complete
requires:
  - controller/server/runControl.ts (cloned discipline; never modified)
provides:
  - server/recoveryActions.ts — zero-import deep-frozen recovery spec + fail-closed validator (OPR-01 server side)
  - server/recoveryControl.ts — rerouted audited recovery path (OPR-02)
affects:
  - controller/components/runs/controlDecision.ts (plan 04-03 imports the shared validator)
  - controller/server/operatorOnlyCommands.ts (plan 04-02, scan hygiene)
tech-stack:
  added: []
  patterns: [zero-import spec module, fail-closed validator with fixed refusal order, strict-success refusal, one-attempt no-deadline send]
key-files:
  created:
    - controller/server/recoveryActions.ts
    - controller/test/recoveryActions.test.ts
  modified:
    - controller/server/recoveryControl.ts
    - controller/server/routers/tool.ts
    - controller/test/recoveryControl.test.ts
decisions:
  - "Guid regex extended with \\u0085 (NEL) beyond the plan's pinned class: JavaScript \\s does not include U+0085, so the planned regex would have accepted a NEL-range control character that the plan's own test requires to be refused."
  - "D-06 reroute makes action-availability the FIRST server check: a tool type with no recovery entry now gets BAD_REQUEST (type-aware action refusal) instead of PRECONDITION_FAILED; the pf400 refusal-order test was updated to the new fixed order."
  - "D-10 present-check uses the raw error_message field with the only-empty-case === \"\" (whitespace-only is present), mirroring describeToolReply; implemented in Task 1, proven unmodified by Task 2's six behavior cases (green on first run)."
metrics:
  duration: ~13 min
  completed: 2026-10-29T06:06Z
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 5888101d9814ed0ebb16a5827c16afe7ba2a14fa
plan_head_after: dc1d9a89eecb64680abee897efc73bd82bfa4870
actuals:
  tokens: 9900 # 39,611 diff chars / 4 over the files actually changed
  tasks: 2
  commits: 2
---

# Phase 4 Plan 01: server recovery spec + rerouted recoveryControl Summary

Zero-import `server/recoveryActions.ts` spec/validator plus the rerouted audited
`recoveryControl` path: a completed stack acknowledge flows from the tRPC caller through exactly
one `tool.controlCommand` send carrying `{ stack: { acknowledge_failure: { guid, arm_inspected: "yes" } } }`,
fails closed in the fixed refusal order at every invalid input and while a step runs on the tool,
is audited at every outcome, and is never retried.

## What Was Built

**Task 1 (tracer) — `583d4f6`:**
- `controller/server/recoveryActions.ts` (new, 205 lines, zero imports): `RecoveryParamKind`
  ("yesno" | "confirmYes" | "guid"), deep-frozen `recoveryActions` (fast entries are inline value
  copies of runControl.fast.resume/abort, pinned by deep strict-equal tests; stack is
  `acknowledge_failure: { guid: "guid", arm_inspected: "confirmYes" }`), own-property-only
  `getRecoverySpec` / `listRecoveryActions` / `isRecoveryAction` (D-04), `isValidRecoveryGuid`
  (bounded, linear regex, never trimmed/coerced, D-08), `validateRecoveryRequest` cloning
  runControl's fixed refusal order and codes (a no-step < b no-entry < c undeclared action <
  d kind failure < e undeclared param; D-05/D-14), local `describeRecoveryValue` clone, and
  `RECOVERY_STRICT_SUCCESS` (D-10).
- `controller/server/recoveryControl.ts` (rerouted, D-06): `RECOVERY_ACTIONS` removed; refusal is
  `isRecoveryAction(toolType, action)` with the type-aware blade message; refuse-while-running is
  unchanged in rule (queue state only, UI-08) but type-aware in text (D-09) —
  "A run step is running on this tool; acknowledge after it ends." for types without a
  runControl entry, the existing run-page message kept for fast; validation via
  `validateRecoveryRequest` and the send is `tool.controlCommand(action, verdict.params)` — one
  call, no options, no deadline, never retried (D-23); D-10 strict-success refusal returns
  ok:false with the tool's own text and a warning audit.
- `controller/test/recoveryActions.test.ts` (new, 300 lines): fast-derivation pin (D-05),
  ["fast","stack"] keys pin, own-property lookups, guid 256/257/0/whitespace/NEL boundary matrix,
  arm_inspected confirmYes refusals, d-before-e proofs, full first-failing-only refusal order.
- `controller/test/recoveryControl.test.ts`: new "stack acknowledge" block — exact-payload
  single-send tracer (`installFakeTool("stack-1", "stack" as ToolType)`), refuse-while-running
  with the STACK message, run-page message retained for fast while running, undeclared action +
  audit line, blank/missing/failed-params matrix, zero sends on every refusal.
- `controller/server/routers/tool.ts`: stale D-22 comment updated to point at recoveryActions.ts.

**Task 2 (tdd) — `dc1d9a8`:** six behavior cases in the stack block: SUCCESS + message refused
(ok:false, tool's own message surfaced, warning audit), whitespace-only error_message treated as
present ( Pitfall 4 ), empty error_message accepted, SUCCESS + message on fast resume stays
ok:true (strict rule scoped to stack, `Tool.controlCommand` untouched), transport error audited
with its text and rethrown once, and the deferred-promise no-busy-wait proof that two completed
requests produce exactly two sends with distinct payloads (one attempt per request, no retry).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guid regex extended with \u0085 (NEL)**
- **Found during:** Task 1 (test run)
- **Issue:** The plan's pinned regex `^[^\s\u0000-\u001f\u007f]{1,256}$` accepts U+0085 (NEL)
  because JavaScript's `\s` class does not include it — but the plan's own boundary case
  requires "a NEL/NUL-range control char" to be ok:false.
- **Fix:** Exclusion class extended to `[^\s\u0000-\u001f\u0085\u007f]` (regex is still linear and
  length-bounded at 256; T-04-17 unchanged). Documented in the module's comment.
- **Files modified:** controller/server/recoveryActions.ts
- **Commit:** 583d4f6

**2. [Rule 3 - Blocking/consequential] pf400 refusal-order expectation updated**
- **Found during:** Task 1
- **Issue:** The D-06 reroute makes action-availability (BAD_REQUEST, type-aware) the first
  server check, so `pf400 + "resume"` is now BAD_REQUEST instead of the old
  `validateControlRequest`'s PRECONDITION_FAILED; the existing
  "refuses a tool type without runControl" test pinned the old order and would fail.
- **Fix:** Test updated to `code: "BAD_REQUEST"` with the exact new message — this is the new
  fixed refusal order, not a regression (validator-level b-before-c ordering is still pinned in
  recoveryActions.test.ts).
- **Files modified:** controller/test/recoveryControl.test.ts
- **Commit:** 583d4f6

### Auth Gates

None.

## Self-Check: PASSED

- controller/server/recoveryActions.ts — created ✓ (commit 583d4f6 in HEAD ancestry)
- controller/test/recoveryActions.test.ts — created ✓
- controller/server/recoveryControl.ts — rerouted ✓
- controller/test/recoveryControl.test.ts — extended ✓
- Commits 583d4f6, dc1d9a8 — both ancestors of HEAD ✓
- Final verify: 5 test files, 144 tests green; tsc --noEmit clean; `/latch/i` count in
  recoveryControl.ts = 0; runControl.ts diff vs pre-plan base = empty ✓

## Verification Results

- `npx vitest run test/recoveryActions.test.ts test/recoveryControl.test.ts` → 51 passed
- `npx vitest run test/runControl.test.ts test/toolControl.test.ts test/staticScan.test.ts` → 87 passed
- Final consolidated run (incl. staticScan) → 5 files, 144 tests passed
- `npx tsc --noEmit` → clean
- Acceptance greps: zero-import = 0, ack spec line = 1, `verdict.params` = 1 / `verdict.decisions`
  = 0, STACK refuse message = 1, `RECOVERY_ACTIONS` = 0, exact payload assertion + single-call
  assert present, fast deep-strict pin present, runControl untouched
