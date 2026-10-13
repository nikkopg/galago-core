---
phase: 01-queue-control-path-run-state
verified: 2026-10-13T10:15:00Z
status: human_needed
score: 4/4 roadmap success criteria verified; 34/34 plan-level must-have truths verified
covered_files: [".planning/phases/01-queue-control-path-run-state/01-01-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-01-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-02-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-02-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-03-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-03-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-04-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-04-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-05-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-05-SUMMARY.md", "controller/gen-interfaces/tools/grpc_interfaces/fast.ts", "controller/gen-interfaces/tools/grpc_interfaces/tool_base.ts", "controller/package-lock.json", "controller/package.json", "controller/server/command_queue.ts", "controller/server/routers/command_queue.ts", "controller/server/runControl.ts", "controller/server/runState.ts", "controller/server/tools.ts", "controller/test/helpers/fakeTool.ts", "controller/test/infra.test.ts", "controller/test/runControl.test.ts", "controller/test/runState.test.ts", "controller/test/setup.ts", "controller/test/toolControl.test.ts", "controller/test/tools.test.ts", "controller/test/wire.test.ts", "controller/vitest.config.mts"]
covered_digest: "v3:sha256:26f09f3d612a0fd5a8760b9acad85af7cc53b91df33458bc52b9745b09522949"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Decide whether WR-01 (toolControl does not re-check `this._runningStep === step` immediately before sending the gRPC control command) must be fixed before Phase 2 ships, or is an accepted residual risk"
    expected: "A deliberate decision recorded (fix now / defer to Phase 2 / accept risk), because today a Pause/Resume/Abort validated against one step can be delivered to, or logged against, whatever step the busy loop has already moved on to by the time the gRPC round trip completes — the common case is the same physical tool running the next step back to back"
    why_human: "This is a genuine, reproducible race condition (confirmed in command_queue.ts:429-495 — no identity re-check exists before `await tool.controlCommand(...)`) that no current test exercises (every toolControl.test.ts case keeps the step pending for the whole call); it is a product/safety risk-acceptance call on the operator-control path, not a mechanically resolvable gap, and QUE-01/QUE-02's stated must-haves do not require this re-check so it cannot be scored as FAILED against the plan's own literal truths"
  - test: "Decide whether WR-02 (RunStateMonitor's `finally { this.inFlight = false; }` is unconditional, so a late-resolving poll from a stopped/superseded generation can clear the in-flight flag for the current generation and let two getStatus calls run concurrently) needs a fix before Phase 2's 2 s polling increases call frequency"
    expected: "A deliberate decision recorded; the one-line fix (`if (generation === this.generation) { this.inFlight = false; }`) is already proposed in 01-REVIEW.md"
    why_human: "Confirmed still present in runState.ts (`finally { this.inFlight = false; }` with no generation guard); impact is UI/telemetry staleness, not a safety issue (D-14's never-commands invariant still holds), and no must-have truth requires generation-guarded in-flight clearing, so it is advisory rather than a scoreable FAIL"
  - test: "Confirm the judgment-tier prohibition 'galago-core performs no instrument-state check' (plan 01-02, D-04) by independent code review, since it is a negative/absence claim that only a human reviewer can fully attest to"
    expected: "toolControl's decision path reads only `this._runningStep` and `runControl`/`validateControlRequest` before sending; no `Tool.status`, run state, or tool reply field gates the send"
    why_human: "The plan itself marks this prohibition `verification: judgment` rather than `test`; my code inspection of the full `toolControl` method body (reproduced below) found no such read, which agrees with the plan's own D8 coverage note, but per the judgment-tier routing rule this is a non-authoritative LLM read, not a substitute for the human sign-off the plan calls for"
---

# Phase 1: Queue Control Path & Run State Verification Report

