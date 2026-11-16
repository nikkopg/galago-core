// Phase 8 concurrency lanes through the real CommandQueue (LAN-02, LAN-03, LAN-04).
// Fakes only: every Tool.executeCommand is a deferred the test resolves, so no
// instrument can move. Ordering is gated on deferreds and tick(), never wall time.
import { describe, it, expect, afterEach, vi } from "vitest";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { logAction } from "@/server/logger";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { createLaneHarness, stackStep, fastStep, type LaneHarness } from "./helpers/laneHarness";

let h: LaneHarness | undefined;

afterEach(async () => {
  if (h) await h.teardown();
  h = undefined;
});

function logs(action: string) {
  return vi
    .mocked(logAction)
    .mock.calls.map(([entry]) => entry as { level: string; action: string; details: string })
    .filter((entry) => entry.action === action);
}

// in1, in2 (stack, primary), FAST (fast, lane "fast", barrier), goto-safe (stack, primary),
// out1 (stack, primary, barrier), out2 (stack, primary).
function headlineSteps() {
  return [
    stackStep("in1"),
    stackStep("in2"),
    fastStep("transfer", { lane: "fast", barrier: true, params: { tag: "FAST" } }),
    stackStep("goto-safe"),
    stackStep("out1", { barrier: true }),
    stackStep("out2"),
  ];
}

const commandsOf = (harness: LaneHarness) => harness.calls().map((c) => c.command);

describe("lanes tracer", () => {
  it("headline cycle overlaps FAST with goto-safe", async () => {
    h = createLaneHarness();
    await h.push("r1", headlineSteps());
    const done = h.start();

    await h.tick(3);
    expect(commandsOf(h)).toEqual(["in1"]);
    h.finish(0);
    await h.tick(4);
    expect(commandsOf(h)).toEqual(["in1", "in2"]);
    h.finish(1);
    await h.tick(4);

    // FAST and goto-safe are both in flight while FAST's deferred is still open.
    const names = commandsOf(h);
    expect(names).toHaveLength(4);
    expect(names.slice(2).sort()).toEqual(["goto-safe", "transfer"]);
    const fastIndex = names.indexOf("transfer");
    const gotoIndex = names.indexOf("goto-safe");
    expect(h.calls()[fastIndex].gate.isSettled()).toBe(false);
    expect(h.calls()[gotoIndex].gate.isSettled()).toBe(false);

    // out1 is a barrier: not dispatched until both have ended.
    h.finish(gotoIndex);
    await h.tick(6);
    expect(commandsOf(h)).not.toContain("out1");
    h.finish(fastIndex);
    await h.tick(4);
    expect(commandsOf(h)[4]).toBe("out1");
    h.finish(4);
    await h.tick(4);
    expect(commandsOf(h)[5]).toBe("out2");
    h.finish(5);
    await h.tick(4);
    await done;

    const rows = await h.queue.commands.all();
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.status === "COMPLETED")).toBe(true);
    expect(h.queue.state).toBe(ToolStatus.OFFLINE);
    expect(h.queue.error).toBeUndefined();
    expect(logs("Queue stopped")).toHaveLength(1);
  });
});

// Two tool servers in flight at once: FAST (position 0 barrier, lane "fast") and a stack step.
const twoLaneRun = () => [
  fastStep("transfer", { lane: "fast", barrier: true, params: { tag: "FAST" } }),
  stackStep("A"),
  stackStep("B"),
];

