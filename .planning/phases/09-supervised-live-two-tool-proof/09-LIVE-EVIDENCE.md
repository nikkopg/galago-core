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
| Image IDs (running, rollback anchor, new) | dev image `a331fa4d812a...` before and after (no build, no anchor); container `18b8638fc1c8` to `855c334135eb` (09-04, Deploy section) | Deploy section |
| galago-core HEAD at each event | deploy: `486cf09` (09-04); drill: `2de6b0b` at the pre-drill-go baseline (09-06); event 1: _pending_; event 2: _pending_ | |
| galago-tools SHA re-verified at each baseline | pre-spare-check: `d53da53` (above); others: _pending_ | |
| Runbook rows 3a-11 / 3a-12 commit (galago-tools, branch `feat/stack-tool`) | `034867ca8aec9cb5ed83140306ebd89bf61b9ae7` (`034867c`), `docs(gal-07): findings 3a-11 lanes-on deploy and 3a-12 lanes drill (galago-core Phase 9)`; `git show --name-only` lists only `docs/runbooks/gal-07-live-handoff.md` (5 insertions, 1 deletion); `TestRunbookContent` 5 tests OK before and after; "Reply: literal go" count 3; no credential or Bearer value in the rows (09-08) | `git -C ~/data/nikko/galago-tools show --stat HEAD` |
| galago-core `vendor/galago-tools` pin after that commit | unchanged: `git diff --quiet HEAD -- vendor/galago-tools` exit 0 and `git submodule status vendor/galago-tools` still `d53da5384f9f...` (`v2-4-gd53da53`). No re-pin (D-17). The commit is docs only, so the deployed galago-tools code is unchanged and no galago-tools redeploy happened (D-07). The galago-tools working tree's other changes (deletions under `.planning/phases/04-*`, `.planning/state.json`, untracked `tools/fast-mcp-locks/`) are the user's and were not staged | 09-08 Task 2 |
| Runbook SHA (galago-tools) after rows 3a-13..3a-15 | _pending (09-12)_ | |

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

## Deploy (D-13), runbook row 3a-11 (recorded in galago-tools `034867c`, 09-08)

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

### Decision B (user, 2026-11-17): deploy by recreating `galago-web-dev` with lanes on

The user chose option B, verbatim reply "B": turn lanes on in the existing dev container by recreating
`galago-web-dev` with `GALAGO_PARALLEL_LANES=1` through `docker-compose.dev.yml`. Same store, same
workcells and protocols, no build, no `rollback-pre-lanes` image anchor. Recorded as an Amendment to D-13
in `09-CONTEXT.md`. Plans 09-05 to 09-12 read `galago-web-dev` wherever they say `galago-web`
(`GAL07_WEB_CONTAINER=galago-web-dev`, `docker exec galago-web-dev ...`). The image checks of the old
Task 3 (new image differs, equals `:latest`) are replaced by "dev image id unchanged".

Rollback anchor (nothing is tagged because nothing is built):

| Item | Value |
|------|-------|
| Code | git HEAD `c548849` at the time of this decision (controller tree identical to `63d61e4`; `git diff --quiet d09a047 HEAD -- controller ':!controller/test'` exit 0, so no production change since Phase 8). Code is bind-mounted, so lanes off and on run the same files; only the flag differs |
| Image | `galago-core-galago-web-dev` id `a331fa4d812aee4c152fc5fddcbb6a09b2ab23663aaa0d6aad8c8f14d01f6a0e`, expected unchanged after the recreate (`--no-build`) |
| Container before | `galago-web-dev`, id `18b8638fc1c8`, up since 2026-11-16T22:51:51Z, env `GALAGO_PARALLEL_LANES=` (empty), restart policy `no` |
| Mounts | bind `./controller` to `/app`; anonymous volume at `/app/node_modules` (compose reuses it on recreate; the dry run below planned a plain recreate) |
| Compose project | `galago-core`, config `docker-compose.dev.yml` in the repo root |
| Root `.env` | absent (gitignored by `.gitignore:45` if ever created) |

Read-only prep done (no container stopped or recreated):

- `GALAGO_PARALLEL_LANES=1 docker compose -f docker-compose.dev.yml config` resolves
  `environment.GALAGO_PARALLEL_LANES: "1"`, everything else unchanged. The compose file already passes the
  flag through (`${GALAGO_PARALLEL_LANES:-}`), so no compose edit is needed to turn lanes on.
- `GALAGO_PARALLEL_LANES=1 docker compose -f docker-compose.dev.yml up -d --no-build --dry-run` planned
  exactly `Container galago-web-dev Recreate / Recreated / Started`; afterwards `docker ps` still showed
  `galago-web-dev` id `18b8638fc1c8` up (dry run changed nothing).
- `TOOLBOX_PORT`: `docker-compose.dev.yml` has no `TOOLBOX_PORT` line (only the production compose does),
  so it cannot be passed to the dev container by an env override. `controller/server/tools.ts`
  (`toolBoxConfig`) reads `Number(process.env.TOOLBOX_PORT) || 1010` with `ip: "localhost"`, which inside a
  bridge-network container is the container itself, not the host Tool Box on :11010. The dev container has
  run all session without it, and the proof uses only STACK2-6 and FA100056. Recommendation: do not add
  it. Prepared, NOT applied, if the user insists: add `- TOOLBOX_PORT=${TOOLBOX_PORT:-1010}` under
  `environment:` in `docker-compose.dev.yml` (after `- PORT=3010`), commit it by explicit path, and run
  the recreate with `TOOLBOX_PORT=11010` as well.
- Dev-mode caveat: `./controller` is bind-mounted into a `next dev` server, so any edit under
  `controller/` by anyone hot-reloads the live server. Keep `git status --porcelain -- controller` empty
  during the proof and re-check it at every baseline.
- Persistence: the env override applies to this recreate only. A later plain
  `docker compose -f docker-compose.dev.yml up` (or a host restart followed by compose) without the variable
  starts the container with the flag off. D-13 says the flag stays on after the proof, so the GO offers an
  optional gitignored root `.env` with the single line `GALAGO_PARALLEL_LANES=1` (compose reads it
  automatically). Default is no `.env` (one-off).
- Two runs sit in `CREATED` (6 `COMPLETED` command rows) in the store from earlier work. They are not
  RUNNING and the recreate does not start them; nobody should press Start on them.

Exact commands (from `/home/formulatrix/data/nikko/galago-core`; none has been run):

```bash
# DEPLOY: recreate galago-web-dev with lanes on (no build, image id stays a331fa4d812a)
GALAGO_PARALLEL_LANES=1 docker compose -f docker-compose.dev.yml up -d --no-build galago-web-dev

# ROLLBACK: recreate with the flag off (also remove GALAGO_PARALLEL_LANES from a root .env if one was written)
env -u GALAGO_PARALLEL_LANES docker compose -f docker-compose.dev.yml up -d --no-build galago-web-dev
# rollback check: docker exec galago-web-dev printenv GALAGO_PARALLEL_LANES   (prints an empty line)
#                 laneStatus shows "laneMode":false
```

Post-deploy verification, run after GO in this order (any failure: stop, leave the container as it is,
return to the user, never hot-fix):

1. `docker inspect galago-web-dev --format '{{.Image}}'` is still `sha256:a331fa4d812a...`; the container id
   differs from `18b8638fc1c8`; `docker exec galago-web-dev printenv GALAGO_PARALLEL_LANES` prints `1`.
2. Wait for the Next dev server (poll `curl -fsS localhost:3010/api/health` up to about 2 minutes; the first
   requests compile on demand), then `/api/health` is `{"status":"ok"}`.
3. `curl -fsS localhost:3010/api/trpc/commandQueue.laneStatus` shows `"laneMode":true` and `"halted":false`
   (before the recreate it showed `laneMode:false`).
4. `GET /api/tools` lists `STACK2-6` and `FA100056` (workcell-scoped: needs the real workcell selected) and
   `/api/settings/workcell` is the real workcell.
5. Pre-flight, both forms, last line exactly `PREFLIGHT OK`:
   `cd ~/data/nikko/galago-tools && GAL07_WEB_CONTAINER=galago-web-dev bash docs/runbooks/gal-07-live-check.sh | tail -1`
   and the same with `GAL07_REQUIRE_STACK_ENV=1`.
6. `bash .planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh baseline post-deploy` against
   `20261117T051917Z-pre-deploy.baseline.txt`: listener PIDs unchanged (8081 `6872`, 11010 `7490`,
   40012 `7491`, 40001 `2320808`); `STACK2-6.log` still 12 "Running command Transfer"; ledger sha256 still
   `5de43c84...670b` (9 records); `FA100056.log` Transfer count unchanged; `/api/runs` count 0 (no run
   RUNNING); `git status --porcelain -- controller` empty.
7. Record in this section: GO time (UTC), HEAD, container ids before and after, the flag-persistence choice,
   and every result above (data for runbook row 3a-11).

### GO and deploy record (09-04, executed 2026-11-17)

GO: the operator typed, verbatim, "Go env" (the typed GO with the ENV option) at the GO gate, after the
four-point checklist (latch cleared and arm idle, real workcell selected or "workcell later", plates on
nest-1/2/3, no run in progress and OK to restart galago-web-dev). The operator did not say "workcell later".
Claude's pre-deploy re-check at 08:33:06Z (the GO was acted on at this time): `/api/runs` count 0 (no run RUNNING),
`git status --porcelain -- controller` empty, `.env` absent (presence check only).

