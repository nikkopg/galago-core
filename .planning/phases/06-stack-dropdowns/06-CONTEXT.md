# Phase 6: STACK Dropdowns - Context

**Gathered:** 2026-11-05
**Status:** Ready for planning
**Mode:** `--auto`. Every gray area was resolved with the recommended option (see `06-DISCUSSION-LOG.md`).

<domain>
## Phase Boundary

The operator fills the STACK `transfer`, `get_transfer_estimate` and `get_labware_presence` forms by picking
values the STACK reports: robot, source and destination device → deck → nest, labware profile, and source
and destination transfer profiles. The phase also builds the shared dropdown layer that Phase 7 reuses for
F.A.S.T. plates. That layer is the closed read registry, the `tool.options` query, the field-binding map,
the `OptionsSelect` control and the `useToolOptions` hook.

The forms appear in three hosts: the tool page, `AddToolCommandModal` and `CommandDetailsDrawer` in edit
mode. `vendor/galago-tools` is re-pinned to `4ccd3da`, and the regen must produce no diff.

Not in this phase: F.A.S.T. plates and the `fast.plates` parser (Phase 7), lanes (Phases 8 and 9), and
option-label context such as robot state, `hasLid` or plate size (Future Requirements).

</domain>

<decisions>
## Implementation Decisions

REQUIREMENTS.md already locks most of research decisions D6, D7, D10 and D11 (DRP-04, STK-04, DRP-07,
DRP-08). The decisions below lock what those requirements leave open.

### Read path and registry (D10)
- **D-01:** The new `Tool` instance method is `readOptions` (the name is the planner's choice). It is
  modelled on `controlCommand` (`server/tools.ts:375-391`): one gRPC `executeCommand` with a deadline of
  about 5 s, no `{{var}}` substitution, no step plumbing and no audit row per read. Only failures and
  explicit refreshes are logged. It never touches `CommandQueue`, `executeCommand(command)` or
  `controlCommand`.
- **D-02:** The `server/toolOptions.ts` registry is closed. Phase 6 adds four sources: `stack.robots`
  (`get_robot_states`), `stack.devices` (`list_devices`), `stack.labwareProfiles`
  (`list_labware_profiles`) and `stack.transferProfiles` (`list_transfer_profiles`). Phase 7 adds
  `fast.plates`; Phase 6 does not stub it. The `tool.options` tRPC query input is exactly
  `{ toolId, source: z.enum([...]), refresh?: boolean }`. The client can never supply a command or
  params.
- **D-03:** The server never throws. Each of the following becomes
  `{ status: "unavailable", reason }`: an unknown or unconnected tool, a transport error or timeout, a
  non-SUCCESS code, `readFailed`, an `ERROR_FROM_TOOL` reply saying the tool is reconfiguring or not
  configured, SUCCESS without `meta_data`, the wrong `kind`, and a malformed or over-cap reply. Only a
  validated empty array is `{ status: "ok", items: [] }`. Every source has a strict parser that checks
  `kind`, array caps and string caps, and requires each name to be a non-empty trimmed string. An item
  whose name looks like `{{x}}` is dropped and the list is marked degraded. Such a name is never
  escaped into a value the run-time substitution could expand. — **Reversibility:** reversible
- **D-04:** The server cache has a TTL of about 15 s, is keyed by `toolId`, a per-tool configure
  generation and the source, and removes duplicate in-flight reads. `tool.configure`, `tool.edit`,
  `tool.delete` and `clearToolStore` bump the generation. Refresh skips the server cache and sends
  `refresh: true` to the adapter in the same call. `get_robot_states` takes no `refresh` param; for
  that source, Refresh only skips the cache. A failed live read never falls back to a cached list.
- **D-05:** The react-query settings are explicit: `retry: false`, `refetchOnWindowFocus: false`,
  `staleTime` of about 15 s and no `refetchInterval`. There is one shared query per (toolId, source),
  not one per field. A list is read when its form opens and when the operator presses Refresh. There is
  no other read and no polling.

### Location cascade (STK-02, STK-03, STK-04, D7)
- **D-06:** Source and destination each get their own device → deck → nest cascade, and both are built
  from the one `stack.devices` read. Options are built by position (device index, then deck index,
  then nest index). Each option carries its plain `{deviceName, deckName, nestName}` and its path key.
  The value written to the form is only the plain name, never `unifiedName`. React keys include the
  index.
- **D-07:** Calibration filter: decks and nests with `isCalibrated !== true` are hidden. A device is
  offered as long as the tree lists it, even when none of its decks is calibrated. That device's deck
  list is then empty and no fallback applies, because this is a valid "nothing calibrated" answer and
  not `unavailable`. A saved uncalibrated deck or nest is kept and marked "(not reported by
  instrument)", as for any value not offered (DRP-02).
