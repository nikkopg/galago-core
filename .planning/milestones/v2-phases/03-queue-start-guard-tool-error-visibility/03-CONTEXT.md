# Phase 3: Queue Start Guard & Tool Error Visibility - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning
**Mode:** `--auto` (every decision below is the recommended option, grounded in
`.planning/research/F5-ROOT-CAUSE.md` and `.planning/research/ACK-AND-F3.md` §4; review before planning
if any should change)

<domain>
## Phase Boundary

Two related fixes in the queue and run page, built in one design pass because they edit the same files
(`server/command_queue.ts`, the run page, its error banner and the Run confirmation):

1. **Queue start (F5, QUE-07..09):** a second Start, restart or auto-start while the busy loop runs never
   dispatches the in-flight row again; the operator's Run confirmation states what a Start will run; the
   Start's log lists what it ran. Retry-after-failure is unchanged.
2. **Error visibility (F3, ERR-01..05):** a failed tool step shows the tool's own text in the banner, on the
   step card and in the log, with the real code name; the banner re-arms after a dismiss; no tool error is
   shown as success.

Not in this phase: anything STACK-specific (Phase 4/5), changing which rows a Start runs, the ACK-AND-F3
§4.4 items 5-7 (see Deferred).

</domain>

<decisions>
## Implementation Decisions

### Single-flight start (QUE-07)
- **D-01:** The guard lives in `CommandQueue._start()` itself (`server/command_queue.ts:875`), as its
  first statement: if `_runningPromise` is set, write a `warning` log "Queue Start Ignored" (details: the
  caller-visible reason and the in-flight queue_id if known) and return. It must run **before**
  `_failedAttempt = undefined`, the "Queue Started" log, `this.error = undefined` and `_setState(READY)`,
  so an ignored start changes no state and the queue still shows BUSY. One guard covers every entry
  point (Run button / `restart` router, `enqueueRun` auto-start), so no per-caller guards are added.
  — **Reversibility:** reversible
- **D-02:** An ignored start is not an error to the caller: `restart` resolves normally, no toast. The
  audit entry in Logs is the record. Rationale: the queue is already doing what the operator asked; a
  red toast would invite a second press.
- **D-03:** No defence-in-depth `startNext` status filter in this phase (F5 research option 2). It stays in
  Future Requirements; it changes `SqliteQueue` drain behaviour that existing tests pin.
- **D-04:** "Pause queue" then "Run" while a step is still in flight is ignored until the step ends
  (`stop()` sets OFFLINE before the loop exits). That is the accepted, safe behaviour; the operator
  presses Run again. Not fixed by changing `stop()`.

### What a Start will run (QUE-08)
- **D-05:** Extend the existing Run confirmation modal in
  `components/runs/status/QueueStatuscomponent.tsx` (the "simulation mode" modal opened by
  `useDisclosure`). Keep its existing text. Add a read-only summary: "This Start will run N queued
  step(s) from M run(s)", and when F > 0, "F of them failed before and will be retried first."
  Nothing pre-selected, no new buttons, no timer, no Enter-bound default; the UI-08 static scan
  (`test/staticScan.test.ts`) must stay green and should gain a case covering this modal.
- **D-06:** The counts come from a pure helper (e.g. `summarizeQueuedStart(rows)` in a
  `components/runs/` logic module, alongside `pausePrompt.ts`-style files) fed by the
  `commandQueue.getAll` data the component already polls every 1 s. Unit-tested without jsdom.
  Rows counted: every row still in the queue (CREATED, FAILED, and STARTED if any); FAILED counted
  separately; distinct `runId`s counted. Empty queue: show "The queue is empty." and leave Run as it
  behaves today.
- **D-07:** The authoritative record is server-side: the "Queue Started" log entry (only when the start
  is not ignored) gains a details line listing the queue_ids and run_ids in queue order that this Start
  will run, read from the queue at that moment. The modal's client counts may be ≤1 s stale; the log is
  what audits rely on.
- **D-08:** `enqueueRun`'s auto-start (queue READY) gets no confirmation (no UI there today) but gets the
  same "Queue Started" detail line through D-07.

### Retry-after-failure unchanged (QUE-09)
- **D-09:** No change to `startNext`, `complete`, `fail*`, the plain-failure `break`, `recoverInterruptedSteps`
  or `failAndDequeueRun`. The retry, h0q, o44 and t9e tests listed in F5-ROOT-CAUSE.md §7 must pass
  **unmodified** (a plan that edits them is wrong). New tests: F5 recipe D (single-flight, call count
  stays 1, "Queue Start Ignored" logged) and recipe A (a Start runs a FAILED retry and a leftover CREATED
  row in order, and the Start log lists them).

