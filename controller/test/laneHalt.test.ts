// Phase 8 lane halt (LAN-05, LAN-06, LUI-06) through the real CommandQueue.
// Fakes only: every Tool.executeCommand is a deferred the test resolves, so no instrument
// can move. Ordering is gated on deferreds and tick(), never wall time.
import { describe, it, expect, afterEach, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { logAction } from "@/server/logger";
import { deferred } from "./helpers/fakeTool";
import { createLaneHarness, stackStep, fastStep, type LaneHarness } from "./helpers/laneHarness";

let h: LaneHarness | undefined;
// Gates a test holds open; released before teardown so a failing assertion never hangs it.
const heldGates: Array<{ resolve: (value: void) => void }> = [];

afterEach(async () => {
  for (const gate of heldGates.splice(0)) gate.resolve();
  if (h) {
    // stop() awaits the busy loop, which is parked on an open modal until Continue.
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

// The lane internals Task 1 asserts on directly; the router-level read model comes in Task 2.
const latchOf = (harness: LaneHarness) =>
  (harness.queue as any)._laneHalt as
    | { reason: string; lane?: string; queueId?: number }
    | undefined;
const failureListOf = (harness: LaneHarness) =>
  (harness.queue as any)._laneFailures as Array<{ lane: string; queueId: number; message: string }>;
const overflowOf = (harness: LaneHarness) => (harness.queue as any)._laneFailureOverflow as number;

function toolBoxStep(command: string, extra: Record<string, unknown> = {}) {
  return {
    toolId: "Tool Box",
    toolType: ToolType.toolbox,
    command,
    ...extra,
  };
}

// Holds commands.fail for one queueId until released, so a test can act inside the window
// between a failed step's catch and the moment the queue state turns FAILED.
function holdFail(harness: LaneHarness, queueId: number) {
  const gate = deferred<void>();
  heldGates.push(gate);
  const original = harness.queue.commands.fail.bind(harness.queue.commands);
  vi.spyOn(harness.queue.commands, "fail").mockImplementation(async (id, err) => {
    if (id === queueId) await gate.promise;
    return original(id, err);
  });
  return gate;
}

// F1 on lane fast (barrier, first), A on primary, then a follow-up on each lane.
function twoLaneRows() {
  return [
    fastStep("t1", { lane: "fast", barrier: true, params: { tag: "F1" } }),
    stackStep("A"),
    stackStep("B"),
    fastStep("t2", { lane: "fast", params: { tag: "F2" } }),
  ];
}

describe("halt window (LAN-05, Pitfall 15)", () => {
  it("a primary failure stops new dispatch on the fast lane; the running FAST step still completes", async () => {
    h = createLaneHarness();
    await h.push("r1", twoLaneRows());
    h.start();
    await h.tick(3);
    expect(commandsOf(h).sort()).toEqual(["A", "t1"]);

    h.fail(indexOfCall(h, "A"), new Error("boom primary"));
    await h.tick(3);
    expect(h.queue.state).toBe(ToolStatus.FAILED);
    expect(h.calls()[indexOfCall(h, "t1")].gate.isSettled()).toBe(false);

    h.finish(indexOfCall(h, "t1"));
    await h.tick(10);
    expect(h.calls()).toHaveLength(2);
    const rows = await h.queue.commands.all();
    expect(rows.find((r) => r.queueId === h!.calls()[indexOfCall(h!, "t1")].queueId)?.status).toBe(
      "COMPLETED",
    );
    expect(h.queue.state).toBe(ToolStatus.FAILED);
  });

  it("the same, with the failure delivered while commands.fail is awaiting", async () => {
    h = createLaneHarness();
    await h.push("r1", twoLaneRows());
    h.start();
    await h.tick(3);
    const aId = h.calls()[indexOfCall(h, "A")].queueId!;
    const gate = holdFail(h, aId);

    h.fail(indexOfCall(h, "A"), new Error("boom primary"));
    await h.tick(1);
    // The queue state is still BUSY here: only the latch can close dispatch.
    expect(h.queue.state).toBe(ToolStatus.BUSY);
    expect(latchOf(h)?.reason).toBe("failure");

    h.finish(indexOfCall(h, "t1"));
    await h.tick(8);
    expect(h.calls()).toHaveLength(2);

    gate.resolve();
    await h.tick(4);
    expect(h.calls()).toHaveLength(2);
    expect(h.queue.state).toBe(ToolStatus.FAILED);
  });

  it("a side-lane failure stops the primary lane's next step, with commands.fail awaiting", async () => {
    h = createLaneHarness();
    await h.push("r1", twoLaneRows());
    h.start();
    await h.tick(3);
    const fId = h.calls()[indexOfCall(h, "t1")].queueId!;
    const gate = holdFail(h, fId);

    h.fail(indexOfCall(h, "t1"), new Error("boom fast"));
    await h.tick(1);
    expect(h.queue.state).toBe(ToolStatus.BUSY);
    expect(latchOf(h)).toMatchObject({ reason: "failure", lane: "fast" });

    h.finish(indexOfCall(h, "A"));
    await h.tick(8);
    expect(commandsOf(h).sort()).toEqual(["A", "t1"]);
    gate.resolve();
    await h.tick(4);
    expect(h.calls()).toHaveLength(2);
    expect(h.queue.state).toBe(ToolStatus.FAILED);
  });

  it("a failure of the lane supervisor itself latches before anything else", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      stackStep("A"),
      stackStep("B"),
      fastStep("t2", { lane: "fast", params: { tag: "F2" } }),
    ]);
    const fastId = h.queue.commands
      .queuedRowsSync()
      .find((r) => r.commandInfo.command === "t2")!.queueId;
    const original = h.queue.commands.claimEligible.bind(h.queue.commands);
    vi.spyOn(h.queue.commands, "claimEligible").mockImplementation((id: number) => {
      if (id === fastId) throw new Error("claim exploded");
      return original(id);
    });
    h.start();
    await h.tick(3);

    expect(latchOf(h)).toMatchObject({ reason: "failure", lane: "fast" });
    expect(h.queue.state).toBe(ToolStatus.FAILED);
    expect(h.queue.error?.message).toContain("claim exploded");

    h.finish(indexOfCall(h, "A"));
    await h.tick(8);
    expect(commandsOf(h)).toEqual(["A"]);
  });
});

describe("who clears the latch (D-13, Pitfall 16)", () => {
  // F1 fails while A runs; A then finishes. Leaves the queue FAILED with the latch set.
  async function latchedByFastFailure(harness: LaneHarness) {
    await harness.push("r1", [
      fastStep("t1", { lane: "fast", barrier: true, params: { tag: "F1" } }),
      stackStep("A"),
    ]);
    harness.start();
    await harness.tick(3);
    harness.fail(indexOfCall(harness, "t1"), new Error("boom g-1"));
    await harness.tick(3);
    harness.finish(indexOfCall(harness, "A"));
    await harness.tick(6);
    expect(harness.queue.state).toBe(ToolStatus.FAILED);
    expect(latchOf(harness)?.reason).toBe("failure");
  }

  it("resume with a modal open leaves the latch and the error", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      fastStep("t1", { lane: "fast", barrier: true, params: { tag: "F1" } }),
      stackStep("A"),
      toolBoxStep("pause", { params: { message: "hold on" } }),
      stackStep("B"),
    ]);
    h.start();
    await h.tick(3);
    expect(commandsOf(h).sort()).toEqual(["A", "t1"]);
    h.finish(indexOfCall(h, "A"));
    await h.tick(4);
    expect(h.queue.isWaitingForInput).toBe(true);
    h.fail(indexOfCall(h, "t1"), new Error("boom g-1"));
    await h.tick(3);
    expect(h.queue.state).toBe(ToolStatus.FAILED);

    h.queue.resume();
    expect(h.queue.error?.message).toContain("boom g-1");
    expect(latchOf(h)?.reason).toBe("failure");
    expect(h.queue.state).toBe(ToolStatus.FAILED);
    await h.tick(60);
    expect(commandsOf(h).sort()).toEqual(["A", "t1"]);
  });

  it("clearError turns FAILED into READY but leaves the latch", async () => {
    h = createLaneHarness();
    await latchedByFastFailure(h);
    await h.queue.clearError();
    expect(h.queue.state).toBe(ToolStatus.READY);
    expect(h.queue.error).toBeUndefined();
    expect(latchOf(h)?.reason).toBe("failure");
  });

  it("the enqueueRun auto-start launches nothing while latched", async () => {
    h = createLaneHarness();
    await latchedByFastFailure(h);
    await h.queue.clearError();
    const before = h.calls().length;

    await h.queue.enqueueRun({
      id: "r2",
      protocolName: "p",
      commands: [
        {
          runId: "r2",
          status: "CREATED",
          commandInfo: {
            toolId: "stack-1",
            toolType: ToolType.stack,
            command: "x",
            params: { tag: "r2-x" },
          },
        },
      ],
    } as any);
    await h.tick(6);
    expect(h.calls()).toHaveLength(before);
    expect(h.queue.state).toBe(ToolStatus.READY);
    const ignored = logs("Queue Start Ignored");
    expect(ignored).toHaveLength(1);
    expect(ignored[0].level).toBe("warning");
    expect(ignored[0].details).toContain("source=enqueue");
    expect(ignored[0].details).toContain("halted=true");
    expect(latchOf(h)?.reason).toBe("failure");
  });

  it("clearAll leaves the latch", async () => {
    h = createLaneHarness();
    await latchedByFastFailure(h);
    await h.queue.clearAll();
    expect(latchOf(h)?.reason).toBe("failure");
  });

  it("an operator Start while every lane is busy changes nothing", async () => {
    h = createLaneHarness();
    await h.push("r1", [stackStep("A"), stackStep("B")]);
    h.start();
    await h.tick(3);
    const aId = h.calls()[0].queueId!;
    const gate = holdFail(h, aId);
    h.fail(0, new Error("boom g-1"));
    await h.tick(1);
    expect(latchOf(h)?.reason).toBe("failure");

    h.start();
    await h.tick(1);
    const ignored = logs("Queue Start Ignored");
    expect(ignored).toHaveLength(1);
    expect(ignored[0].details).toContain("source=operator");
    expect(latchOf(h)?.reason).toBe("failure");
    expect(h.calls()).toHaveLength(1);

    gate.resolve();
    await h.tick(4);
    expect(h.queue.state).toBe(ToolStatus.FAILED);
    expect(h.queue.error?.message).toContain("boom g-1");
    expect(failureListOf(h)).toHaveLength(1);
    expect(latchOf(h)?.reason).toBe("failure");
    expect(h.calls()).toHaveLength(1);
  });

  it("an accepted operator Start clears the latch and the failure list and retries the FAILED row first", async () => {
    h = createLaneHarness();
    await latchedByFastFailure(h);
    expect(failureListOf(h)).toHaveLength(1);

    h.start();
    await h.tick(4);
    expect(latchOf(h)).toBeUndefined();
    expect(failureListOf(h)).toHaveLength(0);
    expect(overflowOf(h)).toBe(0);
    expect(h.queue.error).toBeUndefined();
    const retried = h.calls().filter((c) => c.command === "t1");
    expect(retried).toHaveLength(2);
    expect(retried[1].queueId).toBe(retried[0].queueId);
  });

  it("Edge LAN-05/empty: a failure with no other lane work latches; Start clears it on an empty queue", async () => {
    h = createLaneHarness();
    await h.push("r1", [stackStep("A")]);
    h.start();
    await h.tick(3);
    h.fail(0, new Error("boom alone"));
    await h.tick(4);
    expect(h.queue.state).toBe(ToolStatus.FAILED);
    expect(latchOf(h)?.reason).toBe("failure");

    await h.queue.clearAll();
    expect(latchOf(h)?.reason).toBe("failure");
    h.start();
    await h.tick(4);
    expect(latchOf(h)).toBeUndefined();
    expect(h.calls()).toHaveLength(1);
  });
});

