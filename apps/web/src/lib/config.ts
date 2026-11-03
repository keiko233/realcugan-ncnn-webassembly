/** Where the emscripten artifacts live. Trailing slash is trimmed. */
export const WASM_BASE_URL = (import.meta.env.VITE_WASM_BASE_URL ?? "/wasm").replace(/\/+$/, "");

/** Bundled demo image shipped in `public/`. */
export const SAMPLE_IMAGE_URL = "/test-img.jpg";
