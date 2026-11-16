---
status: testing
phase: 08-concurrency-lanes
source: [08-VERIFICATION.md]
started: 2026-11-16T18:04:13Z
updated: 2026-11-16T18:04:13Z
---

## Current Test

number: 1
name: Freeze lanes dialog and effect (08-09 item 1). With GALAGO_PARALLEL_LANES=1 and simulated tools, run the lane-tagged headline cycle, press Freeze lanes, check the dialog, press Enter, then press Freeze lanes again and confirm.
expected: |
  Enter in the dialog does not freeze (lanes keep running). Confirming shows the 'Lanes frozen' badge with the freeze sentence, nothing is aborted, and Start appears.
awaiting: user response

## Tests

### 1. Freeze lanes dialog and effect (08-09 item 1). With GALAGO_PARALLEL_LANES=1 and simulated tools, run the lane-tagged headline cycle, press Freeze lanes, check the dialog, press Enter, then press Freeze lanes again and confirm.
expected: Enter in the dialog does not freeze (lanes keep running). Confirming shows the 'Lanes frozen' badge with the freeze sentence, nothing is aborted, and Start appears.
result: [pending]

### 2. Failure list across lanes (08-09 item 2). Let a simulated step fail on one lane while the other lane runs.
expected: The banner keeps the first failure. 'Failures by lane (2)' lists both lanes. The Lanes panel shows the failure sentence.
result: [pending]

### 3. Layout and dark mode (08-09 item 3). Widen and narrow the window and switch to dark mode on the run page.
expected: Sticky 120px label column, captions aligned under cards, badge and chips keep contrast, Freeze button wraps under the title, no flicker on partial data.
result: [pending]

### 4. Gantt chart under overlap (08-09 item 4). Open RunQueueGanttChart while two steps on different lanes overlap.
expected: Record how overlapping steps render (UI-SPEC unresolved row). No crash or misleading bars.
result: [pending]

### 5. 'Skip to this command' across lanes (08-09 item 5). Use Skip to this command on a card of the other lane.
expected: Record the pre-existing skipUntil behaviour (it skips every lower queue position). Confirm it does not strand or double-dispatch a lane.
result: [pending]

### 6. Drawer lane controls (08-10 item 1). In the visual editor edit a tool step: type a 32-character lane, then 'Fast', then clear it; toggle 'Wait for all earlier steps'; open a Tool Box step.
expected: Long name fits the input and the 120px label column. 'Fast' is stored as 'fast'. Clearing restores the 'primary' placeholder. Tool Box step shows no lane controls. The inert note shows for tool steps.
result: [pending]

### 7. Lane summary and refusal copy (08-10 item 2). Save a lane-tagged protocol and read the Lane summary. Put a Tool Box note on lane 'fast' via JSON import.
expected: Summary shows first-appearance order, barrier suffixes and global positions. The refusal sentence shows in the warning Alert and saving still works.
result: [pending]

### 8. Script preview with and without the flag, and the env flag in Docker (08-10 item 3, assumption A1). Preview a script using galago.lane('fast') once with GALAGO_PARALLEL_LANES unset and once set to 1 in the dev compose environment after restarting the controller.
expected: Unset: 'Lane tags ignored: parallel lanes disabled'. Set: grouped Generated Commands, commandQueue.laneStatus reports laneMode true, and the run page shows the Lanes panel.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
