# Phase 5: STACK Codegen & Command Forms - Research

**Researched:** 2026-11-02
**Domain:** protobuf→TypeScript codegen (ts-proto pinning), command-form metadata, tool-page reply display, activation tests on generated types
**Confidence:** HIGH (every claim below is first-party: read from the frozen proto on `origin/feat/stack-tool`, from this repo's source, or proven by a throwaway regeneration spike with ts-proto 1.151.1)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Copied verbatim from `05-CONTEXT.md` `<decisions>`:

- **D-01:** Planning proceeds now; execution waits for the gate. The first plan's first task verifies
  `vendor/galago-tools` sits at the frozen `stack.proto` commit on `feat/stack-tool` and **stops
  cleanly with a clear note for the user** if it is not. No local proto patching, no speculative local
  `stack.proto`, no faking the submodule bump. Roadmap stop conditions hold: if the frozen proto
  renames `guid`/`arm_inspected`, has no latch-read command, or breaks STK-07 (SUCCESS keeps an empty
  message), stop and note it — the fix is made in galago-tools, never here.
- **D-02:** Regenerate through the existing `bin/make proto_ts` (it already passes
  `snakeToCamel=false`, `stringEnums=true`, `outputServices=grpc-js`), with ts-proto pinned at
  **1.151.1** exactly as PROJECT.md documents — never the local `node_modules` 1.153.2 that generates
  a broken `tool_base.ts`. The pinning mechanism (pinned npx invocation vs controlled devDependency)
  is the planner's choice, but the generated output must compile and the gate (`tsc --noEmit`,
  `npm run test:unit`, prettier via `bin/make test`) must be green after regen. Expect the `128bbd7`
  shape of change: submodule bump + `tool_base.ts`/`controller.ts` churn + a new generated
  `grpc_interfaces/stack.ts`.
- **D-03:** `commandFields.stack` in `controller/components/tools/constants.ts` covers every command
  the generated `stack.Command` oneof declares **except `acknowledge_failure`**. Mapping rules:
  required strings are `{ name, type: "text" }` with **no `defaultValue`**; **no `select` anywhere in
  the STACK entry** (even where the proto has an enum — mirrors "no `select` pre-fills"); numbers and
  booleans likewise born empty, no defaults. The F.A.S.T. precedent `scan_tips`
  (`defaultValue: false`, constants.ts:340) is explicitly **not** copied for any STACK field
  (ROADMAP note). The OPR-05 static scan pinning `acknowledge_failure`'s absence from
  `commandFields` must stay green — the STACK entry never lists it.
- **D-04:** Nothing is pre-filled; the payload sends what the operator typed. Whether an unfilled
  optional field is omitted from the payload or sent as its zero value is the planner's call (they are
  wire-equivalent for proto3 scalars), and the wire test (D-07) includes an **optional-left-blank
  case** so the chosen behaviour is pinned against the real encoder rather than assumed.
- **D-05:** The STACK tool's Config (host/port) is edited through the existing tool-page config path
  (`ToolConfigEditor`/`EditToolConfig`) driven by `getToolConfigDefinition("stack")` reading the
  generated module — **no custom STACK config UI**. If the generated stack module carries no config
  definition, that is a galago-tools gap: stop and note it, do not hand-roll a definition here.
- **D-06:** The tool-page command panel shows a reply's `meta_data` read-only under the command form
  using the Phase 4 bounded-raw-JSON pattern (`LatchRawJson` style: bounded height, monospace,
  collapsible, tolerant of unknown shapes). No table formatting, no editing. Reuse or extract the
  existing bounded display rather than writing a second one. — **Reversibility:** reversible
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

### Deferred Ideas (OUT OF SCOPE)
- Persistent tool-page command error toast (guid loss after 10 s) — quick-task candidate.
- F.A.S.T. plate-list dropdowns for source/dest plates and the `expected_tray_id` decision.
- `commandQueue.runningStep` query to gray the recovery card while a STACK step runs.
- Banner link to `/tools/<toolId>` on a STACK failure.
- `protocol.preview` early operator-only-refusal feedback.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEN-01 | Submodule bumped to the frozen `stack.proto` commit; `gen-interfaces` regenerated with ts-proto 1.151.1 (`snakeToCamel=false`, never 1.153.2); tsc, unit suite, prettier green | Gate is CLEAR: frozen proto verified at `origin/feat/stack-tool` (§ Frozen Proto Survey). Pinning recipe **proven end-to-end by spike** (§ Environment Availability). Submodule bump mechanics from `128bbd7` precedent. |
| GEN-02 | `commandFields.stack` covers every command except `acknowledge_failure`; required strings born-empty `text`, no `select`; STACK Config (host/port) editable from the tool page | Full 9-command surface enumerated verbatim from the frozen proto (§ Command Surface). Config flows through the existing `getToolConfigDefinition` path with **zero UI code** — verified `Config.create` exists in spike output. **OPR-05 scan must be flipped deliberately** (§ Pitfall 1). |
| GEN-03 | Tool-page command panel shows a reply's `meta_data` read-only | The page discards the `runCommand` reply today; `Tool.executeCommand` returns the reply only when the tool server sets `return_reply`. Mechanics and the reuse path from `LatchRawJson` documented (§ Pattern 3). |
| GEN-04 | Activation tests on generated types: wire test of acknowledge payload, latch-read contract, operator-only refusal keyed on `ToolType.stack` | `wire.test.ts:16-47` is the clone template; `LATCH_READ_COMMAND` placeholder `"latch_status"` must become `"get_failure_latch"` (§ Pitfall 2); `installFakeTool` accepts the real `ToolType.stack` after regen. |
</phase_requirements>

## Summary

Phase 5 is the mechanical F.A.S.T.-registration port (`128bbd7`) with STACK: bump the `vendor/galago-tools`
gitlink to the frozen `stack.proto` commit on `feat/stack-tool`, regenerate `gen-interfaces` with
ts-proto **1.151.1**, add `commandFields.stack`, wire the reply `meta_data` display into the tool page,
and add the activation tests that prove Phase 4's string-based acknowledge/latch work on the real
encoder. **The hard gate is clear** (verified 2026-11-02): `origin/feat/stack-tool` tip `9592509` carries
`interfaces/tools/grpc_interfaces/stack.proto` (added at `bcbbf8e`, the last commit touching `interfaces/`),
`AcknowledgeFailure` still has `guid` + `arm_inspected`, and the latch read exists as
`get_failure_latch`. Both D-01 stop conditions checkable from the proto hold; no stop is warranted.

