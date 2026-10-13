// The only client reader of commandQueue.runState (D-01) and the only
// client module that references the toolControl mutation (D-24). Every
// control entry point gets its send function from useConfirmedControlSend,
// which owns one createConfirmedSender instance per hook instance.
import { useRef } from "react";
import { trpc } from "@/utils/trpc";
import { successToast, persistentErrorToast } from "@/components/ui/Toast";
import { createConfirmedSender, RUN_CONTROL_POLL_MS } from "@/components/runs/controlDecision";
import type {
  ConfirmedControlRequest,
  ConfirmedSendOutcome,
} from "@/components/runs/controlDecision";

export function useRunControlState() {
  return trpc.commandQueue.runState.useQuery(undefined, {
    refetchInterval: RUN_CONTROL_POLL_MS,
  });
}

export function useConfirmedControlSend(): {
  send: (request: ConfirmedControlRequest) => Promise<ConfirmedSendOutcome>;
  isSending: boolean;
} {
  const mutation = trpc.commandQueue.toolControl.useMutation();

  // Keep the latest mutateAsync behind a ref: the sender below is created
  // once (lazy useRef init) and must always call the current mutation
  // instance, not a stale closure from the render that created it.
  const mutateAsyncRef = useRef(mutation.mutateAsync);
  mutateAsyncRef.current = mutation.mutateAsync;

  const senderRef = useRef<ReturnType<typeof createConfirmedSender> | null>(null);
  if (senderRef.current === null) {
    senderRef.current = createConfirmedSender({
      sendRunning: (input) => mutateAsyncRef.current(input),
      notify: {
        accepted: (title, description) => successToast(title, description ?? ""),
        refused: (message) => persistentErrorToast("Action refused", message),
      },
    });
  }

  return {
    send: (request) => senderRef.current!.send(request),
    isSending: mutation.isLoading,
  };
}
