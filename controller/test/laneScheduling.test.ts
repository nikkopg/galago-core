import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { normalizeToolKey } from "@/server/toolKey";
import {
  LANE_NAME_PATTERN,
  MAX_LANES_PER_RUN,
  PRIMARY_LANE,
  isBarrier,
  isEligible,
  isToolBoxStep,
  isValidLaneName,
  laneOf,
  lanesWithWork,
  normalizeLane,
  pickEligible,
  toolKeyOf,
  type LaneGate,
  type LaneRow,
} from "@/server/laneScheduling";

type Status = "CREATED" | "STARTED" | "FAILED";

function row(
  queueId: number,
  toolId: string,
  opts: {
    toolType?: string;
    command?: string;
    lane?: unknown;
    barrier?: unknown;
    status?: Status;
    runId?: string;
  } = {},
): LaneRow {
  const advancedParameters: { lane?: unknown; laneBarrier?: unknown } = {};
  if (opts.lane !== undefined) advancedParameters.lane = opts.lane;
  if (opts.barrier !== undefined) advancedParameters.laneBarrier = opts.barrier;
  return {
    queueId,
    runId: opts.runId ?? "r1",
    status: opts.status ?? "CREATED",
    commandInfo: {
      toolId,
      toolType: opts.toolType ?? "stack",
      command: opts.command ?? "run",
      params: {},
      advancedParameters,
    },
  };
}

function gate(over: Partial<LaneGate> = {}): LaneGate {
  return {
    halted: false,
    modalOpen: false,
    busyToolKeys: new Set<string>(),
    controllableToolTypes: ["fast"],
    controllableRunning: false,
    ...over,
  };
}

// Headline cycle: in1, in2 (stack, primary), FAST (fast, lane "fast", barrier),
// goto-safe (stack, primary), out1 (stack, primary, barrier), out2 (stack, primary).
function headline(): LaneRow[] {
  return [
    row(1, "stack-1", { command: "in1" }),
    row(2, "stack-1", { command: "in2" }),
    row(3, "fast-1", { toolType: "fast", command: "FAST", lane: "fast", barrier: true }),
    row(4, "stack-1", { command: "goto_safe" }),
    row(5, "stack-1", { command: "out1", barrier: true }),
    row(6, "stack-1", { command: "out2" }),
  ];
}

function without(rows: LaneRow[], ...ids: number[]): LaneRow[] {
  return rows.filter((r) => !ids.includes(r.queueId));
}

function withStatus(rows: LaneRow[], id: number, status: Status): LaneRow[] {
  return rows.map((r) => (r.queueId === id ? { ...r, status } : r));
}

function pickId(rows: LaneRow[], lane: string, g: LaneGate = gate()): number | string {
  const v = pickEligible(rows, lane, g);
  return v.kind === "pick" ? v.row.queueId : v.kind;
}

describe("case 1: headline cycle overlaps FAST with goto-safe (D-04)", () => {
  it("all CREATED: primary picks in1, fast waits for in1 and in2", () => {
    const rows = headline();
    expect(pickId(rows, "primary")).toBe(1);
    expect(pickId(rows, "fast")).toBe("wait");
  });

  it("with in1 and in2 gone, FAST and goto-safe are both eligible at once", () => {
    const rows = without(headline(), 1, 2);
    expect(pickId(rows, "fast")).toBe(3);
    expect(pickId(rows, "primary")).toBe(4);
    expect(isEligible(rows, 0, gate())).toBe(true);
    expect(isEligible(rows, 1, gate())).toBe(true);
  });

  it("with FAST running (busy fast1, controllable running), goto-safe still runs", () => {
    const rows = withStatus(without(headline(), 1, 2), 3, "STARTED");
    const g = gate({ busyToolKeys: new Set(["fast1"]), controllableRunning: true });
    expect(pickId(rows, "primary", g)).toBe(4);
  });

  it("out1 (barrier) waits for FAST and goto-safe", () => {
    const rows = withStatus(without(headline(), 1, 2, 4), 3, "STARTED");
    expect(pickId(rows, "primary")).toBe("wait");
    const withGoto = withStatus(without(headline(), 1, 2), 3, "STARTED");
    // goto-safe (4) ahead of out1 (5): out1 is not picked, goto-safe is
    expect(pickId(withGoto, "primary")).toBe(4);
  });

  it("with FAST and goto-safe gone, out1 runs, then out2 waits for out1", () => {
    const rows = without(headline(), 1, 2, 3, 4);
    expect(pickId(rows, "primary")).toBe(5);
    expect(isEligible(rows, 1, gate())).toBe(false);
  });

  it("with only out2 left primary picks it and fast is drained", () => {
    const rows = without(headline(), 1, 2, 3, 4, 5);
    expect(pickId(rows, "primary")).toBe(6);
    expect(pickId(rows, "fast")).toBe("drained");
  });
});

