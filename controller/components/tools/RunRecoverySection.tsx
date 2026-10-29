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
  Collapse,
  useColorModeValue,
} from "@chakra-ui/react";
import Link from "next/link";
import { Play, StopCircle } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useRunControlState } from "@/hooks/useRunControl";
import {
  shouldShowRecoverySection,
  isToolTrackedByRunningStep,
  needsGuidEntry,
} from "@/components/runs/controlDecision";
import { isValidRecoveryGuid, type LatchInfo } from "@/server/recoveryActions";
import { persistentErrorToast } from "@/components/ui/Toast";
import {
  RunControlConfirmModal,
  type RunControlConfirmModalRequest,
} from "@/components/runs/RunControlConfirmModal";

export interface RunRecoverySectionProps {
  toolName: string;
  toolType: string;
}

type RecoveryUIAction = "resume" | "abort" | "acknowledge_failure";

// Bounded renderer backstop for an unknown latch reply (T-04-12): the raw
// object renders as a single JSON line the card's collapsible clips at the
// layout level, never a loop or a list.
function formatLatchRaw(raw: Record<string, unknown>): string {
  try {
    return JSON.stringify(raw);
  } catch {
    try {
      return String(raw);
    } catch {
      return "{}";
    }
  }
}

// UI-SPEC copy pinned as constants (Read latch / Use this guid / No failure
// latched) so the display contract is greppable at the source level.
const READ_LATCH_LABEL = "Read latch";
const USE_THIS_GUID_LABEL = "Use this guid";
const NO_FAILURE_LATCHED_LABEL = "No failure latched";

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
  // The latch read result (D-11): display data handled with the same
  // display-only discipline. It starts as "no result shown" (no block until
  // "Read latch" is clicked), is set ONLY by an explicit click, and is
  // cleared back to null ONLY by an accepted acknowledge (afterAccepted).
  // It never gates, never enables and never feeds the send path (D-12).
  const [latchResult, setLatchResult] = useState<LatchInfo | null>(null);
  const [readPending, setReadPending] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  // Explicit refetch on click only: the query is born disabled and mounts
  // nothing — one read per click, no polling, no timer (UI-08 rule 1; the
  // no-timers scan owns this file).
  const latchQuery = trpc.tool.latchStatus.useQuery(
    { toolId: toolName },
    {
      enabled: false,
      retry: false,
    },
  );

  const readClick = async () => {
    if (readPending) return;
    setReadPending(true);
    try {
      const refetched = await latchQuery.refetch();
      setLatchResult(refetched.error ? null : (refetched.data ?? null));
      if (refetched.error) {
        // The read failure surfaces through the existing toast surface;
        // the block itself shows nothing beyond the pre-click state.
        persistentErrorToast("Latch read failed", refetched.error.message);
      }
    } finally {
      setReadPending(false);
    }
  };

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
  // nothing typed to clear (D-07 clear-on-accepted). The latch result joins
  // the guid clear so an accepted acknowledge also drops the shown result
  // back to "no result shown" (D-07/D-12 clear-on-accepted parity).
  const afterAccepted =
    request?.action === "acknowledge_failure"
      ? async () => {
          setGuid("");
          setLatchResult(null);
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
          <>
            <VStack align="stretch" spacing={2} mt={4}>
              <Heading size="sm" fontWeight={700}>
                Latched failure
              </Heading>
              <Button isDisabled={readPending} onClick={readClick}>
                {READ_LATCH_LABEL}
              </Button>
              {readPending && (
                <HStack spacing={2}>
                  <Spinner size="sm" />
                  <Text fontSize="sm">Reading latch…</Text>
                </HStack>
              )}
              {!readPending && latchResult && (
                <VStack align="stretch" spacing={2}>
                  {!latchResult.latched ? (
                    <>
                      <Heading size="sm" fontWeight={700}>
                        {NO_FAILURE_LATCHED_LABEL}
                      </Heading>
                      <Text fontSize="sm">
                        This tool has no failure latched. An acknowledge is not possible until a
                        STACK step fails and ends.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text fontSize="sm">guid:</Text>
                      {/* Read-only display: selectable text, exactly as the reply carried it (D-11). */}
                      <Text fontSize="sm" wordBreak="break-all" userSelect="text">
                        {latchResult.guid}
                      </Text>
                      {latchResult.kind && <Text fontSize="sm">kind: {latchResult.kind}</Text>}
                      {latchResult.explanation && (
                        <Text fontSize="sm">explanation: {latchResult.explanation}</Text>
                      )}
                      <Button variant="link" size="sm" onClick={() => setRawOpen(!rawOpen)}>
                        Raw JSON
                      </Button>
                      <Collapse in={rawOpen}>
                        <Text fontFamily="mono" wordBreak="break-all" fontSize="xs">
                          {formatLatchRaw(latchResult.raw)}
                        </Text>
                      </Collapse>
                      {/* D-12: fills the guid input ONLY — verbatim guid, no trim, no send,
                          no modal, no auto-acknowledge. The operator still presses
                          "Acknowledge failure…" and confirms. */}
                      <Button
                        variant="outline"
                        colorScheme="teal"
                        onClick={() => setGuid(latchResult.guid ?? "")}>
                        {USE_THIS_GUID_LABEL}
                      </Button>
                    </>
                  )}
                </VStack>
              )}
            </VStack>
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
                  A guid cannot be blank. Enter the guid shown in the failed step's error or via
                  Read latch.
                </Text>
              )}
            </VStack>
          </>
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
