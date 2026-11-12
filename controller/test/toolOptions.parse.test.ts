// Parser and cap boundary tests for the tool.options read path (06-02 Task 1,
// D-03, DRP-07, T-06-05, T-06-09). Calls the exported parsers directly; reply
// literals come from test/fixtures/stackOptions.ts (copied golden values).
import { describe, it, expect } from "vitest";
import {
  MAX_LIST_ITEMS,
  MAX_NAME_LENGTH,
  MAX_PLATES,
  MAX_PLATE_COLS,
  MAX_PLATE_DESCRIPTION_LENGTH,
  MAX_PLATE_ROWS,
  MAX_TREE_NODES,
  parseDeviceTree,
  parsePlates,
  parseProfiles,
  parseRobotStates,
  type OptionsResult,
  type PlateEntry,
} from "@/server/toolOptions";
import { buildSelectView, listOptions } from "@/components/tools/fieldOptions";
import {
  DEVICE_TREE_GOLDEN,
  DEVICE_TREE_NULL_MARKERS,
  LABWARE_PROFILES_GOLDEN,
  READ_FAILED_GOLDEN,
  ROBOT_STATES_DUPLICATES,
  ROBOT_STATES_GOLDEN,
  TRANSFER_PROFILES_GOLDEN,
  deviceTreeWithNodeCount,
  deviceTreeWithShape,
  profilesWithCount,
  robotStatesOf,
  robotStatesWithCount,
} from "./fixtures/stackOptions";
import {
  FAST_PLATES_GOLDEN,
  PLATES_FRACTIONAL_ID,
  platesWith,
  platesWithCount,
  platesWithDescriptionLength,
  platesWithInheritedKeys,
  platesWithoutGeometry,
  platesWithoutId,
} from "./fixtures/fastPlates";

describe("cap constants (A1 discretion values)", () => {
  it("pins MAX_LIST_ITEMS = 1000, MAX_TREE_NODES = 10000, MAX_NAME_LENGTH = 256", () => {
    expect(MAX_LIST_ITEMS).toBe(1000);
    expect(MAX_TREE_NODES).toBe(10000);
    expect(MAX_NAME_LENGTH).toBe(256);
  });
});

describe("list caps (MAX_LIST_ITEMS)", () => {
  it("robots: 1000 items parse ok, 1001 items are too_large", () => {
    const atCap = parseRobotStates(robotStatesWithCount(1000));
    expect(atCap).toMatchObject({ shape: "list", degraded: false });
    expect((atCap as { names: string[] }).names).toHaveLength(1000);

    expect(parseRobotStates(robotStatesWithCount(1001))).toBe("too_large");
  });

  it("labware profiles: 1000 ok, 1001 too_large", () => {
    const atCap = parseProfiles(profilesWithCount("labwareProfiles", 1000), "labwareProfiles");
    expect((atCap as { names: string[] }).names).toHaveLength(1000);
    expect(parseProfiles(profilesWithCount("labwareProfiles", 1001), "labwareProfiles")).toBe(
      "too_large",
    );
  });

  it("transfer profiles: 1000 ok, 1001 too_large", () => {
    const atCap = parseProfiles(profilesWithCount("transferProfiles", 1000), "transferProfiles");
    expect((atCap as { names: string[] }).names).toHaveLength(1000);
    expect(parseProfiles(profilesWithCount("transferProfiles", 1001), "transferProfiles")).toBe(
      "too_large",
    );
  });

  it("devices array: 1000 devices ok, 1001 devices too_large", () => {
    const atCap = parseDeviceTree(deviceTreeWithShape(1000, 0));
    expect((atCap as { devices: unknown[] }).devices).toHaveLength(1000);
    expect(parseDeviceTree(deviceTreeWithShape(1001, 0))).toBe("too_large");
  });
});

