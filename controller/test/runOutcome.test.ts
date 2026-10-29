import { describe, it, expect } from "vitest";
import { storedErrorText } from "@/components/runs/storedError";
import {
  deriveRunOutcome,
  runOutcomeBadge,
  runProgressColorScheme,
} from "@/components/runs/runOutcome";

function cmd(status: string, error?: unknown): any {
  return error === undefined ? { status } : { status, error };
}

const SKIPPED_FAILURE_TITLE = "Completed, but a failed step was skipped, not completed.";

describe("storedErrorText reads a persisted row error", () => {
  it("returns the message of an Error, a string and a {message} object", () => {
    expect(storedErrorText(new Error("boom"))).toBe("boom");
    expect(storedErrorText("boom")).toBe("boom");
    expect(storedErrorText({ message: "boom" })).toBe("boom");
  });

  it("returns null for empty, blank and non-error values", () => {
    expect(storedErrorText(undefined)).toBeNull();
    expect(storedErrorText(null)).toBeNull();
    expect(storedErrorText(42)).toBeNull();
    expect(storedErrorText({})).toBeNull();
    expect(storedErrorText(new Error(""))).toBeNull();
    expect(storedErrorText("   ")).toBeNull();
  });

  it("returns text with content untrimmed", () => {
    expect(storedErrorText("  boom \n")).toBe("  boom \n");
  });
});

describe("deriveRunOutcome (D-18, D-19)", () => {
  it("returns the non-success default CREATED for missing or empty commands", () => {
    expect(deriveRunOutcome(undefined)).toBe("CREATED");
    expect(deriveRunOutcome(null)).toBe("CREATED");
    expect(deriveRunOutcome("x")).toBe("CREATED");
    expect(deriveRunOutcome([])).toBe("CREATED");
  });

  it("derives COMPLETED_WITH_SKIPPED_FAILURE for a SKIPPED step that carries an error", () => {
    expect(deriveRunOutcome([cmd("SKIPPED", new Error("tool broke"))])).toBe(
      "COMPLETED_WITH_SKIPPED_FAILURE",
    );
  });

  it("keeps the skipped-failure outcome when the last step is COMPLETED", () => {
    expect(deriveRunOutcome([cmd("SKIPPED", new Error("x")), cmd("COMPLETED")])).toBe(
      "COMPLETED_WITH_SKIPPED_FAILURE",
    );
  });

  it("yields one outcome for several skipped-with-error steps", () => {
    expect(
      deriveRunOutcome([cmd("COMPLETED"), cmd("SKIPPED", new Error("a")), cmd("SKIPPED", "b")]),
    ).toBe("COMPLETED_WITH_SKIPPED_FAILURE");
  });

  it("keeps a plain operator Skip with no stored error as COMPLETED", () => {
    expect(deriveRunOutcome([cmd("SKIPPED")])).toBe("COMPLETED");
    expect(deriveRunOutcome([cmd("COMPLETED"), cmd("SKIPPED")])).toBe("COMPLETED");
  });

  it("derives FAILED for any FAILED step, even when a later step completed", () => {
    expect(deriveRunOutcome([cmd("FAILED", new Error("x"))])).toBe("FAILED");
    expect(deriveRunOutcome([cmd("FAILED", new Error("x")), cmd("COMPLETED")])).toBe("FAILED");
    expect(deriveRunOutcome([cmd("SKIPPED", new Error("x")), cmd("FAILED")])).toBe("FAILED");
  });

  it("derives STARTED, QUEUED and COMPLETED as before", () => {
    expect(deriveRunOutcome([cmd("STARTED"), cmd("CREATED")])).toBe("STARTED");
    expect(deriveRunOutcome([cmd("CREATED"), cmd("CREATED")])).toBe("QUEUED");
    expect(deriveRunOutcome([cmd("COMPLETED")])).toBe("COMPLETED");
  });

  it("does not call a run a skipped failure while a row is still waiting", () => {
    expect(deriveRunOutcome([cmd("SKIPPED", new Error("x")), cmd("CREATED")])).toBe("CREATED");
  });

  it("ignores the stale error a COMPLETED row kept from an earlier failed attempt", () => {
    expect(deriveRunOutcome([cmd("COMPLETED", new Error("stale"))])).toBe("COMPLETED");
  });

  it("tolerates malformed rows without throwing", () => {
    expect(() => deriveRunOutcome([null, undefined, 3, "x"])).not.toThrow();
    expect(deriveRunOutcome([null, undefined])).toBe("CREATED");
  });
});

describe("runOutcomeBadge and runProgressColorScheme", () => {
  it("shows the orange Skipped failure badge only for the skipped-failure outcome", () => {
    expect(runOutcomeBadge("COMPLETED_WITH_SKIPPED_FAILURE")).toEqual({
      label: "Skipped failure",
      title: SKIPPED_FAILURE_TITLE,
      colorScheme: "orange",
    });
    for (const outcome of ["COMPLETED", "FAILED", "STARTED", "QUEUED", "CREATED", "UNKNOWN", ""]) {
      expect(runOutcomeBadge(outcome)).toBeNull();
    }
  });

  it("colours the progress bar orange for the skipped-failure outcome, never teal", () => {
    expect(runProgressColorScheme("COMPLETED_WITH_SKIPPED_FAILURE")).toBe("orange");
  });

  it("keeps every other outcome on the existing teal bar", () => {
    for (const outcome of ["COMPLETED", "FAILED", "STARTED", "QUEUED", "CREATED", "UNKNOWN"]) {
      expect(runProgressColorScheme(outcome)).toBe("teal");
    }
  });
});
