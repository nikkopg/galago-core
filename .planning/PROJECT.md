# galago-core (nikkopg fork) — Live Run Control

## What This Is

The `nikkopg/galago-core` fork of `sciencecorp/galago-core`: Galago's Next.js + tRPC web app
(`controller/`) that schedules workcell protocols, runs them through its command queue and talks to
tool servers over gRPC. This GSD project covers the queue, tRPC and run-page work that lets an
operator control a running instrument step live. The F.A.S.T. tool server it controls is planned
in the galago-tools fork's own GSD project.

## Core Value

While an instrument step runs, the operator sees what the instrument is doing and decides every
recovery action themselves: the web app never pauses, resumes or aborts an instrument on its own,
and never pre-selects a physical decision for the operator.

## Current Milestone: v1 Live Run Control (queue & run page)

**Goal:** From the run page, the operator can pause, resume and abort a running controllable step,
an instrument-initiated pause becomes a prompt with the instrument's reason, and Stop never leaves
an instrument run untracked.

**Governing design:** galago-tools `docs/specs/2026-10-12-galago-live-run-control-design.md`
(decisions D1-D6 in §11; §6.3 and §6.6 carry the research corrections about the queue's blocking
modals and the auto-confirming `StopRunModal`).

**Companion milestone:** galago-tools `.planning/` — "F.A.S.T. Live Run Control (adapter &
rollout)". It provides `StatusReply.run_state` and the control commands; its final phase deploys
both and runs the supervised live acceptance.

**Target features:**
- `commandQueue.toolControl` tRPC path to the running step's tool, with a running-step accessor
- Generic `runControl` capability per tool type (F.A.S.T. first), separate from `commandFields`
- `commandQueue.runState` query (2 s polling) and a heartbeat that retries instead of stopping
- Run-page control bar, `tool_paused` modal, D4 Stop confirmation, step-editor cleanup

## Requirements

### Validated

<!-- Shipped on feat/fast-tool before this milestone. -->

- ✓ F.A.S.T. tool type registered with command forms (`ce8d40d`, `128bbd7`); generated interfaces
  from the galago-tools fork via the `vendor/galago-tools` submodule
- ✓ Production compose builds from local source with the SQLite volume, `GRPC_HOST` and
  `TOOLBOX_PORT` (`318ec7f`); deployed as `galago-web` on forb01 (`:3010`)

### Active

See `.planning/REQUIREMENTS.md` (QUE-*, UI-*).

### Out of Scope

- Software-initiated pause/resume/abort (on error, timeout, cancel, restart or reconnect)
- Hard pause (D5)
- F5 (the queue re-ran one non-idempotent `transfer` 3 times) and F3 (run UI hides tool errors) —
  tracked debt, out by user decision (2026-10-12), even though this milestone touches the same files
- Upstream PRs to `sciencecorp/galago-core`

## Context

- **Key code:** `controller/server/command_queue.ts` (busy loop, `_runningPromise`, `UIMessage`
  modals that resolve the step via `_messageResolve`), `controller/server/tools.ts` (`Tool` with one
  gRPC client per tool; `fetchStatus` stops the heartbeat after one failure),
  `controller/server/routers/command_queue.ts` (tRPC), `controller/components/runs/`
  (`RunsComponent.tsx`, `PauseModal`, `StopRunModal` — which auto-confirms after a 5 s countdown).
- **No gRPC deadline** on `executeCommand`, so a step can stay open through a long pause.
- **Codegen:** `bin/make proto_ts` with ts-proto **1.151.1** (the local `node_modules` 1.153.2
  generates a broken `tool_base.ts`); Node via nvm (`~/.nvm/versions/node/v24.14.1/bin`).
- **Build:** `.dockerignore` keeps host `controller/node_modules` out of the image (host-built
  native modules broke `better-sqlite3`).
- **Gate:** `tsc --noEmit` in `controller/` — 0 errors as of 2026-10-09.
- **Research:** `.planning/research/` (copied from the fast-mcp planning, 2026-10-12; cross-repo).

## Constraints

- **Never reuse auto-confirming UI** for instrument decisions (`StopRunModal`'s countdown)
- **`tool_paused` is not a `UIMessage`** — it must not resolve or block the busy loop
- **Choices non-defaulted** — two-option choices with nothing preselected; actions disabled until
  chosen; dismissing a confirmation means Cancel
- **No state checks** in galago-core — the fast-mcp core gates every action

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Plan the Galago side per repo (galago-core: queue + UI; galago-tools: adapter + rollout) | Clearer separation; each repo plans the code it changes | — Pending |
| D2 2 s run-state polling; D3 abort/resume out of the step editor; D4 Stop asks abort or cancel; D6 generic `runControl` | Settled 2026-10-12 | — Pending |
| `tool_paused` reads its own `runState` query, not the queue's modal state | The queue's modals block the busy loop; a pause happens inside an in-flight step | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-12 after project initialization (moved from fast-mcp planning)*
