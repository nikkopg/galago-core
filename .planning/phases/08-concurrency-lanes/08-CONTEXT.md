# Phase 8: Concurrency Lanes - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning
**Mode:** `--auto` (every gray area resolved to the research-recommended option; see `08-DISCUSSION-LOG.md`)

<domain>
## Phase Boundary

Behind a default-off env flag, one run can drive two tool servers at once: a tool step tagged with a lane
runs while another tool's step is in flight, at most one step per tool server. Any failure, a primary-lane
modal, or the operator's new "Freeze lanes" control stops **new** dispatch on every lane and never aborts
a running step; only an operator Start re-arms. The operator authors lane tags in the visual editor and in
scripts, is refused invalid setups at run creation, and sees per-lane steps, outcome and failures in the
preview, Start confirmation and run page.

Requirements: LAN-01..LAN-09 (engine), LUI-01..LUI-06 (protocol surface and run page).

**Waves (from ROADMAP):** lane engine first (golden transcript → pure eligibility → queue seams → halt →
control surface), then protocol surface and run page.

**Not in this phase:** any live STACK/F.A.S.T. motion (Phase 9, supervised, typed GO), the "goto-safe"
definition (D5) and the step-key auto-mint wording (D8), both Phase 9. Tests use fakes only.

</domain>

<decisions>
## Implementation Decisions

Research decision IDs (D1..D12) refer to `.planning/research/SUMMARY.md`. This phase settles D1, D2, D3,
D4, D9 and D12. Project constraints from ROADMAP v1.2 apply unchanged (no motion from tests, nothing
auto-acknowledges/retries/pauses/resumes/aborts, no `stack.proto` change, no new npm dependency, push
only to `nikkopg` and only when the user says so).

### Fork/join encoding (research D1; LAN-02, LAN-03, LUI-01, LUI-02)
- **D-01:** Encode lanes as two optional fields on each stored command:
  `advancedParameters.lane?: string` and `advancedParameters.laneBarrier?: boolean`
  (`controller/types/run.ts` `AdvancedParameters`). Absent `lane` or `"primary"` = primary lane. No DB
  migration (`command_data` is JSON). — **Reversibility:** costly — once operators save lane-tagged
  protocols, renaming or reshaping these fields needs a read-side compatibility shim for stored JSON.
- **D-02:** Do **not** reuse `runAsynchronously`. It is stored as literal `false` on every saved row
  (`server/runs.ts:117`, `server/scripting/protocol-script-executor.ts:30`, `ProtocolDetailView`,
  `AddToolCommandModal`); reinterpreting it would silently change stored data. Leave the dead switch as
  is (removal is a later cleanup).
- **D-03:** The cross-lane ordering primitive is the **barrier flag only**: a `laneBarrier` row waits for
  every earlier row of the run (all lanes) to be terminal. LAN-03's "dependency" is satisfied by the
  barrier; there is no per-step dependency list and no DAG scheduler (anti-feature). Eligibility follows
  ARCHITECTURE §4.2: a row is eligible when every earlier row in its own lane is terminal, every row
  before the most recent barrier is terminal, the run is the active run, its lane has no running step,
  the lane-halt/freeze latch is clear, and (D-11) no other controllable step is running.
- **D-04:** An untagged step behaves exactly as today: it waits for everything before it (primary lane
  is sequential, and a primary row is only eligible once earlier rows of every lane before it are
  terminal per the §4.2 rules). The headline cycle
  `in1 → in2 → { FAST(lane "fast", barrier) ∥ goto-safe } → out1(barrier) → out2` is test case 1 of
  `test/laneScheduling.test.ts`.
- **D-05:** Lane identity is a free-form name, trimmed and lower-cased, `[a-z0-9_-]{1,32}`, max 4 lanes
  per run. **One tool maps to exactly one lane per run** (so one tool server never receives two
  overlapping steps and the step-key ledger never sees a duplicate). Lanes only parallelise within one
  run; run N+1 waits for run N to drain, as today.

### Lane-mode flag (research D2; LAN-01)
- **D-06:** The flag is the env var **`GALAGO_PARALLEL_LANES`** (`"1"` = on; unset/anything else = off),
  read **once** at `CommandQueue` construction and injectable through the constructor for tests. Not
  `.planning/config.json` (not in the image) and not an async DB/app-setting read (an `await` before the
  claim breaks single-flight). Add it, unset, to `docker-compose.yml` / `docker-compose.dev.yml`
  environment as documentation. — **Reversibility:** reversible.
- **D-07:** Drop the todo's per-run `useParallelToolLanes`. The lane tags are the per-protocol opt-in;
  an untagged protocol is byte-identical even with the env flag on.