describe("normalizeLane", () => {
  it("maps blank, non-string and 'primary' to primary", () => {
    for (const v of [undefined, null, "", "   ", "primary", " PRIMARY ", 5]) {
      expect(normalizeLane(v)).toBe("primary");
    }
  });

  it("trims and lower-cases other names", () => {
    expect(normalizeLane(" Fast ")).toBe("fast");
    expect(normalizeLane("Fast Lane")).toBe("fast lane");
  });
});

describe("isValidLaneName", () => {
  it("accepts a-z, 0-9, - and _ up to 32 characters", () => {
    expect(isValidLaneName("fast")).toBe(true);
    expect(isValidLaneName("lane_2")).toBe(true);
    expect(isValidLaneName("a-b")).toBe(true);
    expect(isValidLaneName("a".repeat(32))).toBe(true);
  });

  it("rejects blank, upper case, spaces, punctuation and 33 characters", () => {
    for (const v of ["", "Fast", "fa st", "fast!", "a".repeat(33)]) {
      expect(isValidLaneName(v)).toBe(false);
    }
  });

  it("exports the constants the plan pins", () => {
    expect(PRIMARY_LANE).toBe("primary");
    expect(MAX_LANES_PER_RUN).toBe(4);
    expect(LANE_NAME_PATTERN.source).toBe("^[a-z0-9_-]{1,32}$");
  });
});

describe("laneOf and isBarrier", () => {
  it("forces every Tool Box step to primary whatever its stored tag", () => {
    expect(
      laneOf({
        toolId: "Tool Box",
        toolType: "toolbox",
        command: "note",
        advancedParameters: { lane: "fast" },
      }),
    ).toBe("primary");
    expect(isToolBoxStep({ toolId: "Tool Box" })).toBe(true);
    expect(isToolBoxStep({ toolId: "x", toolType: "toolbox" })).toBe(true);
    expect(isToolBoxStep({ toolId: "fast-1", toolType: "fast" })).toBe(false);
  });

  it("normalises a tool step's lane, maps an invalid name or no params to primary", () => {
    expect(
      laneOf({ toolId: "fast-1", toolType: "fast", advancedParameters: { lane: " FAST " } }),
    ).toBe("fast");
    expect(
      laneOf({ toolId: "fast-1", toolType: "fast", advancedParameters: { lane: "bad name!" } }),
    ).toBe("primary");
    expect(laneOf({ toolId: "fast-1", toolType: "fast" })).toBe("primary");
    expect(laneOf(undefined)).toBe("primary");
  });

  it("is a barrier only for laneBarrier === true", () => {
    expect(isBarrier({ advancedParameters: { laneBarrier: true } })).toBe(true);
    expect(isBarrier({ advancedParameters: { laneBarrier: "true" } })).toBe(false);
    expect(isBarrier({ advancedParameters: { laneBarrier: 1 } })).toBe(false);
    expect(isBarrier({ advancedParameters: {} })).toBe(false);
    expect(isBarrier({})).toBe(false);
  });
});

describe("toolKeyOf", () => {
  it("agrees with normalizeToolKey", () => {
    expect(toolKeyOf("STACK-1")).toBe("stack1");
    for (const v of ["STACK-1", "fast 2", "", undefined, "A_b.c"]) {
      expect(toolKeyOf(v)).toBe(normalizeToolKey(v));
    }
  });
});

