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

import { ToolType } from "gen-interfaces/controller";import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { findMany, getSelectedWorkcellId } from "@/db/helpers";
import { toolRouter } from "@/server/routers/tool";
import CommandQueue from "@/server/command_queue";
import { logAction } from "@/server/logger";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";
import { createConfirmedSender } from "@/components/runs/controlDecision";

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
const STACK_TOOL_ROW = {
  id: 3,
  name: "stack-1",
  type: "stack",
  ip: "127.0.0.1",
  port: 3,
  workcellId: 1,
};

describe("recoveryControl", () => {
  let fastGrpc: FakeGrpc;
  let pf400Grpc: FakeGrpc;
  let stackGrpc: FakeGrpc;

  beforeEach(() => {
    (globalThis as any)["__global_command_queue_key"] = new CommandQueue({} as any);
    (globalThis as any)["__global_command_queue_key"].slackNotificationsEnabled = false;

    vi.mocked(getSelectedWorkcellId).mockResolvedValue(1);
    vi.mocked(findMany).mockResolvedValue([FAST_TOOL_ROW, PF400_TOOL_ROW, STACK_TOOL_ROW]);

    fastGrpc = installFakeTool("fast-1", ToolType.fast).grpc;
    pf400Grpc = installFakeTool("pf400-1", ToolType.pf400).grpc;
    stackGrpc = installFakeTool("stack-1", "stack" as ToolType).grpc;
    fastGrpc.executeCommand.mockResolvedValue({
      response: ResponseCode.SUCCESS,
      return_reply: true,
    });
    stackGrpc.executeCommand.mockResolvedValue({
      response: ResponseCode.SUCCESS,
      return_reply: true,
    });
  });

  afterEach(async () => {
    await removeFakeTool("fast-1");
    await removeFakeTool("pf400-1");
    await removeFakeTool("stack-1");
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
    expect(fastGrpc.executeCommand).toHaveBeenCalledWith({
      fast: { resume: { is_tip_broken: "no" } },
    });
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
      caller().recoveryControl({
        toolId: "fast-1",
        action: "resume",
        params: { is_tip_broken: "no" },
      }),
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
    expect(fastGrpc.executeCommand).toHaveBeenCalledWith({
      fast: { abort: { return_liquid: "yes" } },
    });
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
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("is_tip_broken"),
      });
    },
  );

  it("refuses an abort decision that is not exact yes/no", async () => {
    await expect(
      caller().recoveryControl({
        toolId: "fast-1",
        action: "abort",
        params: { return_liquid: "Yes" },
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("return_liquid"),
    });
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

  it("refuses a tool type without recovery actions (action check is first)", async () => {
    await expect(
      caller().recoveryControl({ toolId: "pf400-1", action: "resume", params: {} }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: 'Action "resume" is not available for tool type "pf400".',
    });
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
      caller().recoveryControl({
        toolId: "fast-1",
        action: "resume",
        params: { is_tip_broken: "no" },
      }),
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

    await caller().recoveryControl({
      toolId: "fast-1",
      action: "resume",
      params: { is_tip_broken: "no" },
    });

    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Tool Recovery Control", level: "warning" }),
    );
  });

  it("logs a transport failure as Tool Recovery Control Failed", async () => {
    fastGrpc.executeCommand.mockRejectedValue(new Error("14 UNAVAILABLE"));

    await expect(
      caller().recoveryControl({
        toolId: "fast-1",
        action: "resume",
        params: { is_tip_broken: "no" },
      }),
    ).rejects.toBeDefined();

    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Tool Recovery Control Failed", level: "warning" }),
    );
  });

  describe("tool-page recovery send reaches the tool", () => {
    it("sends a confirmed recovery resume through the real router to the tool", async () => {
      const notify = { accepted: vi.fn(), refused: vi.fn() };
      const sender = createConfirmedSender({
        sendRunning: vi.fn(),
        sendRecovery: (input) => toolRouter.createCaller({}).recoveryControl(input) as any,
        notify,
      });

      const outcome = await sender.send({
        target: { kind: "recovery", toolId: "fast-1" },
        toolType: "fast",
        action: "resume",
        decisions: { is_tip_broken: "yes" },
      });

      expect(outcome).toMatchObject({ status: "accepted" });
      expect(fastGrpc.executeCommand).toHaveBeenCalledTimes(1);
      expect(fastGrpc.executeCommand).toHaveBeenCalledWith({
        fast: { resume: { is_tip_broken: "yes" } },
      });
      expect(notify.refused).not.toHaveBeenCalled();
    });

    it("surfaces the tracked-tool refusal verbatim when the send fails", async () => {
      vi.spyOn(CommandQueue.prototype, "runningStep", "get").mockReturnValue({
        queueId: 1,
        runId: "run-1",
        toolId: "FAST 1",
        toolType: ToolType.fast,
        command: "transfer",
        startedAt: 0,
      });

      const notify = { accepted: vi.fn(), refused: vi.fn() };
      const sender = createConfirmedSender({
        sendRunning: vi.fn(),
        sendRecovery: (input) => toolRouter.createCaller({}).recoveryControl(input) as any,
        notify,
      });

      const outcome = await sender.send({
        target: { kind: "recovery", toolId: "fast-1" },
        toolType: "fast",
        action: "resume",
        decisions: { is_tip_broken: "yes" },
      });

      expect(outcome).toMatchObject({
        status: "failed",
        message: "A run step is tracking this tool; use the run page.",
      });
      expect(notify.refused).toHaveBeenCalledWith(
        "A run step is tracking this tool; use the run page.",
      );
      expect(fastGrpc.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe("stack acknowledge", () => {
    it("sends one controlCommand with the exact payload (tracer, OPR-01)", async () => {
      const result = await caller().recoveryControl({
        toolId: "stack-1",
        action: "acknowledge_failure",
        params: { guid: "guid-a", arm_inspected: "yes" },
      });

      expect(result).toMatchObject({ ok: true, response: ResponseCode.SUCCESS });
      expect(stackGrpc.executeCommand).toHaveBeenCalledTimes(1);
      expect(stackGrpc.executeCommand.mock.calls[0]).toHaveLength(1);
      expect(stackGrpc.executeCommand.mock.calls[0][0]).toStrictEqual({ stack: { acknowledge_failure: { guid: "guid-a", arm_inspected: "yes" } } });
      expect(stackGrpc.executeCommand).toHaveBeenCalledWith({
        stack: { acknowledge_failure: { guid: "guid-a", arm_inspected: "yes" } },
      });
      expect(logAction).toHaveBeenCalledTimes(1);
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "Tool Recovery Control", level: "info" }),
      );
    });

    it("refuses an acknowledge while the queue's step runs on the stack tool (D-09)", async () => {
      vi.spyOn(CommandQueue.prototype, "runningStep", "get").mockReturnValue({
        queueId: 1,
        runId: "run-1",
        toolId: "STACK 1",
        toolType: "stack" as ToolType,
        command: "transfer",
        startedAt: 0,
      });

      await expect(
        caller().recoveryControl({
          toolId: "stack-1",
          action: "acknowledge_failure",
          params: { guid: "guid-a", arm_inspected: "yes" },
        }),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "A run step is running on this tool; acknowledge after it ends.",
      });
      expect(stackGrpc.executeCommand).not.toHaveBeenCalled();
      expect(logAction).toHaveBeenCalledTimes(1);
      const details = vi.mocked(logAction).mock.calls[0][0].details;
      expect(details).toContain("toolId=stack-1");
      expect(details).toContain("outcome=refused: PRECONDITION_FAILED");
      expect(details).toContain("A run step is running on this tool; acknowledge after it ends.");
    });

    it("keeps the run-page message for a tool type with runControl while it runs (D-09)", async () => {
      vi.spyOn(CommandQueue.prototype, "runningStep", "get").mockReturnValue({
        queueId: 1,
        runId: "run-1",
        toolId: "FAST 1",
        toolType: ToolType.fast,
        command: "transfer",
        startedAt: 0,
      });

      await expect(
        caller().recoveryControl({
          toolId: "fast-1",
          action: "resume",
          params: { is_tip_broken: "no" },
        }),
      ).rejects.toMatchObject({
        message: "A run step is tracking this tool; use the run page.",
      });
      expect(fastGrpc.executeCommand).not.toHaveBeenCalled();
    });

    it("refuses a fast action on the stack type and audits it", async () => {
      await expect(
        caller().recoveryControl({ toolId: "stack-1", action: "resume", params: {} }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: 'Action "resume" is not available for tool type "stack".',
      });
      expect(stackGrpc.executeCommand).not.toHaveBeenCalled();
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "Tool Recovery Control Refused",
          level: "warning",
          details: expect.stringContaining("outcome=refused: BAD_REQUEST"),
        }),
      );
    });

    it.each([
      {},
      { arm_inspected: "yes" },
      { guid: "" },
      { guid: "guid-a", arm_inspected: "" },
      { guid: "guid-a", arm_inspected: "No" },
    ])("refuses an acknowledge with missing or failed params %j", async (params) => {
      await expect(
        caller().recoveryControl({
          toolId: "stack-1",
          action: "acknowledge_failure",
          params,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(stackGrpc.executeCommand).not.toHaveBeenCalled();
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "Tool Recovery Control Refused",
          level: "warning",
        }),
      );
    });

    it("refuses a SUCCESS reply that carries a message on the acknowledge (D-10)", async () => {
      stackGrpc.executeCommand.mockResolvedValue({
        response: ResponseCode.SUCCESS,
        error_message: "latch not cleared: arm still armed",
        return_reply: true,
      });

      const result = await caller().recoveryControl({
        toolId: "stack-1",
        action: "acknowledge_failure",
        params: { guid: "guid-a", arm_inspected: "yes" },
      });

      expect(stackGrpc.executeCommand).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        ok: false,
        response: ResponseCode.SUCCESS,
        message: "latch not cleared: arm still armed",
      });
      expect(logAction).toHaveBeenCalledTimes(1);
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "Tool Recovery Control Refused",
          level: "warning",
          details: expect.stringContaining("latch not cleared: arm still armed"),
        }),
      );
    });

    it("treats a whitespace-only error_message as present on the acknowledge (D-10)", async () => {
      stackGrpc.executeCommand.mockResolvedValue({
        response: ResponseCode.SUCCESS,
        error_message: "   ",
        return_reply: true,
      });

      const result = await caller().recoveryControl({
        toolId: "stack-1",
        action: "acknowledge_failure",
        params: { guid: "guid-a", arm_inspected: "yes" },
      });

      expect(stackGrpc.executeCommand).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        ok: false,
        response: ResponseCode.SUCCESS,
        message: "   ",
      });
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "Tool Recovery Control Refused", level: "warning" }),
      );
    });

    it("accepts a SUCCESS reply with an empty error_message on the acknowledge", async () => {
      stackGrpc.executeCommand.mockResolvedValue({
        response: ResponseCode.SUCCESS,
        error_message: "",
        return_reply: true,
      });

      const result = await caller().recoveryControl({
        toolId: "stack-1",
        action: "acknowledge_failure",
        params: { guid: "guid-a", arm_inspected: "yes" },
      });

      expect(result).toMatchObject({ ok: true, response: ResponseCode.SUCCESS });
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "Tool Recovery Control", level: "info" }),
      );
    });

    it("keeps SUCCESS+message accepted for fast resume (D-10 scoped to stack)", async () => {
      fastGrpc.executeCommand.mockResolvedValue({
        response: ResponseCode.SUCCESS,
        error_message: "resume scheduled",
        return_reply: true,
      });

      const result = await caller().recoveryControl({
        toolId: "fast-1",
        action: "resume",
        params: { is_tip_broken: "no" },
      });

      expect(result).toMatchObject({ ok: true, response: ResponseCode.SUCCESS });
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "Tool Recovery Control", level: "info" }),
      );
    });

    it("audits a transport error with its text and rethrows it (D-23 one attempt)", async () => {
      stackGrpc.executeCommand.mockRejectedValue(new Error("14 UNAVAILABLE"));

      await expect(
        caller().recoveryControl({
          toolId: "stack-1",
          action: "acknowledge_failure",
          params: { guid: "guid-a", arm_inspected: "yes" },
        }),
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: expect.stringContaining("14 UNAVAILABLE"),
      });
      expect(stackGrpc.executeCommand).toHaveBeenCalledTimes(1);
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "Tool Recovery Control Failed",
          level: "warning",
          details: expect.stringContaining("outcome=transport error: 14 UNAVAILABLE"),
        }),
      );
    });

    it("serves two requests one attempt each with no retry (no-busy-wait)", async () => {
      const pending = deferred<{ response: ResponseCode; return_reply: boolean }>();
      stackGrpc.executeCommand.mockReturnValueOnce(pending.promise);

      let firstSettled = false;
      const first = caller()
        .recoveryControl({
          toolId: "stack-1",
          action: "acknowledge_failure",
          params: { guid: "guid-a", arm_inspected: "yes" },
        })
        .then((r) => {
          firstSettled = true;
          return r;
        });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(firstSettled).toBe(false);

      pending.resolve({ response: ResponseCode.SUCCESS, return_reply: true });
      await expect(first).resolves.toMatchObject({ ok: true });

      const second = await caller().recoveryControl({
        toolId: "stack-1",
        action: "acknowledge_failure",
        params: { guid: "guid-b", arm_inspected: "yes" },
      });
      expect(second).toMatchObject({ ok: true });

      // Two overlapping/completed requests, exactly two sends — never a
      // re-issue of the first request's payload.
      expect(stackGrpc.executeCommand).toHaveBeenCalledTimes(2); // one attempt per request
      expect(stackGrpc.executeCommand.mock.calls[0][0]).toStrictEqual({ stack: { acknowledge_failure: { guid: "guid-a", arm_inspected: "yes" } } });
      expect(stackGrpc.executeCommand.mock.calls[1][0]).toStrictEqual({ stack: { acknowledge_failure: { guid: "guid-b", arm_inspected: "yes" } } });
    });
  });
});
