// RED stub: replaced in the GREEN commit.
import type { LaneFailureEntry, LaneHaltReason, RunningLaneEntry } from "@/server/laneScheduling";

export const LANE_HALT_SENTENCES: Record<LaneHaltReason, string> = {
  failure: "",
  freeze: "",
  modal: "",
};
export function laneHaltSentence(reason: LaneHaltReason): string {
  return LANE_HALT_SENTENCES[reason];
}
export const FREEZE_DISABLED_FROZEN = "";
export const FREEZE_DISABLED_IDLE = "";
export function freezeDisabledReason(input: {
  halted: boolean;
  queueBusy: boolean;
}): string | null {
  void input;
  return "stub";
}
export function shouldShowLanesPanel(
  status: { laneMode: boolean; hasLaneRows: boolean } | undefined,
): boolean {
  void status;
  return true;
}
export function runningLaneChips(running: ReadonlyArray<RunningLaneEntry>): string[] {
  void running;
  return ["stub"];
}
export const FREEZE_CONFIRM_COPY = { header: "", body: "", confirm: "", dismiss: "" };
export const FREEZE_TOAST_COPY = { title: "", description: "" };
export function freezeFailedDescription(message: string): string {
  void message;
  return "";
}
export interface LaneFailureListView {
  heading: string;
  entries: Array<{ lane: string; meta: string; note: string | null; message: string | null }>;
  overflowLine: string | null;
}
export function describeLaneFailures(
  failures: ReadonlyArray<LaneFailureEntry>,
  overflow: number,
  formatTime: (ms: number) => string = String,
): LaneFailureListView | null {
  void failures;
  void overflow;
  void formatTime;
  return { heading: "", entries: [], overflowLine: null };
}
export function laneCardCaption(
  row: { status: string; startedAt?: unknown; completedAt?: unknown; commandInfo?: unknown },
  formatTime: (ms: number) => string = String,
): string[] {
  void row;
  void formatTime;
  return [];
}
export function laneDoneText(rows: ReadonlyArray<{ status: string }>): string {
  void rows;
  return "";
}
export const LANE_ROW_ALL_DONE = "";
