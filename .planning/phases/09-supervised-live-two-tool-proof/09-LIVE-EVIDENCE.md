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

## Freeze drill (LIV-02), row 3a-12

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

_Pending: the operator's literal typed reply and its UTC time are recorded here after the GO gate._

### Scenario 1

_Pending (the operator runs it after the typed go)._

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
| `20261117T083332Z-post-deploy.baseline.txt` | post-deploy baseline (same PIDs, Transfer count and ledger sha as pre-deploy; laneMode true) | 09-04 |
| `20261117T083601Z-pre-drill.baseline.txt`, `.queue.json`, `.tracefiles.txt` | pre-drill baseline, queue snapshot and trace file names | 09-05 |
| `20261117T083845Z-post-sim-launch.baseline.txt`, `.tracefiles.txt` | baseline after the first sim launch (superseded by the relaunch) | 09-05 |
| `20261117T083912Z-post-sim-relaunch.baseline.txt`, `.tracefiles.txt` | baseline after the sim relaunch with the fixed `start-sim`; real tools untouched | 09-05 |
| `20261117T085710Z-post-rig-config.baseline.txt`, `.tracefiles.txt` | baseline after uat-sim and the two sim tools were configured; selected workcell uat-sim, real tools untouched | 09-05 |
| `20261117T085940Z-drill-import.json` | protocol.import reply (protocol id 8 in uat-sim, id 3) | 09-06 |
| `20261117T085943Z-pre-drill-go.baseline.txt`, `20261117T085944Z-pre-drill-go.queue.json` | pre-GO baseline and queue snapshot (halted false, no CREATED or STARTED row) | 09-06 |
