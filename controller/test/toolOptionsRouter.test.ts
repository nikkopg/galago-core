// Tracer test for the dropdown read path (06-01): tool.options router ->
// fetchOptions -> Tool.readOptions -> fake gRPC. Reply literals are derived from
// the stack-automation-layer golden files (robotStates, labwareProfiles,
// transferProfiles, deviceTree, readFailed); nothing is imported from there.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Chainable stand-in for the drizzle client, used only by the edit and delete
// lifecycle cases (06-02). Plain functions, so restoreAllMocks leaves it intact.
const { dbMock, dbRows } = vi.hoisted(() => {
  const dbRows: { returning: unknown[] } = { returning: [] };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.update = self;
  chain.set = self;
  chain.where = self;
  chain.delete = self;
  chain.insert = self;
  chain.values = async () => undefined;
  chain.returning = async () => dbRows.returning;
  return { dbMock: chain, dbRows };
});

vi.mock("@/db/client", () => ({ db: dbMock, sqlite: {} }));

vi.mock("@/db/helpers", () => ({
  findOne: vi.fn(),
  findOneOrFail: vi.fn(),
  findMany: vi.fn(),
  exists: vi.fn(),
  count: vi.fn(),
  getSelectedWorkcellId: vi.fn(),
  INVENTORY_TOOL_MAP: {},
}));

import * as grpc from "@grpc/grpc-js";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { toolRouter } from "@/server/routers/tool";
import Tool from "@/server/tools";
import { findMany, findOne, getSelectedWorkcellId } from "@/db/helpers";
import { resetToolOptionsStateForTest } from "@/server/toolOptions";
import { installFakeTool, removeFakeTool, FakeGrpc } from "./helpers/fakeTool";

const ROBOT_STATES = { kind: "robotStates", robots: [{ robotName: "stack2-6", state: "idle" }] };
const LABWARE_PROFILES = {
  kind: "labwareProfiles",
  profiles: [{ name: "Default", gripPosition: 10.2, hasLid: false }],
};
const TRANSFER_PROFILES = {
  kind: "transferProfiles",
  profiles: [{ name: "Default", fields: { horizontalVelocity: 200.0 } }],
};
const DEVICE_TREE = {
  kind: "deviceTree",
  deviceCount: 1,
  devices: [
    {
      deviceName: "nest-1",
      decks: [
        {
          deckName: "deck1",
          isCalibrated: true,
          nests: [
            { nestName: "A1", isCalibrated: true },
            { nestName: "A2", isCalibrated: false },
          ],
        },
      ],
    },
  ],
  ambiguous: [],
  apiVersion: "3",
};
const READ_FAILED = {
  kind: "readFailed",
  error: { status: 400, name: "taskNotFound", family: "transferState", code: 1 },
};

const caller = () => toolRouter.createCaller({});

function ok(meta: unknown) {
  return { response: ResponseCode.SUCCESS, error_message: "", return_reply: true, meta_data: meta };
}

