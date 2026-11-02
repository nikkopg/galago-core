# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1 — Live Run Control (queue & run page)

**Shipped:** 2026-10-16
**Phases:** 2 | **Plans:** 11 | **Quick tasks:** 4

### What Was Built
- Server control path: `commandQueue.toolControl` sends operator Pause/Resume/Abort straight to the running step's tool, fail-closed, through a generic `runControl` capability map
- Live run state: `commandQueue.runState` backed by a 2 s `RunStateMonitor`, independent of the queue's modal state; heartbeat that keeps retrying for every tool type
- Run-page control bar, one shared confirmed-send path with non-defaulted yes/no decisions, and the `tool_paused` prompt with reason, detail and start time
- Stop / Clear All / delete-running-run routed through a no-timer abort-first dialog; tool-page Run Recovery card via `tool.recoveryControl`
- First unit-test runner for `controller/` (Vitest 2.1.9) and static source scans pinning the UI-08 safety invariants

### What Worked
- Tracer-first tasks: each plan's first task proved the path end to end through the real tRPC router and busy loop, so later TDD tasks only covered genuinely new behaviour
- Static source scans as a cheap substitute for jsdom/RTL to prove "no code path sends without confirmation"
- A fake gRPC double driving a real `Tool` instance kept server tests honest without hardware
- Quick tasks closed post-phase queue races (h0q, o44, t9e) quickly with focused regression tests

### What Was Inefficient
- Quick-task fixes after Phase 1 verification left that verification and the milestone audit stale, forcing an override closeout
- The milestone audit ran before t9e landed and was never re-run
- A malformed SUMMARY frontmatter (02-03) silently broke `summary-extract` until close
- Simulated F.A.S.T. accepts every control command and ignores Abort, so real refusals and abort-ends-step only show on hardware

### Patterns Established
- Abort first, act on the queue only after the abort is accepted (`runAfterAccepted`)
- Instrument decisions never reuse auto-confirming UI; dismiss = Cancel; nothing preselected
- `tool_paused` and any live-state UI read their own query, never the queue's blocking `UIMessage` modals
- Running step tracked in memory, not inferred from SQLite `STARTED` rows

### Key Lessons
1. After any quick task touches files a verified phase covers, re-run that phase's verification and the milestone audit before closing.
2. Race tests should pit queue follow-ups (Clear All/delete) against step rejection explicitly — the 237-test suite passed while INT-01 existed.
3. Validate SUMMARY.md frontmatter as YAML when writing it, not at milestone close.

### Cost Observations
- Model mix: not tracked
- Sessions: not tracked
- Notable: 148 commits over 4 days (2026-10-12 → 2026-10-16), 11 plans at ~15–55 min each

---

## Milestone: v2 — STACK tool support (codegen, operator acknowledge, error visibility, F5)

**Shipped:** 2026-11-02
**Phases:** 3 | **Plans:** 18

### What Was Built
- Single-flight `_start` guard (first statement, audited "Queue Start Ignored") plus a Start confirmation that lists queued rows, FAILED retries and distinct runs read-only — F5's re-entrant `_start()` root cause fixed without touching retry-after-failure
- Full tool-error visibility: a 45-case RED-first table driving every ResponseCode through a real queue start, `describeToolReply` composing the tool's own text, a re-arming banner via `failureSeq`/`dismissedSeq`, step-card stored errors, and run outcomes that never show a skipped failure as plain success
- Operator-only STACK acknowledge: a zero-import refuse table enforced twice (run creation + guard-first `Tool.executeCommand`), a recovery-spec-driven Run Recovery card (guid verbatim, born-empty radios, explicit `"yes"`), audited single-send `tool.recoveryControl`, and an explicit Read-latch query whose result only ever fills the input
- STACK codegen from the frozen `stack.proto` commit `bcbbf8e` with pinned ts-proto 1.151.1, `commandFields.stack` (9 commands, born-empty, no ack), the latch command renamed to the frozen `get_failure_latch` key, real-encoder wire tests, and a STACK-scoped coerce-before-strip send pipeline proven live

