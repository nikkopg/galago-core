---
phase: 01-queue-control-path-run-state
verified: 2026-10-13T15:10:00Z
status: passed
score: 4/4 roadmap success criteria verified; 37/37 plan-level must-have truths verified
covered_files: [".planning/phases/01-queue-control-path-run-state/01-01-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-01-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-02-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-02-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-03-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-03-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-04-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-04-SUMMARY.md", ".planning/phases/01-queue-control-path-run-state/01-05-PLAN.md", ".planning/phases/01-queue-control-path-run-state/01-05-SUMMARY.md", "bin/make", "controller/gen-interfaces/tools/grpc_interfaces/fast.ts", "controller/gen-interfaces/tools/grpc_interfaces/tool_base.ts", "controller/package-lock.json", "controller/package.json", "controller/server/command_queue.ts", "controller/server/routers/command_queue.ts", "controller/server/runControl.ts", "controller/server/runState.ts", "controller/server/tools.ts", "controller/test/helpers/fakeTool.ts", "controller/test/infra.test.ts", "controller/test/runControl.test.ts", "controller/test/runState.test.ts", "controller/test/setup.ts", "controller/test/toolControl.test.ts", "controller/test/tools.test.ts", "controller/test/wire.test.ts", "controller/vitest.config.mts"]
covered_digest: "v3:sha256:44d4466a86e2540c2aeab3ec53af5d94ccf2b221620023b555e72f5253c13d68"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "4/4 roadmap success criteria verified; 34/34 plan-level must-have truths verified"
  gaps_closed:
    - "WR-01: toolControl now re-checks `this._runningStep === step` immediately before dispatching the control command (commit 62e505c), closing the step-identity race window the prior verification flagged for human risk-acceptance; a human (via 01-UAT.md test 1) additionally accepted the residual window that remains during the gRPC round trip itself, per D-04 (core owns the state gate)"
    - "WR-02: RunStateMonitor's in-flight flag reset is now generation-guarded (commit 42fd1af), closing the stale-poll-clears-current-in-flight race the prior verification flagged for human risk-acceptance"
    - "WR-03: `npm run test:unit` is now wired into `bin/make test_ts()` (commit 003e500), so this phase's safety-relevant test suite runs in CI, not just ad hoc"
    - "D-04 judgment-tier prohibition ('galago-core performs no instrument-state check') received explicit human sign-off (01-UAT.md test 3), resolving the prior verification's request for independent human confirmation beyond the LLM-judge read"
  gaps_remaining: []
  regressions: []
---

# Phase 1: Queue Control Path & Run State Verification Report

**Phase Goal:** The server side can send an operator's Pause/Resume/Abort to the running step's tool
and report that tool's live run state, without touching the queue's busy loop.
**Verified:** 2026-10-13T15:10:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (review-fix commits + human UAT sign-off)

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (authoritative contract)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---------|--------|----------|
| 1 | `toolControl` reaches the running step's tool while its `executeCommand` is still pending, and the busy loop's promise is unaffected; refuses with no running step, a tool without `runControl`, or a blank decision | ✓ VERIFIED | Independently ran `npm --prefix controller run test:unit`: `toolControl.test.ts` 12/12 pass (up from 11 — now includes the WR-01 regression test "refuses when the running step moves on before dispatch"). Read `toolControl`'s full body in `command_queue.ts:424-500`: validation → tool-lookup → **new** `if (this._runningStep !== step)` identity re-check immediately before `await tool.controlCommand(...)` → send. Confirmed by direct code read, not SUMMARY narration |
| 2 | `runState` returns the running tool's `run_state` and is independent of `modalState` | ✓ VERIFIED | `runState.test.ts` 35/35 pass (up from 34 — now includes the WR-02 regression test). Read `_poll`'s `finally` in `runState.ts:191-200`: `if (generation === this.generation) { this.inFlight = false; }`, confirmed generation-guarded as claimed |
| 3 | A failed status poll shows "run state unknown" and the heartbeat keeps retrying | ✓ VERIFIED | `tools.test.ts` 6/6 pass (fast + pf400); `fetchStatus`'s catch branch still contains no `stopHeartbeat()` call |
| 4 | Generated interfaces include `run_state` and `Pause` (ts-proto 1.151.1), and `tsc` reports 0 errors | ✓ VERIFIED | `wire.test.ts` 2/2 pass; `npm --prefix controller test` (tsc --noEmit) exits 0 with no output, run directly by me just now |

