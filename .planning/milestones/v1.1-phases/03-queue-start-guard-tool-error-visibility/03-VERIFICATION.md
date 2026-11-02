---
phase: 03-queue-start-guard-tool-error-visibility
verified: 2026-10-30T14:40:00Z
status: passed
score: 9/9 must-haves verified
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
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-07-PLAN.md"
  - ".planning/phases/03-queue-start-guard-tool-error-visibility/03-07-SUMMARY.md"
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
  - "controller/server/runs.ts"
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
covered_digest: "v4:sha256:f9e7709127e3dbae5fb5d53e100029b51c357fe33b7c3697a6a26613153667da"
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "An ignored Start is not an error to the caller: commandQueue.restart resolves to undefined and no toast or exception is produced (D-02)"
    reason: "WR-01 fix reverses CONTEXT D-02 at the user's request: restart now returns { accepted } and an ignored Start shows a 'Start ignored' warning toast. It is still not an error/exception and changes no queue state. Recorded in 03-REVIEW-DISPOSITION.md. Plan-level truth only; no ROADMAP success criterion or requirement text mentions a toast."
    accepted_by: "user (recorded in 03-REVIEW-DISPOSITION.md)"
    accepted_at: "2026-10-29T00:00:00Z"
  - must_have: "A FAILED or skipped-after-failure step card with a 1-line or 3-line error fits the fixed 165px card (scrollHeight <= clientHeight, no internal scroll) and the sticky label never covers the error text (G-03-3, 03-07 must-have)"
    reason: "Rendered-geometry retest was waived as minor by the user after gap-closure plan 03-07; UAT test 3 marked pass with source: user (03-UAT.md, gap G-03-3 status resolved). The layout is pinned structurally by red-first static scans, but scrollHeight/clientHeight were never measured on the live page. Accepted risk, not measured proof. The 2246f41 review-fix (image wrapper only with an image) does not change this: it only removes an empty wrapper and tightens the scan."
    accepted_by: "user (recorded in 03-UAT.md test 3 and gap G-03-3)"
    accepted_at: "2026-10-29T04:39:33Z"
re_verification:
  previous_status: passed
  previous_score: 9/9
  gaps_closed:
    - "Stale fingerprint: covered files controller/server/runs.ts and controller/test/staticScan.test.ts changed after 2246f41 through Phase 04 commits (G-04-7 run.create error classification, G-04-2/G-04-6 recovery card scans). Diffs read directly; every Phase 03 truth re-checked against current code; no regression."
  gaps_remaining: []
  regressions: []
coincidental_reliance_items: []
advisory_review_findings:
  - id: IN-01
    note: "Full error text on the card is hover-only (title). Banner and Details still carry the full text. Open in 03-REVIEW-DISPOSITION.md."
  - id: IN-02
    note: "Sticky-label scan is whitespace and prop-order sensitive. Open."
  - id: IN-03
    note: "A SUCCESS reply with whitespace-only error_message fails the step. Info only, open."
resolved_advisories:
  - id: WR-01
    note: "G-03-3 scan matched flexShrink={0} anywhere in the row. FIXED in 2246f41: the scan now binds it to the CommandImage wrapper and pins the row's width and justifyContent. Confirmed in code and test."
  - id: WR-02
    note: "Stray 8px HStack gap and indented error text while tool.info loads or when a tool has no image. FIXED in 2246f41: the wrapper renders only when infoQuery.data?.imageUrl is truthy. Confirmed in code."
---

# Phase 3: Queue Start Guard & Tool Error Visibility Verification Report

**Phase Goal:** A Start, restart or enqueue never dispatches a queue row that is already in flight; the operator sees before confirming what a Start will run, so a stale leftover row is never a surprise; and when a tool step fails, the operator sees the tool's own message wherever the failure shows, and no tool error is ever shown as success.
**Verified:** 2026-10-30T14:40:00Z
**Status:** passed
**Re-verification:** Yes. The prior report (2026-10-29T22:27Z) went stale because later Phase 04 commits changed two covered files, `controller/server/runs.ts` and `controller/test/staticScan.test.ts`. The diffs were read directly and every Phase 03 must-have was re-checked against current code.

## Stale-Input Regression Review (`git diff 2246f41..HEAD -- controller/`)

Six files changed under `controller/`: `RunRecoverySection.tsx`, `operatorOnlyCommands.ts`, `routers/run.ts`, `runs.ts`, `runCreateReload.test.ts` and `staticScan.test.ts`. Only the last two plus `runs.ts` are in this report's covered set.

| File | Change | Phase 03 impact |
| ---- | ------ | --------------- |
| `controller/server/runs.ts` | Imports `isOperatorOnlyCommandError` and adds three name-based classifiers (`isProtocolNotFoundError`, `isProtocolGenerationFailedError`, `isProtocolParamsInvalidError`). The `RunStore.create` rethrow branch now uses them instead of `instanceof` (G-04-7) | None. The edit sits in the error-classification catch of run creation. The `await CommandQueue.global.enqueueRun(run)` call (line 266) is untouched, so the enqueue auto-start still goes through the guarded `_start("enqueue")`. No queue, tool-reply or run-outcome code is involved |
| `controller/test/staticScan.test.ts` | +107 lines: two new `describe` blocks for the Phase 04 recovery card (G-04-6, G-04-2). No existing Phase 03 scan is edited (diff is append-only: 107 insertions, 0 deletions) | None. The G-03-3 and ERR-03/04/05 scans are byte-identical and green |

