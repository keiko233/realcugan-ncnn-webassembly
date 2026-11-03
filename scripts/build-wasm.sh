#!/usr/bin/env bash
#
# Build the Real-CUGAN WebAssembly module and drop the artifacts into the web
# app's public folder so Vite copies them into the static build.
#
# The Emscripten SDK is vendored as a shallow git submodule, so this works
# without a pre-installed emsdk. The first run downloads the toolchain.
#
# Usage:
#   scripts/build-wasm.sh
#
# Env:
#   EMSDK_VERSION   Emscripten version to install (default: 6.0.13)
#   OUT_DIR         Where to copy the artifacts (default: apps/web/public/wasm)
#   USE_DOCKER=1    Build inside the official Emscripten Docker image instead
#   EMSDK_IMAGE     Docker image to use when USE_DOCKER=1

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMSDK_VERSION="${EMSDK_VERSION:-6.0.13}"
EMSDK_IMAGE="${EMSDK_IMAGE:-emscripten/emsdk:${EMSDK_VERSION}}"
EMSDK_DIR="$ROOT/native/third_party/emsdk"
BUILD_DIR="$ROOT/native/build"
OUT_DIR="${OUT_DIR:-$ROOT/apps/web/public/wasm}"

echo "==> Ensuring submodules are present"
git -C "$ROOT" submodule update --init --depth 1 \
    native/third_party/ncnn \
    native/third_party/emsdk

# emsdk requires Python >= 3.10, which is newer than the python3 that ships with
# the macOS command line tools. Pick the first interpreter that is new enough.
if [ -z "${EMSDK_PYTHON:-}" ]; then
    for candidate in /opt/homebrew/bin/python3 /usr/local/bin/python3 python3 python3.13 python3.12 python3.11 python3.10; do
        if command -v "$candidate" >/dev/null 2>&1; then
            version="$("$candidate" -c 'import sys; print(sys.version_info[0] * 100 + sys.version_info[1])' 2>/dev/null || echo 0)"
            if [ "$version" -ge 310 ]; then
                export EMSDK_PYTHON="$candidate"
                break
            fi
        fi
    done
fi
if [ -n "${EMSDK_PYTHON:-}" ]; then
    echo "==> Using python: $EMSDK_PYTHON"
fi

echo "==> Building wasm module (emscripten ${EMSDK_VERSION})"
if [ "${USE_DOCKER:-0}" = "1" ]; then
    docker run --rm \
        -v "$ROOT:/src" \
        -w /src \
        -e EM_CACHE=/src/native/build/.emcache \
        "$EMSDK_IMAGE" \
        bash -lc '
            set -euo pipefail
            emcmake cmake -S native -B native/build -DCMAKE_BUILD_TYPE=Release
            cmake --build native/build --parallel
        '
else
    if [ ! -x "$EMSDK_DIR/emsdk" ]; then
        echo "!! emsdk not found at $EMSDK_DIR" >&2
        exit 1
    fi
    (cd "$EMSDK_DIR" && ./emsdk install "$EMSDK_VERSION" && ./emsdk activate "$EMSDK_VERSION")
    # shellcheck disable=SC1091
    source "$EMSDK_DIR/emsdk_env.sh" >/dev/null

    emcmake cmake -S "$ROOT/native" -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
    cmake --build "$BUILD_DIR" --parallel
fi

echo "==> Copying artifacts to $OUT_DIR"
mkdir -p "$OUT_DIR"
for f in realcugan.js realcugan.wasm realcugan.data; do
    if [ ! -f "$BUILD_DIR/$f" ]; then
        echo "!! Missing build artifact: $BUILD_DIR/$f" >&2
        exit 1
    fi
    cp "$BUILD_DIR/$f" "$OUT_DIR/$f"
done

# Older emscripten versions emit a separate pthread worker script; copy it when
# present (newer versions reuse the main JS as the worker).
if [ -f "$BUILD_DIR/realcugan.worker.js" ]; then
    cp "$BUILD_DIR/realcugan.worker.js" "$OUT_DIR/realcugan.worker.js"
fi

echo "==> Done"
ls -lh "$OUT_DIR"
