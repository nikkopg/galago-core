# Roadmap: galago-core (nikkopg fork) — Live Run Control

## Milestones

- ✅ **v1 Live Run Control (queue & run page)** — Phases 1-2 (shipped 2026-10-16) — [archive](milestones/v1-ROADMAP.md)
- ✅ **v1.1 STACK tool support — codegen, operator acknowledge, error visibility, F5** — Phases 3-5 (shipped 2026-11-02) — [archive](milestones/v1.1-ROADMAP.md)
- 🚧 **v1.2 Tool-inferred dropdowns + per-tool concurrency lanes** — Phases 6-9 (in progress)

## Phases

<details>
<summary>✅ v1 Live Run Control (Phases 1-2) — SHIPPED 2026-10-16</summary>

- [x] Phase 1: Queue Control Path & Run State (5/5 plans) — completed 2026-10-13
- [x] Phase 2: Run Page Live Controls (6/6 plans) — completed 2026-10-15

</details>

<details>
<summary>✅ v1.1 STACK tool support — codegen, operator acknowledge, error visibility, F5 (Phases 3-5) — SHIPPED 2026-11-02</summary>

- [x] Phase 3: Queue Start Guard & Tool Error Visibility (7/7 plans) — completed 2026-10-29
- [x] Phase 4: Operator-only Commands & STACK Acknowledge (7/7 plans) — completed 2026-10-30
- [x] Phase 5: STACK Codegen & Command Forms (4/4 plans) — completed 2026-11-02

</details>

### 🚧 v1.2 Tool-inferred dropdowns + per-tool concurrency lanes (In Progress)

**Milestone Goal:** The operator picks STACK and F.A.S.T. command values from lists the instruments
report, and one run can drive two tool servers at once without weakening any operator-decides-recovery
guarantee. Research: `.planning/research/SUMMARY.md` (decisions D1-D12).

**Constraints (every v1.2 phase):**
- No STACK or F.A.S.T. motion from tests (fakes only); live runs only in Phase 9, supervised, typed GO.
- Nothing acknowledges, retries, pauses, resumes or aborts an instrument on its own; lane-halt only stops
  new dispatch.
- Dropdowns never preselect a physical choice. No `stack.proto` change, no new npm dependency.
- Lane mode is a default-off env flag; flag off is byte-identical to today.
- Push only to the `nikkopg` fork remote, and only when the user says so.

**Phase order:** 6 → 7 → 8 → 9. Phase 8 needs nothing from Phases 6-7, so Phase 7 may slip behind its
galago-tools gate without blocking Phases 8-9.

- [x] **Phase 6: STACK Dropdowns** - STACK robot, location, labware and transfer-profile fields offer (completed 2026-11-06)
  instrument-reported lists, on one shared dropdown layer (DRP-01..09, STK-01..08).
- [x] **Phase 7: F.A.S.T. Plate Dropdowns** - Transfer plate, deck and tip-reuse fields are dropdowns and the (completed 2026-11-16)
  well block is drag-selected on a plate grid; plate parts gated on galago-tools shipping `get_plates` (PLT-01..09).
- [ ] **Phase 8: Concurrency Lanes** - Behind a default-off flag, one run drives two tool servers at once,
  with lane authoring, per-lane run page and failure freeze (LAN-01..09, LUI-01..06).
- [ ] **Phase 9: Supervised Live Two-Tool Proof** - A supervised run shows STACK overlapping the F.A.S.T.
  transfer and a drill shows the freeze (LIV-01..03).

## Phase Details

### Phase 6: STACK Dropdowns

**Goal**: The operator fills the STACK `transfer`, `get_transfer_estimate` and `get_labware_presence` forms by
picking values the STACK reports, and the shared dropdown layer is ready for Phase 7.
**Depends on**: Nothing (first v1.2 phase)
**Requirements**: DRP-01, DRP-02, DRP-03, DRP-04, DRP-05, DRP-06, DRP-07, DRP-08, DRP-09, STK-01, STK-02, STK-03, STK-04, STK-05, STK-06, STK-07, STK-08
**Success Criteria** (what must be TRUE):
  1. The three STACK forms offer instrument-reported dropdowns that start empty and preselect nothing.
  2. An unreachable instrument or a saved value no longer reported never blocks or rewrites a step.
  3. What is sent is unchanged (saved protocols run as before), with `vendor/galago-tools` pinned to `4ccd3da` and no regen diff.

