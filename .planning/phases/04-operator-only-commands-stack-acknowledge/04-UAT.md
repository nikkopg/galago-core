---
status: testing
phase: 04-operator-only-commands-stack-acknowledge
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md]
started: 2026-10-29T12:00:00.000Z
updated: 2026-10-29T12:00:00.000Z
---

## Current Test

number: 1
name: Acknowledge flow end-to-end
expected: |
  On a STACK tool's Run Recovery card: type a guid (blank refused, never trimmed, maxLength 256, no
  Enter-bound default), "Acknowledge failure…" opens the shared confirmation modal that restates the guid
  byte-for-byte with acknowledge-specific copy ("Acknowledge STACK failure" header, no "instrument head
  will move" note), Yes/No radios born empty (only choosing "yes" enables Confirm), Confirm sends once
  (single-flight, no retry) and on acceptance shows the "STACK failure acknowledged" toast and clears the
  guid input.
awaiting: user response

## Tests

### 1. Acknowledge flow end-to-end
expected: No trim, maxLength 256, no auto-submit, single send-flight only, verbatim guid restatement,
  born-empty non-defaulted radios, guid clears after acceptance, ack-specific toast.
result: [pending]

### 2. Latch block
expected: Explicit "Read latch" click (no polling, no timers); result shows guid (selectable) /
  kind + explanation / raw JSON collapsible / "No failure latched" when none; "Use this guid" fills the
  guid input and never sends; a gated chip/button state is unaffected by the read result (display only).
result: [pending]

### 3. Card stays enabled while a STACK step runs
expected: With a STACK step running on that tool, the recovery card's buttons are NOT greyed
  (no run-state check exists); clicking "Acknowledge failure…" gets a persistent "Action refused" toast
  with the server message ("A run step is running on this tool; acknowledge after it ends.") and an
  audited refusal entry in Logs; the run-page Stop/Clear All act on the queue directly (no abort-first
  dead-end for stack).
result: [pending]

### 4. Backstop sign-off — residual concurrency posture
expected: Two overlappingacknowledge attempts are each audited, sent at most once apiece, and nothing in
  the client serializes them — the tool core's exact-guid + arm-inspected check remains the real gate;
  user accepts this posture per the Phase-1 control-race precedent (PROJECT.md).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
