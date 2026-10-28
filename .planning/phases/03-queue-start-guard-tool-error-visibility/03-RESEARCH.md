# Phase 3: Queue Start Guard & Tool Error Visibility - Research

**Researched:** 2026-10-28
**Domain:** galago-web (Next.js/tRPC) command queue, tool reply mapping, run page UI; Vitest pure-logic + FakeGrpc testing
**Confidence:** HIGH (every code claim below was read at HEAD `e2a93d6` this session; behaviours were reproduced with scratch Vitest runs that touched no repo file)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Single-flight start (QUE-07)**
- **D-01:** The guard lives in `CommandQueue._start()` itself (`server/command_queue.ts:875`), as its first statement: if `_runningPromise` is set, write a `warning` log "Queue Start Ignored" (details: the caller-visible reason and the in-flight queue_id if known) and return. It must run **before** `_failedAttempt = undefined`, the "Queue Started" log, `this.error = undefined` and `_setState(READY)`, so an ignored start changes no state and the queue still shows BUSY. One guard covers every entry point (Run button / `restart` router, `enqueueRun` auto-start), so no per-caller guards are added. — **Reversibility:** reversible
- **D-02:** An ignored start is not an error to the caller: `restart` resolves normally, no toast. The audit entry in Logs is the record. Rationale: the queue is already doing what the operator asked; a red toast would invite a second press.
- **D-03:** No defence-in-depth `startNext` status filter in this phase (F5 research option 2). It stays in Future Requirements; it changes `SqliteQueue` drain behaviour that existing tests pin.
- **D-04:** "Pause queue" then "Run" while a step is still in flight is ignored until the step ends (`stop()` sets OFFLINE before the loop exits). That is the accepted, safe behaviour; the operator presses Run again. Not fixed by changing `stop()`.

**What a Start will run (QUE-08)**
- **D-05:** Extend the existing Run confirmation modal in `components/runs/status/QueueStatuscomponent.tsx` (the "simulation mode" modal opened by `useDisclosure`). Keep its existing text. Add a read-only summary: "This Start will run N queued step(s) from M run(s)", and when F > 0, "F of them failed before and will be retried first." Nothing pre-selected, no new buttons, no timer, no Enter-bound default; the UI-08 static scan (`test/staticScan.test.ts`) must stay green and should gain a case covering this modal.
- **D-06:** The counts come from a pure helper (e.g. `summarizeQueuedStart(rows)` in a `components/runs/` logic module, alongside `pausePrompt.ts`-style files) fed by the `commandQueue.getAll` data the component already polls every 1 s. Unit-tested without jsdom. Rows counted: every row still in the queue (CREATED, FAILED, and STARTED if any); FAILED counted separately; distinct `runId`s counted. Empty queue: show "The queue is empty." and leave Run as it behaves today.
- **D-07:** The authoritative record is server-side: the "Queue Started" log entry (only when the start is not ignored) gains a details line listing the queue_ids and run_ids in queue order that this Start will run, read from the queue at that moment. The modal's client counts may be <=1 s stale; the log is what audits rely on.
- **D-08:** `enqueueRun`'s auto-start (queue READY) gets no confirmation (no UI there today) but gets the same "Queue Started" detail line through D-07.

**Retry-after-failure unchanged (QUE-09)**
- **D-09:** No change to `startNext`, `complete`, `fail*`, the plain-failure `break`, `recoverInterruptedSteps` or `failAndDequeueRun`. The retry, h0q, o44 and t9e tests listed in F5-ROOT-CAUSE.md section 7 must pass **unmodified** (a plan that edits them is wrong). New tests: F5 recipe D (single-flight, call count stays 1, "Queue Start Ignored" logged) and recipe A (a Start runs a FAILED retry and a leftover CREATED row in order, and the Start log lists them).

**Failing test first (ERR-01)**
- **D-10:** The first F3 task is a new `test/errorPath.test.ts`, committed failing before any fix: for every `ResponseCode` value (every non-SUCCESS code, plus SUCCESS-with-`error_message`), a `FakeGrpc` tool (`installFakeTool`) replies with a known message through a real `queue._start()`, and the test pins (a) `commandQueueRouter.createCaller({}).getError()` `message` / `userFriendlyMessage` / `code` / `codeString`, (b) the stored row error, (c) the "Tool Command Execution Error" / "Command Failed" log text. Table-driven over the enum so a new code cannot be silently missed.

**Message composition (ERR-02)**
- **D-11:** Extract a pure `describeToolReply(command, toolId, reply)` from `server/tools.ts:600-626`. `ERROR_FROM_TOOL` keeps its exact current wording (`Error from tool "<id>": <msg>`). For `UNRECOGNIZED_COMMAND`, `INVALID_ARGUMENTS`, `NOT_READY`, `WRONG_TOOL`, keep the generic sentence and append ` Tool said: <error_message>` when the message is non-empty. The default branch keeps the tool text. The tool text is never trimmed of content or replaced.
- **D-12:** `getError` (`server/routers/command_queue.ts:27-38`) stops overwriting `userFriendlyMessage` with its own generic sentences: it returns `error.message` (already composed by D-11). One place composes the operator text, not two.
- **D-13:** Fix the code name at its source: `ToolCommandExecutionError.codeString = String(code)` (`ResponseCode` is a string enum, so the current `typeof value === "number"` filter always yields "UNKNOWN"). Every consumer (banner badge, stored row error, logs) then shows e.g. `INVALID_ARGUMENTS`.
- **D-14:** A SUCCESS reply that carries a non-empty `error_message` is thrown with code `ERROR_FROM_TOOL`, not `SUCCESS`, so nothing labels it success. Behaviour otherwise unchanged (the row FAILs and stays queued; the STACK adapter contract keeps SUCCESS messages empty).

**Banner re-arm (ERR-04)**
- **D-15:** The queue keeps a monotonically increasing failure sequence number, incremented in every place `this.error` is set to a failure (`command_queue.ts:157, 899, 1382`), and `getError` returns it (e.g. `seq`) alongside the error. In-memory only, like `this.error`. This is the "small server change" the research flagged; accepted.
- **D-16:** `RunsComponent.tsx` replaces the `isErrorVisible` boolean with a `dismissedSeq`: the banner shows when the queue is FAILED, an error exists and `seq !== dismissedSeq`. Logic in a pure `components/runs/queueError.ts` (`shouldShowErrorBanner`, `describeQueueError`), unit-tested, also asserting the message is never empty and the badge is never `SUCCESS`.

**Step card error (ERR-03)**
- **D-17:** A pure `stepErrorText(command)` reads the stored row error (`command.error.message`, tolerating non-Error values) and `SwimLaneCommandComponent.tsx` renders it under the command label for FAILED rows, and for SKIPPED rows that carry an error as "Skipped after failure: <text>". Compact `Text` with `noOfLines` (card is ~165 px with scroll), selectable, full text available on hover/expand. It reads the persisted row, so it survives a cleared banner and a galago-web restart.

**Never shown as success (ERR-05)**
- **D-18:** A run whose steps include a SKIPPED step that carries a stored error is not reported as plain `COMPLETED` by `components/runs/utils.ts:28-41`. It gets a distinct non-success outcome (e.g. "Completed with skipped failure", warning colour), never the success badge/check. A plain operator Skip with no stored error keeps today's behaviour. Exact status name and how it threads through the run-status types is the planner's choice, but it must not be `COMPLETED`.
- **D-19:** The check icon stays `COMPLETED`-only; a FAILED step is never shown completed. Covered by the pure-helper tests plus a static scan case, not jsdom.

