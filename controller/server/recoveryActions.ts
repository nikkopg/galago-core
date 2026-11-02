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
// (D-05, QUE-03 ordering). The argument is the RECOVERY TARGET's tool type —
// the only production caller (recoveryControl) is allowed to send while a
// DIFFERENT tool's step runs (D-01), so there is intentionally no "no step
// is currently running" server-side precondition here; the queue-state
// refusal lives in recoveryControl before this validation:
//   (a) tool type is blank/undefined or has no recovery entry
//   (b) action not declared for that tool type
//   (c) a declared param fails its kind
//   (d) an undeclared parameter was sent
// The first failing check alone sets the error; later checks never run —
// with (c) always before (d) (D-14).
export function validateRecoveryRequest(
  toolType: string | undefined,
  action: string,
  params: Record<string, unknown>,
): RecoveryRequestVerdict {
  const toolSpec = recoveryToolSpec(toolType ?? "");
  if (!toolSpec) {
    return {
      ok: false,
      code: "PRECONDITION_FAILED",
      message: `Tool type "${toolType ?? ""}" does not support recovery actions.`,
    };
  }

  if (!Object.prototype.hasOwnProperty.call(toolSpec, action)) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: `Action "${action}" is not available for tool type "${toolType}".`,
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

  // (d) Reject any parameter that is not a declared param of this action,
  // in params' own-key order, after all declared params have passed (c
  // before d).
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

// ===================== Latch read (D-11, D-13) =====================
// The server sends ONE fixed command constant through Tool.executeCommand
// (tool.latchStatus in routers/tool.ts) — never the operator control path,
// never a client-chosen command. This keeps the Run Recovery card from ever
// becoming a generic command sender (ACK-AND-F3.md §3.3).

// The frozen oneof key (galago-tools Phase 4, stack.proto @ bcbbf8e — D-13/A1
// resolved). Exactly one constant owns the name; the activation test (GEN-04b)
// pins this constant against the generated stack.Command oneof.
export const LATCH_READ_COMMAND = "get_failure_latch";

export interface LatchInfo {
  latched: boolean;
  guid?: string;
  kind?: string;
  explanation?: string;
  unknown: boolean;
  raw: Record<string, unknown>;
}

// Pure, shape-tolerant interpreter for the latch reply (D-13): galago-tools'
// wire shape is NOT frozen yet ({"kind","latched","guid","resultKind","reason",
// "explanation"} per its G2 row), so the guid is looked up as a string at the
// top level, under `latch`, or under `result` — the FIRST candidate carrying a
// non-empty string guid wins. No proto imports of any kind: unit-testable
// against plain objects. Never trims or coerces (same D-08 rule).
export function extractLatch(meta: Record<string, unknown> | undefined): LatchInfo {
  const raw: Record<string, unknown> = meta ?? {};
  if (Object.keys(raw).length === 0) {
    return { latched: false, unknown: false, raw: {} };
  }

  const candidates = [raw, readCandidate(raw, "latch"), readCandidate(raw, "result")];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const guid = candidate.guid;
    if (typeof guid === "string" && guid !== "") {
      return {
        latched: true,
        guid,
        kind: preferredString(candidate, ["kind", "resultKind"]),
        explanation: preferredString(candidate, ["explanation", "reason"]),
        unknown: false,
        raw,
      };
    }
  }

  // A non-empty object whose shapes this module cannot interpret as a latch
  // guid: flagged unknown so the card shows the full raw object in the
  // collapsible instead of pretending to know (D-13).
  return { latched: false, unknown: true, raw };
}

function readCandidate(
  raw: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : undefined;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

// kind/explanation read preferentially over resultKind/reason (galago-tools
// shape space carries both); only plain string fields are carried, verbatim.
function preferredString(candidate: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = candidate[key];
    if (typeof value === "string" && value !== "") {
      return value;
    }
  }
  return undefined;
}
