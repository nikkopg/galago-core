// Crash-recovery UI for the tool page (D-21, D-22, D-23, UI-07). Always
// rendered for a runControl tool type, independent of any running step
// (Pitfall 10) — visibility is a function of the tool TYPE alone. Resume and
// Abort are disabled only while a run step is tracking THIS tool; otherwise
// they stay enabled, including when the run state is unknown or not yet
// loaded.
import React, { useState } from "react";
import {
  Card,
  CardBody,
  Heading,
  Text,
  ButtonGroup,
  Button,
  HStack,
  Input,
  Spinner,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import Link from "next/link";
import { Play, StopCircle } from "lucide-react";
import { useRunControlState } from "@/hooks/useRunControl";
import {
  shouldShowRecoverySection,
  isToolTrackedByRunningStep,
  needsGuidEntry,
} from "@/components/runs/controlDecision";
import { isValidRecoveryGuid } from "@/server/recoveryActions";
import {
  RunControlConfirmModal,
  type RunControlConfirmModalRequest,
} from "@/components/runs/RunControlConfirmModal";

export interface RunRecoverySectionProps {
  toolName: string;
  toolType: string;
}

type RecoveryUIAction = "resume" | "abort" | "acknowledge_failure";

export const RunRecoverySection: React.FC<RunRecoverySectionProps> = ({ toolName, toolType }) => {
  const bgColor = useColorModeValue("white", "surface.section");
  const runControlQuery = useRunControlState();
  const [request, setRequest] = useState<RunControlConfirmModalRequest | null>(null);
  const [pendingAction, setPendingAction] = useState<RecoveryUIAction | null>(null);
  // The guid the operator typed on the card (STACK acknowledge surface).
  // It starts blank and is sent exactly as typed — never trimmed, coerced or
  // pre-filled; it is also cleared back to blank ONLY by an accepted send
  // (D-07 via the modal's afterAccepted, D-08).
  const [guid, setGuid] = useState("");

  if (!shouldShowRecoverySection(toolType)) {
    return null;
  }

  // Guid entry exists only for tool types whose recovery spec declares a
  // guid-kind parameter (STACK's acknowledge today) — derived, not a
  // hard-coded tool type list (D-05).
  const showGuidField = needsGuidEntry(toolType);

  const tracked = isToolTrackedByRunningStep(runControlQuery.data, toolName);
  const disabled = tracked || pendingAction !== null;

  const openConfirm = (action: RecoveryUIAction) => {
    const base = { target: { kind: "recovery" as const, toolId: toolName }, toolType, action };
    setRequest(action === "acknowledge_failure" ? { ...base, params: { guid } } : base);
  };

  // Only the all-clear guide clears on an accepted send; resume/abort carry
  // nothing typed to clear (D-07 clear-on-accepted).
  const afterAccepted =
    request?.action === "acknowledge_failure"
      ? async () => {
          setGuid("");
        }
      : undefined;

  return (
    <Card bg={bgColor}>
      <CardBody p={6}>
        <Heading size="md" mb={2}>
          Run Recovery
        </Heading>
        <Text fontSize="sm" mb={4}>
          {toolType === "stack"
            ? "Read the failure latched on this tool, acknowledge it, or resume/abort an instrument run that no run step is tracking."
            : "Resume or abort an instrument run that no run step is tracking, for example after galago-web restarted."}
        </Text>
        <ButtonGroup spacing={4}>
          <Button
            colorScheme="teal"
            leftIcon={<Play size={16} />}
            isDisabled={disabled}
            onClick={() => openConfirm("resume")}>
            Resume
          </Button>
          <Button
            colorScheme="red"
            leftIcon={<StopCircle size={16} />}
            isDisabled={disabled}
            onClick={() => openConfirm("abort")}>
            Abort
          </Button>
        </ButtonGroup>
        {showGuidField && (
          <VStack align="stretch" spacing={2} mt={4}>
            <Text fontSize="sm">Failure guid</Text>
            <Input
              value={guid}
              onChange={(event) => setGuid(event.target.value)}
              maxLength={256}
              placeholder="Paste the guid from the failed step's error"
            />
            <Text fontSize="sm">
              Sent exactly as typed. Spaces and control characters are not allowed.
            </Text>
            {!isValidRecoveryGuid(guid) && (
              <Text fontSize="sm">
                A guid cannot be blank. Enter the guid shown in the failed step's error or via Read
                latch.
              </Text>
            )}
          </VStack>
        )}
        {showGuidField && (
          <Button
            mt={4}
            colorScheme="teal"
            isDisabled={!isValidRecoveryGuid(guid)}
            onClick={() => openConfirm("acknowledge_failure")}>
            Acknowledge failure…
          </Button>
        )}
        {tracked && (
          <Text fontSize="sm" mt={4}>
            A run step is tracking this tool; use the run page.{" "}
            <Link href="/runs">Open the run page</Link>
          </Text>
        )}
        {pendingAction !== null && (
          <HStack mt={4} spacing={2}>
            <Spinner size="sm" />
            <Text fontSize="sm">
              {pendingAction === "resume"
                ? "Resume in progress…"
                : pendingAction === "acknowledge_failure"
                  ? "Acknowledge in progress…"
                  : "Abort in progress…"}
            </Text>
          </HStack>
        )}
        <RunControlConfirmModal
          request={request}
          onClose={() => setRequest(null)}
          closeOnDispatch
          afterAccepted={afterAccepted}
          onPendingChange={
            request
              ? (isPending) =>
                  setPendingAction(isPending ? (request.action as RecoveryUIAction) : null)
              : undefined
          }
        />
      </CardBody>
    </Card>
  );
};
