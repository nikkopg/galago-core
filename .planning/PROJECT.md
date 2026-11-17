# galago-core (nikkopg fork) — Live Run Control

## What This Is

The `nikkopg/galago-core` fork of `sciencecorp/galago-core`: Galago's Next.js + tRPC web app
(`controller/`) that schedules workcell protocols, runs them through its command queue and talks to
tool servers over gRPC. This GSD project covers the queue, tRPC and run-page work that lets an
operator control a running instrument step live — and, since v1.1, STACK tool support: codegen from
the frozen `stack.proto`, born-empty STACK command forms, operator-only STACK error
acknowledgement, and the queue's single-flight Start guard with full tool-error visibility. The
F.A.S.T. and STACK tool servers it controls are planned in the galago-tools fork's own GSD project.

## Core Value

While an instrument step runs, the operator sees what the instrument is doing and decides every
recovery action themselves: the web app never pauses, resumes or aborts an instrument on its own,
and never pre-selects a physical decision for the operator.

## Current State

**Shipped:** v1.1 STACK tool support — 2026-11-02 (Phases 3-5, 18 plans; tag `v1.1`). galago-core sends
every STACK command from born-empty tool-page forms (codegen from the frozen `stack.proto` commit
`bcbbf8e`), shows every STACK error as an error (re-arming banner, step-card stored error, real
code names, skipped failures never plain success), a Start can never dispatch a row already in
flight, and only the operator — from the tool page, with guid + explicit `"yes"` — can acknowledge
a STACK failure, audited and never reachable from a protocol or the queue. Full suite at close:
608/608 tests, tsc clean. Audit: `v1.1-MILESTONE-AUDIT.md`; archive:
`milestones/v1.1-ROADMAP.md`, `milestones/v1.1-REQUIREMENTS.md`.

**Shipped earlier:** v1 Live Run Control (queue & run page) — 2026-10-16 (Phases 1-2, 11 plans;
tag `v1`): operator pause/resume/abort of a running F.A.S.T. step with explicit, confirmed,
non-defaulted decisions, the `tool_paused` prompt, abort-first Stop/Clear All, and the tool-page
Run Recovery card. Archive: `milestones/v1-ROADMAP.md`, `milestones/v1-REQUIREMENTS.md`.

**Governing design:** galago-tools `docs/specs/2026-10-12-galago-live-run-control-design.md`.
**Companion milestone:** galago-tools v2 "STACK Tool & STACK↔F.A.S.T. Handoff" (`feat/stack-tool`) —
owns the STACK adapter, the GAL-02 runbook protocol and the supervised live acceptance (its Phase
7, user present). This milestone's DEP-02 delivery unblocks its Phases 6-7.

<details>
<summary>Milestone v1.1 scope (shipped) — goal, delivery, carried items</summary>

**Goal:** galago-core can send every STACK command, shows every STACK error as an error, gives only
the operator an audited AcknowledgeFailure, and the root cause of F5 (a queued command executed
more than once) is fixed.

**Delivered:**
- DEP-03c (F5) + DEP-03b (F3) — Phase 3: single-flight Start guard, Start confirmation counts,
  tool-error visibility (QUE-07..09, ERR-01..05)
- DEP-03a — Phase 4: operator-only STACK AcknowledgeFailure on the D-20 pattern (OPR-01..05)
- DEP-02 — Phase 5: STACK codegen + command forms on the frozen proto (GEN-01..04)

