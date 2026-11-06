---
phase: 06-stack-dropdowns
verified: 2026-11-06T10:00:00Z
status: human_needed
score: 17/17 must-haves verified
covered_files:
  - .planning/phases/06-stack-dropdowns/06-01-PLAN.md
  - .planning/phases/06-stack-dropdowns/06-01-SUMMARY.md
  - .planning/phases/06-stack-dropdowns/06-02-PLAN.md
  - .planning/phases/06-stack-dropdowns/06-02-SUMMARY.md
  - .planning/phases/06-stack-dropdowns/06-03-PLAN.md
  - .planning/phases/06-stack-dropdowns/06-03-SUMMARY.md
  - .planning/phases/06-stack-dropdowns/06-04-PLAN.md
  - .planning/phases/06-stack-dropdowns/06-04-SUMMARY.md
  - .planning/phases/06-stack-dropdowns/06-05-PLAN.md
  - .planning/phases/06-stack-dropdowns/06-05-SUMMARY.md
  - controller/components/protocols/AddToolCommandModal.tsx
  - controller/components/protocols/CommandDetailsDrawer.tsx
  - controller/components/tools/OptionsSelect.tsx
  - controller/components/tools/fieldOptions.ts
  - controller/hooks/useToolOptions.ts
  - controller/pages/tools/[id].tsx
  - controller/server/routers/tool.ts
  - controller/server/toolOptions.ts
  - controller/server/tools.ts
  - controller/test/fieldOptions.test.ts
  - controller/test/staticScan.test.ts
  - controller/test/toolOptions.parse.test.ts
  - controller/test/toolOptions.read.test.ts
  - controller/test/toolOptionsRouter.test.ts
  - controller/test/wire.test.ts
covered_digest: "v3:sha256:04bfea384580376fef36ce4738967245adba724d75a7b374799876785c123293"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the STACK tool page, AddToolCommandModal and the drawer in edit mode against a live or PAC-simulated STACK. In transfer, get_transfer_estimate and get_labware_presence, pick a value in every bound field (robot, labware_profile, source/destination device, deck, nest, transfer profiles)."
    expected: "Every dropdown starts empty with nothing preselected. Deck and nest stay disabled until their parent is chosen. Refresh keeps every selection and updates the 'from instrument - N items - fetched hh:mm:ss' line. An ambiguous location shows '(ambiguous - adapter will refuse)' and stays selectable. A saved value the STACK does not report shows '(not reported by instrument)'."
    why_human: "Vitest runs without jsdom and cannot render React. A simulated STACK also returns no meta_data (06-VALIDATION.md Manual-Only)."
  - test: "Stop the STACK tool server, then open each of the three hosts."
    expected: "Every bound field shows a typed input with the hint 'Instrument list unavailable - type the value'. No stale list appears, and the form is never blocked."
    why_human: "The UI fallback needs the rendered UI (06-VALIDATION.md Manual-Only)."
  - test: "In the protocol editor, bind a cascade parent (for example source_device) to a {{variable}}, then check its deck and nest. Open a saved step in the run-page drawer read-only and watch the network."
    expected: "The picker is disabled and shows the variable. Deck and nest become typed inputs with the hint 'child list unavailable while the parent is a variable'. The read-only drawer sends no tool.options request."
    why_human: "Rendered state and network behaviour. Only the pure view model and the static scans are covered by tests."
---

# Phase 6: STACK Dropdowns Verification Report

**Phase Goal:** The operator fills the STACK `transfer`, `get_transfer_estimate` and `get_labware_presence` forms by picking values the STACK reports, and the shared dropdown layer is ready for Phase 7.
**Verified:** 2026-11-06
**Status:** human_needed
**Re-verification:** No, initial verification

All code-level must-haves are met. Rendered behaviour against a live STACK has not been checked, and two non-blocking warnings from 06-REVIEW.md are open.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria plus requirements)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | The three STACK forms offer instrument-reported dropdowns that start empty and preselect nothing | VERIFIED (render deferred to UAT) | `FIELD_BINDINGS.stack` binds transfer, get_transfer_estimate and get_labware_presence (`fieldOptions.ts:75-90`). `buildSelectView` always emits an explicit empty option and never picks one, even for a single option. The tool page resets `formValues` to `""`. No `defaultValue` or `select` was added to `commandFields` (`constants.ts` has no diff since the plan baseline). |
| SC2 | An unreachable instrument, or a saved value no longer reported, never blocks or rewrites a step | VERIFIED | `fetchOptions` never throws and maps every failure to `unavailable` (`toolOptions.ts:540-580`). The UI falls back to a typed input. Saved values are kept with the "(not reported by instrument)" flag. A hydrate-then-refresh test confirms children are unchanged. |
| SC3 | What is sent is unchanged, with vendor/galago-tools pinned to `4ccd3da` and no regen diff | VERIFIED | The submodule HEAD is `4ccd3da656c0e981332018b3d33e16148a8bc513`. The diff of `gen-interfaces` across the phase is empty; only the vendor pointer changed. No submit path changed: `handleSubmit` and `handleSaveInputs` are untouched, and `wire.test.ts` pins that chosen and typed params are equal. |

