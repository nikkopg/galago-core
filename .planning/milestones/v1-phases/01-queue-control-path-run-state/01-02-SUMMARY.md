---
phase: 01-queue-control-path-run-state
plan: 02
subsystem: api
tags: [trpc, grpc, fast-tool, command-queue, runControl]

# Dependency graph
requires:
  - phase: 01-queue-control-path-run-state (plan 01)
    provides: "Vitest runner, global test mocks, and the installFakeTool/removeFakeTool/deferred fake gRPC double used to drive the real busy loop with no network"
provides:
  - "controller/server/runControl.ts: frozen, import-free runControl capability map (fast: pause/resume/abort) plus own-property-safe getRunControl and validateControlRequest implementing the full D-03/QUE-03 fixed refusal order (a-e)"
  - "Tool.lookup(toolId) and Tool.controlCommand(action, params): a direct gRPC executeCommand send that bypasses the step-plumbing executeCommand path entirely"
  - "CommandQueue.runningStep: in-memory, frozen snapshot of the step the busy loop is currently awaiting, set/cleared only around the single tool-step dispatch (never for Tool Box built-ins)"
  - "CommandQueue.toolControl(action, params): validates, sends via Tool.controlCommand, returns {ok, response, message} unthrown for a non-SUCCESS reply, throws TRPCError for refusals and transport errors, and audits every attempt exactly once with logAction"
  - "commandQueue.toolControl tRPC mutation with no tool-id input field — the target is always CommandQueue.runningStep's tool"
affects: ["01-03", "01-04", "01-05", "phase-2-ui-control-bar"]

# Actuals (#2632)
actuals:
  tokens: 8286
  tasks: 2
  commits: 3
plan_head_before: d22e3d517cbe6f71e1edc3a23819aa383f5c704c
plan_head_after: baa4a9389b4ad8047b5a2cc733c7945504bbafd7

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capability map as a dependency-free, deep-frozen module (runControl.ts) shared by server validation and (in Phase 2) the UI — one source of truth for a per-tool-type action/decision shape"
    - "Own-property-safe map lookups (Object.prototype.hasOwnProperty.call) everywhere a string key from an untrusted request indexes into a declared-shape map, so inherited names (constructor, toString, __proto__) can never resolve to a declared tool type or action"
    - "Set-before/clear-in-finally around a single await to expose an in-memory 'currently in flight' snapshot, without touching the surrounding busy loop's error handling or state machine"

key-files:
  created:
    - controller/server/runControl.ts
    - controller/test/toolControl.test.ts
    - controller/test/runControl.test.ts
  modified:
    - controller/server/tools.ts
    - controller/server/command_queue.ts
    - controller/server/routers/command_queue.ts

key-decisions:
  - "Task 1 (tracer) implemented CommandQueue.toolControl as one cohesive method covering validation, the tool send, non-SUCCESS passthrough, transport-error handling, and per-outcome audit logging — rather than splitting transport-error handling into Task 2 as the plan's pattern map suggested. This meant Task 2's RED phase only produced genuine failing tests for the one behavior that was still missing (the undeclared-parameter refusal, D-03 check e); the other Task 2 behavior tests (tool-without-runControl, blank decision, unthrown tool refusal, single-attempt transport error, per-attempt audit logging, queue/modal non-interference, runningStep clearing on step failure) passed immediately as regression coverage for Task 1's implementation. Documented here rather than hidden; the full RED-GREEN cycle was still followed for the one genuinely new behavior."
  - "toolControl's audit details string logs the raw submitted params (decisions=<JSON of params>), not the post-validation verdict.decisions, so a refused request's details still show exactly what the operator/UI sent — this matches the plan's 'decisions=<JSON>' wording and the D-07 test's expectation."
  - "detailsFor the undeclared-parameter message uses the submitted key itself, not a normalized form, so the UI/test can see literally which key was rejected (e.g. 'hard', 'extra')."

requirements-completed: [QUE-01, QUE-02, QUE-03]

