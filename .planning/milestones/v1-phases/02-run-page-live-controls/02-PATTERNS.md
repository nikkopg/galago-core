# Phase 2: Run Page Live Controls - Pattern Map

**Mapped:** 2026-10-13
**Files analyzed:** 13 (new) + 5 (modified)
**Analogs found:** 18 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `hooks/useRunControlState.ts` (new) | hook | request-response (polling) | `controller/components/runs/status/QueueStatuscomponent.tsx` (`trpc.commandQueue.state.useQuery(..., { refetchInterval: 1000 })`) | role-match (query-wrapper pattern; no existing standalone hook file to copy structure from 1:1) |
| `components/runs/controlDecision.ts` (new) | utility (pure logic) | transform | `controller/server/runControl.ts` (`validateControlRequest`, own-property-safe lookups, frozen maps) | exact (same project, sibling pure-logic module; no imports constraint matches) |
| `components/runs/ControlBar.tsx` (new) | component | request-response + polling | `controller/components/runs/status/QueueStatuscomponent.tsx` | role-match (button group driven by queue/tool state, same button/ButtonGroup/Icon idiom) |
| `components/runs/RunControlConfirmModal.tsx` (new) | component | request-response (mutation) | `controller/components/runs/PauseModal.tsx` | exact (explicit design instruction: "modeled on PauseModal.tsx's structure, never StopRunModal.tsx's") |
| `components/runs/ToolPausedModal.tsx` (new) | component | event-driven (poll-derived) | `controller/components/runs/PauseModal.tsx` | role-match (same Modal/Icon/VStack skeleton; different trigger — poll-derived vs `isModalOpen`) |
| `components/runs/InstrumentStopModal.tsx` (new) | component | request-response (sequenced mutations) | `controller/components/runs/StopRunModal.tsx` (visual/icon reference ONLY — do not import or copy the countdown logic) | role-match (same icon/color language; countdown/`setInterval` logic is the one thing to NOT copy, D-17) |
| `components/tools/constants.ts` (modify: remove `fast.abort`/`fast.resume`) | config | CRUD (static data) | n/a — editing existing file in place | exact |
| `server/routers/tool.ts` (add `recoveryControl` mutation) | route/controller | request-response | `server/routers/tool.ts`'s own `status` procedure (tool resolution) + `server/routers/command_queue.ts`'s `toolControl` mutation (validate → controlCommand → logAction → return shape) | exact (both analogs live in-repo, one for tool resolution, one for the control-send shape) |
| `server/command_queue.ts` | — (unchanged, Phase 1) | — | n/a | n/a (reference only: `toolControl` is the shape `recoveryControl` must mirror) |
| `pages/tools/[id].tsx` (add "Run recovery" section) | component (page section) | request-response (mutation) | `controller/components/runs/status/QueueStatuscomponent.tsx` (button + mutation + disclosure pattern) and `RunControlConfirmModal.tsx` (new, shared) | role-match |
| `test/controlDecision.test.ts` (new) | test | transform (pure-logic) | `controller/test/runControl.test.ts` | exact (same `describe`/`it`/`expect`, no mocks, plain imports via `@/`) |
| `test/recoveryControl.test.ts` (new) | test | request-response (server) | `controller/test/toolControl.test.ts` + `controller/test/helpers/fakeTool.ts` | exact (identical `installFakeTool`/`createCaller` mocking shape) |
| `test/staticScan.test.ts` (new) | test | transform (source-scan) | `controller/test/runControl.test.ts` (style: plain `describe`/`it`/`expect`, no AST lib) | role-match (new technique — grep/regex over `fs.readFileSync` — but same test-style conventions) |
| `test/runControl.test.ts` (modify: flip D-10 assertion) | test | transform | n/a — editing existing file in place | exact |
| `components/ui/Toast.tsx` (add persistent-error helper) | utility | transform | existing `errorToast`/`loadingToast`/`progressToast` in the same file (`duration: null` pattern already used by `loadingToast`/`progressToast`) | exact |

