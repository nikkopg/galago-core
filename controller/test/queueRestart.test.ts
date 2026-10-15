import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { ToolType } from "gen-interfaces/controller";
import { ResponseCode, ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { CommandQueue } from "@/server/command_queue";
import Tool from "@/server/tools";
import { logAction } from "@/server/logger";
import SqliteQueue from "@/server/utils/SqliteQueue";
import { installFakeTool, removeFakeTool, deferred, FakeGrpc } from "./helpers/fakeTool";

// Mirrors toolControl.test.ts's harness, but each test seeds a real,
// file-backed queue.db in its own temp dir so a real two-instance restart
// (a "previous process" SqliteQueue, then a new CommandQueue) can be
// exercised on one DB file. Never touches the real queue.db or app.db
// (T-01-01): SQLITE_DB_PATH is only ever pointed at the temp file and is
// always restored to ":memory:" in a finally.
describe("queueRestart", () => {
  let grpc: FakeGrpc;
  let step: ReturnType<typeof deferred<any>>;
  let loop: Promise<void> | undefined;
  let installedToolIds: string[];
  let tmpDir: string;
  let dbPath: string;
  let queue: CommandQueue | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "galago-queue-restart-"));
    dbPath = path.join(tmpDir, "queue.db");

    installedToolIds = ["fast-1"];
    const fake = installFakeTool("fast-1", ToolType.fast);
    grpc = fake.grpc;
    grpc.executeCommand.mockResolvedValue({ response: ResponseCode.SUCCESS, return_reply: true });

    step = deferred<any>();
    vi.spyOn(Tool, "executeCommand").mockImplementation(() => step.promise);

    loop = undefined;
    queue = undefined;
  });

  afterEach(async () => {
    if (!step.isSettled()) {
      step.resolve(undefined);
    }
    if (loop) {
      await loop;
    }
    await new Promise((resolve) => setImmediate(resolve));

    if (queue) {
      queue.commands.close();
    }

    for (const id of installedToolIds) {
      await removeFakeTool(id);
    }
    vi.restoreAllMocks();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function pushLabeledStep(seeder: SqliteQueue, runId: string, label: string) {
    await seeder.push({
      runId,
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: { step: label },
      },
    } as any);
  }

  it("a step left STARTED by a previous process is failed at construction and never re-dispatched", async () => {
    // Seed the "previous process".
    const seeder = new SqliteQueue(dbPath, "command_queue_2");
    await pushLabeledStep(seeder, "run-1", "a1");
    await pushLabeledStep(seeder, "run-1", "a2");
    await pushLabeledStep(seeder, "run-2", "b1");
    const [a1, a2, b1] = await seeder.all();
    const aId = a1.queueId;
    const a2Id = a2.queueId;
    const bId = b1.queueId;
    await seeder.startNext();
    seeder.close();

    process.env.SQLITE_DB_PATH = dbPath;
    try {
      queue = new CommandQueue({} as any);
      queue.slackNotificationsEnabled = false;
    } finally {
      process.env.SQLITE_DB_PATH = ":memory:";
    }

    expect(queue.commands.find(aId).status).toBe("FAILED");
    expect((queue.commands.find(aId).error as Error)?.message).toMatch(/restart/);
    expect(queue.commands.find(a2Id).status).toBe("SKIPPED");
    expect((await queue.commands.getPaginated()).map((c) => c.queueId)).toStrictEqual([bId]);

    const interruptedLogs = vi
      .mocked(logAction)
      .mock.calls.map(([call]) => call as { level: string; action: string; details: string })
      .filter((call) => call.action === "Interrupted Step Failed");
    expect(interruptedLogs.length).toBeGreaterThan(0);
    expect(interruptedLogs[0].details).toContain(`queueId=${aId}`);

    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue!.runningStep?.queueId).toBe(bId);
      },
      { timeout: 5000 },
    );

    const executeCalls = vi.mocked(Tool.executeCommand).mock.calls;
    expect(executeCalls.length).toBe(1);
    expect(executeCalls[0][0]).toMatchObject({ params: { step: "b1" } });

    step.resolve(undefined);
    await loop;

    expect(queue.commands.find(bId).status).toBe("COMPLETED");
    expect(queue.commands.find(aId).status).toBe("FAILED");
  });

  it("the queue will not start while interrupted-step recovery keeps failing", async () => {
    const seeder = new SqliteQueue(dbPath, "command_queue_2");
    await pushLabeledStep(seeder, "run-1", "a1");
    await pushLabeledStep(seeder, "run-1", "a2");
    await pushLabeledStep(seeder, "run-2", "b1");
    const [a1] = await seeder.all();
    const aId = a1.queueId;
    await seeder.startNext();
    seeder.close();

    const recoverSpy = vi
      .spyOn(SqliteQueue.prototype, "recoverInterruptedSteps")
      .mockImplementation(() => {
        throw new Error("recovery boom");
      });

    process.env.SQLITE_DB_PATH = dbPath;
    try {
      queue = new CommandQueue({} as any);
      queue.slackNotificationsEnabled = false;
    } finally {
      process.env.SQLITE_DB_PATH = ":memory:";
    }

    const recoveryFailedLogs = vi
      .mocked(logAction)
      .mock.calls.map(([call]) => call as { level: string; action: string; details: string })
      .filter((call) => call.action === "Interrupted Step Recovery Failed");
    expect(recoveryFailedLogs.length).toBeGreaterThan(0);

    await queue._start();

    expect(queue.state).toBe(ToolStatus.FAILED);
    expect(vi.mocked(Tool.executeCommand)).not.toHaveBeenCalled();
    expect(queue.commands.find(aId).status).toBe("STARTED");

    recoverSpy.mockRestore();

    step = deferred<any>();
    loop = queue._start();

    await vi.waitFor(
      () => {
        expect(queue!.runningStep).toBeDefined();
      },
      { timeout: 5000 },
    );

    expect(queue.commands.find(aId).status).toBe("FAILED");

    step.resolve(undefined);
    await loop;
  });
});