coverage:
  - id: D1
    description: "commandQueue.toolControl reaches the running F.A.S.T. step's tool as {fast:{pause:{}}} while that step's executeCommand is still pending; the queue stays BUSY and the step completes normally afterward"
    requirement: "QUE-01"
    verification:
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > reaches the tool while the step is still pending"
        status: pass
    human_judgment: false
  - id: D2
    description: "toolControl refuses, without sending anything, when there is no running step, when the running tool type has no runControl entry, when the action is undeclared, or when a declared decision is missing/blank/not exactly yes-or-no — fail-closed per D-03's fixed order (a)-(e)"
    requirement: "QUE-02"
    verification:
      - kind: unit
        ref: "controller/test/runControl.test.ts#validateControlRequest refuses"
        status: pass
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > refuses with no running step"
        status: pass
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > refuses during a Tool Box pause built-in (D-02, Pitfall 1)"
        status: pass
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > refuses a running tool without runControl"
        status: pass
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > refuses a blank decision"
        status: pass
    human_judgment: false
  - id: D3
    description: "CommandQueue.runningStep is set immediately before a real tool step's executeCommand and cleared in a finally on success and on failure; Tool Box built-ins never set it"
    verification:
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > runningStep mirrors the running step"
        status: pass
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > clears runningStep when the step fails"
        status: pass
    human_judgment: false
  - id: D4
    description: "A non-SUCCESS tool reply (e.g. a core Refused) is returned as {ok:false, response, message} with its reason text intact, not thrown; a transport error surfaces as one TRPCError with no retry"
    requirement: "QUE-01"
    verification:
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > returns a tool refusal unthrown"
        status: pass
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > surfaces a transport error once"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every toolControl attempt writes exactly one logAction record (sent/refused/tool-refused/transport-failed) carrying action, decisions and outcome, info on SUCCESS and warning otherwise"
    requirement: "QUE-01"
    verification:
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > logs every attempt"
        status: pass
    human_judgment: false
  - id: D6
    description: "runControl declares exactly fast:{pause:{}, resume:{is_tip_broken:'yesno'}, abort:{return_liquid:'yesno'}}, deep-frozen, with no hard pause decision; it is a separate, dependency-free map from commandFields"
    requirement: "QUE-03"
    verification:
      - kind: unit
        ref: "controller/test/runControl.test.ts#runControl map"
        status: pass
      - kind: unit
        ref: "controller/test/runControl.test.ts#commandFields untouched (D-10)"
        status: pass
    human_judgment: false
  - id: D7
    description: "QUE-03 refusal ordering is fixed: (a) running step, (b) runControl entry, (c) action declared, (d) declared decisions in order, (e) undeclared parameters — the first failure alone sets the error"
    requirement: "QUE-03"
    verification:
      - kind: unit
        ref: "controller/test/runControl.test.ts#validateControlRequest ordering (QUE-03)"
        status: pass
      - kind: unit
        ref: "controller/test/toolControl.test.ts#toolControl > never touches the queue"
        status: pass
    human_judgment: false
  - id: D8
    description: "galago-core performs no instrument-state check: toolControl's decision path reads only runningStep and runControl, never run state, Tool.status or any instrument reply"
    requirement: "QUE-02"
    verification: []
    human_judgment: true
    rationale: "Proven by code inspection (toolControl's method body contains no reference to run state, Tool.status, or a tool reply field before deciding whether to send) rather than a dedicated runtime assertion; the acceptance-criteria grep against the method body is mechanical but the absence-of-a-check claim itself is a judgment call best confirmed by a human reviewer."

duration: ~35min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 2: Server Control Path & runControl Capability Map Summary

