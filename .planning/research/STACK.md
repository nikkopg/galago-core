# Technology Stack — v1.2 additions

**Project:** galago-core (nikkopg fork) — milestone v1.2 "Tool-inferred dropdowns + per-tool concurrency lanes"
**Researched:** 2026-11-05
**Scope:** only what the three NEW features need. Everything in PROJECT.md "Validated" is out of scope.
**Overall confidence:** HIGH (answered from the repo, the vendor submodule at `origin/feat/stack-tool`, and the stack-automation-layer goldens; library versions checked against the npm registry on 2026-11-05)

## Verdict

**Add zero npm dependencies.** All three features are covered by what `controller/package.json` already ships:

| Need | Covered by (already installed) | Evidence |
|------|--------------------------------|----------|
| Client-side cache for instrument reads | `@trpc/react-query` 10.9.0 over `@tanstack/react-query` 4.22.0 (`useQuery` options `enabled`, `staleTime`, `retry`, `refetchOnWindowFocus`) | `controller/package.json:29,32`; the PF400 dynamic-select already uses `enabled` (`components/protocols/AddToolCommandModal.tsx:118-121`), the sequence handlers use `staleTime: Infinity` (`components/tools/advanced/teach_pendant/hooks/useSequenceHandler.tsx:34-36`) |
| Dynamic dropdown component | Chakra UI 2.8.2 `<Select>` + `<option>` (native select) | the PF400 location/sequence selects (`AddToolCommandModal.tsx:376-462`) and the tool-page `select` branch (`pages/tools/[id].tsx:297-314`) |
| Server-side short cache + reply validation | `zod` ^3.20.2 + a ~20-line `Map` with a timestamp | zod already validates every tRPC input (`server/routers/tool.ts:17,497-505`); `Map`-in-`globalThis` is the existing store idiom (`server/tools.ts:38-45`) |
| Direct, non-queue read send | `Tool.forId(...).executeCommand({... return_reply: true})`, exactly like `tool.latchStatus` | `server/routers/tool.ts:550-577`, `server/tools.ts:634-640` (`return reply.return_reply ? reply : undefined`) |
| Per-lane concurrency | native `Promise` + a `Map<laneKey, ...>` in `CommandQueue` | the queue is already hand-rolled around `_runningPromise` / `_runningStep` (`server/command_queue.ts:66,74,919,942`) |
| Feature flag | a `process.env` read (pure function, injectable env for tests) | env precedent: `GRPC_HOST` `server/tools.ts:76`, `TOOLBOX_PORT` `server/tools.ts:721` / `docker-compose.yml:17`, `SQLITE_DB_PATH` `server/command_queue.ts:111` |
| Tests | Vitest 2.1.9, `environment: "node"`, no jsdom/RTL (D-24) | `controller/vitest.config.mts`; fake-tool helper `test/helpers/fakeTool.ts`; queue-guard precedent `test/queueStartGuard.test.ts` |

The only non-package "stack" changes are the **submodule re-pin** and **ts-proto regeneration**, covered below.

## Recommended Stack

### Core Framework (unchanged — do not touch)

| Technology | Version (installed) | Purpose | Why unchanged |
|------------|---------------------|---------|---------------|
| Next.js | 13.1.2 | pages/tRPC host | nothing in v1.2 needs a newer Next |
| tRPC | server/client/next/react-query 10.9.0 | typed API; `useQuery`/`useMutation` | v10 is hard-bound to react-query **v4**; do NOT bump either (tRPC 11 / react-query 5 are current at 11.24.0 / 5.106.1 but a migration is not v1.2 work) |
| @tanstack/react-query | 4.22.0 | client query cache | v4 option names (`cacheTime`, `keepPreviousData`) apply — not v5's `gcTime` |
| Chakra UI | 2.8.2 | `Select`, `FormControl`, `Alert` | native `<Select>` is enough (see Alternatives) |
| zod | ^3.20.2 | validate/cap instrument replies | already the validation idiom |
| Vitest | 2.1.9 (pinned, Docker builder node 22.11) | unit tests | pinned by human decision (PROJECT.md Key Decisions) |

