---
phase: 06-stack-dropdowns
plan: 05
subsystem: ui
tags: [react, chakra, stack, dropdowns, cascade, protocol-editor, variables]
status: complete

requires:
  - phase: 06-stack-dropdowns
    provides: "06-03 lookupFieldBinding / applyChange / firstFieldForSource / buildFieldView; 06-04 final OptionsSelect props and useToolOptions refresh"
provides:
  - "AddToolCommandModal: every bound STACK field renders OptionsSelect in place of the typed input, next to the unchanged 180px variable picker; enabled while the modal is open"
  - "CommandDetailsDrawer: bound saved params render OptionsSelect only while isEditing (enabled={isEditing}); the read-only drawer is unchanged"
  - "staticScan 'protocol host invariants (D-14, D-15, D-17)' block (5 cases)"
affects: [phase-06-verification, phase-06-uat]

actuals:
  tokens: 2400
  tasks: 3
  commits: 3
plan_head_before: 2c2d642aa3c4fdb8fb0ba6ff81a0b3a3ce3aa373
plan_head_after: 9ab90b176a32bb20958a96c569f8f7035045973d

tech-stack:
  added: []
  patterns:
    - "Protocol hosts write the operator's choice through a functional setState that merges applyChange(binding, v) in one update, the same as the tool page"
    - "Drawer binding lookup is gated on isEditing, so the read-only path never reaches OptionsSelect"

key-files:
  created: []
  modified:
    - controller/components/protocols/AddToolCommandModal.tsx
    - controller/components/protocols/CommandDetailsDrawer.tsx
    - controller/test/staticScan.test.ts

key-decisions:
  - "Both protocol hosts use a functional update (setCommandParams / setEditedParams with prev => ({ ...prev, ...applyChange(...) })) rather than spreading the closure's state. It is still one call, and it cannot read a stale closure"
  - "The drawer's showRefresh uses the saved params' key order (Object.keys of commandInfo.params), because the drawer iterates saved keys, not commandFields"
  - "The production build gate ran on a byte-identical copy of controller/ in the session scratchpad, because controller/.next is root-owned and the build cannot write its cache there"

requirements-completed: [DRP-03, DRP-08, DRP-09, STK-01, STK-02, STK-05, STK-06, STK-07]

coverage:
  - id: H1
    description: "Exactly AddToolCommandModal, CommandDetailsDrawer and pages/tools/[id].tsx render OptionsSelect"
    requirement: DRP-08
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#protocol host invariants (D-14, D-15, D-17) > exactly the three hosts render OptionsSelect"
        status: pass
  - id: H2
    description: "The drawer passes enabled={isEditing} and routes bound params through lookupFieldBinding and applyChange"
    requirement: DRP-08
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#protocol host invariants (D-14, D-15, D-17) > the drawer reads lists only while editing and writes through applyChange"
        status: pass
  - id: H3
    description: "The modal keeps handleVariableSelect(field.name …) beside the dropdown and routes bound fields through lookupFieldBinding and applyChange"
    requirement: DRP-03
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#protocol host invariants (D-14, D-15, D-17) > the modal keeps the variable picker and writes through applyChange"
        status: pass
  - id: H4
    description: "The modal's handleSubmit keeps the 0 / false / [] / \"\" fill-ins, and the drawer's handleSaveInputs still spreads the saved params before editedParams. Neither references OptionsSelect, applyChange or tool options"
    requirement: DRP-09
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#protocol host invariants (D-14, D-15, D-17) (handleSubmit / handleSaveInputs cases)"
        status: pass
  - id: H5
    description: "Rendered modal and drawer against a live or PAC-simulated STACK: dropdowns beside No Variable, a bound variable shows {{name}} disabled, a bound parent turns children into typed inputs with the hint, a deck change blanks only the nest, a not-reported saved nest saves unchanged, a long ambiguous name is readable or clipped, and the run-page drawer makes no tool.options request"
    requirement: DRP-08
    verification:
      - kind: manual
        ref: "06-05 Task 2 human-check (end-of-phase UAT)"
        status: pending
    human_judgment: true
    rationale: "Vitest runs in node without React rendering, and live lists and network traffic need a configured instrument and a browser."

duration: 4min
completed: 2026-11-06
---

# Phase 6 Plan 05: Protocol hosts and phase gate Summary

**The STACK instrument dropdowns now appear in the protocol editor too. In AddToolCommandModal each bound field shows OptionsSelect next to the unchanged "No Variable" picker. CommandDetailsDrawer shows the same control only in edit mode (`enabled={isEditing}`). The run page's read-only drawer mounts no control and sends no reads. Cascade clears are written in a single `applyChange` update, and nothing on the submit or save path changed. The full phase gate passes.**

## Performance

- **Duration:** about 4 min (2026-11-06T02:35Z to 02:39Z)
- **Tasks:** 3 of 3
- **Files:** 3 modified

## Accomplishments

