---
phase: 04-operator-only-commands-stack-acknowledge
plan: 05
subsystem: static-scan-invariants
tags: [static-scans, invariants, opr-05, suite-gate]
requires:
  - "04-01 operator-only refuse table (server/operatorOnlyCommands.ts)"
  - "04-02 enqueue-time guard (server/runs.ts createFromProtocol)"
  - "04-03 ack decision composer (components/runs/controlDecision.ts)"
  - "04-04 latch card (components/tools/RunRecoverySection.tsx, server/recoveryActions.ts, tool.latchStatus)"
provides:
  - "OPR-05 enforcement: failing-suite static scans fencing the acknowledge_failure literal, the guard placement and the single latch reader"
affects: []
tech-stack:
  added: []
  patterns:
    - "extractBracedRegion guard-placement pins"
    - "exact sorted toStrictEqual file-list pins over walk roots"
    - "findMatchingRels walk-order enumeration helper (in-memory fixture support)"
key-files:
  created: []
  modified:
    - controller/test/staticScan.test.ts
decisions:
  - "Pinned the acknowledge_failure closed set to the four ACTUAL carrier files (card included), not the plan's three — the invariant is the fenced set, not the specific count"
  - "Distinguished the instance executeCommand from the static wrapper by the guard-first body (the plan's const-params-first fixture does not exist at HEAD; the guard is now the first statement by design D-02a)"
  - "Added findMatchingRels helper asserting walk-order enumeration generically (determinism backstop runs on an in-memory fixture, no files created)"
commits: 2
plan_head_before: 41ec56d699fdec0f67761d18f5ef91949725b70b
plan_head_after: 5772c85ebbaca025cca8d3b8e7c7edc104730b1d
estimate_tokens: 34000
actuals:
  tokens: 9500
  tasks: 2
  commits: 2
status: complete
completed: 2026-10-29
duration-seconds: 286
---

# Phase 04 Plan 05: OPR-05 static scan closure Summary

**One-liner:** Fenced the ack literal, guard placement and single latch reader into failing-suite static scans — OPR-05 is no longer prose; any future drift (self-acknowledging path, wider literal set, guard in controlCommand, second latch reader, Enter-bound card) turns the suite red.

Deviation-truncated frontmatter delta: frontmatter also satisfied.

## What Was Built

`controller/test/staticScan.test.ts` extended from 582 → 751 lines (169 insertions, one file touched — as planned):

**Task 1 — existing-pin extensions (commit `7e22e49`):**
- `/latch/i` absence scan (D-12): `server/recoveryControl.ts`, `components/runs/controlDecision.ts`, `components/runs/RunControlConfirmModal.tsx`, `hooks/useRunControl.ts` each asserted latch-free — the send path cannot ride the latch read.
- No-Enter scan extended: `components/tools/RunRecoverySection.tsx` joins the modal + ToolPausedModal coverage, pattern extended to `onKeyDown|onKeyPress|onKeyUp|onSubmit|type="submit"` (original tokens kept; initialFocusRef carve-outs untouched).
- Single-reader pin: `tool.latchStatus` matches exactly `["components/tools/RunRecoverySection.tsx"]` over components/hooks/pages/server (matches reality — the recoveryActions/router occurrences are comments, stripped by `stripComments`).
- `findMatchingRels` helper: enumerates matches in input (walk) order, with an optional in-memory `sources` map.

**Task 2 — OPR-05 block (commit `5772c85`):**
- Closed-literal pin: `acknowledge_failure` matches exactly the sorted 4-file list (controlDecision, RunRecoverySection, operatorOnlyCommands, recoveryActions) over the same non-test walk roots. A fifth file — a self-acknowledging path, runControl, commandFields — fails the suite.
- Absence pins: `components/tools/constants.ts` top-level `commandFields` keys (parsed from source, regex `^  [A-Za-z0-9_]+: {`) contain no `stack` (nested `stack_id` params remain legitimate); the file is ack-free; `server/runControl.ts` contains no `acknowledge_failure`.
- Guard-placement pins via `extractBracedRegion`: the instance `executeCommand` body contains `isOperatorOnlyCommand(` + `OperatorOnlyCommandError` with the guard BEFORE `const params = command.params`; the `controlCommand` body contains neither; `createFromProtocol` keeps `isOperatorOnlyCommand(` + `stage=enqueue`.
- No-self-acknowledge compound: `.controlCommand(` callers (`command_queue.ts`:1, `recoveryControl.ts`:1), definition in `server/tools.ts` only, `recoveryControl({` router entry in `server/routers/tool.ts` only — asserted together so a second ack path fails all at once.
- Determinism backstop: in-memory two-file fixture proves `findMatchingRels` reports violations in walk order, not alphabetical.