describe("tool.options query (06-01 tracer)", () => {
  let stackGrpc: FakeGrpc;

  beforeEach(() => {
    resetToolOptionsStateForTest();
    stackGrpc = installFakeTool("stack-1", ToolType.stack).grpc;
    stackGrpc.executeCommand.mockResolvedValue(ok(ROBOT_STATES));
  });

  afterEach(async () => {
    await removeFakeTool("stack-1");
    await removeFakeTool("fast-1");
    vi.restoreAllMocks();
  });

  it("stack.robots reads get_robot_states with Metadata and a 5 s deadline", async () => {
    const before = Date.now();
    const result = await caller().options({ toolId: "stack-1", source: "stack.robots" });

    expect(result).toMatchObject({
      status: "ok",
      source: "stack.robots",
      shape: "list",
      names: ["stack2-6"],
      degraded: false,
    });
    expect(typeof (result as { fetchedAt: number }).fetchedAt).toBe("number");

    expect(stackGrpc.executeCommand).toHaveBeenCalledTimes(1);
    const [payload, metadata, options] = stackGrpc.executeCommand.mock.calls[0];
    expect(payload).toStrictEqual({ stack: { get_robot_states: {} } });
    expect(metadata).toBeInstanceOf(grpc.Metadata);
    const deadline = (options as { deadline: number }).deadline;
    expect(Math.abs(deadline - (before + 5000))).toBeLessThan(1000);
  });

  it("stack.devices with refresh true sends list_devices {refresh:true} and returns the tree", async () => {
    stackGrpc.executeCommand.mockResolvedValue(ok(DEVICE_TREE));
    const result = await caller().options({
      toolId: "stack-1",
      source: "stack.devices",
      refresh: true,
    });

    expect(stackGrpc.executeCommand.mock.calls[0][0]).toStrictEqual({
      stack: { list_devices: { refresh: true } },
    });
    expect(result).toMatchObject({
      status: "ok",
      shape: "tree",
      degraded: false,
      ambiguous: [],
      devices: [
        {
          deviceName: "nest-1",
          decks: [
            {
              deckName: "deck1",
              isCalibrated: true,
              nests: [
                { nestName: "A1", isCalibrated: true },
                { nestName: "A2", isCalibrated: false },
              ],
            },
          ],
        },
      ],
    });
  });

  it("stack.robots with refresh true still sends get_robot_states with no params", async () => {
    await caller().options({ toolId: "stack-1", source: "stack.robots", refresh: true });
    expect(stackGrpc.executeCommand.mock.calls[0][0]).toStrictEqual({
      stack: { get_robot_states: {} },
    });
  });

  it("labware and transfer profile replies return the profile names", async () => {
    stackGrpc.executeCommand.mockResolvedValueOnce(ok(LABWARE_PROFILES));
    const labware = await caller().options({ toolId: "stack-1", source: "stack.labwareProfiles" });
    expect(labware).toMatchObject({ status: "ok", shape: "list", names: ["Default"] });
    expect(stackGrpc.executeCommand.mock.calls[0][0]).toStrictEqual({
      stack: { list_labware_profiles: {} },
    });

    stackGrpc.executeCommand.mockResolvedValueOnce(ok(TRANSFER_PROFILES));
    const transfer = await caller().options({
      toolId: "stack-1",
      source: "stack.transferProfiles",
    });
    expect(transfer).toMatchObject({ status: "ok", shape: "list", names: ["Default"] });
    expect(stackGrpc.executeCommand.mock.calls[1][0]).toStrictEqual({
      stack: { list_transfer_profiles: {} },
    });
  });

  it("drops a {{x}} name and a blank name and marks the list degraded", async () => {
    stackGrpc.executeCommand.mockResolvedValue(
      ok({
        kind: "robotStates",
        robots: [
          { robotName: "{{x}}" },
          { robotName: "   " },
          { robotName: " r1 " },
          { robotName: 5 },
        ],
      }),
    );
    const result = await caller().options({ toolId: "stack-1", source: "stack.robots" });
    // A name is kept verbatim: " r1 " is not trimmed.
    expect(result).toMatchObject({ status: "ok", names: [" r1 "], degraded: true });
  });

  it("a validated empty array is ok with zero names", async () => {
    stackGrpc.executeCommand.mockResolvedValue(ok({ kind: "robotStates", robots: [] }));
    const result = await caller().options({ toolId: "stack-1", source: "stack.robots" });
    expect(result).toMatchObject({ status: "ok", names: [], degraded: false });
  });

  it("maps non-SUCCESS codes: NOT_READY and DRIVER_ERROR to tool_refused, readFailed to read_failed", async () => {
    stackGrpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.NOT_READY,
      error_message: "not ready",
    });
    expect(await caller().options({ toolId: "stack-1", source: "stack.robots" })).toStrictEqual({
      status: "unavailable",
      source: "stack.robots",
      reason: "tool_refused",
    });

    stackGrpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.DRIVER_ERROR,
      error_message: "boom",
    });
    expect(await caller().options({ toolId: "stack-1", source: "stack.robots" })).toMatchObject({
      reason: "tool_refused",
    });

    stackGrpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.ERROR_FROM_TOOL,
      error_message: "task not found",
      meta_data: READ_FAILED,
    });
    expect(await caller().options({ toolId: "stack-1", source: "stack.robots" })).toMatchObject({
      status: "unavailable",
      reason: "read_failed",
    });
  });

  it("never returns raw tool message text to the browser", async () => {
    stackGrpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.DRIVER_ERROR,
      error_message: "secret internal detail",
    });
    const result = await caller().options({ toolId: "stack-1", source: "stack.robots" });
    expect(JSON.stringify(result)).not.toContain("secret internal detail");
  });

  it("SUCCESS without meta_data is no_data; a wrong kind is bad_reply", async () => {
    stackGrpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.SUCCESS,
      error_message: "",
    });
    expect(await caller().options({ toolId: "stack-1", source: "stack.robots" })).toMatchObject({
      status: "unavailable",
      reason: "no_data",
    });

    stackGrpc.executeCommand.mockResolvedValueOnce(ok(LABWARE_PROFILES));
    expect(await caller().options({ toolId: "stack-1", source: "stack.robots" })).toMatchObject({
      status: "unavailable",
      reason: "bad_reply",
    });
  });

  it("a deadline rejection (code 4) is timeout and a transport rejection (code 14) is transport", async () => {
    stackGrpc.executeCommand.mockRejectedValueOnce(
      Object.assign(new Error("deadline"), { code: 4 }),
    );
    expect(await caller().options({ toolId: "stack-1", source: "stack.robots" })).toMatchObject({
      status: "unavailable",
      reason: "timeout",
    });

    stackGrpc.executeCommand.mockRejectedValueOnce(
      Object.assign(new Error("unavailable"), { code: 14 }),
    );
    expect(await caller().options({ toolId: "stack-1", source: "stack.robots" })).toMatchObject({
      status: "unavailable",
      reason: "transport",
    });
  });

  it("an unknown toolId is not_connected and no Tool is created", async () => {
    const result = await caller().options({ toolId: "ghost-9", source: "stack.robots" });
    expect(result).toStrictEqual({
      status: "unavailable",
      source: "stack.robots",
      reason: "not_connected",
    });
    expect(Tool.lookup("ghost-9")).toBeUndefined();
  });

  it("a fast tool asked for a stack source is wrong_tool_type with nothing sent", async () => {
    const fast = installFakeTool("fast-1", ToolType.fast).grpc;
    const result = await caller().options({ toolId: "fast-1", source: "stack.robots" });
    expect(result).toMatchObject({ status: "unavailable", reason: "wrong_tool_type" });
    expect(fast.executeCommand).not.toHaveBeenCalled();
    expect(stackGrpc.executeCommand).not.toHaveBeenCalled();
  });

  it("rejects an extra command key, an extra params key and an unknown source", async () => {
    const c = caller() as unknown as {
      options: (input: unknown) => Promise<unknown>;
    };
    await expect(
      c.options({ toolId: "stack-1", source: "stack.robots", command: "abort" }),
    ).rejects.toThrow();
    await expect(
      c.options({ toolId: "stack-1", source: "stack.robots", params: { x: 1 } }),
    ).rejects.toThrow();
    await expect(c.options({ toolId: "stack-1", source: "fast.plates" })).rejects.toThrow();
    expect(stackGrpc.executeCommand).not.toHaveBeenCalled();
  });
});

