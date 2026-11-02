---
phase: 05
review: 05-REVIEW.md
titles: json
findings:
open: 6
total: 7
unparsed: 0
recorded: 2026-11-02T12:36:00.000Z
---

# Phase 05: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-04 | info | open | new in the incremental delta review (bf928c0): replacement cast is still compiler-unchecked; suggested fix is exporting `Field` from types.ts and typing the parameter directly |
| IN-05 | info | open | new in the incremental delta review (bf928c0): `booleanByName` is a Map whose stored value is never read; Set communicates intent |
| WR-02 | warning | open | carried from the pre-05-04 review; unchanged by the gap closure (not in the current incremental delta review) |
| WR-03 | warning | deferred | residual of CR-01 by design the user locked (2026-11-02): control must stay a free-text `<Input type="boolean">` (05-UI-SPEC AC-4), so "0"/"no"/"TRUE" string inputs remain possible until a constrained Select is chosen (not in the current incremental delta review) |
| IN-01 | info | open | carried from the pre-05-04 review; unchanged by the gap closure (not in the current incremental delta review) |
| IN-02 | info | open | carried; pre-existing tool-page code, not touched by 05-04 (not in the current incremental delta review) |
| IN-03 | info | open | new: isBlank NaN guard leaves typed "Infinity"/"1e400" passing the strip; wider `!Number.isFinite` is the reviewer's suggested fix (not in the current incremental delta review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
