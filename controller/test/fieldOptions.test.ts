// React-free cascade core (06-03): device -> deck -> nest by position, the
// calibration filter (D-07), ambiguity flags with device- and deck-level prefix
// propagation (D-08), and applyChange as the only patch producer (D-09).
// Fixtures only; nothing here talks to an instrument.
import { describe, it, expect } from "vitest";
import {
  AMBIGUOUS_SUFFIX,
  NO_CALIBRATED_DECKS,
  NO_CALIBRATED_NESTS,
  applyChange,
  buildCascadeOptions,
  lookupFieldBinding,
} from "@/components/tools/fieldOptions";
import type { FieldBinding, SelectOption } from "@/components/tools/fieldOptions";
import {
  DUPLICATE_DECK_TREE,
  DUPLICATE_DEVICE_TREE,
  DUPLICATE_NEST_TREE,
  EMPTY_DEVICE_TREE,
  GOLDEN_TREE,
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
