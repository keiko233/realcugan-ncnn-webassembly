import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import type { Denoise, Scale } from "@/lib/enums";
import { loadEngine, type ProgressEvent, type RunResult } from "@/lib/wasm";

export interface UpscaleInput {
  imageData: ImageData;
  scale: Scale;
  noise: Denoise;
}

/**
 * One progress sample from the native side. The stage replays this trace when
 * it develops the result, so the reveal carries the run's own rhythm instead of
 * a canned easing curve.
 */
export interface ProgressSample {
  /** Milliseconds since the run was accepted. */
  at: number;
  /** 0..1, as reported by the engine. */
  rate: number;
}

export interface UpscaleRun {
  result: RunResult;
  trace: ProgressSample[];
}

interface EngineInput extends UpscaleInput {
  onSample: (rate: number) => void;
}

export function useUpscale() {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const discardRef = useRef(false);

  const mutation = useMutation<RunResult, Error, EngineInput>({
    mutationFn: async ({ imageData, scale, noise, onSample }) => {
      discardRef.current = false;
      setDiscarding(false);
      setProgress(null);

      const engine = await loadEngine();
      return engine.run({
        imageData,
        scale,
        noise,
        onProgress: (event) => {
          onSample(event.progress_rate);
          setProgress(event);
        },
      });
    },
    onSettled: () => {
      if (discardRef.current) {
        discardRef.current = false;
        setDiscarding(false);
      }
    },
  });

  /**
   * Resolves with the result and its progress trace, or `null` when the visitor
   * walked away from the run. The native job cannot be interrupted, so a
   * discarded run keeps the engine busy until it drains.
   */
  const run = useCallback(
    async (input: UpscaleInput): Promise<UpscaleRun | null> => {
      const samples: ProgressSample[] = [];
      const startedAt = performance.now();

      try {
        const result = await mutation.mutateAsync({
          ...input,
          onSample: (rate) => samples.push({ at: performance.now() - startedAt, rate }),
        });
        return discardRef.current ? null : { result, trace: samples };
      } catch (error) {
        if (discardRef.current) {
          return null;
        }
        throw error;
      }
    },
    [mutation],
  );

  const discard = useCallback(() => {
    discardRef.current = true;
    setDiscarding(true);
    setProgress(null);
  }, []);

  const reset = useCallback(() => {
    discardRef.current = false;
    setDiscarding(false);
    setProgress(null);
    mutation.reset();
  }, [mutation]);

  return {
    run,
    discard,
    reset,
    progress,
    error: mutation.error,
    isPending: mutation.isPending,
    discarding,
  };
}
