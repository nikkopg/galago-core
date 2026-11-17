---
phase: 08-concurrency-lanes
reviewed: 2026-11-17T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - controller/components/protocols/ProtocolDetailView.tsx
  - controller/components/protocols/laneFields.ts
  - controller/components/runs/RunsComponent.tsx
  - controller/components/runs/laneStatus.ts
  - controller/server/command_queue.ts
  - controller/server/laneScheduling.ts
  - controller/test/laneReviewFixes.test.ts
  - controller/test/laneScheduling.test.ts
  - controller/test/laneUi.test.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 8: Code Review Report (incremental re-review after fix commits 4c494a4, 8b8786c, 9b25bec, d09a047)

**Reviewed:** 2026-11-17
**Depth:** standard
**Files Reviewed:** 9

## Summary

This is an incremental review of `git diff 8ece3ad..HEAD` for the nine files, read in the context of the full files and the call sites of the changed functions.

Verdict per fix:

- **WR-01 (validateLanes rule 0): correct for the case it targets, with a small policy gap.** A boolean `laneBarrier` (true or false), an absent key, `lane: ""` and a text lane are all still accepted. This holds for every writer in the repo. `setBarrier` and `setLane` delete the key rather than writing `false` or `""`, and the script executor writes `lane` and `laneBarrier` only when set. Rule 0 is reached only under `laneMode === true`: `runs.ts:251`, `command_queue.ts:2144` and `routers/protocol.ts:270` are all gated, so GALAGO_PARALLEL_LANES off is unchanged on the server. The remaining gap is `lane: null` and `laneBarrier: null` (see WR-10).
- **WR-04 (ErrorBanner as a function): correct.** The banner body uses no hooks, because `useLaneStatus` and the other hooks sit outside it. `LaneFailureList` is still mounted as an element inside the call, so its identity is stable. Nothing else renders `<ErrorBanner`.
- **WR-05 (banner flag): correct for the `_recordFailure` path that carries a context, incomplete elsewhere.** Entries are flagged and the flag moves when a new banner failure replaces the old one. A path that sets `this.error` without a context leaves a stale flag (see WR-08). Lane-off behaviour is unchanged, because the whole block is inside `if (this._laneMode && ctx)` and `laneStatus` returns no failures in that mode.
- **WR-07 (unknown / off / active): the "unknown" state is correct and a real improvement.** The "off" state now has a side effect on summaries that contain only refusals (see WR-09).

No critical issues were found.

## Warnings

### WR-08: A failure recorded without a lane context leaves a stale `banner` flag, which hides the message of a failure that is no longer the banner

**File:** `controller/server/command_queue.ts:521-557` (callers at 237, 1151 and 1180)
**Issue:** The new flag-moving logic sits inside `if (this._laneMode && ctx)`. Three paths record a failure without a context in lane mode:
- the public `fail(error)` at line 233
- the non-lane `_start` catch at line 1151
- `_failStart(e)` when no `ctx` is passed

Take two or more listed failures where entry k has `banner: true`. After `clearError()`, such a path runs `this.error = error`. The banner now shows the new, unlisted message. Entry k keeps `banner: true`, so `describeLaneFailures` blanks its message and labels it "Shown above", but the banner shows a different error. The message of that earlier failure then appears nowhere. This is the same defect class as WR-05 on a path the fix did not cover. The scenario needs an operator `clearError()` and a context-free failure while lane failures are listed, which is narrow.
**Fix:** Clear the flags whenever the error slot is being refilled in lane mode, regardless of `ctx`.
```ts
private _recordFailure(error: Error, ctx?: LaneFailureContext): void {
  this._failureSeq += 1;
  const becomesBanner = !this.error;
  if (this._laneMode && becomesBanner) {
    for (const entry of this._laneFailures) entry.banner = false;
  }
  if (this._laneMode && ctx) {
    // ... push with banner: becomesBanner, as now ...
  }
  this.error = error;
}
```
Keep the existing early return for a context-bearing failure that does not become the banner.

### WR-09: In off mode, a summary that holds only refusals now renders an empty "Lane summary" section with the "one at a time" note

**File:** `controller/components/protocols/ProtocolDetailView.tsx:774-786`, `controller/components/protocols/laneFields.ts:169-176` and `49-53`
**Issue:** `buildLaneSummary` returns `{ groups: [], warnings }` when no step is on a secondary lane but `validateLanes` has messages. Two earlier changes make that case reachable in more situations. Rule 0 now yields a warning for a wrong-typed tag such as `lane: 5` or `laneBarrier: "true"`, where previously the summary was null. Separately, `laneSummaryView("off")` now hides the warnings (WR-07). For a protocol with such a tag on a server confirmed off, the editor shows the heading "Lane summary" and the inert note, then nothing: no groups and no warnings. The protocol did not have lane tags the server would honour, so the section is noise. It also changes the off-mode UI for a protocol that rendered no summary before. The same happens with the long-standing invalid-name warning.
**Fix:** Show the section in off mode only when there are groups to show.
```tsx
{protocol.mode !== "script" && visualSummary &&
  (laneView.showWarnings || visualSummary.groups.length > 0) && ( ... )}
```
Or have `laneSummaryView` take the summary and return `null` when `state === "off"` and `groups.length === 0`.

