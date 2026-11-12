# Phase 7: F.A.S.T. Plate Dropdowns - Discussion Log

> **Audit trail only.** Do not use this file as input to planning, research or execution agents.
> The decisions are in CONTEXT.md. This log keeps the alternatives that were considered.

**Date:** 2026-11-12
**Phase:** 07-f-a-s-t-plate-dropdowns
**Mode:** `--auto`. All gray areas were auto-selected, and each was resolved with the recommended option.
**Areas discussed:** Gate and wave order, get_plates reply and parser, Unset-never-0, Decks, Tip reuse,
Well-picker placement and sizing, Grid sync semantics, Size mismatch, Hosts

**Inherited, not re-asked:** D6, D10 and D11 (Phase 6 D-01..D-17).

---

## Gate and wave order
| Option | Description | Selected |
|---|---|---|
| Ungated work first, then a blocking gate task before the plate work | Decks, the checkbox and the geometry core land now. The plate parts wait for the frozen `get_plates`. | ✓ |
| Block the whole phase until galago-tools ships | Nothing lands until the upstream work is done. | |
| Stub `fast.plates` against the contract | Build ahead of the frozen proto. | |

**Choice:** [auto] Ungated first, then a gate. Finding: galago-tools `origin/feat/stack-tool` is still at `4ccd3da` and has no `get_plates`.

## get_plates reply and parser
| Option | Description | Selected |
|---|---|---|
| Use the contract shape; on a bad entry, drop it and mark the list degraded; flag duplicates | Same as the Phase 6 D-03/D-08 pattern | ✓ |
| Reject the whole reply when any entry is bad | Stricter, but loses the good plates | |

**Contract open points:** when offline, show plain input and never a stale list (D6). Keep the `refresh` flag and wire it to the Refresh button.
**Plates with unknown geometry:** stay selectable, and their grid is hidden.

## Unset plate never saved as 0
| Option | Description | Selected |
|---|---|---|
| Exempt the plate and deck fields from the `handleSubmit` zero fill-in and save `""` | A narrow exception to Phase 6 D-15, required by PLT-04 | ✓ |
| Block saving while a plate is unset | Not required. The tool server stays the final check. | |

## Decks
| Option | Description | Selected |
|---|---|---|
| Static binding-map role with options 1-6 from one constant; commandFields unchanged | Keeps the `toStrictEqual` pins green | ✓ |
| Change `commandFields.fast` to a `select` | Breaks the pins and the born-empty pattern | |

## Tip reuse
| Option | Description | Selected |
|---|---|---|
| Binding-map checkbox; write `reuse` when a new step is created; a saved blank or other value shows indeterminate and flagged | Visible state always equals the value sent, and saved values are never rewritten | ✓ |
| Default applied only at submit | The checked box could disagree with the stored params | |

## Well-picker placement and sizing
| Option | Description | Selected |
|---|---|---|
| Inline, side by side and wrapping; 18 px wells, about 12 px for 24 columns; scroll inside its own box | Matches the mockup and avoids the G-03-3 overflow | ✓ |
| Open in a modal | Not in the approved mockup; adds another modal level | |
| Reuse `PlateGrid.tsx` | Driven by a plate-type string, falls back to 96, has no drag | |

## Grid sync semantics
| Option | Description | Selected |
|---|---|---|
| A plate change never clears the well fields, only re-checks fit; only Clear empties them; a new drag keeps the destination | Same as Phase 6 D-09 (no clears driven by effects) | ✓ |
| A plate change clears the wells | Silently rewrites saved values | |

## Size mismatch
| Option | Description | Selected |
|---|---|---|
| Show a destination warning naming -9006 instead of a footprint; no click; saving not blocked | As PLT-09 requires | ✓ |

## Hosts
| Option | Description | Selected |
|---|---|---|
| Tool page, modal, and the drawer only while editing; the read-only run page is unchanged | Phase 6 D-14 | ✓ |

## Claude's Discretion
File names, caps, exact copy, the plan split, and whether to use `OptionsSelect` directly or through an adapter.

## Deferred Ideas
Cross-format quadrant transfers; plate size and capacity in labels; `get_plates` adapter work (belongs to galago-tools).
Todo folded: the F.A.S.T. plate-list todo. Todo reviewed and not folded: the lanes todo (Phase 8).
