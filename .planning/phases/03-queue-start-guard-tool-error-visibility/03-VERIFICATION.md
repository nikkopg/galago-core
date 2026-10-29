---
phase: 03-queue-start-guard-tool-error-visibility
verified: 2026-10-29T04:45:00Z
status: human_needed
score: 8/9 must-haves verified
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
covered_digest: "v3:sha256:f9e037723f5f80ed7f55b4814b9d74b0b6d5f1d8c0cfe2d7fd4154cd9603ce58"
behavior_unverified: 1
overrides_applied: 1
overrides:
  - must_have: "An ignored Start is not an error to the caller: commandQueue.restart resolves to undefined and no toast or exception is produced (D-02)"
    reason: "WR-01 fix reverses CONTEXT D-02 at the user's request: restart now returns { accepted } and an ignored Start shows a 'Start ignored' warning toast. It is still not an error/exception and changes no queue state. Recorded in 03-REVIEW-DISPOSITION.md. Plan-level truth only; no ROADMAP success criterion or requirement text mentions a toast."
    accepted_by: "user (recorded in 03-REVIEW-DISPOSITION.md)"
    accepted_at: "2026-10-29T00:00:00Z"
re_verification:
  previous_status: human_needed
  previous_score: 8/8
  gaps_closed:
    - "G-03-3 (code level): step-card error text no longer stacked under the image; it shares one HStack row with CommandImage (03-07, commits d8ecac5 red, bf692ba green)"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "A FAILED or skipped-after-failure step card with a 1-line or 3-line error fits the fixed 165px card (scrollHeight <= clientHeight, no internal scroll) and the sticky label never covers the error text (G-03-3, 03-07 must-have, verification: backstop)"
    test: "UAT test 3 retest on the live page after docker compose up -d --build galago-web. Use Tool Box (software-only) steps; Image-branch only with a confirmed-stopped non-Tool-Box server. At 300px (1-2 steps) and 250px (4+ steps) cards, with 1-line and 3+-line errors, for FAILED and skipped-after-failure, read scrollHeight and clientHeight of the card in DevTools. Never run STACK or F.A.S.T. steps."
    expected: "scrollHeight <= clientHeight everywhere; error text right of the image, max 3 lines, full text in the tooltip; label below the row; cards without an error look as before."
    why_human: "Rendered fixed-height layout. The static scan pins the JSX structure and the arithmetic is plausible (row height = 64/65px image block absorbs 63px of clamped text, so content stays at about 147-148px against the 151px box), but no jsdom/RTL harness exists and the executor did not run the live check (03-07-SUMMARY, Open human check). Presence of the markup is not proof that the card fits."
human_verification:
  - test: "UAT test 3 retest (G-03-3): measure the step card on the live page as described in behavior_unverified_items."
    expected: "scrollHeight <= clientHeight for FAILED and skipped-after-failure cards at 250px and 300px widths, 1- and 3-line errors, Tool Box tool; sticky label not over the text; no-error cards unchanged."
    why_human: "Rendered layout in a fixed-height card; no rendering harness in the project."
advisory_review_findings:
  - id: "03-REVIEW WR-01 (new, 03-07 review)"
    note: "G-03-3 static scan lets flexShrink={0} pass on any element in the row, not only the image wrapper; justifyContent/width not pinned. Test-strength warning, not a defect in shipped behaviour."
  - id: "03-REVIEW WR-02 (new, 03-07 review)"
    note: "Row adds a stray 8px gap and indents the error text while tool.info is loading or for a tool without imageUrl (wrapper Box is always rendered). Cosmetic, cannot overflow (3-line text is 63px)."
  - id: IN-01
    note: "Full error text on the card is hover-only (title). Banner and Details still carry the full text. Info, open."
  - id: IN-02
    note: "Sticky-label scan is whitespace and prop-order sensitive. Info, open."
  - id: IN-03
    note: "A SUCCESS reply with whitespace-only error_message fails the step. Info only, open (carried over)."
---

# Phase 3: Queue Start Guard & Tool Error Visibility Verification Report

