import * as vm from "vm";
import { AdvancedParameters, ToolCommandInfo } from "@/types";
import { logAction } from "@/server/logger";
import { normalizeLane, PRIMARY_LANE } from "@/server/laneScheduling";

export interface ScriptExecutionResult {
  commands: ToolCommandInfo[];
  logs: string[];
  success: boolean;
  error?: string;
}

export async function executeProtocolScript(
  scriptContent: string,
  params: Record<string, string>,
  timeout: number = 5000,
): Promise<ScriptExecutionResult> {
  const commands: ToolCommandInfo[] = [];
  const logs: string[] = [];
  // Sticky lane set by galago.lane(); undefined means the primary lane (D-19).
  let currentLane: string | undefined;

  const galago = {
    // Sets the lane for later galago.command calls. Blank or "primary" resets it.
    lane(name?: string) {
      const normalised = normalizeLane(name);
      currentLane = normalised === PRIMARY_LANE ? undefined : normalised;
    },

    command(
      toolId: string,
      command: string,
      cmdParams: Record<string, any> = {},
      opts: { lane?: string; barrier?: boolean } = {},
    ) {
      // Tool Box helpers never inherit the sticky lane (D-19); an explicit per-call
      // lane is still honoured so validation can refuse it with a clear sentence.
      const effectiveLane =
        opts.lane !== undefined
          ? normalizeLane(opts.lane)
          : toolId === "Tool Box"
            ? undefined
            : currentLane;

      // lane / laneBarrier are written only when set, never as undefined, "" or false.
      const advancedParameters: AdvancedParameters = {
        skipExecutionVariable: { variable: null, value: "" },
        runAsynchronously: false,
      };
      if (effectiveLane !== undefined && effectiveLane !== PRIMARY_LANE) {
        advancedParameters.lane = effectiveLane;
      }
      if (opts.barrier === true) {
        advancedParameters.laneBarrier = true;
      }

      commands.push({
        toolId,
        toolType: "unknown" as any,
        command,
        params: cmdParams,
        label: "",
        advancedParameters,
      });
    },

    timer({ minutes = 0, seconds = 30, message = "Timer in progress..." } = {}) {
      this.command("Tool Box", "timer", { minutes, seconds, message });
    },

    pause(message = "Run is paused. Click Continue to resume.") {
      this.command("Tool Box", "pause", { message });
    },

    showMessage(message: string, title = "Message") {
      this.command("Tool Box", "show_message", { message, title });
    },

    note(message: string) {
      this.command("Tool Box", "note", { message });
    },

    assignVariable(name: string, value: string) {
      this.command("Tool Box", "variable_assignment", { name, value });
    },

    userForm(name: string) {
      this.command("Tool Box", "user_form", { name });
    },
  };

  const sandboxConsole = {
    log: (...args: any[]) => logs.push(args.map(String).join(" ")),
    warn: (...args: any[]) => logs.push("[WARN] " + args.map(String).join(" ")),
    error: (...args: any[]) => logs.push("[ERROR] " + args.map(String).join(" ")),
  };

  try {
    const sandbox = {
      galago,
      params,
      console: sandboxConsole,
      Math,
      Array,
      Object,
      String,
      Number,
      Boolean,
      JSON,
      Date,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
    };

    const context = vm.createContext(sandbox);

    const script = new vm.Script(scriptContent, {
      filename: "protocol-script.js",
    });

    script.runInContext(context, { timeout });

    if (commands.length === 0) {
      return {
        commands: [],
        logs,
        success: false,
        error: "Script produced no commands. Use galago.command() to emit commands.",
      };
    }

    logAction({
      level: "info",
      action: "Protocol Script Execution",
      details: `Script generated ${commands.length} commands`,
    });

    return { commands, logs, success: true };
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logAction({
      level: "error",
      action: "Protocol Script Error",
      details: `Script execution failed: ${errorMessage}`,
    });

    return {
      commands: [],
      logs,
      success: false,
      error: errorMessage,
    };
  }
}
