---
phase: 05-stack-codegen-command-forms
verified: 2026-11-02T03:38:16Z
status: gaps_found
score: 16/20 must-haves verified
covered_files:
  - .gitmodules
  - controller/gen-interfaces/controller.ts
  - controller/gen-interfaces/tools/grpc_interfaces/tool_base.ts
  - controller/gen-interfaces/tools/grpc_interfaces/stack.ts
  - controller/gen-interfaces/google/protobuf/struct.ts
  - controller/components/tools/constants.ts
  - controller/components/tools/RunRecoverySection.tsx
  - controller/components/tools/commandParams.ts
  - controller/components/ui/BoundedRawJson.tsx
  - controller/pages/tools/[id].tsx
  - controller/server/recoveryActions.ts
  - controller/test/staticScan.test.ts
  - controller/test/latchStatus.test.ts
  - controller/test/wire.test.ts
  - controller/test/stackActivation.test.ts
  - controller/test/boundedRawJson.test.ts
  - controller/test/toolPageReply.test.ts
  - controller/test/commandParams.test.ts
  - controller/test/operatorOnly.test.ts
  - controller/test/recoveryControl.test.ts
  - controller/test/tools.test.ts
  - controller/test/commandFields.test.ts
covered_digest: "v4:sha256:0f5005c787ec80e7fa53de73cecf1da3e7b860505962d17916c8b5bd9151989b"
behavior_unverified: 3
overrides_applied: 0
gaps:
  - truth: "Blank-omitting STACK send (D-04): a STACK command send strips empty-string/undefined/null params before the mutation; operator-typed 0 and false pass through"
    status: failed
    reason: "CR-01 (open Critical, 05-REVIEW.md — independently re-confirmed in source at verification): the page renders boolean fields as <Input type=\"boolean\">, an invalid HTML input type that falls back to a text input, so handleInputChange stores the typed STRING (only text_array is converted). The string \"false\" is not blank, so omitBlankParams keeps it, _payloadForCommand embeds it, and the generated encoder writes it through protobufjs Writer.bool (value ? 1 : 0) — a truthy string encodes as 1. Net: any typed text on a STACK refresh field sends refresh=true; there is NO input that sends false. WR-01 (open Warning): a typed-then-cleared NumberInput stores NaN (Chakra parse(\"\") === NaN); isBlank(NaN) is false, so a field the operator visually emptied is sent as NaN. The strip mechanism, the STACK-only scoping and the F.A.S.T.-verbatim halves all hold (unit + real-encoder wire tests); the failure is the page's real value pipeline for booleans and cleared numbers, which no test exercises — the D-04 wire pin tested omitBlankParams/encoder directly with real types."
    artifacts:
      - path: "controller/pages/tools/[id].tsx"
        issue: "lines 266-282: boolean branch renders <Input type=\"boolean\"> and stores e.target.value (a string) with no coercion at input or send; lines 325-327: NumberInput onChange stores valueNumber (NaN when cleared) with no guard"
      - path: "controller/components/tools/commandParams.ts"
        issue: "isBlank (lines 12-14) does not treat NaN as blank, so a visually-cleared number field survives the strip"
      - path: "controller/gen-interfaces/tools/grpc_interfaces/stack.ts"
        issue: "lines 660-661: encodes refresh whenever !== undefined via protobufjs Writer.bool truthiness — the encoder is correct; the string value fed to it is not"
    missing:
      - "Boolean fields store and send a real boolean: coerce at input or before the strip so a typed \"false\" reaches the wire as false — pinned by a wire test through the page pipeline (refresh: false decodes false; a typed string never decodes true)"
      - "A cleared number stores the born-empty \"\" (or NaN is treated as blank) so a visually-emptied timeout_s is omitted from the payload — omitBlankParams({ timeout_s: NaN }) must omit"
