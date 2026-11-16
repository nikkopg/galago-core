// LAN-01 / D-09 golden transcript of the flag-off queue. Fakes only; no
// instrument can move. The fixture was captured once at the commit named in
// fixtures/lanesFlagOff.golden.ts, before any Phase 8 production edit, and is
// frozen: this file only reads it. The same transcripts must come out of three
// constructions (env unset, parallelLanes false, parallelLanes true with an
// untagged protocol) because an untagged protocol is byte-identical (D-07).
import { describe, it, expect, vi, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { logAction } from "@/server/logger";
import { logger } from "@/logger";
import { installFakeTool, removeFakeTool, deferred } from "./helpers/fakeTool";
import { GOLDEN_TRANSCRIPTS } from "./fixtures/lanesFlagOff.golden";

interface Transcript {
  actions: Array<{ level: string; action: string; details: string }>;
  states: string[];
  dispatched: Array<{ toolId: string; command: string; params: unknown }>;
  grpcSends: unknown[];
  midStep: { runningStep: unknown; runState: unknown } | null;
  rows: Array<{ queueId: number; runId: string; status: string }>;
  error: string | null;
}

const GLOBAL_KEY = "__global_command_queue_key";

// Nobody may regenerate the golden: a re-capture would hide a flag-off regression.
if (process.env.GOLDEN_WRITE === "1") {
  throw new Error("golden capture is frozen after 08-01 (D-09)");
}

const OK = { response: ResponseCode.SUCCESS, return_reply: true };
const STATUS_REPLY = {
  response: ResponseCode.SUCCESS,
  run_state: { state: "RUNNING", percent: 40, pause: null },
} as any;

function row(runId: string, toolId: string, toolType: ToolType, command: string, params: any) {
  return { runId, status: "CREATED", commandInfo: { toolId, toolType, command, params } } as any;
}
const toolBox = (runId: string, command: string, params: any = {}) =>
  row(runId, "Tool Box", ToolType.toolbox, command, params);
const stack = (runId: string, tag: string) =>
  row(runId, "stack-1", ToolType.stack, "transfer", { tag });
const fast = (runId: string, tag: string) =>
  row(runId, "fast-1", ToolType.fast, "transfer", { tag });

interface Ctx {
  queue: CommandQueue;
  /** Start the queue as the operator would; tracked so the harness can await it. */
  start: () => Promise<void>;
  /** Advance fake time in 100 ms steps until cond() holds. */
  until: (cond: () => boolean) => Promise<void>;
  /** Advance fake time until the promise has settled. */
  settle: (p: Promise<unknown>) => Promise<void>;
  /** Make the nth call (0-based) of a fake tool's executeCommand return this promise. */
  hold: (toolId: string, nth: number, p: Promise<unknown>) => void;
  /** Make the nth call (0-based) of a fake tool's executeCommand return this reply. */
  reply: (toolId: string, nth: number, reply: unknown) => void;
  push: (...rows: any[]) => Promise<void>;
  midStep: { runningStep: unknown; runState: unknown } | null;
  record: () => void;
}

async function runScenario(
  makeQueue: () => CommandQueue,
  body: (ctx: Ctx) => Promise<void>,
): Promise<Transcript> {
  vi.mocked(logAction).mockClear();
  vi.mocked(logger.info).mockClear();

  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

  const queue = makeQueue();
  queue.slackNotificationsEnabled = false;
  (globalThis as any)[GLOBAL_KEY] = queue;

  const grpcSends: unknown[] = [];
  const overrides = new Map<string, unknown>();
  const callCount: Record<string, number> = { "stack-1": 0, "fast-1": 0 };
  const fakes = {
    "stack-1": installFakeTool("stack-1", ToolType.stack),
    "fast-1": installFakeTool("fast-1", ToolType.fast),
  };
  for (const [toolId, fake] of Object.entries(fakes)) {
    fake.grpc.getStatus.mockResolvedValue(STATUS_REPLY);
    fake.grpc.executeCommand.mockImplementation(async (payload: unknown) => {
      grpcSends.push(payload);
      const nth = callCount[toolId]++;
      const key = `${toolId}#${nth}`;
      return overrides.has(key) ? overrides.get(key) : OK;
    });
  }

  const dispatched: Transcript["dispatched"] = [];
  const realExecute = Tool.executeCommand.bind(Tool);
  vi.spyOn(Tool, "executeCommand").mockImplementation(async (info) => {
    dispatched.push({ toolId: info.toolId, command: info.command, params: info.params });
    return realExecute(info);
  });

  const loops: Array<Promise<void>> = [];

  const ctx: Ctx = {
    queue,
    midStep: null,
    start: () => {
      const p = queue._start();
      loops.push(p);
      return p;
    },
    until: async (cond) => {
      for (let i = 0; i < 400; i++) {
        if (cond()) return;
        await vi.advanceTimersByTimeAsync(100);
      }
      throw new Error("scenario condition was not reached in 40 s of fake time");
    },
    settle: async (p) => {
      let done = false;
      void p.then(
        () => (done = true),
        () => (done = true),
      );
      await ctx.until(() => done);
    },
    hold: (toolId, nth, p) => {
      overrides.set(`${toolId}#${nth}`, p);
    },
    reply: (toolId, nth, reply) => {
      overrides.set(`${toolId}#${nth}`, reply);
    },
    push: async (...rows) => {
      for (const r of rows) await queue.commands.push(r);
    },
    record: () => {
      ctx.midStep = JSON.parse(
        JSON.stringify({ runningStep: queue.runningStep ?? null, runState: queue.runState }),
      );
    },
  };

  try {
    await body(ctx);
  } finally {
    await vi.advanceTimersByTimeAsync(15000);
    await Promise.all(loops);
    vi.useRealTimers();
    await new Promise((resolve) => setImmediate(resolve));
  }

  const actions = vi
    .mocked(logAction)
    .mock.calls.map(([entry]) => entry as { level: string; action: string; details: string })
    .map(({ level, action, details }) => ({ level, action, details }));
  const states = vi
    .mocked(logger.info)
    .mock.calls.map(([first]) => first as unknown)
    .filter(
      (first): first is string =>
        typeof first === "string" && first.startsWith("CommandQueue state:"),
    );
  const rows = (await queue.commands.all())
    .map((r) => ({ queueId: r.queueId, runId: r.runId, status: r.status as string }))
    .sort((a, b) => a.queueId - b.queueId);

  const transcript: Transcript = JSON.parse(
    JSON.stringify({
      actions,
      states,
      dispatched,
      grpcSends,
      midStep: ctx.midStep,
      rows,
      error: queue.error?.message ?? null,
    }),
  );

  await removeFakeTool("stack-1");
  await removeFakeTool("fast-1");
  delete (globalThis as any)[GLOBAL_KEY];
  vi.restoreAllMocks();
  return transcript;
}

const SCENARIOS: Record<string, (ctx: Ctx) => Promise<void>> = {
  // Edge LAN-01/empty: Start on an empty queue.
  S0: async ({ start }) => {
    const p = start();
    await vi.advanceTimersByTimeAsync(1500);
    await vi.advanceTimersByTimeAsync(1500);
    await p;
  },

  // Mixed Tool Box + tool run.
  S1: async (ctx) => {
    const { queue } = ctx;
    const held = deferred<any>();
    // The first fast-1 call is held until the scenario releases it.
    ctx.hold("fast-1", 0, held.promise);
    await ctx.push(
      toolBox("run-1", "note", { message: "note" }),
      stack("run-1", "a"),
      toolBox("run-1", "pause", { message: "Check the plate" }),
      fast("run-1", "b"),
      toolBox("run-1", "show_message", { message: "Plates placed", title: "Message" }),
      stack("run-1", "c"),
    );

    const p = ctx.start();
    await ctx.until(() => queue.isWaitingForInput);
    queue.resume();
    await ctx.until(() => queue.runningStep?.toolId === "fast-1");
    await vi.advanceTimersByTimeAsync(2100);
    ctx.record();
    held.resolve(OK);
    await ctx.until(() => queue.isWaitingForInput);
    queue.resume();
    await ctx.settle(p);
  },

  // A step fails with INVALID_ARGUMENTS, clearError, then an operator Start retries it.
  S2: async (ctx) => {
    const { queue } = ctx;
    ctx.reply("stack-1", 0, {
      response: ResponseCode.INVALID_ARGUMENTS,
      error_message: "bad nest",
    });
    await ctx.push(stack("run-2", "f1"), stack("run-2", "f2"));

    const p1 = ctx.start();
    await ctx.until(() => queue.state === ToolStatus.FAILED);
    await ctx.settle(p1);
    await queue.clearError();
    const p2 = ctx.start();
    await ctx.settle(p2);
  },

  // Pause queue while a step is in flight, an ignored Start, then a Start after the step ends.
  S3: async (ctx) => {
    const { queue } = ctx;
    const held = deferred<any>();
    ctx.hold("fast-1", 0, held.promise);
    await ctx.push(fast("run-3", "p1"), stack("run-3", "p2"));

    const p1 = ctx.start();
    await ctx.until(() => queue.runningStep?.toolId === "fast-1");
    const stopP = queue.stop();
    await queue._start();
    held.resolve(OK);
    await ctx.settle(p1);
    await ctx.settle(stopP);
    const p2 = ctx.start();
    await ctx.settle(p2);
  },
};

const CONSTRUCTIONS: Array<[string, () => CommandQueue]> = [
  ["env unset", () => new CommandQueue({} as any)],
  ["parallelLanes false", () => new CommandQueue({} as any, { parallelLanes: false })],
  [
    "parallelLanes true, untagged protocol",
    () => new CommandQueue({} as any, { parallelLanes: true }),
  ],
];

describe("LAN-01 golden transcript (flag off)", () => {
  for (const [construction, makeQueue] of CONSTRUCTIONS) {
    describe(construction, () => {
      for (const name of Object.keys(SCENARIOS)) {
        it(`${name} matches the golden transcript`, async () => {
          const transcript = await runScenario(makeQueue, SCENARIOS[name]);
          // Ordered arrays of actions, state transitions, dispatches and gRPC payloads:
          // a reordering in any construction fails.
          expect(transcript).toStrictEqual(GOLDEN_TRANSCRIPTS[name]);
        });
      }
    });
  }
});

describe("lane-mode flag (D-06)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only exactly '1' turns lane mode on", () => {
    vi.stubEnv("GALAGO_PARALLEL_LANES", "1");
    expect(new CommandQueue({} as any).laneMode).toBe(true);
  });

  it.each(["0", "", "true", " 1", "1 "])("%j leaves lane mode off", (value) => {
    vi.stubEnv("GALAGO_PARALLEL_LANES", value);
    expect(new CommandQueue({} as any).laneMode).toBe(false);
  });

  it("an unset variable leaves lane mode off", () => {
    vi.stubEnv("GALAGO_PARALLEL_LANES", "1");
    delete process.env.GALAGO_PARALLEL_LANES;
    expect(new CommandQueue({} as any).laneMode).toBe(false);
  });

  it("an explicit option overrides the environment both ways", () => {
    vi.stubEnv("GALAGO_PARALLEL_LANES", "1");
    expect(new CommandQueue({} as any, { parallelLanes: false }).laneMode).toBe(false);
    vi.stubEnv("GALAGO_PARALLEL_LANES", "0");
    expect(new CommandQueue({} as any, { parallelLanes: true }).laneMode).toBe(true);
  });
});
