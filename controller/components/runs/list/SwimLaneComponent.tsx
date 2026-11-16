import {
  Box,
  HStack,
  useDisclosure,
  Center,
  VStack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { GitMerge } from "lucide-react";
import SwimLaneCommandComponent from "./SwimLaneCommandComponent";
import { RunCommand } from "@/types";
import React, { useState } from "react";
import { CommandDetailsDrawer } from "@/components/protocols/CommandDetailsDrawer"; // Import the CommandDetailsDrawer component
import { groupRowsByLane } from "../utils";
import {
  laneCardCaption,
  laneDoneText,
  LANE_ROW_ALL_DONE,
  LANE_BARRIER_CAPTION,
} from "../laneStatus";

interface SwimLaneProps {
  runCommands: RunCommand[];
  showAllCommands: boolean;
}

export const SwimLaneComponent: React.FC<SwimLaneProps> = ({ runCommands, showAllCommands }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedCommand, setSelectedCommand] = useState<RunCommand | null>(null);
  const labelBg = useColorModeValue("gray.50", "surface.panel");
  const mutedColor = useColorModeValue("gray.600", "whiteAlpha.700");

  const displayedCommands = showAllCommands
    ? runCommands
    : runCommands.filter((cmd) => cmd.status !== "COMPLETED");

  // D-21: one row per lane only when some step is on a non-primary lane;
  // otherwise the legacy flat DOM below is rendered unchanged.
  const laneGroups = groupRowsByLane(runCommands);
  const laneRows = laneGroups
    ? laneGroups.map((group) => ({
        lane: group.lane,
        all: group.rows,
        shown: showAllCommands
          ? group.rows
          : group.rows.filter((cmd) => cmd.status !== "COMPLETED"),
      }))
    : null;
  const anyLaneRowShown = laneRows ? laneRows.some((g) => g.shown.length > 0) : false;

  const handleSave = (_updatedCommand: any) => {
    // Will be implemented later when save functionality is needed
  };

  if (laneRows !== null) {
    return (
      <>
        {anyLaneRowShown ? (
          <Box width="100%" overflowX="auto" whiteSpace="nowrap" p={2}>
            <CommandDetailsDrawer
              isOpen={isOpen}
              onClose={onClose}
              selectedCommand={selectedCommand}
              onSave={handleSave}
              isEditing={false} // Set to false to disable editing
            />

            <VStack align="stretch" spacing={2}>
              {laneRows.map((group) => (
                <HStack
                  key={group.lane}
                  role="group"
                  aria-label={`Lane ${group.lane}`}
                  align="flex-start"
                  spacing={0}
                  width="max-content">
                  <Box
                    width="120px"
                    flexShrink={0}
                    position="sticky"
                    left={0}
                    zIndex={1}
                    bg={labelBg}
                    borderRadius="md"
                    p={2}
                    mr={4}>
                    <Text fontSize="sm" fontWeight="bold" whiteSpace="normal" wordBreak="break-all">
                      {group.lane}
                    </Text>
                    <Text fontSize="xs" color={mutedColor}>
                      {laneDoneText(group.all)}
                    </Text>
                  </Box>
                  {group.shown.length > 0 ? (
                    group.shown.map((command, i) => (
                      <Box key={i} flexShrink={0}>
                        <SwimLaneCommandComponent
                          command={command}
                          onCommandClick={(command) => {
                            setSelectedCommand(command);
                            onOpen();
                          }}
                        />
                        <VStack
                          align="flex-start"
                          spacing={0}
                          mt={1}
                          maxW="300px"
                          whiteSpace="normal"
                          fontSize="xs"
                          color={mutedColor}>
                          {laneCardCaption(command).map((line) =>
                            line === LANE_BARRIER_CAPTION ? (
                              <HStack key={line} spacing={1}>
                                <GitMerge aria-hidden size={12} />
                                <Text>{line}</Text>
                              </HStack>
                            ) : (
                              <Text key={line}>{line}</Text>
                            ),
                          )}
                        </VStack>
                      </Box>
                    ))
                  ) : (
                    <Text fontSize="xs" color={mutedColor} whiteSpace="normal" alignSelf="center">
                      {LANE_ROW_ALL_DONE}
                    </Text>
                  )}
                </HStack>
              ))}
            </VStack>
          </Box>
        ) : (
          <Center height="50px"> No pending commands to display ...</Center>
        )}
      </>
    );
  }

  return (
    <>
      {displayedCommands.length > 0 ? (
        <Box width="100%" overflowX="auto" whiteSpace="nowrap" p={2}>
          {/* Use the imported CommandDetailsDrawer component */}
          <CommandDetailsDrawer
            isOpen={isOpen}
            onClose={onClose}
            selectedCommand={selectedCommand}
            onSave={handleSave}
            isEditing={false} // Set to false to disable editing
          />

          <HStack spacing={0} width="900px">
            {displayedCommands.map((command, i) => {
              return (
                <SwimLaneCommandComponent
                  key={i}
                  command={command}
                  onCommandClick={(command) => {
                    setSelectedCommand(command);
                    onOpen();
                  }}
                />
              );
            })}
          </HStack>
        </Box>
      ) : (
        <Center height="50px"> No pending commands to display ...</Center>
      )}
    </>
  );
};
