import { describe, it, expect, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";
import { createConfirmedSender, runAfterAccepted } from "@/components/runs/controlDecision";
import { shouldInterceptQueueStop } from "@/components/runs/stopInterception";
import type { RunStateEnvelope } from "@/server/runState";

function statusReplyWith(run_state: unknown): any {
  return { uptime: 1, status: ToolStatus.BUSY, run_state };
}

describe("pause queue during a controllable step", () => {
  it("aborts before stopping", async () => {
    const queue = new CommandQueue({} as any);
    queue.slackNotificationsEnabled = false;
    (globalThis as any)["__global_command_queue_key"] = queue;

    const fake = installFakeTool("fast-1", ToolType.fast);
    const grpc: FakeGrpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });
    grpc.getStatus.mockResolvedValue(
      statusReplyWith({ state: "running", percent: 10, pause: null }),
    );

    const step = deferred<any>();
    vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise);

    let loop: Promise<void> | undefined;

    try {
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

      await vi.waitFor(
        async () => {
          const snapshot: any = await caller.runState();
          expect(snapshot.status).toBe("ok");
        },
        { timeout: 5000 },
      );

      const envelope: RunStateEnvelope = await caller.runState();
      expect(shouldInterceptQueueStop(envelope)).toBe(true);

      const sender = createConfirmedSender({
        sendRunning: (i) => caller.toolControl(i) as any,
        notify: { accepted: vi.fn(), refused: vi.fn() },
      });
      const stop = vi.fn(() => caller.stop());

      const result = await runAfterAccepted(
        () =>
          sender.send({
            target: { kind: "running" },
            toolType: "fast",
            action: "abort",
            decisions: { return_liquid: "yes" },
          }),
        stop,
      );

      expect(result.followUp).toBe("done");
      expect(grpc.executeCommand).toHaveBeenCalledWith({
        fast: { abort: { return_liquid: "yes" } },
      });
      expect(stop).toHaveBeenCalledTimes(1);
      const executeOrder = grpc.executeCommand.mock.invocationCallOrder[0];
      const stopOrder = stop.mock.invocationCallOrder[0];
      expect(executeOrder).toBeLessThan(stopOrder);
      expect(queue.state).toBe(ToolStatus.OFFLINE);
    } finally {
      if (!step.isSettled()) {
        step.resolve(undefined);
      }
      if (loop) {
        await loop;
      }
      await new Promise((resolve) => setImmediate(resolve));
      await removeFakeTool("fast-1");
      delete (globalThis as any)["__global_command_queue_key"];
      vi.restoreAllMocks();
    }
  });

  it("a refused abort never stops the queue", async () => {
    const queue = new CommandQueue({} as any);
    queue.slackNotificationsEnabled = false;
    (globalThis as any)["__global_command_queue_key"] = queue;

    const fake = installFakeTool("fast-1", ToolType.fast);
    const grpc: FakeGrpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({
      response: ResponseCode.ERROR_FROM_TOOL,
      error_message: "instrument not ready: nothing to abort",
    });
    grpc.getStatus.mockResolvedValue(
      statusReplyWith({ state: "running", percent: 10, pause: null }),
    );

    const step = deferred<any>();
    vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise);

    let loop: Promise<void> | undefined;

    try {
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

      await vi.waitFor(
        async () => {
          const snapshot: any = await caller.runState();
          expect(snapshot.status).toBe("ok");
        },
        { timeout: 5000 },
      );

      const envelope: RunStateEnvelope = await caller.runState();
      expect(shouldInterceptQueueStop(envelope)).toBe(true);

      const sender = createConfirmedSender({
        sendRunning: (i) => caller.toolControl(i) as any,
        notify: { accepted: vi.fn(), refused: vi.fn() },
      });
      const stop = vi.fn(() => caller.stop());

      const result = await runAfterAccepted(
        () =>
          sender.send({
            target: { kind: "running" },
            toolType: "fast",
            action: "abort",
            decisions: { return_liquid: "yes" },
          }),
        stop,
      );

      expect(result.outcome).toMatchObject({
        status: "refused",
        message: "instrument not ready: nothing to abort",
      });
      expect(result.followUp).toBe("skipped");
      expect(stop).not.toHaveBeenCalled();
      expect(queue.state).toBe(ToolStatus.BUSY);
    } finally {
      if (!step.isSettled()) {
        step.resolve(undefined);
      }
      if (loop) {
        await loop;
      }
      await new Promise((resolve) => setImmediate(resolve));
      await removeFakeTool("fast-1");
      delete (globalThis as any)["__global_command_queue_key"];
      vi.restoreAllMocks();
    }
  });
});
