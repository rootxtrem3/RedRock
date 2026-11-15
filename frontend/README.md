# Red-Rock — Frontend

An immersive 3D Mars exploration and safety-planning interface built with React, TypeScript, Three.js, React Three Fiber, and Vite.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Validation

```bash
npm run lint
npm run build
```

## Included prototype flows

- Rotate, zoom, reset, and click the interactive Mars globe
- Search named locations, mission sites, geological features, and coordinates
- Fly smoothly to a selected surface point
- Inspect terrain, environment, and evidence-based resource indicators
- Open a location-specific survival guide
- Compare safety-first, shorter, and resource-oriented station routes
- Switch restrained scientific layers and mission markers
- Create, edit, and select a home station
- Use desktop, tablet, and mobile layouts with reduced-motion support

## Data note

The globe uses locally generated NASA products under `public/terrain/`:

- **Surface imagery** — 8192×4096 Viking Orbiter color mosaic (ASU Mars Global Data Sets).
- **Terrain height** — 8192×4096 MOLA MEGDR v2.0 height map at 32 ppd (~2.6 km/pixel), used for real geometric displacement and bump shading of the globe.
- **Elevation layer** — hypsometric colorization of that height map with subtle northwest relief shading.
- **Thermal layers** — THEMIS Day IR brightness (256 ppd global overview plus 100 m regional patches at five named sites) and TES nighttime thermal inertia (Putzig et al. 2005, 20 ppd native source).
- **Shallow ice** — NASA SWIM 4MIM 0–1 m consistency index at its native 20 ppd (~2.96 km/pixel) over 60°S–60°N. The source no-data mask remains transparent; the layer describes consistency, not confirmed or harvestable water.
- **Mineral layers** — TES sheet-silicate/high-silica-glass and hematite abundance (Bandfield 2002, 4 ppd).
- **Local detail** — MOLA elevation at 128 ppd (~463 m/pixel), THEMIS Day IR at 256 ppd (~232 m/pixel), and separate 100 m THEMIS Day IR detail for Jezero, Gale, Elysium, Olympus, and Valles.

Regenerate the base assets with `python scripts/prepare_mars_terrain.py` and `python scripts/prepare_mars_layer_globes.py`. Prepare the high-resolution regional Day IR patches with `python scripts/prepare_high_resolution_day_ir.py`; this downloads only the requested ASU PGM row bands, not the 22 GB global mosaic. Prepare the SWIM overlay with `python scripts/prepare_swim_layer.py` after setting `RED_ROCK_SWIM_SOURCE` to the downloaded `SWIM4MIM_Ci_0_1.tif`. Other products stay at their native resolution when no finer validated coverage is included. Do not upsample a raster and describe it as finer data.

## Backend integration

The frontend API contract, component map, raster coverage, and integration notes are documented in [`BACKEND_HANDOFF.md`](./BACKEND_HANDOFF.md). Set `VITE_API_BASE_URL` when the API is hosted on a different origin. Route plans and temperature estimates are supplied by the backend; the frontend displays them with provenance and unavailable states.
