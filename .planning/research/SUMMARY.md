# Project Research Summary

**Project:** galago-core (nikkopg fork): milestone v1.2 "Tool-inferred dropdowns + per-tool concurrency lanes"
**Domain:** lab-automation workcell scheduler (Next.js + tRPC + gRPC tool servers)
**Researched:** 2026-11-05
**Confidence:** HIGH for Phases 6 and 9 · MEDIUM for Phases 7, 8 and 10

Sources: [STACK.md](STACK.md) · [FEATURES.md](FEATURES.md) · [ARCHITECTURE.md](ARCHITECTURE.md) ·
[PITFALLS.md](PITFALLS.md) · [FAST-GET-PLATES-CONTRACT.md](FAST-GET-PLATES-CONTRACT.md)

## Executive Summary

v1.2 is two independent sets of changes that meet only where `Tool` sends gRPC calls.

1. **Dropdowns.** The operator picks STACK and F.A.S.T. command values from live instrument reads.
2. **Lanes.** The command queue can run one step per tool at the same time, behind a flag that is
   off by default.

Shared recommendations:

- **No new npm dependencies.**
- **Reads never go through `CommandQueue`.**
- **The flag-off and primary path is the legacy busy loop, kept exactly as it is.**

**Dropdown risks are about behaviour, not plumbing:**

- Fields start empty; nothing is preselected, even when only one option exists.
- A saved value that is no longer listed is kept.
- `{{var}}` keeps working.
- Cascading fields reset only when the operator changes the parent (`onChange`), never from an
  effect on the option lists.
- Ambiguous DeviceTree entries are never merged.
- "No data" means `unavailable`, never an empty list.

`commandFields` is pinned with `toStrictEqual`, so dropdown behaviour goes in a sibling binding map
and `commandFields` stays as it is.

**F.A.S.T. plates depend on galago-tools.** `FastServer.ExecuteCommand` lets only
pause/resume/abort past its BUSY gate. galago-tools must therefore ship a read bypass for
`get_plates`, with a test that calls it through `ExecuteCommand` while a Transfer runs.

**Lanes are where the cost is.**

- **A barrier or join is mandatory.** With one lane per tool and nothing else, F.A.S.T. would start
  at t=0, before STACK has placed the plates.
- **Single-slot state must become per-attempt state.** Today `_runningStep`, `_abortAcceptedQueueId`,
  `_failedAttempt`, `RunStateMonitor` (whose `start()` calls `stop()` first) and `error` each hold
  one value. If they stay that way, a second lane wipes the first lane's abort marker, so an aborted
  step runs again on the next Start. A STACK step would also take down the F.A.S.T. control bar.
- **Lane-halt is its own gate.** It is set synchronously as the first statement in the catch, and
  only an operator Start clears it. It stops new dispatch and never aborts a running step.

## Decisions Needed

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Fork/join encoding | (a) explicit `advancedParameters.lane` + `laneBarrier`, with eligibility derived from queued rows; (b) reuse the dead `runAsynchronously` flag plus a join step | **(a)**. `runAsynchronously` is stored as literal `false` on every saved row, so reusing it would silently change what stored data means. Either way, at most one step per tool server is in flight. |
| D2 | Where the lane-mode flag lives | An env var. Not `.planning/config.json` (not in the image), and not an async DB read (an `await` before the claim breaks single-flight). | Env var (pick one name: `GALAGO_PARALLEL_TOOL_LANES` / `GALAGO_PARALLEL_LANES`), read once at construction and injectable through the constructor for tests. Drop the todo's per-run `useParallelToolLanes`. |
| D3 | Tool-initiated pause vs lane-halt | A tool-side pause does not fail the step, so the other lane keeps dispatching. Gating on `run_state` would be a forbidden state check. | Accept it and document it, or add an operator-initiated "freeze lanes" control. Don't add a poll-driven gate without user sign-off. |
| D4 | Does a primary-lane modal block other lanes? | Block or don't block | A modal blocks new dispatch on every lane. Non-tool steps run on the primary lane only, enforced at creation, enqueue and dispatch. |
| D5 | The undefined "STACK goto-safe" overlap step | The frozen `stack.proto` has 10 commands and no goto-safe | Define it with the user before planning Phase 10. It can only be a real STACK `transfer` or a trivial read. Each tool maps to exactly one lane per run. |
| D6 | Offline fallback | Plain input, or a stale last-known list | **Plain input plus a hint, never a stale list** (all researchers agree). A ~15 s server TTL is fine. `refresh` runs only from the operator's button. |
| D7 | Ambiguous DeviceTree entries | Flag only, or render disabled | **Flag only**, consistent with "no state checks". Pin the behaviour in a test. Build options by position, and send `deviceName/deckName/nestName`, never `unifiedName`. |
| D8 | Step-key auto-mint (`0604348`) | The adapter mints a key when `step_key` is blank. galago-core never mints one, so "per-key one-shot" acceptance means nothing for blank-key steps. | Reword the acceptance. The live proof uses explicit, distinct keys. The automated guarantee is a unit test asserting exactly one send per queueId. Record the deployed galago-tools SHA and whether auto-mint is on. |
| D9 | Control surface under lanes | At most one controllable (`runControl`) running step, or target by queueId with one monitor per step | For v1.2, enforce the at-most-one invariant. Also make the markers per-queueId and have `recoveryControl` check every running step. |
| D10 | Read path | Instance `executeCommand`, never `controlCommand` | A dedicated read method with a gRPC deadline (or a 5 s race), taking only a closed enum registry of sources as input. |
| D11 | Edit drawer (`CommandDetailsDrawer`) | Dropdowns while editing, or free text | Decide and state it. If dropdowns, fetch only when `isEditing`, because the run page embeds the drawer read-only. |
| D12 | Banner for concurrent failures | One error slot, or a list per lane | A per-lane or bounded failure list. The first failure carries the STACK guid. |

