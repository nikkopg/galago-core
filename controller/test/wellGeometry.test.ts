// Unit suite for the React-free well-picker core (07-02). Runs in the node
// environment: wellGeometry.ts imports no React or Chakra, so every decision
// the WellPicker makes is pinned here against fixture plates.

import { describe, expect, it } from "vitest";
import {
  CLEAR_PATCH,
  CLEAR_SELECTION_LABEL,
  DEST_MISFIT,
  DEST_PLATE_TITLE,
  DRAG_CAPTION_SUFFIX,
  EDIT_AS_FIELDS_LABEL,
  GRID_UNAVAILABLE_STATUS,
  KEPT_OPEN_FLAG,
  KEPT_OPEN_GRID,
  KEPT_OPEN_VARIABLE,
  LOADING_PLATES,
  NOTHING_SELECTED,
  PLACE_CAPTION_SUFFIX,
  SOURCE_MISFIT,
  SOURCE_PLATE_TITLE,
  UNSHOWABLE_STATUS,
  WELL_FIELDS,
  buildWellPickerView,
  cellFromPoint,
  classifyWellValue,
  destClickPatch,
  destOrigin,
  destPatch,
  dragRect,
  fieldFlags,
  fitsAt,
  forceOpen,
  gridMetrics,
  isBlankWell,
  isWellField,
  mismatchText,
  parseRowLabel,
  plateGridSide,
  plateLabel,
  rowLabel,
  sizeMismatch,
  sourceBlock,
  sourcePatch,
  statusLine,
  wellFieldPatch,
  wellFieldText,
  wellSizePx,
  type GridSide,
  type PlateListInput,
} from "@/components/tools/wellGeometry";
import { FIXTURE_PLATES, PLATE_384, PLATE_96 } from "./fixtures/fastPlates";

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

describe("wellFieldPatch is bounded to int32 (CR-01)", () => {
  it("keeps a digit string above 2147483647 as text", () => {
    expect(wellFieldPatch("num_rows", "2147483647")).toEqual({ num_rows: 2147483647 });
    expect(wellFieldPatch("num_rows", "2147483648")).toEqual({ num_rows: "2147483648" });
    expect(wellFieldPatch("source_start_col", "4294967297")).toEqual({
      source_start_col: "4294967297",
    });
    expect(wellFieldPatch("dest_start_col", "9007199254740993")).toEqual({
      dest_start_col: "9007199254740993",
    });
  });

  it("leaves rows verbatim", () => {
    expect(wellFieldPatch("source_start_row", "4294967297")).toEqual({
      source_start_row: "4294967297",
    });
  });
});

// ---------------------------------------------------------------------------
// Task 2: value flags, per-side plate grid, status line, force-open, view model
// ---------------------------------------------------------------------------

const OK_LIST: PlateListInput = { mode: "ok", plates: FIXTURE_PLATES };
const LOADING_LIST: PlateListInput = { mode: "loading", plates: [] };
const UNAVAILABLE_LIST: PlateListInput = { mode: "unavailable", plates: [] };

const sideOf = (which: "source" | "destination", plate: unknown, allowVariables = true): GridSide =>
  plateGridSide(which, OK_LIST, plate, allowVariables);

describe("copy constants", () => {
  it("are the exact UI-SPEC strings", () => {
    expect(SOURCE_PLATE_TITLE).toBe("Source plate");
    expect(DEST_PLATE_TITLE).toBe("Destination plate");
    expect(DRAG_CAPTION_SUFFIX).toBe(" · drag to select");
    expect(PLACE_CAPTION_SUFFIX).toBe(" · click to place");
    expect(NOTHING_SELECTED).toBe("Nothing selected. Fields start empty.");
    expect(SOURCE_MISFIT).toBe("Source block does not fit the source plate");
    expect(DEST_MISFIT).toBe("Block does not fit the destination plate here");
    expect(UNSHOWABLE_STATUS).toBe(
      "Some saved values can't be shown on the grid — see Edit as fields",
    );
    expect(GRID_UNAVAILABLE_STATUS).toBe("A plate grid is unavailable — use the fields below");
    expect(LOADING_PLATES).toBe("Loading plates…");
    expect(EDIT_AS_FIELDS_LABEL).toBe("Edit as fields");
    expect(CLEAR_SELECTION_LABEL).toBe("Clear selection");
    expect(KEPT_OPEN_GRID).toBe("Kept open: a plate grid is unavailable");
    expect(KEPT_OPEN_VARIABLE).toBe("Kept open: a field holds a variable");
    expect(KEPT_OPEN_FLAG).toBe("Kept open: a value needs attention");
  });
});