// Every tool lifecycle route invalidates that tool's cached option lists
// (D-04): after configure, edit (old and new name), delete or clearToolStore the
// next tool.options read goes live instead of returning the cached list.
describe("tool lifecycle routes invalidate cached options (06-02)", () => {
  const STACK_ROW = {
    id: 3,
    name: "stack-1",
    type: "stack",
    ip: "127.0.0.1",
    port: 1,
    workcellId: 1,
    config: {},
  };

  let stackGrpc: FakeGrpc;

  async function readTwice(toolId: string, grpc: FakeGrpc) {
    await caller().options({ toolId, source: "stack.robots" });
    await caller().options({ toolId, source: "stack.robots" });
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
  }

  function reinstall(toolId: string): FakeGrpc {
    const grpc = installFakeTool(toolId, ToolType.stack).grpc;
    grpc.executeCommand.mockResolvedValue(ok(ROBOT_STATES));
    return grpc;
  }

  beforeEach(() => {
    resetToolOptionsStateForTest();
    vi.mocked(getSelectedWorkcellId).mockResolvedValue(1);
    vi.mocked(findMany).mockResolvedValue([STACK_ROW]);
    stackGrpc = reinstall("stack-1");
    dbRows.returning = [];
  });

  afterEach(async () => {
    await removeFakeTool("stack-1");
    await removeFakeTool("stack-old");
    vi.restoreAllMocks();
  });

  it("a successful configure makes the next read go live", async () => {
    await readTwice("stack-1", stackGrpc);
    stackGrpc.configure.mockResolvedValue({ response: ResponseCode.SUCCESS, error_message: "" });
    await caller().configure({
      toolId: "stack-1",
      config: { toolId: "stack-1", simulated: false },
    });
    expect(stackGrpc.configure).toHaveBeenCalledTimes(1);

    await caller().options({ toolId: "stack-1", source: "stack.robots" });
    expect(stackGrpc.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("a failed configure still makes the next read go live", async () => {
    await readTwice("stack-1", stackGrpc);
    stackGrpc.configure.mockRejectedValue(Object.assign(new Error("down"), { code: 14 }));
    await expect(
      caller().configure({ toolId: "stack-1", config: { toolId: "stack-1", simulated: false } }),
    ).rejects.toThrow();

    await caller().options({ toolId: "stack-1", source: "stack.robots" });
    expect(stackGrpc.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("a configure refused by the tool still makes the next read go live", async () => {
    await readTwice("stack-1", stackGrpc);
    stackGrpc.configure.mockResolvedValue({
      response: ResponseCode.DRIVER_ERROR,
      error_message: "refused",
    });
    await expect(
      caller().configure({ toolId: "stack-1", config: { toolId: "stack-1", simulated: false } }),
    ).rejects.toThrow();

    await caller().options({ toolId: "stack-1", source: "stack.robots" });
    expect(stackGrpc.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("edit invalidates both the pre-edit name and the updated name", async () => {
    const oldGrpc = reinstall("stack-old");
    await readTwice("stack-old", oldGrpc);
    await readTwice("stack-1", stackGrpc);

    vi.mocked(findOne).mockResolvedValue({ ...STACK_ROW, name: "stack-old" });
    dbRows.returning = [{ ...STACK_ROW, name: "stack-1" }];
    await caller().edit({ id: 3, type: "stack", name: "stack-1", ip: "127.0.0.1", port: 1 });

    await caller().options({ toolId: "stack-old", source: "stack.robots" });
    expect(oldGrpc.executeCommand).toHaveBeenCalledTimes(2);

    // edit removed the stack-1 Tool; a reconnected one must not see the old list.
    const fresh = reinstall("stack-1");
    await caller().options({ toolId: "stack-1", source: "stack.robots" });
    expect(fresh.executeCommand).toHaveBeenCalledTimes(1);
  });

  it("delete makes the next read of that tool go live", async () => {
    await readTwice("stack-1", stackGrpc);
    dbRows.returning = [STACK_ROW];
    await caller().delete(3);

    const fresh = reinstall("stack-1");
    await caller().options({ toolId: "stack-1", source: "stack.robots" });
    expect(fresh.executeCommand).toHaveBeenCalledTimes(1);
  });

  it("clearToolStore makes every next read go live", async () => {
    await readTwice("stack-1", stackGrpc);
    await caller().clearToolStore();

    const fresh = reinstall("stack-1");
    await caller().options({ toolId: "stack-1", source: "stack.robots" });
    expect(fresh.executeCommand).toHaveBeenCalledTimes(1);
  });
});
