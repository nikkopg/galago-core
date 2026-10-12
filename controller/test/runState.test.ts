import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";
import { extractRunState } from "@/server/runState";

function statusReplyWith(run_state: unknown): any {
  return { uptime: 1, status: ToolStatus.BUSY, run_state };
}

describe("runState", () => {
  let queue: CommandQueue;
  let grpc: FakeGrpc;
  let step: ReturnType<typeof deferred<any>>;
  let loop: Promise<void> | undefined;

  beforeEach(() => {
    queue = new CommandQueue({} as any);
    queue.slackNotificationsEnabled = false;
    (globalThis as any)["__global_command_queue_key"] = queue;

    const fake = installFakeTool("fast-1", ToolType.fast);
    grpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });
    grpc.getStatus.mockResolvedValue(
      statusReplyWith({
        state: "paused",
        percent: 40,
        pause: {
          errorCode: -645,
          errorName: "WrongPlateType",
          percent: 0,
          eventPayload: {
            wrongDetection: [{ expectedPlateID: 1, detectedPlateID: null, position: 3 }],
          },
          since: "2026-10-12T09:00:00Z",
        },
      }),
    );

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
    await removeFakeTool("fast-1");
    delete (globalThis as any)["__global_command_queue_key"];
    vi.restoreAllMocks();
  });

  it("reports the running tool's paused run_state", async () => {
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

    const snapshot: any = await caller.runState();
    expect(snapshot.running).toBe(true);
    expect(snapshot.queueId).toBe(queue.runningStep!.queueId);
    expect(snapshot.runId).toBe("run-1");
    expect(snapshot.toolId).toBe("fast-1");
    expect(snapshot.toolType).toBe(ToolType.fast);
    expect(snapshot.status).toBe("ok");
    expect(snapshot.runState).toMatchObject({
      state: "paused",
      percent: 40,
      pause: {
        name: "WrongPlateType",
        code: -645,
        detail: { wrongDetection: [{ expectedPlateID: 1, detectedPlateID: null, position: 3 }] },
        startedAt: "2026-10-12T09:00:00Z",
      },
    });
    expect(typeof snapshot.updatedAt).toBe("number");
    expect(grpc.executeCommand).not.toHaveBeenCalled();

    step.resolve(undefined);
    await loop;

    expect(await caller.runState()).toStrictEqual({ running: false });
  });
});

describe("extractRunState", () => {
  it("returns a null runState when run_state is absent", () => {
    const result = extractRunState(statusReplyWith(undefined));
    expect(result).toStrictEqual({ ok: true, runState: null });
  });

  it("returns a null runState when run_state is null", () => {
    const result = extractRunState(statusReplyWith(null));
    expect(result).toStrictEqual({ ok: true, runState: null });
  });

  it("percent 0 passes through unrounded and unchanged", () => {
    const result = extractRunState(statusReplyWith({ state: "running", percent: 0, pause: null }));
    expect(result).toStrictEqual({
      ok: true,
      runState: { state: "running", percent: 0, pause: null },
    });
  });

  it("a null pause gives a null pause", () => {
    const result = extractRunState(statusReplyWith({ state: "running", percent: 1, pause: null }));
    expect((result as any).runState.pause).toBeNull();
  });
});
