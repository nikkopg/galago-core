# Phase 1: Queue Control Path & Run State - Research

**Researched:** 2026-10-12
**Domain:** Server-side out-of-band instrument control (tRPC + gRPC) layered on an existing busy-loop queue, plus a new unit-test runner for a test-runner-less Next.js codebase
**Confidence:** HIGH — every claim below about this repo's code is `[VERIFIED]` by reading the actual file this session; the ts-proto/vitest ecosystem claims are `[VERIFIED: npm registry]`/`[CITED]` against the live registry queried this session.

## Summary

Phase 1 is almost entirely additive wiring over code that was traced and mapped in the prior
milestone research (`ARCHITECTURE.md`, `PITFALLS.md`, `STACK.md` — all reused here, not redone). Six
things need building: a new `Tool.controlCommand` gRPC send path, an in-memory "running step" record
set/cleared around the busy loop's existing tool-step dispatch line, a `runControl` capability map, a
`runState` tRPC query backed by a 2 s server-side poller, a heartbeat that no longer calls
`stopHeartbeat()` on failure, and (last, gated on a sibling-repo commit) regenerated interfaces with
`StatusReply.run_state` and `fast.Command.Pause`.

The one genuinely new piece of infrastructure is a unit-test runner: `controller/` has no test
runner today (`npm test` is `npx tsc --noEmit`), no `vitest`/`jest` in `node_modules`, and `node` is
not on the default `PATH` (only via `~/.nvm/versions/node/v24.14.1/bin`). Vitest is viable here but
needs three extra pieces to work with this Next.js 13 + `tsconfig.json` path-alias setup: a `vite`
peer dependency, `vite-tsconfig-paths` (or manual `resolve.alias`) for `@/*`/`gen-interfaces/*`, and
explicit mocks for `@/db/client` and `@/server/logger` — both have import-time side effects (a real
SQLite file + migrations) that must never run in a unit test.

The QUE-06 proto dependency is confirmed still blocked: reading both the vendor submodule's pinned
checkout and the sibling `galago-tools` repo's actual proto files directly (not just the design doc's
prose) shows neither `tool_base.proto`'s `StatusReply` nor `fast.proto`'s `Command` oneof has been
touched yet. Everything else in this phase must build and test against a mock.

