---
phase: 04-operator-only-commands-stack-acknowledge
verified: 2026-10-30T11:15:00Z
status: passed
score: 17/18 must-haves verified
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
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-06-PLAN.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-06-SUMMARY.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-07-PLAN.md
  - .planning/phases/04-operator-only-commands-stack-acknowledge/04-07-SUMMARY.md
  - controller/components/runs/RunControlConfirmModal.tsx
  - controller/components/runs/controlDecision.ts
  - controller/components/tools/RunRecoverySection.tsx
  - controller/pages/api/runs/index.ts
  - controller/server/command_queue.ts
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
  - controller/test/runCreateReload.test.ts
  - controller/test/staticScan.test.ts
covered_digest: "v3:sha256:fa534233173ddaa2ffe089ec1bdb171440f4be704f38e1fa8f7d40158d4b9e60"
behavior_unverified: 1
overrides_applied: 0
prohibition_flags: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "G-04-5 production build lint gate (RunRecoverySection.tsx react/no-unescaped-entities)"
    - "G-04-6 STACK card showed dead-end Resume/Abort"
    - "G-04-7 tRPC run.create 500 instead of BAD_REQUEST after a next dev recompile"
    - "G-04-2 unrecognized/latched raw latch reply unbounded (code side; layout retest is a human item)"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: 'LATCH_READ_COMMAND is a placeholder constant name until galago-tools Phase 4 freezes the proto command name (source comment at server/recoveryActions.ts)'
    addressed_in: 'Phase 5'
    evidence: 'ROADMAP Phase 5 notes: "the latch-read command name is a single constant, set when galago-tools Phase 4 names it and pinned in Phase 5"; SC 5 + "a contract test that the latch-read constant is a key of the generated stack.Command oneof"'
  - truth: 'Real-encoder wire proof of the acknowledge payload and the operator-only refusal keyed on ToolType.stack'
    addressed_in: 'Phase 5'
    evidence: 'ROADMAP Phase 5 SC 5: "Activation tests pass on the generated types: a real-encoder wire test of the acknowledge payload and the latch read, and the operator-only refusal keyed on ToolType.stack"; UAT automation note: every STACK payload reached the fake tool as an empty Command {} because ToolType.stack is not generated until Phase 5'
advisory:
  - finding: "WR-01 (04-REVIEW): enqueue-time 'Operator-Only Command Refused' audit line (runs.ts) and tools.ts:417 interpolate toolId/command without sanitizeLogText (log forging via stored protocol JSON)"
    category: security
    reason: "Audit record is still written on every refusal; only the details text is unsanitised. Open in 04-REVIEW-DISPOSITION.md. Fix: wrap in sanitizeLogText or sanitise inside logAction"
    evidence_status: "code-read (04-REVIEW.md); no failing test"
  - finding: "WR-02 (04-REVIEW): extractLatch({}) returns a confident latched:false/unknown:false, so an empty meta_data Struct renders 'No failure latched'"
    category: other
    reason: "Display-only (D-12); never gates or feeds the send. Disagrees with the router's unknown mapping for missing meta_data and is pinned by latchStatus.test.ts. Decide before Phase 5 freezes the reply shape"
    evidence_status: "code-read (04-REVIEW.md); test pins current behavior"
  - finding: "WR-03 (04-REVIEW): Acknowledge button is not disabled while a send is pending; a repeat confirm is dropped as ignored/in-flight but clears the 'in progress' spinner"
    category: other
    reason: "Single send is still guaranteed (UAT test 1: three synchronous Confirm clicks produced exactly one ExecuteCommand); this is a feedback defect only"
    evidence_status: "UAT test 1 evidence confirms single send; spinner clearing is code-read"
  - finding: "WR-04 (04-REVIEW): tool.latchStatus sends LATCH_READ_COMMAND to any registered tool type, not only STACK"
    category: security
    reason: "Server procedure is toolId-only and uses executeCommand (guarded), but the placeholder read command can be pushed at a non-STACK instrument by a direct tRPC client. Add a recovery-spec type gate"
    evidence_status: "code-read (04-REVIEW.md)"
  - finding: "WR-05 (04-REVIEW): createFromProtocol wraps unexpected failures in ProtocolGenerationFailedError with a message as the protocolId argument, so server faults map to a client 400 and the cause is not logged"
    category: other
    reason: "Predates Phase 04 gap closure; does not touch the operator-only refusal path (that error is rethrown unwrapped)"
    evidence_status: "code-read (04-REVIEW.md)"
