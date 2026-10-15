---
phase: 02-run-page-live-controls
verified: 2026-10-15T02:54:32Z
status: human_needed
score: 16/17 must-haves verified
covered_files: [".planning/phases/02-run-page-live-controls/02-01-PLAN.md", ".planning/phases/02-run-page-live-controls/02-01-SUMMARY.md", ".planning/phases/02-run-page-live-controls/02-02-PLAN.md", ".planning/phases/02-run-page-live-controls/02-02-SUMMARY.md", ".planning/phases/02-run-page-live-controls/02-03-PLAN.md", ".planning/phases/02-run-page-live-controls/02-03-SUMMARY.md", ".planning/phases/02-run-page-live-controls/02-04-PLAN.md", ".planning/phases/02-run-page-live-controls/02-04-SUMMARY.md", ".planning/phases/02-run-page-live-controls/02-05-PLAN.md", ".planning/phases/02-run-page-live-controls/02-05-SUMMARY.md", ".planning/phases/02-run-page-live-controls/02-06-PLAN.md", ".planning/phases/02-run-page-live-controls/02-06-SUMMARY.md", "controller/components/runs/ControlBar.tsx", "controller/components/runs/InstrumentStopModal.tsx", "controller/components/runs/RunControlConfirmModal.tsx", "controller/components/runs/RunsComponent.tsx", "controller/components/runs/ToolPausedModal.tsx", "controller/components/runs/controlDecision.ts", "controller/components/runs/pausePrompt.ts", "controller/components/runs/status/QueueStatuscomponent.tsx", "controller/components/runs/stopInterception.ts", "controller/components/tools/RunRecoverySection.tsx", "controller/components/tools/constants.ts", "controller/components/ui/Toast.tsx", "controller/hooks/useRunControl.ts", "controller/pages/tools/[id].tsx", "controller/server/recoveryControl.ts", "controller/server/routers/tool.ts", "controller/server/runState.ts", "controller/server/toolKey.ts", "controller/test/controlDecision.test.ts", "controller/test/pausePrompt.test.ts", "controller/test/recoveryControl.test.ts", "controller/test/runControl.test.ts", "controller/test/runState.test.ts", "controller/test/staticScan.test.ts", "controller/test/stopInterception.test.ts"]
covered_digest: "v3:sha256:5220c75652af45a44cd89eed10a617a64754d72c7ba67d53e7dee81afc1f4166"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 12/16
  gaps_closed:
    - "Decision state visually resets (radios unchecked) on every open — now human-verified via 02-UAT.md Test 7 (pass)"
    - "Stale confirm (bar/prompt/Stop-origin) auto-closes with exactly one 'Confirmation closed'-class toast and sends nothing — now human-verified via 02-UAT.md Test 6 (pass)"
    - "Control bar live layout/no-flicker — human-verified via 02-UAT.md Test 1 (pass)"
    - "Confirm keyboard/dismissal semantics (Enter never confirms, Esc/Cancel/overlay mean Cancel) — human-verified via 02-UAT.md Test 2 (pass)"
    - "'Pause queue' no-timer Stop modal live check — human-verified via 02-UAT.md Test 3 (pass)"
    - "Run Recovery card disabled state + /runs link — human-verified via 02-UAT.md Test 4 (pass)"
    - "Live pause-prompt latency (~2 s) against a real/simulated instrument — human-verified via 02-UAT.md Test 5 (pass; approximate per its own 'about 2 s' phrasing)"
    - "Refusal toast persistence/closability/no-optimistic-flicker — human-verified via 02-UAT.md Test 8 (refusal half, pass)"
    - "WR-01..WR-04, WR-06, WR-07 code-review warnings — fixed and re-reviewed clean (02-REVIEW-FIX.md, 02-REVIEW.md re-review, 02-REVIEW-DISPOSITION.md)"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "A transport/tRPC error (as opposed to an operator-visible tool refusal) during a control or recovery send closes the confirm modal and renders the same persistent, closable 'Action refused'-class toast with the error text, with no auto-dismiss and no retry"
    test: "Force a transport failure (e.g. stop the tool's gRPC/tool service mid-send, or inject a rejected mutateAsync) while confirming any control or recovery action, and observe the resulting toast"
    expected: "A persistent, closable error toast renders carrying the error text verbatim, identical in appearance/duration/closability to the refusal-path toast confirmed in 02-UAT.md Test 8; no optimistic badge/percent change occurs"
    why_human: "02-UAT.md Test 8 explicitly notes only the refusal half was exercised ('Transport-error half not exercised (would require stopping the tool server mid-run)'); no DOM-rendering test harness exists in this project. Code-level evidence is strong but not a substitute for observed evidence: createConfirmedSender's dispatch() (controller/components/runs/controlDecision.ts:292-320) routes both the refused (ok:false) and caught-exception (transport-error) branches through the identical deps.notify.refused(message) call — there is no separate rendering code path for the two cases — but this has not itself been exercised end to end against a live transport failure, and the instruction for this verification pass was explicit not to silently pass anything 02-UAT.md did not cover"
