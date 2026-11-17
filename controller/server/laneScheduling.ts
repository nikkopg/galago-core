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

// A Tool Box step is always primary, and so is an invalid or non-text name. That
// is not always more sequential: a mistyped lane runs on the primary lane beside
// the side lanes, and a mistyped barrier is dropped (see isBarrier). validateLanes
// rule 0 therefore refuses both at run creation instead of relying on this fallback.
export function laneOf(info: LaneCommandInfo | undefined): string {
  if (isToolBoxStep(info)) return PRIMARY_LANE;
  const lane = normalizeLane(advancedValue(info, "lane"));
  return isValidLaneName(lane) ? lane : PRIMARY_LANE;
}

// Only a stored boolean true is a barrier. Any other value ("true", 1) is not
// honoured here and is refused by validateLanes rule 0.
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

// Exact UI-SPEC S2c sentences. Step numbers are 1-based, matching the
// "Generated Commands" numbering.
export const laneMessages = Object.freeze({
  invalidName: (v: string): string =>
    `Lane name '${v}' is not valid. Use 1 to 32 characters: a-z, 0-9, - and _.`,
  nonToolOnSecondary: (n: number, command: string, lane: string): string =>
    `Step ${n} (${command}) is on lane '${lane}', but only tool steps can run on a secondary lane. Move it to the primary lane.`,
  toolOnTwoLanes: (tool: string, a: string, b: string): string =>
    `Tool '${tool}' is on lanes '${a}' and '${b}'. One tool can use only one lane per run.`,
  tooManyLanes: (n: number): string =>
    `This run uses ${n} lanes. A run can use at most ${MAX_LANES_PER_RUN}.`,
  firstRowNeedsBarrier: (lane: string, n: number): string =>
    `The first step on lane '${lane}' (step ${n}) must wait for all earlier steps. Turn on "Wait for all earlier steps" for it.`,
  gotoInLaneRun: (n: number): string =>
    `Step ${n} is a Go to step, which cannot be used in a run that has lanes. Remove it, or keep every step on the primary lane.`,
  barrierNotBoolean: (n: number): string =>
    `Step ${n}: "Wait for all earlier steps" must be on or off.`,
  laneNotText: (n: number): string => `Step ${n}: the lane name must be text.`,
  deadWait: (n: number): string =>
    `The lane setup cannot finish: step ${n} would wait forever. Check the "Wait for all earlier steps" settings.`,
});

// Dry-runs the eligibility rules over the steps of one run under an open gate
// (nothing busy, nothing controllable). With barrier-only rules the lowest
// remaining row is always eligible, so this is the D-17 assertion that a setup
// cannot hang; it reports the 1-based position of the first stuck step.
export function simulateDrain(
  infos: ReadonlyArray<LaneCommandInfo>,
): { drained: true } | { drained: false; stuckPosition: number } {
  let rows: LaneRow[] = infos.map((commandInfo, i) => ({
    queueId: i + 1,
    runId: "simulated",
    status: "CREATED",
    commandInfo,
  }));
  const open: LaneGate = {
    halted: false,
    modalOpen: false,
    busyToolKeys: new Set<string>(),
    controllableToolTypes: [],
    controllableRunning: false,
  };
  while (rows.length > 0) {
    let next = -1;
    for (let i = 0; i < rows.length; i++) {
      if (isEligible(rows, i, open)) {
        next = i;
        break;
      }
    }
    if (next < 0) return { drained: false, stuckPosition: rows[0].queueId };
    rows = rows.filter((_, i) => i !== next);
  }
  return { drained: true };
}

function isGotoStep(info: LaneCommandInfo): boolean {
  return (
    isToolBoxStep(info) &&
    typeof info.command === "string" &&
    info.command.trim().toLowerCase() === "goto"
  );
}

