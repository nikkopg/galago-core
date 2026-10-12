// No imports. This module has one job: declare, per tool type, which live
// control actions exist and which operator decisions each action requires.
// It is imported by both the server (CommandQueue.toolControl, D-03) and,
// in Phase 2, the UI control bar — one source of truth for the shape (D-09).

export type RunControlDecisionKind = "yesno";

export type RunControlActionSpec = Readonly<Record<string, RunControlDecisionKind>>;

export type RunControlToolSpec = Readonly<Record<string, RunControlActionSpec>>;

export type ControlDecisionValue = "yes" | "no";

export type ControlRequestVerdict =
  | { ok: true; decisions: Record<string, ControlDecisionValue> }
  | { ok: false; code: "PRECONDITION_FAILED" | "BAD_REQUEST"; message: string };

function deepFreeze<T>(value: T): T {
  Object.freeze(value);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as object)) {
      const child = (value as Record<string, unknown>)[key];
      if (child && typeof child === "object" && !Object.isFrozen(child)) {
        deepFreeze(child);
      }
    }
  }
  return value;
}

// The F.A.S.T. is declared first (D-09). Pause has no decisions at all —
// in particular no hard/soft flag (design D5). Resume and abort each
// require exactly one yes/no decision from the operator.
export const runControl: Readonly<Record<string, RunControlToolSpec>> = deepFreeze({
  fast: {
    pause: {},
    resume: { is_tip_broken: "yesno" },
    abort: { return_liquid: "yesno" },
  },
});

// Own-property lookup only: inherited names such as "constructor", "toString"
// and "__proto__" must never resolve to a declared tool type (D-09/D-10).
export function getRunControl(toolType: string): RunControlToolSpec | undefined {
  if (!Object.prototype.hasOwnProperty.call(runControl, toolType)) {
    return undefined;
  }
  return runControl[toolType];
}

function describeValue(value: unknown): string {
  if (value === undefined) {
    return "(missing)";
  }
  try {
    return `(got ${JSON.stringify(value)})`;
  } catch {
    return `(got ${String(value)})`;
  }
}

// Fixed refusal order (D-03, QUE-03 ordering):
//   (a) no running step
//   (b) running step's tool type has no runControl entry
//   (c) action not declared for that tool type
//   (d) a declared decision is missing, blank, or not exactly "yes"/"no"
//   (e) an undeclared parameter was sent (added in plan 01-02 Task 2)
// The first failing check alone sets the error; later checks never run.
export function validateControlRequest(
  runningToolType: string | undefined,
  action: string,
  params: Record<string, unknown>,
): ControlRequestVerdict {
  if (runningToolType === undefined) {
    return {
      ok: false,
      code: "PRECONDITION_FAILED",
      message: "No step is currently running.",
    };
  }

  const toolSpec = getRunControl(runningToolType);
  if (!toolSpec) {
    return {
      ok: false,
      code: "PRECONDITION_FAILED",
      message: `Tool type "${runningToolType}" does not support live run control.`,
    };
  }

  if (!Object.prototype.hasOwnProperty.call(toolSpec, action)) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: `Action "${action}" is not available for tool type "${runningToolType}".`,
    };
  }

  const actionSpec = toolSpec[action];
  const decisions: Record<string, ControlDecisionValue> = {};

  for (const decisionName of Object.keys(actionSpec)) {
    const value = Object.prototype.hasOwnProperty.call(params, decisionName)
      ? params[decisionName]
      : undefined;
    // Never trim, case-fold, default or coerce: only the exact strings
    // "yes" and "no" are accepted.
    if (value !== "yes" && value !== "no") {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: `Decision "${decisionName}" must be "yes" or "no" ${describeValue(value)}`,
      };
    }
    decisions[decisionName] = value;
  }

  // (e) Reject any parameter that is not a declared decision of this action.
  // This is the fail-closed reading of "validate decision values against
  // runControl": it guarantees a hard/soft pause flag can never be forwarded
  // (design D5). Checked in params' own-key order, after all declared
  // decisions have passed (d before e).
  for (const key of Object.keys(params)) {
    if (!Object.prototype.hasOwnProperty.call(actionSpec, key)) {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: `Parameter "${key}" is not a decision of action "${action}".`,
      };
    }
  }

  return { ok: true, decisions };
}