describe("classifyWellValue", () => {
  it("rows on 8x12: letters in range are ok with the 0-based index", () => {
    expect(classifyWellValue("source_start_row", "B", PLATE_96, true)).toEqual({
      kind: "ok",
      n: 1,
    });
    expect(classifyWellValue("source_start_row", "b", PLATE_96, true)).toEqual({
      kind: "ok",
      n: 1,
    });
  });

  it("a row past the last row is flagged naming the last row", () => {
    expect(classifyWellValue("source_start_row", "I", PLATE_96, true)).toEqual({
      kind: "flag",
      text: "Row 'I' is past the last row (H) — kept as saved",
    });
  });

  it("a row that is not 1-2 letters is flagged", () => {
    expect(classifyWellValue("dest_start_row", "ABC", PLATE_96, true)).toEqual({
      kind: "flag",
      text: "Row 'ABC' is not a 1-2 letter row — kept as saved",
    });
  });

  it("blank rows (empty, legacy 0, undefined) are blank, never flagged", () => {
    for (const v of ["", 0, undefined, null]) {
      expect(classifyWellValue("source_start_row", v, PLATE_96, true)).toEqual({ kind: "blank" });
    }
  });

  it("a {{variable}} is a variable when allowed and a flag when not", () => {
    expect(classifyWellValue("source_start_row", "{{r}}", PLATE_96, true)).toEqual({
      kind: "variable",
    });
    expect(classifyWellValue("source_start_row", "{{r}}", PLATE_96, false)).toEqual({
      kind: "flag",
      text: "Row '{{r}}' is not a 1-2 letter row — kept as saved",
    });
  });

  it("with no size a far row is still ok", () => {
    expect(classifyWellValue("source_start_row", "Z", undefined, true)).toEqual({
      kind: "ok",
      n: 25,
    });
  });

  it("columns accept a number or an all-digit string from 1", () => {
    expect(classifyWellValue("source_start_col", 3, PLATE_96, true)).toEqual({ kind: "ok", n: 3 });
    expect(classifyWellValue("source_start_col", "3", PLATE_96, true)).toEqual({
      kind: "ok",
      n: 3,
    });
  });

  it("a column past the last column is flagged", () => {
    expect(classifyWellValue("dest_start_col", 13, PLATE_96, true)).toEqual({
      kind: "flag",
      text: "Column 13 is past the last column (12) — kept as saved",
    });
  });

  it.each([2.5, -1, "x", "0"])("column %j is flagged as not a whole number from 1", (v) => {
    expect(classifyWellValue("source_start_col", v, PLATE_96, true)).toEqual({
      kind: "flag",
      text: `Column '${v}' is not a whole number from 1 — kept as saved`,
    });
  });

  it("a legacy 0 column is blank", () => {
    expect(classifyWellValue("source_start_col", 0, PLATE_96, true)).toEqual({ kind: "blank" });
  });

  it("num_rows / num_cols: whole numbers ok, 0 blank, others flagged with the field name", () => {
    expect(classifyWellValue("num_rows", 3, PLATE_96, true)).toEqual({ kind: "ok", n: 3 });
    expect(classifyWellValue("num_cols", 0, PLATE_96, true)).toEqual({ kind: "blank" });
    expect(classifyWellValue("num_rows", 1.5, PLATE_96, true)).toEqual({
      kind: "flag",
      text: "num_rows must be a whole number from 1 — kept as saved",
    });
  });
});

