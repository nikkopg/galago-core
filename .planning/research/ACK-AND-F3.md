# Research: STACK AcknowledgeFailure fit (DEP-03a) and F3 error path (DEP-03b)

**Researched:** 2026-10-28
**Branch/HEAD:** feat/stack-tool (57d55e9)
**Mode:** targeted integration research (research only, no source modified; unit suite run once as a baseline: 14 files, 244 tests, all pass, ~51 s)
**Method:** every claim is read from the code at the cited `file:line` (paths relative to `controller/` unless a repo is named). `[V]` = verified by reading the code at that line. `[I]` = inferred (stated with the reason). Nothing was run against an instrument or a real host.
**Overall confidence:** HIGH for the code facts, MEDIUM for UI placement, LOW for one thing: why the live F3 run (fast-mcp runbook :336-339) showed no error text at all (section 4.5).

---

## 0. Verdicts

| # | Question | Verdict |
|---|----------|---------|
| 1 | Add `stack` to `runControl`? | **No.** It would switch on the run-state poller, the run-page ControlBar, the Stop/Clear All/delete-run abort-first interception and `commandQueue.toolControl` for STACK steps. The interception has no STACK abort to offer, so Stop, Clear All and run delete would hit a dead-end modal for the length of a transfer (section 1.2). Use a **separate recovery-only spec** (new zero-import module), keyed by tool type, with two new param kinds (`confirmYes`, `guid`). `runControl` stays `{ fast }`, pinned by an existing strict-equal test (`test/runControl.test.ts:12-18`). |
| 2 | Where does the queue refuse a queued `stack.acknowledge_failure`? | **Both**: (a) enqueue time in `RunStore.createFromProtocol` right after `generateCommandsFromProtocol` (`server/runs.ts:216`), which covers visual, script, REST and tRPC run creation and refuses the whole run before anything is queued; (b) execute time at the top of the **instance** `Tool.executeCommand` (`server/tools.ts:408`), keyed on the Tool's real type, which covers the queue, `tool.runCommand`, "Send to Tool", the protocol "run command" button, and rows already sitting in SQLite. `controlCommand` (`tools.ts:376`) is a different method, so the operator path is untouched. One zero-import table drives both. Include fast `pause/resume/abort` in the table (decision flagged in 2.4). |
| 3 | Latched guid display | Primary: the F3 error text on the failed step card (today it is shown nowhere per step). Secondary: a **dedicated `tool.latchStatus` query** (not generic `runCommand`) rendered in the STACK Run Recovery card behind an explicit "Read latch" button, no polling. The tool page's generic command panel cannot show any reply `meta_data` today (`pages/tools/[id].tsx:107-130`), so STACK reads are invisible there until a result display is added (section 3.3). |
| 4 | F3 | ERROR_FROM_TOOL text does reach the run-page banner when the queue is FAILED and the banner was not dismissed. Seven verified loss/misleading points, ranked in 4.4. The two that can hide a STACK latch guid: **non-ERROR_FROM_TOOL codes drop the tool's text** (`tools.ts:604-615`, `routers/command_queue.ts:27-38`) and **a dismissed banner is never re-armed** (`RunsComponent.tsx:76,290`). SUCCESS plus a non-empty `error_message` does throw (`tools.ts:637-646`). No path renders a failed step as COMPLETED; skipped-after-failure renders as a COMPLETED run (4.3). |

**Proto / core gap flags (these would stop the work): none found.** The proposed `AcknowledgeFailure { optional string guid = 1; optional string arm_inspected = 2; }` fits `Tool.controlCommand` as is (`tools.ts:359-365, 376-389`). Assumptions that galago-tools Phase 4 must honour are in section 6.3. One cross-repo correction (galago-tools SUMMARY says galago-core calls `EstimateDuration` per step at run creation; in this repo nothing calls it) is in 6.2.

---

## 1. Acknowledge fit

### 1.1 What exists today (the D-20 / recovery template)

- `runControl` is `{ fast: { pause: {}, resume: { is_tip_broken: "yesno" }, abort: { return_liquid: "yesno" } } }`, deep-frozen (`server/runControl.ts:34-40`). Decision kinds are only `"yesno"` (`:6`); `validateControlRequest` requires every declared decision to be exactly `"yes"` or `"no"` and rejects any undeclared param (`:127-156`). It has no free-text kind. [V]
- `recoveryControl` hard-codes `RECOVERY_ACTIONS = ["resume","abort"]` (`server/recoveryControl.ts:17`), refuses other actions first (`:40-48`), refuses when the queue's running step is on the same tool (`:52-60`, via `CommandQueue.global.runningStep`, `routers/tool.ts:529`), then reuses `validateControlRequest(toolType, ...)` (`:64`) and calls `tool.controlCommand(action, verdict.decisions)` once with no deadline (`:78`). Every outcome is logged through `logAction` (`:42-46, 54-58, 66-70, 81-85, 97-101`). [V]
- The tRPC input already fits: `action: z.string()`, `params: z.record(z.unknown()).optional()` (`routers/tool.ts:513-520`), deliberately unrestricted so refusals are logged (`:508-512`). **No schema change is needed** for `{ guid, arm_inspected }`. [V]
- `Tool.controlCommand` builds `{ [this.toolType]: { [action]: params } }` through `_payloadForCommand` (`tools.ts:359-365, 376-383`), so it yields `{ stack: { acknowledge_failure: { guid, arm_inspected } } }` for a `stack` tool with no code change; it returns `{ ok: response === SUCCESS, response, message: reply.error_message }` and drops `meta_data` (`:384-388`). Its param type is `Record<string,string>` (`:376`), which already fits a string guid. The payload only reaches the wire after DEP-02 regenerates `tool_base.ts` (ts-proto drops unknown oneof keys). [V for the builder, I for the encode behaviour; same dependency `test/wire.test.ts:20-48` already demonstrates for fast]
- The client send gate is `createConfirmedSender` (`components/runs/controlDecision.ts:292-373`). Its recovery branch accepts only `RECOVERY_UI_ACTIONS = ["resume","abort"]` (`:245, 336`), looks the spec up in `runControl` via `getActionSpec` (`:340`) and completes only yes/no values via `completeDecisions` (`:65-78`). [V]
- The recovery card is `RunRecoverySection`: visible iff `getRunControl(toolType)` exists (`controlDecision.ts:378-380`, `RunRecoverySection.tsx:44-46`), with two hard-coded buttons Resume / Abort (`:65-80`) and copy about resuming or aborting (`:61-64`). The shared modal renders only yes/no radios per spec key (`RunControlConfirmModal.tsx:233-250`). [V]

### 1.2 Option A (rejected): add `stack` to `runControl`. Exhaustive side effects

Every consumer of `runControl` / `getRunControl`, from `grep` over `controller/` (non-test):

