---
phase: 04-operator-only-commands-stack-acknowledge
verified: 2026-10-30T06:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-01-PLAN.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-01-SUMMARY.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-02-PLAN.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-02-SUMMARY.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-03-PLAN.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-03-SUMMARY.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-04-PLAN.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-04-SUMMARY.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-05-PLAN.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-05-SUMMARY.md
  - controller/components/runs/RunControlConfirmModal.tsx
  - controller/components/runs/controlDecision.ts
  - controller/components/runs/list/SwimLaneCommandComponent.tsx
  - controller/components/tools/RunRecoverySection.tsx
  - controller/hooks/useRunControl.ts
  - controller/pages/api/runs/index.ts
  - controller/server/command_queue.ts
  - controller/server/logger.ts
  - controller/server/operatorOnlyCommands.ts
  - controller/server/recoveryActions.ts
  - controller/server/recoveryControl.ts
  - controller/server/routers/run.ts
  - controller/server/routers/tool.ts
  - controller/server/runs.ts
  - controller/server/tools.ts
  - controller/test/controlDecision.test.ts
  - controller/test/latchStatus.test.ts
  - controller/test/operatorOnly.test.ts
  - controller/test/recoveryActions.test.ts
  - controller/test/recoveryControl.test.ts
  - controller/test/setup.ts
  - controller/test/staticScan.test.ts
covered_digest: "v3:sha256:ffa1d741c989a68125a71627d94b3ceb8f8d96c8e714bc2ca5057c491f3f05a8"
behavior_unverified: 0
overrides_applied: 0
prohibition_flags: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: 'LATCH_READ_COMMAND is a placeholder constant name until galago-tools Phase 4 freezes the proto command name (source comment at server/recoveryActions.ts)'
    addressed_in: 'Phase 5'
    evidence: 'ROADMAP Phase 5 notes: "the latch-read command name is a single constant, set when galago-tools Phase 4 names it and pinned in Phase 5"; SC 5 + "a contract test that the latch-read constant is a key of the generated stack.Command oneof"'
  - truth: 'Real-encoder wire proof of the acknowledge payload and the operator-only refusal keyed on ToolType.stack'
    addressed_in: 'Phase 5'
    evidence: 'ROADMAP Phase 5 SC 5: "Activation tests pass on the generated types: a real-encoder wire test of the acknowledge payload and the latch read, and the operator-only refusal keyed on ToolType.stack"; Phase 4 scope states these are "Not provable before codegen (Phase 5)"'
human_verification:
  - test: 'Acknowledge flow end-to-end on a real STACK tool page: type a guid, open the modal, confirm (UAT test 1)'
    expected: 'Guid input born empty (never trimmed), maxLength 256; modal restates the typed guid byte-for-byte with acknowledge-specific copy and no instrument-head note; arm-inspected radios have nothing preselected; Confirm enables only on exactly "Yes"; after confirming the request succeeds and the guid input is cleared; success toast title is "STACK failure acknowledged"'
    why_human: 'Render behavior. This repo has no jsdom/RTL or browser tests; unit tests prove decision logic and send exactness and static scans pin no-Enter/no-preselect/no-timer at source, but no executable check exercises the rendered flow. IN-05 (7e4f9fd) changed how the modal resolves its spec family (by target.kind), so this render check is also the confirmation that the recovery modal still shows the declared choices'
  - test: 'Latched failure block: explicit "Read latch" click; "Use this guid" behavior; unknown-reply state (UAT test 2)'
    expected: 'One read per click (no polling); read-only result with kind/explanation and a "Raw JSON" collapsible; "Use this guid" fills the guid input and never opens the modal or sends; "No failure latched." only when the tool positively reports none; a reply the interpreter cannot read (missing reply / no meta_data) renders "Unrecognized latch reply" with raw text and the warning not to assume nothing is latched (WR-01/WR-02/IN-03); a rejecting refetch shows a "Latch read failed" toast and clears the stale result'
    why_human: 'Render behavior and visual layout; only the data path is unit-tested (latchStatus.test.ts). The unknown-state branch and the IN-03 catch branch in RunRecoverySection.tsx were added after the previous verification and have no render-level test'
  - test: 'Card stays ENABLED while a STACK step runs on the tool (UAT test 3)'
    expected: 'No instrument-state check in the card or modal; pressing "Acknowledge failure..." while the queue runs that tool yields the server refusal "A run step is running on this tool; acknowledge after it ends." as a persistent toast carrying the server text verbatim, plus an audited refusal entry in Logs'
    why_human: 'Requires a live run against a stack tool and the refusal toast visual; the server refusal is unit-proven, the card-side absence of instrument-state checks is source-scan-pinned'
  - test: 'Residual concurrency posture decision (backstop truth from 04-01, UAT test 4)'
    expected: 'Human sign-off that the residual race between two concurrent recoveryControl calls is acceptable under the same posture as the PROJECT.md Phase 1 control-race acceptance (the exact-guid check on the tool core is the real gate; no queue-level serialization added by design)'
    why_human: 'Declared backstop / non-inferable: no test asserts the absence of queue-level serialization as a property; it is an accepted-risk decision, not an observable mechanism'
