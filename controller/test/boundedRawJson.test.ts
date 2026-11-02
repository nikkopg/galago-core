import { describe, it, expect } from "vitest";
import { formatLatchRaw } from "@/components/ui/BoundedRawJson";

// Unit tests for the shared bounded display's pure format function (D-06,
// UI-SPEC AC-2). The repo has no jsdom/RTL: the component itself is never
// rendered here — only the exported fallback chain is exercised.
describe("formatLatchRaw fallback chain (D-06)", () => {
  it("stringifies a plain object to a single JSON line", () => {
    expect(formatLatchRaw({ guid: "g1", latched: true })).toBe('{"guid":"g1","latched":true}');
  });

  it("falls back to String when JSON.stringify throws", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatLatchRaw(circular)).toBe(String(circular));
  });

  it("yields the empty-object literal when both stringify and String throw", () => {
    const hostile: Record<string, unknown> = {
      toString: () => {
        throw new Error("no string form");
      },
    };
    Object.defineProperty(hostile, "boom", {
      enumerable: true,
      get() {
        throw new Error("no access");
      },
    });
    expect(formatLatchRaw(hostile)).toBe("{}");
  });
});
