---
status: complete
phase: 03-queue-start-guard-tool-error-visibility
source: [03-VERIFICATION.md]
started: 2026-10-28T22:54:02Z
updated: 2026-10-29T04:39:33.042Z
---

## Current Test

[testing complete]

## Tests

### 1. Run confirmation shows what a Start will run
expected: Counts of steps, failed retries and runs are shown read-only; nothing pre-selected, no timer, Enter does not confirm; wraps at narrow widths.
result: pass
source: automated
evidence: "Live UI (Chrome, toolbox-only JS fixtures). Two queued runs, one with a FAILED step -> 'This Start will run 4 queued steps from 2 runs.' + '1 of them failed before and will be retried first.'; simulation-mode warning, Accept, Cancel unchanged; initial focus on the X close button (not Accept/Cancel); Enter closed the dialog without starting (queue state unchanged); dialog stayed open >15s (no timer); at 240px width all lines wrap, no overflow."

### 2. Error banner re-arms after a dismiss
expected: Dismiss a failure banner, then cause a second failure (even with identical text): the banner shows again. A long tool message scrolls inside the 160px region; the code badge shows the real code name (never UNKNOWN/SUCCESS).
result: pass
source: automated
evidence: "Dismissed the ERROR_FROM_TOOL banner, retried the same failing step -> identical-text failure re-showed the banner. Message region max-height 160px / overflow-y auto, scrolls at ~860px window width. Badge shows ERROR_FROM_TOOL; a plain Error (Tool Box not in store) shows no badge (never UNKNOWN/SUCCESS)."

### 3. Step card shows the stored error
expected: A FAILED step card shows its tool error (clamped to 3 lines, full text on hover) and keeps showing it after the banner is dismissed and after a galago-web restart; a step skipped after failure reads "Skipped after failure: ..."; a plain Skip shows no error text; the text fits inside the 165px card.
result: pass
source: user
note: "Marked pass by the user after gap-closure plan 03-07 (error text moved beside the image; static scan pins the row layout). The live scrollHeight/clientHeight retest was waived as minor by the user."
reported_before_fix: "Automated check: the FAILED card shows the stored error (3-line clamp, full text in title), it survives banner dismiss and a galago-web container restart, a skipped-after-failure card reads 'Skipped after failure: ...' in orange at full opacity, and a plain Skip shows no error (dimmed 0.55). BUT the text does not fit the 165px card: card content is 230px in a 163px box, so the card needs an internal scroll, and at its default scroll position the sticky 'Run script' label is drawn over the first line of the error text (seen on both the FAILED and the skipped-after-failure card)."
severity: minor

### 4. Skipped-failure run is not shown as success
expected: A run whose failed step was skipped shows the orange "Skipped failure" badge and orange progress bar (never teal/green, no check icon), including when later steps COMPLETED.
result: pass
source: automated
evidence: "Run whose failed step was skipped, later steps COMPLETED -> orange 'SKIPPED FAILURE' badge and orange striped progress bar, no check icon; the plain-skip run kept the normal bar."

### 5. An ignored Start is shown, and a retry right after a failure is accepted
expected: Right after a step fails (banner visible), pressing Start and accepting starts the retry immediately. If Start is pressed while the queue is still busy (e.g. Pause queue then Start during a step), a "Start ignored" warning toast appears and nothing is dispatched twice.
result: pass
source: automated
evidence: "With the failure banner visible, Start+Accept retried immediately (state BUSY, step 1 COMPLETED). Pause queue during a 12s step, then Start+Accept -> 'Start ignored' warning toast; server logged 'Queue Start Ignored'; the running step executed once and the next step stayed CREATED (no double dispatch)."

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-03-3
  truth: "A FAILED / skipped-after-failure step card's error text fits inside the 165px card"
  status: resolved
  resolved_by: 03-07-PLAN.md
  resolved_at: 2026-10-29
  resolution_note: "Fixed in bf692ba; live scrollHeight/clientHeight retest waived as minor by the user, test 3 marked pass."
  reason: "Automated UAT: card content is 230px in a 163px box (internal scroll needed) and the sticky 'Run script' label overlaps the first error line at the default scroll position"
  severity: minor
  test: 3
  root_cause: "The fixed 165px card (151px content box) already holds 147-148px of non-error content; 03-06 stacked the error Text vertically below CommandImage (+8px gap +up to 63px), so content reaches 218px (scrollHeight 230 vs clientHeight 163) even for a 1-line error. Once the card overflows, the background-less sticky bottom label pins at card y131-158 and paints over the error text until scrollTop ~60. The UI-SPEC fit claim was never measured."
  artifacts:
    - path: "controller/components/runs/list/SwimLaneCommandComponent.tsx"
      issue: "Error Text added as another vertical VStack child under CommandImage inside a fixed height=165px overflowY=auto card; sticky bottom label overlays content when the card overflows"
    - path: "controller/components/tools/CommandImage.tsx"
      issue: "Image block is a fixed 64px (Tool Box IconButton + py=3) / 65px (Image), leaving no vertical room for an error block"
  missing:
    - "Card content must fit 151px with a 3-line error (scrollHeight <= clientHeight) without resizing the card, changing the error Text's font size/lineHeight or noOfLines={3}, or changing the label"
    - "Keep staticScan error-visibility invariants green (stepErrorText(command), noOfLines={3}, whiteSpace=normal, title={errorText}, single COMPLETED CheckCircle, no dangerouslySetInnerHTML)"
    - "Visual re-check: FAILED and skipped-after-failure cards, 1- and 3-line messages, Tool Box and Image tools, 250-300px card widths"
  debug_session: .planning/debug/step-card-error-overflow.md