---

# Phase 4: Operator-only Commands & STACK Acknowledge - Verification Report (re-verification)

**Phase Goal:** Only an operator, from the tool page, can acknowledge a STACK failure, through an explicit and audited confirmation; no protocol, script, imported file, editor or queued row can send an operator-only command.
**Verified:** 2026-10-30T06:00:00Z
**Status:** human_needed (all programmatic must-haves verified; render-level confirmation and one declared backstop decision remain with a human; UAT is still `testing`, 4 pending, none marked passed)
**Re-verification:** Yes. The prior report (commit 685c1d7) went stale after the Phase 04 code-review fix commits (34d616d, 5a7789f, 3a5cbc8, b0dcc40, fcfc0b3, 511e715, 10b9ae3, 2e5d7e5, 2205395, 5a1e317, 7e4f9fd) and Phase 03 fix 2246f41.

## Re-verification Method

`git diff 685c1d7..HEAD -- controller` touches 15 files (+174/-73). I read the full diff for server, pages, components and the static-scan test, then re-checked every truth against the current code (not the summaries). Targeted run of the six phase test files in this verification: 6 files / 212 tests passed. The orchestrator's gate: full suite 23 files / 545 tests passed (one more than the 544 at the prior verification), `tsc --noEmit` exit 0.

### Regression analysis of each fix against OPR requirements

