import { WASM_BASE_URL } from "../config";
import { assertRealcuganModule, type RealcuganModule } from "./module";
import { parseCallbackLine, type ProgressEvent } from "./protocol";

const SCRIPT_ID = "realcugan-emscripten-loader";

export interface RunOptions {
  imageData: ImageData;
  scale: number;
  noise: number;
  onProgress?: (event: ProgressEvent) => void;
  /**
   * Fires once per finished tile with its RGBA pixels. The native side streams
   * tiles into the output buffer as it computes them, so this is the same
   * result the run will eventually return, just delivered progressively.
   */
  onTile?: (tile: TilePreview) => void;
}

/** A finished tile of the in-progress result, in output pixels. */
export interface TilePreview {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Backed by a plain ArrayBuffer so it can go straight into `ImageData`. */
  pixels: Uint8ClampedArray<ArrayBuffer>;
}

export interface RunResult {
  imageData: ImageData;
  /** Wall-clock cost reported by the native side, in milliseconds. */
  costMs: number;
}

export class OutOfMemoryError extends Error {
  constructor() {
    super("The wasm heap ran out of memory.");
    this.name = "OutOfMemoryError";
  }
}

/**
 * The native side keeps a single worker thread, so a second job is refused
 * while the previous one drains. Callers surface this as "still finishing the
 * previous image" rather than as a failure.
 */
export class EngineBusyError extends Error {
  constructor() {
    super("The engine is still processing the previous image.");
    this.name = "EngineBusyError";
  }
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Turns the emscripten module's stdout callback protocol into a promise based
 * API. Jobs are serialised because the native side keeps a single worker thread
 * with the loaded model.
 */
export class RealcuganEngine {
  private module: RealcuganModule | null = null;
  private onProgress: ((event: ProgressEvent) => void) | undefined;
  private onTile: ((tile: TilePreview) => void) | undefined;
  private pending: ((costMs: number) => void) | null = null;
  private outOfMemory = false;
  private busy = false;
  // Output geometry of the in-flight run, needed to slice tiles out of the heap.
  private outWidth = 0;
  private outHeight = 0;
  private dstPtr = 0;

  async load(baseUrl: string = WASM_BASE_URL): Promise<void> {
    if (this.module) {
      return;
    }

    if (typeof globalThis.createRealCuganModule !== "function") {
      await injectScript(`${baseUrl}/realcugan.js`);
    }

    const factory = globalThis.createRealCuganModule;
    if (typeof factory !== "function") {
      throw new Error("createRealCuganModule is undefined; the engine cannot start.");
    }

    const module: unknown = await factory({
      locateFile: (path) => `${baseUrl}/${path}`,
      print: (text) => this.handleStdout(text),
      printErr: (text) => this.handleStderr(text),
    });

    assertRealcuganModule(module);
    this.module = module;
  }

  get isReady(): boolean {
    return this.module !== null;
  }

  async run({ imageData, scale, noise, onProgress, onTile }: RunOptions): Promise<RunResult> {
    const module = this.module;
    if (!module) {
      throw new Error("The engine has not finished loading.");
    }
    if (this.busy) {
      throw new EngineBusyError();
    }
    if (this.outOfMemory) {
      throw new OutOfMemoryError();
    }

    this.busy = true;
    this.onProgress = onProgress;
    this.onTile = onTile;

    const width = imageData.width;
    const height = imageData.height;
    const outWidth = width * scale;
    const outHeight = height * scale;
    const srcSize = imageData.data.length;
    const dstSize = outWidth * outHeight * 4;

    const srcPtr = module._malloc(srcSize);
    const dstPtr = module._malloc(dstSize);

    try {
      module.HEAPU8.set(imageData.data, srcPtr);
      // Transparent until a tile lands, so the preview only shows real output.
      module.HEAPU8.fill(0, dstPtr, dstPtr + dstSize);
      this.dstPtr = dstPtr;
      this.outWidth = outWidth;
      this.outHeight = outHeight;

      const costMs = await new Promise<number>((resolve, reject) => {
        this.pending = resolve;
        const status = module._process_image(0, srcPtr, dstPtr, width, height, scale, noise);
        if (status !== 0) {
          this.pending = null;
          reject(new EngineBusyError());
        }
      });

      const pixels = new Uint8ClampedArray(module.HEAPU8.subarray(dstPtr, dstPtr + dstSize));
      return { imageData: new ImageData(pixels, outWidth, outHeight), costMs };
    } finally {
      module._free(srcPtr);
      module._free(dstPtr);
      this.pending = null;
      this.onProgress = undefined;
      this.onTile = undefined;
      this.dstPtr = 0;
      this.busy = false;
    }
  }

  private handleStdout(text: string): void {
    const event = parseCallbackLine(text);
    if (!event) {
      return;
    }

    switch (event.eventType) {
      case "PROC_PROGRESS":
        this.onProgress?.(event);
        this.emitTile(event);
        break;
      case "PROC_END": {
        const resolve = this.pending;
        this.pending = null;
        resolve?.(event.cost);
        break;
      }
    }
  }

  /** Copies the freshly finished tile out of the wasm heap for the preview. */
  private emitTile(event: ProgressEvent): void {
    const onTile = this.onTile;
    const module = this.module;
    const { tile_x: x, tile_y: y, tile_w: width, tile_h: height } = event;
    if (!onTile || !module || width <= 0 || height <= 0) {
      return;
    }
    if (x < 0 || y < 0 || x + width > this.outWidth || y + height > this.outHeight) {
      return;
    }

    const stride = width * 4;
    const pixels = new Uint8ClampedArray(stride * height);
    // Re-read the view every tile: growing the heap detaches older views.
    const heap = module.HEAPU8;
    for (let row = 0; row < height; row++) {
      const start = this.dstPtr + ((y + row) * this.outWidth + x) * 4;
      pixels.set(heap.subarray(start, start + stride), row * stride);
    }
    onTile({ x, y, width, height, pixels });
  }

  private handleStderr(text: string): void {
    if (text.includes("memory access out of bounds") || text.includes("Out of memory")) {
      this.outOfMemory = true;
    }
    console.error("[realcugan]", text);
  }
}
