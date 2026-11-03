import { useQuery } from "@tanstack/react-query";

import { loadEngine } from "@/lib/wasm";

export const ENGINE_QUERY_KEY = ["realcugan", "engine"] as const;

/**
 * Loads the wasm engine once per session. TanStack Query tracks the loading /
 * error state and gives the UI a retry affordance for free.
 */
export function useEngine() {
  return useQuery({
    queryKey: ENGINE_QUERY_KEY,
    queryFn: loadEngine,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