describe("classifyWellValue too-large flags (CR-01, D-14)", () => {
  it("flags a column above 2147483647 before the past-the-last-column rule", () => {
    const text = "Column '4294967297' is too large (max 2147483647) — kept as saved";
    expect(classifyWellValue("source_start_col", "4294967297", PLATE_96, true)).toEqual({
      kind: "flag",
      text,
    });
    expect(classifyWellValue("source_start_col", 4294967297, PLATE_96, true)).toEqual({
      kind: "flag",
      text,
    });
  });

  it("flags a count above 2147483647 even with no plate size", () => {
    expect(classifyWellValue("num_rows", 2147483648, undefined, true)).toEqual({
      kind: "flag",
      text: "num_rows '2147483648' is too large (max 2147483647) — kept as saved",
    });
    expect(classifyWellValue("num_cols", "2147483647", undefined, true)).toEqual({
      kind: "ok",
      n: 2147483647,
    });
  });

  it("keeps the existing must-be-whole texts for '0' and 12.7", () => {
    expect(classifyWellValue("num_rows", "0", PLATE_96, true)).toEqual({
      kind: "flag",
      text: "num_rows must be a whole number from 1 — kept as saved",
    });
    expect(classifyWellValue("num_cols", 12.7, PLATE_96, true)).toEqual({
      kind: "flag",
      text: "num_cols must be a whole number from 1 — kept as saved",
    });
  });

  it("flags the block, the field, forces Edit as fields open and shows the can't-be-shown status", () => {
    const values = {
      source_start_row: "A",
      source_start_col: 1,
      num_rows: "4294967298",
      num_cols: 2,
      dest_start_row: "A",
      dest_start_col: 1,
    };
    const source = plateGridSide("source", OK_LIST, 12, true);
    const dest = plateGridSide("destination", OK_LIST, 7, true);
    expect(sourceBlock(values, PLATE_96, true)).toEqual({ kind: "flagged" });
    expect(fieldFlags(values, PLATE_96, PLATE_96, true)).toHaveProperty("num_rows");
    expect(forceOpen({ source, dest, values, allowVariables: true })).toEqual({
      forced: true,
      note: KEPT_OPEN_FLAG,
    });
    expect(statusLine({ source, dest, values, allowVariables: true }).text).toBe(UNSHOWABLE_STATUS);
  });
});

describe("sourceBlock and destOrigin", () => {
  const full = { source_start_row: "B", source_start_col: 3, num_rows: 2, num_cols: 4 };

  it("all four ok gives the block rectangle", () => {
    expect(sourceBlock(full, PLATE_96, true)).toEqual({
      kind: "block",
      rect: { r: 1, c: 2, h: 2, w: 4 },
    });
  });

  it("any blank (none flagged) gives none", () => {
    expect(sourceBlock({ ...full, num_cols: "" }, PLATE_96, true)).toEqual({ kind: "none" });
    expect(sourceBlock({}, PLATE_96, true)).toEqual({ kind: "none" });
  });

  it("any flagged gives flagged, even beside a blank", () => {
    expect(sourceBlock({ ...full, source_start_row: "ABC" }, PLATE_96, true)).toEqual({
      kind: "flagged",
    });
    expect(sourceBlock({ ...full, source_start_row: "ABC", num_cols: "" }, PLATE_96, true)).toEqual(
      { kind: "flagged" },
    );
  });

  it("a variable field gives no block (nothing selected for it)", () => {
    expect(sourceBlock({ ...full, num_rows: "{{n}}" }, PLATE_96, true)).toEqual({ kind: "none" });
  });

  it("destOrigin likewise for the two destination fields", () => {
    expect(destOrigin({ dest_start_row: "C", dest_start_col: 5 }, PLATE_96, true)).toEqual({
      kind: "origin",
      cell: { r: 2, c: 4 },
    });
    expect(destOrigin({ dest_start_row: "C" }, PLATE_96, true)).toEqual({ kind: "none" });
    expect(destOrigin({ dest_start_row: "C", dest_start_col: "x" }, PLATE_96, true)).toEqual({
      kind: "flagged",
    });
  });
});

describe("fieldFlags", () => {
  it("returns a flag only for flagged fields, keyed by field", () => {
    const flags = fieldFlags(
      {
        source_start_row: "I",
        source_start_col: 2,
        num_rows: "",
        num_cols: 0,
        dest_start_row: "{{r}}",
        dest_start_col: 13,
      },
      PLATE_96,
      PLATE_96,
      true,
    );
    expect(flags).toEqual({
      source_start_row: "Row 'I' is past the last row (H) — kept as saved",
      dest_start_col: "Column 13 is past the last column (12) — kept as saved",
    });
  });

  it("checks destination fields against the destination size", () => {
    const flags = fieldFlags({ dest_start_col: 20 }, PLATE_96, PLATE_384, true);
    expect(flags).toEqual({});
  });
});

describe("plateLabel", () => {
  it("joins the id and description with a middle dot", () => {
    expect(plateLabel(12, "Greiner 96 flat")).toBe("12 · Greiner 96 flat");
  });
  it("is just the id when the description is empty", () => {
    expect(plateLabel(5, "")).toBe("5");
  });
});

