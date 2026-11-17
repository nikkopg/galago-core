---
phase: 06-stack-dropdowns
plan: 04
subsystem: ui
tags: [react, chakra, react-query, trpc, stack, dropdowns, cascade]
status: complete

requires:
  - phase: 06-stack-dropdowns
    provides: "06-01 useToolOptions/OptionsSelect tracer and tool.options query; 06-02 server cache + refresh semantics and D-17 server scans; 06-03 buildFieldView, applyChange, firstFieldForSource, formatStatusLine, SOURCE_LABELS and copy constants"
provides:
  - "useToolOptions(toolId, source, enabled) -> { mode, data, refresh, isRefreshing }: refresh fetches refresh:true with staleTime 0 and setData's the shared (toolId, source) entry; a rejected fetch writes unavailable/transport"
  - "OptionsSelect final props { toolId, binding, value, values, enabled, allowVariables, showRefresh, onSelect } rendering loading, ok, unavailable, variable-bound and child-of-variable from buildFieldView"
  - "Refresh row (RepeatIcon ghost teal button, Refreshing… while in flight) and aria-live status line; hint/note linked by aria-describedby"
  - "Tool page routes every bound STACK field (list + cascade) through OptionsSelect with the applyChange patch in one functional setFormValues"
  - "staticScan 'dropdown control invariants (D-09, D-11, D-17)' block"
affects: [06-05]

actuals:
  tokens: 3700
  tasks: 2
  commits: 2
plan_head_before: 1f19fff47d1cc5c415404f33d33729ab0db6a8ba
plan_head_after: 8ea2c6743437be104137e62d2286c7e861b17fe3

tech-stack:
  added: []
  patterns:
    - "Refresh = utils.tool.options.fetch({..., refresh: true}, { staleTime: 0 }) then utils.tool.options.setData(sharedKey, result); every control of the source updates from the one entry"
    - "Host onSelect merges applyChange(binding, v) into the previous form values in one functional update"
    - "Native <option> flag colours resolved with useToken (theme token -> CSS value)"

key-files:
  created: []
  modified:
    - controller/hooks/useToolOptions.ts
    - controller/components/tools/OptionsSelect.tsx
    - controller/pages/tools/[id].tsx
    - controller/test/staticScan.test.ts

key-decisions:
  - "refresh() is a no-op when the hook is disabled or toolId is blank, and passes retry: false to the fetch as well, so a Refresh is exactly one read"
  - "The status line is shown only when the rendered view is ok and data is present; the Refresh row appears for every non-loading view (including unavailable, so the operator can retry)"
  - "Ambiguous / not-reported option colours use useToken to turn orange.600|orange.300 and gray.600|whiteAlpha.700 into CSS values for the native <option> style; the flag text stays in the label"
  - "The [selectedCommand] reset effect is pinned by a scan that also asserts it never calls applyChange, so cascade clears stay onChange-only"

requirements-completed: [DRP-01, DRP-02, DRP-04, DRP-05, DRP-06, STK-02, STK-03, STK-04, STK-07]

coverage:
  - id: D1
    description: "OptionsSelect and useToolOptions declare no effect hook; OptionsSelect has no options[0]/selectedIndex/defaultValue/defaultChecked/selected=/placeholder= construct"
    requirement: DRP-01
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#dropdown control invariants (D-09, D-11, D-17)"
        status: pass
  - id: D2
    description: "useToolOptions keeps retry/refetchOnWindowFocus/refetchOnReconnect false and has no refetchInterval/setInterval/setTimeout; it is the only client file reading tool.options"
    requirement: DRP-04
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#dropdown control invariants (D-09, D-11, D-17)"
        status: pass
  - id: D3
    description: "The tool page writes bound fields only through applyChange, and its [selectedCommand] reset effect is intact; toolPageReply pins (two '?? \"\"', no '|| 0' / '|| \"false\"', setLastReply once) unchanged"
    requirement: DRP-05
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#the tool page writes bound fields through applyChange and keeps its [selectedCommand] reset effect"
        status: pass
      - kind: unit
        ref: "controller/test/toolPageReply.test.ts (unedited since 2505ceb)"
        status: pass
  - id: D4
    description: "Rendered dropdowns on the tool page against a live or PAC-simulated STACK: born-empty, cascade clears, flags, empty notes, Refresh keeps selections and updates the status line, server stopped -> typed fallback"
    requirement: STK-02
    verification:
      - kind: manual
        ref: "06-04 Task 2 human-check (end-of-phase UAT)"
        status: pending
    human_judgment: true
    rationale: "Vitest runs in node without React rendering, and a simulated STACK returns no meta_data, so rendered lists need a configured instrument."

duration: 3min
completed: 2026-11-06
---

# Phase 6 Plan 04: Shared control and tool-page host Summary

**OptionsSelect now renders every mode from `buildFieldView`, including the device -> deck -> nest cascade, flags, empty notes, a Refresh button and an aria-live status line. Refresh rewrites the shared react-query entry and never touches a value. On the tool page every bound STACK field goes through the control, and each change is written as one functional `applyChange` update. New static scans pin the D-17 client rules.**

## Performance

- **Duration:** about 3 min (2026-11-06T02:30Z to 02:33Z)
- **Tasks:** 2 of 2
- **Files:** 4 modified

