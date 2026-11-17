# Phase 6: STACK Dropdowns - Pattern Map

**Mapped:** 2026-11-05
**Files analyzed:** 14 (9 new, 5 modified, plus the submodule pin)
**Analogs found:** 13 / 14 (all analog paths are git-tracked; verified with `git ls-files`)

All paths are relative to `/home/formulatrix/data/nikko/galago-core/controller/` unless noted.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server/tools.ts` (+ `Tool.readOptions`) | service | request-response (gRPC, no queue) | `server/tools.ts` `controlCommand` (375-391) | exact |
| `server/toolOptions.ts` (NEW registry, parsers, cache, `fetchOptions`) | service | request-response + cache | `server/recoveryActions.ts` (closed spec table, import-free) | role-match |
| `server/routers/tool.ts` (+ `options` query, generation bumps) | route | request-response | `latchStatus` (550-583) in same file | role-match (deliberately NOT copying `getToolFromDB`/`Tool.forId`) |
| `utils/variableRef.ts` (NEW, optional) | utility | transform | `isVariableReference` in `components/protocols/AddToolCommandModal.tsx:278` | exact |
| `components/tools/fieldOptions.ts` (NEW, React-free) | utility | transform | `components/tools/commandParams.ts` | role-match |
| `components/tools/OptionsSelect.tsx` (NEW) | component | request-response (view model) | variable-picker + labware branch in `AddToolCommandModal.tsx` renderField | role-match |
| `hooks/useToolOptions.ts` (NEW) | hook | request-response | `hooks/useRunControl.ts` | role-match |
| `pages/tools/[id].tsx` (MODIFIED host) | component | CRUD (form state) | itself, `renderFields` text/select branches (296-330) | exact |
| `components/protocols/AddToolCommandModal.tsx` (MODIFIED host) | component | CRUD | itself, `renderField` default branch + variable picker | exact |
| `components/protocols/CommandDetailsDrawer.tsx` (MODIFIED host) | component | CRUD | itself, default branch (424-450) | exact |
| `test/toolOptions.parse.test.ts`, `toolOptions.read.test.ts`, `toolOptionsRouter.test.ts` (NEW) | test | request-response | `test/latchStatus.test.ts` + `test/helpers/fakeTool.ts` | exact |
| `test/fieldOptions.test.ts`, `test/fixtures/stackOptions.ts` (NEW) | test | transform | `test/commandParams.test.ts` | role-match |
| `test/staticScan.test.ts` (EXTENDED) | test | static scan | itself (251-269, 648-662) | exact |
| `vendor/galago-tools` pin to `4ccd3da` + regen gate | config | batch | Phase 5 D-02 (`.planning/milestones/v1.1-phases/05-stack-codegen-command-forms/05-CONTEXT.md`) | exact |
| Server TTL cache + in-flight dedupe + generation | utility | event-driven/cache | none | no analog |

## Pattern Assignments

### `server/tools.ts` + `Tool.readOptions` (service, request-response)

**Analog:** `Tool.controlCommand`, `server/tools.ts:375-391`. Add the new method directly beside it.

**Imports already present** (lines 1-10): `import * as grpc from "@grpc/grpc-js";`, `import * as tool_base from "gen-interfaces/tools/grpc_interfaces/tool_base";`. No new imports needed.

**Core pattern** (lines 378-391):
```typescript
async controlCommand(action: string, params: Record<string, string>): Promise<ToolControlResult> {
  const payload = this._payloadForCommand({
    toolId: this.toolId, toolType: this.toolType, command: action, params,
  });
  const reply = await this.grpc.executeCommand(payload);
  return {
    ok: reply.response === tool_base.ResponseCode.SUCCESS,
    response: reply.response,
    message: reply.error_message,
  };
}
```
**Delta for `readOptions`:** call `this.grpc.executeCommand(payload, new grpc.Metadata(), { deadline: Date.now() + READ_DEADLINE_MS })` with `READ_DEADLINE_MS = 5000`. grpc-js throws "Incorrect arguments passed" unless arg 2 is a `Metadata` instance (research spike). `promisifyGrpcCall` (`server/utils/promisifyGrpcCall.ts`) spreads `...args` before the callback and types `(request, metadata?, options?)`, so it already supports this. Do not catch inside; `toolOptions.ts` maps errors. Return `{ response, message, meta: reply.meta_data }`. No `logAction`, no `{{var}}` substitution. Name must not be `controlCommand`, and must not appear in `command_queue.ts`.

**Tool lookup:** use `Tool.lookup(toolId)` (`server/tools.ts:370`, never creates a Tool), not `Tool.forId`.

---

### `server/routers/tool.ts` (route, request-response)

**Analog:** `latchStatus`, `server/routers/tool.ts:550-583`, plus imports at lines 1-15.

**Imports** (lines 1-15): `z` from zod, `procedure, router` from `@/server/trpc`, `Tool` from `@/server/tools`. Add `import { fetchOptions, OPTION_SOURCE_IDS, bumpGeneration } from "@/server/toolOptions";`.

**Query shape to copy:**
```typescript
latchStatus: procedure.input(z.object({ toolId: z.string() })).query(async ({ input }) => { ... })
```
New:
```typescript
options: procedure
  .input(z.object({ toolId: z.string(), source: z.enum(OPTION_SOURCE_IDS), refresh: z.boolean().optional() }))
  .query(({ input }) => fetchOptions(input.toolId, input.source, input.refresh === true)),
