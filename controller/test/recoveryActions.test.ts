import { describe, it, expect } from "vitest";
import {
  recoveryActions,
  getRecoverySpec,
  listRecoveryActions,
  isRecoveryAction,
  isValidRecoveryGuid,
  validateRecoveryRequest,
  RECOVERY_STRICT_SUCCESS,
} from "@/server/recoveryActions";
import { runControl } from "@/server/runControl";

describe("recoveryActions map", () => {
  it("pins the fast entries as exact value copies of runControl (D-05)", () => {
    expect(recoveryActions.fast).toStrictEqual({
      resume: { is_tip_broken: "yesno" },
      abort: { return_liquid: "yesno" },
    });
    expect(recoveryActions.fast.resume).toStrictEqual(runControl.fast.resume);
    expect(recoveryActions.fast.abort).toStrictEqual(runControl.fast.abort);

    expect(Object.isFrozen(recoveryActions)).toBe(true);
    expect(Object.isFrozen(recoveryActions.fast)).toBe(true);
    expect(Object.isFrozen(recoveryActions.stack)).toBe(true);
    expect(Object.isFrozen(recoveryActions.stack.acknowledge_failure)).toBe(true);
  });

  it("has exactly the fast + stack shape with no runControl entry for stack", () => {
    expect(Object.keys(recoveryActions)).toStrictEqual(["fast", "stack"]);
    expect(listRecoveryActions("stack")).toStrictEqual(["acknowledge_failure"]);
    expect(listRecoveryActions("fast")).toStrictEqual(["resume", "abort"]);
    expect(listRecoveryActions("pf400")).toStrictEqual([]);

    expect(isRecoveryAction("stack", "acknowledge_failure")).toBe(true);
    expect(isRecoveryAction("stack", "resume")).toBe(false);
    expect(isRecoveryAction("fast", "resume")).toBe(true);
    expect(isRecoveryAction("fast", "pause")).toBe(false);
    expect(isRecoveryAction("pf400", "resume")).toBe(false);

    expect(getRecoverySpec("stack", "acknowledge_failure")).toStrictEqual({
      guid: "guid",
      arm_inspected: "confirmYes",
    });
    expect(getRecoverySpec("fast", "resume")).toStrictEqual({ is_tip_broken: "yesno" });
    expect(getRecoverySpec("pf400", "resume")).toBeUndefined();
  });

  it("resolves lookups by own property only (D-04)", () => {
    expect(isRecoveryAction("toString", "constructor")).toBe(false);
    expect(getRecoverySpec("constructor", "prototype")).toBeUndefined();
    expect(listRecoveryActions("__proto__")).toStrictEqual([]);
    expect(validateRecoveryRequest("toString", "constructor", {})).toMatchObject({
      ok: false,
      code: "PRECONDITION_FAILED",
      message: 'Tool type "toString" does not support recovery actions.',
    });
  });

  it("pins RECOVERY_STRICT_SUCCESS to the stack acknowledge (D-10)", () => {
    expect(RECOVERY_STRICT_SUCCESS).toStrictEqual({ stack: ["acknowledge_failure"] });
    expect(Object.isFrozen(RECOVERY_STRICT_SUCCESS)).toBe(true);
  });
});

