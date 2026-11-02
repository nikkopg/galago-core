// GEN-04b (D-07b): pins the latch-read constant against the REAL generated
// stack.Command oneof. An unknown oneof key would encode nothing and decode
// absent, so the round-trip assertion genuinely proves LATCH_READ_COMMAND
// names a real oneof key — the Phase 4 placeholder ("latch_status") would
// fail here. Fakes only — no STACK motion (v2 hard constraint).
import { describe, it, expect, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import * as tool_base from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { installFakeTool, removeFakeTool } from "./helpers/fakeTool";
import { LATCH_READ_COMMAND } from "@/server/recoveryActions";

describe("stack activation (GEN-04b latch-read contract)", () => {
  afterEach(async () => {
    await removeFakeTool("stack-1");
  });

  it("LATCH_READ_COMMAND is the frozen stack.proto oneof key", () => {
    expect(LATCH_READ_COMMAND).toBe("get_failure_latch");
  });

  it("the latch-read payload encodes the LATCH_READ_COMMAND oneof branch on the real tool_base.Command", () => {
    const { tool } = installFakeTool("stack-1", ToolType.stack);

    const payload = tool._payloadForCommand({
      toolId: "stack-1",
      toolType: ToolType.stack,
      command: LATCH_READ_COMMAND,
      params: {},
    });
    const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
    expect(decoded.stack?.[LATCH_READ_COMMAND]).toBeDefined();
  });
});
