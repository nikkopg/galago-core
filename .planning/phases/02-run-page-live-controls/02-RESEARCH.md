# Phase 2: Run Page Live Controls - Research

**Researched:** 2026-10-13
**Domain:** Next.js/tRPC/Chakra UI run-page controls for a live, in-flight instrument step; shared
operator-confirmation UX; galago-core-side crash recovery
**Confidence:** HIGH (nearly every claim below is grounded in a direct `Read` of the exact file/line
in this repo, at the commit this research was done against; a few UI/library behaviors are grounded
in reading the installed `node_modules` source for the pinned Chakra version)

## Summary

Phase 2 is almost entirely additive UI/thin-server work on top of Phase 1's already-shipped control
path (`commandQueue.toolControl`, `commandQueue.runState`, `RunStateMonitor`, `runControl.ts`,
`Tool.controlCommand`). Nothing in Phase 1 needs to change. The phase adds: a run-page control bar,
one shared confirmation modal with non-defaulted yes/no decisions, a `tool_paused` prompt that reads
its own poll and never touches the queue's existing `UIMessage`/`_messageResolve` machinery, a new
Stop-interception modal for the one Stop button and (per direct source-reading, D-19) for `Clear All`
and the per-run "skip" delete button too, a step-editor data change (remove `fast.abort`/`fast.resume`
from `commandFields`), a new `tool.recoveryControl` tRPC mutation, and pure-logic Vitest coverage.

The two sharpest findings from direct source reading this session: (1) `clearAll`/`clearByRunId`
**can and do** detach a running controllable step — they delete the SQLite rows out from under an
in-flight gRPC call with zero confirmation today, confirming D-19's premise and widening its scope
beyond the Stop button to two more call sites; (2) Chakra 2.8.2's `RadioGroup` becomes an
**uncontrolled-to-controlled** component the moment a `value={undefined}`-initialized decision state
receives its first selection — functionally fine (nothing renders checked until a choice is made,
matching D-07) but will emit a React dev-mode warning unless the value passed to the component is
normalized to `value ?? ""` while the underlying decision state stays `ControlDecisionValue |
undefined` for the Confirm-disabled check.

**Primary recommendation:** Build one `useRunControlState` hook (`hooks/useRunControlState.ts`)
around `trpc.commandQueue.runState.useQuery(undefined, { refetchInterval: 2000 })` as the single
source of truth; build one `RunControlConfirmModal` (modeled on `PauseModal.tsx`'s structure, never
on `StopRunModal.tsx`'s) parameterized by the `runControl[toolType][action]` decision map; wire the
existing "Pause" button in `QueueStatuscomponent.tsx` (line 97-104, calls `commandQueue.stop`) and
the existing `Clear All`/skip-run buttons to open a new `InstrumentStopModal` instead of firing
directly, whenever the hook reports a running controllable step.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Control bar state (running/paused/percent) | Frontend Server (Next.js page component) | API/Backend (`commandQueue.runState` query) | Pure read-model; the tRPC query already does the gRPC round trip server-side (Phase 1), the client only polls and renders |
| Confirmation + decision UX (non-defaulted yes/no) | Browser/Client (React state in the modal) | — | No server validation needed for *UI* disabling; the server (`validateControlRequest`) is the actual safety gate, not the UI |
| `tool_paused` prompt lifecycle | Browser/Client | API/Backend (`runState.pause`) | Episode detection (open/close/reset) is pure client state keyed off server-reported `pause`; the server never "pushes" anything, it's poll-driven |
| Stop/Clear-All/skip-run interception | Browser/Client (button wiring) | API/Backend (`toolControl` + `commandQueue.stop`/`clearAll`/`clearByRunId`) | The UI decides *whether* to intercept (by reading the hook), but the actual abort-then-stop sequencing (D-18) is two sequential tRPC calls the client must await in order |
| Step-editor command list (`commandFields`) | Frontend Server (static data module) | — | Pure data; no runtime tier boundary, just a shared constants object read by two components |
| Crash-recovery control (`recoveryControl`) | API/Backend (new tRPC mutation) | Browser/Client (tool page section) | Resolving "is a step tracking this tool" is a queue-state read the server already owns (`CommandQueue.global.runningStep`); the UI only renders based on the mutation's refusal, never its own state check (constraint: "no state checks in galago-core") |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions (D-01 .. D-25, verbatim intent from 02-CONTEXT.md)

- **D-01:** One client hook (`useRunControlState`) is the only reader of `commandQueue.runState`
  (`refetchInterval: 2000`). Control bar, `tool_paused` prompt, and Stop interception all consume
  that one hook result. Do not fold `runState` into `modalState`.
- **D-02:** Bar renders only when `running: true` and `getRunControl(toolType)` is defined. Placement:
  in `RunsComponent`, above the run list, labelled with tool name/type and running command, keyed by
  `queueId`.
- **D-03:** State badge (`running`/`paused`/raw state text) + progress bar from `percent`
  (indeterminate when null). On `status: "unknown"`, show "Run state unknown since &lt;time&gt;" with
  `lastError`, keep last good state visible, never hide the bar.
- **D-04:** Button enablement is a hint, not a gate. Pause enabled when `running`, Resume when
  `paused`, Abort when `running` or `paused`. Unknown/unrecognised state: all three enabled. No other
  client or server state check is added.
- **D-05:** Queue's own pause button relabels to "Pause queue"; bar buttons read "Pause instrument",
  "Resume instrument", "Abort instrument run".
- **D-06:** One shared `RunControlConfirmModal` serves control bar, `tool_paused` prompt, tool page,
  and (with its own copy) the Stop flow. Driven by `runControl[toolType][action]` plus a label map:
  `is_tip_broken` → "Tip broken?", `return_liquid` → "Return liquid?". Pause has no decisions, still
  asks "Pause the F.A.S.T. run?". Reversibility: costly.
- **D-07:** Every decision is a radio group whose initial value is undefined (nothing preselected).
  Confirm disabled until every declared decision has a value. Decision state reset on every open. No
  timers, no auto-confirm, no default button bound to Enter. Close/Esc/overlay/Cancel all mean Cancel.
- **D-08:** Confirmation text restates the choice in plain words, e.g. "Resume the F.A.S.T. run. Tip
  broken: No." All actions move the head, so copy says so.
- **D-09:** No optimistic UI. In-flight: Confirm shows spinner, repeat clicks ignored. `ok: true` →
  close modal + success toast; bar updates only from next poll. `ok: false` (core `Refused`) or
  transport error → close modal + **persistent** error toast (`duration: null`, closable) with the
  refusal message verbatim. No automatic retry.
- **D-10:** `ToolPausedModal` is new, next to `PauseModal`, outside `messageData`/`isModalOpen` state.
  Never calls `resume()` or touches `modalState`; only touches `toolControl` through the confirm modal.
- **D-11:** Opens when `runState.pause` is non-null. Episode key = `queueId` + `pause.startedAt`,
  fallback `name`+`code`. Operator may dismiss ("Hide"), sends nothing. "Paused: view reason" button
  on bar reopens it. New episode reopens automatically.
- **D-12:** Closes automatically when `pause` becomes null, `running` becomes false, or `queueId`
  changes. If a confirm modal from it is still open, close that too with an info toast: "The run
  resumed or the step ended before you confirmed; nothing was sent."
- **D-13:** While status unknown and a pause was last seen, keep prompt open with "Run state unknown"
  warning. Don't close on unknown.
- **D-14:** Content: reason as "WrongPlateType (-645)", detail from pure `describePauseDetail(detail)`,
  start time as local clock + relative age. Known shape `wrongDetection: [{expectedPlateID,
  detectedPlateID, position}]` → "Deck {position}: expected plate {expectedPlateID}, found
  {detectedPlateID or 'none'}". Unknown shapes → pretty JSON in collapsible "Raw detail". Never drop.
- **D-15:** Prompt offers Resume and Abort, both enabled, opening the shared confirm modal. Single
  decision/send code path.
- **D-16:** Trigger is the queue-stop button in `QueueStatuscomponent` (today calls `commandQueue.stop`,
  relabelled "Pause queue"). When hook reports a running controllable step, opens `InstrumentStopModal`
  instead. Otherwise behaves exactly as today.
- **D-17:** `InstrumentStopModal`: "Abort the instrument run" with "Return liquid? ○ Yes ○ No" (nothing
  selected; action disabled until chosen) and Cancel. No timer, no default; close/Esc/overlay = Cancel.
  `StopRunModal` neither imported nor reused. `stop_run` Tool Box step's `StopRunModal` path unchanged.
- **D-18:** On confirm: send `toolControl("abort", {return_liquid})`. Only if `ok: true`, call
  `commandQueue.stop`; step ends Aborted, queue goes FAILED. If refused/errors, show reason, do NOT
  stop the queue.
- **D-19:** Researcher must check whether `clearAll`/`clearByRunId` can detach/drop a running
  controllable step. If yes, route them through the same `InstrumentStopModal` while a controllable
  step runs. If no, leave unchanged and record why. **[Answered below — they can; both must route
  through the modal.]**
- **D-20:** Remove `abort`/`resume` from `commandFields.fast`. Both `AddToolCommandModal` and the tool
  page's Send Command form read this map. Existing saved protocols with fast abort/resume steps are
  not migrated; planner checks they still load/display without crashing and records the result.
  **[Answered below — confirmed they do.]**
- **D-21:** Tool page gets a "Run recovery" section for any tool type with `runControl`, offering
  Resume and Abort (not Pause) through the shared confirm modal. Always rendered for such tools
  (Pitfall 10) — visibility never depends on a step running. When hook shows a tracked running step on
  *this* `toolId`, buttons disabled with "A run step is tracking this tool; use the run page" + link.
  Otherwise enabled, including when run state is unknown.
- **D-22:** New tRPC mutation `tool.recoveryControl({toolId, action, params})` resolves tool by id,
  validates with `validateControlRequest` using that tool's type, limits `action` to `resume`/`abort`.
  Refuses `PRECONDITION_FAILED` when queue's `runningStep` is on that `toolId` (reads queue state, not
  instrument state). Sends via `Tool.controlCommand`, logs with `logAction` like `toolControl`, returns
  same `{ok, response, message}` shape. Reversibility: reversible.