behavior_unverified_items:
  - truth: "The operator can open a STACK tool page and set its Config (host/port) there (roadmap SC2 — visual/UI half; the data path is VERIFIED via getToolConfigDefinition(ToolType.stack) resolving the exact 4-key default)"
    test: "Open a STACK tool page, open the config editor, edit host/port, save"
    expected: "The four generated Config keys render via the existing generic heuristics (host -> IP input, port -> number) and the edit saves"
    why_human: "The repo has no jsdom/RTL; the EditToolConfig render flow is unexercised by any test — only the definition resolution is (tools.test.ts)"
  - truth: "Born-Empty Display Contract on screen: an untouched STACK number/boolean field renders empty — never a painted 0 or false; a genuinely typed value renders as before (UI-SPEC AC-4)"
    test: "Open a STACK command form (e.g. transfer), observe untouched fields, then type and clear values"
    expected: "Untouched timeout_s/refresh render empty; a typed 0 or false renders as typed (display only — the wire half of this contract is the CR-01 gap above)"
    why_human: "Rendered appearance; renderFields fallback fixes (?? \"\") are source-pinned by toolPageReply.test.ts but the browser render is unexercised (no jsdom)"
  - truth: "Reply meta_data panel: born hidden; a completed send with meta_data renders it read-only through the shared BoundedRawJson under the Send button; a completed send without data shows 'No reply data returned.'; one panel replaced per send, disclosure collapsed on every new send (roadmap SC4, GEN-03)"
    test: "Send a STACK read from the tool page with the real adapter (galago-tools must set return_reply: true + meta_data on read replies — assumption A1/Pitfall 6)"
    expected: "Before any send nothing renders; after a send the bounded panel (or the muted no-data line) appears; each new send collapses and replaces it"
    why_human: "No jsdom/RTL for the render; and the reply data's existence depends on the external galago-tools adapter's return_reply flag — only observable against the real tool server at UAT"
coincidental_reliance_items:
  - truth: "The D-04 blank-optional wire case pins the omit-blank decision against the real encoder (both ways: stripped untouched fields decode absent; unstripped blank decodes present)"
    reason: fixture-only
    harden: "The wire test hand-builds page-shaped params whose values already have real types; the production formValues seeding hands booleans to the pipeline as strings — exactly the blind spot CR-01 slipped through. Harden by pinning a boolean field through the page pipeline (the test case named in the CR-01 finding), so the pin covers what the page actually sends."
human_verification:
  - test: "Open a STACK tool page and edit its Config (host/port) through the existing config editor; save"
    expected: "Four generated keys render (host, port, transfer_timeout_s, ledger_dir) with the generic heuristics; the edit saves and reloads"
    why_human: "Render/UI flow; no jsdom in repo; data path machine-proven, visual flow is not"
  - test: "Send a STACK read (e.g. Get Manager State) from the tool page against the real adapter (galago-tools Phase 5+ with return_reply: true)"
    expected: "Panel born hidden before any send; after the send the 'Reply meta_data' heading with the bounded read-only JSON appears under the Send button; without reply data the muted 'No reply data returned.' line shows; a second send collapses and replaces the panel"
    why_human: "Runtime render + external adapter behavior (assumption A1) — grep cannot see either"
  - test: "On a STACK command form, inspect untouched boolean (refresh) and number (timeout_s) fields, then type and clear values"
    expected: "Untouched fields render empty (no painted 0/false); typed values render as typed"
    why_human: "Visual rendering of the born-empty contract (AC-4)"
  - test: "After the CR-01 fix lands: type false into a STACK refresh field and send; inspect the wire payload/decoded command"
    expected: "The field decodes as real false; a typed string never decodes true; NaN from a cleared number never reaches the wire"
    why_human: "End-to-end operator-input-to-wire behavior through the live form — the untested pipeline named by CR-01/WR-01"
---

# Phase 5: STACK Codegen & Command Forms Verification Report

**Phase Goal:** galago-core builds against the frozen `stack.proto`, offers every STACK command except acknowledge as a command form, shows STACK read replies, and has the operator-acknowledge work proven on the real generated types.
**Verified:** 2026-11-02T03:38:16Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The phase's architectural core is real and proven on my own evidence: the submodule sits at the frozen commit `bcbbf8e` with all four proto stop-condition facts verified at that exact hash, the generated `stack.ts`/`controller.ts`/`tool_base.ts` exist with the full 10-key Command oneof and `ToolType.stack`, `commandFields.stack` declares exactly the 9 non-operator commands born-empty in proto order, `LATCH_READ_COMMAND` is the frozen oneof key, the OPR-05 flip landed in the same commit as the data entry, the shared bounded display is wired into both consumers, and the full phase gate is green on a fresh run (tsc 0 errors, 599/599 tests across 28 files, prettier clean). The acknowledge payload, the latch contract, the operator-only refusal, the zero-UI config path, and the both-ways omit-blank pin are all test-proven in that run.

