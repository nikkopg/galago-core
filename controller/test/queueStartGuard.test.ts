// QUE-07 / QUE-08 / QUE-09: single-flight Start guard and Start audit log.
// Fakes only: FakeGrpc and a Tool.executeCommand spy. No real gRPC endpoint is
// ever contacted, so no test can move an instrument.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { logAction } from "@/server/logger";
import { commandQueueRouter } from "@/server/routers/command_queue";
import {
  describeQueueStart,
  describeQueueStartReadFailure,
  MAX_LISTED_QUEUE_ROWS,
} from "@/server/queueStartListing";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";

function row(runId: string, tag: string) {
  return {
    runId,
    status: "CREATED",
    commandInfo: {
      toolId: "fast-1",
      toolType: ToolType.fast,
      command: "transfer",
      params: { tag },
    },
  } as any;
}

function logs(action: string) {
  return vi
    .mocked(logAction)
    .mock.calls.map(([entry]) => entry as { level: string; action: string; details: string })
    .filter((entry) => entry.action === action);
}

describe("queue start guard", () => {
  let queue: CommandQueue;
  let grpc: FakeGrpc;
  let step: ReturnType<typeof deferred<any>>;
  let loops: Array<Promise<void>>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    queue = new CommandQueue({} as any);
    queue.slackNotificationsEnabled = false;
    (globalThis as any)["__global_command_queue_key"] = queue;

    const fake = installFakeTool("fast-1", ToolType.fast);
    grpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });

    step = deferred<any>();
    loops = [];
  });

  afterEach(async () => {
    if (!step.isSettled()) {
      step.resolve(undefined);
    }
    await vi.advanceTimersByTimeAsync(1500 * 10);
    await Promise.all(loops);
    vi.useRealTimers();
    await new Promise((resolve) => setImmediate(resolve));

    await removeFakeTool("fast-1");
    delete (globalThis as any)["__global_command_queue_key"];
    vi.restoreAllMocks();
  });

  function holdStep() {
    return vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise);
  }

  function start(source?: "operator" | "enqueue") {
    const p = queue._start(source);
    loops.push(p);
    return p;
  }

  it("a second Start through the restart router while a step is in flight is ignored", async () => {
    const spy = holdStep();
    await queue.commands.push(row("run-1", "r1"));

    const l1 = start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(queue.runningStep).toBeDefined();
    const inFlightQueueId = queue.runningStep!.queueId;

    await expect(commandQueueRouter.createCaller({}).restart()).resolves.toEqual({
      accepted: false,
    });
    await vi.advanceTimersByTimeAsync(3000);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(queue.state).toBe(ToolStatus.BUSY);

    const ignored = logs("Queue Start Ignored");
    expect(ignored).toHaveLength(1);
    expect(ignored[0].level).toBe("warning");
    expect(ignored[0].details).toContain("source=operator");
    expect(ignored[0].details).toContain(`inFlightQueueId=${inFlightQueueId}`);
    expect(logs("Queue Started")).toHaveLength(1);

    step.resolve(undefined);
    await vi.advanceTimersByTimeAsync(3000);
    await l1;
  });

  it("two Starts in the same tick log one Queue Started and dispatch the row once", async () => {
    const spy = holdStep();
    await queue.commands.push(row("run-1", "r1"));

    const a = start();
    const b = start();
    await b;

    expect(logs("Queue Started")).toHaveLength(1);
    const ignored = logs("Queue Start Ignored");
    expect(ignored).toHaveLength(1);
    expect(ignored[0].details).toContain("inFlightQueueId=unknown");

    await vi.advanceTimersByTimeAsync(1500);
    expect(spy).toHaveBeenCalledTimes(1);

    step.resolve(undefined);
    await vi.advanceTimersByTimeAsync(3000);
    await a;
  });

  it("Pause queue then Start while the step is in flight is ignored until the step ends", async () => {
    const spy = holdStep();
    await queue.commands.push(row("run-1", "r1"));
    await queue.commands.push(row("run-2", "r2"));

    const l1 = start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(queue.runningStep).toBeDefined();

    const stopP = queue.stop();
    await queue._start();

    expect(queue.state).toBe(ToolStatus.OFFLINE);
    expect(queue.state).not.toBe(ToolStatus.READY);
    expect(logs("Queue Start Ignored")).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);

    step.resolve(undefined);
    spy.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(3000);
    await stopP;
    await l1;

    const l2 = start();
    await vi.advanceTimersByTimeAsync(4500);
    await l2;

    expect(spy).toHaveBeenCalledTimes(2);
    expect((spy.mock.calls[1][0] as any).params.tag).toBe("r2");
  });

  it("enqueueRun while the loop owns the queue dispatches nothing extra", async () => {
    const spy = holdStep();
    await queue.commands.push(row("run-1", "r1"));

    const l1 = start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(queue.runningStep).toBeDefined();

    await queue.enqueueRun({
      id: "run-2",
      protocolName: "p",
      commands: [row("run-2", "r2")],
    } as any);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(logs("Queue Start Ignored")).toHaveLength(0);

    // Force the auto-start path: enqueueRun only starts when the queue is READY.
    (queue as any)._setState(ToolStatus.READY);
    await queue.enqueueRun({
      id: "run-3",
      protocolName: "p",
      commands: [row("run-3", "r3")],
    } as any);
    const ignored = logs("Queue Start Ignored");
    expect(ignored).toHaveLength(1);
    expect(ignored[0].details).toContain("source=enqueue");
    expect(spy).toHaveBeenCalledTimes(1);

    (queue as any)._setState(ToolStatus.BUSY);
    step.resolve(undefined);
    spy.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(1500 * 4);
    await l1;

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls.map(([info]) => (info as any).params.tag)).toEqual(["r1", "r2", "r3"]);
  });

  it("restart reports accepted when nothing owns the queue", async () => {
    holdStep().mockResolvedValue(undefined);
    await queue.commands.push(row("run-1", "r1"));

    await expect(commandQueueRouter.createCaller({}).restart()).resolves.toEqual({
      accepted: true,
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(logs("Queue Start Ignored")).toHaveLength(0);
  });

  it("a pending failure alert does not hold the queue: the retry Start is accepted (WR-01)", async () => {
    // The Slack/email alert never settles; before WR-01 the loop awaited it and
    // kept the single-flight claim, so the operator's retry Start was ignored.
    vi.spyOn(queue as any, "_notifyFailure").mockReturnValue(new Promise(() => {}));
    const spy = holdStep();
    spy.mockRejectedValueOnce(new Error("tool refused"));
    await queue.commands.push(row("run-1", "r1"));

    const l1 = start();
    await vi.advanceTimersByTimeAsync(3000);
    await l1;
    expect(queue.state).toBe(ToolStatus.FAILED);
    expect(queue.isStartInProgress).toBe(false);

    spy.mockResolvedValue(undefined);
    await expect(commandQueueRouter.createCaller({}).restart()).resolves.toEqual({
      accepted: true,
    });
    await vi.advanceTimersByTimeAsync(3000);

    expect(logs("Queue Start Ignored")).toHaveLength(0);
    expect(spy).toHaveBeenCalledTimes(2);
    expect((spy.mock.calls[1][0] as any).params.tag).toBe("r1");
  });

  describe("queue start listing", () => {
    // No Tool.executeCommand spy here: the real reply path runs against FakeGrpc.
    it("queuedRowsSync returns the paginated order and drops completed rows", async () => {
      await queue.commands.push(row("run-a", "a"));
      await queue.commands.push(row("run-b", "b"));
      await queue.commands.push(row("run-c", "c"));

      const sync = queue.commands.queuedRowsSync();
      const paged = await queue.commands.getPaginated(0, 20000);
      expect(sync.map((r) => r.queueId)).toEqual(paged.map((r) => r.queueId));
      expect(sync).toHaveLength(3);

      await queue.commands.complete(sync[1].queueId);
      expect(queue.commands.queuedRowsSync().map((r) => r.queueId)).toEqual([
        sync[0].queueId,
        sync[2].queueId,
      ]);
    });

    it("F5 recipe A: a FAILED retry, a leftover row and a new row run in order and are listed", async () => {
      await queue.commands.push(row("run-old-1", "row4"));
      await queue.commands.push(row("run-old-2", "row5"));
      grpc.executeCommand.mockResolvedValueOnce({
        response: ResponseCode.INVALID_ARGUMENTS,
        error_message: "x",
        return_reply: true,
      });

      const p1 = start();
      await vi.advanceTimersByTimeAsync(1500);
      await p1;
      expect(queue.state).toBe(ToolStatus.FAILED);
      const afterFail = await queue.commands.getPaginated(0, 20);
      expect(afterFail.map((r) => r.status)).toEqual(["FAILED", "CREATED"]);
      const row4Id = afterFail[0].queueId;
      const row5Id = afterFail[1].queueId;

      await queue.commands.push(row("run-new", "row6"));
      await queue.clearError();
      vi.mocked(logAction).mockClear();

      const p2 = start();
      await vi.advanceTimersByTimeAsync(1500 * 4);
      await p2;

      const dispatched = grpc.executeCommand.mock.calls.map(
        ([payload]) => payload.fast.transfer.tag,
      );
      expect(dispatched).toEqual(["row4", "row4", "row5", "row6"]);
      const all = await queue.commands.all();
      expect(all.map((r) => r.status)).toEqual(["COMPLETED", "COMPLETED", "COMPLETED"]);

      const started = logs("Queue Started");
      expect(started).toHaveLength(1);
      const details = started[0].details;
      const row6Id = all[2].queueId;
      expect(details).toContain(`queueId=${row4Id} runId=run-old-1 status=FAILED`);
      const i4 = details.indexOf(`queueId=${row4Id} `);
      const i5 = details.indexOf(`queueId=${row5Id} `);
      const i6 = details.indexOf(`queueId=${row6Id} `);
      expect(i4).toBeGreaterThan(-1);
      expect(i5).toBeGreaterThan(i4);
      expect(i6).toBeGreaterThan(i5);
    });

    it("an ignored Start writes no Queue Started entry", async () => {
      await queue.commands.push(row("run-1", "r1"));
      const a = start();
      const b = start();
      await b;
      expect(logs("Queue Started")).toHaveLength(1);
      expect(logs("Queue Start Ignored")).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1500 * 3);
      await a;
      expect(grpc.executeCommand).toHaveBeenCalledTimes(1);
    });

    it("the enqueueRun auto-start writes the automatic prefix", async () => {
      await queue.commands.push(row("run-old", "old"));
      grpc.executeCommand.mockResolvedValueOnce({
        response: ResponseCode.INVALID_ARGUMENTS,
        error_message: "x",
        return_reply: true,
      });
      const p1 = start();
      await vi.advanceTimersByTimeAsync(1500);
      await p1;
      expect(queue.state).toBe(ToolStatus.FAILED);

      await queue.clearError();
      expect(queue.state).toBe(ToolStatus.READY);
      vi.mocked(logAction).mockClear();

      await queue.enqueueRun({
        id: "run-new",
        protocolName: "p",
        commands: [row("run-new", "new")],
      } as any);
      await vi.advanceTimersByTimeAsync(1500 * 4);

      const started = logs("Queue Started");
      expect(started).toHaveLength(1);
      expect(
        started[0].details.startsWith(
          "Command Queue started automatically after a run was enqueued.",
        ),
      ).toBe(true);
      expect(started[0].details).toContain("status=FAILED");
    });
  });
});