**Phase Goal:** A Start, restart or enqueue never dispatches a queue row that is already in flight; the operator sees before confirming what a Start will run, so a stale leftover row is never a surprise; and when a tool step fails, the operator sees the tool's own message wherever the failure shows, and no tool error is ever shown as success.
**Verified:** 2026-10-29
**Status:** human_needed (all automated truths verified; one rendered-layout retest left for G-03-3)
**Re-verification:** Yes, after gap-closure plan 03-07 (G-03-3 recorded in 03-UAT.md). The prior report (human_needed, 8/8) is stale: 03-07 changed `SwimLaneCommandComponent.tsx` and `staticScan.test.ts`. Passed items got a regression check. The failed item (G-03-3) got full verification.

## Gate Evidence (run in this verification)

| Gate | Command | Result |
| ---- | ------- | ------ |
| Unit tests | `cd controller && npm run test:unit` | 20 files / 436 tests passed (434 baseline + 2 new G-03-3 scans) |
| Types | `npx tsc --noEmit` | exit 0, no output |
| QUE-09 untouched | `git diff --stat 5726822 -- controller/test/toolControl.test.ts controller/test/sqliteQueue.test.ts controller/test/queueRestart.test.ts` | empty (no diff) |
| CommandImage unchanged | `git diff --stat e25f0a4 -- controller/components/tools/CommandImage.tsx` | empty (no diff) |
| Delta since last verification | `git diff --stat 30a4273 HEAD -- controller` | only `SwimLaneCommandComponent.tsx` (+29/-21) and `staticScan.test.ts` (+43/0). No server or queue code changed, so QUE-07/08/09 and ERR-01/02/04/05 server logic is byte-identical to the prior verified state |
| Debt markers | grep TBD/FIXME/XXX in the two changed files | none |
| Probes | none declared by this phase | SKIPPED |

## G-03-3 closure check (full verification of the previously failed item)

Gap: FAILED / skipped-after-failure card error text did not fit the fixed 165px card (content 230px in a 163px box) and the sticky label painted over the first error line.

What the code now does (`SwimLaneCommandComponent.tsx`, read directly, lines ~158-186):
- `<HStack spacing={2} width="100%" justifyContent="center">` holds `<Box flexShrink={0}><CommandImage .../></Box>` and, when `errorText !== null`, a `<Text>` with `fontSize="sm"`, `noOfLines={3}`, `whiteSpace="normal"`, `wordBreak="break-word"`, `flex="1"`, `minW={0}`, `title={errorText}`. It is no longer a separate VStack child under the image.
- The sticky label `<Box bottom={0} position="sticky">` remains the last VStack child, unchanged.
- Card root box properties (`height="165px"`, `padding="6px"`, `minW="250px"`, `maxW="300px"`, `overflowY="auto"`) are retained and pinned by the new scan. The error Text keeps its font size, default line height and 3-line clamp. `CommandImage.tsx` has no diff. Single `<CommandImage`, single COMPLETED `CheckCircle`, no `dangerouslySetInnerHTML` (existing scans green).
- Test written red first (d8ecac5), production fix after (bf692ba). The two new scans exist and pass; the earlier ERR-03/04/05 scans pass unedited (`staticScan.test.ts` 0 deleted lines).

Reasoning on fit (not proof): the image block is 64px (IconButton) / 65px (Image). A 3-line `sm` clamp is about 63px at the default 1.5 line height. The row height therefore stays at the image block height and the content returns to about 147-148px, inside the 151px content box. Without overflow the sticky label is inert again. This is consistent with the UAT debug root cause, but it is a static estimate. The plan itself tagged this truth `verification: backstop` and the 03-07 SUMMARY says the live retest was not performed.

Verdict for the truth "card fits, label does not cover text": PRESENT_BEHAVIOR_UNVERIFIED. The code is present, wired and the structure is pinned. The assertion is about rendered geometry that no automated check here exercises. It is not FAILED (nothing observable contradicts it) and not VERIFIED (no measurement). Routed to human verification. UAT test 3 remains the open retest.

Review of 03-07 (03-REVIEW.md, 0 critical, 2 warnings, 2 info) read: the warnings concern scan strength and a cosmetic 8px gap when no image renders. Neither is a correctness defect, neither blocks a must-have. The disposition file lists them as `open` (ids WR-01/WR-02 there are reused from the earlier fixed WR-01/WR-02; the new findings are untriaged), recorded as advisory.

