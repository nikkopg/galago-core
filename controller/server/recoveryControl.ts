import { TRPCError } from "@trpc/server";
import { logAction } from "./logger";
import {
  isRecoveryAction,
  validateRecoveryRequest,
  RECOVERY_STRICT_SUCCESS,
} from "./recoveryActions";
import { getRunControl } from "./runControl";
import { normalizeToolKey as normalize } from "./toolKey";
import type { ToolControlResult } from "./tools";
import type Tool from "./tools";
import type { RunningStep } from "./command_queue";

// Crash-recovery control (D-06 reroute): lets the recovery card send a
// declared recovery action to a tool by id. Every action and param shape is
// declared by recoveryActions.ts and validated fail-closed by
// validateRecoveryRequest; the send is exactly one tool.controlCommand call.
// Refuses when the queue's running step is on this tool — that tool is
// controlled only from the run page for a live step; a STACK acknowledge
// waits for the step to end. Consults no instrument observation of any kind
// (no status poll, no run-state read, no reply field) before deciding to
// send; the core owns the state gates (UI-08).
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

  // (a) Only actions declared by recoveryActions are ever offered —
  // everything else is refused here, before anything else (D-06).
  if (!isRecoveryAction(toolType, action)) {
    const message = `Action "${action}" is not available for tool type "${toolType}".`;
    await logAction({
      level: "warning",
      action: "Tool Recovery Control Refused",
      details: `${baseDetails} outcome=refused: BAD_REQUEST ${message}`,
    });
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }

  // (b) A running queue step tracking this tool is controlled only from the
  // run page. Reads queue state only — never instrument state (UI-08). The
  // message is type-aware (D-09): a tool type with no runControl entry has
  // no live run control to route to, so its recovery-only actions (such as
  // an acknowledge) must wait for the step to end.
  if (runningStep !== undefined && normalize(runningStep.toolId) === normalize(toolName)) {
    const message =
      getRunControl(toolType) !== undefined
        ? "A run step is tracking this tool; use the run page."
        : "A run step is running on this tool; acknowledge after it ends.";
    await logAction({
      level: "warning",
      action: "Tool Recovery Control Refused",
      details: `${baseDetails} outcome=refused: PRECONDITION_FAILED ${message}`,
    });
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  }

  // (c) Fail-closed validation from recoveryActions: declared action, exact
  // param values per kind, no undeclared parameters.
  const verdict = validateRecoveryRequest(toolType, action, params);
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
    result = await tool.controlCommand(action, verdict.params);
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

  // (d) Strict success (D-10): a SUCCESS reply that still carries any message
  // text is a refused request on strict-success actions, never an accepted
  // acknowledge. Present means the raw field is anything but ""; a
  // whitespace-only message is present. Fast resume/abort keep
  // Tool.controlCommand's original result untouched.
  const messagePresent = typeof result.message === "string" && result.message !== "";
  if (result.ok && messagePresent && RECOVERY_STRICT_SUCCESS[String(toolType)]?.includes(action)) {
    await logAction({
      level: "warning",
      action: "Tool Recovery Control Refused",
      details: `${baseDetails} outcome=refused: ${result.response} SUCCESS reply carries an error message message=${result.message}`,
    });
    return { ok: false, response: result.response, message: result.message };
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
