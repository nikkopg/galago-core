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
import {
  queuedStartLines,
  QUEUED_START_NOTE,
  QUEUED_START_LANES_HEADING,
  QUEUED_START_FREEZE_NOTE,
} from "@/components/runs/queuedStartSummary";
import type { QueuedStartRow } from "@/components/runs/queuedStartSummary";
import { describeQueueStart } from "@/server/queueStartListing";
import type { QueueStartRow } from "@/server/queueStartListing";
import {
  isToolStep,
  setLane,
  setBarrier,
  suggestLanes,
  laneHelperText,
  laneFlag,
  LANE_BARRIER_HELP,
  LANE_INERT_NOTE,
  buildLaneSummary,
  laneWarningText,
} from "@/components/protocols/laneFields";
import { validateLanes } from "@/server/laneScheduling";
import type { AdvancedParameters } from "@/types";
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
    banner: true,
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

  it("hides the message only of the banner entry, even when it is not the first (review WR-05)", () => {
    // The operator cleared lane primary's error, then lane fast failed and became the banner.
    const view = describeLaneFailures([{ ...f1, banner: false }, { ...f2, banner: true }], 0, fmt);
    expect(view?.entries).toEqual([
      { lane: "primary", meta: "STACK · T1000", note: null, message: "g-1" },
      { lane: "fast", meta: "F.A.S.T. · T2000", note: "Shown above", message: null },
    ]);
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

// ---------------------------------------------------------------------------
// Task 2: per-lane Start confirmation lines and the Queue Started audit listing
// ---------------------------------------------------------------------------

function queued(
  queueId: number,
  status: string,
  o: RowOpts & { runId?: string } = {},
): QueuedStartRow & QueueStartRow {
  return {
    queueId,
    runId: o.runId ?? "r1",
    status,
    commandInfo: {
      toolId: o.toolId ?? "stack-1",
      toolType: o.toolType ?? "stack",
      command: o.command ?? "transfer",
      advancedParameters: {
        ...(o.lane !== undefined ? { lane: o.lane } : {}),
        ...(o.barrier ? { laneBarrier: true } : {}),
      },
    },
  };
}

function headlineQueue(status = "CREATED"): Array<QueuedStartRow & QueueStartRow> {
  return [
    queued(1, status),
    queued(2, status),
    queued(3, status, { lane: "fast", barrier: true, toolId: "fast-1", toolType: "fast" }),
    queued(4, status),
    queued(5, status, { barrier: true }),
    queued(6, status),
  ];
}

describe("queuedStartLines per lane (D-20, LUI-04)", () => {
  const COUNT = "This Start will run 6 queued steps from 1 run.";

  it("lists the headline queue per lane, in first-appearance order, before the note", () => {
    expect(queuedStartLines({ rows: headlineQueue(), isError: false, laneMode: true })).toEqual([
      { text: COUNT, tone: "body" },
      { text: "Steps by lane (lane order is the order they first appear):", tone: "body" },
      { text: "Lane primary: 5 steps", tone: "body" },
      { text: "1. stack-1 · transfer", tone: "caption" },
      { text: "2. stack-1 · transfer", tone: "caption" },
      { text: "4. stack-1 · transfer", tone: "caption" },
      { text: "5. stack-1 · transfer · waits for all earlier steps", tone: "caption" },
      { text: "6. stack-1 · transfer", tone: "caption" },
      { text: "Lane fast: 1 step", tone: "body" },
      { text: "3. fast-1 · transfer · waits for all earlier steps", tone: "caption" },
      { text: QUEUED_START_NOTE, tone: "caption" },
    ]);
  });

  it("words command names with spaces", () => {
    const rows = [
      queued(1, "CREATED"),
      queued(2, "CREATED", { lane: "fast", command: "pick_plate" }),
    ];
    const lines = queuedStartLines({ rows, isError: false, laneMode: true });
    expect(lines.map((l) => l.text)).toContain("2. stack-1 · pick plate");
  });

  it("adds the freeze line before the note only when the lanes are frozen", () => {
    const frozen = queuedStartLines({
      rows: headlineQueue(),
      isError: false,
      laneMode: true,
      laneFrozen: true,
    });
    expect(frozen[frozen.length - 2]).toEqual({
      text: "Starting clears a lane freeze. Lanes then start again together.",
      tone: "caption",
    });
    expect(frozen[frozen.length - 1]).toEqual({ text: QUEUED_START_NOTE, tone: "caption" });
    const plain = queuedStartLines({
      rows: headlineQueue(),
      isError: false,
      laneMode: true,
      laneFrozen: false,
    });
    expect(plain.map((l) => l.text)).not.toContain(QUEUED_START_FREEZE_NOTE);
    const absent = queuedStartLines({ rows: headlineQueue(), isError: false, laneMode: true });
    expect(absent.map((l) => l.text)).not.toContain(QUEUED_START_FREEZE_NOTE);
  });

  it("never adds the freeze line for an untagged queue", () => {
    const rows = [queued(1, "CREATED"), queued(2, "CREATED")];
    const lines = queuedStartLines({ rows, isError: false, laneMode: true, laneFrozen: true });
    expect(lines.map((l) => l.text)).not.toContain(QUEUED_START_FREEZE_NOTE);
    expect(lines.map((l) => l.text)).not.toContain(QUEUED_START_LANES_HEADING);
  });

  it("does not list a STARTED row and gives no line to a lane with nothing queued", () => {
    const rows = headlineQueue();
    rows[2] = queued(3, "STARTED", {
      lane: "fast",
      barrier: true,
      toolId: "fast-1",
      toolType: "fast",
    });
    const texts = queuedStartLines({ rows, isError: false, laneMode: true }).map((l) => l.text);
    expect(texts).toContain("1 step still running. A Start is ignored until it ends.");
    expect(texts).not.toContain("Lane fast: 1 step");
    expect(texts.some((t) => t.startsWith("3. "))).toBe(false);
    // No queued row is on a non-primary lane any more, so there are no lane lines.
    expect(texts).not.toContain(QUEUED_START_LANES_HEADING);
  });

  it("lists a FAILED row first within its lane when it is first in queue order", () => {
    const rows = [
      queued(1, "COMPLETED"),
      queued(2, "FAILED", { lane: "fast", barrier: true, toolId: "fast-1", toolType: "fast" }),
      queued(3, "CREATED", { lane: "fast", toolId: "fast-1", toolType: "fast" }),
    ];
    const texts = queuedStartLines({ rows, isError: false, laneMode: true }).map((l) => l.text);
    const at = texts.indexOf("Lane fast: 2 steps");
    expect(at).toBeGreaterThan(-1);
    expect(texts[at + 1]).toBe("2. fast-1 · transfer · waits for all earlier steps");
    expect(texts[at + 2]).toBe("3. fast-1 · transfer");
    expect(texts).not.toContain("Lane primary: 1 step");
  });

  it("names every queued step with no cap", () => {
    const rows = [queued(1, "CREATED")];
    for (let i = 2; i <= 60; i++) rows.push(queued(i, "CREATED", { lane: "fast" }));
    const texts = queuedStartLines({ rows, isError: false, laneMode: true }).map((l) => l.text);
    expect(texts.filter((t) => /^\d+\. stack-1 · transfer$/.test(t))).toHaveLength(60);
  });

  it("positions are per run", () => {
    const rows = [
      queued(1, "CREATED", { runId: "r1" }),
      queued(2, "CREATED", { runId: "r2" }),
      queued(3, "CREATED", { runId: "r2", lane: "fast", barrier: true }),
    ];
    const texts = queuedStartLines({ rows, isError: false, laneMode: true }).map((l) => l.text);
    expect(texts).toContain("2. stack-1 · transfer · waits for all earlier steps");
  });

  it("is unchanged for an untagged queue", () => {
    const rows = [queued(1, "CREATED"), queued(2, "FAILED")];
    expect(queuedStartLines({ rows, isError: false, laneMode: true })).toEqual([
      { text: "This Start will run 2 queued steps from 1 run.", tone: "body" },
      { text: "1 of them failed before and will be retried first.", tone: "body" },
      { text: QUEUED_START_NOTE, tone: "caption" },
    ]);
  });
});

describe("describeQueueStart lane suffix (D-20)", () => {
  it("is unchanged for untagged rows", () => {
    const untagged: QueueStartRow[] = [
      { queueId: 1, runId: "r1", status: "CREATED" },
      { queueId: 2, runId: "r1", status: "CREATED" },
    ];
    const tagged = untagged.map((r) => ({
      ...r,
      commandInfo: queued(r.queueId, "CREATED").commandInfo,
    }));
    const expected = describeQueueStart(untagged, "operator", true);
    expect(expected).toBe(
      "Command Queue started by user. Will run 2 queued steps from 1 run. Queue order: queueId=1 runId=r1 status=CREATED; queueId=2 runId=r1 status=CREATED",
    );
    expect(describeQueueStart(tagged, "operator", true)).toBe(expected);
  });

  it("appends the lane listing for the headline rows", () => {
    const text = describeQueueStart(headlineQueue(), "operator", true);
    expect(text).toContain("Queue order: queueId=1 runId=r1 status=CREATED;");
    expect(
      text.endsWith(
        ". Lanes (first appearance): primary=1,2,4,5*,6; fast=3* (* waits for all earlier steps)",
      ),
    ).toBe(true);
  });

  it("lists the lanes after the '... and N more' suffix and only over the listed rows", () => {
    const rows: QueueStartRow[] = [];
    for (let i = 1; i <= 52; i++)
      rows.push(queued(i, "CREATED", { lane: i === 51 ? "late" : undefined }));
    const text = describeQueueStart(rows, "operator", true);
    expect(text).toContain("; ... and 2 more");
    // Rows 51 and 52 are beyond the 50 listed rows, so no lane line is added.
    expect(text).not.toContain("Lanes (first appearance)");
    rows[10] = queued(11, "CREATED", { lane: "fast" });
    const withLane = describeQueueStart(rows, "operator", true);
    expect(withLane).toMatch(/; \.\.\. and 2 more\. Lanes \(first appearance\): primary=/);
  });
});

describe("lane text follows the server lane mode (review WR-03)", () => {
  it("queuedStartLines lists no lane lines and no freeze note when lane mode is off or unknown", () => {
    const off = queuedStartLines({
      rows: headlineQueue(),
      isError: false,
      laneFrozen: true,
      laneMode: false,
    });
    const unknown = queuedStartLines({ rows: headlineQueue(), isError: false, laneFrozen: true });
    for (const lines of [off, unknown]) {
      const texts = lines.map((l) => l.text);
      expect(texts).not.toContain(QUEUED_START_LANES_HEADING);
      expect(texts).not.toContain(QUEUED_START_FREEZE_NOTE);
      expect(lines).toEqual([
        { text: "This Start will run 6 queued steps from 1 run.", tone: "body" },
        { text: QUEUED_START_NOTE, tone: "caption" },
      ]);
    }
  });

  it("describeQueueStart omits the lane listing for tagged rows unless lane mode is on", () => {
    const off = describeQueueStart(headlineQueue(), "operator");
    expect(off).not.toContain("Lanes (first appearance)");
    expect(describeQueueStart(headlineQueue(), "operator", false)).toBe(off);
    expect(describeQueueStart(headlineQueue(), "operator", true)).toContain(
      ". Lanes (first appearance): primary=",
    );
  });

  it("the editor names the inert lanes and the queue passes its lane mode to the audit line", () => {
    const view = source("components/protocols/ProtocolDetailView.tsx");
    expect(view).toContain("useLaneStatus()");
    expect(view).toContain("{!lanesActive && (");
    const queue = source("server/command_queue.ts");
    expect(queue).toContain(
      "describeQueueStart(this.commands.queuedRowsSync(), source, this._laneMode)",
    );
    const status = source("components/runs/status/QueueStatuscomponent.tsx");
    expect(status).toContain("laneStatusQuery.isSuccess ? laneStatusQuery.data : undefined");
    expect(status).toMatch(/laneFrozen,\s*laneMode,/);
  });
});

// ---------------------------------------------------------------------------
// Task 3: drawer and preview helpers (laneFields.ts)
// ---------------------------------------------------------------------------

function step(o: RowOpts = {}): any {
  const advancedParameters: Record<string, unknown> = {};
  if (o.lane !== undefined) advancedParameters.lane = o.lane;
  if (o.barrier) advancedParameters.laneBarrier = true;
  return {
    toolId: o.toolId ?? "stack-1",
    toolType: o.toolType ?? "stack",
    command: o.command ?? "transfer",
    params: o.params ?? {},
    advancedParameters,
  };
}

const FAST = { lane: "fast", toolId: "fast-1", toolType: "fast" };

function headlineSteps(): any[] {
  return [
    step(),
    step(),
    step({ ...FAST, barrier: true }),
    step(),
    step({ barrier: true }),
    step(),
  ];
}

function adv(extra: Record<string, unknown> = {}): AdvancedParameters {
  return {
    skipExecutionVariable: { variable: "v", value: "x" },
    runAsynchronously: false,
    ...extra,
  } as AdvancedParameters;
}

describe("laneFields stored shape (D-01, D-02, Pitfall 24b)", () => {
  it("isToolStep is false for a Tool Box step and true for a tool step", () => {
    expect(isToolStep({ toolId: "Tool Box", toolType: "toolbox" })).toBe(false);
    expect(isToolStep({ toolId: "fast-1", toolType: "fast" })).toBe(true);
  });

  it("setLane trims and lower-cases into a new object", () => {
    const input = adv();
    const out = setLane(input, "  Fast ");
    expect(out).toEqual({ ...input, lane: "fast" });
    expect(out).not.toBe(input);
    expect("lane" in input).toBe(false);
  });

  it("setLane deletes the key for blank or primary and never writes an empty lane", () => {
    for (const raw of ["", "   ", "primary", "  PRIMARY "]) {
      const input = adv({ lane: "fast" });
      const out = setLane(input, raw);
      expect("lane" in out).toBe(false);
      expect(input.lane).toBe("fast");
    }
  });

  it("keeps skipExecutionVariable and runAsynchronously false unchanged", () => {
    const out = setLane(adv({ laneBarrier: true }), "fast");
    expect(out.runAsynchronously).toBe(false);
    expect(out.skipExecutionVariable).toEqual({ variable: "v", value: "x" });
    expect(out.laneBarrier).toBe(true);
    const off = setLane(adv(), "");
    expect(off.runAsynchronously).toBe(false);
    expect(Object.keys(off).sort()).toEqual(["runAsynchronously", "skipExecutionVariable"]);
  });

  it("setBarrier adds true and deletes the key when off, never writing false", () => {
    const input = adv({ lane: "fast" });
    const on = setBarrier(input, true);
    expect(on).toEqual({ ...input, laneBarrier: true });
    expect(on).not.toBe(input);
    expect("laneBarrier" in input).toBe(false);
    const off = setBarrier(on, false);
    expect("laneBarrier" in off).toBe(false);
    expect(on.laneBarrier).toBe(true);
    expect(off.lane).toBe("fast");
    expect(off.runAsynchronously).toBe(false);
  });

  it("lane and barrier are stored or deleted independently", () => {
    const a = setBarrier(adv(), true);
    expect("lane" in a).toBe(false);
    expect(a.laneBarrier).toBe(true);
    const b = setLane(a, "fast");
    expect(b.laneBarrier).toBe(true);
    expect(b.lane).toBe("fast");
    const c = setLane(b, "");
    expect(c.laneBarrier).toBe(true);
    expect("lane" in c).toBe(false);
  });
});

describe("laneFields suggestions and helper text (E1, S1)", () => {
  it("suggests primary first then each lane in first-appearance order, never preselecting", () => {
    expect(suggestLanes([])).toEqual(["primary"]);
    const steps = [
      step(),
      step({ lane: "fast" }),
      step(),
      step({ lane: "side" }),
      step({ lane: "fast" }),
    ];
    expect(suggestLanes(steps)).toEqual(["primary", "fast", "side"]);
  });

  it("ignores a Tool Box step tagged with a lane", () => {
    const tb = step({ lane: "x", toolId: "Tool Box", toolType: "toolbox" });
    expect(suggestLanes([tb])).toEqual(["primary"]);
  });

  it("caps the suggestions at primary plus four lanes", () => {
    const steps = ["a", "b", "c", "d", "e"].map((lane) => step({ lane }));
    expect(suggestLanes(steps)).toEqual(["primary", "a", "b", "c", "d"]);
  });

  it("words the helper line", () => {
    expect(laneHelperText(["primary"])).toBe(
      "Blank means the primary lane. No other lanes are used in this protocol yet.",
    );
    expect(laneHelperText(["primary", "fast"])).toBe(
      "Blank means the primary lane. Lanes in this protocol: primary, fast",
    );
  });

  it("holds the barrier help and inert-flag note verbatim", () => {
    expect(LANE_BARRIER_HELP).toBe(
      "Runs only after every earlier step on every lane has finished. Use it before a step that needs the plates in place.",
    );
    expect(LANE_INERT_NOTE).toBe(
      "Lanes take effect only when parallel lanes are enabled on the server.",
    );
  });
});

describe("laneFlag author-time warnings (D-18, never blocking)", () => {
  it("flags an invalid lane name", () => {
    expect(laneFlag([step()], 0, adv({ lane: "Fast Lane" }))).toBe(
      "Lane name 'fast lane' is not valid. Use 1 to 32 characters: a-z, 0-9, - and _.",
    );
  });

  it("flags a fifth distinct lane", () => {
    const steps = [
      step({ toolId: "t0" }),
      step({ toolId: "t1", lane: "a", barrier: true }),
      step({ toolId: "t2", lane: "b", barrier: true }),
      step({ toolId: "t3", lane: "c", barrier: true }),
      step({ toolId: "t4" }),
    ];
    expect(laneFlag(steps, 4, adv({ lane: "d", laneBarrier: true }))).toBe(
      "This protocol would use 5 lanes. A run can use at most 4.",
    );
    expect(laneFlag(steps, 4, adv({ lane: "c", laneBarrier: true }))).toBeNull();
  });

  it("flags the same tool already on another lane", () => {
    const steps = [step(), step()];
    expect(laneFlag(steps, 1, adv({ lane: "fast", laneBarrier: true }))).toBe(
      "stack-1 is already on lane 'primary'. One tool can use only one lane per run.",
    );
  });

  it("flags a first secondary step without the barrier, except at position 1 or with it on", () => {
    const steps = [step(), step(), step(FAST)];
    const message =
      "The first step on lane 'fast' should wait for all earlier steps, so it starts only after the plates are placed.";
    expect(laneFlag(steps, 2, adv({ lane: "fast" }))).toBe(message);
    expect(laneFlag(steps, 2, adv({ lane: "fast", laneBarrier: true }))).toBeNull();
    expect(laneFlag([step(FAST)], 0, adv({ lane: "fast" }))).toBeNull();
  });

  it("does not flag the barrier on a later step of a lane that already has a first step", () => {
    const steps = [step(), step({ ...FAST, barrier: true }), step(FAST)];
    expect(laneFlag(steps, 2, adv({ lane: "fast" }))).toBeNull();
  });

  it("gives null for a blank lane", () => {
    expect(laneFlag([step(), step()], 1, adv())).toBeNull();
    expect(laneFlag([step(), step()], 1, adv({ laneBarrier: true }))).toBeNull();
  });

  it("returns the first matching flag in S1 order", () => {
    const steps = [step(), step()];
    expect(laneFlag(steps, 1, adv({ lane: "Bad Name" }))).toMatch(/is not valid/);
  });
});

describe("buildLaneSummary (D-20, LUI-04)", () => {
  it("is null for an untagged protocol", () => {
    expect(buildLaneSummary([step(), step()])).toBeNull();
    expect(buildLaneSummary([])).toBeNull();
    expect(buildLaneSummary([step({ lane: "primary" })])).toBeNull();
  });

  it("groups the headline protocol in visual style", () => {
    expect(buildLaneSummary(headlineSteps())).toEqual({
      groups: [
        {
          lane: "primary",
          header: "Lane primary · 5 steps",
          lines: [
            "1. [stack-1] transfer",
            "2. [stack-1] transfer",
            "4. [stack-1] transfer",
            "5. [stack-1] transfer — waits for all earlier steps",
            "6. [stack-1] transfer",
          ],
        },
        {
          lane: "fast",
          header: "Lane fast · 1 step",
          lines: ["3. [fast-1] transfer — waits for all earlier steps"],
        },
      ],
      warnings: [],
    });
  });

  it("uses command words in visual style", () => {
    const summary = buildLaneSummary([
      step({ command: "pick_plate" }),
      step({ ...FAST, command: "go_home" }),
    ]);
    expect(summary?.groups[0].lines).toEqual(["1. [stack-1] pick plate"]);
    expect(summary?.groups[1].lines).toEqual(["2. [fast-1] go home"]);
  });

  it("uses the raw command and params JSON in script style", () => {
    const steps = headlineSteps();
    steps[2] = step({ ...FAST, barrier: true, params: { a: 1 } });
    const summary = buildLaneSummary(steps, { style: "script" });
    expect(summary?.groups[1].lines).toEqual([
      '3. [fast-1] transfer — {"a":1} — waits for all earlier steps',
    ]);
    expect(summary?.groups[0].lines[0]).toBe("1. [stack-1] transfer");
  });

  it("carries validateLanes warnings, including a Tool Box step on a secondary lane", () => {
    const steps = [
      step(),
      step({ ...FAST, barrier: true }),
      step({ lane: "fast", toolId: "Tool Box", toolType: "toolbox", command: "note" }),
    ];
    const summary = buildLaneSummary(steps);
    expect(summary?.warnings).toEqual(validateLanes(steps));
    expect(summary?.warnings).toContain(
      "Step 3 (note) is on lane 'fast', but only tool steps can run on a secondary lane. Move it to the primary lane.",
    );
  });

  it("still surfaces refusal warnings when a bad tag leaves every step on primary", () => {
    const summary = buildLaneSummary([step(), step({ lane: "Bad Name" })]);
    expect(summary).toEqual({
      groups: [],
      warnings: ["Lane name 'bad name' is not valid. Use 1 to 32 characters: a-z, 0-9, - and _."],
    });
  });

  it("capitalises a server lane warning", () => {
    expect(laneWarningText("lane tags ignored: parallel lanes disabled")).toBe(
      "Lane tags ignored: parallel lanes disabled",
    );
    expect(laneWarningText("")).toBe("");
  });
});

describe("laneFields stays pure and preselects nothing", () => {
  it("has no react import, tsx import or timer", () => {
    const src = stripComments(source("components/protocols/laneFields.ts"));
    expect(src).not.toMatch(/from "react"|\.tsx"/);
    expect(src).not.toMatch(/\b(?:window\.|globalThis\.)?set(?:Timeout|Interval)\(/);
  });

  it("a new step starts on primary with the barrier off", () => {
    const fresh = adv();
    expect("lane" in fresh).toBe(false);
    expect("laneBarrier" in fresh).toBe(false);
    expect(laneFlag([step()], 0, fresh)).toBeNull();
    expect(suggestLanes([step()])).toEqual(["primary"]);
  });
});

describe("editor lane wiring pins (D-18, D-20)", () => {
  const drawer = source("components/protocols/CommandDetailsDrawer.tsx");
  const view = source("components/protocols/ProtocolDetailView.tsx");

  it("the drawer wires the lane controls through the pure helpers", () => {
    for (const needle of [
      "isToolStep(",
      "setLane(",
      "setBarrier(",
      'id="lane-suggestions"',
      'placeholder="primary"',
      "Wait for all earlier steps",
      "LANE_INERT_NOTE",
      "isChecked={advancedParams.runAsynchronously || false}",
    ]) {
      expect(drawer, needle).toContain(needle);
    }
  });

  it("the Lane block sits between Value to Match and Run Asynchronously", () => {
    const lane = drawer.indexOf('id="lane-suggestions"');
    expect(lane).toBeGreaterThan(drawer.indexOf("Value to Match"));
    expect(lane).toBeLessThan(drawer.indexOf("Run Asynchronously"));
  });

  it("the drawer never writes an empty lane, a false barrier or a preselected lane", () => {
    const src = stripComments(drawer);
    expect(src).not.toMatch(/lane:\s*(?:""|'')/);
    expect(src).not.toMatch(/laneBarrier:\s*(?:false|true)/);
    expect(src).not.toMatch(/defaultValue/);
    expect(src).toContain("handleRunAsyncChange");
  });

  it("the protocol view builds the lane summary and the warnings Alert", () => {
    for (const needle of [
      "buildLaneSummary(",
      "laneWarnings",
      'variant="left-accent"',
      "Generated Commands (",
      "protocolCommands={commands}",
    ]) {
      expect(view, needle).toContain(needle);
    }
    expect(view.split("runAsynchronously: false").length - 1).toBe(2);
  });

  it("neither component injects raw HTML", () => {
    expect(drawer).not.toMatch(/dangerouslySetInnerHTML/);
    expect(view).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("the run-page drawer host passes no protocolCommands, so it stays read-only", () => {
    const runs = source("components/runs/list/SwimLaneComponent.tsx");
    expect(runs).not.toContain("protocolCommands");
  });
});
