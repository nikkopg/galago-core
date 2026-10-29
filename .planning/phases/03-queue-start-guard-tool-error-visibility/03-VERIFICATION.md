---
phase: 03-queue-start-guard-tool-error-visibility
verified: 2026-10-29T13:30:00Z
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
covered_digest: "v3:sha256:dea0987ed6f7bf4f4c6557f827ba0b820b3609d199be827e2016fba2124d5709"
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "An ignored Start is not an error to the caller: commandQueue.restart resolves to undefined and no toast or exception is produced (D-02)"
    reason: "WR-01 fix reverses CONTEXT D-02 at the user's request: restart now returns { accepted } and an ignored Start shows a 'Start ignored' warning toast. It is still not an error/exception and changes no queue state. Recorded in 03-REVIEW-DISPOSITION.md. Plan-level truth only; no ROADMAP success criterion or requirement text mentions a toast."
    accepted_by: "user (recorded in 03-REVIEW-DISPOSITION.md)"
    accepted_at: "2026-10-29T00:00:00Z"
  - must_have: "A FAILED or skipped-after-failure step card with a 1-line or 3-line error fits the fixed 165px card (scrollHeight <= clientHeight, no internal scroll) and the sticky label never covers the error text (G-03-3, 03-07 must-have)"
    reason: "Rendered-geometry retest was waived as minor by the user after gap-closure plan 03-07; UAT test 3 marked pass with source: user (03-UAT.md, gap G-03-3 status resolved). The layout is pinned structurally by red-first static scans, but scrollHeight/clientHeight were never measured on the live page. Accepted risk, not measured proof."
    accepted_by: "user (recorded in 03-UAT.md test 3 and gap G-03-3)"
    accepted_at: "2026-10-29T04:39:33Z"
re_verification:
  previous_status: human_needed
  previous_score: 8/9
  gaps_closed:
    - "Stale report: covered files changed by Phase 04 commits (3a76842..HEAD); every Phase 03 truth re-checked against current code, no regression"
    - "Outstanding human item (G-03-3 live geometry retest) is now carried as an accepted user waiver (03-UAT.md test 3 pass)"
  gaps_remaining: []
  regressions: []
coincidental_reliance_items: []
advisory_review_findings:
  - id: "03-REVIEW WR-01 (03-07 review)"
    note: "G-03-3 static scan lets flexShrink={0} pass on any element in the row, not only the image wrapper. Test-strength warning, open in 03-REVIEW-DISPOSITION.md."
  - id: "03-REVIEW WR-02 (03-07 review)"
    note: "Row adds a stray 8px gap and indents error text while tool.info loads or when a tool has no image. Cosmetic, cannot overflow. Open."
  - id: IN-01
    note: "Full error text on the card is hover-only (title). Banner and Details still carry the full text. Open."
  - id: IN-02
    note: "Sticky-label scan is whitespace and prop-order sensitive. Open."
  - id: IN-03
    note: "A SUCCESS reply with whitespace-only error_message fails the step. Info only, open."
---

# Phase 3: Queue Start Guard & Tool Error Visibility Verification Report

**Phase Goal:** A Start, restart or enqueue never dispatches a queue row that is already in flight; the operator sees before confirming what a Start will run, so a stale leftover row is never a surprise; and when a tool step fails, the operator sees the tool's own message wherever the failure shows, and no tool error is ever shown as success.
**Verified:** 2026-10-29
**Status:** passed
**Re-verification:** Yes. The prior report was stale because Phase 04 commits (3a76842..HEAD, 50 commits) touched covered files. All Phase 03 must-haves were re-checked against the current code. The previous `human_needed` residue (G-03-3 live geometry) is now an accepted user waiver recorded in 03-UAT.md.

## Phase 04 Regression Review (3a76842..HEAD)

Phase 03 files with a diff since 3a76842, read directly:

