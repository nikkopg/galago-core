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
// "too_large": the reply is over a cap. It is rejected whole, never truncated
// (D-03, T-06-05).
type Parsed = ParsedList | ParsedTree | "bad_reply" | "too_large";

// Reply caps (RESEARCH A1, discretion values). Over a list or tree cap the
// whole reply is unavailable too_large; a name over the length cap is dropped
// and the list marked degraded. Nothing is ever sliced to fit.
export const MAX_NAME_LENGTH = 256;
export const MAX_LIST_ITEMS = 1000;
export const MAX_TREE_NODES = 10000;

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

// Explicit own-property read (T-06-09): a key is never resolved through the
// prototype chain, and a reply object is never spread, merged or key-iterated.
function own(obj: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

// A usable instrument-reported name: a string of at most MAX_NAME_LENGTH
// characters (checked on the raw length, before any other work), non-empty
// after trim, and not a {{variable}} reference (raw or trimmed), which run-time
// substitution could expand into a value the operator never chose (T-06-03).
// Kept verbatim.
function isUsableName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length > MAX_NAME_LENGTH) return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return !isVariableLike(value) && !isVariableLike(trimmed);
}

// Top-level reply: a plain object whose kind matches, else the reply is not
// what this source asked for.
function checkKind(meta: unknown, kind: string): Record<string, unknown> | undefined {
  if (!isPlainObject(meta)) return undefined;
  if (own(meta, "kind") !== kind) return undefined;
  return meta;
}

function parseNameList(meta: unknown, kind: string, listKey: string, nameKey: string): Parsed {
  const root = checkKind(meta, kind);
  if (root === undefined) return "bad_reply";
  const items = own(root, listKey);
  if (!Array.isArray(items)) return "bad_reply";
  if (items.length > MAX_LIST_ITEMS) return "too_large";
  const names: string[] = [];
  let degraded = false;
  for (const item of items) {
    if (!isPlainObject(item)) {
      degraded = true;
      continue;
    }
    const name = own(item, nameKey);
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

// Counts every device, deck and nest node with length reads only, so an
// oversized tree is rejected before any per-node work. Stops counting as soon
// as the cap is passed.
function countTreeNodes(rawDevices: unknown[]): number {
  let count = rawDevices.length;
  for (const rawDevice of rawDevices) {
    if (count > MAX_TREE_NODES) return count;
    if (!isPlainObject(rawDevice)) continue;
    const rawDecks = own(rawDevice, "decks");
    if (!Array.isArray(rawDecks)) continue;
    count += rawDecks.length;
    for (const rawDeck of rawDecks) {
      if (count > MAX_TREE_NODES) return count;
      if (!isPlainObject(rawDeck)) continue;
      const rawNests = own(rawDeck, "nests");
      if (Array.isArray(rawNests)) count += rawNests.length;
    }
  }
  return count;
}

export function parseDeviceTree(meta: unknown): Parsed {
  const root = checkKind(meta, "deviceTree");
  if (root === undefined) return "bad_reply";
  const rawDevices = own(root, "devices");
  if (!Array.isArray(rawDevices)) return "bad_reply";
  if (rawDevices.length > MAX_LIST_ITEMS) return "too_large";
  if (countTreeNodes(rawDevices) > MAX_TREE_NODES) return "too_large";

  let degraded = false;

  // ambiguous: absent means [], anything but an array of strings is bad_reply.
  // Entries are carried verbatim: an over-long one can never match an offered
  // path, so it needs no length check.
  const rawAmbiguous = own(root, "ambiguous");
  let ambiguous: string[] = [];
  if (rawAmbiguous !== undefined) {
    if (!Array.isArray(rawAmbiguous)) return "bad_reply";
    if (rawAmbiguous.length > MAX_TREE_NODES) return "too_large";
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
    const deviceName = own(rawDevice, "deviceName");
    if (!isUsableName(deviceName)) {
      degraded = true;
      continue;
    }
    const decks: StackDeck[] = [];
    const rawDecks = own(rawDevice, "decks");
    if (Array.isArray(rawDecks)) {
      for (const rawDeck of rawDecks) {
        if (!isPlainObject(rawDeck)) {
          degraded = true;
          continue;
        }
        const deckName = own(rawDeck, "deckName");
        if (!isUsableName(deckName)) {
          degraded = true;
          continue;
        }
        const nests: StackNest[] = [];
        const rawNests = own(rawDeck, "nests");
        if (Array.isArray(rawNests)) {
          for (const rawNest of rawNests) {
            if (!isPlainObject(rawNest)) {
              degraded = true;
              continue;
            }
            const nestName = own(rawNest, "nestName");
            if (!isUsableName(nestName)) {
              degraded = true;
              continue;
            }
            nests.push({ nestName, isCalibrated: own(rawNest, "isCalibrated") === true });
          }
        } else {
          degraded = true;
        }
        decks.push({ deckName, isCalibrated: own(rawDeck, "isCalibrated") === true, nests });
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
      const kind = isPlainObject(reply.meta) ? own(reply.meta, "kind") : undefined;
      return unavailable(source, kind === "readFailed" ? "read_failed" : "tool_refused");
    }
    if (reply.meta === undefined || reply.meta === null) return unavailable(source, "no_data");

    const parsed = entry.parse(reply.meta);
    if (parsed === "bad_reply" || parsed === "too_large") return unavailable(source, parsed);

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
