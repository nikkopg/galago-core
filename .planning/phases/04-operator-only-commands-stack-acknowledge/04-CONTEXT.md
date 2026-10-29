# Phase 4: Operator-only Commands & STACK Acknowledge - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning
**Mode:** `--auto` (every decision below is the recommended option, grounded in
`.planning/research/ACK-AND-F3.md` §1–§3 and the ROADMAP Phase 4 notes; review before planning if any
should change)

<domain>
## Phase Boundary

Only an operator, from the tool page's Run Recovery card, can acknowledge a STACK failure — through an
explicit, audited, never-defaulted confirmation — and no protocol, script, imported file, editor or
queued row can send an operator-only command (DEP-03a = OPR-01..OPR-05):

1. **Operator acknowledge (OPR-01..03):** guid entry on the card → shared confirmation modal restating
   the guid with ack-specific copy, explicit `"yes"` arm-inspected choose, no default/no timer/no
   Enter-bound default; sent once through `tool.recoveryControl`, never retried; latched guid visible on
   the failed step card (shipped in Phase 3) and via an explicit "Read latch" backed by a toolId-only
   `tool.latchStatus` query.
2. **Operator-only refusal (OPR-04):** one zero-import table (`server/operatorOnlyCommands.ts`) refuses
   `stack.acknowledge_failure` at run creation (enqueue) and again at `Tool.executeCommand`, audited;
   `Tool.controlCommand` (the operator path) is untouched.
3. **Static scans (OPR-05):** the suite fails if anything acknowledges on its own, if the
   `acknowledge_failure` literal escapes an exact file list, if it enters `commandFields`/`runControl`,
   if the guard leaves `executeCommand` or lands in `controlCommand`, or if the latch read feeds the send.

Not in this phase: `commandFields.stack` / codegen / wire proof (Phase 5, hard-gated on galago-tools
Phase 4), GAL-02 protocol authoring, `stack.proto` changes, stack-automation-layer fixes, `stack` in
`runControl`. Built on string tool types and `"stack" as ToolType` fakes — no dependency on
`stack.proto`.

</domain>

<decisions>
## Implementation Decisions

### Operator-only refuse table (OPR-04)
- **D-01:** The refuse table includes F.A.S.T. now: `operatorOnlyCommands = { stack:
  ["acknowledge_failure"], fast: ["pause", "resume", "abort"] }`. One line of data, the mechanism is
  generic, and it turns the known legacy limitation ("saved steps resolve, nothing migrated") into an
  explicit audited refusal. It aligns with Core Value (the web app never pauses/resumes/aborts an
  instrument on its own). Accepted behaviour change: a saved protocol containing such a step is refused
  at run creation instead of executed — none exist in this repo; if the live DB holds one, it is refused
  and the operator sees why. — **Reversibility:** reversible — removing the fast entries is deleting one
  line from the table.
- **D-02:** Two enforcement points from one table, per ACK-AND-F3.md §2.2: (a) execute time, top of the
  instance `Tool.executeCommand` (`controller/server/tools.ts:408`), before variable substitution,
  keyed on `String(this.toolType)` (not the stored JSON's `toolType`), logging
  "Operator-Only Command Refused" then throwing `OperatorOnlyCommandError` before any gRPC; (b) enqueue
  time, in `RunStore.createFromProtocol` right after `generateCommandsFromProtocol`
  (`controller/server/runs.ts:216`), rethrown (not wrapped in `ProtocolGenerationFailedError`) and
  mapped to a visible BAD_REQUEST (tRPC) / 400 (API). The guard never sits in `controlCommand` — that is
  the operator path.
- **D-03:** The thrown error is a plain `Error` subclass (`OperatorOnlyCommandError`), **not** coded
  `INVALID_ARGUMENTS`/`NOT_READY`/`WRONG_TOOL`/`UNRECOGNIZED_COMMAND` — `getError` replaces the message
  for those codes, which would hide the reason. A refused queued row FAILs, stays queued and reruns
  until Skipped; acceptable and normally prevented by the enqueue refusal.
- **D-04:** Case/whitespace-insensitive command matching (own-property lookups only — `toString`,
  `constructor`, `__proto__` never match), same discipline as `runControl.ts`.

### Recovery-only acknowledge path (OPR-01)
- **D-05:** New zero-import module `server/recoveryActions.ts` (runControl.ts style): param kinds
  `"yesno" | "confirmYes" | "guid"`; `recoveryActions.stack.acknowledge_failure = { guid: "guid",
  arm_inspected: "confirmYes" }`; `recoveryActions.fast` **derived from** `runControl.fast.resume/abort`
  (one source of truth, pinned by a strict-equal test). `runControl` stays `{ fast }` — never extended.
  `validateRecoveryRequest` keeps the same refusal order and codes as `validateControlRequest`.
- **D-06:** `recoveryControl.ts` swaps `RECOVERY_ACTIONS` for `isRecoveryAction` and
  `validateControlRequest` for `validateRecoveryRequest`, sends `verdict.params` via
  `tool.controlCommand(action, params)`, keeps every `logAction` outcome line, keeps the
  refuse-while-this-tool's-step-is-running rule (reads `runningStep` only — never instrument state,
  UI-08) with a STACK-specific message, and keeps the no-deadline one-attempt send (D-23 lineage). The
  tRPC input needs no schema change (`z.record(z.unknown())` already fits).