describe("eligibility rules", () => {
  it("never picks a STARTED row", () => {
    const rows = [row(1, "stack-1", { status: "STARTED" })];
    expect(pickId(rows, "primary")).toBe("wait");
    expect(isEligible(rows, 0, gate())).toBe(false);
  });

  it("picks a FAILED row ahead of later CREATED rows of the same lane", () => {
    const rows = [row(1, "stack-1", { status: "FAILED" }), row(2, "stack-1")];
    expect(pickId(rows, "primary")).toBe(1);
  });

  it("never lets run r2 run while any r1 row is queued", () => {
    const rows = [
      row(1, "stack-1", { status: "STARTED" }),
      row(2, "fast-1", { toolType: "fast", lane: "fast", barrier: true, runId: "r2" }),
    ];
    expect(pickId(rows, "fast")).toBe("wait");
    expect(isEligible(rows, 1, gate())).toBe(false);
  });

  it("makes a lane with a STARTED row wait", () => {
    const rows = [
      row(1, "fast-1", { toolType: "fast", lane: "x", barrier: true, status: "STARTED" }),
      row(2, "fast-2", { toolType: "fast", lane: "x" }),
    ];
    expect(pickId(rows, "x")).toBe("wait");
  });

  it("makes a row wait when its tool key is busy (STACK-1 against busy stack1)", () => {
    const rows = [row(1, "STACK-1")];
    expect(pickId(rows, "primary", gate({ busyToolKeys: new Set(["stack1"]) }))).toBe("wait");
    expect(pickId(rows, "primary", gate({ busyToolKeys: new Set(["stack2"]) }))).toBe(1);
  });

  it("waits on every lane when halted or a modal is open", () => {
    const rows = without(headline(), 1, 2);
    expect(pickId(rows, "fast", gate({ halted: true }))).toBe("wait");
    expect(pickId(rows, "primary", gate({ halted: true }))).toBe("wait");
    expect(pickId(rows, "fast", gate({ modalOpen: true }))).toBe("wait");
    expect(pickId(rows, "primary", gate({ modalOpen: true }))).toBe("wait");
  });

  it("waits on lane fast while any Tool Box row is STARTED", () => {
    const rows = [
      row(1, "Tool Box", { toolType: "toolbox", command: "pause", status: "STARTED" }),
      row(2, "fast-1", { toolType: "fast", lane: "fast", barrier: true }),
    ];
    expect(pickId(rows, "fast")).toBe("wait");
  });

  it("blocks a controllable step while another controllable step runs, not a stack step", () => {
    const rows = without(headline(), 1, 2);
    const g = gate({ controllableRunning: true });
    expect(pickId(rows, "fast", g)).toBe("wait");
    expect(pickId(rows, "primary", g)).toBe(4);
  });

  it("serialises an untagged run on the primary lane", () => {
    const rows = [row(1, "stack-1"), row(2, "stack-1"), row(3, "stack-1")];
    expect(pickId(rows, "primary")).toBe(1);
    expect(pickId(withStatus(rows, 1, "STARTED"), "primary")).toBe("wait");
  });

  it("returns empty for no rows", () => {
    expect(pickEligible([], "primary", gate())).toEqual({ kind: "empty" });
    expect(pickEligible([], "fast", gate())).toEqual({ kind: "empty" });
  });

  it("lists lanes with work in first-appearance order", () => {
    expect(lanesWithWork(headline())).toEqual(["fast"]);
    expect(lanesWithWork(without(headline(), 3))).toEqual([]);
    const two = [
      row(1, "fast-1", { toolType: "fast", lane: "b", barrier: true }),
      row(2, "fast-2", { toolType: "fast", lane: "a", barrier: true }),
      row(3, "fast-3", { toolType: "fast", lane: "b" }),
    ];
    expect(lanesWithWork(two)).toEqual(["b", "a"]);
  });

  it("does not mutate its input", () => {
    const rows = headline();
    const snapshot = JSON.stringify(rows);
    pickEligible(rows, "primary", gate());
    lanesWithWork(rows);
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});

describe("purity pin", () => {
  it("has no import line and no timer call", () => {
    const src = readFileSync(join(__dirname, "../server/laneScheduling.ts"), "utf8");
    expect(src.split("\n").filter((l) => /^\s*import\b/.test(l))).toEqual([]);
    expect(/\bsetTimeout\s*\(/.test(src)).toBe(false);
    expect(/\bsetInterval\s*\(/.test(src)).toBe(false);
  });
});
