#include "realcugan.h"

#include <algorithm>
#include <chrono>
#include <string>

#include <cpu.h>

namespace {

// Model files are preloaded into the Emscripten virtual filesystem here.
constexpr const char *kModelDir = "/models/";

std::string model_file_name(int scale, int noise, const char *extension) {
    if (noise == 0) {
        return std::string("up") + std::to_string(scale) + "x-no-denoise." + extension;
    }
    if (noise == -1) {
        return std::string("up") + std::to_string(scale) + "x-conservative." + extension;
    }
    return std::string("up") + std::to_string(scale) + "x-denoise" + std::to_string(noise) + "x." + extension;
}

int prepadding_for_scale(int scale) {
    switch (scale) {
        case 3:
            return 14;
        case 4:
            return 19;
        default:
            return 18;
    }
}

} // namespace

RealCUGAN::RealCUGAN() {
    const int cpu_count = ncnn::get_big_cpu_count();
    ncnn::set_cpu_powersave(2);
    ncnn::set_omp_num_threads(cpu_count);

    ncnnNet.opt = ncnn::Option();
    ncnnNet.opt.num_threads = cpu_count;
}

int RealCUGAN::load(int scaleOption, int noiseOption) {
    ncnnNet.clear();
    this->scale = scaleOption;
    this->noise = noiseOption;
    this->prepadding = prepadding_for_scale(scaleOption);

    const std::string param_path = std::string(kModelDir) + model_file_name(scaleOption, noiseOption, "param");
    const std::string bin_path = std::string(kModelDir) + model_file_name(scaleOption, noiseOption, "bin");

    ncnnNet.load_param(param_path.c_str());
    ncnnNet.load_model(bin_path.c_str());
    return 0;
}

