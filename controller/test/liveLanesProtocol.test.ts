// Phase 9 offline proof of the live and drill protocols. Fakes only; no tool server is contacted.
import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ToolType } from "gen-interfaces/controller";
import { executeProtocolScript } from "@/server/scripting/protocol-script-executor";
import { validateLanes } from "@/server/laneScheduling";
import { createLaneHarness, type LaneHarness, type LaneStep } from "./helpers/laneHarness";

vi.mock("@/server/scripting/resolve-tool-types", () => ({
  resolveToolTypes: vi.fn(async (commands: unknown[]) => commands),
}));

interface ProtocolParameter {
  name: string;
  defaultValue?: string;
}
interface Protocol {
  name: string;
  mode: string;
  scriptContent: string;
  parameters: ProtocolParameter[];
}
type Commands = Awaited<ReturnType<typeof executeProtocolScript>>["commands"];

const PROTOCOL_DIR = path.join(
  path.resolve(__dirname, "../.."),
  ".planning/phases/09-supervised-live-two-tool-proof/protocols",
);

function loadProtocol(file: string): Protocol {
  return JSON.parse(fs.readFileSync(path.join(PROTOCOL_DIR, file), "utf-8")).protocol;
}

// Every parameter at its default as a string, then the overrides on top.
function paramsFor(protocol: Protocol, overrides: Record<string, string> = {}) {
  const out: Record<string, string> = {};
  for (const p of protocol.parameters) out[p.name] = String(p.defaultValue ?? "");
  return { ...out, ...overrides };
}

const toolTypeOf = (toolId: string) =>
  toolId === "Tool Box" ? "toolbox" : /stack/i.test(toolId) ? "stack" : "fast";

function laneInfos(commands: Commands) {
  return commands.map((c) => ({ ...c, toolType: toolTypeOf(c.toolId) }));
}

function toLaneSteps(commands: Commands): LaneStep[] {
  return commands.map((c) => {
    const adv = c.advancedParameters as { lane?: string; laneBarrier?: boolean } | undefined;
    const kind = toolTypeOf(c.toolId);
    return {
      toolId: c.toolId,
      toolType:
        kind === "toolbox" ? ToolType.toolbox : kind === "stack" ? ToolType.stack : ToolType.fast,
      command: c.command,
      params: { ...(c.params as Record<string, unknown>) },
      lane: adv?.lane,
      barrier: adv?.laneBarrier,
    };
  });
}

const adv = (c: Commands[number]) => c.advancedParameters as unknown as Record<string, unknown>;
const prm = (c: Commands[number]) => c.params as Record<string, unknown>;

async function run(protocol: Protocol, overrides: Record<string, string> = {}) {
  const result = await executeProtocolScript(
    protocol.scriptContent,
    paramsFor(protocol, overrides),
  );
  return result;
}

async function runOk(protocol: Protocol, overrides: Record<string, string> = {}) {
  const result = await run(protocol, overrides);
  expect(result.error).toBeUndefined();
  expect(result.success).toBe(true);
  return result.commands;
}

const stackKeys = (commands: Commands) =>
  commands
    .filter((c) => c.toolId === "stack-1" && c.command === "transfer")
    .map((c) => String(prm(c).step_key));

let h: LaneHarness | undefined;
afterEach(async () => {
  if (h) await h.teardown();
  h = undefined;
});

async function releaseAll(harness: LaneHarness, rounds = 20) {
  for (let i = 0; i < rounds; i++) {
    await harness.tick(3);
    for (const call of harness.calls()) if (!call.gate.isSettled()) call.gate.resolve(undefined);
  }
}

const indexOfCall = (
  harness: LaneHarness,
  pred: (c: LaneHarness["calls"] extends () => (infer R)[] ? R : never) => boolean,
) => harness.calls().findIndex(pred);
const keyEndsWith = (suffix: string) => (c: { params: unknown }) =>
  String((c.params as { step_key?: string }).step_key).endsWith(suffix);

