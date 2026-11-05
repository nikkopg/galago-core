// Closed registry of instrument-reported option lists (D-02) and the one
// function that reads them. The registry is the only place a read command is
// named: the tool.options query carries a source id, never a command or params,
// so the browser can never steer which instrument command is sent (T-06-01).
// Reads go through Tool.readOptions (5 s deadline, never queued, never
// polled, never retried here). Nothing in this module may import the command
// queue: a list read is not a protocol step.
import Tool from "./tools";
import { ResponseCode } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { status } from "@grpc/grpc-js";
import { isVariableLike } from "@/utils/variableRef";

export type UnavailableReason =
  | "not_connected"
  | "wrong_tool_type"
  | "transport"
  | "timeout"
  | "tool_refused"
  | "read_failed"
  | "no_data"
  | "bad_reply"
  | "too_large";

export interface StackNest {
  nestName: string;
  isCalibrated: boolean;
}

export interface StackDeck {
  deckName: string;
  isCalibrated: boolean;
  nests: StackNest[];
}

export interface StackDevice {
  deviceName: string;
  decks: StackDeck[];
}

export type OptionsResult =
  | {
      status: "ok";
      source: OptionSourceId;
      shape: "list";
      names: string[];
      degraded: boolean;
      fetchedAt: number;
    }
  | {
      status: "ok";
      source: OptionSourceId;
      shape: "tree";
      devices: StackDevice[];
      ambiguous: string[];
      degraded: boolean;
      fetchedAt: number;
    }
  | { status: "unavailable"; source: OptionSourceId; reason: UnavailableReason };

type ParsedList = { shape: "list"; names: string[]; degraded: boolean };
type ParsedTree = {
  shape: "tree";
  devices: StackDevice[];
  ambiguous: string[];
  degraded: boolean;
};
type Parsed = ParsedList | ParsedTree | "bad_reply";

interface OptionSourceEntry {
  toolType: string;
  command: string;
  kind: string;
  acceptsRefresh: boolean;
  parse: (meta: unknown) => Parsed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A usable instrument-reported name: a string, non-empty after trim, and not a
// {{variable}} reference (raw or trimmed), which run-time substitution could
// expand into a value the operator never chose (T-06-03). Kept verbatim.
function isUsableName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return !isVariableLike(value) && !isVariableLike(trimmed);
}

// Top-level reply: a plain object whose kind matches, else the reply is not
// what this source asked for.
function checkKind(meta: unknown, kind: string): Record<string, unknown> | undefined {
  if (!isPlainObject(meta)) return undefined;
  if (meta["kind"] !== kind) return undefined;
  return meta;
}

function parseNameList(meta: unknown, kind: string, listKey: string, nameKey: string): Parsed {
  const root = checkKind(meta, kind);
  if (root === undefined) return "bad_reply";
  const items = root[listKey];
  if (!Array.isArray(items)) return "bad_reply";
  const names: string[] = [];
  let degraded = false;
  for (const item of items) {
    if (!isPlainObject(item)) {
      degraded = true;
      continue;
    }
    const name = item[nameKey];
    if (isUsableName(name)) {
      names.push(name);
    } else {
      degraded = true;
    }
  }
  return { shape: "list", names, degraded };
}

export function parseRobotStates(meta: unknown): Parsed {
  return parseNameList(meta, "robotStates", "robots", "robotName");
}

export function parseProfiles(meta: unknown, expectedKind: string): Parsed {
  return parseNameList(meta, expectedKind, "profiles", "name");
}

export function parseDeviceTree(meta: unknown): Parsed {
  const root = checkKind(meta, "deviceTree");
  if (root === undefined) return "bad_reply";
  const rawDevices = root["devices"];
  if (!Array.isArray(rawDevices)) return "bad_reply";

  let degraded = false;

  // ambiguous: absent means [], anything but an array of strings is bad_reply.
  const rawAmbiguous = root["ambiguous"];
  let ambiguous: string[] = [];
  if (rawAmbiguous !== undefined) {
    if (!Array.isArray(rawAmbiguous)) return "bad_reply";
    for (const entry of rawAmbiguous) {
      if (typeof entry !== "string") return "bad_reply";
    }
    ambiguous = rawAmbiguous.slice() as string[];
  }

  const devices: StackDevice[] = [];
  for (const rawDevice of rawDevices) {
    if (!isPlainObject(rawDevice)) {
      degraded = true;
      continue;
    }
    const deviceName = rawDevice["deviceName"];
    if (!isUsableName(deviceName)) {
      degraded = true;
      continue;
    }
    const decks: StackDeck[] = [];
    const rawDecks = rawDevice["decks"];
    if (Array.isArray(rawDecks)) {
      for (const rawDeck of rawDecks) {
        if (!isPlainObject(rawDeck)) {
          degraded = true;
          continue;
        }
        const deckName = rawDeck["deckName"];
        if (!isUsableName(deckName)) {
          degraded = true;
          continue;
        }
        const nests: StackNest[] = [];
        const rawNests = rawDeck["nests"];
        if (Array.isArray(rawNests)) {
          for (const rawNest of rawNests) {
            if (!isPlainObject(rawNest)) {
              degraded = true;
              continue;
            }
            const nestName = rawNest["nestName"];
            if (!isUsableName(nestName)) {
              degraded = true;
              continue;
            }
            nests.push({ nestName, isCalibrated: rawNest["isCalibrated"] === true });
          }
        } else {
          degraded = true;
        }
        decks.push({ deckName, isCalibrated: rawDeck["isCalibrated"] === true, nests });
      }
    } else {
      degraded = true;
    }
    devices.push({ deviceName, decks });
  }
  return { shape: "tree", devices, ambiguous, degraded };
}

