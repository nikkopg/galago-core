---
phase: 04-operator-only-commands-stack-acknowledge
verified: 2026-10-29T14:30:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - .planning/debug/04-02/red-evidence.json
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
  - controller/components/runs/RunControlConfirmModal.tsx
  - controller/components/runs/controlDecision.ts
  - controller/components/tools/RunRecoverySection.tsx
  - controller/hooks/useRunControl.ts
  - controller/pages/api/runs/index.ts
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
  - controller/test/staticScan.test.ts
covered_digest: "v4:sha256:928717ae6e0f9d4c094e95f153003c4b12cb99643b46f27f3732226c23994d6c"
behavior_unverified: 0
overrides_applied: 0
prohibition_flags: 0
re_verification:
  previous_status: none
  previous_score: n/a — initial verification
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: 'LATCH_READ_COMMAND is a placeholder constant name until galago-tools Phase 4 freezes the proto command name (source comment at server/recoveryActions.ts:213)'
    addressed_in: 'Phase 5'
    evidence: 'ROADMAP Phase 5 notes: "the latch-read command name is a single constant, set when galago-tools Phase 4 names it and pinned in Phase 5"; SC 5 + "a contract test that the latch-read constant is a key of the generated stack.Command oneof"'
  - truth: 'Real-encoder wire proof of the acknowledge payload and the operator-only refusal keyed on ToolType.stack'
    addressed_in: 'Phase 5'
    evidence: 'ROADMAP Phase 5 SC 5: "Activation tests pass on the generated types: a real-encoder wire test of the acknowledge payload and the latch read, and the operator-only refusal keyed on ToolType.stack"; Phase 4 scope section states these are "Not provable before codegen (Phase 5)"'
human_verification:
  - test: 'Acknowledge flow end-to-end on a real STACK tool page: type a guid, open the modal, confirm'
    expected: 'Guid input born empty (never trimmed), maxLength 256; modal restates the typed guid byte-for-byte with acknowledge-specific copy and no instrument-head note; arm-inspected radios have nothing preselected; Confirm enables only on exactly "Yes"; after confirming with "yes" the request succeeds and the guid input is cleared; the success toast title is "STACK failure acknowledged"'
    why_human: 'Render behavior — this repo has no jsdom/RTL or browser tests; the unit suite proves the decision logic and send exactness, and static scans pin no-Enter/no-preselect/no-timer at the source, but no executable check exercises the rendered flow'
  - test: 'Latched failure block: explicit "Read latch" click; "Use this guid" behavior'
    expected: 'One read per click (no polling), read-only result with kind/explanation and a "Raw JSON" collapsible, "Use this guid" fills the guid input and NEVER opens the modal or sends anything, "No failure latched." copy when nothing is latched, "Reading latch…" while in flight'
    why_human: 'Render behavior and visual layout (wordBreak/font-mono collapsible); only the data path is unit-tested (latchStatus.test.ts)'
  - test: 'Card stays ENABLED (buttons clickable, no greyed state) while a STACK step runs on the tool'
    expected: 'No instrument-state check anywhere in the card or modal; pressing "Acknowledge failure…" while the queue runs that tool yields the server refusal "A run step is running on this tool; acknowledge after it ends." as a persistent toast carrying the server text verbatim'
    why_human: 'Requires a live run against a stack tool + the refusal toast visual; the server refusal itself is unit-proven (recoveryControl tests green), the card-side instrument-state absence is source-scan-pinned'
  - test: 'Residual concurrency posture decision (backstop truth from 04-01, self-declared verification: backstop)'
    expected: 'Human sign-off that the residual race between two concurrent recoveryControl calls is acceptable under the same posture as PROJECT.md Phase 1 control-race acceptance (the exact-guid check on the tool core is the real gate; no queue-level serialization added by design)'
    why_human: 'Declared backstop/non-inferable: no test asserts the absence of queue-level serialization as a property; it is an accepted-risk decision, not an observable mechanism'
---

# Phase 4: Operator-only Commands & STACK Acknowledge — Verification Report

**Phase Goal:** Only an operator, from the tool page, can acknowledge a STACK failure, through an explicit and audited confirmation; no protocol, script, imported file, editor or queued row can send an operator-only command.
**Verified:** 2026-10-29T14:30:00Z
**Status:** human_needed (all programmatic must-haves verified; render-level confirmation + one declared backstop decision routed to human)

## Goal Achievement

