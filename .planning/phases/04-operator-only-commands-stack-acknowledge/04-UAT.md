---
status: complete
phase: 04-operator-only-commands-stack-acknowledge
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md]
started: 2026-10-29T12:00:00.000Z
updated: 2026-10-30T00:52:30.729Z
---

## Current Test

[testing complete]

## Automation setup

Automated on 2026-10-30 (session time UTC 2026-10-29T23:08–23:20). The `galago-web` container predated
the Phase 04 fix commits and its rebuild failed (see test 5), so the UI ran from `next dev -p 3011` on a
scratch copy of the current `controller/` tree (HEAD cb8fbfe) with a fresh DB: workcell "UAT Cell", tool
`stack_uat` (type `stack`, localhost:7777), protocol 1 = one `transfer` step on `stack_uat`, protocol 2 =
one `acknowledge_failure` step. A fake ToolDriver gRPC server on :7777 logged every ExecuteCommand and
replied per a mode file (success / latched / none / unknown / delay). Driven through headless Chrome over
CDP (real mouse/keyboard input events). Note: every STACK payload reached the fake tool as an empty
Command `{}` — `ToolType.stack` is not generated until Phase 5, so wire content is Phase 5's to prove.
The tool page also shows the pre-Phase-5 "Invalid Tool Type" banner (no commandFields for stack).

## Tests

### 1. Acknowledge flow end-to-end
expected: No trim, maxLength 256, no auto-submit, single send-flight only, verbatim guid restatement,
  born-empty non-defaulted radios, guid clears after acceptance, ack-specific toast.
result: pass
source: automated
evidence: "Guid input born empty, maxLength=256, not inside a form; a 300-char paste kept 256. ' UAT-guid-42' (leading space) kept verbatim and Acknowledge stayed disabled; 'UAT-guid-42' enabled it. Enter in the input opened nothing. Modal header 'Acknowledge STACK failure', body restates guid \"UAT-guid-42\" byte-for-byte, no instrument-head note; initial focus on Cancel; Yes/No radios both unchecked, Confirm disabled; No -> still disabled; Yes -> enabled; Enter did not confirm. Three synchronous Confirm clicks -> exactly ONE ExecuteCommand at the tool; modal closed, 'STACK failure acknowledged' success toast, guid input cleared. Audit: 'Tool Recovery Control ... decisions={guid:UAT-guid-42, arm_inspected:yes} outcome=SUCCESS'."

### 2. Latch block
expected: Explicit "Read latch" click (no polling, no timers); result shows guid (selectable) /
  kind + explanation / raw JSON collapsible / "No failure latched" when none; "Use this guid" fills the
  guid input and never sends; a gated chip/button state is unaffected by the read result (display only).
result: issue
source: automated
reported: "Automated check: latched reply -> guid (user-select:text), kind, explanation, 'Raw JSON' collapsible; one ExecuteCommand per click, none in the following 10s (no polling); 'Use this guid' filled the input verbatim with zero sends and no modal; empty reply -> 'No failure latched'; unreadable reply -> 'Unrecognized latch reply' with warning; a rejecting read -> 'Latch read failed' toast and the stale result cleared; Acknowledge enabled state followed only the guid input. BUT in the unknown state the raw reply is printed inline, not in the collapsible (contradicts T-04-12 'unknown shapes land in the collapsible'): a ~3 KB reply stretched the card from 761px to 1226px wide and ~940px tall. A latched reply's long one-line Raw JSON also widened the card (761 -> 821px)."
severity: minor

### 3. Card stays enabled while a STACK step runs
expected: With a STACK step running on that tool, the recovery card's buttons are NOT greyed
  (no run-state check exists); clicking "Acknowledge failure…" gets a persistent "Action refused" toast
  with the server message ("A run step is running on this tool; acknowledge after it ends.") and an
  audited refusal entry in Logs; the run-page Stop/Clear All act on the queue directly (no abort-first
  dead-end for stack).
