import { describe, it, expect, vi, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import Tool from "@/server/tools";
import { db } from "@/db/client";
import { logAction } from "@/server/logger";
import { CommandQueue } from "@/server/command_queue";
import { installFakeTool, removeFakeTool, deferred } from "./helpers/fakeTool";

describe("unit-test infrastructure", () => {
  it("resolves the @/ and gen-interfaces/ aliases", () => {
    expect(ToolType.fast).toBe("fast");
    expect(typeof Tool.forId).toBe("function");
  });

  it("mocks the database and the audit logger", () => {
    expect((db as any).__unitTestMock).toBe(true);
    expect(vi.isMockFunction(logAction)).toBe(true);
  });

  it("constructs a CommandQueue on in-memory SQLite", async () => {
    const queue = new CommandQueue({} as any);
    expect(await queue.allCommands()).toEqual([]);
    expect(process.env.SQLITE_DB_PATH).toBe(":memory:");
  });
});

describe("fake tool double", () => {
  const installedIds: string[] = [];

  afterEach(async () => {
    while (installedIds.length > 0) {
      const id = installedIds.pop()!;
      await removeFakeTool(id);
    }
  });

  it("drives a real Tool through a fake gRPC client with no network", async () => {
    const { tool, grpc } = installFakeTool("fake-fast", ToolType.fast);
    installedIds.push("fake-fast");

    grpc.getStatus.mockResolvedValue({ uptime: 7, status: "READY" });

    await tool.fetchStatus();

    expect(tool.status).toBe("READY");
    expect(tool.uptime).toBe(7);
    expect(grpc.getStatus).toHaveBeenCalledTimes(1);
    expect(grpc.getStatus).toHaveBeenCalledWith({});
  });

  it("tracks settlement of a deferred promise", async () => {
    const d = deferred<void>();
    expect(d.isSettled()).toBe(false);
    d.resolve();
    await d.promise;
    expect(d.isSettled()).toBe(true);
  });

  it("returns a fresh Tool after removeFakeTool deletes the store entry", async () => {
    const { tool: firstTool } = installFakeTool("fake-fast", ToolType.fast);
    installedIds.push("fake-fast");

    await removeFakeTool("fake-fast");
    installedIds.pop();

    const secondTool = Tool.forId("fake-fast", "127.0.0.1", 1, ToolType.fast);
    installedIds.push("fake-fast");

    expect(secondTool).not.toBe(firstTool);
  });
});
