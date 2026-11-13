// React-free and Chakra-free well-picker core (07-02). Vitest runs in node with
// no DOM, so every decision the WellPicker makes lives here: the row-label
// codec, the geometry, the arithmetic hit-test and the patch producers. Nothing
// here reads an instrument, mutates an input or rewrites a saved value. A block
// that does not fit is reported, never clipped, shifted or cleared; only an
// operator drag, click, typed edit or "Clear selection" produces a patch, and
// a plate change never does (D-12, D-13, PLT-09). The only imports allowed are
// isVariableLike from @/utils/variableRef (used by the value classification)
// and the int32 helpers from @/utils/int32 (CR-01).

import { INT32_MAX, int32FromDigits } from "@/utils/int32";
import { isVariableLike } from "@/utils/variableRef";

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
// fields: "" stays "", an all-digit string up to 2147483647 becomes a number
// (a larger one stays as text and is flagged, CR-01), anything else is kept
// verbatim (it will be flagged, never coerced).
export function wellFieldPatch(field: WellField, text: string): Record<string, string | number> {
  if (field === "source_start_row" || field === "dest_start_row") return { [field]: text };
  if (text !== "" && /^[0-9]+$/.test(text)) return { [field]: int32FromDigits(text) };
  return { [field]: text };
}

// ---- Copy constants (exact strings from 07-UI-SPEC.md) ----
export const SOURCE_PLATE_TITLE = "Source plate";
export const DEST_PLATE_TITLE = "Destination plate";
export const DRAG_CAPTION_SUFFIX = " · drag to select";
export const PLACE_CAPTION_SUFFIX = " · click to place";
export const NOTHING_SELECTED = "Nothing selected. Fields start empty.";
export const SOURCE_MISFIT = "Source block does not fit the source plate";
export const DEST_MISFIT = "Block does not fit the destination plate here";
export const UNSHOWABLE_STATUS =
  "Some saved values can't be shown on the grid — see Edit as fields";
export const GRID_UNAVAILABLE_STATUS = "A plate grid is unavailable — use the fields below";
export const LOADING_PLATES = "Loading plates…";
export const EDIT_AS_FIELDS_LABEL = "Edit as fields";
export const CLEAR_SELECTION_LABEL = "Clear selection";
export const KEPT_OPEN_GRID = "Kept open: a plate grid is unavailable";
export const KEPT_OPEN_VARIABLE = "Kept open: a field holds a variable";
export const KEPT_OPEN_FLAG = "Kept open: a value needs attention";

type Values = Record<string, unknown>;

// ---- Value classification (D-13, D-14, PLT-09) ----

// n is the 0-based row index for rows and the integer for columns and counts.
export type WellValue =
  | { kind: "blank" }
  | { kind: "variable" }
  | { kind: "ok"; n: number }
  | { kind: "flag"; text: string };

const KEPT = "— kept as saved";

// A whole number from 1 up to INT32_MAX: an integer number or an all-digit
// string. "too-large" is a whole number above INT32_MAX (including numbers that
// are not safe integers), which the encoder would wrap (CR-01); "not-whole" is
// everything else. The string "0" is NOT blank and is not-whole; only the
// number 0 is the legacy blank.
type Whole = { kind: "ok"; n: number } | { kind: "too-large" } | { kind: "not-whole" };

function wholeFromOne(value: unknown): Whole {
  let n: number | undefined;
  if (typeof value === "number") {
    if (Number.isInteger(value)) n = value;
  } else if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    n = Number(value);
  }
  if (n === undefined || n < 1) return { kind: "not-whole" };
  return n > INT32_MAX ? { kind: "too-large" } : { kind: "ok", n };
}

