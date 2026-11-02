# Phase 5: STACK Codegen & Command Forms - Context

**Gathered:** 2026-10-30
**Status:** Ready for planning
**Mode:** `--auto` (every decision below is the recommended option, grounded in
`.planning/research/ACK-AND-F3.md` §5–§6, the ROADMAP Phase 5 notes and the Phase 4 CONTEXT; review
before planning if any should change)

<domain>
## Phase Boundary

galago-core builds against the frozen `stack.proto` and makes STACK a first-class tool type in the UI
and on the wire (DEP-02 = GEN-01..GEN-04):

1. **Codegen (GEN-01):** `vendor/galago-tools` bumped to the frozen `stack.proto` commit;
   `gen-interfaces` regenerated with ts-proto 1.151.1 (`snakeToCamel=false`, never the local 1.153.2);
   `tsc`, unit suite and prettier green.
2. **Command forms + Config (GEN-02):** `commandFields.stack` covers every STACK command except
   `acknowledge_failure`; required strings are empty `text` fields with no `defaultValue`; no `select`
   pre-fills; the STACK tool's Config (host/port) is configurable from the tool page.
3. **Read replies (GEN-03):** the tool-page command panel shows a command's reply `meta_data`
   read-only, so STACK reads are usable.
4. **Activation tests (GEN-04):** real-encoder wire test of the acknowledge payload, the latch-read
   contract, and the operator-only refusal — all on the generated types (`ToolType.stack`).

**Hard gate:** galago-tools Phase 4 must push the frozen `stack.proto` to `feat/stack-tool`. It is not
there yet (verified 2026-10-30: no `stack.proto` under `vendor/galago-tools`). This phase cannot start
executing until it is.

Not in this phase: GAL-02 protocol authoring, `stack.proto` changes, stack-automation-layer fixes,
adding `stack` to `runControl`, live STACK motion from tests (fakes only), F.A.S.T. plate dropdowns.

</domain>

<decisions>
## Implementation Decisions

### Gated start (execution ordering)
- **D-01:** Planning proceeds now; execution waits for the gate. The first plan's first task verifies
  `vendor/galago-tools` sits at the frozen `stack.proto` commit on `feat/stack-tool` and **stops
  cleanly with a clear note for the user** if it is not. No local proto patching, no speculative local
  `stack.proto`, no faking the submodule bump. Roadmap stop conditions hold: if the frozen proto
  renames `guid`/`arm_inspected`, has no latch-read command, or breaks STK-07 (SUCCESS keeps an empty
  message), stop and note it — the fix is made in galago-tools, never here.

### Codegen mechanics (GEN-01)
- **D-02:** Regenerate through the existing `bin/make proto_ts` (it already passes
  `snakeToCamel=false`, `stringEnums=true`, `outputServices=grpc-js`), with ts-proto pinned at
  **1.151.1** exactly as PROJECT.md documents — never the local `node_modules` 1.153.2 that generates
  a broken `tool_base.ts`. The pinning mechanism (pinned npx invocation vs controlled devDependency)
  is the planner's choice, but the generated output must compile and the gate (`tsc --noEmit`,
  `npm run test:unit`, prettier via `bin/make test`) must be green after regen. Expect the `128bbd7`
  shape of change: submodule bump + `tool_base.ts`/`controller.ts` churn + a new generated
  `grpc_interfaces/stack.ts`.

### commandFields.stack (GEN-02)
- **D-03:** `commandFields.stack` in `controller/components/tools/constants.ts` covers every command
  the generated `stack.Command` oneof declares **except `acknowledge_failure`**. Mapping rules:
  required strings are `{ name, type: "text" }` with **no `defaultValue`**; **no `select` anywhere in
  the STACK entry** (even where the proto has an enum — mirrors "no `select` pre-fills"); numbers and
  booleans likewise born empty, no defaults. The F.A.S.T. precedent `scan_tips`
  (`defaultValue: false`, constants.ts:340) is explicitly **not** copied for any STACK field
  (ROADMAP note). The OPR-05 static scan pinning `acknowledge_failure`'s absence from
  `commandFields` must stay green — the STACK entry never lists it.

### Optional / unfilled fields (GEN-02)
- **D-04:** Nothing is pre-filled; the payload sends what the operator typed. Whether an unfilled
  optional field is omitted from the payload or sent as its zero value is the planner's call (they are
  wire-equivalent for proto3 scalars), and the wire test (D-07) includes an **optional-left-blank
  case** so the chosen behaviour is pinned against the real encoder rather than assumed.

