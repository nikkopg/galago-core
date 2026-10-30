// No imports. This module has one job: declare, per tool type, which commands
// are operator-only — deny-by-default for every non-operator path: protocols,
// scripts, imported JSON, queue rows, the editor and direct runCommand calls.
// It is imported by the server enforcement points (Tool.executeCommand,
// RunStore.createFromProtocol); the operator path (Tool.controlCommand /
// recoveryControl) is deliberately NOT guarded by it. See ACK-AND-F3.md §2.1 —
// hiding from commandFields is not the mechanism; enforcement is.

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

// D-01 — the stack acknowledge lives here today; the fast control actions join
// now (the table already drives both enforcement points generically). Removing
// an entry later is deleting one line from the table.
export const operatorOnlyCommands: Readonly<Record<string, readonly string[]>> = deepFreeze({
  stack: ["acknowledge_failure"],
  fast: ["pause", "resume", "abort"],
});

// Own-property lookup only: inherited names such as "constructor", "toString"
// and "__proto__" must never resolve to a declared tool type or command (D-04).
// Case/whitespace-insensitive on the COMMAND only; the toolType key is matched
// as typed (the declared keys "stack"/"fast" are already lowercase).
export function isOperatorOnlyCommand(toolType: string, command: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(operatorOnlyCommands, toolType)) {
    return false;
  }
  const list = operatorOnlyCommands[toolType] as readonly string[];
  const normalized = String(command).trim().toLowerCase();
  return list.includes(normalized);
}

// Plain uncoded Error subclass (ProtocolGenerationFailedError shape): no code
// property — the refusal is not a validation/classification error, it carries
// its operator-facing message only.
export class OperatorOnlyCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperatorOnlyCommandError";
  }
}

// Classify this refusal by name, not class identity: in next dev the RunStore
// singleton is pinned on `global` and can throw a class from an older module
// copy than the caller's (G-04-7). Same approach as pages/api/runs and tRPC's
// own TRPCError check.
export function isOperatorOnlyCommandError(e: unknown): e is OperatorOnlyCommandError {
  return e instanceof Error && e.name === "OperatorOnlyCommandError";
}
