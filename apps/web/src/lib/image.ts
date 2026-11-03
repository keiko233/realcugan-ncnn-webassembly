import { DENOISE_FILENAME_SUFFIX, type Denoise } from "./enums";

export interface LoadedImage {
  /** Pixels handed to the wasm engine. */
  imageData: ImageData;
  width: number;
  height: number;
  /** Object URL suitable for `<img src>` previews. */
  previewUrl: string;
  name: string;
  /** Original byte size, when known. */
  size?: number;
}

async function decodeToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("无法创建 canvas 上下文。");
    }

    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  const imageData = await decodeToImageData(file);
  return {
    imageData,
    width: imageData.width,
    height: imageData.height,
    previewUrl: URL.createObjectURL(file),
    name: file.name,
    size: file.size,
  };
}

export async function loadImageFromUrl(url: string, name: string): Promise<LoadedImage> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`示例图片加载失败 (${response.status})`);
  }

  const blob = await response.blob();
  const imageData = await decodeToImageData(blob);
  return {
    imageData,
    width: imageData.width,
    height: imageData.height,
    previewUrl: URL.createObjectURL(blob),
    name,
    size: blob.size,
  };
}

export async function imageDataToBlob(data: ImageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建 canvas 上下文。");
  }
  context.putImageData(data, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("导出 PNG 失败。"))),
      "image/png",
    );
  });
}

export function formatOutputFilename(sourceName: string, scale: number, noise: Denoise): string {
  const base = sourceName.replace(/\.[^./\\]+$/, "") || "realcugan-output";
  const suffix = DENOISE_FILENAME_SUFFIX[noise] ?? `denoise${noise}x`;
  return `${base}-up${scale}x-${suffix}.png`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function formatDuration(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  if (seconds < 10) {
    return `${seconds.toFixed(2)} 秒`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${Math.round(seconds % 60)} 秒`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
