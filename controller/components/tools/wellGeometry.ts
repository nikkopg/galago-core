// RED-phase skeleton (07-02 Task 1): exports and types only, every function
// throws so the target tests fail on execution, not on import.

export const WELL_FIELDS = [] as unknown as readonly [
  "source_start_row",
  "source_start_col",
  "num_rows",
  "num_cols",
  "dest_start_row",
  "dest_start_col",
];
export type WellField = (typeof WELL_FIELDS)[number];

export interface PlateSize {
  rows: number;
  cols: number;
}
export interface PlateInfo {
  id: number;
  description: string;
  rowCount: number | null;
  colCount: number | null;
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

const todo = (): never => {
  throw new Error("not implemented");
};

export const isWellField = (_name: string): _name is WellField => todo();
export const rowLabel = (_index: number): string => todo();
export const parseRowLabel = (_label: unknown): number | undefined => todo();
export const isBlankWell = (_value: unknown): boolean => todo();
export const dragRect = (_a: Cell, _b: Cell): Rect => todo();
export const fitsAt = (_o: Cell, _b: { h: number; w: number }, _s: PlateSize): boolean => todo();
export const sizeMismatch = (_a: PlateSize, _b: PlateSize): boolean => todo();
export const mismatchText = (_a: PlateSize, _b: PlateSize): string => todo();
export const wellSizePx = (_cols: number): number => todo();
export const gridMetrics = (_size: PlateSize): GridMetrics => todo();
export const cellFromPoint = (
  _x: number,
  _y: number,
  _box: { left: number; top: number },
  _m: GridMetrics,
  _size: PlateSize,
  _clamp: boolean,
): Cell | undefined => todo();
export const sourcePatch = (_rect: Rect): Record<string, string | number> => todo();
export const destPatch = (_cell: Cell): Record<string, string | number> => todo();
export const CLEAR_PATCH: Readonly<Record<string, "">> = {};
export const wellFieldText = (_value: unknown): string => todo();
export const wellFieldPatch = (_f: WellField, _t: string): Record<string, string | number> => todo();
