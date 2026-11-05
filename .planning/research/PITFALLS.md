# Pitfalls Research

**Domain:** Lab-automation workcell controller (galago-core): instrument-inferred command-form dropdowns (STACK, F.A.S.T.) + per-toolId concurrency lanes in a single-queue scheduler driving physical robots
**Milestone:** v1.2 (subsequent; adds to the shipped v1/v1.1 controller)
**Researched:** 2026-11-05
**Confidence:** HIGH for everything tagged with a file:line (read directly at HEAD `60838a9` and in `vendor/galago-tools` objects `bcbbf8e`..`4ccd3da`, which are present locally). MEDIUM for UI-behaviour claims about native `<select>` and react-query defaults (standard behaviour, not re-verified in this repo). No external web research: this milestone is governed by this repo's own rules (core value, "no state checks", born-empty), which outrank generic practice.

**Phase labels used below** (the roadmap does not exist yet; the roadmapper will number them):

| Label | Scope |
|-------|-------|
| **P-STACK** | Re-pin to `4ccd3da`, shared reads layer, STACK dropdowns |
| **P-FAST** | F.A.S.T. `get_plates` (second re-pin, plate fields). Note: `FAST-GET-PLATES-CONTRACT.md` calls this "Phase 6"; renumber it |
| **P-LANE-1** | Queue internals: per-lane state, per-lane Start guard, dispatch gate / lane-halt |
| **P-LANE-2** | Protocol surface (flag, `lane` field, join, preview) + run page + control surface |
| **P-LANE-3** | Supervised live two-tool proof + docs |

Confidence tags: [V] verified by reading code or running a command; [I] inferred from code.

Line-number note: `vendor/galago-tools` is still checked out at `bcbbf8e`. All `stack/server.py` line numbers refer to `git -C vendor/galago-tools show 4ccd3da:tools/stack/server.py` (the re-pin target). `tools/fast/server.py` and `tools/base_server.py` are identical in both commits. Line numbers in `FAST-GET-PLATES-CONTRACT.md` have drifted (it cites `tools.ts:375` for the direct send path; `controlCommand` is at `server/tools.ts:378`).

---

## Critical Pitfalls

### Pitfall 1: The F.A.S.T. `get_plates` contract is incomplete: "no motion lock" is not enough to answer while a Transfer runs

**What goes wrong:** The contract (`FAST-GET-PLATES-CONTRACT.md` section 2) says the handler takes no motion lock and no idle check, and "must succeed while a transfer is running". But F.A.S.T.'s gRPC entry point is `FastServer.ExecuteCommand`, which only routes `CONTROL_COMMANDS = {pause, resume, abort}` around base_server's readiness gate (`vendor/galago-tools/tools/fast/server.py:80`, `:515-541`). Every other command, `get_plates` included, falls through to `super().ExecuteCommand`, which refuses with `NOT_READY` unless the tool is READY and sets BUSY/READY around the call (`tools/base_server.py:203`; the comment at `fast/server.py:520-528` says so). While a Transfer holds the tool BUSY, a plain `GetPlates` handler is refused before it runs. STACK needed an explicit `READ_COMMANDS` bypass for exactly this reason (`stack/server.py:142-151`, `:950-986`). The contract's test #1 ("handler returns the list while a fake transfer holds the motion lock") calls the handler directly and passes while the real gRPC path still refuses [V].

**Why it happens:** The contract was written from fast-mcp's `plate_definitions()` read, not from the gRPC adapter's admission path. "No lock" and "bypasses the status bracket" are two different mechanisms.

**How to avoid:** Before P-FAST starts, require in the galago-tools deliverable: (a) a `READ_COMMANDS`-style bypass for `get_plates` in `FastServer.ExecuteCommand` that never calls `isReady`/`setStatus`, and (b) a test that goes through `ExecuteCommand` (the gRPC servicer method) with a Transfer in flight and asserts SUCCESS and an unchanged BUSY status. Treat the frozen commit as unacceptable without (b). On the galago-core side, always map NOT_READY to `unavailable` (number-input fallback), so the form still works when the bypass is missing.

**Warning signs:** The plate dropdown works in the idle tool page but shows "unavailable" during a transfer; F.A.S.T. status flips READY mid-transfer after a plates read (that would be the missing status guard, a safety-relevant regression); the galago-tools tests only call `server.GetPlates(...)`.

**Phase to address:** P-FAST (gate before re-pin); record as a cross-repo precondition in the roadmap.

---

### Pitfall 2: A dropdown read that goes through the queue, a protocol step, or the generic command path

**What goes wrong:** The easy implementations are wrong: (a) enqueue a `list_devices` row (creates queue rows, waits behind the busy loop, shows in run history, can be re-run by upstream retry); (b) call `tool.runCommand` (`server/routers/tool.ts:497-508` is an unrestricted `Tool.executeCommand` passthrough: any command string, including `transfer`); (c) reuse `Tool.executeCommand` (`server/tools.ts:393-410`), which logs a DB audit row per call (`logAction` inserts into `logs`, `server/logger.ts:13-19`), mutates `command.params` in place (`tools.ts:433-440`), and runs variable substitution and operator-only checks designed for steps.

**Why it happens:** The existing `latchStatus` query (`routers/tool.ts:550-578`) is the nearest precedent and goes through `tool.executeCommand`; it is copied without noticing it is a one-shot explicit read, not something fired on every form open.

