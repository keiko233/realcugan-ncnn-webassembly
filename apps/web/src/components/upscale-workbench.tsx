import { Download, ImagePlus, Play, RefreshCw, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { m } from "@/paraglide/messages.js";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Button } from "@/components/motion/button/base";
import { StatefulButton } from "@/components/motion/button/stateful";
import { type FileUploadItem } from "@/components/motion/file-upload";
import {
  AnimatedToastStack,
  useAnimatedToastStack,
} from "@/components/motion/animated-toast-stack";
import { UtilityCluster } from "@/components/utility-cluster";
import { OptionTabs } from "@/components/workbench/option-tabs";
import { Stage, type StageResult, type StageState } from "@/components/workbench/stage";
import { useEngine } from "@/hooks/use-engine";
import {
  decodeNumericEnum,
  decodeStringEnum,
  usePersistentState,
} from "@/hooks/use-persistent-state";
import { useUpscale } from "@/hooks/use-upscale";
import { SAMPLE_IMAGE_URL } from "@/lib/config";
import {
  ACCEPTED_IMAGE_TYPES,
  Denoise,
  DENOISE_FORCED_BY_SCALE,
  PreviewMode,
  Scale,
  StorageKey,
  Zoom,
} from "@/lib/enums";
import {
  downloadBlob,
  formatDuration,
  formatOutputFilename,
  imageDataToBlob,
  loadImageFile,
  loadImageFromUrl,
  type LoadedImage,
} from "@/lib/image";
import { useLocaleSubscription } from "@/lib/i18n";
import { DENOISE_OPTIONS, PREVIEW_OPTIONS, SCALE_OPTIONS, denoiseLabel } from "@/lib/options";
import { EngineBusyError, OutOfMemoryError } from "@/lib/wasm";

const SAMPLE_NAME = "test-img.jpg";

const decodeScale = decodeNumericEnum([Scale.X2, Scale.X3]);
const decodeDenoise = decodeNumericEnum([Denoise.Conservative, Denoise.None, Denoise.Denoise3x]);
const decodePreview = decodeStringEnum([
  PreviewMode.Overlap,
  PreviewMode.SideBySide,
  PreviewMode.Stacked,
]);
const decodeZoom = decodeStringEnum([Zoom.Fit, Zoom.Actual]);

type EngineState = "loading" | "ready" | "error";
type SaveState = "idle" | "loading" | "success" | "error";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 md:block">
      <span className="w-16 shrink-0 text-xs text-muted-foreground md:mb-2 md:block md:w-auto">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {hint ? (
        <span className="hidden text-[11px] leading-4 text-muted-foreground md:mt-2 md:block">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </span>
  );
}

