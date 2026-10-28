// ERR-03 / ERR-04 / ERR-05 (D-16, D-17): the pure banner predicate, the banner
// error description and the step-card error text. Fakes and SQLite files only:
// no tool is installed and no busy loop is started, so nothing here can move an
// instrument. The persistence cases use the queue's storage layer only.
import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import SqliteQueue from "@/server/utils/SqliteQueue";
import { ToolCommandExecutionError } from "@/server/tools";
import {
  shouldShowErrorBanner,
  errorSeq,
  UNSEQUENCED_ERROR_SEQ,
  describeQueueError,
  QUEUE_ERROR_FALLBACK_MESSAGE,
  stepErrorText,
  SKIPPED_AFTER_FAILURE_PREFIX,
} from "@/components/runs/queueError";

describe("errorSeq", () => {
  it("reads a numeric seq and maps everything else to the unsequenced marker", () => {
    expect(errorSeq({ seq: 7 })).toBe(7);
    expect(UNSEQUENCED_ERROR_SEQ).toBe(-1);
    expect(errorSeq({})).toBe(-1);
    expect(errorSeq("x")).toBe(-1);
    expect(errorSeq(null)).toBe(-1);
    expect(errorSeq({ seq: "7" })).toBe(-1);
  });
});

describe("shouldShowErrorBanner (D-16)", () => {
  it("shows for a FAILED queue with an undismissed error", () => {
    expect(shouldShowErrorBanner("FAILED", { seq: 5 }, null)).toBe(true);
  });

  it("hides once that seq is dismissed and re-arms on the next failure seq", () => {
    expect(shouldShowErrorBanner("FAILED", { seq: 5 }, 5)).toBe(false);
    expect(shouldShowErrorBanner("FAILED", { seq: 6 }, 5)).toBe(true);
  });

  it("re-shows two consecutive failures that carry identical message text", () => {
    const first = { message: "same text", seq: 5 };
    const second = { message: "same text", seq: 6 };
    const dismissed = errorSeq(first);
    expect(shouldShowErrorBanner("FAILED", first, dismissed)).toBe(false);
    expect(shouldShowErrorBanner("FAILED", second, dismissed)).toBe(true);
  });

  it("is hidden when there is no error", () => {
    expect(shouldShowErrorBanner("FAILED", null, null)).toBe(false);
    expect(shouldShowErrorBanner("FAILED", undefined, null)).toBe(false);
  });

  it("is hidden when the queue state is not FAILED", () => {
    expect(shouldShowErrorBanner("BUSY", { seq: 5 }, null)).toBe(false);
    expect(shouldShowErrorBanner("READY", { seq: 5 }, null)).toBe(false);
    expect(shouldShowErrorBanner(undefined, { seq: 5 }, null)).toBe(false);
  });

  it("shows a legacy payload without seq until it is dismissed as -1", () => {
    expect(shouldShowErrorBanner("FAILED", { message: "old" }, null)).toBe(true);
    expect(shouldShowErrorBanner("FAILED", { message: "old" }, -1)).toBe(false);
  });
});

describe("describeQueueError (D-16, ERR-02, ERR-05)", () => {
  it("shows the server-composed message and the real code name", () => {
    const d = describeQueueError({
      message: "m",
      userFriendlyMessage: "u",
      codeString: "INVALID_ARGUMENTS",
      code: "INVALID_ARGUMENTS",
    });
    expect(d.message).toBe("u");
    expect(d.code).toBe("INVALID_ARGUMENTS");
  });

  it("falls back to message, then to the fallback copy, never an empty string", () => {
    expect(describeQueueError({ message: "m", userFriendlyMessage: "" }).message).toBe("m");
    expect(describeQueueError({ message: "m", userFriendlyMessage: "   " }).message).toBe("m");
    expect(describeQueueError({ message: " ", userFriendlyMessage: "" }).message).toBe(
      QUEUE_ERROR_FALLBACK_MESSAGE,
    );
    expect(describeQueueError(null).message).toBe(QUEUE_ERROR_FALLBACK_MESSAGE);
    expect(describeQueueError(undefined).message).toBe(QUEUE_ERROR_FALLBACK_MESSAGE);
    expect(describeQueueError({}).message).toBe(QUEUE_ERROR_FALLBACK_MESSAGE);
    expect(QUEUE_ERROR_FALLBACK_MESSAGE).toBe(
      "The command failed and the tool sent no message. Open Details for the raw error.",
    );
  });

  it("uses a string payload as the message", () => {
    expect(describeQueueError("boom").message).toBe("boom");
  });

  it("never labels the badge SUCCESS or UNKNOWN", () => {
    const successFirst = { message: "m", codeString: "SUCCESS", code: "INVALID_ARGUMENTS" };
    const unknownFirst = { message: "m", codeString: "UNKNOWN", code: "NOT_READY" };
    expect(describeQueueError(successFirst).code).toBe("INVALID_ARGUMENTS");
    expect(describeQueueError(unknownFirst).code).toBe("NOT_READY");
    expect(describeQueueError({ message: "m", code: "SUCCESS" }).code).toBeNull();
    expect(describeQueueError({ message: "m", code: "UNKNOWN" }).code).toBeNull();
  });

  it("renders a numeric code as 'Code N' and keeps UNKNOWN_RESPONSE (exact-match exclusion)", () => {
    expect(describeQueueError({ message: "m", code: 14 }).code).toBe("Code 14");
    expect(describeQueueError({ message: "m", codeString: "UNKNOWN_RESPONSE" }).code).toBe(
      "UNKNOWN_RESPONSE",
    );
  });

  it("details is pretty JSON for an object, the string for a string, empty for null", () => {
    const payload = { message: "m", seq: 3 };
    expect(describeQueueError(payload).details).toBe(JSON.stringify(payload, null, 2));
    expect(describeQueueError("raw text").details).toBe("raw text");
    expect(describeQueueError(null).details).toBe("");
  });

  it("returns a non-blank message verbatim: multi-line, markup and non-ASCII, untrimmed", () => {
    const text = `  line one <b>x</b> & "q"\nünïcødé ✓ line two  `;
    expect(describeQueueError({ message: "m", userFriendlyMessage: text }).message).toBe(text);
  });
});

