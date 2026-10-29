# Phase 4: Operator-only Commands & STACK Acknowledge - Research

**Researched:** 2026-10-29
**Domain:** Recovery-only control spec, operator-only command refusal, latch read — all first-party code in `controller/`
**Confidence:** HIGH (every load-bearing anchor re-read at HEAD this session; suite baseline run; two TS probes executed)

## Summary

Phase 4 is a **no-new-dependencies, string-tool-types-only** phase: it clones the proven `runControl.ts`
deep-frozen-spec pattern into two new zero-import modules (`server/recoveryActions.ts`,
`server/operatorOnlyCommands.ts`), reroutes the existing audited `recoveryControl` path through a new
spec/validator, adds one guard at the top of instance `Tool.executeCommand` and one at enqueue time in
`RunStore.createFromProtocol`, extends the card/modal/copy in `components/runs/*`, and pins all of it with
a batch of new static scans in `test/staticScan.test.ts`. Prior research `.planning/research/ACK-AND-F3.md`
(§1–§3) verified the design with file:line citations; **this research re-verified every anchor against
current HEAD** because Phase 3 landed ~9.4k changed lines after that research was written. Most anchors
did not move (those files were untouched by Phase 3 — empty diff confirmed); the ones that did are
re-pinned below with new line numbers, and the F3 items REQUIRED-reading them are now **shipped code**
(`describeToolReply` in a new `server/toolReply.ts`, `failureSeq` in `getError`).

Two things ACK-AND-F3.md could not yet claim are now **empirically verified** here: (1)
`"stack" as ToolType` compiles while `ToolType.x === "stack"` fails with TS2367 (probe output pasted in
Pitfall 1) — so every string-type-vs-literal comparison must go through `String(...)`; (2) the gate
`npx tsc --noEmit` is clean at HEAD and `npm run test:unit` is green at **20 files / 436 tests / ~52 s**.

One new observation not in prior research: `tool.add` validates `type` as a plain string
(`zToolBase.type: z.string().min(1)`, `routers/tool.ts:18`), so a `stack`-typed Tool row is creatable
**before** Phase 5 — meaning the OPR-04 execute-time guard is live on real rows, not just test fakes. The
planner should treat the guard as production-facing immediately (see Pitfall 7).

