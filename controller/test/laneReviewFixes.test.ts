// Phase 8 code-review fixes WR-02 and WR-06 through the real CommandQueue.
// Fakes only: every Tool.executeCommand is a deferred the test resolves and every control call
// lands on a fake gRPC endpoint, so no instrument can move.
import { describe, it, expect, afterEach, vi } from "vitest";
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { logAction } from "@/server/logger";
import { deferred } from "./helpers/fakeTool";
import { createLaneHarness, stackStep, fastStep, type LaneHarness } from "./helpers/laneHarness";

let h: LaneHarness | undefined;
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

function fastSideRun() {
  return [
    fastStep("transfer", { lane: "fast", params: { tag: "FAST" } }),
    stackStep("pre"),
    stackStep("goto-safe"),
    stackStep("out1", { barrier: true }),
    stackStep("out2"),
  ];
}

describe("WR-02: no claimed row is left STARTED without an owner", () => {
  it("a side-lane monitor start that throws fails the claimed row instead of stranding it", async () => {
    h = createLaneHarness();
    const monitor = (h.queue as any)._runStateMonitor;
    vi.spyOn(monitor, "start").mockImplementation(() => {
      throw new Error("monitor boom");
    });
    await h.push("r1", fastSideRun());
    h.start();
    await h.tick(6);

    // The F.A.S.T. step was never sent, and its row is FAILED (retryable by an operator
    // Start), not STARTED with no owner.
    expect(commandsOf(h)).not.toContain("transfer");
    expect(await statusByCommand(h, "transfer")).toBe("FAILED");
    expect(h.queue.laneStatus().halted).toBe(true);
  });

  it("a worker reconcile that throws in the primary loop happens before any claim", async () => {
    h = createLaneHarness();
    await h.push("r1", fastSideRun());
    h.start();
    await h.tick(4);
    expect(commandsOf(h).sort()).toEqual(["pre", "transfer"]);

    // Arm the throw only now, after _startLanes' own reconcile, so it hits the primary loop.
    let armed = true;
    const original = (h.queue as any)._ensureLaneWorkers.bind(h.queue);
    vi.spyOn(h.queue as any, "_ensureLaneWorkers").mockImplementation(() => {
      if (armed) {
        armed = false;
        throw new Error("reconcile boom");
      }
      return original();
    });
    h.finish(indexOfCall(h, "pre"));
    await h.tick(6);

    // goto-safe was not claimed by the iteration that threw, so it is not stranded STARTED.
    expect(await statusByCommand(h, "goto-safe")).not.toBe("STARTED");
    expect(commandsOf(h)).not.toContain("goto-safe");
    // The F.A.S.T. step on the side lane is untouched and still running.
    expect(await statusByCommand(h, "transfer")).toBe("STARTED");
    expect(h.queue.laneStatus().halted).toBe(true);
  });
});

describe("WR-06: an operator goto supersedes a pending late abort reply for a failed side step", () => {
  it("gotoCommandByRunIndex after a side-lane failure: the late reply does not dequeue the re-queued rows", async () => {
    h = createLaneHarness();
    const reply = deferred<unknown>();
    heldGates.push(reply);
    h.grpcOf("fast-1").executeCommand.mockImplementation(async () => {
      await reply.promise;
      return { response: ResponseCode.SUCCESS, return_reply: true };
    });
    await h.push("r1", fastSideRun());
    h.start();
    await h.tick(4);

    const abort = h.queue.toolControl("abort", { return_liquid: "no" });
    await h.tick(2);
    h.fail(indexOfCall(h, "transfer"), new Error("tip crash"));
    await h.tick(6);
    expect(await statusByCommand(h, "transfer")).toBe("FAILED");

    // Let the primary step finish so no side step is running, then the operator re-queues.
    h.finish(indexOfCall(h, "pre"));
    await h.tick(4);
    await expect(h.queue.gotoCommandByRunIndex("r1", 3)).resolves.toBe(true);

    reply.resolve(undefined);
    await abort;
    expect(logs("Aborted Run Dequeued")).toHaveLength(0);
    expect(logs("Aborted Run Dequeue Skipped")).toHaveLength(1);
    expect(await statusByCommand(h, "out1")).not.toBe("SKIPPED");
  });

  it("gotoCommand after a side-lane failure: the late reply does not dequeue the re-queued rows", async () => {
    h = createLaneHarness();
    const reply = deferred<unknown>();
    heldGates.push(reply);
    h.grpcOf("fast-1").executeCommand.mockImplementation(async () => {
      await reply.promise;
      return { response: ResponseCode.SUCCESS, return_reply: true };
    });
    await h.push("r1", fastSideRun());
    h.start();
    await h.tick(4);

    const abort = h.queue.toolControl("abort", { return_liquid: "no" });
    await h.tick(2);
    h.fail(indexOfCall(h, "transfer"), new Error("tip crash"));
    await h.tick(6);
    h.finish(indexOfCall(h, "pre"));
    await h.tick(4);

    const out1 = (await h.queue.commands.all()).find((r) => r.commandInfo.command === "out1")!;
    await expect(h.queue.gotoCommand(out1.queueId)).resolves.toBe(true);

    reply.resolve(undefined);
    await abort;
    expect(logs("Aborted Run Dequeued")).toHaveLength(0);
    expect(logs("Aborted Run Dequeue Skipped")).toHaveLength(1);
    expect(await statusByCommand(h, "out1")).not.toBe("SKIPPED");
  });
});
