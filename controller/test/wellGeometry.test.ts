// Unit suite for the React-free well-picker core (07-02). Runs in the node
// environment: wellGeometry.ts imports no React or Chakra, so every decision
// the WellPicker makes is pinned here against fixture plates.

import { describe, expect, it } from "vitest";
import {
  CLEAR_PATCH,
  WELL_FIELDS,
  cellFromPoint,
  destPatch,
  dragRect,
  fitsAt,
  gridMetrics,
  isBlankWell,
  isWellField,
  mismatchText,
  parseRowLabel,
  rowLabel,
  sizeMismatch,
  sourcePatch,
  wellFieldPatch,
  wellFieldText,
  wellSizePx,
} from "@/components/tools/wellGeometry";
import { PLATE_384, PLATE_96 } from "./fixtures/fastPlates";

describe("WELL_FIELDS", () => {
  it("is exactly the six well fields in mockup order", () => {
    expect([...WELL_FIELDS]).toEqual([
      "source_start_row",
      "source_start_col",
      "num_rows",
      "num_cols",
      "dest_start_row",
      "dest_start_col",
    ]);
  });

  it("isWellField recognises only the six names", () => {
    expect(isWellField("num_rows")).toBe(true);
    expect(isWellField("volume")).toBe(false);
  });
});

describe("rowLabel", () => {
  it.each([
    [0, "A"],
    [25, "Z"],
    [26, "AA"],
    [27, "AB"],
    [31, "AF"],
    [51, "AZ"],
    [52, "BA"],
  ])("rowLabel(%i) is %s", (i, label) => {
    expect(rowLabel(i)).toBe(label);
  });
});

describe("parseRowLabel", () => {
  it.each([
    ["A", 0],
    ["a", 0],
    ["AF", 31],
    ["af", 31],
    ["Aa", 26],
  ])("parses %s to %i", (label, i) => {
    expect(parseRowLabel(label)).toBe(i);
  });

  it.each(["", "ABC", "A1", " A", "A ", "Ä", 1, null, undefined])(
    "rejects %j (strict 1-2 ASCII letters, no trim)",
    (v) => {
      expect(parseRowLabel(v)).toBeUndefined();
    },
  );

  it("round-trips rowLabel for indexes 0..31", () => {
    for (let i = 0; i <= 31; i++) expect(parseRowLabel(rowLabel(i))).toBe(i);
  });
});

describe("isBlankWell", () => {
  it.each([undefined, null, "", 0])("%j is blank (legacy 0 included)", (v) => {
    expect(isBlankWell(v)).toBe(true);
  });
  it.each(["0", "A", 1, false])("%j is not blank", (v) => {
    expect(isBlankWell(v)).toBe(false);
  });
});

describe("dragRect", () => {
  it("normalises all four drag directions to the same rectangle", () => {
    const want = { r: 1, c: 2, h: 3, w: 4 };
    expect(dragRect({ r: 1, c: 2 }, { r: 3, c: 5 })).toEqual(want);
    expect(dragRect({ r: 3, c: 5 }, { r: 1, c: 2 })).toEqual(want);
    expect(dragRect({ r: 1, c: 5 }, { r: 3, c: 2 })).toEqual(want);
    expect(dragRect({ r: 3, c: 2 }, { r: 1, c: 5 })).toEqual(want);
  });

  it("a drag whose anchor and current cell are the same cell is a 1x1 block", () => {
    expect(dragRect({ r: 4, c: 7 }, { r: 4, c: 7 })).toEqual({ r: 4, c: 7, h: 1, w: 1 });
  });
});

describe("fitsAt", () => {
  it("a block exactly touching the last row and column fits", () => {
    expect(fitsAt({ r: 0, c: 0 }, { h: 8, w: 12 }, PLATE_96)).toBe(true);
    expect(fitsAt({ r: 7, c: 11 }, { h: 1, w: 1 }, PLATE_96)).toBe(true);
  });

  it("one cell further does not fit", () => {
    expect(fitsAt({ r: 1, c: 0 }, { h: 8, w: 12 }, PLATE_96)).toBe(false);
    expect(fitsAt({ r: 7, c: 11 }, { h: 1, w: 2 }, PLATE_96)).toBe(false);
  });

  it("a negative origin never fits", () => {
    expect(fitsAt({ r: -1, c: 0 }, { h: 1, w: 1 }, PLATE_96)).toBe(false);
    expect(fitsAt({ r: 0, c: -1 }, { h: 1, w: 1 }, PLATE_96)).toBe(false);
  });
});

describe("sizeMismatch and mismatchText", () => {
  it("compares the (rows, cols) pair", () => {
    expect(sizeMismatch({ rows: 8, cols: 12 }, { rows: 8, cols: 12 })).toBe(false);
    expect(sizeMismatch({ rows: 8, cols: 12 }, { rows: 12, cols: 8 })).toBe(true);
    expect(sizeMismatch({ rows: 4, cols: 6 }, { rows: 3, cols: 8 })).toBe(true);
    expect(sizeMismatch(PLATE_96, PLATE_384)).toBe(true);
  });

  it("mismatchText is the exact UI-SPEC warning", () => {
    expect(mismatchText({ rows: 8, cols: 12 }, { rows: 16, cols: 24 })).toBe(
      "Plates differ in size (8×12 vs 16×24) — the F.A.S.T. refuses cross-format transfers (-9006)",
    );
  });
});

