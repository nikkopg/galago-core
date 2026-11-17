# Phase 9: Supervised Live Two-Tool Proof - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Phase Boundary

With the operator present, prove on the real workcell (forb01: STACK2-6 + F.A.S.T. FA100056) that the
Phase 8 lanes work live: a STACK step overlaps the F.A.S.T. liquid transfer with per-lane evidence, and a
drill shows lane-halt and Freeze lanes stopping both lanes with no automated motion. Then record the
resolution in PROJECT.md, the lanes todo and (only after the live overlap passes) the galago-tools
operator runbook.

Requirements: LIV-01, LIV-02, LIV-03. Settles research decisions D5 and D8
(`.planning/research/SUMMARY.md`).

**This is an evidence phase, not a feature phase.** The lane engine, protocol surface and run page
shipped in Phase 8. Code changes here are limited to the two guard tests (D-09, D-15) and the live
protocol script; any defect found live stops the work and comes back to the user (no hot-fixing during a
GO-gated session).

**Not in this phase:** a general step-dependency model (deferred), hard pause, any `stack.proto`
change, any change to the tool servers' own discipline, upstream PRs.

</domain>

<decisions>
## Implementation Decisions

### D5 — the overlap STACK step (settles research D5)

- **D-01:** There is no STACK "goto-safe" (the frozen `stack.proto` has 10 commands, and a Tool Box
  `goto` is refused in any lanes run, Phase 8 D-23). The overlap step is a real STACK command, proven in
  **two separate GO-gated live events**:
  1. **Event 1 (read, no extra motion):** a STACK `get_transfer_estimate` runs during the F.A.S.T. liquid
     leg. It uses the exact fields of the event-2 third-plate move, so it also rehearses that move's
     fields and reach through the manager's planning.
  2. **Event 2 (motion):** a real STACK `transfer` of a **third plate** runs during the F.A.S.T. liquid
     leg. — **Reversibility:** one-way — physical arm motion beside a running liquid handler cannot be
     undone; a collision damages hardware. Gate it with its own typed GO (runbook D-10).
- **D-02:** Keep the existing **two-plate cycle** (in1, in2 → F.A.S.T. liquid leg deck 5→6 → out1, out2,
  protocol 15 shape). The overlap Transfer moves a third plate between **two spare STACK-side nests**
  (spare A → spare B). It must never source or target the F.A.S.T. tray (fa100056 tray1) or nest-1/nest-2
  (plates 1 and 2's homes). The operator confirms reach at the GO gate. If no free, calibrated spare
  nest pair exists on the rig (`ListDevices` showed only nest-1 and nest-2 STACK-side on 2026-11-03),
  **stop and return to the user**. Don't fall back to another move without them.
- **D-03:** A **serial return leg** (spare B → spare A) runs in the same run, after the lane barrier, so
  the rig ends where it started. Only the A → B leg overlaps.
- **D-04:** Lane layout follows "each tool maps to exactly one lane per run" (research D5) and Phase 8's
  rules: the F.A.S.T. liquid step is on lane `fast`. All STACK steps (in1, in2, overlap, out1, out2,
  return) stay on the primary lane. The overlap STACK step comes right after the F.A.S.T. step in
  primary order. The first step that must wait for the F.A.S.T. (out1) carries `laneBarrier`. The return
  leg runs after that barrier. The planner chooses the exact row order within these rules.
- **D-05:** **Overlap proof** (LIV-01) is all of the following:
  - The STACK step's STARTED→COMPLETED window lies inside the F.A.S.T. step's window on the run page's
    per-lane rows (queue/run-row timestamps).
  - Both tool servers' logs show their attempts inside the same wall-clock window (STACK2-6.log
    "Running command …" lines; the FA100056 tool log Transfer plus run-progress polling).
  - For event 2, exactly one STACK ledger record per explicit key, each `done/ran`.

  A measured cycle-time saving is **not** required.

### D8 — step keys and auto-mint (settles research D8)

- **D-06:** The live lanes protocol is a **script protocol** that mints explicit, distinct STACK step keys
  per run (the protocol 15 / LIVE-10 pattern: a per-run base plus a per-leg suffix such as
  `-in1/-in2/-x1/-out1/-out2/-x2`) and tags lanes with `galago.lane()` (Phase 8 D-19). A re-run never
  reuses a key. No typed literal keys, and no visual `variable_assignment` keys.
- **D-07:** Step-key auto-mint (galago-tools `0604348`, live since runbook row 3a-7) **stays on**. Explicit
  keys mean it is never used. Every evidence record states the deployed galago-tools SHA and
  `auto-mint: on (not exercised)`. No galago-tools redeploy in this phase.
- **D-08:** The acceptance wording is reworded per research D8. "Per-key one-shot" is claimed only for
  explicit keys in the live proof. The automated guarantee is a unit test (D-09).