// CPU-only tiled inference. The image is split into 200x200 tiles with an
// overlap ("prepadding") so that seams between tiles are invisible.
int RealCUGAN::process(const ncnn::Mat &inimage, ncnn::Mat &outimage, unsigned char *rgba_out) {
    const auto begin = std::chrono::steady_clock::now();
    const auto *pixeldata = static_cast<const unsigned char *>(inimage.data);
    const int w = inimage.w;
    const int h = inimage.h;
    const int channels = inimage.elempack;

    const int TILE_SIZE_X = tilesize;
    const int TILE_SIZE_Y = tilesize;

    const int xtiles = (w + TILE_SIZE_X - 1) / TILE_SIZE_X;
    const int ytiles = (h + TILE_SIZE_Y - 1) / TILE_SIZE_Y;

    for (int yi = 0; yi < ytiles; yi++) {
        const int tile_h_nopad = std::min((yi + 1) * TILE_SIZE_Y, h) - yi * TILE_SIZE_Y;

        int prepadding_bottom = prepadding;
        if (scale == 1 || scale == 3) {
            prepadding_bottom += (tile_h_nopad + 3) / 4 * 4 - tile_h_nopad;
        }
        if (scale == 2 || scale == 4) {
            prepadding_bottom += (tile_h_nopad + 1) / 2 * 2 - tile_h_nopad;
        }

        const int in_tile_y0 = std::max(yi * TILE_SIZE_Y - prepadding, 0);
        const int in_tile_y1 = std::min((yi + 1) * TILE_SIZE_Y + prepadding_bottom, h);

        for (int xi = 0; xi < xtiles; xi++) {
            const auto tile_begin = std::chrono::steady_clock::now();

            const int tile_w_nopad = std::min((xi + 1) * TILE_SIZE_X, w) - xi * TILE_SIZE_X;

            int prepadding_right = prepadding;
            if (scale == 1 || scale == 3) {
                prepadding_right += (tile_w_nopad + 3) / 4 * 4 - tile_w_nopad;
            }
            if (scale == 2 || scale == 4) {
                prepadding_right += (tile_w_nopad + 1) / 2 * 2 - tile_w_nopad;
            }

            const int in_tile_x0 = std::max(xi * TILE_SIZE_X - prepadding, 0);
            const int in_tile_x1 = std::min((xi + 1) * TILE_SIZE_X + prepadding_right, w);

            ncnn::Mat in;
            if (channels == 3) {
                in = ncnn::Mat::from_pixels_roi(pixeldata, ncnn::Mat::PIXEL_RGB, w, h, in_tile_x0, in_tile_y0,
                                                in_tile_x1 - in_tile_x0, in_tile_y1 - in_tile_y0);
            }

            // Normalise to [0,1] float, pad the borders, then run the network.
            ncnn::Mat in_tile;
            {
                in_tile.create(in.w, in.h, 3);
                for (int q = 0; q < 3; q++) {
                    const float *ptr = in.channel(q);
                    float *outptr = in_tile.channel(q);
                    for (int i = 0; i < in.w * in.h; i++) {
                        *outptr++ = *ptr++ * (1 / 255.f);
                    }
                }
            }

            {
                const int pad_top = std::max(prepadding - yi * TILE_SIZE_Y, 0);
                const int pad_bottom =
                        std::max(std::min((yi + 1) * TILE_SIZE_Y + prepadding_bottom - h, prepadding_bottom), 0);
                const int pad_left = std::max(prepadding - xi * TILE_SIZE_X, 0);
                const int pad_right = std::max(
                        std::min((xi + 1) * TILE_SIZE_X + prepadding_right - w, prepadding_right), 0);

                ncnn::Mat in_tile_padded;
                ncnn::copy_make_border(in_tile, in_tile_padded, pad_top, pad_bottom, pad_left, pad_right, 2, 0.f,
                                       ncnnNet.opt);
                in_tile = in_tile_padded;
            }

            ncnn::Mat out_tile;
            {
                ncnn::Extractor ex = ncnnNet.create_extractor();
                ex.input("in0", in_tile);
                ex.extract("out0", out_tile);
            }

            // Post-process the tile back into 8-bit RGB.
            ncnn::Mat out_tile_pixels;
            {
                out_tile_pixels.create(tile_w_nopad * scale, tile_h_nopad * scale, channels);
                if (scale == 4) {
                    for (int q = 0; q < 3; q++) {
                        float *outptr = out_tile_pixels.channel(q);
                        for (int i = 0; i < out_tile_pixels.h; i++) {
                            const float *inptr = in_tile.channel(q).row(prepadding + i / 4) + prepadding;
                            const float *ptr = out_tile.channel(q).row(i);
                            for (int j = 0; j < out_tile_pixels.w; j++) {
                                *outptr++ = *ptr++ * 255.f + 0.5f + inptr[j / 4] * 255.f;
                            }
                        }
                    }
                } else {
                    for (int q = 0; q < 3; q++) {
                        float *outptr = out_tile_pixels.channel(q);
                        for (int i = 0; i < out_tile_pixels.h; i++) {
                            const float *ptr = out_tile.channel(q).row(i);
                            for (int j = 0; j < out_tile_pixels.w; j++) {
                                *outptr++ = *ptr++ * 255.f + 0.5f;
                            }
                        }
                    }
                }
            }

            const int out_w = w * scale;
            const int out_x = xi * scale * TILE_SIZE_X;
            const int out_y = yi * scale * TILE_SIZE_Y;
            const int out_tile_w = tile_w_nopad * scale;
            const int out_tile_h = tile_h_nopad * scale;

            if (channels == 3) {
                out_tile_pixels.to_pixels(
                        static_cast<unsigned char *>(outimage.data) + out_y * out_w * channels + out_x * channels,
                        ncnn::Mat::PIXEL_RGB, out_w * channels);

                // Stream the finished tile straight into the caller's RGBA
                // buffer so the frontend can preview the result while the rest
                // of the image is still being computed.
                if (rgba_out != nullptr) {
                    const auto *src = static_cast<const unsigned char *>(outimage.data);
                    for (int row = 0; row < out_tile_h; row++) {
                        const unsigned char *src_row = src + ((out_y + row) * out_w + out_x) * 3;
                        unsigned char *dst_row = rgba_out + ((out_y + row) * out_w + out_x) * 4;
                        for (int col = 0; col < out_tile_w; col++) {
                            dst_row[0] = src_row[0];
                            dst_row[1] = src_row[1];
                            dst_row[2] = src_row[2];
                            dst_row[3] = 255;
                            src_row += 3;
                            dst_row += 4;
                        }
                    }
                }
            }

            const auto tile_end = std::chrono::steady_clock::now();
            const auto tile_cost =
                    std::chrono::duration_cast<std::chrono::milliseconds>(tile_end - tile_begin).count();
            const auto total_cost =
                    std::chrono::duration_cast<std::chrono::milliseconds>(tile_end - begin).count();
            const float progress_rate =
                    static_cast<float>(xtiles * yi + xi + 1) / static_cast<float>(xtiles * ytiles);
            realcugan_report_progress(static_cast<long>(total_cost), static_cast<long>(tile_cost), progress_rate,
                                      out_x, out_y, out_tile_w, out_tile_h);
        }
    }

    return 0;
}
