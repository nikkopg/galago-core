import { describe, it, expect } from "vitest";
import {
  summarizeQueuedStart,
  queuedStartLines,
  QUEUED_START_EMPTY,
  QUEUED_START_LOADING,
  QUEUED_START_ERROR,
  QUEUED_START_NOTE,
} from "@/components/runs/queuedStartSummary";
import type { QueuedStartRow } from "@/components/runs/queuedStartSummary";

function makeRow(overrides: Partial<QueuedStartRow> = {}): QueuedStartRow {
  return { status: "CREATED", runId: "run-1", ...overrides };
}

const NOTE_LINE = { text: QUEUED_START_NOTE, tone: "caption" };

describe("summarizeQueuedStart counts (QUE-08, D-06)", () => {
  it("an empty list is empty with every count zero", () => {
    expect(summarizeQueuedStart([])).toEqual({
      willRun: 0,
      failed: 0,
      started: 0,
      runs: 0,
      isEmpty: true,
    });
  });

  it("counts CREATED and FAILED as will-run, FAILED as retries, and distinct runs", () => {
    const rows = [
      makeRow({ status: "CREATED", runId: "r1" }),
      makeRow({ status: "FAILED", runId: "r1" }),
      makeRow({ status: "CREATED", runId: "r2" }),
    ];
    expect(summarizeQueuedStart(rows)).toEqual({
      willRun: 3,
      failed: 1,
      started: 0,
      runs: 2,
      isEmpty: false,
    });
  });

  it("a STARTED row increments started only and is not part of will-run or runs", () => {
    const summary = summarizeQueuedStart([makeRow({ status: "STARTED", runId: "r9" })]);
    expect(summary).toEqual({ willRun: 0, failed: 0, started: 1, runs: 0, isEmpty: false });
  });

  it("COMPLETED, SKIPPED and unknown statuses are ignored", () => {
    const rows = [
      makeRow({ status: "COMPLETED" }),
      makeRow({ status: "SKIPPED" }),
      makeRow({ status: "WHATEVER" }),
    ];
    expect(summarizeQueuedStart(rows)).toEqual({
      willRun: 0,
      failed: 0,
      started: 0,
      runs: 0,
      isEmpty: true,
    });
  });
});

describe("queuedStartLines copy (UI-SPEC S1)", () => {
  it("loading: no data yet shows the checking line then the note", () => {
    expect(queuedStartLines({ rows: undefined, isError: false })).toEqual([
      { text: QUEUED_START_LOADING, tone: "caption" },
      NOTE_LINE,
    ]);
    expect(QUEUED_START_LOADING).toBe("Checking the queue...");
  });

  it("error: wins over data and shows the could-not-read line then the note", () => {
    const rows = [makeRow()];
    expect(queuedStartLines({ rows, isError: true })).toEqual([
      { text: QUEUED_START_ERROR, tone: "caption" },
      NOTE_LINE,
    ]);
    expect(QUEUED_START_ERROR).toBe(
      "Could not read the queue. Logs list the steps this Start ran.",
    );
  });

  it("empty: no rows shows The queue is empty. then the note", () => {
    expect(queuedStartLines({ rows: [], isError: false })).toEqual([
      { text: QUEUED_START_EMPTY, tone: "body" },
      NOTE_LINE,
    ]);
    expect(QUEUED_START_EMPTY).toBe("The queue is empty.");
  });

  it("one CREATED row reads singular and has no retry line", () => {
    const lines = queuedStartLines({ rows: [makeRow()], isError: false });
    expect(lines).toEqual([
      { text: "This Start will run 1 queued step from 1 run.", tone: "body" },
      NOTE_LINE,
    ]);
  });

  it("three rows from two runs with one FAILED adds the retry line", () => {
    const rows = [
      makeRow({ status: "CREATED", runId: "r1" }),
      makeRow({ status: "FAILED", runId: "r1" }),
      makeRow({ status: "CREATED", runId: "r2" }),
    ];
    expect(queuedStartLines({ rows, isError: false })).toEqual([
      { text: "This Start will run 3 queued steps from 2 runs.", tone: "body" },
      { text: "1 of them failed before and will be retried first.", tone: "body" },
      NOTE_LINE,
    ]);
  });

  it("a single FAILED row reads It failed before and will be retried first.", () => {
    const rows = [makeRow({ status: "FAILED" })];
    expect(queuedStartLines({ rows, isError: false })).toEqual([
      { text: "This Start will run 1 queued step from 1 run.", tone: "body" },
      { text: "It failed before and will be retried first.", tone: "body" },
      NOTE_LINE,
    ]);
  });

  it("several FAILED rows count N of them", () => {
    const rows = [
      makeRow({ status: "FAILED", runId: "r1" }),
      makeRow({ status: "FAILED", runId: "r2" }),
    ];
    const lines = queuedStartLines({ rows, isError: false });
    expect(lines[0].text).toBe("This Start will run 2 queued steps from 2 runs.");
    expect(lines[1].text).toBe("2 of them failed before and will be retried first.");
  });

  it("STARTED rows get their own caption line, singular and plural", () => {
    const one = queuedStartLines({
      rows: [
        makeRow({ status: "STARTED", runId: "r1" }),
        makeRow({ status: "CREATED", runId: "r2" }),
        makeRow({ status: "CREATED", runId: "r2" }),
      ],
      isError: false,
    });
    expect(one).toEqual([
      { text: "This Start will run 2 queued steps from 1 run.", tone: "body" },
      { text: "1 step still running. A Start is ignored until it ends.", tone: "caption" },
      NOTE_LINE,
    ]);

    const two = queuedStartLines({
      rows: [
        makeRow({ status: "STARTED", runId: "r1" }),
        makeRow({ status: "STARTED", runId: "r1" }),
        makeRow({ status: "CREATED", runId: "r1" }),
      ],
      isError: false,
    });
    expect(two[1]).toEqual({
      text: "2 steps still running. A Start is ignored until it ends.",
      tone: "caption",
    });
  });

  it("only STARTED rows show the still-running caption and the note, no empty line", () => {
    const lines = queuedStartLines({
      rows: [makeRow({ status: "STARTED" })],
      isError: false,
    });
    expect(lines).toEqual([
      { text: "1 step still running. A Start is ignored until it ends.", tone: "caption" },
      NOTE_LINE,
    ]);
    expect(lines.map((l) => l.text)).not.toContain(QUEUED_START_EMPTY);
  });

  it("the last line is always the note, as a caption", () => {
    const inputs = [
      { rows: undefined, isError: false },
      { rows: [], isError: false },
      { rows: [makeRow()], isError: true },
      { rows: [makeRow({ status: "FAILED" }), makeRow({ status: "STARTED" })], isError: false },
    ];
    for (const input of inputs) {
      const lines = queuedStartLines(input);
      expect(lines[lines.length - 1]).toEqual(NOTE_LINE);
    }
    expect(QUEUED_START_NOTE).toBe(
      "Counts refresh every second. Logs list the exact steps this Start ran.",
    );
  });

  it("the summary is counts only: line count is bounded regardless of queue size", () => {
    const rows = Array.from({ length: 500 }, (_, i) =>
      makeRow({ status: i % 2 === 0 ? "FAILED" : "CREATED", runId: `r${i}` }),
    );
    expect(queuedStartLines({ rows, isError: false }).length).toBeLessThanOrEqual(4);
  });
});
