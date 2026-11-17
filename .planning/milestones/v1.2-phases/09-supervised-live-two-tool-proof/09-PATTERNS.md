# Phase 9: Supervised Live Two-Tool Proof - Pattern Map

**Mapped:** 2026-11-17
**Files analyzed:** 9 (2 code test files, 1 offline protocol test, 2 protocol JSON, 4 docs/records)
**Analogs found:** 8 / 9 (all paths git-tracked; verified with `git ls-files`)

Tracked-source note: all galago-core paths below are tracked. The galago-tools runbook and `gal-02-handoff.protocol.json` are tracked in the galago-tools repo (`~/data/nikko/galago-tools`, branch `feat/stack-tool`); edit there, NOT in `vendor/galago-tools` (detached submodule, gitlink not re-pinned, D-17).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `controller/test/laneOneSend.test.ts` (new, D-09) | test | event-driven (fake queue) | `controller/test/lanes.test.ts` + `controller/test/helpers/laneHarness.ts` | exact |
| `controller/test/staticScan.test.ts` (add "dispatch span", D-15) | test (static scan) | transform | same file, `describe("concurrency lane seams ...")` at line 1305 | exact |
| live-lanes protocol offline test (new, e.g. `controller/test/liveLanesProtocol.test.ts`) | test | transform | `controller/test/laneScript.test.ts` | exact |
| live lanes protocol JSON (event 1 / event 2) | config/protocol (script) | request-response | `~/data/nikko/galago-tools/docs/runbooks/gal-02-handoff.protocol.json` (research: store protocol 15 not in repo) | role-match |
| sim-drill protocol JSON | config/protocol (script) | request-response | same as above | role-match |
| `.planning/phases/09-.../09-LIVE-EVIDENCE.md` | doc | n/a | runbook findings rows (`gal-07-live-handoff.md`, 3a-n) | partial |
| `.planning/phases/08-concurrency-lanes/08-REVIEW-DISPOSITION.md` (IN-01 row) | doc | n/a | itself (YAML front matter + table) | exact |
| `.planning/PROJECT.md`, `.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md` -> `todos/completed/` | doc | n/a | existing `.planning/todos/completed/*.md` | role-match |
| `~/data/nikko/galago-tools/docs/runbooks/gal-07-live-handoff.md` (rows 3a-11.., parallel variant) | doc | n/a | existing rows `3a-1..3a-10` | exact |

## Pattern Assignments

### `controller/test/laneOneSend.test.ts` (test, fakes only)

**Analog:** `controller/test/lanes.test.ts` (header lines 1-30) and `controller/test/helpers/laneHarness.ts` (exports: `stackStep`, `fastStep` at 38-44, `createLaneHarness` at 46, `LaneHarness` type at 188; harness uses `vi.useFakeTimers({ toFake: ["setTimeout"] })` and `new CommandQueue({} as any, { parallelLanes: true, ... })`).

**Imports + lifecycle pattern** (lanes.test.ts 5-17):
```ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { createLaneHarness, stackStep, fastStep, type LaneHarness } from "./helpers/laneHarness";

let h: LaneHarness | undefined;
afterEach(async () => {
  if (h) await h.teardown();
  h = undefined;
});
```
**Core pattern:** use the verified test body drafted in 09-RESEARCH.md "Finding 1" (lines 256-336): two tests (overlap run + run N+1 each queueId sent once; halt -> refused enqueue auto-start -> operator Start -> second Start: only the FAILED row sent twice). Harness API used: `h.push`, `h.start(["enqueue"])`, `h.tick(n)`, `h.calls()`, `h.fail(i, err)`, `h.finish(i)`, `call.gate.resolve/isSettled`. Existing partial coverage to not duplicate: `lanes.test.ts:93, :231, :278`, `laneHalt.test.ts:296`.
**Acceptance:** run a mutation check (weaken `claimEligible` status check), confirm failure, revert (not committed).

