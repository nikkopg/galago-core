---
phase: 06-stack-dropdowns
plan: 01
subsystem: ui
tags: [trpc, grpc, react-query, chakra, stack, submodule, ts-proto]
requires:
  - phase: 05-stack-codegen-command-forms
    provides: stack command forms, commandFields.stack, the /tmp/opencode ts-proto 1.151.1 regen toolchain
provides:
  - vendor/galago-tools gitlink pinned at 4ccd3da656c0e981332018b3d33e16148a8bc513 with a proven zero regen diff
  - Tool.readOptions (5 s deadline, Metadata, never queued) and the closed four-source registry in server/toolOptions.ts
  - strict tool.options tRPC query (toolId, source, refresh only)
  - React-free FIELD_BINDINGS / mode derivation / select view model, useToolOptions hook, shared OptionsSelect
  - tool page STACK robot, labware_profile and source/destination transfer-profile fields as born-empty dropdowns
affects: [06-02, 06-03, 06-04, 06-05, 07-fast-dropdowns]
actuals:
  tokens: 9400
  tasks: 2
  commits: 2
plan_head_before: b7580b860e4e4eb9d47181d3e34ff065fffc2807
plan_head_after: c7da55a9f11665f88f16d35e071a642150df6e94
tech-stack:
  added: []
  patterns:
    - "Closed server registry keyed by source id; the browser sends an id, never a command or params"
    - "Read path isolated from the run path: Tool.readOptions is a sibling of the control send, never executeCommand"
    - "Client view model in a React-free module (server types via import type only)"
key-files:
  created:
    - controller/utils/variableRef.ts
    - controller/server/toolOptions.ts
    - controller/components/tools/fieldOptions.ts
    - controller/hooks/useToolOptions.ts
    - controller/components/tools/OptionsSelect.tsx
    - controller/test/toolOptionsRouter.test.ts
  modified:
    - vendor/galago-tools
    - controller/server/tools.ts
    - controller/server/routers/tool.ts
    - controller/pages/tools/[id].tsx
key-decisions:
  - "Tool.readOptions throws on transport or deadline and fetchOptions owns the try/catch, so the closed reason mapping lives in one place"
  - "OPTION_SOURCES is declared as const satisfies Record<string, OptionSourceEntry>, so OptionSourceId is derived from its keys"
  - "An idle (disabled) query reads as unavailable so the typed fallback input is never blocked behind a read that is not running"
requirements-completed: [STK-08, DRP-01, DRP-04, DRP-07, STK-01, STK-05, STK-06]
coverage:
  - id: D1
    description: "vendor/galago-tools pinned to 4ccd3da with a zero-diff ts-proto 1.151.1 scratch regen against controller/gen-interfaces, committed as a gitlink-only commit"
    requirement: "STK-08"
    verification:
      - kind: other
        ref: "scratch regen with explicit --plugin= then diff -r against controller/gen-interfaces prints NO_DIFF"
        status: pass
      - kind: other
        ref: "git rev-parse HEAD:vendor/galago-tools equals 4ccd3da656c0e981332018b3d33e16148a8bc513; git show --name-only 0cbd3d2 lists only vendor/galago-tools"
        status: pass
    human_judgment: false
  - id: D2
    description: "tool.options reads the four registry sources through Tool.readOptions with Metadata and a 5 s deadline, never queued; every failure maps to a closed reason code"
    requirement: "DRP-07"
    verification:
      - kind: integration
        ref: "controller/test/toolOptionsRouter.test.ts (13 cases: Metadata + deadline arguments, refresh gating, reason mapping, no Tool created for an unknown id, wrong_tool_type sends nothing, strict input rejection)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tool page STACK robot, labware_profile and transfer-profile fields render as born-empty dropdowns of what the instrument reports and fall back to a typed input with the hint on any failure"
    requirement: "DRP-01"
    verification:
      - kind: unit
        ref: "controller/test/toolPageReply.test.ts, commandFields.test.ts, staticScan.test.ts pass unedited; tsc --noEmit clean"
        status: pass
    human_judgment: true
    rationale: "Rendered dropdown behaviour against a live STACK is checked once at end-of-phase UAT (06-04, 06-05); no component test renders OptionsSelect yet (06-03 adds the view-model tests)."
  - id: D4
    description: "The pinned SHA 4ccd3da is fetchable from the GitHub URL in .gitmodules"
    requirement: "STK-08"
    verification: []
    human_judgment: true
    rationale: "Requires the user's own push of galago-tools feat/stack-tool (Task 3, human-action). At the time of writing GitHub's feat/stack-tool is still 9592509."
duration: 9min
completed: 2026-11-05
status: complete
---

# Phase 6 Plan 01: Pin and tracer Summary

