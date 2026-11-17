---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: WR-05
    severity: warning
    disposition: open
    title: "The first entry of the failure list is assumed to be the banner error, which is false after `clearError()`"
  - id: WR-07
    severity: warning
    disposition: open
    title: "The protocol editor states \"runs its steps one at a time\" before the server mode is known, and still shows lane refusals that are not applied"
  - id: IN-01
    severity: info
    disposition: open
    title: "The \"no dispatch after halt\" guarantee still depends on the SQLite driver being synchronous"
  - id: IN-05
    severity: info
    disposition: open
    title: "The per-lane start summary numbers steps by queue position, not by protocol position"
  - id: IN-06
    severity: info
    disposition: open
    title: "The new WR-03 UI tests assert on source text, not behaviour"
  - id: IN-07
    severity: info
    disposition: open
    title: "`describeQueueStart` defaults `laneMode` to false"
open: 6
total: 6
recorded: 2026-11-17T01:22:09.257Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-05 | warning | open | - |
| WR-07 | warning | open | - |
| IN-01 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