### Claude's Discretion
- Exact copy of the confirmation summary and the "Tool said:" joiner, as long as the tool's text is shown verbatim.
- File/module names for the pure helpers; whether `summarizeQueuedStart` and `stepErrorText` share a module with `queueError.ts`.
- Plan split (research suggests by requirement group: F5 plan(s), then F3 plans starting with ERR-01).

### Deferred Ideas (OUT OF SCOPE)
- ACK-AND-F3 section 4.4 item 5: "Send to Tool" (step menu) success/failure toast - not mapped to a requirement.
- Section 4.4 item 6: persistent tool-page command error toast - not mapped (Phase 4 may touch the tool page).
- Section 4.4 item 7: Gantt FAILED bar styling - not mapped.
- `startNext` skipping STARTED rows (F5 option 2) - already in Future Requirements.
- `GlobalQueueStatusIndicator` shows only "Run Error" off the run page - not mapped; candidate quick task.

### Hard constraints carried from the invocation
No instrument motion from tests (fakes only); no code path auto-recovers; retry-after-failure unchanged; the h0q/o44/t9e/retry regression tests pass unmodified; no new UI test dependencies (no jsdom/RTL) - UI behaviour is proven by pure-logic modules plus static source scans.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUE-07 | A Start, restart or enqueue while the busy loop runs never dispatches a row already in flight; extra start ignored and audited ("Queue Start Ignored"); FakeGrpc test proves `executeCommand` called once | Guard placement and the synchronous-claim constraint (Pitfall 1); reproduced double dispatch at HEAD under fake timers (14 ms test); recipe D in Code Examples |
| QUE-08 | Run confirmation shows how many queued rows will run, how many FAILED retries, how many distinct runs; Start logs queue_ids/run_ids | `getAll` over-counts (Pitfall 2): use the existing `commandQueue.commands` query; sync SqliteQueue read for the log (Pitfall 1); `summarizeQueuedStart` shape |
| QUE-09 | Retry-after-failure and h0q/o44/t9e unchanged; existing regression tests unmodified | Regression list with re-verified line numbers; nothing in `SqliteQueue` changes except an optional new read-only method |
| ERR-01 | Failing-first test drives each response code through the queue | Verified HEAD behaviour table per code; enum iteration; fake-timer table runs 9 codes in 35 ms |
| ERR-02 | Tool text for ERROR_FROM_TOOL; next to generic sentence for others; real code name | `describeToolReply` design; correction: router badge already shows the real code, only the class field says UNKNOWN |
| ERR-03 | Failed step card shows stored error message | Stored error is a plain `Error` with only `name`+`message` after a SQLite round trip; COMPLETED rows keep a stale `error`; `whiteSpace="nowrap"` pitfall |
| ERR-04 | Banner reappears on each new failure (seq in getError) | All three `this.error` set sites; non-ToolCommandExecutionError branch must be wrapped; restart-collision seed |
| ERR-05 | No tool error renders as success; failed step never completed; skipped-failure run not plain success | Run status helper has no live consumer today (call-site bug); least-invasive outcome shape; do not widen `RunStatus` |
</phase_requirements>

## Summary

All root-cause work is done; this research re-verified every cited line against HEAD, ran scratch experiments (in the scratchpad, no repo file touched) and found **six facts the CONTEXT/prior research did not have**, each of which changes a task:

1. **`getAll` is the wrong source for the Start summary (D-06).** `commandQueue.getAll` = `commands.all()` returns every stored command, including COMPLETED, SKIPPED and FAILED rows that were *dequeued* (accepted abort `failAndDequeueRun`, orphan recovery). Reproduced: after `failAndDequeueRun(1)`, `all()` returned `[1 FAILED, 2 SKIPPED, 3 CREATED]` while `getPaginated()` (the `commandQueue.commands` procedure, joined to `_queue`) returned only `[3 CREATED]`. Counting FAILED from `getAll` would claim a retry that will never run. Use `trpc.commandQueue.commands.useQuery({})` for the modal; no server change needed.
2. **The guard and the audit read must not be separated by an `await` (D-01 vs D-07).** `_runningPromise` is assigned synchronously inside the first `_start()` call today. If D-07's queue read is `await this.commands.getPaginated()` placed before line 891, two same-tick `_start()` calls both pass the guard. Add a synchronous read-only SqliteQueue method (or read after claiming).
3. **The router's code badge is already real.** `getError` returns `codeString: error.code.toString()` (`routers/command_queue.ts:45`), so the banner badge reads `ERROR_FROM_TOOL` today; only the *class field* `ToolCommandExecutionError.codeString` is "UNKNOWN" (reproduced: all 9 codes give "UNKNOWN"). ACK-AND-F3 section 4.2 item 5 overstated it. ERR-01's `codeString` assertion must also check the thrown error instance, otherwise it is vacuous for D-13.
4. **The run-status helper in `components/runs/utils.ts` has no live consumer.** `RunsComponent.tsx:324` passes `CommandInfo.data?.find(...)` (one command, not an array) to `getRunAttributes`, whose logic is gated on `Array.isArray(commandInfo)`, so status is always `"CREATED"`; and only `runName`/`commandsCount` are rendered. D-18 therefore needs a pure outcome helper **plus** wiring it (fix the call site and render a badge / non-success progress colour). `RunStatus` in `types/run.ts` must **not** be widened.
5. **A COMPLETED row keeps the `error` of its earlier failed attempt** (`_updateItem` merges). The card must render the stored error only for FAILED (and SKIPPED) rows.
6. **Fake `setTimeout` makes queue-level tests instant.** `vi.useFakeTimers({ toFake: ["setTimeout"] })` + `await vi.advanceTimersByTimeAsync(1500)` ran a real `queue._start()` for all 9 response codes in 35 ms total (vs 1.5 s each real). Recommended for the ERR-01 table and F5 recipe A.

**Primary recommendation:** Plan in five slices - (A) F5 server guard + start-log + tests, (B) QUE-08 modal summary (pure helper over the `commands` query + static scan), (C) ERR-01 failing test, (D) server error path (`describeToolReply`, `codeString`, ERROR_FROM_TOOL, `getError`, `seq`), (E) client error visibility (`queueError.ts`, banner re-arm, step card, run outcome, static scans) - with A and D serialised because both edit `command_queue.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Single-flight start guard | API / Backend (`CommandQueue._start`) | - | One in-memory busy-loop owner; all entry points (tRPC `restart`, `enqueueRun`) funnel through `_start` |
| "What a Start will run" audit line | API / Backend (`_start` + SqliteQueue read) | - | Authoritative record must be server-side (D-07) |
| Start confirmation summary counts | Browser / Client (pure helper) | API (`commands` query) | Display only; data comes from existing tRPC query; helper is pure/unit-testable |
| Tool reply to operator message | API / Backend (`describeToolReply`, `ToolCommandExecutionError`) | Browser (renders) | One place composes the text (D-12) |
| Failure sequence number | API / Backend (CommandQueue, in memory) | Browser (compares to `dismissedSeq`) | Server knows when a failure occurred; client only dismisses |
| Banner visibility / re-arm | Browser / Client (`queueError.ts`) | - | Pure predicate over state + error + dismissedSeq |
| Step card error text | Browser / Client (`stepErrorText`) | Database (persisted row error) | Reads the persisted row, so it survives banner clear and restart |
| Run outcome (skipped-failure not success) | Browser / Client (pure helper) | - | Derived from the rows the page already polls; no new persisted status |

## Standard Stack

No new packages. Everything below is already in `controller/package.json`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 2.1.9 | Unit tests incl. fake timers | Existing runner; `vitest.config.ts` includes `test/**/*.test.ts`, `testTimeout: 15000`, `clearMocks: true` [VERIFIED: controller/vitest.config.ts, package.json `"vitest": "2.1.9"`] |
| superjson | ^1.12.2 | Row (de)serialization and tRPC transformer | Already used by `SqliteQueue._serialize` and `utils/trpc.ts` [VERIFIED: server/utils/SqliteQueue.ts:746-752, utils/trpc.ts:27] |
| better-sqlite3 | existing | In-memory queue DB for tests (`SQLITE_DB_PATH=":memory:"`) | `test/setup.ts` sets it [VERIFIED: test/setup.ts:1] |
| @chakra-ui/react | existing | `Text noOfLines`, `Badge`, modal pieces | Already used on these screens |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fake `setTimeout` for queue tests | Real 1.5 s sleep per iteration | Real timers are the existing pattern (`toolControl.test.ts`, ~50 s for 21 tests) but a 9-code table would cost ~14 s; fake timers keep it ~40 ms. Both work; the table and recipe A should use fake timers |
| jsdom / React Testing Library | Pure helper modules + static source scans | Forbidden by the hard constraint; matches PROJECT.md UI-08 decision |

**Installation:** none.

**Version verification:** `vitest 2.1.9` confirmed by the run banner `RUN v2.1.9` and package.json this session. No registry lookups needed (no new dependencies).

## Package Legitimacy Audit

No external packages are installed by this phase. Audit not applicable. Packages removed (SLOP): none. Flagged (SUS): none.

## Architecture Patterns

### System Architecture Diagram

```
Operator "Start" click ──> QueueStatusComponent modal (reads commandQueue.commands, 1 s poll)
        │                         summarizeQueuedStart(rows) -> "N steps from M runs, F retried first"
        │ Accept
        v