// Amended D-02/D-03 (user decision 2026-11-17): the third plate starts on nest-3 (spare A in the plans,
// the overlap source), x1 moves it to nest-1 (spare B, the overlap destination, plate 1's home) during the
// F.A.S.T. liquid leg, out1 lands plate 1 on nest-3, and there is no return leg.
const NEST_1 = { device: "nest-1", deck: "deck1", nest: "A1" };
const NEST_2 = { device: "nest-2", deck: "deck`", nest: "A1" };
const NEST_3 = { device: "nest-3", deck: "deck1", nest: "A1" };
const out1Dest = (t: { device: string; deck: string; nest: string }) => ({
  out1_dest_device: t.device,
  out1_dest_deck: t.deck,
  out1_dest_nest: t.nest,
});
const BASE_OVERRIDES = {
  stack_tool: "stack-1",
  fast_tool: "fast-1",
  batch_label: "LIVTEST",
  spare_a_device: NEST_3.device,
  spare_a_deck: NEST_3.deck,
  spare_a_nest: NEST_3.nest,
  spare_b_device: NEST_1.device,
  spare_b_deck: NEST_1.deck,
  spare_b_nest: NEST_1.nest,
};
// Event 1 has no overlap move: out1 returns plate 1 to nest-1. Event 2: out1 lands on the overlap source.
const EVENT1_OVERRIDES = { ...BASE_OVERRIDES, ...out1Dest(NEST_1) };
const EVENT2_OVERRIDES = { ...BASE_OVERRIDES, ...out1Dest(NEST_3) };

const triple = (p: Record<string, unknown>, side: "source" | "destination") =>
  [p[`${side}_device`], p[`${side}_deck`], p[`${side}_nest`]].join("|");
const tripleOf = (t: { device: string; deck: string; nest: string }) =>
  [t.device, t.deck, t.nest].join("|");

async function rowStatusOf(harness: LaneHarness, index: number) {
  const id = harness.calls()[index].queueId;
  const rows = await harness.queue.commands.all();
  return rows.find((r) => r.queueId === id)?.status;
}