behavior_unverified_items:
  - truth: "Raw JSON in either state (latched or unrecognized) renders in one bounded panel: max height 160px with internal scroll, zero-width basis with min width 100%, so a long unbroken line never widens the card; opening it leaves the card width unchanged (04-06, G-04-2; declared verification: backstop)"
    test: "On the tool page of a STACK tool (fake-ToolDriver rig), click Read latch with (a) a ~3 KB unreadable reply and (b) a latched reply with a long one-line Raw JSON; compare card width before and after, with Raw JSON closed and open"
    expected: "Card width equals the pre-read width (761px in the UAT rig) in both states and both toggle positions; the raw panel is at most 160px tall with its own scroll; each new Read latch starts with Raw JSON collapsed"
    why_human: "Layout/CSS intrinsic-size behavior. The repo has no jsdom or browser layer; staticScan only pins the props (w=0px, minW=100%, maxH=160px, overflowY=auto, break-all, pre-wrap) at source, which is necessary but cannot prove the rendered width. Declared as a backstop truth, so presence plus wiring never counts as verified"
human_verification:
  - test: 'UAT test 2 retest (G-04-2): bounded raw latch panel on a live tool page'
    expected: 'Unrecognized (~3 KB) and latched replies keep the card at its pre-read width with Raw JSON closed and open; panel at most 160px tall with its own scroll; "Unrecognized latch reply" heading and do-not-assume warning visible without expanding; each Read latch starts collapsed; "Use this guid" only fills the input (zero sends, no modal)'
    why_human: 'Rendered layout; no browser/RTL tests in this repo. Same as the behavior_unverified item above'
  - test: 'UAT test 5 retest (G-04-5): rebuild and start the production image from the committed tree'
    expected: '`docker compose up -d --build galago-web` passes "Linting and checking validity of types" and the app starts; galago-web container is then the post-Phase-04-fix image'
    why_human: 'Operator decision to replace the running galago-web container (executors were prohibited from touching it). The lint gate itself was reproduced in this verification (`npx next lint --no-cache --quiet` exit 0, tsc clean), and 04-06 reports two clean `git archive` image builds, but this verification did not re-run a docker build'
  - test: 'UAT test 6 retest (G-04-6): STACK card on a live STACK tool page'
    expected: 'Card shows no Resume or Abort buttons (no ButtonGroup), description reads "Read the failure latched on this tool and acknowledge it."; a F.A.S.T. tool page still shows both Resume and Abort enabled when no step tracks the tool'
    why_human: 'Render check. Source is pinned (showResume/showAbort derived from isRecoveryAction; `isRecoveryAction("stack","resume"|"abort")` is false because the stack spec declares only acknowledge_failure) but no render test exists'
  - test: 'UAT test 7 retest (G-04-7): live next dev run.create after other routes have compiled'
    expected: 'tRPC run.create for a protocol with an operator-only step returns HTTP 400 BAD_REQUEST with the refusal message (not 500); an unknown protocol id returns NOT_FOUND; REST /api/runs still returns 400'
    why_human: 'The require-cache purge that caused the 500 only occurs in a live next dev process; vitest simulates it with vi.resetModules() (runCreateReload.test.ts, 21 tests green) but the real server retest was not possible without starting a server'
  - test: 'Quick re-smoke of UAT tests 1 and 3 on the rebuilt card (low priority, can ride along with the retests above)'
    expected: 'Guid input born empty and never trimmed, modal restates the guid, Confirm only on exactly "Yes", one send, guid cleared on success; with a STACK step running the card stays enabled and the server refusal toast appears verbatim'
    why_human: 'UAT tests 1 and 3 passed automated against HEAD cb8fbfe; RunRecoverySection.tsx was edited afterwards by 04-06 (button gating, hint constant, raw panel). Static scans and unit tests still pin every invariant, so this is a confidence check, not a suspected defect'
