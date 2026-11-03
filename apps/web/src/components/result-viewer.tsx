import { CompareSlider } from "@/components/compare-slider";
import { m } from "@/paraglide/messages.js";
import { PreviewMode } from "@/lib/enums";
import { cn } from "@/lib/utils";

interface ResultViewerProps {
  mode: PreviewMode;
  originalSrc: string;
  resultSrc: string;
  originalName: string;
}

function Frame({ src, label, className }: { src: string; label: string; className?: string }) {
  return (
    <figure className={cn("min-w-0 space-y-2", className)}>
      <img
        src={src}
        alt={label}
        className="checkerboard w-full rounded-xl border border-border object-contain"
      />
      <figcaption className="text-muted-foreground text-center font-mono text-[0.7rem] tracking-wide">
        {label}
      </figcaption>
    </figure>
  );
}

export function ResultViewer({ mode, originalSrc, resultSrc, originalName }: ResultViewerProps) {
  if (mode === PreviewMode.Overlap) {
    return (
      <CompareSlider
        originalSrc={originalSrc}
        resultSrc={resultSrc}
        originalLabel={m.result_original()}
        resultLabel={m.result_output()}
        hint={m.result_compare_hint()}
      />
    );
  }

  if (mode === PreviewMode.SideBySide) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Frame src={originalSrc} label={m.result_original()} />
        <Frame src={resultSrc} label={m.result_output()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Frame src={originalSrc} label={originalName || m.result_original()} />
      <Frame src={resultSrc} label={m.result_output()} />
    </div>
  );
}
