import { describe, it, expect, afterEach, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { logAction } from "@/server/logger";
import { installFakeTool, removeFakeTool } from "./helpers/fakeTool";

describe("heartbeat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([ToolType.fast, ToolType.pf400])(
    "keeps polling after a failure and recovers (%s)",
    async (toolType) => {
      const toolId = `hb-${toolType}`;
      const { tool, grpc } = installFakeTool(toolId, toolType);

      grpc.getStatus
        .mockRejectedValueOnce(new Error("14 UNAVAILABLE"))
        .mockRejectedValueOnce(new Error("14 UNAVAILABLE"))
        .mockResolvedValue({ uptime: 9, status: ToolStatus.READY });

      tool.startHeartbeat(10);

      try {
        await vi.waitFor(() => expect(tool.status).toBe(ToolStatus.READY), { timeout: 2000 });
        expect(grpc.getStatus.mock.calls.length).toBeGreaterThanOrEqual(3);
      } finally {
        tool.stopHeartbeat();
        await removeFakeTool(toolId);
      }
    },
  );

  it("a failed poll returns UNKNOWN and changes only the tool status", async () => {
    const toolId = "hb-single-failure";
    const { tool, grpc } = installFakeTool(toolId, ToolType.fast);

    grpc.getStatus.mockRejectedValueOnce(new Error("14 UNAVAILABLE"));

    try {
      const result = await tool.fetchStatus();
      expect(result).toStrictEqual({ uptime: 0, status: ToolStatus.UNKNOWN_STATUS });
      expect(tool.status).toBe(ToolStatus.UNKNOWN_STATUS);
    } finally {
      tool.stopHeartbeat();
      await removeFakeTool(toolId);
    }
  });

  it("logs once per failure streak and once on recovery", async () => {
    const toolId = "hb-log-dedup";
    const { tool, grpc } = installFakeTool(toolId, ToolType.fast);

    try {
      grpc.getStatus.mockRejectedValueOnce(new Error("14 UNAVAILABLE"));
      grpc.getStatus.mockRejectedValueOnce(new Error("14 UNAVAILABLE"));
      grpc.getStatus.mockRejectedValueOnce(new Error("14 UNAVAILABLE"));
      grpc.getStatus.mockResolvedValueOnce({ uptime: 9, status: ToolStatus.READY });

      await tool.fetchStatus();
      await tool.fetchStatus();
      await tool.fetchStatus();
      await tool.fetchStatus();

      const toolStatusLogs = vi
        .mocked(logAction)
        .mock.calls.map(([call]) => call as { level: string; action: string; details: string })
        .filter((call) => call.action.startsWith("Tool Status"));

      expect(toolStatusLogs).toHaveLength(2);
      expect(toolStatusLogs[0]).toMatchObject({
        level: "warning",
        action: "Tool Status Unknown",
      });
      expect(toolStatusLogs[0].details).toContain(toolId);
      expect(toolStatusLogs[0].details).toContain("14 UNAVAILABLE");
      expect(toolStatusLogs[1]).toMatchObject({
        level: "info",
        action: "Tool Status Recovered",
      });
      expect(toolStatusLogs[1].details).toContain("3");
    } finally {
      tool.stopHeartbeat();
      await removeFakeTool(toolId);
    }
  });

  it("tracks the failure streak", async () => {
    const toolId = "hb-streak";
    const { tool, grpc } = installFakeTool(toolId, ToolType.fast);

    try {
      expect(tool.consecutiveStatusFailures).toBe(0);
      expect(tool.statusUnknownSince).toBeUndefined();

      grpc.getStatus.mockRejectedValueOnce(new Error("14 UNAVAILABLE"));
      await tool.fetchStatus();
      expect(tool.consecutiveStatusFailures).toBe(1);
      const firstFailureSince = tool.statusUnknownSince;
      expect(typeof firstFailureSince).toBe("number");
      expect(firstFailureSince as number).toBeLessThanOrEqual(Date.now());

      grpc.getStatus.mockRejectedValueOnce(new Error("14 UNAVAILABLE"));
      await tool.fetchStatus();
      expect(tool.consecutiveStatusFailures).toBe(2);
      expect(tool.statusUnknownSince).toBe(firstFailureSince);

      grpc.getStatus.mockResolvedValueOnce({ uptime: 9, status: ToolStatus.READY });
      await tool.fetchStatus();
      expect(tool.consecutiveStatusFailures).toBe(0);
      expect(tool.statusUnknownSince).toBeUndefined();
    } finally {
      tool.stopHeartbeat();
      await removeFakeTool(toolId);
    }
  });

  it("a healthy poll logs nothing", async () => {
    const toolId = "hb-healthy";
    const { tool, grpc } = installFakeTool(toolId, ToolType.fast);

    try {
      grpc.getStatus.mockResolvedValueOnce({ uptime: 9, status: ToolStatus.READY });
      await tool.fetchStatus();

      const toolStatusLogs = vi
        .mocked(logAction)
        .mock.calls.map(([call]) => call as { level: string; action: string; details: string })
        .filter((call) => call.action.startsWith("Tool Status"));
      expect(toolStatusLogs).toHaveLength(0);
    } finally {
      tool.stopHeartbeat();
      await removeFakeTool(toolId);
    }
  });
});