## Pattern Assignments

### `hooks/useRunControlState.ts` (hook, polling)

**Analog:** `controller/components/runs/status/QueueStatuscomponent.tsx:30`

**Core polling pattern** (line 30):
```typescript
const stateQuery = trpc.commandQueue.state.useQuery(undefined, { refetchInterval: 1000 });
```

**What to copy:** the `trpc.<router>.<query>.useQuery(undefined, { refetchInterval: N })` idiom. For
this hook, wrap `trpc.commandQueue.runState.useQuery(undefined, { refetchInterval: 2000 })` exactly
as RESEARCH.md's Code Examples section specifies (D-01, `RUN_STATE_POLL_INTERVAL_MS = 2000` already
exported by `server/runState.ts`). React Query dedupes identical query keys, so every consumer
(`ControlBar`, `ToolPausedModal`, the Stop/ClearAll interception) calling this one hook shares a
single network poll — do not parameterize or vary the query key per consumer.

**Server-side query already shipped** (`controller/server/routers/command_queue.ts:141-145`):
```typescript
// Reports the running controllable step's live run_state (D-11, D-12).
// Reads the server-side poller's cache only; never triggers a tool call.
runState: procedure.query(() => {
  return CommandQueue.global.runState;
}),
```

**Types to import** (`controller/server/runState.ts:24-37`):
```typescript
export interface PauseState {
  name: string | null;
  code: number | null;
  detail: unknown;
  startedAt: string | null;
}
export interface RunState {
  state: string;
  percent: number | null;
  pause: PauseState | null;
}
export type RunStateEnvelope =
  | { running: false }
  | {
      running: true;
      queueId: number;
      runId: string;
      toolId: string;
      toolType: RunningStep["toolType"];
      status: "ok" | "unknown";
      runState: RunState | null;
      updatedAt: number | null;
      lastError?: string;
    };
```
Import these as type-only (`import type { RunStateEnvelope } from "@/server/runState"`) so
`controlDecision.ts` and its Vitest tests stay free of runtime server deps (D-24 requirement).

---

### `components/runs/controlDecision.ts` (pure-logic utility)

**Analog:** `controller/server/runControl.ts` (full file, 80+ lines read)

**No-imports / own-property-safe lookup pattern** (lines 1-4, 42-47):
```typescript
// No imports. This module has one job: declare, per tool type, which live
// control actions exist and which operator decisions each action requires.
...
// Own-property lookup only: inherited names such as "constructor", "toString"
// and "__proto__" must never resolve to a declared tool type (D-09/D-10).
export function getRunControl(toolType: string): RunControlToolSpec | undefined {
  if (!Object.prototype.hasOwnProperty.call(runControl, toolType)) {
    return undefined;
  }
  return runControl[toolType];
}
```

