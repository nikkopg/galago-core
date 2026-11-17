// Phase 9 D-09: exactly one tool send per queueId under lanes. Fakes only (the harness spies
// Tool.executeCommand); no tool server is contacted.
import { describe, it, expect, afterEach } from "vitest";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { createLaneHarness, stackStep, fastStep, type LaneHarness } from "./helpers/laneHarness";

let h: LaneHarness | undefined;

afterEach(async () => {
  if (h) await h.teardown();
  h = undefined;
});

function sendsByQueueId(harness: LaneHarness): Map<number, number> {
  const tally = new Map<number, number>();
  for (const call of harness.calls()) {
    expect(call.queueId, `call ${call.command} has no queueId`).toBeDefined();
    tally.set(call.queueId!, (tally.get(call.queueId!) ?? 0) + 1);
  }
  return tally;
}

async function releaseAll(harness: LaneHarness, rounds = 20) {
  for (let i = 0; i < rounds; i++) {
    await harness.tick(3);
    for (const call of harness.calls()) {
      if (!call.gate.isSettled()) call.gate.resolve(undefined);
    }
  }
}

describe("one send per queueId under lanes (D-09)", () => {
  it("overlap run plus run N+1: every row is sent exactly once", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      stackStep("in1"),
      stackStep("in2"),
      fastStep("transfer", { lane: "fast", barrier: true, params: { tag: "FAST" } }),
      stackStep("x1"),
      stackStep("out1", { barrier: true }),
      stackStep("out2"),
      stackStep("x2"),
    ]);
    await h.push("r2", [stackStep("n1"), stackStep("n2")]);
    const done = h.start();
    await releaseAll(h);
    await done;
    const tally = sendsByQueueId(h);
    expect(h.calls()).toHaveLength(9);
    expect(tally.size).toBe(9);
    expect([...tally.values()].every((n) => n === 1)).toBe(true);
    expect((await h.queue.commands.all()).every((r) => r.status === "COMPLETED")).toBe(true);
    expect(h.queue.state).toBe(ToolStatus.OFFLINE);
  });

  it("halt, refused auto-start, operator Start and a second Start: only the failed row is sent twice", async () => {
    h = createLaneHarness();
    await h.push("r1", [
      fastStep("t1", { lane: "fast", barrier: true, params: { tag: "F1" } }),
      stackStep("A"),
      stackStep("B"),
      fastStep("t2", { lane: "fast", params: { tag: "F2" } }),
    ]);
    await h.push("r2", [stackStep("n1")]);
    h.start();
    await h.tick(3);
    expect(
      h
        .calls()
        .map((c) => c.command)
        .sort(),
    ).toEqual(["A", "t1"]);
    const t1 = h.calls().findIndex((c) => c.command === "t1");
    const a = h.calls().findIndex((c) => c.command === "A");
    h.fail(t1, new Error("boom"));
    await h.tick(3);
    h.finish(a);
    await h.tick(10);
    expect(h.calls()).toHaveLength(2); // nothing sent while halted
    h.start("enqueue");
    await h.tick(6);
    expect(h.calls()).toHaveLength(2); // the enqueue auto-start is refused while halted
    h.start(); // the operator Start
    await h.tick(4);
    h.start(); // a second operator Start while running is ignored
    await h.tick(4);
    await releaseAll(h);
    const tally = sendsByQueueId(h);
    const t1Id = h.calls()[t1].queueId!;
    expect(tally.get(t1Id)).toBe(2);
    for (const [id, n] of tally) {
      if (id !== t1Id) expect(n, `queueId ${id}`).toBe(1);
    }
    expect(tally.size).toBe(5); // t1, A, B, t2, n1
    expect(h.calls()).toHaveLength(6);
  });
});
