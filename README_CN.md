# RealCUGAN-ncnn-webassembly

[English](./README.md) · [在线体验](https://real-cugan.animesales.xyz/)

本项目使用 WebAssembly 技术，基于 ncnn 在浏览器端运行 Real-CUGAN 模型，完全使用
本机 CPU 完成动漫图片超分辨率，图片不会上传到任何服务器，也不依赖服务器算力。

[Real-CUGAN](https://github.com/bilibili/ailab/tree/main/Real-CUGAN) 是一个使用百万级
动漫数据训练的、结构与 Waifu2x 兼容的通用动漫图像超分辨率模型。当前内置 2X 的三档
降噪权重（保守 / 无降噪 / 降噪 3x）与 3X 的降噪权重。

代码实现上深度参考了 nihui 大佬的
[realcugan-ncnn-vulkan](https://github.com/nihui/realcugan-ncnn-vulkan) 与
[ncnn-webassembly-nanodet](https://github.com/nihui/ncnn-webassembly-nanodet)。

## 使用要求

- 支持 WebAssembly SIMD 与多线程（`SharedArrayBuffer`，需要跨源隔离页面）的现代桌面浏览器。
- 目前不支持 iOS；Android 请在独立浏览器内打开。

## 项目结构

这是一个 pnpm workspace，分为两部分：

| 路径        | 说明                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| `native/`   | CMake 工程，负责把 Real-CUGAN 编译为 WebAssembly 模块（`realcugan.js` / `.wasm` / `.data`）。 |
| `apps/web/` | Vite + React + TanStack Router / Query 前端，使用 Tailwind CSS 与 shadcn/ui 定制界面。        |
| `models/`   | Real-CUGAN 权重，会预加载进 wasm 虚拟文件系统。                                               |
| `scripts/`  | 构建脚本（目前是 wasm 构建脚本）。                                                            |

前端通过一层完整类型化的封装（`apps/web/src/lib/wasm/`）与 wasm 模块通信，并用 zod
在运行时校验回调协议。界面文案使用 [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) 做国际化。

## 构建

前置要求：Node.js >= 22、[pnpm](https://pnpm.io)，以及 CMake（仅构建 wasm 时需要）。

```shell
git clone --recurse-submodules https://github.com/keiko233/realcugan-ncnn-webassembly.git
cd realcugan-ncnn-webassembly

pnpm install
pnpm wasm:build     # 构建 native/ 并把产物复制到 apps/web/public/wasm
pnpm dev            # http://localhost:5173
```

`pnpm wasm:build` 使用以浅克隆 submodule 形式内置的 Emscripten SDK
（`native/third_party/emsdk`），首次运行会下载并激活工具链，因此需要网络。设置
`USE_DOCKER=1` 可改为在官方 `emscripten/emsdk` 镜像中构建。

wasm 产物属于构建输出，已被 git 忽略——在 `pnpm build` 或部署前请先执行
`pnpm wasm:build`。

## 部署

本项目是纯静态站点。`apps/web/wrangler.jsonc` 提供了 Cloudflare Workers 静态资源
部署配置：

```shell
pnpm deploy                          # pnpm build + wrangler deploy
pnpm --filter @realcugan/web cf:dev  # 构建 + 本地 Workers 运行时
```

`apps/web/public/_headers` 中携带多线程所需的 `Cross-Origin-Opener-Policy` /
`Cross-Origin-Embedder-Policy` 响应头，部署到其它平台时请保留。任意静态托管均可使用：
执行 `pnpm build` 后发布 `apps/web/dist` 即可。

若想把 wasm 资源放到 CDN 或 R2 存储桶，可在构建时设置 `VITE_WASM_BASE_URL`。

## 致谢

模型来自 [bilibili/ailab](https://github.com/bilibili/ailab)（Real-CUGAN），推理框架为
[Tencent/ncnn](https://github.com/Tencent/ncnn)，编译工具链为
[Emscripten](https://emscripten.org)。