**One must-have fails:** the D-04 blank-omitting send's clause "operator-typed 0 and false pass through" does not survive the page's real value pipeline. CR-01 (open Critical from 05-REVIEW.md) was independently re-confirmed link by link in source during this verification: `<Input type="boolean">` is a text input storing a string; `handleInputChange` converts only `text_array`; `omitBlankParams` correctly keeps the non-empty string; protobufjs `Writer.prototype.bool` is `value ? 1 : 0`; the generated encoder writes it on presence. A typed `"false"` encodes as `true` — and no input exists that sends `false`. WR-01 adds NaN-on-cleared-number. This violates CONTEXT D-04's own wording ("the payload sends what the operator typed") and 05-02's must-have truth 3. The mechanism-level D-04 pin passed because it tested `omitBlankParams`/encoder directly with real types — the fixture-only reliance is recorded below.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------- |
| 1 | Frozen-proto build: submodule at the frozen stack.proto commit, proto facts at that hash, regen through pinned ts-proto 1.151.1 (`snakeToCamel=false`), tsc/unit/prettier green (SC1, GEN-01) | ✓ VERIFIED | `git -C vendor/galago-tools rev-parse HEAD` → `bcbbf8e2458...`; `stack.proto` at that hash greps `optional string guid = 1`, `optional string arm_inspected = 2`, `get_failure_latch = 10`; `origin/feat/stack-tool` last `interfaces/` commit is exactly `bcbbf8e`; `.gitmodules` `branch = feat/stack-tool`; my own gate run: tsc 0 errors, 599/599 tests (28 files), prettier clean |
| 2 | Generated types: `stack.ts` (Command oneof ×10), `ToolType.stack = "stack"` in controller.ts, stack Command/Config branches in tool_base.ts, `createBaseConfig()` → 4-key default (D-02) | ✓ VERIFIED | Read all three generated files: 10 oneof keys verbatim in proto order, enum member at controller.ts:31, branches at tool_base.ts:241/270, defaults at stack.ts:1184-1186 |
| 3 | `commandFields.stack`: exactly the 9 non-operator commands in proto declaration order, every field `{name, type}` born-empty, no select, acknowledge_failure never listed (SC3, D-03, GEN-02) | ✓ VERIFIED | constants.ts:346 entry read in full: 9 keys in proto order, 12-field transfer (11 text + timeout_s number), 0 `defaultValue`, 0 `select`, 0 `acknowledge_failure` literals in the file; commandFields sweeps pass in suite |
| 4 | OPR-05 scan flip in the SAME commit as the entry; ack-absence assertion and closed 4-file carrier list intact; stack pin positive (05-01 t5) | ✓ VERIFIED | Commit `9529187` contains both constants.ts and staticScan.test.ts; staticScan.test.ts:665-674 shows the byte-identical `not.toContain("acknowledge_failure")`, untouched carrier-list test at :648, positive `expect(keys).toContain("stack")`; 43/43 staticScan tests pass in suite |
| 5 | `LATCH_READ_COMMAND = "get_failure_latch"` with the D-07b real-encoder contract test (SC5, GEN-04b) | ✓ VERIFIED | recoveryActions.ts:211; stackActivation.test.ts:32/:36 pins the constant and round-trips its payload through `tool_base.Command` — passes in suite |
| 6 | Ack payload `{stack:{acknowledge_failure:{guid, arm_inspected:"yes"}}}` round-trips the real generated encoder (D-07a, SC5, GEN-04a) | ✓ VERIFIED | wire.test.ts:57-67 asserts both decoded fields — passes in suite |
| 7 | Command panel renders for ToolType.stack — `toolCommandsDefined` finds `commandFields.stack` (05-02 t1) | ✓ VERIFIED | Entry exists; `[id].tsx:71` lookup `Object.keys(commandFields).includes(String(config?.type))` is deterministic with the key present; staticScan stack pin passes |
| 8 | Born-Empty Display Contract renders empty for untouched fields, typed 0/false render as before (D-03 display, UI-SPEC AC-4) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Fallback fixes (`?? ""`) verified in source at [id].tsx:266-282/314-330 and source-pinned by toolPageReply tests; the on-screen render is unexercised (no jsdom) — see Human Verification |
| 9 | Blank-omitting STACK send: strips empty-string/undefined/null before the mutation; operator-typed 0 AND false pass through; non-STACK types verbatim (D-04, 05-02 t3) | ✗ FAILED | Strip mechanism, STACK-only scoping ([id].tsx:173) and F.A.S.T.-verbatim all hold (commandParams unit tests + both-ways wire pin, green in suite) — but CR-01 (re-confirmed in source): typed `"false"` on a refresh field encodes as `true` (`Input type="boolean"` text fallback → string stored → kept by strip → `Writer.bool` truthiness); no input can send false. WR-01: cleared NumberInput stores NaN which the strip keeps. See Gaps |
| 10 | Reply meta_data panel: born hidden, read-only shared display under Send, no-data muted line, one panel replaced/collapsed per send (SC4, GEN-03) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Wiring verified in source: tri-state `lastReply` ([id].tsx:62) set only in onSuccess (`data ?? null`, :139), `setReplyOpen(false)` at send start (:125), shared `BoundedRawJson` render (:394-404); runtime render unexercised (no jsdom; adapter `return_reply` is external assumption A1) — see Human Verification |
| 11 | ONE shared bounded display; RunRecoverySection renders through it with copy/behavior unchanged (D-06, D-08) | ✓ VERIFIED | RunRecoverySection.tsx:43 alias import `BoundedRawJson as LatchRawJson`, 2 render sites (:220, :247), 0 local definitions remain; re-targeted G-04-2 block passes (43/43 in suite) |
| 12 | No timers/polling/Enter-binding/defaultValue/type=submit in touched modules; reply panel display-only (05-02 t9) | ✓ VERIFIED | Grep for `setInterval\|setTimeout\|refetchInterval` in [id].tsx: empty; toolPageReply source scans pass in suite |
| 13 | D-08 retrofits: 8 cast sites mechanically swapped to `ToolType.stack`; leave-alone casts untouched; no Phase 4 restructuring (05-03 t1) | ✓ VERIFIED | `ToolType.stack` present in operatorOnly/latchStatus/recoveryControl test files; the 3 files' 72 tests pass in suite; leave-alone sites not in any phase diff |
| 14 | Operator-only refusal keyed on real `ToolType.stack` with zero sends and audited warning (GEN-04e, SC5) | ✓ VERIFIED | operatorOnly.test.ts:155 case asserts refusal + `grpc.executeCommand` called 0 times (:168) — passes in suite |
| 15 | `getToolConfigDefinition(ToolType.stack)` resolves the exact 4-key generated default with zero config code (D-05) | ✓ VERIFIED | tools.test.ts:148-152 `toStrictEqual({host:"", port:0, transfer_timeout_s:0, ledger_dir:""})` — passes in suite; no config UI code written |
| 16 | The operator can open a STACK tool page and set its Config (host/port) there (SC2 — UI half) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Data path fully proven (truth 15) and the generic editor renders any definition; the visual edit flow is unexercised — see Human Verification |
| 17 | commandFields sweeps D-07c: 9 commands proto order, latch in, ack out, no defaultValue, no select; transfer 12-field pin (05-03 t2) | ✓ VERIFIED | commandFields.test.ts:45-54 + transfer pin — passes in suite |
| 18 | D-07d activation: `Object.values(ToolType)` contains "stack"; zToolType derivation source pin; zToolCreate/zTool accept stack; live Tool via installFakeTool (05-03 t2) | ✓ VERIFIED | stackActivation.test.ts:57/:61/:68/:72/:81 — all pass in suite; routers/tool.ts:17 derives zToolType from `Object.values(ToolType)` |
| 19 | D-04 blank-optional wire pin both ways: stripped untouched fields decode absent; unstripped blank decodes present (05-03 t3) | ✓ VERIFIED (coincidental-reliance) | wire.test.ts:79-116 uses real omitBlankParams + real encoder — passes in suite; but the fixture hand-builds params with real types while the production formValues hands booleans over as strings (the CR-01 blind spot) — see coincidental_reliance_items |
| 20 | Full phase gate green: tsc --noEmit, npm run test:unit, prettier --check (05-03 t3) | ✓ VERIFIED | My own run at HEAD: tsc 0 errors; vitest 599/599 (28 files, 51.8s); prettier clean — all exit 0 |

