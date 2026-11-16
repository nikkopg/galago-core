# Phase 8: Concurrency Lanes - Research

**Researched:** 2026-11-16
**Domain:** In-process job scheduler (Node/TypeScript `CommandQueue` over SQLite) plus Next.js/Chakra run page; per-tool concurrency lanes behind a default-off env flag
**Confidence:** HIGH for every code fact (all read this session at HEAD `31838b2`); MEDIUM for the engine design (reasoned from the code, not prototyped); the Assumptions Log lists what is design judgment

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Research decision IDs (D1..D12) refer to `.planning/research/SUMMARY.md`. This phase settles D1, D2, D3,
D4, D9 and D12. Project constraints from ROADMAP v1.2 apply unchanged (no motion from tests, nothing
auto-acknowledges/retries/pauses/resumes/aborts, no `stack.proto` change, no new npm dependency, push
only to `nikkopg` and only when the user says so).

#### Fork/join encoding (research D1; LAN-02, LAN-03, LUI-01, LUI-02)
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

#### Lane-mode flag (research D2; LAN-01)
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

#### Engine shape (LAN-02, LAN-04, LAN-07, LAN-08)
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

#### Freeze semantics: failures, modals, tool pause, operator control (research D3, D4; LAN-05, LAN-06, LAN-09)
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

#### Failure banner (research D12; LUI-06)
- **D-16:** Replace "single error slot overwrites" with a **bounded per-lane failure list**: the first
  failure is kept and never overwritten while halted (it carries the STACK guid the operator needs for
  acknowledge); additional failures append, one entry per lane failure, capped (e.g. 8) with an overflow
  count. Each entry has lane, queueId, tool, message and time; each row still stores its own error (step
  cards). `_recordFailure` remains the single assignment site for queue error state. A second failure
  while halted also logs `"Lane Halt Additional Failure"` with both lane names. Flag off: the list holds
  at most one entry and the banner renders exactly as today.

#### Validation and authoring surface (LUI-01..LUI-04)
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

#### Run page (LUI-05)
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

### Deferred Ideas (OUT OF SCOPE)
- Removing the dead `runAsynchronously` switch — later cleanup.
- Multiple controllable tool types concurrently (lifting the D-11 invariant) — revisit if a second `runControl` tool is registered.
- Per-step dependency lists / DAG scheduling and cross-run parallelism — explicitly out (anti-features).
- A poll-driven freeze on tool-initiated pause — rejected without explicit user sign-off (state check).
- D5 ("goto-safe" step definition) and D8 (auto-mint acceptance wording), live proof, PROJECT.md/runbook resolution — Phase 9.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAN-01 | Lane env var off = byte-identical queue; golden transcript before the change; existing tests unedited | Section "Golden transcript (LAN-01)": exact shape, determinism recipe, three post-change configurations; baseline 37 files / 1094 tests green |
| LAN-02 | Lane-tagged step runs while another tool's step runs; at most one step per tool server in flight | `pickEligible` rule 4 + in-memory busy-tool check; `_runSideLane`; one-tool-one-lane in `validateLanes` |
| LAN-03 | Barrier/dependency; untagged waits for everything before it | Eligibility rules (section "Eligibility, as implemented"), headline cycle as test case 1 |
| LAN-04 | Per-lane single-flight Start guard; Start never re-dispatches an in-flight row | `_startLanes` synchronous per-lane guard, `claimEligible` excludes STARTED, `isStartInProgress` lane branch |
| LAN-05 | Any failure stops new dispatch on every lane; nothing aborted; only operator Start clears | `_laneHalt` latch set as first statement of both catches; clearing rules table |
| LAN-06 | Primary-lane modal stops new dispatch everywhere; non-tool steps primary only | Modal observation recipe (sync read of `_isWaitingForInput` plus STARTED Tool Box row rule) |
| LAN-07 | Pause/resume/abort reach F.A.S.T. on any lane; poller never stopped by another lane; per-step abort markers | `toolControl` target resolution, per-queueId markers, `RunStateMonitor.stopIf`, monitor start only for controllable steps |
| LAN-08 | Stop, Clear All, run delete abort first for every controllable running step on any lane | Envelope correctness is the whole mechanism (client intercept reads the single `runState` envelope); no server change beyond LAN-07 |
| LAN-09 | Operator "Freeze lanes" control | `commandQueue.freezeLanes` mutation + `laneStatus` query + `LanesPanel`; Start-button gating discovered (see Pitfall P-4) |
| LUI-01 | Visual editor lane + barrier controls | Drawer Advanced Parameters shape, pure `laneFields.ts` helper, static pins |
| LUI-02 | `galago.lane(...)` + barrier in script protocols | `protocol-script-executor.ts` current API shape and the Tool Box inheritance trap |
| LUI-03 | Run creation refuses invalid lane setups | `validateLanes`, `LaneValidationError` name guard, three mapping sites (router, API route, runs.ts rethrow list) |
| LUI-04 | Preview and Start confirmation list steps per lane | `protocol.preview` is script-only; `queuedStartLines` + `describeQueueStart` extension points |
| LUI-05 | Run page per-lane steps/status/timestamps; lane-aware outcome | `SwimLaneComponent`, `groupRowsByLane`, `deriveRunOutcome` ordering bug (L-6) re-verified |
| LUI-06 | Banner lists each lane's failure; first keeps the STACK guid | Banner path end-to-end; bounded list inside `_recordFailure`; new `laneStatus` query instead of changing `getError` |
</phase_requirements>

## Summary

Phase 8 is a surgical extension of one 1504-line class plus a thin protocol/run-page surface. The milestone research (ARCHITECTURE §4, PITFALLS 12-25, 27) is sound and its `command_queue.ts` line references are all still exact: `git log` shows the file last changed in Phase 4 (`b0dcc40`), so Phases 6-7 did not move it. The stale references are in *other* files (table below). No new npm dependency, no `stack.proto` change, no migration.

The most valuable additions of this pass are things the milestone research did not know: (1) the legacy `Pause queue` button already freezes dispatch without aborting, but the run page intercepts it with the abort-first modal whenever a controllable step runs, which is exactly why a separate Freeze control is needed (and a separate component, because `ControlBar.tsx` is pinned against modal plumbing); (2) the run page shows the **Start** button only when `state !== BUSY` (`QueueStatuscomponent.tsx`), so a freeze that leaves the state BUSY could never be released from the UI; (3) the existing `_start` static pin passes *unedited* with the lane early return (verified by simulation), so "re-pinning" is an additive tightening, not an edit; (4) `goto` steps and the operator `gotoCommand*` mutations re-queue rows by position and would reset a STARTED side-lane row to CREATED (an F5-class double send) unless lane-tagged runs refuse them; (5) `protocol.preview` is script-mode only, so "preview" for visual protocols has to be computed client-side from the pure module; (6) `describeQueueStart`, `queuedStartLines`, `deriveRunOutcome`, `getRunAttributes` and the banner all have exact insertion points that keep untagged output byte-identical.