---

# Phase 4: Operator-only Commands & STACK Acknowledge - Verification Report (re-verification after gap-closure plans 04-06 and 04-07)

**Phase Goal:** Only an operator, from the tool page, can acknowledge a STACK failure, through an explicit and audited confirmation; no protocol, script, imported file, editor or queued row can send an operator-only command.
**Verified:** 2026-10-30T11:15:00Z
**Status:** human_needed (every programmatic must-have holds; one declared backstop truth is layout-only and the UAT retests 2, 5, 6, 7 need a live rig, dev server or production image)
**Re-verification:** Yes. The prior report (human_needed, 5/5) predates gap-closure plans 04-06 and 04-07 and UAT (`04-UAT.md`, status diagnosed, 3 passed / 4 issues: G-04-2, G-04-5, G-04-6, G-04-7). Previous gaps_remaining was empty; the four UAT gaps are the new items re-verified here.

## Re-verification Method

`git diff cb8fbfe..HEAD -- controller` touches 6 files (+513/-54): `RunRecoverySection.tsx`, `operatorOnlyCommands.ts`, `routers/run.ts`, `runs.ts`, new `runCreateReload.test.ts`, and `staticScan.test.ts` (+107/-0). I read the current source of every changed file, not the summaries, and re-checked the five roadmap truths and the plan 06/07 must-haves against it. Independently run in this verification:

- `npx vitest run` in `controller`: 24 files, 570 tests passed.
- `npx tsc --noEmit`: exit 0.
- `npx next lint --no-cache --quiet`: "No ESLint warnings or errors", exit 0 (the exact gate that failed G-04-5).
- Targeted `vitest run test/runCreateReload test/staticScan test/operatorOnly`: 3 files, 80 tests passed.
- No STACK or F.A.S.T. instrument was started, connected or commanded; no dev server or container was started.

Prohibition checks from the plans (test-tier, all resolved and enforced): `git diff --numstat 37581c6` shows `staticScan.test.ts` 107 added / 0 deleted and no change to `controlDecision.test.ts`, `latchStatus.test.ts`, `operatorOnly.test.ts`, `recoveryActions.ts` or `pages/api/runs/index.ts` (so plans 06/07 did not edit what they were barred from editing). The only test files differing from 37581c6 are `staticScan.test.ts` (append-only) and the new `runCreateReload.test.ts`. The card contains no `dangerouslySetInnerHTML`, no timers, no `onKeyDown`/`onSubmit`, and `LatchRawJson` contains no `setGuid`/`openConfirm`/`latchStatus`/`mutate` (pinned by the G-04-2 scan). `prohibition_flags: 0`: no unwired test-tier prohibition.

## Goal Achievement

### Observable Truths

Roadmap success criteria are the contract (1-5); gap-closure must-haves from 04-06 (6-13) and 04-07 (14-18) are added.

