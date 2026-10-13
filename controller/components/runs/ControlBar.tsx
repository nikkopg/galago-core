import React, { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  Heading,
  ButtonGroup,
  Button,
  Icon,
  VStack,
  HStack,
  Badge,
  Progress,
  Alert,
  AlertIcon,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { Pause, Play, StopCircle, TriangleAlert } from "lucide-react";
import type { RunStateEnvelope } from "@/server/runState";
import {
  shouldShowControlBar,
  toolDisplayName,
  controlButtonHints,
  progressValue,
  nextUnknownSince,
  formatClock,
  confirmStillValid,
  NOTHING_SENT_MESSAGE,
} from "./controlDecision";
import type { UnknownSince } from "./controlDecision";
import { RunControlConfirmModal } from "./RunControlConfirmModal";
import type { RunControlConfirmModalRequest } from "./RunControlConfirmModal";
import { ToolPausedModal } from "./ToolPausedModal";
import { reducePausePrompt, INITIAL_PAUSE_PROMPT } from "./pausePrompt";
import { infoToast } from "@/components/ui/Toast";

// origin "prompt" (D-12): a confirm opened from ToolPausedModal's
// Resume/Abort, closed by the prompt effect below when its own episode ends.
type PendingRequest = RunControlConfirmModalRequest & {
  queueId: number;
  origin: "bar" | "prompt";
};

// Run-page control bar container (D-02): a Card shown only while a
// controllable step is running, plus its always-mounted confirm modal.
export const ControlBar: React.FC<{ envelope: RunStateEnvelope | undefined }> = ({ envelope }) => {
  const cardBg = useColorModeValue("white", "surface.section");
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [pending, setPending] = useState(false);
  const [unknownSince, setUnknownSince] = useState<UnknownSince | null>(null);
  const [prompt, setPrompt] = useState(INITIAL_PAUSE_PROMPT);

  const showBar = shouldShowControlBar(envelope);
  const toolType = envelope?.running ? envelope.toolType : "";

  useEffect(() => {
    setUnknownSince((prev) => nextUnknownSince(prev, envelope, Date.now()));
  }, [envelope]);

  // D-11..D-14: the tool_paused prompt is driven only by this poll. It never
  // reads or writes the queue's UIMessage modal state (ToolPausedModal, D-10).
  useEffect(() => {
    const result = reducePausePrompt(prompt, { type: "poll", envelope });
    if (result.state !== prompt) {
      setPrompt(result.state);
    }
    // D-12: a confirm opened from the prompt closes with it, once (not
    // double-toasted alongside the bar-origin effect below).
    if (result.closedBy !== null && request !== null && request.origin === "prompt" && !pending) {
      setRequest(null);
      infoToast("Confirmation closed", NOTHING_SENT_MESSAGE);
    }
  }, [envelope, prompt, request, pending]);

  // UI-01 adjacency (D-02, D-12): close a confirm opened for a step that
  // has since resumed or ended before the operator confirmed.
  useEffect(() => {
    if (request !== null && !pending && !confirmStillValid(request.queueId, envelope)) {
      setRequest(null);
      infoToast("Confirmation closed", NOTHING_SENT_MESSAGE);
    }
  }, [envelope, request, pending]);

  const hints = showBar ? controlButtonHints(envelope) : null;
  const percent = showBar ? progressValue(envelope.runState?.percent ?? null) : null;
  const badgeColorScheme =
    showBar && envelope.runState?.state === "paused"
      ? "orange"
      : showBar && envelope.runState?.state === "running"
        ? "green"
        : "gray";
  const unknownWarning =
    unknownSince !== null ? `Run state unknown since ${formatClock(unknownSince.since)}` : null;

  return (
    <>
      {showBar ? (
        <Card bg={cardBg} shadow="md" key={envelope.queueId}>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Heading size="md" noOfLines={2}>
                {envelope.toolId} · {toolDisplayName(envelope.toolType)} — {envelope.command}
              </Heading>
              <HStack spacing={2} align="center">
                <Badge fontSize="md" colorScheme={badgeColorScheme}>
                  {envelope.runState?.state ?? "unknown"}
                </Badge>
                <Progress
                  flex={1}
                  value={percent ?? undefined}
                  isIndeterminate={percent === null}
                  colorScheme="teal"
                />
                {percent !== null ? <Text fontSize="sm">{percent}%</Text> : null}
              </HStack>
              {unknownSince !== null ? (
                <Alert status="warning">
                  <AlertIcon />
                  <VStack align="start" spacing={0}>
                    <Text>Run state unknown since {formatClock(unknownSince.since)}</Text>
                    {envelope.lastError ? (
                      <Text fontSize="sm" wordBreak="break-word">
                        {envelope.lastError}
                      </Text>
                    ) : null}
                  </VStack>
                </Alert>
              ) : null}
              <ButtonGroup flexWrap="wrap">
                <Button
                  colorScheme="orange"
                  leftIcon={<Icon as={Pause} />}
                  isDisabled={!hints?.pause}
                  onClick={() =>
                    setRequest({
                      target: { kind: "running" },
                      toolType: envelope.toolType,
                      action: "pause",
                      queueId: envelope.queueId,
                      origin: "bar",
                    })
                  }>
                  Pause instrument
                </Button>
                <Button
                  colorScheme="teal"
                  leftIcon={<Icon as={Play} />}
                  isDisabled={!hints?.resume}
                  onClick={() =>
                    setRequest({
                      target: { kind: "running" },
                      toolType: envelope.toolType,
                      action: "resume",
                      queueId: envelope.queueId,
                      origin: "bar",
                    })
                  }>
                  Resume instrument
                </Button>
                <Button
                  colorScheme="red"
                  leftIcon={<Icon as={StopCircle} />}
                  isDisabled={!hints?.abort}
                  onClick={() =>
                    setRequest({
                      target: { kind: "running" },
                      toolType: envelope.toolType,
                      action: "abort",
                      queueId: envelope.queueId,
                      origin: "bar",
                    })
                  }>
                  Abort instrument run
                </Button>
                {prompt.pause !== null ? (
                  <Button
                    variant="outline"
                    colorScheme="teal"
                    leftIcon={<Icon as={TriangleAlert} />}
                    onClick={() => setPrompt((s) => reducePausePrompt(s, { type: "reopen" }).state)}>
                    Paused: view reason
                  </Button>
                ) : null}
              </ButtonGroup>
            </VStack>
          </CardBody>
        </Card>
      ) : null}
      <ToolPausedModal
        isOpen={prompt.isOpen}
        pause={prompt.pause}
        toolType={toolType}
        unknownWarning={unknownWarning}
        lastError={envelope?.running ? envelope.lastError : undefined}
        onHide={() => setPrompt((s) => reducePausePrompt(s, { type: "hide" }).state)}
        onResume={() => {
          if (prompt.queueId !== null) {
            setRequest({
              target: { kind: "running" },
              toolType,
              action: "resume",
              queueId: prompt.queueId,
              origin: "prompt",
            });
          }
        }}
        onAbort={() => {
          if (prompt.queueId !== null) {
            setRequest({
              target: { kind: "running" },
              toolType,
              action: "abort",
              queueId: prompt.queueId,
              origin: "prompt",
            });
          }
        }}
      />
      <RunControlConfirmModal
        request={request}
        onClose={() => setRequest(null)}
        onPendingChange={setPending}
      />
    </>
  );
};
