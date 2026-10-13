# Phase 2: Run Page Live Controls - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning
**Mode:** `--auto` (Claude picked the recommended option for every gray area; review before planning if any choice looks wrong)

<domain>
## Phase Boundary

UI and thin server glue on top of Phase 1's control path (`commandQueue.toolControl`,
`commandQueue.runState`, `runControl` map, `Tool.controlCommand`). Phase 2 delivers:
- a run-page **control bar** for a running controllable step (state, percent, Pause/Resume/Abort);
- a shared **confirmation** flow with non-defaulted yes/no decisions for every control action;
- the **`tool_paused` prompt** (reason, plain-language detail, start time, Resume/Abort);
- a new **Stop confirmation** (D4) when the queue is stopped during a controllable step;
- **step-editor cleanup** (fast `abort`/`resume` leave `commandFields`) and a **tool-page crash-recovery**
  Resume/Abort;
- tests proving no control action is sent without a confirmed operator choice (UI-08).

Not in scope: hard pause (D5), F3/F5 debt, simulated pause end to end, adapter/deploy work
(galago-tools). Requirements: UI-01..UI-08.

</domain>

<decisions>
## Implementation Decisions

### Control bar and its state source (UI-01, Pitfall 9)
- **D-01:** One client hook (e.g. `useRunControlState`) is the **only** reader of
  `commandQueue.runState` (`refetchInterval: 2000`). The control bar, the `tool_paused` prompt and the
  Stop interception all consume that one hook result, so they can never disagree about "running" or
  "paused" (Pitfall 9, second mitigation). Do **not** fold `runState` into `modalState`: that query is
  the queue's `UIMessage` plumbing and `tool_paused` must stay out of it (PROJECT constraint).
- **D-02:** The bar renders only when the envelope is `running: true` **and** `getRunControl(toolType)`
  is defined; tools without `runControl` show nothing. Placement: in `RunsComponent`, above the run
  list, labelled with the tool name/type and the running command, keyed by `queueId`.
- **D-03:** Shows a state badge (`running` / `paused` / other raw state text) and a progress bar from
  `percent` (indeterminate when `percent` is null). When `status: "unknown"`, show a "Run state
  unknown since <time>" warning with `lastError`, keep the last good state visible (Phase 1 D-17), and
  never hide the bar.
- **D-04:** Button enablement is a **hint, not a gate** (design §7.2, UI-08): Pause enabled when state
  is `running`, Resume when `paused`, Abort when `running` or `paused`. When state is unknown or an
  unrecognised value, **all three are enabled**. Hiding controls when observation fails would strand
  the operator. The core's state gates decide, and their refusals are shown (D-09). No other
  client or server state check is added.
- **D-05:** Labels tell the two pauses apart (§6.5). The queue button in `QueueStatuscomponent`
  becomes "Pause queue", and the bar's buttons read "Pause instrument", "Resume instrument" and
  "Abort instrument run".

### Confirmation and decision UX (UI-02, UI-03)
- **D-06:** One shared **`RunControlConfirmModal`** serves the control bar, the `tool_paused` prompt,
  the tool page and (with its own copy) the Stop flow. It is driven by `runControl[toolType][action]`
  plus a small label map: `is_tip_broken` → "Tip broken?" and `return_liquid` → "Return liquid?",
  with Yes/No options. Pause has no decisions and still asks "Pause the F.A.S.T. run?". —
  **Reversibility:** costly — every control entry point routes through it.
- **D-07:** Every decision is a radio group whose initial value is **undefined** (nothing
  preselected). Confirm stays disabled until every declared decision has a value. Decision state is
  **reset on every open** and never remembered. No timers, no auto-confirm, and no default button
  bound to Enter. Close, Esc, overlay click and Cancel all mean Cancel, and nothing is sent.
- **D-08:** The confirmation text restates the choice in plain words, e.g. "Resume the F.A.S.T. run.
  Tip broken: No." or "Abort the F.A.S.T. run. Return liquid: Yes." All actions move the head, so
  the copy says so.
