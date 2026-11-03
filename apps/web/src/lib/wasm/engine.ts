import { WASM_BASE_URL } from "../config";
import { assertRealcuganModule, type RealcuganModule } from "./module";
import { parseCallbackLine, type ProgressEvent } from "./protocol";

const SCRIPT_ID = "realcugan-emscripten-loader";

export interface RunOptions {
  imageData: ImageData;
  scale: number;
  noise: number;
  onProgress?: (event: ProgressEvent) => void;
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
  private pending: ((costMs: number) => void) | null = null;
  private outOfMemory = false;
  private busy = false;

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

  async run({ imageData, scale, noise, onProgress }: RunOptions): Promise<RunResult> {
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
        break;
      case "PROC_END": {
        const resolve = this.pending;
        this.pending = null;
        resolve?.(event.cost);
        break;
      }
    }
  }

  private handleStderr(text: string): void {
    if (text.includes("memory access out of bounds") || text.includes("Out of memory")) {
      this.outOfMemory = true;
    }
    console.error("[realcugan]", text);
  }
}
