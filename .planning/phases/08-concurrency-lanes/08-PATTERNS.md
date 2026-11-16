# Phase 8: Concurrency Lanes - Pattern Map

**Mapped:** 2026-11-16
**Files analyzed:** 27 (11 new, 16 modified) plus tests
**Analogs found:** 27 / 27 (all analogs are git-tracked under `controller/`; paths below are relative to `/home/formulatrix/data/nikko/galago-core/controller/`)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `server/laneScheduling.ts` (NEW) | utility (pure policy) | transform | `server/runControl.ts` + `server/toolKey.ts` | exact |
| `server/utils/SqliteQueue.ts` (+`claimEligible`) | model/store | CRUD (sync txn) | same file `startNext` (112-148), `complete` (471-482) | exact |
| `server/command_queue.ts` (seams: `_laneMode`, `_startLanes`, `_pickNext`, `_runSideLane`, latch, per-queueId markers) | service | event-driven / batch loop | same file `_start` (914-960), `_runBusyLoopWhileQueueNotEmpty` (~998-1010, 1352-1392) | exact (self) |
| `server/runState.ts` (+`stopIf`) | service | polling | same file `stop()` (158-166) | exact (self) |
| `server/runs.ts` (`validateLanes` call, rethrow list) | service | request-response | same file operator-only scan (223-240) and rethrow (270-280) | exact (self) |
| `server/operatorOnlyCommands.ts` pattern -> `LaneValidationError` in `laneScheduling.ts` | utility | transform | `server/operatorOnlyCommands.ts` 46-59 | exact |
| `server/routers/run.ts`, `pages/api/runs/index.ts` (map lane error) | route | request-response | `server/routers/run.ts` 94-99 | exact |
| `server/routers/command_queue.ts` (+`freezeLanes`, `laneStatus`) | route | request-response | same file `restart`/`stop`/`getError` (35-51) | exact |
| `server/routers/protocol.ts` (`laneWarnings` in `preview`) | route | request-response | same file `preview` | role-match |
| `server/queueStartListing.ts` (optional lane listing) | utility | transform | same file (1-58) | exact (self) |
| `server/scripting/protocol-script-executor.ts` (`galago.lane`, options) | service | transform | same file `galago.command` (22-37) | exact (self) |
| `types/run.ts` (`AdvancedParameters`) | model/type | n/a | RESEARCH "AdvancedParameters (additive)" | exact |
| `components/runs/utils.ts` (+`groupRowsByLane`, lane-aware `getRunAttributes`) | utility | transform | same file `groupCommandsByRun` (50-65) | exact |
| `components/runs/runOutcome.ts` (lane-aware branch) | utility | transform | same file `deriveRunOutcome` (30-56) | exact (self) |
| `components/runs/queuedStartSummary.ts` (lane lines) | utility | transform | same file (`QueuedStartLine`, 22-26) | exact (self) |
| `components/runs/laneStatus.ts` (NEW) | utility (pure) | transform | `components/runs/runOutcome.ts` / `queuedStartSummary.ts` | role-match |
| `components/runs/LanesPanel.tsx` (NEW) | component | request-response + poll | `components/runs/ControlBar.tsx` (Card shell, no modal plumbing) | role-match |
| `hooks/useLaneStatus.ts` (NEW) | hook | polling | `hooks/useRunControl.ts` `useRunControlState` (16-21) | exact |
| `components/runs/list/SwimLaneComponent.tsx` (lane rows) | component | transform/render | same file (57 lines) | exact (self) |
| `components/runs/RunsComponent.tsx` (mount panel, banner list) | component | request-response | same file ErrorBanner (228-279) | exact (self) |
| `components/protocols/laneFields.ts` (NEW) | utility (pure) | transform | `controller/test` + `commandFields` pure helpers (Phase 6/7) | role-match |
| `components/protocols/CommandDetailsDrawer.tsx` (Lane + barrier) | component | CRUD (local state) | same file `handleRunAsyncChange` (180-187) + Run Asynchronously row (783-791) | exact (self) |
| `components/protocols/ProtocolDetailView.tsx` (lane summary, `laneWarnings`) | component | render | same file Generated Commands box | role-match |
| `docker-compose.yml`, `docker-compose.dev.yml` | config | n/a | existing `environment:` blocks | exact |
| `test/laneScheduling.test.ts`, `test/laneGolden.test.ts`, `test/laneHalt.test.ts`, etc. (NEW) | test | pure + fakes | `test/queueStartGuard.test.ts`, `test/runOutcome.test.ts`, `test/helpers/fakeTool.ts` | exact |
| `test/staticScan.test.ts` (append `describe`) | test | static scan | lines 873+ existing describes (helpers `walk`, `stripComments`, `read`, `rel`) | exact |

