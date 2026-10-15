---
phase: 02-run-page-live-controls
plan: 05
subsystem: ui
tags: [chakra-ui, trpc, react-query, run-control, crash-recovery, tdd]

# Dependency graph
requires:
  - phase: 02-run-page-live-controls (plan 02-01)
    provides: controlDecision.ts primitives (ControlTarget, createConfirmedSender, getActionSpec/completeDecisions), useConfirmedControlSend, RunControlConfirmModal
  - phase: 02-run-page-live-controls (plan 02-04)
    provides: tool.recoveryControl tRPC mutation (fail-closed refusal order, no-deadline send, audit logging)
provides:
  - RunRecoverySection.tsx — always-rendered "Run Recovery" card for runControl tool types on the tool page
  - controlDecision.ts recovery ControlTarget variant, RECOVERY_UI_ACTIONS, optional sendRecovery dependency routed through the shared confirmed-send gate, normalizeToolKey, isToolTrackedByRunningStep, shouldShowRecoverySection
  - useConfirmedControlSend wired to trpc.tool.recoveryControl (D-24: the only client reference to this mutation)
  - RunControlConfirmModal closeOnDispatch prop (recovery-only early close while the send keeps running)
affects: []

actuals:
  tokens: 6532
  tasks: 2
  commits: 3
  plan_head_before: f20905c2279804dc70f65db3f76bc99b1e6fef44
  plan_head_after: 957e27eb3367fd6ec9e0dd5cc046026bcfbb9f62

tech-stack:
  added: []
  patterns:
    - "createConfirmedSender routes by ControlTarget.kind through one shared `dispatch` helper, so running-step sends and recovery sends get identical in-flight/refusal/transport-error handling with no duplicated logic"
    - "useConfirmedControlSend() is now called in the OUTER RunControlConfirmModal (not the inner body that unmounts on close), so a closeOnDispatch send and its onPendingChange callbacks keep running after the modal closes"
    - "Recovery-section visibility is a pure function of tool type alone (shouldShowRecoverySection(toolType)), never consulting run state — the fix for Pitfall 10 (recovery controls disappearing exactly when a restart makes them necessary)"

key-files:
  created:
    - controller/components/tools/RunRecoverySection.tsx
  modified:
    - controller/components/runs/controlDecision.ts
    - controller/hooks/useRunControl.ts
    - controller/components/runs/RunControlConfirmModal.tsx
    - controller/pages/tools/[id].tsx
    - controller/test/controlDecision.test.ts
    - controller/test/recoveryControl.test.ts

key-decisions:
  - "Task 1 (tracer) implemented the full recovery routing in createConfirmedSender and the isToolTrackedByRunningStep/shouldShowRecoverySection predicates (using a private inline normalize) end to end, needed to prove the real Resume path through tool.recoveryControl; Task 2's TDD RED phase was genuinely new only for the normalizeToolKey export — it failed for the right reason (TypeError: normalizeToolKey is not a function), confirmed via RED_EVIDENCE_OK against a tap-flat run (49 passed, 1 failed). This mirrors the same tracer-preempts-TDD-RED pattern already recorded for this project in 02-03 and 02-04 (STATE.md)."
  - "useConfirmedControlSend() moved from the inner RunControlConfirmModalBody (which unmounts the instant closeOnDispatch calls onClose()) to the outer RunControlConfirmModal component, so the mutation hook instance — and the pending send it kicked off — survives the modal closing, per the plan's explicit instruction."
  - "createConfirmedSender's running-target and recovery-target branches were unified behind one private `dispatch(action, call)` helper so success/refusal/transport-error handling (notify, inFlight bookkeeping) is written exactly once for both targets."

patterns-established:
  - "Pattern 3: a ControlTarget union with a shared confirmed-send gate lets a second control surface (crash recovery) reuse 100% of the running-step surface's in-flight/refusal/toast handling by adding only an optional dependency and a routing branch"

requirements-completed: [UI-07, UI-08]

