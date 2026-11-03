import { Expand, ImagePlus, TriangleAlert } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

import { m } from "@/paraglide/messages.js";
import { Button } from "@/components/motion/button/base";
import { FileUpload, type FileUploadItem } from "@/components/motion/file-upload";
import { Loader } from "@/components/motion/loader";
import { ImageViewer, ImageViewerContent } from "@/components/motion/morphing-lightbox";
import { Tooltip } from "@/components/motion/tooltip";
import { CompareView, fitInside, type Size } from "@/components/workbench/compare-view";
import { OptionTabs } from "@/components/workbench/option-tabs";
import type { ProgressSample } from "@/hooks/use-upscale";
import { ACCEPTED_IMAGE_TYPES, PreviewMode, Zoom } from "@/lib/enums";
import type { LoadedImage } from "@/lib/image";
import { ZOOM_OPTIONS } from "@/lib/options";
import { cn } from "@/lib/utils";
import type { ProgressEvent } from "@/lib/wasm";

export interface StageResult {
  url: string;
  size: Size;
  costMs: number;
  trace: ProgressSample[];
}

export type StageState =
  "engine-loading" | "engine-error" | "empty" | "processing" | "source" | "result";

interface StageProps {
  state: StageState;
  source: LoadedImage | null;
  result: StageResult | null;
  resultCaption: string;
  /** Live preview of the in-progress result, painted by the workbench. */
  processingOverlay?: ReactNode;
  preview: PreviewMode;
  zoom: Zoom;
  onZoom: (zoom: Zoom) => void;
  progress: ProgressEvent | null;
  queue: FileUploadItem[];
  onQueueChange: (items: FileUploadItem[]) => void;
  sampleLoading: boolean;
  onFiles: (files: File[]) => void;
  onRetryFile: (item: FileUploadItem) => void;
  onSample: () => void;
  onRetryEngine: () => void;
}

function useViewportSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

function Notice({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-sm font-semibold">{title}</p>
        {body ? <p className="text-xs leading-relaxed text-muted-foreground">{body}</p> : null}
        {action}
      </div>
    </div>
  );
}

function EmptyStage({
  queue,
  sampleLoading,
  onQueueChange,
  onFiles,
  onRetryFile,
  onSample,
}: Pick<
  StageProps,
  "queue" | "sampleLoading" | "onQueueChange" | "onFiles" | "onRetryFile" | "onSample"
>) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-full max-w-xl flex-col items-center gap-3">
        <FileUpload
          variant="centered"
          multiple={false}
          maxFiles={1}
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          value={queue}
          onValueChange={onQueueChange}
          onFilesAdded={(_items, files) => onFiles(files)}
          onRemove={() => onQueueChange([])}
          onRetry={onRetryFile}
          title={m.stage_drop_title()}
          description={m.stage_drop_hint()}
          browseLabel={m.action_pick()}
          classNames={{
            dropzone: "min-h-64 rounded-2xl",
            queue: "w-full",
          }}
        />
        <Button variant="ghost" disabled={sampleLoading} onClick={onSample}>
          {sampleLoading ? (
            <Loader variant="dots" size={14} label={m.action_sample()} />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {sampleLoading ? m.action_sample_loading() : m.action_sample()}
        </Button>
      </div>
    </div>
  );
}

