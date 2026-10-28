// Pure, React-free helpers for the run page error banner and the step card
// error line (D-16, D-17; no React import, no .tsx import, no timers). The
// banner decision is a function of the server's error seq, so a dismissed
// banner re-arms on the next failure; dismissing never touches the queue.
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { storedErrorText } from "./storedError";

// A payload with no numeric seq (only a failed getError request produces
// one) maps here, so it still shows until it is dismissed.
export const UNSEQUENCED_ERROR_SEQ = -1;

export const QUEUE_ERROR_FALLBACK_MESSAGE =
  "The command failed and the tool sent no message. Open Details for the raw error.";

export const SKIPPED_AFTER_FAILURE_PREFIX = "Skipped after failure: ";

export interface QueueErrorDescription {
  message: string;
  code: string | null;
  details: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function errorSeq(error: unknown): number {
  if (isPlainObject(error) && typeof error["seq"] === "number" && Number.isFinite(error["seq"])) {
    return error["seq"];
  }
  return UNSEQUENCED_ERROR_SEQ;
}

// ERR-04: show when the queue is FAILED, an error exists and this failure has
// not been dismissed. A new failure carries a new seq, so it shows again even
// when its text is identical to the dismissed one.
export function shouldShowErrorBanner(
  queueState: unknown,
  error: unknown,
  dismissedSeq: number | null,
): boolean {
  return (
    queueState === ToolStatus.FAILED &&
    error !== null &&
    error !== undefined &&
    errorSeq(error) !== dismissedSeq
  );
}

function usableText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

// The badge is never SUCCESS or UNKNOWN (exact match only): a tool error must
// not be labelled as success, and UNKNOWN says nothing the message does not.
function usableCode(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed === "SUCCESS" || trimmed === "UNKNOWN") return null;
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `Code ${value}`;
  }
  return null;
}

// ERR-02/ERR-05: never returns an empty message. A non-blank message is
// returned verbatim, untrimmed: the tool's own text is not rewritten.
export function describeQueueError(data: unknown): QueueErrorDescription {
  let message: string | null = null;
  let code: string | null = null;
  let details = "";

  if (typeof data === "string") {
    message = usableText(data);
    details = data;
  } else if (isPlainObject(data)) {
    message = usableText(data["userFriendlyMessage"]) ?? usableText(data["message"]);
    code = usableCode(data["codeString"]) ?? usableCode(data["code"]);
    details = prettyJson(data);
  }

  return { message: message ?? QUEUE_ERROR_FALLBACK_MESSAGE, code, details };
}

// D-17: the card error line comes from the persisted row, so it survives a
// cleared banner and a restart. Only FAILED and SKIPPED rows show it; a row
// that was retried and completed keeps a stale error that must stay hidden.
export function stepErrorText(command: { status: string; error?: unknown }): string | null {
  const text = storedErrorText(command.error);
  if (command.status === "FAILED") return text;
  if (command.status === "SKIPPED") {
    return text === null ? null : SKIPPED_AFTER_FAILURE_PREFIX + text;
  }
  return null;
}
