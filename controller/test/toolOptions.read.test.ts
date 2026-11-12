// Cache, configure generation, in-flight dedupe, Refresh, eviction and logging
// tests for fetchOptions (06-02 Task 2, D-01, D-04, DRP-04, DRP-06, T-06-04,
// T-06-06). Only Date is faked, so promises and the fake gRPC still resolve.
// Everything goes through installFakeTool: no real channel is ever opened.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { logAction } from "@/server/logger";
import {
  bumpAllGenerations,
  bumpGeneration,
  fetchOptions,
  OPTIONS_CACHE_TTL_MS,
  OPTIONS_LOG_THROTTLE_MS,
  REFRESH_MIN_INTERVAL_MS,
  resetToolOptionsStateForTest,
  type OptionsResult,
} from "@/server/toolOptions";
import { deferred, installFakeTool, removeFakeTool, type FakeGrpc } from "./helpers/fakeTool";
import {
  DEVICE_TREE_GOLDEN,
  LABWARE_PROFILES_GOLDEN,
  ROBOT_STATES_GOLDEN,
  TRANSFER_PROFILES_GOLDEN,
  robotStatesOf,
  robotStatesWithCount,
} from "./fixtures/stackOptions";
import { FAST_PLATES_GOLDEN } from "./fixtures/fastPlates";

const T0 = 1_700_000_000_000;

function ok(meta: unknown) {
  return { response: ResponseCode.SUCCESS, error_message: "", return_reply: true, meta_data: meta };
}

function grpcError(code: number) {
  return Object.assign(new Error("grpc " + code), { code });
}

function fetchedAt(result: OptionsResult): number {
  if (result.status !== "ok") throw new Error("expected ok, got " + JSON.stringify(result));
  return result.fetchedAt;
}

function at(offsetMs: number) {
  vi.setSystemTime(T0 + offsetMs);
}