- **D-07:** The operator types the guid on the **card** (empty `""` state, no default, no
  `onKeyDown`/`onSubmit`/form/autoFocus — the scan forbids them), the card's "Acknowledge failure…"
  button is disabled until the same client check as the server passes, then opens the shared
  `RunControlConfirmModal` with `request.params = { guid }` for the explicit `arm_inspected: "yes"` /
  "no" radios (nothing preselected; "No" keeps Confirm disabled). The modal restates the typed guid with
  acknowledge-specific copy and never shows the "instrument head will move" note. An accepted send
  clears the guid and latch result via the existing `afterAccepted` prop. Static scans extended to the
  card file (no Enter-bound default) and `controlUiModules` (no timers).
- **D-08:** Never trimmed, never coerced — the guid check is permissive:
  `^[^\s\u0000-\u001f\u007f]{1,256}$` (a task guid or `submit-<hex>`; a stricter format risks blocking a
  legitimate ack). Blank refused, never trimmed on the card either. The tool core's exact-guid check is
  the real gate.

### Ack while a STACK step is running
- **D-09:** No greyed-out card during a running STACK step: the card's `tracked` flag stays false for
  `stack` (no `runState` reader without `runControl`), so the buttons simply stay enabled; the server
  refuses with "A run step is running on this tool; acknowledge after it ends." (STACK-specific text in
  `recoveryControl.ts`), audited as a refusal. A latch only exists after the step ends.
  `commandQueue.runningStep` as a card query is deferred (below).

### SUCCESS-with-message on the ack path
- **D-10:** For the acknowledge only, a SUCCESS reply with a non-empty `error_message` is a refusal
  (`ok:false`, logged warning) via a scoped flag (`RECOVERY_STRICT_SUCCESS = { stack:
  ["acknowledge_failure"] }`) in `recoveryActions.ts`; `Tool.controlCommand` itself is unchanged so its
  F.A.S.T. callers and tests stay green.

### Latched guid display (OPR-03)
- **D-11:** "Latched failure" block in the STACK Run Recovery card, above the guid input: an explicit
  "Read latch" button (no polling, no timer) → read-only result: guid (selectable), kind/explanation
  when present, raw JSON collapsible for unknown shapes, or "No failure latched". Backed by a dedicated
  toolId-only `tool.latchStatus` query (type derived from the DB row like `recoveryControl`, avoiding
  `zToolType` which rejects `"stack"` until Phase 5), calling the server-side `LATCH_READ_COMMAND`
  constant through `tool.executeCommand` so error/SUCCESS+message mapping behaves everywhere else.
- **D-12:** "Use this guid" fills the guid input only — it never sends and never auto-acknowledges; the
  operator still types nothing extra but must press "Acknowledge failure…" and confirm. The latch result
  **never** gates or enables the ack (avoiding a UI-08 instrument-state check) and never feeds the send
  path (parse the reply once, keep `controlDecision.ts` and the send hooks `/latch/i`-free).
- **D-13:** `LATCH_READ_COMMAND` is a single string constant in `recoveryActions.ts` (placeholder name,
  set when galago-tools Phase 4 names the command; Phase 5's contract test pins it against the
  generated oneof). A pure `extractLatch(meta)` tolerates unknown shapes (string `guid` at top level,
  under `latch`, or under `result`) and is unit-tested without proto.

