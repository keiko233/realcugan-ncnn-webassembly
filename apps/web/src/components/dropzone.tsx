import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";

import { m } from "@/paraglide/messages.js";
import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/enums";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  disabled?: boolean;
  onFile: (file: File) => void;
  onSample: () => void;
  sampleLoading?: boolean;
  error?: string | null;
}

export function Dropzone({ disabled, onFile, onSample, sampleLoading, error }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setInvalid(false);
      onFile(file);
    } else {
      setInvalid(true);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    accept(event.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "focus-visible:ring-ring/40 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors outline-none focus-visible:ring-[3px]",
          "border-border bg-card/60",
          !disabled && "hover:border-primary/50 hover:bg-accent/40 cursor-pointer",
          dragging && "border-primary bg-primary/[0.06]",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="bg-secondary text-primary grid size-12 place-items-center rounded-full">
          <ImagePlus className="size-5" />
        </span>
        <span className="font-display text-base font-semibold tracking-tight">
          {m.dropzone_title()}
        </span>
        <span className="text-muted-foreground text-xs">{m.dropzone_hint()}</span>
        <Button type="button" variant="outline" size="sm" disabled={disabled} className="mt-1">
          {m.dropzone_action()}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || sampleLoading}
          onClick={onSample}
        >
          {sampleLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {sampleLoading ? m.action_sample_loading() : m.action_sample()}
        </Button>
        {invalid || error ? (
          <p className="text-destructive text-xs">{invalid ? m.dropzone_invalid() : error}</p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
