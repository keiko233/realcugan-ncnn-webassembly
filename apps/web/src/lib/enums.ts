/**
 * Small enums shared across the app. Using enums (instead of loose string
 * literals) keeps option values, storage keys and the native callback protocol
 * consistent between the UI, the persistence layer and the wasm boundary.
 */

/** Upscale factors with bundled model weights. */
export enum Scale {
  X2 = 2,
  X3 = 3,
}

/** Denoise profiles exposed by the bundled weights. */
export enum Denoise {
  Conservative = -1,
  None = 0,
  Denoise3x = 3,
}

export enum PreviewMode {
  Overlap = "overlap",
  SideBySide = "side-by-side",
  Stacked = "stacked",
}

/** Stage scale: fit the stage, or show the result at its own pixels. */
export enum Zoom {
  Fit = "fit",
  Actual = "actual",
}

export enum Theme {
  Light = "light",
  Dark = "dark",
}

export enum StorageKey {
  Scale = "realcugan.scale",
  Denoise = "realcugan.denoise",
  Preview = "realcugan.preview",
  Zoom = "realcugan.zoom",
  Theme = "realcugan.theme",
}

/** `eventType` values printed by `native/src/main.cpp`. */
export enum CallbackEventType {
  Progress = "PROC_PROGRESS",
  End = "PROC_END",
}

/** 3x only ships a single (denoise 3x) weight set. */
export const DENOISE_FORCED_BY_SCALE: Record<Scale, Denoise | null> = {
  [Scale.X2]: null,
  [Scale.X3]: Denoise.Denoise3x,
};

/** Filename fragment for each denoise profile. */
export const DENOISE_FILENAME_SUFFIX: Record<Denoise, string> = {
  [Denoise.Conservative]: "conservative",
  [Denoise.None]: "no-denoise",
  [Denoise.Denoise3x]: "denoise3x",
};

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/bmp"];
