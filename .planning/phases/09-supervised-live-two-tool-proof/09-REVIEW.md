---
phase: 09-supervised-live-two-tool-proof
reviewed: 2026-11-17T11:29:54Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - controller/test/liveLanesProtocol.test.ts
  - controller/test/laneOneSend.test.ts
  - controller/test/staticScan.test.ts
  - .planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh
  - .planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event1.protocol.json
  - .planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event2.protocol.json
  - .planning/phases/09-supervised-live-two-tool-proof/protocols/09-sim-drill.protocol.json
  - .dockerignore
findings:
  critical: 1
  warning: 6
  info: 10
  total: 17
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-11-17T11:29:54Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Scope was the phase-09 diff `7fb40fe..HEAD`: the three new or extended controller tests, the evidence
and sim-control shell script, the three script protocols (embedded JS reviewed line by line), and the
new root `.dockerignore`. Context: `09-CONTEXT.md` including the 2026-11-17 amendments (D-02 amended,
D-03 dropped, D-13 "B", D-18 narrow). There is no `CLAUDE.md` and no project skills directory.

All 136 tests in the three test files pass offline (`npx vitest run`, fakes only). Nothing was run
against the live server or any tool.

What holds up:
- The event 1 and event 2 scripts implement the amended D-02 guards as written. Event 2 sets
  out1 = overlap source and has no `-x2`, which follows the dropped D-03. Step keys are unique and
  distinct across runs. The `galago.lane()` reset is correct. The barriers on the F.A.S.T. row and on
  out1 are both required by `isEligible` and both are present. I traced `laneScheduling.isEligible`
  and confirmed x1 cannot start until in1 and in2 are no longer pending, and out1 waits for both
  x1 and the F.A.S.T. row.
- The `phase9-ctl.sh` stop-sim guard (exact `--port=<sim>` argv element plus a real-port listener
  cross-check) is sound for the cases it covers.

Key concerns:
- **The sim drill's real-tool refusal can be bypassed.** It compares names with `toUpperCase()`, but
  the queue resolves tool ids through `normalizeToolKey` against a global tool store that is not
  scoped to a workcell (CR-01).
- **The script starts "sim" servers that can drive real hardware.** `start-sim` launches the real
  driver modules, which share the real STACK ledger directory. Nothing in the script makes them
  simulated (WR-01).
- **Some guard checks can pass while proving nothing.** `check-guards` can print `GUARDS OK` after
  checking zero listener pairs (WR-02). The D-15 pin does not cover `claimEligible` (WR-03).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The sim drill's real-tool refusal is bypassed by name variants that the queue still resolves to the real tool

**File:** `.planning/phases/09-supervised-live-two-tool-proof/protocols/09-sim-drill.protocol.json:206` (scriptContent, lines `var REAL = ["STACK2-6", "FA100056"]; if (REAL.indexOf(stackTool.toUpperCase()) >= 0 || ...)`); test gap at `controller/test/liveLanesProtocol.test.ts:728`

**Issue:** The drill refuses a real tool only when the upper-cased, trimmed name exactly equals
`STACK2-6` or `FA100056`. The queue does not identify tools that way. `CommandQueue.executeCommand`
calls `Tool.executeCommand(commandInfo)` (`controller/server/command_queue.ts:640`), which calls
`getToolFromStore` (`controller/server/tools.ts:58-70`). That function matches entries by
`normalizeToolKey` (lowercase, all non-alphanumerics stripped) in the process-global
`__global_tool_store`, which is not scoped to a workcell. `createFromProtocol` never checks that the
tool belongs to the selected workcell (`controller/server/runs.ts:222-296`).

I reproduced this offline with a `vm` probe of the shipped script. All of these were **accepted** and
produced queued transfers:
- `stack_tool="STACK_2-6"` (key `stack26`)
- `fast_tool="FA-100056"` (key `fa100056`)
- `stack_tool="stack 2 6"`, `fast_tool="fa_100056"`

Each key is identical to the real tool's key. If the real `STACK2-6` or `FA100056` instance is still
in the global store, the drill sends commands to a real instrument. That happens when the store was
not cleared after the workcell switch: the clear is a fire-and-forget client mutation in
`components/workcell/WorkcellCard.tsx:47`, and another browser session can repopulate the store. The
default F.A.S.T. parameters (deck 1 to 2, 5 uL, fresh tips) are valid, so the real liquid handler
would move. This breaks D-10 ("No real tool receives a command during the drill") and the protocol's
own claim that it "Refuses the real tool names".

The deny-list design has a second weakness: any other real tool in the store, with any name, passes.
Test (d) only covers case and whitespace variants, so it does not catch this.

