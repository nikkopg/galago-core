import React, { useState } from "react";
import {
  Spinner,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Text,
  VStack,
  useDisclosure,
  ButtonGroup,
  Icon,
} from "@chakra-ui/react";
import { trpc } from "@/utils/trpc";
import { warningToast } from "@/components/ui/Toast";
import { ToolStatus } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import {
  Play, // replaces FaPlay
  Pause, // replaces FaPause
  Trash2, // replaces FaTrash
} from "lucide-react";
import { shouldInterceptQueueStop, buildStopRequest } from "../stopInterception";
import type { InstrumentStopRequest } from "../stopInterception";
import { InstrumentStopModal } from "../InstrumentStopModal";
import type { RunStateEnvelope } from "@/server/runState";
import { queuedStartLines } from "../queuedStartSummary";
import { useLaneStatus } from "@/hooks/useLaneStatus";

interface QueueStatusComponent {
  totalRuns: number;
  runControlState?: RunStateEnvelope;
}

export const QueueStatusComponent: React.FC<QueueStatusComponent> = ({
  totalRuns,
  runControlState,
}) => {
  const stateQuery = trpc.commandQueue.state.useQuery(undefined, { refetchInterval: 1000 });
  const commandsQuery = trpc.commandQueue.getAll.useQuery(undefined, { refetchInterval: 1000 });
  // D-06 (recorded deviation): the Start summary counts queue-joined rows from
  // `commands`, not `getAll`, so a dequeued FAILED row is never promised as a
  // retry. Deliberately not part of the spinner condition below.
  const queuedCommandsQuery = trpc.commandQueue.commands.useQuery({}, { refetchInterval: 1000 });
  // D-20: the Start summary names the lane freeze only when lanes are frozen by
  // a failure or an operator freeze (a prompt halt clears itself).
  const laneStatusQuery = useLaneStatus();
  // Only a successful read counts: a failed re-read never shows a stale lane caption
  // (review WR-03, security note T-08-32).
  const laneStatusData = laneStatusQuery.isSuccess ? laneStatusQuery.data : undefined;
  const laneMode = laneStatusData?.laneMode === true;
  const laneFrozen = Boolean(
    laneStatusData &&
      laneMode &&
      laneStatusData.hasLaneRows &&
      (laneStatusData.haltReason === "failure" || laneStatusData.haltReason === "freeze"),
  );
  const stateMutationOpts = {
    onSettled: () => {
      stateQuery.refetch();
      getError.refetch();
      commandsQuery.refetch();
    },
  };
  const queue = trpc.commandQueue;
  // WR-01: an ignored Start (the queue is still finishing its previous step)
  // would otherwise look like success; say so instead of only logging it.
  const restartMutation = queue.restart.useMutation({
    ...stateMutationOpts,
    onSuccess: (result) => {
      if (result && !result.accepted) {
        warningToast(
          "Start ignored",
          "The queue is still busy (finishing a step or waiting on a prompt), so nothing was started. Press Start again once it has stopped.",
        );
      }
    },
  });
  const stopMutation = queue.stop.useMutation(stateMutationOpts);
  const clearAllMutation = queue.clearAll.useMutation(stateMutationOpts);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const getError = queue.getError.useQuery(undefined, { refetchInterval: 1500 });
  const [stopRequest, setStopRequest] = useState<InstrumentStopRequest | null>(null);

  const run = async () => {
    restartMutation.mutate();
  };

  // D-16: a running controllable step opens the Stop modal instead of
  // calling stop directly; otherwise behaves exactly as today.
  const pause = async () => {
    if (shouldInterceptQueueStop(runControlState)) {
      setStopRequest(buildStopRequest(runControlState, () => stopMutation.mutateAsync()));
      return;
    }
    stopMutation.mutate();
  };

  // D-19: a running controllable step opens the same Stop modal before
  // Clear All runs; otherwise behaves exactly as today (no confirmation,
  // unchanged scope).
  const clear = async () => {
    if (shouldInterceptQueueStop(runControlState)) {
      setStopRequest(buildStopRequest(runControlState, () => clearAllMutation.mutateAsync()));
      return;
    }
    clearAllMutation.mutate();
  };

  const handleConfirmStart = () => {
    run();
    onClose();
  };

  const confirmRunStartModal = () => {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Warning</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Make sure instruments are not unintentionally in simulation mode.</Text>
            <VStack align="stretch" spacing={2} mt={4}>
              {queuedStartLines({
                rows: queuedCommandsQuery.data,
                isError: queuedCommandsQuery.isError,
                laneFrozen,
                laneMode,
              }).map((line, index) => (
                <Text
                  key={`${line.text}-${index}`}
                  {...(line.tone === "caption" ? { fontSize: "sm", color: "gray.500" } : {})}>
                  {line.text}
                </Text>
              ))}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="teal" mr={3} onClick={handleConfirmStart}>
              Accept
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  };

  if (stateQuery.isLoading || commandsQuery.isLoading) return <Spinner />;

  const isRunning = stateQuery.data === ToolStatus.BUSY;

  // Check if there are any commands (including completed ones) to clear
  const hasCommandsToClear = commandsQuery.data && commandsQuery.data.length > 0;

  return (
    <>
      {confirmRunStartModal()}
      {/* WR-02 (accepted): independent from RunsComponent's `runStopRequest`
          state — see the matching comment there. No action is ever sent
          without confirmation; the stale modal self-closes via
          confirmStillValid once an accepted action moves the step on. */}
      <InstrumentStopModal
        request={stopRequest}
        envelope={runControlState}
        onClose={() => setStopRequest(null)}
      />
      <ButtonGroup spacing={2}>
        {isRunning ? (
          <Button
            leftIcon={<Icon as={Pause} size={14} />}
            colorScheme="orange"
            variant="solid"
            onClick={() => pause()}>
            Pause queue
          </Button>
        ) : (
          <Button
            leftIcon={<Icon as={Play} size={14} />}
            colorScheme="green"
            variant="solid"
            onClick={() => onOpen()}
            isDisabled={totalRuns === 0}>
            Start
          </Button>
        )}
        <Button
          leftIcon={<Icon as={Trash2} size={14} />}
          colorScheme="red"
          variant="outline"
          onClick={() => clear()}
          isDisabled={!hasCommandsToClear}
          title={
            hasCommandsToClear ? "Clear all runs including completed ones" : "No runs to clear"
          }>
          Clear All
        </Button>
      </ButtonGroup>
    </>
  );
};