describe("describeQueueStart", () => {
  it("reports an empty queue", () => {
    expect(describeQueueStart([], "operator")).toBe(
      "Command Queue started by user. The queue is empty.",
    );
  });

  it("lists rows in order with failed retries and distinct runs", () => {
    expect(
      describeQueueStart(
        [
          { queueId: 4, runId: "r-old-1", status: "FAILED" },
          { queueId: 5, runId: "r-old-2", status: "CREATED" },
          { queueId: 6, runId: "r-new", status: "CREATED" },
        ],
        "operator",
      ),
    ).toBe(
      "Command Queue started by user. Will run 3 queued steps from 3 runs; 1 failed before and will be retried first. Queue order: queueId=4 runId=r-old-1 status=FAILED; queueId=5 runId=r-old-2 status=CREATED; queueId=6 runId=r-new status=CREATED",
    );
  });

  it("uses the automatic prefix and singular nouns for enqueue", () => {
    expect(describeQueueStart([{ queueId: 1, runId: "a", status: "CREATED" }], "enqueue")).toBe(
      "Command Queue started automatically after a run was enqueued. Will run 1 queued step from 1 run. Queue order: queueId=1 runId=a status=CREATED",
    );
  });

  it("caps the listing at MAX_LISTED_QUEUE_ROWS and counts the rest", () => {
    expect(MAX_LISTED_QUEUE_ROWS).toBe(50);
    const rows = Array.from({ length: 60 }, (_, i) => ({
      queueId: i + 1,
      runId: `r${i}`,
      status: "CREATED",
    }));
    const text = describeQueueStart(rows, "operator");
    expect(text.match(/queueId=/g)).toHaveLength(50);
    expect(text.endsWith("; ... and 10 more")).toBe(true);
    expect(text).toContain("Will run 60 queued steps from 60 runs");
  });

  it("lists a STARTED row but does not count it", () => {
    const text = describeQueueStart(
      [
        { queueId: 1, runId: "a", status: "STARTED" },
        { queueId: 2, runId: "b", status: "CREATED" },
      ],
      "operator",
    );
    expect(text).toContain("status=STARTED");
    expect(text).toContain("Will run 1 queued step from 1 run");
  });

  it("describes a read failure", () => {
    expect(describeQueueStartReadFailure("operator", new Error("disk I/O error"))).toBe(
      "Command Queue started by user. The queued steps could not be read: disk I/O error",
    );
    expect(describeQueueStartReadFailure("enqueue", "boom")).toBe(
      "Command Queue started automatically after a run was enqueued. The queued steps could not be read: boom",
    );
  });
});