## Observable Truths (ROADMAP success criteria, regression-checked)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | While a step is in flight, Run/restart/enqueue does not dispatch the row twice; queue stays running; Logs record "Queue Start Ignored" | VERIFIED | `command_queue.ts` guard is first in `_start`; file unchanged since prior verification; `queueStartGuard.test.ts` green (436/436) |
| 2 | Run confirmation shows queued rows to run, FAILED retries, distinct runs, read-only, nothing pre-selected, no timer; Logs list queue_ids and run_ids | VERIFIED | Files unchanged; unit and staticScan green; UAT test 1 passed on the live UI |
| 3 | FAILED step stays queued and re-runs first; retry/h0q/o44/t9e regression tests pass unmodified | VERIFIED | Protected files zero diff vs 5726822; suites green |
| 4 | Test written failing first drives each tool response code through the queue and pins message/code/stored error | VERIFIED | `errorPath.test.ts` green; red-first commits precede fixes; later change additive only (see 03-07 SUMMARY deviation note, confirmed: purely additive) |
| 5 | Failed step shows the tool's own text; real code name, never UNKNOWN | VERIFIED | `toolReply.ts`/`tools.ts` unchanged; UAT test 2 confirmed badge on the live UI |
| 6 | Failed step card shows stored error incl. after banner cleared/restart; after dismiss, the next failure shows the banner again | VERIFIED for content, persistence and re-arm (UAT tests 2, 3 content half); layout fit see truth 9 | Stored-error rendering survives 03-07 (still `stepErrorText(command)` via `errorText`, `title={errorText}`, `noOfLines={3}`) |
| 7 | Failed step never shown as completed; SUCCESS reply carrying error text is an error; run whose failed step was skipped is not plain success | VERIFIED | `runOutcome.ts`/`utils.ts` unchanged; UAT test 4 passed (orange badge and bar); single COMPLETED `CheckCircle` pinned |
| 8 | An ignored Start is shown to the operator and a retry right after a failure starts immediately (03-01/WR-01 truth, override applied to the D-02 wording) | PASSED (override) + VERIFIED | Code unchanged; UAT test 5 passed live |
| 9 | Step-card error fits the fixed 165px card; label never covers the text (03-07 must-have, G-03-3) | PRESENT_BEHAVIOR_UNVERIFIED | Markup and structure verified and pinned; geometry not measured; see above |

**Score:** 8/9 truths verified; 1 present, behavior-unverified (rendered geometry).

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `controller/components/runs/list/SwimLaneCommandComponent.tsx` | VERIFIED (substantive, wired) | Row layout as above; imported and rendered by RunsComponent (unchanged wiring) |
| `controller/test/staticScan.test.ts` | VERIFIED | New describe "step card error fits the fixed card (G-03-3)", 2 cases, pass |
| `.planning/.../03-UI-SPEC.md` | VERIFIED | S3/UA2/backstop note amended (03-07 Task 2) |
| `controller/components/tools/CommandImage.tsx` | VERIFIED unchanged | no diff vs e25f0a4 |
| All other phase artifacts (server queue, router, toolReply, tools, SqliteQueue, queueStartListing, pure UI helpers, banner/modal components, remaining tests) | VERIFIED | unchanged since the previous verification, which read them in full; tests green |

### Key Link Verification

| From | To | Status |
| ---- | -- | ------ |
| `SwimLaneCommandComponent` row -> `CommandImage` (flexShrink 0 wrapper) and error `Text` (flex 1, minW 0) | single HStack above sticky label | WIRED |
| `SwimLaneCommandComponent` -> `stepErrorText(command)` -> `errorText` | step card error line | WIRED |
| Router `restart` -> guard in `_start`; `enqueueRun` -> `_start("enqueue")` | single-flight | WIRED (unchanged) |
| `tools.ts` -> `describeToolReply` -> `ToolCommandExecutionError` -> `getError` payload with seq | banner, step card | WIRED (unchanged) |
| `QueueStatuscomponent` -> `commands.useQuery` + `queuedStartLines`; `restart` `onSuccess` -> warning toast on `!accepted` | modal, ignored-Start visibility | WIRED (unchanged) |
| `getRunAttributes` -> `deriveRunOutcome`; `RunsComponent` -> badge/progress scheme | skipped-failure display | WIRED (unchanged) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| Step card error Text | `errorText` from `command.error` | persisted row via `getAll` | yes | FLOWING |
| Run confirmation modal | `commandQueue.commands` | queue-joined SQLite | yes | FLOWING |
| Error banner | `getError.data` + `failureSeq` | `CommandQueue.getError()` | yes | FLOWING |
| Run outcome | polled `run.Commands` | rows | yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole unit suite incl. guard, errorPath, toolReply, queueError, runOutcome, queuedStartSummary, staticScan | `npm run test:unit` (run once) | 436/436 | PASS |
| Type check | `npx tsc --noEmit` | exit 0 | PASS |

