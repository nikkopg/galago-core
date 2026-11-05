// The only client reader of tool.options. One react-query entry per
// (toolId, source): every control bound to the same source shares it, so a
// list is read once when a form opens. Nothing here retries, polls or refetches
// on focus or reconnect (D-05): a stale list is replaced only by a fresh read
// the operator asked for. No effect hooks and no local state.
import { trpc } from "@/utils/trpc";
import type { OptionSourceId, OptionsResult } from "@/server/toolOptions";
import { deriveOptionsMode, OPTIONS_STALE_MS } from "@/components/tools/fieldOptions";
import type { OptionsMode } from "@/components/tools/fieldOptions";

export function useToolOptions(
  toolId: string | undefined,
  source: OptionSourceId,
  enabled: boolean,
): { mode: OptionsMode; data: OptionsResult | undefined } {
  const query = trpc.tool.options.useQuery(
    { toolId: toolId ?? "", source },
    {
      enabled: enabled && typeof toolId === "string" && toolId !== "",
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: OPTIONS_STALE_MS,
    },
  );
  const mode = deriveOptionsMode({
    isError: query.isError,
    isInitialLoading: query.isInitialLoading,
    data: query.data,
  });
  return { mode, data: mode === "ok" ? query.data : undefined };
}
