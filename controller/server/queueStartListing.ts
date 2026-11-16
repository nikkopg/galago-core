// Pure formatter for the "Queue Started" audit line (QUE-08, D-07). No imports
// from command_queue.ts, the db or React, so it is unit-testable on its own.

export type QueueStartSource = "operator" | "enqueue";

export interface QueueStartRow {
  queueId: number;
  runId: string;
  status: string;
  commandInfo?: unknown;
}

export const MAX_LISTED_QUEUE_ROWS = 50;

function prefixFor(source: QueueStartSource): string {
  return source === "enqueue"
    ? "Command Queue started automatically after a run was enqueued."
    : "Command Queue started by user.";
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

export function describeQueueStart(
  rows: ReadonlyArray<QueueStartRow>,
  source: QueueStartSource,
): string {
  const prefix = prefixFor(source);
  if (rows.length === 0) {
    return `${prefix} The queue is empty.`;
  }

  const willRun = rows.filter((r) => r.status === "CREATED" || r.status === "FAILED");
  const failed = willRun.filter((r) => r.status === "FAILED").length;
  const runs = new Set(willRun.map((r) => r.runId)).size;

  let text = `${prefix} Will run ${willRun.length} queued ${plural(willRun.length, "step", "steps")} from ${runs} ${plural(runs, "run", "runs")}`;
  if (failed > 0) {
    text += `; ${failed} failed before and will be retried first`;
  }

  const listed = rows
    .slice(0, MAX_LISTED_QUEUE_ROWS)
    .map((r) => `queueId=${r.queueId} runId=${r.runId} status=${r.status}`)
    .join("; ");
  text += `. Queue order: ${listed}`;

  const rest = rows.length - MAX_LISTED_QUEUE_ROWS;
  if (rest > 0) {
    text += `; ... and ${rest} more`;
  }
  return text;
}

export function describeQueueStartReadFailure(source: QueueStartSource, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${prefixFor(source)} The queued steps could not be read: ${message}`;
}
