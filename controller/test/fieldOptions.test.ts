// React-free cascade core (06-03): device -> deck -> nest by position, the
// calibration filter (D-07), ambiguity flags with device- and deck-level prefix
// propagation (D-08), and applyChange as the only patch producer (D-09).
// Fixtures only; nothing here talks to an instrument.
import { describe, it, expect } from "vitest";
import {
  AMBIGUOUS_SUFFIX,
  DEGRADED_SUFFIX,
  FIELD_BINDINGS,
  LOADING_LABEL,
  NOT_REPORTED_SUFFIX,
  NO_CALIBRATED_DECKS,
  NO_CALIBRATED_NESTS,
  REFRESHING_LABEL,
  REFRESH_LABEL,
  SOURCE_LABELS,
  UNAVAILABLE_HINT,
  VARIABLE_PARENT_HINT,
  applyChange,
  buildCascadeOptions,
  buildFieldView,
  buildSelectView,
  cascadeAncestorBound,
  deriveOptionsMode,
  firstFieldForSource,
  formatStatusLine,
  lookupFieldBinding,
} from "@/components/tools/fieldOptions";
import type {
  FieldBinding,
  OptionsMode,
  SelectOption,
  SelectView,
} from "@/components/tools/fieldOptions";
import { commandFields } from "@/components/tools/constants";
import type { OptionSourceId, OptionsResult } from "@/server/toolOptions";
import {
  DUPLICATE_DECK_TREE,
  DUPLICATE_DEVICE_TREE,
  DUPLICATE_NEST_TREE,
  EMPTY_DEVICE_TREE,
  GOLDEN_TREE,
  NO_DEVICES_TREE,
  REFRESHED_TREE,
  SAME_NEST_DIFFERENT_DECKS_TREE,
  SLASH_COLLISION_TREE,
  UNCALIBRATED_TREE,
} from "./fixtures/stackDeviceTrees";
import type { DeviceTreeFixture } from "./fixtures/stackDeviceTrees";

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function binding(field: string, command = "transfer"): FieldBinding {
  const found = lookupFieldBinding("stack", command, field);
  if (found === undefined) throw new Error(`no binding for ${command}.${field}`);
  return found;
}

function values(options: SelectOption[]): string[] {
  return options.map((option) => option.value);
}

function flags(options: SelectOption[]): Array<string | undefined> {
  return options.map((option) => option.flag);
}

function cascade(tree: DeviceTreeFixture, field: string, vals: Record<string, unknown> = {}) {
  return buildCascadeOptions(deepFreeze(tree), binding(field), deepFreeze({ ...vals }));
}

describe("buildCascadeOptions: golden tree", () => {
  it("offers device, deck and nest as plain names by position", () => {
    const devices = cascade(GOLDEN_TREE, "source_device");
    expect(values(devices.options)).toStrictEqual(["nest-1"]);
    expect(devices.parentBlank).toBe(false);

    const decks = cascade(GOLDEN_TREE, "source_deck", { source_device: "nest-1" });
    expect(values(decks.options)).toStrictEqual(["deck1"]);
    expect(decks.parentBlank).toBe(false);
    expect(decks.emptyNote).toBeUndefined();

    const nests = cascade(GOLDEN_TREE, "source_nest", {
      source_device: "nest-1",
      source_deck: "deck1",
    });
    expect(values(nests.options)).toStrictEqual(["A1"]);
    // never the unified "deck1,A1" form
    for (const option of [...devices.options, ...decks.options, ...nests.options]) {
      expect(option.value).not.toContain(",");
      expect(option.label).toBe(option.value);
      expect(option.flag).toBeUndefined();
    }
  });

  it("carries the plain names and the '/'-joined path key on each option", () => {
    const [device] = cascade(GOLDEN_TREE, "destination_device").options;
    expect(device.names).toStrictEqual({ deviceName: "nest-1" });
    expect(device.pathKey).toBe("nest-1");

    const [deck] = cascade(GOLDEN_TREE, "destination_deck", {
      destination_device: "nest-1",
    }).options;
    expect(deck.names).toStrictEqual({ deviceName: "nest-1", deckName: "deck1" });
    expect(deck.pathKey).toBe("nest-1/deck1");

    const [nest] = cascade(GOLDEN_TREE, "destination_nest", {
      destination_device: "nest-1",
      destination_deck: "deck1",
    }).options;
    expect(nest.names).toStrictEqual({
      deviceName: "nest-1",
      deckName: "deck1",
      nestName: "A1",
    });
    expect(nest.pathKey).toBe("nest-1/deck1/A1");
  });

  it("keys encode the side and the indices", () => {
    const source = cascade(GOLDEN_TREE, "source_nest", {
      source_device: "nest-1",
      source_deck: "deck1",
    }).options;
    const destination = cascade(GOLDEN_TREE, "destination_nest", {
      destination_device: "nest-1",
      destination_deck: "deck1",
    }).options;
    expect(source[0].key).not.toBe(destination[0].key);
    expect(source[0].key).toContain("source");
    expect(destination[0].key).toContain("destination");
  });

  it("reads only its own side: a source value never feeds the destination lists", () => {
    const decks = cascade(GOLDEN_TREE, "destination_deck", { source_device: "nest-1" });
    expect(decks.options).toStrictEqual([]);
    expect(decks.parentBlank).toBe(true);
  });

  it("compares exactly: no trim, no case-fold", () => {
    expect(cascade(GOLDEN_TREE, "source_deck", { source_device: "nest-1 " }).options).toStrictEqual(
      [],
    );
    expect(cascade(GOLDEN_TREE, "source_deck", { source_device: "NEST-1" }).options).toStrictEqual(
      [],
    );
    const spaced: DeviceTreeFixture = {
      devices: [{ deviceName: " sp ", decks: [] }],
      ambiguous: [],
    };
    expect(values(cascade(spaced, "source_device").options)).toStrictEqual([" sp "]);
  });
});

