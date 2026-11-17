---
phase: 09-supervised-live-two-tool-proof
plan: 03
subsystem: testing
tags: [lanes, live-evidence, stack, fast, protocols, vitest, d-02-amendment]

requires:
  - phase: 09-supervised-live-two-tool-proof
    provides: 09-01 live and drill protocols plus offline proof; 09-02 one-send gate and dispatch-span pin
provides:
  - tools/phase9-ctl.sh, read-only evidence capture and guarded sim-server control
  - 09-LIVE-EVIDENCE.md, the phase evidence record (provenance, D-05 overlap rule, spare-nest check, operator nest-test note)
  - evidence baselines, queue snapshot and the operator's spare-check replies
  - D-02 decided as "pair confirmed under AMENDED D-02" and D-03 dropped, recorded in CONTEXT and EVIDENCE
  - event 1 and event 2 protocols and their offline proof amended to the user's decision
affects: [09-04, 09-08, 09-09, 09-10, 09-11, 09-12]

actuals:
  tokens: 23000
  tasks: 3
  commits: 4
plan_head_before: 45c0b6be7bfd4118e979ac05e15a3d9bdac31d2b
plan_head_after: 58a1d2f4a2e705a30e47c55cc78f312be4cca00b

tech-stack:
  added: []
  patterns:
    - "Evidence capture is HTTP GET plus local files only; Claude never sends a command to STACK2-6 or FA100056"
    - "Step-key suffix per STACK leg and a script guard that throws before the first galago call"
    - "Lane-harness tests read row status mid-run to prove a step was sent only after its predecessor COMPLETED"

key-files:
  created:
    - .planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh
    - .planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T042000Z-pre-spare-check.baseline.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T042000Z-pre-spare-check.queue.json
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T045034Z-spare-check.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T045034Z-post-spare-check.baseline.txt
    - .planning/phases/09-supervised-live-two-tool-proof/evidence/20261117T050637Z-post-operator-nest-test.baseline.txt
  modified:
    - .planning/phases/09-supervised-live-two-tool-proof/09-CONTEXT.md
    - .planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event1.protocol.json
    - .planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event2.protocol.json
    - controller/test/liveLanesProtocol.test.ts

key-decisions:
  - "D-02 amended by the user (2026-11-17): third plate starts on nest-3, x1 nest-3 to nest-1 during the F.A.S.T. leg, out1 tray1/5 to nest-3, out2 unchanged"
  - "D-03 dropped by the user: no -x2 return leg; operator restores the rig by hand after the run"
  - "Protocol parameter names spare_a_* (overlap source) and spare_b_* (overlap destination) kept so plans 09-09 to 09-12 still type the right fields; labels and descriptions say overlap source/destination"
  - "Event 1 out1 destination is guarded to plate 1's home (no x1 runs, nest-3 still holds the third plate); event 2 out1 destination is guarded to equal the overlap source"

requirements-completed: [LIV-01]

coverage:
  - id: D1
    description: "phase9-ctl.sh is read-only toward real tools; stop-sim can signal only the sim-port PID that names its port and owns no real port"
    requirement: LIV-01
    verification:
      - kind: other
        ref: "bash tools/phase9-ctl.sh check-guards (prints GUARDS OK)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Evidence record with provenance, D-05 overlap rule and one section per GO-gated event; baselines and operator replies indexed"
    requirement: LIV-01
    verification:
      - kind: other
        ref: "09-LIVE-EVIDENCE.md sections and Raw evidence index"
        status: pass
    human_judgment: true
    rationale: "The record is prose; a verifier should read it against the plan's must_haves"
  - id: D3
    description: "Spare-check delta judged explained by operator activity, not 'unchanged'; fresh reference baseline taken"
    requirement: LIV-01
    verification:
      - kind: other
        ref: "evidence/20261117T050637Z-post-operator-nest-test.baseline.txt"
        status: pass
    human_judgment: true
    rationale: "The operator's statement ('it was me testing the new nest') is the only explanation; placement was not read back with get_labware_presence"
  - id: D4
    description: "D-02 verdict recorded as pair confirmed under the amended rule with exact triples and UTC time; D-03 dropped; 09-04 preconditions listed"
    requirement: LIV-01
    verification:
      - kind: other
        ref: "09-LIVE-EVIDENCE.md 'Spare-nest check (D-02)'; 09-CONTEXT.md D-02 and D-03 Amendments"
        status: pass
    human_judgment: true
    rationale: "A user decision; the record states it, it does not prove it is physically safe"
  - id: D5
    description: "Amended event 1 and event 2 protocols: overlap guard, required out1_dest_*, out1 must equal the overlap source, no x2, five unique step keys; offline proof of ordering and halts"
    requirement: LIV-01
    verification:
      - kind: unit
        ref: "controller/test/liveLanesProtocol.test.ts#event-2 protocol (g1, g2, g2b, g3, g4, f, e, d)"
        status: pass
      - kind: unit
        ref: "controller/test/liveLanesProtocol.test.ts#event-1 protocol (e, e3, g, h)"
        status: pass
    human_judgment: false

