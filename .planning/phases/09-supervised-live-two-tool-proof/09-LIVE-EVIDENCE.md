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
F.A.S.T. transfer; event 2: five STACK transfers, one F.A.S.T. transfer (amended D-03: no return leg)) and nothing else that moves
hardware.

Event-2 ledger clause (D-05): five new `done`/`ran` ledger records with distinct keys, one per explicit
step key (`-in1`, `-in2`, `-x1`, `-out1`, `-out2`; the `-x2` return leg was dropped by the amended D-03), copied with `phase9-ctl.sh ledger LABEL PREFIX`
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

Status: decided. Original rule gave no spare pair; the user amended D-02 and D-03 (below).

Captured so far (all by Claude, reads only):

- `evidence/20261117T042000Z-pre-spare-check.baseline.txt`
- `evidence/20261117T042000Z-pre-spare-check.queue.json`

Candidate pair under test (RESEARCH A5, unconfirmed): `orange-nest/deck1/A1` and `rack/l1/A1`. The
2026-11-03 device tree listed only `nest-1` (deck1/A1), `nest-2` (deck`/A1) and `fa100056` (tray1).

Operator reads still to come (tool page, not a protocol run): `list_devices` (refresh on),
`get_labware_presence` for `stack2-6`, and a standalone `get_transfer_estimate` for spare A to spare B.
The standalone estimate is a real-mode read: one estimation request to the manager, no arm motion,
no ledger record.

Post-check proof as planned: the `post-spare-check` baseline was to show the same `STACK2-6.log`
"Running command Transfer" count (4) and the same ledger sha256 as the pre-check baseline. It did
not: see "Operator nest-3 testing during the spare-check window" below. The Task 2 verification is judged
"delta explained by operator activity", not "unchanged".

### Operator nest-3 testing during the spare-check window

Found by the post-spare-check baseline (`evidence/20261117T045034Z-post-spare-check.baseline.txt`,
04:50:34Z): the STACK2-6 "Running command Transfer" count was no longer 4 and the ledger had changed.
Claude sent nothing to any tool at any point. The operator then explained it: "it was me testing the new
nest" (the new nest-3), disposition (a): the rig is OK and the plates are back where the plan expects them
(plate 1 on nest-1, plate 2 on nest-2, the third plate on nest-3).

Timeline, UTC, read from the local `STACK2-6.log` (log lines are local time, UTC+7; the HTTP `Date`
headers confirm UTC) and the local STACK ledger. These are operator-run tool-page calls, not Claude's:

| UTC | Event | Source |
|-----|-------|--------|
| 04:40:25 | Transfer rejected (manager HTTP 400 on estimation, `unhandledException`); no ledger record | log |
| 04:40:40 | Transfer ran about 14 s, `done`/`failed`, nest-3 to nest-1, failure latched (guid `23cbe3fc-...`) | log, ledger `20261117T044040363158-b8b46edd` |
| 04:48 to 04:49 | three `GetTransferEstimate` (the replies reported in the spare-check, read only) | log |
| 04:50:23 | Transfer refused (`failureLatched`, guid `23cbe3fc-...`) | log |
| 04:50:30 to 04:50:35 | `GetFailureLatch`, `AcknowledgeFailure` | log |
| 04:50:39 | Transfer ran about 18 s, `done`/`failed` (`smartAlignmentMaxNumRetry`), nest-1 to nest-3, latched again (guid `bc535b57-...`) | log, ledger `20261117T045039804682-d0fcb716` |
| 04:51:11 to 04:51:15 | `GetFailureLatch`, `AcknowledgeFailure` | log |
| 04:51:18 | Transfer ran about 35 s, `done`/`ran`, nest-1 to nest-3 | ledger `20261117T045118813461-c2242fce` |
| 04:52:13 | Transfer `done`/`failed` at once, nest-3 to nest-1, arm holding labware, latched (guid `974f6ec4-...`) | ledger `20261117T045213288978-c9611ad9` |
| 04:52:54 to 04:52:59 | `GetFailureLatch`, `AcknowledgeFailure` (reply `SUCCESS`) | log |
| 05:02:59 | Transfer rejected (`unhandledException`); no ledger record | log |
| 05:03:04 | Transfer ran about 29 s, `done`/`ran`, nest-1 to nest-3 | ledger `20261117T050304252388-d419c7de` |

Counts: `STACK2-6.log` "Running command Transfer" 4 (pre-check) to 7 (04:50:34Z) to 12 (the new baseline
below); ledger records 4 to 5 to 9. Five records are new: three `failed`, two `ran`, as listed. None of
this touched `FA100056` (its log stays at 1 "Running command Transfer").

Failure latch now, read only from the local ledger and log: the last latching failure (guid
`974f6ec4-...`, 04:52:13Z) was followed by `AcknowledgeFailure` at 04:52:59Z (reply `SUCCESS`), and the
05:03:04Z Transfer was then accepted and ran, which a latched STACK refuses (it did at 04:50:23Z). So the
latch reads as cleared. This is inferred from the local files; no `GetFailureLatch` was sent by Claude and
none will be. The 09-04 precondition below requires the operator to confirm it live.

Evidence gaps, stated plainly:

- `get_labware_presence` was not run, so plate placement is the operator's statement, not a read. The last
  recorded move is nest-1 to nest-3 at 05:03:04Z with no recorded move after it, so the stated placement
  (plate 1 on nest-1, third plate on nest-3) was reached by hand or by moves outside the ledger.
- The three failed Transfers (04:40:40Z, 04:50:39Z, and 04:52:13Z with the arm holding labware) happened
  on the same nests the amended D-02 uses (nest-3 and nest-1). The estimates in the spare-check replies
  were read-only and clean; three of the five ledger-recorded live moves between these nests ended `failed` (plus two Transfers rejected before any record).
  The operator owns the physical state. This is recorded as a risk input for the 09-04 and 09-09 to 09-11
  GO gates, not as a finding about the lanes code.

New reference baseline for later GO gates (Transfer count and ledger sha come from it):
`evidence/20261117T050637Z-post-operator-nest-test.baseline.txt` at 05:06:37Z. galago-core HEAD
`c9432d84632d4e94a82bfeda6090560e6cfb5fe6`, `STACK2-6.log` 12 "Running command Transfer", ledger sha256
`5de43c84a422c05ffb66f1bf9dee92b3fdf9183537c3e93d9bac1b08b353670b`, 9 records.

Operator reply (STACK2-6 tool page, operator-run, Claude sent nothing; raw text in
`evidence/20261117T045034Z-spare-check.txt`, estimates run 04:48:07Z to 04:49:01Z, reply recorded
04:50:34Z):

- `list_devices` (refresh on): four devices, all calibrated where it matters: `nest-1` (deck1/A1),
  `nest-2` (deck`/A1, the deck name is a literal backtick), `fa100056` (tray1 slots 1 to 6, slots 4, 5, 6
  calibrated), and the new `nest-3` (deck1/A1, `DEFAULT PORTRAIT`, calibrated). There is exactly one extra
  STACK-side nest, not a pair.