describe("the first failure is kept (D-16, LUI-06)", () => {
  it.each([
    { firstFails: "A", secondFails: "t1", firstLane: "primary", secondLane: "fast" },
    { firstFails: "t1", secondFails: "A", firstLane: "fast", secondLane: "primary" },
  ])(
    "$firstFails fails, then $secondFails fails: the first is the banner, the list keeps time order",
    async ({ firstFails, secondFails, firstLane, secondLane }) => {
      h = createLaneHarness();
      await h.push("r1", [
        fastStep("t1", { lane: "fast", barrier: true, params: { tag: "F1" } }),
        stackStep("A"),
      ]);
      h.start();
      await h.tick(3);
      const seqBefore = h.queue.failureSeq;

      h.fail(indexOfCall(h, firstFails), new Error("boom g-1"));
      await h.tick(3);
      h.fail(indexOfCall(h, secondFails), new Error("boom g-2"));
      await h.tick(3);

      expect(h.queue.getError()?.message).toContain("g-1");
      expect(h.queue.failureSeq).toBe(seqBefore + 2);
      const list = failureListOf(h);
      expect(list.map((f) => f.lane)).toEqual([firstLane, secondLane]);
      expect(list.map((f) => f.message)).toEqual(["boom g-1", "boom g-2"]);
      expect(list[0].queueId).toBe(h.calls()[indexOfCall(h, firstFails)].queueId);
      expect(list[1].queueId).toBe(h.calls()[indexOfCall(h, secondFails)].queueId);

      const extra = logs("Lane Halt Additional Failure");
      expect(extra).toHaveLength(1);
      expect(extra[0].level).toBe("warning");
      expect(extra[0].details).toContain(`firstLane=${firstLane}`);
      expect(extra[0].details).toContain(`lane=${secondLane}`);
    },
  );

  it("Edge LUI-06/adjacency: the 8th failure is listed with overflow 0; the 9th is counted only", async () => {
    h = createLaneHarness();
    const record = (n: number) =>
      (h!.queue as any)._recordFailure(new Error(`boom ${n}`), {
        lane: n % 2 === 0 ? "fast" : "primary",
        queueId: n,
        toolId: "stack-1",
        toolType: ToolType.stack,
      });
    for (let n = 1; n <= 8; n++) record(n);
    expect(failureListOf(h)).toHaveLength(8);
    expect(overflowOf(h)).toBe(0);
    record(9);
    expect(failureListOf(h)).toHaveLength(8);
    expect(overflowOf(h)).toBe(1);
    expect(h.queue.getError()?.message).toBe("boom 1");
  });

  it("with the flag off the list stays empty and a later failure overwrites, exactly as today", async () => {
    h = createLaneHarness({ parallelLanes: false });
    const record = (n: number) => (h!.queue as any)._recordFailure(new Error(`boom ${n}`));
    record(1);
    record(2);
    expect(h.queue.getError()?.message).toBe("boom 2");
    expect(failureListOf(h)).toHaveLength(0);
    expect(latchOf(h)).toBeUndefined();
    expect(logs("Lane Halt Additional Failure")).toHaveLength(0);
  });
});