```
**Critical placement:** declare `options` ABOVE `latchStatus` (line 550). `test/latchStatus.test.ts:243-251` slices the file from `latchStatus: procedure` to EOF and forbids `controlCommand` and `zToolType` there. The input schema must carry no `command`/`params` key (D-17).

**Generation bumps** (D-04): call `bumpGeneration(toolId)` inside `edit` (258), `delete` (313), `configure` (466-500, after `tool.configure(config)` resolves, and in the Tool Box branch if relevant), and `clearToolStore` (461-464, bump all). Do not copy `getToolFromDB` + `Tool.forId` into `options` (creates a Tool and heartbeat per client-supplied id).

---

### `server/toolOptions.ts` (service, request-response + cache)

**Analog:** `server/recoveryActions.ts` for the closed-table, import-free spec idiom (used with `LATCH_READ_COMMAND`, `getRecoverySpec`, `isRecoveryAction`; also imported by client code `components/runs/controlDecision.ts:11-20`). Reply interpretation style: `extractLatch(reply.meta_data as Record<string, unknown>)`, tolerant of unknown shapes.

**Core pattern:** use the `OPTION_SOURCES` const and `OptionsResult` union sketched in 06-RESEARCH.md Pattern 1 (lines 316-330). Source/command/kind table:
`stack.robots`/`get_robot_states`/`robotStates` (no refresh), `stack.devices`/`list_devices`/`deviceTree`, `stack.labwareProfiles`/`list_labware_profiles`/`labwareProfiles`, `stack.transferProfiles`/`list_transfer_profiles`/`transferProfiles`.

**Logging:** `sanitizeLogText` from `server/logger.ts:11` for any client-controlled `toolId` going into log details; `logAction` only for failures and explicit refreshes (throttled).

**Error handling:** the function never throws; wrap `readOptions` in try/catch and map to `{ status: "unavailable", reason }` using the failure matrix in 06-RESEARCH.md (grpc code 14 -> `transport`, 4 -> `timeout`, any non-SUCCESS -> `tool_refused`, `readFailed` -> `read_failed`, no `meta_data` -> `no_data`). Evict the cache entry on any failed read. Must import nothing from `command_queue`; must be the sole caller of `readOptions` (D-17 scan).

---

### `components/tools/fieldOptions.ts` (utility, transform, React-free)

**Analog:** `components/tools/commandParams.ts` (pure, non-mutating helpers, documented with decision IDs, structural field typing because `Field` is not exported).

**Pattern to copy** (lines 15-26 of `commandParams.ts`): small private predicates (`isBlank`, `isPlainRecord`), exported pure functions returning new objects, no React import. `react` is NOT importable under vitest (tsconfig maps it to `@types/react`); only `import type` is safe. The `isBlank` idiom (undefined/null/""/NaN) is the model for "blank = not chosen".

**Exports required:** `FIELD_BINDINGS` map `(toolType, command, fieldName) -> { source, role }`, `buildCascadeOptions`, `buildSelectView`, `applyChange` (the only patch producer; clears children to `""`), `firstFieldForSource`, and the ambiguity prefix rule from Pattern 3. Binding table is in 06-RESEARCH.md Pattern 3. `commandFields.stack` (`components/tools/constants.ts:344-378`) must stay byte-identical (`test/commandFields.test.ts:54,81` `toStrictEqual`).

---

### `components/tools/OptionsSelect.tsx` and `hooks/useToolOptions.ts`

**Analog for hook:** `hooks/useRunControl.ts:1-20`.
```typescript
import { trpc } from "@/utils/trpc";
export function useRunControlState() {
  return trpc.commandQueue.runState.useQuery(undefined, { refetchInterval: RUN_CONTROL_POLL_MS });
}
```
Copy the shape (thin hook, a single reader of one tRPC query), but options are `{ enabled: enabled && !!toolId, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 15_000 }` and no `refetchInterval`. Refresh uses `trpc.useContext()` then `utils.tool.options.fetch({..., refresh: true}, { staleTime: 0 })` and `setData`. Derive mode from `isError` first, and use `isInitialLoading`, not `isLoading`. No `useEffect`/`useLayoutEffect` in either file (static scan).

**Analog for control (UI):** the variable `Select` (value=`variableName`, "No Variable" option, `fetchedVariables.map`) in `AddToolCommandModal.tsx:466-478`/`:490-500`, and the native Chakra `Select` of `pages/tools/[id].tsx:297-312` (`placeholder`, `value={String(...)}`, `onChange`, `<option key value>`). Follow `06-UI-SPEC.md` for copy. Use native `Select` with `placeholder=""`; never set `selected`, `defaultValue` or `options[0]`.

---

### `pages/tools/[id].tsx` (host)

**Analog:** the existing `renderFields` branches, lines 296-330 (`select` branch and `text` branch). Route a bound `text` field to `OptionsSelect`; the value and change API is `formValues[field.name]` plus `handleInputChange` (207, functional `setFormValues(prev => ...)`). Cascade changes apply an `applyChange` patch in ONE `setFormValues` call. Do not copy the reset effect at 88-111 (keyed on `[selectedCommand]`). Do not add `?? ""`, `|| 0` or `|| "false"` to this file; `test/toolPageReply.test.ts` pins exactly two `?? ""`. Leave `handleSubmit` (161) untouched. `toolId` for the hook: `config.name`.

### `components/protocols/AddToolCommandModal.tsx` (host)

**Analog:** itself. `renderField` (289), variable detection (256-286):
```typescript
const isVariable = isVariableReference(currentValue);
const variableName = isVariable ? getVariableNameFromReference(currentValue) : "";
```
Default branch (the HStack with `Input flex={1}` and the 180 px variable `Select`): replace only the left `Input` with `OptionsSelect` when a binding exists; keep the variable `Select`. State is non-functional `setCommandParams({ ...commandParams, [name]: v })`; a cascade change must write all affected fields in one call (stale-closure risk). `handleSubmit` back-fills (209-229) stay untouched. `toolId`: `selectedToolData?.name`. When a cascade parent `isVariableReference`, children become typed inputs with the D-13 hint.

### `components/protocols/CommandDetailsDrawer.tsx` (host)

**Analog:** itself, default branch lines 424-450:
```typescript
<Input flex={1} value={isVariable ? "" : (currentValue as string) || ""}
  onChange={(e) => { if (!isVariable && isEditing) setEditedParams({ ...editedParams, [key]: e.target.value }); }}
  isDisabled={isVariable || !isEditing} />
