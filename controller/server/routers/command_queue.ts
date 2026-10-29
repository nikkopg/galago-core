import { z } from "zod";
import CommandQueue from "../command_queue";
import { procedure, router } from "@/server/trpc";
import { ToolCommandExecutionError } from "../tools";

// One plain payload for every error. The operator text is composed once, at the
// source (describeToolReply), so nothing here rewrites it (ERR-02, D-12).
// The stack stays server-side (logger.error records it); this router has no
// auth, so it is never sent to the client (WR-02).
function queueErrorPayload(error: Error, seq: number) {
  if (error instanceof ToolCommandExecutionError) {
    return {
      message: error.message,
      userFriendlyMessage: error.message,
      code: error.code,
      codeString: String(error.code),
      name: error.name,
      seq,
    };
  }
  const code = (error as { code?: unknown }).code;
  return {
    message: error.message,
    userFriendlyMessage: error.message,
    name: error.name,
    seq,
    ...(typeof code === "number" || typeof code === "string" ? { code } : {}),
  };
}

export const commandQueueRouter = router({
  state: procedure.query(async () => {
    return CommandQueue.global.state;
  }),
  // Reports whether this Start was accepted, so an ignored Start (the busy loop
  // still owns the queue) is visible to the operator, not only in Logs (WR-01).
  restart: procedure.mutation(() => {
    const queue = CommandQueue.global;
    const accepted = !queue.isStartInProgress;
    queue._start();
    return { accepted };
  }),
  stop: procedure.mutation(() => {
    CommandQueue.global.stop();
  }),
  getError: procedure.query(async () => {
    const queue = CommandQueue.global;
    const error = queue.getError();
    if (!error) return null;
    return queueErrorPayload(error, queue.failureSeq);
  }),
  skipCommand: procedure.input(z.number()).mutation(async ({ input }) => {
    CommandQueue.global.skipCommand(input);
  }),
  skipCommandsUntil: procedure.input(z.number()).mutation(async ({ input }) => {
    // Skip all commands previous to the given command ID
    CommandQueue.global.skipCommandsUntil(input);
  }),
  clearCompleted: procedure.mutation(() => {
    CommandQueue.global.clearCompleted();
  }),
  clearAll: procedure.mutation(() => {
    CommandQueue.global.clearAll();
  }),
  clearByRunId: procedure.input(z.string()).mutation(async ({ input }) => {
    CommandQueue.global.clearByRunId(input);
  }),
  getRunsTotal: procedure.query(async () => {
    return CommandQueue.global.getRunsTotal();
  }),
  getRun: procedure.input(z.string()).mutation(async ({ input }) => {
    CommandQueue.global.getRun(input);
  }),
  getAllRuns: procedure.query(async () => {
    return CommandQueue.global.getAllRuns();
  }),
  getAll: procedure.query(async ({}) => {
    return await CommandQueue.global.allCommands();
  }),

  commands: procedure
    .input(
      z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { limit = 20000, offset = 0 } = input; // default values if not provided
      return await CommandQueue.global.getPaginated(offset, limit);
      // const allCommands = await CommandQueue.global.allCommands();
    }),
  // Unified waiting-for-input status query
  isWaitingForInput: procedure.query(async () => {
    return CommandQueue.global.isWaitingForInput;
  }),
  gotoCommandByRunIndex: procedure
    .input(
      z.object({
        runId: z.string(),
        index: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      return CommandQueue.global.gotoCommandByRunIndex(input.runId, input.index);
    }),
  gotoCommand: procedure.input(z.number()).mutation(async ({ input }) => {
    return CommandQueue.global.gotoCommand(input);
  }),
  // Get current message data (type, message text, title)

  // Resume command (works for both pause and show_message)
  resume: procedure.mutation(() => {
    CommandQueue.global.resume();
    return { success: true };
  }),

  // Update the currentMessage procedure in commandQueueRouter to include formName
  currentMessage: procedure.query(async () => {
    const message = CommandQueue.global.currentMessage;
    return {
      ...message,
      // Ensure formName is included if it exists
      ...(message.formName ? { formName: message.formName } : {}),
    };
  }),

  modalState: procedure.query(async () => {
    const message = CommandQueue.global.currentMessage;
    return {
      isWaiting: CommandQueue.global.isWaitingForInput,
      message: {
        ...message,
        ...(message.formName ? { formName: message.formName } : {}),
      },
    };
  }),

  // Reports the running controllable step's live run_state (D-11, D-12).
  // Reads the server-side poller's cache only; never triggers a tool call.
  runState: procedure.query(() => {
    return CommandQueue.global.runState;
  }),

  // Sends an operator's Pause/Resume/Abort to the running step's tool.
  // No tool id field: the target is always CommandQueue.runningStep's tool,
  // never a caller-chosen one. params are deliberately unknown at the schema
  // level so a non-string decision reaches validateControlRequest and is
  // refused and logged (D-07) instead of being rejected unlogged by zod.
  toolControl: procedure
    .input(
      z.object({
        action: z.string(),
        params: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return CommandQueue.global.toolControl(input.action, input.params ?? {});
    }),
});
