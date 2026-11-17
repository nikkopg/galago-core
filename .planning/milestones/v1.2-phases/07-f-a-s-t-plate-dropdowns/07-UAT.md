---
status: complete
phase: 07-f-a-s-t-plate-dropdowns
source: [07-VERIFICATION.md]
started: 2026-11-13T07:38:48Z
updated: 2026-11-16T08:34:24.871Z
---

## Current Test

[testing complete]

## Tests

### 1. Source-grid drag in a real browser, in all three hosts (tool page, AddToolCommandModal, edit-mode CommandDetailsDrawer)
expected: With two registered 8x12 plates chosen: press B3, drag to D5, leave the grid past its right edge, return and release; the four source fields follow live and stop on release. Press B3, drag to C4, leave, release outside, hover back with no button: the four fields never change. Right-click a source well: nothing is written.
result: pass

### 2. Plate dropdown against a live F.A.S.T. instrument, including while a Transfer is running
expected: Labels read '{id} · {description}', start blank, a duplicate id is flagged, the list loads mid-Transfer (PLT-01 live).
result: pass
note: "User confirmed plate list fetches while a Transfer is running. Earlier Transfer attempts were refused by the tool's tray guard ('tray 90 installed, no expected tray configured') until expected_tray_id was set; not a Phase 7 issue."

### 3. Deck selects and Reuse tips checkbox render; 384-well layout; size-mismatch warning; instrument-unreachable fallback; dark-mode legibility
expected: Decks start blank and list 1-6; Reuse tips starts checked on a new step, unchecked sends fresh, saved blank shows indeterminate with a flag. Two 384 plates scroll inside their own boxes (side by side in the modal, stacked in the drawer). 8x12 vs 16x24 shows the -9006 warning with no footprint and saving still works. With the tool server stopped, plate fields become typed numeric inputs, the grids are hidden and 'Edit as fields' opens itself.
result: pass

### 4. Typed out-of-range plate id in the UI
expected: Typing 4294967297 into a plate field (instrument unreachable) keeps the digits, shows the 'larger than 2147483647 or not a whole number' flag, and a run that reaches the step fails with the int32 refusal and sends nothing.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

## Environment Notes

- 2026-11-16: F.A.S.T. instrument is at 192.168.0.7:5003 on the STACK LAN. Exposed to the office network by `~/fast-forward.py` on stack-server (10.150.1.125:5003 -> 192.168.0.7:5003, allowlist 10.150.1.138/.83/.89; not reboot-persistent).
- 2026-11-16: Tools in controller/data/app.db: FA100056 (fast) -> host.docker.internal:40001, instrument 10.150.1.125:5003, expected_tray_id 0; STACK2-6 (stack) -> host.docker.internal:40012, manager 10.150.1.125:5005. Tool servers come from the galago-tools launcher (http://localhost:8081), started 2026-11-14 on 40001/40012.
- 2026-11-16: docker-compose.dev.yml gained extra_hosts host.docker.internal:host-gateway so the container can reach host tool servers on Linux (uncommitted).
- Known out-of-scope behavior: galago-tools base_server reports READY after Configure without re-checking the instrument, so a powered-off F.A.S.T. still showed connected/ready. EditToolConfig isValidIP flags host.docker.internal as invalid (cosmetic; save still works).
- Earlier in the session tests 1-3 were marked blocked (instrument off); unblocked once the F.A.S.T. was reachable.