- **D-23:** Crash-recovery Resume can block until the resumed run ends (no gRPC deadline). Tool page
  shows pending call as in-progress without blocking rest of page. Researcher confirms
  `Tool.controlCommand` won't time out early. **[Answered below — confirmed no deadline anywhere.]**
- **D-24:** No new UI test deps by default (no jsdom/RTL unless pure-logic tests can't cover a
  criterion — then a human-approval checkpoint, as Phase 1's package set A). Coverage via Vitest
  (node env): pure-logic modules (confirm-modal decision state, pause-episode detection, button
  hints, `describePauseDetail`, Stop sequencing) + static source-scan invariants (`toolControl`/
  `recoveryControl` referenced from exactly one module each; `StopRunModal` not imported by new Stop
  flow; no `setTimeout`/`setInterval` in control-UI modules; server `Tool.controlCommand` called only
  from `toolControl`/`recoveryControl`) + server tests for `recoveryControl` refusals with a mocked
  gRPC client.
- **D-25:** Gate: `tsc --noEmit` at 0 errors, `npm run test:unit` green, `prettier --check` via
  `bin/make test`.

### Claude's Discretion

- Exact component, hook and file names; visual layout/styling (Chakra, matching existing modals).
- Toast wording, and whether the success toast includes the tool's response text.
- How the static scans are written (regex over source vs the TypeScript compiler API).

### Deferred Ideas (OUT OF SCOPE)

- A combined atomic run-page query merging `runState` into the queue's state read (D-01 uses a single
  client hook instead). Revisit only if manual testing shows flicker.
- UI component tests (jsdom/RTL): only with human approval (D-24).
- Hard pause (D5 — future requirement).
- Simulated pause driven end to end in the UI (galago-tools ADP-10 hook — future).
- F3/F5 debt: out by user decision.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Control bar with state/percent (2s refresh), Pause/Resume/Abort enabled per state; tools without `runControl` show none | `RunsComponent.tsx` insertion point identified (new Card between the Gantt chart Card and the Runs List Card, ~line 564); `useRunControlState` wraps the already-shipped `trpc.commandQueue.runState` query; `getRunControl` already exported from `server/runControl.ts` and safe to import client-side (no imports itself) |
| UI-02 | Every control action asks for confirmation | `RunControlConfirmModal` design pattern below, Chakra `Modal`/`AlertDialog` defaults verified |
| UI-03 | Resume/Abort require explicit yes/no, nothing preselected, disabled until chosen | Chakra 2.8.2 `useRadioGroup` source read — confirms `value={undefined}` yields no checked radio; documented uncontrolled→controlled transition gotcha and the `value ?? ""` fix |
| UI-04 | `tool_paused` prompt within ~2s, reason+detail+start time | `runState.pause` shape already fully typed in `server/runState.ts` (`PauseState`: `name`, `code`, `detail`, `startedAt`) — confirmed exact field names via direct read |
| UI-05 | Prompt offers Resume/Abort, closes on resume/step-end, never blocks queue | `RunStateEnvelope` transitions (`running: false`, `queueId` change, `runState.pause === null`) verified in `server/runState.ts`; confirmed `toolControl` never touches `_isWaitingForInput`/`_messageResolve` (command_queue.ts:429-505) |
| UI-06 | Stop during controllable step: new confirmation, no timer/default, `StopRunModal` not reused | `StopRunModal.tsx` auto-countdown confirmed at lines 44-62 (pitfall 1 verified in this session); `QueueStatuscomponent.tsx:97-104` is the exact interception point, confirmed by direct read |
| UI-07 | abort/resume removed from protocol step editor; tool page offers Resume/Abort for crash recovery | `commandFields.fast` entries at `components/tools/constants.ts:345-346`; removal-safety confirmed by tracing all consumers (`AddToolCommandModal.tsx`, `ProtocolDetailView.tsx`, `CommandDetailsDrawer.tsx`) |
| UI-08 | No code path sends control actions without confirmed choice; no instrument-state check in galago-core | Static-scan plan below; `D-24`'s pure-module test list maps directly onto `runControl.ts`'s existing `validateControlRequest` pattern already proven safe in Phase 1 |

</phase_requirements>

## Specific Research Questions — Answered

### D-19: Can `clearAll`/`clearByRunId` detach or drop a running controllable step?

**Yes — confirmed by direct read, HIGH confidence `[VERIFIED: controller/server/utils/SqliteQueue.ts:395-448]`.**

```ts
// controller/server/utils/SqliteQueue.ts:395-401
async clearAll(): Promise<void> {
  this.db.transaction(() => {
    this.db.prepare(`DELETE FROM ${this.queueName}_queue`).run();
    this.db.prepare(`DELETE FROM ${this.queueName}_commands`).run();
    this.db.prepare(`DELETE FROM ${this.queueName}_runs`).run();
  })();
}
// :403-448 clearByRunId does the equivalent DELETEs scoped to one run_id
```

`clearAll`/`clearByRunId` only ever touch the three SQLite tables (`_queue`, `_commands`, `_runs`).
Neither touches `CommandQueue._runningStep`, `CommandQueue._runStateMonitor`, or
`CommandQueue._runningPromise` — all three are plain in-memory fields on the `CommandQueue` instance,
set by the busy loop and never read from or written to SQLite
`[VERIFIED: controller/server/command_queue.ts:56-59, 1130-1144]`:

```ts
// controller/server/command_queue.ts:1130-1144
this._runningStep = Object.freeze({ queueId: nextCommand.queueId, ... });
this._runStateMonitor.start(this._runningStep);
try {
  await this.executeCommand(nextCommand);
} finally {
  this._runStateMonitor.stop();
  this._runningStep = undefined;
}
```