export function classifyWellValue(
  field: WellField,
  value: unknown,
  size: PlateSize | undefined,
  allowVariables: boolean,
): WellValue {
  if (isBlankWell(value)) return { kind: "blank" };
  if (allowVariables && isVariableLike(value)) return { kind: "variable" };
  const v = String(value);
  if (field === "source_start_row" || field === "dest_start_row") {
    const idx = parseRowLabel(value);
    if (idx === undefined) {
      return { kind: "flag", text: `Row '${v}' is not a 1-2 letter row ${KEPT}` };
    }
    if (size && idx >= size.rows) {
      return {
        kind: "flag",
        text: `Row '${v}' is past the last row (${rowLabel(size.rows - 1)}) ${KEPT}`,
      };
    }
    return { kind: "ok", n: idx };
  }
  const whole = wholeFromOne(value);
  if (field === "source_start_col" || field === "dest_start_col") {
    if (whole.kind === "too-large") {
      return { kind: "flag", text: `Column '${v}' is too large (max ${INT32_MAX}) ${KEPT}` };
    }
    if (whole.kind === "not-whole") {
      return { kind: "flag", text: `Column '${v}' is not a whole number from 1 ${KEPT}` };
    }
    if (size && whole.n > size.cols) {
      return {
        kind: "flag",
        text: `Column ${whole.n} is past the last column (${size.cols}) ${KEPT}`,
      };
    }
    return { kind: "ok", n: whole.n };
  }
  if (whole.kind === "too-large") {
    return { kind: "flag", text: `${field} '${v}' is too large (max ${INT32_MAX}) ${KEPT}` };
  }
  if (whole.kind === "not-whole") {
    return { kind: "flag", text: `${field} must be a whole number from 1 ${KEPT}` };
  }
  return { kind: "ok", n: whole.n };
}

type Classified = Partial<Record<WellField, WellValue>>;

function classifyAll(
  values: Values,
  sourceSize: PlateSize | undefined,
  destSize: PlateSize | undefined,
  allowVariables: boolean,
): Classified {
  const out: Classified = {};
  for (const f of WELL_FIELDS) {
    const size = f === "dest_start_row" || f === "dest_start_col" ? destSize : sourceSize;
    out[f] = classifyWellValue(f, values[f], size, allowVariables);
  }
  return out;
}

// Flagged wins over blank; blank or variable gives none; otherwise the rect.
export function sourceBlock(
  values: Values,
  size: PlateSize | undefined,
  allowVariables: boolean,
): { kind: "none" } | { kind: "flagged" } | { kind: "block"; rect: Rect } {
  const c = classifyAll(values, size, undefined, allowVariables);
  const parts = SOURCE_WELL_FIELDS.map((f) => c[f] as WellValue);
  if (parts.some((p) => p.kind === "flag")) return { kind: "flagged" };
  const [row, col, h, w] = parts;
  if (row.kind !== "ok" || col.kind !== "ok" || h.kind !== "ok" || w.kind !== "ok") {
    return { kind: "none" };
  }
  return { kind: "block", rect: { r: row.n, c: col.n - 1, h: h.n, w: w.n } };
}

export function destOrigin(
  values: Values,
  size: PlateSize | undefined,
  allowVariables: boolean,
): { kind: "none" } | { kind: "flagged" } | { kind: "origin"; cell: Cell } {
  const c = classifyAll(values, undefined, size, allowVariables);
  const parts = DEST_WELL_FIELDS.map((f) => c[f] as WellValue);
  if (parts.some((p) => p.kind === "flag")) return { kind: "flagged" };
  const [row, col] = parts;
  if (row.kind !== "ok" || col.kind !== "ok") return { kind: "none" };
  return { kind: "origin", cell: { r: row.n, c: col.n - 1 } };
}

export function fieldFlags(
  values: Values,
  sourceSize: PlateSize | undefined,
  destSize: PlateSize | undefined,
  allowVariables: boolean,
): Partial<Record<WellField, string>> {
  const c = classifyAll(values, sourceSize, destSize, allowVariables);
  const out: Partial<Record<WellField, string>> = {};
  for (const f of WELL_FIELDS) {
    const v = c[f];
    if (v && v.kind === "flag") out[f] = v.text;
  }
  return out;
}

// ---- Per-side plate grid (D-05, D-14, PLT-09) ----

export function plateLabel(id: number | string, description: string): string {
  return description.trim() === "" ? String(id) : `${id} · ${description}`;
}

export type HiddenCause =
  | "no-plate"
  | "variable"
  | "unavailable"
  | "not-reported"
  | "no-size"
  | "duplicate-sizes";

export type GridSide =
  | { kind: "grid"; size: PlateSize; label: string }
  | { kind: "loading"; text: string }
  | { kind: "hidden"; cause: HiddenCause; text: string };

function usableSize(p: PlateInfo): PlateSize | undefined {
  const { rowCount: rows, colCount: cols } = p;
  if (rows === null || cols === null) return undefined;
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) return undefined;
  return { rows, cols };
}

