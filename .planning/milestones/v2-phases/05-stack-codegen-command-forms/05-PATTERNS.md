# Phase 5: STACK Codegen & Command Forms - Pattern Map

**Mapped:** 2026-11-02
**Files analyzed:** 15 (11 modified, 4 possibly-new; 3 "new" files are generated/optional)
**Analogs found:** 15 / 15 (10 exact, 5 role-match)

This phase is deliberately mechanical: research proves every STACK-specific need already has a
generic in-repo mechanism keyed on the generated module or the `ToolType` enum. The patterns below
are almost all **extend-an-existing-file** patterns, not write-a-new-file patterns.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `vendor/galago-tools` gitlink + `.gitmodules` | config (submodule pointer) | file-I/O | `.gitmodules:4` (`branch = feat/fast-tool`) + `128bbd7` commit-message template (RESEARCH.md Pattern 1) | role-match |
| `controller/gen-interfaces/tools/grpc_interfaces/stack.ts` (NEW, **generated — never hand-write**) | generated artifact | transform (codegen) | `gen-interfaces/tools/grpc_interfaces/fast.ts` (sibling output of the same command) | role-match |
| `controller/gen-interfaces/controller.ts` + `tools/grpc_interfaces/tool_base.ts` (regenerated churn) | generated artifact | transform (codegen) | same files' current content (new `stack = "stack"` enum member + oneof branches appear mechanically) | role-match |
| `controller/components/tools/constants.ts` (+ `commandFields.stack`) | config (UI constants) | transform (metadata map) | `commandFields.fast` in the same file, lines 314-343 | exact |
| `controller/test/staticScan.test.ts` (flip the OPR-05 scan) | test (static source scan) | transform | its own scan at lines 665-674 — edited in place, same commit as `commandFields.stack` | exact |
| `controller/server/recoveryActions.ts` (`LATCH_READ_COMMAND` value rename) | service (server constants/pure logic) | request-response | its own constant at lines 208-211 | exact |
| `controller/pages/tools/[id].tsx` (capture reply `data`, render `meta_data`) | component (page) | request-response | its own mutation block lines 99-131 (currently discards `data`) + `LatchRawJson` display pattern | exact |
| `controller/components/tools/<Shared>BoundedRawJson.tsx` (NEW, optional — planner extracts or duplicates per D-06) | component | presentational | `formatLatchRaw` + `LatchRawJson` in `controller/components/tools/RunRecoverySection.tsx:50-60, 62-101` | exact |
| `controller/test/wire.test.ts` (+ STACK encode/decode + blank-optional case) | test (real-encoder wire) | transform (encode/decode) | its own fast case at lines 16-47 | exact |
| `controller/test/commandFields.test.ts` (+ stack coverage / ack-exclusion) | test (runtime metadata) | transform | its own select-invariants pattern, lines 4-25 | exact |
| `controller/test/tools.test.ts` (+ `getToolConfigDefinition("stack")` case) | test (server unit) | request-response | `Tool.getToolConfigDefinition` in `controller/server/tools.ts:678-698` (the code under test; zero changes) | role-match |
| `controller/test/stackActivation.test.ts` (NEW, optional — D-07 b/d/e may fold into wire/commandFields files instead) | test (contract/activation) | mixed | `wire.test.ts:16-47` (a), `routers/tool.ts:17` + a create-flow test (d), `operatorOnly.test.ts:124-149` (e) | role-match |
| `controller/test/operatorOnly.test.ts` (+ real-`ToolType.stack` case; retrofit casts) | test (request-response) | request-response | its own guard tests at lines 124-182 | exact |
| `controller/test/latchStatus.test.ts` (cast retrofit + renamed-command assertions) | test | request-response | one-token cast swap at line 145; D-08 forbids restructuring | exact |
| `controller/test/recoveryControl.test.ts` (cast retrofit) | test | request-response | one-token cast swaps at lines 61, 407 | exact |

