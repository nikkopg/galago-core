---
phase: 02-run-page-live-controls
plan: 03
subsystem: ui
tags: [chakra-ui, trpc, run-control, stop-confirmation, instrument-abort]

requires:
  - phase: 01-queue-control-path-run-state
    provides: commandQueue.toolControl mutation, commandQueue.runState query, RunStateMonitor, runControl.ts capability map
  - phase: 02-run-page-live-controls (plan 01)
    provides: controlDecision.ts (shouldShowControlBar, createConfirmedSender, runAfterAccepted, confirmStillValid, NOTHING_SENT_MESSAGE), useRunControlState, RunControlConfirmModal
provides:
  - stopInterception.ts (shouldInterceptQueueStop, shouldInterceptRunDelete, STOP_MODAL_COPY, stopModalBody, InstrumentStopRequest, buildStopRequest)
  - InstrumentStopModal.tsx (no-timer, no-default Stop confirmation wrapping RunControlConfirmModal)
  - "Pause queue" / Clear All / per-run delete interception wired into QueueStatuscomponent.tsx and RunsComponent.tsx
affects: [02-06]

actuals:
  tokens: 5796
  tasks: 2
  commits: 3
  plan_head_before: a689d02002e5659e2830e7cbddbfad91cb950ae8
  plan_head_after: b34ead7b9a7064f7fee048d0ed3996954184fee6

tech-stack:
  added: []
  patterns:
    - "Stop/Clear All/per-run delete all build an InstrumentStopRequest via buildStopRequest(envelope, followUp) and let one InstrumentStopModal instance per call site own the confirm/send/follow-up sequencing (D-18) — no call site re-implements abort-then-stop ordering"
    - "Clear-All and per-run-delete follow-ups are plain mutateAsync closures (() => clearAllMutation.mutateAsync(), () => skipRunMutation.mutateAsync(run.Id)) passed through runAfterAccepted, reusing the plan 02-01 sequencing primitive rather than adding a second one"

key-files:
  created:
    - controller/components/runs/stopInterception.ts
    - controller/components/runs/InstrumentStopModal.tsx
  modified:
    - controller/components/runs/status/QueueStatuscomponent.tsx
    - controller/components/runs/RunsComponent.tsx
    - controller/test/stopInterception.test.ts

key-decisions:
  - "Task 1 (tracer) built the complete stopInterception.ts module, including shouldInterceptRunDelete, STOP_MODAL_COPY and stopModalBody — not just the queue-stop subset the task literally scoped — because the pure predicates share no meaningful RED/GREEN boundary with the UI wiring Task 2 owns"
  - "Consequently Task 2's TDD RED phase produced zero failing tests: the pure-logic assertions it adds (run delete interception, stop modal copy, clear follow-ups) were already satisfied by Task 1's implementation. Rather than force an artificial failure, the test additions were committed as regression coverage (test(02-03)) and Task 2's GREEN commit (feat(02-03)) implemented the genuinely new, untested-by-necessity UI wiring: Clear All interception, per-run delete interception, and the stale-request close rule in InstrumentStopModal"
  - "The per-run delete bypass button matches DeleteWithConfirmation's icon look exactly (IconButton, Trash2 size 14, bg transparent) but skips its ConfirmationModal, since InstrumentStopModal is itself the single confirmation shown"

patterns-established:
  - "Pattern 3: a Stop-flow call site never calls stopMutation.mutate()/clearAllMutation.mutate()/skipRunMutation.mutate() directly while a controllable step runs — it defers to buildStopRequest + InstrumentStopModal, which gates the mutateAsync call behind an accepted abort via runAfterAccepted"

requirements-completed: [UI-06, UI-08]

