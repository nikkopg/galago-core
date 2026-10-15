---
created: 2026-10-15T05:00:34.361Z
title: Evaluate whether expected_tray_id is still needed
area: ui
severity: minor
files:
  - controller/components/tools/constants.ts:329-330
  - vendor/galago-tools/tools/fast/server.py:651-659
  - vendor/galago-tools/tools/fast/server.py:307-322
---

## Problem

The F.A.S.T. Transfer command has an optional `expected_tray_id` number field
(`commandFields.fast.transfer`). When set, it overrides the tool Config's `expected_tray_id`
(galago-tools D-14). The user questions whether it's still useful, especially once plates are
picked from the instrument's own plate list (see the todo "Fetch F.A.S.T. plate list for
source/dest plate dropdowns").

It is not just a UI field. It feeds the adapter's tray-confirmation gate:
- `_expected_tray_id()` (`server.py:651-659`) resolves the per-command value, then the Config
  value. `0` means unset; negative values pass through and fail the gate closed.
- `run_transfer(..., expected_tray_id=...)` can return `NeedsConfirmation`, reported as
  "tray X installed, expected Y" or "tray X installed, no expected tray configured"
  (`server.py:318-321`).

## Solution

TBD. Decide before removing anything:
1. Check what the instrument and `fast_mcp` do when no expected tray is configured. Does the
   transfer stop at `NeedsConfirmation` every time? If so, removing the field without a replacement
   would block every run, or it would need an operator-confirmation path.
2. If the per-command override is redundant (Config already covers it, or tray identity is
   implied by the plate selection), remove only the per-command field from `commandFields` and
   keep the Config value. Saved protocols that already have `expected_tray_id` in their params
   must keep loading (see the D-20 legacy-step handling in `test/runControl.test.ts`).
3. If the tray-ID check itself is obsolete, removing it is an adapter change in galago-tools and
   a safety-gate change, and needs an explicit decision from the instrument owner.