- **D-09:** **Gate the live run on an automated "exactly one send per queueId under lanes" test.** The
  planner first checks Phase 8's tests (`controller/test/lanes.test.ts`, `laneHalt.test.ts`,
  `queueRestart.test.ts`). If nothing asserts exactly one tool send per queueId with lanes on, covering
  the overlap, run N+1, and the operator-Start retry after a halt, add that test before any GO gate.
  Tests use fakes only.

### Freeze drill (LIV-02)

- **D-10:** The drill runs on the **production galago-web after the lanes-on rebuild**, inside the
  isolated `uat-sim` workcell against the simulated STACK/F.A.S.T. tool servers (the Phase 8 UAT rig:
  host ports 40091/40092 inside the 40000-40099 window). The real instruments stay connected and idle.
  No real tool receives a command during the drill.
- **D-11:** The drill shows **three scenarios**. In every one, the running row on the other lane ends
  COMPLETED (never aborted), later rows stay CREATED, `laneStatus` shows halted, and only an operator
  Start re-arms the run and finishes it:
  1. A simulated failure on the **stack** step while the fast leg runs halts the fast lane.
  2. A simulated failure on the **fast** step while the stack step runs halts the stack lane.
  3. The operator confirms **Freeze lanes** mid-overlap (`haltReason=freeze`).
- **D-12:** **Order:** rebuild/deploy → drill (sim workcell) → live event 1 (read overlap) → live event 2
  (Transfer overlap). The freeze is proven on the deployed build before real arms move with lanes on.

### Live-run setup and evidence

- **D-13:** **Deploy:** rebuild production galago-web with lanes on, following the runbook's 1a-6
  discipline. First tag a rollback anchor (`docker tag galago-core-galago-web:latest
  galago-core-galago-web:rollback-pre-lanes`, verified equal to the running image). Then run
  `GALAGO_PARALLEL_LANES=1 TOOLBOX_PORT=11010 docker compose up -d --build` from the Phase 8 HEAD
  (compose already passes `GALAGO_PARALLEL_LANES` through). Then check: new image differs, `/api/health`
  ok, the store still holds STACK2-6 + FA100056. Requires a typed GO. — **Reversibility:** costly —
  rollback is re-tagging the anchor or a flag-off restart; both need a container recreate during which
  no run may be in flight. The flag **stays on** after the proof (no flip back).
- **D-14:** **Typed-GO discipline (runbook D-10):** pre-flight `PREFLIGHT OK`, then baselines (STACK2-6.log
  attempt-line count, ledger state, listener PIDs, `GetFailureLatch` latched:false), then the operator's
  literal typed GO with a UTC timestamp, before each live event (deploy, event 1, event 2). The drill
  is gated too, because it runs on the production web app.
- **D-15:** **IN-01 (Phase 8 advisory: the "no dispatch after halt" guarantee relies on synchronous
  SQLite calls) is accepted, and the acceptance is pinned by a test.** Add a static or unit test that fails
  if an `await` (or any async boundary) appears between the halt-latch check and the row claim in the
  dispatch path. Record the disposition in `08-REVIEW-DISPOSITION.md`. No restructure of the queue.
- **D-16:** **Evidence lives in both places:**
  - `.planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md` holds the full record:
    per-lane rows with timestamps, the explicit keys, the galago-core and galago-tools SHAs, auto-mint
    status, log line counts, ledger records and drill outcomes.
  - The galago-tools runbook `vendor/galago-tools/docs/runbooks/gal-07-live-handoff.md` gets a findings
    row for each GO-gated event, as a new row family that continues the 3a-n numbering.
- **D-17:** **Runbook edits** are committed in the galago-tools repo on its current branch
  (`feat/stack-tool`). galago-core's `vendor/galago-tools` gitlink is **not** re-pinned (docs only). The
  galago-tools commit SHA is recorded in `09-LIVE-EVIDENCE.md`. The parallel two-plate-cycle variant is
  added to the runbook **only after LIV-01 passes** (LIV-03).
- **D-18:** **Roles:** Claude prepares (pre-flight, baselines, protocol import/registration, presenting
  each GO gate, reading back logs and ledger, writing evidence). **Only the operator** presses Start,
  Freeze lanes, or any recovery control, after their typed GO. Claude never drives the queue or a tool
  while motion is possible. A live failure is handled by the operator per runbook D-11 (inspect, then
  acknowledge). There is no re-send, no restart and no state or ledger deletion.