// Run-creation refusals in fixed rule order: wrong-typed lane or barrier tag, invalid name, non-tool step on a
// secondary lane, one tool on two lanes, more than MAX_LANES_PER_RUN lanes, first
// row of a secondary lane without a barrier, Tool Box goto in a laned run, dead wait.
export function validateLanes(infos: ReadonlyArray<LaneCommandInfo>): string[] {
  const messages: string[] = [];

  // 0. A present tag of the wrong type. Stored command JSON is untrusted and the
  // dispatch rules ignore such a tag silently, which would drop a barrier or move a
  // step onto the primary lane, so refuse it here with a message instead.
  infos.forEach((info, i) => {
    const ap = info && typeof info === "object" ? info.advancedParameters : undefined;
    if (!ap || typeof ap !== "object") return;
    if (hasOwn(ap, "laneBarrier") && typeof ap.laneBarrier !== "boolean") {
      messages.push(laneMessages.barrierNotBoolean(i + 1));
    }
    if (hasOwn(ap, "lane") && ap.lane !== undefined && typeof ap.lane !== "string") {
      messages.push(laneMessages.laneNotText(i + 1));
    }
  });

  // 1. Invalid lane name, once per distinct normalised value.
  const badNames: string[] = [];
  for (const info of infos) {
    const lane = normalizeLane(advancedValue(info, "lane"));
    if (!isValidLaneName(lane) && !badNames.includes(lane)) badNames.push(lane);
  }
  for (const v of badNames) messages.push(laneMessages.invalidName(v));

  // 2. Non-tool step on a secondary lane (judged on the tag as stored).
  infos.forEach((info, i) => {
    const lane = normalizeLane(advancedValue(info, "lane"));
    if (isToolBoxStep(info) && lane !== PRIMARY_LANE) {
      messages.push(laneMessages.nonToolOnSecondary(i + 1, String(info.command ?? ""), lane));
    }
  });

  // 3. One tool on two lanes (tool steps only, identity by toolKeyOf).
  const toolLanes = new Map<string, string>();
  const reported = new Set<string>();
  for (const info of infos) {
    if (isToolBoxStep(info)) continue;
    const key = toolKeyOf(toolIdOf(info));
    const lane = laneOf(info);
    const first = toolLanes.get(key);
    if (first === undefined) {
      toolLanes.set(key, lane);
    } else if (first !== lane && !reported.has(key + "\u0000" + lane)) {
      reported.add(key + "\u0000" + lane);
      messages.push(laneMessages.toolOnTwoLanes(toolIdOf(info), first, lane));
    }
  }

  // 4. More than MAX_LANES_PER_RUN distinct lanes, primary included when used.
  const lanes: string[] = [];
  for (const info of infos) {
    const lane = laneOf(info);
    if (!lanes.includes(lane)) lanes.push(lane);
  }
  if (lanes.length > MAX_LANES_PER_RUN) messages.push(laneMessages.tooManyLanes(lanes.length));

  // 5. First row of each secondary lane needs a barrier (except at step 1).
  const seen = new Set<string>();
  infos.forEach((info, i) => {
    const lane = laneOf(info);
    if (lane === PRIMARY_LANE || seen.has(lane)) return;
    seen.add(lane);
    if (i !== 0 && !isBarrier(info)) messages.push(laneMessages.firstRowNeedsBarrier(lane, i + 1));
  });

  // 6. Tool Box goto in a run that has a non-primary lane.
  if (lanes.some((l) => l !== PRIMARY_LANE)) {
    infos.forEach((info, i) => {
      if (isGotoStep(info)) messages.push(laneMessages.gotoInLaneRun(i + 1));
    });
  }

  // 7. Dead wait.
  const drain = simulateDrain(infos);
  if (!drain.drained) messages.push(laneMessages.deadWait(drain.stuckPosition));

  return messages;
}

// Plain Error subclass classified by name, not class identity: in next dev a
// singleton can throw a class from an older module copy (same approach as
// OperatorOnlyCommandError).
export class LaneValidationError extends Error {
  readonly messages: string[];
  constructor(messages: string[]) {
    super(messages.join(" "));
    this.name = "LaneValidationError";
    this.messages = messages;
  }
}

export function isLaneValidationError(e: unknown): e is LaneValidationError {
  return e instanceof Error && e.name === "LaneValidationError";
}

export interface LaneGroup {
  lane: string;
  steps: Array<{ position: number; toolId: string; command: string; barrier: boolean }>;
}

// One group per lane in first-appearance order, or null when every step is primary.
export function groupByLane(infos: ReadonlyArray<LaneCommandInfo>): LaneGroup[] | null {
  if (!infos.some((info) => laneOf(info) !== PRIMARY_LANE)) return null;
  const groups: LaneGroup[] = [];
  infos.forEach((info, i) => {
    const lane = laneOf(info);
    let group = groups.find((g) => g.lane === lane);
    if (!group) {
      group = { lane, steps: [] };
      groups.push(group);
    }
    group.steps.push({
      position: i + 1,
      toolId: toolIdOf(info),
      command: typeof info?.command === "string" ? info.command : "",
      barrier: isBarrier(info),
    });
  });
  return groups;
}

export function commandWords(command: string): string {
  return command.replace(/_/g, " ");
}

export function hasLaneTags(infos: ReadonlyArray<LaneCommandInfo>): boolean {
  return infos.some(
    (info) => normalizeLane(advancedValue(info, "lane")) !== PRIMARY_LANE || isBarrier(info),
  );
}
