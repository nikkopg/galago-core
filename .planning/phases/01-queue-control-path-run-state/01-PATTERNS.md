# Phase 1: Queue Control Path & Run State - Pattern Map

**Mapped:** 2026-10-12
**Files analyzed:** 9 (new/modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `controller/server/tools.ts` (`Tool.controlCommand`, new method) | service | request-response (gRPC) | `controller/server/tools.ts` instance `executeCommand` (lines 350-590) | exact (sibling method, same file) |
| `controller/server/tools.ts` (`Tool.fetchStatus`, modified) | service | request-response (gRPC poll) | `controller/server/tools.ts` `fetchStatus` itself (lines 99-111, pre-fix) | exact (bug-fix in place) |
| `controller/server/command_queue.ts` (`runningStep` accessor + set/clear) | service/state | event-driven (in-memory) | `controller/server/command_queue.ts` busy loop tool-step dispatch (around line 1014, `await this.executeCommand(nextCommand)`) | exact (same file, same loop) |
| `controller/server/command_queue.ts` (2s run-state poller / `_runStateCache`) | service | streaming/polling | `controller/server/tools.ts` heartbeat `setInterval` pattern (`startHeartbeat`/`stopHeartbeat`, near lines 90-111) | role-match (interval lifecycle) |
| `controller/server/routers/command_queue.ts` (`toolControl` mutation) | route/controller | request-response | `controller/server/routers/command_queue.ts` `gotoCommand`/`skipCommand` mutations (lines 54-62, 109-114) | exact (same router file) |
| `controller/server/routers/command_queue.ts` (`runState` query) | route/controller | request-response (cache read) | `controller/server/routers/command_queue.ts` `state`/`getError`/`isWaitingForInput` queries (lines 8-10, 17-20, 96-98) | exact (same router file) |
| `controller/server/runControl.ts` (new file, capability map) | config | — | `controller/components/tools/constants.ts` `commandFields` map (fast entry ~line 314, abort/resume ~345-346) | role-match (sibling capability map, same shape style) |
| `controller/test/command_queue.test.ts` (new) | test | request-response/event-driven | none (no existing test runner/tests in `controller/`) | no analog |
| `controller/test/tools.test.ts` (new) | test | request-response | none (no existing test runner/tests in `controller/`) | no analog |
| `controller/vitest.config.ts` (new) | config | — | none (no prior vitest config in repo) | no analog |

## Pattern Assignments

### `controller/server/tools.ts` — add `Tool.controlCommand(action, params)`

**Analog:** `controller/server/tools.ts`, instance `executeCommand` (lines 350-590) and `_payloadForCommand` (lines 325-331).

**Imports already present** (lines 1-23, no new imports needed for this method):
```typescript
import * as grpc from "@grpc/grpc-js";
import * as tool_base from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import * as tool_driver from "gen-interfaces/tools/grpc_interfaces/tool_driver";
import { PromisifiedGrpcClient, promisifyGrpcClient } from "./utils/promisifyGrpcCall";
import { logAction } from "./logger";
```

**Payload-building pattern to reuse verbatim** (lines 325-331):
```typescript
_payloadForCommand(command: ToolCommandInfo): tool_base.Command {
  return {
    [this.toolType]: {
      [command.command]: command.params,
    },
  };
}
```

**Core pattern — new sibling method, does NOT call `executeCommand`** (per D-05, adapted from the existing call site pattern at lines 350+):
```typescript
async controlCommand(action: string, params: Record<string, any>): Promise<{
  ok: boolean;
  response: tool_base.ResponseCode;
  message?: string;
}> {
  const payload = this._payloadForCommand({
    toolId: this.id,
    toolType: this.type,
    command: action,
    params,
  });
  const reply = await this.grpc.executeCommand(payload); // same stub, no gRPC deadline
  return {
    ok: reply.response === tool_base.ResponseCode.SUCCESS,
    response: reply.response,
    message: reply.error_message,
  };
}
```

**Error handling:** no try/catch inside `controlCommand` itself — transport errors (gRPC unavailable) propagate up uncaught so the tRPC layer (`toolControl` mutation) can convert them to a `TRPCError` (D-06). This mirrors how `executeCommand` lets `ToolCommandExecutionError` propagate to its caller rather than swallowing it.

---

### `controller/server/tools.ts` — fix `Tool.fetchStatus` heartbeat retry (D-15, D-16)

**Analog:** the existing buggy method itself (lines 99-111), confirmed read this session.

**Current (buggy) code** (lines 99-111):
```typescript
async fetchStatus() {
  try {
    const statusReply = await this.grpc.getStatus({});
    this.status = statusReply.status;
    this.uptime = statusReply.uptime;
    return statusReply;
  } catch (e) {
    console.error(`Failed to fetch status for tool ${this.toolId}: ${e}`);
    this.status = ToolStatus.UNKNOWN_STATUS;
    this.stopHeartbeat();  // BUG: stops interval forever after one failure
    return { uptime: 0, status: ToolStatus.UNKNOWN_STATUS } as tool_base.StatusReply;
  }
}
```

**Fixed pattern** (minimal diff, add a `_consecutiveFailures` counter field and dedup logging via the existing `logAction` import):
```typescript
private _consecutiveFailures = 0;

async fetchStatus() {
  try {
    const statusReply = await this.grpc.getStatus({});
    if (this._consecutiveFailures > 0) {
      logAction({ level: "info", action: "Tool Status Recovered", details: `${this.toolId} recovered after ${this._consecutiveFailures} failed polls` });
    }
    this._consecutiveFailures = 0;
    this.status = statusReply.status;
    this.uptime = statusReply.uptime;
    return statusReply;
  } catch (e) {
    this._consecutiveFailures++;
    if (this._consecutiveFailures === 1) {
      logAction({ level: "warning", action: "Tool Status Unknown", details: `${this.toolId}: ${e}` });
    }
    this.status = ToolStatus.UNKNOWN_STATUS;
    // no stopHeartbeat() call — interval keeps its normal cadence (D-15)
    return { uptime: 0, status: ToolStatus.UNKNOWN_STATUS } as tool_base.StatusReply;
  }
}
```

**Logging pattern reused:** `logAction({level, action, details})` from `./logger` — same signature used throughout `tools.ts` and `command_queue.ts` (e.g. `command_queue.ts` lines 1012-1016).

---

### `controller/server/command_queue.ts` — `runningStep` accessor, set/clear around tool-step dispatch (D-01, D-02)

**Analog:** the busy loop's existing tool-step dispatch, confirmed this session around line 1014:
```typescript
// Regular command, send to Tool
await this.executeCommand(nextCommand);

logAction({
  level: "info",
  action: "Command Executed",
  details: "Command executed successfully.",
```

**Pattern to apply:** wrap ONLY this `await this.executeCommand(nextCommand)` call — not the `Tool Box` inline branches above it (lines ~747-1012) — with a set-before / clear-in-finally:
```typescript
this._runningStep = {
  queueId: nextCommand.queueId,
  runId: nextCommand.runId,
  toolId: nextCommand.commandInfo.toolId,
  toolType: nextCommand.commandInfo.toolType,
  command: nextCommand.commandInfo.command,
  startedAt: Date.now(),
};
this._startRunStatePollerIfApplicable(nextCommand.commandInfo.toolType);
try {
  await this.executeCommand(nextCommand);
} finally {
  this._runningStep = undefined;
  this._stopRunStatePoller();
}
```

Expose as a read-only getter, following the existing accessor style already in the file (e.g. other public getters on `CommandQueue` — follow whatever getter convention is already used for queue-wide read access, such as `state`/`getError` query backers).

**Pitfall to avoid (noted in RESEARCH.md Pitfall 1):** the `Tool Box` branches (`pause`/`user_form`/`show_message`/`timer`/`note`/`stop_run`/`goto`/`variable_assignment`) all `continue` before reaching this line — do not wrap the whole loop body or the whole `try` block, only this call (D-02).

**Error handling:** the existing `catch` block in the busy loop (confirmed around line 1023 per RESEARCH.md) already handles `executeCommand` failures and moves the queue to `FAILED` — no new error handling needed here beyond the `finally` cleanup.

---

### `controller/server/command_queue.ts` — 2s run-state poller / `_runStateCache` (D-11, D-17)

**Analog:** `Tool`'s heartbeat `setInterval`/`clearInterval` lifecycle pattern in `controller/server/tools.ts` (imports at line 8: `import { setInterval, clearInterval } from "timers";`), and the `fetchStatus` retry-without-stopping pattern above.

**Core pattern:**
```typescript
private _runStatePollHandle?: NodeJS.Timeout;
private _runStateCache: RunStateEnvelope = { running: false };

private _startRunStatePollerIfApplicable(toolType: string) {
  if (!runControl[toolType]) return; // only controllable tool types get a poller (mirrors D-02's scoping)
  this._runStatePollHandle = setInterval(async () => {
    try {
      const tool = getToolForRunningStep(this._runningStep!);
      const reply = await tool.grpc.getStatus({}); // same RPC the 5s heartbeat uses — no new gRPC client
      this._runStateCache = {
        running: true,
        ...this._runningStep,
        status: "ok",
        runState: extractRunState(reply),
        updatedAt: Date.now(),
      };
    } catch (e) {
      this._runStateCache = { ...this._runStateCache, status: "unknown", lastError: String(e), updatedAt: Date.now() };
      // never throws, never clears the interval — mirrors D-15's heartbeat fix
    }
  }, 2000);
}

private _stopRunStatePoller() {
  if (this._runStatePollHandle) {
    clearInterval(this._runStatePollHandle);
    this._runStatePollHandle = undefined;
  }
  this._runStateCache = { running: false };
}
```

**Pitfall to avoid (RESEARCH.md pitfall on dangling intervals):** the poller start/stop must bracket `executeCommand` with the same `finally` used for `_runningStep` (above), not just the happy path — a failed/aborted step must not leave a dangling 2s interval.

---

### `controller/server/routers/command_queue.ts` — `toolControl` mutation (D-03, D-06, D-07)

**Analog:** same file's existing mutations, e.g. `gotoCommand` (lines 109-114) and `skipCommand`/`skipCommandsUntil` (lines 54-62) for the `procedure.input(...).mutation(...)` shape; `controller/server/routers/hub.ts` for the `TRPCError` convention (line 163, 224).

**Imports pattern** (add to existing router file):
```typescript
import { TRPCError } from "@trpc/server";
import { procedure, router } from "@/server/trpc";
import { z } from "zod";
import { runControl } from "@/server/runControl";
```

**TRPCError convention** (`controller/server/routers/hub.ts:163`):
```typescript
throw new TRPCError({ code: "NOT_FOUND", message: "Hub item not found" });
```

**Core request-response pattern** (D-03 validation chain, D-06 structured result, D-07 logging):
```typescript
toolControl: procedure
  .input(z.object({ action: z.string(), params: z.record(z.string()) }))
  .mutation(async ({ input }) => {
    const running = CommandQueue.global.runningStep; // D-01
    if (!running) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No step is currently running." });
    }
    const toolControlMap = runControl[running.toolType];
    if (!toolControlMap) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Tool type "${running.toolType}" has no runControl entry.`,
      });
    }
    const decisionSpec = toolControlMap[input.action];
    if (!decisionSpec) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Action "${input.action}" is not declared for tool type "${running.toolType}".`,
      });
    }
    for (const key of Object.keys(decisionSpec)) {
      const value = input.params[key];
      if (value !== "yes" && value !== "no") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Decision "${key}" must be "yes" or "no", got ${JSON.stringify(value)}.`,
        });
      }
    }
    const tool = getToolForRunningStep(running);
    const result = await tool.controlCommand(input.action, input.params); // D-05
    await logAction({
      level: result.ok ? "info" : "warning",
      action: "Tool Control",
      details: `toolControl action=${input.action} tool=${running.toolId} queueId=${running.queueId} ` +
        `runId=${running.runId} params=${JSON.stringify(input.params)} outcome=${result.ok ? "ok" : "refused"}`,
    }); // D-07
    return result; // { ok, response, message } — never thrown for non-SUCCESS
  }),
