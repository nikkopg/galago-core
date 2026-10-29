---
phase: 03-queue-start-guard-tool-error-visibility
verified: 2026-10-29T22:27:00Z
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
covered_digest: "v3:sha256:90b1b825a10d0d732b1e11d5b5e0ed0e19ccca1b664ccd8d55a5b73c28349934"
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
    - "Stale report: covered files SwimLaneCommandComponent.tsx and staticScan.test.ts changed in commit 2246f41 (review fixes WR-01/WR-02); diff read directly, every Phase 03 truth re-checked, no regression"
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
**Verified:** 2026-10-29T22:27:00Z
**Status:** passed
**Re-verification:** Yes. The prior report (4718583) went stale because commit 2246f41 changed two covered files (`SwimLaneCommandComponent.tsx`, `staticScan.test.ts`). The diff was read directly and all Phase 03 must-haves were re-checked against current code.

## Review-Fix Regression Review (2246f41)

`git diff --stat 4718583..HEAD` shows exactly three files: `03-REVIEW-DISPOSITION.md` (docs), `SwimLaneCommandComponent.tsx` (+9/-7) and `staticScan.test.ts` (+6/-1). Nothing else under `controller/` or the phase directory changed, so every other covered file is byte-identical to what the prior report verified.

| File | Change | Phase 03 impact |
| ---- | ------ | --------------- |
| `controller/components/runs/list/SwimLaneCommandComponent.tsx` | `<Box flexShrink={0}><CommandImage .../></Box>` is now wrapped in `{infoQuery.data?.imageUrl && ( ... )}` | Behavior-preserving. `CommandImage.renderToolImage` returns `undefined` when `!config` and an empty `<Box></Box>` when `!config.imageUrl`, so with no image the old wrapper held nothing visible and only contributed an 8px HStack gap. With an image, the row is identical to before: wrapper `flexShrink={0}`, then the error `Text` |
| `controller/test/staticScan.test.ts` | G-03-3 scan: replaced `slice(rowOpen,rowClose).toMatch(/flexShrink=\{0\}/)` with `rowHead = slice(rowOpen, imgAt)` and four asserts: ends in `<Box flexShrink={0}>`, `width="100%"`, `justifyContent="center"`, and `{infoQuery.data?.imageUrl && ( <Box flexShrink={0}>` | Strictly stronger. Removes nothing that was previously asserted except the loose any-element match, which the anchored assertion supersedes |

### G-03-3 / truth 9 (row layout), re-read in current code

Current structure (lines ~158-190 of `SwimLaneCommandComponent.tsx`):

- `<Center p={0}><VStack spacing={2} width="100%"><HStack spacing={2} width="100%" justifyContent="center">`
- inside the HStack: the image wrapper (now conditional), then `{errorText !== null && <Text fontSize="sm" noOfLines={3} whiteSpace="normal" wordBreak="break-word" textAlign="left" userSelect="text" flex="1" minW={0} title={errorText}>}`
- `</HStack>` closes before `<Box bottom={0} position="sticky">` (the label)

What this preserves:

- Error text is in the same row as the image (image at `<CommandImage` precedes `title={errorText}` inside one HStack; the scan asserts no `</HStack>` between them) and above the sticky label (label index is after the row close).
- Row is shorter or equal to before in every case: with an image it is unchanged; with no image or while `tool.info` loads, the error text now takes the full row width instead of being indented 8px, so it can only wrap into fewer or equal lines. The 3-line clamp (`noOfLines={3}`) and `minW={0}`/`flex="1"` are untouched, so it still cannot overflow horizontally or exceed 3 lines.
- When no error and no image, the HStack is now empty (0 height). Before it held an empty `<Box>` (0 height). No height change.
- The card box, error text style and sticky label are untouched: the second G-03-3 test (`height="165px"`, `padding="6px"`, `minW="250px"`, `maxW="300px"`, `overflowY="auto"`, no `lineHeight`, label markup, exactly one `<CommandImage`) still holds in current source and passes.
- `controller/components/tools/CommandImage.tsx`: no commits since `e25f0a4` (`git log e25f0a4..HEAD` empty, `git diff --stat` empty). Unchanged, as the 03-07 prohibition requires.

Conclusion: the change preserves the G-03-3 must-have. The rendered geometry was still never measured live (accepted user waiver, see override); the fix cannot make the fit worse and makes the image-less case slightly better.

## Gate Evidence

