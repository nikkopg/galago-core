---
phase: 09-supervised-live-two-tool-proof
fixed_at: 2026-11-17T11:45:00Z
review_path: .planning/phases/09-supervised-live-two-tool-proof/09-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-11-17T11:45:00Z
**Source review:** .planning/phases/09-supervised-live-two-tool-proof/09-REVIEW.md
**Iteration:** 1

**Scope:** The user chose exactly CR-01, WR-01, WR-02 and WR-04. WR-03, WR-05, WR-06 and IN-01 to IN-10 are out of scope and still `open` in 09-REVIEW-DISPOSITION.md.

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: The sim drill's real-tool refusal is bypassed by name variants that the queue still resolves to the real tool

**Files modified:** `.planning/phases/09-supervised-live-two-tool-proof/protocols/09-sim-drill.protocol.json`, `controller/test/liveLanesProtocol.test.ts`
**Commit:** 4474bc9
**Status:** fixed: requires human verification (logic change in a safety guard)
**Applied fix:**
- The drill script now compares tool names through its existing `toolKey()` helper. That helper is the same transform as `normalizeToolKey` in `controller/server/toolKey.ts`: lowercase, then every non-alphanumeric character stripped.
- It refuses the real keys `stack26` and `fa100056` with "LIV-02: the drill must not address a real tool".
- It then applies an allow-list: both normalized keys must start with `sim`, otherwise it fails with "LIV-02: the drill addresses only tools whose name starts with SIM".
- Both checks run before any `galago` call. The protocol description was updated to match.

Test changes:
- Test (d) now also refuses `STACK_2-6`, `FA-100056`, `stack 2 6`, `fa_100056` and `stack 26`.
- New test (d2) refuses names that do not start with SIM: `stack-1`, `fast-1`, `PF400`, `Liquid Handler 2` and `my-SIM-STACK`. It accepts the defaults, `SIM-STACK`/`SIM-FAST`, and `sim_stack`/`Sim Fast`.
- Test (e) used `stack-1`/`fast-1`, which the allow-list now refuses. It now runs at the SIM defaults and maps the rows onto the lane harness fakes.

Negative control: against the old guard, (d) and (d2) fail. Against the new guard, they pass.

**Action needed:** The protocol already imported into the store (id 8) still carries the old upper-case deny-list guard. Delete it or re-import it from the updated JSON before any further drill.

### WR-01: start-sim launches the real-capable driver and shares the real STACK ledger; nothing enforces simulation

**Files modified:** `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh`
**Commit:** 98d0d61
**Applied fix:**
- I read `galago-tools` `tools/stack/ledger.py` `resolve_ledger_dir` read-only (vendor copy and the sibling repo are identical). It resolves the ledger directory in this order:
  1. an absolute `Config.ledger_dir`
  2. `$XDG_STATE_HOME/galago-tools/stack`, only when `XDG_STATE_HOME` is set and absolute
  3. `~/.local/state/galago-tools/stack`, the real ledger
- `start-sim` now launches the child with `XDG_STATE_HOME="$STATE/sim-state"`, which defaults to `~/.local/state/galago-phase9/sim-state`.
- It refuses a sim state home that is not absolute, because the server would ignore it and fall back to the real ledger.
- It also refuses a sim state home that resolves to the real ledger directory.
- The header comments now document both points.

Verification:
- I confirmed that the env var reaches a `setsid -f nohup` child.
- I confirmed that `resolve_ledger_dir` returns `~/.local/state/galago-phase9/sim-state/galago-tools/stack` for that env.

Not done:
- An explicit absolute `Config.ledger_dir` in the SIM-STACK tool config would still win over `XDG_STATE_HOME`. That field must stay blank. The script comment says so.
- The review's optional `verify-sim` subcommand was not added. The user asked only for state isolation.
- `start-sim` itself was not run.

### WR-02: check-guards prints GUARDS OK even when it checked zero real listeners

**Files modified:** `.planning/phases/09-supervised-live-two-tool-proof/tools/phase9-ctl.sh`
**Commit:** 88a972d
**Status:** fixed: requires human verification (guard logic)
**Applied fix:**
- A new `listener_uids` helper reads socket owner uids from `/proc/net/tcp{,6}` (LISTEN state).
- For each real port, `check-guards` now resolves the listener owner by PID (`ss -p`). If no PID is visible, it falls back to the socket uid.
- It exits 1 with `GUARD FAIL` and no `GUARDS OK` in each of these cases:
  - a listener's owner cannot be resolved at all
  - a listener with an unseen PID belongs to this script's own uid
  - the script runs as root and still cannot see a PID
  - zero real-listener/sim-port refusals were exercised
- A listener owned by a different uid is reported explicitly as kernel-protected, not silently skipped. On this host that is the root `docker-proxy` on 3010.
- Without this exception, `check-guards` would always fail on this host.

Negative controls on scratch copies: hiding all PIDs, hiding PIDs and uids, and reporting every socket as a foreign uid each exit 1 with no `GUARDS OK`.

### WR-04: liveLanesProtocol.test.ts depends on a planning-phase directory outside the controller

**Files modified:** `controller/test/liveLanesProtocol.test.ts`, `controller/test/fixtures/phase9/09-live-lanes-event1.protocol.json` (new), `controller/test/fixtures/phase9/09-live-lanes-event2.protocol.json` (new), `controller/test/fixtures/phase9/09-sim-drill.protocol.json` (new)
**Commit:** 81e274c
**Applied fix:**
- I copied the three protocol JSONs byte-for-byte into `controller/test/fixtures/phase9/`. The sim-drill copy includes the CR-01 guard.
- `PROTOCOL_DIR` is now `path.join(__dirname, "fixtures", "phase9")`. The fixtures are the tested copies.
- The `.planning/phases/09-supervised-live-two-tool-proof/protocols/` copies remain the historical record of what was imported for the live events. No byte-identity check was added, as the user requested.
- I ran the suite with the `.planning` protocols directory temporarily moved away, and all 32 tests in the file passed.

## Disposition record

`09-REVIEW-DISPOSITION.md`: the rows for CR-01, WR-01, WR-02 and WR-04 are set to `fixed` with their commit SHAs, and `open` dropped from 17 to 13. Commit: 96b38c7.

## Verification

All edits and commits were made in an isolated worktree on a temporary branch. `controller/node_modules` was symlinked into the worktree and unlinked before teardown. The branch was then fast-forwarded to `feat/stack-tool`.

The gates ran in the worktree and again in the **main checkout** after the fast-forward, with the same results. The numbers below come from the main checkout:

| Gate | Result |
|------|--------|
| `cd controller && npx vitest run` | 50 files, 1416 tests passed |
| `npx tsc --noEmit` | exit 0, no errors |
| `npx prettier --check test/liveLanesProtocol.test.ts` | clean |
| `bash -n phase9-ctl.sh` | OK |
| `phase9-ctl.sh check-guards </dev/null` | `GUARDS OK`, 8 real-listener/sim-port refusals; 3010 reported as root-owned and kernel-protected; no signal sent |

Nothing under `controller/` outside `controller/test/` was edited. `vendor/galago-tools` and the galago-tools repo were only read. No live-server mutating API or real tool was contacted.

---

_Fixed: 2026-11-17T11:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
