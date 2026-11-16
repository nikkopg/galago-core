// Script API for lanes (08-07 Task 2): galago.lane(name) and the per-call
// { lane, barrier } option write advancedParameters.lane / laneBarrier only when set,
// Tool Box helpers never inherit the sticky lane, protocol.preview reports
// laneWarnings, and both compose files document GALAGO_PARALLEL_LANES.
import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { executeProtocolScript } from "@/server/scripting/protocol-script-executor";
import { CommandQueue } from "@/server/command_queue";
import { protocolRouter } from "@/server/routers/protocol";

vi.mock("@/server/scripting/resolve-tool-types", () => ({
  resolveToolTypes: vi.fn(async (commands: unknown[]) => commands),
}));

const GLOBAL_KEY = "__global_command_queue_key";
const DEFAULT_ADVANCED = {
  skipExecutionVariable: { variable: null, value: "" },
  runAsynchronously: false,
};

async function run(script: string) {
  const result = await executeProtocolScript(script, {});
  expect(result.success).toBe(true);
  return result.commands;
}

const advanced = (c: { advancedParameters?: unknown }) =>
  c.advancedParameters as Record<string, unknown>;

describe("galago.lane and per-call lane options (D-19, LUI-02)", () => {
  it("a script with no lane calls yields byte-identical advancedParameters (no lane keys)", async () => {
    const commands = await run('galago.command("stack-1", "transfer", { a: 1 });');
    expect(commands).toHaveLength(1);
    expect(commands[0].advancedParameters).toStrictEqual(DEFAULT_ADVANCED);
    expect(Object.keys(advanced(commands[0]))).toStrictEqual([
      "skipExecutionVariable",
      "runAsynchronously",
    ]);
  });

  it("galago.lane sets a sticky normalised lane; per-call barrier writes laneBarrier only where true", async () => {
    const commands = await run(
      'galago.lane("Fast"); galago.command("fast-1", "transfer", {}, { barrier: true }); galago.command("fast-1", "transfer");',
    );
    expect(commands).toHaveLength(2);
    expect(advanced(commands[0]).lane).toBe("fast");
    expect(advanced(commands[0]).laneBarrier).toBe(true);
    expect(advanced(commands[1]).lane).toBe("fast");
    expect("laneBarrier" in advanced(commands[1])).toBe(false);
    expect(advanced(commands[0]).runAsynchronously).toBe(false);
  });

  it("Tool Box helpers never inherit the sticky lane", async () => {
    const commands = await run(
      'galago.lane("fast"); galago.note("hi"); galago.pause(); galago.timer(); galago.showMessage("m"); galago.assignVariable("a", "b"); galago.userForm("f");',
    );
    expect(commands).toHaveLength(6);
    for (const c of commands) {
      expect(c.toolId).toBe("Tool Box");
      expect(c.advancedParameters).toStrictEqual(DEFAULT_ADVANCED);
    }
  });

  it("galago.lane() with no argument or 'primary' resets the sticky lane", async () => {
    for (const reset of ["galago.lane();", 'galago.lane("primary");', 'galago.lane("  ");']) {
      const commands = await run(
        `galago.lane("fast"); ${reset} galago.command("stack-1", "transfer");`,
      );
      expect(commands).toHaveLength(1);
      expect(commands[0].advancedParameters).toStrictEqual(DEFAULT_ADVANCED);
    }
  });

  it("a per-call lane overrides the sticky lane for that call only", async () => {
    const commands = await run(
      'galago.lane("fast"); galago.command("a-1", "x", {}, { lane: "side" }); galago.command("b-1", "x");',
    );
    expect(advanced(commands[0]).lane).toBe("side");
    expect(advanced(commands[1]).lane).toBe("fast");
  });

  it("a per-call lane 'primary' writes no lane key even under a sticky lane; barrier false writes no laneBarrier", async () => {
    const commands = await run(
      'galago.lane("fast"); galago.command("a-1", "x", {}, { lane: "primary", barrier: false });',
    );
    expect(commands[0].advancedParameters).toStrictEqual(DEFAULT_ADVANCED);
  });

  it("lane and laneBarrier keys are never written as undefined, empty or false", async () => {
    const commands = await run(
      'galago.command("a-1", "x", {}, { lane: "", barrier: false }); galago.command("b-1", "x", {}, {});',
    );
    for (const c of commands) {
      const keys = Object.keys(advanced(c));
      expect(keys).not.toContain("lane");
      expect(keys).not.toContain("laneBarrier");
    }
  });
});

describe("protocol.preview laneWarnings (D-17, D-26, LUI-04)", () => {
  afterEach(() => {
    delete (globalThis as any)[GLOBAL_KEY];
  });

  const installQueue = (parallelLanes: boolean) => {
    (globalThis as any)[GLOBAL_KEY] = new CommandQueue({} as any, { parallelLanes });
  };

  const preview = (scriptContent: string) =>
    protocolRouter.createCaller({}).preview({ scriptContent, workcellId: 1 });

  const taggedNote = 'galago.command("Tool Box", "note", { message: "x" }, { lane: "fast" });';

  it("with lane mode on, a non-tool step on a secondary lane yields the S2c sentence", async () => {
    installQueue(true);
    const result = await preview(taggedNote);
    expect(result.laneWarnings).toContain(
      "Step 1 (note) is on lane 'fast', but only tool steps can run on a secondary lane. Move it to the primary lane.",
    );
  });

  it("with lane mode off and any tag, exactly the single inert line", async () => {
    installQueue(false);
    const result = await preview(taggedNote);
    expect(result.laneWarnings).toStrictEqual(["lane tags ignored: parallel lanes disabled"]);
  });

  it("an untagged script gives [] in both modes", async () => {
    const script = 'galago.command("stack-1", "transfer");';
    installQueue(true);
    expect((await preview(script)).laneWarnings).toStrictEqual([]);
    installQueue(false);
    expect((await preview(script)).laneWarnings).toStrictEqual([]);
  });

  it("a failing script gives []", async () => {
    installQueue(true);
    const result = await preview('throw new Error("boom");');
    expect(result.success).toBe(false);
    expect(result.laneWarnings).toStrictEqual([]);
  });
});

describe("compose documents the flag (D-06)", () => {
  const ROOT = path.resolve(__dirname, "../..");
  for (const file of ["docker-compose.yml", "docker-compose.dev.yml"]) {
    it(`${file} lists GALAGO_PARALLEL_LANES defaulting to empty`, () => {
      const text = fs.readFileSync(path.join(ROOT, file), "utf-8");
      expect(text).toContain("- GALAGO_PARALLEL_LANES=${GALAGO_PARALLEL_LANES:-}");
    });
  }
});
