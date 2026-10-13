import React, { useEffect, useState } from "react";
import { RunControlConfirmModal } from "./RunControlConfirmModal";
import { STOP_MODAL_COPY, stopModalBody } from "./stopInterception";
import type { InstrumentStopRequest } from "./stopInterception";
import { confirmStillValid, NOTHING_SENT_MESSAGE } from "./controlDecision";
import { infoToast } from "@/components/ui/Toast";
import type { RunStateEnvelope } from "@/server/runState";

export interface InstrumentStopModalProps {
  request: InstrumentStopRequest | null;
  envelope: RunStateEnvelope | undefined;
  onClose: () => void;
}

// No-timer, no-default instrument Stop confirmation over the shared
// RunControlConfirmModal (D-06, D-17). Neither imports nor reuses the
// countdown modal used by the Tool Box stop_run step. The decision, the
// disabled-until-chosen Abort button, Cancel semantics and the persistent
// refusal toast all come from the shared modal; this component adds only
// the Stop-specific copy, the fixed "abort" target, and the stale-request
// close rule below (D-12 applied to Stop).
export const InstrumentStopModal: React.FC<InstrumentStopModalProps> = ({
  request,
  envelope,
  onClose,
}) => {
  const [pending, setPending] = useState(false);

  // D-12/D-16: if the step that opened this confirm ends or moves on before
  // the operator confirms, close it and tell them nothing was sent. An
  // in-flight abort is never cancelled by this effect.
  useEffect(() => {
    if (request === null || pending) {
      return;
    }
    if (!confirmStillValid(request.queueId, envelope)) {
      onClose();
      infoToast("Confirmation closed", NOTHING_SENT_MESSAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelope, request, pending]);

  return (
    <RunControlConfirmModal
      request={
        request === null
          ? null
          : { target: { kind: "running" }, toolType: request.toolType, action: "abort" }
      }
      onClose={onClose}
      copy={{ ...STOP_MODAL_COPY, body: stopModalBody }}
      afterAccepted={request?.followUp}
      onPendingChange={setPending}
    />
  );
};