### Observable Truths (ROADMAP success criteria = contract)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Guid entry + explicit "yes" confirmation through `tool.recoveryControl`, sent once, never retried; blank/never-trimmed guid; no default, no timer, no Enter-bound default | ✓ VERIFIED | Send path: `recoveryControl.ts:74,88` uses `validateRecoveryRequest` → exactly one `tool.controlCommand(action, verdict.params)`; exact payload `{ stack: { acknowledge_failure: { guid, arm_inspected: "yes" } } }` asserted with `toHaveBeenCalledTimes(1)` (`recoveryControl.test.ts:380–391`); empty/blank guid refused by the shared validator (`recoveryActions.test.ts`); no-Enter/no-preselect/no-timer pinned at source by green staticScan pins on the card + modal. Render-level confirmation routed to human (item 1) |
| 2 | Every attempt audited; refused with a STACK-specific message while the queue's running step is on that tool | ✓ VERIFIED | `recoveryControl.test.ts` asserts logAction on refusal, transport error, strict success, and outcome; STACK-specific refuse-while-running message at `recoveryControl.ts:63` ("A run step is running on this tool; acknowledge after it ends."); tests green in the suite run |
| 3 | Latched guid visible from the step-card error (Phase 3) and via an explicit "Read latch" backed by toolId-only `tool.latchStatus`; "Use this guid" fills only | ✓ VERIFIED | `routers/tool.ts:550–568`: toolId-only input, DB-row-derived tool, ONE fixed `LATCH_READ_COMMAND` through `tool.executeCommand` (never controlCommand); `latchStatus.test.ts` green (shape-tolerance matrix, zero controlCommand calls); single-reader pin green (`staticScan.test.ts:400–401`); card fill-only wiring present (`RunRecoverySection.tsx:88,252`). Render confirmation routed to human (item 2) |
| 4 | Protocol/script/imported-JSON/queued-row containing an operator-only command is refused at creation with a visible message and audited again at `Tool.executeCommand`; Run Recovery path unaffected | ✓ VERIFIED | Execute-time guard is the first statement of the instance `Tool.executeCommand` keyed on `String(this.toolType)` (`tools.ts:416–428`), audited `stage=execute` before throw; enqueue guard in `RunStore.createFromProtocol` with `stage=enqueue` audit and `OperatorOnlyCommandError` join of the rethrow list (`runs.ts:226–271`); visible errors: tRPC BAD_REQUEST with `e.message` (`routers/run.ts:90–95`), REST HTTP 400 (`pages/api/runs/index.ts:22–25`), default stays 500; `operatorOnly.test.ts` covers runCommand, queued row, visual + script + imported-JSON shapes, mislabelled toolType, prototype-key safety, and controlCommand-unaffected — green |
| 5 | Static scans fail the suite on drift: self-acknowledge, literal escape, commandFields/runControl contamination, guard moving out of executeCommand / into controlCommand, latch feeding the send path | ✓ VERIFIED | `staticScan.test.ts` (751 lines) contains all pins — closed 4-file literal set (:651–656), commandFields/runControl absence pins, guard-placement via `extractBracedRegion` asserting guard-before-params and a clean controlCommand body (:682–704), `/latch/i` send-path ban, single latch reader (:400–401), no-Enter card extension (:412), single-send `.controlCommand(` caller pin — all green in the suite run |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Placeholder `LATCH_READ_COMMAND` until galago-tools freezes the proto | Phase 5 | ROADMAP Phase 5: constant "set when galago-tools Phase 4 names it and pinned in Phase 5"; GEN-04 contract test |
| 2 | Real-encoder wire test of the acknowledge payload; refusal keyed on generated `ToolType.stack` | Phase 5 | ROADMAP Phase 5 SC 5; Phase 4 scope explicitly states "Not provable before codegen (Phase 5)" |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `controller/server/recoveryActions.ts` | Zero-import frozen spec + fail-closed validator + strict-success + latch | ✓ VERIFIED | 0 imports; all declared exports present (incl. `LATCH_READ_COMMAND`, `extractLatch`); verify.artifacts passed |
| `controller/server/recoveryControl.ts` | Rerouted audited path, one send, STACK message, D-10 | ✓ VERIFIED | Verifies via `verify.key-links`; contains refuse-while-running message; single `tool.controlCommand(action, verdict.params)` call |
| `controller/server/operatorOnlyCommands.ts` | Zero-import refuse table + matcher + Error subclass | ✓ VERIFIED | 0 imports; exports `operatorOnlyCommands`, `isOperatorOnlyCommand`, `OperatorOnlyCommandError` |
| `controller/server/tools.ts` | Guard as first statement of instance executeCommand | ✓ VERIFIED | Guard at :416 before `const params`; body contains neither guard symbol in `controlCommand` (staticScan asserts this; green) |
| `controller/server/runs.ts` | Enqueue scan + rethrow join | ✓ VERIFIED | `stage=enqueue` at :230, rethrow list at :271 |
| `controller/server/routers/run.ts` | OperatorOnlyCommandError → BAD_REQUEST own message | ✓ VERIFIED | :90–95, message passed verbatim |
| `controller/pages/api/runs/index.ts` | REST case → 400 with message, default 500 | ✓ VERIFIED | :22–24 name-based case, default 500 unchanged |
| `controller/server/routers/tool.ts` | tool.latchStatus toolId-only query | ✓ VERIFIED | :550–568; imports `LATCH_READ_COMMAND`+`extractLatch`; uses `tool.executeCommand`, never controlCommand |
| `controller/components/runs/controlDecision.ts` | Spec-driven decision layer, copy maps, params | ✓ VERIFIED | imports `listRecoveryActions`/`getRecoverySpec` as values; confirmYes exact-"yes" logic; `shouldShowRecoverySection` derives from the spec (:495) |
| `controller/components/runs/RunControlConfirmModal.tsx` | Per-kind render, born-empty radios, guid restated as data | ✓ VERIFIED | `completeRecoveryEntries(recoverySpec, values, request.params ?? {})` at :194; guid restated via request.params (:167–262); no Enter/form/defaultValue junk |
| `controller/components/tools/RunRecoverySection.tsx` | Guid entry, shared validator gate, latch block | ✓ VERIFIED | imports `isValidRecoveryGuid` from server module (:31); `isValidRecoveryGuid(guid)` gates the button (:252); latch query :88; zero onKeyDown/onSubmit/type="submit" |
| `controller/hooks/useRunControl.ts` | sendRecovery widened to `Record<string, string>` | ✓ VERIFIED | :44 |
| `controller/test/*` (6 files) | Behavioral tests per plan | ✓ VERIFIED | All exist, all substantive, all green in the suite run |
| `controller/test/staticScan.test.ts` | OPR-05 pin set | ✓ VERIFIED | All pins present (:0706 refs above) and green |

