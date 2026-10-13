import { describe, it, expect, afterEach, vi } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
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
});
