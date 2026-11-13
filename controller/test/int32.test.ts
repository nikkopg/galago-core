// CR-01 (07-09, gap closure for PLT-04 / SC3): a typed or saved plate id, deck
// or well number that the protobuf int32 encoder would wrap or truncate must
// never reach the instrument as a different value.
//
// Measured against the real protobufjs Writer.int32 / Reader.int32 round trip:
// 2147483647 stays 2147483647; 2147483648 becomes -2147483648; 4294967297 and
// "4294967297" become 1 (plate 1!); -2147483649 becomes 2147483647; 12.7
// becomes 12; "3.5" and " 3" become 3; "1e3" becomes 1000; "0x10" becomes 16;
// true becomes 1; "abc", "" and null become 0. The pure rules, the send-time
// guard in Tool#executeCommand and the encoder facts are pinned here.
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ToolType } from "gen-interfaces/controller";
import * as tool_base from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { logAction } from "@/server/logger";
import { ToolCommandExecutionError } from "@/server/tools";
import {
  INT32_MAX,
  INT32_MIN,
  INT32_PARAM_FIELDS,
  int32FromDigits,
  int32ParamProblems,
  int32RefusalMessage,
  isExactInt32,
} from "@/utils/int32";
import { applyChange, lookupFieldBinding } from "@/components/tools/fieldOptions";
import { installFakeTool, removeFakeTool } from "./helpers/fakeTool";

// Variable-substitution harness (the operatorOnly vi.hoisted pattern): select,
// from and where return the fake, limit resolves the variable under test.
const { dbMock, variable } = vi.hoisted(() => {
  const variable = { value: "" };
  const dbMock: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  dbMock.select.mockImplementation(() => dbMock);
  dbMock.from.mockImplementation(() => dbMock);
  dbMock.where.mockImplementation(() => dbMock);
  dbMock.limit.mockImplementation(async () => [{ value: variable.value }]);
  return { dbMock, variable };
});

vi.mock("@/db/client", () => ({ db: dbMock, sqlite: {} }));

describe("int32 constants", () => {
  it("are the signed 32-bit bounds", () => {
    expect(INT32_MAX).toBe(2147483647);
    expect(INT32_MIN).toBe(-2147483648);
  });
});

describe("INT32_PARAM_FIELDS", () => {
  it("lists the nine F.A.S.T. transfer int32 fields in encoder order", () => {
    expect(INT32_PARAM_FIELDS.fast.transfer).toStrictEqual([
      "source_deck",
      "dest_deck",
      "source_plate_id",
      "dest_plate_id",
      "source_start_col",
      "dest_start_col",
      "num_rows",
      "num_cols",
      "expected_tray_id",
    ]);
  });
});

describe("int32FromDigits", () => {
  it("returns a number for digits up to INT32_MAX", () => {
    expect(int32FromDigits("0")).toBe(0);
    expect(int32FromDigits("2147483647")).toBe(2147483647);
    expect(int32FromDigits("007")).toBe(7);
  });

  it("returns the digit string unchanged above INT32_MAX, never rounded or clipped", () => {
    expect(int32FromDigits("2147483648")).toBe("2147483648");
    expect(int32FromDigits("4294967297")).toBe("4294967297");
    expect(int32FromDigits("9007199254740993")).toBe("9007199254740993");
  });
});

describe("isExactInt32", () => {
  it("accepts integers in range and canonical digit strings in range", () => {
    for (const ok of [0, 1, 2147483647, -1, -2147483648, "1", "007", "2147483647"]) {
      expect(isExactInt32(ok), String(ok)).toBe(true);
    }
  });

  it("refuses everything else, including the blank values", () => {
    const bad: unknown[] = [
      2147483648,
      4294967297,
      -2147483649,
      12.7,
      NaN,
      Infinity,
      "2147483648",
      "4294967297",
      "9007199254740993",
      "3.5",
      " 3",
      "1e3",
      "0x10",
      "-5",
      "abc",
      true,
      "",
      null,
      undefined,
    ];
    for (const value of bad) {
      expect(isExactInt32(value), String(value)).toBe(false);
    }
  });
});