**What to copy for `controlDecision.ts`:** the same "pure function, no React/JSX import, exported
named functions with a one-line doc comment explaining the invariant" style. This file must contain:
`allDecisionsChosen(spec, values)`, `pauseEpisodeKey(envelope)` (exact logic given verbatim in
RESEARCH.md's Code Examples — `queueId:startedAt` else `name:code`), and `controlButtonHints(state)`
(also given verbatim in RESEARCH.md). Keep it free of any `.tsx` import so it can be imported by a
Vitest node-env test (`test/controlDecision.test.ts`) the same way `test/runControl.test.ts` already
imports `@/server/runControl` and `@/components/tools/constants`.

**`ControlRequestVerdict` shape to reuse/import from `server/runControl.ts`:**
```typescript
export type ControlDecisionValue = "yes" | "no";
export type ControlRequestVerdict =
  | { ok: true; decisions: Record<string, ControlDecisionValue> }
  | { ok: false; code: "PRECONDITION_FAILED" | "BAD_REQUEST"; message: string };
export const runControl: Readonly<Record<string, RunControlToolSpec>> = deepFreeze({
  fast: {
    pause: {},
    resume: { is_tip_broken: "yesno" },
    abort: { return_liquid: "yesno" },
  },
});
```
`getRunControl` and `runControl` are imported directly by the UI (server file has zero imports, so
it's safe client-side per CONTEXT.md D-20/RESEARCH "Reusable Assets").

---

### `components/runs/ControlBar.tsx` (component, polling-driven)

**Analog:** `controller/components/runs/status/QueueStatuscomponent.tsx` (full file, 129 lines)

**Imports pattern** (lines 1-23):
```typescript
import React from "react";
import {
  Spinner, Button, Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody,
  ModalCloseButton, Text, useDisclosure, ButtonGroup, Icon,
} from "@chakra-ui/react";
import { trpc } from "@/utils/trpc";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { Play, Pause, Trash2 } from "lucide-react";
```

**Core button-group + mutation pattern** (lines 39-56, 93-128):
```typescript
const queue = trpc.commandQueue;
const stopMutation = queue.stop.useMutation(stateMutationOpts);
...
const pause = async () => {
  stopMutation.mutate();
};
...
return (
  <>
    {confirmRunStartModal()}
    <ButtonGroup spacing={2}>
      {isRunning ? (
        <Button leftIcon={<Icon as={Pause} size={14} />} colorScheme="orange" variant="solid" onClick={() => pause()}>
          Pause
        </Button>
      ) : ( /* ... */ )}
    </ButtonGroup>
  </>
);
```
**What to copy:** the `ButtonGroup` + `Icon`/lucide `leftIcon` + `colorScheme` idiom, and the
loading guard `if (stateQuery.isLoading) return <Spinner />;` — adapted for ControlBar to "render
nothing" (not a spinner) per D-02/the UI-SPEC loading-state default. Badge/Progress additions come
from the Chakra Component Inventory in `02-UI-SPEC.md` (`Badge`, `Progress isIndeterminate`), not
from this analog (QueueStatuscomponent has no progress bar).

**Insertion point in `RunsComponent.tsx`** (`controller/components/runs/RunsComponent.tsx`, between
the Gantt-chart `Card` and the Runs List `Card` — confirmed exact lines from the Gantt `Card`'s
closing `</Card>` through the Runs List `Card`'s opening):
```tsx
<Card bg={cardBg} shadow="md">
  <CardBody>
    <VStack spacing={4} align="stretch">
      <Box>
        <RunQueueGanttChart onRunClick={handleRunClick} selectedRunId={selectedRunId} />
      </Box>
    </VStack>
  </CardBody>
</Card>
{/* <<< ControlBar + ToolPausedModal mount here, per D-02 */}
<Card bg={cardBg} shadow="md">
  <CardBody>
    <VStack spacing={4} align="stretch">
      <HStack justify="space-between" width="100%">
        <Heading size="lg">{/* ... Runs List ... */}</Heading>
```

---

### `components/runs/RunControlConfirmModal.tsx` (component, shared confirm modal)

**Analog:** `controller/components/runs/PauseModal.tsx` (full file, 51 lines — explicit design
instruction: model on this, never on `StopRunModal.tsx`'s countdown).

**Imports pattern** (lines 1-15):
```typescript
import React from "react";
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Text, Icon, VStack, useColorModeValue,
} from "@chakra-ui/react";
import { Pause } from "lucide-react";
```

**Core modal structure, no `<form>` wrapper, no `autoFocus`** (lines 27-50):
```tsx
return (
  <Modal isOpen={isOpen} onClose={() => {}} closeOnOverlayClick={false} isCentered>
    <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.300" />
    <ModalContent bg={bgColor} maxW="md">
      <ModalHeader textAlign="center">Run Paused</ModalHeader>
      <ModalBody>
        <VStack spacing={4} py={2}>
          <Icon as={Pause} boxSize={12} color={iconColor} />
          <Text textAlign="center">{pauseMessage}</Text>
        </VStack>
      </ModalBody>
      <ModalFooter justifyContent="center">
        <Button colorScheme="teal" onClick={onContinue} size="lg" minW="150px">
          Continue
        </Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
);
```
**What to copy:** the plain `ModalBody`/`ModalFooter` with `onClick` handlers (no `<form onSubmit>`,
no `autoFocus` — this is exactly how PauseModal avoids the Enter-to-confirm risk D-07 warns about).
**What to change:** this modal uses `onClose={() => {}}` and `closeOnOverlayClick={false}` to force
the operator through "Continue" — `RunControlConfirmModal` must do the OPPOSITE: leave Chakra's
`closeOnOverlayClick`/`closeOnEsc` defaults (`true` in 2.8.2, confirmed in RESEARCH.md) and treat
`onClose` identically to clicking Cancel (reset decision state, send nothing), per D-07. Add
`fontWeight="bold"` to `ModalHeader` per the UI-SPEC Typography override note (PauseModal does NOT
have this — it relies on the unmodified `semibold` default, which must NOT be copied verbatim here).

**Decision UI — `RadioGroup` with `value ?? ""` normalization** (from RESEARCH.md's verified read of
installed Chakra 2.8.2 source, `@chakra-ui/radio/dist/use-radio-group.js:38-43`):
```typescript
const [valueState, setValue] = useState(defaultValue || "");
const isControlled = typeof valueProp !== "undefined";
```
**What to copy:** pass `value={decision ?? ""}` to `RadioGroup` (never render a `Radio` with
`value=""`) while keeping the underlying decision state typed `ControlDecisionValue | undefined` for
the Confirm-disabled check (`decision === undefined`), per D-07 and the UI-SPEC Component Inventory
entry for `RadioGroup`/`Radio`.

**Confirm-button in-flight pattern** — use Chakra `Button`'s own `isLoading` prop (UI-SPEC
Component Inventory recommendation, `Spinner` row): `<Button isLoading colorScheme="teal">Confirm</Button>`
rather than hand-rolling a disabled+manual-`Spinner` combo.

---

### `components/runs/ToolPausedModal.tsx` (component, poll-derived)

**Analog:** `controller/components/runs/PauseModal.tsx` (same file as above, different trigger
condition)

**What to copy:** the `Modal`/`ModalOverlay`/`ModalContent`/`ModalBody`/`Icon`/`VStack`/`Text`
skeleton and `useColorModeValue` for `bgColor`/`iconColor`. **What to change:** trigger condition —
PauseModal is driven by `isModalOpen` (queue's `messageData` state); `ToolPausedModal` must be driven
purely by `useRunControlState()`'s `runState.pause` (D-10, D-11) and must never import anything from
the `messageData`/`isModalOpen`/`resume()` machinery in `RunsComponent.tsx`. Icon changes from calm
`Pause` (orange) to `TriangleAlert` (orange) per the UI-SPEC Component Layout Notes, signaling an
instrument-reported reason rather than an operator-initiated pause.

**Mount point** — alongside `StopRunModal` in `RunsComponent.tsx`'s top-level modal block (lines
456-489 region):
```tsx
<StopRunModal
  isOpen={isModalOpen && messageData.type === "stop_run"}
  messageData={messageData}
  onClose={handleResume}
  onConfirm={handleRunStop}
/>
{/* <<< ToolPausedModal mounts here, independent of isModalOpen/messageData */}
```

---

### `components/runs/InstrumentStopModal.tsx` (component, sequenced mutations)

**Analog (visual/icon reference ONLY):** `controller/components/runs/StopRunModal.tsx`

**Icon/color to match** (line 19, 79):
```typescript
import { StopCircle, TriangleAlert } from "lucide-react";
...
<Icon as={TriangleAlert} boxSize={12} color={warningIconColor} />
```
Use `StopCircle` (red) for `InstrumentStopModal` per UI-SPEC Component Layout Notes — matching
`StopRunModal.tsx`'s visual language exactly despite zero shared import.

**DO NOT COPY — the countdown anti-pattern** (lines 44-62, confirmed live in current code):
```typescript
const handleConfirm = () => {
  setCountdown(5);
  const intervalId = setInterval(() => {
    setCountdown((prev) => {
      if (prev === 1) {
        clearInterval(intervalId);
        onConfirm();
        return null;
      }
      return prev ? prev - 1 : null;
    });
  }, 1000);
};
```
This `setInterval`-based auto-confirm is explicitly forbidden (D-17: "No timer, no default"). The
static-scan test (`test/staticScan.test.ts`) must assert no `setTimeout`/`setInterval` exists in the
control-UI modules, and that `StopRunModal` is never imported by `InstrumentStopModal.tsx` or any
module that also imports `toolControl`.

**Sequencing pattern to build (D-18/D-19)** — not from an existing file (no sequenced-mutation
precedent exists in this codebase); use RESEARCH.md's Code Examples verbatim:
```typescript
const result = await toolControlMutation.mutateAsync({ action: "abort", params: { return_liquid } });
if (result.ok) {
  await stopMutation.mutateAsync(); // or clearAllMutation / clearByRunIdMutation per call site
  onClose();
} else {
  showPersistentErrorToast(result.message);
  // do NOT call stop/clearAll/clearByRunId
}
```

**Interception point in `QueueStatuscomponent.tsx`** (lines 46-56, 96-126 — today's direct-call
pattern to intercept):
```typescript
const pause = async () => {
  stopMutation.mutate();
};
...
const clear = async () => {
  clearAllMutation.mutate();
};
...
<Button leftIcon={<Icon as={Pause} size={14} />} colorScheme="orange" variant="solid" onClick={() => pause()}>
  Pause
</Button>
...
<Button leftIcon={<Icon as={Trash2} size={14} />} colorScheme="red" variant="outline" onClick={() => clear()} isDisabled={!hasCommandsToClear}>
  Clear All
</Button>
```
Both `pause` (relabel "Pause queue", D-05) and `clear` must branch: if `useRunControlState()` reports
a running controllable step, open `InstrumentStopModal` instead of calling `stopMutation`/
`clearAllMutation` directly (D-16, D-19). Per-run delete/skip button in `RunsComponent.tsx`
(`DeleteWithConfirmation`/`handleConfirmDelete`/`skipRunMutation`, confirmed by RESEARCH.md) needs the
same branch, bypassing its existing generic `ConfirmationModal` when a controllable step is running
to avoid stacked confirmations (RESEARCH.md consequence note).

---

### `server/routers/tool.ts` — add `recoveryControl` mutation

**Analog 1 (tool resolution):** `controller/server/routers/tool.ts:393-418` (existing `status`
procedure)
```typescript
status: procedure
  .input(z.object({ toolId: z.string() }))
  .query(async ({ input }) => {
    const normalize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalize(input.toolId) === normalize("Tool Box")) {
      const toolbox = Tool.toolBoxConfig();
      const tool = Tool.forId("Tool Box", toolbox.ip, toolbox.port, toolbox.type as ToolType);
      return await tool.fetchStatus();
    }
    const toolRecord = await getToolFromDB(input.toolId);
    const tool = Tool.forId(toolRecord.name, toolRecord.ip, toolRecord.port, toolRecord.type as ToolType);
    return await tool.fetchStatus();
  }),
```
`getToolFromDB` itself (same file, lines 44-65):
```typescript
async function getToolFromDB(toolId: string) {
  const workcellId = await getSelectedWorkcellId();
  const allTools = await findMany(tools, eq(tools.workcellId, workcellId));
  const normalize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const needle = normalize(toolId);
  const tool = allTools.find((t) => normalize(String(t.name || "")) === needle);
  if (!tool) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Tool '${toolId}' not found` });
  }
  return tool;
}
```

**Analog 2 (validate → controlCommand → logAction → return shape):**
`controller/server/command_queue.ts:429-500` (`CommandQueue.toolControl`, full body read)
```typescript
async toolControl(action: string, params: Record<string, unknown> = {}): Promise<ToolControlResult> {
  const step = this._runningStep;
  const verdict = validateControlRequest(step?.toolType, action, params);
  ...
  if (!verdict.ok) {
    await logAction({ level: "warning", action: "Tool Control Refused", details: `...outcome=refused: ${verdict.code} ${verdict.message}` });
    throw new TRPCError({ code: verdict.code, message: verdict.message });
  }
  const tool = Tool.lookup(step!.toolId);
  if (!tool) { /* PRECONDITION_FAILED, logAction, throw */ }
  if (this._runningStep !== step) { /* PRECONDITION_FAILED, logAction, throw */ }
  let result: ToolControlResult;
  try {
    result = await tool.controlCommand(action, verdict.decisions);
  } catch (error) {
    /* logAction "Tool Control Failed", throw INTERNAL_SERVER_ERROR with cause */
  }
  await logAction({ level: result.ok ? "info" : "warning", action: "Tool Control", details });
  return result;
}
```
**What to copy exactly for `recoveryControl({toolId, action, params})`:** resolve the tool via
`getToolFromDB(toolId)` (not `this._runningStep`), check `CommandQueue.global.runningStep?.toolId`
against the resolved tool's id and refuse `PRECONDITION_FAILED` if it matches (D-22 — this is the
one divergence from `toolControl`: the refusal check reads queue state about a DIFFERENT tool's
running step, not "is this action's own target currently running"), call
`validateControlRequest(record.type, action, params)` restricted to `action ∈ {"resume","abort"}`,
call `tool.controlCommand(action, verdict.decisions)`, `logAction` the same way, and return the same
`{ok, response, message}`-shaped `ToolControlResult`.

**tRPC router registration pattern** (`controller/server/routers/command_queue.ts:152-161`):
```typescript
toolControl: procedure
  .input(z.object({ action: z.string(), params: z.record(z.unknown()).optional() }))
  .mutation(async ({ input }) => {
    return CommandQueue.global.toolControl(input.action, input.params ?? {});
  }),
