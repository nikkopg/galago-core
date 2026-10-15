import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import SqliteQueue from "@/server/utils/SqliteQueue";

describe("SqliteQueue", () => {
  let queue: SqliteQueue;

  beforeEach(async () => {
    queue = new SqliteQueue(":memory:", "test_queue");
  });

  afterEach(() => {
    queue.close();
  });

  async function pushTwo() {
    await queue.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    await queue.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    const [a, b] = await queue.all();
    return { aId: a.queueId, bId: b.queueId };
  }

  async function pushThree() {
    await queue.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    await queue.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    await queue.push({
      runId: "run-2",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    const [a1, a2, b1] = await queue.all();
    return { aId: a1.queueId, a2Id: a2.queueId, bId: b1.queueId };
  }

  it("fail keeps the step queued by default", async () => {
    const { aId } = await pushTwo();

    const started = await queue.startNext();
    expect((started as any).queueId).toBe(aId);

    await queue.fail(aId, new Error("boom"));
    expect(queue.find(aId).status).toBe("FAILED");

    const restarted = await queue.startNext();
    expect((restarted as any).queueId).toBe(aId);
    expect(queue.find(aId).status).toBe("STARTED");
  });

  it("failAndDequeueRun fails the step and dequeues the rest of its run", async () => {
    const { aId, a2Id, bId } = await pushThree();

    const started = await queue.startNext();
    expect((started as any).queueId).toBe(aId);

    const removed = await queue.failAndDequeueRun(aId, new Error("aborted"));
    expect(removed).toStrictEqual([a2Id]);

    const failedRecord = queue.find(aId);
    expect(failedRecord.status).toBe("FAILED");
    expect(failedRecord.failedAt).toBeDefined();
    expect((failedRecord.error as Error)?.message).toBe("aborted");

    const skippedRecord = queue.find(a2Id);
    expect(skippedRecord.status).toBe("SKIPPED");

    const all = await queue.all();
    expect(all.map((c) => c.queueId)).toStrictEqual([aId, a2Id, bId]);

    const paginated = await queue.getPaginated();
    expect(paginated.map((c) => c.queueId)).toStrictEqual([bId]);

    const next = await queue.startNext();
    expect((next as any).queueId).toBe(bId);

    await queue.complete(bId);
    expect(await queue.startNext()).toBe(false);
  });

  it("failAndDequeueRun resolves to [] when the run has nothing else queued, and leaves the other run's step queued", async () => {
    await queue.push({
      runId: "run-1",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    await queue.push({
      runId: "run-2",
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    const [a, b] = await queue.all();

    const started = await queue.startNext();
    expect((started as any).queueId).toBe(a.queueId);

    const removed = await queue.failAndDequeueRun(a.queueId, new Error("aborted"));
    expect(removed).toStrictEqual([]);

    expect(queue.find(a.queueId).status).toBe("FAILED");

    const paginated = await queue.getPaginated();
    expect(paginated.map((c) => c.queueId)).toStrictEqual([b.queueId]);
  });

  it("dequeue removes a failed step from the queue without changing its record", async () => {
    const { aId, bId } = await pushTwo();

    const started = await queue.startNext();
    expect((started as any).queueId).toBe(aId);

    await queue.fail(aId, new Error("boom"));
    const failedAtBeforeDequeue = queue.find(aId).failedAt;

    await queue.dequeue(aId);

    const record = queue.find(aId);
    expect(record.status).toBe("FAILED");
    expect(record.failedAt).toStrictEqual(failedAtBeforeDequeue);

    const next = await queue.startNext();
    expect((next as any).queueId).toBe(bId);

    await expect(queue.dequeue(aId)).resolves.not.toThrow();
    await expect(queue.dequeue(99999)).resolves.not.toThrow();
  });
});