**Auto-benefit integration points — verified to need ZERO code changes** (planner must not add
mechanism here): `controller/server/routers/tool.ts:17` (`zToolType = z.enum(Object.values(ToolType))`
auto-accepts `"stack"` after regen), `controller/server/tools.ts:678-698` (`getToolConfigDefinition`
dynamically imports `gen-interfaces/tools/grpc_interfaces/stack` and calls `Config.create({})`),
`controller/server/tools.ts:361-367` (`_payloadForCommand` already builds `{ stack: { <command>:
params } }` from the enum key).

---

## Pattern Assignments

### `controller/components/tools/constants.ts` (+ `commandFields.stack`) — config, transform

**Analog:** `commandFields.fast`, same file lines 314-343 (the `128bbd7` precedent). The D-03
anti-template is `scan_tips` at line 340 (`defaultValue: false`) — **do not copy any `defaultValue`
into the STACK entry**.

**Template — the fast entry (lines 314-343), showing the exact shape to clone:**
```ts
  fast: {
    transfer: [
      { name: "source_deck", type: "number" },
      ...
      // Values the F.A.S.T. adapter accepts (fast_mcp _TIP_REUSE_MODES)
      { name: "tip_reuse", type: "select", options: ["fresh", "reuse"] },
      // optional: overrides the tool Config expected_tray_id (D-14)
      { name: "expected_tray_id", type: "number" },
    ],
    run_protocol: [
      { name: "csv", type: "text" },
      // optional seconds; 0/blank uses the tool Config
      { name: "timeout_s", type: "number" },
    ],
    validate_protocol: [{ name: "csv", type: "text" }],
    get_status: [],
    get_tip_status: [],
    scan_tips: [{ name: "is_tip_broken", type: "boolean", defaultValue: false }], // ← ANTI-template: no defaultValue in STACK
    eject_tray: [],
  },
```

**The `Field` type already supports everything needed — no type changes** (`controller/components/tools/types.ts:1-7`):
```ts
type Field = {
  name: string;
  type: "text" | "number" | "text_array" | "boolean" | "select";
  defaultValue?: any;
  // Allowed values for a "select" field; ignored for every other type.
  options?: readonly string[];
};
```

**Placement + D-03 mapping rules for the new entry:** insert `stack: { ... }` after the `fast`
entry (before the closing `};` at line 343). Keys are the generated `stack.Command` oneof keys
verbatim (`snakeToCamel=false`): `transfer` (11 text + 1 number), `get_manager_state: []`,
`get_robot_states: []`, `list_devices`/`list_labware_profiles`/`list_transfer_profiles`
(1 boolean each), `get_labware_presence` (1 text), `get_transfer_estimate` (10 text),
`get_failure_latch: []`. Every field is `{ name, type }` with **no `defaultValue`**, no `select`
(the proto has no enums anyway). `acknowledge_failure` is **never listed** — the OPR-05 scan at
`staticScan.test.ts:667` (`expect(src).not.toContain("acknowledge_failure")`) depends on it.
RESEARCH.md § Code Examples has the full verbatim skeleton to copy.

---

### `controller/test/staticScan.test.ts` — flip the OPR-05 scan in the same commit

**Analog:** its own scan body, lines 665-674 (verbatim):

