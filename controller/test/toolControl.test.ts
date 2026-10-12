import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
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
});
