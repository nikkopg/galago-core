---
phase: 08-concurrency-lanes
reviewed: 2026-11-17T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - controller/components/protocols/ProtocolDetailView.tsx
  - controller/components/runs/queuedStartSummary.ts
  - controller/components/runs/status/QueueStatuscomponent.tsx
  - controller/server/command_queue.ts
  - controller/server/queueStartListing.ts
  - controller/test/laneReviewFixes.test.ts
  - controller/test/laneUi.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 8: Code Review Report (incremental re-review)

**Reviewed:** 2026-11-17
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This is an incremental re-review of `git diff b609276..HEAD` for commits c438887 and 773389c. Those commits fixed WR-02, WR-06 and WR-03. I read the diff in the context of the full files. I also ran `laneReviewFixes`, `laneUi`, `staticScan` and `lanesFlagOff` under vitest, and all 198 tests pass.

**WR-02 (orphaned STARTED row) is fixed for the cases it named.**
- In the primary loop, `_ensureLaneWorkers()` now runs before `_pickNext`. A throw there happens before any claim. After the claim, the only statements before the dispatch `try` are three plain assignments that cannot throw. I checked this.
- In the side loop, `_sideRunning.set` and `_runStateMonitor.start` are now inside the outer `try`. A throw there goes through the side-lane catch and fails the row. The `finally` removes the `_sideRunning` entry and stops the monitor, so nothing leaks.
- The primary-loop move is safe. `_ensureLaneWorkers` returns early unless the state is BUSY. `_runSideLane` runs synchronously only up to its first `setTimeout` await, so a worker launched just before the primary claim cannot claim anything in the same turn. The flag-off path is untouched because the call is still behind `if (this._laneMode)`.
- One thin window remains between the claim and the `try`: the `await this._shouldSkip(...)` in the side loop. See IN-01.

**WR-06 (goto supersedes late side-lane aborts) is fixed.**
- Both goto methods now clear `_sideFailedAttempts`. A late abort reply then fails layer (b) (`_sideFailedAttempts.get(queueId) === step`). `_failedAttempt === step` is also false, so it takes the logged "Aborted Run Dequeue Skipped" branch and never reaches `dequeueFailedRun`. I traced this in `_recordAcceptedAbort`.
- The clear is not behind a `_laneMode` check. It is a no-op on an empty Map, so flag-off behaviour is identical. The `lanesFlagOff` and `staticScan` tests confirm this.

**WR-03 (lane text only when the server has lanes on) is fixed for the Start summary and the audit line.**
- `laneMode` flows from the server flag into `describeQueueStart` and from a successful `laneStatus` read into `queuedStartLines`.
- The lane-off line equals the legacy text.
- The client falls back to "no lane text" on a failed or unknown read, which is the safe default.

Two items remain open from the earlier review and still apply to these files: WR-05 and IN-01. I kept IN-05 as well. WR-01, WR-04 and IN-02 to IN-04 concern files outside this scope and are not re-assessed here. One new residual warning (WR-07) and two new info items (IN-06, IN-07) are listed below.

## Warnings

### WR-05: The first entry of the failure list is assumed to be the banner error, which is false after `clearError()`

**File:** `controller/server/command_queue.ts:521-549` (and `_bannerFailureLane` at 1079-1087)
**Issue:** `describeLaneFailures` hides the message of `_laneFailures[0]` and labels it "First failure, shown above". That assumes entry 0 is `this.error`. `clearError()` sets `this.error = undefined` but leaves `_laneFailures` and `_bannerFailureLane` alone, and the latch stays set. The sequence is:
1. Lane A fails and fills the banner and `_laneFailures[0]`.
2. The operator clears the error.
3. Lane B's in-flight step fails. `_recordFailure` pushes entry [1]. `this.error` is undefined, so it falls through and makes B the banner error.

The banner then shows B's message. The list hides A's message under "First failure, shown above". A's failure text is shown nowhere on the page. The "Lane Halt Additional Failure" audit line also names the wrong first lane. This is unchanged by the recent commits.
**Fix:** Mark the banner entry where `this.error = error` is assigned (for example `banner: true` on that list entry), and have `describeLaneFailures` hide the message only for that entry. Resetting `_bannerFailureLane` in `clearError()` alone would not fix the hidden message.

### WR-07: The protocol editor states "runs its steps one at a time" before the server mode is known, and still shows lane refusals that are not applied