describe("event-1 protocol (D-01, D-04, D-06, amended D-02)", () => {
  const protocol = loadProtocol("09-live-lanes-event1.protocol.json");

  it("is a script protocol with the cycle, tool, overlap and out1 destination parameters", () => {
    expect(protocol.mode).toBe("script");
    const names = protocol.parameters.map((p) => p.name);
    for (const n of [
      "stack_tool",
      "fast_tool",
      "batch_label",
      "spare_a_device",
      "spare_a_deck",
      "spare_a_nest",
      "spare_b_device",
      "spare_b_deck",
      "spare_b_nest",
      "out1_dest_device",
      "out1_dest_deck",
      "out1_dest_nest",
    ]) {
      expect(names).toContain(n);
    }
    for (const p of protocol.parameters.filter(
      (q) =>
        q.name.startsWith("spare_") ||
        (q.name.startsWith("out1_dest_") && q.name !== "out1_dest_transfer_profile"),
    )) {
      if (p.name.endsWith("transfer_profile")) continue;
      expect(p.defaultValue, p.name).toBe("");
    }
    expect(protocol.scriptContent).toContain('galago.lane("fast")');
    expect(protocol.scriptContent).toContain("get_transfer_estimate");
  });

  it("(a) emits exactly note, in1, in2, F.A.S.T., estimate, out1, out2", async () => {
    const commands = await runOk(protocol, EVENT1_OVERRIDES);
    expect(commands.map((c) => c.command)).toEqual([
      "note",
      "transfer",
      "transfer",
      "transfer",
      "get_transfer_estimate",
      "transfer",
      "transfer",
    ]);
    expect(commands.map((c) => c.toolId)).toEqual([
      "Tool Box",
      "stack-1",
      "stack-1",
      "fast-1",
      "stack-1",
      "stack-1",
      "stack-1",
    ]);
  });

  it("(b) only the F.A.S.T. row is on lane fast; barriers only on F.A.S.T. and out1; no STACK lane key", async () => {
    const commands = await runOk(protocol, EVENT1_OVERRIDES);
    commands.forEach((c, i) => {
      if (c.toolId === "fast-1") expect(adv(c).lane, `row ${i}`).toBe("fast");
      else expect("lane" in adv(c), `row ${i}`).toBe(false);
    });
    const barriers = commands.map((c) => adv(c).laneBarrier === true);
    expect(barriers).toEqual([false, false, false, true, false, true, false]);
    for (const c of commands) expect(adv(c).laneBarrier === false).toBe(false);
  });

  it("(c) validateLanes returns no refusal", async () => {
    const commands = await runOk(protocol, EVENT1_OVERRIDES);
    expect(validateLanes(laneInfos(commands) as never)).toEqual([]);
  });

  it("(d) the four STACK transfer keys share one base, end in -in1/-in2/-out1/-out2 and are disjoint across runs", async () => {
    const first = stackKeys(await runOk(protocol, EVENT1_OVERRIDES));
    const second = stackKeys(await runOk(protocol, EVENT1_OVERRIDES));
    for (const keys of [first, second]) {
      expect(keys).toHaveLength(4);
      expect(keys.map((k) => k.slice(k.lastIndexOf("-")))).toEqual([
        "-in1",
        "-in2",
        "-out1",
        "-out2",
      ]);
      expect(new Set(keys.map((k) => k.slice(0, k.lastIndexOf("-")))).size).toBe(1);
      expect(new Set(keys).size).toBe(4);
      expect(keys[0].startsWith("LIVTEST-")).toBe(true);
    }
    expect(first.filter((k) => second.includes(k))).toEqual([]);
  });

  it("(e) the estimate carries the overlap move nest-3 to nest-1 and no step_key or timeout_s", async () => {
    const commands = await runOk(protocol, EVENT1_OVERRIDES);
    const est = commands.find((c) => c.command === "get_transfer_estimate")!;
    const p = prm(est);
    expect("step_key" in p).toBe(false);
    expect("timeout_s" in p).toBe(false);
    expect(p).toEqual({
      robot: "stack2-6",
      labware_profile: "Default",
      source_device: "nest-3",
      source_deck: "deck1",
      source_nest: "A1",
      destination_device: "nest-1",
      destination_deck: "deck1",
      destination_nest: "A1",
    });
  });

  it("(e2) optional overlap transfer profiles are sent only when non-blank", async () => {
    const commands = await runOk(protocol, {
      ...EVENT1_OVERRIDES,
      spare_a_transfer_profile: "Default",
      spare_b_transfer_profile: "Default",
    });
    const p = prm(commands.find((c) => c.command === "get_transfer_estimate")!);
    expect(p.source_transfer_profile).toBe("Default");
    expect(p.destination_transfer_profile).toBe("Default");
  });

  it("(e3) out1 targets the out1 destination parameters; out2 is unchanged", async () => {
    const commands = await runOk(protocol, EVENT1_OVERRIDES);
    const out1 = prm(commands.find((c) => String(prm(c).step_key).endsWith("-out1"))!);
    const out2 = prm(commands.find((c) => String(prm(c).step_key).endsWith("-out2"))!);
    expect(triple(out1, "source")).toBe("fa100056|tray1|5");
    expect(triple(out1, "destination")).toBe(tripleOf(NEST_1));
    expect(triple(out2, "source")).toBe("fa100056|tray1|6");
    expect(triple(out2, "destination")).toBe(tripleOf(NEST_2));
  });

  it("(f) Edge LIV-01/empty: a blank spare_a_nest or out1_dest_nest throws before any galago call", async () => {
    for (const blank of ["spare_a_nest", "out1_dest_nest"]) {
      const result = await run(protocol, { ...EVENT1_OVERRIDES, [blank]: "" });
      expect(result.success, blank).toBe(false);
      expect(result.error).toContain(blank);
      expect(result.commands).toEqual([]);
    }
  });

  it("(g) Edge LIV-01/adjacency and amended D-02: unsafe overlap or out1 locations are refused with the guard sentence", async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [
        { spare_b_device: NEST_3.device, spare_b_deck: NEST_3.deck, spare_b_nest: NEST_3.nest },
        "LIV-01: overlap source and overlap destination must differ",
      ],
      [
        {
          spare_a_device: NEST_1.device,
          spare_a_deck: NEST_1.deck,
          spare_a_nest: NEST_1.nest,
          spare_b_device: "free-dev",
          spare_b_deck: "deck1",
          spare_b_nest: "A1",
        },
        "LIV-01: the overlap source must not be a plate home",
      ],
      [
        {
          spare_a_device: NEST_2.device,
          spare_a_deck: NEST_2.deck,
          spare_a_nest: NEST_2.nest,
          spare_b_device: "free-dev",
          spare_b_deck: "deck1",
          spare_b_nest: "A1",
        },
        "LIV-01: the overlap source must not be a plate home",
      ],
      [
        { spare_b_device: NEST_2.device, spare_b_deck: NEST_2.deck, spare_b_nest: NEST_2.nest },
        "LIV-01: the overlap destination may be plate 1's home only, not plate 2's home",
      ],
      [
        { spare_a_device: "fa100056", spare_a_deck: "trayX", spare_a_nest: "9" },
        "LIV-01: the overlap source must not be on the F.A.S.T.-side device",
      ],
      [
        { spare_b_device: "fa100056", spare_b_deck: "tray1", spare_b_nest: "4" },
        "LIV-01: the overlap destination must not be on the F.A.S.T.-side device",
      ],
      [
        out1Dest(NEST_3),
        "LIV-01: in event 1 the out1 destination must be plate 1's home (the third plate stays on the overlap source)",
      ],
    ];
    for (const [over, sentence] of cases) {
      const result = await run(protocol, { ...EVENT1_OVERRIDES, ...over });
      expect(result.success, sentence).toBe(false);
      expect(result.error).toContain(sentence);
      expect(result.commands).toEqual([]);
    }
  });

  it("(h) end to end: the estimate overlaps the F.A.S.T. leg, out1 waits for it, every queueId is sent once", async () => {
    const commands = await runOk(protocol, EVENT1_OVERRIDES);
    h = createLaneHarness();
    await h.push("e1", toLaneSteps(commands));
    const done = h.start();
    await h.tick(3);
    const in1 = indexOfCall(h, keyEndsWith("-in1"));
    expect(in1).toBeGreaterThanOrEqual(0);
    h.finish(in1);
    await h.tick(3);
    const in2 = indexOfCall(h, keyEndsWith("-in2"));
    expect(in2).toBeGreaterThanOrEqual(0);
    h.finish(in2);
    await h.tick(4);

    const fast = indexOfCall(h, (c) => c.toolId === "fast-1" && c.command === "transfer");
    const estimate = indexOfCall(h, (c) => c.command === "get_transfer_estimate");
    expect(fast).toBeGreaterThanOrEqual(0);
    expect(estimate).toBeGreaterThanOrEqual(0);
    expect(h.calls()[fast].gate.isSettled()).toBe(false);
    expect(h.calls()[estimate].gate.isSettled()).toBe(false);

    h.finish(estimate);
    await h.tick(6);
    expect(indexOfCall(h, keyEndsWith("-out1"))).toBe(-1);
    expect(h.calls()[fast].gate.isSettled()).toBe(false);

    h.finish(fast);
    await releaseAll(h);
    await done;

    expect(h.calls()).toHaveLength(6);
    const ids = h.calls().map((c) => c.queueId);
    expect(ids.every((id) => id !== undefined)).toBe(true);
    expect(new Set(ids).size).toBe(6);
    const rows = await h.queue.commands.all();
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.status === "COMPLETED")).toBe(true);
  });
});

