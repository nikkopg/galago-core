---
phase: 02-run-page-live-controls
plan: 04
subsystem: api
tags: [trpc, crash-recovery, audit-logging, tdd]

# Dependency graph
requires:
  - phase: 01-queue-control-path-and-run-state
    provides: validateControlRequest fail-closed refusal matrix, Tool.controlCommand (no deadline, no retry), CommandQueue.runningStep accessor
provides:
  - tool.recoveryControl tRPC mutation — Resume/Abort to an untracked tool by id/name, refuses when a running queue step tracks that tool, no deadline, audited
  - commandFields.fast without abort/resume (protocol step editor and tool-page Send Command form no longer offer them)
affects: [02-05 (tool-page UI wiring the recoveryControl hook), gsd-secure-phase]

actuals:
  tokens: 4609
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Crash-recovery control module (recoveryControl.ts) mirrors CommandQueue.toolControl's refusal order, logging and transport-error handling but targets a tool by id/name instead of the queue's in-memory running step"
    - "Task-level tdd=\"true\" RED/GREEN cycle scoped to the genuinely new assertions only (constants.ts removal + inverted D-10 guard), following the Phase 1 precedent of not re-deriving already-proven refusal-matrix tests in a second RED pass"

key-files:
  created:
    - controller/server/recoveryControl.ts
    - controller/test/recoveryControl.test.ts
  modified:
    - controller/server/routers/tool.ts
    - controller/components/tools/constants.ts
    - controller/test/runControl.test.ts

key-decisions:
  - "Tracer task (Task 1) implemented the full refusal order (action restriction, tracked-tool check, validateControlRequest, transport handling, audit logging) in one pass rather than splitting it across Task 1/Task 2, mirroring the Phase 1 precedent recorded in STATE.md. Task 2's RED phase was scoped to the two assertions that were genuinely new: commandFields.fast losing abort/resume, and the AddToolCommandModal lookup fallback for legacy steps."
  - "action stays z.string() at the tRPC input schema level (not restricted to RECOVERY_ACTIONS) so a Pause attempt still reaches recoveryControl's own check (a) and gets logged as a refusal, matching the existing runCommand/toolControl pattern of validating inside the handler rather than the schema."

patterns-established:
  - "Recovery-style control mutations (tool-by-id, no queue step) get their own module parallel to the queue's own control path, sharing validateControlRequest and the toolControl-style audit/transport conventions rather than being folded into the queue class."

requirements-completed: [UI-07, UI-08]

coverage:
  - id: D1
    description: "tool.recoveryControl resolves a tool by id or normalized name and sends Resume/Abort via Tool.controlCommand with no deadline, returning the toolControl-shaped result"
    requirement: "UI-07"
    verification:
      - kind: integration
        ref: "test/recoveryControl.test.ts#sends a recovery resume to an untracked tool"
        status: pass
      - kind: integration
        ref: "test/recoveryControl.test.ts#resolves the tool by normalized name"
        status: pass
      - kind: integration
        ref: "test/recoveryControl.test.ts#stays pending until the tool replies (no deadline)"
        status: pass
    human_judgment: false
  - id: D2
    description: "recoveryControl refuses Pause, undeclared actions/decisions/parameters, and any tool a running queue step is tracking — reading only queue state, never instrument state"
    requirement: "UI-08"
    verification:
      - kind: integration
        ref: "test/recoveryControl.test.ts#refuses a tool tracked by a running step"
        status: pass
      - kind: integration
        ref: "test/recoveryControl.test.ts#allows recovery while a different tool runs"
        status: pass
      - kind: integration
        ref: "test/recoveryControl.test.ts#refuses pause"
        status: pass
      - kind: integration
        ref: "test/recoveryControl.test.ts#refuses an undeclared action"
        status: pass
      - kind: integration
        ref: "test/recoveryControl.test.ts#refuses a tool type without runControl"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every recoveryControl attempt (sent, refused, tool-refused, transport-failed) writes exactly one audit log entry"
    requirement: "UI-08"
    verification:
      - kind: integration
        ref: "test/recoveryControl.test.ts#logs every refusal with toolId and outcome=refused"
        status: pass
      - kind: integration
        ref: "test/recoveryControl.test.ts#logs a tool refusal as Tool Recovery Control at warning level"
        status: pass
      - kind: integration
        ref: "test/recoveryControl.test.ts#logs a transport failure as Tool Recovery Control Failed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fast abort/resume removed from commandFields; the protocol step editor and tool-page Send Command form no longer offer them, and legacy saved steps still resolve safely"
    requirement: "UI-07"
    verification:
      - kind: unit
        ref: "test/runControl.test.ts#commandFields drops fast abort/resume (D-20)"
        status: pass
      - kind: unit
        ref: "test/runControl.test.ts#legacy saved fast abort/resume steps stay safe in the editor (D-20)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 04: Server-side crash recovery control and step-editor cleanup Summary

