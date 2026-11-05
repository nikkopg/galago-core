# Architecture Research — v1.2 (tool-inferred dropdowns + per-tool concurrency lanes)

**Domain:** Next.js + tRPC controller (`controller/`) that queues workcell steps and drives tool servers over gRPC
**Researched:** 2026-11-05
**Scope:** Integration of the three NEW v1.2 features into the existing galago-core architecture. Nothing else.
**Confidence:** HIGH for every integration point and file:line (read directly from the code at HEAD `60838a9`).
MEDIUM for the lane design (no prototype yet; the eligibility model is new). MEDIUM for STACK reply shapes
(read from the sibling `stack-automation-layer` source, not from a captured live reply).

All line numbers are `controller/`-relative at HEAD `60838a9` unless a repo is named.

---

## 0. Verdicts up front

| Question | Verdict |
|----------|---------|
| Where does the generic options source live? | **A sibling binding map + one server registry + one shared select component. Do NOT extend `Field`/`commandFields`.** `commandFields.stack` is pinned with `toStrictEqual` (`test/commandFields.test.ts:80-96`) and by "no select, no defaultValue" sweeps (`:60-68`); the `select` type is reserved for static enums with non-empty `options` (`:12-26`). |
| One tRPC query per source or per field? | **Per source** (5 sources: `stack.robots`, `stack.devices`, `stack.labwareProfiles`, `stack.transferProfiles`, `fast.plates`), one `tool.options` procedure with a closed enum input. Per-field values are derived client-side by a pure function (cascade for device, deck, nest needs the whole tree anyway). |
| How do reads bypass the queue? | They never touch `CommandQueue`. `tool.options` calls the **instance** `Tool.executeCommand` exactly like `tool.latchStatus` (`server/routers/tool.ts:550`). The tool servers already answer these reads while a motion holds them BUSY (stack `READ_COMMANDS`, galago-tools `4ccd3da:tools/stack/server.py:142`, override at `:950`; F.A.S.T. `get_plates` must join its read bypass, contract section 2). |
| **Correction to the F.A.S.T. contract** | The contract (line 88) says to send `get_plates` "through the direct, non-queue send path (`controller/server/tools.ts:375`)". Line 378 is `Tool.controlCommand`. **Do not use it:** (1) a static scan pins `.controlCommand(` callers to exactly `command_queue.ts` + `recoveryControl.ts` (`test/staticScan.test.ts:251-270`); (2) it returns `{ok,response,message}` and discards `meta_data`, so the plate list would be lost. Use instance `executeCommand` (`server/tools.ts:410`), which returns the reply when `reply.return_reply` is set. |
| Lane keying | **Explicit per-step `lane` tag (default `primary`) plus an explicit per-step `laneBarrier` flag.** Not automatic per-toolId lanes. Reason: lanes alone cannot express "in2 must finish before FAST starts". See section 4.2. |
| Lane engine shape | **Keep the legacy busy loop as the `primary` lane worker (3 small seams). Add ONE new side-lane worker for tagged tool steps. Add one pure eligibility module.** Do not rewrite or duplicate the 470-line busy loop. |
| Flag-off guarantee | Process env flag (sync read), seams that return the legacy value when off, plus a golden-transcript test on top of the existing 608 tests, which already drive the real `CommandQueue._start()`. |

---

## 1. System Overview

```
┌────────────────────────────── Browser (pages/, components/) ──────────────────────────────┐
│ pages/tools/[id].tsx   AddToolCommandModal   CommandDetailsDrawer   RunsComponent          │
│   renderFields()         renderField()         renderParameterInput   SwimLaneComponent    │
│        └──────────────┬────────────┴───────────────┬──────────────────────┘               │
│                       ▼  (NEW) components/tools/OptionsSelect.tsx (one shared control)     │
│                       ▼  (NEW) hooks/useToolOptions.ts  ── trpc.tool.options.useQuery      │
├────────────────────────────────────── tRPC (server/routers/) ──────────────────────────────┤
│ tool.options (NEW, query)   tool.latchStatus   tool.runCommand   commandQueue.* (runState,  │
│ toolControl, restart, getAll …)                                                            │
├──────────────┬──────────────────────────────────────────────┬──────────────────────────────┤
│ server/toolOptions.ts (NEW)                │ server/command_queue.ts (MODIFIED, seams)       │
│  registry + parsers + TTL cache + timeout  │  primary loop = legacy busy loop                │
│                │                           │  side-lane worker(s) (NEW)  laneScheduling.ts   │
│                ▼                           │  (NEW, pure)                                    │
│        Tool.executeCommand (instance)      │        │ Tool.executeCommand (static→instance)  │
├────────────────┴───────────────────────────┴────────┴────────────────────────────────────────┤
│ server/tools.ts: one gRPC client per tool (no deadline)       SqliteQueue (command_queue_2)   │
└──────────── gRPC ────────────────────────────────────────────────────────────────────────────┘
        STACK adapter (reads bypass BUSY)          F.A.S.T. adapter (get_plates = read)
```

Two independent change sets that share only `tools.ts`/`Tool` as the gRPC edge:

1. **Options source** is read-only, stateless server-side apart from a TTL cache, and never touches queue state.
2. **Lanes** change only `command_queue.ts`, `SqliteQueue.ts` (one additive method), `runState.ts` (one guard), and the run/protocol surface.

---

## 2. New vs modified, at a glance

### NEW files

| File | Responsibility |
|------|----------------|
| `server/toolOptions.ts` | Closed registry `OPTION_SOURCES` (source id to `{toolType, command, params, parse}`), defensive parsers, caps, TTL cache + in-flight de-dupe, 5 s race timeout, never throws (returns `{status:"unavailable"}`) |
| `components/tools/fieldOptions.ts` | React-free binding map `toolType.command.field` to `{source, level, parents, valueKind}`; pure `deriveOptions(payload, binding, siblingValues)`; pure `dependentsOf(...)` for cascade clearing |
| `components/tools/OptionsSelect.tsx` | The one shared control: born-empty Chakra `Select`, retains a saved value that is no longer offered, plain-input fallback when unavailable, explicit Refresh |
| `hooks/useToolOptions.ts` | The only client reader of `tool.options` (mirrors `useRunControl.ts`): `staleTime`, `retry:false`, `refetchOnWindowFocus:false`, `enabled` only while a field is on screen and editable |
| `server/laneScheduling.ts` (pure, no imports from db/React) | `isEligible(rows, row)`, `pickEligible(rows, lane, activeRunId)`, `validateLanes(commands)`; the unit-test seam for all lane semantics |
| `test/toolOptions.test.ts`, `test/fieldOptions.test.ts`, `test/laneScheduling.test.ts`, `test/lanes.test.ts`, `test/lanesFlagOff.test.ts` | See build order |

### MODIFIED files