| # | Consumer (file:line) | What happens if `runControl.stack` exists | Effect for STACK |
|---|----------------------|-------------------------------------------|------------------|
| 1 | `server/runState.ts:129-132` (`RunStateMonitor.start`) | A 2 s `getStatus` poller starts for every STACK step (`:150-155, 186`) | Extra gRPC load on the STACK tool server during a transfer (STK-05 wants reads to stay cheap); the adapter has no `run_state`, so the envelope sits at `status:"ok", runState:null` or `"unknown"`. |
| 2 | `components/runs/controlDecision.ts:84-92` (`shouldShowControlBar`), used at `RunsComponent.tsx:620` | The run-page ControlBar appears on every running STACK step | `ControlBar.tsx:131-174` renders hard-coded Pause / Resume / Abort buttons unconditionally; with `runState:null` all three are enabled (`controlDecision.ts:102-104`); each opens the shared modal for an action `getActionSpec("stack", ...)` does not have, so the modal says "This action is not available for this tool" (`RunControlConfirmModal.tsx:227-229`). Three dead buttons next to a moving arm. |
| 3 | `components/runs/stopInterception.ts:16-29`, used at `status/QueueStatuscomponent.tsx:62,73` and `RunsComponent.tsx:439,453-455` | Stop ("Pause queue"), Clear All and delete-run on a running STACK step are intercepted by `InstrumentStopModal` ("Abort Instrument Run") | The modal's spec is `getActionSpec("stack","abort")`, which is undefined (`stopInterception.ts:37-39`, `InstrumentStopModal.tsx:52-58`), so Confirm is disabled (`RunControlConfirmModal.tsx:263`). The operator cannot Stop, Clear All or delete the run until the transfer ends (up to the adapter's wait budget, 600 s default per galago-tools SUMMARY). This is a regression against the status quo, where Stop/Clear act on the queue directly. |
| 4 | `server/command_queue.ts:501-592` (`toolControl`) via `validateControlRequest(step.toolType, ...)` (`:506`) | `commandQueue.toolControl("acknowledge_failure", ...)` becomes valid whenever a STACK step runs | A second server path to the acknowledge, outside the recovery card and its "refuse while tracked" rule. `toolControl` is an open tRPC mutation (`routers/command_queue.ts:152-161`). Violates "recovery card only". |
| 5 | `controlDecision.ts:378-380` (`shouldShowRecoverySection`) | The card shows for `stack` | Wanted, but it then renders Resume/Abort for STACK (`RunRecoverySection.tsx:65-80`) with no spec behind them. Needs a per-type action list anyway. |
| 6 | `controlDecision.ts:21-23` (`headMovesNote`) -> `server/runControl.ts:56-65` (`actionMovesHead`) | Undeclared tool type / action "fails toward warning": the ack modal says "The instrument head will move." (`RunControlConfirmModal.tsx:161,232`) | Wrong for an acknowledge. Needs `runControlMovesHead.stack.acknowledge_failure=false` and ack-specific copy. |
| 7 | `controlDecision.ts:30-39, 183-216, 221-238` (`toolDisplayName`, `confirmHeader`, `successTitle`, `decisionLabel`, `restateChoice`) | All fall back to raw strings | Modal reads "Acknowledge_failure the stack run. Arm_inspected: Yes." and the toast title is `acknowledge_failure`. Needs copy entries. |
| 8 | `controlDecision.ts:65-78` (`completeDecisions`), `:250-255` (`ConfirmedControlRequest.decisions`), `server/runControl.ts:127-141` | Only `"yes"`/`"no"` values can pass | A free-text guid cannot be expressed. Widening `ControlDecisionValue` to string would loosen the fail-closed gate for fast too. |
| 9 | `components/runs/RunRecoverySection.tsx:48`, `controlDecision.ts:391-399` (`isToolTrackedByRunningStep`) | n/a (this is a side effect of NOT adding stack, see 1.4) | -- |
| 10 | `test/runControl.test.ts:12-18` | `toStrictEqual({ fast: ... })` fails | Intentional pin; adding `stack` means deliberately editing the test, which is the point of the pin. |

Net: Option A needs custom handling in rows 2, 3, 5, 6, 7, 8 and still leaves rows 1 and 4 as hazards. The `runControl` map means "an instrument step in flight can be paused/resumed/aborted from the run page" (header comment `runControl.ts:1-4`); the STACK has none of those in v2, so it does not belong there.

### 1.3 Option B (recommended): recovery-only spec, keyed by tool type

**New zero-import module `server/recoveryActions.ts`** (zero imports like `runControl.ts` and `toolKey.ts`, so `controlDecision.ts` and tests can import it as a value on the client; the existing rule is `controlDecision.ts:1-10`):

```ts
export type RecoveryParamKind = "yesno" | "confirmYes" | "guid";
// yesno      : exactly "yes" or "no" (today's kind; fast resume/abort)
// confirmYes : exactly "yes"; "no", "", " yes", "Yes", true, undefined all refused
// guid       : non-empty string, no whitespace or control chars, bounded length; never trimmed or coerced
export const recoveryActions = deepFreeze({
  fast:  { resume: <from runControl.fast.resume>, abort: <from runControl.fast.abort> },
  stack: { acknowledge_failure: { guid: "guid", arm_inspected: "confirmYes" } },
});
export function getRecoverySpec(toolType, action)      // own-property lookups, like getRunControl/getActionSpec
export function listRecoveryActions(toolType): string[]
export function isRecoveryAction(toolType, action): boolean
export function validateRecoveryRequest(toolType, action, params)
  // same refusal order and codes as validateControlRequest (:87-93): (b) type has no recovery actions
  // -> PRECONDITION_FAILED; (c) action not declared -> BAD_REQUEST; (d) a declared param fails its
  // kind -> BAD_REQUEST; (e) any undeclared param -> BAD_REQUEST. Returns { ok, params: Record<string,string> }.
export const RECOVERY_STRICT_SUCCESS = { stack: ["acknowledge_failure"] }  // see 1.5
```

Why derive `fast` from `runControl.fast.resume/abort` instead of copying: one source of truth for the F.A.S.T. decision names, plus a test that pins `recoveryActions.fast` equals the picked entries so the two cannot drift. Why not extend `RunControlDecisionKind` (`runControl.ts:6`): that type describes the live path; widening it would make `validateControlRequest` and `getActionSpec` consumers face kinds they cannot handle, and a future edit that put `stack` into `runControl` would silently gain a free-text kind. Keeping kinds in the recovery module keeps `validateControlRequest` (running path) untouched and fail-closed.

Guid check: reject, do not trim (same principle as `runControl.ts:131-132`: "Never trim, case-fold, default or coerce"). Suggested pattern: `^[^\s\u0000-\u001f\u007f]{1,256}$`. [I] on the exact charset: the guid is "a task guid, or `submit-<hex>`" (galago-tools SUMMARY, proposed proto comment :368-371); a stricter pattern risks blocking a legitimate ack, so keep it permissive and let the core's exact-guid check be the real gate (SUMMARY Pitfall 5, :294-298).

**Changes by file**

