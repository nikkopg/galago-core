---
phase: 08-concurrency-lanes
reviewed: 2026-11-17T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - controller/components/protocols/CommandDetailsDrawer.tsx
  - controller/components/protocols/laneFields.ts
  - controller/components/protocols/ProtocolDetailView.tsx
  - controller/components/runs/LaneFailureList.tsx
  - controller/components/runs/LanesPanel.tsx
  - controller/components/runs/laneStatus.ts
  - controller/components/runs/list/SwimLaneComponent.tsx
  - controller/components/runs/queuedStartSummary.ts
  - controller/components/runs/runOutcome.ts
  - controller/components/runs/RunsComponent.tsx
  - controller/components/runs/status/QueueStatuscomponent.tsx
  - controller/components/runs/utils.ts
  - controller/hooks/useLaneStatus.ts
  - controller/pages/api/runs/index.ts
  - controller/server/command_queue.ts
  - controller/server/laneScheduling.ts
  - controller/server/queueStartListing.ts
  - controller/server/routers/command_queue.ts
  - controller/server/routers/protocol.ts
  - controller/server/routers/run.ts
  - controller/server/routers/tool.ts
  - controller/server/runState.ts
  - controller/server/runs.ts
  - controller/server/scripting/protocol-script-executor.ts
  - controller/server/utils/SqliteQueue.ts
  - controller/test/fixtures/lanesFlagOff.golden.ts
  - controller/test/helpers/laneHarness.ts
  - controller/test/laneControl.test.ts
  - controller/test/laneHalt.test.ts
  - controller/test/laneScheduling.test.ts
  - controller/test/laneScript.test.ts
  - controller/test/lanesFlagOff.test.ts
  - controller/test/lanes.test.ts
  - controller/test/laneUi.test.ts
  - controller/test/laneValidation.test.ts
  - controller/test/runStateStopIf.test.ts
  - controller/test/sqliteQueueClaim.test.ts
  - controller/test/staticScan.test.ts
  - controller/types/run.ts
  - docker-compose.dev.yml
  - docker-compose.yml
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-11-17
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

I read the lane engine in full (`command_queue.ts`, `laneScheduling.ts`, the `SqliteQueue.claimEligible` addition) and the diffs of every other production file. Tests got a lighter pass. I looked specifically for the physical-safety invariants.

The engine's core invariants hold under this review.

- **No double dispatch.** Eligibility is evaluated by `pickEligible` and the row is claimed by `claimEligible` in one synchronous turn: `_pickNext` has no `await` between `queuedRowsSync()` and `claimEligible()`. `isEligible` rejects every row that is not CREATED or FAILED. It also rejects any lane that already has a STARTED row, and any tool key that is busy in memory. `claimEligible` re-checks status inside the transaction.
- **Latch ordering.** `_latchFailure` is the first statement of the primary catch (line 2019), the side-lane catch (line 1472) and the supervisor catch (line 1183). It is set before any `await` (the `fail`/`failAndDequeueRun` calls).
- **Only an operator Start clears the halt.**
  - `_laneHalt = undefined` appears only in `_startLanes`, after the `source === "enqueue"` early return. Its only non-enqueue caller is the `restart` router.
  - `resume()` and `clearError()` leave the latch alone.
  - `freezeLanes` only ever closes the gate.
- **Nothing auto-aborts or auto-retries.** All failure paths end in a recorded failure and a latch. A FAILED row is re-picked only after an operator Start.
- **Control reaches a side-lane F.A.S.T.** `_controlTarget` prefers the running step whose tool type has a `runControl` entry, on any lane. The abort marker and failed-attempt token are per queueId for side lanes.
- **Flag-off identity.** With `_laneMode` false, every added statement is behind a `_laneMode` check. `_pickNext` is the legacy `startNext()` call. `runningStepFor` is equivalent to the previous raw `runningStep` for the one consumer (`recoveryControl` compares normalised tool keys).
- **Await windows.** Several await windows exist between claim and dispatch (see IN-01). They are not exploitable today only because `better-sqlite3` and drizzle resolve in microtasks.

