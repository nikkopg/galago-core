---
status: complete
phase: 08-concurrency-lanes
source: [08-VERIFICATION.md]
started: 2026-11-16T18:04:13Z
updated: 2026-11-17T01:19:21.491Z
---

## Current Test

[testing complete]

## Tests

### 1. Freeze lanes dialog and effect (08-09 item 1). With GALAGO_PARALLEL_LANES=1 and simulated tools, run the lane-tagged headline cycle, press Freeze lanes, check the dialog, press Enter, then press Freeze lanes again and confirm.
expected: Enter in the dialog does not freeze (lanes keep running). Confirming shows the 'Lanes frozen' badge with the freeze sentence, nothing is aborted, and Start appears.
result: pass
source: automated
note: "Automated in Chrome on the dev stack (GALAGO_PARALLEL_LANES=1, isolated uat-sim workcell, simulated STACK/F.A.S.T. tool servers on 40091/40092; real tools untouched). While FAST (lane fast) and goto-safe (primary) overlapped: the dialog's initial focus was 'Keep lanes running', Enter dismissed it and laneStatus stayed halted=false. Confirming showed the 'Lanes frozen' badge and the freeze sentence, laneStatus became halted=true/haltReason=freeze, the running FAST and goto-safe rows both ended COMPLETED (not aborted), out1/out2 stayed CREATED and Start reappeared. Start then resumed and finished out1/out2."

### 2. Failure list across lanes (08-09 item 2). Let a simulated step fail on one lane while the other lane runs.
expected: The banner keeps the first failure. 'Failures by lane (2)' lists both lanes. The Lanes panel shows the failure sentence.
result: pass
source: automated
note: "Automated: protocol with setup (primary), FAST on lane fast (barrier) and a primary STACK step with timeout_s=-1. The primary step failed with INVALID_ARGUMENTS while FAST ran; the sim F.A.S.T. server was then stopped so FAST failed with CANCELLED. Banner: first failure (INVALID_ARGUMENTS) kept as the headline; 'Failures by lane (2)' listed primary (STACK, 'First failure, shown above') and fast (F.A.S.T., '1 CANCELLED: Call cancelled'); Lanes panel showed 'Lanes frozen' with the failure sentence ('A step failed. No new steps start on any lane... A Start runs the failed step again.')."

### 3. Layout and dark mode (08-09 item 3). Widen and narrow the window and switch to dark mode on the run page.
expected: Sticky 120px label column, captions aligned under cards, badge and chips keep contrast, Freeze button wraps under the title, no flicker on partial data.
result: pass
source: user

### 4. Gantt chart under overlap (08-09 item 4). Open RunQueueGanttChart while two steps on different lanes overlap.
expected: Record how overlapping steps render (UI-SPEC unresolved row). No crash or misleading bars.
result: pass
source: automated
note: "Automated: during the overlap the Gantt chart rendered one row per tool type (fast, stack) with the FAST bar on the fast row and the stack bars on the stack row, so steps on different lanes do not draw over each other. No crash. Finding: at the default Minutes View span (several hours) the bars are thin slivers and the overlap is hard to read; per-lane timestamps on the run cards are clearer (FAST 05:36:58-05:38:18 vs goto-safe 05:36:59-05:37:34)."

### 5. 'Skip to this command' across lanes (08-09 item 5). Use Skip to this command on a card of the other lane.
expected: Record the pre-existing skipUntil behaviour (it skips every lower queue position). Confirm it does not strand or double-dispatch a lane.
result: pass
source: automated
note: "Automated: on a fresh headline run, 'Skip to this command' on the SIM-FAST card (lane fast, queue position 3) marked in1 and in2 (primary, positions 1-2) SKIPPED, as the pre-existing skipUntil does; goto-safe was not skipped. After Start the trace was FAST+goto-safe STARTED together, then goto-safe, FAST, out1, out2 COMPLETED in order. Each row started once, no lane was stranded, and the queue ended OFFLINE with no halt."

### 6. Drawer lane controls (08-10 item 1). In the visual editor edit a tool step: type a 32-character lane, then 'Fast', then clear it; toggle 'Wait for all earlier steps'; open a Tool Box step.
expected: Long name fits the input and the 120px label column. 'Fast' is stored as 'fast'. Clearing restores the 'primary' placeholder. Tool Box step shows no lane controls. The inert note shows for tool steps.
result: pass
source: automated
note: "Automated in the visual editor (Advanced Parameters section of the step drawer): a 32-character lane fills the input with no overflow (scrollWidth == clientWidth, maxLength 32) and the drawer warns 'SIM-STACK is already on lane primary. One tool can use only one lane per run.'; 'Fast' became 'fast'; clearing showed the 'primary' placeholder; the barrier switch toggled on and off; the inert note 'Lanes take effect only when parallel lanes are enabled on the server.' showed for the tool step; a Tool Box note drawer (including expanded Advanced Parameters) had no Lane input, barrier switch or inert note. The 32-char name inside the run-page 120px label column was not rendered (folded into test 3)."

### 7. Lane summary and refusal copy (08-10 item 2). Save a lane-tagged protocol and read the Lane summary. Put a Tool Box note on lane 'fast' via JSON import.
expected: Summary shows first-appearance order, barrier suffixes and global positions. The refusal sentence shows in the warning Alert and saving still works.
result: pass
source: automated
note: "Automated: the Lane summary for the headline protocol listed 'Lane primary - 5 steps' (1, 2, 4, 5 with ' - waits for all earlier steps', 6) then 'Lane fast - 1 step' (3 with the barrier suffix). JSON Import (real file-input code path) of a protocol with a Tool Box note on lane 'fast' showed the warning Alert 'Step 2 (note) is on lane fast, but only tool steps can run on a secondary lane. Move it to the primary lane.', the 'Protocol updated' toast, and a later edit-mode Save persisted (updated_at moved, lane tag kept)."

### 8. Script preview with and without the flag, and the env flag in Docker (08-10 item 3, assumption A1). Preview a script using galago.lane('fast') once with GALAGO_PARALLEL_LANES unset and once set to 1 in the dev compose environment after restarting the controller.
expected: Unset: 'Lane tags ignored: parallel lanes disabled'. Set: grouped Generated Commands, commandQueue.laneStatus reports laneMode true, and the run page shows the Lanes panel.
result: pass
source: automated
note: "Automated: with GALAGO_PARALLEL_LANES=1 (container recreated via docker compose), commandQueue.laneStatus reported laneMode true, the run page showed the Lanes panel, and Preview of a script using galago.lane('fast') showed Generated Commands grouped as Lane primary (1, 3) and Lane fast (2, '- waits for all earlier steps'). After recreating the container with the flag unset, laneStatus reported laneMode false and Preview showed the warning Alert 'Lane tags ignored: parallel lanes disabled' (the commands list is still grouped by lane underneath)."

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
