---
status: testing
phase: 07-f-a-s-t-plate-dropdowns
source: [07-VERIFICATION.md]
started: 2026-11-13T07:38:48Z
updated: 2026-11-13T07:38:48Z
---

## Current Test

number: 1
name: Source-grid drag in a real browser, in all three hosts (tool page, AddToolCommandModal, edit-mode CommandDetailsDrawer)
expected: |
  With two registered 8x12 plates chosen: press B3, drag to D5, leave the grid past its right edge, return and release; the four source fields follow live and stop on release. Press B3, drag to C4, leave, release outside, hover back with no button: the four fields never change. Right-click a source well: nothing is written.
awaiting: user response

## Tests

### 1. Source-grid drag in a real browser, in all three hosts (tool page, AddToolCommandModal, edit-mode CommandDetailsDrawer)
expected: With two registered 8x12 plates chosen: press B3, drag to D5, leave the grid past its right edge, return and release; the four source fields follow live and stop on release. Press B3, drag to C4, leave, release outside, hover back with no button: the four fields never change. Right-click a source well: nothing is written.
result: [pending]

### 2. Plate dropdown against a live F.A.S.T. instrument, including while a Transfer is running
expected: Labels read '{id} · {description}', start blank, a duplicate id is flagged, the list loads mid-Transfer (PLT-01 live).
result: [pending]

### 3. Deck selects and Reuse tips checkbox render; 384-well layout; size-mismatch warning; instrument-unreachable fallback; dark-mode legibility
expected: Decks start blank and list 1-6; Reuse tips starts checked on a new step, unchecked sends fresh, saved blank shows indeterminate with a flag. Two 384 plates scroll inside their own boxes (side by side in the modal, stacked in the drawer). 8x12 vs 16x24 shows the -9006 warning with no footprint and saving still works. With the tool server stopped, plate fields become typed numeric inputs, the grids are hidden and 'Edit as fields' opens itself.
result: [pending]

### 4. Typed out-of-range plate id in the UI
expected: Typing 4294967297 into a plate field (instrument unreachable) keeps the digits, shows the 'larger than 2147483647 or not a whole number' flag, and a run that reaches the step fails with the int32 refusal and sends nothing.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