The six warnings below are real defects. None breaks a physical-safety invariant on its own. They are: a validation gap that can make dispatch less sequential than the author intended, a path that can strand a STARTED row, misleading lane copy when lanes are off, and three state or React correctness problems in the failure display and the late-abort guard.

## Warnings

### WR-01: Non-canonical `laneBarrier` / `lane` values are silently ignored and are not rejected by `validateLanes`

**File:** `controller/server/laneScheduling.ts:78-111, 260-324`
**Issue:** `isBarrier` is `advancedValue(info, "laneBarrier") === true`. A stored value of `"true"`, `1`, or any other non-boolean means the barrier is silently not honoured. `validateLanes` has no rule that flags it. Stored command JSON is explicitly treated as untrusted. Protocols can be created or imported with arbitrary `commands` JSON, so the authoring UI and script API (which only write `true`) are not the only writers.

The comment on `laneOf` says "a smuggled or unvalidated tag can only make dispatch more sequential, never less". That is false for the barrier. A dropped barrier lets a row start before the earlier steps on other lanes have finished, which is less sequential. Rule 5 (first row of a lane needs a barrier) catches this only for the first row of a secondary lane. Every later barrier is lost without a message.

A non-string `lane` (for example `lane: 5`) is also silently mapped to primary, so the step runs on the primary lane, concurrently with the side lanes, instead of on its intended lane.

**Fix:** Add a rule 0 to `validateLanes` that refuses a present-but-wrong-typed tag, and correct the comment.
```ts
// in validateLanes, before rule 1
infos.forEach((info, i) => {
  const ap = info?.advancedParameters;
  if (ap && typeof ap === "object") {
    if (hasOwn(ap, "laneBarrier") && typeof (ap as any).laneBarrier !== "boolean") {
      messages.push(`Step ${i + 1}: "Wait for all earlier steps" must be on or off.`);
    }
    if (hasOwn(ap, "lane") && (ap as any).lane !== undefined && typeof (ap as any).lane !== "string") {
      messages.push(`Step ${i + 1}: the lane name must be text.`);
    }
  }
});
```

### WR-02: A row can be left STARTED with no owner when an exception escapes between the claim and the step's `try`

**File:** `controller/server/command_queue.ts:1637, 1456-1458, 1385-1405`
**Issue:** The claim (`claimEligible`) marks the row STARTED. Some code that can throw runs afterwards, outside any `try` that fails the row.
- Primary loop: `if (this._laneMode) this._ensureLaneWorkers();` (line 1637) runs after the claim and before the `try` at line 1649. `_ensureLaneWorkers` calls `queuedRowsSync()`, which can throw.
- Side loop: `this._runStateMonitor.start(attempt)` (line 1457) is outside the `try`. The primary path has the same call inside the `try`.

An exception reaches the `_launchLane` supervisor. That latches the halt and sets FAILED with `queueId: 0`. The claimed row is never moved to FAILED and stays STARTED. `_interruptedStepsRecovered` is already true, so nothing recovers it. `isEligible` then blocks that lane forever because of the STARTED row on its own lane. Every later operator Start shows "nothing eligible" until the process restarts. This fails closed and no step is sent, but the operator has no recovery path and the failure is attributed to no row.

**Fix:** Move `_ensureLaneWorkers()` ahead of the claim, or into the `try`. Move the side-lane `_runStateMonitor.start(attempt)` and `_sideRunning.set` inside the `try` so the existing catch fails the row. As a backstop, let the supervisor catch fail any row that `_runningStep` or `_sideRunning` shows as owned by that lane.

### WR-03: Lane-aware text is shown when the server has lanes off, which tells the operator work will run in parallel

**File:** `controller/server/queueStartListing.ts:41-45, 75`, `controller/components/runs/queuedStartSummary.ts:156-160`, `controller/components/runs/status/QueueStatuscomponent.tsx:48-57`, `controller/components/protocols/ProtocolDetailView.tsx:598-603, 766-774`
**Issue:** `describeQueueStart` appends ". Lanes (first appearance): ..." and `queuedStartLines` emits "Steps by lane...", "Lane X: n steps" and the note "Starting clears a lane freeze. Lanes then start again together", whenever any queued row carries a lane tag. Neither checks `laneMode`. With `GALAGO_PARALLEL_LANES` unset, tags are inert (D-08) and the run executes sequentially. The Start confirmation and the audit log line still describe parallel lanes.