describe("per-lane Start guard (LAN-04)", () => {
  it("two Starts in the same tick log one Queue Started and dispatch every row once", async () => {
    h = createLaneHarness();
    await h.push("r1", headlineSteps());
    const a = h.start();
    const b = h.start();
    expect(logs("Queue Started")).toHaveLength(1);
    expect(logs("Queue Start Ignored")).toHaveLength(1);
    expect(logs("Lane Start Ignored")).toHaveLength(0);

    await h.tick(3);
    h.finish(0);
    await h.tick(4);
    h.finish(1);
    await h.tick(4);
    for (const index of [2, 3]) h.finish(index);
    await h.tick(4);
    h.finish(4);
    await h.tick(4);
    h.finish(5);
    await h.tick(4);
    await Promise.all([a, b]);

    const ids = h.calls().map((c) => c.queueId);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect(logs("Queue Started")).toHaveLength(1);
    const rows = await h.queue.commands.all();
    expect(rows.every((r) => r.status === "COMPLETED")).toBe(true);
  });

  it("restart with the primary step and the FAST step both in flight is not accepted", async () => {
    h = createLaneHarness();
    await h.push("r1", twoLaneRun());
    h.start();
    await h.tick(3);
    expect(commandsOf(h).sort()).toEqual(["A", "transfer"]);

    await expect(commandQueueRouter.createCaller({}).restart()).resolves.toEqual({
      accepted: false,
    });
    await h.tick(3);
    expect(h.calls()).toHaveLength(2);
    const ignored = logs("Queue Start Ignored");
    expect(ignored).toHaveLength(1);
    expect(ignored[0].level).toBe("warning");
    expect(ignored[0].details).toContain(
      "A queue start was ignored because the queue is already running; nothing was dispatched again.",
    );
    expect(ignored[0].details).toContain("source=operator");
    expect(logs("Queue Started")).toHaveLength(1);
    expect(logs("Lane Start Ignored")).toHaveLength(0);
  });

  it("restart with the primary loop alive and lane fast idle with work launches only fast", async () => {
    h = createLaneHarness();
    await h.push("r1", [stackStep("A")]);
    h.start();
    await h.tick(3);
    expect(commandsOf(h)).toEqual(["A"]);
    // Work appears on lane fast while the primary step is in flight.
    await h.push("r1", [fastStep("transfer", { lane: "fast", barrier: true })]);

    await expect(commandQueueRouter.createCaller({}).restart()).resolves.toEqual({
      accepted: true,
    });
    const laneIgnored = logs("Lane Start Ignored");
    expect(laneIgnored).toHaveLength(1);
    expect(laneIgnored[0].details).toContain("lane=primary");
    expect(laneIgnored[0].details).toContain("reason=lane already running");
    expect(logs("Queue Start Ignored")).toHaveLength(0);

    // The barrier row waits for the primary step; nothing was dispatched twice.
    await h.tick(4);
    expect(h.calls()).toHaveLength(1);
    h.finish(0);
    await h.tick(6);
    expect(commandsOf(h)).toEqual(["A", "transfer"]);
  });

  it("an operator Start on an empty queue is accepted and ends OFFLINE", async () => {
    h = createLaneHarness();
    const done = h.start();
    await h.tick(4);
    await done;
    const started = logs("Queue Started");
    expect(started).toHaveLength(1);
    expect(started[0].details).toBe("Command Queue started by user. The queue is empty.");
    expect(logs("Lane Step Dispatched")).toHaveLength(0);
    expect(h.calls()).toHaveLength(0);
    expect(h.queue.state).toBe(ToolStatus.OFFLINE);
    expect(h.queue.isStartInProgress).toBe(false);
  });

  it("a Start while a lane loop is alive does not recover interrupted steps", async () => {
    h = createLaneHarness();
    const spy = vi.spyOn(h.queue.commands, "recoverInterruptedSteps");
    (h.queue as any)._interruptedStepsRecovered = false;
    await h.push("r1", [stackStep("A")]);
    h.start();
    await h.tick(3);
    expect(spy).toHaveBeenCalledTimes(1);

    (h.queue as any)._interruptedStepsRecovered = false;
    await h.push("r1", [fastStep("transfer", { lane: "fast", barrier: true })]);
    h.start();
    await h.tick(2);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(logs("Interrupted Step Failed")).toHaveLength(0);
    expect(h.queue.runningStep).toBeDefined();
  });
});

describe("lane lifecycle (Pitfall 19)", () => {
  it("the primary lane draining while FAST is in flight does not stop the queue", async () => {
    h = createLaneHarness();
    await h.push("r1", twoLaneRun().slice(0, 2));
    const done = h.start();
    await h.tick(3);
    const fastIndex = commandsOf(h).indexOf("transfer");
    const aIndex = commandsOf(h).indexOf("A");
    expect(fastIndex).toBeGreaterThanOrEqual(0);
    expect(aIndex).toBeGreaterThanOrEqual(0);

    h.finish(aIndex);
    await h.tick(10);
    expect(logs("Queue stopped")).toHaveLength(0);
    expect(h.queue.state).toBe(ToolStatus.BUSY);
    expect(h.calls()[fastIndex].gate.isSettled()).toBe(false);

    h.finish(fastIndex);
    await h.tick(6);
    await done;
    expect(logs("Queue stopped")).toHaveLength(1);
    expect(h.queue.state).toBe(ToolStatus.OFFLINE);
    const rows = await h.queue.commands.all();
    expect(rows.every((r) => r.status === "COMPLETED")).toBe(true);
  });

  it("run N+1 waits until run N has drained", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      stackStep("in1"),
      fastStep("transfer", { lane: "fast", barrier: true, params: { tag: "FAST" } }),
    ]);
    await h.push("r2", [stackStep("next")]);
    const done = h.start();
    await h.tick(3);
    h.finish(0);
    await h.tick(6);
    // The primary lane is idle but run r1 still has FAST queued: r2 must not start.
    expect(commandsOf(h)).toEqual(["in1", "transfer"]);
    await h.tick(10);
    expect(commandsOf(h)).toEqual(["in1", "transfer"]);

    h.finish(1);
    await h.tick(6);
    expect(commandsOf(h)).toEqual(["in1", "transfer", "next"]);
    h.finish(2);
    await h.tick(6);
    await done;
    expect((await h.queue.commands.all()).every((r) => r.status === "COMPLETED")).toBe(true);
  });

  it("a tool server stays busy after an accepted abort dequeued its run (D-27)", async () => {
    h = createLaneHarness();
    const [, c] = await h.push("r1", [stackStep("A"), stackStep("C")]);
    await h.push("r2", [stackStep("D", { lane: "b", barrier: true })]);
    h.start();
    await h.tick(3);
    expect(commandsOf(h)).toEqual(["A"]);

    // r1's remainder, including the STARTED row of A, leaves the queue while A still runs.
    await h.queue.commands.failAndDequeueRun(h.queueIdOf(c), new Error("sibling lane failed"));
    expect(h.queue.commands.queuedRowsSync().map((r) => r.runId)).toEqual(["r2"]);
    h.start();
    await h.tick(10);
    expect(commandsOf(h)).toEqual(["A"]);

    h.finish(0);
    await h.tick(8);
    expect(commandsOf(h)).toEqual(["A", "D"]);
  });
});