- **D-09:** **No optimistic UI.** While the mutation is in flight, Confirm shows a spinner and
  repeat clicks are ignored. If the result has `ok: true`, close the modal and show a success
  toast; the bar updates only from the next `runState` poll. If it has `ok: false` (core
  `Refused`), close the modal and show a **persistent** error toast (`duration: null`, closable)
  carrying the refusal message verbatim. tRPC/transport errors behave the same way. No automatic
  retry ever.

### `tool_paused` prompt (UI-04, UI-05)
- **D-10:** `ToolPausedModal` is a new component next to `PauseModal`, **outside** the
  `messageData`/`isModalOpen` state. It never calls `resume()` or `modalState`, and never touches
  any queue mutation except `toolControl` through the confirm modal.
- **D-11:** It opens when the hook's `runState.pause` is non-null. A pause **episode key** of
  `queueId` plus `pause.startedAt`, falling back to `name`+`code`, drives automatic opening. The
  operator may dismiss it ("Hide"), which sends nothing. A "Paused: view reason" button on the
  control bar reopens it. A new episode opens it automatically again.
- **D-12:** It closes automatically when `pause` becomes null, `running` becomes false, or `queueId`
  changes. If a confirm modal opened from it is still open at that moment, close that too and show
  an info toast: "The run resumed or the step ended before you confirmed; nothing was sent."
- **D-13:** While status is unknown and a pause was last seen, keep the prompt open and show the
  same "Run state unknown" warning. Don't close on unknown.
- **D-14:** Content: the reason as "WrongPlateType (-645)" (name and code; show whichever exists),
  the detail, and the start time as local clock time plus relative age ("10:42:05, 3 min ago").
  The detail comes from a pure `describePauseDetail(detail)` formatter. It renders known shapes in
  plain language: `wrongDetection: [{expectedPlateID, detectedPlateID, position}]` becomes "Deck
  {position}: expected plate {expectedPlateID}, found {detectedPlateID or 'none'}". Unknown shapes
  fall back to pretty JSON in a collapsible "Raw detail" section. Never drop it.
- **D-15:** The prompt offers **Resume** and **Abort** buttons, both enabled, which open the shared
  confirm modal (D-06). The yes/no decision is made there, so there is a single decision/send code
  path.

### Stop confirmation (UI-06, D4)
- **D-16:** The trigger is the queue-stop button in `QueueStatuscomponent`, which today calls
  `commandQueue.stop` (relabelled "Pause queue" per D-05). When the hook reports a running
  controllable step, this button opens a new **`InstrumentStopModal`** instead of calling `stop`.
  Otherwise it behaves exactly as today.
- **D-17:** `InstrumentStopModal` offers "Abort the instrument run" with "Return liquid? ○ Yes ○
  No" (nothing selected; the action is disabled until a choice is made), and **Cancel**. No timer,
  no default; close, Esc and overlay click mean Cancel. `StopRunModal` is neither imported nor
  reused. The `stop_run` Tool Box step's existing `StopRunModal` path is unchanged, since it runs
  between steps.
- **D-18:** Sequencing on confirm: send `toolControl("abort", {return_liquid})`. **Only if** it
  returns `ok: true`, call `commandQueue.stop`; the step then ends as Aborted and the queue goes to
  `FAILED`. If abort is refused or errors, show the reason (D-09) and do **not** stop the queue.
  Stop must never leave an instrument run untracked.
- **D-19:** The researcher must check whether `clearAll` and `clearByRunId` (Clear All / skip run)
  can detach or drop a running controllable step. If they can, those buttons route through the same
  `InstrumentStopModal` while a controllable step runs. If they cannot, leave them unchanged and
  record why.

### Step editor cleanup and tool-page crash recovery (UI-07)
- **D-20:** Remove `abort` and `resume` from `commandFields.fast`. Both the protocol step editor
  (`AddToolCommandModal`) and the tool page's Send Command form read this map, so neither offers them
  any more. Existing saved protocols that contain fast abort/resume steps are not migrated. The
  planner checks that they still load and display without crashing, and records the result.
- **D-21:** The tool page (`pages/tools/[id].tsx`) gets a **"Run recovery"** section for any tool
  type with `runControl`, offering **Resume** and **Abort** (not Pause) through the shared confirm
  modal. The section is **always rendered** for such tools (Pitfall 10): its visibility never
  depends on a step running. When the hook shows a tracked running step on **this** `toolId`, the
  buttons are disabled with "A run step is tracking this tool; use the run page" and a link. In all
  other cases they are enabled, including when the run state is unknown.
