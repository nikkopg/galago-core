import { describe, it, expect, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { commandQueueRouter } from "@/server/routers/command_queue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";
import {
  reducePausePrompt,
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
