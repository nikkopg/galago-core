---
phase: 02-run-page-live-controls
verified: 2026-10-14T04:15:00Z
status: human_needed
score: 12/16 must-haves verified
covered_files: [".planning/phases/02-run-page-live-controls/02-01-PLAN.md", ".planning/phases/02-run-page-live-controls/02-01-SUMMARY.md", ".planning/phases/02-run-page-live-controls/02-02-PLAN.md", ".planning/phases/02-run-page-live-controls/02-02-SUMMARY.md", ".planning/phases/02-run-page-live-controls/02-03-PLAN.md", ".planning/phases/02-run-page-live-controls/02-03-SUMMARY.md", ".planning/phases/02-run-page-live-controls/02-04-PLAN.md", ".planning/phases/02-run-page-live-controls/02-04-SUMMARY.md", ".planning/phases/02-run-page-live-controls/02-05-PLAN.md", ".planning/phases/02-run-page-live-controls/02-05-SUMMARY.md", ".planning/phases/02-run-page-live-controls/02-06-PLAN.md", ".planning/phases/02-run-page-live-controls/02-06-SUMMARY.md", "controller/components/runs/ControlBar.tsx", "controller/components/runs/InstrumentStopModal.tsx", "controller/components/runs/RunControlConfirmModal.tsx", "controller/components/runs/RunsComponent.tsx", "controller/components/runs/ToolPausedModal.tsx", "controller/components/runs/controlDecision.ts", "controller/components/runs/pausePrompt.ts", "controller/components/runs/status/QueueStatuscomponent.tsx", "controller/components/runs/stopInterception.ts", "controller/components/tools/RunRecoverySection.tsx", "controller/components/tools/constants.ts", "controller/components/ui/Toast.tsx", "controller/hooks/useRunControl.ts", "controller/pages/tools/[id].tsx", "controller/server/recoveryControl.ts", "controller/server/routers/tool.ts", "controller/server/runState.ts", "controller/test/controlDecision.test.ts", "controller/test/pausePrompt.test.ts", "controller/test/recoveryControl.test.ts", "controller/test/runControl.test.ts", "controller/test/runState.test.ts", "controller/test/staticScan.test.ts", "controller/test/stopInterception.test.ts"]
covered_digest: "v3:sha256:c6dafdf6d95b264b25e44fddf52a3add995a114ca5943693b570cde4b4af0ffd"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "A confirm opened from the bar (or the tool_paused prompt) for a step that has since resumed or ended closes itself and shows the info toast 'The run resumed or the step ended before you confirmed; nothing was sent.' (D-02, D-12), and InstrumentStopModal applies the identical stale-request rule to the Stop flow"
    test: "Open a control confirm (or the Stop modal) for a running step, then let the step resume or end on the server before clicking Confirm"
    expected: "The open confirm/modal closes on its own, nothing is sent to the tool, and exactly one 'Confirmation closed' info toast appears (not zero, not two)"
    why_human: "The closing logic (confirmStillValid, reducePausePrompt's closedBy) is exhaustively unit-tested as pure functions, but the React useEffect that actually calls setRequest(null)/onClose() and fires infoToast() in ControlBar.tsx and InstrumentStopModal.tsx has never been exercised by a rendering test (no @testing-library/react in this project) — presence and wiring are confirmed by code review, the runtime firing is not"
  - truth: "RunControlConfirmModal's Yes/No RadioGroup starts with nothing selected on every open and visually resets when the same action is reopened after a previous attempt (UI-03, D-07)"
    test: "Open Resume, pick an answer, Cancel, then reopen Resume (or Abort) on the run page, the tool_paused prompt, the Stop flow and the tool-page Run Recovery card"
    expected: "Every reopen shows both radio buttons unchecked, independent of what was chosen last time"
    why_human: "emptyDecisions/allDecisionsChosen/completeDecisions are pure-unit-tested and the remount key (toolType:action) is confirmed by code review to force a fresh useState on every open, but the actual DOM re-render (radio buttons visually unchecked) has not been exercised by a rendering harness"
