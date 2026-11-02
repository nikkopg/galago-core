---
phase: "05"
plan: "01"
subsystem: controller-codegen
tags: [stack, codegen, ts-proto, submodule, commandFields, opr-05]
requires:
  - "galago-tools feat/stack-tool frozen stack.proto (bcbbf8e)"
  - "controller gate: tsc --noEmit + vitest + prettier"
provides:
  - "ToolType.stack generated enum member + gen-interfaces/tools/grpc_interfaces/stack.ts"
  - "commandFields.stack (9 commands, born-empty, proto order)"
  - "LATCH_READ_COMMAND = get_failure_latch (frozen oneof key)"
  - "D-07a ack-payload real-encoder wire proof + D-07b latch oneof contract test"
affects:
  - "05-02 (commandForms UI + Config + meta_data display)"
  - "05-03 (blank-optional wire pin, zToolType/operator-only activation)"
tech-stack:
  added: []
  patterns:
    - "pinned codegen: scratch-dir ts-proto 1.151.1 + explicit --plugin (never node_modules 1.153.2)"
    - "OPR-05 deliberate pin flip in the same commit as the data entry"
key-files:
  created:
    - controller/gen-interfaces/tools/grpc_interfaces/stack.ts
    - controller/test/stackActivation.test.ts
  modified:
    - .gitmodules
    - vendor/galago-tools (gitlink cb7886d → bcbbf8e)
    - controller/gen-interfaces/controller.ts
    - controller/gen-interfaces/tools/grpc_interfaces/tool_base.ts
    - controller/gen-interfaces/google/protobuf/struct.ts
    - controller/components/tools/constants.ts
    - controller/server/recoveryActions.ts
    - controller/test/staticScan.test.ts
    - controller/test/latchStatus.test.ts
    - controller/test/wire.test.ts
key-decisions:
  - "Pinned the gitlink to bcbbf8e (last interfaces/ commit, the 128bbd7 precedent) after re-verifying the four proto stop-condition facts at that exact hash; origin/feat/stack-tool tip had moved (c4f250d→477b0ed during this session) but interfaces/ has not moved past bcbbf8e"
  - "Regenerated with the spike-proven recipe: venv grpcio-tools 1.85.1 + scratch-dir ts-proto 1.151.1 via explicit --plugin=, bin/make proto_ts's four opts verbatim; never the local node_modules 1.153.2"
  - "Left the D-08 cast retrofits (\"stack\" as ToolType) untouched — this plan's scope is codegen + data layer; casts go with 05-02/05-03"
  - "google/protobuf/struct.ts regenerated comment-only churn accepted (newer protoc's well-known-type docs) — generated output, never hand-edited"
requirements-completed: [GEN-01]
duration: 7 min
completed: 2026-11-02
status: complete
actuals:
  tokens: 24000
  tasks: 3
  commits: 2
  plan_head_before: fb7711ebaad093be00b7293ca33e209d4a8084f3
  plan_head_after: 95291872f3bdb8499c4852f565a7b34133352bc9