### WR-10: Rule 0 refuses `lane: null` and `laneBarrier: null`, and treats `undefined` differently for the two tags

**File:** `controller/server/laneScheduling.ts:276-285`
**Issue:** The `lane` check tolerates a present `undefined` (`ap.lane !== undefined`). The `laneBarrier` check does not: `hasOwn(ap, "laneBarrier") && typeof ap.laneBarrier !== "boolean"` refuses `{ laneBarrier: undefined }`. The two tags need the same policy. In practice `undefined` is dropped by JSON, so this only affects in-memory objects such as client-side previews, and no writer in the repo produces it.

`null` is the more realistic concern. The type in `types/run.ts` is `laneBarrier?: boolean`, but stored command JSON is untrusted (a protocol import or an external exporter could write `null` for "unset"). Dispatch used to read `lane: null` as primary and `laneBarrier: null` as no barrier. Under lane mode such a stored protocol is now refused at run creation. The test pins this for `lane: null`. The refusal is announced with a message, so it is safe. It is still a behaviour change for a protocol that previously ran. It cannot be fixed from the editor without editing every affected step.
**Fix:** Decide the policy and apply it to both tags. The safer-for-existing-data option treats `null` and `undefined` as absent.
```ts
const present = (v: unknown) => v !== undefined && v !== null;
if (hasOwn(ap, "laneBarrier") && present(ap.laneBarrier) && typeof ap.laneBarrier !== "boolean") ...
if (hasOwn(ap, "lane") && present(ap.lane) && typeof ap.lane !== "string") ...
```
If refusing `null` is deliberate, keep it, but make the `undefined` handling of `laneBarrier` match `lane` and add a test for it.

## Info

### IN-01: The "no dispatch after halt" guarantee still depends on the SQLite driver being synchronous

**File:** `controller/server/command_queue.ts` (`_runSideLane`, claim then `await this._shouldSkip(...)` before `_sideRunning.set`)
**Issue:** Unchanged by these fix commits and still applies. A latch or freeze that lands during the await is not re-checked before `executeCommand`, and the claimed row is invisible to the busy-tool gate and `toolControl` during that window. Today `better-sqlite3` makes the window unreachable. An async driver would open it.
**Fix:** Re-check the gate after the await and before `executeCommand`, and register the row in `_sideRunning` before the await.

### IN-05: The per-lane start summary numbers steps by queue position, not by protocol position

**File:** `controller/components/runs/queuedStartSummary.ts:80-97`
**Issue:** Unchanged and still applies. After a partial run or a retry, the step numbers in "Steps by lane" do not match the "Generated Commands" numbering.
**Fix:** Carry the original step index on the row, or label the list as "remaining steps".

### IN-06: The UI wiring tests assert on source text, not behaviour

**File:** `controller/test/laneUi.test.ts` ("the editor names the inert lanes and the queue passes its lane mode to the audit line"), `controller/test/laneReviewFixes.test.ts` ("WR-04" block)
**Issue:** These tests read component files as strings. The WR-07 change had to edit one fragment (`"{!lanesActive && ("` became `"laneSummaryView(laneUiState(laneStatusQuery))"`), which shows how brittle they are. The WR-04 test passes as long as `{ErrorBanner()}` appears in a non-comment line. It does not prove the banner is not remounted, and it fails on a harmless rename. The new pure helpers (`laneUiState`, `laneSummaryView`, `describeLaneFailures`) are tested by behaviour, which is good. The wiring around them is still unverified.
**Fix:** If a DOM test setup is added (jsdom plus Testing Library), replace the string checks with a render test that counts mounts across a rerender.

### IN-07: `describeQueueStart` defaults `laneMode` to false

**File:** `controller/server/queueStartListing.ts:49-53`
**Issue:** Unchanged and still applies. A caller that forgets the argument silently drops the lane listing from the audit line, with no type error.
**Fix:** Make the parameter required.

### IN-08: `laneUiState` treats `isSuccess` with missing data as "off"

**File:** `controller/components/protocols/laneFields.ts:38-44`
**Issue:** `isSuccess: true` with `data` undefined or null returns `"off"`, and the test pins this (`laneUiState({ isSuccess: true, data: undefined })` is `"off"`). That state is not reachable with the tRPC query (`isSuccess` implies data), but if it did occur, the editor would claim "one at a time" without the server having confirmed lanes off. That is the case WR-07 set out to avoid. A query that errors after a prior success reports `isSuccess: false` and flips to "unknown" while stale data exists, which is acceptable.
**Fix:** Return `"unknown"` unless `typeof query.data?.laneMode === "boolean"`.
```ts
if (!query.isSuccess || typeof query.data?.laneMode !== "boolean") return "unknown";
return query.data.laneMode ? "active" : "off";
```

---

_Reviewed: 2026-11-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