```
Copy this `procedure.input(z.object({...})).mutation(async ({ input }) => {...})` shape for
`recoveryControl` in `server/routers/tool.ts`, adding `toolId: z.string()` and
`action: z.enum(["resume", "abort"])` to the input schema (D-22 limits action at the schema level,
unlike `toolControl` which deliberately leaves `action` unvalidated at the schema level — note this
is an intentional divergence, not an oversight, since `recoveryControl` never needs the "reach
validateControlRequest unlogged" escape hatch that `toolControl` preserves for non-string decisions).

**`Tool.controlCommand` signature to call** (`controller/server/tools.ts:379`):
```typescript
async controlCommand(action: string, params: Record<string, string>): Promise<ToolControlResult>
```

---

### `test/controlDecision.test.ts` (pure-logic test)

**Analog:** `controller/test/runControl.test.ts` (full file, 29 lines)
```typescript
import { describe, it, expect } from "vitest";
import { runControl, getRunControl, validateControlRequest } from "@/server/runControl";
import { commandFields } from "@/components/tools/constants";

describe("runControl map", () => {
  it("has exactly the F.A.S.T. shape with no hard pause decision", () => {
    expect(runControl).toStrictEqual({ fast: { pause: {}, resume: { is_tip_broken: "yesno" }, abort: { return_liquid: "yesno" } } });
    expect(Object.isFrozen(runControl)).toBe(true);
    ...
  });
});
```
**What to copy:** plain `describe`/`it`/`expect`, no mocks, importing a pure `@/` module directly —
this is the exact proof (cited in RESEARCH.md D-24) that `.ts` modules under `components/` import
cleanly in the Vitest node environment via `vite-tsconfig-paths`. Use this identical style for testing
`allDecisionsChosen`, `pauseEpisodeKey`, and `controlButtonHints` from the new `controlDecision.ts`.

**Required edit to this exact file (D-20, flip the assertion — do NOT just extend):**
```typescript
// CURRENT (must be inverted once fast.abort/fast.resume are removed from commandFields):
describe("commandFields untouched (D-10)", () => {
  it("leaves commandFields.fast.abort and .resume unchanged, with no pause entry", () => {
    expect(commandFields.fast.abort).toStrictEqual([{ name: "return_liquid", type: "text" }]);
    expect(commandFields.fast.resume).toStrictEqual([{ name: "is_tip_broken", type: "text" }]);
    expect(Object.prototype.hasOwnProperty.call(commandFields.fast, "pause")).toBe(false);
  });
});
```
Replace the two `toStrictEqual` assertions with
`expect(Object.prototype.hasOwnProperty.call(commandFields.fast, "abort")).toBe(false)` and the same
for `"resume"` — this test currently asserts the OPPOSITE of what D-20 requires and will fail on a
correct implementation if left unchanged.

**Entries to remove from `components/tools/constants.ts`** (lines ~342-346):
```typescript
// Operator recovery from an instrument pause. "yes" or "no", typed by the
// operator: text with no defaultValue, never boolean, because an untouched
// boolean is saved as false. Blank is rejected by the tool.
abort: [{ name: "return_liquid", type: "text" }],
resume: [{ name: "is_tip_broken", type: "text" }],
```

---

### `test/recoveryControl.test.ts` (server mutation test)

**Analog:** `controller/test/toolControl.test.ts` + `controller/test/helpers/fakeTool.ts`
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { logAction } from "@/server/logger";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";

describe("toolControl", () => {
  let queue: CommandQueue;
  let grpc: FakeGrpc;
  beforeEach(() => {
    queue = new CommandQueue({} as any);
    queue.slackNotificationsEnabled = false;
    (globalThis as any)["__global_command_queue_key"] = queue;
    installedToolIds = ["fast-1"];
    const fake = installFakeTool("fast-1", ToolType.fast);
    grpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });
    ...
  });
  afterEach(async () => { /* cleanup, removeFakeTool, vi.restoreAllMocks() */ });
});
```
**What to copy exactly:** `installFakeTool(toolId, toolType)` to replace `tool.grpc` with `vi.fn()`
stubs, and `<router>.createCaller({})` to invoke the tRPC procedure directly without an HTTP round
trip (`toolRouter.createCaller({})` for `recoveryControl`). Assert `PRECONDITION_FAILED` when
`CommandQueue.global.runningStep?.toolId` matches the target `toolId`, plus the D-24-listed refusal
cases: undeclared action, pause not allowed (action restricted to resume/abort), blank decision.

