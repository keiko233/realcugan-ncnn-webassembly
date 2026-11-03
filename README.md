# RealCUGAN-ncnn-webassembly

[中文](./README_CN.md) · [Live demo](https://real-cugan.animesales.xyz/)

Run [Real-CUGAN](https://github.com/bilibili/ailab/tree/main/Real-CUGAN) anime
super-resolution entirely in the browser. The model is compiled to WebAssembly
with Emscripten and runs on the local CPU via [ncnn](https://github.com/Tencent/ncnn),
so images are never uploaded and no server compute is involved.

Real-CUGAN is a general-purpose anime super-resolution model trained on a
million-scale anime dataset, architecturally compatible with Waifu2x. The
bundled weights cover 2X (conservative / no-denoise / denoise 3x) and 3X
(denoise 3x).

The implementation closely follows
[realcugan-ncnn-vulkan](https://github.com/nihui/realcugan-ncnn-vulkan) and
[ncnn-webassembly-nanodet](https://github.com/nihui/ncnn-webassembly-nanodet).

## Requirements

- A modern desktop browser with WebAssembly SIMD and threads
  (`SharedArrayBuffer`, which needs a cross-origin isolated document).
- iOS is not supported. On Android, open the site in a standalone browser.

## Architecture

This is a pnpm workspace with two halves:

| Path        | What it is                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `native/`   | CMake project that builds the Real-CUGAN WebAssembly module (`realcugan.js` / `.wasm` / `.data`). |
| `apps/web/` | Vite + React + TanStack Router/Query frontend, styled with Tailwind CSS and shadcn/ui.            |
| `models/`   | Real-CUGAN weights, preloaded into the wasm virtual filesystem.                                   |
| `scripts/`  | Build helpers (currently the wasm build script).                                                  |

The frontend talks to the wasm module through a small, fully typed layer
(`apps/web/src/lib/wasm/`) that validates the callback protocol at runtime with
zod. UI copy is localised with [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs).

## Building

Prerequisites: Node.js >= 22, [pnpm](https://pnpm.io), and CMake (only for the
wasm build).

```shell
git clone --recurse-submodules https://github.com/keiko233/realcugan-ncnn-webassembly.git
cd realcugan-ncnn-webassembly

pnpm install
pnpm wasm:build     # builds native/ and copies the artifacts into apps/web/public/wasm
pnpm dev            # http://localhost:5173
```

`pnpm wasm:build` uses the Emscripten SDK that is vendored as a shallow git
submodule (`native/third_party/emsdk`); the first run downloads and activates
the toolchain, so it needs network access. Set `USE_DOCKER=1` to build inside
the official `emscripten/emsdk` image instead.

The wasm artifacts are build outputs and are git-ignored — always run
`pnpm wasm:build` before `pnpm build` or a deploy.

## Deployment

The site is fully static. `apps/web/wrangler.jsonc` configures a Cloudflare
Workers static-assets deployment:

```shell
pnpm deploy                       # pnpm build + wrangler deploy
pnpm --filter @realcugan/web cf:dev   # build + local Workers runtime
```

`apps/web/public/_headers` ships the `Cross-Origin-Opener-Policy` /
`Cross-Origin-Embedder-Policy` headers that threads require; keep them when
deploying to another host. Any static host works — build with `pnpm build` and
publish `apps/web/dist`.

To serve the wasm payload from a CDN or R2 bucket instead of the app origin, set
`VITE_WASM_BASE_URL` at build time.

## Credits

Model by [bilibili/ailab](https://github.com/bilibili/ailab) (Real-CUGAN),
inference by [Tencent/ncnn](https://github.com/Tencent/ncnn), toolchain by
[Emscripten](https://emscripten.org).