## Key Findings

### Stack additions (STACK.md)

**No new dependencies.** Existing packages already cover each need:

- tRPC 10.9 + react-query 4.22, with read queries set explicitly to `retry:false`,
  `refetchOnWindowFocus:false`, `staleTime` ~15-30 s and no `refetchInterval`.
- Chakra 2.8 native `Select`.
- zod plus a `Map` with timestamps for the server cache.
- Native `Promise` / `Map` for lanes.
- Vitest 2.1.9, with no jsdom.

Re-pin and codegen:

- The re-pin to galago-tools `4ccd3da` leaves the protos unchanged (`git diff` on `interfaces/` is
  empty).
- Regenerate only with ts-proto **1.151.1** from a scratch directory with an explicit `--plugin=`.
- Pin the submodule by SHA, never `--remote`.

Do **not** upgrade react-query, tRPC, Next or Vitest. Do not add `p-queue`, `async-mutex` or a
`lane` SQLite column (`SqliteQueue` has no migration mechanism).

### Features (FEATURES.md)

**Table stakes: dropdowns**

- Every field starts empty.
- Offline, or on `readFailed`, the field falls back to plain text or number input.
- A saved value that is no longer listed is kept and marked "(not reported)".
- `{{var}}` keeps working. A bound variable disables the picker. A bound parent turns the child into
  plain text.
- Source and destination each have their own device → deck → nest cascade, built from one
  `list_devices` tree.
- Each source has a Refresh button that sends `refresh:true`.
- One shared read per (tool, source), with server-side validation and caps.

**Table stakes: lanes**

- Flag off behaves byte-identically to today.
- Each lane has a single-flight Start guard.
- Lane-halt.
- An explicit join.
- Per-lane evidence rows on the run page.
- A supervised live two-tool proof.

**Differentiators.** Read-only context in option labels: robot state, nest `isCalibrated`, labware
`hasLid`, plate size and capacity. The plate `id` always appears, because descriptions can repeat.

**Anti-features (do not build)**

- Dropdowns: preselecting anything, filling destination in from source, silently rewriting saved
  protocols, polling or stale lists, gating on what a list contains, clearing children on refresh.
- Lanes: auto-advance, auto-retry or auto-skip; software abort of the sibling lane; parallel by
  default; non-tool steps on a secondary lane; parallelism across runs; a DAG scheduler;
  latch-classification based on state; any change to the ledger.

### Architecture (ARCHITECTURE.md)

**Options sources**

- One closed server registry, `server/toolOptions.ts`, with five sources: `stack.robots`,
  `stack.devices`, `stack.labwareProfiles`, `stack.transferProfiles`, `fast.plates`.
- One `tool.options` tRPC query whose input is an enum id only, never a client-supplied command or
  params.
- A React-free binding map, `components/tools/fieldOptions.ts`.
- One shared `OptionsSelect` control and one `useToolOptions` hook, used by the tool page,
  `AddToolCommandModal` and `CommandDetailsDrawer`.
- The server cache has a 15 s TTL, removes duplicate in-flight reads, and times out after 5 s.

**Lane engine**

- The legacy busy loop stays as the primary worker, with three changes: a `_laneMode` early return
  in `_start`, a `_pickNext()` pickup (which returns `startNext()` when the flag is off), and a
  `WAIT` sentinel.
- One new side-lane worker runs only steps tagged for a lane.
- Lane-tagged eligibility rule: rows before the opening barrier of the segment must be terminal, and
  only the active run is picked.
- STARTED and FAILED rows stay in `_queue`. `startNext()` does not filter by status, so a second loop
  without eligibility would re-run in-flight rows (the F5 bug again).

