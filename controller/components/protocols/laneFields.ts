// Pure, React-free drawer and preview helpers for lane tags (D-01, D-02, D-18,
// D-20; UI-SPEC S1, S2). No React import, no .tsx import, no timers. These
// helpers never write an empty lane or a false barrier: a blank or "primary" lane
// deletes the `lane` key and an off barrier deletes the `laneBarrier` key
// (Pitfall 24b), and they never mutate their input. Nothing here preselects a lane
// or turns the barrier on: a new step starts on primary with the barrier off.
import {
  MAX_LANES_PER_RUN,
  PRIMARY_LANE,
  commandWords,
  groupByLane,
  isBarrier,
  isToolBoxStep,
  isValidLaneName,
  laneMessages,
  laneOf,
  normalizeLane,
  toolKeyOf,
  validateLanes,
} from "@/server/laneScheduling";
import type { LaneCommandInfo } from "@/server/laneScheduling";
import type { AdvancedParameters } from "@/types";

type StepInfo = LaneCommandInfo & { params?: unknown };

export const LANE_BARRIER_HELP =
  "Runs only after every earlier step on every lane has finished. Use it before a step that needs the plates in place.";
export const LANE_INERT_NOTE =
  "Lanes take effect only when parallel lanes are enabled on the server.";
const BARRIER_SUFFIX = " — waits for all earlier steps";

// D-18: only tool steps get Lane and barrier controls; a Tool Box step shows none.
export function isToolStep(info: LaneCommandInfo | undefined): boolean {
  return !isToolBoxStep(info);
}

// Blank or "primary" deletes the key; anything else is stored trimmed and lower-case.
export function setLane(adv: AdvancedParameters, raw: string): AdvancedParameters {
  const next: AdvancedParameters = { ...adv };
  const lane = normalizeLane(raw);
  if (lane === PRIMARY_LANE) {
    delete next.lane;
  } else {
    next.lane = lane;
  }
  return next;
}

// On stores true; off deletes the key (never false).
export function setBarrier(adv: AdvancedParameters, on: boolean): AdvancedParameters {
  const next: AdvancedParameters = { ...adv };
  if (on) {
    next.laneBarrier = true;
  } else {
    delete next.laneBarrier;
  }
  return next;
}

// "primary" first, then each distinct non-primary lane already used, in
// first-appearance order. Suggestions only fill a datalist; nothing is preselected.
export function suggestLanes(commands: ReadonlyArray<LaneCommandInfo>): string[] {
  const lanes: string[] = [];
  for (const info of commands) {
    const lane = laneOf(info);
    if (lane !== PRIMARY_LANE && !lanes.includes(lane)) lanes.push(lane);
  }
  return [PRIMARY_LANE, ...lanes.slice(0, MAX_LANES_PER_RUN)];
}

export function laneHelperText(suggestions: ReadonlyArray<string>): string {
  const others = suggestions.filter((lane) => lane !== PRIMARY_LANE);
  return others.length === 0
    ? "Blank means the primary lane. No other lanes are used in this protocol yet."
    : `Blank means the primary lane. Lanes in this protocol: ${suggestions.join(", ")}`;
}

function toolIdOf(info: LaneCommandInfo | undefined): string {
  return info && typeof info.toolId === "string" ? info.toolId : "";
}

// The first matching author-time warning (UI-SPEC S1 order) for the step at
// `index` once `draft` replaces its advanced parameters, or null. It never blocks
// saving: the server (validateLanes) is the final check at run creation (D-18).
export function laneFlag(
  commands: ReadonlyArray<StepInfo>,
  index: number,
  draft: AdvancedParameters,
): string | null {
  const current = commands[index];
  if (!current || isToolBoxStep(current)) return null;

  const draftLane = normalizeLane(draft.lane);
  if (draftLane === PRIMARY_LANE) return null;

  // 1. Invalid name.
  if (!isValidLaneName(draftLane)) return laneMessages.invalidName(draftLane);

  const edited = commands.map((info, i) =>
    i === index ? { ...info, advancedParameters: draft } : info,
  );

  // 2. This step's lane would be a 5th (or later) distinct lane.
  const lanes: string[] = [];
  for (const info of edited) {
    const lane = laneOf(info);
    if (!lanes.includes(lane)) lanes.push(lane);
  }
  if (lanes.indexOf(draftLane) >= MAX_LANES_PER_RUN) {
    return `This protocol would use ${lanes.length} lanes. A run can use at most ${MAX_LANES_PER_RUN}.`;
  }

  // 3. The same tool is already on a different lane.
  const key = toolKeyOf(toolIdOf(current));
  for (let i = 0; i < edited.length; i++) {
    if (i === index || isToolBoxStep(edited[i])) continue;
    if (toolKeyOf(toolIdOf(edited[i])) !== key) continue;
    const other = laneOf(edited[i]);
    if (other !== draftLane) {
      return `${toolIdOf(current)} is already on lane '${other}'. One tool can use only one lane per run.`;
    }
  }

  // 4. First step on this lane, not at position 1, barrier off.
  const firstOnLane = !edited.slice(0, index).some((info) => laneOf(info) === draftLane);
  if (firstOnLane && index !== 0 && !isBarrier(edited[index])) {
    return `The first step on lane '${draftLane}' should wait for all earlier steps, so it starts only after the plates are placed.`;
  }
  return null;
}

export interface LaneSummaryGroup {
  lane: string;
  header: string;
  lines: string[];
}

export interface LaneSummary {
  groups: LaneSummaryGroup[];
  warnings: string[];
}

// Per-lane preview of a protocol (S2a visual, S2b script). Null for an untagged
// protocol so callers keep today's output. Lines carry the global step position so
// cross-lane order stays readable. Warnings are the exact run-creation refusals.
export function buildLaneSummary(
  commands: ReadonlyArray<StepInfo>,
  opts?: { style?: "visual" | "script" },
): LaneSummary | null {
  const style = opts?.style ?? "visual";
  const grouped = groupByLane(commands);
  const warnings = validateLanes(commands);
  if (grouped === null) {
    // A tag that does not take effect (an invalid name) still has a refusal to show.
    return warnings.length > 0 ? { groups: [], warnings } : null;
  }
  const groups = grouped.map((group) => ({
    lane: group.lane,
    header: `Lane ${group.lane} · ${group.steps.length} ${group.steps.length === 1 ? "step" : "steps"}`,
    lines: group.steps.map((s) => {
      let body: string;
      if (style === "script") {
        const params = commands[s.position - 1]?.params;
        const hasParams =
          typeof params === "object" && params !== null && Object.keys(params).length > 0;
        body = `${s.command}${hasParams ? ` — ${JSON.stringify(params)}` : ""}`;
      } else {
        body = commandWords(s.command);
      }
      return `${s.position}. [${s.toolId}] ${body}${s.barrier ? BARRIER_SUFFIX : ""}`;
    }),
  }));
  return { groups, warnings };
}

// D-26: the server's warning line shown with its first letter capitalised.
export function laneWarningText(line: string): string {
  return line.charAt(0).toUpperCase() + line.slice(1);
}