| # | Truth | Status | Evidence (current code) |
| --- | --- | --- | --- |
| 1 | Guid entry + explicit "yes" confirmation through `tool.recoveryControl`, sent once, never retried; blank/never-trimmed guid; no default, timer or Enter-bound default (ROADMAP SC 1) | VERIFIED | `recoveryControl.ts:90` is the single `tool.controlCommand(action, verdict.params)`; `recoveryControl.test.ts` asserts the exact `{stack:{acknowledge_failure:{guid, arm_inspected:"yes"}}}` payload with one call; card gates the button on `isValidRecoveryGuid`; static scans pin no-Enter/no-preselect/no-timer. UAT test 1 (automated, real input events): born empty, maxLength 256 kept 256 of a 300-char paste, leading-space guid not trimmed and Acknowledge disabled, Enter opened nothing, radios unchecked, three synchronous Confirm clicks produced exactly one ExecuteCommand, guid cleared, ack-specific toast |
| 2 | Every attempt audited; refused with a STACK-specific message while the queue's running step is on that tool (SC 2) | VERIFIED | Every refusal/transport/strict-success/outcome path in `recoveryControl.ts` calls `logAction`. UAT test 3: with a transfer step in flight, Confirm gave the persistent toast "A run step is running on this tool; acknowledge after it ends.", no ExecuteCommand reached the tool, audit line `Tool Recovery Control Refused ... outcome=refused: PRECONDITION_FAILED ...` |
| 3 | Latched guid visible from the step-card error (Phase 3) and via explicit "Read latch" backed by toolId-only `tool.latchStatus`; "Use this guid" fills only (SC 3) | VERIFIED | `routers/tool.ts` `latchStatus` is `input({toolId})`, tool from the DB row, fixed `LATCH_READ_COMMAND` through `executeCommand` (never `controlCommand`); the only `.controlCommand(` callers in server/components/pages/hooks are `recoveryControl.ts:90` and `command_queue.ts:578` (grep, this run). "Use this guid" is `setGuid(latchResult.guid ?? "")` only. UAT test 2: one read per click, no polling for 10 s, Use-this-guid filled verbatim with zero sends and no modal. Note advisory WR-02/WR-04 |
| 4 | Protocol/script/imported-JSON/queued-row containing an operator-only command refused at creation with a visible message and audited again at `Tool.executeCommand`; Run Recovery path unaffected (SC 4) | VERIFIED | `tools.ts:410-422` instance `executeCommand`: `isOperatorOnlyCommand(String(this.toolType), command.command)` is the first statement, audited `stage=execute` before the throw. `runs.ts` `createFromProtocol` enqueue scan audited `stage=enqueue` and throws `OperatorOnlyCommandError`. Visible: tRPC BAD_REQUEST with `e.message` (`routers/run.ts`), REST 400 (`pages/api/runs/index.ts`, unedited). `controlCommand` carries no guard. `operatorOnly.test.ts` 16 tests green |
| 5 | Static scans fail the suite on drift (SC 5) | VERIFIED | `staticScan.test.ts` green in the 570-test run; closed file list, guard placement, single-send caller pin, no-Enter/no-timers all intact; two blocks appended by 04-06 (G-04-6, G-04-2), zero deletions |
| 6 | Production build lint gate passes (`next lint --no-cache --quiet` exit 0; clean image build of the committed tree) (04-06, G-04-5) | VERIFIED | Reproduced here: lint exit 0, tsc exit 0. The apostrophe now lives in `const GUID_BLANK_HINT` (JS string, `RunRecoverySection.tsx`), not JSX text. Image build: 04-06 SUMMARY claims two clean `git archive` builds; not re-run here, the production container rebuild is human item 2 |
| 7 | Guid hint renders exactly "A guid cannot be blank. Enter the guid shown in the failed step's error or via Read latch." from a JS constant; copy pins pass unedited (G-04-5) | VERIFIED | Constant text matches byte-for-byte (straight apostrophe), rendered once as `{GUID_BLANK_HINT}`; `controlDecision.test.ts` unchanged against 37581c6 and green |
| 8 | STACK card renders no Resume and no Abort (no ButtonGroup); F.A.S.T. renders both with the same enable rule; visibility from `isRecoveryAction`, not a hard-coded tool type (G-04-6, D-05) | VERIFIED | `showResume`/`showAbort = isRecoveryAction(toolType, ...)`; group wrapped in `(showResume \|\| showAbort) && (`; `disabled` expression unchanged; scan asserts no `toolType === "fast"` and gate-before-click per button. `recoveryActions.ts` stack spec declares only `acknowledge_failure`. Live render -> human item 3 |
| 9 | STACK description reads "Read the failure latched on this tool and acknowledge it."; F.A.S.T. sentence unchanged; UI-SPEC carries the copy (G-04-6) | VERIFIED | Ternary in card at the description Text; scan pins both sentences and absence of "resume/abort"; `04-UI-SPEC.md` lines 100, 105, 182, 235 carry G-04-6/G-04-2 amendments |
| 10 | Unrecognized latch reply shows the heading and warning without expanding; its raw text appears only inside the "Raw JSON" collapsible (G-04-2) | VERIFIED | The `latchResult.unknown` branch renders heading, warning Text, then `<LatchRawJson>`; `formatLatchRaw` is called only inside `LatchRawJson` (2 call sites in file: definition + one use); scan pins branch order and that the unknown branch has no inline `formatLatchRaw(` |
| 11 | Raw JSON in either state renders in one bounded panel: max height 160px, internal scroll, zero-width basis with min width 100%, mono 14px, break-all + pre-wrap; opening leaves card width unchanged (G-04-2; `verification: backstop`) | PRESENT_BEHAVIOR_UNVERIFIED | All props present and pinned at source (`w="0px" minW="100%" maxH="160px" overflowY="auto" fontFamily="mono" fontSize="sm" wordBreak="break-all" whiteSpace="pre-wrap"`), used by both branches. The assertion is rendered layout; non-inferable per the plan's own `backstop` tag, no browser test exists -> human item 1 |
| 12 | Every explicit "Read latch" click starts with Raw JSON collapsed (`readClick` resets `rawOpen`) (G-04-2) | VERIFIED | `readClick` calls `setRawOpen(false)` before the refetch; scan "every explicit read starts with Raw JSON collapsed" green |
| 13 | Unchanged: latch read display-only, one `tool.latchStatus` consumer, no timers, no Enter default, closed acknowledge_failure file list; existing staticScan/latchStatus/controlDecision cases pass unedited | VERIFIED | Only append to `staticScan.test.ts`; `latchStatus.test.ts`/`controlDecision.test.ts` no diff against 37581c6; 570/570 green |
| 14 | After a simulated dev recompile (`vi.resetModules()`), tRPC `run.create` returns BAD_REQUEST with the refusal's own message for an operator-only step, never INTERNAL_SERVER_ERROR (G-04-7, OPR-04) | VERIFIED | `routers/run.ts` catch uses `isOperatorOnlyCommandError(e)` (`e instanceof Error && e.name === "OperatorOnlyCommandError"`, `operatorOnlyCommands.ts`); `runCreateReload.test.ts` 21 tests green in this run, including the reload variant. Live dev retest -> human item 4 |
| 15 | The other three branches also map after a dev recompile: NOT_FOUND "No protocol found for this ID.", BAD_REQUEST "Could not generate commands for the given params.", ZodError cause rethrown (G-04-7) | VERIFIED | `run.ts` catch maps via `isProtocolNotFoundError`/`isProtocolGenerationFailedError`/`isProtocolParamsInvalidError` (`runs.ts:316-326`); covered by `runCreateReload.test.ts` in both module-graph shapes |
| 16 | Same four results hold in one module graph; `operatorOnly.test.ts` passes unedited (G-04-7) | VERIFIED | `operatorOnly.test.ts` 16 tests green, no diff against 37581c6 |
| 17 | `run.create` catch and `createFromProtocol` rethrow list classify by name through exported guards; neither file checks class identity against the four classes (pinned by a vitest source case) (G-04-7) | VERIFIED | `grep instanceof` in `run.ts` returns nothing; in `runs.ts` only the builtin-`Error` checks at 282 and the guards themselves; the rethrow list at `runs.ts:272-275` uses the four guards; source-pin describe "run.create source pin" green |
| 18 | Unchanged: enqueue refusal, message and `stage=enqueue` audit line; `RunStore.global`/`CommandQueue.global` stay on `global`; REST mapping; OPR-05 scans pass unedited (G-04-7) | VERIFIED | `pages/api/runs/index.ts` no diff against 37581c6; OPR-05 `staticScan` block green; enqueue scan intact in `runs.ts` |

