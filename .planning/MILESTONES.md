# Milestones

## v2 STACK tool support — codegen, operator acknowledge, error visibility, F5 (Shipped: 2026-11-02)

**Delivered:** galago-core sends every STACK command from born-empty tool-page forms (codegen from
the frozen `stack.proto` commit `bcbbf8e`), shows every STACK error as an error, a Start can never
dispatch a queue row already in flight, and only the operator — from the tool page, guid + explicit
`"yes"` — can acknowledge a STACK failure, audited and unreachable from any protocol or queue row.

**Phases completed:** 3 phases, 18 plans, 30 tasks
**Git range:** fbf4557 → cb21916 (194 commits, 2026-10-28 → 2026-11-02)
**Code changes:** 57 files, +8,096 / −522 (excluding `.planning/`)
**Closeout:** override_closeout
**Known verification overrides:** 2 newly acknowledged, 2 carried forward from a prior close (see STATE.md Deferred Items)
- Phases 3 & 4 VERIFICATION.md digests stale — Phase 5 edits (`05-02` BoundedRawJson extraction, `05-03` cast retrofits, `05-04`/`bf928c0` coercion) touched files they cover; Phase 5's 2026-11-02 verification (20/20, fresh 608/608 full-suite gate at HEAD) re-covered the shared truths. User accepted.
- v2-MILESTONE-AUDIT.md: status `tech_debt` — 17/17 requirements satisfied, 19/19 exports wired, 4/4 E2E flows, 0 blockers; 2 diagnosed debug sessions acknowledged (fixes shipped in 03-07/04-07); advisory items (Phase-4 WR-01..WR-05 incl. 2 security-category, Phase-3 IN-01..03, Phase-5 IN-03 + user-locked WR-03) recorded as tech debt.

**Key accomplishments:**
- Single-flight `_start` guard that ignores and audits a second Start while a step is in flight, plus a "Queue Started" log that lists the queue_ids and run_ids the Start will run, with retry-after-failure untouched.
- A 45-case table test that drives every tool ResponseCode through a real queue start against a FakeGrpc tool and pins the getError payload, stored row error, both error log lines, the thrown error's code name and the failure seq, committed red (30 failed, 15 passed) until plan 03-04.
- Run confirmation modal now states, read-only, how many queued steps a Start will run, how many are FAILED retries and how many distinct runs, from a pure counts/copy module fed by the queue-joined `commands` query.
- Pure run-outcome derivation (FAILED precedence, SKIPPED-with-error becomes COMPLETED_WITH_SKIPPED_FAILURE) wired into the run row as an orange "Skipped failure" badge and Progress bar, with the single-command call-site bug fixed.
- Error banner re-armed per failure via a seq-based dismissedSeq predicate that shows the tool's own text and real code, plus a stored-error line on failed and skipped-after-failure step cards, closed out by the phase's static scans and full regression gate.
- Step-card error text moved into the CommandImage row (image left in a non-shrinking Box, clamped text right with flex 1 / minW 0) so the fixed 165px card no longer overflows and the sticky label stops covering the error.
- The STACK Run Recovery card now accepts the typed guid verbatim, gates "Acknowledge failure…" on the server's own validator, and sends `{ guid, arm_inspected: "yes" }` through one confirmed-send path only after an explicit, non-defaulted "Yes" — the decision layer itself became recovery-spec-driven (`completeRecoveryEntries`), replacing the hard-coded fast allowlist.
- The operator can now read the tool's latched failure with one explicit "Read latch" click — the server sends one fixed constant (`LATCH_READ_COMMAND`) through `tool.executeCommand`, a pure shape-tolerant `extractLatch` interprets the reply once, and the result is pure display data that fills the guid input only ("Use this guid") and never gates or feeds the acknowledge.
- Fenced the ack literal, guard placement and single latch reader into failing-suite static scans — OPR-05 is no longer prose; any future drift (self-acknowledging path, wider literal set, guard in controlCommand, second latch reader, Enter-bound card) turns the suite red.
- The Run Recovery card now passes the production lint gate (guid hint as a JS string constant), shows Resume/Abort only where the tool's recovery spec declares them (none on STACK), and renders raw latch replies of both kinds in one bounded 160px scrolling collapsible that cannot resize the card.
- tRPC run.create now classifies its four mapped errors by `Error.name` through exported guards, so the operator-only refusal returns BAD_REQUEST (not a 500) even when next dev leaves RunStore.global on an older module copy.
- Submodule pinned to the frozen stack.proto commit `bcbbf8e` and regenerated with the pinned ts-proto 1.151.1 plugin; `commandFields.stack` covers 9 commands born-empty in proto order, the OPR-05 scan flipped positive in the same commit, `LATCH_READ_COMMAND` renamed to the frozen `get_failure_latch` oneof key, and the acknowledge payload proven on the real generated encoder.
- STACK tool pages now render born-empty command fields, a born-hidden Reply meta_data panel through the ONE shared bounded raw-JSON display, and a blank-omitting STACK send that leaves F.A.S.T. wire behavior byte-identical
- Phase 4's string-based acknowledge/latch scaffolding proven on the real generated types: 8 mechanical cast retrofits, real-enum operator-only refusal with zero sends, the zero-UI STACK config path, commandFields.stack D-03 sweeps, schema/enum activation, and the omit-blank wire pin — 599/599 tests green.

---

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
