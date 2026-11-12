// F.A.S.T. get_plates reply fixtures for the well-picker core tests (07-02).
// Only the FIRST golden entry (id 1, "Default 96-Well Conical", 8x12, 401.92
// uL) is copied value for value from fast-mcp
// tests/test_server_json_characterization.py:247-249; nothing is imported from
// that repository. Every other entry below is an INVENTED fixture value: the
// ids, descriptions and sizes exist only to exercise the geometry helpers.

import type { PlateInfo, PlateSize } from "@/components/tools/wellGeometry";

export const FAST_PLATES_GOLDEN = {
  plates: [
    // Golden (fast-mcp characterization test).
    {
      id: 1,
      description: "Default 96-Well Conical",
      rowCount: 8,
      colCount: 12,
      workingCapacity: 401.92,
    },
    // Invented fixtures from here on.
    { id: 12, description: "Greiner 96 flat", rowCount: 8, colCount: 12, workingCapacity: 350 },
    { id: 7, description: "Corning 96 round", rowCount: 8, colCount: 12, workingCapacity: 300 },
    { id: 20, description: "Greiner 384 flat", rowCount: 16, colCount: 24, workingCapacity: 90 },
    { id: 50, description: "1536 fixture", rowCount: 32, colCount: 48, workingCapacity: 12 },
  ],
};

// The same entries as the parsed list the picker receives (no workingCapacity),
// plus the edge cases: an entry with no usable size, a duplicated id whose
// entries agree on size (40), and a duplicated id whose entries disagree (41).
export const FIXTURE_PLATES: PlateInfo[] = [
  ...FAST_PLATES_GOLDEN.plates.map(({ id, description, rowCount, colCount }) => ({
    id,
    description,
    rowCount,
    colCount,
  })),
  { id: 30, description: "No size", rowCount: null, colCount: null },
  { id: 40, description: "Twin A", rowCount: 8, colCount: 12 },
  { id: 40, description: "Twin B", rowCount: 8, colCount: 12 },
  { id: 41, description: "Split A", rowCount: 8, colCount: 12 },
  { id: 41, description: "Split B", rowCount: 16, colCount: 24 },
];

export const PLATE_96: PlateSize = { rows: 8, cols: 12 };
export const PLATE_384: PlateSize = { rows: 16, cols: 24 };

// A get_plates reply meta with exactly n entries (ids 1..n, 8x12); the 07-06
// cap-boundary tests use it.
export function platesWithCount(n: number): { plates: Record<string, unknown>[] } {
  return {
    plates: Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      description: `Fixture plate ${i + 1}`,
      rowCount: 8,
      colCount: 12,
      workingCapacity: 100,
    })),
  };
}

// Bad-entry reply builders for the parsePlates cases (07-06). Each returns a
// get_plates reply meta with ONE entry built from the golden first plate with
// the named override, so a case reads as "this one field is wrong".
export function platesWith(override: Record<string, unknown>): { plates: unknown[] } {
  return { plates: [{ ...FAST_PLATES_GOLDEN.plates[0], ...override }] };
}

// An entry whose id is absent (not merely undefined).
export function platesWithoutId(): { plates: unknown[] } {
  const { id: _id, ...rest } = FAST_PLATES_GOLDEN.plates[0];
  void _id;
  return { plates: [rest] };
}

// Fractional id (12.7 must never be offered as 12).
export const PLATES_FRACTIONAL_ID = platesWith({ id: 12.7 });

// A description of exactly n UTF-16 code units.
export function platesWithDescriptionLength(n: number): { plates: unknown[] } {
  return platesWith({ description: "d".repeat(n) });
}

// An entry with no geometry keys at all.
export function platesWithoutGeometry(): { plates: unknown[] } {
  return {
    plates: [{ id: 3, description: "No geometry", workingCapacity: 10 }],
  };
}

// An entry whose id/description/rowCount/colCount exist ONLY on its prototype:
// own() must treat every one of them as absent.
export function platesWithInheritedKeys(): { plates: unknown[] } {
  const entry = Object.create({
    id: 9,
    description: "inherited",
    rowCount: 8,
    colCount: 12,
  }) as Record<string, unknown>;
  return { plates: [entry] };
}