### Failing test first (ERR-01)
- **D-10:** The first F3 task is a new `test/errorPath.test.ts`, committed failing before any fix: for every
  `ResponseCode` value (every non-SUCCESS code, plus SUCCESS-with-`error_message`), a `FakeGrpc` tool
  (`installFakeTool`) replies with a known message through a real `queue._start()`, and the test pins
  (a) `commandQueueRouter.createCaller({}).getError()` `message` / `userFriendlyMessage` / `code` /
  `codeString`, (b) the stored row error, (c) the "Tool Command Execution Error" / "Command Failed" log
  text. Table-driven over the enum so a new code cannot be silently missed.

### Message composition (ERR-02)
- **D-11:** Extract a pure `describeToolReply(command, toolId, reply)` from `server/tools.ts:600-626`.
  `ERROR_FROM_TOOL` keeps its exact current wording (`Error from tool "<id>": <msg>`). For
  `UNRECOGNIZED_COMMAND`, `INVALID_ARGUMENTS`, `NOT_READY`, `WRONG_TOOL`, keep the generic sentence and
  append ` Tool said: <error_message>` when the message is non-empty. The default branch keeps the tool
  text. The tool text is never trimmed of content or replaced.
- **D-12:** `getError` (`server/routers/command_queue.ts:27-38`) stops overwriting `userFriendlyMessage`
  with its own generic sentences: it returns `error.message` (already composed by D-11). One place
  composes the operator text, not two.
- **D-13:** Fix the code name at its source: `ToolCommandExecutionError.codeString = String(code)`
  (`ResponseCode` is a string enum, so the current `typeof value === "number"` filter always yields
  "UNKNOWN"). Every consumer (banner badge, stored row error, logs) then shows e.g. `INVALID_ARGUMENTS`.
- **D-14:** A SUCCESS reply that carries a non-empty `error_message` is thrown with code
  `ERROR_FROM_TOOL`, not `SUCCESS`, so nothing labels it success. Behaviour otherwise unchanged (the row
  FAILs and stays queued; the STACK adapter contract keeps SUCCESS messages empty).

### Banner re-arm (ERR-04)
- **D-15:** The queue keeps a monotonically increasing failure sequence number, incremented in every place
  `this.error` is set to a failure (`command_queue.ts:157, 899, 1382`), and `getError` returns it (e.g.
  `seq`) alongside the error. In-memory only, like `this.error`. This is the "small server change" the
  research flagged; accepted.
- **D-16:** `RunsComponent.tsx` replaces the `isErrorVisible` boolean with a `dismissedSeq`: the banner
  shows when the queue is FAILED, an error exists and `seq !== dismissedSeq`. Logic in a pure
  `components/runs/queueError.ts` (`shouldShowErrorBanner`, `describeQueueError`), unit-tested, also
  asserting the message is never empty and the badge is never `SUCCESS`.

### Step card error (ERR-03)
- **D-17:** A pure `stepErrorText(command)` reads the stored row error (`command.error.message`, tolerating
  non-Error values) and `SwimLaneCommandComponent.tsx` renders it under the command label for FAILED
  rows, and for SKIPPED rows that carry an error as "Skipped after failure: <text>". Compact `Text`
  with `noOfLines` (card is ~165 px with scroll), selectable, full text available on hover/expand. It
  reads the persisted row, so it survives a cleared banner and a galago-web restart.

### Never shown as success (ERR-05)
- **D-18:** A run whose steps include a SKIPPED step that carries a stored error is not reported as plain
  `COMPLETED` by `components/runs/utils.ts:28-41`. It gets a distinct non-success outcome (e.g.
  "Completed with skipped failure", warning colour), never the success badge/check. A plain operator
  Skip with no stored error keeps today's behaviour. Exact status name and how it threads through the
  run-status types is the planner's choice, but it must not be `COMPLETED`.
- **D-19:** The check icon stays `COMPLETED`-only; a FAILED step is never shown completed. Covered by the
  pure-helper tests plus a static scan case, not jsdom.

### Claude's Discretion
- Exact copy of the confirmation summary and the "Tool said:" joiner, as long as the tool's text is shown
  verbatim.
- File/module names for the pure helpers; whether `summarizeQueuedStart` and `stepErrorText` share a
  module with `queueError.ts`.
