# Phase 1: Queue Control Path & Run State - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 1-Queue Control Path & Run State
**Areas discussed:** Running-step targeting, Control reply handling, runControl declaration, Run-state source & shape, Heartbeat retry, QUE-06 sequencing, Test approach
**Mode:** `--auto`. Each choice is Claude's recommended option; no user input was given.

---

## Running-step targeting

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory record on CommandQueue | Set before the tool's executeCommand, cleared in finally; empty after restart | ✓ |
| Read STARTED row from SqliteQueue | Persistent, but can be stale after a crash or restart | |

**Choice:** [auto] In-memory record. It matches design §8: no running step after a restart.

## Control reply handling

| Option | Description | Selected |
|--------|-------------|----------|
| Structured `{ok, response, message}` result | Refused reason reaches the UI intact | ✓ |
| Throw ToolCommandExecutionError | Reuses existing error path; loses the distinction for the UI | |

**Choice:** [auto] Structured result. Transport errors still throw.

## runControl declaration

| Option | Description | Selected |
|--------|-------------|----------|
| Separate `runControl` map next to commandFields | One source for server validation and the Phase 2 UI | ✓ |
| Flag inside commandFields | Mixes step-editor and live-control concerns (against D3/D6) | |

**Choice:** [auto] A separate map. Pause has no `hard` decision (D5). The `commandFields` abort/resume entries stay until Phase 2.

## Run-state source & shape

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side 2 s poller with cache; `runState` reads the cache | One gRPC poll regardless of tab count; lifecycle tied to the step | ✓ |
| On-demand gRPC per `runState` query | Simpler; N tabs mean N polls | |

**Choice:** [auto] Server-side poller. The envelope includes `queueId` for Phase 2 correlation (Pitfall 9).

## Heartbeat retry

| Option | Description | Selected |
|--------|-------------|----------|
| Never stop on failure, for all tools, same interval, de-duplicated logs | Matches QUE-05 wording | ✓ |
| Retry only during controllable steps | Narrower; leaves the generic bug | |
| Exponential backoff | More complex; not needed at this scale | |

**Choice:** [auto] Never stop, for all tools.

## QUE-06 sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Last plan, gated on the galago-tools proto commit; earlier work mocked | Unblocks QUE-01..05 now | ✓ |
| Hand-edit generated interfaces | Drifts from codegen | |

**Choice:** [auto] Last plan, gated on that commit. The galago-tools proto has no `run_state` yet (head `aa88874`).

## Test approach

| Option | Description | Selected |
|--------|-------------|----------|
| Add vitest for server unit tests with a mocked gRPC client | Covers the design §9 cases | ✓ |
| `node:test` + `tsx` | Fallback if vitest fights the setup | |
| tsc only | Can't show the refusal or retry behaviour | |

**Choice:** [auto] vitest, with `node:test` as the planner's fallback.

## Claude's Discretion

- Names, the `runControl` file split, where the poller lives, and exact tRPC error codes and wording.

## Deferred Ideas

- Combined run-page query (Phase 2), hard pause (D5), operator identity in logs, F5/F3 debt.
