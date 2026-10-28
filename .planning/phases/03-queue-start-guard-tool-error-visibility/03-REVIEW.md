---
phase: 03-queue-start-guard-tool-error-visibility
reviewed: 2026-10-29T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - controller/server/command_queue.ts
  - controller/server/queueStartListing.ts
  - controller/server/utils/SqliteQueue.ts
  - controller/server/toolReply.ts
  - controller/server/tools.ts
  - controller/server/routers/command_queue.ts
  - controller/components/runs/RunsComponent.tsx
  - controller/components/runs/status/QueueStatuscomponent.tsx
  - controller/components/runs/list/SwimLaneCommandComponent.tsx
  - controller/components/runs/queuedStartSummary.ts
  - controller/components/runs/queueError.ts
  - controller/components/runs/runOutcome.ts
  - controller/components/runs/storedError.ts
  - controller/components/runs/utils.ts
  - controller/test/errorPath.test.ts
  - controller/test/queuedStartSummary.test.ts
  - controller/test/queueError.test.ts
  - controller/test/queueStartGuard.test.ts
  - controller/test/runOutcome.test.ts
  - controller/test/staticScan.test.ts
  - controller/test/toolReply.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-29
**Depth:** standard (diff against 91ff977)
**Files Reviewed:** 21
**Status:** issues_found

## Summary

I reviewed the phase-3 changes: the single-flight `_start` guard, the Start audit listing, the single operator-text composer (`describeToolReply`), the failure sequence and banner re-arm, the stored-error step card, and the derived run outcome. I also read the tests.

The three hard constraints hold on the paths I traced:

- No new code path acknowledges, cancels or retries a tool. `_recordFailure` only sets the error and bumps the seq. The banner dismiss is local state only. The guard only logs and returns.
- A FAILED row stays queued. `commands.fail` is unchanged, and `startNext` still takes the queue head.
- A tool error is not shown as success.
  - `describeToolReply` maps any non-SUCCESS reply, and a SUCCESS reply with a message, to a failure.
  - `usableCode` suppresses a "SUCCESS" badge.
  - `deriveRunOutcome` returns FAILED for any FAILED row, and the skipped-failure outcome is orange.
  - `ResponseCode` is a string enum, so `String(code)` yields the code name. There is no codeString regression.

I found no blockers. There are two warnings about the guard's operator experience and about data exposure. There are three info items.

## Warnings

### WR-01: Start is silently dropped while the loop is only notifying, so a FAILED-state retry can be swallowed with no operator feedback

**File:** `controller/server/command_queue.ts:910-917` (guard), `:1440-1448` (`_notifyFailure` awaited inside the loop), `controller/server/routers/command_queue.ts:35-37` (restart)
**Issue:** The guard is keyed on `_runningPromise`, not on "a step is in flight". After a step fails, the busy loop still holds `_runningPromise` while it awaits `_notifyFailure`. That call can make Slack and email network calls (`:236-255`). During that window:

- The queue is already FAILED.
- The error banner is already visible.
- No step is running.

The operator can read the error, click Start, and accept the modal, which promises "will be retried first". `_start` then returns early with only a `Queue Start Ignored` log line. The same happens in the up-to-1.5 s sleep at the top of the loop after Pause, and in the tail of `stop()`.

The `restart` mutation does not await `_start` and returns `undefined` either way. The client therefore sees success and the UI shows no sign that the Start did nothing. This is safe, because nothing is dispatched twice. It is still a correctness defect for retry-after-failure: the operator's explicit retry is lost without a signal. The modal caption "A Start is ignored until it ends" only covers STARTED rows, not this window.

**Fix:** Make the outcome observable and narrow the window.

```ts
// command_queue.ts
async _start(source: QueueStartSource = "operator"): Promise<{ started: boolean }> {
  if (this._runningPromise) { /* log */ return { started: false }; }
  ...
  return { started: true };
}
// router
restart: procedure.mutation(async () => {
  // Do not await the whole busy loop; return whether the Start was accepted.
  return { accepted: !CommandQueue.global.isStartIgnoredNow() };
}),
```

Alternatively, release the claim before the notification, so a FAILED queue is startable immediately. For example, run `_notifyFailure` after the loop returns, in `_start`'s `finally`, or fire it without awaiting it inside the loop. Have the UI toast "Start ignored: queue still running" when the response says so.

### WR-02: `getError` now returns `stack` for every error type, including non-tool errors

**File:** `controller/server/routers/command_queue.ts:7-29`
**Issue:** `queueErrorPayload` copies `error.stack` into the payload for both branches. Before this change only the ToolCommandExecutionError branch exposed it. Other errors were returned as a raw `Error`, which SuperJSON serialises as name and message only. Non-tool errors can now carry server file paths and internals to any caller of the unauthenticated `procedure` (the router uses `procedure`, with no auth middleware visible in this file). The Details modal renders the whole payload through `prettyJson`.
**Fix:** Do not send the stack to the client. Log it server-side instead, since it is already logged via `logger.error`.

```ts
// drop `stack: error.stack` from both branches; keep name/message/code/seq
```

If operators need the stack, gate it on an env or debug flag.

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

---

_Reviewed: 2026-10-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
