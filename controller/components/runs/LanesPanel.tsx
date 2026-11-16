import React, { useRef } from "react";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  HStack,
  Tag,
  TagLabel,
  Text,
  Tooltip,
  VStack,
  Wrap,
  WrapItem,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { Snowflake } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { infoToast, errorToast } from "@/components/ui/Toast";
import { useLaneStatus } from "@/hooks/useLaneStatus";
import {
  FREEZE_CONFIRM_COPY,
  FREEZE_TOAST_COPY,
  freezeDisabledReason,
  freezeFailedDescription,
  laneHaltSentence,
  runningLaneChips,
  shouldShowLanesPanel,
} from "./laneStatus";

// UI-SPEC S5: the Freeze lanes control, the "Lanes frozen" state and the lanes
// running now. It renders nothing unless lane mode is on and the run has lane
// rows, and nothing while the status read is loading or has failed. State comes
// from the poll only; the only request it sends is the confirmed freeze.
export const LanesPanel: React.FC = () => {
  const status = useLaneStatus();
  const freeze = trpc.commandQueue.freezeLanes.useMutation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const keepRunningRef = useRef<HTMLButtonElement>(null);
  const cardBg = useColorModeValue("white", "surface.section");
  const mutedColor = useColorModeValue("gray.600", "whiteAlpha.700");

  const data = status.data;
  if (!status.isSuccess || !data || !shouldShowLanesPanel(data)) return null;

  const disabledReason = freezeDisabledReason(data);
  const chips = runningLaneChips(data.runningLanes);

  const handleConfirm = () => {
    onClose();
    freeze.mutate(undefined, {
      onSuccess: () => infoToast(FREEZE_TOAST_COPY.title, FREEZE_TOAST_COPY.description),
      onError: (e) => errorToast("Freeze failed", freezeFailedDescription(e.message)),
    });
  };

  return (
    <Card bg={cardBg} shadow="md">
      <CardBody>
        <VStack align="stretch" spacing={2}>
          <HStack justify="space-between" flexWrap="wrap">
            <Text fontSize="sm" fontWeight="bold">
              Lanes
            </Text>
            <Tooltip label={disabledReason ?? ""} isDisabled={disabledReason === null}>
              <Box display="inline-block">
                <Button
                  variant="outline"
                  colorScheme="teal"
                  leftIcon={<Snowflake aria-hidden size={16} />}
                  aria-label="Freeze lanes"
                  isDisabled={disabledReason !== null || freeze.isLoading}
                  isLoading={freeze.isLoading}
                  onClick={onOpen}>
                  Freeze lanes
                </Button>
              </Box>
            </Tooltip>
          </HStack>

          {disabledReason !== null && (
            <Text fontSize="sm" color={mutedColor} aria-live="polite">
              {disabledReason}
            </Text>
          )}

          {data.halted && data.haltReason !== null && (
            <Box role="status" aria-live="polite">
              <VStack align="flex-start" spacing={2}>
                <Badge colorScheme="orange" textTransform="none">
                  <HStack spacing={1}>
                    <Snowflake aria-hidden size={12} />
                    <span>Lanes frozen</span>
                  </HStack>
                </Badge>
                <Text fontSize="md">{laneHaltSentence(data.haltReason)}</Text>
              </VStack>
            </Box>
          )}

          {chips.length > 0 ? (
            <HStack align="flex-start" spacing={2}>
              <Text fontSize="xs" color={mutedColor}>
                Running now:
              </Text>
              <Wrap spacing={2}>
                {chips.map((chip, index) => (
                  <WrapItem key={`${chip}-${index}`}>
                    <Tag size="sm">
                      <TagLabel>{chip}</TagLabel>
                    </Tag>
                  </WrapItem>
                ))}
              </Wrap>
            </HStack>
          ) : (
            <Text fontSize="sm" color={mutedColor}>
              No lane step is running.
            </Text>
          )}
        </VStack>

        <AlertDialog
          isOpen={isOpen}
          leastDestructiveRef={keepRunningRef}
          onClose={onClose}
          isCentered>
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                {FREEZE_CONFIRM_COPY.header}
              </AlertDialogHeader>
              <AlertDialogBody>{FREEZE_CONFIRM_COPY.body}</AlertDialogBody>
              <AlertDialogFooter>
                <Button ref={keepRunningRef} onClick={onClose}>
                  {FREEZE_CONFIRM_COPY.dismiss}
                </Button>
                <Button colorScheme="teal" ml={3} onClick={handleConfirm}>
                  {FREEZE_CONFIRM_COPY.confirm}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </CardBody>
    </Card>
  );
};