describe("stepErrorText (D-17)", () => {
  it("returns the stored message for a FAILED step", () => {
    expect(stepErrorText({ status: "FAILED", error: new Error("plate missing") })).toBe(
      "plate missing",
    );
  });

  it("prefixes a SKIPPED step that carries a stored error", () => {
    expect(SKIPPED_AFTER_FAILURE_PREFIX).toBe("Skipped after failure: ");
    expect(stepErrorText({ status: "SKIPPED", error: new Error("plate missing") })).toBe(
      "Skipped after failure: plate missing",
    );
  });

  it("returns null for FAILED or SKIPPED without an error (plain operator Skip)", () => {
    expect(stepErrorText({ status: "FAILED" })).toBeNull();
    expect(stepErrorText({ status: "SKIPPED" })).toBeNull();
    expect(stepErrorText({ status: "SKIPPED", error: undefined })).toBeNull();
  });

  it("returns null for COMPLETED, STARTED and CREATED rows that keep a stale error", () => {
    const error = new Error("stale");
    expect(stepErrorText({ status: "COMPLETED", error })).toBeNull();
    expect(stepErrorText({ status: "STARTED", error })).toBeNull();
    expect(stepErrorText({ status: "CREATED", error })).toBeNull();
  });

  it("tolerates a string, a { message }, a number and undefined without throwing", () => {
    expect(stepErrorText({ status: "FAILED", error: "plain" })).toBe("plain");
    expect(stepErrorText({ status: "FAILED", error: { message: "obj" } })).toBe("obj");
    expect(stepErrorText({ status: "FAILED", error: 42 })).toBeNull();
    expect(stepErrorText({ status: "FAILED", error: undefined })).toBeNull();
  });
});

describe("stored step error persistence (ERR-03, D-17)", () => {
  const row = (runId: string) =>
    ({
      runId,
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    }) as any;

  it("is still readable from the persisted row after clearError", async () => {
    const queue = new CommandQueue({} as any);
    try {
      await queue.commands.push(row("run-1"));
      const [pushed] = await queue.commands.all();
      await queue.commands.fail(
        pushed.queueId,
        new ToolCommandExecutionError("Tool said: no plate", ResponseCode.INVALID_ARGUMENTS),
      );
      await queue.clearError();

      const [stored] = await queue.commands.all();
      expect(stored.status).toBe("FAILED");
      expect(stepErrorText(stored)).toBe("Tool said: no plate");
    } finally {
      queue.commands.close();
    }
  });

  it("is still readable after the SQLite file is closed and reopened (restart)", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "galago-queue-error-"));
    const dbPath = path.join(tmpDir, "queue.db");
    try {
      const first = new SqliteQueue(dbPath, "command_queue_2");
      await first.push(row("run-1"));
      const [pushed] = await first.all();
      await first.fail(
        pushed.queueId,
        new ToolCommandExecutionError("Tool said: no plate", ResponseCode.INVALID_ARGUMENTS),
      );
      first.close();

      const reopened = new SqliteQueue(dbPath, "command_queue_2");
      try {
        const [stored] = await reopened.all();
        expect(stepErrorText(stored)).toBe("Tool said: no plate");
      } finally {
        reopened.close();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
