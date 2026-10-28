# Phase 3: Queue Start Guard & Tool Error Visibility - Pattern Map

**Mapped:** 2026-10-28
**Files analyzed:** 22 (9 new source/helper, 8 modified source, 5+ test files)
**Analogs found:** 22 / 22 (all paths under `controller/`, verified git-tracked)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `server/command_queue.ts` (guard, start log, `_recordFailure`, `_failureSeq`) | service | event-driven | itself, `_start` :875-908 | exact (in place) |
| `server/utils/SqliteQueue.ts` (optional sync read method) | model | CRUD | `getPaginated` in same file (:360-393) | exact |
| `server/toolReply.ts` (new, pure `describeToolReply`) | utility | transform | switch in `server/tools.ts:600-634` | exact (extract) |
| `server/tools.ts` (use helper, `codeString`, SUCCESS+msg code) | service | request-response | itself :600-646, :751-772 | exact |
| `server/routers/command_queue.ts` (`getError` plain object + seq) | route | request-response | itself :17-53 | exact |
| `components/runs/queueError.ts` (new: `shouldShowErrorBanner`, `describeQueueError`, `stepErrorText`) | utility | transform | `components/runs/pausePrompt.ts` | role-match |
| `components/runs/queuedStartSummary.ts` (new) | utility | transform | `components/runs/pausePrompt.ts` (`formatPauseReason`, :160-175) | role-match |
| `components/runs/runOutcome.ts` (new) | utility | transform | `components/runs/utils.ts:29-46` | exact (extract) |
| `components/runs/utils.ts` | utility | transform | itself | exact |
| `components/runs/RunsComponent.tsx` | component | request-response (poll) | itself (:76, :162, :227-297, :324) | exact |
| `components/runs/list/SwimLaneCommandComponent.tsx` | component | request-response | itself | exact |
| `components/runs/status/QueueStatuscomponent.tsx` | component | request-response (poll) | itself :39, :85-106 | exact |
| `test/errorPath.test.ts` (new, red first) | test | request-response | `test/toolControl.test.ts` + `test/helpers/fakeTool.ts` | role-match |
| `test/queueStartGuard.test.ts` (new) | test | event-driven | `test/toolControl.test.ts` | role-match |
| `test/queueError.test.ts`, `queuedStartSummary.test.ts`, `runOutcome.test.ts` (new) | test | transform | `test/pausePrompt.test.ts` | exact |
| `test/staticScan.test.ts` (new `it` blocks only) | test | file-I/O | itself | exact |

## Pattern Assignments

### Pure-logic helpers: `queueError.ts`, `queuedStartSummary.ts`, `runOutcome.ts` (utility, transform)

**Analog:** `components/runs/pausePrompt.ts` (284 lines)

**Header and import convention** (lines 1-6): comment declaring "no React import, no .tsx import"; `import type` only; local `./` relative imports for siblings, `@/server/...` alias for types.
```typescript
// Pure, React-free pause-episode reducer and pause formatters (D-24: no
// React import, no .tsx import). ...
import type { PauseState, RunStateEnvelope } from "@/server/runState";
import { formatClock } from "./controlDecision";
```

**Defensive narrowing helper** (lines 182-192) - copy for `stepErrorText` tolerating non-Error values:
```typescript
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function prettyJson(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
```

**"Never return empty" rule** (lines 216-254, `describePauseDetail`): every branch returns something non-empty, falls back to pretty JSON. Mirror this in `describeQueueError` (message never "", code never "SUCCESS").

**Formatter style** (lines 160-175, `formatPauseReason`): plain if-chain returning `string | null`; model for `stepErrorText` and the summary copy builder.

**Referential-equality idiom** (lines 77-82): unchanged results return the identical state object so effects do not loop; relevant only if a reducer is used for dismissal. `dismissedSeq` comparison is simpler (plain predicate).

**Test analog:** `test/pausePrompt.test.ts` lines 1-17 (vitest import, `@/components/runs/...` alias imports, local `makeEnvelope(overrides)` factory with spread overrides, lines 25-38). Copy the factory style for `makeRow(overrides)`.

