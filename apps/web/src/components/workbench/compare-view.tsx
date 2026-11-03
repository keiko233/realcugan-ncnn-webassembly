import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ArrowLeftRight } from "lucide-react";

import { m } from "@/paraglide/messages.js";
import type { ProgressSample } from "@/hooks/use-upscale";
import { PreviewMode, Zoom } from "@/lib/enums";
import { cn } from "@/lib/utils";

export interface Size {
  width: number;
  height: number;
}

export interface CompareViewProps {
  mode: PreviewMode;
  zoom: Zoom;
  originalSrc: string;
  resultSrc: string;
  /** Natural pixels of the input and of the result. */
  originalSize: Size;
  resultSize: Size;
  /** Measured stage box the comparison has to fit into. */
  viewport: Size;
  /** Progress samples from the run that produced this result. */
  trace: ProgressSample[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Fit `image` inside `viewport`, never enlarging past its own pixels. */
export function fitInside(viewport: Size, image: Size, allowUpscale = false): Size {
  if (viewport.width === 0 || viewport.height === 0) {
    return image;
  }

  const limit = allowUpscale ? Number.POSITIVE_INFINITY : 1;
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height, limit);
  return { width: image.width * scale, height: image.height * scale };
}

/**
 * The run's own progress samples, thinned into clip-path keyframes. The reveal
 * therefore travels at the rate the tiles actually completed.
 */
function traceFrames(trace: ProgressSample[]): { frames: number[]; times: number[] } | null {
  const usable = trace.filter((sample) => sample.rate > 0 && sample.rate <= 1);
  const last = usable.at(-1);
  if (!last || usable.length < 2 || last.at <= 0) {
    return null;
  }

  const steps = Math.min(18, usable.length);
  const frames = [0];
  const times = [0];
  let cursor = 0;

  for (let step = 1; step <= steps; step += 1) {
    const target = (last.at * step) / steps;
    while (cursor < usable.length - 1 && usable[cursor].at < target) {
      cursor += 1;
    }
    frames.push(Math.round(usable[cursor].rate * 100));
    times.push(clamp(usable[cursor].at / last.at, 0, 1));
  }

  frames.push(100);
  times.push(1);
  return { frames, times };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function Label({ side, children }: { side: "start" | "end"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-3 z-20 rounded-md border border-line bg-sheet/92 px-2 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm",
        side === "start" ? "left-3" : "right-3",
      )}
    >
      {children}
    </span>
  );
}

export function CompareView(props: CompareViewProps) {
  if (props.mode === PreviewMode.SideBySide || props.mode === PreviewMode.Stacked) {
    return <SplitPanes {...props} />;
  }

  return <WipeView {...props} />;
}

function Pane({ src, label, pixelated }: { src: string; label: string; pixelated: boolean }) {
  return (
    <div className="checkerboard relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg border border-line">
      <img
        src={src}
        alt={label}
        draggable={false}
        className="max-h-full max-w-full object-contain"
        style={pixelated ? { imageRendering: "pixelated" } : undefined}
      />
      <Label side="start">{label}</Label>
    </div>
  );
}

function SplitPanes({ mode, originalSrc, resultSrc, viewport }: CompareViewProps) {
  const stacked = mode === PreviewMode.Stacked;
  const gap = viewport.width < 700 ? 8 : 16;
  const pane = stacked
    ? { width: viewport.width, height: Math.max(80, (viewport.height - gap) / 2) }
    : { width: Math.max(80, (viewport.width - gap) / 2), height: viewport.height };

  return (
    <div className={cn("flex h-full w-full", stacked ? "flex-col" : "flex-row")} style={{ gap }}>
      <div style={{ width: pane.width, height: pane.height }}>
        <Pane src={originalSrc} label={m.stage_original()} pixelated={false} />
      </div>
      <div style={{ width: pane.width, height: pane.height }}>
        <Pane src={resultSrc} label={m.stage_result()} pixelated={false} />
      </div>
    </div>
  );
}