**`tool.recoveryControl` tRPC mutation sends audited, no-deadline Resume/Abort to an untracked F.A.S.T. by id, refusing whenever the queue's running step is on that tool; `commandFields.fast` no longer offers abort/resume.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-10-13T20:35:00Z
- **Completed:** 2026-10-13T20:38:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- New `controller/server/recoveryControl.ts`: fail-closed refusal order (restricted action → tracked-tool check → `validateControlRequest`), sends via `Tool.controlCommand` with no call options/deadline and no retry, logs exactly one audit entry per attempt ("Tool Recovery Control" / "Tool Recovery Control Refused" / "Tool Recovery Control Failed")
- New `tool.recoveryControl` tRPC mutation in `controller/server/routers/tool.ts`, resolving the tool by id/normalized name via the existing `getToolFromDB`/`Tool.forId` pattern and reading `CommandQueue.global.runningStep` for the tracked-tool check
- 17 new tests in `controller/test/recoveryControl.test.ts` proving the full behavior: end-to-end send, normalized-name lookup, no-deadline pending state, the tracked-tool/different-tool refusal split, the full refusal matrix (pause, undeclared action/parameter, blank/wrong-case decisions, tool type without runControl), unthrown tool refusals, single-attempt transport-error surfacing, and per-outcome audit logging
- `commandFields.fast` no longer declares `abort`/`resume` (D-20); `controller/test/runControl.test.ts`'s Phase 1 "commandFields untouched (D-10)" guard replaced with two tests asserting their absence and the `AddToolCommandModal` lookup's safe `[]` fallback for legacy saved steps

## Task Commits

Each task was committed atomically; Task 2 (tdd) followed a scoped RED → GREEN cycle:

1. **Task 1: End-to-end crash-recovery Resume (tracer)** - `d8635cd` (feat) — full `recoveryControl.ts`, the `tool.recoveryControl` mutation, and the complete test file (17 tests, including the Task 2 refusal-matrix tests — see Deviations)
2. **Task 2 RED: invert D-10 guard** - `7510c41` (test) — two new failing tests in `runControl.test.ts`; confirmed RED (both failed for the expected reason, 30 pre-existing tests still passed)
3. **Task 2 GREEN: drop fast abort/resume** - `d4c3c23` (feat) — removed the `abort`/`resume` entries from `commandFields.fast`; both inverted tests now pass; also carries a prettier formatting pass on `recoveryControl.test.ts`

_Note: Task 2's RED phase only drove the two assertions that were genuinely new (see Deviations) — the refusal-matrix tests for `recoveryControl` itself were already written and passing from Task 1._

## Files Created/Modified
- `controller/server/recoveryControl.ts` - `RECOVERY_ACTIONS`, `recoveryControl()` orchestration function
- `controller/server/routers/tool.ts` - `tool.recoveryControl` mutation, `CommandQueue`/`recoveryControl` imports
- `controller/test/recoveryControl.test.ts` - 17 tests covering the full behavior and refusal matrix
- `controller/components/tools/constants.ts` - removed `fast.abort`/`fast.resume` and their comments
- `controller/test/runControl.test.ts` - replaced the Phase 1 D-10 guard with the D-20 inversion