describe("plateGridSide", () => {
  it("a blank plate value hides the grid with the side-specific prompt", () => {
    expect(sideOf("source", "")).toEqual({
      kind: "hidden",
      cause: "no-plate",
      text: "Choose a source plate to show its grid",
    });
    expect(sideOf("destination", undefined)).toEqual({
      kind: "hidden",
      cause: "no-plate",
      text: "Choose a destination plate to show its grid",
    });
  });

  it("a variable-bound plate hides the grid when variables are allowed", () => {
    expect(sideOf("source", "{{p}}")).toEqual({
      kind: "hidden",
      cause: "variable",
      text: "The source plate is set by a variable — type the wells below",
    });
  });

  it("a loading list is a loading side that does not hide", () => {
    expect(plateGridSide("source", LOADING_LIST, 1, true)).toEqual({
      kind: "loading",
      text: "Loading plates…",
    });
  });

  it("an unavailable list hides the grid", () => {
    expect(plateGridSide("source", UNAVAILABLE_LIST, 1, true)).toEqual({
      kind: "hidden",
      cause: "unavailable",
      text: "Plate list unavailable — type the wells below",
    });
  });

  it("an id the instrument does not report hides the grid naming the id as saved", () => {
    expect(sideOf("source", 99)).toEqual({
      kind: "hidden",
      cause: "not-reported",
      text: "Plate 99 is not reported by the instrument — type the wells below",
    });
  });

  it("a plate with no usable size hides the grid", () => {
    expect(sideOf("source", 30)).toEqual({
      kind: "hidden",
      cause: "no-size",
      text: "Plate 30 has no usable size — type the wells below",
    });
  });

  it("a duplicated id whose entries disagree hides the grid", () => {
    expect(sideOf("source", 41)).toEqual({
      kind: "hidden",
      cause: "duplicate-sizes",
      text: "Plate 41 is listed twice with different sizes — type the wells below",
    });
  });

  it("a duplicated id whose entries agree uses that size and the first label", () => {
    expect(sideOf("source", 40)).toEqual({
      kind: "grid",
      size: { rows: 8, cols: 12 },
      label: "40 · Twin A",
    });
  });

  it("a known plate (number or digit string) is a grid with its label", () => {
    const want = { kind: "grid", size: { rows: 8, cols: 12 }, label: "12 · Greiner 96 flat" };
    expect(sideOf("source", 12)).toEqual(want);
    expect(sideOf("source", "12")).toEqual(want);
  });

  it("a plate value of 0 is an unreported id, not blank", () => {
    expect(sideOf("source", 0)).toMatchObject({ kind: "hidden", cause: "not-reported" });
  });

  it("with variables not allowed a {{variable}} is just an unreported id", () => {
    expect(sideOf("source", "{{p}}", false)).toMatchObject({
      kind: "hidden",
      cause: "not-reported",
    });
  });

  it("keeps the reply order (the first matching entry supplies the label)", () => {
    const reversed: PlateListInput = {
      mode: "ok",
      plates: [
        { id: 9, description: "Second", rowCount: 8, colCount: 12 },
        { id: 9, description: "First", rowCount: 8, colCount: 12 },
      ],
    };
    expect(plateGridSide("source", reversed, 9, true)).toMatchObject({ label: "9 · Second" });
  });
});

