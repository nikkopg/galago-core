import { describe, it, expect, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";
import {
  reducePausePrompt,
  pauseEpisodeKey,
  INITIAL_PAUSE_PROMPT,
  formatPauseReason,
  describePauseDetail,
  formatPauseStartedAt,
} from "@/components/runs/pausePrompt";
import { formatClock } from "@/components/runs/controlDecision";
import type { RunStateEnvelope } from "@/server/runState";

function statusReplyWith(run_state: unknown): any {
  return { uptime: 1, status: ToolStatus.BUSY, run_state };
}

type RunningEnvelope = Extract<RunStateEnvelope, { running: true }>;

function makeEnvelope(overrides: Partial<RunningEnvelope> = {}): RunningEnvelope {
  return {
    running: true,
    queueId: 7,
    runId: "run-1",
    toolId: "fast-1",
    toolType: "fast" as any,
    command: "transfer",
    status: "ok",
    runState: null,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("paused run reaches the prompt", () => {
  it("opens the prompt state with reason, detail and start time from a real paused run_state", async () => {
    const queue = new CommandQueue({} as any);
    queue.slackNotificationsEnabled = false;
    (globalThis as any)["__global_command_queue_key"] = queue;

    const fake = installFakeTool("fast-1", ToolType.fast);
    const grpc: FakeGrpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });
    grpc.getStatus.mockResolvedValue(
      statusReplyWith({
        state: "paused",
        percent: 40,
        pause: {
          errorCode: -645,
          errorName: "WrongPlateType",
          percent: 0,
          eventPayload: {
            wrongDetection: [{ expectedPlateID: 1, detectedPlateID: null, position: 3 }],
          },
          since: "2026-10-12T09:00:00Z",
        },
      }),
    );

    const step = deferred<any>();
    vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise);

    let loop: Promise<void> | undefined;

    try {
      await queue.commands.push({
        runId: "run-1",
        status: "CREATED",
        commandInfo: {
          toolId: "fast-1",
          toolType: ToolType.fast,
          command: "transfer",
          params: {},
        },
      } as any);
      loop = queue._start();

      await vi.waitFor(
        () => {
          expect(queue.runningStep).toBeDefined();
        },
        { timeout: 5000 },
      );

      const caller = commandQueueRouter.createCaller({});

      await vi.waitFor(
        async () => {
          const snapshot: any = await caller.runState();
          expect(snapshot.status).toBe("ok");
        },
        { timeout: 5000 },
      );

      const envelope: RunStateEnvelope = await caller.runState();
      const { state } = reducePausePrompt(INITIAL_PAUSE_PROMPT, { type: "poll", envelope });

      expect(state.isOpen).toBe(true);
      expect(state.episodeKey).toBe(`${queue.runningStep!.queueId}:2026-10-12T09:00:00Z`);
      expect(formatPauseReason(state.pause)).toBe("WrongPlateType (-645)");
      expect(describePauseDetail(state.pause!.detail)).toStrictEqual({
        lines: ["Deck 3: expected plate 1, found none"],
        raw: null,
      });

      const startedAtText = formatPauseStartedAt(
        "2026-10-12T09:00:00Z",
        Date.parse("2026-10-12T09:03:00Z"),
      );
      expect(startedAtText).not.toBeNull();
      expect(startedAtText!.endsWith(", 3 min ago")).toBe(true);
      expect(startedAtText!.startsWith(formatClock(Date.parse("2026-10-12T09:00:00Z")))).toBe(true);

      // D-14: observation never commands — the prompt never resolves/sends.
      expect(grpc.executeCommand).not.toHaveBeenCalled();

      step.resolve(undefined);
      await loop;
    } finally {
      if (!step.isSettled()) {
        step.resolve(undefined);
      }
      if (loop) {
        await loop;
      }
      await new Promise((resolve) => setImmediate(resolve));
      await removeFakeTool("fast-1");
      delete (globalThis as any)["__global_command_queue_key"];
      vi.restoreAllMocks();
    }
  });
});

describe("episode key", () => {
  it("uses queueId plus startedAt when startedAt is present", () => {
    const envelope = makeEnvelope({
      queueId: 7,
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "X", code: 1, detail: null, startedAt: "2026-01-01T00:00:00Z" },
      },
    });
    expect(pauseEpisodeKey(envelope)).toBe("7:2026-01-01T00:00:00Z");
  });

  it("falls back to name+code when startedAt is null", () => {
    const envelope = makeEnvelope({
      queueId: 7,
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "X", code: 1, detail: null, startedAt: null },
      },
    });
    expect(pauseEpisodeKey(envelope)).toBe("7:X:1");
  });

  it("uses 'unknown' for both name and code when both are null", () => {
    const envelope = makeEnvelope({
      queueId: 7,
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: null, code: null, detail: null, startedAt: null },
      },
    });
    expect(pauseEpisodeKey(envelope)).toBe("7:unknown:unknown");
  });

  it("is null when not running or pause is null", () => {
    expect(pauseEpisodeKey({ running: false })).toBeNull();
    expect(pauseEpisodeKey(makeEnvelope({ runState: null }))).toBeNull();
    expect(
      pauseEpisodeKey(makeEnvelope({ runState: { state: "running", percent: 0, pause: null } })),
    ).toBeNull();
  });
});