result: pass
source: automated
evidence: "With protocol 1's transfer step in flight (fake tool holding 40s): Resume/Abort/Read latch enabled, Acknowledge enabled once a guid was typed. Confirm -> persistent 'Action refused' toast 'A run step is running on this tool; acknowledge after it ends.' (still shown after 10s), guid kept, no ExecuteCommand reached the tool. Logs: 'Tool Recovery Control Refused ... outcome=refused: PRECONDITION_FAILED A run step is running on this tool; acknowledge after it ends.' Runs page with a running stack step: 'Pause queue' -> STOPPED with no modal; 'Clear All' -> queue empty, no modal, no abort-first dead-end."

### 4. Backstop sign-off — residual concurrency posture
expected: Two overlapping acknowledge attempts are each audited, sent at most once apiece, and nothing in
  the client serializes them — the tool core's exact-guid + arm-inspected check remains the real gate;
  user accepts this posture per the Phase-1 control-race precedent (PROJECT.md).
result: pass
source: user

### 5. Cold Start Smoke Test — production build
expected: Rebuilding the production image from the current tree (`docker compose up -d --build galago-web`) succeeds and the app starts.
result: issue
source: automated
reported: "Automated check: `next build` fails at 'Linting and checking validity of types': ./components/tools/RunRecoverySection.tsx 268:82 Error: `'` can be escaped with `&apos;` ... react/no-unescaped-entities (the \"failed step's error\" copy, from 66b6ee3 / 04-03). The running galago-web container is therefore still the pre-Phase-04-fix image (created 2026-10-29 11:35 +0700); Phase 04 cannot ship to the production container."
severity: blocker

### 6. STACK card offers only STACK's declared actions
expected: A STACK tool's Run Recovery card does not present actions STACK does not declare (recoveryActions.stack = acknowledge_failure only; stack resume/abort are refused server-side).
result: issue
source: automated
reported: "Automated check: the STACK card shows enabled Resume and Abort buttons (and the copy says 'or resume/abort an instrument run'); clicking Resume opens 'Resume Instrument — This action is not available for this tool.' with Confirm disabled. Fail-safe (nothing can be sent) but they are dead-end controls on the STACK page."
severity: minor

### 7. Operator-only refusal at run creation is a client error
expected: Creating a run from a protocol containing an operator-only step is refused with its own message as a 400 / tRPC BAD_REQUEST (OPR-04, verification truth 4).
result: issue
source: automated
reported: "Automated check: the message is correct and audited ('Operator-Only Command Refused ... stage=enqueue') and REST POST /api/runs returns 400, BUT tRPC run.create returns HTTP 500 INTERNAL_SERVER_ERROR (raw OperatorOnlyCommandError, stack trace in the body) instead of BAD_REQUEST — the router's `e instanceof OperatorOnlyCommandError` branch did not match on the live server (next dev). operatorOnly.test.ts asserts BAD_REQUEST at the unit level, so the live path diverges from the test."
severity: minor

## Summary

total: 7
passed: 3
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-04-2
  truth: "An unrecognized latch reply's raw text renders inside the bounded Raw JSON collapsible, and raw JSON never resizes the card"
  status: failed
  reason: "Automated UAT: unknown-state raw is printed inline (not collapsible); a ~3 KB reply grew the card to 1226px wide / ~940px tall; a latched reply's long Raw JSON line widened the card 761 -> 821px"
  severity: minor
  test: 2
  artifacts: []
  missing: []

- gap_id: G-04-5
  truth: "The production image builds from the current tree (next build lint/type gate passes)"
  status: failed
  reason: "Automated UAT: next build fails — RunRecoverySection.tsx 268:82 react/no-unescaped-entities (unescaped ' in \"failed step's error\")"
  severity: blocker
  test: 5
  artifacts: []
  missing: []

- gap_id: G-04-6
  truth: "A STACK tool's Run Recovery card shows no Resume/Abort controls (STACK declares only acknowledge_failure)"
  status: failed
  reason: "Automated UAT: enabled Resume/Abort on the STACK card open a 'This action is not available for this tool.' modal with Confirm disabled"
  severity: minor
  test: 6
  artifacts: []
  missing: []

- gap_id: G-04-7
  truth: "tRPC run.create maps OperatorOnlyCommandError to BAD_REQUEST with the refusal's own message"
  status: failed
  reason: "Automated UAT: live tRPC run.create returned HTTP 500 INTERNAL_SERVER_ERROR with the raw error; REST /api/runs returned 400 correctly"
  severity: minor
  test: 7
  artifacts: []
  missing: []
