import { RunCommand, GroupedCommand } from "@/types";
import { deriveRunOutcome } from "./runOutcome";
import { laneOf, PRIMARY_LANE } from "@/server/laneScheduling";
import type { LaneCommandInfo } from "@/server/laneScheduling";

function rowLane(row: unknown): string {
  const info =
    typeof row === "object" && row !== null
      ? (row as { commandInfo?: unknown }).commandInfo
      : undefined;
  return laneOf(info as LaneCommandInfo | undefined);
}

export function getRunAttributes(runInfo: any, commandInfo: any) {
  if (!runInfo) {
    return {
      runId: "",
      runName: runInfo?.run_type || "Unknown Run",
      commandsCount: 0,
      params: {},
      status: "UNKNOWN",
      createdAt: "",
      completedAt: "",
      startedAt: "",
    };
  }

  // Use run_type as the name (it's the protocol ID)
  let runName = runInfo.run_type || "Unknown Run";

  const status = deriveRunOutcome(commandInfo);
  let startedAt = "";
  let completedAt = "";
  let createdAt = "";

  if (Array.isArray(commandInfo) && commandInfo.length > 0) {
    createdAt = commandInfo[0]?.createdAt || "";
    const lastCommand = commandInfo[commandInfo.length - 1];

    if (status === "COMPLETED" || status === "COMPLETED_WITH_SKIPPED_FAILURE") {
      if (commandInfo.some((cmd: any) => rowLane(cmd) !== PRIMARY_LANE)) {
        // P-6: lanes overlap, so the last array row is not the last to finish.
        let latest = -Infinity;
        for (const cmd of commandInfo) {
          if (cmd?.status !== "COMPLETED" || !cmd.completedAt) continue;
          const t = new Date(cmd.completedAt).getTime();
          if (Number.isNaN(t) || t <= latest) continue;
          latest = t;
          completedAt = cmd.completedAt;
        }
      } else {
        completedAt = lastCommand?.completedAt || "";
      }
    } else if (status === "STARTED") {
      startedAt = commandInfo.find((cmd: any) => cmd?.status === "STARTED")?.startedAt || "";
    }
  }

  return {
    runId: runInfo.id,
    runName,
    commandsCount: runInfo.commands_count || 0,
    params: runInfo.params || {},
    status,
    createdAt,
    completedAt,
    startedAt,
  };
}

export interface LaneRowGroup<T> {
  lane: string;
  rows: T[];
}

// One group per lane in first-appearance order (rows keep queue order within a
// lane), or null when every row is primary so callers keep the legacy flat DOM.
export function groupRowsByLane<T extends { commandInfo?: unknown }>(
  rows: T[],
): LaneRowGroup<T>[] | null {
  if (!rows.some((row) => rowLane(row) !== PRIMARY_LANE)) return null;
  const groups: LaneRowGroup<T>[] = [];
  for (const row of rows) {
    const lane = rowLane(row);
    let group = groups.find((g) => g.lane === lane);
    if (!group) {
      group = { lane, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

export function groupCommandsByRun(commands: RunCommand[]): GroupedCommand[] {
  const groupedCommands: GroupedCommand[] = [];
  const runIds: string[] = [];

  commands.forEach((command) => {
    if (!runIds.includes(command.runId)) {
      runIds.push(command.runId);
      groupedCommands.push({
        Id: command.runId,
        Commands: [],
      });
    }
    groupedCommands[runIds.indexOf(command.runId)].Commands.push(command);
  });

  return groupedCommands;
}