**Carried, not in v1.1 scope:** F.A.S.T. plate-list dropdowns and `expected_tray_id` (pending todos);
02-REVIEW-DISPOSITION advisories WR-01..WR-04, IN-01; Phase-4 review advisories WR-01..WR-05
(recorded in the v1.1 audit's tech debt); stack-automation-layer core gaps are fixed in galago-tools
via `/gsd-quick`, never here.

</details>

## Current Milestone: v1.2 Tool-inferred dropdowns + per-tool concurrency lanes

**Goal:** The operator picks STACK and F.A.S.T. command values from lists the instruments themselves
report, instead of typing names and ids from memory; and one run can drive two tool servers at once
(e.g. STACK goto-safe while the F.A.S.T. runs its ~73 s transfer) without weakening any
operator-decides-recovery guarantee.

**Target features:**
- STACK command forms (`transfer`, `get_transfer_estimate`, `get_labware_presence`) offer
  dropdowns for robot, source/destination device → deck → nest, labware profile and
  source/destination transfer profile, read live from the stack-automation-layer through the
  existing `stack.proto` reads (`get_robot_states`, `list_devices`, `list_labware_profiles`,
  `list_transfer_profiles`). Needs only a submodule re-pin to galago-tools `feat/stack-tool`
  (`4ccd3da`; protos unchanged from `bcbbf8e`).
- F.A.S.T. Transfer `source_plate_id` / `dest_plate_id` dropdowns from the instrument's registered
  plates via a new read-only `get_plates` command — galago-tools must ship it first
  (contract: `.planning/research/FAST-GET-PLATES-CONTRACT.md`).
- Per-toolId concurrency lanes in the command queue, behind a default-off flag: per-lane Start
  guard, lane-halt (any latch-class failure freezes every lane), byte-identical sequential behavior
  with the flag off, lane field + per-lane preview and run-page rows, proven live on two tools.
  Source: `.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md`.

**Shape:** STACK dropdowns → F.A.S.T. plates → lanes (internals → protocol/run page → live proof).

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
- ✓ QUE-07..QUE-09 (F5) — v1.1: single-flight Start guard as the first statement of
  `CommandQueue._start` (an ignored Start logs "Queue Start Ignored", changes nothing and shows a
  warning toast); the Start confirmation lists what will run, read-only, from queue-joined rows —
  Phase 3
- ✓ ERR-01..ERR-05 (F3) — v1.1: a tool's `ERROR_FROM_TOOL` message is thrown and persisted (SUCCESS
  with a message counts as an error), shown in a re-arming run-page banner, on the step card (beside
  the image, 3-line clamp, full text on hover) and in the run outcome; a skipped failure shows an
  orange "Skipped failure" badge, never success — Phase 3 (UAT 5/5, 2026-10-29)
- ✓ DEP-03a — v1.1: operator-only STACK AcknowledgeFailure — recovery-card acknowledge flow (guid
  entry, born-empty radios, verbatim guid restatement, audited single-send), an explicit Read Latch
  query (no polling), server-side attempt gating while a STACK step runs (refused with audit, card
  itself stays enabled), queue refuses a queued `stack.acknowledge_failure`, run creation refuses
  operator-only steps as BAD_REQUEST, and the STACK card presents only the actions STACK declares —
  Phase 4 (UAT 3/3 passed + 4 diagnosed gaps closed by plans 04-06/04-07, UAT complete 2026-10-30)
- ✓ DEP-02 — v1.1: STACK codegen and command forms — `vendor/galago-tools` pinned to the frozen
  `stack.proto` commit `bcbbf8e`, `gen-interfaces` regenerated with the pinned ts-proto 1.151.1
  recipe, `commandFields.stack` born-empty for every command except `acknowledge_failure`, command
  panel renders for STACK with born-empty fields, blank-omitting/boolean-coercing STACK sends, and
  the Reply `meta_data` panel through the shared bounded display — Phase 5 (verification 20/20,
  UAT 4/4 live against the rebuilt galago-web + PAC simulator, 2026-11-02)
- ✓ DRP-01..09, STK-01..08 — v1.2: STACK command dropdowns inferred from the stack-automation-layer
  (robot, source/destination device → deck → nest, labware profile, transfer profiles) for
  `transfer`, `get_transfer_estimate` and `get_labware_presence`, plus the shared dropdown layer
  (`tool.options` registry read, `OptionsSelect`, `applyChange` cascade) ready for Phase 7 — born
  empty, typed fallback when the instrument is unreachable, saved values never rewritten,
  `vendor/galago-tools` pinned to `4ccd3da` with a zero-diff regen — Phase 6 (verification 17/17,
  UAT 11/11 live, 2026-11-06)
- ✓ PLT-01..09 — v1.2: F.A.S.T. Transfer `source_plate_id` / `dest_plate_id` dropdowns from the
  instrument's registered plates via the frozen read-only `get_plates` (`vendor/galago-tools`
  re-pinned to `d53da53`), deck selects 1-6, a "Reuse tips" checkbox, and a drag/click well-block
  picker on grids of the chosen plates (misfit and 96-vs-384 mismatch flagged, never clipped); typed
  out-of-range int32 values are kept, flagged and refused before any gRPC send — Phase 7
  (verification passed after gap closure 07-09/07-10, UAT 4/4 live against the F.A.S.T.,
  security 49/49 closed, 2026-11-16)
- ✓ LAN-01..09, LUI-01..06 — v1.2: per-toolId concurrency lanes behind `GALAGO_PARALLEL_LANES=1`
  (default off, flag-off behaviour byte-identical to a golden fixture): `advancedParameters.lane` /
  `laneBarrier` tags, per-lane Start guard, lane-halt (any failure freezes every lane, nothing
  aborted, Start re-runs the failed step), confirmed Freeze lanes, Lanes panel and per-lane run
  rows, failures-by-lane banner list, step-drawer lane controls and per-lane preview for visual and
  script protocols — Phase 8 (verification passed after review fixes WR-02/03/06, UAT 8/8 on a
  simulated two-tool rig, 2026-11-17)

