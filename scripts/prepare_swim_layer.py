#!/usr/bin/env python3
"""Prepare the native 20 ppd SWIM 0–1 m consistency raster for the globe.

Set RED_ROCK_SWIM_SOURCE to the downloaded SWIM4MIM_Ci_0_1.tif path. The
script keeps the source's -30 no-data mask transparent, preserves signed
consistency values, and writes a full equirectangular texture without
resampling the source pixels.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend" / "public" / "terrain" / "layers" / "swim-ice-consistency.webp"
LAYER_MANIFEST = ROOT / "frontend" / "public" / "terrain" / "layers" / "manifest.json"
SOURCE_DEFAULT = ROOT / "data" / "mars" / "raw" / "swim_water_ice" / "SWIM4MIM_Ci_0_1.tif"
WIDTH = 7200
SOURCE_HEIGHT = 2400
FULL_HEIGHT = 3600
SOURCE_LATITUDE_LIMIT = 60
NO_DATA = -30.0
SOURCE_URL = "https://swim.psi.edu/SWIM4MIMProducts.php"
CITATION = "Putzig et al., Refined Mapping of Subsurface Water Ice on Mars to Support Future Missions, Planetary Science Journal (2025), doi:10.3847/PSJ/ad9b24."

# Sequential palette with a clear boundary at Ci=0.3, the published positive
# indicator threshold for this depth band. Colors indicate consistency only.
STOPS = (
    (-0.4, (33, 37, 48)),
    (0.0, (59, 91, 126)),
    (0.3, (48, 160, 180)),
    (0.6, (124, 207, 187)),
    (1.0, (247, 218, 132)),
)


def main() -> int:
    source_path = Path(os.environ.get("RED_ROCK_SWIM_SOURCE", str(SOURCE_DEFAULT)))
    if not source_path.is_file():
        raise FileNotFoundError(
            f"SWIM source not found at {source_path}; set RED_ROCK_SWIM_SOURCE to the downloaded source TIFF."
        )

    with Image.open(source_path) as source_image:
        if source_image.size != (WIDTH, SOURCE_HEIGHT):
            raise ValueError(f"Unexpected SWIM TIFF shape {source_image.size}; expected {(WIDTH, SOURCE_HEIGHT)}")
        source = np.asarray(source_image.convert("F"), dtype=np.float32)
        tags = source_image.tag_v2
        tif_nodata = tags.get(42113)
        if tif_nodata is not None and float(tif_nodata) != NO_DATA:
            raise ValueError(f"Unexpected SWIM no-data sentinel {tif_nodata}")

    # The TIFF geotransform starts at x=-half the Mars circumference with a
    # zero-degree central meridian, so its columns already run -180E to 180E
    # and match the frontend's left-edge longitude convention.
    full = np.full((FULL_HEIGHT, WIDTH), NO_DATA, dtype=np.float32)
    first_row = (90 - SOURCE_LATITUDE_LIMIT) * 20
    full[first_row : first_row + SOURCE_HEIGHT] = source
    valid = np.isfinite(full) & (full != NO_DATA)

    values = np.array([item[0] for item in STOPS], dtype=np.float32)
    colors = np.array([item[1] for item in STOPS], dtype=np.float32)
    rgb = np.empty((FULL_HEIGHT, WIDTH, 3), dtype=np.uint8)
    for channel in range(3):
        rgb[..., channel] = np.clip(np.interp(full, values, colors[:, channel]), 0, 255).astype(np.uint8)
    rgba = np.zeros((FULL_HEIGHT, WIDTH, 4), dtype=np.uint8)
    rgba[..., :3] = rgb
    rgba[..., 3] = np.where(valid, 255, 0).astype(np.uint8)
    rgba[~valid, :3] = 0

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(OUTPUT, "WEBP", lossless=True, method=6)

    manifest = json.loads(LAYER_MANIFEST.read_text(encoding="utf-8"))
    manifest["layers"] = [item for item in manifest["layers"] if item["id"] != "ice-consistency"]
    valid_source = np.isfinite(source) & (source != NO_DATA)
    manifest["layers"].append({
        "id": "ice-consistency",
        "title": "SWIM 0–1 m ice consistency",
        "url": "/terrain/layers/swim-ice-consistency.webp",
        "file": "frontend/public/terrain/layers/swim-ice-consistency.webp",
        "format": "webp",
        "dimensions": [WIDTH, FULL_HEIGHT],
        "sourceDimensions": [WIDTH, SOURCE_HEIGHT],
        "longitudeRange": [-180, 180],
        "latitudeCoverage": [-60, 60],
        "sourceLatitudeCoverage": [-60, 60],
        "noDataTreatment": "Source -30 sentinel and polar regions are transparent; no-data is not interpolated.",
        "productType": "Subsurface ice consistency index for the 0–1 m depth band",
        "valueMeaning": "Signed dimensionless SWIM Ci; higher consistency is an indicator, not a calibrated probability or water quantity.",
        "source": "NASA SWIM 4MIM; SWIM4MIM_Ci_0_1.tif",
        "sourceUrl": SOURCE_URL,
        "citation": CITATION,
        "resolution": "20 ppd source · approximately 2.96 km/pixel at the equator",
        "threshold": {"value": 0.3, "label": "Published positive ice-consistency indicator threshold; not a probability cutoff"},
        "dataRange": [float(source[valid_source].min()), float(source[valid_source].max())],
    })
    LAYER_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {OUTPUT.relative_to(ROOT)} from {source_path}")
    print(f"Source native grid: {WIDTH}x{SOURCE_HEIGHT} at 20 ppd; valid pixels: {int(valid.sum()):,}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"[error] {error}", file=sys.stderr)
        raise SystemExit(1)