function WipeView({ zoom, originalSrc, resultSrc, resultSize, viewport, trace }: CompareViewProps) {
  const position = useMotionValue(50);
  const clipPath = useTransform(position, (value) => `inset(0 ${100 - value}% 0 0)`);
  const dividerLeft = useTransform(position, (value) => `${value}%`);
  const reducedMotion = usePrefersReducedMotion();

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dividerValue, setDividerValue] = useState(50);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  useMotionValueEvent(position, "change", (value) => {
    const rounded = Math.round(value);
    setDividerValue((current) => (current === rounded ? current : rounded));
  });

  const actual = zoom === Zoom.Actual;
  const canvas = fitInside(viewport, resultSize, actual);
  const limitX = Math.max(0, (canvas.width - viewport.width) / 2);
  const limitY = Math.max(0, (canvas.height - viewport.height) / 2);
  const offsetX = clamp(pan.x, -limitX, limitX);
  const offsetY = clamp(pan.y, -limitY, limitY);
  const pannable = limitX > 0 || limitY > 0;

  // The develop line: the result wipes in at the run's recorded tile rate, then
  // the divider settles in the middle so the comparison is already in front of
  // the visitor.
  useEffect(() => {
    position.set(50);
    const frames = reducedMotion ? null : traceFrames(trace);
    if (!frames) {
      return;
    }

    const elapsed = trace.at(-1)?.at ?? 800;
    const duration = clamp(elapsed / 1000, 0.5, 1.6);
    const sweep = animate(position, frames.frames, {
      duration,
      times: frames.times,
      ease: "linear",
    });
    let settle: ReturnType<typeof animate> | undefined;
    void sweep.then(() => {
      settle = animate(position, 50, { duration: 0.32, ease: [0.22, 1, 0.36, 1] });
    });

    return () => {
      sweep.stop();
      settle?.stop();
    };
  }, [position, reducedMotion, trace]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [zoom, resultSize.width, resultSize.height]);

  const moveTo = useCallback(
    (clientX: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      position.stop();
      position.set(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
    },
    [position],
  );

  const handleDividerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    position.stop();
    moveTo(event.clientX);
  };

  const handleDividerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      moveTo(event.clientX);
    }
  };

  const handleCanvasDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!pannable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: offsetX,
      panY: offsetY,
    };
  };

  const handleCanvasMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: clamp(drag.panX + (event.clientX - drag.x), -limitX, limitX),
      y: clamp(drag.panY + (event.clientY - drag.y), -limitY, limitY),
    });
  };

  const endCanvasDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        pannable && "cursor-grab active:cursor-grabbing",
      )}
      onPointerDown={handleCanvasDown}
      onPointerMove={handleCanvasMove}
      onPointerUp={endCanvasDrag}
      onPointerCancel={endCanvasDrag}
    >
      <div
        ref={canvasRef}
        className="checkerboard absolute top-1/2 left-1/2 overflow-hidden rounded-[4px] border border-line"
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
        }}
      >
        <img
          src={originalSrc}
          alt={m.stage_original()}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
          style={actual ? { imageRendering: "pixelated" } : undefined}
        />
        <motion.div className="absolute inset-0" style={{ clipPath }}>
          <img
            src={resultSrc}
            alt={m.stage_result()}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </motion.div>

        <motion.div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary"
          style={{ left: dividerLeft }}
        >
          <div
            role="slider"
            tabIndex={0}
            aria-label={m.stage_compare_hint()}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={dividerValue}
            aria-orientation="horizontal"
            onPointerDown={handleDividerDown}
            onPointerMove={handleDividerMove}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 10 : 2;
              if (event.key === "ArrowLeft") {
                position.stop();
                position.set(clamp(position.get() - step, 0, 100));
              } else if (event.key === "ArrowRight") {
                position.stop();
                position.set(clamp(position.get() + step, 0, 100));
              } else if (event.key === "Home") {
                position.stop();
                position.set(0);
              } else if (event.key === "End") {
                position.stop();
                position.set(100);
              } else {
                return;
              }
              event.preventDefault();
            }}
            className="ring-focus pointer-events-auto absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <ArrowLeftRight className="size-4" />
          </div>
        </motion.div>
      </div>

      <Label side="start">{m.stage_original()}</Label>
      <Label side="end">{m.stage_result()}</Label>
    </div>
  );
}