describe("event-2 protocol (D-01, D-06, amended D-02, D-03 dropped)", () => {
  const protocol = loadProtocol("09-live-lanes-event2.protocol.json");
  const STEP_SUFFIXES = ["-in1", "-in2", "-x1", "-out1", "-out2"];

  it("is a script protocol with an optional overlap_timeout_s, required no-default out1_dest_*, every suffix in the script and no x2", () => {
    expect(protocol.mode).toBe("script");
    const names = protocol.parameters.map((p) => p.name);
    expect(names).toContain("overlap_timeout_s");
    for (const n of ["out1_dest_device", "out1_dest_deck", "out1_dest_nest"]) {
      const p = protocol.parameters.find((q) => q.name === n);
      expect(p, n).toBeDefined();
      expect(p!.defaultValue, n).toBe("");
      expect((p as unknown as { required: boolean }).required, n).toBe(true);
    }
    for (const suffix of STEP_SUFFIXES) {
      expect(protocol.scriptContent).toContain(suffix);
    }
    expect(protocol.scriptContent).not.toContain("-x2");
  });

  it("(a) emits exactly note, in1, in2, F.A.S.T., x1, out1, out2", async () => {
    const commands = await runOk(protocol, EVENT2_OVERRIDES);
    expect(commands.map((c) => c.command)).toEqual([
      "note",
      "transfer",
      "transfer",
      "transfer",
      "transfer",
      "transfer",
      "transfer",
    ]);
    expect(commands.map((c) => c.toolId)).toEqual([
      "Tool Box",
      "stack-1",
      "stack-1",
      "fast-1",
      "stack-1",
      "stack-1",
      "stack-1",
    ]);
  });

  it("(b) only the F.A.S.T. row is on lane fast; barriers only on F.A.S.T. and out1; no STACK lane key", async () => {
    const commands = await runOk(protocol, EVENT2_OVERRIDES);
    commands.forEach((c, i) => {
      if (c.toolId === "fast-1") expect(adv(c).lane, `row ${i}`).toBe("fast");
      else expect("lane" in adv(c), `row ${i}`).toBe(false);
    });
    expect(commands.map((c) => adv(c).laneBarrier === true)).toEqual([
      false,
      false,
      false,
      true,
      false,
      true,
      false,
    ]);
    for (const c of commands) expect(adv(c).laneBarrier === false).toBe(false);
  });

  it("(c) validateLanes returns no refusal", async () => {
    const commands = await runOk(protocol, EVENT2_OVERRIDES);
    expect(validateLanes(laneInfos(commands) as never)).toEqual([]);
  });

  it("(d) five STACK keys, no x2: one base, suffixes in order, five distinct values per run, disjoint across runs", async () => {
    const first = stackKeys(await runOk(protocol, EVENT2_OVERRIDES));
    const second = stackKeys(await runOk(protocol, EVENT2_OVERRIDES));
    for (const keys of [first, second]) {
      expect(keys).toHaveLength(5);
      expect(keys.map((k) => k.slice(k.lastIndexOf("-")))).toEqual(STEP_SUFFIXES);
      expect(keys.some((k) => k.endsWith("-x2"))).toBe(false);
      expect(new Set(keys.map((k) => k.slice(0, k.lastIndexOf("-")))).size).toBe(1);
      expect(new Set(keys).size).toBe(5);
    }
    expect(first.filter((k) => second.includes(k))).toEqual([]);
  });

  it("(e) x1 is nest-3 to nest-1, out1 is tray1/5 to nest-3, out2 is unchanged (D-02 amended)", async () => {
    const commands = await runOk(protocol, EVENT2_OVERRIDES);
    const byKey = (suffix: string) =>
      prm(commands.find((c) => String(prm(c).step_key).endsWith(suffix))!);
    const x1 = byKey("-x1");
    const out1 = byKey("-out1");
    const out2 = byKey("-out2");
    expect(triple(x1, "source")).toBe(tripleOf(NEST_3));
    expect(triple(x1, "destination")).toBe(tripleOf(NEST_1));
    expect(triple(out1, "source")).toBe("fa100056|tray1|5");
    expect(triple(out1, "destination")).toBe(tripleOf(NEST_3));
    expect(triple(out2, "source")).toBe("fa100056|tray1|6");
    expect(triple(out2, "destination")).toBe(tripleOf(NEST_2));
    // No leg of the overlap move touches plate 2's home or the F.A.S.T. side.
    for (const side of ["source", "destination"] as const) {
      expect(triple(x1, side)).not.toBe(tripleOf(NEST_2));
      expect(x1[`${side}_device`]).not.toBe("fa100056");
    }
  });

  it("(e2) overlap_timeout_s: blank sends none, a number at or above 0 is sent, anything else is refused", async () => {
    const blank = await runOk(protocol, EVENT2_OVERRIDES);
    const xKeys = (cs: Commands) => cs.filter((c) => /-x1$/.test(String(prm(c).step_key)));
    expect(xKeys(blank)).toHaveLength(1);
    for (const c of xKeys(blank)) expect("timeout_s" in prm(c)).toBe(false);
    const set = await runOk(protocol, { ...EVENT2_OVERRIDES, overlap_timeout_s: "120" });
    for (const c of xKeys(set)) expect(prm(c).timeout_s).toBe(120);
    for (const bad of ["-1", "abc"]) {
      const result = await run(protocol, { ...EVENT2_OVERRIDES, overlap_timeout_s: bad });
      expect(result.success, bad).toBe(false);
      expect(result.error).toContain("overlap_timeout_s");
      expect(result.commands).toEqual([]);
    }
  });

  it("(f) the guard refuses unsafe overlap or out1 locations and blank required inputs before any galago call", async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ spare_a_nest: "" }, "spare_a_nest"],
      [{ out1_dest_device: "" }, "out1_dest_device"],
      // overlap destination == plate 2's home
      [
        { spare_b_device: NEST_2.device, spare_b_deck: NEST_2.deck, spare_b_nest: NEST_2.nest },
        "LIV-01: the overlap destination may be plate 1's home only, not plate 2's home",
      ],
      // overlap destination on the F.A.S.T. device
      [
        { spare_b_device: "fa100056", spare_b_deck: "tray1", spare_b_nest: "4" },
        "LIV-01: the overlap destination must not be on the F.A.S.T.-side device",
      ],
      // overlap source on the F.A.S.T. device
      [
        { spare_a_device: "fa100056", spare_a_deck: "trayX", spare_a_nest: "9" },
        "LIV-01: the overlap source must not be on the F.A.S.T.-side device",
      ],
      // overlap source is a plate home
      [
        {
          spare_a_device: NEST_1.device,
          spare_a_deck: NEST_1.deck,
          spare_a_nest: NEST_1.nest,
          spare_b_device: "free-dev",
          spare_b_deck: "deck1",
          spare_b_nest: "A1",
        },
        "LIV-01: the overlap source must not be a plate home",
      ],
      [
        {
          spare_a_device: NEST_2.device,
          spare_a_deck: NEST_2.deck,
          spare_a_nest: NEST_2.nest,
          spare_b_device: "free-dev",
          spare_b_deck: "deck1",
          spare_b_nest: "A1",
        },
        "LIV-01: the overlap source must not be a plate home",
      ],
      // overlap source == overlap destination
      [
        { spare_b_device: NEST_3.device, spare_b_deck: NEST_3.deck, spare_b_nest: NEST_3.nest },
        "LIV-01: overlap source and overlap destination must differ",
      ],
      // out1 destination != overlap source (plate 1's home, the pre-amendment target; and a stray nest)
      [out1Dest(NEST_1), "LIV-01: the out1 destination must equal the overlap source"],
      [
        out1Dest({ device: "nest-3", deck: "deck1", nest: "A2" }),
        "LIV-01: the out1 destination must equal the overlap source",
      ],
    ];
    for (const [over, sentence] of cases) {
      const result = await run(protocol, { ...EVENT2_OVERRIDES, ...over });
      expect(result.success, sentence).toBe(false);
      expect(result.error).toContain(sentence);
      expect(result.commands).toEqual([]);
    }
  });

  // Starts the run and returns the harness with in1 and in2 completed, x1 and the F.A.S.T. step in flight.
  async function startToOverlap(runId: string) {
    const commands = await runOk(protocol, EVENT2_OVERRIDES);
    h = createLaneHarness();
    await h.push(runId, toLaneSteps(commands));
    const done = h.start();
    await h.tick(3);
    // (a) only in1 has been sent: nothing else may be sent before in1 COMPLETED.
    expect(h.calls()).toHaveLength(1);
    expect(indexOfCall(h, keyEndsWith("-in1"))).toBe(0);
    expect(indexOfCall(h, keyEndsWith("-x1"))).toBe(-1);
    h.finish(0);
    await h.tick(3);
    expect(await rowStatusOf(h, 0)).toBe("COMPLETED");
    const in2 = indexOfCall(h, keyEndsWith("-in2"));
    expect(in2).toBeGreaterThanOrEqual(0);
    expect(indexOfCall(h, keyEndsWith("-x1"))).toBe(-1);
    h.finish(in2);
    await h.tick(4);
    return { done };
  }

  it("(g1) x1 is sent only after in1 COMPLETED and still overlaps the F.A.S.T. liquid leg", async () => {
    const { done } = await startToOverlap("e2-a");
    const x1 = indexOfCall(h!, keyEndsWith("-x1"));
    const fast = indexOfCall(h!, (c) => c.toolId === "fast-1" && c.command === "transfer");
    expect(x1).toBeGreaterThan(indexOfCall(h!, keyEndsWith("-in1")));
    expect(x1).toBeGreaterThanOrEqual(0);
    expect(fast).toBeGreaterThanOrEqual(0);
    expect(await rowStatusOf(h!, indexOfCall(h!, keyEndsWith("-in1")))).toBe("COMPLETED");
    // Both are in flight at once: the overlap this protocol exists to prove.
    expect(h!.calls()[fast].gate.isSettled()).toBe(false);
    expect(h!.calls()[x1].gate.isSettled()).toBe(false);
    await releaseAll(h!);
    await done;
  });

  it("(g2) out1 is sent only after x1 COMPLETED, even when the F.A.S.T. leg finishes first; no x2 follows", async () => {
    const { done } = await startToOverlap("e2-b");
    const x1 = indexOfCall(h!, keyEndsWith("-x1"));
    const fast = indexOfCall(h!, (c) => c.toolId === "fast-1" && c.command === "transfer");
    // The F.A.S.T. leg ends first; x1 is still moving: out1 must wait for x1, not just the barrier.
    h!.finish(fast);
    await h!.tick(8);
    expect(h!.calls()[x1].gate.isSettled()).toBe(false);
    expect(indexOfCall(h!, keyEndsWith("-out1"))).toBe(-1);
    expect(indexOfCall(h!, keyEndsWith("-out2"))).toBe(-1);

    h!.finish(x1);
    await h!.tick(6);
    expect(await rowStatusOf(h!, x1)).toBe("COMPLETED");
    const out1 = indexOfCall(h!, keyEndsWith("-out1"));
    expect(out1).toBeGreaterThan(x1);
    expect(indexOfCall(h!, keyEndsWith("-out2"))).toBe(-1);
    h!.finish(out1);
    await h!.tick(6);
    const out2 = indexOfCall(h!, keyEndsWith("-out2"));
    expect(out2).toBeGreaterThanOrEqual(0);
    h!.finish(out2);
    await releaseAll(h!);
    await done;

    // (g) no x2 leg: seven rows, six sends (note is not sent), all queueIds distinct and sent once.
    expect(indexOfCall(h!, keyEndsWith("-x2"))).toBe(-1);
    expect(h!.calls()).toHaveLength(6);
    const ids = h!.calls().map((c) => c.queueId);
    expect(ids.every((id) => id !== undefined)).toBe(true);
    expect(new Set(ids).size).toBe(6);
    const rows = await h!.queue.commands.all();
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.status === "COMPLETED")).toBe(true);
  });

  it("(g2b) out1 also waits for the F.A.S.T. leg when x1 finishes first (barrier)", async () => {
    const { done } = await startToOverlap("e2-e");
    const x1 = indexOfCall(h!, keyEndsWith("-x1"));
    const fast = indexOfCall(h!, (c) => c.toolId === "fast-1" && c.command === "transfer");
    h!.finish(x1);
    await h!.tick(8);
    expect(await rowStatusOf(h!, x1)).toBe("COMPLETED");
    expect(h!.calls()[fast].gate.isSettled()).toBe(false);
    expect(indexOfCall(h!, keyEndsWith("-out1"))).toBe(-1);
    h!.finish(fast);
    await h!.tick(6);
    expect(indexOfCall(h!, keyEndsWith("-out1"))).toBeGreaterThan(x1);
    await releaseAll(h!);
    await done;
  });

  it("(g3) a failed in1 halts the run: x1 and everything after it are never sent", async () => {
    const commands = await runOk(protocol, EVENT2_OVERRIDES);
    h = createLaneHarness();
    await h.push("e2-c", toLaneSteps(commands));
    const done = h.start();
    await h.tick(3);
    expect(indexOfCall(h, keyEndsWith("-in1"))).toBe(0);
    h.fail(0, new Error("in1 failed"));
    await h.tick(12);
    expect(h.calls()).toHaveLength(1);
    for (const suffix of ["-in2", "-x1", "-out1", "-out2"]) {
      expect(indexOfCall(h, keyEndsWith(suffix)), suffix).toBe(-1);
    }
    expect(indexOfCall(h, (c) => c.toolId === "fast-1")).toBe(-1);
    await releaseAll(h);
    await done;
    expect(h.calls().some((c) => keyEndsWith("-x1")(c))).toBe(false);
  });

  it("(g4) a failed x1 halts the run: out1 and out2 are never sent, so no plate lands on an occupied nest", async () => {
    const { done } = await startToOverlap("e2-d");
    const x1 = indexOfCall(h!, keyEndsWith("-x1"));
    const fast = indexOfCall(h!, (c) => c.toolId === "fast-1" && c.command === "transfer");
    h!.fail(x1, new Error("x1 failed"));
    await h!.tick(4);
    h!.finish(fast); // the running F.A.S.T. step may still complete; nothing new is dispatched
    await h!.tick(12);
    expect(indexOfCall(h!, keyEndsWith("-out1"))).toBe(-1);
    expect(indexOfCall(h!, keyEndsWith("-out2"))).toBe(-1);
    expect(h!.calls()).toHaveLength(4); // in1, in2, F.A.S.T., x1
    await releaseAll(h!);
    await done;
    expect(h!.calls().some((c) => keyEndsWith("-out1")(c))).toBe(false);
  });
});