**Primary recommendation:** Build tracer-first in this order: golden transcript at the unmodified commit (commit it before touching `command_queue.ts`), pure `laneScheduling.ts` + `claimEligible` + `stopIf`, then ONE thin vertical slice (the headline cycle overlapping on fake tools through `_startLanes`/`_pickNext`/`_runSideLane`), then halt/freeze/modal, then control surface, then Wave 2 (validation + script API, pure client modules, UI wiring). Keep every untagged code path a literal no-op: put every new statement behind `_laneMode`, `_laneHalt !== undefined`, or "row has a lane tag".

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Eligibility / barrier / validation policy | API / Backend (pure module `server/laneScheduling.ts`) | Browser (imports the same pure module for the visual-protocol summary and lane-row grouping) | Import-free module is already imported by the client elsewhere (`runControl.ts`, `toolKey.ts`) |
| Atomic claim of a row (F5 guarantee) | Database / Storage (`SqliteQueue.claimEligible`, one sync transaction) | API (`_pickNext` calls it in the same turn as the halt check) | Check and claim must have no `await` between them |
| Lane workers, latch, failure list, per-queueId markers | API / Backend (`CommandQueue`) | — | All in-memory single-process state; the queue is the only dispatcher |
| Lane-mode flag | API / Backend (env read at construction) | Browser reads it only through `laneStatus.laneMode` | Never `NEXT_PUBLIC_*`; the client must not hold its own copy |
| Run-creation refusal | API / Backend (`RunStore.createFromProtocol`) | Browser shows the message | Same slot as the operator-only scan |
| Lane authoring (drawer controls, script API) | Browser (drawer) and API (script executor) | Database (JSON pass-through) | Stored in `advancedParameters`, no schema change |
| Per-lane run page, outcome, banner list, Freeze button | Browser (Chakra components, pure helpers) | API (`laneStatus` query, `freezeLanes` mutation) | The 2 s `getAll` poll already carries lane + status + timestamps per row |
| Abort-first Stop/Clear All/delete | Browser (intercept reads the single `runState` envelope) | API (envelope correctness via `stopIf`) | Server `stop()`/`clearAll` have no running-step check at all |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^12.5.0 (already installed) | `claimEligible` sync transaction | Every other row mutation in `SqliteQueue` uses it [VERIFIED: controller/package.json `"better-sqlite3": "^12.5.0"`] |
| vitest | 2.1.9 (already installed, `npx vitest --version` printed `vitest/2.1.9 linux-x64 node-v24.14.1`) | Pure-logic tests, fake timers, source scans | No jsdom; existing convention |
| @trpc/server | ^10.9.0 (already installed) | `laneStatus` query, `freezeLanes` mutation | Same router file as `restart`/`toolControl` |
| @chakra-ui/react | already installed | Lane rows, `LanesPanel`, drawer controls | Existing run-page patterns |

### Supporting
None. Native `Map`/`Set`/`Promise`/`setTimeout` only (CONTEXT: no new npm dependency; no `p-queue`, no `async-mutex`).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `laneStatus` query | Extend `getError` payload | `getError` is asserted by `errorPath.test.ts` (`toMatchObject`, `not.toHaveProperty("stack")`) and consumed by two components; an additive sibling query keeps flag-off payload byte-identical and also serves the Freeze indicator and "still running" lane list |
| Append new describe block to `test/staticScan.test.ts` | New scan file | Phases 6-7 already appended `describe` blocks at lines 873-1303; additive, no existing assertion edited. A new file would have to duplicate the file-local helpers (`walk`, `stripComments`, `extractBracedRegion` are not exported) |

**Installation:** none.

**Version verification:** no package is added, so no registry lookup applies. Versions above were read from `controller/package.json` and the vitest CLI this session.

## Package Legitimacy Audit

This phase installs **no** external packages. Nothing to audit.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
operator ──Start──► commandQueue.restart ──► _start(source)
                                              │ (flag off) legacy guard ─► busy loop ─► startNext()   [byte-identical]
                                              └ (flag on)  _startLanes(source)
                                                   sync: per-lane guard, clear latch (operator only), launch idle lanes
                                                          │
              ┌───────────────────────────────────────────┴───────────────────────────────┐
              ▼ primary loop (legacy busy loop + 3 seams)                                 ▼ side loop per extra lane (_runSideLane)
        delay ─► _pickNext("primary")                                                delay ─► state/latch check ─► _pickNext(lane)
              │   gate = {latch, modalOpen, busyTools, controllableRunning}                   │ same gate
              │   queuedRowsSync() ─► pickEligible() ─► (same sync turn) claimEligible()      │ same
              ├─ WAIT  ─► loop again                                                          ├─ WAIT / drained ─► loop or exit
              ├─ false ─► stop()  (queue empty = every lane drained)                          │
              ▼ Tool Box chain (modals, goto, assignment) or tool step                        ▼ _shouldSkip ─► tool step only
        executeCommand ─► complete()                                                    executeCommand ─► complete()
              │ catch (first stmt: latch)                                                     │ catch (first stmt: latch)
              └──► _recordFailure (single site; bounded list) ─► _setState(FAILED) ─► notify (not awaited)

 shared, read-only to the pickers:  _laneHalt (failure|freeze)   _isWaitingForInput (modal)   in-memory running steps
 run page ◄── getAll 2 s (rows carry lane/status/timestamps) ◄── laneStatus ~1.5 s ◄── CommandQueue
 operator ──Freeze──► commandQueue.freezeLanes ─► latch + OFFLINE, nothing aborted   (only a Start clears it)