- `get_transfer_estimate`, robot `stack2-6`, labware profile `Default`, `nest-3/deck1/A1` to
  `nest-1/deck1/A1`: `estimated`, 58 s, no advisories.
- `get_transfer_estimate`, `fa100056/tray1/5` to `nest-3/deck1/A1`: `estimated`, 59 s, no advisories.
- Reach by eye: the operator confirms the arm reaches nest-3 and nest-1 without crossing the F.A.S.T. tray
  while it runs ("yes it can").
- `get_labware_presence` was not run (evidence gap; placement is operator-stated).

Verdict under the ORIGINAL D-02 rule (two spare nests, never nest-1/nest-2/fa100056): **no spare pair**.
Only nest-3 is free. Per D-02 this was returned to the user instead of falling back.

**Decision: pair confirmed under AMENDED D-02 (user decision 2026-11-17, recorded about 05:09Z).** The user
amended D-02 and D-03; the exact moves, as typed by the operator for the protocol parameters:

| Step | Source | Destination | When |
|------|--------|-------------|------|
| in1 | `nest-1/deck1/A1` | `fa100056/tray1/5` | cycle, before the overlap |
| in2 | `nest-2/deck`/A1` | `fa100056/tray1/6` | cycle |
| x1 (overlap, event 2 only) | `nest-3/deck1/A1` (overlap source, third plate starts here) | `nest-1/deck1/A1` (overlap destination = plate 1's home, empty because in1 already moved plate 1) | during the F.A.S.T. liquid leg |
| out1 | `fa100056/tray1/5` | `nest-3/deck1/A1` (the overlap source, vacated by x1) | after the F.A.S.T. barrier |
| out2 | `fa100056/tray1/6` | `nest-2/deck`/A1` | after out1 |

The D-03 serial return leg is DROPPED. End state of event 2: third plate on nest-1, plate 1 on nest-3,
plate 2 on nest-2; the operator restores the rig by hand after the run. Event 1 (estimate only, no x1)
keeps plate 1 returning to nest-1: nest-3 still holds the third plate, so out1 must not target it.

Safety basis (user): STACK legs serialize on the STACK (primary) lane, so x1 is sent only after in1
COMPLETED and out1 only after x1 COMPLETED; a failed in1 or x1 halts the run, so out1 never lands a plate
on an occupied nest. Offline proof: `controller/test/liveLanesProtocol.test.ts` (event-2 amendment tests).

Evidence for the pair: estimates 58 s (nest-3 to nest-1) and 59 s (tray1/5 to nest-3), no advisories;
reach confirmed by eye. Both estimates are real-mode manager reads, not motion.

Open risk carried to the GO gates (not decided here): three of the operator's five recorded live moves
between nest-1 and nest-3 on 2026-11-17 ended `failed` (see the nest-3 testing note above).

### Preconditions added for 09-04 and later GO gates

1. The STACK failure latch is cleared and the arm is idle, confirmed live by the operator
   (`GetFailureLatch` `latched:false`) immediately before the deploy GO. The local files read as cleared
   (see above) but only the operator's live read counts. Claude does not clear it.