The visual editor "Lane summary" uses the client-side `validateLanes` regardless of the server flag. It can show refusals that the server will never apply.

This is a misleading-operator-expectation defect in an instrument UI. It also makes a flag-off "Queue Started" audit line differ from legacy for lane-tagged protocols.

**Fix:** Pass `laneMode` into `queuedStartLines` (the QueueStatus component already has `laneStatusData.laneMode`) and skip `laneLines` when it is false. Give `describeQueueStart` a `laneMode` argument from `CommandQueue.laneMode`. In `ProtocolDetailView`, gate the visual lane summary on the server mode, or show `LANE_INERT_NOTE` when lanes are off.

### WR-04: `ErrorBanner` is a component declared inside render, so the new failure list remounts and loses its scroll position

**File:** `controller/components/runs/RunsComponent.tsx:233, 539, 261-264`
**Issue:** `ErrorBanner` is a new function (a new component type) on every render of `RunsComponent`, and it is used as `<ErrorBanner />`. React unmounts and remounts the whole banner whenever the parent re-renders, which happens on any polled-data change. `LaneFailureList` now sits inside it as a `maxH="160px"` scroll box. When there are up to 8 failures plus an overflow line, the operator cannot keep a scroll position while reading it, and any text selection is lost. The existing message box has the same flaw, but the list makes it much easier to hit.

**Fix:** Call it as a function so no new component type is created (the banner itself uses no hooks), or hoist it into a stable component that takes props.
```tsx
{ErrorBanner()}
```

### WR-05: The first entry of the failure list is assumed to be the banner error, which is false after `clearError()`

**File:** `controller/server/command_queue.ts:521-549, 1079-1087`, `controller/components/runs/laneStatus.ts:104-118`
**Issue:** `describeLaneFailures` hides entry 0's message and labels it "First failure, shown above". It assumes `_laneFailures[0]` is `this.error`. `clearError()` sets `this.error = undefined` but does not touch `_laneFailures` or `_bannerFailureLane`. The latch also stays set, so this state is reachable by the operator. The sequence is:
1. Lane A fails, which fills the banner and `_laneFailures[0]`.
2. The operator clears the error.
3. Lane B's in-flight step then fails. `_recordFailure` pushes entry [1], and because `this.error` is now undefined it falls through and makes B the banner error.

The banner shows B's message. The list shows A with its message hidden under "First failure, shown above", and shows B as a second entry. A's failure message is now displayed nowhere on the page. The "Lane Halt Additional Failure" audit line also names the wrong first lane.

**Fix:** Mark the banner entry at the point of assignment, for example a `banner: true` flag set where `this.error = error` is executed, and have `describeLaneFailures` hide the message only for that entry. Or have `clearError()` reset `_bannerFailureLane`. The latter alone does not fix the hidden message, so prefer the flag.

### WR-06: `gotoCommand` and `gotoCommandByRunIndex` no longer supersede a pending late abort reply for a failed side-lane attempt

**File:** `controller/server/command_queue.ts:957-1004, 798-847`
**Issue:** Both goto methods say "An operator re-queue supersedes any pending stale abort reply (T-01-08)" and clear only `this._failedAttempt`. In lane mode, side-lane failed attempts live in `_sideFailedAttempts`, which only `_startLanes` clears. `_refuseGotoWhileLaneStepRuns` refuses goto only while a side step is running. A side-lane step that already failed is allowed through. `SqliteQueue.gotoCommandByIndex` re-queues rows from the target onward, so a FAILED row before the target stays FAILED and queued.

A late abort reply for that failed side step, arriving after the goto, takes the layer (b) branch (`_sideFailedAttempts.get(queueId) === step`). `dequeueFailedRun` then passes its layer (c) re-check (still FAILED, still queued) and dequeues the failed row and the whole remainder of the run. That includes the rows the operator just re-queued. Layer (b) no longer protects this case, which is the T-01-08 guarantee the legacy code gives.