| File | Change | Size |
|------|--------|------|
| `server/routers/tool.ts` (next to `latchStatus`, :550) | add `options` query: input `{toolId, source: z.enum(...), refresh?: boolean}` only (never a client-chosen command or params) | small |
| `server/routers/command_queue.ts` | `toolControl` input gains optional `queueId` (lane mode only); optional `runStates` query | small |
| `pages/tools/[id].tsx` (`renderFields`, :215-345) | branch to `OptionsSelect` when a binding exists; `handleInputChange` (:182) clears dependents | small |
| `components/protocols/AddToolCommandModal.tsx` (`renderField`, :290) | same branch; keep the "No Variable" pairing | small |
| `components/protocols/CommandDetailsDrawer.tsx` (`renderParameterInput`, :330-455) | same branch; **key-name driven today** (iterates saved params, :510), so it must look up `commandInfo.toolType/command/key` in the binding map; fetch only when `isEditing` | small |
| `vendor/galago-tools` pointer (`.gitmodules` / gitlink) | STACK: re-pin to `4ccd3da` (expect **zero** diff in `gen-interfaces`; protos unchanged from `bcbbf8e`). F.A.S.T.: re-pin to the frozen `get_plates` commit and regenerate with ts-proto 1.151.1 | pointer |
| `server/command_queue.ts` | lane seams (section 4.4) | medium |
| `server/utils/SqliteQueue.ts` | additive `claimEligible(queueId)` / `queuedRowsSync()` reuse; legacy `startNext` untouched | small |
| `server/runState.ts` | `RunStateMonitor.stopIf(queueId)` / `currentQueueId` (see Pitfall L-2) | small |
| `server/recoveryControl.ts` caller (`routers/tool.ts:533`) | pass `runningStepFor(toolName)` instead of `.runningStep`; signature unchanged | tiny |
| `types/run.ts:37-40` | `AdvancedParameters.lane?: string; laneBarrier?: boolean` (optional, so saved protocols are unaffected) | tiny |
| `server/runs.ts:92-120`, `:154-200` | validate lanes at run creation; pass-through already holds (`cmd.advancedParameters \|\| {...}`, :112) | small |
| `server/scripting/protocol-script-executor.ts:23-35` | `galago.command(toolId, command, params, {lane, barrier})` | small |
| `components/runs/RunsComponent.tsx`, `list/SwimLaneComponent.tsx`, `runOutcome.ts`, `utils.ts` | per-lane rows when any row has a non-primary lane; outcome fix (Pitfall L-6) | medium |

### NOT changed (deliberately)

`commandFields` (constants.ts), `components/tools/types.ts` `Field`, `commandParams.ts`, `runControl.ts`, `recoveryActions.ts`, `operatorOnlyCommands.ts`, the `_start` first-statement guard text (one line is inserted before it, see 4.4), `_recordFailure` (the single `this.error =` site, pinned at `staticScan:462`), `ToolControlResult`, `BoundedRawJson`.

---

## 3. Feature A+B: options source ("dropdowns inferred from the instrument")

### 3.1 Component responsibilities

| Component | Owns | Talks to |
|-----------|------|----------|
| `server/toolOptions.ts` | Which reads exist, their fixed command + params, parsing/capping, cache, timeout | `Tool.forId(...).executeCommand` only |
| `tool.options` (routers/tool.ts) | Resolve tool row (`getToolFromDB`, :51), call registry, return payload | `toolOptions.ts`, `getToolFromDB` |
| `useToolOptions` | The single client query + cache policy | `trpc.tool.options` |
| `fieldOptions.ts` | Field-to-source binding, cascade, value kind (string/number) | pure; imported by the three render sites |
| `OptionsSelect` | Rendering, born-empty rule, fallback, Refresh | `useToolOptions`, `fieldOptions` |

### 3.2 Registry (the safety boundary)

```typescript
// server/toolOptions.ts
export const OPTION_SOURCES = {
  "stack.robots":           { toolType: "stack", command: "get_robot_states",       params: {} },
  "stack.devices":          { toolType: "stack", command: "list_devices",           params: {} },       // tree
  "stack.labwareProfiles":  { toolType: "stack", command: "list_labware_profiles",  params: {} },
  "stack.transferProfiles": { toolType: "stack", command: "list_transfer_profiles", params: {} },
  "fast.plates":            { toolType: "fast",  command: "get_plates",             params: {} },
} as const;                      // refresh=true is added server-side only on operator Refresh
```

Rules (each gets a static-scan pin, same style as `staticScan.test.ts:640-740`):
- Input is the **enum id**, never `{command, params}`. Contrast `tool.runCommand` (:497) which accepts anything. A client can therefore not use this procedure to send `transfer` or `acknowledge_failure`.
- The registry never contains `transfer`, `acknowledge_failure`, or any non-read. Pin: registry command set is exactly the five above.
- `toolOptions.ts` imports nothing from `command_queue.ts` (reads never interact with queue state) and nothing from `controlCommand`. Pin both.
- The router checks `record.type === registry.toolType` (a `fast.plates` request against a STACK tool is `BAD_REQUEST`).

### 3.3 Reply shapes (STACK, from `stack-automation-layer/results.py:189-262`, `knowledge.py:72-310`)

