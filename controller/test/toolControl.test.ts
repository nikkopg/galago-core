import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { logAction } from "@/server/logger";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";

describe("toolControl", () => {
  let queue: CommandQueue;
  let grpc: FakeGrpc;
  let step: ReturnType<typeof deferred<any>>;
  let loop: Promise<void> | undefined;
  let installedToolIds: string[];

  beforeEach(() => {
    queue = new CommandQueue({} as any);
    queue.slackNotificationsEnabled = false;
    (globalThis as any)["__global_command_queue_key"] = queue;

    installedToolIds = ["fast-1"];
    const fake = installFakeTool("fast-1", ToolType.fast);
    grpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });

    step = deferred<any>();
    vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise);

    loop = undefined;
  });

  afterEach(async () => {
    if (!step.isSettled()) {
      step.resolve(undefined);
    }
    if (loop) {
      await loop;
    }
    await new Promise((resolve) => setImmediate(resolve));

    for (const id of installedToolIds) {
      await removeFakeTool(id);
    }
    delete (globalThis as any)["__global_command_queue_key"];
    vi.restoreAllMocks();
  });

  it("reaches the tool while the step is still pending", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    const caller = commandQueueRouter.createCaller({});

    const pauseResult = await caller.toolControl({ action: "pause" });
    expect(pauseResult).toMatchObject({ ok: true, response: ResponseCode.SUCCESS });
    expect(grpc.executeCommand).toHaveBeenCalledWith({ fast: { pause: {} } });

    await caller.toolControl({ action: "resume", params: { is_tip_broken: "no" } });
    expect(grpc.executeCommand).toHaveBeenCalledWith({
      fast: { resume: { is_tip_broken: "no" } },
    });

    expect(step.isSettled()).toBe(false);
    expect(queue.state).toBe(ToolStatus.BUSY);
    expect(queue.isWaitingForInput).toBe(false);

    step.resolve(undefined);
    await loop;
    expect(queue.runningStep).toBeUndefined();
  });

  it("refuses when the running step moves on before dispatch (WR-01 race guard)", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    // Simulate the busy loop moving on to a different step on the same tool
    // between validation and the identity re-check (WR-01): Tool.lookup is
    // the last synchronous call toolControl makes before that re-check, so
    // mutate the private running-step record as a side effect of the lookup
    // to reproduce "the step changed while the control request was being
    // dispatched" without relying on a real timing race.
    const originalLookup = Tool.lookup.bind(Tool);
    const lookupSpy = vi.spyOn(Tool, "lookup").mockImplementationOnce((toolId) => {
      (queue as any)._runningStep = Object.freeze({
        ...queue.runningStep!,
        startedAt: Date.now() + 1,
      });
      return originalLookup(toolId);
    });

    const caller = commandQueueRouter.createCaller({});
    await expect(caller.toolControl({ action: "pause" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(grpc.executeCommand).not.toHaveBeenCalled();

    lookupSpy.mockRestore();
    step.resolve(undefined);
    await loop;
  });

  it("runningStep mirrors the running step", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    const running = queue.runningStep!;
    expect(typeof running.queueId).toBe("number");
    expect(running.runId).toBe("run-1");
    expect(running.toolId).toBe("fast-1");
    expect(running.toolType).toBe(ToolType.fast);
    expect(running.command).toBe("transfer");
    expect(typeof running.startedAt).toBe("number");
    expect(Object.isFrozen(running)).toBe(true);
  });

  it("refuses with no running step", async () => {
    const caller = commandQueueRouter.createCaller({});

    await expect(caller.toolControl({ action: "pause" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(grpc.executeCommand).not.toHaveBeenCalled();
  });

  it("refuses during a Tool Box pause built-in (D-02, Pitfall 1)", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "Tool Box",
        toolType: ToolType.toolbox,
        command: "pause",
        params: { message: "x" },
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.isWaitingForInput).toBe(true);
      },
      { timeout: 5000 },
    );
    expect(queue.runningStep).toBeUndefined();

    const caller = commandQueueRouter.createCaller({});
    await expect(caller.toolControl({ action: "pause" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(grpc.executeCommand).not.toHaveBeenCalled();

    queue.resume();
    await loop;
  });

  it("refuses a running tool without runControl", async () => {
    installedToolIds.push("pf400-1");
    const pf400 = installFakeTool("pf400-1", ToolType.pf400);

    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "pf400-1",
        toolType: ToolType.pf400,
        command: "home",
        params: {},
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    const caller = commandQueueRouter.createCaller({});
    await expect(caller.toolControl({ action: "pause" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(pf400.grpc.executeCommand).not.toHaveBeenCalled();

    step.resolve(undefined);
    await loop;
  });

  it("refuses a blank decision", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    const caller = commandQueueRouter.createCaller({});
    await expect(
      caller.toolControl({ action: "resume", params: { is_tip_broken: "" } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(grpc.executeCommand).not.toHaveBeenCalled();

    step.resolve(undefined);
    await loop;
  });

  it("returns a tool refusal unthrown", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    grpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.ERROR_FROM_TOOL,
      error_message: "instrument not ready: not paused (state running)",
    });

    const caller = commandQueueRouter.createCaller({});
    const result = await caller.toolControl({ action: "pause" });
    expect(result).toStrictEqual({
      ok: false,
      response: ResponseCode.ERROR_FROM_TOOL,
      message: "instrument not ready: not paused (state running)",
    });

    step.resolve(undefined);
    await loop;
  });

  it("surfaces a transport error once", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    grpc.executeCommand.mockRejectedValueOnce(new Error("14 UNAVAILABLE"));

    const caller = commandQueueRouter.createCaller({});
    let caught: any;
    try {
      await caller.toolControl({ action: "pause" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(String(caught?.message)).toContain("14 UNAVAILABLE");
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);

    step.resolve(undefined);
    await loop;
  });

  it("logs every attempt", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    const caller = commandQueueRouter.createCaller({});
    const toolControlLogs = () =>
      vi
        .mocked(logAction)
        .mock.calls.map(([call]) => call as { level: string; action: string; details: string })
        .filter((call) => call.action.startsWith("Tool Control"));

    await expect(caller.toolControl({ action: "resume", params: {} })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    let logs = toolControlLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ level: "warning", action: "Tool Control Refused" });
    expect(logs[0].details).toContain("action=resume");
    expect(logs[0].details).toContain("runId=run-1");
    expect(logs[0].details).toContain("decisions={}");

    const result = await caller.toolControl({ action: "resume", params: { is_tip_broken: "no" } });
    expect(result.ok).toBe(true);
    logs = toolControlLogs();
    expect(logs).toHaveLength(2);
    expect(logs[1]).toMatchObject({ level: "info", action: "Tool Control" });
    expect(logs[1].details).toContain('decisions={"is_tip_broken":"no"}');
    expect(logs[1].details).toContain("outcome=SUCCESS");

    grpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.ERROR_FROM_TOOL,
      error_message: "nope",
    });
    await caller.toolControl({ action: "pause" });
    logs = toolControlLogs();
    expect(logs).toHaveLength(3);
    expect(logs[2]).toMatchObject({ level: "warning", action: "Tool Control" });

    grpc.executeCommand.mockRejectedValueOnce(new Error("boom"));
    await expect(caller.toolControl({ action: "pause" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    logs = toolControlLogs();
    expect(logs).toHaveLength(4);
    expect(logs[3]).toMatchObject({ level: "warning", action: "Tool Control Failed" });

    step.resolve(undefined);
    await loop;
  });

  it("never touches the queue", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    const caller = commandQueueRouter.createCaller({});

    await expect(caller.toolControl({ action: "resume", params: {} })).rejects.toBeDefined();
    expect(queue.state).toBe(ToolStatus.BUSY);
    expect(queue.isWaitingForInput).toBe(false);
    expect(step.isSettled()).toBe(false);

    await caller.toolControl({ action: "resume", params: { is_tip_broken: "no" } });
    expect(queue.state).toBe(ToolStatus.BUSY);
    expect(queue.isWaitingForInput).toBe(false);
    expect(step.isSettled()).toBe(false);

    grpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.ERROR_FROM_TOOL,
      error_message: "nope",
    });
    await caller.toolControl({ action: "pause" });
    expect(queue.state).toBe(ToolStatus.BUSY);
    expect(queue.isWaitingForInput).toBe(false);
    expect(step.isSettled()).toBe(false);

    grpc.executeCommand.mockRejectedValueOnce(new Error("boom"));
    await expect(caller.toolControl({ action: "pause" })).rejects.toBeDefined();
    expect(queue.state).toBe(ToolStatus.BUSY);
    expect(queue.isWaitingForInput).toBe(false);
    expect(step.isSettled()).toBe(false);

    step.resolve(undefined);
    await loop;
  });

  it("clears runningStep when the step fails", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    step.reject(new Error("tool step failed"));
    await loop;

    expect(queue.state).toBe(ToolStatus.FAILED);
    expect(queue.runningStep).toBeUndefined();
  });
});
