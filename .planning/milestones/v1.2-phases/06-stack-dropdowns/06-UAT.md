---
status: complete
phase: 06-stack-dropdowns
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md]
started: 2026-11-06T10:05:00Z
updated: 2026-11-06T04:23:55.266Z
---

## Current Test

[testing complete]

## Tests

### 1. vendor/galago-tools pinned to 4ccd3da with zero-diff regen
expected: vendor/galago-tools pinned to 4ccd3da with a zero-diff ts-proto 1.151.1 scratch regen against controller/gen-interfaces, committed as a gitlink-only commit
result: pass
source: automated
coverage_id: 06-01/D1

### 2. tool.options reads through Tool.readOptions, never queued
expected: tool.options reads the four registry sources through Tool.readOptions with Metadata and a 5 s deadline, never queued; every failure maps to a closed reason code
result: pass
source: automated
coverage_id: 06-01/D2

### 3. Automated suite and pin confirmation
expected: `npx vitest run` in controller/ passes (32 files, 756 tests) and `tsc --noEmit` is clean, covering the test-backed coverage entries of 06-02 D1-D5, 06-03 D1-D8, 06-04 D1-D3 and 06-05 H1-H4 (their SUMMARY coverage blocks lack the human_judgment flag, so they could not auto-pass). `git ls-remote` on https://github.com/nikkopg/galago-tools.git shows 4ccd3da at refs/heads/feat/stack-tool (06-01 D4).
result: pass

### 4. Tool page dropdowns start empty and cascade
expected: On the STACK tool page (live or configured STACK), in transfer, get_transfer_estimate and get_labware_presence, every bound field (robot, labware_profile, source/destination device, deck, nest, transfer profiles) is a dropdown that starts on the blank option with nothing preselected, even when only one item is reported. Deck and nest stay disabled until their parent is chosen. Changing a device blanks its deck and nest; changing a deck blanks only its nest; the other side (source vs destination) is untouched.
result: pass

### 5. Refresh keeps selections and updates status line
expected: Clicking Refresh keeps every current selection and updates the "from instrument - N items - fetched hh:mm:ss" status line.
result: pass

### 6. Ambiguity, not-reported and empty-list notes
expected: An ambiguous location shows "(ambiguous - adapter will refuse)" and stays selectable. A saved value the STACK no longer reports stays selected and shows "(not reported by instrument)". Uncalibrated decks/nests are not offered; a device with none still shows with its note.
result: pass

### 7. Offline fallback to typed input
expected: With the STACK tool server stopped, the tool page, AddToolCommandModal and the drawer (edit mode) each show every bound field as a typed input with the hint "Instrument list unavailable - type the value". No stale list appears and the form is never blocked.
result: pass

### 8. Modal: dropdowns beside No Variable, variable-bound parent
expected: In AddToolCommandModal the dropdowns sit beside the "No Variable" picker. Binding a cascade parent (e.g. source_device) to a {{variable}} disables its picker and shows {{name}}; its deck and nest become typed inputs with the hint "child list unavailable while the parent is a variable". Unbinding the variable clears the cascade back to dropdowns.
result: pass

### 9. Drawer edit: deck change and not-reported nest save
expected: In the protocol CommandDetailsDrawer (edit mode), changing a deck blanks only the nest. A saved step whose nest is not reported keeps it selected with the flag, and saving without touching it writes the step unchanged.
result: pass

### 10. Read-only run-page drawer makes no tool.options request
expected: Opening a saved STACK step in the run-page drawer read-only (not editing) sends no tool.options request in the browser network tab.
result: pass

### 11. Long ambiguous names stay readable
expected: A long (up to 256 chars) or ambiguous-flagged name in a dropdown is readable or cleanly clipped; it does not break the form layout.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