| Item | Result |
|------|--------|
| GO acted on (UTC) | 2026-11-17T08:33:06Z (`.env` written), recreate command returned 08:33:15Z, `/api/health` ok at 08:33:20Z (second poll) |
| galago-core HEAD at deploy | `486cf09db8fd177e7e9dd8c791226211b92c5b1c` (controller tree identical to `63d61e4`; no production change since `d09a047`) |
| Flag persistence choice | ENV: root `.env` containing only `GALAGO_PARALLEL_LANES=1` written (compose reads it automatically). `git check-ignore .env` prints `.env` (ignored, `.gitignore:45`); not staged, never committed. Content is a feature flag, not a credential |
| Command | `GALAGO_PARALLEL_LANES=1 docker compose -f docker-compose.dev.yml up -d --no-build galago-web-dev` printed `Recreate / Recreated / Starting / Started` for `galago-web-dev` |
| Container id before / after | `18b8638fc1c8` (up since 2026-11-16T22:51:51Z, flag empty) / `855c334135eb` |
| Image id before / after | `sha256:a331fa4d812aee4c152fc5fddcbb6a09b2ab23663aaa0d6aad8c8f14d01f6a0e` / the same (unchanged, `--no-build`) |
| Check 1: image + env | image unchanged; container id differs; `docker exec galago-web-dev printenv GALAGO_PARALLEL_LANES` prints `1`. PASS |
| Check 2: health | `/api/health` `{"status":"ok"}` after about 5 s. PASS |
| Check 3: laneStatus | `{"laneMode":true,"hasLaneRows":false,"halted":false,"haltReason":null,"queueBusy":false,"runningLanes":[],"failures":[],"overflow":0}`. PASS |
| Check 4: tools / workcell | `GET /api/tools` lists `STACK2-6` (id 5, type stack, `host.docker.internal:40012`, workcellId 1) and `FA100056` (id 6, type fast, `host.docker.internal:40001`, workcellId 1). PASS for the tools list. `/api/settings/workcell` still returns `{"value":"test"}`: the operator did not select a different workcell. **Open item, not a deploy failure: confirm before 09-05/09-09 that workcell `test` (workcellId 1, which holds STACK2-6 and FA100056) is the workcell the live events should run on, or reselect the real workcell. The `/api/tools` list is returned unscoped here, so this check does not by itself prove the selected workcell is the right one** |
| Check 5: pre-flight, both forms (`GAL07_WEB_CONTAINER=galago-web-dev`) | plain form and `GAL07_REQUIRE_STACK_ENV=1` form: last line exactly `PREFLIGHT OK`, exit 0 both. The STACK owner lock reads "held by galago (pid 7491), the expected single-owner state". PASS |
| Check 6: post-deploy baseline | `evidence/20261117T083332Z-post-deploy.baseline.txt` vs `20261117T051917Z-pre-deploy.baseline.txt`: listener PIDs unchanged (8081 `6872`, 11010 `7490`, 40012 `7491`, 40001 `2320808`); `STACK2-6.log` 12 "Running command Transfer" (unchanged); ledger sha256 `5de43c84a422c05ffb66f1bf9dee92b3fdf9183537c3e93d9bac1b08b353670b`, 9 records (unchanged); `FA100056.log` 1 Transfer line (unchanged; its total line count grew 145744 to 171341, the F.A.S.T. server's idle chatter, as it did between earlier baselines); `/api/runs` count 0; `git status --porcelain -- controller` empty. The only diff lines are label, HEAD, the FA100056 line count and `laneMode` false to true. PASS |
| Rollback not needed | no check failed. Rollback commands (above) stay available; to roll back also delete the root `.env` |

Nothing was sent to STACK2-6 or FA100056 and no run was started. The two CREATED runs in the store were not
touched.

Status: DEPLOYED (decision B). `galago-web-dev` runs with lanes on. Not covered by the original D-13 wording and
recorded as such: no production container, no `rollback-pre-lanes` image anchor.

## Freeze drill (LIV-02), row 3a-12 (recorded in galago-tools `034867c`, 09-08)

### Rig (09-05, D-10), 2026-11-17

The drill runs on the deployed lanes-on build (`galago-web-dev`, decision B), inside an isolated `uat-sim`
workcell, against two simulated tool servers on host ports 40091 and 40092. The real STACK2-6 (:40012) and
FA100056 (:40001) stay connected and idle. Claude sends nothing to any tool; only the sim servers are started.

Launch commands (RESEARCH A1: the same module form as the real servers' own command lines, other ports; run by
`tools/phase9-ctl.sh start-sim stack|fast`, which refuses a port that already listens):

| Sim | Command | cwd | Port | Log |
|-----|---------|-----|------|-----|
| STACK | `~/data/nikko/galago-tools/.venv/bin/python3 -m tools.stack.server --port=40091` under `setsid -f nohup`, stdin `/dev/null` | `~/data/nikko/galago-tools` | 40091 | `~/.local/state/galago-phase9/sim-stack-20261117T083904Z.log` |
| F.A.S.T. | `~/data/nikko/galago-tools/.venv/bin/python3 -m tools.fast.server --port=40092` under `setsid -f nohup`, stdin `/dev/null` | `~/data/nikko/galago-tools` | 40092 | `~/.local/state/galago-phase9/sim-fast-20261117T083905Z.log` |

Sim PIDs (current, from `ss -ltnp`): SIM-STACK `23042` on 40091, SIM-FAST `23184` on 40092. Neither equals a real
listener PID (8081 `6872`, 11010 `7490`, 40012 `7491`, 40001 `2320808`). The PID files are
`~/.local/state/galago-phase9/sim-stack.pid` and `sim-fast.pid`. Stop only with
`phase9-ctl.sh stop-sim stack|fast` (kills one PID, never by name, 09-07).

Launch history, stated plainly: the first launch (SIM-STACK pid `17911`, SIM-FAST pid `20917`, 08:36 to 08:38Z)
was stopped and relaunched (pids above, 08:39Z) after a defect in `phase9-ctl.sh start-sim` was found and fixed
(see 09-05-SUMMARY, Rule 1): the old form left a waiting parent shell that kept the caller's stdout pipe open,
so `PID=$(phase9-ctl.sh start-sim ...)` hung until the harness timeout. The fix is `setsid -f`. Both stops used
`stop-sim`, which refused nothing and signalled only the two sim PIDs. The sim servers had not been configured
yet, so nothing was lost.

The sim servers start unconfigured and are made simulated only by the operator's Configure with Simulate on
(base server `Configure` returns SUCCESS before `_configure` when `simulated` is set; in simulated mode STACK
`_dispatchCommand` never opens the manager connection, lock or ledger).

Baselines (all by `phase9-ctl.sh baseline`, reads only):

| Baseline | File | Result |
|----------|------|--------|
| pre-drill | `evidence/20261117T083601Z-pre-drill.baseline.txt`, `.queue.json`, `.tracefiles.txt` | `laneMode:true`, `halted:false`, `queueBusy:false`; listeners 8081 `6872`, 11010 `7490`, 40012 `7491`, 40001 `2320808`, 40091 and 40092 empty; trace folder `1794670020`, files `FA100056.log`, `STACK2-6.log`, `Tool Box.log`, `web_server.log`; `STACK2-6.log` 12 "Running command Transfer" (52 "Running command"); `FA100056.log` 1 Transfer (4 "Running command"); ledger sha256 `5de43c84...670b`, 9 records. Identical to the post-deploy baseline except label, time and HEAD |
| post-sim-launch (first launch) | `evidence/20261117T083845Z-post-sim-launch.baseline.txt`, `.tracefiles.txt` | Only diff vs pre-drill: label, time, and 40091 `17911` / 40092 `20917` now listen. Real PIDs, trace folder, file list, counts and ledger sha unchanged. Superseded by the relaunch below |
| post-sim-relaunch | `evidence/20261117T083912Z-post-sim-relaunch.baseline.txt`, `.tracefiles.txt` | Only diff vs pre-drill: label, time, and 40091 `23042` / 40092 `23184` listen. Real PIDs unchanged, trace folder `1794670020` unchanged, file list identical (`diff` empty), `STACK2-6.log` 12 Transfer, `FA100056.log` 1 Transfer, ledger sha and 9 records unchanged. A hand-launched server wrote only to its own sim log |

`phase9-ctl.sh check-guards`: `refusals verified for 8 real-listener/sim-port pairs`, `GUARDS OK`.

Selected workcell as found (for the switch back): `test` (workcellId 1, location `test`), the only workcell in the
store; it holds `STACK2-6` (id 5, `host.docker.internal:40012`, manager 10.150.1.125:5005) and `FA100056` (id 6,
`host.docker.internal:40001`, host 10.150.1.125:5003). The real tools live in `test`; there is no separate
"real" workcell. `uat-sim` does not exist yet (RESEARCH A2 confirmed): the operator creates it in the rig step.
While `uat-sim` is selected, `/api/tools` hides STACK2-6 and FA100056 (`tool.getAll` is workcell-scoped), so
pre-flight check 6 blocks; 09-07 selects `test` again before event 1.

Rig configuration (09-05 Task 2), 2026-11-17 ~08:56 to 08:57Z. **Performed by Claude at the user's request**
(the user replied "Can you set it up for me" to the operator steps). This is the narrow D-18 amendment recorded in
09-CONTEXT.md; the operator still owns Start, Freeze and every recovery control, and Claude never drove a real
tool. No motion is possible on the sim tools. The `/api/*` calls went to `http://localhost:3010` (production
`galago-web-dev`); the tRPC call used `/api/trpc/tool.configure`. Hosts are the documentation-range placeholders.

| Step | Call | Result |
|------|------|--------|
| 1. Create workcell | `POST /api/workcells` `{"name":"uat-sim","location":"sim",...}` | workcell id `3` (the real workcell `test` is id 1, untouched) |
| 2. Select it | `POST /api/settings/workcell` `{"value":"uat-sim"}` then `GET /api/settings/workcell` | `{"value":"uat-sim"}`; `GET /api/tools` now `[]`, so the next adds could only land in uat-sim |
| 3. Add SIM-STACK | `POST /api/tools` type `stack`, ip `host.docker.internal`, port `40091`, config `{"simulated":true,"toolId":"SIM-STACK","stack":{"host":"192.0.2.1","port":5005,"transfer_timeout_s":300,"ledger_dir":"/tmp/uat-sim-ledger"}}` | tool id `9`, workcellId `3` |
| 4. Add SIM-FAST | `POST /api/tools` type `fast`, ip `host.docker.internal`, port `40092`, config `{"simulated":true,"toolId":"SIM-FAST","fast":{"host":"192.0.2.2","port":5003,"expected_tray_id":90,"run_timeout_s":0}}` | tool id `10`, workcellId `3` |
| 5. Simulate + Configure | per tool: `POST /api/trpc/tool.configure` `{"json":{"toolId":NAME,"config":{"toolId":NAME,"simulated":true,"<type>":{...}}}}`, one call each | HTTP 200 both; `tool.status` then reports `SIMULATED` for SIM-STACK and SIM-FAST |

Simulate-before-Configure, stated plainly: there is no separate Simulate setter in the API. The UI Simulate switch
itself issues `tool.configure` with `simulated:true` (`ToolConfigEditor.saveConfig`), and the tool record also stores
`simulated:true` (so Connect All, which builds its payload from the stored config, also sends `simulated:true`).
The one Configure per tool therefore carried `simulated:true`; base server `Configure` then returns SUCCESS before
`_configure`, so nothing was dialed to 192.0.2.1 / 192.0.2.2 and no non-simulated Configure was ever sent. Before each
Configure, Claude re-read the tool record and asserted: selected workcell `uat-sim` (id 3), tool list exactly
SIM-STACK + SIM-FAST, the tool's name, type, address `host.docker.internal`, port (40091 stack / 40092 fast), instrument
host (192.0.2.1 / 192.0.2.2), `simulated:true`, no `10.150.1.125`, no port 40001 or 40012. All assertions passed.

Read-back (D-18 verification):

| Check | Result |
|-------|--------|
| `GET /api/settings/workcell` | `{"value":"uat-sim"}` |
| `GET /api/tools` | exactly `SIM-STACK` (`host.docker.internal:40091`, workcellId 3) and `SIM-FAST` (`host.docker.internal:40092`, workcellId 3); no `10.150.1.125` anywhere; no port 40001 or 40012 |
| `tool.status` | both `SIMULATED` (SIM-FAST `run_state` idle) |
| Baseline `evidence/20261117T085710Z-post-rig-config.baseline.txt`, `.tracefiles.txt` | vs pre-drill: only label, time, HEAD, the sim listeners (40091 `23042`, 40092 `23184`, unchanged since launch) and `selected_workcell` `test` to `uat-sim` differ. Real PIDs 8081 `6872`, 11010 `7490`, 40012 `7491`, 40001 `2320808` unchanged; trace folder `1794670020` and file list identical; `STACK2-6.log` 12 Transfer (52 "Running command"); `FA100056.log` 1 Transfer (4 "Running command"); ledger sha256 `5de43c84...670b`, 9 records; `laneStatus` laneMode true, halted false, queueBusy false |

`uat-sim` is left selected. Nothing was imported, queued or started. 09-07 switches back to `test` (workcellId 1)
before event 1; while `uat-sim` is selected pre-flight check 6 blocks, as expected.

### Drill protocol import and pre-GO record (09-06 Task 1), 2026-11-17

Imported by Claude into `uat-sim` only (D-10, D-18: Claude registers, the operator runs). The import only writes a
protocol row; it sends nothing to any tool.

| Item | Result |
|------|--------|
| Call | `POST /api/trpc/protocol.import` body `{"json":{"workcellId":3,"protocol":<the .protocol object of protocols/09-sim-drill.protocol.json>}}`, HTTP 200 at 08:59:40Z |
| Reply | `evidence/20261117T085940Z-drill-import.json`: protocol id `8`, name "LIV-02 sim drill: lanes halt and freeze (uat-sim only)", `workcellId` 3, mode `script`, 24 parameters |
| Workcell | `uat-sim` id 3 (`GET /api/settings/workcell` returns `uat-sim`); `GET /api/workcells` shows the drill protocol under uat-sim only; the real workcell `test` (id 1) still lists only protocol 4 "test" |
| Tools in uat-sim | exactly `SIM-STACK` (id 9, `host.docker.internal:40091`) and `SIM-FAST` (id 10, `host.docker.internal:40092`), both stored `simulated:true`; `GET /api/tools` lists nothing else |
| Real-name refusal (checked before import, T-09-23) | the script throws "the drill must not address a real tool" when `stack_tool` or `fast_tool` equals `STACK2-6` or `FA100056` (case-insensitive), before the first galago call; the parameter defaults are `SIM-STACK` and `SIM-FAST` |
| Sim servers | SIM-STACK pid `23042` (port 40091) and SIM-FAST pid `23184` (port 40092), both still up (about 20 minutes), not restarted |
| Real listeners | 8081 `6872`, 11010 `7490`, 40012 `7491`, 40001 `2320808`, all unchanged |
| Baseline | `evidence/20261117T085943Z-pre-drill-go.baseline.txt`: diff against `20261117T085710Z-post-rig-config.baseline.txt` is only label, time and HEAD (`2de6b0b`). `STACK2-6.log` 12 Transfer (52 "Running command"), `FA100056.log` 1 Transfer (4), ledger sha256 `5de43c84...670b`, 9 records; `galago_core_controller_dirty_lines=0` |
| Queue snapshot | `evidence/20261117T085944Z-pre-drill-go.queue.json`: `laneStatus` `laneMode:true`, `halted:false`, `queueBusy:false`, `runningLanes:[]`, `failures:[]`; `getAll` 6 rows, all `COMPLETED` (queueIds 27 to 32), no CREATED or STARTED row; `getAllRuns` 2 runs, both `CREATED` with no live rows (the same two stale runs recorded at deploy; nobody presses Start on them) |

Operator note: those two stale `CREATED` runs belong to earlier work in the shared store. The drill run queued
for scenario 1 is a new run (batch label `DRILL-S1`); the Start confirmation must list only the drill rows.

### Drill GO (D-14)

| Item | Value |
|------|-------|
| Operator's reply (verbatim) | `go` |
| UTC time | 2026-11-17T09:24:03Z |
| How recorded | The reply was typed in the orchestrator conversation, not in a UI; the UTC time is the orchestrator-recorded time of that message |
| Gate | 09-06 Task 2, `checkpoint:decision`, `gate="blocking-human"`; options were `go` and `stop`; the literal word `go` was typed |
| State at the gate | uat-sim selected with only SIM-STACK and SIM-FAST (Simulate on); drill protocol id 8 imported; pre-GO baseline and snapshot (above) show `halted:false` and no CREATED or STARTED row; real listener PIDs unchanged |

### Scenario 1

**Verdict: PASS** (D-11 scenario 1, LIV-02 part 1 of 3). A stack-step failure while the F.A.S.T. step runs halted the lanes; the
other lane's step finished and was never aborted; the later row was held until the operator's Start; only that Start
retried the failed row and finished the run. Judged by Claude from the three operator-taken snapshots and the sim server logs
(all read only). The operator reported "scenario 1 done" at about 2026-11-17T09:42:57Z with no deviations. Claude did not
queue, start, stop or freeze anything (D-18).

Run: `1596cf7f4d01e7000` (protocol 8, uat-sim), batch label DRILL-S1, queueIds 48 to 52. Row times are the raw
`startedAt` / `failedAt` / `completedAt` values from the snapshots, UTC. The sim logs are local time (UTC+7) and match them.

| queueId | Row | Lane | Start | End | Final status |
|---------|-----|------|-------|-----|--------------|
| 48 | Tool Box note | primary | 09:36:47.955 | 09:36:47.957 | COMPLETED |
| 49 | SIM-STACK `d-in1` | primary | 09:36:49.458 | 09:37:24.498 | COMPLETED |
| 50 | SIM-FAST transfer (`laneBarrier`) | fast | 09:37:25.472 | 09:38:45.547 (80.1 s) | COMPLETED |
| 51 | SIM-STACK `d-x1`, attempt 1 | primary | 09:37:26.000 | FAILED 09:37:35.044 (`1 CANCELLED: Call cancelled`) | FAILED |
| 51 | SIM-STACK `d-x1`, operator retry | primary | 09:40:02.303 | 09:40:37.331 | COMPLETED |
| 52 | SIM-STACK `d-out1` (`laneBarrier`) | primary | 09:40:38.831 | 09:41:13.869 | COMPLETED |

Timeline: run created 09:36:28.315 (`createdAt`); first row started 09:36:47.955; `d-x1` started 0.528 s after the SIM-FAST step
(overlap, inside the 1500 ms loop tolerance of the D-05 rule); sim STACK server stopped by the operator, `d-x1` FAILED 9.04 s
into its step while SIM-FAST was 9.6 s into its 80 s step; at-halt snapshot 09:37:51Z; SIM-FAST COMPLETED 09:38:45.547;
halted snapshot 09:38:50Z; sim STACK restarted 09:39:00Z (new pid `101131`) and Configured with `simulated: true` at 09:39:10Z;
operator Start, `d-x1` retry started 09:40:02.303; `d-out1` started 1.5 s after the retry completed (one loop delay); done
snapshot 09:42:42Z.

Snapshots (`evidence/`), each judged against the plan's criteria:

| Snapshot | Facts read from it | Criterion |
|----------|--------------------|-----------|
| `20261117T093751Z-drill-s1-at-halt.queue.json` (09:37:51Z) | q51 `d-x1` FAILED, `failedAt` 09:37:35.044; q50 SIM-FAST STARTED (`runningLanes` lists it on lane `fast`); q52 `d-out1` CREATED; `laneStatus` `halted:true`, `haltReason:"failure"`, one failure (primary, SIM-STACK, queueId 51, banner true) | met |
| `20261117T093850Z-drill-s1-halted.queue.json` (09:38:50Z) | q50 SIM-FAST COMPLETED (never ABORTED); q51 still FAILED; q52 `d-out1` still CREATED, though the fast lane had finished 4.5 s earlier; `halted:true`, `haltReason:"failure"`, `runningLanes:[]`, failure still listed | met |
| `20261117T094242Z-drill-s1-done.queue.json` (09:42:42Z) | q48 to q52 all COMPLETED; `halted:false`, `haltReason:null`, `failures:[]`, `runningLanes:[]`, `queueBusy:false` | met |

One send per queueId, from the sim server logs (`~/.local/state/galago-phase9/`, read only): the first SIM-STACK server
(`sim-stack-20261117T083904Z.log`) logged "Running command Transfer" at 16:36:49 (`d-in1`) and 16:37:26 (`d-x1` attempt 1, no
response line: the server was stopped mid-step); SIM-FAST (`sim-fast-20261117T083905Z.log`) logged one Transfer at 16:37:25 and
its SUCCESS at 16:38:45; the restarted SIM-STACK (`sim-stack-20261117T093900Z.log`) logged Transfers at 16:40:02 (`d-x1` retry)
and 16:40:38 (`d-out1`), both SUCCESS. That is five sends for four transfer queueIds, the one extra being the operator-retried
failed row. No Transfer line on either sim server between the failure (09:37:35Z) and the operator's Start (09:40:02Z): no
auto-retry and no auto-start of `d-out1` during the halt, including the 77 s between SIM-FAST completing and the Start. The
note row is the Tool Box and sends nothing to a tool.

Real tools untouched (T-09-23): `evidence/20261117T094420Z-post-drill-s1.baseline.txt` (09:44:20Z) against
`20261117T085943Z-pre-drill-go.baseline.txt`: the only differing lines are label, time, galago-core HEAD and the SIM-STACK
listener pid (`23042` to `101131`, the operator's restart). Real listener PIDs unchanged: 8081 `6872`, 11010 `7490`, 40012
`7491`, 40001 `2320808`. `STACK2-6.log` 4508 lines, 12 "Running command Transfer" (52 "Running command"); `FA100056.log` 1
Transfer (4 "Running command"); ledger sha256 `5de43c84...670b`, 9 records; `galago_core_controller_dirty_lines=0`;
`laneStatus` `laneMode:true`, `halted:false`, `queueBusy:false`. Sim processes now: SIM-STACK `101131` (port 40091, started
09:39:00Z), SIM-FAST `23184` (port 40092, unchanged). The workcell is still `uat-sim` with only SIM-STACK and SIM-FAST. Nothing
latched: `laneStatus` is clean, so no latch is left for scenario 2 (RESEARCH Pitfall 6).

Observations, none a failed criterion:

- A retry overwrites `startedAt` but keeps the old `failedAt` and error: in the done snapshot q51 is COMPLETED with
  `startedAt` 09:40:02.303 and still carries `failedAt` 09:37:35.044 and the `CANCELLED` error. The row `status` is authoritative.
  The first attempt's `startedAt` (09:37:26.000) survives only in the at-halt and halted snapshots, which confirms RESEARCH
  Pitfall 3 and why the snapshot before the operator's Start matters.
- The stored run record (`getAllRuns` and `/api/runs`, one blob per run) reads `CREATED` in all three snapshots and still after
  every row COMPLETED, exactly as the two stale earlier runs do. Row statuses and `laneStatus` are the evidence used here. The
  operator's run-card status in the UI was not observed by Claude, so "run COMPLETED" rests on the five COMPLETED rows.
- Evidence limits: the operator's actions (stop-sim, restart, Configure, Start) are not logged by Claude; they are inferred
  from the sim logs and row timestamps, which agree with the operator's account. The operator's `CTL()` shell function
  (`phase9-ctl.sh "$@" </dev/null`) only wraps the guarded script.

### Scenario 2

**Verdict: PASS** (D-11 scenario 2, LIV-02 part 2 of 3). A F.A.S.T.-step failure while the stack step ran halted the lanes;
the stack lane's step finished and was never aborted; the later row was held until the operator's Start; only the operator
re-armed and finished the run. Judged by Claude from the three operator-taken snapshots and the sim server logs (all read
only). One unplanned event is recorded below (a second failed retry), which does not break a D-11 clause. The operator
reported "scenario 2 and 3 done, workcell switched back" at about 2026-11-17T09:58Z (one reply for both scenarios) with no
deviations. Claude did not queue, start, stop or freeze anything (D-18).

Run: `1596d5b2f101e7000` (protocol 8, uat-sim), batch label DRILL-S2, queueIds 53 to 57. Row times are the raw `startedAt` /
`failedAt` / `completedAt` values from the snapshots, UTC (HH:MM:SS.mmm). The sim logs are local time (UTC+7) and match them.

| queueId | Row | Lane | Start | End | Final status |
|---------|-----|------|-------|-----|--------------|
| 53 | Tool Box note | primary | 09:50:08.980 | 09:50:08.981 | COMPLETED |
| 54 | SIM-STACK `d-in1` | primary | 09:50:10.482 | 09:50:45.498 | COMPLETED |
| 55 | SIM-FAST transfer, attempt 1 (`laneBarrier`) | fast | 09:50:46.497 | FAILED 09:50:49.374 (`1 CANCELLED: Call cancelled`) | FAILED |
| 56 | SIM-STACK `d-x1` | primary | 09:50:46.999 | 09:51:22.034 | COMPLETED (never ABORTED) |
| 55 | SIM-FAST transfer, attempt 2 (see below) | fast | not recorded | FAILED 09:51:52.534 (`14 UNAVAILABLE ... ECONNREFUSED 172.17.0.1:40092`) | FAILED |
| 55 | SIM-FAST transfer, final attempt | fast | 09:52:22.885 | 09:53:42.906 (80.0 s) | COMPLETED |
| 57 | SIM-STACK `d-out1` (`laneBarrier`) | primary | 09:53:43.932 | 09:54:18.970 | COMPLETED |

Timeline: run created 09:50:01.186; `d-x1` started 0.502 s after the SIM-FAST step (overlap, inside the 1500 ms loop tolerance of
the D-05 rule). The operator stopped the sim F.A.S.T. server (`CTL stop-sim fast`); SIM-FAST FAILED 2.9 s into its step while
`d-x1` was 2.4 s into its 35 s step; at-halt snapshot 09:51:03Z (`d-x1` 17 s in); `d-x1` COMPLETED 09:51:22.034; halted snapshot
09:51:30Z (8 s after `d-x1` finished, `d-out1` still CREATED); sim F.A.S.T. restarted 09:51:39Z (new pid `121058`) and Configured
with `simulated: true` at 09:52:09Z; final attempt started 09:52:22.885; `d-out1` started 1.03 s after SIM-FAST completed (one
loop delay); done snapshot 09:54:21Z.

Snapshots (`evidence/`), each judged against the plan's criteria:

| Snapshot | Facts read from it | Criterion |
|----------|--------------------|-----------|
| `20261117T095103Z-drill-s2-at-halt.queue.json` (09:51:03Z) | q55 SIM-FAST FAILED (`failedAt` 09:50:49.374); q56 `d-x1` STARTED (`runningLanes` lists it on lane `primary`); q57 `d-out1` CREATED; q53 and q54 COMPLETED; `laneStatus` `halted:true`, `haltReason:"failure"`, one failure (lane fast, SIM-FAST, queueId 55, banner true) | met |
| `20261117T095130Z-drill-s2-halted.queue.json` (09:51:30Z) | q56 `d-x1` COMPLETED 09:51:22.034 (never ABORTED, no `abortedAt`); q55 still FAILED; q57 `d-out1` still CREATED; `halted:true`, `haltReason:"failure"`, `runningLanes:[]`, failure still listed | met |
| `20261117T095421Z-drill-s2-done.queue.json` (09:54:21Z) | q53 to q57 all COMPLETED; `halted:false`, `haltReason:null`, `failures:[]`, `runningLanes:[]`, `queueBusy:false` | met |

One send per queueId, from the sim server logs (`~/.local/state/galago-phase9/`, read only): SIM-STACK
(`sim-stack-20261117T093900Z.log`, not restarted in this scenario) logged "Running command Transfer" at 16:50:10 (`d-in1`),
16:50:47 (`d-x1`) and 16:53:43 (`d-out1`), each SUCCESS: three sends for three stack queueIds. The first SIM-FAST process
(`sim-fast-20261117T083905Z.log`) logged one Transfer at 16:50:46 with no response line (stopped mid-step); the restarted
SIM-FAST (`sim-fast-20261117T095139Z.log`) logged one Transfer at 16:52:22, SUCCESS 16:53:42. That is two sends for queueId 55,
the operator-retried failed row; every other queueId has exactly one. No Transfer line on either sim server between the failure
(09:50:49Z) and the operator's re-arm (first new Transfer, SIM-FAST 09:52:22Z), apart from `d-x1` which had started 2.4 s before
the failure: no auto-retry and no auto-start of `d-out1` during the halt, including the 8 s from `d-x1` finishing to the halted
snapshot and the 52 s from that snapshot to the final Start. The note row is the Tool Box and sends nothing to a tool.

Unplanned event, stated plainly: the done snapshot shows q55 COMPLETED but carrying `failedAt` 09:51:52.534, which is later than
the first failure (09:50:49.374) and 13 s after the SIM-FAST server came back (09:51:39Z) but 17 s before it was Configured
(09:52:09Z). A retry therefore ran and failed once more with `14 UNAVAILABLE ... ECONNREFUSED` (the gRPC channel's last error is
stamped 09:51:17.652Z, from the stopped server), and the operator pressed Start a further time at about 09:52:22Z after the
Configure. The SIM-FAST server log shows no Transfer for that middle attempt (it never reached the server), so no extra send
occurred. No snapshot was taken between the two retries, so the second halt is inferred from `failedAt` and from the row not
completing until 09:53:42.906; a retry of a FAILED row needs an operator Start, so both retries were operator-driven. The
plan's step order was "start-sim, Configure, then Start"; the middle Start evidently came before the Configure. The
operator's reply reported no deviation, so this is an observation to confirm, not a recorded operator account. Because the
run did not complete after the first re-arm, it took two Starts instead of one; `d-out1` stayed CREATED throughout, and the
only operator actions were Start presses, so the D-11 clauses (other-lane row finishes, never aborted, later row held,
only the operator re-arms and finishes) still hold.

Real tools: see the combined baseline in the Scenario 3 subsection (`evidence/20261117T095938Z-post-drill-s2-and-s3-before-teardown.baseline.txt`).
It was taken after scenario 3, not after scenario 2 alone, so it is labelled that way and not `post-drill-s2`; no per-scenario
baseline exists for scenario 2. The sim logs and the real tools' unchanged "Running command" counts are the scenario 2 evidence.

### Scenario 3

**Verdict: PASS** (D-11 scenario 3, LIV-02 part 3 of 3). The operator's Freeze lanes, pressed while SIM-FAST and `d-x1` both ran,
halted both lanes with `haltReason` freeze; both running rows finished COMPLETED and none was ABORTED; `d-out1` stayed CREATED
through the freeze, including the 17 s after the fast step finished; the operator's single Start re-armed and finished the
run. Judged by Claude from the three operator-taken snapshots and the sim server logs (read only). The operator reported
"scenario 2 and 3 done, workcell switched back" at about 2026-11-17T09:58Z with no deviations. Claude did not queue, start,
stop, freeze or switch anything (D-18).

Run: `1596d7f33081e7000` (protocol 8, uat-sim), batch label DRILL-S3, queueIds 58 to 62. Times are the raw snapshot values, UTC
(HH:MM:SS.mmm). The exact moment of the Freeze press was not recorded; the at-freeze snapshot (09:56:15Z) already shows the latch.

| queueId | Row | Lane | Start | End | Final status |
|---------|-----|------|-------|-----|--------------|
| 58 | Tool Box note | primary | 09:55:02.928 | 09:55:02.928 | COMPLETED |
| 59 | SIM-STACK `d-in1` | primary | 09:55:04.429 | 09:55:39.459 | COMPLETED |
| 60 | SIM-FAST transfer (`laneBarrier`) | fast | 09:55:40.440 | 09:57:00.499 (80.1 s) | COMPLETED (never ABORTED) |
| 61 | SIM-STACK `d-x1` | primary | 09:55:40.960 | 09:56:15.998 | COMPLETED (never ABORTED) |
| 62 | SIM-STACK `d-out1` (`laneBarrier`) | primary | 09:57:17.455 | 09:57:52.459 | COMPLETED |

Timeline: run created 09:54:56.226; `d-x1` started 0.520 s after the SIM-FAST step (overlap inside the 1500 ms tolerance);
operator Freeze lanes; at-freeze snapshot 09:56:15Z (both rows STARTED); `d-x1` COMPLETED 09:56:15.998; SIM-FAST COMPLETED
09:57:00.499; frozen snapshot 09:57:09Z (both done, `d-out1` CREATED, 8.5 s after the fast step ended and 53 s after the primary
lane went idle); operator Start, `d-out1` started 09:57:17.455; done snapshot 09:57:53Z.

Snapshots (`evidence/`), each judged against the plan's criteria:

| Snapshot | Facts read from it | Criterion |
|----------|--------------------|-----------|
| `20261117T095615Z-drill-s3-at-freeze.queue.json` (09:56:15Z) | q60 SIM-FAST STARTED and q61 `d-x1` STARTED (`runningLanes` lists both: primary 61, fast 60); q62 `d-out1` CREATED; q58, q59 COMPLETED; `laneStatus` `halted:true`, `haltReason:"freeze"`, `failures:[]` | met |
| `20261117T095709Z-drill-s3-frozen.queue.json` (09:57:09Z) | q60 and q61 COMPLETED, no ABORTED row and no `abortedAt`; q62 `d-out1` CREATED; `halted:true`, `haltReason:"freeze"`, `failures:[]`, `runningLanes:[]` | met |
| `20261117T095753Z-drill-s3-done.queue.json` (09:57:53Z) | q58 to q62 all COMPLETED; `halted:false`, `haltReason:null`, `failures:[]`, `runningLanes:[]`; `queueBusy:true` only because the snapshot came 1.0 s after the last row completed (09:57:52.459); a later read shows `queueBusy:false` | met |

One send per queueId, from the sim server logs (read only): SIM-STACK logged "Running command Transfer" at 16:55:04 (`d-in1`),
16:55:40 (`d-x1`) and 16:57:17 (`d-out1`), each SUCCESS; SIM-FAST (`sim-fast-20261117T095139Z.log`) logged one Transfer at
16:55:40, SUCCESS 16:57:00. Four sends for four transfer queueIds, no retry. No Transfer line on either sim server between
16:55:40 (the two rows already running) and the operator's Start at 16:57:17: nothing started while frozen, including the
primary lane's idle minute. The freeze aborted nothing, let both running rows
finish on their own, and did not auto-resume.

Switch back to the real workcell (D-11 step 6, T-09-28), read by Claude after the operator's report (09:58:19Z and again later):

| Check | Result |
|-------|--------|
| `GET /api/settings/workcell` | `{"value":"test"}`, the real workcell recorded in 09-05 (workcellId 1) |
| `GET /api/tools` | exactly `STACK2-6` (`host.docker.internal:40012`, workcellId 1) and `FA100056` (`host.docker.internal:40001`, workcellId 1) |
| `laneStatus` | `laneMode:true`, `halted:false`, `haltReason:null`, `failures:[]`, `runningLanes:[]`, `queueBusy:false` |
| `commandQueue.getAll` | 21 rows, all COMPLETED: no CREATED or STARTED row |
| `GET /api/runs` | 3 runs, the three drill runs, all stored status `CREATED`; no `RUNNING` run |

Baseline after both scenarios, before teardown: `evidence/20261117T095938Z-post-drill-s2-and-s3-before-teardown.baseline.txt`
(09:59:38Z) against `20261117T085943Z-pre-drill-go.baseline.txt`. Equal: real listener PIDs 8081 `6872`, 11010 `7490`, 40012
`7491`, 40001 `2320808`; trace folder `1794670020`; `STACK2-6.log` 4508 lines, 12 "Running command Transfer" (52 "Running
command"); `FA100056.log` 1 Transfer (4 "Running command"); ledger sha256 `5de43c84...670b`, 9 records;
`galago_core_controller_dirty_lines=0`. Different, all explained: label, time, HEAD; the sim listeners (40091 `23042` to
`101131`, 40092 `23184` to `121058`, the operator's restarts in scenarios 1 and 2); `selected_workcell` `uat-sim` to `test`.
One more difference needs an honest explanation: `FA100056.log` grew from 171341 to 172478 lines. All 1137 new lines (from
16:58:10 local, 09:58:10Z, the moment of the switch back to `test`) are the real FA100056 server's periodic
`GET http://10.150.1.125:5003/status` polls (130 requests, `HTTP/1.1 200 OK`, one every 5 s, with their httpcore debug lines).
There is no POST, no "Running command", no Configure and no ExecuteCommand among them. It is a read of the instrument's
status, which the web app issues while a UI session is polling the tool (inferred cause: the operator's tool list after the
switch back; Claude did not open one). The file also grew from 145744 to 171341 lines between the pre-deploy and post-deploy
baselines in earlier operator sessions, and stood still (171341) from 08:33Z to 09:44Z. It is not a command to the tool. The V-10 criteria (PIDs, "Running command" counts, trace folder, ledger sha256) are unchanged.

### Drill teardown (09-07 Task 3), 2026-11-17 10:01Z

Sim servers stopped by Claude with the guarded, port-resolved path only (`phase9-ctl.sh stop-sim stack`, then `stop-sim fast`,
each with stdin `/dev/null`): SIM-STACK pid `101131` and SIM-FAST pid `121058`, each the single PID on 40091 / 40092 with
`--port=NNNNN` on its command line and not a real-port listener. Both exited within the guard's 15 s wait. `ss` shows nothing on
40091 and 40092 and neither PID exists. Real listeners after the stops: 8081 `6872`, 11010 `7490`, 40012 `7491`, 40001
`2320808`, the same PIDs as before the drill (V-10, T-09-27).

| Check | Result |
|-------|--------|
| Baseline | `evidence/20261117T100156Z-post-drill.baseline.txt` (10:01:56Z); a second one, `20261117T100221Z-post-drill-final.baseline.txt`, was taken after the two pre-flight runs and differs from it only by label, time and `FA100056.log` line count |
| Queue snapshot | `evidence/20261117T100157Z-post-drill.queue.json`: `laneStatus` `laneMode:true`, `halted:false`, `haltReason:null`, `failures:[]`, `runningLanes:[]`, `queueBusy:false`; `getAll` 21 rows, all COMPLETED |
| Trace folder and files | `evidence/20261117T100156Z-post-drill.tracefiles.txt`; folder `1794670020` in both baselines; `diff` against `20261117T083601Z-pre-drill.tracefiles.txt` prints nothing (`FA100056.log`, `STACK2-6.log`, `Tool Box.log`, `web_server.log`) |
| Pre-drill vs post-drill baseline (`diff`) | Only label, time, galago-core HEAD, and the `FA100056.log` line count differ. Listeners 40091 and 40092 are empty in both; `selected_workcell` is `test` in both |
| Real listener PIDs | 8081 `6872`, 11010 `7490`, 40012 `7491`, 40001 `2320808`: equal |
| "Running command" counts | `STACK2-6.log` 4508 lines, 52 "Running command", 12 Transfer; `FA100056.log` 4 "Running command", 1 Transfer: equal |
| Ledger | sha256 `5de43c84a422c05ffb66f1bf9dee92b3fdf9183537c3e93d9bac1b08b353670b`, 9 records: equal |
| `galago_core_controller_dirty_lines` | 0, as before |

The `FA100056.log` line count is the one difference, explained in the Scenario 3 subsection: the new lines (1973 by 10:02Z, now
growing as the real tool's status is polled) are 179 `GET http://10.150.1.125:5003/status` requests plus their httpcore debug lines.
A search of all of them finds no POST, PUT, DELETE, "Running command", ExecuteCommand, Configure, Received, ERROR or
WARNING line, and no HTTP request other than that status GET. It is a status read, not a command to the tool. The plan's
V-10 criteria (PIDs, "Running command" counts, trace folder and files, ledger sha256) all hold.

V-11 (clean exit, RESEARCH Pitfalls 5 and 6):

| Check | Result |
|-------|--------|
| `laneStatus` | `halted:false`, `haltReason:null`, `failures:[]`, `runningLanes:[]`, `queueBusy:false` |
| `commandQueue.getAll` | 21 rows, all COMPLETED: no CREATED or STARTED row |
| `GET /api/runs` | 3 runs (the three drill runs), all stored `CREATED`, no `RUNNING` run |
| `GET /api/settings/workcell` | `{"value":"test"}`, the real workcell; `GET /api/tools` lists `STACK2-6` and `FA100056` |
| Pre-flight form 1 (`GAL07_WEB_CONTAINER=galago-web-dev`, from `~/data/nikko/galago-tools`) | last line `PREFLIGHT OK`, exit 0 |
| Pre-flight form 2 (`GAL07_REQUIRE_STACK_ENV=1`, same container) | last line `PREFLIGHT OK`, exit 0; the owner lock at 10.150.1.125:5005 is held by galago pid 7491, the expected single-owner state |

The D-13 amendment applies: the deployed container is `galago-web-dev`, so `GAL07_WEB_CONTAINER=galago-web-dev` was set for
both pre-flight forms. No latch, stale run or `uat-sim` selection is left to leak into event 1.

Left behind, inert and recorded: the `uat-sim` workcell (id 3), the two SIM tool records (SIM-STACK id 9, SIM-FAST id 10) and
the imported drill protocol (id 8) remain in the store; they are in a separate workcell and send nothing. The three drill runs
and the two older runs stay stored as `CREATED` (see the finding below). Nobody should press Start on any of them; event 1
queues a fresh run.

### Finding (not a D-11 clause): stored run status stays CREATED in lanes mode

In all three scenarios the stored run record (`getAllRuns`, `/api/runs`) read `CREATED` in every snapshot, including after every
row of the run was COMPLETED: scenario 1 run `1596cf7f4d01e7000`, scenario 2 run `1596d5b2f101e7000`, scenario 3 run
`1596d7f33081e7000` (S2 and S3 done snapshots, and a read at 10:02Z, all `CREATED`). The row statuses and `laneStatus` are the
evidence used for the verdict; the operator's run-card status in the UI was not observed by Claude. This confirms the 09-06
observation: in lanes mode the run record is not advanced to COMPLETED when the rows finish. It does not affect the lane-halt,
freeze or recovery behaviour proven here, but a verifier or operator that reads run status instead of row status will see
every lanes run as unfinished. Flagged for follow-up; not fixed here (D-10: no hot-fix during the drill).

### LIV-02 verdict

**PASS.** Every D-11 clause holds in all three scenarios, V-10 holds and V-11 holds. The deployed lanes-on build
(`galago-web-dev`, decision B) halted on a failure from either lane, held later rows through both a failure halt and the
operator's Freeze, aborted nothing, and resumed only on the operator's Start, against two simulated tool servers in the isolated
`uat-sim` workcell, with the real STACK2-6 and FA100056 untouched.

| Clause | S1: stack fails while fast runs (09-06) | S2: fast fails while stack runs | S3: operator Freeze lanes |
|--------|------------------------------------------|----------------------------------|----------------------------|
| Other lane's running row finishes COMPLETED, never ABORTED | q50 SIM-FAST COMPLETED, met | q56 `d-x1` COMPLETED 09:51:22.034, met | q60 SIM-FAST and q61 `d-x1` both COMPLETED, none ABORTED, met |
| Later row held CREATED while halted (no auto-start, no auto-retry) | q52 `d-out1` CREATED in the halted snapshot, met | q57 `d-out1` CREATED in the halted snapshot, met | q62 `d-out1` CREATED in the frozen snapshot, 8.5 s after the fast step ended, met |
| Halted with the right reason | `halted:true`, `haltReason` failure, met | `halted:true`, `haltReason` failure, met | `halted:true`, `haltReason` freeze, `failures:[]`, met |
| Only the operator's Start re-armed and finished the run | done snapshot: all COMPLETED, `halted:false`, met | done snapshot: all COMPLETED, `halted:false`, met (two operator Starts; see the unplanned event) | done snapshot: all COMPLETED, `halted:false`, met |
| One send per queueId, none during the halt (sim logs) | met, one extra for the operator-retried row | met, two sends for the operator-retried q55 | met, four sends for four transfer queueIds |
| V-10: real tools untouched | met (post-drill-s1 baseline) | met (combined baseline) | met (combined baseline) |

Overall V-10 (D-10): PIDs, "Running command" counts, trace folder and files and ledger sha256 equal the pre-drill baseline; the
`FA100056.log` line growth is read-only status polling. Overall V-11: clean queue, `test` selected, both pre-flight forms
`PREFLIGHT OK`, sim ports closed.

Caveats stated, none a failed clause: (1) scenario 2 took two operator Starts because a retry ran before the SIM-FAST server was
Configured and failed once more, with no snapshot between; (2) the exact time of the Freeze press and the operator's other
actions are inferred from snapshots and sim logs, not logged by Claude; (3) the run record stays `CREATED` (finding above);
(4) scenarios 2 and 3 share one baseline, labelled `post-drill-s2-and-s3-before-teardown`, taken after both. Data for runbook row
3a-12 (09-08).

## Live event 1, row 3a-13

D-02 decided (amended, above). Event 1 under the amended D-02: overlap source `nest-3/deck1/A1`, overlap destination
`nest-1/deck1/A1`, out1 destination `nest-1/deck1/A1`.

### Operator readiness and pre-GO record (09-09 Task 1), 2026-11-17

Precondition: this file records "pair confirmed under AMENDED D-02" and the LIV-02 verdict reads PASS. Met.

**Operator readiness (reply "ready" at 2026-11-17T10:31:28Z).** The operator confirmed the Task 1 steps (latch, idle and gripper
reads, plate 1 lifted off nest-1, the nest-3 -> nest-1 -> nest-3 round trip, plates restored) with the one word "ready". The
operator did NOT paste the tool-page replies for steps 1, 2, 4 and 5, and did NOT answer whether anything was re-taught or moved
since 10:02Z. Both gaps are recorded, not waived: the evidence below is from Claude's read-only look at the local trace log and
ledger, and the re-teach question is asked again at the GO (checklist item 2). The record is
`evidence/20261117T103338Z-e1-readiness.txt`.

| Item | Evidence (local files, read-only) |
|------|------------------------------------|
| `GetFailureLatch` | `STACK2-6.log` 10:27:51Z "Running command GetFailureLatch"; reply body not logged, so `latched:false` is NOT proven by a log. Re-read by the operator at the GO |
| `GetRobotStates` | 10:27:59Z, GET robot-state 200 OK; body not logged, `idle` not proven by a log. Re-read at the GO |
| `GetLabwarePresence` (robot stack2-6) | 10:28:04Z, GET labware/presence 200 OK, `Content-Length: 20`, the length of `{"hasLabware":false}` (a true reply is 19). Weak evidence, not a pasted reply |
| Round-trip Transfer 1, nest-3 -> nest-1 | 10:29:45Z; ledger `20261117T102945344089-51bbd341` done / ran, task completed, elapsed 00:00:29, guid `d020ab4c-b025-44d2-a760-71eef286a73b` |
| Round-trip Transfer 2, nest-1 -> nest-3 | 10:30:31Z; ledger `20261117T103031099718-33d54943` done / ran, task completed, elapsed 00:00:29, guid `efee3463-e37d-4722-8537-c29348784022` |
| Errors | no ERROR, WARNING, refusal, failure, latch or retry line in the lines appended since 10:02Z; no Transfer line or ledger record after the second Transfer; `FA100056.log` still 1 "Running command Transfer" (4 "Running command") |

Round-trip verdict: both Transfers are done/ran, in the expected order and directions, and nothing else moved. This answers the
09-03 risk input (3 of 5 operator nest-3 / nest-1 moves failed on 2026-11-17 04:40-05:03Z) for the 10:29-10:31Z moves only. It
does not prove the latch, idle and gripper reads themselves, so they are re-read at the GO.

**Claude prep (reads plus one protocol import; every CTL call with stdin `/dev/null`).**

| Item | Result |
|------|--------|
| Pre-flight form 1 (`GAL07_WEB_CONTAINER=galago-web-dev`) | last line `PREFLIGHT OK`, exit 0, 10:32:40Z |
| Pre-flight form 2 (+ `GAL07_REQUIRE_STACK_ENV=1`) | last line `PREFLIGHT OK`, exit 0, 10:32:41Z; owner lock at 10.150.1.125:5005 held by galago pid 7491 |
| `docker exec galago-web-dev printenv GALAGO_PARALLEL_LANES` | `1` |
| `laneStatus` | `laneMode:true`, `halted:false`, `haltReason:null`, `failures:[]`, `runningLanes:[]`, `queueBusy:false` |
| Selected workcell | `test` (id 1); `GET /api/tools` lists STACK2-6 (id 5) and FA100056 (id 6), both `workcellId` 1 |
| Queue | `getAll` 21 rows, all COMPLETED: no CREATED or STARTED row. `GET /api/runs` shows 3 runs, all stored `CREATED`, none `RUNNING` (stored CREATED is expected, see the lanes-mode finding above) |
| Baseline | `evidence/20261117T103254Z-pre-e1.baseline.txt` (10:32:54Z); snapshot `evidence/20261117T103255Z-pre-e1.queue.json` |
| Listener PIDs | 8081 `6872`, 11010 `7490`, 40012 `7491`, 40001 `2320808`: equal to the reference; trace folder `1794670020`: equal |
| `galago_core_controller_dirty_lines` | 0; `git status --porcelain -- controller` empty |
| galago-core HEAD | `9201bd30825cb73b2b950c9a452c2ce68f14a192` |
| galago-tools HEAD | `034867ca8aec9cb5ed83140306ebd89bf61b9ae7`; the only change since `d53da53` is `docs/runbooks/gal-07-live-handoff.md` (docs-only), so the tool code is unchanged since `d53da53`; the `0604348` ancestor exit is 0; the only `tools/` status line is the untracked `tools/fast-mcp-locks/` runtime directory |
| Auto-mint | auto-mint: on (not exercised) (D-07) |
| `STACK2-6.log` "Running command Transfer" | 14 (reference 12: the two round-trip Transfers); "Running command" 60 (reference 52: +8, see the readiness table); 5468 lines |
| `FA100056.log` "Running command Transfer" | 1 (4 "Running command"); total 176801 lines (reference 173347, status polling only) |
| Ledger | sha256 `061f52b4f309ad2e1a03c64e995bc4101eb75574a3df3e0277d0c60589d2bd1c`, 11 records (reference 9 + the two round-trip records, both done / ran) |
| Baseline vs reference (`diff`) | only label, time, galago-core and galago-tools HEAD, the log counts above, `FA100056.log` line count, ledger sha256 and the two new ledger records differ: every difference is accounted for by the operator's readiness moves |
| Protocol import | `POST /api/trpc/protocol.import` `{"json":{"workcellId":1,"protocol":<the .protocol object of protocols/09-live-lanes-event1.protocol.json>}}`, HTTP 200 at about 10:34Z; reply `evidence/20261117T103400Z-e1-import.json`: protocol id `9`, name "LIV-01 event 1: STACK estimate overlaps the F.A.S.T. liquid leg (lanes)", `workcellId` 1, mode `script`, 44 parameters. `GET /api/trpc/protocol.getAll` now lists ids 4 (test, workcell 1), 8 (drill, workcell 3) and 9 (event 1, workcell 1) |
| `E1_PRE_OK` automated check | printed |

Event-1 run-form values (amended D-02): `batch_label` LIV01-E1; `spare_a_device` nest-3, `spare_a_deck` deck1, `spare_a_nest` A1
(overlap source); `spare_b_device` nest-1, `spare_b_deck` deck1, `spare_b_nest` A1 (overlap destination); `out1_dest_device`
nest-1, `out1_dest_deck` deck1, `out1_dest_nest` A1 (plate 1's home); every other field at its default (`plate2_deck`'s default is
the literal deck` with a backtick).

Expected event-1 traffic (RESEARCH Finding 7), from the pre-e1 baseline: `STACK2-6.log` +4 "Running command Transfer" (14 -> 18)
plus one "Running command GetTransferEstimate"; `FA100056.log` +1 "Running command Transfer" (1 -> 2); four new ledger records, each
done / ran (11 -> 15); the estimate writes no ledger record. The operator's GO-gate reads add other "Running command" lines; they
move nothing.

### Event-1 GO (09-09 Task 2)

Recorded by the orchestrator from the operator's replies, in order (the operator's words are quoted verbatim):

1. `GetFailureLatch` (checklist item 1), operator reply: `{"reason":null,"latched":false,"guid":null,"kind":"latchStatus","resultKind":null,"explanation":null}` (latched:false). The local `STACK2-6.log` shows two `Running command GetFailureLatch` lines at 10:35:49Z and 10:35:57Z.
2. Re-teach question (checklist item 2, asked again after the readiness reply left it unanswered): "no" (nothing re-taught or bumped since 10:02Z). With the round trip done/ran at 10:29-10:31Z (above), item 2 is a yes.
3. The orchestrator asked again for `GetRobotStates` and the go, stating that the literal "go" counts as yes to checklist items 3-5: plates in place and F.A.S.T. ready (item 3), the Preview shows the F.A.S.T. transfer alone on lane fast with get_transfer_estimate on the primary lane right after it (item 4), and no old CREATED run will be started (item 5). The operator did not answer items 3-5 one by one; the go is the answer to all three, on that stated understanding.
4. `GetRobotStates` (checklist item 1), operator reply: `{"robots":[{"state":"idle","robotName":"stack2-6"}],"kind":"robotStates"}` (stack2-6 idle). Log: `Running command GetRobotStates` at 10:37:32Z.
5. Typed go, verbatim: "go", recorded by the orchestrator at **2026-11-17T10:37:49Z**.

Checklist result: items 1 and 2 answered explicitly (latched:false, stack2-6 idle, "no" re-teach); items 3, 4, 5 answered by the typed go. The GO-gate reads moved nothing (they add `GetFailureLatch` x2 and `GetRobotStates` x1 to the "Running command" count).

### Event-1 run and raw capture (09-09 Task 3)

**Operator's run reply**, verbatim, at 2026-11-17T10:45:03Z: "event 1 done, stack didnt move additional plate from nest-3 to nest-1 during fast transfer". The second clause is the expected behaviour, not a defect: event 1's overlap step is `get_transfer_estimate` only (a read, no arm motion), so the third plate stays on nest-3. It is recorded as the operator's observation that the third plate stayed on nest-3. Before the run the operator also asked what `spare_a` / `spare_b` meant; the answer given: the overlap source (nest-3) and destination (nest-1), an estimate only in event 1.

Orchestrator read at 10:45:03Z: `laneStatus` `laneMode:true`, `halted:false`, `haltReason:null`, `failures:[]`, `runningLanes:[]`. No failure was reported, so no D-11 recovery was needed; nothing was re-sent, restarted or deleted.

**Raw capture (Claude, right after the reply, 10:45:34Z-10:45:44Z, every CTL call with stdin `/dev/null`):** `snapshot e1-after`, `baseline e1-after`, `logs-since` (reference `20261117T103254Z-pre-e1.baseline.txt`), `ledger e1`.

- Run id `1596ecfad681e7000`; **key base `LIV01-E1-2026-11-17T10:40:52.652Z-5f3509d4`** (the run's "LIV-01 key base" note, queueId 63). The stored run record reads `CREATED` with 7 commands (the known lanes-mode finding); completion is read from the rows and `laneStatus`.
- Rows (`evidence/20261117T104534Z-e1-after.queue.json`, all `COMPLETED`; the whole queue is 28 rows, all COMPLETED, none CREATED or STARTED):

| queueId | Step | Lane | Started (UTC) | Completed (UTC) |
|---------|------|------|---------------|-----------------|
| 63 | note (key base) | primary | 10:41:13.401 | 10:41:13.402 |
| 64 | in1 transfer, STACK nest-1 -> fa100056 tray1/5 | primary | 10:41:14.903 | 10:41:45.053 |
| 65 | in2 transfer, STACK nest-2 -> fa100056 tray1/6 | primary | 10:41:46.555 | 10:42:15.121 |
| 66 | F.A.S.T. transfer (deck 5 to 6), `laneBarrier` | fast | 10:42:16.425 | 10:43:28.134 |
| 67 | `get_transfer_estimate` nest-3 -> nest-1 | primary | 10:42:16.623 | 10:42:16.789 |
| 68 | out1 transfer, tray1/5 -> nest-1 (`laneBarrier`) | primary | 10:43:28.820 | 10:43:58.179 |
| 69 | out2 transfer, tray1/6 -> nest-2 | primary | 10:43:59.679 | 10:44:28.922 |

  The estimate (row 67) started 0.2 s after the F.A.S.T. transfer and finished while it was still running; out1 started 0.7 s after the F.A.S.T. transfer completed. `laneStatus` in the snapshot: `laneMode:true`, `halted:false`, `haltReason:null`, `failures:[]`, `runningLanes:[]`, `queueBusy:false`.
- Comparison against the expected deltas (pre-e1 baseline vs `evidence/20261117T104535Z-e1-after.baseline.txt`, by `diff`):

| Item | pre-e1 | e1-after | Expected | Match |
|------|--------|----------|----------|-------|
| `STACK2-6.log` "Running command Transfer" | 14 | 18 | +4 | yes |
| `STACK2-6.log` "Running command" | 60 | 68 | +4 Transfer, +1 GetTransferEstimate, +3 GO-gate reads (2 GetFailureLatch, 1 GetRobotStates) = +8 | yes |
| `STACK2-6.log` "Running command GetTransferEstimate" | 0 | 1 (10:42:16Z) | +1 | yes |
| `FA100056.log` "Running command Transfer" | 1 | 2 (10:42:16Z, with its POST /protocol/run and polling) | +1 | yes |
| `FA100056.log` "Running command" | 4 | 5 | +1 | yes |
| Ledger records | 11 | 15 | +4 | yes |
| Ledger sha256 | `061f52b4...bd1c` | `ec2dd2781064c5753ea5e7c1ec1e33643127d25c94654b6bf34f345a1be46d1d` | changed | yes |
| Listener PIDs | 8081=6872, 11010=7490, 40012=7491, 40001=2320808 | same | equal | yes |
| Trace folder | 1794670020 | 1794670020 | equal | yes |
| `galago_core_controller_dirty_lines` | 0 | 0 | 0 | yes |

  The four new ledger records (all `state=done`, `result.kind=ran`): `...-in1` created 10:41:15Z, `...-in2` 10:41:46Z, `...-out1` 10:43:29Z, `...-out2` 10:43:59Z (updated 10:44:28Z). The estimate wrote no ledger record. The new `STACK2-6.log` Transfer lines are at 10:41:14Z, 10:41:46Z, 10:43:28Z and 10:43:59Z (log time 17:41-17:43 is UTC+7). No ERROR, WARNING, refusal, latch or retry line in either appended log (only the two GetFailureLatch read lines).
- `logs-since` did not print TRUNCATED-OR-RESTARTED (both copied logs hold 0 such markers: `STACK2-6.log` 1845 lines, `FA100056.log` 1407 lines). The ledger copy `evidence/20261117T104544Z-e1.ledger.json` holds exactly 4 records, keyed by the key base plus `-in1`, `-in2`, `-out1`, `-out2`.
- `git status --porcelain -- controller` is empty after the capture; the galago-tools `tools/` status is unchanged (`galago_tools_tools_dirty_lines=1`, the untracked runtime directory) and galago-tools HEAD is still `034867c`.

Capture status: the post-run capture is complete and every count matches the expected deltas; all four STACK keys are done/ran and every row is COMPLETED. Whether the overlap met the D-05 rule, and the event-1 verdict, are judged in 09-10, not here.

### Event-1 analysis against D-05 (09-10 Task 1), 2026-11-17

Judged by Claude from the copied files only (`evidence/20261117T104534Z-e1-after.queue.json`, `...-e1.STACK2-6.log`,
`...-e1.FA100056.log`, `...-e1.ledger.json`, the pre-e1 and e1-after baselines). Claude sent nothing to any tool (D-18). The
operator reported "event 1 done" at 10:45:03Z with no failure.

**1. Per-lane rows** (run `1596ecfad681e7000`, batch label LIV01-E1, queueId order inside each lane, raw ms are epoch ms from
`startedAt` / `completedAt`; the lane is the row's `advancedParameters.lane`, absent meaning the primary lane; no two rows
share a timestamp, so nothing needed re-ordering; q63 started and completed 1 ms apart). All 7 rows `COMPLETED`.

Primary lane (STACK2-6 and Tool Box note):

| queueId | Command | step_key suffix | Status | startedAt (raw ms) | startedAt (ISO UTC) | completedAt (raw ms) | completedAt (ISO UTC) |
|---------|---------|-----------------|--------|--------------------|---------------------|----------------------|-----------------------|
| 63 | Tool Box note (key base) | none | COMPLETED | 1794912073401 | 2026-11-17T10:41:13.401Z | 1794912073402 | 2026-11-17T10:41:13.402Z |
| 64 | STACK transfer nest-1 to fa100056 tray1/5 | `-in1` | COMPLETED | 1794912074903 | 2026-11-17T10:41:14.903Z | 1794912105053 | 2026-11-17T10:41:45.053Z |
| 65 | STACK transfer nest-2 to fa100056 tray1/6 | `-in2` | COMPLETED | 1794912106555 | 2026-11-17T10:41:46.555Z | 1794912135121 | 2026-11-17T10:42:15.121Z |
| 67 | STACK `get_transfer_estimate` nest-3 to nest-1 | none (read) | COMPLETED | 1794912136623 | 2026-11-17T10:42:16.623Z | 1794912136789 | 2026-11-17T10:42:16.789Z |
| 68 | STACK transfer tray1/5 to nest-1 (`laneBarrier`) | `-out1` | COMPLETED | 1794912208820 | 2026-11-17T10:43:28.820Z | 1794912238179 | 2026-11-17T10:43:58.179Z |
| 69 | STACK transfer tray1/6 to nest-2 | `-out2` | COMPLETED | 1794912239679 | 2026-11-17T10:43:59.679Z | 1794912268922 | 2026-11-17T10:44:28.922Z |

Lane `fast` (FA100056):

| queueId | Command | step_key suffix | Status | startedAt (raw ms) | startedAt (ISO UTC) | completedAt (raw ms) | completedAt (ISO UTC) |
|---------|---------|-----------------|--------|--------------------|---------------------|----------------------|-----------------------|
| 66 | F.A.S.T. transfer, `lane: fast`, `laneBarrier` | none (F.A.S.T. has no step_key) | COMPLETED | 1794912136425 | 2026-11-17T10:42:16.425Z | 1794912208134 | 2026-11-17T10:43:28.134Z |

(Queue order across lanes is by queueId: 66 sits before 67 only by enqueue order; the lanes claim independently.)

**2. D-05 containment clauses** (`So`, `Eo` = row 67; `Sf`, `Ef` = row 66; tolerance 1500 ms; all numbers raw ms):

- `So` = 1794912136623, `Eo` = 1794912136789 (the estimate window is 166 ms).
- `Sf` = 1794912136425, `Ef` = 1794912208134 (the F.A.S.T. window is 71709 ms).

| Clause | Computation | Result |
|--------|-------------|--------|
| `So >= Sf - 1500` | 1794912136623 >= 1794912134925 (margin 1698 ms; in fact `So - Sf` = +198 ms, the estimate started after the F.A.S.T. step, so the tolerance was not needed) | **holds** |
| `Eo <= Ef` | 1794912136789 <= 1794912208134 (the estimate finished 71345 ms before the F.A.S.T. step) | **holds** |
| `min(Eo, Ef) - max(So, Sf) > 0` | min = 1794912136789 (`Eo`), max = 1794912136623 (`So`), difference = 166 ms, strictly positive | **holds** (not a touch: 166 ms, neither `Eo = Sf` nor `So = Ef`) |

The estimate window lies wholly inside the F.A.S.T. window `[Sf, Ef]`. The 166 ms intersection is short because a real-mode
`get_transfer_estimate` is one manager request (flagged in the plan); containment, not duration, is the test.

**3. Tool logs** (log lines are local UTC+7, converted to UTC; the log lines' own times; the F.A.S.T. HTTP `Date` header
is NOT used, it reads `Sat, 31 Oct 2026` on the instrument clock; the web UI's `GET /status` polls are not counted as run
progress):

| Log line | Local | UTC |
|----------|-------|-----|
| `FA100056.log` "Running command Transfer" (line 656 of the excerpt) | 2026-11-17 17:42:16 | 10:42:16 |
| `STACK2-6.log` "Running command GetTransferEstimate" (line 921) | 2026-11-17 17:42:16 | 10:42:16 |
| F.A.S.T. row `completedAt` (row 66) | | 10:43:28.134 |
| `STACK2-6.log` "Running command Transfer" lines | 17:41:14, 17:41:46, 17:43:28, 17:43:59 | 10:41:14, 10:41:46, 10:43:28, 10:43:59 |

- Both lines sit inside the F.A.S.T. row window `[10:42:16.425, 10:43:28.134]` and about 71 s before the F.A.S.T. completion, so
  "before the F.A.S.T. row's completedAt" holds. Both tool logs show their attempt in the same window.
- Resolution caveat, stated plainly (not a failed clause): the tool-log timestamps have 1 s resolution, and the F.A.S.T. Transfer
  line and the estimate line fall in the same second, 10:42:16. "The estimate line lies after the F.A.S.T. Transfer line" is
  therefore satisfied only as "not before, same second"; the log cannot order them inside that second. The strict order comes from
  the rows' raw ms: F.A.S.T. started at .425, the estimate at .623 (+198 ms). The equal log seconds are recorded as they are and
  are consistent with the rows (a line time is the row start truncated to the second).
- Counts, "Running command" counts only (pre-e1 baseline to e1-after baseline, `diff`): `STACK2-6.log` "Running command
  Transfer" 14 to 18 (+4, as expected) with exactly one "Running command GetTransferEstimate"; `FA100056.log` "Running command
  Transfer" 1 to 2 (+1, as expected). "Running command" totals: `STACK2-6.log` 60 to 68 (+8: 4 Transfer, 1 GetTransferEstimate,
  3 GO-gate reads), `FA100056.log` 4 to 5. Total line counts were not used (`FA100056.log` grew 176801 to 178208, UI polling).
- No ERROR, WARNING, refusal, latch or retry line in either excerpt (the three read lines at the top of `STACK2-6.log` are the
  GO-gate `GetFailureLatch` x2 and `GetRobotStates` x1).

**4. Ledger** (`evidence/20261117T104544Z-e1.ledger.json`, one JSON object, exactly 4 records, no other key):

| Key (base `LIV01-E1-2026-11-17T10:40:52.652Z-5f3509d4`) | state | result.kind | createdAt | updatedAt |
|-----|-------|-------------|-----------|-----------|
| `...-in1` | done | ran | 2026-11-17T10:41:15.089547+00:00 | 2026-11-17T10:41:45.002270+00:00 |
| `...-in2` | done | ran | 2026-11-17T10:41:46.722968+00:00 | 2026-11-17T10:42:15.070251+00:00 |
| `...-out1` | done | ran | 2026-11-17T10:43:29.010530+00:00 | 2026-11-17T10:43:58.119260+00:00 |
| `...-out2` | done | ran | 2026-11-17T10:43:59.882732+00:00 | 2026-11-17T10:44:28.871321+00:00 |

The ledger record count went from 11 (pre-e1) to 15 (e1-after), +4; the `diff` of the two baselines shows exactly these four record
lines added and no other, and the sha256 changed `061f52b4...bd1c` to `ec2dd2781064c5753ea5e7c1ec1e33643127d25c94654b6bf34f345a1be46d1d`.
The estimate wrote no ledger record. The operator's readiness round-trip records came before pre-e1 and are not counted. Per-key one-shot
is claimed for these four explicit keys only (D-08); auto-mint: on (not exercised), all four keys explicit (D-07).

**5. Run completion and code state:** every one of the 7 rows of the run is `COMPLETED`; `laneStatus` in the e1-after snapshot reads
`laneMode:true`, `halted:false`, `haltReason:null`, `failures:[]`, `runningLanes:[]`, `queueBusy:false`. The stored run record
`1596ecfad681e7000` reads `CREATED` as read, which is the known lanes-mode finding (09-07, above); it is recorded as read and is not a failed
clause. `git status --porcelain -- controller` was empty (`galago_core_controller_dirty_lines=0` in the e1-after baseline; re-read empty at
analysis time), so no hot-reload edit touched the bind-mounted dev server (D-13 amended). Listener PIDs 8081 `6872`, 11010 `7490`, 40012 `7491`,
40001 `2320808` and the trace folder `1794670020` equal the pre-e1 baseline.

**6. Operator observation:** the third plate stayed on nest-3. Expected: event 1's overlap step is a read-only estimate, so no arm motion
and no plate move happens for it; the moving overlap is event 2.

| D-05 element | Result |
|--------------|--------|
| Row containment (three clauses) | holds, with numbers above |
| Adjacency (touch is not an overlap) | not a touch: 166 ms strictly positive intersection |
| Both logs in one wall-clock window, +4 / +1 "Running command Transfer" | holds (same-second resolution caveat above) |
| Four ledger records, done / ran, explicit keys, no other record | holds |
| Rows COMPLETED, `laneStatus` halted false | holds (stored run `CREATED` recorded as read) |

Event 1 verdict: PASS

Event 1 meets D-05 from the raw rows, logs and ledger. Event 2 may be prepared (09-10 Task 2: operator readiness by eye and tool-page reads).
This verdict covers the estimate overlap only; the moving overlap and the event-2 ledger clause (five records) are judged in 09-11 and 09-12.

### Event-2 operator readiness and baseline comparison (09-10 Task 2), 2026-11-17

Operator reply at 10:51:44Z (relayed by the orchestrator, verbatim in `evidence/20261117T105220Z-e2-readiness.txt`): the three tool-page replies
`GetFailureLatch` -> `latched:false`, `GetRobotStates` -> `stack2-6` `idle`, `GetLabwarePresence` (robot `stack2-6`) -> `hasLabware:false`,
then the phrase "third plate ready". Claude sent nothing to any tool (D-18); the operator ran no Transfer.

**Honest limits of the by-eye steps.** The operator did not describe steps 1 and 2 in words (plate 1 on nest-1, plate 2 on nest-2, F.A.S.T. tray1
slots 5 and 6 empty, third plate on nest-3). "third plate ready" is their confirmation of those two steps by one phrase, not a described
observation. Earlier, at 10:45Z, the operator said the third plate stayed on nest-3 during event 1, which agrees. Nothing but the operator's
word backs the nest positions (`GetLabwarePresence` reads the gripper only).

**Baseline comparison** (`evidence/20261117T105220Z-post-e2-readiness.baseline.txt` against `evidence/20261117T104535Z-e1-after.baseline.txt`;
`diff` shows only the label, time, `galago_core_head` and three log counters):

| Value | e1-after | post-e2-readiness | Result |
|-------|----------|-------------------|--------|
| `STACK2-6.log` "Running command Transfer" | 18 | 18 | equal (no Transfer) |
| `FA100056.log` "Running command Transfer" | 2 | 2 | equal |
| ledger sha256 | `ec2dd2781064c5753ea5e7c1ec1e33643127d25c94654b6bf34f345a1be46d1d` | same | equal (no ledger write); record count 15 |
| `galago_core_controller_dirty_lines` | 0 | 0 | equal |
| `galago_tools_tools_dirty_lines` | 1 | 1 | equal; the line is `?? tools/fast-mcp-locks/` (runtime directory) |
| listener PIDs 8081 / 11010 / 40012 / 40001 | 6872 / 7490 / 7491 / 2320808 | same | equal |
| trace folder | 1794670020 | 1794670020 | equal |
| `STACK2-6.log` "Running command" (all) | 68 | 73 | +5, all non-Transfer reads (see below) |
| `STACK2-6.log` lines / `FA100056.log` lines | 7313 / 178208 | 7359 / 179099 | grew; not compared (UI polling) |
| `FA100056.log` "Running command" (all) | 5 | 5 | equal |

The five new `STACK2-6.log` "Running command" lines (local UTC+7, 17:50 to 17:51 = 10:50Z to 10:51Z, just before the 10:51:44Z reply) are
`GetFailureLatch` 17:50:34, `GetFailureLatch` 17:50:39, `GetRobotStates` 17:50:56, `GetRobotStates` 17:51:21 and `GetLabwarePresence` 17:51:25.
That is five reads, not the three the instructions name: the operator read the latch and the robot state twice each (a re-read). No POST, PUT or
DELETE line, no ERROR, WARNING, refusal or retry line in the appended `STACK2-6.log` text; no new "Running command" line in `FA100056.log`. The
log reads corroborate the operator's pasted reads; the pasted values themselves (latch false, idle, gripper empty) are the operator's.

**Stop conditions checked:** latched true: no (false). stack2-6 not idle: no (idle). hasLabware true: no (false). Any compared value different:
no. The readiness step passes; nothing moved and nothing was written since event 1. The nest-3 / nest-1 round trip and the GO are 09-11.

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
| `20261117T083332Z-post-deploy.baseline.txt` | post-deploy baseline (same PIDs, Transfer count and ledger sha as pre-deploy; laneMode true) | 09-04 |
| `20261117T083601Z-pre-drill.baseline.txt`, `.queue.json`, `.tracefiles.txt` | pre-drill baseline, queue snapshot and trace file names | 09-05 |
| `20261117T083845Z-post-sim-launch.baseline.txt`, `.tracefiles.txt` | baseline after the first sim launch (superseded by the relaunch) | 09-05 |
| `20261117T083912Z-post-sim-relaunch.baseline.txt`, `.tracefiles.txt` | baseline after the sim relaunch with the fixed `start-sim`; real tools untouched | 09-05 |
| `20261117T085710Z-post-rig-config.baseline.txt`, `.tracefiles.txt` | baseline after uat-sim and the two sim tools were configured; selected workcell uat-sim, real tools untouched | 09-05 |
| `20261117T085940Z-drill-import.json` | protocol.import reply (protocol id 8 in uat-sim, id 3) | 09-06 |
| `20261117T085943Z-pre-drill-go.baseline.txt`, `20261117T085944Z-pre-drill-go.queue.json` | pre-GO baseline and queue snapshot (halted false, no CREATED or STARTED row) | 09-06 |
| `20261117T093751Z-drill-s1-at-halt.queue.json` | scenario 1 snapshot at the halt (d-x1 FAILED, SIM-FAST STARTED, halted true) | 09-06 |
| `20261117T093850Z-drill-s1-halted.queue.json` | scenario 1 snapshot after SIM-FAST completed, before the operator Start (halted true, d-out1 CREATED) | 09-06 |
| `20261117T094242Z-drill-s1-done.queue.json` | scenario 1 snapshot after the operator Start (all rows COMPLETED, halted false) | 09-06 |
| `20261117T094420Z-post-drill-s1.baseline.txt` | post-scenario-1 baseline; real tools unchanged, SIM-STACK pid 101131 | 09-06 |
| `20261117T095103Z-drill-s2-at-halt.queue.json` | scenario 2 snapshot at the halt (SIM-FAST FAILED, d-x1 STARTED, d-out1 CREATED, halted true) | 09-07 |
| `20261117T095130Z-drill-s2-halted.queue.json` | scenario 2 snapshot after d-x1 completed, before the operator Start (halted true, d-out1 CREATED) | 09-07 |
| `20261117T095421Z-drill-s2-done.queue.json` | scenario 2 snapshot after the operator Starts (all rows COMPLETED, halted false) | 09-07 |
| `20261117T095615Z-drill-s3-at-freeze.queue.json` | scenario 3 snapshot at the freeze (both rows STARTED, halted true, haltReason freeze) | 09-07 |
| `20261117T095709Z-drill-s3-frozen.queue.json` | scenario 3 snapshot after both rows completed (none ABORTED, d-out1 CREATED, haltReason freeze) | 09-07 |
| `20261117T095753Z-drill-s3-done.queue.json` | scenario 3 snapshot after the operator Start (all rows COMPLETED, halted false) | 09-07 |
| `20261117T095938Z-post-drill-s2-and-s3-before-teardown.baseline.txt` | baseline after scenarios 2 and 3, workcell back on test, sims still up | 09-07 |
| `20261117T100156Z-post-drill.baseline.txt`, `.tracefiles.txt`; `20261117T100157Z-post-drill.queue.json` | teardown baseline, trace file names and queue snapshot (sims stopped, real tools unchanged, clean queue) | 09-07 |
| `20261117T100221Z-post-drill-final.baseline.txt` | baseline after both pre-flight forms; only the FA100056.log status-poll line count moved | 09-07 |
| `20261117T103338Z-e1-readiness.txt` | event-1 operator readiness record ("ready" only; log and ledger evidence for the round trip; missing paste and re-teach answer noted) | 09-09 |
| `20261117T103254Z-pre-e1.baseline.txt`, `20261117T103255Z-pre-e1.queue.json` | pre-e1 baseline (taken after the round trip) and queue snapshot | 09-09 |
| `20261117T103400Z-e1-import.json` | protocol.import reply (event-1 protocol id 9 in workcell test, id 1) | 09-09 |
| `20261117T104534Z-e1-after.queue.json` | event-1 post-run queue snapshot (rows 63-69 COMPLETED, laneStatus clean) | 09-09 |
| `20261117T104535Z-e1-after.baseline.txt` | event-1 post-run baseline (Transfers 14 to 18 and 1 to 2, ledger 11 to 15) | 09-09 |
| `20261117T104535Z-e1.STACK2-6.log`, `20261117T104535Z-e1.FA100056.log` | tool-log lines appended since the pre-e1 baseline (redacted; no TRUNCATED-OR-RESTARTED) | 09-09 |
| `20261117T104544Z-e1.ledger.json` | the 4 ledger records of key base `LIV01-E1-2026-11-17T10:40:52.652Z-5f3509d4` | 09-09 |
| `20261117T105220Z-e2-readiness.txt` | event-2 operator readiness reply (latched false, idle, hasLabware false, "third plate ready"; steps 1 and 2 not described in words) | 09-10 |
| `20261117T105220Z-post-e2-readiness.baseline.txt` | baseline after the readiness reads (Transfers 18 and 2, ledger sha and PIDs equal e1-after) | 09-10 |
