// Phase 8 lane control (LAN-07, LAN-08) through the real CommandQueue.
// Fakes only: every Tool.executeCommand is a deferred the test resolves and every control call
// lands on a fake gRPC endpoint, so no instrument can move. Ordering is gated on deferreds and
// tick(), never wall time.
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import Tool from "@/server/tools";
import { logAction } from "@/server/logger";
import { recoveryControl } from "@/server/recoveryControl";
import {
  shouldInterceptQueueStop,
  shouldInterceptRunDelete,
} from "@/components/runs/stopInterception";
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

// A run_state the F.A.S.T. reports while it works.
function runningStatus() {
  return {
    uptime: 1,
    status: ToolStatus.BUSY,
    run_state: { state: "running", percent: 40 },
  } as any;
}

describe("the run-state envelope under lanes (LAN-08, Pitfall 13, T-08-21)", () => {
  it("F.A.S.T. on the side lane, STACK starting and ending on primary: the envelope never drops", async () => {
    h = createLaneHarness();
    h.grpcOf("fast-1").getStatus.mockResolvedValue(runningStatus());
    await h.push("r1", [
      fastStep("transfer", { lane: "fast", params: { tag: "FAST" } }),
      stackStep("G1"),
      stackStep("G2"),
    ]);
    h.start();
    await h.tick(4);
    const fastId = h.calls()[indexOfCall(h, "transfer")].queueId!;

    // G1 is in flight on the primary lane beside FAST.
    expect(commandsOf(h)).toContain("G1");
    expect(h.queue.runState).toMatchObject({ running: true, queueId: fastId, toolId: "fast-1" });
    expect(shouldInterceptQueueStop(h.queue.runState)).toBe(true);
    expect(shouldInterceptRunDelete(h.queue.runState, "r1")).toBe(true);
    expect(shouldInterceptRunDelete(h.queue.runState, "r2")).toBe(false);

    // G1 ends, G2 starts and ends: the STACK brackets never touch FAST's poller.
    h.finish(indexOfCall(h, "G1"));
    await h.tick(4);
    expect(commandsOf(h)).toContain("G2");
    expect(h.queue.runState).toMatchObject({ running: true, queueId: fastId });
    h.finish(indexOfCall(h, "G2"));
    await h.tick(4);
    expect(h.queue.runState).toMatchObject({ running: true, queueId: fastId });
    expect(shouldInterceptQueueStop(h.queue.runState)).toBe(true);
    expect(h.grpcOf("fast-1").getStatus).toHaveBeenCalled();

    h.finish(indexOfCall(h, "transfer"));
    await h.tick(4);
    expect(h.queue.runState).toEqual({ running: false });
    expect(shouldInterceptQueueStop(h.queue.runState)).toBe(false);
  });

  it("swapped: F.A.S.T. on primary, STACK on a side lane: the same envelope holds", async () => {
    h = createLaneHarness();
    h.grpcOf("fast-1").getStatus.mockResolvedValue(runningStatus());
    await h.push("r1", [
      fastStep("transfer"),
      stackStep("sA", { lane: "s", params: { tag: "SA" } }),
      stackStep("sB", { lane: "s", params: { tag: "SB" } }),
    ]);
    h.start();
    await h.tick(4);
    const fastId = h.calls()[indexOfCall(h, "transfer")].queueId!;
    expect(commandsOf(h)).toContain("sA");
    expect(h.queue.runState).toMatchObject({ running: true, queueId: fastId });

    h.finish(indexOfCall(h, "sA"));
    await h.tick(4);
    expect(commandsOf(h)).toContain("sB");
    expect(h.queue.runState).toMatchObject({ running: true, queueId: fastId });
    h.finish(indexOfCall(h, "sB"));
    await h.tick(4);
    expect(h.queue.runState).toMatchObject({ running: true, queueId: fastId });
    expect(shouldInterceptRunDelete(h.queue.runState, "r1")).toBe(true);

    h.finish(indexOfCall(h, "transfer"));
    await h.tick(4);
    expect(h.queue.runState).toEqual({ running: false });
  });

  it("a STACK step alone on a side lane leaves the envelope empty and Stop is not intercepted", async () => {
    h = createLaneHarness();
    await h.push("r1", [stackStep("sA", { lane: "s", params: { tag: "SA" } })]);
    h.start();
    await h.tick(4);
    expect(commandsOf(h)).toEqual(["sA"]);
    expect(h.queue.runState).toEqual({ running: false });
    expect(shouldInterceptQueueStop(h.queue.runState)).toBe(false);
    expect(shouldInterceptRunDelete(h.queue.runState, "r1")).toBe(false);
    expect(h.grpcOf("fast-1").getStatus).not.toHaveBeenCalled();
  });

  it("a side-lane F.A.S.T. starts its own poller; it ends with the step", async () => {
    h = createLaneHarness();
    h.grpcOf("fast-1").getStatus.mockResolvedValue(runningStatus());
    await h.push("r1", [
      fastStep("transfer", { lane: "fast", params: { tag: "FAST" } }),
      stackStep("A"),
    ]);
    h.start();
    await h.tick(4);
    const fastId = h.calls()[indexOfCall(h, "transfer")].queueId!;
    expect(h.queue.runState).toMatchObject({ running: true, queueId: fastId });

    h.fail(indexOfCall(h, "transfer"), new Error("tip crash"));
    await h.tick(4);
    expect(h.queue.runState).toEqual({ running: false });
  });
});

