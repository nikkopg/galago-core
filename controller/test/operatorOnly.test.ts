// Operator-only command guard: one zero-import table (server/operatorOnlyCommands.ts)
// enforced at the two locked points. This file covers the execute-time guard
// (D-02a) end-to-end from the Tool instance and the tRPC runCommand caller with
// a stack fake, plus the pure-module pins and the operator-path carve-out
// (controlCommand is never guarded).
import { describe, it, expect, vi, afterEach } from "vitest";
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