- **D-08:** With the flag off, lane tags are inert: not validated, not honoured, logged once per run
  ("lane tags ignored: parallel lanes disabled"). A lane-tagged protocol then runs sequentially, which is
  always safe.
- **D-09:** Flag-off byte-identity is proven by a **golden transcript captured at the pre-change commit
  as the first task of the phase** (ordered `logAction` actions, state transitions, `executeCommand` call
  order for a mixed Tool Box + tool run), asserted after the change with the env unset and with the env
  set but an untagged protocol. Every existing test passes unedited, except the single re-pinned
  `_start` static scan (the guard stays first among everything except the `_laneMode`-only early return).

### Engine shape (LAN-02, LAN-04, LAN-07, LAN-08)
- **D-10:** Keep the legacy busy loop as the primary-lane worker with three seams only (`_laneMode` early
  return in `_start`, `_pickNext()` that returns `this.commands.startNext()` byte-for-byte when off, a
  `WAIT` sentinel). Add **one** side-lane worker (`_runSideLane(lane)`) for tagged tool steps only, which
  reuses the existing failure primitives and never touches modal state. Pure policy lives in a new
  React/db-free `server/laneScheduling.ts` (`isEligible`, `pickEligible`, `validateLanes`). Claims go
  through an additive synchronous `SqliteQueue.claimEligible(queueId)` that excludes STARTED rows (the F5
  guarantee per lane). Halt check and claim happen in the same synchronous turn. Only the primary loop
  calls `stop()`, and only when the queue is empty (a lane draining never stops the others).
- **D-11 (research D9):** Keep the operator control surface single-slot via an **invariant**: at most one
  running step whose tool type has a `runControl` entry (today only F.A.S.T.); a second controllable step
  waits (eligibility rule). `toolControl` resolves its target from all running steps (primary +
  side lanes) filtered to controllable ones, so pause/resume/abort reach F.A.S.T. on whatever lane it
  runs. Make the abort marker, failed-attempt record and late-reply tracking **per queueId**;
  `RunStateMonitor` gains `stopIf(queueId)` so another lane's step never stops the F.A.S.T. poller;
  `recoveryControl` and abort-first Stop / Clear All / run delete check every running step on any lane.
  `ControlBar`, `ToolPausedModal`, `InstrumentStopModal`, `useRunControl` and the single-envelope
  `runState` stay byte-identical. — **Reversibility:** reversible — revisit only if a second
  controllable tool type is registered.

### Freeze semantics: failures, modals, tool pause, operator control (research D3, D4; LAN-05, LAN-06, LAN-09)
- **D-12:** **Fail closed:** any step failure on any lane latches the lane-halt. The latch is set
  synchronously as the first statement of the catch, before any `await`. It stops new dispatch on every
  lane; in-flight steps on other lanes run to their own end and are recorded normally; nothing is aborted.
- **D-13:** Only an **operator Start** clears the halt. Not `resume()`, not `clearError`, not the
  `enqueueRun` auto-start, not `_start` from any other source. An operator Start relaunches only idle
  lanes (the per-lane Start guard ignores a lane with a live loop, logging "lane already running"); the
  global "queue already running" message is used only when every lane with work is busy.
- **D-14 (research D4):** A modal on the primary lane (form, prompt, message, timer, pause step) stops
  new dispatch on every lane while it is open; running steps continue. Non-tool steps (Tool Box chain,
  assignments, forms, notes, `run_script`) run on the primary lane only, enforced at run creation
  (`validateLanes`), at enqueue and at dispatch. `skipExecutionVariable` stays lane-local (a small
  `_shouldSkip(row)` in the side worker; the legacy block is not refactored). Races between a primary
  `variable_assignment` and a side-lane `{{var}}` substitution are the author's to fence with a barrier
  (documented, not engine-enforced).
- **D-15 (research D3):** A tool-initiated pause does **not** fail the step, and the queue does not gate
  on polled `run_state` (that would be a forbidden state check). Instead add an operator-initiated
  **"Freeze lanes"** control (LAN-09): one action that sets the same dispatch latch as the lane-halt,
  aborts nothing, and is cleared only by an operator Start. A tRPC mutation on `commandQueue` plus a
  run-page button next to the existing control bar, shown only when lane mode is on and the active run
  has lane-tagged rows, with a short confirm explaining "stops new steps on every lane; running steps
  continue; press Start to resume dispatch". The run page shows a visible "Lanes frozen" state while the
  latch is set (by failure, freeze, or modal). — **Reversibility:** reversible.