describe("statusLine", () => {
  const run = (
    values: Record<string, unknown>,
    over: { source?: GridSide; dest?: GridSide; hover?: { r: number; c: number } } = {},
  ) =>
    statusLine({
      source: over.source ?? sideOf("source", 12),
      dest: over.dest ?? sideOf("destination", 7),
      values,
      allowVariables: true,
      hover: over.hover,
    });

  it("row 1: a source block that does not fit the source plate", () => {
    expect(run({ source_start_row: "A", source_start_col: 10, num_rows: 3, num_cols: 4 })).toEqual({
      text: "Source block does not fit the source plate",
      tone: "danger",
    });
  });

  const placedMisfit = {
    source_start_row: "A",
    source_start_col: 1,
    num_rows: 2,
    num_cols: 3,
    dest_start_row: "H",
    dest_start_col: 12,
  };

  it("row 2: the block does not fit the destination at the placed origin", () => {
    expect(run(placedMisfit)).toEqual({
      text: "Block does not fit the destination plate here",
      tone: "danger",
    });
  });

  it("row 2: a hover at a fitting cell overrides a misfit placement", () => {
    expect(run(placedMisfit, { hover: { r: 0, c: 0 } }).tone).toBe("muted");
  });

  it("row 2: a hover at a misfit cell shows the misfit even with no placement", () => {
    const values = { source_start_row: "A", source_start_col: 1, num_rows: 2, num_cols: 3 };
    expect(run(values, { hover: { r: 7, c: 0 } })).toEqual({
      text: "Block does not fit the destination plate here",
      tone: "danger",
    });
  });

  it("row 3: a flagged field says some saved values cannot be shown", () => {
    expect(run({ source_start_row: "ABC", source_start_col: 1, num_rows: 1, num_cols: 1 })).toEqual(
      {
        text: "Some saved values can't be shown on the grid — see Edit as fields",
        tone: "danger",
      },
    );
  });

  it("row 4: a hidden grid is muted", () => {
    expect(run({}, { dest: sideOf("destination", "") })).toEqual({
      text: "A plate grid is unavailable — use the fields below",
      tone: "muted",
    });
  });

  it("row 4 is not produced by a loading grid", () => {
    const loading = plateGridSide("destination", LOADING_LIST, 7, true);
    expect(run({}, { dest: loading })).toEqual({
      text: "Nothing selected. Fields start empty.",
      tone: "muted",
    });
  });

  it("row 5: no block", () => {
    expect(run({})).toEqual({ text: "Nothing selected. Fields start empty.", tone: "muted" });
  });

  it("row 6: a block and no destination (plural and singular)", () => {
    expect(run({ source_start_row: "A", source_start_col: 1, num_rows: 2, num_cols: 3 }).text).toBe(
      "6 wells selected. Now place them on the destination.",
    );
    expect(run({ source_start_row: "A", source_start_col: 1, num_rows: 1, num_cols: 1 }).text).toBe(
      "1 well selected. Now place them on the destination.",
    );
  });

  it("row 7: a block placed on the destination (plural and singular)", () => {
    expect(
      run({
        source_start_row: "B",
        source_start_col: 3,
        num_rows: 2,
        num_cols: 3,
        dest_start_row: "C",
        dest_start_col: 5,
      }),
    ).toEqual({ text: "Transfer 6 wells: B3 → C5", tone: "muted" });
    expect(
      run({
        source_start_row: "A",
        source_start_col: 1,
        num_rows: 1,
        num_cols: 1,
        dest_start_row: "A",
        dest_start_col: 1,
      }).text,
    ).toBe("Transfer 1 well: A1 → A1");
  });

  it("a typed lower-case row displays upper-case in the label without being rewritten", () => {
    const values = {
      source_start_row: "b",
      source_start_col: 3,
      num_rows: 1,
      num_cols: 1,
      dest_start_row: "c",
      dest_start_col: 5,
    };
    expect(run(values).text).toBe("Transfer 1 well: B3 → C5");
    expect(values.source_start_row).toBe("b");
  });

  it("partial values: only some fields filled shows nothing selected", () => {
    expect(run({ source_start_row: "A", source_start_col: 1 }).text).toBe(
      "Nothing selected. Fields start empty.",
    );
  });

  it("a mismatch of plate sizes does not skip the destination fit check", () => {
    const big = sideOf("destination", 20);
    const values = {
      source_start_row: "A",
      source_start_col: 1,
      num_rows: 2,
      num_cols: 2,
      dest_start_row: "P",
      dest_start_col: 24,
    };
    expect(run(values, { dest: big }).text).toBe("Block does not fit the destination plate here");
  });
});