tRPC commandQueue.restart ─────┐         enqueueRun (state READY) ─────┐
                               v                                        v
                       CommandQueue._start()  <──────────────── (same method)
                               │
              [1] _runningPromise set? ──yes──> logAction warning "Queue Start Ignored" ; return (no state change)
                               │ no
              [2] SYNC read of queued rows (queue order) -> "Queue Started" log with queueId/runId list
              [3] _failedAttempt=undefined; error=undefined; state READY; _runningPromise = busy loop (SYNC claim)
                               v
              busy loop: sleep 1.5 s -> commands.startNext() -> Tool.executeCommand(...)
                               │
          reply ──> describeToolReply(command, toolId, reply) ──> null (clean SUCCESS, row complete)
                               │                                  └> {code, message} -> ToolCommandExecutionError(message, code)
                               v
           catch: commands.fail(row, err)  (row FAILED, stays queued, serialized via SuperJSON: name+message only)
                  _recordFailure(err): this.error = err; _failureSeq++ ; state FAILED ; "Command Failed" log ; break
                               v
  getError (router) -> { message, userFriendlyMessage(=message), code, codeString, name, stack, seq }
                               v
  RunsComponent: shouldShowErrorBanner(state, data, dismissedSeq) -> ErrorBanner (message + code badge)
  Step list (commandQueue.getAll rows): stepErrorText(row) -> SwimLane card text (FAILED / SKIPPED-with-error)
  Run list: deriveRunOutcome(run.Commands) -> badge + non-green progress for "completed with skipped failure"
```

### Recommended Project Structure
```
controller/
├── server/
│   ├── command_queue.ts         # _start guard + start log + _recordFailure/_failureSeq
│   ├── toolReply.ts (new, pure) # describeToolReply(command, reply) -> {code, message} | null
│   ├── tools.ts                 # executeCommand uses describeToolReply; ToolCommandExecutionError.codeString = String(code)
│   ├── routers/command_queue.ts # getError returns plain object incl. seq; no generic overwrite
│   └── utils/SqliteQueue.ts     # optional: sync read-only queued-rows method (no behaviour change)
├── components/runs/
│   ├── queueError.ts (new)      # shouldShowErrorBanner, describeQueueError, stepErrorText
│   ├── queuedStartSummary.ts (new) # summarizeQueuedStart(rows)
│   ├── runOutcome.ts (new)      # deriveRunOutcome(commands), runOutcomeBadge(outcome)
│   ├── utils.ts                 # getRunAttributes delegates to deriveRunOutcome
│   ├── RunsComponent.tsx        # dismissedSeq; pass run.Commands; outcome badge
│   ├── list/SwimLaneCommandComponent.tsx # stepErrorText line
│   └── status/QueueStatuscomponent.tsx   # modal summary from commands query
└── test/
    ├── errorPath.test.ts (new, written first, red)
    ├── queueStartGuard.test.ts (new)
    ├── queueError.test.ts, queuedStartSummary.test.ts, runOutcome.test.ts (new, pure)
    └── staticScan.test.ts (extended)
