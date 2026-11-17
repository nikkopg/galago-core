---
phase: 09-supervised-live-two-tool-proof
plan: 05
subsystem: infra
tags: [lanes, sim-rig, uat-sim, galago-web-dev, live-evidence, d-10, d-18-amendment, phase9-ctl]

requires:
  - phase: 09-supervised-live-two-tool-proof
    provides: 09-03 phase9-ctl.sh and baselines, 09-04 galago-web-dev running with lanes on
provides:
  - Simulated STACK and F.A.S.T. tool servers listening on 40091 (pid 23042) and 40092 (pid 23184), launched by phase9-ctl.sh start-sim from the galago-tools venv
  - Production store workcell uat-sim (id 3), selected, holding exactly SIM-STACK (id 9) and SIM-FAST (id 10), both configured with simulated:true (tool.status SIMULATED)
  - Pre-drill, post-sim-launch, post-sim-relaunch and post-rig-config baselines proving the real tool servers, trace logs, Transfer counts and ledger are unchanged
  - Freeze drill Rig section of 09-LIVE-EVIDENCE.md (launch commands, PIDs, exact rig API calls, read-back)
  - Narrow D-18 amendment recorded in 09-CONTEXT.md
affects: [09-06, 09-07, 09-08, 09-09, 09-10, 09-11, 09-12]

actuals:
  tokens: 9700
  tasks: 2
  commits: 4
plan_head_before: 0f6511061549ea062a299e0c839797f8ff893075
plan_head_after: afe09024313e21f351e5d7ca1967bcc01a098d59

tech-stack:
  added: []
  patterns:
    - "Sim rig: hand-launched galago-tools servers on 40091/40092 plus an isolated uat-sim workcell whose tool records store simulated:true and RFC 5737 placeholder instrument hosts"
    - "Detach a launched server with setsid -f so a $(...) PID capture does not inherit the server's stdout pipe"

key-files:
  created:
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T083601Z-pre-drill.baseline.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T083912Z-post-sim-relaunch.baseline.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T085710Z-post-rig-config.baseline.txt
  modified:
    - .planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh
    - .planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md
    - .planning/phases/09-supervised-live-two-tool-proof/09-CONTEXT.md

key-decisions:
  - "D-18 amended narrowly on user request (2026-11-17): Claude may perform the uat-sim sim-rig setup; only the operator presses Start/Freeze/recovery and Claude never drives a real tool"
  - "Simulate ON and Configure are one tool.configure call carrying simulated:true (this is what the UI Simulate switch sends); the tool record also stores simulated:true so Connect All is simulated too"
  - "Sim tools use placeholder instrument hosts 192.0.2.1 and 192.0.2.2 so a non-simulated Configure could not reach the real manager or F.A.S.T."

patterns-established:
  - "Assert before every Configure: selected workcell, tool list, name, type, address, port, instrument host, simulated flag, no real host or port"

requirements-completed: []  # LIV-02 is declared by this plan but is NOT complete: the freeze drill (09-06/09-07) proves it

coverage:
  - id: D1
    description: "Sim STACK and F.A.S.T. servers listen on 40091 and 40092 with PIDs distinct from every real listener, launched by start-sim"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "ss -ltnpH 'sport = :40091' and ':40092' show python; bash tools/phase9-ctl.sh check-guards prints GUARDS OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "Real listeners 8081, 11010, 40001, 40012, the newest trace folder and file list, Transfer counts and the ledger are unchanged by the sim launch and the rig configuration"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "diff of evidence/20261117T083601Z-pre-drill.baseline.txt vs 20261117T085710Z-post-rig-config.baseline.txt (only label, time, HEAD, sim listeners, selected workcell differ)"
        status: pass
    human_judgment: false
  - id: D3
    description: "uat-sim is selected and lists exactly SIM-STACK (host.docker.internal:40091) and SIM-FAST (host.docker.internal:40092), simulated, with no 10.150.1.125 host and no port 40001 or 40012"
    requirement: "LIV-02"
    verification:
      - kind: other
        ref: "curl localhost:3010/api/settings/workcell = uat-sim; /api/tools read-back; tool.status SIMULATED for both"
        status: pass
    human_judgment: false
  - id: D4
    description: "The rig is safe to drive in the drill: no real instrument can be reached from uat-sim"
    requirement: "LIV-02"
    verification: []
    human_judgment: true
    rationale: "The no-path-to-hardware claim is a safety judgment the operator confirms at the drill GO gate; automation only proves the configured values"

