"""
Cut a sprite sheet into individual sprite PNGs without assuming a grid.

Logic:
  1. Treat fully transparent rows/columns as separators.
  2. Find horizontal "bands" = groups of consecutive rows that contain any
     opaque pixel.
  3. Inside each band, find vertical "groups" = consecutive columns that
     contain any opaque pixel. Each (band, group) is one sprite.
  4. Crop each sprite to its tight opaque bbox.
  5. Across all sprites take the maximum width and the maximum height. That
     is the common output size.
  6. Re-export each sprite centred on a transparent max_w × max_h canvas so
     every output PNG has the SAME dimensions, with shorter sprites padded.

Outputs to <output-dir>/<stem>_b{band}_g{group}.png — naming reflects the
input filename and position in the sheet (top-to-bottom band, then
left-to-right group).

Requires: Pillow + numpy   →   pip install Pillow numpy
Run:      python3 cut_sprites.py [input.png] [-o OUTPUT_DIR]

  python3 cut_sprites.py                            # default: public/sprites/cat.png
  python3 cut_sprites.py public/sprites/foo.png     # custom input
  python3 cut_sprites.py foo.png -o out/foo         # custom input + output dir
"""

from __future__ import annotations

import argparse
import os
from typing import List, Tuple

import numpy as np
from PIL import Image

DEFAULT_INPUT = "public/sprites/cat.png"
DEFAULT_OUTPUT_DIR = "public/sprites/cut"
ALPHA_THRESHOLD = 8  # pixels with alpha <= this are treated as background


def find_runs(bool_arr: np.ndarray) -> List[Tuple[int, int]]:
    """Return (start, end_excl) for each contiguous True run."""
    runs: List[Tuple[int, int]] = []
    n = len(bool_arr)
    i = 0
    while i < n:
        if bool_arr[i]:
            j = i + 1
            while j < n and bool_arr[j]:
                j += 1
            runs.append((i, j))
            i = j
        else:
            i += 1
    return runs


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Cut a sprite sheet into per-sprite PNGs.")
    p.add_argument(
        "input",
        nargs="?",
        default=DEFAULT_INPUT,
        help=f"Input PNG path (default: {DEFAULT_INPUT})",
    )
    p.add_argument(
        "-o", "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    input_path = args.input
    output_dir = args.output_dir
    stem = os.path.splitext(os.path.basename(input_path))[0]

    if not os.path.exists(input_path):
        raise SystemExit(f"Input not found: {input_path}")

    img = Image.open(input_path).convert("RGBA")
    W, H = img.size
    print(f"Sheet ({input_path}): {W}x{H}")

    mask = np.array(img)[..., 3] > ALPHA_THRESHOLD  # (H, W) bool

    # Step 1+2: row bands → spans of rows with any opaque pixel.
    row_has = mask.any(axis=1)
    bands = find_runs(row_has)
    print(f"Detected {len(bands)} horizontal band(s).")

    # Step 3: within each band, column groups.
    bboxes: List[Tuple[int, int, Tuple[int, int, int, int]]] = []
    for b_idx, (y0, y1) in enumerate(bands):
        band_mask = mask[y0:y1, :]
        col_has = band_mask.any(axis=0)
        groups = find_runs(col_has)
        for g_idx, (x0, x1) in enumerate(groups):
            sub = mask[y0:y1, x0:x1]
            ys, xs = np.where(sub)
            min_x = x0 + int(xs.min())
            max_x = x0 + int(xs.max())
            min_y = y0 + int(ys.min())
            max_y = y0 + int(ys.max())
            bboxes.append((b_idx, g_idx, (min_x, min_y, max_x + 1, max_y + 1)))

    if not bboxes:
        raise SystemExit("No sprites found — is the sheet fully transparent?")

    # Step 4+5: max size across all sprites.
    max_w = max(bbox[2] - bbox[0] for _, _, bbox in bboxes)
    max_h = max(bbox[3] - bbox[1] for _, _, bbox in bboxes)
    print(f"Detected {len(bboxes)} sprite(s). Common output size: {max_w}x{max_h}")

    # Step 6: re-export centred on common-size canvas.
    os.makedirs(output_dir, exist_ok=True)
    for b_idx, g_idx, bbox in bboxes:
        sprite = img.crop(bbox)
        sw, sh = sprite.size
        canvas = Image.new("RGBA", (max_w, max_h), (0, 0, 0, 0))
        off_x = (max_w - sw) // 2
        off_y = (max_h - sh) // 2
        canvas.paste(sprite, (off_x, off_y))
        out = os.path.join(output_dir, f"{stem}_b{b_idx}_g{g_idx}.png")
        canvas.save(out)

    print(f"Wrote {len(bboxes)} file(s) to {output_dir}/ — each {max_w}x{max_h}")


if __name__ == "__main__":
    main()
