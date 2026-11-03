import { m } from "@/paraglide/messages.js";

import { Denoise, PreviewMode, Scale, Zoom } from "./enums";

export interface OptionMeta<T extends string | number> {
  value: T;
  /** Message function so labels follow the active locale. */
  label: () => string;
  /** Short line shown next to the field while this value is selected. */
  hint: () => string;
}

export const SCALE_OPTIONS: OptionMeta<Scale>[] = [
  { value: Scale.X2, label: m.scale_2x, hint: m.scale_2x_hint },
  { value: Scale.X3, label: m.scale_3x, hint: m.scale_3x_hint },
];

export const DENOISE_OPTIONS: OptionMeta<Denoise>[] = [
  {
    value: Denoise.Conservative,
    label: m.denoise_conservative,
    hint: m.denoise_conservative_hint,
  },
  { value: Denoise.None, label: m.denoise_none, hint: m.denoise_none_hint },
  { value: Denoise.Denoise3x, label: m.denoise_3x, hint: m.denoise_3x_hint },
];

export const PREVIEW_OPTIONS: OptionMeta<PreviewMode>[] = [
  { value: PreviewMode.Overlap, label: m.preview_overlap, hint: m.stage_compare_hint },
  { value: PreviewMode.SideBySide, label: m.preview_side, hint: m.stage_compare_hint },
  { value: PreviewMode.Stacked, label: m.preview_stack, hint: m.stage_compare_hint },
];

export const ZOOM_OPTIONS: OptionMeta<Zoom>[] = [
  { value: Zoom.Fit, label: m.zoom_fit, hint: m.stage_compare_hint },
  { value: Zoom.Actual, label: m.zoom_actual, hint: m.stage_compare_hint },
];

export function denoiseLabel(value: number): string {
  return DENOISE_OPTIONS.find((option) => option.value === value)?.label() ?? String(value);
}