describe("tree node cap (MAX_TREE_NODES over devices + decks + nests)", () => {
  it("exactly 10000 nodes parse ok", () => {
    const parsed = parseDeviceTree(deviceTreeWithNodeCount(10000));
    expect(parsed).toMatchObject({ shape: "tree", degraded: false });
    const devices = (parsed as { devices: { decks: { nests: unknown[] }[] }[] }).devices;
    expect(devices).toHaveLength(1);
    expect(devices[0].decks[0].nests).toHaveLength(9998);
  });

  it("10001 nodes are too_large, never truncated", () => {
    expect(parseDeviceTree(deviceTreeWithNodeCount(10001))).toBe("too_large");
  });

  it("counts decks and nests across many devices (1000 devices x 10 nests = 12000 nodes)", () => {
    expect(parseDeviceTree(deviceTreeWithShape(1000, 10))).toBe("too_large");
  });

  it("an ambiguous array of 10000 strings is carried; 10001 is too_large", () => {
    const tree = deviceTreeWithShape(1, 1);
    const atCap = parseDeviceTree({ ...tree, ambiguous: new Array(10000).fill("a,b") });
    expect((atCap as { ambiguous: string[] }).ambiguous).toHaveLength(10000);
    expect(parseDeviceTree({ ...tree, ambiguous: new Array(10001).fill("a,b") })).toBe("too_large");
  });

  it("an over-long ambiguous string is carried verbatim", () => {
    const long = "x".repeat(MAX_NAME_LENGTH + 10);
    const parsed = parseDeviceTree({ ...deviceTreeWithShape(1, 1), ambiguous: [long] });
    expect((parsed as { ambiguous: string[] }).ambiguous).toStrictEqual([long]);
  });
});

describe("name rules (D-03: dropped, never sliced)", () => {
  it("a 256-character name is kept verbatim", () => {
    const name = "r".repeat(256);
    expect(parseRobotStates(robotStatesOf([name]))).toStrictEqual({
      shape: "list",
      names: [name],
      degraded: false,
    });
  });

  it("a 257-character name is dropped and the list degraded", () => {
    expect(parseRobotStates(robotStatesOf(["r".repeat(257), "ok"]))).toStrictEqual({
      shape: "list",
      names: ["ok"],
      degraded: true,
    });
  });

  it("a 1 MB name is dropped, never truncated", () => {
    const parsed = parseRobotStates(robotStatesOf(["x".repeat(1024 * 1024)]));
    expect(parsed).toStrictEqual({ shape: "list", names: [], degraded: true });
  });

  it("over-long names in the device tree are dropped at every level", () => {
    const long = "d".repeat(257);
    const parsed = parseDeviceTree({
      kind: "deviceTree",
      devices: [
        { deviceName: long, decks: [] },
        {
          deviceName: "dev",
          decks: [
            { deckName: long, nests: [] },
            { deckName: "deck", nests: [{ nestName: long }, { nestName: "A1" }] },
          ],
        },
      ],
    });
    expect(parsed).toStrictEqual({
      shape: "tree",
      degraded: true,
      ambiguous: [],
      devices: [
        {
          deviceName: "dev",
          decks: [
            {
              deckName: "deck",
              isCalibrated: false,
              nests: [{ nestName: "A1", isCalibrated: false }],
            },
          ],
        },
      ],
    });
  });

  it("an over-long profile name is dropped and the list degraded", () => {
    expect(
      parseProfiles(
        { kind: "labwareProfiles", profiles: [{ name: "p".repeat(300) }, { name: "Default" }] },
        "labwareProfiles",
      ),
    ).toStrictEqual({ shape: "list", names: ["Default"], degraded: true });
  });

  it("leading and trailing spaces are kept as sent; whitespace-only is dropped", () => {
    expect(parseRobotStates(robotStatesOf([" r1 ", " \t "]))).toStrictEqual({
      shape: "list",
      names: [" r1 "],
      degraded: true,
    });
  });

  it("{{x}} and ' {{x}} ' are dropped; '{{x' and 'x}}' are kept", () => {
    expect(parseRobotStates(robotStatesOf(["{{x}}", " {{x}} ", "{{x", "x}}"]))).toStrictEqual({
      shape: "list",
      names: ["{{x", "x}}"],
      degraded: true,
    });
  });

  it("duplicate names are carried as sent", () => {
    expect(parseRobotStates(ROBOT_STATES_DUPLICATES)).toStrictEqual({
      shape: "list",
      names: ["stack2-6", "stack2-6"],
      degraded: false,
    });
  });
});

