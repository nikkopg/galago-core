---
status: complete
phase: 05-stack-codegen-command-forms
source: [05-VERIFICATION.md]
started: 2026-11-02T04:25:00Z
updated: 2026-11-02T05:14:44.639Z
---

## Current Test

[testing complete]

## Tests

### 1. STACK tool Config editing on the tool page
expected: The four generated Config keys render via the generic heuristics (host → IP input, port → number) and the edit saves.
result: pass

### 2. Reply meta_data panel during a real STACK read
expected: Born hidden before any send; after a completed send the "Reply meta_data" heading with the bounded read-only JSON (or the muted "No reply data returned." line) appears under the Send button; each new send collapses and replaces the panel.
result: pass

### 3. Born-empty render on STACK command fields
expected: Untouched refresh/timeout_s fields render empty (no painted 0/false); typed values render as typed; typed-then-cleared values return to empty.
result: pass
source: automated
note: Headless-Chrome harness against the live tool page (/tmp/opencode/uat). Transfer: 11 text fields + timeout_s all born empty; typed values render as typed; cleared values return to empty. List devices: refresh born empty (no painted false).

### 4. CR-01/WR-01 UAT sentinel (live form)
expected: Typed `false` in a STACK refresh field sends a payload that decodes as real `false` on the wire; a typed-then-cleared timeout_s is absent from the payload; no NaN reaches the wire.
result: pass
source: automated
note: tRPC runCommand request bodies captured in the harness; corroborated by server logs (list_devices Params:"refresh":false; transfer Params:"step_key":"sim" only — cleared timeout_s dropped, no NaN). Blank-payload transfer refused by the tool server's own argument rules (needsInput), so zero motion was attempted.

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
