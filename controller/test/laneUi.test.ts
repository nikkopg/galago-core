import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRunAttributes, groupRowsByLane } from "@/components/runs/utils";
import { deriveRunOutcome } from "@/components/runs/runOutcome";
import {
  LANE_HALT_SENTENCES,
  laneHaltSentence,
  FREEZE_DISABLED_FROZEN,
  FREEZE_DISABLED_IDLE,
  freezeDisabledReason,
  shouldShowLanesPanel,
  runningLaneChips,
  FREEZE_CONFIRM_COPY,
  FREEZE_TOAST_COPY,
  freezeFailedDescription,
  describeLaneFailures,
  laneCardCaption,
  laneDoneText,
  LANE_ROW_ALL_DONE,
} from "@/components/runs/laneStatus";
import type { LaneFailureEntry, RunningLaneEntry } from "@/server/laneScheduling";

const root = resolve(__dirname, "..");
function source(file: string): string {
  return readFileSync(resolve(root, file), "utf8");
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface RowOpts {
  lane?: string;
  barrier?: boolean;
  toolId?: string;
  toolType?: string;
  command?: string;
  params?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  error?: unknown;
}

function row(status: string, o: RowOpts = {}): any {
  const advancedParameters: Record<string, unknown> = {};
  if (o.lane !== undefined) advancedParameters.lane = o.lane;
  if (o.barrier) advancedParameters.laneBarrier = true;
  const r: any = {
    status,
    commandInfo: {
      toolId: o.toolId ?? "stack-1",
      toolType: o.toolType ?? "stack",
      command: o.command ?? "transfer",
      params: o.params ?? {},
      advancedParameters,
    },
  };
  if (o.startedAt !== undefined) r.startedAt = o.startedAt;
  if (o.completedAt !== undefined) r.completedAt = o.completedAt;
  if (o.error !== undefined) r.error = o.error;
  return r;
}

describe("groupRowsByLane (D-21, LUI-05)", () => {
  it("returns null for an empty list and for an untagged list", () => {
    expect(groupRowsByLane([])).toBeNull();
    expect(groupRowsByLane([row("CREATED"), row("COMPLETED")])).toBeNull();
    expect(groupRowsByLane([{ status: "CREATED" } as any])).toBeNull();
  });

  it("groups rows by lane in first-appearance order, untagged under primary", () => {
    const r0 = row("CREATED");
    const r1 = row("CREATED", { lane: "fast", barrier: true, toolId: "fast-1", toolType: "fast" });
    const r2 = row("CREATED");
    const r3 = row("CREATED", { lane: "side", toolId: "side-1", toolType: "side" });
    expect(groupRowsByLane([r0, r1, r2, r3])).toEqual([
      { lane: "primary", rows: [r0, r2] },
      { lane: "fast", rows: [r1] },
      { lane: "side", rows: [r3] },
    ]);
  });

  it("puts a Tool Box row tagged with a lane under primary", () => {
    const tb = row("CREATED", { lane: "fast", toolId: "Tool Box", toolType: "toolbox" });
    const f = row("CREATED", { lane: "fast", toolId: "fast-1", toolType: "fast" });
    expect(groupRowsByLane([tb, f])).toEqual([
      { lane: "primary", rows: [tb] },
      { lane: "fast", rows: [f] },
    ]);
  });
});

describe("deriveRunOutcome with lanes (D-22, Pitfall 23)", () => {
  const fastRow = (status: string, extra: RowOpts = {}) =>
    row(status, { lane: "fast", barrier: true, toolId: "fast-1", toolType: "fast", ...extra });

  it("a COMPLETED last row does not complete a run with an earlier STARTED lane row", () => {
    expect(deriveRunOutcome([row("COMPLETED"), fastRow("STARTED"), row("COMPLETED")])).toBe(
      "STARTED",
    );
  });

  it("a COMPLETED last row does not complete a run with an earlier CREATED lane row", () => {
    expect(deriveRunOutcome([row("COMPLETED"), fastRow("CREATED"), row("COMPLETED")])).toBe(
      "CREATED",
    );
  });

  it("is COMPLETED only when every row is COMPLETED or SKIPPED", () => {
    expect(deriveRunOutcome([row("COMPLETED"), fastRow("COMPLETED"), row("COMPLETED")])).toBe(
      "COMPLETED",
    );
    expect(deriveRunOutcome([row("COMPLETED"), fastRow("SKIPPED"), row("COMPLETED")])).toBe(
      "COMPLETED",
    );
  });

  it("FAILED takes precedence, even with a later COMPLETED row", () => {
    expect(deriveRunOutcome([row("COMPLETED"), fastRow("FAILED"), row("COMPLETED")])).toBe(
      "FAILED",
    );
    expect(deriveRunOutcome([row("STARTED"), fastRow("FAILED")])).toBe("FAILED");
  });

  it("all CREATED lane rows are QUEUED", () => {
    expect(deriveRunOutcome([row("CREATED"), fastRow("CREATED")])).toBe("QUEUED");
  });

  it("keeps the skipped-failure rule when nothing is STARTED or CREATED", () => {
    expect(
      deriveRunOutcome([row("COMPLETED"), fastRow("SKIPPED", { error: "boom" }), row("COMPLETED")]),
    ).toBe("COMPLETED_WITH_SKIPPED_FAILURE");
  });

  it("untagged rows keep today's results", () => {
    expect(deriveRunOutcome([])).toBe("CREATED");
    expect(deriveRunOutcome([row("COMPLETED"), row("STARTED"), row("COMPLETED")])).toBe(
      "COMPLETED",
    );
    expect(deriveRunOutcome([row("CREATED"), row("CREATED")])).toBe("QUEUED");
    expect(deriveRunOutcome([row("COMPLETED"), row("STARTED")])).toBe("STARTED");
  });
});

describe("getRunAttributes completedAt with lanes (P-6)", () => {
  const run = { id: "r1", run_type: "p", commands_count: 3 };

  it("uses the latest completedAt over COMPLETED rows in a lane run", () => {
    const rows = [
      row("COMPLETED", { completedAt: "2026-11-16T10:05:00.000Z" }),
      row("COMPLETED", {
        lane: "fast",
        barrier: true,
        toolId: "fast-1",
        toolType: "fast",
        completedAt: "2026-11-16T10:02:00.000Z",
      }),
      row("COMPLETED", { completedAt: "2026-11-16T10:00:00.000Z" }),
    ];
    const attrs = getRunAttributes(run, rows);
    expect(attrs.status).toBe("COMPLETED");
    expect(attrs.completedAt).toBe("2026-11-16T10:05:00.000Z");
  });

  it("an untagged run still uses the last row's completedAt", () => {
    const rows = [
      row("COMPLETED", { completedAt: "2026-11-16T10:05:00.000Z" }),
      row("COMPLETED", { completedAt: "2026-11-16T10:00:00.000Z" }),
    ];
    expect(getRunAttributes(run, rows).completedAt).toBe("2026-11-16T10:00:00.000Z");
  });
});

describe("describeLaneFailures (D-16, LUI-06)", () => {
  const f1: LaneFailureEntry = {
    lane: "primary",
    queueId: 1,
    toolId: "stack-1",
    toolType: "stack",
    message: "g-1",
    at: 1000,
  };
  const f2: LaneFailureEntry = {
    lane: "fast",
    queueId: 3,
    toolId: "fast-1",
    toolType: "fast",
    message: "boom",
    at: 2000,
  };
  const fmt = (t: number) => "T" + t;

  it("is null for zero or one failure", () => {
    expect(describeLaneFailures([], 0, fmt)).toBeNull();
    expect(describeLaneFailures([f1], 0, fmt)).toBeNull();
  });

  it("lists two failures with the first marked and not repeated", () => {
    expect(describeLaneFailures([f1, f2], 0, fmt)).toEqual({
      heading: "Failures by lane (2)",
      entries: [
        {
          lane: "primary",
          meta: "STACK · T1000",
          note: "First failure, shown above",
          message: null,
        },
        { lane: "fast", meta: "F.A.S.T. · T2000", note: null, message: "boom" },
      ],
      overflowLine: null,
    });
  });

  it("counts overflow in the heading and words it singular and plural", () => {
    const one = describeLaneFailures([f1, f2], 1, fmt);
    expect(one?.heading).toBe("Failures by lane (3)");
    expect(one?.overflowLine).toBe(
      "1 more failure not shown. Each failed step keeps its own error on its card.",
    );
    const two = describeLaneFailures([f1, f2], 2, fmt);
    expect(two?.heading).toBe("Failures by lane (4)");
    expect(two?.overflowLine).toBe(
      "2 more failures not shown. Each failed step keeps its own error on its card.",
    );
  });

  it("keeps the server's order", () => {
    const view = describeLaneFailures([f1, f2, { ...f1, lane: "side", at: 3000 }], 0, fmt);
    expect(view?.entries.map((e) => e.lane)).toEqual(["primary", "fast", "side"]);
  });
});

describe("laneStatus copy (UI-SPEC S5)", () => {
  it("holds the three halt sentences verbatim", () => {
    expect(laneHaltSentence("failure")).toBe(
      "A step failed. No new steps start on any lane. Steps already running finish on their own. Check the instrument, then press Start. A Start runs the failed step again.",
    );
    expect(laneHaltSentence("freeze")).toBe(
      "You froze the lanes. No new steps start on any lane. Steps already running finish on their own. Press Start to resume.",
    );
    expect(laneHaltSentence("modal")).toBe(
      "A prompt on the primary lane is open. No new steps start on any lane until it is closed. Steps already running are not affected.",
    );
    expect(Object.keys(LANE_HALT_SENTENCES).sort()).toEqual(["failure", "freeze", "modal"]);
  });

  it("explains why Freeze is disabled", () => {
    expect(FREEZE_DISABLED_FROZEN).toBe("Lanes are already frozen.");
    expect(FREEZE_DISABLED_IDLE).toBe("Nothing is running, so there is nothing to freeze.");
    expect(freezeDisabledReason({ halted: true, queueBusy: true })).toBe(
      "Lanes are already frozen.",
    );
    expect(freezeDisabledReason({ halted: true, queueBusy: false })).toBe(
      "Lanes are already frozen.",
    );
    expect(freezeDisabledReason({ halted: false, queueBusy: false })).toBe(
      "Nothing is running, so there is nothing to freeze.",
    );
    expect(freezeDisabledReason({ halted: false, queueBusy: true })).toBeNull();
  });

  it("shows the panel only for lane mode with lane rows", () => {
    expect(shouldShowLanesPanel(undefined)).toBe(false);
    expect(shouldShowLanesPanel({ laneMode: true, hasLaneRows: false })).toBe(false);
    expect(shouldShowLanesPanel({ laneMode: false, hasLaneRows: true })).toBe(false);
    expect(shouldShowLanesPanel({ laneMode: true, hasLaneRows: true })).toBe(true);
  });

  it("builds running lane chips", () => {
    const running: RunningLaneEntry[] = [
      { lane: "fast", queueId: 3, toolId: "fast-1", toolType: "fast", command: "transfer" },
      { lane: "primary", queueId: 4, toolId: "stack-1", toolType: "stack", command: "x" },
    ];
    expect(runningLaneChips(running)).toEqual(["fast · F.A.S.T.", "primary · STACK"]);
    expect(runningLaneChips([])).toEqual([]);
  });

  it("holds the Freeze confirm and toast copy", () => {
    expect(FREEZE_CONFIRM_COPY).toEqual({
      header: "Freeze lanes?",
      body: "Stops new steps on every lane. Steps already running continue and are not aborted. Press Start to resume.",
      confirm: "Freeze lanes",
      dismiss: "Keep lanes running",
    });
    expect(FREEZE_TOAST_COPY).toEqual({
      title: "Lanes frozen",
      description: "No new steps will start. Running steps continue. Press Start to resume.",
    });
    expect(freezeFailedDescription("Parallel lanes are disabled")).toBe(
      "Parallel lanes are disabled. Check the Lanes panel to see whether the lanes are frozen.",
    );
  });

  it("never promises an automatic resume or a one-click resume (D-13)", () => {
    for (const sentence of Object.values(LANE_HALT_SENTENCES)) {
      expect(sentence).not.toMatch(/automatically|resumes? by itself|will resume|one-click/i);
    }
  });
});

describe("lane card caption and done text (UI-SPEC S4, E5)", () => {
  const fmt = (t: number) => "T" + t;

  it("captions a running, queued, finished and failed step", () => {
    expect(laneCardCaption({ status: "STARTED", startedAt: 1000 }, fmt)).toEqual([
      "Started T1000 · running",
    ]);
    expect(laneCardCaption({ status: "CREATED" }, fmt)).toEqual(["Not started"]);
    expect(
      laneCardCaption({ status: "COMPLETED", startedAt: 1000, completedAt: 2000 }, fmt),
    ).toEqual(["Started T1000", "Ended T2000"]);
    expect(laneCardCaption({ status: "FAILED", startedAt: 1000 }, fmt)).toEqual(["Started T1000"]);
  });

  it("accepts ISO strings and dates", () => {
    const iso = "2026-11-16T10:00:00.000Z";
    const ms = new Date(iso).getTime();
    expect(
      laneCardCaption({ status: "COMPLETED", startedAt: iso, completedAt: new Date(iso) }, fmt),
    ).toEqual([`Started T${ms}`, `Ended T${ms}`]);
  });

  it("adds the barrier line for a barrier row", () => {
    expect(
      laneCardCaption(
        {
          status: "CREATED",
          commandInfo: { advancedParameters: { lane: "fast", laneBarrier: true } },
        },
        fmt,
      ),
    ).toEqual(["Not started", "Waits for all earlier steps"]);
  });

  it("counts COMPLETED and SKIPPED as done", () => {
    expect(
      laneDoneText([{ status: "COMPLETED" }, { status: "SKIPPED" }, { status: "CREATED" }]),
    ).toBe("2 of 3 done");
    expect(LANE_ROW_ALL_DONE).toBe("All steps in this lane are complete");
  });
});

describe("run-page lane helpers stay pure", () => {
  it("laneStatus, runOutcome and utils have no react, tsx import or timer", () => {
    for (const file of [
      "components/runs/laneStatus.ts",
      "components/runs/runOutcome.ts",
      "components/runs/utils.ts",
    ]) {
      const src = stripComments(source(file));
      expect(src, file).not.toMatch(/from "react"|\.tsx"/);
      expect(src, file).not.toMatch(/\b(?:window\.|globalThis\.)?set(?:Timeout|Interval)\(/);
    }
    expect(stripComments(source("components/runs/runOutcome.ts"))).not.toMatch(/green/i);
  });
});
