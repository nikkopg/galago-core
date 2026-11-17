# Phase 9 Live Evidence Record (D-16)

One record for the whole phase. Raw captures live in `evidence/` and are indexed at the end. Every
capture is made by `tools/phase9-ctl.sh`, which reads only (HTTP GET to galago-web, local logs, the
ledger file, git, ss). Claude never sends a command to STACK2-6 or FA100056, reads included; the
operator runs every tool-page read and every live event (D-18). No credential or token value appears
in this file or under `evidence/` (runbook credential rule).

## Provenance

| Item | Value | Source |
|------|-------|--------|
| Last production commit (controller code) | `d09a047` (fix(08): WR-07), no controller or server change since | `git log`; phase 9 commits so far are tests, protocols and planning only |
| auto-mint | auto-mint: on (not exercised) | D-07; galago-tools commit `0604348` is an ancestor of HEAD (check below) |
| galago-tools branch / HEAD (re-verified 2026-11-17T04:20:00Z) | `feat/stack-tool` at `d53da5384f9f99d6751a5abfbbe0abbaa7a02389` | pre-spare-check baseline |
| `0604348` ancestor of galago-tools HEAD | yes (`git merge-base --is-ancestor` exit 0) | pre-spare-check baseline |
| galago-tools `tools/` tracked changes | none. One untracked runtime directory `tools/fast-mcp-locks/` (lock files, not source) | `git status --porcelain -- tools` printed one `??` line; research on 2026-11-17 said "no uncommitted changes", so this is a new untracked entry to keep in view, not a source change |
| galago-core HEAD at the pre-spare-check baseline | `45c0b6be7bfd4118e979ac05e15a3d9bdac31d2b` | baseline file |
| galago-core `controller/` uncommitted lines | 0 | baseline file |
| Tool servers (listener PIDs) | manager UI :8081 pid 6872, Tool Box :11010 pid 7490, STACK :40012 pid 7491, F.A.S.T. :40001 pid 2320808; galago-web :3010 owner not visible to `ss` (container proxy); sim ports 40091 and 40092 have no listener | baseline file |
| galago-web health | `{"status":"ok"}` | baseline file |
| Selected workcell | `test` (not the real STACK2-6 + FA100056 workcell) | `/api/settings/workcell`. Recorded as found; switching it is an operator action and is not part of this plan. Pre-flight check 6 (`/api/tools`) is workcell-scoped, so the real workcell must be selected again before event 1 |
| laneStatus on the running build | `laneMode: false`, `hasLaneRows: false`, `halted: false`, `queueBusy: false`, no failures | baseline file. Expected: the lanes build is not deployed yet (deploy is 09-04) |
| Run state | no run RUNNING: `/api/runs` returns `{"count":0,"data":[]}`; queue snapshot lists 2 runs in CREATED with 6 COMPLETED command rows | snapshot file |
| Trace folder | `1794670020` | baseline file |
| `STACK2-6.log` | 2168 lines, 24 "Running command", 4 "Running command Transfer" | baseline file |
| `FA100056.log` | 139686 lines, 4 "Running command", 1 "Running command Transfer" | baseline file |
| Ledger | `~/.local/state/galago-tools/stack/stack-ledger.json`, sha256 `94892d6fdb184022ef3f453ef57f800dd4fab9703ccc75167cf4ec9b911ef68c`, 4 records (all `done`/`ran`, 2026-11-16 11:21Z to 11:25Z) | baseline file |
| Image IDs (running, rollback anchor, new) | filled at deploy (09-04) | |
| galago-core HEAD at each event | deploy: _pending (09-04)_; drill: _pending_; event 1: _pending_; event 2: _pending_ | |
| galago-tools SHA re-verified at each baseline | pre-spare-check: `d53da53` (above); others: _pending_ | |
| Runbook SHA (galago-tools) after rows 3a-11..3a-15 | _pending (09-08, 09-12)_ | |

## D-05 overlap rule

This is the pass criterion for the live overlap evidence (D-05), fixed before any live event.

Let the STACK overlap row window be `[So, Eo]` and the F.A.S.T. row window be `[Sf, Ef]`, taken from
the rows' `startedAt` and `completedAt` in milliseconds (read with `phase9-ctl.sh snapshot`; the run
card seconds are corroboration only).

- PASS needs all three: `So >= Sf - 1500 ms`, `Eo <= Ef`, and `min(Eo, Ef) - max(So, Sf) > 0`.
- The 1500 ms tolerance is one lane loop delay (`CommandQueue` `_loopDelayMs` default 1500, RESEARCH
  A9): after the previous step completes, the F.A.S.T. worker may claim its step at any phase within
  the next 0 to 1500 ms and the primary loop claims the overlap step on its next poll, so the
  F.A.S.T. `startedAt` may precede the STACK `startedAt` by up to about 1.5 s with no ordering
  guarantee.