| Gate | Command | Result |
| ---- | ------- | ------ |
| Orchestrator regression gate | `npx tsc --noEmit`; `npx vitest run` (controller/) | clean; 545/545 tests, 23 files (reported by orchestrator, not re-run in full here) |
| Phase 03 suites, run in this verification | `npx vitest run test/queueStartGuard test/errorPath test/toolReply test/queueError test/runOutcome test/queuedStartSummary test/staticScan test/toolControl test/sqliteQueue test/queueRestart` (controller/) | 10 files, 245/245 passed (includes the strengthened G-03-3 scan) |
| QUE-09 untouched | `git diff --stat 5726822 -- controller/test/toolControl.test.ts controller/test/sqliteQueue.test.ts controller/test/queueRestart.test.ts` | empty |
| CommandImage unchanged | `git log e25f0a4..HEAD -- controller/components/tools/CommandImage.tsx`; `git diff --stat e25f0a4 -- ...CommandImage.tsx` | both empty |
| Debt markers | grep TBD/FIXME/XXX in `SwimLaneCommandComponent.tsx`, `staticScan.test.ts` (the only files changed since last report) | none |
| Probes | none declared by this phase | SKIPPED |

## Observable Truths (ROADMAP success criteria + plan truths, against current code)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | While a step is in flight, Run/restart/enqueue does not dispatch the row twice; queue stays running; Logs record "Queue Start Ignored" | VERIFIED | `command_queue.ts` unchanged since the last report: `_start` guard `if (this._runningPromise) { logAction(... "Queue Start Ignored" ...); return; }` is the first statement. `queueStartGuard.test.ts` green |
| 2 | Run confirmation shows queued rows to run, FAILED retries, distinct runs, read-only, nothing pre-selected, no timer; Logs list queue_ids and run_ids | VERIFIED | `QueueStatuscomponent.tsx`, `queuedStartSummary.ts`, `queueStartListing.ts` unchanged; `queuedStartSummary.test.ts` and staticScan green; UAT 1 passed live |
| 3 | A FAILED step stays queued and re-runs first; retry/h0q/o44/t9e regression tests pass unmodified | VERIFIED | Protected test files zero diff vs 5726822 and green |
| 4 | Test written failing first drives each tool response code through the queue and pins message/code/stored error | VERIFIED | `errorPath.test.ts` green, unchanged |
| 5 | Failed step shows the tool's own text; real code name, never UNKNOWN | VERIFIED | `toolReply.ts` and `tools.ts` unchanged; `toolReply.test.ts` green; UAT 2 live |
| 6 | Failed step card shows stored error incl. after banner cleared/restart; after dismiss the next failure shows the banner again | VERIFIED | `SwimLaneCommandComponent.tsx`: `stepErrorText(command)` -> `errorText`, `noOfLines={3}`, `title={errorText}` all still present after 2246f41; `failureSeq` logic unchanged in `command_queue.ts`; UAT 2, 3 live |
| 7 | Failed step never shown as completed; SUCCESS reply carrying error text is an error; run whose failed step was skipped is not plain success | VERIFIED | `runOutcome.ts`, `utils.ts` unchanged; `runOutcome.test.ts` green; UAT 4 live |
| 8 | An ignored Start is shown to the operator and a retry right after a failure starts immediately (03-01/WR-01 truth) | PASSED (override) + VERIFIED | Router `restart` returns `{ accepted }`; `QueueStatuscomponent.tsx` toasts when `!result.accepted`; asserted by the "ignored Start is reported" scan (green); UAT 5 live |
| 9 | Step-card error fits the fixed 165px card; label never covers the text (03-07, G-03-3) | PASSED (override) | Re-read after 2246f41: error text shares the image's HStack row, above the sticky label, `flex="1"`/`minW={0}`/clamp 3; image wrapper now conditional on `imageUrl`; card box/label/`CommandImage.tsx` unchanged; both G-03-3 scans green. Geometry never measured live; user waived the retest (03-UAT.md test 3 pass, G-03-3 resolved). See override |

**Score:** 9/9 truths verified (2 carried as PASSED by recorded user override; truth 9 is accepted unmeasured risk).

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `controller/server/command_queue.ts` | VERIFIED | Guard, failure record, `isStartInProgress` getter present and wired; no diff since last report |
| `controller/server/routers/command_queue.ts` | VERIFIED | `restart` returns `{ accepted }` |
| `controller/server/toolReply.ts`, `tools.ts` | VERIFIED | `describeToolReply` -> `ToolCommandExecutionError`; no diff |
| `controller/server/queueStartListing.ts`, `runs.ts`, `utils/SqliteQueue.ts` | VERIFIED | No diff |
| `controller/components/runs/{queueError,queuedStartSummary,runOutcome,storedError,utils}.ts` | VERIFIED | No diff; wired to the components below |
| `controller/components/runs/status/QueueStatuscomponent.tsx`, `RunsComponent.tsx` | VERIFIED | No diff |
| `controller/components/runs/list/SwimLaneCommandComponent.tsx` | VERIFIED | Changed in 2246f41 (WR-02 fix); substantive and wired to `stepErrorText`, `CommandImage`, `infoQuery`; no regression |
| Test files (errorPath, queueError, queueStartGuard, queuedStartSummary, runOutcome, toolReply) | VERIFIED | Present, substantive, green, no diff |
| `controller/test/staticScan.test.ts` | VERIFIED | Changed in 2246f41 (WR-01 fix); G-03-3 scan strengthened, green |