### Critical pitfalls (PITFALLS.md: 26 critical, plus moderate and minor)

1. **A second lane overwrites single-slot state.** Each dispatch resets the abort marker and failed
   attempt (`command_queue.ts:1010,1013`). A STACK start stops the F.A.S.T. poller
   (`runState.ts:126-130`). `toolControl`, `recoveryControl` and abort-first Stop/Clear All all
   assume one running step.
2. **The lane-halt has timing gaps.** The loop checks `BUSY` before its 1500 ms sleep, and the
   failure state is set only after DB awaits. The halt must be a synchronous flag. It must not be
   cleared by `resume()`, `clearError`, `_start` or `enqueueRun`'s auto-start. A lane finishing must
   not call the global `stop()`. `recoverInterruptedSteps` must not mark the other lane's live
   STARTED row as orphaned.
3. **The F.A.S.T. `get_plates` read is refused while a transfer runs** unless galago-tools adds an
   explicit read bypass.
4. **Plate-id 0 traps.** `AddToolCommandModal` fills untouched number fields with `0` and uses
   `parseFloat(v)||0`, so legacy steps can hold plate id 0. Struct numbers arrive as doubles, so
   non-integers must be rejected, never truncated.
5. **Instrument-reported names shaped like `{{x}}`** would be substituted at run time
   (`tools.ts:433-440`). Escape them or reject them.
6. **A SUCCESS reply with no `meta_data`** (simulated tools) must map to `unavailable`, not to an
   empty list.
7. **STACK Configure drains in-flight reads for only 5 s.** react-query's default focus refetch and
   retries could starve it, so set these explicitly.
8. **Auto-mint** (D8).

## Implications for Roadmap

### Phase 6: STACK dropdowns
- Re-pin `vendor/galago-tools` to `4ccd3da`, and assert the `gen-interfaces` diff is a no-op.
- Add the `toolOptions` registry and the `tool.options` query.
- Add `fieldOptions`, `OptionsSelect` and `useToolOptions`.
- Amend the born-empty static scans; add new pins.
- Decisions: D6, D7, D10, D11. These are standard patterns and need no further research.

### Phase 7: F.A.S.T. plates
- **First task:** the galago-tools gate. It needs a frozen commit, the `ExecuteCommand` read bypass,
  and a test that goes through the gRPC path.
- Second re-pin. The diff must be exactly `GetPlates` plus oneof entry 11, with
  `expected_tray_id = 13` intact.
- A strict parser that rejects non-integer, 0, negative, NaN and string ids, and flags duplicates.
- Numeric selects. `get_plates` stays out of `commandFields.fast`.
- This phase can slip without blocking the lanes work.

### Phase 8: Lanes internals
- **First:** capture a golden transcript with the flag off.
- `laneScheduling.ts`, `claimEligible`, `stopIf`, the `command_queue` seams, and per-queueId state.
- A synchronous per-lane Start guard (no `await`).
- The lane-halt gate. A lane draining never calls the global `stop()`.
- Lane-aware control and recovery. Logs carry queueId and lane. The loop delay is injectable.
- Decisions: D1, D2, D3, D4, D9. **Needs a discuss phase.**

### Phase 9: Lanes protocol surface and run page
- Optional `lane` and `laneBarrier` fields, `validateLanes` (with `Error.name` guards), and drawer
  controls.
- Per-lane preview and Start listing, `groupRowsByLane`, a lane-aware `deriveRunOutcome` (used only
  when lane rows exist), and the failure banner (D12).
- Standard patterns.

### Phase 10: Supervised live proof
- Resolve D5 and D8 first.
- Explicit step keys, the operator present, a typed GO, and the SHAs recorded.
- Lane-halt is proven with a fake or simulated drill. No automated motion.
- **Needs a discuss phase.**

### Research flags
- Needs decisions or discussion: Phase 7 (external gate), Phase 8 (D1-D4, D9), Phase 10 (D5, D8).
- Standard patterns: Phases 6 and 9.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Every need has an in-repo precedent. The re-pin was verified as proto-neutral. |
| Features | MEDIUM-HIGH | Grounded in the code and stack-automation-layer shapes. General UX conventions come from training knowledge. |
| Architecture | HIGH for integration points / MEDIUM for lane design | The lane design is reasoned from queue semantics and has not been prototyped. |
| Pitfalls | HIGH | Traced with file:line references. The lane failure modes are inferred from code, not reproduced. |

### Gaps
- The frozen `get_plates` shape. The contract is still "proposed".
- Live STACK reply fixtures. Only the goldens from `stack-automation-layer/tests/golden/*.json` exist.
- Simulated tools return no `meta_data`.
- How much work the lanes take is unproven. The lane cap (4) and how strict barrier validation
  should be are only recommendations.
- How STACK Configure draining interacts with reads.