**The submodule is pinned to 4ccd3da behind a proven zero-diff regen, and the STACK robot, labware-profile and transfer-profile fields on the tool page are born-empty dropdowns fed by a deadline-bounded, queue-free `Tool.readOptions` through a closed four-source registry and a strict `tool.options` query.**

## Performance

- **Duration:** 9 min (2026-11-05T13:37Z to 13:43Z)
- **Tasks:** 2 of 3 executed; Task 3 (human-action push) is pending, see below
- **Files:** 10 changed (6 created, 4 modified)

## Accomplishments

- Task 1: scratch regen with ts-proto 1.151.1 over the proto tree exported from 4ccd3da printed NO_DIFF; `git -C vendor/galago-tools checkout --detach 4ccd3da`, gitlink-only commit `0cbd3d2`; `.gitmodules` untouched, `controller/gen-interfaces` unchanged, `tsc --noEmit` clean.
- Task 2: `Tool.readOptions` (`new grpc.Metadata()`, `{ deadline: Date.now() + 5000 }`, no substitution, no audit row, no queue); `server/toolOptions.ts` with exactly four sources, strict parsers (verbatim names, `{{x}}` and blank names dropped and the list marked degraded), and a never-throwing `fetchOptions` that returns only closed reason codes.
- `tool.options` is a strict zod object declared above `latchStatus`, so the client cannot supply a command or params.
- `fieldOptions.ts` (binding map for transfer, get_transfer_estimate, get_labware_presence; mode derivation with `isError` first; born-empty select view), `useToolOptions` (no retry, no polling, staleTime 15000) and `OptionsSelect` (loading, ok, unavailable). Cascade-role bindings (device/deck/nest) are declared in the map but not yet rendered: 06-03 and 06-04 own the cascade.
- `toolOptionsRouter.test.ts` covers the whole path with a fake gRPC. Full controller suite: 29 files, 623 tests pass.

## Task Commits

1. **Task 1: Pin vendor/galago-tools to 4ccd3da** - `0cbd3d2` (chore)
2. **Task 2 (tracer): dropdowns end to end** - `c7da55a` (feat)
3. **Task 3: user pushes galago-tools feat/stack-tool** - PENDING (human-action)

## Pending Human Action (Task 3, T-06-12)

GitHub's `feat/stack-tool` is still `9592509`, so `git submodule update --init` on another machine cannot fetch 4ccd3da. The sibling clone at `/home/formulatrix/data/nikko/galago-tools` already has `feat/stack-tool` at `4ccd3da656c0e981332018b3d33e16148a8bc513`. The user runs the push (Claude pushes nothing):

`git -C /home/formulatrix/data/nikko/galago-tools push origin feat/stack-tool`

Then verify: `git ls-remote https://github.com/nikkopg/galago-tools.git feat/stack-tool` must print `4ccd3da656c0e981332018b3d33e16148a8bc513`. This summary is marked complete for the code work; the push is the only open item of this plan.

## Deviations from Plan

None - plan executed exactly as written. Two small judgment calls inside the plan's latitude: `OPTION_SOURCES` uses `as const satisfies` to derive `OptionSourceId`, and `parseRobotStates` / `parseProfiles` / `parseDeviceTree` return an internal `Parsed` union (a list, a tree, or the string `"bad_reply"`), which 06-02's parse tests should target.

## Known Stubs

None. `UNAVAILABLE_HINT` and `LOADING_LABEL` are intended UI-SPEC copy, not placeholders.

## Threat Flags

None. The new `tool.options` surface is the one in the plan's threat model (T-06-01, T-06-02, T-06-03, T-06-07 mitigated as specified; test coverage in `toolOptionsRouter.test.ts`).

## Next Phase Readiness

06-02 (server hardening) and 06-03 (client cascade core) can build on the contract in the plan's interfaces block, which is implemented verbatim. Against a simulated STACK every read returns SUCCESS without meta_data, so each field shows the typed fallback; live list visuals are an end-of-phase UAT item.

## Self-Check: PASSED

- Created files exist: variableRef.ts, toolOptions.ts, fieldOptions.ts, useToolOptions.ts, OptionsSelect.tsx, toolOptionsRouter.test.ts (all FOUND)
- Commits `0cbd3d2` and `c7da55a` are ancestors of HEAD
- `git rev-parse HEAD:vendor/galago-tools` is 4ccd3da656c0e981332018b3d33e16148a8bc513; regen NO_DIFF reproduced
- Acceptance greps pass (`options: procedure` line 546 is above `latchStatus: procedure` line 571; fieldOptions.ts has no react import; toolOptions.ts has no command-queue import)
- `tsc --noEmit` exit 0; full vitest 623 passed
- NOT yet verified: Task 3's `git ls-remote` check (needs the user's push)
