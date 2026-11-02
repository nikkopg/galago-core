---
status: diagnosed
trigger: "UAT Test 3 gap G-03-3: a FAILED / skipped-after-failure step card's error text does not fit the 165px card; sticky 'Run script' label drawn over the first error line"
created: 2026-10-29T04:00:00Z
updated: 2026-10-29T04:30:00Z
goal: find_root_cause_only
audit_acknowledged:
  milestone: v1.1
  at: 2026-11-02
  status: diagnosed
---

## Current Focus

hypothesis: CONFIRMED. The non-error card already uses 147-148px of the 151px content box. The error block adds 8px gap + 63px (3 lines), so content is 218px (scrollHeight 230). Overflow makes the dormant `position: sticky; bottom: 0` label pin to the scrollport bottom, 67px above its flow slot, on top of the error text.
test: replicated the card DOM with Chakra-equivalent computed CSS in headless Chrome (injected into the live /runs page so it inherits the app's body/line-height); measured every block; toggled sticky; swept scrollTop; tried a side-by-side variant.
expecting: n/a (diagnosis complete)
next_action: return ROOT CAUSE FOUND to caller (plan-phase --gaps owns the fix)
bug_class: Bohrbug (deterministic layout arithmetic, reproduces every time)

reasoning_checkpoint:
  hypothesis: "Error text overflows the 165px card because the card has only 3-4px of spare height after its existing content, and the label overlaps because sticky bottom:0 activates only once the card overflows."
  confirming_evidence:
    - "Replica sum: 12 padding + 40 header + 8 gap + 64 image + 8 gap + 63 error + 8 gap + 27 label = 230 = the UAT-measured scrollHeight; clientHeight 163 = UAT value."
    - "Replica without error: scrollHeight 163 = clientHeight (no overflow), matching the UAT 'non-error cards 163-165, no overflow'."
    - "Sticky label measured at card y 131-158 at scrollTop 0 while its flow slot is 198-225; error text spans 127-190 -> overlap; overlap persists at scrollTop 20/40 and disappears at 60/67."
  falsification_test: "If the label were not sticky (position static) the overlap would still occur => hypothesis wrong. Observed: with position static the label sits at 198-225 (no overlap) but scrollHeight stays 230, so overflow remains and is independent of sticky."
  fix_rationale: "Fit is the requirement (UAT truth). Reducing content to <= 151px makes sticky inert again and fixes both symptoms; unsticking alone would leave the card scrolling."
  blind_spots: "Replica used empty SVG icons and a DOM copy of the Chakra Text rather than the rendered React component; the live queue was empty so no real FAILED card could be rendered without mutating state. Numbers match the UAT measurement exactly, which bounds this risk."
  candidate_causes:
    - "code: fixed 165px card + unconditional stacking of image, error, label (layout arithmetic) - CONFIRMED"
    - "data: error message length - ELIMINATED, a 1-line error also overflows (scrollHeight 188 vs 163)"
    - "environment: browser/scrollbar/font differences - ELIMINATED as primary, only changes text width (271px with classic scrollbar), not the vertical budget"
  and_gate: "yes, two conditions: (1) content over budget makes the card scroll, (2) sticky label has no reserved space so it overlays content once the card scrolls. Fixing (1) neutralises (2); fixing only (2) leaves the failure to fit."

## Symptoms

expected: A FAILED step card shows its tool error (clamped to 3 lines, full text on hover), keeps it after banner dismiss and galago-web restart; skipped-after-failure reads "Skipped after failure: ..."; plain Skip shows no error text; the text fits inside the 165px card.
actual: Everything works except the fit. Card (~300px wide) height 165 / clientHeight 163, overflowY auto, content scrollHeight 230. At scrollTop 0 the sticky-bottom "Run script" label is painted over the first line of the error text (FAILED and SKIPPED-with-error cards). Non-error cards 163-165px, no overflow.
errors: none
reproduction: UAT Test 3 (any FAILED or skipped-after-failure card)
started: introduced with 03-06 (commit aef01ae), found in UAT 2026-10-29

## Eliminated

- hypothesis: Overflow depends on the error message length
  evidence: 1-line error (21px) still gives scrollHeight 188 > clientHeight 163; headroom is only 4px
  timestamp: 2026-10-29T04:20:00Z
- hypothesis: The overlap is caused by the sticky label's ordering relative to the error text
  evidence: Label is the last flow child, yet is painted 67px above its flow slot. With position static the label returns to y 198-225 and does not overlap; ordering is not the cause, sticky activation on overflow is.
  timestamp: 2026-10-29T04:22:00Z

## Evidence

- timestamp: 2026-10-29T04:05:00Z
  checked: SwimLaneCommandComponent.tsx lines 83-182, CommandImage.tsx
  found: Card Box height 165px, padding 6px, border 1px, overflowY auto, fontSize 18px. Outer VStack (gap 8px): header Box, then Center > VStack spacing 2 (gap 8px) with CommandImage, optional error Text, sticky label Box.
  implication: Everything is stacked vertically with 8px gaps; the card has a fixed height and scrolls.
- timestamp: 2026-10-29T04:10:00Z
  checked: Headless Chrome replica, live /runs page CSS (body line-height 24px = 1.5), Tool Box icon branch
  found: hdr 40 (IconButton md h=10 = 40px beats the 27px 18px bold name), img 64 (py 3 = 24 + 40px icon IconButton; the 50px lucide icon overflows it), error 63 (3 x 21px, 14px x 1.5), label 27 (18px x 1.5). Gaps 3 x 8 = 24. Padding 12. Sum 230. Without the error: content 147 (40+8+64+8+27) + 12 padding = 159 <= clientHeight 163, spare 4px, scrollHeight reported 163 (no overflow). Non-toolbox 65px <Image> branch: 231 with error, 163 without (spare 3px).
  implication: Content box is 163 - 12 = 151px; non-error content 147-148px; error block costs 71px (8 gap + 63) -> ~67px overflow = 230 - 163. The UI-SPEC claim "three clamped lines plus the command image fit inside the fixed 165px card" (backstop, never measured; UI-REVIEW item 3 flagged it) is arithmetically false.
- timestamp: 2026-10-29T04:15:00Z
  checked: sticky label position by scrollTop (replica with 3-line error)
  found: Label top/bottom in card coordinates is 131/158 at scrollTop 0, 20, 40, 60, 67 (always pinned); error text spans 127-190 at scrollTop 0 (-> overlap true), 107-170 at 20 (true), 87-150 at 40 (true), 67-130 at 60 (false), 60-123 at 67 (false). Natural flow slot of the label: 198-225.
  implication: bottom:0 pins the label to the bottom of the scroll container's content box (clientHeight 163 + 1 border - 6 padding = 158). Sticky does not reserve space, and positioned elements paint above non-positioned in-flow content, with no background on the label box, so it is drawn over error lines 1-2 until the user scrolls ~60px. Before this phase the label's natural bottom (154) was above the pin line (158), so sticky was inert.
- timestamp: 2026-10-29T04:18:00Z
  checked: screenshot /tmp/claude-1000/-home-formulatrix-data-nikko-galago-core/09dc8a4b-2b0c-4644-af02-d03e7d7c31d3/scratchpad/cdp/replica-error-scrolltop0.png
  found: "Run script" drawn across the first error line, scrollbar visible, second error line cut off at the card bottom.
  implication: matches the UAT description.
- timestamp: 2026-10-29T04:25:00Z
  checked: layout variants in the replica (design experiments only; no source edited)
  found: Current stack layout: 1-line error 188, 3-line error 230 (both overflow 163). Side-by-side row (image left, error Text right, same row, then label): no error 163, 1-line 163, 3-line 163 at 300px (error width 228px) and at 250px (178px) - no overflow, label stays inert.
  implication: A row reflow absorbs the error inside the image's 64px row height (63px of clamped text fits) and keeps every UI-SPEC constraint.
- timestamp: 2026-10-29T04:28:00Z
  checked: controller/test/staticScan.test.ts lines 449-516, card-related scans
  found: card scans only require stepErrorText(command), noOfLines={3}, whiteSpace="normal", title={errorText}, exactly one <CheckCircle with `command.status === "COMPLETED" && <CheckCircle`, and no dangerouslySetInnerHTML in the file.
  implication: layout reflow (row/HStack, image sizing, sticky/position changes) does not conflict with any existing scan.

## Resolution

root_cause: |
  Two conditions combine (AND-gate):
  1. Over-budget content. The card is a fixed 165px box (content box 151px after 1px border + 6px padding) that was already filled by header 40 + image 64 (65) + label 27 + two 8px gaps = 147-148px, leaving 3-4px. 03-06 inserted the error Text as one more vertical-stack child, adding an 8px gap plus up to 63px (3 x 21px) = 71px, so content is 218px (scrollHeight 230) and the card must scroll internally by 67px. Even a 1-line error overflows (scrollHeight 188).
  2. Sticky label without reserved space. The label Box is position: sticky; bottom: 0 inside the overflowY auto card. When the card did not overflow it was inert. Once it overflows, sticky pins the label to the bottom of the card's content box (card y 131-158) while its flow slot is y 198-225, and a positioned, background-less element paints on top of the in-flow error text (y 127-190), covering line 1 and part of line 2 until scrollTop >= ~60.
  The 03-06 placement decision (error between image and sticky label so it "scrolls with the card") assumed the label stayed at the bottom and the text scrolled under it; it missed that at scrollTop 0 the pinned label already sits over whatever is at y 131-158. The UI-SPEC overflow statement was marked backstop/unverified and is wrong by ~67px.
fix: (not applied - find_root_cause_only)
verification: (not applied)
files_changed: []
