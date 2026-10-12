# Phase 1: Queue Control Path & Run State - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning
**Mode:** `--auto` (Claude picked the recommended option for every gray area; review before planning if any choice looks wrong)

<domain>
## Phase Boundary

Server side only (`controller/server/`, plus the shared `runControl` declaration and regenerated
interfaces). Phase 1 delivers:
- `commandQueue.toolControl({action, params})`, which sends an operator's Pause/Resume/Abort straight
  to the tool of the running step;
- a generic `runControl` capability per tool type, with the F.A.S.T. declared first;
- `commandQueue.runState`, which reports the running tool's live `run_state`;
- a `Tool` heartbeat that keeps retrying after a failure;
- regenerated interfaces with `StatusReply.run_state` and the F.A.S.T. `Pause` command.

None of it touches the queue's busy loop or its `UIMessage` modal plumbing. The run-page UI,
confirmations, the `tool_paused` prompt, the Stop confirmation and step-editor cleanup belong to
Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Running-step targeting (QUE-01, QUE-02)
- **D-01:** `CommandQueue` keeps an **in-memory** record of the step it is awaiting on a tool (queueId, runId,
  toolId, toolType, command, startedAt). The busy loop sets it immediately before the tool
  `executeCommand` and clears it in a `finally`. Expose it as a read-only accessor (e.g.
  `runningStep`). Do not read the `STARTED` row back from `SqliteQueue`: a crash or restart can leave
  that row stale. Design §8 requires that after a galago-web restart there is *no* running step and
  no control bar, and an in-memory record gives that for free.
- **D-02:** Only real tool steps set the record. Tool Box built-ins (pause, user_form, timer, note,
  stop_run, goto, variable_assignment, …) never do.
- **D-03:** `toolControl` refuses, without sending anything, when (a) there is no running step, (b) the running
  step's tool type has no `runControl` entry, (c) the action is not declared for that type, or (d) a
  declared decision is missing, blank, or anything other than exactly `"yes"`/`"no"`. Use a clear
  tRPC error (`PRECONDITION_FAILED` for a/b, `BAD_REQUEST` for c/d) with a human-readable message.
- **D-04:** No instrument-state checks in galago-core (PROJECT constraint; design §7.2). Whether Pause is
  allowed now is the core's call; galago-core never inspects `run_state` to block an action.

### Control send path and reply (QUE-01)
- **D-05:** Add a new `Tool.controlCommand(action, params)` that calls the gRPC `executeCommand` directly. It does
  **not** reuse `Tool.executeCommand`, which does variable substitution and the script, PF400 and
  other step plumbing. It is not enqueued, never stored as a step, and nothing in the busy loop
  awaits it. `toolControl` awaits only its own gRPC call.
- **D-06:** `toolControl` returns a structured result `{ ok, response, message }` and does not throw on a
  non-SUCCESS reply. A core `Refused` reaches the caller with its reason text intact (research:
  "show the Refused reason, not a generic failure"). Transport errors (gRPC unavailable) surface as a
  tRPC error. There is no optimistic state.
- **D-07:** Every attempt is logged with `logAction`, including refusals: `info` when sent, `warning`
  when refused or failed. The details carry toolId, queueId and runId, the action, the operator's
  decision values, and the outcome. No operator identity exists in the app, so none is logged.
- **D-08:** The F.A.S.T. control action maps 1:1 to its fast `Command` oneof (`pause`, `resume`,
  `abort`) with the declared params passed through as `"yes"`/`"no"` strings.

### runControl declaration (QUE-03)
- **D-09:** Add a new exported `runControl` map **separate from `commandFields`**. It goes in
  `controller/components/tools/constants.ts`, or a sibling `runControl.ts` if that is cleaner for
  server import. The shape is `{ [toolType]: { [action]: { [decision]: "yesno" } } }`. For the
  F.A.S.T. it is `{ pause: {}, resume: { is_tip_broken: "yesno" }, abort: { return_liquid: "yesno" } }`.
  Pause has **no** `hard` decision (design D5: soft pause only). Server validation (D-03) and the
  Phase 2 UI both read this one map. — **Reversibility:** costly — Phase 2's control bar, prompt and
  tool page all key off this shape.
