# Phase 9: Supervised Live Two-Tool Proof - Research

**Researched:** 2026-11-17
**Domain:** Evidence phase on the existing Phase 8 lane engine (galago-core command queue) plus a supervised live run on forb01 (STACK2-6 + F.A.S.T. FA100056). No new libraries.
**Confidence:** HIGH for repo facts (all read this session); MEDIUM for the sim-rig procedure (the Phase 8 sim launch method is not recorded in any repo file).

**Research was read-only.** No command was sent to any tool server, the production container, or docker. Only local files were read (repo files, the galago-tools checkout, the local ledger and trace logs). Two throwaway test files were created under `controller/test/` to prove the code examples below, run with fakes only, and deleted; `git status` is back to its starting state.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

- **General step-dependency model:** explicit "step Y depends on step X" links beyond the single
  `laneBarrier` flag. This is a new capability for its own phase. It came up as "task/command
  dependency/blocking" during this discussion.
- A measured cycle-time saving (lanes vs serial) as an acceptance item. Not required here.
- Turning step-key auto-mint off. It stays on (D-07).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIV-01 | A supervised live two-tool run shows a STACK step overlapping the F.A.S.T. transfer, with per-lane evidence rows. Explicit step keys are used, and the galago-tools SHA and auto-mint status are recorded. | Findings 3 (script shape and eligibility), 6 (spare-nest stop condition), 7 (evidence mechanics); D-09 test (Finding 1) is the gate; Validation rows V-04..V-08 |
| LIV-02 | Lane-halt and freeze-lanes are shown in a drill that freezes both lanes, using a fake or simulated failure. No automated motion. | Finding 4 (sim rig, deterministic failure injection, hazards); Validation rows V-09..V-11 |
| LIV-03 | PROJECT.md and the lanes todo record the resolution. The galago-tools operator runbook gains the parallel cycle only after LIV-01. | Finding 5 (runbook structure, row ids, test constraints, repo/branch facts); Validation rows V-12..V-14 |
</phase_requirements>

## Summary

Phase 9 ships two small code additions (a behaviour test for D-09 and a static pin for D-15), one script protocol (and a sim-drill protocol), and then a sequence of operator-gated live events with evidence. Nothing in the lane engine changes. Every defect found live stops the work and returns to the user (CONTEXT domain note).

Four findings drive planning. (1) Phase 8 does **not** already assert "every queueId is sent exactly once across overlap, run N+1 and an operator-Start retry after a halt"; it asserts pieces (unique ids for a same-tick double Start, a retried FAILED row re-sent once) but never a whole-run tally, and never that a COMPLETED row of the other lane is not re-sent on retry. A tested, passing D-09 test is drafted below. (2) The D-15 pin is mostly already in place (`staticScan.test.ts:1317-1325` and `sqliteQueueClaim.test.ts` "is declared without the async keyword"), but it does not pin the order of the halt-latch read relative to the row read, nor `queuedRowsSync`/`pickEligible`/`_dispatchGate` being synchronous, nor the actual IN-01 window in `_runSideLane`. A strengthened, negative-controlled pin is drafted and was run green. (3) The **D-02 stop condition is likely to trigger**: the only STACK-side nests evidenced anywhere in the repo or the runbook are nest-1 and nest-2 (row 2a-1 `ListDevices` deviceTree). The runbook's Part 2 step 3 names `orange-nest/deck1/A1` and `rack/l1/A1` as "known hardware nests", but the 2026-11-03 device tree does not list them, so they are unconfirmed candidates only. Plan an early read-only spare-nest check so the user is told before the deploy GO. (4) Several mechanics bite the drill and the evidence: the sim-failure injection must be mid-overlap (an invalid-argument refusal fails at dispatch time, before the other lane's step is guaranteed to be running), a retry overwrites `startedAt`, the production workcell selection is global and workcell-scoped store reads feed the pre-flight, and the runbook's own test caps "Reply: literal go" at exactly 3 occurrences.

**Primary recommendation:** Plan in this order: (a) D-09 test + D-15 pin + IN-01 disposition (autonomous, fakes only); (b) lanes live protocol and sim-drill protocol, proven offline through `executeProtocolScript` + `validateLanes`; (c) an early read-only spare-nest checkpoint that can stop LIV-01 without blocking LIV-02; (d) deploy GO, drill GO (sim only), event 1 GO, event 2 GO, each with baselines and an evidence row; (e) LIV-03 records. Snapshot row JSON before every operator Start.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-lane dispatch, halt latch, claim (one send per queueId) | API / Backend (galago-web `CommandQueue`, `SqliteQueue`) | Database / Storage (better-sqlite3 synchronous claim) | The queue is the only dispatcher; the claim is a synchronous SQLite transaction |
| Lane layout of the live cycle (tags, barrier, keys) | API / Backend (script executor at queue time) | — | The script runs server-side in a `vm` sandbox and writes `advancedParameters` |
| Start, Freeze lanes, recovery decisions | Browser / Client (operator presses) | API / Backend (tRPC `restart`, `freezeLanes`) | D-18: only the operator presses; Claude never drives |
| Instrument motion and its one-shot ledger | Tool server (galago-tools STACK `:40012`, F.A.S.T. `:40001`) | Host filesystem (`~/.local/state/galago-tools/stack/stack-ledger.json`) | Tool servers own motion locks, failure latch and ledger; the queue never touches them |
| Simulated drill rig | Tool server (sim processes on `:40091`/`:40092`) | API / Backend (isolated `uat-sim` workcell) | Sim servers never reach an instrument; the workcell isolates tool rows |
| Evidence (rows, logs, ledger, SHAs) | Host filesystem + API read queries | Git docs (`09-LIVE-EVIDENCE.md`, runbook rows) | Evidence is read back, never produced by sending commands |

## Standard Stack

No external packages are installed or changed in this phase. Everything below is already in the repo.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 2.1.9 [VERIFIED: `npx vitest run` output "RUN v2.1.9"] | Unit and static-scan tests (fakes only) | Existing Phase 8 harness (`test/helpers/laneHarness.ts`) |
| TypeScript (`tsc --noEmit`) | repo-pinned | Type gate; also pins `queuedRowsSync()` returning an array, not a Promise | `controller/package.json` `"test": "npx tsc --noEmit"` [VERIFIED: package.json:11] |
| Prettier | repo-pinned | Format gate for touched files | `controller/package.json` `test:fmt` [VERIFIED: package.json:13] |
| Python `unittest` (galago-tools) | `.venv` | Runbook structure test | `tools/tests/gal07_live_runbook_test.py::TestRunbookContent` [VERIFIED: ran, 5 tests OK] |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `bash docs/runbooks/gal-07-live-check.sh` | Pre-flight; last line `PREFLIGHT OK` | Before every GO (deploy, drill, event 1, event 2) |
| `scripts/fast_status.py --port <n>` (galago-tools) | Read a tool server's status | Baselines (operator or Claude while idle) |
| `ss -ltnp` | Listener PID baselines | Baselines; also to find the sim PIDs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Strengthening `staticScan.test.ts` | A new `laneDispatchPins.test.ts` | `staticScan.test.ts` already holds `stripComments` and `extractBracedRegion` (not exported); a new file must copy them. Prefer adding to `staticScan.test.ts` |
| Refactoring the dispatch to re-check the gate after `_shouldSkip` (IN-01 fix) | Pin and accept | Locked by D-15: accept and pin; no queue restructure |

**Installation:** none.

**Version verification:** not applicable (no packages). Vitest version read from the live run this session.

## Package Legitimacy Audit

No external packages are installed in this phase. The audit is not applicable.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
operator (browser)                         Claude (prepare / read back only)
   | Start, Freeze lanes (typed GO first)       | pre-flight, baselines, evidence, docs
   v                                            v
galago-web (container, GALAGO_PARALLEL_LANES=1) ---- read queries: commandQueue.laneStatus / commands / getAll
   |
   |  script protocol (vm sandbox) --> galago.lane()/command(..., {barrier}) --> validateLanes (run creation)
   v
SqliteQueue rows (CREATED -> STARTED -> COMPLETED/FAILED; startedAt/completedAt stamped)
   |
   +-- primary lane loop (1500 ms poll) ----\
   |                                         \__ _pickNext(): state==BUSY? -> queuedRowsSync() -> pickEligible(rows, lane,
   +-- lane "fast" worker (1500 ms poll) ----/      _dispatchGate{halted,...}) -> claimEligible(queueId)   [one sync span]
   |
   v  Tool.executeCommand (gRPC)                      failure/freeze --> _laneHalt latch --> no new dispatch on ANY lane
 STACK2-6 :40012 (real)   FA100056 :40001 (real)      running steps finish (never aborted); only an operator Start re-arms
 sim STACK :40091   sim FAST :40092 (uat-sim, drill only)
   |
   v  evidence: row timestamps, STACK2-6.log / FA100056.log attempt lines, stack-ledger.json records
