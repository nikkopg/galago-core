// No imports. This module has one job: declare, per tool type, which
// recovery actions exist and which operator-supplied params each action
// requires. Exported data is deep-frozen. It is consumed server-side by
// recoveryControl.ts and client-side by the Run Recovery card, so the card
// and the server can never disagree about one action's shape (D-05).
// runControl.ts cannot be imported into a zero-import module; the fast
// entries below are inline VALUE COPIES of runControl.fast.resume/abort and
// are pinned to runControl by a deep strict-equal test.

export type RecoveryParamKind = "yesno" | "confirmYes" | "guid";

// yesno      : exactly "yes" or "no" (fast resume/abort — values come from runControl).
// confirmYes : exactly "yes"; anything else is refused, including "no".
// guid       : matches ^[^\s\u0000-\u001f\u0085\u007f]{1,256}$ and is never
//              trimmed or coerced (D-08).

export type RecoveryActionSpec = Readonly<Record<string, RecoveryParamKind>>;

export type RecoveryToolSpec = Readonly<Record<string, RecoveryActionSpec>>;

export type RecoveryRequestVerdict =
  | { ok: true; params: Record<string, string> }
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

// The fast entries are inline value copies of runControl.fast.resume/abort —
// one source of truth is kept literal by the deep strict-equal tests in
// test/recoveryActions.test.ts (D-05). A ToolType enum is never compared
// against the string "stack" directly (TS2367): keys are plain strings.
export const recoveryActions: Readonly<Record<string, RecoveryToolSpec>> = deepFreeze({
  fast: {
    resume: { is_tip_broken: "yesno" },
    abort: { return_liquid: "yesno" },
  },
  stack: { acknowledge_failure: { guid: "guid", arm_inspected: "confirmYes" } },
});

function recoveryToolSpec(toolType: string): RecoveryToolSpec | undefined {
  // Own-property lookup only: inherited names such as "constructor", "toString"
  // and "__proto__" must never resolve to a declared tool type (D-04).
  if (!Object.prototype.hasOwnProperty.call(recoveryActions, toolType)) {
    return undefined;
  }
  return recoveryActions[toolType];
}

export function getRecoverySpec(
  toolType: string,
  action: string,
): Readonly<Record<string, RecoveryParamKind>> | undefined {
  const toolSpec = recoveryToolSpec(toolType);
  if (!toolSpec) {
    return undefined;
  }
  if (!Object.prototype.hasOwnProperty.call(toolSpec, action)) {
    return undefined;
  }
  return toolSpec[action];
}

export function listRecoveryActions(toolType: string): string[] {
  const toolSpec = recoveryToolSpec(toolType);
  return toolSpec ? Object.keys(toolSpec) : [];
}

export function isRecoveryAction(toolType: string, action: string): boolean {
  return getRecoverySpec(toolType, action) !== undefined;
}

// The guid check is the sharpest operator-visible validation in this module
// (OPR-01): it accepts only a string that passes the pattern above, verbatim.
// The class extends the plan's ^[^\s\u0000-\u001f\u007f]{1,256}$ with \u0085
// (NEL): JavaScript's \s does not include U+0085, and a NEL-range control
// character must be refused like any other whitespace/control char (D-08).
// Length is bounded at 256 and the pattern is linear — a hostile long string
// causes no catastrophic backtracking (T-04-17).
const RECOVERY_GUID_PATTERN = /^[^\s\u0000-\u001f\u0085\u007f]{1,256}$/;

export function isValidRecoveryGuid(value: unknown): boolean {
  return typeof value === "string" && RECOVERY_GUID_PATTERN.test(value);
}

function describeRecoveryValue(value: unknown): string {
  if (value === undefined) {
    return "(missing)";
  }
  try {
    return `(got ${JSON.stringify(value)})`;
  } catch {
    return `(got ${String(value)})`;
  }
}

// Fixed refusal order, cloned from runControl.ts's validateControlRequest
// (D-05, QUE-03 ordering):
//   (a) no running step (blank runningToolType)
//   (b) tool type has no recovery entry
//   (c) action not declared for that tool type
//   (d) a declared param fails its kind
//   (e) an undeclared parameter was sent
// The first failing check alone sets the error; later checks never run —
// with (d) always before (e) (D-14).
export function validateRecoveryRequest(
  runningToolType: string | undefined,
  action: string,
  params: Record<string, unknown>,
): RecoveryRequestVerdict {
  if (runningToolType === undefined || runningToolType.trim() === "") {
    return {
      ok: false,
      code: "PRECONDITION_FAILED",
      message: "No step is currently running.",
    };
  }

  const toolSpec = recoveryToolSpec(runningToolType);
  if (!toolSpec) {
    return {
      ok: false,
      code: "PRECONDITION_FAILED",
      message: `Tool type "${runningToolType}" does not support recovery actions.`,
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

  const out: Record<string, string> = {};

  for (const paramName of Object.keys(actionSpec)) {
    const value = Object.prototype.hasOwnProperty.call(params, paramName)
      ? params[paramName]
      : undefined;
    const kind = actionSpec[paramName];
    // Never trim, case-fold, default or coerce: values keep their case and
    // whitespace exactly; only the exact string each kind names is accepted.
    if (kind === "yesno") {
      if (value !== "yes" && value !== "no") {
        return {
          ok: false,
          code: "BAD_REQUEST",
          message: `Decision "${paramName}" must be "yes" or "no" ${describeRecoveryValue(value)}.`,
        };
      }
    } else if (kind === "confirmYes") {
      if (value !== "yes") {
        return {
          ok: false,
          code: "BAD_REQUEST",
          message: `Decision "${paramName}" must be "yes" ${describeRecoveryValue(value)}.`,
        };
      }
    } else if (kind === "guid") {
      if (!isValidRecoveryGuid(value)) {
        return {
          ok: false,
          code: "BAD_REQUEST",
          message: `Parameter "${paramName}" must be a guid of 1-256 characters with no spaces or control characters ${describeRecoveryValue(value)}.`,
        };
      }
    }
    out[paramName] = value as string;
  }

  // (e) Reject any parameter that is not a declared param of this action,
  // in params' own-key order, after all declared params have passed (d
  // before e).
  for (const key of Object.keys(params)) {
    if (!Object.prototype.hasOwnProperty.call(actionSpec, key)) {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: `Parameter "${key}" is not a decision of action "${action}".`,
      };
    }
  }

  return { ok: true, params: out };
}

// D-10: a tool replying SUCCESS while also sending an error message is
// treated as a refusal on these actions, not as an accepted acknowledge.
// fast resume/abort keep Tool.controlCommand's original result untouched.
export const RECOVERY_STRICT_SUCCESS: Readonly<Record<string, readonly string[]>> = deepFreeze({
  stack: ["acknowledge_failure"],
});