**File:** `controller/components/protocols/ProtocolDetailView.tsx:310-314, 778-785`
**Issue:** `lanesActive` is `isSuccess && laneMode === true`. While the `laneStatus` query is loading or has errored, `!lanesActive` is true. The editor then asserts as fact: "Lanes take effect only when parallel lanes are enabled on the server. This protocol runs its steps one at a time." On a server with lanes ON, this is false for the first moments after load. If the status poll errors, it is false for as long as the error lasts. This is the same class of misleading operator expectation that WR-03 set out to remove, now inverted. The wording is a claim, not "unknown".

Separately, `LaneWarningsAlert warnings={visualSummary.warnings}` still shows the client-side `validateLanes` refusals when lanes are off. The server's preview path only applies `validateLanes` when `CommandQueue.global.laneMode === true` (`server/routers/protocol.ts:270`). Operators can therefore see refusals the server will never apply. The inert note above the list softens this, but the original WR-03 text named this point and it is only partly addressed.
**Fix:** Branch on three states: `laneStatusQuery.isSuccess && !laneMode` shows the note with the "one at a time" sentence. Loading or error shows nothing, or a neutral "Lane availability could not be checked." Hide `visualSummary.warnings` when the server mode is confirmed off.
```tsx
const laneKnown = laneStatusQuery.isSuccess;
const lanesActive = laneKnown && laneStatusQuery.data?.laneMode === true;
const lanesOff = laneKnown && !lanesActive;
// ...
{lanesOff && <Text ...>{LANE_INERT_NOTE} This protocol runs its steps one at a time.</Text>}
{!lanesOff && <LaneWarningsAlert warnings={visualSummary.warnings} />}
```

## Info

### IN-01: The "no dispatch after halt" guarantee still depends on the SQLite driver being synchronous

**File:** `controller/server/command_queue.ts:1440-1458`
**Issue:** In `_runSideLane`, `_pickNext` claims the row and `await this._shouldSkip(...)` follows. `_sideRunning.set` now sits inside the `try` (the WR-02 fix), but still after that await. A latch or freeze that lands during the await is not re-checked before `executeCommand`. During that window the claimed row is STARTED but absent from `_sideRunning`, so the busy-tool gate, `toolControl` and `runningStepFor` do not see it. Today `better-sqlite3` makes each await a microtask hop and the window is unreachable. An async driver would open it. The WR-02 fix did not change this.
**Fix:** Publish `_sideRunning.set` immediately after the claim, before the await. After `_shouldSkip` and before `executeCommand`, re-check `this._laneHalt` and `this.state`. If the gate has closed, release or fail the row explicitly.

### IN-05: The per-lane start summary numbers steps by queue position, not by protocol position

**File:** `controller/components/runs/queuedStartSummary.ts:80-97`
**Issue:** `laneLines` takes `position` as the 1-based count of rows of the run that are still in the queue. Completed and skipped rows have left the queue. After a partial run or a retry, the numbers in "Steps by lane" no longer match the "Generated Commands" numbering. This matters in a retry-after-failure Start, which is the moment the operator reads the list most carefully.
**Fix:** Number from the stored command order (the row's index among all of the run's commands), or show the queueId.

### IN-06: The new WR-03 UI tests assert on source text, not behaviour

**File:** `controller/test/laneUi.test.ts` (new test "the editor names the inert lanes and the queue passes its lane mode to the audit line")
**Issue:** The test reads `ProtocolDetailView.tsx`, `command_queue.ts` and `QueueStatuscomponent.tsx` as strings and checks for fragments such as `"{!lanesActive && ("`, `"laneStatusQuery.isSuccess ? laneStatusQuery.data : undefined"` and `/laneFrozen,\s*laneMode,/`. It passes as long as the text exists, even if the code is dead, mis-gated, or the condition is inverted. A reformat by prettier (line wrapping) could also break it without any behaviour change. Because these are the only checks for the component wiring (the inert note, `laneMode` passed into `queuedStartLines`), a regression in that wiring would go unnoticed.
**Fix:** Extract the gating into a pure helper (for example `laneUiState(query)` returning `"active" | "off" | "unknown"`) and test it directly. For the audit line, drive a real `CommandQueue` with and without `parallelLanes` and assert the `Queue Started` log text. `laneReviewFixes.test.ts` already builds such a harness.

### IN-07: `describeQueueStart` defaults `laneMode` to false

**File:** `controller/server/queueStartListing.ts:49-53`
**Issue:** The new third parameter is `laneMode = false`. A future caller that forgets the argument silently drops the lane listing from the audit line with no type error. Today the only production caller passes it.
**Fix:** Make it a required parameter (`laneMode: boolean`) and update the two-argument calls in `test/queueStartGuard.test.ts`, so omission is a compile error.

---

_Reviewed: 2026-11-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