describe("the primary modal gate (D-14, LAN-06)", () => {
  it("no FAST dispatch while the pause modal is open; FAST dispatches after Continue", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      toolBoxStep("pause", { params: { message: "check the deck" } }),
      fastStep("t1", { lane: "fast", barrier: true, params: { tag: "F1" } }),
      stackStep("A"),
    ]);
    h.start();
    await h.tick(20);
    expect(h.queue.isWaitingForInput).toBe(true);
    expect(h.calls()).toHaveLength(0);

    h.queue.resume();
    await h.tick(60);
    expect(commandsOf(h)).toContain("t1");
    expect(commandsOf(h)).toContain("A");
    // Continue never latched anything, and the queue order is kept.
    expect(latchOf(h)).toBeUndefined();
  });

  it("Edge LAN-06/adjacency: a worker waking right after the Tool Box row's claim dispatches nothing", async () => {
    h = createLaneHarness({ loopDelayMs: 1 });
    const [pauseTag] = await h.push("r1", [
      toolBoxStep("pause", { params: { message: "check the deck" } }),
      fastStep("t1", { lane: "fast", params: { tag: "F1" } }),
    ]);
    const pauseId = h.queueIdOf(pauseTag);
    const release = deferred<void>();
    heldGates.push(release);
    const original = h.queue.commands.complete.bind(h.queue.commands);
    vi.spyOn(h.queue.commands, "complete").mockImplementation(async (id) => {
      if (id === pauseId) await release.promise;
      return original(id);
    });

    h.start();
    await h.tick(6);
    // The pause row is claimed (STARTED) but the modal flag is not set yet.
    expect(h.queue.isWaitingForInput).toBe(false);
    const claimed = h.queue.commands.queuedRowsSync().find((r) => r.queueId === pauseId);
    expect(claimed?.status).toBe("STARTED");
    expect(h.calls()).toHaveLength(0);

    release.resolve();
    await h.tick(6);
    expect(h.queue.isWaitingForInput).toBe(true);
    expect(h.calls()).toHaveLength(0);

    h.queue.resume();
    await h.tick(60);
    expect(commandsOf(h)).toEqual(["t1"]);
  });

  it("Edge LAN-06/empty: a modal with no side work adds no lane log and changes no row", async () => {
    h = createLaneHarness();
    await h.push("r1", [toolBoxStep("pause", { params: { message: "hold" } }), stackStep("A")]);
    h.start();
    await h.tick(10);
    expect(h.queue.isWaitingForInput).toBe(true);
    for (const action of [
      "Lane Step Dispatched",
      "Lane Step Ended",
      "Lane Start Ignored",
      "Lane Halt Additional Failure",
      "Lanes Frozen",
    ]) {
      expect(logs(action), action).toHaveLength(0);
    }
    const rows = h.queue.commands.queuedRowsSync();
    expect(rows.map((r) => [r.commandInfo.command, r.status])).toEqual([["A", "CREATED"]]);
    expect(h.calls()).toHaveLength(0);
  });

  it("Edge LAN-06/ordering: after Continue the side lane resumes in queue order", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      toolBoxStep("pause", { params: { message: "hold" } }),
      fastStep("t1", { lane: "fast", barrier: true, params: { tag: "F1" } }),
      fastStep("t2", { lane: "fast", params: { tag: "F2" } }),
    ]);
    h.start();
    await h.tick(5);
    expect(h.queue.isWaitingForInput).toBe(true);
    h.queue.resume();
    await h.tick(8);
    expect(commandsOf(h)).toEqual(["t1"]);
    h.finish(0);
    await h.tick(6);
    expect(commandsOf(h)).toEqual(["t1", "t2"]);
  });

  it("a Tool Box row stored with lane fast runs on the primary lane and launches no fast worker", async () => {
    h = createLaneHarness();
    await h.push("r1", [toolBoxStep("note", { lane: "fast", params: { message: "n" } })]);
    const done = h.start();
    await h.tick(1);
    expect((h.queue as any)._laneLoops.has("fast")).toBe(false);
    await h.tick(4);
    await done;
    expect(h.calls()).toHaveLength(0);
    expect((await h.queue.commands.all()).map((r) => r.status)).toEqual(["COMPLETED"]);
    expect(logs("Lane Start Ignored")).toHaveLength(0);
  });
});
