import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/db/helpers", () => ({
  findOne: vi.fn(),
  findOneOrFail: vi.fn(),
  findMany: vi.fn(),
  exists: vi.fn(),
  count: vi.fn(),
  getSelectedWorkcellId: vi.fn(),
  INVENTORY_TOOL_MAP: {},
}));

import { ToolType } from "gen-interfaces/controller";
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { findMany, getSelectedWorkcellId } from "@/db/helpers";
import { toolRouter } from "@/server/routers/tool";
import CommandQueue from "@/server/command_queue";
import { logAction } from "@/server/logger";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";

const FAST_TOOL_ROW = {
  id: 1,
  name: "fast-1",
  type: "fast",
  ip: "127.0.0.1",
  port: 1,
  workcellId: 1,
};
const PF400_TOOL_ROW = {
  id: 2,
  name: "pf400-1",
  type: "pf400",
  ip: "127.0.0.1",
  port: 2,
  workcellId: 1,
};

describe("recoveryControl", () => {
  let fastGrpc: FakeGrpc;
  let pf400Grpc: FakeGrpc;

  beforeEach(() => {
    (globalThis as any)["__global_command_queue_key"] = new CommandQueue({} as any);
    (globalThis as any)["__global_command_queue_key"].slackNotificationsEnabled = false;

    vi.mocked(getSelectedWorkcellId).mockResolvedValue(1);
    vi.mocked(findMany).mockResolvedValue([FAST_TOOL_ROW, PF400_TOOL_ROW]);

    fastGrpc = installFakeTool("fast-1", ToolType.fast).grpc;
    pf400Grpc = installFakeTool("pf400-1", ToolType.pf400).grpc;
    fastGrpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });
  });

  afterEach(async () => {
    await removeFakeTool("fast-1");
    await removeFakeTool("pf400-1");
    delete (globalThis as any)["__global_command_queue_key"];
    vi.restoreAllMocks();
  });

  const caller = () => toolRouter.createCaller({});

  it("sends a recovery resume to an untracked tool", async () => {
    const result = await caller().recoveryControl({
      toolId: "fast-1",
      action: "resume",
      params: { is_tip_broken: "no" },
    });

    expect(result).toMatchObject({ ok: true, response: ResponseCode.SUCCESS });
    expect(fastGrpc.executeCommand).toHaveBeenCalledTimes(1);
    expect(fastGrpc.executeCommand).toHaveBeenCalledWith({ fast: { resume: { is_tip_broken: "no" } } });
    expect(fastGrpc.executeCommand.mock.calls[0]).toHaveLength(1);

    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Tool Recovery Control", level: "info" }),
    );
  });

  it("resolves the tool by normalized name", async () => {
    const result = await caller().recoveryControl({
      toolId: "FAST 1",
      action: "resume",
      params: { is_tip_broken: "no" },
    });

    expect(result).toMatchObject({ ok: true, response: ResponseCode.SUCCESS });
    expect(fastGrpc.executeCommand).toHaveBeenCalledTimes(1);
  });

  it("stays pending until the tool replies (no deadline)", async () => {
    const pending = deferred<{ response: ResponseCode; return_reply: boolean }>();
    fastGrpc.executeCommand.mockReturnValue(pending.promise);

    let settled = false;
    const call = caller()
      .recoveryControl({ toolId: "fast-1", action: "resume", params: { is_tip_broken: "no" } })
      .then((r) => {
        settled = true;
        return r;
      });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(settled).toBe(false);

    pending.resolve({ response: ResponseCode.SUCCESS, return_reply: true });
    const result = await call;
    expect(result).toMatchObject({ ok: true });
  });

  it("refuses a tool tracked by a running step", async () => {
    vi.spyOn(CommandQueue.prototype, "runningStep", "get").mockReturnValue({
      queueId: 1,
      runId: "run-1",
      toolId: "FAST 1",
      toolType: ToolType.fast,
      command: "transfer",
      startedAt: 0,
    });

    await expect(
      caller().recoveryControl({ toolId: "fast-1", action: "resume", params: { is_tip_broken: "no" } }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fastGrpc.executeCommand).not.toHaveBeenCalled();
  });

  it("allows recovery while a different tool runs", async () => {
    vi.spyOn(CommandQueue.prototype, "runningStep", "get").mockReturnValue({
      queueId: 1,
      runId: "run-1",
      toolId: "pf400-1",
      toolType: ToolType.pf400,
      command: "move",
      startedAt: 0,
    });

    const result = await caller().recoveryControl({
      toolId: "fast-1",
      action: "abort",
      params: { return_liquid: "yes" },
    });

    expect(result).toMatchObject({ ok: true });
    expect(fastGrpc.executeCommand).toHaveBeenCalledWith({ fast: { abort: { return_liquid: "yes" } } });
  });

  it("refuses pause", async () => {
    await expect(
      caller().recoveryControl({ toolId: "fast-1", action: "pause", params: {} }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fastGrpc.executeCommand).not.toHaveBeenCalled();
  });

  it("refuses an undeclared action", async () => {
    await expect(
      caller().recoveryControl({ toolId: "fast-1", action: "transfer", params: {} }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it.each([{}, { is_tip_broken: "" }])(
    "refuses a blank or missing resume decision %j",
    async (params) => {
      await expect(
        caller().recoveryControl({ toolId: "fast-1", action: "resume", params }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("is_tip_broken") });
    },
  );

  it("refuses an abort decision that is not exact yes/no", async () => {
    await expect(
      caller().recoveryControl({ toolId: "fast-1", action: "abort", params: { return_liquid: "Yes" } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("return_liquid") });
  });

  it("refuses an undeclared parameter", async () => {
    await expect(
      caller().recoveryControl({
        toolId: "fast-1",
        action: "resume",
        params: { is_tip_broken: "no", hard: "yes" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("hard") });
  });

  it("refuses a tool type without runControl", async () => {
    await expect(
      caller().recoveryControl({ toolId: "pf400-1", action: "resume", params: {} }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(pf400Grpc.executeCommand).not.toHaveBeenCalled();
  });

  it("returns a tool refusal unthrown", async () => {
    fastGrpc.executeCommand.mockResolvedValue({
      response: ResponseCode.ERROR_FROM_TOOL,
      error_message: "instrument not ready: no run to resume",
    });

    const result = await caller().recoveryControl({
      toolId: "fast-1",
      action: "resume",
      params: { is_tip_broken: "no" },
    });

    expect(result).toMatchObject({
      ok: false,
      response: ResponseCode.ERROR_FROM_TOOL,
      message: "instrument not ready: no run to resume",
    });
  });

  it("surfaces a transport error once", async () => {
    fastGrpc.executeCommand.mockRejectedValue(new Error("14 UNAVAILABLE"));

    await expect(
      caller().recoveryControl({ toolId: "fast-1", action: "resume", params: { is_tip_broken: "no" } }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining("14 UNAVAILABLE"),
    });
    expect(fastGrpc.executeCommand).toHaveBeenCalledTimes(1);
  });

  it("logs every refusal with toolId and outcome=refused", async () => {
    await expect(
      caller().recoveryControl({ toolId: "fast-1", action: "pause", params: {} }),
    ).rejects.toBeDefined();

    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "Tool Recovery Control Refused",
        level: "warning",
        details: expect.stringContaining("toolId=fast-1"),
      }),
    );
    const details = vi.mocked(logAction).mock.calls[0][0].details;
    expect(details).toContain("outcome=refused:");
  });

  it("logs a tool refusal as Tool Recovery Control at warning level", async () => {
    fastGrpc.executeCommand.mockResolvedValue({
      response: ResponseCode.ERROR_FROM_TOOL,
      error_message: "instrument not ready",
    });

    await caller().recoveryControl({ toolId: "fast-1", action: "resume", params: { is_tip_broken: "no" } });

    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Tool Recovery Control", level: "warning" }),
    );
  });

  it("logs a transport failure as Tool Recovery Control Failed", async () => {
    fastGrpc.executeCommand.mockRejectedValue(new Error("14 UNAVAILABLE"));

    await expect(
      caller().recoveryControl({ toolId: "fast-1", action: "resume", params: { is_tip_broken: "no" } }),
    ).rejects.toBeDefined();

    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Tool Recovery Control Failed", level: "warning" }),
    );
  });
});