describe("int32ParamProblems", () => {
  const base = { num_rows: 1, tip_reuse: "fresh", source_start_row: "A" };

  it("names a fast transfer field that the encoder would change", () => {
    expect(
      int32ParamProblems("fast", "transfer", { ...base, source_plate_id: 4294967297 }),
    ).toStrictEqual([{ field: "source_plate_id", value: 4294967297 }]);
  });

  it("skips blank values and absent fields (today's behaviour stays)", () => {
    expect(
      int32ParamProblems("fast", "transfer", {
        source_deck: undefined,
        dest_deck: null,
        source_plate_id: "",
        num_rows: 1,
      }),
    ).toStrictEqual([]);
    expect(int32ParamProblems("fast", "transfer", {})).toStrictEqual([]);
  });

  it("returns [] for another tool, an unknown command, an inherited key or non-object params", () => {
    const params = { ...base, source_plate_id: 4294967297 };
    expect(int32ParamProblems("stack", "transfer", params)).toStrictEqual([]);
    expect(int32ParamProblems("fast", "constructor", params)).toStrictEqual([]);
    expect(int32ParamProblems("fast", "toString", params)).toStrictEqual([]);
    expect(int32ParamProblems("fast", "transfer", "x")).toStrictEqual([]);
    expect(int32ParamProblems("fast", "transfer", null)).toStrictEqual([]);
  });

  it("returns one problem per bad field, in table order", () => {
    expect(
      int32ParamProblems("fast", "transfer", { num_rows: "2147483648", source_deck: 1.5 }),
    ).toStrictEqual([
      { field: "source_deck", value: 1.5 },
      { field: "num_rows", value: "2147483648" },
    ]);
  });
});

describe("int32RefusalMessage", () => {
  it("is exactly the pinned sentence", () => {
    expect(
      int32RefusalMessage("fast-1", "transfer", [
        { field: "source_plate_id", value: "4294967297" },
      ]),
    ).toBe(
      `"transfer" on tool "fast-1" was not sent: source_plate_id = '4294967297'. Each must be a whole number within the instrument's 32-bit range (up to 2147483647); otherwise the instrument would receive a different value.`,
    );
  });

  it("joins problems with a comma and cuts a long value to 40 characters plus an ellipsis", () => {
    const long = "9".repeat(50);
    const message = int32RefusalMessage("fast-1", "transfer", [
      { field: "num_rows", value: long },
      { field: "num_cols", value: 12.7 },
    ]);
    expect(message).toContain(`num_rows = '${"9".repeat(40)}…', num_cols = '12.7'`);
    expect(message).not.toContain("9".repeat(41));
  });
});

describe("applyChange typed plate (bounded)", () => {
  function plate() {
    const found = lookupFieldBinding("fast", "transfer", "source_plate_id");
    if (found === undefined) throw new Error("no plate binding");
    return found;
  }

  it("keeps an out-of-range typed id as the digit text", () => {
    expect(applyChange(plate(), "4294967297", "typed")).toStrictEqual({
      source_plate_id: "4294967297",
    });
    expect(applyChange(plate(), "2147483648", "typed")).toStrictEqual({
      source_plate_id: "2147483648",
    });
  });

  it("writes the number at the edge 2147483647", () => {
    expect(applyChange(plate(), "2147483647", "typed")).toStrictEqual({
      source_plate_id: 2147483647,
    });
  });
});

describe("Tool#executeCommand int32 guard (CR-01, T-07-31)", () => {
  afterEach(async () => {
    await removeFakeTool("fast-1");
  });

  function plateBinding() {
    const found = lookupFieldBinding("fast", "transfer", "source_plate_id");
    if (found === undefined) throw new Error("no plate binding");
    return found;
  }

  function transferParams(typed: string) {
    return {
      source_deck: 1,
      dest_deck: 2,
      ...applyChange(plateBinding(), typed, "typed"),
      dest_plate_id: 11,
      source_start_row: "A",
      source_start_col: 1,
      dest_start_row: "A",
      dest_start_col: 1,
      num_rows: 1,
      num_cols: 1,
      volume: 50,
      tip_reuse: "fresh",
    };
  }

  it("refuses 4294967297 with INVALID_ARGUMENTS, zero gRPC sends and a value-free audit row", async () => {
    const { tool, grpc } = installFakeTool("fast-1", ToolType.fast);
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });

    const error = await tool
      .executeCommand({
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: transferParams("4294967297"),
      })
      .then(
        () => undefined,
        (e: unknown) => e,
      );

    expect(error).toBeInstanceOf(ToolCommandExecutionError);
    const refused = error as ToolCommandExecutionError;
    expect(refused.code).toBe(ResponseCode.INVALID_ARGUMENTS);
    expect(refused.message).toContain("source_plate_id");
    expect(refused.message).toContain("4294967297");

    expect(grpc.executeCommand).toHaveBeenCalledTimes(0);
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warning", action: "Int32 Param Refused" }),
    );
    const details = vi.mocked(logAction).mock.calls[0][0].details;
    expect(details).toContain("fields=source_plate_id");
    expect(details).toContain("command=transfer");
    expect(details).not.toContain("4294967297");
  });

  it("sends 2147483647 once and the real encoder round-trips it unchanged", async () => {
    const { tool, grpc } = installFakeTool("fast-1", ToolType.fast);
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });

    await tool.executeCommand({
      toolId: "fast-1",
      toolType: ToolType.fast,
      command: "transfer",
      params: transferParams("2147483647"),
    });

    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
    const payload = grpc.executeCommand.mock.calls[0][0] as tool_base.Command;
    const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
    expect(decoded.fast?.transfer?.source_plate_id).toBe(2147483647);
  });

  it("still sends params {} exactly as before", async () => {
    const { tool, grpc } = installFakeTool("fast-1", ToolType.fast);
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });

    await tool.executeCommand({
      toolId: "fast-1",
      toolType: ToolType.fast,
      command: "transfer",
      params: {},
    });

    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
    expect(grpc.executeCommand).toHaveBeenCalledWith({ fast: { transfer: {} } });
  });
});