export function UpscaleWorkbench() {
  // Subscribe so a language switch re-renders the whole workbench.
  useLocaleSubscription();
  const engineQuery = useEngine();
  const { run, discard, reset, progress, isPending, discarding } = useUpscale();
  const { toasts, showToast, dismissToast } = useAnimatedToastStack({ limit: 3 });

  const [scale, setScale] = usePersistentState<Scale>(
    StorageKey.Scale,
    Scale.X2,
    decodeScale,
    String,
  );
  const [denoise, setDenoise] = usePersistentState<Denoise>(
    StorageKey.Denoise,
    Denoise.Denoise3x,
    decodeDenoise,
    String,
  );
  const [preview, setPreview] = usePersistentState<PreviewMode>(
    StorageKey.Preview,
    PreviewMode.Overlap,
    decodePreview,
    String,
  );
  const [zoom, setZoom] = usePersistentState<Zoom>(StorageKey.Zoom, Zoom.Fit, decodeZoom, String);

  const [source, setSource] = useState<LoadedImage | null>(null);
  const [result, setResult] = useState<StageResult | null>(null);
  const [applied, setApplied] = useState<{ scale: Scale; denoise: Denoise } | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [queue, setQueue] = useState<FileUploadItem[]>([]);
  const saveTimer = useRef<number | null>(null);

  const engineState: EngineState = engineQuery.isSuccess
    ? "ready"
    : engineQuery.isError
      ? "error"
      : "loading";
  const running = isPending && !discarding;

  // 3X only ships the denoise 3x weights.
  useEffect(() => {
    const forced = DENOISE_FORCED_BY_SCALE[scale];
    if (forced !== null && denoise !== forced) {
      setDenoise(forced);
    }
  }, [scale, denoise, setDenoise]);

  // Release the previous preview URLs as soon as they are replaced.
  useEffect(() => () => URL.revokeObjectURL(source?.previewUrl ?? ""), [source]);
  useEffect(() => () => URL.revokeObjectURL(result?.url ?? ""), [result]);
  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  const runUpscale = useCallback(
    async (image: LoadedImage, nextScale: Scale, nextDenoise: Denoise) => {
      const output = await run({
        imageData: image.imageData,
        scale: nextScale,
        noise: nextDenoise,
      });
      if (!output) return;

      const blob = await imageDataToBlob(output.result.imageData);
      setResult({
        url: URL.createObjectURL(blob),
        size: { width: output.result.imageData.width, height: output.result.imageData.height },
        costMs: output.result.costMs,
        trace: output.trace,
      });
      setApplied({ scale: nextScale, denoise: nextDenoise });
    },
    [run],
  );

  const start = useCallback(
    async (image: LoadedImage, nextScale: Scale, nextDenoise: Denoise) => {
      reset();
      setResult(null);
      setApplied(null);
      setSaveState("idle");
      setSource(image);
      setQueue([]);
      try {
        await runUpscale(image, nextScale, nextDenoise);
      } catch (cause) {
        if (cause instanceof OutOfMemoryError) {
          showToast({
            status: "error",
            title: m.stage_error_oom(),
            action: { label: m.error_reload(), onClick: () => window.location.reload() },
          });
          return;
        }
        if (cause instanceof EngineBusyError) {
          showToast({ status: "info", title: m.stage_error_busy() });
          return;
        }
        console.error("[realcugan]", cause);
        showToast({ status: "error", title: m.stage_error_generic() });
      }
    },
    [reset, runUpscale, showToast],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setQueue((items) =>
          items.map((item) =>
            item.file === file ? { ...item, status: "error", error: m.stage_drop_invalid() } : item,
          ),
        );
        return;
      }
      try {
        const image = await loadImageFile(file);
        await start(image, scale, denoise);
      } catch (cause) {
        console.error("[realcugan]", cause);
        setQueue((items) =>
          items.map((item) =>
            item.file === file
              ? { ...item, status: "error", error: m.stage_error_generic() }
              : item,
          ),
        );
      }
    },
    [denoise, scale, start],
  );

  const handleSample = useCallback(async () => {
    setSampleLoading(true);
    try {
      const image = await loadImageFromUrl(SAMPLE_IMAGE_URL, SAMPLE_NAME);
      await start(image, scale, denoise);
    } catch (cause) {
      console.error("[realcugan]", cause);
      showToast({ status: "error", title: m.stage_error_generic() });
    } finally {
      setSampleLoading(false);
    }
  }, [denoise, scale, showToast, start]);

  const handleRerun = useCallback(async () => {
    if (!source) return;
    await start(source, scale, denoise);
  }, [denoise, scale, source, start]);

  const handleCancel = useCallback(() => {
    discard();
    showToast({ status: "info", title: m.stage_error_busy() });
  }, [discard, showToast]);

  const handleSave = useCallback(async () => {
    if (!result) return;
    setSaveState("loading");
    try {
      const response = await fetch(result.url);
      const blob = await response.blob();
      const filename = formatOutputFilename(
        source?.name ?? "",
        applied?.scale ?? scale,
        applied?.denoise ?? denoise,
      );
      downloadBlob(blob, filename);
      setSaveState("success");
      showToast({ status: "success", title: m.toast_saved(), description: filename });
      saveTimer.current = window.setTimeout(() => setSaveState("idle"), 1800);
    } catch (cause) {
      console.error("[realcugan]", cause);
      setSaveState("error");
      saveTimer.current = window.setTimeout(() => setSaveState("idle"), 2200);
    }
  }, [applied, denoise, result, scale, showToast, source]);

  const optionsChanged =
    applied !== null && result !== null && (applied.scale !== scale || applied.denoise !== denoise);

  const stageState: StageState =
    running || discarding
      ? "processing"
      : engineState === "error"
        ? "engine-error"
        : result && source
          ? "result"
          : source
            ? "source"
            : engineState === "loading"
              ? "engine-loading"
              : "empty";

  const percent = progress ? Math.round(Math.min(1, Math.max(0, progress.progress_rate)) * 100) : 0;
  const remaining = progress ? Math.max(0, Math.round(progress.remaining_time / 1000)) : 0;

  const engineLabel =
    engineState === "ready"
      ? m.status_ready()
      : engineState === "error"
        ? m.status_error()
        : m.status_loading();

  const resultCaption = result
    ? `${applied?.scale ?? scale}× · ${result.size.width} × ${result.size.height}`
    : "";

  return (
    <div className="flex h-full min-h-0 flex-col-reverse md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-t border-line bg-sunken md:h-full md:w-[304px] md:border-t-0 md:border-r">
        <div className="hidden bg-chrome px-5 py-4 text-chrome-ink md:block">
          <span className="block text-[17px] font-bold tracking-[-0.03em]">Real-CUGAN</span>
          <p className="mt-1.5 text-[11px] leading-relaxed text-chrome-ink-2">
            {m.brand_tagline()}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3 md:gap-5 md:px-5 md:py-5">
          <fieldset disabled={isPending} className="flex flex-col gap-4 md:gap-5">
            <Field
              label={m.field_scale()}
              hint={SCALE_OPTIONS.find((option) => option.value === scale)?.hint()}
            >
              <OptionTabs<Scale>
                ariaLabel={m.field_scale()}
                value={scale}
                onChange={setScale}
                options={SCALE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label(),
                }))}
              />
            </Field>

            <Field
              label={m.field_denoise()}
              hint={
                scale === Scale.X3
                  ? m.denoise_locked()
                  : DENOISE_OPTIONS.find((option) => option.value === denoise)?.hint()
              }
            >
              <OptionTabs<Denoise>
                ariaLabel={m.field_denoise()}
                value={denoise}
                onChange={setDenoise}
                options={DENOISE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label(),
                  disabled: scale === Scale.X3 && option.value !== Denoise.Denoise3x,
                }))}
              />
            </Field>

            <Field label={m.field_compare()}>
              <OptionTabs<PreviewMode>
                ariaLabel={m.field_compare()}
                value={preview}
                onChange={setPreview}
                options={PREVIEW_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label(),
                }))}
              />
            </Field>
          </fieldset>

          <div className="border-t border-line pt-4">
            <div className="flex flex-col gap-1.5 text-[11px]">
              <Readout label={m.readout_input()}>
                {source ? (
                  <span className="tnum">
                    {source.width} × {source.height}
                  </span>
                ) : (
                  m.readout_none()
                )}
              </Readout>
              <Readout label={m.readout_output()}>
                {result ? (
                  <span className="tnum">
                    <AnimatedNumber value={result.size.width} /> ×{" "}
                    <AnimatedNumber value={result.size.height} />
                  </span>
                ) : (
                  m.readout_none()
                )}
              </Readout>
              <Readout label={m.readout_cost()}>
                {running || discarding ? (
                  <span className="tnum">
                    <AnimatedNumber
                      value={progress ? progress.total_cost / 1000 : 0}
                      duration={0.3}
                      format={(value) => `${value.toFixed(1)} 秒`}
                    />
                  </span>
                ) : result ? (
                  <span className="tnum">{formatDuration(result.costMs)}</span>
                ) : (
                  m.readout_none()
                )}
              </Readout>
            </div>

            {running || discarding ? (
              <div className="mt-3">
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full bg-primary transition-[width] duration-300 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="tnum">
                    {discarding ? m.stage_error_busy() : m.processing_progress({ percent })}
                  </span>
                  <span className="tnum">
                    {running && remaining > 0 ? m.processing_remaining({ seconds: remaining }) : ""}
                  </span>
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-line px-3 py-3 md:px-5 md:py-4">
          {running ? (
            <Button variant="secondary" onClick={handleCancel} className="w-full">
              <X className="size-4" />
              {m.action_cancel()}
            </Button>
          ) : discarding ? (
            <StatefulButton state="loading" loadingText={m.stage_error_busy()} className="w-full">
              {m.stage_error_busy()}
            </StatefulButton>
          ) : result ? (
            <StatefulButton
              state={saveState}
              loadingText={m.action_saving()}
              successText={m.action_saved()}
              errorText={m.stage_error_generic()}
              onClick={() => void handleSave()}
              icon={<Download className="size-4" />}
              className="w-full"
            >
              {m.action_save()}
            </StatefulButton>
          ) : source ? (
            <Button
              onClick={() => void handleRerun()}
              disabled={engineState !== "ready"}
              className="w-full"
            >
              <Play className="size-4" />
              {m.action_run()}
            </Button>
          ) : (
            <Button
              onClick={() => document.getElementById("stage-file-input")?.click()}
              disabled={engineState !== "ready"}
              className="w-full"
            >
              <ImagePlus className="size-4" />
              {m.action_pick()}
            </Button>
          )}

          {result ? (
            <>
              {optionsChanged ? (
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => void handleRerun()}
                  className="w-full"
                >
                  <RefreshCw className="size-4" />
                  {m.action_rerun()}
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => document.getElementById("stage-file-input")?.click()}
                className="w-full"
              >
                <RotateCcw className="size-4" />
                {m.action_again()}
              </Button>
            </>
          ) : null}

          <div className="mt-1 flex items-center justify-between">
            <UtilityCluster tone="paper" />
            <span className="text-[10px] text-muted-foreground">MIT</span>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between bg-chrome px-3 text-chrome-ink md:hidden">
          <span className="text-[13px] font-bold tracking-[-0.03em]">Real-CUGAN</span>
          <UtilityCluster tone="chrome" />
        </div>

        <Stage
          state={stageState}
          source={source}
          result={result}
          preview={preview}
          zoom={zoom}
          onZoom={setZoom}
          progress={progress}
          resultCaption={resultCaption}
          queue={queue}
          onQueueChange={setQueue}
          sampleLoading={sampleLoading}
          onFiles={(files) => {
            const file = files[0];
            if (file) void handleFile(file);
          }}
          onRetryFile={(item) => {
            if (item.file) void handleFile(item.file);
          }}
          onSample={() => void handleSample()}
          onRetryEngine={() => void engineQuery.refetch()}
        />

        <footer className="flex h-9 shrink-0 items-center gap-3 border-t border-line px-3 text-[11px] text-muted-foreground md:px-5">
          <span className="truncate">{source ? source.name : m.status_no_source()}</span>
          <span className="tnum hidden shrink-0 sm:inline">
            {scale}× · {m.field_denoise()} {denoiseLabel(denoise)}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <AnimatedBadge
              status={
                engineState === "ready" ? "success" : engineState === "error" ? "danger" : "loading"
              }
              size="sm"
              contentKey={engineState}
              className="border-line bg-transparent text-muted-foreground"
            >
              {engineLabel}
            </AnimatedBadge>
            <span className="hidden md:inline">· {m.status_privacy()}</span>
          </span>
        </footer>
      </div>

      <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} position="bottom-left" fixed />
    </div>
  );
}