---

### `components/ui/Toast.tsx` — add persistent-error helper (D-09 gap)

**Analog (existing `duration: null` precedent in the same file):**
```typescript
// loadingToast, lines ~70-76 — already uses duration: null for in-flight state
const toastId = toast({
  title: loadingTitle, description: loadingDescription, status: "loading",
  duration: null, // Don't auto-close while loading
  variant: "left-accent", position: "bottom-right", isClosable: true,
});
```
**What NOT to reuse:** the existing `errorToast` (bottom of file):
```typescript
export const errorToast = (title: string, description: string) => {
  toast({ title, description, status: "error", duration: 10000, /* ... */ isClosable: true });
};
```
This hardcodes `duration: 10000` and does not satisfy D-09's `duration: null` requirement (confirmed
gap in RESEARCH.md). **What to add:** a new `persistentErrorToast(title, description)` helper in this
same file, following the exact `toast({...})` call shape above but with `status: "error"` and
`duration: null`, `isClosable: true`.

## Shared Patterns

### Chakra Modal structure (no `<form>`, no `autoFocus`)
**Source:** `controller/components/runs/PauseModal.tsx` (whole file)
**Apply to:** `RunControlConfirmModal`, `ToolPausedModal`, `InstrumentStopModal` — all three new
modals use plain `ModalBody`/`ModalFooter` with `onClick` handlers, never a `<form onSubmit>`, and
never `autoFocus` on the primary action button (avoids Enter-to-confirm, D-07/D-17).

