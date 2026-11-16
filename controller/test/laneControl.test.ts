// Phase 8 lane control (LAN-07, LAN-08) through the real CommandQueue.
// Fakes only: every Tool.executeCommand is a deferred the test resolves and every control call
// lands on a fake gRPC endpoint, so no instrument can move. Ordering is gated on deferreds and
// tick(), never wall time.
import { describe, it, expect, afterEach, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import Tool from "@/server/tools";
import { logAction } from "@/server/logger";
import { recoveryControl } from "@/server/recoveryControl";
import { deferred } from "./helpers/fakeTool";
import { createLaneHarness, stackStep, fastStep, type LaneHarness } from "./helpers/laneHarness";

let h: LaneHarness | undefined;
// Gates a test holds open; released before teardown so a failing assertion never hangs it.
const heldGates: Array<{ resolve: (value: any) => void }> = [];

afterEach(async () => {
  for (const gate of heldGates.splice(0)) gate.resolve(undefined);
  if (h) {
    h.queue.resume();
    await h.teardown();
  }
  h = undefined;
});

function logs(action: string) {
  return vi
    .mocked(logAction)
    .mock.calls.map(([entry]) => entry as { level: string; action: string; details: string })
    .filter((entry) => entry.action === action);
}

const commandsOf = (harness: LaneHarness) => harness.calls().map((c) => c.command);
const indexOfCall = (harness: LaneHarness, command: string) => commandsOf(harness).indexOf(command);

async function statusByCommand(harness: LaneHarness, command: string) {
  const rows = await harness.queue.commands.all();
  return rows.find((r) => r.commandInfo.command === command)?.status;
}

// The headline cycle's shape: FAST on lane "fast" with goto-safe on the primary lane, then a
// barrier out1 and out2 that only run once both lanes have drained.
function fastSideRun() {
  return [
    fastStep("transfer", { lane: "fast", params: { tag: "FAST" } }),
    stackStep("pre"),
    stackStep("goto-safe"),
    stackStep("out1", { barrier: true }),
    stackStep("out2"),
  ];
}

describe("control target under lanes (LAN-07, D-11)", () => {
  it("Pause, Resume and Abort reach the F.A.S.T. on the side lane while STACK runs on the primary lane", async () => {
    h = createLaneHarness();
    h.replyControl("fast-1");
    h.replyControl("stack-1");
    await h.push("r1", [
      fastStep("transfer", { lane: "fast", params: { tag: "FAST" } }),
      stackStep("goto-safe"),
    ]);
    h.start();
    await h.tick(4);
    expect(commandsOf(h).sort()).toEqual(["goto-safe", "transfer"]);

    const pause = await h.queue.toolControl("pause");
    expect(pause).toMatchObject({ ok: true, response: ResponseCode.SUCCESS });
    expect(h.grpcOf("fast-1").executeCommand).toHaveBeenCalledTimes(1);
    expect(h.grpcOf("fast-1").executeCommand).toHaveBeenLastCalledWith({ fast: { pause: {} } });

    await h.queue.toolControl("resume", { is_tip_broken: "no" });
    expect(h.grpcOf("fast-1").executeCommand).toHaveBeenLastCalledWith({
      fast: { resume: { is_tip_broken: "no" } },
    });

    await h.queue.toolControl("abort", { return_liquid: "no" });
    expect(h.grpcOf("fast-1").executeCommand).toHaveBeenLastCalledWith({
      fast: { abort: { return_liquid: "no" } },
    });
    expect(h.grpcOf("fast-1").executeCommand).toHaveBeenCalledTimes(3);
    // The STACK step on the primary lane was never addressed.
    expect(h.grpcOf("stack-1").executeCommand).not.toHaveBeenCalled();
  });

  it("with only a STACK step running on the primary lane Pause keeps the unchanged refusal", async () => {
    h = createLaneHarness();
    await h.push("r1", [stackStep("A")]);
    h.start();
    await h.tick(3);
    expect(commandsOf(h)).toEqual(["A"]);

    await expect(h.queue.toolControl("pause")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: 'Tool type "stack" does not support live run control.',
    });
    expect(h.grpcOf("stack-1").executeCommand).not.toHaveBeenCalled();
  });

  it("with only a STACK step running on a side lane Pause keeps the unchanged refusal", async () => {
    h = createLaneHarness();
    await h.push("r1", [stackStep("A"), stackStep("B", { lane: "s", params: { tag: "SB" } })]);
    h.start();
    await h.tick(4);
    // A and B are both STACK steps: one tool server, so only one runs at a time.
    expect(h.calls()).toHaveLength(1);
    await expect(h.queue.toolControl("pause")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: 'Tool type "stack" does not support live run control.',
    });
    expect(h.grpcOf("stack-1").executeCommand).not.toHaveBeenCalled();
  });

  it("with nothing running the unchanged 'No step is currently running' refusal stands", async () => {
    h = createLaneHarness();
    await expect(h.queue.toolControl("pause")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "No step is currently running.",
    });
  });

  it("a side-lane step replaced between validation and the send is refused (identity gate)", async () => {
    h = createLaneHarness();
    h.replyControl("fast-1");
    await h.push("r1", [
      fastStep("transfer", { lane: "fast", params: { tag: "FAST" } }),
      stackStep("A"),
    ]);
    h.start();
    await h.tick(4);
    expect(commandsOf(h).sort()).toEqual(["A", "transfer"]);

    // Tool.lookup is the last synchronous call before the identity re-check: swap the side
    // lane's step for a newer snapshot there, as if the lane had moved on mid-request.
    const originalLookup = Tool.lookup.bind(Tool);
    vi.spyOn(Tool, "lookup").mockImplementationOnce((toolId) => {
      const side = (h!.queue as any)._sideRunning as Map<string, any>;
      for (const [lane, step] of side) {
        side.set(lane, Object.freeze({ ...step, startedAt: step.startedAt + 1 }));
      }
      return originalLookup(toolId);
    });

    await expect(h.queue.toolControl("pause")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "The targeted step is no longer running.",
    });
    expect(h.grpcOf("fast-1").executeCommand).not.toHaveBeenCalled();
  });
});

