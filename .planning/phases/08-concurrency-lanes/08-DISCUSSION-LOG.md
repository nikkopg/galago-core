# Phase 8: Concurrency Lanes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-16
**Phase:** 8-concurrency-lanes
**Mode:** `--auto` (no user prompts; recommended option auto-selected for every question)
**Areas discussed:** Fork/join encoding (D1), Lane-mode flag (D2), Tool pause vs lane-halt / freeze control (D3), Primary-lane modal blocking (D4), Control surface under lanes (D9), Concurrent-failure banner (D12), Authoring surface, Run page

[auto] Selected all gray areas.
[auto] Folded todo `scheduler-per-tool-concurrency-lanes.md` (score 0.4 ≥ 0.4).

---

## Fork/join encoding (D1)

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit `lane` + `laneBarrier` fields | New optional advancedParameters; eligibility derived from queued rows | ✓ |
| Reuse `runAsynchronously` + join step | Reinterprets a field stored as literal `false` everywhere | |
| Per-step dependency list (DAG) | Anti-feature per research | |

**[auto] Selected:** explicit fields; barrier flag is the only cross-lane primitive (satisfies LAN-03 "dependency").

## Lane-mode flag (D2)

| Option | Description | Selected |
|--------|-------------|----------|
| Env var `GALAGO_PARALLEL_LANES`, read once at construction, injectable | Sync, in the image | ✓ |
| `.planning/config.json` | Not in the deployed image | |
| Async app-setting / per-run `useParallelToolLanes` | Breaks sync claim; extra concept | |

**[auto] Selected:** env var; per-run flag dropped (lane tags are the opt-in).

## Tool-initiated pause vs lane-halt (D3)

| Option | Description | Selected |
|--------|-------------|----------|
| Operator "Freeze lanes" control (run-page button) | Sets dispatch latch, aborts nothing, cleared by operator Start | ✓ |
| Accept and document only | LAN-09 requires a freeze control | |
| Poll-driven gate on `run_state` | Forbidden state check without sign-off | |

**[auto] Selected:** operator freeze control.

## Primary-lane modal (D4)

| Option | Description | Selected |
|--------|-------------|----------|
| Modal blocks new dispatch on every lane; non-tool steps primary-only | Enforced at creation, enqueue, dispatch | ✓ |
| Modal blocks primary only | Side lanes keep dispatching while operator is prompted | |

**[auto] Selected:** block every lane.

## Control surface under lanes (D9)

| Option | Description | Selected |
|--------|-------------|----------|
| At-most-one controllable running step invariant + per-queueId markers + `stopIf` | Control UI stays byte-identical | ✓ |
| Target by queueId with one monitor per step | Larger UI/router change | |

**[auto] Selected:** invariant.

## Concurrent-failure banner (D12)

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded per-lane failure list; first failure (STACK guid) kept | Each lane's failure listed | ✓ |
| Single error slot | Hides the first failure | |

**[auto] Selected:** bounded list.

## Authoring surface

| Option | Description | Selected |
|--------|-------------|----------|
| Drawer Lane input + "Wait for all earlier steps" switch; `galago.lane()` + per-call `{lane, barrier}` | Matches LUI-01/02 and the todo | ✓ |
| Script-only per-call options | Drops `galago.lane(...)` named in LUI-02 | |

**[auto] Selected:** both script forms; drawer controls for tool steps only.

## Run page

| Option | Description | Selected |
|--------|-------------|----------|
| Per-lane rows only when a non-primary lane exists; lane-aware outcome only then | Legacy DOM/outcome byte-identical otherwise | ✓ |
| Always render lane rows | Changes untagged run page | |

**[auto] Selected:** conditional per-lane rendering.

## Claude's Discretion

- File names/split, failure-list cap, log wording, test layout, lane-row and "Lanes frozen" visual treatment.
- Single latch with reason vs sibling latches for halt/freeze/modal.
- Injectable loop delay for deterministic tests.

## Deferred Ideas

- Remove dead `runAsynchronously` switch (cleanup).
- Lifting the one-controllable-step invariant.
- DAG/dependency lists, cross-run parallelism.
- Poll-driven freeze on tool pause.
- D5, D8, live proof and resolution notes — Phase 9.