```
Fields iterate saved param keys (`Object.entries(selectedCommand.commandInfo.params)`, ~484), not `commandFields`; look up the binding by `commandInfo.toolType`, `commandInfo.command` and `key`. `enabled: isEditing`. Clearing a child must write `""` (deleting the key from `editedParams` reverts to the saved value). `toolId`: `selectedCommand.commandInfo.toolId` (a tool name; `Tool.lookup` normalises it).

---

### Tests: `test/toolOptions.*.test.ts`, `test/toolOptionsRouter.test.ts`

**Analog:** `test/latchStatus.test.ts` (header 1-45) and `test/helpers/fakeTool.ts`.

**Imports/harness to copy:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/db/helpers", () => ({ findOne: vi.fn(), findOneOrFail: vi.fn(), findMany: vi.fn(),
  exists: vi.fn(), count: vi.fn(), getSelectedWorkcellId: vi.fn(), INVENTORY_TOOL_MAP: {} }));
import { toolRouter } from "@/server/routers/tool";
import { installFakeTool, removeFakeTool, FakeGrpc } from "./helpers/fakeTool";
```
`installFakeTool(toolId, ToolType.STACK)` returns `{ tool, grpc }` with `grpc.executeCommand` as a `vi.fn()`; for readOptions tests assert the 2nd and 3rd args (a `Metadata` and `{ deadline }`). Source-scan idiom: `read(rel)` using `fs.readFileSync(path.join(ROOT, rel))`. Unit tests of parsers/`fieldOptions` must not import `react`.