describe("unknown keys and prototype keys (T-06-09)", () => {
  it("null markers and unknown extra keys are ignored without degrading", () => {
    expect(parseDeviceTree(DEVICE_TREE_NULL_MARKERS)).toStrictEqual({
      shape: "tree",
      degraded: false,
      ambiguous: [],
      devices: [
        {
          deviceName: "nest-1",
          decks: [
            {
              deckName: "deck1",
              isCalibrated: true,
              nests: [{ nestName: "A1", isCalibrated: false }],
            },
          ],
        },
      ],
    });
  });

  it("__proto__ and constructor keys change nothing and add no fields", () => {
    const listReply = JSON.parse(
      '{"kind":"robotStates","__proto__":{"polluted":true},"constructor":{"x":1},' +
        '"robots":[{"robotName":"r1","__proto__":{"polluted":true},"constructor":"c"}]}',
    );
    expect(parseRobotStates(listReply)).toStrictEqual({
      shape: "list",
      names: ["r1"],
      degraded: false,
    });

    const treeReply = JSON.parse(
      '{"kind":"deviceTree","__proto__":{"polluted":true},"devices":[' +
        '{"deviceName":"d","__proto__":{"polluted":true},"constructor":1,"decks":[' +
        '{"deckName":"k","__proto__":{"isCalibrated":true},"nests":[' +
        '{"nestName":"n","__proto__":{"isCalibrated":true},"constructor":"c"}]}]}]}',
    );
    const parsed = parseDeviceTree(treeReply) as {
      devices: { decks: { nests: object[] }[] }[];
    };
    expect(parsed).toStrictEqual({
      shape: "tree",
      degraded: false,
      ambiguous: [],
      devices: [
        {
          deviceName: "d",
          decks: [
            { deckName: "k", isCalibrated: false, nests: [{ nestName: "n", isCalibrated: false }] },
          ],
        },
      ],
    });
    expect(Object.keys(parsed.devices[0])).toStrictEqual(["deviceName", "decks"]);
    expect(Object.keys(parsed.devices[0].decks[0].nests[0])).toStrictEqual([
      "nestName",
      "isCalibrated",
    ]);
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted")).toBe(false);
  });

  it("a kind inherited through the prototype is not accepted", () => {
    const inherited = Object.create({ kind: "robotStates" }) as Record<string, unknown>;
    inherited["robots"] = [{ robotName: "r1" }];
    expect(parseRobotStates(inherited)).toBe("bad_reply");
  });
});

describe("golden replies", () => {
  it("robotStates golden parses to its robot name", () => {
    expect(parseRobotStates(ROBOT_STATES_GOLDEN)).toStrictEqual({
      shape: "list",
      names: ["stack2-6"],
      degraded: false,
    });
  });

  it("labware and transfer profile goldens parse to their profile names", () => {
    expect(parseProfiles(LABWARE_PROFILES_GOLDEN, "labwareProfiles")).toStrictEqual({
      shape: "list",
      names: ["Default"],
      degraded: false,
    });
    expect(parseProfiles(TRANSFER_PROFILES_GOLDEN, "transferProfiles")).toStrictEqual({
      shape: "list",
      names: ["Default"],
      degraded: false,
    });
  });

  it("a profile reply of the other kind is bad_reply", () => {
    expect(parseProfiles(LABWARE_PROFILES_GOLDEN, "transferProfiles")).toBe("bad_reply");
  });

  it("deviceTree golden parses to the expected tree", () => {
    expect(parseDeviceTree(DEVICE_TREE_GOLDEN)).toStrictEqual({
      shape: "tree",
      degraded: false,
      ambiguous: [],
      devices: [
        {
          deviceName: "nest-1",
          decks: [
            {
              deckName: "deck1",
              isCalibrated: true,
              nests: [{ nestName: "A1", isCalibrated: true }],
            },
          ],
        },
      ],
    });
  });

  it("the readFailed golden under SUCCESS is bad_reply for every parser (wrong kind)", () => {
    expect(parseRobotStates(READ_FAILED_GOLDEN)).toBe("bad_reply");
    expect(parseProfiles(READ_FAILED_GOLDEN, "labwareProfiles")).toBe("bad_reply");
    expect(parseProfiles(READ_FAILED_GOLDEN, "transferProfiles")).toBe("bad_reply");
    expect(parseDeviceTree(READ_FAILED_GOLDEN)).toBe("bad_reply");
  });
});