### Tool Config host/port (GEN-02)
- **D-05:** The STACK tool's Config (host/port) is edited through the existing tool-page config path
  (`ToolConfigEditor`/`EditToolConfig`) driven by `getToolConfigDefinition("stack")` reading the
  generated module — **no custom STACK config UI**. If the generated stack module carries no config
  definition, that is a galago-tools gap: stop and note it, do not hand-roll a definition here.

### meta_data reply display (GEN-03)
- **D-06:** The tool-page command panel shows a reply's `meta_data` read-only under the command form
  using the Phase 4 bounded-raw-JSON pattern (`LatchRawJson` style: bounded height, monospace,
  collapsible, tolerant of unknown shapes). No table formatting, no editing. Reuse or extract the
  existing bounded display rather than writing a second one. — **Reversibility:** reversible

### Activation tests (GEN-04)
- **D-07:** Activation tests on the generated types, following research §5 item 3:
  (a) a `wire.test.ts`-style real-encoder test of the acknowledge payload
  `{ stack: { acknowledge_failure: { guid, arm_inspected: "yes" } } }`, decoded back through
  `tool_base.Command`; (b) a contract test that `LATCH_READ_COMMAND` is a key of the generated
  `stack.Command` oneof (pins the Phase 4 placeholder against the frozen proto); (c) `commandFields.stack`
  includes the latch read and excludes `acknowledge_failure`; (d) `zToolType` accepts `"stack"` and a
  STACK tool row can be created; (e) the operator-only refusal keyed on the real `ToolType.stack`.
  Fakes only — no STACK motion (v2 hard constraint).
- **D-08:** Retrofit posture for Phase 4's string-based scaffolding: convert `"stack" as ToolType`
  casts to the real `ToolType.stack` where it is a mechanical one-token change (tests keep passing
  otherwise); **do not restructure working Phase 4 code** — the `tool.latchStatus` toolId-only
  type-derivation stays exactly as shipped (its tests pin it); the activation test proves `zToolType`
  now accepts `"stack"` without rewiring the query.

### the agent's Discretion
- Whether the bounded-JSON display is extracted from `RunRecoverySection`/`LatchRawJson` into a shared
  component or duplicated minimally, and its exact copy/labels.
- The ts-proto 1.151.1 pinning mechanism.
- Plan split (suggested: submodule bump + regen first as the tracer; then `commandFields.stack` +
  Config; then meta_data display; then activation tests).
- Whether `wire.test.ts` gains the blank-optional case inline or as a table row.

### Reviewed Todos (not folded)
- "Evaluate whether expected_tray_id is still needed" (score 0.9) — keyword-only match; F.A.S.T. step
  parameters, unrelated to STACK codegen. Phases 3 and 4 both reviewed it and kept it in Future
  Requirements; that decision stands.
- "Fetch F.A.S.T. plate list for source/dest plate dropdowns" (score 0.9) — keyword-only match; a
  F.A.S.T. form feature, unrelated. Same standing decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research and design
- `.planning/research/ACK-AND-F3.md` — **§5 item 3 is the DEP-02 recipe** (bump, regen,
  commandFields.stack rules, activation test list); §6.1 new/modified files for DEP-02; §6.3
  assumptions galago-tools Phase 4 must honour (confirm each when the proto freezes); §6.4 decisions
  (all resolved — none block here).
- `.planning/research/SUMMARY.md` — milestone v2 research overview (cross-repo split).

### Scope and constraints
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria 1–5, Notes (mechanical `128bbd7` template,
  stop conditions, no `scan_tips`-style defaults, latch constant pinned here), External Gates table
  (galago-tools Phase 4 hard gate).
- `.planning/REQUIREMENTS.md` — GEN-01..GEN-04; Out of Scope table (`stack.proto` changes, `stack` not
  in `runControl`, no auto-recovery).
- `.planning/PROJECT.md` — Context (codegen: `bin/make proto_ts` with ts-proto **1.151.1**, the local
  1.153.2 breaks `tool_base.ts`; Node via nvm), Constraints (choices non-defaulted, no state checks,
  never reuse auto-confirming UI), Out of Scope.
- `.planning/STATE.md` — Blockers/Concerns: gate not cleared; STACK wire payloads never proven
  (Phase 4 fakes received empty `{}` commands) — proving the real wire is exactly GEN-04.

