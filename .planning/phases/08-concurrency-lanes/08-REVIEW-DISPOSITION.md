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
    disposition: open
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
  - id: IN-01
    severity: info
    disposition: open
    title: "The \"no dispatch after halt\" guarantee depends on the SQLite driver being synchronous"
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
open: 9
total: 11
recorded: 2026-11-16T18:00:31.000Z
---

# Phase 08 — Code Review Disposition

WR-02 and WR-06 are `fixed` (regression tests in `controller/test/laneReviewFixes.test.ts`); the other 9 findings from 08-REVIEW.md are recorded as `open` (0 critical, 6 warning, 5 info). None violates a lane-engine safety invariant; they are candidates for a follow-up fix pass (`/gsd-code-review 8 --fix`).