---

### `controller/test/staticScan.test.ts` (add D-15 pin)

**Analog:** same file. Helpers already in scope: `read(rel)` (line 43), `stripComments` (56), `extractBracedRegion` (118) (not exported, so add the new `describe` inside this file rather than a new one). Existing block to extend: `describe("concurrency lane seams (D-09, D-10, D-14)")` at line 1305, existing weaker pin at 1317-1325:
```ts
it("_pickNext has no await between the row read and the claim, and keeps the legacy call", () => {
  const region = extractBracedRegion(queueSrc, /private async _pickNext\(/);
  const read = region.indexOf("queuedRowsSync()");
  const claim = region.indexOf("claimEligible(");
  ...
  expect(region.slice(read, claim)).not.toMatch(/\bawait\b/);
```
**Add:** the verified `describe("dispatch span (D-15, IN-01)")` from 09-RESEARCH.md Finding 2 (lines 361-422): anchor-order check (state check < queuedRowsSync < pickEligible < _dispatchGate < claimEligible), ASYNC_BOUNDARY regex, negative-control that mutates the extracted REGION text (not whole file: `const rows = this.commands.queuedRowsSync();` also occurs in `laneStatus` ~line 1338), sync-helper check, and `_runSideLane` single-await (`_shouldSkip`) check. Companion existing pin: `sqliteQueueClaim.test.ts` "is declared without the async keyword".

---

### live-lanes protocol offline test (new)

**Analog:** `controller/test/laneScript.test.ts`

**Imports/mocks** (lines 5-22):
```ts
import { executeProtocolScript } from "@/server/scripting/protocol-script-executor";
vi.mock("@/server/scripting/resolve-tool-types", () => ({
  resolveToolTypes: vi.fn(async (commands: unknown[]) => commands),
}));
async function run(script: string) {
  const result = await executeProtocolScript(script, {});
  expect(result.success).toBe(true);
  return result.commands;
}
const advanced = (c: { advancedParameters?: unknown }) => c.advancedParameters as Record<string, unknown>;
```
**Pattern:** read the protocol JSON from disk (`fs`/`path`, as laneScript.test.ts already imports them), pass `scriptContent` plus sample params to `executeProtocolScript(script, params)`, then assert: each STACK `step_key` distinct and different across two invocations; `advanced(c).lane === "fast"` only on the F.A.S.T. step; overlap step has no `lane` key (sticky lane reset via `galago.lane()`); `laneBarrier === true` on F.A.S.T. and out1; `validateLanes(steps)` (from `@/server/laneScheduling`, used in `laneUi.test.ts:46,900`) returns `[]`. Event 1: overlap step is `get_transfer_estimate` with no `step_key`/`timeout_s`. Script API: `lane(name?)`, `command(toolId, command, params, { lane, barrier })` (`controller/server/scripting/protocol-script-executor.ts:24-55`).

---

### live lanes + sim-drill protocol JSON (script protocols)

**Analog:** `~/data/nikko/galago-tools/docs/runbooks/gal-02-handoff.protocol.json` — envelope `{ "protocol": { name, category, description, mode: "script", scriptContent, ... }, "exportedAt", "version" }`. Script style: validate every input and build all param objects BEFORE the first `galago` call; `text()/need()/whole()` helpers; per-run key base `label(<=20 chars) + "-" + new Date().toISOString() + "-" + rand8hex`, legs suffixed `-in1/-in2/-x1/-out1/-out2/-x2` (D-06). Store protocol 15 is not in any repo file: read it from the production store over HTTP GET (no tool contact) to copy parameter names, labware profile, nest triples (in1 `nest-1/deck1/A1 -> fa100056/tray1/5`, in2 `nest-2/deck\`/A1 -> fa100056/tray1/6`, F.A.S.T. deck 5->6, 5 uL, tip fresh, profile `Default`). Row order: see 09-RESEARCH.md Finding 3 (note, in1, in2, FAST `galago.lane("fast")` + barrier, `galago.lane()` reset, overlap step, out1 barrier, out2, return). Drill protocol: valid sim STACK step first, then invalid-arg (`timeout_s: -1`) step, FAST on lane `fast` (Finding 4). Note: the gal-02 file lives in the galago-tools repo; new protocol JSON may be placed under the phase dir.

