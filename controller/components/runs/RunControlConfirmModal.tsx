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
  headMovesNote,
} from "./controlDecision";
import type {
  ControlTarget,
  DecisionValues,
  ConfirmedControlRequest,
  ConfirmedSendOutcome,
} from "./controlDecision";
import { useConfirmedControlSend } from "@/hooks/useRunControl";
import { persistentErrorToast } from "@/components/ui/Toast";

// WR-07: the instrument genuinely accepted the abort here, but the
// queue-side follow-up mutation then failed, so the queue's own bookkeeping
// (runningStep, queue state) was never updated to match. Never retried or
// re-sent automatically (the operator's prior confirmation does not cover a
// second, unconfirmed send) — this only makes the resulting desync hard to
// miss and tells the operator what to do about it. A plain "Follow-up
// failed" toast that the operator can dismiss and forget would leave the
// queue silently showing a step as running that the instrument has already
// aborted.
function followUpFailureToast(message: string | undefined): void {
  persistentErrorToast(
    "Instrument aborted, but the queue did not update",
    `The instrument accepted the abort, but recording it in the queue failed${
      message ? ` (${message})` : ""
    }. This step may still show as running here even though the instrument has stopped — verify the instrument directly and do not rely on this page's status for it until resolved. This was not retried automatically.`,
  );
}

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

  // WR-03: `toolType:action` alone does not disambiguate request *instances*
  // — if a caller ever replaces one non-null request directly with a
  // different non-null request of the same toolType/action (e.g. two
  // buttons that both resolve to {toolType:"fast", action:"abort"}, fired
  // back-to-back before the first modal's overlay blocks further clicks),
  // React would not remount the body and stale `values` from the replaced
  // request could leak into the new confirmation (breaking D-07: decision
  // state must always be born empty). Bump a counter whenever the `request`
  // *reference* changes while non-null, independent of any caller
  // cooperation, and fold it into the remount key below.
  const idRef = useRef(0);
  const prevRequestRef = useRef<RunControlConfirmModalRequest | null>(null);
  if (request !== prevRequestRef.current) {
    prevRequestRef.current = request;
    if (request !== null) {
      idRef.current += 1;
    }
  }

  if (request === null) {
    // Nothing is rendered while closed — the body below is mounted fresh
    // on every open, so its decision state is always born empty (D-07).
    return null;
  }
  return (
    <RunControlConfirmModalBody
      key={`${idRef.current}:${request.toolType}:${request.action}`}
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
  const headNote = headMovesNote(request.toolType, request.action);
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
        followUpFailureToast(result.followUpMessage);
      }
      return;
    }

    onPendingChange?.(true);
    const result = await runAfterAccepted(dispatchSend, afterAccepted);
    onPendingChange?.(false);

    if (result.followUp === "failed") {
      followUpFailureToast(result.followUpMessage);
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
                {headNote !== null ? <Text>{headNote}</Text> : null}
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