human_verification:
  - test: "Force a transport failure (stop the tool server or inject a rejected mutateAsync) during a confirmed control or recovery send"
    expected: "Same persistent, closable 'Action refused'-class toast as the refusal case (02-UAT.md Test 8), carrying the error text verbatim; no retry; no optimistic UI change"
    why_human: "Same reasoning as the paired behavior_unverified_items entry — the only gap left open by a completed, otherwise-exhaustive UAT pass (8/8)"
---

# Phase 2: Run Page Live Controls Verification Report

**Phase Goal:** The operator controls a running instrument step from the run page, with explicit,
confirmed decisions, and is prompted when the instrument pauses itself.
**Verified:** 2026-10-15
**Status:** human_needed
**Re-verification:** Yes — after code-review fix pass (WR-01..04/06/07), re-review, UI-styling fix
(`d4726ff`), and a completed human UAT (02-UAT.md, 8/8 passed). The prior report (dated
2026-10-14) was `human_needed` at 12/16 with no `gaps:` block (no coding gaps were ever found —
only pending human/behavioral evidence); this run supersedes it now that the covered source has
changed and the pending human evidence has been collected.

## Goal Achievement

### What changed since the prior verification

Commits `8953a59`, `2330455`, `969ed53`, `723d0e1`, `df87b45`, `2ca0e57` (WR-01, WR-02, WR-03,
WR-04, WR-06, WR-07 code-review fixes) and `d4726ff` (control-bar styling-only fixes: teal accent
on the running badge, spacing, badge/progress layout) touched 11 files. All were re-reviewed in
`02-REVIEW.md` (re-review, committed `bc81767`): 0 critical findings; the four Phase-2 safety
invariants (no send without an operator's complete, confirmed decision; no timers/auto-confirm; no
instrument-state check anywhere in galago-core; Stop/Clear-All/Delete-Run only run their queue-side
follow-up after an accepted abort) were explicitly re-checked against the diff and all hold. Two
warnings remain open (one new, introduced by the WR-07 fix itself; one a residual-scope note on
WR-06), tracked below under Anti-Patterns — neither violates a declared must-have. `02-UAT.md`
records a completed, passing human acceptance pass (8/8) executed against the rebuilt galago-web
and the redeployed galago-tools on 2026-10-14/15, which is used below as the human-verification
evidence for every previously-deferred item it covers.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | UI-01: a controllable running step shows a control bar (tool/type/command, state badge, percent progress) between the Gantt chart and Runs List cards, keyed by queueId, with Pause/Resume/Abort gated per D-04 hints | ✓ VERIFIED | `controlDecision.ts` (`shouldShowControlBar`, `controlButtonHints`, `progressValue`) unit-tested (`controlDecision.test.ts`, 50 tests pass); grep confirms the bar sits between the Gantt chart (`RunsComponent.tsx:616`) and the Runs List heading (`:629`), unchanged by the styling commit; 02-UAT.md Test 1 (pass) confirms live placement/content/no-flicker against a simulated F.A.S.T. |
| 2 | UI-02: every control action opens `RunControlConfirmModal` before anything is sent; the bar/badge/progress change only from the next `runState` poll, never from a mutation result | ✓ VERIFIED | `createConfirmedSender`'s `dispatch()` only calls `deps.sendRunning`/`sendRecovery` from `send()`, called only from `handleConfirm`; `staticScan.test.ts` "send is called only from the Confirm handler" and "no instrument-state check before sending" pass; 02-UAT.md Test 2 (pass, re-run 2026-10-15 after redeploy) confirms live confirm-before-send and keyboard/dismissal semantics |
| 3 | UI-03: Resume/Abort decisions (`is_tip_broken`/`return_liquid`) start unselected; Confirm stays disabled until every decision is chosen; completion logic never defaults or infers | ✓ VERIFIED | `emptyDecisions`/`allDecisionsChosen`/`completeDecisions` unit-tested; `RunControlConfirmModal.tsx` gates `isDisabled` on `allDecisionsChosen`; 02-UAT.md Test 2 confirms live disabled-until-chosen behavior |
| 4 | UI-01/UI-03: the confirm's decision state visually resets (radios unchecked) on every open, including after reopening the same action | ✓ VERIFIED | WR-03 fix (`969ed53`) makes the remount key identity-based (`request` reference, not just `toolType:action`), re-reviewed and confirmed sound in `02-REVIEW.md`; **02-UAT.md Test 7 (pass)** is the human-observed DOM evidence this was previously missing — "Both the modal body and radio buttons render fresh/unchecked every time" |
| 5 | UI-04: a paused `run_state` opens the `tool_paused` prompt with reason ("WrongPlateType (-645)"), plain-language detail ("Deck 3: expected plate 1, found none") and a start-time string | ✓ VERIFIED | `pausePrompt.test.ts#paused run reaches the prompt` (end to end through the real tRPC router); 02-UAT.md Test 5 (pass, re-run 2026-10-15 against the redeployed galago-tools) confirms live rendering |
| 6 | UI-04: the prompt opens "within about 2 s" of a live instrument pause, and closes on resume without blocking the queue | ✓ VERIFIED (approximate, human-observed) | 02-UAT.md Test 5 (pass): "prompt opened on the instrument pause and closed on Resume (log: resume SUCCESS on F.A.S.T queueId 92 at 02:40)"; the "~2 s" figure is inherently approximate (two live 2 s polls in series) and was never meant to be verified to sub-second precision — `02-VALIDATION.md` already scoped this to qualitative live observation, which is what the UAT pass provides |
| 7 | UI-05: the prompt's full episode lifecycle (open once per episode, hide/reopen, close on resume/step-end/queueId-change, never close on "unknown") | ✓ VERIFIED | `reducePausePrompt` exhaustively unit-tested (15 tests, `pausePrompt.test.ts`, all pass, unchanged by this diff) |
| 8 | UI-05: the prompt never resolves/advances/blocks the queue or touches its `UIMessage` plumbing | ✓ VERIFIED | `staticScan.test.ts` "the pause prompt stays out of the queue's modal plumbing" (passes, re-run standalone: 13/13) |
| 9 | UI-06: "Pause queue", Clear All and the running step's per-run delete all send `toolControl("abort", ...)` and wait for `ok:true` before running the queue action; a refusal never runs it | ✓ VERIFIED | `stopInterception.test.ts#aborts before stopping` / `#a refused abort never stops the queue` (unchanged); WR-01 fix (`8953a59`) hardens the per-run delete guard (type predicate + re-checked inside `onClick`, no longer trusting a cast), re-reviewed as fixed; 02-UAT.md Test 3 (pass) confirms live "Pause queue" behavior with log corroboration (`abort {return_liquid: yes} SUCCESS`, then queue stopped) |
| 10 | UI-06: Stop uses a new no-timer, no-default confirmation; dismissing means Cancel; `StopRunModal` is not reused; the `stop_run` Tool Box path is untouched | ✓ VERIFIED | `staticScan.test.ts` "the countdown stop modal is not reused" / "no timers in the control UI" (pass); WR-04 fix (`723d0e1`) makes `stopModalBody` derive decisions from the tool's declared abort spec instead of hardcoding `return_liquid` — re-reviewed and confirmed sound, with an updated test case for a tool type with no declared abort decisions |
| 11 | UI-07: `commandFields.fast` no longer declares `abort`/`resume`; legacy saved steps resolve to an empty field list instead of throwing | ✓ VERIFIED | `awk` over `constants.ts` confirms no `abort:`/`resume:` keys under `fast:`; `runControl.test.ts` (2 tests) pass, unchanged |
| 12 | UI-07: `tool.recoveryControl` sends Resume/Abort to an untracked tool by id/name, refuses a tool a running step tracks (reading queue state only), refuses Pause/undeclared actions/blank decisions, logs every attempt, has no deadline | ✓ VERIFIED | `recoveryControl.test.ts` (19 tests, all pass, unchanged); WR-06 fix (`df87b45`) consolidates tool-id normalization into `server/toolKey.ts`, imported by `recoveryControl.ts` and all three call sites in `routers/tool.ts` — re-reviewed and confirmed (one residual-scope note: `server/tools.ts` keeps its own unrelated copy for an in-memory lookup, deliberately out of scope) |
| 13 | UI-07: the tool page's "Run Recovery" card is always rendered for `runControl` tool types, independent of whether a step is running; disabled only while a run step tracks this specific tool | ✓ VERIFIED | `shouldShowRecoverySection(toolType)` takes no envelope parameter (grep-confirmed, unchanged); 02-UAT.md Test 4 (pass) confirms live visible-and-disabled state with the `/runs` link |
| 14 | UI-08: no galago-core code path sends Pause/Resume/Abort except an operator-confirmed action through the one shared confirm modal, and no code path reads instrument state before sending | ✓ VERIFIED | `staticScan.test.ts` re-run standalone, 13/13 passing (exact-file-list `toStrictEqual` assertions); `02-REVIEW.md` re-review explicitly re-checked this invariant against the diff and confirmed it holds (`recoveryControl.ts`'s refusal check still reads only queue state; no instrument-state check added anywhere in the fix commits) |
| 15 | Refusal (`ok:false`) control/recovery send closes the confirm and shows a persistent, closable "Action refused"-class toast carrying the message verbatim; nothing is retried | ✓ VERIFIED | `createConfirmedSender.dispatch()`'s `ok:false` branch calls `deps.notify.refused(message)` (`controlDecision.ts:307-312`); 02-UAT.md Test 2 (UNRECOGNIZED_COMMAND toast — persistent, closable, sent once) and Test 8 (refusal half, pass) both confirm live rendering |
| 16 | A transport/tRPC error (distinct from an operator-visible refusal) renders the identical persistent "Action refused"-class toast, with no auto-dismiss/retry and no optimistic badge/percent change | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Same `dispatch()` function's `catch` branch calls the identical `deps.notify.refused(message)` (`controlDecision.ts:313-316`) as the refusal branch — there is no separate rendering code path — but 02-UAT.md Test 8 explicitly notes this half was **not** exercised ("would require stopping the tool server mid-run"); no DOM-level test exists either. See `behavior_unverified_items` |
| 17 | A stale confirm (bar-, prompt- or Stop-origin) closes itself with exactly one "nothing was sent" toast when the underlying step resumes/ends while the confirm is open | ✓ VERIFIED | `confirmStillValid`/`reducePausePrompt` pure-unit-tested (unchanged); **02-UAT.md Test 6 (pass)** is the human-observed evidence this was previously missing — "galago-web log 09:58-09:59 simulated run: no Tool Control entry, step ended normally", result: pass |

**Score:** 16/17 truths verified (1 present, behavior-unverified)

### Required Artifacts

All 22 artifacts declared across the six plans exist and pass structural checks
(`gsd-tools query verify.artifacts`, re-run per plan against current `HEAD`): 6/6 (02-01), 4/4
(02-02), 4/4 (02-03), 4/4 (02-04), 3/3 (02-05), 1/1 (02-06) — 22/22 overall, no MISSING or STUB
artifacts. Plus the new `controller/server/toolKey.ts` module introduced by the WR-06 fix (not a
declared plan artifact, but covered by this report's `covered_files`/digest).

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `controller/components/runs/controlDecision.ts` | Pure decision/send-gate module | ✓ VERIFIED | `normalizeToolKey` now re-exported from `toolKey.ts` (WR-06); structure otherwise unchanged |
| `controller/hooks/useRunControl.ts` | Sole `runState`/`toolControl`/`recoveryControl` client reader | ✓ VERIFIED | unchanged by this diff |
| `controller/components/runs/RunControlConfirmModal.tsx` | Shared confirm modal | ✓ VERIFIED | WR-03 (identity-based remount key) and WR-07 (desync toast) fixes present and re-reviewed sound |
| `controller/components/runs/ControlBar.tsx` | Run-page control bar + pause prompt + confirm | ✓ VERIFIED | WR-02 fix (`ToolPausedModal` gated on `request === null`) + `d4726ff` styling changes present; bar position unchanged |
| `controller/components/runs/pausePrompt.ts` | Pure pause-episode reducer | ✓ VERIFIED | unchanged |
| `controller/components/runs/ToolPausedModal.tsx` | `tool_paused` prompt | ✓ VERIFIED | unchanged |
| `controller/components/runs/stopInterception.ts` | Stop interception predicates | ✓ VERIFIED | WR-01 (type-predicate guard) + WR-04 (`stopModalBody` takes `toolType`) present |
| `controller/components/runs/InstrumentStopModal.tsx` | No-timer Stop confirm | ✓ VERIFIED | WR-03 fix (`useMemo`'d request object) present |
| `controller/server/recoveryControl.ts` | Crash-recovery orchestration | ✓ VERIFIED | now imports `normalizeToolKey` from `toolKey.ts` (WR-06) |
| `controller/components/tools/RunRecoverySection.tsx` | Tool-page Run Recovery card | ✓ VERIFIED | unchanged |
| `controller/server/toolKey.ts` | Single-source tool-id normalization (new, WR-06) | ✓ VERIFIED | 13-line zero-import module; imported by `controlDecision.ts`, `recoveryControl.ts`, `routers/tool.ts` (all three sites); `server/tools.ts` keeps an independent fourth copy, deliberately out of scope (02-REVIEW.md residual note) |
| `controller/test/staticScan.test.ts` | UI-08 structural proof | ✓ VERIFIED | 13 tests, all pass (re-run standalone) |

### Key Link Verification

All 16 key links declared across the six plans verify against the real source
(`gsd-tools query verify.key-links`, re-run against current `HEAD`): 4/4, 2/2, 3/3, 3/3, 3/3, 1/1 —
16/16, all `verified: true`.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| UI-01 | 02-01 | Control bar with state/percent/Pause-Resume-Abort | ✓ SATISFIED | Truths 1, 4 |
| UI-02 | 02-01, 02-06 | Confirmation before every control action | ✓ SATISFIED | Truths 2, 14, 15; Truth 16 narrows one rendering sub-case (transport error) to human-needed |
| UI-03 | 02-01 | Non-defaulted yes/no decisions | ✓ SATISFIED | Truths 3, 4 |
| UI-04 | 02-02 | `tool_paused` prompt content and ~2s latency | ✓ SATISFIED | Truths 5, 6 |
| UI-05 | 02-02, 02-06 | Prompt lifecycle, no queue coupling | ✓ SATISFIED | Truths 7, 8 |
| UI-06 | 02-03, 02-06 | Stop/Clear All/delete instrument-abort interception | ✓ SATISFIED | Truths 9, 10 |
| UI-07 | 02-04, 02-05 | Step-editor cleanup + crash-recovery Resume/Abort | ✓ SATISFIED | Truths 11, 12, 13 |
| UI-08 | 02-01, 02-03, 02-04, 02-05, 02-06 | Single confirmed send path, no instrument-state check | ✓ SATISFIED | Truth 14 (strongest evidence: automated regression suite + re-review against the diff) |

No orphaned requirements: REQUIREMENTS.md maps exactly UI-01..UI-08 to Phase 2, all marked
"Complete", and all eight appear in at least one plan's `requirements` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `controller/components/runs/RunsComponent.tsx` | 204 | `// TODO: Handle form submission - for now just resume` | ℹ️ Info | Pre-existing (blame `f2721c9`), inside the unrelated Tool-Box user-form flow; not touched by any Phase 2 commit, not part of the live-control feature. Not a blocker (TODO is warning-level, not TBD/FIXME/XXX) |
| `controller/components/runs/RunControlConfirmModal.tsx` | 46-53 | `followUpFailureToast` concatenates an interpolated error message directly into the next sentence with no separating punctuation when `message` is present (e.g. "...failed: db locked This step may still show...") | ⚠️ Warning | New, introduced by the WR-07 fix itself (commit `2ca0e57`); flagged in the re-review (`02-REVIEW.md` WR-07-FOLLOWUP) and still present and unfixed in current `HEAD`. Readability defect only — the message is still carried verbatim (not dropped/paraphrased) and the toast is still persistent/non-auto-dismissing; does not violate any declared must-have truth. Not a blocker for this phase's safety goal, but should be fixed (`: ${message}.` or restructure as a parenthetical) |
| `controller/server/toolKey.ts` | header comment | Comment claims "Single source of truth for tool-id normalization" while `controller/server/tools.ts:44` keeps an independent, textually-identical fourth copy for an unrelated in-memory lookup | ⚠️ Warning (residual scope note, carried from `02-REVIEW.md`) | Deliberately scoped out of the WR-06 fix per `02-REVIEW-FIX.md`; not a functional defect, but the module's own comment overstates what was achieved. Track as a follow-up, not a phase blocker |
| `controller/components/runs/controlDecision.ts` | 17 | `HEAD_MOVES_NOTE` renders unconditionally for every action including Pause (WR-05, deliberately skipped per `02-REVIEW-FIX.md`, pending a product/instrument-behavior decision) | ℹ️ Info | The literal must-have text (02-01-PLAN.md: "...and states that the instrument head will move (D-05, D-08)") does not condition this on action type, so current behavior conforms to the declared must-have as written; WR-05 is a design-quality concern beyond the stated requirement, not a requirement failure |

No `TBD`/`FIXME`/`XXX` debt markers found in any file this phase modified or that the recent
fix/styling commits touched. No stub patterns found.

### Behavioral Spot-Checks / Automated Gates

Re-run independently by this verifier against current `HEAD` (not taken from SUMMARY/REVIEW-FIX
claims):

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Full unit suite | `npm --prefix controller run test:unit` | 211/211 passed, 11 files | ✓ PASS |
| Type check | `npm --prefix controller test` (`tsc --noEmit`) | 0 errors | ✓ PASS |
| Formatting (controller only) | `npx prettier . --check` run from `controller/` | "All matched files use Prettier code style!" | ✓ PASS |
| Static-scan suite (re-run standalone) | `npm --prefix controller run test:unit -- test/staticScan.test.ts` | 13/13 passed | ✓ PASS |
| Commit provenance | `git log --oneline` | all fix/review/UAT commits (`8953a59`..`f47f2ae`) present as ancestors of `HEAD` | ✓ PASS |
| Control-bar placement regression | grep for `ControlBar`/Gantt/Runs-List line order in `RunsComponent.tsx` | bar at line 622, strictly between Gantt (616) and Runs List heading (629) | ✓ PASS |

(Note: a repo-root `prettier --check` surfaces pre-existing formatting warnings in unrelated
`vendor/galago-tools/**` planning docs — not part of this phase's scope; the `controller/`-scoped
check matches the gate SUMMARY/REVIEW-FIX claimed.)

### Probe Execution

Not applicable — this phase declares no `scripts/*/tests/probe-*.sh` probes and is not a
migration/tooling phase.

### Human Verification Required

02-UAT.md (status: complete, 8/8 passed, re-run 2026-10-15 for Tests 2 and 5 after the
galago-tools redeploy) closes out every human-verification item and both
`PRESENT_BEHAVIOR_UNVERIFIED` items from the prior (2026-10-14) VERIFICATION.md. One narrow item
remains, surfaced by 02-UAT.md's own note rather than silently passed:

1. **Transport-error toast rendering** — 02-UAT.md Test 8 exercised only the refusal
   (`ok:false`) half of "Trigger a refusal ... and a transport error"; its own note states
   "Transport-error half not exercised (would require stopping the tool server mid-run)."
   - **Test:** Force a transport/tRPC failure (e.g. stop the tool service mid-send) while
     confirming any control or recovery action.
   - **Expected:** The same persistent, closable "Action refused"-class toast as the already-
     confirmed refusal case, carrying the error text verbatim; no retry; no optimistic UI change.
   - **Why human:** No DOM-rendering harness exists in this project. Code-level evidence is
     strong — `createConfirmedSender.dispatch()`'s `catch` branch calls the exact same
     `deps.notify.refused(message)` as the `ok:false` branch (`controlDecision.ts:307-316`), so
     there is no separate rendering code path for the two cases — but per this verification's
     explicit instruction, the fact that 02-UAT.md itself flags this half as unexercised means it
     must not be silently folded into "verified."

### Gaps Summary

No gaps found — every declared truth, artifact and key link holds, the full automated gate is
green (211/211 unit tests, 0 `tsc` errors, clean `prettier --check`), the UI-08 safety invariant
was independently re-confirmed against the diff by both this verifier and the `02-REVIEW.md`
re-review, and a completed, 8/8-passing human UAT closes out every item the prior
(2026-10-14) report had flagged as `human_needed` or `PRESENT_BEHAVIOR_UNVERIFIED`, with
corroborating galago-web action-log evidence for Pause/Resume/Abort.

One narrow item is carried forward to human verification rather than silently passed: the
transport-error half of the refusal-toast rendering check (02-UAT.md's own note flags this as
unexercised). This is not a defect — the code path is provably identical to the already-confirmed
refusal case — but it was not itself observed, so it keeps the phase at `human_needed` rather than
`passed`. Two pre-existing-pattern Warnings (the WR-07-FOLLOWUP wording bug and the WR-06
residual-scope comment) and one deliberately-skipped Warning (WR-05, pending a product/instrument
decision) are tracked in Anti-Patterns; none of them violate a declared must-have or block the
phase goal.

---

_Verified: 2026-10-15T02:54:32Z_
_Verifier: Claude (gsd-verifier)_
