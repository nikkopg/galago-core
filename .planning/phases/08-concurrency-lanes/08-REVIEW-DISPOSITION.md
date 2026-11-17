---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
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
    disposition: open
    title: "`ErrorBanner` is a component declared inside render, so the new failure list remounts and loses its scroll position"
  - id: WR-05
    severity: warning
    disposition: open
    title: "The first entry of the failure list is assumed to be the banner error, which is false after `clearError()`"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "`gotoCommand` and `gotoCommandByRunIndex` no longer supersede a pending late abort reply for a failed side-lane attempt"
  - id: WR-07
    severity: warning
    disposition: open
    title: "The protocol editor states \"runs its steps one at a time\" before the server mode is known, and still shows lane refusals that are not applied"
  - id: IN-01
    severity: info
    disposition: open
    title: "The \"no dispatch after halt\" guarantee still depends on the SQLite driver being synchronous"
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
open: 11
total: 14
recorded: 2026-11-17T01:22:09.257Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | full-phase review (6433f5c); file not in the incremental re-review scope |
| WR-02 | warning | fixed | c438887; re-review (8ece3ad) confirms fixed; tests in controller/test/laneReviewFixes.test.ts |
| WR-03 | warning | fixed | 773389c; re-review (8ece3ad) confirms Start summary and audit line fixed; editor residual tracked as WR-07 |
| WR-04 | warning | open | full-phase review (6433f5c); file not in the incremental re-review scope |
| WR-05 | warning | open | still reported by the re-review (8ece3ad) |
| WR-06 | warning | fixed | c438887; re-review (8ece3ad) confirms fixed; tests in controller/test/laneReviewFixes.test.ts |
| WR-07 | warning | open | new in the re-review (8ece3ad) |
| IN-01 | info | open | still reported by the re-review (8ece3ad) |
| IN-02 | info | open | full-phase review (6433f5c); file not in the incremental re-review scope |
| IN-03 | info | open | full-phase review (6433f5c); file not in the incremental re-review scope |
| IN-04 | info | open | full-phase review (6433f5c); file not in the incremental re-review scope |
| IN-05 | info | open | still reported by the re-review (8ece3ad) |
| IN-06 | info | open | new in the re-review (8ece3ad) |
| IN-07 | info | open | new in the re-review (8ece3ad) |

The full-phase review is at commit 6433f5c (`git show 6433f5c:.planning/phases/08-concurrency-lanes/08-REVIEW.md`); the current 08-REVIEW.md is the incremental re-review of the 7 files changed by the WR-02/03/06 fixes.

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
