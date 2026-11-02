import { describe, it, expect } from "vitest";
import { omitBlankParams } from "@/components/tools/commandParams";

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
});