| File | Change | Why |
|------|--------|-----|
| `server/recoveryControl.ts` | Replace `RECOVERY_ACTIONS` check (`:40-48`) with `isRecoveryAction(toolType, action)` and a type-aware message; replace `validateControlRequest` (`:64`) with `validateRecoveryRequest`; send `verdict.params` (`:78`). Keep the "refuse while this tool's step is running" rule (`:52-60`) but give STACK its own message. Keep logging at all outcomes. Add the strict-success rule (1.5). | The same audited, no-deadline, one-attempt path serves F.A.S.T. and STACK. Refuse-while-running stays correct for STACK: a latch only exists after the step ended. |
| `routers/tool.ts:513-533` | No schema change. Update the comment at `:508-512` ("RECOVERY_ACTIONS") to point at the new module. Add the `latchStatus` query (section 3). | `z.string()` / `z.record(z.unknown())` already carry the new params. |
| `components/runs/controlDecision.ts` | (1) Replace `RECOVERY_UI_ACTIONS` (`:245`) and the recovery-branch check (`:336`) with `isRecoveryAction`. (2) In the recovery branch use `getRecoverySpec` and a new pure `completeRecoveryEntries(spec, decisions, params)` returning `Record<string,string>|null` instead of `getActionSpec`+`completeDecisions` (`:340-344`). (3) Add `params?: Readonly<Record<string,string>>` to `ConfirmedControlRequest` (`:250-255`) for data entries (the guid); keep `decisions: Readonly<Record<string, ControlDecisionValue>>` unchanged so the existing scan (`staticScan.test.ts:228-233`) still holds. (4) Add copy: `TOOL_DISPLAY_NAMES.stack = "STACK"` (`:30-32`), `CONFIRM_HEADERS.acknowledge_failure = "Acknowledge STACK failure"` (`:183-187`), `SUCCESS_TITLES.acknowledge_failure = "STACK failure acknowledged"` (`:195-199`), `DECISION_LABELS.arm_inspected = "Arm inspected?"` (`:207-210`), an `acknowledge_failure` branch in `restateChoice` (`:221-238`) that restates the typed guid and the choice, and `headMovesNote` returns null for `acknowledge_failure` (add `runControlMovesHead`-style entry or a recovery-only flag; the note "The instrument head will move" must not appear). (5) `shouldShowRecoverySection` (`:378-380`) becomes `listRecoveryActions(toolType).length > 0`. | Keeps the single confirmed-send path (`createConfirmedSender`) as the only sender, which `staticScan.test.ts:188-269` pins. |
| `components/runs/RunControlConfirmModal.tsx` | Extend `RunControlConfirmModalRequest` (`:55-59`) with optional `params`; build the spec from `getRecoverySpec` when `target.kind === "recovery"`; render per kind: `yesno` as today (`:233-250`), `confirmYes` as the same Yes/No radios with nothing preselected where choosing "No" keeps Confirm disabled (the "no" never leaves the client; the server refuses it too), `guid` shown read-only from `request.params.guid` (not an input here). `canConfirm` (`:162`) uses the recovery completion. No `<form>`, no `autoFocus` (the scan forbids them, `staticScan.test.ts:358-362`); initial focus stays on Cancel (`:155, 218`). | Reuses the shared modal so remount-on-new-request (`:107-124`) keeps the confirmation born empty (D-07). |
| `components/tools/RunRecoverySection.tsx` | Render buttons from `listRecoveryActions(toolType)`. For `stack`: a guid `Input` (state `""`, no default, no `onKeyDown`/`onSubmit`), the latch block (section 3), and one button "Acknowledge failure..." disabled until the guid passes the same client check as the server; it opens the shared modal with `request.params = { guid }`. Clear guid and latch result on an accepted send via the existing `afterAccepted` prop (`RunControlConfirmModal.tsx:71`). Copy is per tool type. | Guid entry in the card (not in the modal) lets the operator copy it from the failed step / latch read and see it restated in the modal before confirming. |
| `hooks/useRunControl.ts` | No change to the send hook: `recoveryMutation` (`:26`) already forwards `params`. Widen only the `sendRecovery` param type (`controlDecision.ts:277-281`) from `ControlDecisionValue` to `string`. | Keeps `hooks/useRunControl.ts` the only client file that references `recoveryControl` (scan `:191-197`). |
| `server/runControl.ts`, `server/runState.ts`, `ControlBar.tsx`, `stopInterception.ts`, `InstrumentStopModal.tsx`, `QueueStatuscomponent.tsx`, `command_queue.ts toolControl` | **No change.** | They stay F.A.S.T.-only by construction. |

### 1.4 Side effects of NOT adding `stack` to `runControl` (Option B consequences)

1. `commandQueue.runState` is `{ running:false }` for STACK steps (`runState.ts:129-132`), so the run page shows no control bar, and `RunRecoverySection`'s `tracked` flag (`:48`, from the envelope via `isToolTrackedByRunningStep`, `controlDecision.ts:391-399`) is never true for a STACK tool. The server still refuses an ack while a STACK step is running (`recoveryControl.ts:52-60` reads `runningStep`, which is set for every tool step, `command_queue.ts:1305`). Result: the card buttons are not greyed during a STACK step; a click gets a persistent "Action refused" toast with the server message (`controlDecision.ts:313-318`, `hooks/useRunControl.ts:44-46`). Recommendation for v2: accept it and make the server message STACK-specific ("A run step is running on this tool; acknowledge after it ends"). Optional later: a small `commandQueue.runningStep` query for the card (the getter exists, `command_queue.ts:278-280`). [V]
2. Stop / Clear All / delete-run on a running STACK step keep acting on the queue directly (status quo for non-controllable tools). The arm keeps moving; the busy loop treats the removed row as handled (`command_queue.ts:1366-1379`). Not new, but worth an operator note in the STACK runbook (no STACK abort from Galago in v2). [V]
3. A failed STACK step stays queued and the next Start re-runs it (`SqliteQueue.ts:493-508`, `command_queue.ts:1323-1326`), which is by design (adapter ledger handles it). The ack never happens on retry; only the operator's card action clears the latch.

### 1.5 SUCCESS-with-message on the control path

`controlCommand` reports `ok` purely from the response code (`tools.ts:385`). A SUCCESS reply carrying an `error_message` would be shown as an accepted action with the message as the toast description (`controlDecision.ts:306-311`). The adapter contract says SUCCESS has an empty message (galago-tools REQUIREMENTS STK-07), and the queue path already treats SUCCESS+message as an error (`tools.ts:637-646`). For the ack only (so F.A.S.T. behaviour is unchanged), treat SUCCESS with a non-empty message as a refusal in `recoveryControl` (result `ok:false`, logged at warning). Scope it with the `RECOVERY_STRICT_SUCCESS` flag rather than changing `controlCommand` (its F.A.S.T. callers are pinned by tests).

### 1.6 Static-scan and test additions for the acknowledge

Existing pins that stay green (verified in `test/staticScan.test.ts`): single send path (`:188-269`), no timers (`:287-292`, add the new files to `controlUiModules`, `:275-285`), no countdown modal (`:294-327`), no queue-modal coupling (`:329-339`), no instrument-state check (`:341-356`), no Enter-bound default (`:358-362`).

Add:

1. **Where the literal lives.** Scan every non-test `.ts/.tsx` under `controller/` (skip `gen-interfaces`, as `walk` does, `:12`): the string `acknowledge_failure` may appear only in `server/recoveryActions.ts`, `server/operatorOnlyCommands.ts`, `components/runs/controlDecision.ts` (copy), and, after DEP-02, never in `components/tools/constants.ts`. Pin the exact file list like `:196`.
2. **Not in commandFields / not in runControl.** `commandFields.stack?.acknowledge_failure` is undefined; `Object.keys(runControl)` stays `["fast"]`.
3. **Guard is on the generic path, not the control path.** `extractBracedRegion` of the instance `async executeCommand(command: ToolCommandInfo)` in `server/tools.ts` contains `isOperatorOnlyCommand(`; the `controlCommand` body does not.
4. **No Enter-bound default on the card.** Extend the pattern scan at `:358-362` to `components/tools/RunRecoverySection.tsx` and add `onKeyDown|onKeyPress|onKeyUp|onSubmit|type="submit"`.
5. **The latch read never feeds the send.** `recoveryControl.ts`, `controlDecision.ts`, `RunControlConfirmModal.tsx`, `hooks/useRunControl.ts` must not match `/latch/i` (read is display only, UI-08 "no state checks"). Add `latch` to the existing pattern at `:342`, which already forbids `runState|getStatus|.status` in `recoveryControl.ts`.
6. **Single read of the latch query.** Only the card file references `tool.latchStatus` (mirrors `:199-205`).
7. **No self-acknowledge anywhere.** The only `.controlCommand(` callers stay `command_queue.ts:1` and `recoveryControl.ts:1` (`:235-254`); the only `recoveryControl({` router stays `routers/tool.ts` (`:264-267`).

Unit tests (all pre-codegen, string types only): `validateRecoveryRequest` refuses `arm_inspected` of `"no"`, `""`, `" yes"`, `"Yes"`, `true`, missing; refuses blank / whitespace / oversize / non-string guid; refuses undeclared params; refuses `fast` pause; refuses `stack` resume/abort. Router test mirroring `test/recoveryControl.test.ts:67-86` with `installFakeTool("stack-1", "stack" as ToolType)`, asserting `executeCommand` called once with exactly `{ stack: { acknowledge_failure: { guid, arm_inspected: "yes" } } }`, never retried, logged with `outcome=`. Refusal while a STACK step is running. SUCCESS-with-message becomes a refusal. `createConfirmedSender`: ack ignored without a complete guid or without `"yes"`; one flight at a time; the ERROR_FROM_TOOL message passes through verbatim to `notify.refused`.

---

## 2. Queue-side refusal of `stack.acknowledge_failure`

### 2.1 Every way a command reaches a tool (verified)

| Path | Entry | Reaches `Tool.executeCommand`? |
|------|-------|--------------------------------|
| Visual protocol run | `routers/run.ts:78` / `pages/api/runs/index.ts:12` -> `createFromProtocol` -> `generateCommandsFromProtocol` visual branch (`server/runs.ts:96-113`) -> `enqueueRun` (`:243`, `command_queue.ts:1415-1434`) -> busy loop `executeCommand` (`command_queue.ts:486-489, 1308`) | yes (`tools.ts:391-405` -> `:408`) |
| Script protocol | same entry; `executeProtocolScript` `galago.command(toolId, command, params)` emits any command with `toolType:"unknown"` (`server/scripting/protocol-script-executor.ts:21-33`), then `resolveToolTypes` fills the type by tool name (`runs.ts:82-89`, `server/scripting/resolve-tool-types.ts:7-40`) | yes |
| Rows already in SQLite | restart / retry of a FAILED row (`SqliteQueue.ts:493-508`), `gotoCommand` re-queue | yes |
| "Send to Tool" on a step card | `components/runs/list/SwimLaneCommandComponent.tsx:33,135` -> `tool.runCommand` | yes (`routers/tool.ts:495-506`) |
| Protocol "run command" button | `components/protocols/ProtocolDetailView.tsx:157,441` -> `tool.runCommand` | yes |
| Tool page command panel | `pages/tools/[id].tsx:99,133-144` -> `tool.runCommand`; options come from `commandFields` (`:51-52,329-333`) | yes |
| Protocol builder | `AddToolCommandModal.tsx:125,154-160` reads `commandFields` too | n/a (authoring) |
| Imported protocol JSON / hand-edited | any `{toolId, toolType, command}` | yes; note `toolType` in the stored JSON is not trusted: the payload key is the Tool instance's own type (`tools.ts:359-365`) |
| Operator control | `recoveryControl` / `toolControl` | **no**: `Tool.controlCommand` calls `grpc.executeCommand` directly (`tools.ts:376-389`) |

Hiding the command from `commandFields` (the D-20 mechanism) only removes it from two editors; it does nothing for imported JSON, scripts, existing queue rows, or any direct tRPC call (`tool.runCommand` has `command: z.string()` and no allow-list, `routers/tool.ts:495-503`). That is the gap SUMMARY Pitfall 5 (galago-tools :294-298) warned about.

### 2.2 Recommendation

One zero-import table, two enforcement points.

**`server/operatorOnlyCommands.ts`** (zero imports):

```ts
export const operatorOnlyCommands = deepFreeze({
  stack: ["acknowledge_failure"],
  fast:  ["pause", "resume", "abort"],   // decision flagged in 2.4
});
export function isOperatorOnlyCommand(toolType: string, command: string): boolean // own-property, case/whitespace-insensitive on command
export class OperatorOnlyCommandError extends Error {}  // NOT a ToolCommandExecutionError
```

1. **Authoritative: execute time, top of instance `Tool.executeCommand` (`server/tools.ts:408`, before variable substitution `:411-438`).** Compare against `String(this.toolType)` (not `command.toolType`, which comes from stored JSON), `logAction({ level:"warning", action:"Operator-Only Command Refused", details:"toolId toolType command stage=execute" })`, then throw `OperatorOnlyCommandError("... is an operator action and cannot run from a protocol or the queue; use the tool page Run Recovery card")` before any gRPC. Use `String(this.toolType)` and string literals so it compiles before `ToolType.stack` exists (comparing the enum to `"stack"` is a TS2367 error). Because the guard sits in the instance method, it covers the queue (`command_queue.ts:487`), `tool.runCommand`, "Send to Tool", the protocol button, rows already queued and any future caller; the static wrapper logs "Executing command" first (`tools.ts:392-396`), which is a harmless extra line.
2. **Early: enqueue time, in `RunStore.createFromProtocol` right after `generateCommandsFromProtocol` (`server/runs.ts:216`) and before the run is stored or enqueued (`:239-243`).** Throw `OperatorOnlyCommandError` naming the step index, tool and command, and add it to the rethrow list (`:248-252`; otherwise the catch wraps it in `ProtocolGenerationFailedError`, whose constructor builds a message from a "protocolId" argument and replaces the text, `:282-287`). Map it in `routers/run.ts` next to `:89-93` to `TRPCError BAD_REQUEST` with the error's own message (that handler currently replaces `ProtocolGenerationFailedError`'s message with a generic sentence, `:92`), and in `pages/api/runs/index.ts:14-23` to a 400. Optional: run the same check in `protocol.preview` (`server/routers/protocol.ts:250-290`, which already returns `{ success:false, error }`) for authoring feedback. Nothing is queued, so there is no FAILED row to clean up. The declared `toolType` in a visual step can be wrong, so the enqueue check can miss a mislabelled step; the execute-time guard still refuses it with nothing sent. That layering is intentional.
3. **Do not** put it only in `command_queue.executeCommand` (`:486`) or the busy loop (`:1296`): it would miss `runCommand`, "Send to Tool" and the protocol button. **Do not** put it in `controlCommand`: that is the operator path.