| File | Change | Phase 03 impact |
| ---- | ------ | --------------- |
| `controller/server/command_queue.ts` | +12/-8: imports `sanitizeLogText`; wraps the `Tool Control Refused` / `Tool Control Failed` / outcome log `details` strings in it | None. Log text only, in `toolControl`. The `_start` single-flight guard (first statement, lines ~908-915), `Queue Start Ignored` log, `_failedAttempt` handling, busy-loop catch and `fail()` path are byte-identical in logic |
| `controller/server/tools.ts` | +17: operator-only refusal as the FIRST statement of `executeCommand`, throws `OperatorOnlyCommandError` | Additive and precedes the gRPC call. The `describeToolReply` -> `ToolCommandExecutionError` path is untouched. A refusal throws, so it lands in the busy-loop catch and becomes a FAILED step with a stored message (never success) |
| `controller/server/runs.ts` | +21/-1: enqueue-time operator-only scan, removes dead `nextRunId` | Enqueue refusal only; does not alter `enqueueRun` -> `_start("enqueue")` single-flight |
| `controller/test/errorPath.test.ts`, `toolReply.test.ts`, `runOutcome.test.ts`, `queueStartGuard.test.ts` | Prettier re-wrap only (checked line by line; no assertion changed or removed) | None |
| `controller/test/staticScan.test.ts` | +173/-2: new OPR-05 scans appended; the 2 removed lines are the "no Enter-bound default" regex, which was broadened (superset) and a prettier re-wrap of the G-03-3 slice expression | Phase 03 scans retained and, if anything, stronger |
| `controller/test/setup.ts` | logger mock now spreads the real module and mocks only `logAction` | Needed for `sanitizeLogText`; Phase 03 tests unaffected (they pass) |

Phase 03 files with NO diff since 3a76842: `RunsComponent.tsx`, `SwimLaneCommandComponent.tsx`, `queueError.ts`, `queuedStartSummary.ts`, `runOutcome.ts`, `QueueStatuscomponent.tsx`, `storedError.ts`, `utils.ts`, `queueStartListing.ts`, `routers/command_queue.ts`, `toolReply.ts`, `SqliteQueue.ts`, `queueError.test.ts`, `queuedStartSummary.test.ts`.

Note: the Phase 04 diff list also shows `RunControlConfirmModal.tsx`, `controlDecision.ts` under `components/runs/`. These are Phase 04 files, not Phase 03 artifacts, and are unrelated to the queue Start confirmation (`QueueStatuscomponent.tsx`, unchanged).

## Gate Evidence

| Gate | Command | Result |
| ---- | ------- | ------ |
| Orchestrator regression gate | `npx tsc --noEmit`; `npx vitest run` (controller/) | clean; 545/545 tests, 23 files (reported by orchestrator, not re-run in full here) |
| Phase 03 suites, run in this verification | `npx vitest run test/queueStartGuard test/errorPath test/toolReply test/queueError test/runOutcome test/queuedStartSummary test/staticScan test/toolControl test/sqliteQueue test/queueRestart` | 10 files, 245/245 passed |
| QUE-09 untouched | `git diff --stat 5726822 -- controller/test/toolControl.test.ts controller/test/sqliteQueue.test.ts controller/test/queueRestart.test.ts` | empty |
| CommandImage unchanged | `git diff --stat e25f0a4 -- controller/components/tools/CommandImage.tsx` | empty |
| Debt markers | grep TBD/FIXME/XXX across `components/runs`, `command_queue.ts`, `toolReply.ts`, `tools.ts`, `queueStartListing.ts`, `runs.ts` | none |
| Probes | none declared by this phase | SKIPPED |

