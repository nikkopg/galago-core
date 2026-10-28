// The one reader of a persisted queue-row error. After the SQLite/SuperJSON
// round trip a stored error is a plain Error (name and message, no code), but
// the field is typed `unknown`, so strings and `{ message }` objects are read
// too. Shared by the run outcome and the step error card so the "has an
// error" rule cannot drift between them.
export function storedErrorText(error: unknown): string | null {
  let text: unknown = null;
  if (error instanceof Error) {
    text = error.message;
  } else if (typeof error === "string") {
    text = error;
  } else if (typeof error === "object" && error !== null && !Array.isArray(error)) {
    text = (error as { message?: unknown }).message;
  }
  if (typeof text !== "string" || text.trim().length === 0) return null;
  return text;
}
