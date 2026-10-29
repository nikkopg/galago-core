// ERR-01 (D-10): failing-first table over every tool ResponseCode.
//
// Each case drives a real CommandQueue._start() -> Tool.executeCommand -> reply
// switch against a FakeGrpc tool, then pins what the run UI receives: the
// getError() payload, the stored row error and the two error log lines.
//
// THIS FILE IS RED BY DESIGN until plan 03-04 lands the production fixes
// (ERR-02/04/05). Do not weaken, skip, .todo or .fails anything here. Fakes only:
// no real gRPC endpoint is ever contacted, so no test can move an instrument.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool, { ToolCommandExecutionError } from "@/server/tools";
import { logAction } from "@/server/logger";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, FakeGrpc } from "./helpers/fakeTool";

const TOOL_ID = "fast-1";
const COMMAND = "transfer";
const BLANK = "   ";
const JOINER = " Tool said: ";

// Generic sentences, copied character-for-character from tools.ts at HEAD.
const S_UNRECOGNIZED_COMMAND = `The command "transfer" is not recognized by the tool "fast-1". Please verify that this command is supported by this tool or page view.`;
const S_INVALID_ARGUMENTS = `Invalid arguments provided for command "transfer". Check the parameters and try again.`;
const S_NOT_READY = `The tool "fast-1" is currently not ready. Please wait and try again.`;
const S_WRONG_TOOL = `The command was sent to the wrong tool type. Please check that you're using the correct tool for this operation.`;
const E_EMPTY = `An error occurred while executing the command "transfer" on tool "fast-1".`;
const D_EMPTY = `Failed to execute command "transfer" on tool "fast-1"`;

const TOOL_TEXT = (code: ResponseCode) =>
  `tool text for ${code}: plate "P1" not at slot 3, ünïcødé ✓`;
const ENCODED_TEXT = `  padded <b>markup</b> & "quotes" ünïcødé ✓\nsecond line  `;

type Outcome = { code: ResponseCode; message: string };
type CodeCase = {
  withText(t: string): Outcome;
  empty: Outcome | null;
  blank: Outcome;
};

// A generic-sentence code: the tool's text is appended after the sentence.
function generic(code: ResponseCode, sentence: string): CodeCase {
  return {
    withText: (t) => ({ code, message: `${sentence}${JOINER}${t}` }),
    empty: { code, message: sentence },
    blank: { code, message: sentence },
  };
}

// A passthrough code: the tool's text is the whole message.
function passthrough(code: ResponseCode): CodeCase {
  return {
    withText: (t) => ({ code, message: t }),
    empty: { code, message: D_EMPTY },
    blank: { code, message: D_EMPTY },
  };
}

// Typed Record<ResponseCode, ...>: adding a ResponseCode without a row here is a
// compile error, and the exhaustiveness test below checks the runtime keys too.
const EXPECT: Record<ResponseCode, CodeCase> = {
  [ResponseCode.UNRECOGNIZED_COMMAND]: generic(
    ResponseCode.UNRECOGNIZED_COMMAND,
    S_UNRECOGNIZED_COMMAND,
  ),
  [ResponseCode.INVALID_ARGUMENTS]: generic(ResponseCode.INVALID_ARGUMENTS, S_INVALID_ARGUMENTS),
  [ResponseCode.NOT_READY]: generic(ResponseCode.NOT_READY, S_NOT_READY),
  [ResponseCode.WRONG_TOOL]: generic(ResponseCode.WRONG_TOOL, S_WRONG_TOOL),
  [ResponseCode.ERROR_FROM_TOOL]: {
    withText: (t) => ({
      code: ResponseCode.ERROR_FROM_TOOL,
      message: `Error from tool "${TOOL_ID}": ${t}`,
    }),
    empty: { code: ResponseCode.ERROR_FROM_TOOL, message: E_EMPTY },
    blank: { code: ResponseCode.ERROR_FROM_TOOL, message: E_EMPTY },
  },
  [ResponseCode.DRIVER_ERROR]: passthrough(ResponseCode.DRIVER_ERROR),
  [ResponseCode.UNKNOWN_RESPONSE]: passthrough(ResponseCode.UNKNOWN_RESPONSE),
  [ResponseCode.UNRECOGNIZED]: passthrough(ResponseCode.UNRECOGNIZED),
  // SUCCESS carrying error text is still a failure, and never reports code SUCCESS.
  [ResponseCode.SUCCESS]: {
    withText: (t) => ({
      code: ResponseCode.ERROR_FROM_TOOL,
      message: `Error from tool "${TOOL_ID}": ${t}`,
    }),
    empty: null,
    blank: { code: ResponseCode.ERROR_FROM_TOOL, message: E_EMPTY },
  },
};

