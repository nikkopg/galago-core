import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ToolType } from "gen-interfaces/controller";
import SqliteQueue from "@/server/utils/SqliteQueue";

describe("SqliteQueue.claimEligible", () => {
  let queue: SqliteQueue;

  beforeEach(() => {
    queue = new SqliteQueue(":memory:", "claim_queue");
  });

  afterEach(() => {
    queue.close();
  });

  async function pushOne(runId = "run-1") {
    await queue.push({
      runId,
      status: "CREATED",
      commandInfo: {
        toolId: "fast-1",
        toolType: ToolType.fast,
        command: "transfer",
        params: {},
      },
    } as any);
    const rows = await queue.all();
    return rows[rows.length - 1].queueId;
  }

  it("claims a CREATED row as STARTED and keeps it queued", async () => {
    const id = await pushOne();

    const claimed = queue.claimEligible(id);

    expect(claimed).not.toBe(false);
    expect(claimed && claimed.queueId).toBe(id);
    expect(claimed && claimed.status).toBe("STARTED");
    expect(queue.find(id)?.status).toBe("STARTED");
    expect(queue.queuedRowsSync().map((r) => r.queueId)).toContain(id);
  });

  it("claims a FAILED row again (operator retry path)", async () => {
    const id = await pushOne();
    await queue.fail(id, new Error("boom"));
    expect(queue.find(id)?.status).toBe("FAILED");

    const claimed = queue.claimEligible(id);

    expect(claimed).not.toBe(false);
    expect(claimed && claimed.status).toBe("STARTED");
    expect(queue.find(id)?.status).toBe("STARTED");
  });

  it("refuses a STARTED row claimed by an earlier claimEligible", async () => {
    const id = await pushOne();
    expect(queue.claimEligible(id)).not.toBe(false);

    expect(queue.claimEligible(id)).toBe(false);
    expect(queue.find(id)?.status).toBe("STARTED");
  });

  it("refuses a row startNext already started", async () => {
    const id = await pushOne();
    const started = await queue.startNext();
    expect(started && started.queueId).toBe(id);

    expect(queue.claimEligible(id)).toBe(false);
    expect(queue.find(id)?.status).toBe("STARTED");
  });

  it("refuses a row completed out of the queue and leaves COMPLETED", async () => {
    const id = await pushOne();
    await queue.complete(id);

    expect(queue.claimEligible(id)).toBe(false);
    expect(queue.find(id)?.status).toBe("COMPLETED");
  });

  it("refuses a row skipped out of the queue and leaves SKIPPED", async () => {
    const id = await pushOne();
    await queue.skip(id);

    expect(queue.claimEligible(id)).toBe(false);
    expect(queue.find(id)?.status).toBe("SKIPPED");
  });

  it("returns false for an unknown id without throwing", () => {
    expect(queue.claimEligible(999)).toBe(false);
  });

  it("claims only the named row, leaving the others untouched", async () => {
    const a = await pushOne();
    const b = await pushOne();

    expect(queue.claimEligible(b)).not.toBe(false);

    expect(queue.find(a)?.status).toBe("CREATED");
    expect(queue.find(b)?.status).toBe("STARTED");
  });

  it("is not an async function: it returns a value, not a Promise", async () => {
    const id = await pushOne();

    const result = queue.claimEligible(id);

    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof (result as { then?: unknown }).then).toBe("undefined");
    expect(queue.claimEligible(id)).toBe(false);
  });

  it("is declared without the async keyword in the source", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../server/utils/SqliteQueue.ts"),
      "utf8",
    );
    const match = source.match(/^[ \t]*(async[ \t]+)?claimEligible\(queueId: number\)/m);

    expect(match).not.toBeNull();
    expect(match && match[1]).toBeUndefined();
  });
});
