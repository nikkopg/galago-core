import { describe, it, expect } from "vitest";
import { commandFields } from "@/components/tools/constants";

describe("commandFields select fields (IN-02)", () => {
  it("declares F.A.S.T. transfer tip_reuse as a fresh/reuse select", () => {
    const field = commandFields.fast.transfer.find((f) => f.name === "tip_reuse");
    expect(field).toStrictEqual({ name: "tip_reuse", type: "select", options: ["fresh", "reuse"] });
  });

  it("gives every select field a non-empty, duplicate-free options list", () => {
    for (const [tool, commands] of Object.entries(commandFields)) {
      for (const [command, fields] of Object.entries(commands)) {
        for (const field of fields) {
          if (field.type !== "select") {
            continue;
          }
          const where = `${tool}.${command}.${field.name}`;
          expect(field.options, where).toBeDefined();
          expect(field.options!.length, where).toBeGreaterThan(0);
          expect(new Set(field.options).size, where).toBe(field.options!.length);
        }
      }
    }
  });
});

// GEN-02 (D-03 mapping rules, D-07c): the stack entry covers every command the
// generated stack.Command oneof declares EXCEPT the operator-only
// acknowledge_failure, every field is born-empty (no defaultValue) and no
// field is a select — the F.A.S.T. scan_tips defaultValue is the anti-template.
describe("commandFields.stack (D-03, D-07c)", () => {
  it("declares exactly the 9 non-operator STACK commands in proto declaration order", () => {
    expect(Object.keys(commandFields.stack ?? {})).toStrictEqual([
      "transfer",
      "get_manager_state",
      "get_robot_states",
      "list_devices",
      "list_labware_profiles",
      "list_transfer_profiles",
      "get_labware_presence",
      "get_transfer_estimate",
      "get_failure_latch",
    ]);
    // D-07c: the latch read is in, the operator-only acknowledge is out.
    expect(Object.keys(commandFields.stack ?? {})).toContain("get_failure_latch");
    expect(commandFields.stack?.acknowledge_failure).toBeUndefined();
  });

  it("sweeps every stack field: no defaultValue and no select (born-empty, D-03)", () => {
    for (const [command, fields] of Object.entries(commandFields.stack ?? {})) {
      for (const field of fields) {
        const where = `stack.${command}.${field.name}`;
        expect(field.defaultValue, where).toBeUndefined();
        expect(field.type, where).not.toBe("select");
      }
    }
  });

  it("spot-pins the transfer field list verbatim from the frozen proto (12 fields, timeout_s a number)", () => {
    expect(commandFields.stack?.transfer).toStrictEqual([
      { name: "step_key", type: "text" },
      { name: "robot", type: "text" },
      { name: "labware_profile", type: "text" },
      { name: "source_device", type: "text" },
      { name: "source_deck", type: "text" },
      { name: "source_nest", type: "text" },
      { name: "source_transfer_profile", type: "text" },
      { name: "destination_device", type: "text" },
      { name: "destination_deck", type: "text" },
      { name: "destination_nest", type: "text" },
      { name: "destination_transfer_profile", type: "text" },
      { name: "timeout_s", type: "number" },
    ]);
  });
});
