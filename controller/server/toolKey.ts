// No imports (D-24: safe to import as a VALUE from the client's pure
// decision module, which must stay free of any server-value import that
// itself pulls in heavier dependencies). Single source of truth for
// tool-id normalization (WR-06) — previously reimplemented independently
// in controlDecision.ts, recoveryControl.ts and routers/tool.ts, "kept in
// sync by convention, not import". All three depend on this transform
// staying byte-for-byte identical: "tracked by the running step" (client),
// "controlled only from the run page" (recoveryControl's refusal check)
// and "which DB row does this id refer to" (getToolFromDB) would silently
// desync from each other if any one of them diverged.
export function normalizeToolKey(s: string | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
