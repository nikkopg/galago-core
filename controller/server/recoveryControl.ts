import { TRPCError } from "@trpc/server";
import { logAction } from "./logger";
import { validateControlRequest } from "./runControl";
import type { ToolControlResult } from "./tools";
import type Tool from "./tools";
import type { RunningStep } from "./command_queue";

// Crash-recovery control: lets the tool page send Resume or Abort directly to
// a tool by id when no queue step is tracking it (for example after a
// galago-web restart while the instrument is still paused). Reused from
// Phase 1's fail-closed validateControlRequest (D-22). Refuses when the
// queue's running step is on this tool — that tool is controlled only from
// the run page. Consults no instrument observation of any kind (no status
// poll, no run-state read, no reply field) before deciding to send; the core
// owns the state gates (UI-08).
export const RECOVERY_ACTIONS = ["resume", "abort"] as const;

const normalize = (s: string | undefined) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function recoveryControl(args: {
  toolName: string;
  toolType: string;
  tool: Pick<Tool, "controlCommand">;
  runningStep: Readonly<RunningStep> | undefined;
  action: string;
  params: Record<string, unknown>;
}): Promise<ToolControlResult> {
  const { toolName, toolType, tool, runningStep, action, params } = args;

  const paramsJson = (() => {
    try {
      return JSON.stringify(params);
    } catch {
      return String(params);
    }
  })();
  const baseDetails = `action=${action} toolId=${toolName} toolType=${toolType} decisions=${paramsJson}`;

  // (a) Only resume/abort are ever offered for crash recovery — Pause is
  // refused here, before anything else (D-22).
  if (!(RECOVERY_ACTIONS as readonly string[]).includes(action)) {
    const message = `Action "${action}" is not available for crash recovery; only resume and abort are.`;
    await logAction({
      level: "warning",
      action: "Tool Recovery Control Refused",
      details: `${baseDetails} outcome=refused: BAD_REQUEST ${message}`,
    });
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }

  // (b) A running queue step tracking this tool is controlled only from the
  // run page. Reads queue state only — never instrument state (D-22, UI-08).
  if (runningStep !== undefined && normalize(runningStep.toolId) === normalize(toolName)) {
    const message = "A run step is tracking this tool; use the run page.";
    await logAction({
      level: "warning",
      action: "Tool Recovery Control Refused",
      details: `${baseDetails} outcome=refused: PRECONDITION_FAILED ${message}`,
    });
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  }

  // (c) Reuse Phase 1's fail-closed validation: declared action, exact
  // yes/no decisions, no undeclared parameters.
  const verdict = validateControlRequest(toolType, action, params);
  if (!verdict.ok) {
    await logAction({
      level: "warning",
      action: "Tool Recovery Control Refused",
      details: `${baseDetails} outcome=refused: ${verdict.code} ${verdict.message}`,
    });
    throw new TRPCError({ code: verdict.code, message: verdict.message });
  }

  let result: ToolControlResult;
  try {
    // No options, no deadline (D-23): a recovery Resume stays pending for as
    // long as the tool takes. One attempt only, never retried.
    result = await tool.controlCommand(action, verdict.decisions);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logAction({
      level: "warning",
      action: "Tool Recovery Control Failed",
      details: `${baseDetails} outcome=transport error: ${errorMessage}`,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Could not reach tool "${toolName}": ${errorMessage}`,
      cause: error instanceof Error ? error : undefined,
    });
  }

  const details = result.ok
    ? `${baseDetails} outcome=${result.response}`
    : `${baseDetails} outcome=${result.response} message=${result.message}`;

  await logAction({
    level: result.ok ? "info" : "warning",
    action: "Tool Recovery Control",
    details,
  });

  return result;
}
