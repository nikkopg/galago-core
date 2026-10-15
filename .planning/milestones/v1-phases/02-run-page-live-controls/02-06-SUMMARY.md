---
phase: 02-run-page-live-controls
plan: 06
subsystem: testing
tags: [vitest, static-scan, source-scan, regression-test, ui-08]

# Dependency graph
requires:
  - phase: 02-run-page-live-controls
    provides: "Plans 02-01..02-05's confirmed-send hook, confirm modal, control bar, stop interception and crash-recovery UI (the modules this plan proves over)"
provides:
  - "controller/test/staticScan.test.ts: a regex-over-stripped-source regression suite proving UI-08's single confirmed send path and the phase's safety invariants"
  - "The D-25 phase gate verified green (tsc, unit suite, prettier) for the whole controller"
affects: [testing, run-page-live-controls]

actuals:
  tokens: 3128
  tasks: 2
  commits: 2
plan_head_before: c9ba68bcf798780c7bba9ec98584a0eefd5258aa
plan_head_after: a4c0531143dba4b69eea80731a1a4777ce73d28f

tech-stack:
  added: []
  patterns:
    - "Comment-stripped regex source scans (no AST, no new test deps) asserting exact file lists with toStrictEqual so additions and removals both fail loudly"
    - "Brace-depth region extraction (extractBracedRegion) to scope a scan to one function/interface body, correctly skipping parameter-default braces and object-type return annotations"

key-files:
  created:
    - controller/test/staticScan.test.ts
  modified: []

key-decisions:
  - "Scoped the 'countdown stop modal is not reused' dynamic check to files that actually call useConfirmedControlSend, not every file referencing InstrumentStopModal — RunsComponent.tsx legitimately imports both InstrumentStopModal (D-19 per-run-delete interception) and the pre-existing StopRunModal (Tool Box stop_run step) without itself sending a confirmed control action, and a broader scan would have falsely failed against that legitimate pre-existing combination"
  - "extractBracedRegion does true brace-depth matching (paren-aware, and transparently skipping an object-type return annotation such as createConfirmedSender's `): { ... } { body }` signature) rather than searching for a textual 'next declaration' marker, so region extraction stays correct regardless of exact adjacent-declaration wording"

patterns-established:
  - "Static source-scan test file for structural safety properties, read_first against real source paths and confirmed character-by-character before being asserted in the test"

requirements-completed: [UI-02, UI-05, UI-06, UI-08]

coverage:
  - id: D1
    description: "toolControl and recoveryControl are referenced only from the confirmed-send hook (useRunControl.ts); runState has one client reader; useConfirmedControlSend is used only by RunControlConfirmModal.tsx, and only from its Confirm handler"
    requirement: "UI-08"
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#single confirmed send path > toolControl and recoveryControl are referenced only by the confirmed-send hook"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts#single confirmed send path > runState is read only by useRunControlState"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts#single confirmed send path > the confirmed-send hook is used only by the confirm modal"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts#single confirmed send path > send is called only from the Confirm handler"
        status: pass
    human_judgment: false
  - id: D2
    description: "The server has exactly one toolControl and one recoveryControl caller of Tool.controlCommand, each with one router entry"
    requirement: "UI-08"
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#single confirmed send path > server controlCommand callers are toolControl and recoveryControl"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts#single confirmed send path > toolControl and recoveryControl have one router entry each"
        status: pass
    human_judgment: false
  - id: D3
    description: "No timers in the nine control-UI modules; the countdown StopRunModal is not reused by any control-UI module or confirmed-send caller; no Enter-bound form default"
    requirement: "UI-06"
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#safety invariants > no timers in the control UI"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts#safety invariants > the countdown stop modal is not reused"
        status: pass
      - kind: unit
        ref: "controller/test/staticScan.test.ts#safety invariants > no Enter-bound default or preselected decision"
        status: pass
    human_judgment: false
  - id: D4
    description: "ToolPausedModal, pausePrompt.ts and ControlBar reference none of the queue's own UIMessage modal state, message data, open flag or resume mutation"
    requirement: "UI-05"
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#safety invariants > the pause prompt stays out of the queue's modal plumbing"
        status: pass
    human_judgment: false
  - id: D5
    description: "No instrument-state check before sending: toolControl, recoveryControl and createConfirmedSender consult no run state, status poll or Tool.status"
    requirement: "UI-08"
    verification:
      - kind: unit
        ref: "controller/test/staticScan.test.ts#safety invariants > no instrument-state check before sending"
        status: pass
    human_judgment: false
  - id: D6
    description: "The D-25 phase gate: tsc --noEmit 0 errors, npm run test:unit green (210/210), prettier --check clean over the whole controller"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (controller)"
        status: pass
      - kind: unit
        ref: "npm --prefix controller run test:unit (210 tests)"
        status: pass
      - kind: other
        ref: "npx prettier . --check (controller)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Live/manual verification of the control bar, confirmation modals, Stop flow and Run Recovery card against a simulated F.A.S.T. during a transfer"
    verification: []
    human_judgment: true
    rationale: "Requires a running galago-web instance against a simulated F.A.S.T. tool and visual/UX judgment (layout, flicker, focus state); deferred to end-of-phase UAT per workflow.human_verify_mode=end-of-phase — this plan's <verify><human-check> block carries the exact steps for the consolidated phase UAT."

