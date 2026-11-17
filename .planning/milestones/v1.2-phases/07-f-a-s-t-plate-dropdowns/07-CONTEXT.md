# Phase 7: F.A.S.T. Plate Dropdowns - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning. The plate parts are gated: galago-tools has not shipped `get_plates` yet (see D-01).
**Mode:** `--auto`. Every gray area was resolved with the recommended option (see `07-DISCUSSION-LOG.md`).

<domain>
## Phase Boundary

The F.A.S.T. `transfer` form changes in four ways:

- `source_plate_id` and `dest_plate_id` become dropdowns of the plates registered on the instrument,
  read through a new `fast.plates` source on the Phase 6 dropdown layer.
- `source_deck` and `dest_deck` become dropdowns of slots 1-6.
- `tip_reuse` becomes a "Reuse tips" checkbox.
- The six well fields (`source_start_row/col`, `dest_start_row/col`, `num_rows`, `num_cols`) are picked
  by dragging and clicking on two plate grids. The typed fields stay available in a collapsible
  section.

These changes appear in the same three hosts as Phase 6: the tool page, `AddToolCommandModal`, and
`CommandDetailsDrawer` in edit mode only.

Requirements: PLT-01..09. The cross-repo gate is PLT-01 and PLT-02: galago-tools freezes `get_plates`,
and `vendor/galago-tools` is re-pinned to that commit.

Not in this phase:
- Cross-format (96 ↔ 384) transfers and quadrant picking (Future Requirements)
- Option-label context such as plate capacity (Future Requirements)
- Lanes (Phases 8-9)
- Any change to `fast.proto` beyond the contract's `GetPlates` and oneof entry 11
- Any change to what a saved protocol sends for fields the operator did not touch

</domain>

<decisions>
## Implementation Decisions

Phase 6 decisions D-01..D-17 (`06-CONTEXT.md`) carry over unchanged unless a decision below says
otherwise. That covers the read path, the closed registry, never-throw `unavailable`, the TTL cache
with configure generation, react-query settings, the `OptionsSelect` modes, the variable picker, the
drawer reading only while `isEditing`, and the static scans. Settle-in-discuss items D6, D10 and D11
are therefore inherited as-is.

### Gate and wave order (PLT-01, PLT-02)
- **D-01:** As of 2026-11-12, galago-tools `origin/feat/stack-tool` has **no** `get_plates`. Its tip is
  still `4ccd3da`. The phase splits into two parts:
  - **Ungated part:** decks (PLT-06), the tip-reuse checkbox (PLT-07) and the React-free well-picker
    geometry core (grid math, label codec, fit and mismatch checks, field ↔ selection sync). The
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
  SHA. — **Reversibility:** reversible: the change is a submodule pointer.
- **D-02:** galago-core does not add the galago-tools adapter work. The contract
  (`research/FAST-GET-PLATES-CONTRACT.md`) is the hand-off. Building `get_plates` is a galago-tools
  task. If the user asks for it in this session, it goes to its own session in that repo.