Every other Phase 03 source file (`command_queue.ts`, `routers/command_queue.ts`, `tools.ts`, `toolReply.ts`, `queueStartListing.ts`, `SqliteQueue.ts`, `queueError.ts`, `runOutcome.ts`, `storedError.ts`, `queuedStartSummary.ts`, `utils.ts`, `QueueStatuscomponent.tsx`, `RunsComponent.tsx`, `SwimLaneCommandComponent.tsx`) has no diff since 2246f41.

## Gate Evidence

| Gate | Command | Result |
| ---- | ------- | ------ |
| Phase 03 suites, run in this verification | `npx vitest run test/queueStartGuard test/errorPath test/toolReply test/queueError test/runOutcome test/queuedStartSummary test/staticScan test/toolControl test/sqliteQueue test/queueRestart` (controller/) | 10 files, 249/249 passed (includes the new Phase 04 scans) |
| Types | `npx tsc --noEmit` (controller/) | clean, no output |
| QUE-09 protected tests | `git diff --stat 5726822 -- controller/test/toolControl.test.ts controller/test/sqliteQueue.test.ts controller/test/queueRestart.test.ts` | empty |
| Debt markers | grep TBD/FIXME/XXX in `runs.ts`, `staticScan.test.ts` | none |
| Probes | none declared by this phase | SKIPPED |

## Observable Truths (ROADMAP success criteria + plan truths, against current code)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | While a step is in flight, Run/restart/enqueue does not dispatch the row twice; queue stays running; Logs record "Queue Start Ignored" | VERIFIED | `command_queue.ts:919-922`: `if (this._runningPromise) { logAction({ level: "warning", action: "Queue Start Ignored" ...` is the guard in `_start`. `runs.ts:266` still calls `enqueueRun`. `queueStartGuard.test.ts` green (same-tick, pause-then-start, enqueue, recipe D) |
| 2 | Run confirmation shows queued rows to run, FAILED retries, distinct runs, read-only, nothing pre-selected, no timer; Logs list queue_ids and run_ids | VERIFIED | `QueueStatuscomponent.tsx`, `queuedStartSummary.ts`, `queueStartListing.ts` unchanged; `queuedStartSummary.test.ts` and the UI-08 static scan green |
| 3 | A FAILED step stays queued and re-runs first; retry regression tests pass unmodified | VERIFIED | Protected test files have zero diff vs 5726822 and pass (toolControl, sqliteQueue, queueRestart) |
| 4 | A test written failing first drives each tool response code through the queue and pins message/code/stored error | VERIFIED | `errorPath.test.ts` present and green, no diff |
| 5 | Failed step shows the tool's own text and the real code name, never UNKNOWN | VERIFIED | `tools.ts:618` `describeToolReply(command.command, command.toolId, reply)`; `toolReply.test.ts` and `errorPath.test.ts` green |
| 6 | Failed step card shows the stored error incl. after the banner is cleared or on restart; after dismiss the next failure shows the banner again | VERIFIED | `SwimLaneCommandComponent.tsx:51` `errorText = stepErrorText(command)`, `noOfLines={3}` (174), `title={errorText}` (181); `failureSeq` logic in `command_queue.ts`/router; `queueError.test.ts` green |
| 7 | A failed step is never shown as completed; a SUCCESS reply carrying error text is an error; a run whose failed step was skipped is not plain success | VERIFIED | `utils.ts:21` `deriveRunOutcome`; `RunsComponent.tsx:363` `runOutcomeBadge`; `runOutcome.test.ts` green |
| 8 | An ignored Start is shown to the operator and a retry right after a failure starts immediately (03-01 / WR-01) | PASSED (override) + VERIFIED | Router `restart` returns `{ accepted }` (`routers/command_queue.ts:39-41`); `QueueStatuscomponent.tsx:60` toasts on `!result.accepted`. Override covers the plan truth "restart resolves to undefined and no toast" (D-02 reversed by user, recorded in 03-REVIEW-DISPOSITION.md) |
| 9 | Step-card error fits the fixed 165px card; sticky label never covers the text (03-07, G-03-3) | PASSED (override) | Structure pinned by green static scans on current source. Live geometry never measured; user waived the retest (03-UAT.md test 3 pass, G-03-3 resolved). Accepted risk, not measured proof |

