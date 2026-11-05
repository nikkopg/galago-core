---
gsd_state_version: "1.0"
milestone: v1.2
milestone_name: Tool-inferred dropdowns + per-tool concurrency lanes
current_phase: 6
current_phase_name: v1.2 covers Phases 6-9
status: planning
stopped_at: Phase 6 context gathered
last_updated: "2026-11-05T12:46:45.911Z"
last_activity: 2026-11-05
last_activity_desc: v1.2 roadmap created (Phases 6-9, 40/40 requirements mapped)
state_head: c2a736a62e80342ddd33ecbca4b5ce2fadfa39e5
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-05)

**Core value:** While an instrument step runs, the operator sees what the instrument is doing and
decides every recovery action; the web app never acts on its own or pre-selects a physical decision.
**Current focus:** Phase 6 — STACK Dropdowns (milestone v1.2: Tool-inferred dropdowns + per-tool
concurrency lanes)

## Current Position

Phase: 6 of 9 (STACK Dropdowns) — v1.2 covers Phases 6-9
Plan: — (not yet planned)
Status: Ready to discuss / plan Phase 6
Last activity: 2026-11-05 — v1.2 roadmap created (Phases 6-9, 40/40 requirements mapped)

Progress: [░░░░░░░░░░] 0% (0 of 4 v1.2 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 29
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 02 | 6 | - | - |
| 03 | 7 | - | - |
| 04 | 7 | - | - |
| 05 | 4 | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 20 min | 3 tasks | 6 files |
| Phase 01 P02 | ~35min | 2 tasks | 6 files |
| Phase 01 P03 | 18min | 2 tasks | 4 files |
| Phase 01 P04 | ~15min | 2 tasks | 2 files |
| Phase 01 P05 | ~45min | 3 tasks | 5 files |
| Phase 02 P01 | 55min | 2 tasks | 9 files |
| Phase 02 P04 | 45 min | 2 tasks | 5 files |
| Phase 02 P02 | 50min | 2 tasks | 4 files |
| Phase 02 P03 | 35 min | 2 tasks | 5 files |
| Phase 02 P05 | 40 min | 2 tasks | 7 files |
| Phase 02-run-page-live-controls P06 | 25min | 2 tasks | 1 files |
| Phase 3 P01 | 30 min | 2 tasks | 4 files |
| Phase 3 P02 | 15 min | 2 tasks | 1 files |
| Phase 03 P03 | 3 min | 2 tasks | 4 files |
| Phase 3 P04 | 15min | 2 tasks | 8 files |
| Phase 3 P05 | 6 min | 2 tasks | 5 files |
| Phase 3 P06 | 10 min | 3 tasks | 5 files |
| Phase 03 P07 | 20 min | 2 tasks | 3 files |
| Phase 04 P01 | 13m | 2 tasks | 5 files |
| Phase 04 P02 | ~16m | 2 tasks | 9 files |
| Phase 04 P03 | 11min | 2 tasks | 5 files |
| Phase 04 P04 | 14min | 2 tasks | 4 files |
| Phase 04 P05 | 286 | 2 tasks | 1 files |
| Phase 04 P06 | 6 min | 3 tasks | 3 files |
| Phase 04 P07 | 6 min | 2 tasks | 4 files |
| Phase 05 P01 | 7 min | 3 tasks | 12 files |
| Phase 05 P02 | 5 min | 3 tasks | 8 files |
| Phase 05 P03 | 7 min | 3 tasks | 7 files |
| Phase 05 P04 | 9 min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
v1 decisions are archived in `milestones/v1-ROADMAP.md` (Milestone Summary) and PROJECT.md.
Recent decisions affecting current work:

- [Roadmap v1.2]: Phase order is STACK dropdowns (6) → F.A.S.T. plates (7) → concurrency lanes, engine then
  protocol surface + run page as waves (8) → supervised live proof (9), simplified to 4 phases on 2026-11-05
  (user decision). Phase 8 depends on nothing from 6-7, so Phase 7 can slip behind the galago-tools
  `get_plates` gate without blocking 8-9.
- [Roadmap v1.2]: The shared DRP-* dropdown layer is built and mapped in Phase 6 (with the STK-* fields);
  Phase 7 reuses it for F.A.S.T. plates and owns only PLT-*.
- [Roadmap v1.2]: Research decisions D1-D12 (SUMMARY.md) are settled in the owning phase's discuss step:
  D6/D7/D10/D11 in Phase 6, D1/D2/D3/D4/D9/D12 in Phase 8, D5/D8 in Phase 9 (Phase 7 inherits D6/D10/D11
  from Phase 6). LAN-09's freeze control and its run-page button both land in Phase 8.
- [Roadmap v1.1]: Phase order is F5 + F3 (3) → operator acknowledge (4) → STACK codegen (5), the user's
  build order; F5 and F3 merged into one phase (2026-10-28, user decision) since they share files.
- [Roadmap v1.1]: Phase 4 is built on string tool types and `"stack" as ToolType` fakes, so it does not wait
  for `stack.proto`; only Phase 5 is hard-gated on galago-tools Phase 4.
- [Roadmap v1.1]: `stack` is NOT added to `runControl`; the acknowledge uses a recovery-only spec plus one
  operator-only command table (ACK-AND-F3.md §1.2, §2.2).
- [Phase 3]: 03-01: single-flight guard is the first statement of CommandQueue._start; an ignored Start logs 'Queue Start Ignored' and changes nothing
- [Phase 3]: 03-01: Start listing read via synchronous SqliteQueue.queuedRowsSync (no await before the _runningPromise claim), capped at 50 rows
- [Phase 3]: 03-02: errorPath.test.ts committed RED by design (D-10); 30 of 45 cases fail on assertions until 03-04, run wave gates with --exclude test/errorPath.test.ts
- [Phase 03]: 03-03: Start summary counts come from queue-joined commandQueue.commands, not getAll; STARTED rows shown on a separate line and excluded from will-run
- [Phase 3]: 03-04: whitespace-only error_message counts as empty; SUCCESS+message is thrown as ERROR_FROM_TOOL; _failureSeq seeded from Date.now()
- [Phase 3]: 03-05: RunStatus not widened; COMPLETED_WITH_SKIPPED_FAILURE is a client-only outcome derived from polled rows, FAILED takes precedence over a COMPLETED last row
- [Phase 3]: 03-05: storedErrorText is the shared reader of a persisted row error so the run outcome and 03-06 step card cannot drift
- [Phase 3]: 03-06: banner dismiss stores only dismissedSeq (errorSeq of shown payload); never clears, restarts or acts on the queue
- [Phase 3]: 03-06: step card error text placed between CommandImage and sticky label; skipped-with-error card at full opacity
- [Phase 03]: 03-07: step-card error text placed beside CommandImage in one HStack row (amends D-17/UA2) so the fixed 165px card never overflows (G-03-3)
- [Phase 04]: Guid regex extended with \u0085 (NEL): JS \s omits U+0085, so the planned guid class would accept a NEL control char; extended exclusion to make the NEL refusal hold (04-01).
- [Phase 04]: D-06 reroute makes action-availability the first server refusal (type-aware BAD_REQUEST); pf400 tool-type refusal test updated to the new fixed order (04-01).
- [Phase 04]: Operator-only command matching is trim+lowercase exact equality (D-04): deny-by-list never invents a match; the plan's double-space-ack example was inconsistent with its own matcher and resolved as not-refused.
- [Phase 04]: RED evidence for tdd plans in this repo: vitest default/tap reporters are unparseable by the vendor TAP adapter; use vitest --reporter=junit (supported adapter, unmodified report) for check tdd-red-evidence records.
- [Phase 04]: 04-03: createConfirmedSender recovery branch is recovery-spec-driven (isRecoveryAction/getRecoverySpec + pure completeRecoveryEntries); RECOVERY_UI_ACTIONS removed
- [Phase 04]: 04-03: guid travels as request params DATA — modal restates verbatim, never an input; Confirm gated on completeRecoveryEntries (confirmYes exactly "yes")
- [Phase 04]: 04-03: card guid visibility from needsGuidEntry (spec-derived), buttons never gated on instrument state; enable check = shared isValidRecoveryGuid import
- [Phase 04]: latchStatus query is toolId-only with toolType derived from the DB row — zToolType rejects 'stack' until Phase 5 (D-11), so the query reuses the recovery mutation's derivation, never the enum
- [Phase 04]: extractLatch carries one display kind/explanation pair, reading kind/explanation preferentially over resultKind/reason from galago-tools' unfrozen shape space (D-13); unknown shapes flag unknown:true with the raw object retained for the collapsible
- [Phase 04]: Card latch read is a born-disabled tRPC query refetched on explicit click — no polling opts at all; 'Use this guid' pins UI-SPEC copy as source constants so the display contract stays greppable
- [Phase 04]: 04-05: ack-literal closed set pinned to the four ACTUAL carrier files (RunRecoverySection card included), not the plan's three — invariant is the fenced set, not the count
- [Phase 04]: 04-05: instance executeCommand disambiguated by guard-first body regex (guard is the first statement at HEAD), plus guard-before-substitution ordering assertion
- [Phase 04]: 04-05: findMatchingRels helper enforces walk-order enumeration with in-memory fixture support; determinism backstop runs without real files
- [Phase 04]: 04-06: G-04-5 fixed via GUID_BLANK_HINT JS string constant (not &apos;) so rendered copy and controlDecision pin are unchanged; next lint --no-cache --quiet is the inherited lint gate
- [Phase 04]: 04-06: STACK recovery buttons hidden via isRecoveryAction (spec-derived); raw latch replies bounded in LatchRawJson (160px, w=0px + minW=100%)
- [Phase 04]: 04-07: classify run.create errors by Error.name via exported guards (not class identity), so the mapping survives next dev module-copy drift; RunStore/CommandQueue stay on global
- [Phase 05]: Pin vendor/galago-tools gitlink to bcbbf8e (last interfaces/ commit, the 128bbd7 precedent); four proto stop-condition facts verified at that exact hash — D-01 gate; origin/feat/stack-tool tip moved during execution but interfaces/ held
- [Phase 05]: Codegen pinning mechanism: scratch-dir ts-proto 1.151.1 + explicit --plugin= (venv grpcio-tools 1.85.1), never node_modules 1.153.2 — RESEARCH spike-proven recipe; T-05-01 mitigation
- [Phase 05]: commandFields.stack: 9 commands in proto declaration order, born-empty fields, no select; ack literal nowhere in constants.ts; OPR-05 scan flipped positive in the same commit — D-03 + RESEARCH Pitfall 1
- [Phase 05]: LATCH_READ_COMMAND renamed to the frozen oneof key get_failure_latch; wire tests prove the ack payload and latch read on the real tool_base.Command encoder — D-07a/b, RESEARCH Pitfall 2
- [Phase 05]: 05-02: BoundedRawJson extraction uses an alias import (BoundedRawJson as LatchRawJson) so every RunRecoverySection usage site, prop and copy constant stays byte-identical — D-08 do-not-restructure honored through the extraction — Keeps the D-06 extraction mechanical; the card's pins and behaviour are untouched
- [Phase 05]: 05-02: staticScan G-04-2 renderer pins re-targeted to components/ui/BoundedRawJson.tsx; usage pins stay on the card — The extraction necessarily removed the pinned renderer from RunRecoverySection — the plan's action and its 'unmodified scan' criterion contradicted each other (Rule 3); the invariant's intent (one bounded display) is preserved and now covers the tool page too
- [Phase 05]: 05-02: lastReply is a tri-state (undefined = born hidden / null = completed send without data / reply object), set ONLY from runCommand onSuccess as data ?? null; onError leaves the panel untouched — Satisfies the born-hidden rule AND Pitfall 6's legible empty state with one variable; the error toast stays the only error surface (UI-SPEC rule 5)
- [Phase 05]: 05-02: omitBlankParams (pure, keeps 0/false, one-level nested strip, no mutation) is applied ONLY when String(config?.type) === 'stack'; every other tool type sends formValues verbatim — D-04 planner decision is scoped to STACK — proto3 optional encodes on presence, so omitted blanks are wire-absent; F.A.S.T. wire bytes unchanged; 05-03's blank-optional wire case pins the STACK behaviour
- [Phase 05]: 05-02: Born-empty display fallbacks: boolean and NumberInput branches use ?? '' instead of ||-painting 0/false; untouched fields render empty, real typed 0/false render as before; no Switch, no placeholder, formValues semantics unchanged — UI-SPEC option (a) — fixing the shared renderFields fallbacks also de-paints F.A.S.T. born number/boolean displays (display-only); the no-unchosen-value rule is the project core value
- [Phase 05]: 05-03: D-08 retrofit kept purely mechanical — 8 one-token "stack" as ToolType → ToolType.stack cast swaps, all 72 retrofitted tests pass unchanged
- [Phase 05]: 05-03: D-04 omit-blank pinned BOTH ways on the real encoder — stripped page-shaped params decode untouched fields absent, unstripped decode the blank present-empty; RESEARCH Pitfall 5 closed and the "wire payloads never proven" blocker resolved
- [Phase 05]: 05-03: D-07d enum acceptance proven via the exported zTool schema (type field IS the un-exported zToolType) since zToolCreate.type is a plain string; routers/tool.ts stale comment left untouched (test-only plan)
- [Phase 05]: 05-04: coerce-before-strip on STACK sends (coerceBooleanParams in the pipeline, not a control swap — AC-4 kept): a typed "false" sends real false on the real encoder; exact literals only, born-empty "" untouched for the blank strip
- [Phase 05]: 05-04: isBlank NaN-as-blank is narrow (only Number.isNaN; real 0/false pass) and the cleared NumberInput stores "" at the source — WR-01 closed twice over; full gate 608/608 (599 unregressed + 9 new)
- [Phase 05]: 05-04: valid-RED scaffold procedure (#3770): pass-through stub in the test commit so targets fail on assertion; junit RED records in 05-04-tdd-red/, RED_EVIDENCE_OK x3 before GREEN

### Pending Todos

- [2026-10-15] [ui] Fetch F.A.S.T. plate list for source/dest plate dropdowns — [todo file](.planning/todos/pending/2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md) — Needs TBD. A likely shape:.

### Blockers/Concerns

- [Phase 7]: Hard-gated on galago-tools freezing a read-only F.A.S.T. `get_plates` that answers while a
  Transfer runs (`FastServer.ExecuteCommand` otherwise refuses reads while BUSY), proven by a test through
  `ExecuteCommand`. Contract is still "proposed": `.planning/research/FAST-GET-PLATES-CONTRACT.md`. Phase 7
  may slip; Phases 8-9 do not wait on it.
- [Phase 5]: Hard-gated on galago-tools Phase 4 pushing the frozen `stack.proto` to `feat/stack-tool`
  (not there yet). A needed `stack.proto` change or a stack-automation-layer gap stops the work and is
  noted for the user; it is never patched here.
- [Phase 5]: STACK wire payloads were not proven in Phase 4 UAT — every STACK recovery payload
  reached the fake ToolDriver as an empty command {} (ToolType.stack codegen lands in Phase 5), and
  the tool page shows the pre-Phase-5 "Invalid Tool Type" banner; prove the real wire in Phase 5.
  (not there yet). A needed `stack.proto` change or a stack-automation-layer gap stops the work and is
  noted for the user; it is never patched here.
- [Phase 2]: Re-review on 2026-10-16 (`02-REVIEW.md`, diff since 3cfb240) left 4 warnings and 1 info
  open in `02-REVIEW-DISPOSITION.md`: WR-01 `goto` accepts null/"" targetIndex as 0; WR-02 an
  accepted abort whose step then resolves does not dequeue the rest of the run; WR-03
  `RunStateMonitor.snapshot()` `structuredClone` can throw on a non-cloneable `pause.detail`;
  WR-04 `complete()` has no `_hasItem` guard, so the Clear All race logs "Item N not found";
  IN-01 `tip_reuse` select has no default value. Advisory; none violates a Phase 2 must-have.
- [Phase 2]: WR-05 (`d400c42`) supersedes D-08: the "head will move" note is now per-action
  (`runControlMovesHead`), hidden for the F.A.S.T. soft Pause.
- [Phase 3]: `03-REVIEW-DISPOSITION.md` has 4 open advisories after the 03-07 re-review: WR-01 the
  G-03-3 scan accepts `flexShrink={0}` anywhere in the row; WR-02 an 8px gap before the error text
  when a tool has no image (cosmetic); IN-01 full card error is hover-only; IN-02 label scan is
  whitespace-sensitive. The earlier WR-01/WR-02 `fixed` rows (5191ffe) were dropped by id reuse.
  The G-03-3 live fit retest was waived by the user (marked pass).
- [Phase 2]: The real F.A.S.T. may still hold a paused run from the 2026-10-14 09:33 WrongPlateType
  test; clear it (Run Recovery → Abort, or on the instrument) before the next real run.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261104-or1 | Remove per-command expected_tray_id from F.A.S.T. Transfer | 2026-11-04 | d85f992 | [261104-or1-remove-per-command-expected-tray-id-from](./quick/261104-or1-remove-per-command-expected-tray-id-from/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| debug_sessions | run-create-operator-only-500 | diagnosed | 2026-11-02 | v1.1 |
| debug_sessions | step-card-error-overflow | diagnosed | 2026-11-02 | v1.1 |
| todos | 2026-10-15-evaluate-whether-expected-tray-id-is-still-needed.md | (presence-only) | 2026-10-16 | v1 |
| todos | 2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md | (presence-only) | 2026-10-16 | v1 |

## Session Continuity

Last session: 2026-11-05T12:46:45.893Z
Stopped at: Phase 6 context gathered
Resume file: .planning/phases/06-stack-dropdowns/06-CONTEXT.md

## Operator Next Steps

- Discuss Phase 6 with /gsd-discuss-phase 6 (settle D6, D7, D10, D11), then /gsd-plan-phase 6
