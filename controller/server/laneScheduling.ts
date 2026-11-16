// No imports (shared by CommandQueue, run creation, the script executor and
// client helpers, like runControl.ts and toolKey.ts): it must stay loadable from
// both the server and the browser bundle, with no timers, no React and no db.
//
// Every lane rule is a function of the ordered queue rows plus a small gate, so
// the queue class only feeds it rows and the rules are table-tested on their own.
// Stored command JSON is untrusted: reads use typeof checks and own properties.

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

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// Reads one own property of the stored advancedParameters object, or undefined.
function advancedValue(info: LaneCommandInfo | undefined, key: string): unknown {
  if (!info || typeof info !== "object") return undefined;
  const ap = info.advancedParameters;
  if (!ap || typeof ap !== "object") return undefined;
  return hasOwn(ap, key) ? (ap as Record<string, unknown>)[key] : undefined;
}

// Trim and lower-case; blank, non-string and "primary" all give "primary".
export function normalizeLane(raw: unknown): string {
  if (typeof raw !== "string") return PRIMARY_LANE;
  const name = raw.trim().toLowerCase();
  return name === "" ? PRIMARY_LANE : name;
}

export function isValidLaneName(name: string): boolean {
  return LANE_NAME_PATTERN.test(name);
}

export function isToolBoxStep(info: LaneCommandInfo | undefined): boolean {
  if (!info || typeof info !== "object") return false;
  return info.toolId === "Tool Box" || String(info.toolType) === "toolbox";
}

// A Tool Box step is always primary, and so is an invalid name: a smuggled or
// unvalidated tag can only make dispatch more sequential, never less.
export function laneOf(info: LaneCommandInfo | undefined): string {
  if (isToolBoxStep(info)) return PRIMARY_LANE;
  const lane = normalizeLane(advancedValue(info, "lane"));
  return isValidLaneName(lane) ? lane : PRIMARY_LANE;
}

export function isBarrier(info: LaneCommandInfo | undefined): boolean {
  return advancedValue(info, "laneBarrier") === true;
}

// The exact normalizeToolKey transform, inlined because this module imports nothing.
export function toolKeyOf(toolId: string | undefined): string {
  return (toolId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toolIdOf(info: LaneCommandInfo | undefined): string {
  return info && typeof info.toolId === "string" ? info.toolId : "";
}

export function isEligible<R extends LaneRow>(
  rows: ReadonlyArray<R>,
  index: number,
  gate: LaneGate,
): boolean {
  const r = rows[index];
  if (!r) return false;
  if (r.status !== "CREATED" && r.status !== "FAILED") return false;
  if (rows.length === 0 || r.runId !== rows[0].runId) return false;

  const lane = laneOf(r.commandInfo);

  // The highest-index barrier of this run at or before r (r itself when it is one).
  let lastBarrier = -1;
  for (let i = index; i >= 0; i--) {
    if (rows[i].runId === r.runId && isBarrier(rows[i].commandInfo)) {
      lastBarrier = i;
      break;
    }
  }

  for (let i = 0; i < index; i++) {
    const p = rows[i];
    if (p.runId !== r.runId) continue;
    if (i < lastBarrier) return false;
    if (laneOf(p.commandInfo) === lane) return false;
  }

  for (const o of rows) {
    if (o.status !== "STARTED") continue;
    if (laneOf(o.commandInfo) === lane) return false;
    if (isToolBoxStep(o.commandInfo)) return false;
  }

  if (gate.busyToolKeys.has(toolKeyOf(toolIdOf(r.commandInfo)))) return false;
  if (gate.halted || gate.modalOpen) return false;
  if (
    gate.controllableRunning &&
    gate.controllableToolTypes.includes(String(r.commandInfo?.toolType))
  ) {
    return false;
  }
  return true;
}

export function pickEligible<R extends LaneRow>(
  rows: ReadonlyArray<R>,
  lane: string,
  gate: LaneGate,
): LaneVerdict<R> {
  if (rows.length === 0) return { kind: "empty" };
  let onLane = false;
  for (let i = 0; i < rows.length; i++) {
    if (laneOf(rows[i].commandInfo) !== lane) continue;
    onLane = true;
    if (isEligible(rows, i, gate)) return { kind: "pick", row: rows[i] };
  }
  return onLane ? { kind: "wait" } : { kind: "drained" };
}

// Non-primary lanes, in first-appearance order, with a CREATED or FAILED row in the active run.
export function lanesWithWork(rows: ReadonlyArray<LaneRow>): string[] {
  if (rows.length === 0) return [];
  const active = rows[0].runId;
  const lanes: string[] = [];
  for (const r of rows) {
    if (r.runId !== active) continue;
    if (r.status !== "CREATED" && r.status !== "FAILED") continue;
    const lane = laneOf(r.commandInfo);
    if (lane !== PRIMARY_LANE && !lanes.includes(lane)) lanes.push(lane);
  }
  return lanes;
}