```

### Pattern 1: Pure-logic module + static scan (UI-08)
**What:** React-free module (`import type` only) like `components/runs/pausePrompt.ts`, tested directly by Vitest; components only call it. A static scan over `stripComments(read(file))` pins that the component wires it and never does the forbidden thing.
**When to use:** every new client behaviour in this phase.

### Pattern 2: Single failure-recording helper
**What:** replace the three `this.error = ...` set sites with one private `_recordFailure(error: Error)` that sets `this.error`, increments `_failureSeq`. A static scan then asserts `this.error = ` with a non-`undefined` right-hand side appears exactly once in `server/command_queue.ts`, so a fourth site cannot be added without bumping the seq.
**Sites verified:** `command_queue.ts:156-157` (`fail(error)`; no caller outside tests found by grep), `:899` (`_start` catch, "Queue failed to start"), `:1382` (busy-loop catch, after the `rowRemoved` early `break`). Clear sites (no seq change): `:815-817` (resume), `:849`/`:865` (`clearAll`/`clearError`), `:884` (`_start`).

### Anti-Patterns to Avoid
- **`await` between the guard and `_runningPromise = ...`:** reopens the double-start window (Pitfall 1).
- **Summarising from `getAll`:** counts dequeued FAILED rows (Pitfall 2).
- **Adding a member to `RunStatus`:** it is the persisted per-command status (`setRunStatusWithTimestamp` throws on unknown values, `SqliteQueue` writes it to the `status` column). Run-level outcome is a separate, client-only string union.
- **Changing `queue.error`'s type:** `toolControl.test.ts:504,590` assert `queue.error?.message`; keep it the raw thrown `Error`, store `seq` separately.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timing the 1.5 s busy-loop sleep in tests | `setTimeout` waits / `vi.waitFor` polling | `vi.useFakeTimers({ toFake: ["setTimeout"] })` + `vi.advanceTimersByTimeAsync(1500)` | Verified 35 ms for 9 queue runs; remember `vi.useRealTimers()` in `afterEach` |
| Iterating response codes | Hard-coded code list | `Object.values(ResponseCode)` and a `Record<ResponseCode, Expectation>` table | String enum has no reverse mapping; `Record<ResponseCode,...>` makes `tsc` fail when a code is added |
| Error (de)serialization | Custom JSON of errors | Existing SuperJSON round trip | Already stores `{name, message}` for `Error` |
| Gating "Start" logic in the modal | Timers, default focus, forms | Read-only `Text` lines added to the existing modal | UI-08 / D-07(v1) rules |

**Key insight:** every behaviour here is a small pure function plus a wiring line; the risk is in *what data feeds it* (getAll vs commands, stored error shape, call-site bugs), not in the logic.

## Re-verified Line References (drift report)

All against HEAD `e2a93d6` (controller/ working tree clean). `[VERIFIED: file:lines]` by Read/sed this session.

| Reference (CONTEXT / prior research) | Status at HEAD | Note |
|---|---|---|
| `command_queue.ts` `_start` :875-908 | exact | `_runningPromise` assigned :891, cleared :903; `stop()` :911-941 (sets OFFLINE :912, awaits loop :914-916) |
| `this.error` sets :157, :899, :1382 | exact | clears :815-817, :849/:865, :884 |
| failure catch :1320-1405 | exact | `rowRemoved` early `break` :1366-1379 precedes the error set :1382 |
| `enqueueRun` auto-start :1431 | exact | `if (this.state === ToolStatus.READY) { this._start(); }` (unawaited) |
| F5-ROOT-CAUSE "busy loop :937 / sleep :945 / recover call :887" | **drift +3..+6** | actual: loop :943, sleep :948, recover call :890. CONTEXT.md numbers are correct; use CONTEXT's |
| `tools.ts` reply switch :600-646 | exact | non-SUCCESS block :600-634; SUCCESS-with-message :637-646 |
| `ToolCommandExecutionError` :750-772 | :751-772 | class field `codeString` filtered on `typeof value === "number"` :765-772 |
| `routers/command_queue.ts` restart :11-13, getError :17-53 | exact | generic overwrites :27-38; `codeString: error.code.toString()` :45; non-TCE `return error;` :52 |
| `RunsComponent.tsx` `isErrorVisible` :76; `getError` poll :162; ErrorBanner :227-297 | exact | close handler :290; `find(...)` single-command bug :324; `getRunAttributes` call :328 |
| `QueueStatuscomponent.tsx` getAll poll :39; modal :85-106; `useDisclosure` :51; text :93 | exact | `getAll` is also used for `hasCommandsToClear` :113 (keep it) |
| `SwimLaneCommandComponent.tsx` FAILED red bg :62-63; check icon :102; Send to Tool :135; card 165 px :86 | exact | `queued` includes FAILED so Skip is offered on FAILED rows :69-71 |
| `components/runs/utils.ts` run status "28-41" / ACK "34-41" | **drift** | the logic is :29-46 (COMPLETED branch :29-31, FAILED :32-33, SKIPPED-last branch :39-46) |
| `types/run.ts` `RunStatus` :3, `error?: unknown` :20 | exact | `RunStatus = "CREATED" \| "STARTED" \| "FAILED" \| "COMPLETED" \| "SKIPPED"` |
| Regression test lines in F5 section 7 | exact | `toolControl.test.ts` :474, :554, :604, :658, :719, :782, :856, :898, :937; `sqliteQueue.test.ts` :76, :90, :281, :301, :373, :396; `queueRestart.test.ts` :78, :131 |

## Blast radius for D-18 (run outcome) - consumers found

`ResponseCode` enum [VERIFIED: gen-interfaces/tools/grpc_interfaces/tool_base.ts:30-40] quoted verbatim: `UNKNOWN_RESPONSE = "UNKNOWN_RESPONSE"`, `SUCCESS = "SUCCESS"`, `WRONG_TOOL = "WRONG_TOOL"`, `UNRECOGNIZED_COMMAND = "UNRECOGNIZED_COMMAND"`, `INVALID_ARGUMENTS = "INVALID_ARGUMENTS"`, `DRIVER_ERROR = "DRIVER_ERROR"`, `NOT_READY = "NOT_READY"`, `ERROR_FROM_TOOL = "ERROR_FROM_TOOL"`, `UNRECOGNIZED = "UNRECOGNIZED"` (9 values).

`RunStatus` [VERIFIED: types/run.ts:3]: `export type RunStatus = "CREATED" | "STARTED" | "FAILED" | "COMPLETED" | "SKIPPED";`

| Consumer | File:line | Uses | Effect of a new run outcome |
|---|---|---|---|
| `getRunAttributes` (run-level status) | `components/runs/utils.ts:3-59`, sole caller `RunsComponent.tsx:328` | returns `status` string | Only live reader is the memo compare `RunsComponent.tsx:327` (`runAttributesMap[run.Id].status !== cmdInfo?.status`); **status is never rendered**. Rendered fields: `runName` :435, `commandsCount` :405/:414 |
| duplicate `getRunAttributes` | `utils/runUtils.ts:29-` (imports `@/server/protocols`) | same logic | **Dead**: `grep -rn runUtils` finds no importer. Leave untouched (or note for cleanup); do not "fix" it |
| Progress bar | `RunsComponent.tsx:405-420` | counts `COMPLETED \|\| SKIPPED` / `commandsCount`, `colorScheme="teal"` | A run whose failed step was skipped shows a full teal bar: this is the real "looks successful" surface. Switch the colour for the new outcome |
| "Completed" stat | `RunsComponent.tsx:301-303` | `every(cmd.status === "COMPLETED")` | SKIPPED already excluded, so a skipped-failure run is **not** counted completed (counted "pending" via :307). No change required |
| Gantt | `RunQueueGanttChart.tsx:94, 261, 289-291` | per-command status only | No run-level use; Gantt FAILED styling is deferred |
| Step card / list | `SwimLaneCommandComponent.tsx:44-103`, `SwimLaneComponent.tsx:18` | per-command status | Unaffected; check icon already `status === "COMPLETED"` only (:102) |
| Persistence | `server/utils/HasRunStatus.ts:5-28`, `SqliteQueue.ts` | `RunStatus` switch, `default: throw new Error("Invalid status: ...")` | **Must not** gain a member |

**Recommended least-invasive shape [ASSUMED design recommendation, planner's choice per D-18]:**
- New pure `components/runs/runOutcome.ts`: `type RunOutcome = "CREATED" | "QUEUED" | "STARTED" | "FAILED" | "COMPLETED" | "COMPLETED_WITH_SKIPPED_FAILURE"` plus `deriveRunOutcome(commands)` reproducing the current decision order of `utils.ts:29-46`, with one new rule evaluated **before** both COMPLETED branches: if no row is FAILED/STARTED/CREATED and some row is `SKIPPED` with a truthy stored `error`, return `COMPLETED_WITH_SKIPPED_FAILURE`. Note the first branch (`lastCommand.status === "COMPLETED"`) must also be guarded: steps `[A skipped-with-error, B COMPLETED]` is otherwise plain COMPLETED and hides the skipped failure.
- `getRunAttributes` calls it; `RunsComponent.tsx:324` passes `run.Commands` instead of the single `find(...)` result, and the `status !== cmdInfo?.status` memo condition is dropped (recompute each poll; the function is synchronous).
- Render: a small `Badge` next to the run name from `runOutcomeBadge(outcome)` (warning colour, never `green`/`teal`) and `colorScheme="orange"` on the Progress bar for that outcome. Static scan: `RunsComponent.tsx` references `deriveRunOutcome`/`getRunAttributes` and `runOutcome.ts` never maps `COMPLETED_WITH_SKIPPED_FAILURE` to a success colour.
- Blast radius of this shape: `RunsComponent.tsx`, `utils.ts`, one new module; zero server/type/persistence change.

## ERR-01: how the stored error survives, what each API returns (all reproduced)

- **Stored row error after a round trip:** `fail()` -> `_updateItem` -> `SuperJSON.stringify` [VERIFIED: server/utils/SqliteQueue.ts:500-508, 683-706, 746-752]. After `getAll`/`getPaginated`/`find`, `row.error` is a **plain `Error`** (`constructor.name === "Error"`, `Object.prototype.toString` = `[object Error]`, own props `stack`, `message`, `name`), **not** an `instanceof ToolCommandExecutionError`, `.code` is `undefined`, `.name` is preserved as `"ToolCommandExecutionError"`. So the card can show message text only, never the code (do not promise a code on the card). The type is `unknown` (`types/run.ts:20`), so `stepErrorText` must tolerate Error, string, `{message}` and nothing.
- **`getAll` vs `commands`:** `getAll` -> `commands.all()` (every stored row, ordered by `queue_id`); `commands` (router input `{limit?, offset?}`, defaults 20000/0) -> `getPaginated` which joins `_queue` ordered by `position` [VERIFIED: routers/command_queue.ts:74-92, SqliteQueue.ts:360-393]. Row fields: `queueId`, `runId`, `status`, `commandInfo`, `createdAt/startedAt/failedAt/completedAt/skippedAt`, `error`, `estimatedDuration?`, `durationActual?` [VERIFIED: types/run.ts:14-21, SqliteQueue.ts:6].
- **Stale error:** after `fail(3, Error("first"))` -> `startNext` -> `complete(3)` the COMPLETED row still had `error.message === "first"`; a FAILED-then-`skip` row kept its error and `failedAt` (reproduced). Render error only for FAILED/SKIPPED.
- **HEAD behaviour per code** (message "MSG<code>" supplied by the fake tool; reproduced through a real `queue._start()`):

| Code | stored row error message / `getError().message` | `getError().userFriendlyMessage` | `getError().code` / `.codeString` | "Tool Command Execution Error" log |
|---|---|---|---|---|
| UNKNOWN_RESPONSE, DRIVER_ERROR, UNRECOGNIZED | tool text | tool text | code / real name | `...Error: MSG<c> (Code: c)` (tool text kept) |
| SUCCESS + message | tool text | tool text | **`SUCCESS`** / `SUCCESS` (D-14 expects ERROR_FROM_TOOL) | `...Error: MSG<SUCCESS>` (no code) |
| WRONG_TOOL | fixed sentence, **tool text dropped** | same sentence | real / real | sentence, tool text dropped |
| UNRECOGNIZED_COMMAND | `The command "transfer" is not recognized by the tool "fast-1". Please verify ...`, tool text dropped | shorter generic `This command is not recognized by the tool. ...` | real / real | generic, tool text dropped |
| INVALID_ARGUMENTS | `Invalid arguments provided for command "transfer". Check the parameters and try again.`, dropped | `Invalid arguments provided for this command. Please check the parameters.` | real / real | generic, dropped |
| NOT_READY | `The tool "fast-1" is currently not ready. Please wait and try again.`, dropped | `The tool is not ready. Please check its status and try again.` | real / real | generic, dropped |
| ERROR_FROM_TOOL | `Error from tool "fast-1": MSG<ERROR_FROM_TOOL>` | same | real / real | same |

  Also at HEAD: the thrown instance's `codeString` is `"UNKNOWN"` for all 9 codes; `Object.entries(ResponseCode).filter(([_, v]) => typeof v === "number")` is `[]`. `getError()` for a TCE is a **plain object**, not an `Error` instance; state after the run is `FAILED`, the row is `FAILED` and stays queued, and the logs seen were `Queue Started`, `Tool Command Execution`, `Tool Command Execution Error`, `Command Failed`.
- **What fails first (red) in `errorPath.test.ts`:** tool text present in message/row/log for WRONG_TOOL, UNRECOGNIZED_COMMAND, INVALID_ARGUMENTS, NOT_READY; `userFriendlyMessage` containing the tool text (same four); SUCCESS+message `code === ERROR_FROM_TOOL`; thrown-instance `codeString === String(code)` (all codes, asserted via `Tool.executeCommand` directly, because `getError().codeString` already passes); `seq` present and strictly increasing across two failures. Already green at HEAD (keep as pinned controls): ERROR_FROM_TOOL wording, default-branch codes, `getError().code`/`codeString`, row FAILED + queue FAILED + row stays queued.
- **Cases to include beyond one-message-per-code:** each non-SUCCESS code with **empty** `error_message` (operator text must be non-empty and contain no "Tool said"); clean SUCCESS (`return_reply: true`, no message) and SUCCESS with neither -> row COMPLETED, no error (negative control, ERR-05).
- **Structure and speed:** one `queue` + one `FakeGrpc`, loop over the table; per case `commands.clearAll()`, `queue.clearError()`, push one row, `grpc.executeCommand.mockResolvedValueOnce({ response, error_message, return_reply: true })`, `const p = queue._start(); await vi.advanceTimersByTimeAsync(1500); await p;`. Whole 9-code table: **35 ms** [VERIFIED: scratch run]. `(globalThis as any)["__global_command_queue_key"] = queue` is required for `commandQueueRouter.createCaller({}).getError()` (same as `toolControl.test.ts:15-17`). If the planner prefers real timers: ~1.5 s per code (~14 s for the table in its own file; files run in parallel, so suite wall time is unaffected, `toolControl.test.ts` alone is 50 s). Do **not** drop the queue-level check for a direct unit only; add a direct `describeToolReply` unit as a cheap second layer.
- **Exhaustiveness:** `const EXPECT: Record<ResponseCode, Case>` (compile-time) plus `expect(Object.keys(EXPECT).sort()).toEqual(Object.values(ResponseCode).sort())` (runtime). Include `UNRECOGNIZED` (it is a real enum member decoded for unknown wire ints).

## D-15: failure seq and the getError shape

- **Consumers of `getError` payload:** `RunsComponent.tsx:162-166` (poll 1.5 s, `select: (data) => data || null`) and `ErrorBanner` :227-297 reads `userFriendlyMessage` else `message`, `codeString` else `code`, and `JSON.stringify(getError.data)` for the Details modal (`ErrorModal`, props `{message, code?, details?}`); `QueueStatuscomponent.tsx:52` only calls `getError.refetch()` in `onSettled` (data unused); `GlobalQueueStatusIndicator.tsx:14` has the call commented out. No other reader (grep of components/pages/utils/hooks) [VERIFIED]. Adding `seq` is additive for all of them.
- **Non-TCE branch:** returns the raw `Error` (`routers/command_queue.ts:52`); SuperJSON ships `name`/`message` only, so `seq` cannot ride on it. Return a plain object for every error: `{ message, userFriendlyMessage: message, name, stack, seq }`, plus `code`/`codeString` for TCE. Preserve today's badge for non-TCE errors that carry a `code` (a gRPC `ServiceError` has a numeric `code`, which the client renders as `Code <n>` at `RunsComponent.tsx:250-251`): include `code` when `typeof error.code === "number" || "string"`. Side benefit: Details no longer shows `{}` (JSON.stringify of a raw Error).
- **Where to keep it:** `private _failureSeq = 0` + `get failureSeq()`; `getError()` at `command_queue.ts:410-412` keeps returning `this.error || null` (tests rely on `queue.error`). The router reads both.
- **Restart collision [ASSUMED design risk]:** a page left open across a galago-web restart holds `dismissedSeq = 3`; after restart `_failureSeq` restarts at 0 and the third failure collides. Seed `_failureSeq` from `Date.now()` (or a boot id compared in `getError`). Tests then assert `seq2 > seq1`, never exact values.
- **Dismiss race:** state (1 s poll) can be FAILED a moment before `getError` (1.5 s poll) returns the new seq; the banner just appears on the next poll. `shouldShowErrorBanner` takes `(queueState, error, dismissedSeq)`; legacy payload without `seq` must still show.

## Start log and in-flight edge (D-07, D-05)

- `_start()` today logs `{ level: "info", action: "Queue Started", details: "Command Queue started by user." }` [VERIFIED: command_queue.ts:878-882]; no test pins that text (grep). Extend `details` with a bounded, ordered listing, e.g. `Command Queue started by user. Will run 3 step(s) from 3 run(s), 1 FAILED retry first: queueId=4 runId=... [FAILED]; queueId=5 runId=...`. Cap (e.g. first 50 rows then `... and N more`) so a huge queue cannot write an unbounded log row [ASSUMED].
- Read the rows **synchronously**: `SqliteQueue.all()`/`getPaginated()` are `async` but contain no `await`; calling them from `_start` forces an `await` before `_runningPromise` is claimed. Either add a sync method (e.g. `queuedRowsSync()` reusing the `getPaginated` SQL; read-only, D-09 unaffected) or compute the listing after the claim. A same-tick test (`const a = q._start(); const b = q._start();`) pins it: at HEAD this logs "Queue Started" twice [VERIFIED: scratch]; after the fix once, plus one "Queue Start Ignored".
- "In-flight queue_id if known": `this._runningStep?.queueId`; before the first `startNext` (the first 1.5 s) there is none, log `queueId=unknown`.
- Modal subtlety: after "Pause queue" a STARTED row can sit in `_queue` while the Start button is shown (D-04); a Start is then ignored. `summarizeQueuedStart` should return `started` separately and the modal may add one read-only line ("1 step is still running; Start is ignored until it ends"). Not counting STARTED as "will run" is safer; discretionary [ASSUMED].

## Common Pitfalls

### Pitfall 1: Guard check separated from the claim by an await
**What goes wrong:** two near-simultaneous `_start()` calls both pass `if (_runningPromise)`.
**Why:** `_runningPromise` is only assigned at `command_queue.ts:891`; any `await` inserted earlier (e.g. awaiting a queue read for the D-07 log) opens a window.
**Avoid:** guard first, synchronous read for the log, claim, no awaits in between. **Detect:** same-tick double-start test (logs exactly one "Queue Started" and one "Queue Start Ignored").

### Pitfall 2: Counting from `getAll`
**What goes wrong:** modal says "2 steps, 1 failed retry" when the failed row was dequeued by an accepted abort and will not run.
**Avoid:** feed `summarizeQueuedStart` from `trpc.commandQueue.commands.useQuery({}, { refetchInterval: 1000 })`. Keep the existing `getAll` query for `hasCommandsToClear`.

### Pitfall 3: Vacuous `codeString` assertion
**What goes wrong:** a test on `getError().codeString` is green at HEAD, so ERR-01 would not fail for D-13.
**Avoid:** assert the thrown `ToolCommandExecutionError` instance (`Tool.executeCommand` against `FakeGrpc`, `rejects` + `toMatchObject({ code, codeString: code })`).

### Pitfall 4: Step card shows a stale error
**What goes wrong:** a retried-then-COMPLETED row, or a STARTED retry, renders its old error. **Avoid:** `stepErrorText` result is rendered only when `status === "FAILED"` (plain) or `status === "SKIPPED"` (prefixed "Skipped after failure: "); `stepErrorText` itself should take the whole command and return `null` for any other status.

### Pitfall 5: `whiteSpace="nowrap"` kills line clamping
**What goes wrong:** `SwimLaneComponent.tsx` wraps the cards in `<Box ... whiteSpace="nowrap">`, inherited by the card, so `noOfLines` text does not wrap and overflows. **Avoid:** on the error `Text` set `whiteSpace="normal"`, `wordBreak="break-word"`, `fontSize="sm"`, `noOfLines={3}`, `title={fullText}`. The card is `height="165px"` with `overflowY="auto"` and the label Box is `position="sticky" bottom={0}`; put the error text above the sticky label so it scrolls, not behind it [VERIFIED: SwimLaneCommandComponent.tsx:86-87, 154-156; SwimLaneComponent.tsx:30].

### Pitfall 6: Run outcome helper wired to nothing
**What goes wrong:** fixing `utils.ts` alone changes no pixel (status never rendered; call site passes one command). **Avoid:** fix `RunsComponent.tsx:324` (`run.Commands`), drop the :327 status compare, render the badge/colour (see D-18 section).

### Pitfall 7: Fake timers leaking or hiding bugs
**What goes wrong:** `vi.useFakeTimers()` default also fakes `setImmediate`/`Date`; unrestored fake timers break later tests in the file. **Avoid:** `toFake: ["setTimeout"]` only; `afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); })`; remove fake tools (`removeFakeTool("fast-1")`) as `toolControl.test.ts` does.

### Pitfall 8: Editing a protected regression test
**What goes wrong:** D-09/QUE-09 forbid modifying h0q/o44/t9e/retry tests. All new tests go in **new files** (`errorPath`, `queueStartGuard`, pure helper tests) and `staticScan.test.ts` only gains new `it(...)` blocks.

### Pitfall 9: Static-scan collisions in `QueueStatuscomponent.tsx`
Existing scan lists it in the "countdown stop modal is not reused" files (no `StopRunModal` text) [VERIFIED: staticScan.test.ts:294-306]. Do not import/mention it. `refetchInterval:` does not match the timer pattern `/\b(?:window\.|globalThis\.)?set(?:Timeout|Interval)\(/` [VERIFIED: :288], but do not add `setTimeout`/`setInterval`.

## Code Examples

### `_start` guard (D-01) and ordering scan
```ts
// Source: server/command_queue.ts:875-884 (HEAD) + CONTEXT D-01/D-07
async _start() {
  if (this._runningPromise) {
    logAction({
      level: "warning",
      action: "Queue Start Ignored",
      details: `A queue start was ignored because the queue is already running (queueId=${this._runningStep?.queueId ?? "unknown"}).`,
    });
    return;
  }
  const queued = this.commands.queuedRowsSync(); // read-only, synchronous (name is the planner's)
  this._failedAttempt = undefined;
  logAction({ level: "info", action: "Queue Started", details: describeStartListing(queued) });
  this._setState(ToolStatus.READY);
  this.error = undefined; // (not a failure: no seq bump)
  // ... existing try/catch/finally unchanged ...
}
```
Static scan: `extractBracedRegion(stripComments(read("server/command_queue.ts")), /async _start\(/)`; assert `body.indexOf("this._runningPromise")` < every `indexOf` of `_failedAttempt = undefined`, `"Queue Started"`, `this.error = undefined`, `_setState(`; and that no `await` occurs before the first `this._runningPromise =` assignment in the region.

### F5 recipe D with fake timers (reproduced red at HEAD: second start dispatches again, calls = 2)
```ts
vi.useFakeTimers({ toFake: ["setTimeout"] });
const step = deferred<any>();
const spy = vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise);
await q.commands.push(row("r1"));
const l1 = q._start();
await vi.advanceTimersByTimeAsync(1500);
expect(q.runningStep).toBeDefined();
const l2 = q._start();                       // ignored: resolves immediately
await vi.advanceTimersByTimeAsync(1500);
expect(spy).toHaveBeenCalledTimes(1);
expect(q.state).toBe(ToolStatus.BUSY);
expect(logAction).toHaveBeenCalledWith(expect.objectContaining({ level: "warning", action: "Queue Start Ignored" }));
step.resolve(undefined);
await vi.advanceTimersByTimeAsync(5000);
await Promise.all([l1, l2]);
```

### F5 recipe A (a Start runs the FAILED retry then leftovers, one Start log lists them)
Push `row4`, `row5`; `grpc.executeCommand.mockResolvedValueOnce({ response: ResponseCode.INVALID_ARGUMENTS, error_message: "x" })` then default SUCCESS; first `_start()` -> FAILED, 1 call, statuses `["FAILED","CREATED"]`; push `row6`; `queue.clearError()`; clear the `logAction` mock; second `_start()`; expect gRPC call order `[row4, row4, row5, row6]` (use a distinguishing `params` value per row), all COMPLETED, and the second "Queue Started" `details` contains the three queue ids and run ids in order and marks the FAILED one. Fake timers: each `_start()` needs `advanceTimersByTimeAsync(1500 * (rows + 1))`.

### Pure helpers (shapes)
```ts
// components/runs/queuedStartSummary.ts
export interface QueuedStartSummary { total: number; failed: number; started: number; runs: number; isEmpty: boolean }
export function summarizeQueuedStart(rows: ReadonlyArray<{ status: string; runId: string }>): QueuedStartSummary
// willRun = rows whose status is not STARTED; failed = FAILED; runs = distinct runId of willRun rows; defensively ignore COMPLETED/SKIPPED
// copy builder: "This Start will run N queued step(s) from M run(s)." + (F>0 ? " F of them failed before and will be retried first." : "") | "The queue is empty."

// components/runs/queueError.ts
export function shouldShowErrorBanner(queueState: unknown, error: { seq?: number } | null | undefined, dismissedSeq: number | null): boolean
export function describeQueueError(data: unknown): { message: string; code: string; details: string } // message never ""; code never "SUCCESS"
export function stepErrorText(command: { status: string; error?: unknown }): string | null // FAILED -> text; SKIPPED+error -> "Skipped after failure: <text>"; else null
```

## State of the Art

| Old approach | Current approach | Impact |
|---|---|---|
| `isErrorVisible` boolean, never re-set | `dismissedSeq` compared with server `seq` | Every new failure re-shows the banner |
| Generic sentence replaces tool text | Generic sentence + ` Tool said: <text>` | Operator sees the reason for INVALID_ARGUMENTS/NOT_READY (the likely cause of the live F3 "nothing on screen" report) |
| Run status computed from a single command | Outcome derived from `run.Commands` | Skipped failure visible at run level |

**Deprecated/outdated:** `utils/runUtils.ts` is an unused duplicate; the F5-ROOT-CAUSE line numbers for `command_queue.ts` (drift above).

## Runtime State Inventory

Not a rename/refactor/migration phase - omitted. Note only: the failure `seq` and `this.error` are in-memory by design (D-15); the stored row error is persisted in the existing `command_data` JSON column, so no data migration is needed for the step card.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Seed `_failureSeq` from `Date.now()` (or boot id) to avoid dismissed-seq collision after a restart | D-15 | Low: a rare missed re-show after restart; user may prefer plain 0-start counter |
| A2 | Name `COMPLETED_WITH_SKIPPED_FAILURE` and the orange progress/badge treatment | D-18 section | Cosmetic; D-18 leaves naming to the planner |
| A3 | SUCCESS-with-message uses the ERROR_FROM_TOOL wording `Error from tool "<id>": <msg>` after D-14 (vs raw message) | ERR-01 | Text change only; CONTEXT says "behaviour otherwise unchanged" so the planner may keep raw text; pin tests with `toContain(toolText)` either way |
| A4 | Cap the Start-log listing at ~50 rows | Start log | Very large queues would otherwise write a huge log row |
| A5 | A whitespace-only tool message counts as empty for the "Tool said:" append (use `trim().length > 0`, never alter the appended text) | D-11 | Cosmetic |
| A6 | Modal shows an extra "step still running" line when a STARTED row exists | Start log / edge | Cosmetic; discretionary under D-05 |

## Open Questions

1. **Sync read method vs reading after the claim (D-07).**
   - Known: the guard must be await-free up to the `_runningPromise` claim.
   - Unclear: whether the user accepts a new read-only method on `SqliteQueue` (D-09 forbids changing `startNext/complete/fail*/recover*`, not adding a read).
   - Recommendation: add the read-only method; it changes no behaviour and keeps the audit line in `_start`.
2. **Should `summarizeQueuedStart` consume `commands` (recommended) or `getAll` as D-06 literally says?**
   - D-06 names `getAll` "already polled"; that data over-counts dequeued FAILED rows (reproduced). Recommendation: use `commands`; it is an existing procedure, no server change, one extra 1 s poll while the page is open. Surface this deviation in the plan so it is a conscious choice.
3. **Does the user want the run-outcome badge visible in the run list (this research recommends yes)?** D-18 only requires "not plain COMPLETED"; with no run-level status rendered today the minimum visible change is the Progress colour + badge.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (nvm) | tests, tsc | yes (needs PATH quirk) | v24.14.1 | - |
| vitest | unit suite | yes | 2.1.9 | - |
| TypeScript (`npx tsc`) | typecheck | yes | local `node_modules` | - |
| prettier (`.prettierrc`: printWidth 100, bracketSameLine, 2 spaces) | formatting | yes | local | - |
| Instruments / network / Docker | none (fakes only) | n/a | - | - |

Run commands (from `/home/formulatrix/data/nikko/galago-core/controller`): prefix with `export PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH`.
**Missing dependencies:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 (`environment: "node"`, `setupFiles: ["test/setup.ts"]`, `clearMocks: true`, `testTimeout: 15000`) |
| Config file | `controller/vitest.config.ts` |
| Quick run command | `npx vitest run test/<file>.test.ts` |
| Full suite command | `npm run test:unit` (= `vitest run`) and `npx tsc --noEmit` |
| Baseline at HEAD `e2a93d6` | `vitest run`: **14 files, 244 tests, all pass, ~52 s** (`toolControl.test.ts` alone ~50 s; files run in parallel). `npx tsc --noEmit`: clean, ~12 s |

`test/setup.ts` mocks `@/server/logger` (`logAction` is a `vi.fn`), so log assertions use `expect(logAction).toHaveBeenCalledWith(expect.objectContaining({ action, level }))` and read `mock.calls`; `clearMocks: true` resets them per test.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUE-07 | Second `_start()` while a step is in flight: one `executeCommand`, state BUSY, "Queue Start Ignored" warning logged; same-tick double start logs one "Queue Started"; `enqueueRun` while BUSY dispatches nothing extra | integration (FakeGrpc / Tool spy, fake timers) | `npx vitest run test/queueStartGuard.test.ts` | no - Wave 0 |
| QUE-07 | `_start` body: guard first, no `await` before the claim | static scan | `npx vitest run test/staticScan.test.ts` | extend |
| QUE-08 | `summarizeQueuedStart`: counts rows, FAILED separately, distinct runIds, empty queue, STARTED separate, ignores COMPLETED/SKIPPED defensively; copy builder text | unit (pure) | `npx vitest run test/queuedStartSummary.test.ts` | no - Wave 0 |
| QUE-08 | "Queue Started" details lists queueIds/runIds in order with FAILED marked, not logged when ignored (recipe A) | integration | `npx vitest run test/queueStartGuard.test.ts` | no - Wave 0 |
| QUE-08 | Modal: reads `commands` query, uses `summarizeQueuedStart`, no timers / `autoFocus` / `defaultValue` / `<form` / `StopRunModal`, existing warning text retained | static scan | `npx vitest run test/staticScan.test.ts` | extend |
| QUE-09 | Retry-after-failure, h0q, o44, t9e unchanged | existing suites, unmodified | `npx vitest run test/toolControl.test.ts test/sqliteQueue.test.ts test/queueRestart.test.ts` | yes |
| QUE-09 | Recipe A: FAILED retry runs first, leftover CREATED row runs after, in order | integration | `npx vitest run test/queueStartGuard.test.ts` | no - Wave 0 |
| ERR-01 | Table over `Object.values(ResponseCode)` (+ SUCCESS-with-message, empty-message variants, clean-SUCCESS controls) pinning `getError()` message/userFriendlyMessage/code/codeString, stored row error, "Tool Command Execution Error"/"Command Failed" log text; `Record<ResponseCode,..>` exhaustive | integration (FakeGrpc, fake timers) | `npx vitest run test/errorPath.test.ts` | no - Wave 0, commit red first |
| ERR-02 | `describeToolReply`: ERROR_FROM_TOOL exact wording; four generic codes keep sentence + ` Tool said: <msg>` only when non-empty; default keeps text; text never trimmed; instance `codeString === String(code)` for every code | unit (pure) + direct `Tool.executeCommand` | `npx vitest run test/errorPath.test.ts` (or `test/toolReply.test.ts`) | no - Wave 0 |
| ERR-03 | `stepErrorText`: FAILED text; SKIPPED+error prefixed; SKIPPED without error null; COMPLETED/STARTED with stale error null; tolerates string / `{message}` / undefined / non-Error | unit (pure) | `npx vitest run test/queueError.test.ts` | no - Wave 0 |
| ERR-03 | Card renders `stepErrorText`, error Text has `whiteSpace="normal"` and `noOfLines` | static scan | `npx vitest run test/staticScan.test.ts` | extend |
| ERR-04 | `seq` in `getError()` (strictly increasing across two failures, present on non-TCE errors, `null` after `clearError`); every `this.error =` non-undefined set goes through one helper (count == 1) | integration + static scan | `npx vitest run test/errorPath.test.ts test/staticScan.test.ts` | no / extend |
| ERR-04 | `shouldShowErrorBanner`: shows when FAILED + error + `seq !== dismissedSeq`; hidden after dismiss of same seq; reappears on next seq; legacy no-seq shows; not shown when state not FAILED | unit (pure) | `npx vitest run test/queueError.test.ts` | no - Wave 0 |
| ERR-04 | `RunsComponent.tsx` no longer contains `isErrorVisible`; uses `dismissedSeq` and `shouldShowErrorBanner` | static scan | `npx vitest run test/staticScan.test.ts` | extend |
| ERR-05 | `describeQueueError`: message never empty, badge never `SUCCESS`; SUCCESS-with-message is `ERROR_FROM_TOOL` at queue level | unit + integration | `npx vitest run test/queueError.test.ts test/errorPath.test.ts` | no - Wave 0 |
| ERR-05 | `deriveRunOutcome`: skipped-with-error (incl. when the last step is COMPLETED) is not `COMPLETED`; plain operator Skip unchanged; FAILED run is FAILED | unit (pure) | `npx vitest run test/runOutcome.test.ts` | no - Wave 0 |
| ERR-05 | Check icon only under `status === "COMPLETED"` (one `<CheckCircle`); outcome never mapped to a success colour | static scan | `npx vitest run test/staticScan.test.ts` | extend |

### Sampling Rate
- **Per task commit:** the new/changed file's quick command (<= a few seconds with fake timers); `npx tsc --noEmit` after any type-touching task.
- **Per wave merge:** `npm run test:unit` + `npx tsc --noEmit`.
- **Phase gate:** full suite green (244 existing + new) and tsc clean before `/gsd-verify-work`; the h0q/o44/t9e/retry files show zero diff (`git diff --stat -- controller/test/toolControl.test.ts controller/test/sqliteQueue.test.ts controller/test/queueRestart.test.ts` empty).

### Wave 0 Gaps
- [ ] `test/errorPath.test.ts` - ERR-01/02/04/05 (commit red first; D-10)
- [ ] `test/queueStartGuard.test.ts` - QUE-07/08/09 (recipes D, same-tick, A)
- [ ] `test/queueError.test.ts`, `test/queuedStartSummary.test.ts`, `test/runOutcome.test.ts` - pure helpers
- [ ] `test/staticScan.test.ts` - new `it` blocks only (no edits to existing ones)
- [ ] Framework install: none.

## Security Domain

`security_enforcement` is enabled (absent/true), ASVS level 1. galago-web has no authentication (project-wide, stated in ROADMAP Phase 4 notes), so V2/V3 are out of scope for this phase.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication / V3 Session | no | none exists project-wide |
| V4 Access Control | no (no new operations; Start behaviour only narrowed) | - |
| V5 Input Validation / Output Encoding | yes | tool-supplied text is rendered only through React/Chakra `Text` (auto-escaped); never `dangerouslySetInnerHTML`; existing zod input on `commands`/`restart` unchanged |
| V7 Error handling & logging | yes | audit entries for ignored/started queue (no secrets); keep `stack` exposure unchanged (already returned by `getError`); do not add tool text to anything but logs/UI |
| V6 Cryptography | no | - |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tool/gRPC reply text injected into UI (markup/script) | Tampering / Elevation | React escaping; assert in static scan that new components do not use `dangerouslySetInnerHTML` |
| Log flooding / forged log lines via long or multi-line tool text or a huge queue listing | Repudiation / DoS | single `details` field per entry, bounded queue listing (A4); tool text kept whole in the error but only clamped in the UI |
| Double dispatch of a physical instrument step | Safety / Tampering | single-flight guard with synchronous claim (QUE-07); no auto-recovery path added |

## Sources

### Primary (HIGH confidence) - read this session
- `controller/server/command_queue.ts` (:55-160, :400-415, :486-490, :805-853, :859-1013, :1296-1445)
- `controller/server/tools.ts` (:340-352, :596-659, :740-773)
- `controller/server/routers/command_queue.ts` (:1-162)
- `controller/server/utils/SqliteQueue.ts` (:55-150, :355-575, :680-756) and `server/utils/HasRunStatus.ts`
- `controller/components/runs/{RunsComponent.tsx, utils.ts, status/QueueStatuscomponent.tsx, status/GlobalQueueStatusIndicator.tsx, list/SwimLaneCommandComponent.tsx, list/SwimLaneComponent.tsx, gantt/RunQueueGanttChart.tsx, ErrorModal.tsx, pausePrompt.ts}`, `controller/utils/runUtils.ts`, `controller/types/run.ts`
- `controller/gen-interfaces/tools/grpc_interfaces/tool_base.ts:30-40` (ResponseCode)
- `controller/test/{staticScan,toolControl,queueRestart,sqliteQueue,setup,helpers/fakeTool}.ts(x)`, `controller/vitest.config.ts`, `controller/package.json`
- `.planning/research/F5-ROOT-CAUSE.md`, `.planning/research/ACK-AND-F3.md` section 4, `03-CONTEXT.md`, `REQUIREMENTS.md`, `ROADMAP.md` Phase 3
- Scratch Vitest runs (scratchpad only; no repo file modified): fake-timer 9-code table, dequeued-FAILED `all()` vs `getPaginated()`, stale error on COMPLETED/SKIPPED rows, recipe D double dispatch at HEAD, same-tick double start, class `codeString`
- Baseline runs: `vitest run` 14 files / 244 tests green (~52 s); `tsc --noEmit` clean (~12 s)

### Secondary / Tertiary
- None. No web sources were needed (no new libraries; all behaviour is in-repo).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; versions read from package.json and the run banner
- Architecture: HIGH - every integration point read and, for the risky ones, reproduced
- Pitfalls: HIGH - items 1-4 and 6 were reproduced or proven by reading the call site; 5 and 9 by reading source/scan code

**Research date:** 2026-10-28
**Valid until:** 2026-11-27 (stable in-repo code; re-check line numbers if `command_queue.ts` or the run page changes before planning)