**Score:** 16/20 truths verified (3 present, behavior-unverified; 1 failed)

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| GEN-01 | 05-01 | Submodule bumped to frozen stack.proto commit; gen-interfaces regenerated with ts-proto 1.151.1 (snakeToCamel=false, never 1.153.2); tsc, suite, prettier green | ✓ SATISFIED | Truth 1: gitlink at bcbbf8e, proto facts at hash, gates green on fresh run |
| GEN-02 | 05-01, 05-02, 05-03 | commandFields.stack covers every STACK command except acknowledge_failure; required strings text with no defaultValue; no select pre-fills; STACK Config configurable from the tool page | ✓ SATISFIED | Truths 3, 7, 15, 16, 17: entry verified, config definition resolves; the CR-01/WR-01 defect is recorded against 05-02's D-04 must-have truth, not against GEN-02's REQUIREMENTS.md text — flagged below |
| GEN-03 | 05-02 | Tool-page command panel shows a command's reply meta_data read-only, so STACK reads are usable | ? NEEDS HUMAN | Truth 10: wiring complete and source-pinned; the visible display during a real read (and adapter `return_reply`) is human/UAT territory (assumption A1) |
| GEN-04 | 05-01, 05-03 | Activation tests on generated types: real-encoder wire test of acknowledge payload, latch read, operator-only refusal keyed on ToolType.stack | ✓ SATISFIED | Truths 5, 6, 13, 14, 18: all pass in the 599/599 suite run |

