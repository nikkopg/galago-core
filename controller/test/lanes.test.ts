// Phase 8 concurrency lanes through the real CommandQueue (LAN-02, LAN-03, LAN-04).
// Fakes only: every Tool.executeCommand is a deferred the test resolves, so no
// instrument can move. Ordering is gated on deferreds and tick(), never wall time.
import { describe, it, expect, afterEach, vi } from "vitest";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { logAction } from "@/server/logger";
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
