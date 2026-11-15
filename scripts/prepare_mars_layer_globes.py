#!/usr/bin/env python3
"""Download and prepare global scientific Mars layer textures for the globe.

The script uses the Arizona State University Mars Global Data Sets archive and
the ASU JMARS Web Map Service, and keeps a hard aggregate download budget of
five GiB, measured from the actual size of ``data/mars/raw`` plus planned HTTP
Content-Length values before any transfer starts.  Optional products are
dropped first if a plan would cross the budget; otherwise the run fails with a
clear error.

The THEMIS Day IR mosaic is requested as eight 4096x1024 WMS cells instead of
the 72 published 256 ppd PNG tiles.  The cells stitch into the same 8K
equirectangular texture, cut the download from ~2.2 GiB to ~30 MiB, and avoid
the combined ~92160x46080 pixel decode that the tiled route required.

Prepared browser assets (all equirectangular, -180..180 east-positive):
  * THEMIS Day IR global mosaic, 8192x4096 colorized thermal WebP with
    transparent gores
  * TES nighttime thermal inertia (Putzig et al. 2005), 7200x3600 WebP
  * MOLA vertical roughness (Kreslavsky & Head 2002), 2880x1440 WebP
  * TES hematite abundance (Bandfield 2002), 1440x720 WebP
  * TES sheet-silicate / high-silica-glass abundance (Bandfield 2002)

Raw source products are stored under ``data/mars/raw/layers``.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "mars" / "raw"
LAYER_RAW_DIR = RAW_DIR / "layers"
PUBLIC_DIR = ROOT / "frontend" / "public" / "terrain" / "layers"
MAX_DOWNLOAD_BYTES = 5 * 1024**3
MAX_OUTPUT_BYTES = 12 * 1024**2

ASU_DATA = "https://www.mars.asu.edu/data"
ASU_WMS = "https://ms-mars.mars.asu.edu"

# THEMIS Day IR Global Mosaic v2.0 (256 ppd, 92160x46080) is served by the
# JMARS WMS as the ``THEMIS_day_IR`` layer.  Requests larger than ~4.2
# megapixels are rejected or truncated by the service, so the 8K texture is
# assembled from a 2x4 grid of 90x45-degree cells at 4096x1024 each.
DAY_IR_TARGET = (8192, 4096)
DAY_IR_CELL_SIZE = (4096, 1024)
DAY_IR_GRID = (2, 4)  # longitude columns, latitude rows
DAY_IR_LON_STEP = 360 / DAY_IR_GRID[0]
DAY_IR_LAT_STEP = 180 / DAY_IR_GRID[1]
THERMAL_INERTIA_TARGET = (7200, 3600)  # native 20 ppd source grid
MINERAL_WMS_SIZE = (1440, 720)

# Perceptual thermal ramp used for THEMIS Day IR brightness. It runs from
# cold/night-side indigo through magenta and red into warm orange and pale
# yellow, so relative daytime surface heating is readable at a glance.
THERMAL_RAMP: tuple[tuple[float, tuple[int, int, int]], ...] = (
    (0.00, (9, 8, 28)),
    (0.15, (43, 17, 70)),
    (0.32, (107, 28, 82)),
    (0.50, (178, 49, 58)),
    (0.68, (231, 98, 39)),
    (0.84, (250, 176, 66)),
    (1.00, (255, 246, 208)),
)

USER_AGENT = (
    "Red-Rock-Martian-Survival-Guide/1.0 "
    "(NASA/PDS and ASU public planetary data; global scientific layer prep)"
)

_THREAD_LOCAL = threading.local()
# Reentrant: download_source holds it while updating the counter and logging.
_PRINT_LOCK = threading.RLock()


def log(message: str) -> None:
    with _PRINT_LOCK:
        print(message, flush=True)


def human_size(size: int | float) -> str:
    value = float(size)
    for unit in ("B", "KiB", "MiB", "GiB"):
        if value < 1024 or unit == "GiB":
            return f"{value:.2f} {unit}"
        value /= 1024
    return f"{value:.2f} GiB"


def thermal_lookup_table() -> np.ndarray:
    """256-entry RGB lookup table for the THEMIS Day IR thermal ramp."""
    positions = np.array([stop[0] for stop in THERMAL_RAMP], dtype=np.float32)
    values = np.linspace(0.0, 1.0, 256, dtype=np.float32)
    channels = []
    for channel in range(3):
        colors = np.array(
            [stop[1][channel] for stop in THERMAL_RAMP], dtype=np.float32
        )
        channels.append(np.interp(values, positions, colors))
    return np.stack(channels, axis=1)


def colorize_thermal(image: Image.Image) -> Image.Image:
    """Colorize a grayscale Day IR mosaic while preserving no-data areas.

    The published tiles carry transparency, but the JMARS WMS cells flatten
    the gores to black.  Near-black pixels therefore become transparent too,
    matching the published mosaic's no-data behavior.
    """
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    table = thermal_lookup_table()
    gray = rgba[..., 0]
    rgb = table[gray].astype(np.uint8)
    alpha = np.where((rgba[..., 3] > 0) & (gray > 4), 255, 0).astype(np.uint8)
    rgb[alpha == 0] = 0
    return Image.fromarray(np.dstack((rgb, alpha)).astype(np.uint8), "RGBA")


def session() -> requests.Session:
    """One requests session per worker thread; requests.Session is not shared."""
    if not hasattr(_THREAD_LOCAL, "session"):
        worker = requests.Session()
        worker.headers.update({"User-Agent": USER_AGENT})
        _THREAD_LOCAL.session = worker
    return _THREAD_LOCAL.session


def raw_bytes() -> int:
    """Actual source bytes currently present in data/mars/raw."""
    return sum(path.stat().st_size for path in RAW_DIR.rglob("*") if path.is_file())


@dataclass(frozen=True)
class Source:
    key: str
    url: str
    relative_path: str
    kind: str
    label: str
    planned_bytes: int
    exact_size: bool
    required: bool = True
    priority: int = 50
    page_url: str = ""

    @property
    def destination(self) -> Path:
        return RAW_DIR / self.relative_path


def day_ir_wms_url(row: int, col: int) -> str:
    west = -180 + col * DAY_IR_LON_STEP
    east = west + DAY_IR_LON_STEP
    north = 90 - row * DAY_IR_LAT_STEP
    south = north - DAY_IR_LAT_STEP
    width, height = DAY_IR_CELL_SIZE
    return (
        f"{ASU_WMS}/THEMIS_day_IR?SERVICE=WMS&REQUEST=GetMap"
        f"&FORMAT=image/png&WIDTH={width}&HEIGHT={height}"
        f"&SRS=JMARS:4&BBOX={west},{south},{east},{north}"
        "&STYLES=&VERSION=1.1.1&LAYERS=THEMIS_day_IR"
    )


def build_sources() -> list[Source]:
    sources: list[Source] = []

    # JMARS WMS responses do not publish a reliable Content-Length.  Reserve
    # the uncompressed gray+alpha size as a conservative upper bound.
    day_ir_bound = DAY_IR_CELL_SIZE[0] * DAY_IR_CELL_SIZE[1] * 2 + 64 * 1024
    for row in range(DAY_IR_GRID[1]):
        for col in range(DAY_IR_GRID[0]):
            north = 90 - row * DAY_IR_LAT_STEP
            west = -180 + col * DAY_IR_LON_STEP
            sources.append(
                Source(
                    key=f"themis-day-ir:{row}:{col}",
                    url=day_ir_wms_url(row, col),
                    relative_path=f"layers/themis_day_ir_{row}_{col}.png",
                    kind="day-ir",
                    label=(
                        "THEMIS Day IR cell "
                        f"{north:.0f}..{north - DAY_IR_LAT_STEP:.0f}N / "
                        f"{west:.0f}..{west + DAY_IR_LON_STEP:.0f}E"
                    ),
                    planned_bytes=day_ir_bound,
                    exact_size=False,
                    required=True,
                    priority=row * DAY_IR_GRID[0] + col,
                    page_url="https://www.mars.asu.edu/data/thm_dir/",
                )
            )

    sources.append(
        Source(
            key="tes-thermal-inertia:putzig-2005",
            url=(
                f"{ASU_DATA}/tes_putzigti/nighttime2005/nmap2003.tif"
            ),
            relative_path="layers/tes_ti_putzig_nighttime_2005_nmap2003.tif",
            kind="thermal-inertia",
            label="TES nighttime thermal inertia, Putzig et al. 2005 (20 ppd)",
            planned_bytes=0,
            exact_size=True,
            required=True,
            priority=5,
            page_url="https://www.mars.asu.edu/data/tes_putzigti/nighttime2005/",
        )
    )

    sources.append(
        Source(
            key="mola-roughness",
            url=f"{ASU_DATA}/mola_roughness/mola_roughness.png",
            relative_path="layers/mola_roughness.png",
            kind="roughness",
            label="MOLA vertical roughness, Kreslavsky & Head 2002 (8 ppd)",
            planned_bytes=0,
            exact_size=True,
            required=True,
            priority=6,
            page_url="https://www.mars.asu.edu/data/mola_roughness/",
        )
    )

    # WMS GetMap responses from the ASU JMARS service do not return a reliable
    # Content-Length.  Reserve the uncompressed RGBA size as a conservative
    # upper bound before download, then verify the actual PNG against it.
    wms_bound = MINERAL_WMS_SIZE[0] * MINERAL_WMS_SIZE[1] * 4 + 64 * 1024
    mineral_products = [
        (
            "tes-sheet-silicates",
            "TES_Glass_Clay",
            "layers/tes_sheet_silicates_4ppd.png",
            "TES sheet silicates / high-silica glass abundance (4 ppd)",
            True,
            10,
            "https://www.mars.asu.edu/data/tes_silicates/",
        ),
        (
            "tes-hematite",
            "TES_Hematite",
            "layers/tes_hematite_4ppd.png",
            "TES hematite abundance (4 ppd)",
            True,
            20,
            "https://www.mars.asu.edu/data/tes_hematite/",
        ),
    ]
    for layer_id, wms_layer, relative_path, label, required, priority, page in mineral_products:
        query = (
            f"{ASU_WMS}/{wms_layer}?SERVICE=WMS&REQUEST=GetMap"
            f"&FORMAT=image/png&WIDTH={MINERAL_WMS_SIZE[0]}"
            f"&HEIGHT={MINERAL_WMS_SIZE[1]}&SRS=JMARS:4"
            "&BBOX=-180,-90,180,90&STYLES=&VERSION=1.1.1"
            f"&LAYERS={wms_layer}"
        )
        sources.append(
            Source(
                key=layer_id,
                url=query,
                relative_path=relative_path,
                kind="mineral",
                label=label,
                planned_bytes=wms_bound,
                exact_size=False,
                required=required,
                priority=priority,
                page_url=page,
            )
        )

    return sources


def head_size(url: str, timeout: tuple[int, int] = (30, 90)) -> int:
    """Return the current Content-Length, with a Range fallback for servers
    that reject HEAD."""
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            response = requests.head(url, allow_redirects=True, timeout=timeout)
            if response.status_code in (403, 405):
                response.close()
                response = requests.get(
                    url,
                    headers={"Range": "bytes=0-0"},
                    stream=True,
                    timeout=timeout,
                )
                content_range = response.headers.get("content-range", "")
                response.close()
                if "/" in content_range:
                    return int(content_range.rsplit("/", 1)[1])
            response.raise_for_status()
            length = response.headers.get("content-length")
            response.close()
            if length and int(length) > 0:
                return int(length)
            last_error = RuntimeError(f"No Content-Length for {url}")
        except Exception as error:  # pragma: no cover - network-dependent
            last_error = error
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Could not determine remote size for {url}: {last_error}")


def resolve_sizes(sources: Sequence[Source], jobs: int) -> dict[str, int]:
    """Fill in Content-Length for static products (WMS uses a bound)."""
    print("Checking remote Content-Length values...")
    sizes: dict[str, int] = {}
    static_sources = [source for source in sources if source.exact_size]
    with ThreadPoolExecutor(max_workers=max(1, min(jobs, 8))) as pool:
        futures = {pool.submit(head_size, source.url): source for source in static_sources}
        for future in as_completed(futures):
            source = futures[future]
            size = future.result()
            sizes[source.url] = size
            log(f"  {human_size(size):>11}  {source.label}")

    for source in sources:
        if source.exact_size:
            object.__setattr__(source, "planned_bytes", sizes[source.url])
        else:
            log(
                f"  {human_size(source.planned_bytes):>11}  {source.label} "
                "(conservative WMS bound; no Content-Length)"
            )
    return sizes


def reduce_plan(
    sources: Sequence[Source], used_bytes: int, budget: int
) -> list[Source]:
    """Return a plan that fits the budget, or fail clearly.

    Optional mineral layers are removed first.  The remaining products are all
    required for a complete global view, so the run fails rather than shipping
    a partly empty thermal or terrain texture.
    """
    planned = sum(source.planned_bytes for source in sources)
    if used_bytes + planned <= budget:
        return list(sources)

    kept = list(sources)
    log(
        f"[budget] Plan {human_size(used_bytes + planned)} exceeds "
        f"{human_size(budget)}; reducing."
    )

    # Drop optional products (the extra hematite layer) before touching the
    # required scientific layers.
    for source in sorted(
        (item for item in kept if not item.required),
        key=lambda item: item.priority,
        reverse=True,
    ):
        kept.remove(source)
        log(f"[budget] Dropped optional layer: {source.label}")
        planned -= source.planned_bytes
        if used_bytes + planned <= budget:
            return kept

    raise RuntimeError(
        f"Required products still need {human_size(used_bytes + planned)}, "
        f"above the {human_size(budget)} download budget"
    )


def download_source(
    source: Source, exact_size: bool, max_size: int, counter: dict[str, int]
) -> str:
    destination = source.destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    expected = source.planned_bytes

    if destination.exists():
        size = destination.stat().st_size
        if exact_size and size == expected:
            return "cached"
        if not exact_size and size <= max_size and _is_complete_png(destination):
            return "cached"

    partial = destination.with_suffix(destination.suffix + ".part")
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            existing = partial.stat().st_size if partial.exists() else 0
            headers = {"Range": f"bytes={existing}-"} if existing else {}
            mode = "ab" if existing else "wb"
            with session().get(
                source.url, stream=True, headers=headers, timeout=(30, 180)
            ) as response:
                response.raise_for_status()
                if existing and response.status_code != 206:
                    existing = 0
                    mode = "wb"
                with partial.open(mode) as output:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            output.write(chunk)

            actual = partial.stat().st_size
            if exact_size and actual != expected:
                raise RuntimeError(
                    f"Size mismatch for {source.key}: {actual} != {expected}"
                )
            if not exact_size:
                if actual > max_size:
                    partial.unlink(missing_ok=True)
                    raise RuntimeError(
                        f"{source.key} exceeded its conservative WMS bound: "
                        f"{human_size(actual)} > {human_size(max_size)}"
                    )
                if not _is_complete_png(partial):
                    partial.unlink(missing_ok=True)
                    raise RuntimeError(
                        f"{source.key} did not return a complete PNG image"
                    )

            partial.replace(destination)
            with _PRINT_LOCK:
                counter["done"] += 1
                log(
                    f"[download] {source.label} "
                    f"({human_size(actual)}) "
                    f"[{counter['done']}/{counter['total']}]"
                )
            return "downloaded"
        except Exception as error:  # pragma: no cover - network-dependent
            last_error = error
            time.sleep(2.0 * (attempt + 1))

    raise RuntimeError(f"Failed to download {source.key}: {last_error}")


def _is_complete_png(path: Path) -> bool:
    """Validate the PNG signature, chunk CRCs, and end-of-file marker.

    The JMARS WMS occasionally returns HTTP 200 with a truncated image, so a
    signature check alone is not enough before a partial download is promoted
    to its final name.
    """
    try:
        with path.open("rb") as handle:
            if handle.read(8) != b"\x89PNG\r\n\x1a\n":
                return False
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image.load()
        return True
    except (OSError, ValueError):
        return False


def download_all(sources: Sequence[Source], jobs: int) -> None:
    todo = [source for source in sources if not _is_cached(source)]
    cached = len(sources) - len(todo)
    total_bytes = sum(source.planned_bytes for source in todo)
    log(
        f"[download] {len(todo)} files to fetch "
        f"({human_size(total_bytes)}), {cached} cached."
    )
    if not todo:
        return
    counter = {"done": 0, "total": len(todo)}
    errors: list[BaseException] = []
    with ThreadPoolExecutor(max_workers=max(1, jobs)) as pool:
        futures = {
            pool.submit(
                download_source,
                source,
                source.exact_size,
                source.planned_bytes,
                counter,
            ): source
            for source in todo
        }
        for future in as_completed(futures):
            try:
                future.result()
            except BaseException as error:
                errors.append(error)
                log(f"[error] {futures[future].key}: {error}")
    if errors:
        raise RuntimeError(
            f"{len(errors)} source download(s) failed; see the log above"
        )


def _is_cached(source: Source) -> bool:
    destination = source.destination
    if not destination.exists():
        return False
    if source.exact_size:
        return destination.stat().st_size == source.planned_bytes
    return destination.stat().st_size <= source.planned_bytes and _is_complete_png(
        destination
    )


def prepare_day_ir(sources: Sequence[Source]) -> tuple[Image.Image, dict[str, object]]:
    """Stitch the ASU JMARS WMS cells into a -180..180 RGBA texture.

    The WMS returns gray+alpha PNGs. Zero-alpha pixels are the published
    no-data gores and stay transparent. Missing or unreadable cells also stay
    transparent so a partial run still produces a usable texture.
    """
    selected = {
        source.relative_path for source in sources if source.kind == "day-ir"
    }
    width, height = DAY_IR_TARGET
    cell_width, cell_height = DAY_IR_CELL_SIZE
    mosaic = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    used: list[str] = []
    missing: list[str] = []

    for row in range(DAY_IR_GRID[1]):
        for col in range(DAY_IR_GRID[0]):
            relative = f"layers/themis_day_ir_{row}_{col}.png"
            path = RAW_DIR / relative
            if relative not in selected or not path.exists():
                missing.append(relative)
                continue

            with Image.open(path) as source:
                tile = source.convert("RGBA")
                if tile.size != DAY_IR_CELL_SIZE:
                    tile = tile.resize(
                        DAY_IR_CELL_SIZE, Image.Resampling.LANCZOS
                    )
                mosaic.paste(tile, (col * cell_width, row * cell_height), tile)
                tile.close()
            used.append(relative)

    log(
        f"[prepare] THEMIS Day IR: {len(used)}/{DAY_IR_GRID[0] * DAY_IR_GRID[1]} "
        f"WMS cells, {len(missing)} transparent cell gaps"
    )
    coverage = {
        "cellGrid": (
            f"{DAY_IR_GRID[0]} longitude x {DAY_IR_GRID[1]} latitude, "
            f"{DAY_IR_LON_STEP:.0f}x{DAY_IR_LAT_STEP:.0f} degree cells"
        ),
        "cellsUsed": len(used),
        "cellsMissing": len(missing),
        "missingCellNames": missing,
        "sourcePixelGrid": list(DAY_IR_TARGET),
        "sourceMosaicPixelGrid": [92160, 46080],
        "sourceMosaicResolution": "256 ppd (~231 m/pixel)",
        "wmsCellPixels": list(DAY_IR_CELL_SIZE),
    }
    return mosaic, coverage


def prepare_thermal_inertia() -> tuple[Image.Image, dict[str, object]]:
    path = LAYER_RAW_DIR / "tes_ti_putzig_nighttime_2005_nmap2003.tif"
    with Image.open(path) as source:
        rgb = source.convert("RGB").resize(
            THERMAL_INERTIA_TARGET, Image.Resampling.LANCZOS
        )
    values = np.asarray(rgb)
    # The published colorized TIFF uses black for no-data at the polar caps
    # and a few speckles.  Preserve every non-black color exactly.
    alpha = np.where(values.max(axis=2) > 4, 255, 0).astype(np.uint8)
    rgba = Image.fromarray(
        np.dstack((values, alpha)), "RGBA"
    )
    rgb.close()
    log("[prepare] TES nighttime thermal inertia (Putzig et al. 2005)")
    return rgba, {
        "sourcePixelGrid": [7200, 3600],
        "noData": "exact/near-black source pixels made transparent",
    }


def prepare_roughness() -> tuple[Image.Image, dict[str, object]]:
    path = LAYER_RAW_DIR / "mola_roughness.png"
    with Image.open(path) as source:
        rgb = source.convert("RGB")
    log("[prepare] MOLA vertical roughness (no alpha; full global coverage)")
    return rgb, {
        "sourcePixelGrid": [2880, 1440],
        "noData": "none; published composite is globally filled",
    }


def prepare_mineral(
    path: Path, label: str
) -> tuple[Image.Image, dict[str, object]]:
    with Image.open(path) as source:
        rgba = source.convert("RGBA")
    log(f"[prepare] {label}")
    return rgba, {
        "sourcePixelGrid": list(MINERAL_WMS_SIZE),
        "noData": "WMS alpha channel preserved",
    }


def save_bounded(
    image: Image.Image,
    output: Path,
    max_bytes: int = MAX_OUTPUT_BYTES,
    lossless: bool = False,
    quality: int = 88,
) -> dict[str, object]:
    """Save WebP under ``max_bytes``, reducing quality then dimensions.

    ``lossless`` keeps published color values exact for small products whose
    palette must stay faithful (the mineral abundance maps and the roughness
    composite). Large textures stay lossy and step down quality and dimensions
    until they fit the per-file budget.
    """
    output.parent.mkdir(parents=True, exist_ok=True)
    candidates: list[tuple[Image.Image, float]] = [(image, 1.0)]
    for scale in (0.75, 0.5, 0.375, 0.25):
        candidates.append(
            (
                image.resize(
                    (
                        max(1, round(image.width * scale)),
                        max(1, round(image.height * scale)),
                    ),
                    Image.Resampling.LANCZOS,
                ),
                scale,
            )
        )

    quality_ladder = [quality]
    for step in (82, 76, 70, 64, 58):
        if step < quality:
            quality_ladder.append(step)

    for candidate, scale in candidates:
        attempts: list[dict[str, object]] = []
        if lossless:
            attempts.append({"lossless": True, "method": 4})
        attempts.extend(
            {"quality": value, "method": 4} for value in quality_ladder
        )
        for options in attempts:
            buffer = io.BytesIO()
            encode = {"format": "WEBP", **options}
            if candidate.mode == "RGBA":
                encode["exact"] = True
            candidate.save(buffer, **encode)
            data = buffer.getvalue()
            if len(data) <= max_bytes:
                output.write_bytes(data)
                if candidate is not image:
                    candidate.close()
                label = "lossless" if options.get("lossless") else (
                    f"q={options['quality']}"
                )
                log(
                    f"[write] {output.relative_to(ROOT)} "
                    f"{candidate.size[0]}x{candidate.size[1]} "
                    f"{label} {human_size(len(data))}"
                )
                return {
                    "dimensions": [candidate.size[0], candidate.size[1]],
                    "bytes": len(data),
                    "webpQuality": options.get("quality"),
                    "lossless": bool(options.get("lossless")),
                    "downscale": scale,
                }
        if candidate is not image:
            candidate.close()

    raise RuntimeError(
        f"Could not encode {output.name} below {human_size(max_bytes)}"
    )


def write_manifest(
    layer_records: Sequence[dict[str, object]],
    initial_raw: int,
    planned_total: int,
) -> Path:
    manifest = {
        "schemaVersion": 1,
        "projection": "Simple cylindrical / planetocentric / east-positive",
        "longitudeTextureRange": "-180 to 180",
        "longitudeOrder": "east-positive, -180 degrees at the left edge",
        "latitudeTextureRange": "-90 to 90",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "generatedBy": "scripts/prepare_mars_layer_globes.py",
        "downloadBudgetBytes": MAX_DOWNLOAD_BYTES,
        "rawSourceBytesBefore": initial_raw,
        "rawSourceBytesAfter": raw_bytes(),
        "plannedSourceBytes": planned_total,
        "sourceArchive": "ASU Mars Global Data Sets (mars.asu.edu/data)",
        "layers": list(layer_records),
    }
    manifest_path = PUBLIC_DIR / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    log(f"[manifest] {manifest_path.relative_to(ROOT)}")
    return manifest_path


def layer_record(
    layer_id: str,
    title: str,
    description: str,
    source: str,
    source_url: str,
    citation: str,
    resolution: str,
    product_type: str,
    save_result: dict[str, object],
    extra: dict[str, object] | None = None,
    alpha: bool = True,
) -> dict[str, object]:
    record: dict[str, object] = {
        "id": layer_id,
        "title": title,
        "url": f"/terrain/layers/{layer_id}.webp",
        "file": f"frontend/public/terrain/layers/{layer_id}.webp",
        "format": "webp",
        "dimensions": save_result["dimensions"],
        "longitudeRange": [-180, 180],
        "latitudeRange": [-90, 90],
        "alpha": alpha,
        "productType": product_type,
        "source": source,
        "sourceUrl": source_url,
        "citation": citation,
        "resolution": resolution,
        "description": description,
        "attribution": source,
        "outputSizeBytes": save_result["bytes"],
        "webpQuality": save_result["webpQuality"],
        "lossless": bool(save_result.get("lossless", False)),
    }
    if extra:
        record.update(extra)
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Check Content-Length values and the five-GiB budget, then exit",
    )
    parser.add_argument(
        "--jobs",
        type=int,
        default=4,
        help="Parallel download workers (default: 4)",
    )
    args = parser.parse_args()

    initial_raw = raw_bytes()
    print(f"Existing raw source bytes: {human_size(initial_raw)}")
    print(f"Hard five-GiB budget:     {human_size(MAX_DOWNLOAD_BYTES)}")

    sources = build_sources()
    resolve_sizes(sources, args.jobs)
    sources = reduce_plan(sources, initial_raw, MAX_DOWNLOAD_BYTES)

    planned_total = sum(source.planned_bytes for source in sources)
    print(f"Planned source total:     {human_size(planned_total)}")
    print(
        f"Budget after plan:        "
        f"{human_size(MAX_DOWNLOAD_BYTES - initial_raw - planned_total)} free"
    )
    if initial_raw + planned_total > MAX_DOWNLOAD_BYTES:
        raise RuntimeError(
            "Planned downloads exceed the five-GiB budget; refusing to start"
        )
    if args.check_only:
        return 0

    download_all(sources, args.jobs)

    actual_raw = raw_bytes()
    if actual_raw > MAX_DOWNLOAD_BYTES:
        raise RuntimeError(
            f"Actual raw source size {human_size(actual_raw)} exceeds the "
            "five-GiB hard budget"
        )
    print(f"Actual raw source bytes:  {human_size(actual_raw)}")

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []

    day_ir, day_ir_extra = prepare_day_ir(sources)
    colorized_day_ir = colorize_thermal(day_ir)
    day_ir.close()
    day_ir_result = save_bounded(
        colorized_day_ir, PUBLIC_DIR / "themis-day-ir.webp"
    )
    colorized_day_ir.close()
    day_ir_extra = {
        **day_ir_extra,
        "valueMeaning": "relative daytime 12.57 micrometre brightness temperature",
        "thermalRamp": {
            "stops": [
                {"value": value, "rgb": list(rgb)}
                for value, rgb in THERMAL_RAMP
            ],
            "direction": "cold/dark to warm/bright",
            "note": (
                "The published mosaic is an 8-bit relative brightness product, "
                "not a calibrated kinetic-temperature grid."
            ),
        },
    }
    records.append(
        layer_record(
            "themis-day-ir",
            "THEMIS Day IR Global Mosaic",
            (
                "Daytime thermal infrared (12.57 micrometre) brightness "
                "mosaic from Mars Odyssey THEMIS. The published global mosaic "
                "is 256 ppd; this browser texture is an 8K equirectangular "
                "colorized resample assembled from ASU JMARS WMS cells. "
                "No-data gores and unavailable cells are transparent."
            ),
            (
                "NASA/JPL-Caltech/Arizona State University, Mars Odyssey "
                "THEMIS Day IR Global Mosaic v2.0 (ASU Mars Global Data Sets)"
            ),
            "https://www.mars.asu.edu/data/thm_dir/",
            (
                "THEMIS Day IR Global Mosaic v2.0, ASU Mars Global Data Sets; "
                "NASA Mars Odyssey THEMIS daytime infrared (12.57 micrometre)."
            ),
            "256 ppd (~231 m/pixel) source",
            "Daytime thermal infrared brightness (not thermal inertia)",
            day_ir_result,
            day_ir_extra,
        )
    )

    thermal_inertia, thermal_inertia_extra = prepare_thermal_inertia()
    thermal_inertia_result = save_bounded(
        thermal_inertia, PUBLIC_DIR / "tes-thermal-inertia.webp"
    )
    thermal_inertia.close()
    records.append(
        layer_record(
            "tes-thermal-inertia",
            "TES Nighttime Thermal Inertia (Putzig et al. 2005)",
            (
                "Colorized global nighttime thermal inertia derived from MGS "
                "TES observations at 20 ppd (~3 km/pixel). This is thermal "
                "inertia, not a thermal-infrared brightness image."
            ),
            (
                "NASA/JPL/Arizona State University, MGS TES nighttime thermal "
                "inertia (Putzig et al. 2005)"
            ),
            "https://www.mars.asu.edu/data/tes_putzigti/nighttime2005/",
            (
                "Putzig, N. E., M. T. Mellon, K. A. Kretke, and R. E. "
                "Arvidson (2005), Global thermal inertia and surface "
                "properties of Mars from the MGS mapping mission, Icarus 173, "
                "325-341."
            ),
            "20 ppd (~3 km/pixel) source",
            "Thermal inertia (nighttime TES retrieval), colorized",
            thermal_inertia_result,
            thermal_inertia_extra,
        )
    )

    roughness, roughness_extra = prepare_roughness()
    roughness_result = save_bounded(
        roughness, PUBLIC_DIR / "mola-roughness.webp", lossless=True
    )
    roughness.close()
    records.append(
        layer_record(
            "mola-roughness",
            "MOLA Vertical Roughness",
            (
                "Red, green and blue composite of MOLA vertical roughness at "
                "0.6 km, 2.4 km and 9.2 km baselines (8 ppd / ~7.5 km per "
                "pixel). Colors follow the published Kreslavsky & Head "
                "composite and are not a single scalar roughness ramp."
            ),
            (
                "MOLA vertical roughness composite, Kreslavsky & Head (2002); "
                "distributed by ASU Mars Global Data Sets"
            ),
            "https://www.mars.asu.edu/data/mola_roughness/",
            (
                "M. A. Kreslavsky and J. W. Head III (2002), Mars: Nature and "
                "evolution of young latitude-dependent water-ice-rich mantle, "
                "Geophysical Research Letters 29."
            ),
            "8 ppd (~7.5 km/pixel) source",
            "MOLA vertical roughness RGB baseline composite",
            roughness_result,
            roughness_extra,
            alpha=False,
        )
    )

    mineral_specs = [
        (
            "tes-sheet-silicates",
            "TES Sheet Silicates / High-Silica Glass Abundance",
            (
                "TES mineral-abundance map for sheet silicates and high-silica "
                "glass (4 ppd / ~16 km per pixel). This is a TES mineral "
                "indicator relevant to hydrated/glass-bearing materials; it is "
                "NOT a CRISM hydration product and is not labeled as one."
            ),
            "https://www.mars.asu.edu/data/tes_silicates/",
            "Sheet silicates / high-silica glass",
            "layers/tes_sheet_silicates_4ppd.png",
        ),
        (
            "tes-hematite",
            "TES Hematite Abundance",
            (
                "TES mineral-abundance map for hematite (4 ppd / ~16 km per "
                "pixel). A distinct, scientifically labeled TES mineral "
                "product; not a CRISM hydrated-mineral map."
            ),
            "https://www.mars.asu.edu/data/tes_hematite/",
            "Hematite",
            "layers/tes_hematite_4ppd.png",
        ),
    ]
    for (
        layer_id,
        title,
        description,
        source_url,
        mineral_name,
        relative_path,
    ) in mineral_specs:
        mineral, mineral_extra = prepare_mineral(
            RAW_DIR / relative_path, title
        )
        mineral_result = save_bounded(
            mineral, PUBLIC_DIR / f"{layer_id}.webp", lossless=True
        )
        mineral.close()
        records.append(
            layer_record(
                layer_id,
                title,
                description,
                (
                    "NASA/JPL/Arizona State University, MGS TES "
                    f"{mineral_name} abundance (Bandfield 2002)"
                ),
                source_url,
                (
                    "Bandfield, J. L. (2002), Global mineral distributions on "
                    "Mars, Journal of Geophysical Research 107."
                ),
                "4 ppd (~16 km/pixel) source",
                "TES colorized mineral abundance",
                mineral_result,
                mineral_extra,
            )
        )

    write_manifest(records, initial_raw, planned_total)

    prepared_size = sum(
        path.stat().st_size for path in PUBLIC_DIR.iterdir() if path.is_file()
    )
    print(f"Prepared browser layer assets: {human_size(prepared_size)}")
    print("Layer globe preparation complete.")
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
