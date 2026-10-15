---
status: complete
phase: 02-run-page-live-controls
source: [02-VERIFICATION.md]
started: 2026-10-13T21:16:40Z
updated: 2026-10-15T03:01:29.840Z
---

## Current Test

[testing complete]

## Tests

### 1. Run galago-web against a simulated F.A.S.T. and, during a transfer on the run page, confirm the control bar sits between the Gantt chart and the Runs List card and shows tool, command, state badge and progress
expected: Bar renders in the correct position with correct content; bar and queue lists do not flicker against each other (Pitfall 9)
result: pass

### 2. During the same transfer, click Pause instrument, Resume instrument and Abort instrument run; try Enter and Esc while the confirm is open
expected: Each opens a confirmation whose Yes/No starts unselected and whose Confirm stays disabled until chosen; Enter and Esc never confirm (only Cancel/Esc/overlay dismiss, which sends nothing)
result: pass
note: "Re-run 2026-10-15 after galago-tools redeploy (servers restarted 2026-10-14 17:39) and galago-web rebuild with review/styling fixes."

### 3. Click 'Pause queue' during the transfer
expected: Opens 'Abort Instrument Run' with a Return-liquid Yes/No choice, no countdown, Abort disabled until chosen
result: pass
note: "galago-web log 09:11:43 abort {return_liquid: yes} SUCCESS, then queue stopped 09:12:10 with no further step run"

### 4. Open the F.A.S.T. tool page while the transfer is running
expected: The Run Recovery card is visible and disabled, with the 'A run step is tracking this tool; use the run page.' text and a working link to /runs
result: pass

### 5. Trigger a real or simulated instrument pause (e.g. deck 3 empty) during a run
expected: The tool_paused prompt opens within about 2 s showing 'WrongPlateType (-645)' (or the real reason), the plain-language detail, and the local start time; it closes on resume or step end without blocking the queue
result: pass
note: "Re-run 2026-10-15 against the redeployed galago-tools (wait-through-pauses); prompt opened on the instrument pause and closed on Resume (log: resume SUCCESS on F.A.S.T queueId 92 at 02:40)."

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

### 9. With no run in progress, stop the F.A.S.T. tool server (port 40001), then on the F.A.S.T. tool page use Run Recovery → Abort (pick Return liquid) and confirm
expected: A persistent, closable 'Action refused' toast appears carrying the connection error; nothing is retried and the bar does not change optimistically (transport-error half of Test 8, added from re-verification 2026-10-15)
result: pass
note: "galago-web log 2026-10-15 03:00:52 Tool Recovery Control Failed: abort {return_liquid: yes} transport error 14 UNAVAILABLE ECONNREFUSED 172.17.0.1:40001 — single attempt, no retry; user saw the Action refused toast."

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