This research ran a **throwaway spike** (in `/tmp/opencode/stack-spike`, nothing written to the repo):
installed ts-proto@1.151.1 in a scratch dir + grpcio-tools 1.85.1 in a venv, and regenerated all protos
from the frozen branch with `bin/make proto_ts`'s exact options. The regen succeeds, and the generated
`stack.ts` confirms everything the plan needs: the 10-key `Command` oneof (snake_case keys preserved),
`Config` with `create()` defaults `{ host: "", port: 0, transfer_timeout_s: 0, ledger_dir: "" }`, and
per-field presence encodes (`if (message.field !== undefined)`).

Three findings materially change the plan vs. what CONTEXT.md assumed:

1. **The OPR-05 static scan currently FORBIDS a `stack` key in `commandFields`**
   (`staticScan.test.ts:665-674`, `expect(keys).not.toContain("stack")`). GEN-02 adds exactly that key,
   so Phase 5 must deliberately edit this scan (keep the `acknowledge_failure`-absence assertion, drop or
   invert the stack-key assertion). Adding the entry without touching the scan fails the suite.
2. **`LATCH_READ_COMMAND` is still the placeholder `"latch_status"`** (`recoveryActions.ts:211`, comment:
   "PLACEHOLDER name until galago-tools Phase 4 freezes the proto command name"). The frozen oneof key is
   `get_failure_latch`. Phase 5 updates the constant; the D-07(b) contract test then pins it.
3. **D-04's "wire-equivalent" parenthetical is wrong for this proto.** Every command field in the frozen
   proto is proto3 `optional`, and ts-proto encodes those on `!== undefined` — so a blank `""` sent from
   the form **is** encoded (empty string, with presence), while an omitted key is not sent at all. The
   two choices are distinguishable on the wire; the planner should pick one (recommend omitting blanks)
   and pin it with the D-07 blank-optional wire case.

