---
phase: 03-queue-start-guard-tool-error-visibility
verified: 2026-10-29T05:55:00Z
status: human_needed
score: 8/8 must-haves verified
covered_files:
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-01-PLAN.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-01-SUMMARY.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-02-PLAN.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-02-SUMMARY.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-03-PLAN.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-03-SUMMARY.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-04-PLAN.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-04-SUMMARY.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-05-PLAN.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-05-SUMMARY.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-06-PLAN.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-06-SUMMARY.md"
  - "controller/components/runs/RunsComponent.tsx"
  - "controller/components/runs/list/SwimLaneCommandComponent.tsx"
  - "controller/components/runs/queueError.ts"
  - "controller/components/runs/queuedStartSummary.ts"
  - "controller/components/runs/runOutcome.ts"
  - "controller/components/runs/status/QueueStatuscomponent.tsx"
  - "controller/components/runs/storedError.ts"
  - "controller/components/runs/utils.ts"
  - "controller/server/command_queue.ts"
  - "controller/server/queueStartListing.ts"
  - "controller/server/routers/command_queue.ts"
  - "controller/server/toolReply.ts"
  - "controller/server/tools.ts"
  - "controller/server/utils/SqliteQueue.ts"
  - "controller/test/errorPath.test.ts"
  - "controller/test/queueError.test.ts"
  - "controller/test/queueStartGuard.test.ts"
  - "controller/test/queuedStartSummary.test.ts"
  - "controller/test/runOutcome.test.ts"
  - "controller/test/staticScan.test.ts"
  - "controller/test/toolReply.test.ts"
covered_digest: "v3:sha256:d54df5f1a7d3a89838ccf013d67491c5fa4c4e67444c87e72d3bb643f8e051f2"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Run confirmation summary: in galago-web with a fake/simulated tool, queue several steps (include one FAILED retry and rows from two runs) and press Run."
    expected: "Modal keeps header 'Warning' and the simulation-mode sentence, shows 'This Start will run N queued steps from M runs.' plus the failed-retry line, nothing pre-selected, no timer, Accept (teal) then Cancel (ghost); empty queue shows 'The queue is empty.'; narrow width wraps without clipping."
    why_human: "Rendered UI; no jsdom/RTL by project decision. Pure copy/count logic is unit-tested, but the JSX wiring and layout are not exercised."
  - test: "Banner re-arm: queue a failing step, Run, dismiss the error banner, Start again and fail again with the same tool text."
    expected: "Banner reappears on the second failure without any operator action; a long tool message scrolls inside a 160px region with the Details button, code badge and close button still visible."
    why_human: "Rendered/polling behaviour across two failures; only the pure predicate and server seq are unit-tested."
  - test: "Step-card error line: after a failure, dismiss the banner, then reload the page / restart galago-web."
    expected: "The FAILED card still shows the stored tool message clamped to 3 lines with the full text in its title; 3 clamped lines plus the image fit the 165px card; a plain operator Skip shows no text and stays dimmed; a skip after failure shows 'Skipped after failure: <text>' at full opacity."
    why_human: "Visual clamp/overflow in a fixed-height card; no rendering harness."
  - test: "Skipped-failure run outcome: fail a step, Skip it, let the remaining steps complete."
    expected: "The run row shows an orange 'Skipped failure' badge and orange progress bar (never teal/green or a check icon), wrapping cleanly at narrow widths, even when later steps are COMPLETED."
    why_human: "Rendered badge/colour; only deriveRunOutcome/runOutcomeBadge/runProgressColorScheme are unit-tested."
behavior_unverified_items: []
advisory_review_findings:
  - id: WR-01
    note: "Start is ignored (and audited) while the busy loop holds _runningPromise but is only awaiting _notifyFailure (queue already FAILED, no step in flight), so an operator retry in that short window is dropped with no UI signal. Safe (nothing double-dispatched; 'Queue Start Ignored' is logged) so the roadmap success criterion holds, but the Run confirmation text 'will be retried first' can be briefly untrue. Open in 03-REVIEW-DISPOSITION.md."
  - id: WR-02
    note: "getError payload now includes `stack` for non-tool errors too (information exposure to any caller of the unauthenticated router). Not a must-have of this phase. Open."
---

# Phase 3: Queue Start Guard & Tool Error Visibility Verification Report

