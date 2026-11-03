import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, RefreshCw, RotateCcw } from "lucide-react";

import { m } from "@/paraglide/messages.js";
import { Dropzone } from "@/components/dropzone";
import { EngineStatus, type EngineState } from "@/components/engine-status";
import { OptionCards } from "@/components/option-cards";
import { ProgressPanel } from "@/components/progress-panel";
import { ResultViewer } from "@/components/result-viewer";
import { Segmented } from "@/components/segmented";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useEngine } from "@/hooks/use-engine";
import {
  decodeNumericEnum,
  decodeStringEnum,
  usePersistentState,
} from "@/hooks/use-persistent-state";
import { useUpscale } from "@/hooks/use-upscale";
import { SAMPLE_IMAGE_URL } from "@/lib/config";
import { Denoise, DENOISE_FORCED_BY_SCALE, PreviewMode, Scale, StorageKey } from "@/lib/enums";
import {
  downloadBlob,
  formatDuration,
  formatOutputFilename,
  imageDataToBlob,
  loadImageFile,
  loadImageFromUrl,
  type LoadedImage,
} from "@/lib/image";
import { DENOISE_OPTIONS, PREVIEW_OPTIONS, SCALE_OPTIONS } from "@/lib/options";
import { OutOfMemoryError } from "@/lib/wasm";

const decodeScale = decodeNumericEnum([Scale.X2, Scale.X3]);
const decodeDenoise = decodeNumericEnum([Denoise.Conservative, Denoise.None, Denoise.Denoise3x]);
const decodePreview = decodeStringEnum([
  PreviewMode.Overlap,
  PreviewMode.SideBySide,
  PreviewMode.Stacked,
]);

const SAMPLE_NAME = "test-img.jpg";

interface UpscaleResult {
  url: string;
  width: number;
  height: number;
  costMs: number;
  scale: Scale;
  denoise: Denoise;
}

