---
phase: 04
plan: 02
subsystem: enforcement
tags: [operator-only, guard, enqueue, execute-command, refusal, audit-log]
status: complete
requires:
  - controller/server/tools.ts (instance executeCommand @ :409 guard insertion point)
  - controller/server/runControl.ts (deepFreeze + own-property discipline cloned)
  - controller/test/helpers/fakeTool.ts (installFakeTool stack fake)
  - controller/test/recoveryControl.test.ts (tRPC-caller + STACK row patterns)
provides:
  - server/operatorOnlyCommands.ts — zero-import refuse table {stack:[acknowledge_failure], fast:[pause,resume,abort]} + own-property matcher + uncoded OperatorOnlyCommandError (D-01/D-03/D-04)
  - execute-time guard as first statement of Tool.executeCommand keyed on String(this.toolType), stage=execute audit before throw (D-02a)
  - enqueue-time scan in RunStore.createFromProtocol + join of the rethrow list, stage=enqueue audit (D-02b)
  - visible error mapping: tRPC BAD_REQUEST with the refusal's own message; REST HTTP 400 with the message
affects:
  - controller/components/tools/constants.ts commandFields hiding (plan 04-05 UI layer reads the same table conceptually)
  - .planning/debug/04-02/RED evidence artifacts persisted
tech-stack:
  added: []
  patterns: [zero-import spec module, two enforcement points from one table, own-property-only lookups, RED-green TDD with junit RED evidence adapter]
key-files:
  created:
    - controller/server/operatorOnlyCommands.ts
    - controller/test/operatorOnly.test.ts
    - .planning/debug/04-02/red-evidence.json
  modified:
    - controller/server/tools.ts
    - controller/server/runs.ts
    - controller/server/routers/run.ts
    - controller/pages/api/runs/index.ts
decisions:
  - "Command matching is trim+lowercase EXACT equality (D-04), not substring: the plan's '  ack' refusal-variant example contradicted its own matcher spec — 'ack' does not equal 'acknowledge_failure' after trim, so it is (correctly) NOT refused; deny-by-list never invents matches. Test pins both directions."
  - "REST mapping keys on e.name ('OperatorOnlyCommandError') in the existing switch instead of a class import — the existing switch is name-based (ProtocolNotFoundError/ZodError), and the planned import would have been dead code (tsc noUnusedLocals); the plan allowed either shape."
  - "RED evidence captured with vitest --reporter=junit: the vendor TAP adapter rejects vitest's YAML failure diagnostics ('Malformed TAP'/'Non-TAP data' issues) under both default and tap-flat reporters; junit is a supported adapter with an unmodified report. Classifier verdict: RED_EVIDENCE_OK."
metrics:
  duration: ~16 min (executor wall clock; includes two 51 s regression suites)
  completed: 2026-10-29T06:24Z
  tasks: 2
  commits: 3
commits: 3
plan_head_before: 8d84c390a8ec366ed356b7988f0dd4c825c8e5f8
plan_head_after: d86e3e02940f25d094e027105ac5726e5c456b06
actuals:
  tokens: 6360 # 25,434 diff chars / 4 over the files actually changed
  tasks: 2
  commits: 3
---

# Phase 4 Plan 02: operator-only refuse table + two enforcement points Summary

One zero-import table (`server/operatorOnlyCommands.ts`) enforced at the two locked points: the
instance `Tool.executeCommand` refuses every persistent path (queued row, "Send to Tool",
imported JSON, mislabelled stored step) before variable substitution and before any gRPC with a
stage=execute audit; `RunStore.createFromProtocol` refuses run creation whose generated steps
carry an operator-only command, audited stage=enqueue, with the refusal surfaced as an
own-message BAD_REQUEST (tRPC) / HTTP 400 (REST). The operator path (`Tool.controlCommand`) is
never guarded.

## What Was Built

**Task 1 (tracer) — `2ef263a`:**
- `controller/server/operatorOnlyCommands.ts` (new, 53 lines, zero imports): local `deepFreeze`
  clone, `operatorOnlyCommands = { stack: ["acknowledge_failure"], fast: ["pause", "resume", "abort"] }`
  (deep-frozen, D-01 includes fast now), `isOperatorOnlyCommand(toolType, command)` with
  own-property-only lookup on the toolType key and trim+lowercase exact match on the command (D-04;
  inherited names "toString"/"constructor"/"__proto__" never resolve at either level),
  `OperatorOnlyCommandError` — plain uncoded Error subclass, `this.name = "OperatorOnlyCommandError"` (D-03).
