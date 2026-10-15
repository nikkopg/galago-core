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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1 | — | 2 | First GSD milestone; tracer-first plans; quick tasks for post-phase fixes |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1 | 244 | — | Vitest 2.1.9 + vite-tsconfig-paths (dev only) |

### Top Lessons (Verified Across Milestones)

1. (Needs a second milestone to cross-validate.)