**Phase Goal:** A Start, restart or enqueue never dispatches a queue row that is already in flight; the operator sees before confirming what a Start will run; and when a tool step fails, the operator sees the tool's own message wherever the failure shows, and no tool error is ever shown as success.
**Verified:** 2026-10-29
**Status:** human_needed (all automated truths verified; rendered-UI items routed to UAT)
**Re-verification:** No, initial verification

## Gate Evidence (run in this verification)

| Gate | Command | Result |
| ---- | ------- | ------ |
| QUE-09 untouched | `git diff --stat 5726822 -- controller/test/toolControl.test.ts controller/test/sqliteQueue.test.ts controller/test/queueRestart.test.ts` | empty output (no diff) |
| Unit tests | `cd controller && npm run test:unit` | 20 files / 428 tests passed |
| Types | `npx tsc --noEmit` | exit 0, no output |
| errorPath unchanged since red | `git diff 8eb3432 HEAD -- controller/test/errorPath.test.ts` | empty (expectations not weakened after the red commit) |
| Debt markers | grep TBD/FIXME/XXX in added lines of all phase files | none |

Red-then-green ordering is visible in git: `f21a4be`/`8eb3432` (errorPath, red) precede the production fixes `c6d9404`/`cdf48db` (03-04); `7b2cd16`/`0081212`/`f5edd27`/`67996f0` tests precede their implementations.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | While a step is in flight, Run/restart/enqueue does not dispatch the row twice; tool gets one executeCommand; queue stays running; Logs record "Queue Start Ignored" | VERIFIED | `command_queue.ts:905-918`: `_start` first statement is `if (this._runningPromise) { logAction(warning "Queue Start Ignored" ...); return; }`; no await before the `_runningPromise` claim at :933 (listing read is synchronous via `queuedRowsSync`). Router `restart` (routers/command_queue.ts:35) and `enqueueRun` (`this._start("enqueue")`, :1476) both go through it. `queueStartGuard.test.ts` asserts `toHaveBeenCalledTimes(1)` on the Tool spy for restart, direct, same-tick, pause-then-start and enqueue cases, and exactly 1 ignored log; ran green. |
| 2 | Run confirmation shows queued rows to run, FAILED retries, distinct runs, read-only, nothing pre-selected, no timer; after Start, Logs list queue_ids and run_ids | VERIFIED (logic + wiring); rendering is UAT | `queuedStartSummary.ts` pure counts (CREATED/FAILED counted, STARTED separate); `QueueStatuscomponent.tsx:45` uses `commandQueue.commands` (queue-joined) and maps `queuedStartLines(...)` to read-only `Text`; modal has only Accept/Cancel, no autoFocus/initialFocusRef/timer (grep clean; static scan UI-08 case). `_start` logs "Queue Started" with `_describeQueueStart(source)` built from `queuedRowsSync()` (queueId/runId/status, FAILED count, capped listing). Unit + guard tests green. |
| 3 | FAILED step stays queued and re-runs first on next Start; retry/h0q/o44/t9e regression tests pass unmodified | VERIFIED | Protected test files show zero diff vs 5726822; toolControl/sqliteQueue/queueRestart suites pass within the 428 green tests; `startNext/complete/fail*` untouched (only `_recordFailure` swap at failure sites). |
| 4 | Test, written failing first, drives each tool response code through the queue and pins message/code/stored error | VERIFIED | `errorPath.test.ts` (339 lines) typed `Record<ResponseCode,...>`, committed red in f21a4be/8eb3432, unchanged since, now green. |
| 5 | Failed step shows tool's own text: ERROR_FROM_TOOL text itself; other codes tool text next to generic sentence; badge and log show real code name, never UNKNOWN | VERIFIED | `toolReply.ts` `describeToolReply` is the single composer (generic + " Tool said: " + text; ERROR_FROM_TOOL -> `Error from tool "<id>": <text>`); `tools.ts:601-608` throws `ToolCommandExecutionError(failure.message, failure.code)` and logs `Code: ${failure.code}`; `ResponseCode` is a string enum so `codeString = String(code)` is the name (toolReply.test asserts `codeString === code`); router `queueErrorPayload` passes message verbatim; `describeQueueError`/`usableCode` hide SUCCESS/UNKNOWN badges. |
| 6 | Failed step card shows stored error incl. after banner cleared / restart; after dismiss, next failure shows banner again | VERIFIED (logic + wiring); rendering is UAT | `SwimLaneCommandComponent.tsx:49,163-173` renders `stepErrorText(command)` from the persisted row (`getAll`), noOfLines=3, title=full text. `queueError.test.ts` includes persistence tests (clearError, reopened SQLite file). Banner: `shouldShowErrorBanner(state, bannerError, dismissedSeq)` + `setDismissedSeq(errorSeq(bannerError))` (RunsComponent.tsx:231,274); server `_recordFailure` bumps `_failureSeq` (seeded `Date.now()`) at every failure site (fail(), `_start` catch, busy-loop catch; only 3 `this.error =` assignments besides clears); `getError` returns `seq`. |
| 7 | Failed step never shown as completed; SUCCESS reply carrying an error message is an error; run whose failed step was skipped is not plain success | VERIFIED (logic + wiring); rendering is UAT | `describeToolReply`: SUCCESS with non-empty text -> `ERROR_FROM_TOOL`, step FAILs; `CheckCircle` only under `status === "COMPLETED"` (Swimlane:111); `deriveRunOutcome` returns FAILED for any FAILED row and `COMPLETED_WITH_SKIPPED_FAILURE` for skipped-with-error even if last step COMPLETED; `getRunAttributes(runInfo, run.Commands)` passes the full array (RunsComponent:309); orange badge/progress via `runOutcomeBadge`/`runProgressColorScheme`. `RunStatus` not widened. |

