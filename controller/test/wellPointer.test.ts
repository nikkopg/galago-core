// Node-only sequence tests for the source-grid drag state machine (07-10,
// WR-01, PLT-08). No DOM and no new dependency: the reducer is pure.

import { describe, expect, it } from "vitest";
import {
  sourcePointerStep,
  type SourceDragState,
  type SourcePointerInput,
  type SourcePointerResult,
} from "@/components/tools/wellPointer";
import type { Cell } from "@/components/tools/wellGeometry";

const A1: Cell = { r: 0, c: 0 };
const B3: Cell = { r: 1, c: 2 };
const C4: Cell = { r: 2, c: 3 };
const D5: Cell = { r: 3, c: 4 };

const down = (cell: Cell | undefined, captured: boolean, button = 0): SourcePointerInput => ({
  type: "down",
  button,
  cell,
  captured,
});
const move = (cell: Cell | undefined, buttons = 1): SourcePointerInput => ({
  type: "move",
  buttons,
  cell,
});

// Runs a sequence, returning every result so a test can count patches.
function run(inputs: SourcePointerInput[], start: SourceDragState = undefined) {
  let state = start;
  const results: SourcePointerResult[] = [];
  for (const input of inputs) {
    const result = sourcePointerStep(state, input);
    results.push(result);
    state = result.state;
  }
  return { state, results, patches: results.filter((r) => r.patch !== undefined) };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

const BLOCK_B3_D5 = { source_start_row: "B", source_start_col: 3, num_rows: 3, num_cols: 3 };

describe("sourcePointerStep: down", () => {
  it("a primary down on a cell starts a drag and writes the 1x1 block", () => {
    const r = sourcePointerStep(undefined, down(B3, true));
    expect(r.state).toStrictEqual({ anchor: B3, last: { r: 1, c: 2, h: 1, w: 1 }, captured: true });
    expect(r.patch).toStrictEqual({
      source_start_row: "B",
      source_start_col: 3,
      num_rows: 1,
      num_cols: 1,
    });
  });

  it("a secondary-button down writes nothing", () => {
    const r = sourcePointerStep(undefined, down(B3, true, 2));
    expect(r.state).toBeUndefined();
    expect("patch" in r).toBe(false);
  });

  it("a down with no cell writes nothing", () => {
    const r = sourcePointerStep(undefined, down(undefined, false));
    expect(r.state).toBeUndefined();
    expect("patch" in r).toBe(false);
  });
});

describe("sourcePointerStep: move", () => {
  it("writes the rectangle once per distinct rectangle", () => {
    const { results } = run([down(B3, true), move(D5), move(D5)]);
    expect(results[1].patch).toStrictEqual(BLOCK_B3_D5);
    expect(results[2].state).toStrictEqual(results[1].state);
    expect("patch" in results[2]).toBe(false);
  });

  it("normalises a drag in any direction", () => {
    const { results } = run([down(D5, true), move(B3)]);
    expect(results[1].patch).toStrictEqual(BLOCK_B3_D5);
  });

  it("from idle a move writes nothing", () => {
    const r = sourcePointerStep(undefined, move(D5));
    expect(r.state).toBeUndefined();
    expect("patch" in r).toBe(false);
  });

  it("a move with no cell keeps the drag and writes nothing", () => {
    const started = sourcePointerStep(undefined, down(B3, true)).state;
    const r = sourcePointerStep(started, move(undefined));
    expect(r.state).toBe(started);
    expect("patch" in r).toBe(false);
  });
});

describe("sourcePointerStep: WR-01 no button held", () => {
  it("capture refused: a move with no button ends the drag and later hovers write nothing", () => {
    const { results } = run([down(B3, false), move(C4), move(C4, 0), move(D5)]);
    expect(results[1].patch).toBeDefined();
    expect(results[2].state).toBeUndefined();
    expect("patch" in results[2]).toBe(false);
    expect(results[3].state).toBeUndefined();
    expect("patch" in results[3]).toBe(false);
  });

  it("captured: a move with no button also ends the drag", () => {
    const { results } = run([down(B3, true), move(C4, 0), move(D5)]);
    expect(results[1].state).toBeUndefined();
    expect("patch" in results[1]).toBe(false);
    expect("patch" in results[2]).toBe(false);
  });
});

describe("sourcePointerStep: leave", () => {
  it("an uncaptured leave ends the drag with no patch", () => {
    const { results } = run([down(B3, false), { type: "leave" }, move(D5)]);
    expect(results[1].state).toBeUndefined();
    expect("patch" in results[1]).toBe(false);
    expect("patch" in results[2]).toBe(false);
  });

  it("a captured leave keeps the drag and the clamped cell keeps updating", () => {
    const { results } = run([down(B3, true), { type: "leave" }, move(A1)]);
    expect(results[1].state).toBe(results[0].state);
    expect("patch" in results[1]).toBe(false);
    expect(results[2].patch).toStrictEqual({
      source_start_row: "A",
      source_start_col: 1,
      num_rows: 2,
      num_cols: 3,
    });
  });
});

describe("sourcePointerStep: up, cancel and lost capture", () => {
  for (const type of ["up", "cancel", "lost-capture"] as const) {
    it(`${type} ends an active drag and a later move writes nothing`, () => {
      const { results } = run([down(B3, true), { type }, move(D5)]);
      expect(results[1].state).toBeUndefined();
      expect("patch" in results[1]).toBe(false);
      expect(results[2].state).toBeUndefined();
      expect("patch" in results[2]).toBe(false);
    });
  }

  it("from idle every terminating event and a stray move write nothing", () => {
    const inputs: SourcePointerInput[] = [
      { type: "up" },
      { type: "cancel" },
      { type: "lost-capture" },
      { type: "leave" },
      move(D5),
    ];
    for (const input of inputs) {
      const r = sourcePointerStep(undefined, input);
      expect(r.state).toBeUndefined();
      expect("patch" in r).toBe(false);
    }
  });
});

describe("sourcePointerStep: whole gestures", () => {
  it("emits exactly three patches for down, move, move, move, up, then hovers", () => {
    const { patches, state } = run([
      down(B3, true),
      move(C4),
      move(D5),
      move(D5),
      { type: "up" },
      move(A1, 0),
      move(C4, 0),
      move(D5, 0),
    ]);
    expect(patches).toHaveLength(3);
    expect(state).toBeUndefined();
  });

  it("never mutates frozen input and never throws", () => {
    const state = deepFreeze(sourcePointerStep(undefined, down(B3, true)).state);
    const inputs: SourcePointerInput[] = [
      deepFreeze(move(D5)),
      deepFreeze(move(D5, 0)),
      deepFreeze({ type: "leave" as const }),
      deepFreeze({ type: "up" as const }),
      deepFreeze({ type: "cancel" as const }),
      deepFreeze({ type: "lost-capture" as const }),
      deepFreeze(down(C4, false)),
    ];
    for (const input of inputs) {
      expect(() => sourcePointerStep(state, input)).not.toThrow();
    }
    expect(state).toStrictEqual({ anchor: B3, last: { r: 1, c: 2, h: 1, w: 1 }, captured: true });
  });
});