describe("hide and reopen", () => {
  it("hides the open episode and reopens it without losing the key", () => {
    const envelopeA = makeEnvelope({
      queueId: 7,
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "A", code: 1, detail: null, startedAt: "2026-01-01T00:00:00Z" },
      },
    });

    const opened = reducePausePrompt(INITIAL_PAUSE_PROMPT, { type: "poll", envelope: envelopeA });
    expect(opened.state.isOpen).toBe(true);
    const episodeKeyA = opened.state.episodeKey;

    const hidden = reducePausePrompt(opened.state, { type: "hide" });
    expect(hidden.state.isOpen).toBe(false);
    expect(hidden.state.episodeKey).toBe(episodeKeyA);

    const polledAgain = reducePausePrompt(hidden.state, { type: "poll", envelope: envelopeA });
    expect(polledAgain.state.isOpen).toBe(false);
    expect(polledAgain.state.episodeKey).toBe(episodeKeyA);

    const reopened = reducePausePrompt(polledAgain.state, { type: "reopen" });
    expect(reopened.state.isOpen).toBe(true);
    expect(reopened.state.episodeKey).toBe(episodeKeyA);
  });

  it("reopen is a no-op when there is no tracked pause", () => {
    const result = reducePausePrompt(INITIAL_PAUSE_PROMPT, { type: "reopen" });
    expect(result.state).toBe(INITIAL_PAUSE_PROMPT);
    expect(result.closedBy).toBeNull();
  });
});

describe("new episode reopens", () => {
  it("opens again with the new key after a new episode arrives while hidden", () => {
    const envelopeA = makeEnvelope({
      queueId: 7,
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "A", code: 1, detail: null, startedAt: "2026-01-01T00:00:00Z" },
      },
    });
    const envelopeB = makeEnvelope({
      queueId: 7,
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "A", code: 1, detail: null, startedAt: "2026-01-01T01:00:00Z" },
      },
    });

    const opened = reducePausePrompt(INITIAL_PAUSE_PROMPT, { type: "poll", envelope: envelopeA });
    const hidden = reducePausePrompt(opened.state, { type: "hide" });

    const reopened = reducePausePrompt(hidden.state, { type: "poll", envelope: envelopeB });
    expect(reopened.state.isOpen).toBe(true);
    expect(reopened.state.episodeKey).toBe("7:2026-01-01T01:00:00Z");
  });
});

describe("closes on resume", () => {
  it("closes to INITIAL-shaped state, keeping queueId, with closedBy 'resumed'", () => {
    const paused = makeEnvelope({
      queueId: 7,
      status: "ok",
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "A", code: 1, detail: null, startedAt: "2026-01-01T00:00:00Z" },
      },
    });
    const opened = reducePausePrompt(INITIAL_PAUSE_PROMPT, { type: "poll", envelope: paused });
    expect(opened.state.isOpen).toBe(true);

    const resumed = makeEnvelope({
      queueId: 7,
      status: "ok",
      runState: { state: "running", percent: 10, pause: null },
    });
    const closed = reducePausePrompt(opened.state, { type: "poll", envelope: resumed });

    expect(closed.closedBy).toBe("resumed");
    expect(closed.state).toStrictEqual({ ...INITIAL_PAUSE_PROMPT, queueId: 7 });

    const secondPoll = reducePausePrompt(closed.state, { type: "poll", envelope: resumed });
    expect(secondPoll.closedBy).toBeNull();
    expect(secondPoll.state).toBe(closed.state);
  });
});

describe("closes on step end", () => {
  it("closes on running:false and leaves an undefined envelope unchanged", () => {
    const paused = makeEnvelope({
      queueId: 7,
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "A", code: 1, detail: null, startedAt: "2026-01-01T00:00:00Z" },
      },
    });
    const opened = reducePausePrompt(INITIAL_PAUSE_PROMPT, { type: "poll", envelope: paused });

    const ended = reducePausePrompt(opened.state, { type: "poll", envelope: { running: false } });
    expect(ended.closedBy).toBe("step-ended");
    expect(ended.state).toStrictEqual(INITIAL_PAUSE_PROMPT);

    const pending = reducePausePrompt(INITIAL_PAUSE_PROMPT, { type: "poll", envelope: undefined });
    expect(pending.closedBy).toBeNull();
    expect(pending.state).toBe(INITIAL_PAUSE_PROMPT);
  });
});