| Source | `meta_data` envelope | Option value (send this) | Label |
|--------|----------------------|--------------------------|-------|
| `stack.robots` | `{kind:"robotStates", robots:[{robotName, state}]}` | `robotName` | `robotName` (do not show live `state`; it goes stale and invites a "pick the idle one" choice) |
| `stack.devices` | `{kind:"deviceTree", deviceCount, devices:[{deviceName, deviceMarker, decks:[{deckName, deckMarker, isCalibrated, nests:[{nestName, unifiedName, type, isCalibrated, ...}]}]}], ambiguous:[...], apiVersion}` | `deviceName` / `deckName` / `nestName` | same. **Never `unifiedName`** (the core documents it as display-only, `model.py:7`; the adapter's `_transfer_request` sends the plain names, `server.py:341-361`) |
| `stack.labwareProfiles` | `{kind:"labwareProfiles", profiles:[{name, gripPosition, ...}]}` | `name` | `name` |
| `stack.transferProfiles` | `{kind:"transferProfiles", profiles:[{name, fields}]}` | `name` | `name` |
| `fast.plates` (contract) | `{plates:[{id, description, rowCount, colCount, workingCapacity}]}`, ascending by `id`, `[]` is valid | `id` (integer >= 1, truncate the Struct double) | `id - description (RxC, N µL)` |

A `readFailed` envelope (`{kind:"readFailed", error:{...}}`) arrives as `ERROR_FROM_TOOL` and is thrown by `describeToolReply` (`server/toolReply.ts`); the options layer maps any throw to `unavailable`.

Normalised client payload (the parser output; the only thing the browser sees):

```typescript
type OptionsPayload =
  | { status: "ok"; fetchedAt: number; items: { value: string | number; label: string }[] }
  | { status: "ok"; fetchedAt: number; tree: { name: string; decks: { name: string; nests: string[] }[] }[];
      ambiguous: string[] }                      // stack.devices only
  | { status: "unavailable"; reason: "offline" | "not_configured" | "no_data" | "invalid_reply" | "timeout" };
```

Caps (fail-closed, mirror the contract's "maximum plate count, string lengths, integer ids"): max 500 items per list, 200 chars per string, tree max 100 devices x 50 decks x 200 nests; anything over the cap or of the wrong type makes the **whole** reply `invalid_reply` (never a partial list; a partial list would silently omit a real nest).

### 3.4 Cache and polling policy

- **Server:** `Map<"{toolName}|{sourceId}", {at, payload}>`, TTL 15 s, plus an in-flight promise map so concurrent dropdowns (source and destination share `stack.devices`) cost one RPC. `refresh:true` bypasses the cache and, for STACK devices/profiles, adds `refresh: true` to the proto message (the adapter forwards it, `server.py:ListDevices`). Never cache `unavailable`.
- **Client:** `staleTime 30_000`, `retry:false`, `refetchOnWindowFocus:false`, **no `refetchInterval`**. An options query must not become a poller: each call logs "Tool Command Execution" through `logAction` (`server/tools.ts:393-405`).
- **Timeout:** wrap in a 5 s `Promise.race`. The gRPC client has no deadline by design (PROJECT.md Context); a hung connection would otherwise hold the query forever. The race abandons the wait, it does not cancel the call.
- **Cache is invalidated by** `tool.edit`/`tool.configure`/`tool.delete` (clear that tool's entries) and by operator Refresh.

### 3.5 Bypassing the queue (why it is safe and what it must not do)

- The procedure never reads or writes `CommandQueue.global` (pin: `toolOptions.ts` and its router block do not mention `CommandQueue`).
- The tool servers answer reads while a step runs: STACK `ExecuteCommand` override bypasses `isReady`/`setStatus` for `READ_COMMANDS` (`4ccd3da:tools/stack/server.py:142-156, 950-985`); F.A.S.T. has the same override pattern (`4ccd3da:tools/fast/server.py:515`) and the contract requires `get_plates` to join it ("never takes the motion lock; safe while a transfer is running").
- Because lanes will run STACK and F.A.S.T. steps concurrently, `get_plates`/`list_devices` reads can overlap a running step on the same tool. That is by design; add one test per adapter on the galago-tools side (contract section 4) and one live check in the lane proof phase.
- **Simulated tools return no `meta_data`** (STACK simulated mode goes through the base `_dispatchCommand` sleep, `server.py:_dispatchCommand`). Result `unavailable/no_data`; the form degrades to the plain input. Real mode against the PAC simulator (used in v1.1 UAT) returns data.
- **Not configured:** real-mode STACK without a service returns `NOT_READY "stack: not configured"` (`server.py:_NOT_CONFIGURED_MESSAGE`) which maps to `unavailable/not_configured`.

### 3.6 Rendering rules at the three sites

Shared invariants (PROJECT.md Out of Scope: "Dropdowns that preselect a physical choice"):
1. **Born empty.** Placeholder option, `value=""`, no auto-select even when exactly one item exists.
2. **Retain unknown saved values.** A saved protocol value not in the current list is shown as an extra option `"<value> (not offered by instrument)"` and is kept; never silently replaced or cleared.
3. **Fallback to the plain input** when `status !== "ok"`, with a one-line hint and Refresh. Do not show a last-known (stale) list: a deregistered plate or removed nest offered as a choice is a physical-safety hazard. (This resolves the contract's open point 1 with "plain input"; confirm in Phase 6 discussion.)
4. **Value kinds stay as today.** `fast.plates` writes a **number** (`Number(e.target.value)`); the modal's number path saves `parseFloat(value) || 0` (`AddToolCommandModal.tsx:482`), the tool page stores the number (`[id].tsx` NumberInput onChange). STACK fields stay strings and keep flowing through `coerceBooleanParams` then `omitBlankParams` unchanged (`[id].tsx:151-164`).
5. **Cascade clears dependents.** Changing `source_device` clears `source_deck` and `source_nest`; changing `source_deck` clears `source_nest`. Clearing to blank is safe; auto-selecting is not.
6. **Ambiguous names** (`ambiguous[]` from the device tree): render disabled with a "ambiguous in stack-automation-layer" suffix; the core refuses them anyway (`knowledge.py` DeviceTree docstring).
7. **Variable binding preserved** in the modal and drawer: the "No Variable" `Select` and the `{{var}}` text convention (`AddToolCommandModal.tsx:225-241`) stay; `OptionsSelect` replaces only the left-hand control and is disabled while a variable is bound, exactly like the existing `select` case (`:581-620`).

Site-specific:

| Site | Tool identity for the query | Gating |
|------|-----------------------------|--------|
| `pages/tools/[id].tsx` | `config.name` (`:215`) | enabled when the command is selected |
| `AddToolCommandModal.tsx` | `selectedToolData.name` (:117, :222) | enabled on wizard step 3 only |
| `CommandDetailsDrawer.tsx` | `commandInfo.toolId` (tool **name**) | **only when `isEditing`**. The run page renders this drawer read-only through `SwimLaneComponent.tsx:29-36` (`isEditing={false}`); a read-only view must not fire RPCs |

STACK field to binding (all `type:"text"` in `commandFields` stay as is):

| Field(s) | Source | Level | Parents |
|----------|--------|-------|---------|
| `robot` (transfer, get_transfer_estimate, get_labware_presence) | `stack.robots` | list | none |
| `labware_profile` | `stack.labwareProfiles` | list | none |
| `source_device`, `destination_device` | `stack.devices` | device | none |
| `source_deck`, `destination_deck` | `stack.devices` | deck | `*_device` |
| `source_nest`, `destination_nest` | `stack.devices` | nest | `*_device`, `*_deck` |
| `source_transfer_profile`, `destination_transfer_profile` | `stack.transferProfiles` | list | none |
| F.A.S.T. `source_plate_id`, `dest_plate_id` (transfer) | `fast.plates` | list (number) | none |

`step_key` and `timeout_s` stay free-form. `get_plates` is kept out of `commandFields.fast` (contract: internal, never a tool-page command or a protocol step); add a test that `commandFields.fast` has no `get_plates` and that `fast.transfer` still lists exactly the 12 fields in order (`commandFields.test.ts:34-55`).

### 3.7 Data flow (STACK transfer form)

```
operator opens "Transfer" on /tools/[id]
  → OptionsSelect(source_device) mounts → useToolOptions({toolId:"STACK", source:"stack.devices"})
  → tool.options → toolOptions.fetch()  [TTL hit? return]  → Tool.forId(..).executeCommand({stack.list_devices})
  → STACK adapter (READ bypass) → core devices() → Reply.meta_data (Struct → plain object)
  → parse + caps → OptionsPayload{tree}
  → client: deriveOptions(tree, binding(source_device), {}) → device names
operator picks device → handleInputChange sets source_device, clears source_deck/source_nest
  → OptionsSelect(source_deck) re-derives from the SAME cached tree (no RPC)
operator Send → existing handleSubmit → omitBlankParams(coerceBooleanParams(...)) → tool.runCommand (unchanged)
```

---

## 4. Feature C: per-tool concurrency lanes

### 4.1 Current single-slot state map (what assumes ONE running step)

| # | State / code | Where | Single-slot assumption | Lane treatment |
|---|--------------|-------|------------------------|----------------|
| 1 | `_runningPromise` | `:66`; set `:942`; read `:288, :919, :968`; cleared `:957` | one busy loop owns the queue | umbrella over all lane workers; `_start` per-lane guard (4.4) |
| 2 | `_runningStep` | `:74`; set `:1359`; cleared `:1365`; read `:293, :530, :566, :640, :923` | one tool step at a time | stays = primary-lane step; add `_sideRunning: Map<lane, step>` and `runningStepFor(toolId)` |
| 3 | `_runStateMonitor` | `:77`; `start` `:1360`, `stop` `:1364`; `RunStateMonitor.start()` begins with `this.stop()` (`runState.ts:127`) | one poller, one envelope | stays single; started ONLY for the controllable step (Pitfall L-2) |
| 4 | `_abortAcceptedQueueId` | `:83`; set `:641`, consumed `:1380-1381` | one accepted abort | `Set<number>` keyed by queueId |
| 5 | `_failedAttempt` | `:91`; set `:1385`, read `:645`, cleared `:774, :798, :928, :1013` | one late-abort-reply token | `Map<queueId, attempt>`; legacy sets/reads the same logical slot |
| 6 | `state` BUSY/READY/FAILED/OFFLINE | `:65, :314`; loop cond `:1000` | one global machine | keep global; lane-halt = FAILED plus a synchronous `_laneHalt` latch (4.5) |
| 7 | `error`, `_failureSeq`, `_recordFailure` | `:67-71, :434-437`; single-site pin `staticScan:462` | one failure to show | keep; 2nd concurrent failure overwrites the banner (rows keep their own stored error); record both in the audit log |
| 8 | `_isWaitingForInput`, `_currentMessage`, `_messageResolve`, `_timerTimeout` | `:99-106` | one modal at a time | **primary lane only** (modal steps are Tool Box steps, forced primary) |
| 9 | `UIMessage` modals (`pause`, `message`, `timer`, `stop_run`, `user_form`) | `:33-41, :463-770`; handlers `:1082-1270` | resolve the busy loop via `_messageResolve` | primary only; side lanes are never blocked or released by a modal |
| 10 | `variable_assignment` | `:1285-1347`, `evaluateExpression` `:319` | runs inside the stepper | primary only; races with side-lane `{{var}}` substitution (`tools.ts:420-445`) are the author's to fence with a barrier |
| 11 | `skipExecutionVariable` | `:1023-1060` | evaluated in the stepper | primary loop: unchanged. Side worker: new `_shouldSkip(row)` (~25 lines), lane-local; do not refactor the legacy block |
| 12 | `startNext()` | `SqliteQueue.ts:112-150` | head of the global queue regardless of status; **a STARTED row stays in `_queue` until `complete`/`skip`** (`:471, :484`) | a second loop calling it would re-dispatch the STARTED head (the F5 root cause). Lane pick must exclude STARTED |
| 13 | empty-queue branch | `:1004-1007` | "no row" means "queue done" so `stop()` | in lane mode "no eligible row" can mean "waiting on a barrier" (seam, 4.4) |
| 14 | `toolControl` | `:526-621`; identity gate `:566` | targets `_runningStep` | resolves the single running step whose tool type has a `runControl` entry (4.6) |
| 15 | `_recordAcceptedAbort` | `:639-679` | `_runningStep === step` | "is running in any lane" |
| 16 | `recoveryControl` guard | `server/recoveryControl.ts:59`; caller `routers/tool.ts:533` | "a running step on this tool" | pass `runningStepFor(toolName)` (any lane) |
| 17 | `commandQueue.runState` / `runStates` | `server/routers/command_queue.ts:141`; `hooks/useRunControl.ts:14` | one envelope | unchanged (single controllable step invariant, 4.6) |
| 18 | `isStartInProgress` / `restart` | `:287`; `routers/command_queue.ts:30-35` | Start accepted iff no loop | lane mode: accepted iff at least one lane loop was launched |
| 19 | `enqueueRun` auto-start | `:1489-1491` | only when `state === READY` | unchanged; never auto-clears a lane halt |
| 20 | `_recoverInterruptedSteps` | `:142-159`, `SqliteQueue.ts:596-644` | already loops all STARTED rows | **no change** (already multi-row safe) |
| 21 | `getAll` polling, `deriveRunOutcome` | `RunsComponent.tsx:121`; `runOutcome.ts:30-55` | rows are a total order; "last row COMPLETED" means done | needs a lane-aware outcome (Pitfall L-6) |

### 4.2 Why `lane` alone is not enough: a barrier is mandatory

The todo's sketch maps `in1, in2, {FAST || goto-safe}, out1, out2` to lanes. Walk it through "one worker per lane, each runs its lane's rows in order":

- `FAST` is the first row on lane `fast`; nothing precedes it on that lane, so it is eligible at t=0 and starts **while `in1` is still loading the plate**. Unsafe.
- Symmetrically `out1` would start while FAST is still transferring.

So eligibility needs a cross-lane ordering primitive. Recommended minimal model (all derivable from the queued rows, no new table, no stored epoch):

```
Each row has: position (queue order), lane (default "primary"), laneBarrier (default false).
A row R is ELIGIBLE iff all of:
  1. R.status is CREATED or FAILED (FAILED = today's operator retry); never STARTED.
  2. R belongs to the ACTIVE RUN = run_id of the lowest-position row still in the queue
     (lanes only parallelise within one run; run N+1 waits for run N to drain, as today).
  3. No row P in R's run with P.position < R.position and P still queued (not terminal) where
       P.lane == R.lane                              (lane order is monotone), OR
       P.position < lastBarrier(R)                   (everything strictly before the barrier row
                                                      that opened R's segment; lastBarrier(R) is the
                                                      highest-position barrier row at or before R,
                                                      or 0 if none).
     (R.laneBarrier makes lastBarrier(R) = R.position, so a barrier row waits for ALL earlier rows.
      The opening barrier row itself does not block later rows of its segment: that is what lets
      goto-safe run alongside FAST.)
  4. R.lane has no running step, and the lane-halt latch is clear.
  5. Controllable-step invariant (4.6): not (R's tool has a runControl entry and another
     controllable step is running).
```

Why "still queued" is a sufficient "not yet terminal" test: `complete` and `skip` delete the row from `<q>_queue` (`SqliteQueue.ts:471-495`), while STARTED and FAILED rows stay (`:521`, F5 notes). So eligibility is a pure function of `queuedRowsSync()` (`:398`), computed in one synchronous turn, which is also what the single-flight discipline needs.

The example, tagged:

```
in1 (primary)  in2 (primary)  FAST (lane "fast", barrier)  goto-safe (primary)  out1 (primary, barrier)  out2 (primary)
```
- `FAST` (barrier): `lastBarrier` = FAST, so it blocks on every earlier queued row (in1, in2) and nothing else.
- `goto-safe` (no barrier): `lastBarrier` = FAST, so it blocks only on queued rows strictly before FAST (already gone) and on earlier rows of its own lane (in2, gone). It is eligible while FAST runs. ✓
- `out1` (barrier): blocks on every earlier queued row, so it waits for both FAST and goto-safe. ✓
- `out2`: same lane as out1, after it. ✓

Pin this with a table-driven test in `test/laneScheduling.test.ts` (the example above is test case 1).

Implication: **`laneBarrier` is not optional** (the todo calls `join` optional). A tagged-lane run without barriers fans out from the start. Mitigation: `validateLanes` (4.7) rejects a run whose first non-primary-lane row has no barrier unless it is at position 0 (so the author cannot accidentally fan out before their first step). Sequential execution of a lane-tagged protocol (flag off) is always safe and merely slower.

### 4.3 Lane identity and validation

- `lane` is free-form, normalised with `normalizeToolKey`-style trimming; default (absent or `"primary"`) = primary. Non-tool steps (`toolId === "Tool Box"`, any command in the busy loop's Tool Box chain `:1082-1348`) **must** be primary. `Tool Box run_script` is a tool step handled at the dispatch bracket (`:1351`) but still lives on primary (toolbox is one tool).
- **One tool maps to exactly one lane per run** (so one tool server never receives two overlapping steps; each server's own motion lock stays the only concurrency control it sees, and the step-key ledger never sees a duplicate or re-sent key).
- Cap: at most 4 lanes per run; lane name 1-32 chars of `[a-z0-9_-]`.
- Validation happens at **run creation** (`createFromProtocol`, after the operator-only scan at `runs.ts:~219-232`) via pure `validateLanes(commands, laneMode)`. **Map errors by `Error.name` guard, not `instanceof`** (Phase 4 lesson 04-07/G-04-5: dev-recompile module-copy drift broke class-identity checks; see PROJECT.md Key Decisions).
- With the process flag off, lane tags are inert: not validated, not honoured, logged once per run ("lane tags ignored: parallel lanes disabled"). An imported lane-tagged protocol therefore runs exactly like today.

### 4.4 Minimal-change design: seams in `command_queue.ts`

Principle: the legacy busy loop is `primary`. Everything it does (modals, assignments, goto, skip, Tool Box chain, dispatch bracket, catch) is **untouched** for primary rows. Add exactly these:

1. **Mode gate (sync).** `private readonly _laneMode = process.env.GALAGO_PARALLEL_LANES === "1";` Read once at construction. Not an `appSettings` DB read (`_getAppSettingValue` `:170` is async, and `_start` forbids an await before the claim, `staticScan:470-486`). `.planning/config.json` is a GSD planning file that is not in the deployed image; do not use it for a runtime flag. Add to `docker-compose.yml` environment (default unset = off).

2. **`_start` dispatch.** One line before the guard:
   ```typescript
   async _start(source = "operator") {
     if (this._laneMode) return this._startLanes(source);   // NEW; unreachable when off
     if (this._runningPromise) { ...unchanged guard... }
   ```
   Update the pin at `staticScan:470-486` to "the legacy guard is first among everything except the lane-mode early return, and the early return is `_laneMode`-only".

3. **`_startLanes(source)`** (new, ~40 lines): per-lane guard + launch.
   ```typescript
   // per-lane Start guard: a lane with a live loop is never relaunched
   for each lane L in lanesWithWork(queuedRowsSync()):
     if (this._laneLoops.has(L)) { log "Queue Start Ignored (lane L already running)"; continue; }
     launch loop(L)  // primary → this._runBusyLoopWhileQueueNotEmpty(120); other → this._runSideLane(L)
   this._laneHalt = undefined;                      // ONLY an operator Start clears the halt
   ```
   - `_runningPromise` in lane mode = `Promise.all([...this._laneLoops.values()])` (so `stop()` at `:965-969` and `isStartInProgress` keep working). Claim it synchronously before any await, same discipline.
   - `source === "enqueue"` never clears `_laneHalt` (auto-start is already gated on `state === READY`, `:1489`, and a halt leaves state FAILED).
   - An operator Start while lane B is mid-step relaunches only the idle lane (A, whose FAILED row retries first, as today). B's in-flight row is never re-claimed: `STARTED` is excluded by rule 1 and `_laneLoops.has("B")` blocks a second loop.
   - `restart` router `accepted` = "at least one lane launched" (`isStartInProgress` returns true iff every lane with work already has a loop).

4. **Pickup seam inside the legacy loop** (3 lines at `:1003-1007`):
   ```typescript
   const nextCommand = await this._pickNext("primary");        // off: returns this.commands.startNext()
   if (nextCommand === WAIT) continue;                          // never returned when off
   if (!nextCommand) { this.stop(); return; }                   // off: unchanged
   ```
   `_pickNext(lane)` when `!_laneMode`: `return this.commands.startNext()` (byte-for-byte the legacy call). When on: `pickEligible(queuedRowsSync(), lane, activeRun)` then a sync claim `SqliteQueue.claimEligible(queueId)` (status to STARTED in one transaction, re-checking the row is still CREATED/FAILED and still queued), returning `WAIT` if nothing is eligible *but rows remain*, `false` only when `_queue` is empty. **Check halt and claim in the same synchronous turn** (no `await` between `if (this._laneHalt) …` and the claim), for the same reason as the `_start` guard. The legacy 1500 ms inter-step delay (`:1002`) is kept; barrier release latency is bounded by it.

5. **`_runSideLane(lane)`** (new, ~110 lines). Only tool steps; no modals. Per iteration: delay 1500 ms → exit if `state !== BUSY` or halt latched → `_pickNext(lane)` → `_shouldSkip(row)` (lane-local) → build the frozen `attempt` → `_sideRunning.set(lane, attempt)` → if the tool type has a `runControl` entry, `_runStateMonitor.start(attempt)` → `await this.executeCommand(row)` → `finally` `_sideRunning.delete(lane)` and `_runStateMonitor.stopIf(attempt.queueId)` → log. The catch **reuses the same primitives** as `:1374-1464`: `abortAccepted` via the per-queueId set, `commands.failAndDequeueRun` / `commands.fail`, the `rowRemoved` branch (`:1420-1433`), `_recordFailure` (the single site), `_setState(FAILED)`, non-awaited `_notifyFailure` (pin `staticScan:572`). Do not copy the 470-line Tool Box chain.
   Workers are reconciled by the primary loop each tick (`_ensureLaneWorkers()`): a run enqueued while BUSY with a new lane gets a worker without a Start, matching how today's loop picks up rows enqueued mid-run.

6. **Lifecycle end.** Only the primary loop calls `stop()` (when `_pickNext` returns `false` = the queue is empty = every lane drained). Side workers exit on `state !== BUSY`. `stop()` already `await`s `_runningPromise`, which is the umbrella.

Everything else (`fail`, `failAndDequeueRun`, `_recordFailure`, modals, goto, assignments) keeps its code. `CommandQueue.fail()` (`:161`) has no callers outside the class and tests; leave it.

### 4.5 Lane-halt (the safety rule)

PROJECT.md: "lane-halt (any latch-class failure freezes every lane)". The queue cannot tell which failures latch on the tool server (the latch is the tool's). **Fail closed: any step failure on any lane halts every lane.**

- **Latch set synchronously, first statement of the catch** (`_laneHalt = {queueId, lane, at}`), before the first `await` at `:1392/:1408`, exactly like `_failedAttempt` at `:1385` which already documents the same race ("Synchronously, before the first await"). The other lanes' pickup checks it synchronously right before their claim, so no new dispatch can sneak in between "A failed" and "A's row is marked FAILED and state is FAILED".
- **In-flight steps on other lanes are not cancelled.** The queue never auto-aborts (Core Value). Lane B's step runs to its own end; its result is recorded normally (success or failure); no new row dispatches on any lane. The run page already shows the banner (`getError`, 1.5 s poll).
- **Cleared only by an operator Start** (`_startLanes`, source `"operator"`). Not by `resume()` (which today clears `error`, `:844`), not by `clearError`, not by the auto-start. A halt must outlive `state` flipping back to READY.
- **Second failure while halted:** `_recordFailure` overwrites the banner text (single site); both rows carry their own stored error (step cards, ERR-03); add `"Lane Halt Additional Failure"` to the audit log with both lane names. Open point for discussion: show a "2 failures" count in the banner.
- Tests: A fails while B is in `await` (B must not dispatch its next row); B's own failure while halted; operator Start relaunches only A; `enqueue` auto-start does not clear the halt.

### 4.6 Control surface stays single-slot via an invariant

The run page control bar, `pausePrompt`, `InstrumentStopModal`, `stopInterception`, `toolControl` and the single-envelope `runState` all assume one controllable running step. Only F.A.S.T. has a `runControl` entry (`runControl.ts:30-36`), and the headline use case puts **F.A.S.T. on the side lane** (STACK goto-safe is on primary). A naive `_runningStep`-based `toolControl` would then target STACK and refuse ("does not support live run control"), **removing the operator's ability to pause/abort the 73 s transfer. That would break the Core Value.** So:

- `toolControl` resolves its target as: all running steps (`_runningStep` plus `_sideRunning`) filtered by `getRunControl(toolType) !== undefined`. Exactly one candidate: use it. Zero: today's "No step is currently running" / "does not support live run control" refusals (flag off yields the same single candidate or zero, so unchanged). More than one: impossible by invariant.
- **Invariant, enforced in eligibility (rule 5):** at most one running step whose tool type has a `runControl` entry. A second controllable step (e.g. two F.A.S.T. instances on two lanes) waits. This keeps `runState`, `ControlBar`, `ToolPausedModal`, `InstrumentStopModal` and `useRunControl.ts` byte-identical, and keeps the static pins (`staticScan:204-285`) valid. Revisit only if a second controllable tool type is registered.
- The identity gate at `:566` and `_recordAcceptedAbort` `:640` use `_isRunning(step)` (any lane).
- `runStateMonitor` is started only for the controllable step and stopped with `stopIf(queueId)`.

### 4.7 Protocol surface (phase "protocol/run page")

- **Data:** `advancedParameters.lane?: string`, `.laneBarrier?: boolean` on each stored command (`types/run.ts:37-40`). No DB migration: `command_data` is JSON (`SqliteQueue`). Pass-through already works in `runs.ts:112`, `ProtocolDetailView.tsx:236,422`, and the drawer's spread (`CommandDetailsDrawer.tsx:128-170`).
- **Drop the todo's per-run `useParallelToolLanes` flag.** The lane tags are themselves the opt-in; untagged protocols are primary-only and byte-identical even with the process flag on. One fewer concept to store and to get wrong.
- **Script API:** `galago.command(toolId, command, params, { lane, barrier })` (`protocol-script-executor.ts:23`), plus convenience `galago.barrier(...)` is NOT needed because the barrier is a flag on a step.
- **Visual editor:** the drawer's Advanced Parameters accordion gains a Lane select and a "Wait for all earlier steps" switch. **Do not repurpose the dead `runAsynchronously` switch** (`CommandDetailsDrawer.tsx:556-562`): it is written as literal `false` everywhere (`runs.ts:117`, `protocol-script-executor.ts:30`, `ProtocolDetailView.tsx:241,427`, `AddToolCommandModal.tsx:240`) and old protocols carry it; a new field avoids reinterpreting stored data. The switch can be removed in a later cleanup.
- **Preview:** `protocol.preview` (`routers/protocol.ts:250-300`) already returns the resolved commands with `advancedParameters`; the client groups by lane. No server change besides `validateLanes` warnings in the preview response (`logs`/`error` fields).
- **Run page:** `RunsComponent` already polls `commandQueue.getAll` every 2 s (`:121`), so lane and status ride on each row for free. `SwimLaneComponent` renders one flat `HStack` (`:42-56`); add `groupRowsByLane(rows)` (pure, in `components/runs/utils.ts`) and render one stacked row per lane **only when any row has a non-primary lane**, otherwise the legacy flat DOM (byte-identical when no lanes). Lane order = first appearance. Label each lane row.
- **Outcome:** see Pitfall L-6.
- **Start confirmation:** `describeQueueStart` (`server/queueStartListing.ts`) is unchanged; optionally append "lanes: primary, fast".

### 4.8 Flag-off byte-identical proof

1. `_laneMode` false: `_start` early return not taken; `_pickNext` returns `this.commands.startNext()`; `WAIT` never produced; `_sideRunning`, `_laneHalt`, `_laneLoops` stay empty; `toolControl`'s candidate list is `[_runningStep]`; `runningStepFor` returns `_runningStep` when the tool matches.
2. **The existing 608 tests are the primary regression** (they drive the real `CommandQueue._start()` through `installFakeTool`, e.g. `test/queueStartGuard.test.ts`, `toolControl.test.ts`, `errorPath.test.ts`, `runState.test.ts`, `queueRestart.test.ts`). They must pass with zero edits except the single re-pinned static scan (4.4 step 2).
3. Add `test/lanesFlagOff.test.ts`: a golden transcript (the ordered `logAction` actions, `_state` transitions and `executeCommand` call order) for a mixed Tool Box + tool run, captured at the pre-change commit and asserted after, once with the env unset and once with the env set but an untagged protocol (must be identical).
4. Static pins (add): no `await` between the `_laneHalt` check and `claimEligible` in `_pickNext`; `_recordFailure` is still the only `this.error =` assignment; side-lane worker never references modal state (`_isWaitingForInput`, `_messageResolve`, `_currentMessage`).

---

## 5. Recommended project structure (additions only)

```
controller/
├── server/
│   ├── toolOptions.ts            # NEW  registry, parsers, caps, cache, timeout
│   ├── laneScheduling.ts         # NEW  pure eligibility + validateLanes (no db/React imports)
│   ├── command_queue.ts          # MOD  seams: _laneMode, _startLanes, _pickNext, _runSideLane
│   ├── runState.ts               # MOD  RunStateMonitor.stopIf / currentQueueId
│   ├── runs.ts                   # MOD  validateLanes at run creation
│   ├── utils/SqliteQueue.ts      # MOD  claimEligible (additive)
│   └── routers/tool.ts           # MOD  tool.options
├── components/
│   ├── tools/
│   │   ├── fieldOptions.ts       # NEW  bindings + deriveOptions + dependentsOf (React-free)
│   │   └── OptionsSelect.tsx     # NEW  shared control
│   └── runs/utils.ts             # MOD  groupRowsByLane (pure)
├── hooks/useToolOptions.ts       # NEW  only reader of tool.options
└── test/                         # NEW  toolOptions, fieldOptions, laneScheduling, lanes, lanesFlagOff
```

Rationale: `fieldOptions.ts` and `laneScheduling.ts` are React-free and db-free on purpose, following the repo's own convention (`runControl.ts`, `controlDecision.ts`, `queueStartListing.ts`, `runOutcome.ts`) so they are unit-testable without jsdom/RTL (Key Decision "pure-logic tests plus static source scans, no jsdom").

---

## 6. Patterns to follow

### Pattern 1: Closed read registry, id-only input
**What:** The client names a source id; the server owns command and params. **When:** any new "ask the instrument" read. **Precedent:** `tool.latchStatus` sends one fixed constant (`LATCH_READ_COMMAND`, `recoveryActions.ts`), input is `toolId` only (`routers/tool.ts:550`). **Trade-off:** one registry entry per new read; that friction is the safety feature.

### Pattern 2: Pure decision module + thin shell
**What:** Put policy in an import-free module (`laneScheduling.ts`, `fieldOptions.ts`) and test it exhaustively; keep the class/component thin. **Precedent:** `validateControlRequest` in `runControl.ts`, `deriveRunOutcome`, `describeQueueStart`.

### Pattern 3: Synchronous check-and-claim
**What:** No `await` between a guard and the state it protects. **Precedent:** `_start` guard to `_runningPromise` claim (`:919-943`, pinned `staticScan:470-486`), `_describeQueueStart` made synchronous on purpose (`:906`), `_recordAcceptedAbort` layers (a)(b) (`:639`). Lane-halt check to `claimEligible` follows it.

### Pattern 4: Failure latch set before the first await
**What:** record the fact synchronously, persist asynchronously. **Precedent:** `_failedAttempt` at `:1385`. Lane-halt reuses the idiom.

### Pattern 5: Explicit operator Start is the only thing that re-arms
**What:** Nothing but an operator action clears a halt, retries a failed step or acknowledges. **Precedent:** v1/v1.1 Core Value; `enqueueRun` never auto-starts a FAILED queue (`:1489`).

---

## 7. Anti-patterns to avoid

| Anti-pattern | Why wrong here | Do instead |
|--------------|----------------|------------|
| Extending `Field` with `optionsSource` and editing `commandFields.stack` | Breaks the `toStrictEqual` wire-shape pin and the "no select" sweep; muddles the static-`select` contract | Sibling `fieldOptions.ts` binding map |
| Sending `get_plates` via `Tool.controlCommand` (contract text, `tools.ts:375`) | Pinned to two callers; discards `meta_data` | Instance `executeCommand` (latchStatus precedent) |
| A `refetchInterval` on options queries | Each read logs "Tool Command Execution"; turns a form into a poller; hammers the instrument during a run | `staleTime`, explicit Refresh |
| Showing a stale last-known list when offline | A deregistered plate/nest offered as a choice | Plain input fallback + hint |
| Preselecting a lone option, or the "first" robot/profile | Violates "dropdowns never preselect a physical choice" | Always a blank placeholder |
| Accepting `{command, params}` in `tool.options` | Turns a read endpoint into a second `runCommand` | Enum id only; static-scan the registry |
| Using `unifiedName` as a nest value | Display-only in the core | `nestName` |
| Auto lane per `toolId` with no barrier | FAST starts with in1 (Section 4.2) | Explicit tag + barrier flag |
| A second copy of the busy loop per lane | 470 lines of modal/assignment/goto logic duplicated and diverging | Primary = legacy loop; side worker for tool steps only |
| Gating lanes on `.planning/config.json` or an async DB setting | Not in the image; breaks the sync claim discipline | Env var read once at construction |
| Letting any lane auto-abort/park on a sibling's failure | Software-initiated recovery (Out of Scope) | Freeze new dispatches only; in-flight steps finish; operator decides |
| `instanceof` checks on new lane/validation error classes in `run.create` | Dev-recompile drift (04-07) | `Error.name` guards |
| Repurposing `runAsynchronously` | Stored as literal `false` in every saved protocol | New `lane`/`laneBarrier` fields |

---

## 8. Scale / load considerations

| Concern | Today | v1.2 |
|---------|-------|------|
| Reads against the instrument | ~1 `get_status` per tool per 5 s heartbeat (`tools.ts startHeartbeat(5000)`) | options: <= 5 sources x TTL 15 s per tool, in-flight de-dupe; operator-driven only |
| Queue polling | busy loop 1.5 s; UI polls `getAll` 2 s, `runState` 2 s | + one side-lane worker per extra lane at 1.5 s (<= 3 extra); `pickEligible` is O(rows in active run), `queuedRowsSync()` is one synchronous SQLite read |
| `getAll` row size | full queue rows | + two small fields per row |
| SQLite | single writer, better-sqlite3 sync transactions | lane claims are sync transactions on the same connection; no contention beyond today's |

First bottleneck to watch: `queuedRowsSync()` per worker tick on a very large queue (hundreds of rows). Restrict the SELECT to the active run's rows if it ever shows up in profiling.

---

## 9. Integration points (consolidated)

### External services

| Service | Pattern | Notes |
|---------|---------|-------|
| STACK adapter (galago-tools `feat/stack-tool` `4ccd3da`) | 4 existing reads via `ExecuteCommand`, `READ_COMMANDS` bypass | Protos unchanged from `bcbbf8e`. After re-pin, `gen-interfaces` must regenerate with **no diff**; if there is a diff, stop (frozen proto, Out of Scope) |
| F.A.S.T. adapter (galago-tools, frozen `get_plates` commit TBD) | `fast.proto` oneof entry 11, `meta_data.plates` | Blocks the F.A.S.T. phase; contract file is the source of truth until frozen |
| stack-automation-layer | Reply shapes via the adapter's `to_dict()` | Local source: `/home/formulatrix/data/nikko/stack-automation-layer/stack_automation_layer/{results,knowledge}.py` |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `tool.options` to `Tool` | `Tool.forId(...).executeCommand` | same as `latchStatus`; error mapping inherited from `describeToolReply` |
| `tool.options` to `CommandQueue` | **none** | pinned absent |
| `CommandQueue` primary loop to side workers | shared fields on the one queue instance; no events | workers reconciled by primary each tick |
| `toolControl` to lanes | target resolved from running steps with a `runControl` entry | one controllable step invariant |
| `recoveryControl` to lanes | `runningStepFor(toolName)` | STACK acknowledge stays refused while any lane has a step on that tool |
| `RunStateMonitor` to lanes | `start` only for the controllable step; `stopIf(queueId)` | Pitfall L-2 |
| UI run page to lanes | `getAll` rows carry lane/barrier; client groups | no new query required |

---

## 10. Suggested build order (dependencies considered)

Order is the milestone's: STACK dropdowns, F.A.S.T. plates, lanes internals, lanes protocol/run page, live proof. Dependencies verified against the code:

**Phase 6 (suggested) — STACK dropdowns.** No cross-repo dependency (protos unchanged).
1. Re-pin `vendor/galago-tools` to `4ccd3da`; rerun `gen-interfaces` (ts-proto 1.151.1, scratch-dir plugin recipe from 05-01); assert **zero** generated diff. Run the full suite.
2. `server/toolOptions.ts` + parsers + caps + cache + timeout, with fixture replies copied from `results.py`/`knowledge.py` shapes (and a captured live reply from the PAC simulator if available). Tests first (pure).
3. `tool.options` procedure; static-scan pins (closed registry, no `CommandQueue`, no `controlCommand`, enum-only input).
4. `fieldOptions.ts` bindings + `deriveOptions` + `dependentsOf` (pure tests: cascade, ambiguous, empty tree, unknown saved value).
5. `OptionsSelect` + `useToolOptions`; wire the three render sites (tool page, modal, drawer-editing-only). Update nothing in `commandFields` or its tests.
6. UAT against galago-web + PAC simulator: born-empty, cascade, offline fallback, a saved protocol with an out-of-list value, simulated tool (expect fallback).

**Phase 7 (suggested) — F.A.S.T. plates.** Hard dependency: galago-tools ships `get_plates` and freezes the commit.
1. Re-pin, regenerate `fast.ts`, review the diff is exactly `GetPlates` + oneof entry 11 (existing field numbers unchanged, `expected_tray_id = 13` stays).
2. Add `fast.plates` to the registry (contract caps: max count, string lengths, integer ids >= 1); binding for `source_plate_id`/`dest_plate_id` with `valueKind: "number"`.
3. Tests: `commandFields.fast` has no `get_plates`; `fast.transfer` unchanged (12 fields); old saved steps load unchanged.
4. Live check: list returns while a (simulated) transfer holds the motion lock.
This phase is small once Phase 6's machinery exists; the real risk is the cross-repo gate, so plan it so the gate is the first task and everything else is unblockable.

**Phase 8 (suggested) — Lanes internals.** No UI, no protocol changes; all tests with fake tools.
1. `laneScheduling.ts` pure + `test/laneScheduling.test.ts` (eligibility table, the section 4.2 example, validation).
2. `SqliteQueue.claimEligible` + tests (STARTED excluded, FAILED retry allowed, row removed mid-claim).
3. `RunStateMonitor.stopIf` + test (a non-controllable step must not stop the controllable step's monitor).
4. `command_queue.ts` seams (4.4) with `_laneMode` forced via constructor option for tests (do not mutate `process.env` in tests).
5. `toolControl`/`recoveryControl`/`_recordAcceptedAbort` lane-awareness.
6. Lane-halt tests (4.5) and `lanesFlagOff.test.ts` golden transcript, captured **before** step 4.
7. Re-pin the one static scan; add the new pins.

**Phase 9 (suggested) — Lanes protocol surface + run page.**
`AdvancedParameters` fields; `galago.command` options; `validateLanes` in `createFromProtocol` (name-guard mapping); drawer Lane/barrier controls; `protocol.preview` lane grouping; `groupRowsByLane`; lane-aware `deriveRunOutcome`; docs (PROJECT.md single-flight section, todo resolution note). Depends on Phase 8 (needs a working engine to render against).

**Phase 10 (suggested) — Live proof (supervised, user present).**
Two-tool run: STACK goto-safe during the F.A.S.T. ~73 s transfer; lane-halt (induced failure on one lane freezes the other's next dispatch; in-flight step finishes); control bar still works on the side-lane F.A.S.T.; flag off is sequential; per-key one-shot ledger intact on both tools (each server sees only its own steps, no duplicate key). Motion from tests is out of scope (PROJECT.md): live only.

Ordering rationale: dropdown phases are independent of lanes and de-risk the shared `Tool` read path first. F.A.S.T. plates are gated cross-repo, so they sit after STACK (which has no gate) and can slip without blocking lanes. Lanes internals are done before any UI so the engine can be proven with fake tools and the flag-off golden transcript, which is the highest-risk item. The run page needs real lane rows to render. The live proof depends on all of it and on galago-tools being deployed.

---

## 11. Pitfalls found during integration research

| ID | Pitfall | Where | Consequence if missed | Mitigation |
|----|---------|-------|----------------------|------------|
| **L-1** | `startNext()` has no status filter and a STARTED row stays in `_queue` | `SqliteQueue.ts:112-150, :471` | A lane worker would re-dispatch the in-flight head (the F5 bug) | `claimEligible` excludes STARTED; per-lane loop guard |
| **L-2** | `RunStateMonitor.start()` begins with `this.stop()` | `runState.ts:126-128` | A non-controllable STACK step starting on another lane kills the F.A.S.T.'s poller and envelope; the control bar vanishes mid-transfer | Start only for the controllable step; `stopIf(queueId)` |
| **L-3** | `toolControl` targets `_runningStep` | `command_queue.ts:530` | With F.A.S.T. on a side lane, the operator cannot pause/abort it (Core Value) | Resolve target by `runControl` entry across lanes (4.6) |
| **L-4** | Lane alone has no cross-lane ordering | todo sketch | F.A.S.T. starts with `in1` | Mandatory `laneBarrier` + eligibility rule (4.2) |
| **L-5** | `_start` guard pinned as the first statement; `_recordFailure` pinned as the single failure site | `staticScan:462-486` | Naive lane code fails the scan or, worse, someone weakens it | Early-return line + re-pinned scan; reuse `_recordFailure` |
| **L-6** | `deriveRunOutcome` tests `last === "COMPLETED"` before `hasStarted` | `runOutcome.ts:49-52` | With lanes the last array row can complete while an earlier-lane row is still STARTED, so the run page shows COMPLETED early | Lane-aware variant used only when any row has a non-primary lane: require `!hasStarted && !hasCreated` for COMPLETED; legacy path untouched |
| **L-7** | `RunsComponent` embeds `CommandDetailsDrawer` read-only via `SwimLaneComponent` | `SwimLaneComponent.tsx:29-36` | Options queries fire from a read-only view during a run | Fetch only when `isEditing` |
| **L-8** | `failAndDequeueRun` / accepted abort dequeues the run remainder | `SqliteQueue.ts:574-588` | A sibling lane's STARTED row is deleted from `_queue` while running | Safe: `complete()` is an UPDATE + DELETE-no-op. Cover with a test; the catch's `rowRemoved` path already handles the reverse |
| **L-9** | Two failures overwrite the single `error` | `:434` | The first failure's text vanishes from the banner | Audit-log both; rows keep stored errors; optionally add a count |
| **L-10** | `recoveryControl` guard consults one step | `recoveryControl.ts:59` | STACK acknowledge allowed while STACK runs on a side lane | `runningStepFor(toolName)` |
| **D-1** | Contract points at `controlCommand` for reads | contract line 88 | Reply data discarded; static scan fails | Instance `executeCommand` |
| **D-2** | `commandFields.stack` is `toStrictEqual`-pinned | `test/commandFields.test.ts:80-96` | Test churn and weakened born-empty guarantee | Sibling binding map |
| **D-3** | Modal `handleSubmit` fills untouched number fields with `0` and text with `""` | `AddToolCommandModal.tsx:172-187` | An untouched `source_plate_id` saves as `0` (invalid plate id) | Treat `0` as unset in the plate binding and warn on save; STACK blanks are already dropped by the core (`_text_or_none`) |
| **D-4** | Simulated tools return no `meta_data` | STACK base `_dispatchCommand` sleep | Dropdown stays on fallback in simulated mode (looks like a bug) | Show "simulated tool returns no instrument data" |
| **D-5** | A gRPC call to a down tool has no deadline | `tools.ts` clients | Query hangs forever | 5 s race; cache nothing on failure |
| **D-6** | Every read logs through `logAction` | `tools.ts:393-405, :610-614` | Audit noise if polled | TTL cache, no `refetchInterval` |
| **D-7** | `tool.options` input is a free string `toolId` | `getToolFromDB` normalises names | A tool of the wrong type | Check `record.type` against the registry entry |
| **D-8** | Production build fatals on an eslint-disable for an undefined rule | PROJECT.md Key Decision (bf928c0) | `next build` fails in the container | Run `next lint`/build in the gate; no eslint-disable comments |

---

## 12. Open points to settle in phase discussion (not research gaps)

1. **Offline behaviour for plates/STACK lists:** this document recommends plain-input fallback and no stale list; the contract left it open.
2. **`refresh` exposure:** keep it behind an operator Refresh button only (not on first load); the contract asks whether `refresh` is needed at all.
3. **Banner for concurrent failures** (L-9): a count, or log-only.
4. **Lane cap and barrier validation strictness** (4.3): 4 lanes and "first parallel row must be a barrier" are recommendations.
5. **Whether `claimEligible` should live in `SqliteQueue` or as a transaction-wrapped sequence in `CommandQueue`:** recommend `SqliteQueue` (every other row mutation lives there).
6. **Controllable-step invariant** (4.6): confirm it is acceptable that two F.A.S.T. instances never overlap on lanes in v1.2.

## Sources

- `.planning/PROJECT.md`, `.planning/research/FAST-GET-PLATES-CONTRACT.md`, `.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md` (HIGH, required reading)
- `controller/server/command_queue.ts`, `server/utils/SqliteQueue.ts`, `server/tools.ts`, `server/runState.ts`, `server/runControl.ts`, `server/recoveryControl.ts`, `server/runs.ts`, `server/routers/{tool,command_queue,protocol}.ts`, `server/scripting/protocol-script-executor.ts` (HIGH, read at HEAD `60838a9`)
- `controller/components/{tools,protocols,runs}/…`, `pages/tools/[id].tsx`, `hooks/useRunControl.ts`, `types/run.ts` (HIGH)
- `controller/test/{staticScan,commandFields}.test.ts`, `test/helpers/fakeTool.ts` (HIGH; constraints that shape the design)
- galago-tools `origin/feat/stack-tool` `4ccd3da`: `tools/stack/server.py` (`READ_COMMANDS` :142, `ExecuteCommand` override :950, handlers, `_transfer_request` :341), `tools/fast/server.py:515` (HIGH)
- `/home/formulatrix/data/nikko/stack-automation-layer/stack_automation_layer/{results.py,knowledge.py,model.py,validation.py}` (MEDIUM: local checkout; reply shapes not verified against a captured live reply)

---
*Architecture research for: galago-core v1.2 (tool-inferred dropdowns + per-tool concurrency lanes)*
*Researched: 2026-11-05*