## Decisions Made
- Implemented the complete refusal order, transport handling and audit logging in Task 1 (the tracer) rather than splitting it across both tasks, following the Phase 1 precedent noted in STATE.md ("Task 1 (tracer) implemented toolControl's transport-error handling and full audit logging ahead of Task 2's planned split"). Task 2's TDD cycle was then scoped to the two assertions that were genuinely new to that task: `commandFields.fast` losing `abort`/`resume`, and the `AddToolCommandModal` fallback behavior for legacy saved steps.
- `action` stays `z.string()` at the tRPC schema level (not narrowed to `RECOVERY_ACTIONS`) so a Pause attempt still reaches `recoveryControl`'s own check (a) and is logged as a refusal, rather than being rejected silently by zod — mirrors the existing `runCommand`/`toolControl` pattern of validating inside the handler.

## Deviations from Plan

### Auto-fixed Issues

**1. [Scope clarification — not a Rule 1-4 deviation] Task 1 pre-empted Task 2's refusal-matrix RED phase**
- **Found during:** Task 2 (writing the `<behavior>` tests)
- **Issue:** The plan structures Task 1 as a tracer proving only the end-to-end Resume path, with Task 2's TDD cycle meant to drive the fail-closed refusal matrix via RED→GREEN. Because `recoveryControl.ts`'s full refusal order was already correct and complete after Task 1 (all refusal-matrix tests already passed when added), Task 2 could not produce genuine RED for those assertions — the feature already existed, per the TDD error-handling guidance ("Test doesn't fail in RED phase: feature may already exist").
- **Resolution:** Followed the exact pattern already established in this project's Phase 1 (STATE.md: "Task 1 (tracer) implemented toolControl's transport-error handling and full audit logging ahead of Task 2's planned split; Task 2's RED phase only drove the genuinely new undeclared-parameter refusal"). Task 2's RED phase was scoped to the two assertions that were genuinely new at that point: the `commandFields.fast` removal and the inverted D-10 guard. Both were confirmed RED (failing for the right reason) before the GREEN commit.
- **Files modified:** controller/test/runControl.test.ts, controller/components/tools/constants.ts
- **Verification:** `npm run test:unit -- test/runControl.test.ts` failed exactly 2 of 32 tests before the fix (RED), 0 of 32 after (GREEN); full suite (149 tests), `tsc --noEmit`, and scoped `prettier --check` all pass.
- **Committed in:** `7510c41` (RED), `d4c3c23` (GREEN)

---

**Total deviations:** 1 scope clarification (no rule-based auto-fix; both this plan's production code and tests fully satisfy every `must_haves.truths` and `must_haves.prohibitions` entry in the plan frontmatter).
**Impact on plan:** None — all tasks, acceptance criteria and the plan-level `<verification>` pass. The RED/GREEN gate commits (`test(02-04)` then `feat(02-04)`) are both present per the TDD gate-enforcement contract.

## TDD Gate Compliance

- RED commit: `7510c41` — `test(02-04): invert D-10 guard to expect fast abort/resume dropped (D-20)`
- GREEN commit: `d4c3c23` — `feat(02-04): drop fast abort/resume from commandFields; prettier pass (D-20)`
- REFACTOR commit: none needed (no cleanup required after GREEN)
- Gate sequence present and in order for Task 2. Task 1 (`type="tracer"`, not `tdd="true"`) committed directly as `feat(02-04)` per the tracer execution pattern, not the RED/GREEN cycle.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `tool.recoveryControl` is ready for plan 02-05 to wire into the tool-page UI (the hook/button work is explicitly out of scope here).
- `commandFields.fast` no longer offers `abort`/`resume`; any UI still referencing those fast commandFields keys for the step editor would need `02-05` or a follow-up to confirm no residual references exist outside what this plan already updated.
- Known limitation (per plan, D-20): legacy saved protocol steps containing fast `abort`/`resume` still execute through the normal step path if a protocol containing them is run; nothing is migrated. The tool-page Send Command form and step editor no longer offer creating new ones.

---
*Phase: 02-run-page-live-controls*
*Completed: 2026-10-13*

## Self-Check: PASSED

- `controller/server/recoveryControl.ts` exists
- `controller/test/recoveryControl.test.ts` exists
- Commits `d8635cd`, `7510c41`, `d4c3c23` all present on HEAD
- Full unit suite (149 tests), `tsc --noEmit`, and scoped `prettier --check` all exit 0
