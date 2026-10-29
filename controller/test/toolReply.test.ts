// ERR-02 / ERR-05 (D-11, D-13, D-14): pure unit table over every ResponseCode for
// describeToolReply and ToolCommandExecutionError.codeString. No gRPC, no motion.
import { describe, it, expect } from "vitest";
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { describeToolReply, TOOL_SAID_JOINER } from "@/server/toolReply";
import { ToolCommandExecutionError } from "@/server/tools";

const CMD = "transfer";
const TOOL = "fast-1";

const GENERIC: Record<string, string> = {
  [ResponseCode.UNRECOGNIZED_COMMAND]: `The command "${CMD}" is not recognized by the tool "${TOOL}". Please verify that this command is supported by this tool or page view.`,
  [ResponseCode.INVALID_ARGUMENTS]: `Invalid arguments provided for command "${CMD}". Check the parameters and try again.`,
  [ResponseCode.NOT_READY]: `The tool "${TOOL}" is currently not ready. Please wait and try again.`,
  [ResponseCode.WRONG_TOOL]:
    "The command was sent to the wrong tool type. Please check that you're using the correct tool for this operation.",
};
const GENERIC_CODES = Object.keys(GENERIC) as ResponseCode[];

const ERROR_FROM_TOOL_EMPTY = `An error occurred while executing the command "${CMD}" on tool "${TOOL}".`;
const DEFAULT_EMPTY = `Failed to execute command "${CMD}" on tool "${TOOL}"`;
const DEFAULT_CODES = [
  ResponseCode.DRIVER_ERROR,
  ResponseCode.UNKNOWN_RESPONSE,
  ResponseCode.UNRECOGNIZED,
];

// Typed Record so adding a ResponseCode without a case here fails to compile.
const KIND: Record<ResponseCode, "generic" | "errorFromTool" | "default" | "success"> = {
  [ResponseCode.UNKNOWN_RESPONSE]: "default",
  [ResponseCode.SUCCESS]: "success",
  [ResponseCode.WRONG_TOOL]: "generic",
  [ResponseCode.UNRECOGNIZED_COMMAND]: "generic",
  [ResponseCode.INVALID_ARGUMENTS]: "generic",
  [ResponseCode.DRIVER_ERROR]: "default",
  [ResponseCode.NOT_READY]: "generic",
  [ResponseCode.ERROR_FROM_TOOL]: "errorFromTool",
  [ResponseCode.UNRECOGNIZED]: "default",
};

const EMPTIES: Array<string | undefined> = ["", "   ", undefined];

describe("describeToolReply table coverage", () => {
  it("covers every ResponseCode", () => {
    expect(Object.keys(KIND).sort()).toEqual(Object.values(ResponseCode).sort());
  });
});

describe("describeToolReply generic codes", () => {
  it.each(GENERIC_CODES)("%s appends the tool text after the generic sentence", (code) => {
    const r = describeToolReply(CMD, TOOL, { response: code, error_message: "boom" });
    expect(r).toEqual({ code, message: GENERIC[code] + TOOL_SAID_JOINER + "boom" });
    expect(r!.message).toBe(GENERIC[code] + " Tool said: boom");
  });

  it.each(GENERIC_CODES.flatMap((c) => EMPTIES.map((e) => [c, e] as const)))(
    "%s with empty text %j shows only the generic sentence",
    (code, empty) => {
      const r = describeToolReply(CMD, TOOL, { response: code, error_message: empty });
      expect(r).toEqual({ code, message: GENERIC[code] });
      expect(r!.message).not.toContain("Tool said");
    },
  );
});

describe("describeToolReply ERROR_FROM_TOOL", () => {
  it("prefixes the tool text", () => {
    expect(
      describeToolReply(CMD, TOOL, {
        response: ResponseCode.ERROR_FROM_TOOL,
        error_message: "boom",
      }),
    ).toEqual({ code: ResponseCode.ERROR_FROM_TOOL, message: `Error from tool "${TOOL}": boom` });
  });

  it.each(EMPTIES)("empty text %j gives the empty sentence", (empty) => {
    expect(
      describeToolReply(CMD, TOOL, {
        response: ResponseCode.ERROR_FROM_TOOL,
        error_message: empty,
      }),
    ).toEqual({ code: ResponseCode.ERROR_FROM_TOOL, message: ERROR_FROM_TOOL_EMPTY });
  });
});

describe("describeToolReply default codes", () => {
  it.each(DEFAULT_CODES)("%s returns the tool text", (code) => {
    expect(describeToolReply(CMD, TOOL, { response: code, error_message: "boom" })).toEqual({
      code,
      message: "boom",
    });
  });

  it.each(DEFAULT_CODES.flatMap((c) => ["", "   "].map((e) => [c, e] as const)))(
    "%s with empty text %j returns the failed-to-execute sentence",
    (code, empty) => {
      expect(describeToolReply(CMD, TOOL, { response: code, error_message: empty })).toEqual({
        code,
        message: DEFAULT_EMPTY,
      });
    },
  );
});

describe("describeToolReply SUCCESS (ERR-05)", () => {
  it.each(["", undefined])("SUCCESS with %j is a plain success", (empty) => {
    expect(
      describeToolReply(CMD, TOOL, { response: ResponseCode.SUCCESS, error_message: empty }),
    ).toBeNull();
  });

  it("SUCCESS with a message is reported as ERROR_FROM_TOOL, never SUCCESS", () => {
    expect(
      describeToolReply(CMD, TOOL, { response: ResponseCode.SUCCESS, error_message: "boom" }),
    ).toEqual({ code: ResponseCode.ERROR_FROM_TOOL, message: `Error from tool "${TOOL}": boom` });
  });

  it("SUCCESS with whitespace-only text gives the ERROR_FROM_TOOL empty sentence", () => {
    expect(
      describeToolReply(CMD, TOOL, { response: ResponseCode.SUCCESS, error_message: "   " }),
    ).toEqual({ code: ResponseCode.ERROR_FROM_TOOL, message: ERROR_FROM_TOOL_EMPTY });
  });
});

describe("describeToolReply fidelity and invariants", () => {
  const AWKWARD = "  lead\nline <b>x</b> trail é中  ";

  it.each(Object.values(ResponseCode).filter((c) => c !== ResponseCode.SUCCESS))(
    "%s keeps awkward text verbatim",
    (code) => {
      const r = describeToolReply(CMD, TOOL, { response: code, error_message: AWKWARD })!;
      expect(r.message).toContain(AWKWARD);
      if (KIND[code] === "default") expect(r.message).toBe(AWKWARD);
    },
  );

  it.each(Object.values(ResponseCode))(
    "%s never yields code SUCCESS or an empty message",
    (code) => {
      for (const text of ["boom", "", "   ", undefined]) {
        const r = describeToolReply(CMD, TOOL, { response: code, error_message: text });
        if (r) {
          expect(r.code).not.toBe(ResponseCode.SUCCESS);
          expect(r.message.trim().length).toBeGreaterThan(0);
        }
      }
    },
  );
});

describe("ToolCommandExecutionError.codeString (D-13)", () => {
  it.each(Object.values(ResponseCode))("%s codeString equals the code name", (code) => {
    const e = new ToolCommandExecutionError("m", code);
    expect(e.codeString).toBe(code);
    expect(e.codeString).not.toBe("UNKNOWN");
    expect(e.userFriendlyMessage).toBe("m");
  });
});