```

### Recommended Project Structure
```
controller/
├── server/
│   ├── laneScheduling.ts        # NEW import-free: PRIMARY_LANE, normalizeLane, laneOf, isBarrier, isToolBoxStep,
│   │                            #   pickEligible/isEligible, lanesWithWork, validateLanes, simulateDrain,
│   │                            #   LaneValidationError + isLaneValidationError
│   ├── command_queue.ts         # MOD seams only (see "Seams")
│   ├── runState.ts              # MOD + stopIf(queueId)
│   ├── runs.ts                  # MOD validateLanes after the operator-only scan; rethrow list; laneMode read
│   ├── recoveryControl.ts       # unchanged signature
│   ├── queueStartListing.ts     # MOD optional lane listing (untagged output unchanged)
│   ├── utils/SqliteQueue.ts     # MOD + claimEligible (additive, sync)
│   ├── scripting/protocol-script-executor.ts  # MOD galago.lane + per-call options
│   └── routers/{command_queue,run,tool,protocol}.ts + pages/api/runs/index.ts   # MOD
├── components/runs/
│   ├── utils.ts                 # MOD + groupRowsByLane
│   ├── runOutcome.ts            # MOD lane-aware branch only when lane rows exist
│   ├── queuedStartSummary.ts    # MOD lane lines only for lane runs
│   ├── laneStatus.ts            # NEW pure: describeLaneFailures, freeze/halt wording
│   ├── LanesPanel.tsx           # NEW Freeze button + "Lanes frozen" + still-running lanes
│   └── list/SwimLaneComponent.tsx  # MOD lane rows only when lane rows exist
├── components/protocols/
│   ├── laneFields.ts            # NEW pure: setLane/setBarrier/suggestLanes (never writes "" or false)
│   └── CommandDetailsDrawer.tsx # MOD controls in the Advanced Parameters accordion
├── hooks/useLaneStatus.ts       # NEW single reader of commandQueue.laneStatus
└── test/                        # see Validation Architecture
```

### Pattern 1: Pure decision module + thin shell
**What:** all eligibility policy in `server/laneScheduling.ts`; the class only feeds it rows and context and acts on the verdict. **Precedent:** `runControl.ts` ("No imports" header), `toolKey.ts`, `queueStartListing.ts`, `runOutcome.ts`. The client already imports such server modules (`ControlBar.tsx` imports `type { RunStateEnvelope } from "@/server/runState"`; `toolKey.ts` header documents safe client import as a VALUE).

### Pattern 2: Synchronous check-and-claim
No `await` between reading the latch/modal/busy gate and `claimEligible`. `claimEligible` is a **non-async** method (unlike `startNext`, which is `async` but whose body is fully synchronous) so the guarantee is visible in the signature.

### Pattern 3: Latch before the first await
Set `_laneHalt` as the first statement of the catch, exactly like `_failedAttempt` at `command_queue.ts:1385` which carries the comment "Synchronously, before the first await".

### Pattern 4: Only an operator Start re-arms
Nothing else clears the latch (table below).

### Seams in `command_queue.ts` (all line numbers re-verified at HEAD `31838b2`)

| Seam | Where | Flag-off behaviour |
|------|-------|--------------------|
| Constructor option | `constructor(public runStore: RunStore)` (line 110) gains optional 2nd param `{ parallelLanes?: boolean; loopDelayMs?: number }`; `_laneMode = options?.parallelLanes ?? process.env.GALAGO_PARALLEL_LANES === "1"`. Precedent for an env read in the constructor: `const dbPath = process.env.SQLITE_DB_PATH \|\| path.join(...)` (line 111) | `false`; delay stays `1500` |
| `_start` early return | first line of `async _start(` (914): `if (this._laneMode) return this._startLanes(source);` | not taken |
| Pickup | line 1003 `const nextCommand = await this.commands.startNext();` becomes `await this._pickNext("primary")` + `WAIT` check | returns `this.commands.startNext()` unchanged |
| Loop delay | line 1002 `setTimeout(resolve, 1500)` becomes `setTimeout(resolve, this._loopDelayMs)` | 1500 |
| Monitor bracket | lines 1360/1364 `this._runStateMonitor.start(...)`/`.stop()` | lane mode: `start` only if `getRunControl(step.toolType)`, `stop` becomes `stopIf(queueId)`; flag off literal `start`/`stop` |
| Catch | first statement of the catch at 1374 | `if (this._laneMode) this._latchFailure(...)` |
| `toolControl` | line 530 `const step = this._runningStep;` | candidate list `[_runningStep]` |
| `_recordAcceptedAbort` | lines 640/645 | `_isRunning(step)` equals `_runningStep === step` |
| `resume()` | line 844 `if (this.error) {` | add `&& !this._laneHalt` (always true when off) |
| `enqueueRun` | line 1489 `if (this.state === ToolStatus.READY)` | unchanged; lane branch lives inside `_startLanes` |

### Eligibility, as implemented (precise form of ARCHITECTURE §4.2)

Inputs: `rows` = `queuedRowsSync()` (position order, includes STARTED and FAILED rows; `complete`/`skip` delete the row from `_queue`, `SqliteQueue.ts:471-495`), the worker's lane, and a gate context.

```
active run = run_id of rows[0]                                  (lowest position still queued; a FAILED head keeps its run active, as today)
R eligible iff ALL:
  1. R.status in {"CREATED","FAILED"}, never "STARTED"
  2. R.runId == active run
  3. for every earlier row P of the same run:  NOT ( laneOf(P)==laneOf(R)  OR  index(P) < index(lastBarrier(R)) )
        where lastBarrier(R) = highest-index barrier row at or before R (R itself if R is a barrier)
  4. laneOf(R) has no STARTED row in `rows` AND the row's tool (normalizeToolKey(toolId)) is not in the in-memory busy set
  5. gate.halted == false AND gate.modalOpen == false AND no STARTED Tool Box row in `rows`
  6. not (R's tool type has a runControl entry AND another controllable step is running)
laneOf(row) = PRIMARY for any "Tool Box" row regardless of its stored tag (dispatch-time defence, D-14)
pick = lowest-index eligible row of the worker's lane;  none eligible but rows remain -> WAIT;  rows empty -> false (queue done)
```
Two deliberate additions beyond the milestone text, both in rule 4/5:
- **Busy set from memory, not only from rows.** `failAndDequeueRun`/`_dequeueRunRemainder` (`SqliteQueue.ts:537-566`) removes a sibling lane's STARTED row from `_queue` while that step is still running (the milestone research's L-8 says "safe", and it is for `complete`, but it makes the lane look idle to a row-only rule). After an operator Start, run N+1's STACK row could then overlap run N's still-running STACK step. Feed `pickEligible` the set of tool keys of `_runningStep` + `_sideRunning` as well. [ASSUMED] design hardening; cheap.
- **A STARTED Tool Box row blocks side-lane dispatch** (rule 5). See "Modal observation".

D-04 reconciliation: CONTEXT D-04's prose says an untagged step "waits for everything before it" but the headline cycle has `goto-safe` (untagged, primary) running while `FAST` (earlier row) runs. The §4.2 rule (which D-04 cites) is the one that produces the headline: an untagged row waits for earlier rows **of its own lane** and for rows before the **opening barrier**, not for the barrier row itself. Test case 1 pins this.

Rules table for who clears the latch:

| Path | Clears `_laneHalt`? | Notes |
|------|--------------------|-------|
| Operator Start accepted (`_startLanes("operator")` launched >= 1 lane) | YES | also clears `error` and the failure list |
| Operator Start ignored (every lane with work already has a live loop) | NO | legacy parity: "changes no state"; UX says Start ignored |
| `enqueueRun` auto-start (`_startLanes("enqueue")`) | NO, and launches nothing while latched | log "Queue Start Ignored" with `halted=true`; auto-start is already gated on `state === READY` (line 1489) but `clearError` can make state READY while the latch is set |
| `resume()` | NO | and skip its `clearError()` while latched (Pitfall 16) |
| `clearError()` | NO | state FAILED to READY is allowed; the latch is separate |
| `clearAll()` / `stop()` | NO | next explicit Start clears |

### Modal observation (D-14), exact recipe
- State is a plain private boolean on the same instance: `_isWaitingForInput` is set to `true` in `showUserForm` (line 467), `pause` (491), `showMessage` (693), `stopRunRequest` (717), `startTimer` (744), each only **after** `await this._ensureModalReady()`; cleared in `_ensureModalReady` (455), `resume` (840), `stop` (979).
- Order in the primary loop for `pause`/`user_form`/`show_message`/`timer`: `await this.commands.complete(id)` then `await this.pause(...)` (lines 1086-1087, 1096-1097, 1151-1152, 1251-1252). `complete` is `async` with a synchronous body (`SqliteQueue.ts:471-482`), `_ensureModalReady` returns immediately when nothing is pending, so the window between "row removed from the queue" and "`_isWaitingForInput = true`" contains only microtask hops. A side worker acts only after a `setTimeout` macrotask, so it cannot land inside that window. [ASSUMED: reasoned from the code, not measured; the tests in "Validation" probe it with a delay of 0]
- Before `complete`, the Tool Box row is STARTED in `_queue` (it was claimed by `startNext`), and `show_message`/`timer` perform real `await _getVariableByName(...)` DB reads while STARTED. Hence rule 5: also block when any queued row is STARTED and is a Tool Box row.
- Implementation constraint discovered in the milestone pin list: ARCHITECTURE 4.8 says "side-lane worker never references modal state". D-14 needs the side lane to *respect* modal state. Reconcile: the read of `_isWaitingForInput` lives in `_pickNext`/a private `_dispatchGate()` shared by both workers; the pin asserts the body of `_runSideLane` does not mention `_isWaitingForInput|_messageResolve|_currentMessage|_timerTimeout`.

### Failure path (D-12, D-16), end to end today and where lanes change it
1. Row fails: catch at `command_queue.ts:1374-1464` -> `commands.fail` (stays queued, FAILED) or `failAndDequeueRun` (accepted abort) -> `_recordFailure(failure)` (434-437) -> `_setState(FAILED)` -> `void this._notifyFailure(...)` (never awaited, pinned) -> `break`.
2. Router: `getError` (`routers/command_queue.ts:46-51`) returns `queueErrorPayload(error, queue.failureSeq)` or `null` (payload: message, userFriendlyMessage, code, codeString, name, seq; no stack, pinned by `staticScan.test.ts:584-586`).
3. Client: `RunsComponent.tsx:163` `getError` useQuery (1500 ms) -> `ErrorBanner` (228-279) -> `shouldShowErrorBanner(stateQuery.data, bannerError, dismissedSeq)` requires `queueState === ToolStatus.FAILED` and an error whose seq differs from the dismissed one -> `describeQueueError(bannerError)` -> message/code/details; Details opens `ErrorModal`.
4. Lane changes: `_recordFailure(error, ctx?)` keeps the single `this.error =` assignment; in lane mode, when `this.error` is already set it does **not** overwrite (first failure kept: it carries the STACK guid), always appends `{lane, queueId, toolId, message, at}` to a list capped at 8 with `overflow`, always `_failureSeq += 1` (banner re-arms), and logs `"Lane Halt Additional Failure"` with both lane names. Flag off: unchanged (at most one record per Start). Banner list comes from a new `laneStatus` query, rendered only when the list has >= 2 entries, so the flag-off DOM is untouched.
5. Banner visibility: a freeze or modal halt has no error and no FAILED state, so there is **no banner**; the "Lanes frozen" indicator must come from `laneStatus`, not from the banner.

### Anti-Patterns to Avoid
- Copying the 470-line Tool Box chain into the side worker (it would diverge). Side worker = tool steps only.
- `this.stop()` from a side worker, or a lane-drain `READY` flip. Only the primary loop stops, only on an empty queue.
- Deriving the halt from `state === FAILED` (it flips to READY on `clearError`).
- Reading `runState`/envelope/`getStatus` anywhere in dispatch (pinned: `/runState|_runStateMonitor|fetchStatus|getStatus|\.status\b/` must not match the `toolControl` body or `recoveryControl.ts`).
- Putting the Freeze button in `ControlBar.tsx` (pinned against `modalState|messageData|isModalOpen|commandQueue.resume|resumeMutation`, timers and `StopRunModal`).
- Writing `lane: undefined`/`laneBarrier: false` into stored rows (Pitfall 24b): omit keys unless set.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic claim | A JS mutex or `await`-gated flag | One better-sqlite3 transaction in `SqliteQueue.claimEligible` | All row mutations are already sync transactions; JS is single-threaded, so check+claim in one sync turn is race-free |
| Tool identity | Raw `toolId` string compare | `normalizeToolKey` (`server/toolKey.ts`) | "STACK" and "stack" must be one tool; header documents it as the single source of truth |
| Lane name parsing | Ad-hoc `.toLowerCase()` at each site | `normalizeLane()` in `laneScheduling.ts`, used by executor, validator, drawer helper, scheduler | Pitfall 27 (typos spawn lanes) |
| Error classification at run creation | `instanceof LaneValidationError` | `Error.name` guard (`isLaneValidationError`) | Phase 4 dev-recompile drift; pinned for the other four errors by `runCreateReload.test.ts` "run.create source pin" |
| Failure fan-out | A second `this.error =` | Fold the list into `_recordFailure` | `staticScan.test.ts:462-468` asserts exactly one non-`undefined` assignment |
| Freeze that aborts | Reusing "Pause queue" | New `freezeLanes` mutation | "Pause queue" is intercepted by the abort-first modal when a controllable step runs (`QueueStatuscomponent.tsx` `pause()` -> `shouldInterceptQueueStop`) |

**Key insight:** every lane rule is a function of the ordered row list plus three booleans; keep it pure and table-test it, then the class code is plumbing.

## Common Pitfalls

Milestone Pitfalls 12-25 and 27 stand. Re-verified or newly found in the CURRENT code:

### P-1: Operator Start cannot release a freeze that leaves the state BUSY
**What goes wrong:** `QueueStatuscomponent.tsx` renders **Pause queue** when `stateQuery.data === ToolStatus.BUSY` and **Start** otherwise (`isRunning = stateQuery.data === ToolStatus.BUSY`). D-13 says only an operator Start clears the latch; if the freeze keeps the state BUSY the operator has no Start button.
**How to avoid:** `freezeLanes()` sets the latch and `_setState(ToolStatus.OFFLINE)` (the same effect `stop()` has: loops exit after their in-flight step, nothing aborted, `enqueueRun` cannot auto-start because it requires READY, and `clearError()` only converts FAILED to READY so OFFLINE survives it). A failure halt already leaves FAILED, so Start shows. A primary-modal halt needs no state change (the operator is looking at the modal). [ASSUMED: OFFLINE vs FAILED is Claude's discretion; OFFLINE avoids the red "Run Error" in `GlobalQueueStatusIndicator`]
**Warning signs:** a freeze test that only asserts the latch and never asserts `state !== BUSY`.

### P-2: Ignored Start vs accepted Start in lane mode
**What goes wrong:** the `restart` router computes `accepted = !queue.isStartInProgress` before calling `_start` (`routers/command_queue.ts:37-42`) and the UI toasts "Start ignored" when `!result.accepted`. `isStartInProgress` is `this._runningPromise !== undefined` (line 288).
**How to avoid:** lane branch of the getter = "every lane with work (always including primary while the queue is non-empty) already has a live loop". Then an operator Start is `accepted:false` only when it would launch nothing. Keep the router text `return { accepted }` (pinned at `staticScan.test.ts:578`).

### P-3: Loop-handle cleanup must be in the same synchronous turn as the exit decision
**What goes wrong:** a side loop evaluates `while (state === BUSY)` false, then a `.finally(() => _laneLoops.delete(lane))` runs a microtask later; an operator Start in between sees `_laneLoops.has(lane)` and ignores a lane that is actually exiting, or relaunches over a live one.
**How to avoid:** wrap each loop in a supervisor whose `finally` deletes the map entry, and decide to exit and delete in the same function body without an `await` between. `_runningPromise`: keep it as the umbrella the existing `stop()` and `isStartInProgress` read; recompute it after every launch/exit (it must cover a primary loop relaunched while a side loop is still alive after a failure). Test: same-tick double operator Start, and "Start while lane B in flight relaunches only lane A".

### P-4: `goto` and the operator re-queue mutations double-send a STARTED side-lane row
**What goes wrong:** `SqliteQueue.gotoCommandByIndex` (152-218) deletes the run's rows from index onward from `_queue`, sets each to CREATED and reinserts them at the front, **including a STARTED row**; `gotoCommand` (220-307) likewise. In lane mode a primary `Tool Box goto` (or the `gotoCommand`/`gotoCommandByRunIndex` tRPC mutations, which have no client caller today: `grep` found none outside the router) can reset an in-flight side-lane step to CREATED, after which `claimEligible` would re-dispatch it: the F5 double send on a physical instrument.
**How to avoid:** recommendation (not in CONTEXT, needs the user's nod, see Open Questions): `validateLanes` refuses a `Tool Box goto` in any run that has a non-primary lane, and the two re-queue methods refuse (throw) in lane mode while any side-lane step is running. [ASSUMED]

### P-5: `describeQueueStart` and `queuedStartLines` have different row shapes
`describeQueueStart` (server audit text) takes `{queueId, runId, status}`; `queuedStartLines` (client confirmation) takes `{status, runId}` from the `commandQueue.commands` rows. Both need an optional lane/toolId/command/barrier read from `commandInfo` (`row.commandInfo?.advancedParameters?.lane`). Untagged output must stay byte-identical: `queueStartGuard.test.ts` asserts exact strings (e.g. `"Command Queue started by user. Will run 3 queued steps from 3 runs; ..."`) and `queuedStartSummary.test.ts` asserts exact line arrays.

### P-6: `getRunAttributes` uses the last row for completion time
`components/runs/utils.ts` sets `completedAt = lastCommand?.completedAt` and `startedAt` from the first STARTED row. With lanes the last array row is not the last to finish. In the lane-aware branch use the max `completedAt` over COMPLETED rows.

### P-7: `skipUntil` / card "Skip" act across lanes
`SwimLaneCommandComponent` offers Skip / "Skip to this command" for `queued` rows including STARTED ones; `skipUntil` (497-512) skips every row with a lower position, across lanes. Pre-existing semantics, not changed here; call it out in UAT, do not "fix" it in this phase.

### P-8: Existing static pins that constrain the new code (full matrix in Validation Architecture)
Notably: exactly one `.controlCommand(` in `command_queue.ts` (so the lane-aware `toolControl` keeps a single send); `toolControl` body must not match `.status` (do not write `step.status` or `row.status` there; put row filtering in `laneScheduling.ts`); `await this._notifyFailure(` forbidden; `ErrorBanner` region forbids `noOfLines`, `clearError`, `.restart`, `.mutate(`, `mutateAsync(`.

### P-9: Dispatch gate ordering with the injected delay of 0
With `loopDelayMs = 0` two workers wake in timer-creation order. Launch side workers only from the primary's reconcile tick (after the primary's own pick) so modal/halt tests are deterministic; gate every ordering assertion on `deferred()` gates, never wall time (Pitfall 25).

## Code Examples

### Verbatim values used below
```ts
// controller/types/run.ts:3        [VERIFIED: Read this session]
export type RunStatus = "CREATED" | "STARTED" | "FAILED" | "COMPLETED" | "SKIPPED";
// controller/types/run.ts:37-40
export interface AdvancedParameters {
  skipExecutionVariable: SkipExecution;
  runAsynchronously?: boolean;
}
// controller/gen-interfaces/tools/grpc_interfaces/tool_base.ts:124-134
export enum ToolStatus { UNKNOWN_STATUS = "UNKNOWN_STATUS", NOT_CONFIGURED = "NOT_CONFIGURED", INITIALIZING = "INITIALIZING",
  READY = "READY", BUSY = "BUSY", FAILED = "FAILED", OFFLINE = "OFFLINE", SIMULATED = "SIMULATED", UNRECOGNIZED = "UNRECOGNIZED" }
// controller/server/runControl.ts:34-40
export const runControl = deepFreeze({ fast: { pause: {}, resume: { is_tip_broken: "yesno" }, abort: { return_liquid: "yesno" } } });
// controller/server/command_queue.ts:1082  the Tool Box test used by the busy loop
if (nextCommand.commandInfo.toolId === "Tool Box") {
```

### `AdvancedParameters` (additive, D-01)
```ts
export interface AdvancedParameters {
  skipExecutionVariable: SkipExecution;
  runAsynchronously?: boolean;
  lane?: string;          // absent or "primary" = primary lane
  laneBarrier?: boolean;  // true = waits for every earlier row of the run
}
```

### `SqliteQueue.claimEligible` (sync, additive)
```ts
claimEligible(queueId: number): StoredRunCommand | false {
  const db = this.db;
  let claimed: StoredRunCommand | false = false;
  db.transaction(() => {
    const inQueue = db.prepare(`SELECT queue_id FROM ${this.queueName}_queue WHERE queue_id = ?`).get(queueId);
    if (!inQueue) return;                                   // removed (Clear All / run delete) since the pick
    const item = this.find(queueId);
    if (item.status !== "CREATED" && item.status !== "FAILED") return;   // never claim STARTED
    this._updateItem(queueId, { status: "STARTED" });
    claimed = this.find(queueId);
  })();
  return claimed;
}
```

### `_pickNext` (the only place the gate and the claim meet)
```ts
private async _pickNext(lane: string): Promise<StoredRunCommand | false | typeof WAIT> {
  if (!this._laneMode) return this.commands.startNext();       // byte-for-byte legacy call
  // ---- no await from here to the claim ----
  const rows = this.commands.queuedRowsSync();
  const verdict = pickEligible(rows, lane, this._dispatchGate());   // reads _laneHalt, _isWaitingForInput, running steps
  if (verdict.kind === "empty") return false;
  if (verdict.kind === "wait") return WAIT;
  const claimed = this.commands.claimEligible(verdict.row.queueId);
  return claimed === false ? WAIT : claimed;
}
```

### `RunStateMonitor.stopIf`
```ts
stopIf(queueId: number): void {
  if (this.envelope.running && this.envelope.queueId === queueId) this.stop();
}
```
and in lane mode the bracket starts the monitor only when `getRunControl(step.toolType) !== undefined` (otherwise `start()` calls `this.stop()` first, `runState.ts:127`, and kills the F.A.S.T. poller; Pitfall 13).

### `toolControl` target resolution (keeps legacy refusals when off)
```ts
const running = this._allRunningSteps();                       // [_runningStep, ...side] ; flag off: [_runningStep] or []
const step = running.find((s) => getRunControl(s.toolType) !== undefined) ?? running[0];
const verdict = validateControlRequest(step?.toolType, action, params);   // unchanged text for 0 / non-controllable
```
The `?? running[0]` fallback preserves today's `Tool type "stack" does not support live run control.` refusal when only a STACK step runs.

### Script API (D-19), current shape and the trap
Current `galago.command(toolId, command, cmdParams = {})` (`protocol-script-executor.ts:23`) pushes `advancedParameters: { skipExecutionVariable: { variable: null, value: "" }, runAsynchronously: false }`; `timer/pause/showMessage/note/assignVariable/userForm` call `this.command("Tool Box", ...)`. Add a closure `let currentLane: string | undefined`, `lane(name)` setter (blank/`"primary"` resets), and `command(toolId, command, params = {}, opts: { lane?: string; barrier?: boolean } = {})`. **Trap:** the Tool Box helpers go through `this.command`, so a sticky `galago.lane("fast")` must **not** apply to `toolId === "Tool Box"` (they would be refused by `validateLanes`). Add `lane`/`laneBarrier` keys only when set.

### Golden transcript (LAN-01): exact shape and capture

What to record (all deterministic with `vi.useFakeTimers({ toFake: ["setTimeout", "Date"] })` + `vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))`; `:memory:` SQLite gives queueIds from 1; `_failureSeq` seeds from `Date.now()`):
```ts
interface Transcript {
  actions: { level: string; action: string; details: string }[];  // every logAction call, in order (setup.ts mocks @/server/logger)
  states: string[];        // from logger.info calls starting "CommandQueue state:" -> "READY>BUSY", ... (setup.ts mocks @/logger)
  dispatched: { toolId: string; command: string; params: unknown }[];  // spy on Tool.executeCommand (static), call order
  grpcSends: unknown[];    // FakeGrpc.executeCommand payloads, in order
  midStep: { runningStep: unknown; runState: unknown } | null;   // snapshots while a fast step is held on deferred()
  rows: { queueId: number; runId: string; status: string }[];    // final commands.all()
  error: string | null;
}
```
Scenarios (all fakes via `installFakeTool`, no db: Tool Box `note`, `pause`, `show_message` with plain text, `timer` need no DB; a `skipExecutionVariable` row exercises the mocked-db warning path "Skip Execution Variable Error" deterministically because `@/db/client` throws on any property access):
- S1 mixed happy path: Tool Box `note` -> `stack` tool step -> Tool Box `pause` (then `queue.resume()`) -> `fast` step held on `deferred()` (capture `midStep`) -> Tool Box `show_message` (resume) -> `stack` step.
- S2 failure then retry: a step answers `INVALID_ARGUMENTS`; state FAILED, error text; `clearError()`; operator `_start()`; success (same shape as `queueStartGuard.test.ts` "F5 recipe A").
- S3 Pause queue mid-step then Start (OFFLINE path) and an ignored second Start.
Drive with `queue._start()` and `vi.advanceTimersByTimeAsync(1500)` steps exactly as `test/queueStartGuard.test.ts:44-130` does (`vi.useFakeTimers({ toFake: ["setTimeout"] })`, the global `__global_command_queue_key`, `afterEach` that resolves deferreds, advances 15 s, awaits loops, `removeFakeTool`).

Capture protocol (the phase's first task, at the unmodified commit): `test/lanesFlagOff.test.ts` has a `runScenario()` helper and a fixture module `test/fixtures/lanesFlagOff.golden.ts` (fixtures here are `.ts` modules: `fastPlates.ts`, `stackDeviceTrees.ts`, `stackOptions.ts`; `tsc` covers `**/*.ts`). With `GOLDEN_WRITE=1` the test writes the fixture, otherwise it deep-equals it. Run once at the pre-change commit with `GOLDEN_WRITE=1`, commit the fixture and the test, record that SHA in the fixture header. After the change the same test is parameterised over three constructions that must produce the **identical** transcript: `new CommandQueue({} as any)` (env unset), `new CommandQueue({} as any, { parallelLanes: false })`, and `new CommandQueue({} as any, { parallelLanes: true })` with an untagged protocol. One extra test uses `vi.stubEnv("GALAGO_PARALLEL_LANES", "1")` (and `vi.unstubAllEnvs()` after) to prove the env read; all other tests use the constructor option.

How existing tests drive the queue (so new ones copy the idiom): `installFakeTool(toolId, ToolType.x)` replaces `tool.grpc` with `vi.fn()` fakes; either let the real `Tool.executeCommand` run against `FakeGrpc` (`grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true })`) or `vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise)` with `deferred()` from `test/helpers/fakeTool.ts`; rows are pushed with `queue.commands.push({ runId, status: "CREATED", commandInfo: {...} } as any)`; `logs(action)` filters `vi.mocked(logAction).mock.calls`; `vitest.config.mts` sets `clearMocks: true` and `setupFiles: ["test/setup.ts"]`.

## Re-verified references (milestone research -> current code)

| Milestone ref | Status at HEAD `31838b2` |
|---------------|--------------------------|
| `command_queue.ts` `_runningPromise :66`, `_runningStep :74`, `_runStateMonitor :77`, `_abortAcceptedQueueId :83`, `_failedAttempt :91`, modal fields `:99-106`, `_recordFailure :434-437`, `toolControl :526-621` (identity gate `:566`), `_recordAcceptedAbort :639-679`, `resume :820`, `_start :914` (guard `:919`, claim `:942`), loop `:997-1471` (delay `:1002`, `startNext :1003`, dispatch bracket `:1351-1366`, catch `:1374-1464`), `enqueueRun :1473` (auto-start `:1489`) | **All exact** (file unchanged since Phase 4) |
| `SqliteQueue.ts` `startNext :112-150`, `complete :471`, `skip :484`, `fail :521`, `failAndDequeueRun :574`, `recoverInterruptedSteps :596`, `queuedRowsSync :398` | exact |
| `runState.ts :126-130` (`start()` begins `this.stop()`) | exact |
| `routers/tool.ts :533` (`recoveryControl` caller) | **stale: now `:555`** (`runningStep: CommandQueue.global.runningStep`) |
| `routers/command_queue.ts` `restart :30-35` | **stale: `:37-42`**; `runState :141` exact; `toolControl :150` |
| `routers/protocol.ts` `preview :250-300` | **stale: `:250-292`**; script-mode only (input `scriptContent`) |
| `runs.ts` operator-only scan `~219-232` | **now `:223-238`** (loop at 224-238, `isOperatorOnlyCommand(String(c.toolType)...` at 229); `createFromProtocol :215`; `runAsynchronously :117`; catch rethrow list `:271-276` |
| `runControl.ts :30-36` | **now `:34-40`** |
| `CommandDetailsDrawer.tsx :556-562` (dead switch) | **now `:781-790`** (state handler `handleRunAsyncChange :181-186`; `getAdvancedParameters :142-154`; save `:188-206`) |
| `AddToolCommandModal.tsx :240` | **now `:246-251`** |
| `ProtocolDetailView.tsx :236,422` / `:241,427` | exact |
| `RunsComponent.tsx :121` (getAll poll) / `:287` | **now `:123` / `:286-288`** |
| `staticScan.test.ts :462`, `:470-486`, `:572`, `:204-285`, `:358-371` | exact |
| `components/runs/utils.ts :32-33`, `runOutcome.ts :30-55`, `SwimLaneComponent.tsx :29-36 / :42-56`, `types/run.ts :37-40`, `protocol-script-executor.ts :23 / :30` | exact |
| "the existing 608 tests" | **stale: baseline is 37 files / 1094 tests, green** (`npx vitest run`, 52 s; `npx tsc --noEmit` clean, ~9 s) |

## Static-scan pin matrix (what the lane code must not break; all `[VERIFIED: test/staticScan.test.ts]`)

| Pin (lines) | Constraint on this phase |
|-------------|--------------------------|
| `:462-468` single failure site: `/this\.error\s*=(?!=)(?!\s*undefined\b)/g` count `=== 1`, inside `private _recordFailure(`, region contains `this._failureSeq += 1` | Failure list lives inside `_recordFailure`; never a second assignment |
| `:470-487` `_start`: first match of `if (this._runningPromise)` precedes `this._failedAttempt = undefined`, `"Queue Started"`, `this.error = undefined`, `this._setState(`; the first `this._runningPromise =` is not preceded by `await` | **Passes unedited with `if (this._laneMode) return this._startLanes(source);` as line 1.** Verified with a reimplementation of the check on a patched copy of the real source (`scratchpad/pin-check.mjs` printed `existing _start pin still passes with the early return: true`). Add a NEW tightening `it` (early return is `_laneMode`-only and the only statement before the guard) instead of editing this one |
| `:251-270` exactly one `.controlCommand(` in `server/command_queue.ts` and one in `recoveryControl.ts` | Lane-aware `toolControl` keeps exactly one send |
| `:272-284` one `CommandQueue.global.toolControl(` router entry, one `recoveryControl({` entry (`routers/tool.ts`) | New mutations must not match these |
| `:207-221` client files referencing `.toolControl`/`.recoveryControl` and `commandQueue.runState` = only `hooks/useRunControl.ts` | `LanesPanel`/`useLaneStatus` must not touch them |
| `:357-372` `toolControl` body and all of `recoveryControl.ts` must not match `/runState\|_runStateMonitor\|fetchStatus\|getStatus\|\.status\b/` | No `.status` in `toolControl`; keep row-status logic in `laneScheduling.ts` |
| `:303-308` no `setTimeout/setInterval` in the control-UI module list; `:345-355` `ControlBar.tsx`, `ToolPausedModal.tsx`, `pausePrompt.ts` must not match `modalState\|messageData\|isModalOpen\|commandQueue.resume\|resumeMutation` | Freeze UI in a NEW component |
| `:504-515` `ErrorBanner` region: contains `maxH="160px"`, `whiteSpace="pre-wrap"`; forbids `noOfLines`, `clearError`, `.restart\b`, `.mutate(`, `mutateAsync(`; `RunsComponent` still matches `dismissedSeq`, `shouldShowErrorBanner(`, `describeQueueError(` | A pure `<LaneFailureList>` child inside the banner is fine |
| `:526-541` `getRunAttributes(runInfo, run.Commands)`, `runProgressColorScheme(runAttributes.status)`, `runOutcomeBadge(runAttributes.status)` in `RunsComponent`; `deriveRunOutcome(` in `utils.ts`; no `green` in `runOutcome.ts`; `RunStatus` union text unchanged | Keep these call sites textually |
| `:543-556` `queueError.ts`, `runOutcome.ts`, `storedError.ts`, `queuedStartSummary.ts` React-free and timer-free | Lane helpers there stay pure |
| `:571-587` no `await this._notifyFailure(`; router keeps `return { accepted }`; no `stack:` in the router | Side worker uses `void this._notifyFailure(...)` |
| `:589-640` step-card DOM order (`<CommandImage` < `title={errorText}` < `position="sticky"`) and `<CheckCircle` count | Do not edit `SwimLaneCommandComponent`; render timestamps in the lane-row wrapper |
| `:700-710` `createFromProtocol` body contains `isOperatorOnlyCommand(` and `stage=enqueue` | `validateLanes` goes after the scan |
| `test/runCreateReload.test.ts:253-267` `run.create` source pin: no `instanceof` of the four named errors; contains `isOperatorOnlyCommandError(e)` / `(error)` | Add `isLaneValidationError` by name; add a parallel pin |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One busy loop, one running step, one error slot | Primary legacy loop + side-lane workers over an eligibility function; bounded failure list | This phase | Overlapping tool steps, fail-closed freeze |
| `runAsynchronously` (dead switch, always `false`) | Explicit `lane` + `laneBarrier` fields | D-01/D-02 | No reinterpretation of stored data |

**Deprecated/outdated:** the todo's per-run `useParallelToolLanes` and `.planning/config.json` flag (D-06/D-07); ARCHITECTURE 4.8's "existing 608 tests".

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next 13.1.2 server code reads `process.env.GALAGO_PARALLEL_LANES` at runtime (precedent only: the constructor already reads `process.env.SQLITE_DB_PATH` and compose injects `GRPC_HOST`, `TOOLBOX_PORT`) | Seams | Flag never takes effect in the image; UAT would catch it |
| A2 | Freeze should set `ToolStatus.OFFLINE` so the existing Start button appears and auto-start stays off | P-1 | If FAILED is preferred the global indicator shows "Run Error" for a deliberate freeze; purely cosmetic but needs a user pick |
| A3 | `validateLanes` should refuse `Tool Box goto` in lane-tagged runs, and `gotoCommand*` should refuse while a side step runs | P-4 | Without it a goto can reset a STARTED side row and double-send to an instrument |
| A4 | In-memory busy-tool set added to eligibility (beyond the rows-only rule in ARCHITECTURE) | Eligibility | Without it, after an accepted abort dequeues a run, run N+1 can overlap a still-running step on one tool server |
| A5 | "First secondary-lane row needs a barrier unless at position 0" applies **per lane** (each non-primary lane's first row) | validateLanes | If the user meant only the first secondary row overall, a second lane could fan out mid-run |
| A6 | The `complete()` -> modal-flag window contains only microtask hops | Modal observation | A side dispatch could land under a just-opened modal; mitigated by the STARTED-Tool-Box-row rule and probed with delay 0 |
| A7 | Per-queueId marker/token maps can replace the single fields for BOTH modes without changing flag-off behaviour (clear-all in `_start`, `gotoCommand`, `gotoCommandByRunIndex` keeps the "superseded" semantics) | Seams | If any T-01-08 test in `toolControl.test.ts` fails, fall back to branching on `_laneMode` |
| A8 | `vitest run` has no `--repeat`; flake check = shell loop | Validation | Wrong command in a plan; trivial |
| A9 | Log action names (`Lane Step Dispatched`, `Lane Step Ended`, `Lanes Frozen`, `Lane Tags Ignored`) are free naming except `"Lane Halt Additional Failure"` (fixed by D-16) | Logs | None functional |

## Open Questions

1. **Refuse `goto` in lane-tagged runs? (A3)**
   - Known: `goto` re-queues by position and resets STARTED rows (P-4); CONTEXT is silent.
   - Recommendation: refuse in `validateLanes` and in the two re-queue methods while a side step runs; ask in plan review. This is a safety add-on, not scope creep, but it is a new refusal the user has not signed.
2. **Freeze state: OFFLINE or FAILED? (A2)** Recommend OFFLINE; confirm in UI-SPEC.
3. **Per-lane barrier-first rule (A5).** Recommend per lane; message must name the lane.
4. **Should flag-off preview/creation warn that tags are ignored?** D-08 logs once per run at enqueue; recommend also returning one `laneWarnings` line from `protocol.preview` when lane mode is off and tags exist, so authors see it. Low risk.
5. **UI-SPEC.** ROADMAP says "UI hint: yes" and `workflow.ui_phase` is true; the lane-row and Freeze visuals are Claude's discretion. Run `/gsd-ui-phase 8` before planning the Wave 2 UI plan, or let the planner inline a short contract.
6. **Gantt chart under overlap.** `components/runs/gantt/RunQueueGanttChart.tsx` was not read in depth; overlap rendering is unverified. Check in UAT; not a requirement.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests, tsc | yes | v24.14.1 | none needed |
| vitest | all tests | yes | 2.1.9 | none needed |
| TypeScript (`npx tsc --noEmit`) | typecheck | yes | ^5.5.3, clean at HEAD | none needed |
| better-sqlite3 (native) | `SqliteQueue` in tests | yes (suite ran green) | ^12.5.0 | none needed |
| Docker / tool servers | not needed (fakes only; no motion) | n/a | n/a | n/a |
| graphify graph | optional context | stale (817 h, 436 commits behind) | n/a | not used; code read directly |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9, `environment: "node"`, no jsdom |
| Config file | `controller/vitest.config.mts` (`include: ["test/**/*.test.ts"]`, `setupFiles: ["test/setup.ts"]`, `clearMocks: true`, `testTimeout: 15000`) |
| Quick run command | `cd controller && npx vitest run <files>` |
| Full suite command | `cd controller && npx vitest run && npx tsc --noEmit` (baseline: 37 files, 1094 tests, ~52 s; tsc ~9 s) |
| Flake check for lane suites | `cd controller && for i in $(seq 20); do npx vitest run test/lanes.test.ts test/laneHalt.test.ts test/laneControl.test.ts || break; done` |
| Style/build | `cd controller && npx prettier --config .prettierrc --check <touched files>`; `next build` fatals on an `eslint-disable` for an undefined rule (PROJECT.md Key Decision), so add none |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAN-01 | Golden transcript identical for env unset / option false / option true + untagged; env read once | integration (fake tools, fake timers) | `npx vitest run test/lanesFlagOff.test.ts` | Wave 0 (create + capture first) |
| LAN-01 | Every existing test passes unedited | regression | `npx vitest run` | exists |
| LAN-02 | Headline cycle overlaps FAST with primary goto-safe; one step per tool; run N+1 waits | unit (pure) + integration | `npx vitest run test/laneScheduling.test.ts test/lanes.test.ts` | Wave 0 |
| LAN-03 | Barrier table (before/at/after, untagged waits, lane order, STARTED/FAILED handling, controllable invariant) | unit table-driven | `npx vitest run test/laneScheduling.test.ts` | Wave 0 |
| LAN-04 | `claimEligible` excludes STARTED, allows FAILED retry, row removed mid-claim; same-tick double Start per lane; operator Start relaunches only idle lane; exactly one `Tool.executeCommand` per queueId | unit + integration | `npx vitest run test/sqliteQueueClaim.test.ts test/lanes.test.ts` | Wave 0 |
| LAN-05 | A fails while B is in its delay: B dispatches nothing; B fails while halted: both listed, first kept; `resume`/`clearError`/enqueue auto-start/ignored Start leave latch; operator Start clears | integration | `npx vitest run test/laneHalt.test.ts` | Wave 0 |
| LAN-06 | Open modal gates side dispatch (delay 0); STARTED Tool Box row gates; Continue releases; Tool Box row tagged with a lane runs on primary | integration | `npx vitest run test/laneHalt.test.ts` | Wave 0 |
| LAN-07 | `toolControl` reaches F.A.S.T. on a side lane while STACK runs on primary; refusals unchanged with one STACK step; `stopIf` keeps F.A.S.T. envelope through a STACK step; abort accepted on A survives B's dispatch (both orders); `recoveryControl` refuses STACK acknowledge while STACK runs on any lane | integration + unit | `npx vitest run test/laneControl.test.ts test/runStateStopIf.test.ts` | Wave 0 |
| LAN-08 | Envelope stays `running:true` for the side-lane F.A.S.T., so `shouldInterceptQueueStop`/`shouldInterceptRunDelete` (pure, already tested) intercept; accepted abort on a side lane dequeues the run and a STARTED sibling still completes | integration + pure | `npx vitest run test/laneControl.test.ts test/stopInterception.test.ts` | Wave 0 / exists |
| LAN-09 | `freezeLanes`: latch set, state OFFLINE, in-flight step finishes and is recorded, nothing aborted, flag-off call refused with a clear TRPC error, Start releases; `laneStatus` shape | integration (router `createCaller`) | `npx vitest run test/laneHalt.test.ts` | Wave 0 |
| LUI-01 | `laneFields` helper: blank lane deletes key, barrier false deletes key, never writes `lane: ""`; suggestions; Tool Box shows no control (pure predicate); drawer/host static pins | unit + static scan | `npx vitest run test/laneUi.test.ts test/staticScan.test.ts` | Wave 0 |
| LUI-02 | `galago.lane`, per-call `{lane, barrier}`, Tool Box helpers ignore sticky lane, untagged output byte-identical (no `lane` key) | unit | `npx vitest run test/laneScript.test.ts` | Wave 0 |
| LUI-03 | Each refusal message; no dead-wait via `simulateDrain`; `createFromProtocol` throws `LaneValidationError` after the operator-only scan, nothing enqueued; router -> BAD_REQUEST; API route -> 400; flag off = no validation + one log; name guard works on a module-copy instance | unit + integration (mocked store like `operatorOnly.test.ts`) | `npx vitest run test/laneValidation.test.ts test/runCreateReload.test.ts` | Wave 0 / exists |
| LUI-04 | `describeQueueStart` and `queuedStartLines` untagged output unchanged (existing exact-string tests); lane runs append per-lane listing; `protocol.preview` returns `laneWarnings`; visual-protocol summary from the pure module | unit | `npx vitest run test/laneUi.test.ts test/queueStartGuard.test.ts test/queuedStartSummary.test.ts` | Wave 0 / exists |
| LUI-05 | `groupRowsByLane` order = first appearance, primary labelled, untagged returns legacy flat; lane-aware `deriveRunOutcome` table (early COMPLETED bug case, FAILED precedence, drained = complete); `getRunAttributes` max completedAt | unit | `npx vitest run test/laneUi.test.ts test/runOutcome.test.ts` | Wave 0 / exists |
| LUI-06 | Bounded list (cap 8 + overflow), first kept, seq bumps per failure, no stack, flag-off `getError` payload unchanged, `describeLaneFailures` wording | integration + unit | `npx vitest run test/laneHalt.test.ts test/laneUi.test.ts test/errorPath.test.ts` | Wave 0 / exists |

### Sampling Rate
- **Per task commit:** the single new/changed test file(s) from the table plus `npx tsc --noEmit`.
- **Per wave merge:** `cd controller && npx vitest run && npx tsc --noEmit`.
- **Phase gate:** full suite green with **zero edits to existing assertions** (new `describe` blocks appended to `staticScan.test.ts` are additive), `lanesFlagOff` green in all three constructions, the 20x loop green for the three engine suites, prettier clean on touched files, `next build`/lint clean (UI wave) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/fixtures/lanesFlagOff.golden.ts` + `test/lanesFlagOff.test.ts` captured at the unmodified commit (LAN-01)
- [ ] `test/laneScheduling.test.ts`, `test/sqliteQueueClaim.test.ts`, `test/runStateStopIf.test.ts` (new files; do not edit `sqliteQueue.test.ts`/`runState.test.ts`)
- [ ] `test/lanes.test.ts`, `test/laneHalt.test.ts`, `test/laneControl.test.ts`: share one harness `test/helpers/laneHarness.ts` (queue factory with `{ parallelLanes: true, loopDelayMs: 0 }`, N fake tools, `deferred()` gates, `afterEach` that resolves every deferred, awaits all loops, deletes `__global_command_queue_key`, removes fake tools)
- [ ] `test/laneValidation.test.ts`, `test/laneScript.test.ts`, `test/laneUi.test.ts`
- [ ] Appended `describe` blocks in `test/staticScan.test.ts`: early return is `_laneMode`-only and first; no `await` between `_laneHalt`/gate read and `claimEligible` in `_pickNext`; `_recordFailure` still the only `this.error =`; `_runSideLane` body has no `_isWaitingForInput|_messageResolve|_currentMessage|_timerTimeout` and no `this.stop(` ; `laneScheduling.ts` imports nothing and has no timers; `LanesPanel`/`useLaneStatus` do not reference `toolControl|recoveryControl|runState`; `LanesPanel` has no `setTimeout|setInterval|StopRunModal|autoFocus|defaultValue`
- Framework install: none.

## Security Domain

### Applicable ASVS Categories (level 1, `security_enforcement: true`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (this app's routers are unauthenticated by design; `getError` comment: "this router has no auth") | unchanged; do not add new unauthenticated mutating surface beyond `freezeLanes` |
| V3 Session Management | no | n/a |
| V4 Access Control | yes (fail-closed dispatch) | `freezeLanes` is a safe-direction action (stops dispatch); no mutation can *clear* the latch except an operator Start; lane mode refusal when flag off |
| V5 Input Validation | yes | `normalizeLane` + regex `[a-z0-9_-]{1,32}`, max 4 lanes, `validateLanes` at creation AND `enqueueRun`, dispatch-time force-primary for Tool Box rows; `zod` only for any new router input (freeze takes none) |
| V6 Cryptography | no | none |
| V7 Logging | yes | every new log line through `sanitizeLogText` (as the control paths do, e.g. `command_queue.ts:548`); lane names are regex-restricted but tool/error text is not |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Imported/edited protocol JSON smuggles a lane tag on a Tool Box step or an oversized lane set | Tampering | `validateLanes` at creation and enqueue; dispatch-time `laneOf` forces Tool Box to primary |
| Double dispatch of an in-flight step (physical safety) | Tampering / DoS to hardware | `claimEligible` excludes STARTED; per-lane loop guard; in-memory busy-tool set; refuse `goto` re-queue (A3) |
| Silent un-halt (resume/clearError/enqueue) | Tampering | latch independent of `state`; clearing rules table; tests per path |
| Log injection via tool error text or lane name | Tampering / Repudiation | `sanitizeLogText`; lane name regex |
| Unbounded failure list / lane count | DoS | cap 8 + overflow; cap 4 lanes |
| Tool error text rendered as HTML | XSS | existing React text rendering; scans forbid `dangerouslySetInnerHTML` in the run files (`staticScan.test.ts:558-568`); keep new components the same |
| Stack trace to client | Information disclosure | `laneStatus` carries message only; extend the existing "no `stack:`" scan to it |

## Recommended plan / wave breakdown (tracer-first)

Phase waves per ROADMAP: engine first, then protocol surface and run page. All `command_queue.ts` edits are serialised (one file); pure modules parallelise.

| Plan | Wave | Delivers | Reqs | Depends |
|------|------|----------|------|---------|
| 08-01 Golden transcript | 1 | `lanesFlagOff` test + fixture, **captured and committed before any production edit** | LAN-01 | none |
| 08-02 Pure policy | 1 | `server/laneScheduling.ts`, `AdvancedParameters` fields, `test/laneScheduling.test.ts` (headline cycle = case 1, barrier table, validateLanes, simulateDrain) | LAN-02, LAN-03, LUI-03 (core) | none |
| 08-03 Storage + monitor | 1 | `SqliteQueue.claimEligible`, `RunStateMonitor.stopIf`, their tests | LAN-04, LAN-07 (monitor) | none |
| 08-04 **Tracer slice** | 2 | `_laneMode` ctor option + injectable delay, `_startLanes`, `_pickNext`/`WAIT`, `_runSideLane`, `_laneLoops`, `isStartInProgress` lane branch, per-queueId markers, lane step logs; **headline cycle overlaps on two fake tools**; golden re-run in 3 constructions; tightening static pins | LAN-01 (post-change), LAN-02, LAN-03, LAN-04 | 01, 02, 03 |
| 08-05 Halt, freeze, modal, failures | 3 | `_laneHalt` (sync first statement), clearing rules, modal gate, `freezeLanes()` + OFFLINE, bounded failure list in `_recordFailure`, `laneStatus` + `freezeLanes` router procedures, `resume` guard | LAN-05, LAN-06, LAN-09, LUI-06 (server) | 04 |
| 08-06 Control surface | 4 | lane-aware `toolControl`, `_recordAcceptedAbort`, `runningStepFor` + `routers/tool.ts:555`, monitor ownership, abort-then-dispatch tests both orders | LAN-07, LAN-08 | 05 |
| 08-07 Protocol server surface | 5 | `validateLanes` in `createFromProtocol` + `enqueueRun`, `LaneValidationError` mapping (`routers/run.ts`, `pages/api/runs/index.ts`, `runs.ts` rethrow), `galago.lane`, `protocol.preview` warnings, flag-off "Lane Tags Ignored" log, compose env lines | LUI-02, LUI-03, LUI-04 (preview) | 02, 04 (laneMode getter) |
| 08-08 Pure client modules | 5 | `groupRowsByLane`, lane-aware `deriveRunOutcome`/`getRunAttributes`, `queuedStartLines` + `describeQueueStart` lane listing, `laneStatus.ts`, `laneFields.ts`, tests | LUI-01 (helper), LUI-04, LUI-05, LUI-06 (client) | 02 |
| 08-09 UI wiring | 6 | drawer Lane/barrier controls + note, `ProtocolDetailView` preview grouping and visual summary, `SwimLaneComponent` lane rows, `LanesPanel` (Freeze + confirm + "Lanes frozen" + still-running lanes), banner list, `useLaneStatus`, static pins, prettier/lint/build | LUI-01, LUI-04, LUI-05, LUI-06, LAN-09 (UI) | 05, 07, 08 (UI-SPEC advisable first) |

Tracer rationale: 08-04 is the first point where one real end-to-end path (rows in SQLite -> eligibility -> claim -> two concurrent fake-tool steps -> rows COMPLETED) works with the flag on **and** the golden proves the flag off is untouched. Everything after is a layer on a working engine. 08-01 must be its own plan so its commit precedes any production edit.

## Sources

### Primary (HIGH confidence, read this session)
- `controller/server/command_queue.ts` (full), `server/utils/SqliteQueue.ts` (full), `server/runState.ts`, `server/runControl.ts`, `server/recoveryControl.ts`, `server/queueStartListing.ts`, `server/runs.ts`, `server/operatorOnlyCommands.ts`, `server/toolKey.ts`, `server/tools.ts:405-678`, `server/scripting/{protocol-script-executor,resolve-tool-types}.ts`, `server/routers/{command_queue,run,protocol,tool}.ts`, `pages/api/runs/index.ts`
- `controller/components/runs/{RunsComponent,ControlBar,runOutcome,utils,queueError,storedError,stopInterception,queuedStartSummary}.ts(x)`, `components/runs/list/{SwimLaneComponent,SwimLaneCommandComponent}.tsx`, `components/runs/status/{QueueStatuscomponent,GlobalQueueStatusIndicator}.tsx`, `components/protocols/{CommandDetailsDrawer,ProtocolDetailView,NewProtocolRunModal}.tsx`, `hooks/useRunControl.ts`, `types/run.ts`
- `controller/test/{staticScan,queueStartGuard,toolControl,runState,runCreateReload,setup}.test.ts`/`.ts`, `test/helpers/fakeTool.ts`, `vitest.config.mts`
- `.planning/phases/08-concurrency-lanes/08-CONTEXT.md`, `.planning/research/{ARCHITECTURE §4-7, SUMMARY, PITFALLS 12-29}.md`, `.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
- Executed: `npx vitest run` (37 files / 1094 tests passed), `npx tsc --noEmit` (clean), `node scratchpad/pin-check.mjs` (pin simulation)

### Secondary (MEDIUM)
- ARCHITECTURE/PITFALLS design reasoning on halt windows and eligibility (reasoned from the code, not prototyped)

### Tertiary (LOW)
- `RunQueueGanttChart.tsx` overlap behaviour (not read in depth)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (nothing added; versions read)
- Architecture: MEDIUM (engine design unprototyped; every seam and pin verified against current source)
- Pitfalls: HIGH for the pins and re-verified lines; MEDIUM for A3/A4/A6 (judgment)

**Research date:** 2026-11-16
**Valid until:** 2026-12-16 or the next edit to `command_queue.ts`, whichever comes first
