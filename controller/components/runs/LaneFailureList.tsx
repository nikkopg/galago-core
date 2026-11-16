import React from "react";
import { Badge, Box, HStack, Text, VStack, useColorModeValue } from "@chakra-ui/react";
import type { LaneFailureEntry } from "@/server/laneScheduling";
import { describeLaneFailures } from "./laneStatus";

interface LaneFailureListProps {
  failures: ReadonlyArray<LaneFailureEntry>;
  overflow: number;
}

// UI-SPEC S6 (D-16, LUI-06): rendered inside the error banner, below the first
// failure's own message, only when two or more lanes have failed. Messages are
// React text only, wrapped, never truncated; the box scrolls on its own.
export const LaneFailureList: React.FC<LaneFailureListProps> = ({ failures, overflow }) => {
  const mutedColor = useColorModeValue("gray.600", "whiteAlpha.700");
  const view = describeLaneFailures(failures, overflow);
  if (view === null) return null;

  return (
    <Box mt={2} maxH="160px" overflowY="auto">
      <VStack align="stretch" spacing={2}>
        <Text fontSize="sm" fontWeight="bold">
          {view.heading}
        </Text>
        {view.entries.map((entry, index) => (
          <Box key={`${entry.lane}-${index}`}>
            <HStack spacing={2} fontSize="xs" flexWrap="wrap">
              <Badge colorScheme="gray" variant="subtle" textTransform="none">
                {entry.lane}
              </Badge>
              <Text as="span">{entry.meta}</Text>
              {entry.note !== null && (
                <Text as="span" color={mutedColor}>
                  {entry.note}
                </Text>
              )}
            </HStack>
            {entry.message !== null && entry.message !== "" && (
              <Text fontSize="sm" whiteSpace="pre-wrap" wordBreak="break-word" userSelect="text">
                {entry.message}
              </Text>
            )}
          </Box>
        ))}
        {view.overflowLine !== null && (
          <Text fontSize="xs" color={mutedColor}>
            {view.overflowLine}
          </Text>
        )}
      </VStack>
    </Box>
  );
};