**Score:** 17/17 requirement truths verified, 0 present but behaviour-unverified.

### Requirements Coverage

Plan frontmatter declares: 06-01 [STK-08, DRP-01, DRP-04, DRP-07, STK-01, STK-05, STK-06]; 06-02 [DRP-04, DRP-06, DRP-07]; 06-03 [DRP-01, DRP-02, DRP-03, DRP-05, DRP-09, STK-02, STK-03, STK-04, STK-07]; 06-04 [DRP-01, DRP-02, DRP-04, DRP-05, DRP-06, STK-02, STK-03, STK-04, STK-07]; 06-05 [DRP-03, DRP-08, DRP-09, STK-01, STK-02, STK-05, STK-06, STK-07]. The union covers all 17 IDs in ROADMAP Phase 6 and REQUIREMENTS.md. There are no orphaned requirements.

| Requirement | Status | Evidence |
|-------------|--------|----------|
| DRP-01 empty, nothing preselected | SATISFIED | `buildSelectView` ok branch starts on the empty option. `OptionsSelect` has no effect hook and no code that selects an option. Static scans pin this. |
| DRP-02 saved value kept, flagged | SATISFIED | Non-blank values not offered get a `not-reported` option and stay selected. Blank values show no flag. Tests cover the uncalibrated deck case. |
| DRP-03 `{{var}}` binding, bound parent gives typed children | SATISFIED (see WR-02) | `variable-bound` and `child-of-variable` modes are in `buildSelectView`. Modal and drawer pass `allowVariables={true}`. The tool page passes false. |
| DRP-04 failures give typed input with hint, no stale list | SATISFIED | `deriveOptionsMode` checks `isError` first. Failures evict the cache. Hook uses `retry:false`. Disabled queries read as unavailable. See WR-01 for typed-input behaviour. |
| DRP-05 children clear only on the parent's onChange | SATISFIED (see WR-01) | `applyChange` is the only patch producer. There is no `useEffect` in `OptionsSelect`, `useToolOptions` or `fieldOptions`. A hydrate-and-refresh test leaves children unchanged. |
| DRP-06 Refresh sends `refresh:true`, keeps selection | SATISFIED | `useToolOptions.refresh` fetches with `refresh:true` and writes the shared entry. `acceptsRefresh` is false for `get_robot_states`. A 2 s minimum interval protects the manager. |
| DRP-07 closed registry, deadline, caps, no queue, `{{x}}` names dropped | SATISFIED | Four-entry `OPTION_SOURCES`. Router input is `.strict()` with source enum only. `Tool.readOptions` has a 5 s deadline and is called only from `toolOptions.ts` (static scan). Caps are 256/1000/10000. `isUsableName` drops `{{x}}`. Note: the requirement text says `Tool.executeCommand`, but locked decision D-01 chose a dedicated `readOptions`, and the scans pin it. |
| DRP-08 drawer dropdowns, reads only in edit mode | SATISFIED | The binding is looked up only when `isEditing`. `enabled={isEditing}`. A static scan asserts the drawer reads only while editing. |
| DRP-09 sent values unchanged | SATISFIED | Values are plain strings. A round-trip test and `wire.test.ts` confirm identical params. No submit path was modified. |
| STK-01 robot | SATISFIED | `stack.robots` parses `robotStates` / `robotName`. Bound in all three commands. |
| STK-02 device/deck/nest cascades by plain names | SATISFIED | `buildCascadeOptions` builds by position from `stack.devices`. Values are plain names, never `unifiedName`. Source and destination are separate. |
| STK-03 calibrated only | SATISFIED | Decks and nests with `isCalibrated !== true` are skipped. A saved uncalibrated value is kept and flagged. |
| STK-04 ambiguous flagged, not hidden | SATISFIED | Flag by exact path membership; the option stays selectable. Golden fixtures cover duplicates and names containing `/`. |
| STK-05 labware_profile | SATISFIED | `stack.labwareProfiles` bound to `labware_profile`. |
| STK-06 transfer profiles | SATISFIED | `stack.transferProfiles` bound to source and destination profile fields. |
| STK-07 coverage; step_key and timeout_s typed | SATISFIED | A coverage test asserts that `step_key`, `timeout_s`, `refresh` and every `list_*` / `get_*` tool-page field stay typed. `get_labware_presence` binds only `robot`. |
| STK-08 pin and no regen diff | SATISFIED | Submodule at `4ccd3da`; empty `gen-interfaces` diff. The orchestrator reports the SHA is reachable at `origin feat/stack-tool`. |