## Pattern Assignments

### `server/laneScheduling.ts` (utility, transform)

**Analog:** `server/runControl.ts` (header "No imports" + deepFreeze + pure verdict unions) and `server/toolKey.ts`.

**Header/imports pattern** (`runControl.ts` 1-4, `toolKey.ts` 11-14): file has zero imports; a comment states why it is safe on the client. If a tool-key transform is needed inside the module, either inline the one-liner or import it as a VALUE from `./toolKey` (that file is itself import-free and documented as client-safe):
```typescript
// No imports. This module has one job: ...
export function normalizeToolKey(s: string | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
```

**Verdict union pattern** (`runControl.ts` 14-16):
```typescript
export type ControlRequestVerdict =
  | { ok: true; decisions: Record<string, ControlDecisionValue> }
  | { ok: false; code: "PRECONDITION_FAILED" | "BAD_REQUEST"; message: string };
```
Use for `pickEligible` -> `{kind:"empty"} | {kind:"wait"} | {kind:"pick", row}`.

**Error class + name guard (copy exactly)** from `server/operatorOnlyCommands.ts` 46-59:
```typescript
export class OperatorOnlyCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperatorOnlyCommandError";
  }
}
export function isOperatorOnlyCommandError(e: unknown): e is OperatorOnlyCommandError {
  return e instanceof Error && e.name === "OperatorOnlyCommandError";
}
```
Create `LaneValidationError` / `isLaneValidationError` the same way. Message text for each refusal is fixed by UI-SPEC S2c (seven sentences) -- copy verbatim.

---

### `server/utils/SqliteQueue.ts` (+ `claimEligible`) (model, CRUD)

**Analog:** same file `startNext` (112-148) for the transaction + `_updateItem` + `find` idiom; `queuedRowsSync()` (398-410) for the synchronous read the picker uses.

**Core pattern** (`startNext`, 112-148):
```typescript
async startNext(): Promise<StoredRunCommand | false> {
  const db = this.db;
  let command: StoredRunCommand | false = false;
  db.transaction(() => {
    const queueItem = db.prepare(`SELECT queue_id FROM ${this.queueName}_queue ORDER BY position ASC LIMIT 1`).get() as { queue_id: number } | undefined;
    if (!queueItem) return;
    const item = this.find(queueItem.queue_id);
    ...
    this._updateItem(queueItem.queue_id, { status: "STARTED" });
    command = this.find(queueItem.queue_id);
  })();
  return command;
}
```
Copy the shape; make `claimEligible(queueId)` a NON-async method (RESEARCH "Code Examples" has the full body). `startNext` stays byte-identical (it does not filter STARTED; do not touch it).

---

### `server/command_queue.ts` (service, event-driven loop) -- seams only

**Analog:** itself (`controller/server/command_queue.ts`). Line numbers verified at HEAD.

**Single-flight guard to preserve and mirror per lane** (914-947):
```typescript
async _start(source: QueueStartSource = "operator") {
  if (this._runningPromise) {
    logAction({ level: "warning", action: "Queue Start Ignored", details: `... source=${source} inFlightQueueId=${this._runningStep?.queueId ?? "unknown"} ...` });
    return;
  }
  this._failedAttempt = undefined;
  logAction({ level: "info", action: "Queue Started", details: this._describeQueueStart(source) });
  this._setState(ToolStatus.READY);
  this.error = undefined;
  try { ... this._runningPromise = this._runBusyLoopWhileQueueNotEmpty(120); await this._runningPromise; }
  catch (e) { ... this._recordFailure(failure); this._setState(ToolStatus.FAILED); void this._notifyFailure({ error: failure }); }
  finally { this._runningPromise = undefined; if (this.state === ToolStatus.BUSY) this._setState(ToolStatus.READY); }
```
Seam: first line becomes `if (this._laneMode) return this._startLanes(source);`. Lane Start reuses `_describeQueueStart(source)` and `_recoverInterruptedSteps()`.