human_verification:
  - test: "Run galago-web against a simulated F.A.S.T. and, during a transfer on the run page, confirm the control bar sits between the Gantt chart and the Runs List card and shows tool, command, state badge and progress"
    expected: "Bar renders in the correct position with correct content; bar and queue lists do not flicker against each other (Pitfall 9)"
    why_human: "No React rendering harness exists in this project (@testing-library/react is not installed); layout and flicker are visual judgments"
  - test: "During the same transfer, click Pause instrument, Resume instrument and Abort instrument run; try Enter and Esc while the confirm is open"
    expected: "Each opens a confirmation whose Yes/No starts unselected and whose Confirm stays disabled until chosen; Enter and Esc never confirm (only Cancel/Esc/overlay dismiss, which sends nothing)"
    why_human: "Keyboard-focus and dialog-dismissal behavior is a live DOM interaction not covered by the pure-logic unit tests"
  - test: "Click 'Pause queue' during the transfer"
    expected: "Opens 'Abort Instrument Run' with a Return-liquid Yes/No choice, no countdown, Abort disabled until chosen"
    why_human: "Visual/interactive confirmation of the no-timer modal in the browser"
  - test: "Open the F.A.S.T. tool page while the transfer is running"
    expected: "The Run Recovery card is visible and disabled, with the 'A run step is tracking this tool; use the run page.' text and a working link to /runs"
    why_human: "Rendered disabled-state and link behavior need a live browser check"
  - test: "Trigger a real or simulated instrument pause (e.g. deck 3 empty) during a run"
    expected: "The tool_paused prompt opens within about 2 s showing 'WrongPlateType (-645)' (or the real reason), the plain-language detail, and the local start time; it closes on resume or step end without blocking the queue"
    why_human: "The ~2 s latency depends on two live 2 s polls in series (server monitor + client hook) and can only be observed against a real or simulated instrument, not in a unit test; 02-VALIDATION.md documents this as a manual-only verification, to be finished in galago-tools' supervised live acceptance"
  - test: "Trigger the stale-confirm-closes scenario: open Resume/Abort (bar, prompt, or Stop flow) just as the step the confirm was opened for resumes or ends"
    expected: "The open confirm closes itself and shows exactly one 'Confirmation closed' toast; nothing is sent"
    why_human: "Same reasoning as behavior_unverified_items row 1 — this is the human-check counterpart of that unexercised React effect"
  - test: "Reopen a confirm modal (any action) after cancelling or confirming a previous one"
    expected: "Both the modal body and (for Resume/Abort) the radio buttons render fresh/unchecked every time"
    why_human: "Same reasoning as behavior_unverified_items row 2"
  - test: "Trigger a refusal (e.g. send Resume while the tool is not paused) and a transport error"
    expected: "A persistent, closable 'Action refused' toast appears carrying the core's message verbatim, with no auto-dismiss and no retry; percent/state badge only change on the next poll, never optimistically"
    why_human: "Toast duration/closability and the absence of optimistic UI flicker are visual/timing properties that need a live browser check (covered logically by unit tests, not by a render)"
---

# Phase 2: Run Page Live Controls Verification Report