**Score:** 17/18 truths verified (1 present, behavior-unverified: truth 11)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Placeholder `LATCH_READ_COMMAND` until galago-tools freezes the proto | Phase 5 | ROADMAP Phase 5: constant "set when galago-tools Phase 4 names it and pinned in Phase 5"; GEN-04 contract test |
| 2 | Real-encoder wire test of the acknowledge payload; refusal keyed on generated `ToolType.stack` | Phase 5 | ROADMAP Phase 5 SC 5; UAT automation note (payload reached the fake tool as empty `{}` until codegen) |

### Advisory (New Scope, Unevidenced)

Open 04-REVIEW warnings (all five dispositions `open` in `04-REVIEW-DISPOSITION.md`; 0 critical). None breaks an OPR truth; none has deterministic failing evidence.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | WR-01 enqueue/execute operator-only audit `details` not passed through `sanitizeLogText` | security | Audit record still written; only text sanitisation missing; code-read only |
| 2 | WR-02 `extractLatch({})` renders a confident "No failure latched" | other | Display-only (D-12); pinned by an existing test |
| 3 | WR-03 Acknowledge not disabled while a send is pending (spinner cleared on a dropped repeat confirm) | other | Single-send proven by UAT test 1 and the in-flight guard |
| 4 | WR-04 `tool.latchStatus` has no tool-type gate | security | Read command only, via the guarded `executeCommand`; direct-client reach only |
| 5 | WR-05 `createFromProtocol` generic wrap mislabels server faults as 400 | other | Predates the gap closure; operator-only refusal is rethrown unwrapped |

