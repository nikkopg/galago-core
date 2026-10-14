import { describe, it, expect, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";
import { createConfirmedSender, runAfterAccepted } from "@/components/runs/controlDecision";
import type { RunningEnvelope } from "@/components/runs/controlDecision";
import {
  shouldInterceptQueueStop,
  shouldInterceptRunDelete,
  stopModalBody,
  STOP_MODAL_COPY,
} from "@/components/runs/stopInterception";
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

function makeRunningEnvelope(overrides: Partial<RunningEnvelope> = {}): RunningEnvelope {
  return {
    running: true,
    queueId: 1,
    runId: "run-1",
    toolId: "tool-1",
    toolType: "fast" as any,
    command: "transfer",
    status: "ok",
    runState: null,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("queue stop interception", () => {
  it("is false for undefined", () => {
    expect(shouldInterceptQueueStop(undefined)).toBe(false);
  });

  it("is false when not running", () => {
    expect(shouldInterceptQueueStop({ running: false })).toBe(false);
  });

  it("is false for a running tool type with no runControl entry (pf400)", () => {
    expect(shouldInterceptQueueStop(makeRunningEnvelope({ toolType: "pf400" as any }))).toBe(false);
  });

  it("is true for a running fast envelope with status ok", () => {
    expect(shouldInterceptQueueStop(makeRunningEnvelope({ status: "ok" }))).toBe(true);
  });

  it("is true for a running fast envelope with status unknown", () => {
    expect(shouldInterceptQueueStop(makeRunningEnvelope({ status: "unknown" }))).toBe(true);
  });
});

describe("run delete interception", () => {
  it("is true for the run that contains the running step", () => {
    expect(shouldInterceptRunDelete(makeRunningEnvelope({ runId: "run-1" }), "run-1")).toBe(true);
  });

  it("is false for a different run", () => {
    expect(shouldInterceptRunDelete(makeRunningEnvelope({ runId: "run-1" }), "run-2")).toBe(false);
  });

  it("is false when undefined", () => {
    expect(shouldInterceptRunDelete(undefined, "run-1")).toBe(false);
  });

  it("is false when not running", () => {
    expect(shouldInterceptRunDelete({ running: false }, "run-1")).toBe(false);
  });
});

describe("stop modal copy", () => {
  // WR-04: stopModalBody derives its decision keys from the tool's declared
  // abort spec (getActionSpec) instead of hardcoding `return_liquid`, so it
  // needs a toolType with a runControl entry — "fast" is the only one today.
  it("restates return liquid: yes", () => {
    expect(stopModalBody("fast", { return_liquid: "yes" })).toBe(
      "Abort the instrument run (Return liquid? Yes)",
    );
  });

  it("restates return liquid: no", () => {
    expect(stopModalBody("fast", { return_liquid: "no" })).toBe(
      "Abort the instrument run (Return liquid? No)",
    );
  });

  it("restates not chosen when undefined", () => {
    expect(stopModalBody("fast", {})).toBe("Abort the instrument run (Return liquid? not chosen)");
  });

  it("falls back to a plain sentence for a tool type with no declared abort decisions", () => {
    expect(stopModalBody("unknown-tool-type", {})).toBe("Abort the instrument run.");
  });

  it("confirm label is Abort", () => {
    expect(STOP_MODAL_COPY.confirmLabel).toBe("Abort");
  });
});

describe("clear follow-ups", () => {
  it("calls clearAll once after an accepted send", async () => {
    const clearAll = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn().mockResolvedValue({ status: "accepted" });
    const result = await runAfterAccepted(send, clearAll);
    expect(clearAll).toHaveBeenCalledTimes(1);
    expect(result.followUp).toBe("done");
  });

  it("never calls clearAll on a refused send", async () => {
    const clearAll = vi.fn();
    const send = vi.fn().mockResolvedValue({ status: "refused", message: "nope" });
    await runAfterAccepted(send, clearAll);
    expect(clearAll).not.toHaveBeenCalled();
  });

  it("never calls clearAll on a failed send", async () => {
    const clearAll = vi.fn();
    const send = vi.fn().mockResolvedValue({ status: "failed", message: "boom" });
    await runAfterAccepted(send, clearAll);
    expect(clearAll).not.toHaveBeenCalled();
  });

  it("a clearByRunId follow-up receives the run id", async () => {
    const clearByRunId = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn().mockResolvedValue({ status: "accepted" });
    await runAfterAccepted(send, () => clearByRunId("run-1"));
    expect(clearByRunId).toHaveBeenCalledWith("run-1");
  });

  it("reports a rejecting follow-up as failed", async () => {
    const send = vi.fn().mockResolvedValue({ status: "accepted" });
    const result = await runAfterAccepted(send, () => Promise.reject(new Error("db locked")));
    expect(result.followUp).toBe("failed");
    expect(result.followUpMessage).toBe("db locked");
  });
});