**Phase Goal:** The operator controls a running instrument step from the run page, with explicit,
confirmed decisions, and is prompted when the instrument pauses itself.
**Verified:** 2026-10-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UI-01: a controllable running step shows a control bar (tool/type/command, state badge, percent progress) between the Gantt chart and Runs List cards, keyed by queueId, with Pause/Resume/Abort gated per D-04 hints | ✓ VERIFIED | `controlDecision.ts` (`shouldShowControlBar`, `controlButtonHints`, `progressValue`); `ControlBar.tsx`; unit tests "bar visibility", "button hints", "progress" (controlDecision.test.ts, all pass); grep confirms bar sits strictly between the Gantt (`RunsComponent.tsx:605`) and the Runs List heading (`:618`) |
| 2 | UI-02: every control action opens `RunControlConfirmModal` before anything is sent; the bar/badge/progress change only from the next `runState` poll, never from a mutation result | ✓ VERIFIED | `createConfirmedSender`'s `dispatch()` only calls `deps.sendRunning`/`sendRecovery` from `send()`, called only from `handleConfirm`; staticScan.test.ts "send is called only from the Confirm handler" and "no instrument-state check before sending" (both pass); `ControlBar.tsx` derives badge/progress solely from the `envelope` prop |
| 3 | UI-03: Resume/Abort decisions (`is_tip_broken`/`return_liquid`) start unselected; Confirm stays disabled until every decision is chosen; completion logic never defaults or infers | ✓ VERIFIED (logic) | `emptyDecisions`/`allDecisionsChosen`/`completeDecisions` unit-tested ("decision completeness"); `RunControlConfirmModal.tsx` gates `isDisabled` on `allDecisionsChosen`; see row 15 for the DOM-rendering half |
| 4 | UI-01/UI-03: the confirm's decision state visually resets (radios unchecked) on every open | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Remount key `${request.toolType}:${request.action}` forces a fresh `useState` per code review; no rendering test exercises the actual DOM reset — see `behavior_unverified_items` |
| 5 | UI-04: a paused `run_state` opens the `tool_paused` prompt with reason ("WrongPlateType (-645)"), plain-language detail ("Deck 3: expected plate 1, found none") and a start-time string | ✓ VERIFIED | `pausePrompt.test.ts#paused run reaches the prompt` — proven end to end through the real tRPC router and busy loop (not mocked); `formatPauseReason`/`describePauseDetail`/`formatPauseStartedAt` unit-tested for all documented edge cases |
| 6 | UI-04: the prompt opens "within about 2 s" of a live instrument pause | ? insufficient_spec | Depends on two live 2 s polls in series against a real/simulated instrument; documented as Manual-Only in `02-VALIDATION.md`; cannot be measured in a unit test — routed to human verification |
| 7 | UI-05: the prompt's full episode lifecycle (open once per episode, hide/reopen, close on resume/step-end/queueId-change, never close on "unknown") | ✓ VERIFIED | `reducePausePrompt` exhaustively unit-tested: "episode key", "hide and reopen", "new episode reopens", "closes on resume", "closes on step end", "closes on step change", "keeps open on unknown" (15 tests, pausePrompt.test.ts, all pass) |
| 8 | UI-05: the prompt never resolves/advances/blocks the queue or touches its `UIMessage` plumbing | ✓ VERIFIED | staticScan.test.ts "the pause prompt stays out of the queue's modal plumbing" (passes); `ToolPausedModal.tsx`/`pausePrompt.ts`/`ControlBar.tsx` contain no reference to `modalState`/`messageData`/`isModalOpen`/`commandQueue.resume`/`resumeMutation` |
| 9 | UI-06: "Pause queue", Clear All and the running step's per-run delete all send `toolControl("abort", ...)` and wait for `ok:true` before running the queue action; a refusal never runs it | ✓ VERIFIED | `stopInterception.test.ts#aborts before stopping` and `#a refused abort never stops the queue` — proven end to end (invocation-order assertion, real router/busy loop); `QueueStatuscomponent.tsx`/`RunsComponent.tsx` wiring confirmed by code review |
| 10 | UI-06: Stop uses a new no-timer, no-default confirmation; dismissing means Cancel; `StopRunModal` is not reused; the `stop_run` Tool Box path is untouched | ✓ VERIFIED | staticScan.test.ts "the countdown stop modal is not reused" and "no timers in the control UI" (pass); grep confirms `isOpen={isModalOpen && messageData.type === "stop_run"}` unchanged in `RunsComponent.tsx` |
| 11 | UI-07: `commandFields.fast` no longer declares `abort`/`resume`; legacy saved steps resolve to an empty field list instead of throwing | ✓ VERIFIED | `awk` over `constants.ts` confirms no `abort:`/`resume:` keys under `fast:`; `runControl.test.ts#commandFields drops fast abort/resume (D-20)` and `#legacy saved fast abort/resume steps stay safe in the editor (D-20)` pass |
| 12 | UI-07: `tool.recoveryControl` sends Resume/Abort to an untracked tool by id/name, refuses a tool a running step tracks (reading queue state only), refuses Pause/undeclared actions/blank decisions, logs every attempt, has no deadline | ✓ VERIFIED | `recoveryControl.test.ts` (19 tests, all pass) covers the full refusal matrix, audit logging, unthrown tool refusals, single-attempt transport-error surfacing, and the no-deadline pending case; `recoveryControl.ts` code review confirms the fixed refusal order and zero instrument-state reads |
| 13 | UI-07: the tool page's "Run Recovery" card is always rendered for `runControl` tool types, independent of whether a step is running (Pitfall 10 fix); disabled only while a run step tracks this specific tool | ✓ VERIFIED | `shouldShowRecoverySection(toolType)` takes no envelope parameter (grep-confirmed); unit test "recovery section visibility"; `RunRecoverySection.tsx` code review confirms `tracked` (not visibility) is the only envelope-dependent condition |
| 14 | UI-08: no galago-core code path sends Pause/Resume/Abort except an operator-confirmed action through the one shared confirm modal, and no code path reads instrument state before sending | ✓ VERIFIED | `staticScan.test.ts` — 13 regex-over-stripped-source tests with exact-file-list (`toStrictEqual`) assertions, all passing: exactly one client caller of `toolControl`/`recoveryControl` (`useRunControl.ts`), one client reader of `runState`, `useConfirmedControlSend` used only by `RunControlConfirmModal.tsx`, exactly two server `controlCommand` callers, and zero instrument-state reads in `toolControl`, `recoveryControl` or `createConfirmedSender` |
| 15 | Rendered visual/DOM behavior across the control bar, confirm modal, pause prompt, Stop modal and Run Recovery card (layout, badge/progress colors, text wrapping, toast appearance/duration, modal close-button hiding while sending) | ? insufficient_spec | Explicitly tagged `verification: backstop` in the plan frontmatter (8 truths across plans 02-01, 02-02, 02-03, 02-05); structural shape is grep-verified but actual rendering is unexercised — no `@testing-library/react` in this project (confirmed: not in `controller/package.json` devDependencies) |
| 16 | A stale confirm (bar- or prompt- or Stop-origin) actually closes itself with exactly one "nothing was sent" toast when the underlying step resumes/ends while the confirm is open | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | See row 4's sibling in `behavior_unverified_items` — the merged `ControlBar` effect and `InstrumentStopModal`'s effect are code-reviewed and structurally sound (confirmStillValid/reducePausePrompt are pure-tested), but the live effect firing is not exercised by any test |

