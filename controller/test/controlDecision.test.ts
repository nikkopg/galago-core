import { describe, it, expect, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";
import {
  shouldShowControlBar,
  createConfirmedSender,
  type RunningEnvelope,
} from "@/components/runs/controlDecision";
import type { RunStateEnvelope } from "@/server/runState";

function statusReplyWith(run_state: unknown): any {
  return { uptime: 1, status: ToolStatus.BUSY, run_state };
}

describe("confirmed pause reaches the running tool", () => {
  it("sends {fast: {pause: {}}} to the running tool through commandQueue.toolControl", async () => {
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
        commandInfo: { toolId: "fast-1", toolType: ToolType.fast, command: "transfer", params: {} },
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
      expect(shouldShowControlBar(envelope)).toBe(true);

      const notify = { accepted: vi.fn(), refused: vi.fn() };
      const sender = createConfirmedSender({
        sendRunning: (input) => caller.toolControl(input) as any,
        notify,
      });

      const outcome = await sender.send({
        target: { kind: "running" },
        toolType: "fast",
        action: "pause",
        decisions: {},
      });

      expect(outcome.status).toBe("accepted");
      expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
      expect(grpc.executeCommand).toHaveBeenCalledWith({ fast: { pause: {} } });
      expect(notify.accepted.mock.calls[0][0]).toBe("Instrument paused");
      expect(step.isSettled()).toBe(false);
      expect(queue.isWaitingForInput).toBe(false);
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

describe("bar visibility", () => {
  function runningEnvelope(toolType: string): RunningEnvelope {
    return {
      running: true,
      queueId: 1,
      runId: "run-1",
      toolId: "tool-1",
      toolType: toolType as any,
      status: "ok",
      runState: null,
      updatedAt: Date.now(),
    };
  }

  it("is false for undefined", () => {
    expect(shouldShowControlBar(undefined)).toBe(false);
  });

  it("is false when not running", () => {
    expect(shouldShowControlBar({ running: false })).toBe(false);
  });

  it("is false for a tool type with no runControl entry (pf400)", () => {
    expect(shouldShowControlBar(runningEnvelope("pf400"))).toBe(false);
  });

  it("is true for a running fast envelope", () => {
    expect(shouldShowControlBar(runningEnvelope("fast"))).toBe(true);
  });
});

describe("confirmed sender", () => {
  it("returns refused with the verbatim message on ok: false", async () => {
    const sendRunning = vi.fn().mockResolvedValue({
      ok: false,
      response: "ERROR_FROM_TOOL",
      message: "instrument not ready: not paused (state running)",
    });
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning, notify });

    const outcome = await sender.send({
      target: { kind: "running" },
      toolType: "fast",
      action: "pause",
      decisions: {},
    });

    expect(outcome).toStrictEqual({
      status: "refused",
      message: "instrument not ready: not paused (state running)",
    });
    expect(notify.refused).toHaveBeenCalledWith("instrument not ready: not paused (state running)");
    expect(sendRunning).toHaveBeenCalledTimes(1);
  });

  it("returns failed with the error message on a rejected send", async () => {
    const sendRunning = vi.fn().mockRejectedValue(new Error("14 UNAVAILABLE"));
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning, notify });

    const outcome = await sender.send({
      target: { kind: "running" },
      toolType: "fast",
      action: "pause",
      decisions: {},
    });

    expect(outcome).toStrictEqual({ status: "failed", message: "14 UNAVAILABLE" });
    expect(sendRunning).toHaveBeenCalledTimes(1);
  });

  it("ignores a second send while the first is in flight", async () => {
    const pending = deferred<{ ok: boolean; response: string; message?: string }>();
    const sendRunning = vi.fn().mockReturnValue(pending.promise);
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning, notify });

    const request = {
      target: { kind: "running" as const },
      toolType: "fast",
      action: "pause",
      decisions: {},
    };

    const first = sender.send(request);
    const second = await sender.send(request);

    expect(second).toStrictEqual({ status: "ignored", reason: "in-flight" });
    expect(sendRunning).toHaveBeenCalledTimes(1);

    pending.resolve({ ok: true, response: "SUCCESS" });
    await first;
  });

  it("ignores resume with no decisions and sends nothing", async () => {
    const sendRunning = vi.fn();
    const notify = { accepted: vi.fn(), refused: vi.fn() };
    const sender = createConfirmedSender({ sendRunning, notify });

    const outcome = await sender.send({
      target: { kind: "running" },
      toolType: "fast",
      action: "resume",
      decisions: {},
    });

    expect(outcome).toStrictEqual({ status: "ignored", reason: "incomplete" });
    expect(sendRunning).not.toHaveBeenCalled();
  });
});