- **D-10:** Leave the existing fast `abort`/`resume` entries in `commandFields` alone in this phase.
  Removing them from the step editor is UI-07 (Phase 2), and touching them here would change the
  step editor early.

### Run-state source and shape (QUE-04)
- **D-11:** A **server-side poller** fetches the running step's tool status every **2 s** (design D2). It
  starts when a step on a `runControl` tool type begins and stops when that step ends. It caches the
  latest result on the queue. `commandQueue.runState` reads the cache and does not trigger gRPC
  itself, so N browser tabs mean one gRPC poll, not N.
- **D-12:** `runState` returns a stable envelope, independent of `modalState`/`currentMessage`:
  `{ running: false }` when no controllable step is running. Otherwise it returns
  `{ running: true, queueId, runId, toolId, toolType, status: "ok" | "unknown", runState: {state,
  percent, pause: {name, code, detail, startedAt} | null} | null, updatedAt, lastError? }`. Including
  `queueId` lets Phase 2 correlate it with the queue's step list (research Pitfall 9).
- **D-13:** One adapter function, `extractRunState(statusReply)`, owns reading `run_state` from the
  status reply. Before QUE-06 lands it reads the field defensively, because the generated type lacks
  it. It parses the F.A.S.T. fields tolerantly: unknown extra fields are ignored, and a malformed
  payload gives `status: "unknown"` rather than an exception. After regeneration only this function
  changes.
- **D-14:** Observation never commands (design §7.4): the poller and `runState` only call `getStatus`.

### Heartbeat retry (QUE-05)
- **D-15:** `Tool.fetchStatus` no longer calls `stopHeartbeat()` on failure, for **all** tools, not only
  controllable ones (QUE-05 wording). On failure it sets `UNKNOWN_STATUS` and the heartbeat keeps
  its normal interval: no backoff, and no state change to the step.
- **D-16:** Failure logging is de-duplicated: log on the first failure of a streak and on recovery, not
  every 5 s. A consecutive-failure counter on `Tool` gives the planner/UI "unknown since".
- **D-17:** The 2 s run-state poller (D-11) follows the same rule: a failed poll sets `status: "unknown"`,
  keeps the last good `runState` alongside `lastError`/`updatedAt`, and retries on the next tick.

### QUE-06 sequencing (proto dependency)
- **D-18:** galago-tools Phase 1 has **not** produced the `run_state`/`Pause` proto commit yet. Its
  `feat/fast-tool` head is `aa88874` and the proto has no `run_state`. Plan QUE-06 as the **last**
  plan of the phase, gated on that commit. The plan bumps `vendor/galago-tools`, regenerates with
  `bin/make proto_ts` using ts-proto **1.151.1** (not the local 1.153.2), and gets `tsc --noEmit` to 0
  errors.
- **D-19:** Everything before QUE-06 builds against a mocked tool or gRPC client. The `pause` action can be
  declared and validated earlier, but sending it for real depends on the regenerated `fast.Command`.
  If the commit is still missing when the other plans finish, the phase pauses at that checkpoint;
  don't hand-edit the generated files.

### Test approach
- **D-20:** `controller/` has no unit-test runner today: `npm test` is `tsc --noEmit`. Add a lightweight
  runner for server-side unit tests (vitest preferred; the planner may pick `node:test` + `tsx` if
  vitest fights the Next/tsconfig setup). It covers the design §9 galago-core cases:
  - `toolControl` refusals (no running step, no `runControl`, undeclared action, blank or unclear
    decision);
  - `toolControl` reaches the tool while a step's `executeCommand` is still pending, and the busy
    loop's promise is unaffected;
  - `runState` independent of `modalState`;
  - heartbeat retry after failure.

  Tests use a mocked gRPC client, never a real tool. `tsc --noEmit` stays the gate.