So while a controllable step's `Tool.executeCommand` gRPC call is still in flight (physically running
or paused on the instrument), an operator clicking **Clear All** (`QueueStatuscomponent.tsx:54-56,
119-125` — today a single click, **no confirmation dialog exists at all**
`[VERIFIED: controller/components/runs/status/QueueStatuscomponent.tsx:54-56,115-126]`) or the per-run
delete/"skip" button (`RunsComponent.tsx:106,333-334`, wired through the generic
`DeleteWithConfirmation`/`ConfirmationModal` — a plain "Delete this run? Ok/Cancel" dialog with **no
physical decision and no instrument awareness**
`[VERIFIED: controller/components/ui/Delete.tsx, controller/components/ui/ConfirmationModal.tsx]`)
deletes the backing DB rows while the in-memory step keeps running unsupervised.

The downstream effect, also verified: `complete(id)` calls `_updateItem(id, ...)`, which **throws**
`Item ${id} not found` if the row is gone
`[VERIFIED: controller/server/utils/SqliteQueue.ts:450-461,497-502]`. So when the orphaned
`Tool.executeCommand` call eventually resolves, `this.commands.complete(command.queueId)` throws,
caught by the busy loop's outer `catch` — the run's true outcome (success, pause, abort) is lost to
the queue entirely, with **no abort sent to the instrument and no confirmation ever shown**. This is
strictly worse than the unmitigated Stop case design §1 describes (Stop at least awaits the step), and
it currently has *zero* confirmation on `Clear All`.

**Consequence for the plan:** D-19's "if yes" branch applies to **both** buttons: `Clear All`
(`QueueStatuscomponent.tsx`) and the per-run delete/skip button (`RunsComponent.tsx`'s
`DeleteWithConfirmation` wired to `handleConfirmDelete`/`skipRunMutation`) must each route through
`InstrumentStopModal` (same abort-then-clear sequencing as D-18, substituting the trailing
`commandQueue.stop()` with `commandQueue.clearAll()`/`clearByRunId(runId)` respectively) whenever the
hook reports a running controllable step. The per-run delete path additionally needs its existing
generic `ConfirmationModal` either bypassed or layered behind the instrument check — don't show two
stacked confirmations for the same click.

### D-20: Do saved protocols with fast abort/resume steps still load/display after removal from `commandFields.fast`?

**Yes — confirmed by tracing every consumer of `commandFields`, HIGH confidence.**

Only three files import `commandFields`: `AddToolCommandModal.tsx`, `pages/tools/[id].tsx`, and
`components/tools/advanced/teach_pendant/features/sequences/CommandModal.tsx` (PF400-only, unaffected)
`[VERIFIED: grep across controller/, confirmed by Read of each file]`. The protocol step **list**
rendering path (`ProtocolSwimLaneCommandComponent` in `ProtocolDetailView.tsx`) and the step **detail**
drawer (`CommandDetailsDrawer.tsx`) both read the saved step's own stored data directly —
`command.commandInfo.command`, `command.commandInfo.toolId`, `command.commandInfo.params` — and never
consult `commandFields` at all `[VERIFIED: controller/components/protocols/ProtocolDetailView.tsx:68,
98,132,413,441; CommandDetailsDrawer.tsx:477]`. A saved step with `command: "abort"` or `"resume"`
renders its name via `capitalizeFirst(command.commandInfo.command.replaceAll("_", " "))` regardless of
whether `"abort"`/`"resume"` is a key of `commandFields.fast` — no lookup, no crash risk.

The only place `commandFields[toolType][command]` is read with the step's actual command name is
`AddToolCommandModal.tsx` — and only when a user **re-opens that specific step in the editor**:

```ts
// controller/components/protocols/AddToolCommandModal.tsx:157-160
const fields: Field[] =
  selectedToolType && selectedCommand
    ? commandFields[selectedToolType]?.[selectedCommand] || []
    : [];
```

The `|| []` fallback means an existing `abort`/`resume` step reopened for editing after D-20 ships
shows **zero** configurable fields (the `return_liquid`/`is_tip_broken` text input disappears from the
editor) rather than crashing — a UX regression for re-editing such a step's params, not a load/render
failure. **Consequence for the plan:** no migration is required for load/display safety (confirmed),
but note the editor-reopen regression explicitly in the plan's "known limitation" rather than treating
it as untested risk.

**Existing test to update, not just extend:** `test/runControl.test.ts:23-29` currently **asserts**
`commandFields.fast.abort`/`.resume` are unchanged (a Phase 1 D-10 guard). This assertion must flip to
assert their *absence* once D-20 ships, or the test suite will fail on a correct implementation:

```ts
// controller/test/runControl.test.ts:23-29 (current — must be inverted by this phase)
describe("commandFields untouched (D-10)", () => {
  it("leaves commandFields.fast.abort and .resume unchanged, with no pause entry", () => {
    expect(commandFields.fast.abort).toStrictEqual([{ name: "return_liquid", type: "text" }]);
    expect(commandFields.fast.resume).toStrictEqual([{ name: "is_tip_broken", type: "text" }]);
    expect(Object.prototype.hasOwnProperty.call(commandFields.fast, "pause")).toBe(false);
  });
});
```

### D-23: Can `Tool.controlCommand` time out early on a long crash-recovery Resume? How should a long-pending tRPC mutation behave?

**No gRPC deadline anywhere in this codebase — confirmed by direct read, HIGH confidence
`[VERIFIED: controller/server/utils/promisifyGrpcCall.ts:19-32, controller/server/tools.ts:379-392]`.**

```ts
// controller/server/utils/promisifyGrpcCall.ts:19-30
export function promisifyGrpcCall<F extends Function>(func: F, bind?: any): PromisifiedGrpcCall<F> {
  return ((...args: any) =>
    new Promise((resolve, reject) => {
      func.call(bind, ...args, (error: any, response: any) => { ... });
    })) as any;
}
```

`Tool.controlCommand` (`tools.ts:379-392`) calls `this.grpc.executeCommand(payload)` with **no**
`metadata`/`options` argument — the `grpc.CallOptions` parameter that would carry a `deadline` is never
supplied anywhere in this file or in `promisifyGrpcCall`. The existing project's own `PROJECT.md`
corroborates this independently: `[CITED: .planning/PROJECT.md:71]` "No gRPC deadline on
`executeCommand`, so a step can stay open through a long pause." A prior research pass reached the same
conclusion and flagged the opposite as an explicit anti-pattern
`[CITED: .planning/research/ARCHITECTURE.md:311-321]` ("Anti-Pattern 2: Giving the control-command
gRPC calls a deadline/timeout... do not introduce one for control commands specifically").

On the tRPC/Next.js side: the client uses `httpBatchLink` with no custom `fetch`/`AbortSignal`/timeout
`[VERIFIED: controller/utils/trpc.ts:1-30]`, and the server is a standard `pages/api` handler
(`trpcNext.createNextApiHandler`) served by `next start`/`next dev` as a long-running Node process, not
a serverless function with a platform-imposed request timeout
`[VERIFIED: controller/pages/api/trpc/[trpc].ts]`. There is no `maxDuration` export or edge-runtime
config. **Consequence for the plan:** a crash-recovery Resume mutation genuinely can stay pending for
the duration of the resumed run with no framework-level kill switch at any layer. The tool page's "Run
recovery" section must track the mutation's `isPending`/`isLoading` state itself (React Query) to show
"Resume in progress..." without blocking navigation or other page interactions — there is nothing the
platform will do for you, and nothing you should add (no client-side `AbortController` timeout either,
per the anti-pattern above).

### D-24: Can pure confirm/decision/pause/stop-sequencing modules be tested in the existing Vitest setup? Can `.tsx`-adjacent `.ts` modules under `components/` be imported via tsconfig paths?

**Yes to both — already proven by the existing test suite, HIGH confidence.**

`vitest.config.mts` uses the `vite-tsconfig-paths` plugin
`[VERIFIED: controller/vitest.config.mts:1-13]`, which resolves `tsconfig.json`'s `paths` entry
`"@/*": ["./*"]` `[VERIFIED: controller/tsconfig.json:21-27]`. `test/runControl.test.ts` already
imports a plain `.ts` module that lives inside `components/`, proving the exact pattern this phase
needs:

```ts
// controller/test/runControl.test.ts:3 (existing, already working)
import { commandFields } from "@/components/tools/constants";
```

Because the node environment never loads a DOM or a JSX runtime, any *pure* `.ts` sibling file placed
next to the `.tsx` components (e.g. a `components/runs/controlDecision.ts` exporting the decision-state
reducer, episode-key logic, button-enablement hints, and `describePauseDetail`) imports cleanly as long
as it has zero React/JSX imports and zero imports of a `.tsx` file. This matches D-24's intent
directly: "Components stay thin over these modules."

**Recommended static-scan approach:** a regex/AST scan over `fs.readFileSync` of the relevant source
files is sufficient and matches the project's existing "no new UI test deps" policy — no TypeScript
Compiler API dependency needed. The existing `toolControl` call site is already singular and easy to
scan for (`CommandQueue.toolControl` called only from `routers/command_queue.ts`'s mutation,
`Tool.controlCommand` called only from `CommandQueue.toolControl`
`[VERIFIED: controller/server/command_queue.ts:479, controller/server/tools.ts:379]`); a grep-based
test (`fs.readFileSync(file, "utf-8").match(/\.controlCommand\(/g)`, asserting count and call sites)
is the lightest-weight approach and consistent with `test/runControl.test.ts`'s existing style (plain
`describe`/`it`/`expect`, no AST library imported anywhere in the current `test/` directory
`[VERIFIED: package.json devDependencies — no ast-grep/ts-morph/babel-traverse present]`).