### Prior phase decisions that bind here
- `.planning/phases/04-operator-only-commands-stack-acknowledge/04-CONTEXT.md` — D-11/D-13
  (`LATCH_READ_COMMAND` placeholder set when galago-tools Phase 4 names the command; Phase 5's
  contract test pins it against the generated oneof; `extractLatch` tolerates unknown shapes), D-15
  (the informational list that becomes GEN-04), the OPR-05 static scans (closed `acknowledge_failure`
  file list, absence from `commandFields`), latchStatus toolId-only derivation.
- `.planning/phases/03-queue-start-guard-tool-error-visibility/03-CONTEXT.md` — D-11..D-14 (reply
  message composition; SUCCESS-with-message is an error — the STK-07 interplay).
- `galago-tools/.planning/research/SUMMARY.md` — STK-07 (SUCCESS keeps an empty message), STK-05
  (adapter `ExecuteCommand` override must not answer ack/latch with `NOT_READY`), Pitfall 5
  (exact-guid check is the real guard).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `controller/components/tools/constants.ts` — `commandFields` map; the `fast` entry (:314-343) is the
  template for the `stack` entry (and the `scan_tips` default is the anti-template).
- `bin/make` — `proto_ts` (:51-66) already sets `snakeToCamel=false`, `stringEnums=true`,
  `outputServices=grpc-js`; `bin/make test` is the phase gate.
- `controller/test/wire.test.ts` (:20-48) — the real-encoder encode/decode pattern GEN-04(a) clones.
- `controller/test/commandFields.test.ts`, `test/staticScan.test.ts`, `test/runControl.test.ts`,
  `test/recoveryControl.test.ts`, `test/helpers/fakeTool.ts` (`installFakeTool`, `FakeGrpc`) — test
  harness to extend; busy loop sleeps 1.5 s, use 15–30 s timeouts.
- `controller/components/tools/ToolConfigEditor.tsx` / `EditToolConfig.tsx` — the Config editing path
  D-05 reuses.

### Established Patterns
- Codegen via `bin/make proto_ts` into `controller/gen-interfaces/`; `ToolType` is a string enum from
  the generated `controller.ts`; zero-import modules compare with `String(...)`.
- Pure-logic modules + static source scans for UI invariants (no jsdom/RTL, no new UI deps) —
  PROJECT.md gate; OPR-05 scans already pin `acknowledge_failure`'s absence from `commandFields`.
- Bounded raw-JSON display (`LatchRawJson`, 04-06) — the pattern D-06 reuses.

### Integration Points
- `controller/server/tools.ts` — `getToolConfigDefinition` (:698-718, dynamic import of the generated
  module — where `stack` config lands), `_payloadForCommand`, reply mapping wrapping `meta_data`
  (:588, :607).
- `controller/server/routers/tool.ts` — `zToolType` (:15, must accept `"stack"` after regen),
  `latchStatus` (:555-577, stays toolId-only per D-08).
- `controller/pages/tools/[id].tsx` — the tool-page command panel (GEN-03 display point);
  `controller/components/tools/commandButton.tsx` and
  `controller/components/protocols/AddToolCommandModal.tsx` render forms from `commandFields`.
- `vendor/galago-tools` — the submodule at the frozen commit; today it has **no `stack.proto`** (gate
  open, D-01's verification task).

</code_context>

<specifics>
## Specific Ideas

- `128bbd7` is the mechanical template: bump `.gitmodules` submodule pointer, regenerate
  `gen-interfaces` (new `tools/grpc_interfaces/stack.ts`, churn in `tool_base.ts`/`controller.ts`),
  add the `commandFields` entry. Phase 5 is that commit's shape with STACK instead of F.A.S.T., plus
  the activation tests F.A.S.T. never needed.
- Prove the real wire: Phase 4's fakes could only assert the object handed to `grpc.executeCommand`
  (empty `{}` payloads in UAT); GEN-04's wire test is what finally proves the acknowledge and latch
  payloads survive the real ts-proto encoder.

</specifics>

<deferred>
## Deferred Ideas

- Persistent tool-page command error toast (guid loss after 10 s) — carried from 04-CONTEXT
  ("Phase-5-adjacent"); still not a GEN requirement — quick-task candidate.
- F.A.S.T. plate-list dropdowns for source/dest plates and the `expected_tray_id` decision — pending
  todos, Future Requirements.
- `commandQueue.runningStep` query to gray the recovery card while a STACK step runs — 04-CONTEXT
  deferred; future polish.
- Banner link to `/tools/<toolId>` on a STACK failure — small UX nicety.
- `protocol.preview` early operator-only-refusal feedback — authoring convenience.

</deferred>

---

*Phase: 05-stack-codegen-command-forms*
*Context gathered: 2026-10-30*
