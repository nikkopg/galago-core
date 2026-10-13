import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import type { RunningStep } from "@/server/command_queue";
import Tool from "@/server/tools";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";
import { RUN_STATE_POLL_INTERVAL_MS, extractRunState, RunStateMonitor } from "@/server/runState";

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

  it.each([[[]], ["x"], [5]])("rejects a run_state that is not a plain object (%j)", (value) => {
    const result = extractRunState(statusReplyWith(value));
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/not an object/);
  });

  it.each([[{}], [{ state: 3 }]])(
    "rejects a run_state with a missing or non-string state (%j)",
    (value) => {
      const result = extractRunState(statusReplyWith(value));
      expect(result.ok).toBe(false);
      expect((result as any).error).toMatch(/state/);
    },
  );

  it("rejects a pause that is present but not a plain object", () => {
    const result = extractRunState(statusReplyWith({ state: "paused", pause: "x" }));
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/pause/);
  });

  it("gives a null percent for a non-number percent value", () => {
    const result = extractRunState(statusReplyWith({ state: "running", percent: "40" }));
    expect(result).toStrictEqual({
      ok: true,
      runState: { state: "running", percent: null, pause: null },
    });
  });

  it.each([0, 100, 33.5, -1])("passes a finite percent through unchanged (%p)", (percent) => {
    const result = extractRunState(statusReplyWith({ state: "running", percent, pause: null }));
    expect(result).toStrictEqual({
      ok: true,
      runState: { state: "running", percent, pause: null },
    });
  });

  it.each([NaN, Infinity])("gives a null percent for a non-finite value (%p)", (percent) => {
    const result = extractRunState(statusReplyWith({ state: "running", percent, pause: null }));
    expect((result as any).runState.percent).toBeNull();
  });

  it("gives code 0 for an errorCode of 0", () => {
    const result = extractRunState(
      statusReplyWith({
        state: "paused",
        percent: 0,
        pause: { errorCode: 0, errorName: "X", eventPayload: null, since: "2026-01-01T00:00:00Z" },
      }),
    );
    expect((result as any).runState.pause.code).toBe(0);
  });

  it("gives a null code for a non-numeric errorCode", () => {
    const result = extractRunState(
      statusReplyWith({
        state: "paused",
        percent: 0,
        pause: {
          errorCode: "-645",
          errorName: "X",
          eventPayload: null,
          since: "2026-01-01T00:00:00Z",
        },
      }),
    );
    expect((result as any).runState.pause.code).toBeNull();
  });

  it("ignores unknown extra keys on run_state and on pause", () => {
    const result = extractRunState(
      statusReplyWith({ state: "running", percent: 1, pause: null, foo: 1 }),
    );
    expect(result).toStrictEqual({
      ok: true,
      runState: { state: "running", percent: 1, pause: null },
    });

    const result2 = extractRunState(
      statusReplyWith({
        state: "paused",
        percent: 1,
        pause: {
          errorCode: 1,
          errorName: "X",
          eventPayload: null,
          since: "2026-01-01T00:00:00Z",
          extra: "ignored",
        },
      }),
    );
    expect((result2 as any).runState.pause).toStrictEqual({
      name: "X",
      code: 1,
      detail: null,
      startedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("gives a null startedAt for a null since", () => {
    const result = extractRunState(
      statusReplyWith({
        state: "paused",
        percent: 0,
        pause: { errorCode: 1, errorName: "X", eventPayload: null, since: null },
      }),
    );
    expect((result as any).runState.pause.startedAt).toBeNull();
  });

  it("gives ok for the adapter's own transport-error report", () => {
    const result = extractRunState(statusReplyWith({ state: "unknown" }));
    expect(result).toStrictEqual({
      ok: true,
      runState: { state: "unknown", percent: null, pause: null },
    });
  });
});

describe("RunStateMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeStep(overrides: Partial<RunningStep> = {}): RunningStep {
    return {
      queueId: 1,
      runId: "run-1",
      toolId: "fast-1",
      toolType: ToolType.fast,
      command: "transfer",
      startedAt: Date.now(),
      ...overrides,
    };
  }

  it("polls at start and every 2000 ms", async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValue(statusReplyWith({ state: "running", percent: 1, pause: null }));
    const monitor = new RunStateMonitor({ lookupTool: () => ({ grpc: { getStatus } }) });

    monitor.start(makeStep());
    expect(getStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1999);
    expect(getStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(getStatus).toHaveBeenCalledTimes(2);

    monitor.stop();
    await vi.advanceTimersByTimeAsync(10000);
    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  it("shows unknown on a failed poll and keeps the last good runState", async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(statusReplyWith({ state: "running", percent: 10, pause: null }))
      .mockRejectedValueOnce(new Error("14 UNAVAILABLE"))
      .mockResolvedValueOnce(statusReplyWith({ state: "running", percent: 20, pause: null }));
    const monitor = new RunStateMonitor({ lookupTool: () => ({ grpc: { getStatus } }) });

    monitor.start(makeStep());
    await vi.advanceTimersByTimeAsync(0);
    expect(monitor.snapshot()).toMatchObject({
      status: "ok",
      runState: { state: "running", percent: 10 },
    });

    await vi.advanceTimersByTimeAsync(RUN_STATE_POLL_INTERVAL_MS);
    const failedSnapshot: any = monitor.snapshot();
    expect(failedSnapshot.status).toBe("unknown");
    expect(failedSnapshot.runState).toStrictEqual({ state: "running", percent: 10, pause: null });
    expect(failedSnapshot.lastError).toContain("14 UNAVAILABLE");
    expect(typeof failedSnapshot.updatedAt).toBe("number");

    await vi.advanceTimersByTimeAsync(RUN_STATE_POLL_INTERVAL_MS);
    const recoveredSnapshot: any = monitor.snapshot();
    expect(recoveredSnapshot.status).toBe("ok");
    expect(recoveredSnapshot.lastError).toBeUndefined();
    expect(getStatus).toHaveBeenCalledTimes(3);

    monitor.stop();
  });

  it("shows unknown on a malformed payload and keeps the last good runState", async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(statusReplyWith({ state: "running", percent: 10, pause: null }))
      .mockResolvedValueOnce(statusReplyWith("garbage"));
    const monitor = new RunStateMonitor({ lookupTool: () => ({ grpc: { getStatus } }) });

    monitor.start(makeStep());
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(RUN_STATE_POLL_INTERVAL_MS);

    const snapshot: any = monitor.snapshot();
    expect(snapshot.status).toBe("unknown");
    expect(snapshot.runState).toStrictEqual({ state: "running", percent: 10, pause: null });
    expect(snapshot.lastError).toMatch(/not an object/);

    monitor.stop();
  });

  it("shows unknown when the tool is not connected", async () => {
    const monitor = new RunStateMonitor({ lookupTool: () => undefined });

    monitor.start(makeStep());
    await vi.advanceTimersByTimeAsync(0);

    const snapshot: any = monitor.snapshot();
    expect(snapshot.status).toBe("unknown");
    expect(snapshot.lastError).toContain("fast-1");

    monitor.stop();
  });

  it("skips a tick while a poll is in flight", async () => {
    const pending = deferred<any>();
    const getStatus = vi.fn().mockReturnValue(pending.promise);
    const monitor = new RunStateMonitor({ lookupTool: () => ({ grpc: { getStatus } }) });

    monitor.start(makeStep());
    await vi.advanceTimersByTimeAsync(6000);

    expect(getStatus).toHaveBeenCalledTimes(1);
    pending.resolve(statusReplyWith({ state: "running", percent: 1, pause: null }));
    monitor.stop();
  });

  it("discards a result that lands after stop", async () => {
    const deferredA = deferred<any>();
    const deferredB = deferred<any>();
    let calls = 0;
    const getStatus = vi.fn(() => {
      calls += 1;
      return calls === 1 ? deferredA.promise : deferredB.promise;
    });
    const monitor = new RunStateMonitor({ lookupTool: () => ({ grpc: { getStatus } }) });

    const stepA = makeStep({ queueId: 1, runId: "run-a" });
    const stepB = makeStep({ queueId: 2, runId: "run-b" });

    monitor.start(stepA);
    monitor.stop();
    expect(monitor.snapshot()).toStrictEqual({ running: false });

    monitor.start(stepB);
    deferredA.resolve(statusReplyWith({ state: "paused", percent: 0, pause: null }));
    await vi.advanceTimersByTimeAsync(0);

    const pending: any = monitor.snapshot();
    expect(pending.queueId).toBe(2);
    expect(pending.runState).toBeNull();

    deferredB.resolve(statusReplyWith({ state: "running", percent: 5, pause: null }));
    await vi.advanceTimersByTimeAsync(0);

    const resolved: any = monitor.snapshot();
    expect(resolved.queueId).toBe(2);
    expect(resolved.status).toBe("ok");
    expect(resolved.runState).toStrictEqual({ state: "running", percent: 5, pause: null });

    monitor.stop();
  });

  it("a stale poll from a superseded generation does not clear inFlight for a still-outstanding current-generation poll (WR-02)", async () => {
    const deferredA = deferred<any>();
    const deferredB = deferred<any>();
    let calls = 0;
    const getStatus = vi.fn(() => {
      calls += 1;
      return calls === 1 ? deferredA.promise : deferredB.promise;
    });
    const monitor = new RunStateMonitor({ lookupTool: () => ({ grpc: { getStatus } }) });

    const stepA = makeStep({ queueId: 1, runId: "run-a" });
    const stepB = makeStep({ queueId: 2, runId: "run-b" });

    // Poll A (an earlier generation) starts and is left outstanding, as if
    // getStatus were slow to respond.
    monitor.start(stepA);
    expect(getStatus).toHaveBeenCalledTimes(1);

    // start() bumps the generation and immediately issues poll B's own
    // getStatus call, which is also left outstanding.
    monitor.start(stepB);
    expect(getStatus).toHaveBeenCalledTimes(2);

    // Poll A's slow response lands first. Its generation no longer matches
    // the current generation, so _applyUnknown/_applySuccess correctly
    // no-op -- but a buggy unconditional `finally { inFlight = false }`
    // would clear the flag anyway, even though poll B's own call below is
    // still genuinely outstanding.
    deferredA.resolve(statusReplyWith({ state: "paused", percent: 0, pause: null }));
    await vi.advanceTimersByTimeAsync(0);

    // The next scheduled tick for the live generation must NOT fire a
    // second concurrent getStatus call while poll B's own call is still in
    // flight (D-11: at most one call in flight at a time).
    await vi.advanceTimersByTimeAsync(RUN_STATE_POLL_INTERVAL_MS);
    expect(getStatus).toHaveBeenCalledTimes(2);

    // Once poll B's own call actually completes, inFlight correctly clears
    // and the following tick is allowed to issue its own call again.
    deferredB.resolve(statusReplyWith({ state: "running", percent: 5, pause: null }));
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(RUN_STATE_POLL_INTERVAL_MS);
    expect(getStatus).toHaveBeenCalledTimes(3);

    monitor.stop();
  });

  it("does not poll a tool type without runControl", async () => {
    const getStatus = vi.fn();
    const monitor = new RunStateMonitor({ lookupTool: () => ({ grpc: { getStatus } }) });

    monitor.start(makeStep({ toolType: ToolType.pf400 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(getStatus).not.toHaveBeenCalled();
    expect(monitor.snapshot()).toStrictEqual({ running: false });
  });

  it("never calls any tool method other than getStatus", async () => {
    const executeCommand = vi.fn();
    const getStatus = vi
      .fn()
      .mockResolvedValue(statusReplyWith({ state: "running", percent: 1, pause: null }));
    const monitor = new RunStateMonitor({
      lookupTool: () => ({ grpc: { getStatus, executeCommand } }) as any,
    });

    monitor.start(makeStep());
    await vi.advanceTimersByTimeAsync(RUN_STATE_POLL_INTERVAL_MS * 2);

    expect(executeCommand).not.toHaveBeenCalled();
    monitor.stop();
  });
});

describe("runState independence", () => {
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
      statusReplyWith({ state: "paused", percent: 10, pause: null }),
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

  it("a paused run_state does not touch modalState", async () => {
    const capturedMessage = queue.currentMessage;

    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: { toolId: "fast-1", toolType: ToolType.fast, command: "transfer", params: {} },
    } as any);
    loop = queue._start();

    const caller = commandQueueRouter.createCaller({});
    await vi.waitFor(
      async () => {
        const snapshot: any = await caller.runState();
        expect(snapshot.status).toBe("ok");
      },
      { timeout: 5000 },
    );

    expect(queue.isWaitingForInput).toBe(false);
    expect(queue.currentMessage).toStrictEqual(capturedMessage);

    step.resolve(undefined);
    await loop;
  });

  it("a Tool Box pause modal does not touch runState", async () => {
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

    const caller = commandQueueRouter.createCaller({});
    expect(await caller.runState()).toStrictEqual({ running: false });

    queue.resume();
    await loop;
  });

  it("N readers, one poll", async () => {
    await queue.commands.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: { toolId: "fast-1", toolType: ToolType.fast, command: "transfer", params: {} },
    } as any);
    loop = queue._start();

    const caller = commandQueueRouter.createCaller({});
    await vi.waitFor(
      async () => {
        const snapshot: any = await caller.runState();
        expect(snapshot.status).toBe("ok");
      },
      { timeout: 5000 },
    );

    const callsBefore = grpc.getStatus.mock.calls.length;
    for (let i = 0; i < 25; i++) {
      await caller.runState();
    }
    expect(grpc.getStatus.mock.calls.length).toBe(callsBefore);

    step.resolve(undefined);
    await loop;
  });
});
