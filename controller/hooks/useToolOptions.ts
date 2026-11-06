// The only client reader of tool.options. One react-query entry per
// (toolId, source): every control bound to the same source shares it, so a
// list is read once when a form opens. Nothing here retries, polls or refetches
// on focus or reconnect (D-05): a stale list is replaced only by a fresh read
// the operator asked for (refresh). No effect hooks; the only local state is
// whether this control's Refresh is in flight.
import { useState } from "react";
import { trpc } from "@/utils/trpc";
import type { OptionSourceId, OptionsResult } from "@/server/toolOptions";
import { deriveOptionsMode, OPTIONS_STALE_MS } from "@/components/tools/fieldOptions";
import type { OptionsMode } from "@/components/tools/fieldOptions";

export function useToolOptions(
  toolId: string | undefined,
  source: OptionSourceId,
  enabled: boolean,
): {
  mode: OptionsMode;
  data: OptionsResult | undefined;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
} {
  const utils = trpc.useContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // Operator-requested re-read (D-12, RESEARCH Pattern 6). The fresh result is
  // written into the SHARED (toolId, source) entry, so every field of that
  // source sees it at once. A rejected fetch (the Next API itself unreachable)
  // writes an unavailable result, so the old list is never left on screen.
  // Nothing here touches a field value: a refresh never clears a selection.
  const refresh = async (): Promise<void> => {
    if (!enabled || typeof toolId !== "string" || toolId === "") return;
    setIsRefreshing(true);
    let result: OptionsResult;
    try {
      result = await utils.tool.options.fetch(
        { toolId, source, refresh: true },
        { staleTime: 0, retry: false },
      );
    } catch {
      result = { status: "unavailable", source, reason: "transport" };
    }
    utils.tool.options.setData({ toolId, source }, result);
    setIsRefreshing(false);
  };

  return { mode, data: mode === "ok" ? query.data : undefined, refresh, isRefreshing };
}