### 2.3 How the refusal surfaces and is audited

- Enqueue: a `BAD_REQUEST` with the step/tool/command in the message, shown by the run-creation UI (`NewProtocolRunModal`, tRPC `run.create`); audit line `Operator-Only Command Refused ... stage=enqueue protocolId=... step=N`.
- Execute from the queue: the thrown error goes down the existing failure path: row FAILED and stays queued (`command_queue.ts:1354`, `SqliteQueue.ts:500-508`), queue state FAILED with `this.error` (`:1382-1383`), log "Command Failed" with the message (`:1385-1393`), Slack/email alert (`:1395-1402`), banner on the run page. Because a failed row is retried on the next Start, it fails again until the operator Skips it (the card menu offers Skip for FAILED rows, `SwimLaneCommandComponent.tsx:69-71,119-126`); acceptable, and the enqueue check means it should not normally get that far.
- **Do not use `INVALID_ARGUMENTS`, `NOT_READY`, `WRONG_TOOL` or `UNRECOGNIZED_COMMAND`** for this error: `getError` replaces the message with a generic sentence for those codes (`routers/command_queue.ts:27-38`), which would hide the reason (this is also an F3 defect, 4.2 item 1). A plain `Error` subclass is returned as-is and its message is shown (`:51-52`, `RunsComponent.tsx:242-244`).
- `tool.runCommand`: a tRPC error with the message; the tool page toast shows it (but only for 10 s, see 3.3).

### 2.4 Should the same guard cover fast abort/resume? (user decision)

Today only the editors hide them: D-20 removed `abort`/`resume` from `commandFields.fast` (commit d4c3c23); `pause` was never there (`test/runControl.test.ts:29-35`). The commit message records that legacy saved steps "still resolve ... nothing is migrated (known limitation)". Without the guard a script, an imported protocol or an old saved step can still make the queue send a fast abort/resume, which contradicts the Core Value (PROJECT.md :11-16: "the web app never pauses, resumes or aborts an instrument on its own"). **Recommendation: include `fast: ["pause","resume","abort"]` in the same table**, since it is one line of data and the mechanism is generic, and it turns a known limitation into an explicit, audited refusal. It is a behaviour change for any saved protocol that contains such a step (it will be refused instead of executed); none exist in this repo (`grep` found none outside `.planning`), but the live DB is not visible from here. If you prefer to keep this milestone STACK-only, ship the table with only `stack` and add the fast entries as a separate change. Existing tests are unaffected: `toolControl`/`recoveryControl` tests use `controlCommand`, `wire.test.ts` calls `_payloadForCommand`, and the `pause` steps in `toolControl.test.ts:174-186` / `runState.test.ts:575-590` are Tool Box.

Tests: guard refuses `stack.acknowledge_failure` from a queued row, from `runCommand`, from `createFromProtocol` (visual and script), with zero `grpc.executeCommand` calls and a log row; mislabelled `toolType` in the stored step is still refused at execute; `controlCommand` for the same action is not refused; case/whitespace variants refused; inherited names (`toString`, `constructor`) are not treated as listed.

---

## 3. Latched guid display

### 3.1 Where the guid is visible today (from the ERROR_FROM_TOOL message)

The adapter puts reason + guid in a one-line `ERROR_FROM_TOOL` message (galago-tools REQUIREMENTS STK-07). The text becomes `Error from tool "<toolId>": <message>` (`tools.ts:617-621`) and is thrown as `ToolCommandExecutionError` (`:634`). It is visible:

| Surface | Where | Notes |
|---------|-------|-------|
| Run-page error banner | `RunsComponent.tsx:227-297` (rendered at `:542`) | Only while queue state is FAILED and the banner was not dismissed (`:230`); gone after Start/Resume/Clear All clears `this.error` (`command_queue.ts:884, 815-818, 863-871`) and after a galago-web restart. See 4.2. |
| Logs page | `logAction` "Tool Command Execution Error" (`tools.ts:628-632`) and "Command Failed" (`command_queue.ts:1385-1393`); read by `server/routers/logging.ts`, page `pages/logs/index.tsx` | Persistent, searchable by action. |
| Slack / email alert | `_notifyFailure` `Error: ${errMsg}` (`command_queue.ts:239-247`) | Only if integrations are configured. |
| Failed step card | **nowhere.** `SwimLaneCommandComponent.tsx:62-63,93` colours the card red; nothing reads `command.error` (verified by grep over `components/ pages/ hooks/ utils/`) | The data exists: `fail()` stores the Error on the row (`SqliteQueue.ts:505`) and it round-trips with `.message` (`test/sqliteQueue.test.ts:137, 384`). |
| Tool page | `runCommand` errors only, as a 10 s toast (`pages/tools/[id].tsx:125-130`, `components/ui/Toast.tsx:99-105`) | The guid disappears after 10 s. |

### 3.2 Latch-status read: how the tool page runs a command today

The page's panel calls `trpc.tool.runCommand` with `{ toolId, toolType, command, params }` (`pages/tools/[id].tsx:99-144`) -> `Tool.executeCommand` (`routers/tool.ts:505`, `tools.ts:391-405`). On SUCCESS with `return_reply` and no message the full reply is returned (`tools.ts:635-636`), including `meta_data` (the generated decoder unwraps the Struct to a plain object, `gen-interfaces/.../tool_base.ts:1225`; the comment at `server/runState.ts:52-55` says the same). **But the page discards it**: `onSuccess` resolves the promise and the toast says "Command completed successfully" (`[id].tsx:107-113, 127`). So no STACK read result (STK-03/04, or the latch) is visible on the tool page today. Other places that read `meta_data` are scripts (`components/scripts/CodeEditor.tsx:360`) and the PF400 teach pendant (`TeachPendant.tsx:166`). [V]

### 3.3 Recommendation and placement

1. **Primary (F3): show the failed step's error on its card** (section 4.4 item 5). It is where the operator is when the failure happens, survives restarts, and carries the guid in the text with no extra command.
2. **Secondary: "Latched failure" block inside the STACK Run Recovery card**, above the guid input:
   - A button "Read latch" (explicit click, no polling, no timer; `RunRecoverySection` is in the no-timers scan, `staticScan.test.ts:284`). Result shown read-only: guid (selectable), kind and explanation when present, raw JSON in a collapsible for unknown shapes, and a plain "No failure latched" when the read says so.
   - A "Use this guid" button that copies the read value into the guid input. It never sends and never auto-fills; the operator still has to press "Acknowledge failure..." and answer the modal. The guid is data, not a decision, so this is not a "default" in the PROJECT.md sense (constraint "Choices non-defaulted", :129-131), but keep it an explicit click.
   - The read result must never gate or enable the ack button (UI-08: no instrument-state check; the core gates; the card disables only on an empty/invalid guid and, as today, never on instrument state).
