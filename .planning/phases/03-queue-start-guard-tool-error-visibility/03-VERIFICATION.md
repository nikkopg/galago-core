---
phase: 03-queue-start-guard-tool-error-visibility
verified: 2026-10-29T01:15:00Z
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
covered_digest: "v3:sha256:c9bf8765e57b9611cf9dd97ef1ba09b1ee753d4e9f43e0a5e23b0b39d9f8687e"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "An ignored Start is not an error to the caller: commandQueue.restart resolves to undefined and no toast or exception is produced (D-02)"
    reason: "WR-01 fix reverses CONTEXT D-02 at the user's request: restart now returns { accepted } and an ignored Start shows a 'Start ignored' warning toast. It is still not an error/exception and changes no queue state. Recorded in 03-REVIEW-DISPOSITION.md. Plan-level truth only; no ROADMAP success criterion or requirement text mentions a toast."
    accepted_by: "user (recorded in 03-REVIEW-DISPOSITION.md)"
    accepted_at: "2026-10-29T00:00:00Z"
re_verification:
  previous_status: human_needed
  previous_score: 8/8
  gaps_closed: []
  gaps_remaining: []
  regressions: []
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
  - test: "Ignored-Start warning and immediate retry after failure (03-UAT item 5): right after a step fails, press Run and Accept; separately, Pause queue then press Run during a step."
    expected: "The retry starts immediately after a failure (no 'Start ignored' toast). Pressing Run while the queue is still busy shows a 'Start ignored' warning toast and nothing is dispatched twice."
    why_human: "Rendered toast and live timing between UI polling and the server busy loop; the server accepted/ignored contract is unit-tested but the toast firing is not."
behavior_unverified_items: []
advisory_review_findings:
  - id: IN-01
    note: "A brief window can show the previous failure's text under a new FAILED state (poll timing). Info only, open."
  - id: IN-02
    note: "updateRunAttributes is still async with no await. Info only, open."
  - id: IN-03
    note: "A SUCCESS reply with whitespace-only error_message fails the step. Info only, open."
---

# Phase 3: Queue Start Guard & Tool Error Visibility Verification Report

**Phase Goal:** A Start, restart or enqueue never dispatches a queue row that is already in flight; the operator sees before confirming what a Start will run, so a stale leftover row is never a surprise; and when a tool step fails, the operator sees the tool's own message wherever the failure shows, and no tool error is ever shown as success.
**Verified:** 2026-10-29
**Status:** human_needed (all automated truths verified; rendered-UI items routed to UAT)
**Re-verification:** Yes. The prior report (human_needed, 8/8, no gaps) went stale after review-fix commits 5191ffe and 06fc3ea changed covered code. Every must-have was re-checked against the current tree, with focus on what those commits touch.

## Gate Evidence (run in this verification)

| Gate | Command | Result |
| ---- | ------- | ------ |
| QUE-09 untouched | `git diff --stat 5726822 -- controller/test/toolControl.test.ts controller/test/sqliteQueue.test.ts controller/test/queueRestart.test.ts` | empty output (no diff) |
| Unit tests | `cd controller && npm run test:unit` | 20 files / 434 tests passed (was 428; +6 from the WR-01/WR-02 tests) |
| Types | `npx tsc --noEmit` | exit 0, no output |
| Debt markers | grep TBD/FIXME/XXX in command_queue.ts, routers/command_queue.ts, QueueStatuscomponent.tsx | none |
| Probes | none declared by this phase | SKIPPED |

## Review-fix delta (5191ffe, 06fc3ea) against the must-haves

Read the diff and the resulting code directly.

