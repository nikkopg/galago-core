---
phase: 06-stack-dropdowns
verified: 2026-11-06T13:50:00Z
status: passed
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
  - controller/components/tools/ToolsComponent.tsx
  - controller/components/tools/connectConfig.ts
  - controller/components/tools/fieldOptions.ts
  - controller/hooks/useToolOptions.ts
  - controller/pages/tools/[id].tsx
  - controller/server/routers/tool.ts
  - controller/server/toolOptions.ts
  - controller/server/tools.ts
  - controller/test/connectConfig.test.ts
  - controller/test/fieldOptions.test.ts
  - controller/test/staticScan.test.ts
  - controller/test/toolOptions.parse.test.ts
  - controller/test/toolOptions.read.test.ts
  - controller/test/toolOptionsRouter.test.ts
  - controller/test/wire.test.ts
covered_digest: "v3:sha256:11416d821147e845a684ef8ec8702e02661a79e66896eadc0b5424feab43891c"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 17/17
  gaps_closed:
    - "Human verification item 1: live render of the dropdowns in all three hosts (UAT tests 4, 5, 6, 8, 9, 11, pass)"
    - "Human verification item 2: offline typed fallback in all three hosts (UAT test 7, pass)"
    - "Human verification item 3: variable-bound parent and read-only drawer making no tool.options request (UAT tests 8, 10, pass)"
    - "Review WR-01: typed fallback wiped cascade children (fixed in faccb5e)"
    - "Review WR-02: drawer No Variable deleted the key and left a mismatched triple (fixed in faccb5e)"
  gaps_remaining: []
  regressions: []
---

# Phase 6: STACK Dropdowns Verification Report

**Phase Goal:** The operator fills the STACK `transfer`, `get_transfer_estimate` and `get_labware_presence` forms by picking values the STACK reports, and the shared dropdown layer is ready for Phase 7.
**Verified:** 2026-11-06
**Status:** passed
**Re-verification:** Yes, after review fixes (faccb5e), the Connect All payload fix (1c4f875) and completed human UAT

The previous report was `human_needed` and went stale when covered source changed. Every code-level item was re-checked against the current tree. The three human items are now closed by the completed UAT (`06-UAT.md`, status complete, 11 passed, 0 issues). Both former review warnings are resolved in code. Three info findings remain open and do not affect any requirement.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | The three STACK forms offer instrument-reported dropdowns that start empty and preselect nothing | VERIFIED | `FIELD_BINDINGS.stack` binds transfer, get_transfer_estimate and get_labware_presence. `buildSelectView` emits an explicit empty option and never selects one. `OptionsSelect` has no effect hook that picks a value. UAT test 4 confirmed live: every bound field starts blank, even with a single reported item, and deck/nest stay disabled until the parent is chosen. |
| SC2 | An unreachable instrument, or a saved value no longer reported, never blocks or rewrites a step | VERIFIED | `fetchOptions` never throws and maps failures to `unavailable`. The UI falls back to a typed input and keeps the saved value with the "(not reported by instrument)" flag. UAT test 7 (STACK server stopped: typed input with hint in all three hosts, no stale list, form not blocked), test 6 (not-reported kept selected) and test 9 (saving an untouched not-reported nest writes the step unchanged) all passed. |
| SC3 | What is sent is unchanged, with `vendor/galago-tools` pinned to `4ccd3da` and no regen diff | VERIFIED | `git submodule status` shows `4ccd3da656c0e981332018b3d33e16148a8bc513`. `git diff c17e262 HEAD -- controller/gen-interfaces vendor` is empty, so nothing changed since the first verification. Values are plain strings, and `wire.test.ts` still passes. Submit paths are not touched by the fix commits. |

**Score:** 17/17 requirement truths verified, 0 present but behavior-unverified.

### Re-verification of the changed code