3. **Backed by a dedicated `tool.latchStatus` query, not generic `runCommand`.** Reasons: (a) `runCommand` validates `toolType` against the generated `ToolType` enum (`routers/tool.ts:15, 499`), which does not contain `stack` until DEP-02, so the read cannot be built or tested before codegen; a `toolId`-only procedure derives the type from the DB row exactly like `recoveryControl` (`:522-523`) and is testable with `installFakeTool("stack-1","stack" as ToolType)` now; (b) the server sends only one fixed command constant (`LATCH_READ_COMMAND`, a single string in `recoveryActions.ts`, e.g. `"get_failure_latch"`, to be set when galago-tools Phase 4 names it), so the card cannot be used as a generic command sender; (c) the server returns `{ meta }` shaped for the panel instead of the whole reply. It should call `tool.executeCommand(...)` (so SUCCESS-with-message and error mapping behave as everywhere else) and, being a read, needs no recovery audit beyond the existing "Tool Command Execution" log (`tools.ts:392-396`). A pure `extractLatch(meta)` in the same zero-import style tolerates unknown shapes (looks for a string `guid` at the top level, under `latch`, or under `result`) and is unit-testable without proto.
4. **Also add a reply display for reads on the generic tool-page panel** (STK-03 "operator can read manager state ... in the reply meta"): render `data.meta_data` as JSON under the command form. This is needed for the STACK reads regardless of the latch and is part of the DEP-02/GAL-01 usability, not of the ack. Keep it out of the first ack plan if scope is tight; flag it for the roadmap.
5. Use `persistentErrorToast` (`Toast.tsx:349-359`) for `runCommand` errors on the tool page (or add an `errorDuration` option to `loadingToast`, `:60-118`) so a guid in an error is not lost after 10 s.
6. Optional: when the banner's failing tool is a STACK, add a link to `/tools/<toolId>` in the banner so the operator lands on the card.

---

## 4. F3: where a tool's ERROR_FROM_TOOL message is lost or a failed step can look successful

### 4.1 The trace (all [V])

1. **Reply -> exception.** `grpc.executeCommand` returns `ExecuteCommandReply`; `response` is decoded to the **string** enum (`responseCodeFromJSON(reader.int32())`, generated `tool_base.ts:1199-1202`; `ResponseCode` is a string enum, `:30-40`). Non-SUCCESS enters the switch (`server/tools.ts:600-626`):
   - `UNRECOGNIZED_COMMAND`, `INVALID_ARGUMENTS`, `NOT_READY`, `WRONG_TOOL`: a fixed sentence; **the tool's `error_message` is dropped** (`:604-615`).
   - `ERROR_FROM_TOOL`: `Error from tool "<id>": <error_message>`, or a generic sentence if the message is empty (`:617-621`).
   - default (e.g. `DRIVER_ERROR`, `UNKNOWN_RESPONSE`): the tool's message or a generic sentence (`:622-625`).
   Then `logAction` error (`:628-632`) and `throw new ToolCommandExecutionError(msg, reply.response)` (`:634`).
2. **SUCCESS with a message.** `return_reply && !error_message` -> returns the reply (`:635-636`); else if `error_message` is non-empty -> `logAction` error and `throw ToolCommandExecutionError(error_message, reply.response)` (`:637-646`). **Confirmed: SUCCESS plus a non-empty message throws.** SUCCESS with no `return_reply` and no message falls off the end and returns `undefined`, which the caller treats as success (`command_queue.ts:486-489`); non-SUCCESS always throws first, so no error can reach that branch. Consequence flagged in the F5 research (`.planning/research/F5-ROOT-CAUSE.md:57, 116`): a SUCCESS-with-message reply FAILs the row, which stays queued and is re-run on the next Start although the instrument may have completed; the STACK adapter contract (empty message on SUCCESS) and its step_key ledger cover that.
3. **Queue.** `executeCommand` throws (`command_queue.ts:1308`); the finally clears `runningStep` and stops the monitor (`:1309-1312`); the catch (`:1320`) marks the row FAILED with the Error attached (`:1354`, `SqliteQueue.ts:500-508`), sets `this.error` and state FAILED (`:1382-1383`), logs "Command Failed" with the message (`:1385-1393`), notifies (`:1395-1402`) and breaks out of the loop (`:1405`). Exception: if the operator removed the row meanwhile, nothing is recorded and no error is set (`:1366-1379`).
4. **API.** `commandQueue.getError` (`routers/command_queue.ts:17-53`): for a `ToolCommandExecutionError` returns `{ message, userFriendlyMessage, code, codeString, name, stack }`; `userFriendlyMessage` is replaced by a generic sentence for `UNRECOGNIZED_COMMAND`, `INVALID_ARGUMENTS`, `WRONG_TOOL`, `NOT_READY` (`:27-38`) and equals `error.message` otherwise. Other errors are returned as-is (SuperJSON carries Errors, `server/trpc.ts:15-18`).
5. **Run page.** `RunsComponent.tsx:160-166` polls `getError` every 1.5 s and `commandQueue.state` every 1 s (`:160`). `ErrorBanner` (`:227-297`) renders only if the state is FAILED and `isErrorVisible`; shows `userFriendlyMessage`, the code badge from `codeString`, and a Details modal (`ErrorModal.tsx`).
6. **Step list / Gantt.** `SwimLaneCommandComponent.tsx:54-67` red background for FAILED; the Gantt bar for a FAILED command looks like any queued/started bar and only the tooltip says "Status: FAILED" (`RunQueueGanttChart.tsx:284-305`).

### 4.2 Loss and misleading points, ranked for a STACK error

| # | Where | Defect | Effect on a STACK error |
|---|-------|--------|-------------------------|
| 1 | `tools.ts:604-615` and `routers/command_queue.ts:27-38` | Tool text dropped for `INVALID_ARGUMENTS`, `NOT_READY`, `WRONG_TOOL`, `UNRECOGNIZED_COMMAND` | The adapter maps argument errors (missing/blank `step_key`, bad decision string, step key reused for a different request) to `INVALID_ARGUMENTS` (galago-tools SUMMARY :405). The operator sees "Invalid arguments provided for command "transfer". Check the parameters and try again." with no reason. Also the likeliest explanation of the live F3 report for F.A.S.T. (its gates map to INVALID_ARGUMENTS/NOT_READY, SUMMARY :108-110). ERROR_FROM_TOOL itself is fine. |
| 2 | `RunsComponent.tsx:76, 290` (also `:230`) | `isErrorVisible` is set false by the close button and never set true again (only three references) | After the operator dismisses one error, **every later error is hidden** until the page remounts. A later STACK latch error (the guid) would show nothing but the red card. |
| 3 | `SwimLaneCommandComponent.tsx:62-63,93`; `types/run.ts:20` | The per-step `error` is never rendered | After a galago-web restart (`this.error` is in memory only, `command_queue.ts:62, 1382`) or any `clearError` (`:815-818, 863-871, 884`), the run page shows a red card and no message; the message is only in the logs. |
| 4 | `SwimLaneCommandComponent.tsx:33,135` | "Send to Tool" calls `execMutation.mutate(...)` with no `onSuccess`/`onError` and there is no global mutation error handler (`utils/trpc.ts:17-32`) | A refused or failed send from the step menu shows nothing, success or failure. |
| 5 | `server/tools.ts:765-772` + `RunsComponent.tsx:246-248` | `getResponseCodeString` filters `typeof value === "number"` over a **string** enum, so it returns `"UNKNOWN"` for every code | The banner badge reads `UNKNOWN` for an ERROR_FROM_TOOL. Cosmetic, but it contradicts "show the tool's error". `error.code` is already the string name. |
| 6 | `pages/tools/[id].tsx:125-130`, `Toast.tsx:99-105` | tool-page command errors are a 10 s toast | A guid in a runCommand error vanishes. |
| 7 | `components/runs/utils.ts:34-41` | A run whose last step is SKIPPED with no CREATED/STARTED remaining is reported COMPLETED | An operator Skip of a failed STACK step (menu is offered for FAILED rows, `SwimLaneCommandComponent.tsx:69-71`) yields a COMPLETED run. Skip preserves the stored error (`_updateItem` merges, `SqliteQueue.ts:689`) so the information exists. |

