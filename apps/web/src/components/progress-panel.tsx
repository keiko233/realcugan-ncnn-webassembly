import { X } from "lucide-react";

import { m } from "@/paraglide/messages.js";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDuration } from "@/lib/image";
import type { ProgressEvent } from "@/lib/wasm";

interface ProgressPanelProps {
  sourceUrl: string;
  sourceName: string;
  progress: ProgressEvent | null;
  onCancel: () => void;
}

export function ProgressPanel({ sourceUrl, sourceName, progress, onCancel }: ProgressPanelProps) {
  const percent = progress
    ? Math.min(100, Math.max(0, Math.round(progress.progress_rate * 100)))
    : 0;
  const remainingSeconds = progress ? Math.max(0, Math.round(progress.remaining_time / 1000)) : 0;

  return (
    <div className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <img
        src={sourceUrl}
        alt={sourceName}
        className="checkerboard h-20 w-20 shrink-0 rounded-lg border border-border object-contain"
      />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-display text-sm font-semibold tracking-tight">
            {m.processing_title()}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {progress ? m.processing_progress({ percent }) : m.processing_estimating()}
          </span>
        </div>

        <Progress value={percent} />

        <div className="text-muted-foreground flex items-center gap-3 font-mono text-[0.7rem]">
          <span className="truncate">{sourceName}</span>
          {progress && remainingSeconds > 0 ? (
            <span className="shrink-0">
              {m.processing_remaining({ seconds: remainingSeconds })}
            </span>
          ) : null}
          {progress ? (
            <span className="ml-auto shrink-0">
              {formatDuration(progress.total_cost)} / tile {Math.round(progress.tile_cost)} ms
            </span>
          ) : null}
        </div>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onCancel} className="shrink-0">
        <X />
        {m.processing_cancel()}
      </Button>
    </div>
  );
}
