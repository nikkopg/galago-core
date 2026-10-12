import { describe, it, expect, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import Tool from "@/server/tools";
import { db } from "@/db/client";
import { logAction } from "@/server/logger";
import { CommandQueue } from "@/server/command_queue";

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
