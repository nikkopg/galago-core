---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "`goto` targetIndex validation still accepts `null`/`\"\"` as index 0"
  - id: WR-02
    severity: warning
    disposition: open
    title: "An abort accepted mid-step that then actually succeeds leaves the rest of the run queued, untouched and untested"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`RunStateMonitor.snapshot()`'s new `structuredClone` can throw where the old shallow copy never could"
  - id: WR-04
    severity: warning
    disposition: open
    title: "\"Step Removed While Running\" conflates a successful completion with a generic DB not-found error"
  - id: IN-01
    severity: info
    disposition: open
    title: "F.A.S.T. `tip_reuse` select field has no default value"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "`tip_reuse` command field has no enum/select type despite only two valid values (carried forward, unresolved, pre-existing, out of this round's file scope)"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "`HEAD_MOVES_NOTE` is shown unconditionally, including for Pause"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "Tool-id normalization is reimplemented independently in three places"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "A failed Stop/Clear-All/Delete-Run follow-up after an accepted abort leaves queue state desynced from instrument state"
open: 5
total: 9
recorded: 2026-10-15T22:39:53.598Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-05 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-06 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-07 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
