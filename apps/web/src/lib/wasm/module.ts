/**
 * Hand-written, strictly typed description of the surface exposed by the
 * emscripten module built from `native/`.
 *
 * `-sEXPORTED_FUNCTIONS=_malloc,_free,_process_image` and
 * `-sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAPU32` (see native/CMakeLists.txt) are
 * the contract this file mirrors. `assertRealcuganModule` validates it at
 * runtime so a mismatched build fails loudly instead of corrupting memory.
 */

export interface RealcuganModule {
  /**
   * Live view of the wasm linear memory. The backing ArrayBuffer is replaced
   * whenever the heap grows, so always read `module.HEAPU8` fresh.
   */
  HEAPU8: Uint8Array;
  /** Allocate `size` bytes; returns a pointer into HEAPU8. */
  _malloc(size: number): number;
  /** Release memory previously returned by `_malloc`. */
  _free(pointer: number): void;
  /**
   * Queue an RGBA image for upscaling.
   *
   * @returns `0` when the job was accepted, `-1` when the worker is still busy.
   */
  _process_image(
    imageId: number,
    srcPtr: number,
    dstPtr: number,
    width: number,
    height: number,
    scale: number,
    noise: number,
  ): number;
}

export interface RealcuganModuleConfig {
  locateFile: (path: string, scriptDirectory: string) => string;
  print: (text: string) => void;
  printErr: (text: string) => void;
}

export type RealcuganModuleFactory = (config: RealcuganModuleConfig) => Promise<RealcuganModule>;

declare global {
  /**
   * Global factory injected by the emscripten glue script (`realcugan.js`).
   * The name comes from `-sEXPORT_NAME=createRealCuganModule`.
   */
  var createRealCuganModule: RealcuganModuleFactory | undefined;
}

export function assertRealcuganModule(value: unknown): asserts value is RealcuganModule {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Emscripten 模块初始化失败：返回值不是对象。");
  }

  const candidate = value as Record<string, unknown>;
  const requiredFunctions = ["_malloc", "_free", "_process_image"] as const;

  for (const name of requiredFunctions) {
    if (typeof candidate[name] !== "function") {
      throw new TypeError(`Emscripten 模块缺少导出函数 ${name}。`);
    }
  }

  if (!(candidate.HEAPU8 instanceof Uint8Array)) {
    throw new TypeError("Emscripten 模块缺少 HEAPU8 视图。");
  }
}
