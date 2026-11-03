import { useRef, useState, type PointerEvent } from "react";

import { Slider } from "@/components/ui/slider";

interface CompareSliderProps {
  originalSrc: string;
  resultSrc: string;
  originalLabel: string;
  resultLabel: string;
  hint: string;
}

export function CompareSlider({
  originalSrc,
  resultSrc,
  originalLabel,
  resultLabel,
  hint,
}: CompareSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromClientX(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging) updateFromClientX(event.clientX);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="checkerboard relative touch-none overflow-hidden rounded-xl border border-border select-none"
        style={{ cursor: dragging ? "grabbing" : "ew-resize" }}
      >
        <img
          src={originalSrc}
          alt={originalLabel}
          className="block h-auto w-full"
          draggable={false}
        />

        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <img
            src={resultSrc}
            alt={resultLabel}
            className="block h-full w-full object-cover"
            draggable={false}
          />
        </div>

        <div
          className="bg-primary pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2"
          style={{ left: `${position}%` }}
        />

        <span className="bg-card/90 absolute top-3 left-3 rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-wide">
          {originalLabel}
        </span>
        <span className="bg-card/90 absolute top-3 right-3 rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-wide">
          {resultLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Slider
          value={[position]}
          onValueChange={([next]) => setPosition(next ?? 50)}
          min={0}
          max={100}
          step={1}
          aria-label={hint}
          className="flex-1"
        />
        <span className="text-muted-foreground w-12 text-right font-mono text-xs">
          {Math.round(position)}%
        </span>
      </div>
      <p className="text-muted-foreground text-center text-xs">{hint}</p>
    </div>
  );
}
