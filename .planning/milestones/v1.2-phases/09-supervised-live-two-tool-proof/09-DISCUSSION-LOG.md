# Phase 9: Supervised Live Two-Tool Proof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-17
**Phase:** 9-Supervised Live Two-Tool Proof
**Areas discussed:** Task/command dependency (user-added), D5 overlap STACK step, D8 step keys and auto-mint, Freeze drill (LIV-02), Live-run setup and evidence
**Todo folded:** scheduler-per-tool-concurrency-lanes.md

---

## Task/command dependency (user-added area)

| Option | Description | Selected |
|--------|-------------|----------|
| How the live protocol orders steps | lane/laneBarrier tags in the live cycle | |
| When one tool's step blocks the other | physical never-overlap rules | |
| A new dependency model | per-step depends-on links beyond laneBarrier | ✓ |

**User's choice:** A new dependency model. Recorded as a deferred idea (new capability), not Phase 9 scope.

---

## D5: the overlap STACK step

| Option | Description | Selected |
|--------|-------------|----------|
| Read first, then a Transfer | two gated events: read overlap, then motion overlap | ✓ |
| Real STACK Transfer only | motion from the first event | |
| Read only | no arm-maneuver proof | |

| Option | Description | Selected |
|--------|-------------|----------|
| Single-plate cycle | plate 2 moves nest-2 → nest-1 during the F.A.S.T. leg | |
| Third plate on a spare nest | keep the two-plate cycle, add a third plate between spare nests | ✓ |
| Decide at the rig | record the rules only | |

| Option | Description | Selected |
|--------|-------------|----------|
| get_transfer_estimate | same fields as the later move, rehearses reach | ✓ |
| get_labware_presence | simplest read | |
| Both, back to back | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Run-row timestamps plus tool logs | windows nest, both logs, one ledger record per key | ✓ |
| Run-row timestamps only | | |
| Add a measured saving | plus cycle-time vs serial | |

| Option | Description | Selected |
|--------|-------------|----------|
| Return leg after the barrier | rig ends where it started | ✓ |
| One-way move | | |
| Return leg also overlaps | | |

**Notes:** Claude flagged that the two-plate cycle leaves the arm nothing to carry during the F.A.S.T. leg (both plates on the tray, only nest-1/nest-2 seen STACK-side). If the rig has no spare calibrated nest pair, the work stops and returns to the user.

---

## D8: step keys and auto-mint

| Option | Description | Selected |
|--------|-------------|----------|
| Script protocol, mints per run | protocol 15 pattern + galago.lane() | ✓ |
| Visual protocol, protocol 18 pattern | variable_assignment keys | |
| Typed literal keys per event | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it on, record its status | "auto-mint: on (not exercised)" | ✓ |
| Turn it off for the proof | galago-tools change + restart | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, gate the live run on a one-send-per-queueId test | add if Phase 8 lacks it | ✓ |
| No, Phase 8 tests are enough | | |

---

## Freeze drill (LIV-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Production galago-web, isolated sim workcell | deployed build, real tools idle | ✓ |
| Dev stack sim rig only | Phase 8 UAT repeat | |
| Live tools, refused-before-motion failure | F.A.S.T. moves during the drill | |

**Scenarios (multi-select):** stack-lane failure halts fast ✓, fast-lane failure halts stack ✓, operator Freeze lanes mid-overlap ✓

| Option | Description | Selected |
|--------|-------------|----------|
| Before any live motion | deploy → drill → event 1 → event 2 | ✓ |
| After the live run | | |

---

## Live-run setup and evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild with the flag, rollback anchor first | 1a-6 discipline, flag stays on | ✓ |
| Lanes on only for the proof | flip back after evidence | |

| Option | Description | Selected |
|--------|-------------|----------|
| Accept IN-01, pinned by a test | test fails on an await between halt check and claim | ✓ |
| Accept as is | | |
| Fix it | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Both: phase doc plus runbook rows | 09-LIVE-EVIDENCE.md + findings rows | ✓ |
| galago-tools runbook only | | |
| galago-core phase doc only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Commit in galago-tools, no re-pin | docs only | ✓ |
| Commit and re-pin the submodule | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Claude prepares, the operator runs | only the operator presses Start/Freeze/recovery | ✓ |
| Claude starts the run after a typed GO | | |

---

## Claude's Discretion

- How simulated failures are injected on the sim tool servers (never addressing a real tool).
- Exact row order within the lane rules, the key base format, and the evidence-doc layout.
- Whether the guard tests are new files or additions to the existing lane tests.

## Deferred Ideas

- General step-dependency model beyond laneBarrier (own phase).
- Measured cycle-time saving as an acceptance item.
- Turning auto-mint off.
