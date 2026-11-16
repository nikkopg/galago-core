// Run-creation lane validation (08-07 Task 1): RunStore.createFromProtocol refuses an
// invalid lane setup with the exact UI-SPEC S2c sentences, both entry points map the
// refusal by Error.name (never instanceof), and with the flag off lane tags are inert
// and logged once. Harness copied from operatorOnly.test.ts: a chainable db fake serves
// the protocol row and a queue stub records enqueues without ever dispatching.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { logAction } from "@/server/logger";
import RunStore, { ProtocolGenerationFailedError } from "@/server/runs";
import { runRouter } from "@/server/routers/run";
import pagesApiRunsHandler from "@/pages/api/runs";

const { dbMock, fakeQueue } = vi.hoisted(() => {
  const dbMock: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  dbMock.select.mockImplementation(() => dbMock);
  dbMock.from.mockImplementation(() => dbMock);
  dbMock.where.mockImplementation(() => dbMock);
  const fakeQueue = {
    commands: { runPush: vi.fn(), push: vi.fn() },
    enqueueRun: vi.fn(),
    state: undefined,
    laneMode: true as boolean | undefined,
  };
  return { dbMock, fakeQueue };
});

vi.mock("@/db/client", () => ({ db: dbMock, sqlite: {} }));
vi.mock("@/server/runs", async (importOriginal) => {
  return await importOriginal<typeof import("@/server/runs")>();
});
vi.mock("@/server/scripting/protocol-script-executor", () => ({
  executeProtocolScript: vi.fn(),
}));
vi.mock("@/server/scripting/resolve-tool-types", () => ({
  resolveToolTypes: vi.fn(async (commands: unknown[]) => commands),
}));
vi.mock("@/server/command_queue", () => ({
  default: class {
    static get global() {
      return fakeQueue;
    }
  },
}));

const ROOT = path.resolve(__dirname, "..");

const NON_TOOL_SENTENCE =
  "Step 2 (note) is on lane 'fast', but only tool steps can run on a secondary lane. Move it to the primary lane.";

const step = (
  toolId: string,
  toolType: string,
  command: string,
  advancedParameters?: Record<string, unknown>,
) => ({
  toolId,
  toolType,
  command,
  params: {},
  ...(advancedParameters ? { advancedParameters } : {}),
});

// stack-1 primary, a Tool Box note on lane "fast", fast-1 on lane "fast" with a barrier.
const invalidSteps = () => [
  step("stack-1", "stack", "transfer"),
  step("Tool Box", "toolbox", "note", { lane: "fast" }),
  step("fast-1", "fast", "transfer", { lane: "fast", laneBarrier: true }),
];

// The valid headline shape: a barrier-opened secondary lane for the fast tool.
const validSteps = () => [
  step("stack-1", "stack", "transfer"),
  step("fast-1", "fast", "transfer", { lane: "fast", laneBarrier: true }),
  step("stack-1", "stack", "transfer"),
];

const untaggedSteps = () => [
  step("stack-1", "stack", "transfer"),
  step("fast-1", "fast", "transfer"),
];

const installProtocolRow = (id: number, commands: unknown[]) => {
  dbMock.limit.mockResolvedValueOnce([
    { id, name: `p-${id}`, mode: "visual", workcellId: 1, commands } as never,
  ]);
};

const logsFor = (action: string) =>
  vi.mocked(logAction).mock.calls.filter((c) => (c[0] as { action: string }).action === action);

beforeEach(() => {
  delete (globalThis as any)["__global_run_store_key"];
  dbMock.limit.mockReset();
  dbMock.limit.mockImplementation(async () => []);
  dbMock.select.mockImplementation(() => dbMock);
  dbMock.from.mockImplementation(() => dbMock);
  dbMock.where.mockImplementation(() => dbMock);
  fakeQueue.enqueueRun.mockReset();
  fakeQueue.laneMode = true;
  vi.mocked(logAction).mockClear();
});

afterEach(() => {
  delete (globalThis as any)["__global_run_store_key"];
});