coverage:
  - deliverable: "GEN-01: submodule at bcbbf8e + pinned 1.151.1 regen + gates green"
    human_judgment: false
    verification:
      - kind: command
        ref: "git -C vendor/galago-tools rev-parse HEAD | grep -q '^bcbbf8e' (passed)"
        status: pass
      - kind: command
        ref: "cd controller && npx tsc --noEmit (0 errors, passed after regen and again at plan close)"
        status: pass
      - kind: command
        ref: "cd controller && npx vitest run — 573/573 green, 25 files (passed after regen and again at plan close)"
        status: pass
      - kind: command
        ref: "cd controller && npx prettier . --check (clean, passed twice)"
        status: pass
  - deliverable: "commandFields.stack: 9 commands in proto declaration order, ack excluded, born-empty (D-03)"
    human_judgment: false
    verification:
      - kind: command
        ref: "runtime node check: 9 keys [transfer, get_manager_state, get_robot_states, list_devices, list_labware_profiles, list_transfer_profiles, get_labware_presence, get_transfer_estimate, get_failure_latch], ack absent, 26 fields, 0 defaultValue, 0 select"
        status: pass
      - kind: tests
        ref: "test/staticScan.test.ts#commandFields pins the stack tool and never an acknowledge entry"
        status: pass
  - deliverable: "OPR-05 invariants intact after the deliberate flip: ack literal still in exactly its 4 carrier files"
    human_judgment: false
    verification:
      - kind: tests
        ref: "test/staticScan.test.ts#the acknowledge_failure literal lives in exactly its four pinned files (unmodified, passed)"
        status: pass
  - deliverable: "D-07b: LATCH_READ_COMMAND pinned to the generated stack.Command oneof on the real encoder"
    human_judgment: false
    verification:
      - kind: tests
        ref: "test/stackActivation.test.ts#LATCH_READ_COMMAND is the frozen stack.proto oneof key"
        status: pass
      - kind: tests
        ref: "test/stackActivation.test.ts#the latch-read payload encodes the LATCH_READ_COMMAND oneof branch on the real tool_base.Command"
        status: pass
      - kind: tests
        ref: "test/latchStatus.test.ts — 21/21 green with the renamed constant and the no-zToolType source scan untouched"
        status: pass
  - deliverable: "D-07a: acknowledge payload round-trips the real generated encoder with guid + arm_inspected intact"
    human_judgment: false
    verification:
      - kind: tests
        ref: "test/wire.test.ts#encodes the acknowledge payload into the stack Command oneof"
        status: pass
  - deliverable: "D-05 stop condition (Config.create defaults exist in the generated stack module) — config UI needs zero code"
    human_judgment: false
    verification:
      - kind: command
        ref: "grep createBaseConfig controller/gen-interfaces/tools/grpc_interfaces/stack.ts → { host: \"\", port: 0, transfer_timeout_s: 0, ledger_dir: \"\" }"
        status: pass
---

# Phase 5 Plan 01: STACK Codegen & Command Forms — Foundation Summary

**Submodule pinned to the frozen stack.proto commit `bcbbf8e` and regenerated with the pinned ts-proto 1.151.1 plugin; `commandFields.stack` covers 9 commands born-empty in proto order, the OPR-05 scan flipped positive in the same commit, `LATCH_READ_COMMAND` renamed to the frozen `get_failure_latch` oneof key, and the acknowledge payload proven on the real generated encoder.**

## Accomplishments

- **D-01 gate verified (Task 1, read-only):** fetched `feat/stack-tool` in the submodule; `interfaces/` last commit is exactly `bcbbf8e`; at that hash stack.proto declares `optional string guid = 1`, `optional string arm_inspected = 2`, oneof key `get_failure_latch = 10`; controller.proto declares `stack = 24`; tool_base.proto has the stack Command (=24) and Config (=43) oneof branches. Pinned toolchain provisioned in /tmp: grpcio-tools 1.85.1 venv + scratch-dir ts-proto **1.151.1** plugin (executable). No repo file touched.
- **Submodule bump + pinned regen (Task 2, tracer — commit `3c860fa`):** gitlink `cb7886d` → `bcbbf8e` (detached-HEAD checkout inside the submodule); `.gitmodules` branch `feat/fast-tool` → `feat/stack-tool` (URL+branch only, `128bbd7` precedent); regenerated all protos with the venv python and an explicit `--plugin=` to the 1.151.1 scratch-dir binary using exactly `bin/make proto_ts`'s four opts. Churn: NEW `stack.ts` (Command oneof ×10, `Config.create()` → `{ host: "", port: 0, transfer_timeout_s: 0, ledger_dir: "" }`), `controller.ts` gains `stack = "stack"` in `export enum ToolType`, `tool_base.ts` gains the stack Command/Config oneof branches, plus comment-only churn in `google/protobuf/struct.ts` (newer protoc's well-known-type docs). Gates run directly (not `bin/make test` — Pitfall 7): tsc 0 errors, vitest 570/570, prettier clean — green BEFORE the commandFields entry existed, as predicted.
- **Data layer + flips + proofs (Task 3 — commit `9529187`):** `commandFields.stack` inserted after `fast` — exactly the 9 non-operator commands in proto oneof declaration order (transfer: 11 text + `timeout_s` number; `get_manager_state`/`get_robot_states`/`get_failure_latch` empty; three `list_*` with one boolean; `get_labware_presence` one text; `get_transfer_estimate` 10 text), every field `{ name, type }` with no `defaultValue` and no `select`; the operator-only command name appears nowhere in the file (not even a comment). `staticScan.test.ts` scan flipped in the SAME commit: ack-absence assertion byte-identical, closed 4-file carrier list untouched, stack-key assertion now positive (`expect(keys).toContain("stack")`), test retitled. `LATCH_READ_COMMAND` → `"get_failure_latch"` with the stale PLACEHOLDER comment refreshed; `latchStatus.test.ts` command-name assertions updated, toolId-only derivation and the no-zToolType source scan untouched (D-08). New `test/stackActivation.test.ts` (D-07b) pins the constant and round-trips its payload through the real `tool_base.Command` encoder (an unknown oneof key would decode absent). `wire.test.ts` (D-07a) proves `{ stack: { acknowledge_failure: { guid: "task-guid", arm_inspected: "yes" } } }` survives the real encoder with both fields intact; afterEach cleans up the new fake.

