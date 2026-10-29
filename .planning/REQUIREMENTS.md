# Requirements: galago-core (nikkopg fork) — Live Run Control

**Defined:** 2026-10-28
**Milestone:** v2 STACK tool support — codegen, operator acknowledge, error visibility, F5
**Core Value:** While an instrument step runs, the operator sees what the instrument is doing and decides
every recovery action themselves: the web app never acts on its own and never pre-selects a physical
decision for the operator.

Split (user decision 2026-10-28): galago-tools owns the STACK adapter, the GAL-02 runbook protocol and
live acceptance; this repo owns codegen, command forms, operator UI and queue fixes; stack-automation-layer
core gaps are fixed there. Research: `.planning/research/SUMMARY.md` (`F5-ROOT-CAUSE.md`, `ACK-AND-F3.md`).

## v2 Requirements

### Queue start (F5, DEP-03c)

Research showed F5's Run 1 ran three distinct queued rows (a FAILED retry, a leftover row, the new row),
not one row three times. The real defect is an unguarded re-entrant `_start()`.

- [x] **QUE-07**: A Start, restart or enqueue while the busy loop is running never dispatches a row
  already in flight; the extra start is ignored and audited ("Queue Start Ignored"); a FakeGrpc test
  proves `executeCommand` is called once
- [x] **QUE-08**: Before a Start, the operator's Run confirmation shows how many queued rows will run,
  how many are FAILED retries and how many distinct runs they belong to — read-only, no default, no
  timer; the Start logs the queue_ids/run_ids it will run
- [x] **QUE-09**: Retry-after-failure and the h0q/o44/t9e behaviours are unchanged; their existing
  regression tests stay green unmodified

### Error visibility (F3, DEP-03b)

- [x] **ERR-01**: A test, written failing first, drives each tool response code through the queue and
  pins what the run UI receives
- [x] **ERR-02**: The operator sees the tool's own text for `ERROR_FROM_TOOL`; for other non-SUCCESS
  codes the tool's text is shown next to the generic sentence, not replaced; the logged code name is
  real, not "UNKNOWN"
- [x] **ERR-03**: A failed step shows its stored error message on its step card
- [x] **ERR-04**: After a dismiss, the error banner reappears on each new failure (a failure sequence
  number in `getError`)
- [x] **ERR-05**: No tool error renders as success: a failed step is never shown as completed, and a run
  whose failed step was skipped is not shown as plain success

### Operator acknowledge (DEP-03a)

- [x] **OPR-01**: Operator can send STACK AcknowledgeFailure from the tool-page Run Recovery card: guid
  text entry (blank refused, never trimmed), an explicit arm-inspected confirmation sent as the string
  `"yes"`, the guid restated in the confirm modal with ack-specific copy, no default, no timer, no
  Enter-bound default; through `tool.recoveryControl` with a recovery-only action map (`stack` is not
  added to `runControl`)
- [x] **OPR-02**: Every acknowledge attempt is audited (refused, transport error, outcome); it is refused
  while the queue's running step is on that tool (STACK-specific message); sent once, never retried
- [ ] **OPR-03**: Operator can see the latched guid from the step-card error and from an explicit "Read
  latch" button backed by a toolId-only `tool.latchStatus` query (no polling); "Use this guid" fills the
  input and never sends
- [ ] **OPR-04**: Protocols and the queue can never send an operator-only command: one table
  (`stack.acknowledge_failure`, fast `pause`/`resume`/`abort`) refuses such a run at creation with a
  visible message, and `Tool.executeCommand` refuses them, audited; `controlCommand` (the operator path)
  is unaffected
- [ ] **OPR-05**: Static scans pin: no code path acknowledges on its own; the `acknowledge_failure`
  literal appears only in an exact file list; it is in neither `commandFields` nor `runControl`; the
  guard is in `executeCommand` and not in `controlCommand`; the latch read has a single reader and is off
  the send path

### STACK codegen (DEP-02, gated on galago-tools Phase 4)

- [ ] **GEN-01**: `vendor/galago-tools` bumped to the frozen `stack.proto` commit; `gen-interfaces`
  regenerated with ts-proto 1.151.1 (`snakeToCamel=false`, never the local 1.153.2); tsc, unit suite and
  prettier green
- [ ] **GEN-02**: `commandFields.stack` covers every STACK command except `acknowledge_failure`; required
  strings are `text` fields with no `defaultValue`; no `select` pre-fills; the STACK tool's Config
  (host/port) is configurable from the tool page
- [ ] **GEN-03**: The tool-page command panel shows a command's reply `meta_data` read-only, so STACK
  reads are usable
- [ ] **GEN-04**: Activation tests run on the generated types: a real-encoder wire test of the
  acknowledge payload, the latch read, and the operator-only refusal keyed on `ToolType.stack`

## Future Requirements

- F.A.S.T. plate-list dropdowns for source/dest plates (pending todo)
- Decide whether `expected_tray_id` is still needed (pending todo)
- 02-REVIEW-DISPOSITION advisories WR-01..WR-04, IN-01
- `startNext` skipping STARTED rows as defence in depth (F5 research option 2)
- Recording who acted in the audit log (galago-web has no authentication)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-deleting leftover queue rows / stopping at run boundaries | Breaks retry-after-failure and decides for the operator |
| Per-run idempotency keys from the queue | Needs a proto change; the galago-tools step_key ledger is the defence in depth |
| Adding `stack` to `runControl` | Dead Pause/Resume/Abort, run-state poller, abort-first Stop with no STACK abort |
| Any code path that acknowledges, cancels, retries or parks the STACK | Every recovery action is an operator decision |
| STACK or F.A.S.T. motion from tests | Live runs only in galago-tools' supervised Phase 7 |
| GAL-02 protocol authoring | A runbook protocol in galago-tools, imported by the operator |
| `stack.proto` changes | Frozen for v2; a needed change stops the work for the user's sign-off in galago-tools |
| stack-automation-layer core fixes | Fixed there via `/gsd-quick` |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| QUE-07 | Phase 3 | Complete |
| QUE-08 | Phase 3 | Complete |
| QUE-09 | Phase 3 | Complete |
| ERR-01 | Phase 3 | Complete |
| ERR-02 | Phase 3 | Complete |
| ERR-03 | Phase 3 | Complete |
| ERR-04 | Phase 3 | Complete |
| ERR-05 | Phase 3 | Complete |
| OPR-01 | Phase 4 | Complete |
| OPR-02 | Phase 4 | Complete |
| OPR-03 | Phase 4 | Pending |
| OPR-04 | Phase 4 | Pending |
| OPR-05 | Phase 4 | Pending |
| GEN-01 | Phase 5 | Pending |
| GEN-02 | Phase 5 | Pending |
| GEN-03 | Phase 5 | Pending |
| GEN-04 | Phase 5 | Pending |

**Coverage:**
- v2 requirements: 17 total (QUE 3, ERR 5, OPR 5, GEN 4)
- Mapped to phases: 17 (Phase 3: 8, Phase 4: 5, Phase 5: 4)
- Unmapped: 0

---
*Requirements defined: 2026-10-28*
*Last updated: 2026-10-28 after roadmap creation (traceability filled)*
