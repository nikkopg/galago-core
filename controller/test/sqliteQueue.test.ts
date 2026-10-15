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

  async function pushRunPair(runId1: string, runId2: string) {
    const before = await queue.all();
    const beforeIds = new Set(before.map((c) => c.queueId));
    await queue.push({
      runId: runId1,
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    await queue.push({
      runId: runId1,
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    await queue.push({
      runId: runId2,
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    const after = await queue.all();
    const [a1, a2, b1] = after.filter((c) => !beforeIds.has(c.queueId));
    return { aId: a1.queueId, a2Id: a2.queueId, bId: b1.queueId };
  }

  it("failAndDequeueRun resolves to false and changes nothing when the step's row was removed", async () => {
    // (i) clearByRunId removes the running step's row; the other run's step
    // stays queued, CREATED and untouched.
    {
      const { aId, bId } = await pushThree();

      const started = await queue.startNext();
      expect((started as any).queueId).toBe(aId);

      await queue.clearByRunId("run-1");

      const removed = await queue.failAndDequeueRun(aId, new Error("aborted"));
      expect(removed).toBe(false);

      const all = await queue.all();
      expect(all.map((c) => c.queueId)).toStrictEqual([bId]);
      expect(queue.find(bId).status).toBe("CREATED");

      const paginated = await queue.getPaginated();
      expect(paginated.map((c) => c.queueId)).toStrictEqual([bId]);
    }

    // Drain bId (still CREATED and queued from part (i)) so the next
    // startNext reaches the fresh row pushed below.
    await queue.startNext();
    await queue.complete((await queue.all()).find((c) => c.runId === "run-2")!.queueId);

    // (ii) Clear All on a fresh started row.
    {
      await queue.push({
        runId: "run-3",
        status: "CREATED",
        commandInfo: {
          toolId: "fast-1",
          toolType: ToolType.fast,
          command: "transfer",
          params: {},
        },
      } as any);
      const freshRow = (await queue.all()).find((c) => c.runId === "run-3")!;

      const started = await queue.startNext();
      expect((started as any).queueId).toBe(freshRow.queueId);

      await queue.clearAll();

      const removed = await queue.failAndDequeueRun(freshRow.queueId, new Error("aborted"));
      expect(removed).toBe(false);

      expect(await queue.all()).toStrictEqual([]);
    }
  });

  it("dequeueFailedRun removes a failed step from the queue without changing its record", async () => {
    const { aId, a2Id, bId } = await pushThree();

    await queue.startNext();
    await queue.fail(aId, new Error("boom"));
    const failedAtBeforeDequeue = queue.find(aId).failedAt;

    const removed = await queue.dequeueFailedRun(aId, "run-1");
    expect(removed).toStrictEqual([a2Id]);

    const record = queue.find(aId);
    expect(record.status).toBe("FAILED");
    expect(record.failedAt).toStrictEqual(failedAtBeforeDequeue);

    expect(queue.find(a2Id).status).toBe("SKIPPED");

    const paginated = await queue.getPaginated();
    expect(paginated.map((c) => c.queueId)).toStrictEqual([bId]);
  });

  it("dequeueFailedRun refuses and changes nothing unless the row is still the FAILED, still-queued attempt of that run", async () => {
    // Re-queued via gotoCommandByIndex: status is CREATED, no longer FAILED.
    {
      const { aId, a2Id } = await pushRunPair("run-r1", "run-r1b");
      await queue.startNext();
      await queue.fail(aId, new Error("boom"));
      await queue.gotoCommandByIndex("run-r1", 0);
      expect(queue.find(aId).status).toBe("CREATED");
      const before = (await queue.getPaginated()).map((c) => c.queueId);

      const result = await queue.dequeueFailedRun(aId, "run-r1");

      expect(result).toBe(false);
      expect((await queue.getPaginated()).map((c) => c.queueId)).toStrictEqual(before);
      expect(queue.find(aId).status).toBe("CREATED");
      expect(queue.find(a2Id).status).toBe("CREATED");
    }

    // Re-queued and running again: status is STARTED, not FAILED.
    {
      const { aId } = await pushRunPair("run-r2", "run-r2b");
      await queue.startNext();
      await queue.fail(aId, new Error("boom"));
      await queue.gotoCommandByIndex("run-r2", 0);
      await queue.startNext();
      expect(queue.find(aId).status).toBe("STARTED");
      const before = (await queue.getPaginated()).map((c) => c.queueId);

      const result = await queue.dequeueFailedRun(aId, "run-r2");

      expect(result).toBe(false);
      expect((await queue.getPaginated()).map((c) => c.queueId)).toStrictEqual(before);
      expect(queue.find(aId).status).toBe("STARTED");
    }

    // A runId that does not match the row's run_id.
    {
      const { aId, a2Id } = await pushRunPair("run-r3", "run-r3b");
      await queue.startNext();
      await queue.fail(aId, new Error("boom"));
      const before = (await queue.getPaginated()).map((c) => c.queueId);

      const result = await queue.dequeueFailedRun(aId, "wrong-run");

      expect(result).toBe(false);
      expect((await queue.getPaginated()).map((c) => c.queueId)).toStrictEqual(before);
      expect(queue.find(aId).status).toBe("FAILED");
      expect(queue.find(a2Id).status).toBe("CREATED");
    }

    // FAILED but already out of the queue (removed by failAndDequeueRun).
    {
      const { aId } = await pushRunPair("run-r4", "run-r4b");
      await queue.startNext();
      await queue.failAndDequeueRun(aId, new Error("aborted"));
      expect(queue.find(aId).status).toBe("FAILED");
      const before = (await queue.getPaginated()).map((c) => c.queueId);

      const result = await queue.dequeueFailedRun(aId, "run-r4");

      expect(result).toBe(false);
      expect((await queue.getPaginated()).map((c) => c.queueId)).toStrictEqual(before);
      expect(queue.find(aId).status).toBe("FAILED");
    }

    // A missing id.
    {
      const result = await queue.dequeueFailedRun(99999, "run-missing");
      expect(result).toBe(false);
    }
  });

  it("recoverInterruptedSteps fails orphaned STARTED rows and dequeues their run's remainder", async () => {
    const { aId, a2Id, bId } = await pushThree();
    await queue.startNext();

    const recovered = queue.recoverInterruptedSteps(new Error("interrupted"));
    expect(recovered).toStrictEqual([
      { queueId: aId, runId: "run-1", toolId: "fast-1", remainder: [a2Id] },
    ]);

    const aRecord = queue.find(aId);
    expect(aRecord.status).toBe("FAILED");
    expect((aRecord.error as Error)?.message).toBe("interrupted");

    expect(queue.find(a2Id).status).toBe("SKIPPED");
    expect(queue.find(bId).status).toBe("CREATED");

    const paginated = await queue.getPaginated();
    expect(paginated.map((c) => c.queueId)).toStrictEqual([bId]);

    const second = queue.recoverInterruptedSteps(new Error("interrupted"));
    expect(second).toStrictEqual([]);
  });

  it("recoverInterruptedSteps reports a run once when more than one of its rows was left STARTED", async () => {
    const { aId, a2Id, bId } = await pushThree();
    (queue as any)._updateItem(aId, { status: "STARTED" });
    (queue as any)._updateItem(a2Id, { status: "STARTED" });

    const recovered = queue.recoverInterruptedSteps(new Error("interrupted"));
    expect(recovered).toStrictEqual([
      { queueId: aId, runId: "run-1", toolId: "fast-1", remainder: [a2Id] },
    ]);

    expect(queue.find(aId).status).toBe("FAILED");
    expect(queue.find(a2Id).status).toBe("FAILED");
    expect(queue.find(bId).status).toBe("CREATED");

    const paginated = await queue.getPaginated();
    expect(paginated.map((c) => c.queueId)).toStrictEqual([bId]);

    expect(queue.recoverInterruptedSteps(new Error("interrupted"))).toStrictEqual([]);
  });
});
