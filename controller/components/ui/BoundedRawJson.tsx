// Shared bounded raw-JSON display (D-06, UI-SPEC AC-2): the ONE place a raw
// reply renders as a single JSON line inside a bounded collapsible panel.
// Extracted from components/tools/RunRecoverySection.tsx (the latch panel) so
// the Run Recovery card and the tool page's Reply meta_data panel render
// through the same component — never a second styled copy.
import { Button, Box, Collapse, Text } from "@chakra-ui/react";

// Bounded renderer backstop for an unknown reply shape (T-04-12): the raw
// object renders as a single JSON line that shows only inside the bounded
// panel below, never a loop or a list.
export function formatLatchRaw(raw: Record<string, unknown>): string {
  try {
    return JSON.stringify(raw);
  } catch {
    try {
      return String(raw);
    } catch {
      return "{}";
    }
  }
}

interface BoundedRawJsonProps {
  raw: Record<string, unknown>;
  isOpen: boolean;
  onToggle: () => void;
}

// The tool page centres content, so panels are sized by their content: the
// zero-width basis keeps a long raw line out of the parent's intrinsic
// width, min width 100% fills the parent's real width, and max height with
// internal scroll bounds the length (G-04-2, T-04-12). "0px" is written
// with a unit because a bare 0 goes through Chakra's fraction transform and
// becomes 0%, a cyclic percentage that would let the line count again.
// Display-only: no hooks, no state, no send path — the single-send-path and
// no-timers scans stay green for every consumer (D-06).
export function BoundedRawJson({ raw, isOpen, onToggle }: BoundedRawJsonProps) {
  return (
    <>
      <Button variant="link" size="sm" onClick={onToggle} aria-expanded={isOpen}>
        Raw JSON
      </Button>
      <Collapse in={isOpen}>
        <Box
          w="0px"
          minW="100%"
          maxH="160px"
          overflowY="auto"
          mt={2}
          p={2}
          bg="surface.panel"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="md">
          <Text fontFamily="mono" fontSize="sm" wordBreak="break-all" whiteSpace="pre-wrap">
            {formatLatchRaw(raw)}
          </Text>
        </Box>
      </Collapse>
    </>
  );
}