describe("abort on the side lane while STACK runs on primary (D-27, LAN-08/concurrency)", () => {
  it("dequeues the F.A.S.T. run's remainder, leaves the STACK step alone and holds run 2's STACK row back", async () => {
    h = createLaneHarness();
    h.replyControl("fast-1");
    await h.push("r1", [
      fastStep("transfer", { lane: "fast", params: { tag: "FAST" } }),
      stackStep("A"),
      stackStep("out1", { barrier: true }),
    ]);
    await h.push("r2", [stackStep("B")]);
    h.start();
    await h.tick(4);
    expect(commandsOf(h).sort()).toEqual(["A", "transfer"]);

    await h.queue.toolControl("abort", { return_liquid: "no" });
    h.fail(indexOfCall(h, "transfer"), new Error("aborted at 40%"));
    await h.tick(6);

    expect(await statusByCommand(h, "transfer")).toBe("FAILED");
    expect(await statusByCommand(h, "out1")).toBe("SKIPPED");
    // The STACK step is still running: nothing aborted it, and run 2's STACK row waits.
    expect(h.calls()[indexOfCall(h, "A")].gate.isSettled()).toBe(false);
    expect(h.grpcOf("stack-1").executeCommand).not.toHaveBeenCalled();
    expect(commandsOf(h)).not.toContain("B");

    h.finish(indexOfCall(h, "A"));
    await h.tick(6);
    expect(await statusByCommand(h, "A")).toBe("COMPLETED");
    // The run is halted by the failure: B is dispatched only after an operator Start.
    expect(commandsOf(h)).not.toContain("B");
  });
});