### Probe Execution

None declared by this phase. SKIPPED.

### Requirements Coverage (PLAN frontmatter vs REQUIREMENTS.md)

Plan `requirements:` fields: 03-01 {QUE-07, QUE-08, QUE-09}; 03-02 {ERR-01}; 03-03 {QUE-08}; 03-04 {ERR-01, ERR-02, ERR-04, ERR-05}; 03-05 {ERR-05}; 03-06 {ERR-03, ERR-04, ERR-05}; 03-07 {ERR-03}. Union = {QUE-07, QUE-08, QUE-09, ERR-01, ERR-02, ERR-03, ERR-04, ERR-05}, exactly the 8 IDs mapped to Phase 3 in REQUIREMENTS.md (all checked, traceability "Complete"). No ORPHANED requirements.

| Requirement | Source Plans | Status | Evidence |
| ----------- | ------------ | ------ | -------- |
| QUE-07 | 03-01 | SATISFIED | Guard unchanged; single-dispatch tests green |
| QUE-08 | 03-01, 03-03 | SATISFIED | Truth 2; UAT 1 passed live |
| QUE-09 | 03-01, 03-04, 03-06 | SATISFIED | zero diff on protected tests, green |
| ERR-01 | 03-02, 03-04 | SATISFIED | red-first errorPath table, green |
| ERR-02 | 03-04 | SATISFIED | Truth 5 |
| ERR-03 | 03-06, 03-07 | SATISFIED for content/persistence; layout fit pending live retest | Truth 6 and truth 9 |
| ERR-04 | 03-04, 03-06 | SATISFIED | seq/dismissedSeq unchanged; UAT 2 passed live |
| ERR-05 | 03-04, 03-05, 03-06 | SATISFIED | Truth 7; UAT 4 passed live |

### Prohibitions

| Prohibition | Tier | Status |
| ----------- | ---- | ------ |
| Ignored Start changes no state/error/_failedAttempt; no auto acknowledge/cancel/retry/skip | test | Held (server code unchanged) |
| Protected regression test files unmodified | test | Held (git diff empty) |
| Run confirmation gains no timer/default/autoFocus/form/new button | test | Held (staticScan) |
| No tool error reported as success; tool text not rewritten; banner dismissal never clears error | test | Held; 03-07 keeps error text a React child with `title`, no HTML injection |
| 03-07: CommandImage.tsx, card box, error Text font/line-height/clamp, label unchanged | test | Held (no diff on CommandImage; scan pins the rest) |
| failing test not weakened | judgment | Held, non-authoritative (03-07 scans added red-first, 0 deleted lines) |

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX in changed files. Review advisories listed in frontmatter.

### Human Verification Required

1. **UAT test 3 retest (G-03-3).** Rebuild (`docker compose up -d --build galago-web`), then on cards at 300px and 250px with 1-line and 3+-line errors, for FAILED and skipped-after-failure, using Tool Box steps, read the card's `scrollHeight` and `clientHeight` in DevTools. Expected: `scrollHeight <= clientHeight`, error right of the image (max 3 lines, full text in tooltip), label below the row, no-error cards unchanged. Why human: fixed-height rendered geometry; no rendering harness. Never run STACK or F.A.S.T. steps.

### Gaps Summary

No gaps. Every roadmap success criterion and requirement is backed by code and green tests (436/436, tsc clean, QUE-09 no-diff gate holds, no server code changed since the last verification). The G-03-3 fix is present, structurally pinned by a red-first scan, and consistent with the root-cause arithmetic, but the claim that the card now fits is a measured-geometry claim that has not been measured. Status is `human_needed` solely for that retest; if the measurement shows overflow, reopen G-03-3.

---

_Verified: 2026-10-29_
_Verifier: Claude (gsd-verifier)_
