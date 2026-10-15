---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: open
    title: "Dead state and legacy debug artifact in `RunsComponent.tsx` (carried forward, unresolved, pre-existing)"
  - id: IN-02
    severity: info
    disposition: open
    title: "`tip_reuse` command field has no enum/select type despite only two valid values (carried forward, unresolved, pre-existing)"
  - id: WR-05
    severity: warning
    disposition: skipped
    title: "`HEAD_MOVES_NOTE` is shown unconditionally, including for Pause"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Unsound type assertion can build a stop request with `toolType: undefined`"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Two independent confirm modals can be open at once with no mutual exclusion"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Confirm-modal remount key doesn't disambiguate by request identity"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "`stopModalBody` hardcodes the `return_liquid` decision key"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "Tool-id normalization is reimplemented independently in three places"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "A failed Stop/Clear-All/Delete-Run follow-up after an accepted abort leaves queue state desynced from instrument state"
open: 2
total: 9
unparsed: 1
recorded: 2026-10-15T02:49:07.988Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| WR-05 | warning | skipped | 02-REVIEW-FIX.md |
| WR-01 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-06 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-07 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