function ImageStage({
  src,
  box,
  className,
  children,
}: {
  src: string;
  box: Size;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative h-full w-full">
      <div
        className={cn(
          "checkerboard absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[4px] border border-line",
          className,
        )}
        style={{ width: box.width, height: box.height }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
        {children}
      </div>
    </div>
  );
}

function ProcessingStage({
  source,
  progress,
  viewport,
  overlay,
}: {
  source: LoadedImage;
  progress: ProgressEvent | null;
  viewport: Size;
  overlay?: ReactNode;
}) {
  const box = fitInside(viewport, { width: source.width, height: source.height });
  const rate = progress ? Math.min(1, Math.max(0, progress.progress_rate)) : 0;
  const percent = Math.round(rate * 100);

  return (
    <div className="relative h-full w-full">
      <ImageStage src={source.previewUrl} box={box}>
        {/* Finished tiles paint over the source, so the result develops on
            top of the input as the run proceeds. */}
        {overlay}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-foreground/15">
          <div
            className="h-full bg-primary transition-[width] duration-200 ease-linear"
            style={{ width: `${rate * 100}%` }}
          />
        </div>
      </ImageStage>

      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-sheet/92 px-3 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
          <Loader variant="dots" size={14} label={m.stage_processing()} />
          <span className="tnum text-foreground">
            {progress ? m.processing_progress({ percent }) : m.stage_processing_estimating()}
          </span>
        </span>
      </div>
    </div>
  );
}

export function Stage({
  state,
  source,
  result,
  resultCaption,
  processingOverlay,
  preview,
  zoom,
  onZoom,
  progress,
  queue,
  onQueueChange,
  sampleLoading,
  onFiles,
  onRetryFile,
  onSample,
  onRetryEngine,
}: StageProps) {
  const { ref, size } = useViewportSize();
  const [dragging, setDragging] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  const sourceBox = source ? fitInside(size, { width: source.width, height: source.height }) : null;

  const viewerImages = useMemo(() => {
    if (!source || !result) return [];
    return [
      {
        id: "original",
        src: source.previewUrl,
        alt: m.stage_original(),
        width: source.width,
        height: source.height,
        caption: `${source.name} · ${source.width} × ${source.height}`,
      },
      {
        id: "result",
        src: result.url,
        alt: m.stage_result(),
        width: result.size.width,
        height: result.size.height,
        caption: resultCaption,
      },
    ];
  }, [result, resultCaption, source]);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      // The empty state's own upload panel handles its drops.
      if (state === "empty") return;
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles, state],
  );

  return (
    <section
      aria-label={m.stage_drop_title()}
      onDragOver={(event) => {
        event.preventDefault();
        if (state !== "empty") setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="relative min-h-0 flex-1 overflow-hidden bg-paper p-3 md:p-5"
    >
      <div ref={ref} className="relative h-full w-full">
        {state === "empty" ? (
          <EmptyStage
            queue={queue}
            sampleLoading={sampleLoading}
            onQueueChange={onQueueChange}
            onFiles={onFiles}
            onRetryFile={onRetryFile}
            onSample={onSample}
          />
        ) : null}

        {state === "engine-loading" ? (
          <Notice
            icon={<Loader variant="dot-matrix" size={40} label={m.stage_engine_loading()} />}
            title={m.stage_engine_loading()}
          />
        ) : null}

        {state === "engine-error" ? (
          <Notice
            icon={<TriangleAlert className="size-5" />}
            title={m.stage_engine_error()}
            body={m.stage_engine_requirements()}
            action={
              <Button variant="outline" size="sm" onClick={onRetryEngine}>
                {m.action_retry()}
              </Button>
            }
          />
        ) : null}

        {state === "processing" && source ? (
          <ProcessingStage
            source={source}
            progress={progress}
            viewport={size}
            overlay={processingOverlay}
          />
        ) : null}

        {state === "source" && source && sourceBox ? (
          <ImageStage src={source.previewUrl} box={sourceBox}>
            <span className="tnum absolute top-2 left-2 rounded-md border border-line bg-sheet/92 px-2 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
              {source.name} · {source.width} × {source.height}
            </span>
          </ImageStage>
        ) : null}

        {state === "result" && source && result ? (
          <CompareView
            mode={preview}
            zoom={zoom}
            originalSrc={source.previewUrl}
            resultSrc={result.url}
            originalSize={{ width: source.width, height: source.height }}
            resultSize={result.size}
            viewport={size}
            trace={result.trace}
          />
        ) : null}
      </div>

      {state === "result" && result ? (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2 md:top-5 md:right-5">
          {preview === PreviewMode.Overlap ? (
            <OptionTabs<Zoom>
              ariaLabel={m.field_zoom()}
              value={zoom}
              onChange={onZoom}
              options={ZOOM_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label(),
              }))}
              className="w-[124px] bg-sheet/92 backdrop-blur-sm"
            />
          ) : null}
          <Tooltip content={m.action_inspect()} asLabel>
            <Button
              variant="outline"
              size="icon"
              aria-label={m.action_inspect()}
              onClick={() => setViewerId("result")}
              className="size-8 rounded-lg bg-sheet/92 backdrop-blur-sm"
            >
              <Expand className="size-4" />
            </Button>
          </Tooltip>
        </div>
      ) : null}

      {dragging ? (
        <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-paper/60">
          <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            {m.stage_drop_active()}
          </span>
        </div>
      ) : null}

      {viewerImages.length > 0 ? (
        <ImageViewer
          images={viewerImages}
          value={viewerId}
          onValueChange={setViewerId}
          label={m.action_inspect()}
        >
          <ImageViewerContent />
        </ImageViewer>
      ) : null}
    </section>
  );
}
