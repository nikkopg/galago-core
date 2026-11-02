---
phase: 04-operator-only-commands-stack-acknowledge
plan: 06
subsystem: ui
tags: [gap-closure, recovery-card, lint-gate, production-build, latch, raw-json, static-scan]
requires:
  - phase: 04-operator-only-commands-stack-acknowledge
    provides: "04-04 latch card (RunRecoverySection.tsx), 04-01 recoveryActions spec (isRecoveryAction), 04-05 static scans"
provides:
  - "Production build lint gate passes (next lint clean, clean-checkout image build succeeds)"
  - "STACK Run Recovery card renders no Resume/Abort; F.A.S.T. card unchanged; visibility derived from isRecoveryAction"
  - "LatchRawJson: one bounded, collapsed-by-default raw latch panel for both latched and unrecognized replies"
  - "Two static-scan blocks (G-04-6, G-04-2) and amended 04-UI-SPEC.md"
affects: [04-07, verify-work, phase-4-gate]
actuals:
  tokens: 6000
  tasks: 3
  commits: 7
tech-stack:
  added: []
  patterns:
    - "UI copy containing an apostrophe lives in a JS string constant (react/no-unescaped-entities does not inspect JS strings)"
    - "Button visibility derived from the recovery spec (isRecoveryAction), never a hard-coded tool type"
    - "Bounded raw renderer: w=0px + minW=100% + maxH=160px + overflowY=auto"
key-files:
  created: []
  modified:
    - controller/components/tools/RunRecoverySection.tsx
    - controller/test/staticScan.test.ts
    - .planning/phases/04-operator-only-commands-stack-acknowledge/04-UI-SPEC.md
key-decisions:
  - "G-04-5 fixed with a GUID_BLANK_HINT JS string constant, not &apos;, so rendered text and the controlDecision copy pin stay unchanged"
  - "No lint script added to package.json (would invalidate the Docker npm ci layer); next lint --no-cache --quiet is the recorded gate command"
  - "STACK Resume/Abort hidden (not greyed) because STACK does not declare them; no state-based disabling (D-09)"
  - "Raw panel font is 14px (fontSize=sm), inside the UI-SPEC closed size set; the old 12px was outside it"
requirements-completed: [OPR-01, OPR-03]
plan_head_before: f50fa9ad95fc1829d9964a11362af6130540fa3b
plan_head_after: 002d590d9dcdf0e20d790ae39b132b4854e90c8c
commits: 7
status: complete
completed: 2026-10-30
duration: 6 min
---

# Phase 04 Plan 06: Recovery card gap closure Summary

**The Run Recovery card now passes the production lint gate (guid hint as a JS string constant), shows Resume/Abort only where the tool's recovery spec declares them (none on STACK), and renders raw latch replies of both kinds in one bounded 160px scrolling collapsible that cannot resize the card.**

## Performance

- **Duration:** 6 min
- **Tasks:** 3 (1 tracer + 2 auto/tdd)
- **Files modified:** 3
- **Commits:** 7 (3 test/fix/docs triples minus one: Task 1 is a single fix commit)

## Accomplishments

- **G-04-5 (blocker):** `next lint` exits 0; a clean `git archive` image build of the committed tree succeeds under project `galago-buildcheck` (twice: after Task 1 and at the phase gate), including "Linting and checking validity of types".
- **G-04-6:** `showResume`/`showAbort` come from `isRecoveryAction(toolType, ...)`; the ButtonGroup is wrapped in `(showResume || showAbort)`; STACK description is now "Read the failure latched on this tool and acknowledge it."; F.A.S.T. sentence and `isDisabled={disabled}` unchanged.
- **G-04-2:** `LatchRawJson` is the single raw renderer for the unknown and latched branches; `readClick` resets `rawOpen`; the unrecognized heading and warning render without expanding.
- UI-SPEC amended for both gaps (G-04-6 x3 lines, G-04-2 x6 lines).

## Task Commits

1. Task 1 (tracer, G-04-5): `22fd0c2` fix(04-06): render the guid hint from a string constant so next build lint passes (G-04-5)
2. Task 2 (G-04-6): `a9561b9` test (RED), `a4375d9` fix (GREEN), `6cab638` docs
3. Task 3 (G-04-2): `012f890` test (RED), `2cfce65` fix (GREEN), `002d590` docs