describe("forceOpen", () => {
  const force = (
    values: Record<string, unknown>,
    over: { source?: GridSide; dest?: GridSide; allowVariables?: boolean } = {},
  ) =>
    forceOpen({
      source: over.source ?? sideOf("source", 12),
      dest: over.dest ?? sideOf("destination", 7),
      values,
      allowVariables: over.allowVariables ?? true,
    });

  it("is forced with the grid note while either grid is hidden", () => {
    expect(force({}, { dest: sideOf("destination", "") })).toEqual({
      forced: true,
      note: "Kept open: a plate grid is unavailable",
    });
    expect(force({}, { source: plateGridSide("source", UNAVAILABLE_LIST, 12, true) })).toEqual({
      forced: true,
      note: "Kept open: a plate grid is unavailable",
    });
  });

  it("a loading grid alone does not force it open", () => {
    const loading = plateGridSide("source", LOADING_LIST, 12, true);
    expect(force({}, { source: loading, dest: loading })).toEqual({ forced: false });
  });

  it("a {{variable}} in any of the six fields forces it open (variables allowed)", () => {
    expect(force({ num_cols: "{{x}}" })).toEqual({
      forced: true,
      note: "Kept open: a field holds a variable",
    });
  });

  it("a flagged value forces it open with the attention note", () => {
    expect(force({ source_start_row: "I" })).toEqual({
      forced: true,
      note: "Kept open: a value needs attention",
    });
  });

  it("a source or placed-destination misfit forces it open", () => {
    expect(
      force({ source_start_row: "A", source_start_col: 10, num_rows: 3, num_cols: 4 }),
    ).toEqual({ forced: true, note: "Kept open: a value needs attention" });
    expect(
      force({
        source_start_row: "A",
        source_start_col: 1,
        num_rows: 2,
        num_cols: 3,
        dest_start_row: "H",
        dest_start_col: 12,
      }),
    ).toEqual({ forced: true, note: "Kept open: a value needs attention" });
  });

  it("grid note wins over variable note wins over attention note", () => {
    expect(
      force({ num_cols: "{{x}}", source_start_row: "I" }, { dest: sideOf("destination", "") }).note,
    ).toBe("Kept open: a plate grid is unavailable");
    expect(force({ num_cols: "{{x}}", source_start_row: "I" }).note).toBe(
      "Kept open: a field holds a variable",
    );
  });

  it("all blank on two known plates is not forced", () => {
    expect(force({})).toEqual({ forced: false });
    expect(
      force({
        source_start_row: 0,
        source_start_col: 0,
        num_rows: 0,
        num_cols: 0,
        dest_start_row: 0,
        dest_start_col: 0,
      }),
    ).toEqual({ forced: false });
  });

  it("with variables not allowed a {{x}} row counts as flagged", () => {
    expect(force({ source_start_row: "{{x}}" }, { allowVariables: false })).toEqual({
      forced: true,
      note: "Kept open: a value needs attention",
    });
  });
});