### Required Artifacts and Wiring

| Artifact | Status | Details |
|----------|--------|---------|
| `controller/server/toolOptions.ts` | VERIFIED | 580 lines: parsers, caps, TTL cache, in-flight dedupe, generation invalidation, throttled logging. Called by the router. |
| `controller/server/tools.ts` `readOptions` | VERIFIED | Direct gRPC call with deadline. Only caller is `toolOptions.ts`. |
| `controller/server/routers/tool.ts` `options` | VERIFIED | `bumpGeneration` is called on configure, edit, delete and `clearToolStore`. |
| `controller/components/tools/fieldOptions.ts` | VERIFIED | React-free binding map, cascade builders, `applyChange`, view model. |
| `controller/components/tools/OptionsSelect.tsx` | VERIFIED | Imported by all three hosts. |
| `controller/hooks/useToolOptions.ts` | VERIFIED | Wired to `trpc.tool.options`. |
| Three hosts (`[id].tsx`, `AddToolCommandModal.tsx`, `CommandDetailsDrawer.tsx`) | VERIFIED | Each calls `lookupFieldBinding`, renders `OptionsSelect` and writes through `applyChange`. |

Data flow: the chain runs from the STACK reply through `Tool.readOptions` to `parse*` and `fetchOptions`, then the tRPC `tool.options` query, `useToolOptions`, `buildFieldView` and the control. The data is real, not static.

### Behavioral Spot-Checks and Test Runs

| Check | Result | Status |
|-------|--------|--------|
| `cd controller && npx tsc --noEmit` | exit 0 | PASS |
| Quick run: parse, read, router, fieldOptions, staticScan, commandFields and wire tests | 7 files, 200 tests passed | PASS |
| Full suite (run by the orchestrator at HEAD 52f7029) | 32 files, 755 tests passed | PASS (not re-run here) |
| `npm run build` | EACCES: `controller/.next` is root-owned. 06-05 reports a pass on a scratch copy | Environment issue, not a code gap |

Probe execution: no probes declared by the phase. Skipped.

### Anti-Patterns Found

No `TBD`, `FIXME` or `XXX` markers were added by the phase's source diffs. No stubs were found.

### Review Warnings (06-REVIEW.md), judged against requirements

Neither warning defeats a requirement. Both are real defects and should be fixed.

| ID | Judgement |
|----|-----------|
| WR-01 typed fallback runs `applyChange` on every keystroke | Does not defeat DRP-04, DRP-05 or DRP-09. DRP-05 says changing a parent clears its children, and a loaded or refreshed list never clears anything, which holds. The cleared fields show as blank, so it is not silent. But editing a hydrated device name while the STACK is unavailable wipes the saved deck and nest, which is poor behaviour. The fix is a separate `onType` write for the typed branch. |
| WR-02 drawer "No Variable" on a cascade field deletes the key | Does not defeat DRP-03: binding works, and unbinding a draft binding falls back to the saved value. Edge case: a mismatched device/deck/nest triple, or a saved `{{v}}` that cannot be unbound. This was already a limitation of the old input. The fix is to write `""` and clear the children. |
| IN-01 to IN-04 | Informational and do not affect any requirement. IN-03 (unbounded `ambiguous` strings) is bounded by the 10k-entry cap and gRPC's 4 MB limit. |

### Human Verification Required

See the frontmatter for the three items: live render of the dropdowns in all three hosts, the offline fallback, and the variable-bound and read-only drawer behaviour.

### Gaps Summary

No code gaps block the phase goal. All 17 requirements have implementation and test evidence, and the pin and regen gate holds. Status is `human_needed` because rendered UI against a live or simulated STACK is only checkable by the operator. WR-01 and WR-02 are recommended fixes (`/gsd-code-review 06 --fix`) but are not blockers.

---

_Verified: 2026-11-06_
_Verifier: Claude (gsd-verifier)_