2. The real workcell (STACK2-6 + FA100056) is selected again; `/api/settings/workcell` currently returns
   `test`, and pre-flight check 6 (`/api/tools`) is workcell-scoped.
3. Plates are physically where the amended plan expects at the start of each event: plate 1 on
   nest-1, plate 2 on nest-2, third plate on nest-3 (event 2 and event 1 alike), confirmed by the operator
   at the GO gate (no `get_labware_presence` read exists yet).

## Deploy (D-13), runbook row 3a-11

### Pre-deploy record (09-04 Task 1, 2026-11-17, Claude, reads and offline tests only)

| Item | Result |
|------|--------|
| D-09 gate: `npx vitest run` | 50 files, 1415 tests passed |
| `npx tsc --noEmit` | clean (exit 0) |
| `prettier --check` on `laneOneSend`, `staticScan`, `liveLanesProtocol` tests | all matched files use Prettier code style |
| 20x loop of `lanes` / `laneHalt` / `laneOneSend` / `liveLanesProtocol` | `ENGINE_LOOP_OK` (20 of 20 runs green) |
| `.dockerignore` | committed unchanged by explicit path as `63d61e4` (`chore(09): track the .dockerignore the galago-web build relies on`); the commit touches only `.dockerignore`; contents: `controller/node_modules`, `controller/.next`, `.git` |
| Build HEAD | `63d61e4e8a4b75b6a3b280acdaeb1b283b080782` |
| `git status --porcelain -- controller` | empty |
| `git diff --quiet d09a047 HEAD -- controller ':!controller/test'` | exit 0 (no production change since Phase 8) |
| Root `.env` | absent (`test -e`, content never read) |
| Pre-deploy baseline and snapshot | `evidence/20261117T051917Z-pre-deploy.baseline.txt`, `evidence/20261117T051917Z-pre-deploy.queue.json`. No run RUNNING (`/api/runs` count 0), `laneStatus` `laneMode:false`, `halted:false`, `queueBusy:false`. Listener PIDs: 8081 `6872`, 11010 `7490`, 40012 `7491`, 40001 `2320808`. `STACK2-6.log` 12 Transfer lines, ledger sha256 `5de43c84...670b`, 9 records: identical to the 05:06:37Z reference baseline, so no real move since the operator's nest testing |

### STOP: the production galago-web container and image do not exist on this host

Both pre-flight forms (05:18:40Z and 05:18:41Z) ended `BLOCKED`, exit 1, with one `missing:` line:
`Command_Transfer under /app/gen-interfaces in container galago-web`. Cause, read only:

- `docker ps -a` lists exactly one galago container: `galago-web-dev` (image `galago-core-galago-web-dev`, id
  `a331fa4d812a`, started 2026-11-16T22:51:51Z, from `docker-compose.dev.yml`). There is no container named
  `galago-web`.
- `docker images` lists no `galago-core-galago-web` image at all, so neither `:latest` nor a
  `rollback-pre-lanes` anchor can be created or compared, and the "running image equals `:latest`" check
  (Task 1 step 6, Task 3 step 1) has nothing to compare.
- The dev container serves :3010 with the working tree bind-mounted (`./controller` to `/app`),
  `NODE_ENV=development`, `GALAGO_PARALLEL_LANES` empty. Its store is `controller/data/app.db` on the host
  (bind mount). The production compose file uses the named volume `galago-core_sqlite_data` instead, whose
  contents were not inspected.
- The same pre-flight with `GAL07_WEB_CONTAINER=galago-web-dev` (read only) ends `PREFLIGHT OK`, exit 0, so the
  dev container already carries the Command_Transfer bundle and the rest of the pre-flight is healthy.

A production `docker compose up -d --build` would therefore not be a rebuild but a first production start
on port 3010, which the dev container holds, against a different store. That is outside what D-13 describes,
so nothing was tagged, built, started or stopped and no GO was requested. Returned to the user (CONTEXT
domain note: a defect found at deploy stops the work).

## Freeze drill (LIV-02), row 3a-12

### Scenario 1

_Pending (09-05 to 09-07)._

### Scenario 2

_Pending._

### Scenario 3

_Pending._

## Live event 1, row 3a-13

_Pending (09-09, 09-10). D-02 decided (amended, above)._

## Live event 2, row 3a-14

_Pending (09-11). D-02 decided (amended, above)._

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
| `20261117T045034Z-spare-check.txt` | operator replies to the spare-nest check (list_devices, two estimates, reach) | 09-03 |
| `20261117T045034Z-post-spare-check.baseline.txt` | baseline taken at 04:50:34Z; showed the operator nest-test delta | 09-03 |
| `20261117T050637Z-post-operator-nest-test.baseline.txt` | new reference baseline for later GO gates | 09-03 |
| `20261117T051917Z-pre-deploy.baseline.txt` | pre-deploy baseline (same Transfer count and ledger sha as the reference) | 09-04 |
| `20261117T051917Z-pre-deploy.queue.json` | pre-deploy queue snapshot | 09-04 |