duration: 61min
completed: 2026-11-17
status: complete
---

# Phase 9 Plan 05: Simulated Drill Rig Summary

**Simulated STACK and F.A.S.T. servers on 40091/40092 plus an isolated uat-sim workcell (SIM-STACK, SIM-FAST, simulated:true, placeholder hosts 192.0.2.1/192.0.2.2) on the lanes-on galago-web-dev, with the real tool servers provably untouched.**

## Performance

- **Duration:** about 61 min (sim launch from 08:36Z, rig configured 08:57Z, plus the checkpoint wait)
- **Started:** 2026-11-17T08:30Z (approx.)
- **Completed:** 2026-11-17T09:00Z (approx.)
- **Tasks:** 2 of 2
- **Files modified:** 12 (1 script, 2 planning docs, 9 evidence files)

## Accomplishments

- Launched SIM-STACK (pid 23042, :40091) and SIM-FAST (pid 23184, :40092) with `phase9-ctl.sh start-sim`; neither PID equals a real listener PID (8081 6872, 11010 7490, 40012 7491, 40001 2320808).
- Created the `uat-sim` workcell (id 3), selected it, added SIM-STACK and SIM-FAST, and issued one `simulated:true` Configure per tool; `tool.status` reports SIMULATED for both. `/api/tools` lists exactly those two tools.
- Four baselines (pre-drill, post-sim-launch, post-sim-relaunch, post-rig-config) show the real listener PIDs, trace folder `1794670020` and its file list, `STACK2-6.log` 12 Transfer, `FA100056.log` 1 Transfer and ledger sha256 `5de43c84...670b` (9 records) unchanged.
- Recorded the Rig section of 09-LIVE-EVIDENCE.md, including the exact API calls and the assertions run before each Configure.

## Task Commits

1. **Task 1: Launch the simulated tool servers and capture the pre-drill baseline** - `428d251` (docs), plus the Rule 1 fix `219fce3` (fix)
2. **Task 2: Configure uat-sim and the two simulated tools** (checkpoint:human-action, performed by Claude on the user's request) - `a1dfd8b` (D-18 amendment, docs) and `afe0902` (rig configuration and baseline, docs)

**Plan metadata:** the docs commit that follows this file (SUMMARY, STATE, ROADMAP). Measured task commits: 4 (`0f65110..afe0902`); the metadata commit is not counted.

## Files Created/Modified

- `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh` - `start-sim` now detaches the server with `setsid -f`
- `.planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md` - Freeze drill Rig section: launch commands, PIDs, baselines, rig API calls, read-back, evidence index rows
- `.planning/phases/09-supervised-live-two-tool-proof/09-CONTEXT.md` - D-18 narrow amendment
- `.planning/phases/09-supervised-live-two-tool-proof/evidence/*pre-drill*`, `*post-sim-launch*`, `*post-sim-relaunch*`, `*post-rig-config*` - baselines, queue snapshot, trace file lists

## Decisions Made

- **D-18 amendment (user-authorized, narrow).** The user replied "Can you set it up for me" to the Task 2 operator steps. Recorded in 09-CONTEXT.md: Claude may perform the uat-sim sim-rig setup (workcell, SIM tools, Simulate, Configure) on user request 2026-11-17; no motion is possible on sim tools. D-18 is otherwise unchanged: only the operator presses Start/Freeze/recovery, and Claude never drives a real tool.
- **Simulate and Configure are one call.** The API has no separate Simulate setter; the UI switch calls `tool.configure` with `simulated:true`. The base server returns SUCCESS before `_configure` in that case, so the single Configure per tool never dialed the placeholder hosts. The tool records also store `simulated:true` so Connect All stays simulated.
- **Placeholder hosts 192.0.2.1 / 192.0.2.2** (RESEARCH A4) on both records; the real manager and F.A.S.T. host never appears in the uat-sim workcell.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] phase9-ctl.sh start-sim hung PID capture**
- **Found during:** Task 1
- **Issue:** `start-sim` backgrounded a `cd && setsid ...` list. The waiting bash parent kept the caller's stdout pipe open, so `PID=$(phase9-ctl.sh start-sim ...)` blocked until the harness timeout. Finding: a `$(...)` capture holds the pipe open for as long as any descendant keeps stdout, so a launcher that backgrounds a compound command is not safe to capture.
- **Fix:** `setsid -f nohup ...` (redirects to the sim log, stdin `/dev/null`). Verified with a `stop-sim` and `start-sim` round trip on both sim ports. The first launch (pids 17911, 20917) was stopped with `stop-sim` (PID-only, never by name) and relaunched (23042, 23184) before anything was configured.
- **Files modified:** `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh`
- **Verification:** both sims listen; `check-guards` prints GUARDS OK; post-sim-relaunch baseline equals pre-drill except the sim listeners
- **Committed in:** `219fce3`

