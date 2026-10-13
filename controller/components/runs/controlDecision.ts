// Pure, React-free decision state, bar visibility, button hints, copy,
// confirmed-send gate and accepted-then-follow-up sequencing for live run
// control (D-24: no React import, no .tsx import — safe to import from any
// context, including the confirmed-send hook and tests). The only server
// imports are `getRunControl` (a zero-import module, safe client-side) and
// the `RunStateEnvelope` TYPE (import type only, so no server code reaches
// the client bundle).
import { getRunControl } from "@/server/runControl";
import type { ControlDecisionValue, RunControlActionSpec } from "@/server/runControl";
import type { RunStateEnvelope } from "@/server/runState";

// Mirrors the server's RUN_STATE_POLL_INTERVAL_MS (D-01) without importing
// server/runState.ts as a value (that module imports Tool and gRPC).
export const RUN_CONTROL_POLL_MS = 2000;

export const HEAD_MOVES_NOTE = "The instrument head will move.";

// D-12 (verbatim): shown when a confirm opened for a step that has since
// ended or moved on closes itself without sending anything.
export const NOTHING_SENT_MESSAGE =
  "The run resumed or the step ended before you confirmed; nothing was sent.";

const TOOL_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  fast: "F.A.S.T.",
};

export function toolDisplayName(toolType: string): string {
  if (Object.prototype.hasOwnProperty.call(TOOL_DISPLAY_NAMES, toolType)) {
    return TOOL_DISPLAY_NAMES[toolType];
  }
  return toolType;
}

// Own-property safe on both levels: an inherited name on either the tool-type
// map or the action-spec map must never resolve to a declared action.
export function getActionSpec(toolType: string, action: string): RunControlActionSpec | undefined {
  const toolSpec = getRunControl(toolType);
  if (!toolSpec || !Object.prototype.hasOwnProperty.call(toolSpec, action)) {
    return undefined;
  }
  return toolSpec[action];
}

export type DecisionValues = Record<string, ControlDecisionValue | undefined>;

export function emptyDecisions(spec: RunControlActionSpec): DecisionValues {
  const result: DecisionValues = {};
  for (const name of Object.keys(spec)) {
    result[name] = undefined;
  }
  return result;
}

export function allDecisionsChosen(spec: RunControlActionSpec, values: DecisionValues): boolean {
  return Object.keys(spec).every((name) => values[name] === "yes" || values[name] === "no");
}

export function completeDecisions(
  spec: RunControlActionSpec,
  values: DecisionValues,
): Record<string, ControlDecisionValue> | null {
  const result: Record<string, ControlDecisionValue> = {};
  for (const name of Object.keys(spec)) {
    const value = values[name];
    if (value !== "yes" && value !== "no") {
      return null;
    }
    result[name] = value;
  }
  return result;
}

export type RunningEnvelope = Extract<RunStateEnvelope, { running: true }>;

// D-02: visible only while a step is running AND its tool type declares a
// runControl entry.
export function shouldShowControlBar(
  envelope: RunStateEnvelope | undefined,
): envelope is RunningEnvelope {
  return (
    envelope !== undefined &&
    envelope.running === true &&
    getRunControl(envelope.toolType) !== undefined
  );
}

function capitalize(action: string): string {
  return action.length === 0 ? action : action[0].toUpperCase() + action.slice(1);
}

const CONFIRM_HEADERS: Readonly<Record<string, string>> = {
  pause: "Pause Instrument",
  resume: "Resume Instrument",
  abort: "Abort Instrument Run",
};

export function confirmHeader(action: string): string {
  return Object.prototype.hasOwnProperty.call(CONFIRM_HEADERS, action)
    ? CONFIRM_HEADERS[action]
    : action;
}

const SUCCESS_TITLES: Readonly<Record<string, string>> = {
  pause: "Instrument paused",
  resume: "Instrument resumed",
  abort: "Instrument run aborted",
};

export function successTitle(action: string): string {
  return Object.prototype.hasOwnProperty.call(SUCCESS_TITLES, action)
    ? SUCCESS_TITLES[action]
    : action;
}

// D-06/D-08: Pause has no decisions, so it keeps its short question form.
// Any other action restates the choice made (extended in Task 2 to list
// every declared decision); for now (no decision-aware callers yet) it
// falls back to a plain statement.
export function restateChoice(toolType: string, action: string, _values: DecisionValues): string {
  const name = toolDisplayName(toolType);
  if (action === "pause") {
    return `Pause the ${name} run?`;
  }
  return `${capitalize(action)} the ${name} run.`;
}

// Plan 02-05 adds the recovery (non-running) target; only "running" exists
// today.
export type ControlTarget = { kind: "running" };

// The confirmed-send path only ever accepts a COMPLETED decision object
// (D-24) — callers must run completeDecisions() themselves before building
// this request.
export interface ConfirmedControlRequest {
  target: ControlTarget;
  toolType: string;
  action: string;
  decisions: Readonly<Record<string, ControlDecisionValue>>;
}

export interface ToolControlResultLike {
  ok: boolean;
  response: string;
  message?: string;
}

export type ConfirmedSendOutcome =
  | { status: "accepted"; message?: string }
  | { status: "refused"; message: string }
  | { status: "failed"; message: string }
  | { status: "ignored"; reason: "in-flight" | "incomplete" };

export interface ConfirmedSendDeps {
  sendRunning(input: {
    action: string;
    params: Record<string, ControlDecisionValue>;
  }): Promise<ToolControlResultLike>;
  notify: {
    accepted(title: string, description?: string): void;
    refused(message: string): void;
  };
}

// The single, shared confirmed-send gate (D-06, D-09): every control entry
// point in this app funnels through one instance of this. In flight, refused
// decisions, refusals and transport errors are all handled here once.
export function createConfirmedSender(deps: ConfirmedSendDeps): {
  send(request: ConfirmedControlRequest): Promise<ConfirmedSendOutcome>;
  isInFlight(): boolean;
} {
  let inFlight = false;

  async function send(request: ConfirmedControlRequest): Promise<ConfirmedSendOutcome> {
    if (inFlight) {
      return { status: "ignored", reason: "in-flight" };
    }

    const spec = getActionSpec(request.toolType, request.action);
    const completed = spec ? completeDecisions(spec, request.decisions) : null;
    if (!spec || completed === null) {
      return { status: "ignored", reason: "incomplete" };
    }

    inFlight = true;
    try {
      const result = await deps.sendRunning({ action: request.action, params: completed });

      if (result.ok) {
        deps.notify.accepted(successTitle(request.action), result.message);
        return result.message !== undefined
          ? { status: "accepted", message: result.message }
          : { status: "accepted" };
      }

      const message =
        result.message && result.message.length > 0
          ? result.message
          : `Tool replied ${result.response}`;
      deps.notify.refused(message);
      return { status: "refused", message };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.notify.refused(message);
      return { status: "failed", message };
    } finally {
      inFlight = false;
    }
  }

  return {
    send,
    isInFlight: () => inFlight,
  };
}