## Verification

Plan-level `<verification>` at plan close:
- `cd controller && npx tsc --noEmit` — **0 errors**
- `cd controller && npx vitest run` — **573/573 passed, 25 files** (baseline was 570/24; +3 tests: 2 stackActivation + 1 wire)
- `cd controller && npx prettier . --check` — **clean**
- `git -C vendor/galago-tools rev-parse HEAD` — **starts with bcbbf8e**
- Runtime shape check of `commandFields.stack`: 9 keys, ack absent, 26 fields, 0 `defaultValue`, 0 `select`

No STACK or F.A.S.T. motion from tests — FakeGrpc/`installFakeTool` fakes only. Nothing pushed.

## Deviations from Plan

**1. [Rule 3 - Blocker] git 2.34 `git add` exits 1 for tracked files under the gitignored `controller/gen-interfaces/` directory**
- **Found during:** Task 2 commit
- **Issue:** `git add controller/gen-interfaces/<file>` stages the tracked file but exits 1 with "paths are ignored" advice (the directory is gitignored at `.gitignore:14`), silently breaking `&&` chains; the first Task 2 commit landed with only 3 of 6 files.
- **Fix:** staged the generated files with `git add -f` (exits 0; exactly how the `128bbd7` precedent tracks sibling generated modules past the directory gitignore) and amended the commit. Verified: no deletions, all 6 files present.
- **Files modified:** commit `3c860fa` (amended to full content)
- **Verification:** `git show --stat` shows all 6 files; gates re-run green afterwards
- **Commit:** 3c860fa

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** none on content — process-only (git plumbing quirk); the commit content matches the plan exactly.

Note (not a deviation): `origin/feat/stack-tool` tip moved during execution (`c4f250d`→`477b0ed` since the research session); the D-01 gate held — `interfaces/` last commit remains `bcbbf8e` at fetch time.

## Authentication Gates

None.

## Known Stubs

None.

## Issues Encountered

None beyond the deviation above.

## Next Phase Readiness

Ready for 05-02 (commandForms UI + Config editing + meta_data display): `ToolType.stack` is a real enum member, `zToolType` auto-accepts `"stack"`, `getToolConfigDefinition("stack")` resolves via the generated `Config.create({})`, and the "Invalid Tool Type" banner clears the moment 05-02's UI work lands. D-08 cast retrofits (`"stack" as ToolType` → `ToolType.stack` in operatorOnly/latchStatus/recoveryControl tests) remain for the later plans as planned.

## Self-Check: PASSED

- Files: all 10 key-files exist on disk (`stack.ts`, `stackActivation.test.ts` created; 8 modified) — checked with `[ -f ]`
- Commits: `3c860fa` and `9529187` are ancestors of HEAD (`git merge-base --is-ancestor` — both FOUND)
- Measured commits `fb7711e..HEAD`: 2 (matches frontmatter)
