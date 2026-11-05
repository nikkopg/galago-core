# Feature Research

**Domain:** Operator-facing lab-automation workcell controller (galago-core): instrument-inferred command-form dropdowns + per-tool concurrency lanes in the command queue
**Milestone:** v1.2 (subsequent; adds to the shipped v1/v1.1 controller)
**Researched:** 2026-11-05
**Confidence:** MEDIUM-HIGH. Everything about this codebase, the stack-automation-layer read shapes and the F.A.S.T. contract was read directly (HIGH). The form-UX conventions (loading/offline fallback, stale saved value, cascading reset) are established practice from training knowledge, not from fresh external sources (MEDIUM). No external web search was run: the milestone is almost entirely constrained by this repo's own rules (core value, "no state checks", born-empty), which outrank generic UX convention. Lane-scheduler design is reasoned from the todo and the queue code, not from a surveyed competitor (LOW for any "other schedulers do X" claim; none are relied on).

Scope note: only the three v1.2 features. Existing features (queue, run page, STACK forms, recovery card) are dependencies, not subjects.

---

## Part A. STACK + F.A.S.T. inferred dropdowns

### What the instruments actually give us (shapes that drive the features)

| Read | Reply `kind` | Useful fields | Gotchas |
|------|--------------|---------------|---------|
| `list_devices` | `deviceTree` | `devices[].deviceName/decks[].deckName/nests[].nestName`, plus `isCalibrated`, `type`, `unifiedName` on nests/decks; **`ambiguous: string[]`** | `ambiguous` holds path strings: `"device"`, `"device/deck"` or `"device/deck/nest"`. The adapter's `location()` resolves an ambiguous triple to **None** (refuses it), never first-match. A duplicated device name makes every triple under it ambiguous. |
| `get_robot_states` | `robotStates` | `robots[].robotName`, `robots[].state` (raw wire string) | State is live and display-only here (galago-core does not gate on it). |
| `list_labware_profiles` | `labwareProfiles` | `profiles[].name`, `hasLid`, grip/height numbers (nullable) | Missing numbers are `null`, not 0. |
| `list_transfer_profiles` | `transferProfiles` | `profiles[].name`, `fields` (raw passthrough) | `fields` names differ between the deployed manager and the swagger; do not render a fixed field set. |
| any read | `readFailed` | `error{status,name,code,detail}`, `message?` | A failed read arrives as a reply, not a throw; must map to "unavailable". |
| F.A.S.T. `get_plates` (new) | `meta_data.plates[]` | `id`(int), `description`, `rowCount`, `colCount`, `workingCapacity`(µL) | Struct numbers are doubles: validate `Number.isInteger(id) && id >= 1`. `plates: []` is a valid answer. Ascending by `id`. Never takes the motion lock. |

### Table Stakes (operator will treat the form as broken or unsafe without these)