describe("isValidRecoveryGuid (D-08)", () => {
  it("accepts a plain string guid and is never trimmed or coerced", () => {
    expect(isValidRecoveryGuid("g-1")).toBe(true);
    expect(isValidRecoveryGuid("submit-deadbeef")).toBe(true);
    expect(isValidRecoveryGuid(true)).toBe(false);
    expect(isValidRecoveryGuid(123)).toBe(false);
    expect(isValidRecoveryGuid(null)).toBe(false);
    expect(isValidRecoveryGuid(undefined)).toBe(false);
    expect(isValidRecoveryGuid({})).toBe(false);
    expect(isValidRecoveryGuid("  g-1  ")).toBe(false);
    expect(isValidRecoveryGuid("g-1 ")).toBe(false);
  });

  it("accepts a 256-character guid and refuses anything past the boundary", () => {
    expect(isValidRecoveryGuid("a".repeat(256))).toBe(true);
    expect(isValidRecoveryGuid("a".repeat(257))).toBe(false);
    expect(isValidRecoveryGuid("")).toBe(false);
  });

  it("refuses spaces, tabs and control characters wherever they appear", () => {
    expect(isValidRecoveryGuid("ab cd")).toBe(false);
    expect(isValidRecoveryGuid("ab\tcd")).toBe(false);
    expect(isValidRecoveryGuid("ab\u0085cd")).toBe(false);
    expect(isValidRecoveryGuid("ab\u0000cd")).toBe(false);
  });
});

describe("validateRecoveryRequest happy path", () => {
  it("returns the exact params for a valid stack acknowledge", () => {
    expect(
      validateRecoveryRequest("stack", "acknowledge_failure", {
        guid: "g-1",
        arm_inspected: "yes",
      }),
    ).toStrictEqual({
      ok: true,
      params: { guid: "g-1", arm_inspected: "yes" },
    });
  });

  it("passes the 256-character guid boundary and values keep case exactly", () => {
    const verdict = validateRecoveryRequest("stack", "acknowledge_failure", {
      guid: "a".repeat(256),
      arm_inspected: "yes",
    });
    expect(verdict).toStrictEqual({
      ok: true,
      params: { guid: "a".repeat(256), arm_inspected: "yes" },
    });
  });
});

describe("guid boundary refusals (OPR-01)", () => {
  it("refuses a 257-character guid", () => {
    const verdict = validateRecoveryRequest("stack", "acknowledge_failure", {
      guid: "a".repeat(257),
      arm_inspected: "yes",
    });
    if (!verdict.ok) {
      expect(verdict.message).toContain("1-256");
      expect(verdict.message).toContain("(got ");
    } else {
      expect.fail("257-character guid was accepted");
    }
  });

  it("refuses a 0-character guid", () => {
    expect(
      validateRecoveryRequest("stack", "acknowledge_failure", { guid: "", arm_inspected: "yes" }),
    ).toMatchObject({
      ok: false,
      code: "BAD_REQUEST",
      message: expect.stringContaining('Parameter "guid"'),
    });
  });

  it("refuses guids with whitespace and control characters, quoting the value", () => {
    const cases = ["ab cd", "ab\tcd", "ab\u0085cd", "a".repeat(256) + " "];
    for (const guid of cases) {
      const verdict = validateRecoveryRequest("stack", "acknowledge_failure", {
        guid,
        arm_inspected: "yes",
      });
      if (!verdict.ok) {
        expect(verdict.message).toContain("guid");
        expect(verdict.message).toContain("(got ");
      } else {
        expect.fail(`guid ${JSON.stringify(guid)} was accepted`);
      }
    }
  });
});

describe("arm_inspected confirmYes refusals (D-14)", () => {
  it('refuses every value that is not exactly "yes"', () => {
    const params = {
      no: { guid: "g-1", arm_inspected: "no" },
      empty: { guid: "g-1", arm_inspected: "" },
      "space-prefixed": { guid: "g-1", arm_inspected: " yes" },
      yes: { guid: "g-1", arm_inspected: "Yes" },
      boolean: { guid: "g-1", arm_inspected: true },
      missing: { guid: "g-1" },
    };
    for (const [label, entry] of Object.entries(params)) {
      const verdict = validateRecoveryRequest("stack", "acknowledge_failure", entry);
      expect(verdict, label).toMatchObject({
        ok: false,
        code: "BAD_REQUEST",
        message: expect.stringContaining("arm_inspected"),
      });
    }
  });

  it("reports the kind failure before an undeclared parameter (d before e)", () => {
    expect(
      validateRecoveryRequest("stack", "acknowledge_failure", {
        guid: "g-1",
        arm_inspected: "no",
        extra: "x",
      }),
    ).toMatchObject({
      ok: false,
      code: "BAD_REQUEST",
      message: expect.stringContaining("arm_inspected"),
    });
  });
});