duration: about 58 min wall clock, including waits for operator-run tool-page reads and the user's D-02 decision
completed: 2026-11-17
status: complete
---

# Phase 9 Plan 03: Evidence Tooling, Spare-Nest Check and Amended D-02/D-03 Summary

**Read-only evidence tooling and record, an operator spare-nest check that found one extra nest (not a pair), the user's amended D-02 (x1 nest-3 to nest-1, out1 to nest-3) with D-03 dropped, and the two 09-01 protocols plus their offline proof rebuilt to match.**

## Performance

- **Duration:** about 58 min wall clock (04:17Z to 05:15Z), mostly waiting on the operator and the user
- **Started:** 2026-11-17T04:17Z (approx)
- **Completed:** 2026-11-17T05:15Z
- **Tasks:** 3 (plus the user-approved amendment of the 09-01 artifacts)
- **Files:** 4 modified, 7 created

## Accomplishments

- `tools/phase9-ctl.sh`: `baseline`, `snapshot`, `logs-since`, `ledger`, `start-sim`, `stop-sim`, `check-guards`. HTTP GET against galago-web, local files, `ss` and `git` only. `stop-sim` is the single signal path and refuses any PID that does not name its sim port or that owns a real port (3010, 8081, 11010, 40001, 40012). `check-guards` proves the refusals without sending a signal.
- `09-LIVE-EVIDENCE.md`: provenance (galago-core and galago-tools SHAs, auto-mint on and not exercised, last production commit `d09a047`), the D-05 overlap rule (1500 ms tolerance, strict intersection), the code gate from 09-01 and 09-02, the spare-nest check, the operator nest-test note, per-event sections and the raw evidence index.
- Spare-nest check: operator replies captured (`list_devices`, two `get_transfer_estimate` reads of 58 s and 59 s with no advisories, reach by eye). Original-rule verdict: no spare pair (only nest-3 is new).
- D-02 decided under the AMENDED rule and D-03 dropped, recorded in `09-LIVE-EVIDENCE.md` and as dated Amendments in `09-CONTEXT.md` so plans 09-09, 09-11 and 09-12 honor it.
- Protocols and offline proof amended (below). 31 tests in `liveLanesProtocol.test.ts` pass; full controller suite 50 files, 1415 tests; `tsc --noEmit` clean.

## Task Commits

1. **Task 1: Evidence tooling, evidence record, pre-spare-check baseline** - `c9432d8` (feat)
2. **Task 2 (finish): operator nest-3 testing delta and fresh reference baseline** - `7a6998e` (docs)
3. **Task 3: D-02 verdict recorded as pair confirmed under amended D-02, D-03 dropped** - `91c48e1` (docs)
4. **Deviation (Rule 4, user-approved): 09-01 protocols and offline proof amended** - `58a1d2f` (feat)

## The amended moves

| Step | Source | Destination |
|------|--------|-------------|
| in1 | nest-1/deck1/A1 | fa100056/tray1/5 |
| in2 | nest-2/deck`/A1 | fa100056/tray1/6 |
| x1 (event 2, overlaps the F.A.S.T. leg) | nest-3/deck1/A1 | nest-1/deck1/A1 |
| out1 | fa100056/tray1/5 | nest-3/deck1/A1 (event 1: nest-1/deck1/A1, no x1 ran) |
| out2 | fa100056/tray1/6 | nest-2/deck`/A1 |

No `-x2`. Event-2 end state: third plate on nest-1, plate 1 on nest-3, plate 2 on nest-2; the operator restores it by hand.

## Protocol amendments (commit 58a1d2f)

- **Event 2:** guard replaced. Overlap source and destination must differ; the source is not a plate home and not on the F.A.S.T.-side device; the destination may equal plate 1's home only (plate 2's home and the F.A.S.T. device throw). New required `out1_dest_device/deck/nest` (no default) feed out1, and the script throws unless the out1 destination equals the overlap source. The x2 leg and its step key are gone; five step keys (`-in1`, `-in2`, `-x1`, `-out1`, `-out2`), unique per run. The `galago.lane()` reset stays.
- **Event 1:** the estimate carries the overlap move (nest-3 to nest-1). Same guard. out1 goes to the `out1_dest_*` parameters, guarded to equal plate 1's home because no x1 runs and nest-3 still holds the third plate.
- **Naming:** `spare_a_*` and `spare_b_*` parameter names are kept (labels and descriptions now say overlap source/destination, "spare A" is nest-3, "spare B" is nest-1) so the later plans' parameter instructions stay valid.

## Offline proof (`controller/test/liveLanesProtocol.test.ts`)

Real script executor, `validateLanes`, real `CommandQueue` with fake tools:

