# Phase 7: F.A.S.T. Plate Dropdowns - Research

**Researched:** 2026-11-12
**Domain:** Next.js 13 / Chakra UI 2.8.2 form layer on top of the Phase 6 tool-options plumbing; gRPC proto codegen gate (ts-proto 1.151.1); a React-free well-grid geometry core with a pointer-event component on top.
**Confidence:** HIGH for the controller-side work (all read in this session); MEDIUM for the gated part (the frozen `get_plates` does not exist yet, so its reply shape is the contract's, not a frozen commit's).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Phase 6 decisions D-01..D-17 (`06-CONTEXT.md`) carry over unchanged unless a decision below says
otherwise. That covers the read path, the closed registry, never-throw `unavailable`, the TTL cache
with configure generation, react-query settings, the `OptionsSelect` modes, the variable picker, the
drawer reading only while `isEditing`, and the static scans. Settle-in-discuss items D6, D10 and D11
are therefore inherited as-is.

**Gate and wave order (PLT-01, PLT-02)**
- **D-01:** As of 2026-11-12, galago-tools `origin/feat/stack-tool` has **no** `get_plates`. Its tip is
  still `4ccd3da`. The phase splits into two parts:
  - **Ungated part:** decks (PLT-06), the tip-reuse checkbox (PLT-07) and the React-free well-picker
    geometry core (grid math, label codec, fit and mismatch checks, field <-> selection sync). The
    geometry core is tested against fixture plates. This part lands first.
  - **Gated part:** the re-pin, the `fast.plates` source, the plate dropdowns and the wiring of the
    grids to real plates. It starts with a blocking gate task.

  The gate task checks four things:
  1. The frozen galago-tools commit exists.
  2. Its proto diff from `4ccd3da` is exactly `GetPlates` plus `get_plates = 11`, with
     `Transfer.expected_tray_id = 13` unchanged.
  3. Its test calls `get_plates` through `ExecuteCommand` during a Transfer.
  4. The ts-proto 1.151.1 scratch-dir regen (Phase 5 D-02 and Phase 6 D-16) produces only that diff
     in `controller/gen-interfaces`.

  If any check fails, stop and record a note. Never stub `fast.plates` and never pin to an unfrozen
  SHA. - **Reversibility:** reversible: the change is a submodule pointer.
- **D-02:** galago-core does not add the galago-tools adapter work. The contract
  (`research/FAST-GET-PLATES-CONTRACT.md`) is the hand-off. Building `get_plates` is a galago-tools
  task. If the user asks for it in this session, it goes to its own session in that repo.

**`get_plates` reply and the `fast.plates` parser (PLT-03, PLT-04)**
- **D-03:** Adopt the contract's reply shape exactly: `meta_data.plates[]` with `id`, `description`,
  `rowCount`, `colCount` and `workingCapacity`. The contract's two open points are settled as follows:
  - **Offline:** show the plain typed input and the hint (D6, already locked by DRP-04). Never show a
    stale list.
  - **`refresh`:** keep the proto field. The Refresh button sends `refresh: true` and also skips the
    server cache (Phase 6 D-04).

  If the frozen commit's shape differs from the contract, the frozen commit wins. The gate task
  records the difference, and the parser follows the frozen commit.
