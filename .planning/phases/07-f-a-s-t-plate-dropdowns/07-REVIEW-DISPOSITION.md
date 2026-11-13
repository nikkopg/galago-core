---
phase: 07
review: 07-REVIEW.md
titles: json
findings:
  - id: WR-02
    severity: warning
    disposition: open
    title: "A source drag silently overwrites variable references in the well fields (carried forward, open)"
  - id: WR-03
    severity: warning
    disposition: open
    title: "\"No Variable\" on a local binding writes a blank that the UI then flags as invalid (carried forward, open)"
  - id: WR-04
    severity: warning
    disposition: open
    title: "The int32 refusal exists only at execution time, with no enqueue-time scan and an unguarded `estimateDuration`"
  - id: IN-01
    severity: info
    disposition: open
    title: "`isNoZeroFillField` number-input branch in the modal is unreachable for the only configured command (carried forward, open)"
  - id: IN-02
    severity: info
    disposition: open
    title: "Source-scanning static tests are brittle proxies for behaviour (carried forward, open)"
  - id: IN-03
    severity: info
    disposition: open
    title: "`int32FromDigits(\"\")` returns 0, a silent blank-to-zero conversion guarded only by a comment"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Typed plate id / well count is not range-bounded and wraps to a different value on the wire"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Source-grid drag can get stuck and keep rewriting the selection when pointer capture is refused"
open: 6
total: 8
recorded: 2026-11-13T07:35:16.439Z
---

# Phase 07: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| CR-01 | critical | fixed | 07-09 (2d603bc, bab42b3, 206107e); confirmed resolved in re-review b37b46d |
| WR-01 | warning | fixed | 07-10 (55b0494); confirmed resolved in re-review b37b46d |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
