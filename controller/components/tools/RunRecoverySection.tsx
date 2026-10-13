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
  Spinner,
  useColorModeValue,
} from "@chakra-ui/react";
import Link from "next/link";
import { Play, StopCircle } from "lucide-react";
import { useRunControlState } from "@/hooks/useRunControl";
import {
  shouldShowRecoverySection,
  isToolTrackedByRunningStep,
} from "@/components/runs/controlDecision";
import {
  RunControlConfirmModal,
  type RunControlConfirmModalRequest,
} from "@/components/runs/RunControlConfirmModal";

export interface RunRecoverySectionProps {
  toolName: string;
  toolType: string;
}

type RecoveryUIAction = "resume" | "abort";

export const RunRecoverySection: React.FC<RunRecoverySectionProps> = ({ toolName, toolType }) => {
  const bgColor = useColorModeValue("white", "surface.section");
  const runControlQuery = useRunControlState();
  const [request, setRequest] = useState<RunControlConfirmModalRequest | null>(null);
  const [pendingAction, setPendingAction] = useState<RecoveryUIAction | null>(null);

  if (!shouldShowRecoverySection(toolType)) {
    return null;
  }

  const tracked = isToolTrackedByRunningStep(runControlQuery.data, toolName);
  const disabled = tracked || pendingAction !== null;

  const openConfirm = (action: RecoveryUIAction) => {
    setRequest({ target: { kind: "recovery", toolId: toolName }, toolType, action });
  };

  return (
    <Card bg={bgColor}>
      <CardBody p={6}>
        <Heading size="md" mb={2}>
          Run Recovery
        </Heading>
        <Text fontSize="sm" mb={4}>
          Resume or abort an instrument run that no run step is tracking, for example after
          galago-web restarted.
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
              {pendingAction === "resume" ? "Resume in progress…" : "Abort in progress…"}
            </Text>
          </HStack>
        )}
        <RunControlConfirmModal
          request={request}
          onClose={() => setRequest(null)}
          closeOnDispatch
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