**`commandQueue.toolControl({action, params})` sends an operator's Pause/Resume/Abort straight to the running F.A.S.T. step's tool via a new, dependency-free `runControl` capability map — fail-closed in a fixed order, auditing every attempt, and never touching the busy loop's state machine or stored commands.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-10-13T05:08:00Z (approx.)
- **Completed:** 2026-10-13T05:22:52Z (last verification run)
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- `controller/server/runControl.ts`: a new, import-free, deep-frozen capability map (`fast: {pause: {}, resume: {is_tip_broken: "yesno"}, abort: {return_liquid: "yesno"}}`) plus `getRunControl` and `validateControlRequest`, implementing the complete D-03/QUE-03 fixed refusal order — no running step, no runControl entry, undeclared action, missing/blank/unclear decision, undeclared parameter — all own-property-safe against inherited names like `constructor`/`toString`/`__proto__`
- `Tool.lookup` (own-property-safe tool lookup) and `Tool.controlCommand` (a direct, undecorated gRPC `executeCommand` send with no step plumbing, no variable substitution, and no retry) added to `controller/server/tools.ts`
- `CommandQueue.runningStep` — a frozen, in-memory snapshot of the step the busy loop is currently awaiting — is set immediately before and cleared in a `finally` around the one "Regular command, send to Tool" dispatch; Tool Box built-ins (pause, user_form, timer, etc.) never set it
- `CommandQueue.toolControl` validates, sends, returns `{ok, response, message}` unthrown for a non-SUCCESS tool reply, throws a `TRPCError` for refusals and for a single-attempt transport failure, and writes exactly one `logAction` record per attempt (info on success, warning otherwise)
- `commandQueue.toolControl` tRPC mutation added with no tool-id input field — the target is always `CommandQueue.runningStep`'s tool, never a caller-chosen one
- 42 new unit tests across `controller/test/runControl.test.ts` (31, pure) and `controller/test/toolControl.test.ts` (11, through the real busy loop and tRPC caller with the fake gRPC double from plan 01-01); full suite is 48/48 green; `tsc --noEmit` reports 0 errors
- `controller/components/tools/constants.ts` left byte-for-byte unchanged (D-10), confirmed by `git diff --exit-code`

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end Pause and Resume (tracer)** - `afc2149` (feat) — runControl.ts (checks a-d), Tool.lookup/controlCommand, CommandQueue.runningStep/toolControl (including transport-error handling and per-outcome audit logging), the toolControl tRPC mutation, and the Task 1 harness tests
2. **Task 2: Fail closed on every unsafe request, and audit every attempt (TDD)** - `2a97b22` (test, RED) + `baa4a93` (feat, GREEN) — the RED commit added `runControl.test.ts` (2 of 31 tests intentionally failing on the missing undeclared-parameter check) and extended `toolControl.test.ts` with 8 more behavior tests; the GREEN commit added check (e) to `validateControlRequest`, bringing the suite to 42/42 green. No REFACTOR commit was needed — the GREEN implementation was already minimal.

**Plan metadata:** pending (this commit)

_Note: Task 2 followed the RED-GREEN-REFACTOR cycle for the one behavior that was genuinely new at that point (the undeclared-parameter refusal); see "Deviations from Plan" below for why most of Task 2's other planned behaviors were already implemented and passing going into its RED phase._

## Files Created/Modified
- `controller/server/runControl.ts` - New: frozen `runControl` map, `getRunControl`, `validateControlRequest` (full a-e refusal order)
- `controller/server/tools.ts` - Added `ToolControlResult` interface, `Tool.lookup`, `Tool.controlCommand`
- `controller/server/command_queue.ts` - Added `RunningStep` interface, `_runningStep` field + `runningStep` getter, set/clear around the busy loop's tool-step dispatch, `CommandQueue.toolControl`
- `controller/server/routers/command_queue.ts` - Added `toolControl` tRPC mutation
- `controller/test/toolControl.test.ts` - New: 11 tests through the real busy loop and tRPC caller
- `controller/test/runControl.test.ts` - New: 31 pure tests of the map and `validateControlRequest`

