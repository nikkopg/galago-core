// No imports. The int32 exactness rules shared by the client patch producers
// and the server send guard (like utils/variableRef.ts).
//
// Why this exists (CR-01): the protobufjs int32 writer COERCES its input, so a
// value outside the 32-bit range or not a whole number reaches the instrument
// as a different one. Measured against the real Writer.int32 / Reader.int32:
// 4294967297 decodes as 1 (plate 1), 2147483648 as -2147483648, "3.5" as 3,
// "0x10" as 16 and true as 1. A plate id, deck or well number must never be
// silently turned into a different value, so out-of-range digits are kept as
// the operator's text, flagged, and refused before any gRPC send.
export const INT32_MAX = 2147483647;
export const INT32_MIN = -2147483648;

// The int32 fields of each command's generated encoder, per tool type.
// test/int32.test.ts pins fast.transfer to the generated Command_Transfer
// encoder so a proto regen cannot drift from this table (T-07-36).
export const INT32_PARAM_FIELDS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = Object.freeze({
  fast: Object.freeze({
    transfer: Object.freeze([
      "source_deck",
      "dest_deck",
      "source_plate_id",
      "dest_plate_id",
      "source_start_col",
      "dest_start_col",
      "num_rows",
      "num_cols",
      "expected_tray_id",
    ]),
  }),
});

export interface Int32Problem {
  field: string;
  value: unknown;
}

// Precondition: digits is one or more ASCII digits. A number when it is at most
// INT32_MAX; otherwise the digits unchanged, never rounded and never clipped.
export function int32FromDigits(digits: string): number | string {
  const n = Number(digits);
  return n <= INT32_MAX ? n : digits;
}

// True only for an integer number within the int32 range, or a string of one
// or more ASCII digits whose number is at most INT32_MAX. Blank values, signs,
// fractions, exponents, hex, whitespace and booleans are all false.
export function isExactInt32(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX;
  }
  if (typeof value === "string") {
    return /^[0-9]+$/.test(value) && Number(value) <= INT32_MAX;
  }
  return false;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

// Own-property lookups only, exact oneof keys. A blank value is skipped: it
// keeps today's behaviour (sent as 0 or absent, then refused by the adapter,
// RESEARCH Pitfall 2). One problem per remaining field that is not exact.
export function int32ParamProblems(
  toolType: string,
  command: string,
  params: unknown,
): Int32Problem[] {
  if (!Object.prototype.hasOwnProperty.call(INT32_PARAM_FIELDS, toolType)) return [];
  const commands = INT32_PARAM_FIELDS[toolType];
  if (!Object.prototype.hasOwnProperty.call(commands, command)) return [];
  if (typeof params !== "object" || params === null) return [];
  const record = params as Record<string, unknown>;
  const problems: Int32Problem[] = [];
  for (const field of commands[command]) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) continue;
    const value = record[field];
    if (isBlank(value)) continue;
    if (!isExactInt32(value)) problems.push({ field, value });
  }
  return problems;
}

const SHOWN_MAX = 40;

function shown(value: unknown): string {
  const text = String(value);
  return text.length > SHOWN_MAX ? `${text.slice(0, SHOWN_MAX)}…` : text;
}

export function int32RefusalMessage(
  toolId: string,
  command: string,
  problems: readonly Int32Problem[],
): string {
  const named = problems.map((p) => `${p.field} = '${shown(p.value)}'`).join(", ");
  return `"${command}" on tool "${toolId}" was not sent: ${named}. Each must be a whole number within the instrument's 32-bit range (up to ${INT32_MAX}); otherwise the instrument would receive a different value.`;
}
