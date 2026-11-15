#!/usr/bin/env python3
"""Prepare native-resolution ASU THEMIS Day IR patches for RED ROCK regions.

The source is ASU's 100 m global mosaic, distributed as 60x30 degree PGM
tiles. HTTP byte ranges retrieve only the row bands needed for the five 6x6
degree mission regions, avoiding multi-gigabyte whole-tile downloads. Output
patches preserve the source's black no-data mask and use the same relative
brightness ramp as the global Day IR layer.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "frontend" / "public" / "terrain" / "manifest.json"
LAYER_MANIFEST = ROOT / "frontend" / "public" / "terrain" / "layers" / "manifest.json"
OUTPUT_ROOT = ROOT / "frontend" / "public" / "terrain" / "patches"
BASE_URL = "https://www.mars.asu.edu/data/thm_dir_100m/large"
PIXELS_PER_DEGREE = 592.75
TILE_WIDTH_MAX = 35566
TILE_HEIGHT_MAX = 17783
USER_AGENT = "RED-ROCK Mars map regional layer preparation/1.0"

THERMAL_STOPS = (
    (0.00, (9, 8, 28)),
    (0.15, (43, 17, 70)),
    (0.32, (107, 28, 82)),
    (0.50, (178, 49, 58)),
    (0.68, (231, 98, 39)),
    (0.84, (250, 176, 66)),
    (1.00, (255, 246, 208)),
)


def tile_name(south_edge: float, lon_west: float) -> str:
    lat = int(south_edge)
    lat_label = f"{lat:02d}" if lat >= 0 else f"-{abs(lat):02d}"
    return f"lat{lat_label}_lon{int(lon_west):03d}.pgm"


def parse_pgm_header(session: requests.Session, url: str) -> tuple[int, int, int]:
    response = session.get(url, headers={"Range": "bytes=0-255"}, timeout=90)
    if response.status_code != 206:
        raise RuntimeError(f"ASU server did not honor byte range for {url}")
    content_range = response.headers.get("Content-Range", "")
    if not content_range.startswith("bytes 0-"):
        raise RuntimeError(f"Unexpected Content-Range while reading {url}: {content_range}")
    raw = response.content
    if not raw.startswith(b"P5\n"):
        raise RuntimeError(f"ASU tile is not an 8-bit binary PGM: {url}")
    match = re.match(rb"P5\s+(\d+)\s+(\d+)\s+255\s", raw)
    if not match:
        raise RuntimeError(f"Could not parse PGM dimensions from {url}")
    width, height = map(int, match.groups())
    if not (0 < width <= TILE_WIDTH_MAX and 0 < height <= TILE_HEIGHT_MAX):
        raise RuntimeError(f"Unexpected PGM dimensions {(width, height)} in {url}")
    return match.end(), width, height


def source_crop(session: requests.Session, patch: dict[str, object]) -> Image.Image:
    bounds = patch["bounds"]
    west, east = float(bounds["west"]), float(bounds["east"])
    west %= 360
    east %= 360
    if east <= west:
        east += 360
    north, south = float(bounds["north"]), float(bounds["south"])
    if east <= west:
        raise RuntimeError(f"Dateline-crossing region not supported: {patch['id']}")

    lon_west = (int(west // 60) * 60) % 360
    tile_south = min(60, max(-90, int((south + 1e-9) // 30) * 30))
    north_edge = tile_south + 30
    if south < tile_south or north > north_edge or west < lon_west or east > lon_west + 60:
        raise RuntimeError(f"Region crosses a published 100 m tile boundary: {patch['id']}")

    filename = tile_name(tile_south, lon_west)
    url = f"{BASE_URL}/{filename}"
    header_bytes, tile_width, tile_height = parse_pgm_header(session, url)
    left = max(0, round((west - lon_west) * PIXELS_PER_DEGREE))
    right = min(tile_width, round((east - lon_west) * PIXELS_PER_DEGREE))
    top = max(0, round((north_edge - north) * PIXELS_PER_DEGREE))
    bottom = min(tile_height, round((north_edge - south) * PIXELS_PER_DEGREE))
    if left >= right or top >= bottom:
        raise RuntimeError(f"Calculated empty image window for {patch['id']}")

    byte_start = header_bytes + top * tile_width
    byte_end = header_bytes + bottom * tile_width - 1
    response = session.get(
        url,
        headers={"Range": f"bytes={byte_start}-{byte_end}"},
        timeout=(30, 240),
    )
    if response.status_code != 206:
        raise RuntimeError(f"ASU server did not honor regional byte range for {filename}")
    expected = (bottom - top) * tile_width
    if len(response.content) != expected:
        raise RuntimeError(f"Short ASU range for {filename}: {len(response.content)} != {expected}")

    patch_width = right - left
    patch_height = bottom - top
    cropped = bytearray(patch_width * patch_height)
    source = memoryview(response.content)
    for row in range(patch_height):
        source_row = row * tile_width
        target_row = row * patch_width
        cropped[target_row : target_row + patch_width] = source[source_row + left : source_row + right]
    del source
    del response
    return Image.frombytes("L", (patch_width, patch_height), bytes(cropped))


def colorize_day_ir(source: Image.Image) -> Image.Image:
    gray = np.asarray(source, dtype=np.uint8)
    stops = np.array([item[0] for item in THERMAL_STOPS], dtype=np.float32)
    values = np.linspace(0.0, 1.0, 256, dtype=np.float32)
    ramp = np.stack(
        [np.interp(values, stops, np.array([item[1][channel] for item in THERMAL_STOPS])) for channel in range(3)],
        axis=1,
    ).astype(np.uint8)
    rgba = np.zeros((*gray.shape, 4), dtype=np.uint8)
    rgba[..., :3] = ramp[gray]
    rgba[..., 3] = np.where(gray > 0, 255, 0).astype(np.uint8)
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "image/x-portable-graymap"})
    total_bytes = 0
    patch_records = manifest.get("patches", {})
    layer_patch_records = []

    for patch_id, record in patch_records.items():
        destination = OUTPUT_ROOT / patch_id / "themis-day-ir-100m.webp"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.is_file():
            with Image.open(destination) as existing:
                output_dimensions = list(existing.size)
            print(f"[cached] {patch_id}: {output_dimensions[0]}x{output_dimensions[1]}", flush=True)
        else:
            print(f"[download] {patch_id}: requesting its ASU 100 m image window", flush=True)
            source = source_crop(session, record)
            total_bytes += source.width * source.height
            output = colorize_day_ir(source)
            output_dimensions = list(output.size)
            source.close()
            output.save(destination, "WEBP", lossless=True, method=6)
            output.close()
        record["dayTemperature"] = f"/terrain/patches/{patch_id}/themis-day-ir-100m.webp"
        record["dayTemperatureResolutionMeters"] = 99.7
        record["dayTemperatureDimensions"] = output_dimensions
        record["dayTemperatureSource"] = "NASA Mars Odyssey THEMIS Day IR 100 m Global Mosaic v11 (ASU)"
        record["dayTemperatureSourceUrl"] = "https://www.mars.asu.edu/data/thm_dir_100m/"
        record["sources"] = list(dict.fromkeys([
            *record.get("sources", []),
            "NASA Mars Odyssey THEMIS Day IR 100 m Global Mosaic v11 (ASU)",
        ]))
        layer_patch_records.append({
            "id": patch_id,
            "url": record["dayTemperature"],
            "file": destination.relative_to(ROOT).as_posix(),
            "dimensions": output_dimensions,
            "bounds": record["bounds"],
            "resolution": "99.7 m/pixel source",
            "source": record["dayTemperatureSource"],
            "sourceUrl": record["dayTemperatureSourceUrl"],
            "noData": "Source PGM value 0 retained as transparent; no-data is not interpolated.",
        })
        print(f"[saved] {destination.relative_to(ROOT)} ({output_dimensions[0]}x{output_dimensions[1]})", flush=True)

    manifest["regionalLayerNote"] = (
        "The 100 m THEMIS Day IR mosaic is served only as five native-resolution regional patches. "
        "The global overlay remains the 256 ppd mosaic resampled for the globe."
    )
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    layer_manifest = json.loads(LAYER_MANIFEST.read_text(encoding="utf-8"))
    day_ir_layer = next(item for item in layer_manifest["layers"] if item["id"] == "themis-day-ir")
    day_ir_layer["regionalPatches"] = layer_patch_records
    day_ir_layer["regionalResolution"] = "99.7 m/pixel source for Jezero, Gale, Elysium, Olympus, and Valles"
    day_ir_layer["regionalNoData"] = "No-data pixels remain transparent; regional gaps are not filled."
    LAYER_MANIFEST.write_text(json.dumps(layer_manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(patch_records)} regional patches; {total_bytes:,} decoded source pixels.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"[error] {error}", file=sys.stderr)
        raise SystemExit(1)