- `controller/server/tools.ts`: the guard is the FIRST statement of the instance `executeCommand` —
  `isOperatorOnlyCommand(String(this.toolType), command.command)` (the Tool's real type, never the
  stored JSON's `command.toolType`), then `logAction` level warning "Operator-Only Command
  Refused" with `stage=execute` + full identifiers, then the throw. Sits above the
  variable-substitution loop, so a `{{…}}` param can never rescue a refused command.
  `controlCommand` body untouched (static scan pinned at zero mentions).
- `controller/test/operatorOnly.test.ts` (new): table shape/freeze pins, case/whitespace matrix,
  prototype-chain refusals, "  ack"-not-refused pin, tracer end-to-end from the stack-fake
  instance with zero `grpc.executeCommand` calls and one audited warning, the same refusal through
  `tool.runCommand` create-caller (caller claims `ToolType.fast`; the instance still refuses),
  mislabelled-toolType proof, fast-transfer pass-through (`{fast:{transfer:{}}}` payload), and
  the `controlCommand` carve-out sending `{stack:{acknowledge_failure:{guid,arm_inspected}}}` unguarded.

**Task 2 (tdd) — RED `55053d9`, GREEN `d86e3e0`:**
- RED: 7 behavior tests appended (TDD RED evidence validated by the machine gate, see below);
  5 target tests failed on the planned assertion — `createFromProtocol` RESOLVED with a CREATED
  run and enqueued it today; the REST handler answered without any 400 mapping.
- GREEN:
  - `runs.ts`: import of the module; per-command loop immediately after
    `generateCommandsFromProtocol` — refusal message
    `Step N sends "command" on tool "toolId", which is an operator action; remove that step or run it from the tool page Run Recovery card.`,
    audited `stage=enqueue` first (protocolId, step index, toolId, toolType, command — declared
    type as the cheap early layer; the execute guard is the mislabelled backstop);
    `OperatorOnlyCommandError` added to the rethrow list so the wrap-unknown branch can never
    swallow it into `ProtocolGenerationFailedError` (research Pitfall 3). Zero-command lists fall
    out vacuously — the pre-existing "no commands" `ProtocolGenerationFailedError` outcome is
    unchanged (OPR-05 empty-parity).
  - `routers/run.ts`: `if (e instanceof OperatorOnlyCommandError) → TRPCError
    { code: "BAD_REQUEST", message: e.message }` placed BEFORE the `ProtocolGenerationFailedError`
    branch, keeping the refusal's own message verbatim (never "Could not generate commands…",
    never 500).
  - `pages/api/runs/index.ts`: `case "OperatorOnlyCommandError"` → `res.status(400).end(e.message)`
    in the existing switch (default 500 untouched).

## TDD Gate Compliance

- **RED:** `npx vitest run test/operatorOnly.test.ts --reporter=junit` exited 1 with the target
  test
  `operator-only enqueue refusal (D-02b) > refuses a visual protocol whose step list contains a
  stack acknowledge at create time…` failing on the planned assertion ("promise resolved with a
  CREATED run instead of rejecting"). Full unmodified report preserved at
  `.planning/debug/04-02/red-output-junit.xml`.
- **Machine gate:** `check tdd-red-evidence` returned `RED_EVIDENCE_OK` (format junit, 16 tests /
  11 pass / 5 fail, matched_test === target_test, report_errors empty). Semantic assessment: VALID
  RED — the harness is sound (11 unrelated assertions incl. the entire Task 1 suite passed in the
  same run) and the target failed for the intended reason (no enqueue scan implemented yet).
- **GREEN:** same file 16/16 passed; `tsc --noEmit` clean.
- **REFACTOR:** no changes warranted — namespaces/payloads match the pre-existing shapes exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Spec inconsistency] "  ack" refusal example contradicts the D-04 matcher**
- **Found during:** Task 1 (test authoring)
- **Issue:** The plan asks `"  ack"` to be refused "for matching", but its own matcher spec is
  trim+lowercase then `list.includes` — "ack" is not an entry.