| Feature | Why Expected | Complexity | Notes / Dependency on existing code |
|---------|--------------|------------|-------------------------------------|
| **Born-empty dynamic select** for each listed field: placeholder only, no `defaultValue`, never auto-pick a lone option | Core value: nothing preselected; v1.1 D-03 already pins "no defaultValue, no select" for STACK | LOW | Chakra `Select placeholder=...` pattern already used in `AddToolCommandModal.tsx` and `pages/tools/[id].tsx`. `commandFields.stack` + `test/commandFields.test.ts` + `test/staticScan.test.ts` currently forbid `select` on STACK; these pins must be **amended** (allow dynamic select, still forbid default/preselect) rather than deleted. |
| **Loading state** that does not block the form | Lists are a network read to a tool server | LOW | Disabled select with "Loading..." only for the first fetch; never block Send on it. |
| **Offline / unavailable fallback to the existing free-text (STACK) or number (F.A.S.T.) input**, with a one-line "Instrument list unavailable, type the value" note | Tool server can be offline, or the read can return `readFailed`; the operator must never be locked out of sending a command they could send yesterday. Equals today's v1.1 behavior, so zero regression risk | LOW-MED | Server returns `unavailable` instead of throwing (contract says so for plates; do the same for STACK reads). Treat transport error, non-SUCCESS code, `readFailed`, malformed/over-cap reply identically. |
| **Fallback shows no stale list as if live** | A physical choice (which plate/nest) must not be offered from memory | LOW | Resolves the contract's open point: plain number input when offline, not a last-known list. A short server-side cache (seconds to ~1 min) is fine; a displayed-while-offline list is not. |
| **Keep a saved value that is no longer listed, selected, with a visible warning** ("`X` is not reported by the instrument") | Saved protocols reference names/ids that may be renamed, removed or simply missing because the list is stale; silently blanking or substituting changes a physical action | MED | Render the saved value as an extra option labelled "(not reported)" + warning badge. Do not clear it, do not block Save/Send (the instrument validates; galago-core must not gate). Compare as `String(value)` (F.A.S.T. ids may be stored as number, string or `{{var}}`). |
| **`{{variable}}` support preserved** wherever it exists today (`AddToolCommandModal`): a bound variable disables the picker and shows "Using variable"; a bound parent in a cascade makes the child fall back to text | The protocol modal already offers "No Variable" on every field and `Tool.executeCommand` substitutes `{{name}}` at run time | MED | Reuse `handleVariableSelect` / `isVariableReference`. Option lists are never validated against a variable's value (unknowable at edit time). Tool page (`pages/tools/[id].tsx`) has no variable UI today; do not add one. |
| **Cascading device -> deck -> nest, independently for source and destination** | A nest name is meaningless without its deck and device; the tree is nested | MED | One `list_devices` read feeds all six selects (nested tree, no per-level calls). Child disabled until parent chosen. |
| **Cascading reset on operator change only**: changing device clears deck+nest; changing deck clears nest; cleared to born-empty, never to the first child | Prevents a stale deck under a new device being sent | MED | **Critical pitfall:** reset must be driven by the `onChange` handler, never a `useEffect` on option lists, or the first list load / a refresh will wipe a hydrated saved step. |
| **Ambiguity handling from `DeviceTree.ambiguous`** | The adapter refuses ambiguous triples; offering them unmarked sends the operator into a refusal, and de-duplicating by first match would silently address the wrong physical location | MED | Compute each option's path key (`device`, `device/deck`, `device/deck/nest`) and test membership in `ambiguous`. Show ambiguous options visibly flagged "ambiguous, adapter will refuse"; never hide, never collapse duplicates. Whether to also disable them is a Phase-discuss decision (recommendation: flag, do not disable: adapter is the gate, per "no state checks"). Duplicate names also need unique React keys (index-suffixed). |
| **Manual Refresh control per list source** (re-read with `refresh: true`) | The adapter caches its knowledge snapshot; an operator who just taught/calibrated a nest on the PAC must be able to see it. The `refresh` boolean already exists on `list_*` (STACK) and is proposed on `get_plates` | LOW | One refresh button per source (devices, labware, transfer, robots, plates), not per field. |
| **One shared read per (tool, source), not per field** | Six location selects + two profile selects would otherwise fire 8+ reads per form open | LOW-MED | tRPC query keyed by toolId + source; short `staleTime`. |
| **Reads go through the direct, non-queue send path and never through the run queue** | A form open must never create queue rows, block the busy loop, or touch the step-key ledger | MED | Mirror `Tool.controlCommand` (`server/tools.ts` ~375): no variable substitution, not enqueued, not stored. Contract names this path for `get_plates`; reuse for STACK reads. |
| **Validate + cap every reply server-side** (max items, string lengths, integer ids, `kind` check) | Replies are untrusted wire data; a ~3 KB unknown reply already blew a card layout once (Phase 4 G-04-2/6) | MED | Reuse `server/toolReply.ts` patterns; same spirit as `BoundedRawJson`. |
| **Wire format unchanged** | "Saved protocols load unchanged": STACK params stay strings, F.A.S.T. plate ids stay numeric | LOW | `omitBlankParams` / `coerceBooleanParams` untouched. Plate select must convert to number on change and render from `String(value)`. |
| **`get_plates` kept internal** (not in `commandFields.fast`, not a protocol step, not a tool-page command) | Contract requirement | LOW | Add to the static scan so it cannot leak into the command list. |
| **Dropdowns on all three STACK commands** (`transfer`, `get_transfer_estimate`, `get_labware_presence`) and both F.A.S.T. plate fields, in both form hosts (protocol step modal and tool page) | Milestone scope; `get_labware_presence` only needs the robot select | MED | Build one shared `InstrumentSelectField` consumed by both hosts, driven by a field spec (`source: "stack.robots" \| "stack.devices" \| ...`, `dependsOn`), instead of two renderers. |