### Required Artifacts

| Artifact | Status | Details |
| --- | --- | --- |
| `controller/components/tools/RunRecoverySection.tsx` | VERIFIED | `GUID_BLANK_HINT`, `showResume`/`showAbort`, `LatchRawJson`, `setRawOpen(false)` in `readClick` all present (contains `function LatchRawJson(`); wired into the tool page; renders real `tool.latchStatus` data |
| `controller/test/staticScan.test.ts` | VERIFIED | Contains the G-04-6 and G-04-2 describes; append-only (107/0) |
| `.planning/phases/04-.../04-UI-SPEC.md` | VERIFIED | Contains `G-04-6` and `G-04-2` amendments |
| `controller/test/runCreateReload.test.ts` | VERIFIED | Contains `vi.resetModules()`; 21 tests green |
| `controller/server/operatorOnlyCommands.ts` | VERIFIED | `isOperatorOnlyCommandError` exported; module still zero-import (no import statements) |
| `controller/server/runs.ts` | VERIFIED | Three name-based guards exported; rethrow list uses the four guards; imported by `routers/run.ts` |
| `controller/server/routers/run.ts` | VERIFIED | Catch maps all four branches through guards |
| `controller/server/tools.ts`, `recoveryControl.ts`, `recoveryActions.ts`, `routers/tool.ts`, `command_queue.ts`, `pages/api/runs/index.ts` | VERIFIED | Unchanged since the last verification except as noted; guard first statement, single send, toolId-only latch read, REST 400 intact |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RunRecoverySection.tsx` | `recoveryActions.ts` | `isRecoveryAction(toolType, "resume"\|"abort")` | WIRED | imported and used for both flags |
| `RunRecoverySection.tsx` | `LatchRawJson` | both latch branches render `<LatchRawJson>`; `formatLatchRaw` only inside | WIRED | 2 usages; scan-pinned |
| `staticScan.test.ts` | `RunRecoverySection.tsx` | `stripComments(read(...))` G-04-6/G-04-2 scans | WIRED | green |
| `routers/run.ts` | `runs.ts` | `isProtocol{NotFound,GenerationFailed,ParamsInvalid}Error(e)` | WIRED | imported, used in catch |
| `routers/run.ts` | `operatorOnlyCommands.ts` | `isOperatorOnlyCommandError(e)` -> BAD_REQUEST `e.message` | WIRED | |
| `runCreateReload.test.ts` | `routers/run.ts` | fresh `runRouter.createCaller` after `vi.resetModules()` with `RunStore.global` pinned to an older copy | WIRED | |
| `recoveryControl.ts` -> `tool.controlCommand` | operator path | single call | WIRED | `:90` |
| `tools.ts` / `runs.ts` -> `operatorOnlyCommands.ts` | enforcement | guard first / enqueue scan | WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RunRecoverySection.tsx` latch block | `latchResult` | `trpc.tool.latchStatus` -> `tool.executeCommand(LATCH_READ_COMMAND)` -> `extractLatch(meta_data)`; unreadable -> `unknown` | Yes (UAT test 2 against the fake tool) | FLOWING |
| `RunRecoverySection.tsx` ack send | `guid` | user input -> `request.params` -> `recoveryControl` -> `controlCommand`; latch never feeds it | Yes (UAT test 1 audit shows `decisions={guid:UAT-guid-42, arm_inspected:yes} outcome=SUCCESS`) | FLOWING |
| `LatchRawJson` | `raw` | `latchResult.raw` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full suite | `npx vitest run` (controller) | 24 files / 570 tests passed | PASS |
| Types | `npx tsc --noEmit` | exit 0 | PASS |
| Production lint gate | `npx next lint --no-cache --quiet` | "No ESLint warnings or errors", exit 0 | PASS |
| Gap-closure + OPR files | `npx vitest run test/runCreateReload test/staticScan test/operatorOnly` | 80 passed | PASS |
| Single `.controlCommand(` callers | `grep -rn "controlCommand(" server components pages hooks` | `recoveryControl.ts:90`, `command_queue.ts:578` (plus the method definition in `tools.ts`) | PASS |
| Live next dev / rendered layout / image build | n/a | Needs a dev server, browser or docker rebuild | SKIP (human items) |

