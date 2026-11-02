import { describe, it, expect } from "vitest";
import { omitBlankParams, coerceBooleanParams } from "@/components/tools/commandParams";

// Unit tests for the pure STACK param strip (D-04 planner decision: omit
// blanks). Fakes only — no STACK or F.A.S.T. motion (v2 hard constraint).
describe("omitBlankParams (D-04: STACK sends omit blanks)", () => {
  it("drops empty-string, undefined and null params", () => {
    expect(omitBlankParams({ a: "", b: undefined, c: null, d: "x" })).toStrictEqual({ d: "x" });
  });

  it("keeps operator-typed 0 and false — a typed zero is a choice, not a blank", () => {
    expect(omitBlankParams({ zero: 0, no: false, yes: true })).toStrictEqual({
      zero: 0,
      no: false,
      yes: true,
    });
  });

  it("keeps non-empty strings, numbers and arrays verbatim", () => {
    expect(omitBlankParams({ robot: "stack-1", list: ["a", ""], count: 3 })).toStrictEqual({
      robot: "stack-1",
      list: ["a", ""],
      count: 3,
    });
  });

  it("strips blanks one level deep inside nested parent-field groups", () => {
    expect(
      omitBlankParams({
        group: { step_key: "", guid: "g", refresh: false },
        timeout_s: 0,
      }),
    ).toStrictEqual({ group: { guid: "g", refresh: false }, timeout_s: 0 });
  });

  it("does not mutate its input", () => {
    const input = { a: "", group: { b: "", c: 1 }, d: 0 };
    const snapshot = JSON.parse(JSON.stringify(input));
    const result = omitBlankParams(input);
    expect(input).toStrictEqual(snapshot);
    expect(result).not.toBe(input);
    expect(result.group).not.toBe(input.group);
  });

  // WR-01 (05-04 gap closure): a typed-then-cleared NumberInput stores NaN
  // (Chakra parse("") === NaN). A visually-emptied number must be omitted, so
  // NaN counts as blank — while a real 0 and a real false are choices and pass
  // through. NaN-as-blank must never widen to 0.
  it("treats a NaN number as blank (a cleared number input is omitted)", () => {
    expect(omitBlankParams({ timeout_s: NaN })).toStrictEqual({});
  });

  it("drops NaN but keeps real 0 and real false — NaN-as-blank never widens to 0", () => {
    expect(omitBlankParams({ zero: 0, no: false, blank: NaN })).toStrictEqual({
      zero: 0,
      no: false,
    });
  });
});

describe("coerceBooleanParams (CR-01: boolean-typed strings become real booleans)", () => {
  const fields = [{ name: "refresh", type: "boolean" }] as ReadonlyArray<{
    name: string;
    type: unknown;
  }>;

  it("converts the operator-typed string 'false' to the real boolean false", () => {
    expect(coerceBooleanParams({ refresh: "false" }, fields)).toStrictEqual({ refresh: false });
  });

  it("converts the operator-typed string 'true' to the real boolean true", () => {
    expect(coerceBooleanParams({ refresh: "true" }, fields)).toStrictEqual({ refresh: true });
  });

  it("leaves the born-empty '' untouched so the blank strip can omit it", () => {
    expect(coerceBooleanParams({ refresh: "" }, fields)).toStrictEqual({ refresh: "" });
  });

  it("leaves non-boolean fields verbatim even when their value is 'true'", () => {
    const mixed = [
      { name: "refresh", type: "boolean" },
      { name: "text", type: "text" },
      { name: "count", type: "number" },
      { name: "list", type: "text_array" },
      { name: "mode", type: "select" },
    ] as ReadonlyArray<{ name: string; type: unknown }>;
    expect(
      coerceBooleanParams(
        { refresh: "true", text: "true", count: "true", list: ["true"], mode: "true" },
        mixed,
      ),
    ).toStrictEqual({
      refresh: true,
      text: "true",
      count: "true",
      list: ["true"],
      mode: "true",
    });
  });

  it("coerces booleans one level deep inside nested parent-field groups and never mutates its input", () => {
    const nestedFields = [
      {
        name: "group",
        type: [{ name: "refresh", type: "boolean" }] as unknown,
      },
    ] as ReadonlyArray<{ name: string; type: unknown }>;
    const input = { group: { refresh: "false" }, untouched: "true" };
    const snapshot = JSON.parse(JSON.stringify(input));
    const result = coerceBooleanParams(input, nestedFields);
    expect(result).toStrictEqual({ group: { refresh: false }, untouched: "true" });
    expect(input).toStrictEqual(snapshot);
    expect(result).not.toBe(input);
  });
});
