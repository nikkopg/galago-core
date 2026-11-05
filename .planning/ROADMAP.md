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

- [ ] **Phase 6: STACK Dropdowns** - STACK robot, location, labware and transfer-profile fields offer
  instrument-reported lists, on one shared dropdown layer (DRP-01..09, STK-01..08).
- [ ] **Phase 7: F.A.S.T. Plate Dropdowns** - Transfer plate fields offer the instrument's registered plates;
  gated on galago-tools shipping `get_plates` (PLT-01..05).
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

**Plans**: 1/5 plans executed
Plans:
**Wave 1**
- [x] 06-01-PLAN.md — Re-pin vendor/galago-tools to 4ccd3da (zero-diff regen gate), tracer: robot/labware/transfer-profile dropdowns on the tool page end to end, user push checkpoint

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 06-02-PLAN.md — Server hardening: caps, TTL cache + configure generation, in-flight dedupe, Refresh, throttled logging, D-17 server scans
- [ ] 06-03-PLAN.md — React-free core: location cascade, calibration filter, ambiguity flags, applyChange, full view model, round-trip and wire proofs

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 06-04-PLAN.md — OptionsSelect all modes + Refresh row + status line, tool-page cascade wiring, D-17 client scans

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 06-05-PLAN.md — AddToolCommandModal and CommandDetailsDrawer (edit mode only), host scans, full phase gate

**UI hint**: yes
**Settle in discuss**: D6, D7, D10, D11 (standard patterns).

### Phase 7: F.A.S.T. Plate Dropdowns

**Goal**: The operator picks F.A.S.T. Transfer `source_plate_id` and `dest_plate_id` from the plates the
instrument has registered.
**Depends on**: Phase 6. **External**: galago-tools must freeze a read-only `get_plates` first (contract:
`.planning/research/FAST-GET-PLATES-CONTRACT.md`); this phase may slip without blocking Phases 8-9.
**Requirements**: PLT-01, PLT-02, PLT-03, PLT-04, PLT-05
**Success Criteria** (what must be TRUE):
  1. Gate: a frozen galago-tools `get_plates` answers through `ExecuteCommand` mid-Transfer, and the submodule is re-pinned to it with the exact expected interface diff.
  2. The plate fields are dropdowns of registered plates (id and description, numeric id sent) that start empty, like Phase 6.
  3. Invalid or duplicate plate ids are rejected or flagged, an unset plate never becomes `0`, and `get_plates` is never a step or tool-page command.

**Plans**: TBD
**UI hint**: yes
**Settle in discuss**: inherits D6, D10, D11 from Phase 6; open item is the frozen `get_plates` shape.

### Phase 8: Concurrency Lanes

**Goal**: With the lane flag on, one run can drive two tool servers at once and any failure freezes every lane
without aborting anything. Waves: lane engine first, then protocol surface and run page.
**Depends on**: Nothing from Phases 6-7
**Requirements**: LAN-01, LAN-02, LAN-03, LAN-04, LAN-05, LAN-06, LAN-07, LAN-08, LAN-09, LUI-01, LUI-02, LUI-03, LUI-04, LUI-05, LUI-06
**Success Criteria** (what must be TRUE):
  1. Flag off is byte-identical to today; flag on, steps on different tool servers overlap, one per tool server, honouring barriers.
  2. Any failure, a primary-lane modal or the operator's run-page freeze control stops new dispatch on every lane, and control, Stop and recovery still work on any lane.
  3. The operator can author lane-tagged protocols, is refused invalid setups, and sees per-lane steps, outcome and failures in the preview, Start confirmation and run page.

**Plans**: TBD
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
| 6. STACK Dropdowns | 1/5 | In Progress | - |
| 7. F.A.S.T. Plate Dropdowns | 0/TBD | Not started (external gate) | - |
| 8. Concurrency Lanes | 0/TBD | Not started | - |
| 9. Supervised Live Two-Tool Proof | 0/TBD | Not started | - |

## Backlog

(none)
