// Pure interception predicates and Stop-modal copy for the "Pause queue" /
// Clear All / per-run delete Stop flow (D-05, D-16..D-19). No React import,
// no .tsx import (D-24) — safe to import from any context, including tests.
import { shouldShowControlBar, getActionSpec, decisionLabel } from "./controlDecision";
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
): envelope is RunningEnvelope {
  return shouldInterceptQueueStop(envelope) && envelope.runId === runId;
}

// D-17/WR-04: restates every decision declared by the tool's "abort" spec,
// derived from getActionSpec rather than hardcoding `return_liquid` — this
// stays correct for any future tool type whose abort action declares a
// differently-named (or additional) decision, instead of silently reading
// `undefined` forever (mirrors how restateChoice derives its sentence from
// the same spec).
export function stopModalBody(toolType: string, values: DecisionValues): string {
  const spec = getActionSpec(toolType, "abort");
  const decisionNames = spec ? Object.keys(spec) : [];
  if (decisionNames.length === 0) {
    return "Abort the instrument run.";
  }
  const parts = decisionNames.map((name) => {
    const value = values[name];
    const valueText = value === "yes" ? "Yes" : value === "no" ? "No" : "not chosen";
    return `${decisionLabel(name)} ${valueText}`;
  });
  return `Abort the instrument run (${parts.join(", ")})`;
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