duration: 25min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 6: Static source-scan suite closing the D-25 gate Summary

**A 13-test Vitest source scan proves UI-08's single confirmed send path end to end (client hook → confirm modal → server's two controlCommand callers) and pins five safety invariants — no timers, no countdown-modal reuse, no queue-modal coupling, no instrument-state check, no Enter-bound default — with the full D-25 gate (tsc, 210-test unit suite, prettier) green.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-10-14
- **Tasks:** 2
- **Files modified:** 1 (new)

## Accomplishments

- `controller/test/staticScan.test.ts` created with `walk`, `read`, `stripComments`, `rel` helpers plus an `extractBracedRegion` brace-depth extractor — no new dependencies (D-24), node `fs`/`path` only
- "single confirmed send path" describe (7 tests): proves over the real sources that `toolControl`/`recoveryControl` are referenced only from `hooks/useRunControl.ts`; `commandQueue.runState` has one client reader; `useConfirmedControlSend` is used only by `RunControlConfirmModal.tsx` and only from its `handleConfirm` function; the send gate's `ConfirmedControlRequest` types decisions as a completed `Record<string, ControlDecisionValue>`; the server has exactly one `toolControl` and one `recoveryControl` caller of `Tool.controlCommand`, each with one router entry
- "safety invariants" describe (5 tests): no `setTimeout`/`setInterval` in the nine control-UI modules; the countdown `StopRunModal` is reused by neither the fixed control-UI list nor any module that actually calls `useConfirmedControlSend`; `ToolPausedModal`/`pausePrompt.ts`/`ControlBar.tsx` touch none of the queue's own modal/message/resume plumbing; `toolControl`, `recoveryControl` and `createConfirmedSender` consult no run/instrument state before sending; the confirm modal and paused prompt carry no `<form>`/`autoFocus`/`defaultValue`/`defaultChecked`
- `stripComments` helper exercised directly (1 test): confirms it keeps code and URL-like string content while dropping line/block comment text
- D-25 phase gate verified green: `tsc --noEmit` 0 errors, `npm run test:unit` 210/210 passing (11 files), `npx prettier . --check` clean over the whole `controller/` tree — no pre-existing formatting drift found

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end single-send-path scan (tracer)** - `f399810` (test)
2. **Task 2: Safety invariants and the D-25 phase gate** - `a4c0531` (test)

**Plan metadata:** committed below (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md)

## Files Created/Modified

- `controller/test/staticScan.test.ts` - New static-scan regression suite (13 tests across two describes) proving UI-08's single confirmed send path and the phase's safety invariants

## Decisions Made