**How to avoid:** One server module, one fixed allow-list of read commands (`get_robot_states`, `list_devices`, `list_labware_profiles`, `list_transfer_profiles`, `get_plates`), input of `{toolId, source, refresh?}` only. No command string, no params from the client except the `refresh` boolean, which is only ever sent by the explicit Refresh button. Add a new `Tool` method (like `controlCommand`, `tools.ts:378`) that sends one gRPC call with a **deadline**, no substitution, no step plumbing, and no per-read audit row (log failures and refreshes only). Extend `test/staticScan.test.ts` so that (i) the read module is the only caller, (ii) it imports nothing from `command_queue`, (iii) `get_plates` and the five reads are not in any `commandFields` list reachable by a protocol step (STACK's `list_*` stay tool-page commands as today, `constants.ts:362-364`; `get_plates` must stay out of `commandFields.fast`).

**Warning signs:** `command_queue_2_commands` gains rows when a form opens; `Tool Command Execution` log rows appear per form open; the busy loop's `Queue Started` log fires on a form open; a read is delayed while a step runs.

**Phase to address:** P-STACK (build the layer once), P-FAST (reuse unchanged).

---

### Pitfall 3: Reads with no deadline, react-query defaults, and Configure draining

**What goes wrong:** (1) `promisifyGrpcCall` passes `options` through (`server/utils/promisifyGrpcCall.ts:8-23`) but no caller sets a deadline (PROJECT.md: "No gRPC deadline on `executeCommand`"). A read to a hung tool server never settles, so a form shows "loading" forever and a Node request leaks per open. (2) tRPC/react-query v4 defaults (`retry: 3`, `refetchOnWindowFocus: true`, `staleTime: 0`) turn six STACK selects and focus changes into a storm of reads, and retry against an offline tool. (3) STACK counts every read as a "reader": `Configure` waits at most `CONFIGURE_DRAIN_TIMEOUT_S = 5` for in-flight reads, then refuses with "busy, a command is still running; retry Configure when it ends" (`stack/server.py:120-123`, `:839-860`). A read storm can make an operator's Configure fail. (4) A read arriving during a Configure gets `ERROR_FROM_TOOL` "reconfiguring" (`stack/server.py:862-870`, `:1009-1010`); mapping that to a thrown error produces toast spam.

**Why it happens:** Defaults are invisible; the read looks cheap.

**How to avoid:** Per-read deadline of a few seconds (pass `new grpc.Metadata()` explicitly plus `{ deadline }`, since the wrapper appends the callback after the args); `retry: false` and `refetchOnWindowFocus: false` on these queries; one shared query per (toolId, source), not per field; read on form open plus explicit Refresh only (the FEATURES.md "no polling" rule; the Read Latch precedent). The server query never throws: every transport error, non-SUCCESS code, `readFailed`, reconfiguring, malformed or over-cap reply becomes `{ status: "unavailable", reason }`.

**Warning signs:** Network tab shows repeated `tool.*` read calls on window focus; a Configure click returns "busy" while a form is open elsewhere; the loading spinner never ends against a stopped tool server.

**Phase to address:** P-STACK.

---

### Pitfall 4: Treating "no data" as an empty list (SUCCESS without `meta_data`, simulated tools, wrong `kind`)

**What goes wrong:** A SUCCESS reply is not necessarily a list. In simulated mode the base server sleeps for the estimate and returns SUCCESS with no `meta_data` at all (`tools/base_server.py:138-146`); STACK's `_result_reply` maps a non-allowlisted `kind` to `ERROR_FROM_TOOL` but still attaches `meta` (`stack/server.py:688-699`); `Tool.executeCommand` returns `undefined` when `return_reply` is unset (`tools.ts:627`). If "missing `plates`/`devices`" is rendered as "no plates registered", the operator sees an empty dropdown as the instrument's answer and may conclude nothing is registered; or, worse, the fallback input is hidden because the list "loaded".

**Why it happens:** `plates: []` is a legitimate answer per the contract; code paths conflate absent key and empty array.

**How to avoid:** Validate with a strict parser per source: require `meta_data` object, require the expected `kind` (`deviceTree`, `robotStates`, `labwareProfiles`, `transferProfiles`; for F.A.S.T. the `plates` key present and an array), cap array length and string length, require `typeof name === "string" && name.trim() !== ""`. Anything else is `unavailable`, never `ok` with `[]`. Only a validated `[]` is "none registered". Tests: SUCCESS-no-meta, wrong-kind, `plates` missing, `plates: []`, 10k-item list, 1 MB string.

**Warning signs:** A simulated STACK/F.A.S.T. shows an empty enabled select instead of the text-input fallback; unit tests never construct a reply without `meta_data`.

**Phase to address:** P-STACK (parser harness), P-FAST (plates parser).

---

### Pitfall 5: Stale lists after a manager reconfig (three cache layers)

**What goes wrong:** There are three places a list can be stale: react-query's client cache, a short server-side `Map` cache in galago-core, and the adapter's own knowledge snapshot (`list_devices`, `list_labware_profiles`, `list_transfer_profiles` take `refresh`; `get_robot_states` is never cached upstream, `stack/server.py:1027-1045`). After the operator reconfigures the STACK manager (adds a nest, recalibrates, renames a labware profile) or Configures the tool at a different endpoint, a nest/profile that no longer exists is still offered, and one that does exist is missing. The danger is physical: the operator picks a stale physical choice.

**Why it happens:** Each layer has its own TTL; nothing ties the galago-core caches to tool Configure/edit/delete (`routers/tool.ts:258` edit, `:313` delete, `:461` clearToolStore, `:466` configure). Also `refresh: true` fixes only the adapter layer, not galago-core's.

**How to avoid:** Key both caches by `toolId` + a per-tool "configure generation" that the `tool.configure`, `tool.edit`, `tool.delete` and `clearToolStore` routes bump (drop that tool's server cache entries and invalidate the client queries). Keep server TTL short (seconds), and make Refresh bypass the server cache **and** send `refresh: true` to the adapter in the same action. Never serve a cached list when the live read failed (offline = fallback input, not last-known list: the FEATURES.md anti-feature and the contract's open point). Show "from instrument, N items, fetched hh:mm:ss" so staleness is visible. Never auto-refresh while a STACK step runs (each refresh hits the PAC manager REST API that the running Transfer's wait loop also uses; MEDIUM confidence, avoid the load).

**Warning signs:** The list changes only after a page reload; Configure at a new host still shows the old host's nests; the timestamp line is absent.

**Phase to address:** P-STACK (cache design), P-FAST (plates inherits it).

---

### Pitfall 6: Ambiguous names across devices (`DeviceTree.ambiguous`)

**What goes wrong:** `list_devices` returns `deviceTree` with `devices[].decks[].nests[]` plus `ambiguous: string[]` of path strings (`"device"`, `"device/deck"`, `"device/deck/nest"`; see FEATURES.md and `vendor/galago-tools/.planning/phases/04-.../04-RESEARCH.md:136`). Two live devices can both report `"deck1,A1"`. The adapter refuses an ambiguous triple rather than first-matching (STACK.md). Failure modes in the UI: (a) de-duplicating or keying by name, which silently addresses the wrong device or hides one; (b) building the nest list by name across devices instead of under the chosen device; (c) merging the decks of two same-named devices under one device option; (d) sending `unifiedName` (display text) instead of the `deviceName/deckName/nestName` triple; (e) building the path key with `/` as separator when a name contains `/`, so membership in `ambiguous` mis-matches; (f) React keys by name causing the wrong row to be selected.

**Why it happens:** Names look like identifiers. The cascade is naturally written as `Map<name, ...>`.

**How to avoid:** Build the option list from the tree positionally (device index, then deck index, then nest index) and carry each option's `{deviceName, deckName, nestName}` and path key; compute ambiguity by exact membership of a canonical path key (unit-test with names containing `/`); mark ambiguous options visibly ("ambiguous, adapter will refuse") and do not collapse, hide, first-match, or silently auto-disable (the adapter is the gate; galago-core does not state-check). Use index-suffixed React keys. The value written to the form is only the plain name; selecting a duplicate-named device must show a warning for the whole subtree because the name does not identify it. Golden-JSON fixtures: duplicate device names, duplicate nest under different decks (not ambiguous), ambiguous at device level.

**Warning signs:** Fixture with two devices named identically yields one option; the nest select shows nests of both devices; a test only has unique names.

**Phase to address:** P-STACK.

---

### Pitfall 7: Dropping or rewriting a saved value that is not in the current list

**What goes wrong:** Saved steps must load unchanged and send exactly what was saved. Silent rewriting happens through: (a) a `useEffect` that resets child fields when the option list changes (the first list load or a Refresh wipes a hydrated step; `pages/tools/[id].tsx:88-111` already re-initialises all `formValues` in an effect keyed on `selectedCommand`, so a naive cascade reset is one line away from the same bug); (b) a controlled `<select value={saved}>` whose value is not among the options: the DOM shows the first option or blank while state still holds the saved value (MEDIUM), so the operator sees "nothing" or a wrong item and re-picks, or, with `onChange` firing on a visually unchanged option, never re-picks; (c) normalising on load (trim, case-fold, fuzzy-match to a listed name); (d) `handleSubmit` fill-ins: `AddToolCommandModal.tsx:210-224` writes `0` for every undefined number field and `""` for text, so previously saved F.A.S.T. steps legitimately hold plate id `0` and STACK steps hold `""` (they will all show "not reported"); (e) `parseFloat(value) || 0` (`AddToolCommandModal.tsx:483`) converts a cleared number to 0 and `Number("{{x}}")` is NaN; (f) the edit drawer `CommandDetailsDrawer.tsx:210-260,428` is a third host that renders any param as free text and would save `source_plate_id` as the string `"12"`, so numeric id equality must use `String(a) === String(b)`.

**Why it happens:** Dropdowns invert the data flow: options drive value, rather than value driving display.

**How to avoid:** Reset children only inside the parent's `onChange` handler, never in an effect on options. Always render an extra "(saved) X, not reported by the instrument" option for a value absent from the list, keep it selected, and show a warning; never block Save or Send (the instrument validates). Compare as strings. Treat `""`/`0`/`undefined` as "not chosen" for display only; do not rewrite them on load. Do not touch `handleSubmit`'s existing fill-ins for non-dropdown fields. Decide explicitly whether the edit drawer gets the dropdowns or stays free text, and state it (the cheap, safe option is free text there, with the stale warning not shown). Round-trip tests: hydrate a step with a value not in the list, change nothing, save, assert byte-identical params.

**Warning signs:** Opening and re-saving an old protocol changes its stored params; a hydrated step's child fields are blank after the list loads; a `useEffect` with the options array in its deps.

**Phase to address:** P-STACK (cascade/stale behaviour), P-FAST (numeric ids, `0` legacy).

---

### Pitfall 8: Breaking `{{var}}` substitution

**What goes wrong:** Substitution happens at run time in `Tool.executeCommand` and is whole-string only: `paramValue.startsWith("{{") && paramValue.endsWith("}}")` then a DB lookup by name (`server/tools.ts:429-440`). The protocol modal marks a field as a variable via `isVariableReference` and a companion "No Variable" `<Select>` (`AddToolCommandModal.tsx:256-282,467-500`). A dropdown breaks this when: (a) the select has no option for `{{x}}`, so the bound variable is invisible; (b) the plate field coerces to `Number(...)` before the value reaches substitution (`{{plate}}` becomes `NaN`/0 on the wire, silently); (c) the variable companion select is dropped from the new component; (d) a child list is filtered by a parent that is a variable (unknowable at edit time); (e) the read layer validates the bound variable's value against the list; (f) an instrument-reported name that itself looks like `{{...}}` is substituted at run time (a name `{{x}}` from `list_devices` is untrusted data: it would be replaced by a variable's value, redirecting a physical move).

**Why it happens:** The new component owns the field and forgets the existing variable mode, which lives in the host, not the field.

**How to avoid:** The shared field component takes `isVariable` from the host: when bound, the picker is disabled and shows "Using variable" (exactly like the number field today), and the companion variable select stays. Never validate or coerce a `{{...}}` value; for plate ids coerce only a value the operator chose from the list. A bound parent makes children plain text inputs. At the read layer, flag any option whose name matches `/^\{\{.*\}\}$/` as unselectable (log it); never write it into a form. Tests: step with `{{plate}}` round-trips unchanged, executes through `Tool.executeCommand` with substitution, and the dropdown never rewrites it. The tool page has no variable UI today; do not add one.

**Warning signs:** A variable-bound field shows an empty picker; the saved JSON contains `0` where `{{plate}}` was; the shared component has no `isVariable` prop.

**Phase to address:** P-STACK, P-FAST.

---

### Pitfall 9: Preselecting a physical choice (labware profile, nest, plate, robot)

**What goes wrong:** Core value and v1.2 Out of Scope: nothing preselected. Typical leaks: auto-selecting the only option "to save clicks" (a lone `robot` or one labware profile); `useEffect` that sets a default after load; remembering the last used value (localStorage or react-query cache); the native-select quirk where a missing placeholder shows the first real option while state is empty (MEDIUM): the operator believes "Robot A" is chosen but the value is blank or stale; Chakra `defaultValue`; "Same as source" auto-fill for the destination; the number input's visible `0` (`AddToolCommandModal.tsx:477-478` renders `0` when undefined, which for F.A.S.T. plate ids is a de facto default of "plate 0" and goes to the wire: tool-page F.A.S.T. sends params verbatim, `pages/tools/[id].tsx:178-189`, and `"" >>> 0` is 0 in protobufjs int32).

**Why it happens:** Convenience features and framework defaults.

**How to avoid:** Placeholder `<option value="">` always present; no `defaultValue` anywhere in the new field spec; the options list never influences state without an operator event; no persistence of chosen values outside the saved step. Keep the existing born-empty pins and **amend** (do not delete) `commandFields.test.ts` and `staticScan.test.ts` to allow a dynamic select but still forbid `defaultValue`, auto-select-on-single, and any `useEffect` that calls the form setter from option data. For F.A.S.T. plate ids, "not chosen" must display as blank (not `0`) and the Send path must refuse sending an unchosen plate id from the dropdown form (client-side required-field check is an input validation, not an instrument state check).

**Warning signs:** One-item list shows the item selected; first-open form has a non-empty value; a test asserts on a selected value right after load.

**Phase to address:** P-STACK, P-FAST.

---

### Pitfall 10: The submodule re-pin: protos are a no-op, but runtime semantics live in the deployed tool server (auto-mint)

**What goes wrong:** Verified: `git diff bcbbf8e 4ccd3da -- interfaces` is empty, so `controller/gen-interfaces/.../stack.ts` should not change [V]. But the pin range is 187 files and 44k lines (mostly `.planning`; real code: `tools/stack/server.py` +1259, new `tools/stack/ledger.py`, runbooks, tests). Commit `0604348` makes the STACK adapter mint a step key whenever a Transfer arrives with a blank/unset `step_key` (`stack/server.py:275-282`, `:1100-1106`). That is a deployed-adapter behaviour; galago-core's pin does not carry it, but UAT, the live proof and "ledger one-shot safety" reasoning all depend on which galago-tools build is running. Consequences: (a) galago-core never mints keys (modal saves `step_key: ""`, `omitBlankParams` drops blanks), so every blank-key dispatch gets a **fresh** key and the ledger cannot refuse a re-send of the same queue row, e.g. the "upstream retry" of a FAILED row on next Start (`SqliteQueue.fail` keeps it queued, `SqliteQueue.ts:514-529`; Start listing says "retried first", `queueStartListing.ts:35-43`). The todo's constraint 2 ("nothing may re-send or duplicate a key") and acceptance "per-key one-shot safety intact on both tools" are vacuous for blank-key steps. (b) `.gitmodules` has `branch = feat/stack-tool`: `git submodule update --remote` or a loose checkout moves past `4ccd3da` (the branch will receive `get_plates` too). (c) regenerating with `controller/node_modules` ts-proto 1.153.2 corrupts `tool_base.ts` (PROJECT.md).

**How to avoid:** Pin by SHA only (`git -C vendor/galago-tools checkout 4ccd3da`, commit the gitlink; never `--remote`). Regenerate with the scratch-dir ts-proto 1.151.1 and an explicit `--plugin=`; the acceptance check is `git diff --stat controller/gen-interfaces` empty (STACK.md) and a diff of exactly `get_plates` for the second re-pin (assert `expected_tray_id = 13` still in `fast.ts`). Record the deployed galago-tools SHA and whether auto-mint is live in every UAT/live-proof note. For the lanes proof, use **explicit, distinct** `step_key` values per leg so the ledger actually has something to prove; keep a unit test that counts sends per queueId (never twice). Do not add key minting in galago-core: that is a galago-tools ledger design decision, out of scope here.

**Warning signs:** Non-empty diff under `controller/gen-interfaces`; `git submodule status` shows a SHA other than the intended one; live-proof protocol has blank `step_key`s.

**Phase to address:** P-STACK (re-pin mechanics), P-FAST (second re-pin), P-LANE-3 (explicit keys).

---

### Pitfall 11: Struct numbers arrive as doubles; the contract says "truncates"

**What goes wrong:** The adapters build replies with `Struct.update()` so every number is a double (`stack/server.py:445-454`; 04-RESEARCH: `deviceCount: 3.0`, `code: -9001.0`). In TS the decoder yields JS numbers, so `12.0` is `12`, but: (a) the contract says galago-core "truncates and checks that each id is an integer ≥ 1": truncating first turns `12.7` into plate 12, a different physical plate, with no error; (b) `NaN`, `Infinity`, `-0`, `1e21`, a numeric string `"12"`, and booleans pass naive `Number(x) | 0` or `parseInt`; (c) `z.number().int()` is fine but `z.coerce.number()` is not (it turns `""`, `null`, `true` into numbers); (d) the plate-id select value is a DOM string and must be converted back to a number exactly once, from the list's own value, not re-parsed from the label; (e) display formatting (`workingCapacity: 200.0` rendering as "200.0") and sorting by string.

**How to avoid:** Reject (drop the item and mark the list degraded) any id for which `!(typeof id === "number" && Number.isInteger(id) && id >= 1 && id <= 2147483647)`; do not truncate. Ask galago-tools to state the same rule in the frozen contract. For a plate present in the list, store `id` from the validated number, keep the option's `value` as `String(id)`, and map back via a lookup table, not `parseFloat`. Test matrix: `12`, `12.0`, `12.7`, `0`, `-1`, `NaN`, `"12"`, `null`, `2**31`, duplicate ids (duplicates make the list ambiguous: flag, do not collapse).

**Warning signs:** `Math.trunc`/`|0`/`parseInt` anywhere in the plates parser; a test with only integer-valued ids.

**Phase to address:** P-FAST (parser), P-STACK (any numeric display).

---

### Pitfall 12: The second lane overwrites the single-slot per-attempt state (abort marker, late-reply token, running step)

**What goes wrong:** The queue keeps per-attempt state in single fields: `_runningStep` (`command_queue.ts:74`), `_abortAcceptedQueueId` (`:83`), `_failedAttempt` (`:91`). The busy loop resets two of them for every dispatched row: `this._abortAcceptedQueueId = undefined` (`:1010`) and `this._failedAttempt = undefined` (`:1013`). With two loops, lane B's dispatch wipes lane A's abort marker. Concrete trace [I from V code]: operator Aborts the F.A.S.T. step in lane A (`toolControl` -> `_recordAcceptedAbort` sets `_abortAcceptedQueueId = A`, `:639-643`); lane B's loop wakes and dispatches its next row, resetting the marker; the F.A.S.T. step then ends with an error, the catch reads `abortAccepted === false` (`:1380`), calls `commands.fail` (row stays queued, `:1408`), and the **next Start re-runs the aborted step and the rest of the run**: precisely what T-01-08 exists to prevent. The same overwrite hits `_failedAttempt` (late abort reply token) and `_runningStep` (`:1359`, then `= undefined` at `:1365` when the STACK step finishes while F.A.S.T. still runs, so the F.A.S.T. step is no longer controllable or visible).

**How to avoid:** Replace the three fields by `Map<queueId, ...>` / per-lane records (`RunningStepRecord { step, abortAccepted, failedAttempt }`) keyed by queueId, set and cleared only by the owner loop. A dispatch must never reset another row's marker. Move the "fresh marker per command" reset to "delete this queueId's entry". Keep the layers (a) to (c) of `_recordAcceptedAbort` semantically identical, per queueId. Tests (deterministic, using `deferred()` from `test/helpers/fakeTool.ts`): abort accepted on A, B dispatches and completes, A then fails: A's run is dequeued, not retried; and the reverse order.

**Warning signs:** Any `this._xxx = undefined` reset in the loop that is not keyed by the current row; a lane test that only checks a single abort with no concurrent dispatch.

**Phase to address:** P-LANE-1.

---

### Pitfall 13: `RunStateMonitor.start()` kills the F.A.S.T. poller when a STACK step starts

**What goes wrong:** `RunStateMonitor.start` calls `this.stop()` first (`server/runState.ts:126-128`) and only then checks whether the tool type has a `runControl` entry (`:130`). `runControl` declares only `fast` (`server/runControl.ts:34-40`). In the target scenario, lane A's F.A.S.T. Transfer is running with its poller; lane B dispatches a STACK step: `start(stackStep)` stops the F.A.S.T. poller (`:158-166`, envelope becomes `{ running: false }`) and returns without starting another. The run-page control bar disappears, and `stopInterception.shouldInterceptQueueStop` (`components/runs/stopInterception.ts:16-20`) sees no controllable step, so **Clear All / Stop no longer abort first** while the F.A.S.T. is physically running: exactly the untracked-run failure Phase 2 fixed. Independently, one monitor means one `inFlight` flag (`:119`) and one `generation` counter; two overlapping controllable steps would stomp each other.

**How to avoid:** One `RunStateMonitor` per running controllable step, owned by that step's record (keyed by queueId); `start()` on one must never `stop()` another; a step with no `runControl` creates no monitor and touches no other. `commandQueue.runState` returns the set of running controllable steps (each with queueId), and the UI reads the whole set. Keep `useRunControl` the single reader (`staticScan.test.ts:215` pins it). Test: F.A.S.T. running, STACK step starts and ends, F.A.S.T. envelope still `running: true` throughout.

**Warning signs:** Control bar flickers off when a second lane starts; `runState` returns `{ running: false }` while `runningStep` is defined.

**Phase to address:** P-LANE-1 (monitor ownership), P-LANE-2 (UI over the set).

---

### Pitfall 14: Operator control surface assumes one running step (`toolControl`, `recoveryControl`, Stop/Clear All)

**What goes wrong:** (a) `toolControl` targets `this._runningStep` (`command_queue.ts:530`) and the router deliberately has "no tool id field: the target is always `runningStep`'s tool" (`routers/command_queue.ts:145-149`). With two running steps "the" running step is whichever wrote last, so Pause/Resume/Abort may reach the wrong tool; a `return_liquid` decision meant for the F.A.S.T. could be validated against a STACK step and refused, or sent to the wrong target. (b) `recoveryControl` gates STACK acknowledge on one `runningStep` (`server/recoveryControl.ts:59`, passed at `routers/tool.ts:533`): with two steps it must refuse if **any** running step is on that tool. (c) Stop, Clear All and run delete intercept with a single envelope (`stopInterception.ts:27-32`); with two controllable steps one abort is requested and the other keeps running untracked; with a STACK step running (no abort exists for STACK, `runControl` has no `stack`), Clear All today just removes rows (v1.1 behaviour) and the dialog must say the STACK step cannot be aborted and will finish. (d) Server-side `clearAll`/`stop` have no running-step check at all (`command_queue.ts:876-879`, `:965-995`): abort-first is a UI contract.

**How to avoid:** Target by queueId: `toolControl({queueId, action, params})` resolved only against the in-memory running records (still never a caller-chosen tool; a missing/ended queueId refuses with the existing "no longer running" text). `recoveryControl` takes the full list of running steps. Abort-first dialogs iterate over every controllable running step, one explicit non-defaulted decision each, then act on the queue only after every abort is accepted; the dialog lists uncontrollable running steps (STACK) as "cannot be aborted from here". No timers (UI-08 scan). Keep `controlDecision.ts` pure; extend `test/staticScan.test.ts` single-send-path pins rather than weakening them.

**Warning signs:** `toolControl` input schema unchanged after lanes land; one `InstrumentStopModal` for two running steps; no test with two running records.

**Phase to address:** P-LANE-1 (server targeting), P-LANE-2 (UI).

---

### Pitfall 15: The lane-halt window (failure on lane A while lane B dispatches)

**What goes wrong:** Three windows exist in the current loop shape. (1) The loop checks `state === BUSY` **before** the 1500 ms sleep (`command_queue.ts:1000-1003`), then calls `startNext` after the sleep. A failure on lane A that lands during lane B's sleep still lets B dispatch one more row. (2) A failing row records state only after awaiting the DB (`await commands.fail(...)` at `:1408` or `failAndDequeueRun` at `:1392`) and only then `_recordFailure` + `_setState(FAILED)` (`:1437-1438`); anything B does in between is un-halted. (3) `_runBusyLoop` runs `_setState(FAILED)` only when the **catch** executes; a failure surfaced elsewhere (a `Tool Box` branch throw, e.g. `variable_assignment`, `:1285-1346`; the `_start` catch at `:944-955`) must also halt. And: the halt only stops **new** dispatch. It cannot and must not abort lane B's in-flight step (software-initiated abort is Out of Scope); the operator must be shown that lane B is still running.

**How to avoid:** One dispatch gate (`_haltSeq`/`_halted` flag) that is set **synchronously as the first statement of the catch**, before any `await` (same discipline as `_failedAttempt` at `:1385`), and checked synchronously immediately before `startNext` **after** the sleep, with no `await` between the check and the claim (`startNext`'s transaction is synchronous, `SqliteQueue.ts:112-150`). Conservative rule: **every** failure on any lane closes the gate (no "latch-class" classification: it needs instrument state, which galago-core may not read). The gate is a separate flag from `_state` (see Pitfall 16). Failure UI must say "lane X still running; abort it yourself if you choose". Test: two lanes, B asleep in its 1500 ms delay (fake timers), A fails, advance time, assert B never calls `startNext`/`executeCommand`; repeat with the failure delivered while `commands.fail` is awaiting.

**Warning signs:** The halt is derived from `this.state === FAILED` read at loop top; the gate is set after the DB call; no test fails a lane during the other lane's sleep.

**Phase to address:** P-LANE-1.

---

### Pitfall 16: Something unrelated silently un-halts the lanes (`resume`, `clearError`, `_start`, `clearAll`)

**What goes wrong:** Several existing paths clear the failure and reset state as a side effect: `resume()` clears the error (`command_queue.ts:843-847`) and `clearError` sets state READY from FAILED (`:892-900`); `_start` unconditionally sets READY and `error = undefined` (`:934-935`); `clearAll` clears the error (`:878`); `stop()` ends in OFFLINE (`:994`). Scenario: lane A (primary) sits on a `show_message`; lane B fails and the gate closes; the operator clicks Continue on the message: `resume()` clears the error and returns state to READY, so the halt is gone without an explicit Start. Likewise a per-lane Start of the idle lane clears the error that belongs to the other lane's failed row and un-freezes it. `enqueueRun` auto-starts when `state === READY` (`:1489-1490`), so an enqueue after the implicit clear dispatches into a workcell that is mid-recovery.

**How to avoid:** The halt is its own flag, cleared **only** by an explicit operator Start/acknowledge action that lists the failed rows and the still-running lanes, never by `resume`, `clearError` from a modal, or an enqueue. `resume()` must not call `clearError` while the gate is closed. `enqueueRun`'s auto-start must check the gate. A Start while halted restarts idle lanes only, includes the failed row (retry-first semantics, Start listing says so), and keeps the single-flight refusal for in-flight lanes. Tests for each path: gate stays closed after Continue, after enqueue, after Start of another lane's guard-ignored call.

**Warning signs:** The gate is `state !== FAILED`; the word `clearError` appears in a code path reachable from a modal.

**Phase to address:** P-LANE-1.

---

### Pitfall 17: The single-flight Start guard widened, split badly, or defeated by `await`

**What goes wrong:** The guard is one statement on one field: `if (this._runningPromise) { ... return; }` as the first statement of `_start` (`command_queue.ts:919-926`) with no `await` before the claim (`:942`), pinned by `queueStartGuard.test.ts` ("two Starts in the same tick log one Queue Started"). With lanes: (a) a single global guard blocks the second lane forever (no lanes), or removed entirely (F5 double dispatch); (b) a per-lane guard implemented with an `await` (e.g. reading the DB for the lane list, or `_describeQueueStart`, which is deliberately synchronous, `:906-912`) between check and claim reintroduces the same-tick race; (c) `stop()` awaits one `_runningPromise` (`:968`); with N loops it must await all, and a stale singular field loses the second loop; (d) the restart router computes `accepted = !queue.isStartInProgress` (`routers/command_queue.ts:37-42`): per lane it must report which lanes started and which were ignored; (e) `_start` retries `_recoverInterruptedSteps` when construction's attempt failed (`:941`): that call fails **every row currently STARTED** as an orphan (`SqliteQueue.ts:596-644`). A lane's Start while the other lane's own row is STARTED would fail the live in-flight row (T-o44-04 relies on a single loop); (f) the lane key: tool ids are matched case/punctuation-insensitively everywhere else (`normalizeToolKey`, `server/toolKey.ts:13`; `getToolFromStore`, `tools.ts:44-56`); a lane keyed on the raw `toolId` string puts `"STACK"` and `"stack"` in two lanes and two concurrent submits reach one tool server (STACK refuses the second with `_BUSY_MESSAGE` at best, `stack/server.py:1082-1083`; F.A.S.T. likewise, `fast/server.py:719-720`).

**How to avoid:** Keep the guard as the first synchronous statement, now keyed per lane (`Map<laneKey, Promise>`), with the claim in the same synchronous block; the lane key = `normalizeToolKey(toolId)`; enforce "at most one in-flight step per tool server" at dispatch regardless of lane naming. Run interrupted-step recovery only when **no** lane is running (guard it under "all lanes idle"). `isStartInProgress` becomes "all lanes busy"; add per-lane status for the router/UI. Keep every existing guard test passing **unmodified** with the flag off, and add same-tick two-lane Start tests plus a "Start for lane B while lane A STARTED and recovery pending" test.

**Warning signs:** `await` between guard and claim; `this._runningPromise` still singular; `recoverInterruptedSteps` call sites reachable while a row is STARTED.

**Phase to address:** P-LANE-1.

---

### Pitfall 18: `startNext` is a global FIFO; lane selection can skip rows, reorder a run, or run stale rows from other runs in parallel

**What goes wrong:** `SqliteQueue.startNext` takes the first row of `_queue` by position, whatever its run (`SqliteQueue.ts:112-150`). F5 was exactly "the queue is a single global FIFO that persists across runs; leftover rows from earlier attempts run on the next Start" (`F5-ROOT-CAUSE.md`). A lane-aware `WHERE lane = ? ORDER BY position LIMIT 1` (a) lets lane B jump over rows of the primary lane that have not run yet, so `out1` can run before the F.A.S.T. step finishes (fork/join, FEATURES.md); (b) lets stale rows from an old run on lane B run in parallel with a new run's lane A; (c) skips a FAILED head row that belongs to the other lane, reordering "failed rows are retried first" (`queueStartListing.ts:35-43`); (d) interacts with `gotoCommand`/`gotoCommandByIndex` which re-queue rows by position (`SqliteQueue.ts:152-300`); (e) reads `lane` from the JSON in `command_data`, so a lane read per `startNext` is a `json_extract` or a full deserialise.

**How to avoid:** Lanes exist **within one run only**: lane selection is scoped to the run of the oldest unfinished row; rows of other runs wait until that run drains. Define the fork rule as "a lane-tagged step dispatches when the previous step in run order has been dispatched/finished per the join rules" and add the explicit `join` step to the minimum (FEATURES.md); never dispatch past an unfinished earlier row of the same lane, nor past a FAILED row. The Start confirmation and `describeQueueStart` list rows per lane. Keep a legacy `startNext()` (no lane) as the exact current code path for flag off.

**Warning signs:** A test where a stale row of another run runs concurrently; `startNext(lane)` that ignores `run_id`; no join test.

**Phase to address:** P-LANE-1 (selection), P-LANE-2 (join step, listing).

---

### Pitfall 19: Draining one lane stops all lanes (`this.stop()`, global `state`, end-of-loop READY)

**What goes wrong:** When `startNext` returns nothing the loop calls `this.stop()` (`command_queue.ts:1005`), which sets the global state to OFFLINE (`:966`, `:994`); every loop gates on `state === BUSY` (`:1000`), so lane A draining ends lane B's loop at its next check, stranding lane B's queued rows silently (no error, no log), and `stop()` awaits the singular `_runningPromise` (`:968`), which for A is the very loop calling it. The loop tail and `_start` finally also set READY from BUSY (`:957-960`, `:1468-1470`), so lane A ending flips the global state to READY while lane B is still running; `enqueueRun` (`:1489`) then auto-starts into a "READY" queue.

**How to avoid:** Lane drain ends only that lane (its own `return`, no global `stop()`); global state is derived: BUSY if any lane runs, FAILED if the gate is closed, READY/OFFLINE otherwise; the operator "Pause queue" (global stop) is a separate, explicit path that awaits all lane promises. Run is complete when every lane has drained. Test: lane A drains while B has a pending row and a running step: B's step completes and B continues.

**Warning signs:** `this.stop()` in the lane loop; `state` read inside a lane loop as the only continue condition.

**Phase to address:** P-LANE-1.

---

### Pitfall 20: Modal, timer, assignment and skip-variable entanglement across lanes

**What goes wrong:** Non-tool steps (`pause`, `user_form`, `show_message`, `timer`, `stop_run`, `variable_assignment`, `goto`, `note`) share single fields: `_isWaitingForInput`, `_currentMessage`, `_messageResolve`, `_timerTimeout` (`command_queue.ts:99-106`). `_ensureModalReady` **resolves a previous pending modal** and sleeps 1000 ms before showing the next (`:439-461`): a second lane showing a modal would silently release the first lane's blocking message. `goto` re-queues rows globally (`:1271-1284`). `variable_assignment` is read-modify-write across several awaits (`:1299-1329`), and tool dispatch substitutes `{{var}}` from the DB at execute time (`tools.ts:433-440`), so an assignment on one lane races a dispatch on the other. `skipExecutionVariable` does DB reads with a `continue` that skips the 1500 ms cadence (`:1023-1051`).

**How to avoid:** Non-tool steps run only on the primary lane (the todo's recommendation), **enforced**, not documented: refuse a non-tool step with a non-primary lane at run creation and at enqueue with `BAD_REQUEST` (the same pattern as the operator-only refusal in `run.create`, PROJECT.md), and again defensively at dispatch. Define join semantics so that a primary-lane `show_message`/`pause` is a barrier for the other lane's new dispatch (an operator-visible modal must not be bypassed by a second lane dispatching motion under it), or state explicitly that it is not; decide in P-LANE-1 discussion. `skipExecutionVariable` is evaluated lane-locally at that lane's dispatch time, documented as such.

**Warning signs:** A lane field accepted on a `Tool Box` step; a shared `_messageResolve` used from two loops.

**Phase to address:** P-LANE-1 (rules), P-LANE-2 (creation-time refusal).

---

### Pitfall 21: A tool-initiated pause on one lane does not freeze the other (decision needed)

**What goes wrong:** The lane-halt in the todo triggers on a step **ending in failure**. A F.A.S.T. Transfer can instead enter a tool-side pause (`run_state.pause` with `errorName`/`eventPayload`, `server/runState.ts:76-92`) with the step still open and unfailed: the `tool_paused` prompt appears on the run page (the operator must decide resume/abort, e.g. a broken tip). Meanwhile lane B's next STACK step still dispatches, moving the arm while the operator inspects the F.A.S.T. This contradicts the stated intent of constraint 3 (never share the space with a second running tool during recovery), but gating dispatch on `run_state` is a "state check", which the project forbids (UI-08 scans: `staticScan.test.ts:358-371`, "no state checks").

**How to avoid:** Surface this as an explicit decision in the P-LANE-1 discussion, not an accident: either (1) accept and document that only failures halt, and make the `tool_paused` prompt state "lane X is still dispatching" with an operator-visible lane freeze control, or (2) add an **operator-initiated** "freeze lanes" toggle (explicit operator action, not a poll-driven gate). Do not wire a poll-driven gate into dispatch without a recorded deviation from the no-state-checks decision and the user's sign-off.

**Warning signs:** `runState` is read inside `_runBusyLoop`; the live-proof plan never induces a pause.

**Phase to address:** P-LANE-1 (decision), P-LANE-3 (observe in proof).

---

### Pitfall 22: Single-slot error state hides the first failure (the one carrying the guid)

**What goes wrong:** `error` is one field and `_recordFailure` overwrites it (`command_queue.ts:67`, `:434-437`); `getError` returns that one (`routers/command_queue.ts:46-51`); the run-page banner re-arms on `failureSeq`. With lanes, failure on A closes the gate; lane B's in-flight step later also ends in failure, overwriting A's message. STACK errors carry the guid the operator needs for the audited acknowledge (v1.1 ERR-01..05, DEP-03a), so the earlier failure's guid can vanish from the banner. `_notifyFailure` keeps one `_lastAlertKey` (`:231-236`), so alternating failures defeat the 60 s dedupe and produce alert storms.

**How to avoid:** Keep failures per lane (or a bounded list) and render all unacknowledged ones; never let a later failure replace an earlier one; `failureSeq` still bumps per failure so the banner re-arms. Make the dedupe key a Map keyed by the full key. Tests: A fails, then B fails: both messages reachable from `getError` payloads.

**Warning signs:** `getError` returns a single object after the lane work; a test with only one failure.

**Phase to address:** P-LANE-1 (state), P-LANE-2 (banner).

---

### Pitfall 23: Evidence ordering: rows and logs imply a total order, and the F5 evidence method breaks

**What goes wrong:** Run-page code assumes one running row and a linear order: `commandInfo.find(STARTED)?.startedAt` (`components/runs/utils.ts:32-33`), `runOutcome` `hasStarted` (`runOutcome.ts:32-50`), `RunsComponent.tsx:287`, gantt pulse (`RunQueueGanttChart.tsx:332-346`). Log lines are not attributable: `Command Executed` is the fixed text "Command executed successfully." with no queueId/tool (`command_queue.ts:1368-1372`), and F5's forensic method relied on strictly alternating `Tool Command Execution` / `Command Executed` pairs (`F5-ROOT-CAUSE.md`). With two lanes that pairing is gone, so a double-dispatch becomes undetectable by log inspection. Rows' `startedAt`/`completedAt` come from `setRunStatusWithTimestamp` and are per row, but the UI draws one list.

**How to avoid:** Add `queueId`, `runId`, `toolId`, lane to **every** queue log line (Executing, Command Executed, Command Failed, Started, Ignored); render rows grouped per lane with each row's own timestamps and no cross-lane ordering claim; show overlap explicitly; derive run outcome from all rows (existing rule: FAILED precedence; `RunStatus` not widened). A test counts `Tool.executeCommand` calls per queueId under two lanes (exactly 1) and asserts the logs carry the id.

**Warning signs:** Log lines identical for two lanes; a run page that picks the first STARTED row.

**Phase to address:** P-LANE-1 (logs), P-LANE-2 (page).

---

### Pitfall 24: Flag-off byte-identity regressions

**What goes wrong:** "Byte-identical sequential behaviour with the flag off" is broken by refactors that look neutral: (a) rewriting the busy loop as a generic per-lane function changes await/microtask ordering and the number of `setTimeout` calls, so fake-timer tests and real timing shift; (b) writing a `lane` key (even `undefined`/`null`) into `command_data` JSON changes persisted rows and `SqliteQueue._serialize` output; protocol modal and script paths always write `runAsynchronously: false` (`AddToolCommandModal.tsx:221-232`, `runs.ts:117`, `protocol-script-executor.ts:30`), so a lane field added by default alters every saved step; (c) the flag read at `_start` time per call vs once: toggling mid-run flips behaviour in flight; (d) new `runState` envelope shape (array/extra keys) breaks the single-reader hook and static scans even with the flag off; (e) the flag's planned home `.planning/config.json` (todo) is GSD tooling config, not shipped in the image or read by the app (FEATURES.md): the "flag" would never be read in production (or worse, is read from the cwd and differs between dev and the container); (f) the new log fields change existing log text pinned by tests.

**How to avoid:** Keep the legacy code path literally intact (same function, same awaits) and branch to the lane engine only when the flag is on; read the flag **once** at `_start` and pin it for that start's lifetime; never write a `lane` key unless the protocol sets it and the flag is on; keep the existing envelope shape when the flag is off (add the set shape only on the new path). Source of truth: an env var or app setting read through the existing settings seam. Gate: the entire existing suite (`queueStartGuard`, `queueRestart`, `queueError`, `runOutcome`, `toolControl`, `stopInterception`, `runState`, `staticScan`) passes **without a single edit** with the flag off; add a golden test that runs a 3-step single-tool run flag-off and compares the exact ordered `logAction` call list and row transitions to a recorded baseline.

**Warning signs:** Any existing test modified in the lanes PR; `lane` appears in snapshots of single-tool rows; the flag name only exists in `.planning/config.json`.

**Phase to address:** P-LANE-1 (code path), P-LANE-2 (protocol surface).

---

### Pitfall 25: Timing-dependent tests for two loops (flakiness)

**What goes wrong:** The loop has a hard 1500 ms cadence (`command_queue.ts:1002`), `_ensureModalReady` a real 1000 ms sleep (`:458`), `resume` a 50 ms `setTimeout` (`:858`), the monitor a global `setInterval` (`runState.ts:153`). Existing tests drive them with fake timers and `advanceTimersByTimeAsync(1500)` (`queueStartGuard.test.ts:60-130`) with a single loop. Two loops make the order of `startNext` calls timer-order dependent: assertions like "B starts while A runs" pass or fail on tie-breaking, and a missed `advance` leaves a loop mid-sleep into the next test. Other leak vectors: the global singleton `__global_command_queue_key` (`:1495`) and the in-memory SQLite DB shared across `it`s; unresolved `deferred()` steps leaving loops alive; real timers used for one lane and fake for the other.

**How to avoid:** Make the loop delay an injectable constant (default 1500) so lane tests run it at a deterministic small value or advance in explicit single steps; drive ordering with `deferred()` gates, not elapsed time; assert on state transitions (what was called, in what order), never on wall time; one `afterEach` that resolves all deferreds, advances timers, awaits all lane promises, deletes the global queue key, and removes fake tools (pattern at `queueStartGuard.test.ts:60-72`, extend for N loops); a dedicated "lane-halt window" test that fails A during B's sleep; run new suites 20x in CI (`--repeat`/loop) before merging. No motion and no real gRPC: `installFakeTool` only.

**Warning signs:** `vi.advanceTimersByTimeAsync(3000)` guesses in a two-lane test; a test passes alone but not in the full suite; orphan loops after a failed test.

**Phase to address:** P-LANE-1 (harness first), every later lane phase.

---

### Pitfall 26: The live proof cannot prove what the acceptance says (no "goto-safe" command, blank keys, shared motion lock)

**What goes wrong:** (a) The frozen `stack.proto` has ten commands and none is a goto-safe (`transfer`, five reads, `get_labware_presence`, `get_transfer_estimate`, `acknowledge_failure`, `get_failure_latch`, `stack.proto:8-19`), and the proto is frozen/out of scope. The STACK sibling skill states the transfer performs its own safe-position move. So the "STACK goto-safe overlapping a 73 s F.A.S.T. transfer" step is undefined: it can only be a real STACK `transfer`, or a STACK read that overlaps trivially. (b) Per-tool `_MOTION_LOCK` is a module-level lock per adapter (`stack/server.py:106`): any second STACK Transfer during an in-flight one is refused with BUSY; a lane design that allows two steps on the same toolId would fail in the live run (and with fast: `fast/server.py:719-720`). (c) With adapter auto-mint (Pitfall 10), the "ledger per-key one-shot intact" acceptance is only meaningful with explicit step keys. (d) A latched-failure drill to prove lane-halt would induce a real latch on live hardware.

**How to avoid:** Resolve the overlapped step definition in the P-LANE-3 discussion **before** coding (what STACK command runs during the F.A.S.T. window, and what physically happens), with the user. Prove overlap in automated tests with `installFakeTool` (no motion), prove lane-halt in tests plus a simulated tool drill, and use the live run only for the overlap and per-lane evidence rows, with explicit distinct step keys, operator present and a typed GO, recording the galago-core and galago-tools SHAs. Never run motion from tests (Out of Scope).

**Warning signs:** The proof protocol has blank `step_key`; the plan says "goto-safe" without naming a proto command; the live proof is the first time lane-halt is exercised.

**Phase to address:** P-LANE-3 (decision gate at discussion), P-LANE-1 (automated proofs).

---

## Moderate Pitfalls

### Pitfall 27: Lane field typos and implicit defaults

**What goes wrong:** An unknown or differently-cased `lane` value silently becomes the primary lane or spawns an unintended lane; `advancedParameters` objects built by the modal, the script executor and `runs.ts:100-117` default branches lack `lane`.
**Prevention:** Normalise through one function (`normalizeToolKey` for tool-keyed lanes), validate against the run's declared lanes at run creation (`BAD_REQUEST` naming the bad value), render the effective lane in the preview and the Start confirmation.
**Phase:** P-LANE-2.

### Pitfall 28: Dispatch order of lane starts and the preview/Start listing lie

**What goes wrong:** `protocol.preview` and `describeQueueStart` list a flat order (`queueStartListing.ts:21-60`), so the operator confirms Start on text that does not say which rows overlap, which lane each runs in, or which stale rows from other runs are included.
**Prevention:** Per-lane sections in both; stale rows from other runs called out; test snapshots.
**Phase:** P-LANE-2.

### Pitfall 29: `toolId` vs `toolType` as the lane key

**What goes wrong:** `toolType` lanes put two STACK tool instances in one lane (serialising what could overlap); raw `toolId` lanes split one tool across spellings (Pitfall 17f).
**Prevention:** Lane = `normalizeToolKey(toolId)`; the primary lane is the lane of the first step of the run, not a hard-coded tool.
**Phase:** P-LANE-1.

### Pitfall 30: Shared `Tool.executeCommand` mutates `params` and logs full params for reads

**What goes wrong:** If reads reuse it, `params` objects shared between react-query and the call are mutated in place (`tools.ts:433-440`) and every read logs an audit row with its params.
**Prevention:** Fresh params object; dedicated read method (Pitfall 2).
**Phase:** P-STACK.

### Pitfall 31: Direct-read path and a Tool that is not in the store

**What goes wrong:** `Tool.executeCommand` throws "Tool X not found in store" (`tools.ts:393-410`) when the tool was never configured in this process; `latchStatus` avoids it with `getToolFromDB` + `Tool.forId` (`routers/tool.ts:550-553`), which also creates a Tool and starts a 5 s heartbeat for any id.
**Prevention:** Resolve by DB record first, reject unknown ids (do not create Tools for arbitrary client-supplied ids), map not-connected to `unavailable`.
**Phase:** P-STACK.

### Pitfall 32: `robot` select feeding `get_labware_presence` and a lone robot

**What goes wrong:** `get_labware_presence` takes only `robot`; with one robot the temptation to auto-fill it is highest. A blank robot is normalised to None by the adapter (`readFailed`, zero I/O) but `""` would issue a request in the core (04-RESEARCH: "Blank `robot` trap").
**Prevention:** Born-empty; keep `omitBlankParams` on STACK sends (`commandParams.ts`); never send `""`.
**Phase:** P-STACK.

### Pitfall 33: F.A.S.T. `expected_tray_id` and `step_key` must stay out of the dynamic fields

**What goes wrong:** Old saved F.A.S.T. steps still send `expected_tray_id` (fast.proto:32; removed from the form by quick 261104-or1); STACK `step_key` stays a free text field. A generic "dynamic field spec" that rebuilds forms from proto reflection would resurrect or re-type them.
**Prevention:** Field specs are hand-listed per field (`source`, `dependsOn`); `step_key` and `expected_tray_id` are untouched; the scan pins them.
**Phase:** P-STACK, P-FAST.

---

## Minor Pitfalls

### Pitfall 34: Stale-value warning noise
Every pre-existing F.A.S.T. step with plate id `0` or STACK step with `""` shows "not reported". **Prevention:** treat `0`/`""`/undefined as "not chosen" (no warning), warn only for a non-blank value absent from a **successfully** loaded list; never warn when the list is unavailable.

### Pitfall 35: Unstable option ordering and duplicate plate descriptions
Contract says ascending by `id`, but `description` can repeat. **Prevention:** sort client-side by the same key, always show `id` in the label.

### Pitfall 36: `prettier --check` and the production build
`bin/make test` runs prettier, `tsc`, unit tests and `next build` (`bin/make:34-44`); an eslint-disable comment for an undefined rule fatally breaks `next build` (PROJECT.md, bf928c0). **Prevention:** run the full gate, not only vitest, before declaring a phase done.

### Pitfall 37: Windows/ts-proto path differences in `bin/make proto_ts`
`PROTOC_GEN_TS_PATH` is Windows-flavoured (`bin/make:3`). **Prevention:** use the documented scratch-dir recipe (STACK.md), not the Makefile target, on this host.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse `tool.runCommand` for dropdown reads | No new router | Unrestricted command passthrough from a form; audit rows per read | Never |
| One shared `<select>` with no variable/stale/ambiguous handling, polish later | Faster first demo | Each missing mode becomes a silent physical-choice bug (Pitfalls 6-9) | Never; ship the four modes in the first cut |
| Last-known list shown when offline | Form never looks broken | Stale physical choices presented as live | Never (use the fallback input) |
| Truncate Struct doubles instead of rejecting | Tolerant parser | Wrong plate selected silently (Pitfall 11) | Never |
| Keep `_runningStep`/`_failedAttempt` singular and "just add `lane`" | Small diff | Abort marker wipe, hidden controllable step (Pitfalls 12-14) | Never |
| Classify "latch-class" failures in galago-core | Less freezing | Needs instrument state (forbidden); mis-classification leaves a lane live | Never; halt on every failure |
| Per-lane Start implemented with an `await` before the claim | Easier lane lookup | Same-tick double dispatch (F5 class) | Never |
| Flag in `.planning/config.json` | Matches the todo text | Never read in production; dev/prod divergence | Never; use env/app setting |
| Skip the injectable loop delay in tests | No refactor | Flaky two-lane tests that get disabled | Never |
| Defer the `join` step | Smaller scope | Run moves a plate under a pipetting step (Pitfall 18) | Only if lanes ship experimental, flag off, no live use |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| STACK reads over gRPC | Treat `ERROR_FROM_TOOL` "reconfiguring"/"not configured" as a crash | Map to `unavailable`; reads bypass the motion lock and status bracket by design (`stack/server.py:950-986`) |
| STACK `refresh` flag | Send `refresh:true` on every load | Only on the explicit Refresh button; adapter caches `devices`/`labware_profiles`/`transfer_profiles` |
| F.A.S.T. `get_plates` | Trust "no motion lock" | Require the `ExecuteCommand` bypass and a gRPC-path test (Pitfall 1) |
| `Tool.executeCommand` for reads | Reuse the step pipeline | Dedicated read method with deadline and no substitution (Pitfall 2) |
| `bin/make proto_ts` / ts-proto | Use `node_modules` 1.153.2 | Scratch-dir 1.151.1 with explicit `--plugin=`; empty diff on re-pin 1 |
| Submodule | `git submodule update --remote` | SHA pin; verify with `git submodule status` |
| STACK adapter step-key ledger | Assume galago-core "mints" keys | Adapter mints on blank (auto-mint); proofs use explicit keys |
| RunStateMonitor + STACK | Start a monitor for every step | Monitor only for tool types with `runControl`; one per step |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Read per field instead of per source | 8+ gRPC calls per form open | One query per (tool, source), shared cache | Every form open |
| `refetchOnWindowFocus` and `retry: 3` on reads | Read bursts on tab focus; hammering an offline tool | Disable both; explicit Refresh | Offline tool or many tabs |
| No read deadline | Hung request per open | `deadline` of a few seconds | First unresponsive tool server |
| 1500 ms loop cadence per lane | Added latency before each lane dispatch; two loops double DB polling | Keep cadence; do not shorten to "make lanes snappy" | Never a scale issue; a correctness/cost knob |
| `queuedRowsSync()` per Start with lane parsing | Slow Start with big queues | Parse lane once per row; keep the 50-row listing cap | Thousands of queued rows |
| Huge replies | Memory/render stall (a ~3 KB unknown reply already blew a card, G-04-2/6) | Cap item count and string length server-side | Misconfigured manager |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Instrument-reported name equal to `{{...}}` is substituted at run time (`tools.ts:433-440`) | A physical move redirected through a variable | Flag/unselect such options at the read layer |
| Client-supplied `command`/`params` on the read endpoint | Any tool command (including motion) from an unauthenticated tRPC endpoint (no auth on this router) | Allow-list source enum + `refresh` boolean only |
| Interpolating unsanitised reply text into audit `details` | Log forging (`sanitizeLogText`, `logger.ts:6-11`) | Sanitize if ever logged; prefer not to log replies |
| Creating `Tool` instances for arbitrary client toolIds (`Tool.forId` starts a heartbeat) | Resource leak, connections to arbitrary hosts only via DB record | Resolve against DB records; refuse unknown ids |
| Lane-halt implemented as software abort of the other lane | Out of Scope (software-initiated abort) and may itself be harmful mid-pipette | Freeze new dispatch only; operator aborts |
| Server `clearAll`/`stop` mutations callable with a running step | Rows removed under a running step (UI abort-first only) | Keep the UI contract; add running-record audit logging for every lane |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Empty enabled select when the read failed | Operator thinks nothing is registered | `unavailable` shows the plain input + one-line note |
| Ambiguous options hidden or collapsed | Wrong or missing physical location | Show every row, flagged; adapter gates |
| Saved value shown blank | Operator re-picks, changes the protocol unknowingly | Keep saved value visible with a warning |
| Plate labels without `id` | Duplicate descriptions look identical | Always show `id` |
| Halt without telling the other lane is still running | Operator assumes the cell is quiet | Failure banner names every still-running lane |
| One Stop dialog for two running steps | Second step left untracked | One decision per controllable step; list uncontrollable ones |
| Start confirmation without lane or overlap detail | Operator confirms the wrong thing | Per-lane listing with stale rows called out |

## "Looks Done But Isn't" Checklist

- [ ] **Reads layer:** often missing a deadline and the `unavailable` mapping for SUCCESS-without-`meta_data`; verify with a fake tool returning each reply shape.
- [ ] **Reads are not queued:** verify `command_queue_2_commands` row count unchanged after opening both forms, and the static scan forbids `command_queue` imports in the read module.
- [ ] **STACK dropdowns:** often missing the stale-saved-value option; verify a hydrated step with an unlisted value round-trips byte-identically.
- [ ] **Cascade:** often resets in an effect; verify a Refresh does not clear a hydrated child.
- [ ] **Ambiguity:** often only unit-tested with unique names; verify a fixture with duplicate device names and names containing `/`.
- [ ] **`{{var}}`:** verify a variable-bound plate/nest still substitutes at run time and the picker shows "Using variable".
- [ ] **Born-empty:** verify no `defaultValue`, no auto-select on a single option, and F.A.S.T. unchosen plate does not display or send `0` from the dropdown form.
- [ ] **Re-pin:** verify `git diff --stat controller/gen-interfaces` is empty (re-pin 1), contains only `get_plates` (re-pin 2), `expected_tray_id = 13` intact.
- [ ] **F.A.S.T. `get_plates`:** verify a galago-tools test through `ExecuteCommand` during a Transfer, not just the handler.
- [ ] **Doubles:** verify `12.7`, `NaN`, `0`, `"12"`, duplicates are rejected, not truncated.
- [ ] **Lane state:** verify abort-accepted on A survives B's dispatch (Pitfall 12) and the F.A.S.T. monitor survives a STACK step (Pitfall 13).
- [ ] **Lane-halt:** verify a failure during the other lane's 1500 ms sleep stops its dispatch and that `resume`/enqueue/Start-of-other-lane do not reopen the gate.
- [ ] **Start guard:** verify same-tick double Start per lane and the recovery-retry-with-running-row case.
- [ ] **Stop/Clear All:** verify abort-first covers every controllable running step and warns about uncontrollable ones.
- [ ] **Flag off:** verify the existing suite passes with zero test edits plus a golden log/row sequence for a single-tool run.
- [ ] **Evidence:** verify every queue log line carries queueId/lane and a per-queueId send count of exactly 1.
- [ ] **Live proof:** verify explicit step keys, the defined STACK overlap step, operator present, SHAs recorded, no automated motion.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong plate/nest sent from a stale list | HIGH (physical) | Stop; operator inspects; tool-side ledger/latch drill; add cache-generation invalidation before retry |
| Aborted step re-run after a lane marker wipe | HIGH | Operator aborts in tool, Clear All the run, fix marker ownership, add the abort-then-dispatch test |
| Control bar vanished mid-run (monitor killed) | MEDIUM | Operator uses the tool-page Run Recovery card (`tool.recoveryControl`) for the F.A.S.T.; fix monitor ownership |
| Halt cleared by `resume`/enqueue | HIGH | Operator stops lanes (Pause queue), inspects hardware; make the gate an independent flag |
| Re-pin diff in `gen-interfaces` | LOW | Revert the regeneration; redo with the scratch-dir 1.151.1 recipe |
| `get_plates` refused during a Transfer | LOW | Plate input falls back to number entry; ask galago-tools for the bypass |
| Saved protocol silently rewritten | MEDIUM | Restore from backup (`routers/backup.ts`) / git history of the protocol; remove the effect-based reset |
| Flaky lane tests | MEDIUM | Quarantine nothing; inject loop delay, gate by `deferred()`, run 20x |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 `get_plates` bypass gap | P-FAST (gate before re-pin) | galago-tools test through `ExecuteCommand` during a Transfer; BUSY unchanged |
| 2 Read path accidentally queued/lock | P-STACK (reuse in P-FAST) | Row count unchanged; static scan; allow-list input |
| 3 Deadline / react-query / Configure drain | P-STACK | Fake never-resolving gRPC; no refetch on focus; no per-field read |
| 4 No-data vs empty list | P-STACK, P-FAST | Parser fixtures incl. SUCCESS-no-meta |
| 5 Stale after reconfig | P-STACK, P-FAST | Configure bumps generation; Refresh bypasses both caches |
| 6 Ambiguous names | P-STACK | Duplicate-name and `/` fixtures; flagged not collapsed |
| 7 Dropping/rewriting saved values | P-STACK, P-FAST | Byte-identical round trip; no options-keyed effect |
| 8 `{{var}}` | P-STACK, P-FAST | Bound step substitutes at run; picker disabled |
| 9 Preselect | P-STACK, P-FAST | Amended scans forbid defaults/auto-select; unchosen plate sends nothing |
| 10 Re-pin mechanics / auto-mint | P-STACK, P-FAST, P-LANE-3 | Empty/targeted `gen-interfaces` diff; explicit keys in proof |
| 11 Struct doubles | P-FAST | Rejection matrix |
| 12 Single-slot per-attempt state | P-LANE-1 | Abort-then-dispatch test both orders |
| 13 Monitor kills F.A.S.T. poller | P-LANE-1, P-LANE-2 | F.A.S.T. envelope stays running through a STACK step |
| 14 One-step control surface | P-LANE-1, P-LANE-2 | `toolControl` by queueId; recovery gate over all steps; per-step Stop dialog |
| 15 Lane-halt window | P-LANE-1 | Fail A during B's sleep; fail A during `commands.fail` await |
| 16 Halt cleared implicitly | P-LANE-1 | Gate survives `resume`, enqueue, other-lane Start |
| 17 Start guard / recovery / lane key | P-LANE-1 | Same-tick per-lane Start; recovery-retry with STARTED row; `STACK` vs `stack` |
| 18 Global FIFO lane selection | P-LANE-1, P-LANE-2 | Run-scoped selection; join test; stale-row test |
| 19 Drain stops all lanes | P-LANE-1 | Lane A drains, B continues |
| 20 Modal/assignment/skip entanglement | P-LANE-1, P-LANE-2 | Non-tool-on-lane refused at creation and dispatch |
| 21 Tool-pause does not freeze other lane | P-LANE-1 decision, P-LANE-3 observe | Recorded decision (and user sign-off if state-gated) |
| 22 Single-slot error | P-LANE-1, P-LANE-2 | Two failures, both reachable |
| 23 Evidence ordering / logs | P-LANE-1, P-LANE-2 | Logs carry ids; per-queueId send count == 1; per-lane rows |
| 24 Flag-off byte-identity | P-LANE-1, P-LANE-2 | Existing suite unedited + golden sequence |
| 25 Timing flakiness | P-LANE-1 (harness) | 20x repeat; no wall-time assertions |
| 26 Live proof validity | P-LANE-3 | Defined overlapped STACK step; explicit keys; SHAs recorded |

**Research flags for the roadmapper:**
- **P-FAST:** needs a galago-tools precondition gate (Pitfall 1) and is externally blocked until the frozen commit; do not schedule coding of the plate field before the re-pin.
- **P-LANE-1:** needs a discussion phase for three decisions: tool-pause freeze (Pitfall 21), modal-as-barrier (Pitfall 20), and the join encoding (explicit `lane` vs the dead `runAsynchronously` flag).
- **P-LANE-3:** needs a decision on the overlapped STACK step (Pitfall 26) before planning.
- **P-STACK:** standard patterns once Pitfalls 2-9 are encoded in the shared field; unlikely to need more research.

## Sources

- `controller/server/command_queue.ts` (HEAD `60838a9`): loop `:997-1471`, guard `:914-962`, state fields `:64-106`, failure path `:1374-1464`, `resume`/`clearError` `:819-900`, `_ensureModalReady` `:439-461` [HIGH]
- `controller/server/runState.ts`, `runControl.ts`, `recoveryControl.ts`, `routers/command_queue.ts`, `routers/tool.ts`, `tools.ts`, `utils/SqliteQueue.ts`, `utils/promisifyGrpcCall.ts`, `toolKey.ts`, `toolReply.ts` [HIGH]
- `controller/components/protocols/AddToolCommandModal.tsx`, `CommandDetailsDrawer.tsx`, `pages/tools/[id].tsx`, `components/tools/constants.ts`, `commandParams.ts`, `components/runs/*` [HIGH]
- `controller/test/queueStartGuard.test.ts`, `test/helpers/fakeTool.ts`, `test/setup.ts`, `test/staticScan.test.ts` [HIGH]
- `vendor/galago-tools` at `4ccd3da` (objects present locally): `tools/stack/server.py` (READ_COMMANDS bypass `:142-151`, `:950-986`; motion lock `:106`, `:1082`; auto-mint `:275-282`, `:1100-1106`; Configure drain `:839-860`), `tools/fast/server.py` (`CONTROL_COMMANDS` bypass `:80`, `:515-541`; motion lock `:719-720`), `tools/base_server.py` (`:138-146`, `:203`), `interfaces/tools/grpc_interfaces/stack.proto`, `fast.proto`; `git diff bcbbf8e 4ccd3da -- interfaces` empty [HIGH]
- `vendor/galago-tools/.planning/phases/04-stack-tool-registration-reads-estimate/04-RESEARCH.md` (DeviceTree/`ambiguous` shape, Struct doubles, blank-robot trap) [HIGH]
- `.planning/PROJECT.md`, `.planning/research/FAST-GET-PLATES-CONTRACT.md`, `.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md`, `.planning/research/F5-ROOT-CAUSE.md`, sibling `FEATURES.md` and `STACK.md` (2026-11-05) [HIGH]
- Native `<select>` display of an unmatched controlled value and react-query v4 option defaults: standard behaviour, not re-verified here [MEDIUM]

---
*Pitfalls research for: instrument-inferred dropdowns + per-tool concurrency lanes in galago-core*
*Researched: 2026-11-05*