describe("undeclared params refused (OPR-01 fail-closed)", () => {
  it("refuses an undeclared parameter after all declared ones pass", () => {
    const verdict = validateRecoveryRequest("stack", "acknowledge_failure", {
      guid: "g-1",
      arm_inspected: "yes",
      hard: "yes",
    });
    expect(verdict).toMatchObject({
      ok: false,
      code: "BAD_REQUEST",
      message: 'Parameter "hard" is not a decision of action "acknowledge_failure".',
    });
  });

  it("reports the guid failure first when both guid and an undeclared param fail", () => {
    expect(
      validateRecoveryRequest("stack", "acknowledge_failure", {
        guid: "",
        arm_inspected: "yes",
        hard: "yes",
      }),
    ).toMatchObject({
      ok: false,
      code: "BAD_REQUEST",
      message: expect.stringContaining('Parameter "guid"'),
    });
  });
});

describe("refusal order is fixed and first-failing-only (OPR-02, D-14)", () => {
  it("(a) a blank or undefined tool type is refused as Unsupported, before any action check", () => {
    expect(validateRecoveryRequest(undefined, "pause", {})).toStrictEqual({
      ok: false,
      code: "PRECONDITION_FAILED",
      message: 'Tool type "" does not support recovery actions.',
    });
    expect(validateRecoveryRequest("", "resume", {})).toStrictEqual({
      ok: false,
      code: "PRECONDITION_FAILED",
      message: 'Tool type "" does not support recovery actions.',
    });
  });

  it("(a) unknown type wins over the undeclared action", () => {
    expect(validateRecoveryRequest("pf400", "pause", {})).toStrictEqual({
      ok: false,
      code: "PRECONDITION_FAILED",
      message: 'Tool type "pf400" does not support recovery actions.',
    });
  });

  it("(b) undeclared action wins over the kind failures", () => {
    expect(validateRecoveryRequest("stack", "pause", {})).toStrictEqual({
      ok: false,
      code: "BAD_REQUEST",
      message: 'Action "pause" is not available for tool type "stack".',
    });
  });

  it("(c) a kind failure wins over the undeclared parameter", () => {
    expect(
      validateRecoveryRequest("stack", "acknowledge_failure", {
        guid: "ab cd",
        arm_inspected: "yes",
        extra: "x",
      }),
    ).toMatchObject({
      ok: false,
      code: "BAD_REQUEST",
      // 'Parameter "extra" is not a decision…' never contains "guid", so a hit
      // on this match proves the kind failure was the one reported.
      message: expect.stringContaining("guid"),
    });
  });

  it("(d) declared params are checked in declaration order: guid before arm_inspected", () => {
    expect(
      validateRecoveryRequest("stack", "acknowledge_failure", {
        arm_inspected: "no",
      }),
    ).toMatchObject({
      ok: false,
      code: "BAD_REQUEST",
      // The arm_inspected rejection ('Decision "arm_inspected"…') would only
      // be reached after guid passes, so this exact prefix proves the order.
      message: expect.stringContaining('Parameter "guid"'),
    });
  });

  it("stack keeps its recovery-only map: resume and abort are refused", () => {
    for (const action of ["resume", "abort"]) {
      const verdict = validateRecoveryRequest("stack", action, {});
      expect(verdict, action).toMatchObject({
        ok: false,
        code: "BAD_REQUEST",
        message: `Action "${action}" is not available for tool type "stack".`,
      });
    }
  });

  it("fast pause is refused (not a recovery action)", () => {
    expect(validateRecoveryRequest("fast", "pause", {})).toMatchObject({
      ok: false,
      code: "BAD_REQUEST",
      message: 'Action "pause" is not available for tool type "fast".',
    });
  });
});