describe("buildWellPickerView", () => {
  const block = { source_start_row: "A", source_start_col: 1, num_rows: 2, num_cols: 3 };
  const placed = { ...block, dest_start_row: "C", dest_start_col: 5 };
  const build = (
    values: Record<string, unknown>,
    hover?: { r: number; c: number },
    plates: PlateListInput = OK_LIST,
  ) => buildWellPickerView({ plates, values, allowVariables: true, hover });

  it("plates of different size: a mismatch warning, no footprint, not clickable, plain caption", () => {
    const v = build({ ...placed, source_plate_id: 1, dest_plate_id: 20 });
    expect(v.mismatch).toBe(mismatchText(PLATE_96, PLATE_384));
    expect(v.footprint).toBeUndefined();
    expect(v.destClickable).toBe(false);
    expect(v.destCaption).toBe("20 · Greiner 384 flat");
    expect(v.sourceCaption).toBe("1 · Default 96-Well Conical · drag to select");
  });

  it("matching plates: captions, placed footprint and clickable destination", () => {
    const v = build({ ...placed, source_plate_id: 12, dest_plate_id: 7 });
    expect(v.sourceCaption).toBe("12 · Greiner 96 flat · drag to select");
    expect(v.destCaption).toBe("7 · Corning 96 round · click to place");
    expect(v.mismatch).toBeUndefined();
    expect(v.destClickable).toBe(true);
    expect(v.sourceRect).toEqual({ rect: { r: 0, c: 0, h: 2, w: 3 }, bad: false });
    expect(v.footprint).toEqual({ rect: { r: 2, c: 4, h: 2, w: 3 }, state: "put" });
  });

  it("a hover that fits is a ghost; one that does not fit is bad", () => {
    const values = { ...block, source_plate_id: 12, dest_plate_id: 7 };
    expect(build(values, { r: 1, c: 1 }).footprint).toEqual({
      rect: { r: 1, c: 1, h: 2, w: 3 },
      state: "ghost",
    });
    expect(build(values, { r: 7, c: 11 }).footprint).toEqual({
      rect: { r: 7, c: 11, h: 2, w: 3 },
      state: "bad",
    });
  });

  it("a placement that does not fit is drawn bad, never clipped or rewritten", () => {
    const values = {
      ...block,
      dest_start_row: "H",
      dest_start_col: 12,
      source_plate_id: 12,
      dest_plate_id: 7,
    };
    const v = build(values);
    expect(v.footprint).toEqual({ rect: { r: 7, c: 11, h: 2, w: 3 }, state: "bad" });
    expect(v.status).toEqual({
      text: "Block does not fit the destination plate here",
      tone: "danger",
    });
    expect(v.forced).toBe(true);
    expect(values.dest_start_row).toBe("H");
    expect(values.dest_start_col).toBe(12);
  });

  it("a source block that does not fit is marked bad", () => {
    const v = build({
      source_start_row: "A",
      source_start_col: 10,
      num_rows: 3,
      num_cols: 4,
      source_plate_id: 12,
      dest_plate_id: 7,
    });
    expect(v.sourceRect).toEqual({ rect: { r: 0, c: 9, h: 3, w: 4 }, bad: true });
    expect(v.status.text).toBe("Source block does not fit the source plate");
  });

  it("clearDisabled is true when all six are blank (0 included), false otherwise", () => {
    expect(build({}).clearDisabled).toBe(true);
    expect(
      build({
        source_start_row: 0,
        source_start_col: 0,
        num_rows: 0,
        num_cols: 0,
        dest_start_row: "",
        dest_start_col: undefined,
      }).clearDisabled,
    ).toBe(true);
    expect(build({ num_rows: 2 }).clearDisabled).toBe(false);
  });

  it("hidden and loading sides carry no caption, rect or metrics", () => {
    const v = build({ ...block, source_plate_id: 12, dest_plate_id: "" });
    expect(v.dest.kind).toBe("hidden");
    expect(v.destCaption).toBeUndefined();
    expect(v.destMetrics).toBeUndefined();
    expect(v.footprint).toBeUndefined();
    expect(v.destClickable).toBe(false);
    expect(v.sourceMetrics).toEqual(gridMetrics(PLATE_96));
    expect(v.forced).toBe(true);
    const loading = build({ source_plate_id: 12, dest_plate_id: 7 }, undefined, LOADING_LIST);
    expect(loading.source.kind).toBe("loading");
    expect(loading.forced).toBe(false);
  });

  it("partial values draw nothing on the incomplete side", () => {
    const v = build({
      source_start_row: "A",
      source_start_col: 1,
      source_plate_id: 12,
      dest_plate_id: 7,
    });
    expect(v.sourceRect).toBeUndefined();
    expect(v.footprint).toBeUndefined();
    expect(v.destClickable).toBe(false);
  });

  it("changing only a plate id changes the view and returns no patch", () => {
    const base = { ...placed, source_plate_id: 12, dest_plate_id: 7 };
    const before = JSON.stringify(base);
    const a = build(base);
    const b = build({ ...base, dest_plate_id: 20 });
    expect(a.mismatch).toBeUndefined();
    expect(b.mismatch).toBeDefined();
    expect(JSON.stringify(base)).toBe(before);
    expect(JSON.stringify(a)).not.toContain('source_start_row":"A","source_start_col');
    expect(Object.keys(b)).not.toContain("patch");
  });
});

describe("destClickPatch", () => {
  const block = { source_start_row: "A", source_start_col: 1, num_rows: 2, num_cols: 3 };
  const values = { ...block, source_plate_id: 12, dest_plate_id: 7 };
  const view = (v: Record<string, unknown>) =>
    buildWellPickerView({ plates: OK_LIST, values: v, allowVariables: true });

  it("returns destPatch(cell) when the footprint fits at the cell", () => {
    expect(destClickPatch(view(values), values, true, { r: 2, c: 4 })).toEqual({
      dest_start_row: "C",
      dest_start_col: 5,
    });
  });

  it("returns undefined when the footprint does not fit at the cell", () => {
    expect(destClickPatch(view(values), values, true, { r: 7, c: 11 })).toBeUndefined();
  });

  it("returns undefined when the destination is not clickable (size mismatch)", () => {
    const mm = { ...values, dest_plate_id: 20 };
    expect(destClickPatch(view(mm), mm, true, { r: 0, c: 0 })).toBeUndefined();
  });

  it("returns undefined when there is no source block", () => {
    const none = { source_plate_id: 12, dest_plate_id: 7 };
    expect(destClickPatch(view(none), none, true, { r: 0, c: 0 })).toBeUndefined();
  });
});
