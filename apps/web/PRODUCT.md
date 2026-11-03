# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who need to upscale anime-style artwork, screenshots or frames but will not hand
the image to a server. Whether this is a public tool or a personal one is undecided.

## Product Purpose

Real-CUGAN anime image super-resolution that runs entirely in the browser: bring an
image, choose a scale and denoise profile, get an upscaled result. No account, no
upload, no server compute.

## Positioning

Local WebAssembly inference on the visitor's own CPU. A cloud upscaler cannot
truthfully copy the privacy claim or the offline operation.

## Operating Context

- Static hosting (Cloudflare Workers static assets first); no backend.
- wasm module plus ~12 MB of weights, fetched once and cached.
- Needs WebAssembly SIMD and threads, so the document must be cross-origin isolated
  (COOP/COEP). iOS is unsupported.
- One image costs ~1.6 GB of memory and saturates the CPU for seconds to minutes, so
  progress has to be visible.

## Capabilities and Constraints

Weights: 2X conservative / no-denoise / denoise 3x, and 3X denoise 3x. Input PNG /
JPEG / WebP / BMP, output PNG. Comparison modes: overlay, side by side, stacked.
Options persist locally. Undecided: 4X and TTA, the demo link, a public deployment.

## Brand Commitments

The name Real-CUGAN and the attribution to bilibili/ailab, Tencent/ncnn and Emscripten
stay. "Images never leave the device" is a product claim, not marketing copy. MIT
licensed; fork of `hanFengSan/realcugan-ncnn-webassembly`.

## Evidence on Hand

`apps/web/public/test-img.jpg` (bundled sample), `models/` (the real weights). No usage
data, testimonials, benchmarks or press — do not invent any.

## Product Principles

1. The privacy claim is structural: a feature that needs an upload does not ship.
2. Show the work; local CPU inference is the product.
3. The comparison is the payoff.
4. Never make the visitor configure their way to a good default.

## Accessibility & Inclusion

No product-specific requirement established.
