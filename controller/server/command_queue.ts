import { Run, RunQueue } from "@/types";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import RunStore from "./runs";
import Tool, { ToolControlResult } from "./tools";
import SqliteQueue, { StoredRunCommand } from "./utils/SqliteQueue";
import path from "path";
import fs from "fs";
import { ToolType } from "gen-interfaces/controller";
import { logger } from "@/logger";
import { logAction, sanitizeLogText } from "./logger";
import { db } from "@/db/client";
import { appSettings, variables, workcells } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEmailMessage, sendSlackMessage } from "@/server/utils/integrationsLocal";
import { TRPCError } from "@trpc/server";
import { getRunControl, runControl, validateControlRequest } from "./runControl";
import {
  PRIMARY_LANE,
  LaneValidationError,
  lanesWithWork,
  laneOf,
  pickEligible,
  toolKeyOf,
  validateLanes,
  type LaneFailureEntry,
  type LaneGate,
  type LaneStatusSnapshot,
  type RunningLaneEntry,
} from "./laneScheduling";
import { RunStateMonitor, type RunStateEnvelope } from "./runState";
import {
  describeQueueStart,
  describeQueueStartReadFailure,
  type QueueStartSource,
} from "./queueStartListing";

export type CommandQueueState = ToolStatus;

// Lane mode is decided once at construction (D-06). Both options exist for tests:
// the env flag is the production switch, the loop delay makes two-loop runs
// deterministic under fake timers.
export interface CommandQueueOptions {
  parallelLanes?: boolean;
  loopDelayMs?: number;
}

// Returned by _pickNext when work remains but nothing is eligible yet (lane mode only).
const WAIT = Symbol("lane-wait");

// The failure list the run banner shows is bounded (D-16, T-08-15): this many entries,
// then only a count of the rest.
const LANE_FAILURE_CAP = 8;

// Who failed, for the lane failure list. Passed only in lane mode.
interface LaneFailureContext {
  lane: string;
  queueId: number;
  toolId?: string;
  toolType?: unknown;
}

export enum QueueState {
  PAUSED = "PAUSED",
  MESSAGE = "MESSAGE",
  TIMER = "TIMER",
}

// UI message type for differentiating between pause and show_message
export interface UIMessage {
  type: "pause" | "message" | "timer" | "stop_run" | "user_form";
  message: string;
  title?: string;
  pausedAt?: number;
  timerDuration?: number;
  timerEndTime?: number;
  formName?: string; // Add this for user_form
}

// A snapshot of the single tool step the busy loop is currently awaiting.
// Set immediately before that step's executeCommand and cleared in a finally
// (D-01, D-02). In-memory only: a restart means no running step, by design.
// A row left STARTED by a previous process (one this process never saw as
// its own running step) is failed at CommandQueue construction instead
// (T-o44-03).
export interface RunningStep {
  queueId: number;
  runId: string;
  toolId: string;
  toolType: ToolType;
  command: string;
  startedAt: number;
}

// galago-web restarted mid-step: the instrument's real-world state after an
// interrupted step is unknown, so it is never automatically re-sent.
const INTERRUPTED_BY_RESTART_ERROR =
  "Interrupted: galago-web restarted while this step was running. It was not re-run; " +
  "check the instrument before re-queuing it.";

export class CommandQueue {
  private _state: CommandQueueState = ToolStatus.OFFLINE;
  private _runningPromise?: Promise<any>;
  error?: Error;
  // In memory only, like `error`. Bumped once per recorded failure so the run banner
  // can re-arm for a repeat of identical text. Seeded from the clock so a restarted
  // process never reuses a seq a still-open page has already dismissed (ERR-04).
  private _failureSeq: number = Date.now();
  private _lastAlertKey?: string;
  private _lastAlertAtMs?: number;
  private _runningStep?: Readonly<RunningStep>;
  // The run-state poller tied to the current tool-step bracket (D-11). Its
  // lifecycle is start()ed/stop()ed right alongside _runningStep below.
  private readonly _runStateMonitor = new RunStateMonitor();
  // The queueId of the running step whose operator Abort the tool accepted.
  // Set only from toolControl and consumed by the busy-loop catch when that
  // step ends: the catch fails it and dequeues the rest of its run (every
  // other queued step of the same run_id), instead of letting startNext
  // re-run any of them. In memory only, like _runningStep (D-01).
  private _abortAcceptedQueueId?: number;
  // The frozen snapshot of the latest attempt whose own failure was recorded
  // without an accepted abort. This is the per-attempt token for a late
  // abort reply (T-01-08, layer b): the late-reply branch of
  // _recordAcceptedAbort only acts when this still identically equals the
  // step the reply is for. Cleared on every new attempt and by any operator
  // queue action that supersedes a pending stale reply (_start, gotoCommand,
  // gotoCommandByRunIndex), and consumed (cleared) on use.
  private _failedAttempt?: Readonly<RunningStep>;
  // Set only after _recoverInterruptedSteps succeeds once (at construction
  // or from _start's retry). Guards against recovering twice and, more
  // importantly, against _start skipping the retry it needs when
  // construction's own attempt failed (T-o44-03).
  private _interruptedStepsRecovered = false;

  // Concurrency lanes (D-06, D-10). _laneMode is read once in the constructor and
  // never changes, so with it false every statement below is unreachable.
  private readonly _laneMode: boolean;
  private readonly _loopDelayMs: number;
  // One supervised loop per lane that has a live worker. The primary lane's loop
  // is the legacy busy loop; a side lane's is _runSideLane.
  private _laneLoops = new Map<string, Promise<void>>();
  // The step each side lane is awaiting right now. The primary lane's step stays in
  // _runningStep. Read by the dispatch gate so a tool server never gets two steps.
  private _sideRunning = new Map<string, Readonly<RunningStep>>();
  // Per-queueId abort marker and failed-attempt token for side-lane steps. The
  // legacy single fields above stay the primary lane's own slot (RESEARCH A7).
  private _sideAbortAccepted = new Set<number>();
  private _sideFailedAttempts = new Map<number, Readonly<RunningStep>>();
  // Runs seen with a non-primary lane row, so every later step of such a run is audited
  // as a lane dispatch even after its tagged rows have drained. Emptied with the queue.
  private _laneRunIds = new Set<string>();
  // The lane-halt latch (D-12, D-13, D-15). Set synchronously as the first statement of every
  // failure catch (or by freezeLanes), read by the dispatch gate in the same synchronous turn
  // as a claim. It is independent of the queue state, so a state that turns READY again
  // (clearError, resume, enqueue auto-start) never re-arms dispatch: only an accepted operator
  // Start clears it. A failure overrides a freeze.
  private _laneHalt?: { reason: "failure" | "freeze"; queueId?: number; lane?: string; at: number };
  // Every failure since the last operator Start, in time order (messages only, never a stack).
  private _laneFailures: LaneFailureEntry[] = [];
  private _laneFailureOverflow = 0;
  // The lane of the failure that is the banner error, for the "additional failure" audit line.
  private _bannerFailureLane?: string;

  // Message handling state variables
  private _isWaitingForInput: boolean = false;
  private _currentMessage: UIMessage = {
    type: "pause",
    message: "Run is paused. Click Continue to resume.",
    pausedAt: undefined,
  };
  private _messageResolve?: () => void;
  private _timerTimeout?: NodeJS.Timeout;

  commands: SqliteQueue;

