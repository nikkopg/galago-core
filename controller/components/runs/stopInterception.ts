// Pure interception predicates and Stop-modal copy for the "Pause queue" /
// Clear All / per-run delete Stop flow (D-05, D-16..D-19). No React import,
// no .tsx import (D-24) — safe to import from any context, including tests.
import { shouldShowControlBar } from "./controlDecision";
import type { DecisionValues, RunningEnvelope } from "./controlDecision";
import type { RunStateEnvelope } from "@/server/runState";

export const STOP_MODAL_COPY: { header: string; confirmLabel: string } = {
  header: "Abort Instrument Run",
  confirmLabel: "Abort",
};

// D-16: identical in meaning to shouldShowControlBar — a running step of a
// tool type with runControl, regardless of status (an unknown status still
// intercepts, E7); no response yet means no interception (E7 loading).
export function shouldInterceptQueueStop(
  envelope: RunStateEnvelope | undefined,
): envelope is RunningEnvelope {
  return shouldShowControlBar(envelope);
}

// D-19: only the run that contains the running step can detach it, so
// deleting any other run must not force an instrument abort.
export function shouldInterceptRunDelete(
  envelope: RunStateEnvelope | undefined,
  runId: string,
): boolean {
  return shouldInterceptQueueStop(envelope) && envelope.runId === runId;
}

// D-17: "Abort the instrument run (return liquid? Yes|No|not chosen)".
export function stopModalBody(values: DecisionValues): string {
  const value = values.return_liquid;
  const valueText = value === "yes" ? "Yes" : value === "no" ? "No" : "not chosen";
  return `Abort the instrument run (return liquid? ${valueText})`;
}

export interface InstrumentStopRequest {
  toolType: string;
  queueId: number;
  followUp: () => Promise<unknown>;
}

// D-18: carries only what InstrumentStopModal needs to build the abort
// confirmation (target/action are fixed) and the queue action to run after
// an accepted abort.
export function buildStopRequest(
  envelope: RunningEnvelope,
  followUp: () => Promise<unknown>,
): InstrumentStopRequest {
  return { toolType: envelope.toolType, queueId: envelope.queueId, followUp };
}