**Fix:** Compare normalized keys, and use an allow-list instead of a deny-list:
```js
var REAL_KEYS = ["stack26", "fa100056"];
var sk = toolKey(stackTool), fk = toolKey(fastTool);
if (REAL_KEYS.indexOf(sk) >= 0 || REAL_KEYS.indexOf(fk) >= 0) {
  throw new Error("LIV-02: the drill must not address a real tool");
}
// Positive allow-list: the drill may address only sim tool instances.
if (sk.indexOf("sim") !== 0 || fk.indexOf("sim") !== 0) {
  throw new Error("LIV-02: the drill addresses only tools whose name starts with SIM");
}
```
Add `"STACK_2-6"`, `"stack 26"`, `"FA-100056"` and `"fa_100056"` to test (d).

## Warnings

### WR-01: start-sim launches the real-capable driver and shares the real STACK ledger; nothing enforces simulation

**File:** `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh:228-248` (line 238)

**Issue:** `start-sim` runs `python3 -m tools.stack.server` or `tools.fast.server`. These are the same
modules that drive the real instruments. A server is simulated only when galago-web sends
`Configure` with `simulated: true` (`vendor/galago-tools/tools/base_server.py:98-108`). A later
`Configure` with `simulated` off switches the server out of simulation, and it then runs the real
`_configure` path. If the uat-sim workcell's tool config ever carries real endpoints (for example,
copied from STACK2-6), the "sim" server on port 40091 or 40092 can command real hardware.

The child also inherits the caller's environment. With no `XDG_STATE_HOME` override, the sim STACK
server resolves the same ledger directory as the real server
(`resolve_ledger_dir`, `~/.local/state/galago-tools/stack`). The header's claim "READ-ONLY toward
every real tool" holds for HTTP and the files the script reads. It does not hold for the processes the
script starts.

**Fix:** Start the sim with an isolated state directory, so a sim run can never touch the real
ledger:
```bash
( cd "$TOOLS_DIR" && XDG_STATE_HOME="$STATE/sim-$name-state" setsid -f nohup "$TOOLS_DIR/.venv/bin/python3" -m "$mod" --port="$port" > "$logf" 2>&1 < /dev/null )
```
Also add a read-only pre-drill check, for example a `verify-sim` subcommand. It would call
`GET /api/trpc/tool.status` for SIM-STACK and SIM-FAST and require the status `SIMULATED` before the
drill's GO gate. Record the result in the baseline.

### WR-02: check-guards prints GUARDS OK even when it checked zero real listeners

**File:** `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh:282-295`

**Issue:** The loop runs `for pid in $(pids_on_port "$p")`, and `pids_on_port` returns nothing when
`ss -p` cannot see the owning process. That covers:
- a root-owned `docker-proxy` on 3010 or 8081
- a different user
- a tool server that is down

In each case the real-listener refusal is never exercised, but the script still prints
`refusals verified for 0 ...` followed by `GUARDS OK`. A pre-flight that greps for `GUARDS OK` would
then pass without evidence.

**Fix:** Fail closed when the two instrument ports cannot be checked:
```bash
for p in 40001 40012; do
  [ -n "$(pids_on_port "$p")" ] || { echo "GUARD FAIL: no visible listener PID on real port $p" >&2; exit 1; }
done
[ "$checked" -gt 0 ] || { echo "GUARD FAIL: no real-listener refusal was exercised" >&2; exit 1; }
```

### WR-03: The D-15 pin ends before the claim and never asserts that claimEligible is synchronous

**File:** `controller/test/staticScan.test.ts:1398-1407` (span built at the `claimEligible(` index)

**Issue:** `dispatchSpan` slices `region.slice(from, claim)`, so the span stops at the start of the
`claimEligible(` call. The "helpers on the span are synchronous" test pins `_dispatchGate`,
`laneScheduling` and `queuedRowsSync`, but not `SqliteQueue.claimEligible`
(`controller/server/utils/SqliteQueue.ts:155`).

Suppose `claimEligible` became `async` with an await before its `UPDATE`, or its transaction callback
became async. The halt latch could then flip between the eligibility verdict and the status write,
reopening the IN-01 window that D-15 says this test pins. The suite would stay green. The negative
control only mutates the call site (`await this.commands.claimEligible(`), not the callee.

**Fix:** Pin the callee too:
```ts
const claimFn = extractBracedRegion(sq, /^[ \t]*claimEligible\(queueId: number\)/m);
expect(sq).not.toMatch(/^[ \t]*async[ \t]+claimEligible\(/m);
expect(claimFn).not.toMatch(ASYNC_BOUNDARY);
```

### WR-04: liveLanesProtocol.test.ts depends on a planning-phase directory outside the controller

**File:** `controller/test/liveLanesProtocol.test.ts:26-33`

