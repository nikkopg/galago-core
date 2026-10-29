# Roadmap: galago-core (nikkopg fork) — Live Run Control

## Milestones

- ✅ **v1 Live Run Control (queue & run page)** — Phases 1-2 (shipped 2026-10-16) — [archive](milestones/v1-ROADMAP.md)
- 🚧 **v2 STACK tool support — codegen, operator acknowledge, error visibility, F5** — Phases 3-5 (in progress)

## Phases

<details>
<summary>✅ v1 Live Run Control (Phases 1-2) — SHIPPED 2026-10-16</summary>

- [x] Phase 1: Queue Control Path & Run State (5/5 plans) — completed 2026-10-13
- [x] Phase 2: Run Page Live Controls (6/6 plans) — completed 2026-10-15

</details>

### 🚧 v2 STACK tool support — codegen, operator acknowledge, error visibility, F5 (In Progress)

**Milestone Goal:** galago-core can send every STACK command, shows every STACK error as an error, gives
only the operator an audited AcknowledgeFailure, and the root cause of F5 (a queued command executed more
than once) is fixed. Research: `.planning/research/SUMMARY.md` (`F5-ROOT-CAUSE.md`, `ACK-AND-F3.md`).
Companion: galago-tools' own v2 milestone "STACK Tool & STACK↔F.A.S.T. Handoff" (`feat/stack-tool`), whose
phases are always written "galago-tools Phase N" here because its numbering (4-7) overlaps this one (3-5).

**Hard constraints (every v2 phase):**
- No STACK or F.A.S.T. motion from tests: fakes only (FakeGrpc, `"stack" as ToolType` fakes). Live runs
  happen only in galago-tools Phase 7, supervised, with the user present.
- No code path acknowledges, cancels, retries or parks the STACK on its own. Every recovery action is an
  operator decision, and the queue refuses a queued `stack.acknowledge_failure`.
- A STACK error never renders as success.
- A needed `stack.proto` change or a stack-automation-layer gap stops the work and is noted for the user.
  The proto is frozen in galago-tools; core gaps are fixed there via `/gsd-quick`, never here.
- Retry-after-failure stays: a FAILED row stays queued and re-runs first on the next Start.
- Push only to the `nikkopg` fork remote, and only when the user says so.

- [x] **Phase 3: Queue Start Guard & Tool Error Visibility** - A Start never dispatches a row already in (completed 2026-10-29)
  flight, the operator sees what a Start will run, and a failed step shows the tool's own message and is
  never shown as success (F5, DEP-03c; F3, DEP-03b).
- [ ] **Phase 4: Operator-only Commands & STACK Acknowledge** - Only an operator, from the tool page, can
  acknowledge a STACK failure; no protocol, script or queue row can (DEP-03a).
- [ ] **Phase 5: STACK Codegen & Command Forms** - Build against the frozen `stack.proto`, offer every STACK
  command as a form, and prove the acknowledge work on the real wire (DEP-02).

## Phase Details

### Phase 3: Queue Start Guard & Tool Error Visibility