coverage:
  - id: D1
    description: "Run Recovery visibility and tracked-tool predicates: shouldShowRecoverySection depends only on tool type (never run state, Pitfall 10); isToolTrackedByRunningStep reads queue state only and matches by normalized tool name"
    requirement: "UI-07"
    verification:
      - kind: unit
        ref: "test/controlDecision.test.ts#recovery section visibility"
        status: pass
      - kind: unit
        ref: "test/controlDecision.test.ts#tracked tool"
        status: pass
    human_judgment: false
  - id: D2
    description: "Recovery send gate: createConfirmedSender restricts recovery actions to resume/abort, requires complete decisions, refuses with a fixed message when no sendRecovery dependency is configured, and gates concurrent sends exactly like the running-step path"
    requirement: "UI-08"
    verification:
      - kind: unit
        ref: "test/controlDecision.test.ts#recovery send gate"
        status: pass
    human_judgment: false
  - id: D3
    description: "End-to-end confirmed recovery Resume reaches tool.recoveryControl through the real tRPC router and the real F.A.S.T. fake, and the tracked-tool refusal from plan 02-04 surfaces verbatim through the same sender"
    requirement: "UI-07"
    verification:
      - kind: integration
        ref: "test/recoveryControl.test.ts#tool-page recovery send reaches the tool"
        status: pass
    human_judgment: false
  - id: D4
    description: "RunRecoverySection renders a Run Recovery card (Resume/Abort, no Pause) on the tool page for runControl tool types, disables both buttons only while tracked or pending, shows the disabled-state hint with a link to /runs, and shows an in-progress spinner with no client timeout while a recovery call is pending"
    requirement: "UI-07"
    verification:
      - kind: other
        ref: "acceptance-criteria greps: single <RunRecoverySection> mount, closeOnDispatch wired, hint text verbatim, no Pause offered, no setTimeout/setInterval/AbortController"
        status: pass
    human_judgment: true
    rationale: "This project has no React component-rendering test harness (@testing-library/react is not installed, per 02-01's D8). The underlying logic this component consumes (shouldShowRecoverySection, isToolTrackedByRunningStep, the confirmed-send gate) is unit- and integration-tested above, and the structural shape is grep-verified, but the actual rendered behavior (button disabled states reacting to live polling, the hint text wrapping, the spinner replacing nothing else on the page) needs a human/UAT pass."
  - id: D5
    description: "RunControlConfirmModal's closeOnDispatch: for a recovery send, the Confirm handler marks pending, closes the modal immediately, then awaits the dispatched send and clears pending — the hook instance that owns the send now lives in the outer component so it survives the inner body's unmount"
    verification: []
    human_judgment: true
    rationale: "The component-unmount-survives-pending-send behavior is a React lifecycle property that cannot be exercised without a rendering harness; it is verified by code review (useConfirmedControlSend is called in the outer, not the inner, component) and by the fact that the underlying send function is the same stable object regardless of whether the body is mounted, but needs a human/UAT pass to confirm no regression in the browser."

duration: ~40min (active work; session paused once by an API rate limit between Task 1 and Task 2)
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 05: Tool-page crash recovery via the shared confirmed-send gate Summary

**"Run Recovery" card on the tool page offering Resume/Abort for any runControl tool type, always visible regardless of run state (Pitfall 10), routed through `createConfirmedSender`'s new recovery branch to the real `tool.recoveryControl` mutation.**

## Performance

- **Duration:** ~40 min active (one session pause for an API rate limit between Task 1 and Task 2)
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD RED-GREEN)
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- Delivered `RunRecoverySection.tsx`: always-rendered Run Recovery card for `runControl` tool types (Pitfall 10 fix — visibility is `shouldShowRecoverySection(toolType)` alone, never a function of whether a step is running), Resume/Abort disabled only while a run step tracks this specific tool, an in-progress spinner while a call is pending, and no client-side timeout
- Extended `controlDecision.ts`: `ControlTarget` recovery variant, `RECOVERY_UI_ACTIONS`, an optional `sendRecovery` dependency on `createConfirmedSender` routed through one shared `dispatch` helper (identical in-flight/refusal/transport-error handling for both targets), `normalizeToolKey`, `isToolTrackedByRunningStep`, `shouldShowRecoverySection`
- Wired `trpc.tool.recoveryControl` into `useConfirmedControlSend` as `sendRecovery` — the sole client reference to that mutation (D-24)
- Added `closeOnDispatch` to `RunControlConfirmModal` and moved `useConfirmedControlSend()` to the outer component so a dispatched recovery send and its pending callbacks survive the modal closing immediately after confirm (D-23)
- Mounted `RunRecoverySection` on the tool page right after `ToolStatusCard`
- Proved the confirmed recovery Resume path end to end through the real tRPC router (`test/recoveryControl.test.ts`), and that the tracked-tool refusal from plan 02-04 surfaces verbatim through the same sender

