---
phase: 09
review: 09-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "The sim drill's real-tool refusal is bypassed by name variants that the queue still resolves to the real tool"
  - id: WR-01
    severity: warning
    disposition: open
    title: "start-sim launches the real-capable driver and shares the real STACK ledger; nothing enforces simulation"
  - id: WR-02
    severity: warning
    disposition: open
    title: "check-guards prints GUARDS OK even when it checked zero real listeners"
  - id: WR-03
    severity: warning
    disposition: open
    title: "The D-15 pin ends before the claim and never asserts that claimEligible is synchronous"
  - id: WR-04
    severity: warning
    disposition: open
    title: "liveLanesProtocol.test.ts depends on a planning-phase directory outside the controller"
  - id: WR-05
    severity: warning
    disposition: open
    title: "The root .dockerignore omits .env, the live SQLite store and logs; controller/.dockerignore is dead"
  - id: WR-06
    severity: warning
    disposition: open
    title: "Event protocols say \"Every input is validated\" but never cross-check the cycle-leg locations"
  - id: IN-01
    severity: info
    disposition: open
    title: "logs-since never prints its \"no numeric wc\" message; a missing key exits 1 silently"
  - id: IN-02
    severity: info
    disposition: open
    title: "LEDGER ignores XDG_STATE_HOME although the header lists it as an override"
  - id: IN-03
    severity: info
    disposition: open
    title: "stop-sim neither cross-checks the PID file nor narrows the PID-reuse window"
  - id: IN-04
    severity: info
    disposition: open
    title: "check-guards' \"stop-sim real\" case repeats the \"bogus\" case"
  - id: IN-05
    severity: info
    disposition: open
    title: "snapshot leaks its temp directory when a GET fails"
  - id: IN-06
    severity: info
    disposition: open
    title: "out1_dest_transfer_profile defaults differ between events; nest-1 gets two different profiles in event 2"
  - id: IN-07
    severity: info
    disposition: open
    title: "laneOneSend \"overlap run\" never asserts an overlap, and it still contains the dropped x2 leg"
  - id: IN-08
    severity: info
    disposition: open
    title: "The post-claim await is pinned on the side lane only"
  - id: IN-09
    severity: info
    disposition: open
    title: "Unused mock in liveLanesProtocol.test.ts"
  - id: IN-10
    severity: info
    disposition: open
    title: "overlap_timeout_s=0 is accepted and sent, but STACK reads 0 as \"no override\""
open: 17
total: 17
recorded: 2026-11-17T11:31:39.712Z
---

# Phase 09: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| IN-10 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