## Accomplishments

- `useToolOptions` keeps the 06-01 query options unchanged. It adds `refresh()`:
  - Sets `isRefreshing` (plain `useState`).
  - Runs `utils.tool.options.fetch({ toolId, source, refresh: true }, { staleTime: 0, retry: false })`.
  - Writes the result with `utils.tool.options.setData({ toolId, source }, result)`, so every field on that source sees the new list.
  - If the fetch rejects, it writes `{ status: "unavailable", source, reason: "transport" }` so the old list is never left on screen.
  - It has no effect hook, no timer and no polling.
- `OptionsSelect` is laid out as a `VStack align="stretch" spacing={1} flex={1}`:
  - **Control:** ok, loading and variable-bound views use a native `Select` (no size, no placeholder; `aria-busy` while loading). Ambiguous options get the warning colour and not-reported options the muted colour. Unavailable and child-of-variable views use an `Input`.
  - **Refresh row:** shown when `showRefresh && enabled` and the view is not loading. It has a ghost teal `sm` button with `RepeatIcon`, the label `REFRESH_LABEL`, loading text `REFRESHING_LABEL`, and `aria-label="Refresh {source} list"`. In ok mode an `xs` muted `aria-live="polite"` status line from `formatStatusLine(data)` sits next to it.
  - **Text:** `view.hint` or `view.note` appears as `sm` muted text.
  - Hint and status ids come from `useId` and are wired into `aria-describedby`.
- Tool page:
  - Every binding returned by `lookupFieldBinding` (list and cascade) renders `OptionsSelect` with `allowVariables={false}`.
  - `showRefresh` is true only where `firstFieldForSource(commandFieldNames, type, command, source) === field.name`.
  - `handleOptionSelect` runs `setFormValues(prev => ({ ...prev, ...applyChange(binding, value) }))`.
  - Unchanged: `handleSubmit`, the reset effect, `handleChange` and the unbound branches.
- staticScan: a new `dropdown control invariants (D-09, D-11, D-17)` block with 5 cases. Every existing case is unedited.
- Full suite: 32 files, 750 tests pass. `tsc --noEmit` and `prettier . --check` are clean.

## Task Commits

1. **Task 1: OptionsSelect every mode, Refresh row, status line; hook refresh:** `f5bc6f9` (feat)
2. **Task 2: Tool page routing with applyChange; D-17 client scans:** `8ea2c67` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The tool-page call site was updated in Task 1**
- **Found during:** Task 1
- **Issue:** The final `OptionsSelect` props (`values`, `allowVariables`, `showRefresh`) are required. Without a change, the existing page call site would fail Task 1's required `tsc --noEmit` check.
- **Fix:** The Task 1 commit makes the existing list call site pass `values={formValues}`, `allowVariables={false}` and `showRefresh={false}`. Task 2 then replaces it with the full routing.
- **Files modified:** controller/pages/tools/[id].tsx
- **Commit:** f5bc6f9

### Additions within the plan's latitude

- `refresh()` passes `retry: false` to the fetch and returns early when the hook is disabled or `toolId` is blank.
- The Refresh row's `HStack` has `flexWrap="wrap"` so the status line can wrap under the button (UI-SPEC Field layout).

## Known Stubs

None.

## Threat Flags

None. T-06-14 is mitigated: mode still checks `isError` first, a rejected Refresh writes unavailable into the shared entry, and the scans rule out effect hooks and timers. No package was installed; `RepeatIcon` comes from the existing `@chakra-ui/icons` (T-06-SC).

## Pins Checked

- `git log --oneline 2505ceb..HEAD -- controller/test/toolPageReply.test.ts` is empty, and that test passes. The page still has exactly two `?? ""` and no `|| 0` or `|| "false"`.
- The 06-02 "tool options read path (D-17)" block, the operator-only ack literal pin and the latchStatus slice pass inside the full run.
- `commandFields.stack` was not touched. No new file contains `acknowledge_failure`.

## Human Check (end-of-phase UAT)

This needs a live or PAC-simulated STACK. On the tool page, open transfer, then get_transfer_estimate, then get_labware_presence. Expect:

- Every bound field starts blank with nothing preselected.
- Switching commands leaves every field blank.
- Deck lists show only calibrated decks.
- Ambiguous names carry the flag text and can still be selected.
- Changing a device blanks only that side's deck and nest.
- Refresh shows "Refreshing…", keeps selections and updates the status line.
- With the server stopped, the field becomes a text input with the unavailable hint.
- `step_key` and `timeout_s` stay typed inputs.

## Next Phase Readiness

06-05 can place `OptionsSelect` in the modal and drawer with the same props: `allowVariables={true}` there, and `enabled={isEditing}` in the drawer. Each host's onChange should merge `applyChange` the same way.

## Self-Check: PASSED

- FOUND: controller/hooks/useToolOptions.ts, controller/components/tools/OptionsSelect.tsx, controller/pages/tools/[id].tsx, controller/test/staticScan.test.ts
- FOUND (ancestors of HEAD): f5bc6f9, 8ea2c67
- `npx tsc --noEmit` exit 0; `npx vitest run` 32 files / 750 tests pass; `npx prettier . --check` clean