### `test/staticScan.test.ts` (extend)

**Analog:** the `controlCommand` caller pin at 251-269 and helpers `walk` (16), `read` (43), `rel` (48), `stripComments` (56), `extractBracedRegion` (118).
```typescript
const count = (stripComments(read(rel(file))).match(/\.controlCommand\(/g) ?? []).length;
```
Reuse for: `.readOptions(` has exactly one caller file (`server/toolOptions.ts`) and one definition (`server/tools.ts`); `toolOptions.ts` has no `command_queue` import; enum equals `Object.keys(OPTION_SOURCES)`; `tool.options` input has no `command`/`params`; `OptionsSelect.tsx` and `useToolOptions.ts` contain no `useEffect|useLayoutEffect` and no first-option selection. Also check: `acknowledge_failure` literal must be absent from new files (pin at 648-662).

---

### Re-pin and regen (config, batch)

**Analog:** Phase 5 D-02 mechanism: ts-proto 1.151.1 from `/tmp/opencode/tsproto-1511/node_modules/.bin/protoc-gen-ts_proto` with explicit `--plugin=`, `python -m grpc_tools.protoc` from `/tmp/opencode/proto-venv`, output to a scratch dir, then diff against `gen-interfaces`. Never use `controller/node_modules` ts-proto (1.153.2). Pin by SHA (`git -C vendor/galago-tools checkout 4ccd3da`), never `--remote`. Include a human-action checkpoint: `4ccd3da` is not on GitHub (`feat/stack-tool` there is `9592509`); the user must push, then `git ls-remote https://github.com/nikkopg/galago-tools.git feat/stack-tool` should print `4ccd3da656c0e981332018b3d33e16148a8bc513`.

## Shared Patterns

### No reads through the queue / no substitution
**Source:** `server/tools.ts:375-391` (`controlCommand` comment: "does NOT reuse executeCommand: no variable substitution, no step plumbing, not enqueued"). **Apply to:** `readOptions`, `toolOptions.ts`.

### Variable-reference predicate
**Source:** `components/protocols/AddToolCommandModal.tsx:278-280`
```typescript
const isVariableReference = (value: any): boolean =>
  typeof value === "string" && value.startsWith("{{") && value.endsWith("}}");
```
Identical in `server/tools.ts:433` and the drawer. **Apply to:** server parser (drop `{{x}}` names, mark degraded), `fieldOptions.ts` variable-bound mode; share via one import-free `utils/variableRef.ts` plus a test asserting equivalence.

### Never throw, map to `unavailable`
**Source:** `extractLatch` tolerance (`server/recoveryActions.ts`) and `latchStatus` reply handling (`routers/tool.ts:570-582`: missing reply or `meta_data` is "unknown", not a confident verdict). **Apply to:** all of `toolOptions.ts`.

### Born-empty and unchanged submit
**Source:** `components/tools/commandParams.ts` `isBlank`/`omitBlankParams`; `test/commandFields.test.ts`. **Apply to:** all host edits: dropdown writes a plain string or `""`; no submit path edited; no `defaultValue`/`select` in `commandFields.stack`.

### Source-text pins that new code must respect
`test/toolPageReply.test.ts` (page text), `test/latchStatus.test.ts:243-251` (router tail), `test/staticScan.test.ts:251-269` and `648-662`, `test/commandFields.test.ts`.

## No Analog Found

| File / concern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| TTL cache, in-flight dedupe, per-tool generation counter in `server/toolOptions.ts` | utility | cache | No existing server cache; build from RESEARCH.md Pattern 1 and D-04 |
| gRPC call options `{ deadline }` | service | request-response | No server code passes call options yet; use the spike-verified call form (Metadata then options) |
| Cascade option builder, ambiguity prefix flags | utility | transform | New logic; see RESEARCH.md Pattern 3 and Reply Shapes; fixtures from sibling `stack-automation-layer/tests/golden/` copied into `test/fixtures/stackOptions.ts` |

## Metadata

**Analog search scope:** `controller/server`, `controller/server/routers`, `controller/hooks`, `controller/components/tools`, `controller/components/protocols`, `controller/pages/tools`, `controller/test`
**Files scanned:** about 20 (targeted reads and greps)
**Pattern extraction date:** 2026-11-05