| Fix | Change | OPR impact |
| --- | --- | --- |
| WR-01 34d616d / WR-02 5a7789f | Card renders an "Unrecognized latch reply" state for `unknown`; `tool.latchStatus` returns `{latched:false, unknown:true, raw:{}}` when reply or `meta_data` is missing | Strengthens OPR-03 (no confident false "not latched"). Still toolId-only, still `tool.executeCommand`, never `controlCommand`; display-only, does not gate the ack (D-12) |
| WR-03 3a5cbc8 | `validateRecoveryRequest` first check removed (blank tool type now falls into "does not support recovery actions", still fail-closed). Sole production caller `recoveryControl` already guards the queue state before it | OPR-01/02 intact: validator remains fail-closed on unknown tool type, undeclared action, bad param kind, undeclared param. `recoveryActions.test.ts` updated and green |
| WR-04 b0dcc40 / 511e715 | `sanitizeLogText` (new, `server/logger.ts`) flattens CR/LF/control chars on every `logAction` details composition in `recoveryControl.ts` and `command_queue.ts` | OPR-02 audit preserved: every outcome (refused, transport error, strict-success refusal, outcome) still logged; only the details text is sanitised. The send payload, params and client errors stay verbatim |
| WR-05 fcfc0b3 | `run.create` `numberOfRuns` bounded to int 1..100 | Orthogonal to OPR; the operator-only enqueue guard in `createFromProtocol` is unchanged and still runs per run. Bound is a human-confirmable product choice (flagged in the disposition) |
| IN-01 10b9ae3 | Own-property guard on `RECOVERY_STRICT_SUCCESS` lookup | Strict-success semantics unchanged for stack acknowledge; prototype keys now refuse gracefully |
| IN-02 2e5d7e5 | Dead `RunStore.nextRunId` removed | None |
| IN-03 2205395 | Rejecting `latchQuery.refetch()` caught in `readClick`, shown via toast, result cleared | Display-only; no send-path contact |
| IN-04 5a1e317 | `/api/runs` POST default branch returns generic 500 body, logs server-side; the `OperatorOnlyCommandError` case still returns 400 with its own message | OPR-04 visible refusal at creation unchanged (400 case intact at `pages/api/runs/index.ts:22-24`) |
| IN-05 7e4f9fd | `RunControlConfirmModal` resolves spec by `request.target.kind` (recovery -> `getRecoverySpec`, running -> `getActionSpec`). Card sends `kind: "recovery"` (`RunRecoverySection.tsx:135`); ControlBar/InstrumentStopModal send `kind: "running"` | The acknowledge still resolves the recovery spec; no runControl entry for acknowledge (staticScan pin still green). Render confirmation added to human item 1 |
| 2246f41 (Phase 03) | Step-card image wrapper rendered only with an image; G-03-3 static scan re-anchored | Unrelated to OPR; the scan edit is the only static-scan change since 685c1d7 and does not touch any OPR pin |

No regression found.

## Goal Achievement

### Observable Truths (ROADMAP success criteria = contract)

| # | Truth | Status | Evidence (current code) |
| --- | --- | --- | --- |
| 1 | Guid entry + explicit "yes" confirmation through `tool.recoveryControl`, sent once, never retried; blank/never-trimmed guid; no default, no timer, no Enter-bound default | VERIFIED | `recoveryControl.ts`: `isRecoveryAction` -> queue-running refusal -> `validateRecoveryRequest(toolType, action, params)` -> exactly one `tool.controlCommand(action, verdict.params)` (:90), no options/deadline/retry. `recoveryControl.test.ts` (34 tests) asserts the exact `{stack:{acknowledge_failure:{guid, arm_inspected:"yes"}}}` payload with a single call; shared validator gates the card button (`isValidRecoveryGuid`); static scans pin no-Enter/no-preselect/no-timer on card and modal. Render flow -> human item 1 |
| 2 | Every attempt audited; refused with a STACK-specific message while the queue's running step is on that tool | VERIFIED | Each refusal/transport/strict-success/outcome path calls `logAction` (now with `sanitizeLogText`, same record content, control chars flattened). Refusal text "A run step is running on this tool; acknowledge after it ends." at `recoveryControl.ts` when `getRunControl(toolType)` is undefined (stack). Tests green |
| 3 | Latched guid visible from the step-card error (Phase 3) and via explicit "Read latch" backed by toolId-only `tool.latchStatus`; "Use this guid" fills only | VERIFIED | `routers/tool.ts` `latchStatus`: `input({toolId})`, tool derived from the DB row, fixed `LATCH_READ_COMMAND` via `tool.executeCommand`, never `controlCommand`; missing reply/`meta_data` -> `unknown:true`. `.controlCommand(` callers across server/components/pages/hooks remain exactly `recoveryControl.ts:90` and `command_queue.ts:578` (single-send pin green). `latchStatus.test.ts` (21 tests) green. Render of the new unknown/error branches -> human item 2 |
| 4 | Protocol/script/imported-JSON/queued-row containing an operator-only command refused at creation with a visible message and audited again at `Tool.executeCommand`; Run Recovery path unaffected | VERIFIED | `tools.ts` instance `executeCommand`: guard is the first statement, keyed on `String(this.toolType)`, audited `stage=execute` before throw. `runs.ts` `createFromProtocol` scans `String(c.toolType)`, audits `stage=enqueue`, throws `OperatorOnlyCommandError` (in the rethrow list). Visible: tRPC BAD_REQUEST with `e.message` (`routers/run.ts`), REST 400 with message (`pages/api/runs/index.ts:22-24`). Operator path `controlCommand`/`recoveryControl` carries no guard. `operatorOnly.test.ts` (16 tests) green |
| 5 | Static scans fail the suite on drift | VERIFIED | `staticScan.test.ts` 39 tests green in this run: closed literal file set, commandFields/runControl absence, guard-placement before params and absent from `controlCommand`, `/latch/i` send-path ban, single latch reader, no-Enter card, single-send `.controlCommand(` caller pin. Only change since 685c1d7 is the Phase-03 G-03-3 re-anchor, unrelated to OPR pins |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Placeholder `LATCH_READ_COMMAND` until galago-tools freezes the proto | Phase 5 | ROADMAP Phase 5: constant "set when galago-tools Phase 4 names it and pinned in Phase 5"; GEN-04 contract test |
| 2 | Real-encoder wire test of the acknowledge payload; refusal keyed on generated `ToolType.stack` | Phase 5 | ROADMAP Phase 5 SC 5; Phase 4 scope states "Not provable before codegen (Phase 5)" |