```

---

### `controller/server/routers/command_queue.ts` — `runState` query (D-11, D-12, D-14)

**Analog:** existing read-only queries in the same file, e.g. `state` (lines 8-10), `getError` (lines 17-20), `isWaitingForInput` (lines 96-98) — all plain `procedure.query(async () => {...})` with no gRPC call inside the handler.

**Core pattern:**
```typescript
runState: procedure.query(async () => {
  return CommandQueue.global.runStateCache; // reads cache only, triggers no gRPC (D-11, D-14)
}),
```

---

### `controller/server/runControl.ts` (new file) — capability map (D-09)

**Analog:** `controller/components/tools/constants.ts` `commandFields` map (fast entry ~line 314, abort/resume ~345-346) — same per-tool-type nested-map shape and export style, but kept in a separate server-only file per the Open Questions recommendation (no existing precedent for `components/` files being imported by a tRPC router).

**Pattern — exported const map, shape verbatim from D-09:**
```typescript
export const runControl: Record<string, Record<string, Record<string, "yesno">>> = {
  fast: {
    pause: {},
    resume: { is_tip_broken: "yesno" },
    abort: { return_liquid: "yesno" },
  },
};
```

**Note (D-10):** `commandFields.fast.abort`/`.resume` in `controller/components/tools/constants.ts:345-346` are left untouched in this phase — do not remove or modify them.

---

### `controller/test/*.test.ts`, `controller/vitest.config.ts` (new, no analog)

No existing test runner or test files exist in `controller/` (`npm test` is `tsc --noEmit`). Build from scratch per RESEARCH.md's Validation Architecture section:
- `vitest.config.ts` needs `vite-tsconfig-paths` plugin + a `setupFiles` entry that globally mocks `@/db/client` and `@/server/logger` (both have import-time side effects — real SQLite file + migrations).
- Test files use `vi.mock()` for the gRPC client (`ToolDriverClient`) — never a real tool (D-19).

## Shared Patterns

### tRPC error convention
**Source:** `controller/server/routers/hub.ts:163,224`; confirmed via `grep -rn "TRPCError" controller/server/` as the house style across 40+ call sites (inventory.ts, hub.ts, form.ts, robot-arm.ts).
**Apply to:** `toolControl` mutation's refusal paths (D-03).
```typescript
import { TRPCError } from "@trpc/server";
throw new TRPCError({ code: "PRECONDITION_FAILED", message: "..." });
throw new TRPCError({ code: "BAD_REQUEST", message: "..." });
```

### Audit logging
**Source:** `controller/server/logger.ts` `logAction({level, action, details})`; used throughout `tools.ts` and `command_queue.ts` (e.g. `command_queue.ts` lines 1012-1016, fetch-status fix above).
**Apply to:** `toolControl` (every attempt, D-07), `Tool.fetchStatus` (failure/recovery, D-16).
```typescript
import { logAction } from "./logger"; // or "@/server/logger" depending on importing file's path depth
logAction({ level: "info" | "warning" | "error", action: "...", details: "..." });
```

### gRPC call — no deadline, no CallOptions
**Source:** `controller/server/utils/promisifyGrpcCall.ts` (confirmed this session: `promisifyGrpcCall` passes no `CallOptions`, lines 19-32).
**Apply to:** `Tool.controlCommand` and the 2s poller's `getStatus` call — both must reuse the undecorated `this.grpc.<method>(...)` call exactly as `executeCommand` and the existing 5s heartbeat already do. Do not add a deadline (Anti-Pattern 2 in RESEARCH.md).

### Interval lifecycle (setInterval/clearInterval, retry-without-stopping)
**Source:** `controller/server/tools.ts` heartbeat start/stop methods (`startHeartbeat`/`stopHeartbeat`, near lines 90-98) and the fixed `fetchStatus` pattern above.
**Apply to:** the new 2s run-state poller on `CommandQueue` — same "never call stop on a single failure" rule (D-15/D-17), same `import { setInterval, clearInterval } from "timers";` style.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `controller/test/command_queue.test.ts` | test | request-response/event-driven | No existing test runner or test files anywhere in `controller/` — build fresh per RESEARCH.md Validation Architecture |
| `controller/test/tools.test.ts` | test | request-response | Same as above |
| `controller/test/runControl.test.ts` | test | — (plain assertion) | Same as above |
| `controller/vitest.config.ts` | config | — | No prior Vitest/Jest config in the repo; must add `vite-tsconfig-paths` + `setupFiles` mocks for `@/db/client` and `@/server/logger` per RESEARCH.md Pitfall 3 |

## Metadata

**Analog search scope:** `controller/server/`, `controller/server/routers/`, `controller/components/tools/`
**Files scanned:** `tools.ts`, `command_queue.ts`, `routers/command_queue.ts`, `routers/hub.ts`, `trpc.ts`, `components/tools/constants.ts`, `utils/SqliteQueue.ts`, `utils/promisifyGrpcCall.ts`, `db/client.ts`, `logger.ts` — all confirmed git-tracked via `git ls-files`.
**Pattern extraction date:** 2026-10-12
**Note:** All code excerpts above are drawn from this session's direct reads and from RESEARCH.md's `[VERIFIED]` citations (same session, same repo) — no gitignored mirror paths were used; all analog files confirmed tracked via `git ls-files`.
