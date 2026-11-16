// RED stub: replaced in the GREEN commit.
import type { AdvancedParameters } from "@/types";
import type { LaneCommandInfo } from "@/server/laneScheduling";

export function isToolStep(info: LaneCommandInfo | undefined): boolean {
  void info;
  return true;
}
export function setLane(adv: AdvancedParameters, raw: string): AdvancedParameters {
  void raw;
  return adv;
}
export function setBarrier(adv: AdvancedParameters, on: boolean): AdvancedParameters {
  void on;
  return adv;
}
export function suggestLanes(commands: ReadonlyArray<LaneCommandInfo>): string[] {
  void commands;
  return [];
}
export function laneHelperText(suggestions: ReadonlyArray<string>): string {
  void suggestions;
  return "";
}
export function laneFlag(
  commands: ReadonlyArray<LaneCommandInfo>,
  index: number,
  draft: AdvancedParameters,
): string | null {
  void commands;
  void index;
  void draft;
  return "stub";
}
export const LANE_BARRIER_HELP = "";
export const LANE_INERT_NOTE = "";
export interface LaneSummaryGroup {
  lane: string;
  header: string;
  lines: string[];
}
export interface LaneSummary {
  groups: LaneSummaryGroup[];
  warnings: string[];
}
export function buildLaneSummary(
  commands: ReadonlyArray<LaneCommandInfo & { params?: unknown }>,
  opts?: { style?: "visual" | "script" },
): LaneSummary | null {
  void commands;
  void opts;
  return { groups: [], warnings: ["stub"] };
}
export function laneWarningText(line: string): string {
  void line;
  return "";
}
