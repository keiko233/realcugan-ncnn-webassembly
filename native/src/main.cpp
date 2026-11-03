// WebAssembly entry point for the Real-CUGAN ncnn pipeline.
//
// Images are handed in from JavaScript as RGBA byte buffers. A single worker
// thread keeps the loaded ncnn::Net alive between jobs so that repeated runs do
// not pay the (expensive) model loading cost every time.
//
// Progress is reported back to JavaScript by printing one JSON line per event
// prefixed with "$CALLBACK$" to stdout, which Emscripten forwards to the
// `print` handler configured in the frontend loader.

#include <chrono>
#include <cstdlib>
#include <iostream>
#include <string>
#include <thread>

#include <cpu.h>
#include <net.h>

#include "realcugan.h"

namespace {

constexpr const char *kCallbackPrefix = "$CALLBACK$";

struct Task {
    int image_id = 0;
    unsigned char *input = nullptr;
    unsigned char *output = nullptr;
    int width = 0;
    int height = 0;
    int scale = 2;
    int noise = 3;
};

ncnn::Mutex g_task_lock;
ncnn::ConditionVariable g_task_condition;
Task *g_task = nullptr;

ncnn::Mutex g_finish_lock;
ncnn::ConditionVariable g_finish_condition;

RealCUGAN *g_realcugan = nullptr;

void emit(const std::string &payload) {
    std::cout << kCallbackPrefix << payload << std::endl;
}

void report_finished(int image_id, long cost) {
    emit(std::string("{\"eventType\":\"PROC_END\",\"image_id\":") + std::to_string(image_id) +
         ",\"cost\":" + std::to_string(cost) + "}");
}

// Drop the alpha channel in place so the intermediate RGB buffer stays small
// enough to fit comfortably inside the wasm heap.
void remove_alpha_channel(unsigned char *image_data, int w, int h) {
    for (int i = 0; i < w * h; i++) {
        image_data[i * 3] = image_data[i * 4];
        image_data[i * 3 + 1] = image_data[i * 4 + 1];
        image_data[i * 3 + 2] = image_data[i * 4 + 2];
    }
}

void worker() {
    while (true) {
        g_task_lock.lock();
        while (g_task == nullptr) {
            g_task_condition.wait(g_task_lock);
        }

        const auto begin = std::chrono::steady_clock::now();

        if (g_realcugan == nullptr) {
            g_realcugan = new RealCUGAN();
            g_realcugan->load(g_task->scale, g_task->noise);
        } else if (g_realcugan->scale != g_task->scale || g_realcugan->noise != g_task->noise) {
            g_realcugan->load(g_task->scale, g_task->noise);
        }

        ncnn::Mat in_image =
                ncnn::Mat(g_task->width, g_task->height, static_cast<void *>(g_task->input), 3, 3);
        ncnn::Mat out_image = ncnn::Mat(in_image.w * g_realcugan->scale, in_image.h * g_realcugan->scale, 3, 3);

        // Tiles are streamed into the caller's RGBA buffer as they finish, so
        // no final copy is needed.
        g_realcugan->process(in_image, out_image, g_task->output);

        const auto end = std::chrono::steady_clock::now();
        const auto cost = std::chrono::duration_cast<std::chrono::milliseconds>(end - begin).count();
        report_finished(g_task->image_id, static_cast<long>(cost));

        delete g_task;
        g_task = nullptr;
        g_task_lock.unlock();

        g_finish_lock.lock();
        g_finish_condition.signal();
        g_finish_lock.unlock();
    }
}

} // namespace

// Declared in realcugan.h and called from the inference loop.
void realcugan_report_progress(long total_cost, long tile_cost, float progress_rate, int tile_x, int tile_y,
                               int tile_w, int tile_h) {
    long remaining_time = 0;
    if (progress_rate > 0.f) {
        remaining_time = static_cast<long>(static_cast<float>(total_cost) / progress_rate) - total_cost;
    }

    emit(std::string("{\"eventType\":\"PROC_PROGRESS\",\"total_cost\":") + std::to_string(total_cost) +
         ",\"tile_cost\":" + std::to_string(tile_cost) + ",\"progress_rate\":" + std::to_string(progress_rate) +
         ",\"remaining_time\":" + std::to_string(remaining_time) + ",\"tile_x\":" + std::to_string(tile_x) +
         ",\"tile_y\":" + std::to_string(tile_y) + ",\"tile_w\":" + std::to_string(tile_w) +
         ",\"tile_h\":" + std::to_string(tile_h) + "}");
}

extern "C" {

// Kick off processing of a single RGBA image. Returns 0 on success and -1 when a
// previous job is still running.
int process_image(int image_id, unsigned char *input_image_data, unsigned char *output_image_data, int input_w,
                  int input_h, int scale, int noise) {
    g_task_lock.lock();

    if (g_task != nullptr) {
        g_task_lock.unlock();
        return -1;
    }

    remove_alpha_channel(input_image_data, input_w, input_h);

    auto *task = new Task();
    task->image_id = image_id;
    task->input = input_image_data;
    task->output = output_image_data;
    task->width = input_w;
    task->height = input_h;
    task->scale = scale;
    task->noise = noise;
    g_task = task;

    g_task_lock.unlock();
    g_task_condition.signal();
    return 0;
}

} // extern "C"

int main() {
    ncnn::set_cpu_powersave(2);
    ncnn::set_omp_num_threads(ncnn::get_big_cpu_count());

    std::thread(worker).detach();

    // Returning from main keeps the runtime alive (EXIT_RUNTIME is disabled) and
    // leaves the worker thread parked waiting for the next job.
    return 0;
}