## Decisions Made
- Task 1's `toolControl` implementation bundled validation, the tool send, non-SUCCESS passthrough, transport-error handling, and audit logging into one method rather than splitting transport-error handling out for Task 2 as the pattern map sketched — see Deviations below.
- The audit details string logs the raw submitted `params` as `decisions=<JSON>`, not the post-validation `verdict.decisions`, so refused attempts still show exactly what was submitted (matches D-07 and the plan's literal details-string spec).
- `Tool.controlCommand`'s payload build reuses `_payloadForCommand` verbatim (no new payload logic), matching D-05/D-08's 1:1 F.A.S.T. `Command` oneof mapping.

## Deviations from Plan

### Process deviation (documented, not a correctness bug)

**1. Task 1 (tracer) implemented more of Task 2's planned behavior than the task split called for**

- **Found during:** Task 2's RED phase (writing failing tests per the TDD plan)
- **What happened:** The plan's task split has Task 1 (tracer) deliver validation checks (a)-(d), the tool send, and the basic success path, with Task 2 (TDD) adding check (e) (undeclared parameters), the transport-error try/catch, and the full audit-logging contract. While implementing Task 1 as one cohesive, correct method (a half-finished `toolControl` with no transport-error handling would leave an unhandled-rejection-shaped gap), the transport-error catch, the `"Tool Control Failed"` log action, and the `"Tool Control"` log action for both success and non-SUCCESS outcomes were all written during Task 1, ahead of the plan's split.
- **Effect:** Task 2's RED phase (writing `controller/test/toolControl.test.ts`'s 8 additional behavior tests plus `controller/test/runControl.test.ts`) found that only 2 of 42 new assertions were genuinely RED — both in `runControl.test.ts`, both exercising the one behavior that really was still missing: the undeclared-parameter refusal (check e). The other 8 new `toolControl.test.ts` tests (tool-without-runControl, blank decision, unthrown tool refusal, single-attempt transport error, per-attempt audit logging, queue/modal non-interference, runningStep clearing on step failure) passed immediately, serving as regression coverage for Task 1's implementation rather than driving new implementation.
- **Resolution:** Followed the full RED-GREEN cycle for the one behavior that was genuinely untested-and-missing (check e): committed the RED state (`2a97b22`, 2 of 31 `runControl.test.ts` tests failing on the planned assertion, verified via `npm run test:unit`), then implemented check (e) and committed GREEN (`baa4a93`, 42/42 passing).
- **Files modified:** controller/server/command_queue.ts (Task 1), controller/server/runControl.ts (Task 2 GREEN)
- **Verification:** `npm run test:unit` reports 48/48 passing; `tsc --noEmit` reports 0 errors; all Task 1 and Task 2 acceptance-criteria greps pass (see below)
- **Committed in:** afc2149 (Task 1, where the bundling occurred), 2a97b22 (RED), baa4a93 (GREEN)

---

**Total deviations:** 1 process deviation (no correctness impact — every planned behavior is implemented and tested; only the task-to-task RED/GREEN split shifted)
**Impact on plan:** None on scope or correctness. All must-have truths and prohibitions in the plan are implemented and covered by tests, as itemized in the `coverage` block above.

## Acceptance Criteria Verification

- `grep -c 'toolControl: procedure' controller/server/routers/command_queue.ts` → 1
- `grep -cE '^\s*import ' controller/server/runControl.ts` → 0
- `grep -c '_runningStep = ' controller/server/command_queue.ts` → 2, both within the "Regular command, send to Tool" → "Command Executed" range
- `grep -rnE 'controlCommand\(' controller/server --include=*.ts | grep -vE ':[0-9]+:\s*(//|\*)' | wc -l` → 2 (definition + one call site)
- `git diff --exit-code -- controller/components/tools/constants.ts` → exit 0 (untouched)
- `grep -c 'INTERNAL_SERVER_ERROR' controller/server/command_queue.ts` → 1
- `grep -cE 'hasOwnProperty\.call|Object\.hasOwn' controller/server/runControl.ts` → 4
- `grep -cE '_isWaitingForInput|_messageResolve|_currentMessage|this\.commands' <(awk '/async toolControl\(/,/^  }$/' controller/server/command_queue.ts)` → 0
- `npm run test:unit` → 48/48 passing; `npm test` (tsc --noEmit) → 0 errors

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `runControl.ts`'s shape (`{[toolType]: {[action]: {[decision]: "yesno"}}}`) and `commandQueue.toolControl`'s `{action, params?}` → `{ok, response, message?}` contract are now stable for Phase 2's control bar, pause prompt, and tool page to read directly.
- `CommandQueue.runningStep` is available for plan 01-04's 2 s run-state poller (D-11) to key its lifecycle off.
- QUE-06 (the real `fast.Command.Pause` proto, galago-tools Phase 1) is still pending; `{fast: {pause: {}}}` is asserted at the payload-object level against the fake gRPC double, as planned (D-19). No blockers for the remaining Phase 1 plans.

---
*Phase: 01-queue-control-path-run-state*
*Completed: 2026-10-13*

## Self-Check: PASSED