describe("buildCascadeOptions: ambiguity (flag, never hide, never pick)", () => {
  it("duplicate device names: both rows offered with distinct keys, both flagged", () => {
    const { options } = cascade(DUPLICATE_DEVICE_TREE, "source_device");
    expect(values(options)).toStrictEqual(["dev", "other", "dev"]);
    expect(flags(options)).toStrictEqual(["ambiguous", undefined, "ambiguous"]);
    expect(options[0].label).toBe("dev" + AMBIGUOUS_SUFFIX);
    expect(options[1].label).toBe("other");
    expect(new Set(options.map((option) => option.key)).size).toBe(3);
  });

  it("a duplicated device offers the decks of every same-named row in index order, all flagged", () => {
    const decks = cascade(DUPLICATE_DEVICE_TREE, "source_deck", { source_device: "dev" });
    expect(values(decks.options)).toStrictEqual(["deckA", "deckB"]);
    expect(flags(decks.options)).toStrictEqual(["ambiguous", "ambiguous"]);
    expect(new Set(decks.options.map((option) => option.key)).size).toBe(2);

    const nests = cascade(DUPLICATE_DEVICE_TREE, "source_nest", {
      source_device: "dev",
      source_deck: "deckA",
    });
    expect(values(nests.options)).toStrictEqual(["N1"]);
    expect(flags(nests.options)).toStrictEqual(["ambiguous"]);

    const other = cascade(DUPLICATE_DEVICE_TREE, "source_deck", { source_device: "other" });
    expect(flags(other.options)).toStrictEqual([undefined]);
  });

  it("duplicate deck inside one device: both decks flagged and every nest under them (deck-level propagation)", () => {
    const decks = cascade(DUPLICATE_DECK_TREE, "source_deck", { source_device: "dev" });
    expect(values(decks.options)).toStrictEqual(["deckA", "deckA", "deckC"]);
    expect(flags(decks.options)).toStrictEqual(["ambiguous", "ambiguous", undefined]);
    expect(new Set(decks.options.map((option) => option.key)).size).toBe(3);

    const nests = cascade(DUPLICATE_DECK_TREE, "source_nest", {
      source_device: "dev",
      source_deck: "deckA",
    });
    expect(values(nests.options)).toStrictEqual(["N1", "N2"]);
    expect(flags(nests.options)).toStrictEqual(["ambiguous", "ambiguous"]);

    const clean = cascade(DUPLICATE_DECK_TREE, "source_nest", {
      source_device: "dev",
      source_deck: "deckC",
    });
    expect(flags(clean.options)).toStrictEqual([undefined]);
  });

  it("duplicate nest inside one deck: only those nests flagged", () => {
    const decks = cascade(DUPLICATE_NEST_TREE, "source_deck", { source_device: "dev" });
    expect(flags(decks.options)).toStrictEqual([undefined]);
    const nests = cascade(DUPLICATE_NEST_TREE, "source_nest", {
      source_device: "dev",
      source_deck: "deckA",
    });
    expect(values(nests.options)).toStrictEqual(["N1", "N2", "N1"]);
    expect(flags(nests.options)).toStrictEqual(["ambiguous", undefined, "ambiguous"]);
    expect(new Set(nests.options.map((option) => option.key)).size).toBe(3);
  });

  it("the same nest name under two different decks is not flagged", () => {
    for (const deck of ["deckA", "deckB"]) {
      const nests = cascade(SAME_NEST_DIFFERENT_DECKS_TREE, "source_nest", {
        source_device: "dev",
        source_deck: deck,
      });
      expect(values(nests.options)).toStrictEqual(["N1"]);
      expect(flags(nests.options)).toStrictEqual([undefined]);
    }
  });

  it("'/' collisions are flagged by exact path membership plus prefix propagation", () => {
    const devices = cascade(SLASH_COLLISION_TREE, "source_device");
    expect(values(devices.options)).toStrictEqual(["a/b", "a"]);
    expect(flags(devices.options)).toStrictEqual([undefined, undefined]);

    const decksAB = cascade(SLASH_COLLISION_TREE, "source_deck", { source_device: "a/b" });
    expect(values(decksAB.options)).toStrictEqual(["c", "d"]);
    expect(decksAB.options.map((option) => option.pathKey)).toStrictEqual(["a/b/c", "a/b/d"]);
    expect(flags(decksAB.options)).toStrictEqual(["ambiguous", undefined]);

    const decksA = cascade(SLASH_COLLISION_TREE, "source_deck", { source_device: "a" });
    expect(values(decksA.options)).toStrictEqual(["b/c", "b"]);
    expect(flags(decksA.options)).toStrictEqual(["ambiguous", undefined]);

    // deck path "a/b/c" listed -> its nests flagged by prefix
    const nestsABC = cascade(SLASH_COLLISION_TREE, "source_nest", {
      source_device: "a/b",
      source_deck: "c",
    });
    expect(flags(nestsABC.options)).toStrictEqual(["ambiguous"]);
    const nestsABcDeck = cascade(SLASH_COLLISION_TREE, "source_nest", {
      source_device: "a",
      source_deck: "b/c",
    });
    expect(flags(nestsABcDeck.options)).toStrictEqual(["ambiguous"]);

    // nest path "a/b/c" (device a, deck b, nest c) is an exact member
    const nestsAB = cascade(SLASH_COLLISION_TREE, "source_nest", {
      source_device: "a",
      source_deck: "b",
    });
    expect(values(nestsAB.options)).toStrictEqual(["c", "e"]);
    expect(nestsAB.options.map((option) => option.pathKey)).toStrictEqual(["a/b/c", "a/b/e"]);
    expect(flags(nestsAB.options)).toStrictEqual(["ambiguous", undefined]);

    // nothing flagged is ever dropped
    const clean = cascade(SLASH_COLLISION_TREE, "source_nest", {
      source_device: "a/b",
      source_deck: "d",
    });
    expect(flags(clean.options)).toStrictEqual([undefined]);
  });

  it("an empty or absent ambiguous array flags nothing", () => {
    const empty: DeviceTreeFixture = { devices: DUPLICATE_DEVICE_TREE.devices, ambiguous: [] };
    expect(flags(cascade(empty, "source_device").options)).toStrictEqual([
      undefined,
      undefined,
      undefined,
    ]);
    const absent = { devices: DUPLICATE_DECK_TREE.devices } as unknown as DeviceTreeFixture;
    expect(flags(cascade(absent, "source_deck", { source_device: "dev" }).options)).toStrictEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("buildCascadeOptions: calibration (D-07) and empty notes", () => {
  it("uncalibrated decks and nests are never offered", () => {
    const decks = cascade(UNCALIBRATED_TREE, "source_deck", { source_device: "mixed" });
    expect(values(decks.options)).toStrictEqual(["calDeck"]);
    const nests = cascade(UNCALIBRATED_TREE, "source_nest", {
      source_device: "mixed",
      source_deck: "calDeck",
    });
    expect(values(nests.options)).toStrictEqual(["calNest"]);
    expect(nests.emptyNote).toBeUndefined();
  });

  it("a device with no calibrated decks is still offered and its deck list carries the note", () => {
    const devices = cascade(UNCALIBRATED_TREE, "source_device");
    expect(values(devices.options)).toStrictEqual(["mixed", "allUncal", "noCalNests"]);
    const decks = cascade(UNCALIBRATED_TREE, "source_deck", { source_device: "allUncal" });
    expect(decks.options).toStrictEqual([]);
    expect(decks.emptyNote).toBe(NO_CALIBRATED_DECKS);
    expect(decks.parentBlank).toBe(false);
  });

  it("a device with no decks shows the same note", () => {
    expect(values(cascade(EMPTY_DEVICE_TREE, "source_device").options)).toStrictEqual(["bare"]);
    const decks = cascade(EMPTY_DEVICE_TREE, "source_deck", { source_device: "bare" });
    expect(decks.options).toStrictEqual([]);
    expect(decks.emptyNote).toBe(NO_CALIBRATED_DECKS);
  });

  it("a calibrated deck with no calibrated nests gives the nest note", () => {
    const nests = cascade(UNCALIBRATED_TREE, "source_nest", {
      source_device: "noCalNests",
      source_deck: "d1",
    });
    expect(nests.options).toStrictEqual([]);
    expect(nests.emptyNote).toBe(NO_CALIBRATED_NESTS);
  });

  it("a parent value not in the tree gives an empty list with no note", () => {
    const decks = cascade(UNCALIBRATED_TREE, "source_deck", { source_device: "ghost" });
    expect(decks.options).toStrictEqual([]);
    expect(decks.emptyNote).toBeUndefined();
    expect(decks.parentBlank).toBe(false);

    // an uncalibrated deck is not a matching parent either
    const nests = cascade(UNCALIBRATED_TREE, "source_nest", {
      source_device: "mixed",
      source_deck: "uncalDeck",
    });
    expect(nests.options).toStrictEqual([]);
    expect(nests.emptyNote).toBeUndefined();
  });
});

describe("buildCascadeOptions: blank parents", () => {
  it("a blank device gives parentBlank for decks", () => {
    for (const blank of ["", undefined, null]) {
      const decks = cascade(GOLDEN_TREE, "source_deck", { source_device: blank });
      expect(decks.parentBlank).toBe(true);
      expect(decks.options).toStrictEqual([]);
      expect(decks.emptyNote).toBeUndefined();
    }
  });

  it("a blank deck gives parentBlank for nests", () => {
    for (const blank of ["", undefined, null]) {
      const nests = cascade(GOLDEN_TREE, "source_nest", {
        source_device: "nest-1",
        source_deck: blank,
      });
      expect(nests.parentBlank).toBe(true);
      expect(nests.options).toStrictEqual([]);
    }
  });

  it("the device level never has a blank parent", () => {
    expect(cascade(GOLDEN_TREE, "source_device").parentBlank).toBe(false);
  });
});

describe("applyChange (D-09): the only patch producer", () => {
  it("a device change clears the same side's deck and nest to blank", () => {
    expect(applyChange(deepFreeze(binding("source_device")), "X")).toStrictEqual({
      source_device: "X",
      source_deck: "",
      source_nest: "",
    });
    expect(applyChange(deepFreeze(binding("destination_device")), "Y")).toStrictEqual({
      destination_device: "Y",
      destination_deck: "",
      destination_nest: "",
    });
  });

  it("a deck change clears only the nest", () => {
    expect(applyChange(binding("source_deck"), "D")).toStrictEqual({
      source_deck: "D",
      source_nest: "",
    });
    expect(applyChange(binding("destination_deck"), "D")).toStrictEqual({
      destination_deck: "D",
      destination_nest: "",
    });
  });

  it("a nest or list change returns only that field", () => {
    expect(applyChange(binding("source_nest"), "N")).toStrictEqual({ source_nest: "N" });
    expect(applyChange(binding("robot"), "R")).toStrictEqual({ robot: "R" });
    expect(applyChange(binding("labware_profile"), "Default")).toStrictEqual({
      labware_profile: "Default",
    });
    expect(applyChange(binding("source_transfer_profile"), "P")).toStrictEqual({
      source_transfer_profile: "P",
    });
    expect(applyChange(binding("robot", "get_labware_presence"), "R")).toStrictEqual({
      robot: "R",
    });
  });

  it("source and destination never touch each other", () => {
    for (const level of ["device", "deck", "nest"]) {
      const sourceKeys = Object.keys(applyChange(binding(`source_${level}`), "v"));
      const destinationKeys = Object.keys(applyChange(binding(`destination_${level}`), "v"));
      expect(sourceKeys.every((key) => key.startsWith("source_"))).toBe(true);
      expect(destinationKeys.every((key) => key.startsWith("destination_"))).toBe(true);
    }
  });

  it("keeps the chosen value exactly and returns a new object each time", () => {
    const b = binding("source_device");
    const first = applyChange(b, " Dev ");
    expect(first.source_device).toBe(" Dev ");
    expect(applyChange(b, " Dev ")).not.toBe(first);
    // choosing blank still clears the children to blank, never to a first child
    expect(applyChange(b, "")).toStrictEqual({
      source_device: "",
      source_deck: "",
      source_nest: "",
    });
  });
});

// ---------------------------------------------------------------------------
// Task 2: the full view model (D-11, D-13), status line, binding coverage,
// hydrate+refresh and round-trip proofs (DRP-02, DRP-05, D-15).

const FETCHED_AT = new Date(2026, 10, 6, 9, 5, 7).getTime(); // local 09:05:07

function listResult(source: OptionSourceId, names: string[], degraded = false): OptionsResult {
  return { status: "ok", source, shape: "list", names, degraded, fetchedAt: FETCHED_AT };
}

function treeResult(tree: DeviceTreeFixture, degraded = false): OptionsResult {
  return {
    status: "ok",
    source: "stack.devices",
    shape: "tree",
    devices: tree.devices,
    ambiguous: tree.ambiguous,
    degraded,
    fetchedAt: FETCHED_AT,
  };
}

function fieldView(
  field: string,
  value: unknown,
  vals: Record<string, unknown>,
  data: OptionsResult | undefined,
  opts: { mode?: OptionsMode; allowVariables?: boolean; command?: string } = {},
): SelectView {
  return buildFieldView({
    binding: binding(field, opts.command),
    value,
    values: deepFreeze({ ...vals }),
    mode: opts.mode ?? "ok",
    data: data === undefined ? undefined : deepFreeze(data),
    allowVariables: opts.allowVariables ?? false,
  });
}

const BLANK_OPTION: SelectOption = { key: "empty", value: "", label: "" };

function notReported(options: SelectOption[]): SelectOption[] {
  return options.filter((option) => option.flag === "not-reported");
}

describe("copy constants", () => {
  it("pins the UI-SPEC copy", () => {
    expect(VARIABLE_PARENT_HINT).toBe("child list unavailable while the parent is a variable");
    expect(DEGRADED_SUFFIX).toBe(" · some entries skipped");
    expect(REFRESH_LABEL).toBe("Refresh");
    expect(REFRESHING_LABEL).toBe("Refreshing…");
    expect(AMBIGUOUS_SUFFIX).toBe(" (ambiguous — adapter will refuse)");
    expect(NO_CALIBRATED_DECKS).toBe("No calibrated decks on this device");
    expect(NO_CALIBRATED_NESTS).toBe("No calibrated nests on this deck");
    expect(SOURCE_LABELS).toStrictEqual({
      "stack.robots": "robots",
      "stack.devices": "devices",
      "stack.labwareProfiles": "labware profiles",
      "stack.transferProfiles": "transfer profiles",
    });
  });
});

describe("formatStatusLine", () => {
  it("reads 0 items, 1 item and N items with the zero-padded local 24-hour fetch time", () => {
    expect(formatStatusLine(listResult("stack.robots", []))).toBe(
      "from instrument · 0 items · fetched 09:05:07",
    );
    expect(formatStatusLine(listResult("stack.robots", ["r1"]))).toBe(
      "from instrument · 1 item · fetched 09:05:07",
    );
    expect(formatStatusLine(listResult("stack.robots", ["r1", "r2"]))).toBe(
      "from instrument · 2 items · fetched 09:05:07",
    );
    const afternoon = {
      ...listResult("stack.labwareProfiles", ["a"]),
      fetchedAt: new Date(2026, 10, 6, 14, 2, 11).getTime(),
    };
    expect(formatStatusLine(afternoon)).toBe("from instrument · 1 item · fetched 14:02:11");
  });

  it("counts devices for a tree and appends the degraded suffix", () => {
    expect(formatStatusLine(treeResult(DUPLICATE_DEVICE_TREE))).toBe(
      "from instrument · 3 items · fetched 09:05:07",
    );
    expect(formatStatusLine(listResult("stack.robots", ["r1"], true))).toBe(
      "from instrument · 1 item · fetched 09:05:07 · some entries skipped",
    );
    expect(formatStatusLine(treeResult(GOLDEN_TREE, true))).toBe(
      "from instrument · 1 item · fetched 09:05:07 · some entries skipped",
    );
  });

  it("is empty unless the result is ok", () => {
    expect(
      formatStatusLine({ status: "unavailable", source: "stack.robots", reason: "timeout" }),
    ).toBe("");
  });
});

describe("buildFieldView: ok lists (E1, D-11)", () => {
  it("a validated empty list is ok with only the blank option, never unavailable", () => {
    const view = fieldView("robot", "", {}, listResult("stack.robots", []));
    expect(view.mode).toBe("ok");
    expect(view.options).toStrictEqual([BLANK_OPTION]);
    expect(view.disabled).toBe(false);
    expect(view.hint).toBeUndefined();
  });

  it("a one-option list still starts on the blank option; nothing is preselected", () => {
    const view = fieldView("robot", "", {}, listResult("stack.robots", ["stack2-6"]));
    expect(view.mode).toBe("ok");
    expect(view.value).toBe("");
    expect(view.options.map((option) => option.value)).toStrictEqual(["", "stack2-6"]);
    for (const option of view.options) {
      expect(Object.keys(option).sort()).toStrictEqual(["key", "label", "value"]);
    }
  });

  it("keeps reported order and duplicates, never sorting or deduplicating", () => {
    const view = fieldView(
      "labware_profile",
      "",
      {},
      listResult("stack.labwareProfiles", ["b", "a", "b"]),
    );
    expect(view.options.map((option) => option.value)).toStrictEqual(["", "b", "a", "b"]);
    expect(new Set(view.options.map((option) => option.key)).size).toBe(4);
  });

  it("an exact-string mismatch (trailing space) gets its own not-reported option, selected", () => {
    const view = fieldView(
      "labware_profile",
      "Default ",
      {},
      listResult("stack.labwareProfiles", ["Default"]),
    );
    expect(view.value).toBe("Default ");
    expect(view.options.map((option) => option.value)).toStrictEqual(["", "Default", "Default "]);
    const [extra] = notReported(view.options);
    expect(extra.label).toBe("Default  (not reported by instrument)");
    expect(extra.label).toBe("Default " + NOT_REPORTED_SUFFIX);
    expect(view.options[1].flag).toBeUndefined();
  });

  it("blank values never show the not-reported flag; loading and unavailable never flag", () => {
    for (const blank of ["", undefined, null]) {
      const view = fieldView("robot", blank, {}, listResult("stack.robots", ["r1"]));
      expect(view.value).toBe("");
      expect(notReported(view.options)).toStrictEqual([]);
    }
    const loading = fieldView("robot", "R9", {}, undefined, { mode: "loading" });
    expect(loading.mode).toBe("loading");
    expect(loading.disabled).toBe(true);
    expect(loading.options[0].label).toBe(LOADING_LABEL);
    expect(notReported(loading.options)).toStrictEqual([]);
    const unavailable = fieldView(
      "robot",
      "R9",
      {},
      { status: "unavailable", source: "stack.robots", reason: "timeout" },
      { mode: "unavailable" },
    );
    expect(unavailable).toStrictEqual({
      mode: "unavailable",
      value: "R9",
      options: [],
      disabled: false,
      hint: UNAVAILABLE_HINT,
    });
  });

  it("deriveOptionsMode: isError beats stale ok data, and a later success is ok again", () => {
    const stale = listResult("stack.robots", ["r1"]);
    expect(deriveOptionsMode({ isError: true, isInitialLoading: false, data: stale })).toBe(
      "unavailable",
    );
    expect(deriveOptionsMode({ isError: false, isInitialLoading: false, data: stale })).toBe("ok");
  });

  it("an ok mode whose data does not fit the binding falls back to the typed input", () => {
    expect(fieldView("robot", "r1", {}, treeResult(GOLDEN_TREE)).mode).toBe("unavailable");
    expect(fieldView("source_device", "x", {}, listResult("stack.robots", ["x"])).mode).toBe(
      "unavailable",
    );
    expect(fieldView("robot", "r1", {}, undefined).mode).toBe("unavailable");
  });
});

describe("buildFieldView: cascade views", () => {
  it("renders the cascade options with the empty-list note in ok mode", () => {
    const decks = fieldView(
      "source_deck",
      "",
      { source_device: "allUncal" },
      treeResult(UNCALIBRATED_TREE),
    );
    expect(decks.mode).toBe("ok");
    expect(decks.disabled).toBe(false);
    expect(decks.options).toStrictEqual([BLANK_OPTION]);
    expect(decks.note).toBe(NO_CALIBRATED_DECKS);

    const nests = fieldView(
      "source_nest",
      "",
      { source_device: "noCalNests", source_deck: "d1" },
      treeResult(UNCALIBRATED_TREE),
    );
    expect(nests.note).toBe(NO_CALIBRATED_NESTS);

    const flagged = fieldView("source_device", "", {}, treeResult(DUPLICATE_DEVICE_TREE));
    expect(flagged.options.map((option) => option.label)).toStrictEqual([
      "",
      "dev" + AMBIGUOUS_SUFFIX,
      "other",
      "dev" + AMBIGUOUS_SUFFIX,
    ]);
  });

  it("a blank parent with a blank child is disabled with only the blank option", () => {
    const view = fieldView("source_deck", "", { source_device: "" }, treeResult(GOLDEN_TREE));
    expect(view).toStrictEqual({ mode: "ok", value: "", options: [BLANK_OPTION], disabled: true });
    const nest = fieldView(
      "source_nest",
      undefined,
      { source_device: "nest-1", source_deck: "" },
      treeResult(GOLDEN_TREE),
    );
    expect(nest.disabled).toBe(true);
  });

  it("a blank parent with a non-blank child stays enabled, keeps the value and flags it", () => {
    const view = fieldView(
      "source_deck",
      "deck1",
      { source_device: "", source_deck: "deck1" },
      treeResult(GOLDEN_TREE),
    );
    expect(view.disabled).toBe(false);
    expect(view.value).toBe("deck1");
    expect(notReported(view.options).map((option) => option.value)).toStrictEqual(["deck1"]);
  });

  it("a saved uncalibrated deck stays selected, marked not reported", () => {
    const view = fieldView(
      "source_deck",
      "uncalDeck",
      { source_device: "mixed", source_deck: "uncalDeck" },
      treeResult(UNCALIBRATED_TREE),
    );
    expect(view.value).toBe("uncalDeck");
    expect(view.options.map((option) => option.value)).toStrictEqual(["", "calDeck", "uncalDeck"]);
    expect(notReported(view.options)[0].label).toBe("uncalDeck" + NOT_REPORTED_SUFFIX);
  });
});

describe("buildFieldView: variable modes (D-13)", () => {
  it("a {{var}} value is variable-bound when variables are allowed", () => {
    const view = fieldView("robot", "{{plate}}", {}, listResult("stack.robots", ["r1"]), {
      allowVariables: true,
    });
    expect(view.mode).toBe("variable-bound");
    expect(view.disabled).toBe(true);
    expect(view.value).toBe("{{plate}}");
    expect(view.options.map((option) => option.value)).toStrictEqual(["{{plate}}"]);
    expect(view.options[0].label).toBe("{{plate}}");
    expect(view.options[0].flag).toBeUndefined();
  });

  it("variable-bound applies in loading and unavailable too", () => {
    for (const mode of ["loading", "unavailable"] as const) {
      const view = fieldView("robot", "{{plate}}", {}, undefined, { mode, allowVariables: true });
      expect(view.mode).toBe("variable-bound");
    }
  });

  it("'{{plate' and 'plate}}' are plain values", () => {
    for (const value of ["{{plate", "plate}}"]) {
      const view = fieldView("robot", value, {}, listResult("stack.robots", ["r1"]), {
        allowVariables: true,
      });
      expect(view.mode).toBe("ok");
      expect(notReported(view.options).map((option) => option.value)).toStrictEqual([value]);
    }
  });

  it("children of a variable-bound device are typed inputs with the hint; a variable child wins", () => {
    const vals = { source_device: "{{dev}}", source_deck: "deck1", source_nest: "{{n}}" };
    const deck = fieldView("source_deck", "deck1", vals, treeResult(GOLDEN_TREE), {
      allowVariables: true,
    });
    expect(deck).toStrictEqual({
      mode: "child-of-variable",
      value: "deck1",
      options: [],
      disabled: false,
      hint: VARIABLE_PARENT_HINT,
    });
    const nest = fieldView("source_nest", "{{n}}", vals, treeResult(GOLDEN_TREE), {
      allowVariables: true,
    });
    expect(nest.mode).toBe("variable-bound");

    // the other side is untouched by this side's variable
    const destination = fieldView("destination_deck", "", vals, treeResult(GOLDEN_TREE), {
      allowVariables: true,
    });
    expect(destination.mode).toBe("ok");
  });

  it("a variable-bound deck makes its nest a child-of-variable", () => {
    const vals = { source_device: "nest-1", source_deck: "{{deck}}", source_nest: "" };
    const nest = fieldView("source_nest", "", vals, treeResult(GOLDEN_TREE), {
      allowVariables: true,
    });
    expect(nest.mode).toBe("child-of-variable");
    expect(nest.hint).toBe(VARIABLE_PARENT_HINT);
  });

  it("with variables not allowed (tool page) neither variable mode occurs", () => {
    const vals = { source_device: "{{dev}}", source_deck: "{{deck}}" };
    const device = fieldView("source_device", "{{dev}}", vals, treeResult(GOLDEN_TREE));
    const deck = fieldView("source_deck", "{{deck}}", vals, treeResult(GOLDEN_TREE));
    const nest = fieldView("source_nest", "", vals, treeResult(GOLDEN_TREE));
    for (const view of [device, deck, nest]) {
      expect(view.mode).toBe("ok");
    }
  });

  it("cascadeAncestorBound checks only the same side's ancestors", () => {
    expect(cascadeAncestorBound(binding("source_device"), { source_device: "{{d}}" })).toBe(false);
    expect(cascadeAncestorBound(binding("source_deck"), { source_device: "{{d}}" })).toBe(true);
    expect(cascadeAncestorBound(binding("source_deck"), { destination_device: "{{d}}" })).toBe(
      false,
    );
    expect(cascadeAncestorBound(binding("source_nest"), { source_deck: "{{k}}" })).toBe(true);
    expect(cascadeAncestorBound(binding("source_nest"), { source_device: "{{d}}" })).toBe(true);
    expect(cascadeAncestorBound(binding("source_nest"), { source_device: "{{d" })).toBe(false);
    expect(cascadeAncestorBound(binding("robot"), { source_device: "{{d}}" })).toBe(false);
  });
});

describe("buildSelectView keeps the 06-01 behaviour when the new inputs are omitted", () => {
  it("ok, loading and unavailable views are unchanged", () => {
    const offered: SelectOption[] = [{ key: "0", value: "a", label: "a" }];
    expect(buildSelectView({ mode: "ok", value: "b", offered })).toStrictEqual({
      mode: "ok",
      value: "b",
      options: [
        BLANK_OPTION,
        offered[0],
        { key: "not-reported", value: "b", label: "b" + NOT_REPORTED_SUFFIX, flag: "not-reported" },
      ],
      disabled: false,
    });
    expect(buildSelectView({ mode: "ok", value: "{{x}}", offered }).mode).toBe("ok");
    expect(buildSelectView({ mode: "loading", value: "a", offered })).toStrictEqual({
      mode: "loading",
      value: "a",
      options: [
        { key: "loading", value: "", label: LOADING_LABEL },
        { key: "saved", value: "a", label: "a" },
      ],
      disabled: true,
    });
  });
});

describe("hydrate + refresh never changes a saved step (DRP-02, DRP-05, D-09)", () => {
  const SAVED: Record<string, unknown> = {
    step_key: "s1",
    robot: "R9",
    labware_profile: "Default",
    source_device: "gone",
    source_deck: "deck1",
    source_nest: "",
    source_transfer_profile: "Default",
    destination_device: "nest-1",
    destination_deck: "deck1",
    destination_nest: undefined,
    destination_transfer_profile: "",
    timeout_s: 30,
  };

  const GOLDEN_DATA: Record<OptionSourceId, OptionsResult> = {
    "stack.robots": listResult("stack.robots", ["stack2-6"]),
    "stack.labwareProfiles": listResult("stack.labwareProfiles", ["Default"]),
    "stack.transferProfiles": listResult("stack.transferProfiles", ["Default"]),
    "stack.devices": treeResult(GOLDEN_TREE),
  };
  const REFRESHED_DATA: Record<OptionSourceId, OptionsResult> = {
    "stack.robots": listResult("stack.robots", ["stack2-7"]),
    "stack.labwareProfiles": listResult("stack.labwareProfiles", ["Other"]),
    "stack.transferProfiles": listResult("stack.transferProfiles", ["Fast"]),
    "stack.devices": treeResult(REFRESHED_TREE),
  };
  const EMPTY_DATA: Record<OptionSourceId, OptionsResult> = {
    "stack.robots": listResult("stack.robots", []),
    "stack.labwareProfiles": listResult("stack.labwareProfiles", []),
    "stack.transferProfiles": listResult("stack.transferProfiles", []),
    "stack.devices": treeResult(NO_DEVICES_TREE),
  };

  const VIEW_KEYS = new Set(["mode", "value", "options", "disabled", "hint", "note"]);

  function renderAll(saved: Record<string, unknown>, data: Record<OptionSourceId, OptionsResult>) {
    const out: Record<string, SelectView> = {};
    for (const field of commandFields.stack.transfer) {
      const b = lookupFieldBinding("stack", "transfer", field.name);
      if (b === undefined) continue;
      out[field.name] = buildFieldView({
        binding: b,
        value: saved[field.name],
        values: saved,
        mode: "ok",
        data: data[b.source],
        allowVariables: true,
      });
    }
    return out;
  }

  function flaggedFields(views: Record<string, SelectView>): string[] {
    return Object.keys(views)
      .filter((field) => notReported(views[field].options).length > 0)
      .sort();
  }

  it("loads, refreshes to different contents and refreshes to empty without touching a value", () => {
    const saved = deepFreeze({ ...SAVED });
    const snapshot = { ...SAVED };

    const golden = renderAll(saved, GOLDEN_DATA);
    const refreshed = renderAll(saved, REFRESHED_DATA);
    const empty = renderAll(saved, EMPTY_DATA);

    for (const views of [golden, refreshed, empty]) {
      expect(Object.keys(views).length).toBe(10);
      for (const [field, view] of Object.entries(views)) {
        const savedValue = saved[field];
        const expected = savedValue === undefined || savedValue === "" ? "" : String(savedValue);
        expect(view.value).toBe(expected);
        // a view only, never a patch
        for (const key of Object.keys(view)) expect(VIEW_KEYS.has(key)).toBe(true);
      }
    }

    expect(flaggedFields(golden)).toStrictEqual(["robot", "source_deck", "source_device"]);
    const allNonBlank = [
      "destination_deck",
      "destination_device",
      "labware_profile",
      "robot",
      "source_deck",
      "source_device",
      "source_transfer_profile",
    ];
    expect(flaggedFields(refreshed)).toStrictEqual(allNonBlank);
    expect(flaggedFields(empty)).toStrictEqual(allNonBlank);

    // blank fields stay blank and unflagged; the empty refresh shows "0 items"
    expect(empty.source_nest.value).toBe("");
    expect(empty.destination_nest.value).toBe("");
    expect(formatStatusLine(EMPTY_DATA["stack.robots"])).toContain("· 0 items ·");

    expect(saved).toStrictEqual(snapshot);
  });

  it("saving with no operator change round-trips the params exactly", () => {
    const saved = deepFreeze({ ...SAVED });
    renderAll(saved, GOLDEN_DATA);
    const edits: Record<string, unknown> = {};
    expect({ ...saved, ...edits }).toStrictEqual(SAVED);
  });
});

describe("binding coverage (STK-07, D-10)", () => {
  const BOUND_COMMANDS = ["get_labware_presence", "get_transfer_estimate", "transfer"];

  it("binds only transfer, get_transfer_estimate and get_labware_presence", () => {
    expect(Object.keys(FIELD_BINDINGS)).toStrictEqual(["stack"]);
    expect(Object.keys(FIELD_BINDINGS.stack).sort()).toStrictEqual(BOUND_COMMANDS);
    expect(Object.keys(FIELD_BINDINGS.stack.get_labware_presence)).toStrictEqual(["robot"]);
  });

  it("every bound field exists in commandFields.stack for its command as a text field", () => {
    for (const command of BOUND_COMMANDS) {
      const fields = commandFields.stack[command];
      for (const [name, b] of Object.entries(FIELD_BINDINGS.stack[command])) {
        expect(b.field).toBe(name);
        const field = fields.find((candidate) => candidate.name === name);
        expect(field?.type).toBe("text");
      }
    }
  });

  it("step_key, timeout_s, refresh and every list_*/get_* tool-page field stay typed", () => {
    for (const [command, fields] of Object.entries(commandFields.stack)) {
      for (const field of fields) {
        const b = lookupFieldBinding("stack", command, field.name);
        if (["step_key", "timeout_s", "refresh"].includes(field.name)) {
          expect(b).toBeUndefined();
        }
        if (!BOUND_COMMANDS.includes(command)) expect(b).toBeUndefined();
      }
    }
  });

  it("firstFieldForSource follows the form's field order", () => {
    const transferFields = commandFields.stack.transfer.map((field) => field.name);
    expect(firstFieldForSource(transferFields, "stack", "transfer", "stack.robots")).toBe("robot");
    expect(firstFieldForSource(transferFields, "stack", "transfer", "stack.labwareProfiles")).toBe(
      "labware_profile",
    );
    expect(firstFieldForSource(transferFields, "stack", "transfer", "stack.devices")).toBe(
      "source_device",
    );
    expect(firstFieldForSource(transferFields, "stack", "transfer", "stack.transferProfiles")).toBe(
      "source_transfer_profile",
    );
    expect(firstFieldForSource(["robot"], "stack", "get_labware_presence", "stack.robots")).toBe(
      "robot",
    );
    expect(
      firstFieldForSource(["robot"], "stack", "get_labware_presence", "stack.devices"),
    ).toBeUndefined();
    expect(firstFieldForSource(transferFields, "stack", undefined, "stack.robots")).toBeUndefined();
  });
});
