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

## Current State

**Shipped:** v1 Live Run Control (queue & run page) — 2026-10-16 (Phases 1-2, 11 plans; tag `v1`).
From the run page the operator can pause, resume and abort a running F.A.S.T. step with explicit,
confirmed, non-defaulted decisions; an instrument pause opens a `tool_paused` prompt with the
reason; Stop, Clear All and deleting the running run abort the instrument first. A tool-page Run
Recovery card handles untracked runs. Archive: `milestones/v1-ROADMAP.md`,
`milestones/v1-REQUIREMENTS.md`.

**Governing design:** galago-tools `docs/specs/2026-10-12-galago-live-run-control-design.md`.
**Companion milestone:** galago-tools "F.A.S.T. Live Run Control (adapter & rollout)" — deploys both
and runs the supervised live acceptance.

## Current Milestone: v2 STACK tool support — codegen, operator acknowledge, error visibility, F5

**Goal:** galago-core can send every STACK command, shows every STACK error as an error, gives only the
operator an audited AcknowledgeFailure, and the root cause of F5 (a queued command executed more than
once) is fixed.

**Target features (build order):**
- DEP-03c (F5): root cause of a queued command executed more than once found and fixed (fast-mcp
  runbook `docs/runbooks/phase5-galago-live-run.md:495-530`); retry-after-failure unchanged
- DEP-03b (F3): the run UI shows a tool's `ERROR_FROM_TOOL` message; a STACK error never renders as
  success
- DEP-03a: operator-only STACK AcknowledgeFailure on the D-20 pattern (`tool.recoveryControl`, Run
  Recovery card): guid entry, explicit `"yes"` arm-inspected confirmation, audited, no timers, no
  default; latched guid shown from the error message or the latch-status read; never emitted by a
  protocol or the queue (the queue refuses a queued `stack.acknowledge_failure`)
- DEP-02: `vendor/galago-tools` bumped to the frozen `stack.proto` commit (galago-tools Phase 4),
  `gen-interfaces` regenerated with ts-proto 1.151.1, `commandFields.stack` for every command except
  `acknowledge_failure` (required strings as `text` fields with no `defaultValue`, no `select`
  pre-fills); gated on galago-tools Phase 4

**Companion:** galago-tools v2 "STACK Tool & STACK↔F.A.S.T. Handoff" (`feat/stack-tool`), which owns the
adapter, the GAL-02 runbook protocol and live acceptance (its Phase 7, supervised, user present).
stack-automation-layer core gaps are fixed there via `/gsd-quick`, never here.

**Carried, not in v2 scope:** F.A.S.T. plate-list dropdowns and `expected_tray_id` (pending todos);
02-REVIEW-DISPOSITION advisories WR-01..WR-04, IN-01.

## Requirements

### Validated

<!-- Shipped on feat/fast-tool before this milestone. -->

- ✓ F.A.S.T. tool type registered with command forms (`ce8d40d`, `128bbd7`); generated interfaces
  from the galago-tools fork via the `vendor/galago-tools` submodule
- ✓ Production compose builds from local source with the SQLite volume, `GRPC_HOST` and
  `TOOLBOX_PORT` (`318ec7f`); deployed as `galago-web` on forb01 (`:3010`)
- ✓ QUE-01..QUE-06 — v1: `commandQueue.toolControl` (operator Pause/Resume/Abort sent directly to the
  running step's tool, fail-closed `"yes"`/`"no"` decisions), the generic `runControl` map
  (`server/runControl.ts`), the `commandQueue.runState` query backed by a 2 s server-side poller, a
  heartbeat that keeps retrying, and interfaces regenerated from galago-tools `cb7886d` — Phase 1
- ✓ UI-01..UI-08 — v1: run-page control bar (state, percent, Pause/Resume/Abort as hints, never gates),
  one shared confirmation with non-defaulted yes/no decisions and a single confirmed-send path, the
  `tool_paused` prompt (reason, plain-language detail, start time; never touches the queue's modal
  plumbing), Stop/Clear All/delete-run routed through a no-timer abort-first dialog, fast
  abort/resume removed from the step editor, and a tool-page Run Recovery card backed by
  `tool.recoveryControl` — Phase 2 (UAT 9/9 against the redeployed galago-tools, 2026-10-15)
- ✓ QUE-07..QUE-09 (F5) — v2: single-flight Start guard as the first statement of
  `CommandQueue._start` (an ignored Start logs "Queue Start Ignored", changes nothing and shows a
  warning toast); the Start confirmation lists what will run, read-only, from queue-joined rows —
  Phase 3
- ✓ ERR-01..ERR-05 (F3) — v2: a tool's `ERROR_FROM_TOOL` message is thrown and persisted (SUCCESS
  with a message counts as an error), shown in a re-arming run-page banner, on the step card (beside
  the image, 3-line clamp, full text on hover) and in the run outcome; a skipped failure shows an
  orange "Skipped failure" badge, never success — Phase 3 (UAT 5/5, 2026-10-29)