Note on `verify.artifacts` for 04-03: the CLI flagged `test/controlDecision.test.ts` "Missing pattern: listRecoveryActions". The test exercises the same invariant through the derived exported API `shouldShowRecoverySection` (which wraps `listRecoveryActions(...).length > 0` in controlDecision.ts:495) — stack `true` / fast, pf400, toolbox, `"constructor"`, `""` all pinned (:422–431). Pattern-string miss only; behavior proven green. Recorded as an accepted plan-wording deviation, not a stub.

### Key Link Verification (gsd-tools verify.key-links — all 5 plans)

| From | To | Via | Status |
| --- | --- | --- | --- |
| recoveryControl.ts | recoveryActions.ts | imports isRecoveryAction/validateRecoveryRequest/RECOVERY_STRICT_SUCCESS | ✓ WIRED |
| recoveryControl.ts | tools.ts | single `tool.controlCommand(action, verdict.params)` | ✓ WIRED |
| recoveryControl.test.ts | helpers/fakeTool.ts | installFakeTool("stack-1") exact-payload assertion | ✓ WIRED |
| tools.ts | operatorOnlyCommands.ts | isOperatorOnlyCommand(String(this.toolType)) first statement | ✓ WIRED |
| runs.ts | operatorOnlyCommands.ts | enqueue scan String(c.toolType) | ✓ WIRED |
| routers/run.ts | operatorOnlyCommands.ts | instanceof Error branch, message verbatim | ✓ WIRED |
| RunRecoverySection.tsx | recoveryActions.ts | shared isValidRecoveryGuid | ✓ WIRED |
| controlDecision.ts | recoveryActions.ts | listRecoveryActions/getRecoverySpec as zero-import values | ✓ WIRED |
| RunControlConfirmModal.tsx | controlDecision.ts | getRecoverySpec/completeRecoveryEntries | ✓ WIRED |
| routers/tool.ts | recoveryActions.ts | LATCH_READ_COMMAND + extractLatch | ✓ WIRED |
| routers/tool.ts | tools.ts | tool.executeCommand, NOT contrôleCommand | ✓ WIRED |
| RunRecoverySection.tsx | routers/tool.ts | trpc.tool.latchStatus.useQuery | ✓ WIRED |
| staticScan.test.ts | operatorOnlyCommands.ts / tools.ts / RunRecoverySection.tsx | literal-file pin / guard-placement / no-Enter card | ✓ WIRED |

