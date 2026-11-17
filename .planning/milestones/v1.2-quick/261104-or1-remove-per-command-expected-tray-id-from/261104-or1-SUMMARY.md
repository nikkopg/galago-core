---
phase: quick-261104-or1
plan: 01
subsystem: controller/tools
tags: [fast, transfer, commandFields, expected_tray_id, todo]
requires: []
provides:
  - "commandFields.fast.transfer with 12 fields and no per-command tray override"
  - "Legacy-step wire regression test for saved transfer steps carrying expected_tray_id"
affects: [controller/components/tools/constants.ts]
tech-stack:
  added: []
  patterns: ["D-20 legacy-step pass-through (no stripping or migration)"]
key-files:
  created: []
  modified:
    - controller/components/tools/constants.ts
    - controller/test/commandFields.test.ts
    - controller/test/wire.test.ts
    - .planning/todos/completed/2026-10-15-evaluate-whether-expected-tray-id-is-still-needed.md
decisions:
  - "Todo resolved as option 2: operator confirmed a missing expected tray id does not block a run, so the per-command override is redundant with the tool Config value. Vendor adapter, tray gate and generated interfaces untouched."
metrics:
  tasks: 2
  files: 4
  tests: "tsc exit 0; vitest 28 files, 610 tests passed (608 baseline + 2)"
completed: 2026-11-04
status: complete
commits: 2
plan_head_before: 26e4e7dd2d2bc23fdc0bbac745ba732e27238e90
plan_head_after: d85f9928d22e1910de3599020ad6dc93804ee9b5
actuals:
  tokens: 4000
  tasks: 2
  commits: 2
---

# Phase quick-261104-or1 Plan 01: Remove per-command expected_tray_id from F.A.S.T. Transfer Summary

Dropped the per-command `expected_tray_id` input from `commandFields.fast.transfer` (12 fields remain), pinned the field list and the legacy saved-step wire encoding with two new tests, and resolved the todo as option 2.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Drop the per-command tray override from the Transfer form; pin field list and legacy step | 0f91bcd |
| 2 | Resolve the expected-tray-id todo as option 2 (git mv to completed/, Resolution added) | d85f992 |

## Verification

- RED: the new `commandFields.fast.transfer (261104-or1)` test failed against the old file (extra 13th name `expected_tray_id`), then passed after removal.
- awk-scoped check of the `fast:` block: 0 occurrences of `expected_tray_id`.
- `git diff --quiet -- vendor/galago-tools controller/gen-interfaces`: exit 0.
- `npm --prefix controller test` (tsc --noEmit): exit 0.
- `npm --prefix controller run test:unit`: 28 files passed, 610 tests passed.
- Todo: pending copy gone, one `## Resolution` heading, recorded as a rename.

## Deviations from Plan

The Task 2 commit initially staged only the rename (a `git add` on the already-moved pending path failed), leaving the Resolution text unstaged. Caught immediately via `git status`; amended my own unpushed commit to include it (d85f992). No other deviations.

## Known Stubs

None.

## Threat Flags

None. No new surface; vendor submodule and generated interfaces untouched (T-or1-01), no param stripping added (T-or1-02).

## Self-Check: PASSED

- constants.ts, commandFields.test.ts, wire.test.ts, completed todo: present.
- Commits 0f91bcd and d85f992 are ancestors of HEAD.