// Closed to exactly four sources (D-02). No fast.plates entry: Phase 7 adds it.
export const OPTION_SOURCES = {
  "stack.robots": {
    toolType: "stack",
    command: "get_robot_states",
    kind: "robotStates",
    acceptsRefresh: false,
    parse: (meta: unknown) => parseRobotStates(meta),
  },
  "stack.devices": {
    toolType: "stack",
    command: "list_devices",
    kind: "deviceTree",
    acceptsRefresh: true,
    parse: (meta: unknown) => parseDeviceTree(meta),
  },
  "stack.labwareProfiles": {
    toolType: "stack",
    command: "list_labware_profiles",
    kind: "labwareProfiles",
    acceptsRefresh: true,
    parse: (meta: unknown) => parseProfiles(meta, "labwareProfiles"),
  },
  "stack.transferProfiles": {
    toolType: "stack",
    command: "list_transfer_profiles",
    kind: "transferProfiles",
    acceptsRefresh: true,
    parse: (meta: unknown) => parseProfiles(meta, "transferProfiles"),
  },
} as const satisfies Record<string, OptionSourceEntry>;

export type OptionSourceId = keyof typeof OPTION_SOURCES;

export const OPTION_SOURCE_IDS = Object.keys(OPTION_SOURCES) as [
  OptionSourceId,
  ...OptionSourceId[],
];

function unavailable(source: OptionSourceId, reason: UnavailableReason): OptionsResult {
  return { status: "unavailable", source, reason };
}

// Reads one registry source from one connected tool. Never throws and returns
// only closed reason codes, never raw error or tool message text (T-06-07).
export async function fetchOptions(
  toolId: string,
  source: OptionSourceId,
  refresh: boolean,
): Promise<OptionsResult> {
  try {
    // Own-property guard: the router already restricts source to the enum, this
    // keeps the function total for any other caller.
    if (!Object.prototype.hasOwnProperty.call(OPTION_SOURCES, source)) {
      return unavailable(source, "bad_reply");
    }
    const entry: OptionSourceEntry = OPTION_SOURCES[source];

    // Tool.lookup, never Tool.forId: a read must not create a Tool (or its
    // heartbeat) for an id that is not already connected.
    const tool = Tool.lookup(toolId);
    if (tool === undefined) return unavailable(source, "not_connected");
    if (String(tool.type) !== entry.toolType) return unavailable(source, "wrong_tool_type");

    const params: Record<string, boolean> =
      refresh === true && entry.acceptsRefresh ? { refresh: true } : {};

    let reply;
    try {
      reply = await tool.readOptions(entry.toolType, entry.command, params);
    } catch (e) {
      const code = isPlainObject(e) ? e["code"] : undefined;
      return unavailable(source, code === status.DEADLINE_EXCEEDED ? "timeout" : "transport");
    }

    if (reply.response !== ResponseCode.SUCCESS) {
      const kind = isPlainObject(reply.meta) ? reply.meta["kind"] : undefined;
      return unavailable(source, kind === "readFailed" ? "read_failed" : "tool_refused");
    }
    if (reply.meta === undefined || reply.meta === null) return unavailable(source, "no_data");

    const parsed = entry.parse(reply.meta);
    if (parsed === "bad_reply") return unavailable(source, "bad_reply");

    if (parsed.shape === "list") {
      return {
        status: "ok",
        source,
        shape: "list",
        names: parsed.names,
        degraded: parsed.degraded,
        fetchedAt: Date.now(),
      };
    }
    return {
      status: "ok",
      source,
      shape: "tree",
      devices: parsed.devices,
      ambiguous: parsed.ambiguous,
      degraded: parsed.degraded,
      fetchedAt: Date.now(),
    };
  } catch {
    return unavailable(source, "bad_reply");
  }
}
