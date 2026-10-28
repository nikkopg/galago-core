# Research Summary — milestone v2 (STACK tool support)

**Researched:** 2026-10-28
**Mode:** Targeted (no 4-researcher pass; F.A.S.T. support `128bbd7`, `d4c3c23`, `tool.recoveryControl` is the template)
**Details:** `F5-ROOT-CAUSE.md`, `ACK-AND-F3.md`. Cross-repo: galago-tools `.planning/research/SUMMARY.md`.

No finding needs a `stack.proto` change or a stack-automation-layer change.

## F5 (DEP-03c)

- **The premise is wrong. [V, HIGH]** Run 1 did not execute one row three times. The recorded dev
  DBs (`controller/data/queue.db`, `app.db`) show three different rows:
  - stale FAILED row 4 (2026-10-08), retried
  - leftover CREATED row 5 from an earlier run
  - the new row 6

  There was one Queue Start and nothing overlapped. This is retry-after-failure plus a global FIFO
  that persists across runs, working as designed.
- **The dev-mode re-instantiation hypothesis is ruled out:** the singleton lives on `globalThis`
  (`command_queue.ts:1436-1444`), and `complete` deletes the row.
- **A real latent defect exists at HEAD:** `_start()` (`command_queue.ts:875-908`) has no
  re-entrancy guard, and `startNext` (`SqliteQueue.ts:116-124`) ignores status. A second start while
  a step is in flight dispatches the **same** row again (reproduced with FakeGrpc).
  - Entry points: the `restart` mutation, and `enqueueRun` when the queue is READY.
  - Likely route [I]: Pause queue, then Run, mid-step.
- **Fixes:**
  - single-flight `_start()`;
  - optionally, `startNext` skips STARTED rows;
  - the Run confirmation shows what a Start will run: row count, FAILED retries and distinct runs
    (read-only, no default, no timer).

  Retry-after-failure stays unchanged. h0q, o44 and t9e do not cover any of this.
- **Second route to "re-run after success":** `tools.ts:635-646` throws on SUCCESS with a non-empty
  `error_message`, so the row stays FAILED and re-runs on the next Start. The STACK adapter must
  send an empty message on SUCCESS (galago-tools STK-07 already requires this).

## F3 (DEP-03b)

- `ERROR_FROM_TOOL` text reaches only the run-page banner, and only while the queue is FAILED and
  the banner has not been dismissed. It also appears in Logs and Slack/email.
- **Loss points:**
  - Non-ERROR_FROM_TOOL codes replace the tool text (`tools.ts:604-615`, `getError`
    `routers/command_queue.ts:27-38`).
  - `isErrorVisible` is never re-armed after a dismiss (`RunsComponent.tsx:76, 290`).
  - The per-step error is never rendered on the step card.
  - "Send to Tool" shows no outcome.
  - `codeString` is always "UNKNOWN" (`tools.ts:765-769`).
  - The tool-page toast lasts 10 s.
  - Skipping a failed step makes the run look COMPLETED (`utils.ts:34-41`).
- No path maps a non-SUCCESS reply to success. The live "nothing on screen" report is unexplained
  by reading alone, so the phase starts with a failing test that drives each response code through
  the queue.

## STACK AcknowledgeFailure (DEP-03a)

- **Do not add `stack` to `runControl`.** It would start the 2 s run-state poller, show dead
  Pause/Resume/Abort buttons, route Stop/Clear All through an abort-first modal with no STACK
  abort, and make `toolControl("acknowledge_failure")` valid mid-step.
- **Instead:**
  - a zero-import `server/recoveryActions.ts` keyed by tool type, with kinds `yesno`, `confirmYes`
    (exactly "yes") and `guid` (rejected if blank, never trimmed);
  - `recoveryControl` uses that map;
  - a `params` map on `ConfirmedControlRequest`;
  - ack-specific copy (not "head will move");
  - guid entry in the Run Recovery card, restated in the confirm modal.
- **Queue refusal** comes from one zero-import table (`server/operatorOnlyCommands.ts`), checked
  in two places:
  - at enqueue, in `RunStore.createFromProtocol` (`runs.ts:216`);
  - at execute, at the top of `Tool.executeCommand` (`tools.ts:408`), keyed on the tool's real
    type. This leaves `controlCommand` untouched.

  The refusal error must survive `getError` and `routers/run.ts:89-93`.
- **Latched guid display:**
  - the step's error on its card;
  - an explicit "Read latch" button in the STACK recovery card, using a `toolId`-only
    `tool.latchStatus` query (no polling);
  - "Use this guid" fills the input and never sends.
- **Buildable before `stack.proto`:** use string tool types, `"stack" as ToolType` fakes, a
  `String(this.toolType)` guard and the toolId-only query. Only the wire test,
  `getToolConfigDefinition` and `commandFields.stack` wait for DEP-02.
- **No auth in galago-web:** "operator-only" means unreachable from any protocol, script, queue row
  or editor, plus the core's exact-guid check. The audit log can't record who acted.

## DEP-02

Mechanical, per `128bbd7`. It is blocked on galago-tools Phase 4 pushing the frozen `stack.proto`
to `feat/stack-tool` (not there yet). Carry in the activation tests from ACK-AND-F3 §5.3.

## Build order

F5 → F3 → acknowledge + queue refusal → DEP-02.