coverage:
  - id: D1
    description: "Pause queue' button intercepts and opens InstrumentStopModal only while a controllable step runs; abort is sent and accepted via commandQueue.toolControl before commandQueue.stop runs, proven end to end through the real tRPC router and busy loop"
    requirement: "UI-06"
    verification:
      - kind: integration
        ref: "test/stopInterception.test.ts#pause queue during a controllable step > aborts before stopping"
        status: pass
    human_judgment: false
  - id: D2
    description: "A refused or failed abort never stops the queue"
    requirement: "UI-06"
    verification:
      - kind: integration
        ref: "test/stopInterception.test.ts#pause queue during a controllable step > a refused abort never stops the queue"
        status: pass
    human_judgment: false
  - id: D3
    description: "shouldInterceptQueueStop/shouldInterceptRunDelete predicates: unknown status still intercepts, no response means no interception, only the running step's own run is scoped for per-run delete interception"
    requirement: "UI-06"
    verification:
      - kind: unit
        ref: "test/stopInterception.test.ts#queue stop interception"
        status: pass
      - kind: unit
        ref: "test/stopInterception.test.ts#run delete interception"
        status: pass
    human_judgment: false
  - id: D4
    description: "Stop modal copy restates the return-liquid choice (Yes/No/not chosen) and the Abort confirm label"
    requirement: "UI-06"
    verification:
      - kind: unit
        ref: "test/stopInterception.test.ts#stop modal copy"
        status: pass
    human_judgment: false
  - id: D5
    description: "runAfterAccepted's follow-up sequencing generalizes correctly to Clear All and clearByRunId follow-ups: runs only on accepted, passes the run id through, and reports a rejecting follow-up as failed with its message"
    requirement: "UI-08"
    verification:
      - kind: unit
        ref: "test/stopInterception.test.ts#clear follow-ups"
        status: pass
    human_judgment: false
  - id: D6
    description: "Clear All and the running step's run-delete button route through InstrumentStopModal while a controllable step runs; other runs keep DeleteWithConfirmation; the modal closes itself with the 'nothing was sent' toast if the step ends or moves on before the operator confirms"
    requirement: "UI-06"
    verification:
      - kind: other
        ref: "acceptance-criteria greps: clearAllMutation.mutateAsync()/stopMutation.mutateAsync() wiring, shouldInterceptRunDelete/skipRunMutation.mutateAsync(run.Id) wiring, exactly one remaining <DeleteWithConfirmation>, no StopRunModal import, no setTimeout/setInterval in the Stop flow"
        status: pass
    human_judgment: true
    rationale: "This project has no React component-rendering test harness (@testing-library/react is not installed, D-24). The underlying sequencing primitive (runAfterAccepted) and the interception predicates are unit/integration tested; the actual rendered behavior (the icon button replacing DeleteWithConfirmation, the stale-request useEffect firing a real close+toast on a poll transition, long copy wrapping without hiding Cancel) has not been exercised by an automated renderer and needs a human/UAT pass."

duration: 35min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 3: Stop/Clear-All/Delete Instrument-Abort Interception Summary

**"Pause queue" (relabeled from "Pause"), Clear All, and the running step's per-run delete button all route through a new no-timer InstrumentStopModal while a controllable step runs, sequencing `toolControl("abort")` before the queue action via the existing `runAfterAccepted` primitive, proven end to end through the real tRPC router and busy loop.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-10-13T21:08:00Z
- **Completed:** 2026-10-13T21:43:00Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Delivered `stopInterception.ts`: pure interception predicates (`shouldInterceptQueueStop`, `shouldInterceptRunDelete`), Stop-modal copy (`STOP_MODAL_COPY`, `stopModalBody`), and `buildStopRequest` — the single way any call site builds an `InstrumentStopRequest`
- Delivered `InstrumentStopModal.tsx`: a thin, no-timer, no-default wrapper over the shared `RunControlConfirmModal` that fixes the target to `{kind:"running"}`/`action:"abort"`, supplies the Stop-specific copy, and closes itself with the "nothing was sent" toast if the step ends or moves on before the operator confirms (D-12 applied to Stop)
- Relabeled the queue's stop button from "Pause" to "Pause queue" (D-05) and wired it, Clear All, and the running step's per-run delete button to open `InstrumentStopModal` instead of firing their mutation directly, whenever `useRunControlState()` reports a running controllable step
- Proved the full abort-then-stop sequence end to end: `toolControl("abort", {return_liquid})` is sent and must return `ok:true` before `commandQueue.stop` runs, and a refused abort leaves the queue `BUSY` with the queue never stopped — verified against the real `CommandQueue`/busy loop/tRPC router, not mocked
- Confirmed the new Stop flow neither imports nor reuses the countdown `StopRunModal`, and that the Tool Box `stop_run` step's existing countdown path is untouched

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end "Pause queue" abort-then-stop** - `78a803b` (feat)
2. **Task 2 RED/regression: run delete interception, stop modal copy, clear follow-up tests** - `2b59948` (test)
3. **Task 2 GREEN: Clear All and per-run delete interception, stale-request close rule** - `b34ead7` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

_RED evidence note: Task 2's RED phase ran `npm run test:unit -- test/stopInterception.test.ts` with the new `shouldInterceptRunDelete`/`stop modal copy`/`clear follow-ups` assertions added, and all 20 tests passed immediately (0 failures) — see "Deviations from Plan" below for why, and why this was not forced into an artificial RED._

## Files Created/Modified