### Failure banner (research D12; LUI-06)
- **D-16:** Replace "single error slot overwrites" with a **bounded per-lane failure list**: the first
  failure is kept and never overwritten while halted (it carries the STACK guid the operator needs for
  acknowledge); additional failures append, one entry per lane failure, capped (e.g. 8) with an overflow
  count. Each entry has lane, queueId, tool, message and time; each row still stores its own error (step
  cards). `_recordFailure` remains the single assignment site for queue error state. A second failure
  while halted also logs `"Lane Halt Additional Failure"` with both lane names. Flag off: the list holds
  at most one entry and the banner renders exactly as today.

### Validation and authoring surface (LUI-01..LUI-04)
- **D-17:** `validateLanes(commands)` runs at run creation (`server/runs.ts` `createFromProtocol`, after
  the operator-only scan) and refuses with a clear message: a non-tool step on a secondary lane, one tool
  on two lanes, an invalid lane name, more than 4 lanes, and a first secondary-lane row with no barrier
  (unless at position 0) so an author cannot fan out before the plates are placed. "Cycle" (LUI-03)
  cannot occur with barrier-only ordering; `validateLanes` still asserts eligibility is reachable (no
  dead-wait) so a malformed setup is refused rather than hanging. Map errors by **`Error.name` guard,
  not `instanceof`** (Phase 4 dev-recompile lesson). Preview returns the same messages as warnings.
- **D-18:** Visual editor: `CommandDetailsDrawer`'s Advanced Parameters accordion gains a **Lane** input
  (free text with suggestions of lanes already used in the protocol plus `primary`; blank = primary) and
  a **"Wait for all earlier steps"** switch (`laneBarrier`). Shown for tool steps only; Tool Box steps
  show no lane control. The controls are always shown for tool steps (even with the flag off) so
  protocols can be authored before the flag is enabled; a small note says lanes take effect only when
  parallel lanes are enabled on the server.
- **D-19:** Script API: `galago.lane(name)` sets the lane for subsequent `galago.command(...)` calls
  (matching LUI-02 and the todo), and `galago.command(toolId, command, params, { lane, barrier })` accepts
  per-call overrides. Barrier is a per-step flag; no separate `galago.barrier()` step.
- **D-20:** Preview and Start confirmation list steps grouped per lane (lane order = first appearance,
  barriers marked). `describeQueueStart` stays unchanged for untagged runs; lane runs append the per-lane
  listing.

### Run page (LUI-05)
- **D-21:** `SwimLaneComponent` renders one labelled row per lane **only when any row has a non-primary
  lane** (pure `groupRowsByLane(rows)` in `components/runs/utils.ts`); otherwise the legacy flat DOM is
  byte-identical. Each lane row shows its steps in order with their own statuses and start/end
  timestamps; cross-lane overlap is visible by timestamp. The 2 s `getAll` poll already carries lane and
  status per row.
- **D-22:** `deriveRunOutcome` becomes lane-aware **only when lane rows exist** (a run is complete when
  every lane is drained; failed if any lane has a failed row; "last row COMPLETED" no longer means done).
  Untagged runs keep today's logic exactly (research Pitfall 23 / L-6).

### Claude's Discretion
- File split and names beyond those fixed above, the exact failure-list cap, log wording, test file
  layout, and the precise visual treatment of lane rows and the "Lanes frozen" indicator (follow the
  existing run-page Chakra patterns; a UI-SPEC may refine it).
- Whether the freeze state shares the `_laneHalt` field with a `reason` (`failure | freeze | modal`) or
  uses sibling latches, as long as each is set/checked synchronously and only an operator Start clears
  failure/freeze.
- Injectable loop delay for deterministic two-loop tests (research Pitfall 25).

### Folded Todos
- **"Scheduler: per-toolId concurrency lanes for live two-tool runs"**
  (`.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md`, score 0.4, `resolves_phase: 8`).
  The origin of LAN/LUI. Folded with these amendments from research: no per-run `useParallelToolLanes`
  (D-07), env flag not `.planning/config.json` (D-06), explicit lane tag + mandatory barrier rather than
  automatic lane-per-toolId with an optional join (D-03, D-05), `galago.lane(...)` kept (D-19). Its live
  acceptance items and PROJECT.md/runbook resolution belong to Phase 9.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and decisions
- `.planning/ROADMAP.md` §"Phase 8: Concurrency Lanes" and the v1.2 constraints block — goal, success criteria, wave order
- `.planning/REQUIREMENTS.md` §"Lane engine (LAN)" and §"Lane protocol surface and run page (LUI)" — LAN-01..09, LUI-01..06
- `.planning/PROJECT.md` — Core Value (operator decides every recovery), Key Decisions (single-flight Start guard, `Error.name` guards, pure-logic tests + static scans, no jsdom)
- `.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md` — original problem, constraints 1-5, headline cycle