**Score:** 9/9 truths verified (2 carried as PASSED by recorded user override; truth 9 is accepted unmeasured risk).

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `controller/server/command_queue.ts` | VERIFIED | Guard, failure recording, `isStartInProgress` present and wired |
| `controller/server/routers/command_queue.ts` | VERIFIED | `restart` returns `{ accepted }`; `getError` carries seq |
| `controller/server/toolReply.ts`, `tools.ts` | VERIFIED | `describeToolReply` wired into `executeCommand` |
| `controller/server/queueStartListing.ts`, `utils/SqliteQueue.ts` | VERIFIED | Present, wired from `command_queue.ts` |
| `controller/server/runs.ts` | VERIFIED | Changed only in error classification (G-04-7); still enqueues via `CommandQueue.global.enqueueRun` |
| `controller/components/runs/{queueError,queuedStartSummary,runOutcome,storedError,utils}.ts` | VERIFIED | Wired to the components below |
| `QueueStatuscomponent.tsx`, `RunsComponent.tsx`, `SwimLaneCommandComponent.tsx` | VERIFIED | Substantive and wired |
| Test files (errorPath, queueError, queueStartGuard, queuedStartSummary, runOutcome, toolReply, staticScan) | VERIFIED | Present, substantive, green |

### Key Link Verification

| From | To | Status |
| ---- | -- | ------ |
| Router `restart` -> `_start` guard; `enqueueRun` -> `_start("enqueue")` | single-flight | WIRED |
| `tools.ts` -> `describeToolReply` -> `ToolCommandExecutionError` -> queue failure record -> `getError` with `failureSeq` | banner, step card | WIRED |
| `QueueStatuscomponent` -> `commands.useQuery` + `queuedStartLines`; `restart` result -> warning toast on `!accepted` | modal, ignored-Start visibility | WIRED |
| `SwimLaneCommandComponent` -> `stepErrorText(command)` -> error Text (clamp 3, title) | step card error | WIRED |
| `getRunAttributes` -> `deriveRunOutcome`; `RunsComponent` -> `runOutcomeBadge` | skipped-failure display | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| Step card error Text | `errorText` from `command.error` | persisted queue row | yes | FLOWING |
| Run confirmation modal | `commandQueue.commands` | queue-joined SQLite | yes | FLOWING |
| Error banner | `getError.data` + `failureSeq` | `CommandQueue.getError()` | yes | FLOWING |
| Run outcome | polled `run.Commands` | rows | yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Guard, error path, tool reply, run outcome, start summary, static scans, QUE-09 protected suites | targeted vitest run of the 10 suites | 249/249 | PASS |
| Types | `npx tsc --noEmit` | clean | PASS |

### Probe Execution

None declared by this phase. SKIPPED.

### Requirements Coverage (PLAN frontmatter vs REQUIREMENTS.md)

PLAN `requirements:` union = {QUE-07, QUE-08, QUE-09, ERR-01, ERR-02, ERR-03, ERR-04, ERR-05}. Every ID is accounted for, and no ORPHANED requirement maps to Phase 3.

| Requirement | Source Plans | Status | Evidence |
| ----------- | ------------ | ------ | -------- |
| QUE-07 | 03-01 | SATISFIED | Truth 1 |
| QUE-08 | 03-01, 03-03 | SATISFIED | Truth 2 |
| QUE-09 | 03-01, 03-04, 03-06 | SATISFIED | Truth 3 |
| ERR-01 | 03-02, 03-04 | SATISFIED | Truth 4 |
| ERR-02 | 03-04 | SATISFIED | Truth 5 |
| ERR-03 | 03-06, 03-07 | SATISFIED | Truths 6 and 9 (9 by user waiver) |
| ERR-04 | 03-04, 03-06 | SATISFIED | Truth 6 |
| ERR-05 | 03-04, 03-05, 03-06 | SATISFIED | Truth 7 |

### Prohibitions

| Prohibition | Tier | Status |
| ----------- | ---- | ------ |
| Ignored Start changes no state/error/_failedAttempt | test | Held: guard body logs and returns (no diff) |
| Protected regression test files unmodified | test | Held: empty git diff vs 5726822 |
| Run confirmation gains no timer/default/autoFocus/form/new button | test | Held: static scan green |
| No tool error reported as success; tool text not rewritten; banner dismissal never clears the error | test | Held: `describeToolReply` unchanged; tests green |
| 03-07: CommandImage.tsx, card box, error Text style, label unchanged | test | Held: no Phase 03 file changes since 2246f41; G-03-3 scans green |
| Failing test not weakened | judgment | Held, non-authoritative: the only test edit since the last report is an append-only addition of Phase 04 scans |

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX in the changed covered files. Open review advisories IN-01, IN-02 and IN-03 are listed in frontmatter. They are info-level and unchanged.

### Human Verification Required

None outstanding. The live step-card geometry check was waived by the user as minor (03-UAT.md). If the card is ever seen to overflow on a real run, reopen G-03-3.

### Gaps Summary

No gaps. The Phase 04 commits that staled this report only touched run-creation error classification and appended recovery-card scans. They leave the single-flight guard, start listing, error-path composition, banner/step-card error visibility and run-outcome derivation intact. Targeted suites pass 249/249 and tsc is clean.

---

_Verified: 2026-10-30T14:40:00Z_
_Verifier: Claude (gsd-verifier)_
