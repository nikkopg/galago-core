// Operator-only command guard: one zero-import table (server/operatorOnlyCommands.ts)
// enforced at the two locked points. This file covers the execute-time guard
// (D-02a) end-to-end from the Tool instance and the tRPC runCommand caller with
// a stack fake, plus the pure-module pins and the operator-path carve-out
// (controlCommand is never guarded).
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { toolRouter } from "@/server/routers/tool";
import { logAction } from "@/server/logger";
import {
  operatorOnlyCommands,
  isOperatorOnlyCommand,
  OperatorOnlyCommandError,
} from "@/server/operatorOnlyCommands";
import { installFakeTool, removeFakeTool, FakeGrpc } from "./helpers/fakeTool";
import RunStore, { ProtocolGenerationFailedError } from "@/server/runs";
import { runRouter } from "@/server/routers/run";
import { TRPCError } from "@trpc/server";
import pagesApiRunsHandler from "@/pages/api/runs";

// Task 2 (enqueue) harness: real RunStore runs the guard against a protocol
// row served by a chainable in-memory db fake; the queue stub records
// enqueues without ever dispatching.
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

describe("operatorOnlyCommands map (D-01, D-04)", () => {
  it("has exactly the stack + fast shape, deep-frozen, declared once", () => {
    expect(operatorOnlyCommands).toStrictEqual({
      stack: ["acknowledge_failure"],
      fast: ["pause", "resume", "abort"],
    });
    expect(Object.keys(operatorOnlyCommands)).toStrictEqual(["stack", "fast"]);
    expect(Object.isFrozen(operatorOnlyCommands)).toBe(true);
    expect(Object.isFrozen(operatorOnlyCommands.stack)).toBe(true);
    expect(Object.isFrozen(operatorOnlyCommands.fast)).toBe(true);
  });

  it("refuses listed commands case/whitespace-insensitively and nothing else", () => {
    expect(isOperatorOnlyCommand("stack", "acknowledge_failure")).toBe(true);
    expect(isOperatorOnlyCommand("stack", " ACKNOWLEDGE_FAILURE ")).toBe(true);
    expect(isOperatorOnlyCommand("stack", "Acknowledge_Failure")).toBe(true);
    expect(isOperatorOnlyCommand("stack", "  acknowledge_failure\t")).toBe(true);

    expect(isOperatorOnlyCommand("stack", "transfer")).toBe(false);
    expect(isOperatorOnlyCommand("stack", "  ack")).toBe(false); // not equal after trim — deny-by-list
    expect(isOperatorOnlyCommand("stack", "")).toBe(false);

    expect(isOperatorOnlyCommand("fast", "pause")).toBe(true);
    expect(isOperatorOnlyCommand("fast", "resume")).toBe(true);
    expect(isOperatorOnlyCommand("fast", "abort")).toBe(true);
    expect(isOperatorOnlyCommand("fast", "transfer")).toBe(false);
    expect(isOperatorOnlyCommand("pf400", "pause")).toBe(false);
    expect(isOperatorOnlyCommand("unknown", "acknowledge_failure")).toBe(false);
  });

  it("resolves lookups by own property only — inherited and prototype keys never match (D-04)", () => {
    for (const inherited of ["toString", "constructor", "__proto__"]) {
      expect(isOperatorOnlyCommand(inherited, "acknowledge_failure")).toBe(false);
      expect(isOperatorOnlyCommand("stack", inherited)).toBe(false);
      expect(isOperatorOnlyCommand(inherited, inherited)).toBe(false);
    }
    // Own-property lookups never write through inherited keys
    expect(Object.keys(operatorOnlyCommands)).toStrictEqual(["stack", "fast"]);
    expect(Object.getPrototypeOf(Object.getPrototypeOf(operatorOnlyCommands.fast))).toBe(
      Object.prototype,
    );
  });

  it("OperatorOnlyCommandError is a plain uncoded Error with its own name (D-03)", () => {
    const err = new OperatorOnlyCommandError('"x" on tool "y" is an operator action');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("OperatorOnlyCommandError");
    expect((err as unknown as { code?: unknown }).code).toBeUndefined();
    expect(err.message).toContain("is an operator action");
  });
});

