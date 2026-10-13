import React, { useRef, useState } from "react";
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
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  getActionSpec,
  emptyDecisions,
  allDecisionsChosen,
  completeDecisions,
  confirmHeader,
  restateChoice,
  HEAD_MOVES_NOTE,
} from "./controlDecision";
import type { ControlTarget, DecisionValues } from "./controlDecision";
import { useConfirmedControlSend } from "@/hooks/useRunControl";

export interface RunControlConfirmModalRequest {
  target: ControlTarget;
  toolType: string;
  action: string;
}

export interface RunControlConfirmModalProps {
  request: RunControlConfirmModalRequest | null;
  onClose: () => void;
}

// Shared confirmation modal with non-defaulted yes/no decisions (D-06, D-07).
// Every live control entry point (control bar, tool_paused prompt, Stop
// flow, tool page) renders one of these — never its own ad hoc confirm.
export const RunControlConfirmModal: React.FC<RunControlConfirmModalProps> = ({
  request,
  onClose,
}) => {
  if (request === null) {
    // Nothing is rendered while closed — the body below is mounted fresh
    // on every open, so its decision state is always born empty (D-07).
    return null;
  }
  return (
    <RunControlConfirmModalBody
      key={`${request.toolType}:${request.action}`}
      request={request}
      onClose={onClose}
    />
  );
};

const RunControlConfirmModalBody: React.FC<{
  request: RunControlConfirmModalRequest;
  onClose: () => void;
}> = ({ request, onClose }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const bgColor = useColorModeValue("white", "surface.section");
  const spec = getActionSpec(request.toolType, request.action);
  const [values] = useState<DecisionValues>(() => (spec ? emptyDecisions(spec) : {}));
  const { send, isSending } = useConfirmedControlSend();

  const canConfirm = spec !== undefined && allDecisionsChosen(spec, values);
  const confirmColorScheme = request.action === "abort" ? "red" : "teal";

  const handleConfirm = async () => {
    if (!spec) {
      return;
    }
    const completed = completeDecisions(spec, values);
    if (completed === null) {
      return;
    }

    const outcome = await send({
      target: request.target,
      toolType: request.toolType,
      action: request.action,
      decisions: completed,
    });

    if (outcome.status !== "ignored") {
      onClose();
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      isCentered
      initialFocusRef={cancelRef}
      closeOnEsc={!isSending}
      closeOnOverlayClick={!isSending}>
      <ModalOverlay />
      <ModalContent bg={bgColor}>
        <ModalHeader fontWeight="bold">{confirmHeader(request.action)}</ModalHeader>
        {!isSending ? <ModalCloseButton /> : null}
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {spec === undefined ? (
              <Text>This action is not available for this tool.</Text>
            ) : (
              <>
                <Text>{restateChoice(request.toolType, request.action, values)}</Text>
                <Text>{HEAD_MOVES_NOTE}</Text>
              </>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button ref={cancelRef} variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme={confirmColorScheme}
            onClick={handleConfirm}
            isLoading={isSending}
            isDisabled={spec === undefined || !canConfirm}>
            Confirm
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
