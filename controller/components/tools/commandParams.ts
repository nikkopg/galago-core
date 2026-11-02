// Pure param-strip for STACK command sends (D-04 planner decision: omit
// blanks). proto3 optional fields encode on presence, so a sent empty string
// is wire-visible while an omitted key is absent — a blank is dropped, an
// operator-typed 0 or false is a choice and passes through. Applied ONLY to
// STACK tool types in the tool page's handleSubmit; every other tool type's
// params pass through verbatim so F.A.S.T. wire behavior stays byte-identical
// to today. The chosen behaviour is pinned against the real encoder by the
// 05-03 blank-optional wire case.

// Blank = undefined, null or the empty string; everything else — including
// 0 and false — is kept.
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// TDD RED scaffold (05-04 Task 1): pass-through stub so the coerceBooleanParams
// tests fail on ASSERTION (a typed "false" stays the string "false") rather than
// on a missing export — an invalid-RED parser/module error would not authorize
// GREEN. The real coercion replaces this body in the feat commit.
export function coerceBooleanParams<T extends Record<string, unknown>>(
  params: T,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fields: ReadonlyArray<{ name: string; type: unknown }>,
): T {
  return params;
}

// Copy of `params` with blank keys dropped: top-level blanks are omitted, and
// nested plain-object values (parentField groups) get the same drop one level
// deep. Arrays and every other value pass through verbatim. The input is
// never mutated.
export function omitBlankParams<T extends Record<string, unknown>>(params: T): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (isBlank(value)) {
      continue;
    }
    result[key] = isPlainRecord(value) ? omitBlankParams(value) : value;
  }
  return result as T;
}