**all_verified: true for all five plans.**

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full unit suite (single run this verification) | `npx vitest run` (controller) | 23 files / 544 tests passed, 51.7s | ✓ PASS |
| Exact one-send ack payload on FakeGrpc | in suite (`recoveryControl.test.ts:380–391`) | `stack: { acknowledge_failure: { guid, arm_inspected: "yes" } }` + `toHaveBeenCalledTimes(1)` | ✓ PASS |
| Operator-only refusals at both enforcement points, incl. audit | in suite (`operatorOnly.test.ts`) | refusal with `stage=execute`/`stage=enqueue`, run not stored, zero enqueues, controlCommand unaffected | ✓ PASS |
| Latch status shape tolerance + zero controlCommand | in suite (`latchStatus.test.ts`) | all matrix cases green | ✓ PASS |
| OPR-05 static-scan pins incl. closed literal set, guard placement, single reader | in suite (`staticScan.test.ts`) | all pins green | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| OPR-01 | 04-01, 04-03 | ✓ SATISFIED | Card + modal + shared validator + exact payload test (SC1); no runControl entry added (staticScan closed-set pin; runControl ack-free) |
| OPR-02 | 04-01 | ✓ SATISFIED | Audit at every outcome (logAction asserted), refuse-while-running STACK message, one send / no retry (transport-error test pins a single call); the plan's test-tier prohibition (no deadline/retry scaffolding) is enforced by wired green tests + single-send assertions |
| OPR-03 | 04-04 | ✓ SATISFIED | tool.latchStatus toolId-only display-only read; Use-this-guid fills only; single reader pinned |
| OPR-04 | 04-02 | ✓ SATISFIED | One table, two enforcement points, visible BAD_REQUEST/400, controlCommand unaffected |
| OPR-05 | 04-05 | ✓ SATISFIED | Failing-suite static scans green; escaped literal, commandFields/runControl contamination, guard displacement, second latch reader, Enter-bound card would all fail the suite |

Orphaned requirements: none — REQUIREMENTS.md maps exactly OPR-01..05 to Phase 4, all claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `server/recoveryActions.ts` | 213 | "PLACEHOLDER name" comment (latch constant) | ℹ️ Info — deferred | Deliberate; the constant is pinned as-is until the proto freeze; follow-up is formal (Phase 5 / galago-tools Phase 4, ROADMAP-pinned). Referenced work item → not an unresolved debt marker |
| `test/operatorOnly.test.ts` | 301 | `scriptContent: "PLACEHOLDER"` | ℹ️ Info | Test fixture unused by behavior (executor is mocked; commands come from the mock's return). Not a stub |
| Debt-marker scan TBD/FIXME/XXX across all 18 covered source files | — | none | — | — |

Commits cited by summaries verified real: `verify.commits` → 7/7 valid (`583d4f6`, `dc1d9a8`, `d86e3e0`, `7e22e49`, `5772c85`, `0f437e5`, `9c90843`).

### Execution-Context Notes (recorded, non-blocking)

(a) `bin/make test`'s `build_prod` step cannot run on this host (root-owned `controller/.next`, EACCES) — environment artifact; the plans pin the prettier/tsc/unit gate chain, which passed per the run context and is corroborated here by the green suite (frontend rendering is out of the unit suite's reach either way).
(b) Documented deviations from plan wording (NEL in the guid regex with rationale — `\s` misses U+0085; guards-first ordering; closed literal set of FOUR files — the card legitimately carries the literal for its refusal/copy strings, and the fenced-set invariant is what OPR-05 pins; no `controller/.prettierrc` — root config used; `test/runs.test.ts` fallback documented) all reviewed: each is behavior-preserving or covered by a stronger pin in staticScan, and the 544-test suite is green against the final tree.

### Human Verification Required

Four items (listed in frontmatter): (1) acknowledge card→modal→confirm render flow and afterAccepted clear; (2) latch block render + Use-this-guid fill-only; (3) card stays enabled while a STACK step runs, refusal toast; (4) sign-off on the declared residual concurrency backstop posture.

### Gaps Summary

None. Every programmatic must-have is verified: all 18 covered source artifacts exist, are substantive, and are wired; all 15 key links across the five plans verify; the full unit suite runs 544/544 green in a single run under this verification, with the phase's own behavioral tests (exact-payload, refusal matrix, enforcement points, latch matrix, static-scan pins) all passing. Status is human_needed solely because this repo has no browser/RTL test layer, so render-level confirmations of the operator surface — plus one self-declared backstop decision (statement-type truth from 04-01) — cannot be machine-verified. Automated checks passed; awaiting human verification.

---

_Verified: 2026-10-29T14:30:00Z_
_Verifier: the agent (gsd-verifier)_