**Score:** 12/16 truths verified (2 present, behavior-unverified; 2 insufficient_spec)

### Required Artifacts

All 22 artifacts declared across the six plans exist and pass structural checks (`gsd-tools query verify.artifacts`, run per plan): 6/6 (02-01), 4/4 (02-02), 4/4 (02-03), 4/4 (02-04), 3/3 (02-05), 1/1 (02-06) — 22/22 overall, no MISSING or STUB artifacts.

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/components/runs/controlDecision.ts` | Pure decision/send-gate module | ✓ VERIFIED | 417 lines; no React/`.tsx` import; exports match plan exactly (confirmed by direct read) |
| `controller/hooks/useRunControl.ts` | Sole `runState`/`toolControl`/`recoveryControl` client reader | ✓ VERIFIED | 53 lines; wires both mutations into one `createConfirmedSender` instance |
| `controller/components/runs/RunControlConfirmModal.tsx` | Shared confirm modal | ✓ VERIFIED | 232 lines; outer/inner split confirmed, `closeOnDispatch` present |
| `controller/components/runs/ControlBar.tsx` | Run-page control bar + pause prompt + confirm | ✓ VERIFIED | 227 lines; merged close-effect present |
| `controller/components/runs/pausePrompt.ts` | Pure pause-episode reducer | ✓ VERIFIED | 279 lines; full D-11..D-14 rule table present |
| `controller/components/runs/ToolPausedModal.tsx` | `tool_paused` prompt | ✓ VERIFIED | 118 lines; no HTML injection, no queue-plumbing reference |
| `controller/components/runs/stopInterception.ts` | Stop interception predicates | ✓ VERIFIED | 52 lines |
| `controller/components/runs/InstrumentStopModal.tsx` | No-timer Stop confirm | ✓ VERIFIED | 56 lines; stale-request rule present |
| `controller/server/recoveryControl.ts` | Crash-recovery orchestration | ✓ VERIFIED | 105 lines; fixed refusal order (a)(b)(c), no-deadline send, full audit logging |
| `controller/components/tools/RunRecoverySection.tsx` | Tool-page Run Recovery card | ✓ VERIFIED | 109 lines; no Pause button offered |
| `controller/test/staticScan.test.ts` | UI-08 structural proof | ✓ VERIFIED | 363 lines; 13 tests, all pass |

### Key Link Verification

All 16 key links declared across the six plans verify against the real source (`gsd-tools query verify.key-links`): 4/4, 2/2, 3/3, 3/3, 3/3, 1/1 — 16/16, all `verified: true`.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| UI-01 | 02-01 | Control bar with state/percent/Pause-Resume-Abort | ✓ SATISFIED | Truths 1, 4 |
| UI-02 | 02-01, 02-06 | Confirmation before every control action | ✓ SATISFIED | Truth 2, 14 |
| UI-03 | 02-01 | Non-defaulted yes/no decisions | ✓ SATISFIED (logic) / human (render) | Truths 3, 4 |
| UI-04 | 02-02 | `tool_paused` prompt content and ~2s latency | ✓ SATISFIED (content) / human (latency) | Truths 5, 6 |
| UI-05 | 02-02, 02-06 | Prompt lifecycle, no queue coupling | ✓ SATISFIED | Truths 7, 8 |
| UI-06 | 02-03, 02-06 | Stop/Clear All/delete instrument-abort interception | ✓ SATISFIED | Truths 9, 10 |
| UI-07 | 02-04, 02-05 | Step-editor cleanup + crash-recovery Resume/Abort | ✓ SATISFIED | Truths 11, 12, 13 |
| UI-08 | 02-01, 02-03, 02-04, 02-05, 02-06 | Single confirmed send path, no instrument-state check | ✓ SATISFIED | Truth 14 (strongest evidence: automated regression suite) |

No orphaned requirements: REQUIREMENTS.md maps exactly UI-01..UI-08 to Phase 2, and all eight appear in at least one plan's `requirements` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `controller/components/runs/RunsComponent.tsx` | 205 | `// TODO: Handle form submission - for now just resume` | ℹ️ Info | Pre-existing (blame: `f2721c9`, "Initial commit pre open source"), inside the unrelated `handleUserFormSubmit` Tool-Box user-form flow; not touched by any Phase 2 commit and not part of the live-control feature. Not a blocker (TODO is a warning-level marker, not TBD/FIXME/XXX, and the file's Phase 2 changes are elsewhere) |