- **D-19:** **LIV-03 records:** PROJECT.md (move "Per-toolId concurrency lanes proven live" to
  Validated, with the evidence pointer and the queue's single-flight wording updated for lanes), the lanes
  todo's resolution note (then move it to `todos/completed/`), and the runbook's parallel cycle (after
  LIV-01).

### Claude's Discretion

- How the simulated failures are injected on the sim tool servers (an error reply from the sim server, or
  a deliberately invalid command the sim refuses), as long as no real tool is addressed.
- The exact row order within the D-04 rules, the step-key base format, and the `09-LIVE-EVIDENCE.md`
  layout.
- Whether the D-09 and D-15 tests are new files or additions to the existing lane test files.

### Folded Todos

- **`.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md`.** Its acceptance checklist is this
  phase's target. Live two-tool overlap with per-lane evidence → D-01..D-05. Ledger one-shot intact →
  D-05/D-06/D-09. Lane-halt verified → D-10..D-12. Flag-off byte-identity was already proven in Phase 8
  (golden transcript). PROJECT.md and the resolution note → D-19. The todo moves to completed when LIV-03
  lands.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and decisions
- `.planning/REQUIREMENTS.md` §"Live proof (LIV)": LIV-01..03 wording.
- `.planning/ROADMAP.md` §"Phase 9": goal, success criteria, "Settle in discuss: D5, D8".
- `.planning/research/SUMMARY.md` §"Decisions Needed": the D5 and D8 rows this phase settles.
- `.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md`: the folded todo (constraints 1-5,
  acceptance checklist, resolution note target).
- `.planning/PROJECT.md`: Active item "Per-toolId concurrency lanes proven live" and the Out of Scope list
  (no software-initiated pause/abort, no motion from tests).

### Lane engine (what is being proven)
- `.planning/phases/08-concurrency-lanes/08-CONTEXT.md`: D-01..D-27, especially D-06 flag, D-12/D-13
  latch, D-19 `galago.lane()`, D-23 goto refusal, D-24 freeze, D-25 barrier rule.
- `.planning/phases/08-concurrency-lanes/08-UAT.md`: the simulated-rig rehearsal of the same
  overlap/freeze scenarios (sim ports 40091/40092, `uat-sim` workcell).
- `.planning/phases/08-concurrency-lanes/08-REVIEW-DISPOSITION.md`: IN-01 (accept + pin, D-15).
- `.planning/phases/08-concurrency-lanes/08-VERIFICATION.md`: what Phase 8 already proved.

### Live discipline (galago-tools)
- `vendor/galago-tools/docs/runbooks/gal-07-live-handoff.md`: safety rules, pre-flight, GO gate (D-10),
  recovery drill (D-11), D-14 cycle, Part 1 rebuild discipline (rows 1a-6, 3a-9), the two-plate cycle
  evidence (rows 3a-1..3a-3), auto-mint live (3a-7), and the lanes want (3a-8).
- `vendor/galago-tools/.planning/todos/completed/deploy-step-key-auto-mint.md`: auto-mint behavior and
  deploy shape.
- `vendor/galago-tools/interfaces/tools/grpc_interfaces/stack.proto`: the 10 STACK commands
  (`transfer`, `get_transfer_estimate`, …). Frozen.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Script lane API `galago.lane(name)` and `laneBarrier` (Phase 8). Used to author the live protocol.
- The LIVE-10 two-plate script protocol (store id 15). Its shape and per-run key minting are the
  template for the lanes protocol.
- Per-lane run rows, Lanes panel, Freeze lanes dialog and `laneStatus` read model (Phase 8). These are
  the evidence surfaces.
- `docker-compose.yml:21` already passes `GALAGO_PARALLEL_LANES` through to galago-web.

### Established Patterns
- Typed-GO gated live events with findings rows and rollback anchors (galago-tools runbook).
- Tests use fakes only. No STACK or F.A.S.T. motion from tests.
- The operator decides every recovery action. The web app never pauses, resumes or aborts an instrument
  on its own.

### Integration Points
- `controller/server/command_queue.ts`: the dispatch path where the halt check and the claim sit
  (target of the D-15 pin).
- `controller/test/lanes.test.ts`, `laneHalt.test.ts`, `queueRestart.test.ts`,
  `test/helpers/laneHarness.ts`: the home for the D-09 test.
- Production galago-web container on forb01 (`TOOLBOX_PORT=11010`), and the tool servers under the
  `galago-tools` systemd user unit (STACK :40012, F.A.S.T. :40001).

</code_context>

<specifics>
## Specific Ideas

- The original want (runbook row 3a-8): during the ~73 s F.A.S.T. liquid leg the arm is free to
  maneuver: `in1 → in2 → { FAST liquid ∥ STACK move } → out1 → out2`.
- On hardware, a STACK transfer takes about 28-31 s and the F.A.S.T. leg about 73 s, so one STACK move
  fits inside the window.
- Phase 8 UAT finding: the Gantt chart's default Minutes View makes overlap bars thin slivers. Use the
  per-lane run-card timestamps as the primary overlap evidence.

</specifics>

<deferred>
## Deferred Ideas

- **General step-dependency model:** explicit "step Y depends on step X" links beyond the single
  `laneBarrier` flag. This is a new capability for its own phase. It came up as "task/command
  dependency/blocking" during this discussion.
- A measured cycle-time saving (lanes vs serial) as an acceptance item. Not required here.
- Turning step-key auto-mint off. It stays on (D-07).

</deferred>

---

*Phase: 09-supervised-live-two-tool-proof*
*Context gathered: 2026-11-17*