## Task Commits

Each task was committed atomically; Task 2 (tdd) followed a scoped RED → GREEN cycle:

1. **Task 1: End-to-end crash-recovery Resume (tracer)** - `f93933e` (feat)
2. **Task 2 RED: failing test for normalizeToolKey** - `30d7089` (test)
3. **Task 2 GREEN: export normalizeToolKey, finalize predicates** - `957e27e` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

_RED evidence: `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` against a `tap-flat` run of `test/controlDecision.test.ts` (49 of 50 tests passed, 1 failed for the intended reason: `normalizeToolKey is not a function`). No REFACTOR commit was needed — the GREEN implementation needed no post-hoc cleanup beyond the TS literal-widening fix included in the same commit._

## Files Created/Modified

- `controller/components/tools/RunRecoverySection.tsx` - New Run Recovery card (Resume/Abort, disabled-state hint + link, pending spinner)
- `controller/components/runs/controlDecision.ts` - Recovery `ControlTarget`, `RECOVERY_UI_ACTIONS`, `sendRecovery` routing, `normalizeToolKey`, `isToolTrackedByRunningStep`, `shouldShowRecoverySection`
- `controller/hooks/useRunControl.ts` - `trpc.tool.recoveryControl` wired into `useConfirmedControlSend`
- `controller/components/runs/RunControlConfirmModal.tsx` - `closeOnDispatch` prop; `useConfirmedControlSend()` moved to the outer component
- `controller/pages/tools/[id].tsx` - Mounted `<RunRecoverySection>` after `<ToolStatusCard>`
- `controller/test/controlDecision.test.ts` - "recovery section visibility", "tracked tool", "recovery send gate" describes
- `controller/test/recoveryControl.test.ts` - "tool-page recovery send reaches the tool" describe (end-to-end send + tracked-tool refusal)

## Decisions Made

- Task 1 (tracer) implemented the complete recovery routing and predicates needed to prove the end-to-end Resume path; Task 2's genuinely new RED/GREEN cycle was scoped to the `normalizeToolKey` export (mirrors the established tracer-preempts-TDD-RED pattern from 02-03/02-04)
- `useConfirmedControlSend()` moved from the inner `RunControlConfirmModalBody` to the outer `RunControlConfirmModal`, so the hook instance (and a dispatched `closeOnDispatch` send) survives the body unmounting on close
- `createConfirmedSender`'s running and recovery branches share one private `dispatch(action, call)` helper rather than duplicating the accept/refuse/fail handling

## Deviations from Plan

None - plan executed exactly as written. (The Task 1/Task 2 RED-phase scoping above is the documented, already-established project pattern for a tracer that proves a full feature end to end before its TDD-task sibling runs — not a deviation from this plan's own instructions, which explicitly asked Task 1 to implement the predicates and Task 2 to "finalise" them.)

## Issues Encountered

- A TS literal-widening error surfaced in the new "ignores a second recovery send while the first is pending" test: building the request as a standalone `const` object widened `"no"` to `string` instead of `ControlDecisionValue`. Fixed with `as const` on that literal, matching the pattern already used elsewhere in the file for inline request objects. Caught by `tsc --noEmit` before commit.
- The session was interrupted once by an API rate limit between committing Task 1 and starting Task 2; resumed cleanly from the last commit with no rework needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 (Run Page Live Controls) plan 05 of 6 complete. `tool.recoveryControl` (plan 02-04) is now reachable from the tool page through the same shared confirmed-send gate and `RunControlConfirmModal` every other control entry point uses.
- No blockers. Remaining risk is UI-rendering verification (D4/D5 in the coverage block above) which needs a human/UAT pass, consistent with every other React-rendering deliverable in this phase (no `@testing-library/react` harness in this project).
- Ready for the next plan in this phase, or end-of-phase UAT/verification if 02-05 was the last plan.

---
*Phase: 02-run-page-live-controls*
*Completed: 2026-10-14*

## Self-Check: PASSED

- All 7 created/modified files verified present on disk.
- All 3 task commits (`f93933e`, `30d7089`, `957e27e`) verified as ancestors of HEAD.
- Full unit suite (197/197), `tsc --noEmit`, and scoped `prettier --check` all re-run clean after final edits.
- All Task 1 and Task 2 acceptance-criteria greps re-verified passing.
