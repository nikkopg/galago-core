---
phase: 04
review: 04-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Log-forging fix is incomplete — enqueue-time operator-only audit record interpolates `c.toolId` unsanitized"
  - id: WR-02
    severity: warning
    disposition: open
    title: "`extractLatch({})` still yields a confident \"No failure latched\", contradicting the WR-02 router fix and D-13"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Acknowledge button is not disabled while a send is pending; a repeat click silently clears the in-progress indicator"
  - id: WR-04
    severity: warning
    disposition: open
    title: "`tool.latchStatus` sends the latch command to any registered tool type"
  - id: WR-05
    severity: warning
    disposition: open
    title: "`createFromProtocol` wraps every unexpected failure in `ProtocolGenerationFailedError` with the wrong constructor argument, so server faults surface as a client 400 with the real cause lost"
  - id: IN-01
    severity: info
    disposition: open
    title: "Name-based type guards are not sound, and `throw e.cause` assumes a ZodError"
  - id: IN-02
    severity: info
    disposition: open
    title: "GUID hint says \"cannot be blank\" for every invalid guid"
  - id: IN-03
    severity: info
    disposition: open
    title: "`sanitizeLogText` covers C0 controls only"
  - id: IN-04
    severity: info
    disposition: open
    title: "`/api/runs` maps client-fault errors to 500"
  - id: IN-05
    severity: info
    disposition: open
    title: "`extractLatch` ignores an explicit `latched` field"
open: 10
total: 10
recorded: 2026-10-30T04:08:30.882Z
---

# Phase 04: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