- (g1) x1 is sent only after in1 COMPLETED (row status read mid-run) and is in flight together with the F.A.S.T. step.
- (g2) out1 is sent only after x1 COMPLETED even when the F.A.S.T. leg finishes first; no x2; every queueId sent once.
- (g2b) out1 also waits for the F.A.S.T. leg when x1 finishes first (barrier).
- (g3) a failed in1 halts: nothing else is ever sent. (g4) a failed x1 halts: out1 and out2 are never sent.
- (f) guard throws, before any galago call, for: overlap destination equal to plate 2's home, destination or source on fa100056, source equal to destination, source a plate home, out1 destination not equal to the overlap source (plate 1's home and a stray nest), blank required inputs.
- (e) triples for x1, out1 and out2; (d) five unique keys with no `-x2`.

**Mutation checks (not committed, protocol files restored from backup):** removing the `galago.lane()` reset fails 5 event-2 tests (b, c, g1, g2, g4) and 3 event-1 tests (b, c, h); removing the out1 guard fails (f); sending out1 to plate 1's home fails (e); removing the plate-2-home guard fails (f); removing the out1 barrier fails (b) and (g2b).

## Deviations from Plan

### User-approved amendment (Rule 4)

**1. [Rule 4 - Decision] D-02 amended, D-03 dropped, 09-01 artifacts amended**
- **Found during:** Task 3 (the spare-check found one extra nest, not a pair)
- **Issue:** Under the original rule the verdict was "no spare pair" and D-02 said stop and return to the user. The user decided to amend instead (2026-11-17).
- **Fix:** Recorded the verdict and the amended moves; amended both protocols and the offline proof as above.
- **Files modified:** 09-LIVE-EVIDENCE.md, 09-CONTEXT.md, both protocol JSON files, controller/test/liveLanesProtocol.test.ts
- **Commits:** `91c48e1`, `58a1d2f`

### Plan truth not met as written

**2. [Spare-check "unchanged" truth] The post-spare-check baseline was not unchanged**
- **Found during:** Task 2
- **Issue:** The plan required the same `STACK2-6.log` Transfer count (4) and ledger sha256 after the spare-check. The count went 4 to 7 to 12 and the ledger 4 to 9 records. The cause was the operator testing the new nest-3 by hand (five recorded Transfers: three `failed`, two `ran`; two further Transfers rejected before any record). Claude sent nothing.
- **Fix:** Judged "delta explained by operator activity", not "unchanged". Timeline, the operator's statement and the disposition are in `09-LIVE-EVIDENCE.md`. A new reference baseline `20261117T050637Z-post-operator-nest-test` replaces the pre-check one for later GO gates.
- **Commit:** `7a6998e`

**Total deviations:** 2 (one user-approved architectural amendment, one plan truth replaced by an explained delta). **Impact:** LIV-01 proceeds under the amended rule; LIV-02 was never blocked.

## Evidence gaps and risks carried forward

- `get_labware_presence` was not run. Plate placement (plate 1 on nest-1, plate 2 on nest-2, third plate on nest-3) is operator-stated. The last ledger move is nest-1 to nest-3 at 05:03:04Z with nothing recorded after it, so the stated placement was reached by hand or outside the ledger.
- Three of the five recorded live moves between nest-1 and nest-3 on 2026-11-17 ended `failed` (one `smartAlignmentMaxNumRetry`, one with the arm holding labware). The estimates were clean. This is an input to the 09-04 and 09-09 to 09-11 GO gates, not a lanes-code finding.
- The failure latch reads as cleared from the local ledger and log only (acknowledged 04:52:59Z, the 05:03:04Z Transfer was accepted). No `GetFailureLatch` was sent by Claude.
- Store protocol 15 was not in the served store (from 09-01): the operator still confirms the cycle parameter names and values against the real LIV-10 protocol.

## Preconditions for 09-04 (recorded in 09-LIVE-EVIDENCE.md)

1. The STACK failure latch is cleared and the arm idle, confirmed live by the operator (`GetFailureLatch` `latched:false`) before the deploy GO. Claude does not clear it.
2. The real workcell (STACK2-6 + FA100056) is selected again; `/api/settings/workcell` currently returns `test`.
3. Plates are where the amended plan expects at the start of each event (plate 1 nest-1, plate 2 nest-2, third plate nest-3), confirmed by the operator at the GO gate.

Plans 09-09, 09-11 and 09-12 still contain wording from the original D-02/D-03 (spare A to spare B, the `-x2` return, six ledger records, "third plate back on spare A"). The Amendments in `09-CONTEXT.md` supersede it; a planner pass over those three plans is advisable before 09-09.

## Known Stubs

None. No placeholder or hardcoded-empty values flow to any rendering path in the files changed.

## Threat Flags

None. The only new inputs are three required protocol parameters (`out1_dest_*`) that are validated by the script guard before any galago call; no new endpoint, auth path or file access.

## Next Phase Readiness

Ready for 09-04 (deploy), subject to the three preconditions above.

## Self-Check: PASSED

Created files exist (phase9-ctl.sh, 09-LIVE-EVIDENCE.md, five evidence files); commits `c9432d8`, `7a6998e`, `91c48e1`, `58a1d2f` are ancestors of HEAD; `commits: 4` measured with `git rev-list --count 45c0b6b..58a1d2f` before this SUMMARY.