### Active

- [ ] Per-toolId concurrency lanes proven live on two tools (supervised run) — v1.2, Phase 9

(Detailed REQ-IDs in `.planning/REQUIREMENTS.md`.)

### Out of Scope

- Software-initiated pause/resume/abort (on error, timeout, cancel, restart or reconnect)
- Hard pause (D5)
- Any code path that acknowledges, cancels, retries or parks the STACK on its own — every recovery
  action is an operator decision
- STACK or F.A.S.T. motion from tests — live runs only in galago-tools' supervised Phase 7
- GAL-02 protocol authoring — a runbook protocol in galago-tools, imported by the operator
- `stack.proto` changes — frozen in galago-tools; a needed change stops the work for the user's
  sign-off (v1.2's STACK dropdowns use only reads the frozen proto already has)
- Dropdowns that preselect a physical choice (labware profile, nest, plate) — the operator picks
  every value; the dropdowns only offer what the instrument reports
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
  (`npm run test:unit`, 608 tests / 28 files at v1.1 close); `bin/make test` runs both, with
  `prettier --check`. `test/staticScan.test.ts` pins the UI-08 invariants (single send path, no
  timers, no state checks) plus the v1.1 safety scans (operator-only refusals, born-empty fields,
  one bounded raw display).
- **Live control (Phase 1):** `CommandQueue.runningStep` (in-memory, set only around a tool step),
  `toolControl`, `runState`/`RunStateMonitor` (`server/runState.ts`), and `Tool.controlCommand`.
- **Run-page control (Phase 2):** `hooks/useRunControl.ts` (the only `runState` reader and control
  mutation user), `components/runs/controlDecision.ts` (pure decision/send gate), `ControlBar`,
  `RunControlConfirmModal`, `ToolPausedModal`, `InstrumentStopModal`, `stopInterception.ts`,
  `server/recoveryControl.ts` + `tool.recoveryControl`, `components/tools/RunRecoverySection.tsx`.
- **v1.1 STACK support:** `server/operatorOnlyCommands.ts` (refuse table + `isOperatorOnlyCommandError`),
  `server/recoveryActions.ts` (recovery-only spec, `LATCH_READ_COMMAND = "get_failure_latch"`),
  `components/tools/commandParams.ts` (`coerceBooleanParams`/`omitBlankParams`, STACK-scoped),
  `components/ui/BoundedRawJson.tsx` (the one bounded raw display), and the generated
  `gen-interfaces/tools/grpc_interfaces/stack.ts` from the submodule pinned at `bcbbf8e`.
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
| v1.1: pull F5 and F3 into scope (reverses the 2026-10-12 deferral) | The STACK queues a second submit and its errors carry the guid the operator needs; the galago-tools step_key ledger is defence in depth, not the fix | ✓ Shipped in Phase 3 (start guard + error visibility) |
| v1.1: run outcome `COMPLETED_WITH_SKIPPED_FAILURE` is client-only, derived from polled rows; `RunStatus` not widened | No schema change; FAILED takes precedence over a COMPLETED last row | ✓ Phase 3 |
| v1.1: step-card error sits beside the image in one row (amends D-17/UA2) | The stacked layout overflowed the fixed 165px card (G-03-3) | ✓ Phase 3 (03-07; live fit retest waived by the user as minor) |
| v1.1: skip the 4-researcher pass; research only F5 root cause and the acknowledge fit | F.A.S.T. support (`128bbd7`, `d4c3c23`, `tool.recoveryControl`) is the template | ✓ Good — F5-ROOT-CAUSE.md + ACK-AND-F3.md carried all three phases |
| Guid char class excludes U+0085 (NEL) explicitly; JS `\s` misses it | The planned guid regex would otherwise accept a NEL control char (04-01) | ✓ Phase 4 |
| Operator-only command matching is trim + lowercase exact equality (D-04); action-availability is the first server refusal (D-06 reroute) | Deny-by-list never invents a match; type-aware BAD_REQUEST comes before the run-state gate (04-01) | ✓ Phase 4 |
| Recovery card buttons are spec-derived per tool type; raw latch replies render bounded (LatchRawJson) | STACK declares only acknowledge_failure, so resume/abort never show for stack; a ~3 KB unknown reply must not blow out the card (04-06, G-04-2/6) | ✓ Phase 4 |
| `run.create` maps protocol/op errors by `Error.name` guards, not `instanceof`, plus a `next lint` gate on the build | The dev recompile module-copy drift broke class-identity checks against `RunStore.global` singletons (04-07, G-04-5/7) | ✓ Phase 4 |
| Use quick tasks for post-phase fixes instead of inserting decimal phases | Small, test-backed queue fixes (f48, h0q, o44, t9e) | ✓ Good — but leaves earlier phase verifications stale; re-verify after |
| v1.1 codegen: submodule pinned at stack-proto commit `bcbbf8e` + scratch-dir ts-proto 1.151.1 with an explicit `--plugin=` (never the node_modules 1.153.2) | The pinned frozen proto and plugin are the regen-reproducibility guarantee (05-01) | ✓ Phase 5 |
| v1.1 display: tri-state `lastReply` (undefined born hidden / null completed-no-data / reply object) + one shared BoundedRawJson for all raw replies | Born-hidden AND legible empty state from one state variable; a single bounded display instead of a second styled copy (05-02) | ✓ Phase 5 |
| v1.1 send pipeline: `omitBlankParams` + `coerceBooleanParams` scoped to STACK sends; NaN treated as blank | Operator-typed `false` reaches the wire; cleared number fields are omitted; other tool types pass verbatim (05-04) | ✓ Phase 5 (CR-01/WR-01 proven live) |
| Production-build lesson: `next build` fatals on an eslint-disable comment for a rule the config doesn't define | UAT container rebuild surfaced it; `commandParams.ts` disabled-comment replaced by a precise typed cast (bf928c0) | ✓ Phase 5 (found during verification work, re-reviewed 0 critical/warning) |
| v1.2 options read: dedicated `Tool.readOptions` (Metadata, 5 s deadline, never queued) over a closed four-source registry instead of `Tool.executeCommand` (D-01) | A dropdown read must never queue behind or race a running step; failures map to a closed reason set and fall back to a typed input | ✓ Phase 6 |
| v1.2 cascade: `applyChange` is the only patch producer; children clear only on the parent's user change, never on hydrate/refresh; typed fallback writes only its own field | A saved step is never rewritten by a list refresh; review WR-01/WR-02 tightened the typed and unbind paths (faccb5e) | ✓ Phase 6 |
| Connect All sends the stored type-keyed sub-config via `buildConnectConfig` (1c4f875) | Upstream #186 double-wrapped `tools.config`, so every tool server refused with `Config.host is required`; found during Phase 6 UAT | ✓ Phase 6 (container rebuilt) |
| v1.2 int32 send guard: `Tool#executeCommand` refuses any Transfer int32 field that is not an exact int32, after `{{variable}}` substitution and before gRPC; producers keep out-of-range digits as text (CR-01) | The ts-proto encoder silently wraps modulo 2^32 (4294967297 → plate 1); a refusal is safe, a wrapped value moves the robot | ✓ Phase 7 (07-09) |
| v1.2 well picker: drag logic is the pure `sourcePointerStep` reducer, the React shell only forwards events (WR-01) | Real pointer capture can't run under node vitest; the reducer carries 17 sequence tests and the shell passed a real-browser UAT | ✓ Phase 7 (07-10, UAT 2026-11-16) |
| Dev compose maps `host.docker.internal:host-gateway`; tool records point at `host.docker.internal:<launcher port>` | On Linux Docker has no host alias, so the containerised controller could not reach host tool servers (found in Phase 7 UAT, `0ddaaf0`) | ✓ Phase 7 UAT |
| v1.2 lanes: one default-off server flag (`GALAGO_PARALLEL_LANES`); flag off must stay byte-identical to the sequential queue, pinned by a golden fixture | Lanes change dispatch order on real instruments; the off path is the safety net | ✓ Phase 8 |
| v1.2 lanes: any failure on any lane freezes every lane without aborting running steps; only a Start resumes and it re-runs the failed step | The operator decides every recovery action; nothing moves on its own after a failure | ✓ Phase 8 (UAT 1-2 on a simulated rig) |
| v1.2 lanes: the first step on a secondary lane must be a barrier, and Tool Box steps are always primary | Keeps a lane from starting before the setup it depends on; Tool Box built-ins pause the whole queue | ✓ Phase 8 |
| Phase 8 UAT ran against simulated STACK/F.A.S.T. tool servers in an isolated workcell (host ports 40091/40092, inside the container's 40000-40099 firewall window) | Real instruments must not move during UAT; the live two-tool proof is Phase 9 | ✓ Phase 8 UAT, 2026-11-17 |

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
*Last updated: 2026-11-17 after Phase 8*
