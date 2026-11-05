# Phase 6: STACK Dropdowns - Research

**Researched:** 2026-11-05
**Domain:** instrument-fed form dropdowns (Next.js 13 + tRPC 10.9 + react-query 4.22 + Chakra 2.8 over gRPC tool servers), submodule re-pin and ts-proto regen
**Confidence:** HIGH. Every claim below was read from this repo, the vendored galago-tools at `4ccd3da`, the sibling `stack-automation-layer` at `934a621`, or proven by a throwaway spike this session. Items that were not verified are in the Assumptions Log.

## Summary

The phase adds no dependencies. It adds a server read registry (`server/toolOptions.ts`), one `Tool` read method modelled on `controlCommand`, one tRPC query (`tool.options`), a React-free binding map and option builder (`components/tools/fieldOptions.ts`), one shared control (`OptionsSelect`) and one hook (`useToolOptions`), wired into three hosts (tool page, `AddToolCommandModal`, `CommandDetailsDrawer` in edit mode). The re-pin to `4ccd3da` is proto-neutral: a regen with the existing Phase 5 toolchain into a scratch directory produced **zero diff** against `controller/gen-interfaces` this session.

Five findings the milestone research did not have and the planner must act on:
1. **`4ccd3da` is not on GitHub.** `.gitmodules` points at `https://github.com/nikkopg/galago-tools.git`, whose `feat/stack-tool` is `9592509`. `4ccd3da` exists only in the local clone (`feat/stack-tool ... ahead 95`). The pin works on this machine and is unreproducible elsewhere until the user pushes. This is a human-action checkpoint, not something to automate.
2. **The `ambiguous` list is not complete per-triple.** The adapter marks every nest under a duplicated *deck* name and every triple under a duplicated *device* name as ambiguous, but lists only `device/deck` or `device` in `ambiguous`. The client must flag by prefix, not by exact path membership alone (details in Reply Shapes). D-08 only spells out device-level propagation; deck-level propagation is needed to match the adapter.
3. **Three existing tests pin source text that this phase will touch.** `test/toolPageReply.test.ts` pins exactly two `?? ""` occurrences and forbids `|| 0` and `|| "false"` in `pages/tools/[id].tsx`, plus a regex over the `params:` ternary. `test/latchStatus.test.ts` slices `server/routers/tool.ts` from `latchStatus: procedure` to end-of-file and forbids the substrings `controlCommand` and `zToolType` there. New page logic must live in new files, and `options` must be declared **before** `latchStatus`.
4. **`react` cannot be imported by any vitest-loaded module.** `tsconfig.json` maps `react` to `node_modules/@types/react/index.d.ts`, and `vite-tsconfig-paths` follows it: a spike importing `react` failed with `ReferenceError: index_d_module is not defined`. Everything unit-tested must be React-free (`import type` is fine, it is erased).
5. **A simulated STACK tool answers every read with SUCCESS and no `meta_data`**, which D-03 maps to `unavailable`. Dropdowns will therefore degrade to typed inputs on a simulated STACK. UAT of the dropdowns needs a real or PAC-simulated STACK with the adapter configured; everything else is covered by fixtures and a fake gRPC.

**Primary recommendation:** Build bottom-up and pure-first: (1) re-pin and scratch-dir regen gate, (2) `toolOptions.ts` parsers, cache and `readOptions` with fixture tests, (3) `fieldOptions.ts` pure core (binding map, option builder, `applyChange`/`dependentsOf`), (4) `OptionsSelect` plus `useToolOptions` on the tool page, (5) modal and drawer, (6) static scans. Keep the rule "a list change never produces a value change" structural: only `applyChange` returns param patches and only operator `onChange` handlers call it; `OptionsSelect.tsx` and `useToolOptions.ts` contain no `useEffect`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

REQUIREMENTS.md already locks most of research decisions D6, D7, D10 and D11 (DRP-04, STK-04, DRP-07,
DRP-08). The decisions below lock what those requirements leave open.

#### Read path and registry (D10)
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

#### Location cascade (STK-02, STK-03, STK-04, D7)
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

#### Field binding and the shared control
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

#### `{{variable}}` binding (DRP-03)
- **D-13:** The editor keeps the existing per-field variable picker in `AddToolCommandModal`
  (`handleVariableSelect`, `isVariableReference`), so no second mechanism is added. A field bound to
  `{{var}}` shows the variable and disables its dropdown. When a cascade parent is bound, its children
  become typed inputs with the hint "child list unavailable while the parent is a variable". The tool
  page has no variables, so it never enters this mode.

#### Hosts (D11, DRP-08, DRP-09)
- **D-14:** `CommandDetailsDrawer` gets the dropdowns only while `isEditing`, and `useToolOptions` is
  `enabled: isEditing`. The run page embeds the drawer read-only, so it sends no reads.
- **D-15:** What is sent stays the same. No submit path changes, and the existing `handleSubmit` fill-ins
  for fields without a dropdown are left as they are. A round-trip test hydrates a step whose value is
  not listed, changes nothing, saves, and checks that the params are byte-identical. Dropdown values
  are the plain strings the operator would have typed.

#### Re-pin and regen (STK-08)
- **D-16:** `vendor/galago-tools` is pinned by SHA to `4ccd3da`, never with `--remote`. The regen uses
  ts-proto 1.151.1 from a scratch directory with an explicit `--plugin=`, following the Phase 5 D-02
  mechanism. The diff must be empty: `git diff` on the generated interfaces shows nothing. If the regen
  produces a diff, stop and record a note; never commit the churn. This is the first task of the first
  plan. — **Reversibility:** reversible — a submodule pointer.

#### Static scans and pins
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

### Deferred Ideas (OUT OF SCOPE)
- Option-label context such as robot state, labware `hasLid` and nest type is listed in Future
  Requirements. Phase 6 labels show plain names plus the ambiguity and "not reported" flags only.
- Disabling ambiguous locations instead of only flagging them is listed in Future Requirements.

