---
phase: 03-queue-start-guard-tool-error-visibility
reviewed: 2026-10-29T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - controller/server/command_queue.ts
  - controller/server/routers/command_queue.ts
  - controller/components/runs/status/QueueStatuscomponent.tsx
  - controller/test/queueStartGuard.test.ts
  - controller/test/errorPath.test.ts
  - controller/test/staticScan.test.ts
findings:
  critical: 0
  warning: 0
  info: 5
  total: 5
status: issues_found
---

# Phase 3: Code Review Report (incremental re-review)

**Reviewed:** 2026-10-29
**Depth:** standard (diff 4e74ea0..HEAD, commit 5191ffe, for the 6 files above)
**Files Reviewed:** 6
**Status:** issues_found (info only)

## Summary

This is an incremental re-review of the fixes for WR-01 and WR-02. Both prior warnings are resolved, and I found no new blockers or warnings. I ran `vitest` on `queueStartGuard`, `errorPath` and `staticScan`: 91 of 91 tests pass.

### Resolution of the previous warnings

**WR-01 (retry Start swallowed while the loop only notifies): RESOLVED.**
- Both `_notifyFailure` call sites are now `void this._notifyFailure(...)`: the busy-loop catch at `command_queue.ts:1449` and `_start`'s catch at `:951`.
- After a failure the loop does `break` straight after `void _notifyFailure`, so it returns and `_start`'s `finally` clears `_runningPromise` within microtasks. The claim is no longer held across Slack or email I/O.
- `_notifyFailure` cannot produce an unhandled rejection. Its entire body, including the dedupe step and the settings reads, sits inside one outer `try/catch` that only logs a warning. The dedupe key and timestamp are written synchronously before the first `await`, so overlapping notifications cannot both pass the check.
- Ordering is safe. `_recordFailure` and `_setState(FAILED)` run before the notification starts, and the notification reads no queue state afterwards.
- `restart` computes `accepted = !isStartInProgress` and calls `_start()` in the same synchronous turn. `_start` checks `_runningPromise` before any `await`, and its path to claiming `_runningPromise` has no `await` either (`_runBusyLoopWhileQueueNotEmpty` runs synchronously up to its first `await`). The reported `accepted` therefore always agrees with what `_start` does.
- The toast fires only when the server returned `accepted === false`. The check `result && !result.accepted` also tolerates an older server that returns `undefined`. `onSettled` from `stateMutationOpts` is preserved by the spread.
- The new test "a pending failure alert does not hold the queue" uses a never-settling `_notifyFailure` and proves the retry Start is accepted and re-dispatches the same row.

**WR-02 (stack sent to client): RESOLVED.**
- `queueErrorPayload` no longer includes `stack` in either branch.
- Nothing on the client reads `.stack` (grepped under `components/runs`). The stack is still recorded server-side by `logger.error("CommandQueue failed")` and `logger.error("Failed to execute command", e)`.

### Hard constraints, re-checked against the diff

- **No auto-acknowledge, cancel or retry.** `restart` still calls `_start` only on an operator mutation. `enqueueRun` auto-start is still gated on `state === READY`, so it never fires from FAILED. The notification path touches no queue state. Nothing new dispatches a tool.
- **Retry after failure is unchanged.** A FAILED row stays queued, and `_start` still clears `error` and runs `startNext` on the queue head. The change makes this path more reliable, not different.
- **A tool error is never shown as success.** An ignored Start shows a warning toast, not a success toast. The `accepted: false` branch does not clear or alter the banner, and the guard branch changes no state or error.

The info items below are small. IN-04 and IN-05 are new. IN-01 to IN-03 are carried forward unchanged from the previous review, because the files they concern were not touched by commit 5191ffe. They were not re-read this round, and their line numbers are as stated in the previous review.

## Info

### IN-01: A brief window can show the previous failure's text under a new FAILED state

**File:** `controller/components/runs/RunsComponent.tsx:163-167, 229-231`
**Issue:** `state` polls every 1 s and `getError` every 1.5 s. After a restart, `this.error` is cleared server-side. The loop sleeps 1.5 s before dispatching the next step, so a new failure can land before `getError` has ever observed the cleared (null) value. The cached data is then failure A, with A's seq.
- If A was not dismissed, the banner shows A's text for the new failure B until the next poll, for up to about 1.5 s.
- If A was dismissed, the banner stays hidden for that interval.

It self-corrects. It is a transient mis-attribution rather than a success misreport.
**Fix:** Invalidate or refetch `getError` when `stateQuery.data` changes to FAILED, or include the seq in the `state` response.

### IN-02: `updateRunAttributes` is still `async` but now has no `await`

**File:** `controller/components/runs/RunsComponent.tsx:~300-316`
**Issue:** `getRunAttributes` became synchronous, but the wrapper stays `async`. Each effect run therefore returns an unobserved promise, and any thrown error becomes an unhandled rejection instead of a render-time error.
**Fix:** Make it a plain synchronous function, or compute the map with `useMemo([runsInfo.data, groupedCommands])` instead of state plus effect.

### IN-03: A SUCCESS reply with whitespace-only `error_message` fails the step

**File:** `controller/server/toolReply.ts:98-107`
**Issue:** The check `text === ""` means a SUCCESS reply with `" "` is treated as ERROR_FROM_TOOL, and the generic "An error occurred..." text is shown. This is the conservative direction and the tests pin it (D-14). A tool that pads an empty message with whitespace would still fail every run and require a manual retry.
**Fix:** No change needed if this is intended. Add a one-line comment saying the whitespace behaviour is deliberate, so a later reader does not "fix" it into a silent success.

### IN-04: "Start ignored" toast text can be wrong and names a button that does not exist

**File:** `controller/components/runs/status/QueueStatuscomponent.tsx:61-64`
**Issue:** The toast says the queue is "still finishing its previous step" and to "Press Run again in a moment". Two problems:
- The control is labelled "Start" (`:174`), not "Run".
- `isStartInProgress` is also true while the busy loop is parked on an operator modal (pause, message, timer or user form). Pressing "Pause queue" calls `stop()`, which sets OFFLINE and then awaits `_runningPromise`. The loop is itself waiting for the operator's Continue, so the claim lasts until Continue is pressed. The operator then sees the Start button, gets this toast, and retrying "in a moment" will keep failing.

The safe behaviour holds (nothing is dispatched twice), but the guidance can send the operator in circles.
**Fix:** Reword to something like "The queue is still busy (finishing a step or waiting on a message or pause). Start was not applied; try again once it has stopped or after you press Continue." Replace "Run" with "Start".

### IN-05: Doc comment sits on the wrong getter

**File:** `controller/server/command_queue.ts:286-292`
**Issue:** The new `isStartInProgress` getter was inserted between the comment "Read-only accessor for the in-memory running-step record (D-01)" and `get runningStep()`. That comment now sits above `isStartInProgress` and no longer describes it. The one-line comment above `isStartInProgress` is the correct one. The second half of the original comment is orphaned, so `runningStep` has no doc.
**Fix:** Move the "running-step record (D-01)" comment down to sit directly above `get runningStep()`.

---

_Reviewed: 2026-10-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
