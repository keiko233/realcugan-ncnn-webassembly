cmake_minimum_required(VERSION 3.20)
project(realcugan-ncnn-webassembly LANGUAGES C CXX)

if(NOT EMSCRIPTEN)
    message(FATAL_ERROR
        "This project only builds the Real-CUGAN WebAssembly module. "
        "Run it through scripts/build-wasm.sh (Docker) or an activated emsdk toolchain.")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# ---------------------------------------------------------------------------
# ncnn
# ---------------------------------------------------------------------------
set(NCNN_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/ncnn" CACHE PATH "ncnn source directory")
if(NOT EXISTS "${NCNN_DIR}/CMakeLists.txt")
    message(FATAL_ERROR "ncnn not found at ${NCNN_DIR}. Run `git submodule update --init --recursive`.")
endif()

# A minimal, CPU-only, thread-enabled ncnn build that is friendly to wasm.
set(NCNN_VULKAN OFF CACHE BOOL "" FORCE)
set(NCNN_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(NCNN_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(NCNN_BUILD_BENCHMARK OFF CACHE BOOL "" FORCE)
set(NCNN_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(NCNN_BUILD_PYTHON OFF CACHE BOOL "" FORCE)
set(NCNN_THREADS ON CACHE BOOL "" FORCE)
set(NCNN_OPENMP OFF CACHE BOOL "" FORCE)
set(NCNN_SIMPLEOMP ON CACHE BOOL "" FORCE)
set(NCNN_RUNTIME_CPU OFF CACHE BOOL "" FORCE)
set(NCNN_SSE2 OFF CACHE BOOL "" FORCE)
set(NCNN_AVX OFF CACHE BOOL "" FORCE)
set(NCNN_AVX2 OFF CACHE BOOL "" FORCE)
set(NCNN_AVX512 OFF CACHE BOOL "" FORCE)
set(NCNN_PIXEL ON CACHE BOOL "" FORCE)
set(NCNN_STRING ON CACHE BOOL "" FORCE)
set(NCNN_STDIO ON CACHE BOOL "" FORCE)
set(NCNN_SYSTEM_GLSLANG OFF CACHE BOOL "" FORCE)

# ncnn and our own sources both need wasm SIMD + atomics (threads) enabled, so
# set them globally before ncnn is configured.
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -msimd128 -pthread")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -msimd128 -pthread")

add_subdirectory("${NCNN_DIR}" ncnn EXCLUDE_FROM_ALL)

# ncnn appends emscripten settings to the global CMAKE_*_FLAGS, which would then
# leak into our target (and fight with the values below). Strip them so the
# module is configured solely by `target_link_options`.
foreach(flag_var CMAKE_C_FLAGS CMAKE_CXX_FLAGS)
    string(REPLACE "-s FORCE_FILESYSTEM=1" "" ${flag_var} "${${flag_var}}")
    string(REPLACE "-s INITIAL_MEMORY=256MB" "" ${flag_var} "${${flag_var}}")
    string(REPLACE "-s EXIT_RUNTIME=1" "" ${flag_var} "${${flag_var}}")
endforeach()

# ---------------------------------------------------------------------------
# Real-CUGAN wasm module
# ---------------------------------------------------------------------------
set(MODELS_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../models")
if(NOT EXISTS "${MODELS_DIR}")
    message(FATAL_ERROR "models directory not found at ${MODELS_DIR}")
endif()

add_executable(realcugan src/main.cpp src/realcugan.cpp)
target_include_directories(realcugan PRIVATE src)
target_link_libraries(realcugan PRIVATE ncnn)

target_link_options(realcugan PRIVATE
    -O3
    -msimd128
    -pthread
    # Expose a clean ES-module friendly factory instead of a global `Module`.
    -sMODULARIZE=1
    -sEXPORT_NAME=createRealCuganModule
    # `_main` must stay exported: it starts the worker thread that owns the ncnn
    # model. Without it the linker treats main() as unreachable (--no-entry) and
    # garbage-collects the worker together with the whole ncnn inference code.
    -sEXPORTED_FUNCTIONS=_malloc,_free,_process_image,_main
    -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAPU32
    -sALLOW_MEMORY_GROWTH=1
    -sMAXIMUM_MEMORY=4GB
    -sINITIAL_MEMORY=64MB
    -sSTACK_SIZE=1MB
    -sPTHREAD_POOL_SIZE=navigator.hardwareConcurrency
    -sENVIRONMENT=web,worker
    -sEXIT_RUNTIME=0
    -sASSERTIONS=0
    # Bundle the model weights into a single cached .data payload.
    "--preload-file=${MODELS_DIR}@/models"
    -sFORCE_FILESYSTEM=1
    --use-preload-cache
)

set_target_properties(realcugan PROPERTIES OUTPUT_NAME realcugan SUFFIX ".js")
