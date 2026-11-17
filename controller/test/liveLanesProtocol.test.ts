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

const EVENT_OVERRIDES = {
  stack_tool: "stack-1",
  fast_tool: "fast-1",
  batch_label: "LIVTEST",
  spare_a_device: "spare-dev-a",
  spare_a_deck: "deck1",
  spare_a_nest: "A1",
  spare_b_device: "spare-dev-b",
  spare_b_deck: "deck1",
  spare_b_nest: "A1",
};

describe("event-1 protocol (D-01, D-04, D-06)", () => {
  const protocol = loadProtocol("09-live-lanes-event1.protocol.json");

  it("is a script protocol with the cycle, tool and spare parameters", () => {
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
    ]) {
      expect(names).toContain(n);
    }
    for (const p of protocol.parameters.filter((q) => q.name.startsWith("spare_"))) {
      expect(p.defaultValue, p.name).toBe("");
    }
    expect(protocol.scriptContent).toContain('galago.lane("fast")');
    expect(protocol.scriptContent).toContain("get_transfer_estimate");
  });

  it("(a) emits exactly note, in1, in2, F.A.S.T., estimate, out1, out2", async () => {
    const commands = await runOk(protocol, EVENT_OVERRIDES);
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
    const commands = await runOk(protocol, EVENT_OVERRIDES);
    commands.forEach((c, i) => {
      if (c.toolId === "fast-1") expect(adv(c).lane, `row ${i}`).toBe("fast");
      else expect("lane" in adv(c), `row ${i}`).toBe(false);
    });
    const barriers = commands.map((c) => adv(c).laneBarrier === true);
    expect(barriers).toEqual([false, false, false, true, false, true, false]);
    for (const c of commands) expect(adv(c).laneBarrier === false).toBe(false);
  });

  it("(c) validateLanes returns no refusal", async () => {
    const commands = await runOk(protocol, EVENT_OVERRIDES);
    expect(validateLanes(laneInfos(commands) as never)).toEqual([]);
  });

  it("(d) the four STACK transfer keys share one base, end in -in1/-in2/-out1/-out2 and are disjoint across runs", async () => {
    const first = stackKeys(await runOk(protocol, EVENT_OVERRIDES));
    const second = stackKeys(await runOk(protocol, EVENT_OVERRIDES));
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

  it("(e) the estimate carries spare A to spare B and no step_key or timeout_s", async () => {
    const commands = await runOk(protocol, EVENT_OVERRIDES);
    const est = commands.find((c) => c.command === "get_transfer_estimate")!;
    const p = prm(est);
    expect("step_key" in p).toBe(false);
    expect("timeout_s" in p).toBe(false);
    expect(p).toEqual({
      robot: "stack2-6",
      labware_profile: "Default",
      source_device: "spare-dev-a",
      source_deck: "deck1",
      source_nest: "A1",
      destination_device: "spare-dev-b",
      destination_deck: "deck1",
      destination_nest: "A1",
    });
  });

  it("(e2) optional spare transfer profiles are sent only when non-blank", async () => {
    const commands = await runOk(protocol, {
      ...EVENT_OVERRIDES,
      spare_a_transfer_profile: "Default",
      spare_b_transfer_profile: "Default",
    });
    const p = prm(commands.find((c) => c.command === "get_transfer_estimate")!);
    expect(p.source_transfer_profile).toBe("Default");
    expect(p.destination_transfer_profile).toBe("Default");
  });

  it("(f) Edge LIV-01/empty: a blank spare_a_nest throws before any galago call", async () => {
    const result = await run(protocol, { ...EVENT_OVERRIDES, spare_a_nest: "" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("spare_a_nest");
    expect(result.commands).toEqual([]);
  });

  it("(g) Edge LIV-01/adjacency and D-02: unsafe spares are refused with the guard sentence", async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [
        { spare_b_device: "spare-dev-a", spare_b_deck: "deck1", spare_b_nest: "A1" },
        "LIV-01: spare A and spare B must differ",
      ],
      [
        { spare_a_device: "nest-1", spare_a_deck: "deck1", spare_a_nest: "A1" },
        "LIV-01: a spare nest must not be a plate home",
      ],
      [
        { spare_b_device: "nest-2", spare_b_deck: "deck`", spare_b_nest: "A1" },
        "LIV-01: a spare nest must not be a plate home",
      ],
      [
        { spare_a_device: "fa100056", spare_a_deck: "trayX", spare_a_nest: "9" },
        "LIV-01: a spare nest must not be on the F.A.S.T.-side device",
      ],
    ];
    for (const [over, sentence] of cases) {
      const result = await run(protocol, { ...EVENT_OVERRIDES, ...over });
      expect(result.success, sentence).toBe(false);
      expect(result.error).toContain(sentence);
      expect(result.commands).toEqual([]);
    }
  });

  it("(h) end to end: the estimate overlaps the F.A.S.T. leg, out1 waits for it, every queueId is sent once", async () => {
    const commands = await runOk(protocol, EVENT_OVERRIDES);
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