**Primary recommendation:** Four-plan split following the CONTEXT suggestion — (1) tracer: gate
verification + submodule bump to `bcbbf8e` + pinned 1.151.1 regen + `commandFields` scan flip;
(2) `commandFields.stack` + zToolType/`ToolType.stack` retrofits; (3) meta_data display; (4) activation
tests. No new npm packages; no custom UI; no proto edits.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Proto→TS codegen (GEN-01) | Build pipeline (`bin/make` + protoc + ts-proto plugin) | `vendor/galago-tools` submodule | Generated artifacts are committed; the toolchain runs at build time, not app time |
| Command form metadata (GEN-02) | UI constants (`components/tools/constants.ts`) | Proto (frozen, read-only) | `commandFields` is the single source the tool page + protocol builder render from |
| Tool Config editing (GEN-02) | API/Backend (`getToolConfigDefinition` → gRPC `Configure`) | Existing UI (EditToolModal/ToolConfigEditor) | Config definition comes from the generated module; UI renders whatever the proto declares |
| Reply `meta_data` display (GEN-03) | Frontend (tool page) | tRPC `runCommand` passthrough | Reply object already returns; the page only needs to keep and render it |
| Wire/activation proofs (GEN-04) | Test tier (vitest + generated encoders) | Fake gRPC double (`installFakeTool`) | Real encoders prove payloads; fakes prove routing; no instrument (v2 hard constraint) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ts-proto | **1.151.1** (pinned; published 2023-07-05 `[VERIFIED: npm registry]`) | protoc → TypeScript codegen | PROJECT.md/D-02 mandate: local node_modules 1.153.2 generates a broken `tool_base.ts` `[VERIFIED: .planning/PROJECT.md:119-120]`. Latest is 2.18.3 — **never bump** |
| grpcio-tools (python) | 1.85.1 / libprotoc 35.1 (spike-proven) | runs protoc via `python -m grpc_tools.protoc` | What `bin/make proto_ts` invokes `[VERIFIED: bin/make:58-69]` |
| vitest | 2.1.9 (already installed) | unit test runner | Repo standard (D-24 human-approved set A); supports Docker node 22.11 `[VERIFIED: controller/package.json:76]` |
| typescript | ^5.5.3 (already installed) | `tsc --noEmit` gate | Repo gate `[VERIFIED: controller/package.json:11,74]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| grpc-tools | 1.12.4 | `bin/make deps` installs it globally alongside ts-proto | Only if following the `bin/make deps` route `[VERIFIED: bin/make:11]` |
| @grpc/grpc-js | (existing dep) | runtime gRPC client, `outputServices=grpc-js` | Already used; no change |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Scratch-dir pinned plugin + explicit `--plugin=` (recommended) | `bin/make deps` global install (`npm i -g ts-proto@1.151.1`) | Global install mutates the user's nvm prefix and can be shadowed by node_modules 1.153.2 if PATH order changes; the scratch-dir route is reproducible and side-effect-free. Both satisfy D-02 — planner's choice |
| Pin gitlink to `bcbbf8e` (last `interfaces/` commit — the `128bbd7` precedent) | Pin gitlink to branch tip `9592509` | Both contain the frozen proto; `bcbbf8e` matches the recorded precedent ("the last commit touching interfaces/"), the tip pulls 219 commits of adapter work galago-core never imports. Either satisfies D-01 if the hash is pinned and verified |

**Installation:** none — the phase installs **no new npm dependencies**. The only installs are
toolchain-scoped (venv pip package, scratch-dir npm package) per the recipe below.

```bash
# Spike-proven pinned regen recipe (run from repo root; NEVER let protoc find the 1.153.2 plugin)
python3 -m venv /tmp/opencode/proto-venv && /tmp/opencode/proto-venv/bin/pip install grpcio-tools
mkdir -p /tmp/opencode/tsproto-1511 && (cd /tmp/opencode/tsproto-1511 && npm install ts-proto@1.151.1)
git -C vendor/galago-tools fetch origin feat/stack-tool   # already done; submodule bump is phase work
mkdir -p controller/gen-interfaces                        # protoc does NOT create the out dir
PATH-save python: /tmp/opencode/proto-venv/bin/python -m grpc_tools.protoc \
  -I=interfaces/ \
  --plugin=protoc-gen-ts_proto=/tmp/opencode/tsproto-1511/node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=./controller/gen-interfaces/ \
  --ts_proto_opt=stringEnums=true --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=snakeToCamel=false --ts_proto_opt=outputServices=grpc-js \
  interfaces/*.proto interfaces/tools/grpc_interfaces/*.proto
```

**Version verification:** `npm view ts-proto@1.151.1 version` → `1.151.1` (publish date 2023-07-05)
`[VERIFIED: npm registry, this session]`. The repo's `controller/package.json` declares
`"ts-proto": "^1.138.0"` (resolves 1.153.2 in node_modules) — do not change this range as the pinning
mechanism; it feeds nothing at regen time (protoc uses the `--plugin` binary, not the npm package).

## Package Legitimacy Audit

> This phase installs no new runtime or dev dependencies. The only external package touched is the
> pinned codegen tool ts-proto (already a devDependency; regen-time use only).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| ts-proto | npm | 8 yrs (1.151.1: 2023-07-05; latest 2.18.3: 2026-10-23) | 2.6M/wk | github.com/stephenh/ts-proto | [SUS] | Flagged — **false positive**: the seam's "too-new" signal fires on the latest release (2.18.3, 2026-10-23), not the pinned 1.151.1. The pinned version is already the repo's documented toolchain (PROJECT.md, D-02), is a declared devDependency, and has no postinstall script (`postinstall: null` per the seam). Planner may add a `checkpoint:human-verify` if desired; the D-02 decision already covers it. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** ts-proto (see false-positive note above; pinned 1.151.1)

## Architecture Patterns

### System Architecture Diagram

```
galago-tools repo (feat/stack-tool, frozen interfaces/)          [external, read-only]
  interfaces/controller.proto   (ToolType enum: stack = 24)
  interfaces/tools/grpc_interfaces/stack.proto   (frozen v2 command surface)
  interfaces/tools/grpc_interfaces/tool_base.proto (Command oneof stack=24, Config oneof stack=43)
        │  git submodule gitlink bump (GEN-01)
        ▼
vendor/galago-tools  ──►  bin/make proto_ts  (protoc + protoc-gen-ts_proto 1.151.1 pinned)
        │
        ▼
controller/gen-interfaces/**
  ├── controller.ts          (ToolType gains stack = "stack")
  ├── tools/grpc_interfaces/stack.ts    (NEW: Command oneof ×10, Config + create())
  └── tools/grpc_interfaces/tool_base.ts (churn: stack Command/Config branches)
        │
        ├─► components/tools/constants.ts  commandFields.stack  (9 commands, no ack)
        │        │ rendered by
        │        ▼
        │   pages/tools/[id].tsx command panel ──► trpc.tool.runCommand
        │        │        (zToolType auto-accepts "stack" after regen)
        │        ▼
        │   Tool.executeCommand (operator-only guard keyed String(toolType))
        │        └► _payloadForCommand → { stack: { <command>: params } }
        │             └► grpc.executeCommand (tool_base.Command encode → wire)
        │                  └► ExecuteCommandReply { response, error_message, return_reply?, meta_data }
        │
        ├─► Tool.getToolConfigDefinition("stack") → stack.Config.create({})
        │        └► NewToolModal (add-tool defaults) / EditToolModal (edit host/port on tool page)
        │             └► trpc.tool.configure → grpc.configure(tool_base.Config{stack: {...}})
        │
        └─► server/recoveryActions.ts LATCH_READ_COMMAND ("get_failure_latch")
                 └► tool.latchStatus query (toolId-only, unchanged) — Phase 4 card
```

Trace of the primary use case (GEN-02→GEN-03): operator opens a STACK tool page → the page finds
`commandFields.stack` (no more "Invalid Tool Type" alert) → selects e.g. `get_manager_state` → empty
form → Send → `runCommand` → `Tool.executeCommand` guard passes → payload
`{ stack: { get_manager_state: {} } }` encodes through the generated `tool_base.Command` → reply comes
back with the tool server's `return_reply: true` + `meta_data` → page keeps `data` and renders
`meta_data` in the bounded JSON box under the form.

### Recommended Project Structure
```
controller/
├── gen-interfaces/                    # regenerated (committed) — DO NOT hand-edit
│   ├── controller.ts                  # ToolType enum gains stack
│   └── tools/grpc_interfaces/stack.ts # NEW generated module
├── components/tools/
│   ├── constants.ts                   # + commandFields.stack (after fast, before closing brace)
│   └── RunRecoverySection.tsx         # LatchRawJson/formatLatchRaw — extraction source (D-06)
├── server/
│   └── recoveryActions.ts             # LATCH_READ_COMMAND "latch_status" → "get_failure_latch"
├── pages/tools/[id].tsx               # + meta_data capture + bounded display (GEN-03)
├── test/
│   ├── wire.test.ts                   # + stack encode/decode cases (GEN-04a, blank-optional)
│   ├── commandFields.test.ts          # + stack coverage / ack-exclusion assertions
│   ├── staticScan.test.ts             # FLIP the :665 scan (Pitfall 1)
│   └── (optional stackActivation.test.ts for D-07 b/d/e)
└── vendor/galago-tools/               # gitlink → frozen commit
```

### Pattern 1: The `128bbd7` mechanical codegen port
**What:** submodule gitlink bump + pinned regen + `commandFields` entry, as one coherent change.
**When to use:** GEN-01/GEN-02 together as the tracer plan.
**Example (verbatim from the `128bbd7` commit message):**
```
- Repoint vendor/galago-tools submodule … (committed .gitmodules holds the fork URL only; the local
  dev path is a .git/config-only override, never committed)
- Pin the submodule gitlink to 3df5ed9 (galago-tools feat/fast-tool, the last commit touching
  interfaces/)
- Regenerate controller/gen-interfaces/** via bin/make proto_ts (no clean step): new ToolType.fast in
  controller.ts, new tools/grpc_interfaces/fast.ts, plus … previously unregistered … files
- Add commandFields.fast to constants.ts …
```
Phase 5 repeats this with `feat/stack-tool` / the frozen commit / `stack`. `.gitmodules` currently holds
`branch = feat/fast-tool` `[VERIFIED: .gitmodules]` — update it to `feat/stack-tool` in the same commit
(mirrors the precedent; only matters for `git submodule update --remote`).

### Pattern 2: Real-encoder wire test (GEN-04a) — clone of `wire.test.ts:16-47`
**What:** build the payload through `tool._payloadForCommand`, encode/decode with the REAL generated
`tool_base.Command`, assert the decoded oneof branch.
**When to use:** the acknowledge payload, the latch read, and the D-04 blank-optional case.
**Example:**
```ts
// Source: controller/test/wire.test.ts:16-47 (verified pattern)
import * as tool_base from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { installFakeTool } from "./helpers/fakeTool";

const { tool } = installFakeTool("wire-stack", ToolType.stack);
const payload = tool._payloadForCommand({
  toolId: "wire-stack", toolType: ToolType.stack, command: "acknowledge_failure",
  params: { guid: "task-guid", arm_inspected: "yes" },
});
const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
expect(decoded.stack?.acknowledge_failure?.guid).toBe("task-guid");
expect(decoded.stack?.acknowledge_failure?.arm_inspected).toBe("yes");
```

### Pattern 3: Bounded raw-JSON reply display (GEN-03) — reuse `LatchRawJson`
**What:** a collapsible, 160px-max-height, monospace box rendering `JSON.stringify(raw)` with
try/catch fallback (`formatLatchRaw`, RunRecoverySection.tsx:76-90, 97-117). D-06: extract to a shared
component or duplicate minimally — either is fine; it contains no send path so it cannot trip the
single-send-path scans.
**When to use:** rendering `data?.meta_data` under the tool-page command form.
**Wiring fact (verified):** `pages/tools/[id].tsx:98-131` currently resolves the mutation promise into a
toast and discards `data`. `Tool.executeCommand` returns `reply.return_reply ? reply : undefined`
(`tools.ts:627`) — the flag is set **by the tool server** on the `ExecuteCommandReply`
(`tool_base.proto:113-117`: `bool return_reply = 3; google.protobuf.Struct meta_data = 4;`), not by the
request. So the page change is: keep the resolved `data` in state and render `data?.meta_data`; tolerate
`undefined` (no reply data) gracefully. **No zod schema change is needed** — tRPC does not validate
outputs, and `runCommand`'s input stripping of an unknown `return_reply` key is irrelevant because the
request payload never carries it (`_payloadForCommand` builds only `[toolType]: {[command]: params}`).

### Pattern 4: Deliberate pin flip (OPR-05 scan)
**What:** Phase 4's scan `staticScan.test.ts:665-674` asserted the pre-codegen world. Phase 5 is the
world it was waiting for; the plan edits the scan in the same commit as `commandFields.stack`.
**Example (current body, verbatim):**
```ts
// Source: controller/test/staticScan.test.ts:665-674
it("commandFields never grows a stack tool or an acknowledge entry", () => {
  const src = stripComments(read("components/tools/constants.ts"));
  expect(src).not.toContain("acknowledge_failure");
  // Top-level tool keys are the 2-space-indented entries of the exported
  // map (nested param names like "stack_id" live deeper) — assert over the
  // parsed source keys, never a runtime import.
  const keys = [...src.matchAll(/^  ([A-Za-z0-9_]+): \{/gm)].map((match) => match[1]);
  expect(keys.length).toBeGreaterThan(0);
  expect(keys).not.toContain("stack");   // ← Phase 5 flips this line
});
```
Keep `expect(src).not.toContain("acknowledge_failure")` exactly as is (the STACK entry must never list
the ack). Replace the last line with a positive pin, e.g. `expect(keys).toContain("stack")`, and add a
runtime assertion `expect(commandFields.stack?.acknowledge_failure).toBeUndefined()` +
`expect(Object.keys(commandFields.stack ?? {})).toContain("get_failure_latch")` (D-07c) in
`commandFields.test.ts`. Also confirm the closed-file-list scan (`:648-663`) stays green — the ack
literal must NOT appear in `constants.ts`; the other four pinned carriers are unchanged.

### Anti-Patterns to Avoid
- **Letting protoc resolve the plugin from `controller/node_modules/.bin`** — that is ts-proto 1.153.2,
  which generates a broken `tool_base.ts` (PROJECT.md). Always pass an explicit `--plugin=` pointing at
  a 1.151.1 binary (or run `bin/make deps` first so the global 1.151.1 wins PATH).
- **Copying `scan_tips`'s `defaultValue: false`** for any STACK field (D-03; ROADMAP note). Every STACK
  field is born empty.
- **Hand-writing `gen-interfaces/tools/grpc_interfaces/stack.ts`** or patching the proto locally —
  D-01 forbids it; generated files are never hand-edited.
- **Adding `stack` to `runControl`** or touching `Tool.controlCommand` / `commandQueue.toolControl` —
  out of scope (REQUIREMENTS Out of Scope; OPR-05 scans pin it).
- **A second raw-JSON display** with different styling — D-06 says reuse or extract the one
  `LatchRawJson`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| STACK Config fields UI | A custom host/port form | `EditToolModal` + `getProtoConfigDefinitions`/`getToolConfigDefinition` (existing, generic) | Renders per-key inputs from the generated `Config.create({})` with correct heuristics: `host` → IP-validated input, `port` → 0-65535 number input, `*timeout*` → integer input, `*dir` → path input `[VERIFIED: controller/components/tools/EditToolConfig.tsx:126-301]` |
| Payload → wire proof | Hand-rolled byte assertions | `tool_base.Command.encode/decode` round-trip in vitest (wire.test.ts pattern) | Tests the actual encoder the adapter will receive bytes from |
| Bounded JSON display | A new collapsible component | Extract `LatchRawJson`/`formatLatchRaw` from RunRecoverySection.tsx | D-06; unknown-shape tolerant, height-bounded, already UAT-proven |
| Latch command name | A second constant or a literal | `LATCH_READ_COMMAND` in `server/recoveryActions.ts` (rename value to `"get_failure_latch"`) | "Exactly one constant owns the name" (recoveryActions.ts:209-210); D-07b contract test pins it |
| Tool-type validation | A stack-specific zod schema | `zToolType` (derives from generated enum) | Auto-accepts `"stack"` after regen — zero code `[VERIFIED: controller/server/routers/tool.ts:15]` |

**Key insight:** every STACK-specific need in this phase already has a generic mechanism that keys on
the generated module or the `ToolType` enum. The work is data (`commandFields` entry) + one constant
rename + one page state, not new machinery.

## Frozen Proto Survey (all verified 2026-11-02)

Source: `git -C vendor/galago-tools show origin/feat/stack-tool:interfaces/tools/grpc_interfaces/stack.proto`
(branch tip `9592509`; proto added at `bcbbf8e`, the last commit touching `interfaces/`; unchanged since).

**D-01 stop-condition check (proto-checkable ones): PASS**
- `AcknowledgeFailure` still declares `optional string guid = 1; optional string arm_inspected = 2;` — verbatim comment in the proto: "arm_inspected is \"yes\" only after the arm was inspected and STACK recovered in the STACK Manager; only the exact strings \"yes\" and \"no\" are accepted." `[VERIFIED: git show origin/feat/stack-tool:…/stack.proto]`
- Latch read exists: oneof key `get_failure_latch = 10` with empty message `GetFailureLatch` `[VERIFIED: same]`
- STK-07 (SUCCESS carries an empty `error_message`) is adapter behavior, not proto — nothing in the proto contradicts it; the adapter-side check is galago-tools' concern.

**Full command surface — verbatim oneof keys and message fields** (field names pass through ts-proto
`snakeToCamel=false` unchanged; spike-verified generated `Command` interface):

| Oneof key | Message | Fields (all proto3 `optional`) | commandFields.stack entry |
|-----------|---------|-------------------------------|---------------------------|
| `transfer` | Transfer | `step_key`, `robot`, `labware_profile`, `source_device`, `source_deck`, `source_nest`, `source_transfer_profile`, `destination_device`, `destination_deck`, `destination_nest`, `destination_transfer_profile` (strings); `timeout_s` (double) | 11 × `{ name, type: "text" }`, 1 × `{ name: "timeout_s", type: "number" }` — all no `defaultValue` |
| `get_manager_state` | GetManagerState | (empty) | `get_manager_state: []` |
| `get_robot_states` | GetRobotStates | (empty) | `get_robot_states: []` |
| `list_devices` | ListDevices | `refresh` (bool) | `{ name: "refresh", type: "boolean" }` |
| `list_labware_profiles` | ListLabwareProfiles | `refresh` (bool) | `{ name: "refresh", type: "boolean" }` |
| `list_transfer_profiles` | ListTransferProfiles | `refresh` (bool) | `{ name: "refresh", type: "boolean" }` |
| `get_labware_presence` | GetLabwarePresence | `robot` (string) | `{ name: "robot", type: "text" }` |
| `get_transfer_estimate` | GetTransferEstimate | `robot`, `labware_profile`, `source_device`, `source_deck`, `source_nest`, `source_transfer_profile`, `destination_device`, `destination_deck`, `destination_nest`, `destination_transfer_profile` (strings) | 10 × `{ name, type: "text" }` |
| `acknowledge_failure` | AcknowledgeFailure | `guid`, `arm_inspected` | **EXCLUDED (D-03/OPR-05)** |
| `get_failure_latch` | GetFailureLatch | (empty) | `get_failure_latch: []` |

Generated `Command` interface keys (spike, verbatim): `transfer`, `get_manager_state`, `get_robot_states`,
`list_devices`, `list_labware_profiles`, `list_transfer_profiles`, `get_labware_presence`,
`get_transfer_estimate`, `acknowledge_failure`, `get_failure_latch` — no enums anywhere in the proto, so
D-03's "no `select`" is satisfied by construction.

**Config message (D-05):** the proto declares `message Config { string host = 1; int32 port = 2; double
transfer_timeout_s = 3; string ledger_dir = 4; }` with the comments "0 means the default manager port
(5005)", "0 means the adapter default (used from Phase 5)", "Blank means the per-user state directory",
and "Credentials come only from STACK_USER and STACK_PASSWORD in the tool server's environment, never
from Config." Spike-verified generated code:
```ts
// Spike: out/tools/grpc_interfaces/stack.ts (ts-proto 1.151.1)
function createBaseConfig(): Config {
  return { host: "", port: 0, transfer_timeout_s: 0, ledger_dir: "" };
}
```
→ `getToolConfigDefinition("stack")` (`tools.ts:678-698`: dynamic import + `toolModule.Config.create({})`)
works with zero changes; D-05's stop condition does **not** trigger. `tool_base.proto` on the frozen
branch already has `tools.grpc_interfaces.stack.Config stack = 43;` in its `config` oneof and
`tools.grpc_interfaces.stack.Command stack = 24;` in its `tool_command` oneof `[VERIFIED: git show]` —
so `Tool.configure({toolId, simulated, stack: {...}})` and `executeCommand` encode.

**ToolType enum:** `controller.proto` on the frozen branch declares `stack = 24;`; spike-generated
`controller.ts` gains `stack = "stack",` in `export enum ToolType` (verbatim, between `fast = "fast"` and
`UNRECOGNIZED`). Consumers that auto-benefit: `zToolType` (routers/tool.ts:15), `getProtoConfigDefinitions`
input, NewToolModal's type list (filters only UNRECOGNIZED/unknown/toolbox), `String(this.toolType)` guard
comparisons.

**D-04 presence semantics (correction to the CONTEXT parenthetical):** spike-verified encode bodies:
```ts
// Spike: Command_Transfer.encode — every field:
if (message.step_key !== undefined) { writer.uint32(10).string(message.step_key); }
```
Proto3 `optional` scalars carry presence: sending `{ robot: "" }` encodes an empty string **with
presence**; omitting the key sends nothing. (CONTEXT D-04's "wire-equivalent for proto3 scalars" holds
only for scalars *without* `optional`; this proto marks every command field `optional`.) Note the page
seeds every untouched text field as `""` in `formValues` (`[id].tsx` useEffect: `field.defaultValue !==
undefined ? field.defaultValue : ""`) and untouched numbers/booleans similarly, so "send as typed"
currently means "send `""`/`0`-ish for untouched fields" unless the plan strips empties. **Recommendation:
omit blank values** (a small pure strip before `params` reaches the payload, or at the page) so the
adapter sees absent fields — but either choice is valid per D-04 provided the D-07 blank-optional wire
case pins it.

## Common Pitfalls

### Pitfall 1: The OPR-05 scan forbids the very entry GEN-02 adds
**What goes wrong:** `staticScan.test.ts:665-674` asserts `commandFields`'s top-level keys never contain
`"stack"`. Adding `stack: {...}` makes the suite fail.
**Why it happens:** the scan pinned the pre-codegen world (Phase 4 had no generated STACK types).
**How to avoid:** edit the scan in the same commit as the `commandFields.stack` entry (Pattern 4). Keep
the `acknowledge_failure`-absence assertions; make the stack-key assertion positive.
**Warning signs:** `staticScan` failure "commandFields never grows a stack tool" right after the
constants edit.

### Pitfall 2: `LATCH_READ_COMMAND` is still the placeholder `"latch_status"`
**What goes wrong:** the latch read sends a command the frozen adapter answers `UNRECOGNIZED_COMMAND`
(the real oneof key is `get_failure_latch`).
**Why it happens:** Phase 4 set the placeholder deliberately ("PLACEHOLDER name until galago-tools Phase
4 freezes the proto command name", recoveryActions.ts:208-211).
**How to avoid:** rename the constant's value to `"get_failure_latch"` in the regen plan; add the D-07(b)
contract test `expect(Object.keys(stack.Command.prototype))`-style oneof key check — concretely
`expect(Object.keys(<create an empty Command via createBase…> or a typed object)).toContain(LATCH_READ_COMMAND)`
or simply assert the generated `Command` interface has the key via an object literal typed as `Command`.
**Warning signs:** latchStatus test expecting `"latch_status"` fails after the rename — update it (the
D-08 posture allows touching that one constant + its direct assertions; do not restructure the query).

### Pitfall 3: protoc silently picking up the 1.153.2 plugin
**What goes wrong:** regen with the wrong plugin version produces a `tool_base.ts` that breaks
`tsc --noEmit` (the documented 1.153.2 breakage).
**Why it happens:** protoc resolves `protoc-gen-ts_proto` from PATH; `controller/node_modules/.bin`
contains 1.153.2's binary, and no global install exists on this machine (`npm ls -g` empty, no conda
`galago-core` env, base python lacks grpc_tools).
**How to avoid:** explicit `--plugin=protoc-gen-ts_proto=<abs path to 1.151.1 binary>` (spike recipe) or
run `bin/make deps` first (`npm install -g grpc-tools@1.12.4 ts-proto@1.151.1`).
**Warning signs:** `npx tsc --noEmit` errors inside `gen-interfaces/tools/grpc_interfaces/tool_base.ts`
immediately after regen.

### Pitfall 4: protoc does not create the output directory
**What goes wrong:** `--ts_proto_out=./controller/gen-interfaces/` fails with "No such file or
directory" (observed in the spike on the first attempt).
**Why it happens:** protoc does not mkdir. `bin/make proto` = `clean_proto` (which `mkdir -p`s) +
`proto_ts`; running `proto_ts` alone on a clean tree fails.
**How to avoid:** always go through `bin/make proto` (clean + regen), or `mkdir -p controller/gen-interfaces` first.
**Warning signs:** protoc exit 1 with `./out/`-style "No such file or directory" before any TS is written.

### Pitfall 5: assuming blank ≡ zero on the wire
**What goes wrong:** the plan treats "omitted" and "sent empty" as interchangeable (D-04's parenthetical),
but proto3 `optional` fields encode presence (`!== undefined` checks) — a blank `""` reaches the adapter
as a present-but-empty string; a blank boolean `""` coerces through protobufjs to `false`-with-presence.
**Why it happens:** the fast transfer fields are also `optional`, so the same subtlety exists there
today, untested.
**How to avoid:** make the D-07 blank-optional wire case explicit: build the payload exactly as the page
would send it (untouched fields included) and assert the decoded bytes/shape for the chosen behaviour.
**Warning signs:** adapter-side "missing/blank argument" `INVALID_ARGUMENTS` on a transfer whose field
looked optional in the UI.

### Pitfall 6: expecting `runCommand` to return the reply when the server never sets `return_reply`
**What goes wrong:** GEN-03 display shows nothing for STACK reads even though the code is "correct".
**Why it happens:** `Tool.executeCommand` returns `reply.return_reply ? reply : undefined`; the flag is
the tool server's choice on the reply (`tool_base.proto:116-117`), not something the controller can
request (`tool_driver.proto`: `rpc ExecuteCommand(Command) returns (ExecuteCommandReply)` — the request
carries no such flag).
**How to avoid:** the display must tolerate `undefined` (render nothing / "no reply data"). Whether the
real galago-tools adapter sets `return_reply` on reads is its Phase 5 behavior (`bcbbf8e` "read manager
state over gRPC") — tests use fakes that mock the reply, so this only matters at UAT.
**Warning signs:** `data` undefined in the mutation's `onSuccess` against the real tool server.

### Pitfall 7: `bin/make test` chains a production build
**What goes wrong:** using `bin/make test` as the phase gate triggers `build_prod` (`npm run build` —
minutes, needs Docker-free next build to pass lint).
**Why it happens:** `test_ts` ends with `&& build_prod` (bin/make:36-40).
**How to avoid:** D-02's named gates are `tsc --noEmit` + `npm run test:unit` + prettier — run those
directly for per-task verification; reserve `bin/make test` for the final phase gate if desired.
**Warning signs:** task verification times out on a Next.js production build.

### Pitfall 8: vitest timeouts vs the busy loop
**What goes wrong:** queue-driving activation tests (operator-only refusal through the queue) time out.
**Why it happens:** the busy loop sleeps 1.5 s per iteration; vitest `testTimeout` is 15 000 ms
(`vitest.config.mts`).
**How to avoid:** keep the 04-phase convention — 15-30 s expectations; prefer direct
`Tool.executeCommand`/`controlCommand`-level assertions over full queue runs where possible.
**Warning signs:** `test timed out → 15000ms` in a test that waits ≥ 10 queue ticks.

## Code Examples

### `commandFields.stack` skeleton (D-03 mapping; names verbatim from the frozen proto)
```ts
// controller/components/tools/constants.ts — after the fast entry
// Source: frozen stack.proto @ origin/feat/stack-tool (bcbbf8e); field names
// pass through snakeToCamel=false unchanged (spike-verified).
stack: {
  transfer: [
    { name: "step_key", type: "text" },
    { name: "robot", type: "text" },
    { name: "labware_profile", type: "text" },
    { name: "source_device", type: "text" },
    { name: "source_deck", type: "text" },
    { name: "source_nest", type: "text" },
    { name: "source_transfer_profile", type: "text" },
    { name: "destination_device", type: "text" },
    { name: "destination_deck", type: "text" },
    { name: "destination_nest", type: "text" },
    { name: "destination_transfer_profile", type: "text" },
    { name: "timeout_s", type: "number" }, // optional seconds; blank/0 = adapter default
  ],
  get_manager_state: [],
  get_robot_states: [],
  list_devices: [{ name: "refresh", type: "boolean" }],
  list_labware_profiles: [{ name: "refresh", type: "boolean" }],
  list_transfer_profiles: [{ name: "refresh", type: "boolean" }],
  get_labware_presence: [{ name: "robot", type: "text" }],
  get_transfer_estimate: [
    { name: "robot", type: "text" },
    { name: "labware_profile", type: "text" },
    { name: "source_device", type: "text" },
    { name: "source_deck", type: "text" },
    { name: "source_nest", type: "text" },
    { name: "source_transfer_profile", type: "text" },
    { name: "destination_device", type: "text" },
    { name: "destination_deck", type: "text" },
    { name: "destination_nest", type: "text" },
    { name: "destination_transfer_profile", type: "text" },
  ],
  get_failure_latch: [],
  // acknowledge_failure deliberately absent (D-03, OPR-05 scan)
},
```
The `Field` type already supports this (`components/tools/types.ts:1-7`: `type: "text" | "number" |
"text_array" | "boolean" | "select"`, `defaultValue?: any`) — no type changes needed.

### Latch contract test (D-07b) and retrofit surface (D-08)
```ts
// After regen: stack oneof key check against the renamed constant
import { Command } from "gen-interfaces/tools/grpc_interfaces/stack";
import { LATCH_READ_COMMAND } from "@/server/recoveryActions";

const emptyCommand: Command = {}; // every oneof key is optional
expect(Object.keys(emptyCommand)).toContain(LATCH_READ_COMMAND); // "get_failure_latch"
```
`"stack" as ToolType` casts to convert mechanically (3 test files, D-08):
`test/latchStatus.test.ts:145`, `test/operatorOnly.test.ts:125,131,152,169,207`,
`test/recoveryControl.test.ts:61,407`. Leave `tools.ts:717` (toolbox), `NewToolModal.tsx:72`,
`ToolConfigEditor.tsx:14` alone — pre-existing unrelated casts. `latchStatus`'s toolId-only derivation
and its comment ("zToolType rejects 'stack' until Phase 5") may have its stale comment refreshed but the
mechanism stays (D-08).

### Config definition flow (D-05 — no code to write, verified path)
```
NewToolModal ── trpc.tool.getProtoConfigDefinitions(selectedTool)     [routers/tool.ts:368-371]
             ── Tool.getToolConfigDefinition("stack")                 [tools.ts:678-698]
             ── import("gen-interfaces/tools/grpc_interfaces/stack")  [webpackInclude /\.ts$/]
             ── stack.Config.create({}) → { host: "", port: 0, transfer_timeout_s: 0, ledger_dir: "" }
ToolStatusCard (on the tool page) ── EditToolModal renders config.stack per-key
   (host → IP input; port → 0-65535 number; transfer_timeout_s → integer "timeout" input;
    ledger_dir → dir path input)  [EditToolConfig.tsx:126-301 key heuristics]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-proto 1.x (pinned 1.151.1 in this repo) | ts-proto 2.18.3 is latest | 2.x released after 2023 | **Do not upgrade** — D-02 pins 1.151.1; the 2.x line changes codegen output and is untested here |
| Phase 4 string-typed STACK (`"stack" as ToolType`, fake `{}` payloads) | Generated `ToolType.stack` + real encoders | This phase | The STATE.md blocker "STACK wire payloads never proven" is closed by GEN-04 |

**Deprecated/outdated:**
- `"stack" as ToolType` casts in tests — replaced by the real enum value where mechanical (D-08).
- The `staticScan.test.ts:665` "no stack tool" pin — superseded by this phase (flip, don't delete the ack half).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The real galago-tools STACK adapter sets `return_reply: true` + `meta_data` on read replies (so GEN-03 shows data at UAT) | Pattern 3 / Pitfall 6 | Display stays empty against the real server; would be a galago-tools concern (note for user), tests unaffected (fakes mock the reply) |
| A2 | Pinning the submodule gitlink to `bcbbf8e` (last `interfaces/` commit) satisfies D-01's "frozen stack.proto commit"; the branch tip `9592509` is the alternative | Frozen Proto Survey / Standard Stack | None for codegen (interfaces identical at both); planner picks one and pins the hash in the gate task |
| A3 | grpcio-tools version skew (spike used 1.85.1/libprotoc 35.1) does not change generated output vs whatever the executor installs | Environment Availability | Low: the in-repo regen runs the full `tsc`/suite gate, so any generated-code breakage is caught immediately; re-pin grpcio-tools if protoc features differ |
| A4 | protobufjs `Writer.bool("")` coerces a blank boolean string to `false`-with-presence | Pitfall 5 | Cosmetic: the D-07 blank-optional wire case pins the actual behavior; no assumption needs to survive the test |

## Open Questions (RESOLVED)

1. **D-04: omit blank optional fields vs send them as typed?**
   - What we know: proto3 `optional` makes the two choices wire-distinguishable (Pitfall 5); the page
     currently seeds `""` for untouched text fields, so "send as typed" = send empty strings with presence.
   - What's unclear: whether galago-tools' adapter treats present-but-empty strings as unset (its Config
     comment says empty-means-unset for Config; command fields are its Phase 5 domain).
   - Recommendation: omit blanks (pure strip at the payload boundary or before `mutate`), pin with the
     D-07 blank-optional wire case; note the choice in the plan.
   - **RESOLVED — omit blanks (planner decision per D-04's delegation):** implemented as the pure
     `omitBlankParams` strip applied at the payload boundary for STACK tool types only (05-02 Task 3),
     and pinned BOTH ways against the real encoder by the D-07 blank-optional wire case (05-03 Task 3:
     stripped → untouched fields decode absent; unstripped → empty string decodes present). The wire pin
     moots the adapter-treatment uncertainty above.
2. **Pin hash: `bcbbf8e` vs `9592509`** — planner's call (A2); the D-01 gate task must record whichever
   hash it pins and verify the two proto stop conditions against that exact hash.
   - **RESOLVED — `bcbbf8e` (planner decision):** recorded and verified at that exact hash by the D-01
     gate task (05-01 Task 1: last commit touching `interfaces/`, per A2; all stop-condition proto facts
     verified at that hash).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | codegen, tests, tsc | ✓ | v24.14.1 (nvm) | — |
| python3 | `python -m grpc_tools.protoc` | ✓ | 3.11.7 (miniconda base) | — |
| grpcio-tools (pip) | proto_ts regen | ✗ (not in base env; no `galago-core` conda env) | — | Spike-proven: venv + `pip install grpcio-tools` (1.85.1 works), or `bin/make deps` |
| ts-proto 1.151.1 plugin | proto_ts regen | ✗ globally (node_modules has 1.153.2 — the broken one) | — | Spike-proven: scratch-dir `npm i ts-proto@1.151.1` + explicit `--plugin=` |
| git access to vendor/galago-tools remote | submodule bump | ✓ (fetch of `feat/stack-tool` succeeded; local checkout detached at `cb7886d`) | tip 9592509 | — |
| vitest / tsc / prettier | phase gates | ✓ | 2.1.9 / 5.5.3 / (repo pin) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** grpcio-tools + the 1.151.1 plugin (both covered by the
spike-proven recipe above; both are regen-time only, nothing ships).

**Baseline (this session):** `npx tsc --noEmit` → 0 errors; `npx vitest run` → **570 tests / 24 files,
all green, ~53 s** `[VERIFIED: run this session]`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 (node env, no jsdom/RTL — pure logic + static scans) |
| Config file | `controller/vitest.config.mts` (include `test/**/*.test.ts`, testTimeout 15 000 ms) |
| Quick run command | `cd controller && npx vitest run test/commandFields.test.ts` |
| Full suite command | `cd controller && npx vitest run` (plus `npx tsc --noEmit` and `npx prettier . --check`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-01 | Regen output compiles; suite+prettier green | gate | `cd controller && npx tsc --noEmit && npx vitest run` | ✅ existing |
| GEN-02 | `commandFields.stack` covers the 9 commands, excludes `acknowledge_failure`, no `defaultValue`, no `select` | unit | `cd controller && npx vitest run test/commandFields.test.ts` | ✅ extend |
| GEN-02 | OPR-05 pins: ack absent from commandFields; stack key now present; ack literal still in exactly 4 files | static scan | `cd controller && npx vitest run test/staticScan.test.ts` | ✅ edit scan |
| GEN-02 | Config definition resolves for stack (`getToolConfigDefinition`) | unit | `cd controller && npx vitest run test/tools.test.ts` (or new case) | ❌ Wave 0 (add case) |
| GEN-03 | Reply meta_data captured from runCommand and rendered via bounded display (pure format fn + static scan) | unit | `cd controller && npx vitest run test/<metaData or toolPage>.test.ts` | ❌ Wave 0 |
| GEN-04a | Ack payload `{ stack: { acknowledge_failure: { guid, arm_inspected: "yes" } } }` survives real encode/decode; blank-optional case pinned | wire (real encoder) | `cd controller && npx vitest run test/wire.test.ts` | ✅ extend |
| GEN-04b | `LATCH_READ_COMMAND` ("get_failure_latch") is a key of the generated `stack.Command` | contract | `cd controller && npx vitest run test/<stackActivation>.test.ts` | ❌ Wave 0 |
| GEN-04c | `commandFields.stack` includes latch read, excludes ack | unit | (in commandFields.test.ts) | ✅ extend |
| GEN-04d | `zToolType` accepts `"stack"`; a STACK tool row can be created | unit | (in stackActivation or routers test) | ❌ Wave 0 |
| GEN-04e | Operator-only refusal keyed on real `ToolType.stack` (zero grpc calls, audited) | unit | `cd controller && npx vitest run test/operatorOnly.test.ts` | ✅ extend |

### Sampling Rate
- **Per task commit:** quick command for the touched test file + `npx tsc --noEmit`
- **Per wave merge:** full `npx vitest run` + `npx prettier . --check`
- **Phase gate:** full suite green (`tsc --noEmit`, `npm run test:unit`, prettier) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/` cases for GEN-02 Config definition (`getToolConfigDefinition("stack")` returns the 4-key default) — can live in `test/tools.test.ts`
- [ ] New `test/stackActivation.test.ts` (or fold into wire/commandFields files) for D-07 b/d/e
- [ ] `staticScan.test.ts` scan flip (Pattern 4) — must land in the same commit as `commandFields.stack`
- [ ] TDD RED evidence convention: use `vitest --reporter=junit` (Phase 4 learning, STATE.md) — default/tap reporters are unparseable by the vendor TAP adapter

