# Phase 5: STACK Codegen & Command Forms - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-30
**Phase:** 5-STACK Codegen & Command Forms
**Mode:** `--auto` (no interactive prompts; every selection is the recommended option, logged for audit)
**Areas discussed:** Gated start handling, Codegen mechanics (GEN-01), commandFields.stack mapping
(GEN-02), Optional/unfilled fields (GEN-02), Tool Config host/port (GEN-02), meta_data reply display
(GEN-03), Activation tests + retrofit posture (GEN-04)

---

## Gated start handling

| Option | Description | Selected |
|--------|-------------|----------|
| Plan now, verify gate at execution start | First plan's first task verifies the submodule is at the frozen `stack.proto` commit; stops cleanly with a user note if not | ✓ |
| Wait entirely | Do nothing until galago-tools Phase 4 pushes the frozen proto | |

**User's choice:** [auto] Plan now, verify gate at execution start (recommended default)
**Notes:** Gate verified open on 2026-10-30 — `vendor/galago-tools` has no `stack.proto`. Roadmap stop
conditions (renamed `guid`/`arm_inspected`, no latch-read command, STK-07 break) recorded in D-01.

## Codegen mechanics (GEN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| `bin/make proto_ts` with ts-proto pinned 1.151.1 | Existing script already sets snakeToCamel=false, stringEnums=true; gate green after regen | ✓ |
| New regen script | A dedicated script for the pinned regen | |

**User's choice:** [auto] `bin/make proto_ts` with pinned ts-proto 1.151.1 (recommended default)
**Notes:** Pinning mechanism left to the planner; local 1.153.2 generates a broken `tool_base.ts`
(PROJECT.md Context).

## commandFields.stack mapping (GEN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| No defaults anywhere, no `select`, text for required strings | Mirrors "no select pre-fills"; `scan_tips` `defaultValue: false` anti-template called out | ✓ |
| Copy fast patterns incl. defaultValue/select | Reuse F.A.S.T. conveniences | |

**User's choice:** [auto] No defaults anywhere, no `select`, text for required strings (recommended default)
**Notes:** Static scans (OPR-05) pin `acknowledge_failure`'s absence from `commandFields` — the STACK
entry never lists it.

## Optional/unfilled fields (GEN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Wire test pins blank-optional behaviour | Omit-vs-zero-value is the planner's call (proto3 wire equivalence); pinned by an optional-left-blank wire-test case | ✓ |
| Decide now without wire evidence | Fix omit-vs-zero in the context | |

**User's choice:** [auto] Wire test pins blank-optional behaviour (recommended default)
**Notes:** Nothing is ever pre-filled; the payload sends what the operator typed.

## Tool Config host/port (GEN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Existing config editor path | `ToolConfigEditor`/`EditToolConfig` driven by `getToolConfigDefinition("stack")` from the generated module | ✓ |
| Custom STACK config UI | Hand-rolled config form for STACK | |

**User's choice:** [auto] Existing config editor path (recommended default)
**Notes:** A missing generated config definition is a galago-tools gap — stop and note, never
hand-roll here.

## meta_data reply display (GEN-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded raw-JSON collapsible | `LatchRawJson` pattern from Phase 4: bounded height, monospace, unknown-shape tolerant, read-only | ✓ |
| Formatted key-value table | Structured rendering of meta_data keys | |

**User's choice:** [auto] Bounded raw-JSON collapsible (recommended default)
**Notes:** Reuse or extract the existing bounded display rather than writing a second one.

## Activation tests + retrofit posture (GEN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal mechanical retrofit, keep Phase 4 structure | Cast-only conversion to real `ToolType.stack`; `latchStatus` toolId-only derivation untouched; activation tests per research §5 item 3 | ✓ |
| Full retrofit of Phase 4 query derivations to the enum | Rewire `latchStatus` etc. to the new enum | |

**User's choice:** [auto] Minimal mechanical retrofit, keep Phase 4 structure (recommended default)
**Notes:** Activation test list: wire encode/decode of the ack payload; `LATCH_READ_COMMAND` ∈
generated `stack.Command` oneof; `commandFields.stack` includes latch read, excludes
`acknowledge_failure`; `zToolType` accepts `"stack"` + row creation; operator-only refusal on real
`ToolType.stack`. Fakes only.

## the agent's Discretion

- Bounded-JSON display extraction/sharing and its copy/labels.
- ts-proto 1.151.1 pinning mechanism.
- Plan split (suggested: submodule bump + regen tracer; commandFields + Config; meta_data display;
  activation tests).
- Whether the blank-optional wire case is inline or a table row.

## Deferred Ideas

- Persistent tool-page command error toast (carried from Phase 4; quick-task candidate).
- F.A.S.T. plate-list dropdowns / `expected_tray_id` (pending todos, Future Requirements).
- `commandQueue.runningStep` query to gray the recovery card during a STACK step.
- Banner link to `/tools/<toolId>` on a STACK failure.
- `protocol.preview` early operator-only-refusal feedback.

## Auto-mode log (todos)

`cross_reference_todos`: both pending todos matched with score 0.9 (keyword-only). The auto rule
(fold ≥ 0.4) was overridden by standing prior decisions — Phases 3 and 4 each reviewed both todos and
rejected folding as keyword-only matches (F.A.S.T. UI features unrelated to STACK codegen);
anti-pattern rule 11 (no re-litigating locked decisions). Logged as Reviewed Todos (not folded).