```

### Recommended Project Structure
```
controller/test/
├── laneOneSend.test.ts          # D-09 (new file; fakes only)  -- or additions to lanes.test.ts
├── staticScan.test.ts           # D-15 pin added under "concurrency lane seams"
.planning/phases/09-supervised-live-two-tool-proof/
├── 09-LIVE-EVIDENCE.md          # full record (D-16)
├── (protocol JSON for the live cycle and the sim drill, planner chooses location)
.planning/phases/08-concurrency-lanes/08-REVIEW-DISPOSITION.md   # IN-01 row updated (D-15)
../galago-tools/docs/runbooks/gal-07-live-handoff.md             # new rows 3a-11.. + parallel variant (after LIV-01)
```

### Finding 1: D-09 coverage gap (cite exact tests either way)

What Phase 8 already asserts, read this session:

| Test (file:line) | What it proves | Gap vs D-09 |
|------------------|----------------|-------------|
| `lanes.test.ts:93` "two Starts in the same tick log one Queue Started and dispatch every row once" | 6 unique queueIds for the headline run (`expect(new Set(ids).size).toBe(6)`) | Single run, no run N+1, no halt/retry |
| `lanes.test.ts:231` "run N+1 waits until run N has drained" | Command order only (`toEqual(["in1","transfer","next"])`) | No per-queueId tally |
| `lanes.test.ts:278` "fails the row, stops new dispatch on every lane and retries on the next Start" | The FAILED `transfer` row is sent twice with the same queueId (`retried[1].queueId` equals `retried[0].queueId`); `h.calls()` length 2 before the Start | Filters to `transfer` only; never asserts the COMPLETED row `A` is not re-sent, nor that nothing else is double-sent |
| `laneHalt.test.ts:296` "an accepted operator Start clears the latch ... and retries the FAILED row first" | Same retry shape for `t1` | Same gap |
| `laneHalt.test.ts:80`, `:228`, `:268` | No dispatch while halted; enqueue auto-start refused while halted; operator Start while busy changes nothing | Individual `calls()` length checks, no tally |
| `sqliteQueueClaim.test.ts:57-82` | `claimEligible` refuses STARTED, COMPLETED and SKIPPED rows | Store-level only |
| `queueRestart.test.ts:78` | An orphan STARTED row from a previous process is failed, never re-dispatched | Flag-off construction (`new CommandQueue({} as any)`), single run |

**Conclusion:** nothing asserts the combined property, so D-09 requires a new test before any GO gate. By design a FAILED row is re-sent once per operator Start (the tool server's own ledger/latch decides); the correct invariant is "every queueId is sent exactly once, except a row that FAILED, which is sent once more per accepted operator Start; a COMPLETED row is never re-sent".

Verified test (run green, then removed). Place it in a new `controller/test/laneOneSend.test.ts`:

```ts
// Phase 9 D-09: exactly one tool send per queueId under lanes. Fakes only (harness spies Tool.executeCommand).
import { describe, it, expect, afterEach } from "vitest";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { createLaneHarness, stackStep, fastStep, type LaneHarness } from "./helpers/laneHarness";

let h: LaneHarness | undefined;
afterEach(async () => { if (h) await h.teardown(); h = undefined; });

function sendsByQueueId(harness: LaneHarness): Map<number, number> {
  const tally = new Map<number, number>();
  for (const call of harness.calls()) {
    expect(call.queueId, `call ${call.command} has no queueId`).toBeDefined();
    tally.set(call.queueId!, (tally.get(call.queueId!) ?? 0) + 1);
  }
  return tally;
}
async function releaseAll(harness: LaneHarness, rounds = 20) {
  for (let i = 0; i < rounds; i++) {
    await harness.tick(3);
    for (const call of harness.calls()) if (!call.gate.isSettled()) call.gate.resolve(undefined);
  }
}