**Pickup seam** (loop ~998-1003): replace
`await new Promise((resolve) => setTimeout(resolve, 1500)); const nextCommand = await this.commands.startNext();`
with `this._loopDelayMs` and `await this._pickNext("primary")` + `WAIT` check (RESEARCH "`_pickNext`" snippet).

**Latch-before-await idiom to copy** (catch, 1374-1390):
```typescript
const abortAccepted = this._abortAcceptedQueueId === nextCommand.queueId;
this._abortAcceptedQueueId = undefined;
// Synchronously, before the first await: ...
this._failedAttempt = abortAccepted ? undefined : attempt;
```
Put `if (this._laneMode) this._latchFailure(...)` as the FIRST statement of the catch (before `logger.error`). Convert `_abortAcceptedQueueId` and `_failedAttempt` to per-queueId in lane mode only.

**Monitor bracket** (1360/1364): `this._runStateMonitor.start(this._runningStep)` ... `finally { this._runStateMonitor.stop(); this._runningStep = undefined; }` -> lane mode `stopIf(queueId)`; flag off literal.

**Constructor env read precedent** (line 111): `const dbPath = process.env.SQLITE_DB_PATH || ...`; add `_laneMode = options?.parallelLanes ?? process.env.GALAGO_PARALLEL_LANES === "1"`.

**Constraints (static pins):** exactly one `.controlCommand(`; `toolControl` body must not match `.status`; `await this._notifyFailure(` forbidden; exactly one non-undefined `this.error =` (so list logic lives inside `_recordFailure`); `_runSideLane` body must not mention `_isWaitingForInput|_messageResolve|_currentMessage|_timerTimeout` (the modal read lives in `_dispatchGate()`).

---

### `server/runState.ts` (+ `stopIf(queueId)`) (service)

**Analog:** same file `stop()` (158-166):
```typescript
stop(): void {
  if (this.intervalHandle) { clearInterval(this.intervalHandle); this.intervalHandle = undefined; }
  this.generation += 1;
  this.inFlight = false;
  this.envelope = { running: false };
}
```
`stopIf(queueId)`: `if (this.envelope.running && this.envelope.queueId === queueId) this.stop();`. `start()` already calls `stop()` first (126-127) and returns early when `getRunControl(step.toolType) === undefined` (130-132); in lane mode only call `start` for controllable steps so a non-controllable step never replaces the poller.

---

### `server/runs.ts` (+ `validateLanes`) (service, request-response)

**Analog:** same file operator-only scan 223-240 and rethrow list 270-280.

**Core pattern** (insert after the scan, before "Create run ID"):
```typescript
for (let i = 0; i < commands.length; i++) { ... throw new OperatorOnlyCommandError(`Step ${i} sends ...`); }
```
Add: if lane mode on, `const laneErr = validateLanes(commands); if (laneErr) { await logAction({level:"warning", action:"Lane Setup Refused", ...}); throw new LaneValidationError(laneErr); }`. Flag off: log once "lane tags ignored: parallel lanes disabled" when tags present (D-08), no validation.

**Rethrow list** (270-280): add `|| isLaneValidationError(error)` (name guard, not `instanceof`; pinned by `runCreateReload.test.ts` "run.create source pin" -- extend that pin).

**Router mapping** (`server/routers/run.ts` 94-99), copy for `pages/api/runs/index.ts` and `routers/run.ts`:
```typescript
if (isOperatorOnlyCommandError(e)) {
  throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
}
```

---

### `server/routers/command_queue.ts` (+ `freezeLanes`, `laneStatus`) (route, request-response)