describe("boundary rendering: nothing is preselected", () => {
  function okList(names: string[]): OptionsResult {
    return {
      status: "ok",
      source: "stack.robots",
      shape: "list",
      names,
      degraded: false,
      fetchedAt: 1,
    };
  }

  it.each([1, MAX_LIST_ITEMS])(
    "a parsed list of %i item(s) renders ok with the blank value",
    (n) => {
      const parsed = parseRobotStates(robotStatesWithCount(n)) as { names: string[] };
      expect(parsed.names).toHaveLength(n);
      const view = buildSelectView({
        mode: "ok",
        value: undefined,
        offered: listOptions(okList(parsed.names)),
      });
      expect(view.mode).toBe("ok");
      expect(view.value).toBe("");
      expect(view.options[0]).toStrictEqual({ key: "empty", value: "", label: "" });
      expect(view.options).toHaveLength(n + 1);
    },
  );
});

// parsePlates (07-06, D-04, PLT-04): reply literals follow the frozen get_plates
// shape (galago-tools d53da53), { plates: [...] } with no kind key.
describe("parsePlates", () => {
  function plates(parsed: unknown): PlateEntry[] {
    expect(parsed).toMatchObject({ shape: "plates" });
    return (parsed as { plates: PlateEntry[] }).plates;
  }

  it("pins the cap constants", () => {
    expect(MAX_PLATES).toBe(1000);
    expect(MAX_PLATE_DESCRIPTION_LENGTH).toBe(256);
    expect(MAX_PLATE_ROWS).toBe(32);
    expect(MAX_PLATE_COLS).toBe(48);
  });

  it("the golden reply is plates, not degraded, in reply order with geometry and no workingCapacity", () => {
    const parsed = parsePlates(FAST_PLATES_GOLDEN);
    expect(parsed).toMatchObject({ shape: "plates", degraded: false });
    const list = plates(parsed);
    expect(list.map((p) => p.id)).toStrictEqual(FAST_PLATES_GOLDEN.plates.map((p) => p.id));
    expect(list[0]).toStrictEqual({
      id: 1,
      description: "Default 96-Well Conical",
      rowCount: 8,
      colCount: 12,
    });
    for (const entry of list) expect(entry).not.toHaveProperty("workingCapacity");
  });

  it("is never re-sorted: reply order 12, 7 stays 12, 7", () => {
    const list = plates(
      parsePlates({
        plates: [
          { id: 12, description: "a", rowCount: 8, colCount: 12 },
          { id: 7, description: "b", rowCount: 8, colCount: 12 },
        ],
      }),
    );
    expect(list.map((p) => p.id)).toStrictEqual([12, 7]);
  });

  describe("cap boundaries", () => {
    it("MAX_PLATES: 1000 entries ok, 1001 too_large and never sliced", () => {
      expect(plates(parsePlates(platesWithCount(1000)))).toHaveLength(1000);
      expect(parsePlates(platesWithCount(1001))).toBe("too_large");
    });

    it("description: 256 code units kept verbatim, 257 becomes '' and degrades the list", () => {
      const at = parsePlates(platesWithDescriptionLength(256));
      expect(plates(at)[0].description).toBe("d".repeat(256));
      expect(at).toMatchObject({ degraded: false });

      const over = parsePlates(platesWithDescriptionLength(257));
      expect(plates(over)).toHaveLength(1);
      expect(plates(over)[0].description).toBe("");
      expect(over).toMatchObject({ degraded: true });
    });

    it("description length counts UTF-16 code units: 128 astral characters are 256, 129 are 258", () => {
      const astral = (n: number) => platesWith({ description: "\u{1F9EA}".repeat(n) });
      expect(plates(parsePlates(astral(128)))[0].description).toHaveLength(256);
      const over = parsePlates(astral(129));
      expect(plates(over)[0].description).toBe("");
      expect(over).toMatchObject({ degraded: true });
    });

    it("rowCount: 32 kept, 33 becomes null (plate kept, list not degraded)", () => {
      expect(plates(parsePlates(platesWith({ rowCount: 32 })))[0].rowCount).toBe(32);
      const over = parsePlates(platesWith({ rowCount: 33 }));
      expect(plates(over)[0]).toMatchObject({ id: 1, rowCount: null, colCount: 12 });
      expect(over).toMatchObject({ degraded: false });
    });

    it("colCount: 48 kept, 49 becomes null (plate kept, list not degraded)", () => {
      expect(plates(parsePlates(platesWith({ colCount: 48 })))[0].colCount).toBe(48);
      const over = parsePlates(platesWith({ colCount: 49 }));
      expect(plates(over)[0]).toMatchObject({ id: 1, rowCount: 8, colCount: null });
      expect(over).toMatchObject({ degraded: false });
    });

    it("geometry below 1, fractional, non-numeric or numeric strings become null", () => {
      for (const bad of [0, -1, 8.5, "8", NaN, null, Infinity]) {
        const parsed = parsePlates(platesWith({ rowCount: bad, colCount: bad }));
        expect(plates(parsed)[0]).toMatchObject({ rowCount: null, colCount: null });
      }
    });

    it("id: 2147483647 kept, 2147483648 dropped and degraded", () => {
      expect(plates(parsePlates(platesWith({ id: 2147483647 })))[0].id).toBe(2147483647);
      const over = parsePlates(platesWith({ id: 2147483648 }));
      expect(plates(over)).toHaveLength(0);
      expect(over).toMatchObject({ degraded: true });
    });
  });

  describe("ids are rejected, never repaired (PLT-04)", () => {
    it.each([
      ["0", 0],
      ["-1", -1],
      ["12.7", 12.7],
      ["the string '12'", "12"],
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["null", null],
    ])("id %s is dropped and the list is degraded", (_label, id) => {
      const parsed = parsePlates(platesWith({ id }));
      expect(plates(parsed)).toHaveLength(0);
      expect(parsed).toMatchObject({ degraded: true });
    });

    it("an absent id is dropped and the list is degraded", () => {
      const parsed = parsePlates(platesWithoutId());
      expect(plates(parsed)).toHaveLength(0);
      expect(parsed).toMatchObject({ degraded: true });
    });

    it("12.7 is never offered as 12", () => {
      const parsed = parsePlates(PLATES_FRACTIONAL_ID);
      expect(plates(parsed).map((p) => p.id)).not.toContain(12);
      expect(plates(parsed).map((p) => p.id)).not.toContain(13);
      expect(plates(parsed)).toHaveLength(0);
    });

    it("5.0 is the id 5", () => {
      expect(plates(parsePlates(platesWith({ id: 5.0 })))[0].id).toBe(5);
    });

    it("a bad entry among good ones leaves the good ones in order", () => {
      const parsed = parsePlates({
        plates: [
          { id: 3, description: "a", rowCount: 8, colCount: 12 },
          { id: 12.7, description: "bad", rowCount: 8, colCount: 12 },
          { id: 4, description: "b", rowCount: 8, colCount: 12 },
        ],
      });
      expect(plates(parsed).map((p) => p.id)).toStrictEqual([3, 4]);
      expect(parsed).toMatchObject({ degraded: true });
    });
  });

  describe("reply shape", () => {
    it("{ plates: [] } is ok with zero entries and not degraded", () => {
      const parsed = parsePlates({ plates: [] });
      expect(plates(parsed)).toHaveLength(0);
      expect(parsed).toMatchObject({ degraded: false });
    });

    it("a reply without kind is ok and kind 'plates' is ok", () => {
      expect(parsePlates(FAST_PLATES_GOLDEN)).toMatchObject({ shape: "plates" });
      expect(parsePlates({ kind: "plates", ...FAST_PLATES_GOLDEN })).toMatchObject({
        shape: "plates",
      });
    });

    it("a kind that is present and not 'plates' is bad_reply", () => {
      expect(parsePlates({ kind: "robotStates", ...FAST_PLATES_GOLDEN })).toBe("bad_reply");
      expect(parsePlates({ kind: null, ...FAST_PLATES_GOLDEN })).toBe("bad_reply");
    });

    it("a missing or non-array plates is bad_reply", () => {
      expect(parsePlates({})).toBe("bad_reply");
      expect(parsePlates({ plates: "x" })).toBe("bad_reply");
      expect(parsePlates({ plates: { 0: { id: 1 } } })).toBe("bad_reply");
      expect(parsePlates({ plates: null })).toBe("bad_reply");
    });

    it("a non-object meta is bad_reply", () => {
      for (const meta of [null, undefined, "plates", 5, [FAST_PLATES_GOLDEN]]) {
        expect(parsePlates(meta)).toBe("bad_reply");
      }
    });

    it("an inherited plates key is treated as absent", () => {
      const meta = Object.create({ plates: [] }) as Record<string, unknown>;
      expect(parsePlates(meta)).toBe("bad_reply");
    });
  });

  describe("entries and descriptions", () => {
    it("a non-object entry is dropped and the list is degraded", () => {
      for (const bad of [null, 7, "x", [1]]) {
        const parsed = parsePlates({ plates: [bad, FAST_PLATES_GOLDEN.plates[0]] });
        expect(plates(parsed).map((p) => p.id)).toStrictEqual([1]);
        expect(parsed).toMatchObject({ degraded: true });
      }
    });

    it("a {{variable}} description (raw or padded) becomes '' and degrades the list", () => {
      for (const description of ["{{x}}", "  {{x}}  "]) {
        const parsed = parsePlates(platesWith({ description }));
        expect(plates(parsed)[0]).toMatchObject({ id: 1, description: "" });
        expect(parsed).toMatchObject({ degraded: true });
      }
    });

    it("a non-string description becomes '' and degrades the list; the plate is kept", () => {
      for (const description of [5, null, undefined, {}, ["a"]]) {
        const parsed = parsePlates(platesWith({ description }));
        expect(plates(parsed)[0]).toMatchObject({ id: 1, description: "" });
        expect(parsed).toMatchObject({ degraded: true });
      }
    });

    it("an empty-string description is valid and not degraded", () => {
      const parsed = parsePlates(platesWith({ description: "" }));
      expect(plates(parsed)[0].description).toBe("");
      expect(parsed).toMatchObject({ degraded: false });
    });

    it("a description is kept verbatim (not trimmed)", () => {
      expect(plates(parsePlates(platesWith({ description: " Greiner " })))[0].description).toBe(
        " Greiner ",
      );
    });

    it("an entry with no geometry keys is kept with null geometry and not degraded", () => {
      const parsed = parsePlates(platesWithoutGeometry());
      expect(plates(parsed)[0]).toStrictEqual({
        id: 3,
        description: "No geometry",
        rowCount: null,
        colCount: null,
      });
      expect(parsed).toMatchObject({ degraded: false });
    });

    it("keys that exist only on the prototype are treated as absent (own() safety)", () => {
      const parsed = parsePlates(platesWithInheritedKeys());
      // The inherited id is not an own property, so the entry has no id: dropped.
      expect(plates(parsed)).toHaveLength(0);
      expect(parsed).toMatchObject({ degraded: true });

      const withOwnId = {
        plates: [
          Object.assign(Object.create({ rowCount: 8, colCount: 12, description: "inh" }), {
            id: 2,
          }),
        ],
      };
      const second = parsePlates(withOwnId);
      expect(plates(second)[0]).toStrictEqual({
        id: 2,
        description: "",
        rowCount: null,
        colCount: null,
      });
    });

    it("duplicate ids are both kept, in order", () => {
      const parsed = parsePlates({
        plates: [
          { id: 40, description: "Twin A", rowCount: 8, colCount: 12 },
          { id: 40, description: "Twin B", rowCount: 8, colCount: 12 },
        ],
      });
      expect(plates(parsed).map((p) => [p.id, p.description])).toStrictEqual([
        [40, "Twin A"],
        [40, "Twin B"],
      ]);
      expect(parsed).toMatchObject({ degraded: false });
    });
  });
});
