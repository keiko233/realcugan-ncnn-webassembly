import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import type { Denoise, Scale } from "@/lib/enums";
import { loadEngine, type ProgressEvent, type RunResult } from "@/lib/wasm";

export interface UpscaleInput {
  imageData: ImageData;
  scale: Scale;
  noise: Denoise;
}

export function useUpscale() {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);

  const mutation = useMutation<RunResult, Error, UpscaleInput>({
    mutationFn: async ({ imageData, scale, noise }) => {
      setProgress(null);
      const engine = await loadEngine();
      return engine.run({
        imageData,
        scale,
        noise,
        onProgress: (event) => setProgress(event),
      });
    },
  });

  const reset = useCallback(() => {
    setProgress(null);
    mutation.reset();
  }, [mutation]);

  return {
    run: mutation.mutateAsync,
    data: mutation.data,
    error: mutation.error,
    isPending: mutation.isPending,
    reset,
    progress,
  };
}