### Codegen (the one recipe that must be followed exactly)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `vendor/galago-tools` submodule | re-pin `bcbbf8e` -> `4ccd3da` (`origin/feat/stack-tool`) | stack adapter handlers + (later) the F.A.S.T. `get_plates` oneof | `git diff bcbbf8e 4ccd3da -- interfaces/` is empty (verified 2026-11-05; changes are `tools/stack/server.py`, `ledger.py`, tests, docs) — regenerated `stack.ts` should be byte-identical; **verify with `git diff` after regen** |
| ts-proto (codegen only) | **1.151.1** via scratch-dir install + explicit `--plugin=` | regenerate `controller/gen-interfaces` | the `controller/node_modules` copy (package.json says `^1.138.0`, resolves to 1.153.2) generates a broken `tool_base.ts` (PROJECT.md Context). `bin/make proto_ts` (`bin/make:58-69`) has no `--plugin`, so a scratch-dir run is required. Do NOT edit `package.json` to pin it. |

Re-pin happens twice: once for STACK dropdowns (`4ccd3da`, protos unchanged — expect a no-op diff in `gen-interfaces`), once after galago-tools freezes `get_plates` (the F.A.S.T. phase; `fast.ts` gains `get_plates = 11`, `Transfer.expected_tray_id = 13` must remain).

### New code (no new packages) — where each piece lives