**Analog:** same file 35-51 (`restart`, `stop`, `getError`).
```typescript
restart: procedure.mutation(() => {
  const queue = CommandQueue.global;
  const accepted = !queue.isStartInProgress;   // keep text; pinned staticScan:578
  queue._start();
  return { accepted };
}),
stop: procedure.mutation(() => { CommandQueue.global.stop(); }),
getError: procedure.query(async () => {
  const queue = CommandQueue.global;
  const error = queue.getError();
  if (!error) return null;
  return queueErrorPayload(error, queue.failureSeq);
}),
```
`freezeLanes: procedure.mutation(() => { CommandQueue.global.freezeLanes(); })` (throw a `TRPCError` when lane mode is off -- UI-SPEC maps to "Freeze failed" toast). `laneStatus: procedure.query(() => CommandQueue.global.laneStatus())` returning `{laneMode, hasLaneRows, halted, haltReason, queueBusy, runningLanes, failures, overflow}`; messages only, never a stack (mirror `queueErrorPayload`). Do NOT change `getError` payload.

---

### `server/queueStartListing.ts` / `components/runs/queuedStartSummary.ts` (utility, transform)

**Analog:** themselves. Both are pure, import-free; untagged output must stay byte-identical (`queueStartGuard.test.ts` and `queuedStartSummary.test.ts` assert exact strings).

`queueStartListing.ts`: `QueueStartRow {queueId, runId, status}` -> add optional `lane?`, `toolId?`, `command?`, `barrier?`; only append lane text when any row has a non-primary lane. `queuedStartSummary.ts`: `QueuedStartLine { text; tone: "body" | "caption" }` -> append lines per UI-SPEC S3 after the count lines, before `QUEUED_START_NOTE`.

---

### `server/scripting/protocol-script-executor.ts` (service, transform)

**Analog:** same file 22-37.
```typescript
const galago = {
  command(toolId: string, command: string, cmdParams: Record<string, any> = {}) {
    commands.push({
      toolId, toolType: "unknown" as any, command, params: cmdParams, label: "",
      advancedParameters: { skipExecutionVariable: { variable: null, value: "" }, runAsynchronously: false },
    });
  },
  timer(...) { this.command("Tool Box", "timer", {...}); },
```
Add a closure `let currentLane: string | undefined`, `lane(name)` setter (normalizeLane), and 4th param `opts?: {lane?, barrier?}`. Write `lane`/`laneBarrier` keys only when set (never `undefined`/`false`, Pitfall 24b). Trap: `timer`/`pause` call `this.command("Tool Box", ...)`, so they would inherit `currentLane`; Tool Box rows must not receive the lane tag.

---

### `components/runs/utils.ts` (+ `groupRowsByLane`) and `runOutcome.ts`

**Analog:** `utils.ts` `groupCommandsByRun` (50-65) for the pure grouping idiom:
```typescript
export function groupCommandsByRun(commands: RunCommand[]): GroupedCommand[] {
  const groupedCommands: GroupedCommand[] = [];
  const runIds: string[] = [];
  commands.forEach((command) => { if (!runIds.includes(command.runId)) { runIds.push(command.runId); groupedCommands.push({...}); } ... });
```
`groupRowsByLane(rows)` -> ordered `{lane, rows}[]` by first appearance, `undefined`/`primary` = `"primary"`; return `null`/single group when no non-primary lane so callers keep legacy DOM.

`runOutcome.ts` `deriveRunOutcome` (30-56) uses `statusOf`/`errorOf` guards on `unknown`; add an early lane-aware branch ONLY when some row has a non-primary lane (read `row.commandInfo.advancedParameters.lane` defensively, same `typeof === "object"` style). Existing ordering (FAILED first, skipped-failure, `last === "COMPLETED"`) stays for untagged. `getRunAttributes` (`utils.ts` 24-33): in lane runs take max `completedAt` over COMPLETED rows instead of `lastCommand.completedAt`.

---

### `components/runs/list/SwimLaneComponent.tsx` (component, render)

**Analog:** itself (57 lines). Keep imports and the legacy `HStack spacing={0} width="900px"` branch byte-identical; add the lane branch only when `groupRowsByLane` reports a non-primary lane. Do NOT edit `SwimLaneCommandComponent`; wrap each card in `Box flexShrink={0}` with the caption below (UI-SPEC S4). Reuse `useDisclosure`/`CommandDetailsDrawer` single instance as-is.

---

### `hooks/useLaneStatus.ts` (hook, polling)

