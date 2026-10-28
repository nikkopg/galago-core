---
status: testing
phase: 03-queue-start-guard-tool-error-visibility
source: [03-VERIFICATION.md]
started: 2026-10-28T22:54:02Z
updated: 2026-10-28T22:54:02Z
---

## Current Test

number: 1
name: Run confirmation shows what a Start will run
expected: |
  With two queued runs, one holding a FAILED step, pressing Run opens the confirmation with
  "This Start will run N queued step(s) from M run(s)." and the failed-retry line; the existing
  simulation-mode warning, Accept and Cancel are unchanged; nothing is pre-selected, Enter does not
  confirm, no timer; text wraps at narrow widths.
awaiting: user response

## Tests

### 1. Run confirmation shows what a Start will run
expected: Counts of steps, failed retries and runs are shown read-only; nothing pre-selected, no timer, Enter does not confirm; wraps at narrow widths.
result: [pending]

### 2. Error banner re-arms after a dismiss
expected: Dismiss a failure banner, then cause a second failure (even with identical text): the banner shows again. A long tool message scrolls inside the 160px region; the code badge shows the real code name (never UNKNOWN/SUCCESS).
result: [pending]

### 3. Step card shows the stored error
expected: A FAILED step card shows its tool error (clamped to 3 lines, full text on hover) and keeps showing it after the banner is dismissed and after a galago-web restart; a step skipped after failure reads "Skipped after failure: ..."; a plain Skip shows no error text; the text fits inside the 165px card.
result: [pending]

### 4. Skipped-failure run is not shown as success
expected: A run whose failed step was skipped shows the orange "Skipped failure" badge and orange progress bar (never teal/green, no check icon), including when later steps COMPLETED.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