**Phase Goal:** The server side can send an operator's Pause/Resume/Abort to the running step's tool
and report that tool's live run state, without touching the queue's busy loop.
**Verified:** 2026-10-13T10:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (authoritative contract)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---------|--------|----------|
| 1 | `toolControl` reaches the running step's tool while its `executeCommand` is still pending, and the busy loop's promise is unaffected; refuses with no running step, a tool without `runControl`, or a blank decision | ✓ VERIFIED | Ran `npm --prefix controller run test:unit` myself (not trusting SUMMARY): `toolControl.test.ts` 11/11 pass, including "reaches the tool while the step is still pending" (asserts `{fast:{pause:{}}}` sent via the fake gRPC, step stays pending, queue stays BUSY), "refuses with no running step", "refuses during a Tool Box pause built-in", "refuses a running tool without runControl", "refuses a blank decision". Code inspection of the busy-loop bracket (`command_queue.ts`) confirms `_runningStep`/`_runStateMonitor.start/stop` are the only additions around the pre-existing `await this.executeCommand(nextCommand)` — no other busy-loop line changed |
| 2 | `runState` returns the running tool's `run_state` and is independent of `modalState` | ✓ VERIFIED | `runState.test.ts` 34/34 pass, including "runState > reports the running tool's paused run_state" and the 3 "runState independence" tests ("a paused run_state does not touch modalState", "a Tool Box pause modal does not touch runState", "N readers, one poll"). `grep -oE 'grpc\.[a-zA-Z]+' controller/server/runState.ts \| sort -u` → exactly `grpc.getStatus` |
| 3 | A failed status poll shows "run state unknown" and the heartbeat keeps retrying | ✓ VERIFIED | `tools.test.ts` 6/6 pass (both `ToolType.fast` and `ToolType.pf400`, "heartbeat keeps polling after a failure and recovers"); `fetchStatus`'s catch branch (read directly, reproduced below) no longer calls `stopHeartbeat()`. `runState.test.ts`'s "RunStateMonitor > shows unknown on a failed poll and keeps the last good runState" and "...on a malformed payload..." / "...when the tool is not connected" all pass |
| 4 | Generated interfaces include `run_state` and `Pause` (ts-proto 1.151.1), and `tsc` reports 0 errors | ✓ VERIFIED | `awk '/^export interface StatusReply \{/,/^\}/' tool_base.ts \| grep -c run_state` → 1; `grep -c 'export interface Command_Pause' fast.ts` → 1; `wire.test.ts` 2/2 pass proving Pause/Resume/Abort and `run_state` round-trip through the **real** generated protobuf encoders (not just the fake-gRPC payload-object level); `git -C vendor/galago-tools rev-parse HEAD` → `cb7886d1f3bdcdeeee71c55996f0dd62cf49ba7f`; `git status --porcelain -- controller/gen-interfaces` → empty (idempotent regeneration, proves no hand-edit); `npm --prefix controller test` (tsc --noEmit) exits 0 with no output |

**Score:** 4/4 roadmap success criteria verified.

### Plan-Level Must-Have Truths (merged detail, Step 2c)

All plan-frontmatter `must_haves.truths` restate or refine the 4 roadmap SCs above. I independently ran the full suite (`90/90 passed`, 6 files, 29.7s) and `tsc --noEmit` (0 errors) myself, then spot-checked the riskiest/most specific claims directly against source:

