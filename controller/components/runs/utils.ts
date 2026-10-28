import { RunCommand, GroupedCommand } from "@/types";
import { deriveRunOutcome } from "./runOutcome";

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
      completedAt = lastCommand?.completedAt || "";
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