- ✓ DEP-03a — v2: operator-only STACK AcknowledgeFailure — recovery-card acknowledge flow (guid
  entry, born-empty radios, verbatim guid restatement, audited single-send), an explicit Read Latch
  query (no polling), server-side attempt gating while a STACK step runs (refused with audit, card
  itself stays enabled), queue refuses a queued `stack.acknowledge_failure`, run creation refuses
  operator-only steps as BAD_REQUEST, and the STACK card presents only the actions STACK declares —
  Phase 4 (UAT 3/3 passed + 4 diagnosed gaps closed by plans 04-06/04-07, UAT complete 2026-10-30)

### Active

v2 requirements in `.planning/REQUIREMENTS.md`.

- [ ] STACK codegen and command forms (DEP-02)

### Out of Scope

- Software-initiated pause/resume/abort (on error, timeout, cancel, restart or reconnect)
- Hard pause (D5)
- Any code path that acknowledges, cancels, retries or parks the STACK on its own — every recovery
  action is an operator decision
- STACK or F.A.S.T. motion from tests — live runs only in galago-tools' supervised Phase 7
- GAL-02 protocol authoring — a runbook protocol in galago-tools, imported by the operator
- `stack.proto` changes — frozen for v2 in galago-tools; a needed change stops the work for the user's
  sign-off
- stack-automation-layer core fixes — a gap found here stops the work and is fixed there
- Upstream PRs to `sciencecorp/galago-core`

## Context

- **Key code:** `controller/server/command_queue.ts` (busy loop, `_runningPromise`, `UIMessage`
  modals that resolve the step via `_messageResolve`), `controller/server/tools.ts` (`Tool` with one
  gRPC client per tool; `fetchStatus` keeps the heartbeat running through failures since Phase 1),
  `controller/server/routers/command_queue.ts` (tRPC), `controller/components/runs/`
  (`RunsComponent.tsx`, `PauseModal`, `StopRunModal` — which auto-confirms after a 5 s countdown).
- **No gRPC deadline** on `executeCommand`, so a step can stay open through a long pause.
- **Codegen:** `bin/make proto_ts` with ts-proto **1.151.1** (the local `node_modules` 1.153.2
  generates a broken `tool_base.ts`); Node via nvm (`~/.nvm/versions/node/v24.14.1/bin`).
- **Build:** `.dockerignore` keeps host `controller/node_modules` out of the image (host-built
  native modules broke `better-sqlite3`).
- **Gate:** `tsc --noEmit` in `controller/` (0 errors) plus the Vitest unit suite
  (`npm run test:unit`, 244 tests at v1 close); `bin/make test` runs both, with `prettier --check`.
  `test/staticScan.test.ts` pins the UI-08 invariants (single send path, no timers, no state checks).
- **Live control (Phase 1):** `CommandQueue.runningStep` (in-memory, set only around a tool step),
  `toolControl`, `runState`/`RunStateMonitor` (`server/runState.ts`), and `Tool.controlCommand`.
- **Run-page control (Phase 2):** `hooks/useRunControl.ts` (the only `runState` reader and control
  mutation user), `components/runs/controlDecision.ts` (pure decision/send gate), `ControlBar`,
  `RunControlConfirmModal`, `ToolPausedModal`, `InstrumentStopModal`, `stopInterception.ts`,
  `server/recoveryControl.ts` + `tool.recoveryControl`, `components/tools/RunRecoverySection.tsx`.