**Score:** 8/8 requirements verified (7/7 roadmap truths verified at logic and wiring level; 0 behavior-unverified; rendered aspects routed to UAT).

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `controller/server/command_queue.ts` | VERIFIED | guard, listing, `_recordFailure`, `failureSeq` all present and wired |
| `controller/server/utils/SqliteQueue.ts` | VERIFIED | `queuedRowsSync()` synchronous queue-joined read, position order |
| `controller/server/queueStartListing.ts` | VERIFIED | imported by command_queue.ts |
| `controller/server/toolReply.ts` | VERIFIED | used by tools.ts executeCommand |
| `controller/server/tools.ts`, `routers/command_queue.ts` | VERIFIED | compose/throw via describeToolReply; payload with seq |
| `controller/components/runs/{queuedStartSummary,storedError,runOutcome,queueError,utils}.ts`, `RunsComponent.tsx`, `QueueStatuscomponent.tsx`, `SwimLaneCommandComponent.tsx` | VERIFIED | all substantive and imported/used (see key links) |
| Tests: errorPath, queueStartGuard, toolReply, queueError, runOutcome, queuedStartSummary, staticScan additions | VERIFIED | exist above min_lines, green |

### Key Link Verification

| From | To | Status |
| ---- | -- | ------ |
| router `restart` -> `CommandQueue.global._start()` | guard inside `_start` | WIRED |
| `enqueueRun` -> `this._start("enqueue")` | same guarded `_start` | WIRED |
| `_describeQueueStart` -> `queuedRowsSync()` | no await before claim | WIRED |
| `tools.ts` -> `describeToolReply(command.command, command.toolId, reply)` | throws ToolCommandExecutionError | WIRED |
| router `getError` -> `CommandQueue.global.failureSeq` | payload seq | WIRED |
| fail / `_start` catch / busy-loop catch -> `_recordFailure` | single failure site | WIRED |
| `QueueStatuscomponent` -> `commandQueue.commands.useQuery` + `queuedStartLines(` | read-only modal lines | WIRED |
| `RunsComponent` -> `shouldShowErrorBanner(...)`, `setDismissedSeq(errorSeq(...))` | banner re-arm | WIRED |
| `SwimLaneCommandComponent` -> `stepErrorText(command)` | card error line | WIRED |
| `utils.getRunAttributes` -> `deriveRunOutcome`; `RunsComponent` -> `runOutcomeBadge`/`runProgressColorScheme` | outcome display | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| Run confirmation modal | `queuedCommandsQuery.data` | `commandQueue.commands` -> getPaginated (queue-joined SQLite) | yes | FLOWING |
| Error banner | `getError.data` | `CommandQueue.getError()` + `failureSeq` | yes | FLOWING |
| Step card error | `command.error` | persisted row via `getAll` | yes | FLOWING |
| Run row outcome | `run.Commands` | polled rows | yes | FLOWING |

### Requirements Coverage (PLAN frontmatter vs REQUIREMENTS.md)