- **WR-01.** Both `_notifyFailure` calls (`command_queue.ts:951` in the `_start` catch, `:1449` in the busy-loop catch) are now `void this._notifyFailure(...)`. In the busy-loop catch the order is `_recordFailure` -> `_setState(FAILED)` -> Command Failed log -> `void notify` -> `break`, with no await between, so `_runningPromise` clears within microtasks. `_notifyFailure` (line 217) wraps its entire body in one try/catch, so a fire-and-forget call cannot produce an unhandled rejection. The router `restart` computes `accepted = !queue.isStartInProgress` and calls `_start()` in the same synchronous turn, and `_start` checks `_runningPromise` before any await, so `accepted` matches what `_start` does. A new test with a never-settling `_notifyFailure` shows the retry Start is accepted, produces no "Queue Start Ignored" log, and re-dispatches the same row (`spy` called 2 times, tag r1).
- **WR-02.** `queueErrorPayload` has no `stack` in either branch. No client code reads `.stack` (only an unrelated telemetry file). `errorPath.test.ts` pins `getError` with no `stack` property for a tool error and a non-tool error.
- **06fc3ea** changes toast wording and one comment position only.

Effect on the named must-haves:

- **QUE-07 single-flight still holds.** The guard (`command_queue.ts:910-918`) is unchanged: first statement in `_start`, returns before the `_failedAttempt` reset and `this.error = undefined`. The only change is that the claim is released sooner, and only after the queue is already FAILED with no step in flight. The in-flight-step cases (restart, direct, same-tick, pause-then-start, enqueue) still assert one Tool call, and the "restart during a running step" test now asserts `{ accepted: false }`. All pass. `enqueueRun` auto-start is still gated on `state === READY`, so it never fires from FAILED.
- **QUE-09 retry-after-failure holds.** The protected files are byte-identical to 5726822 and pass. `startNext/complete/fail*` are untouched. The FAILED row stays queued and re-runs first (the new WR-01 test shows it). Retry is now more reliable.
- **ERR-04 holds.** `_recordFailure` still bumps the clock-seeded `failureSeq` at every failure site, and `getError` still returns `seq` in the payload. The non-awaited notify does not touch seq or error.
- **ERR-05 holds.** The ignored-Start toast is a warning, not a success. The `accepted: false` branch does not clear or alter the banner or the queue error.
- **Prohibitions.** An ignored Start still changes no state, error or `_failedAttempt`. The toast is client-only, so "no auto acknowledge/cancel/retry/skip" is not violated.
- **Intentional deviation.** The WR-01 toast reverses CONTEXT D-02 and 03-01-PLAN's plan-level truth "restart resolves to undefined and no toast". This was done at the user's request and is recorded in 03-REVIEW-DISPOSITION.md. It is carried as an override above. It does not touch any ROADMAP success criterion or REQUIREMENTS text, and no test still asserts the old `undefined` contract (updated in 5191ffe, green).

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | While a step is in flight, Run/restart/enqueue does not dispatch the row twice; queue stays running; Logs record "Queue Start Ignored" | VERIFIED | `command_queue.ts:910-918` guard is the first statement of `_start`. `restart` and `enqueueRun` (`this._start("enqueue")`) both route through it. `queueStartGuard.test.ts` asserts the Tool spy is called once and one ignored log for restart, direct, same-tick, pause-then-start and enqueue. Ran green (434/434). |
| 2 | Run confirmation shows queued rows to run, FAILED retries, distinct runs, read-only, nothing pre-selected, no timer; after Start, Logs list queue_ids and run_ids | VERIFIED (logic + wiring); rendering is UAT | `queuedStartSummary.ts` pure counts. `QueueStatuscomponent.tsx:45` uses `commandQueue.commands` (queue-joined) and maps `queuedStartLines(...)`. The modal has no autoFocus/timer (staticScan). `_start` logs "Queue Started" with `_describeQueueStart(source)` from `queuedRowsSync()`. Unit and guard tests are green. |
| 3 | FAILED step stays queued and re-runs first on next Start; retry/h0q/o44/t9e regression tests pass unmodified | VERIFIED | Protected test files have zero diff vs 5726822; suites are green. New WR-01 test shows a retry after FAILED re-dispatches the same row. |
| 4 | Test, written failing first, drives each tool response code through the queue and pins message/code/stored error | VERIFIED | `errorPath.test.ts` (`Record<ResponseCode,...>`, "covers every ResponseCode"). It was committed red in f21a4be/8eb3432 before the production fixes c6d9404/cdf48db. The only later change is the additive WR-02 case in 5191ffe; the original expectations are not weakened. Green. |
| 5 | Failed step shows tool's own text; real code name, never UNKNOWN | VERIFIED | `toolReply.ts describeToolReply` is the single composer. `tools.ts` throws `ToolCommandExecutionError(failure.message, failure.code)`. The router payload passes the message verbatim and still carries `code`/`codeString` (stack removed). `toolReply.test`/`errorPath.test` green. |
| 6 | Failed step card shows stored error incl. after banner cleared/restart; after dismiss, next failure shows the banner again | VERIFIED (logic + wiring); rendering is UAT | `SwimLaneCommandComponent` renders `stepErrorText(command)` from the persisted row. `shouldShowErrorBanner` plus `setDismissedSeq(errorSeq(...))`. Server `_recordFailure` bumps `failureSeq` at each failure site. `queueError.test.ts` green. |
| 7 | Failed step never shown as completed; SUCCESS reply carrying an error message is an error; run whose failed step was skipped is not plain success | VERIFIED (logic + wiring); rendering is UAT | `describeToolReply` SUCCESS+text -> ERROR_FROM_TOOL. `CheckCircle` only under COMPLETED. `deriveRunOutcome`/`runOutcomeBadge`/`runProgressColorScheme`. `runOutcome.test.ts` green. |