- **Fix:** Implemented exact equality after trim+lowercase and pinned BOTH directions in the test
  (`"  acknowledge_failure\t"` → true, `"  ack"` → false with an explanatory comment). Exact
  equality is the safer refusal semantics: the guard never invents a match.
- **Files modified:** controller/server/operatorOnlyCommands.ts, controller/test/operatorOnly.test.ts
- **Commit:** 2ef263a

**2. [Rule 3 - Blocking] Test-file module mocks for the real RRunStore harness**
- **Found during:** Task 2 (RED authoring)
- **Issue:** setup.ts stubs `@/server/runs`, `@/db/client` and (via `vi.restoreAllMocks()` in the
  Task 1 suite's afterEach) wipes vi.fn implementations, so the enqueue suite could not drive the
  real `createFromProtocol` directly.
- **Fix:** Test-file-level mocks (last registration wins): real `@/server/runs` via
  `importOriginal`, chainable in-memory db fake, script-executor/resolve-tool-types identity
  mocks, `CommandQueue` facade stub with `enqueueRun` recording; the db chain implementations
  re-established in the enqueue suite's own `beforeEach`. Test-only; no production behavior change.
- **Files modified:** controller/test/operatorOnly.test.ts
- **Commit:** 55053d9 / d86e3e0

**3. [Rule 1 - Harness race] REST handler does not await postHandler**
- **Found during:** Task 2 GREEN
- **Issue:** `handler()` calls the async `postHandler` without awaiting, so the test's immediate
  assertions ran before the response flushed.
- **Fix:** setImmediate flush loop until the response stub is called (test-only, bounded at 50
  ticks).
- **Files modified:** controller/test/operatorOnly.test.ts
- **Commit:** d86e3e0

### Verify-command fallback

`vitest test/runs.test.ts` does not exist at HEAD (no such test file in the repo). Per the
plan's verify `<fails_when>` fallback, the operatorOnly file is authoritative for the enqueue
behavior and this is recorded here explicitly. Queue regression paths
(`toolControl`, `sqliteQueue`) and the execute-time suites (`tools`, `operatorOnly`, 52 tests
total) are all green, and `tsc --noEmit` is clean.

## Auth Gates

None — no package installed, no credentials needed (threat T-04-SC accept disposition unchanged).

## Threat Mitigations Realized

- **T-04-04** (EoP, critical): enqueue loop refuses every generated operator-only step with a
  visible own-message; execute guard covers EVERY remaining caller incl. stale queue rows and
  mislabelled imported JSON — before substitution, before gRPC; both audited.
- **T-04-05** (Tampering): intentional layering pinned by tests — enqueue keys on the declared
  type; execute keys on `String(this.toolType)` and refuses a mislabelled step.
- **T-04-06** (Tampering): own-property `Object.prototype.hasOwnProperty.call` lookups at both
  levels; "toString"/"constructor"/"__proto__" refusal tests only .
- **T-04-07** (Repudiation): every refusal path first writes the level-warning
  "Operator-Only Command Refused" action with stage=execute / stage=enqueue and full identifiers
  before the throw (asserted with exact recipients in both suites).

No new files introduce security surface beyond the planned table + two guards + two mappings —
no threat flags.

## Self-Check: PASSED

- controller/server/operatorOnlyCommands.ts — created ✓ (commit 2ef263a in HEAD ancestry)
- controller/test/operatorOnly.test.ts — created ✓ (2ef263a+55053d9+d86e3e0)
- guard present in controller/server/tools.ts above `const params = command.params;` ✓ (2ef263a)
- enqueue scan + rethrow in controller/server/runs.ts ✓ (d86e3e0)
- BAD_REQUEST branch in controller/server/routers/run.ts ✓ (d86e3e0)
- 400 case in controller/pages/api/runs/index.ts ✓ (d86e3e0)
- commits 2ef263a, 55053d9, d86e3e0 all reachable from HEAD ✓
- verification: 52/52 across operatorOnly+tools+toolControl+sqliteQueue ✓, tsc --noEmit clean ✓
