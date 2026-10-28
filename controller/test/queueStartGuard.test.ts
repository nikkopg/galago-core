// QUE-07 / QUE-08 / QUE-09: single-flight Start guard and Start audit log.
// Fakes only: FakeGrpc and a Tool.executeCommand spy. No real gRPC endpoint is
// ever contacted, so no test can move an instrument.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { logAction } from "@/server/logger";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";

function row(runId: string, tag: string) {
  return {
    runId,
    status: "CREATED",
    commandInfo: {
      toolId: "fast-1",
      toolType: ToolType.fast,
      command: "transfer",
      params: { tag },
    },
  } as any;
}

function logs(action: string) {
  return vi
    .mocked(logAction)
    .mock.calls.map(([entry]) => entry as { level: string; action: string; details: string })
    .filter((entry) => entry.action === action);
}

describe("queue start guard", () => {
  let queue: CommandQueue;
  let grpc: FakeGrpc;
  let step: ReturnType<typeof deferred<any>>;
  let loops: Array<Promise<void>>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    queue = new CommandQueue({} as any);
    queue.slackNotificationsEnabled = false;
    (globalThis as any)["__global_command_queue_key"] = queue;

    const fake = installFakeTool("fast-1", ToolType.fast);
    grpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });

    step = deferred<any>();
    loops = [];
  });

  afterEach(async () => {
    if (!step.isSettled()) {
      step.resolve(undefined);
    }
    await vi.advanceTimersByTimeAsync(1500 * 10);
    await Promise.all(loops);
    vi.useRealTimers();
    await new Promise((resolve) => setImmediate(resolve));

    await removeFakeTool("fast-1");
    delete (globalThis as any)["__global_command_queue_key"];
    vi.restoreAllMocks();
  });

  function holdStep() {
    return vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise);
  }

  function start(source?: "operator" | "enqueue") {
    const p = queue._start(source);
    loops.push(p);
    return p;
  }

  it("a second Start through the restart router while a step is in flight is ignored", async () => {
    const spy = holdStep();
    await queue.commands.push(row("run-1", "r1"));

    const l1 = start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(queue.runningStep).toBeDefined();
    const inFlightQueueId = queue.runningStep!.queueId;

    await expect(commandQueueRouter.createCaller({}).restart()).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(3000);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(queue.state).toBe(ToolStatus.BUSY);

    const ignored = logs("Queue Start Ignored");
    expect(ignored).toHaveLength(1);
    expect(ignored[0].level).toBe("warning");
    expect(ignored[0].details).toContain("source=operator");
    expect(ignored[0].details).toContain(`inFlightQueueId=${inFlightQueueId}`);
    expect(logs("Queue Started")).toHaveLength(1);

    step.resolve(undefined);
    await vi.advanceTimersByTimeAsync(3000);
    await l1;
  });

  it("two Starts in the same tick log one Queue Started and dispatch the row once", async () => {
    const spy = holdStep();
    await queue.commands.push(row("run-1", "r1"));

    const a = start();
    const b = start();
    await b;

    expect(logs("Queue Started")).toHaveLength(1);
    const ignored = logs("Queue Start Ignored");
    expect(ignored).toHaveLength(1);
    expect(ignored[0].details).toContain("inFlightQueueId=unknown");

    await vi.advanceTimersByTimeAsync(1500);
    expect(spy).toHaveBeenCalledTimes(1);

    step.resolve(undefined);
    await vi.advanceTimersByTimeAsync(3000);
    await a;
  });

  it("Pause queue then Start while the step is in flight is ignored until the step ends", async () => {
    const spy = holdStep();
    await queue.commands.push(row("run-1", "r1"));
    await queue.commands.push(row("run-2", "r2"));

    const l1 = start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(queue.runningStep).toBeDefined();

    const stopP = queue.stop();
    await queue._start();

    expect(queue.state).toBe(ToolStatus.OFFLINE);
    expect(queue.state).not.toBe(ToolStatus.READY);
    expect(logs("Queue Start Ignored")).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);

    step.resolve(undefined);
    spy.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(3000);
    await stopP;
    await l1;

    const l2 = start();
    await vi.advanceTimersByTimeAsync(4500);
    await l2;

    expect(spy).toHaveBeenCalledTimes(2);
    expect((spy.mock.calls[1][0] as any).params.tag).toBe("r2");
  });

  it("enqueueRun while the loop owns the queue dispatches nothing extra", async () => {
    const spy = holdStep();
    await queue.commands.push(row("run-1", "r1"));

    const l1 = start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(queue.runningStep).toBeDefined();

    await queue.enqueueRun({
      id: "run-2",
      protocolName: "p",
      commands: [row("run-2", "r2")],
    } as any);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(logs("Queue Start Ignored")).toHaveLength(0);

    // Force the auto-start path: enqueueRun only starts when the queue is READY.
    (queue as any)._setState(ToolStatus.READY);
    await queue.enqueueRun({
      id: "run-3",
      protocolName: "p",
      commands: [row("run-3", "r3")],
    } as any);
    const ignored = logs("Queue Start Ignored");
    expect(ignored).toHaveLength(1);
    expect(ignored[0].details).toContain("source=enqueue");
    expect(spy).toHaveBeenCalledTimes(1);

    (queue as any)._setState(ToolStatus.BUSY);
    step.resolve(undefined);
    spy.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(1500 * 4);
    await l1;

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls.map(([info]) => (info as any).params.tag)).toEqual(["r1", "r2", "r3"]);
  });
});
