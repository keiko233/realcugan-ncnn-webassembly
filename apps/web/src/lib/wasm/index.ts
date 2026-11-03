import { WASM_BASE_URL } from "../config";
import { RealcuganEngine } from "./engine";

export { RealcuganEngine, OutOfMemoryError } from "./engine";
export type { RunOptions, RunResult } from "./engine";
export type { ProgressEvent } from "./protocol";

let engine: RealcuganEngine | null = null;
let loading: Promise<RealcuganEngine> | null = null;

export function getEngine(): RealcuganEngine {
  engine ??= new RealcuganEngine();
  return engine;
}

/** Loads the engine once and reuses the same wasm instance afterwards. */
export function loadEngine(): Promise<RealcuganEngine> {
  loading ??= getEngine()
    .load(WASM_BASE_URL)
    .then(() => getEngine())
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });

  return loading;
}
