# Phase 2: Run Page Live Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-13
**Phase:** 2-Run Page Live Controls
**Areas discussed:** Control bar & state source, Confirmation & decision UX, tool_paused prompt, Stop confirmation, Crash recovery & step editor, UI-08 test strategy
**Mode:** `--auto`. Claude chose the recommended option in every area; no user prompts.

---

## Control bar & state source

| Option | Description | Selected |
|--------|-------------|----------|
| A single client hook over `runState`, shared by the bar, the prompt and Stop | One source of truth for "running"/"paused" (Pitfall 9, mitigation 2) | ✓ |
| Fold `runState` into `modalState` | Atomic, but mixes the prompt into the `UIMessage` plumbing (PROJECT constraint) | |
| Separate `useQuery` per component | Simplest, but the components can disagree for a tick | |

**Choice:** single hook. Enablement is a hint; all buttons are enabled when the state is unknown.

## Confirmation & decision UX

| Option | Description | Selected |
|--------|-------------|----------|
| One shared confirm modal; decisions chosen there, none preselected, reset on each open | A single send path that is easy to prove (UI-08) | ✓ |
| Decisions inline in each surface, plus a separate confirm | Two steps; more code paths | |

**Choice:** shared modal. No optimistic UI; refusals appear in a persistent toast.

## tool_paused prompt

| Option | Description | Selected |
|--------|-------------|----------|
| Dismissible, reopenable from the bar, auto-reopens on a new episode, auto-closes on resume or step end | The operator can look at the deck without losing the reason | ✓ |
| Non-dismissible until resolved | Blocks the rest of the run page | |

**Choice:** dismissible. A formatter renders `wrongDetection` in plain language, with a raw-JSON fallback.

## Stop confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Intercept the queue-stop button; abort first, stop the queue only if the abort is accepted | Stop never leaves the run untracked | ✓ |
| Stop the queue, then abort | The queue could detach if the abort is refused | |

**Choice:** abort-then-stop. The researcher checks whether `clearAll`/`clearByRunId` need the same guard.

## Crash recovery & step editor

| Option | Description | Selected |
|--------|-------------|----------|
| Always-rendered tool-page "Run recovery" section plus a new `tool.recoveryControl` mutation, disabled only when this tool has a tracked step | Avoids Pitfall 10; reuses the validation | ✓ |
| Keep abort/resume in `commandFields` for the tool page only | `commandFields` also feeds the step editor (D3 violated) | |

## UI-08 test strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Pure-logic modules plus static source-scan invariants in the node Vitest, no new deps | Matches the Phase 1 package approval | ✓ |
| Add jsdom + React Testing Library | Needs human package approval | |

## Claude's Discretion

- Names, layout and styling; toast wording; how the static scans are implemented.

## Deferred Ideas

- Combined atomic run-page query; UI component tests (jsdom/RTL); hard pause; simulated pause in the
  UI; F3/F5 debt.