describe("operator-only execute-time guard (D-02a)", () => {
  let grpc: FakeGrpc;
  let fastGrpc: FakeGrpc;

  afterEach(async () => {
    for (const id of ["stack-1", "fast-1"]) {
      await removeFakeTool(id);
    }
    vi.restoreAllMocks();
  });

  it("refuses stack.acknowledge_failure at the Tool instance with zero gRPC and an audited warning (OPR-04 execute)", async () => {
    const fake = installFakeTool("stack-1", "stack" as ToolType);
    grpc = fake.grpc;

    await expect(
      fake.tool.executeCommand({
        toolId: "stack-1",
        toolType: "stack" as unknown as ToolType,
        command: "acknowledge_failure",
        params: {},
      }),
    ).rejects.toThrow(/is an operator action/);

    expect(grpc.executeCommand).toHaveBeenCalledTimes(0); // zero sends — the physical tool is never reached
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warning",
        action: "Operator-Only Command Refused",
      }),
    );
    const details = vi.mocked(logAction).mock.calls[0][0].details;
    expect(details).toContain("stage=execute");
    expect(details).toContain("command=acknowledge_failure");
    expect(details).toContain("toolId=stack-1");
  });

  it("refuses through the tRPC runCommand caller too — the caller's claimed toolType never rescues it", async () => {
    const fake = installFakeTool("stack-1", "stack" as ToolType);
    grpc = fake.grpc;
    const caller = toolRouter.createCaller({});

    await expect(
      caller.runCommand({
        toolId: "stack-1",
        toolType: ToolType.fast, // caller claims fast; the instance's real type is what matters
        command: "acknowledge_failure",
        params: {},
      }),
    ).rejects.toThrow(/is an operator action/);

    expect(grpc.executeCommand).toHaveBeenCalledTimes(0);
  });

  it("keys on the Tool instance's real type — a mislabelled command.toolType is still refused (anti-pattern: keying on command.toolType)", async () => {
    const fake = installFakeTool("stack-1", "stack" as ToolType);
    grpc = fake.grpc;

    await expect(
      fake.tool.executeCommand({
        toolId: "stack-1",
        toolType: ToolType.unknown, // stored JSON mislabels it as unknown
        command: "acknowledge_failure",
        params: {},
      }),
    ).rejects.toThrow(/is an operator action/);

    expect(grpc.executeCommand).toHaveBeenCalledTimes(0);
  });

  it("is deny-by-listed, not deny-all: a F.A.S.T. transfer executes normally", async () => {
    const fake = installFakeTool("fast-1", ToolType.fast);
    fastGrpc = fake.grpc;
    fastGrpc.executeCommand.mockResolvedValue({
      response: ResponseCode.SUCCESS,
      return_reply: true,
    });

    const reply = await fake.tool.executeCommand({
      toolId: "fast-1",
      toolType: ToolType.fast,
      command: "transfer",
      params: {},
    });

    expect(fastGrpc.executeCommand).toHaveBeenCalledTimes(1);
    expect(fastGrpc.executeCommand).toHaveBeenCalledWith({
      fast: { transfer: {} },
    });
    expect(reply).toMatchObject({ return_reply: true });
  });

  it("never touches controlCommand — the operator path sends exactly one unguarded gRPC (D-02 carve-out)", async () => {
    const fake = installFakeTool("stack-1", "stack" as ToolType);
    grpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({
      response: ResponseCode.SUCCESS,
      error_message: undefined,
    });

    const result = await fake.tool.controlCommand("acknowledge_failure", {
      guid: "g",
      arm_inspected: "yes",
    });

    expect(result).toEqual({
      ok: true,
      response: ResponseCode.SUCCESS,
      message: undefined,
    });
    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
    expect(grpc.executeCommand).toHaveBeenCalledWith({
      stack: { acknowledge_failure: { guid: "g", arm_inspected: "yes" } },
    });
  });
});