Reviewed todos (not folded): "Fetch F.A.S.T. plate list for source/dest plate dropdowns" (Phase 7 owns it; Phase 6 builds only the shared layer) and "Scheduler: per-toolId concurrency lanes" (Phase 8, unrelated).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DRP-01 | Dropdown of instrument-reported values, starts empty, nothing preselected | Native Chakra `Select` with empty placeholder; "No first option" scan; mode table in Pattern 4 |
| DRP-02 | Saved value no longer reported stays selected, marked "(not reported by instrument)" | Pattern 4 `buildSelectView`; extra `<option>` rule; Pitfall 6 (blank = not chosen) |
| DRP-03 | `{{variable}}` binding still works; bound parent turns children into typed inputs | Modal/drawer `isVariableReference` reuse; `variable-bound` mode; Pattern 5 |
| DRP-04 | Unreachable / failed / no-data gives plain input + hint, never a stale list | Reply Shapes failure matrix; Pitfall 2 (react-query keeps `data` on error); cache eviction on failure |
| DRP-05 | Parent change clears children; loading options never clears a saved value | Pattern 3 `applyChange`; no-`useEffect` structural rule; Pitfall 4 |
| DRP-06 | Refresh re-reads with `refresh: true`, never clears a selection | Pattern 6 (`utils.tool.options.fetch` + `setData`); registry `acceptsRefresh` |
| DRP-07 | Closed server registry, deadline, never queued/polled, validated + capped, `{{x}}` names never substituted | Pattern 1 and 2; gRPC deadline spike; caps table; Security Domain |
| DRP-08 | Same dropdowns in the step drawer, read only while editing | Host Integration Map (drawer iterates saved params keys, not `commandFields`) |
| DRP-09 | What is sent is unchanged | Submit-path facts (no change), Pitfall 5, round-trip test design in Validation Architecture |
| STK-01 | `robot` from `get_robot_states` | Source `stack.robots`; reply shape `robotStates` |
| STK-02 | Source/destination device → deck → nest from `list_devices`, plain names only | Pattern 3; reply shape `deviceTree`; never `unifiedName` |
| STK-03 | Only calibrated decks/nests offered; saved uncalibrated kept | D-07; `isCalibrated === true` strict (adapter parity) |
| STK-04 | Ambiguous locations shown and flagged | Reply Shapes "ambiguous format" incl. prefix propagation; Pitfall 3 |
| STK-05 | `labware_profile` from `list_labware_profiles` | Source `stack.labwareProfiles`; reply shape `labwareProfiles` |
| STK-06 | Source/destination transfer profiles from `list_transfer_profiles` | Source `stack.transferProfiles`; reply shape `transferProfiles` |
| STK-07 | Covers `transfer`, `get_transfer_estimate`, `get_labware_presence`; `step_key`/`timeout_s` typed | Binding table in Pattern 3; `commandFields.stack` untouched |
| STK-08 | `vendor/galago-tools` pinned to `4ccd3da`, no regen diff | Re-pin procedure with verified zero-diff regen; GitHub-reachability finding |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` or `.claude/CLAUDE.md` exists in this repo (`config.json` names `./.claude/CLAUDE.md`, which is absent) and there is no `.claude/skills/` or `.agents/skills/`. The directives that bind this phase come from `.planning/PROJECT.md` and the v1.1 decisions, and carry locked-decision authority:

- Born-empty: nothing preselects a physical value (PROJECT core value). `commandFields.stack` has no `defaultValue` and no `select`.
- No new npm dependencies; no jsdom / React Testing Library (PROJECT key decision "pure-logic tests plus static source scans"). Rendered behaviour goes to pure helpers, scans and UAT.
- ts-proto 1.151.1 from a scratch directory with explicit `--plugin=`; never `controller/node_modules` (1.153.2, generates a broken `tool_base.ts`); never edit `package.json` to pin it.
- Prettier: `printWidth` 100, `bracketSameLine: true`, 2 spaces (`/home/formulatrix/data/nikko/galago-core/.prettierrc`).
- tsconfig is `strict` with `noUnusedLocals` and `noUnusedParameters` (`controller/tsconfig.json`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Instrument list read (`get_robot_states`, `list_*`) | API / Backend (`server/toolOptions.ts` + `Tool.readOptions`) | Tool gRPC server | Only the server holds gRPC channels; the client must never name a command |
| Reply validation, caps, `{{x}}` filter | API / Backend | — | Untrusted instrument data is cleaned once, before it reaches the browser |
| TTL cache, in-flight dedupe, configure generation | API / Backend | — | Cache validity depends on server-side configure/edit/delete events |
| Field-to-source binding, cascade, option building, "not reported" and ambiguity flags | Browser / Client (React-free pure module) | — | Pure functions keep the logic unit-testable without jsdom |
| Shared control (modes, Refresh, status line) | Browser / Client | — | Presentation only; consumes the pure view model |
| Client query policy (retry, staleTime, no polling) | Browser / Client (`useToolOptions`) | — | One reader of `tool.options`, mirrors `useRunControl.ts` |
| What is sent on Run/Save | Existing submit paths (unchanged) | API (`Tool.executeCommand`) | DRP-09: dropdowns only change how a string is entered |
| Submodule pin and generated types | Build pipeline (git + protoc + ts-proto) | — | Generated files are committed; toolchain runs only at pin time |

## Standard Stack

### Core
No new packages. The stack already installed and verified this session:

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| `@trpc/server` / `@trpc/react-query` | 10.9.0 `[VERIFIED: controller/node_modules/@trpc/*/package.json]` | `tool.options` query, `useContext().fetch/setData` | Existing API layer |
| `@tanstack/react-query` | 4.22.0 `[VERIFIED: node_modules package.json]` | Client cache; `isInitialLoading` exists in this version `[VERIFIED: query-core types.d.ts:230]` | v4 option names apply (`cacheTime`, not `gcTime`) |
| `zod` | 3.23.8 installed (`^3.20.2` declared) `[VERIFIED]` | Input enum, reply parsing | Existing validation idiom |
| `@chakra-ui/react` | 2.8.2 `[VERIFIED]` | Native `Select` | Existing form control (PF400 selects) |
| `@grpc/grpc-js` | 1.12.2 `[VERIFIED: package.json]` | Call options `{ deadline }` | Existing transport |
| `vitest` | 2.1.9 `[VERIFIED]` | Tests (`environment: "node"`, `include: ["test/**/*.test.ts"]`) | Pinned by project decision |

### Supporting (codegen toolchain, reused not installed)
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| ts-proto | 1.151.1 at `/tmp/opencode/tsproto-1511/node_modules/.bin/protoc-gen-ts_proto` `[VERIFIED: its package.json "version": "1.151.1"]` | Regen plugin | The regen gate only |
| grpcio-tools | 1.85.1 in `/tmp/opencode/proto-venv` `[VERIFIED: pip list]` | `python -m grpc_tools.protoc` | The regen gate only; a different protoc can churn `google/protobuf/struct.ts` comments (Phase 5 summary) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gRPC `deadline` option | `Promise.race` 5 s | Race leaves the call alive; gRPC deadline cancels it. Fake-gRPC tests can only assert the options argument, not a real hang. Use the deadline (see Pattern 2). |
| `utils.tool.options.fetch` + `setData` for Refresh | A second `useQuery` keyed with `refresh` | Splits the "one shared query per (toolId, source)" cache entry |
| `@choc-ui/chakra-autocomplete` | native `Select` | Not needed for these list sizes; locked by D-11 |

**Installation:** none. `controller/package.json` is unchanged.

**Version verification:** `npm view ts-proto@1.151.1 version` returned `version = '1.151.1'` this session. The regen toolchain already exists under `/tmp/opencode` (see Environment Availability); recreate it with the recipe in "Re-pin and regen procedure" if `/tmp` was cleaned.

## Package Legitimacy Audit

This phase installs **no** packages into the product. The only third-party code touched is the pre-existing regen toolchain.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| ts-proto@1.151.1 (regen plugin only, scratch dir) | npm | 8 yrs (1.151.1 is from 2023-07-05, Phase 5 audit) | 2.6M/wk (Phase 5 audit) | github.com/stephenh/ts-proto | not re-run; carried from Phase 5 (`[SUS]` false positive on the latest release, pinned version is the repo's documented toolchain, `postinstall` empty) | Approved: already installed at `/tmp/opencode/tsproto-1511`, no reinstall needed |
| grpcio-tools@1.85.1 (venv) | PyPI | n/a | n/a | github.com/grpc/grpc | already installed in `/tmp/opencode/proto-venv` | Approved: no reinstall |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none new. If `/tmp/opencode` has been cleaned and the toolchain must be reinstalled, the planner should add a `checkpoint:human-verify` before `npm install ts-proto@1.151.1` (same disposition as Phase 5). `[ASSUMED]` for the reinstall path only; the current session reused the existing install.

## Architecture Patterns

### System Architecture Diagram

```
 Operator opens a form (tool page / AddToolCommandModal step 3 / Drawer while isEditing)
        |
        v
 OptionsSelect (per bound field) --calls--> useToolOptions(toolId, source, enabled)
        |                                         |
        | pure view model                         | trpc.tool.options.useQuery({toolId, source})
        | fieldOptions.buildSelectView(...)       |   retry:false, refetchOnWindowFocus:false,
        |   (mode, options, flags, hint)          |   refetchOnReconnect:false, staleTime:15s, no interval
        |                                         v
        |                              ---- HTTP (tRPC, no auth) ----
        |                                         |
        |                                         v
        |        tool.options  input: { toolId, source: z.enum(closed), refresh?: boolean }
        |                                         |
        |                     toolOptions.fetchOptions(toolId, source, refresh)
        |                       |-- Tool.lookup(toolId) missing / not "stack"  --> unavailable(not_connected|wrong_tool_type)
        |                       |-- cache hit (key toolId|generation|source, TTL 15 s, ok only) --> return {fetchedAt = original}
        |                       |-- in-flight map (dedupe; refresh has its own in-flight key)
        |                       v
        |                 tool.readOptions(command, params)  (grpc.executeCommand + Metadata + {deadline +5 s})
        |                       |  no CommandQueue, no {{var}} substitution, no per-read audit row
        |                       v
        |                 STACK tool server (READ_COMMANDS bypass the BUSY gate) --> reply
        |                       |
        |        strict parser (kind, caps, names non-empty, drop "{{x}}" -> degraded)
        |                       |
        |        failure of ANY kind --> evict cache entry, throttled logAction, {status:"unavailable", reason}
        v                       v
 Operator onChange --> fieldOptions.applyChange(binding, values, newValue)  (ONLY producer of param patches;
        |               clears children to "" for device/deck changes)        never called from an effect)
        v
 host state (tool page formValues / modal commandParams / drawer editedParams) --> unchanged submit paths
```

### Recommended Project Structure
```
controller/
├── server/
│   ├── toolOptions.ts        # NEW registry, parsers, caps, cache, in-flight, generation, fetchOptions()
│   ├── tools.ts              # MODIFIED: + Tool.readOptions (sibling of controlCommand)
│   └── routers/tool.ts       # MODIFIED: + options query (declare BEFORE latchStatus); bump generation in configure/edit/delete/clearToolStore
├── utils/variableRef.ts      # NEW (optional, import-free) shared isVariableLike predicate for server parser + fieldOptions
├── components/tools/
│   ├── fieldOptions.ts       # NEW React-free: binding map, buildCascadeOptions, buildSelectView, applyChange, firstFieldForSource
│   └── OptionsSelect.tsx     # NEW shared control (no useEffect)
├── hooks/useToolOptions.ts   # NEW only reader of tool.options (no useEffect)
└── test/
    ├── toolOptions.parse.test.ts      # NEW pure parsers + caps
    ├── toolOptions.read.test.ts       # NEW readOptions + cache + generation + dedupe (fake gRPC)
    ├── toolOptionsRouter.test.ts      # NEW router integration (latchStatus harness)
    ├── fieldOptions.test.ts           # NEW binding, cascade, ambiguity, not-reported, round trip
    ├── fixtures/stackOptions.ts       # NEW golden-derived fixtures (copied, not imported from the sibling repo)
    └── staticScan.test.ts             # EXTENDED (D-17)
```

### Pattern 1: Closed registry and `fetchOptions` (server/toolOptions.ts)
**What:** A `const OPTION_SOURCES = { "stack.robots": {...}, ... } as const` whose keys are the only enum values; each entry holds a static `toolType: "stack"`, the oneof command name, whether the adapter accepts `refresh`, and a parser. The `tool.options` input enum is derived from `Object.keys(OPTION_SOURCES)`, and no input field can carry a command or params.
**When to use:** Every source, including Phase 7's `fast.plates` (added by that phase, not stubbed now).
**Verified command and kind pairs** (from `tools/stack/server.py` and `stack.proto` at `4ccd3da`):

| Source id | oneof command | Params sent | Adapter `kind` expected |
|-----------|---------------|-------------|-------------------------|
| `stack.robots` | `get_robot_states` | `{}` (message has no fields) | `robotStates` |
| `stack.devices` | `list_devices` | `{}` or `{ refresh: true }` | `deviceTree` |
| `stack.labwareProfiles` | `list_labware_profiles` | `{}` or `{ refresh: true }` | `labwareProfiles` |
| `stack.transferProfiles` | `list_transfer_profiles` | `{}` or `{ refresh: true }` | `transferProfiles` |

Send `refresh: true` only when refreshing and omit the key otherwise (proto3 `optional`; the adapter reads it as `bool(cmd.HasField(field) and getattr(cmd, field))`, so omitted and `false` behave the same).

```typescript
// Shape sketch (planner fills in). Values verified: kinds and commands from the table above.
export const OPTION_SOURCES = {
  "stack.robots": { toolType: "stack", command: "get_robot_states", acceptsRefresh: false, kind: "robotStates", parse: parseRobots },
  "stack.devices": { toolType: "stack", command: "list_devices", acceptsRefresh: true, kind: "deviceTree", parse: parseDevices },
  "stack.labwareProfiles": { toolType: "stack", command: "list_labware_profiles", acceptsRefresh: true, kind: "labwareProfiles", parse: parseProfiles },
  "stack.transferProfiles": { toolType: "stack", command: "list_transfer_profiles", acceptsRefresh: true, kind: "transferProfiles", parse: parseProfiles },
} as const;
export type OptionSourceId = keyof typeof OPTION_SOURCES;
export const OPTION_SOURCE_IDS = Object.keys(OPTION_SOURCES) as [OptionSourceId, ...OptionSourceId[]];

export type OptionsResult =
  | { status: "ok"; source: OptionSourceId; items: unknown[]; degraded: boolean; fetchedAt: number }
  | { status: "unavailable"; source: OptionSourceId; reason: UnavailableReason };
```

Resolve the tool with `Tool.lookup(toolId)` (`server/tools.ts:370`), which never creates a `Tool`. Do **not** copy `latchStatus`'s `getToolFromDB` + `Tool.forId`: `forId` creates a `Tool` and starts a 5 s heartbeat for any id (PITFALLS 31). A missing tool maps to `unavailable("not_connected")`; a tool whose `String(tool.type) !== "stack"` maps to `unavailable("wrong_tool_type")` before anything is sent. `ToolsComponent` calls `clearToolStore` on mount and tools are re-added only on Connect, so "not connected" is a normal state, not an error.

### Pattern 2: `Tool.readOptions` (server/tools.ts, sibling of `controlCommand`)
**What:** One gRPC `executeCommand` with metadata and a deadline; no substitution, no audit row, no throw handling beyond propagating to `toolOptions.ts`, which catches and maps.
**Verified current code** `[VERIFIED: server/tools.ts:378-391]`, quoted:
```typescript
  async controlCommand(action: string, params: Record<string, string>): Promise<ToolControlResult> {
    const payload = this._payloadForCommand({
      toolId: this.toolId,
      toolType: this.toolType,
      command: action,
      params,
    });
    const reply = await this.grpc.executeCommand(payload);
```
**Deadline mechanism (verified by spike):** the promisified client type is `(request, metadata?, options?)` and `promisifyGrpcCall` spreads `...args` before the callback (`server/utils/promisifyGrpcCall.ts`). grpc-js 1.12.2 `checkOptionalUnaryResponseArguments` throws `Incorrect arguments passed` unless `arg1 instanceof Metadata`. The spike (scratchpad `deadline_spike.js`, real grpc-js server, 1.5 s handler) printed:
```
(req, Metadata, {deadline}) REJECTED code= 4 msg= 4 DEADLINE_EXCEEDED: Deadline exceeded after 0.300s,... after 303 ms
(req, undefined, {deadline}) REJECTED code= undefined msg= Incorrect arguments passed after 0 ms
refused: code 14 14 UNAVAILABLE: No connection established. Last error: connect ECONNREFUSED 127.0.0.1:1 ... after 4 ms
```
So call `this.grpc.executeCommand(payload, new grpc.Metadata(), { deadline: Date.now() + READ_DEADLINE_MS })` with `READ_DEADLINE_MS = 5000`. `import * as grpc from "@grpc/grpc-js"` already exists at the top of `server/tools.ts`. A refused connection fails fast with code 14, so an offline instrument reports `unavailable` in milliseconds, not 5 s. No existing code in `server/` passes call options (only comments mention "no deadline"), so this is the first use. Build the payload with the registry's static type (`{ [source.toolType]: { [command]: params } }`) and assert `String(this.toolType) === source.toolType` first, rather than trusting `_payloadForCommand`'s instance type alone.
**Never** route through `executeCommand(command)`: it does `{{var}}` substitution, audit-logs every call (static wrapper) and mutates `params` (PITFALLS 30).

### Pattern 3: Binding map, cascade and `applyChange` (components/tools/fieldOptions.ts, React-free)
**What:** `(toolType, command, fieldName) -> { source, role }` where `role` is `{ kind: "list" }` or `{ kind: "cascade", side: "source" | "destination", level: "device" | "deck" | "nest" }`. Hand-listed, not derived from proto reflection (PITFALLS 33).

Binding table (field names verified against `commandFields.stack` at `constants.ts:344-378`):

| Command | Field | Source | Role |
|---------|-------|--------|------|
| `transfer`, `get_transfer_estimate` | `robot` | `stack.robots` | list |
| same | `labware_profile` | `stack.labwareProfiles` | list |
| same | `source_device` / `source_deck` / `source_nest` | `stack.devices` | cascade source device/deck/nest |
| same | `destination_device` / `destination_deck` / `destination_nest` | `stack.devices` | cascade destination device/deck/nest |
| same | `source_transfer_profile`, `destination_transfer_profile` | `stack.transferProfiles` | list |
| `get_labware_presence` | `robot` | `stack.robots` | list |
| not bound | `step_key`, `timeout_s`, `refresh` on `list_*`, and the commands `get_manager_state`, `get_robot_states`, `list_*`, `get_failure_latch` | — | — |

Three pure functions carry all behaviour:
- `buildCascadeOptions(tree, side, parentValues)` returns device options, then deck options for the selected device, then nest options for the selected deck, **by position**. Each option is `{ key: "<index path>", deviceName, deckName, nestName, pathKey, ambiguous: boolean }`. The `<option value>` is the plain name (never `unifiedName`); the React key includes the index. Equal values from duplicates are indistinguishable by design (the stored value is only the name; the adapter refuses them anyway).
- `buildSelectView({ mode inputs, value, options, flags })` returns the display model (see Pattern 4).
- `applyChange(binding, currentValues, newValue)` returns a **patch** `Record<string, string>`: the changed field plus, for a device change, `deck` and `nest` of the same side set to `""`; for a deck change, `nest` set to `""`. Never to the first child. `""` is the born-empty value in all three hosts (the tool page effect writes `""`, the modal's `handleSubmit` back-fills `""` for text, the drawer's `editedParams[key] !== undefined` rule lets an explicit `""` override the saved value).

**Ambiguity flag rule (verified against the adapter, see Reply Shapes):** flag a device option if `deviceName` is in `ambiguous`; a deck option if `device/deck` or `device` is in `ambiguous`; a nest option if `device/deck/nest`, `device/deck` or `device` is in `ambiguous`. The adapter's `from_devices` adds every nest under a duplicated deck name (CR-01) and every triple under a duplicated device name to its refusal set but lists only the shorter names, so exact-membership alone under-flags.

### Pattern 4: The four `OptionsSelect` modes (pure view model, thin component)
| Mode | Trigger | Render |
|------|---------|--------|
| `disabled-host` | host passes `enabled: false` (drawer read-only on run page) | the host's existing control, unchanged, zero reads |
| `loading` | `isInitialLoading` (use this, **not** `isLoading`: in react-query v4 a disabled idle query reports `isLoading: true`) | disabled `Select` with placeholder "Loading…"; if the saved value is non-blank show it as the sole option with **no** "(not reported)" flag; the form and Save stay usable |
| `ok` | `data.status === "ok"` and not `isError` | native `Select`, `placeholder=""`, `value` = saved or `""`; offered options sorted as delivered; if saved value is non-blank and no option has `String(option.value) === String(value)` add one extra `<option>` "`<value>` (not reported by instrument)" |
| `unavailable` | `data.status === "unavailable"` **or** `query.isError` | the host's plain text input plus hint "Instrument list unavailable — type the value" |
| `variable-bound` | modal/drawer value `isVariableReference` | picker disabled, variable shown; cascade children become typed inputs with the D-13 hint |

Rules: never set `selected`/`defaultValue`/`options[0]`; blank (`""`, `undefined`) shows no warning; comparison is `String(a) === String(b)` with no trim or case-fold. The status line "from instrument · N items · fetched hh:mm:ss" uses the server `fetchedAt` (the original read time on a cache hit) so a cached list is visibly older.

### Pattern 5: Host integration (current code, with line numbers)
| Host | Where fields render | Value/state API | What to change |
|------|--------------------|-----------------|----------------|
| Tool page `pages/tools/[id].tsx` | `renderFields` at :247; `text` branch at :315 (the `select` branch is :297); `handleInputChange` :207 (functional `setFormValues`); reset effect :88-111 keyed on `[selectedCommand]`; `handleChange` :114 | `formValues[field.name]`, born-empty `""` | Route bound `text` fields to `OptionsSelect`; cascade via one `setFormValues` that applies the `applyChange` patch. Do **not** add `?? ""`, `\|\| 0`, `\|\| "false"` to this file, and do not touch `handleSubmit` (:161) |
| `AddToolCommandModal.tsx` | `renderField` :289; default branch at :465 (`Input flex={1}` + 180 px "No Variable" `Select`); fields loop :852-871; `handleSubmit` :209 back-fills undefined (number 0, boolean false, text_array [], else `""`); `handleVariableSelect` :256; `isVariableReference` :278 | `commandParams` via `setCommandParams({ ...commandParams, [name]: v })` (non-functional, stale-closure style) | Before the `switch`, look up the binding; render `OptionsSelect` in place of the left `Input` inside the same `HStack`, keep the variable `Select`. A cascade change must write all fields in **one** `setCommandParams` call |
| `CommandDetailsDrawer.tsx` | iterates `Object.entries(selectedCommand.commandInfo.params)` at :484 (saved keys, **not** `commandFields`); `renderParameterInput` :210; default branch :425; `handleSaveInputs` :171 merges `{...saved, ...editedParams}`; reset effect :66 keyed on `[selectedCommand, labwareData]` | `editedParams` | Look up the binding by `commandInfo.toolType`, `commandInfo.command` and the param `key`; `enabled: isEditing`. Clearing a child must write `""` (deleting from `editedParams` reverts to the saved value) |

`toolId` passed to `useToolOptions`: tool page `config.name`; modal `selectedToolData?.name`; drawer `selectedCommand.commandInfo.toolId` (stored as the tool **name**; `Tool.lookup` normalises via `normalizeToolKey`). Put `useToolOptions` inside `OptionsSelect` (inside `DrawerBody` / `ModalBody` content, unmounted when closed), not in the host component bodies that stay mounted.

### Pattern 6: Client query and Refresh (hooks/useToolOptions.ts)
```typescript
// Query options per D-05 plus refetchOnReconnect:false ("no other read").
trpc.tool.options.useQuery(
  { toolId, source },
  { enabled: enabled && !!toolId, retry: false, refetchOnWindowFocus: false,
    refetchOnReconnect: false, staleTime: 15_000 },
);
// Refresh (tRPC 10.9 utilsProxy has fetch/setData; it has no utils.client):
const utils = trpc.useContext();
const data = await utils.tool.options.fetch({ toolId, source, refresh: true }, { staleTime: 0 });
utils.tool.options.setData({ toolId, source }, data); // writes the SHARED entry (key without `refresh`)
```
Derive mode from `isError` first: on a failed refetch react-query v4 **keeps the previous `data` while `status` is `error`**, so a hook that only reads `data` would show a stale list. When `isError`, ignore `data` and return `unavailable`. While a Refresh is in flight keep rendering the current list and disable only the Refresh button.

### Anti-Patterns to Avoid
- **Resetting children in an effect keyed on option lists** (D-09): the tool page's effect at :88-111 resets `formValues` on `[selectedCommand]`; do not copy that shape. Put no `useEffect` in `OptionsSelect.tsx` or `useToolOptions.ts` and scan for it.
- **Adding `optionsSource`/`select` to `commandFields.stack`:** breaks the `toStrictEqual` pin and the no-select sweep.
- **Using `getToolFromDB` + `Tool.forId` for reads:** creates a Tool and heartbeat per client-supplied id.
- **Normalising or trimming values:** the saved string must round-trip exactly (DRP-09).
- **Caching failures or serving a cached list after a failed live read:** evict the entry on any failed read.
- **Placing the `options` procedure after `latchStatus` in `routers/tool.ts`.** See Pitfall 7.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reply validation | `typeof` ladders scattered through the parser | `zod` (3.23.8, already used) with `.passthrough()`-tolerant objects that read only the used keys | The adapter emits extra keys and `null`s (`unifiedName: null`, `deviceMarker: null`); schemas must tolerate them and fail only on the fields used |
| Client cache and dedupe | A custom store | react-query keyed `(toolId, source)` | Already dedupes simultaneous mounts and shares between hosts |
| Deadline | A hand-built timer + abort | grpc-js `{ deadline }` call option | Cancels the call; proven by spike |
| Log-injection guard | Custom regex | `sanitizeLogText` (`server/logger.ts`) | Existing, flattens control chars; client-controlled `toolId` goes into log details |
| tool-id matching | New normaliser | `Tool.lookup` / `normalizeToolKey` | One source of truth (`server/toolKey.ts`) |
| Variable-like test | A third regex | the existing predicate `startsWith("{{") && endsWith("}}")` | Identical in `server/tools.ts:433` and both hosts' `isVariableReference`; share one import-free helper and test it equals the run-time check |

**Key insight:** every hard part here is a *policy* (what counts as unavailable, what clears, what flags), not a mechanism. Put policy in import-free modules and test it exhaustively; keep the component and the router thin.

## Reply Shapes (verified at `4ccd3da` and sibling `934a621`)

`meta_data` arrives through `ExecuteCommandReply.meta_data` as a plain JS object. A spike this session round-tripped the golden `deviceTree.json` through the generated `ExecuteCommandReply.encode/decode` (with `null` markers injected) and got: numbers as `number`, `ambiguous` as an array, booleans as booleans, `null` as `null`, a reply with no `meta_data` as `undefined`, an empty Struct as `{}`. `[VERIFIED: spike output; gen-interfaces/google/protobuf/struct.ts:443-458]`

Which replies are SUCCESS (`_SUCCESS_KINDS`, `server.py:302-313`, verbatim): `"managerState", "deviceTree", "robotStates", "labwareProfiles", "transferProfiles", "labwarePresence", "estimated", "failureAcknowledged", "latchStatus", "ran"`. Any other kind (including `readFailed`) is `ERROR_FROM_TOOL` with the one-line message **and** `meta` attached.

Quoted goldens (`stack-automation-layer/tests/golden/`), abbreviated to the keys the parsers read:
- `deviceTree`: `"kind": "deviceTree"`, `"deviceCount": 1`, `devices[].{ "deviceName": "nest-1", "deviceMarker": "nest-one", decks[].{ "deckName": "deck1", "deckMarker": "deck-one", "isCalibrated": true, nests[].{ "nestName": "A1", "unifiedName": "deck1,A1", "type": "Nest", ..., "isCalibrated": true } } }`, `"ambiguous": []`, `"apiVersion": "3"`.
- `robotStates`: `"kind": "robotStates"`, `"robots": [ { "robotName": "stack2-6", "state": "idle" } ]`.
- `labwareProfiles`: `"kind": "labwareProfiles"`, `"profiles": [ { "name": "Default", ... "hasLid": false } ]`.
- `transferProfiles`: `"kind": "transferProfiles"`, `"profiles": [ { "name": "Default", "fields": {...} } ]`.
- `readFailed`: `"kind": "readFailed"`, `"error": { "status": 400, "name": "taskNotFound", ... }`.

The adapter's own `to_dict()` can emit empty names (`_wire_str(raw, "nestName") or ""`) and `None` for optional strings (`unified_name`, `device_marker`), so parsers must drop empty-after-trim names, mark the list degraded, and ignore the `null`s.

**`ambiguous` path-string format** `[VERIFIED: stack_automation_layer/knowledge.py:386-411]`:
```python
ambiguous_names.append(
    f"{device.device_name}/{deck.deck_name}/{nest_name}"
)
...
ambiguous_names.append(f"{device.device_name}/{deck_name}")
...
ambiguous_names.append(device_name)
```
- `device/deck/nest`: a nest name repeated within one deck.
- `device/deck`: a deck name repeated within one device. **All nests under any same-named deck are added to the adapter's `_ambiguous_keys` (CR-01) but are not listed individually.**
- `device`: a device name repeated across top-level rows. **Every triple under it is added to `_ambiguous_keys` but only `device` is listed.**
- A nest name repeated under *different* decks is not ambiguous (the triple includes the deck).
- Names are joined with a bare `/`, so a name containing `/` can collide (`a/b` + `c` vs `a` + `b/c`). Flagging errs toward flagging; that is acceptable because the flag never blocks selection.

**Failure matrix** (what the tool server returns, then what `toolOptions.ts` maps it to; every row ends in `unavailable`, never a throw):

| Condition | Wire evidence | Reason code (suggested) |
|-----------|---------------|-------------------------|
| Tool not in store / wrong type | no send | `not_connected` / `wrong_tool_type` |
| Connection refused / deadline | grpc codes 14 / 4 (spike) | `transport` / `timeout` |
| Configure in progress | `ERROR_FROM_TOOL`, text `_RECONFIGURING_MESSAGE = "stack: reconfiguring"` | `tool_refused` |
| Tool not configured (real mode) | **`NOT_READY`** with `_NOT_CONFIGURED_MESSAGE = "stack: not configured"` (`return _reply(NOT_READY, message=_NOT_CONFIGURED_MESSAGE)`); CONTEXT D-03 words this as an `ERROR_FROM_TOOL` reply, so treat every non-SUCCESS code identically and do not key on the text | `tool_refused` |
| Handler exception | `DRIVER_ERROR` with a one-line message | `tool_refused` |
| `readFailed` kind | `ERROR_FROM_TOOL` + meta | `read_failed` |
| SUCCESS without `meta_data` (this includes **simulated mode**: `base_server.py:138-145` returns `SUCCESS, return_reply=True` with no meta) | `meta_data === undefined` | `no_data` |
| Wrong `kind`, malformed, over a cap | parser | `bad_reply` / `too_large` |
| Valid empty list | `devices: []` etc. | **`ok` with `items: []`** |

grpc-js default max receive message length is 4 MiB `[VERIFIED: constants.js:63]`; a larger reply surfaces as a transport error and maps to `unavailable`, so parser caps must sit well under it.

## Common Pitfalls

### Pitfall 1: Pinning a SHA that GitHub does not have
**What goes wrong:** the gitlink advances to `4ccd3da`, which only exists in `/home/formulatrix/data/nikko/galago-tools` (local `feat/stack-tool` is "ahead 95" of `origin`, and GitHub's `feat/stack-tool` is `9592509`). A fresh `git submodule update --init` from `.gitmodules`' GitHub URL cannot fetch it.
**Why:** `git -C vendor/galago-tools remote -v` shows the submodule's origin is the local path; `.gitmodules` shows the GitHub URL. `[VERIFIED: git ls-remote https://github.com/nikkopg/galago-tools.git and git branch -vv this session]`
**How to avoid:** make the first plan include a human-action step: the user pushes `feat/stack-tool` from the galago-tools clone, then `git ls-remote https://github.com/nikkopg/galago-tools.git feat/stack-tool` must print `4ccd3da656c0e981332018b3d33e16148a8bc513`. Do not push on the user's behalf. The regen gate itself does not depend on the push.
**Warning signs:** `git submodule update --init` on another machine fails with "not our ref".

### Pitfall 2: Stale list shown after a failed refetch
**What goes wrong:** react-query v4 keeps the last `data` when a refetch errors. A hook that renders from `data` shows the old list while the instrument is down (violates DRP-04).
**How to avoid:** mode derivation checks `isError` first; server evicts the cache entry on any failed live read; `unavailable` results are never cached (only `ok`), so recovery is immediate.

### Pitfall 3: Under-flagging ambiguity
**What goes wrong:** exact-membership flagging misses nests under a duplicated deck and triples under a duplicated device because the adapter lists only the shorter path.
**How to avoid:** prefix rule in Pattern 3; fixtures for duplicate device, duplicate deck, duplicate nest in one deck, same nest name under different decks (not ambiguous), and names containing `/`.

### Pitfall 4: A list change silently rewrites a value
**What goes wrong:** an effect that "keeps children valid" clears a hydrated saved value on first load or on Refresh (DRP-02/05).
**How to avoid:** the structural rule in the Summary. Option building and `buildSelectView` return display data only; `applyChange` is the single patch producer. Scan `OptionsSelect.tsx` and `useToolOptions.ts` for `useEffect|useLayoutEffect` (none allowed).

### Pitfall 5: Changing what is sent
**What goes wrong:** the modal's `handleSubmit` back-fills `""` for untouched text fields and `0` for numbers (`AddToolCommandModal.tsx:209-229`); a dropdown that writes `undefined` or a placeholder string changes saved params. The drawer's `handleSaveInputs` merges only edited keys.
**How to avoid:** the dropdown writes the plain string or `""`; no submit path is edited; a hydrated-but-untouched step produces byte-identical params. Note `timeout_s` is a `number` field and keeps its current behaviour (the modal's NumberInput paints `0`); it is out of scope.

### Pitfall 6: "Not reported" noise
**What goes wrong:** old saved steps carry `""` for unset STACK fields; flagging them as "not reported" is noise.
**How to avoid:** blank counts as "not chosen"; flag only a non-blank value absent from a **successfully loaded** list; never when `unavailable` or `loading`.

### Pitfall 7: Existing tests that pin source text
- `test/toolPageReply.test.ts` (born-empty block): `expect(src).not.toContain('|| "false"')`, `not.toContain("|| 0")`, `(src.match(/\?\? ""/g) ?? []).length).toBe(2)`, and a regex over `params: String(config?.type) === "stack" ? omitBlankParams( coerceBooleanParams( formValues ... ) : formValues`; also `setLastReply(` exactly once. **New logic must not add `?? ""` or `|| 0` to `pages/tools/[id].tsx`.** Put it in `fieldOptions.ts` / `OptionsSelect.tsx`, or deliberately update the pin in the same plan.
- `test/latchStatus.test.ts:243-251`: `source.slice(source.indexOf("latchStatus: procedure"))` must contain `LATCH_READ_COMMAND` and must not contain `controlCommand` or `zToolType`. Declare `options: procedure` **above** `latchStatus` and keep both strings out of any code added after it.
- `test/staticScan.test.ts:648-662`: `acknowledge_failure` may appear in exactly four files across `components/`, `hooks/`, `pages/`, `server/`; none of the new files may contain that literal.
- `test/staticScan.test.ts:251-269`: `.controlCommand(` has exactly two server callers and one definition file; name the new method anything but `controlCommand` and never call it from the queue.
- `test/commandFields.test.ts`: `commandFields.stack.transfer` is pinned with `toStrictEqual`, and every stack field must have no `defaultValue` and no `select` type.

### Pitfall 8: `react` is not importable under vitest
**What goes wrong:** a test (or a module it imports) that imports `react` fails to load, because `tsconfig.json` `paths` maps `react` to `@types/react/index.d.ts`. `[VERIFIED: spike this session]`
**How to avoid:** `fieldOptions.ts`, `toolOptions.ts`, `utils/variableRef.ts` and fixtures import no React (`import type` only). `OptionsSelect.tsx` and the hook are covered by source scans and UAT. Do not edit `vitest.config.mts`.

### Pitfall 9: Native select with an unlisted value
**What goes wrong:** `<select value="x">` with no matching `<option>` shows blank and the saved value looks cleared.
**How to avoid:** the extra "(not reported by instrument)" `<option>` rule, added only when the list loaded and the value is non-blank.

### Pitfall 10: Pre-existing host resets
The modal's effect at `AddToolCommandModal.tsx:123` resets `commandParams` when `labwareData` changes, and the drawer's effect at `CommandDetailsDrawer.tsx:66` resets `editedParams` when `selectedCommand` or `labwareData` changes. They are not caused by this phase and `labwareData` is stable under react-query structural sharing, so leave them. Do not add `tool.options` data to those dependency arrays.

### Pitfall 11: Simulated or unconfigured STACK in UAT
A simulated STACK returns SUCCESS with no `meta_data` for every read, so dropdowns show the typed-input fallback and the hint. That is correct behaviour. Plan one UAT item against a configured (real or PAC-simulated) STACK and cover the rest with fixtures.

### Pitfall 12: Log flooding on a down instrument
Failures are logged (D-01) and failed reads are not cached, so a down instrument plus repeated unauthenticated queries could write one audit row per call. Throttle failure logging per `(tool, source, reason)` (for example one row per 60 s) and run `sanitizeLogText` over the whole details string.

## Code Examples

### Strict parser skeleton (server/toolOptions.ts)
```typescript
// Source: reply shapes quoted above; names kept verbatim, only blank-after-trim and variable-like names dropped.
const MAX_NAME_LENGTH = 256;        // [ASSUMED] discretion value, test at 256 and 257
const MAX_LIST_ITEMS = 1000;        // [ASSUMED] discretion value, test at 1000 and 1001
const MAX_TREE_NODES = 10_000;      // [ASSUMED] total devices+decks+nests, test at the boundary

function usableName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (v.trim().length === 0 || v.length > MAX_NAME_LENGTH) return null;
  if (isVariableLike(v) || isVariableLike(v.trim())) return null; // same predicate as server/tools.ts:433
  return v; // verbatim, never trimmed (D-11)
}
// A dropped name sets degraded=true; an over-cap array returns unavailable("too_large"); wrong kind -> "bad_reply".
// Read only known keys by explicit property access; never spread or merge reply objects.
```

### Cache and generation (server/toolOptions.ts)
```typescript
// Key: `${normalizeToolKey(toolId)}|${generation}|${source}`. Cache only status "ok". TTL 15_000 ms, injectable clock.
// refresh=true: skip cache read; in-flight key gets a ":refresh" suffix so a refresh never joins a non-refresh read;
// on success store under the normal key. On ANY failed live read: delete the normal key.
// Generation: per-tool counter plus a global epoch; bump in a `finally` AFTER configure/edit/delete finish,
// and a global bump in clearToolStore, so a read started before the change can never be served after it.
```

### Router procedure (server/routers/tool.ts, declare before latchStatus)
```typescript
// Input is exactly this; no command, no params, no toolType key (D-02, scan D-17).
options: procedure
  .input(z.object({ toolId: z.string().max(200), source: z.enum(OPTION_SOURCE_IDS), refresh: z.boolean().optional() }))
  .query(({ input }) => fetchOptions(input.toolId, input.source, input.refresh === true)),
```
`z.string().max(200)` on `toolId` is a recommendation (bounded log text); `[ASSUMED]` value.

## Re-pin and regen procedure (STK-08, D-16)

**Facts:** `git diff --stat bcbbf8e 4ccd3da -- interfaces/` (run inside `vendor/galago-tools`) prints nothing, and `9592509..4ccd3da` is 95 commits with an empty `interfaces/` diff. `[VERIFIED: git diff this session]` The submodule is clean at detached `bcbbf8e`. The gitlink currently reads `160000 commit bcbbf8e245877dc77dbdaaa1e5d18a768dffa8f8 vendor/galago-tools`. `.gitmodules` already has `branch = feat/stack-tool`; do not edit it and never use `--remote`. `interfaces` at the repo root is a symlink to `vendor/galago-tools/interfaces`.

**Zero-mutation proof (done this session, repeat it as the gate):** export the proto tree at the target SHA, regen into a scratch directory, `diff -r` against the committed output.
```bash
S=<scratchpad>; mkdir -p "$S/regen" "$S/proto4ccd"
git -C vendor/galago-tools archive 4ccd3da interfaces | tar -x -C "$S/proto4ccd"
/tmp/opencode/proto-venv/bin/python -m grpc_tools.protoc -I="$S/proto4ccd/interfaces/" \
  --plugin=protoc-gen-ts_proto=/tmp/opencode/tsproto-1511/node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out="$S/regen/" --ts_proto_opt=stringEnums=true --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=snakeToCamel=false --ts_proto_opt=outputServices=grpc-js \
  "$S"/proto4ccd/interfaces/*.proto "$S"/proto4ccd/interfaces/tools/grpc_interfaces/*.proto
diff -r "$S/regen" controller/gen-interfaces && echo "NO DIFF"
```
Result this session with the existing toolchain: `NO DIFF`. `[VERIFIED: command output]`

**Then pin and verify in-repo:**
```bash
git -C vendor/galago-tools checkout --detach 4ccd3da          # SHA, never --remote
git add vendor/galago-tools
# in-repo regen is optional once the scratch diff is empty; if run, use the same command with
#   -I=interfaces/ ... --ts_proto_out=./controller/gen-interfaces/ ... interfaces/*.proto interfaces/tools/grpc_interfaces/*.proto
git diff --exit-code -- controller/gen-interfaces             # must exit 0
git diff --cached --stat                                      # must list ONLY the vendor/galago-tools gitlink
git -C vendor/galago-tools rev-parse HEAD                      # 4ccd3da656c0e981332018b3d33e16148a8bc513
```
Do not use `bin/make proto` (its `clean_proto` also removes `tools/*_pb2*.py*`) and do not use `bin/make proto_ts` as-is: it resolves `protoc-gen-ts_proto` from PATH, and `bin/make:3` hard-codes a Windows-style path. If the toolchain is gone, recreate it: `python3 -m venv <dir>/proto-venv && <dir>/proto-venv/bin/pip install grpcio-tools==1.85.1` and `(cd <dir>/tsproto-1511 && npm install ts-proto@1.151.1)` (gate each install with a `checkpoint:human-verify` per the Package Legitimacy note). If the regen ever produces a diff, stop and record it; never commit the churn.

## Validation Architecture

> Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9, `environment: "node"`, no jsdom |
| Config file | `controller/vitest.config.mts` (`include: ["test/**/*.test.ts"]`, `setupFiles: ["test/setup.ts"]`, `clearMocks: true`) |
| Quick run command | `cd controller && npx vitest run test/toolOptions.parse.test.ts test/toolOptions.read.test.ts test/toolOptionsRouter.test.ts test/fieldOptions.test.ts test/staticScan.test.ts test/commandFields.test.ts test/latchStatus.test.ts test/toolPageReply.test.ts` (a four-file subset of these, `staticScan`, `commandFields`, `latchStatus`, `commandParams`, ran in 1.6 s this session) |
| Full suite command | `cd controller && npx tsc --noEmit && npx vitest run && npx prettier . --check` |
| Measured baseline | 28 files / 610 tests pass in about 191 s (queue tests dominate); `tsc --noEmit` exit 0 in about 9 s; `prettier . --check` clean in about 4 s |
| Note | `bin/make test_ts` also runs `tsc --build --clean`; run `npm run build` once before the phase closes (an eslint-disable naming an unknown rule breaks `next build`, PROJECT decision) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DRP-01 | Born-empty: view model has no selected value; no `options[0]`/`defaultValue`/`selected` in `OptionsSelect.tsx` | unit + scan | `npx vitest run test/fieldOptions.test.ts test/staticScan.test.ts` | ❌ Wave 0 / extend |
| DRP-02 | Unlisted non-blank value yields extra "(not reported by instrument)" option; blank yields none; not flagged while `loading`/`unavailable` | unit | `npx vitest run test/fieldOptions.test.ts` | ❌ Wave 0 |
| DRP-03 | `isVariableReference` value gives `variable-bound` mode; parent bound gives child typed inputs | unit | `npx vitest run test/fieldOptions.test.ts` | ❌ Wave 0 |
| DRP-04 | Every failure-matrix row yields `unavailable`; failed read evicts cache; `isError` beats stale data (hook mode derivation is a pure fn) | unit | `npx vitest run test/toolOptions.read.test.ts test/fieldOptions.test.ts` | ❌ Wave 0 |
| DRP-05 | `applyChange` clears children to `""`; no `useEffect` in `OptionsSelect.tsx`/`useToolOptions.ts`; hydrate then list refresh yields no patch | unit + scan | `npx vitest run test/fieldOptions.test.ts test/staticScan.test.ts` | ❌ Wave 0 / extend |
| DRP-06 | `refresh: true` reaches the fake gRPC as `{ refresh: true }` for `list_*`, never for `get_robot_states`; refresh bypasses cache, has its own in-flight key | unit | `npx vitest run test/toolOptions.read.test.ts` | ❌ Wave 0 |
| DRP-07 | Closed enum; schema rejects `command`/`params`; deadline option passed (`expect.objectContaining({ deadline: expect.any(Number) })` with a `grpc.Metadata` instance); no audit row per read; caps at boundary (N and N+1, name length); `{{x}}` dropped + degraded; `toolOptions.ts` imports no `command_queue`; sole caller of the read method | unit + scan | `npx vitest run test/toolOptions.parse.test.ts test/toolOptions.read.test.ts test/toolOptionsRouter.test.ts test/staticScan.test.ts` | ❌ Wave 0 / extend |
| DRP-08 | Binding lookup works from saved `commandInfo.toolType/command/key`; drawer host passes `enabled: isEditing` (source scan) | unit + scan | `npx vitest run test/fieldOptions.test.ts test/staticScan.test.ts` | ❌ Wave 0 |
| DRP-09 | Round trip: hydrate a step with an unlisted value, no operator change, saved params `toStrictEqual` the original; encoded `Command` bytes for a dropdown-chosen value equal those for the typed value (`tool_base.Command.encode` as in `test/wire.test.ts`) | unit | `npx vitest run test/fieldOptions.test.ts test/wire.test.ts` | ❌ Wave 0 |
| STK-01..06 | One fixture per source through `parseX`; binding table per field | unit | `npx vitest run test/toolOptions.parse.test.ts test/fieldOptions.test.ts` | ❌ Wave 0 |
| STK-02/04 | Cascade by position; duplicate device, duplicate deck, duplicate nest in one deck, same nest under different decks (not ambiguous), names containing `/`; prefix propagation | unit | `npx vitest run test/fieldOptions.test.ts` | ❌ Wave 0 |
| STK-03 | `isCalibrated !== true` hidden; device with no calibrated deck still offered with an empty deck list (not `unavailable`); saved uncalibrated kept | unit | `npx vitest run test/fieldOptions.test.ts` | ❌ Wave 0 |
| STK-07 | Binding map has no `step_key`, `timeout_s`, `refresh`; every bound field exists in `commandFields.stack`; `commandFields.test.ts` unchanged and green | unit | `npx vitest run test/fieldOptions.test.ts test/commandFields.test.ts` | ❌ Wave 0 (plus existing ✅) |
| STK-08 | `git -C vendor/galago-tools rev-parse HEAD` equals `4ccd3da656c0e981332018b3d33e16148a8bc513`; `git diff --exit-code -- controller/gen-interfaces`; scratch `diff -r` empty | shell gate | commands in "Re-pin and regen procedure" | n/a (command gate) |

### Sampling Rate
- **Per task commit:** the Quick run command above (seconds).
- **Per wave merge:** `cd controller && npx tsc --noEmit && npx vitest run` (about 3.5 min).
- **Phase gate:** full suite plus `npx prettier . --check` green, `npm run build` once, and the STK-08 shell gate, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `controller/test/fixtures/stackOptions.ts` — golden-derived fixtures (deviceTree with duplicate device / deck / nest, names with `/`, `null` markers, uncalibrated nodes; robotStates; labwareProfiles; transferProfiles; readFailed). Copy values; never import from the sibling repo.
- [ ] `controller/test/toolOptions.parse.test.ts` — parsers and caps (DRP-04/07, STK-01..06).
- [ ] `controller/test/toolOptions.read.test.ts` — `readOptions`, cache, generation, dedupe, refresh (DRP-04/06/07); uses `installFakeTool("stack-1", ToolType.stack)` from `test/helpers/fakeTool.ts`.
- [ ] `controller/test/toolOptionsRouter.test.ts` — clone the `latchStatus.test.ts` harness (it mocks `@/db/helpers` and calls `toolRouter.createCaller({})`); assert the input schema accepts no `command`/`params`.
- [ ] `controller/test/fieldOptions.test.ts` — binding, cascade, flags, `applyChange`, round trip (DRP-01..05, 08, 09, STK-02..04, 07).
- [ ] Extend `controller/test/staticScan.test.ts` with the D-17 scans plus: no `useEffect|useLayoutEffect` in `OptionsSelect.tsx` and `useToolOptions.ts`; no `acknowledge_failure` in new files (the existing four-file pin already enforces it); `options: procedure` appears before `latchStatus: procedure` in `routers/tool.ts`.
- [ ] Framework install: none.

## Security Domain

> `security_enforcement: true`, ASVS level 1, block on `high`. The tRPC router has no authentication anywhere in this project; that is the standing posture, not something this phase introduces.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no (project has none) | out of scope; no new auth surface |
| V3 Session Management | no | — |
| V4 Access Control | partial | closed `z.enum` source set and a server-side tool-type check stand in for per-endpoint authorization; the client can never name a command |
| V5 Input Validation | yes | `zod` enum + bounded `toolId`; strict reply parsers with explicit caps; names compared verbatim |
| V6 Cryptography | no | — |
| V7 Error Handling and Logging | yes | closed reason codes (no raw error text to the client); `sanitizeLogText` over log details; throttled failure logging |
| V12 Files / V13 API | partial | reply size caps; grpc 4 MiB receive limit; deadline on every read |

### Known Threat Patterns for this stack (for the plans' `<threat_model>`)
| ID | Pattern | STRIDE | Standard Mitigation |
|----|---------|--------|---------------------|
| T-06-01 | Client crafts `tool.options` to send an arbitrary command or params to an instrument | Tampering / Elevation | closed enum; fixed command and params inside the registry; scan that the input schema has no `command`/`params`; sole caller of `readOptions` is `toolOptions.ts` |
| T-06-02 | A non-stack `toolId` receives a stack-shaped payload | Tampering | registry `toolType` check against `String(tool.type)` before sending; payload built from the registry type |
| T-06-03 | Instrument name `{{x}}` is later substituted at run time (variable read/rewrite) | Tampering | drop and mark degraded using the same predicate as `server/tools.ts:433`; never escape into a value |
| T-06-04 | Refresh spam from an unauthenticated caller reloads the STACK manager's knowledge repeatedly | Denial of Service | in-flight dedupe applies to refresh as well; a short minimum interval between refreshes per key (recommended, `[ASSUMED]` value); 5 s deadline; reads bypass the BUSY gate so they cannot stall motion |
| T-06-05 | Oversized or hostile reply exhausts memory or the render | Denial of Service | array, node and string caps as exported constants tested at the boundary; over-cap means `unavailable("too_large")`, never truncation |
| T-06-06 | Audit-log flooding or log forging via `toolId` and repeated failures | Repudiation / Tampering | `sanitizeLogText` on the full details string; bounded `toolId`; per-key throttle |
| T-06-07 | Raw exception or tool text leaks internals to the browser | Information Disclosure | only a closed reason code is returned; detail goes to the server log only |
| T-06-08 | Instrument topology (robot, device, deck, nest names) readable by any network caller | Information Disclosure | accepted: same exposure as `tool.info` and `tool.getAll`; no new class of data |
| T-06-09 | Prototype pollution from a hostile Struct key | Tampering | parsers read only named keys by explicit access; never spread or `Object.assign` reply objects |
| T-06-10 | Operator selects an ambiguous location and the wrong physical place is addressed | Tampering (integrity) | flag-only per D-08; the adapter's `location()` refuses ambiguous triples (`knowledge.py:446-456`); never first-match |
| T-06-11 | Wrong ts-proto plugin or protoc produces broken or churned generated types | Tampering | explicit `--plugin=` to 1.151.1; scratch `diff -r` gate; `tsc --noEmit` after pin |
| T-06-12 | Stale or unreproducible submodule pin | Integrity | human push of `4ccd3da`, then `git ls-remote` check (Pitfall 1) |

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text STACK fields (v1.1 Phase 5) | Instrument-fed dropdowns with typed-input fallback | this phase | operators pick reported values; saved protocols unchanged |
| `latchStatus`-style read via `getToolFromDB` + `Tool.forId` + instance `executeCommand` | dedicated `readOptions` via `Tool.lookup` with a deadline | this phase (D-01) | no Tool/heartbeat creation for client ids, no audit row per read, no substitution |

**Deprecated/outdated:** the wording of DRP-07 in `REQUIREMENTS.md` ("using the instance `Tool.executeCommand` with a deadline") predates D-01, which locks a dedicated method that never touches `executeCommand(command)`. The dedicated method satisfies DRP-07's intent (instance, deadline, no queue, no polling). Record that in the plan's traceability so a verifier does not fail DRP-07 on the literal wording.

## Runtime State Inventory

Not a rename/refactor/migration phase. The one runtime state worth stating: **no persisted data changes.** Saved protocol rows keep their exact params (DRP-09); `commandFields.stack` is untouched; the server cache and generation counters are in-memory and reset on process restart. None found in: stored data, live service config, OS-registered state, secrets/env vars (no new env var), build artifacts (the regen produces no diff). Verified by the zero-diff regen and by the decision that no schema or `SqliteQueue` change is made.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cap values `MAX_NAME_LENGTH` 256, `MAX_LIST_ITEMS` 1000, `MAX_TREE_NODES` 10_000 are suitable | Code Examples | Too low would hide a legitimately large lab as `unavailable`; the planner may choose others (CONTEXT lists caps as discretion). Boundary tests protect whatever is chosen |
| A2 | A minimum interval between refreshes per key (about 1-2 s) is worth adding | Security T-06-04 | If omitted, an unauthenticated caller can spam adapter reloads; low impact on a trusted LAN |
| A3 | `z.string().max(200)` on `toolId` | Code Examples | A longer legitimate tool name would be rejected; tool names are short in this project |
| A4 | Module-level cache and generation state are shared by `tool.options` and the configure/edit/delete routes because both live in the one tRPC route bundle | Pattern 1 | If Next bundled them separately, the generation bump would not reach the cache; mitigate by keying state on `globalThis` like `__global_tool_store` (`server/tools.ts:34-40`) |
| A5 | Name rule "non-empty after trim, kept verbatim" is the intended reading of D-03's "non-empty trimmed string" | Pattern 1 / parser | If CONTEXT meant "equals its own trim", a padded legitimate name would be dropped; confirm with the user (Open Question 3) |
| A6 | Reinstalling the regen toolchain (only if `/tmp/opencode` is gone) needs a human-verify checkpoint | Package Legitimacy | None if the toolchain still exists |
| A7 | Chakra `Modal`/`Drawer` unmount their children when closed, so `useToolOptions` inside `OptionsSelect` is not active while closed | Pattern 5 | If children stayed mounted, reads could fire while closed; mitigate by also passing `enabled: isOpen` from the host |

## Open Questions

1. **Deck-level ambiguity propagation (D-08 vs adapter).**
   - What we know: the adapter refuses every nest under a duplicated deck name and every triple under a duplicated device name, but only lists `device/deck` and `device`.
   - What's unclear: D-08 only states device-level propagation.
   - Recommendation: implement the prefix rule (flag nests under an ambiguous deck as well). It is flag-only and matches `knowledge.py`, so it cannot over-block.

2. **Loading-mode rendering.**
   - What we know: D-11 ships a `loading` mode but does not say what it renders.
   - Recommendation: disabled `Select` with "Loading…", saved value shown without a flag, form never blocked; the 5 s deadline and fast connection-refused (4 ms in the spike) bound it.

3. **"Non-empty trimmed string" (D-03).**
   - Recommendation: reject names that are empty after `trim()`, keep valid names verbatim (D-11 forbids normalising). Ask the user only if a padded real name is plausible.

4. **`4ccd3da` push.**
   - What we know: GitHub's `feat/stack-tool` is `9592509`; local is 95 commits ahead.
   - Recommendation: a `checkpoint:human-action` early in plan 1 for the user to push, followed by the `git ls-remote` verification. The phase can proceed locally in the meantime.

5. **DRP-07 wording drift.**
   - Recommendation: note in plan traceability that D-01's dedicated method satisfies DRP-07; optionally amend the requirement text.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tsc, vitest, regen plugin | ✓ | v24.14.1 (Docker builder is node 22.11 per STACK.md) | — |
| npm | scripts | ✓ | 11.11.0 | — |
| git + submodule `vendor/galago-tools` | STK-08 | ✓ | clean, detached at `bcbbf8e`; `4ccd3da` present locally | — |
| ts-proto 1.151.1 (scratch) | regen | ✓ | `/tmp/opencode/tsproto-1511/node_modules/.bin/protoc-gen-ts_proto`, package.json `"version": "1.151.1"` | reinstall in a new scratch dir (human-verify gate) |
| grpcio-tools venv | regen | ✓ | 1.85.1 at `/tmp/opencode/proto-venv` (protobuf 7.36.2) | recreate the venv |
| `protoc` on PATH | not needed | `/home/formulatrix/miniconda3/bin/protoc` exists | — | do not use it; the venv's `grpc_tools.protoc` is the proven path |
| `python3` system | not needed | ✓ but has no `grpc_tools` | — | use the venv python |
| `../stack-automation-layer` (read-only reference) | fixtures | ✓ | `934a621` | goldens are copied into `test/fixtures` |
| GitHub reachability | pin verification | ✓ (`git ls-remote` works) | `feat/stack-tool` = `9592509` | — |
| Real or PAC-simulated STACK | one UAT item | not probed (stack-mcp and fast-mcp MCP servers failed to connect this session) | — | fixtures cover all logic; mark the UAT item as live-only |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** a live STACK for the one UAT check (everything else is fixture-covered).

## Sources

### Primary (HIGH confidence)
- Repo files read this session: `controller/server/tools.ts`, `server/routers/tool.ts`, `server/utils/promisifyGrpcCall.ts`, `server/toolReply.ts`, `server/logger.ts`, `server/trpc.ts`, `pages/tools/[id].tsx`, `components/protocols/AddToolCommandModal.tsx`, `components/protocols/CommandDetailsDrawer.tsx`, `components/tools/constants.ts`, `components/tools/commandParams.ts`, `components/runs/list/SwimLaneComponent.tsx` usage, `test/staticScan.test.ts`, `test/commandFields.test.ts`, `test/latchStatus.test.ts`, `test/toolPageReply.test.ts`, `test/helpers/fakeTool.ts`, `test/setup.ts`, `vitest.config.mts`, `tsconfig.json`, `bin/make`, `.gitmodules`, `.prettierrc`.
- `vendor/galago-tools` at `4ccd3da`: `interfaces/tools/grpc_interfaces/stack.proto`, `tools/stack/server.py` (`READ_COMMANDS` :142, `_SUCCESS_KINDS` :302, `_reply` :445, `_result_reply` :688, `ExecuteCommand` override :950, `_dispatchCommand` :990), `tools/base_server.py` (simulated path :138-145).
- `stack-automation-layer` at `934a621`: `knowledge.py` (ambiguity construction :343-416, `location`/`is_ambiguous` :446-464), `results.py` (`DeviceTree`, `RobotStates`, `LabwareProfiles`, `TransferProfiles`), `tests/golden/{deviceTree,robotStates,labwareProfiles,transferProfiles,readFailed}.json`.
- Spikes this session: scratch regen with `diff -r` (no diff); grpc-js deadline and argument-form spike; Struct codec round trip; React-import failure under vitest.
- `.planning/` milestone research: `SUMMARY.md`, `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `FEATURES.md`; Phase 5 `05-RESEARCH.md` and `05-01-SUMMARY.md` (regen recipe).

### Secondary (MEDIUM confidence)
- npm registry `npm view ts-proto@1.151.1 version` (version string confirmed).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new packages, versions read from `node_modules`.
- Architecture: HIGH, integration points read with line numbers; patterns follow the repo's own `controlCommand`/`latchStatus`/`useRunControl` precedents.
- Reply shapes and ambiguity: HIGH for the adapter at `934a621` and `4ccd3da`; MEDIUM for live PAC drift (the adapter normalises casing; parsers should tolerate extra keys).
- Pitfalls: HIGH, the test-pin and tsconfig/react findings were reproduced.
- Re-pin: HIGH for the zero-diff proof; the GitHub-reachability gap is a verified fact that needs a human action.

**Research date:** 2026-11-05
**Valid until:** 2026-12-05 for the repo-local facts (they change only with commits to the files cited); re-check `git ls-remote` for `4ccd3da` at plan time.