## Observable Truths (ROADMAP success criteria + plan truths, against current code)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | While a step is in flight, Run/restart/enqueue does not dispatch the row twice; queue stays running; Logs record "Queue Start Ignored" | VERIFIED | `command_queue.ts` `_start`: `if (this._runningPromise) { logAction(... "Queue Start Ignored" ...); return; }` is the first statement; no await between guard and the `_runningPromise` claim; `_describeQueueStart` is synchronous. `queueStartGuard.test.ts` green |
| 2 | Run confirmation shows queued rows to run, FAILED retries, distinct runs, read-only, nothing pre-selected, no timer; Logs list queue_ids and run_ids | VERIFIED | `QueueStatuscomponent.tsx`, `queuedStartSummary.ts`, `queueStartListing.ts` unchanged; `queuedStartSummary.test.ts` and staticScan green; UAT 1 passed on the live UI |
| 3 | A FAILED step stays queued and re-runs first; retry/h0q/o44/t9e regression tests pass unmodified | VERIFIED | Protected files zero diff vs 5726822; green. Busy-loop catch still calls `commands.fail` (not dequeue) unless an operator abort was accepted |
| 4 | Test written failing first drives each tool response code through the queue and pins message/code/stored error | VERIFIED | `errorPath.test.ts` green; only a prettier re-wrap since last verification |
| 5 | Failed step shows the tool's own text; real code name, never UNKNOWN | VERIFIED | `toolReply.ts` unchanged; `tools.ts` change is a pre-dispatch refusal only; `toolReply.test.ts` green; UAT 2 live |
| 6 | Failed step card shows stored error incl. after banner cleared/restart; after dismiss the next failure shows the banner again | VERIFIED | `SwimLaneCommandComponent.tsx` unchanged: `stepErrorText(command)`, `noOfLines={3}`, `title={errorText}`; `failureSeq` logic intact in `command_queue.ts`; UAT 2, 3 live |
| 7 | Failed step never shown as completed; SUCCESS reply carrying error text is an error; run whose failed step was skipped is not plain success | VERIFIED | `runOutcome.ts` (`COMPLETED_WITH_SKIPPED_FAILURE` -> orange) and `utils.ts` unchanged; `runOutcome.test.ts` green; UAT 4 live |
| 8 | An ignored Start is shown to the operator and a retry right after a failure starts immediately (03-01/WR-01 truth) | PASSED (override) + VERIFIED | Router `restart` returns `{ accepted: !queue.isStartInProgress }`; `QueueStatuscomponent.tsx` line ~60 toasts "Start ignored" when `!result.accepted`; override covers the D-02 wording change; UAT 5 live |
| 9 | Step-card error fits the fixed 165px card; label never covers the text (03-07, G-03-3) | PASSED (override) | Layout code unchanged since last verification (no diff): `HStack` row with `<Box flexShrink={0}>` image wrapper and error `Text` (`flex="1"`, `minW={0}`, clamp 3). Pinned by red-first scans (still green). Geometry never measured; user waived the live retest (03-UAT.md test 3 pass, G-03-3 resolved). See override |

**Score:** 9/9 truths verified (2 carried as PASSED by recorded user override; truth 9 is accepted unmeasured risk).

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `controller/server/command_queue.ts` | VERIFIED | Guard, failure record, `isStartInProgress` getter present and wired to the router; Phase 04 edits are log sanitization only |
| `controller/server/routers/command_queue.ts` | VERIFIED | `restart` returns `{ accepted }` |
| `controller/server/toolReply.ts`, `tools.ts` | VERIFIED | `describeToolReply` -> `ToolCommandExecutionError`; Phase 04 refusal is additive |
| `controller/server/queueStartListing.ts`, `utils/SqliteQueue.ts` | VERIFIED | No diff |
| `controller/components/runs/{queueError,queuedStartSummary,runOutcome,storedError,utils}.ts` | VERIFIED | No diff; wired to the components below |
| `controller/components/runs/status/QueueStatuscomponent.tsx`, `RunsComponent.tsx`, `list/SwimLaneCommandComponent.tsx` | VERIFIED | No diff; wiring as in key links |
| Test files (errorPath, queueError, queueStartGuard, queuedStartSummary, runOutcome, staticScan, toolReply) | VERIFIED | Present, substantive, green; Phase 04 edits are format-only or additive |

### Key Link Verification