### Probe Execution

SKIPPED: Phase 04 declares no probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| OPR-01 | 04-01, 04-03, 04-06 | Operator sends STACK AcknowledgeFailure from the tool-page Run Recovery card with guid + explicit confirmation | SATISFIED | Truths 1, 6-9; card shows only the declared surface for STACK; single-send test and UAT test 1; REQUIREMENTS.md `[x]`, Complete |
| OPR-02 | 04-01 | Every acknowledge attempt audited; refused with STACK-specific message while the queue step runs | SATISFIED | Truth 2; UAT test 3 audit and toast |
| OPR-03 | 04-04, 04-06 | Latched guid visible from the step-card error and an explicit "Read latch" | SATISFIED | Truth 3, 10-13; truth 11 layout bound is the only behavior-unverified item (display polish, not the read) |
| OPR-04 | 04-02, 04-07 | Protocols/queue can never send an operator-only command: one table, two enforcement points, visible refusal | SATISFIED | Truth 4, 14-18; BAD_REQUEST now robust to a dev recompile (test-simulated) |
| OPR-05 | 04-05 | Static scans pin no self-acknowledge path and the acknowledge_failure file list | SATISFIED | Truth 5, 13, 18 |

All five IDs declared across the plans (04-01..04-07 frontmatter: OPR-01..05) appear in REQUIREMENTS.md lines 44-58 and the traceability table (lines 109-113: Phase 4, Complete). No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `server/recoveryActions.ts` | ~213 | "PLACEHOLDER" comment on the latch constant | Info (deferred) | Deliberate, pinned to Phase 5 by ROADMAP |
| `test/operatorOnly.test.ts` | ~301 | `scriptContent: "PLACEHOLDER"` | Info | Test fixture value |