- **Live-test caveat:** a simulated F.A.S.T. accepts every control command and ignores Abort, so
  abort-ends-the-step and real refusals only show against a real instrument.
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
| Plan the Galago side per repo (galago-core: queue + UI; galago-tools: adapter + rollout) | Clearer separation; each repo plans the code it changes | ✓ Good — v1 shipped against galago-tools `cb7886d` without cross-repo churn |
| D2 2 s run-state polling; D3 abort/resume out of the step editor; D4 Stop asks abort or cancel; D6 generic `runControl` | Settled 2026-10-12 | ✓ D2 and D6 shipped in Phase 1; D3 and D4 shipped in Phase 2 |
| `tool_paused` reads its own `runState` query, not the queue's modal state | The queue's modals block the busy loop; a pause happens inside an in-flight step | ✓ `runState` shipped independent of `modalState` (Phase 1); the prompt shipped in Phase 2 |
| Running step tracked in memory, not read back from SQLite `STARTED` rows | After a restart no step is running, so no control bar appears (design §8) | ✓ Phase 1 |
| Vitest 2.1.9 for server unit tests (human-approved package set A) | It supports the Docker builder's node 22.11; `tsc` stays the type gate | ✓ Phase 1 |
| Accept the residual control race (step ends during the gRPC round trip) | galago-core may not check instrument state (D-04); the F.A.S.T. core's state gates refuse invalid actions | ✓ Accepted in Phase 1 UAT, 2026-10-13 |
| Prove UI-08 with pure-logic tests plus static source scans, no jsdom/RTL | No new UI test dependencies (D-24); rendered behaviour went to UAT | ✓ Phase 2 (13 scan tests; UAT 9/9) |
| Stop, Clear All and deleting the running run abort first, then act on the queue only after the abort is accepted | Stop must never leave an instrument run untracked; research showed clearing dropped a running step | ✓ Phase 2 |
| Busy-loop catch treats a step row already removed by Clear All/delete-run as handled | Follow-up can win the race against the step's rejection (audit INT-01) | ✓ Quick task t9e |
| v2: pull F5 and F3 into scope (reverses the 2026-10-12 deferral) | The STACK queues a second submit and its errors carry the guid the operator needs; the galago-tools step_key ledger is defence in depth, not the fix | ✓ Shipped in Phase 3 (start guard + error visibility) |
| v2: run outcome `COMPLETED_WITH_SKIPPED_FAILURE` is client-only, derived from polled rows; `RunStatus` not widened | No schema change; FAILED takes precedence over a COMPLETED last row | ✓ Phase 3 |
| v2: step-card error sits beside the image in one row (amends D-17/UA2) | The stacked layout overflowed the fixed 165px card (G-03-3) | ✓ Phase 3 (03-07; live fit retest waived by the user as minor) |
| v2: skip the 4-researcher pass; research only F5 root cause and the acknowledge fit | F.A.S.T. support (`128bbd7`, `d4c3c23`, `tool.recoveryControl`) is the template | — Pending |
| Guid char class excludes U+0085 (NEL) explicitly; JS `\s` misses it | The planned guid regex would otherwise accept a NEL control char (04-01) | ✓ Phase 4 |
| Operator-only command matching is trim + lowercase exact equality (D-04); action-availability is the first server refusal (D-06 reroute) | Deny-by-list never invents a match; type-aware BAD_REQUEST comes before the run-state gate (04-01) | ✓ Phase 4 |
| Recovery card buttons are spec-derived per tool type; raw latch replies render bounded (LatchRawJson) | STACK declares only acknowledge_failure, so resume/abort never show for stack; a ~3 KB unknown reply must not blow out the card (04-06, G-04-2/6) | ✓ Phase 4 |
| `run.create` maps protocol/op errors by `Error.name` guards, not `instanceof`, plus a `next lint` gate on the build | The dev recompile module-copy drift broke class-identity checks against `RunStore.global` singletons (04-07, G-04-5/7) | ✓ Phase 4 |
| Use quick tasks for post-phase fixes instead of inserting decimal phases | Small, test-backed queue fixes (f48, h0q, o44, t9e) | ✓ Good — but leaves earlier phase verifications stale; re-verify after |

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
*Last updated: 2026-10-30 after Phase 4*