describe("operator-only enqueue refusal (D-02b)", () => {
  beforeEach(() => {
    delete (globalThis as any)["__global_run_store_key"];
    dbMock.limit.mockReset();
    dbMock.limit.mockImplementation(async () => []);
    // vi.restoreAllMocks() in the execute-time suite's afterEach wipes these
    // implementations — re-establish the chainable db fake for every test.
    dbMock.select.mockImplementation(() => dbMock);
    dbMock.from.mockImplementation(() => dbMock);
    dbMock.where.mockImplementation(() => dbMock);
  });

  afterEach(async () => {
    for (const id of ["stack-1", "fast-1"]) {
      await removeFakeTool(id);
    }
    delete (globalThis as any)["__global_run_store_key"];
    delete (globalThis as any)["__global_command_queue_key"];
  });

  const installProtocolRow = (row: Record<string, unknown>) => {
    dbMock.limit.mockResolvedValueOnce([row as never]);
  };

  it("refuses a visual protocol whose step list contains a stack acknowledge at create time: own Step-N message, run not stored, nothing enqueued, one stage=enqueue audit (OPR-04 enqueue)", async () => {
    installProtocolRow({
      id: 101,
      name: "visual-ack",
      mode: "visual",
      workcellId: 1,
      commands: [
        { toolId: "stack-1", toolType: "stack", command: "acknowledge_failure", params: {} },
        { toolId: "fast-1", toolType: "fast", command: "transfer", params: {} },
      ],
    });

    await expect(RunStore.global.createFromProtocol("101")).rejects.toThrow(
      'Step 0 sends "acknowledge_failure" on tool "stack-1", which is an operator action',
    );

    expect(RunStore.global.all()).toHaveLength(0); // the run is NOT stored as runnable
    expect(fakeQueue.enqueueRun).toHaveBeenCalledTimes(0); // nothing enqueued, zero sends

    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warning",
        action: "Operator-Only Command Refused",
      }),
    );
    const details = vi.mocked(logAction).mock.calls[0][0].details;
    expect(details).toContain("stage=enqueue");
    expect(details).toContain("protocolId=101");
    expect(details).toContain("step=0");
    expect(details).toContain("toolId=stack-1");
    expect(details).toContain("toolType=stack"); // declared type is the cheap early layer; execute is the backstop
  });

  it("refuses a script protocol whose resolveToolTypes-filled steps contain a stack acknowledge identically", async () => {
    const { executeProtocolScript } = await import("@/server/scripting/protocol-script-executor");
    vi.mocked(executeProtocolScript).mockResolvedValueOnce({
      success: true,
      commands: [
        { toolId: "stack-1", toolType: "stack", command: "acknowledge_failure", params: {} },
      ],
    } as never);
    installProtocolRow({
      id: 102,
      name: "script-ack",
      mode: "script",
      scriptContent: "PLACEHOLDER",
      workcellId: 1,
    });

    await expect(RunStore.global.createFromProtocol("102")).rejects.toThrow(
      'Step 0 sends "acknowledge_failure" on tool "stack-1", which is an operator action',
    );

    expect(RunStore.global.all()).toHaveLength(0);
    expect(fakeQueue.enqueueRun).toHaveBeenCalledTimes(0);
  });

  it("refuses an imported-JSON-shaped F.A.S.T. step too — the fast entries are live (D-01)", async () => {
    installProtocolRow({
      id: 103,
      name: "fast-pause",
      mode: "visual",
      workcellId: 1,
      commands: [{ toolId: "fast-1", toolType: "fast", command: "pause", params: {} }],
    });

    await expect(RunStore.global.createFromProtocol("103")).rejects.toThrow(
      'Step 0 sends "pause" on tool "fast-1", which is an operator action',
    );

    expect(RunStore.global.all()).toHaveLength(0);
    expect(fakeQueue.enqueueRun).toHaveBeenCalledTimes(0);
  });

  it("never surfaces as the generic 'Could not generate commands' message through run.create tRPC — BAD_REQUEST with the refusal's own message (OPR-04 visible)", async () => {
    installProtocolRow({
      id: 101,
      name: "visual-ack",
      mode: "visual",
      workcellId: 1,
      commands: [
        { toolId: "stack-1", toolType: "stack", command: "acknowledge_failure", params: {} },
      ],
    });

    const caller = runRouter.createCaller({});
    let caught: unknown = undefined;
    try {
      await caller.create({ protocolId: 101 });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(TRPCError);
    const trpcError = caught as TRPCError;
    expect(trpcError.code).toBe("BAD_REQUEST");
    expect(trpcError.message).toContain('"acknowledge_failure" on tool "stack-1"');
    expect(trpcError.message).toContain("which is an operator action");
    expect(trpcError.message).not.toContain("Could not generate commands for the given params.");
    expect(RunStore.global.all()).toHaveLength(0);
  });

  it("surfaces HTTP 400 with the refusal's own message through the REST POST /api/runs mapping (default stays 500)", async () => {
    installProtocolRow({
      id: 101,
      name: "visual-ack",
      mode: "visual",
      workcellId: 1,
      commands: [
        { toolId: "stack-1", toolType: "stack", command: "acknowledge_failure", params: {} },
      ],
    });

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    };

    await pagesApiRunsHandler(
      { method: "POST", body: { protocolId: "101" } } as never,
      res as never,
    );
    // handler() does not await the async postHandler — flush before asserting.
    for (let i = 0; i < 50 && res.status.mock.calls.length === 0; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining("which is an operator action"));
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it("a zero-command protocol is refused nowhere by this guard — the pre-existing empty outcome is unchanged (OPR-05 empty-parity)", async () => {
    installProtocolRow({
      id: 104,
      name: "empty-protocol",
      mode: "visual",
      workcellId: 1,
      commands: [],
    });

    await expect(RunStore.global.createFromProtocol("104")).rejects.toThrow(
      ProtocolGenerationFailedError,
    );

    const refusedLogs = vi
      .mocked(logAction)
      .mock.calls.filter((call) =>
        (call[0] as { action: string }).action.includes("Operator-Only"),
      );
    expect(refusedLogs).toHaveLength(0); // vacuous: the guard loop never ran
    expect(RunStore.global.all()).toHaveLength(0);
    expect(fakeQueue.enqueueRun).toHaveBeenCalledTimes(0);
  });

  it("keeps creating (and staging) transfer-only F.A.S.T. runs — regression proof that the guard is deny-by-listed", async () => {
    installProtocolRow({
      id: 105,
      name: "transfer-only",
      mode: "visual",
      workcellId: 1,
      commands: [{ toolId: "fast-1", toolType: "fast", command: "transfer", params: {} }],
    });

    const run = await RunStore.global.createFromProtocol("105");

    expect(RunStore.global.all()).toHaveLength(1);
    expect(run.commands).toHaveLength(1);
    expect(run.commands[0].commandInfo.command).toBe("transfer");
    expect(fakeQueue.enqueueRun).toHaveBeenCalledTimes(1); // staged but never dispatched (queue stub)
    const refusedLogs = vi
      .mocked(logAction)
      .mock.calls.filter((call) =>
        (call[0] as { action: string }).action.includes("Operator-Only"),
      );
    expect(refusedLogs).toHaveLength(0);
  });
});