| From | To | Status |
| ---- | -- | ------ |
| Router `restart` -> `_start` guard; `enqueueRun` -> `_start("enqueue")` | single-flight | WIRED |
| `tools.ts` -> `describeToolReply` -> `ToolCommandExecutionError` -> busy-loop catch -> `commands.fail` -> `getError` with `failureSeq` | banner, step card | WIRED |
| `QueueStatuscomponent` -> `commands.useQuery` + `queuedStartLines`; `restart` `onSuccess` -> warning toast on `!accepted` | modal, ignored-Start visibility | WIRED |
| `SwimLaneCommandComponent` -> `stepErrorText(command)` -> `errorText` -> Text (`title`, clamp 3) | step card error | WIRED |
| `getRunAttributes` -> `deriveRunOutcome`; RunsComponent badge/progress scheme | skipped-failure display | WIRED |

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
| Guard, error path, tool reply, run outcome, queue start summary, static scans, QUE-09 protected suites | targeted vitest run of the 10 suites above | 245/245 | PASS |
| Full suite and types | orchestrator gate | 545/545, tsc clean | PASS (reported) |

### Probe Execution

None declared by this phase. SKIPPED.

### Requirements Coverage (PLAN frontmatter vs REQUIREMENTS.md)

PLAN `requirements:` union = {QUE-07, QUE-08, QUE-09, ERR-01, ERR-02, ERR-03, ERR-04, ERR-05} (03-01: QUE-07/08/09; 03-02: ERR-01; 03-03: QUE-08; 03-04: ERR-01/02/04/05; 03-05: ERR-05; 03-06: ERR-03/04/05; 03-07: ERR-03). REQUIREMENTS.md maps exactly these 8 IDs to Phase 3, all checked and "Complete". No ORPHANED requirements.

| Requirement | Source Plans | Status | Evidence |
| ----------- | ------------ | ------ | -------- |
| QUE-07 | 03-01 | SATISFIED | Truth 1 |
| QUE-08 | 03-01, 03-03 | SATISFIED | Truth 2 |
| QUE-09 | 03-01, 03-04, 03-06 | SATISFIED | Truth 3, protected tests no diff and green |
| ERR-01 | 03-02, 03-04 | SATISFIED | Truth 4 |
| ERR-02 | 03-04 | SATISFIED | Truth 5 |
| ERR-03 | 03-06, 03-07 | SATISFIED | Truths 6 and 9 (9 by user waiver) |
| ERR-04 | 03-04, 03-06 | SATISFIED | Truth 6 |
| ERR-05 | 03-04, 03-05, 03-06 | SATISFIED | Truth 7 |

### Prohibitions

| Prohibition | Tier | Status |
| ----------- | ---- | ------ |
| Ignored Start changes no state/error/_failedAttempt; no auto acknowledge/cancel/retry/skip | test | Held: guard body only logs and returns |
| Protected regression test files unmodified | test | Held: empty git diff vs 5726822 |
| Run confirmation gains no timer/default/autoFocus/form/new button | test | Held: staticScan, and the scan regex was broadened by Phase 04 |
| No tool error reported as success; tool text not rewritten; banner dismissal never clears the error | test | Held: `describeToolReply` unchanged; tests green |
| 03-07: CommandImage.tsx, card box, error Text font/line-height/clamp, label unchanged | test | Held: no diff on CommandImage or the card; scan green |
| Failing test not weakened | judgment | Held, non-authoritative: Phase 04 edits to Phase 03 tests are format-only |

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX in the covered implementation files. Open review advisories are listed in frontmatter.

### Human Verification Required

None outstanding. The one previously open item (live scrollHeight/clientHeight on the step card) was waived by the user as minor (03-UAT.md). If the card is ever observed to overflow on a real run, reopen G-03-3.

### Gaps Summary

No gaps. Phase 04 changes to Phase 03 files are log-sanitization, an additive pre-dispatch operator-only refusal, a dead-field removal, format-only test rewraps and strengthened static scans. None alters the single-flight guard, the failure/retry path, tool-reply mapping, stored-error rendering or run-outcome display. Targeted suites pass 245/245 and the orchestrator's full gate passed 545/545 with tsc clean.

---

_Verified: 2026-10-29_
_Verifier: Claude (gsd-verifier)_