**Score:** 8/8 requirements verified (7/7 roadmap truths at logic and wiring level; 0 behavior-unverified; rendered aspects routed to UAT).

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `controller/server/command_queue.ts` | VERIFIED | guard, listing, `_recordFailure`, `failureSeq`, `isStartInProgress` getter present and wired |
| `controller/server/routers/command_queue.ts` | VERIFIED | `restart` returns `{ accepted }`; payload without stack, with seq |
| `controller/server/utils/SqliteQueue.ts`, `queueStartListing.ts`, `toolReply.ts`, `tools.ts` | VERIFIED | unchanged since the prior verification; consumed by command_queue/tools |
| `controller/components/runs/{queuedStartSummary,storedError,runOutcome,queueError,utils}.ts`, `RunsComponent.tsx`, `SwimLaneCommandComponent.tsx` | VERIFIED | unchanged since the prior verification; substantive and wired |
| `controller/components/runs/status/QueueStatuscomponent.tsx` | VERIFIED | start summary plus `restartMutation.onSuccess` toast on `!result.accepted`, `onSettled` preserved |
| Tests: errorPath, queueStartGuard, toolReply, queueError, runOutcome, queuedStartSummary, staticScan | VERIFIED | exist, green; staticScan gains WR-01/WR-02 pins (no `await this._notifyFailure(`, `return { accepted }`, no `stack:`) |

### Key Link Verification

| From | To | Status |
| ---- | -- | ------ |
| router `restart` -> `queue.isStartInProgress` then `_start()` | guard inside `_start` | WIRED |
| `QueueStatuscomponent` `restart.useMutation.onSuccess` -> `warningToast` on `!result.accepted` | operator visibility of an ignored Start | WIRED |
| `enqueueRun` -> `this._start("enqueue")` | guarded `_start` | WIRED |
| `tools.ts` -> `describeToolReply` -> `ToolCommandExecutionError` | getError payload | WIRED |
| fail / `_start` catch / busy-loop catch -> `_recordFailure` -> `failureSeq` -> `getError.seq` | banner re-arm | WIRED |
| `QueueStatuscomponent` -> `commands.useQuery` + `queuedStartLines(` | read-only modal lines | WIRED |
| `RunsComponent` -> `shouldShowErrorBanner`, `setDismissedSeq(errorSeq(...))` | banner re-arm | WIRED |
| `SwimLaneCommandComponent` -> `stepErrorText(command)` | card error line | WIRED |
| `utils.getRunAttributes` -> `deriveRunOutcome`; `RunsComponent` -> `runOutcomeBadge`/`runProgressColorScheme` | outcome display | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| Run confirmation modal | `queuedCommandsQuery.data` | `commandQueue.commands` (queue-joined SQLite) | yes | FLOWING |
| Error banner | `getError.data` | `CommandQueue.getError()` + `failureSeq` | yes | FLOWING |
| Step card error | `command.error` | persisted row via `getAll` | yes | FLOWING |
| Run row outcome | `run.Commands` | polled rows | yes | FLOWING |
| Start-ignored toast | `restart` mutation result | `!queue.isStartInProgress` computed server-side | yes | FLOWING |