- **D-22:** Server: a new tRPC mutation (e.g. `tool.recoveryControl({toolId, action, params})`)
  resolves the tool by id. It validates with the same `validateControlRequest` logic, using that
  tool's type, and limits `action` to `resume`/`abort`. It refuses with `PRECONDITION_FAILED` when
  the queue's `runningStep` is on that `toolId`; that check reads queue state, not instrument
  state. It sends via `Tool.controlCommand`, logs with `logAction` like `toolControl`, and returns
  the same `{ok, response, message}` shape. — **Reversibility:** reversible.
- **D-23:** A crash-recovery Resume can block until the resumed run ends, because the adapter waits
  in the no-run-in-flight case (design §5.1) and there is no gRPC deadline. The tool page shows the
  pending call as in progress without blocking the rest of the page. The researcher confirms that
  `Tool.controlCommand` won't time out early.

### Proving UI-08 (tests)
- **D-24:** No new UI test dependencies by default. Add none of jsdom or `@testing-library/react`
  unless the planner shows pure-logic tests can't cover a criterion; in that case a human-approval
  checkpoint is needed, as with Phase 1's package set A. The extra coverage comes from these Vitest
  (node env) tests:
  - **Pure-logic modules:** confirm-modal decision state (starts empty, Confirm disabled until
    complete, reset on reopen), pause-episode detection and auto-close rules, button-enablement
    hints, `describePauseDetail`, and the Stop sequencing (abort ok → stop; refused → no stop).
    Components stay thin over these modules.
  - **Static source-scan invariants**, in the spirit of galago-tools' AST checks. The
    `toolControl` and `recoveryControl` mutations are referenced from exactly one module, the
    confirmed-send hook, whose send function takes a completed decision object. `StopRunModal` is
    not imported by the new Stop flow. No `setTimeout`/`setInterval` exists in the control-UI
    modules. On the server, `Tool.controlCommand` is called only from `toolControl` and
    `recoveryControl`.
  - **Server tests** for `recoveryControl` refusals (tracked step on this tool, undeclared action,
    pause not allowed, blank decision) with a mocked gRPC client.
- **D-25:** Gate: `tsc --noEmit` at 0 errors, `npm run test:unit` green, and `prettier --check` via
  `bin/make test`.

### Claude's Discretion
- Exact component, hook and file names, and the visual layout and styling (Chakra, matching the
  existing modals).
- Toast wording, and whether the success toast includes the tool's response text.
- How the static scans are written (regex over source vs the TypeScript compiler API).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Governing design
- `../galago-tools/docs/specs/2026-10-12-galago-live-run-control-design.md` (sibling repo,
  `/home/formulatrix/data/nikko/galago-tools`). The relevant sections:
  - §3: interaction model and physical decisions;
  - §6.1: capability, with step-editor removal (D3);
  - §6.3–6.6: pause prompt, run page UI, concurrency labels, Stop (D4);
  - §7: safety invariants;
  - §8: failure modes, crash recovery;
  - §9: testing;
  - §11: D1–D6.

### Project planning
- `.planning/PROJECT.md` — constraints: never reuse auto-confirming UI, `tool_paused` is not a
  `UIMessage`, choices non-defaulted, no state checks.
- `.planning/REQUIREMENTS.md` — UI-01..UI-08 wording.
- `.planning/ROADMAP.md` — Phase 2 success criteria.
- `.planning/STATE.md` — Phase 1 carry-overs: show refusals, never update optimistically, the
  residual control race, and IN-01 (`RunStateMonitor.snapshot()` is a shallow copy, so don't
  mutate nested `runState`/`pause`).
- `.planning/research/PITFALLS.md` — Pitfall 1 (`StopRunModal` countdown), Pitfall 2
  (`tool_paused` through `_messageResolve`), Pitfall 9 (polling races), Pitfall 10 (crash-recovery
  controls hidden when needed).
- `.planning/research/ARCHITECTURE.md` and `.planning/research/FEATURES.md` — queue/modal
  architecture and the feature analysis.