**Primary recommendation:** Follow CONTEXT.md D-01..D-15 exactly — they are the ACK-AND-F3.md §1–§3
design as locked decisions. The plan splits naturally into the three CONTEXT.md requirement groups:
(1) `recoveryActions.ts` + `recoveryControl` reroute + card/modal/copy/guid (OPR-01/02/03),
(2) `operatorOnlyCommands.ts` + two enforcement points (OPR-04), (3) static scans (OPR-05) — with the
scans written alongside their group, not as a separate trailing wave, since several existing pins (single
send path, `eventType`-style literal pins) must stay green while the surrounding files change.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Operator-only refuse table (OPR-04)**
- **D-01:** The refuse table includes F.A.S.T. now: `operatorOnlyCommands = { stack: ["acknowledge_failure"], fast: ["pause", "resume", "abort"] }`. One line of data, the mechanism is generic, and it turns the known legacy limitation ("saved steps resolve, nothing migrated") into an explicit audited refusal. Accepted behaviour change: a saved protocol containing such a step is refused at run creation instead of executed — none exist in this repo; if the live DB holds one, it is refused and the operator sees why. — **Reversibility:** reversible — removing the fast entries is deleting one line from the table.
- **D-02:** Two enforcement points from one table, per ACK-AND-F3.md §2.2: (a) execute time, top of the instance `Tool.executeCommand` (`controller/server/tools.ts:408`), before variable substitution, keyed on `String(this.toolType)` (not the stored JSON's `toolType`), logging "Operator-Only Command Refused" then throwing `OperatorOnlyCommandError` before any gRPC; (b) enqueue time, in `RunStore.createFromProtocol` right after `generateCommandsFromProtocol` (`controller/server/runs.ts:216`), rethrown (not wrapped in `ProtocolGenerationFailedError`) and mapped to a visible BAD_REQUEST (tRPC) / 400 (API). The guard never sits in `controlCommand` — that is the operator path.
- **D-03:** The thrown error is a plain `Error` subclass (`OperatorOnlyCommandError`), **not** coded `INVALID_ARGUMENTS`/`NOT_READY`/`WRONG_TOOL`/`UNRECOGNIZED_COMMAND` — `getError` replaces the message for those codes, which would hide the reason. A refused queued row FAILs, stays queued and reruns until Skipped; acceptable and normally prevented by the enqueue refusal. *(Research note: after Phase 3, `getError` no longer replaces messages for any code — tool text survives everywhere (`server/routers/command_queue.ts:10-29`). D-03's "plain Error subclass" still stands because it needs no code plumbing and is robust to the adapter mapping; the "would hide the reason" rationale now applies to those codes carrying the composed generic sentence in `toolReply.ts:53-65`, which `describeToolReply` appends ` Tool said: ` to — the original text no longer hidden. Keep the plain-subclass decision regardless.)*
- **D-04:** Case/whitespace-insensitive command matching (own-property lookups only — `toString`, `constructor`, `__proto__` never match), same discipline as `runControl.ts`.

**Recovery-only acknowledge path (OPR-01)**
- **D-05:** New zero-import module `server/recoveryActions.ts` (runControl.ts style): param kinds `"yesno" | "confirmYes" | "guid"`; `recoveryActions.stack.acknowledge_failure = { guid: "guid", arm_inspected: "confirmYes" }`; `recoveryActions.fast` **derived from** `runControl.fast.resume/abort` (one source of truth, pinned by a strict-equal test). `runControl` stays `{ fast }` — never extended. `validateRecoveryRequest` keeps the same refusal order and codes as `validateControlRequest`.
- **D-06:** `recoveryControl.ts` swaps `RECOVERY_ACTIONS` for `isRecoveryAction` and `validateControlRequest` for `validateRecoveryRequest`, sends `verdict.params` via `tool.controlCommand(action, params)`, keeps every `logAction` outcome line, keeps the refuse-while-this-tool's-step-is-running rule (reads `runningStep` only — never instrument state, UI-08) with a STACK-specific message, and keeps the no-deadline one-attempt send (D-23 lineage). The tRPC input needs no schema change (`z.record(z.unknown())` already fits).
- **D-07:** The operator types the guid on the **card** (empty `""` state, no default, no `onKeyDown`/`onSubmit`/form/autoFocus — the scan forbids them), the card's "Acknowledge failure…" button is disabled until the same client check as the server passes, then opens the shared `RunControlConfirmModal` with `request.params = { guid }` for the explicit `arm_inspected: "yes"` / "no" radios (nothing preselected; "No" keeps Confirm disabled). The modal restates the typed guid with acknowledge-specific copy and never shows the "instrument head will move" note. An accepted send clears the guid and latch result via the existing `afterAccepted` prop. Static scans extended to the card file (no Enter-bound default) and `controlUiModules` (no timers).
- **D-08:** Never trimmed, never coerced — the guid check is permissive: `^[^\s\u0000-\u001f\u007f]{1,256}$` (a task guid or `submit-<hex>`; a stricter format risks blocking a legitimate ack). Blank refused, never trimmed on the card either. The tool core's exact-guid check is the real gate.

**Ack while a STACK step is running**
- **D-09:** No greyed-out card during a running STACK step: the card's `tracked` flag stays false for `stack` (no `runState` reader without `runControl`), so the buttons simply stay enabled; the server refuses with "A run step is running on this tool; acknowledge after it ends." (STACK-specific text in `recoveryControl.ts`), audited as a refusal. A latch only exists after the step ends. `commandQueue.runningStep` as a card query is deferred (below).

**SUCCESS-with-message on the ack path**
- **D-10:** For the acknowledge only, a SUCCESS reply with a non-empty `error_message` is a refusal (`ok:false`, logged warning) via a scoped flag (`RECOVERY_STRICT_SUCCESS = { stack: ["acknowledge_failure"] }`) in `recoveryActions.ts`; `Tool.controlCommand` itself is unchanged so its F.A.S.T. callers and tests stay green.

**Latched guid display (OPR-03)**
- **D-11:** "Latched failure" block in the STACK Run Recovery card, above the guid input: an explicit "Read latch" button (no polling, no timer) → read-only result: guid (selectable), kind/explanation when present, raw JSON collapsible for unknown shapes, or "No failure latched". Backed by a dedicated toolId-only `tool.latchStatus` query (type derived from the DB row like `recoveryControl`, avoiding `zToolType` which rejects `"stack"` until Phase 5), calling the server-side `LATCH_READ_COMMAND` constant through `tool.executeCommand` so error/SUCCESS+message mapping behaves everywhere else.
- **D-12:** "Use this guid" fills the guid input only — it never sends and never auto-acknowledges; the operator still types nothing extra but must press "Acknowledge failure…" and confirm. The latch result **never** gates or enables the ack (avoiding a UI-08 instrument-state check) and never feeds the send path (parse the reply once, keep `controlDecision.ts` and the send hooks `/latch/i`-free).
- **D-13:** `LATCH_READ_COMMAND` is a single string constant in `recoveryActions.ts` (placeholder name, set when galago-tools Phase 4 names the command; Phase 5's contract test pins it against the generated oneof). A pure `extractLatch(meta)` tolerates unknown shapes (string `guid` at top level, under `latch`, or under `result`) and is unit-tested without proto.

**Testing posture (OPR-02, OPR-05)**
- **D-14:** Same as the repo's established style (no jsdom, no new UI deps): unit tests for `validateRecoveryRequest` refusals (wrong-ish `arm_inspected` values `no/""/" yes"/"Yes"/true/missing`, blank/whitespace/oversize/non-string guid, undeclared params, fast pause, stack resume/abort), router tests with `installFakeTool("stack-1", "stack" as ToolType)` asserting exactly `{ stack: { acknowledge_failure: { guid, arm_inspected: "yes" } } }` once, never retried, refusal while a STACK step runs, SUCCESS-with-message refusal; guard tests from queued row / `runCommand` / `createFromProtocol` (visual + script) with zero `grpc.executeCommand` calls; mislabelled `toolType` still refused at execute; static scans per OPR-05 pinning the exact `acknowledge_failure` literal file list, absence from `commandFields`/`runControl`, guard in `executeCommand` not `controlCommand`, single `tool.latchStatus` reader, `/latch/i` absent off the send path.
- **D-15:** Not provable before codegen (Phase 5's GEN-04, not repeated here): real-encoder wire test of the acknowledge payload, latch-read oneof contract, `getToolConfigDefinition("stack")`, creating a STACK tool row through `zToolType`.

### the agent's Discretion
- Exact copy of the card, modal and toasts (figurative "Acknowledge STACK failure" header, success title "STACK failure acknowledged", decision label "Arm inspected?"), as long as the rules above hold (no default, no timer, no head-moves note, guid restated verbatim).
- File/module placement of the pure helpers (`extractLatch`, client guid check — same module or `recoveryActions.ts` to share the validator).
- Plan split across the three requirement groups (ack path / refuse table / latch + scans).
- Whether `protocol.preview` also surfaces the refusal early (authoring feedback) — research §2.2 calls it optional; the enqueue refusal already gives a visible message at run creation.

### Deferred Ideas (OUT OF SCOPE)
- `commandQueue.runningStep` query to grey/disable the recovery card while a STACK step runs — future polish.
- Banner link to `/tools/<toolId>` when the failing tool is a STACK — small UX nicety.
- `protocol.preview` early refusal feedback — authoring convenience.
- Generic tool-page command-panel reply display — owned by Phase 5 (GEN-03).
- Persistent error toast for `tool.runCommand` errors on the tool page (guid loss after 10 s) — flag for Phase 5 or a quick task.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPR-01 | Operator sends STACK AcknowledgeFailure from the tool-page Run Recovery card: guid entry (blank refused, never trimmed), explicit arm-inspected `"yes"`, guid restated with ack-specific copy, no default/timer/Enter-bound default, through `tool.recoveryControl` with a recovery-only action map | Verified anchors: `recoveryControl.ts` reroute (D-06), `validateRecoveryRequest` refusal order cloned from `runControl.ts:94-158`, card/modal changes (D-07), `createConfirmedSender` recovery branch at `controlDecision.ts:333-356`, one-attempt no-deadline send at `recoveryControl.ts:76-78` |
| OPR-02 | Every ack attempt audited; refused while the queue's running step is on that tool (STACK-specific message); sent once, never retried | `logAction` at all outcomes already in `recoveryControl.ts:42-101`; refuse-while-running check `recoveryControl.ts:52-60` (reads `runningStep` only, which `command_queue.ts:1355-1361` sets for every tool step); `RECOVERY_STRICT_SUCCESS` (D-10) |
| OPR-03 | Latched guid visible on step-card error (shipped Phase 3) and via explicit "Read latch" backed by toolId-only `tool.latchStatus` (no polling); "Use this guid" fills, never sends | Step-card error shipped (`SwimLaneCommandComponent.tsx:51` `stepErrorText(command)`); latch query pattern clones `recoveryControl` mutation at `routers/tool.ts:513-533`; `extractLatch` pure + unit-testable (D-13) |
| OPR-04 | One table refuses `stack.acknowledge_failure` + fast `pause/resume/abort` at run creation (visible message) and again at `Tool.executeCommand`, audited; `controlCommand` unaffected | Two enforcement points: `tools.ts:409` top-of-method keyed `String(this.toolType)`; `runs.ts:216` post-`generateCommandsFromProtocol` with rethrow at `:246-254`; mapping in `routers/run.ts:82-98` (BAD_REQUEST with own message) and `pages/api/runs/index.ts:15-25` (400 case) |
| OPR-05 | Static scans pin: no self-acknowledge; exact `acknowledge_failure` literal file list; absent from `commandFields`/`runControl`; guard in `executeCommand` not `controlCommand`; single latch reader, off the send path | Extension surface fully mapped at HEAD: `test/staticScan.test.ts` pins enumerated in §Architecture Patterns; `extractBracedRegion`/`stripComments` helpers already exist (`staticScan.test.ts:57-174`) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ack decision & confirmation UX | Frontend (card + shared modal) | API (`tool.recoveryControl` tRPC) | The card gathers data + renders the (non-defaulted) confirmation; the server independently re-validates everything |
| Ack validation (spec, kinds, refusals) | API — `server/recoveryActions.ts` | — | Zero-import server module; the client check must be a *mirror*, never the only gate |
| Ack gRPC send (one attempt, no deadline) | API — `server/recoveryControl.ts` → `Tool.controlCommand` | DB — `logAction` audit | Single audited send path; no retry scaffolding |
| Latch read & display | API — `server/routers/tool.ts` `latchStatus` → `Tool.executeCommand` | Frontend (card block) | Server sends one fixed constant command; client renders read-only |
| Operator-only refusal (execute time) | API — `Tool.executeCommand` invariant | — | Covers every caller: queue, `runCommand`, "Send to Tool", protocol button, pre-existing SQLite rows |
| Operator-only refusal (enqueue) | API — `RunStore.createFromProtocol` | tRPC/REST error mapping | Refuses the whole run before anything is queued; visible message |
| Static invariant pins | Repository tests — `test/staticScan.test.ts` | — | Source scans, not runtime, are the enforcement (repo style, PROJECT.md) |

## Standard Stack

No external packages are installed and none are needed. Everything is first-party `controller/` code plus
existing test tooling.

### Core (existing, verified at HEAD — do not add)
| Artifact | Version | Purpose | Evidence |
|----------|---------|---------|----------|
| vitest | (repo dev dep; `vitest.config.mts`, `environment: "node"`, `testTimeout: 15000`) | Unit + static-scan tests | [VERIFIED: controller/vitest.config.mts (whole file read)] |
| tRPC + zod | (repo deps) | `recoveryControl` / `latchStatus` schemas; `z.record(z.unknown())` already carries params | [VERIFIED: server/routers/tool.ts:514-520] |
| Chakra UI + lucide-react | (repo deps) | Card/modal UI | [VERIFIED: components/runs/RunControlConfirmModal.tsx:2-16] |
| gen-interfaces ToolType | string enum, no `stack` member yet | Guard compares via `String(this.toolType)=="stack"` | [VERIFIED: gen-interfaces/controller.ts:7-32 — values quoted below] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recovery-only spec (D-05) | Adding `stack` to `runControl` | **Rejected — locked.** ACK-AND-F3.md §1.2 enumerates 7 consumer side effects incl. 2 s status poller per STACK step, three dead Pause/Resume/Abort buttons, Stop/Clear-All abort-first dead-end modal, and a second valid server path to the ack via `toolControl` |
| Guard only in `command_queue` | Instance `Tool.executeCommand` | **Rejected.** Would miss `tool.runCommand`, "Send to Tool", protocol "run command", and rows already in SQLite (ACK-AND-F3.md §2.1 table) |

## Package Legitimacy Audit

**No external packages are installed by this phase** — the entire phase is first-party code and tests.
Nothing to audit; no `checkpoint:human-verify` needed. (Phase 5 owns the ts-proto 1.151.1 regeneration;
the local ts-proto 1.153.2 must never be used there — stated in REQUIREMENTS.md GEN-01.)

## Verified Anchors at HEAD (post-Phase 3 re-pin)

Every claim below was confirmed by reading the file this session. `String(ToolType)` values for the enum
that Phase 4 needs — [VERIFIED: gen-interfaces/controller.ts:7-32], verbatim: `unknown`, `cytation`,
`opentrons2`, `pf400`, `liconic`, `dataman70`, `spectramax`, `bioshake`, `hig_centrifuge`, `bravo`,
`vcode`, `plateloc`, `xpeel`, `alps3000`, `toolbox`, `hamilton`, `microserve`, `vprep`, `plr`,
`pyhamilton`, `clariostar`, `lcus1_relay`, `fast`, `UNRECOGNIZED` — **`stack` is not a member**.

### Files ACK-AND-F3.md cited that Phase 3 did NOT touch (anchors unchanged from prior research)
Empty diff confirmed (`git diff 57d55e9..HEAD`) for: `server/runControl.ts`, `server/recoveryControl.ts`,
`server/runState.ts`, `server/runs.ts`, `server/routers/tool.ts`, `server/routers/run.ts`,
`server/trpc.ts` (empty context — `createContext = () => ({})`, :1-9),
`components/runs/controlDecision.ts`, `components/runs/RunControlConfirmModal.tsx`,
`components/tools/RunRecoverySection.tsx`, `hooks/useRunControl.ts`, `pages/api/runs/index.ts`,
`test/helpers/fakeTool.ts`. Totals changed = 0 for all of these.

### Files Phase 3 DID touch (anchors re-pinned)
| Anchor | At HEAD | Notes |
|--------|---------|-------|
| `server/tools.ts` — `_payloadForCommand` | :360-366 | unchanged body |
| `server/tools.ts` — `controlCommand` | :377-390 | comment above :368-375; returns `{ok,response,message}` |
| `server/tools.ts` — instance `executeCommand` | **:409** (was :408) | guard goes as its first statement, before the variable-substitution loop at :413-439 |
| `server/tools.ts` — static `executeCommand` | :392-407 | logs "Tool Command Execution" then resolves instance; the shareable wrapper |
| `server/tools.ts` — reply→error mapping | **moved to `server/toolReply.ts:35-85`** | `describeToolReply(command, toolId, reply)` composes and `tools.ts:601-608` throws `ToolCommandExecutionError(failure.message, failure.code)` |
| `server/tools.ts` — `ToolCommandExecutionError` | :714-727 | `codeString = String(code)`; `userFriendlyMessage = message` (no re-composition anywhere) |
| `server/tools.ts` — `getToolConfigDefinition` | :661-681 | dynamic-import-only; Phase 5's test, not this phase |
| `server/command_queue.ts` — `runningStep` getter | :292-294 | `RunningStep` interface :50-58 (`queueId, runId, toolId, toolType, command, startedAt`) |
| `server/command_queue.ts` — busy loop step | :1347-1362 | sets `_runningStep` for EVERY tool step incl. unknown/stack types; finally clears; `_runStateMonitor.start` at :1356 |
| `server/command_queue.ts` — execute failure path | :1370-1444+ | catch: abortAccepted branch :1387-1401, otherwise `commands.fail(queueId, err)` :1404 then `_recordFailure` :1432-1434 + FAILED state :1434 + "Command Failed" log :1436-1444 — this is the path a refused `OperatorOnlyCommandError` from a queued row will take |
| `server/command_queue.ts` — busy loop sleep | :998 | `await new Promise((resolve) => setTimeout(resolve, 1500))` — busy loop polls at 1.5 s |
| `server/command_queue.ts` — `failureSeq` | :71, :424-437 | `getError()` :424-426; `_recordFailure` is the only `this.error` assignment |
| `server/routers/command_queue.ts` — `getError` | :46-51 via `queueErrorPayload` :10-29 | **Phase 3 made every error's text pass through un-replaced**: `queueErrorPayload` returns `userFriendlyMessage: error.message` for ALL errors (no code-based substitution anymore). Include `seq`. D-03's plain-`Error`-subclass rule therefore needs no code-path proof — any `Error` subclass message surfaces verbatim |
| `server/toolReply.ts` — SUCCESS+message | :43-49 | whitespace-only `error_message` is NOT the empty case: the check is `text === ""` on the raw field (:44), while `hasText` (:41) only decides sentence composition |
| `test/staticScan.test.ts` | 579 lines; see §scans below | Phase 3 added QUE-08 block :365-404, error-path block :406-447, visibility block :449-518, review-fix block :520-536, G-03-3 block :538-579 |
| Phase 3 guid display surface | `components/runs/storedError.ts:6` `storedErrorText`, `components/runs/queueError.ts` `stepErrorText`, consumed at `components/runs/list/SwimLaneCommandComponent.tsx:51` | the primary latch-guid display the trade restores ACK-AND-F3.md §3.1's "nowhere on the card" gap |
| sqlite row error round-trip | `server/utils/SqliteQueue.ts:521-527` `fail(id, error)` stores `{status:"FAILED", error}`; `types/run.ts:20` `error?: unknown` | feeds `stepErrorText` |

### Key mechanics re-confirmed verbatim (discrete values)

- `runControl` template to clone — [VERIFIED: server/runControl.ts:34-40]:
  ```ts
  export const runControl: Readonly<Record<string, RunControlToolSpec>> = deepFreeze({
    fast: {
      pause: {},
      resume: { is_tip_broken: "yesno" },
      abort: { return_liquid: "yesno" },
    },
  });
  ```
- `validateControlRequest` refusal order/codes — [VERIFIED: server/runControl.ts:87-121]: fixed order
  (a) no running step → `PRECONDITION_FAILED` "No step is currently running."; (b) type has no entry →
  `PRECONDITION_FAILED` `Tool type "${runningToolType}" does not support live run control.`; (c) action
  not declared → `BAD_REQUEST` `Action "${action}" is not available for tool type "${runningToolType}".`
  — and the fail-closed value rule — [VERIFIED: server/runControl.ts:131-133]:
  ```ts
    // Never trim, case-fold, default or coerce: only the exact strings
    // "yes" and "no" are accepted.
    if (value !== "yes" && value !== "no") {
  ```
- `recoveryControl` current structure (what D-06 replaces) — [VERIFIED: server/recoveryControl.ts]:
  `RECOVERY_ACTIONS = ["resume", "abort"] as const` (:17), action refusal :40-48, refuse-while-running
  `if (runningStep !== undefined && normalize(runningStep.toolId) === normalize(toolName))` (:52-59,
  current message `"A run step is tracking this tool; use the run page."` → becomes the STACK-specific
  text from D-09 when the recovery action belongs to a non-runControl tool type), validate :64
  (`verdict = validateControlRequest(toolType, action, params)` → swap to `validateRecoveryRequest`),
  send :78 `result = await tool.controlCommand(action, verdict.decisions)` → swap to `verdict.params`,
  no-deadline comment :75-77, outcome logging :74-101.
- `createConfirmedSender` recovery branch — [VERIFIED: components/runs/controlDecision.ts]:
  `RECOVERY_UI_ACTIONS = ["resume", "abort"] as const` (:245), branch check :333-338, spec+completion
  :340-344 (`getActionSpec` + `completeDecisions`), `sendRecovery` type :277-281
  (`params: Record<string, ControlDecisionValue>` → widen to `string`), `ConfirmedControlRequest`
  :250-255 (add `params?: Readonly<Record<string,string>>`; the existing scan at
  `staticScan.test.ts:228-233` requires the interface body to contain `ControlDecisionValue` and NOT
  contain `undefined` — `params?:` satisfies both).
- Card/modal — [VERIFIED: components/runs/RunControlConfirmModal.tsx]: `RunControlConfirmModalRequest`
  :55-59 (extend with `params`), remount-per-instance :107-124 + key :123, no `<form>`/`autoFocus`
  (:213-220 modal JSX; initialFocusRef is `cancelRef` :218 — the QUE-08 scan at
  `staticScan.test.ts:378-381` bans `initialFocusRef` **only in QueueStatuscomponent.tsx**, so the
  modal's `initialFocusRef={cancelRef}` stays), per-kind radio render :233-250, `canConfirm` :162
  (`allDecisionsChosen(spec, values)` → recovery variant completes declared params), `afterAccepted`
  prop :71, `closeOnDispatch` path :182-196 (recovery card passes `closeOnDispatch` — verified in
  `RunRecoverySection.tsx:98`), `headMovesNote` :161/232 (must be null for `acknowledge_failure`).
- Card — [VERIFIED: components/tools/RunRecoverySection.tsx]: whole file (109 lines) read; visibility
  `shouldShowRecoverySection(toolType)` :44-46 → becomes `listRecoveryActions(toolType).length > 0`
  (currently `getRunControl(toolType) !== undefined`, `controlDecision.ts:378-380`); buttons :65-80;
  `tracked` :48 via `isToolTrackedByRunningStep` (`controlDecision.ts:391-399` — envelope-based;
  `RunStateMonitor.start` returns **without polling** for a tool type without a runControl entry —
  [VERIFIED: server/runState.ts:129-132]: `if (getRunControl(step.toolType) === undefined) { return; }`
  — so `tracked` stays false for STACK: exactly D-09); **the card does not pass `afterAccepted` today**
  (:95-105) — D-07's clear-guid handler is a NEW prop pass.
- Hook — [VERIFIED: hooks/useRunControl.ts]: `useConfirmedControlSend` :20-53 wires
  `sendRecovery: (input) => recoveryMutateAsyncRef.current(input)` (:41) → only its param TYPE needs
  widening; the hook stays the sole client reference to `recoveryControl` (scan `staticScan.test.ts:191-197`).
- Tool router — [VERIFIED: server/routers/tool.ts]: `zToolType = z.enum(Object.values(ToolType)...)` :15
  (rejects `"stack"` — latch query must be toolId-only), `runCommand` :495-506 (`toolType: zToolType`),
  recovery mutation :508-533 (comment :508-512 says "not restricted to RECOVERY_ACTIONS"; update the
  comment to the new module), toolType is the DB row's type (`String(record.type)` :527).
- Enqueue guard — [VERIFIED: server/runs.ts]: `generateCommandsFromProtocol` :65-114 (script branch
  :69-90 → `resolveToolTypes` :88 fills real types from workcell), `createFromProtocol` :210-261 —
  commands at :216, store :240, enqueue :243, rethrow list :246-254, wrap-unknown :257-259 (this is why
  `OperatorOnlyCommandError` must be added to the rethrow list or its message becomes the generic
  "Could not create run: ..." inside `ProtocolGenerationFailedError`),
  `ProtocolGenerationFailedError` :282-287 (constructor takes `protocolId` and replaces the text).
- Run-router mapping — [VERIFIED: server/routers/run.ts:82-98]: `ProtocolNotFoundError`→404 generic,
  `ProtocolGenerationFailedError`→BAD_REQUEST generic message :89-94, `ProtocolParamsInvalidError`→
  rethrow cause :95-97. Mapping for `OperatorOnlyCommandError` (own message, BAD_REQUEST) is inserted
  next to :89.
- REST mapping — [VERIFIED: controller/pages/api/runs/index.ts:14-25]: `switch (e.name) { case
  "ProtocolNotFoundError": 404; case "ZodError": 400; default: 500 }` — everything else is a 500 today,
  so Phase 4 adds a case keyed on the error's `name` (or imports the class) mapping to 400.
- D-10 interplay — [VERIFIED: server/tools.ts:385-389]: `controlCommand` reports ok purely from
  `reply.response === tool_base.ResponseCode.SUCCESS`, passes `message: reply.error_message` through;
  the strict-success refusal lives in `recoveryControl.ts` after the send (result.ok + non-blank message
  + `RECOVERY_STRICT_SUCCESS["stack"]?.includes(action)` → log warning, return `ok:false`), leaving
  `Tool.controlCommand` and its F.A.S.T. callers untouched.
- Latch read mechanics — [VERIFIED: server/tools.ts:610]: instance `executeCommand` returns
  `reply.return_reply ? reply : undefined` for successes, so a `latchStatus` service that wants
  `meta_data` must check `reply.return_reply` on the `ExecuteCommandReply` it gets from
  `tool.executeCommand` and pass `return_reply: true` in the `ToolCommandInfo`. FAILURE mapping is
  handled by `describeToolReply` as everywhere else (SUCCESS+non-blank message → thrown
  `ToolCommandExecutionError` — D-10-style strictness comes free here, unlike on the
  `controlCommand` path).
- galago-tools contract facts the phase leans on — [CITED:
  galago-tools/.planning/research/SUMMARY.md]: `acknowledge_failure(guid, confirm=True)` clears only on
  exact guid match (:1140-1221; REFUSALS incl. `guidMismatch`); guid is "a task guid, or
  `submit-<hex>` after an ambiguous submit" (proposed proto comment :368-374, `state-<hex>` also
  possible per the G2 row); latch read `latch_status() → {"kind","latched","guid","resultKind",
  "reason","explanation"}` (G2 row :438) whose proto wire command name is NOT yet frozen — hence the
  `LATCH_READ_COMMAND` placeholder (D-13).

## Architecture Patterns

### System Architecture Diagram

```
OPERATOR PATH (the only path that can acknowledge)
  Tool page (/tools/<id>)
    └─ RunRecoverySection [stack only: listRecoveryActions("stack")>0]
         ├─ "Latched failure" block ── click "Read latch" ─▶ tool.latchStatus (toolId-only query)
         │      └─ server: LATCH_READ_COMMAND → Tool.executeCommand → gRPC → meta_data → extractLatch →
         │             read-only display (never enables/gates/sends anything) ──┐
         ├─ guid Input ("" state, never trimmed, client check mirrors server)  │
         │      └─ "Use this guid" fills input (never sends) ──────────────────┤
         └─ "Acknowledge failure…" (disabled until guid passes client check)
                └─ shared RunControlConfirmModal (params={guid}, radios "" both)
                      └─ operator picks "Yes" (nothing preselected, no timer, no Enter default)
                            └─ createConfirmedSender (single send gate, one flight)
                                  └─ tool.recoveryControl (tRPC, toolType from DB row)
                                        └─ recoveryControl(): logAction every outcome
                                              1. isRecoveryAction? else BAD_REQUEST (logged)
                                              2. runningStep on THIS tool? → PRECONDITION_FAILED
                                                 (STACK-specific message, logged)
                                              3. validateRecoveryRequest → verdict.params else BAD_REQUEST
                                              4. Tool.controlCommand("acknowledge_failure",
                                                   {guid, arm_inspected:"yes"}) — ONE send, no deadline
                                              5. SUCCESS + non-blank msg & RECOVERY_STRICT_SUCCESS → refusal
                                              6. SUCCESS → ok (accepted) → card clears guid + latch result
                                                     afterAccepted
```

```
REFUSED PATHS (OPR-04) — every non-operator route to a tool
  Any protocol step / imported JSON / script protocol / queue row / tool.runCommand
  ("Send to Tool", protocol "run command", tool-page panel)
        │
        ├─ ENQUEUE: RunStore.createFromProtocol
        │     commands = generateCommandsFromProtocol(...)          (runs.ts:216)
        │     ▶ isOperatorOnlyCommand(String(toolType-as-declared), command)? (scan each command)
        │        YES → logAction "Operator-Only Command Refused ... stage=enqueue"
        │               + throw OperatorOnlyCommandError          (rethrow list runs.ts:246-254)
        │               ▶ run.create tRPC → BAD_REQUEST with own message (routers/run.ts)
        │               ▶ POST /api/runs → 400 (pages/api/runs/index.ts)
        │        no run is stored, nothing is queued — visible message, never a FAILED row
        │        NOTE: the enqueue check keys on the DECLARED step type; a mislabelled step can slip
        │              past it — the execute-time guard is the backstop (intentional layering)
        │
        └─ EXECUTE: Tool.executeCommand (static → instance)         (tools.ts:392/:409)
              ▶ guard FIRST STATEMENT of the instance method (before variable substitution),
                keyed on String(this.toolType) — the instance's real type, never
                command.toolType (stored JSON, untrusted)
                 YES → logAction "Operator-Only Command Refused ... stage=execute"
                     + throw OperatorOnlyCommandError BEFORE any gRPC
                 from queue: row FAILED, stays queued, re-fails on Start until Skipped
                     (queue path command_queue.ts:1370-1444); normally unreachable because
                     the enqueue refusal exists
                 from runCommand: tRPC error with own message; tool-page shows toast
                 NEVER from controlCommand: that method calls grpc.executeCommand directly
                     (tools.ts:377-390) and carries the operator's audited confirmation
```

### Recommended file map (new vs modified at HEAD)

**New** — keep them zero-import (the pattern `server/runControl.ts` establishes: no imports at all, so
`controlDecision.ts` and tests can import them as values on the client; verified rule reference:
`controlDecision.ts:3-12` imports only zero-import modules + type imports):
- `server/recoveryActions.ts` — recovery spec by tool type, `RecoveryParamKind`, `getRecoverySpec`,
  `listRecoveryActions`, `isRecoveryAction`, `validateRecoveryRequest`
  (_same refusal order/codes as `validateControlRequest`_ but returning
  `{ ok: true, params: Record<string,string> }`), `RECOVERY_STRICT_SUCCESS`, `LATCH_READ_COMMAND`,
  optionally the shared client/server guid check function.
- `server/operatorOnlyCommands.ts` — `operatorOnlyCommands` table, `isOperatorOnlyCommand(toolType,
  command)`, `OperatorOnlyCommandError`.
- tests: `test/recoveryActions.test.ts`, `test/operatorOnly.test.ts`, `test/latchStatus.test.ts`
  (name at discretion); extensions to `test/recoveryControl.test.ts`, `test/controlDecision.test.ts`,
  `test/runControl.test.ts` (pin `runControl` unchanged, add `recoveryActions.fast` derivation pin),
  `test/staticScan.test.ts`, `test/tools.test.ts` (execute-time guard via fake tool).

**Modified** (all verified stable as of this research):
- `server/recoveryControl.ts` (D-06 + D-09 message + D-10 strict-success)
- `server/routers/tool.ts` (comment :508-512 + new `latchStatus` query at the end of the router, after :533)
- `components/runs/controlDecision.ts` (recovery spec swap, `ConfirmedControlRequest.params`,
  `sendRecovery` param widening, copy maps + `restateChoice` ack branch + `headMovesNote` null for
  `acknowledge_failure`)
- `components/runs/RunControlConfirmModal.tsx` (request params, per-kind render, recovery spec source)
- `components/tools/RunRecoverySection.tsx` (buttons from `listRecoveryActions`, guid input, latch
  block, `afterAccepted` wiring)
- `server/tools.ts` (instance `executeCommand` guard, :409)
- `server/runs.ts` (enqueue scan + rethrow list)
- `server/routers/run.ts`, `pages/api/runs/index.ts` (error mapping)
- `test/staticScan.test.ts`, `test/runControl.test.ts`, `test/controlDecision.test.ts`,
  `test/recoveryControl.test.ts`, `test/tools.test.ts`

**Unchanged on purpose** (and pinned by scans): `server/runControl.ts`, `server/runState.ts`,
`server/command_queue.ts` (except nothing — no Phase 4 edits needed there), `components/runs/ControlBar.tsx`,
`stopInterception.ts`, `InstrumentStopModal.tsx`, `QueueStatuscomponent.tsx`, `hooks/useRunControl.ts`
(param-type widening only), `Tool.controlCommand`, `commandQueue.toolControl`, `components/tools/constants.ts`.

### The zero-import spec + validator pattern (copy from runControl.ts)

**What:** a plain module that declares capability data as a deep-frozen record and nothing else; editors
look up tools' capabilities client-side; validators fail closed with fixed refusal order and codes.

**When to use:** every new capability map in this repo (this phase adds two).

**Example — the shape D-05 specifies** (kinds/values verified against CONTEXT.md; deepFreeze normally
lives in runControl.ts:18-29 — since recoveryActions must be zero-import, duplicate the 12-line
deepFreeze there or the planner can inline it; server/operatorOnlyCommands.ts likewise):

```ts
// server/recoveryActions.ts — no imports (deepFreeze copy is the module's own)
export type RecoveryParamKind = "yesno" | "confirmYes" | "guid";

// yesno      : exactly "yes" or "no" (fast resume/abort — values come from runControl)
// confirmYes : exactly "yes"; anything else refused ("no" also never leaves the client useful)
// guid       : ^[^\s\u0000-\u001f\u007f]{1,256}$ — never trimmed or coerced
export const recoveryActions = deepFreeze({
  fast: {
    resume: runControlSnapshot.fast.resume,   // derived at module init in runControl.ts style;
    abort: runControlSnapshot.fast.abort,     // NOTE: "derived from runControl" per D-05 is by
  },                                          // VALUE COPY at authoring + a strict-equal test
  stack: { acknowledge_failure: { guid: "guid", arm_inspected: "confirmYes" } },
});
```

*Planner note on "derived":* `runControl.ts` cannot be imported into a zero-import module. Two compliant
implementations: (a) redefine the two specs inline in `recoveryActions.ts` **and** add a strict-equal
test `recoveryActions.fast.resume === runControl.fast.resume` (deep object equality), or (b) have
`runControl.ts` re-export the recovery-relevant entries — but runControl must not import recoveryActions
either, so (a) with the pin test is the pattern both research documents imply. Same for
`Object.keys(runControl)`-pinning test at `test/runControl.test.ts:12-18` — keep `["fast"]` exact.

### The operator-only guard (D-02) — the exact insertion points

```ts
// server/tools.ts, FIRST statement of `async executeCommand(command: ToolCommandInfo)` (instance, :409)
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

```ts
// server/runs.ts createFromProtocol, right after `const commands = await generateCommandsFromProtocol(...)` (:216)
for (let i = 0; i < commands.length; i++) {
  const c = commands[i];
  if (isOperatorOnlyCommand(String(c.toolType), c.command)) {   // declared type: cheap early layer
    await logAction({ level: "warning", action: "Operator-Only Command Refused",
      details: `protocolId=${protocolId} step=${i} toolId=${c.toolId} toolType=${c.toolType} command=${c.command} stage=enqueue` });
    throw new OperatorOnlyCommandError(
      `Step ${i} sends "${c.command}" on tool "${c.toolId}", which is an operator action; ` +
        "remove that step or run it from the tool page Run Recovery card.",
    );
  }
}
```
Then: add `OperatorOnlyCommandError` to the rethrow list (`runs.ts:248-254`), map in
`routers/run.ts` next to :89 (`instanceof OperatorOnlyCommandError → TRPCError BAD_REQUEST with
e.message`), and add a 400 case in `pages/api/runs/index.ts` (key by `e.name === "OperatorOnlyCommandError"`
or import the class; default today is 500 — [VERIFIED: pages/api/runs/index.ts:22-23]).

**Command matching (D-04):** case/whitespace-insensitive on the command, own-property lookups only:
```ts
export function isOperatorOnlyCommand(toolType: string, command: string): boolean {
  const t = Object.prototype.hasOwnProperty.call(operatorOnlyCommands, toolType) && operatorOnlyCommands[toolType];
  if (!t) return false;
  const c = String(command).trim().toLowerCase();       // refused for " ACKNOWLEDGE_FAILURE ", " Acknowledge_Failure "
  return (t as readonly string[]).includes(c);
}
```

### Static-scan extension surface (OPR-05) — what exists at HEAD and what each new pin touches

Existing pins that must stay green (`test/staticScan.test.ts`):
- **single send path** :191-268 — `toolControl|recoveryControl` regex matches ONLY `hooks/useRunControl.ts`
  (:196); the new card code must not mention `recoveryControl` anywhere or it breaks this pin. New
  `tool.latchStatus` query references are unaffected (regex is specific).
- **`confirmed-send hook` used only by the confirm modal** :207-214 — new hook files for the latch
  query are fine (they use `trpc.*.useQuery`, not `useConfirmedControlSend`).
- **send called only from Confirm handler** :216-226 (`extractBracedRegion` on `const handleConfirm =`).
- **send gate takes completed decisions** :228-233 — `ConfirmedControlRequest` body contains
  `ControlDecisionValue`, no `undefined`.
- **`.controlCommand\(` callers** :235-254 — exactly `server/command_queue.ts:1` + `server/recoveryControl.ts:1`
  (definition only in `server/tools.ts`). The latch implementation must call `tool.executeCommand(...)` —
  `.controlCommand\(` pattern doesn't match, fine — but if the planner ever routed the latch read through
  `controlCommand` it would break THIS pin. `executeCommand` is correct per D-11.
- **router entries** :256-268 — `recoveryControl({` only in `server/routers/tool.ts` (unchanged by the
  reroute; method name stays).
- **no timers in `controlUiModules`** :275-292 — `RunRecoverySection.tsx` is already in the list (:284);
  if any new client module is created for the latch UI that renders the card block, ADD it to the list
  (D-07 explicitly says so).
- **countdown-modal reuse** :294-327 — card already listed (:302).
- **no instrument-state check** :341-356 — pattern `/runState|_runStateMonitor|fetchStatus|getStatus|\.status\b/`
  over `recoveryControl.ts` whole file + `toolControl` body + `createConfirmedSender` body. Extend this
  pattern with `|latch` (D-12) — after the strict-success reroute, `recoveryControl.ts` must remain
  free of both `latch` and the instrument-state names.
- **no Enter-bound default** :358-362 — currently `/<form|autoFocus|defaultValue|defaultChecked/` over
  `RunControlConfirmModal.tsx` + `ToolPausedModal.tsx`. Extend file list with
  `components/tools/RunRecoverySection.tsx` and pattern with `onKeyDown|onSubmit|type="submit"`
  (D-07 note: the QUE-08 scan at :381 also bans `initialFocusRef` there — that ban is only for that
  file, keep the modal's `initialFocusRef={cancelRef}`).
- **Phase 3 helper scans** :499-504 — runOutcome/queueError/storedError/queuedStartSummary stay
  React-free and timer-free (untouched by Phase 4 unless helpers are added; put any new pure helper in
  `server/recoveryActions.ts`, not under `components/runs/`).

New pins (each keyed to an OPR-05 clause; all implementable with `walk`/`read`/`stripComments`/
`extractBracedRegion` which already exist in the file):
1. `acknowledge_failure` literal lives ONLY in `server/recoveryActions.ts`,
   `server/operatorOnlyCommands.ts`, and `components/runs/controlDecision.ts` (command name strings in
   copy/`restateChoice`/`confirmHeader` switch) — write it the same way the `:196`-style pinned lists
   do (`toStrictEqual([...sorted rels...])` over every non-test `.ts/.tsx` under `controller/` —
   `walk` covers non-test code; adding `test/` files to the walk is optional but a future task may add
   `-test` files, so keep the walk limited to the same root dirs as existing scans, i.e.
   `components`, `hooks`, `pages`, `server` — one of the keep-green considerations when the message text
   mentions "Run Recovery card" not the literal).
2. `Object.keys(runControl)` stays `["fast"]` (already effectively pinned at `test/runControl.test.ts:12-18`
   with `toStrictEqual`; add the same pin for `commandFields.stack === undefined` — `commandFields` at
   `components/tools/constants.ts:1` has no `stack` key today, verified by reading the top of the
   export).
3. Guard in the generic path, not the control path: `extractBracedRegion(toolsSrc,
   /async executeCommand\(command: ToolCommandInfo\)/)` instance-body contains `isOperatorOnlyCommand(`
   and `OperatorOnlyCommandError`; the `controlCommand` body (match `async controlCommand\(`) contains
   neither. (The static wrapper `async executeCommand(command: ToolCommandInfo)` is also extractable
   with the same decl regex — two matches; disambiguate with `/async executeCommand\(command: ToolCommandInfo\) \{\s*const params/`.)
4. `components/tools/RunRecoverySection.tsx` free of `onKeyDown|onSubmit|type="submit"`.
5. `/latch/i` absent from `recoveryControl.ts`, `components/runs/controlDecision.ts`,
   `components/runs/RunControlConfirmModal.tsx`, `hooks/useRunControl.ts` (send path stays latch-free).
6. `tool.latchStatus` referenced by exactly one file (the card's hook/consumer file — pin the exact
   file list like :196).
7. `.controlCommand(` callers stay `command_queue.ts:1` + `recoveryControl.ts:1` — via the existing pin.
8. No self-acknowledge: only `.controlCommand\(` callers stay that pair (existing :235-248) and the
   `recoveryControl` router stays `routers/tool.ts` only (existing :264-267).

Scan-time false positives to write around:
- **stripComments:** the file :56-111 preserves string/template-literal contents verbatim, so the
  `acknowledge_failure` literal inside any message string counts as a match — the file list must
  anticipate the refusal error messages in `operatorOnlyCommands.ts` + `controlDecision.ts`; the
  refusal messages land in `operatorOnlyCommands.ts` (execute/enqueue) and the request-specific copy in
  `controlDecision.ts`. Keep those two files in the pinned list and treat every OTHER empty file as
  failure.
- **no ` command.command==="stack"` enum comparisons:** the scans are source-level; the TS2367 probe at
  Pitfall 1 is the compile-time backstop; no scan required (it cannot compile).

### Anti-Patterns to Avoid
- **Adding a whitelist to `commandFields` as the "operator-only" mechanism:** hiding a command from
  `commandFields` only blanks it from the two editors; it doesn't stop imported JSON, script protocols,
  or `tool.runCommand` (which is `z.string()` with no allow-list, `routers/tool.ts:500`). The table +
  two enforcement points is the mechanism (ACK-AND-F3.md §2.1, verified again this session).
- **Keying the execute-time guard on `command.toolType`:** that comes from the stored/untrusted JSON
  (`runs.ts:96-113` maps it verbatim from step data). Only `String(this.toolType)` is the Tool's real
  type — [VERIFIED: server/tools.ts:140-146].
- **Leaving the ack "greying out" to runState:** the tool page's `tracked` flag comes from
  `commandQueue.runState`, which never reports `running:true` for a tool type without a runControl
  entry (runState.ts:129-132 behavior verified verbatim above) — there is no UI-level loading gate for
  a STACK step; the server refusal (D-09) is the correct UX.
- **Validating the guid "format" strictly:** the D-08 pattern is permissive; the core's exact-guid
  check is the gate (galago-tools Pitfall 5 — galago-tools research SUMMARY.md :294-298).
- **Retrying on transport error on the ack path:** the D-23 lineage - one attempt, no deadline, never
  retried; the same strictness as recoveryControl today.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fail-closed validator with fixed refusal order | A new bespoke validator with its own code/message scheme | Clone the `validateControlRequest` order/codes (`runControl.ts:94-158`) into `validateRecoveryRequest` | The refusal order is a locked decision (D-05); matching codes keep tRPC/REST mappings uniform |
| Static invariant enforcement | A bespoke lint rule / CI check | Extend `test/staticScan.test.ts` (walk/stripComments/extractBracedRegion already there) | Repo style per PROJECT.md; zero new deps; runs on `npm run test:unit` |
| Confirmation rubric (radios, no default, no timer) | A new confirm component for ack | Reuse `RunControlConfirmModal` (remount-per-instance is subtle: :97-124 handles both null→non-null and non-null→different-non-null) | WR-07 graded that remount logic in review; a second component re-opens that class of bug |
| Persistent audit | Console lines / new log sink | `logAction({level, action, details})` | Existing Logs page reads it; scans/tests assert on it |
| Own-property-safe lookups | `Object.keys`-based guards, `in` operator | The `Object.prototype.hasOwnProperty.call(...)` idiom used in `runControl.ts`/`controlDecision.ts` | Prototype-pollution-safe by construction (`toString`, `constructor`, `__proto__` never match) |

**Key insight:** every hard part of this phase (fail-closed validation, confirmation UX, audited send,
static enforcement) already exists in a Phase-1/2-shaped file this phase should clone, not reinvent.

## Runtime State Inventory

Not a rename/refactor phase, but the refusal introduces a behaviour change against persisted state —
audited explicitly because a refusal sleeping in SQLite is a real operator-visible event:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | SQLite queue rows already holding a queued step that sends `stack.acknowledge_failure` or fast `pause/resume/abort` (possible only via imported JSON / legacy saved steps; **none in this repo's tests** — verified: no test data contains them; the live DB is not inspectable from here) | Accepted behaviour (D-01/D-03): the row FAILs, stays queued, re-fails until Skipped; the enqueue guard should make it a never-case. Optional `command_queue` note in docs: if the live DB holds one, the operator sees the message |
| Live service config | None found — no config files contain `stack` tool wiring (`commandFields` has no `stack` key) | None — verified by reading `components/tools/constants.ts` top and grepping |
| OS-registered state | None (nothing in this phase registers OS state) | None |
| Secrets/env vars | None — no new env vars | None |
| Build artifacts | None — no new packages, no codegen | None (ts-proto regeneration is Phase 5's) |

## Common Pitfalls

### Pitfall 1: The ToolType enum will bite any `"stack"`-vs-enum comparison at compile time
**What goes wrong:** `ToolType.fast === "stack"` and even `function f(t: ToolType){return t === "stack"}` fail to compile.
**Why it happens:** `ToolType` is a closed string enum without `stack` membership yet; TS2367 fires on disjoint literal comparisons.
**How to avoid:** guard on `String(this.toolType) === "stack"` / string-typed spec keys (`toolType: string` params); fakes are `"stack" as ToolType`.
**Verification (executed this session, project-compiled with `-p .`):**
```
probe-tmp.ts(3,13): error TS2367: This comparison appears to be unintentional because the types 'ToolType.fast' and '"stack"' have no overlap.
probe-tmp.ts(4,34): error TS2367: This comparison appears to be unintentional because the types 'ToolType' and '"stack"' have no overlap.
```
`"stack" as ToolType` on the same file produced NO error (only TS6133 unused-variable warnings on the
probe lines). The same run also confirmed the repo typechecks clean at HEAD (exit code 2 caused solely
by the probe's own errors; removing the probe → tsc-exit 0). Also: the entire `tsc --noEmit -p .` run
produced only the probe's 5 errors → **no pre-existing type errors at HEAD**.

### Pitfall 2: Throwing a coded `ToolCommandExecutionError` for the refusal would bury the reason
**What goes wrong (historical):** the GET-error router previously replaced operator text for INVALID_ARGUMENTS/NOT_READY/WRONG_TOOL/UNRECOGNIZED_COMMAND (ACK-AND-F3.md §4.2 item 1).
**How it is at HEAD:** `[VERIFIED: server/routers/command_queue.ts:10-29]` — `queueErrorPayload` returns
`userFriendlyMessage: error.message` for every error now (Phase 3 shipped the fix) and `code: (error as {code?:unknown}).code` when present. But `describeToolReply` still composes a generic sentence + ` Tool said: <text>` for those codes (`toolReply.ts:51-75`), so a coded refusal still reads generic-first.
**How to avoid:** keep D-03 (plain `Error` subclass, no `code`), so nothing composes over the message.
**Warning signs:** a refusal message rendered as an ERROR_FROM_TOOL-with-suffix instead of its own sentence.

### Pitfall 3: The enqueue refusal wrapped as ProtocolGenerationFailedError loses its message
**What goes wrong:** `RunStore.createFromProtocol`'s catch wraps everything not in the rethrow list
(`runs.ts:246-254`) into `ProtocolGenerationFailedError(protocolId)` — whose constructor replaces the
body with `Could not generate commands for protocol ID '<id>'.` (`runs.ts:282-287`) — and
`routers/run.ts:89-94` re-replaces THAT with a generic sentence.
**How to avoid:** add the class to the rethrow list and map it explicitly (BAD_REQUEST + own message) in both routers/run.ts and pages/api/runs/index.ts (which currently defaults unknown names to 500 — verified :22-23).
**Warning signs:** an operator seeing "Could not generate commands..." instead of the actual offending step/tool/command.

### Pitfall 4: `describeToolReply` has a subtle SUCCESS-with-message shape
**What goes wrong (planner temptation):** conditioning the D-10 strict-success rule on a blank check
against `.trim()` and forgetting `describeToolReply`'s own rule is `text === ""` on the raw field, not
`!text.trim()` — whitespace-only messages are "present" to the thrower (`toolReply.ts:41-49`) and are
what STK-07 says must never happen (`SUCCESS` must have an empty `error_message`).
**How to avoid:** mirror `describeToolReply`'s exact semantics in the `RECOVERY_STRICT_SUCCESS` check
(test the strict-success behaviour with the same reply-shape fixtures `test/toolReply.test.ts` uses).
**Warning signs:** `trim()` disagreement between the qi and the `controlCommand` path producing
inconsistent refusal toasts.

### Pitfall 5: The `recoveryActions.fast` "derived from `runControl`" language is easy to mis-implement
**What goes wrong:** importing `runControl` into `recoveryActions.ts` destroys the zero-import property
that lets `controlDecision.ts` and tests safely depend on it client-side.
**How to avoid:** value-copy the two fast entry objects in the module and pin drift with strict-equal
tests (`test/recoveryActions.test.ts`: `recoveryActions.fast.resume` `toStrictEqual`
`runControl.fast.resume`), while a NEW pin keeps `Object.keys(runControl)` at `["fast"]` forever
(the existing `toStrictEqual({fast: ...})` at `test/runControl.test.ts:12-18` is that pin — do not
touch it).
**Warning signs:** importing runControl into a zero-import module (compile would allow — it's
import-less, not check-enforced) → add an explicit scan if the planner wants belt-and-braces.

### Pitfall 6: The `no instrument-state check` scan will fail spuriously unless the pattern extension is deliberate
**What goes wrong:** `staticScan.test.ts:341-356` scans `recoveryControl.ts` `whole-file` for
`/runState|\.status\b/…`. After D-06, `recoveryControl.ts` still only reads `runningStep` — adding the
extra `/latch/i` clause (D-12) is safe because `LATCH_READ_COMMAND` lives in `recoveryActions.ts`, not
in recoveryControl.ts (that module must stay `/latch/i`-free).
**How to avoid:** keep the constant and the extractor in `recoveryActions.ts` and the display
consumer in the card; scan for absence, not presence (see pins 5 & 6 in the scan list).
**Warning signs:** any `/latch/i` hit in a file the scan forbids.

### Pitfall 7: A `stack` Tool row is creatable before Phase 5 — the execute-time guard is production-facing on day one
**What goes wrong (planner assumption risk):** assuming the only stack-typed Tool instances are test
fakes. `[VERIFIED: server/routers/tool.ts:17-29]` — `zToolBase.type: z.string().min(1, "Type is required")`
(an add/edit input), and `Tool.forId(..., record.type as ToolType)` builds a real instance at
`routers/tool.ts:484-489`/`:523` from the DB row. A `stack`-typed row created via `tool.add` today (the
UI's type list may or may not offer it) would hit the real Tool class.
**How to avoid:** treat the execute-time guard as live; test it against a fake **and** note in the plan
the queue-row test mirrors the fail-with-stored-error path (`SqliteQueue.ts:521-527` +
`command_queue.ts:1404-1444`) so the row-fails-and-stays-queued acceptance is exercised.
**Warning signs:** a stack Tool row in the live DB sending `run_sequence`-type commands to a wrong endpoint
(the payload would still fail at the tool; core refuses it before any gRPC).

### Pitfall 8: The single-file pins for `stepErrorText`/`acknowledge_failure`-literal scans will break if new copy files are introduced in this phase
**What goes wrong:** the literal-scan pins exact file lists. Any new module containing the string
`acknowledge_failure` (e.g., a new display/routes file) must be added deliberately to the pinned list —
or the scan fails the suite.
**How to avoid:** keep those two strings only in the three files the D-14 pinned list names. The card/modal copy for the ack should map `confirmHeader("acknowledge_failure")` etc.
via copy maps in `controlDecision.ts` (its literals live there today — the research confirms
`CONFIRM_HEADERS` :183-187, `SUCCESS_TITLES` :195-199, `DECISION_LABELS` :207-210, `restateChoice`
:221-238).
**Warning signs:** failing toStrictEqual with path "server/<new-file>.ts".

### Pitfall 9: Tests that drive the busy loop (queue-row refusal test) are slow
**What goes wrong:** underestimating runtime when the busy loop sleeps 1.5 s per iteration
(`command_queue.ts:998`).
**How to avoid:** heighten `testTimeout` locally per test/`describe` to 15–30 s (the existing
`test/recoveryControl.test.ts` "stays pending until the tool replies" precedent uses a deferred
promise at :98-116 to avoid busy waiting for the ack case; queue-row tests can rely on
`queue._start()` + `getError` + the fake 1.5 s loop — see `test/toolControl.test.ts` pattern).

### Pitfall 10: `protocol.preview` is NOT touched (deferred) — but `routers/protocol.ts`'s preview path can still return an operator-only refusal as a 500 today
**What goes wrong:** if the planner includes the optional preview check (CONTEXT.md discretion), the
`{success:false, error}` return shape must be honoured, but that is OUT OF SCOPE per the deferred list.
**How to avoid:** leave `protocol.preview` alone; the enqueue guard already gives the visible BAD_REQUEST
at run creation.

## Code Examples

### Shared modal extension (per-kind render, no default, no head-moves note)

```tsx
// Import verified at HEAD (RunControlConfirmModal.tsx:17-27)
import {
  getActionSpec, emptyDecisions, allDecisionsChosen, completeDecisions,
  confirmHeader, restateChoice, decisionLabel, runAfterAccepted, headMovesNote,
} from "./controlDecision";
// ... D-06 needs the same set with getRecoverySpec/completeRecoveryEntries/isRecoveryAction.
```
- `RunControlConfirmModalRequest` (:55-59): `target, toolType, action` exist; extend with
  `params?: Readonly<Record<string,string>>` (D-07).
- `confirmColorScheme = request.action === "abort" ? "red" : "teal"` (:163) — the ack should get
  ack-specific colouring at the card's discretion (modal's copy prop already allows `confirmLabel`).
- For `confirmYes`, today's radio block (:233-250) already renders Yes/No radios with NO preselection
  (`value={values[name] ?? ""}`) — no modal change is strictly needed for that kind beyond wiring the
  recovery spec (the disabled Confirm at :263 follows automatically since "No" is a valid choice — the
  D-07 requirement "No keeps Confirm disabled" means Confirm only fires with the arm_inspected
  requirement met as `"yes"`; with recovery spec semantics, "No" is honestly a legal answer and the send
  path will refuse server-side — CONTEXT.md's wording ("nothing preselected; «No» keeps Confirm
  disabled") is best honoured by keeping Confirm disabled until `arm_inspected === "yes"`, i.e. wire
  `canConfirm` against a client-side completion of `confirmYes`-and-mandatory-"yes" semantics).
- For `guid`, the modal shows the guid restated read-only (`request.params.guid`), never an input
  (ACK-AND-F3.md §1.3 anchor: entry lives on the card, modal restates).

### Card state + latch block

```tsx
// RunRecoverySection.tsx today (verified :38-109) has: bgColor, runControlQuery, request, pendingAction.
// Phase 4 adds:
//   guid state with useState("") and no onKeyDown/onSubmit/form
//   latch block: "Read latch" button → trpc.tool.latchStatus.useQuery(...) triggered by explicit click
//     (e.g. useQuery with enabled:false + refetch, or a useState-driven clicked flag + useQuery
//     guarded so no polling happens — the no-timers scan forbids setInterval in this file)
//   "Use this guid" fills the state (never sends)
//   "Acknowledge failure…" disabled until the shared client guid check passes
```
The existing `afterAccepted` prop on the modal (`RunControlConfirmModal.tsx:71`) is the mechanism to
clear both guid state and the latch result once the send is accepted; the card currently doesn't pass
it — add it (D-07).

### Latch query (server side), cloned from the recovery mutation's toolType derivation

```ts
// Pattern verified at server/routers/tool.ts:513-533:
latchStatus: procedure
  .input(z.object({ toolId: z.string() }))          // toolId ONLY — zToolType rejects "stack" until Phase 5
  .query(async ({ input }) => {
    const record = await getToolFromDB(input.toolId);
    const tool = Tool.forId(record.name, record.ip, record.port, record.type as ToolType);
    // toolType is the DB row's type (String(record.type)) — matches "stack" before codegen in tests/
    // real stack rows alike (see Pitfall 7). Implementation detail left to the plan:
    //   const reply = await tool.executeCommand({
    //     toolId: tool.id, toolType: tool.type, command: LATCH_READ_COMMAND, params: {},
    //   });
    //   → `executeCommand` returns `reply.return_reply ? reply : undefined` (tools.ts:610);
    //   → latch display reads reply?.meta_data via pure extractLatch (D-13).
  }),
```

### Refusal message test (mirrors the existing pattern in test/recoveryControl.test.ts)

```ts
// Pattern verified at test/recoveryControl.test.ts:39-86:
describe("operator-only guard", () => {
  let stackGrpc: FakeGrpc;
  beforeEach(() => {
    stackGrpc = installFakeTool("stack-1", "stack" as ToolType).grpc;
    // ToolType is a string enum — verified by the probe that "stack" as ToolType compiles clean
  });
  it("refuses a queued stack.acknowledge_failure with zero grpc.executeCommand calls", ...);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sendMessage`-style code-based error text substitution in `getError` | `queueErrorPayload` returns every error's text verbatim (toolReply composition) | Phase 3 | OPR-04's refusal messages surface untouched; D-03 is now belt-and-braces rather than load-bearing, but keep the plain subclass (less coupling to that router's shape) |
| No per-step error on the card (guid only visible on banner/logs) | `stepErrorText(command)` renders stored error under CommandImage (`SwimLaneCommandComponent.tsx:51` + G-03-3 scan :538-578) | Phase 3 | OPR-03's primary display surface already exists — Phase 4 only adds the latch read + "Use this guid" |
| Missing banner re-arm (`isErrorVisible` never set true again) | `dismissedSeq`-based re-arm (Phase 3) | Phase 3 | The failure re-appears on each new failure; the guid remains reachable from the banner → ack-flow UX gap closed upstream |
| run-side `calculation` of matched commands only from `commandFields` | No allow-list on `tool.runCommand` at all (`z.string()`) | (previous design) | The execute-time guard is the layering partner to hide-from-editors (D-20 mechanism) |
| ts-proto local 1.153.2 present | ts-proto 1.151.1 is the sanctioned regeneration target | Milestone constraint (REQUIREMENTS.md GEN-01) | Phase 4 does **not** regenerate; keep the phase proto-free |

**Deprecated/outdated in this phase's scope:**
- `RECOVERY_ACTIONS` / `RECOVERY_UI_ACTIONS` as hard-coded arrays: replaced by the spec-derived
  `isRecoveryAction` / `listRecoveryActions` (D-05/D-06). Their *names* may remain as tests until the
  swap, but the scan surface (ACK-AND-F3.md §1.6 item about them) should be rewritten in the same phase.
- The `toolType: ToolType` restriction on `tool.runCommand`: unchanged this phase (locked: no
  `commandFields.stack`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `LATCH_READ_COMMAND` is a PLACEHOLDER name to be set when galago-tools Phase 4 names the latch-read proto command (likely `GetFailureLatch` per the galago-tools research's `GetFailureLatch` → `latch_status()` binding — [CITED: galago-tools SUMMARY.md:438, 465]) | D-13; §Anchors | Phase 5's contract test renames it; low impact because one constant owns the name |
| A2 | The latch reply arrives in `meta_data` (generated decoder unwraps the Struct to a plain object) and Phase 4's `extractLatch` shape tolerance (string `guid` at top level / under `latch` / under `result`) covers the adapter's wire shape | D-11/D-13 | Renderer falls back to raw-JSON collapsible (already in D-11); zero ack-path risk since the latch never feeds the send |
| A3 | `"stack" as ToolType` cast compiles cleanly | §Pitfall 1 (**now verified by probe, as stated**) | none (verified) |
| A4 | `recoveryActions.fast` value-copy + strict-equal pin satisfies D-05's "derived from" without breaking zero-import | §Architecture Patterns | If the reviewer intended structural import, the module can still import `runControl` (it has no imports itself) with runControl's values deep-frozen — but that would make `recoveryActions.ts` import-carrying; flag during plan-check if contested |
| A5 | A stack Tool row via `tool.add` is effectively unreachable from the tool page UI list (type input may be a fixed select of editor-known types) | §Pitfall 7 | Only affects the "is the guard production-facing" framing; the guard is live and correct either way |
| A6 | `getError`'s `queueErrorPayload` behaviour will not regress before Phase 4 lands (Phase 3 code at `routers/command_queue.ts:10-29`) | §Pitfall 2 | D-03 + the execute-time guard would still work (plain Error subclass passes through any future router shape) |

## Open Questions

1. **Should the OPR-04 enqueue scan also reject in `protocol.preview`?**
   - What we know: CONTEXT.md lists it as discretion ("optional; the enqueue refusal already gives a
     visible message at run creation"), and ACK-AND-F3.md §2.2 marks it optional.
   - What's unclear: whether authoring feedback is worth the double-check.
   - Recommendation: leave OUT of Phase 4 (deferred), since the enqueue refusal already surfaces a
     visible BAD_REQUEST at run creation and the deferred list puts it there explicitly.
2. **Which module hosts the client guid checker (same as server vs `components/tools/`)?**
   - What we know: D-05/discretion — "same module or `recoveryActions.ts` to share the validator";
     the pattern elsewhere is "pure logic + static scan" helpers in the server-zero-import module.
   - Recommendation: host in `recoveryActions.ts`, imported by the card (zero-import is the
     established client-safe server module pattern, used by `controlDecision.ts` today).
3. **Test file naming for the execute-time guard**
   - What we know: ACK-AND-F3.md §6.1 lands the guard tests in `test/operatorOnly.test.ts`, plus the
     existing `test/tools.test.ts` may keep some cases.
   - Recommendation: one `test/operatorOnly.test.ts` for both enforcement points (execute + enqueue +
     runCommand), so the fail-closed invariants live in one file the planner can review.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | gate (`tsc --noEmit`, vitest) | ✓ | v24.14.1 (`~/.nvm/versions/node/v24.14.1/bin`) | — |
| vitest | `npm run test:unit` | ✓ (config: `environment: "node"`, `testTimeout: 15000`) | per `package.json` deps | — |
| TypeScript | `npx tsc --noEmit` | ✓ | per `package.json` | — |
| ts-proto | NOT required in Phase 4 | n/a | 1.151.1 is Phase 5's; **never 1.153.2** | — |
| SQLite file | Parity with live data | ✓ (live DB exists at runtime; tests mock the queue store) | — | Mocked store in tests |
| Slack/email integrations | Not needed (audit via `logAction` only) | n/a | — | — |

**Suite baseline run this session:** `npm run test:unit` → **20 files, 436 tests passed, 52.07 s**
(baseline for the planner's own gate numbers). `npx tsc --noEmit -p .` clean at HEAD (probe-only
errors aside).

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (repo dep; no jsdom anywhere — `environment: "node"`) |
| Config file | `controller/vitest.config.mts` ({ `include: ["test/**/*.test.ts"]`, `setupFiles: ["test/setup.ts"]`, `clearMocks: true`, `testTimeout: 15000` }) [VERIFIED: whole file] |
| Quick run command | `cd controller && npx tsc --noEmit && PATH=~/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run test/recoveryControl.test.ts test/staticScan.test.ts` |
| Full suite command | `cd controller && npx tsc --noEmit && PATH=~/.nvm/versions/node/v24.14.1/bin:$PATH npm run test:unit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command (example run) | File Exists? |
|--------|----------|-----------|--------------------------------|--------------|
| OPR-01 | `validateRecoveryRequest` refusal order/codes; kinds (`confirmYes`/`guid`); sends `{guid, arm_inspected:"yes"}` exactly once, never retried | unit | `npx vitest run test/recoveryActions.test.ts test/recoveryControl.test.ts test/controlDecision.test.ts` | ❌ in-phase (mirrors `test/recoveryControl.test.ts` + `test/runControl.test.ts` anchors verified) |
| OPR-02 | Audit lines for refused / transport-error / outcome; STACK-specific refuse-while-running message; SUCCESS+message refusal | unit | `npx vitest run test/recoveryControl.test.ts` (extends existing :39-156 tests) | ✅ file exists, extend |
| OPR-03 | `tool.latchStatus` toolId-only; `extractLatch` shape tolerance; "Use this guid" fills-not-sends (static scan version); explicit Read-latch (no timers) | unit + static scan | `npx vitest run test/latchStatus.test.ts test/staticScan.test.ts` | ❌ in-phase |
| OPR-04 | Execute-time + enqueue refusals, voice+REST mapping, row FAILED/stays-queued semantics, mislabelled toolType, case/whitespace + prototype-chain keys | unit | `npx vitest run test/operatorOnly.test.ts test/tools.test.ts test/runs.test.ts (or equivalents)` | ❌ in-phase |
| OPR-05 | full static-scan set (exact file list, absence pins, guard placement, single reader, `/latch/i` off send path, no-self-acknowledge) | static scan | `npx vitest run test/staticScan.test.ts` | ✅ file exists, extend |

### Sampling Rate
- **Per task commit:** `cd controller && npx tsc --noEmit` + touched test files.
- **Per wave merge:** full `npm run test:unit`.
- **Phase gate:** full suite green (436 baseline → expect ~+40..60 tests) before `/gsd-verify-work`.

### Wave 0 Gaps
- None — test framework, fakes (`test/helpers/fakeTool.ts`: `installFakeTool` + `FakeGrpc` +
  `deferred`), existing extended tests, and static-scan helpers all exist and are green. All ❌ items
  above are phase-created files (the implementation itself), not framework gaps.

## Security Domain

`security_enforcement: true` (ASVS L1, per `.planning/config.json`). Applicability:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Out of scope | galago-web has **no authentication by design** — documented framing (CONTEXT.md `<specifics>`): "operator-only" = unreachable from any protocol/script/queue-row/editor + the core's exact-guid check; any HTTP caller reaching `tool.recoveryControl` is the same pre-existing exposure as `commandQueue.toolControl`. Future item: recording who acted (REQUIREMENTS.md Future Requirements) |
| V3 Session Management | no | same reason |
| V4 Access Control | yes (semantic) | the operator-only refuse table (V4's "deny-by-default for non-operator paths") is exactly this phase's subject |
| V5 Input Validation | yes | zod on every tRPC procedure (existing) + the two new validators (`validateRecoveryRequest`, guard lookups); own-property lookups everywhere (prototype-pollution-safe by construction); param values `z.record(z.unknown()).optional()` deliberately unrestricted so refusals are logged, not zod-rejected |
| V6 Cryptography | no | no new crypto; nothing to hand-roll |
| V7 Error/Logging | yes | `logAction` audit lines on every refusal path (existing pattern, verified in `recoveryControl.ts:40-101`); error text composed centrally (`toolReply.ts`) and never HTML-injected (scan :507-517 covers the surfaces; tests keep `dangerouslySetInnerHTML` out) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype-chain key confusion (`"constructor"` as a tool type/command) | Tampering | `Object.prototype.hasOwnProperty.call(...)` on both lookup levels (established idiom, verified `runControl.ts:68-74`, `controlDecision.ts:43-48`) — mirrored in the new modules + a refusal test for `toString`/`constructor` |
| Unvalidated command names reaching a物理 tool | Tampering/Elevation | execute-time guard BEFORE variable substitution and before any gRPC (`tools.ts:409`) — a `{{…}}`-substituted param can never rescue a refused command |
| Operator-only action reachable via script/imported JSON | Elevation of Privilege | the two enforcement points (enqueue + execute) + audit each attempt (OPR-04) |
| Un-bounded guid / toolId strings | DoS | `^[^\s\u0000-\u001f\u007f]{1,256}$` (D-08 — length-bounded, linear regex, no catastrophic backtracking) |
| Latch reply shape abused as a send path | Tampering/Spoofing | D-12: `/latch/i` off the send path (scan) — parse-once, display-only |
| SQL/queue injection through stored JSON params | Tampering | unchanged surface; existing drizzle parameterization + queue serialization untouched |

## Sources

### Primary (HIGH confidence)
- This session's file reads at HEAD (all cited `file:line` pairs above): `controller/server/{tools,toolReply,recoveryControl,runControl,runState,runs,command_queue}.ts`, `controller/server/routers/{tool,run,command_queue}.ts`, `controller/server/utils/SqliteQueue.ts`, `controller/components/runs/{controlDecision,RunControlConfirmModal}.tsx?`, `controller/components/tools/RunRecoverySection.tsx`, `controller/hooks/useRunControl.ts`, `controller/pages/api/runs/index.ts`, `controller/pages/tools/[id].tsx` (grep anchors), `controller/test/{staticScan,recoveryControl,toolReply,...}.ts`, `controller/test/helpers/fakeTool.ts`.
- Probe results (ts2367 / tsc-exit=0 / test:unit 436 passing) — executed on this repo HEAD.
- `.planning/research/ACK-AND-F3.md` §0–§6 — the design contract; all §1–§3 anchors re-verified or re-pinned by this research.
- `.planning/phases/04-.../04-CONTEXT.md` — locked decisions D-01..D-15 (copied verbatim in user_constraints).

### Secondary (MEDIUM confidence)
- `galago-tools/.planning/research/SUMMARY.md` (proposed proto, latch_status shape, ack contract REFUSALS, pitfalls 4-5) — cross-repo upstream facts, correct as of 2026-10-28; names may shift when galago-tools Phase 4 lands (hence A1/A2).

### Tertiary (LOW confidence)
- None — no WebSearch-level claims in this phase.

## Metadata

**Confidence breakdown:**
- Anchors/standard stack: HIGH — every anchor re-read at HEAD this session; files NOT touched by Phase 3 verified via empty git diff.
- Architecture (spec/validator clone, guard placement, scan extensions): HIGH — matches shipped Phase 1-3 patterns verbatim.
- Pitfalls: HIGH — 3 of 10 backed by executed probes (TS2367, tsc-clean, suite-green) or verbatim code reads; 2 marked [ASSUMED] in A4/A5.
- galago-tools upstream contract: MEDIUM — correct as of its 2026-10-28 research; Phase 5 owns the hard anchoring (GEN-04).

**Research date:** 2026-10-29
**Valid until:** 30 days (stable: no upstream codegen dependency; galago-tools Phase 4 landing is the only external change signal)
