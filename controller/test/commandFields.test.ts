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