### 4.3 "Failed step shown as success?" check

- No code path maps a non-SUCCESS reply to success: the switch always ends in `throw` (`tools.ts:634`).
- `COMPLETED` is set only by `commands.complete` after `executeCommand` returns (`command_queue.ts:486-489`) or by the Tool Box built-ins.
- The check icon is shown only for `COMPLETED` (`SwimLaneCommandComponent.tsx:102`); a run is `COMPLETED` when its last step is COMPLETED or SKIPPED-with-nothing-left (`utils.ts:28-41`). A FAILED row stays queued ahead of later rows (`SqliteQueue.ts:493-508`), and the loop breaks, so a later step cannot complete behind a failed one without an operator Skip/goto. The only "looks successful" outcome is item 7 above (operator-chosen).
- A STACK step that returns SUCCESS with `meta.kind` other than ran (adapter bug) would be COMPLETED; galago-core does not read `meta_data` and must not (the adapter contract is the guard, STK-07).

### 4.4 Recommended F3 changes (all unit-testable without jsdom, in the repo's "pure logic + static scan" style, PROJECT.md :143-144)

1. **Keep the tool's text for every non-SUCCESS code.** Extract a pure `describeToolReply(command, toolId, reply)` from `tools.ts:600-626` that returns the friendly sentence plus ` Tool said: <error_message>` when the message is non-empty (ERROR_FROM_TOOL keeps its current exact wording `Error from tool "<id>": <msg>`, so downstream text and `getError`'s `userFriendlyMessage` stay stable for that code). In `routers/command_queue.ts:27-38` stop overwriting `userFriendlyMessage` when the error text already carries the tool's message (simplest: only substitute the generic sentence when `error.message` is empty). This also fixes F.A.S.T. INVALID_ARGUMENTS/NOT_READY visibility.
2. **Use the real code name:** `codeString = String(code)` (`tools.ts:758`), so the badge says `ERROR_FROM_TOOL`. Throw the SUCCESS-with-message error with `ERROR_FROM_TOOL` instead of the SUCCESS code (`tools.ts:643-646`) so it is never labelled success.
3. **Re-arm the banner:** replace the boolean (`RunsComponent.tsx:76`) with `dismissedKey` and show the banner when `errorKey !== dismissedKey`, where `errorKey` is a server-supplied failure sequence (add `seq`/`at` to the `getError` payload, incremented in the same place `this.error` is set, `command_queue.ts:157, 1382, 899`). Extract `shouldShowErrorBanner(state, error, dismissedKey)` and `describeQueueError(data)` into a pure `components/runs/queueError.ts` (like `pausePrompt.ts`), which is also where the "never success" invariants get tested (message always non-empty, badge never SUCCESS).
4. **Per-step error on the card:** a pure `stepErrorText(command)` (reads `command.error.message`, handles non-Error values) rendered under the command label for FAILED rows and, for SKIPPED rows that carry an error, as "Skipped after failure: ...". Text selectable, long text clamped with the full text in a title/collapse. The card is 165 px tall with scroll (`SwimLaneCommandComponent.tsx:86-87`), so use a compact `Text` with `noOfLines`.
5. **"Send to Tool" feedback:** add `onSuccess`/`onError` to the mutation at `SwimLaneCommandComponent.tsx:135` using the existing toasts (persistent for errors), as `ProtocolDetailView.tsx:441-448` already does.
6. **Tool page:** persistent error toast (3.3 item 5).
7. **Optional:** Gantt FAILED styling (`RunQueueGanttChart.tsx:289-295`); "completed with skipped steps" run status (`utils.ts:34-41`).

### 4.5 What static reading does not explain (LOW confidence, verify with a test)

The fast-mcp runbook records that the run UI showed nothing on screen in 3 attempts (:336-339, :209). For ERROR_FROM_TOOL the code above should display the text. Plausible causes: the replies were INVALID_ARGUMENTS/NOT_READY (item 1), a previously dismissed banner (item 2), or the operator was not on the run page (`GlobalQueueStatusIndicator` shows only "Run Error", `components/runs/status/GlobalQueueStatusIndicator.tsx:11-35`). The first F3 phase task should be a failing test, not a fix: drive a fake tool returning each response code with a message through the queue (`installFakeTool`, `queue._start()`, as `test/toolControl.test.ts` does) and assert `getError()` / `commandQueueRouter.createCaller({}).getError()` and the stored row error all contain the tool's text. There are currently no tests on the `ToolCommandExecutionError` mapping (`test/tools.test.ts` has no match for ERROR_FROM_TOOL).

---

## 5. Build order and independence from generated types

**Order: F5 (DEP-03c) as planned -> F3 (DEP-03b) -> acknowledge + queue refusal (DEP-03a) -> DEP-02 codegen last.**

1. **F3 before the acknowledge.** The ack's refusals (adapter `INVALID_ARGUMENTS` "no", wrong guid, latched state) and the operator's source for the guid both depend on error text being visible; F3 changes (`tools.ts`, `getError`, banner, step card) are independent of proto and of the ack. Doing it first also gives the ack's tests a real failure path to assert against.
2. **Acknowledge next, built entirely on strings.** Nothing in it needs generated types if the following hold (all verified or designed above):
   - The spec modules (`recoveryActions.ts`, `operatorOnlyCommands.ts`) are zero-import string maps.
   - `recoveryControl` takes `toolType: string` already (`recoveryControl.ts:21`) and `routers/tool.ts:523` casts `record.type as ToolType`; tests use `installFakeTool("stack-1", "stack" as ToolType)` and assert the object handed to the fake `grpc.executeCommand`, exactly as `test/recoveryControl.test.ts:60-62` does for fast.
   - The guard compares `String(this.toolType)`.
   - `tool.latchStatus` takes `toolId` only (the type is read from the DB row), so it avoids `zToolType` (`routers/tool.ts:15`), which rejects `"stack"` until regeneration. The generic `runCommand` cannot be used for a STACK read before codegen for the same reason.
   - What cannot be proven before DEP-02: that the payload survives the real encoder (ts-proto drops unknown keys; the `wire.test.ts:20-48` pattern), `getToolConfigDefinition` for `stack` (`tools.ts:698-718` dynamically imports the generated module), and creating a STACK tool row through `zToolType`. These are DEP-02's tests.