Debt-marker scan (TBD/FIXME/XXX) across the phase-modified controller files returned nothing unreferenced. No stub or hollow-prop pattern: `latchResult` and `guid` flow from real sources, the empty initial state values are overwritten by explicit user actions.

### Human Verification Required

#### 1. UAT test 2 retest: bounded raw latch panel (also the behavior-unverified truth 11)

**Test:** With the fake-ToolDriver STACK rig (no real instrument), click Read latch with a ~3 KB unreadable reply and with a latched reply that has a long one-line Raw JSON; compare card width, Raw JSON closed and open.
**Expected:** Card stays at its pre-read width (761px in the UAT rig); panel at most 160px tall with internal scroll; heading and warning visible without expanding; each new read starts collapsed; "Use this guid" only fills the input.
**Why human:** Rendered layout; no browser/RTL layer in the repo; source props are pinned but intrinsic sizing cannot be proven by static scan.

#### 2. UAT test 5 retest: production image build and start

**Test:** `docker compose up -d --build galago-web`.
**Expected:** Build passes the lint/type step and the app starts.
**Why human:** Replacing the running container is an operator decision; the lint gate itself was reproduced green here and 04-06 reports two clean archive builds, but no docker build was run in this verification.

#### 3. UAT test 6 retest: STACK card has no Resume/Abort

**Test:** Open a STACK tool page, then a F.A.S.T. tool page.
**Expected:** STACK: no Resume/Abort, new description; F.A.S.T.: both buttons enabled when no step tracks the tool.
**Why human:** Render check; source pinned, not rendered in a test.

#### 4. UAT test 7 retest: live `run.create` after dev recompile

**Test:** On a running `next dev`, after other routes have compiled, call tRPC `run.create` for an operator-only protocol and for an unknown protocol id.
**Expected:** 400 BAD_REQUEST with the refusal message; NOT_FOUND for the unknown protocol; REST `/api/runs` still 400.
**Why human:** The module-purge condition exists only in a live dev process; vitest simulates it.

#### 5. Quick re-smoke of UAT tests 1 and 3 (low priority)

**Test:** Repeat the acknowledge flow and the card-enabled-while-running refusal on the rebuilt card.
**Expected:** As recorded in UAT (single send, verbatim guid, server refusal toast).
**Why human:** Both passed automated against cb8fbfe; the card was edited afterwards by 04-06. Invariants remain pinned by scans and unit tests.

The former residual concurrency backstop (UAT test 4) is resolved: marked `pass, source: user` in `04-UAT.md`.

### Gaps Summary

None. All four UAT gaps are closed at the code level: G-04-5 (lint exit 0, tsc clean, hint a JS constant), G-04-6 (buttons derived from the recovery spec, STACK card has none), G-04-7 (all four run.create branches classified by name, no class-identity check on the path, 21 regression tests including the reload shape), G-04-2 (single bounded `LatchRawJson` used by both latch states, collapsed per read). The five roadmap truths still hold against current code with no regression: audit, single send, queue-running refusal, enforcement at both operator-only points, and the static scans. Status is `human_needed` because the bounded-panel truth is a declared layout backstop that only a browser can confirm, and the retests for UAT 2, 5, 6 and 7 need a live rig, dev server or the production image. Five open code-review warnings are recorded as advisory and are worth a decision before Phase 5, but none blocks the phase goal.

---

_Verified: 2026-10-30T11:15:00Z_
_Verifier: Claude (gsd-verifier)_
