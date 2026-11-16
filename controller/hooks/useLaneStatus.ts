// The single client reader of commandQueue.laneStatus (D-24). It only reads the
// lane snapshot (lane mode, halt reason, running lanes, failures); it never
// touches run control, run state or any mutation.
import { trpc } from "@/utils/trpc";

export const LANE_STATUS_POLL_MS = 1500;

export function useLaneStatus() {
  return trpc.commandQueue.laneStatus.useQuery(undefined, {
    refetchInterval: LANE_STATUS_POLL_MS,
  });
}
