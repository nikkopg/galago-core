// No imports. RED stub (07-09 Task 1): every export is present with the wrong
// behaviour so the failing tests fail on assertions, not on a missing module.
export const INT32_MAX = 2147483647;
export const INT32_MIN = -2147483648;

export const INT32_PARAM_FIELDS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = { fast: { transfer: [] } };

export interface Int32Problem {
  field: string;
  value: unknown;
}

export function isExactInt32(_value: unknown): boolean {
  return true;
}

export function int32FromDigits(digits: string): number | string {
  return Number(digits);
}

export function int32ParamProblems(
  _toolType: string,
  _command: string,
  _params: unknown,
): Int32Problem[] {
  return [];
}

export function int32RefusalMessage(
  _toolId: string,
  _command: string,
  _problems: Int32Problem[],
): string {
  return "";
}