### Plan Variations (not deviation rules)

- **Task 2 was a `checkpoint:human-action` (`gate="blocking-human"`) and was performed by Claude, not the operator.** The user explicitly asked ("Can you set it up for me"), and the narrow D-18 amendment above records it. Hard limits held: nothing on workcell `test` or STACK2-6 / FA100056 was modified, connected or contacted; nothing was imported, queued or started; Start/Freeze remain operator-only.
- **Task 2's `<verification>` counted `Running command` totals only for the real logs.** The post-rig-config baseline reports both the Transfer and the total counts; both equal the pre-drill values.

---

**Total deviations:** 1 auto-fixed (1 bug, Rule 1)
**Impact on plan:** The fix was necessary for the launch to be scriptable and repeatable; no scope creep. The Task 2 role change is a user-authorized amendment, not a safety relaxation.

## Issues Encountered

- `FA100056.log` total line count grows with the F.A.S.T. server's idle chatter (171341 in both the post-deploy and post-rig-config baselines); the Transfer and "Running command" counts, which are what the baseline compares, did not change.
- `/api/settings/workcell` now returns `uat-sim`, so `GET /api/tools` hides STACK2-6 and FA100056 and pre-flight check 6 blocks. This is expected for the drill; 09-07 selects `test` (workcellId 1) again before event 1.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. No placeholder data flows to a UI; the placeholder instrument hosts are deliberate safety values on simulated records.

## Threat Flags

None. No new endpoint, auth path or schema change; the plan's T-09-20 through T-09-22 mitigations held (placeholder hosts, simulated:true before any dial, three-way baselines).

## Next Phase Readiness

- 09-06 can import the drill protocol into uat-sim and run the freeze drill against SIM-STACK and SIM-FAST. LIV-02 stays open until the drill (09-06/09-07) proves it.
- uat-sim is left selected. Do not restart the sim servers (pids 23042, 23184); stop them only with `phase9-ctl.sh stop-sim stack|fast` in 09-07.
- Always call `phase9-ctl.sh` with stdin redirected from `/dev/null`.

## Self-Check: PASSED

- Commits found in HEAD ancestry: `219fce3`, `428d251`, `a1dfd8b`, `afe0902`.
- Evidence files exist: pre-drill, post-sim-relaunch, post-rig-config baselines and trace file lists.
- Verification re-run: `RIG_OK`, `SIMS_UP`, `GUARDS OK`.

---
*Phase: 09-supervised-live-two-tool-proof*
*Completed: 2026-11-17*