### Phase 1 artifacts
- `.planning/phases/01-queue-control-path-run-state/01-CONTEXT.md` — D-01..D-20: the `runState`
  envelope (D-12), refusal codes (D-03), result shape (D-06), logging (D-07).
- `.planning/phases/01-queue-control-path-run-state/01-REVIEW-FIX.md` — WR-01 and the other review
  dispositions that affect the control path.

### Knowledge graph
- `.planning/graphs/graph.json` and `.planning/graphs/GRAPH_REPORT.md` — the code graph built
  2026-10-13 at `b6ff2a4`. Query it with `gsd-tools graphify query <term>`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `controller/server/runControl.ts`:
  - `runControl`, `getRunControl` and `validateControlRequest` (frozen map; the fixed refusal order
    a–e);
  - shared between server and UI (no imports), so the UI imports it directly.
- `controller/server/runState.ts`:
  - `RunStateEnvelope`, `RunState` and `PauseState` (`name`, `code`, `detail` as the raw
    `eventPayload`, `startedAt`);
  - the types for the client hook and `describePauseDetail`.
- `controller/server/routers/command_queue.ts`:
  - `runState` query (L143) and `toolControl` mutation (L152);
  - `stop` (L14), `clearAll` (L64), `clearByRunId` (L67).
- `controller/server/tools.ts`:
  - `Tool.controlCommand` and `ToolControlResult` (L28), which `recoveryControl` reuses.
- `controller/components/runs/PauseModal.tsx`, `MessageModal.tsx`, `ErrorModal.tsx`:
  - Chakra modal styling to match.

### Established Patterns
- `RunsComponent.tsx` polls `getAll` (2 s and 1 s), `getAllRuns` (1 s), `modalState` (1 s), `state`
  (1 s) and `getError` (1.5 s). The queue modals are driven by `messageData` and `isModalOpen`, and
  the new prompt stays out of that state.
- `StopRunModal.tsx` auto-fires `onConfirm` after a 5 s countdown. **Do not use** it for the
  instrument flow.
- `QueueStatuscomponent.tsx`: the button labelled "Pause" calls `queue.stop`, which awaits the
  running promise. That button is the D4 interception point.
- `commandFields` feeds `components/protocols/AddToolCommandModal.tsx` (step editor) and
  `pages/tools/[id].tsx` (Send Command, through `trpc.tool.runCommand`). The teach-pendant
  `CommandModal.tsx` also imports it but is unaffected by fast.
- Tests: Vitest 2.1.9 in the node environment, `test/**/*.test.ts`, `test/setup.ts`. Existing
  `test/runControl.test.ts` and `test/toolControl.test.ts` show the mocking style.

### Integration Points
- `RunsComponent`: mount the control bar and `ToolPausedModal`, both fed by the single hook.
- `QueueStatuscomponent`: the Stop interception (D-16) and the relabel (D-05).
- `pages/tools/[id].tsx`: the Run recovery section (D-21).
- `server/routers/tool.ts`: `recoveryControl` (D-22).
- `components/tools/constants.ts`: remove the fast `abort`/`resume` entries (D-20).

</code_context>

<specifics>
## Specific Ideas

- The live-acceptance scenario the UI must support (design §9): deck 3 is empty, the prompt reads
  "Deck 3: expected plate 1, found none", the operator fixes the deck, chooses Resume (tip intact),
  and the same step ends `SUCCESS`.
- The confirmation copy names the instrument and the physical decision, e.g. "Resume the F.A.S.T.
  run with tip intact?".

</specifics>

<deferred>
## Deferred Ideas

- **A combined atomic run-page query** that merges `runState` into the queue's state read was
  considered and not chosen (D-01 uses a single client hook). Revisit if manual testing shows
  flicker between the bar and the queue lists.
- **UI component tests (jsdom/RTL):** only with human approval (D-24).
- **Hard pause:** a future requirement (D5).
- **Simulated pause driven end to end in the UI:** a future requirement (galago-tools ADP-10 hook).
- **F3/F5 debt:** out by user decision.

</deferred>

---

*Phase: 02-run-page-live-controls*
*Context gathered: 2026-10-13*