All 4 requirement IDs mapped to Phase 5 in REQUIREMENTS.md are claimed across the three plans' frontmatter (GEN-01: 05-01; GEN-02: 05-01/02/03; GEN-03: 05-02; GEN-04: 05-01/03). No orphaned requirements.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `vendor/galago-tools` (gitlink) | pinned to frozen stack.proto commit bcbbf8e | ✓ VERIFIED | rev-parse → bcbbf8e2458...; proto facts verified at that hash. Not fingerprintable as a file (submodule dir) — pinned by hash instead |
| `.gitmodules` | branch = feat/stack-tool | ✓ VERIFIED | Verified in file |
| `controller/gen-interfaces/tools/grpc_interfaces/stack.ts` | generated stack module: Command oneof ×10, Config 4-key create() defaults | ✓ VERIFIED | 45KB generated module; all 10 oneof keys; createBaseConfig defaults verified |
| `controller/gen-interfaces/controller.ts` | ToolType gains stack = "stack" | ✓ VERIFIED | line 31 |
| `controller/gen-interfaces/tools/grpc_interfaces/tool_base.ts` | stack Command/Config oneof branches | ✓ VERIFIED | lines 241, 270 |
| `controller/components/tools/constants.ts` | commandFields.stack (9 commands, born-empty) | ✓ VERIFIED | full entry read; D-03 rules hold |
| `controller/server/recoveryActions.ts` | LATCH_READ_COMMAND = "get_failure_latch" | ✓ VERIFIED | line 211 |
| `controller/components/ui/BoundedRawJson.tsx` | shared bounded display: BoundedRawJson + formatLatchRaw exports | ✓ VERIFIED | both exports present; styling matches the LatchRawJson pattern; display-only |
| `controller/components/tools/commandParams.ts` | exported pure omitBlankParams | ✓ VERIFIED | pure, non-mutating, one-level nested strip (unit-tested) |
| `controller/pages/tools/[id].tsx` | lastReply state + Reply meta_data block + born-empty renderFields + STACK-scoped strip | ✓ VERIFIED (wiring) | all four present and wired; render behavior → human items |
| `controller/components/tools/RunRecoverySection.tsx` | renders through shared component, copy unchanged | ✓ VERIFIED | alias import, 2 sites, 0 local defs |
| `controller/test/stackActivation.test.ts` | D-07b latch contract + D-07d activation cases | ✓ VERIFIED | 7 tests pass in suite |
| `controller/test/wire.test.ts` | D-07a ack case + D-04 blank-optional both-ways case | ✓ VERIFIED | cases at :57-67 and :79-116 pass in suite |
| `controller/test/boundedRawJson.test.ts`, `test/toolPageReply.test.ts`, `test/commandParams.test.ts` | format fallback chain, panel source invariants, strip unit tests | ✓ VERIFIED | all pass in suite |
| `controller/test/operatorOnly.test.ts`, `latchStatus.test.ts`, `recoveryControl.test.ts`, `tools.test.ts`, `commandFields.test.ts`, `staticScan.test.ts` | retrofits, config case, sweeps, flipped scan | ✓ VERIFIED | all pass in suite |