---

### `server/toolReply.ts` + `server/tools.ts` (service, request-response)

**Analog:** `server/tools.ts:600-646` (extract, do not rewrite wording)

**Current switch to extract** (lines 600-626): keep ERROR_FROM_TOOL wording verbatim, append ` Tool said: <msg>` (when `trim().length > 0`) to the four generic branches:
```typescript
case tool_base.ResponseCode.UNRECOGNIZED_COMMAND:
  userFriendlyErrorMessage = `The command "${command.command}" is not recognized by the tool "${command.toolId}". Please verify that this command is supported by this tool or page view.`;
...
case tool_base.ResponseCode.ERROR_FROM_TOOL:
  userFriendlyErrorMessage = reply.error_message
    ? `Error from tool "${command.toolId}": ${reply.error_message}`
    : `An error occurred while executing the command "${command.command}" on tool "${command.toolId}".`;
  break;
default:
  userFriendlyErrorMessage = reply.error_message || `Failed to execute command "${command.command}" on tool "${command.toolId}"`;
```
**Logging stays in `tools.ts`** (lines 628-634): `logAction({ level: "error", action: "Tool Command Execution Error", details: \`...Error: ${msg} (Code: ${reply.response})\` })` then `throw new ToolCommandExecutionError(msg, code)`.

**SUCCESS-with-message branch** (lines 637-646): change the thrown code to `ResponseCode.ERROR_FROM_TOOL` (D-14); clean SUCCESS `return reply` path (:635-636) untouched.

**Class fix** (lines 751-772): replace `getResponseCodeString` body with `String(code)`; the `typeof value === "number"` filter always yields `UNKNOWN` because `ResponseCode` is a string enum.

---

### `server/routers/command_queue.ts` `getError` (route, request-response)

**Analog:** itself, lines 17-53.
- Delete the generic overwrite block (:27-38); return `userFriendlyMessage: error.message`.
- Existing return shape to keep (:40-47): `{ message, userFriendlyMessage, code, codeString: error.code.toString(), name, stack }` plus `seq: CommandQueue.global.failureSeq`.
- Non-TCE branch (:52 `return error;`) must become a plain object `{ message, userFriendlyMessage: message, name, stack, seq }`, including `code` when `typeof error.code` is number/string (client renders gRPC numeric `Code <n>`).
- Existing access idiom: `CommandQueue.global.getError()`; `getError()` itself keeps returning `this.error || null` (`command_queue.ts:410-412`; tests assert `queue.error?.message`).

---

### `server/command_queue.ts` (service, event-driven)

**Analog:** itself. `_start` today (lines 875-908):
```typescript
async _start() {
  // A restart supersedes any pending stale abort reply (T-01-08).
  this._failedAttempt = undefined;
  logAction({ level: "info", action: "Queue Started", details: "Command Queue started by user." });
  this._setState(ToolStatus.READY);
  this.error = undefined;
  try {
    if (!this._interruptedStepsRecovered) this._recoverInterruptedSteps();
    this._runningPromise = this._runBusyLoopWhileQueueNotEmpty(120);
    await this._runningPromise;
  } catch (e) {
    logAction({ level: "error", action: "Queue failed to start", details: "Error while starting the queue.: " + e });
    this.error = e instanceof Error ? e : new Error("Execution failed");   // :899 -> _recordFailure
    this._setState(ToolStatus.FAILED);
    await this._notifyFailure({ error: this.error });
  } finally {
    this._runningPromise = undefined;
    if (this.state === ToolStatus.BUSY) this._setState(ToolStatus.READY);
  }
}
```
Plan: insert guard as the first statement (see RESEARCH.md "Code Examples"); keep NO `await` between the guard and the `_runningPromise =` assignment (sync read for the log listing). `logAction` object shape `{ level, action, details }` is used throughout (levels seen: `info`, `warning`, `error`). Other `this.error` set sites to route through one `_recordFailure(err)`: `:157` and `:1382`; clears (`:815-817, :849, :865, :884`) do not bump seq.

