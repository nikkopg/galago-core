---
phase: 03-queue-start-guard-tool-error-visibility
reviewed: 2026-10-29T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - controller/components/runs/list/SwimLaneCommandComponent.tsx
  - controller/test/staticScan.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-29
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

This is an incremental re-review after gap-closure plan 03-07 (commits d8ecac5 and bf692ba, UAT gap G-03-3). The earlier full review is in git history at a7b7701 and is overwritten here. Scope is the diff since a7b7701 only.

The component change moves the stored-error `Text` into an `HStack` row beside `CommandImage`. The image sits in a `flexShrink={0}` Box, and the text gets `flex="1"` and `minW={0}`. I checked the following and found no defect:

- Error text is still rendered only as a React child, so it is auto-escaped (T-03-18 holds).
- The `title`, `noOfLines={3}`, `wordBreak` and `whiteSpace` props are retained, so a long unbroken string cannot widen the row.
- A card with no error keeps the image centred (`justifyContent="center"`, no flex-grow sibling).
- `CommandImage.tsx` is unchanged. The `ProtocolDetailView` hit for "SwimLaneCommandComponent" is a separately named local component and is unaffected.
- `vitest run test/staticScan.test.ts` passes (31 tests).

No correctness or security defects. The remaining findings concern the strength of the new regression scan and two edge-state layout details. Fit within the 165px card (scrollHeight <= clientHeight) cannot be verified statically. It stays an open human check (UAT test 3 retest).

## Warnings

### WR-01: G-03-3 scan lets `flexShrink={0}` pass when it is not on the image wrapper

**File:** `controller/test/staticScan.test.ts:556`
**Issue:** The test asserts `cardSrc.slice(rowOpen, rowClose)` matches `/flexShrink=\{0\}/`. That slice covers the whole row (image Box and error Text). The match therefore passes if `flexShrink={0}` sits on any element in the row, including the error `Text`. The test does not bind it to the Box that wraps `<CommandImage`. If a later edit drops the wrapper and puts `flexShrink={0}` on the text, or removes the wrapper while a stray `flexShrink={0}` remains, the scan stays green. The result is a shrinkable image and a regression of the layout the test exists to pin. `width="100%"` and `justifyContent="center"` on the row are also not pinned. Dropping `justifyContent` would silently de-centre the image on every card without an error.
**Fix:** Anchor the assertion to the wrapper and pin the row props:
```ts
expect(cardSrc.slice(rowOpen, imgAt)).toMatch(/<Box flexShrink=\{0\}>\s*$/);
expect(cardSrc.slice(rowOpen, imgAt)).toMatch(/justifyContent="center"/);
```
Slicing `rowOpen..imgAt` isolates the opening `<HStack ...>` and the immediate wrapper of `<CommandImage`.

### WR-02: Row adds a stray 8px gap and shifts the error text while `tool.info` loads or for tools without an image

**File:** `controller/components/runs/list/SwimLaneCommandComponent.tsx:160-168`
**Issue:** `CommandImage` renders nothing while `config` is loading and `<Box></Box>` when the tool has no `imageUrl`. The `flexShrink={0}` wrapper Box is always rendered, so it is a zero-width flex item. `HStack spacing={2}` still inserts its 8px gap between the empty wrapper and the error text. For a FAILED or skipped-after-failure card in either state, the text is indented 8px and loses 8px of width. The row height also becomes the text height instead of the 64/65px image block. The plan records the loading flash as accepted, but the no-`imageUrl` case persists after load and is not mentioned. It is cosmetic and cannot overflow the card, because the 3-line text is 63px.
**Fix:** Render the wrapper only when there is something to wrap, or drop the gap when the image is absent. For example, move the spacing onto the image Box:
```tsx
<HStack spacing={0} width="100%" justifyContent="center">
  <Box flexShrink={0} mr={errorText !== null ? 2 : 0}>
    <CommandImage ... />
  </Box>
```
This only removes the gap when the image area is empty if the Box is also hidden in that case. Otherwise accept and document the no-`imageUrl` behaviour.

## Info

### IN-01: Error text is hover-only for the full message

**File:** `controller/components/runs/list/SwimLaneCommandComponent.tsx:179`
**Issue:** The text is clamped to 3 lines, and the only way to read the remainder on the card is the native `title` tooltip. It is not reachable by keyboard or touch. The banner and Details still carry the full text (T-03-23), so this is mitigated. It remains a usability gap for a text that is the operator's failure reason.
**Fix:** Optional. Make the text focusable (`tabIndex={0}`) or use a Chakra `Tooltip`, in a later UI pass.

### IN-02: Sticky-label scan is whitespace and prop-order sensitive

**File:** `controller/test/staticScan.test.ts:574-576`
**Issue:** The label regex requires the literal `<Box bottom={0} position="sticky">` followed by `<Text>{capitalizeFirst(...)}</Text>`. A harmless reorder of props or a Prettier wrap would fail the test with a message that does not point at G-03-3. The plan prefers this strictness to pin the unchanged label, so this is not a defect.
**Fix:** Optional. Relax to match `position="sticky"` and the `capitalizeFirst(command.commandInfo.command` call separately.

---

_Reviewed: 2026-10-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (incremental re-review after 03-07; earlier review at a7b7701)_