export function UpscaleWorkbench() {
  const engineQuery = useEngine();
  const { run, isPending, error, reset, progress } = useUpscale();

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

  const [source, setSource] = useState<LoadedImage | null>(null);
  const [result, setResult] = useState<UpscaleResult | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const engineState: EngineState = engineQuery.isSuccess
    ? "ready"
    : engineQuery.isError
      ? "error"
      : "loading";
  const engineReady = engineState === "ready";

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

  const runUpscale = useCallback(
    async (image: LoadedImage, nextScale: Scale, nextDenoise: Denoise) => {
      const output = await run({
        imageData: image.imageData,
        scale: nextScale,
        noise: nextDenoise,
      });
      const blob = await imageDataToBlob(output.imageData);
      setResult({
        url: URL.createObjectURL(blob),
        width: output.imageData.width,
        height: output.imageData.height,
        costMs: output.costMs,
        scale: nextScale,
        denoise: nextDenoise,
      });
    },
    [run],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setFileError(null);
      reset();
      setResult(null);
      try {
        const image = await loadImageFile(file);
        setSource(image);
        await runUpscale(image, scale, denoise);
      } catch (cause) {
        setFileError(cause instanceof Error ? cause.message : m.error_generic());
      }
    },
    [denoise, reset, runUpscale, scale],
  );

  const handleSample = useCallback(async () => {
    setFileError(null);
    setSampleLoading(true);
    reset();
    setResult(null);
    try {
      const image = await loadImageFromUrl(SAMPLE_IMAGE_URL, SAMPLE_NAME);
      setSource(image);
      await runUpscale(image, scale, denoise);
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : m.error_generic());
    } finally {
      setSampleLoading(false);
    }
  }, [denoise, reset, runUpscale, scale]);

  const handleReset = useCallback(() => {
    reset();
    setResult(null);
    setSource(null);
    setFileError(null);
  }, [reset]);

  const handleSave = useCallback(async () => {
    if (!result) return;
    const response = await fetch(result.url);
    const blob = await response.blob();
    downloadBlob(blob, formatOutputFilename(source?.name ?? "", result.scale, result.denoise));
  }, [result, source]);

  const optionsChanged = result !== null && (result.scale !== scale || result.denoise !== denoise);

  const handleRerun = useCallback(async () => {
    if (!source) return;
    setFileError(null);
    reset();
    setResult(null);
    try {
      await runUpscale(source, scale, denoise);
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : m.error_generic());
    }
  }, [denoise, reset, runUpscale, scale, source]);

  const outOfMemory = error instanceof OutOfMemoryError;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">01</span>
            {m.nav_workbench()}
          </CardTitle>
          <EngineStatus state={engineState} onRetry={() => void engineQuery.refetch()} />
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <fieldset disabled={isPending} className="space-y-3">
              <legend className="flex items-baseline gap-2">
                <span className="font-display text-sm font-semibold tracking-tight">
                  {m.option_scale_title()}
                </span>
                <span className="text-muted-foreground text-xs">{m.option_scale_hint()}</span>
              </legend>
              <OptionCards
                ariaLabel={m.option_scale_title()}
                value={scale}
                onChange={setScale}
                options={SCALE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label(),
                  caption: option.caption(),
                }))}
              />
            </fieldset>

            <fieldset disabled={isPending} className="space-y-3">
              <legend className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-sm font-semibold tracking-tight">
                  {m.option_denoise_title()}
                </span>
                <span className="text-muted-foreground text-xs">{m.option_denoise_hint()}</span>
                {scale === Scale.X3 ? (
                  <Badge variant="outline" className="ml-auto">
                    {m.option_denoise_locked()}
                  </Badge>
                ) : null}
              </legend>
              <OptionCards
                ariaLabel={m.option_denoise_title()}
                value={denoise}
                onChange={setDenoise}
                options={DENOISE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label(),
                  caption: option.caption(),
                  disabled: scale === Scale.X3 && option.value !== Denoise.Denoise3x,
                }))}
              />
            </fieldset>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-sm font-semibold tracking-tight">
              {m.option_preview_title()}
            </span>
            <Segmented<PreviewMode>
              ariaLabel={m.option_preview_title()}
              value={preview}
              onChange={setPreview}
              options={PREVIEW_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label(),
              }))}
            />
            <span className="text-muted-foreground ml-auto text-xs">
              {PREVIEW_OPTIONS.find((option) => option.value === preview)?.caption()}
            </span>
          </div>
        </CardContent>
      </Card>

      {engineState === "error" ? (
        <div className="surface flex items-start gap-3 border-destructive/40 p-4">
          <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{m.engine_error()}</p>
            <p className="text-muted-foreground text-xs">{m.engine_requirements()}</p>
          </div>
        </div>
      ) : null}

      {outOfMemory ? (
        <div className="surface flex flex-wrap items-center gap-3 border-destructive/40 p-4">
          <AlertTriangle className="text-destructive size-4 shrink-0" />
          <p className="text-sm">{m.error_oom()}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => window.location.reload()}
          >
            <RefreshCw />
            {m.error_reload()}
          </Button>
        </div>
      ) : null}

      {!source && !isPending ? (
        <Dropzone
          disabled={!engineReady}
          onFile={(file) => void handleFile(file)}
          onSample={() => void handleSample()}
          sampleLoading={sampleLoading}
          error={fileError}
        />
      ) : null}

      {isPending && source ? (
        <ProgressPanel
          sourceUrl={source.previewUrl}
          sourceName={source.name}
          progress={progress}
          onCancel={handleReset}
        />
      ) : null}

      {result && source ? (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">02</span>
                {m.result_title()}
              </CardTitle>
              <p className="text-muted-foreground font-mono text-xs">
                {m.result_dimensions({ width: result.width, height: result.height })}
                {" · "}
                {m.result_done({ duration: formatDuration(result.costMs) })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {optionsChanged ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRerun()}
                >
                  <RefreshCw />
                  {m.result_rerun()}
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw />
                {m.result_reset()}
              </Button>
              <Button type="button" size="sm" onClick={() => void handleSave()}>
                <Download />
                {m.result_save()}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <ResultViewer
              mode={preview}
              originalSrc={source.previewUrl}
              resultSrc={result.url}
              originalName={source.name}
            />
          </CardContent>
        </Card>
      ) : null}

      {error && !outOfMemory ? (
        <p className="text-destructive text-sm">{m.error_generic()}</p>
      ) : null}
    </div>
  );
}