describe("fetchOptions cache and refresh (06-02)", () => {
  let grpc: FakeGrpc;

  beforeEach(() => {
    resetToolOptionsStateForTest();
    vi.useFakeTimers({ toFake: ["Date"] });
    at(0);
    grpc = installFakeTool("stack-1", ToolType.stack).grpc;
    grpc.executeCommand.mockResolvedValue(ok(ROBOT_STATES_GOLDEN));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await removeFakeTool("stack-1");
    resetToolOptionsStateForTest();
  });

  it("pins the timing constants", () => {
    expect(OPTIONS_CACHE_TTL_MS).toBe(15000);
    expect(REFRESH_MIN_INTERVAL_MS).toBe(2000);
    expect(OPTIONS_LOG_THROTTLE_MS).toBe(60000);
  });

  it("two reads within 15 s send one call and share fetchedAt; after 15 s a read goes live", async () => {
    const first = await fetchOptions("stack-1", "stack.robots", false);
    at(14999);
    const second = await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
    expect(fetchedAt(second)).toBe(fetchedAt(first));
    expect(fetchedAt(first)).toBe(T0);

    at(15000);
    const third = await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
    expect(fetchedAt(third)).toBe(T0 + 15000);
  });

  it("the cache key is the normalized tool id and the source", async () => {
    await fetchOptions("stack-1", "stack.robots", false);
    await fetchOptions("Stack 1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);

    grpc.executeCommand.mockResolvedValueOnce(ok(LABWARE_PROFILES_GOLDEN));
    await fetchOptions("stack-1", "stack.labwareProfiles", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("concurrent reads share one in-flight call", async () => {
    const d = deferred<unknown>();
    grpc.executeCommand.mockReturnValueOnce(d.promise);
    const p1 = fetchOptions("stack-1", "stack.robots", false);
    const p2 = fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
    d.resolve(ok(ROBOT_STATES_GOLDEN));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toMatchObject({ status: "ok", names: ["stack2-6"] });
    expect(r2).toStrictEqual(r1);
  });

  it("when the shared in-flight call rejects, every waiter gets unavailable", async () => {
    const d = deferred<unknown>();
    grpc.executeCommand.mockReturnValueOnce(d.promise);
    const p1 = fetchOptions("stack-1", "stack.robots", false);
    const p2 = fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
    d.reject(grpcError(14));
    expect(await p1).toStrictEqual({
      status: "unavailable",
      source: "stack.robots",
      reason: "transport",
    });
    expect(await p2).toStrictEqual({
      status: "unavailable",
      source: "stack.robots",
      reason: "transport",
    });
  });

  it("a refresh issued while a normal read is in flight sends its own call with refresh true", async () => {
    const d = deferred<unknown>();
    grpc.executeCommand.mockReturnValueOnce(d.promise);
    const normal = fetchOptions("stack-1", "stack.devices", false);
    grpc.executeCommand.mockResolvedValueOnce(ok(DEVICE_TREE_GOLDEN));
    const refreshed = fetchOptions("stack-1", "stack.devices", true);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
    expect(grpc.executeCommand.mock.calls[0][0]).toStrictEqual({ stack: { list_devices: {} } });
    expect(grpc.executeCommand.mock.calls[1][0]).toStrictEqual({
      stack: { list_devices: { refresh: true } },
    });
    expect(await refreshed).toMatchObject({ status: "ok", shape: "tree" });
    d.resolve(ok(DEVICE_TREE_GOLDEN));
    expect(await normal).toMatchObject({ status: "ok", shape: "tree" });
  });

  it("a refresh bypasses a fresh cache entry and its ok result replaces the entry", async () => {
    grpc.executeCommand.mockResolvedValueOnce(ok(robotStatesOf(["old"])));
    await fetchOptions("stack-1", "stack.robots", false);

    at(1000);
    grpc.executeCommand.mockResolvedValueOnce(ok(robotStatesOf(["new"])));
    const refreshed = await fetchOptions("stack-1", "stack.robots", true);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
    expect(refreshed).toMatchObject({ status: "ok", names: ["new"], fetchedAt: T0 + 1000 });

    at(5000);
    const cached = await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
    expect(cached).toMatchObject({ names: ["new"], fetchedAt: T0 + 1000 });
  });

  it("refresh sends {refresh:true} to list_devices / list_labware_profiles / list_transfer_profiles and {} to get_robot_states", async () => {
    await fetchOptions("stack-1", "stack.robots", true);
    grpc.executeCommand.mockResolvedValueOnce(ok(DEVICE_TREE_GOLDEN));
    await fetchOptions("stack-1", "stack.devices", true);
    grpc.executeCommand.mockResolvedValueOnce(ok(LABWARE_PROFILES_GOLDEN));
    await fetchOptions("stack-1", "stack.labwareProfiles", true);
    grpc.executeCommand.mockResolvedValueOnce(ok(TRANSFER_PROFILES_GOLDEN));
    await fetchOptions("stack-1", "stack.transferProfiles", true);

    expect(grpc.executeCommand.mock.calls.map((c) => c[0])).toStrictEqual([
      { stack: { get_robot_states: {} } },
      { stack: { list_devices: { refresh: true } } },
      { stack: { list_labware_profiles: { refresh: true } } },
      { stack: { list_transfer_profiles: { refresh: true } } },
    ]);
  });

  it("a second refresh within 2 s reuses the last successful refresh; after 2 s it goes live", async () => {
    const first = await fetchOptions("stack-1", "stack.robots", true);
    at(1999);
    const second = await fetchOptions("stack-1", "stack.robots", true);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
    expect(fetchedAt(second)).toBe(fetchedAt(first));

    at(2000);
    const third = await fetchOptions("stack-1", "stack.robots", true);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
    expect(fetchedAt(third)).toBe(T0 + 2000);
  });

  it("a failed refresh is never reused: the next refresh goes live", async () => {
    grpc.executeCommand.mockRejectedValueOnce(grpcError(4));
    expect(await fetchOptions("stack-1", "stack.robots", true)).toMatchObject({
      status: "unavailable",
      reason: "timeout",
    });
    const next = await fetchOptions("stack-1", "stack.robots", true);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
    expect(next).toMatchObject({ status: "ok" });
  });

  it("a failed refresh after a success returns unavailable, evicts, and the next read recovers live", async () => {
    await fetchOptions("stack-1", "stack.robots", false);
    grpc.executeCommand.mockRejectedValueOnce(grpcError(14));
    expect(await fetchOptions("stack-1", "stack.robots", true)).toStrictEqual({
      status: "unavailable",
      source: "stack.robots",
      reason: "transport",
    });
    const recovered = await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(3);
    expect(recovered).toMatchObject({ status: "ok", names: ["stack2-6"] });
  });

  it("a live failure evicts the last successful refresh too", async () => {
    // A plain read is held open while a refresh succeeds; the plain read then
    // fails, which must evict both the cache entry and the refresh entry.
    const d = deferred<unknown>();
    grpc.executeCommand.mockReturnValueOnce(d.promise);
    const plain = fetchOptions("stack-1", "stack.robots", false);
    expect(await fetchOptions("stack-1", "stack.robots", true)).toMatchObject({ status: "ok" });
    d.resolve({ response: ResponseCode.NOT_READY, error_message: "" });
    expect(await plain).toMatchObject({ status: "unavailable", reason: "tool_refused" });

    at(500);
    await fetchOptions("stack-1", "stack.robots", true);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(3);
    at(600);
    await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(3);
  });

  it("a failed read after TTL expiry never falls back to the cached list", async () => {
    await fetchOptions("stack-1", "stack.robots", false);
    at(OPTIONS_CACHE_TTL_MS);
    grpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.SUCCESS,
      error_message: "",
    });
    expect(await fetchOptions("stack-1", "stack.robots", false)).toStrictEqual({
      status: "unavailable",
      source: "stack.robots",
      reason: "no_data",
    });
    const recovered = await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(3);
    expect(recovered).toMatchObject({ status: "ok" });
  });

  it("an over-cap reply is unavailable too_large and is not cached", async () => {
    grpc.executeCommand.mockResolvedValueOnce(ok(robotStatesWithCount(1001)));
    expect(await fetchOptions("stack-1", "stack.robots", false)).toStrictEqual({
      status: "unavailable",
      source: "stack.robots",
      reason: "too_large",
    });
    await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("bumpGeneration makes the next read go live", async () => {
    await fetchOptions("stack-1", "stack.robots", false);
    bumpGeneration("Stack 1");
    await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("bumpGeneration on another tool leaves this tool's cache alone", async () => {
    await fetchOptions("stack-1", "stack.robots", false);
    bumpGeneration("stack-2");
    await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
  });

  it("bumpAllGenerations makes every next read go live", async () => {
    await fetchOptions("stack-1", "stack.robots", false);
    bumpAllGenerations();
    await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("a read that started before a bump and resolves after it is not stored", async () => {
    const d = deferred<unknown>();
    grpc.executeCommand.mockReturnValueOnce(d.promise);
    const pending = fetchOptions("stack-1", "stack.robots", false);
    bumpGeneration("stack-1");
    d.resolve(ok(ROBOT_STATES_GOLDEN));
    expect(await pending).toMatchObject({ status: "ok" });

    await fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("a read after a bump does not join a read that started before it", async () => {
    const d = deferred<unknown>();
    grpc.executeCommand.mockReturnValueOnce(d.promise);
    const before = fetchOptions("stack-1", "stack.robots", false);
    bumpAllGenerations();
    const after = fetchOptions("stack-1", "stack.robots", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
    d.resolve(ok(ROBOT_STATES_GOLDEN));
    await Promise.all([before, after]);
  });

  it("not_connected and wrong_tool_type send nothing and never consult the cache", async () => {
    expect(await fetchOptions("ghost-9", "stack.robots", false)).toMatchObject({
      reason: "not_connected",
    });
    const fast = installFakeTool("fast-1", ToolType.fast).grpc;
    expect(await fetchOptions("fast-1", "stack.robots", false)).toMatchObject({
      reason: "wrong_tool_type",
    });
    expect(fast.executeCommand).not.toHaveBeenCalled();
    await removeFakeTool("fast-1");
  });
});

describe("fetchOptions audit logging (D-01, T-06-06)", () => {
  let grpc: FakeGrpc;
  const log = () => vi.mocked(logAction);

  beforeEach(() => {
    resetToolOptionsStateForTest();
    vi.useFakeTimers({ toFake: ["Date"] });
    at(0);
    grpc = installFakeTool("stack-1", ToolType.stack).grpc;
    grpc.executeCommand.mockResolvedValue(ok(ROBOT_STATES_GOLDEN));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await removeFakeTool("stack-1");
    resetToolOptionsStateForTest();
  });

  it("a plain successful read and a cache hit write no row", async () => {
    await fetchOptions("stack-1", "stack.robots", false);
    await fetchOptions("stack-1", "stack.robots", false);
    expect(log()).not.toHaveBeenCalled();
  });

  it("a live-read failure writes one warning row", async () => {
    grpc.executeCommand.mockRejectedValueOnce(grpcError(14));
    await fetchOptions("stack-1", "stack.robots", false);
    expect(log()).toHaveBeenCalledTimes(1);
    const row = log().mock.calls[0][0];
    expect(row.level).toBe("warning");
    expect(row.action).toBe("Tool Options Read Failed");
    expect(row.details).toContain("stack-1");
    expect(row.details).toContain("stack.robots");
    expect(row.details).toContain("transport");
    expect(row.details).toContain("14");
  });

  it("ten identical failures within 60 s write one row; a different reason writes its own; after 60 s another", async () => {
    grpc.executeCommand.mockRejectedValue(grpcError(14));
    for (let i = 0; i < 10; i++) {
      at(i * 1000);
      await fetchOptions("stack-1", "stack.robots", false);
    }
    expect(log()).toHaveBeenCalledTimes(1);

    grpc.executeCommand.mockRejectedValueOnce(grpcError(4));
    await fetchOptions("stack-1", "stack.robots", false);
    expect(log()).toHaveBeenCalledTimes(2);
    expect(log().mock.calls[1][0].details).toContain("timeout");

    at(OPTIONS_LOG_THROTTLE_MS);
    await fetchOptions("stack-1", "stack.robots", false);
    expect(log()).toHaveBeenCalledTimes(3);
  });

  it("the same failure on another source writes its own row", async () => {
    grpc.executeCommand.mockRejectedValue(grpcError(14));
    await fetchOptions("stack-1", "stack.robots", false);
    await fetchOptions("stack-1", "stack.devices", false);
    expect(log()).toHaveBeenCalledTimes(2);
  });

  it("a refresh writes one info row per 60 s per (tool, source)", async () => {
    await fetchOptions("stack-1", "stack.robots", true);
    expect(log()).toHaveBeenCalledTimes(1);
    expect(log().mock.calls[0][0]).toMatchObject({
      level: "info",
      action: "Tool Options Refreshed",
    });

    // Reuse within 2 s: no live read, no row.
    at(1000);
    await fetchOptions("stack-1", "stack.robots", true);
    // Live again after 2 s, still inside the 60 s throttle: no row.
    at(3000);
    await fetchOptions("stack-1", "stack.robots", true);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
    expect(log()).toHaveBeenCalledTimes(1);

    grpc.executeCommand.mockResolvedValueOnce(ok(DEVICE_TREE_GOLDEN));
    await fetchOptions("stack-1", "stack.devices", true);
    expect(log()).toHaveBeenCalledTimes(2);

    at(OPTIONS_LOG_THROTTLE_MS);
    await fetchOptions("stack-1", "stack.robots", true);
    expect(log()).toHaveBeenCalledTimes(3);
  });

  it("pre-send outcomes (not_connected) write no row", async () => {
    await fetchOptions("ghost-9", "stack.robots", false);
    expect(log()).not.toHaveBeenCalled();
  });

  it("details pass through sanitizeLogText: a newline in the toolId becomes ?", async () => {
    grpc.executeCommand.mockRejectedValueOnce(grpcError(14));
    const result = await fetchOptions("stack\n-1", "stack.robots", false);
    expect(result).toMatchObject({ status: "unavailable", reason: "transport" });
    expect(log()).toHaveBeenCalledTimes(1);
    const details = log().mock.calls[0][0].details;
    expect(details).toContain("stack?-1");
    expect(details).not.toMatch(/[\r\n]/);
  });
});

// fast.plates read path (07-06, D-03): the fifth source behaves like the Phase 6
// sources. Failure replies follow the frozen get_plates mapping (galago-tools
// d53da53): NOT_READY / ERROR_FROM_TOOL / DRIVER_ERROR carry no plates key.
describe("fetchOptions fast.plates read path (07-06)", () => {
  let grpc: FakeGrpc;

  beforeEach(() => {
    resetToolOptionsStateForTest();
    vi.useFakeTimers({ toFake: ["Date"] });
    at(0);
    grpc = installFakeTool("fast-1", ToolType.fast).grpc;
    grpc.executeCommand.mockResolvedValue(ok(FAST_PLATES_GOLDEN));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await removeFakeTool("fast-1");
    resetToolOptionsStateForTest();
  });

  it("a second plain read within OPTIONS_CACHE_TTL_MS is served from cache with one call", async () => {
    const first = await fetchOptions("fast-1", "fast.plates", false);
    at(OPTIONS_CACHE_TTL_MS - 1);
    const second = await fetchOptions("fast-1", "fast.plates", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
    expect(second).toStrictEqual(first);
    expect(first).toMatchObject({ status: "ok", shape: "plates", fetchedAt: T0 });

    at(OPTIONS_CACHE_TTL_MS);
    await fetchOptions("fast-1", "fast.plates", false);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("a refresh sends get_plates with refresh true and bypasses the cache", async () => {
    await fetchOptions("fast-1", "fast.plates", false);
    at(100);
    await fetchOptions("fast-1", "fast.plates", true);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(2);
    expect(grpc.executeCommand.mock.calls[0][0]).toStrictEqual({ fast: { get_plates: {} } });
    expect(grpc.executeCommand.mock.calls[1][0]).toStrictEqual({
      fast: { get_plates: { refresh: true } },
    });
  });

  it("a refresh within REFRESH_MIN_INTERVAL_MS of the last live refresh reuses it", async () => {
    await fetchOptions("fast-1", "fast.plates", true);
    at(REFRESH_MIN_INTERVAL_MS - 1);
    await fetchOptions("fast-1", "fast.plates", true);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
  });

  it("NOT_READY and DRIVER_ERROR are tool_refused", async () => {
    for (const code of [ResponseCode.NOT_READY, ResponseCode.DRIVER_ERROR]) {
      resetToolOptionsStateForTest();
      grpc.executeCommand.mockResolvedValueOnce({ response: code, error_message: "no" });
      expect(await fetchOptions("fast-1", "fast.plates", false)).toStrictEqual({
        status: "unavailable",
        source: "fast.plates",
        reason: "tool_refused",
      });
    }
  });

  it("ERROR_FROM_TOOL without meta (the frozen unreachable mapping) is tool_refused", async () => {
    grpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.ERROR_FROM_TOOL,
      error_message: "instrument unreachable: ConnectError: refused",
    });
    expect(await fetchOptions("fast-1", "fast.plates", false)).toMatchObject({
      status: "unavailable",
      reason: "tool_refused",
    });
  });

  it("ERROR_FROM_TOOL with meta kind readFailed is read_failed", async () => {
    grpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.ERROR_FROM_TOOL,
      error_message: "x",
      meta_data: { kind: "readFailed", error: { status: 400 } },
    });
    expect(await fetchOptions("fast-1", "fast.plates", false)).toMatchObject({
      status: "unavailable",
      reason: "read_failed",
    });
  });

  it("SUCCESS without meta_data is no_data and a SUCCESS meta without plates is bad_reply", async () => {
    grpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.SUCCESS,
      error_message: "",
    });
    expect(await fetchOptions("fast-1", "fast.plates", false)).toMatchObject({
      status: "unavailable",
      reason: "no_data",
    });
    grpc.executeCommand.mockResolvedValueOnce(ok({}));
    expect(await fetchOptions("fast-1", "fast.plates", false)).toMatchObject({
      status: "unavailable",
      reason: "bad_reply",
    });
  });

  it("a gRPC error with code 4 is timeout and code 14 is transport", async () => {
    grpc.executeCommand.mockRejectedValueOnce(grpcError(4));
    expect(await fetchOptions("fast-1", "fast.plates", false)).toMatchObject({
      status: "unavailable",
      reason: "timeout",
    });
    grpc.executeCommand.mockRejectedValueOnce(grpcError(14));
    expect(await fetchOptions("fast-1", "fast.plates", false)).toMatchObject({
      status: "unavailable",
      reason: "transport",
    });
  });

  it("a plates list over MAX_PLATES is too_large, never sliced", async () => {
    grpc.executeCommand.mockResolvedValueOnce(
      ok({ plates: Array.from({ length: 1001 }, (_, i) => ({ id: i + 1 })) }),
    );
    expect(await fetchOptions("fast-1", "fast.plates", false)).toMatchObject({
      status: "unavailable",
      reason: "too_large",
    });
  });

  it("a failed read never returns the earlier cached list (no stale plates)", async () => {
    const first = await fetchOptions("fast-1", "fast.plates", false);
    expect(first).toMatchObject({ status: "ok" });

    // A failed refresh evicts the cached list: the next plain read goes live.
    at(100);
    grpc.executeCommand.mockRejectedValueOnce(grpcError(14));
    expect(await fetchOptions("fast-1", "fast.plates", true)).toMatchObject({
      status: "unavailable",
      reason: "transport",
    });

    at(200);
    grpc.executeCommand.mockRejectedValueOnce(grpcError(14));
    const afterFailure = await fetchOptions("fast-1", "fast.plates", false);
    expect(afterFailure).toStrictEqual({
      status: "unavailable",
      source: "fast.plates",
      reason: "transport",
    });
    expect(grpc.executeCommand).toHaveBeenCalledTimes(3);
  });

  it("a read of a non-fast tool sends nothing and is never queued", async () => {
    const stack = installFakeTool("stack-1", ToolType.stack).grpc;
    expect(await fetchOptions("stack-1", "fast.plates", false)).toStrictEqual({
      status: "unavailable",
      source: "fast.plates",
      reason: "wrong_tool_type",
    });
    expect(stack.executeCommand).not.toHaveBeenCalled();
    await removeFakeTool("stack-1");
  });
});