No `TBD`/`FIXME`/`XXX` debt markers found in any file this phase modified. No stub patterns (`return <div>Placeholder</div>`, empty-string component bodies, hardcoded-empty props flowing to render) found in any of the 23 created/modified control-UI/server files — every `return null` found is legitimate control flow (closed-modal early return, failed-decision-completion guard, hidden-section guard).

### Behavioral Spot-Checks / Automated Gates

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Full unit suite | `npm --prefix controller run test:unit` | 210/210 passed, 11 files | ✓ PASS |
| Type check | `npm --prefix controller test` (`tsc --noEmit`) | 0 errors | ✓ PASS |
| Formatting | `npx prettier . --check` (controller) | clean | ✓ PASS |
| Static-scan suite (re-run standalone) | `npm --prefix controller run test:unit -- test/staticScan.test.ts` | 13/13 passed | ✓ PASS |
| Commit provenance | `git log` for all 15 task commits across 02-01..02-06 | all present, in order, as ancestors of HEAD | ✓ PASS |

### Probe Execution

Not applicable — this phase declares no `scripts/*/tests/probe-*.sh` probes and is not a migration/tooling phase; its verification is carried entirely by the Vitest suite and the static-scan regression tests above.

### Human Verification Required

See frontmatter `human_verification` (8 items) and `behavior_unverified_items` (2 items). Summary:

1. **Control bar live layout/flicker** — visual placement and no-flicker check against a simulated F.A.S.T.
2. **Confirm keyboard/dismissal semantics** — Enter never confirms, Esc/Cancel/overlay all mean Cancel
3. **"Pause queue" Stop modal live check** — no countdown, Abort disabled until chosen
4. **Run Recovery card disabled state + `/runs` link** — live render check
5. **Live pause-prompt latency (~2s)** — against a real/simulated instrument; `02-VALIDATION.md` already defers this to galago-tools' live acceptance
6. **Stale-confirm auto-close + single toast** — behavior_unverified_items row 1
7. **Decision radios visually reset on reopen** — behavior_unverified_items row 2
8. **Refusal/transport-error toast persistence and no optimistic flicker** — live render check

This list consolidates the plan 02-06 `<human-check>` block (harvested per `workflow.human_verify_mode=end-of-phase`) with the backstop-tagged truths from plans 02-01/02-02/02-03/02-05 and the two behavior-dependent invariants identified during this verification. None of these indicate a defect — every underlying pure-logic and wiring layer is proven by 210 passing automated tests plus a 13-test structural regression suite; what remains is rendering/timing behavior this project has no harness to exercise automatically (an openly disclosed, consistent limitation across every plan's own SUMMARY.md).

### Gaps Summary

No gaps found. Every plan's declared artifacts exist, are substantive, and are wired; every declared key link verifies against the real source; the full unit suite (210/210), `tsc --noEmit` (0 errors) and `prettier --check` all pass; the UI-08 safety invariant (the central risk of this phase — software silently commanding the instrument) is proven by an automated, CI-enforced static-scan suite with exact-file-list assertions, not just by code review. The phase is blocked only on human/live confirmation of rendering and timing behavior that this project's test infrastructure cannot exercise — a limitation disclosed consistently and in detail by every one of the six plans' own SUMMARY.md files, not a hidden defect.

---

_Verified: 2026-10-14_
_Verifier: Claude (gsd-verifier)_
