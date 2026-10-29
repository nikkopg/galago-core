import { db } from "@/db/client";
import { logs } from "@/db/schema";

// Log-forging guard: client-controlled values are interpolated into audit-log
// `details` strings (action names, refusal messages). Newlines and control
// characters inside them would let an attacker forge extra audit records
// inside the details field, so every composition site flattens the FULL
// details string onto one line before handing it to logAction — the values
// that reach validation, DB writes, the send path and client-facing errors
// stay verbatim.
export const sanitizeLogText = (value: string): string =>
  value.replace(/[\r\n\u0000-\u001f]/g, "?");

export const logAction = async (log: { level: string; action: string; details: string }) => {
  try {
    await db.insert(logs).values(log);
  } catch (error) {
    console.error("Failed to log action:", error);
  }
};
