#ifndef REALCUGAN_H
#define REALCUGAN_H

#include <string>

#include "net.h"

// Implemented in main.cpp. Reports tile-level progress back to JavaScript.
// `tile_*` describe the rectangle that just finished, in output pixels, so the
// frontend can paint the partial result without waiting for the whole image.
void realcugan_report_progress(long total_cost, long tile_cost, float progress_rate, int tile_x, int tile_y,
                               int tile_w, int tile_h);

class RealCUGAN {
public:
    RealCUGAN();

    // (Re)loads the model weights for the requested scale (2/3/4) and denoise
    // level (0 = no denoise, -1 = conservative, N = denoise Nx).
    int load(int scale, int noise);

    // `rgba_out` is optional. When given, every finished tile is copied into it
    // immediately (RGB -> RGBA) so a preview can be streamed while the run is
    // still in progress.
    int process(const ncnn::Mat &inimage, ncnn::Mat &outimage, unsigned char *rgba_out = nullptr);

    int noise = 3;
    int scale = 2;
    int prepadding = 18;
    int tilesize = 200;
    int syncgap = 0;
    bool tta_mode = false;

private:
    ncnn::Net ncnnNet;
};

#endif // REALCUGAN_H