| Change | Check | Result |
|--------|-------|--------|
| faccb5e WR-01 | `applyChange(binding, value, kind = "select")` returns `{ [binding.field]: newValue }` first when `kind === "typed"` (`fieldOptions.ts:379-385`). `OptionsSelect` passes `"typed"` from the fallback `<Input>` (`:89`) and `"select"` from the list. All three hosts forward `kind` (`[id].tsx:264`, modal `:296`, drawer `:216`). | VERIFIED. A typed edit cannot clear a deck or nest. New `fieldOptions` test covers it. |
| faccb5e WR-02 | Drawer (`:271`) and modal (`:339`) call `handleOptionSelect(binding, "", "select")` for "No Variable" on a bound field. That writes `""` and clears the children in one functional update, rather than deleting the key. | VERIFIED. Mismatched triples cannot be produced. |
| 1c4f875 Connect All | `buildConnectConfig` unwraps the type-keyed stored row (`type in stored ? stored[type] : stored`), reads `simulated` from the row's top level, and still handles a flat legacy row. `ToolsComponent.tsx:81` uses it. `connectConfig.test.ts` has 3 tests. | VERIFIED. |

### Requirements Coverage

Plan frontmatter declares: 06-01 [STK-08, DRP-01, DRP-04, DRP-07, STK-01, STK-05, STK-06]; 06-02 [DRP-04, DRP-06, DRP-07]; 06-03 [DRP-01, DRP-02, DRP-03, DRP-05, DRP-09, STK-02, STK-03, STK-04, STK-07]; 06-04 [DRP-01, DRP-02, DRP-04, DRP-05, DRP-06, STK-02, STK-03, STK-04, STK-07]; 06-05 [DRP-03, DRP-08, DRP-09, STK-01, STK-02, STK-05, STK-06, STK-07]. The union covers all 17 IDs in ROADMAP Phase 6 and in REQUIREMENTS.md. No orphaned requirements. REQUIREMENTS.md checkboxes for all but STK-08 are still unticked and its traceability table says "Pending"; that bookkeeping is for the orchestrator and is not a code gap.

| Requirement | Status | Evidence |
|-------------|--------|----------|
| DRP-01 empty, nothing preselected | SATISFIED | `buildSelectView`, no selecting effect in `OptionsSelect`, static scans. UAT 4. |
| DRP-02 saved value kept, flagged | SATISFIED | `not-reported` option, tests, UAT 6 and 9. |
| DRP-03 `{{var}}` binding, bound parent gives typed children | SATISFIED | `variable-bound` and `child-of-variable` modes. Modal and drawer pass `allowVariables`. UAT 8 (picker disabled showing `{{name}}`, children typed with hint, unbind returns to dropdowns). The WR-02 fix removed the unbind defect. |
| DRP-04 failures give typed input with hint, no stale list | SATISFIED | `deriveOptionsMode` checks `isError` first, cache eviction, `retry:false`. UAT 7. |
| DRP-05 children clear only on the parent's own change | SATISFIED | `applyChange` is the only patch producer and has no effect hook. With the WR-01 fix, typed edits no longer clear children either. UAT 4 and 9. |
| DRP-06 Refresh sends `refresh:true`, keeps selection | SATISFIED | `useToolOptions.refresh`, 2 s minimum interval. UAT 5. |
| DRP-07 closed registry, deadline, caps, no queue | SATISFIED | Four-entry `OPTION_SOURCES`, strict router input, `Tool.readOptions` with 5 s deadline called only from `toolOptions.ts`, caps 256/1000/10000, `{{x}}` names dropped. Server scans in `staticScan.test.ts` pass. The requirement text mentions `Tool.executeCommand`, but locked decision D-01 chose a dedicated `readOptions`. |
| DRP-08 drawer dropdowns, reads only in edit mode | SATISFIED | Binding looked up and `enabled={isEditing}` only while editing. UAT 10: read-only run-page drawer sent no `tool.options` request. |
| DRP-09 sent values unchanged | SATISFIED | Plain strings, `wire.test.ts`, no submit path changed. |
| STK-01 robot | SATISFIED | `stack.robots`, bound in all three commands. |
| STK-02 device/deck/nest cascades by plain names | SATISFIED | `buildCascadeOptions` from `stack.devices`; source and destination independent (UAT 4). |
| STK-03 calibrated only | SATISFIED | Uncalibrated skipped, saved uncalibrated value kept and flagged. UAT 6. |
| STK-04 ambiguous flagged, not hidden | SATISFIED | Flagged by exact path membership, still selectable. UAT 6 and 11. |
| STK-05 labware_profile | SATISFIED | `stack.labwareProfiles`. |
| STK-06 transfer profiles | SATISFIED | `stack.transferProfiles` for source and destination. |
| STK-07 coverage; step_key and timeout_s typed | SATISFIED | Coverage test pins typed fields. |
| STK-08 pin and no regen diff | SATISFIED | Submodule at `4ccd3da`, empty `gen-interfaces` diff. UAT 1 and 3 confirm the SHA is on `origin feat/stack-tool`. |

