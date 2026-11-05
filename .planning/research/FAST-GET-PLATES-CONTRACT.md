# Contract: F.A.S.T. `get_plates` (galago-tools ↔ galago-core)

**Status:** proposed (2026-11-05). This file is the source of truth until galago-tools freezes the
proto commit. After that, the frozen commit replaces it.
**Consumers:** milestone v1.2, Phase 6 (F.A.S.T. plate-list dropdowns) in galago-core.
**Origin:** `.planning/todos/pending/2026-10-15-fetch-f-a-s-t-plate-list-for-source-dest-plate-dropdowns.md`

## Why

The F.A.S.T. Transfer command's `source_plate_id` and `dest_plate_id` are typed numbers today.
The instrument already holds the registered plate list, and fast-mcp already reads it:
`FastService.plate_definitions()` (`fast-mcp/fast_mcp/service.py:132`), exposed over MCP as
`list_plate_definitions` (`fast_mcp/mcp/server.py:106`). galago-tools needs to expose that read over
the galago gRPC interface so galago-core can fill the plate dropdowns with it.

## galago-tools side (`vendor/galago-tools`, branch `feat/stack-tool`)

### 1. Proto: `interfaces/tools/grpc_interfaces/fast.proto`

Add a new oneof entry. Do not add a new RPC: every F.A.S.T. call goes through `ExecuteCommand`.

```proto
message Command {
  oneof command {
    // ... existing 1-10 unchanged ...
    GetPlates get_plates = 11;
  }

  // Read-only: lists the plate definitions registered on the instrument.
  // Never takes the motion lock; safe while a transfer is running.
  message GetPlates {
    optional bool refresh = 1;   // true = bypass fast_mcp's knowledge cache
  }
}
```

Field numbers 1-10 and the existing messages must not change. `Transfer.expected_tray_id = 13`
stays, because old saved galago-core steps still send it (quick task 261104-or1).

### 2. Adapter: `tools/fast/server.py`

- Add a `GetPlates(self, params)` handler that calls
  `service.plate_definitions(refresh=bool(params.refresh))`.
- **No motion lock and no idle check.** It is a read, like `GetStatus`. It must skip the adapter's
  BUSY gate the same way the STACK adapter's `READ_COMMANDS` set does (galago-tools `4ccd3da`). It must succeed while a
  transfer is running, because galago-core may ask for the list while the operator edits a protocol
  mid-run.
- Return `SUCCESS` with `return_reply=True` and `meta_data` set as described below, using the
  existing Struct reply helper (`server.py` ~275).
- If the instrument can't be reached, use the existing error mapping (a non-SUCCESS response code
  plus `error_message`) and send no partial list.

### 3. Reply `meta_data` shape

```json
{
  "plates": [
    {
      "id": 12,
      "description": "Greiner 96 flat",
      "rowCount": 8,
      "colCount": 12,
      "workingCapacity": 200.0
    }
  ]
}
```

- Field names and meaning are identical to fast-mcp's `list_plate_definitions` output. Don't
  invent new ones.
- `id` is the value galago-core sends back as `Transfer.source_plate_id` / `dest_plate_id`
  (`int32`). Struct carries numbers as doubles, so galago-core **rejects** any entry whose id is not
  an integer ≥ 1. It never truncates, because truncating would turn 12.7 into plate 12.
- `workingCapacity` is in µL, the same as fast-mcp.
- Order: ascending by `id`.
- An empty `plates: []` is a valid answer (no plates registered), not an error.

### 4. Tests (galago-tools)

- **Through `ExecuteCommand`, during a Transfer:** `get_plates` returns the list while a fake
  transfer is running. Calling the handler directly is not enough. Today F.A.S.T.'s `ExecuteCommand`
  only bypasses base_server's readiness gate for pause/resume/abort (`tools/fast/server.py` ~80,
  515-541), so without an explicit read bypass the call is refused with `NOT_READY`.
- The `meta_data` round-trip matches the shape above.
- An unreachable instrument gives a non-SUCCESS code and no `plates` key.

## galago-core side (for reference; built in v1.2 Phase 6)

- Re-pin `vendor/galago-tools` to the frozen commit and regenerate `controller/gen-interfaces`
  (ts-proto 1.151.1).
- Add a tRPC query that sends `get_plates` through the instance `Tool.executeCommand` with
  `return_reply: true` (the `tool.latchStatus` precedent), never through the queue. Do not use
  `Tool.controlCommand`: a static scan pins it to two callers, and it discards `meta_data`. It
  validates and caps the reply (a maximum plate count, string lengths, and integer ids), caches it
  briefly, and returns `unavailable` instead of throwing when the instrument is offline.
- `get_plates` is internal. It is never offered as a protocol step or a tool-page command
  (it is kept out of `commandFields.fast`).
- The source/dest plate fields become dynamic selects fed by that query. Their values stay numeric
  ids, so nothing changes on the wire and saved protocols load unchanged.

## Open points (to settle in Phase 6 discussion)

- When offline, fall back to a plain number input, or show the last-known list with a "stale" marker?
- Whether the `refresh` flag is needed, or fast_mcp's cache is fresh enough.