**Analog:** `hooks/useRunControl.ts` 16-21:
```typescript
export function useRunControlState() {
  return trpc.commandQueue.runState.useQuery(undefined, { refetchInterval: RUN_CONTROL_POLL_MS });
}
```
Copy with `trpc.commandQueue.laneStatus.useQuery(undefined, { refetchInterval: 1500 })`. Must not reference `toolControl|recoveryControl|runState` (pin). The freeze mutation: `trpc.commandQueue.freezeLanes.useMutation()` lives in `LanesPanel.tsx`; toast helpers from `@/components/ui/Toast` (`infoToast`, `errorToast`; `successToast`/`persistentErrorToast` are used in `useRunControl.ts`).

---

### `components/runs/LanesPanel.tsx` (component)

**Analog:** `components/runs/ControlBar.tsx` for the Card shell (`bg useColorModeValue("white","surface.section")`, `shadow="md"`) -- but copy only the shell, never its modal plumbing. Pins: no `setTimeout|setInterval|StopRunModal|autoFocus|defaultValue`, no `toolControl|recoveryControl|runState`. Freeze confirm is a Chakra `AlertDialog` with `leastDestructiveRef` on `Keep lanes running`. Render `null` unless `laneMode && hasLaneRows` and data loaded. Copy strings from UI-SPEC S5 verbatim.

---

### `components/runs/RunsComponent.tsx` (ErrorBanner list, panel mount)

**Analog:** itself, ErrorBanner (228-279) and `getError` useQuery (163). Add `LaneFailureList` as a child below the `maxH="160px"` message Box, rendered only when `laneStatus.failures.length >= 2`. Pins: banner region keeps `maxH="160px"`, `whiteSpace="pre-wrap"`; forbids `noOfLines`, `clearError`, `.restart`, `.mutate(`, `mutateAsync(`; keeps `dismissedSeq`, `shouldShowErrorBanner(`, `describeQueueError(`, `getRunAttributes(runInfo, run.Commands)`, `runProgressColorScheme(runAttributes.status)`, `runOutcomeBadge(runAttributes.status)` textually. Mount `<LanesPanel />` right after `<ControlBar />`.

---

### `components/protocols/CommandDetailsDrawer.tsx` + `laneFields.ts`

**Analog:** drawer `getAdvancedParameters` (146-154), `handleRunAsyncChange` (180-187), and the Run Asynchronously row (783-791):
```tsx
<FormControl display="flex" alignItems="center" mt={4}>
  <FormLabel mb="0">Run Asynchronously</FormLabel>
  <Switch isChecked={advancedParams.runAsynchronously || false}
          onChange={(e) => handleRunAsyncChange(e.target.checked)} isDisabled={!isEditing} />
</FormControl>
```
Add `handleLaneChange`/`handleBarrierChange` using the same `setEditedAdvancedParams({...currentAdvParams, ...})` shape, but via pure `laneFields.ts` helpers (`setLane`, `setBarrier`, `suggestLanes`, `isToolStep`) that DELETE keys on blank/`primary`/false (never write `""`/`false`). Insert after "Value to Match", before the Run Asynchronously row, with a `Divider my={4}`. Leave `runAsynchronously: false` untouched (D-02, pinned). Use native `<datalist id="lane-suggestions">`; `isDisabled={!isEditing}`. Tool Box steps: render nothing.

---

### `components/protocols/ProtocolDetailView.tsx` (lane summary + `laneWarnings`)

**Analog:** its existing "Generated Commands (N)" box (300px max height scroll) and step strip. Compute the visual summary client-side via `laneScheduling.ts` (RESEARCH: `protocol.preview` is script-only). Render `Alert status="warning" variant="left-accent"` for warnings. Absent entirely when no non-primary lane.

---

### `docker-compose.yml`, `docker-compose.dev.yml` (config)

Add `GALAGO_PARALLEL_LANES` (unset/empty, with a comment) to the existing `environment:` block; read the file's current block style before editing (not extracted here).

---

### Tests (NEW) -- `test/laneScheduling.test.ts`, `test/laneGolden.test.ts`, halt/freeze/modal/control tests