**Issue:** `PROTOCOL_DIR` resolves to `<repo>/.planning/phases/09-supervised-live-two-tool-proof/protocols`
by going up through `__dirname/../..`. The controller suite then breaks in two foreseeable cases:
- **The phase is archived.** `/gsd-cleanup` moves phase directories into the milestone archive.
- **Tests run in `galago-web-dev`.** Under amended D-13, `./controller` is bind-mounted at `/app`, so
  `../..` resolves to `/` and every protocol load throws `ENOENT`.

Either way all 31 tests fail at load, which hides real regressions behind a fixture-path error.

**Fix:** Copy the three protocol JSONs into `controller/test/fixtures/phase9/` and load them from
there. Then add a test, or a separate check that runs only when the planning copy exists, asserting
the fixtures stay byte-identical to the `.planning` copies.

### WR-05: The root .dockerignore omits .env, the live SQLite store and logs; controller/.dockerignore is dead

**File:** `.dockerignore:1-5`

**Issue:** Both compose files build with `context: .` (the repo root). Docker therefore uses only the
root `.dockerignore`, which excludes just `controller/node_modules`, `controller/.next` and `.git`.

The production Dockerfile runs `COPY controller/ ./`. That copies the live store into the builder
stage, along with `controller/app.log`:
- `controller/data/app.db`, `queue.db`
- their `-wal`/`-shm` files
- `*.bak-pre-*` backups

These files hold workcell, tool and queue data. The builder layer is cached on the host, and whether
Next's standalone trace pulls `data/` into the runner depends on `process.cwd()` tracing. The root
`.env`, `.planning` (15 MB), `vendor`, `graphify-out` and `.opencode` are all sent as build context.

`controller/.dockerignore` still lists `.env` and `*.log`, but with a repo-root context it never
applies. That gives a false sense that `.env` is excluded.

**Fix:**
```
controller/node_modules
controller/.next
controller/data
controller/*.log
**/.env
**/.env*.local
.git
.planning
.opencode
graphify-out
vendor
```
Check first that nothing in either Dockerfile copies `vendor/`. Then delete
`controller/.dockerignore`, or note in it that it is unused.

### WR-06: Event protocols say "Every input is validated" but never cross-check the cycle-leg locations

**File:** `.planning/phases/09-supervised-live-two-tool-proof/protocols/09-live-lanes-event1.protocol.json:366`, `09-live-lanes-event2.protocol.json:374` (scriptContent, the `var plate1 = loc(...)` through `var tray2 = loc(...)` block and the guards after it)

**Issue:** The overlap guards are thorough, but the operator-typed cycle locations have no guards:
- Nothing requires `tray1` and `tray2` to differ. A typo of `tray2_nest=5` sends in2 onto the
  occupied `fa100056/tray1/5`.
- Nothing requires `plate1` and `plate2` to differ.
- Nothing requires the plate homes to be off the F.A.S.T. device.
- Nothing requires the tray devices to be the same device that the overlap F.A.S.T.-side guard
  compares against.

These legs are physical arm moves beside a liquid handler. The scripts' opening comment promises
validation before any `galago` call, so a reader assumes these cases are covered.

**Fix:** Add guards before the first `galago` call, along these lines:
```js
if (sameLoc(tray1, tray2)) { throw new Error("LIV-01: the two F.A.S.T. tray slots must differ"); }
if (sameLoc(plate1, plate2)) { throw new Error("LIV-01: plate 1 and plate 2 homes must differ"); }
if (plate1.device === tray1.device || plate1.device === tray2.device ||
    plate2.device === tray1.device || plate2.device === tray2.device) {
  throw new Error("LIV-01: a plate home must not be on the F.A.S.T.-side device");
}
```
Add a test case for each new guard to `liveLanesProtocol.test.ts`.

## Info

### IN-01: logs-since never prints its "no numeric wc" message; a missing key exits 1 silently

**File:** `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh:171, 187-188, 196`

**Issue:** `baseline_value` is `grep -m1 ... | cut`. Under `set -euo pipefail`, a missing key makes
`old_wc="$(baseline_value ...)"` return 1, so the script exits right away with status 1 and no
message. I verified this. The `die "baseline has no numeric $d.log.wc"` branch only runs for
non-numeric values such as `absent`. In the same way, `wc -l < "$TRACE_ROOT/$now_trace/$d.log"`
(line 189) aborts with a raw bash error if the newest trace folder lacks that log.

**Fix:** `baseline_value() { grep -m1 "^$2=" "$1" | cut -d= -f2- || true; }`, and add an explicit
`[ -f ... ] || die` before the `wc`.

### IN-02: LEDGER ignores XDG_STATE_HOME although the header lists it as an override

**File:** `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh:20, 33-34`

