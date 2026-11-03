/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL the wasm artifacts (`realcugan.js/.wasm/.worker.js/.data`) are
   * served from. Defaults to `/wasm` (the copy bundled into `public/`).
   *
   * Point this at a CDN/R2 bucket to keep the static deploy tiny.
   */
  readonly VITE_WASM_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