export function plateGridSide(
  side: "source" | "destination",
  list: PlateListInput,
  plateValue: unknown,
  allowVariables: boolean,
): GridSide {
  if (plateValue === undefined || plateValue === null || plateValue === "") {
    return {
      kind: "hidden",
      cause: "no-plate",
      text: `Choose a ${side} plate to show its grid`,
    };
  }
  if (allowVariables && isVariableLike(plateValue)) {
    return {
      kind: "hidden",
      cause: "variable",
      text: `The ${side} plate is set by a variable — type the wells below`,
    };
  }
  if (list.mode === "loading") return { kind: "loading", text: LOADING_PLATES };
  if (list.mode === "unavailable") {
    return {
      kind: "hidden",
      cause: "unavailable",
      text: "Plate list unavailable — type the wells below",
    };
  }
  const id = String(plateValue);
  const matches = list.plates.filter((p) => String(p.id) === id);
  if (matches.length === 0) {
    return {
      kind: "hidden",
      cause: "not-reported",
      text: `Plate ${id} is not reported by the instrument — type the wells below`,
    };
  }
  const sizes = matches.map(usableSize);
  const first = sizes[0];
  if (sizes.some((s) => s === undefined) || first === undefined) {
    return {
      kind: "hidden",
      cause: "no-size",
      text: `Plate ${id} has no usable size — type the wells below`,
    };
  }
  if (sizes.some((s) => s && sizeMismatch(s, first))) {
    return {
      kind: "hidden",
      cause: "duplicate-sizes",
      text: `Plate ${id} is listed twice with different sizes — type the wells below`,
    };
  }
  return {
    kind: "grid",
    size: first,
    label: plateLabel(matches[0].id, matches[0].description),
  };
}

const sizeOfSide = (s: GridSide): PlateSize | undefined => (s.kind === "grid" ? s.size : undefined);

const startLabel = (cell: Cell): string => `${rowLabel(cell.r)}${cell.c + 1}`;

// ---- Status line (UI-SPEC rows 1-7, first match wins) ----

export function statusLine(input: {
  source: GridSide;
  dest: GridSide;
  values: Values;
  allowVariables: boolean;
  hover?: Cell;
}): { text: string; tone: "muted" | "danger" } {
  const { source, dest, values, allowVariables, hover } = input;
  const sSize = sizeOfSide(source);
  const dSize = sizeOfSide(dest);
  const block = sourceBlock(values, sSize, allowVariables);
  const origin = destOrigin(values, dSize, allowVariables);

  // 1. Source misfit.
  if (block.kind === "block" && sSize && !fitsAt(block.rect, block.rect, sSize)) {
    return { text: SOURCE_MISFIT, tone: "danger" };
  }
  // 2. Destination misfit at the hovered or placed origin (a size mismatch does not skip it).
  if (block.kind === "block" && dSize) {
    const at = hover ?? (origin.kind === "origin" ? origin.cell : undefined);
    if (at && !fitsAt(at, block.rect, dSize)) return { text: DEST_MISFIT, tone: "danger" };
  }
  // 3. A saved value that cannot be shown.
  if (Object.keys(fieldFlags(values, sSize, dSize, allowVariables)).length > 0) {
    return { text: UNSHOWABLE_STATUS, tone: "danger" };
  }
  // 4. Either grid hidden (loading is not hidden).
  if (source.kind === "hidden" || dest.kind === "hidden") {
    return { text: GRID_UNAVAILABLE_STATUS, tone: "muted" };
  }
  // 5. No source block.
  if (block.kind !== "block") return { text: NOTHING_SELECTED, tone: "muted" };
  const n = block.rect.h * block.rect.w;
  const wells = n === 1 ? "1 well" : `${n} wells`;
  // 6. Block, no destination.
  if (origin.kind !== "origin") {
    return { text: `${wells} selected. Now place them on the destination.`, tone: "muted" };
  }
  // 7. Block placed.
  return {
    text: `Transfer ${wells}: ${startLabel(block.rect)} → ${startLabel(origin.cell)}`,
    tone: "muted",
  };
}

// ---- "Edit as fields" force-open (D-14, D-16) ----

