---
created: 2026-11-03
source: Operator debrief after the galago-tools v2 milestone's live two-plate handoff cycles (the concurrent-maneuver want surfaced in practice)
type: feature-candidate (gsd-quick / next-cycle)
---

# Scheduler: per-toolId concurrency lanes for live two-tool runs

## The problem (all references in this repo, HEAD a799627)

The command queue keeps a **single global running-step slot**
(`controller/server/command_queue.ts`, `_runningStep`, ~line 74) with one
busy-loop; a queue start while another step runs is ignored ("A queue start was
ignored because the queue is already running; nothing was dispatched again",
~line 923). `advancedParameters.runAsynchronously` is written on every command
row as literal `false` (`controller/server/runs.ts:117`,
`controller/server/scripting/protocol-script-executor.ts:30`) and **no scheduler
read ever consumes it** — it is a dead flag today.

So within one run, a long tool-server step and any other step cannot overlap —
even when they target **different tool servers** that are individually
concurrency-capable (each tool server owns its own motion/run-state locking and
serves its own port; the tool servers do not block each other — only this
scheduler does). Concretely, a real workcell cycle seen live (2026-11-03, the
galago-tools two-plate handoff): the F.A.S.T. tool's internal liquid transfer
ran ~73 s while the STACK arm sat idle at the tray — the operator wants the arm
free to maneuver (e.g. goto-safe) during that window:

```
in1 (STACK) → in2 (STACK) → { FAST liquid (73s) ∥ STACK goto-safe } → out1 → out2
```

~10 s per cycle and a cleaner dwell posture, without touching either tool
server's own discipline.

## Constraints that must NOT break (read these before designing)

1. **Single-flight Start guard** — the queue's "already running; nothing was
   dispatched again" refusal is a deliberate guard (the PROJECT.md core value:
   the operator decides every recovery action; the web app never
   auto-advances). A lane split must keep an explicit per-lane Start semantic,
   not silently widen the global guard.
2. **The tool-key ledger discipline** (each tool server's own ledger — e.g. the
   stack adapter's step-key ledger records every key once and refuses a
   same-key re-submit outside its replay window) is *per tool* and stays
   untouched: each leg still mints its own key in its own lane; nothing in the
   lane split may re-send or duplicate a key.
3. **The operator's physical-safety drill** (the sister project's runbook: a
   latched failure freezes everything for arm inspection) — the lane split must
   add a **lane-halt**: when any lane's step ends in a failure that would latch
   on that tool server, BOTH lanes freeze before the next dispatch, so an
   operator inspecting hardware never shares the space with a still-running
   second tool. (The latch itself is the tool server's; the queue's job is only
   to stop issuing new steps on any lane while a failure is being recovered.)
4. **Modal-state entanglement** — `variable_assignment`
   (`command_queue.ts:1306`, evaluated through `evaluateExpression`, line 319),
   `showUserForm`, pause/resume, `skipExecutionVariable` (line ~1023) all weave
   through the single stepper today. Lanes need a declared home for these:
   recommended — non-tool steps (assignments, forms, notes) only ever live on
   the primary lane, and `skipExecutionVariable` checks stay lane-local.
5. **Evidence order** — the runs' command rows currently imply a total order;
   with lanes the run page (and any downstream audit) must render per-lane
   order (monotone within a lane; cross-lane overlap allowed and timestamped).

## Suggested design sketch

- Add a lane key: `lane = toolType` (or `toolId`) on each queued step; the queue
  keeps `Map<lane, RunningStep>` and one busy-loop per lane. The Start guard
  becomes per-lane ("lane already running"), the global "queue already running"
  message only when ALL lanes are busy.
- Protocol-level opt-in: `advancedParameters.useParallelToolLanes: true` on a
  run (visual or script), gated behind a scoped feature flag
  (`.planning/config.json` → `workflow.parallel_tool_lanes`), default off — the
  sequential path must be byte-identical for single-tool runs.
- A step may declare `lane` explicitly (script protocols: `galago.lane("fast")`
  or a per-command field; visual: the advanced-parameters editor gains a lane
  selector). Unassigned steps go to the primary lane.
- Fork/join: a run's lane list is derived from the steps' lanes; the run is
  "complete" when every lane drains. A `join` step (optional) forces a barrier
  if a protocol wants one.

## Execution order

1. Queue internals: `Map<lane, step>` + per-lane Start guard + lane-aware
   `fail`/`failAndDequeueRun` bookkeeping (the failure path must mark the lane
   idle and freeze OTHER lanes while a latch-class failure is outstanding).
2. The protocol surface: the flag + the `lane` field + preview support
   (`protocol.preview` renders per-lane rows when the flag is on).
3. Run page: per-lane columns/order in the runs component; the operator sees
   both lanes' steps with their own statuses.
4. Docs: the queue's single-flight section in PROJECT.md + this todo's
   resolution note; the operator runbook (galago-tools) gains the parallel
   variant of its two-plate cycle only AFTER a live typed-GO'd proof.

## Verification

- `npm test` (tsc --noEmit) green.
- A regression unit test (or a documented manual queue test): a single-tool
  run behaves byte-identically with the flag off.
- With the flag on: a two-lane run where lane B starts while lane A's long step
  runs; a lane A failure freezes lane B before its next dispatch; the run page
  renders both lanes' rows; the tool servers each see exactly their own steps.

## Acceptance

- [ ] A live two-tool run where the STACK arm completes a short maneuver while
      the F.A.S.T. executes its internal transfer, with per-lane evidence rows
      and the ledger's per-key one-shot safety intact on both tools.
- [ ] The lane-halt behavior verified (a latched failure freezes both lanes).
- [ ] The feature flag off = byte-identical sequential behavior.
- [ ] PROJECT.md + this file's resolution note updated.
