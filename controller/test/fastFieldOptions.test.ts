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
} from "@/components/tools/fieldOptions";
import type { CheckboxBinding, StaticBinding } from "@/components/tools/fieldOptions";
import { commandFields } from "@/components/tools/constants";

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
    expect(Object.keys(FIELD_BINDINGS)).toStrictEqual(["stack"]);
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