---

### `server/utils/SqliteQueue.ts` sync read method (model, CRUD)
**Analog:** `getPaginated` (:360-393, joins `_queue`, ordered by `position`) - reuse its SQL, drop `async`. Read-only; do not touch `startNext/complete/fail*/recover*` (D-09).

---

### `components/runs/utils.ts` / `runOutcome.ts` (utility, transform)
**Analog:** `components/runs/utils.ts:29-46` (decision order: COMPLETED branch :29-31, FAILED :32-33, SKIPPED-last :39-46). `deriveRunOutcome` reproduces that order with the new rule evaluated before both COMPLETED branches. Do not widen `RunStatus` (`types/run.ts:3`).

---

### `QueueStatuscomponent.tsx` modal summary (component)

**Analog:** itself.
- Poll idiom (line 39): `trpc.commandQueue.getAll.useQuery(undefined, { refetchInterval: 1000 })`. Keep it (used for `hasCommandsToClear`). Add a second query per RESEARCH Pitfall 2: `trpc.commandQueue.commands.useQuery({}, { refetchInterval: 1000 })` for `summarizeQueuedStart`.
- Modal body to extend (lines 85-106): add read-only `<Text>` lines under the existing `<Text>Make sure instruments...</Text>`; footer buttons (`Accept` with `colorScheme="teal"`, `Cancel` ghost) unchanged.
- Constraints: no `setTimeout/setInterval`, no `StopRunModal`, no `<form|autoFocus|defaultValue|defaultChecked`.

---

### `test/errorPath.test.ts` and `test/queueStartGuard.test.ts` (test, request-response / event-driven)

**Analog:** `test/toolControl.test.ts` (lines 1-47 harness) and `test/helpers/fakeTool.ts`.

**Harness to copy** (toolControl.test.ts 1-47):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { logAction } from "@/server/logger";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";

