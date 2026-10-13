// Reads a running tool's live run_state and exposes a poll-cached snapshot to
// commandQueue.runState (D-11, D-12). The poller only ever observes a tool's
// status — it never sends a command — and it is independent of the queue's
// own modal state: it neither reads nor writes any of that bookkeeping
// (D-12, D-14).
import * as tool_base from "gen-interfaces/tools/grpc_interfaces/tool_base";
import Tool from "./tools";
import { getRunControl } from "./runControl";
import type { RunningStep } from "./command_queue";

// D-11 / design D2: the run-state poll interval.
export const RUN_STATE_POLL_INTERVAL_MS = 2000;

export interface PauseState {
  name: string | null;
  code: number | null;
  detail: unknown;
  startedAt: string | null;
}

export interface RunState {
  state: string;
  percent: number | null;
  pause: PauseState | null;
}

// D-12: the stable envelope commandQueue.runState returns, regardless of
// whether a poll is pending, succeeded or failed.
export type RunStateEnvelope =
  | { running: false }
  | {
      running: true;
      queueId: number;
      runId: string;
      toolId: string;
      toolType: RunningStep["toolType"];
      command: string;
      status: "ok" | "unknown";
      runState: RunState | null;
      updatedAt: number | null;
      lastError?: string;
    };

export type ExtractRunStateResult =
  | { ok: true; runState: RunState | null }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The single reader of run_state (D-13). After QUE-06's regeneration the
// generated StatusReply carries the typed run_state field directly (a Struct
// unwrapped to a plain object by the generated decoder), so no cast is
// needed here. Never throws: any unexpected shape is reported as { ok: false }.
export function extractRunState(statusReply: tool_base.StatusReply): ExtractRunStateResult {
  try {
    const runStateRaw = statusReply.run_state;

    if (runStateRaw === undefined || runStateRaw === null) {
      return { ok: true, runState: null };
    }

    if (!isPlainObject(runStateRaw)) {
      return { ok: false, error: "run_state is not an object" };
    }

    const stateValue = runStateRaw["state"];
    if (typeof stateValue !== "string") {
      return { ok: false, error: "run_state.state is missing or not a string" };
    }

    const percentValue = runStateRaw["percent"];
    const percent = Number.isFinite(percentValue) ? (percentValue as number) : null;

    const pauseRaw = runStateRaw["pause"];
    let pause: PauseState | null = null;
    if (pauseRaw !== undefined && pauseRaw !== null) {
      if (!isPlainObject(pauseRaw)) {
        return { ok: false, error: "run_state.pause is not an object" };
      }
      const nameValue = pauseRaw["errorName"];
      const codeValue = pauseRaw["errorCode"];
      const sinceValue = pauseRaw["since"];
      const detailValue = pauseRaw["eventPayload"];
      pause = {
        name: typeof nameValue === "string" ? nameValue : null,
        code: Number.isFinite(codeValue) ? (codeValue as number) : null,
        detail: detailValue === undefined ? null : detailValue,
        startedAt: typeof sinceValue === "string" ? sinceValue : null,
      };
    }

    return { ok: true, runState: { state: stateValue, percent, pause } };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

type LookupToolResult =
  | { grpc: { getStatus: (req: {}) => Promise<tool_base.StatusReply> } }
  | undefined;
type LookupToolFn = (toolId: string) => LookupToolResult;

export interface RunStateMonitorOptions {
  intervalMs?: number;
  lookupTool?: LookupToolFn;
}

// Ties a 2 s poller (D-11) to the lifetime of one controllable tool step.
// start()/stop() are called from the busy loop's tool-step bracket;
// snapshot() backs commandQueue.runState and triggers no RPC of its own.
export class RunStateMonitor {
  private readonly intervalMs: number;
  private readonly lookupTool: LookupToolFn;
  private envelope: RunStateEnvelope = { running: false };
  private intervalHandle: ReturnType<typeof setInterval> | undefined;
  private generation = 0;
  private inFlight = false;

  constructor(opts: RunStateMonitorOptions = {}) {
    this.intervalMs = opts.intervalMs ?? RUN_STATE_POLL_INTERVAL_MS;
    this.lookupTool = opts.lookupTool ?? ((toolId: string) => Tool.lookup(toolId));
  }

  start(step: Readonly<RunningStep>): void {
    this.stop();

    // Only a tool type with a declared runControl entry is polled (D-11).
    if (getRunControl(step.toolType) === undefined) {
      return;
    }

    this.generation += 1;
    const generation = this.generation;
    // The first poll is pending: status "unknown" with no error and no
    // updatedAt yet distinguishes "pending" from "failed" for callers.
    this.envelope = {
      running: true,
      queueId: step.queueId,
      runId: step.runId,
      toolId: step.toolId,
      toolType: step.toolType,
      command: step.command,
      status: "unknown",
      runState: null,
      updatedAt: null,
    };

    void this._poll(step, generation);
    // The GLOBAL setInterval (no module import for it): vitest fake timers
    // only control the global.
    this.intervalHandle = setInterval(() => {
      void this._poll(step, generation);
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    this.generation += 1;
    this.inFlight = false;
    this.envelope = { running: false };
  }

  snapshot(): RunStateEnvelope {
    return { ...this.envelope };
  }

  private async _poll(step: Readonly<RunningStep>, generation: number): Promise<void> {
    if (this.inFlight) {
      // A poll is already outstanding: skip this tick so there is at most
      // one call in flight at a time (D-11).
      return;
    }
    this.inFlight = true;
    try {
      const tool = this.lookupTool(step.toolId);
      if (!tool) {
        throw new Error(`tool ${step.toolId} is not connected`);
      }
      // The only RPC this class ever makes (D-14): observation never commands.
      const statusReply = await tool.grpc.getStatus({});
      const result = extractRunState(statusReply);
      if (!result.ok) {
        this._applyUnknown(generation, step, result.error);
        return;
      }
      this._applySuccess(generation, step, result.runState);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._applyUnknown(generation, step, message);
    } finally {
      // Only clear the flag when the completing poll still belongs to the
      // current generation: a stale poll from a superseded generation must
      // not clear inFlight out from under a genuinely in-flight current-
      // generation poll (stop()'s own direct reset already handles the
      // generation-boundary case).
      if (generation === this.generation) {
        this.inFlight = false;
      }
    }
  }

  private _applySuccess(
    generation: number,
    step: Readonly<RunningStep>,
    runState: RunState | null,
  ): void {
    if (generation !== this.generation) {
      // A later start()/stop() superseded this poll: discard the stale result.
      return;
    }
    this.envelope = {
      running: true,
      queueId: step.queueId,
      runId: step.runId,
      toolId: step.toolId,
      toolType: step.toolType,
      command: step.command,
      status: "ok",
      runState,
      updatedAt: Date.now(),
    };
  }

  private _applyUnknown(
    generation: number,
    step: Readonly<RunningStep>,
    errorMessage: string,
  ): void {
    if (generation !== this.generation) {
      return;
    }
    const current = this.envelope;
    const previousRunState = current.running ? current.runState : null;
    this.envelope = {
      running: true,
      queueId: step.queueId,
      runId: step.runId,
      toolId: step.toolId,
      toolType: step.toolType,
      command: step.command,
      status: "unknown",
      runState: previousRunState,
      updatedAt: Date.now(),
      lastError: errorMessage,
    };
  }
}
