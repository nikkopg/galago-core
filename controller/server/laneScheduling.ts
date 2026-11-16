// No imports (shared by CommandQueue, run creation, the script executor and
// client helpers, like runControl.ts and toolKey.ts): it must stay loadable from
// both the server and the browser bundle, with no timers, no React and no db.
//
// RED stub: every Task 1 export is present and deliberately wrong.

export const PRIMARY_LANE = "primary";
export const MAX_LANES_PER_RUN = 4;
export const LANE_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;
export const LANE_TAGS_IGNORED_WARNING = "lane tags ignored: parallel lanes disabled";

export interface LaneCommandInfo {
  toolId?: string;
  toolType?: unknown;
  command?: string;
  params?: unknown;
  advancedParameters?: { lane?: unknown; laneBarrier?: unknown } | null;
}

export interface LaneRow {
  queueId: number;
  runId: string;
  status: string;
  commandInfo?: LaneCommandInfo;
}

export interface LaneGate {
  halted: boolean;
  modalOpen: boolean;
  busyToolKeys: ReadonlySet<string>;
  controllableToolTypes: ReadonlyArray<string>;
  controllableRunning: boolean;
}

export type LaneVerdict<R> =
  | { kind: "empty" }
  | { kind: "drained" }
  | { kind: "wait" }
  | { kind: "pick"; row: R };

export type LaneHaltReason = "failure" | "freeze" | "modal";

export interface RunningLaneEntry {
  lane: string;
  queueId: number;
  toolId: string;
  toolType: string;
  command: string;
}

export interface LaneFailureEntry {
  lane: string;
  queueId: number;
  toolId: string;
  toolType: string;
  message: string;
  at: number;
}

export interface LaneStatusSnapshot {
  laneMode: boolean;
  hasLaneRows: boolean;
  halted: boolean;
  haltReason: LaneHaltReason | null;
  queueBusy: boolean;
  runningLanes: RunningLaneEntry[];
  failures: LaneFailureEntry[];
  overflow: number;
}

export function normalizeLane(_raw: unknown): string {
  return "";
}

export function isValidLaneName(_name: string): boolean {
  return false;
}

export function isToolBoxStep(_info: LaneCommandInfo | undefined): boolean {
  return false;
}

export function laneOf(_info: LaneCommandInfo | undefined): string {
  return "";
}

export function isBarrier(_info: LaneCommandInfo | undefined): boolean {
  return false;
}

export function toolKeyOf(_toolId: string | undefined): string {
  return "";
}

export function isEligible<R extends LaneRow>(
  _rows: ReadonlyArray<R>,
  _index: number,
  _gate: LaneGate,
): boolean {
  return false;
}

export function pickEligible<R extends LaneRow>(
  _rows: ReadonlyArray<R>,
  _lane: string,
  _gate: LaneGate,
): LaneVerdict<R> {
  return { kind: "wait" };
}

export function lanesWithWork(_rows: ReadonlyArray<LaneRow>): string[] {
  return ["stub"];
}
