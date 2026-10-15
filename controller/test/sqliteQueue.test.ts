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

  it("fail with dequeue removes the step from the queue but keeps its record", async () => {
    const { aId, bId } = await pushTwo();

    const started = await queue.startNext();
    expect((started as any).queueId).toBe(aId);

    await queue.fail(aId, new Error("aborted"), { dequeue: true });

    const failedRecord = queue.find(aId);
    expect(failedRecord.status).toBe("FAILED");
    expect(failedRecord.failedAt).toBeDefined();
    expect((failedRecord.error as Error)?.message).toBe("aborted");

    const all = await queue.all();
    expect(all.map((c) => c.queueId)).toContain(aId);

    const paginated = await queue.getPaginated();
    expect(paginated.map((c) => c.queueId)).toStrictEqual([bId]);

    const next = await queue.startNext();
    expect((next as any).queueId).toBe(bId);

    await queue.complete(bId);
    expect(await queue.startNext()).toBe(false);
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
