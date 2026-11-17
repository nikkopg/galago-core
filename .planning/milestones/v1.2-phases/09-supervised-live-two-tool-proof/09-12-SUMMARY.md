---
phase: 09-supervised-live-two-tool-proof
plan: 12
subsystem: live-hardware-evidence
tags: [liv-01, liv-03, event-2, d-05, verdict, project-md, runbook]
status: complete

requires:
  - phase: 09-supervised-live-two-tool-proof
    provides: 09-10 event-1 PASS, 09-11 event-2 raw capture (rows 70-76, logs, 5-record ledger), 09-07 LIV-02 PASS
provides:
  - Event-2 analysis against D-05 (amended design) with raw ms, log windows and ledger, Event 2 verdict PASS
  - LIV-01 verdict PASS (both events), naming the keys of both runs, both galago-core HEADs, the galago-web-dev deployment, galago-tools SHA and "auto-mint: on (not exercised)"
  - PROJECT.md Validated entry, per-lane single-flight wording and four Phase 9 key decisions
  - The lanes todo resolved and moved to .planning/todos/completed/
  - galago-tools runbook rows 3a-13, 3a-14, 3a-15 and the "### Parallel two-plate cycle (lanes, LIV-01)" subsection, committed docs-only (galago-tools 69ea3b6)
affects: [phase-9-verification, milestone-v1.2]

actuals:
  tokens: 26000
  tasks: 3
  commits: 3
plan_head_before: fd29653baf1785f816fe5b7e35ea31b49387e705
plan_head_after: 37ade9b6c68bc99aa30e97c69c696b17572e8ae8

tech-stack:
  added: []
  patterns:
    - "Verdicts computed from the snapshot JSON by a script (raw epoch ms), then written clause by clause with the numbers"
    - "Explicit-path commit in the sibling galago-tools repo, with the user's unrelated deletions left unstaged"

key-files:
  created:
    - .planning/phases/09-supervised-live-two-tool-proof/09-12-SUMMARY.md
  modified:
    - .planning/phases/09-supervised-live-two-tool-proof/09-LIVE-EVIDENCE.md
    - .planning/PROJECT.md
    - .planning/todos/completed/scheduler-per-tool-concurrency-lanes.md
    - /home/formulatrix/data/nikko/galago-tools/docs/runbooks/gal-07-live-handoff.md

key-decisions:
  - "Event 2 PASS: -x1 (11:09:58.493-11:10:29.196) lies inside the F.A.S.T. row (11:09:57.309-11:11:08.787), 30703 ms strictly positive intersection; So - Sf = +1184 ms, Ef - Eo = 39591 ms"
  - "LIV-01 PASS because Event 1 (09-10) and Event 2 both PASS"
  - "Plate 2 on nest-2 recorded as operator-confirmed (reply after the run reply, before capture done), not as a tool read"
  - "Stored run status CREATED recorded as the known lanes-mode finding (follow-up), not a failed clause"
  - "PROJECT.md footer date left at 'after Phase 8' because the plan said to touch nothing else"

requirements-completed: [LIV-01, LIV-03]

coverage:
  - id: D1
    description: "Event-2 D-05 analysis and verdict PASS from raw rows, logs and ledger (Task 1)"
    requirement: "LIV-01"
    verification:
      - kind: other
        ref: "grep -cE '^Event 2 verdict: (PASS|FAIL)' 09-LIVE-EVIDENCE.md prints 1; ledger script prints '5 no-x2'"
        status: pass
    human_judgment: false
  - id: D2
    description: "LIV-01 verdict PASS naming both runs' keys, HEADs, deployment, galago-tools SHA, auto-mint (Task 1)"
    requirement: "LIV-01"
    verification:
      - kind: other
        ref: "'LIV-01 verdict: PASS' section in 09-LIVE-EVIDENCE.md"
        status: pass
    human_judgment: true
    rationale: "Plate positions and end state rest on the operator's word; the verdict is a judgement over the recorded evidence"
  - id: D3
    description: "PROJECT.md Validated entry, wording and Phase 9 key decisions; lanes todo resolved and moved (Task 2)"
    requirement: "LIV-03"
    verification:
      - kind: other
        ref: "grep count of 09-LIVE-EVIDENCE.md in PROJECT.md is 1; no open Active lanes line; LIV03_CORE_OK printed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Runbook rows 3a-13..3a-15 and parallel two-plate cycle, docs-only galago-tools commit (Task 3)"
    requirement: "LIV-03"
    verification:
      - kind: unit
        ref: "galago-tools: .venv/bin/python -m unittest tools.tests.gal07_live_runbook_test.TestRunbookContent (5 tests OK before and after)"
        status: pass
      - kind: other
        ref: "'Reply: literal go' count 3; Bearer grep 0; git show --name-only HEAD lists only the runbook; PIN_UNCHANGED"
        status: pass
    human_judgment: false