### Testing posture (OPR-02, OPR-05)
- **D-14:** Same as the repo's established style (no jsdom, no new UI deps): unit tests for
  `validateRecoveryRequest` refusals (wrong-ish `arm_inspected` values `no/""/" yes"/"Yes"/true/missing`,
  blank/whitespace/oversize/non-string guid, undeclared params, fast pause, stack resume/abort), router
  tests with `installFakeTool("stack-1", "stack" as ToolType)` asserting exactly
  `{ stack: { acknowledge_failure: { guid, arm_inspected: "yes" } } }` once, never retried, refusal
  while a STACK step runs, SUCCESS-with-message refusal; guard tests from queued row / `runCommand` /
  `createFromProtocol` (visual + script) with zero `grpc.executeCommand` calls; mislabelled
  `toolType` still refused at execute; static scans per OPR-05 pinning the exact
  `acknowledge_failure` literal file list, absence from `commandFields`/`runControl`, guard in
  `executeCommand` not `controlCommand`, single `tool.latchStatus` reader, `/latch/i` absent off the
  send path.
- **D-15:** Not provable before codegen (Phase 5's GEN-04, not repeated here): real-encoder wire test of
  the acknowledge payload, latch-read oneof contract, `getToolConfigDefinition("stack")`, creating a
  STACK tool row through `zToolType`.

### the agent's Discretion
- Exact copy of the card, modal and toasts (figurative "Acknowledge STACK failure" header, success
  title "STACK failure acknowledged", decision label "Arm inspected?"), as long as the rules above hold
  (no default, no timer, no head-moves note, guid restated verbatim).
- File/module placement of the pure helpers (`extractLatch`, client guid check — same module or
  `recoveryActions.ts` to share the validator).
- Plan split across the three requirement groups (ack path / refuse table / latch + scans).
- Whether `protocol.preview` also surfaces the refusal early (authoring feedback) — research §2.2 calls
  it optional; the enqueue refusal already gives a visible message at run creation.

### Folded Todos
None. The two pending todos matched only on keywords — the same matches were reviewed and not folded in
Phase 3; both stay in Future Requirements (see Reviewed Todos).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research and root design
- `.planning/research/ACK-AND-F3.md` — **§1.2 must be read** so nobody "just adds `stack` to
  `runControl`"; §1.3 recovery-only spec design; §2.1–§2.3 refusal points and surfacing; §2.4 the fast
  inclusion decision; §3.3 latch read design. §1.4 not adding `stack`'s consequences.
- `.planning/research/SUMMARY.md` — milestone v2 research overview (cross-repo split).

### Scope and constraints
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria (1–5), Notes (recovery-only spec on the D-20
  pattern, `String(this.toolType)` guard, `"stack" as ToolType` fakes, no-auth meaning of "operator-only").
- `.planning/REQUIREMENTS.md` — OPR-01..OPR-05 (traceability: Phase 4); Out of Scope table (`stack` not
  in `runControl`, no auto-acknowledge anywhere, no proto changes).
- `.planning/PROJECT.md` — Core Value, Constraints (never reuse auto-confirming UI, choices
  non-defaulted, no state checks; no gRPC deadline note), Key Decisions (v2 build order).
- `galago-tools/.planning/research/SUMMARY.md` — proposed proto comment (guid = task guid or
  `submit-<hex>`), Pitfall 5 (exact-guid check is the real guard), STK-07 (SUCCESS keeps an empty
  message). Assumptions to honour are restated in ACK-AND-F3.md §6.3.

### Prior phase decisions that bind here
- `.planning/phases/03-queue-start-guard-tool-error-visibility/03-CONTEXT.md` — D-15 failure `seq` in
  `getError` (shipped, used by nothing here but confirms the F3 §6.4 decision 3 is closed); step-card
  stored error is the primary guid display surface.
- `.planning/milestones/v1-phases/02-run-page-live-controls/02-CONTEXT.md` — D-07/D-22/D-23 confirmation
  rules (no default, refuse-while-tracked, one attempt, no deadline).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `controller/server/runControl.ts` — the zero-import deep-frozen spec + `validateControlRequest`
  pattern to clone for `recoveryActions.ts` (do **not** extend it).
- `controller/server/recoveryControl.ts` — the audited no-deadline one-attempt recovery path; only its
  action-allowlist and validator lines change.
- `controller/components/runs/controlDecision.ts` — `createConfirmedSender` single send path;
  `shouldShowRecoverySection`, `isToolTrackedByRunningStep`, copy maps to extend
  (`TOOL_DISPLAY_NAMES.stack`, headers/titles/labels, `restateChoice`).
- `controller/components/runs/RunControlConfirmModal.tsx` — the shared confirmation (remounts per
  request so it is born empty); extend with per-kind rendering + optional `params`.
- `controller/components/tools/RunRecoverySection.tsx` — the card to extend with guid input + latch
  block (visibility by tool type alone).
- `controller/test/helpers/fakeTool.ts` (`installFakeTool`, `FakeGrpc`),
  `test/recoveryControl.test.ts`, `test/runControl.test.ts`, `test/staticScan.test.ts`, harness
  patterns from `test/toolControl.test.ts`; busy loop sleeps 1.5 s — use 15–30 s test timeouts.

### Established Patterns
- Zero-import string-enum-friendly modules compared with `String(...)` and string literals (compiles
  before `ToolType.stack` exists — comparing the enum to `"stack"` is a TS2367 error).
- `logAction({ level, action, details })` audit lines; plain `Error` subclasses pass through `getError`
  messages un-replaced.
- Pure-logic modules + static source scans for UI invariants (no jsdom/RTL) — PROJECT.md gate.
- Gate: `tsc --noEmit` + `npm run test:unit` (244 tests green at v2 Phase 3 close) + prettier via
  `bin/make test`.

### Integration Points
- `controller/server/tools.ts:359-408` (`_payloadForCommand`, `controlCommand`, instance
  `executeCommand` for the top-of-method guard), `:600-646` reply mapping (D-11 compose is where the
  refusal must not collide with F3 codes).
- `controller/server/runs.ts:216,239-252` (`RunStore.createFromProtocol` enqueue guard + rethrow list),
  `controller/server/routers/run.ts`, `controller/pages/api/runs/index.ts` (refusal mapping).
- `controller/server/routers/tool.ts:508-533` (recovery mutation comment + new `latchStatus` query),
  `controller/hooks/useRunControl.ts` (send types only — keep it the only client file referencing
  recovery).
- `controller/components/runs/controlDecision.ts:245,336,340-344,378-380` (recovery branch switches to
  recovery spec), `RunControlConfirmModal.tsx:55-59,162,233-250` (per-kind render),
  `RunRecoverySection.tsx` (card UI).

</code_context>

<specifics>
## Specific Ideas

- "Operator-only" in this codebase means: unreachable from any protocol, script, queue row, editor or
  direct `tool.runCommand` call — galago-web has no authentication (an HTTP caller could still hit
  `tool.recoveryControl` today, same exposure as `commandQueue.toolControl`); the core's exact-guid +
  arm-inspected check on the tool server is the real physical guard. Keep this framing in docs and
  scans.
- The refusal UX for a queued row is accepted as "FAILs and stays queued, reruns and fails again until
  the operator Skips it"; the enqueue guard should make that a never-case in practice.

</specifics>

<deferred>
## Deferred Ideas

- `commandQueue.runningStep` query to grey/disable the recovery card while a STACK step runs (§1.4.1
  optional later) — future polish.
- Banner link to `/tools/<toolId>` when the failing tool is a STACK (§3.3 item 6) — small UX nicety.
- `protocol.preview` early refusal feedback (§2.2 optional) — authoring convenience.
- Generic tool-page command-panel reply display — owned by Phase 5 (GEN-03).
- Persistent error toast for `tool.runCommand` errors on the tool page (guid loss after 10 s) — related
  but Phase-5-adjacent tool-page usability; flag for Phase 5 or a quick task.

### Reviewed Todos (not folded)
- "Evaluate whether expected_tray_id is still needed" — keyword match only (score 0.9, same as Phase 3's
  review); F.A.S.T. step parameters, unrelated to the acknowledge. Stays in Future Requirements.
- "Fetch F.A.S.T. plate list for source/dest plate dropdowns" — keyword match only; a form feature,
  unrelated. Stays in Future Requirements.

</deferred>

---

*Phase: 04-operator-only-commands-stack-acknowledge*
*Context gathered: 2026-10-29*
