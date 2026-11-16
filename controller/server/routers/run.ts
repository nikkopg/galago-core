import { TRPCError } from "@trpc/server";
import { z } from "zod";
import RunStore, {
  isProtocolGenerationFailedError,
  isProtocolNotFoundError,
  isProtocolParamsInvalidError,
  ProtocolNotFoundError,
  upsertParameterVariables,
} from "../runs";
import { isOperatorOnlyCommandError } from "../operatorOnlyCommands";
import { isLaneValidationError } from "../laneScheduling";
import { procedure, router } from "@/server/trpc";
import { getSelectedWorkcellId } from "@/db/helpers";
import { db } from "@/db/client";
import { protocols } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runRouter = router({
  all: procedure
    .input(
      z.object({
        // pagination will go here. later
      }),
    )
    .query(async () => {
      return RunStore.global.all();
    }),

  get: procedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { id } = input;
      const run = RunStore.global.get(id);
      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No run found for this ID.",
        });
      }
      return run;
    }),

  create: procedure
    .input(
      z.object({
        protocolId: z.number(),
        // Bounded loop input (WR-05): 0/negative counts are rejected instead
        // of silently no-oping, and the upper bound keeps one request from
        // enqueuing an unbounded flood of instrument runs.
        numberOfRuns: z.number().int().min(1).max(100).optional(),
        parameters: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { protocolId } = input;
      try {
        const protocolIdString = protocolId.toString();

        if (input.parameters && Object.keys(input.parameters).length > 0) {
          const workcellId = await getSelectedWorkcellId();
          const protocol = await db
            .select()
            .from(protocols)
            .where(eq(protocols.id, protocolId))
            .limit(1);

          if (!protocol[0]) {
            throw new ProtocolNotFoundError(protocolIdString);
          }

          const paramDefs = protocol[0].parameters ?? [];
          if (paramDefs.length > 0) {
            await upsertParameterVariables(paramDefs, input.parameters, workcellId);
          }
        }

        const numRuns = input.numberOfRuns ?? 1;
        const runs = [];
        for (let i = 0; i < numRuns; i++) {
          const run = await RunStore.global.createFromProtocol(protocolIdString, input.parameters);
          runs.push(run);
        }
        return runs;
      } catch (e) {
        if (isProtocolNotFoundError(e)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No protocol found for this ID.",
          });
        }
        if (isOperatorOnlyCommandError(e)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e.message,
          });
        }
        if (isLaneValidationError(e)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e.message,
          });
        }
        if (isProtocolGenerationFailedError(e)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Could not generate commands for the given params.",
          });
        }
        if (isProtocolParamsInvalidError(e)) {
          throw e.cause;
        }
        throw e;
      }
    }),
});
