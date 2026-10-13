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

// D-04: a hint for button enablement only — nothing else may consult it
// before sending (the core gates every action). Unknown or ambiguous state
// (any status other than "ok", or a null runState) enables all three.
export function controlButtonHints(envelope: RunningEnvelope): {
  pause: boolean;
  resume: boolean;
  abort: boolean;
} {
  if (envelope.status !== "ok" || envelope.runState === null) {
    return { pause: true, resume: true, abort: true };
  }
  const state = envelope.runState.state;
  if (state === "running") {
    return { pause: true, resume: false, abort: true };
  }
  if (state === "paused") {
    return { pause: false, resume: true, abort: true };
  }
  return { pause: true, resume: true, abort: true };
}

export function progressValue(percent: number | null): number | null {
  if (percent === null || !Number.isFinite(percent)) {
    return null;
  }
  const clamped = Math.min(100, Math.max(0, percent));
  return Math.round(clamped);
}

export interface UnknownSince {
  queueId: number;
  since: number;
}

// Tracks the first failed poll seen by THIS client (not a server-recorded
// instant): the pending first poll (status "unknown", no lastError yet) is
// not shown as unknown.
export function nextUnknownSince(
  prev: UnknownSince | null,
  envelope: RunStateEnvelope | undefined,
  nowMs: number,
): UnknownSince | null {
  if (envelope === undefined) {
    return prev;
  }
  if (!envelope.running) {
    return null;
  }
  if (envelope.status === "ok") {
    return null;
  }
  if (envelope.lastError === undefined) {
    return null;
  }
  if (prev !== null && prev.queueId === envelope.queueId) {
    return prev;
  }
  return { queueId: envelope.queueId, since: envelope.updatedAt ?? nowMs };
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// UI-01 adjacency (D-02, D-12): a confirm opened for one step must close
// if the run resumes (running: false) or moves on to a different step
// (queueId change) before the operator confirmed.
export function confirmStillValid(
  openedForQueueId: number,
  envelope: RunStateEnvelope | undefined,
): boolean {
  if (envelope === undefined) {
    return true;
  }
  if (!envelope.running) {
    return false;
  }
  return envelope.queueId === openedForQueueId;
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

const DECISION_LABELS: Readonly<Record<string, string>> = {
  is_tip_broken: "Tip broken?",
  return_liquid: "Return liquid?",
};

export function decisionLabel(name: string): string {
  return Object.prototype.hasOwnProperty.call(DECISION_LABELS, name)
    ? DECISION_LABELS[name]
    : `${name}?`;
}

// D-06/D-08: Pause has no decisions, so it keeps its short question form.
// Any other action restates the choice made, one " {Label}: {Yes/No/not
// chosen}." sentence per declared decision, in declaration order.
export function restateChoice(toolType: string, action: string, values: DecisionValues): string {
  const name = toolDisplayName(toolType);
  if (action === "pause") {
    return `Pause the ${name} run?`;
  }

  let sentence = `${capitalize(action)} the ${name} run.`;
  const spec = getActionSpec(toolType, action);
  if (spec) {
    for (const decisionName of Object.keys(spec)) {
      const label = decisionLabel(decisionName).replace(/\?$/, "");
      const value = values[decisionName];
      const valueText = value === "yes" ? "Yes" : value === "no" ? "No" : "not chosen";
      sentence += ` ${label}: ${valueText}.`;
    }
  }
  return sentence;
}

// Plan 02-05 adds the recovery (non-running) target: a crash-recovery call
// goes straight to a tool by id/name, with no running queue step involved.
export type ControlTarget = { kind: "running" } | { kind: "recovery"; toolId: string };

// D-21: crash recovery only ever offers Resume/Abort — never Pause.
export const RECOVERY_UI_ACTIONS = ["resume", "abort"] as const;

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
  // Optional (D-24): only the tool page's recovery entry point supplies
  // this. Absent, a recovery request is refused rather than silently
  // falling back to sendRunning.
  sendRecovery?(input: {
    toolId: string;
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
// decisions, refusals and transport errors are all handled here once —
// identically for the running-step target and the recovery target.
export function createConfirmedSender(deps: ConfirmedSendDeps): {
  send(request: ConfirmedControlRequest): Promise<ConfirmedSendOutcome>;
  isInFlight(): boolean;
} {
  let inFlight = false;

  async function dispatch(
    action: string,
    call: () => Promise<ToolControlResultLike>,
  ): Promise<ConfirmedSendOutcome> {
    inFlight = true;
    try {
      const result = await call();

      if (result.ok) {
        deps.notify.accepted(successTitle(action), result.message);
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

  async function send(request: ConfirmedControlRequest): Promise<ConfirmedSendOutcome> {
    if (inFlight) {
      return { status: "ignored", reason: "in-flight" };
    }

    if (request.target.kind === "recovery") {
      // D-21: only resume/abort are ever offered for crash recovery; a
      // pause (or anything else) is ignored before any decision lookup.
      if (!(RECOVERY_UI_ACTIONS as readonly string[]).includes(request.action)) {
        return { status: "ignored", reason: "incomplete" };
      }

      const spec = getActionSpec(request.toolType, request.action);
      const completed = spec ? completeDecisions(spec, request.decisions) : null;
      if (!spec || completed === null) {
        return { status: "ignored", reason: "incomplete" };
      }

      if (!deps.sendRecovery) {
        const message = "Crash-recovery control is not available here.";
        deps.notify.refused(message);
        return { status: "failed", message };
      }

      const toolId = request.target.toolId;
      return dispatch(request.action, () =>
        deps.sendRecovery!({ toolId, action: request.action, params: completed }),
      );
    }

    const spec = getActionSpec(request.toolType, request.action);
    const completed = spec ? completeDecisions(spec, request.decisions) : null;
    if (!spec || completed === null) {
      return { status: "ignored", reason: "incomplete" };
    }

    return dispatch(request.action, () =>
      deps.sendRunning({ action: request.action, params: completed }),
    );
  }

  return {
    send,
    isInFlight: () => inFlight,
  };
}

// D-21: visibility of the tool page's "Run Recovery" card depends ONLY on
// whether the tool type declares a runControl entry — never on whether a
// step is currently running (Pitfall 10).
export function shouldShowRecoverySection(toolType: string): boolean {
  return getRunControl(toolType) !== undefined;
}

// Same idiom as server/tools.ts's getToolFromDB and server/routers/tool.ts
// (RESEARCH Open Question 1) — kept in sync by convention, not import,
// since this module stays free of any server VALUE import (D-24).
export function normalizeToolKey(s: string | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// A queue-state read, not an instrument-state check (D-21, D-22): true only
// while a running step is tracking THIS tool by normalized name.
export function isToolTrackedByRunningStep(
  envelope: RunStateEnvelope | undefined,
  toolName: string,
): boolean {
  if (envelope === undefined || !envelope.running) {
    return false;
  }
  return normalizeToolKey(envelope.toolId) === normalizeToolKey(toolName);
}

// D-18 sequencing primitive (used by plan 02-03): runs an optional follow-up
// ONLY after an accepted send, and never lets a follow-up failure propagate
// as an unhandled rejection — it is reported back instead.
export async function runAfterAccepted(
  send: () => Promise<ConfirmedSendOutcome>,
  followUp?: () => Promise<unknown>,
): Promise<{
  outcome: ConfirmedSendOutcome;
  followUp: "done" | "skipped" | "failed";
  followUpMessage?: string;
}> {
  const outcome = await send();
  if (outcome.status !== "accepted" || !followUp) {
    return { outcome, followUp: "skipped" };
  }
  try {
    await followUp();
    return { outcome, followUp: "done" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { outcome, followUp: "failed", followUpMessage: message };
  }
}