### Required Artifacts and Wiring

| Artifact | Status | Details |
|----------|--------|---------|
| `controller/server/toolOptions.ts` | VERIFIED | Parsers, caps, TTL cache, dedupe, generation invalidation. Called by the router. |
| `controller/server/tools.ts` `readOptions` | VERIFIED | Direct gRPC call with deadline. |
| `controller/server/routers/tool.ts` `options` | VERIFIED | Generation bumped on configure, edit, delete. |
| `controller/components/tools/fieldOptions.ts` | VERIFIED | Binding map, cascade builders, `applyChange` with `kind`, view model. |
| `controller/components/tools/OptionsSelect.tsx` | VERIFIED | Imported by all three hosts, passes `kind`. |
| `controller/hooks/useToolOptions.ts` | VERIFIED | Wired to `trpc.tool.options`. |
| `controller/components/tools/connectConfig.ts` | VERIFIED | Used by `ToolsComponent.tsx`, tested. |
| Three hosts | VERIFIED | Each uses `lookupFieldBinding`, `OptionsSelect` and `applyChange`. |

Data flow: STACK reply to `Tool.readOptions`, `parse*`, `fetchOptions`, tRPC `tool.options`, `useToolOptions`, `buildFieldView`, control. The data is real, and UAT observed live lists.

### Behavioral Spot-Checks and Test Runs

| Check | Result | Status |
|-------|--------|--------|
| `cd controller && npx tsc --noEmit` | exit 0 | PASS |
| `cd controller && npx vitest run` (run once at HEAD 796a985) | 33 files, 759 tests passed | PASS |
| `npm run build` | Not run here. It failed earlier because `controller/.next` is root-owned. 06-05 recorded a pass on a scratch copy. | Environment issue, not a code gap |

Probe execution: no probes declared by the phase. Skipped.

### Human Verification

All three previous items are closed by `06-UAT.md` (11/11 passed, 0 issues, 0 pending). Nothing is outstanding.

### Anti-Patterns Found

No `TBD`, `FIXME` or `XXX` markers in any covered source file. No stubs.

### Open Review Items (06-REVIEW.md, 0 critical, 0 warning, 3 info)

WR-01 and WR-02 are resolved. The remaining items are info only and are not blockers. None defeats a requirement.

| ID | Note |
|----|------|
| IN-01 | Unbinding a device clears deck and nest variable bindings too. Consistent with D-09, recommend recording as a decision. |
| IN-02 | The unbind rule is duplicated inline in modal and drawer and has no host-level regression test. |
| IN-03 | A bound variable absent from the variable list cannot be unbound from the picker. This is an edge case of a deleted variable. The earlier verification noted this as a typed-input limitation. Worth a follow-up fix. |
| First-review IN-01..03 | `isRefreshing` reset outside `finally`, `clearToolStore` generation bump only on success, no per-string cap on `ambiguous` (bounded by the 10k cap and gRPC's 4 MB limit). |

### Gaps Summary

No gaps. All 17 requirements and all 3 ROADMAP success criteria are verified in code and by the completed live UAT. The shared dropdown layer (`fieldOptions.ts`, `OptionsSelect`, `useToolOptions`, closed `OPTION_SOURCES` registry) is host-agnostic and ready for Phase 7.

---

_Verified: 2026-11-06_
_Verifier: Claude (gsd-verifier)_
