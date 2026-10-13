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
  RadioGroup,
  Radio,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  getActionSpec,
  emptyDecisions,
  allDecisionsChosen,
  completeDecisions,
  confirmHeader,
  restateChoice,
  decisionLabel,
  runAfterAccepted,
  HEAD_MOVES_NOTE,
} from "./controlDecision";
import type {
  ControlTarget,
  DecisionValues,
  ConfirmedControlRequest,
  ConfirmedSendOutcome,
} from "./controlDecision";
import { useConfirmedControlSend } from "@/hooks/useRunControl";
import { persistentErrorToast } from "@/components/ui/Toast";

export interface RunControlConfirmModalRequest {
  target: ControlTarget;
  toolType: string;
  action: string;
}

export interface RunControlConfirmModalCopy {
  header?: string;
  confirmLabel?: string;
  body?: (values: DecisionValues) => string;
}

export interface RunControlConfirmModalProps {
  request: RunControlConfirmModalRequest | null;
  onClose: () => void;
  copy?: RunControlConfirmModalCopy;
  afterAccepted?: () => Promise<unknown>;
  onPendingChange?: (pending: boolean) => void;
  // Plan 02-05: for recovery sends only. Once the operator confirms, close
  // the modal immediately rather than waiting for the (possibly long,
  // undeadlined — D-23) send to settle; the owning section shows its own
  // in-progress state instead.
  closeOnDispatch?: boolean;
}

// Shared confirmation modal with non-defaulted yes/no decisions (D-06, D-07).
// Every live control entry point (control bar, tool_paused prompt, Stop
// flow, tool page) renders one of these — never its own ad hoc confirm.
export const RunControlConfirmModal: React.FC<RunControlConfirmModalProps> = ({
  request,
  onClose,
  copy,
  afterAccepted,
  onPendingChange,
  closeOnDispatch,
}) => {
  // Owned here, not in the body below: a closeOnDispatch send unmounts the
  // body immediately, but the dispatched call and its pending callbacks
  // must keep running to completion — they need a hook instance that
  // outlives the body (D-23).
  const { send, isSending } = useConfirmedControlSend();

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
      copy={copy}
      afterAccepted={afterAccepted}
      onPendingChange={onPendingChange}
      closeOnDispatch={closeOnDispatch}
      send={send}
      isSending={isSending}
    />
  );
};

const RunControlConfirmModalBody: React.FC<{
  request: RunControlConfirmModalRequest;
  onClose: () => void;
  copy?: RunControlConfirmModalCopy;
  afterAccepted?: () => Promise<unknown>;
  onPendingChange?: (pending: boolean) => void;
  closeOnDispatch?: boolean;
  send: (request: ConfirmedControlRequest) => Promise<ConfirmedSendOutcome>;
  isSending: boolean;
}> = ({
  request,
  onClose,
  copy,
  afterAccepted,
  onPendingChange,
  closeOnDispatch,
  send,
  isSending,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const bgColor = useColorModeValue("white", "surface.section");
  const spec = getActionSpec(request.toolType, request.action);
  const [values, setValues] = useState<DecisionValues>(() => (spec ? emptyDecisions(spec) : {}));

  const decisionNames = spec ? Object.keys(spec) : [];
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

    const dispatchSend = () =>
      send({
        target: request.target,
        toolType: request.toolType,
        action: request.action,
        decisions: completed,
      });

    if (closeOnDispatch) {
      // The operator's confirmation was already given; close right away so
      // a long-blocking recovery call (D-23) does not hold the modal open
      // over the rest of the page. The result still arrives as the same
      // success/refusal toast (D-09).
      onPendingChange?.(true);
      onClose();
      const result = await runAfterAccepted(dispatchSend, afterAccepted);
      onPendingChange?.(false);

      if (result.followUp === "failed") {
        persistentErrorToast("Follow-up failed", result.followUpMessage ?? "");
      }
      return;
    }

    onPendingChange?.(true);
    const result = await runAfterAccepted(dispatchSend, afterAccepted);
    onPendingChange?.(false);

    if (result.followUp === "failed") {
      persistentErrorToast("Follow-up failed", result.followUpMessage ?? "");
    }

    if (result.outcome.status !== "ignored") {
      onClose();
    }
  };

  const bodyText = copy?.body?.(values) ?? restateChoice(request.toolType, request.action, values);

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
        <ModalHeader fontWeight="bold">{copy?.header ?? confirmHeader(request.action)}</ModalHeader>
        {!isSending ? <ModalCloseButton /> : null}
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {spec === undefined ? (
              <Text>This action is not available for this tool.</Text>
            ) : (
              <>
                <Text>{bodyText}</Text>
                <Text>{HEAD_MOVES_NOTE}</Text>
                {decisionNames.map((name) => (
                  <VStack key={name} align="stretch" spacing={2}>
                    <Text fontSize="sm">{decisionLabel(name)}</Text>
                    <RadioGroup
                      value={values[name] ?? ""}
                      onChange={(value) =>
                        setValues((prev) => ({
                          ...prev,
                          [name]: value as DecisionValues[string],
                        }))
                      }>
                      <VStack spacing={2} align="start">
                        <Radio value="yes">Yes</Radio>
                        <Radio value="no">No</Radio>
                      </VStack>
                    </RadioGroup>
                  </VStack>
                ))}
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
            {copy?.confirmLabel ?? "Confirm"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