## Phase Gate (Task 2 verify)

- `npx vitest run test/staticScan.test.ts` — 39 passed
- `npx tsc --noEmit` — clean
- `npx prettier . --check` — clean
- `npm run test:unit` (canonical phase gate) — **544 tests / 23 files, 0 failures** (baseline 436 + phase additions)

## Deviations from Plan

### Pin adjustments (per sequential-executor rule: the invariant is the property, not the token)

**1. [Deviation] acknowledge_failure closed set is four files, not three**
- **Found during:** Task 2 prescan
- **Issue:** Plan pinned `["components/runs/controlDecision.ts", "server/operatorOnlyCommands.ts", "server/recoveryActions.ts"]`, but the final tree genuinely carries the literal in a fourth non-test file: `components/tools/RunRecoverySection.tsx` (the card's typed action union, confirm requests and pending-button labels — 5 real code occurrences). This is plan 04-04's landed surface, not drift.
- **Fix:** Pinned the actual sorted 4-file list. The invariant property holds: the literal is fenced to known operator-driven carriers; any file outside the set fails the suite (incl. runControl/commandFields via absence pins).
- **Files modified:** controller/test/staticScan.test.ts
- **Commit:** 5772c85

**2. [Deviation] Instance-executeCommand disambiguation regex changed**
- **Found during:** Task 2 prescan
- **Issue:** Research pin 3 assumed the instance body's first statement is `const params`; at HEAD (04-01's landed guard) the first statement IS the operator-only guard itself — `const params = command.params;` now comes after.
- **Fix:** Decl regex `/async executeCommand\(command: ToolCommandInfo\) \{\s*if \(isOperatorOnlyCommand\(/` (guard-first signature cleanly rejects the static wrapper, which starts with `logAction`), plus an explicit ordering assertion guard-index < `const params` index. Stronger than the plan's original: it structurally asserts the guard is FIRST.

## Known Stubs

None — this plan is scan-only; no runtime code, no data sources, no placeholders.

No stub/skip/deviation entries for `gsd_run windows append`: no stubs, no skipped tests, and the two pin adjustments are recorded in Deviations (test-only scope, no runtime ship gate).

## Threat Mitigation Follow-Through (T-04-14/15)

- Exact-list pins, absence pins, placement pins and the caller-set compound → every listed drift mode now fails `npm run test:unit`. (T-04-14 mitigated)
- Walk-order determinism verified by unit case; all lint-style pins fail with the offending rel path via `expect(stripComments(read(file)), file)` labels. (T-04-15 mitigated)

## Verification Checklist (ROADMAP Phase 4 criterion 5)

| Required scan clause | Enforcer |
| --- | --- |
| no code path acknowledges on its own | caller-set compound + `recoveryControl({` router pin |
| literal outside an exact file list | 4-file closed-set pin |
| added to commandFields or runControl | keys-scan + whole-file absence pins |
| guard leaves executeCommand | body must retain both guard tokens + guard-first order |
| guard lands in controlCommand | body asserted free of both tokens |
| latch read feeds the send path | `/latch/i` ban + single-reader pin |
| Enter-bound card default | no-Enter scan covers the card file |

## Self-Check: PASSED

- controller/test/staticScan.test.ts exists (751 lines).
- Commit 7e22e49 verified: `git merge-base --is-ancestor 7e22e49 HEAD` ok.
- Commit 5772c85 verified: HEAD == 5772c85 (plan_head_after).