describe("goto refusal while a side-lane step runs (D-23, T-08-19)", () => {
  it("gotoCommand and gotoCommandByRunIndex refuse and leave every row unchanged", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      fastStep("transfer", { lane: "fast", params: { tag: "FAST" } }),
      stackStep("A"),
      stackStep("out1", { barrier: true }),
    ]);
    h.start();
    await h.tick(4);
    expect(commandsOf(h).sort()).toEqual(["A", "transfer"]);
    const before = (await h.queue.commands.all()).map((r) => [r.queueId, r.status]);
    const fastRowId = h.calls()[indexOfCall(h, "transfer")].queueId!;
    const message =
      "Go to is refused while a lane step is running: it would send that step again. Wait for the lane step to end.";

    await expect(h.queue.gotoCommand(fastRowId)).rejects.toThrow(message);
    await expect(h.queue.gotoCommandByRunIndex("r1", 0)).rejects.toThrow(message);
    expect(logs("Queue Goto Refused")).toHaveLength(2);
    expect(logs("Queue Goto Refused")[0].level).toBe("warning");
    expect((await h.queue.commands.all()).map((r) => [r.queueId, r.status])).toEqual(before);
    // Nothing was sent again.
    await h.tick(4);
    expect(h.calls()).toHaveLength(2);
  });

  it("with no side-lane step running a goto behaves as today", async () => {
    h = createLaneHarness();
    await h.push("r1", [stackStep("A"), stackStep("B")]);
    const rows = await h.queue.commands.all();
    await expect(h.queue.gotoCommand(rows[1].queueId)).resolves.toBe(true);
    await expect(h.queue.gotoCommandByRunIndex("r1", 0)).resolves.toBe(true);
    expect(logs("Queue Goto Refused")).toHaveLength(0);
  });

  it("flag off: a goto is never refused", async () => {
    h = createLaneHarness({ parallelLanes: false });
    await h.push("r1", [stackStep("A"), stackStep("B")]);
    const rows = await h.queue.commands.all();
    await expect(h.queue.gotoCommand(rows[1].queueId)).resolves.toBe(true);
    expect(logs("Queue Goto Refused")).toHaveLength(0);
  });
});

// Source pins: the control path stays one send path, lane-aware and free of state checks.
function readSource(relative: string): string {
  const text = readFileSync(path.join(process.cwd(), relative), "utf8");
  // Line comments are removed so a pin never matches prose.
  return text.replace(/^\s*\/\/.*$/gm, "");
}

function bracedRegion(source: string, startPattern: RegExp): string {
  const match = startPattern.exec(source);
  if (!match) return "";
  const open = source.indexOf("{", source.indexOf(")", match.index));
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return "";
}

describe("lane control source pins (D-11)", () => {
  const queueSrc = readSource("server/command_queue.ts");

  it("toolControl resolves its target with _controlTarget and gates identity with _isRunning", () => {
    const body = bracedRegion(queueSrc, /async toolControl\(/);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain("this._controlTarget()");
    expect(body).toContain("this._isRunning(");
    expect(body).not.toContain("this._runningStep");
  });

  it("command_queue.ts keeps exactly one .controlCommand( send", () => {
    expect(queueSrc.match(/\.controlCommand\(/g)).toHaveLength(1);
  });

  it("_recordAcceptedAbort reads the per-queueId side markers", () => {
    const body = bracedRegion(queueSrc, /private async _recordAcceptedAbort\(/);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain("_sideAbortAccepted");
    expect(body).toContain("_sideFailedAttempts");
  });

  it("both dispatch brackets end the poller with stopIf in lane mode and keep the literal stop with the flag off", () => {
    expect(
      queueSrc.match(/_runStateMonitor\.stopIf\(attempt\.queueId\)/g)?.length,
    ).toBeGreaterThanOrEqual(2);
    expect(queueSrc).toContain("this._runStateMonitor.stop();");
    expect(queueSrc).toContain("this._runStateMonitor.start(this._runningStep);");
  });

  it("both goto mutations refuse first while a side-lane step runs", () => {
    for (const pattern of [/async gotoCommand\(/, /async gotoCommandByRunIndex\(/]) {
      const body = bracedRegion(queueSrc, pattern);
      expect(body.trimStart().slice(1).trimStart()).toMatch(
        /^this\._refuseGotoWhileLaneStepRuns\(/,
      );
    }
  });

  it("routers/tool.ts passes the running step for the tool from any lane", () => {
    const routerSrc = readSource("server/routers/tool.ts");
    expect(routerSrc).toContain("runningStepFor(record.name)");
    expect(routerSrc).not.toMatch(/runningStep:\s*CommandQueue\.global\.runningStep,/);
  });
});
