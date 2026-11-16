import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { normalizeToolKey } from "@/server/toolKey";
import {
  LANE_NAME_PATTERN,
  LaneValidationError,
  MAX_LANES_PER_RUN,
  PRIMARY_LANE,
  commandWords,
  groupByLane,
  hasLaneTags,
  isBarrier,
  isEligible,
  isLaneValidationError,
  isToolBoxStep,
  isValidLaneName,
  laneMessages,
  laneOf,
  lanesWithWork,
  normalizeLane,
  pickEligible,
  simulateDrain,
  toolKeyOf,
  validateLanes,
  type LaneCommandInfo,
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

function info(
  toolId: string,
  opts: { toolType?: string; command?: string; lane?: unknown; barrier?: unknown } = {},
): LaneCommandInfo {
  const advancedParameters: { lane?: unknown; laneBarrier?: unknown } = {};
  if (opts.lane !== undefined) advancedParameters.lane = opts.lane;
  if (opts.barrier !== undefined) advancedParameters.laneBarrier = opts.barrier;
  return {
    toolId,
    toolType: opts.toolType ?? (toolId === "Tool Box" ? "toolbox" : "stack"),
    command: opts.command ?? "run",
    params: {},
    advancedParameters,
  };
}

function headlineInfos(): LaneCommandInfo[] {
  return headline().map((r) => r.commandInfo as LaneCommandInfo);
}

const BAR = '"Wait for all earlier steps"';

describe("validateLanes sentences (UI-SPEC S2c)", () => {
  it("accepts the headline cycle and an untagged list with a Tool Box goto", () => {
    expect(validateLanes(headlineInfos())).toEqual([]);
    expect(
      validateLanes([
        info("stack-1"),
        info("Tool Box", { command: "goto" }),
        info("fast-1", { toolType: "fast" }),
      ]),
    ).toEqual([]);
  });

  it("refuses a non-tool step on a secondary lane", () => {
    expect(
      validateLanes([info("stack-1"), info("Tool Box", { command: "note", lane: "fast" })]),
    ).toEqual([
      "Step 2 (note) is on lane 'fast', but only tool steps can run on a secondary lane. Move it to the primary lane.",
    ]);
  });

  it("refuses one tool on two lanes, first-seen lane first, conflicting toolId shown", () => {
    expect(
      validateLanes([info("stack-1"), info("STACK-1", { lane: "fast", barrier: true })]),
    ).toEqual([
      "Tool 'STACK-1' is on lanes 'primary' and 'fast'. One tool can use only one lane per run.",
    ]);
  });

  it("refuses an invalid lane name once per distinct normalised value", () => {
    const msgs = validateLanes([
      info("stack-1"),
      info("fast-1", { toolType: "fast", lane: "Fast Lane", barrier: true }),
      info("fast-2", { toolType: "fast", lane: "FAST LANE", barrier: true }),
    ]);
    expect(
      msgs.filter(
        (m) =>
          m === "Lane name 'fast lane' is not valid. Use 1 to 32 characters: a-z, 0-9, - and _.",
      ),
    ).toHaveLength(1);
  });

  it("refuses more than 4 lanes", () => {
    const infos = ["a", "b", "c", "d", "e"].map((l, i) =>
      info(`fast-${i}`, { toolType: "fast", lane: l, barrier: true }),
    );
    expect(validateLanes(infos)).toContain("This run uses 5 lanes. A run can use at most 4.");
  });

  it("counts primary among the lanes when a step is on it", () => {
    const infos = [
      info("stack-1"),
      ...["a", "b", "c", "d"].map((l, i) =>
        info(`fast-${i}`, { toolType: "fast", lane: l, barrier: true }),
      ),
    ];
    expect(validateLanes(infos)).toContain("This run uses 5 lanes. A run can use at most 4.");
    expect(validateLanes(infos.slice(1))).toEqual([]);
  });

  it("requires a barrier on the first row of each secondary lane, except at step 1", () => {
    expect(
      validateLanes([
        info("stack-1"),
        info("stack-1"),
        info("fast-1", { toolType: "fast", lane: "fast" }),
      ]),
    ).toEqual([
      `The first step on lane 'fast' (step 3) must wait for all earlier steps. Turn on ${BAR} for it.`,
    ]);
    expect(
      validateLanes([info("fast-1", { toolType: "fast", lane: "fast" }), info("stack-1")]),
    ).toEqual([]);
  });

  it("judges the barrier rule per lane", () => {
    const msgs = validateLanes([
      info("stack-1"),
      info("fast-1", { toolType: "fast", lane: "fast", barrier: true }),
      info("fast-2", { toolType: "fast", lane: "side" }),
    ]);
    expect(msgs).toEqual([
      `The first step on lane 'side' (step 3) must wait for all earlier steps. Turn on ${BAR} for it.`,
    ]);
  });

  it("refuses a Tool Box goto in a run with a non-primary lane (D-23)", () => {
    const msgs = validateLanes([
      info("stack-1"),
      info("fast-1", { toolType: "fast", lane: "fast", barrier: true }),
      info("stack-1"),
      info("Tool Box", { command: "goto" }),
    ]);
    expect(msgs).toEqual([
      "Step 4 is a Go to step, which cannot be used in a run that has lanes. Remove it, or keep every step on the primary lane.",
    ]);
  });

  it("builds the dead-wait sentence", () => {
    expect(laneMessages.deadWait(7)).toBe(
      `The lane setup cannot finish: step 7 would wait forever. Check the ${BAR} settings.`,
    );
  });

  it("returns messages in rule order", () => {
    const msgs = validateLanes([
      info("stack-1"),
      info("Tool Box", { command: "note", lane: "side" }),
      info("STACK-1", { lane: "fast" }),
      info("fast-1", { toolType: "fast", lane: "Bad Name" }),
      info("fast-2", { toolType: "fast", lane: "c", barrier: true }),
      info("fast-3", { toolType: "fast", lane: "d", barrier: true }),
      info("fast-4", { toolType: "fast", lane: "e", barrier: true }),
      info("Tool Box", { command: "goto" }),
    ]);
    const order = [
      "is not valid",
      "only tool steps can run",
      "One tool can use only one lane",
      "A run can use at most",
      "must wait for all earlier steps",
      "Go to step",
    ];
    const idx = order.map((needle) => msgs.findIndex((m) => m.includes(needle)));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });
});

describe("simulateDrain", () => {
  it("drains the headline cycle and every valid setup in the table", () => {
    const table: LaneCommandInfo[][] = [
      headlineInfos(),
      [info("stack-1"), info("stack-1")],
      [info("fast-1", { toolType: "fast", lane: "fast", barrier: true })],
      [
        info("fast-1", { toolType: "fast", lane: "fast", barrier: true }),
        info("stack-1", { lane: "side", barrier: true }),
        info("fast-1", { toolType: "fast", lane: "fast" }),
        info("stack-1", { lane: "side" }),
      ],
      [
        info("stack-1", { barrier: true }),
        info("fast-1", { toolType: "fast", lane: "fast", barrier: true }),
      ],
      [],
    ];
    for (const infos of table) {
      expect(simulateDrain(infos)).toEqual({ drained: true });
      expect(validateLanes(infos).some((m) => m.includes("cannot finish"))).toBe(false);
    }
  });
});

describe("LaneValidationError", () => {
  it("carries name, messages and a joined message", () => {
    const e = new LaneValidationError(["a.", "b."]);
    expect(e.name).toBe("LaneValidationError");
    expect(e.messages).toEqual(["a.", "b."]);
    expect(e.message).toBe("a. b.");
    expect(e).toBeInstanceOf(Error);
  });

  it("is recognised by Error.name, not class identity", () => {
    const foreign = new Error("x");
    foreign.name = "LaneValidationError";
    expect(isLaneValidationError(foreign)).toBe(true);
    expect(isLaneValidationError(new LaneValidationError(["a."]))).toBe(true);
    expect(isLaneValidationError(new Error("x"))).toBe(false);
    expect(isLaneValidationError(null)).toBe(false);
    expect(isLaneValidationError(undefined)).toBe(false);
    expect(isLaneValidationError("LaneValidationError")).toBe(false);
  });
});

describe("groupByLane", () => {
  it("is null for an untagged list", () => {
    expect(groupByLane([info("stack-1"), info("Tool Box", { command: "note" })])).toBeNull();
    expect(groupByLane([])).toBeNull();
  });

  it("groups the headline cycle with global 1-based positions", () => {
    const groups = groupByLane(headlineInfos());
    expect(groups).not.toBeNull();
    expect(groups!.map((g) => g.lane)).toEqual(["primary", "fast"]);
    expect(groups![0].steps.map((s) => s.position)).toEqual([1, 2, 4, 5, 6]);
    expect(groups![1].steps).toEqual([
      { position: 3, toolId: "fast-1", command: "FAST", barrier: true },
    ]);
    expect(groups![0].steps[3]).toEqual({
      position: 5,
      toolId: "stack-1",
      command: "out1",
      barrier: true,
    });
  });

  it("puts a lane that appears first at the front", () => {
    const groups = groupByLane([
      info("fast-1", { toolType: "fast", lane: "fast", barrier: true }),
      info("stack-1"),
    ]);
    expect(groups!.map((g) => g.lane)).toEqual(["fast", "primary"]);
  });
});

describe("commandWords and hasLaneTags", () => {
  it("replaces every underscore with a space", () => {
    expect(commandWords("get_transfer_estimate")).toBe("get transfer estimate");
    expect(commandWords("run")).toBe("run");
  });

  it("detects lane tags and barriers", () => {
    expect(hasLaneTags([info("stack-1"), info("fast-1", { toolType: "fast" })])).toBe(false);
    expect(hasLaneTags([info("stack-1", { barrier: true })])).toBe(true);
    expect(hasLaneTags([info("stack-1", { lane: "primary" })])).toBe(false);
    expect(hasLaneTags([info("fast-1", { toolType: "fast", lane: "fast" })])).toBe(true);
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
