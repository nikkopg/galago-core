// The source-grid drag state machine (07-10, WR-01). Vitest runs in node with
// no DOM, so every pointer decision lives here and WellPicker only forwards
// event facts. React-free and Chakra-free; the only import is wellGeometry.

import type { Cell, Rect } from "@/components/tools/wellGeometry";

export interface SourceDrag {
  anchor: Cell;
  last: Rect;
  captured: boolean;
}
export type SourceDragState = SourceDrag | undefined;

export type SourcePointerInput =
  | { type: "down"; button: number; cell: Cell | undefined; captured: boolean }
  | { type: "move"; buttons: number; cell: Cell | undefined }
  | { type: "leave" }
  | { type: "up" }
  | { type: "cancel" }
  | { type: "lost-capture" };

export interface SourcePointerResult {
  state: SourceDragState;
  patch?: Record<string, string | number>;
}

// Stub (RED): returns the state unchanged.
export function sourcePointerStep(
  state: SourceDragState,
  _input: SourcePointerInput,
): SourcePointerResult {
  return { state };
}
