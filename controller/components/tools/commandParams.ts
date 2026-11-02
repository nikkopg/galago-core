// Pure param-strip for STACK command sends (D-04 planner decision: omit
// blanks). proto3 optional fields encode on presence, so a sent empty string
// is wire-visible while an omitted key is absent — a blank is dropped, an
// operator-typed 0 or false is a choice and passes through. Applied ONLY to
// STACK tool types in the tool page's handleSubmit; every other tool type's
// params pass through verbatim so F.A.S.T. wire behavior stays byte-identical
// to today. The chosen behaviour is pinned against the real encoder by the
// 05-03 blank-optional wire case.

// Blank = undefined, null, the empty string or a NaN number; everything else —
// including 0 and false — is kept. (NaN blank, 05-04: Chakra's NumberInput
// stores parse("") === NaN when the operator clears a field, so a
// visually-emptied number must not survive the strip, WR-01.)
function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (typeof value === "number" && Number.isNaN(value))
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// CR-01 (05-04 gap closure): the page's boolean branch stores the operator's
// typed value as the STRING "false"/"true" (<Input type="boolean"> is an
// invalid HTML input type that falls back to a text input) and protobufjs
// Writer.bool is value ? 1 : 0 — so the uncoerced string encodes as true and no
// input could send false. Convert boolean-typed string values to real booleans
// BEFORE the blank strip on STACK sends: only the exact strings "true"/"false"
// flip; any other value — the born-empty "" included — passes through
// untouched for the strip to handle. Fields not declared boolean, and any
// top-level key with no declared field, pass verbatim. Nested parentField
// groups (a Field[] inside a field.type) get the same walk one level deep,
// mirroring omitBlankParams. Pure and non-mutating (a new object, exactly
// like omitBlankParams). The Field type in types.ts is declared but not
// exported, so the field metadata is accepted structurally.
export function coerceBooleanParams<T extends Record<string, unknown>>(
  params: T,
  fields: ReadonlyArray<{ name: string; type: unknown }>,
): T {
  const booleanByName = new Map<string, unknown>();
  const nested = new Map<string, ReadonlyArray<{ name: string; type: unknown }>>();
  for (const field of fields) {
    if (field.type === "boolean") {
      booleanByName.set(field.name, true);
    } else if (Array.isArray(field.type)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nested.set(field.name, field.type as any);
    }
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (booleanByName.has(key)) {
      result[key] = value === "true" ? true : value === "false" ? false : value;
      continue;
    }
    if (nested.has(key) && isPlainRecord(value)) {
      result[key] = coerceBooleanParams(
        value,
        nested.get(key) as ReadonlyArray<{ name: string; type: unknown }>,
      );
      continue;
    }
    result[key] = value;
  }
  return result as T;
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