**Score:** 4/4 roadmap success criteria verified.

I ran the full suite and the type gate myself in this verification session (not reused from SUMMARY or the prior VERIFICATION.md):

```
Test Files  6 passed (6)
     Tests  92 passed (92)
  Duration  32.70s
```
```
> npx tsc --noEmit
(exit 0, no output)
```

### Plan-Level Must-Have Truths (merged detail, Step 2c)

| Plan | Truths (count) | Status | Representative evidence I checked directly this session |
|------|------|--------|------|
| 01-01 (test infra) | 4 | ✓ VERIFIED | `test:unit`/`test` both exit 0; exact-pinned devDependencies unchanged |
| 01-02 (toolControl/runControl) | 10 | ✓ VERIFIED | `runControl.ts` unchanged (frozen map, own-property-safe lookups, fixed refusal order). `toolControl`'s body re-read in full: still validates via `_runningStep`/`validateControlRequest` only, logs exactly once per outcome, now additionally re-checks step identity before dispatch (closing WR-01). `git diff --exit-code -- controller/components/tools/constants.ts` exits 0 (D-10 untouched) |
| 01-03 (runState/poller) | 7 | ✓ VERIFIED | `extractRunState` unchanged; generation counter now also guards the in-flight-clear in `finally` (closing WR-02), confirmed by direct read of `_poll` |
| 01-04 (heartbeat retry) | 5 | ✓ VERIFIED | `fetchStatus` unchanged from prior verification; no regression |
| 01-05 (QUE-06 proto) | 8 | ✓ VERIFIED | Submodule pin, regeneration idempotency, typed `statusReply.run_state` read — all unchanged and reconfirmed |
| New (WR-01/02 regression coverage) | 2 (implicit, not separately numbered must-haves but now proving two previously-untested truths) | ✓ VERIFIED | `toolControl > refuses when the running step moves on before dispatch (WR-01 race guard)` and `RunStateMonitor > a stale poll from a superseded generation does not clear inFlight ... (WR-02)` both pass |
| WR-03 (CI wiring) | 1 | ✓ VERIFIED | `bin/make:36-39` `test_ts()` now runs `npm run test:unit` after `npm run test` in the same `&&` chain, confirmed by direct read |

