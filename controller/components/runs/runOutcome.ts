import { storedErrorText } from "./storedError";
import { laneOf, PRIMARY_LANE } from "@/server/laneScheduling";
import type { LaneCommandInfo } from "@/server/laneScheduling";

// Client-only run outcome (D-18). The persisted RunStatus is deliberately not
// widened; this union is derived for display from the rows the page polls.
export type RunOutcome =
  | "CREATED"
  | "QUEUED"
  | "STARTED"
  | "FAILED"
  | "COMPLETED"
  | "COMPLETED_WITH_SKIPPED_FAILURE";

export interface RunOutcomeBadge {
  label: string;
  title: string;
  colorScheme: "orange";
}

function statusOf(row: unknown): unknown {
  return typeof row === "object" && row !== null ? (row as { status?: unknown }).status : undefined;
}

function errorOf(row: unknown): unknown {
  return typeof row === "object" && row !== null ? (row as { error?: unknown }).error : undefined;
}

function laneOfRow(row: unknown): string {
  const info =
    typeof row === "object" && row !== null
      ? (row as { commandInfo?: unknown }).commandInfo
      : undefined;
  return laneOf(info as LaneCommandInfo | undefined);
}

// D-22: lanes overlap, so "the last row is COMPLETED" no longer means done. A lane
// run is complete only when every row is COMPLETED or SKIPPED.
function deriveLaneRunOutcome(commands: unknown[], statuses: unknown[]): RunOutcome {
  if (statuses.includes("FAILED")) return "FAILED";
  const hasStarted = statuses.includes("STARTED");
  const hasCreated = statuses.includes("CREATED");
  if (
    !hasStarted &&
    !hasCreated &&
    commands.some((row) => statusOf(row) === "SKIPPED" && storedErrorText(errorOf(row)) !== null)
  ) {
    return "COMPLETED_WITH_SKIPPED_FAILURE";
  }
  if (statuses.every((status) => status === "COMPLETED" || status === "SKIPPED")) {
    return "COMPLETED";
  }
  if (hasStarted) return "STARTED";
  if (statuses.every((status) => status === "CREATED")) return "QUEUED";
  return "CREATED";
}

export function deriveRunOutcome(commands: unknown): RunOutcome {
  if (!Array.isArray(commands) || commands.length === 0) return "CREATED";

  const statuses = commands.map(statusOf);
  if (commands.some((row) => laneOfRow(row) !== PRIMARY_LANE)) {
    return deriveLaneRunOutcome(commands, statuses);
  }
  const last = statuses[statuses.length - 1];
  const hasStarted = statuses.includes("STARTED");
  const hasCreated = statuses.includes("CREATED");

  // D-19: any FAILED row means the run failed, even if a later row completed.
  if (statuses.includes("FAILED")) return "FAILED";

  // D-18: a skipped step that carries an error is a skipped failure, evaluated
  // before both COMPLETED branches. A COMPLETED row's stale error is ignored
  // because only SKIPPED rows are tested.
  if (
    !hasStarted &&
    !hasCreated &&
    commands.some((row) => statusOf(row) === "SKIPPED" && storedErrorText(errorOf(row)) !== null)
  ) {
    return "COMPLETED_WITH_SKIPPED_FAILURE";
  }

  if (last === "COMPLETED") return "COMPLETED";
  if (hasStarted) return "STARTED";
  if (statuses.every((status) => status === "CREATED")) return "QUEUED";
  if (last === "SKIPPED" && !hasCreated && !hasStarted) return "COMPLETED";
  return "CREATED";
}

export function runOutcomeBadge(outcome: string): RunOutcomeBadge | null {
  if (outcome !== "COMPLETED_WITH_SKIPPED_FAILURE") return null;
  return {
    label: "Skipped failure",
    title: "Completed, but a failed step was skipped, not completed.",
    colorScheme: "orange",
  };
}

export function runProgressColorScheme(outcome: string): "teal" | "orange" {
  return outcome === "COMPLETED_WITH_SKIPPED_FAILURE" ? "orange" : "teal";
}
