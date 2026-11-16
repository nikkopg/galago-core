// Pure, React-free start-summary counts and copy lines for the Run
// confirmation modal (QUE-08, D-05/D-06: no React import, no .tsx import,
// no timers). Fed by the rows of the queue-joined `commandQueue.commands`
// query so a dequeued FAILED row is never promised as a retry. This module
// only counts and words; it never sends a command and holds no state.
//
// Lane rows (D-20) add per-lane step lines to the same line list. Untagged
// queues produce no lane lines, so their output is unchanged.
//
// All copy is assembled here so the JSX does no string math (UI-SPEC S1).

import { PRIMARY_LANE, commandWords, isBarrier, laneOf } from "@/server/laneScheduling";
import type { LaneCommandInfo } from "@/server/laneScheduling";

export interface QueuedStartRow {
  status: string;
  runId: string;
  queueId?: number;
  commandInfo?: {
    toolId?: string;
    command?: string;
    toolType?: unknown;
    advancedParameters?: unknown;
  };
}

export interface QueuedStartSummary {
  willRun: number;
  failed: number;
  started: number;
  runs: number;
  isEmpty: boolean;
}

export interface QueuedStartLine {
  text: string;
  tone: "body" | "caption";
}

export const QUEUED_START_EMPTY = "The queue is empty.";
export const QUEUED_START_LOADING = "Checking the queue...";
export const QUEUED_START_ERROR = "Could not read the queue. Logs list the steps this Start ran.";
export const QUEUED_START_LANES_HEADING =
  "Steps by lane (lane order is the order they first appear):";
export const QUEUED_START_FREEZE_NOTE =
  "Starting clears a lane freeze. Lanes then start again together.";
export const QUEUED_START_NOTE =
  "Counts refresh every second. Logs list the exact steps this Start ran.";

// willRun counts CREATED and FAILED rows (what a Start will pick up). STARTED
// rows are in flight and tracked on their own: a Start is ignored while a
// step runs, so they are never part of "will run". Any other status
// (COMPLETED, SKIPPED, unknown) is ignored defensively.
export function summarizeQueuedStart(rows: ReadonlyArray<QueuedStartRow>): QueuedStartSummary {
  let willRun = 0;
  let failed = 0;
  let started = 0;
  const runIds = new Set<string>();
  for (const row of rows) {
    if (row.status === "CREATED" || row.status === "FAILED") {
      willRun += 1;
      runIds.add(row.runId);
      if (row.status === "FAILED") {
        failed += 1;
      }
    } else if (row.status === "STARTED") {
      started += 1;
    }
  }
  return { willRun, failed, started, runs: runIds.size, isEmpty: willRun + started === 0 };
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

// Per-lane lines for the rows a Start will pick up (CREATED, FAILED), or [] when
// none of them is on a non-primary lane. The position is the row's 1-based
// index among the input rows of its own run; lanes and steps keep queue order.
function laneLines(rows: ReadonlyArray<QueuedStartRow>): QueuedStartLine[] {
  const seenPerRun = new Map<string, number>();
  const queued: Array<{ lane: string; text: string }> = [];
  for (const row of rows) {
    const position = (seenPerRun.get(row.runId) ?? 0) + 1;
    seenPerRun.set(row.runId, position);
    if (row.status !== "CREATED" && row.status !== "FAILED") continue;
    const info = row.commandInfo as LaneCommandInfo | undefined;
    const toolId = typeof info?.toolId === "string" ? info.toolId : "";
    const command = typeof info?.command === "string" ? commandWords(info.command) : "";
    queued.push({
      lane: laneOf(info),
      text: `${position}. ${toolId} · ${command}${isBarrier(info) ? " · waits for all earlier steps" : ""}`,
    });
  }
  if (!queued.some((q) => q.lane !== PRIMARY_LANE)) return [];

  const lanes: string[] = [];
  for (const q of queued) if (!lanes.includes(q.lane)) lanes.push(q.lane);

  const lines: QueuedStartLine[] = [{ text: QUEUED_START_LANES_HEADING, tone: "body" }];
  for (const lane of lanes) {
    const steps = queued.filter((q) => q.lane === lane);
    lines.push({
      text: `Lane ${lane}: ${steps.length} ${plural(steps.length, "step", "steps")}`,
      tone: "body",
    });
    for (const step of steps) lines.push({ text: step.text, tone: "caption" });
  }
  return lines;
}

const NOTE_LINE: QueuedStartLine = { text: QUEUED_START_NOTE, tone: "caption" };

export function queuedStartLines(input: {
  rows: ReadonlyArray<QueuedStartRow> | undefined;
  isError: boolean;
  laneFrozen?: boolean;
  // Review WR-03: lane lines only when the server confirms parallel lanes are on.
  laneMode?: boolean;
}): QueuedStartLine[] {
  if (input.isError) {
    return [{ text: QUEUED_START_ERROR, tone: "caption" }, NOTE_LINE];
  }
  if (input.rows === undefined) {
    return [{ text: QUEUED_START_LOADING, tone: "caption" }, NOTE_LINE];
  }

  const summary = summarizeQueuedStart(input.rows);
  if (summary.isEmpty) {
    return [{ text: QUEUED_START_EMPTY, tone: "body" }, NOTE_LINE];
  }

  const lines: QueuedStartLine[] = [];
  if (summary.willRun > 0) {
    const steps = plural(summary.willRun, "queued step", "queued steps");
    const runs = plural(summary.runs, "run", "runs");
    lines.push({
      text: `This Start will run ${summary.willRun} ${steps} from ${summary.runs} ${runs}.`,
      tone: "body",
    });
    if (summary.failed > 0) {
      lines.push({
        text:
          summary.willRun === 1
            ? "It failed before and will be retried first."
            : `${summary.failed} of them failed before and will be retried first.`,
        tone: "body",
      });
    }
  }
  if (summary.started > 0) {
    const steps = plural(summary.started, "step", "steps");
    lines.push({
      text: `${summary.started} ${steps} still running. A Start is ignored until it ends.`,
      tone: "caption",
    });
  }
  const byLane = input.laneMode === true ? laneLines(input.rows) : [];
  lines.push(...byLane);
  if (byLane.length > 0 && input.laneFrozen === true) {
    lines.push({ text: QUEUED_START_FREEZE_NOTE, tone: "caption" });
  }
  lines.push(NOTE_LINE);
  return lines;
}
