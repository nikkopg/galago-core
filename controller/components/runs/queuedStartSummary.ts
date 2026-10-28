// Pure, React-free start-summary counts and copy lines for the Run
// confirmation modal (QUE-08, D-05/D-06: no React import, no .tsx import,
// no timers). Fed by the rows of the queue-joined `commandQueue.commands`
// query so a dequeued FAILED row is never promised as a retry. This module
// only counts and words; it never sends a command and holds no state.
//
// All copy is assembled here so the JSX does no string math (UI-SPEC S1).

export interface QueuedStartRow {
  status: string;
  runId: string;
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

const NOTE_LINE: QueuedStartLine = { text: QUEUED_START_NOTE, tone: "caption" };

export function queuedStartLines(input: {
  rows: ReadonlyArray<QueuedStartRow> | undefined;
  isError: boolean;
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
  lines.push(NOTE_LINE);
  return lines;
}