### `get_plates` reply and the `fast.plates` parser (PLT-03, PLT-04)
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
  - **`rowCount` / `colCount`:** integers from 1 to a cap (planner's constant, at least 32 × 48).
    Missing or invalid geometry keeps the plate **selectable** but makes it "unknown geometry". The
    grid is then hidden for that plate (PLT-09), and its typed fields are used instead.
  - **Order:** keep the reply's order. Do not re-sort.
  - **Empty list:** `plates: []` is `ok` with no items, not `unavailable`.
- **D-05:** Duplicate ids are flagged, never collapsed (the Phase 6 D-08 pattern). Every entry that
  shares an id is shown with the label suffix "(duplicate id — check instrument)" and stays
  selectable. The grid for a duplicated id uses the geometry only when all duplicates agree.
  Otherwise the grid is hidden as "unknown geometry".
- **D-06:** The label is `"{id} · {description}"`, the same as the mockup ("12 · Greiner 96 flat").
  The value is the numeric id. The control compares values with `String(a) === String(b)` (Phase 6
  D-11) and writes a **number** to params, so the wire type matches today's typed `number` input. A
  saved id that is not reported is kept and marked "(not reported by instrument)" (DRP-02).

### Unset never becomes 0 (PLT-04)
- **D-07:** `AddToolCommandModal.handleSubmit` currently fills every unset `number` field with `0`
  (`AddToolCommandModal.tsx:~218`). That fill-in would turn an unset plate into plate `0`. This is a
  narrow, PLT-04-mandated exception to Phase 6 D-15: for the F.A.S.T. transfer fields that the binding
  map marks as "no-zero-fill" (both plate ids and both decks), an unset value is saved as `""`, never
  `0`. Every other field keeps today's fill-in. Saving is not blocked. The tool server stays the final
  check, and it refuses a plate or deck below 1 with a clear message. A test saves a step with
  untouched plate and deck fields and checks that none of them is `0`. The same rule applies to the
  tool-page and drawer submit paths if they have an equivalent fill-in. — **Reversibility:**
  reversible: it changes only newly saved steps, and existing rows are not rewritten.

### Decks (PLT-06)
- **D-08:** Deck fields get a static option list from the binding map: a new `{ kind: "static" }` role
  with options 1-6 taken from one constant that mirrors `_DECK_SLOTS = 6`, with a comment citing
  `tools/fast/server.py:129`. The constant must not be hard-coded twice. Deck fields have no read, no
  Refresh and no status line. They render through the same native `Select` with an empty placeholder,
  so nothing is preselected. They write a number. A saved value outside 1-6 (or non-numeric) is kept
  verbatim and marked "(not a deck slot 1-6)". `{{variable}}` binding works as in Phase 6 D-13.
  `commandFields.fast` stays as is (`type: "number"`), because the binding map decides how the field
  renders (D-10 precedent). This part is ungated.

### Tip reuse (PLT-07)
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
  | blank or any other string | indeterminate, with the flag "(saved value '{v}' — not reuse/fresh)" |

  The saved value is kept verbatim until the operator clicks, and a click then writes `reuse` or
  `fresh`. A `{{variable}}` shows the variable and disables the checkbox. This part is ungated.

### Well picker (PLT-08, PLT-09)
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
- **D-15:** A size mismatch is when source `rowCount × colCount` differs from destination
  `rowCount × colCount`. The destination grid then shows the warning "Plates differ in size (8×12 vs
  16×24) — the F.A.S.T. refuses cross-format transfers (-9006)" **instead of** a footprint, and
  clicks on it do nothing. The typed destination fields stay editable, and saving is not blocked
  (PLT-09).
- **D-16:** Hosts follow Phase 6. The grid renders on the tool page, in `AddToolCommandModal` and in
  `CommandDetailsDrawer` while `isEditing`. The read-only drawer on the run page is unchanged: it
  shows no grid and sends no read. The tool page has no variables, so on the tool page D-14 opens
  only for a hidden grid or a flagged value.

### `get_plates` stays internal (PLT-05)
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

### Folded Todos
- **"Fetch F.A.S.T. plate list for source/dest plate dropdowns"** (`.planning/todos/pending/2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md`,
  score 0.9, `resolves_phase: 7`): this todo is the origin of PLT-03..05. Its open question about
  offline behaviour is settled by D-03, and its `select`-only limitation is solved by the Phase 6
  binding map. Close it when PLT-03 ships.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and decisions
- `.planning/ROADMAP.md` § Phase 7: goal, success criteria, the gate, and the items to settle in discuss
- `.planning/REQUIREMENTS.md` § PLT-01..09, Future Requirements (cross-format, quadrant picking), Out of Scope
- `.planning/research/SUMMARY.md`: decisions D6, D10 and D11
- `.planning/PROJECT.md`: core value (no preselection of a physical value; `tip_reuse` is the one approved default)

### Phase 7 specifics
- `.planning/research/FAST-GET-PLATES-CONTRACT.md`: the `get_plates` proto, adapter, reply shape and tests. It is the source of truth until the frozen commit.
- `.planning/research/PLT-08-WELL-PICKER-MOCKUP.html`: the approved well-picker interaction (user, 2026-11-06). Read its script for drag, footprint and sync behaviour.
- `.planning/todos/pending/2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md`: the folded todo