describe("run-creation lane validation (D-17, LUI-03)", () => {
  it("refuses an invalid setup: LaneValidationError with the exact sentence, nothing stored or enqueued, one stage=create log", async () => {
    installProtocolRow(201, invalidSteps());

    let caught: unknown;
    try {
      await RunStore.global.createFromProtocol("201");
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe("LaneValidationError");
    expect((caught as Error).message).toContain(NON_TOOL_SENTENCE);
    expect(RunStore.global.all()).toHaveLength(0);
    expect(fakeQueue.enqueueRun).not.toHaveBeenCalled();

    const refused = logsFor("Lane Setup Refused");
    expect(refused).toHaveLength(1);
    expect(refused[0][0]).toMatchObject({ level: "warning" });
    expect(refused[0][0].details).toContain("stage=create");
    expect(refused[0][0].details).toContain("protocolId=201");
  });

  it("the operator-only refusal still wins when both apply (scan order unchanged)", async () => {
    installProtocolRow(202, [
      step("stack-1", "stack", "acknowledge_failure"),
      ...invalidSteps().slice(1),
    ]);

    await expect(RunStore.global.createFromProtocol("202")).rejects.toThrow(
      'Step 0 sends "acknowledge_failure" on tool "stack-1", which is an operator action',
    );
    expect(logsFor("Lane Setup Refused")).toHaveLength(0);
    expect(fakeQueue.enqueueRun).not.toHaveBeenCalled();
  });

  it("creates and enqueues a valid headline protocol once, with no refusal log", async () => {
    installProtocolRow(203, validSteps());

    const run = await RunStore.global.createFromProtocol("203");

    expect(run.commands).toHaveLength(3);
    expect(RunStore.global.all()).toHaveLength(1);
    expect(fakeQueue.enqueueRun).toHaveBeenCalledTimes(1);
    expect(logsFor("Lane Setup Refused")).toHaveLength(0);
    expect(logsFor("Lane Tags Ignored")).toHaveLength(0);
  });

  it("with lane mode off the same invalid protocol is created and enqueued, tags inert, and one 'Lane Tags Ignored' is logged", async () => {
    fakeQueue.laneMode = false;
    installProtocolRow(204, invalidSteps());

    const run = await RunStore.global.createFromProtocol("204");

    expect(run.commands).toHaveLength(3);
    expect(fakeQueue.enqueueRun).toHaveBeenCalledTimes(1);
    expect(logsFor("Lane Setup Refused")).toHaveLength(0);
    const ignored = logsFor("Lane Tags Ignored");
    expect(ignored).toHaveLength(1);
    expect(ignored[0][0]).toMatchObject({ level: "info" });
    expect(ignored[0][0].details).toContain("lane tags ignored: parallel lanes disabled");
  });

  it("a queue with no laneMode member at all behaves as flag off", async () => {
    fakeQueue.laneMode = undefined;
    installProtocolRow(205, invalidSteps());

    await RunStore.global.createFromProtocol("205");

    expect(fakeQueue.enqueueRun).toHaveBeenCalledTimes(1);
    expect(logsFor("Lane Tags Ignored")).toHaveLength(1);
  });

  it("with lane mode off an untagged protocol logs no 'Lane Tags Ignored'", async () => {
    fakeQueue.laneMode = false;
    installProtocolRow(206, untaggedSteps());

    await RunStore.global.createFromProtocol("206");

    expect(logsFor("Lane Tags Ignored")).toHaveLength(0);
    expect(fakeQueue.enqueueRun).toHaveBeenCalledTimes(1);
  });

  it("an untagged protocol with lane mode on is created with no lane logs", async () => {
    installProtocolRow(207, untaggedSteps());

    await RunStore.global.createFromProtocol("207");

    expect(logsFor("Lane Tags Ignored")).toHaveLength(0);
    expect(logsFor("Lane Setup Refused")).toHaveLength(0);
    expect(fakeQueue.enqueueRun).toHaveBeenCalledTimes(1);
  });

  it("rethrows a plain Error named LaneValidationError from another module copy unchanged (name guard, not wrapped)", async () => {
    const { executeProtocolScript } = await import("@/server/scripting/protocol-script-executor");
    const foreign = new Error("foreign copy refusal");
    foreign.name = "LaneValidationError";
    vi.mocked(executeProtocolScript).mockRejectedValueOnce(foreign);
    dbMock.limit.mockResolvedValueOnce([
      { id: 208, name: "s", mode: "script", scriptContent: "X", workcellId: 1 } as never,
    ]);

    let caught: unknown;
    try {
      await RunStore.global.createFromProtocol("208");
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(foreign);
    expect(caught).not.toBeInstanceOf(ProtocolGenerationFailedError);
  });
});

describe("entry-point mappings (UI-SPEC E3/error)", () => {
  it("run.create maps the refusal to BAD_REQUEST with the same message", async () => {
    installProtocolRow(211, invalidSteps());

    let caught: unknown;
    try {
      await runRouter.createCaller({}).create({ protocolId: 211 });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(TRPCError);
    const err = caught as TRPCError;
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toContain(NON_TOOL_SENTENCE);
    expect(err.message).not.toContain("Could not generate commands for the given params.");
    expect(RunStore.global.all()).toHaveLength(0);
  });

  it("POST /api/runs responds 400 with the message", async () => {
    installProtocolRow(212, invalidSteps());

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    };

    await pagesApiRunsHandler(
      { method: "POST", body: { protocolId: "212" } } as never,
      res as never,
    );
    for (let i = 0; i < 50 && res.status.mock.calls.length === 0; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining(NON_TOOL_SENTENCE));
    expect(res.status).not.toHaveBeenCalledWith(500);
  });
});

describe("LaneValidationError name-guard source pin (Phase 4 lesson)", () => {
  it("never uses instanceof for LaneValidationError and keeps the guard call sites", () => {
    const routerSrc = fs.readFileSync(path.join(ROOT, "server/routers/run.ts"), "utf-8");
    const runsSrc = fs.readFileSync(path.join(ROOT, "server/runs.ts"), "utf-8");
    const apiSrc = fs.readFileSync(path.join(ROOT, "pages/api/runs/index.ts"), "utf-8");
    const identity = /instanceof\s+LaneValidationError\b/;

    expect(routerSrc).not.toMatch(identity);
    expect(runsSrc).not.toMatch(identity);
    expect(apiSrc).not.toMatch(identity);

    expect(routerSrc).toContain("isLaneValidationError(e)");
    expect(runsSrc).toContain("isLaneValidationError(error)");
    expect(apiSrc).toContain('case "LaneValidationError"');
  });
});