- Strict intersection: windows that only touch (`min(Eo, Ef) == max(So, Sf)`) are not an overlap and
  FAIL (Edge LIV-01/adjacency).
- Rows are listed per lane in queueId order, and equal timestamps are recorded raw, never re-ordered
  (Edge LIV-01/ordering).
- A retry re-enters STARTED and overwrites `startedAt` (RESEARCH Finding 7); snapshot the rows at every
  halt before the operator presses Start.

Tool-log clause (D-05): the same window shows attempts in both tool logs. The baseline-to-after line
counts of `STACK2-6.log` and `FA100056.log` (`phase9-ctl.sh logs-since`) must show the expected
"Running command Transfer" lines (event 1: four STACK transfers plus the estimate read line, one
F.A.S.T. transfer; event 2: six STACK transfers, one F.A.S.T. transfer) and nothing else that moves
hardware.

Event-2 ledger clause (D-05): six new `done`/`ran` ledger records with distinct keys, one per explicit
step key (`-in1`, `-in2`, `-x1`, `-out1`, `-out2`, `-x2`), copied with `phase9-ctl.sh ledger LABEL PREFIX`
immediately after the event (done records older than 7 days are pruned on write).

## Code gate (D-09, D-15)

From the 09-01 and 09-02 summaries (offline, fakes only, no tool contacted):

| Gate | Evidence |
|------|----------|
| Live protocol layout (09-01) | `controller/test/liveLanesProtocol.test.ts`: 26 offline tests through `executeProtocolScript`, `validateLanes` and the real `CommandQueue` with fake tools; commits `7fcc494`, `c8da89b`, `ecbd0fe`. Mutation check (not committed): removing the `galago.lane()` reset from each script fails three tests per protocol |
| D-09 one tool send per queueId (09-02) | `controller/test/laneOneSend.test.ts`: 2 passed; commit `8d96387`. The plan's literal claim-guard mutation did not fail it; the enqueue-while-halted refusal removal does (see 09-02-SUMMARY) |
| D-15 dispatch-span pin accepting IN-01 (09-02) | `staticScan.test.ts` "dispatch span": 4 passed with a negative control; commit `ac9962b` |
| Full controller suite after 09-02 | 50 files, 1410 tests passed |
| Open confirmation item (from 09-01) | Store protocol 15 was not in the served store (NOT_FOUND; only id 4 "test"), so the cycle parameter names and values come from the GAL-02 template and runbook rows 2a-2 and 3a-2. The operator confirms them against the real LIVE-10 protocol at the 09-03 checkpoint (below) |

## Spare-nest check (D-02)

Status: pre-check baseline captured, operator read-only check pending.

Captured so far (all by Claude, reads only):

- `evidence/20261117T042000Z-pre-spare-check.baseline.txt`
- `evidence/20261117T042000Z-pre-spare-check.queue.json`

Candidate pair under test (RESEARCH A5, unconfirmed): `orange-nest/deck1/A1` and `rack/l1/A1`. The
2026-11-03 device tree listed only `nest-1` (deck1/A1), `nest-2` (deck`/A1) and `fa100056` (tray1).

Operator reads still to come (tool page, not a protocol run): `list_devices` (refresh on),
`get_labware_presence` for `stack2-6`, and a standalone `get_transfer_estimate` for spare A to spare B.
The standalone estimate is a real-mode read: one estimation request to the manager, no arm motion,
no ledger record.

Post-check proof to record: `post-spare-check` baseline must show the same `STACK2-6.log` "Running
command Transfer" count (4) and the same ledger sha256 as the pre-check baseline.

Verdict, exact spare A / spare B triples, and the UTC time of the reply: _pending the operator reply and
the D-02 decision_.

## Deploy (D-13), runbook row 3a-11

_Pending (09-04)._

## Freeze drill (LIV-02), row 3a-12

### Scenario 1

_Pending (09-05 to 09-07)._

### Scenario 2

_Pending._

### Scenario 3

_Pending._

## Live event 1, row 3a-13

_Pending (09-09, 09-10). Waits on the D-02 verdict._

## Live event 2, row 3a-14

_Pending (09-11). Waits on the D-02 verdict._

## LIV-01 verdict

_Pending (09-12)._

## LIV-03 records, row 3a-15

_Pending (09-12)._

## Raw evidence index

All files are under `evidence/`, named `<UTC stamp>-<label>.<kind>`.

| File | Kind | Plan |
|------|------|------|
| `20261117T042000Z-pre-spare-check.baseline.txt` | baseline (provenance, listeners, log counts, ledger, web reads) | 09-03 |
| `20261117T042000Z-pre-spare-check.queue.json` | queue snapshot (laneStatus, getAll, getAllRuns) | 09-03 |
