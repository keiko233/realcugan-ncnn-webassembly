import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Real-CUGAN runs on multiple threads via SharedArrayBuffer, which browsers only
// expose in a cross-origin isolated context. The dev/preview servers set the
// same headers that the Cloudflare deployment serves from `public/_headers`.
const crossOriginIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      emitTsDeclarations: true,
      // A locale switch must not reload the page: the wasm engine and the user's
      // current image only live in memory.
      strategy: ["localStorage", "preferredLanguage", "baseLocale"],
    }),
    tailwindcss(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  build: {
    target: "es2022",
    // The wasm payload is served from `public/` and must not be inlined.
    assetsInlineLimit: 0,
  },
});