- **D-08:** Ambiguity is flagged and never disabled (D7). An option whose canonical path key
  (`device`, `device/deck` or `device/deck/nest`, in exactly the adapter's format) is in `ambiguous` is
  still shown and selectable, labelled "ambiguous — adapter will refuse". When a device is ambiguous,
  every deck and nest under it shows the flag as well. Duplicates are never collapsed, hidden or
  first-matched. Unit tests pin this, using golden fixtures for duplicate device names, a duplicate
  nest under different decks (which is not ambiguous), device-level ambiguity, and names containing
  `/`.
- **D-09:** A child resets only from the parent's operator `onChange`, never from an effect that runs
  when the option lists change. Changing the device clears deck and nest. Changing the deck clears the
  nest. A cleared field is set back to born-empty, never to the first child. Neither a Refresh nor the
  first load of a list clears a hydrated saved value. A test hydrates a saved step, triggers a Refresh
  and checks that the children are unchanged.

### Field binding and the shared control
- **D-10:** Dropdown behaviour lives in a React-free sibling binding map,
  `components/tools/fieldOptions.ts`. The map goes from `(toolType, command, fieldName)` to
  `{ source, cascade role }`. `commandFields.stack` stays byte-identical, because
  `test/commandFields.test.ts` pins it with `toStrictEqual`. `step_key` and `timeout_s` stay typed
  inputs, and the `list_*` / `get_*` tool-page commands keep their v1.1 forms (STK-07).
- **D-11:** One shared `OptionsSelect` component and one `useToolOptions` hook are used by all three
  hosts. Each select uses a native Chakra `Select` with an empty placeholder and nothing preselected,
  even when only one option exists. The control has four modes, all shipped in the first cut:
  `loading`, `ok`, `unavailable`, and `variable-bound`. In `unavailable` mode it renders the plain text
  input and the hint "Instrument list unavailable — type the value". In `variable-bound` mode the
  picker is disabled. A value that is not offered stays selected and is marked "(not reported by
  instrument)" only when the list loaded successfully and the value is not blank. Blank values (`""`,
  `undefined`) count as "not chosen" and show no warning. Values are compared with
  `String(a) === String(b)` and are never normalised.
- **D-12:** Refresh is one button per source on each form, not one per field. It sits next to the first
  field that uses the source. Because source and destination share `stack.devices`, there is one
  devices Refresh. Next to each Refresh, a status line reads "from instrument · N items · fetched
  hh:mm:ss". Refresh never clears a selection.

### `{{variable}}` binding (DRP-03)
- **D-13:** The editor keeps the existing per-field variable picker in `AddToolCommandModal`
  (`handleVariableSelect`, `isVariableReference`), so no second mechanism is added. A field bound to
  `{{var}}` shows the variable and disables its dropdown. When a cascade parent is bound, its children
  become typed inputs with the hint "child list unavailable while the parent is a variable". The tool
  page has no variables, so it never enters this mode.

### Hosts (D11, DRP-08, DRP-09)
- **D-14:** `CommandDetailsDrawer` gets the dropdowns only while `isEditing`, and `useToolOptions` is
  `enabled: isEditing`. The run page embeds the drawer read-only, so it sends no reads.
- **D-15:** What is sent stays the same. No submit path changes, and the existing `handleSubmit` fill-ins
  for fields without a dropdown are left as they are. A round-trip test hydrates a step whose value is
  not listed, changes nothing, saves, and checks that the params are byte-identical. Dropdown values
  are the plain strings the operator would have typed.

### Re-pin and regen (STK-08)
- **D-16:** `vendor/galago-tools` is pinned by SHA to `4ccd3da`, never with `--remote`. The regen uses
  ts-proto 1.151.1 from a scratch directory with an explicit `--plugin=`, following the Phase 5 D-02
  mechanism. The diff must be empty: `git diff` on the generated interfaces shows nothing. If the regen
  produces a diff, stop and record a note; never commit the churn. This is the first task of the first
  plan. — **Reversibility:** reversible — a submodule pointer.

### Static scans and pins
- **D-17:** Extend `test/staticScan.test.ts` with these checks:
  - `server/toolOptions.ts` is the only caller of the read method.
  - It imports nothing from `command_queue`.
  - The read source enum is closed.
  - The `tool.options` input schema accepts no `command` or `params` key.
  - The born-empty scans still pass: no `defaultValue` and no `select` in `commandFields.stack`.
  - No "first option" selection exists in `OptionsSelect`.

### Claude's Discretion
- Exact file split and naming of the read method, hook and component, and whether the hosts' existing
  `renderField` switch calls `OptionsSelect` through the binding map or a small adapter.
- The array and string caps, as long as they are explicit constants and tested at the boundary (for
  example a 10k-item list and a 1 MB string).
- The deadline mechanism: a gRPC `deadline` in the call options, or a 5 s `Promise.race`.
- The exact copy of hints and flags, as long as the meaning set out in D-08, D-11 and D-13 holds.
- How the plans are split. Suggested order: re-pin and regen gate as the tracer, then the server
  registry and `tool.options` with parsers and the cache, then the shared control, hook and binding
  map on the tool page, then `AddToolCommandModal` and the drawer, then the static scans.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and decisions
