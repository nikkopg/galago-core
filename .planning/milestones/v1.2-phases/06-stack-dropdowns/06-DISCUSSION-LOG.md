# Phase 6: STACK Dropdowns - Discussion Log

> **Audit trail only.** Do not use this log as input to planning, research or execution agents.
> CONTEXT.md holds the decisions. This log keeps the alternatives that were considered.

**Date:** 2026-11-05
**Phase:** 06-stack-dropdowns
**Mode:** `--auto` (recommended option chosen for every question; no user prompts)
**Areas discussed:** Read path and registry, Location cascade, Field binding and shared control,
`{{variable}}` binding, Edit drawer, Re-pin and regen

---

[auto] Context: no existing CONTEXT.md, checkpoint or plans.
[auto] Todos: 2 matched with score ≥ 0.4. Neither was folded, because both carry a `resolves_phase` for
a different phase (7 and 8).
[--auto] Selected all gray areas: Read path and registry, Location cascade, Field binding and shared control, Variable binding, Edit drawer, Re-pin and regen.

## Read path and registry (D10)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated `Tool` read method + closed source enum | `controlCommand`-style, deadline, no substitution | ✓ |
| Reuse `Tool.controlCommand` | Mixes reads with operator control commands | |
| Go through `CommandQueue` | Forbidden by DRP-07 | |

[auto] Read path — Q: "How are lists read?" → Selected: "Dedicated read method + closed enum" (recommended default)
[auto] Fallback (D6) — Q: "Offline behaviour?" → Selected: "Plain input + hint, never a stale list; 15 s TTL; Refresh skips both caches" (recommended default)
[auto] Cache invalidation — Q: "What drops cached lists?" → Selected: "Per-tool configure generation bumped by configure/edit/delete/clearToolStore" (recommended default)

## Location cascade (D7, STK-02..04)

| Option | Description | Selected |
|--------|-------------|----------|
| Flag ambiguous, keep selectable | Adapter is the gate; no state checks | ✓ |
| Disable ambiguous options | Listed in Future Requirements | |
| Hide or collapse duplicates | Anti-feature: could address the wrong location | |

[auto] Ambiguity — Q: "Flag or disable?" → Selected: "Flag only" (recommended default)
[auto] Calibration — Q: "What to hide?" → Selected: "Hide uncalibrated decks and nests; still show the device" (recommended default)
[auto] Cascade reset — Q: "When do children clear?" → Selected: "Only on the parent's operator onChange" (recommended default)

## Field binding and shared control

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling `fieldOptions.ts` binding map | `commandFields` stays byte-identical | ✓ |
| Add `source` to `commandFields` entries | Breaks the `toStrictEqual` pin | |

[auto] Refresh — Q: "One button per field or per source?" → Selected: "Per source, with a status line" (recommended default)

## `{{variable}}` binding (DRP-03)

[auto] Q: "Reuse the existing variable picker?" → Selected: "Reuse `handleVariableSelect`; a bound parent turns its children into typed inputs" (recommended default)

## Edit drawer (D11)

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdowns while `isEditing` only | Required by DRP-08; run page stays read-only | ✓ |
| Free text in drawer | Contradicts DRP-08 | |

## Re-pin and regen (STK-08)

[auto] Q: "Order?" → Selected: "First task of the first plan; stop on a non-empty diff" (recommended default)

## Claude's Discretion

- Naming and file split, caps, deadline mechanism, copy, and plan split.

## Deferred Ideas

- Option-label context (Future Requirements).
- Disabling ambiguous locations (Future Requirements).