### Lane research (MUST read)
- `.planning/research/SUMMARY.md` — decisions D1-D12 table, lane risks
- `.planning/research/ARCHITECTURE.md` §4 (4.1 single-slot state inventory with line refs, 4.2 barrier/eligibility rules, 4.3 validation, 4.4 queue seams, 4.5 lane-halt, 4.6 control invariant, 4.7 protocol surface, 4.8 flag-off proof), §5-7 patterns and anti-patterns
- `.planning/research/PITFALLS.md` Pitfalls 12-25 and 27 — lane failure modes with file:line refs (12 single-slot state, 13 RunStateMonitor, 14 control surface, 15 halt window, 16 silent un-halt, 17 Start guard, 18 startNext FIFO, 19 drain stops all, 20 modal entanglement, 21 tool pause, 22 single error slot, 23 evidence order/outcome, 24 flag-off byte identity, 25 flaky timing tests, 27 lane typos)
- `.planning/research/FEATURES.md` — lane table stakes and anti-features

### Prior phase precedent
- `.planning/phases/07-f-a-s-t-plate-dropdowns/07-CONTEXT.md` and `.planning/phases/06-stack-dropdowns/06-CONTEXT.md` — static-scan and pure-module conventions used in v1.2

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `controller/server/command_queue.ts` (1504 lines): legacy busy loop, `_start` single-flight guard, `_failedAttempt` set-before-await idiom, `_recordFailure` single error site, `_recordAcceptedAbort`, Tool Box modal chain — the primary-lane worker, kept intact.
- `controller/server/utils/SqliteQueue.ts`: `startNext()` (global FIFO, does not filter STARTED), `fail`, `failAndDequeueRun` — add `claimEligible` additively.
- `controller/server/runState.ts`: `RunStateMonitor` (`start()` calls `stop()` first) — add `stopIf(queueId)`.
- `controller/server/runControl.ts` (`getRunControl`), `server/recoveryControl.ts`, `server/queueStartListing.ts` (`describeQueueStart`) — pure modules to extend.
- `controller/components/runs/runOutcome.ts`, `components/runs/utils.ts`, `components/runs/list/SwimLaneComponent.tsx`, `components/runs/RunsComponent.tsx` — run page outcome and rendering.
- `controller/components/protocols/CommandDetailsDrawer.tsx` (Advanced Parameters accordion, dead `runAsynchronously` switch at ~556) — lane authoring UI.
- `controller/server/scripting/protocol-script-executor.ts` — `galago.command` script API.
- `controller/server/runs.ts` — run creation, operator-only scan, `advancedParameters` pass-through (~112).

### Established Patterns
- Pure decision module + thin shell (`runControl.ts`, `controlDecision.ts`, `queueStartListing.ts`, `runOutcome.ts`) → `laneScheduling.ts`.
- Synchronous check-and-claim; no `await` between guard and claim (pinned by `test/staticScan.test.ts`).
- Failure latch set before first `await`.
- Only an explicit operator Start re-arms.
- Tests: Vitest, fakes via `installFakeTool`, static source scans, no jsdom.

### Integration Points
- `controller/types/run.ts` `AdvancedParameters` (new optional fields).
- `controller/server/routers/command_queue.ts` (`toolControl`, `restart`, new freeze mutation, failure list query/extension of `getError`).
- `controller/server/routers/tool.ts` (`recoveryControl` caller) and `routers/protocol.ts` (`preview`).
- `docker-compose.yml` / `docker-compose.dev.yml` environment (`GALAGO_PARALLEL_LANES`).

</code_context>

<specifics>
## Specific Ideas

- Headline cycle to pin in tests and preview: `in1 (STACK) → in2 (STACK) → { FAST liquid ~73 s (lane "fast", barrier) ∥ STACK short step (primary) } → out1 (STACK, barrier) → out2 (STACK)`.
- Lane-halt tests: A fails while B is in `await` (B dispatches nothing new); B fails while halted (both in the list, first kept); operator Start relaunches only the idle lane; `enqueue` auto-start, `resume()` and `clearError` do not clear the halt; Stop/Clear All abort-first reaches a side-lane F.A.S.T.

</specifics>

<deferred>
## Deferred Ideas

- Removing the dead `runAsynchronously` switch — later cleanup.
- Multiple controllable tool types concurrently (lifting the D-11 invariant) — revisit if a second `runControl` tool is registered.
- Per-step dependency lists / DAG scheduling and cross-run parallelism — explicitly out (anti-features).
- A poll-driven freeze on tool-initiated pause — rejected without explicit user sign-off (state check).
- D5 ("goto-safe" step definition) and D8 (auto-mint acceptance wording), live proof, PROJECT.md/runbook resolution — Phase 9.

</deferred>

---

*Phase: 08-concurrency-lanes*
*Context gathered: 2026-11-16*