export function forceOpen(input: {
  source: GridSide;
  dest: GridSide;
  values: Values;
  allowVariables: boolean;
}): { forced: boolean; note?: string } {
  const { source, dest, values, allowVariables } = input;
  if (source.kind === "hidden" || dest.kind === "hidden") {
    return { forced: true, note: KEPT_OPEN_GRID };
  }
  if (allowVariables && WELL_FIELDS.some((f) => isVariableLike(values[f]))) {
    return { forced: true, note: KEPT_OPEN_VARIABLE };
  }
  const sSize = sizeOfSide(source);
  const dSize = sizeOfSide(dest);
  if (Object.keys(fieldFlags(values, sSize, dSize, allowVariables)).length > 0) {
    return { forced: true, note: KEPT_OPEN_FLAG };
  }
  const block = sourceBlock(values, sSize, allowVariables);
  if (block.kind === "block") {
    if (sSize && !fitsAt(block.rect, block.rect, sSize)) {
      return { forced: true, note: KEPT_OPEN_FLAG };
    }
    const origin = destOrigin(values, dSize, allowVariables);
    if (dSize && origin.kind === "origin" && !fitsAt(origin.cell, block.rect, dSize)) {
      return { forced: true, note: KEPT_OPEN_FLAG };
    }
  }
  return { forced: false };
}

// ---- Composed view model ----

export interface WellPickerView {
  source: GridSide;
  dest: GridSide;
  sourceCaption?: string;
  destCaption?: string;
  sourceRect?: { rect: Rect; bad: boolean };
  footprint?: { rect: Rect; state: "ghost" | "put" | "bad" };
  mismatch?: string;
  destClickable: boolean;
  status: { text: string; tone: "muted" | "danger" };
  forced: boolean;
  note?: string;
  flags: Partial<Record<WellField, string>>;
  clearDisabled: boolean;
  sourceMetrics?: GridMetrics;
  destMetrics?: GridMetrics;
}

// Returns a view, never a patch: a plate change, list load or hover writes nothing (D-13).
export function buildWellPickerView(input: {
  plates: PlateListInput;
  values: Values;
  allowVariables: boolean;
  hover?: Cell;
}): WellPickerView {
  const { plates, values, allowVariables, hover } = input;
  const source = plateGridSide("source", plates, values.source_plate_id, allowVariables);
  const dest = plateGridSide("destination", plates, values.dest_plate_id, allowVariables);
  const sSize = sizeOfSide(source);
  const dSize = sizeOfSide(dest);

  const mismatch =
    sSize && dSize && sizeMismatch(sSize, dSize) ? mismatchText(sSize, dSize) : undefined;
  const block = sourceBlock(values, sSize, allowVariables);
  const origin = destOrigin(values, dSize, allowVariables);

  const view: WellPickerView = {
    source,
    dest,
    destClickable: dest.kind === "grid" && block.kind === "block" && !mismatch,
    status: statusLine({ source, dest, values, allowVariables, hover }),
    ...forceOpen({ source, dest, values, allowVariables }),
    flags: fieldFlags(values, sSize, dSize, allowVariables),
    clearDisabled: WELL_FIELDS.every((f) => isBlankWell(values[f])),
  };
  if (mismatch) view.mismatch = mismatch;
  if (source.kind === "grid") {
    view.sourceCaption = source.label + DRAG_CAPTION_SUFFIX;
    view.sourceMetrics = gridMetrics(source.size);
  }
  if (dest.kind === "grid") {
    view.destCaption = mismatch ? dest.label : dest.label + PLACE_CAPTION_SUFFIX;
    view.destMetrics = gridMetrics(dest.size);
  }
  if (sSize && block.kind === "block") {
    view.sourceRect = { rect: block.rect, bad: !fitsAt(block.rect, block.rect, sSize) };
  }
  if (dSize && block.kind === "block" && !mismatch) {
    const at = hover ?? (origin.kind === "origin" ? origin.cell : undefined);
    if (at) {
      const state = !fitsAt(at, block.rect, dSize) ? "bad" : hover ? "ghost" : "put";
      view.footprint = { rect: { r: at.r, c: at.c, h: block.rect.h, w: block.rect.w }, state };
    }
  }
  return view;
}

// The only destination-click producer: accepted only where the footprint fits
// and the plates match.
export function destClickPatch(
  view: WellPickerView,
  values: Values,
  allowVariables: boolean,
  cell: Cell,
): Record<string, string | number> | undefined {
  if (!view.destClickable || view.dest.kind !== "grid") return undefined;
  const block = sourceBlock(values, sizeOfSide(view.source), allowVariables);
  if (block.kind !== "block") return undefined;
  return fitsAt(cell, block.rect, view.dest.size) ? destPatch(cell) : undefined;
}
