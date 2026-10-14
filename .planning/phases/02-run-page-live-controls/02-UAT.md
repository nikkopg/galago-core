---
status: partial
phase: 02-run-page-live-controls
source: [02-VERIFICATION.md]
started: 2026-10-13T21:16:40Z
updated: 2026-10-14T10:10:22.539Z
---

## Current Test

[testing complete]

## Tests

### 1. Run galago-web against a simulated F.A.S.T. and, during a transfer on the run page, confirm the control bar sits between the Gantt chart and the Runs List card and shows tool, command, state badge and progress
expected: Bar renders in the correct position with correct content; bar and queue lists do not flicker against each other (Pitfall 9)
result: pass

### 2. During the same transfer, click Pause instrument, Resume instrument and Abort instrument run; try Enter and Esc while the confirm is open
expected: Each opens a confirmation whose Yes/No starts unselected and whose Confirm stays disabled until chosen; Enter and Esc never confirm (only Cancel/Esc/overlay dismiss, which sends nothing)
result: issue
reported: "i got Action refused Tool replied UNRECOGNIZED_COMMAND"
severity: major

### 3. Click 'Pause queue' during the transfer
expected: Opens 'Abort Instrument Run' with a Return-liquid Yes/No choice, no countdown, Abort disabled until chosen
result: pass
note: "galago-web log 09:11:43 abort {return_liquid: yes} SUCCESS, then queue stopped 09:12:10 with no further step run"

### 4. Open the F.A.S.T. tool page while the transfer is running
expected: The Run Recovery card is visible and disabled, with the 'A run step is tracking this tool; use the run page.' text and a working link to /runs
result: pass

### 5. Trigger a real or simulated instrument pause (e.g. deck 3 empty) during a run
expected: The tool_paused prompt opens within about 2 s showing 'WrongPlateType (-645)' (or the real reason), the plain-language detail, and the local start time; it closes on resume or step end without blocking the queue
result: blocked
blocked_by: prior-phase
reason: "check my last run, nothing shows when error, is it because the galago-tools hasnt been updated yet? — running galago-tools servers started 2026-10-12 13:15, before the wait-through-pauses/run_state/Pause adapter work (galago-tools commits 2026-10-13); the paused transfer failed immediately with ERROR_FROM_TOOL (WrongPlateType -645) so no step stayed open. Unblocks after galago-tools Phase 3 deploy."

### 6. Trigger the stale-confirm-closes scenario: open Resume/Abort (bar, prompt, or Stop flow) just as the step the confirm was opened for resumes or ends
expected: The open confirm closes itself and shows exactly one 'Confirmation closed' toast; nothing is sent
result: pass
note: "galago-web log 09:58-09:59 simulated run: no Tool Control entry, step ended normally"

### 7. Reopen a confirm modal (any action) after cancelling or confirming a previous one
expected: Both the modal body and (for Resume/Abort) the radio buttons render fresh/unchecked every time
result: pass

### 8. Trigger a refusal (e.g. send Resume while the tool is not paused) and a transport error
expected: A persistent, closable 'Action refused' toast appears carrying the core's message verbatim, with no auto-dismiss and no retry; percent/state badge only change on the next poll, never optimistically
result: pass
note: "Refusal half verified on the Test 2 UNRECOGNIZED_COMMAND toast (persistent, closable, sent once per log). Transport-error half not exercised (would require stopping the tool server mid-run)."

## Summary

total: 8
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 1

## Gaps

- truth: "Each opens a confirmation whose Yes/No starts unselected and whose Confirm stays disabled until chosen; Enter and Esc never confirm (only Cancel/Esc/overlay dismiss, which sends nothing)"
  status: failed
  reason: "User reported: i got Action refused Tool replied UNRECOGNIZED_COMMAND"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
