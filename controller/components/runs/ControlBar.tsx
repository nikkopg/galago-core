import React, { useState } from "react";
import {
  Card,
  CardBody,
  Heading,
  ButtonGroup,
  Button,
  Icon,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { Pause } from "lucide-react";
import type { RunStateEnvelope } from "@/server/runState";
import { shouldShowControlBar, toolDisplayName } from "./controlDecision";
import { RunControlConfirmModal } from "./RunControlConfirmModal";
import type { RunControlConfirmModalRequest } from "./RunControlConfirmModal";

type PendingRequest = RunControlConfirmModalRequest & { queueId: number };

// Run-page control bar container (D-02): a Card shown only while a
// controllable step is running, plus its always-mounted confirm modal.
export const ControlBar: React.FC<{ envelope: RunStateEnvelope | undefined }> = ({ envelope }) => {
  const cardBg = useColorModeValue("white", "surface.section");
  const [request, setRequest] = useState<PendingRequest | null>(null);

  const showBar = shouldShowControlBar(envelope);

  return (
    <>
      {showBar ? (
        <Card bg={cardBg} shadow="md" key={envelope.queueId}>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Heading size="md">
                {envelope.toolId} · {toolDisplayName(envelope.toolType)}
              </Heading>
              <ButtonGroup>
                <Button
                  colorScheme="orange"
                  leftIcon={<Icon as={Pause} />}
                  onClick={() =>
                    setRequest({
                      target: { kind: "running" },
                      toolType: envelope.toolType,
                      action: "pause",
                      queueId: envelope.queueId,
                    })
                  }>
                  Pause instrument
                </Button>
              </ButtonGroup>
            </VStack>
          </CardBody>
        </Card>
      ) : null}
      <RunControlConfirmModal request={request} onClose={() => setRequest(null)} />
    </>
  );
};