describe("accepted abort survives another lane's dispatch (Pitfall 12, LAN-08)", () => {
  it("order 1: F.A.S.T. on the side lane, STACK on primary: the run remainder is dequeued, not retried", async () => {
    h = createLaneHarness();
    h.replyControl("fast-1");
    await h.push("r1", fastSideRun());
    h.start();
    await h.tick(4);
    expect(commandsOf(h).sort()).toEqual(["pre", "transfer"]);

    await h.queue.toolControl("abort", { return_liquid: "no" });
    expect(h.grpcOf("fast-1").executeCommand).toHaveBeenCalledTimes(1);

    // The primary lane dispatches and completes goto-safe after the abort was accepted.
    h.finish(indexOfCall(h, "pre"));
    await h.tick(4);
    expect(commandsOf(h)).toContain("goto-safe");
    h.finish(indexOfCall(h, "goto-safe"));
    await h.tick(4);

    // FAST now ends with an error: its marker was never reset by the primary dispatches.
    h.fail(indexOfCall(h, "transfer"), new Error("aborted at 40%"));
    await h.tick(6);

    expect(await statusByCommand(h, "transfer")).toBe("FAILED");
    expect(await statusByCommand(h, "out1")).toBe("SKIPPED");
    expect(await statusByCommand(h, "out2")).toBe("SKIPPED");
    expect(h.queue.commands.queuedRowsSync().filter((r) => r.runId === "r1")).toEqual([]);
    expect(logs("Aborted Run Dequeued")).toHaveLength(1);
    expect(h.queue.state).toBe(ToolStatus.FAILED);

    // An operator Start re-runs nothing of that run.
    const before = h.calls().length;
    h.start("operator");
    await h.tick(6);
    expect(h.calls()).toHaveLength(before);
  });

  it("order 2: F.A.S.T. on the primary lane, STACK on a side lane: same outcome", async () => {
    h = createLaneHarness();
    h.replyControl("fast-1");
    await h.push("r1", [
      fastStep("transfer"),
      stackStep("sA", { lane: "s", params: { tag: "SA" } }),
      stackStep("sB", { lane: "s", params: { tag: "SB" } }),
      stackStep("out1", { barrier: true }),
      stackStep("out2"),
    ]);
    h.start();
    await h.tick(4);
    expect(commandsOf(h).sort()).toEqual(["sA", "transfer"]);

    await h.queue.toolControl("abort", { return_liquid: "no" });
    expect(h.grpcOf("fast-1").executeCommand).toHaveBeenCalledTimes(1);
    expect(h.grpcOf("stack-1").executeCommand).not.toHaveBeenCalled();

    // The side lane dispatches its next STACK step after the abort was accepted.
    h.finish(indexOfCall(h, "sA"));
    await h.tick(4);
    expect(commandsOf(h)).toContain("sB");
    h.finish(indexOfCall(h, "sB"));
    await h.tick(4);

    h.fail(indexOfCall(h, "transfer"), new Error("aborted at 40%"));
    await h.tick(6);

    expect(await statusByCommand(h, "transfer")).toBe("FAILED");
    expect(await statusByCommand(h, "out1")).toBe("SKIPPED");
    expect(await statusByCommand(h, "out2")).toBe("SKIPPED");
    expect(logs("Aborted Run Dequeued")).toHaveLength(1);
    const before = h.calls().length;
    h.start("operator");
    await h.tick(6);
    expect(h.calls()).toHaveLength(before);
  });
});

