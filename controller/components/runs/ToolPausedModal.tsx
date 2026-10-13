import React, { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  Icon,
  VStack,
  Box,
  Collapse,
  Alert,
  AlertIcon,
  useColorModeValue,
} from "@chakra-ui/react";
import { TriangleAlert, Play, StopCircle } from "lucide-react";
import type { PauseState } from "@/server/runState";
import { toolDisplayName } from "./controlDecision";
import { describePauseDetail, formatPauseReason, formatPauseStartedAt } from "./pausePrompt";

export interface ToolPausedModalProps {
  isOpen: boolean;
  pause: PauseState | null;
  toolType: string;
  unknownWarning: string | null;
  lastError?: string;
  onHide: () => void;
  onResume: () => void;
  onAbort: () => void;
}

// D-10: this prompt is mounted independent of the queue's own UIMessage
// bookkeeping. It never calls a queue mutation itself — Resume/Abort only
// ever open the shared RunControlConfirmModal (D-15).
export const ToolPausedModal: React.FC<ToolPausedModalProps> = ({
  isOpen,
  pause,
  toolType,
  unknownWarning,
  lastError,
  onHide,
  onResume,
  onAbort,
}) => {
  const [showRaw, setShowRaw] = useState(false);
  const bgColor = useColorModeValue("white", "surface.section");
  const iconColor = useColorModeValue("orange.500", "orange.300");

  const reason = formatPauseReason(pause);
  const { lines, raw } = describePauseDetail(pause?.detail ?? null);
  const startedAtText = formatPauseStartedAt(pause?.startedAt ?? null, Date.now());

  return (
    <Modal isOpen={isOpen} onClose={onHide} isCentered>
      <ModalOverlay />
      <ModalContent bg={bgColor} maxW="md">
        <ModalHeader fontWeight="bold">{toolDisplayName(toolType)} paused</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <VStack spacing={2}>
              <Icon as={TriangleAlert} boxSize={12} color={iconColor} />
              <Text fontSize="xl" fontWeight="bold" textAlign="center">
                {reason ?? "The instrument did not report a reason."}
              </Text>
            </VStack>
            {lines.map((line, index) => (
              <Text key={index} fontSize="sm">
                {line}
              </Text>
            ))}
            {raw !== null ? (
              <Box>
                <Button variant="link" size="sm" onClick={() => setShowRaw((prev) => !prev)}>
                  Raw detail
                </Button>
                <Collapse in={showRaw}>
                  <Box as="pre" whiteSpace="pre-wrap" wordBreak="break-word" fontSize="sm">
                    {raw}
                  </Box>
                </Collapse>
              </Box>
            ) : null}
            {startedAtText !== null ? <Text fontSize="sm">Paused at {startedAtText}</Text> : null}
            {unknownWarning !== null ? (
              <Alert status="warning">
                <AlertIcon />
                <VStack align="start" spacing={0}>
                  <Text>{unknownWarning}</Text>
                  {lastError ? (
                    <Text fontSize="sm" wordBreak="break-word">
                      {lastError}
                    </Text>
                  ) : null}
                </VStack>
              </Alert>
            ) : null}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onHide}>
            Hide
          </Button>
          <Button colorScheme="teal" leftIcon={<Icon as={Play} />} mr={3} onClick={onResume}>
            Resume
          </Button>
          <Button colorScheme="red" leftIcon={<Icon as={StopCircle} />} onClick={onAbort}>
            Abort
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
