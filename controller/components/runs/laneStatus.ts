// Pure, React-free and timer-free run-page lane copy and view helpers (UI-SPEC
// S4, S5, S6; like queuedStartSummary.ts: no React import, no .tsx import, no
// timers). Everything here returns plain strings and numbers; rendering stays
// React text in the components. No wording promises an automatic or one-click
// resume: only the operator's Start releases a failure or freeze halt (D-13).
import { toolDisplayName, formatClock } from "./controlDecision";
import { isBarrier } from "@/server/laneScheduling";
import type {
  LaneCommandInfo,
  LaneFailureEntry,
  LaneHaltReason,
  LaneStatusSnapshot,
  RunningLaneEntry,
} from "@/server/laneScheduling";

export const LANE_HALT_SENTENCES: Readonly<Record<LaneHaltReason, string>> = Object.freeze({
  failure:
    "A step failed. No new steps start on any lane. Steps already running finish on their own. Check the instrument, then press Start. A Start runs the failed step again.",
  freeze:
    "You froze the lanes. No new steps start on any lane. Steps already running finish on their own. Press Start to resume.",
  modal:
    "A prompt on the primary lane is open. No new steps start on any lane until it is closed. Steps already running are not affected.",
});

export function laneHaltSentence(reason: LaneHaltReason): string {
  return LANE_HALT_SENTENCES[reason];
}

export const FREEZE_DISABLED_FROZEN = "Lanes are already frozen.";
export const FREEZE_DISABLED_IDLE = "Nothing is running, so there is nothing to freeze.";

// The reason the Freeze button is disabled, or null when it is usable.
export function freezeDisabledReason(input: {
  halted: boolean;
  queueBusy: boolean;
}): string | null {
  if (input.halted) return FREEZE_DISABLED_FROZEN;
  if (!input.queueBusy) return FREEZE_DISABLED_IDLE;
  return null;
}

// D-15, D-24: the panel exists only for lane mode with lane-tagged rows.
export function shouldShowLanesPanel(
  status: Pick<LaneStatusSnapshot, "laneMode" | "hasLaneRows"> | undefined,
): boolean {
  return status !== undefined && status.laneMode === true && status.hasLaneRows === true;
}

export function runningLaneChips(running: ReadonlyArray<RunningLaneEntry>): string[] {
  return running.map((entry) => `${entry.lane} · ${toolDisplayName(entry.toolType)}`);
}

export const FREEZE_CONFIRM_COPY = Object.freeze({
  header: "Freeze lanes?",
  body: "Stops new steps on every lane. Steps already running continue and are not aborted. Press Start to resume.",
  confirm: "Freeze lanes",
  dismiss: "Keep lanes running",
});

export const FREEZE_TOAST_COPY = Object.freeze({
  title: "Lanes frozen",
  description: "No new steps will start. Running steps continue. Press Start to resume.",
});

export function freezeFailedDescription(message: string): string {
  return `${message}. Check the Lanes panel to see whether the lanes are frozen.`;
}

export interface LaneFailureListEntry {
  lane: string;
  meta: string;
  note: string | null;
  message: string | null;
}

export interface LaneFailureListView {
  heading: string;
  entries: LaneFailureListEntry[];
  overflowLine: string | null;
}

export const FIRST_FAILURE_NOTE = "First failure, shown above";

// D-16: the list shows only with two or more failures. The first entry is the
// banner's own failure, so it carries no repeated message.
export function describeLaneFailures(
  failures: ReadonlyArray<LaneFailureEntry>,
  overflow: number,
  formatTime: (ms: number) => string = formatClock,
): LaneFailureListView | null {
  if (failures.length < 2) return null;
  const more = overflow > 0 ? overflow : 0;
  const entries = failures.map((failure, index) => ({
    lane: failure.lane,
    meta: `${toolDisplayName(failure.toolType)} · ${formatTime(failure.at)}`,
    note: index === 0 ? FIRST_FAILURE_NOTE : null,
    message: index === 0 ? null : failure.message,
  }));
  return {
    heading: `Failures by lane (${entries.length + more})`,
    entries,
    overflowLine:
      more > 0
        ? `${more} more ${more === 1 ? "failure" : "failures"} not shown. Each failed step keeps its own error on its card.`
        : null,
  };
}

function toMillis(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value as string | number).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export const LANE_BARRIER_CAPTION = "Waits for all earlier steps";

// Caption lines under a lane-row card (UI-SPEC S4). A FAILED row without a
// completedAt shows no Ended line.
export function laneCardCaption(
  row: { status: string; startedAt?: unknown; completedAt?: unknown; commandInfo?: unknown },
  formatTime: (ms: number) => string = formatClock,
): string[] {
  const lines: string[] = [];
  const started = toMillis(row.startedAt);
  if (started === null) {
    lines.push("Not started");
  } else {
    lines.push(`Started ${formatTime(started)}${row.status === "STARTED" ? " · running" : ""}`);
  }
  const ended = toMillis(row.completedAt);
  if (ended !== null) lines.push(`Ended ${formatTime(ended)}`);
  if (isBarrier(row.commandInfo as LaneCommandInfo | undefined)) lines.push(LANE_BARRIER_CAPTION);
  return lines;
}

export function laneDoneText(rows: ReadonlyArray<{ status: string }>): string {
  const done = rows.filter((r) => r.status === "COMPLETED" || r.status === "SKIPPED").length;
  return `${done} of ${rows.length} done`;
}

export const LANE_ROW_ALL_DONE = "All steps in this lane are complete";