### Prior phase precedent
- `.planning/phases/06-stack-dropdowns/06-CONTEXT.md`: D-01..D-17, the shared dropdown layer this phase extends
- `.planning/phases/06-stack-dropdowns/06-UI-SPEC.md`: copy and visual contract for `OptionsSelect`, Refresh and the status line
- `.planning/phases/06-stack-dropdowns/06-REVIEW-DISPOSITION.md`: review lessons from the layer
- `.planning/milestones/v1.1-phases/05-stack-codegen-command-forms/05-CONTEXT.md`: D-02, the ts-proto 1.151.1 regen mechanism

### Upstream (read-only)
- `vendor/galago-tools/interfaces/tools/grpc_interfaces/fast.proto`: the current F.A.S.T. command surface (oneof 1-10)
- `vendor/galago-tools/tools/fast/server.py`: `_DECK_SLOTS = 6` (line 129), Transfer validation (lines 199-226: deck 1-6, plate ≥ 1, `_ROW_RE` 1-2 letters, `_TIP_REUSE_MODES`), and the readiness-gate bypass (around lines 80 and 515-541)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `controller/server/toolOptions.ts`: the closed `OPTION_SOURCES` registry, parsers, cache and
  generation. `fast.plates` is added here.
- `controller/components/tools/fieldOptions.ts`: the binding map `FIELD_BINDINGS`, `SOURCE_LABELS`,
  copy constants and `buildFieldView`. Add the `fast.transfer` bindings and the new static and
  checkbox roles here.
- `controller/components/tools/OptionsSelect.tsx` and `controller/hooks/useToolOptions.ts`: the
  shared control and hook, already used by all three hosts.
- `controller/utils/variableRef.ts` (`isVariableLike`): detects `{{variable}}` values for D-09 and D-14.
- `controller/components/ui/PlateGrid.tsx`: **not** reused (D-10). Only its colour-token approach is
  borrowed.

### Established Patterns
- `commandFields.fast.transfer` is pinned by its name list (`test/commandFields.test.ts:29-43`) and
  by the `tip_reuse` select (`:7`). Rendering changes go through the binding map, not commandFields.
- Born-empty selects use a native Chakra `Select` with a placeholder. The existing `case "select"`
  in `AddToolCommandModal.tsx:641` falls back to `field.defaultValue`, which the checkbox override
  must not inherit.
- React-free logic plus Vitest 2.1.9 without jsdom. Architecture rules go into `test/staticScan.test.ts`.
- `test/wire.test.ts:85` sends a transfer with `tip_reuse: "fresh"`. The wire shape must not change.

### Integration Points
- `controller/components/protocols/AddToolCommandModal.tsx`: `renderField` (`OptionsSelect` at about
  line 321) and the `handleSubmit` zero fill-in at about lines 212-228 (D-07).
- `controller/pages/tools/[id].tsx`: the tool-page form (`OptionsSelect` at about line 287).
- `controller/components/protocols/CommandDetailsDrawer.tsx`: the edit-mode host (`OptionsSelect` at
  about line 250). The run page renders it read-only.
- `vendor/galago-tools` gitlink and `controller/gen-interfaces`: the re-pin and regen target (D-01).

</code_context>

<specifics>
## Specific Ideas

- The plate label copies the mockup exactly: `12 · Greiner 96 flat`. Grid captions copy it too:
  "drag to select" and "click to place".
- The mismatch warning names the -9006 refusal, so the operator knows the instrument itself will
  refuse the transfer, not just the UI.

</specifics>

<deferred>
## Deferred Ideas

- Cross-format 96 ↔ 384 transfers with quadrant placement (A1/A2/B1/B2). This needs fast-mcp
  multi-pass authoring first (Future Requirements).
- Plate size and `workingCapacity` in the option label (Future Requirements, option-label context).
- Building `get_plates` in galago-tools belongs to that repo's own GSD project, not here (D-02).

### Reviewed Todos (not folded)
- "Scheduler: per-toolId concurrency lanes" (score 0.6): this todo belongs to Phase 8 and is
  unrelated to plate dropdowns.

</deferred>

---

*Phase: 07-f-a-s-t-plate-dropdowns*
*Context gathered: 2026-11-12*
