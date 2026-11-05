// No imports. The one shared predicate for a "{{name}}" variable reference:
// the same rule the instance Tool.executeCommand applies before it substitutes
// a param from the variables table (a string that starts with "{{" and ends
// with "}}"), and the one both protocol hosts' isVariableReference use. The
// server option parsers use it to drop an instrument-reported name that run-time
// substitution could expand into something the operator never chose (T-06-03).
export function isVariableLike(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("{{") && value.endsWith("}}");
}