## TDD / RED evidence

- **Task 1 RED (lint, run before the edit):** `npx next lint --no-cache --quiet` exit 1:
  `./components/tools/RunRecoverySection.tsx  268:82  Error: ' can be escaped with &apos;, &lsquo;, &#39;, &rsquo;.  react/no-unescaped-entities` (exactly one error). GREEN: `No ESLint warnings or errors`, exit 0.
- **Task 2 RED:** `staticScan.test.ts` showed exactly 2 failing (the two new G-04-6 cases: first on the missing `showResume` declaration, second on the missing new STACK sentence), 39 others passing. GREEN: all pass.
- **Task 3 RED:** exactly 2 failing (the two new G-04-2 cases: `LatchRawJson` renderer region empty; `readClick` lacks `setRawOpen(false)`), 41 others passing. GREEN: all pass.
- semanticAssessment: each RED failed on the planned assertion (missing planned behavior in the card source), not on load/syntax/discovery errors. The plan is `type: execute`, so the `tdd-red-evidence` classifier was not required; evidence is the vitest output above.

## Gate results (phase gate, after the last commit)

| Gate | Result |
|------|--------|
| `npm run test:unit` | 23 test files, 549 tests, all passing (545 baseline + 4 new) |
| `npx tsc --noEmit` | clean |
| `npx next lint --no-cache --quiet` | exit 0 |
| prettier on RunRecoverySection.tsx, staticScan.test.ts | clean |
| `git diff 37581c6` of controlDecision.test.ts, latchStatus.test.ts, recoveryActions.ts | no diff |
| `git diff --numstat 37581c6` staticScan.test.ts | 107 added, 0 deleted |
| UI-SPEC `G-04-6` / `G-04-2` line counts | 3 / 6 (need >= 3 / >= 4) |
| Clean image build (`git archive HEAD` + `docker compose -p galago-buildcheck build galago-web`) | success twice, BUILD_EXIT=0; image removed after each; running galago-web container untouched |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking/format] Prettier line-breaks the GUID_BLANK_HINT declaration**
- **Found during:** Task 1
- **Issue:** The sentence exceeds the 100-column print width, so `prettier --check` (a task verify) forces `const GUID_BLANK_HINT =` onto its own line. The acceptance grep `grep -c 'const GUID_BLANK_HINT = '` (with trailing space) therefore prints 0 instead of 1.
- **Fix:** Kept prettier-clean formatting (required by the verify command); `grep -c 'const GUID_BLANK_HINT ='` prints 1. Intent of the criterion (single constant holding the sentence once) is met: the sentence appears once, `{GUID_BLANK_HINT}` once.
- **Files modified:** controller/components/tools/RunRecoverySection.tsx
- **Commit:** 22fd0c2

**2. [Rule 3 - Format] Prettier reflowed the guarded JSX hint to one line and the new import to a multi-line block**
- Cosmetic only; no behavior change. Covered by the same commits.

**Total deviations:** 1 substantive-format note (no behavior change). **Impact:** none on rendered output or any pin.

## Known Stubs

None.

## Threat Flags

None. Mitigations T-04-18 (bounded raw panel), T-04-19 (no `dangerouslySetInnerHTML`, scan-pinned), T-04-20 (spec-derived buttons, scan-pinned), T-04-21 (lint gate + clean image build) are implemented as planned.

## Open human check (for /gsd-verify-work)

UAT tests 2, 5 and 6 retest remain open: run `docker compose up -d --build galago-web` (operator decision; the executor did not touch the running container), use the fake-ToolDriver STACK rig, and confirm per the Task 3 `<human-check>`: STACK card has no Resume/Abort and the new description; unknown (~3 KB) and latched replies keep card width at the pre-read width (761px in the UAT rig) with Raw JSON closed and open; panel is at most 160px tall with its own scroll; each Read latch starts collapsed; "Use this guid" only fills the input. No real STACK or F.A.S.T. was connected or commanded.

## Self-Check: PASSED

- Files present: RunRecoverySection.tsx, staticScan.test.ts, 04-UI-SPEC.md, this SUMMARY
- Commits present on HEAD: 22fd0c2, a9561b9, a4375d9, 6cab638, 012f890, 2cfce65, 002d590
- Measured `git rev-list --count f50fa9a..HEAD` = 7 at SUMMARY write