- Plan split (research suggests by requirement group: F5 plan(s), then F3 plans starting with ERR-01).

### Folded Todos
None. The two pending todos matched only on keywords (see Deferred).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Root cause and fix design
- `.planning/research/F5-ROOT-CAUSE.md` — F5 verdict, candidate D mechanism (§5), fix options (§6),
  regression tests that must stay green (§7)
- `.planning/research/ACK-AND-F3.md` §4 — F3 trace, ranked loss points (§4.2), recommended changes
  (§4.4), why a failing test comes first (§4.5)
- `.planning/research/SUMMARY.md` — milestone v2 research summary

### Scope and constraints
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, notes, v2 hard constraints
- `.planning/REQUIREMENTS.md` — QUE-07..09, ERR-01..05; Future Requirements and Out of Scope tables
- `.planning/PROJECT.md` — Core Value (operator decides; no auto-recovery), Key Decisions (UI-08
  pure-logic + static scan testing, no jsdom)
- `.planning/milestones/v1-phases/02-run-page-live-controls/02-CONTEXT.md` — D-07 confirmation rules
  (no default, no timer, no Enter-bound default), D-09 persistent error toasts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `controller/test/helpers/fakeTool.ts` (`installFakeTool`, `FakeGrpc`) and the harness in
  `test/toolControl.test.ts` / `test/queueRestart.test.ts`: `new CommandQueue({} as any)` on
  `:memory:` SQLite. Each busy-loop iteration sleeps 1.5 s; use 15-30 s test timeouts.
- `commandQueueRouter.createCaller({})` for asserting `getError` without HTTP.
- `components/runs/pausePrompt.ts` + `test/pausePrompt.test.ts`: the pure-logic-module pattern to copy
  for `queueError.ts` and the start summary.
- `test/staticScan.test.ts`: UI-08 scans to extend for the confirmation and banner.

### Established Patterns
- `logAction({level, action, details})` for audit entries.
- `ResponseCode` is a **string** enum (generated `tool_base.ts`); compare/print with `String(code)`.
- `getError` already sets `codeString: error.code.toString()`, but the class field is "UNKNOWN"; fix in
  the class (D-13).

### Integration Points
- `server/command_queue.ts`: `_start` (:875-908), `stop` (:910-916), `enqueueRun` auto-start (:1431),
  failure catch (:1320-1405), `this.error` sets (:157, :899, :1382), `clearError` (:863).
- `server/tools.ts`: reply switch (:600-646), `ToolCommandExecutionError` (:750-772).
- `server/routers/command_queue.ts`: `restart` (:11-13), `getError` (:17-53).
- `components/runs/RunsComponent.tsx`: `isErrorVisible` (:76), `getError` poll (:162), `ErrorBanner`
  (:227-297).
- `components/runs/list/SwimLaneCommandComponent.tsx` (step card), `components/runs/utils.ts:28-41`
  (run status), `types/run.ts` (`RunStatus`).
- `components/runs/status/QueueStatuscomponent.tsx`: `getAll` poll (:39), confirmation modal (:51, :93).

</code_context>

<specifics>
## Specific Ideas

- The live F3 report ("nothing on screen") is likely INVALID_ARGUMENTS/NOT_READY text being dropped, or a
  previously dismissed banner; ERR-01's test is meant to show which, so the fixes are checked against it.
- Verify with `cd controller && npm run test:unit` (244 tests green at HEAD) and `tsc --noEmit`.

</specifics>

<deferred>
## Deferred Ideas

- ACK-AND-F3 §4.4 item 5: "Send to Tool" (step menu) success/failure toast — not mapped to a requirement.
- §4.4 item 6: persistent tool-page command error toast — not mapped (Phase 4 may touch the tool page).
- §4.4 item 7: Gantt FAILED bar styling — not mapped.
- `startNext` skipping STARTED rows (F5 option 2) — already in Future Requirements.
- `GlobalQueueStatusIndicator` shows only "Run Error" off the run page — not mapped; candidate quick task.

### Reviewed Todos (not folded)
- "Evaluate whether expected_tray_id is still needed" — keyword match only (score 0.9); F.A.S.T. step
  parameters, unrelated to queue start or error display. Stays in Future Requirements.
- "Fetch F.A.S.T. plate list for source/dest plate dropdowns" — keyword match only (score 0.9); a form
  feature, unrelated. Stays in Future Requirements.

</deferred>

---

*Phase: 03-queue-start-guard-tool-error-visibility*
*Context gathered: 2026-10-28*