- `.planning/ROADMAP.md` § Phase 6: goal, success criteria, and "Settle in discuss: D6, D7, D10, D11"
- `.planning/REQUIREMENTS.md` § DRP-01..09 and STK-01..08, plus Out of Scope
- `.planning/research/SUMMARY.md`: decisions D6, D7, D10, D11 and Phase 6 implications
- `.planning/PROJECT.md`: core value (no preselection of physical values) and ts-proto 1.151.1 note

### Dropdown design and pitfalls
- `.planning/research/FEATURES.md` Part A: reply shapes per read (`deviceTree`, `robotStates`,
  `labwareProfiles`, `transferProfiles`, `readFailed`), table stakes and anti-features
- `.planning/research/ARCHITECTURE.md`: the `toolOptions` registry, `tool.options`, `fieldOptions`,
  `OptionsSelect`, `useToolOptions` and their integration points
- `.planning/research/PITFALLS.md`: Pitfalls 5 (stale after reconfig), 6 (ambiguous names) and 7-9
  (silent rewrite, saved-value retention), and the "Looks done but isn't" checklist
- `.planning/research/STACK.md`: no new dependencies, react-query settings, re-pin and ts-proto
  1.151.1 regen procedure

### Prior phase precedent
- `.planning/milestones/v1.1-phases/05-stack-codegen-command-forms/05-CONTEXT.md`: D-02 (regen
  mechanism) and D-03 (born-empty `commandFields.stack`, no `select`)

### Upstream (read-only)
- `vendor/galago-tools/interfaces/tools/grpc_interfaces/stack.proto`: frozen STACK command surface
- `../stack-automation-layer/stack_automation_layer/knowledge.py`, `results.py`: DeviceTree,
  `ambiguous` path-string format and `location()` refusal (sibling repo; available locally)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Tool.controlCommand` (`controller/server/tools.ts:375-391`): the direct gRPC send without the
  queue that the read method copies.
- `tool.latchStatus` (`controller/server/routers/tool.ts`, about line 550): the precedent for an
  explicit read with no polling, and where `tool.options` goes.
- The variable picker in `AddToolCommandModal` (`handleVariableSelect`, `isVariableReference`,
  `controller/components/protocols/AddToolCommandModal.tsx:256-286`): reused for DRP-03.
- The `labware` dropdown branch in `renderField` (`AddToolCommandModal.tsx:~293`): the existing
  pattern for a dropdown alongside a variable.
- Chakra 2.8 `Select`, tRPC 10.9 and react-query 4.22: already present, no new dependencies.

### Established Patterns
- Born-empty forms (Phase 5 D-03): `commandFields.stack` has no `defaultValue` and no `select`. A
  `toStrictEqual` pin in `controller/test/commandFields.test.ts:54,81` freezes it.
- Static scans in `controller/test/staticScan.test.ts` enforce architecture rules. New rules go there.
- Vitest 2.1.9 without jsdom. Keep logic React-free (`fieldOptions.ts`, parsers, option builders) so
  it can be unit-tested.

### Integration Points
- `controller/components/tools/constants.ts:344-378`: `commandFields.stack`, which is read only, never
  edited.
- `controller/pages/tools/[id].tsx`: tool-page command form. Its effect at lines 88-111 resets
  `formValues` on `selectedCommand`, and the cascade reset must not copy that pattern.
- `controller/components/protocols/AddToolCommandModal.tsx`: `renderField` and the `handleSubmit`
  fill-ins at lines 210-224, which stay as they are.
- `controller/components/protocols/CommandDetailsDrawer.tsx`: the edit-mode host; the run page renders
  it read-only.
- `controller/server/routers/tool.ts`: the `configure`, `edit`, `delete` and `clearToolStore` routes
  bump the cache generation.

</code_context>

<specifics>
## Specific Ideas

- The flag text should say what the adapter will do, for example "ambiguous — adapter will refuse".
  A generic warning icon alone is not enough.
- Show the "from instrument · N items · fetched hh:mm:ss" line, so the operator can tell a live list
  from a cached one.

</specifics>

<deferred>
## Deferred Ideas

- Option-label context such as robot state, labware `hasLid` and nest type is listed in Future
  Requirements. Phase 6 labels show plain names plus the ambiguity and "not reported" flags only.
- Disabling ambiguous locations instead of only flagging them is listed in Future Requirements.

### Reviewed Todos (not folded)
- "Fetch F.A.S.T. plate list for source/dest plate dropdowns" (score 0.9, `resolves_phase: 7`): Phase 7
  owns it. Phase 6 builds only the shared layer that it reuses.
- "Scheduler: per-toolId concurrency lanes" (score 0.6, `resolves_phase: 8`): this todo belongs to
  Phase 8 and has nothing to do with dropdowns.

</deferred>

---

*Phase: 06-stack-dropdowns*
*Context gathered: 2026-11-05*