**Plans**: 5/5 plans complete
Plans:
**Wave 1**
- [x] 06-01-PLAN.md — Re-pin vendor/galago-tools to 4ccd3da (zero-diff regen gate), tracer: robot/labware/transfer-profile dropdowns on the tool page end to end, user push checkpoint

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 06-02-PLAN.md — Server hardening: caps, TTL cache + configure generation, in-flight dedupe, Refresh, throttled logging, D-17 server scans
- [x] 06-03-PLAN.md — React-free core: location cascade, calibration filter, ambiguity flags, applyChange, full view model, round-trip and wire proofs

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 06-04-PLAN.md — OptionsSelect all modes + Refresh row + status line, tool-page cascade wiring, D-17 client scans

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 06-05-PLAN.md — AddToolCommandModal and CommandDetailsDrawer (edit mode only), host scans, full phase gate

**UI hint**: yes
**Settle in discuss**: D6, D7, D10, D11 (standard patterns).

### Phase 7: F.A.S.T. Plate Dropdowns

**Goal**: The operator picks F.A.S.T. Transfer `source_plate_id` and `dest_plate_id` from the plates the
instrument has registered, picks decks and tip reuse from fixed lists, and drags the well block on a grid of
the chosen plate.
**Depends on**: Phase 6. **External**: galago-tools must freeze a read-only `get_plates` first (contract:
`.planning/research/FAST-GET-PLATES-CONTRACT.md`); this phase may slip without blocking Phases 8-9.
**Requirements**: PLT-01, PLT-02, PLT-03, PLT-04, PLT-05, PLT-06, PLT-07, PLT-08, PLT-09
**Success Criteria** (what must be TRUE):
  1. Gate: a frozen galago-tools `get_plates` answers through `ExecuteCommand` mid-Transfer, and the submodule is re-pinned to it with the exact expected interface diff.
  2. The plate fields are dropdowns of registered plates (id and description, numeric id sent) that start empty, like Phase 6.
  3. Invalid or duplicate plate ids are rejected or flagged, an unset plate never becomes `0`, and `get_plates` is never a step or tool-page command.
  4. Deck (1-6) fields are dropdowns that start empty and `tip_reuse` is a checkbox that starts checked (`reuse`; unchecked = `fresh`); these need no `get_plates` and may land in an early wave.
  5. Matching the approved mockup (`research/PLT-08-WELL-PICKER-MOCKUP.html`), dragging on the source grid sets start row/col and block size, and a click on the destination grid places the same-size footprint. Typed fields sit in a collapsed "Edit as fields" section that opens on its own for a hidden grid, a `{{variable}}` or a flagged value, and stay in sync; a block that does not fit is flagged, never clipped.
  6. Source and destination plates of different sizes (96 vs 384) are flagged on the destination grid before the run, since fast-mcp refuses cross-format transfers.

**Plans**: 10/10 plans complete
Plans:
**Wave 1** *(ungated)*
- [x] 07-01-PLAN.md — Tracer: deck 1-6 dropdowns on the tool page end to end (static binding, numeric write, wire), then the "Reuse tips" checkbox with the new-step default
- [x] 07-02-PLAN.md — React-free well-picker core (row codec, fit, (rows, cols) mismatch, hit-test, patches, flags, status line, force-open, view model) against fixture plates

**Wave 2** *(blocked on Wave 1 completion; 07-05 is the get_plates gate)*
- [x] 07-03-PLAN.md — Decks and checkbox in AddToolCommandModal and the edit-mode drawer; unset plate/deck saved as "" (fillMissingParams, D-07); local-field and get_plates scans
- [x] 07-04-PLAN.md — WellPicker component (pointer events, two grids, mismatch warning, Edit as fields, Clear selection) over the pure core
- [x] 07-05-PLAN.md — GATE: galago-tools freezes get_plates (blocking human checkpoint), ts-proto 1.151.1 legitimacy check, re-pin with exactly GetPlates + oneof 11, regen fast.ts, wire proof

**Wave 3** *(blocked on 07-05 gate)*
- [x] 07-06-PLAN.md — fast.plates source and parser on the server (registry, caps, bad ids, duplicates kept), router proof, read path, five-source and get_plates scans

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 07-08-PLAN.md — Plate dropdowns in all three hosts ({id} · {description}, numeric write, duplicate flags, numeric typed fallback), todo closed

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 07-07-PLAN.md — WellPicker mounted with real plates in the tool page, modal and edit-mode drawer; picker and host scans; full phase gate and UAT

