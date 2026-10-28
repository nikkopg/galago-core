# F5 Root Cause: "one queued command executed three times"

**Researched:** 2026-10-28
**Branch/HEAD:** feat/stack-tool (57d55e9, code identical to main e0a4f2b for controller/)
**Overall confidence:** HIGH for the root cause of the observed event (verified from the recorded dev DBs), HIGH for the latent defect found alongside it (reproduced at HEAD).

Tags: [V] verified by reading code, reading the recorded DB/logs, or running a test. [I] inferred.

## 1. Verdict (read this first)

**The F5 premise is wrong. Nothing was executed "more than once after succeeding", and the Next.js dev-mode hypothesis is ruled out.** Run 1's three executions were three DIFFERENT queued rows (queue_id 4, 5, 6), not one row three times. Rows 4 and 5 were leftovers from earlier attempts that were still in the queue. One Queue Start ran the whole FIFO queue, as designed. The runbook's "one command queued" was read off the new run (queue_id 6) alone.

Evidence [V], from the recorded dev queue DB, copied read-only to scratch (the original is `controller/data/queue.db`, on disk under the repo; table `command_queue_2_commands`):

| queue_id | run_id | created (UTC) | startedAt (last attempt) | completedAt | What it was |
|---|---|---|---|---|---|
| 4 | 15300b481c81e7000 | 2026-10-08 11:45:17 | 2026-10-09T08:13:04.387Z | 08:13:53.088Z | Stale row from the previous day. Its record still carries `error: Invalid arguments...` and `failedAt 2026-10-09T02:51:47.506Z` (= R4a, the -1000 NoLicenseActivated refusal). It stayed queued after failing, so Run 1's start RETRIED it (retry-after-failure, working as designed). expected_tray_id "90". |
| 5 | 1531aa0e1a81e7000 | 2026-10-09 02:51:23 | 08:13:54.589Z | 08:14:51.368Z | The run the operator created for R4a attempt 1. Attempt 1 ran row 4 first (queue order), row 4 failed, the busy loop `break`s, so row 5 was never started and stayed CREATED in the queue for 5.5 h. expected_tray_id "0". |
| 6 | 15323d431e81e7000 | 2026-10-09 08:12:57 | 08:14:52.870Z | 08:15:41.489Z | The one run the operator created for Run 1. |
| 7 | 15324117c181e7000 | 2026-10-09 08:21:19 | 08:21:25.957Z | 08:22:14.689Z | Run 2, executed once, queue empty beforehand. |

The three Run 1 executions line up exactly with the DB: row 4 08:13:04 to 08:13:53, row 5 08:13:54 to 08:14:51, row 6 08:14:52 to 08:15:41. Those are the runbook's three windows.

Corroboration from `controller/data/app.db` `logs` table [V]:
- Exactly one `Queue Started` (id 127, 08:13:02) and one `Queue stopped` (id 134, 08:15:42) for Run 1. So there were NOT two concurrent busy loops and NOT a re-start.
- Strictly alternating `Tool Command Execution` / `Command Executed` (ids 128-133). No overlap, no `Command Failed`, no `Tool Command Execution Error` in the window. So no reply was mis-classified as a failure and no retry-after-failure happened mid-run.
- The earlier attempt (ids 115-118): `Queue Started` 02:51:37, ONE `Tool Command Execution` 02:51:38, error 02:51:47, `Command Failed`. Exactly one step ran, the loop `break`ed, and rows 5 stayed queued (see command_queue.ts:1383-1386, `break` after `FAILED`).
- `sqlite_sequence` shows exactly 7 command rows ever created, all `command_queue_2_commands` (queue.db). The queue table is empty now, so rows 4-6 were removed one by one by `complete`.

So F5 is **not a defect in the busy loop, `startNext`, `complete`, or the singleton**. It is a data-model and UX gap: the queue is a single global FIFO that persists across runs, a failed step stays queued (required retry behaviour), the loop stops at the first failure leaving everything behind it queued, and "Run" starts every row in the queue with no statement of what that includes. The operator pressed Run once and the app ran three queued transfers. The operator's "why did it repeat 3 times?" is the correct observation of that surprise.

## 2. Code version at the time of Run 1