describe("wellSizePx and gridMetrics", () => {
  it.each([
    [1, 18],
    [12, 18],
    [13, 18],
    [24, 12],
    [48, 8],
    [40, 8],
  ])("wellSizePx(%i) is %i", (cols, px) => {
    expect(wellSizePx(cols)).toBe(px);
  });

  it("gridMetrics for 8x12 matches the UI-SPEC internals", () => {
    expect(gridMetrics({ rows: 8, cols: 12 })).toEqual({
      cell: 18,
      gap: 3,
      gutterX: 14,
      headerY: 18,
    });
  });

  it("gridMetrics for 32x48 has the 8 px well and the wide gutter", () => {
    const m = gridMetrics({ rows: 32, cols: 48 });
    expect(m.cell).toBe(8);
    expect(m.gutterX).toBe(20);
  });
});

describe("cellFromPoint (arithmetic hit-test)", () => {
  const box = { left: 100, top: 50 };
  const metrics = () => gridMetrics(PLATE_96);

  it("a point inside the first well is (0,0)", () => {
    expect(cellFromPoint(120, 75, box, metrics(), PLATE_96, false)).toEqual({ r: 0, c: 0 });
  });

  it("a point in the 3 px gap right after well (0,0) still resolves to (0,0)", () => {
    expect(cellFromPoint(136, 75, box, metrics(), PLATE_96, false)).toEqual({ r: 0, c: 0 });
  });

  it("a point in the row-label gutter is undefined without clamp and column 0 with clamp", () => {
    expect(cellFromPoint(105, 75, box, metrics(), PLATE_96, false)).toBeUndefined();
    expect(cellFromPoint(105, 75, box, metrics(), PLATE_96, true)?.c).toBe(0);
  });

  it("a point past the last column is undefined without clamp and the last column with clamp", () => {
    expect(cellFromPoint(400, 75, box, metrics(), PLATE_96, false)).toBeUndefined();
    expect(cellFromPoint(400, 75, box, metrics(), PLATE_96, true)?.c).toBe(11);
  });

  it("a point in the column-header row is undefined without clamp and row 0 with clamp", () => {
    expect(cellFromPoint(120, 55, box, metrics(), PLATE_96, false)).toBeUndefined();
    expect(cellFromPoint(120, 55, box, metrics(), PLATE_96, true)?.r).toBe(0);
  });

  it("a point below the last row clamps to the last row", () => {
    expect(cellFromPoint(120, 900, box, metrics(), PLATE_96, true)?.r).toBe(7);
  });

  it("a scrolled (shifted) bounding box moves the result by whole strides", () => {
    // stride is 18 + 3 = 21; shifting the box 21 px left moves the same point one column right.
    expect(cellFromPoint(120, 75, { left: 79, top: 50 }, metrics(), PLATE_96, false)).toEqual({
      r: 0,
      c: 1,
    });
  });
});

describe("patch producers", () => {
  it("sourcePatch writes exactly the four source fields", () => {
    expect(sourcePatch({ r: 1, c: 2, h: 3, w: 4 })).toEqual({
      source_start_row: "B",
      source_start_col: 3,
      num_rows: 3,
      num_cols: 4,
    });
  });

  it("destPatch writes exactly the two destination fields", () => {
    expect(destPatch({ r: 2, c: 4 })).toEqual({ dest_start_row: "C", dest_start_col: 5 });
  });

  it("CLEAR_PATCH has exactly the six well fields, each empty", () => {
    expect(Object.keys(CLEAR_PATCH).sort()).toEqual([...WELL_FIELDS].sort());
    for (const k of WELL_FIELDS) expect(CLEAR_PATCH[k]).toBe("");
    expect(Object.isFrozen(CLEAR_PATCH)).toBe(true);
  });
});

describe("wellFieldText", () => {
  it.each([
    [undefined, ""],
    [null, ""],
    [0, "0"],
    [3, "3"],
    ["b", "b"],
  ])("wellFieldText(%j) is %j", (v, text) => {
    expect(wellFieldText(v)).toBe(text);
  });
});

describe("wellFieldPatch", () => {
  it("keeps a typed row verbatim", () => {
    expect(wellFieldPatch("source_start_row", "b3")).toEqual({ source_start_row: "b3" });
    expect(wellFieldPatch("dest_start_row", " A")).toEqual({ dest_start_row: " A" });
  });

  it("writes an empty string for empty numeric text", () => {
    expect(wellFieldPatch("num_rows", "")).toEqual({ num_rows: "" });
  });

  it("converts an all-digit numeric text to a number", () => {
    expect(wellFieldPatch("num_rows", "12")).toEqual({ num_rows: 12 });
  });

  it("keeps non-digit numeric text verbatim (flagged later, never coerced)", () => {
    expect(wellFieldPatch("num_rows", "1.5")).toEqual({ num_rows: "1.5" });
    expect(wellFieldPatch("dest_start_col", "x")).toEqual({ dest_start_col: "x" });
  });
});
