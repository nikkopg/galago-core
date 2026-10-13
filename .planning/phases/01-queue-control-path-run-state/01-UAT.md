---
status: testing
phase: 01-queue-control-path-run-state
source: [01-VERIFICATION.md]
started: 2026-10-13T03:20:00Z
updated: 2026-10-13T03:20:00Z
---

## Current Test

number: 1
name: Decide on WR-01 (toolControl does not re-check the running step before sending)
expected: |
  A deliberate decision recorded: fix now, defer to Phase 2, or accept the risk. Today a Pause, Resume or Abort that was validated against one step can reach, or be logged against, the next step if the busy loop moves on during the gRPC round trip.
awaiting: user response

## Tests

### 1. Decide on WR-01 (toolControl does not re-check the running step before sending)
expected: A deliberate decision recorded: fix now, defer to Phase 2, or accept the risk. The source is `controller/server/command_queue.ts:429-495`, where no identity re-check happens before `await tool.controlCommand(...)`.
result: [pending]

### 2. Decide on WR-02 (RunStateMonitor's in-flight guard is cleared without checking the generation)
expected: A deliberate decision recorded. The one-line fix (`if (generation === this.generation) { this.inFlight = false; }`) is proposed in 01-REVIEW.md. The impact is limited to read-only run-state staleness.
result: [pending]

### 3. Confirm "galago-core performs no instrument-state check" (plan 01-02, D-04)
expected: The decision path in toolControl reads only `this._runningStep` and `runControl`/`validateControlRequest` before sending. No `Tool.status`, run state or tool reply field gates the send.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