### Claude's Discretion
- Exact names (`runningStep`, `controlCommand`, `extractRunState`, file split of `runControl`).
- Where the 2 s poller lives (on `CommandQueue` or a small `RunStateMonitor`), so long as its
  lifecycle is tied to the controllable step.
- Exact tRPC error codes and message wording within D-03/D-06.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Governing design
- `../galago-tools/docs/specs/2026-10-12-galago-live-run-control-design.md` — the governing spec,
  in the sibling repo at `/home/formulatrix/data/nikko/galago-tools`. The relevant sections:
  - §3: state model and decisions;
  - §5.3: `StatusReply.run_state`;
  - §6.1–6.3 and §6.5: capability, control path, polling, concurrency;
  - §7: safety invariants;
  - §8: failure modes;
  - §9: testing;
  - §11: D1–D6.

### Project planning
- `.planning/PROJECT.md` — constraints: `tool_paused` is not a `UIMessage`, no state checks, never reuse
  auto-confirming UI.
- `.planning/REQUIREMENTS.md` — QUE-01..QUE-06 wording.
- `.planning/ROADMAP.md` — Phase 1 success criteria and the Pitfall 9 research flag.
- `.planning/research/PITFALLS.md` — Pitfall 9, polling races with `modalState`, plus the
  security notes on `toolControl` (no optimistic UI, surface the `Refused` reason).
- `.planning/research/ARCHITECTURE.md` — the queue/modal architecture analysis.

### Companion project
- `../galago-tools/.planning/` — the adapter side (ADP-*); its Phase 1 produces the proto commit
  QUE-06 needs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `controller/server/tools.ts` `Tool`: one promisified gRPC `ToolDriverClient` per tool, with
  `getGlobalStore`/`getToolFromStore` for lookup by toolId. `Tool.forId` starts a 5 s heartbeat.
- `controller/server/logger.ts` `logAction({level, action, details})`: the audit trail.
- `controller/server/routers/command_queue.ts`: the tRPC router; add `toolControl` (mutation) and
  `runState` (query) next to `modalState`.
- `controller/components/tools/constants.ts` `commandFields`: the existing per-type command map.
  The fast entry is at about line 314, and its `abort`/`resume` entries are at about lines 345-346.

### Established Patterns
- The busy loop (`command_queue.ts:672+`, `_runBusyLoopWhileQueueNotEmpty`) awaits each step's
  `Tool.executeCommand`. Tool Box built-ins are handled inline, and some block on
  `_messageResolve`. Phase 1 must not alter that awaiting or the `_messageResolve` flow.
- `SqliteQueue.startNext()` marks rows `STARTED` in a transaction; nothing reads that state back.
  See D-01 for why we don't start now.
- `Tool.executeCommand` has no gRPC deadline, so a step stays open through a long pause. Keep it
  that way.
- Errors: `ToolCommandExecutionError(message, ResponseCode)`, mapped to friendly text in
  `getError`.

### Integration Points
- The busy loop's tool-step branch sets and clears the running-step record (D-01) and starts and
  stops the poller (D-11).
- `Tool.fetchStatus` gets the retry change (D-15).
- `vendor/galago-tools` submodule plus `controller/gen-interfaces/`, regenerated in QUE-06.

</code_context>

<specifics>
## Specific Ideas

- Run state is observation only; galago-core never sends Pause/Resume/Abort except from an explicit
  operator `toolControl` call.
- When a step ends `Aborted`, the adapter returns an error ("aborted by operator") and the existing
  busy-loop failure path already moves the queue to `FAILED`. No queue change is needed for that in
  this phase.

</specifics>

<deferred>
## Deferred Ideas

- **A combined run-page query** that merges `runState` into the queue's atomic state read (Pitfall 9)
  belongs to Phase 2's UI design. Phase 1 only makes it possible by returning `queueId` in
  `runState`.
- **Hard pause:** future requirement (D5).
- **Operator identity in control logs:** the app has no user/auth model, so out of scope.
- **F5/F3 debt:** out by user decision.

</deferred>

---

*Phase: 01-queue-control-path-run-state*
*Context gathered: 2026-10-12*
