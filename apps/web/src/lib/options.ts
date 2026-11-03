import { m } from "@/paraglide/messages.js";

import { Denoise, PreviewMode, Scale } from "./enums";

export interface OptionMeta<T extends string | number> {
  value: T;
  /** Message function so labels follow the active locale. */
  label: () => string;
  caption: () => string;
}

export const SCALE_OPTIONS: OptionMeta<Scale>[] = [
  { value: Scale.X2, label: m.option_scale_2x_label, caption: m.option_scale_2x_caption },
  { value: Scale.X3, label: m.option_scale_3x_label, caption: m.option_scale_3x_caption },
];

export const DENOISE_OPTIONS: OptionMeta<Denoise>[] = [
  {
    value: Denoise.Conservative,
    label: m.option_denoise_conservative_label,
    caption: m.option_denoise_conservative_caption,
  },
  {
    value: Denoise.None,
    label: m.option_denoise_none_label,
    caption: m.option_denoise_none_caption,
  },
  {
    value: Denoise.Denoise3x,
    label: m.option_denoise_3x_label,
    caption: m.option_denoise_3x_caption,
  },
];

export const PREVIEW_OPTIONS: OptionMeta<PreviewMode>[] = [
  {
    value: PreviewMode.Overlap,
    label: m.option_preview_overlap_label,
    caption: m.option_preview_overlap_caption,
  },
  {
    value: PreviewMode.SideBySide,
    label: m.option_preview_side_label,
    caption: m.option_preview_side_caption,
  },
  {
    value: PreviewMode.Stacked,
    label: m.option_preview_stack_label,
    caption: m.option_preview_stack_caption,
  },
];

export function denoiseLabel(value: number): string {
  return DENOISE_OPTIONS.find((option) => option.value === value)?.label() ?? String(value);
}
