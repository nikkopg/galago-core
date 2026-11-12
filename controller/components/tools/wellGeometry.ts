// React-free and Chakra-free well-picker core (07-02). Vitest runs in node with
// no DOM, so every decision the WellPicker makes lives here: the row-label
// codec, the geometry, the arithmetic hit-test and the patch producers. Nothing
// here reads an instrument, mutates an input or rewrites a saved value. A block
// that does not fit is reported, never clipped, shifted or cleared; only an
// operator drag, click, typed edit or "Clear selection" produces a patch, and
// a plate change never does (D-12, D-13, PLT-09). The only import allowed is
// isVariableLike from @/utils/variableRef (used by the value classification).

// The six well fields in the mockup's order (D-12).
export const WELL_FIELDS = [
  "source_start_row",
  "source_start_col",
  "num_rows",
  "num_cols",
  "dest_start_row",
  "dest_start_col",
] as const;
export type WellField = (typeof WELL_FIELDS)[number];
export const SOURCE_WELL_FIELDS = WELL_FIELDS.slice(0, 4) as readonly WellField[];
export const DEST_WELL_FIELDS = WELL_FIELDS.slice(4) as readonly WellField[];

export function isWellField(name: string): name is WellField {
  return (WELL_FIELDS as readonly string[]).includes(name);
}

export interface PlateSize {
  rows: number;
  cols: number;
}
// Structurally the server PlateEntry that 07-06 defines.
export interface PlateInfo {
  id: number;
  description: string;
  rowCount: number | null;
  colCount: number | null;
}
export interface PlateListInput {
  mode: "loading" | "ok" | "unavailable";
  plates: readonly PlateInfo[];
}
export interface Cell {
  r: number;
  c: number;
}
export interface Rect {
  r: number;
  c: number;
  h: number;
  w: number;
}
export interface GridMetrics {
  cell: number;
  gap: number;
  gutterX: number;
  headerY: number;
}

// Row labels run A..Z then AA, AB, ... (the F.A.S.T. server accepts 1-2 letters).
export function rowLabel(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  const n = index - 26;
  return String.fromCharCode(65 + Math.floor(n / 26)) + String.fromCharCode(65 + (n % 26));
}

// Strict: exactly 1-2 ASCII letters, no trim; case is folded only to compute
// the index, the saved text is never rewritten.
export function parseRowLabel(label: unknown): number | undefined {
  if (typeof label !== "string" || !/^[A-Za-z]{1,2}$/.test(label)) return undefined;
  const u = label.toUpperCase();
  return u.length === 1
    ? u.charCodeAt(0) - 65
    : 26 + (u.charCodeAt(0) - 65) * 26 + (u.charCodeAt(1) - 65);
}

// Blank = undefined, null, "" or the legacy number 0 (older steps and untouched
// modal number fields hold 0, so 0 is never flagged). The string "0" is not blank.
export function isBlankWell(value: unknown): boolean {
  return value === undefined || value === null || value === "" || value === 0;
}

export function dragRect(a: Cell, b: Cell): Rect {
  return {
    r: Math.min(a.r, b.r),
    c: Math.min(a.c, b.c),
    h: Math.abs(a.r - b.r) + 1,
    w: Math.abs(a.c - b.c) + 1,
  };
}

export function fitsAt(origin: Cell, block: { h: number; w: number }, size: PlateSize): boolean {
  return (
    origin.r >= 0 &&
    origin.c >= 0 &&
    origin.r + block.h <= size.rows &&
    origin.c + block.w <= size.cols
  );
}

// The (rows, cols) pair compare fast-mcp authoring.py:66-67 uses: 8x12 vs 12x8
// is a mismatch even though both have 96 wells.
export function sizeMismatch(a: PlateSize, b: PlateSize): boolean {
  return a.rows !== b.rows || a.cols !== b.cols;
}

export function mismatchText(a: PlateSize, b: PlateSize): string {
  return `Plates differ in size (${a.rows}×${a.cols} vs ${b.rows}×${b.cols}) — the F.A.S.T. refuses cross-format transfers (-9006)`;
}

export function wellSizePx(cols: number): number {
  return cols <= 12 ? 18 : Math.max(8, Math.round(18 - (cols - 12) / 2));
}

// The same numbers the component uses for its CSS grid template, so the
// arithmetic and the layout can never disagree.
export function gridMetrics(size: PlateSize): GridMetrics {
  return {
    cell: wellSizePx(size.cols),
    gap: 3,
    gutterX: size.rows > 26 ? 20 : 14,
    headerY: 18,
  };
}

// Hit-testing is arithmetic over the inner grid's bounding box and the fixed
// stride, never a DOM point lookup (D-10).
export function cellFromPoint(
  x: number,
  y: number,
  box: { left: number; top: number },
  m: GridMetrics,
  size: PlateSize,
  clamp: boolean,
): Cell | undefined {
  const stride = m.cell + m.gap;
  let c = Math.floor((x - box.left - m.gutterX - m.gap) / stride);
  let r = Math.floor((y - box.top - m.headerY - m.gap) / stride);
  const inside = r >= 0 && c >= 0 && r < size.rows && c < size.cols;
  if (!inside && !clamp) return undefined;
  c = Math.min(Math.max(c, 0), size.cols - 1);
  r = Math.min(Math.max(r, 0), size.rows - 1);
  return { r, c };
}

export function sourcePatch(rect: Rect): Record<string, string | number> {
  return {
    source_start_row: rowLabel(rect.r),
    source_start_col: rect.c + 1,
    num_rows: rect.h,
    num_cols: rect.w,
  };
}

export function destPatch(cell: Cell): Record<string, string | number> {
  return { dest_start_row: rowLabel(cell.r), dest_start_col: cell.c + 1 };
}

// D-13: the only action that empties all six; never 0.
export const CLEAR_PATCH: Readonly<Record<WellField, "">> = Object.freeze({
  source_start_row: "",
  source_start_col: "",
  num_rows: "",
  num_cols: "",
  dest_start_row: "",
  dest_start_col: "",
});

// What is shown is what is saved: a saved 0 shows as "0".
export function wellFieldText(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

// A typed row is kept verbatim (never rewritten, D-12). For the four numeric
// fields: "" stays "", an all-digit string becomes a number, anything else is
// kept verbatim (it will be flagged, never coerced).
export function wellFieldPatch(field: WellField, text: string): Record<string, string | number> {
  if (field === "source_start_row" || field === "dest_start_row") return { [field]: text };
  if (text !== "" && /^[0-9]+$/.test(text)) return { [field]: Number(text) };
  return { [field]: text };
}