**Server-test pattern for `recoveryControl`:** `test/toolControl.test.ts` and
`test/helpers/fakeTool.ts` already establish the exact mocking pattern to reuse —
`installFakeTool(toolId, toolType)` replaces `tool.grpc` with `vi.fn()` stubs, and
`someRouter.createCaller({})` invokes the tRPC procedure directly without an HTTP round trip
`[VERIFIED: controller/test/toolControl.test.ts:1-47, controller/test/helpers/fakeTool.ts]`. The
`recoveryControl` tests should follow this exact shape: `installFakeTool`, `toolRouter.createCaller({})`,
assert refusal `PRECONDITION_FAILED` when `CommandQueue.global.runningStep?.toolId` matches the target.

### Control bar placement in `RunsComponent.tsx` and the existing toast pattern

**Placement — confirmed exact insertion point, HIGH confidence
`[VERIFIED: controller/components/runs/RunsComponent.tsx:556-594]`.** The component renders three
`Card`s in sequence inside the outer `VStack`: a summary/status Card (lines 493-554, which also hosts
`QueueStatusComponent` at line 529), a Gantt-chart Card (lines 556-564), and the Runs List Card (lines
566-594, headed "Runs List"). D-02's "above the run list" placement means inserting a new control-bar
Card (or a `VStack` of one-per-controllable-step cards, though only one step can run at a time given
`_runningStep` is singular) **between** lines 564 and 566 — i.e., after the Gantt chart, immediately
before the Runs List `Card`. `ToolPausedModal` mounts alongside the other top-level modals at lines
456-489 (next to `StopRunModal`), independent of render position.

**Toast pattern — important correction to the research question's premise.** This codebase does
**not** use Chakra's `useToast()` hook anywhere in `components/runs/`. It uses a **standalone** toast
instance via `createStandaloneToast()`, wrapped in helper functions in `components/ui/Toast.tsx`
`[VERIFIED: controller/components/ui/Toast.tsx:1-17]`:

```ts
// controller/components/ui/Toast.tsx:1-17
const { ToastContainer, toast } = createStandaloneToast({});
const defaultToastOptions = { duration: 3000, variant: "left-accent", position: "bottom-right", isClosable: true };
export const successToast = (title: string, description: string) => { toast({ ..., status: "success", duration: defaultToastOptions.duration }); };
export const warningToast = (title, description, position?) => { toast({ ..., status: "warning" }); };
export const errorToast = (title: string, description: string) => { toast({ ..., status: "error", duration: 10000, ... }); };
```

**Load-bearing gap:** none of the existing helpers support `duration: null`. D-09 requires a
**persistent** error toast (`duration: null, closable`) for a refusal/transport error. `errorToast`
hardcodes `duration: 10000` — it auto-dismisses after 10s, which does not satisfy D-09. The plan must
either add a new helper (e.g. `persistentErrorToast`) or call the underlying `toast({...})` directly
with `duration: null` for this one case; reusing `errorToast` as-is under-delivers on D-09.

### Chakra UI version, `RadioGroup` with undefined value, `Modal` close defaults, avoiding Enter-to-confirm

**Chakra UI 2.8.2, confirmed from `package.json` and `node_modules`
`[VERIFIED: controller/node_modules/@chakra-ui/react/package.json]`.**

**`Modal` close defaults — exactly match D-07/D-17 out of the box, HIGH confidence
`[VERIFIED: controller/node_modules/@chakra-ui/modal/dist/index.js:120-121]`:**

```js
// @chakra-ui/modal/dist/index.js:120-121 (installed, 2.8.2)
closeOnOverlayClick = true,
closeOnEsc = true,
```

Both default to `true` in this exact installed version — overlay click and Esc already call `onClose`
without any extra prop. **As long as the implementation treats `onClose` identically to clicking
Cancel** (reset decision state, send nothing), no special props are needed to satisfy "Close, Esc,
overlay click and Cancel all mean Cancel" — this is the Modal's default behavior, not something to
build. (`StopRunModal.tsx` deviates from nothing here — its violation is the 5s auto-`setInterval`
countdown, not the close semantics.)

**`RadioGroup` with `value={undefined}` — functionally correct for "nothing preselected," but has a
documented gotcha, HIGH confidence
`[VERIFIED: controller/node_modules/@chakra-ui/radio/dist/use-radio-group.js:38-43,85-100]`:**

```js
// @chakra-ui/radio/dist/use-radio-group.js:38-43
const [valueState, setValue] = (0, import_react.useState)(defaultValue || "");
const isControlled = typeof valueProp !== "undefined";
const value = isControlled ? valueProp : valueState;
// ...85-100 (getRadioProps)
[checkedKey]: value != null ? props2.value === value : void 0,
```

When the parent passes `value={decision}` and `decision` starts as `undefined`, `isControlled` is
`false` on first render, so Chakra treats the group as **uncontrolled** and the `checked` prop computed
for every `Radio` is `void 0` (unchecked) — this correctly renders nothing preselected. But the
`onChange` callback always forwards to the parent's `onChangeProp` regardless of controlled state
(`use-radio-group.js:67-76`), so the parent's own state update still works. The gotcha: once the
parent's `decision` state becomes a string (e.g. `"yes"`), `isControlled` flips to `true` on the next
render — React's dev console will warn about a component changing from uncontrolled to controlled.
**Recommended fix, not yet built:** pass `value={decision ?? ""}` to the `RadioGroup` (always a defined
string, `""` meaning "none" — never rendered as checked since no `Radio` has `value=""`), while keeping
the underlying decision state typed `ControlDecisionValue | undefined` for the Confirm-button-disabled
check (`decision === undefined`). This avoids the warning without weakening D-07.

**Avoiding Enter-to-confirm:** Decisions are radios, not text `<input>`s, so the classic
"Enter submits the first button in a `<form>`" risk mainly applies if the modal body is wrapped in a
`<form onSubmit>` — none of the existing modals in `components/runs/` do this
(`PauseModal.tsx`, `StopRunModal.tsx` both use plain `ModalBody`/`ModalFooter` with `onClick` handlers,
no `<form>` element `[VERIFIED: controller/components/runs/PauseModal.tsx,
controller/components/runs/StopRunModal.tsx]`). The simplest safe pattern is to continue that
convention (no `<form>` wrapper) and not set `autoFocus` on the Confirm button.

