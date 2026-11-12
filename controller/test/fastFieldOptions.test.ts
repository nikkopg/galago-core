import { describe, it, expect } from "vitest";
import {
  DECK_SLOTS,
  DECK_SLOT_OPTIONS,
  FIELD_BINDINGS,
  LOCAL_BINDINGS,
  NOT_REPORTED_SUFFIX,
  applyLocalChange,
  buildSelectView,
  checkboxNextValue,
  checkboxView,
  buildStaticView,
  isStaticBinding,
  lookupFieldBinding,
  lookupLocalBinding,
  newStepDefaults,
  numericPatch,
  isCheckboxBinding,
  isNoZeroFillField,
  DUPLICATE_SUFFIX,
  LOADING_LABEL,
  UNAVAILABLE_HINT,
  applyChange,
  buildFieldView,
  firstFieldForSource,
  formatStatusLine,
  plateOptions,
  isWellGroupAnchor,
  isWellsBinding,
  plateListInput,
} from "@/components/tools/fieldOptions";
import type { CheckboxBinding, FieldBinding, StaticBinding } from "@/components/tools/fieldOptions";
import type { OptionsResult } from "@/server/toolOptions";
import { commandFields } from "@/components/tools/constants";
import { WELL_FIELDS } from "@/components/tools/wellGeometry";
import { FAST_PLATES_GOLDEN } from "./fixtures/fastPlates";

function deck(field: string): StaticBinding {
  const binding = lookupLocalBinding("fast", "transfer", field);
  if (binding === undefined || !isStaticBinding(binding)) throw new Error("no static binding");
  return binding;
}

