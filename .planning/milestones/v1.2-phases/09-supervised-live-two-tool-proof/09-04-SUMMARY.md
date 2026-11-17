---
phase: 09-supervised-live-two-tool-proof
plan: 04
subsystem: infra
tags: [lanes, deploy, docker-compose, galago-web-dev, live-evidence, d-13-amendment]

requires:
  - phase: 09-supervised-live-two-tool-proof
    provides: 09-01 live protocols, 09-02 one-send gate, 09-03 evidence tooling, baselines and the amended D-02/D-03 plan
provides:
  - galago-web-dev running with GALAGO_PARALLEL_LANES=1 (laneMode true), same image, same store
  - Deploy section of 09-LIVE-EVIDENCE.md (GO, container ids, image id, flag persistence, seven verification results)
  - pre-deploy and post-deploy baselines proving no tool state changed across the deploy
  - D-13 amendment (decision B) recorded in 09-CONTEXT.md
  - tracked .dockerignore
affects: [09-05, 09-06, 09-07, 09-08, 09-09, 09-10, 09-11, 09-12]

actuals:
  tokens: 21000
  tasks: 3
  commits: 4
plan_head_before: 5bebb599eaec4a61609de083ae2bc3810adf61bc
plan_head_after: 075b1078821ec5f06678f9f40e7d6ac507d3f5d6

tech-stack:
  added: []
  patterns:
    - "Lanes flag turned on by compose env pass-through (GALAGO_PARALLEL_LANES) plus a gitignored root .env, not a rebuild"

key-files:
  created:
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T051917Z-pre-deploy.baseline.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T051917Z-pre-deploy.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T083332Z-post-deploy.baseline.txt
    - .env (gitignored, uncommitted, one line: GALAGO_PARALLEL_LANES=1)
  modified:
    - .dockerignore
    - .planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md
    - .planning/phases/09-supervised-live-two-tool-proof/09-CONTEXT.md

key-decisions:
  - "D-13 amended (user decision B): no production galago-web container or image exists on this host, so lanes are enabled by recreating galago-web-dev with the flag instead of a rebuild with a rollback-pre-lanes image anchor"
  - "Flag persistence: ENV option, a gitignored root .env with only GALAGO_PARALLEL_LANES=1, so the flag survives a later plain compose up"
  - "TOOLBOX_PORT not added to the dev compose (recommendation; the proof uses only STACK2-6 and FA100056)"

patterns-established:
  - "Plans 09-05 to 09-12 read galago-web-dev wherever they say galago-web (GAL07_WEB_CONTAINER=galago-web-dev, docker exec galago-web-dev)"

requirements-completed: [LIV-01, LIV-02]

duration: multi-session (gate and prep 2026-11-17 05:1xZ to 05:3xZ; GO and deploy 08:33Z)
completed: 2026-11-17
status: complete
---

# Phase 9 Plan 04: Lanes-on deploy Summary

**galago-web-dev recreated with GALAGO_PARALLEL_LANES=1 (laneMode true, image and store unchanged), proven to leave listener PIDs, STACK transfer count and ledger sha untouched.**

## Performance

- **Tasks:** 3 (D-09 gate and baseline; deploy decision and prepared commands; GO, recreate and verification)
- **Task commits:** 4 (`63d61e4`, `c548849`, `486cf09`, `075b107`); this summary and state updates are metadata commits after the measured count
- **Files:** 3 evidence files created, 3 tracked files modified or added

## Accomplishments

- D-09 gate green at the build HEAD: 50 files / 1415 tests, `tsc --noEmit` clean, prettier clean, 20 of 20 engine loop runs; no controller production change since `d09a047`.
- Found that no production `galago-web` container or image exists on this host; stopped and returned it; the user chose decision B, recorded as an amendment to D-13.
- On the typed GO ("Go env", 2026-11-17T08:33:06Z): wrote the root `.env` (gitignored), recreated `galago-web-dev` (container `18b8638fc1c8` to `855c334135eb`, image `a331fa4d812a` unchanged).
- Verification: `printenv GALAGO_PARALLEL_LANES` is `1`; `/api/health` ok after about 5 s; `laneStatus` `laneMode:true`, `halted:false`, no failures; `/api/tools` lists STACK2-6 and FA100056; both pre-flight forms end `PREFLIGHT OK`; post-deploy baseline shows PIDs 8081/11010/40012/40001 unchanged (6872/7490/7491/2320808), 12 STACK Transfer lines, ledger sha256 `5de43c84...670b` (9 records), 1 FA100056 Transfer line, `/api/runs` count 0, controller tree clean.

## Task Commits

1. **Task 1 (D-09 gate, .dockerignore, baseline):** `63d61e4` (tracked `.dockerignore`), `c548849` (pre-deploy record, missing-container blocker)
2. **Task 2 (decision B and prepared commands):** `486cf09`
3. **Task 3 (GO, recreate, verification evidence):** `075b107`

## Deviations from Plan

**1. [Decision, Rule 4] No production container; decision B dev-container deploy**
- **Found during:** Task 1 pre-flight (both forms BLOCKED on `Command_Transfer under /app/gen-interfaces in container galago-web`)
- **Issue:** `docker ps -a` shows only `galago-web-dev`; no `galago-core-galago-web` image, so the build, the `rollback-pre-lanes` anchor and the "equals :latest" comparison were impossible.
- **Fix:** returned to the user; user chose B; `09-CONTEXT.md` amended; the image checks became "dev image id unchanged".
- **Commits:** `c548849`, `486cf09`

**2. [No image anchor]** Nothing was tagged or built, so there is no `rollback-pre-lanes` image. Rollback is `env -u GALAGO_PARALLEL_LANES docker compose -f docker-compose.dev.yml up -d --no-build galago-web-dev` plus deleting `.env`; the code is bind-mounted, so lanes off and on run identical files.

**3. [.env written]** A root `.env` containing only `GALAGO_PARALLEL_LANES=1` was written on the operator's ENV option. It is gitignored (`.gitignore:45`) and was never staged.

**4. [Check 4, workcell, open item]** `/api/settings/workcell` still returns `{"value":"test"}`. `/api/tools` does list STACK2-6 and FA100056 (both workcellId 1), so the tools check passed, but the operator did not reselect a workcell and the request did not say "workcell later". This is not a deploy failure and did not trigger rollback. It must be confirmed or fixed before 09-05 and 09-09: either `test` (workcellId 1) is the workcell holding the two real tools and is acceptable, or the real workcell must be selected.

## Issues Encountered

- Dev-mode caveat: `./controller` is bind-mounted into a `next dev` server, so any edit under `controller/` hot-reloads the live server. `git status --porcelain -- controller` was empty at every baseline and must stay so.
- Two runs remain in `CREATED` in the store from earlier work. Nobody should press Start on them.
- The earlier operator nest-testing risk (three of five recorded nest-1/nest-3 moves ended `failed`) stays carried to the 09-09 to 09-11 GO gates.

## Known Stubs

None.

## Threat Flags

None. The deploy changes only an environment flag on an existing container; no new endpoint, auth path or schema.

## Next Phase Readiness

Lanes are live on `galago-web-dev`. Ready for 09-05 (freeze drill, simulated servers) once the workcell open item above is settled. Plans 09-05 to 09-12 use `galago-web-dev` for `galago-web`.

## Self-Check: PASSED

Checked: 09-LIVE-EVIDENCE.md, the three evidence files and this summary exist; commits `63d61e4`, `c548849`, `486cf09`, `075b107` are ancestors of HEAD; `.env` exists, is ignored and untracked.
