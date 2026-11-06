// Builds the tool.configure payload Connect All sends for a stored tool row.
// tools.config is stored keyed by tool type ({"stack": {...}}, optionally with
// toolId/simulated beside it), so the sub-config is unwrapped, not re-wrapped.
// A flat legacy row without the type key is sent as the sub-config unchanged.
// A missing simulated flag is false, as Config.fromPartial would make it.
export function buildConnectConfig(tool: {
  name: string;
  type: string;
  config: Record<string, any>;
}): { toolId: string; simulated: boolean; [toolType: string]: unknown } {
  const stored = tool.config;
  const sub = tool.type in stored ? stored[tool.type] : stored;
  return {
    toolId: tool.name,
    simulated: stored.simulated === true,
    [tool.type]: sub,
  };
}