---

### `09-LIVE-EVIDENCE.md`, runbook rows 3a-11.., parallel variant

**Analog:** runbook rows `3a-1..3a-10` in `~/data/nikko/galago-tools/docs/runbooks/gal-07-live-handoff.md` (findings table). Hazards (09-RESEARCH.md Finding 5): last row `3a-7` is glued to `PASS |Row guidance:` (split at that exact string to insert inside the table); rows must not contain the exact phrase `Reply: literal go` (exactly 3 in the file; use "typed go"); put the parallel variant as a `###` inside Part 3 before `## Recovery drill (D-11)`; verify with `cd ~/data/nikko/galago-tools && .venv/bin/python -m unittest tools.tests.gal07_live_runbook_test.TestRunbookContent`. Commit only that file by explicit path (dirty tree), on `feat/stack-tool`; record the SHA in `09-LIVE-EVIDENCE.md`. Evidence content per D-16 (raw ms timestamps, ledger records, log counts, SHAs, `auto-mint: on (not exercised)`); snapshot row JSON before every operator Start (retry overwrites `startedAt`).

---

### `08-REVIEW-DISPOSITION.md` (IN-01)

**Analog:** itself. Front matter entry (`- id: IN-01 / severity: info / disposition: open / title: ...`) and table row `| IN-01 | info | open | - |`. Update both consistently (`skipped` with Source cell "accepted in Phase 9 D-15; pinned by test/staticScan.test.ts (dispatch span)"; adjust the header `open:` count). Value choice is ASSUMED; legend allows open/fixed/skipped/deferred.

---

### `.planning/PROJECT.md` and the lanes todo

**Analog:** PROJECT.md existing Validated bullet at line 138 (`- ✓ LAN-01..09, LUI-01..06 — v1.2: ...`); move Active item at line 148 (`- [ ] Per-toolId concurrency lanes proven live on two tools ...`) to Validated with an evidence pointer to `09-LIVE-EVIDENCE.md`; update the queue single-flight wording; add a key-decisions row in the style of lines 239-241 (`| decision | rationale | ✓ Phase 9 |`). Todo: add a resolution note to `.planning/todos/pending/scheduler-per-tool-concurrency-lanes.md`, then `git mv` it to `.planning/todos/completed/` (siblings there are the move convention).

## Shared Patterns

- **Fakes only / no motion:** all new tests use `createLaneHarness` (spies `Tool.executeCommand`); never contact tool servers or docker.
- **Prettier + tsc gates:** `controller/package.json` `test` (`npx tsc --noEmit`) and `test:fmt`; run on touched test files.
- **Typed-GO discipline (D-10/D-14):** pre-flight `PREFLIGHT OK`, baselines, typed GO with UTC timestamp, operator-only Start/Freeze; applies to every evidence plan.
- **Mutation negative-controls:** mutate extracted region text, not whole files (D-15 pin).

## No Analog Found

| File | Reason |
|---|---|
| Store protocol 15 (template for live protocol) | Not in any repo file; fetch from production store read-only |
| Sim STACK/F.A.S.T. launch procedure | Not recorded in any repo file; assumed `.venv/bin/python3 -m tools.stack.server --port=40091` style (see RESEARCH Finding 4) |

## Metadata

**Analog search scope:** `controller/test`, `controller/test/helpers`, `controller/server/scripting`, `.planning`, `~/data/nikko/galago-tools/docs/runbooks`
**Pattern extraction date:** 2026-11-17