describe("side-lane failure path (D-10, D-14)", () => {
  it("fails the row, stops new dispatch on every lane and retries on the next Start", async () => {
    const harness = createLaneHarness();
    h = harness;
    const done = h.start();
    await h.push("r1", twoLaneRun());
    await h.tick(3);
    const fastIndex = commandsOf(h).indexOf("transfer");
    const aIndex = commandsOf(h).indexOf("A");
    expect(h.calls()).toHaveLength(2);

    h.fail(fastIndex, new Error("INVALID_ARGUMENTS: bad nest"));
    await h.tick(3);
    expect(h.queue.state).toBe(ToolStatus.FAILED);
    expect(h.queue.error?.message).toContain("bad nest");
    const failedRow = h.queue.commands
      .queuedRowsSync()
      .find((r) => r.queueId === harness.calls()[fastIndex].queueId);
    expect(failedRow?.status).toBe("FAILED");
    const failed = logs("Command Failed");
    expect(failed).toHaveLength(1);
    expect(failed[0].details).toContain("lane=fast");
    expect(failed[0].details).toContain(`queueId=${h.calls()[fastIndex].queueId}`);

    // The primary step in flight is not aborted and still ends COMPLETED.
    expect(h.calls()[aIndex].gate.isSettled()).toBe(false);
    h.finish(aIndex);
    await h.tick(10);
    await done;
    expect(h.calls()).toHaveLength(2);
    expect(h.queue.state).toBe(ToolStatus.FAILED);
    const aRow = (await h.queue.commands.all()).find(
      (r) => r.queueId === harness.calls()[aIndex].queueId,
    );
    expect(aRow?.status).toBe("COMPLETED");

    // An operator Start relaunches and retries the FAILED row.
    h.start();
    await h.tick(4);
    expect(h.queue.error).toBeUndefined();
    const retried = h.calls().filter((c) => c.command === "transfer");
    expect(retried).toHaveLength(2);
    expect(retried[1].queueId).toBe(retried[0].queueId);
  });
});

describe("dispatch audit (Pitfall 23)", () => {
  it("logs one Lane Step Dispatched per row of a lane run, carrying its queueId", async () => {
    h = createLaneHarness();
    await h.push("r1", headlineSteps());
    const done = h.start();
    // Release every open step each round; the barriers still hold the order.
    for (let round = 0; round < 16; round++) {
      await h.tick(3);
      for (const call of h.calls()) {
        if (!call.gate.isSettled()) call.gate.resolve(undefined);
      }
    }
    await done;
    const dispatched = logs("Lane Step Dispatched");
    expect(dispatched).toHaveLength(6);
    for (const call of h.calls()) {
      expect(dispatched.filter((d) => d.details.includes(`queueId=${call.queueId} `))).toHaveLength(
        1,
      );
    }
    const fast = dispatched.find((d) => d.details.includes("toolId=fast-1"));
    expect(fast?.details).toContain("runId=r1");
    expect(fast?.details).toContain("lane=fast");
  });

  it("an untagged run in lane mode logs no Lane Step Dispatched", async () => {
    h = createLaneHarness();
    await h.push("r1", [stackStep("a"), stackStep("b")]);
    const done = h.start();
    await h.tick(3);
    h.finish(0);
    await h.tick(4);
    h.finish(1);
    await h.tick(4);
    await done;
    expect(logs("Lane Step Dispatched")).toHaveLength(0);
    expect(logs("Lane Step Ended")).toHaveLength(0);
    expect(h.queue.state).toBe(ToolStatus.OFFLINE);
  });
});
