// Proves that the control-path payloads (Pause/Resume/Abort) and run_state
// survive the REAL generated protobuf encoders — not just the payload-object
// level that plans 01-02/01-03 asserted against the fake gRPC double (D-19,
// QUE-01, QUE-04).
import { describe, it, expect, afterEach } from "vitest";
import { ToolType } from "gen-interfaces/controller";
import * as tool_base from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { installFakeTool, removeFakeTool } from "./helpers/fakeTool";
import { extractRunState } from "@/server/runState";

describe("wire contract", () => {
  afterEach(async () => {
    await removeFakeTool("wire-fast");
    await removeFakeTool("wire-stack");
  });

  it("encodes the control payloads into the fast Command oneof", () => {
    const { tool } = installFakeTool("wire-fast", ToolType.fast);

    const pausePayload = tool._payloadForCommand({
      toolId: "wire-fast",
      toolType: ToolType.fast,
      command: "pause",
      params: {},
    });
    const pauseDecoded = tool_base.Command.decode(tool_base.Command.encode(pausePayload).finish());
    expect(pauseDecoded.fast?.pause).toBeDefined();

    const resumePayload = tool._payloadForCommand({
      toolId: "wire-fast",
      toolType: ToolType.fast,
      command: "resume",
      params: { is_tip_broken: "no" },
    });
    const resumeDecoded = tool_base.Command.decode(
      tool_base.Command.encode(resumePayload).finish(),
    );
    expect(resumeDecoded.fast?.resume?.is_tip_broken).toBe("no");

    const abortPayload = tool._payloadForCommand({
      toolId: "wire-fast",
      toolType: ToolType.fast,
      command: "abort",
      params: { return_liquid: "yes" },
    });
    const abortDecoded = tool_base.Command.decode(tool_base.Command.encode(abortPayload).finish());
    expect(abortDecoded.fast?.abort?.return_liquid).toBe("yes");
  });

  // GEN-04a (D-07a): the operator acknowledge payload survives the REAL
  // generated encoder with guid and arm_inspected intact — the first
  // real-encoder evidence for the Phase 4 acknowledge work. Fakes only; the
  // command-name literal lives only in a test file (the OPR-05 closed-carrier
  // scan walks components/hooks/pages/server, never test/).
  it("encodes the acknowledge payload into the stack Command oneof", () => {
    const { tool } = installFakeTool("wire-stack", ToolType.stack);

    const payload = tool._payloadForCommand({
      toolId: "wire-stack",
      toolType: ToolType.stack,
      command: "acknowledge_failure",
      params: { guid: "task-guid", arm_inspected: "yes" },
    });
    const decoded = tool_base.Command.decode(tool_base.Command.encode(payload).finish());
    expect(decoded.stack?.acknowledge_failure?.guid).toBe("task-guid");
    expect(decoded.stack?.acknowledge_failure?.arm_inspected).toBe("yes");
  });

  it("carries run_state through StatusReply into the runState envelope", () => {
    const statusReply = {
      uptime: 3,
      status: tool_base.ToolStatus.BUSY,
      run_state: {
        state: "paused",
        percent: 40,
        pause: {
          errorCode: -645,
          errorName: "WrongPlateType",
          percent: 0,
          eventPayload: {
            wrongDetection: [{ expectedPlateID: 1, detectedPlateID: null, position: 3 }],
          },
          since: "2026-10-12T09:00:00Z",
        },
      },
    };

    const decoded = tool_base.StatusReply.decode(
      tool_base.StatusReply.encode(statusReply).finish(),
    );

    const result = extractRunState(decoded);
    expect(result).toEqual({
      ok: true,
      runState: {
        state: "paused",
        percent: 40,
        pause: {
          name: "WrongPlateType",
          code: -645,
          detail: {
            wrongDetection: [{ expectedPlateID: 1, detectedPlateID: null, position: 3 }],
          },
          startedAt: "2026-10-12T09:00:00Z",
        },
      },
    });
  });
});