All artifacts are wired (imported and used) — no ORPHANED, no STUB, no MISSING.

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| vendor/galago-tools @ bcbbf8e stack.proto | gen-interfaces stack.ts | protoc + pinned ts-proto 1.151.1 | ✓ WIRED | All 10 oneof keys and field names match the frozen proto verbatim (snakeToCamel=false) |
| generated stack.Command oneof keys | commandFields.stack keys | D-03 mapping, proto declaration order | ✓ WIRED | Key-by-key comparison: 9/9 verbatim, ack excluded |
| server/recoveryActions.ts LATCH_READ_COMMAND | generated stack.Command oneof | D-07b contract test | ✓ WIRED | stackActivation contract test passes on the real encoder |
| trpc.tool.runCommand onSuccess data | [id].tsx lastReply state | setLastReply(data ?? null) | ✓ WIRED | [id].tsx:139; onError leaves panel untouched |
| handleSubmit | commandMutation.mutate | omitBlankParams for STACK only | ✓ WIRED | [id].tsx:173 — `String(config?.type) === "stack"` ternary (the only scope where the CR-01 value-type defect enters) |
| page + RunRecoverySection | BoundedRawJson.tsx | single shared display | ✓ WIRED | Both consumers import and render it; no second styled copy |
| routers/tool.ts zToolType | generated ToolType enum | z.enum(Object.values(ToolType)) | ✓ WIRED | tool.ts:17; source-pinned against hand-written lists |
| omitBlankParams | real tool_base.Command encoder | both-ways wire test | ✓ WIRED | wire.test.ts blank-optional case passes (fixture-only reliance recorded) |
| server/tools.ts getToolConfigDefinition | generated stack Config | dynamic import + create({}) | ✓ WIRED | tools.test.ts config case passes with zero config code |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| [id].tsx reply panel | lastReply | runCommand onSuccess reply (`ExecuteCommandReply`) | ✓ real tRPC reply, tri-state | ✓ FLOWING |
| [id].tsx command panel | commandOptions | commandFields[config.type] from constants.ts | ✓ static config data (appropriate — it is form metadata) | ✓ FLOWING |
| tool config editor | config definition | getToolConfigDefinition(ToolType.stack) → generated module | ✓ real generated Config.create() | ✓ FLOWING |
| STACK send params | formValues → omitBlankParams → payload | operator input | ⚠️ boolean fields flow as STRINGS (CR-01), cleared numbers as NaN (WR-01) | ⚠️ value-type corruption at the page pipeline (the gap) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full phase gate at HEAD | `npx tsc --noEmit` && `npx vitest run` && `npx prettier . --check` | tsc 0 errors; 599/599 tests / 28 files; prettier clean; all exit 0 | ✓ PASS |
| Ack payload survives real encoder | covered by wire.test.ts case in the suite run | guid + arm_inspected asserted intact | ✓ PASS |
| Latch constant pins the real oneof | covered by stackActivation contract in the suite run | decode carries the get_failure_latch branch | ✓ PASS |
| Operator-typed false survives page pipeline to wire | no test exercises this path (CR-01) | typed `"false"` provably encodes as `true` (source-confirmed chain) | ✗ FAIL — the gap |
| STACK tool page config edit / reply panel render / born-empty render | requires running the app (no jsdom) | — | ? SKIP → human verification |

### Probe Execution

None declared — no `scripts/*/tests/probe-*.sh` probes exist and no plan declares a probe. Not applicable.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| controller/pages/tools/[id].tsx | 65-70, 179-191, 222-232 | Commented-out dead function blocks (pre-existing, review IN-02) | ℹ️ Info | None on goal; cleanup candidate |
| controller/pages/tools/[id].tsx | 266-282 | `<Input type="boolean">` — invalid HTML input type; string-typed values reach the wire as truthy booleans (CR-01) | 🛑 Blocker (counts under the failed must-have) | Operator cannot send false on STACK refresh fields |
| controller/pages/tools/[id].tsx | 325-327 | NumberInput onChange stores NaN when cleared (WR-01) | ⚠️ Warning | Visually-emptied timeout_s still sent as NaN |
| controller/components/tools/commandParams.ts | 20-23 | Comment understates recursion depth; all-blank nested groups survive as `{}` (IN-01, unreachable today) | ℹ️ Info | None behavioral today |

No TBD/FIXME/XXX/HACK/PLACEHOLDER debt markers in any phase file (the recoveryActions.ts PLACEHOLDER comment was refreshed as planned). No timers, no empty-return stubs, no hardcoded-empty props in the phase's artifacts.