### Required Artifacts

| Artifact | Status | Details |
| --- | --- | --- |
| `controller/server/recoveryActions.ts` | VERIFIED | Zero-import frozen spec, fail-closed validator (WR-03 simplified), strict success, `extractLatch` with `unknown` field |
| `controller/server/recoveryControl.ts` | VERIFIED | Single send, STACK message, strict-success with own-property guard, sanitised audit |
| `controller/server/operatorOnlyCommands.ts` | VERIFIED | Unchanged since 685c1d7; zero-import frozen table, own-property matcher |
| `controller/server/tools.ts` | VERIFIED | Unchanged; guard first in instance `executeCommand` |
| `controller/server/runs.ts` | VERIFIED | Enqueue scan intact; only the dead `nextRunId` field removed |
| `controller/server/routers/run.ts` | VERIFIED | `OperatorOnlyCommandError` -> BAD_REQUEST; `numberOfRuns` now bounded |
| `controller/pages/api/runs/index.ts` | VERIFIED | 400 case intact; default 500 now generic |
| `controller/server/routers/tool.ts` | VERIFIED | `latchStatus` toolId-only, `executeCommand`, unknown handling |
| `controller/server/logger.ts` | VERIFIED | New `sanitizeLogText` export, imported by `recoveryControl.ts` and `command_queue.ts` (wired) |
| `controller/components/runs/controlDecision.ts` | VERIFIED | Unchanged |
| `controller/components/runs/RunControlConfirmModal.tsx` | VERIFIED | Spec family resolved by `target.kind` (IN-05) |
| `controller/components/tools/RunRecoverySection.tsx` | VERIFIED | Guid gate via shared validator, latch block with unknown + catch branches; no onKeyDown/onSubmit |
| `controller/hooks/useRunControl.ts` | VERIFIED | Unchanged |
| `controller/test/*` (6 phase files + setup.ts) | VERIFIED | All present, substantive, green |

### Key Link Verification

