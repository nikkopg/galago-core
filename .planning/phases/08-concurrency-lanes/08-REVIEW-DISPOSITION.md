---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "The first entry of the failure list is assumed to be the banner error, which is false after `clearError()`"
  - id: WR-07
    severity: warning
    disposition: fixed
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
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Non-canonical `laneBarrier` / `lane` values are silently ignored and are not rejected by `validateLanes`"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "A row can be left STARTED with no owner when an exception escapes between the claim and the step's `try`"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Lane-aware text is shown when the server has lanes off, which tells the operator work will run in parallel"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "`ErrorBanner` is a component declared inside render, so the new failure list remounts and loses its scroll position"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "`gotoCommand` and `gotoCommandByRunIndex` no longer supersede a pending late abort reply for a failed side-lane attempt"
  - id: IN-02
    severity: info
    disposition: open
    title: "The Lane input normalises on every keystroke"
  - id: IN-03
    severity: info
    disposition: open
    title: "Raw lane names are embedded unbounded in validation messages, and the API handler sends them without a content type"
  - id: IN-04
    severity: info
    disposition: open
    title: "The freeze toast reports \"Lanes frozen\" even when the server answered `frozen: false`"
open: 7
total: 14
recorded: 2026-11-17T01:34:20.842Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-05 | warning | fixed | 08-REVIEW-FIX.md |
| WR-07 | warning | fixed | 08-REVIEW-FIX.md |
| IN-01 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| WR-01 | warning | fixed | 08-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | c438887; re-review (8ece3ad) confirms fixed; tests in controller/test/laneReviewFixes.test.ts (not in the current review) |
| WR-03 | warning | fixed | 773389c; re-review (8ece3ad) confirms Start summary and audit line fixed; editor residual tracked as WR-07 (not in the current review) |
| WR-04 | warning | fixed | 08-REVIEW-FIX.md (not in the current review) |
| WR-06 | warning | fixed | c438887; re-review (8ece3ad) confirms fixed; tests in controller/test/laneReviewFixes.test.ts (not in the current review) |
| IN-02 | info | open | full-phase review (6433f5c); file not in the incremental re-review scope (not in the current review) |
| IN-03 | info | open | full-phase review (6433f5c); file not in the incremental re-review scope (not in the current review) |
| IN-04 | info | open | full-phase review (6433f5c); file not in the incremental re-review scope (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