describe("sim-drill protocol (D-10, D-11)", () => {
  const protocol = loadProtocol("09-sim-drill.protocol.json");
  // The drill only accepts SIM tool names (CR-01), but the lane harness fakes "stack-1" and
  // "fast-1". Run at the SIM defaults, then point the rows at the harness fakes.
  const HARNESS_TOOL: Record<string, string> = { "SIM-STACK": "stack-1", "SIM-FAST": "fast-1" };
  const toHarnessTools = (commands: Commands): Commands =>
    commands.map((c) => ({ ...c, toolId: HARNESS_TOOL[c.toolId] ?? c.toolId }));
  const defaultOf = (name: string) =>
    protocol.parameters.find((p) => p.name === name)?.defaultValue;

  it("is a script protocol that defaults to the simulated tools and refuses nothing at default", async () => {
    expect(protocol.mode).toBe("script");
    expect(defaultOf("stack_tool")).toBe("SIM-STACK");
    expect(defaultOf("fast_tool")).toBe("SIM-FAST");
    expect(protocol.scriptContent).toContain("LIV-02: the drill must not address a real tool");
    await runOk(protocol);
  });

  it("(a) default params emit note, SIM-STACK, SIM-FAST, SIM-STACK, SIM-STACK in order", async () => {
    const commands = await runOk(protocol);
    expect(commands.map((c) => `${c.toolId}:${c.command}`)).toEqual([
      "Tool Box:note",
      "SIM-STACK:transfer",
      "SIM-FAST:transfer",
      "SIM-STACK:transfer",
      "SIM-STACK:transfer",
    ]);
    const keys = commands
      .filter((c) => c.toolId === "SIM-STACK")
      .map((c) => String(prm(c).step_key));
    expect(keys.map((k) => k.slice(k.indexOf("-d-") + 1))).toEqual(["d-in1", "d-x1", "d-out1"]);
    expect(new Set(keys).size).toBe(3);
  });

  it("(b) lane fast only on SIM-FAST; barrier only on SIM-FAST and d-out1", async () => {
    const commands = await runOk(protocol);
    commands.forEach((c, i) => {
      if (c.toolId === "SIM-FAST") expect(adv(c).lane, `row ${i}`).toBe("fast");
      else expect("lane" in adv(c), `row ${i}`).toBe(false);
    });
    expect(commands.map((c) => adv(c).laneBarrier === true)).toEqual([
      false,
      false,
      true,
      false,
      true,
    ]);
    for (const c of commands) expect(adv(c).laneBarrier === false).toBe(false);
  });

  it("(c) validateLanes returns no refusal", async () => {
    const commands = await runOk(protocol);
    expect(validateLanes(laneInfos(commands) as never)).toEqual([]);
  });

  it("(d) a real tool name is refused before any galago call, in any spelling the queue resolves", async () => {
    // The queue looks tools up by normalizeToolKey (lowercase, non-alphanumerics stripped), so
    // every variant below resolves to the real STACK2-6 / FA100056 and must be refused (CR-01).
    for (const over of [
      { stack_tool: "STACK2-6" },
      { stack_tool: "stack2-6" },
      { fast_tool: "FA100056" },
      { fast_tool: "fa100056" },
      { stack_tool: "  STACK2-6  " },
      { stack_tool: "STACK_2-6" },
      { fast_tool: "FA-100056" },
      { stack_tool: "stack 2 6" },
      { fast_tool: "fa_100056" },
      { stack_tool: "stack 26", fast_tool: "FA-100056" },
    ]) {
      const result = await run(protocol, over as unknown as Record<string, string>);
      expect(result.success, JSON.stringify(over)).toBe(false);
      expect(result.error, JSON.stringify(over)).toContain(
        "LIV-02: the drill must not address a real tool",
      );
      expect(result.commands, JSON.stringify(over)).toEqual([]);
    }
  });

  it("(d2) only SIM tools are allowed: any other name is refused before any galago call", async () => {
    for (const over of [
      { stack_tool: "stack-1" },
      { fast_tool: "fast-1" },
      { stack_tool: "PF400" },
      { fast_tool: "Liquid Handler 2" },
      { stack_tool: "my-SIM-STACK" },
    ]) {
      const result = await run(protocol, over as unknown as Record<string, string>);
      expect(result.success, JSON.stringify(over)).toBe(false);
      expect(result.error, JSON.stringify(over)).toContain(
        "LIV-02: the drill addresses only tools whose name starts with SIM",
      );
      expect(result.commands, JSON.stringify(over)).toEqual([]);
    }
    for (const over of [
      {},
      { stack_tool: "SIM-STACK", fast_tool: "SIM-FAST" },
      { stack_tool: "sim_stack", fast_tool: "Sim Fast" },
    ]) {
      const result = await run(protocol, over as Record<string, string>);
      expect(result.error, JSON.stringify(over)).toBeUndefined();
      expect(result.success, JSON.stringify(over)).toBe(true);
    }
  });

  it("(e) end to end: d-x1 overlaps the F.A.S.T. step and d-out1 waits for it", async () => {
    const commands = toHarnessTools(await runOk(protocol));
    h = createLaneHarness();
    await h.push("d1", toLaneSteps(commands));
    const done = h.start();
    await h.tick(3);
    const dIn1 = indexOfCall(h, keyEndsWith("-d-in1"));
    expect(dIn1).toBeGreaterThanOrEqual(0);
    expect(indexOfCall(h, (c) => c.toolId === "fast-1")).toBe(-1);
    h.finish(dIn1);
    await h.tick(4);

    const fast = indexOfCall(h, (c) => c.toolId === "fast-1" && c.command === "transfer");
    const dX1 = indexOfCall(h, keyEndsWith("-d-x1"));
    expect(fast).toBeGreaterThanOrEqual(0);
    expect(dX1).toBeGreaterThanOrEqual(0);
    expect(h.calls()[fast].gate.isSettled()).toBe(false);
    expect(h.calls()[dX1].gate.isSettled()).toBe(false);

    h.finish(dX1);
    await h.tick(6);
    expect(indexOfCall(h, keyEndsWith("-d-out1"))).toBe(-1);

    h.finish(fast);
    await releaseAll(h);
    await done;

    expect(h.calls()).toHaveLength(4);
    expect(new Set(h.calls().map((c) => c.queueId)).size).toBe(4);
    const rows = await h.queue.commands.all();
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.status === "COMPLETED")).toBe(true);
  });

  it("(f) no STACK row carries a wait-budget key", async () => {
    const commands = await runOk(protocol);
    const stackRows = commands.filter((c) => c.toolId === "SIM-STACK");
    expect(stackRows).toHaveLength(3);
    for (const c of stackRows) {
      expect("timeout_s" in prm(c)).toBe(false);
      expect(Object.keys(prm(c)).some((k) => /timeout|wait/i.test(k))).toBe(false);
    }
  });
});