**Wave 6** *(gap closure, from 07-VERIFICATION.md; 07-09 and 07-10 run in parallel)*
- [x] 07-09-PLAN.md — CR-01: int32-exact typed plate/deck/well values (kept verbatim and flagged when out of range), send-time guard in Tool#executeCommand, boundary tests on the real encoder
- [x] 07-10-PLAN.md — WR-01: pure source-grid drag reducer (wellPointer.ts) that WellPicker delegates to; node sequence tests close the SC5 drag behaviour gap

**UI hint**: yes
**Settle in discuss**: inherits D6, D10, D11 from Phase 6; open items are the frozen `get_plates` shape, the
grid picker's placement (inline vs modal, 384-well sizing), and whether it reuses
`components/ui/PlateGrid.tsx` styling. No new npm dependencies: drag is built on pointer events.

### Phase 8: Concurrency Lanes

**Goal**: With the lane flag on, one run can drive two tool servers at once and any failure freezes every lane
without aborting anything. Waves: lane engine first, then protocol surface and run page.
**Depends on**: Nothing from Phases 6-7
**Requirements**: LAN-01, LAN-02, LAN-03, LAN-04, LAN-05, LAN-06, LAN-07, LAN-08, LAN-09, LUI-01, LUI-02, LUI-03, LUI-04, LUI-05, LUI-06
**Success Criteria** (what must be TRUE):
  1. Flag off is byte-identical to today; flag on, steps on different tool servers overlap, one per tool server, honouring barriers.
  2. Any failure, a primary-lane modal or the operator's run-page freeze control stops new dispatch on every lane, and control, Stop and recovery still work on any lane.
  3. The operator can author lane-tagged protocols, is refused invalid setups, and sees per-lane steps, outcome and failures in the preview, Start confirmation and run page.

**Plans**: 2/10 plans executed
Plans:
**Wave 1** *(golden first: committed before any production edit)*
- [x] 08-01-PLAN.md — Golden transcript of today's queue (S0-S3) captured at the unmodified commit (LAN-01, D-09)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md — Pure lane policy laneScheduling.ts: stored fields, eligibility with the headline cycle as case 1, validateLanes sentences, grouping
- [ ] 08-03-PLAN.md — SqliteQueue.claimEligible (STARTED-excluding sync claim) and RunStateMonitor.stopIf(queueId)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 08-04-PLAN.md — Tracer: headline cycle overlaps on two fake tools with the flag on; per-lane Start guard, lifecycle, golden re-run in three constructions
- [ ] 08-08-PLAN.md — Pure client helpers: lane rows, lane-aware outcome, failure-list and panel copy, per-lane Start lines, drawer/preview helpers

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 08-05-PLAN.md — Fail-closed halt, modal gate, Freeze lanes (OFFLINE), bounded failure list, laneStatus/freezeLanes procedures, enqueue validation
- [ ] 08-07-PLAN.md — Run-creation refusal with name-guarded mapping, inert tags with the flag off, galago.lane script API, preview laneWarnings, compose flag

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 08-06-PLAN.md — Lane-aware control target, per-queueId abort markers, poller ownership, abort-first envelope, goto refusal, 20x engine loop
- [ ] 08-09-PLAN.md — Run page: Lanes panel with Freeze lanes, banner failure list, per-lane rows with timestamps, per-lane Start confirmation

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 08-10-PLAN.md — Drawer Lane/barrier controls, per-lane preview with warnings, phase gate

**UI hint**: yes
**Settle in discuss**: D1, D2, D3, D4, D9, D12 (D3 includes the freeze control and its run-page button).

### Phase 9: Supervised Live Two-Tool Proof

**Goal**: With the user present, a live run and a drill prove the overlap and the lane freeze, and the
resolution is recorded.
**Depends on**: Phase 8
**Requirements**: LIV-01, LIV-02, LIV-03
**Success Criteria** (what must be TRUE):
  1. A supervised live run shows a STACK step overlapping the F.A.S.T. transfer, with per-lane evidence rows, explicit step keys and the SHAs recorded.
  2. A simulated-failure drill freezes both lanes, with no automated motion.
  3. PROJECT.md, the lanes todo and (after the live run passes) the galago-tools runbook record the resolution.

**Plans**: TBD
**Settle in discuss**: D5, D8.

## Progress

**Execution Order:** 6 → 7 → 8 → 9 (Phase 7 may run after Phase 8 if its galago-tools gate is not ready).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. STACK Dropdowns | 5/5 | Complete    | 2026-11-06 |
| 7. F.A.S.T. Plate Dropdowns | 10/10 | Complete    | 2026-11-16 |
| 8. Concurrency Lanes | 2/10 | In Progress | - |
| 9. Supervised Live Two-Tool Proof | 0/TBD | Not started | - |

## Backlog

(none)