duration: ~25 min
completed: 2026-11-17
---

# Phase 9 Plan 12: Event-2 verdict, LIV-01 verdict and LIV-03 records Summary

**Event 2 and LIV-01 both PASS under D-05 (amended): a 30.7 s third-plate STACK transfer nest-3 to nest-1 ran wholly inside the 71.5 s F.A.S.T. leg with five explicit ledger records, and the project records (PROJECT.md, the lanes todo, the galago-tools runbook parallel cycle) now say so.**

## Performance

- Duration: about 25 minutes (start time not captured by a timer; estimated from commit times)
- Tasks: 3 of 3
- galago-core commits: 3 (`2b3fe20`, `3f1ad72`, `37ade9b`), plus galago-tools `69ea3b6` (runbook only)
- Files: 4 modified (+1 todo rename, + this summary)

## Accomplishments

- **Event 2 verdict PASS** (run `1596f9bcf081e7000`, key base `LIV01-E2-2026-11-17T11:08:44.895Z-abf060a9`). Raw ms from the snapshot: -x1 `[1794913798493, 1794913829196]`, F.A.S.T. `[1794913797309, 1794913868787]`. Clauses: `So >= Sf - 1500` holds (+1184 ms), `Eo <= Ef` holds (39591 ms before), intersection 30703 ms (> 0, not a touch). Logs: FA100056 "Running command Transfer" 11:09:57, STACK2-6 -x1 Transfer 11:09:58 (a different second, so the log orders them), before the F.A.S.T. completion 11:11:08.787; the F.A.S.T. server's own run-progress lines continue through the whole -x1. Counts +5 / +1; ledger 17 to 22, exactly five records `-in1 -in2 -x1 -out1 -out2`, each done / ran, no `-x2`. Order: -x1 after in2 (+1501 ms), out1 925 ms after the F.A.S.T. row completed (40516 ms after -x1), out2 after out1; no `-x2` row; 7 of 7 rows COMPLETED, laneStatus halted false.
- **End state** recorded as reported: third plate on nest-1, plate 1 on nest-3 (11:13:42Z reply), plate 2 on nest-2 as operator-confirmed afterwards; the hand restore came after "capture done" and is not D-05 evidence.
- **LIV-01 verdict PASS** with both runs' keys (four and five), galago-core HEADs per event (`9201bd3`/`18e183a`, `356d7c6`/`03a23e9`), no controller commit after `9201bd3`, `galago-web-dev` (image `a331fa4d812a` unchanged, container `855c334135eb`, `GALAGO_PARALLEL_LANES=1`), galago-tools `034867c` with tool code unchanged since `d53da53`, "auto-mint: on (not exercised)" and the D-08 wording.
- **PROJECT.md:** open Active item removed, Validated bullet "LIV-01..03" added with the evidence pointer, line-10 single-flight wording now per lane with the flag, four "Phase 9" Key Decisions rows (D5, D8, IN-01, decision B).
- **Lanes todo:** resolution note (four acceptance items mapped to evidence, the amended move, three follow-ups), boxes ticked, `git mv` to `.planning/todos/completed/`.
- **Runbook (galago-tools `69ea3b6`, branch `feat/stack-tool`, only `docs/runbooks/gal-07-live-handoff.md`):** rows 3a-13, 3a-14, 3a-15 and the `### Parallel two-plate cycle (lanes, LIV-01)` subsection inside Part 3 before the Recovery drill; no vendor re-pin.

## Deviations from Plan

None - plan executed exactly as written. (The 3a-15 row timestamp is the real time of writing, 2026-11-17T11:20:19Z.)

## Findings carried (not clauses)

- Stored run record stays `CREATED` in lanes mode after every row COMPLETEs (09-07 finding); fix belongs to a later phase.
- `FA100056.log` grows continuously from the web UI's `GET /status` polling; evidence uses "Running command" counts.
- nest-3 to nest-1 reliability: 3 of 5 operator test moves failed earlier on 2026-11-17 before the round trips succeeded; the round-trip gate stays in the runbook.
- The PROJECT.md "Last updated" footer still reads "after Phase 8"; the plan limited edits to the named lines, so a transition step should refresh it.

## Known Stubs

None.

## Threat Flags

None. Docs-only changes; no network endpoint, auth path or schema touched.

## Self-Check: PASSED

- Files found: the evidence file, PROJECT.md, the moved todo in `.planning/todos/completed/`, the galago-tools runbook.
- Commits found: `2b3fe20`, `3f1ad72`, `37ade9b` in galago-core; `69ea3b6` in galago-tools.
- `TestRunbookContent` OK; phrase count 3; `PIN_UNCHANGED`; `LIV03_CORE_OK`; ledger check `5 no-x2`.