**Goal**: A Start, restart or enqueue never dispatches a queue row that is already in flight; the operator
sees before confirming what a Start will run, so a stale leftover row is never a surprise; and when a tool
step fails, the operator sees the tool's own message wherever the failure shows, and no tool error is ever
shown as success.
**Depends on**: Nothing (first v2 phase; builds on v1's queue and run page)
**Requirements**: QUE-07, QUE-08, QUE-09, ERR-01, ERR-02, ERR-03, ERR-04, ERR-05
**Success Criteria** (what must be TRUE):
  1. While a step is in flight, pressing Run, restarting or enqueueing a run does not dispatch that row a
     second time: the tool receives one `executeCommand`, the queue still shows as running, and Logs record
     a "Queue Start Ignored" entry (a FakeGrpc test proves the call count stays at one).
  2. Before confirming a Start, the operator's Run confirmation shows how many queued rows will run, how
     many of them are FAILED retries and how many distinct runs they belong to, read-only, with nothing
     pre-selected and no timer; after the Start, Logs list the queue_ids and run_ids that Start will run.
  3. A FAILED step still stays queued and re-runs first on the next Start; the existing retry-after-failure,
     h0q, o44 and t9e regression tests pass unmodified.
  4. A test, written failing first, drives each tool response code through the queue and pins the message,
     code and stored error the run UI receives for that code.
  5. On a failed step the run page shows the tool's own text: for `ERROR_FROM_TOOL` the text itself, and for
     the other non-SUCCESS codes the tool's text next to the generic sentence rather than replaced by it;
     the code badge and the log show the real code name, never "UNKNOWN".
  6. A failed step's card shows its stored error message, including after the banner was cleared or
     galago-web restarted; after the operator dismisses the error banner, the next failure shows it again.
  7. A failed step is never shown as completed, a SUCCESS reply that carries an error message is reported
     as an error, and a run whose failed step was skipped is not shown as plain success.
**Plans:** 7/7 plans complete

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — (wave 1, tracer) Single-flight `_start` guard + "Queue Started" listing of what a Start will run (QUE-07, QUE-08, QUE-09)
- [x] 03-02-PLAN.md — (wave 1) ERR-01 error-path table over every ResponseCode, committed failing first (ERR-01)
- [x] 03-03-PLAN.md — (wave 1) Run confirmation shows queued steps / FAILED retries / runs from the queue-joined query (QUE-08)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-04-PLAN.md — (wave 2) Server error path: describeToolReply, real code name, SUCCESS+message as error, getError seq (ERR-01, ERR-02, ERR-04, ERR-05)
- [x] 03-05-PLAN.md — (wave 2) Run outcome: skipped failure never plain success, orange badge/progress (ERR-05)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-06-PLAN.md — (wave 3) Banner re-arm via dismissedSeq, step-card stored error, static scans + phase gate (ERR-03, ERR-04, ERR-05)

**Wave 4 — gap closure** *(UAT gap G-03-3)*
- [x] 03-07-PLAN.md — (wave 4, gap closure) Step-card error text beside the command image so it fits the 165px card and the sticky label never covers it; row-layout static scan; UAT test 3 retest (ERR-03)

**UI hint**: yes
**Notes**: Merged from the former Phases 3 (F5) and 4 (F3) on 2026-10-28 (user decision): no dependency
between them, and both edit `command_queue.ts`, the run page, its banner and the Run confirmation, so one
design pass avoids conflicting edits. Plans can still split by requirement group.
- F5 (F5-ROOT-CAUSE.md): F5's premise was wrong — Run 1 ran three different queued rows in one Start, as
  designed. The real defect is the unguarded re-entrant `_start()`; the guard must sit before the state flip
  so an ignored start does not move the queue out of BUSY. Out of scope: `startNext` skipping STARTED rows
  (Future Requirements), auto-deleting leftovers, idempotency keys (would need a proto change).
- F3 (ACK-AND-F3.md §4): the live F3 report ("nothing on screen") is not explained by reading the code
  alone, so the first F3 task is the failing test (criterion 4), not a fix. Re-arming the banner needs a
  failure sequence number in the `getError` payload, a small server change in the queue. §4.4 items 5-7 (a
  "Send to Tool" outcome toast, a persistent tool-page error toast, Gantt FAILED styling) are not mapped to
  any requirement, so they are not scheduled; add them as requirements or quick tasks if wanted.
- The confirmation and banner changes must keep the UI-08 static scan green (no timers, no state checks, no
  Enter-bound default).

### Phase 4: Operator-only Commands & STACK Acknowledge

**Goal**: Only an operator, from the tool page, can acknowledge a STACK failure, through an explicit and
audited confirmation; no protocol, script, imported file, editor or queued row can send an operator-only
command.
**Depends on**: Phase 3 (the latched guid is read from the step-card error, and the acknowledge's tests need
a real failure path). No dependency on `stack.proto`: built on string tool types and fakes.
**Requirements**: OPR-01, OPR-02, OPR-03, OPR-04, OPR-05
**Success Criteria** (what must be TRUE):
  1. From a STACK tool's Run Recovery card the operator types a guid (blank refused, never trimmed), opens a
     confirmation that restates the guid with acknowledge-specific copy, and must explicitly choose "Yes"
     with nothing pre-selected, no timer and no Enter-bound default; the request goes through
     `tool.recoveryControl` as the string `"yes"`, is sent once and is never retried.
  2. Every acknowledge attempt (refused, transport error, outcome) appears in Logs, and the acknowledge is
     refused with a STACK-specific message while the queue's running step is on that tool.
  3. The operator can see the latched guid in the failed step's error and via a "Read latch" button
     (explicit click, no polling); "Use this guid" fills the input and never sends.
  4. A protocol, script, imported JSON or queued row containing `stack.acknowledge_failure` (or fast
     `pause`/`resume`/`abort`) is refused when the run is created, with a visible message, and refused again
     with an audit entry if it reaches `Tool.executeCommand`; the Run Recovery path is unaffected.
  5. Static scans fail the suite if any code path acknowledges on its own, if the `acknowledge_failure`
     literal appears outside an exact file list, if it is added to `commandFields` or `runControl`, if the
     guard leaves `executeCommand` or lands in `controlCommand`, or if the latch read feeds the send path.
**Plans:** 1/5 plans executed

Plans:
**Wave 1**
- [x] 04-01-PLAN.md — (wave 1, tracer) Zero-import `recoveryActions.ts` spec + `validateRecoveryRequest`, `recoveryControl` reroute, exact one-send payload `{ stack: { acknowledge_failure: { guid, arm_inspected: "yes" } } }`, refuse-while-running, D-10 strict success (OPR-01 server, OPR-02)
- [ ] 04-02-PLAN.md — (wave 1, tracer) `operatorOnlyCommands.ts` refuse table + execute-time guard in `Tool.executeCommand` + enqueue guard in `createFromProtocol` with BAD_REQUEST/400 mapping (OPR-04)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 04-03-PLAN.md — (wave 2, tracer) Client ack UI: spec-driven `createConfirmedSender` recovery branch, modal per-kind render (born-empty radios, guid restated verbatim), card guid entry with the shared `isValidRecoveryGuid`, afterAccepted clear (OPR-01 client)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 04-04-PLAN.md — (wave 3, tracer) Latch read: `LATCH_READ_COMMAND` + `extractLatch`, toolId-only `tool.latchStatus` query through `tool.executeCommand`, card "Latched failure" block with "Use this guid" fill-only (OPR-03)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 04-05-PLAN.md — (wave 4) OPR-05 static scans: `acknowledge_failure` closed-file-list, guard placement in executeCommand not controlCommand, /latch/i send-path ban, single latch reader, no-self-acknowledge re-assertion + full-suite phase gate (OPR-05)

**UI hint**: yes
**Notes**: Planner must read ACK-AND-F3.md §1.2 so nobody "just adds `stack` to `runControl`" (it would start
the run-state poller, show dead Pause/Resume/Abort buttons, route Stop/Clear All through an abort-first
modal with no STACK abort, and make `toolControl("acknowledge_failure")` valid mid-step). Use the
recovery-only spec (`server/recoveryActions.ts`) and the one operator-only table
(`server/operatorOnlyCommands.ts`), guard on `String(this.toolType)`, and `"stack" as ToolType` fakes. The
latch-read command name is a single constant, set when galago-tools Phase 4 names it and pinned in Phase 5.
Not provable before codegen (Phase 5): the real-encoder wire test, `getToolConfigDefinition` for `stack`,
and creating a STACK tool row through `zToolType`. galago-web has no authentication, so "operator-only"
means unreachable from any protocol, script, queue row or editor, plus the core's exact-guid check.

### Phase 5: STACK Codegen & Command Forms

**Goal**: galago-core builds against the frozen `stack.proto`, offers every STACK command except
acknowledge as a command form, shows STACK read replies, and has the operator-acknowledge work proven on the
real generated types.
**Depends on**: Phase 4 **and** galago-tools Phase 4, the hard gate: its frozen `stack.proto` must be pushed
to `feat/stack-tool` (it is not there yet). This phase cannot start until it is.
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04
**Success Criteria** (what must be TRUE):
  1. galago-core builds against the frozen proto: `vendor/galago-tools` sits at the frozen `stack.proto`
     commit, `gen-interfaces` is regenerated with ts-proto 1.151.1 (`snakeToCamel=false`, never the local
     1.153.2), and `tsc`, the unit suite and prettier are green.
  2. The operator can open a STACK tool page and set its Config (host/port) there.
  3. The tool-page command panel lists every STACK command except `acknowledge_failure`; required strings
     are empty text fields with no default, and no `select` pre-fills a value.
  4. Running a STACK read from the tool page shows the reply's `meta_data` read-only under the command form.
  5. Activation tests pass on the generated types: a real-encoder wire test of the acknowledge payload and
     the latch read, and the operator-only refusal keyed on `ToolType.stack`.
**Plans**: TBD
**UI hint**: yes
**Notes**: Mechanical, following `128bbd7`. Stop condition: if the frozen proto renames `guid` /
`arm_inspected`, has no latch-read command, or lets an adapter reply break the empty-message-on-SUCCESS rule
(STK-07), a proto change is needed; stop and note it for the user, it is made in galago-tools. Carry the
activation tests from ACK-AND-F3.md §5.3, including a contract test that the latch-read constant is a key of
the generated `stack.Command` oneof. Do not copy the F.A.S.T. `scan_tips` `defaultValue: false` pattern for
any STACK field. Delivers galago-tools DEP-02, which unblocks galago-tools Phases 6-7. Tests use fakes; no
STACK motion.

## External Gates (cross-repo, not requirements)

| Gate | Direction | What it covers | Gates | Status |
|------|-----------|----------------|-------|--------|
| galago-tools DEP-02 | This milestone delivers (Phase 5) | Submodule bump, ts-proto 1.151.1 regen, `commandFields.stack` without acknowledge | galago-tools Phase 6 (FLOW-02..04) and Phase 7 (LIVE-*), hard gate | Not started; waits on galago-tools Phase 4 |
| galago-tools DEP-03 | This milestone delivers (Phases 3-4) | F5 root cause and F3 tool-error display (Phase 3), operator AcknowledgeFailure on the D-20 pattern (Phase 4) | galago-tools Phase 7, recommended before live runs, not a hard gate | Not started |
| galago-tools Phase 4 | This milestone waits on (Phase 5) | The frozen `stack.proto` pushed to `feat/stack-tool`, with `AcknowledgeFailure(guid, arm_inspected)` and a latch-read command | galago-core Phase 5, hard gate | Not pushed to `feat/stack-tool` yet |

Phases 3-4 do not wait on any other repo. galago-tools DEP-01 (stack-automation-layer G1-G3) gates only
galago-tools Phase 5; nothing here waits on it. A needed `stack.proto` change or stack-automation-layer gap
found while building stops the work and is noted for the user; it is never patched in this repo.

## Progress

**Execution Order:**
Phases execute in numeric order: 3 → 4 → 5 (Phase 5 waits on galago-tools Phase 4)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 3. Queue Start Guard & Tool Error Visibility | v2 | 7/7 | Complete    | 2026-10-29 |
| 4. Operator-only Commands & STACK Acknowledge | v2 | 1/5 | In Progress | - |
| 5. STACK Codegen & Command Forms | v2 | 0/TBD | Not started (gated on galago-tools Phase 4) | - |

## Backlog

(none)