| Piece | Location (new files) | Purpose |
|-------|----------------------|---------|
| `tool.stackOptions` query (or one query per list) | `server/routers/tool.ts`, logic in new `server/stackOptions.ts` | sends `get_robot_states`, `list_devices`, `list_labware_profiles`, `list_transfer_profiles` through `Tool.forId(...).executeCommand({return_reply:true})` (the `latchStatus` template); `Promise.allSettled`, zod-validate + cap each reply, 10-30 s TTL `Map`, returns `{ status: "ready" \| "unavailable", ... }` instead of throwing |
| `tool.fastPlates` query | same router, `server/fastPlates.ts` | same shape for `get_plates`; validation per the contract (integer id >= 1, max plate count, bounded strings) |
| Pure option derivation | `components/tools/dynamicOptions.ts` | cascade device -> deck -> nest, labware/transfer-profile name lists, plate `{id,label}`; pure so Vitest can cover it without jsdom |
| `useDynamicOptions(toolName, source)` hook | `hooks/useDynamicOptions.ts` | the only client reader of the new queries (mirrors `hooks/useRunControl.ts` single-reader rule) |
| `DynamicSelect` component | `components/tools/DynamicSelect.tsx` | one Chakra `<Select>` wrapper used by BOTH the tool page and `AddToolCommandModal`; falls back to the existing text/number input when status is `unavailable` |
| Source map | `components/tools/dynamicOptionSources.ts` | sibling to `commandFields` (see Integration #2) |
| Lane flag | `server/laneFlag.ts` | `isParallelLanesEnabled(env = process.env)` |
| Lane internals | `server/command_queue.ts` (+ small `server/lanes.ts` pure helpers) | `Map<laneKey, RunningStep>` + per-lane busy loop |

## Integration Points (file:line)

### STACK dropdowns

1. **Server read path.** Copy `tool.latchStatus` (`server/routers/tool.ts:550-577`): `getToolFromDB(toolId)` -> `Tool.forId(record.name, record.ip, record.port, record.type)` -> `tool.executeCommand({... return_reply: true})`. Use the **instance** `executeCommand` (`server/tools.ts:~436`), not the static one: the static wrapper writes a `logAction` "Tool Command Execution" line per call (`server/tools.ts:~418`), which would flood the audit log with every dropdown load; the instance path logs only on failure. The instance path also passes the operator-only guard, which only refuses `acknowledge_failure`, so reads are unaffected.
2. **Reads never touch the queue.** They bypass `CommandQueue` entirely (no `_runningStep`, no modal state), so they cannot violate the single-flight Start guard or the busy loop. On the tool side, all eight STACK reads are in `READ_COMMANDS` and bypass the BUSY gate (`tools/stack/server.py:142-152` @ `4ccd3da`), so they work while a transfer is running. A read failure maps to a thrown `ToolCommandExecutionError` via `describeToolReply` (`server/tools.ts:~628`) — the query layer must catch it and return `unavailable`, never surface a toast storm.
3. **Reply shapes (meta_data, from the stack-automation-layer goldens `tests/golden/*.json`).** zod schemas to write:
   - `deviceTree`: `devices[].{deviceName, decks[].{deckName, nests[].{nestName}}}` plus `ambiguous: string[]`
   - `robotStates`: `robots[].{robotName, state}` (state is the raw wire string; `get_robot_states` is never cached upstream)
   - `labwareProfiles`: `profiles[].name`; `transferProfiles`: `profiles[].name`
   - **Send `deviceName` / `deckName` / `nestName` — never `unifiedName`.** The core addresses labware by the exact name triple only; `unifiedName` is display text and two live devices both report `"deck1,A1"` (`stack-automation-layer/stack_automation_layer/model.py:1-10`, `knowledge.py:14-22`). Surface `ambiguous` entries to the operator (they cannot be addressed) rather than hiding them.
4. **Client query options.** No `QueryClient` defaults are configured (`utils/trpc.ts:15-27` — `createTRPCNext` with only `links`/`transformer`), so react-query v4 defaults apply: `retry: 3`, `staleTime: 0`, `refetchOnWindowFocus: true`. For instrument reads set explicitly: `retry: false`, `refetchOnWindowFocus: false`, `staleTime` ~15-30 s, `enabled: toolType === "stack" && !!toolName`, **no `refetchInterval`** (dropdowns are fetch-on-open plus an explicit Refresh button that sends `refresh: true`). Rationale: an offline instrument must report `unavailable` in one round trip, not after 3 backoff retries, and nothing should poll a real arm's manager.
5. **Form wiring — two renderers, one component.** The tool page renders fields in `renderFields` (`pages/tools/[id].tsx:247-358`), the protocol editor in `renderField` (`components/protocols/AddToolCommandModal.tsx:289-657`). They do not share code today. Introduce `DynamicSelect` and call it from both; do not copy the PF400 block (`AddToolCommandModal.tsx:376-462`) a third and fourth time. The PF400 pattern to reuse is: `enabled` query keyed on the selected tool, `placeholder`, a disabled "No X available" option, plus the modal's `{{variable}}` companion select (`AddToolCommandModal.tsx:317-327`) which must stay available next to each dynamic select so protocols can still bind a variable.
6. **Do not change `commandFields` field shapes.** Several tests pin them verbatim: `test/commandFields.test.ts:75-87` (`stack.transfer` `toStrictEqual`, all `type:"text"`), `:70-78` ("no defaultValue and no select"), and `test/staticScan.test.ts:665-675` (top-level key scan of `constants.ts`). Keep `commandFields.stack.*` `type: "text"` and attach dropdown behaviour through a **sibling map** keyed `tool.command.field -> source` in `dynamicOptionSources.ts`. The proto field list stays the single frozen source; the dropdown layer is additive and the born-empty guarantee still holds (a `<Select placeholder>` renders nothing selected).
7. **Born-empty rules the component must enforce** (PROJECT.md Core Value, Out of Scope "dropdowns that preselect"): never auto-select even when exactly one option exists; clearing a parent (device/deck) resets children to the empty placeholder (clearing is fine, defaulting is not); if the stored value is not in the freshly fetched list, keep it visible as an extra "(not reported by instrument)" option instead of silently dropping it; when `unavailable`, fall back to the current plain `Input` so offline protocol authoring keeps working and saved protocols load unchanged. STACK sends still go through `coerceBooleanParams` + `omitBlankParams` (`pages/tools/[id].tsx:179-188`, `components/tools/commandParams.ts`) — a dropdown left at the placeholder stores `""` and is stripped, same as today.
8. **Protocol modal gotcha.** `AddToolCommandModal.handleSubmit` back-fills every untouched field: numbers -> `0`, text -> `""` (`AddToolCommandModal.tsx:211-226`). For F.A.S.T. `source_plate_id`/`dest_plate_id` a `0` is never a valid id (contract: integer >= 1). The plate dropdown must store a number (convert `Select`'s string `value` with `Number()` — the existing `select` branch stores strings), and server-side/pre-send validation should reject 0 rather than trusting the dropdown.

### F.A.S.T. plates

9. **Server.** Same pattern as #1, with `get_plates` sent via the direct non-queue path (`server/tools.ts:~434` per the contract; the instance `executeCommand` is the actual direct path). Validate per `FAST-GET-PLATES-CONTRACT.md`: `plates[].{id, description, rowCount, colCount, workingCapacity}`; Struct doubles -> `Number.isInteger(id) && id >= 1`; cap plate count and string lengths with zod (`z.array(...).max(N)`, `z.string().max(M)`); empty `plates: []` is valid (show "No plates registered", not an error); order ascending by `id` as delivered.
10. **Keep `get_plates` out of `commandFields.fast`.** `test/commandFields.test.ts:31-46` pins the 12 transfer fields and `test/runControl.test.ts:29-41` shows `fast` entries are asserted by name; adding a `get_plates` entry would also make it a protocol step / tool-page command, which the contract forbids. The gen-interfaces `Command` type will gain `get_plates` automatically after regen — nothing else in the controller must list it.
11. **Offline policy (contract open point)** — recommendation: show a plain number input (today's behaviour) with a small "plate list unavailable" hint; do NOT cache a stale list across sessions. This avoids a "stale plate id looks valid" hazard and needs no extra storage. (Last-known list is a defer, LOW priority.)
12. **F.A.S.T. `Transfer` is unchanged on the wire.** `source_plate_id`/`dest_plate_id` stay `number` (`components/tools/constants.ts:318-319`), `expected_tray_id = 13` stays in the proto but out of the form (quick 261104-or1). Saved protocols load unchanged.

### Concurrency lanes

13. **No library; a per-lane busy loop plus a pure helper module.** The requirement is "one in-flight step per lane" — a mutex of size 1 per lane — and the existing `_runningPromise` field already is that for the single lane. The hard parts are not locking but (a) lane-aware dispatch, (b) lane-halt, (c) flag-off byte-identity. No library solves those, and each candidate adds risk (see Alternatives). `Promise` + `Map<string, ...>` is sufficient, testable with the same fake-timer harness `test/queueStartGuard.test.ts:41-52` uses.
14. **Dispatch.** `SqliteQueue.startNext()` takes the head of the global `position` order with no filter (`server/utils/SqliteQueue.ts:112-150`). A lane needs "first queued row whose tool maps to this lane". Do that in JS over the existing `queuedRowsSync()` (`SqliteQueue.ts:398`) / a new `startNextForLane(predicate)` — **no schema change** (`command_data` is a SuperJSON blob; `initializeTables` has no migration facility, `SqliteQueue.ts:22-56`, so an `ALTER TABLE` lane column is avoidable risk). Lane key is derived from `commandInfo.toolId` (or an explicit `advancedParameters.lane`). Flag off -> the existing `startNext()` code path is not even called differently (guard with an `if` at the top of `_start`, leaving the original function bodies untouched, to keep the "byte-identical" acceptance provable).
15. **Per-lane Start guard / lane-halt.** Replace the single `_runningPromise` check (`command_queue.ts:919`) with `Map<lane, Promise>` only when the flag is on. Lane-halt = when any lane's catch block runs (`command_queue.ts:~1385-1465`, the `_setState(FAILED)` / `break` path), set a shared `halted` marker that every lane loop checks before its next `startNext` (the existing 1.5 s pre-dispatch delay at `command_queue.ts:~1000` is the check point). State, `error`, `_failedAttempt`, `_abortAcceptedQueueId` (`command_queue.ts:64-84`) are single-valued today: with lanes they must become per-lane (or per-attempt) — this is the largest design cost of the milestone, and it is a code-structure cost, not a dependency cost.
16. **`runState` / `RunStateMonitor` (`server/runState.ts`) is single-step.** It polls one `RunningStep`. For two live lanes the control bar needs a poller per lane (or the monitor must accept a set). Reuse `RUN_STATE_POLL_INTERVAL_MS` and the monitor as-is; instantiate one per lane. The run-page reader stays the single `hooks/useRunControl.ts` (`useRunControlState`, `:14-18`); its envelope type grows a `lanes` shape additively.
17. **Feature flag: env var, NOT `.planning/config.json`.** The todo (`scheduler-per-tool-concurrency-lanes.md:71-74`) proposes `.planning/config.json -> workflow.parallel_tool_lanes`. That file is GSD planning config; it is not in the runtime image (`controller/Dockerfile:15,49-57` copies `controller/` and build output only). Use `GALAGO_PARALLEL_TOOL_LANES=1` read by `isParallelLanesEnabled(env = process.env)`, passed through `docker-compose.yml:14-19` like `TOOLBOX_PORT`. **Read it once at `_start`, never mid-run** — a flag flip during a run must not re-shape in-flight lane state. Default off = unset = sequential. (Alternative: the `appSettings` table, `server/routers/appSettings.ts`, is runtime-toggleable and audited, but a toggle that can change scheduler behaviour under a running queue is the wrong safety posture for default-off.)
18. **Protocol/run-page surface.** `advancedParameters.runAsynchronously` is written as literal `false` on every row (`server/runs.ts:117`, `server/scripting/protocol-script-executor.ts:30`, and `AddToolCommandModal.tsx:240`) and is read by nothing. Do **not** repurpose it (old saved rows would silently change meaning); add a new optional `advancedParameters.lane` (string) and `useParallelToolLanes` on the run, both absent by default. Type changes land in `types/` (the `ToolCommandInfo` / `RunCommand` types) — no schema migration because rows are JSON.
19. **Preview and run page.** `protocol.preview` (`server/routers/protocol.ts:250`) and `components/runs/RunsComponent.tsx` currently assume one total order and poll at 1-2 s (`RunsComponent.tsx:123-164`). Per-lane rendering is plain React/Chakra (`Flex`/`Grid`/`Badge`) over the existing `commandQueue.getAll` poll — no gantt/timeline library (`RunQueueGanttChart.tsx` already exists in-repo for a time view).

## Supporting Libraries

None new. Existing ones with the role they play in v1.2:

| Library | Version | Purpose in v1.2 | When to Use |
|---------|---------|-----------------|-------------|
| zod | ^3.20.2 | validate + cap `get_plates` and STACK read replies | every instrument reply that feeds a dropdown (never trust a reply as typed) |
| superjson | ^1.12.2 | tRPC transformer (already set, `utils/trpc.ts:25`) | no action; the `unavailable` envelope is a plain object |
| lucide-react | ^0.556.0 | a `RefreshCw` icon for the Refresh button | optional, icons already used in `AddToolCommandModal.tsx:45-59` |
| @choc-ui/chakra-autocomplete | ^5.7.0 | searchable combobox, **already installed** (`components/ui/Form.tsx:14-19`) | only if a list grows long (profiles/nests in the tens+); not needed for v1.2's expected sizes (a handful of robots/devices/profiles, ~a dozen plates). Do not add it by default — it is a different interaction model from the native selects the rest of these forms use. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Client cache | existing react-query v4 via tRPC `useQuery` options | upgrade to react-query 5 / tRPC 11 (5.106.1 / 11.24.0 current) | tRPC 10.9 is bound to react-query v4; the upgrade rewrites every `useQuery` call in the repo (~60 sites, `cacheTime`->`gcTime`, `keepPreviousData` removal) for zero feature benefit |
| Client cache | react-query query keys per tool | SWR / Zustand / a custom store | a second cache beside react-query splits invalidation; react-query already does dedupe, `enabled`, cache sharing across the page and the modal |
| Dropdown | Chakra `<Select>` (native) | `chakra-react-select` 6.1.3 / `react-select` / downshift | new dependency + new interaction model; the PF400 precedent (`AddToolCommandModal.tsx:376-462`) and `pages/tools/[id].tsx:297-314` use native selects; lists here are short; native selects have zero a11y/portal risk inside Chakra `Modal` |
| Dropdown | `@choc-ui/chakra-autocomplete` | (only for long lists) | already installed; keep in reserve, see Supporting table |
| Concurrency | native `Promise` + `Map` lanes | `p-queue` 10.0.0 | ESM-only (`"type": "module"`) — fights the Next 13.1.2 server bundle and the Docker `node:22.11` build; and it models a work *queue* while the repo's queue is the SQLite table (`SqliteQueue`); a second in-memory queue would break the "row is the truth" restart behaviour (`_recoverInterruptedSteps`, `command_queue.ts:123-137`) |
| Concurrency | native `Promise` + `Map` lanes | `async-mutex` 0.5.0 (last published 2024-03) | would implement a size-1 lock we already get from the per-lane `_runningPromise` claim; the claim must stay **synchronous** with no `await` between the guard and the assignment (comment at `command_queue.ts:~905`), which a library's async `acquire()` makes harder to prove |
| Concurrency | per-lane busy loop | worker threads / child processes | gRPC clients and SQLite handles are in the main process; lanes only wait on gRPC I/O, so the event loop already overlaps them |
| Server cache | `Map` + timestamp + zod | `lru-cache` 11.5.3 | 4-6 entries per tool, TTL only; a dependency for 20 lines |
| Feature flag | env var read once at `_start` | `.planning/config.json` (the todo's suggestion) | not shipped in the image; GSD planning config must not drive production behaviour |
| Feature flag | env var | `appSettings` DB toggle | changes scheduler behaviour under a live queue; weaker for the default-off safety posture (could be revisited post-live-proof) |
| Lane key storage | derive from `commandInfo.toolId` in JS | new `lane` SQLite column | `SqliteQueue` has no migration mechanism (`SqliteQueue.ts:22-56`); the flag-off path must stay byte-identical |
| Read send path | instance `executeCommand` | `commandQueue.toolControl` / `Tool.controlCommand` | `controlCommand` is pinned to exactly the queue + `recoveryControl` mutation callers by `test/staticScan.test.ts` (and is for operator control actions); dropdown reads are not control |

## What NOT to Add

- No new runtime dependencies (nor devDependencies): no jsdom, no `@testing-library/*` (D-24 decision stands — rendered dropdown behaviour goes to pure-helper unit tests + UAT), no `msw`.
- No change to the pinned `vitest` 2.1.9, `@tanstack/react-query` 4.22.0, tRPC 10.9.0, Next 13.1.2.
- No change to `ts-proto` in `package.json` (codegen uses a scratch-dir 1.151.1 with `--plugin=`).
- No `refetchInterval` on any dropdown read — operators fetch on open / on Refresh; nothing polls the instruments' managers for list data.
- No stale-while-offline list for F.A.S.T. plates in v1.2 (see #11).
- No new `commandFields` entries for `get_plates` or any of the dropdown-only reads, and no `lane` entry in `commandFields`.
- No schema/migration changes to `SqliteQueue`.

## Installation

```bash
# Nothing to install. v1.2 changes no package.json.

# Submodule re-pin (STACK dropdowns phase), then regenerate with the pinned recipe
git -C vendor/galago-tools fetch origin
git -C vendor/galago-tools checkout 4ccd3da    # origin/feat/stack-tool
# regenerate controller/gen-interfaces with ts-proto 1.151.1 from a scratch dir
# (explicit --plugin=, never controller/node_modules' 1.153.2); expect a NO-OP diff
# in gen-interfaces/tools/grpc_interfaces/stack.ts

# F.A.S.T. plates phase: re-pin again to galago-tools' frozen get_plates commit and regenerate;
# fast.ts must gain get_plates and keep expected_tray_id = 13
```

Gate for every phase: `cd controller && npx tsc --noEmit && npm run test:unit` (`package.json:11-12`; `bin/make test` adds `prettier --check`). Baseline at v1.1 close: 608 tests / 28 files. Remember `next build` fails on an eslint-disable comment naming a rule the config lacks (PROJECT.md decision, `commandParams.ts` fix `bf928c0`) — run the production build once before the lane phase closes.

## Tests the new work should add (no new tooling)

| Area | Pure unit under Vitest | How |
|------|------------------------|-----|
| Option derivation | `dynamicOptions.ts` cascade device -> deck -> nest, ambiguous handling | plain functions + the golden JSON copied into `test/fixtures` |
| Reply validation | zod schemas for STACK reads and `get_plates` (non-integer id, id 0, oversize list, empty list, missing `plates`) | table-driven |
| Server queries | `unavailable` envelope on thrown `ToolCommandExecutionError`; TTL cache hit/miss; no `refresh` leak | `installFakeTool` from `test/helpers/fakeTool.ts` |
| Born-empty guard | extend the static scan: dropdown source files contain no `defaultValue`/auto-select-first (`options[0]`) | `test/staticScan.test.ts` pattern |
| Lanes | flag off = single `_runningPromise` path (existing `queueStartGuard.test.ts` must pass unmodified); flag on = two lanes overlap; lane A failure freezes lane B before next dispatch; each tool's fake sees only its own steps and each step key once | fake timers `toFake: ["setTimeout"]` (`queueStartGuard.test.ts:41`) |

## Confidence

| Area | Confidence | Notes |
|------|------------|-------|
| Zero new dependencies | HIGH | verified against `package.json`, in-repo precedents for every need |
| Re-pin is proto-neutral | HIGH | verified: `git diff bcbbf8e 4ccd3da -- interfaces/` is empty (no proto under `interfaces/` changed; `stack.proto` identical) |
| STACK reply shapes | HIGH for the goldens, MEDIUM for live | goldens are contract v1 in stack-automation-layer; live PAC drift (G12 casing) is handled inside the core, but zod schemas should tolerate extra keys and reject only on the fields used |
| `get_plates` shape | MEDIUM | the contract is "proposed" until galago-tools freezes the proto; revalidate against the frozen commit |
| Lane flag mechanism | HIGH | `.planning/` is absent from the image (Dockerfile COPY lines) |
| Lane internals complexity | HIGH that no library helps, MEDIUM on effort | the cost is per-lane state bookkeeping (`error`, `_failedAttempt`, `_abortAcceptedQueueId`, `RunStateMonitor`), see ARCHITECTURE/PITFALLS |

## Sources

- Repo (HIGH): `controller/package.json`; `controller/utils/trpc.ts`; `controller/components/tools/types.ts`, `constants.ts`, `commandParams.ts`; `controller/components/protocols/AddToolCommandModal.tsx`; `controller/pages/tools/[id].tsx`; `controller/server/tools.ts`, `command_queue.ts`, `runState.ts`, `toolReply.ts`, `routers/tool.ts`, `utils/SqliteQueue.ts`; `controller/test/commandFields.test.ts`, `staticScan.test.ts`, `queueStartGuard.test.ts`; `controller/Dockerfile`; `docker-compose.yml`; `bin/make`.
- `vendor/galago-tools` `origin/feat/stack-tool` (HIGH): `interfaces/tools/grpc_interfaces/stack.proto`, `tools/stack/server.py` (`READ_COMMANDS` :142, `_reply`/`_result_reply` :445,:688).
- `stack-automation-layer` (HIGH): `stack_automation_layer/results.py` (`DeviceTree`, `RobotStates`, `LabwareProfiles`, `TransferProfiles`), `model.py`, `knowledge.py`, `tests/golden/*.json`.
- `.planning/research/FAST-GET-PLATES-CONTRACT.md`, `.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md`, `.planning/PROJECT.md` (HIGH, project's own).
- npm registry, 2026-11-05 (HIGH): `p-queue` 10.0.0 (ESM), `async-mutex` 0.5.0 (2024-03-11), `lru-cache` 11.5.3, `@tanstack/react-query` 5.106.1, `@trpc/react-query` 11.24.0, `chakra-react-select` 6.1.3.