- Scoped the "countdown stop modal is not reused" dynamic check (beyond the fixed 7-file list) to files that actually call `useConfirmedControlSend`, not every file that merely references `InstrumentStopModal`. `RunsComponent.tsx` legitimately imports both `InstrumentStopModal` (D-19 per-run-delete interception) and the pre-existing `StopRunModal` (Tool Box `stop_run` step) without itself performing a confirmed send; a broader "any InstrumentStopModal reference" scan would have falsely flagged that correct, pre-existing combination. The narrower scope (confirmed-send callers) still catches the real regression this invariant guards against: a future control-UI module reaching for the countdown modal instead of the shared confirm flow.
- `extractBracedRegion` does true brace-depth matching (paren-aware for parameter-default braces like `= {}`, and transparently stepping past an object-type return annotation such as `createConfirmedSender`'s `): { send(...): ...; isInFlight(): boolean; } { <body> }` signature) rather than matching a textual "next declaration" pattern. This keeps region extraction correct without depending on exactly which method or export happens to follow in the source file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Ambiguous spec clarified] Narrowed the "countdown stop modal is not reused" dynamic scan**
- **Found during:** Task 2 (safety invariants)
- **Issue:** The plan's literal wording — "no file under components/hooks/pages that references useConfirmedControlSend or InstrumentStopModal imports it [StopRunModal]" — read as written against real sources, fails against `RunsComponent.tsx`, which legitimately imports both `InstrumentStopModal` (D-19) and the pre-existing `StopRunModal` (Tool Box `stop_run` step, outside the control-UI module list per the plan's own interfaces block) without itself being a confirmed-send caller.
- **Fix:** Scoped the dynamic (beyond-the-fixed-list) half of the check to files that call `useConfirmedControlSend` specifically, dropping the "or InstrumentStopModal" trigger that produced the false positive. The fixed 7-file list (which already covers every genuine control-UI module and the new Stop flow) is still asserted exactly as specified.
- **Files modified:** controller/test/staticScan.test.ts
- **Verification:** All 13 tests pass against the real sources; the test still fails if `useConfirmedControlSend` is reintroduced into any file that also imports `StopRunModal`.
- **Committed in:** a4c0531 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 ambiguous-spec clarification)
**Impact on plan:** The clarification keeps the invariant's real intent (no control-UI module substitutes the countdown modal for the confirmed-send flow) while avoiding a false failure against a legitimate pre-existing file outside the control-UI module list. No scope creep — the fixed-list assertion from the plan is unchanged.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The D-25 gate is green for the whole phase: `tsc --noEmit`, `npm run test:unit` (210/210), and `npx prettier . --check` all exit 0 in `controller/`.
- UI-08 is proven structurally (single confirmed send path, no instrument-state check) and the safety invariants (no timers, no countdown-modal reuse, no queue-modal coupling, no Enter-bound default) are pinned as a regression suite.
- Remaining open item for Phase 2: the plan's `<verify><human-check>` (live verification of the control bar, confirmation modals, Stop flow and Run Recovery card against a simulated F.A.S.T.) is deferred to the consolidated end-of-phase UAT per `workflow.human_verify_mode=end-of-phase` — not yet executed by a human.
- Spec-less probe coverage carried forward unresolved from the plan (not dropped): UI-08 is proven for the live-control paths only; legacy saved protocol steps with fast abort/resume and the generic `tool.runCommand` mutation are not hardened against by these scans (pre-existing scope, noted in plan 02-04). The scans are regex-based over comment-stripped source, not a type-checked AST, so an aliased re-export could in principle evade them — the exact-file-list assertions make such a change visible in review.

---
*Phase: 02-run-page-live-controls*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: controller/test/staticScan.test.ts
- FOUND commit: f399810 (Task 1)
- FOUND commit: a4c0531 (Task 2)
- All 13 tests in controller/test/staticScan.test.ts pass
- D-25 gate verified: tsc --noEmit 0 errors, npm run test:unit 210/210, npx prettier . --check clean
