#!/usr/bin/env python3
"""Download and prepare a bounded set of accurate Mars terrain products.

The source URLs mirror the NASA/PDS and Arizona State University products
listed by the original Martian project downloader. A hard five-GiB aggregate
download budget is checked from HTTP Content-Length headers before any new
transfer begins.

Prepared browser assets:
  * 8192x4096 Viking global color mosaic (64 ppd source)
  * 4096x2048 MOLA global topography map (16 ppd source)
  * 6x6 degree THEMIS Day IR detail patches (256 ppd / ~232 m per pixel)
  * matching MOLA topography patches (128 ppd / ~463 m per pixel)
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import requests
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "mars" / "raw"
PUBLIC_DIR = ROOT / "frontend" / "public" / "terrain"
MAX_DOWNLOAD_BYTES = 5 * 1024**3
MOLA_MIN_METERS = -8177
MOLA_MAX_METERS = 21171

PDS_MOLA = (
    "https://pds-geosciences.wustl.edu/mgs/"
    "mgs-m-mola-5-megdr-l3-v1/mgsl_300x"
)
ASU_DATA = "https://www.mars.asu.edu/data"

SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": (
            "Red-Rock-Martian-Survival-Guide/1.0 "
            "(NASA/PDS and ASU public planetary data)"
        )
    }
)


@dataclass(frozen=True)
class Source:
    key: str
    url: str
    relative_path: str

    @property
    def destination(self) -> Path:
        return RAW_DIR / self.relative_path


@dataclass(frozen=True)
class Patch:
    id: str
    center_lat: float
    center_lon_east: float
    themis_source: str
    themis_west: float
    themis_north: float
    mola_source: str
    mola_west: float
    mola_north: float

    @property
    def bounds(self) -> dict[str, float]:
        half_span = 3.0
        return {
            "north": self.center_lat + half_span,
            "south": self.center_lat - half_span,
            "west": self.center_lon_east - half_span,
            "east": self.center_lon_east + half_span,
        }


VIKING_FILES = [
    "mars45n225.png",
    "mars45n315.png",
    "mars45n045.png",
    "mars45n135.png",
    "mars45s225.png",
    "mars45s315.png",
    "mars45s045.png",
    "mars45s135.png",
]

PATCHES = [
    Patch(
        id="jezero",
        center_lat=18.30,
        center_lon_east=77.45,
        themis_source="thm_dir_N00_060.png",
        themis_west=60,
        themis_north=30,
        mola_source="megt44n000hb.img",
        mola_west=0,
        mola_north=44,
    ),
    Patch(
        id="gale",
        center_lat=-5.40,
        center_lon_east=137.80,
        themis_source="thm_dir_N-30_120.png",
        themis_west=120,
        themis_north=0,
        mola_source="megt00n090hb.img",
        mola_west=90,
        mola_north=0,
    ),
    Patch(
        id="elysium",
        center_lat=4.50,
        center_lon_east=135.90,
        themis_source="thm_dir_N00_120.png",
        themis_west=120,
        themis_north=30,
        mola_source="megt44n090hb.img",
        mola_west=90,
        mola_north=44,
    ),
    Patch(
        id="olympus",
        center_lat=18.65,
        center_lon_east=226.20,
        themis_source="thm_dir_N00_210.png",
        themis_west=210,
        themis_north=30,
        mola_source="megt44n180hb.img",
        mola_west=180,
        mola_north=44,
    ),
    Patch(
        id="valles",
        center_lat=-14.00,
        center_lon_east=290.00,
        themis_source="thm_dir_N-30_270.png",
        themis_west=270,
        themis_north=0,
        mola_source="megt00n270hb.img",
        mola_west=270,
        mola_north=0,
    ),
]


def unique_sources() -> list[Source]:
    sources: list[Source] = []
    for filename in VIKING_FILES:
        sources.append(
            Source(
                key=f"viking:{filename}",
                url=f"{ASU_DATA}/mdim_color/large/{filename}",
                relative_path=f"viking/{filename}",
            )
        )

    sources.append(
        Source(
            key="mola:global-16ppd",
            url=f"{PDS_MOLA}/meg016/megt90n000eb.img",
            relative_path="mola/megt90n000eb.img",
        )
    )

    for patch in PATCHES:
        sources.append(
            Source(
                key=f"themis:{patch.themis_source}",
                url=f"{ASU_DATA}/thm_dir/large/{patch.themis_source}",
                relative_path=f"themis/{patch.themis_source}",
            )
        )
        sources.append(
            Source(
                key=f"mola:{patch.mola_source}",
                url=f"{PDS_MOLA}/meg128/{patch.mola_source}",
                relative_path=f"mola/{patch.mola_source}",
            )
        )

    deduplicated: dict[str, Source] = {}
    for source in sources:
        deduplicated[source.url] = source
    return list(deduplicated.values())


def remote_size(source: Source) -> int:
    response = SESSION.head(source.url, allow_redirects=True, timeout=60)
    response.raise_for_status()
    size = int(response.headers.get("content-length", "0"))
    if size <= 0:
        raise RuntimeError(f"Source did not provide Content-Length: {source.url}")
    return size


def human_size(size: int) -> str:
    units = ["B", "KiB", "MiB", "GiB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.2f} {unit}"
        value /= 1024
    return f"{value:.2f} GiB"


def check_budget(sources: Iterable[Source]) -> dict[str, int]:
    print("Checking remote product sizes...")
    sizes: dict[str, int] = {}
    total = 0
    for source in sources:
        size = remote_size(source)
        sizes[source.url] = size
        total += size
        print(f"  {human_size(size):>11}  {source.key}")

    print(f"Planned source total: {human_size(total)}")
    print(f"Hard download budget: {human_size(MAX_DOWNLOAD_BYTES)}")
    if total > MAX_DOWNLOAD_BYTES:
        raise RuntimeError(
            f"Planned downloads are {human_size(total)}, above the five-GiB budget"
        )
    return sizes


def download(source: Source, expected_size: int) -> None:
    destination = source.destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size == expected_size:
        print(f"[cached] {source.key}")
        return

    partial = destination.with_suffix(destination.suffix + ".part")
    existing = partial.stat().st_size if partial.exists() else 0
    headers = {"Range": f"bytes={existing}-"} if existing else {}
    mode = "ab" if existing else "wb"

    print(f"[download] {source.key} ({human_size(expected_size)})")
    with SESSION.get(source.url, stream=True, headers=headers, timeout=180) as response:
        response.raise_for_status()
        if existing and response.status_code != 206:
            existing = 0
            mode = "wb"
        downloaded = existing
        with partial.open(mode) as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                output.write(chunk)
                downloaded += len(chunk)
                percent = min(100.0, downloaded / expected_size * 100)
                print(
                    f"\r           {percent:6.2f}%  {human_size(downloaded)}",
                    end="",
                    flush=True,
                )
    print()
    if partial.stat().st_size != expected_size:
        raise RuntimeError(
            f"Size mismatch for {source.key}: "
            f"{partial.stat().st_size} != {expected_size}"
        )
    partial.replace(destination)


def normalize_elevation(elevation: np.ndarray) -> np.ndarray:
    clipped = np.clip(elevation, MOLA_MIN_METERS, MOLA_MAX_METERS)
    normalized = (clipped.astype(np.float32) - MOLA_MIN_METERS) / (
        MOLA_MAX_METERS - MOLA_MIN_METERS
    )
    return np.rint(normalized * 255).astype(np.uint8)


def prepare_global_viking() -> Path:
    output_dir = PUBLIC_DIR / "global"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / "viking-global.webp"
    print(f"[prepare] {output.relative_to(ROOT)}")

    quadrant_size = 2048
    mosaic = Image.new("RGB", (quadrant_size * 4, quadrant_size * 2))
    for index, filename in enumerate(VIKING_FILES):
        with Image.open(RAW_DIR / "viking" / filename) as source:
            tile = source.convert("RGB")
            tile.thumbnail((quadrant_size, quadrant_size), Image.Resampling.LANCZOS)
            if tile.size != (quadrant_size, quadrant_size):
                tile = tile.resize(
                    (quadrant_size, quadrant_size), Image.Resampling.LANCZOS
                )
            x = (index % 4) * quadrant_size
            y = (index // 4) * quadrant_size
            mosaic.paste(tile, (x, y))
            tile.close()

    # Keep the entire visual identity in the Mars-red family while preserving
    # the measured Viking luminance detail.
    luminance = np.asarray(mosaic.convert("L"), dtype=np.float32) / 255.0
    dark = np.array([52, 24, 19], dtype=np.float32)
    light = np.array([199, 101, 76], dtype=np.float32)
    tinted = dark + luminance[..., None] * (light - dark)
    tinted_image = Image.fromarray(np.clip(tinted, 0, 255).astype(np.uint8), "RGB")
    tinted_image.save(output, "WEBP", quality=88, method=6)
    mosaic.close()
    tinted_image.close()
    return output


def prepare_global_height() -> Path:
    output_dir = PUBLIC_DIR / "global"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / "mola-height.png"
    print(f"[prepare] {output.relative_to(ROOT)}")

    raw = np.memmap(
        RAW_DIR / "mola" / "megt90n000eb.img",
        dtype=">i2",
        mode="r",
        shape=(2880, 5760),
    )
    # PDS source is 0..360 east-positive; roll to -180..180 for the standard
    # equirectangular texture convention used by the globe geometry.
    rolled = np.concatenate((raw[:, 2880:], raw[:, :2880]), axis=1)
    image = Image.fromarray(normalize_elevation(rolled), "L")
    image = image.resize((4096, 2048), Image.Resampling.LANCZOS)
    image.save(output, "PNG", optimize=True)
    image.close()
    del raw
    return output


def crop_box(
    bounds: dict[str, float],
    source_west: float,
    source_north: float,
    pixels_per_degree: int,
) -> tuple[int, int, int, int]:
    left = round((bounds["west"] - source_west) * pixels_per_degree)
    right = round((bounds["east"] - source_west) * pixels_per_degree)
    top = round((source_north - bounds["north"]) * pixels_per_degree)
    bottom = round((source_north - bounds["south"]) * pixels_per_degree)
    return left, top, right, bottom


def prepare_patch(patch: Patch) -> dict[str, object]:
    output_dir = PUBLIC_DIR / "patches" / patch.id
    output_dir.mkdir(parents=True, exist_ok=True)
    texture_output = output_dir / "themis.webp"
    height_output = output_dir / "mola-height.png"
    bounds = patch.bounds

    print(f"[prepare] detail patch {patch.id}")
    themis_path = RAW_DIR / "themis" / patch.themis_source
    with Image.open(themis_path) as source:
        texture = source.crop(
            crop_box(bounds, patch.themis_west, patch.themis_north, 256)
        ).convert("RGBA")
        rgba = np.asarray(texture, dtype=np.uint8)
        luminance = rgba[..., 0].astype(np.float32) / 255.0
        dark = np.array([45, 24, 20], dtype=np.float32)
        light = np.array([215, 143, 119], dtype=np.float32)
        tinted_rgb = dark + luminance[..., None] * (light - dark)
        tinted_rgba = np.dstack(
            (np.clip(tinted_rgb, 0, 255).astype(np.uint8), rgba[..., 3])
        )
        tinted_texture = Image.fromarray(tinted_rgba, "RGBA")
        tinted_texture.save(texture_output, "WEBP", quality=90, method=6, exact=True)
        tinted_texture.close()
        texture.close()

    mola_path = RAW_DIR / "mola" / patch.mola_source
    raw = np.memmap(
        mola_path,
        dtype=">i2",
        mode="r",
        shape=(5632, 11520),
    )
    left, top, right, bottom = crop_box(
        bounds, patch.mola_west, patch.mola_north, 128
    )
    height = np.array(raw[top:bottom, left:right], copy=True)
    height_image = Image.fromarray(normalize_elevation(height), "L")
    height_image.save(height_output, "PNG", optimize=True)
    height_image.close()
    del raw

    west_signed = bounds["west"] if bounds["west"] <= 180 else bounds["west"] - 360
    east_signed = bounds["east"] if bounds["east"] <= 180 else bounds["east"] - 360
    return {
        "id": patch.id,
        "bounds": {
            "north": bounds["north"],
            "south": bounds["south"],
            "west": west_signed,
            "east": east_signed,
        },
        "texture": f"/terrain/patches/{patch.id}/themis.webp",
        "height": f"/terrain/patches/{patch.id}/mola-height.png",
        "imageryResolutionMeters": 231.55,
        "elevationResolutionMeters": 463.1,
        "textureDimensions": [1536, 1536],
        "heightDimensions": [768, 768],
        "sources": [
            "NASA Mars Odyssey / THEMIS Day IR Global Mosaic v2.0",
            "NASA MGS / MOLA MEGDR v2.0",
        ],
    }


def write_manifest(patch_records: list[dict[str, object]], download_bytes: int) -> None:
    manifest = {
        "projection": "simple cylindrical / planetocentric / east-positive",
        "longitudeTextureRange": "-180 to 180",
        "elevationRangeMeters": [MOLA_MIN_METERS, MOLA_MAX_METERS],
        "downloadBudgetBytes": MAX_DOWNLOAD_BYTES,
        "plannedSourceBytes": download_bytes,
        "global": {
            "texture": "/terrain/global/viking-global.webp",
            "height": "/terrain/global/mola-height.png",
            "textureDimensions": [8192, 4096],
            "heightDimensions": [4096, 2048],
            "textureResolutionMeters": 920,
            "heightResolutionMeters": 3705,
            "sources": [
                "NASA Viking Orbiter merged color mosaic / ASU",
                "NASA MGS MOLA MEGDR v2.0 / PDS Geosciences Node",
            ],
        },
        "patches": {record["id"]: record for record in patch_records},
    }
    manifest_path = PUBLIC_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"[manifest] {manifest_path.relative_to(ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Check remote sizes and the five-GiB budget without downloading",
    )
    args = parser.parse_args()

    sources = unique_sources()
    sizes = check_budget(sources)
    total = sum(sizes.values())
    if args.check_only:
        return 0

    for source in sources:
        download(source, sizes[source.url])

    prepare_global_viking()
    prepare_global_height()
    patch_records = [prepare_patch(patch) for patch in PATCHES]
    write_manifest(patch_records, total)

    prepared_size = sum(
        path.stat().st_size for path in PUBLIC_DIR.rglob("*") if path.is_file()
    )
    print(f"Prepared browser assets: {human_size(prepared_size)}")
    print("Terrain preparation complete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nCancelled; partial downloads can be resumed.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print(f"\nERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