All 13 links from the prior report re-checked against the current tree; none broken. New link: `recoveryControl.ts`/`command_queue.ts` -> `logger.ts#sanitizeLogText` WIRED (imported and used at every details composition). Unchanged: `recoveryControl` -> `tool.controlCommand` (single call), `tools.ts` -> `operatorOnlyCommands.ts` (guard first), `runs.ts` -> `operatorOnlyCommands.ts` (enqueue scan), `routers/tool.ts` -> `tool.executeCommand` (not `controlCommand`), `RunRecoverySection.tsx` -> `isValidRecoveryGuid` and `tool.latchStatus`.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Real Data | Status |
| --- | --- | --- | --- | --- |
| `RunRecoverySection.tsx` latch block | `latchResult` | `trpc.tool.latchStatus` -> `tool.executeCommand(LATCH_READ_COMMAND)` -> `extractLatch(meta_data)` | Yes (real tool reply; unreadable replies now surface as `unknown`, not "not latched") | FLOWING |
| `RunRecoverySection.tsx` ack send | guid | user input -> `request.params` -> `recoveryControl` -> `controlCommand` | Yes; latch never feeds the send path (scan-pinned) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase test files | `npx vitest run test/staticScan test/recoveryControl test/operatorOnly test/latchStatus test/recoveryActions test/controlDecision` | 6 files / 212 tests passed | PASS |
| Full suite (orchestrator gate, run once) | `npx vitest run` in `controller` | 23 files / 545 tests passed | PASS |
| Types (orchestrator gate) | `npx tsc --noEmit` | exit 0 | PASS |
| `.controlCommand(` callers | `grep -rn "controlCommand(" server components pages hooks` | only `recoveryControl.ts:90` and `command_queue.ts:578` (plus a comment) | PASS |

### Probe Execution

SKIPPED: Phase 04 declares no probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| OPR-01 | 04-01, 04-03 | SATISFIED | Card + modal + shared validator + exact-payload single-send test; no runControl entry added (static pin). Fixes WR-03/IN-05 did not weaken it |
| OPR-02 | 04-01 | SATISFIED | Audit at every outcome (now log-injection-safe), STACK refuse-while-running message, one send, no retry |
| OPR-03 | 04-04 | SATISFIED | `tool.latchStatus` toolId-only display-only read; "Use this guid" fills only; single reader pinned; unknown replies no longer masquerade as not-latched |
| OPR-04 | 04-02 | SATISFIED | One table, two enforcement points, visible BAD_REQUEST/400, `controlCommand` unaffected; unchanged by fixes |
| OPR-05 | 04-05 | SATISFIED | Failing-suite static scans green (39 tests) |

All five IDs declared across the plans appear in REQUIREMENTS.md and map to Phase 4. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `server/recoveryActions.ts` | ~213 | "PLACEHOLDER" comment on latch constant | Info (deferred) | Deliberate, pinned to Phase 5 per ROADMAP |
| `test/operatorOnly.test.ts` | ~301 | `scriptContent: "PLACEHOLDER"` | Info | Test fixture value, behavior unaffected |

Debt-marker scan (TBD/FIXME/XXX) across the changed files: none. All 11 review-fix commits cited by the disposition exist in `git log`.

### Human Verification Required

Four items (frontmatter; same four as UAT `04-UAT.md`, status `testing`, 4 pending, none marked passed here):
1. Acknowledge card -> modal -> confirm render flow (additionally exercises the IN-05 target.kind modal change).
2. Latch block render, Use-this-guid fill-only, plus the new unknown-reply and refetch-rejection branches from WR-01/WR-02/IN-03.
3. Card stays enabled while a STACK step runs; refusal toast.
4. Sign-off on the residual concurrency backstop posture.

Non-blocking product call for the maintainer: the WR-05 `numberOfRuns` bound of 1..100 is a human-confirmable choice noted in the review disposition; it does not affect any OPR truth.

### Gaps Summary

None. All five roadmap truths hold against the current code, and none of the review-fix commits regressed an OPR requirement; the audit, single-send, queue-refusal, operator-only enforcement and static-scan pins are intact and green. Status is `human_needed` only because no browser/RTL layer exists to confirm the rendered operator surface (including the two render branches added by the fixes) and because one declared backstop decision requires human sign-off.

---

_Verified: 2026-10-30T06:00:00Z_
_Verifier: Claude (gsd-verifier)_