function logsFor(action: string) {
  return vi
    .mocked(logAction)
    .mock.calls.map(([entry]) => entry as { level: string; action: string; details: string })
    .filter((entry) => entry.action === action);
}

describe("errorPath", () => {
  let queue: CommandQueue;
  let grpc: FakeGrpc;

  const caller = () => commandQueueRouter.createCaller({});

  function newQueue() {
    queue = new CommandQueue({} as any);
    queue.slackNotificationsEnabled = false;
    (globalThis as any)["__global_command_queue_key"] = queue;
  }

  async function pushRow() {
    await queue.commands.push({
      runId: "run-err",
      status: "CREATED",
      commandInfo: {
        toolId: TOOL_ID,
        toolType: ToolType.fast,
        command: COMMAND,
        params: {},
      },
    } as any);
  }

  async function drive() {
    const p = queue._start();
    await vi.advanceTimersByTimeAsync(3000);
    await p;
  }

  async function runOneReply(reply: Record<string, unknown>) {
    await pushRow();
    grpc.executeCommand.mockResolvedValueOnce({ return_reply: true, ...reply });
    await drive();
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    vi.mocked(logAction).mockClear();
    newQueue();
    const fake = installFakeTool(TOOL_ID, ToolType.fast);
    grpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await removeFakeTool(TOOL_ID);
    delete (globalThis as any)["__global_command_queue_key"];
    vi.restoreAllMocks();
  });

  async function expectFailure(expected: Outcome) {
    const { code, message } = expected;

    expect(queue.state).toBe(ToolStatus.FAILED);

    await expect(caller().getError()).resolves.toMatchObject({
      message,
      userFriendlyMessage: message,
      code,
      codeString: code,
      name: "ToolCommandExecutionError",
    });

    const rows = await queue.commands.getPaginated();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("FAILED");
    const stored = (rows[0] as any).error;
    expect(stored).toBeInstanceOf(Error);
    expect(stored.message).toBe(message);
    expect(stored.name).toBe("ToolCommandExecutionError");

    const execLogs = logsFor("Tool Command Execution Error");
    expect(execLogs).toHaveLength(1);
    expect(execLogs[0].level).toBe("error");
    expect(execLogs[0].details).toBe(
      `Failed to execute command: ${COMMAND}, Tool: ${TOOL_ID}. Error: ${message} (Code: ${code})`,
    );

    const failedLogs = logsFor("Command Failed");
    expect(failedLogs).toHaveLength(1);
    expect(failedLogs[0].level).toBe("error");
    expect(failedLogs[0].details).toBe(`Command failed: ${message}`);
  }

  describe("ERR-01 queue-level table", () => {
    it.each(Object.values(ResponseCode))("%s with tool text", async (code) => {
      await runOneReply({ response: code, error_message: TOOL_TEXT(code) });
      await expectFailure(EXPECT[code].withText(TOOL_TEXT(code)));
    });

    it.each(Object.values(ResponseCode))("%s with empty text", async (code) => {
      await runOneReply({ response: code, error_message: "" });
      const expected = EXPECT[code].empty;
      if (expected === null) {
        // Clean-success control: no error anywhere.
        const rows = await queue.commands.all();
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe("COMPLETED");
        await expect(caller().getError()).resolves.toBeNull();
        expect(queue.state).not.toBe(ToolStatus.FAILED);
        expect(logsFor("Tool Command Execution Error")).toHaveLength(0);
        return;
      }
      await expectFailure(expected);
    });

    it.each(Object.values(ResponseCode))("%s with blank text", async (code) => {
      await runOneReply({ response: code, error_message: BLANK });
      await expectFailure(EXPECT[code].blank);
    });

    it.each([
      ResponseCode.INVALID_ARGUMENTS,
      ResponseCode.ERROR_FROM_TOOL,
      ResponseCode.DRIVER_ERROR,
    ])("%s keeps tool text verbatim", async (code) => {
      await runOneReply({ response: code, error_message: ENCODED_TEXT });
      const expected = EXPECT[code].withText(ENCODED_TEXT);
      await expectFailure(expected);
      const payload = (await caller().getError()) as any;
      expect(payload.message).toBe(expected.message);
      expect(payload.message.includes(ENCODED_TEXT)).toBe(true);
    });
  });

  describe("ERR-02 thrown ToolCommandExecutionError instance", () => {
    it.each(Object.values(ResponseCode))(
      "%s thrown instance carries the real code name",
      async (code) => {
        grpc.executeCommand.mockResolvedValueOnce({
          response: code,
          error_message: TOOL_TEXT(code),
          return_reply: true,
        });
        const expected = EXPECT[code].withText(TOOL_TEXT(code));

        const err = await Tool.executeCommand({
          toolId: TOOL_ID,
          toolType: ToolType.fast,
          command: COMMAND,
          params: {},
        } as any).then(
          () => null,
          (e: unknown) => e,
        );

        expect(err).toBeInstanceOf(ToolCommandExecutionError);
        expect(err).toMatchObject({
          code: expected.code,
          codeString: expected.code,
          message: expected.message,
          userFriendlyMessage: expected.message,
        });
        expect(expected.code).not.toBe(ResponseCode.SUCCESS);
      },
    );
  });

  describe("ERR-04 failure sequence in getError", () => {
    it("a failure carries a numeric seq that is a safe integer seeded from the clock", async () => {
      const before = Date.now();
      newQueue();
      await runOneReply({
        response: ResponseCode.INVALID_ARGUMENTS,
        error_message: "bad plate",
      });
      const payload = (await caller().getError()) as any;
      expect(typeof payload.seq).toBe("number");
      expect(Number.isSafeInteger(payload.seq)).toBe(true);
      expect(payload.seq).toBeGreaterThanOrEqual(before + 1);
    });

    it("two consecutive failures with identical text get seq exactly one apart", async () => {
      await runOneReply({
        response: ResponseCode.INVALID_ARGUMENTS,
        error_message: "same text",
      });
      const first = (await caller().getError()) as any;
      expect(typeof first.seq).toBe("number");

      // The FAILED row stays queued and re-runs first on the next Start.
      grpc.executeCommand.mockResolvedValueOnce({
        response: ResponseCode.INVALID_ARGUMENTS,
        error_message: "same text",
        return_reply: true,
      });
      await drive();
      const second = (await caller().getError()) as any;
      expect(second.message).toBe(first.message);
      expect(typeof second.seq).toBe("number");
      expect(second.seq - first.seq).toBe(1);
    });

    it("getError is null after clearError", async () => {
      await runOneReply({
        response: ResponseCode.INVALID_ARGUMENTS,
        error_message: "bad plate",
      });
      await expect(caller().getError()).resolves.not.toBeNull();
      await queue.clearError();
      await expect(caller().getError()).resolves.toBeNull();
    });

    it("a non-tool error is a plain object with seq and no code badge", async () => {
      await pushRow();
      grpc.executeCommand.mockRejectedValueOnce(new Error("socket hang up"));
      await drive();
      const payload = (await caller().getError()) as any;
      expect(payload).not.toBeInstanceOf(Error);
      expect(payload).toMatchObject({
        message: "socket hang up",
        userFriendlyMessage: "socket hang up",
        name: "Error",
      });
      expect(typeof payload.seq).toBe("number");
      expect(payload).not.toHaveProperty("codeString");
      expect(payload).not.toHaveProperty("code");
    });

    it("a gRPC transport error keeps its numeric code", async () => {
      await pushRow();
      grpc.executeCommand.mockRejectedValueOnce(
        Object.assign(new Error("14 UNAVAILABLE: No connection established"), { code: 14 }),
      );
      await drive();
      const payload = (await caller().getError()) as any;
      expect(payload).not.toBeInstanceOf(Error);
      expect(payload).toMatchObject({
        code: 14,
        message: "14 UNAVAILABLE: No connection established",
      });
      expect(typeof payload.seq).toBe("number");
    });
  });

  it("getError never sends the server stack to the client (WR-02)", async () => {
    await pushRow();
    grpc.executeCommand.mockResolvedValueOnce({
      response: ResponseCode.INVALID_ARGUMENTS,
      error_message: "x",
    });
    await drive();
    expect(await caller().getError()).not.toHaveProperty("stack");

    newQueue();
    await pushRow();
    grpc.executeCommand.mockRejectedValueOnce(new Error("socket hang up"));
    await drive();
    expect(await caller().getError()).not.toHaveProperty("stack");
  });

  it("covers every ResponseCode", () => {
    expect(Object.keys(EXPECT).sort()).toEqual(Object.values(ResponseCode).sort());
    expect(Object.keys(EXPECT)).toHaveLength(9);
  });
});