describe("late abort replies on a side lane (T-01-08 layer b, Edge LAN-08/idempotency)", () => {
  it("a late reply for a side-lane step that already failed dequeues its run once; a second logs Skipped", async () => {
    h = createLaneHarness();
    const firstReply = deferred<unknown>();
    const secondReply = deferred<unknown>();
    heldGates.push(firstReply, secondReply);
    let sent = 0;
    h.grpcOf("fast-1").executeCommand.mockImplementation(async () => {
      sent += 1;
      await (sent === 1 ? firstReply : secondReply).promise;
      return { response: ResponseCode.SUCCESS, return_reply: true };
    });
    await h.push("r1", fastSideRun());
    h.start();
    await h.tick(4);
    expect(commandsOf(h).sort()).toEqual(["pre", "transfer"]);

    // Two abort calls are in flight while the step is still running; neither is answered yet.
    const abortA = h.queue.toolControl("abort", { return_liquid: "no" });
    const abortB = h.queue.toolControl("abort", { return_liquid: "no" });
    await h.tick(2);
    expect(sent).toBe(2);

    // The step fails on its own first (no accepted-abort marker is set).
    h.fail(indexOfCall(h, "transfer"), new Error("tip crash"));
    await h.tick(6);
    expect(await statusByCommand(h, "transfer")).toBe("FAILED");
    expect(await statusByCommand(h, "out1")).toBe("CREATED");

    // The late replies land now: the first dequeues the run, the second is skipped.
    firstReply.resolve(undefined);
    await abortA;
    expect(await statusByCommand(h, "out1")).toBe("SKIPPED");
    expect(logs("Aborted Run Dequeued")).toHaveLength(1);
    expect(logs("Aborted Run Dequeue Skipped")).toHaveLength(0);

    secondReply.resolve(undefined);
    await abortB;
    expect(logs("Aborted Run Dequeue Skipped")).toHaveLength(1);
    expect(logs("Aborted Run Dequeued")).toHaveLength(1);
  });
});

describe("runningStepFor and the STACK acknowledge (T-08-20, D-11)", () => {
  async function acknowledgeStack(harness: LaneHarness) {
    const controlCommand = vi.fn();
    const attempt = recoveryControl({
      toolName: "stack-1",
      toolType: "stack",
      tool: { controlCommand } as any,
      runningStep: harness.queue.runningStepFor("stack-1"),
      action: "acknowledge_failure",
      params: { guid: "guid-a", arm_inspected: "yes" },
    });
    return { attempt, controlCommand };
  }

  it("returns the side-lane STACK step while it runs and the acknowledge is refused", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      fastStep("transfer", { params: { tag: "FAST" } }),
      stackStep("sA", { lane: "s", params: { tag: "SA" } }),
    ]);
    h.start();
    await h.tick(4);
    expect(commandsOf(h).sort()).toEqual(["sA", "transfer"]);

    const step = h.queue.runningStepFor("STACK-1");
    expect(step?.command).toBe("sA");
    expect(h.queue.runningStepFor("fast-1")?.command).toBe("transfer");
    expect(h.queue.runningStepFor("pf400-1")).toBeUndefined();

    const { attempt, controlCommand } = await acknowledgeStack(h);
    await expect(attempt).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "A run step is running on this tool; acknowledge after it ends.",
    });
    expect(controlCommand).not.toHaveBeenCalled();
  });

  it("returns undefined when no STACK step runs, so the acknowledge is not refused by the queue", async () => {
    h = createLaneHarness();
    await h.push("r1", [fastStep("transfer", { params: { tag: "FAST" } })]);
    h.start();
    await h.tick(3);
    expect(commandsOf(h)).toEqual(["transfer"]);
    expect(h.queue.runningStepFor("stack-1")).toBeUndefined();
  });

  it("flag off: returns the running step for its own tool and undefined otherwise", async () => {
    h = createLaneHarness({ parallelLanes: false });
    await h.push("r1", [stackStep("A")]);
    h.start();
    await h.tick(3);
    expect(commandsOf(h)).toEqual(["A"]);
    expect(h.queue.runningStepFor("STACK-1")).toBe(h.queue.runningStep);
    expect(h.queue.runningStepFor("fast-1")).toBeUndefined();
  });
});
