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
      status: "ok" | "unknown";
      runState: RunState | null;
      updatedAt: number | null;
      lastError?: string;
    };

export type ExtractRunStateResult =
  | { ok: true; runState: RunState | null }
  | { ok: false; error: string };

// The single reader of run_state (D-13). Before QUE-06 regenerates the
// interfaces, the generated StatusReply has no run_state field, so it is read
// through exactly one narrow cast, kept inside this function only. Plan
// 01-05 swaps this for the typed field.
//
// Happy-path mapping only in this task: shape validation and malformed-input
// rejection are added next.
export function extractRunState(statusReply: tool_base.StatusReply): ExtractRunStateResult {
  try {
    const runStateRaw = (statusReply as tool_base.StatusReply & { run_state?: unknown })
      .run_state;

    if (runStateRaw === undefined || runStateRaw === null) {
      return { ok: true, runState: null };
    }

    const obj = runStateRaw as Record<string, unknown>;
    const stateValue = obj["state"] as string;

    const percentValue = obj["percent"];
    const percent = Number.isFinite(percentValue) ? (percentValue as number) : null;

    const pauseRaw = obj["pause"];
    let pause: PauseState | null = null;
    if (pauseRaw !== undefined && pauseRaw !== null) {
      const pauseObj = pauseRaw as Record<string, unknown>;
      const nameValue = pauseObj["errorName"];
      const codeValue = pauseObj["errorCode"];
      const sinceValue = pauseObj["since"];
      const detailValue = pauseObj["eventPayload"];
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
//
// Failure handling, the in-flight guard and malformed-payload handling are
// added next; this task covers the happy path only.
export class RunStateMonitor {
  private readonly intervalMs: number;
  private readonly lookupTool: LookupToolFn;
  private envelope: RunStateEnvelope = { running: false };
  private intervalHandle: ReturnType<typeof setInterval> | undefined;
  private generation = 0;

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
    this.envelope = { running: false };
  }

  snapshot(): RunStateEnvelope {
    return { ...this.envelope };
  }

  private async _poll(step: Readonly<RunningStep>, generation: number): Promise<void> {
    const tool = this.lookupTool(step.toolId);
    if (!tool) {
      return;
    }
    // The only RPC this class ever makes (D-14): observation never commands.
    const statusReply = await tool.grpc.getStatus({});
    if (generation !== this.generation) {
      // A later start()/stop() superseded this poll: discard the stale result.
      return;
    }
    const result = extractRunState(statusReply);
    this.envelope = {
      running: true,
      queueId: step.queueId,
      runId: step.runId,
      toolId: step.toolId,
      toolType: step.toolType,
      status: "ok",
      runState: result.ok ? result.runState : null,
      updatedAt: Date.now(),
    };
  }
}