**Issue:** `STATE` honors `XDG_STATE_HOME`, but `LEDGER` is hard-coded to
`$HOME/.local/state/galago-tools/stack/stack-ledger.json`. The STACK server resolves
`$XDG_STATE_HOME/galago-tools/stack` when that is set and absolute. If the variable is set, the
baseline and ledger evidence would read a different file from the one the server writes.

**Fix:** `LEDGER="${XDG_STATE_HOME:-$HOME/.local/state}/galago-tools/stack/stack-ledger.json"`, or
remove `XDG_STATE_HOME` from the documented overrides and add a comment explaining the pinned path.

### IN-03: stop-sim neither cross-checks the PID file nor narrows the PID-reuse window

**File:** `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh:246, 253-260`

**Issue:** `start-sim` writes `$STATE/sim-$name.pid`, but `stop-sim` never reads it. The guard runs
before `kill`, but nothing re-checks `/proc/$pid/cmdline` immediately before signalling. The risk is
very small given the argv check, but the PID file is dead state.

**Fix:** Require the PID from `pids_on_port` to equal the recorded PID. Otherwise either drop the PID
file or document that it is informational only.

### IN-04: check-guards' "stop-sim real" case repeats the "bogus" case

**File:** `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh:270-274`

**Issue:** `real` is not a sim name either, so both calls fail in `sim_port_for` with exit 2. The
second case adds no coverage but reads as if it proves that real tools are refused.

**Fix:** Remove it or rename it. Real-listener refusal is already exercised through `refuse_reason`
at lines 282-289.

### IN-05: snapshot leaks its temp directory when a GET fails

**File:** `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh:155-167`

**Issue:** Under `set -e`, a failed `web_get` exits before `rm -rf "$tmp"`.

**Fix:** `trap 'rm -rf "$tmp"' RETURN` (or `EXIT`) after `mktemp -d`.

### IN-06: out1_dest_transfer_profile defaults differ between events; nest-1 gets two different profiles in event 2

**File:** `09-live-lanes-event1.protocol.json:249` (default `"Default"`), `09-live-lanes-event2.protocol.json:249` (default `""`)

**Issue:** In event 2, in1 picks from nest-1 with `transfer_profile` set to `Default`. x1 then places
onto that same nest-1 with `spare_b_transfer_profile` blank, so no destination profile is sent. The
default for out1's destination profile also flips between the two events. The test at
`liveLanesProtocol.test.ts:170` skips this parameter, so neither default is pinned. Event 2 passed
live, but the asymmetry is undocumented.

**Fix:** Document why the defaults differ, or make them consistent, and pin the defaults in the
tests.

### IN-07: laneOneSend "overlap run" never asserts an overlap, and it still contains the dropped x2 leg

**File:** `controller/test/laneOneSend.test.ts:33-54`

**Issue:** `releaseAll` resolves every gate each round. The test proves one send per `queueId`, but it
never asserts that the F.A.S.T. row and x1 were in flight together. The step list also still has
`stackStep("x2")`, which D-03 dropped. Overlap is proven separately in
`liveLanesProtocol.test.ts` (g1), so this is a naming and accuracy issue.

**Fix:** After in1 and in2 finish, assert that both gates are unsettled. Drop `x2`, or comment that
it is a generic extra row.

### IN-08: The post-claim await is pinned on the side lane only

**File:** `controller/test/staticScan.test.ts:1409-1420`

**Issue:** The side-lane test pins `_shouldSkip` as the only await between the claim and the send.
The primary loop has the same accepted window: the skip-variable lookups at
`command_queue.ts:1665-1692`, before `executeCommand` at line 2014. No test bounds it the same way.

**Fix:** Add the equivalent assertion for `_runBusyLoopWhileQueueNotEmpty` covering tool steps, or
note in the test why the primary loop is excluded.

### IN-09: Unused mock in liveLanesProtocol.test.ts

**File:** `controller/test/liveLanesProtocol.test.ts:10-12`

**Issue:** The test mocks `@/server/scripting/resolve-tool-types`, but `executeProtocolScript` does
not import it; only `generateCommandsFromProtocol` does.

**Fix:** Remove the mock, or call `generateCommandsFromProtocol` if the intent is to test the full
generation path.

### IN-10: overlap_timeout_s=0 is accepted and sent, but STACK reads 0 as "no override"

**File:** `09-live-lanes-event2.protocol.json:257` and `:374` (the `ot < 0` check)

**Issue:** STACK applies `timeout_s` only when it is above 0 (`tools/stack/server.py:1063`). Sending 0
therefore falls back to `Config.transfer_timeout_s` or the built-in default. Meanwhile the cycle legs
require a value above 0 (`positive`). The error text "at or above 0" suggests that 0 has a meaning,
which it does not.

**Fix:** Require a value above 0, matching `stack_timeout_s`, or describe 0 as "server default".

---

_Reviewed: 2026-11-17T11:29:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