IDs claimed across plans: 03-01 {QUE-07, QUE-08, QUE-09}, 03-02 {ERR-01}, 03-03 {QUE-08}, 03-04 {ERR-01, ERR-02, ERR-04, ERR-05}, 03-05 {ERR-05}, 03-06 {ERR-03, ERR-04, ERR-05}. All 8 phase IDs are accounted for; no ORPHANED requirements (REQUIREMENTS.md traceability maps exactly these 8 to Phase 3).

| Requirement | Source Plans | Status | Evidence |
| ----------- | ------------ | ------ | -------- |
| QUE-07 | 03-01 | SATISFIED | Guard + audited ignore + call-count tests (Truth 1) |
| QUE-08 | 03-01, 03-03 | SATISFIED (rendering = UAT) | Truth 2 |
| QUE-09 | 03-01, 03-04, 03-06 | SATISFIED | zero diff on protected tests; suites green (Truth 3) |
| ERR-01 | 03-02, 03-04 | SATISFIED | red-first errorPath table, now green (Truth 4) |
| ERR-02 | 03-04 | SATISFIED | Truth 5 |
| ERR-03 | 03-06 | SATISFIED (rendering = UAT) | stored-error step card (Truth 6) |
| ERR-04 | 03-04, 03-06 | SATISFIED | server seq + client dismissedSeq verified in code (checkbox timing was irrelevant; verified against code after 03-05/03-06) |
| ERR-05 | 03-04, 03-05, 03-06 | SATISFIED (rendering = UAT) | SUCCESS-with-message -> error; no check on FAILED; skipped-failure outcome (Truth 7) |

### Prohibitions

| Prohibition | Tier | Status |
| ----------- | ---- | ------ |
| Ignored Start changes no state/error/_failedAttempt; no auto acknowledge/cancel/retry/skip | test | Held: guard returns before `_failedAttempt` reset and `this.error = undefined`; pinned by static scan on guard ordering and guard tests |
| Protected regression test files unmodified | test | Held (git diff empty) |
| Run confirmation gains no timer/default/autoFocus/form/new button | test | Held (grep clean; staticScan UI-08 case) |
| Summary must not promise un-run rows (count only CREATED/FAILED queue-joined; STARTED separate) | test | Held (`summarizeQueuedStart`) |
| No tool error reported as success; tool text not rewritten; banner dismissal never clears error | test | Held (`describeToolReply`, `usableCode`, dismiss only stores seq) |
| No schema widening of RunStatus; no motion in tests | test | Held (client-only RunOutcome union; fakes only) |
| failing test not weakened | judgment | Held (errorPath unchanged since red commit); judgment-tier, non-authoritative |

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX in added lines. `status: "UNKNOWN"` in `utils.ts:11` / `RunsComponent.tsx:357` is the pre-existing no-run-info placeholder, not a tool error label.

### Behavioral Spot-Checks

| Behavior | Command | Result |
| -------- | ------- | ------ |
| Whole unit suite incl. guard, errorPath, toolReply, queueError, runOutcome, queuedStartSummary, staticScan | `npm run test:unit` | PASS (428/428) |
| Types | `npx tsc --noEmit` | PASS |

Probe execution: SKIPPED (no probes declared by this phase).

### Human Verification Required

See frontmatter `human_verification` (4 items): Run confirmation rendering, banner re-arm across two failures, step-card clamp/persistence, orange skipped-failure badge. These are the rendered-UI items the project routes to UAT because no jsdom/RTL exists; their pure logic is unit-tested and their wiring verified above.

### Advisory (not failing a must-have)

- **WR-01 (open):** an operator Start pressed in the short window after a failure, while the busy loop is only awaiting `_notifyFailure`, is ignored (audited) with no UI feedback; the retry is not lost permanently, the next Start runs it. Roadmap criterion 1 and 3 hold, but consider closing before relying on the "will be retried first" caption.
- **WR-02 (open):** `queueErrorPayload` returns `stack` for all error types; trim in a follow-up.
- IN-01..IN-03 open, informational.

### Gaps Summary

No gaps. Every roadmap success criterion and requirement is backed by code and by green tests; the QUE-09 no-diff gate holds. Status is `human_needed` solely because rendered UI behaviour has no automated harness and is by project decision a UAT item.

---

_Verified: 2026-10-29_
_Verifier: Claude (gsd-verifier)_