- `controller/components/runs/stopInterception.ts` - Interception predicates, Stop-modal copy, `InstrumentStopRequest`/`buildStopRequest`
- `controller/components/runs/InstrumentStopModal.tsx` - No-timer Stop confirmation wrapping `RunControlConfirmModal`, with the stale-request close rule
- `controller/components/runs/status/QueueStatuscomponent.tsx` - "Pause queue" relabel, `runControlState` prop, Pause/Clear-All interception, mounts `InstrumentStopModal`
- `controller/components/runs/RunsComponent.tsx` - Passes `runControlState` to `QueueStatusComponent`, per-run delete interception with a second `InstrumentStopModal` instance
- `controller/test/stopInterception.test.ts` - End-to-end abort-then-stop/refused-abort tests plus pure-logic coverage for interception, copy, and follow-up sequencing

## Decisions Made

- Task 1 (tracer) built the complete `stopInterception.ts` module up front (including `shouldInterceptRunDelete`, `STOP_MODAL_COPY`, `stopModalBody`) rather than only the queue-stop subset literally in its own scope, since these pure predicates share no RED/GREEN boundary with Task 2's UI wiring
- The per-run delete bypass button visually matches `DeleteWithConfirmation`'s icon (`IconButton`, `Trash2` size 14, transparent background) but renders no `ConfirmationModal` of its own — `InstrumentStopModal` is the single confirmation shown, so there is exactly one dialog, never two stacked
- Clear All's and per-run delete's follow-ups are plain `() => mutation.mutateAsync(...)` closures passed through the existing `runAfterAccepted` primitive (built in plan 02-01) — no new sequencing logic was added for them

## Deviations from Plan

### Auto-fixed Issues

**1. [Scope consolidation] Task 1 absorbed the full pure-logic module instead of only the queue-stop subset**
- **Found during:** Task 1 (tracer)
- **Issue:** The plan scoped Task 1 to `shouldInterceptQueueStop` + queue-stop wiring only, deferring `shouldInterceptRunDelete` to Task 2's TDD cycle. Building the queue-stop predicate in isolation from the structurally identical run-delete predicate (same `shouldInterceptQueueStop` call plus a `runId` equality check) would have meant writing, reviewing, and re-reading the same module twice for no design benefit.
- **Fix:** `stopInterception.ts` was built complete in Task 1's commit. Task 2's RED phase consequently found zero failing tests for `shouldInterceptRunDelete`, `stopModalBody`, and `STOP_MODAL_COPY` — they already worked. The newly-added tests were committed as `test(02-03)` regression coverage (not a true RED, since the target function already existed and passed), and Task 2's GREEN commit implemented the parts that genuinely had no prior implementation: Clear All interception in `QueueStatuscomponent.tsx`, per-run delete interception in `RunsComponent.tsx`, and the stale-request close `useEffect` in `InstrumentStopModal.tsx` (none of which have automated test coverage, consistent with D-24's "no jsdom/RTL by default" constraint).
- **Files modified:** `controller/components/runs/stopInterception.ts` (Task 1 commit `78a803b`), `controller/test/stopInterception.test.ts` (Task 2 commit `2b59948`)
- **Verification:** All 184 unit tests pass; `tsc --noEmit` is clean; acceptance-criteria greps for both tasks pass
- **Committed in:** `78a803b` (Task 1), `2b59948` (Task 2 test commit)

---

**Total deviations:** 1 scope consolidation (no Rule 1/2/3/4 triggers — this was a task-boundary organization choice, not a bug fix or missing-functionality fix)
**Impact on plan:** No scope creep: every function the plan specified was built, with identical final behavior to what two separately-scoped tasks would have produced. The only difference is which commit introduced `shouldInterceptRunDelete`/`stopModalBody`/`STOP_MODAL_COPY`, documented above and in Task 2's commit message for traceability.

## Issues Encountered

- `npx prettier --check` initially failed on `test/stopInterception.test.ts` (an 83-column line with `pf400` override); fixed by running `npx prettier --write` before committing. No other formatting issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `InstrumentStopModal`, `stopInterception.ts`'s predicates, and the `buildStopRequest`/`runAfterAccepted` pairing are available for plan 02-06's static source-scan invariants (no `StopRunModal` import, no timers in the control-UI modules, `toolControl` referenced from exactly one module)
- No blockers. The abort-then-stop sequencing for "Pause queue" is proven end to end against the real tRPC router and busy loop; Clear All and per-run delete use the identical mechanism but, like plan 02-01's control bar, have not been exercised by a component-rendering test (D-24's accepted limitation, coverage D6 above) and need a human/UAT pass to confirm the rendered Stop modal, the icon-button bypass, and the stale-request toast actually fire correctly in the browser

---
*Phase: 02-run-page-live-controls*
*Completed: 2026-10-13*

## Self-Check: PASSED

- All 5 created/modified files verified present on disk.
- All 3 task commits (78a803b, 2b59948, b34ead7) verified as ancestors of HEAD.
- Full unit suite (184/184) and `tsc --noEmit` re-run clean after final edits.
- `prettier --check` clean on all task files.
- Plan-level acceptance-criteria greps for both tasks re-verified passing.
