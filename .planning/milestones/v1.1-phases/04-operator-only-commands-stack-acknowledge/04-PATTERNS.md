# Phase 4: Operator-only Commands & STACK Acknowledge - Pattern Map

**Mapped:** 2026-10-29
**Files analyzed:** 21 (4 new + 16 modified + 1 new client hook variant)
**Analogs found:** 21 / 21 (exact or self-modify; all analogs verified git-tracked via `git ls-files`)

Phase 4 is a clone-don't-invent phase: every load-bearing pattern (zero-import spec module, fail-closed
validator, audited single-send path, confirmation modal, static scans) already exists and RESEARCH.md has
pinned its line numbers at HEAD. This document points each new/modified file at the concrete excerpt to copy.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `controller/server/recoveryActions.ts` (new) | config/utility (zero-import spec + validator) | transform | `controller/server/runControl.ts` | exact |
| `controller/server/operatorOnlyCommands.ts` (new) | config/utility (zero-import refuse table + Error subclass) | transform | `controller/server/runControl.ts` (table/lookup) + `controller/server/runs.ts:264-287` (Error class style) | exact |
| `controller/server/recoveryControl.ts` (mod) | service (audited recovery send) | request-response | itself (excerpt-preserving reroute; refusal/copy structure from `runControl.ts:87-121`) | self-modify |
| `controller/server/tools.ts` (mod — instance `executeCommand` guard) | service guard | request-response | insertion point pinned; error class from `runs.ts:264-287` style, `ToolCommandExecutionError` at `tools.ts:714-727` | self-modify |
| `controller/server/runs.ts` (mod — enqueue guard) | service | CRUD/batch | itself (`createFromProtocol` :210-261) | self-modify |
| `controller/server/routers/run.ts` (mod — error mapping) | route | request-response | itself (catch chain :82-98) | self-modify |
| `controller/pages/api/runs/index.ts` (mod — 400 case) | route | request-response | itself (switch :14-25) | self-modify |
| `controller/server/routers/tool.ts` (mod — comment + `latchStatus` query) | route | request-response | its own entries: `runCommand` :495-506 (executeCommand path), `recoveryControl` :508-533 (getToolFromDB + Tool.forId pattern) | self-modify |
| `controller/components/runs/controlDecision.ts` (mod) | utility (pure decision state + copy maps) | transform | itself (copy maps :183-238, recovery branch :333-356) | self-modify |
| `controller/components/runs/RunControlConfirmModal.tsx` (mod) | component (shared confirm) | request-response | itself (per-kind radio render :233-250) | self-modify |
| `controller/components/tools/RunRecoverySection.tsx` (mod) | component (tool-page card) | request-response | itself (buttons/modal wiring :51-105) + `useRunControlState` query pattern | self-modify |
| `controller/hooks/*` (new latch hook, if split out) | hook | request-response | `controller/hooks/useRunControl.ts:14-18` (`useRunControlState` plain `useQuery`) | role-match |
| `controller/hooks/useRunControl.ts` (mod — params widening) | hook | request-response | itself (:20-53; only the `sendRecovery` input's param type widens) | self-modify |
| `controller/test/recoveryActions.test.ts` (new) | test (pure module) | — | `controller/test/runControl.test.ts` | exact |
| `controller/test/operatorOnly.test.ts` (new) | test (pure + fake-tool + router) | — | `test/runControl.test.ts` (map pin) + `test/recoveryControl.test.ts` (router caller + fake tool) | exact |
| `controller/test/latchStatus.test.ts` (new) | test (pure + fake tool) | — | `test/recoveryControl.test.ts` + `test/toolReply.test.ts` (pure reply parsing) | exact |
| `controller/test/staticScan.test.ts` (mod) | test (source scans) | — | itself (helpers :16-118, pin style `:196`-type file lists; per-bloc additions listed in RESEARCH §Scan-surface) | self-modify |
| `controller/test/runControl.test.ts` (mod) | test | — | itself (map pin :11-26; add `recoveryActions.fast` derivation pin) | self-modify |
| `controller/test/controlDecision.test.ts` (mod) | test | — | itself | self-modify |
| `controller/test/recoveryControl.test.ts` (mod) | test | — | itself (caller + fake-grpc stub pattern :185-244) | self-modify |
| `controller/test/tools.test.ts` (mod) | test | — | itself + `test/helpers/fakeTool.ts:13-36` | self-modify |

## Pattern Assignments

### 1. `controller/server/recoveryActions.ts` (new — zero-import spec + validator)

**Analog:** `controller/server/runControl.ts` — clone the file's entire architecture.

**Module header + zero-import rule** (`runControl.ts:1-4`; `toolKey.ts:1-12` is a second worked example of the same comment discipline):
```ts
// No imports. This module has one job: declare, per tool type, which live
// control actions exist and which operator decisions each action requires.
// It is imported by both the server (CommandQueue.toolControl, D-03) and,
// in Phase 2, the UI control bar — one source of truth for the shape (D-09).
```
`recoveryActions.ts` must likewise have **no imports at all** so `controlDecision.ts` and tests can
import it as values on the client (verified rule: `controlDecision.ts:8-11` imports only zero-import
modules). Copy `deepFreeze` verbatim (`runControl.ts:18-29`) — a zero-import module cannot import it
from `runControl.ts`.

**Deep-frozen capability map** (`runControl.ts:34-40`) — the shape to clone for `recoveryActions`
(param kinds `"yesno" | "confirmYes" | "guid"`, per D-05):
```ts
export const runControl: Readonly<Record<string, RunControlToolSpec>> = deepFreeze({
  fast: {
    pause: {},
    resume: { is_tip_broken: "yesno" },
    abort: { return_liquid: "yesno" },
  },
});
```
*Planner note (from RESEARCH):* `recoveryActions.ts` cannot import `runControl.ts`, so
`recoveryActions.fast.resume/abort` are **value-copies** inline, pinned by a deep-strict-equal test
against `runControl.fast` (D-05); `runControl` itself stays `{ fast }` only and is never extended.

**Own-property-safe lookup** (`runControl.ts:67-74`) — mandatory for `getRecoverySpec`,
`listRecoveryActions`, `isRecoveryAction` and the refuse-table lookup:
```ts
export function getRunControl(toolType: string): RunControlToolSpec | undefined {
  if (!Object.prototype.hasOwnProperty.call(runControl, toolType)) {
    return undefined;
  }
  return runControl[toolType];
}
```

**Fail-closed validator, fixed refusal order and codes** (`runControl.ts:87-158`) — clone the
order/codes/liberal error text verbatim into `validateRecoveryRequest` (D-05), with the value rule per
kind: `yesno` → exact `"yes"`/`"no"`, `confirmYes` → exact `"yes"` only, `guid` →
`^[^\s\u0000-\u001f\u007f]{1,256}$` untrimmed/uncoerced (D-08):
```ts
// Fixed refusal order (D-03, QUE-03 ordering):
//   (a) no running step ... (c) action not declared ... (d) missing/blank/wrong value,
//   (e) an undeclared parameter was sent ...
export function validateControlRequest(
  runningToolType: string | undefined,
  action: string,
  params: Record<string, unknown>,
): ControlRequestVerdict {
  ...
  // Never trim, case-fold, default or coerce: only the exact strings
  // "yes" and "no" are accepted.
  if (value !== "yes" && value !== "no") {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: `Decision "${decisionName}" must be "yes" or "no" ${describeValue(value)}`,
    };
  }
  ...
  for (const key of Object.keys(params)) {          // (e) undeclared parameter
    if (!Object.prototype.hasOwnProperty.call(actionSpec, key)) {
      return { ok: false, code: "BAD_REQUEST",
               message: `Parameter "${key}" is not a decision of action "${action}".` };
    }
  }
  return { ok: true, decisions };                    // recoveryActions returns params instead
}
```
Also copy the `describeValue` helper (`runControl.ts:76-85`). Note: the (a)/(b) PRECONDITION_FAILED
branches here key on a *running step*; `validateRecoveryRequest` keys on `runningToolType` absence the
same way (the STACK-specific "ack while running" message lives in `recoveryControl.ts`, not in this
module — see RecoveryControl assignment below).

**Other contents (same module, per D-13/D-10):** `RECOVERY_STRICT_SUCCESS = { stack: ["acknowledge_failure"] }`
and `LATCH_READ_COMMAND` (single string constant) plus optional `isValidRecoveryGuid(s: string)` — all
plain exports, zero imports, deep-frozen data.

### 2. `controller/server/operatorOnlyCommands.ts` (new — refuse table + error)

**Analog:** `controller/server/runControl.ts` for the zero-import frozen table + own-property lookup;
`controller/server/runs.ts:264-287` for the plain `Error` subclass style. **No `logAction` import** —
the module stays zero-import; the enforcement sites in `tools.ts`/`runs.ts` do the logging.

**Frozen table + matcher (target shape per D-01/D-04; clone the lookup discipline from
`runControl.ts:57-64/69-74`):**
```ts
export const operatorOnlyCommands: Readonly<Record<string, readonly string[]>> = deepFreeze({
  stack: ["acknowledge_failure"],
  fast: ["pause", "resume", "abort"],
});

export function isOperatorOnlyCommand(toolType: string, command: string): boolean {
  const t = Object.prototype.hasOwnProperty.call(operatorOnlyCommands, toolType)
    && operatorOnlyCommands[toolType];
  if (!t) return false;
  const c = String(command).trim().toLowerCase(); // case/whitespace-insensitive (D-04)
  return (t as readonly string[]).includes(c);
}
```

**Error class style** (`runs.ts:282-287`, same idiom as `ToolCommandExecutionError` at
`tools.ts:714-727`): a plain `Error` subclass with `this.name` set, no coded response
(`OperatorOnlyCommandError` per D-03):
```ts
export class ProtocolGenerationFailedError extends Error {
  constructor(public protocolId: string) {
    super(`Could not generate commands for protocol ID '${protocolId}'.`);
    this.name = "ProtocolGenerationFailedError";
  }
}
```

### 3. `controller/server/recoveryControl.ts` (modify — D-06/D-09/D-10 reroute)

**Analog:** itself; every structure below stays, only the flagged lines change.

**Keep — audited refusal template with `logAction` then `TRPCError`** (`recoveryControl.ts:40-48`):
```ts
if (!(RECOVERY_ACTIONS as readonly string[]).includes(action)) {
  const message = `Action "${action}" is not available for crash recovery; ...`;
  await logAction({
    level: "warning",
    action: "Tool Recovery Control Refused",
    details: `${baseDetails} outcome=refused: BAD_REQUEST ${message}`,
  });
  throw new TRPCError({ code: "BAD_REQUEST", message });
}
```
Swap `RECOVERY_ACTIONS`/`includes` for `isRecoveryAction(action)` from the new module.

**Keep — refuse-while-this-tool's-step-is-running (queue state only, UI-08)** (`:52-60`); change only
the STACK-specific message text (D-09):
```ts
if (runningStep !== undefined && normalize(runningStep.toolId) === normalize(toolName)) {
  const message = "A run step is tracking this tool; use the run page."; // → STACK variant per D-09
  ... throw new TRPCError({ code: "PRECONDITION_FAILED", message });
}
```

**Keep — validator call + fail-throw** (`:64-72`); swap `validateControlRequest` →
`validateRecoveryRequest` and send `verdict.params`.

**Keep — one attempt, no deadline, send + audit** (`:74-101`) — swap `verdict.decisions` →
`verdict.params` and add the D-10 strict-success refusal after the send (ok + non-blank message +
`RECOVERY_STRICT_SUCCESS["stack"]?.includes(action)` → log warning, return `ok:false`):
```ts
// No options, no deadline (D-23): a recovery Resume stays pending for as
// long as the tool takes. One attempt only, never retried.
result = await tool.controlCommand(action, verdict.decisions);   // → verdict.params
```
**Do not touch:** the instrument-state-free discipline (no `runState`/`getStatus` reads anywhere — an
existing scan at `staticScan.test.ts:341-356` + `/latch/i` ban per D-12 pin this file).

### 4. `controller/server/tools.ts` (modify — execute-time guard, D-02a)

**Analog:** itself; insertion point is the first statement of the instance method.

**Insertion anchor** (`tools.ts:409-415`) — guard goes as the FIRST statement, before the
variable-substitution loop, keyed on `String(this.toolType)` never `command.toolType`:
```ts
async executeCommand(command: ToolCommandInfo) {
  const params = command.params;
  // Substitute params with variables using Drizzle
  for (const key in params) { ... }
```
**Guard code to copy** (RESEARCH-verified pattern; log template from the static wrapper's
`logAction` at `tools.ts:393-397` and the "Tool Command Execution Error" block at `:603-608`):
```ts
if (isOperatorOnlyCommand(String(this.toolType), command.command)) {
  await logAction({
    level: "warning",
    action: "Operator-Only Command Refused",
    details: `toolId=${this.toolId} toolType=${this.toolType} command=${command.command} stage=execute`,
  });
  throw new OperatorOnlyCommandError(
    `"${command.command}" on tool "${this.toolId}" is an operator action and cannot run from a ` +
      "protocol or the queue; use the tool page Run Recovery card.",
  );
}
```

**Must-not-touch / must-understand context** in the same file:
- `_payloadForCommand` (`:360-366`) and `controlCommand` (`:373-390`) — the operator path; `controlCommand`
  calls `grpc.executeCommand` directly and is NEVER guarded (an existing scan pins its callers).
- Reply mapping (`:599-610`) — how the **latch read** gets its `meta_data`:
```ts
const reply = await this.grpc.executeCommand(this._payloadForCommand(command));
const failure = describeToolReply(command.command, command.toolId, reply);
if (failure) { ... throw new ToolCommandExecutionError(failure.message, failure.code); }
return reply.return_reply ? reply : undefined;
```
A `latchStatus` service must pass `return_reply: true` in the `ToolCommandInfo` and check the returned
reply's `return_reply`/`meta_data`; FAILURE and SUCCESS+message mapping comes free via
`describeToolReply` (`toolReply.ts:35-49`).

### 5. `controller/server/runs.ts` (modify — enqueue guard, D-02b)

**Analog:** itself — `createFromProtocol` (`:210-261`).

**Insertion anchor** (`runs.ts:215-217`) — right after commands are generated, before the run object:
```ts
// Generate commands from protocol
const commands = await generateCommandsFromProtocol(protocol, paramValues);
```
Insert the per-command scan (`isOperatorOnlyCommand` + `logAction` "Operator-Only Command Refused ...
stage=enqueue" + `throw new OperatorOnlyCommandError`, per RESEARCH §Enqueue guard) here. Keys on the
declared step type (cheap early layer); the execute-time guard is the mislabelled-step backstop.

**Must-modify — rethrow list** (`runs.ts:246-254`):
```ts
if (
  error instanceof ProtocolNotFoundError ||
  error instanceof ProtocolGenerationFailedError ||
  error instanceof ProtocolParamsInvalidError
) {
  throw error;
}
```
Add `OperatorOnlyCommandError` to this list, or its message becomes the generic
"Could not create run: …" inside `ProtocolGenerationFailedError` (`:257-259`), hiding the reason in the
same way D-03 warns against.

### 6. `controller/server/routers/run.ts` (modify — tRPC mapping)

**Analog:** itself (`:82-98`). Insert adjacent to the `ProtocolGenerationFailedError` branch:
```ts
if (e instanceof ProtocolGenerationFailedError) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Could not generate commands for the given params.",
  });
}
```
`OperatorOnlyCommandError` gets the same shape but keeps its **own** message (`e.message`) — visible
BAD_REQUEST per D-02.

### 7. `controller/pages/api/runs/index.ts` (modify — REST 400)

**Analog:** itself (`:14-25`); add a case to the `switch (e.name)`:
```ts
switch (e.name) {
  case "ProtocolNotFoundError": ... 404
  case "ZodError":              ... 400
  default:                      ... 500
}
```
`case "OperatorOnlyCommandError"` → 400 with `e.message` (default is 500 today — the new case is
required for a visible message).

### 8. `controller/server/routers/tool.ts` (modify — comment + `latchStatus` query)

**Analog:** its own entries. The recovery mutation's comment block (`:508-512`) cites
`RECOVERY_ACTIONS` — update it to reference `isRecoveryAction`/`recoveryActions.ts`.

**`recoveryControl` entry — the router pattern to clone for `latchStatus`** (`:513-533`):
```ts
recoveryControl: procedure
  .input(z.object({
    toolId: z.string(),
    action: z.string(),
    params: z.record(z.unknown()).optional(),
  }))
  .mutation(async ({ input }) => {
    const record = await getToolFromDB(input.toolId);
    const tool = Tool.forId(record.name, record.ip, record.port, record.type as ToolType);
    return recoveryControl({ toolName: record.name, toolType: String(record.type), tool, ... });
  }),
```
`latchStatus` = same `getToolFromDB` + `Tool.forId` + `String(record.type)` shape, as a **query** whose
input is `z.object({ toolId: z.string() })` only (toolId-only per D-11 — `zToolType` at `:15` rejects
`"stack"` until Phase 5). It calls the Tool instance's `executeCommand` with
`{ toolId, toolType: record.type, command: LATCH_READ_COMMAND, params: {}, ... return_reply: true }`,
then applies `extractLatch` (pure, from `recoveryActions.ts`). Contrast with the existing
`runCommand` entry (`:495-506`) which requires `toolType: zToolType` — do **not** reuse that schema.

### 9. `controller/components/runs/controlDecision.ts` (modify — copy maps + recovery spec)

**Analog:** itself. Exact excerpts to extend:

**Copy maps switch on own-property lookups** (`:183-216`) — add ack entries here (`confirmHeader`,
`successTitle`, `decisionLabel` get `TOOL_DISPLAY_NAMES.stack = "STACK"` and
`acknowledge_failure`/`arm_inspected` copies):
```ts
const CONFIRM_HEADERS: Readonly<Record<string, string>> = {
  pause: "Pause Instrument", resume: "Resume Instrument", abort: "Abort Instrument Run",
};
```
**`restateChoice` ack branch** (`:221-238`) — the `action === "pause"` early return is the model for an
`acknowledge_failure` branch that restates the typed guid verbatim (D-07).

**Recovery allowlist swap** (`:245` → D-06): `RECOVERY_UI_ACTIONS = ["resume", "abort"] as const`
becomes `listRecoveryActions(toolType)` from the new module.

**Request/interface widening** (`:250-255` + `:277-281`) — `ConfirmedControlRequest` gains
`params?: Readonly<Record<string,string>>` and `sendRecovery`'s params type widens from
`ControlDecisionValue` to `string`:
```ts
sendRecovery?(input: { toolId: string; action: string;
                       params: Record<string, ControlDecisionValue>;
                     }): Promise<ToolControlResultLike>;
```
(Existing scan at `staticScan.test.ts:228-233` requires the `ConfirmedControlRequest` body to contain
`ControlDecisionValue` and NOT `undefined` — `params?:` satisfies both.)

**Recovery branch to reroute** (`:333-356`) — replace `RECOVERY_UI_ACTIONS` check + `getActionSpec` /
`completeDecisions` with `getRecoverySpec` / recovery completion over declared param kinds.

**Card visibility** (`:378-380`) — `shouldShowRecoverySection` reads `getRunControl(toolType) !==
undefined`; becomes `listRecoveryActions(toolType).length > 0` so `stack` shows the card.

**headMovesNote** (`:21-23`) — for `acknowledge_failure` the modal must show no "head will move" note
(D-07); handle via the ack branch returning `null` (or `runControlMovesHead`-style zero-entry).

### 10. `controller/components/runs/RunControlConfirmModal.tsx` (modify — per-kind + params)

**Analog:** itself. Key excerpts:
- Request interface (`:55-59`): add `params?: Readonly<Record<string, string>>`.
- Remount-per-instance (`:107-124` + key `:123`) — do not disturb; the card's ack confirm
  (non-null → non-null replace with same tool/action when a second ack opens) depends on it.
- Per-decision render (`:233-250`) — the RadioGroup block is the template for the `confirmYes` kind;
  `guid` kind is **not** rendered in the modal (it was typed on the card; the modal restates it in
  `restateChoice`/body text).
- `canConfirm` (`:162`): `allDecisionsChosen` Y/N-selection; recovery variant completes declared params
  (`confirmYes` → exactly "yes", nothing preselected, "No" keeps Confirm disabled).
- `handleConfirm` (`:165-180`): the completed-object gate — `send` receives completed values only.

### 11. `controller/components/tools/RunRecoverySection.tsx` (modify — guid input + latch block)

**Analog:** itself (109 lines). Structure to extend:
- Visibility + disabled gating (`:44-49`):
```ts
if (!shouldShowRecoverySection(toolType)) { return null; }
const tracked = isToolTrackedByRunningStep(runControlQuery.data, toolName);
const disabled = tracked || pendingAction !== null;
```
Per D-09, `tracked` stays false for `stack` (stack has no runControl entry, so
`runState` never reports a step running on it, `runState.ts:129-132`) — buttons stay enabled; no new
greying logic.
- `openConfirm` builds the request (`:51-53`) — the ack button opens the same modal with
  `request.params = { guid }` and is disabled until the client-side guid check (same regex as the
  server, `recoveryActions.ts`) passes; no `onKeyDown`/`onSubmit`/form/`autoFocus` (scan will pin this).
- Existing modal wiring (`:95-105`) — `closeOnDispatch` and `onPendingChange` already correct; the
  **`afterAccepted` prop is not passed today** → add the clear-guid + clear-latch-result handler (D-07).
- Latch block (new, above the guid input): "Read latch" button (explicit click, no polling/timer) →
  `tool.latchStatus` query via a hook, read-only display, "Use this guid" fills the input only (D-12),
  collapsible raw JSON for unknown shapes, "No failure latched" otherwise.

### 12. `controller/hooks/useRunControl.ts` (modify — type widening only)

**Analog:** itself (`:20-53`). Only the `sendRecovery` lambda's param type widens to match
`ConfirmedSendDeps`; everything else (refs-of-mutateAsync pattern `:31-35`, notify map `:42-45`,
`isSending` `:51`) stays. This hook remains the **only** client file referencing `recoveryControl`
(scan `staticScan.test.ts:191-197`), and stays `/latch/i`-free per D-12.

**New latch hook (if split out)** — clone `useRunControlState` (`useRunControl.ts:14-18`):
```ts
export function useRunControlState() {
  return trpc.commandQueue.runState.useQuery(undefined, {
    refetchInterval: RUN_CONTROL_POLL_MS,
  });
}
```
but a plain `useQuery` **without** `refetchInterval` (no polling, D-11), for `trpc.tool.latchStatus`.

## Shared Patterns

### Zero-import module recipe (apply to both new server modules)
**Source:** `server/runControl.ts:1-29`, `server/toolKey.ts:1-15`
- Comment header stating "No imports" and who consumes it.
- Local `deepFreeze` copy (12 lines).
- Deep-frozen `Readonly<Record<...>>` tables; own-property lookups only
  (`Object.prototype.hasOwnProperty.call(...)` — `toString`/`constructor`/`__proto__` never match, D-04).
- Client-safe: `controlDecision.ts:8-11` imports these as values.

### Audit logging
**Source:** `server/logger.ts:4-10`; usage every outcome in `server/recoveryControl.ts:42-101`
```ts
await logAction({ level: "warning", action: "Tool Recovery Control Refused",
                  details: `${baseDetails} outcome=refused: ${code} ${message}` });
```
**Apply to:** every refusal/success/failure on the ack path and both operator-only refusal stages
(`stage=execute` in `tools.ts`, `stage=enqueue` in `runs.ts`). Always `await`ed before throwing.

### Plain `Error` subclass style
**Source:** `runs.ts:264-287` (and `tools.ts:714-727` for the coded counterpart)
```ts
export class XError extends Error { constructor(...) { super(...); this.name = "XError"; } }
```
**Apply to:** `OperatorOnlyCommandError` (own module, no coded response — D-03).

### Fail-closed validation
**Source:** `server/runControl.ts:87-158`
**Apply to:** `validateRecoveryRequest` — clone refusal order/codes; never trim/case-fold/default
("yes"/"no"/exact guid only); reject undeclared params after declared ones (d before e).

### Fake-tool test setup
**Source:** `test/helpers/fakeTool.ts:13-36`; usage `test/recoveryControl.test.ts:1-44`
```ts
const { tool, grpc } = installFakeTool("fast-1", ToolType.fast);
```
Phase 4 tests use `installFakeTool("stack-1", "stack" as ToolType)` (string tool types; comparing
`ToolType` enum members to `"stack"` is TS2367 — compare via `String(...)` only) and stub
`grpc.executeCommand` with `mockResolvedValue({ response: ResponseCode.SUCCESS, ... })` /
`mockRejectedValue(new Error("14 UNAVAILABLE"))` (see `recoveryControl.test.ts:216-244`).

### Static-scan style
**Source:** `test/staticScan.test.ts:16-50` (`walk` with SKIP_DIRS, `read`, `rel`), `:56-111`
(`stripComments` — string literal contents count as matches), `:118+` (`extractBracedRegion`).
Pins are either exact file lists (`toStrictEqual([...sorted rels...])`) or body assertions via
`extractBracedRegion`. All new OPR-05 pins use only these existing helpers; string literals in error
messages count, so the `acknowledge_failure` pinned file list must include
`server/operatorOnlyCommands.ts` + `components/runs/controlDecision.ts` and reject every other file.

## No Analog Found

None — every file in this phase modifies or clones an existing, shipped pattern. Weakest match is the
optional new client latch hook (role-match to `useRunControlState`); if the planner keeps the latch
query inline in `RunRecoverySection.tsx`, no new client file is created at all.

## Planner cautions (from verified excerpts)

1. **`controlUiModules` scan** (`staticScan.test.ts:275-292`): `RunRecoverySection.tsx` is already
   listed — any NEW client module rendering card UI must be added to that list.
2. **`.controlCommand(` caller pin** (`staticScan.test.ts:235-254`): exactly `command_queue.ts` +
   `recoveryControl.ts` call it — the latch read must use `tool.executeCommand(...)` (D-11), which this
   pin permits.
3. **Early-stop note:** all excerpts above were taken in one pass per file; no supplementary reads
   needed for the planner — RESEARCH.md's §"Verified Anchors at HEAD" supplies the remaining
   file:line pins (e.g. `runs.ts:216/:246-254`, `routers/run.ts:82-98`, `api/runs/index.ts:22-23`,
   `staticScan.test.ts` block boundaries `:191-362`, `:365-579`).
4. **Gate:** `npx tsc --noEmit` + `npm run test:unit` (green at HEAD: 20 files / 436 tests) + prettier
   via `bin/make test`. Tests use the vitest node environment, `testTimeout: 15000`; the queue busy
   loop sleeps 1.5 s — router tests involving running steps may need the upper end of that timeout.

## Metadata

**Analog search scope:** `controller/server/`, `controller/server/routers/`, `controller/components/runs/`, `controller/components/tools/`, `controller/hooks/`, `controller/pages/api/runs/`, `controller/test/`
**Files scanned:** 13 read in full or in targeted sections this session (+ RESEARCH-verified anchors for the rest)
**Tracked-source gate:** all named analogs confirmed present in `git ls-files`
**Pattern extraction date:** 2026-10-29