describe("one send per queueId under lanes (D-09)", () => {
  it("overlap run plus run N+1: every row is sent exactly once", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      stackStep("in1"), stackStep("in2"),
      fastStep("transfer", { lane: "fast", barrier: true, params: { tag: "FAST" } }),
      stackStep("x1"), stackStep("out1", { barrier: true }), stackStep("out2"), stackStep("x2"),
    ]);
    await h.push("r2", [stackStep("n1"), stackStep("n2")]);
    const done = h.start();
    await releaseAll(h);
    await done;
    const tally = sendsByQueueId(h);
    expect(h.calls()).toHaveLength(9);
    expect(tally.size).toBe(9);
    expect([...tally.values()].every((n) => n === 1)).toBe(true);
    expect((await h.queue.commands.all()).every((r) => r.status === "COMPLETED")).toBe(true);
    expect(h.queue.state).toBe(ToolStatus.OFFLINE);
  });

  it("halt, refused auto-start, operator Start and a second Start: only the failed row is sent twice", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      fastStep("t1", { lane: "fast", barrier: true, params: { tag: "F1" } }),
      stackStep("A"), stackStep("B"),
      fastStep("t2", { lane: "fast", params: { tag: "F2" } }),
    ]);
    await h.push("r2", [stackStep("n1")]);
    h.start();
    await h.tick(3);
    expect(h.calls().map((c) => c.command).sort()).toEqual(["A", "t1"]);
    const t1 = h.calls().findIndex((c) => c.command === "t1");
    const a = h.calls().findIndex((c) => c.command === "A");
    h.fail(t1, new Error("boom"));
    await h.tick(3);
    h.finish(a);
    await h.tick(10);
    expect(h.calls()).toHaveLength(2);        // nothing sent while halted
    h.start("enqueue");
    await h.tick(6);
    expect(h.calls()).toHaveLength(2);        // the enqueue auto-start is refused while halted
    h.start();                                // the operator Start
    await h.tick(4);
    h.start();                                // a second operator Start while running is ignored
    await h.tick(4);
    await releaseAll(h);
    const tally = sendsByQueueId(h);
    const t1Id = h.calls()[t1].queueId!;
    expect(tally.get(t1Id)).toBe(2);
    for (const [id, n] of tally) if (id !== t1Id) expect(n, `queueId ${id}`).toBe(1);
    expect(tally.size).toBe(5);               // t1, A, B, t2, n1
    expect(h.calls()).toHaveLength(6);
  });
});
```

Recommended acceptance for the plan: temporarily weaken `claimEligible`'s status check (or add a duplicate send) and confirm the new test fails, then revert (mutation check, not committed).

### Finding 2: D-15, the dispatch path and how to pin "no await between the latch check and the claim"

[VERIFIED: command_queue.ts:1391-1407] The whole dispatch decision is `_pickNext` (quoted verbatim):

```
1394    if (this.state !== ToolStatus.BUSY) return WAIT;
1395    const rows = this.commands.queuedRowsSync();
1396    const verdict = pickEligible(rows, lane, this._dispatchGate());
...
1406    const claimed = this.commands.claimEligible(verdict.row.queueId);
```

- The halt latch is read at `_dispatchGate()` (`command_queue.ts:1430` `halted: this._laneHalt !== undefined`), evaluated inside the `pickEligible(...)` call on line 1396; a failure/stop/freeze also leaves state non-BUSY (line 1394). The claim is `claimEligible` on line 1406 (`SqliteQueue.ts:155`, one synchronous `db.transaction`).
- `queuedRowsSync` is `SqliteQueue.ts:425`; `better-sqlite3` is the driver (`SqliteQueue.ts:1` `import Database from "better-sqlite3"`), so these are synchronous.
- Existing pins: `staticScan.test.ts:1317-1325` asserts `region.slice(read, claim)` has no `await` (read = `queuedRowsSync()`, claim = `claimEligible(`), and `sqliteQueueClaim.test.ts:114` asserts `claimEligible` is declared without `async`.
- Gaps in the existing pin: (a) it does not assert the `_dispatchGate(` / `pickEligible(` text lies inside the span, so a refactor that reads the gate earlier (before an await) still passes; (b) it starts the span at the row read, not at the state check on line 1394; (c) it does not pin `queuedRowsSync`, `pickEligible`, `_dispatchGate` as non-async (only tsc implicitly does); (d) the existing regex only matches `await`; (e) the actual IN-01 text concerns `_runSideLane`: [VERIFIED: 08-REVIEW.md:97-101] "`_runSideLane`, claim then `await this._shouldSkip(...)` before `_sideRunning.set`". In the current source `await this._shouldSkip(picked, lane)` is at `command_queue.ts:1452` and `this._sideRunning.set(lane, attempt)` at `:1469`, so a latch landing during that await is not re-checked before `executeCommand`.
- Why it is safe today: `_shouldSkip` returns `false` with no I/O when there is no `skipExecutionVariable.variable` (every script-emitted row has `skipExecutionVariable: { variable: null, value: "" }` [VERIFIED: protocol-script-executor.ts:46-49]), and with `better-sqlite3` even the variable lookup resolves in microtasks, so no HTTP-handler macrotask (a Freeze) can interleave. An async driver would open the window. That is the accepted risk (D-15).

Verified pin (added to `staticScan.test.ts` under `describe("concurrency lane seams ...")`; ran green on the real source and was proven able to fail by injecting an `await` into three different places of a mutated copy of the `_pickNext` text):

```ts
  // D-15 / IN-01: the "may dispatch" read and the claim are one synchronous span.
  describe("dispatch span (D-15, IN-01)", () => {
    const ASYNC_BOUNDARY =
      /\bawait\b|\byield\b|\.then\s*\(|\.catch\s*\(|\bnew\s+Promise\b|\bsetTimeout\b|\bsetImmediate\b|\bqueueMicrotask\b|process\.nextTick/;
    const pickNext = extractBracedRegion(queueSrc, /private async _pickNext\(/);

    // Text from the state check through the claim, with the order of the five anchors asserted.
    function dispatchSpan(region: string): string {
      const from = region.indexOf("this.state !== ToolStatus.BUSY");
      const read = region.indexOf("queuedRowsSync()");
      const pick = region.indexOf("pickEligible(");
      const gate = region.indexOf("this._dispatchGate()");
      const claim = region.indexOf("claimEligible(");
      for (const [name, at] of Object.entries({ from, read, pick, gate, claim })) {
        expect(at, name).toBeGreaterThanOrEqual(0);
      }
      expect(from).toBeLessThan(read);
      expect(read).toBeLessThan(pick);
      expect(pick).toBeLessThan(gate);
      expect(gate).toBeLessThan(claim);
      return region.slice(from, claim);
    }

    it("has no async boundary from the state check through the claim", () => {
      expect(dispatchSpan(pickNext)).not.toMatch(ASYNC_BOUNDARY);
    });

    it("the pin fails when an await is injected (negative control, mutate the REGION text)", () => {
      for (const [from, to] of [
        ["const verdict = pickEligible(", "await Promise.resolve(); const verdict = pickEligible("],
        ["const rows = this.commands.queuedRowsSync();", "const rows = await this.commands.queuedRowsSync();"],
        ["const claimed = this.commands.claimEligible(", "const claimed = await this.commands.claimEligible("],
      ]) {
        const mutated = pickNext.replace(from, to);
        expect(mutated, from).not.toBe(pickNext);
        expect(dispatchSpan(mutated), from).toMatch(ASYNC_BOUNDARY);
      }
    });

    it("the helpers on the span are synchronous", () => {
      expect(extractBracedRegion(queueSrc, /private _dispatchGate\(/)).not.toMatch(ASYNC_BOUNDARY);
      const sched = stripComments(read("server/laneScheduling.ts"));
      expect(sched).toMatch(/export function pickEligible</);
      expect(sched).not.toMatch(/\basync\b/);
      const sq = read("server/utils/SqliteQueue.ts");
      const m = sq.match(/^[ \t]*(async[ \t]+)?queuedRowsSync\(\)/m);
      expect(m).not.toBeNull();
      expect(m && m[1]).toBeUndefined();
    });

    it("side lane (the IN-01 window): the only await between the pick and the send is _shouldSkip", () => {
      const region = extractBracedRegion(queueSrc, /private async _runSideLane\(/);
      const pickCall = "await this._pickNext(lane)";
      const from = region.indexOf(pickCall) + pickCall.length;
      const to = region.indexOf("await this.executeCommand(picked)");
      expect(from).toBeGreaterThan(pickCall.length - 1);
      expect(to).toBeGreaterThan(from);
      const awaits = region.slice(from, to).match(/\bawait\b[^;]*;/g) ?? [];
      expect(awaits).toHaveLength(1);
      expect(awaits[0]).toContain("this._shouldSkip(picked, lane)");
    });
  });
```

Caveat for the planner (a mutation gotcha found while proving this): when writing the negative control, mutate the text of the extracted region, not the whole file. `"const rows = this.commands.queuedRowsSync();"` also occurs earlier in the file (the `laneStatus` method, line 1338), so a whole-file `String.replace` mutates the wrong place and the control wrongly "passes".

**Disposition record (D-15).** `08-REVIEW-DISPOSITION.md` has IN-01 as `disposition: open` in the YAML front matter (one `findings:` entry) and a table row `| IN-01 | info | open | - |`. Its legend says the allowed values are `open`, `fixed`, `skipped`, `deferred`, and "Set `deferred` by hand and put the reason in the Source cell; both are preserved." Recommended: set `skipped` with a Source cell such as "accepted in Phase 9 D-15; pinned by test/staticScan.test.ts (dispatch span)" and update both the front-matter entry and the table row consistently (also adjust the `open:` count in the header). [ASSUMED: that `skipped` is the right value for "accepted"; the file offers no `accepted` value, so confirm in plan review.]

### Finding 3: Lane protocol shape, script API, per-run key minting

[VERIFIED: protocol-script-executor.ts:24-55] API (quoted): `lane(name?: string)` sets a sticky lane ("Blank or \"primary\" resets it"); `command(toolId, command, cmdParams = {}, opts: { lane?: string; barrier?: boolean } = {})`; Tool Box helpers never inherit the sticky lane; `lane`/`laneBarrier` keys are written only when set. `galago.note/timer/pause/...` are Tool Box commands (always primary). The sandbox exposes `Math`, `Date`, `Array`, `String`, `Number`, `JSON`, etc., so the per-run key base pattern works. `docs/script-protocols.md` does not document `galago.lane` or the `{ barrier }` option (grep found no "lane" in it), so do not point the operator at it for lanes.

The repo template for per-run key minting is the GAL-02 script in `vendor/galago-tools/docs/runbooks/gal-02-handoff.protocol.json` (3 legs, keys `base + "-in"` / `"-out"`, `base = label(<=20 code points) + "-" + new Date().toISOString() + "-" + rand8hex`). **Store protocol 15 itself is not in any repo file** (the dev DB copy holds only a stub protocol), so the planner must have the script read from the production store (an HTTP GET of the protocol, no tool contact) before authoring, to reuse its parameter names, labware profile and nest triples. Known live values from the runbook rows (not from protocol 15): in1 `STACK2-6 nest-1/deck1/A1 -> fa100056/tray1/5`, in2 `nest-2/deck\`/A1 -> fa100056/tray1/6` (the deck name contains a literal backtick), F.A.S.T. leg deck 5 to 6, volume 5 uL, tip fresh, labware profile `Default` (rows 2a-2, 3a-2).

Eligibility rules that fix the row order (read in `laneScheduling.ts:129-172`, `validateLanes` at `:270-345`):
- A row is blocked by any earlier same-run row on its own lane and by every earlier row before its last barrier at or before it; a STARTED row on its lane, a STARTED Tool Box row, a busy tool key, the halt latch, or an open modal also block it. A `laneBarrier` row waits for everything earlier.
- Run creation refuses: a non-boolean barrier, an invalid lane name, a Tool Box step on a secondary lane, one tool on two lanes, more than 4 lanes, the first row of a secondary lane without a barrier (unless it is step 1), a Tool Box `goto` in a laned run, and a dead wait.
- A run N+1 starts only after run N has drained (`lanes.test.ts:231`).

Recommended row order (the planner may refine within D-04):

```
1  Tool Box note  "key base <base>"                     (primary; optional)
2  STACK  transfer  in1   key <base>-in1   nest-1 -> fa100056/tray1/5
3  STACK  transfer  in2   key <base>-in2   nest-2 -> fa100056/tray1/6
4  FAST   transfer  (liquid, deck 5 -> 6)   galago.lane("fast"); { barrier: true }
5  STACK  overlap step     (primary: galago.lane() reset first)
       event 1: get_transfer_estimate (no step_key; fields of the event-2 move)
       event 2: transfer  key <base>-x1   spareA -> spareB
6  STACK  transfer  out1   key <base>-out1  { barrier: true }
7  STACK  transfer  out2   key <base>-out2
8  STACK  transfer  return key <base>-x2   spareB -> spareA        (event 2 only, D-03)
```

Pitfalls specific to this script (see Pitfalls): the sticky `galago.lane("fast")` must be reset with `galago.lane()` before row 5, otherwise the STACK overlap step lands on lane `fast` behind the F.A.S.T. step (same lane order), runs serially, and still passes validation. `get_transfer_estimate` has no `step_key` field [VERIFIED: stack.proto:60-70, ten optional strings from `robot` to `destination_transfer_profile`], so event 1's step carries the transfer fields without `step_key` and `timeout_s`. Use the offline proof (Validation V-03): run the script through `executeProtocolScript` with sample params, assert each STACK key is distinct, the lane layout is exactly as above, and `validateLanes` returns `[]`.

Timing of the overlap windows: [VERIFIED: command_queue.ts:180] `this._loopDelayMs = options?.loopDelayMs ?? 1500;` Each lane loop sleeps 1500 ms between polls. After `in2` completes, the `fast` worker claims FAST at some phase within the next 0-1500 ms and the primary loop claims the overlap step on its next poll, so the FAST `startedAt` precedes the overlap step's by up to about 1.5 s in the common case, but the code gives no guarantee of order. State the D-05 containment criterion with that tolerance, and record raw millisecond timestamps (see Finding 7).

### Finding 4: The Phase 8 sim rig and injecting failures without addressing a real tool

What the repo records [CITED: 08-UAT.md and PROJECT.md key-decisions row]: UAT ran with `GALAGO_PARALLEL_LANES=1` in the **dev** compose, an isolated `uat-sim` workcell, simulated STACK/F.A.S.T. tool servers on host ports 40091/40092 (inside the container's 40000-40099 firewall window), tools named `SIM-STACK` / `SIM-FAST`; the sim F.A.S.T. server was stopped to produce a `CANCELLED` failure (UAT test 2); a primary STACK step with `timeout_s=-1` produced `INVALID_ARGUMENTS` (UAT test 2). The launch method of the sim servers is **not recorded in any repo file**. [VERIFIED: `ss -ltn` this session] nothing listens on 40091/40092 now, so the sim servers must be started again.

Facts from the galago-tools source that make the rig safe and predictable:
- Simulated mode is a per-tool `Configure(simulated=true)` (the tool page "Simulate" toggle, `ToolConfigEditor.tsx` `saveConfig(simulated)`; base server `Configure` returns SUCCESS before `_configure` when `request.simulated`) [VERIFIED: base_server.py:90-107]. In simulated mode `_dispatchCommand` returns the base class's simulated sleep and never opens the STACK manager connection, lock or ledger (`tools/stack/server.py` `_dispatchCommand`: `if self.simulated: return super()._dispatchCommand(command)`).
- Sim durations: STACK `Transfer` sleeps `EST_TRANSFER_S = 35` s, STACK `GetTransferEstimate` 3 s (`EST_TRANSFER_ESTIMATE_S = 3`), F.A.S.T. `Transfer` sleeps `EST_TRANSFER_OVERHEAD_S + EST_TRANSFER_PER_CYCLE_S * cycles` = 60 + 20*cycles (at least 80 s) [VERIFIED: stack/server.py:133-134, fast/server.py:157-158,1055-1060]. So the real 28-31 s inside 73 s nesting is reproduced in the sim.
- Argument refusals happen before the sim sleep, in both modes, on both servers: STACK `_check_args` refuses `timeout_s` negative or non-finite; F.A.S.T. `_check_args` refuses, for example, `volume` not positive or a deck outside 1-6.
- The real servers run as `/home/formulatrix/data/nikko/galago-tools/.venv/bin/python3 -m tools.stack.server --port=40012` (pid 7491) and `-m tools.fast.server --port=40001` (pid 2320808) [VERIFIED: `ps` this session]. [ASSUMED] The sim servers can be started by hand the same way with `--port=40091` and `--port=40092`, redirecting output to a scratch log; hand-launched servers do not write under the real `trace_logs` folder, whose files are created by the galago-tools launcher.

Deterministic failure injection (recommended; the planner should adopt rather than the immediate-refusal approach):

| Scenario | Injection | Why this shape |
|----------|-----------|----------------|
| 1: stack step fails while the fast leg runs | Put a valid sim STACK step first on primary (sleeps 35 s) and an invalid-argument STACK step (`timeout_s: -1`) second; FAST on lane `fast` running about 80 s | The refusal then lands about 35 s in, while FAST is certainly running. A refusal as the FIRST primary step can land before the `fast` worker has claimed FAST (it fails in milliseconds, the `fast` poll can be up to 1.5 s away), so FAST would never start and the scenario would not show "the other lane's running row ends COMPLETED" |
| 2: fast step fails while the stack step runs | Stop the sim F.A.S.T. process (pid taken from `ss -ltnp 'sport = :40092'`) while the sim STACK step sleeps | Yields `CANCELLED`/unavailable mid-flight, as UAT test 2 did. An invalid F.A.S.T. argument fails instantly and may land before the stack step is claimed |
| 3: Freeze lanes | The operator confirms the Freeze dialog while both sim steps run | `haltReason=freeze`; nothing aborted |

Re-arming: an operator Start retries the FAILED row first (`laneHalt.test.ts:296`). An invalid-argument row fails again on retry, so use transient failures where the drill must "finish" (scenario 2 and 1 via a stopped/restarted sim server). After restarting a sim server it is **not** simulated and not configured; the operator re-Configures it from its tool page with the Simulate toggle **on** before pressing Start. The controller does not re-configure on its own (`tools.ts` heartbeat only polls status). Scenario 1 can use the same transient method (stop and restart the sim STACK server, re-Configure simulated) if "Start finishes the run" must hold; the invalid-argument variant would only re-halt.

Isolation and hazards:
- **Never kill a sim server by name or pattern.** `pkill -f tools.fast.server` also matches the real `:40001` server. Kill only the PID that `ss -ltnp 'sport = :40092'` (or `:40091`) reports.
- The workcell selection is global and workcell-scoped: `tool.getAll` filters by `getSelectedWorkcellId()` [VERIFIED: routers/tool.ts:183-187], and pre-flight check 6 reads `GET /api/tools` and requires a configured stack tool with host `10.150.1.125` and a fast tool. While `uat-sim` is selected, the real tools are not listed, so check 6 will BLOCK. Switch back to the real workcell (`test`, the only workcell in the dev DB copy; production not inspectable) and re-run the pre-flight before event 1.
- Give the sim tool entries a placeholder host (not `10.150.1.125`) so that an accidental non-simulated Configure can never reach the real manager. [ASSUMED] This is a precaution not recorded in Phase 8.
- Leave no run state behind: pre-flight check 7 blocks if any run is RUNNING; the drill must end with an empty queue, `laneStatus.halted=false`, and no latch. A latch left from the drill makes the next enqueue's auto-start refuse (`command_queue.ts:1229-1237` "source === \"enqueue\" && this._laneHalt").

### Finding 5: The galago-tools runbook, repo and branch, and numbering

- **Where the edits go.** [VERIFIED: git this session] `~/data/nikko/galago-tools` is on branch `feat/stack-tool` at `d53da53`; the runtime unit is an editable install of that directory. `galago-core/vendor/galago-tools` is a submodule checkout in **detached HEAD** at the same `d53da53`, with the same runbook (byte-identical via `diff`). D-17 says "committed in the galago-tools repo on its current branch (`feat/stack-tool`)", so edit and commit in `~/data/nikko/galago-tools`, not in the vendor submodule. The vendor gitlink is not re-pinned (D-17).
- **Dirty working tree there.** `git status` in galago-tools shows many pre-existing ` D .planning/phases/...` deletions, ` M .planning/state.json`, and untracked `tools/fast-mcp-locks/`. Commit with an explicit path (`git commit -- docs/runbooks/gal-07-live-handoff.md` after `git add` of that one file); never `git add -A`/`-a`.
- **Deployed SHA to record.** [VERIFIED] HEAD `d53da5384f9f99d6751a5abfbbe0abbaa7a02389`, committed 2026-11-12T13:26:07+07:00; `0604348` (auto-mint) is an ancestor (`git merge-base --is-ancestor` true); the STACK and toolbox servers started 2026-11-14 22:27 and the F.A.S.T. server 2026-11-16 15:34 (after the commit date), and `tools/` has no uncommitted changes. Re-verify these three facts at the baseline, because a restart would change them.
- **Row numbering.** Existing findings rows: `G0`, `1a-1..6`, `2a-1..3`, `3a-1..10` [VERIFIED: grep of `^| 3a-`]. The next ids are `3a-11` onward. Suggested: `3a-11` deploy (D-13), `3a-12` sim drill, `3a-13` event 1, `3a-14` event 2, `3a-15` the parallel-variant documentation note.
- **Structural hazards in the runbook file.** Rows 3a-8 (line 2), 3a-9 and 3a-10 (lines 227, 229) sit outside the Findings log table (3a-8 above the H1 prose, 3a-9/3a-10 inside the Part 1 evidence table). The trailing "Row guidance:" prose is glued to the end of row 3a-7's line (`... | PASS |Row guidance: ...`; the string `PASS |Row guidance` occurs exactly once). Insert new rows by splitting at that string (`| PASS |` newline, blank line, new rows, blank line, `Row guidance:`), so they land inside the Findings log. Do not "tidy" the earlier misplaced rows unless the user asks.
- **The runbook's own test constrains the edit.** [VERIFIED: gal07_live_runbook_test.py:541-554] Exactly one `Reply: literal go` per Part slice and exactly 3 in the whole file. A new GO section or a new findings row must not contain that exact phrase; write "typed go" in rows (as existing rows do). A new subsection must not start with `## Part 1:`, `## Part 2:` or `## Part 3:`; put the parallel variant as a `###` subsection inside Part 3, before `## Recovery drill (D-11)`, and word its gate as "the same typed-go discipline (D-10)" without the phrase. Run `cd ~/data/nikko/galago-tools && .venv/bin/python -m unittest tools.tests.gal07_live_runbook_test.TestRunbookContent` after the edit (read-only structural test, 5 tests, passes now). The other classes in that file execute the pre-flight script against stubs; do not run them as part of this check.
- **Pre-flight facts.** `bash docs/runbooks/gal-07-live-check.sh` checks: manager identity, owner lock (galago holder accepted), pinned core `934a621...`, DEP-02 gate, `Command_Transfer` in the container bundle, store holds a stack tool with host `10.150.1.125` **and** a fast tool (check 6), no RUNNING run (check 7), credentials env (blocking with `GAL07_REQUIRE_STACK_ENV=1`). Run both forms before each GO.
- **D-11 recovery** (read, never delete; operator inspects the arm; acknowledge via manager UI `http://10.150.1.125:5005` with the guid and the literal `yes`; AcknowledgeFailure tool-page fallback; never restart-to-reset; replay window `REPLAY_WINDOW_S = 600`).
- **1a-6 rebuild discipline** (D-13): tag the anchor, verify the tag equals the running image **before** the build, build, new image must differ (cache-hit STOP), `/api/health`, bundle check, store still holds `STACK2-6` + `FA100056`. Row 3a-10 is the latest precedent (anchors `rollback-pre-icons2`).

### Finding 6: Spare STACK nest evidence (D-02 stop condition), from files only

- [VERIFIED: runbook row 2a-1, galago-tools `gal-07-live-handoff.md:345`] `ListDevices` on 2026-11-03 returned `deviceTree (nest-1 deck1/A1, nest-2 "deck`"/A1, fa100056 tray1)`. That is the whole documented STACK-side device tree. [CITED: 09-CONTEXT.md D-02] says the same.
- [VERIFIED: runbook line 257-259 (read)] Part 2 step 3 states "The known hardware nests are `nest-1/deck1/A1`, `orange-nest/deck1/A1` and `rack/l1/A1`". These are named in the runbook, but they do **not** appear in the 2026-11-03 device tree, and nothing in the repo shows they are calibrated, free, or reachable from `stack2-6`. Treat them as unconfirmed candidates. [ASSUMED] They may be hardware seen in an earlier STACK session.
- No repo file records labware presence on any nest other than nest-1/nest-2, and no file proves a calibrated reach between two non-tray nests. The local STACK2-6 trace log holds only request lines and HTTP status codes (no device-tree bodies), so it does not settle it either.
- **Conclusion:** with the information in the repo, D-02 will most likely end in "stop and return to the user" for LIV-01 unless the operator confirms a spare nest pair live. Plan a read-only checkpoint early, run by the operator (or Claude only while the rig is idle, per D-18): `ListDevices`, `GetLabwarePresence` for `stack2-6`, and a standalone `GetTransferEstimate` for the exact spare A to spare B fields (this also rehearses event 1's fields; a manager refusal such as the `unhandledException` family seen in row 2a-1 shows up here instead of mid-run). Place it before the deploy GO so the user learns early; LIV-02 (deploy + drill) does not depend on it.
- Informational only: the real ledger and STACK2-6 log show four live transfers with auto-minted keys on 2026-11-16 11:21-11:24Z (ledger records `20261116T112155412690-fa9f500f`, `...112231568373-b462a208`, `...112352733658-5c2f1376`, `...112423485857-6c8ff899`, all `done`/`ran`) and one F.A.S.T. `Transfer` line at 18:23:02 local. That shows the rig and auto-mint worked on 2026-11-16 but says nothing about spare nests.

### Finding 7: Evidence mechanics

- **Row timestamps.** [VERIFIED: SqliteQueue.ts:739-741 `if (updates.status) { setRunStatusWithTimestamp(newItem, updates.status); }`; HasRunStatus.ts:6-27] a STARTED transition sets `startedAt`, COMPLETED sets `completedAt`, FAILED sets `failedAt`, each a `Date`. **A retry re-enters STARTED and overwrites `startedAt`** (the failed attempt's `failedAt` is kept). Snapshot the run's rows (via the read queries below) at each halt, before the operator presses Start, or the failed attempt's start time is lost.
- **Read queries** (HTTP GET/tRPC queries only; none sends a tool command): `commandQueue.laneStatus` returns `LaneStatusSnapshot` [VERIFIED: laneScheduling.ts:65-74] with fields `laneMode`, `hasLaneRows`, `halted`, `haltReason` (`"failure" | "freeze" | "modal"` or null), `queueBusy`, `runningLanes`, `failures`, `overflow`; also `commandQueue.commands`, `getAll`, `getAllRuns` (`routers/command_queue.ts:73-86`). `restart`, `freezeLanes`, `stop`, `clearAll` are mutations: operator only.
- **Run card captions** show `Started HH:MM:SS` / `Ended HH:MM:SS` per row (`laneStatus.ts:122-139`, second resolution). Use these as the human-visible corroboration and the raw millisecond values from the read queries as the record. The Gantt Minutes View makes overlap bars slivers (08-UAT test 4), so do not use it as the primary evidence.
- **Logs.** The current tool-log folder is `~/.local/share/galago/trace_logs/1794670020/` holding `STACK2-6.log`, `FA100056.log`, `Tool Box.log` [VERIFIED: directory listing]. Local timestamps in the logs are UTC+7; the ledger is UTC. A tool-server start truncates its log in place (runbook step 2.3), so never restart a tool server during the phase, and take the line-count baseline immediately before each GO. On 2026-11-17 the baseline was 4 `Running command Transfer` lines in `STACK2-6.log` and 1 in `FA100056.log`; the baseline must be re-read at execution time.
- **Ledger.** [VERIFIED: file read] `~/.local/state/galago-tools/stack/stack-ledger.json`, mode 0600, shape `{ "version": ..., "records": { "<key>": { "state", "result": { "kind" }, "createdAt", "updatedAt", ... } } }`; today it holds the four 2026-11-16 records. [VERIFIED: ledger.py:57-58] `RETENTION_DONE_S = 604800.0` (7 days): a write prunes `done` records older than 7 days, which is why the 2026-11-03 records are gone. Copy the phase's records (key, state, `result.kind`, `createdAt`, `updatedAt`) into `09-LIVE-EVIDENCE.md` as soon as the run ends. Plain read only, never edit or delete.
- **Event-2 per-key accounting.** Six STACK transfers (`-in1`, `-in2`, `-x1`, `-out1`, `-out2`, `-x2`) mean six new ledger records and six new `Running command Transfer` lines in `STACK2-6.log`; event 1 means four ledger records (no `-x1`/`-x2`), four `Transfer` lines plus the `GetTransferEstimate` read line, and one F.A.S.T. `Transfer`. Real-mode `get_transfer_estimate` sends one estimation POST to the manager and bypasses the BUSY gate (a READ command, `tools/stack/server.py` comment above `READ_COMMANDS`); it writes no ledger record.
- **Provenance of the SHAs to record:** galago-core `git rev-parse HEAD` plus `git status --porcelain` at the build (see Pitfall on the untracked `.dockerignore`), the new image ID, the anchor ID, galago-tools `d53da53` (re-verify), `auto-mint: on (not exercised)`.

### Anti-Patterns to Avoid
- **Reusing a literal or fixed step key** (visual protocol) in a lanes run: a re-run is refused by the STACK ledger (rows 3a-6); mint per run (D-06).
- **Letting the sticky lane leak:** forgetting `galago.lane()` before the STACK overlap step silently serialises the overlap.
- **Driving the queue from Claude:** Start, Freeze lanes and recovery are operator-only (D-18); Claude only reads.
- **Hot-fixing a defect found live:** stop and return to the user (domain note).
- **Whole-file string replace for a mutation control** (see Finding 2 caveat).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overlap proof timing | A new timing probe or wrapper around the queue | The existing row `startedAt`/`completedAt` plus tool logs and the ledger (D-05) | Already stamped by `setRunStatusWithTimestamp`; adding probes changes the thing under test |
| Lane layout validation | A hand-checked row order | `executeProtocolScript` + `validateLanes` (exported from `server/laneScheduling.ts`) in an offline test, plus the Preview in the UI | Same code the run-creation path uses |
| Source scans | A new regex scanner | `stripComments` and `extractBracedRegion` already in `staticScan.test.ts` | Handles comments and brace-matching; add the new `it` there |
| Fake tools | New gRPC fakes | `test/helpers/laneHarness.ts` (`createLaneHarness`, `calls()`, `finish`, `fail`, `tick`) | Spies `Tool.executeCommand`; no endpoint can be contacted |
| Sim instruments | A mock STACK/F.A.S.T. | The real tool servers in simulated mode on 40091/40092 | Exercises the real argument validation and sleep durations |
| Recovery | Any automated ack/retry | The operator's D-11 procedure | PROJECT.md Out of Scope: no code path recovers on its own |

**Key insight:** this phase proves existing behaviour; any new mechanism is a risk to the thing being proven.

## Common Pitfalls

### Pitfall 1: The sticky lane silently serialises the overlap step
**What goes wrong:** The overlap STACK step is emitted after `galago.lane("fast")` without a reset, so it lands on lane `fast`, waits for FAST (same-lane order) and nothing overlaps.
**Why it happens:** `lane()` is sticky (`protocol-script-executor.ts:24-28`); validation allows two tools on one lane.
**How to avoid:** call `galago.lane()` before the first STACK step after the FAST step; assert in the offline test that every STACK row has no `lane` key and the FAST row has `lane: "fast"` and `laneBarrier: true`; check the UI Preview grouping.
**Warning signs:** Preview shows the overlap step under "Lane fast"; the overlap row's `startedAt` is after FAST's `completedAt`.

### Pitfall 2: A drill failure that lands before the other lane has started
**What goes wrong:** An invalid-argument refusal on the first primary step fails in milliseconds, before the `fast` worker (polling every 1500 ms) has claimed FAST, so the "other lane's running row ends COMPLETED" claim is never shown.
**How to avoid:** inject mid-overlap (second primary step, or stopping the sim server while steps sleep), as in Finding 4.
**Warning signs:** the drill's other-lane row is CREATED, not COMPLETED, after the halt.

### Pitfall 3: Overwriting the failed attempt's evidence
**What goes wrong:** An operator Start re-enters STARTED and overwrites `startedAt` (`SqliteQueue.ts:739-741`); the drill's per-lane timestamps for the failed attempt disappear.
**How to avoid:** snapshot `getAll` and `laneStatus` JSON after each halt and before each Start, and save them (or their key fields) in `09-LIVE-EVIDENCE.md`.

### Pitfall 4: Killing the wrong tool server
**What goes wrong:** `pkill -f tools.fast.server` also hits the real F.A.S.T. server on `:40001`, and a restart truncates its log and changes listener PIDs (a runbook D-14 breach).
**How to avoid:** resolve the PID from `ss -ltnp 'sport = :40092'` and kill that PID only; re-baseline listener PIDs after the drill and compare to the pre-drill baseline (`:40012`, `:40001`, `:11010`, `:8081`).

### Pitfall 5: The workcell switch breaks the pre-flight
**What goes wrong:** Pre-flight check 6 (`/api/tools`) is workcell-scoped and blocks while `uat-sim` is selected.
**How to avoid:** switch back to the real workcell after the drill and re-run both pre-flight forms before event 1's GO; confirm the store still holds `STACK2-6` + `FA100056`.

### Pitfall 6: A latch or stale run left by the drill blocks the live run
**What goes wrong:** `_laneHalt` persists in the process; the enqueue auto-start then refuses (`command_queue.ts:1229-1237`), or a RUNNING run fails pre-flight check 7.
**How to avoid:** end each drill scenario with the operator Start finishing the run, then verify `laneStatus.halted=false`, empty queue, no RUNNING run before leaving `uat-sim`.

### Pitfall 7: The lanes flag silently resets on the next rebuild
**What goes wrong:** D-13's command passes `GALAGO_PARALLEL_LANES=1` only as a shell variable on that invocation. [VERIFIED: docker-compose.yml: `- GALAGO_PARALLEL_LANES=${GALAGO_PARALLEL_LANES:-}`] A later `docker compose up` without it recreates the container with lanes off, and the flag is read only in the constructor (`staticScan.test.ts:1345-1351`).
**How to avoid:** record in the evidence that the flag lives only in the invocation; ask the user whether to persist it (a root `.env` with `GALAGO_PARALLEL_LANES=1` and `TOOLBOX_PORT=11010` is the standard compose mechanism) so the "stays on" decision survives. [ASSUMED: that a `.env` is acceptable; open question 3]

### Pitfall 8: An untracked build input and a dirty tree under a "from HEAD" deploy
**What goes wrong:** `git status` shows ` M .planning/config.json` and untracked `.dockerignore`. `docker compose up --build` builds from the working tree, so the image is not exactly HEAD, and without `.dockerignore` the Dockerfile's `COPY controller/ ./` would copy the host `controller/node_modules` over the Alpine-built modules (the file's own comment says so).
**How to avoid:** commit (or the user explicitly accepts) `.dockerignore` before the build, commit the new tests first, record `git rev-parse HEAD` and a clean `git status --porcelain` for `controller/` in the evidence, and run `npx tsc --noEmit` before the build (the production build type-checks).

### Pitfall 9: The runbook's own test caps the GO phrase
**What goes wrong:** A new section or row containing `Reply: literal go` breaks `test_runbook_carries_one_go_gate_per_part` (exactly 3 occurrences, one per Part).
**How to avoid:** Finding 5 wording rules; run `TestRunbookContent` after each runbook edit.

### Pitfall 10: Committing someone else's galago-tools changes
**What goes wrong:** `git add -A` in `~/data/nikko/galago-tools` stages the pre-existing deletions of `.planning/phases/04-*`.
**How to avoid:** stage and commit only `docs/runbooks/gal-07-live-handoff.md` by explicit path.

### Pitfall 11: Evidence lost to retention or log truncation
**What goes wrong:** Ledger `done` records older than 7 days are pruned on write; a tool-server restart truncates its log in place.
**How to avoid:** copy ledger records and the relevant log line ranges into `09-LIVE-EVIDENCE.md` immediately after each event; never restart a tool server.

## Code Examples

### Offline proof of the live script's lane layout (recommended Wave 0 test)
```ts
// Source: test/laneScript.test.ts (pattern) + server/laneScheduling.ts validateLanes (API)
import { executeProtocolScript } from "@/server/scripting/protocol-script-executor";
import { validateLanes } from "@/server/laneScheduling";

const result = await executeProtocolScript(LIVE_SCRIPT_TEXT, SAMPLE_PARAMS);
expect(result.success).toBe(true);
const infos = result.commands.map((c) => ({ ...c, toolType: c.toolId === "Tool Box" ? "toolbox" : "stack" }));
expect(validateLanes(infos as any)).toEqual([]);
// every STACK transfer key distinct; no step_key reused across two runs of the script
const keys = result.commands.filter((c) => c.command === "transfer" && c.toolId === STACK).map((c) => (c.params as any).step_key);
expect(new Set(keys).size).toBe(keys.length);
```
Note: `executeProtocolScript` leaves `toolType: "unknown"` (resolved later from the workcell), so the test must supply `toolType` the way `laneScript.test.ts` does for `validateLanes` (that file mocks `resolveToolTypes`). The planner should mirror that file's setup rather than the sketch above.

### Pre-run baseline (operator or Claude while idle; reads only)
```bash
D=$(ls -t ~/.local/share/galago/trace_logs | head -1)
grep -c "Running command Transfer" ~/.local/share/galago/trace_logs/$D/STACK2-6.log
grep -c "Running command Transfer" ~/.local/share/galago/trace_logs/$D/FA100056.log
python3 -I -c "import json;d=json.load(open('$HOME/.local/state/galago-tools/stack/stack-ledger.json'));print({k:(v['state'],v['result']['kind']) for k,v in d['records'].items()})"
ss -ltnp | grep -E ':(8081|40001|40012|11010)\b'
git -C ~/data/nikko/galago-tools rev-parse HEAD
```

### Resolve a sim server PID safely (drill only)
```bash
ss -ltnp 'sport = :40092'   # read the pid for the sim F.A.S.T. only; never pkill by name
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One global running-step slot | Per-lane dispatch with a halt latch | Phase 8 (2026-11-17) | The thing being proven live |
| Visual protocol with fixed step keys | Script protocol minting per-run keys | Rows 3a-6/3a-2 | Re-runs never reuse a key |
| Blank step key refused | Adapter auto-mints (`0604348`) | Row 3a-7 | Stays on; never exercised here |

**Deprecated/outdated:**
- The lanes todo's "STACK goto-safe" overlap step: no such command exists in the frozen proto (D-01).
- `docs/script-protocols.md` does not describe `galago.lane` or `{ barrier }`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The sim servers can be launched by hand as `.venv/bin/python3 -m tools.stack.server --port=40091` and `-m tools.fast.server --port=40092` (derived from the real servers' `ps` command lines; the Phase 8 launch method is unrecorded) | Finding 4 | The drill setup step needs a different launch method; a wrong launch could touch a real port |
| A2 | A `uat-sim` workcell with `SIM-STACK`/`SIM-FAST` tools does not yet exist in the production store (the dev DB copy has only workcell `test`; production not inspectable) | Finding 4 | Plan must create it (operator, via UI) and later select the real workcell again |
| A3 | Transient sim failures (stop, restart, re-Configure simulated) are the right way to let "Start finishes the run" hold | Finding 4 | Drill scenarios 1/2 may need a different injection |
| A4 | Placeholder host on sim tool entries is an acceptable precaution | Finding 4 | None beyond effort; the user may prefer the Phase 8 convention |
| A5 | `orange-nest/deck1/A1` and `rack/l1/A1` may be real but are unconfirmed as free, calibrated spare nests | Finding 6 | If they exist and work, D-02 is satisfiable; if not, LIV-01 stops for the user |
| A6 | `skipped` is the right IN-01 disposition value for "accepted and pinned" | Finding 2 | The disposition file's legend may need `deferred` with a reason instead |
| A7 | Baseline reads such as `GetFailureLatch` are run by the operator, or by Claude only while idle | Finding 6, D-18 | Role split may need the user's confirmation |
| A8 | A root `.env` (`GALAGO_PARALLEL_LANES=1`, `TOOLBOX_PORT=11010`) is acceptable to persist the flag | Pitfall 7 | The user may prefer a documented manual command |
| A9 | The overlap-window start skew is bounded by about the 1500 ms loop delay | Finding 3 | The D-05 containment wording may need a tolerance clause |

## Open Questions

1. **Is there a free, calibrated spare nest pair (A, B) on the rig?**
   - What we know: only nest-1/nest-2 are documented STACK-side; the runbook names `orange-nest` and `rack` as "known hardware nests" but the 2026-11-03 device tree does not list them.
   - What's unclear: whether any pair is free, calibrated and reachable without touching nest-1/nest-2/the F.A.S.T. tray.
   - Recommendation: an operator read-only checkpoint (`ListDevices`, `GetLabwarePresence`, standalone `GetTransferEstimate`) before the deploy GO. If none, stop and return to the user (D-02); LIV-02 can still proceed.
2. **How were the Phase 8 sim servers started and configured?**
   - What we know: ports, names, and that stopping the sim F.A.S.T. gave `CANCELLED`.
   - What's unclear: the exact launch command and the sim tool configs.
   - Recommendation: document the chosen launch commands in the plan and `09-LIVE-EVIDENCE.md` so the drill is repeatable.
3. **Persist `GALAGO_PARALLEL_LANES=1` across future rebuilds?**
   - What we know: only the one-off command carries it; D-13 says the flag stays on.
   - Recommendation: ask the user to approve a root `.env` or a documented rebuild command.
4. **Commit the untracked `.dockerignore` before the deploy?**
   - What we know: it is needed to stop host `node_modules` overwriting the image's modules and is currently untracked.
   - Recommendation: user decision; record its status in the build evidence either way.
5. **What exact tolerance defines "inside" for D-05?**
   - What we know: a ~1.5 s start skew is possible.
   - Recommendation: define it in the plan as: overlap step `startedAt` within one loop delay of FAST `startedAt` or later, and its `completedAt` before FAST's `completedAt`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node / npx / vitest | D-09, D-15 tests | yes | vitest 2.1.9 | none needed |
| galago-tools `.venv` Python | runbook test, sim launch | yes | in `~/data/nikko/galago-tools/.venv` | none needed |
| Real STACK `:40012`, F.A.S.T. `:40001`, Tool Box `:11010`, manager UI `:8081` | live events | listening | processes up since 2026-11-14 / 2026-11-16 | none (live gate) |
| galago-web `:3010` | all web steps | listening | host `ss` shows `:3010` (container itself not inspected) | none |
| Sim STACK `:40091`, sim F.A.S.T. `:40092` | drill | **no** (nothing listens) | — | start by hand (A1) |
| `uat-sim` workcell + sim tools in production | drill | unknown (A2) | — | operator creates via UI |
| docker / compose | deploy (D-13) | not probed (research must not touch docker) | — | none; blocks deploy |
| Spare STACK nest pair | event 2 | **unknown, likely absent** | — | none: stop and return to user |

**Missing dependencies with no fallback:** a confirmed spare nest pair (blocks event 2 / LIV-01 only).
**Missing dependencies with fallback:** sim servers (start them), `uat-sim` workcell (create it).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9, `environment: "node"`, include `test/**/*.test.ts`, setup `test/setup.ts` [VERIFIED: vitest.config.mts] |
| Config file | `controller/vitest.config.mts` |
| Quick run command | `cd controller && npx vitest run test/laneOneSend.test.ts test/staticScan.test.ts test/lanes.test.ts test/laneHalt.test.ts` |
| Full suite command | `cd controller && npx vitest run && npx tsc --noEmit && npx prettier --config .prettierrc --check <touched files>` |
| Baseline | `lanes` 12, `laneHalt` 32, `queueRestart` 2, `staticScan`+`sqliteQueueClaim` all green: 155 tests passed in 7.1 s (this session) |

### Phase Requirements to Test Map
| ID | Req | Behavior | Test Type | Automated Command | File Exists? |
|----|-----|----------|-----------|-------------------|-------------|
| V-01 | LIV-01 / D-09 | Every queueId sent exactly once across overlap, run N+1; a failed row sent once more per accepted operator Start; nothing sent while halted; enqueue auto-start refused while halted | unit (fakes) | `npx vitest run test/laneOneSend.test.ts` | Wave 0 (new) |
| V-02 | D-15 / IN-01 | No async boundary from the state check through the claim; helpers synchronous; side-lane window has only `_shouldSkip`; pin proven able to fail | static | `npx vitest run test/staticScan.test.ts -t "dispatch span"` | Wave 0 (add) |
| V-03 | LIV-01 / D-06 | Live script lane layout: STACK rows primary, FAST lane `fast` + barrier, out1 barrier, distinct explicit keys, `validateLanes` empty; sim-drill script likewise | unit (offline executor) | `npx vitest run test/liveLanesProtocol.test.ts` | Wave 0 (new, name is planner's) |
| V-04 | LIV-01 | Pre-flight `PREFLIGHT OK` (both forms) before each GO | manual-only (live host) | `bash docs/runbooks/gal-07-live-check.sh` and `GAL07_REQUIRE_STACK_ENV=1 bash ...` | n/a |
| V-05 | LIV-01 | Deploy: anchor equals running image before build, new image differs, `/api/health` ok, store holds STACK2-6 + FA100056, `laneMode` true | manual-only (docker, typed GO) | runbook 1a-6 steps; `curl -s localhost:3010/api/health`; `commandQueue.laneStatus` | n/a |
| V-06 | LIV-01 | Overlap window: overlap row inside FAST row on run cards; raw ms timestamps recorded | manual-only (live, operator Start) | read `commandQueue.getAll` JSON after the run | n/a |
| V-07 | LIV-01 | Both tool logs show attempts in the same window; baseline-to-after line counts | manual-only | `grep -c "Running command Transfer" ...` before and after | n/a |
| V-08 | LIV-01 | Event 2: one `done`/`ran` ledger record per explicit key (six), keys distinct | manual-only | ledger JSON read (Code Examples) | n/a |
| V-09 | LIV-02 | Drill scenarios 1-3: other-lane row COMPLETED, later rows CREATED, `halted=true`, only operator Start re-arms and finishes | manual-only (prod web, sim workcell, operator) | `commandQueue.laneStatus` and `getAll` snapshots before each Start | n/a |
| V-10 | LIV-02 | No real tool received a command during the drill: listener PIDs unchanged, STACK2-6.log and FA100056.log attempt counts unchanged, ledger unchanged | manual-only | baseline vs after (Code Examples) | n/a |
| V-11 | LIV-02 | Drill leaves no latch/run: `halted=false`, empty queue, pre-flight check 7 passes after switching back | manual-only | `laneStatus`, pre-flight | n/a |
| V-12 | LIV-03 | PROJECT.md updated (Active item to Validated with pointer; single-flight wording for lanes) | docs | `grep -n "proven live" .planning/PROJECT.md` review | n/a |
| V-13 | LIV-03 | Lanes todo resolution note added and file moved to `.planning/todos/completed/` | docs | `ls .planning/todos/completed` | n/a |
| V-14 | LIV-03 | Runbook parallel variant added only after LIV-01 passes; structure test still green; rows 3a-11.. present | docs + python unit | `cd ~/data/nikko/galago-tools && .venv/bin/python -m unittest tools.tests.gal07_live_runbook_test.TestRunbookContent` | exists |

### Sampling Rate
- **Per task commit:** the task's test file(s) + `cd controller && npx tsc --noEmit`
- **Per wave merge:** `cd controller && npx vitest run && npx tsc --noEmit`
- **Before any GO gate (D-09 gate):** full suite green; `laneOneSend.test.ts` and the dispatch-span pin green; prettier clean on touched files; optional 20x loop of the engine suites as in Phase 8: `for i in $(seq 20); do npx vitest run test/lanes.test.ts test/laneHalt.test.ts test/laneOneSend.test.ts || break; done`
- **Phase gate:** full suite green, `09-LIVE-EVIDENCE.md` complete for LIV-01 and LIV-02, runbook test green, then `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `controller/test/laneOneSend.test.ts` — V-01 (draft above, verified)
- [ ] `controller/test/staticScan.test.ts` — V-02 additions (draft above, verified)
- [ ] `controller/test/liveLanesProtocol.test.ts` (name at planner's discretion) — V-03
- [ ] Live-lanes protocol JSON and sim-drill protocol JSON (location at planner's discretion; the sim-drill script must keep every tool on one lane and emit `timeout_s: -1` only where an invalid-argument failure is wanted)
- Framework install: none

## Security Domain

`security_enforcement` is enabled (absent = enabled; `.planning/config.json` has `"security_enforcement": true`, ASVS level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change; STACK credentials stay in the operator's 0600 env file and are never written to evidence (runbook test `test_runbook_holds_no_credential_values`) |
| V3 Session Management | no | — |
| V4 Access Control | yes | Start, Freeze lanes and recovery are operator-only; Claude holds no control path (D-18); no `acknowledge_failure` from code (`staticScan.test.ts` OPR-05 pins) |
| V5 Input Validation | yes | Script params validated in the script before the first `galago.command`; `validateLanes` at run creation; sim-drill invalid-argument values are deliberate and confined to the sim workcell |
| V6 Cryptography | no | — |
| V7 Logging | yes | Evidence and runbook rows hold no credentials, tokens or private data; `sanitizeLogText` on audit lines (existing) |
| V14 Configuration | yes | `GALAGO_PARALLEL_LANES` read once in the constructor; persistence of the flag is an explicit decision (Pitfall 7) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A drill step addressed to a real tool (wrong workcell, wrong port, mis-click non-simulated Configure) | Tampering / safety | Isolated `uat-sim` workcell, placeholder sim host (A4), listener-PID and log-count baselines before and after the drill (V-10) |
| Killing the real tool server instead of the sim one | Denial of service / safety | Resolve the PID from the port (`ss -ltnp 'sport = :40092'`), never by process name |
| Re-sending a completed STACK step or reusing a key | Tampering | Per-run distinct explicit keys (D-06), D-09 test, the STACK ledger's one-shot rule (replay window 600 s) |
| Motion during a failure the operator has not inspected | Safety | Lane halt (both lanes freeze), D-11 recovery, no automated Start |
| Credential leakage into evidence or the runbook | Information disclosure | Presence-only checks, runbook credential test, never paste env values |
| Evidence tampering or loss (ledger prune, log truncation) | Repudiation | Copy ledger records and log ranges at event end; never delete or restart (Pitfall 11) |
| Committing unrelated galago-tools changes | Integrity | Explicit-path commit (Pitfall 10) |

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` or `./.claude/CLAUDE.md` exists in this repo, and neither `.claude/skills/` nor `.agents/skills/` exists (`.claude/` holds only `worktrees`). The binding project directives come from `.planning/PROJECT.md` "Out of Scope" and the CONTEXT.md decisions: no software-initiated pause/resume/abort; no code path acknowledges, cancels, retries or parks the STACK on its own; no STACK or F.A.S.T. motion from tests; no `stack.proto` change; no re-pin of `vendor/galago-tools`; no upstream PRs; tests use fakes only; all recovery is an operator decision; commit-message attribution line per the session reminder.

## Sources

### Primary (HIGH confidence, read this session)
- `/home/formulatrix/data/nikko/galago-core/.planning/phases/09-supervised-live-two-tool-proof/09-CONTEXT.md` (decisions)
- `controller/server/command_queue.ts` (`_pickNext` 1391-1407, `_dispatchGate` 1425-1437, `_runSideLane` 1441-1560, `_startLanes` 1225-1295, `freezeLanes` 1304-1335, loop delay line 180)
- `controller/server/laneScheduling.ts` (`LaneStatusSnapshot` 65-74, `isEligible` 129-172, `pickEligible` 174-187, `validateLanes` 270-345)
- `controller/server/utils/SqliteQueue.ts` (`claimEligible` 155, `queuedRowsSync` 425, `_updateItem` 731-754), `controller/server/utils/HasRunStatus.ts`
- `controller/server/scripting/protocol-script-executor.ts`, `controller/test/{lanes,laneHalt,queueRestart,sqliteQueueClaim,laneScript,staticScan}.test.ts`, `controller/test/helpers/{laneHarness,fakeTool}.ts`, `controller/vitest.config.mts`
- `.planning/phases/08-concurrency-lanes/{08-UAT,08-REVIEW,08-REVIEW-DISPOSITION,08-VALIDATION,08-VERIFICATION}.md`, `.planning/{PROJECT,REQUIREMENTS,STATE}.md`, `.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md`
- `/home/formulatrix/data/nikko/galago-tools/docs/runbooks/gal-07-live-handoff.md`, `gal-07-live-check.sh`, `tools/tests/gal07_live_runbook_test.py`, `tools/stack/{server,ledger}.py`, `tools/fast/server.py`, `tools/base_server.py`, `vendor/.../stack.proto`
- Host facts: `ps`, `ss -ltn`, git log/status in both repos, directory listing and read of the local ledger and trace logs (read-only)

### Secondary (MEDIUM confidence)
- `docker-compose.yml`, `docker-compose.dev.yml`, `controller/Dockerfile`, `.dockerignore` (read, not executed)

### Tertiary (LOW confidence)
- None used as authoritative. Items resting on absence of recorded evidence (sim launch method, `uat-sim` existence, spare nests) are marked `[ASSUMED]` above.

External web research was not needed: no external library or API is involved. The tool-strategy seam (`research-plan`, `research-store`) was not used for the same reason.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new; versions read from a live run.
- Architecture / dispatch path / pins: HIGH, source read and the drafts run green (and were proven able to fail).
- Runbook facts and test constraints: HIGH, files read and the structure test run.
- Sim rig procedure: MEDIUM, mechanics verified from tool-server source, launch method and `uat-sim` state unverified.
- Spare-nest availability: LOW as a positive claim (no evidence either way beyond nest-1/nest-2); HIGH that the repo cannot confirm a spare pair.
- Pitfalls: HIGH for those derived from read code; MEDIUM for physical/procedural ones.

**Research date:** 2026-11-17
**Valid until:** 2026-11-24 for host-state facts (listeners, ledger contents, log counts, git HEADs change with any restart or commit); 30 days for the code-structure findings.
