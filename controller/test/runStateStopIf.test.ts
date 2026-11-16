import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import type { RunningStep } from "@/server/command_queue";
import { RUN_STATE_POLL_INTERVAL_MS, RunStateMonitor } from "@/server/runState";

function statusReplyWith(run_state: unknown): any {
  return { uptime: 1, status: ToolStatus.BUSY, run_state };
}

function makeStep(overrides: Partial<RunningStep> = {}): RunningStep {
  return {
    queueId: 5,
    runId: "run-1",
    toolId: "fast-1",
    toolType: ToolType.fast,
    command: "transfer",
    startedAt: Date.now(),
    ...overrides,
  };
}

describe("RunStateMonitor.stopIf", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeMonitor() {
    const getStatus = vi
      .fn()
      .mockResolvedValue(statusReplyWith({ state: "running", percent: 1, pause: null }));
    const monitor = new RunStateMonitor({ lookupTool: () => ({ grpc: { getStatus } }) });
    return { monitor, getStatus };
  }

  it("leaves a different queueId's poller running and polling", async () => {
    const { monitor, getStatus } = makeMonitor();
    monitor.start(makeStep({ queueId: 5 }));
    expect(getStatus).toHaveBeenCalledTimes(1);

    monitor.stopIf(6);

    expect(monitor.snapshot()).toMatchObject({ running: true, queueId: 5 });
    await vi.advanceTimersByTimeAsync(RUN_STATE_POLL_INTERVAL_MS);
    expect(getStatus).toHaveBeenCalledTimes(2);

    monitor.stop();
  });

  it("stops the poller when the queueId matches", async () => {
    const { monitor, getStatus } = makeMonitor();
    monitor.start(makeStep({ queueId: 5 }));
    expect(getStatus).toHaveBeenCalledTimes(1);

    monitor.stopIf(5);

    expect(monitor.snapshot()).toEqual({ running: false });
    await vi.advanceTimersByTimeAsync(RUN_STATE_POLL_INTERVAL_MS * 2);
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it("is a no-op on a monitor that was never started", () => {
    const { monitor } = makeMonitor();

    expect(() => monitor.stopIf(5)).not.toThrow();
    expect(monitor.snapshot()).toEqual({ running: false });
  });

  it("is a no-op on a monitor that was already stopped", () => {
    const { monitor } = makeMonitor();
    monitor.start(makeStep({ queueId: 5 }));
    monitor.stop();

    expect(() => monitor.stopIf(5)).not.toThrow();
    expect(monitor.snapshot()).toEqual({ running: false });
  });

  it("stays idle for a stack step (no runControl entry) and stopIf of it is a no-op", async () => {
    const { monitor, getStatus } = makeMonitor();
    monitor.start(makeStep({ queueId: 9, toolType: ToolType.stack }));

    expect(monitor.snapshot()).toEqual({ running: false });
    expect(() => monitor.stopIf(9)).not.toThrow();
    expect(monitor.snapshot()).toEqual({ running: false });
    await vi.advanceTimersByTimeAsync(RUN_STATE_POLL_INTERVAL_MS * 2);
    expect(getStatus).not.toHaveBeenCalled();
  });

  it("a stack step's stopIf does not stop the fast poller of another queueId", async () => {
    const { monitor, getStatus } = makeMonitor();
    monitor.start(makeStep({ queueId: 5 }));

    monitor.stopIf(9);

    expect(monitor.snapshot()).toMatchObject({ running: true, queueId: 5 });
    await vi.advanceTimersByTimeAsync(RUN_STATE_POLL_INTERVAL_MS);
    expect(getStatus).toHaveBeenCalledTimes(2);

    monitor.stop();
  });

  it("start() still replaces a running poller for another queueId", () => {
    const { monitor } = makeMonitor();
    monitor.start(makeStep({ queueId: 5 }));
    monitor.start(makeStep({ queueId: 7 }));

    expect(monitor.snapshot()).toMatchObject({ running: true, queueId: 7 });

    monitor.stop();
  });
});