| Plan | Truths (count) | Status | Representative evidence I checked directly |
|------|------|--------|------|
| 01-01 (test infra) | 4 | ✓ VERIFIED | `test:unit`/`test` both exit 0; `controller/data/app.db` untouched; `installFakeTool`/`removeFakeTool`/`deferred` exported from `fakeTool.ts`; `package.json` devDependencies pinned exact (`vitest` no `^`/`~`) |
| 01-02 (toolControl/runControl) | 10 | ✓ VERIFIED | Read `runControl.ts` in full — frozen map `fast:{pause:{},resume:{is_tip_broken:"yesno"},abort:{return_liquid:"yesno"}}`, own-property-safe lookups, fixed refusal order (a)-(e) exactly as specified. Read `toolControl`'s full method body in `command_queue.ts` — validates via `_runningStep`/`validateControlRequest` only (no run-state/Tool.status read), logs exactly once per outcome, non-SUCCESS returned not thrown, transport error thrown once with no retry. `commandFields.fast` has no `pause` key (`grep -n "pause" controller/components/tools/constants.ts` shows only the unrelated Tool-Box `pause` built-in and a comment) |
| 01-03 (runState/poller) | 7 | ✓ VERIFIED | Read `runState.ts` in full — `extractRunState` never throws (try/catch), generation counter discards stale results, in-flight guard present (see WR-02 caveat below), `_runStateMonitor.start/stop` wired into exactly the tool-step bracket (`grep -cE '_runStateMonitor\.(start\|stop)\(' command_queue.ts` → 2, both inside the bracket) |
| 01-04 (heartbeat retry) | 5 | ✓ VERIFIED | Read `fetchStatus` in full — no `stopHeartbeat()` call in the catch branch; `consecutiveStatusFailures`/`statusUnknownSince` getters present; de-duplicated `"Tool Status Unknown"`/`"Tool Status Recovered"` logAction calls (1 occurrence each in source); `grep -c command_queue controller/server/tools.ts` → 0 |
| 01-05 (QUE-06 proto) | 8 | ✓ VERIFIED | Submodule pinned to the human-approved SHA; regeneration idempotent (empty `git status --porcelain -- controller/gen-interfaces`); `extractRunState` reads `statusReply.run_state` directly — `grep -c 'run_state?: unknown' controller/server/runState.ts` → 0 (no leftover cast) |