- **AddToolCommandModal** (`renderField`):
  - `lookupFieldBinding(selectedToolType, selectedCommand, field.name)` runs before the labware branch. When it finds a binding, the field renders as `HStack width="100%" alignItems="flex-start"` with two children:
    - **Left:** `OptionsSelect` (`toolId=selectedToolData?.name`, `enabled={isOpen}`, `allowVariables`). `showRefresh` is on only for the first field of each source, found with `firstFieldForSource`.
    - **Right:** the existing 180px variable `Select`, copied unchanged.
  - `handleOptionSelect` runs `setCommandParams(prev => ({ ...prev, ...applyChange(binding, v) }))`.
  - Unchanged: `handleSubmit`, `handleVariableSelect`, `isVariableReference`, the reset effect, the FormLabel variable Badge and every unbound or non-STACK field.
- **CommandDetailsDrawer** (`renderParameterInput`):
  - The binding lookup (`commandInfo.toolType`, `commandInfo.command`, the param key) runs only when `isEditing`.
  - A bound param renders `OptionsSelect` with:
    - `toolId=commandInfo.toolId`
    - `value=currentValue`
    - `values={ ...saved, ...editedParams }`
    - `enabled={isEditing}`
    - `allowVariables`
    - `showRefresh` taken from the saved keys' order
  - Next to it sits the existing variable `Select` (guarded by `isEditing`), copied unchanged.
  - `handleOptionSelect` merges the `applyChange` patch into `editedParams`, so a cleared child is stored as `""` and never deleted.
  - Unchanged: the read-only path, `handleSaveInputs`, the reset effect and `handleVariableSelect`.
- **staticScan:** new block `protocol host invariants (D-14, D-15, D-17)` with 5 cases. Every earlier case is unedited.

## Task Commits

1. **Task 1: Modal renders OptionsSelect for bound STACK fields:** `01caa8e` (feat)
2. **Task 2: Drawer renders the dropdowns only while editing:** `a098dc1` (feat)
3. **Task 3: Host invariants scan and phase gate:** `9ab90b1` (test)

## Phase Gate Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | 32 files, 755 tests passed |
| `npx prettier . --check` | All matched files use Prettier code style |
| `npx next lint --no-cache --quiet` | No ESLint warnings or errors |
| `npm run build` | exit 0 on a byte-identical copy of `controller/` (see Deviations); lint, type check and compile all passed |
| STK-08 pin check | exit 0: submodule HEAD and committed gitlink both `4ccd3da656c0e981332018b3d33e16148a8bc513`, no `controller/gen-interfaces` diff |

## Pins Checked

- `git log 2505ceb..HEAD` is empty for `controller/test/toolPageReply.test.ts`, `controller/components/tools/constants.ts` (`commandFields.stack` is byte-identical) and `controller/components/runs/list/SwimLaneComponent.tsx` (the run-page embed did not change).
- No modified file contains `acknowledge_failure`. The `.controlCommand(` caller count, the latchStatus slice, D-17 and the dropdown-invariant blocks all pass in the full run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Production build run outside the root-owned `.next`**
- **Found during:** Task 3 (phase gate)
- **Issue:** `controller/.next` and `controller/.next/cache` are owned by `root`, left over from an earlier Docker build. Running `npm run build` in place failed with `EACCES` when writing `.next/cache/.tsbuildinfo` and `.next/cache/eslint`. This is a filesystem permission problem, not a code error.
- **Fix:** Copied `controller/` (without `node_modules` and `.next`) into the session scratchpad, symlinked `node_modules`, and ran `npm run build` there: exit 0. `diff -rq` showed the copy matched the working tree. `controller/.next` was not touched, and nothing was chowned or deleted.
- **Follow-up for the user:** to run the build in place, fix the ownership with `sudo chown -R $USER controller/.next` or remove that directory.
- **Commit:** none (no source change)

### Additions within the plan's latitude

- Both hosts use a functional state update for the `applyChange` merge. It is still one call per change, and it also prevents a stale closure.

## Known Stubs

None.

## Threat Flags

None. The register's mitigations are in place:
- **T-06-15:** the drawer looks up the binding only when `isEditing`, passes `enabled={isEditing}`, and a scan pins this.
- **T-06-16:** only one `applyChange` patch is written per operator change, cleared children are written as `""`, and the submit and merge bodies are scan-pinned.
- **T-06-SC:** no package was installed.

## Human Check (end-of-phase UAT)

This needs a live or PAC-simulated STACK. In a protocol, add a STACK `transfer` step through the modal and pick every bound field. Bind `robot` to a variable, then bind `source_device` to one, and save. Open the step in the editor drawer with editing on, change the source deck, and save. Reopen a step whose saved nest the STACK no longer reports and save without changes. Then open a step drawer on the run page and watch the network panel. Expect:

- Dropdowns appear beside "No Variable".
- The bound robot shows `{{name}}` with its picker disabled.
- While `source_device` is bound, source deck and nest are text inputs with "child list unavailable while the parent is a variable".
- Changing the deck blanks only the nest.
- The unreported nest shows "(not reported by instrument)" and saves unchanged.
- A 60-character ambiguous name stays readable or is cleanly clipped in the modal row.
- The run-page drawer shows the old disabled inputs and makes no `tool.options` request.

## Self-Check: PASSED

- FOUND: controller/components/protocols/AddToolCommandModal.tsx, controller/components/protocols/CommandDetailsDrawer.tsx, controller/test/staticScan.test.ts
- FOUND (ancestors of HEAD): 01caa8e, a098dc1, 9ab90b1
- `git rev-list --count 2c2d642..9ab90b1` = 3