  constructor(
    public runStore: RunStore,
    options?: CommandQueueOptions,
  ) {
    this._laneMode = options?.parallelLanes ?? process.env.GALAGO_PARALLEL_LANES === "1";
    this._loopDelayMs = options?.loopDelayMs ?? 1500;

    const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), "data", "queue.db");

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.commands = new SqliteQueue(dbPath, "command_queue_2");

    // Runs only here (construction of the single global CommandQueue,
    // before any busy loop in this process) and in _start until it has
    // succeeded once, so it never sees this process's own running step
    // (T-o44-04). The constructor must not throw: a failure here is
    // retried by _start before its first busy loop (fail closed).
    try {
      this._recoverInterruptedSteps();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logAction({
        level: "error",
        action: "Interrupted Step Recovery Failed",
        details: `error=${errorMessage} note=the queue will retry before its next start and will not start until that succeeds`,
      });
    }
  }

  // Fails every row left STARTED by a previous process and dequeues each
  // one's run remainder (the same run-wide primitive as an accepted abort).
  // Logs "Interrupted Step Failed" per orphan and sets
  // _interruptedStepsRecovered only after the SqliteQueue call succeeds;
  // logs nothing when there is nothing to recover.
  private _recoverInterruptedSteps(): void {
    const recovered = this.commands.recoverInterruptedSteps(
      new Error(INTERRUPTED_BY_RESTART_ERROR),
    );

    for (const entry of recovered) {
      logAction({
        level: "warning",
        action: "Interrupted Step Failed",
        details:
          `queueId=${entry.queueId} runId=${entry.runId} toolId=${entry.toolId ?? "unknown"} ` +
          `removed=${entry.remainder.length ? entry.remainder.join(",") : "none"} ` +
          `reason=galago-web restarted while the step was running; it was not re-run`,
      });
    }

    this._interruptedStepsRecovered = true;
  }

  fail(error: any) {
    if (!(error instanceof Error)) {
      error = new Error(error);
    }
    this._setState(ToolStatus.FAILED);
    this._recordFailure(error);
    logger.error("CommandQueue failed:", error);
  }

  private async _getAppSettingValue(name: string): Promise<string | null> {
    const rows = await db.select().from(appSettings).where(eq(appSettings.name, name)).limit(1);
    const s = rows[0];
    if (!s || s.isActive === false) return null;
    return (s.value ?? "").toString();
  }

  private async _getSelectedWorkcellId(): Promise<number> {
    const selectedWorkcellName = await this._getAppSettingValue("workcell");
    if (!selectedWorkcellName) {
      throw new Error("No workcell selected");
    }
    const wc = await db
      .select()
      .from(workcells)
      .where(eq(workcells.name, selectedWorkcellName))
      .limit(1);
    const id = wc[0]?.id;
    if (!id) {
      throw new Error(`Selected workcell '${selectedWorkcellName}' not found`);
    }
    return id;
  }

  private async _getVariableByName(varName: string) {
    const workcellId = await this._getSelectedWorkcellId();
    const rows = await db
      .select()
      .from(variables)
      .where(and(eq(variables.name, varName), eq(variables.workcellId, workcellId)))
      .limit(1);
    return rows[0] || null;
  }

  private async _getSettingBool(name: string, fallback: boolean): Promise<boolean> {
    try {
      const raw = await this._getAppSettingValue(name);
      if (!raw) return fallback;
      const v = String(raw).trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(v)) return true;
      if (["false", "0", "no", "off"].includes(v)) return false;
      return fallback;
    } catch {
      return fallback;
    }
  }

  private async _notifyFailure(opts: {
    error: Error;
    runId?: string;
    toolId?: string;
    toolType?: ToolType;
    command?: string;
    label?: string;
  }) {
    try {
      const errMsg = opts.error?.message || "Unknown error";
      const runId = opts.runId || "unknown";
      const toolId = opts.toolId || "unknown";
      const cmd = opts.command || "unknown";

      const key = `${runId}|${toolId}|${cmd}|${errMsg}`;
      const now = Date.now();
      if (this._lastAlertKey === key && this._lastAlertAtMs && now - this._lastAlertAtMs < 60_000) {
        return;
      }
      this._lastAlertKey = key;
      this._lastAlertAtMs = now;

      const slackEnabled = this.slackNotificationsEnabled
        ? await this._getSettingBool("enable_slack_alerts_on_failure", true)
        : false;
      const emailEnabled = await this._getSettingBool("enable_email_alerts_on_failure", false);

      if (!slackEnabled && !emailEnabled) return;

      const workcellName = (await this._getAppSettingValue("workcell")) || "unknown";

      const header = `Galago alert: run failure`;
      const lines = [
        `Workcell: ${workcellName}`,
        `Run: ${runId}`,
        `Tool: ${opts.toolType != null ? ToolType[opts.toolType] : "unknown"} (${toolId})`,
        `Command: ${cmd}${opts.label ? ` (${opts.label})` : ""}`,
        `Error: ${errMsg}`,
      ];
      const body = `${header}\n\n${lines.join("\n")}`;

      if (slackEnabled) {
        try {
          await sendSlackMessage({ message: body, auditAction: "integrations.slack.send" });
        } catch (e: any) {
          logger.warn("Slack alert failed:", e?.message || e);
        }
      }

      if (emailEnabled) {
        try {
          await sendEmailMessage({
            subject: header,
            message: body,
            auditAction: "integrations.email.send",
          });
        } catch (e: any) {
          logger.warn("Email alert failed:", e?.message || e);
        }
      }
    } catch (e: any) {
      logger.warn("Failure notification handler failed:", e?.message || e);
    }
  }

  get state(): CommandQueueState {
    return this._state;
  }

  // True while a busy loop owns the queue, i.e. when _start would be ignored. In lane
  // mode a Start is ignored only when every lane with work already has a live loop
  // (the primary lane always counts), so the restart router's `accepted` is false
  // only when a Start would launch nothing (P-2).
  get isStartInProgress(): boolean {
    if (!this._laneMode) return this._runningPromise !== undefined;
    if (this._laneLoops.size === 0) return false;
    try {
      const lanes = [PRIMARY_LANE, ...lanesWithWork(this.commands.queuedRowsSync())];
      return lanes.every((lane) => this._laneLoops.has(lane));
    } catch {
      return true;
    }
  }

  get laneMode(): boolean {
    return this._laneMode;
  }

  // Read-only accessor for the in-memory running-step record (D-01).
  get runningStep(): Readonly<RunningStep> | undefined {
    return this._runningStep;
  }

  // Read-only accessor for the run-state poller's cached snapshot (D-11,
  // D-12). It reads the cache only and triggers no RPC call of its own, and
  // it is independent of the queue's own modal-message state.
  get runState(): RunStateEnvelope {
    return this._runStateMonitor.snapshot();
  }

  // Check if queue is waiting for user input (either pause or message)
  get isWaitingForInput(): boolean {
    return this._isWaitingForInput;
  }

  // Get current message details
  get currentMessage(): UIMessage {
    return this._currentMessage;
  }

  // State management
  private _setState(newState: CommandQueueState) {
    logger.info(`CommandQueue state: ${newState} (was ${this._state})`);
    this._state = newState;
  }

  async evaluateExpression(expression: string): Promise<any> {
    // Regular expression to find variable references like {{varName}}
    // Arithmetic with numbers
    // ${counter} + 1            // Adds 1 to counter's value
    // ${price} * ${quantity}    // Multiplies two variables
    // (${num1} + ${num2}) / 2   // Average of two numbers

    // // String operations
    // "Hello, " + ${name}       // String concatenation
    // ${firstName} + " " + ${lastName}  // Multiple concatenation

    // // Boolean values (direct assignment)
    // ${isActive}               // Direct assignment for booleans

    // // Mixed operations (with automatic type conversion)
    // "Total: " + (${price} * ${quantity})  // Converts number result to string
    const variablePattern = /\${([^{}]+)}/g;
    let match;
    let resolvedExpression = expression;
    let resolvedVars: Record<string, any> = {};

    // Find all variable references in the expression
    const variablePromises: Promise<void>[] = [];
    const variableMatches: { fullMatch: string; varName: string }[] = [];
    const selectedWorkcellName = (await this._getAppSettingValue("workcell")) || "";
    let selectedWorkcellId: number | null = null;
    if (selectedWorkcellName) {
      const wc = await db
        .select()
        .from(workcells)
        .where(eq(workcells.name, selectedWorkcellName))
        .limit(1);
      selectedWorkcellId = wc[0]?.id ?? null;
    }

    // First, collect all variable references
    while ((match = variablePattern.exec(expression)) !== null) {
      const fullMatch = match[0];
      const varName = match[1].trim();
      variableMatches.push({ fullMatch, varName });

      // Create a promise to fetch each variable
      const promise = (async () => {
        if (!selectedWorkcellId) {
          throw new Error("No workcell selected (required to resolve variables)");
        }
        const rows = await db
          .select()
          .from(variables)
          .where(and(eq(variables.name, varName), eq(variables.workcellId, selectedWorkcellId)))
          .limit(1);
        const varResponse = rows[0];
        if (!varResponse) {
          throw new Error(`Variable ${varName} not found`);
        }
        const value: any = varResponse.value;
        resolvedVars[varName] = {
          value,
          type: (varResponse.type as any) || typeof value,
        };
      })();

      variablePromises.push(promise);
    }

    // Wait for all variable fetches to complete
    await Promise.all(variablePromises);

    // Now replace each variable reference with its value, handling types appropriately
    for (const { fullMatch, varName } of variableMatches) {
      if (!resolvedVars[varName]) {
        throw new Error(`Variable ${varName} not found`);
      }

      const varInfo = resolvedVars[varName];

      // For direct assignment (the expression is just a variable reference)
      if (expression.trim() === fullMatch) {
        return varInfo.value; // Return the raw value for direct assignment
      }

      // For expressions, replace the variable reference with a value that works in the expression
      if (varInfo.type === "string") {
        // Wrap strings in quotes for the expression evaluator
        resolvedExpression = resolvedExpression.replace(fullMatch, `"${varInfo.value}"`);
      } else if (varInfo.type === "number") {
        resolvedExpression = resolvedExpression.replace(fullMatch, varInfo.value);
      } else if (varInfo.type === "boolean") {
        resolvedExpression = resolvedExpression.replace(fullMatch, varInfo.value);
      } else {
        // For other types, convert to string and wrap in quotes
        resolvedExpression = resolvedExpression.replace(fullMatch, `"${varInfo.value}"`);
      }
    }

    try {
      // For security, we're using a restricted approach to evaluate the expression
      // This is safer than using eval() directly
      const result = Function('"use strict"; return (' + resolvedExpression + ")")();
      return result;
    } catch (e) {
      throw new Error(`Failed to evaluate expression "${expression}": ${e}`);
    }
  }

  getError() {
    return this.error || null;
  }

  get failureSeq(): number {
    return this._failureSeq;
  }

  // The single place a failure is recorded: sets the error and bumps the seq in
  // failure order. Never clears, acknowledges or retries anything (ERR-04).
  // In lane mode a failure with a context is also listed, and the first failure, which
  // carries the STACK guid, stays the banner error: a later one never replaces it (D-16).
  private _recordFailure(error: Error, ctx?: LaneFailureContext): void {
    this._failureSeq += 1;
    if (this._laneMode && ctx) {
      if (this._laneFailures.length < LANE_FAILURE_CAP) {
        this._laneFailures.push({
          lane: ctx.lane,
          queueId: ctx.queueId,
          toolId: ctx.toolId ?? "",
          toolType: ctx.toolType === undefined ? "" : String(ctx.toolType),
          message: error.message,
          at: Date.now(),
        });
      } else {
        this._laneFailureOverflow += 1;
      }
      if (this.error) {
        logAction({
          level: "warning",
          action: "Lane Halt Additional Failure",
          details: sanitizeLogText(
            `firstLane=${this._bannerFailureLane ?? "unknown"} lane=${ctx.lane} queueId=${ctx.queueId} message=${error.message}`,
          ),
        });
        return;
      }
      this._bannerFailureLane = ctx.lane;
    }
    this.error = error;
  }

  // Closes dispatch on every lane. Synchronous on purpose: it runs as the first statement of a
  // failure catch, before any await, so a lane that wakes during the failed step's own
  // fail-the-row await still finds the gate shut (D-12, Pitfall 15). Nothing is aborted.
  private _latchFailure(ctx: { queueId?: number; lane?: string }): void {
    if (this._laneHalt?.reason === "failure") return;
    this._laneHalt = { reason: "failure", ...ctx, at: Date.now() };
  }

  private async _ensureModalReady(): Promise<void> {
    // If we're already waiting for input, resolve the previous promise
    if (this._isWaitingForInput) {
      // Clear any active timer
      if (this._timerTimeout) {
        clearTimeout(this._timerTimeout);
        this._timerTimeout = undefined;
      }

      // If there's a pending promise, resolve it to prevent memory leaks
      if (this._messageResolve) {
        this._messageResolve();
        this._messageResolve = undefined;
      }

      // Reset the state
      this._isWaitingForInput = false;
      this._currentMessage = { type: "pause", message: "" };

      // Add a small delay to ensure all state updates have propagated
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async showUserForm(formName: string) {
    await this._ensureModalReady();

    const pausedAt = Date.now();
    this._isWaitingForInput = true;
    this._currentMessage = {
      type: "user_form",
      message: `Please fill out the ${formName} form and click Submit to continue.`,
      formName: formName,
      pausedAt: pausedAt,
    };

    logAction({
      level: "info",
      action: "Queue Showing User Form",
      details: `Queue showing user form: ${formName} at ${new Date(pausedAt).toISOString()}`,
    });

    // Return a promise that resolves when resume is called
    return new Promise<void>((resolve) => {
      this._messageResolve = resolve;
    });
  }

  // Show pause message and wait for user input
  async pause(message?: string) {
    await this._ensureModalReady();

    const pausedAt = Date.now();
    this._isWaitingForInput = true;
    this._currentMessage = {
      type: "pause",
      message: message || "Run is paused. Click Continue to resume.",
      pausedAt: pausedAt,
    };

    logAction({
      level: "info",
      action: "Queue Paused",
      details: `Queue paused with message: ${this._currentMessage.message} at ${new Date(pausedAt).toISOString()}`,
    });

    // Return a promise that resolves when resume is called
    return new Promise<void>((resolve) => {
      this._messageResolve = resolve;
    });
  }

  async executeCommand(command: StoredRunCommand) {
    await Tool.executeCommand(command.commandInfo);
    await this.commands.complete(command.queueId);
  }

  // Whether `step` is the snapshot a side lane is awaiting right now (identity comparison).
  private _isSideRunning(step: Readonly<RunningStep>): boolean {
    for (const running of this._sideRunning.values()) {
      if (running === step) return true;
    }
    return false;
  }

  // Whether `step` is still running on any lane (the identity gate of toolControl).
  private _isRunning(step: Readonly<RunningStep>): boolean {
    return this._runningStep === step || this._isSideRunning(step);
  }

  // The step the operator's Pause, Resume and Abort address. With the flag off it is the
  // primary step, exactly as before. In lane mode it is the running step, on any lane,
  // whose tool type has a runControl entry; the eligibility rule keeps that to at most one
  // (D-11). With none controllable it is the first running step, so a refusal keeps today's
  // text for a STACK step, and undefined keeps "No step is currently running".
  private _controlTarget(): Readonly<RunningStep> | undefined {
    if (!this._laneMode) return this._runningStep;
    const running: Readonly<RunningStep>[] = [];
    if (this._runningStep) running.push(this._runningStep);
    for (const step of this._sideRunning.values()) running.push(step);
    return running.find((step) => getRunControl(String(step.toolType)) !== undefined) ?? running[0];
  }

  // The running step on the named tool, from any lane. recoveryControl refuses a STACK
  // acknowledge while its tool runs a step; the key is the same normalisation it uses.
  runningStepFor(toolName: string): Readonly<RunningStep> | undefined {
    const key = toolKeyOf(toolName);
    // Read through the public accessor, so the primary slot has one reading path.
    const primary = this.runningStep;
    if (primary && toolKeyOf(primary.toolId) === key) return primary;
    for (const step of this._sideRunning.values()) {
      if (toolKeyOf(step.toolId) === key) return step;
    }
    return undefined;
  }

  // Sends an operator's Pause/Resume/Abort straight to the running step's
  // tool. Reached only through the commandQueue.toolControl tRPC mutation.
  // Deciding whether to send uses only the running-step snapshot and the
  // runControl capability map (D-04) — never a run-state read, a tool poll
  // result or a reply field. Touches nothing belonging to the queue's own
  // busy-loop or modal bookkeeping. The tool's reply is read only after
  // sending, and its only effect on queue bookkeeping is recording an
  // accepted abort (T-01-08's three-layer gate in _recordAcceptedAbort), so
  // that step and the rest of its run leave the queue instead of being
  // re-run by startNext.
  async toolControl(
    action: string,
    params: Record<string, unknown> = {},
  ): Promise<ToolControlResult> {
    const step = this._controlTarget();
    const verdict = validateControlRequest(step?.toolType, action, params);

    const paramsJson = (() => {
      try {
        return JSON.stringify(params);
      } catch {
        return String(params);
      }
    })();
    const baseDetails =
      `action=${action} toolId=${step?.toolId ?? "none"} toolType=${step?.toolType ?? "none"} ` +
      `queueId=${step?.queueId ?? "none"} runId=${step?.runId ?? "none"} decisions=${paramsJson}`;

    if (!verdict.ok) {
      await logAction({
        level: "warning",
        action: "Tool Control Refused",
        details: sanitizeLogText(
          `${baseDetails} outcome=refused: ${verdict.code} ${verdict.message}`,
        ),
      });
      throw new TRPCError({ code: verdict.code, message: verdict.message });
    }

    const tool = Tool.lookup(step!.toolId);
    if (!tool) {
      const message = `Tool "${step!.toolId}" of the running step is not connected.`;
      await logAction({
        level: "warning",
        action: "Tool Control Refused",
        details: sanitizeLogText(`${baseDetails} outcome=refused: PRECONDITION_FAILED ${message}`),
      });
      throw new TRPCError({ code: "PRECONDITION_FAILED", message });
    }

    if (!this._isRunning(step!)) {
      const message = "The targeted step is no longer running.";
      await logAction({
        level: "warning",
        action: "Tool Control Refused",
        details: sanitizeLogText(`${baseDetails} outcome=refused: PRECONDITION_FAILED ${message}`),
      });
      throw new TRPCError({ code: "PRECONDITION_FAILED", message });
    }

    let result: ToolControlResult;
    try {
      result = await tool.controlCommand(action, verdict.decisions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logAction({
        level: "warning",
        action: "Tool Control Failed",
        details: sanitizeLogText(`${baseDetails} outcome=transport error: ${errorMessage}`),
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Could not reach tool "${step!.toolId}": ${errorMessage}`,
        cause: error instanceof Error ? error : undefined,
      });
    }

    const details = sanitizeLogText(
      result.ok
        ? `${baseDetails} outcome=${result.response}`
        : `${baseDetails} outcome=${result.response} message=${result.message}`,
    );

    await logAction({
      level: result.ok ? "info" : "warning",
      action: "Tool Control",
      details,
    });

    if (action === "abort" && result.ok) {
      try {
        await this._recordAcceptedAbort(step!);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logAction({
          level: "warning",
          action: "Aborted Run Dequeue Failed",
          details: `${baseDetails} error=${errorMessage}`,
        });
        // The instrument accepted the abort, so the operator must never be
        // told it failed: fall through and return the tool's own result.
      }
    }

    return result;
  }

  // Records that the tool accepted an operator Abort of `step`, so the step
  // and the rest of its run leave the queue instead of being re-run by
  // startNext. T-01-08's three-layer gate, evaluated with no await between
  // layers (a) and (b):
  //   (a) `_runningStep === step`, the first statement with no await before
  //       it: the step is still running, so this just sets the marker the
  //       busy-loop catch will read when it ends.
  //   (b) `_failedAttempt === step`: the step already ended, and the aborted
  //       attempt's frozen snapshot is still the latest attempt whose own
  //       failure was recorded without an abort — no restart, goto or new
  //       attempt has happened since. Anything else (the reply is for an
  //       attempt that is no longer current) is logged and skipped.
  //   (c) SqliteQueue.dequeueFailedRun re-checks, in one transaction, that
  //       the row exists, run_id matches, status is FAILED and it is still
  //       queued. `false` means the row changed since the attempt ended
  //       (e.g. Skip or Clear), which is also logged and skipped.
  private async _recordAcceptedAbort(step: Readonly<RunningStep>): Promise<void> {
    if (this._runningStep === step) {
      this._abortAcceptedQueueId = step.queueId;
      return;
    }
    // A side-lane step keeps its marker per queueId, so another lane's dispatch never resets
    // it (D-11, Pitfall 12); the legacy single field stays the primary step's own slot.
    if (this._isSideRunning(step)) {
      this._sideAbortAccepted.add(step.queueId);
      return;
    }

    if (this._laneMode && this._sideFailedAttempts.get(step.queueId) === step) {
      this._sideFailedAttempts.delete(step.queueId);
    } else if (this._failedAttempt === step) {
      this._failedAttempt = undefined;
    } else {
      logAction({
        level: "warning",
        action: "Aborted Run Dequeue Skipped",
        details:
          `queueId=${step.queueId} runId=${step.runId} toolId=${step.toolId} ` +
          `reason=the aborted attempt is no longer the latest ended attempt ` +
          `(it completed, or the queue was restarted or re-queued since)`,
      });
      return;
    }

    const removed = await this.commands.dequeueFailedRun(step.queueId, step.runId);

    if (removed === false) {
      logAction({
        level: "warning",
        action: "Aborted Run Dequeue Skipped",
        details:
          `queueId=${step.queueId} runId=${step.runId} toolId=${step.toolId} ` +
          `reason=the step's queue row changed since the aborted attempt ended`,
      });
      return;
    }

    logAction({
      level: "info",
      action: "Aborted Run Dequeued",
      details:
        `queueId=${step.queueId} runId=${step.runId} toolId=${step.toolId} ` +
        `removed=${removed.length ? removed.join(",") : "none"} ` +
        `reason=operator abort accepted after the step ended`,
    });
  }

  async skipCommand(commandId: number) {
    await this.commands.skip(commandId);
  }

  async skipCommandsUntil(commandId: number) {
    await this.commands.skipUntil(commandId);
  }

  // Show info message and wait for user acknowledgment
  async showMessage(message: string, title?: string) {
    await this._ensureModalReady();

    const pausedAt = Date.now();
    this._isWaitingForInput = true;
    this._currentMessage = {
      type: "message",
      message: message || "Please review and click Continue to proceed.",
      title: title || "Message",
      pausedAt: pausedAt,
    };

    logAction({
      level: "info",
      action: "Queue Showing Message",
      details: `Queue showing message: ${this._currentMessage.message} at ${new Date(pausedAt).toISOString()}`,
    });

    // Return a promise that resolves when resume is called
    return new Promise<void>((resolve) => {
      this._messageResolve = resolve;
    });
  }

  async stopRunRequest(message: string) {
    await this._ensureModalReady();

    const pausedAt = Date.now();
    this._isWaitingForInput = true;
    this._currentMessage = {
      type: "stop_run",
      message: message || "Stopping run...",
      pausedAt: pausedAt,
    };

    logAction({
      level: "info",
      action: "Queue Stop Run Requested",
      details: `Queue stop run requested with message: ${this._currentMessage.message} at ${new Date(pausedAt).toISOString()}`,
    });

    // Return a promise that resolves when resume is called
    return new Promise<void>((resolve) => {
      this._messageResolve = resolve;
    });
  }

  async startTimer(minutes: number, seconds: number, message?: string) {
    await this._ensureModalReady();

    const pausedAt = Date.now();
    const durationMs = (minutes * 60 + seconds) * 1000;
    const endTime = pausedAt + durationMs;

    this._isWaitingForInput = true;
    this._currentMessage = {
      type: "timer",
      message: message || "Timer in progress...",
      pausedAt: pausedAt,
      timerDuration: durationMs,
      timerEndTime: endTime,
    };

    logAction({
      level: "info",
      action: "Queue Timer Started",
      details: `Queue timer started for ${minutes}m ${seconds}s with message: ${this._currentMessage.message}`,
    });

    // Return a promise that resolves when timer ends or when skipped
    return new Promise<void>((resolve) => {
      this._messageResolve = resolve;

      // Auto-resolve when timer ends
      this._timerTimeout = setTimeout(() => {
        if (this._isWaitingForInput && this._currentMessage.type === "timer") {
          this.resume(true);
        }
      }, durationMs);
    });
  }

  // A re-queue resets rows to CREATED, including a STARTED side-lane row, which would send
  // that step to its instrument again (D-23). Refused while any side-lane step runs.
  private _refuseGotoWhileLaneStepRuns(target: string): void {
    if (!this._laneMode || this._sideRunning.size === 0) return;
    const lanes = [...this._sideRunning.entries()]
      .map(([lane, step]) => `${lane}:${step.queueId}`)
      .join(",");
    logAction({
      level: "warning",
      action: "Queue Goto Refused",
      details: sanitizeLogText(`target=${target} runningSideLanes=${lanes}`),
    });
    throw new Error(
      "Go to is refused while a lane step is running: it would send that step again. Wait for the lane step to end.",
    );
  }

  async gotoCommand(commandId: number) {
    this._refuseGotoWhileLaneStepRuns(`commandId=${commandId}`);
    // An operator re-queue supersedes any pending stale abort reply (T-01-08), on every
    // lane: a failed side-lane attempt's token is cleared too (review WR-06).
    this._failedAttempt = undefined;
    this._sideFailedAttempts.clear();
    try {
      await this.commands.gotoCommand(commandId);

      logAction({
        level: "info",
        action: "Queue Goto",
        details: `Queue jumped to command ID: ${commandId}`,
      });

      return true;
    } catch (error) {
      logAction({
        level: "error",
        action: "Queue Goto Failed",
        details: `Failed to goto command ID: ${commandId}. Error: ${error}`,
      });
      throw error;
    }
  }

  // Add this method to CommandQueue class
  async gotoCommandByRunIndex(runId: string, index: number): Promise<boolean> {
    this._refuseGotoWhileLaneStepRuns(`runId=${runId} index=${index}`);
    // An operator re-queue supersedes any pending stale abort reply (T-01-08), on every
    // lane: a failed side-lane attempt's token is cleared too (review WR-06).
    this._failedAttempt = undefined;
    this._sideFailedAttempts.clear();
    try {
      await this.commands.gotoCommandByIndex(runId, index);

      logAction({
        level: "info",
        action: "Queue Goto By Index",
        details: `Queue jumped to index ${index} for run ${runId}`,
      });

      return true;
    } catch (error) {
      logAction({
        level: "error",
        action: "Queue Goto By Index Failed",
        details: `Failed to goto index ${index} for run ${runId}. Error: ${error}`,
      });
      throw error;
    }
  }

  // Resume execution after pause or message
  resume(_autoResume = false) {
    if (!this._isWaitingForInput) {
      return;
    }

    // Clear any active timer
    if (this._timerTimeout) {
      clearTimeout(this._timerTimeout);
      this._timerTimeout = undefined;
    }

    const messageType = this._currentMessage.type;
    const pausedAt = this._currentMessage.pausedAt || Date.now();
    const elapsedMs = Date.now() - pausedAt;
    const elapsedSec = Math.floor(elapsedMs / 1000);

    // Store the resolver before resetting state
    const resolver = this._messageResolve;

    // Reset state first to prevent race conditions
    this._isWaitingForInput = false;
    this._messageResolve = undefined;

    // Clear any previous errors when resuming
    if (this.error && !this._laneHalt) {
      console.log("Clearing error on resume");
      this.clearError();
    }

    logAction({
      level: "info",
      action: "Queue Resumed",
      details: `Queue execution resumed after ${elapsedSec} seconds of ${messageType}`,
    });

    // Now call the resolver after state is reset
    if (resolver) {
      // Slight delay to ensure UI updates
      setTimeout(() => resolver(), 50);
    }
  }

  // Standard command queue methods
  async allCommands(): Promise<StoredRunCommand[]> {
    return this.commands.all();
  }

  async getPaginated(offset: number = 0, limit: number = 20): Promise<StoredRunCommand[]> {
    return this.commands.getPaginated(offset, limit);
  }
  async getAllRuns(): Promise<RunQueue[]> {
    return this.commands.getAllRuns();
  }
  async getRun(runId: string) {
    return this.commands.getRun(runId);
  }
  async clearAll() {
    await this.commands.clearAll();
    await this.clearError();
  }
  async clearByRunId(runId: string) {
    await this.commands.clearByRunId(runId);
  }

  async getRunsTotal(): Promise<number> {
    return this.commands.getTotalRuns();
  }

  async clearCompleted() {
    await this.commands.clearCompleted();
  }

  async clearError() {
    console.log("Clearing error and resetting state from:", this._state);
    this.error = undefined;

    // Only reset to READY if we're currently in FAILED state
    if (this._state === ToolStatus.FAILED) {
      this._setState(ToolStatus.READY);
    }
  }

  slackNotificationsEnabled: boolean = true;

  // Synchronous on purpose (research Pitfall 1): no await may sit between the
  // single-flight guard and the _runningPromise claim in _start.
  private _describeQueueStart(source: QueueStartSource): string {
    try {
      return describeQueueStart(this.commands.queuedRowsSync(), source);
    } catch (e) {
      return describeQueueStartReadFailure(source, e);
    }
  }

  async _start(source: QueueStartSource = "operator") {
    if (this._laneMode) return this._startLanes(source);
    // Single-flight guard (QUE-07, D-01): the busy loop owns the queue while
    // _runningPromise is set. A second Start (restart router, direct call or the
    // enqueueRun auto-start) must never dispatch the in-flight row again. It only
    // logs and returns; it changes no state, no error and no _failedAttempt.
    if (this._runningPromise) {
      logAction({
        level: "warning",
        action: "Queue Start Ignored",
        details: `A queue start was ignored because the queue is already running; nothing was dispatched again. source=${source} inFlightQueueId=${this._runningStep?.queueId ?? "unknown"} inFlightRunId=${this._runningStep?.runId ?? "unknown"} state=${this._state}`,
      });
      return;
    }
    // A restart supersedes any pending stale abort reply (T-01-08).
    this._failedAttempt = undefined;
    logAction({
      level: "info",
      action: "Queue Started",
      details: this._describeQueueStart(source),
    });
    this._setState(ToolStatus.READY);
    this.error = undefined;
    try {
      // Retry interrupted-step recovery if construction's own attempt
      // failed; a throw here lands in this try's catch below, so the queue
      // fails closed (FAILED, nothing dispatched) instead of starting with
      // an unrecovered orphan still STARTED.
      if (!this._interruptedStepsRecovered) this._recoverInterruptedSteps();
      this._runningPromise = this._runBusyLoopWhileQueueNotEmpty(120);
      await this._runningPromise;
    } catch (e) {
      logAction({
        level: "error",
        action: "Queue failed to start",
        details: "Error while starting the queue.: " + e,
      });
      const failure = e instanceof Error ? e : new Error("Execution failed");
      this._recordFailure(failure);
      this._setState(ToolStatus.FAILED);
      // Not awaited (WR-01): the alert must not hold the busy-loop claim, or an
      // operator Start on the FAILED queue would be ignored while it sends.
      void this._notifyFailure({ error: failure });
    } finally {
      this._runningPromise = undefined;
      if (this.state === ToolStatus.BUSY) {
        this._setState(ToolStatus.READY);
      }
    }
  }

  // ---- Concurrency lanes (D-10). Everything below runs only when _laneMode is true. ----

  // Recomputes the umbrella promise stop() awaits: it covers every live lane loop.
  private _refreshRunningPromise(): void {
    const loops = [...this._laneLoops.values()];
    this._runningPromise = loops.length > 0 ? Promise.all(loops) : undefined;
  }

  // The same failure handling _start's catch applies when a loop cannot run at all.
  private _failStart(e: unknown, ctx?: LaneFailureContext): void {
    logAction({
      level: "error",
      action: "Queue failed to start",
      details: "Error while starting the queue.: " + e,
    });
    const failure = e instanceof Error ? e : new Error("Execution failed");
    this._recordFailure(failure, ctx);
    this._setState(ToolStatus.FAILED);
    // Not awaited (WR-01): the alert must not hold a loop slot.
    void this._notifyFailure({ error: failure });
  }

  // Runs one lane's loop under a supervisor that owns its _laneLoops entry. The entry
  // is registered before this returns, so a second Start in the same tick sees it
  // (LAN-04, P-3). The supervisor never rejects.
  private _launchLane(lane: string, body: () => Promise<void>): Promise<void> {
    let supervisor!: Promise<void>;
    supervisor = (async () => {
      try {
        await body();
      } catch (e) {
        if (this._laneMode) this._latchFailure({ lane });
        // No step is known here: queueId 0 stands for "no step".
        this._failStart(e, { lane, queueId: 0 });
      } finally {
        if (this._laneLoops.get(lane) === supervisor) this._laneLoops.delete(lane);
        this._refreshRunningPromise();
        if (this._laneLoops.size === 0 && this.state === ToolStatus.BUSY) {
          this._setState(ToolStatus.READY);
        }
      }
    })();
    this._laneLoops.set(lane, supervisor);
    this._refreshRunningPromise();
    return supervisor;
  }

  // Starts a side worker for every non-primary lane that has work in the active run and
  // no live loop. Returns the supervisors it launched.
  private _ensureLaneWorkers(): Promise<void>[] {
    if (this.state !== ToolStatus.BUSY) return [];
    const launched: Promise<void>[] = [];
    for (const lane of lanesWithWork(this.commands.queuedRowsSync())) {
      if (this._laneLoops.has(lane)) continue;
      launched.push(this._launchLane(lane, () => this._runSideLane(lane)));
    }
    return launched;
  }

  // Lane-mode Start. Synchronous until every loop is launched: no await may sit
  // between the per-lane guard and the _laneLoops registration (LAN-04).
  private async _startLanes(source: QueueStartSource): Promise<void> {
    try {
      // Only an operator Start re-arms a halted queue (D-13): the auto-start after an enqueue
      // launches nothing while the latch is set, and changes no state.
      if (source === "enqueue" && this._laneHalt) {
        logAction({
          level: "warning",
          action: "Queue Start Ignored",
          details: sanitizeLogText(
            `A queue start was ignored because the lanes are halted; nothing was dispatched. source=enqueue halted=true reason=${this._laneHalt.reason}`,
          ),
        });
        return;
      }
      const lanes = [PRIMARY_LANE, ...lanesWithWork(this.commands.queuedRowsSync())];
      const busyLanes = lanes.filter((lane) => this._laneLoops.has(lane));

      if (busyLanes.length === lanes.length) {
        // Every lane with work already has a live loop: the legacy text, nothing dispatched.
        const inFlight = this._runningStep ?? this._sideRunning.values().next().value;
        logAction({
          level: "warning",
          action: "Queue Start Ignored",
          details: `A queue start was ignored because the queue is already running; nothing was dispatched again. source=${source} inFlightQueueId=${inFlight?.queueId ?? "unknown"} inFlightRunId=${inFlight?.runId ?? "unknown"} state=${this._state}`,
        });
        return;
      }
      for (const lane of busyLanes) {
        logAction({
          level: "warning",
          action: "Lane Start Ignored",
          details: sanitizeLogText(`lane=${lane} reason=lane already running source=${source}`),
        });
      }

      // Same order as _start. A restart supersedes any pending stale abort reply (T-01-08).
      this._failedAttempt = undefined;
      this._sideFailedAttempts.clear();
      logAction({
        level: "info",
        action: "Queue Started",
        details: this._describeQueueStart(source),
      });
      this._setState(ToolStatus.READY);
      this.error = undefined;
      // An accepted operator Start is the only thing that clears the halt and the failure list.
      this._laneHalt = undefined;
      this._laneFailures = [];
      this._laneFailureOverflow = 0;
      this._bannerFailureLane = undefined;

      // Recovery fails any STARTED row as an orphan of a dead process, so it must never
      // run while a lane loop of this process is alive (Pitfall 17e).
      if (!this._interruptedStepsRecovered && this._laneLoops.size === 0) {
        this._recoverInterruptedSteps();
      }

      const launched: Promise<void>[] = [];
      if (!this._laneLoops.has(PRIMARY_LANE)) {
        launched.push(
          this._launchLane(PRIMARY_LANE, () => this._runBusyLoopWhileQueueNotEmpty(120)),
        );
      } else {
        this._setState(ToolStatus.BUSY);
      }
      // Every lane with work gets its loop in this same synchronous turn, so a second
      // Start in the same tick finds every lane covered and is ignored (LAN-04).
      launched.push(...this._ensureLaneWorkers());
      await Promise.all(launched);
    } catch (e) {
      this._failStart(e);
    }
  }

  // The operator's Freeze lanes control (D-15, LAN-09). It only closes dispatch: the same latch a
  // failure sets, with reason "freeze". Steps already running finish and are recorded normally;
  // nothing is aborted, paused or sent, and no instrument state is read. The state turns OFFLINE
  // (unless FAILED, whose banner must stay) with no error set, so the existing Start button
  // shows. Only an accepted operator Start clears it (D-13).
  freezeLanes(): { frozen: boolean } {
    if (!this._laneMode) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Parallel lanes are disabled on the server, so there are no lanes to freeze.",
      });
    }
    if (this._laneHalt) {
      logAction({
        level: "info",
        action: "Lanes Freeze Ignored",
        details: sanitizeLogText(
          `The freeze was ignored because the lanes are already halted. reason=${this._laneHalt.reason}`,
        ),
      });
      return { frozen: false };
    }
    this._laneHalt = { reason: "freeze", at: Date.now() };
    if (this._state !== ToolStatus.FAILED) this._setState(ToolStatus.OFFLINE);
    const running = this._runningLaneEntries().map((e) => `${e.lane}:${e.queueId}`);
    logAction({
      level: "info",
      action: "Lanes Frozen",
      details: sanitizeLogText(
        `Lanes frozen by the operator; steps already running finish and nothing was aborted. running=${running.length ? running.join(",") : "none"}`,
      ),
    });
    return { frozen: true };
  }

  // The lane status read model for the run page (D-24, D-16). Messages only, never a stack.
  laneStatus(): LaneStatusSnapshot {
    let hasLaneRows = false;
    try {
      const rows = this.commands.queuedRowsSync();
      if (rows.length > 0) {
        const active = rows[0].runId;
        hasLaneRows = rows.some(
          (r) => r.runId === active && laneOf(r.commandInfo) !== PRIMARY_LANE,
        );
      }
    } catch {
      hasLaneRows = false;
    }
    if (!this._laneMode) {
      return {
        laneMode: false,
        hasLaneRows,
        halted: false,
        haltReason: null,
        queueBusy: false,
        runningLanes: [],
        failures: [],
        overflow: 0,
      };
    }
    return {
      laneMode: true,
      hasLaneRows,
      halted: this._laneHalt !== undefined || this._isWaitingForInput,
      haltReason: this._laneHalt?.reason ?? (this._isWaitingForInput ? "modal" : null),
      queueBusy: this._state === ToolStatus.BUSY,
      runningLanes: this._runningLaneEntries(),
      failures: this._laneFailures.map((f) => ({ ...f })),
      overflow: this._laneFailureOverflow,
    };
  }

  // The primary lane's running step plus every side lane's, as plain entries.
  private _runningLaneEntries(): RunningLaneEntry[] {
    const entries: RunningLaneEntry[] = [];
    const add = (lane: string, step: Readonly<RunningStep>) =>
      entries.push({
        lane,
        queueId: step.queueId,
        toolId: step.toolId,
        toolType: String(step.toolType),
        command: step.command,
      });
    if (this._runningStep) add(PRIMARY_LANE, this._runningStep);
    for (const [lane, step] of this._sideRunning) add(lane, step);
    return entries;
  }

  // The single place the dispatch gate and the claim meet. With lanes off it is the
  // legacy call, byte for byte. In lane mode there is no await between reading the
  // rows and claiming the chosen one, so the check and the claim are one atomic step.
  private async _pickNext(lane: string): Promise<StoredRunCommand | false | typeof WAIT> {
    if (!this._laneMode) return this.commands.startNext();
    // A failure, stop or freeze leaves BUSY: nothing new is dispatched on any lane.
    if (this.state !== ToolStatus.BUSY) return WAIT;
    const rows = this.commands.queuedRowsSync();
    const verdict = pickEligible(rows, lane, this._dispatchGate());
    for (const r of rows) {
      if (laneOf(r.commandInfo) !== PRIMARY_LANE) this._laneRunIds.add(r.runId);
    }
    if (verdict.kind === "empty") {
      this._laneRunIds.clear();
      return false;
    }
    if (verdict.kind === "drained") return lane === PRIMARY_LANE ? WAIT : false;
    if (verdict.kind === "wait") return WAIT;
    const claimed = this.commands.claimEligible(verdict.row.queueId);
    if (claimed === false) return WAIT;
    if (this._laneRunIds.has(claimed.runId)) {
      logAction({
        level: "info",
        action: "Lane Step Dispatched",
        details: sanitizeLogText(
          `queueId=${claimed.queueId} runId=${claimed.runId} toolId=${claimed.commandInfo?.toolId} lane=${laneOf(claimed.commandInfo)}`,
        ),
      });
    }
    return claimed;
  }

  // The context pickEligible needs. `halted` is the failure/freeze latch and `modalOpen` the
  // primary-lane modal flag, both read synchronously here (D-12, D-14); a STARTED Tool Box row
  // is handled by pickEligible itself. Nothing here reads run_state (D-15). The busy-tool set
  // comes from memory, not from the stored rows, so a tool server whose running step was
  // dequeued by an accepted abort stays busy.
  private _dispatchGate(): LaneGate {
    const running: Readonly<RunningStep>[] = [];
    if (this._runningStep) running.push(this._runningStep);
    for (const step of this._sideRunning.values()) running.push(step);
    return {
      halted: this._laneHalt !== undefined,
      modalOpen: this._isWaitingForInput,
      busyToolKeys: new Set(running.map((step) => toolKeyOf(step.toolId))),
      controllableToolTypes: Object.keys(runControl),
      controllableRunning: running.some((step) => getRunControl(step.toolType) !== undefined),
    };
  }

  // The worker for one non-primary lane: tagged tool steps only. It never runs a Tool
  // Box step (laneOf maps those to the primary lane), never touches modal state and
  // never stops the queue; only the primary loop does that, and only when it is empty.
  private async _runSideLane(lane: string): Promise<void> {
    while (this.state === ToolStatus.BUSY) {
      await new Promise((resolve) => setTimeout(resolve, this._loopDelayMs));
      if (this.state !== ToolStatus.BUSY) return;
      const picked = await this._pickNext(lane);
      if (picked === false) {
        // Exit decision and map removal in one synchronous turn (P-3).
        this._laneLoops.delete(lane);
        return;
      }
      if (picked === WAIT) continue;
      if (await this._shouldSkip(picked, lane)) continue;

      const attempt: Readonly<RunningStep> = Object.freeze({
        queueId: picked.queueId,
        runId: picked.runId,
        toolId: picked.commandInfo.toolId,
        toolType: picked.commandInfo.toolType,
        command: picked.commandInfo.command,
        startedAt: Date.now(),
      });
      // A fresh marker for this attempt only; another row's marker is never touched.
      this._sideAbortAccepted.delete(picked.queueId);
      this._sideFailedAttempts.delete(picked.queueId);
      try {
        try {
          // Inside the try (review WR-02): anything that throws after the claim fails this
          // row through the catch below, so a claimed row is never left STARTED with no owner.
          this._sideRunning.set(lane, attempt);
          // Only a controllable step is polled; the eligibility rule keeps that to one step
          // at a time, so the single monitor never has two owners (D-11).
          if (getRunControl(String(attempt.toolType)) !== undefined) {
            this._runStateMonitor.start(attempt);
          }
          await this.executeCommand(picked);
        } finally {
          this._runStateMonitor.stopIf(attempt.queueId);
          this._sideRunning.delete(lane);
        }
        logAction({
          level: "info",
          action: "Lane Step Ended",
          details: sanitizeLogText(`queueId=${picked.queueId} lane=${lane} outcome=completed`),
        });
      } catch (e) {
        if (this._laneMode) this._latchFailure({ queueId: picked.queueId, lane });
        logger.error("Failed to execute lane command", e);
        const abortAccepted = this._sideAbortAccepted.delete(picked.queueId);
        // Synchronously, before the first await (T-01-08, layer b), like the primary catch.
        if (!abortAccepted) this._sideFailedAttempts.set(picked.queueId, attempt);

        const err = e instanceof Error ? e : new Error("Unknown error");
        let rowRemoved = false;
        if (abortAccepted) {
          const removed = await this.commands.failAndDequeueRun(picked.queueId, err);
          if (removed === false) {
            rowRemoved = true;
          } else {
            logAction({
              level: "info",
              action: "Aborted Run Dequeued",
              details: sanitizeLogText(
                `queueId=${picked.queueId} runId=${picked.runId} lane=${lane} ` +
                  `toolId=${picked.commandInfo?.toolId} ` +
                  `removed=${removed.length ? removed.join(",") : "none"} ` +
                  `reason=operator abort accepted while the step ran`,
              ),
            });
          }
        } else {
          const updated = await this.commands.fail(picked.queueId, err);
          if (!updated) rowRemoved = true;
        }

        if (rowRemoved) {
          logAction({
            level: "warning",
            action: "Step Removed While Running",
            details: sanitizeLogText(
              `queueId=${picked.queueId} runId=${picked.runId} lane=${lane} ` +
                `toolId=${picked.commandInfo?.toolId} abortAccepted=${abortAccepted} ` +
                `stepError=${err.message} ` +
                `reason=the step's queue row was removed by the operator (Clear All or run delete) ` +
                `while it ran; nothing was recorded and no queue error was set`,
            ),
          });
          this._setState(ToolStatus.OFFLINE);
          return;
        }

        const failure = e instanceof Error ? e : new Error("Execution failed");
        this._recordFailure(failure, {
          lane,
          queueId: picked.queueId,
          toolId: picked.commandInfo?.toolId,
          toolType: picked.commandInfo?.toolType,
        });
        this._setState(ToolStatus.FAILED);

        logAction({
          level: "error",
          action: "Command Failed",
          details: sanitizeLogText(
            `Command failed: ${e instanceof Error ? e.message : e} lane=${lane} queueId=${picked.queueId}` +
              (abortAccepted
                ? " (operator abort accepted by the tool; this step and the rest of its run were removed from the queue and will not run on the next queue start)"
                : ""),
          ),
        });

        // Not awaited (WR-01): the alert must not keep this loop's slot alive.
        void this._notifyFailure({
          error: failure,
          runId: picked.runId,
          toolId: picked.commandInfo?.toolId,
          toolType: picked.commandInfo?.toolType,
          command: picked.commandInfo?.command,
          label: picked.commandInfo?.label,
        });
        return;
      }
    }
  }

  // The lane-local skip check (D-14): the same variable comparison as the primary
  // loop's skip block, which is deliberately not refactored.
  private async _shouldSkip(row: StoredRunCommand, lane: string): Promise<boolean> {
    const skip = row.commandInfo.advancedParameters?.skipExecutionVariable;
    if (!skip?.variable) return false;
    try {
      let expectedValue = skip.value;
      if (expectedValue.startsWith("{{") && expectedValue.endsWith("}}")) {
        const v = await this._getVariableByName(expectedValue.slice(2, -2).trim());
        expectedValue = v?.value ?? "";
      } else if (expectedValue.startsWith("${") && expectedValue.endsWith("}")) {
        const v = await this._getVariableByName(expectedValue.slice(2, -1).trim());
        expectedValue = v?.value ?? "";
      }
      const varResponse = await this._getVariableByName(skip.variable);
      if (varResponse && varResponse.value === expectedValue) {
        logAction({
          level: "info",
          action: "Command Skipped",
          details: sanitizeLogText(
            `Skipping command: ${row.commandInfo.command} for tool: ${row.commandInfo.toolId} because variable ${skip.variable} = ${expectedValue} lane=${lane}`,
          ),
        });
        await this.skipCommand(row.queueId);
        return true;
      }
    } catch (e) {
      logAction({
        level: "warning",
        action: "Skip Execution Variable Error",
        details: sanitizeLogText(
          `Failed to fetch skip execution variable ${skip.variable}: ${e} lane=${lane}`,
        ),
      });
    }
    return false;
  }

  // Modify the stop method in CommandQueue.ts to reset _isWaitingForInput
  async stop() {
    this._setState(ToolStatus.OFFLINE);

    if (this._runningPromise) {
      await this._runningPromise;
    }

    // Clear any active timer
    if (this._timerTimeout) {
      clearTimeout(this._timerTimeout);
      this._timerTimeout = undefined;
    }

    // Reset the waiting flag
    this._isWaitingForInput = false;
    this._currentMessage = {
      type: "pause",
      message: "Run is paused. Click Continue to resume.",
      pausedAt: undefined,
    };

    // Clear any pending resolve function
    if (this._messageResolve) {
      this._messageResolve();
      this._messageResolve = undefined;
    }
    logger.info("Command Queue stopped!");
    logAction({ level: "info", action: "Queue stopped", details: "Queue stopped." });

    this._setState(ToolStatus.OFFLINE);
  }

  private async _runBusyLoopWhileQueueNotEmpty(_timeout = 120) {
    this._setState(ToolStatus.BUSY);

    while (this.state === ToolStatus.BUSY) {
      // Small delay between processing commands to avoid race conditions
      await new Promise((resolve) => setTimeout(resolve, this._loopDelayMs));
      // Reconcile side workers before the claim (review WR-02): a throw here leaves no row
      // claimed, instead of stranding a STARTED row between the claim and the try below.
      if (this._laneMode) this._ensureLaneWorkers();
      const nextCommand = await this._pickNext(PRIMARY_LANE);
      if (nextCommand === WAIT) continue;
      if (!nextCommand) {
        this.stop(); // stop the queue when there are no more commands available!!
        return;
      }
      // Fresh marker per command: a stale value from a prior step must never
      // match a queueId that gotoCommand re-queued.
      this._abortAcceptedQueueId = undefined;
      // Cleared next to the marker above: a new attempt invalidates any
      // previous attempt's late-reply token (T-01-08, layer b).
      this._failedAttempt = undefined;
      // Holds this iteration's frozen running-step snapshot, so the catch
      // below can set it as the per-attempt late-reply token even though
      // _runningStep itself is cleared in the dispatch try's finally.
      let attempt: Readonly<RunningStep> | undefined;

      try {
        logger.info("Executing command:", nextCommand.commandInfo);

        // Handle advanced parameters for skip execution
        if (nextCommand.commandInfo.advancedParameters?.skipExecutionVariable?.variable) {
          try {
            // Get the variable name and expected value for skipping
            const varName =
              nextCommand.commandInfo.advancedParameters.skipExecutionVariable.variable;
            let expectedValue =
              nextCommand.commandInfo.advancedParameters.skipExecutionVariable.value;
            // Support both {{varName}} and ${varName} syntax for variable references
            if (expectedValue.startsWith("{{") && expectedValue.endsWith("}}")) {
              const v = await this._getVariableByName(expectedValue.slice(2, -2).trim());
              expectedValue = v?.value ?? "";
            } else if (expectedValue.startsWith("${") && expectedValue.endsWith("}")) {
              const v = await this._getVariableByName(expectedValue.slice(2, -1).trim());
              expectedValue = v?.value ?? "";
            }

            // Fetch the variable from the database
            const varResponse = await this._getVariableByName(varName);
            // If variable value matches expected value, skip this command
            if (varResponse && varResponse.value === expectedValue) {
              logAction({
                level: "info",
                action: "Command Skipped",
                details: `Skipping command: ${nextCommand.commandInfo.command} for tool: ${nextCommand.commandInfo.toolId} because variable ${varName} = ${expectedValue}`,
              });

              await this.skipCommand(nextCommand.queueId);
              continue;
            }
          } catch (e) {
            logAction({
              level: "warning",
              action: "Skip Execution Variable Error",
              details: `Failed to fetch skip execution variable ${nextCommand.commandInfo.advancedParameters.skipExecutionVariable.variable}: ${e}`,
            });
            // Continue with command execution if we can't check the skip condition
          }
        }

        // Unused timestamp formatting logic - commented out
        // const dateString = String(nextCommand.createdAt);
        // const dateObject = new Date(dateString);
        // const year = dateObject.getFullYear();
        // const month = dateObject.getMonth() + 1;
        // const day = dateObject.getDate();
        // const hours = dateObject.getHours();
        // const minutes = dateObject.getMinutes();
        // const seconds = dateObject.getSeconds();

        // const amOrPm = hours >= 12 ? "PM" : "AM";
        // const formattedHours = (hours % 12 || 12).toString();

        // const _formattedDateTime = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        //   2,
        //   "0",
        // )} ${formattedHours.padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
        //   seconds,
        // ).padStart(2, "0")} ${amOrPm}`;

        if (nextCommand.commandInfo.toolId === "Tool Box") {
          if (nextCommand.commandInfo.command === "pause") {
            const message =
              nextCommand.commandInfo.params?.message || "Run is paused. Click Continue to resume.";
            await this.commands.complete(nextCommand.queueId);
            await this.pause(message);
            continue;
          } else if (nextCommand.commandInfo.command === "user_form") {
            // Handle user_form command
            const formName = nextCommand.commandInfo.params?.name;
            if (!formName) {
              throw new Error("Form name is required for user_form command");
            }

            await this.commands.complete(nextCommand.queueId);
            await this.showUserForm(formName);
            continue;
          } else if (nextCommand.commandInfo.command === "show_message") {
            // Handle show_message command
            let message =
              nextCommand.commandInfo.params?.message ||
              "Please review and click Continue to proceed.";
            const title = nextCommand.commandInfo.params?.title || "Message";

            // Check if entire message is a variable reference (legacy {{}} syntax)
            if (message.startsWith("{{") && message.endsWith("}}")) {
              try {
                const variableResponse = await this._getVariableByName(message.slice(2, -2).trim());
                message = variableResponse?.value ?? message;
              } catch (e) {
                logAction({
                  level: "warning",
                  action: "Variable Reference Error",
                  details: `Failed to fetch variable for message: ${message}. Using raw message instead.`,
                });
              }
            } else {
              // Handle inline variable substitution with ${varName} syntax
              const variablePattern = /\${([^{}]+)}/g;
              let match;
              const replacements: { fullMatch: string; varName: string; value: string }[] = [];

              // Find all variable references
              while ((match = variablePattern.exec(message)) !== null) {
                const fullMatch = match[0];
                const varName = match[1].trim();
                try {
                  const varResponse = await this._getVariableByName(varName);
                  replacements.push({
                    fullMatch,
                    varName,
                    value: varResponse?.value ?? fullMatch,
                  });
                } catch (e) {
                  logAction({
                    level: "warning",
                    action: "Variable Reference Error",
                    details: `Failed to resolve variable ${varName} in message.`,
                  });
                  replacements.push({ fullMatch, varName, value: fullMatch });
                }
              }

              // Apply replacements
              for (const { fullMatch, value } of replacements) {
                message = message.replace(fullMatch, value);
              }
            }

            await this.commands.complete(nextCommand.queueId);
            await this.showMessage(message, title);
            continue;
          } else if (nextCommand.commandInfo.command === "timer") {
            // Handle timer command
            let minutesValue = nextCommand.commandInfo.params?.minutes || 0;
            let secondsValue = nextCommand.commandInfo.params?.seconds || 30;
            let message = nextCommand.commandInfo.params?.message || "Timer in progress...";

            // Resolve variable references for minutes (supports both {{}} and ${} syntax)
            if (typeof minutesValue === "string") {
              if (minutesValue.startsWith("{{") && minutesValue.endsWith("}}")) {
                try {
                  const varResponse = await this._getVariableByName(
                    minutesValue.slice(2, -2).trim(),
                  );
                  minutesValue = varResponse?.value ?? minutesValue;
                } catch (e) {
                  logAction({
                    level: "warning",
                    action: "Variable Reference Error",
                    details: `Failed to resolve variable for timer minutes: ${minutesValue}`,
                  });
                }
              } else if (minutesValue.startsWith("${") && minutesValue.endsWith("}")) {
                try {
                  const varResponse = await this._getVariableByName(
                    minutesValue.slice(2, -1).trim(),
                  );
                  minutesValue = varResponse?.value ?? minutesValue;
                } catch (e) {
                  logAction({
                    level: "warning",
                    action: "Variable Reference Error",
                    details: `Failed to resolve variable for timer minutes: ${minutesValue}`,
                  });
                }
              }
            }

            // Resolve variable references for seconds (supports both {{}} and ${} syntax)
            if (typeof secondsValue === "string") {
              if (secondsValue.startsWith("{{") && secondsValue.endsWith("}}")) {
                try {
                  const varResponse = await this._getVariableByName(
                    secondsValue.slice(2, -2).trim(),
                  );
                  secondsValue = varResponse?.value ?? secondsValue;
                } catch (e) {
                  logAction({
                    level: "warning",
                    action: "Variable Reference Error",
                    details: `Failed to resolve variable for timer seconds: ${secondsValue}`,
                  });
                }
              } else if (secondsValue.startsWith("${") && secondsValue.endsWith("}")) {
                try {
                  const varResponse = await this._getVariableByName(
                    secondsValue.slice(2, -1).trim(),
                  );
                  secondsValue = varResponse?.value ?? secondsValue;
                } catch (e) {
                  logAction({
                    level: "warning",
                    action: "Variable Reference Error",
                    details: `Failed to resolve variable for timer seconds: ${secondsValue}`,
                  });
                }
              }
            }

            // Resolve variable references for message (supports both {{}} and ${} syntax)
            if (typeof message === "string") {
              if (message.startsWith("{{") && message.endsWith("}}")) {
                try {
                  const varResponse = await this._getVariableByName(message.slice(2, -2).trim());
                  message = varResponse?.value ?? message;
                } catch (e) {
                  logAction({
                    level: "warning",
                    action: "Variable Reference Error",
                    details: `Failed to resolve variable for timer message: ${message}`,
                  });
                }
              } else if (message.startsWith("${") && message.endsWith("}")) {
                try {
                  const varResponse = await this._getVariableByName(message.slice(2, -1).trim());
                  message = varResponse?.value ?? message;
                } catch (e) {
                  logAction({
                    level: "warning",
                    action: "Variable Reference Error",
                    details: `Failed to resolve variable for timer message: ${message}`,
                  });
                }
              }
            }

            const minutes = Number(minutesValue);
            const seconds = Number(secondsValue);
            await this.commands.complete(nextCommand.queueId);
            await this.startTimer(minutes, seconds, message);
            continue;
          } else if (nextCommand.commandInfo.command === "note") {
            await this.commands.complete(nextCommand.queueId); //This marks the command as complete
            continue;
          } else if (nextCommand.commandInfo.command === "stop_run") {
            const message = nextCommand.commandInfo.params?.message || "Stopping run...";
            logAction({
              level: "info",
              action: "Run Stop Requested",
              details: `Queue stop requested by command: ${message}`,
            });

            // Show stop run modal and wait for user response
            await this.stopRunRequest(message);
            await this.commands.complete(nextCommand.queueId);
            // Continue to next command - if user clicks "Stop Run",
            // the queue will be stopped via stopQueueMutation from the UI
            continue;
          } else if (nextCommand.commandInfo.command === "goto") {
            const rawTargetIndex = nextCommand.commandInfo.params?.targetIndex;
            const targetIndex = Number(rawTargetIndex);
            const runId = nextCommand.commandInfo.params?.runId || nextCommand.runId;

            await this.commands.complete(nextCommand.queueId);
            if (rawTargetIndex !== undefined && Number.isInteger(targetIndex) && runId) {
              await this.gotoCommandByRunIndex(runId, targetIndex);
            } else {
              throw new Error(
                "Goto command requires either targetId or both targetIndex and runId",
              );
            }
            continue;
          } else if (nextCommand.commandInfo.command === "variable_assignment") {
            let variableName = nextCommand.commandInfo.params?.name;
            const expressionValue = nextCommand.commandInfo.params?.value;

            //Check if the variable exists
            if (!variableName) {
              throw new Error("Variable name is required for assignment");
            }

            if (variableName.startsWith("{{") && variableName.endsWith("}}")) {
              variableName = variableName.slice(2, -2).trim();
            }
            try {
              // First, fetch the target variable to get its type
              const targetVariable = await this._getVariableByName(variableName);

              if (!targetVariable) {
                throw new Error(`Target variable ${variableName} not found`);
              }

              // Evaluate the expression with variable substitution
              const evaluatedValue = await this.evaluateExpression(expressionValue);

              // Convert result to match the target variable type if needed
              let finalValue = evaluatedValue;

              if (targetVariable.type === "number" && typeof evaluatedValue !== "number") {
                // Try to convert to number if target is number type
                const numValue = Number(evaluatedValue);
                if (!isNaN(numValue)) {
                  finalValue = numValue;
                }
              } else if (targetVariable.type === "boolean" && typeof evaluatedValue !== "boolean") {
                // For boolean targets, convert truthy/falsy values properly
                finalValue = Boolean(evaluatedValue);
              } else if (targetVariable.type === "string" && typeof evaluatedValue !== "string") {
                // Convert to string for string targets
                finalValue = String(evaluatedValue);
              }

              // Update the variable in the database
              await db
                .update(variables)
                .set({ value: String(finalValue), updatedAt: new Date() })
                .where(eq(variables.id, targetVariable.id));

              logAction({
                level: "info",
                action: "Variable Assignment",
                details: `Variable ${variableName} assigned expression "${expressionValue}" resulting in value ${finalValue}`,
              });

              await this.commands.complete(nextCommand.queueId);
              continue;
            } catch (e) {
              logAction({
                level: "error",
                action: "Variable Assignment Error",
                details: `Failed to assign expression "${expressionValue}" to variable ${variableName}: ${e}`,
              });
              throw new Error(`Failed to assign variable: ${e}`);
            }
          }
        }

        // Regular command, send to Tool
        attempt = Object.freeze({
          queueId: nextCommand.queueId,
          runId: nextCommand.runId,
          toolId: nextCommand.commandInfo.toolId,
          toolType: nextCommand.commandInfo.toolType,
          command: nextCommand.commandInfo.command,
          startedAt: Date.now(),
        });
        this._runningStep = attempt;
        // Lane mode starts the poller only for a controllable step and ends it by queueId, so
        // a STACK step never stops the F.A.S.T. poller of another lane (D-11, Pitfall 13).
        // With the flag off the literal start and stop are unchanged.
        if (this._laneMode) {
          if (getRunControl(String(attempt.toolType)) !== undefined) {
            this._runStateMonitor.start(attempt);
          }
        } else {
          this._runStateMonitor.start(this._runningStep);
        }
        try {
          await this.executeCommand(nextCommand);
        } finally {
          if (this._laneMode) {
            this._runStateMonitor.stopIf(attempt.queueId);
          } else {
            this._runStateMonitor.stop();
          }
          this._runningStep = undefined;
        }

        logAction({
          level: "info",
          action: "Command Executed",
          details: "Command executed successfully.",
        });
        logger.info("Command executed successfully");
      } catch (e) {
        if (this._laneMode) {
          this._latchFailure({ queueId: nextCommand.queueId, lane: PRIMARY_LANE });
        }
        logger.error("Failed to execute command", e);

        // An accepted operator abort for this exact step must leave the
        // queue together with the rest of its run (Phase 2 D-18); any other
        // failure keeps upstream retry.
        const abortAccepted = this._abortAcceptedQueueId === nextCommand.queueId;
        this._abortAcceptedQueueId = undefined;
        // Synchronously, before the first await: a late abort reply can
        // land during the fail call's await below, so the per-attempt
        // late-reply token (T-01-08, layer b) must already be in place.
        this._failedAttempt = abortAccepted ? undefined : attempt;

        const err = e instanceof Error ? e : new Error("Unknown error");

        let rowRemoved = false;

        if (abortAccepted) {
          const removed = await this.commands.failAndDequeueRun(nextCommand.queueId, err);
          if (removed === false) {
            rowRemoved = true;
          } else {
            logAction({
              level: "info",
              action: "Aborted Run Dequeued",
              details:
                `queueId=${nextCommand.queueId} runId=${nextCommand.runId} ` +
                `toolId=${nextCommand.commandInfo?.toolId} ` +
                `removed=${removed.length ? removed.join(",") : "none"} ` +
                `reason=operator abort accepted while the step ran`,
            });
          }
        } else {
          // Mark command as failed in the queue
          const updated = await this.commands.fail(nextCommand.queueId, err);
          if (!updated) {
            rowRemoved = true;
          }
        }

        // The operator removed this step's row (Clear All or a run delete)
        // while it ran. That removal is the handling: Clear All already
        // clears the queue error, and OFFLINE (not READY) means enqueueRun
        // cannot auto-dispatch what is left, same as the sibling
        // Pause-queue/stop flow (D-18). No queue error is set and nothing
        // else runs until the operator presses Run again.
        if (rowRemoved) {
          logAction({
            level: "warning",
            action: "Step Removed While Running",
            details:
              `queueId=${nextCommand.queueId} runId=${nextCommand.runId} ` +
              `toolId=${nextCommand.commandInfo?.toolId} abortAccepted=${abortAccepted} ` +
              `stepError=${err.message} ` +
              `reason=the step's queue row was removed by the operator (Clear All or run delete) ` +
              `while it ran; nothing was recorded and no queue error was set`,
          });
          this._setState(ToolStatus.OFFLINE);
          break;
        }

        // Set error state for UI to display
        const failure = e instanceof Error ? e : new Error("Execution failed");
        this._recordFailure(
          failure,
          this._laneMode
            ? {
                lane: PRIMARY_LANE,
                queueId: nextCommand.queueId,
                toolId: nextCommand.commandInfo?.toolId,
                toolType: nextCommand.commandInfo?.toolType,
              }
            : undefined,
        );
        this._setState(ToolStatus.FAILED);

        logAction({
          level: "error",
          action: "Command Failed",
          details:
            `Command failed: ${e instanceof Error ? e.message : e}` +
            (abortAccepted
              ? " (operator abort accepted by the tool; this step and the rest of its run were removed from the queue and will not run on the next queue start)"
              : ""),
        });

        // Not awaited (WR-01): the Slack/email alert must not keep the loop (and
        // so the single-flight claim) alive after the queue is already FAILED.
        // _notifyFailure catches its own errors.
        void this._notifyFailure({
          error: failure,
          runId: nextCommand.runId,
          toolId: nextCommand.commandInfo?.toolId,
          toolType: nextCommand.commandInfo?.toolType,
          command: nextCommand.commandInfo?.command,
          label: nextCommand.commandInfo?.label,
        });

        // Exit the busy loop but keep the error state
        break;
      }
    }

    // Only set to READY if we're not in FAILED state
    if (this.state === ToolStatus.BUSY) {
      this._setState(ToolStatus.READY);
    }
  }

  async enqueueRun(run: Run) {
    // Defence in depth behind run creation (D-14, D-17): an invalid lane setup is refused
    // before any row is pushed, so a half-queued run can never hang the queue.
    if (this._laneMode) {
      const errors = validateLanes(run.commands.map((c) => c.commandInfo));
      if (errors.length > 0) {
        await logAction({
          level: "warning",
          action: "Lane Setup Refused",
          details: sanitizeLogText(`runId=${run.id} stage=enqueue reason=${errors.join(" ")}`),
        });
        throw new LaneValidationError(errors);
      }
    }
    try {
      const runQueue: RunQueue = {
        id: run.id,
        run_type: run.protocolName || run.protocolId,
        commands_count: run.commands.length,
        status: "CREATED",
      };
      await this.commands.runPush(run.id, runQueue);
    } catch (e) {
      console.warn("Error to push run" + e);
    }
    //Queue all commands in the run.
    for (const c of run.commands) {
      await this.commands.push(c);
    }
    if (this.state === ToolStatus.READY) {
      this._start("enqueue");
    }
  }

  static get global(): CommandQueue {
    const global_key = "__global_command_queue_key";
    const me = global as any;
    if (!me[global_key]) {
      me[global_key] = new CommandQueue(RunStore.global);
    }
    return me[global_key];
  }
}

export default CommandQueue;