### What Worked
- Research disproved the defect's premise before any code (F5 ran three different rows, not one row three times) — the guard design followed the real root cause instead of the report
- RED-first TDD with junit reporter records made "written failing first" auditable (30/45 cases red until 03-04; valid-RED scaffolds in 05-04)
- Static scans fence safety invariants: the ack literal's closed file set, guard placement, single latch reader and born-empty fields all turn the suite red on drift — OPR-05 is enforced, not prose
- Freezing the proto first (galago-tools Phase 4) made Phase 5 mechanical; the pinned scratch-dir regen recipe removed codegen nondeterminism
- Phase 5's full-suite gate at HEAD (608/608) after all edits gave the close honest evidence despite stale Phase 3/4 digests

### What Was Inefficient
- The v1 lesson recurred: later phases' edits staled earlier phases' verifications (3 & 4), forcing an override closeout for the second milestone running
- SUMMARY frontmatter gaps (04-01/02/05 missing `requirements-completed`) broke the 3-source requirements cross-check at close — the exact v1 lesson 3, not fully applied
- Rendered-layout gaps (G-03-3 card overflow, G-04-2 raw-panel width) surfaced only at human UAT; the headless-Chrome harness that finally proved them arrived only in Phase 5
- The F5+F3 phase merge (2026-10-28) was a mid-flight roadmap reorg; deciding the phase structure at planning time would have saved a replan

### Patterns Established
- Operator-only command matching: deny-by-list, trim + lowercase exact equality; the executeCommand guard is the first statement
- Recovery actions are spec-driven per tool type (`isRecoveryAction`/`getRecoverySpec`), never hard-coded allowlists
- Server error classification by exported `Error.name` guards, not `instanceof` — survives dev-recompile module-copy drift against `RunStore.global` singletons
- One shared bounded raw display (`BoundedRawJson`); display fallbacks born-empty (`?? ''`, never `||`-painting 0/false)
- STACK-only send shaping: `coerceBooleanParams` → `omitBlankParams`, scoped on `String(config?.type) === "stack"`; every other tool type sends verbatim

### Key Lessons
1. When a later phase edits files a verified phase covers, re-run the full suite at HEAD in the later phase's verification and record it as the override's evidence — that is what made closing on stale digests defensible.
2. The headless-Chrome harness (live page + tRPC capture + server-log corroboration) closes rendered-layout truths that static scans can only pin structurally; reuse it instead of waiving retests.
3. Generate SUMMARY `requirements-completed` from PLAN frontmatter at execution time; hand-written frontmatter is where the close-time cross-check keeps breaking.
4. Sanitize log interpolation inside `logAction`, not per call site — the operator-only refusal's audit line (WR-01) remains the one open security-category advisory.

### Cost Observations
- Model mix: not tracked
- Sessions: not tracked
- Notable: 194 commits over 5 days (2026-10-28 → 2026-11-02), 18 plans at ~3–55 min each; suite grew 244 → 608 tests

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1 | — | 2 | First GSD milestone; tracer-first plans; quick tasks for post-phase fixes |
| v2 | — | 3 | Research scoped to root-cause docs; RED-first TDD records; static-scan fencing of safety invariants; headless-Chrome UAT harness |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1 | 244 | — | Vitest 2.1.9 + vite-tsconfig-paths (dev only) |
| v2 | 608 | — | None (ts-proto codegen pinned via scratch venv, no new runtime deps) |

### Top Lessons (Verified Across Milestones)

1. Post-phase edits stale earlier phases' verifications in BOTH milestones — re-run the full suite at HEAD and record it as override evidence before closing.
2. Hand-maintained SUMMARY frontmatter broke the close-time cross-check in BOTH milestones — generate it from PLAN frontmatter at execution time.
3. Static scans pin structure, only a browser proves layout — the Phase 5 headless-Chrome harness is the reusable answer.