**Existing confirmation building block, for style reference only — not directly reusable:**
`components/ui/ConfirmationModal.tsx` wraps Chakra's `AlertDialog` with a single Confirm/Cancel pair
and no decision state `[VERIFIED: controller/components/ui/ConfirmationModal.tsx]`. It has no concept
of "disabled until decisions complete," so `RunControlConfirmModal` needs new decision-state logic;
`ConfirmationModal`'s `AlertDialog` + `leastDestructiveRef` structure is a reasonable visual/structural
model but not a drop-in dependency.

### `trpc.tool.*` router structure and tool-by-id resolution (for `recoveryControl`)

`toolRouter` lives at `controller/server/routers/tool.ts` `[VERIFIED, full file read]`. The existing
`status`/`info`/`configure` procedures already establish the exact resolution pattern `recoveryControl`
should reuse:

```ts
// controller/server/routers/tool.ts:392-418 (existing `status` procedure, pattern to copy)
status: procedure.input(z.object({ toolId: z.string() })).query(async ({ input }) => {
  const toolRecord = await getToolFromDB(input.toolId);       // resolves numeric id OR normalized name
  const tool = Tool.forId(toolRecord.name, toolRecord.ip, toolRecord.port, toolRecord.type as ToolType);
  return await tool.fetchStatus();
}),
```

`getToolFromDB` (`tool.ts:46-65`) accepts either a numeric DB id or a tool name, normalizing both sides
with `(s || "").toLowerCase().replace(/[^a-z0-9]/g, "")` before matching — this is the same normalize
idiom already used in `tools.ts`'s `getToolFromStore`/`normalizeToolKey`
`[VERIFIED: controller/server/tools.ts:44-46]`. `recoveryControl({toolId, action, params})` should:
resolve via `getToolFromDB(toolId)` → `Tool.forId(record.name, record.ip, record.port, record.type)` →
check `CommandQueue.global.runningStep?.toolId` against the resolved tool's id (own-property-safe
comparison, matching `getRunControl`'s pattern) → `validateControlRequest(record.type, action, params)`
restricted to `action ∈ {"resume","abort"}` → `tool.controlCommand(action, verdict.decisions)` →
`logAction` → return `{ok, response, message}`, mirroring `CommandQueue.toolControl`'s existing shape
exactly (`controller/server/command_queue.ts:429-505`).

**Tool page's existing `id` param** is a string sourced from the route (`router.query.id`), used
directly in `trpc.tool.info.useQuery({ toolId: id })` — confirms it is the same opaque "name or numeric
id" string this router already normalizes everywhere, so the new "Run recovery" section's `toolId`
value requires no new resolution logic `[VERIFIED: controller/pages/tools/[id].tsx:36-51]`.

## Standard Stack

No new runtime dependencies. Phase 2 is entirely new files/edits within the existing stack:

### Core (existing, reused as-is)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @chakra-ui/react | 2.8.2 (installed) | Modal, RadioGroup, Progress, Badge, Button, useToast-style standalone toast | Already the UI library for every existing modal in `components/runs/` |
| @trpc/server, @trpc/client, @trpc/react-query | ^10.9.0 (installed) | `recoveryControl` mutation, `useRunControlState` query | Already the API layer; Phase 1 already added `toolControl`/`runState` on this stack |
| @tanstack/react-query (via trpc) | ^4.22.0 (installed) | `refetchInterval`, mutation pending state | Already used for every existing poll in `RunsComponent.tsx` |
| vitest | 2.1.9 (pinned, Phase 1 D-approved) | Pure-logic + server unit tests | Already the sole test runner; `vite-tsconfig-paths` already resolves `@/` |

### Package Legitimacy Audit