*(No framework install gap: vitest/tsc/prettier all present.)*

## Security Domain

### Applicable ASVS Categories (level 1, per config `security_asvs_level: 1`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | galago-web has no auth (documented in ACK-AND-F3 §6.2); unchanged by this phase |
| V3 Session Management | no | no sessions |
| V4 Access Control | yes (operator-only invariants) | existing OPR-05 static scans + `executeCommand` guard; Phase 5 must not weaken them; the scan flip is assertion-positive, not a relaxation of the ack rules |
| V5 Input Validation | yes | command params typed by generated proto (ts-proto encode rejects/coerces); `zToolType` enum; form values flow through `z.record(z.any())` then proto encode — no new free-text sinks |
| V6 Cryptography | no | credentials are env-side (STACK_USER/STACK_PASSWORD) per proto comment; nothing here touches them |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Operator-only command smuggled via commandFields/protocol | Elevation of privilege | Keep `acknowledge_failure` out of `commandFields.stack`; OPR-05 closed-file-list scan stays green |
| Config JSON injection via EditToolModal `JSON.parse(configString)` | Tampering | Pre-existing generic path; proto typing bounds what `Configure` accepts; no change in this phase |
| Prototype-key confusion in command lookups | Tampering | Existing own-property-safe lookups (D-04/D-09 style) — do not introduce index-signature `in` checks on user input |

