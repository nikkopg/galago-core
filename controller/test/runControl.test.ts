import { describe, it, expect } from "vitest";
import { runControl, getRunControl, validateControlRequest } from "@/server/runControl";
import { commandFields } from "@/components/tools/constants";

describe("runControl map", () => {
  it("has exactly the F.A.S.T. shape with no hard pause decision", () => {
    expect(runControl).toStrictEqual({
      fast: {
        pause: {},
        resume: { is_tip_broken: "yesno" },
        abort: { return_liquid: "yesno" },
      },
    });
    expect(Object.isFrozen(runControl)).toBe(true);
    expect(Object.isFrozen(runControl.fast)).toBe(true);
    expect(Object.isFrozen(runControl.fast.pause)).toBe(true);
    expect(Object.isFrozen(runControl.fast.resume)).toBe(true);
    expect(Object.isFrozen(runControl.fast.abort)).toBe(true);
    expect(Object.keys(runControl.fast.pause)).toHaveLength(0);
  });
});

describe("commandFields drops fast abort/resume (D-20)", () => {
  it("has no abort, resume or pause entries for fast, and keeps transfer", () => {
    expect(Object.prototype.hasOwnProperty.call(commandFields.fast, "abort")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(commandFields.fast, "resume")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(commandFields.fast, "pause")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(commandFields.fast, "transfer")).toBe(true);
  });
});

describe("legacy saved fast abort/resume steps stay safe in the editor (D-20)", () => {
  it("resolves to an empty field list via the AddToolCommandModal lookup expression", () => {
    expect(commandFields["fast"]?.["abort"] || []).toStrictEqual([]);
    expect(commandFields["fast"]?.["resume"] || []).toStrictEqual([]);
  });
});

describe("validateControlRequest refuses", () => {
  it("refuses when no step is running", () => {
    const verdict = validateControlRequest(undefined, "pause", {});
    expect(verdict).toMatchObject({ ok: false, code: "PRECONDITION_FAILED" });
  });

  it("refuses a running tool with no runControl entry", () => {
    const verdict = validateControlRequest("pf400", "pause", {});
    expect(verdict).toMatchObject({ ok: false, code: "PRECONDITION_FAILED" });
  });

  it.each(["toString", "constructor"])(
    "refuses the inherited tool-type name %s as PRECONDITION_FAILED, not a declared type",
    (toolType) => {
      const verdict = validateControlRequest(toolType, "pause", {});
      expect(verdict).toMatchObject({ ok: false, code: "PRECONDITION_FAILED" });
    },
  );

  it.each(["", "transfer", "constructor", "hard_pause"])(
    "refuses an undeclared action %j as BAD_REQUEST",
    (action) => {
      const verdict = validateControlRequest("fast", action, {});
      expect(verdict).toMatchObject({ ok: false, code: "BAD_REQUEST" });
    },
  );

  it.each([
    {},
    { is_tip_broken: "" },
    { is_tip_broken: " yes" },
    { is_tip_broken: "Yes" },
    { is_tip_broken: "YES" },
    { is_tip_broken: "y" },
    { is_tip_broken: "true" },
    { is_tip_broken: true },
    { is_tip_broken: 1 },
    { is_tip_broken: null },
  ])("refuses resume with an unclear decision %j, naming is_tip_broken", (params) => {
    const verdict = validateControlRequest("fast", "resume", params as Record<string, unknown>);
    expect(verdict).toMatchObject({ ok: false, code: "BAD_REQUEST" });
    expect((verdict as { message: string }).message).toContain("is_tip_broken");
  });

  it("refuses abort with no decision, naming return_liquid", () => {
    const verdict = validateControlRequest("fast", "abort", {});
    expect(verdict).toMatchObject({ ok: false, code: "BAD_REQUEST" });
    expect((verdict as { message: string }).message).toContain("return_liquid");
  });

  it("refuses pause with an undeclared hard decision, naming hard", () => {
    const verdict = validateControlRequest("fast", "pause", { hard: "yes" });
    expect(verdict).toMatchObject({ ok: false, code: "BAD_REQUEST" });
    expect((verdict as { message: string }).message).toContain("hard");
  });

  it("refuses resume with a declared decision plus an undeclared extra, naming extra", () => {
    const verdict = validateControlRequest("fast", "resume", {
      is_tip_broken: "no",
      extra: "x",
    });
    expect(verdict).toMatchObject({ ok: false, code: "BAD_REQUEST" });
    expect((verdict as { message: string }).message).toContain("extra");
  });
});

describe("validateControlRequest accepts", () => {
  it("accepts pause with no decisions", () => {
    expect(validateControlRequest("fast", "pause", {})).toStrictEqual({
      ok: true,
      decisions: {},
    });
  });

  it("accepts resume with is_tip_broken yes", () => {
    expect(validateControlRequest("fast", "resume", { is_tip_broken: "yes" })).toStrictEqual({
      ok: true,
      decisions: { is_tip_broken: "yes" },
    });
  });

  it("accepts abort with return_liquid no", () => {
    expect(validateControlRequest("fast", "abort", { return_liquid: "no" })).toStrictEqual({
      ok: true,
      decisions: { return_liquid: "no" },
    });
  });
});

describe("validateControlRequest ordering (QUE-03)", () => {
  it("(a) no running step wins over an undeclared action", () => {
    const verdict = validateControlRequest(undefined, "nonsense", {});
    expect(verdict).toMatchObject({ ok: false, code: "PRECONDITION_FAILED" });
  });

  it("(b) tool type without runControl wins over an undeclared action", () => {
    const verdict = validateControlRequest("pf400", "resume", {});
    expect(verdict).toMatchObject({ ok: false, code: "PRECONDITION_FAILED" });
  });

  it("(d) a missing declared decision wins over an undeclared parameter", () => {
    const verdict = validateControlRequest("fast", "resume", { extra: "x" });
    expect(verdict).toMatchObject({ ok: false, code: "BAD_REQUEST" });
    expect((verdict as { message: string }).message).toContain("is_tip_broken");
    expect((verdict as { message: string }).message).not.toContain("extra");
  });
});

describe("getRunControl own-property safety", () => {
  it("never resolves inherited names to a declared tool type", () => {
    expect(getRunControl("constructor")).toBeUndefined();
    expect(getRunControl("toString")).toBeUndefined();
    expect(getRunControl("__proto__")).toBeUndefined();
  });

  it("resolves a declared tool type", () => {
    expect(getRunControl("fast")).toBe(runControl.fast);
  });
});