### `ButtonGroup` + lucide `Icon` action pattern
**Source:** `controller/components/runs/status/QueueStatuscomponent.tsx:96-128`
**Apply to:** `ControlBar.tsx` and the tool page's "Run recovery" section — same
`<Button leftIcon={<Icon as={X} size={14} />} colorScheme="...">Label</Button>` idiom inside a
`ButtonGroup`.

### tRPC mutation + `onSettled` refetch idiom
**Source:** `controller/components/runs/status/QueueStatuscomponent.tsx:32-38`
```typescript
const stateMutationOpts = {
  onSettled: () => {
    stateQuery.refetch();
    getError.refetch();
    commandsQuery.refetch();
  },
};
```
**Apply to:** any new mutation hook usage where a manual refetch nudge is useful; NOTE per D-09 the
control-bar/modal mutations must explicitly NOT do optimistic updates — only refetch/rely on the next
poll tick after `ok: true`, never update local state from the mutation result itself.

### Server-side validate → execute → logAction → return shape
**Source:** `controller/server/command_queue.ts:429-500` (`CommandQueue.toolControl`)
**Apply to:** `recoveryControl` in `server/routers/tool.ts` — same four-stage shape: validate via
`validateControlRequest`, resolve/execute via `Tool.controlCommand`, `logAction` with
level/action/details matching the `toolControl` logging convention, return `{ok, response, message}`.

