// Pure composer for the operator-facing text of a failed tool reply (ERR-02, D-11, D-14).
//
// This is the ONE place that turns an ExecuteCommandReply into the sentence the
// operator sees. It has no logging, db or Tool imports so it can be unit tested
// over every ResponseCode. The tool's own text is never trimmed, truncated or
// escaped: it is either appended after a generic sentence or prefixed by the
// ERROR_FROM_TOOL wording.
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";

export interface ToolReplyLike {
  response: ResponseCode;
  error_message?: string;
}

export interface ToolReplyFailure {
  code: ResponseCode;
  message: string;
}

export const TOOL_SAID_JOINER = " Tool said: ";

function errorFromTool(command: string, toolId: string, text: string, hasText: boolean): string {
  return hasText
    ? `Error from tool "${toolId}": ${text}`
    : `An error occurred while executing the command "${command}" on tool "${toolId}".`;
}

/**
 * Compose the operator text and code for a reply, or null when the reply is a
 * plain success (SUCCESS with no error message).
 *
 * A SUCCESS reply that carries an error message is reported as ERROR_FROM_TOOL
 * and never as SUCCESS (ERR-05, D-14).
 */
export function describeToolReply(
  command: string,
  toolId: string,
  reply: ToolReplyLike,
): ToolReplyFailure | null {
  const text = reply.error_message ?? "";
  const hasText = text.trim().length > 0;

  if (reply.response === ResponseCode.SUCCESS) {
    if (text === "") return null;
    return {
      code: ResponseCode.ERROR_FROM_TOOL,
      message: errorFromTool(command, toolId, text, hasText),
    };
  }

  let generic: string | undefined;
  switch (reply.response) {
    case ResponseCode.UNRECOGNIZED_COMMAND:
      generic = `The command "${command}" is not recognized by the tool "${toolId}". Please verify that this command is supported by this tool or page view.`;
      break;
    case ResponseCode.INVALID_ARGUMENTS:
      generic = `Invalid arguments provided for command "${command}". Check the parameters and try again.`;
      break;
    case ResponseCode.NOT_READY:
      generic = `The tool "${toolId}" is currently not ready. Please wait and try again.`;
      break;
    case ResponseCode.WRONG_TOOL:
      generic =
        "The command was sent to the wrong tool type. Please check that you're using the correct tool for this operation.";
      break;
    default:
      break;
  }

  if (generic !== undefined) {
    return {
      code: reply.response,
      message: hasText ? generic + TOOL_SAID_JOINER + text : generic,
    };
  }

  if (reply.response === ResponseCode.ERROR_FROM_TOOL) {
    return { code: reply.response, message: errorFromTool(command, toolId, text, hasText) };
  }

  return {
    code: reply.response,
    message: hasText ? text : `Failed to execute command "${command}" on tool "${toolId}"`,
  };
}