3. **DEP-02 last** (gated on galago-tools Phase 4): bump `vendor/galago-tools`, regenerate with ts-proto 1.151.1, add `commandFields.stack` for every command except `acknowledge_failure` (required strings as `text` with no `defaultValue`, no `select`; compare the fast precedent `components/tools/constants.ts:314-343`), then the activation tests: a `wire.test.ts`-style encode/decode of `{ stack: { acknowledge_failure: { guid, arm_inspected: "yes" } } }` (`tool_base.Command.decode(...).stack?.acknowledge_failure`), a contract test that `LATCH_READ_COMMAND` is a key of the generated `stack.Command` oneof, and `commandFields.stack` has no `acknowledge_failure` and includes the latch read. Note the fast precedent `scan_tips` pre-fills `is_tip_broken` with `defaultValue: false` (`constants.ts:340`); do not copy that for any STACK decision-like field.

---

## 6. Files, flags, decisions

### 6.1 New vs modified files

**New**
- `server/recoveryActions.ts`: recovery spec by tool type, param kinds, `validateRecoveryRequest`, strict-success flag, `LATCH_READ_COMMAND`
- `server/operatorOnlyCommands.ts`: table, `isOperatorOnlyCommand`, `OperatorOnlyCommandError`
- `components/tools/latchStatus.ts`: pure `extractLatch(meta)`, guid client check (or inside `recoveryActions.ts` to share the validator)
- `components/runs/queueError.ts`: pure banner message / dismissal logic; `stepErrorText` (or in `components/runs/utils.ts`)
- tests: `test/recoveryActions.test.ts`, `test/operatorOnly.test.ts`, `test/errorPath.test.ts` (queue + getError + step row, all response codes), `test/queueError.test.ts`; extend `test/staticScan.test.ts`, `test/controlDecision.test.ts` (existing `shouldShowRecoverySection` cases at `:414-418` change meaning to "has recovery actions"), `test/recoveryControl.test.ts`

**Modified**
- `server/recoveryControl.ts`, `server/routers/tool.ts` (comment + `latchStatus`), `server/tools.ts` (guard, `describeToolReply`, `codeString`, SUCCESS+message code), `server/runs.ts` (enqueue guard, rethrow list), `server/routers/run.ts` (mapping), `pages/api/runs/index.ts` (400 case), `server/routers/command_queue.ts` (`getError`), `server/command_queue.ts` (failure `seq` only)
- `components/runs/controlDecision.ts`, `components/runs/RunControlConfirmModal.tsx`, `components/tools/RunRecoverySection.tsx`, `components/runs/RunsComponent.tsx` (banner), `components/runs/list/SwimLaneCommandComponent.tsx`, `pages/tools/[id].tsx` (persistent error toast; optional reply display), optionally `server/routers/protocol.ts` (preview guard)
- DEP-02 only: `components/tools/constants.ts`, `vendor/galago-tools`, `gen-interfaces/**`

**Unchanged on purpose:** `server/runControl.ts`, `server/runState.ts`, `ControlBar.tsx`, `stopInterception.ts`, `InstrumentStopModal.tsx`, `QueueStatuscomponent.tsx`, `hooks/useRunControl.ts` (types only), `Tool.controlCommand`, `commandQueue.toolControl`.

### 6.2 Cross-repo corrections found while verifying

- galago-tools SUMMARY (:115-120) says galago-core calls `EstimateDuration` for every step at run creation (`runs.ts:183-207`). In this repo `RunStore.estimateCommandDurations` is defined but never called (`grep` over `controller/` finds only the definition and `Tool.estimateDuration`; `estimatedDuration` is read only by the Gantt with a 600 s fallback, `RunQueueGanttChart.tsx:89, 266`). So galago-core does not exercise the STACK `Estimate<Cmd>` hooks today (they matter for simulated-mode sleep, base_server). No effect on this work; the galago-tools plan should not rely on that call.
- galago-tools SUMMARY (:106-108) states that only `ERROR_FROM_TOOL` and the default branch show the tool's text; that is correct (`tools.ts:604-625`); F3 item 1 above removes the restriction on the galago-core side, which is a safety net, not a replacement for the adapter mapping every non-ran kind to ERROR_FROM_TOOL.
- No authentication exists in galago-web (`server/trpc.ts:12`, `pages/api/trpc/[trpc].ts:5` use an empty context), so "operator-only" means: never reachable from a protocol, script, queue row or editor, and only through the confirmed card path. Any HTTP client of the app could still call `tool.recoveryControl` with `{action:"acknowledge_failure", params:{guid, arm_inspected:"yes"}}`, the same exposure as `commandQueue.toolControl` today. The core's exact-guid + `confirm=True` requirement is the real guard (galago-tools SUMMARY :294-298). The audit log cannot record who acted.

### 6.3 Assumptions galago-tools Phase 4/5 must honour (not a stop; confirm when the proto freezes)

1. `AcknowledgeFailure` fields stay `guid` and `arm_inspected` (the spec map names them; DEP-02's contract test will catch a rename).
2. A latch-read command exists and returns the guid under a predictable key in `meta_data`; the panel tolerates unknown shapes and shows raw JSON, so a name/shape change only needs the one `LATCH_READ_COMMAND` constant.
3. `AcknowledgeFailure` and the latch read are reachable when the tool is not mid-transfer, and the adapter's `ExecuteCommand` override (STK-05) does not answer them with `NOT_READY`. galago-core will not gate on instrument state (PROJECT.md :130-131).
4. SUCCESS replies keep an empty `error_message` (STK-07), including `failureAcknowledged`.

### 6.4 Decisions needed from the user

1. Include fast `pause/resume/abort` in the execute-time refusal table now (recommended) or STACK only (2.4).
2. Whether the generic tool-page panel's missing reply display (3.3 item 4) is in this milestone's F3/ack phases or goes to DEP-02/GAL-01 usability.
3. Run-page banner dismissal re-arming needs a failure `seq` in the `getError` payload (a small server change in `command_queue.ts`); confirm that is acceptable inside the F3 phase.

### 6.5 Research flags for the roadmap

- **F3 phase:** needs a failing reproduction first (4.5); otherwise standard patterns.
- **Acknowledge phase:** standard patterns (D-20 template), no further research; planner should read 1.2 so nobody "just adds stack to runControl".
- **DEP-02:** mechanical, but carry the activation tests in 5.3 so the pre-codegen work is proven against the real encoder.

## Sources

All first-party code read at the cited lines (HIGH): `controller/server/{runControl,recoveryControl,runState,tools,command_queue,runs,toolKey,logger,trpc}.ts`, `controller/server/routers/{tool,command_queue,run,protocol}.ts`, `controller/server/utils/SqliteQueue.ts`, `controller/server/scripting/{protocol-script-executor,resolve-tool-types}.ts`, `controller/components/runs/*`, `controller/components/tools/*`, `controller/components/protocols/*`, `controller/pages/tools/[id].tsx`, `controller/pages/api/runs/index.ts`, `controller/hooks/useRunControl.ts`, `controller/test/*`, `controller/gen-interfaces/tools/grpc_interfaces/tool_base.ts`. Cross-repo (HIGH for text, MEDIUM for how galago-tools will implement it): `galago-tools/.planning/research/SUMMARY.md` (Q1, Proposed stack.proto, Critical Pitfalls 4-5), `galago-tools/.planning/REQUIREMENTS.md` (ACK-01/02, STK-07, DEP-02/03), `fast-mcp/docs/runbooks/phase5-galago-live-run.md:209, 336-339` (F3), `galago-core/.planning/research/F5-ROOT-CAUSE.md`.