- **D-04:** Per-entry validation drops a bad entry and marks the list degraded (the Phase 6 D-03
  pattern). It never truncates and never repairs.
  - **`id`:** `Number.isInteger(id) && id >= 1` and within int32. Anything else is dropped. An id of
    12.7 is never offered as 12.
  - **`description`:** a string, capped. It may be empty, in which case the label shows only the id.
  - **`rowCount` / `colCount`:** integers from 1 to a cap (planner's constant, at least 32 x 48).
    Missing or invalid geometry keeps the plate **selectable** but makes it "unknown geometry". The
    grid is then hidden for that plate (PLT-09), and its typed fields are used instead.
  - **Order:** keep the reply's order. Do not re-sort.
  - **Empty list:** `plates: []` is `ok` with no items, not `unavailable`.
- **D-05:** Duplicate ids are flagged, never collapsed (the Phase 6 D-08 pattern). Every entry that
  shares an id is shown with the label suffix "(duplicate id - check instrument)" and stays
  selectable. The grid for a duplicated id uses the geometry only when all duplicates agree.
  Otherwise the grid is hidden as "unknown geometry".
- **D-06:** The label is `"{id} · {description}"`, the same as the mockup ("12 · Greiner 96 flat").
  The value is the numeric id. The control compares values with `String(a) === String(b)` (Phase 6
  D-11) and writes a **number** to params, so the wire type matches today's typed `number` input. A
  saved id that is not reported is kept and marked "(not reported by instrument)" (DRP-02).

**Unset never becomes 0 (PLT-04)**
- **D-07:** `AddToolCommandModal.handleSubmit` currently fills every unset `number` field with `0`
  (`AddToolCommandModal.tsx:~218`). That fill-in would turn an unset plate into plate `0`. This is a
  narrow, PLT-04-mandated exception to Phase 6 D-15: for the F.A.S.T. transfer fields that the binding
  map marks as "no-zero-fill" (both plate ids and both decks), an unset value is saved as `""`, never
  `0`. Every other field keeps today's fill-in. Saving is not blocked. The tool server stays the final
  check, and it refuses a plate or deck below 1 with a clear message. A test saves a step with
  untouched plate and deck fields and checks that none of them is `0`. The same rule applies to the
  tool-page and drawer submit paths if they have an equivalent fill-in. - **Reversibility:**
  reversible: it changes only newly saved steps, and existing rows are not rewritten.

**Decks (PLT-06)**
- **D-08:** Deck fields get a static option list from the binding map: a new `{ kind: "static" }` role
  with options 1-6 taken from one constant that mirrors `_DECK_SLOTS = 6`, with a comment citing
  `tools/fast/server.py:129`. The constant must not be hard-coded twice. Deck fields have no read, no
  Refresh and no status line. They render through the same native `Select` with an empty placeholder,
  so nothing is preselected. They write a number. A saved value outside 1-6 (or non-numeric) is kept
  verbatim and marked "(not a deck slot 1-6)". `{{variable}}` binding works as in Phase 6 D-13.
  `commandFields.fast` stays as is (`type: "number"`), because the binding map decides how the field
  renders (D-10 precedent). This part is ungated.

**Tip reuse (PLT-07)**
- **D-09:** `tip_reuse` renders as a "Reuse tips" checkbox through a binding-map override
  (`{ kind: "checkbox", checked: "reuse", unchecked: "fresh" }`). The `commandFields.fast.transfer`
  entry and its `toStrictEqual` pin (`test/commandFields.test.ts:7`) are **unchanged**. The one
  allowed default is written into params when the form initialises a **new** step (`tip_reuse:
  "reuse"`), so the visible checked box and the value sent are always the same. Opening a saved step
  never writes a value. The checkbox maps saved values as follows:

  | Saved value | Checkbox shows |
  |---|---|
  | `"reuse"` | checked |
  | `"fresh"` | unchecked |
  | blank or any other string | indeterminate, with the flag "(saved value '{v}' - not reuse/fresh)" |

  The saved value is kept verbatim until the operator clicks, and a click then writes `reuse` or
  `fresh`. A `{{variable}}` shows the variable and disables the checkbox. This part is ungated.

**Well picker (PLT-08, PLT-09)**
- **D-10:** Build a new `WellPicker` component on pointer events, following the approved mockup
  (`research/PLT-08-WELL-PICKER-MOCKUP.html`). It does **not** reuse `components/ui/PlateGrid.tsx`,
  which is driven by a plate-type string, warns and falls back to 96, and has only per-well click
  handlers with no drag or footprint. The new component borrows only that file's Chakra colour-token
  approach. No new npm dependencies.
- **D-11:** Placement is **inline** in the form, below the plate and deck fields and above `volume`.
  It is never a modal. The source and destination grids sit side by side and wrap to a stack in a
  narrow container. The well size is a fixed 18 px for plates of up to 12 columns and scales down
  for larger plates (about 12 px for 24 columns). The grid scrolls horizontally inside its own box
  instead of overflowing the form (the G-03-3 lesson). The planner should check that
  `AddToolCommandModal`'s width holds two 384-well grids, and widen the modal for the F.A.S.T.
  transfer command only if it does not.
- **D-12:** The geometry core is React-free in its own module, so Vitest without jsdom can test it.
  - **Row labels:** A..Z, then AA, AB and so on, matching the adapter's 1-2 letter `_ROW_RE`.
    Columns are 1-based.
  - **What the grid writes:** uppercase row letters and numbers.
  - **Parsing typed values:** a typed row is matched case-insensitively for display only, and its
    saved form is never rewritten. A saved label the grid cannot show (not 1-2 letters, or past
    `rowCount`) is flagged and opens "Edit as fields" (PLT-09).
  - **Source drag:** sets all four source fields at once (start row, start col, `num_rows`,
    `num_cols`).
  - **Destination click:** sets only `dest_start_row/col`. A click is accepted only where the
    footprint fits.
- **D-13:** Rules for keeping the grids, the typed fields and the plates in step:
  - **Changing a plate** (source or destination) **never clears** the six well fields (the Phase 6
    D-09 philosophy: no effect-driven clears). Fit is re-checked, and a block that no longer fits is
    flagged, never clipped.
  - **A new source drag** keeps any destination placement and re-checks whether it still fits.
  - **"Clear selection"** is the only action that empties all six fields, and it sets them to `""`.
  - **Typed edits** redraw the grid only when all relevant fields parse. Otherwise the grid shows
    nothing selected, and the typed values stay as entered.
- **D-14:** "Edit as fields" is a Chakra `Collapse` that is closed by default. It is forced open,
  and cannot be closed, while any of these holds:
  - either grid is hidden (no plate chosen, the list unavailable, an unknown plate, or unknown geometry)
  - any of the six fields holds a `{{variable}}`
  - any of the six fields holds a flagged value

  The status-line copy follows PLT-08 exactly. The fit-failure copy follows the mockup ("Block does
  not fit the destination plate here").
- **D-15:** A size mismatch is when source `rowCount x colCount` differs from destination
  `rowCount x colCount`. The destination grid then shows the warning "Plates differ in size (8x12 vs
  16x24) - the F.A.S.T. refuses cross-format transfers (-9006)" **instead of** a footprint, and
  clicks on it do nothing. The typed destination fields stay editable, and saving is not blocked
  (PLT-09).
- **D-16:** Hosts follow Phase 6. The grid renders on the tool page, in `AddToolCommandModal` and in
  `CommandDetailsDrawer` while `isEditing`. The read-only drawer on the run page is unchanged: it
  shows no grid and sends no read. The tool page has no variables, so on the tool page D-14 opens
  only for a hidden grid or a flagged value.

**`get_plates` stays internal (PLT-05)**
- **D-17:** `get_plates` is never added to `commandFields.fast`. Extend `test/staticScan.test.ts` to
  check the following:
  - `fast.plates` is in the closed `OPTION_SOURCES` registry.
  - `get_plates` appears in no `commandFields`, so it is never a step or a tool-page command.
  - No first-option selection exists in the deck, plate or checkbox renderers.
  - The decks constant is the single definition of the 1-6 slot list.

  The existing born-empty and `commandFields` pins stay green without edits.

### Claude's Discretion
- File split and names (`WellPicker`, the geometry module, the binding-map role names).
- The exact caps (plate count, description length, max row and column counts), as explicit and
  boundary-tested constants.
- Exact hint and flag copy, as long as the meaning in D-05, D-08, D-09, D-14 and D-15 holds.
- Whether plate and deck selects reuse `OptionsSelect` directly or through a small static-mode
  adapter.
- How the plans are split. A suggested order:
  1. Wave 1 (ungated): decks, the checkbox, the no-zero-fill rule and the geometry core.
  2. A gate task, then the re-pin and regen, the `fast.plates` parser and source, and the plate
     dropdowns.
  3. The `WellPicker` UI wired to plates in all three hosts.
  4. The static scans and the phase gate.

### Deferred Ideas (OUT OF SCOPE)
- Cross-format 96 <-> 384 transfers with quadrant placement (A1/A2/B1/B2). This needs fast-mcp
  multi-pass authoring first (Future Requirements).
- Plate size and `workingCapacity` in the option label (Future Requirements, option-label context).
- Building `get_plates` in galago-tools belongs to that repo's own GSD project, not here (D-02).
- (Reviewed, not folded) "Scheduler: per-toolId concurrency lanes" belongs to Phase 8.

*(Typographic dashes and arrows in the quotes above were normalised to ASCII; meaning is unchanged. The planner should copy exact copy strings from `07-CONTEXT.md`.)*
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLT-01 | galago-tools ships a frozen `get_plates` read that answers during a Transfer (cross-repo precondition) | Gate finding: NOT frozen as of 2026-11-12 (see Gate Status). Gate checklist with exact commands below. |
| PLT-02 | `vendor/galago-tools` re-pinned; diff is exactly `GetPlates` + oneof 11, `expected_tray_id = 13` unchanged | Reproduced the expected regen diff in a scratch dir (only `fast.ts` changes). Exact diff listed below. |
| PLT-03 | Operator picks `source_plate_id` / `dest_plate_id` from registered plates; label id + description, value numeric id | `fast.plates` source + `shape: "plates"` result + `plateOptions()` builder; numeric write path (`applyChange` numeric roles). |
| PLT-04 | Non-integer / < 1 ids rejected; duplicates flagged; unset plate never saved as `0` | Parser rules (D-04/D-05), no-zero-fill predicate in `handleSubmit` that preserves the pinned fill-in literals; wire-coercion pitfall (`""` -> 0 on the wire). |
| PLT-05 | `get_plates` never a step or tool-page command | `commandFields` untouched; static scan additions (D-17). |
| PLT-06 | Deck 1-6 dropdowns, born empty, saved value kept verbatim | `static` binding role fed by one `DECK_SLOTS` constant; no hook-based read. |
| PLT-07 | `tip_reuse` "Reuse tips" checkbox, new step starts `reuse`, saved values kept | `checkbox` role + `newStepDefaults()` used by the modal init effect and the tool-page `[selectedCommand]` effect; indeterminate mapping. |
| PLT-08 | Two grids: source drag, destination click, status line, "Edit as fields", Clear | React-free `wellGeometry.ts` (codec, drag rect, arithmetic hit-test, sync, force-open) + thin pointer-event `WellPicker`. |
| PLT-09 | Misfit / unshowable row flagged never clipped; size mismatch warning; hidden grid fallbacks | `fitsAt`, `plateGeometry`, `sizeMismatch` (tuple compare, matching fast-mcp), force-open rules. |
</phase_requirements>

## Summary

The controller side is a clean generalisation of Phase 6: add one registry source (`fast.plates`), one new result shape (`plates`), three new binding roles (`static`, `plate`, `checkbox`) plus a group role for the six well fields, and a React-free geometry module. The Phase 6 modules (`server/toolOptions.ts`, `components/tools/fieldOptions.ts`, `OptionsSelect.tsx`, `hooks/useToolOptions.ts`) were read in full this session. `Tool.readOptions(toolType, command, params)` is already generic (it builds `{ [toolType]: { [command]: params } }`), so no change to `server/tools.ts` is needed. Two parts of the existing code assume exactly the Phase 6 shapes and will break if they are only "extended": `formatStatusLine` (falls through to `data.devices.length` for any non-list shape, which would be a TypeError for a plates result) and `FieldBinding.source` (required, and `OptionsSelect` calls the `useToolOptions` hook unconditionally with it).

**The gate is closed.** galago-tools has no `get_plates` on any branch of either remote (`nikkopg` origin: `feat/stack-tool` tip `4ccd3da`, `main` `35f40e4`; `sciencecorp` upstream: no match). The only `get_plates` in the repo history is the unrelated `tools/toolbox/inventory.py:get_plates(workcell_name)`. So Wave 1 (decks, checkbox, no-zero-fill, geometry core) can be planned and built now; everything that needs the real reply must wait behind the blocking gate task. I reproduced, in a scratch directory, exactly what the re-pin regen will change once the contract's proto edit lands: only `controller/gen-interfaces/tools/grpc_interfaces/fast.ts` changes (new `Command_GetPlates`, field 11 / tag 90). That is the "exact expected interface diff" for success criterion 1.

The pointer-drag question has a firm answer: `react` is **not importable in Vitest** here (`tsconfig.json` aliases `react` to `node_modules/@types/react/index.d.ts`, so `import "react"` in a test throws `ReferenceError: index_d_module is not defined`; reproduced). No jsdom or testing-library is installed and none may be added. So all drag logic must live in a pure module (drag rectangle from two cells, arithmetic pixel-to-cell hit-test from the grid's bounding box, fit checks, field sync), the component is a thin handler shell, and the component itself is covered by static source scans plus a manual UAT.

**Primary recommendation:** Build Wave 1 now (decks via a `static` binding role, `tip_reuse` checkbox + `newStepDefaults`, no-zero-fill, `wellGeometry.ts` with full unit tests); put a blocking gate task in front of the `fast.plates` work and run it exactly as listed under "Gate checklist"; make the plate fields numeric end-to-end (select writes a number; the typed fallback must be a numeric input, because a non-numeric string reaches the wire as `0`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `get_plates` read, reply validation, caps, cache | API / Backend (`server/toolOptions.ts`, tRPC `tool.options`) | - | Closed registry; browser sends only a source id; reply is untrusted (Struct doubles). |
| Plate / deck / checkbox view decisions (labels, flags, mode) | Browser / Client (pure `fieldOptions.ts`) | - | `buildFieldView` pattern: React-free, decides what the control renders. |
| Writing plate/deck/tip values to params | Browser / Client (host `handleOptionSelect`) | - | Values live in the host form; the control only reports the operator's choice. |
| Unset-never-0 on save | Browser / Client (modal `handleSubmit`, drawer, tool page) | API (tool server refuses < 1) | Save-time fill-in is client code; the adapter is the final check. |
| Grid geometry, drag rect, hit-test, fit, mismatch, sync | Browser / Client (pure `wellGeometry.ts`) | - | Pure functions so Vitest (node, no DOM) can test them. |
| Pointer capture and handlers, rendering the grids | Browser / Client (`WellPicker.tsx`) | - | Thin shell over the pure core. |
| Cross-format refusal (-9006) | External (fast-mcp / tool server) | Browser (early warning only) | The UI warns; the instrument stays the authority. Saving is not blocked. |
| `get_plates` handler, busy-gate bypass | External (galago-tools `tools/fast/server.py`) | - | Out of this repo (D-02); gated by PLT-01. |
| Submodule pin + codegen | Build / repo (`vendor/galago-tools`, `controller/gen-interfaces`) | - | Gitlink-only commit plus a proven regen diff. |

## Standard Stack

No new npm dependencies (locked: "No new npm dependencies: drag is built on pointer events").

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@chakra-ui/react` | 2.8.2 [VERIFIED: node_modules/@chakra-ui/react/package.json] | `Select`, `Checkbox` (`isIndeterminate`), `Collapse`, `Box`, `useColorModeValue` | Already the UI kit; `Checkbox` and `Collapse` are in the same package. |
| `@trpc/*` v10 + `@tanstack/react-query` v4 | as in `controller/package.json` | `tool.options` query via `useToolOptions` | Phase 6 layer, unchanged. |
| `vitest` | 2.1.9 [VERIFIED: `npx vitest --version`] | Unit tests, node env, no jsdom | Existing infra. |
| `zod` | existing | Router input stays `z.enum(OPTION_SOURCE_IDS).strict()` | Phase 6 D-17. |

### Supporting (tooling, not shipped)
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `ts-proto` | 1.151.1 (pinned; local `node_modules` has 1.153.2, do NOT use) [VERIFIED: `npm view ts-proto@1.151.1 version` -> 1.151.1; local `node_modules/ts-proto/package.json` -> 1.153.2] | Regenerate `controller/gen-interfaces` in the gate task | Scratch directory with explicit `--plugin=`; installed from the registry into the scratchpad only. |
| `protoc` | libprotoc 25.2 [VERIFIED: `protoc --version`] | Driver for the regen when Python `grpc_tools` is absent | Works; see the `struct.ts` caveat under Pitfall 9. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure `wellGeometry.ts` + static scans for the component | jsdom + `@testing-library/react` | Forbidden (no new deps) and `react` is not importable in tests anyway. |
| Arithmetic hit-test (`getBoundingClientRect` + cell stride) | `document.elementFromPoint` (the mockup) | `elementFromPoint` works in the browser but is untestable and ignores the gap/gutter; arithmetic is deterministic and lets the drag clamp at the grid edge. |
| `OptionsSelect` taking a `static` binding directly | New `StaticSelect` component | `OptionsSelect` calls `useToolOptions(toolId, binding.source, enabled)` unconditionally (hooks cannot be conditional) and `SOURCE_LABELS[binding.source]`; a source-less binding cannot pass through it. Prefer a small `StaticSelect` that renders the same `SelectView` (see Pattern 2). |

**Installation:** none.

**Version verification:** no new runtime packages. `ts-proto@1.151.1` confirmed on the registry; it is a pre-existing, documented dev toolchain (`bin/make:11` installs `ts-proto@1.151.1`) [VERIFIED: bin/make:11].

## Package Legitimacy Audit

No external packages are added to `controller/package.json` by this phase, so no install gate applies.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `ts-proto@1.151.1` (scratch-dir regen tool only, never added to the project) | npm | pre-existing in-repo precedent (Phase 5 D-02, Phase 6 D-16, `bin/make:11`) | not measured | n/a | not run through the `package-legitimacy` seam (not installed into the project) | Approved by precedent; `[ASSUMED]` re: seam verdict |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Gate Status (PLT-01, PLT-02) - measured this session

| Check | Result |
|-------|--------|
| `vendor/galago-tools` pin | `4ccd3da656c0e981332018b3d33e16148a8bc513` [VERIFIED: `git ls-tree HEAD vendor/galago-tools`; `git submodule status`] |
| `.gitmodules` | `url = https://github.com/nikkopg/galago-tools.git`, `branch = feat/stack-tool` [VERIFIED: `.gitmodules`] |
| Remote `nikkopg` heads | `git ls-remote origin` from the sibling clone: `refs/heads/feat/stack-tool` = `4ccd3da656c0e981332018b3d33e16148a8bc513`, `refs/heads/main` = `35f40e4cd79c1666476291b4260c39cfb43164bc` [VERIFIED: command output] |
| `get_plates` / `GetPlates` anywhere in galago-tools history | Only `tools/toolbox/inventory.py:43: def get_plates(workcell_name: str) -> Any:` (unrelated). `git log --all -S GetPlates` on the submodule: no commit. `grep` of `fast.proto` and `tools/fast/server.py`: no match. [VERIFIED: command output] |
| Current `fast.proto` oneof | entries 1-10 only; `Transfer.expected_tray_id = 13` present [VERIFIED: fast.proto:6-17, 32] |
| `fast` server read bypass | `CONTROL_COMMANDS = frozenset({"pause", "resume", "abort"})`; no read bypass yet [VERIFIED: tools/fast/server.py ~line 80-82 and `ExecuteCommand` ~515-541] |

**Conclusion:** the gated half of the phase cannot start. Wave 1 is unaffected.

### What the re-pin will change (reproduced in a scratch directory)

Method: copied `vendor/galago-tools/interfaces`, applied the contract's proto edit (`GetPlates get_plates = 11;` plus `message GetPlates { optional bool refresh = 1; }`), ran `protoc` with the pinned ts-proto 1.151.1 plugin and the `bin/make` options (`stringEnums=true`, `esModuleInterop=true`, `snakeToCamel=false`, `outputServices=grpc-js`), once for the unmodified tree and once for the patched tree, then diffed.

- Baseline (unmodified proto) vs `controller/gen-interfaces`: identical **except** `google/protobuf/struct.ts`, which differs in doc comments only (my `protoc` 25.2 bundled well-known-type protos vs the `grpc_tools` ones). That is a toolchain artefact, not a proto change; never commit it.
- Patched vs baseline: **exactly one file differs, `tools/grpc_interfaces/fast.ts`** [VERIFIED: `diff -rq out_base out_patch`]. The changes are:
  - `Command` interface: `get_plates?: Command_GetPlates | undefined;`
  - new `export interface Command_GetPlates { refresh?: boolean | undefined; }`
  - `createBaseCommand`: `get_plates: undefined`
  - `Command.encode`: `Command_GetPlates.encode(message.get_plates, writer.uint32(90).fork()).ldelim();` (field 11, wire type 2 = tag 90)
  - `Command.decode`: `case 11:` with `tag !== 90`
  - `fromJSON` / `toJSON` / `fromPartial` gain a `get_plates` line
  - new `createBaseCommand_GetPlates` and `Command_GetPlates` codec (`refresh` is field 1, `writer.uint32(8).bool(...)`)
  - `tool_base.ts` and `controller.ts` are **unchanged**.

So the gate's check 4 should be: regen from the frozen commit's proto -> `diff -r` against `controller/gen-interfaces` shows only `tools/grpc_interfaces/fast.ts` (plus the known `google/protobuf/struct.ts` comment-only noise if `grpc_tools` is not used). Anything else: stop and record a note.

Consequence if someone sends `get_plates` **before** the regen: the current generated encoder has no field 11, so `{ fast: { get_plates: {} } }` encodes as an empty `fast.Command` (the key is silently ignored). Never test the plates path against the old `gen-interfaces`.

### Gate checklist (copy into the gate task)

```bash
# 1. frozen commit exists on the remote and is not the current pin
git -C vendor/galago-tools fetch origin
git -C vendor/galago-tools log --oneline 4ccd3da..origin/feat/stack-tool        # must list the frozen commit(s)
# 2. proto diff is exactly GetPlates + oneof 11, expected_tray_id = 13 untouched
git -C vendor/galago-tools diff 4ccd3da <FROZEN_SHA> -- interfaces/tools/grpc_interfaces/fast.proto
# 3. its test calls get_plates through ExecuteCommand during a Transfer (read the test, do not trust the commit message)
git -C vendor/galago-tools diff 4ccd3da <FROZEN_SHA> --stat
# 4. scratch regen with ts-proto 1.151.1 (never the local 1.153.2), diff only fast.ts
#    (see Code Examples: regen script). Then:
git -C vendor/galago-tools checkout --detach <FROZEN_SHA>                         # gitlink-only commit, never --remote
git diff --stat -- controller/gen-interfaces                                       # only fast.ts
```

If the frozen commit's reply `meta_data` differs from the contract (for example adds a `kind` key, or renames a field), the frozen commit wins (D-03): record the difference and write the parser to the frozen shape.

## Architecture Patterns

### System Architecture Diagram

```
Operator (browser)
   |
   |  opens F.A.S.T. "transfer" form: tool page | AddToolCommandModal | CommandDetailsDrawer (isEditing only)
   v
Host form state (formValues | commandParams | editedParams)  <----------------------------+
   |                                                                                      |
   |  per field: lookupFieldBinding(toolType, command, field) -> role                     |
   |                                                                                      |
   +-- role "static"   (source_deck, dest_deck) --> StaticSelect --> buildSelectView -----+  writes Number(v) or ""
   +-- role "checkbox" (tip_reuse)              --> TipReuseCheckbox (checkboxView) ------+  writes "reuse"/"fresh"
   +-- role "plate"    (source/dest_plate_id)   --> OptionsSelect --useToolOptions-------+  writes Number(v) or ""
   |                                                   |                                  |
   |                                                   v (react-query, one entry per (tool, source))
   |                                           trpc tool.options {toolId, source:"fast.plates", refresh?}
   |                                                   |   (strict zod enum; no command/params from client)
   |                                                   v
   |                                           fetchOptions -> cache / dedupe / refresh throttle
   |                                                   |
   |                                                   v
   |                                           Tool.readOptions("fast","get_plates",{refresh?}) -- 5 s deadline, never queued
   |                                                   |  gRPC ExecuteCommand (fast.Command oneof 11)
   |                                                   v
   |                                           galago-tools FastServer (GATE: must bypass NOT_READY, no motion lock)
   |                                                   v  Struct meta_data {plates:[{id,description,rowCount,colCount,workingCapacity}]}
   |                                           parsePlates (drop bad entries -> degraded; ok [] allowed; caps; own())
   |                                                   v
   |                                           OptionsResult {status:"ok", shape:"plates", plates[], degraded, fetchedAt}
   |                                                   |
   +-- role "wells" (six well fields, rendered ONCE at the first well field) --> WellPicker
                                                       |
            plate options + values  -->  wellGeometry (pure):  plateGeometry(), selection from fields,
                                         drag rect, cellFromPoint, fitsAt, sizeMismatch, forceOpen, statusLine
                                                       |
            pointer events (down/move/up/cancel/leave/click)  --> patches {six fields}  --> host onChange(patch)
                                                       |
            "Edit as fields" Collapse (typed inputs rendered by the HOST: keeps number/text/variable-picker behaviour)
```

### Recommended Project Structure
```
controller/
├── server/toolOptions.ts              # + "fast.plates" entry, parsePlates, PlateEntry, shape:"plates", caps
├── components/tools/
│   ├── fieldOptions.ts                # + roles static/plate/checkbox/wells, DECK_SLOTS, plateOptions, checkboxView,
│   │                                  #   newStepDefaults, isNoZeroFillField, applyChange numeric, formatStatusLine plates
│   ├── wellGeometry.ts                # NEW, React-free and Chakra-free (imported by tests)
│   ├── StaticSelect.tsx               # NEW: renders a SelectView for static/decks (no hooks that read)
│   ├── TipReuseCheckbox.tsx           # NEW (or inline in a small FastFields file)
│   ├── WellPicker.tsx                 # NEW: pointer-event shell + Collapse; children = host-rendered typed fields
│   └── OptionsSelect.tsx              # plates role: numeric typed fallback; "duplicate" flag colour
├── components/protocols/{AddToolCommandModal,CommandDetailsDrawer}.tsx, pages/tools/[id].tsx   # host wiring
└── test/
    ├── wellGeometry.test.ts           # NEW (largest new suite)
    ├── fixtures/fastPlates.ts         # NEW (golden from fast-mcp characterization test)
    └── toolOptions.parse|read|Router, fieldOptions, staticScan, wire  # extended (+ 3 existing pins edited)
```

### Pattern 1: Generalise the registry, not the router
**What:** One more `OPTION_SOURCES` entry; the router already takes `z.enum(OPTION_SOURCE_IDS)`, so `tool.options` accepts `"fast.plates"` with no router edit. `Tool.readOptions` already builds the payload from `(toolType, command, params)`.
```ts
// Source: controller/server/toolOptions.ts:248-277 (existing shape), extended
"fast.plates": {
  toolType: "fast",
  command: "get_plates",
  kind: "plates",            // metadata only; see Pitfall 5 re: the reply carrying no kind key
  acceptsRefresh: true,      // D-03: the proto field is kept; Refresh sends refresh:true
  parse: (meta: unknown) => parsePlates(meta),
},
```
Add `"fast.plates": "plates"` to `SOURCE_LABELS` (typed `Record<OptionSourceId, string>`, so `tsc` forces it).

### Pattern 2: Static and checkbox roles bypass the read hook
**What:** `FieldBinding` today is `{ field, source: OptionSourceId, role }`. Make `source` absent for `static`/`checkbox`/`wells` roles (discriminated union on `role.kind`), and give them their own tiny renderers that call `buildSelectView` / `checkboxView` directly. Do not route them through `OptionsSelect` (hooks cannot be conditional, and `enabled=false` would make `deriveOptionsMode` return `unavailable`, i.e. a typed input, which is wrong for decks).

Keep `<OptionsSelect` as the literal that the three hosts render for list/cascade/plate bindings, so the existing static scan "exactly the three hosts render OptionsSelect" stays green without edits. New components (`StaticSelect`, `TipReuseCheckbox`, `WellPicker`) must not contain the substring `<OptionsSelect`.

```ts
export type FieldRole =
  | { kind: "list" }
  | { kind: "cascade"; side: CascadeSide; level: CascadeLevel }
  | { kind: "plate"; side: CascadeSide }                         // source: "fast.plates"
  | { kind: "static"; options: readonly number[]; notListedSuffix: string }   // decks
  | { kind: "checkbox"; checked: "reuse"; unchecked: "fresh" }
  | { kind: "wells"; role: "source-start-row" | ... };           // the six well fields, group-rendered
```
`lookupFieldBinding` keeps its own-property discipline; add `fast: { transfer: byField([...]) }` to `FIELD_BINDINGS` (the pin at `test/fieldOptions.test.ts:925` must be updated, see Pitfall 4).

### Pattern 3: Numeric writes
**What:** Today `applyChange` returns `Record<string,string>`. Plate and deck values must be **numbers** (D-06/D-08) so the saved JSON and the wire type match today's `number` input. Extend the return type to `Record<string, string | number>`; for `plate`/`static` roles: `""` -> `""`, otherwise `Number(value)`. The typed fallback for a plate field (unavailable mode) must also be numeric: write the number when the text is a finite integer, otherwise `""`, never the raw text (Pitfall 2).
```ts
export function numericPatch(field: string, newValue: string): Record<string, string | number> {
  if (newValue === "") return { [field]: "" };
  const n = Number(newValue);
  return { [field]: Number.isInteger(n) ? n : "" };
}
```

### Pattern 4: New-step defaults as one pure function
`newStepDefaults(toolType, command): Record<string, string>` returns `{ tip_reuse: "reuse" }` for `fast`/`transfer` and `{}` otherwise. Call it from exactly two places: the modal's initialisation effect (after the `defaultValue` loop, `AddToolCommandModal.tsx:126-154`) and the tool page's `[selectedCommand]` effect (`pages/tools/[id].tsx` ~line 91-114). It is never called when a saved step is opened (the drawer must not call it). The existing scan for the tool page effect (`/useEffect\(\(\) => \{\s*if \(selectedCommand\) \{[\s\S]*?\}, \[selectedCommand\]\);/` and `not.toContain("applyChange")`) stays green as long as the effect keeps that shape and does not mention `applyChange`.

### Pattern 5: Group the six well fields at the first well field
The hosts iterate fields one at a time (modal `fields.map`, tool page `renderFields`, drawer `Object.entries(params)`), but D-11 wants one inline picker above `volume` with the six typed fields inside a collapsible. Render `WellPicker` once, at the first well field (`source_start_row`), and skip the other five in that loop. `WellPicker` receives `children` (or a `renderTypedField(name)` render-prop): the **host** renders the six typed inputs so number/text behaviour and the modal/drawer variable picker are inherited, and the picker only owns the Collapse and the grids. The drawer iterates **saved** keys (`CommandDetailsDrawer.tsx:554`), so group by "first well key present in the saved params"; a legacy step missing some well keys must still render (treat missing as blank).

### Pattern 6: Pure geometry core + thin pointer shell (the testability answer)
All of these are pure and unit-tested in `test/wellGeometry.test.ts`:
- `rowLabel(i)` / `parseRowLabel(s)` (A..Z, AA..; strict 1-2 letters; case-insensitive for display only)
- `parseCell(rowValue, colValue, size)` -> `{r,c}` | `"blank"` | `{flag}` (blank = `undefined`, `null`, `""`, and the legacy `0`)
- `dragRect(anchor, current)` -> `{r,c,h,w}`
- `cellFromPoint(clientX, clientY, gridBox, metrics, size, clamp)` -> `{r,c}` | `undefined`
- `fitsAt(origin, block, size)`, `sizeMismatch(a, b)` (tuple compare)
- `sourcePatch(rect)`, `destPatch(cell)`, `CLEAR_PATCH`
- `forceOpen({...})`, `statusLine({...})`, `wellSizePx(colCount)`
The component only: reads `getBoundingClientRect()` of the inner grid element, calls `cellFromPoint`, calls the pure functions, calls `onPatch(patch)`. Pointer capture is on the source grid element (`setPointerCapture` inside try/catch), `onPointerCancel` and `onLostPointerCapture` end the drag, `e.button !== 0` is ignored, `touch-action: none` and `user-select: none` are set on the grid. Use the **inner** grid element's bounding box (it scrolls with its content inside the overflow box), so the arithmetic is correct under horizontal scroll with no extra code. A drag/hover anchor can live in a `useRef`; the hover footprint is `useState` (UI-only, never written to params). No `useEffect` is needed anywhere in the picker.

### Anti-Patterns to Avoid
- **First-option or default selection** in any new renderer (D-17 scan; also `defaultValue`, `defaultChecked`, `selected=`, `placeholder=` are scanned in `OptionsSelect.tsx` and should be avoided in the new renderers too).
- **Effect-driven writes**: a plate change, list load, or refresh must never write well fields (D-13). Fit is recomputed from current values at render time.
- **Clipping**: a block that does not fit is drawn in the "bad" style on the in-bounds cells (as the mockup does) and flagged in the status line; the saved values are never rewritten.
- **Reusing `PlateGrid.tsx`** (D-10).
- **`elementFromPoint` hit-testing** (untestable; use arithmetic).
- **Spreading or key-iterating the reply object** in the parser (T-06-09): use `own()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading a list from an instrument | A new tRPC procedure or a direct `executeCommand` call | `tool.options` + `OPTION_SOURCES` + `Tool.readOptions` | Closed registry, deadline, cache, dedupe, never-queued, and static scans already enforce it. |
| Cache / refresh throttle / in-flight dedupe | Per-source caching | `readThrough`/`settleLive` in `toolOptions.ts` | Already generation-aware; only an `ok` result is cached; a failure evicts. |
| `{{variable}}` detection | A new regex | `isVariableLike` (`utils/variableRef.ts`) | One shared predicate used by the server and both hosts. |
| Select/saved-value/not-reported logic | A second implementation for decks/plates | `buildSelectView` (add an optional not-listed suffix param) | Keeps born-empty, verbatim-save and variable-bound semantics identical. |
| Collapsible section | A custom disclosure | Chakra `Collapse` (`in={open || forced}`) | Same package, animated, hides focusable children when closed. |
| Tri-state checkbox | A custom control | Chakra `Checkbox` with `isIndeterminate` | Built in. |
| Number input that stays blank | Chakra `NumberInput` defaults in the modal | A born-empty numeric input (see Pitfall 6) | The modal's `number` case paints `0` and writes `0` on clear. |
| TS codegen | Hand-editing `gen-interfaces` | `ts-proto@1.151.1` scratch regen | Hand edits drift; the diff is the gate evidence. |
| Pointer hit-testing | `elementFromPoint` | Arithmetic over `getBoundingClientRect` + fixed cell stride | Testable and scroll-safe. |

**Key insight:** every "new" behaviour here is a new case of an existing pure function. The bugs will be at the seams (numeric coercion, the modal's fill-in, status-line fall-through), not in the new logic.

## Common Pitfalls

### Pitfall 1: The gate is closed and a pre-regen send is silently an empty command
**What goes wrong:** Someone stubs `fast.plates` or pins an unfrozen SHA to unblock the UI; with the old `gen-interfaces`, `{ fast: { get_plates: {} } }` encodes as an empty `fast.Command` and the adapter returns an argument error that the UI shows as "unavailable".
**How to avoid:** Follow the gate checklist; Wave 1 must not touch `OPTION_SOURCES`, `gen-interfaces` or the submodule pointer.
**Warning signs:** a `fast.plates` entry without a matching `Command_GetPlates` in `gen-interfaces/tools/grpc_interfaces/fast.ts`.

### Pitfall 2: A non-numeric or blank string reaches the wire as `0` (verified)
**What goes wrong:** `F.A.S.T. Transfer` int32 fields are encoded by `writer.uint32(24).int32(message.source_plate_id)` whenever `!== undefined`. I ran `protobufjs/minimal` `Writer.int32` on `""`, `undefined`, `0`, `NaN`: all four produce the same bytes `1800` (tag 24, value 0) [VERIFIED: node output `"" 1800`, `undefined 1800`, `0 1800`, `NaN 1800`; encode guard at gen-interfaces/tools/grpc_interfaces/fast.ts `if (message.source_plate_id !== undefined)`]. Therefore (a) a saved `""` plate or deck (D-07) **is** sent as `0` at run time, and the tool page sends untouched born-empty `""` as `0` too (`pages/tools/[id].tsx` handleSubmit passes `formValues` verbatim for non-stack tools); (b) the typed fallback in `OptionsSelect` (a text `Input`) would let `"12a"` reach the wire as `0`.
**Why it is still safe:** the adapter refuses `0` (`source_plate_id must be >= 1`, `source_deck must be 1-6`) before any motion [VERIFIED: tools/fast/server.py:199-206, quoted: `if cmd.source_plate_id < 1: problems.append(f"source_plate_id must be >= 1 (got {cmd.source_plate_id})")`]. PLT-04's wording is "never **saved** as `0`", so D-07 satisfies it; but verification text must not claim "never `0` on the wire".
**How to avoid:** make the typed fallback for plate fields numeric (Pattern 3); write `""` not `0`; if the planner wants the wire clean on the tool page, strip blank plate/deck keys on the F.A.S.T. tool-page send (see Open Question 2) - protocol-step wire behaviour is out of scope per CONTEXT.
**Warning signs:** a test that asserts the encoded bytes of an untouched field are absent.

### Pitfall 3: `formatStatusLine` and `buildFieldView` fall through for a new shape
**What goes wrong:** `formatStatusLine` computes `const count = data.shape === "list" ? data.names.length : data.devices.length;` [VERIFIED: fieldOptions.ts:484]. A `shape: "plates"` result hits `data.devices.length` -> `TypeError: Cannot read properties of undefined`. `buildFieldView` has a `role.kind === "list"` branch and an `else if (data.shape === "tree")` branch; plates would fall to `mode = "unavailable"` silently.
**How to avoid:** add explicit `plates` branches (count = `plates.length`) and a unit test per shape; add a `never` exhaustiveness helper on `data.shape`.

### Pitfall 4: Three existing pins must be edited (CONTEXT says "stay green without edits" - only true for born-empty and commandFields)
Concrete list, each verified by reading the file:
1. `test/staticScan.test.ts:904` "OPTION_SOURCES declares exactly the four D-02 sources" asserts the exact list `["stack.robots","stack.devices","stack.labwareProfiles","stack.transferProfiles"]` and that no other first-level key exists. Adding `fast.plates` requires updating it to five (and the test title).
2. `test/fieldOptions.test.ts:499` `expect(SOURCE_LABELS).toStrictEqual({ ... four entries ... })` needs the fifth entry.
3. `test/fieldOptions.test.ts:925` `expect(Object.keys(FIELD_BINDINGS)).toStrictEqual(["stack"]);` becomes `["stack","fast"]` (and a new `fast` binding-coverage block).
Also `test/staticScan.test.ts:1050-1060` (handleSubmit) requires these literals to remain in the region: `finalParams[field.name] = 0;`, `= false;`, `= [];`, `= "";`, and must not contain `OptionsSelect`, `applyChange`, `tool.options`, `useToolOptions`. **Shape the no-zero-fill branch so the pinned literals survive:**
```ts
if (isNoZeroFillField(selectedToolType, selectedCommand, field.name)) {
  finalParams[field.name] = "";
} else if (field.type === "number") {
  finalParams[field.name] = 0;
} else if (field.type === "boolean") { ... }
```
(`finalParams[field.name] = isNoZeroFill ? "" : 0;` would break the `= 0;` literal pin.)

### Pitfall 5: The contract's reply has no `kind` discriminator
Phase 6 parsers call `checkKind(meta, kind)` (the stack replies carry `kind: "robotStates"` etc.). The contract's `get_plates` reply is `{ "plates": [...] }` with no `kind` [CITED: FAST-GET-PLATES-CONTRACT.md:56-66]. The `fast.plates` parser must not require `kind`; recommended: accept absent `kind`, and if `kind` is present and not `"plates"` return `bad_reply`. Also note the existing failure mapping reads `own(reply.meta, "kind") === "readFailed"` for non-SUCCESS; the contract uses "a non-SUCCESS response code plus `error_message`" with no partial list, which maps to `tool_refused` unless the frozen commit adds `kind: "readFailed"`. Settle at the gate.

### Pitfall 6: The modal's number field paints and writes `0`
`AddToolCommandModal.tsx` `case "number"` renders `value = currentValue ?? defaultValue ?? 0` and `onChange` writes `parseFloat(value) || 0` [VERIFIED: AddToolCommandModal.tsx:527-548]. If the six typed well fields inside "Edit as fields" reuse that case, the fields do not "start empty" (PLT-08 mockup note: "Nothing selected at start. Fields start empty") and clearing a field writes `0`. The tool page's number case already does it right (`?? ""`, `Number.isNaN(valueNumber) ? "" : valueNumber`, `pages/tools/[id].tsx` ~line 330-345). Use a born-empty numeric input for the six (and for the plate typed fallback), written `""` when blank.

### Pitfall 7: `react` is not importable from Vitest
Reproduced: a `.ts` test importing `react` fails with `ReferenceError: index_d_module is not defined` because `tsconfig.json` `paths` maps `"react"` to `node_modules/@types/react/index.d.ts` and `vite-tsconfig-paths` honours it. `vitest.config.mts` only includes `test/**/*.test.ts`. Do not plan component render tests; do not add jsdom. Any module a test imports (`fieldOptions.ts`, `wellGeometry.ts`, `toolOptions.ts`) must stay free of `react`/Chakra value imports (`import type` is erased and fine).

### Pitfall 8: Cross-format is a tuple compare, not a product compare
fast-mcp refuses when `(src.row_count, src.col_count) != (dst.row_count, dst.col_count)` [VERIFIED: /home/formulatrix/data/nikko/fast/fast-mcp/fast_mcp/authoring.py:66-67, quoted: `(src.row_count, src.col_count) != (dst.row_count, dst.col_count)`]. D-15 says "`rowCount x colCount` differs", which read literally as a product would miss 8x12 vs 12x8 (equal product 96) and 4x6 vs 3x8. Implement `sizeMismatch` as the pair compare and print the `RxC` pair in the warning. Also: fast-mcp treats unknown ids as "surfaced later by validate() (-813)", so the mismatch warning applies only when both plates are known with usable geometry.

### Pitfall 9: Regen toolchain noise
Without Python `grpc_tools` (absent here: `ModuleNotFoundError: No module named 'grpc_tools'`), plain `protoc` 25.2 emits a different `google/protobuf/struct.ts` doc comment. That is expected noise; the gate's pass condition is "only `fast.ts` changes among the repo's own protos". If `grpc_tools` is available, the Phase 6 mechanism (`bin/make proto_ts` options with an explicit `--plugin=`) gave a clean NO_DIFF. Never use the local `controller/node_modules/ts-proto` 1.153.2 (documented to emit a broken `tool_base.ts`, Phase 5 D-02).

### Pitfall 10: Modal init effect re-runs on `labwareData`
The modal's initialisation effect depends on `[selectedToolType, selectedCommand, labwareData]` and calls `setCommandParams(initialParams)` [VERIFIED: AddToolCommandModal.tsx:126-154], so any change of the `labwareData` reference re-initialises the form, wiping operator input. This is pre-existing; putting the `tip_reuse` default inside this effect inherits it (the default is re-applied, but any picked plate/well is lost). Don't widen the dependency array; consider noting it for UAT. (React Query structural sharing keeps the reference stable when data is equal.)

### Pitfall 11: Drawer and modal width vs two 384-well grids
Modal: `ModalContent maxW="900px"` [VERIFIED: AddToolCommandModal.tsx:1001]. Two 384-well grids at the scaled ~12 px well: each is about `14 + 24*(12+3) + 3 ~= 377 px`, so two side by side need about `754 px + 24 gap`, which fits the modal body (`900 - 48 padding ~= 852`). Drawer: `size="lg"` (Chakra lg drawer is 32 rem = 512 px, minus padding), so grids **stack** and each must scroll horizontally inside its own box (`overflowX="auto"`). Use `flexWrap="wrap"` on the grid row so both cases fall out of one layout. Verify by eye in UAT; the geometry above is arithmetic from the mockup's CSS (`grid-template-columns:14px repeat(12,18px); gap:3px`), not a measured render. `[ASSUMED]` for the drawer width value (Chakra theme default; not read from the theme in this session).

### Pitfall 12: Legacy zeros and the "flagged" definition
The modal today saves untouched number fields as `0` (`finalParams[field.name] = 0;`), and D-07 keeps that for the six well fields. So steps saved earlier (and new steps with an untouched picker) hold `source_start_col: 0, num_rows: 0, ...`. If `0` counts as "flagged", D-14 force-opens "Edit as fields" on every such step. Recommended rule: **blank = `undefined | null | "" | 0`** (nothing selected, not flagged); **flagged = non-blank and unusable** (non-integer, negative, 3+ letter row, row past `rowCount`, col past `colCount`, block past the edge). See Open Question 1. The plate/deck selects, by contrast, correctly show a legacy `0` as "0 (not reported by instrument)" / "(not a deck slot 1-6)".

## Code Examples

Sketches that follow the established patterns. Field names and the two `tip_reuse` values are verbatim from `commandFields.fast.transfer` (`controller/components/tools/constants.ts:316-328`): `source_deck`, `dest_deck`, `source_plate_id`, `dest_plate_id`, `source_start_row`, `source_start_col`, `dest_start_row`, `dest_start_col`, `num_rows`, `num_cols`, `volume`, `tip_reuse` with `options: ["fresh", "reuse"]`. The deck bound comes from `_DECK_SLOTS = 6` (`vendor/galago-tools/tools/fast/server.py:129`) and the row rule from `_ROW_RE = re.compile(r"[A-Za-z]{1,2}")` (line 130).

### parsePlates (server/toolOptions.ts)
```ts
// Caps are discretionary constants; boundary-test each one (at cap ok, cap+1 rejected).
export const MAX_PLATES = 1000;                 // reuse MAX_LIST_ITEMS semantics: over cap -> too_large, never sliced
export const MAX_DESCRIPTION_LENGTH = 256;
export const MAX_PLATE_ROWS = 32;               // CONTEXT: at least 32 x 48 (1536-well)
export const MAX_PLATE_COLS = 48;
const INT32_MAX = 2147483647;

export interface PlateEntry {
  id: number;
  description: string;
  rowCount: number | null;   // null = missing/invalid -> "unknown geometry"
  colCount: number | null;
}

function geometryDim(v: unknown, cap: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= cap ? v : null;
}

export function parsePlates(meta: unknown): Parsed {
  if (!isPlainObject(meta)) return "bad_reply";
  const kind = own(meta, "kind");
  if (kind !== undefined && kind !== "plates") return "bad_reply";   // Pitfall 5
  const items = own(meta, "plates");
  if (!Array.isArray(items)) return "bad_reply";
  if (items.length > MAX_PLATES) return "too_large";
  const plates: PlateEntry[] = [];
  let degraded = false;
  for (const item of items) {                                       // reply order kept (D-04)
    if (!isPlainObject(item)) { degraded = true; continue; }
    const id = own(item, "id");
    if (typeof id !== "number" || !Number.isInteger(id) || id < 1 || id > INT32_MAX) { degraded = true; continue; }
    const desc = own(item, "description");
    // Over-cap or non-string description: see Open Question 3 (recommended: keep the plate, description "").
    const description = typeof desc === "string" && desc.length <= MAX_DESCRIPTION_LENGTH ? desc : "";
    if (description === "" && desc !== undefined && desc !== "") degraded = true;
    const rowCount = geometryDim(own(item, "rowCount"), MAX_PLATE_ROWS);
    const colCount = geometryDim(own(item, "colCount"), MAX_PLATE_COLS);
    plates.push({ id, description, rowCount, colCount });
  }
  return { shape: "plates", plates, degraded };                     // [] is ok, not unavailable
}
```
`Number.isInteger(12.7)` is false, so 12.7 is dropped and never offered as 12; `Number.isInteger(5.0)` is true (Struct carries 5 as the double 5.0, which is the intended id 5).

### plateOptions and duplicate detection (fieldOptions.ts)
```ts
export const DUPLICATE_SUFFIX = " (duplicate id — check instrument)";
export function plateOptions(data: OptionsResult | undefined): SelectOption[] {
  if (data === undefined || data.status !== "ok" || data.shape !== "plates") return [];
  const counts = new Map<number, number>();
  for (const p of data.plates) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
  return data.plates.map((p, index) => {
    const base = p.description === "" ? String(p.id) : `${p.id} · ${p.description}`;   // D-06 label
    const dup = (counts.get(p.id) ?? 0) > 1;
    const option: SelectOption = { key: String(index), value: String(p.id), label: dup ? base + DUPLICATE_SUFFIX : base };
    if (dup) option.flag = "duplicate";            // extend the SelectOption.flag union; colour like "ambiguous"
    return option;
  });
}

// D-05: the grid uses a duplicated id's geometry only when all duplicates agree.
export function plateGeometry(
  plates: readonly { id: number; rowCount: number | null; colCount: number | null }[],
  value: unknown,
): { rows: number; cols: number } | undefined {
  const same = plates.filter((p) => String(p.id) === String(value));
  if (same.length === 0) return undefined;                                   // unknown plate
  const [first, ...rest] = same;
  if (first.rowCount === null || first.colCount === null) return undefined;  // unknown geometry
  return rest.every((p) => p.rowCount === first.rowCount && p.colCount === first.colCount)
    ? { rows: first.rowCount, cols: first.colCount }
    : undefined;
}
```

### Row-label codec and fit (wellGeometry.ts)
```ts
export function rowLabel(index: number): string {            // 0 -> "A", 25 -> "Z", 26 -> "AA", 27 -> "AB"
  if (index < 26) return String.fromCharCode(65 + index);
  const n = index - 26;
  return String.fromCharCode(65 + Math.floor(n / 26)) + String.fromCharCode(65 + (n % 26));
}
export function parseRowLabel(label: unknown): number | undefined {   // strict: 1-2 ASCII letters, no trim
  if (typeof label !== "string" || !/^[A-Za-z]{1,2}$/.test(label)) return undefined;
  const u = label.toUpperCase();
  return u.length === 1 ? u.charCodeAt(0) - 65 : 26 + (u.charCodeAt(0) - 65) * 26 + (u.charCodeAt(1) - 65);
}
export interface Rect { r: number; c: number; h: number; w: number }
export function fitsAt(origin: { r: number; c: number }, block: { h: number; w: number }, size: { rows: number; cols: number }): boolean {
  return origin.r >= 0 && origin.c >= 0 && origin.r + block.h <= size.rows && origin.c + block.w <= size.cols;
}
export function sizeMismatch(a: { rows: number; cols: number }, b: { rows: number; cols: number }): boolean {
  return a.rows !== b.rows || a.cols !== b.cols;          // pair compare, matches fast-mcp authoring.py:66-67
}
```

### Drag and hit-test (pure; the component only forwards numbers)
```ts
export interface GridMetrics { cell: number; gap: number; gutterX: number; headerY: number }   // same constants the CSS uses
export function cellFromPoint(
  x: number, y: number, box: { left: number; top: number },
  m: GridMetrics, size: { rows: number; cols: number }, clamp: boolean,
): { r: number; c: number } | undefined {
  const stride = m.cell + m.gap;
  let c = Math.floor((x - box.left - m.gutterX - m.gap) / stride);
  let r = Math.floor((y - box.top - m.headerY - m.gap) / stride);
  const inside = r >= 0 && c >= 0 && r < size.rows && c < size.cols;
  if (!inside && !clamp) return undefined;
  c = Math.min(Math.max(c, 0), size.cols - 1);
  r = Math.min(Math.max(r, 0), size.rows - 1);
  return { r, c };
}
export function dragRect(a: { r: number; c: number }, b: { r: number; c: number }): Rect {
  return { r: Math.min(a.r, b.r), c: Math.min(a.c, b.c), h: Math.abs(a.r - b.r) + 1, w: Math.abs(a.c - b.c) + 1 };
}
export function sourcePatch(rect: Rect) {
  return { source_start_row: rowLabel(rect.r), source_start_col: rect.c + 1, num_rows: rect.h, num_cols: rect.w };
}
export function destPatch(cell: { r: number; c: number }) {
  return { dest_start_row: rowLabel(cell.r), dest_start_col: cell.c + 1 };
}
export const CLEAR_PATCH = {   // D-13: the only action that empties all six
  source_start_row: "", source_start_col: "", num_rows: "", num_cols: "", dest_start_row: "", dest_start_col: "",
} as const;
```
Edge behaviour to test: a drag that leaves the grid clamps to the edge (mockup ignores moves outside; clamping is the better UX and is still a rectangle); a destination click outside the grid returns `undefined` (clamp false); the destination click is ignored when the source block is blank/unparsable or the footprint does not fit or the plates mismatch.

### Wire proof for the gated send (after the regen only)
```ts
// test/wire.test.ts addition (gated; fails before the regen, which is the point)
const payload = { fast: { get_plates: { refresh: true } } } as unknown as tool_base.Command;   // what Tool.readOptions builds
const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
expect(decoded.fast?.get_plates?.refresh).toBe(true);
```

### Scratch regen (gate task; run from a scratch dir, not the repo)
```bash
S=<scratchpad>; mkdir -p $S/regen && cd $S/regen && npm init -y && npm i ts-proto@1.151.1
rm -rf $S/proto $S/out && cp -r <repo>/vendor/galago-tools/interfaces $S/proto && mkdir $S/out   # after checking out the frozen SHA
cd $S/proto && protoc -I=. --plugin=protoc-gen-ts_proto=$S/regen/node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=$S/out --ts_proto_opt=stringEnums=true --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=snakeToCamel=false --ts_proto_opt=outputServices=grpc-js *.proto tools/grpc_interfaces/*.proto
diff -rq $S/out <repo>/controller/gen-interfaces     # expect: fast.ts (+ struct.ts comment noise without grpc_tools)
```
Only after the diff is proven do you copy `fast.ts` into `controller/gen-interfaces` (never `struct.ts`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Typed `number` inputs for plates/decks, 0-fill on save | Instrument-fed / static dropdowns writing numbers, `""` when unset | This phase | Saved steps keep loading; wire type unchanged. |
| Select with `defaultValue`-style prefill | Born-empty explicit empty option (Phase 6) | Phase 6 | `tip_reuse` is the one approved default (user decision 2026-11-06). |
| `document.elementFromPoint` drag (mockup) | Arithmetic hit-test over a bounding box | This phase | Same behaviour, testable. |

**Deprecated/outdated:** `components/ui/PlateGrid.tsx` for this purpose (plate-type string, 96 fallback, no drag).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Chakra `lg` drawer is about 512 px wide, so two 384-well grids stack in the drawer. | Pitfall 11 | Layout only; fix is CSS. Verify in UAT. |
| A2 | Over-cap or non-string `description` should keep the plate with an empty description and mark the list degraded (rather than drop the plate). | Code Examples / Open Question 3 | A plate could be dropped or shown id-only unexpectedly; low safety impact (id is the value). |
| A3 | The frozen `get_plates` reply will match the contract (no `kind`, `{plates:[...]}`) and failures use a non-SUCCESS code. | Pitfall 5 | Parser/`unavailable` mapping needs a follow-up edit at the gate (D-03 already says the frozen commit wins). |
| A4 | `ts-proto@1.151.1` passes the package-legitimacy seam. | Package Legitimacy Audit | None: tooling only, precedent in Phase 5/6, not installed into the project. |
| A5 | Treating legacy `0` as "blank, not flagged" for the six well fields (Pitfall 12) is the intended reading of D-14/D-07. | Pitfall 12 / Open Question 1 | If `0` should be flagged, every previously saved or untouched step force-opens "Edit as fields". |
| A6 | `npm run build` works in place now (`.next` fully owned by the current user); not executed this session. | Environment Availability | Phase 6 had to build on a copy because `.next` was root-owned. |
| A7 | Live drag feel (clamping at the edge, pointer capture on touch, scroll interplay) is acceptable as designed. | Pattern 6 | Needs the manual UAT; cannot be unit-tested. |

## Open Questions

1. **Is a saved/untouched `0` in the six well fields "blank" or "flagged"?**
   - What we know: D-07 keeps the 0 fill-in for them; the modal paints 0; D-14 force-opens on "a flagged value".
   - What's unclear: whether `0` counts as flagged.
   - Recommendation: treat `0` like blank (nothing selected, not flagged); flag only non-blank unusable values. Planner should state this in the plan so the tests pin it.
2. **Should the F.A.S.T. tool-page send strip blank plate/deck keys so an untouched plate is absent rather than `0` on the wire?**
   - What we know: `""` encodes as 0 (verified); the adapter refuses both absent ("missing" via `HasField`) and 0; protocol-step wire behaviour is explicitly out of scope.
   - What's unclear: whether the user wants the tool-page send to differ.
   - Recommendation: leave the wire alone in this phase (CONTEXT scope), keep the refusal as the guard, and word the PLT-04 verification as "never saved as 0". If wanted, a field-restricted `omitBlankParams` on the tool page is a one-line change later.
3. **What to do with an over-cap description?** Recommendation: keep the plate (the id is the value), show id-only, mark degraded; never truncate. Alternative (drop the entry) hides a valid plate over cosmetics.
4. **Where does the `fast.transfer` `source_deck`/`dest_deck` static role keep its notListed suffix copy?** Needs a constant like `NOT_A_DECK_SLOT_SUFFIX = " (not a deck slot 1-6)"`; add an optional `notListedSuffix` to `buildSelectView` (default `NOT_REPORTED_SUFFIX`) so Phase 6 callers are untouched.
5. **UI-SPEC:** `workflow.ui_phase` is true and "UI hint: yes"; no `07-UI-SPEC.md` exists yet. Run `/gsd-ui-phase 7` before planning if a visual contract is wanted for the grid, checkbox and flag copy (the mockup is the interaction reference only).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | yes | v24.14.1 | - |
| Vitest | all tests | yes | 2.1.9 | - |
| `npx prettier`, `npx next lint` | gates | yes | prettier "All matched files use Prettier code style!" (4.9 s); next lint "No ESLint warnings or errors" (14 s) [VERIFIED: ran both] | - |
| `npx tsc --noEmit` | gate | yes (not re-run this session; Phase 6 baseline green) | TypeScript ^5.5.3 | - |
| `npm run build` | phase gate | likely (not run) | Next 13.1.2 | build on a copy in the scratchpad (Phase 6 precedent) |
| `protoc` | gate regen | yes | libprotoc 25.2 | - |
| Python `grpc_tools` | `bin/make proto_ts` | no (`ModuleNotFoundError`) | - | plain `protoc` + scratch `ts-proto@1.151.1` (proven; `struct.ts` comment noise) |
| npm registry | scratch ts-proto install | yes (`ts-proto@1.151.1` resolved) | - | - |
| Frozen galago-tools `get_plates` commit | PLT-01/02/03/04/08/09 wiring | **NO** | tip `4ccd3da` | **None.** Blocks the gated part. Do not stub. |
| jsdom / testing-library | component tests | no | - | Not needed and not allowed; pure core + static scans + manual UAT |
| Live or simulated F.A.S.T. with `get_plates` | manual UAT of the plate list | not available (fast-mcp MCP server failed to connect this session) | - | Fixture plates for the geometry; the live plate list is a post-gate manual check |

**Missing dependencies with no fallback:** the frozen `get_plates` commit.
**Missing dependencies with fallback:** `grpc_tools` (use protoc), component test libs (not needed).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9, `environment: "node"`, no jsdom; `react` not importable (Pitfall 7) |
| Config file | `controller/vitest.config.mts` (`include: ["test/**/*.test.ts"]`, `setupFiles: ["test/setup.ts"]`) |
| Quick run command | `cd controller && npx vitest run test/wellGeometry.test.ts test/toolOptions.parse.test.ts test/toolOptions.read.test.ts test/toolOptionsRouter.test.ts test/fieldOptions.test.ts test/staticScan.test.ts test/commandFields.test.ts test/wire.test.ts` (existing 7-file subset: 201 tests green in 2.6 s [VERIFIED: ran it]) |
| Full suite command | `cd controller && npx tsc --noEmit && npx vitest run && npx prettier . --check && npx next lint --no-cache --quiet && npm run build` (Phase 6 baseline: 610 tests, about 190-200 s) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLT-01 | Gate: frozen commit exists, its test calls `get_plates` through `ExecuteCommand` mid-Transfer | shell gate (blocking task) | `git -C vendor/galago-tools log --oneline 4ccd3da..origin/feat/stack-tool` and read the diff/test | n/a |
| PLT-02 | Re-pin; diff is exactly `GetPlates` + 11; tag 13 untouched; regen touches only `fast.ts` | shell gate + unit | scratch regen `diff -rq` (see Code Examples); `npx vitest run test/wire.test.ts` (new `get_plates` encode case, plus the existing `expected_tray_id` case at wire.test.ts:66) | wire case: Wave 0 (gated) |
| PLT-03 | `fast.plates` result -> options with `"{id} · {description}"` label, numeric value | unit | `npx vitest run test/toolOptions.parse.test.ts test/fieldOptions.test.ts` | Wave 0 |
| PLT-04 | id 12.7/0/-1/2^31/"5"/NaN dropped, degraded; `[]` is ok; duplicates flagged; unset plate/deck saved as `""` not `0` | unit + scan | `npx vitest run test/toolOptions.parse.test.ts test/fieldOptions.test.ts test/staticScan.test.ts` | Wave 0 |
| PLT-05 | `get_plates` in no `commandFields`; `fast.plates` in the closed registry | scan | `npx vitest run test/staticScan.test.ts test/commandFields.test.ts` | extend existing |
| PLT-06 | Decks 1-6 from one constant; born empty; saved 0/7/"x" kept and flagged; `{{var}}` disables | unit + scan | `npx vitest run test/fieldOptions.test.ts test/staticScan.test.ts` | Wave 0 |
| PLT-07 | `newStepDefaults` -> `reuse` only for fast.transfer; checkbox mapping incl. indeterminate for blank/other; saved value never rewritten | unit | `npx vitest run test/fieldOptions.test.ts` | Wave 0 |
| PLT-08 | Codec, drag rect, hit-test, patches, status lines, force-open, clear patch | unit | `npx vitest run test/wellGeometry.test.ts` | Wave 0 |
| PLT-09 | Fit/no-fit, unshowable row, tuple size mismatch (8x12 vs 12x8, 96 vs 384), hidden-grid cases | unit | `npx vitest run test/wellGeometry.test.ts` | Wave 0 |
| (all UI) | Rendered grids, drag feel, Collapse force-open, drawer/modal layout, checkbox indeterminate | manual UAT | see Manual-Only below | n/a |

### Sampling Rate
- **Per task commit:** the quick run command above (about 3-5 s).
- **Per wave merge:** `cd controller && npx tsc --noEmit && npx vitest run`.
- **Phase gate:** full suite green (`tsc`, `vitest run`, `prettier . --check`, `next lint --no-cache --quiet`) plus `npm run build` once, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `controller/test/wellGeometry.test.ts` - covers PLT-08, PLT-09 (codec A..Z/AA/AB and 3-letter rejection; case-insensitive parse; `rowLabel`/`parseRowLabel` round trip for 0..31; `dragRect` all four drag directions; `cellFromPoint` inside, in the gap/gutter, outside with and without clamp, scrolled box; `fitsAt` boundary +/-1; `sizeMismatch` tuple case; `sourcePatch`/`destPatch` uppercase + 1-based; typed-edit redraw only when all relevant fields parse; blank/0/flagged classification; `forceOpen` truth table incl. tool page without variables; `wellSizePx` 12 -> 18, 24 -> 12, 48 -> floor; status line strings incl. "Nothing selected", "N wells selected. Now place them on the destination.", "Transfer N wells: B3 -> C5"; mismatch copy with `8x12 vs 16x24`; a plate change never produces a clearing patch).
- [ ] `controller/test/fixtures/fastPlates.ts` - golden copied from the fast-mcp characterization test (`test_char_list_plate_definitions`): first entry `{ id: 1, description: "Default 96-Well Conical", rowCount: 8, colCount: 12, workingCapacity: 401.92 }`, and key order `id, description, rowCount, colCount, workingCapacity` [VERIFIED: /home/formulatrix/data/nikko/fast/fast-mcp/tests/test_server_json_characterization.py:247-249]; add a 384 entry (16x24) and bad-entry variants.
- [ ] Extend `test/toolOptions.parse.test.ts` (parsePlates: caps at/over, bad ids, missing geometry keeps the plate selectable, duplicate ids kept, empty `[]` ok, `kind` mismatch, `own()` prototype safety), `test/toolOptions.read.test.ts` (`fast.plates` through a fake **fast** tool: sends `{fast:{get_plates:{}}}`, `refresh:true` only on refresh, `wrong_tool_type` for a stack tool, cache/refresh throttle), `test/toolOptionsRouter.test.ts` (accepts `"fast.plates"`, still strict).
- [ ] Extend `test/fieldOptions.test.ts`: `static` view (born empty, saved 0/7/"x" kept with suffix, variable-bound), `plateOptions` (labels, duplicates), `plateGeometry` (unknown, unknown geometry, duplicates agree/disagree), `checkboxView` (reuse/fresh/blank/other/variable), `newStepDefaults`, `isNoZeroFillField`, numeric `applyChange`, `formatStatusLine` plates, `FIELD_BINDINGS.fast` coverage; and edit the three pins (Pitfall 4).
- [ ] Extend `test/staticScan.test.ts` (D-17 + extras): `OPTION_SOURCES` has the five sources incl. `fast.plates`; no `get_plates` literal in any `commandFields` file; `OptionsSelect.tsx`, `StaticSelect.tsx`, the checkbox and `WellPicker.tsx` contain none of `options[0]`, `selectedIndex`, `defaultValue`, `defaultChecked`, `selected=`, `placeholder=`; `WellPicker.tsx` has no `useEffect`/`useLayoutEffect`, no `setTimeout`/`setInterval`, no `elementFromPoint`, no `dangerouslySetInnerHTML`, and handles `onPointerCancel`; `WellPicker.tsx` and `wellGeometry.ts` never contain `tool.options` (only `useToolOptions.ts` reads it); `DECK_SLOTS` is defined exactly once (and `[1, 2, 3, 4, 5, 6]` appears nowhere else); `wellGeometry.ts` and `fieldOptions.ts` do not import `react`/`@chakra-ui`; hosts still render `<OptionsSelect` exactly in the three files; the modal `handleSubmit` still contains the four fill-in literals and now also the no-zero-fill branch.
- [ ] Test: save a modal step with untouched plate and deck fields and assert none is `0` (D-07). The modal cannot be rendered in tests, so extract the fill-in into a pure helper (for example `fillMissingParams(fields, params, toolType, command)` in `commandParams.ts` or `fieldOptions.ts`) and unit-test that; keep a thin call in `handleSubmit` so the scan literals stay in the region (or move the pinned literals to the helper and update the scan accordingly, deliberately).
- [ ] Framework install: none.

### Manual-Only Verifications
| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Source drag, destination hover footprint and click, Clear selection | PLT-08 | No DOM in Vitest | Fixture-driven or live: open the three hosts; drag on the source grid; confirm four fields sync live; hover then click the destination; confirm red when it does not fit and nothing is written; Clear empties all six. |
| "Edit as fields" opens on its own and cannot close | PLT-08/09 | Rendering | Hidden grid (no plate chosen, offline), a `{{variable}}` in a well field, a flagged value (row `ZZZ`, col past the plate). |
| Size mismatch warning (96 vs 384) | PLT-09 | Needs real plate list | After the gate: choose an 8x12 source and a 16x24 destination. |
| Layout in the modal (two 384 grids side by side?) and drawer (stack, scroll) | D-11 | Visual | Check widths; no horizontal overflow of the form. |
| Checkbox: new step starts checked; saved blank/other shows indeterminate and flag; click writes reuse/fresh | PLT-07 | Rendering | Open a saved step with `tip_reuse: ""` and `"cold"`. |
| Offline fallback: plate fields become typed numeric inputs with the hint | PLT-03 | Rendering | Stop the F.A.S.T. tool server; confirm typed "12a" cannot be entered as non-numeric. |
| Live plate list mid-Transfer | PLT-01 | Instrument | After the gate, with the supervised run. |

## Security Domain

`security_enforcement` is enabled (absent = enabled; `security_asvs_level: 1`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no change) | - |
| V3 Session Management | no (no change) | - |
| V4 Access Control | no (no change; `tool.options` stays a read-only query keyed by tool id) | - |
| V5 Input Validation | yes | Router: `z.object({toolId: z.string().max(200), source: z.enum(OPTION_SOURCE_IDS), refresh: z.boolean().optional()}).strict()`; reply: `parsePlates` with caps, `Number.isInteger`, int32 bound, `own()` reads; UI: numeric coercion in `applyChange`/typed fallback |
| V6 Cryptography | no | - |
| V7 Error handling / logging | yes (inherited) | Closed `UnavailableReason` codes, `sanitizeLogText` on audit rows, throttled logs |
| V14 Configuration | yes (supply chain) | Pinned submodule SHA, never `--remote`; pinned ts-proto 1.151.1; no new npm deps |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A fractional or out-of-range plate id truncated to a different physical plate (12.7 -> 12) | Tampering | Reject, never truncate (D-04); `Number.isInteger`, `>= 1`, `<= 2147483647` |
| Non-numeric text reaching int32 as `0` | Tampering | Numeric-only typed fallback; adapter refuses < 1 as the last guard |
| Oversized or hostile reply (DoS, memory) | Denial of Service | `MAX_PLATES`, string and geometry caps, whole-reply `too_large`, 5 s deadline, in-flight dedupe, refresh throttle (all inherited) |
| Prototype-chain reads (`constructor`, `__proto__` keys in a reply or a field name) | Tampering | `own()` helper; `lookupFieldBinding` own-property checks |
| `{{variable}}` smuggled in via an instrument-reported string | Tampering | Only the numeric id is ever written; the description is display text rendered by React (escaped), never a value |
| Client steering which instrument command is sent | Elevation of Privilege | Closed registry, strict zod enum, no command/params in the input, scan that only `toolOptions.ts` calls `.readOptions(` |
| Log injection via reply text | Repudiation | `sanitizeLogText` on audit details (inherited) |
| Raw HTML injection from plate descriptions | Tampering/XSS | No `dangerouslySetInnerHTML` (add to the scan for the new components) |
| Accidental motion command from a read | Tampering | `get_plates` is read-only by contract and never in `commandFields`; the read never enters the queue |

## Sources

### Primary (HIGH confidence) - read in this session
- `controller/server/toolOptions.ts` (full), `controller/components/tools/fieldOptions.ts` (full), `OptionsSelect.tsx`, `hooks/useToolOptions.ts`, `server/tools.ts` (`readOptions`, `_payloadForCommand`, `executeCommand` ~371-660), `server/routers/tool.ts` (`options`, `latchStatus`).
- Hosts: `AddToolCommandModal.tsx` (full), `CommandDetailsDrawer.tsx` (36-326, 520-690), `pages/tools/[id].tsx` (1-420).
- `controller/components/tools/constants.ts:312-340` (`commandFields.fast`), `commandParams.ts`, `utils/variableRef.ts`, `vitest.config.mts`, `tsconfig.json`, `test/setup.ts`, `test/helpers/fakeTool.ts`.
- Tests: `test/staticScan.test.ts` (873-1075 and the helpers), `test/fieldOptions.test.ts` (480-520, 920-930), `test/commandFields.test.ts`, `test/wire.test.ts` (1-200), `test/toolOptions.read.test.ts` (head).
- `vendor/galago-tools/interfaces/tools/grpc_interfaces/fast.proto`; `vendor/galago-tools/tools/fast/server.py` (60-135, 180-300, 500-560); `vendor/galago-tools/tools/stack/server.py` (`READ_COMMANDS` precedent).
- `/home/formulatrix/data/nikko/fast/fast-mcp/fast_mcp/{authoring.py,knowledge.py,service.py}` and `tests/test_server_json_characterization.py` (reply shape, `rowCount` default 0, tuple compare for -9006).
- Planning docs: `07-CONTEXT.md`, `07-DISCUSSION-LOG.md`, `REQUIREMENTS.md` (PLT), `STATE.md`, `research/FAST-GET-PLATES-CONTRACT.md`, `research/PLT-08-WELL-PICKER-MOCKUP.html` (script read), Phase 6 `06-VALIDATION.md`, `06-REVIEW-DISPOSITION.md`, `06-05-SUMMARY.md`, `06-UI-SPEC.md` (head).
- Commands run: `git ls-remote`, `git log --all -S`, scratch `protoc` + ts-proto 1.151.1 regen and `diff -r`, `protobufjs/minimal` int32 probe, a throwaway `react` import probe (deleted), `npx vitest run` (7-file subset), `npx prettier . --check`, `npx next lint --no-cache --quiet`.

### Secondary (MEDIUM confidence)
- `FAST-GET-PLATES-CONTRACT.md` is a **proposed** contract (status "proposed (2026-11-05)"), not a frozen commit.

### Tertiary (LOW confidence)
- Drawer width in px (Assumption A1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies; every touched module read in full.
- Architecture: HIGH for controller seams (verified fall-throughs, pins and the wire coercion); MEDIUM for the gated reply parsing (contract only).
- Pitfalls: HIGH - most reproduced by running code (wire bytes, `react` import, regen diff, existing test pins).
- Gate status: HIGH - measured against both remotes today; will change as soon as galago-tools freezes.

**Research date:** 2026-11-12
**Valid until:** until galago-tools freezes `get_plates` (re-run the gate checklist then); the controller-side findings are stable for 30 days unless Phase 6 modules change.