### Prohibition Checks (judgment-tier — non-authoritative LLM-judge verdicts; human review recommended)

`unverified-prohibition — human review recommended`: the plans' prohibitions are judgment-tier; verdicts below are LLM-judged, not machine-proven.

| Prohibition | Verdict (non-authoritative) | Supporting evidence |
| ----------- | --------------------------- | ------------------- |
| No code path acknowledges/cancels/retries/parks on its own; ack never in commandFields.stack, runControl, or any automated send path | Supported | OPR-05 scans pass in suite (closed 4-file carrier list, commandFields/runControl absence, executeCommand-guard placement); zero ack literals in constants.ts; operatorOnly zero-send tests pass |
| Generated gen-interfaces never hand-edited; stack.proto never patched locally; submodule at the recorded frozen commit | Supported | Generated output consistent with pinned-plugin shape; proto facts verified at bcbbf8e; commit history clean |
| Tests never drive real STACK or F.A.S.T. motion — fakes only | Supported | All STACK test paths use installFakeTool/FakeGrpc; no real-instrument calls found in test files |
| No STACK command field ships a defaultValue or a select | Supported (test-enforced) | commandFields sweeps assert both; 0 matches in the entry |

### Human Verification Required

### 1. STACK tool Config editing on the tool page

**Test:** Open a STACK tool page, open the config editor, edit host/port, save.
**Expected:** The four generated Config keys render via the generic heuristics (host → IP input, port → number) and the edit saves.
**Why human:** Render/UI flow with no jsdom/RTL in the repo; only the definition resolution is machine-proven.

### 2. Reply meta_data panel during a real STACK read

**Test:** Send a STACK read (e.g. Get Manager State) from the tool page against the real adapter.
**Expected:** Born hidden before any send; after a completed send the "Reply meta_data" heading with the bounded read-only JSON (or the muted "No reply data returned." line) appears under the Send button; each new send collapses and replaces the panel.
**Why human:** Runtime render + external adapter `return_reply` behavior (assumption A1) — neither visible to grep.

### 3. Born-empty render on STACK command fields

**Test:** On a STACK command form, inspect untouched refresh/timeout_s fields, then type and clear values.
**Expected:** Untouched fields render empty (no painted 0/false); typed values render as typed.
**Why human:** Visual rendering of the AC-4 display contract; source fallbacks are pinned but the browser render is not.

### 4. CR-01/WR-01 UAT sentinel (after the fix)

**Test:** Type `false` into a STACK refresh field and send; then type-and-clear a timeout_s and send.
**Expected:** The refresh field decodes as real `false`; the cleared timeout_s is absent from the payload; no NaN reaches the wire.
**Why human:** End-to-end operator-input-to-wire behavior through the live form — exactly the pipeline no test currently exercises.

### Gaps Summary

One gap, two defects, one root area: **the page's real value pipeline for boolean and cleared-number STACK fields**, unexercised by any test. The D-04 blank-omitting mechanism is correct as shipped (pure strip, STACK-only scoping, both-ways encoder pin), but the values the page actually hands it are corrupted upstream for these two field types: booleans arrive as truthy strings (`"false"` → wire `true`; no input can send `false`) and cleared numbers arrive as NaN (a visually-blanked field is still sent). This fails 05-02's must-have truth 3 clause "operator-typed 0 and false pass through" and CONTEXT D-04's own wording ("the payload sends what the operator typed"). The open Critical CR-01 and Warning WR-01 from 05-REVIEW.md stand; their disposition is open and their named fix (boolean-aware control + coercion, NaN-as-blank, plus the missing boolean wire test through the page pipeline) is the closure path — via `/gsd-code-review 05 --fix` or a quick task. Phase 5 is the milestone's final phase, so no later phase defers this gap (Step 9b: no deferrals).

Everything else the phase promised is real and proven on fresh evidence: frozen-proto build at `bcbbf8e` with pinned codegen, the 9-command born-empty `commandFields.stack` with the same-commit scan flip, the renamed latch constant pinned on the real oneof, the acknowledge payload proven on the real generated encoder, the operator-only refusal keyed on `ToolType.stack` with zero sends, the zero-UI config path, the shared bounded display wired to both consumers, and the full gate green (599/599).

---

_Verified: 2026-11-02T03:38:16Z_
_Verifier: the agent (gsd-verifier)_