- `galago-web-dev` mounts `./controller:/app` (`docker-compose.dev.yml:9-12`), so it ran the working tree. [V]
- Only galago-core commits near 2026-10-09 are `ce8d40d` (fast Abort/Resume command registration only), `128bbd7`, `318ec7f`. None touch `command_queue.ts` or `SqliteQueue.ts`. So Run 1 ran the `b56b9db` form of both files: busy loop at `command_queue.ts:672` (the runbook's cited "~line 672" matches `git show b56b9db:...`; at HEAD it is `command_queue.ts:937`). [V]
- Between Run 1's code and HEAD, v1 (afc2149 .. 5839b40, 2026-10-12..15) added `toolControl`, `runState`, `_failedAttempt`, `failAndDequeueRun`, `recoverInterruptedSteps`, `dequeueFailedRun` and the t9e row-removed handling. It did NOT change `startNext` (`SqliteQueue.ts:112`, byte-identical selection SQL), `complete` (`SqliteQueue.ts:450`), `executeCommand` (`command_queue.ts:487-490`), the `_start` loop shape, or the plain-failure branch (`commands.fail`, row stays queued, `break`). [V, git show/diff]

## 3. Is it present at HEAD?

The observed scenario ("one Run press executes stale leftovers") is **unchanged at HEAD** [V, reproduced: scratch test A below, 4 tests pass at HEAD]. h0q/o44/t9e do NOT cover it, by design:
- h0q/o44 apply only when the tool ACCEPTS an operator Abort (`_abortAcceptedQueueId`, `failAndDequeueRun`, `command_queue.ts:1334-1349`); the rest of that run is then dequeued.
- o44's `recoverInterruptedSteps` (`SqliteQueue.ts:575`, `command_queue.ts:109-117`, `_start` :887) only fails rows left STARTED by a previous process.
- t9e only handles a step whose row was removed by Clear All / run delete (`command_queue.ts:1351-1386`).
- A plain tool failure (rows 4 and 5's case) takes the `commands.fail(...)` branch (`command_queue.ts:1353-1357`), keeps the row queued FAILED, `break`s, and leaves later rows CREATED. That is the retry path the STACK adapter relies on and must stay.

There IS a real latent double-dispatch defect at HEAD, found while testing the candidates, that is not what happened in Run 1 (see Section 5, candidate D). It deserves a fix under the DEP-03c banner because it is the only way the code can execute the SAME row twice.

## 4. Candidate-by-candidate disposition

| # | Candidate | Verdict | Evidence |
|---|---|---|---|
| H | Next.js dev-mode HMR / module reload creates a second CommandQueue or busy loop that re-picks a retired row | **Ruled out for F5** [V] | (1) `CommandQueue.global` stores the instance on `globalThis` key `__global_command_queue_key` (`command_queue.ts:1436-1444`), so module re-evaluation reuses it. Scratch test C re-imports the module after `vi.resetModules()`: the module object differs but `CommandQueue.global` is the same instance. (2) A retired row cannot be re-picked: `complete` marks COMPLETED and deletes it from `<q>_queue` in one transaction (`SqliteQueue.ts:450-461`), and `startNext` selects only from `<q>_queue` (`SqliteQueue.ts:116-124`). Scratch test B: a second `SqliteQueue` on the same file returns `false` after the first completed the row. (3) The recorded log has ONE Queue Started and strictly serial executions; a second loop would have produced overlap or a second Started. (4) The runbook's "compiling /_error" lines are page recompiles, unrelated. (5) Rows 4/5/6 have distinct queue_ids. |
| 2 | Completed row not removed or marked on `complete` | **Ruled out** [V] | `SqliteQueue.ts:450-461`: status COMPLETED + `DELETE FROM _queue`. DB shows rows 4-6 COMPLETED and `_queue` empty. |
| 3 | `startNext` selects by status and re-picks a completed row | **Ruled out for completed rows** [V] | `startNext` ignores status entirely (`SqliteQueue.ts:116-124`: `ORDER BY position ASC LIMIT 1` over `_queue`), but a completed row is no longer in `_queue`. Selecting regardless of status IS the cause of the in-flight double dispatch (candidate D) because a STARTED row stays in `_queue` until complete/fail. |
| 4 | Two concurrent busy loops from `_start()` called twice | **Not what happened in Run 1, but REAL at HEAD** [V reproduced] | Run 1 had one Queue Started. But `_start()` (`command_queue.ts:875-908`) has no re-entrancy guard, and `restart` (`routers/command_queue.ts:11-13`) and `enqueueRun` when state is READY (`command_queue.ts:1431-1433`) call it unguarded. Scratch test D: second `_start()` while a step is in flight makes `Tool.executeCommand` fire twice for ONE queued row. |
| 5 | `_runningPromise` handling | **Contributes to D** [V] | `_runningPromise` is assigned at `command_queue.ts:891` and cleared at :903 but never consulted by `_start()` to refuse a second start. `stop()` awaits it (:914-916) but sets state OFFLINE first (:912), so the UI shows Run again while a step is still in flight (Pause-queue then Run is a realistic way to hit D) [I]. |
| 6 | Retry-after-failure triggered by a reply mis-classified as failure | **Ruled out for F5; a separate hazard for STACK/F3** [V code, no log hit] | No `Command Failed` / error log in Run 1's window. Note `tools.ts:635-646`: a SUCCESS reply carrying a non-empty `error_message` throws `ToolCommandExecutionError`, which `fail()`s the row and leaves it queued although the instrument may have physically succeeded. Not seen in F5; flag it to the F3 phase, because it is exactly how "executed again after success" can happen for real. |
| 7 | WR-04: `complete()` has no `_hasItem` guard | **Not a cause** [V] | If the row is gone, `_updateItem` -> `find` throws (`SqliteQueue.ts:683-713`), caught by the busy-loop catch, and `fail()` returns false so t9e handles it as a removed row (`command_queue.ts:1353-1386`). It cannot re-queue anything. |
| 8 | h0q / o44 / t9e already cover F5 | **No** | See Section 3. They cover operator-aborted and restart-orphaned and row-removed steps, not plain-failure leftovers. |
| 9 | `goto`/`gotoCommand*` re-queueing a completed row | **Ruled out for F5** [V] | `goto` is a Tool Box step (`command_queue.ts:1217-1229`) and `gotoCommand`/`gotoCommandByIndex` re-insert rows (`SqliteQueue.ts:152-290`). Not used: the protocol was one transfer, the log shows no goto, and the three executions have different queue_ids. |

## 5. Reproduction recipes (all deterministic, no motion, no network, FakeGrpc)

All of these were written and run in scratch (not committed, no source touched): `/tmp/claude-1000/-home-formulatrix-data-nikko-galago-core/58eadaec-4933-47b3-8a2d-5d8078e06a61/scratchpad/f5/f5.test.ts` with config `.../scratchpad/f5/vitest.config.ts` (aliases `@/` to `controller/`, reuses `controller/test/setup.ts` and `controller/test/helpers/fakeTool.ts`). Run from `controller/`: `PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npx vitest run --config <that config>`. Result at HEAD: 4 passed. The existing suite also passes at HEAD: `npm run test:unit` 14 files, 244 tests.

Harness (same as `test/toolControl.test.ts:10-47` and `test/queueRestart.test.ts`): `new CommandQueue({} as any)` with `process.env.SQLITE_DB_PATH=":memory:"` (setup.ts), `installFakeTool("fast-1", ToolType.fast)` for a `FakeGrpc`, `grpc.executeCommand.mockResolvedValue({response: ResponseCode.SUCCESS, return_reply: true})`. Real `Tool.executeCommand` is used so the gRPC call count is observable. Each busy-loop iteration has a real 1.5 s sleep (`command_queue.ts:945`), so tests take 5-8 s; keep `testTimeout` >= 15 s (repo default is 15000, enough for a 3-row test, use 30000 for the 4-call one).

**A. The actual F5 event (what to pin as the "it is by design, but visible" regression test).**
1. `push` row4 (run-old-1) and row5 (run-old-2).
2. `grpc.executeCommand.mockResolvedValueOnce({response: ResponseCode.INVALID_ARGUMENTS, error_message: "x"})`, then default SUCCESS.
3. `await q._start()` -> state FAILED, 1 gRPC call, statuses `["FAILED","CREATED"]` (row5 never ran).
4. `push` row6 (run-new); `q.clearError()`; `await q._start()`.
5. Assert gRPC calls in order `[row4, row4, row5, row6]` and all three rows COMPLETED: one Start, three distinct rows executed. Observed output: `grpc calls in order: [ 'row4', 'row4', 'row5', 'row6' ]`.

**B. Retired row is never re-picked.** Two `SqliteQueue` instances on one temp file; `push`, `a.startNext()`, `a.complete(id)`; `b.startNext()` and `a.startNext()` both `false`. Passes (proves H and candidates 2/3 for completed rows).

**C. Singleton survives HMR.** Delete the global key; import `@/server/command_queue`; take `CommandQueue.global`; `vi.resetModules()`; re-import; assert the class objects differ but `.global` is the same instance. Passes.

**D. The real latent double dispatch (the new regression test the fix needs).**
1. `push` ONE row; `spy = vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise)` with a `deferred()` step.
2. `l1 = q._start()`; `vi.waitFor(() => q.runningStep defined)`.
3. `l2 = q._start()` while the step is in flight.
4. Today: `vi.waitFor(() => spy.mock.calls.length === 2)` PASSES (the same row dispatched twice, concurrently). After the fix it must stay 1, and a "start ignored" log entry should be written.
Mechanism [V]: the in-flight row is STARTED but still in `<q>_queue` (`startNext` only sets STARTED, `SqliteQueue.ts:145`; only `complete`/`fail*` dequeue), and `startNext` has no status filter, so the second loop's `startNext` returns the same row (`SqliteQueue.ts:116-124`). The instrument serialises, so two Transfers run back to back with about 1.5 s gaps, which would look just like F5.

## 6. Fix options

Retry-after-failure invariant to preserve (existing tests that pin it: `test/toolControl.test.ts:554` "a step failure without an accepted abort stays queued and re-runs first", `test/sqliteQueue.test.ts:76` and :90 "fail keeps the step queued", `test/queueRestart.test.ts` o44 cases): a FAILED row stays in `_queue`, ahead of later rows, and the next `_start` re-executes it first.

**Recommended (minimal, no proto, no stack-automation-layer change):**

1. **Single-flight `_start()`** (fixes D). At the top of `_start()` (`command_queue.ts:875`), before `_failedAttempt = undefined`, the "Queue Started" log and `_setState(READY)`: `if (this._runningPromise) { logAction({level:"warning", action:"Queue Start Ignored", details:"..."}); return; }`. Must be before `_setState(READY)`, otherwise the ignored call still flips state out of BUSY. Keep the existing `_recoverInterruptedSteps` retry behaviour (T-o44-03). Add the D test. Caveat: `stop()` sets OFFLINE immediately (:912) and awaits the loop; with the guard, "Pause queue" then "Run" during an in-flight step is ignored until the step ends, which is the safe behaviour (operator presses Run again). Check that `enqueueRun`'s `state === READY` auto-start (:1431) is still correct: it is, because READY is only entered after `_start`'s `finally` has cleared `_runningPromise` (:903-906) or via `clearError`.
2. **Optional defence in depth in `startNext`** (`SqliteQueue.ts:116-124`): exclude rows whose command status is STARTED, so even a bypass of the guard cannot re-dispatch an in-flight row. FAILED and CREATED rows stay selectable, so retry-after-failure is untouched. Risks: (a) a row stuck STARTED in-process would be skipped silently, and is only repaired by `recoverInterruptedSteps`, which runs at construction and in `_start` before the first loop; (b) tests that call `startNext()` repeatedly to drain (`test/sqliteQueue.test.ts:100-112`, :251-252) must be re-read. Recommend doing it only if the planner accepts both; otherwise ship (1) alone.
3. **Make F5's real cause visible, without changing what runs** (this is the user-facing fix; it fits the project Core Value "operator decides"). Extend the existing Run start confirmation (`components/runs/status/QueueStatuscomponent.tsx`, the "Make sure instruments are not unintentionally in simulation mode" modal, opened via `useDisclosure`) to show what this Start will execute: count of queued rows, how many are FAILED retries, and how many distinct runs they belong to, from the existing `commandQueue.getAll`/`getPaginated` data (rows have `status`, `runId`, `commandInfo`). Read-only, no pre-selected choice, no timer, consistent with the UI-08 static scan (`test/staticScan.test.ts`): do not add timers or state checks to the confirmation. A server-side alternative that also preserves retry: have `restart`/`_start` log a `Queue Started` detail line listing queue_ids and run_ids that will run, so the audit trail explains a multi-row start.
4. **Rewrite the DEP-03c requirement text.** "A queued command is never executed twice after success" is not violated by any observed event and cannot be tested as stated except via D. Suggested wording: "One queue start never dispatches the same queue row concurrently (single-flight), and the operator sees what a Start will run, including FAILED retries and rows from earlier runs, before confirming. Retry-after-failure unchanged."

**Not recommended:** deleting FAILED rows when a new run is enqueued, auto-clearing leftovers, or stopping `startNext` at run boundaries. They break retry-after-failure and the galago-tools STACK adapter's reliance on it, and they decide for the operator.

**Do not do this under F5:** idempotency keys / command ids in the gRPC payload. The runbook's suggestion would need a proto change (flag: STOP, user sign-off; `stack.proto` is frozen, `tool_base` proto is generated from galago-tools) and a tool-server change in galago-tools. It also would not have prevented rows 4/5/6, which were legitimately distinct commands.

## 7. Regression tests that must keep passing

- Retry-after-failure: `test/toolControl.test.ts:554` (failed step stays queued and re-runs first), `test/sqliteQueue.test.ts:76`, `:90`.
- h0q: accepted abort removes the step and its run's remainder: `test/toolControl.test.ts:474`, `:604` (refused abort keeps it), `:658` (late-accepted abort).
- o44: `test/queueRestart.test.ts` (orphaned STARTED row failed at construction, never re-dispatched; start blocked while recovery keeps failing); T-01-08 stale-reply gating `test/toolControl.test.ts:719`, `:782`; `test/sqliteQueue.test.ts:281`, `:301`, `:373`, `:396`.
- t9e: Clear All / run delete during a step leaves no queue error: `test/toolControl.test.ts:856`, `:898`, `:937`; `test/sqliteQueue.test.ts:90`, `:228`.
- UI-08 invariants: `test/staticScan.test.ts` (relevant if fix 3 touches the confirmation).
- Whole suite: `cd controller && PATH=$HOME/.nvm/versions/node/v24.14.1/bin:$PATH npm run test:unit` (244 tests at HEAD, all green) plus `tsc --noEmit`.

New tests to add with the fix: D (single-flight, call count stays 1 and a "Queue Start Ignored" log), A (a start dispatches stale FAILED and CREATED rows in order, one Start log line that lists them), and, if fix 2 ships, a `SqliteQueue` test that a STARTED row is not returned by a second `startNext` while a FAILED row still is.

## 8. Scope flags (STOP conditions)

- Proto change: **none needed** for fixes 1-4. Only the rejected idempotency-key idea needs one.
- stack-automation-layer change: **none needed**.
- galago-tools change: none for fixes 1-4. Separately, the `tools.ts:635-646` SUCCESS-with-`error_message` behaviour is relevant to DEP-03b (F3) and to how the STACK adapter encodes errors; it should be checked there, not here.

## 9. Residual uncertainty

- Confirmed by DB and log evidence (HIGH). The only inference is the "Pause queue then Run during an in-flight step" route to D [I], which is read from `stop()` setting OFFLINE before the loop exits (`command_queue.ts:912-916`) and the Run button keying off state (`QueueStatuscomponent.tsx`, `isRunning = state === BUSY`); test D reproduces the underlying double `_start()` directly.
- I could not see the operator's UI at 08:12:58-08:13:02, so whether the `/runs` page listed the three queued rows is unknown. The queue list polls `getAll` every 1 s (`QueueStatuscomponent.tsx`), so it most likely did show them; that supports fix 3 as a display/confirmation change rather than a data change.
- If the owner wants one discriminating check on the original runbook, the DB query is: `select queue_id, run_id, created_at, startedAt, completedAt from command_queue_2_commands` on `controller/data/queue.db` (three distinct rows, as above).

## Sources

- /home/formulatrix/data/nikko/fast/fast-mcp/docs/runbooks/phase5-galago-live-run.md lines 475-551 (R4, F5)
- controller/data/queue.db and controller/data/app.db (copied to scratch, read with python sqlite3; `command_queue_2_commands`, `logs` ids 112-141)
- /home/formulatrix/data/nikko/.venvs/gal05r2-tool-server.log (Run 1 start 15:13:04 local = 08:13:04Z)
- controller/server/command_queue.ts, controller/server/utils/SqliteQueue.ts, controller/server/tools.ts, controller/server/routers/command_queue.ts, controller/components/runs/status/QueueStatuscomponent.tsx, docker-compose.dev.yml
- git: `git show b56b9db:...` (code in effect during Run 1), `git log -- controller/server/command_queue.ts controller/server/utils/SqliteQueue.ts`
- .planning/milestones/v1-quick/ (h0q, o44, t9e, f48) and the existing Vitest suite under controller/test/
