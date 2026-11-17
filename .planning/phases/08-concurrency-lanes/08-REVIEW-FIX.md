---
phase: 08-concurrency-lanes
fixed_at: 2026-11-17T08:33:00Z
review_path: .planning/phases/08-concurrency-lanes/08-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-11-17
**Source review:** .planning/phases/08-concurrency-lanes/08-REVIEW.md (WR-05, WR-07) and the earlier full-phase review at commit 6433f5c (WR-01, WR-04)
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

WR-02, WR-03 and WR-06 were already fixed before this run and were left alone. Info findings were out of scope.

**Verification environment:** the fixes were made and committed in an isolated git worktree. The full gates ran inside that worktree, with `controller/node_modules` symlinked from the main checkout. The numbers can be reproduced from the main checkout after the fast-forward.
- `npx vitest run` (controller/): 48 files, 1378 tests, all passed.
- `npx tsc --noEmit` (controller/): no errors.
- `test/lanesFlagOff.test.ts` passed (20 tests). `test/fixtures/lanesFlagOff.golden.ts` was not edited.

## Fixed Issues

### WR-01: Non-canonical `laneBarrier` / `lane` values are silently ignored and are not rejected by `validateLanes`

**Files modified:** `controller/server/laneScheduling.ts`, `controller/test/laneScheduling.test.ts`
**Commit:** 4c494a4
**Applied fix:** Still applied to the current code. Added rule 0 to `validateLanes`. It refuses a present `laneBarrier` that is not a boolean ("Step N: "Wait for all earlier steps" must be on or off.") and a present `lane` that is not text ("Step N: the lane name must be text."). The messages live in `laneMessages`. The `laneOf` comment, which wrongly said a bad tag can only make dispatch more sequential, was corrected, and `isBarrier` got a comment. A `lane: null` is refused too, because stored JSON has no `undefined`. `validateLanes` is only called when the server's lane mode is on (`runs.ts`, `routers/protocol.ts`), so the flag-off path is unchanged. Tests cover a string barrier, a numeric barrier, a numeric lane and a null lane. They also check that boolean barriers and absent or text lanes still pass.

### WR-04: `ErrorBanner` is a component declared inside render, so the new failure list remounts and loses its scroll position

**Files modified:** `controller/components/runs/RunsComponent.tsx`, `controller/test/laneReviewFixes.test.ts`
**Commit:** 8b8786c
**Applied fix:** Still applied to the current code. The banner is now rendered as `{ErrorBanner()}` instead of `<ErrorBanner />`. It uses no hooks, so a plain call is safe. I kept the name `ErrorBanner` because `staticScan.test.ts` extracts the function by that name. A comment explains why.
**Test limitation:** vitest here runs in a node environment with no DOM renderer (no jsdom or react-test-renderer), so a remount cannot be observed. The regression test therefore reads the source of `RunsComponent.tsx` with comments stripped. It checks that `<ErrorBanner` is not mounted as an element and that `{ErrorBanner()}` is present. This is a source-text assertion, not a behaviour test.

### WR-05: The first entry of the failure list is assumed to be the banner error, which is false after `clearError()`

**Files modified:** `controller/server/command_queue.ts`, `controller/server/laneScheduling.ts`, `controller/components/runs/laneStatus.ts`, `controller/test/laneUi.test.ts`, `controller/test/laneReviewFixes.test.ts`
**Commit:** 9b25bec
**Applied fix:** `LaneFailureEntry` gained an optional `banner` flag. In `_recordFailure`, the entry created when no error is set (so it becomes the banner error) gets `banner: true`, and the flag is cleared on all earlier entries. `describeLaneFailures` now hides the message only for the entry with `banner === true`, and no longer assumes index 0. When the banner entry is not first, it is labelled "Shown above", a new `BANNER_FAILURE_NOTE`. The first-entry label "First failure, shown above" is unchanged. The `laneUi` fixture `f1` was given `banner: true`, which is the real server shape.
**Behaviour tests:** the new tests in `laneReviewFixes.test.ts` use a real `CommandQueue` through the lane harness. Scenario one: the fast lane fails, the operator calls `clearError()`, then the primary lane fails. The test checks that the banner flags are `[false, true]` and that the fast lane's message appears in the list while the primary lane's message is hidden. Scenario two: with no clear, the first entry stays the banner. A pure test in `laneUi.test.ts` covers the non-first banner entry.
**Note:** the "Lane Halt Additional Failure" audit line's `firstLane` field is the banner failure's lane (`_bannerFailureLane`). After a clear it now names the new banner lane, which matches what the banner shows. I did not change the audit text.
**Status:** fixed: requires human verification (the finding is a state-handling logic error, and the new tests check the intended behaviour).

### WR-07: The protocol editor states "runs its steps one at a time" before the server mode is known, and still shows lane refusals that are not applied

**Files modified:** `controller/components/protocols/laneFields.ts`, `controller/components/protocols/ProtocolDetailView.tsx`, `controller/test/laneUi.test.ts`
**Commit:** d09a047
**Applied fix:** Added a pure helper `laneUiState(query)` returning `"active" | "off" | "unknown"` (only a successful `laneStatus` read counts) and `laneSummaryView(state)` returning the note and whether to show the warnings. The "one at a time" note (`LANE_INERT_SERIAL_NOTE`) now shows only when the server is confirmed off. Loading or error shows no note. `LaneWarningsAlert` for `visualSummary.warnings` is hidden when the server is confirmed off, because the server applies `validateLanes` only in lane mode. It still shows when the mode is active or unknown. The server-sourced `previewLaneWarnings` alert is untouched. The IN-06 source-text assertion for `{!lanesActive && (` was updated to the new call, and behaviour tests were added for the helpers.
**Status:** fixed: requires human verification (the finding is a UI-state logic error).

---

_Fixed: 2026-11-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