**Primary recommendation:** Build QUE-01–QUE-05 now against a mocked `Tool`/`CommandQueue`, stand up
Vitest with `vite-tsconfig-paths` and hand-rolled `vi.mock()`s for `@/db/client` and `@/server/logger`,
and leave QUE-06 as the phase's last, separately-gated plan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Running-step tracking (`runningStep` accessor) | API / Backend (`CommandQueue`) | — | In-memory, process-local state; must not touch `SqliteQueue`'s persisted `STARTED` row (D-01) |
| `toolControl` send path | API / Backend (`Tool.controlCommand`) | — | Direct gRPC call, bypasses the queue entirely; no DB, no UI logic |
| `runControl` capability declaration | API / Backend (`constants.ts`/`runControl.ts`) | Browser/Client (Phase 2 reads the same map) | Server validates against it (D-03); Phase 2's UI reads the identical shape — single source of truth, owned here |
| 2 s run-state poller | API / Backend (`CommandQueue` or `RunStateMonitor`) | — | Must be N-tabs-safe (one gRPC poll regardless of browser tab count); lives server-side by construction |
| `runState` tRPC query | API / Backend | Browser/Client (Phase 2 consumes) | Read-only cache read, no gRPC triggered per call (D-11) |
| Heartbeat retry fix | API / Backend (`Tool.fetchStatus`) | — | Pure bug fix in the existing `Tool` class; no tier crosses |
| `StatusReply.run_state` / `fast.Command.Pause` | Database/Storage boundary (proto = wire contract) | API / Backend (adapter in `extractRunState`) | Proto is the schema at the gRPC boundary; `extractRunState` is the one place that translates it for everything above |

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|------|-----------|-------------|---------|-------------|
| `vitest` | npm | latest published 2026-10-12 | 125,053,533/wk | github.com/vitest-dev/vitest | SUS (`too-new`) | Flagged — planner must add `checkpoint:human-verify` before install |
| `vite` | npm | latest published 2026-10-08 | 195,883,741/wk | github.com/vitejs/vite | SUS (`too-new`) | Flagged — planner must add `checkpoint:human-verify` before install |
| `vite-tsconfig-paths` | npm | 2026-02-11 | 26,238,556/wk | github.com/aleclarson/vite-tsconfig-paths | OK | Approved |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `vitest`, `vite` — in both cases the `too-new` signal
fires on the **latest** published version's timestamp, not the package's overall age; both are
long-established, extremely high-download, canonical-repo packages that ship frequent releases
(vitest publishes new patch/minor versions roughly weekly). This reads as a gate false-positive
caused by release cadence rather than an actual legitimacy concern `[ASSUMED — inference from the
download/repo signals returned by the gate, not a second independent source]`. The planner should
still insert `checkpoint:human-verify` before `npm install -D vitest vite` per protocol, and may
additionally choose to pin an older, longer-proven minor (e.g. `vitest@2.1.9`, see Validation
Architecture below) to sidestep the flag entirely — `[VERIFIED: npm registry]` that `vitest@2.1.9`
exists and declares `engines.node: "^18.0.0 || >=20.0.0"`, compatible with the project's `node
v24.14.1`.

## Standard Stack

### Core (already in place — reused from prior research, not re-verified here beyond spot checks)
| Library | Version (confirmed installed) | Purpose | Why Standard |
|---------|------|---------|--------------|
| `@grpc/grpc-js` | 1.12.2 `[CITED: controller/node_modules/@grpc/grpc-js/package.json, per prior STACK.md]` | gRPC client, already one instance per `Tool` | `Tool.controlCommand` reuses `this.grpc`, no new client |
| `@trpc/server` / `@trpc/react-query` | 10.9.0 | tRPC router/procedures | `toolControl`/`runState` are two more procedures on the existing `commandQueueRouter` |
| `ts-proto` (global, pinned) | **1.151.1** required | TS codegen for `.proto` | `[VERIFIED: npm registry]` `ts-proto@1.151.1` exists on the npm registry (checked this session: `npm view ts-proto@1.151.1 version` → `1.151.1`). **Not currently globally installed** — `npm list -g` shows no `ts-proto` today, so QUE-06's plan must run `npm install -g ts-proto@1.151.1` (or `bin/make deps`) before `bin/make proto_ts`, or codegen will fail to find `protoc-gen-ts_proto` on `PATH` at all `[VERIFIED: direct inspection this session]` |
| `ts-proto` (local, in `node_modules`) | 1.153.2 `[VERIFIED: controller/node_modules/ts-proto/package.json read this session — field "version": "1.153.2"]` | — | **Do not use** — confirmed broken for `tool_base.ts` per milestone context (D-18); `bin/make proto_ts` resolves the codegen plugin off global `PATH`, not `node_modules/.bin`, so as long as global 1.151.1 is installed first, this local copy is inert for this command |

### New for this phase (test infrastructure)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `5.0.4` (latest) `[VERIFIED: npm registry, checked this session]`, or `2.1.9` as a conservative pin `[VERIFIED: npm registry]` | Unit-test runner for `CommandQueue`/`Tool` server logic | D-20's "vitest preferred" — see Validation Architecture for the version tradeoff |
| `vite` | peer dep of vitest (`^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0` for vitest 5; vitest 2.x has a looser peer range) `[VERIFIED: npm registry, vitest@5.0.4 peerDependencies]` | Vitest's internal transform/bundler | Required transitively; the app itself never imports Vite — Next.js keeps its own Webpack/SWC pipeline untouched |
| `vite-tsconfig-paths` | `6.1.1` (latest) `[VERIFIED: npm registry, checked this session]` | Resolves `@/*`, `gen-interfaces/*` path aliases from `tsconfig.json` inside Vitest | Without this, every `import ... from "@/..."` in a test-imported file fails to resolve under Vitest's own module resolution |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | `node:test` + `tsx` (D-20's explicit fallback) | No `vite`/peer-dep chain, no package-legitimacy flag to resolve — but manual path-alias resolution (no `tsconfig-paths` equivalent built in) and manual `vi.mock`-style module mocking is harder (would need `--import` loader hooks or manual dependency injection) |
| `vitest@5.0.4` | `vitest@2.1.9` | 2.x has a much wider track record and a looser Node/Vite peer range (`node: "^18.0.0 \|\| >=20.0.0"` vs 5.x's `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`); the project's pinned `node v24.14.1` satisfies both, so there is no compatibility reason to prefer 5.x here — only currency |

**Installation (do not run without a `checkpoint:human-verify`, per the Package Legitimacy Audit):**
```bash
export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"   # node is not on default PATH
cd controller && npm install -D vitest vite-tsconfig-paths
```

**Version verification performed this session:**
```
$ npm view vitest version          → 5.0.4
$ npm view vite-tsconfig-paths version → 6.1.1
$ npm view ts-proto@1.151.1 version → 1.151.1   (confirms the pin design/D-18 names still resolves)
$ npm view vitest@5.0.4 engines     → { node: '^22.12.0 || ^24.0.0 || >=26.0.0' }
```

## Architecture Patterns

### System Architecture Diagram

```
Operator (tRPC caller, Phase 2 UI or test harness)
   │
   ▼
commandQueue.toolControl({action, params})  ── NEW tRPC mutation (routers/command_queue.ts)
   │
   ├─ 1. CommandQueue.runningStep  ── NEW read-only accessor, in-memory (D-01)
   │       no running step? ─────────────────────────────► TRPCError PRECONDITION_FAILED
   │
   ├─ 2. runControl[toolType]  ── NEW capability map (constants.ts / runControl.ts)
   │       no entry for toolType, or action not declared? ─► TRPCError PRECONDITION_FAILED / BAD_REQUEST
   │
   ├─ 3. validate decision values against runControl[toolType][action]
   │       blank / not "yes"|"no"? ───────────────────────► TRPCError BAD_REQUEST
   │
   ▼
Tool.controlCommand(action, params)  ── NEW method on Tool (tools.ts), parallels executeCommand
   │   (does NOT call Tool.executeCommand — no var substitution, no step plumbing)
   ▼
this.grpc.executeCommand(this._payloadForCommand({toolType, command: action, params}))
   │   (same gRPC stub CommandQueue's busy loop already uses for queued steps — no new client)
   ▼
tool server (galago-tools, out of scope for this repo)
   │
   ▼
ExecuteCommandReply  ── structured { ok, response, message } back to toolControl's caller (D-06)
                         (never throws on a non-SUCCESS reply; transport errors do throw a TRPCError)

─────────────────────────────────────────────────────────────────────────────────────

Busy loop (command_queue.ts, UNCHANGED control flow):
  _runBusyLoopWhileQueueNotEmpty()
    → commands.startNext()  (SqliteQueue marks STARTED, persisted — not read back, D-01)
    → [Tool Box inline branches: pause/user_form/show_message/timer/note/stop_run/goto/
       variable_assignment — none of these touch runningStep]
    → else: this.executeCommand(nextCommand)        ← the ONE place a real tool step runs
         ├─ NEW: this._runningStep = {queueId, runId, toolId, toolType, command, startedAt}
         ├─ NEW: start the 2s poller if runControl[toolType] exists
         ├─ await Tool.executeCommand(command.commandInfo)   ← UNCHANGED, no deadline
         ├─ NEW: finally { this._runningStep = undefined; stop the poller }
         └─ await this.commands.complete(command.queueId)    ← UNCHANGED

2s poller (new, lifecycle tied to runningStep):
  setInterval(async () => {
    try {
      const reply = await tool.grpc.getStatus({});     ← same RPC the 5s heartbeat uses
      this._runStateCache = { status: "ok", runState: extractRunState(reply), updatedAt, ... };
    } catch (e) {
      this._runStateCache = { ...last good runState, status: "unknown", lastError: e, updatedAt };
      // never throws, never stops the interval (D-17, mirrors the heartbeat fix D-15)
    }
  }, 2000);

commandQueue.runState  ── NEW tRPC query, reads this._runStateCache, triggers NO gRPC itself (D-11)
```

### Recommended Project Structure
```
controller/
├── server/
│   ├── command_queue.ts       # + runningStep accessor, poller start/stop, _runStateCache
│   ├── tools.ts                # + controlCommand(), fetchStatus() retry fix
│   ├── routers/command_queue.ts # + toolControl mutation, runState query
│   └── runControl.ts           # NEW (or inline in constants.ts) — the capability map
├── components/tools/
│   └── constants.ts            # unchanged commandFields; runControl lives alongside or in runControl.ts
├── gen-interfaces/              # regenerated in QUE-06 only
└── __tests__/ or test/          # NEW — vitest spec files
    ├── command_queue.test.ts    # toolControl refusals, runningStep lifecycle, runState independence
    └── tools.test.ts            # fetchStatus retry behavior
vitest.config.ts                 # NEW, at controller/ root, next to next.config.js
```

### Pattern 1: Direct gRPC send, bypassing the queue (D-05, D-06)
**What:** `Tool.controlCommand` is a thin sibling of the existing instance `executeCommand`, not a
call into it. It skips variable substitution, the pf400/opentrons2/script special-casing, and
`commands.complete()` — it only builds the payload and awaits the gRPC call.
**When to use:** Any operator-initiated out-of-band control that must never be enqueued, stored as a
step, or awaited by the busy loop.
**Example (adapted from the existing instance `executeCommand`, `tools.ts:350-590`):**
```typescript
// Source: controller/server/tools.ts:350, 540 (existing pattern, read this session)
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
  const reply = await this.grpc.executeCommand(payload); // same stub, no gRPC deadline (confirmed:
                                                           // promisifyGrpcCall passes no CallOptions,
                                                           // server/utils/promisifyGrpcCall.ts:19-32)
  return {
    ok: reply.response === tool_base.ResponseCode.SUCCESS,
    response: reply.response,
    message: reply.error_message,
  };
}
```

### Pattern 2: `_payloadForCommand` already builds the fast `Command` oneof shape
**What:** The existing helper builds `{ [toolType]: { [command]: params } }` — this is exactly the
shape `fast.Command`'s `oneof command { ... pause = N; ... }` needs once `Pause` exists.
**Verified today (fast.proto, read this session, vendor submodule `7e42f2e` **and** the sibling
`galago-tools` working tree — identical in both):**
```protobuf
// Source: vendor/galago-tools/interfaces/tools/grpc_interfaces/fast.proto (read this session)
message Command {
  oneof command {
    Transfer transfer = 1;
    RunProtocol run_protocol = 2;
    ValidateProtocol validate_protocol = 3;
    GetStatus get_status = 4;
    GetTipStatus get_tip_status = 5;
    ScanTips scan_tips = 6;
    EjectTray eject_tray = 7;
    Abort abort = 8;
    Resume resume = 9;
  }
  // ... Abort { optional string return_liquid = 1; }  Resume { optional string is_tip_broken = 1; }
  // NO Pause message exists yet — confirmed by direct read, this session.
}
```
`Tool.controlCommand("pause", {})` would, once `Pause` is added at the next free field number (`10`),
produce `{ fast: { pause: {} } }` via the unmodified `_payloadForCommand`, since the F.A.S.T.
`runControl` entry declares `pause: {}` (no decision, D-05 of the governing design — soft pause only).

### Pattern 3: `extractRunState` as the one Struct-reading seam (D-13)
**Verified today (tool_base.proto, read this session, identical in vendor submodule and sibling repo):**
```protobuf
// Source: vendor/galago-tools/interfaces/tools/grpc_interfaces/tool_base.proto:128-132 (read this session)
message StatusReply {
  int32 uptime = 1;
  ToolStatus status = 2;
  optional string error_message = 3;
}
// NO run_state field exists yet — confirmed by direct read, this session.
```
Once `optional google.protobuf.Struct run_state = 4;` is added and regenerated, ts-proto's existing
convention for the sibling `meta_data` Struct field on `ExecuteCommandReply` shows exactly what shape
to expect — confirmed by reading the generated output this session:
```typescript
// Source: controller/gen-interfaces/tools/grpc_interfaces/tool_base.ts:274, 1217 (read this session)
meta_data: { [key: string]: any } | undefined;
// decode path: message.meta_data = Struct.unwrap(Struct.decode(reader, reader.uint32()));
```
`run_state` will decode identically: `run_state?: { [key: string]: any }`, already unwrapped to a
plain object by ts-proto's generated `Struct.unwrap` — no manual protobuf `Struct` handling is ever
needed in `extractRunState`, `[VERIFIED: gen-interfaces/tools/grpc_interfaces/tool_base.ts, lines
quoted above, read this session]`. Before QUE-06 regenerates, `extractRunState` must read
`(statusReply as any).run_state` defensively (D-13) since the generated type has no such field yet.

### Pattern 4: tRPC error conventions already established in this codebase
**Verified today — every other non-trivial router already uses this exact shape** (`inventory.ts`,
`hub.ts`, `form.ts`, `robot-arm.ts` — 40+ call sites found this session via `grep -rn "TRPCError"
controller/server/`):
```typescript
// Source: controller/server/routers/hub.ts:163 (pattern repeated throughout the codebase)
import { TRPCError } from "@trpc/server";
throw new TRPCError({ code: "NOT_FOUND", message: "Hub item not found" });
```
`commandQueue.toolControl` should follow this identically — `PRECONDITION_FAILED` for "no running
step" / "tool has no `runControl` entry" (D-03a/b), `BAD_REQUEST` for "action not declared" / "blank
or unclear decision" (D-03c/d). No existing router in this codebase builds a custom error shape for
this kind of validation — `TRPCError` with `code`+`message` is the house style, not an exception to
match.

### Anti-Patterns to Avoid
(Carried forward unchanged from `.planning/research/ARCHITECTURE.md` and `PITFALLS.md` — do not
re-derive, they remain authoritative for this phase: Anti-Pattern 1 "route `tool_paused` through
`CommandQueue`'s modal plumbing" is Phase 2's concern but the underlying reason — `_messageResolve`
resolves a *different* promise than the one the busy loop is awaiting during a real tool step — is
exactly why `toolControl` in this phase must never touch `_isWaitingForInput`/`_messageResolve`/
`_ensureModalReady` either. Anti-Pattern 2 "give control commands a gRPC deadline" applies directly:
`Tool.controlCommand` must reuse the undecorated `this.grpc.executeCommand` call with no
`CallOptions`, confirmed this session that `promisifyGrpcCall` passes none by default.)

- **Reading the `STARTED` row back from `SqliteQueue` instead of keeping an in-memory record (D-01):**
  confirmed this session — `SqliteQueue.startNext()` (`utils/SqliteQueue.ts:112-150`) sets
  `status: "STARTED"` via `_updateItem` but no method in the file queries for "the one STARTED row";
  `find`/`all`/`getPaginated` all require an id or return everything. Building that accessor against
  SQLite (rather than keeping `CommandQueue._runningStep` in memory, per D-01) would survive a crash
  with a stale `STARTED` row — exactly what D-01 says to avoid.
- **Wiring the poller to a `setInterval` that isn't cleared in every exit path:** the busy loop's
  `try/catch` (`command_queue.ts:684-1053`) already has three ways a step execution can end: normal
  completion (line 1015), the `Tool Box` inline branches' `continue` (none of which apply to real tool
  steps), and the `catch` block (line 1023) on failure. The poller's start/stop must bracket
  `executeCommand` with a `finally`, not just the happy path, or a failed/aborted step leaves a
  dangling 2 s interval forever polling a tool no step is tracking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| gRPC Struct (de)serialization for `run_state` | A manual JSON-to-protobuf-Struct encoder/decoder | ts-proto's generated `Struct.wrap`/`Struct.unwrap`, already used for `meta_data` | `[VERIFIED: gen-interfaces/google/protobuf/struct.ts + tool_base.ts, read this session]` — this is already free once QUE-06 regenerates; hand-rolling it would duplicate logic ts-proto already emits |
| tRPC error shapes | A custom `{success, error}` return envelope for refusals | `TRPCError({code, message})`, the house convention in every other router | Confirmed via `grep` this session: zero routers in this codebase use a custom error envelope instead of `TRPCError` |
| Path-alias resolution for Vitest | Manual `moduleNameMapper`-style regex config, hand-maintained against `tsconfig.json` | `vite-tsconfig-paths` plugin, reads `tsconfig.json` directly | Keeps the alias map in exactly one place (`tsconfig.json`) instead of two that can drift |
| Mocking `better-sqlite3`/drizzle for unit tests | A fake in-memory SQL engine | `vi.mock("@/db/client", ...)` / `vi.mock("@/server/logger", ...)` — replace the whole module, since `CommandQueue`/`Tool`'s logic under test never needs a real DB | The DB is only used for `logAction` audit writes and variable substitution in this phase's test scope (refusals, running-step lifecycle, heartbeat retry) — none of which need real persistence |

**Key insight:** Every "new" piece of plumbing in this phase (gRPC payload shape, Struct handling,
tRPC error convention) already has an established, working precedent elsewhere in this exact
codebase. The only genuinely new technology decision is the test runner itself.

## Common Pitfalls

(The project's own `PITFALLS.md`, read in full this session, already covers the ten
milestone-level pitfalls in depth with file:line citations — reused, not reproduced here. The three
below are specific to *this phase's* scope, QUE-01–QUE-06, that the milestone-level document treats
more briefly or as a Phase-6-generic concern.)

### Pitfall 1: The "running step" record silently going stale across the `Tool Box` inline branches
**What goes wrong:** The busy loop's `if (nextCommand.commandInfo.toolId === "Tool Box")` block (lines
747-1012) handles `pause`/`user_form`/`show_message`/`timer`/`note`/`stop_run`/`goto`/
`variable_assignment` — eight `continue`s that never reach the line 1015 `executeCommand` call. If the
`runningStep` set/clear is implemented as a blanket wrapper around the *entire* loop body instead of
scoped tightly to the `executeCommand(nextCommand)` call (line 1015) alone, a `Tool Box` command could
be seen by `toolControl` as "a step is running" when it is a built-in, not a controllable tool step
(violates D-02: "Only real tool steps set the record").
**Why it happens:** The loop body has one early `try`, and the natural refactor is to wrap the whole
`try` block rather than isolate the single line that calls out to an actual tool.
**How to avoid:** Set `_runningStep` immediately before, and clear it in a `finally` immediately
after, the `await this.executeCommand(nextCommand)` call at line 1015 specifically — not around the
`Tool Box` branches above it.
**Warning signs:** A test asserting `toolControl` refuses during a `user_form`/`timer`/`pause`
Tool-Box command would catch this; if no such test exists, the bug ships silently since the branches
`continue` quickly in normal operation.

### Pitfall 2: Treating `vitest`'s "too-new" legitimacy flag as a reason to skip the package-legitimacy gate entirely
**What goes wrong:** Both `vitest` and `vite` were flagged `SUS` (`too-new`) by this session's
legitimacy check, purely because their *latest* published version is from the last few days — a
property of their release cadence, not their trustworthiness (125M and 196M weekly downloads
respectively, canonical GitHub repos). It is tempting for an implementer to read this as "the gate is
obviously wrong here" and skip the required `checkpoint:human-verify` for both installs.
**Why it happens:** The `too-new` heuristic checks the latest version's publish timestamp, which for
a frequently-released package is always recent, regardless of the package's actual age or trust
level.
**How to avoid:** Keep the `checkpoint:human-verify` gate anyway — it costs one confirmation, and the
alternative (quietly trusting any "looks legitimate to me" judgment call) is exactly the failure mode
the gate exists to prevent. If the recency flag itself is undesirable, pin an older minor
(`vitest@2.1.9`, `[VERIFIED: npm registry]` exists, has a much older latest-publish date and a looser
peer/engine range) instead of arguing the gate's verdict away.
**Warning signs:** A plan or PR installs `vitest`/`vite` without a `checkpoint:human-verify` task
preceding it.

### Pitfall 3: Mocking `@/db/client` after other test files have already imported it
**What goes wrong:** `controller/db/client.ts` runs migrations and creates a real SQLite file
(`data/app.db`) as an **import-time side effect** — confirmed this session by reading the file: it
calls `new Database(dbPath)` and `migrate(...)` unconditionally at module scope (guarded only by
`typeof window === "undefined"`, which is true in a Vitest Node environment). `controller/server/
logger.ts` (`logAction`) imports `@/db/client` directly, and `command_queue.ts`/`tools.ts` both import
`logAction` from `./logger`. If a test file imports `command_queue.ts` before `vi.mock("@/db/client",
...)` is hoisted and applied, or if two test files in the same run share module state and only one of
them mocks it, a real `data/app.db` gets created and migrated as a side effect of running unit tests.
**Why it happens:** Vitest hoists `vi.mock()` calls automatically for *statically* imported modules in
the *same file*, but this guarantee doesn't extend across files sharing a module registry unless each
test file declares its own mock, or a global `setupFiles` entry mocks it once for every test.
**How to avoid:** Add `vi.mock("@/db/client", () => ({ db: { select: vi.fn(), insert: vi.fn(), ... }
}))` and `vi.mock("@/server/logger", () => ({ logAction: vi.fn() }))` in a shared `setupFiles` entry in
`vitest.config.ts`, not per-test-file, so no test can accidentally skip it.
**Warning signs:** A `data/app.db` file with a very recent mtime after running `npm run test:unit`
(or whatever the new script is named); console output showing "📁 Created data directory" or
"🔄 Running database migrations..." during a unit-test run (both are literal `console.log` lines in
`db/client.ts`, confirmed this session).

## Code Examples

### `runControl` capability map (D-09, shape taken verbatim from CONTEXT.md and the governing design §6.1)
```typescript
// Source: design doc §6.1 example + CONTEXT.md D-09 (verbatim shape), new file
// controller/server/runControl.ts (or alongside commandFields in components/tools/constants.ts)
export const runControl: Record<string, Record<string, Record<string, "yesno">>> = {
  fast: {
    pause: {},
    resume: { is_tip_broken: "yesno" },
    abort: { return_liquid: "yesno" },
  },
};
```
Note: this is a **separate map from `commandFields`** (D-09) — `commandFields.fast.abort`/`.resume`
(verified this session at `components/tools/constants.ts:345-346`) are left untouched in this phase
(D-10); removing them from the step editor is explicitly Phase 2's UI-07, not this phase's concern.

### `toolControl` tRPC procedure skeleton (D-03, D-06, D-07)
```typescript
// Source: pattern assembled from routers/command_queue.ts's existing style (read this session)
// and routers/hub.ts's TRPCError convention (read this session)
toolControl: procedure
  .input(z.object({ action: z.string(), params: z.record(z.string()) }))
  .mutation(async ({ input }) => {
    const running = CommandQueue.global.runningStep; // NEW accessor, D-01
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
    const tool = getToolForRunningStep(running); // existing getGlobalStore/getToolFromStore lookup
    const result = await tool.controlCommand(input.action, input.params); // D-05
    await logAction({
      level: result.ok ? "info" : "warning",
      action: "Tool Control",
      details: `toolControl action=${input.action} tool=${running.toolId} queueId=${running.queueId} ` +
        `runId=${running.runId} params=${JSON.stringify(input.params)} outcome=${result.ok ? "ok" : "refused"}`,
    }); // D-07
    return result; // { ok, response, message } — D-06, never thrown for a non-SUCCESS reply
  }),
```

### Heartbeat retry fix (D-15, D-16) — minimal diff against the confirmed-buggy existing code
```typescript
// Current (confirmed this session, tools.ts:99-111):
async fetchStatus() {
  try {
    const statusReply = await this.grpc.getStatus({});
    this.status = statusReply.status;
    this.uptime = statusReply.uptime;
    return statusReply;
  } catch (e) {
    console.error(`Failed to fetch status for tool ${this.toolId}: ${e}`);
    this.status = ToolStatus.UNKNOWN_STATUS;
    this.stopHeartbeat();  // <-- THE BUG: stops the interval forever after ONE failure
    return { uptime: 0, status: ToolStatus.UNKNOWN_STATUS } as tool_base.StatusReply;
  }
}

// Fixed (D-15, D-16):
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
    // no stopHeartbeat() call — the interval keeps its normal cadence (D-15)
    return { uptime: 0, status: ToolStatus.UNKNOWN_STATUS } as tool_base.StatusReply;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `Tool.fetchStatus` stops the heartbeat on the first failed poll | Retries indefinitely with a consecutive-failure counter, de-duplicated logging | This phase (QUE-05) | Any tool's heartbeat (not just F.A.S.T.'s) becomes resilient to a single transient gRPC hiccup — a pre-existing latent bug across all ~20 tool types, confirmed by direct code read, not introduced by this milestone |
| Recovery (`abort`/`resume`) only reachable as planned protocol steps or via the tool page's Send Command form | Live, out-of-band `toolControl` reaching the running step's tool directly | This phase (QUE-01) + Phase 2 UI | Matches the governing design's stated problem (§1): neither pattern fits "the natural reaction when a run pauses in front of you" |

**Deprecated/outdated:** none specific to this phase — `commandFields.fast.abort`/`.resume` stay in
place through this phase (D-10); their step-editor removal is Phase 2's UI-07, not deprecated yet.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "too-new" SUS verdict on `vitest`/`vite` is a cadence artifact, not a real legitimacy concern | Package Legitimacy Audit, Pitfall 2 | Low — the protocol's own fallback (keep the checkpoint regardless) already covers the case this assumption is wrong; no plan step depends on treating them as `[OK]` |
| A2 | `vitest@5.0.4` (or `2.1.9`) will work against this `tsconfig.json`'s `isolatedModules`/`noUnusedLocals`/`strict` settings without further config beyond `vite-tsconfig-paths` | Standard Stack, Validation Architecture | Medium — if it doesn't, D-20's explicit fallback (`node:test` + `tsx`) is the documented escape hatch; worth a short spike at the start of the first plan that touches testing, before committing to one path across the whole phase |
| A3 | `getToolForRunningStep` (the lookup from a `runningStep` record to a live `Tool` instance) can reuse the existing `getGlobalStore`/`getToolFromStore` pair unmodified | Code Examples (`toolControl` skeleton) | Low — both are already exported-equivalent patterns used by every other command-dispatch path in `tools.ts`; worst case is a one-line adapter, not a redesign |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Exact home for the `runControl` map: `constants.ts` vs. a new `runControl.ts`?**
   - What we know: CONTEXT.md D-09 explicitly leaves this to Claude's discretion ("a sibling
     `runControl.ts` if that is cleaner for server import").
   - What's unclear: `components/tools/constants.ts` is under `components/`, a client-ish directory
     by Next.js convention, even though nothing in it is React-specific; importing it from
     `server/routers/command_queue.ts` works today (Next.js doesn't enforce a server/client boundary
     on plain `.ts` modules outside `"use server"`/`"use client"` files) but mixing a server-only
     validation map into a `components/` file reads awkwardly.
   - Recommendation: put `runControl` in a new `server/runControl.ts` (co-located with the other
     server-side capability/validation code this phase adds), and have Phase 2's UI import it from
     there too — there is no existing precedent in this codebase for a `components/` file being
     imported by a tRPC router, so avoid creating the first one.

2. **Whether to pin `vitest@5.0.4` or `vitest@2.1.9`.**
   - What we know: both exist and are compatible with `node v24.14.1`; 5.x is current, 2.x is the
     long-proven line with a much older, unflagged latest-publish date.
   - What's unclear: whether this specific Next 13.1.2 / TypeScript 5.5.3 / `tsconfig.json` setup has
     any edge case that only shows up on one major version — not something research alone can settle
     without actually running it.
   - Recommendation: the first plan that stands up Vitest should treat "does `npx vitest run` pass a
     trivial smoke test importing `@/types`" as its first verification step, before writing the real
     `CommandQueue`/`Tool` specs — if it fails on 5.x, fall back to 2.x before investing further.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything in `controller/` | ✓ (via nvm, not default `PATH`) | v24.14.1 at `~/.nvm/versions/node/v24.14.1/bin` | Plans must `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"` (or equivalent) before any `node`/`npm`/`npx` command — confirmed this session that `node`/`npm` are absent from the default shell `PATH` |
| `npm` | Installing `vitest`/`vite-tsconfig-paths` | ✓ | 11.11.0 | — |
| `python3` + `grpc_tools` | QUE-06's `bin/make proto_ts` | ✓ | `libprotoc 29.0` via system `python3` | — |
| Global `ts-proto@1.151.1` | QUE-06's `bin/make proto_ts` (codegen plugin resolution) | ✗ | not installed — `npm list -g` shows none, confirmed this session | Must run `npm install -g ts-proto@1.151.1 grpc-tools@1.12.4` (or `bin/make deps`, heavier) as an explicit QUE-06 plan step before `bin/make proto_ts` |
| `vitest`/`vite`/`jest` in `node_modules` | D-20's unit-test requirement | ✗ | none installed | Install per Package Legitimacy Audit, gated on `checkpoint:human-verify` |
| galago-tools `run_state`/`Pause` proto commit | QUE-06 | ✗ | sibling repo `feat/fast-tool` HEAD is `aa88874` (confirmed this session via `git log`), vendor submodule pinned to `7e42f2e` — neither has the proto change | Phase pauses at the QUE-06 checkpoint until the sibling repo lands the commit (D-18/D-19); nothing else in this phase depends on it |

**Missing dependencies with no fallback:**
- The galago-tools proto commit for QUE-06 — there is no workaround other than waiting (D-18/D-19
  already establish this is expected and the phase is designed to tolerate it).

**Missing dependencies with fallback:**
- Global `ts-proto@1.151.1` — installable in one command, not yet done.
- `vitest`/`vite-tsconfig-paths` — installable, gated on a `checkpoint:human-verify` per the legitimacy
  audit.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `5.0.4` (or `2.1.9`, see Open Question 2) — **not yet installed** |
| Config file | `controller/vitest.config.ts` — none exists yet (Wave 0 gap) |
| Quick run command | `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" && cd controller && npx vitest run <file>` |
| Full suite command | `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" && cd controller && npx vitest run` |

`tsc --noEmit` (today's `npm test`) stays the final gate per D-20 — Vitest is additive, not a
replacement.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| QUE-01 | `toolControl` reaches the tool while `executeCommand` is pending; busy loop's own promise is unaffected | unit (mocked `Tool`) | `npx vitest run test/command_queue.test.ts -t "reaches the tool"` | ❌ Wave 0 |
| QUE-01 | Every `toolControl` attempt is logged via `logAction`, including refusals (D-07) | unit (mocked `logAction`) | `npx vitest run test/command_queue.test.ts -t "logs"` | ❌ Wave 0 |
| QUE-02 | `toolControl` refuses: no running step / no `runControl` entry / undeclared action / blank decision | unit | `npx vitest run test/command_queue.test.ts -t "refuses"` | ❌ Wave 0 |
| QUE-02 | Queue exposes a `runningStep` accessor reflecting the `STARTED` command | unit | `npx vitest run test/command_queue.test.ts -t "runningStep"` | ❌ Wave 0 |
| QUE-03 | `runControl` map has the exact F.A.S.T. shape (`pause: {}`, `resume: {is_tip_broken}`, `abort: {return_liquid}`) | unit (plain assertion, no mocks) | `npx vitest run test/runControl.test.ts` | ❌ Wave 0 |
| QUE-04 | `runState` returns `{running: false}` with no running step; a stable envelope otherwise; independent of `modalState` | unit | `npx vitest run test/command_queue.test.ts -t "runState"` | ❌ Wave 0 |
| QUE-05 | A failed `fetchStatus` poll leaves the heartbeat interval scheduled (not stopped) | unit (fake timers) | `npx vitest run test/tools.test.ts -t "heartbeat"` | ❌ Wave 0 |
| QUE-06 | Regenerated interfaces include `run_state`/`Pause`; `tsc --noEmit` is 0 errors | type-check only (no unit test) | `npx tsc --noEmit` | N/A — gate, not a test file |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <file> -t "<name>"` for the behavior just implemented.
- **Per wave merge:** `npx vitest run` (full suite) + `npx tsc --noEmit`.
- **Phase gate:** full Vitest suite green AND `tsc --noEmit` at 0 errors before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `controller/vitest.config.ts` — framework install + config, including `vite-tsconfig-paths`
      plugin registration and a `setupFiles` entry that mocks `@/db/client` and `@/server/logger`
      globally (see Pitfall 3).
- [ ] `controller/test/command_queue.test.ts` — covers QUE-01, QUE-02, QUE-04.
- [ ] `controller/test/tools.test.ts` — covers QUE-05.
- [ ] `controller/test/runControl.test.ts` — covers QUE-03.
- [ ] Framework install: `npm install -D vitest vite-tsconfig-paths` (gated on
      `checkpoint:human-verify` per the Package Legitimacy Audit).
- [ ] A fake/mock `Tool`/`ToolDriverClient` test double — D-19 requires "a mocked gRPC client, never
      a real tool"; no such fixture exists yet anywhere in the codebase (confirmed by the absence of
      any `__mocks__`/`test`/`tests` directory under `controller/`, checked this session).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | This app has no user/auth model (confirmed in CONTEXT.md D-07: "No operator identity exists in the app"); out of scope for this phase by explicit project decision |
| V3 Session Management | No | Same as above |
| V4 Access Control | No | Same as above — `toolControl` is reachable by anyone who can reach the tRPC endpoint, matching the rest of this app's existing trust model (every other mutation in `commandQueueRouter` is equally unauthenticated) |
| V5 Input Validation | Yes | D-03's refusal rules (no running step / no `runControl` entry / undeclared action / blank-or-not-"yes"/"no" decision) are exactly V5-style server-side input validation, enforced with `TRPCError`, not client trust |
| V6 Cryptography | No | No cryptographic material is introduced by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Fail-open decision validation (a blank or unexpected decision value silently defaults to a safe-looking choice) | Tampering / Elevation of Privilege (the "elevation" here is software silently making a physical decision for the operator, violating the design's core invariant) | Fail closed: anything other than exactly `"yes"`/`"no"` is rejected with `BAD_REQUEST` (D-03d) — never defaulted |
| Optimistic UI state on `toolControl` (reported in `PITFALLS.md`'s Security Mistakes table) | Repudiation (operator unsure whether a command was actually sent) | D-06: `toolControl` returns a structured, synchronous result; the UI (Phase 2) must never optimistically update before the mutation resolves |
| A control command silently reaching the wrong tool (e.g. a stale `runningStep` reference) | Spoofing (of "which tool is this command for") | `runningStep` is read fresh from `CommandQueue` state at the start of each `toolControl` call (D-01); never cached client-side across calls |

## Sources

### Primary (HIGH confidence — direct code reads this session)
- `controller/server/command_queue.ts` — full file read; busy loop (`_runBusyLoopWhileQueueNotEmpty`,
  line 672), tool-step dispatch (line 1015), `UIMessage`/`_messageResolve` pattern (lines 25-567),
  `_runningPromise`/`stop()` (lines 611-670).
- `controller/server/tools.ts` — full file read; `Tool` class, `fetchStatus` (lines 99-111),
  `_payloadForCommand` (lines 325-331), instance `executeCommand` (lines 350-590),
  `promisifyGrpcClient`/`getGlobalStore`/`getToolFromStore` (lines 28-54).
- `controller/server/routers/command_queue.ts` — full file read; existing procedure shapes, confirmed
  no `toolControl`/`runState` procedure exists yet.
- `controller/server/utils/SqliteQueue.ts` — full file read; `startNext()` (lines 112-150) confirmed
  sets `STARTED` with no read-back accessor.
- `controller/server/trpc.ts` — full file read; confirmed `procedure`/`router` exports, SuperJSON
  transformer, no custom error formatting beyond Zod.
- `controller/server/routers/{inventory,hub,form,robot-arm}.ts` — `grep -rn "TRPCError"` (40+ hits)
  confirming the house error convention.
- `controller/components/tools/constants.ts:290-348` — `commandFields.fast` entry, confirmed
  `abort`/`resume` at lines 345-346, no `pause` entry.
- `controller/db/client.ts` — full file read; confirmed import-time migration side effect.
- `controller/server/logger.ts` — full file read; confirmed `logAction` imports `@/db/client`.
- `controller/gen-interfaces/tools/grpc_interfaces/tool_base.ts` — confirmed `meta_data` Struct
  pattern (lines 274, 1178-1255) and `ToolStatus` string-enum values (lines 123-133).
- `controller/gen-interfaces/google/protobuf/struct.ts` — confirmed `Struct` interface shape.
- `controller/gen-interfaces/controller.ts` — confirmed `ToolType.fast` exists.
- `controller/types/run.ts` — full file read; `ToolCommandInfo`/`RunCommand`/`StoredRunCommand` shapes.
- `controller/server/utils/promisifyGrpcCall.ts` — full file read; confirmed no default `CallOptions`.
- `bin/make` — full file read; `proto_ts` target (global `protoc-gen-ts_proto` resolution, no
  `node_modules/.bin` reference), `deps` target (`npm install -g grpc-tools@1.12.4 ts-proto@1.151.1`).
- `vendor/galago-tools/interfaces/tools/grpc_interfaces/tool_base.proto` and `fast.proto` — read in
  full; confirmed no `run_state` field, no `Pause` message, at the pinned submodule commit `7e42f2e`.
- `/home/formulatrix/data/nikko/galago-tools/interfaces/tools/grpc_interfaces/{tool_base,fast}.proto`
  (sibling working repo, not just the vendor pin) — read in full; identical absence confirmed
  independently of the vendor submodule checkout.
- `/home/formulatrix/data/nikko/galago-tools` — `git log --oneline -5`, confirmed `feat/fast-tool`
  HEAD is `aa88874` (code) + `14fa9f8` (a docs-only commit on top), matching CONTEXT.md D-18.
- `controller/package.json`, `controller/tsconfig.json`, `controller/next.config.js` — confirmed
  `npm test` = `tsc --noEmit`, no `vitest`/`jest` devDependency, `node` not on default `PATH`
  (`node: command not found` without the nvm `PATH` export), path aliases `@/*`/`gen-interfaces/*`.
- `.planning/config.json` — confirmed `nyquist_validation: true`, `security_enforcement: true`,
  `security_asvs_level: 1`.
- `npm view vitest version`, `npm view vitest@5.0.4 engines peerDependencies`, `npm view vitest@2
  engines`, `npm view vite-tsconfig-paths version`, `npm view ts-proto@1.151.1 version` — run this
  session against the live npm registry.
- `gsd_run query package-legitimacy check --ecosystem npm vitest vite vite-tsconfig-paths` — run this
  session.
- `python3 -m grpc_tools.protoc --version` — confirmed `libprotoc 29.0` available via system Python.

### Secondary (MEDIUM confidence)
- `.planning/research/{ARCHITECTURE,PITFALLS,STACK}.md` — prior-milestone research, explicitly
  reused per the task's instruction not to redo it; cross-checked spot claims (e.g. `meta_data`
  Struct shape, `promisifyGrpcCall`'s lack of a deadline) against the actual files this session and
  found them accurate.
- `galago-tools/docs/specs/2026-10-12-galago-live-run-control-design.md` — governing design, read in
  full; cross-checked against code where the design makes a factual claim about the current
  implementation (e.g. §5.1's concurrency assumption, already flagged as contradicted by
  `ARCHITECTURE.md`'s own research — not re-litigated here, out of this phase's scope which is
  galago-core only).

### Tertiary (LOW confidence)
- The "too-new is a cadence artifact, not a real concern" interpretation of the `vitest`/`vite` `SUS`
  verdicts (Assumption A1) — a reasonable inference from the download/repo signals, not independently
  confirmed against a second legitimacy source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every runtime library already in use is `[VERIFIED]` by direct file read;
  the two new test-tooling packages are `[VERIFIED: npm registry]` to exist and have the stated
  engine/peer requirements, with provenance correctly downgraded to `[ASSUMED]`-adjacent `SUS` per the
  legitimacy gate (see Package Legitimacy Audit).
- Architecture: HIGH — the integration points, data flow, and file:line citations are reused from the
  prior milestone's `ARCHITECTURE.md` (itself HIGH confidence, traced against code) and independently
  re-confirmed this session by reading the same files.
- Pitfalls: HIGH for the three phase-specific pitfalls added here (each grounded in a file read this
  session); HIGH for the ten reused milestone-level pitfalls (already file:line-cited in the source
  document).
- QUE-06 proto gate: HIGH — confirmed independently in two locations (vendor submodule pin and the
  sibling repo's live working tree) that neither `run_state` nor `Pause` exists yet.

**Research date:** 2026-10-12
**Valid until:** 7 days for the QUE-06 gate status (the sibling repo's proto commit could land at any
time — re-check `vendor/galago-tools`'s pinned SHA and the sibling repo's `tool_base.proto`/`fast.proto`
immediately before starting the QUE-06 plan); 30 days for everything else (stable, already-vendored
dependencies and in-repo code patterns).