**Fix:** Clear both in each goto method.
```ts
this._failedAttempt = undefined;
this._sideFailedAttempts.clear();
```

## Info

### IN-01: The "no dispatch after halt" guarantee depends on the SQLite driver being synchronous

**File:** `controller/server/command_queue.ts:1440-1458, 1553-1587`
**Issue:** In `_runSideLane`, `_pickNext` claims the row. `await this._shouldSkip(...)` follows, and that awaits drizzle queries. Then `_sideRunning.set` runs and the step is sent. A latch or freeze that lands during that await is not re-checked before `executeCommand`. During that window the claimed row is STARTED but absent from `_sideRunning`. That means the busy-tool and controllable gates, `toolControl`, and `runningStepFor` (used by the STACK acknowledge refusal) do not see it. Today `better-sqlite3` makes every await a microtask hop, so no timer or request can interleave and the window is unreachable. Swapping the driver for an async one (libsql, for example) would open it.

**Fix:** After `_shouldSkip` and before `executeCommand`, re-check `this._laneHalt` / `this.state`. If the gate has closed, fail or release the row explicitly. Publish `_sideRunning.set` immediately after the claim, before any await.

### IN-02: The Lane input normalises on every keystroke

**File:** `controller/components/protocols/CommandDetailsDrawer.tsx:208-215, 827-835`, `controller/components/protocols/laneFields.ts:41-50`
**Issue:** `onChange` calls `setLane`, which trims, lower-cases, and deletes the key when the result is `primary`. The input is controlled by `advancedParams.lane ?? ""`. Typing the full word "primary" wipes the field. A trailing space is dropped immediately. Neither is harmful, but it is surprising. The helper comment says blank or `primary` means the primary lane, so the typed word vanishing looks like a bug.

**Fix:** Keep the raw text in local state and normalise on blur or save. Apply `setLane` to the committed value.

### IN-03: Raw lane names are embedded unbounded in validation messages, and the API handler sends them without a content type

**File:** `controller/server/laneScheduling.ts:199-200`, `controller/pages/api/runs/index.ts:22-26`
**Issue:** `laneMessages.invalidName(v)` embeds the whole normalised value. The UI caps input at 32 characters, but a script or imported JSON can carry a very long or markup-bearing name. It is returned verbatim in the 400 body from `res.status(400).end(e.message)` with no `Content-Type`. The JSON tRPC path and the React text paths are safe. The raw API response can be MIME-sniffed. Protocol authors are trusted operators, and `OperatorOnlyCommandError` already behaves this way.

**Fix:** Truncate the value (`v.slice(0, 32)` plus an ellipsis) in `invalidName`, and set `res.setHeader("Content-Type", "text/plain; charset=utf-8")` before `end`.

### IN-04: The freeze toast reports "Lanes frozen" even when the server answered `frozen: false`

**File:** `controller/components/runs/LanesPanel.tsx:56-60`, `controller/server/command_queue.ts:1299-1307`
**Issue:** `freezeLanes()` returns `{ frozen: false }` when the lanes are already halted (for example a failure landed between the confirm and the request). `onSuccess` ignores the payload and always toasts "Lanes frozen. No new steps will start". That is true in effect, but it hides that the halt is a failure halt, which has different recovery wording.

**Fix:** `onSuccess: (r) => r.frozen ? infoToast(...) : infoToast("Lanes already halted", "Check the Lanes panel for the reason.")`.

### IN-05: The per-lane start summary numbers steps by queue position, not by protocol position

**File:** `controller/components/runs/queuedStartSummary.ts:80-97`
**Issue:** `laneLines` computes `position` as the 1-based count of rows of the run that are still in the queue. Completed and skipped rows leave the queue. After any partial run or retry, the numbers in "Steps by lane" no longer match the "Generated Commands" numbering that `laneStatus.ts` says they follow. This matters in a retry-after-failure Start, the exact moment the operator reads this list carefully.

**Fix:** Number from the stored command order, for example the row's index among all of the run's commands from the `getAll` query, or show the queueId instead of a position.

---

_Reviewed: 2026-11-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