### Requirements Coverage (PLAN frontmatter vs REQUIREMENTS.md)

IDs claimed across plans: 03-01 {QUE-07, QUE-08, QUE-09}, 03-02 {ERR-01}, 03-03 {QUE-08}, 03-04 {ERR-01, ERR-02, ERR-04, ERR-05}, 03-05 {ERR-05}, 03-06 {ERR-03, ERR-04, ERR-05}. All 8 IDs listed for Phase 3 in REQUIREMENTS.md are accounted for (checked and traceability rows "Complete"); no ORPHANED requirements.

| Requirement | Source Plans | Status | Evidence |
| ----------- | ------------ | ------ | -------- |
| QUE-07 | 03-01 | SATISFIED | Guard intact after WR-01; single-dispatch tests green |
| QUE-08 | 03-01, 03-03 | SATISFIED (rendering = UAT) | Truth 2 |
| QUE-09 | 03-01, 03-04, 03-06 | SATISFIED | zero diff on protected tests; green; retry-after-failure test added |
| ERR-01 | 03-02, 03-04 | SATISFIED | red-first errorPath table, green |
| ERR-02 | 03-04 | SATISFIED | Truth 5 |
| ERR-03 | 03-06 | SATISFIED (rendering = UAT) | Truth 6 |
| ERR-04 | 03-04, 03-06 | SATISFIED | seq and dismissedSeq unaffected by 5191ffe |
| ERR-05 | 03-04, 03-05, 03-06 | SATISFIED (rendering = UAT) | Truth 7 |

### Prohibitions

| Prohibition | Tier | Status |
| ----------- | ---- | ------ |
| Ignored Start changes no state/error/_failedAttempt; no auto acknowledge/cancel/retry/skip | test | Held (guard ordering unchanged; toast is client-only; guard tests green) |
| Protected regression test files unmodified | test | Held (git diff empty) |
| Run confirmation gains no timer/default/autoFocus/form/new button | test | Held (staticScan) |
| Summary must not promise un-run rows | test | Held |
| No tool error reported as success; tool text not rewritten; banner dismissal never clears error | test | Held (the ignored-Start toast is a warning; the `accepted:false` path touches no banner or error) |
| No RunStatus widening; no motion in tests | test | Held (fakes only) |
| failing test not weakened | judgment | Held, non-authoritative: the original errorPath expectations are unchanged; 5191ffe only adds a case |

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX. `void this._notifyFailure(...)` is deliberate and safe because the method catches all of its own errors. `status: "UNKNOWN"` in `utils.ts`/`RunsComponent.tsx` is the pre-existing no-run-info placeholder.

### Behavioral Spot-Checks

| Behavior | Command | Result |
| -------- | ------- | ------ |
| Whole unit suite incl. guard, errorPath, toolReply, queueError, runOutcome, queuedStartSummary, staticScan | `npm run test:unit` | PASS (434/434) |
| Types | `npx tsc --noEmit` | PASS |

### Human Verification Required

Five items (frontmatter `human_verification`, matching 03-UAT.md, all pending): Run confirmation rendering, banner re-arm across two failures, step-card clamp/persistence, orange skipped-failure badge, and the ignored-Start toast plus immediate retry after failure. These are rendered or live-timing items with no automated harness (project decision: no jsdom/RTL). Their pure logic is unit-tested and their wiring is verified above.

### Advisory (not failing a must-have)

- WR-01 and WR-02 from the prior report are now fixed (5191ffe, 06fc3ea) and no longer advisory.
- IN-01..IN-03 remain open, informational only.

### Gaps Summary

No gaps. Every roadmap success criterion and requirement is backed by code and green tests, the QUE-09 no-diff gate holds, and the post-review fixes keep QUE-07 single-flight, QUE-09 retry-after-failure, ERR-04 and ERR-05 intact without violating a prohibition. The D-02 reversal is a user-approved deviation recorded as an override. Status is `human_needed` only because rendered UI behaviour is a UAT item.

---

_Verified: 2026-10-29_
_Verifier: Claude (gsd-verifier)_
