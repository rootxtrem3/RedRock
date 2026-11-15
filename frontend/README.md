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
- **Thermal layers** — THEMIS Day IR brightness (8K, 256 ppd published mosaic via the ASU JMARS WMS) and TES nighttime thermal inertia (Putzig et al. 2005, 20 ppd).
- **Mineral layers** — TES sheet-silicate/high-silica-glass and hematite abundance (Bandfield 2002, 4 ppd).
- **Local detail** — 6×6° THEMIS Day IR patches at 256 ppd with matching MOLA elevation for Jezero, Gale, Elysium, Olympus, and Valles.

Regenerate the assets with `python3 scripts/prepare_mars_terrain.py` and `python3 scripts/prepare_mars_layer_globes.py`. Both scripts have a hard 5 GiB download budget and cache raw products under `data/mars/raw/`. Scientific values in the interface are curated prototype content; the interface labels uncertain or unavailable local data, and this is not a validated operational navigation system.