**Not applicable this phase** — no new npm packages are introduced. All Phase 2 work reuses the
existing Chakra/tRPC/React Query/Vitest stack already vetted and pinned in Phase 1. If the plan later
discovers a genuine need for a new test dependency (e.g. jsdom/RTL, per D-24's escape hatch), that
decision requires a `checkpoint:human-verify` task per D-24, and the Package Legitimacy Gate must be
re-run against that specific package before it is added.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────── Browser (React) ───────────────────────────────┐
│                                                                                 │
│  RunsComponent.tsx                                                             │
│   ├─ useRunControlState() ──► trpc.commandQueue.runState.useQuery              │
│   │     (2s poll)                  (polled every 2s, single source of truth)   │
│   │                                                                            │
│   ├─ ControlBar (new, mounted above Runs List Card)                           │
│   │     reads hook → state badge, percent bar, Pause/Resume/Abort buttons     │
│   │     button click ──► opens RunControlConfirmModal (shared, D-06)          │
│   │                                                                            │
│   ├─ ToolPausedModal (new, mounted next to PauseModal/StopRunModal)           │
│   │     reads hook.pause → opens on new episode, closes on null/running-false │
│   │     Resume/Abort buttons ──► opens RunControlConfirmModal (same instance) │
│   │                                                                            │
│   └─ QueueStatuscomponent.tsx                                                 │
│         "Pause queue" button: if hook reports running controllable step       │
│            ──► InstrumentStopModal (new) instead of commandQueue.stop         │
│         "Clear All" / per-run delete: same interception (D-19 finding)        │
│                                                                                 │
│  RunControlConfirmModal / InstrumentStopModal (shared, no optimistic update)  │
│   onConfirm ──► trpc.commandQueue.toolControl.mutate({action, params})        │
│       (D-18 sequencing for Stop/ClearAll: await abort ok:true, THEN stop/clear)│
│       ok:true  → close modal, success toast, bar updates from NEXT poll only  │
│       ok:false/error → close modal, PERSISTENT error toast (duration: null)   │
│                                                                                 │
│  pages/tools/[id].tsx                                                         │
│   └─ "Run recovery" section (new, always rendered for runControl tool types)  │
│         Resume/Abort ──► trpc.tool.recoveryControl.mutate (new mutation)      │
│         disabled only when hook shows a tracked running step on THIS toolId   │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                 │ tRPC (httpBatchLink, no timeout, long-running
                                 │       Node server — no platform deadline)
┌────────────────────────────── Next.js API route ──────────────────────────────┐
│  server/routers/command_queue.ts: runState (query), toolControl (mutation,    │
│    Phase 1, unchanged), stop, clearAll, clearByRunId (unchanged signatures)   │
│  server/routers/tool.ts: recoveryControl (NEW mutation)                      │
│                                                                                │
│  CommandQueue (server/command_queue.ts)                                      │
│   - runningStep (in-memory only) — recoveryControl's refusal check reads this │
│   - toolControl (Phase 1, unchanged) — validates via runControl.ts            │
│                                                                                │
│  Tool.controlCommand (server/tools.ts:379-392) — direct gRPC, no deadline    │
└────────────────────────────────┬──────────────────────────────────────────────┘
                                  │ gRPC ExecuteCommand (no CallOptions/deadline)
                                  ▼
                        F.A.S.T. tool server (galago-tools, separate repo)
```

### Recommended Project Structure
```
controller/
├── hooks/
│   └── useRunControlState.ts         # D-01: single reader of commandQueue.runState
├── components/runs/
│   ├── controlDecision.ts            # NEW pure .ts: decision-state logic, episode keys,
│   │                                 #   button-enablement hints, describePauseDetail
│   ├── RunControlConfirmModal.tsx    # D-06: shared confirm modal
│   ├── ToolPausedModal.tsx           # D-10..D-15
│   ├── InstrumentStopModal.tsx       # D-16/D-17
│   ├── ControlBar.tsx                # D-01..D-05 (name at Claude's discretion)
│   ├── PauseModal.tsx                # existing, unchanged — style reference
│   └── StopRunModal.tsx              # existing, unchanged, NOT imported by new flow
├── components/tools/
│   └── constants.ts                  # D-20: remove fast.abort/fast.resume entries
├── server/
│   ├── routers/tool.ts               # D-22: add recoveryControl
│   └── routers/command_queue.ts      # unchanged (Phase 1 already added runState/toolControl)
├── pages/tools/[id].tsx              # D-21: add "Run recovery" section
└── test/
    ├── controlDecision.test.ts       # NEW: pure-logic module tests (D-24)
    ├── recoveryControl.test.ts       # NEW: server tests, fakeTool pattern (D-24)
    ├── staticScan.test.ts            # NEW: source-scan invariants (D-24)
    └── runControl.test.ts            # EDIT: flip the D-10 commandFields assertion (D-20)
```

### Pattern 1: Single-hook state fan-out (D-01)

**What:** One `useQuery` call, one hook, multiple consumers.
**When to use:** Any time two or more UI elements must never visibly disagree about the same
server-polled truth (exactly the failure mode Pitfall 9 describes, and exactly why `modalState`
already exists as a combined query for the five pre-existing modal types).
**Example (pattern, not copy — new code for this phase):**
```ts
// hooks/useRunControlState.ts
import { trpc } from "@/utils/trpc";

export function useRunControlState() {
  return trpc.commandQueue.runState.useQuery(undefined, { refetchInterval: 2000 });
}
```
Every consumer (`ControlBar`, `ToolPausedModal`, the Stop/ClearAll interception in
`QueueStatuscomponent`) calls this same hook — React Query dedupes identical queries by key, so this
is one network poll shared across all consumers, not N separate ones
`[CITED: @tanstack/react-query v4 query deduplication behavior — standard React Query semantics for
identical query keys under one QueryClient, already relied on implicitly by this codebase's existing
multiple `trpc.commandQueue.getAll.useQuery()` call sites at different poll intervals]`.

### Pattern 2: Sequenced mutation before a destructive action (D-18, extended to D-19)

**What:** Fire a reversible-feeling mutation (`toolControl` abort), wait for `ok: true`, THEN fire the
actually-destructive one (`stop`/`clearAll`/`clearByRunId`).
**When to use:** Any UI action that would otherwise detach/orphan a running controllable step.
**Example:**
```ts
// InstrumentStopModal.tsx — onConfirm (pattern)
const result = await toolControlMutation.mutateAsync({ action: "abort", params: { return_liquid } });
if (result.ok) {
  await stopMutation.mutateAsync();   // or clearAllMutation / clearByRunIdMutation per call site
  onClose();
} else {
  showPersistentErrorToast(result.message);
  // do NOT call stop/clearAll/clearByRunId
}
```

### Anti-Patterns to Avoid

- **Reusing `StopRunModal` for the instrument flow:** confirmed its `handleConfirm` starts a 5s
  `setInterval` countdown that calls `onConfirm()` automatically
  `[VERIFIED: controller/components/runs/StopRunModal.tsx:44-62]` — violates "no timer, no default."
- **Adding `tool_paused` to the `UIMessage` union / routing it through `_messageResolve`:** confirmed
  every existing `UIMessage` type's promise is awaited by the busy loop before the step is marked
  complete (`command_queue.ts:866-868` etc. pattern) — a F.A.S.T. pause happens *inside* the still-open
  `Tool.executeCommand` call the busy loop is already awaiting; there is no second promise to resolve.
- **Giving `toolControl`/`recoveryControl`'s gRPC call a deadline/timeout:** confirmed no `CallOptions`
  is passed anywhere in this codebase's gRPC call sites; introducing one for control commands would
  contradict the "step stays open through pauses" design intent (D-23 above).
- **Gating the tool page's "Run recovery" visibility on "is a step running":** must gate only on
  "this tool type has a `runControl` entry" (Pitfall 10) — reusing the control bar's rendering
  condition would hide crash-recovery controls exactly when they're needed (after a galago-web
  restart, the queue has no running step even though the instrument may still be paused).
- **Reusing the generic `errorToast` for D-09's persistent refusal toast:** confirmed it hardcodes
  `duration: 10000`, not `null` — it will auto-dismiss before the operator necessarily reads a refusal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal close-on-Esc/overlay-click | A custom keydown/click-outside handler | Chakra `Modal`'s default `closeOnEsc`/`closeOnOverlayClick` (both `true` by default in 2.8.2) | Already does exactly what D-07/D-17 need; adding custom handlers risks double-firing `onClose` |
| "Has every decision been made" gating | A manual `useEffect` diffing object keys | A small pure function (`allDecisionsChosen(decisionSpec, values)`) in the new `controlDecision.ts`, unit-tested in isolation | Matches D-24's "pure-logic modules" testing strategy directly; keeps the component thin |
| Pause-episode "is this a new pause" detection | Comparing full `pause` object deep-equality | The documented episode key: `queueId + pause.startedAt`, fallback `name + code` (D-11) — a one-line string key compared across renders | Exactly specified by D-11; deep-equality would misfire on any field churn (e.g. if `detail` ever varies within one episode) |
| Server-side tool resolution for `recoveryControl` | A new lookup helper | `getToolFromDB` + `Tool.forId`, the exact pattern `status`/`info`/`configure` already use | One resolution idiom across the whole router; avoids a second normalize function drifting from `tools.ts`'s `normalizeToolKey` |

**Key insight:** Every "don't hand-roll" item above already has a working precedent somewhere in this
exact codebase — this phase is overwhelmingly about composing existing, already-reviewed patterns
(Phase 1's `runControl.ts`, the existing modal styling, the existing `toolRouter` resolution idiom)
rather than introducing new techniques.

## Common Pitfalls

(Full detail in `.planning/research/PITFALLS.md`, items 1, 2, 9, 10 — summarized here with this
session's direct-source confirmation status.)

### Pitfall 1: Reusing `StopRunModal`'s auto-countdown — CONFIRMED in current code
**What goes wrong:** `handleConfirm` (`StopRunModal.tsx:46-62`) starts a `setInterval` that calls
`onConfirm()` after 5s regardless of further operator input.
**How to avoid:** `InstrumentStopModal` is a wholly new component; never import `StopRunModal` in its
module, and assert that via the D-24 static scan.
**Warning signs:** Any `import { StopRunModal }` inside a file that also imports `toolControl`.

### Pitfall 2: `tool_paused` wired through `_messageResolve` — risk structurally prevented by design
**What goes wrong:** Every existing `UIMessage` type blocks the busy loop until `resume()` resolves it;
`tool_paused` must never join that union since the F.A.S.T. pause happens inside an already-open
`Tool.executeCommand` call.
**How to avoid:** `ToolPausedModal` reads only `useRunControlState()`; it must never import
`CommandQueue`/call `commandQueue.resume` — assert via the same static scan.

### Pitfall 9: `runState` polling racing the queue's existing atomic `modalState` poll
**What goes wrong:** A second independently-cadenced poll can show a progress bar and a pause prompt
disagreeing for one tick.
**How to avoid:** D-01's single-hook mandate already prevents this for anything reading `runState`
(control bar + pause prompt + Stop interception all share one `useQuery`). No action needed beyond
following D-01 — confirmed there is exactly one `runState`-reading hook planned, not several.

### Pitfall 10: Crash-recovery controls gated on "is a step running," hiding them when needed
**What goes wrong:** Reusing the control bar's render condition for the tool page's "Run recovery"
section would hide it exactly when an operator needs it most (after a restart).
**How to avoid:** Gate purely on `getRunControl(toolType) !== undefined`; disable (don't hide) only
when `runningStep?.toolId` matches this specific tool.
**Warning signs:** A shared `useControllableStep()` hook/condition reused by both the control bar and
the tool-page section.

### New pitfall found this session: `Clear All` has no confirmation today at all
**What goes wrong:** `QueueStatuscomponent.tsx`'s "Clear All" button calls
`clearAllMutation.mutate()` directly on click with zero confirmation dialog
`[VERIFIED: controller/components/runs/status/QueueStatuscomponent.tsx:54-56,115-126]`. Combined with
the D-19 finding (clearAll detaches a running step), this is the single highest-risk gap uncovered in
this research pass — it is not merely "needs the same modal as Stop," it currently has **no**
confirmation whatsoever, instrument-aware or not.
**How to avoid:** Route `Clear All` through `InstrumentStopModal` when a controllable step is running
(per D-19); when no controllable step is running, the existing no-confirmation behavior is
*unchanged scope* for this phase (adding a generic confirmation to `Clear All` for the non-instrument
case is not a Phase 2 requirement — flag it only if the plan wants to close the gap proactively).

## Code Examples

### `useRunControlState` hook (D-01)
```ts
// hooks/useRunControlState.ts — new file, pattern only
import { trpc } from "@/utils/trpc";

export function useRunControlState() {
  // Shared by ControlBar, ToolPausedModal, and the Stop/ClearAll interception —
  // React Query dedupes by query key, so this is ONE poll, not three (Pitfall 9).
  return trpc.commandQueue.runState.useQuery(undefined, { refetchInterval: 2000 });
}
```

### Pause-episode key (D-11)
```ts
// components/runs/controlDecision.ts — new file, pattern only
import type { RunStateEnvelope } from "@/server/runState";

export function pauseEpisodeKey(envelope: RunStateEnvelope): string | null {
  if (!envelope.running || !envelope.runState?.pause) return null;
  const { pause } = envelope.runState;
  if (pause.startedAt) return `${envelope.queueId}:${pause.startedAt}`;
  return `${pause.name ?? "unknown"}:${pause.code ?? "unknown"}`;
}
```
(Importing `RunStateEnvelope` as a type-only import keeps this file free of runtime server
dependencies — safe to also import from a Vitest node-env test per D-24.)

### Button-enablement hint (D-04)
```ts
// components/runs/controlDecision.ts — pattern only
export type ButtonHint = "enabled" | "disabled";

export function controlButtonHints(state: string | undefined): {
  pause: ButtonHint; resume: ButtonHint; abort: ButtonHint;
} {
  if (state === "running") return { pause: "enabled", resume: "disabled", abort: "enabled" };
  if (state === "paused") return { pause: "disabled", resume: "enabled", abort: "enabled" };
  // Unknown/unrecognised state (including the real values this tool reports, and status: "unknown"):
  // all three enabled per D-04 — never strand the operator.
  return { pause: "enabled", resume: "enabled", abort: "enabled" };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Abort/Resume only as planned protocol steps or tool-page Send Command | `runControl` capability + live control bar + crash-recovery section | Phase 1 (control path) / Phase 2 (UI) | Operators react to a live pause instead of needing to have planned recovery in advance |
| `Tool.fetchStatus` stops heartbeat on first failure | Retries with a failure-streak counter | Phase 1 (already shipped) | `commandQueue.runState`'s "unknown" status can recover without a manual restart — Phase 2 UI must render this transition (D-03/D-13), not re-fix the heartbeat |
| `commandFields.fast` includes `abort`/`resume` as plannable steps | Those two keys removed; only reachable via `runControl` (bar/prompt/tool-page) | This phase (D-20) | Step editor's dropdown shrinks by two entries; existing saved steps keep working (confirmed above) |

**Deprecated/outdated:** The protocol-step `abort`/`resume` commands are not deleted at the gRPC/
adapter level (galago-tools still implements them) — only galago-core's step-editor *offering* of them
is removed. This is a UI-surface change, not a capability removal.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No new test dependency will be needed to satisfy D-24's pure-logic coverage goal (jsdom/RTL stays out of scope) | Standard Stack / D-24 | If a UI-rendering-dependent assertion turns out to be the only way to prove a criterion, the plan needs a `checkpoint:human-verify` task before adding jsdom/RTL — flagged already by D-24 itself, not a new risk this research introduces |
| A2 | `Clear All`'s current total absence of confirmation is out of this phase's scope to fix for the *non-instrument* case (only the instrument-running case per D-19 needs the new modal) | Common Pitfalls (new pitfall) | If the user actually wants `Clear All` to always confirm (not just when an instrument is running), that's a scope question for discuss-phase/plan, not something this research can decide unilaterally |
| A3 | React Query's default dedup-by-query-key behavior (no custom `queryKey`, no `cacheTime: 0` override) is in effect for `trpc.commandQueue.runState.useQuery` the same way it is for the codebase's other `trpc.commandQueue.*.useQuery` calls | Pattern 1 | If a consumer accidentally passes a different options object causing a distinct query identity, Pitfall 9's race could resurface despite D-01's single-hook intent — worth a quick manual check in the plan's verification step, not re-derivable from static reading alone |

**All other claims in this research are `[VERIFIED]` via direct `Read` of the exact source file (this
repo, this session) or `[CITED]` from `.planning/PROJECT.md`/`.planning/research/ARCHITECTURE.md`,
both already-approved project documents.**

## Open Questions (RESOLVED)

1. **Does `recoveryControl`'s `toolId`-match check need the same normalize-both-sides comparison as
   `getToolFromDB`, or can it compare raw strings?**
   - What we know: `CommandQueue.runningStep.toolId` is set from `nextCommand.commandInfo.toolId`
     (whatever string was stored when the step was enqueued); `getToolFromDB` normalizes its input.
   - What's unclear: whether `commandInfo.toolId` is always already the DB-canonical name string, or
     could differ in casing/punctuation from the value `recoveryControl`'s caller passes.
   - Recommendation: normalize both sides with the same `(s||"").toLowerCase().replace(/[^a-z0-9]/g,"")`
     idiom already used twice in this codebase, to be safe and consistent, rather than assuming exact
     string equality.
   - RESOLVED: normalize both sides — implemented in 02-04 (`normalize(runningStep.toolId)` vs `normalize(toolName)`).

2. **Should the per-run delete button's existing generic `ConfirmationModal` be removed entirely when
   `InstrumentStopModal` is shown, or layered (confirm twice)?**
   - What we know: today one click → `ConfirmationModal` → confirm → `clearByRunId`. D-19 adds an
     instrument-aware gate.
   - What's unclear: CONTEXT.md's D-19 doesn't specify UX for this specific button beyond "route
     through the same InstrumentStopModal."
   - Recommendation: when a controllable step is running, skip the generic `ConfirmationModal`
     entirely and go straight to `InstrumentStopModal` (which already has its own Cancel) — avoids a
     confusing double-confirmation UX; when no controllable step is running, keep today's
     `ConfirmationModal` unchanged.
   - RESOLVED: skip the generic modal and go straight to `InstrumentStopModal` while a controllable
     step runs — implemented in 02-03 Task 2.

## Environment Availability

Skipped — this phase has no new external dependencies. All required tools (Node v24.14.1 via nvm,
npm, vitest, tsc) were already verified present and working in Phase 1
`[CITED: .planning/PROJECT.md "Gate" line — tsc --noEmit (0 errors) plus Vitest, 92 tests as of Phase 1]`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 (node environment) |
| Config file | `controller/vitest.config.mts` |
| Quick run command | `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" && npm --prefix controller run test:unit` |
| Full suite command | same as quick run (no split unit/integration tiers today), plus `npm --prefix controller test` for `tsc --noEmit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Bar renders only when running + runControl declared | unit (pure logic) | `vitest run test/controlDecision.test.ts -t "bar visibility"` | ❌ Wave 0 (new file) |
| UI-01 | Button enablement hints per state (D-04) | unit (pure logic) | `vitest run test/controlDecision.test.ts -t "button hints"` | ❌ Wave 0 |
| UI-02 | No code path sends a control action without going through the confirm modal's completed-decision gate | unit (static scan) | `vitest run test/staticScan.test.ts -t "confirmed-send single call site"` | ❌ Wave 0 |
| UI-03 | Confirm disabled until every declared decision is chosen; reset on reopen | unit (pure logic) | `vitest run test/controlDecision.test.ts -t "decision completeness"` | ❌ Wave 0 |
| UI-04 | `describePauseDetail` renders known `wrongDetection` shape and falls back for unknown shapes | unit (pure logic) | `vitest run test/controlDecision.test.ts -t "describePauseDetail"` | ❌ Wave 0 |
| UI-05 | Pause-episode open/close/reset rules (new episode, null pause, running false, queueId change) | unit (pure logic) | `vitest run test/controlDecision.test.ts -t "pause episode"` | ❌ Wave 0 |
| UI-06 | Stop sequencing: abort ok→stop; refused→no stop | unit (pure logic) | `vitest run test/controlDecision.test.ts -t "stop sequencing"` | ❌ Wave 0 |
| UI-06 | `StopRunModal` not imported by the new Stop flow | unit (static scan) | `vitest run test/staticScan.test.ts -t "StopRunModal not reused"` | ❌ Wave 0 |
| UI-07 | Existing saved fast abort/resume steps still render in the step list/drawer after `commandFields.fast` removal | unit (regression, pure data) | `vitest run test/runControl.test.ts` (existing file, assertion flipped per D-20) | ✅ existing file, edit required |
| UI-07 | `recoveryControl` refuses when tracked running step is on this toolId; refuses undeclared action; refuses pause | unit (server, mocked gRPC) | `vitest run test/recoveryControl.test.ts` | ❌ Wave 0 (new file) |
| UI-08 | `toolControl`/`recoveryControl` called from exactly one module each; `Tool.controlCommand` called only from those two | unit (static scan) | `vitest run test/staticScan.test.ts -t "single call site"` | ❌ Wave 0 |
| UI-08 | No `setTimeout`/`setInterval` in control-UI modules | unit (static scan) | `vitest run test/staticScan.test.ts -t "no timers"` | ❌ Wave 0 |
| all | `tsc --noEmit` stays at 0 errors | typecheck | `npm --prefix controller test` | ✅ existing gate |

### Sampling Rate
- **Per task commit:** `npm --prefix controller run test:unit` (fast, node env, no gRPC/network)
- **Per wave merge:** `npm --prefix controller run test:unit && npm --prefix controller test`
- **Phase gate:** Full suite green (`bin/make test`, per D-25) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/controlDecision.test.ts` — covers UI-01, UI-03, UI-04, UI-05, UI-06 pure-logic behavior
- [ ] `test/recoveryControl.test.ts` — covers UI-07's server-side refusal matrix
- [ ] `test/staticScan.test.ts` — covers UI-02, UI-06, UI-08's structural invariants
- [ ] Edit `test/runControl.test.ts` — flip the D-10 `commandFields.fast.abort/.resume` assertion
      (currently asserts presence; must assert absence once D-20 ships) — covers UI-07's regression
      check
- Framework install: none — Vitest 2.1.9 and `vite-tsconfig-paths` are already installed and
  configured (Phase 1)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | This app has no auth layer in scope for this phase; unchanged from Phase 1 |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No | Single-operator workcell app; no role separation in scope |
| V5 Input Validation | Yes | `validateControlRequest` (existing, Phase 1) — fail-closed exact-string `"yes"`/`"no"` matching, reused unchanged by `recoveryControl` (D-22) |
| V6 Cryptography | No | No new cryptographic material this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| UI sends a physically destructive instrument command without explicit, logged operator intent | Repudiation / Tampering | `logAction` on every `toolControl`/`recoveryControl` call (existing pattern, Phase 1), reused for `recoveryControl`; D-24's static scan proves the single call-site invariant so no new code path can bypass logging |
| A detached/orphaned run (queue forgets a step while the instrument keeps running) | Denial of Service (operationally — an unsupervised physical run) | D-18/D-19's abort-before-stop/clear sequencing, now proven necessary for `clearAll`/`clearByRunId` too (this session's finding), not just the Stop button |
| Client-side-only state gating being mistaken for a security boundary | Elevation of Privilege (conceptually — bypassing a "gate" that was never a real gate) | D-04 explicitly documents button enablement as "a hint, not a gate" — the real gate is the F.A.S.T. core's own state machine (`_require_state`), which this codebase and this phase correctly never attempt to duplicate (constraint: "No state checks in galago-core") |

## Sources

### Primary (HIGH confidence — direct `Read` this session)
- `controller/server/runControl.ts`, `controller/server/runState.ts` — capability map, validation,
  envelope shapes
- `controller/server/command_queue.ts` (full busy-loop section, `toolControl`, `clearAll`/
  `clearByRunId`, `stop`, `resume`, `_runningStep`) — the central file for this phase's server-side
  interactions
- `controller/server/utils/SqliteQueue.ts` — `startNext`, `complete`, `clearAll`, `clearByRunId`,
  `_updateItem` (D-19's key evidence)
- `controller/server/tools.ts`, `controller/server/utils/promisifyGrpcCall.ts` — `controlCommand`, no
  gRPC deadline (D-23's key evidence)
- `controller/server/routers/command_queue.ts`, `controller/server/routers/tool.ts` — existing
  procedure shapes to mirror for `recoveryControl`
- `controller/components/runs/RunsComponent.tsx`, `PauseModal.tsx`, `StopRunModal.tsx`,
  `components/runs/status/QueueStatuscomponent.tsx` — placement, existing modal styling, the
  interception point, Pitfall 1 confirmation
- `controller/components/protocols/AddToolCommandModal.tsx`, `ProtocolDetailView.tsx`,
  `CommandDetailsDrawer.tsx`, `components/tools/constants.ts` — D-20's evidence
  (`commandFields` consumer tracing)
- `controller/components/ui/Toast.tsx`, `ConfirmationModal.tsx`, `Delete.tsx` — toast pattern
  correction, existing confirm-modal style reference
- `controller/pages/tools/[id].tsx`, `controller/utils/trpc.ts`,
  `controller/pages/api/trpc/[trpc].ts` — tool-page `id` resolution, tRPC client/server config
- `controller/node_modules/@chakra-ui/modal/dist/index.js`,
  `controller/node_modules/@chakra-ui/radio/dist/use-radio-group.js`,
  `controller/node_modules/@chakra-ui/react/package.json` — Chakra 2.8.2 defaults, verified against
  the exact installed version
- `controller/vitest.config.mts`, `controller/tsconfig.json`, `controller/test/runControl.test.ts`,
  `controller/test/toolControl.test.ts`, `controller/test/helpers/fakeTool.ts` — D-24's evidence
- `.planning/phases/02-run-page-live-controls/02-CONTEXT.md`, `.planning/REQUIREMENTS.md`,
  `.planning/STATE.md`, `.planning/config.json`

### Secondary (MEDIUM confidence — project documents, already approved, cross-checked against code
this session where re-checkable)
- `/home/formulatrix/data/nikko/galago-tools/docs/specs/2026-10-12-galago-live-run-control-design.md`
  (governing design, §3, §6.1–6.6, §7, §8, §9, §11)
- `.planning/PROJECT.md` (constraints, key decisions, context)
- `.planning/research/PITFALLS.md` (pitfalls 1, 2, 9, 10 — re-confirmed against current code this
  session, not just taken at face value)
- `.planning/research/ARCHITECTURE.md` (Anti-Pattern 2's no-gRPC-deadline claim, independently
  re-verified by direct `Read` this session rather than trusted as-is)

### Tertiary (LOW confidence)
- None used — every claim above is either `[VERIFIED]` by this session's direct source reads or
  `[CITED]` from an already-approved project document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every existing one confirmed installed at the version
  claimed
- Architecture: HIGH — every integration point traced to an exact file/line this session, not taken
  from the design doc's prose
- Pitfalls: HIGH — all four cited pitfalls re-confirmed against current code; one new pitfall
  (`Clear All` has zero confirmation today) found and confirmed this session
- D-19/D-20/D-23/D-24 specific research questions: HIGH — each answered with direct source evidence,
  not inference

**Research date:** 2026-10-13
**Valid until:** 30 days (stable internal codebase, no fast-moving external dependency in this phase's
scope) — re-verify sooner only if Phase 1's `runControl.ts`/`runState.ts`/`command_queue.ts` shapes
change before Phase 2 executes
