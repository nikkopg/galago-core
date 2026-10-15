---
created: 2026-10-15T05:00:34.361Z
title: Fetch F.A.S.T. plate list for source/dest plate dropdowns
area: ui
severity: minor
files:
  - controller/components/tools/constants.ts:318-319
  - controller/components/tools/types.ts:1-7
  - controller/components/protocols/AddToolCommandModal.tsx
  - controller/pages/tools/[id].tsx
  - vendor/galago-tools/interfaces/tools/grpc_interfaces/fast.proto
  - vendor/galago-tools/tools/fast/server.py:203-206
audit_acknowledged:
  milestone: v1
  at: 2026-10-16
---

## Problem

The F.A.S.T. Transfer command's `source_plate_id` and `dest_plate_id` are typed numbers
(`type: "number"` in `commandFields.fast.transfer`). The operator has to know the instrument's
plate IDs by heart. A wrong ID isn't caught until the adapter or instrument rejects the command;
the adapter only checks that it's >= 1 (`server.py:203-206`).

The F.A.S.T. itself already holds labware registrations and a supported-plate list, which is the
right source of truth. Nothing fetches it today:
- `fast.proto` has no command that lists plates. Its commands are Transfer, RunProtocol,
  ValidateProtocol, GetStatus, GetTipStatus, ScanTips, EjectTray, Pause, Resume and Abort.
- galago-core has no query that returns the plates.

## Solution

TBD. A likely shape:
1. **galago-tools (adapter):** add a read-only command such as `GetPlates`/`ListLabware` that
   returns the instrument's registered plates (ID plus description/format) through `fast_mcp`. It
   must not take the motion lock, and the result should be cacheable. This needs a proto
   regeneration and a new submodule pin in galago-core, the same flow as the Phase 1 re-pin.
2. **galago-core:** add a tRPC query that calls the new command for a given F.A.S.T. tool.
3. **UI:** render `source_plate_id` and `dest_plate_id` as dropdowns fed by that query, in the
   protocol `AddToolCommandModal` and on the tool page command form. The `select` field type added
   for IN-02 (`957636d`) only takes static `options`, so it needs a dynamic-options variant (for
   example a field flag naming an options source) or special-case rendering, like the PF400
   location/sequence selects already have.
4. Keep the variable picker (`{{var}}`) working for these fields. Decide how to behave when the
   instrument is offline: fall back to a number input, or show the last-known list.

Source and destination can be different plate types, so both dropdowns list all registered plates.