**Combined score:** 34/34 plan-level truths verified (no FAILED, no PRESENT_BEHAVIOR_UNVERIFIED).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/server/runControl.ts` | Frozen, import-free capability map + validation | ✓ VERIFIED | Exists, 0 imports (`grep -cE '^\s*import ' ` → 0), exports match plan exactly |
| `controller/server/runState.ts` | `extractRunState` + `RunStateMonitor` | ✓ VERIFIED | Exists, typed `statusReply.run_state` read, only `grpc.getStatus` called |
| `controller/server/tools.ts` (modified) | `Tool.lookup`, `Tool.controlCommand`, heartbeat fix, failure-streak getters | ✓ VERIFIED | All present and wired (see grep evidence above) |
| `controller/server/command_queue.ts` (modified) | `RunningStep`, `runningStep` getter, `toolControl`, poller lifecycle | ✓ VERIFIED | All present; busy-loop bracket diff is minimal and additive |
| `controller/server/routers/command_queue.ts` (modified) | `toolControl` mutation, `runState` query | ✓ VERIFIED | Both present (`grep -c` → 1 each) |
| `controller/test/{toolControl,runControl,runState,tools,wire,infra}.test.ts` | Test suites proving every must-have | ✓ VERIFIED | 6 files, 90 tests, all pass when I ran them |
| `controller/gen-interfaces/tools/grpc_interfaces/{tool_base,fast}.ts` (regenerated) | `run_state`, `Command_Pause` | ✓ VERIFIED | Confirmed via awk/grep; idempotent regeneration proven |
| `vendor/galago-tools` (submodule pin) | Human-approved commit | ✓ VERIFIED | `cb7886d1f3bdcdeeee71c55996f0dd62cf49ba7f`, approved via the Task 1 blocking-human checkpoint in 01-05-PLAN.md |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `routers/command_queue.ts` | `command_queue.ts` | `toolControl` mutation → `CommandQueue.global.toolControl` | ✓ WIRED | `toolControl: procedure.input(...).mutation(...)` calls the method; test exercises it through `createCaller` |
| `command_queue.ts` | `runControl.ts` | `validateControlRequest(step?.toolType, action, params)` | ✓ WIRED | Called at the top of `toolControl` |
| `command_queue.ts` | `tools.ts` | `Tool.lookup(step.toolId)` then `tool.controlCommand(...)` | ✓ WIRED | Confirmed, single call site besides the definition |
| busy loop | `CommandQueue._runningStep` | set before / cleared in `finally` around the single tool-step dispatch | ✓ WIRED | `grep -c '_runningStep = '` → 2, both inside the "Regular command, send to Tool" → "Command Executed" span |
| busy loop | `RunStateMonitor` | `_runStateMonitor.start(...)` / `.stop()` in the same bracket | ✓ WIRED | `grep -cE` → 2, both inside the bracket |
| `runState.ts` `RunStateMonitor` | `tools.ts` | `Tool.lookup(...).grpc.getStatus({})` only | ✓ WIRED | Confirmed by grep (`grpc.getStatus` is the only `grpc.*` method referenced in the file) and by the "never commands" test |
| `routers/command_queue.ts` | `command_queue.ts` | `runState` query → `CommandQueue.global.runState` | ✓ WIRED | Confirmed in source |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `commandQueue.toolControl` reply | `{ok, response, message}` | `tool.controlCommand` → real `grpc.executeCommand` (fake double in tests; real generated codec proven by `wire.test.ts`) | Yes | ✓ FLOWING |
| `commandQueue.runState` envelope | `RunStateEnvelope` | `RunStateMonitor.snapshot()` ← `tool.grpc.getStatus` → `extractRunState` | Yes | ✓ FLOWING |
| `Tool.status` / `consecutiveStatusFailures` | heartbeat state | `fetchStatus` ← `grpc.getStatus` | Yes | ✓ FLOWING |

No static/hardcoded fallbacks found on any of the three live-control/run-state paths.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite is genuinely green (not a stale SUMMARY claim) | `npm --prefix controller run test:unit` | `6 files, 90 tests, all passed, 29.69s` | ✓ PASS |
| Type gate is genuinely clean | `npm --prefix controller test` (tsc --noEmit) | exit 0, no "error TS" lines | ✓ PASS |
| `toolControl`/`runControl` targeted re-run | `npm --prefix controller run test:unit -- test/toolControl.test.ts test/runControl.test.ts` | `2 files, 42 tests, all passed` | ✓ PASS |
| Generated interfaces carry the new fields | `awk`/`grep` over `tool_base.ts`/`fast.ts` | `run_state` → 1, `Command_Pause` → 1 | ✓ PASS |
| Submodule pin and regeneration idempotency | `git -C vendor/galago-tools rev-parse HEAD`; `git status --porcelain -- controller/gen-interfaces` | matches approved SHA; empty | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files exist in this repository and neither PLAN nor SUMMARY declares any probe script for this phase.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| QUE-01 | 01-02, 01-05 | `toolControl` sends P/R/A straight to the running step's tool, logged | ✓ SATISFIED | `toolControl.test.ts` end-to-end test + `wire.test.ts` real-wire proof |
| QUE-02 | 01-01, 01-02 | Refuses with no step/no runControl/blank decision; `runningStep` accessor | ✓ SATISFIED | `toolControl.test.ts` refusal tests + `runningStep` getter |
| QUE-03 | 01-02 | `runControl` separate map; F.A.S.T. declares pause/resume/abort | ✓ SATISFIED | `runControl.test.ts` (31 tests: map shape, ordering, commandFields untouched) |
| QUE-04 | 01-01, 01-03, 01-05 | `runState` query returns tool `run_state`, independent of `modalState` | ✓ SATISFIED | `runState.test.ts` + `wire.test.ts` |
| QUE-05 | 01-01, 01-03, 01-04 | Failed poll → "run state unknown", heartbeat keeps retrying | ✓ SATISFIED | `tools.test.ts` + `runState.test.ts` failure-handling describes |
| QUE-06 | 01-05 | Generated interfaces include `run_state`/`Pause`; `tsc` 0 errors | ✓ SATISFIED | Submodule pin, regeneration, `wire.test.ts`, tsc clean |

No orphaned requirements: REQUIREMENTS.md's Phase 1 traceability table lists exactly QUE-01..06, all mapped and all claimed by at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in any phase file. No placeholder/stub return values, no hardcoded-empty props flowing to output. The following are **carried-forward findings from `01-REVIEW.md`** (code review ran 2026-10-13, disposition still `open` for all four as of this verification) — I independently re-read the flagged source and confirm each is still present exactly as described:

| File | Line(s) | Pattern | Severity | Impact |
|------|---------|---------|----------|--------|
| `controller/server/command_queue.ts` | 429-495 (`toolControl`) | No re-check of `this._runningStep === step` before `await tool.controlCommand(...)` | ⚠️ Warning (WR-01) | A control decision validated against one step can be delivered to / logged against a different step if the busy loop advances during the gRPC round trip (same-tool back-to-back steps are the common case). Not covered by any current test. Does not violate any stated must-have truth, but is a genuine safety-relevant race on the operator-control path |
| `controller/server/runState.ts` | 170-196 (`_poll`'s `finally`) | `this.inFlight = false` is unconditional, not generation-guarded | ⚠️ Warning (WR-02) | A late-resolving poll from a stopped/earlier generation can clear the in-flight flag for the *current* generation, letting two `getStatus` calls race; read-only (D-14 holds), impact is UI/telemetry staleness only |
| `controller/package.json` / `bin/make` / `.github/workflows/main.yml` | — | `npm run test:unit` is never invoked by `bin/make test_ts()` or CI | ⚠️ Warning (WR-03) | This phase's entire safety-relevant behavior is proven only by a script CI never runs; a future regression in `toolControl`/`RunStateMonitor`/heartbeat logic would pass CI silently |
| `controller/server/runState.ts` | 166-168 (`snapshot()`) | `return { ...this.envelope }` — shallow copy only | ℹ️ Info (IN-01) | Nested `runState.pause` is a shared reference; a future mutating consumer could corrupt the cache. Latent, not currently triggered |

None of WR-01/WR-02/WR-03/IN-01 fail a stated must-have truth (every explicit truth in the 5 plans is backed by a passing test and matches the roadmap's 4 success criteria). They are pre-existing, already-disclosed, `open`-disposition findings that affect a safety-relevant and a correctness-relevant invariant adjacent to, but not identical to, what was specified — routed to human verification below rather than scored as gaps, per the instruction to judge whether an open review finding undermines a must-have.

### Human Verification Required

See frontmatter `human_verification` for the full itemized list (3 items: WR-01 risk-acceptance decision, WR-02 risk-acceptance decision, and independent confirmation of the judgment-tier "no instrument-state check" prohibition). Summary:

1. **WR-01 — toolControl's step-identity race.** Decide fix-now / defer-to-Phase-2 / accept-risk.
2. **WR-02 — RunStateMonitor's unconditional in-flight clear.** Decide whether to apply the one-line fix already proposed in `01-REVIEW.md` before Phase 2.
3. **D-04 judgment-tier prohibition** ("galago-core performs no instrument-state check"). My code read agrees it holds, but the plan itself marks this `verification: judgment`, so a human sign-off is requested rather than treating my LLM-judge read as authoritative.

### Gaps Summary

No gaps. All 4 ROADMAP Phase 1 success criteria and all 34 plan-level must-have truths are independently verified against the actual codebase (not just SUMMARY claims) — I re-ran the full unit suite (90/90 pass) and the type gate (0 errors) myself, read every production file this phase touched in full, and spot-checked the specific greps each plan's acceptance criteria require. QUE-01 through QUE-06 are all satisfied with no orphaned requirements.

The phase is functionally complete. Routing to `human_needed` is solely because of three items that genuinely require a human decision rather than mechanical verification: two still-`open` code-review warnings (a real, untested race condition in `toolControl`'s step-identity handling, and a real, untested race condition in `RunStateMonitor`'s in-flight guard) and one judgment-tier prohibition the plan itself designates for human sign-off. None of these three block the roadmap's stated success criteria from being true today.

---

*Verified: 2026-10-13T10:15:00Z*
*Verifier: Claude (gsd-verifier)*