describe("closes on step change", () => {
  it("ends the old episode when queueId changes, with or without a new pause", () => {
    const pausedOnSeven = makeEnvelope({
      queueId: 7,
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "A", code: 1, detail: null, startedAt: "2026-01-01T00:00:00Z" },
      },
    });
    const opened = reducePausePrompt(INITIAL_PAUSE_PROMPT, {
      type: "poll",
      envelope: pausedOnSeven,
    });

    const runningOnEight = makeEnvelope({
      queueId: 8,
      status: "ok",
      runState: { state: "running", percent: 0, pause: null },
    });
    const changed = reducePausePrompt(opened.state, { type: "poll", envelope: runningOnEight });
    expect(changed.closedBy).toBe("step-ended");
    expect(changed.state.isOpen).toBe(false);
    expect(changed.state.queueId).toBe(8);

    const pausedOnEight = makeEnvelope({
      queueId: 8,
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "B", code: 2, detail: null, startedAt: "2026-01-01T02:00:00Z" },
      },
    });
    const changedWithNewPause = reducePausePrompt(opened.state, {
      type: "poll",
      envelope: pausedOnEight,
    });
    expect(changedWithNewPause.closedBy).toBe("step-ended");
    expect(changedWithNewPause.state.isOpen).toBe(true);
    expect(changedWithNewPause.state.episodeKey).toBe("8:2026-01-01T02:00:00Z");
  });
});

describe("keeps open on unknown", () => {
  it("stays open on an unknown poll that still carries the last good pause, and is unchanged when runState is null", () => {
    const paused = makeEnvelope({
      queueId: 7,
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "A", code: 1, detail: null, startedAt: "2026-01-01T00:00:00Z" },
      },
    });
    const opened = reducePausePrompt(INITIAL_PAUSE_PROMPT, { type: "poll", envelope: paused });
    expect(opened.state.isOpen).toBe(true);

    const unknownStillPaused = makeEnvelope({
      queueId: 7,
      status: "unknown",
      lastError: "14 UNAVAILABLE",
      runState: {
        state: "paused",
        percent: 0,
        pause: { name: "A", code: 1, detail: null, startedAt: "2026-01-01T00:00:00Z" },
      },
    });
    const stillOpen = reducePausePrompt(opened.state, {
      type: "poll",
      envelope: unknownStillPaused,
    });
    expect(stillOpen.state.isOpen).toBe(true);
    expect(stillOpen.closedBy).toBeNull();

    const unknownNoRunState = makeEnvelope({
      queueId: 7,
      status: "unknown",
      lastError: "x",
      runState: null,
    });
    const unchanged = reducePausePrompt(opened.state, {
      type: "poll",
      envelope: unknownNoRunState,
    });
    expect(unchanged.state).toBe(opened.state);
    expect(unchanged.closedBy).toBeNull();
  });
});

describe("reason and detail edge cases", () => {
  it("formatPauseReason handles name only, code only and neither", () => {
    expect(formatPauseReason({ name: "X", code: null, detail: null, startedAt: null })).toBe("X");
    expect(formatPauseReason({ name: null, code: 5, detail: null, startedAt: null })).toBe(
      "Error code 5",
    );
    expect(formatPauseReason({ name: null, code: null, detail: null, startedAt: null })).toBeNull();
  });

  it("describePauseDetail covers known and unknown shapes", () => {
    expect(describePauseDetail(null)).toStrictEqual({ lines: [], raw: null });
    expect(describePauseDetail("plain <b>text</b>")).toStrictEqual({
      lines: ["plain <b>text</b>"],
      raw: null,
    });
    expect(
      describePauseDetail({
        wrongDetection: [{ expectedPlateID: 2, detectedPlateID: 5, position: 1 }],
      }),
    ).toStrictEqual({ lines: ["Deck 1: expected plate 2, found 5"], raw: null });

    const withExtra = describePauseDetail({
      wrongDetection: [{ expectedPlateID: 2, detectedPlateID: 5, position: 1 }],
      extra: 1,
    });
    expect(withExtra.lines).toStrictEqual(["Deck 1: expected plate 2, found 5"]);
    expect(withExtra.raw).not.toBeNull();
    expect(withExtra.raw).toContain("extra");

    const unrecognizedEntry = describePauseDetail({ wrongDetection: [{ foo: 1 }] });
    expect(unrecognizedEntry.lines).toStrictEqual([]);
    expect(unrecognizedEntry.raw).not.toBeNull();

    expect(describePauseDetail([1, 2])).toStrictEqual({ lines: [], raw: "[\n  1,\n  2\n]" });
  });

  it("formatPauseStartedAt handles null, invalid, sub-minute and multi-hour ages", () => {
    expect(formatPauseStartedAt(null, Date.now())).toBeNull();
    expect(formatPauseStartedAt("not a date", Date.now())).toBe("not a date");

    const thirtySecondsAgo = formatPauseStartedAt(
      new Date(Date.now() - 30_000).toISOString(),
      Date.now(),
    );
    expect(thirtySecondsAgo).toContain("less than a minute ago");

    const start = "2026-01-01T00:00:00Z";
    const twoHoursFiveMinutesLater = Date.parse(start) + (2 * 60 + 5) * 60 * 1000;
    expect(formatPauseStartedAt(start, twoHoursFiveMinutesLater)).toBe(
      `${formatClock(Date.parse(start))}, 2 h 5 min ago`,
    );
  });
});