describe("F.A.S.T. deck slots (D-08, PLT-06)", () => {
  it("defines DECK_SLOTS once as 6 and derives the option list from it", () => {
    expect(DECK_SLOTS).toBe(6);
    expect(DECK_SLOT_OPTIONS).toStrictEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("lookupLocalBinding", () => {
  it("resolves the two deck fields of fast transfer as static bindings", () => {
    for (const field of ["source_deck", "dest_deck"]) {
      const binding = lookupLocalBinding("fast", "transfer", field);
      expect(binding).toBeDefined();
      expect(binding?.field).toBe(field);
      expect(binding !== undefined && isStaticBinding(binding)).toBe(true);
    }
  });

  it("returns undefined for every other field, command, tool type and prototype key", () => {
    expect(lookupLocalBinding("fast", "transfer", "volume")).toBeUndefined();
    expect(lookupLocalBinding("fast", "run_protocol", "source_deck")).toBeUndefined();
    expect(lookupLocalBinding("stack", "transfer", "source_deck")).toBeUndefined();
    expect(lookupLocalBinding("fast", undefined, "source_deck")).toBeUndefined();
    expect(lookupLocalBinding("fast", "transfer", "constructor")).toBeUndefined();
    expect(lookupLocalBinding("fast", "transfer", "__proto__")).toBeUndefined();
    expect(lookupLocalBinding("constructor", "transfer", "source_deck")).toBeUndefined();
  });

  it("never shares a field with the instrument-fed FIELD_BINDINGS", () => {
    for (const [toolType, commands] of Object.entries(LOCAL_BINDINGS)) {
      for (const [command, fields] of Object.entries(commands)) {
        for (const field of Object.keys(fields)) {
          expect(lookupFieldBinding(toolType, command, field), toolType + command + field).toBe(
            undefined,
          );
        }
      }
    }
    expect(lookupFieldBinding("fast", "transfer", "source_deck")).toBeUndefined();
    expect(Object.keys(FIELD_BINDINGS)).toStrictEqual(["stack", "fast"]);
  });
});

describe("buildStaticView (deck select)", () => {
  const empty = { key: "empty", value: "", label: "" };

  it("is born on the explicit empty option for a blank value", () => {
    for (const blank of [undefined, null, ""]) {
      const view = buildStaticView({
        binding: deck("source_deck"),
        value: blank,
        allowVariables: false,
      });
      expect(view.mode).toBe("ok");
      expect(view.value).toBe("");
      expect(view.disabled).toBe(false);
      expect(view.options[0]).toStrictEqual(empty);
      expect(view.options.map((o) => o.value)).toStrictEqual(["", "1", "2", "3", "4", "5", "6"]);
      expect(view.options.some((o) => o.flag !== undefined)).toBe(false);
    }
  });

  it("selects a saved 3 or '3' with no extra option", () => {
    for (const saved of [3, "3"]) {
      const view = buildStaticView({
        binding: deck("dest_deck"),
        value: saved,
        allowVariables: false,
      });
      expect(view.value).toBe("3");
      expect(view.options).toHaveLength(7);
    }
  });

  it("keeps a saved value outside 1-6 as one flagged extra option", () => {
    for (const saved of [0, 7, "x"]) {
      const view = buildStaticView({
        binding: deck("source_deck"),
        value: saved,
        allowVariables: false,
      });
      expect(view.value).toBe(String(saved));
      expect(view.options).toHaveLength(8);
      const last = view.options[7];
      expect(last.label).toBe(String(saved) + " (not a deck slot 1-6)");
      expect(last.flag).toBe("not-reported");
    }
  });

  it("shows a {{variable}} as disabled only when variables are allowed", () => {
    const bound = buildStaticView({
      binding: deck("source_deck"),
      value: "{{deck}}",
      allowVariables: true,
    });
    expect(bound.mode).toBe("variable-bound");
    expect(bound.disabled).toBe(true);
    const plain = buildStaticView({
      binding: deck("source_deck"),
      value: "{{deck}}",
      allowVariables: false,
    });
    expect(plain.mode).toBe("ok");
    expect(plain.options[7].label).toBe("{{deck}} (not a deck slot 1-6)");
  });

  it("leaves buildSelectView's default not-reported suffix unchanged", () => {
    const view = buildSelectView({ mode: "ok", value: "gone", offered: [] });
    expect(view.options[1].label).toBe("gone" + NOT_REPORTED_SUFFIX);
    expect(view.options[1].label).toBe("gone (not reported by instrument)");
  });
});

describe("numericPatch and applyLocalChange", () => {
  it("converts only an all-digit string to a number", () => {
    expect(numericPatch("f", "")).toStrictEqual({ f: "" });
    expect(numericPatch("f", "3")).toStrictEqual({ f: 3 });
    expect(numericPatch("f", "0")).toStrictEqual({ f: 0 });
    expect(numericPatch("f", "x")).toStrictEqual({ f: "x" });
    expect(numericPatch("f", "3.5")).toStrictEqual({ f: "3.5" });
    expect(numericPatch("f", " 3")).toStrictEqual({ f: " 3" });
  });

  it("writes a deck choice as a number under its own field", () => {
    expect(applyLocalChange(deck("source_deck"), "3")).toStrictEqual({ source_deck: 3 });
    expect(applyLocalChange(deck("dest_deck"), "")).toStrictEqual({ dest_deck: "" });
  });
});

function tipReuse(): CheckboxBinding {
  const binding = lookupLocalBinding("fast", "transfer", "tip_reuse");
  if (binding === undefined || !isCheckboxBinding(binding)) throw new Error("no checkbox binding");
  return binding;
}

describe("tip_reuse checkbox view (D-09, PLT-07)", () => {
  const view = (value: unknown, allowVariables = false) =>
    checkboxView({ binding: tipReuse(), value, allowVariables });

  it("maps reuse to checked and fresh to unchecked, with no flag", () => {
    expect(view("reuse")).toStrictEqual({ state: "checked", disabled: false });
    expect(view("fresh")).toStrictEqual({ state: "unchecked", disabled: false });
  });

  it("maps a blank saved value to indeterminate with the blank flag", () => {
    for (const blank of ["", undefined, null]) {
      expect(view(blank)).toStrictEqual({
        state: "indeterminate",
        disabled: false,
        flag: "(saved value is blank \u2014 not reuse/fresh)",
      });
    }
  });

  it("matches by exact, case-sensitive equality: other strings are flagged, quoted verbatim", () => {
    for (const other of ["cold", "Reuse", " reuse", "reuse "]) {
      expect(view(other)).toStrictEqual({
        state: "indeterminate",
        disabled: false,
        flag: "(saved value '" + other + "' \u2014 not reuse/fresh)",
      });
    }
  });

  it("shows a {{variable}} as a disabled reference only when variables are allowed", () => {
    expect(view("{{tips}}", true)).toStrictEqual({
      state: "indeterminate",
      disabled: true,
      variable: "{{tips}}",
    });
    expect(view("{{tips}}", false).flag).toBe("(saved value '{{tips}}' \u2014 not reuse/fresh)");
  });

  it("picks the next value on a click: checked -> fresh, otherwise reuse", () => {
    expect(checkboxNextValue(tipReuse(), "checked")).toBe("fresh");
    expect(checkboxNextValue(tipReuse(), "unchecked")).toBe("reuse");
    expect(checkboxNextValue(tipReuse(), "indeterminate")).toBe("reuse");
  });

  it("writes the string as given, never coerced", () => {
    expect(applyLocalChange(tipReuse(), "fresh")).toStrictEqual({ tip_reuse: "fresh" });
    expect(applyLocalChange(tipReuse(), "reuse")).toStrictEqual({ tip_reuse: "reuse" });
  });

  it("keeps commandFields.fast.transfer tip_reuse a fresh/reuse select", () => {
    const field = commandFields.fast.transfer.find((f) => f.name === "tip_reuse");
    expect(field).toStrictEqual({ name: "tip_reuse", type: "select", options: ["fresh", "reuse"] });
  });
});

describe("newStepDefaults (PLT-07)", () => {
  it("starts a new F.A.S.T. transfer form with tip_reuse reuse, as a fresh object each call", () => {
    expect(newStepDefaults("fast", "transfer")).toStrictEqual({ tip_reuse: "reuse" });
    expect(newStepDefaults("fast", "transfer")).not.toBe(newStepDefaults("fast", "transfer"));
  });

  it("defaults nothing for any other tool type, command or prototype key", () => {
    expect(newStepDefaults("stack", "transfer")).toStrictEqual({});
    expect(newStepDefaults("fast", "run_protocol")).toStrictEqual({});
    expect(newStepDefaults("fast", undefined)).toStrictEqual({});
    expect(newStepDefaults("fast", "constructor")).toStrictEqual({});
    expect(newStepDefaults("constructor", "transfer")).toStrictEqual({});
  });
});

describe("isNoZeroFillField (D-07, PLT-04)", () => {
  it("is true for the four fast transfer plate and deck fields", () => {
    for (const f of ["source_deck", "dest_deck", "source_plate_id", "dest_plate_id"]) {
      expect(isNoZeroFillField("fast", "transfer", f)).toBe(true);
    }
  });

  it("is false for other fast transfer fields, other tools and prototype keys", () => {
    for (const f of ["num_rows", "volume", "source_start_col", "tip_reuse"]) {
      expect(isNoZeroFillField("fast", "transfer", f)).toBe(false);
    }
    expect(isNoZeroFillField("stack", "transfer", "source_deck")).toBe(false);
    expect(isNoZeroFillField("fast", undefined, "source_deck")).toBe(false);
    expect(isNoZeroFillField("fast", "transfer", "constructor")).toBe(false);
    expect(isNoZeroFillField("constructor", "transfer", "source_deck")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Plate dropdowns (07-08: D-05, D-06, PLT-03, PLT-04)

type PlateRow = { id: number; description: string };

function platesResult(rows: PlateRow[], degraded = false): OptionsResult {
  return {
    status: "ok",
    source: "fast.plates",
    shape: "plates",
    plates: rows.map((r) => ({ ...r, rowCount: 8, colCount: 12 })),
    degraded,
    fetchedAt: 0,
  };
}

const GOLDEN_ROWS: PlateRow[] = FAST_PLATES_GOLDEN.plates.map(({ id, description }) => ({
  id,
  description,
}));

function plateBinding(field = "source_plate_id"): FieldBinding {
  const found = lookupFieldBinding("fast", "transfer", field);
  if (found === undefined) throw new Error(field);
  return found;
}

function plateView(
  value: unknown,
  mode: "loading" | "ok" | "unavailable",
  data: OptionsResult | undefined,
  allowVariables = false,
) {
  return buildFieldView({
    binding: plateBinding(),
    value,
    values: {},
    mode,
    data,
    allowVariables,
  });
}

const EMPTY_OPTION = { key: "empty", value: "", label: "" };

describe("plate bindings (D-06, D-16)", () => {
  it("binds exactly source_plate_id and dest_plate_id of fast transfer to fast.plates", () => {
    const source = lookupFieldBinding("fast", "transfer", "source_plate_id");
    const dest = lookupFieldBinding("fast", "transfer", "dest_plate_id");
    expect(source?.source).toBe("fast.plates");
    expect(source?.role).toStrictEqual({ kind: "plate", side: "source" });
    expect(dest?.source).toBe("fast.plates");
    expect(dest?.role).toStrictEqual({ kind: "plate", side: "destination" });
    expect(Object.keys(FIELD_BINDINGS.fast)).toStrictEqual(["transfer"]);
    expect(Object.keys(FIELD_BINDINGS.fast.transfer)).toStrictEqual([
      "source_plate_id",
      "dest_plate_id",
    ]);
    for (const field of commandFields.fast.transfer) {
      if (field.name === "source_plate_id" || field.name === "dest_plate_id") continue;
      expect(lookupFieldBinding("fast", "transfer", field.name), field.name).toBeUndefined();
    }
  });

  it("puts the one Refresh row under source_plate_id", () => {
    const names = commandFields.fast.transfer.map((f) => f.name);
    expect(firstFieldForSource(names, "fast", "transfer", "fast.plates")).toBe("source_plate_id");
  });
});

describe("plateOptions (D-05, D-06)", () => {
  it("lists every plate in reply order as '{id} · {description}' with value String(id)", () => {
    const options = plateOptions(platesResult(GOLDEN_ROWS));
    expect(options.map((o) => o.value)).toStrictEqual(["1", "12", "7", "20", "50"]);
    expect(options[0]).toStrictEqual({
      key: "0",
      value: "1",
      label: "1 · Default 96-Well Conical",
    });
    expect(options.every((o) => o.flag === undefined)).toBe(true);
  });

  it("labels an empty description with the id alone", () => {
    const options = plateOptions(platesResult([{ id: 5, description: "" }]));
    expect(options).toStrictEqual([{ key: "0", value: "5", label: "5" }]);
  });

  it("flags every entry sharing an id, keeps them all and leaves unique ids unflagged", () => {
    const options = plateOptions(
      platesResult([
        { id: 40, description: "Twin A" },
        { id: 41, description: "Solo" },
        { id: 40, description: "Twin B" },
      ]),
    );
    expect(options.length).toBe(3);
    expect(options[0].label).toBe("40 · Twin A" + DUPLICATE_SUFFIX);
    expect(options[0].flag).toBe("duplicate");
    expect(options[2].label).toBe("40 · Twin B" + DUPLICATE_SUFFIX);
    expect(options[2].flag).toBe("duplicate");
    expect(options[1].label).toBe("41 · Solo");
    expect(options[1].flag).toBeUndefined();
    expect(DUPLICATE_SUFFIX).toBe(" (duplicate id — check instrument)");
  });

  it("gives [] for undefined, an unavailable result and a list-shape result", () => {
    expect(plateOptions(undefined)).toStrictEqual([]);
    expect(
      plateOptions({ status: "unavailable", source: "fast.plates", reason: "offline" } as never),
    ).toStrictEqual([]);
    expect(
      plateOptions({
        status: "ok",
        source: "stack.robots",
        shape: "list",
        names: ["a"],
        degraded: false,
        fetchedAt: 0,
      }),
    ).toStrictEqual([]);
  });
});

describe("buildFieldView for a plate binding (PLT-03, PLT-04)", () => {
  it("is born on the blank option with every plate offered after it, nothing preselected", () => {
    const view = plateView(undefined, "ok", platesResult(GOLDEN_ROWS));
    expect(view.mode).toBe("ok");
    expect(view.value).toBe("");
    expect(view.options[0]).toStrictEqual(EMPTY_OPTION);
    expect(view.options.slice(1).map((o) => o.value)).toStrictEqual(["1", "12", "7", "20", "50"]);
    expect(view.disabled).toBe(false);
  });

  it("starts a single registered plate on the blank option too", () => {
    const view = plateView(undefined, "ok", platesResult([{ id: 3, description: "Only" }]));
    expect(view.value).toBe("");
    expect(view.options.map((o) => o.value)).toStrictEqual(["", "3"]);
  });

  it("renders an ok result with zero plates as ok mode with only the blank option", () => {
    const data = platesResult([]);
    const view = plateView(undefined, "ok", data);
    expect(view.mode).toBe("ok");
    expect(view.options).toStrictEqual([EMPTY_OPTION]);
    expect(formatStatusLine(data)).toContain("· 0 items ·");
  });

  it("appends ' · some entries skipped' to the status line when entries were dropped", () => {
    const line = formatStatusLine(platesResult(GOLDEN_ROWS, true));
    expect(line).toContain("5 items");
    expect(line.endsWith(" · some entries skipped")).toBe(true);
  });

  it("selects a saved plate by String equality: 12 and '12' match, ' 12' does not", () => {
    const data = platesResult(GOLDEN_ROWS);
    expect(plateView(12, "ok", data).value).toBe("12");
    expect(plateView("12", "ok", data).value).toBe("12");
    const padded = plateView(" 12", "ok", data);
    expect(padded.options[padded.options.length - 1]).toStrictEqual({
      key: "not-reported",
      value: " 12",
      label: " 12 (not reported by instrument)",
      flag: "not-reported",
    });
  });

  it("keeps a saved plate the instrument does not report as a flagged extra option", () => {
    const view = plateView(99, "ok", platesResult(GOLDEN_ROWS));
    expect(view.value).toBe("99");
    const last = view.options[view.options.length - 1];
    expect(last.label).toBe("99 (not reported by instrument)");
    expect(last.flag).toBe("not-reported");
  });

  it("never shows a not-reported flag for a blank value", () => {
    for (const blank of [undefined, null, ""]) {
      const view = plateView(blank, "ok", platesResult(GOLDEN_ROWS));
      expect(view.options.some((o) => o.flag === "not-reported")).toBe(false);
    }
  });

  it("is disabled with a Loading option while loading and never flags the saved value", () => {
    const view = plateView(99, "loading", undefined);
    expect(view.mode).toBe("loading");
    expect(view.disabled).toBe(true);
    expect(view.options[0].label).toBe(LOADING_LABEL);
    expect(view.options.some((o) => o.flag === "not-reported")).toBe(false);
  });

  it("is the typed input with the unavailable hint when the list is unavailable", () => {
    const view = plateView(7, "unavailable", undefined);
    expect(view.mode).toBe("unavailable");
    expect(view.value).toBe("7");
    expect(view.hint).toBe(UNAVAILABLE_HINT);
    expect(view.options).toStrictEqual([]);
  });

  it("treats a {{variable}} as variable-bound when variables are allowed", () => {
    const view = plateView("{{plate}}", "ok", platesResult(GOLDEN_ROWS), true);
    expect(view.mode).toBe("variable-bound");
    expect(view.disabled).toBe(true);
  });

  it("falls back to unavailable for a tree or list result", () => {
    const list: OptionsResult = {
      status: "ok",
      source: "stack.robots",
      shape: "list",
      names: ["a"],
      degraded: false,
      fetchedAt: 0,
    };
    const tree: OptionsResult = {
      status: "ok",
      source: "stack.devices",
      shape: "tree",
      devices: [],
      ambiguous: [],
      degraded: false,
      fetchedAt: 0,
    };
    expect(plateView(undefined, "ok", list).mode).toBe("unavailable");
    expect(plateView(undefined, "ok", tree).mode).toBe("unavailable");
  });
});

describe("applyChange for a plate binding (T-07-24)", () => {
  it("writes the NUMBER id for a select choice", () => {
    expect(applyChange(plateBinding(), "12")).toStrictEqual({ source_plate_id: 12 });
    expect(applyChange(plateBinding("dest_plate_id"), "7", "select")).toStrictEqual({
      dest_plate_id: 7,
    });
  });

  it("writes '' for a blank select choice", () => {
    expect(applyChange(plateBinding(), "")).toStrictEqual({ source_plate_id: "" });
  });

  it("keeps only ASCII digits of typed text and writes '' when none remain", () => {
    expect(applyChange(plateBinding(), "12a", "typed")).toStrictEqual({ source_plate_id: 12 });
    expect(applyChange(plateBinding(), "abc", "typed")).toStrictEqual({ source_plate_id: "" });
    expect(applyChange(plateBinding(), "", "typed")).toStrictEqual({ source_plate_id: "" });
    expect(applyChange(plateBinding(), "-3.5", "typed")).toStrictEqual({ source_plate_id: 35 });
  });
});

describe("wells local group (D-11)", () => {
  it("binds each of the six well fields as a wells binding and not volume", () => {
    for (const field of WELL_FIELDS) {
      const binding = lookupLocalBinding("fast", "transfer", field);
      expect(binding, field).toBeDefined();
      expect(binding !== undefined && isWellsBinding(binding), field).toBe(true);
      expect(lookupFieldBinding("fast", "transfer", field), field).toBeUndefined();
    }
    expect(lookupLocalBinding("fast", "transfer", "volume")).toBeUndefined();
  });

  it("writes typed edits through wellFieldPatch", () => {
    const num = lookupLocalBinding("fast", "transfer", "num_rows");
    const row = lookupLocalBinding("fast", "transfer", "source_start_row");
    if (num === undefined || row === undefined) throw new Error("no wells binding");
    expect(applyLocalChange(num, "12")).toStrictEqual({ num_rows: 12 });
    expect(applyLocalChange(row, "b")).toStrictEqual({ source_start_row: "b" });
  });
});

describe("isWellGroupAnchor (D-11)", () => {
  const names = commandFields.fast.transfer.map((f) => f.name);

  it("is true only for the first well field in the host's own order", () => {
    expect(isWellGroupAnchor(names, "fast", "transfer", "source_start_row")).toBe(true);
    for (const other of WELL_FIELDS.filter((f) => f !== "source_start_row")) {
      expect(isWellGroupAnchor(names, "fast", "transfer", other), other).toBe(false);
    }
    expect(isWellGroupAnchor(names, "fast", "transfer", "source_deck")).toBe(false);
  });

  it("follows a drawer-style order", () => {
    const drawer = ["dest_start_col", "source_start_row", "volume", "num_rows"];
    expect(isWellGroupAnchor(drawer, "fast", "transfer", "dest_start_col")).toBe(true);
    expect(isWellGroupAnchor(drawer, "fast", "transfer", "source_start_row")).toBe(false);
  });

  it("is false for every name with no well field present or no command", () => {
    expect(isWellGroupAnchor(["volume", "source_deck"], "fast", "transfer", "volume")).toBe(false);
    expect(isWellGroupAnchor(names, "fast", undefined, "source_start_row")).toBe(false);
  });
});

describe("plateListInput (D-16)", () => {
  it("maps loading and unavailable to no plates", () => {
    expect(plateListInput("loading", undefined)).toStrictEqual({ mode: "loading", plates: [] });
    expect(plateListInput("unavailable", undefined)).toStrictEqual({
      mode: "unavailable",
      plates: [],
    });
  });

  it("maps an ok plates result to its entries", () => {
    const plates = [{ id: 1, description: "A", rowCount: 8, colCount: 12 }];
    const data: OptionsResult = {
      status: "ok",
      source: "fast.plates",
      shape: "plates",
      plates,
      degraded: false,
      fetchedAt: 0,
    };
    expect(plateListInput("ok", data)).toStrictEqual({ mode: "ok", plates });
  });

  it("maps an ok result of another shape or no data to unavailable", () => {
    const list: OptionsResult = {
      status: "ok",
      source: "stack.robots",
      shape: "list",
      names: ["a"],
      degraded: false,
      fetchedAt: 0,
    };
    expect(plateListInput("ok", list)).toStrictEqual({ mode: "unavailable", plates: [] });
    expect(plateListInput("ok", undefined)).toStrictEqual({ mode: "unavailable", plates: [] });
  });
});