// Soundness against the REAL generated encoder: every value the guard accepts
// decodes as Number(value); every characterized refusal would have changed.
function roundTrip(value: unknown): unknown {
  const payload = {
    fast: { transfer: { source_plate_id: value } },
  } as unknown as tool_base.Command;
  return tool_base.Command.decode(tool_base.Command.encode(payload).finish()).fast?.transfer
    ?.source_plate_id;
}

describe("encoder soundness (T-07-33)", () => {
  it.each([0, 1, 7, -1, -2147483648, 2147483647, "1", "007", "2147483647"])(
    "accepted value %j decodes as Number(value)",
    (value) => {
      expect(isExactInt32(value)).toBe(true);
      expect(roundTrip(value)).toBe(Number(value));
    },
  );

  it.each([
    [2147483648, -2147483648],
    [4294967297, 1],
    [-2147483649, 2147483647],
    [12.7, 12],
    ["3.5", 3],
    [true, 1],
  ])("refused value %j would decode as %j", (value, wrapped) => {
    expect(isExactInt32(value)).toBe(false);
    expect(roundTrip(value)).toBe(wrapped);
  });
});

describe("INT32_PARAM_FIELDS pin to the generated encoder (T-07-36)", () => {
  const generated = readFileSync(
    path.join(process.cwd(), "gen-interfaces/tools/grpc_interfaces/fast.ts"),
    "utf8",
  );
  const blocks = generated
    .split(/^(?=export const )/m)
    .filter((block) => /^export const Command_\w+ = /.test(block));
  const int32Writes = (block: string) =>
    [...block.matchAll(/\.int32\(message\.(\w+)\)/g)].map((m) => m[1]);

  it("equals the int32 writes of Command_Transfer", () => {
    const transfer = blocks.find((block) => block.startsWith("export const Command_Transfer = "));
    expect(transfer).toBeDefined();
    expect(INT32_PARAM_FIELDS.fast.transfer).toHaveLength(9);
    expect([...int32Writes(transfer as string)].sort()).toStrictEqual(
      [...INT32_PARAM_FIELDS.fast.transfer].sort(),
    );
  });

  it("no other Command_ message writes an int32", () => {
    const others = blocks.filter((block) => !block.startsWith("export const Command_Transfer = "));
    expect(others.length).toBeGreaterThan(0);
    for (const block of others) {
      expect(int32Writes(block), block.slice(0, 40)).toStrictEqual([]);
    }
  });

  it("is deep-frozen", () => {
    expect(Object.isFrozen(INT32_PARAM_FIELDS)).toBe(true);
    expect(Object.isFrozen(INT32_PARAM_FIELDS.fast)).toBe(true);
    expect(Object.isFrozen(INT32_PARAM_FIELDS.fast.transfer)).toBe(true);
  });
});

describe("guard runs after {{variable}} substitution (T-07-32)", () => {
  afterEach(async () => {
    await removeFakeTool("fast-1");
  });

  const run = (tool: ReturnType<typeof installFakeTool>["tool"]) =>
    tool.executeCommand({
      toolId: "fast-1",
      toolType: ToolType.fast,
      command: "transfer",
      params: { source_deck: 1, source_plate_id: "{{plate}}", num_rows: 1 },
    });

  it("refuses a variable that resolves to 4294967297 with zero gRPC sends", async () => {
    const { tool, grpc } = installFakeTool("fast-1", ToolType.fast);
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });
    variable.value = "4294967297";

    await expect(run(tool)).rejects.toBeInstanceOf(ToolCommandExecutionError);
    expect(grpc.executeCommand).toHaveBeenCalledTimes(0);
  });

  it("sends a variable that resolves to 12 once and it decodes as 12", async () => {
    const { tool, grpc } = installFakeTool("fast-1", ToolType.fast);
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });
    variable.value = "12";

    await run(tool);

    expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
    const payload = grpc.executeCommand.mock.calls[0][0] as tool_base.Command;
    const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
    expect(decoded.fast?.transfer?.source_plate_id).toBe(12);
  });
});