**Combined score:** 37/37 plan-level truths verified (34 original + 3 new regression-covered claims from the fix round), no FAILED, no PRESENT_BEHAVIOR_UNVERIFIED.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/server/runControl.ts` | Frozen, import-free capability map + validation | ✓ VERIFIED | Unchanged since prior verification; still 0 imports |
| `controller/server/runState.ts` | `extractRunState` + `RunStateMonitor` | ✓ VERIFIED | `_poll`'s `finally` now generation-guarded (WR-02 fix); only `grpc.getStatus` called |
| `controller/server/tools.ts` | `Tool.lookup`, `Tool.controlCommand`, heartbeat fix, failure-streak getters | ✓ VERIFIED | Unchanged logic; prettier-only reformat confirmed by `01-REVIEW.md`'s diff read |
| `controller/server/command_queue.ts` | `RunningStep`, `runningStep` getter, `toolControl`, poller lifecycle | ✓ VERIFIED | `toolControl` now includes the step-identity re-check (WR-01 fix) immediately before dispatch |
| `controller/server/routers/command_queue.ts` | `toolControl` mutation, `runState` query | ✓ VERIFIED | Unchanged, both present |
| `controller/test/{toolControl,runControl,runState,tools,wire,infra}.test.ts` | Test suites proving every must-have | ✓ VERIFIED | 6 files, 92 tests (up from 90), all pass when I ran them myself |
| `controller/gen-interfaces/tools/grpc_interfaces/{tool_base,fast}.ts` | `run_state`, `Command_Pause` | ✓ VERIFIED | Unchanged, reconfirmed |
| `vendor/galago-tools` (submodule pin) | Human-approved commit | ✓ VERIFIED | Unchanged |
| `bin/make` | `test_ts()` runs the vitest suite | ✓ VERIFIED (new this round) | `test_ts()` now chains `npm run test:unit` after `npm run test`, closing WR-03 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `routers/command_queue.ts` | `command_queue.ts` | `toolControl` mutation → `CommandQueue.global.toolControl` | ✓ WIRED | Unchanged |
| `command_queue.ts` | `runControl.ts` | `validateControlRequest(step?.toolType, action, params)` | ✓ WIRED | Unchanged |
| `command_queue.ts` | `tools.ts` | `Tool.lookup(step.toolId)` then `tool.controlCommand(...)`, now gated by the step-identity re-check | ✓ WIRED | Confirmed by direct read of the updated method body |
| busy loop | `CommandQueue._runningStep` | set before / cleared in `finally` | ✓ WIRED | Unchanged |
| busy loop | `RunStateMonitor` | `_runStateMonitor.start(...)` / `.stop()` in the same bracket | ✓ WIRED | Unchanged |
| `runState.ts` `RunStateMonitor` | `tools.ts` | `Tool.lookup(...).grpc.getStatus({})` only | ✓ WIRED | Confirmed; `grep -oE 'grpc\.[a-zA-Z]+' controller/server/runState.ts \| sort -u` → exactly `grpc.getStatus` |
| `routers/command_queue.ts` | `command_queue.ts` | `runState` query → `CommandQueue.global.runState` | ✓ WIRED | Unchanged |
| `bin/make test_ts()` | `controller/package.json` `test:unit` | `&&`-chained invocation | ✓ WIRED | New this round; `test_ts()` fails the build if vitest fails |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `commandQueue.toolControl` reply | `{ok, response, message}` | `tool.controlCommand` → real `grpc.executeCommand` (real codec proven by `wire.test.ts`) | Yes | ✓ FLOWING |
| `commandQueue.runState` envelope | `RunStateEnvelope` | `RunStateMonitor.snapshot()` ← `tool.grpc.getStatus` → `extractRunState` | Yes | ✓ FLOWING |
| `Tool.status` / `consecutiveStatusFailures` | heartbeat state | `fetchStatus` ← `grpc.getStatus` | Yes | ✓ FLOWING |

No static/hardcoded fallbacks found on any of the three live-control/run-state paths.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite is genuinely green (ran myself, this session) | `npm --prefix controller run test:unit` | `6 files, 92 tests, all passed, 32.70s` | ✓ PASS |
| Type gate is genuinely clean (ran myself, this session) | `npm --prefix controller test` (tsc --noEmit) | exit 0, no "error TS" lines | ✓ PASS |
| WR-01 regression test exists and passes | `toolControl.test.ts` → "refuses when the running step moves on before dispatch (WR-01 race guard)" | pass | ✓ PASS |
| WR-02 regression test exists and passes | `runState.test.ts` → "a stale poll from a superseded generation does not clear inFlight..." | pass | ✓ PASS |
| `bin/make test_ts()` chains vitest after tsc | direct read of `bin/make:36-39` | `npx tsc --build --clean && npm run test && npm run test:unit` | ✓ PASS |
| Generated interfaces carry the new fields | `awk`/`grep` over `tool_base.ts`/`fast.ts` | `run_state` → 1, `Command_Pause` → 1 | ✓ PASS |
| No debt markers in any phase file | `grep -nE "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across all 14 phase source/test files | no matches | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files exist in this repository and neither PLAN nor SUMMARY declares any probe script for this phase.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| QUE-01 | 01-02, 01-05 | `toolControl` sends P/R/A straight to the running step's tool, logged | ✓ SATISFIED | `toolControl.test.ts` end-to-end test + `wire.test.ts` real-wire proof + WR-01 identity re-check |
| QUE-02 | 01-01, 01-02 | Refuses with no step/no runControl/blank decision; `runningStep` accessor | ✓ SATISFIED | `toolControl.test.ts` refusal tests + `runningStep` getter |
| QUE-03 | 01-02 | `runControl` separate map; F.A.S.T. declares pause/resume/abort | ✓ SATISFIED | `runControl.test.ts` (15 `it` blocks: map shape, ordering, commandFields untouched) |
| QUE-04 | 01-01, 01-03, 01-05 | `runState` query returns tool `run_state`, independent of `modalState` | ✓ SATISFIED | `runState.test.ts` + `wire.test.ts` + WR-02 generation guard |
| QUE-05 | 01-01, 01-03, 01-04 | Failed poll → "run state unknown", heartbeat keeps retrying | ✓ SATISFIED | `tools.test.ts` + `runState.test.ts` failure-handling describes |
| QUE-06 | 01-05 | Generated interfaces include `run_state`/`Pause`; `tsc` 0 errors | ✓ SATISFIED | Submodule pin, regeneration, `wire.test.ts`, tsc clean |