beforeEach(() => {
  queue = new CommandQueue({} as any);
  queue.slackNotificationsEnabled = false;
  (globalThis as any)["__global_command_queue_key"] = queue;   // needed for createCaller({}).getError()
  const fake = installFakeTool("fast-1", ToolType.fast);
  grpc = fake.grpc;
  grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });
  ...
});
afterEach(async () => {
  ...
  await removeFakeTool("fast-1");
  delete (globalThis as any)["__global_command_queue_key"];
  vi.restoreAllMocks();
});
```
**Row push shape** (lines 50-59): `await queue.commands.push({ runId, status: "CREATED", commandInfo: { toolId: "fast-1", toolType: ToolType.fast, command: "transfer", params: {} } } as any)`.
**Router call** (line 69): `commandQueueRouter.createCaller({})`.
**In-flight stub** (toolControl 27-28): `deferred<any>()` + `vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise)` - use for recipe D (single flight, call count 1).
**For errorPath (NOT the spy)**: do not spy `Tool.executeCommand`; use `grpc.executeCommand.mockResolvedValueOnce({ response, error_message, return_reply: true })` so the real reply switch runs.
**Speed:** per RESEARCH, `vi.useFakeTimers({ toFake: ["setTimeout"] })` + `await vi.advanceTimersByTimeAsync(1500)`; always `vi.useRealTimers()` in `afterEach`. Logs: `logAction` is a `vi.fn` via `test/setup.ts`; assert with `expect(logAction).toHaveBeenCalledWith(expect.objectContaining({ action, level }))`.
**Exhaustiveness:** `Record<ResponseCode, Case>` + `expect(Object.keys(EXPECT).sort()).toEqual(Object.values(ResponseCode).sort())`.
**Protected tests (do not edit):** retry/h0q/o44/t9e in `toolControl.test.ts`, `sqliteQueue.test.ts`, `queueRestart.test.ts` (line list in RESEARCH "Re-verified Line References").

---

### `test/staticScan.test.ts` new `it` blocks (test, file-I/O)

**Analog:** itself.

**Helpers available** (no import needed, file-local): `read(rel)` (:43), `rel(file)` (:48), `stripComments(src)` (:56), `extractBracedRegion(src, declPattern)` (:118), `walk(dir)` (:16).

**Idiom to copy** (lines 287-292 and 358-362):
```typescript
it("no timers in the control UI", () => {
  const timerPattern = /\b(?:window\.|globalThis\.)?set(?:Timeout|Interval)\(/;
  for (const file of controlUiModules) {
    expect(stripComments(read(file))).not.toMatch(timerPattern);
  }
});
it("no Enter-bound default or preselected decision", () => {
  const pattern = /<form|autoFocus|defaultValue|defaultChecked/;
  expect(stripComments(read("components/runs/RunControlConfirmModal.tsx"))).not.toMatch(pattern);
});
```
New cases go in a new `describe` (or alongside "safety invariants", :271): (1) `QueueStatuscomponent.tsx` no-form/autoFocus pattern still holds and it references `summarizeQueuedStart`; (2) `_start` body ordering via `extractBracedRegion(stripComments(read("server/command_queue.ts")), /async _start\(/)`: `this._runningPromise` index precedes `_failedAttempt = undefined`, `"Queue Started"`, `this.error = undefined`, `_setState(`; no `await` before first `this._runningPromise =`; (3) `this.error = ` with non-`undefined` RHS appears exactly once in `server/command_queue.ts`; (4) `RunsComponent.tsx` has no `isErrorVisible`, references `dismissedSeq`/`shouldShowErrorBanner`; (5) check icon `COMPLETED`-only; `runOutcome.ts` never maps skipped-failure to green/teal. Note: `QueueStatuscomponent.tsx` is already in the "no `StopRunModal`" list (:294-306); do not mention that name.

## Shared Patterns

### Audit logging
**Source:** `server/command_queue.ts:878-882, 894-898`, `server/tools.ts:628-634`
**Apply to:** guard ("Queue Start Ignored", level `warning`), Start log listing, `_recordFailure`
```typescript
logAction({ level: "warning", action: "Queue Start Ignored", details: "..." });
```

### Pure-logic + static-scan UI testing (UI-08, no jsdom)
**Source:** `components/runs/pausePrompt.ts`, `test/pausePrompt.test.ts`, `test/staticScan.test.ts`
**Apply to:** every new client behaviour: helper module (type-only imports) + direct unit test + scan that the component wires it.

### String-enum handling
`ResponseCode` is a string enum (`gen-interfaces/tools/grpc_interfaces/tool_base`); compare/print with `String(code)`, iterate `Object.values(ResponseCode)` (9 values incl. `UNRECOGNIZED`).

### Stored error is a plain `Error` after SQLite round trip
`row.error` has only `name`+`message`, no `.code`; type `unknown` (`types/run.ts:20`). Render only for FAILED (and SKIPPED-with-error) rows.

### Verification
`cd controller && export PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH && npx vitest run test/<file>.test.ts`, full `npm run test:unit`, `npx tsc --noEmit`. Prettier: printWidth 100, 2 spaces.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (none) | | | Every file has an in-place or role-level analog. Closest to "none": the `dismissedSeq` banner predicate has no existing equivalent; use RESEARCH.md `shouldShowErrorBanner(queueState, error, dismissedSeq)` shape with pausePrompt.ts style. |

## Metadata

**Analog search scope:** `controller/components/runs`, `controller/server`, `controller/test`, `controller/test/helpers`
**Files read:** pausePrompt.ts, pausePrompt.test.ts (head), fakeTool.ts, toolControl.test.ts (head), staticScan.test.ts (helpers + scans), command_queue.ts `_start`, tools.ts reply switch and error class, routers/command_queue.ts `getError`, QueueStatuscomponent.tsx (poll + modal)
**Tracked-source check:** `git ls-files` confirmed `components/runs/pausePrompt.ts` and `test/helpers/fakeTool.ts` tracked; all other paths are standard tracked source (no `.gsd` mirrors used).
**Pattern extraction date:** 2026-10-28