### Pure-logic module, zero React import, importable from Vitest node env
**Source:** `controller/server/runControl.ts` (whole file) + `controller/test/runControl.test.ts`
(whole file)
**Apply to:** `components/runs/controlDecision.ts` and its test — no React/JSX import, exported named
functions, each with a short doc comment stating the invariant it protects (own-property safety,
frozen maps, fixed refusal order) rather than leaving the intent implicit.

### Static source-scan test style
**Source:** `controller/test/runControl.test.ts` (style: plain `describe`/`it`/`expect`, no AST
library — confirmed absent from `package.json` devDependencies in RESEARCH.md)
**Apply to:** `test/staticScan.test.ts` — use `fs.readFileSync(file, "utf-8").match(/pattern/g)` and
assert counts/call-sites, matching the project's "no new UI test deps" policy (D-24).

## No Analog Found

None — every file in the CONTEXT.md/RESEARCH.md file list has at least a role-match or exact analog
in the existing codebase (this phase is overwhelmingly compositional, per RESEARCH.md's own
"Key insight").

## Metadata

**Analog search scope:** `controller/components/runs/`, `controller/components/runs/status/`,
`controller/components/ui/`, `controller/server/`, `controller/server/routers/`, `controller/test/`,
`controller/components/tools/constants.ts`, `controller/pages/tools/[id].tsx`
**Files scanned/read in full or targeted sections:** `PauseModal.tsx`, `StopRunModal.tsx`,
`QueueStatuscomponent.tsx`, `command_queue.ts` (router + `CommandQueue.toolControl` body),
`runControl.ts`, `runState.ts`, `routers/tool.ts` (imports + `status`/`getToolFromDB`),
`components/tools/constants.ts` (fast entries), `RunsComponent.tsx` (modal block + Card insertion
point), `test/runControl.test.ts`, `test/toolControl.test.ts`, `components/ui/Toast.tsx`
**Tracked-source gate:** all 14 analog files verified via `git ls-files` — none are gitignored mirrors.
**Pattern extraction date:** 2026-10-13