## Sources

### Primary (HIGH confidence)
- `git -C vendor/galago-tools show origin/feat/stack-tool:interfaces/tools/grpc_interfaces/stack.proto` (tip `9592509`, added `bcbbf8e`) — full command surface, Config, comments
- `git -C vendor/galago-tools show origin/feat/stack-tool:interfaces/tools/grpc_interfaces/tool_base.proto` — `stack = 24` / `stack.Config = 43` oneof fields; `ExecuteCommandReply.return_reply/meta_data`
- `git -C vendor/galago-tools show origin/feat/stack-tool:interfaces/controller.proto` — `ToolType.stack = 24`
- **Spike regen** `/tmp/opencode/stack-spike` (ts-proto 1.151.1 + grpcio-tools 1.85.1, exact `bin/make proto_ts` options) — generated `stack.ts`/`controller.ts` shapes, `Config.create()` defaults, `!== undefined` presence encodes
- Repo files read this session: `bin/make` (:32-47, :49-89), `controller/components/tools/constants.ts` (fast entry :314-343), `components/tools/types.ts:1-21`, `pages/tools/[id].tsx` (:22-45, :98-144, :316-338, renderFields :187-290), `server/tools.ts` (:355-365 configure, :393-425 _payloadForCommand, :431-463 executeCommand guard, :627 return_reply, :678-698 getToolConfigDefinition), `server/routers/tool.ts` (:15 zToolType, :204 add, :368-371, :495-577 runCommand/recoveryControl/latchStatus), `server/recoveryActions.ts` (:206-219 LATCH_READ_COMMAND placeholder), `test/wire.test.ts`, `test/staticScan.test.ts` (:648-674), `test/commandFields.test.ts`, `test/helpers/fakeTool.ts`, `components/tools/ToolConfigEditor.tsx`, `components/tools/EditToolConfig.tsx`, `components/tools/NewToolModal.tsx` (:55-113), `vitest.config.mts`, `package.json`, `.prettierignore`, `.gitmodules`
- Baseline run: `tsc --noEmit` 0 errors; `vitest run` 570/570 green (~53 s)

### Secondary (MEDIUM confidence)
- `npm view ts-proto` (registry metadata: 1.151.1 published 2023-07-05, latest 2.18.3, 2.6M weekly downloads, repo stephenh/ts-proto)
- `gsd-tools query package-legitimacy check` — ts-proto [SUS] "too-new" (false positive on latest-release recency; see audit table)

### Tertiary (LOW confidence)
- none — no web-only claims

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pinned versions verified on npm + spike-proven toolchain
- Architecture: HIGH — every integration point read at the cited line; zero speculative UI work
- Pitfalls: HIGH — Pitfalls 1/2/3/4 observed directly this session (scan body, placeholder constant, spike first-attempt failure)

**Research date:** 2026-11-02
**Valid until:** 2026-12-02 (stable: the frozen proto cannot change without a galago-tools sign-off, which would reopen the stop conditions)