### Differentiators (valuable, align with "operator decides, instrument informs")

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Read-only context in option labels: robot state; nest `isCalibrated`/`type`; labware `hasLid`/grip; plate `rowCount x colCount`, `workingCapacity` µL; always include plate `id` | Lets the operator choose the right physical thing instead of guessing from a bare name. Information only, no gating | LOW-MED | Labels only. Plate `description` can repeat, so the id must always show. A "not calibrated" badge is display-only. |
| Per-source status line: "from instrument, N items, fetched hh:mm:ss" next to Refresh | Operator can see whether the list is live or cached | LOW | |
| Same-nest source == destination informational warning | Cheap catch of an obvious slip | LOW | Display only, never blocks; the adapter's `validate_transfer` is the real check. Defer if time is tight (P3). |
| Variable-bound cascade hint ("child list unavailable while the parent is a variable") | Explains why a child falls back to text | LOW | Pairs with the `{{var}}` table stake. |
| Transfer-profile option shows a short summary of `fields` (generic key/value, truncated) | Lets operator sanity-check profile choice | MED | Must be generic (field names vary by manager version). Defer unless a Phase-discuss asks for it. |

### Anti-Features (explicitly do not build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Preselect labware profile, nest, plate, robot or "the only option" | Saves clicks | Violates core value and the explicit v1.2 Out of Scope: a wrong default is a physical action on a plate | Born-empty; the operator picks every value |
| Auto-fill destination from source / "same as source" | Common transfer pattern | Same hazard: destination is a physical decision | Nothing prefilled; at most the informational same-nest warning |
| Silently rewrite saved protocols (rename migration, normalize ids, drop unlisted values, fuzzy/case-insensitive match to a listed name, auto-fix stale values) | Tidy data | Changes what the instrument will physically do without the operator knowing; breaks "saved protocols load unchanged" | Show the saved value as-is with a warning; the operator edits it deliberately and saves |
| Clearing child fields when the parent list reloads/refreshes or when a hydrated step loads | "Consistency" | Destroys saved values on first fetch | Reset only on operator `onChange` of the parent |
| Disabling Save / Send because the list is offline, empty or does not contain the value | "Prevent bad input" | galago-core has no state checks; the instrument gates; offline would lock the operator out | Warn, never gate |
| Run-time or enqueue-time validation against the live list (refuse a run whose values aren't listed) | Catch typos early | Same as above, plus races (lists change) and extra reads at run time | The instrument/adapter validates; optional edit-time warning only |
| Polling / auto-refresh of lists | Always fresh | Extra load on the tool server, lists re-render under the operator while choosing; precedent: Read Latch is explicit, no polling | Read on open + manual Refresh + short cache |
| Showing a last-known list while offline | Convenience | Stale physical choices presented as live | Free-text/number fallback |
| Collapsing duplicate names / picking first match on ambiguity | Cleaner list | The adapter deliberately refuses first-match because it addresses the wrong location | Show every row, flag ambiguous |
| Making `get_plates` (or any list read) a protocol step or queue command | Reuse of command UI | Reads would create queue rows and ledger/step noise; `get_plates` is internal by contract | Direct non-queue send only |
| Dropdowns for other tool types, or changing `stack.proto` / `fast.proto` shape | Consistency | Out of scope; STACK proto is frozen, F.A.S.T. proto change is a galago-tools deliverable | Stay on the listed commands |

---

## Part B. Per-toolId concurrency lanes

### Reading of the todo's acceptance list, classified

| Acceptance / constraint item | Class | Why |
|------------------------------|-------|-----|
| Flag off (default) = byte-identical sequential behavior | **Table stake (gate)** | Existing guarantees (QUE-07..09, abort-first Stop, queueStartGuard tests) must pass unchanged with the flag off |
| Per-lane single-flight Start guard; no second dispatch of an in-flight row | **Table stake** | Constraint 1; F5 root cause. Ledger keys must never be re-sent |
| Lane-halt: a failure freezes new dispatch on every lane | **Table stake** | Constraint 3; operator physical-safety drill |
| Per-lane evidence rows (monotone within a lane, cross-lane overlap timestamped) | **Table stake** | Constraint 5; the run page and audit must not imply a total order |
| Non-tool steps (assignment, form, note, pause, timer) live on the primary lane only; `skipExecutionVariable` lane-local | **Table stake** | Constraint 4; `variable_assignment`, `showUserForm`, `_messageResolve`, `_isWaitingForInput` all weave through the single stepper |
| Live two-tool proof (STACK goto-safe while F.A.S.T. runs ~73 s) | **Table stake (milestone gate)** | Acceptance item 1; supervised, operator present |
| Lane field + per-lane preview + per-lane run-page rows | **Table stake** | Without them the flag is unusable and unauditable |
| Explicit join step | **Table stake in practice (todo calls it optional)** | See "Fork/join reasoning" below: the target cycle needs a mid-run barrier before `out1` |
| Lane selector UI in the advanced-parameters editor | Nice-to-have | A plain `lane` field in the step JSON/preview is enough for the live proof; the editor control can follow |
| Script API `galago.lane("fast")` | Nice-to-have | Visual-protocol path is enough for v1.2 proof |
| PROJECT.md single-flight section + todo resolution note | Table stake (docs) | Acceptance item 4 |

### Fork/join reasoning (the thing that makes this feature safe or dangerous)

A pure "one lane per toolId, every lane runs its rows in order, lanes run independently" model would start the F.A.S.T. step at run start, before STACK `in1`/`in2` have placed the plates. Lanes alone are therefore unsafe. The target cycle

```
in1 (STACK) -> in2 (STACK) -> { FAST liquid (73s) || STACK goto-safe } -> out1 -> out2
```

needs two ordering rules the todo only half states:

1. **Fork point:** a lane-tagged step starts when the previous step in run order (on the primary lane) has finished, and does not block the next primary step. Sequence position is the default barrier; only steps explicitly tagged with a non-primary lane overlap.
2. **Join:** `out1` must wait for the FAST step to finish. Without an explicit join step the operator cannot express this, and the run would move a plate out from under a pipetting step. "Run complete when every lane drains" is only the run-end join. So a `join` step (waits for all in-flight lane steps of this run) is part of the minimum.

The dead `advancedParameters.runAsynchronously` flag (always literal `false`, never read; `server/runs.ts:117`, `protocol-script-executor.ts:30`) is an alternative encoding of fork ("do not wait for this step"). Phase discuss must pick one encoding (explicit `lane` value vs the async flag) and keep one rule: at most one in-flight step per tool server, whichever encoding is used, because each tool server owns its own motion lock and step-key ledger.

### Table Stakes (detail)

| Feature | Why Expected | Complexity | Notes / Dependency on existing code |
|---------|--------------|------------|-------------------------------------|
| Default-off, **runtime-readable** flag; flag off = old code path | Byte-identical guarantee | LOW-MED | The todo names `.planning/config.json` -> `workflow.parallel_tool_lanes`, but that file is GSD tooling config: it is not part of the production image and the app never reads it (server code reads `process.env.*` / `CONTROLLER_CONFIG`). Use an env var or app setting and say so in the requirements. Verify with the flag-off run of `queueStartGuard`, `queueRestart`, `queueError`, `runOutcome` tests unchanged. |
| At most one in-flight step per toolId, always | Tool servers serialize on their own motion lock; a second submit to the same tool is the F5 failure mode | MED | Enforce at dispatch regardless of how lanes are named. |
| Per-lane Start guard with the existing "Queue Start Ignored" log per lane; the global "already running" message only when every lane is busy | Constraint 1 | MED | `_start` guards on a single `_runningPromise` (`command_queue.ts` ~914-957). Needs per-lane promises; the guard must remain the first synchronous statement (no `await` between guard and claim). |
| **Single dispatch gate** that every lane checks before each dispatch: closed by failure on any lane, open modal/user form, operator pause, Stop/Clear All | One concept covers lane-halt and the modal entanglement | HIGH | Today these are scattered across `_state`, `_isWaitingForInput`, `_messageResolve`. Lane-halt = failure closes the gate. |
| Lane-halt is **conservative**: any failed step on any lane closes the gate; galago-core does not try to classify "latch-class" | "No state checks" constraint; the tool server owns the latch | LOW once gate exists | The queue can only know a step errored. |
| Lane-halt **never aborts** the other lane's in-flight step; it only stops new dispatch | Software-initiated abort is explicitly Out of Scope | MED | Resolves a tension in the todo: "freeze before next dispatch" does not stop a step already running. The operator must see "lane B still running" and decide Abort themselves. |
| Operator Start after a halt is explicit and clears the gate; nothing resumes on reconnect/timer | Core value | MED | Start restarts idle lanes only; in-flight lanes keep the single-flight refusal. |
| **Per-step operator control for multiple running steps**: ControlBar/runState/Abort/Pause must address a specific running step | The v1 control surface assumes ONE `_runningStep` | HIGH | `runningStep` getter, `RunStateMonitor` (single), `toolControl`, `recoveryControl` (matches `runningStep.toolId` to gate attempts, `server/recoveryControl.ts:59`), `_failedAttempt` and `_abortAcceptedQueueId` (single slots, T-01-08 late-reply token) all need a per-lane form. Largest hidden cost of the milestone. UI-08 static scans (single send path, no timers, no state checks) must still pass. |
| Failure bookkeeping per lane (`fail`, `failAndDequeueRun`, "row removed by Clear All" handling) | Failure of lane A must mark A idle and leave B's row intact | HIGH | The busy-loop catch (`~1380-1440`) currently handles exactly one attempt. Abort-first Stop/Clear All must abort every running step before touching the queue. |
| Run completion = every lane drained; run failure semantics unchanged | Constraint in todo | MED | Run outcome derivation (`COMPLETED_WITH_SKIPPED_FAILURE`, FAILED precedence) is client-side from rows; extend, do not change `RunStatus`. |
| Join step (barrier) | See reasoning above | MED | A new non-tool step type on the primary lane that waits for all in-flight lane steps of its run. Needs a declared home in `commandFields`/protocol step types, the preview and the queue listing. |
| `lane` field + `protocol.preview` per-lane rows + Start confirmation listing lane-aware (`queueStartListing.ts`) | Operator must see what runs where before pressing Start | MED | Preview/listing are read-only joins over queue rows. |
| Run page per-lane rows with per-row status and start/end timestamps; no implied total order | Constraint 5 | MED-HIGH | `RunsComponent.tsx` assumes one running row and a linear order. |
| Ledger one-shot safety intact: each leg mints its own key in its own lane; no re-send, no replay | Constraint 2 | LOW (if dispatch is guarded) | Prove with a test that counts sends per queueId under two lanes. |
| Live proof: STACK goto-safe overlapping a ~73 s F.A.S.T. transfer, both tools see exactly their own steps | Acceptance 1 | MED (process cost) | Supervised, in galago-tools' operator-present style; never from automated tests (Out of Scope: no motion from tests). |

### Differentiators / Nice-to-have

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Lane selector in the advanced-parameters editor (visual protocols) | Authors set the lane without editing JSON | MED | After internals + preview work. |
| `galago.lane("fast")` in script protocols | Script parity | MED | Defer; script executor writes advancedParameters today. |
| Visual timeline of lane overlap on the run page | At-a-glance proof of concurrency | MED-HIGH | Per-lane rows with timestamps are enough for v1.2. |
| Per-lane Start/status badges in the queue header | Operator sees which lane is busy/frozen | LOW-MED | Natural by-product of per-lane state; keep read-only. |
| Runbook "parallel variant" in galago-tools | Operational follow-through | LOW | Only after the typed-GO'd live proof (as the todo says). |

### Anti-Features (lanes)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-advance, auto-retry or auto-skip the other lane after a failure | Throughput | Operator would share space with an arm while a failure is being recovered; violates core value | Gate closes; operator decides |
| Software abort/pause of the sibling lane on failure | "Make it safe automatically" | Out of Scope (software-initiated abort); a wrong abort mid-pipette is itself harmful | Freeze new dispatch, surface the still-running lane, operator aborts if they choose |
| Auto-restart of lanes after halt, reconnect, restart or timer | Convenience | Re-dispatch risk (F5), operator-decides | Explicit operator Start |
| Parallel by default / flag default on / auto-parallelization when steps merely target different tools | Faster by default | Starts later steps before their physical predecessors finish (see fork/join) | Default off; only explicitly tagged steps overlap |
| Putting assignments, forms, pauses, timers, notes on non-primary lanes | Symmetry | Races on variables and the single modal channel | Primary lane only |
| Cross-run parallelism (steps of run B filling an idle lane of run A) | Utilization | Breaks run ordering/audit and Start-confirmation semantics | Lanes exist within one run only |
| General DAG scheduler / arbitrary N-lane fan-out / schedule optimizer | "Real scheduler" | Large, unproven, outside the live-proof need | Fork + join between a small number of lanes; revisit only after live use |
| galago-core classifying failures as "would latch" by reading tool state | Precision | Violates "no state checks" | Treat every failure as halting |
| Changing any tool server's ledger/replay behavior or sending a key twice | Retry logic | Ledger discipline is per-tool and stays untouched | Each leg mints its own key once |
| Shipping the flag via `.planning/config.json` | Todo text | Not available to the deployed container | Env var / app setting |

---

## Feature Dependencies

```
Shared dynamic-select field + reads layer (direct non-queue send, validate/cap, unavailable, cache, refresh)
    |--requires--> frozen stack.proto reads (already generated at bcbbf8e; re-pin to 4ccd3da, protos unchanged)
    |--enables---> STACK dropdowns (robot, device/deck/nest cascade, labware, transfer profiles)
    |--enables---> F.A.S.T. plate dropdowns
                      \--requires--> galago-tools ships get_plates + frozen proto commit + re-pin + regen (ts-proto 1.151.1)

STACK dropdowns --requires--> amended born-empty static scans (commandFields.test.ts, staticScan.test.ts)
Cascade reset         --requires--> onChange-only reset (not effect-driven)
{{var}} support       --conflicts-with--> filtered child lists (child falls back to text when a parent is a variable)
Stale-saved-value warning --requires--> String(value) comparison for numeric plate ids

Lanes internals (dispatch gate, per-lane running step/attempt, per-lane Start guard, lane-halt)
    |--requires--> refactor of single-slot state in command_queue.ts (_runningPromise, _runningStep, _failedAttempt, _abortAcceptedQueueId)
    |--requires--> per-step control surface (RunStateMonitor, toolControl, recoveryControl, ControlBar)
    |--enables---> protocol surface (flag, lane field, join step, preview, Start listing)
                       \--enables---> run page per-lane rows
                                          \--enables---> live two-tool proof (supervised) --enables--> docs/runbook

Lanes --independent-of--> dropdowns (no code dependency; ordering is by risk and by the external get_plates dependency)
Lanes --conflicts-with--> operator-only STACK acknowledge, abort-first Stop/Clear All unless those are made lane-aware
```

### Dependency Notes

- **Dropdowns require the reads layer first:** build it with STACK (all four reads exist today) so F.A.S.T. plates only add one source and one field spec once galago-tools freezes `get_plates`.
- **F.A.S.T. plates are externally blocked:** the contract file is a proposal until galago-tools freezes the commit. Phase 6 should not start coding the plate field before the re-pin; the shared layer can be proven on STACK meanwhile.
- **Lane internals precede protocol surface and UI** (todo execution order stands). The control surface (Abort/Pause on a specific running step) is the biggest dependency and is easy to underestimate because it is not listed in the todo.
- **Abort-first Stop/Clear All/delete-run must become lane-aware** or they will leave a second lane's step untracked (the exact failure Phase 2 fixed for one lane).

---

## MVP Definition

### Launch With (v1.2)

- [ ] Shared dynamic-select + reads layer with offline fallback, stale-value warning, born-empty, `{{var}}` preservation, onChange-only cascade reset, Refresh, ambiguity flag
- [ ] STACK dropdowns on `transfer`, `get_transfer_estimate`, `get_labware_presence` (both form hosts)
- [ ] F.A.S.T. `source_plate_id` / `dest_plate_id` dropdowns (after galago-tools freezes `get_plates`)
- [ ] Lanes behind a default-off runtime flag: per-lane single-flight, dispatch gate with lane-halt (no software abort), per-step operator control, fork + explicit join, lane field, per-lane preview and run-page rows, live two-tool proof

### Add After Validation (v1.2.x)

- [ ] Option-label context (calibration, hasLid, plate dimensions/capacity) if not cheap during the first pass
- [ ] Lane selector in the advanced-parameters editor
- [ ] Per-lane status badges in the queue header

### Future Consideration (v2+)

- [ ] `galago.lane()` script API
- [ ] Visual lane timeline
- [ ] N-lane / DAG scheduling, cross-run parallelism (only if live use demands it; currently anti-features)
- [ ] Same-nest warning, transfer-profile summaries

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Shared dynamic-select + reads layer (fallback, stale warning, born-empty, var, refresh) | HIGH | MEDIUM | P1 |
| STACK cascade (device/deck/nest) incl. ambiguity flag | HIGH | MEDIUM | P1 |
| STACK robot/labware/transfer-profile selects | HIGH | LOW | P1 |
| F.A.S.T. plate selects | HIGH | LOW (after layer exists) | P1, externally gated |
| Lane internals: gate, per-lane guard, lane-halt, failure bookkeeping | HIGH | HIGH | P1 |
| Per-step operator control for multiple running steps | HIGH (safety) | HIGH | P1 |
| Fork + explicit join | HIGH (safety) | MEDIUM | P1 |
| Lane field, preview, Start listing, run-page per-lane rows | HIGH | MEDIUM-HIGH | P1 |
| Live two-tool proof | HIGH | MEDIUM (process) | P1 |
| Option-label context | MEDIUM | LOW-MED | P2 |
| Lane selector editor UI | MEDIUM | MEDIUM | P2 |
| `galago.lane()` script API, timeline, DAG | LOW now | HIGH | P3 |

## Competitor / Prior-Art Analysis

No external competitor survey was done (LOW value here: the governing constraints are this project's own core value and the stack-automation-layer contract). Internal prior art to follow:

| Feature | Existing precedent in this repo | Our approach |
|---------|--------------------------------|--------------|
| Born-empty, operator-picked values | v1.1 D-03 STACK forms, `RunRecoverySection` radios | Keep; dropdowns only offer what the instrument reports |
| Direct non-queue read | `Tool.controlCommand`, explicit Read Latch (no polling) | Same path for list reads; explicit Refresh, no polling |
| Bounded display of untrusted replies | `BoundedRawJson`, `toolReply.ts` | Validate + cap list replies server-side |
| Single-flight guard as first synchronous statement | `CommandQueue._start` (QUE-07) | Per-lane copy of the same guard |
| Operator-only recovery, nothing automatic | DEP-03a acknowledge, abort-first Stop | Lane-halt freezes dispatch only; operator decides everything else |

## Sources

- `/home/formulatrix/data/nikko/galago-core/.planning/PROJECT.md` (core value, Out of Scope, key decisions) - HIGH
- `/home/formulatrix/data/nikko/galago-core/.planning/research/FAST-GET-PLATES-CONTRACT.md` - HIGH (proposal until frozen)
- `/home/formulatrix/data/nikko/galago-core/.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md` - HIGH
- `/home/formulatrix/data/nikko/stack-automation-layer/stack_automation_layer/results.py`, `knowledge.py` (DeviceTree, `ambiguous` path-string format, `location()` refusing ambiguous triples, RobotStates/LabwareProfiles/TransferProfiles shapes) - HIGH
- galago-core code read: `controller/server/command_queue.ts` (single `_runningPromise`/`_runningStep`/`_failedAttempt`, `_start` guard, busy-loop catch), `controller/server/tools.ts` (`controlCommand`, `{{var}}` substitution in `executeCommand`), `controller/components/tools/constants.ts` (`commandFields.stack` born-empty), `controller/components/protocols/AddToolCommandModal.tsx` (variable select, `handleVariableSelect`), `controller/pages/tools/[id].tsx`, `controller/server/recoveryControl.ts` - HIGH
- General form-UX conventions (offline fallback, stale saved value shown with warning, cascading reset on parent change) - MEDIUM (training knowledge, no fresh source)

---
*Feature research for: instrument-inferred dropdowns + per-tool concurrency lanes (galago-core v1.2)*
*Researched: 2026-11-05*