### Key Link Verification

| From | To | Status |
| ---- | -- | ------ |
| Router `restart` -> `_start` guard; `enqueueRun` -> `_start("enqueue")` | single-flight | WIRED |
| `tools.ts` -> `describeToolReply` -> `ToolCommandExecutionError` -> busy-loop catch -> `commands.fail` -> `getError` with `failureSeq` | banner, step card | WIRED |
| `QueueStatuscomponent` -> `commands.useQuery` + `queuedStartLines`; `restart` `onSuccess` -> warning toast on `!accepted` | modal, ignored-Start visibility | WIRED |
| `SwimLaneCommandComponent` -> `stepErrorText(command)` -> `errorText` -> Text (`title`, clamp 3), same HStack row as `CommandImage` | step card error | WIRED |
| `SwimLaneCommandComponent` -> `infoQuery.data.imageUrl` -> conditional image wrapper -> `CommandImage` | image render | WIRED |
| `getRunAttributes` -> `deriveRunOutcome`; RunsComponent badge/progress scheme | skipped-failure display | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| Step card error Text | `errorText` from `command.error` | persisted queue row | yes | FLOWING |
| Step card image | `infoQuery.data.imageUrl` | tool info query | yes (gates render; no static fallback) | FLOWING |
| Run confirmation modal | `commandQueue.commands` | queue-joined SQLite | yes | FLOWING |
| Error banner | `getError.data` + `failureSeq` | `CommandQueue.getError()` | yes | FLOWING |
| Run outcome | polled `run.Commands` | rows | yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Guard, error path, tool reply, run outcome, queue start summary, static scans (incl. strengthened G-03-3), QUE-09 protected suites | targeted vitest run of the 10 suites above | 245/245 | PASS |
| Full suite and types | orchestrator gate | 545/545, tsc clean | PASS (reported) |

### Probe Execution

None declared by this phase. SKIPPED.

### Requirements Coverage (PLAN frontmatter vs REQUIREMENTS.md)

PLAN `requirements:` union = {QUE-07, QUE-08, QUE-09, ERR-01, ERR-02, ERR-03, ERR-04, ERR-05} (03-01: QUE-07/08/09; 03-02: ERR-01; 03-03: QUE-08; 03-04: ERR-01/02/04/05; 03-05: ERR-05; 03-06: ERR-03/04/05; 03-07: ERR-03). REQUIREMENTS.md maps exactly these 8 IDs to Phase 3 (all `[x]`, "Complete"). No ORPHANED requirements; every ID accounted for.

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
| Ignored Start changes no state/error/_failedAttempt; no auto acknowledge/cancel/retry/skip | test | Held: guard body only logs and returns (no diff) |
| Protected regression test files unmodified | test | Held: empty git diff vs 5726822 |
| Run confirmation gains no timer/default/autoFocus/form/new button | test | Held: staticScan green |
| No tool error reported as success; tool text not rewritten; banner dismissal never clears the error | test | Held: `describeToolReply` unchanged; tests green |
| 03-07: CommandImage.tsx, card box, error Text font/line-height/clamp, label unchanged | test | Held: no commits on CommandImage since e25f0a4; card box/text style/label asserted by the second G-03-3 scan, green |
| Failing test not weakened | judgment | Held, non-authoritative: the only test edit since the last report (2246f41) tightens the G-03-3 scan |

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX in the files changed by 2246f41. Open review advisories (IN-01, IN-02, IN-03) are listed in frontmatter; WR-01 and WR-02 are now fixed (`resolved_advisories`).

### Human Verification Required

None outstanding. The one previously open item (live scrollHeight/clientHeight on the step card) was waived by the user as minor (03-UAT.md). If the card is ever observed to overflow on a real run, reopen G-03-3.

### Gaps Summary

No gaps. Commit 2246f41 changed the step-card image wrapper to render only with an image and tightened the G-03-3 static scan to anchor on that wrapper. It preserves the shared-row layout, the 3-line clamp, the card box and the sticky label, leaves `CommandImage.tsx` untouched, and changes no queue, error-path or run-outcome code. Targeted suites pass 245/245 and the orchestrator's full gate passed 545/545 with tsc clean.

---

_Verified: 2026-10-29T22:27:00Z_
_Verifier: Claude (gsd-verifier)_