No orphaned requirements: REQUIREMENTS.md's Phase 1 traceability table lists exactly QUE-01..06, all mapped and all claimed by at least one plan's `requirements:` frontmatter field. All six are marked `[x]` and "Complete" in REQUIREMENTS.md, matching the evidence above.

### Anti-Patterns Found

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in any phase file. No placeholder/stub return values, no hardcoded-empty props flowing to output.

Carried-forward from `01-REVIEW.md` (incremental re-review, 2026-10-13T14:50:00Z), status of each:

| Finding | Severity | Status this round | Evidence |
|---------|----------|---------------------|----------|
| WR-01 — no step-identity re-check before `controlCommand` dispatch | Warning | ✅ FIXED (commit `62e505c`) | Re-check present at `command_queue.ts:467` (`if (this._runningStep !== step)`); regression test passes |
| WR-02 — unconditional `inFlight = false` in `_poll`'s `finally` | Warning | ✅ FIXED (commit `42fd1af`) | Generation-guarded at `runState.ts:195-198`; regression test passes |
| WR-03 — `npm run test:unit` not wired into CI | Warning | ✅ FIXED (commit `003e500`) | `bin/make:38` now chains `npm run test:unit` |
| IN-01 — `RunStateMonitor.snapshot()` returns only a shallow copy | Info | Open (by design — out of fix scope) | `runState.ts:166-168` still `return { ...this.envelope }`. Latent: no current caller mutates the nested `runState`/`pause` objects (the tRPC `runState` query only reads). Does not affect any stated must-have truth or ROADMAP success criterion; does not block this phase |

IN-01 remains open by explicit scope decision (`01-REVIEW-FIX.md`: "IN-01 ... was out of scope for this run (`fix_scope: critical_warning` excludes Info-level findings)"). It is Info-severity, latent, and does not block any must-have — it is not a gap for this phase.

### Human Verification Required

None. All three items from the prior `human_needed` verification have been resolved:

1. **WR-01 — toolControl's step-identity race.** Fixed in code (`62e505c`) and the residual round-trip-window risk explicitly accepted by a human in `01-UAT.md` test 1 ("pass").
2. **WR-02 — RunStateMonitor's unconditional in-flight clear.** Fixed in code (`42fd1af`) and confirmed by a human in `01-UAT.md` test 2 ("pass").
3. **D-04 judgment-tier prohibition** ("galago-core performs no instrument-state check"). Confirmed by a human in `01-UAT.md` test 3 ("pass"), and independently re-confirmed by my own direct read of `toolControl`'s full method body this session: the decision path reads only `this._runningStep`, `validateControlRequest`, and `Tool.lookup` — no `Tool.status`, run-state, or tool-reply field gates the send at any point before `await tool.controlCommand(...)`.

### Gaps Summary

No gaps. All 4 ROADMAP Phase 1 success criteria and all 37 plan-level must-have truths (34 original + 3 newly test-covered by the fix round) are independently verified against the actual codebase — not SUMMARY, REVIEW, or UAT claims. I re-ran the full unit suite (92/92 pass, up from 90) and the type gate (0 errors) myself this session, re-read the WR-01 and WR-02 fix code directly in `command_queue.ts` and `runState.ts`, confirmed the WR-03 CI wiring in `bin/make`, and confirmed via `01-UAT.md` that a human has signed off on the three items the prior verification routed to `human_needed`. QUE-01 through QUE-06 are all satisfied with no orphaned requirements. The phase goal — the server side can send an operator's Pause/Resume/Abort to the running step's tool and report that tool's live run state, without touching the queue's busy loop — is achieved and verified.

---

*Verified: 2026-10-13T15:10:00Z*
*Verifier: Claude (gsd-verifier)*