```ts
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

**Edit pattern:** keep line 667 (`acknowledge_failure` absence) byte-identical; replace the last
line with a positive pin (`expect(keys).toContain("stack")`) and update the test title. Sibling scan
to leave untouched: lines 648-663 ("the acknowledge_failure literal lives in exactly its four pinned
files" — closed list; adding the STACK entry to `constants.ts` must not introduce a 5th carrier).
Test conventions in this file (reuse): `stripComments(read(<rel path>))` source reading, regex
matchAll over 2-space-indented keys, never a runtime import of the scanned module.

---

### `controller/test/wire.test.ts` — real-encoder wire test (GEN-04a) + blank-optional case

**Analog:** the fast case in the same file, lines 16-47 (verbatim core):

```ts
import { ToolType } from "gen-interfaces/controller";
import * as tool_base from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { installFakeTool, removeFakeTool } from "./helpers/fakeTool";
...
  it("encodes the control payloads into the fast Command oneof", () => {
    const { tool } = installFakeTool("wire-fast", ToolType.fast);

    const pausePayload = tool._payloadForCommand({
      toolId: "wire-fast",
      toolType: ToolType.fast,
      command: "pause",
      params: {},
    });
    const pauseDecoded = tool_base.Command.decode(tool_base.Command.encode(pausePayload).finish());
    expect(pauseDecoded.fast?.pause).toBeDefined();
```

**Clone recipe for STACK:** same imports; `installFakeTool("wire-stack", ToolType.stack)`; payload
via `tool._payloadForCommand({ toolId, toolType: ToolType.stack, command: "acknowledge_failure",
params: { guid: "task-guid", arm_inspected: "yes" } })`; round-trip through
`tool_base.Command.decode(tool_base.Command.encode(payload).finish())`; assert
`decoded.stack?.acknowledge_failure?.guid === "task-guid"` and `arm_inspected === "yes"`. Add the
D-04 blank-optional case by building params exactly as the page would send them (untouched fields as
`""`/`0`/`false`) and pinning the chosen behaviour (research recommends omitting blanks) —
proto3 `optional` fields encode on `!== undefined`, so blank-≠-omitted on the wire (Pitfall 5).
`afterEach` cleanup mirrors line 12-14: `await removeFakeTool("wire-stack")`.

**Harness being reused** (`controller/test/helpers/fakeTool.ts:13-36`):
```ts
export function installFakeTool(
  toolId: string,
  toolType: ToolType,
): { tool: Tool; grpc: FakeGrpc } {
  const tool = Tool.forId(toolId, "127.0.0.1", 1, toolType);
  tool.stopHeartbeat();
  ...
  const fake: FakeGrpc = {
    executeCommand: vi.fn(),
    getStatus: vi.fn(),
    configure: vi.fn(),
    estimateDuration: vi.fn(),
    close: vi.fn(),
  };
  tool.grpc = fake as unknown as Tool["grpc"];
  return { tool, grpc: fake };
}
```
It already accepts any `ToolType` member — `ToolType.stack` works the moment the enum regenerates.

**Payload builder under test** (`controller/server/tools.ts:361-367`, zero changes):
```ts
  _payloadForCommand(command: ToolCommandInfo): tool_base.Command {
    return {
      [this.toolType]: {
        [command.command]: command.params,
      },
    };
  }
```

---

### `controller/test/commandFields.test.ts` — stack coverage / ack-exclusion assertions

**Analog:** its own patterns, lines 4-25: targeted field lookup
(`commandFields.fast.transfer.find((f) => f.name === "tip_reuse")` + `toStrictEqual`) and
whole-map iteration (`for (const [tool, commands] of Object.entries(commandFields))`) with a `where`
label on every expectation. New assertions follow the same style:
`expect(Object.keys(commandFields.stack ?? {})).toContain("get_failure_latch")`,
`expect(commandFields.stack?.acknowledge_failure).toBeUndefined()`, plus a no-defaults sweep
(`for` over `commandFields.stack`'s fields, `expect(field.defaultValue).toBeUndefined()`) and a
no-select sweep. This is also where D-07(c) lives.

---

### `controller/pages/tools/[id].tsx` — capture reply `data`, render `meta_data` (GEN-03)

**Analog 1 — the exact mutation block to extend (same file, lines 99-131):** today the resolved
`data` only flows into the toast promise and is then discarded:
```tsx
  const commandMutation = trpc.tool.runCommand.useMutation();

  const executeCommandWithToast = (commandName: string, toolCommand: ToolCommandInfo) => {
    setCommandExecutionStatus((prevStatus) => ({ ...prevStatus, [commandName]: "idle" }));

    // Create a promise from the mutation
    const commandPromise = new Promise((resolve, reject) => {
      commandMutation.mutate(toolCommand, {
        onSuccess: (data) => {
          setCommandExecutionStatus((prevStatus) => ({ ...prevStatus, [commandName]: "success" }));
          resolve(data);
        },
        ...
```
Change: add `const [lastReply, setLastReply] = useState<...>(null)` (or equivalent) and set it from
`onSuccess`'s `data`; render `lastReply?.meta_data` under the command form (inside the
`toolCommandsDefined` FormControl block, lines 324-345). `Tool.executeCommand` returns
`reply.return_reply ? reply : undefined` (`controller/server/tools.ts:627`) — the display MUST
tolerate `undefined` (Pitfall 6). No zod change: tRPC doesn't validate outputs, and
`_payloadForCommand` never sends `return_reply` on the request.

**Analog 2 — the bounded raw-JSON display to reuse/extract** (`controller/components/tools/RunRecoverySection.tsx:50-101`, verbatim):
```tsx
function formatLatchRaw(raw: Record<string, unknown>): string {
  try {
    return JSON.stringify(raw);
  } catch {
    try {
      return String(raw);
    } catch {
      return "{}";
    }
  }
}

interface LatchRawJsonProps {
  raw: Record<string, unknown>;
  isOpen: boolean;
  onToggle: () => void;
}

function LatchRawJson({ raw, isOpen, onToggle }: LatchRawJsonProps) {
  return (
    <>
      <Button variant="link" size="sm" onClick={onToggle} aria-expanded={isOpen}>
        Raw JSON
      </Button>
      <Collapse in={isOpen}>
        <Box
          w="0px"
          minW="100%"
          maxH="160px"
          overflowY="auto"
          mt={2}
          p={2}
          bg="surface.panel"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="md">
          <Text fontFamily="mono" fontSize="sm" wordBreak="break-all" whiteSpace="pre-wrap">
            {formatLatchRaw(raw)}
          </Text>
        </Box>
      </Collapse>
    </>
  );
}
```
D-06: extract into a shared component (rename raw/labels generically) or duplicate minimally —
either is allowed; do NOT style a second variant. Note the component is display-only (no hooks/no
send path), so extraction cannot trip the single-send-path scans. Copy/label constants pinned at
module top (lines 108-112) are the convention if labels are extracted too.

**Page render target — the command panel (same file, lines 324-345):** the form lives inside
`{toolCommandsDefined && (<FormControl>...)}`; the meta_data box goes under the Send button. Note
line 51: `toolCommandsDefined = Object.keys(commandFields).includes(String(config?.type))` — the
STACK entry in `commandFields` is what removes the "Invalid Tool Type" alert (lines 306-319) for
STACK pages. No other page logic changes.

---

### `controller/server/recoveryActions.ts` — `LATCH_READ_COMMAND` rename (Pitfall 2)

**Analog:** its own constant, lines 208-211 (verbatim):
```ts
// PLACEHOLDER name until galago-tools Phase 4 freezes the proto command name
// (D-13/A1). Exactly one constant owns the name; Phase 5's contract test
// (GEN-04) pins this constant against the generated stack.Command oneof.
export const LATCH_READ_COMMAND = "latch_status";
```
Change: value → `"get_failure_latch"` (the frozen oneof key) and refresh the stale comment. Nothing
else in the file changes (`RECOVERY_STRICT_SUCCESS` at lines 198-200 already keys `stack:
["acknowledge_failure"]`; `extractLatch` at lines 228+ is shape-tolerant and untouched per D-08).
The sole consumer is `controller/server/routers/tool.ts:550-577` (`latchStatus` builds
`{ ...command: LATCH_READ_COMMAND, params: {}, return_reply: true }` and passes
`reply.meta_data` to `extractLatch`) — unchanged; only its direct test assertions need the new
value. D-07(b) contract test pins the rename:
```ts
import { Command } from "gen-interfaces/tools/grpc_interfaces/stack";
import { LATCH_READ_COMMAND } from "@/server/recoveryActions";

const emptyCommand: Command = {}; // every oneof key is optional
expect(Object.keys(emptyCommand)).toContain(LATCH_READ_COMMAND); // "get_failure_latch"
```

---

### `controller/test/tools.test.ts` — `getToolConfigDefinition("stack")` case (Wave 0)

**Analog (code under test, zero changes):** `controller/server/tools.ts:678-698`:
```ts
  static async getToolConfigDefinition(toolType: ToolType) {
    if (toolType === ToolType.UNRECOGNIZED || toolType === ToolType.unknown) {
      console.warn(`Received unsupported or unknown ToolType: ${toolType}`);
      return {};
    }
    const toolTypeName = ToolType[toolType];
    if (!toolTypeName) {
      throw new Error(`Unsupported ToolType: ${toolType}`);
    }
    try {
      const toolModule = await import(
        /* webpackInclude: /\.ts$/ */ `gen-interfaces/tools/grpc_interfaces/${toolType}`
      );
      if (!toolModule || !toolModule.Config) {
        throw new Error(`Config type not found for: ${toolType}`);
      }
      return toolModule.Config.create({});
    } catch (error) {
      throw new Error(`Failed to load config for ToolType: ${toolTypeName}. Error: ${error}`);
    }
  }
```
New test: `await Tool.getToolConfigDefinition(ToolType.stack)` resolves to the 4-key default
`{ host: "", port: 0, transfer_timeout_s: 0, ledger_dir: "" }` (spike-verified `createBaseConfig()`).
This proves D-05's "no custom STACK config UI" path: `EditToolConfig.tsx:126-301` heuristics render
`host` as IP input, `port` as 0-65535 number, `transfer_timeout_s` as integer, `ledger_dir` as path —
all generic, all already shipped.

---

### D-08 retrofit files — one-token cast swaps only

Mechanical `"stack" as ToolType` → `ToolType.stack` (verified locations; tests must keep passing
otherwise, no restructuring):

- `controller/test/operatorOnly.test.ts:125, 152, 169, 207` — plus extend with a real-enum refusal
  case cloned from lines 124-149:
  ```ts
  const fake = installFakeTool("stack-1", "stack" as ToolType);  // → ToolType.stack
  await expect(
    fake.tool.executeCommand({
      toolId: "stack-1",
      toolType: "stack" as unknown as ToolType,  // → ToolType.stack
      command: "acknowledge_failure",
      params: {},
    }),
  ).rejects.toThrow(/is an operator action/);
  expect(grpc.executeCommand).toHaveBeenCalledTimes(0); // zero sends
  ```
  Guard semantics stay keyed on the instance (`controller/server/tools.ts:410-425`:
  `isOperatorOnlyCommand(String(this.toolType), command.command)` FIRST, before substitution/gRPC).
- `controller/test/latchStatus.test.ts:145`, `controller/test/recoveryControl.test.ts:61, 407`.

**Leave alone** (pre-existing unrelated casts per D-08): `server/tools.ts:717` (toolbox),
`components/tools/NewToolModal.tsx:72`, `components/tools/ToolConfigEditor.tsx:14`. The
`latchStatus` toolId-only type derivation (routers/tool.ts:550-552) stays exactly as shipped; only
its stale "zToolType rejects 'stack' until Phase 5" comment (lines 545-547) may be refreshed.

---

### `.gitmodules` + submodule gitlink — config, file-I/O

**Analog:** current `.gitmodules:4` (`branch = feat/fast-tool`) and the `128bbd7` commit-message
template (RESEARCH.md Pattern 1): repoint the gitlink to the frozen commit (`bcbbf8e` last-`interfaces/`
commit, or tip `9592509` — planner picks one and records it), update `branch =` to `feat/stack-tool`
in the same commit, regenerate via `bin/make proto`. D-01: the first task verifies the bump and
stops cleanly if the gate is not cleared; no local proto edits, ever. Expect churn only in
`controller.ts` (new `stack = "stack",` in `export enum ToolType`, currently ending at
`fast = "fast"` + `UNRECOGNIZED`), `tool_base.ts` (stack Command/Config oneof branches), and the new
`tools/grpc_interfaces/stack.ts`.

**Regen mechanics** (`bin/make:50-89`): always go through `bin/make proto` (`clean_proto` mkdir-p's
the out dir; `proto_ts` alone fails on a clean tree — Pitfall 4), and never let protoc resolve the
plugin from `controller/node_modules/.bin` (ts-proto 1.153.2 generates broken `tool_base.ts` —
Pitfall 3). Use the spike-proven explicit-`--plugin=` invocation in RESEARCH.md § Standard Stack.
Gates: `npx tsc --noEmit` + `npx vitest run` + `npx prettier . --check` directly (Pitfall 7:
`bin/make test` chains a production build).

---

## Shared Patterns

### Real-encoder round-trip (wire proof)
**Source:** `controller/test/wire.test.ts:25`, `controller/server/tools.ts:361-367`
**Apply to:** all GEN-04 payload assertions (ack, latch, blank-optional)
```ts
const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
expect(decoded.stack?.acknowledge_failure?.guid).toBe("task-guid");
```

### Fake-tool harness
**Source:** `controller/test/helpers/fakeTool.ts:13-40`
**Apply to:** every activation/router-level test — `installFakeTool(id, ToolType.stack)` accepts the
enum member the moment `controller.ts` regenerates; always `await removeFakeTool(id)` in `afterEach`.
Keep queue-driving expectations at 15-30 s timeouts (busy loop sleeps 1.5 s; Pitfall 8).

### Static source scans for UI invariants
**Source:** `controller/test/staticScan.test.ts:648-674` (`stripComments`/`read`/regex-keys helpers)
**Apply to:** the OPR-05 flip and any new source-level invariant. Never runtime-import the scanned
module; assert over parsed source keys.

### Operator-only invariants must not weaken
**Source:** `controller/server/tools.ts:410-425` (instance guard), `staticScan.test.ts:648-663`
(closed ack-carrier list)
**Apply to:** all files — the STACK entry never lists `acknowledge_failure`; the ack literal stays in
exactly its four pinned files (`components/runs/controlDecision.ts`,
`components/tools/RunRecoverySection.tsx`, `server/operatorOnlyCommands.ts`,
`server/recoveryActions.ts`); no `stack` in `runControl`/`controlCommand`.

### Born-empty form fields (no pre-fills)
**Source:** `constants.ts:340` (scan_tips — the ANTI-template), `[id].tsx:68-93` (form seeding:
`field.defaultValue !== undefined ? field.defaultValue : ""`)
**Apply to:** every STACK field — omit `defaultValue`, omit `select`; the D-07 blank-optional wire
case pins what an untouched field actually sends (recommend omitting blanks; Pitfall 5).

### TDD RED evidence convention
**Source:** Phase 4 learning (STATE.md; RESEARCH.md § Wave 0 Gaps)
**Apply to:** new/extended tests — use `vitest --reporter=junit` when capturing RED evidence
(default/tap reporters are unparseable by the vendor TAP adapter).

## No Analog Found

None — every file in this phase extends or clones an existing in-repo pattern. Two notes for the
planner:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `vendor/galago-tools` gitlink bump | config | file-I/O | Git operation, not code — pattern comes from the `128bbd7` commit message (RESEARCH.md Pattern 1), not from a source file |
| `controller/gen-interfaces/tools/grpc_interfaces/stack.ts` | generated | transform | Output of `bin/make proto_ts` with ts-proto 1.151.1 — never authored or hand-edited; sibling `fast.ts` shows the output shape |

## Metadata

**Analog search scope:** `controller/components/tools/`, `controller/server/`, `controller/test/`,
`controller/pages/tools/`, `bin/make`, repo root (.gitmodules)
**Files scanned:** 18 (all git-tracked via `git ls-files` — no gitignored mirrors named)
**Pattern extraction date:** 2026-11-02
