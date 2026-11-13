// The source-grid drag state machine (07-10, WR-01). Vitest runs in node with
// no DOM, so every pointer decision lives here and WellPicker only forwards
// event facts. React-free and Chakra-free; the only import is wellGeometry.

import { dragRect, sourcePatch } from "@/components/tools/wellGeometry";
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

const sameRect = (a: Rect, b: Rect): boolean =>
  a.r === b.r && a.c === b.c && a.h === b.h && a.w === b.w;

// Pure: never mutates its input, returns new objects when the state changes.
// A patch exists only while the primary button is held (D-13, WR-01), and a
// drag ends on up, cancel, lost capture, an uncaptured leave, or a move that
// arrives with no button held.
export function sourcePointerStep(
  state: SourceDragState,
  input: SourcePointerInput,
): SourcePointerResult {
  switch (input.type) {
    case "down": {
      if (input.button !== 0 || !input.cell) return { state };
      const last = dragRect(input.cell, input.cell);
      return {
        state: { anchor: input.cell, last, captured: input.captured },
        patch: sourcePatch(last),
      };
    }
    case "move": {
      if (!state) return { state: undefined };
      if ((input.buttons & 1) === 0) return { state: undefined };
      if (!input.cell) return { state };
      const rect = dragRect(state.anchor, input.cell);
      if (sameRect(state.last, rect)) return { state };
      return { state: { ...state, last: rect }, patch: sourcePatch(rect) };
    }
    case "leave":
      return { state: state && !state.captured ? undefined : state };
    case "up":
    case "cancel":
    case "lost-capture":
      return { state: undefined };
  }
}
