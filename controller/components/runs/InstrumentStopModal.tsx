import React, { useState } from "react";
import { RunControlConfirmModal } from "./RunControlConfirmModal";
import { STOP_MODAL_COPY, stopModalBody } from "./stopInterception";
import type { InstrumentStopRequest } from "./stopInterception";
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
// the Stop-specific copy and the fixed "abort" target. `envelope` is
// tracked via the `pending` state set here, consumed by the stale-request
// close rule added alongside Clear All interception (D-12 applied to Stop).
export const InstrumentStopModal: React.FC<InstrumentStopModalProps> = ({
  request,
  envelope: _envelope,
  onClose,
}) => {
  const [, setPending] = useState(false);

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
