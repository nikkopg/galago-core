// Pure formatter for the "Queue Started" audit line (QUE-08, D-07). No imports
// from command_queue.ts, the db or React, so it is unit-testable on its own. The
// one exception is the import-free laneScheduling.ts (lane listing suffix, D-20).
import { PRIMARY_LANE, isBarrier, laneOf } from "./laneScheduling";
import type { LaneCommandInfo } from "./laneScheduling";

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

// D-20: for lane runs, names which queueIds sit on which lane (a trailing * marks
// a barrier). Empty for an untagged queue, so its text is unchanged.
function laneListing(listed: ReadonlyArray<QueueStartRow>): string {
  const infoOf = (r: QueueStartRow) => r.commandInfo as LaneCommandInfo | undefined;
  if (!listed.some((r) => laneOf(infoOf(r)) !== PRIMARY_LANE)) return "";
  const lanes: Array<{ lane: string; ids: string[] }> = [];
  for (const r of listed) {
    const lane = laneOf(infoOf(r));
    let entry = lanes.find((l) => l.lane === lane);
    if (!entry) {
      entry = { lane, ids: [] };
      lanes.push(entry);
    }
    entry.ids.push(`${r.queueId}${isBarrier(infoOf(r)) ? "*" : ""}`);
  }
  const body = lanes.map((l) => `${l.lane}=${l.ids.join(",")}`).join("; ");
  return `. Lanes (first appearance): ${body} (* waits for all earlier steps)`;
}

// laneMode (review WR-03): with parallel lanes off, lane tags are inert (D-08) and the
// run is sequential, so the lane listing is omitted and the line matches legacy text.
export function describeQueueStart(
  rows: ReadonlyArray<QueueStartRow>,
  source: QueueStartSource,
  laneMode = false,
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
  return laneMode ? text + laneListing(rows.slice(0, MAX_LISTED_QUEUE_ROWS)) : text;
}

export function describeQueueStartReadFailure(source: QueueStartSource, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${prefixFor(source)} The queued steps could not be read: ${message}`;
}