**Analog:** `test/queueStartGuard.test.ts` (header comment "Fakes only", imports) and `test/helpers/fakeTool.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { logAction } from "@/server/logger";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";
```
Fake tools via `installFakeTool(toolId, toolType)` (returns `{tool, grpc}` with `grpc.executeCommand` a `vi.fn`); gate ordering on `deferred()` not wall time; construct `new CommandQueue(runStore, { parallelLanes: true, loopDelayMs: 0 })`. Pure tests (`laneScheduling`, `runOutcome` lane cases, `groupRowsByLane`, `laneFields`) follow `test/runOutcome.test.ts` (`cmd(status, error?)` row factory, no jsdom). Golden transcript is captured FIRST at the unmodified commit (D-09), committed before touching `command_queue.ts`. Static pins: append a new `describe(...)` to `test/staticScan.test.ts` after line ~1303 using the file-local helpers `walk`, `stripComments`, `read`, `rel` (not exported, so do not make a new file); re-pin the `_start` scan additively.

## Shared Patterns

### Pure module + thin shell
**Source:** `server/runControl.ts`, `server/toolKey.ts`, `server/queueStartListing.ts`, `components/runs/runOutcome.ts`, `components/runs/queuedStartSummary.ts`
**Apply to:** `laneScheduling.ts`, `laneStatus.ts`, `laneFields.ts`, new `queuedStartSummary` lines. Header comment says "No imports"; no React, no timers, no db.

### Name-guarded errors (never `instanceof`)
**Source:** `server/operatorOnlyCommands.ts` 46-59; used in `server/runs.ts` 270-280 and `server/routers/run.ts` 94-99.
**Apply to:** `LaneValidationError` creation, rethrow, router/API mapping.

### Synchronous check-and-claim; latch before first await
**Source:** `command_queue.ts` 914-947 (guard to claim, no await between), 1374-1390 (marker set before first await), `SqliteQueue.queuedRowsSync` 398 (comment: synchronous so no await sits between guard and claim).
**Apply to:** `_pickNext`, `_startLanes`, `_latchFailure`, `freezeLanes`.

### Only an operator Start re-arms
**Source:** `_start(source)` with `QueueStartSource = "operator" | "enqueue"` (`queueStartListing.ts` 4); `restart` router calls `_start()` default `"operator"`.
**Apply to:** `_startLanes`; `resume()`, `clearError()`, `enqueueRun` auto-start must not clear the latch.

### Flag-off byte-identity
Every new statement sits behind `_laneMode`, `_laneHalt !== undefined`, or "row has a lane tag". Omit optional keys instead of writing `undefined`/`false`/`""`.

### Chakra run-page conventions
**Source:** `components/runs/ControlBar.tsx` Card shell; `SwimLaneComponent.tsx` imports (`Box, HStack, useDisclosure, Center` from `@chakra-ui/react`); toasts from `@/components/ui/Toast`; `lucide-react` icons `aria-hidden`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `_runSideLane` side worker inside `command_queue.ts` | service | event-driven | No second concurrent worker exists; reuse failure primitives (`_recordFailure`, `commands.fail`, `failAndDequeueRun`) from the primary catch, use RESEARCH diagram and "Seams" table |
| Native `<datalist>` lane suggestions | component | n/a | No existing datalist in the project; use RESEARCH/UI-SPEC S1 |
| `AlertDialog` Freeze confirm | component | n/a | Shared `components/ui/ConfirmationModal.tsx` deliberately not reused (hard-coded "Cancel"); build from Chakra `AlertDialog` parts per UI-SPEC |

## Metadata

**Analog search scope:** `controller/server`, `server/routers`, `server/utils`, `server/scripting`, `components/runs`, `components/protocols`, `hooks`, `test`, `test/helpers`
**Files read:** CONTEXT, RESEARCH (lines 1-481 of 723; remaining sections were not paged and are Validation Architecture/Open Questions), UI-SPEC, plus the analog files above (excerpted ranges)
**Tracked check:** every analog lives under `controller/` source dirs, none under `.gsd/` mirrors (`git ls-files` confirmed `server/runControl.ts`, `server/queueStartListing.ts`, `server/toolKey.ts`)
**Pattern extraction date:** 2026-11-16
