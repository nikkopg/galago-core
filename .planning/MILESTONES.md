# Milestones

## v1 Live Run Control (Shipped: 2026-10-16)

**Delivered:** Operator-confirmed live Pause/Resume/Abort of a running F.A.S.T. step from the run
page, an instrument-pause prompt with the reason, and Stop/Clear All that never leave a run untracked.

**Phases completed:** 2 phases (1-2), 11 plans, 24 tasks
**Git range:** 9249102 → b1bec6b (148 commits, 2026-10-12 → 2026-10-16)
**Code changes:** 48 files, +12,427 / −1,958 (excluding `.planning/`)
**Closeout:** override_closeout
**Known verification overrides:** 2 newly acknowledged, 0 carried forward from a prior close (see STATE.md Deferred Items)
- Phase 1 VERIFICATION.md stale (predates quick task t9e's `command_queue.ts` change; Phase 2 re-verification covers it)
- v1-MILESTONE-AUDIT.md (`gaps_found`, INT-01) predates its fix in t9e; audit not re-run

**Key accomplishments:**
- Stood up Vitest 2.1.9 + vite-tsconfig-paths for `controller/`'s first unit-test runner, with global setupFiles mocks for the import-time-migrating `@/db/client` and a reusable fake gRPC double that drives a real `Tool` instance.
- `commandQueue.toolControl({action, params})` sends an operator's Pause/Resume/Abort straight to the running F.A.S.T. step's tool via a new, dependency-free `runControl` capability map — fail-closed in a fixed order, auditing every attempt, and never touching the busy loop's state machine or stored commands.
- `commandQueue.runState` reports a running F.A.S.T. step's live `run_state` through a new 2 s server-side `RunStateMonitor` poller — cached, independent of the queue's modal state, and honest about failures (`status: "unknown"` with the last good state kept) instead of throwing or going stale.
- `Tool.fetchStatus` no longer kills its own `setInterval` heartbeat on a single failed `getStatus` call — for every tool type — and a failure streak now logs exactly one warning and one recovery entry instead of spamming the console every 5 s, with `consecutiveStatusFailures`/`statusUnknownSince` getters for a future "unknown since" UI.
- `vendor/galago-tools` pinned to the human-approved `cb7886d1f3bdcdeeee71c55996f0dd62cf49ba7f`, `controller/gen-interfaces` regenerated with a scratch ts-proto 1.151.1 so `StatusReply.run_state` and `fast.Command.pause` are real generated fields, and `extractRunState` now reads `run_state` with no cast — Pause and run_state are proven end-to-end on the actual protobuf wire, not just the fake gRPC double.
- Run-page control bar with state/percent display and the one shared, confirmed send path (Pause/Resume/Abort) to the running F.A.S.T., proven end to end through the real tRPC router and busy loop.
- `tool_paused` prompt (reason, plain-language detail, start time, Hide/Resume/Abort) driven only by the `runState` poll, with a pure pause-episode reducer proving the full open/hide/reopen/close lifecycle end to end and in isolation.
- "Pause queue" (relabeled from "Pause"), Clear All, and the running step's per-run delete button all route through a new no-timer InstrumentStopModal while a controllable step runs, sequencing `toolControl("abort")` before the queue action via the existing `runAfterAccepted` primitive, proven end to end through the real tRPC router and busy loop.
- `tool.recoveryControl` tRPC mutation sends audited, no-deadline Resume/Abort to an untracked F.A.S.T. by id, refusing whenever the queue's running step is on that tool; `commandFields.fast` no longer offers abort/resume.
- "Run Recovery" card on the tool page offering Resume/Abort for any runControl tool type, always visible regardless of run state (Pitfall 10), routed through `createConfirmedSender`'s new recovery branch to the real `tool.recoveryControl` mutation.
- A 13-test Vitest source scan proves UI-08's single confirmed send path end to end (client hook → confirm modal → server's two controlCommand callers) and pins five safety invariants — no timers, no countdown-modal reuse, no queue-modal coupling, no instrument-state check, no Enter-bound default — with the full D-25 gate (tsc, 210-test unit suite, prettier) green.

**Tech debt carried forward:** 02-REVIEW-DISPOSITION.md advisories WR-01..WR-04, IN-01; transport-error toast unobserved live.

---
