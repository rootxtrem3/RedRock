# Red-Rock frontend and backend handoff

This document describes the current frontend and the JSON interfaces it expects from the backend. The frontend remains usable without a server: authored site catalog content and prepared raster assets provide the base experience, while backend-only analyses are shown as unavailable until an API response is received. The backend owns route planning and surface-temperature estimation; the frontend does not synthesize either result.

## Run and configure

```bash
cd frontend
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the backend origin when the API is hosted separately. Leave it blank when the API is served from the same origin. The API must allow the frontend origin through CORS when hosted separately. Production build: `npm run build`.

## Frontend structure

- `src/App.tsx` owns view state, selected location/station, panels, backend requests, route request lifecycle, and the interaction that dismisses the welcome text and stops auto-rotation.
- `src/components/MarsGlobe.tsx` owns the Three.js scene, camera, globe hit testing, marker placement, terrain detail patches, and renders the backend route geometry.
- `src/components/SurvivalPanel.tsx` owns the six guide tabs and renders backend analysis and route results. The Environment tab displays backend thermal estimates; Travel displays backend route output.
- `src/components/LocationPanel.tsx` displays a compact location card and detail dossier. Backend elevation, temperature, thermal inertia, and pressure override catalog values when supplied.
- `src/components/SearchNavigator.tsx`, `SitesPanel.tsx`, and `StationsPanel.tsx` provide location search, site selection, and editable client-side station selection.
- `src/components/MapLocationPin.tsx`, `GlobalLayerSphere.tsx`, and `GlobeLighting.tsx` render location pins, global scientific overlays, and scene lighting.
- `src/components/SourceDataDialog.tsx` is the source list UI; source metadata should move toward per-field records returned by analysis endpoints.
- `src/components/LayersPanel.tsx` displays the layer selector and per-layer source, resolution, legend, and caveat.
- `src/data/marsData.ts` contains prototype authored site facts and stations. These are fallback/demo catalog content, not a backend source of truth.
- `src/data/terrain.ts` maps the global rasters and available local detail patches.
- `src/data/layers.ts` defines rendered layers, legends, source labels, and caveats.
- `src/data/backend.ts` is the typed fetch adapter and the frontend/backend contract. Keep response shapes synchronized with the backend implementation.
- `src/types.ts` contains the frontend location, station, layer, and camera types; backend payload types stay in `src/data/backend.ts` until the API stabilizes.
- `src/hooks/useGlobeTap.ts` distinguishes a globe click from a drag/orbit gesture.
- `public/terrain/manifest.json` and `public/terrain/layers/manifest.json` describe the prepared raster assets.
- `../scripts/prepare_mars_terrain.py` and `../scripts/prepare_mars_layer_globes.py` prepare raster assets. Raw source downloads are under the ignored `../data/mars/raw/` directory.

## API configuration and behavior

The client in `src/data/backend.ts` currently calls:

### `GET /api/analysis/location?id=...&lat=...&lon=...`

The location identifier is optional; coordinates are always included so coordinate-selected locations can be analyzed. Return JSON matching `BackendLocationAnalysis`:

```json
{
  "locationId": "jezero",
  "elevationMeters": {
    "value": -2550,
    "unit": "m",
    "evidenceKind": "measured",
    "sourceName": "MOLA MEGDR",
    "sourceUrl": "https://pds-geosciences.wustl.edu/",
    "coverage": "global",
    "confidence": "high",
    "resolution": "32 ppd",
    "caveat": "Global gridded elevation; local relief is unresolved."
  },
  "thermalInertia": {
    "value": 250,
    "unit": "J m⁻² K⁻¹ s⁻½",
    "evidenceKind": "measured",
    "sourceName": "MGS TES nighttime thermal inertia",
    "coverage": "regional",
    "confidence": "moderate"
  },
  "surfaceTemperature": {
    "currentCelsius": -42,
    "minimumCelsius": -96,
    "maximumCelsius": -18,
    "seasonLsDegrees": 90,
    "localSolarTimeHours": 14,
    "modelName": "Backend model name and version",
    "assumptions": ["..."],
    "caveat": "Model limits and applicable coverage.",
    "sourceName": "Model or input product",
    "sourceUrl": "https://example.invalid/source"
  },
  "slopeDegrees": null,
  "localReliefMeters": null,
  "surfacePressurePa": null,
  "dustOpacity": null,
  "solarFlux": null,
  "radiation": null,
  "resources": [],
  "hazards": [],
  "unknowns": ["No local radiation value is available."],
  "updatedAt": "2026-11-15T00:00:00Z"
}
```

Numeric example values above illustrate the schema only; they are not recommended site values. Use `null` when a value is unavailable. Include evidence kind, unit, coverage, source/version, resolution, confidence only when supported, and a caveat where needed. Do not encode unavailable values as zero. The frontend sends this request when a location is selected and aborts the old request when selection changes.

### `POST /api/routes`

Request body:

```json
{
  "start": { "id": "jezero", "lat": 18.38, "lon": 77.58 },
  "end": { "id": "ares-alpha", "lat": 12.4, "lon": 78.1 },
  "variant": "recommended",
  "travelSpeedKmPerHour": 5
}
```

Variants are `recommended`, `shorter`, and `resource`. The speed is a user-facing planning assumption supplied by the frontend, not a measured travel rate. Return JSON matching `BackendRoutePlan`:

```json
{
  "routeId": "route-id",
  "variant": "recommended",
  "algorithm": "A* on prepared terrain grid",
  "coverage": "terrain-sampled",
  "points": [
    { "lat": 18.38, "lon": 77.58, "elevationMeters": -2550, "slopeDegrees": 2.1 },
    { "lat": 12.4, "lon": 78.1, "elevationMeters": -2500, "slopeDegrees": 1.4 }
  ],
  "distanceKm": 123.4,
  "estimatedTravelHours": 24.7,
  "climbMeters": 120,
  "descentMeters": 170,
  "maximumSlopeDegrees": 8.2,
  "waypoints": [
    { "lat": 15, "lon": 78, "distanceKm": 60, "title": "Slope transition", "reason": "Computed terrain reason.", "elevationMeters": -2480 }
  ],
  "assumptions": ["Planning speed 5 km/h"],
  "caveats": ["Grid resolution is too coarse for rover-scale hazard certification."]
}
```

The route display is now driven only by this response. A failed request shows an error and does not draw a simulated line, distance, risk, or waypoint. `coverage` must be `geometry-only` when terrain sampling was unavailable and `unavailable` when no route can be produced. Keep route reasoning tied to computed values. The current frontend draws the returned path and waypoint positions; text and metrics come from the response.

## Data fields the backend should own

- Location analysis: elevation, slope, relief, thermal inertia, modeled surface temperature and its requested season/local solar time, pressure, dust opacity, solar flux, resource evidence, hazards, and explicit unknowns.
- Route plans: returned path coordinates, terrain coverage, distances, vertical gain/loss, slope summary, travel estimate and assumptions, waypoints and computed reasons, algorithm/version, and limitations.
- Per-field provenance: `BackendValue<T>` in `src/data/backend.ts` includes nullable value, unit, evidence kind, source, version, coverage, confidence, resolution, and caveat.

Do not overwrite the authored fallback site catalog silently. Prefer returning backend data separately and replacing a displayed value only when a non-null backend value is available. Unknown, null, low confidence, no-data, and zero are distinct states.

## Current rasters and coverage limits

- Global visual base: Viking-derived color mosaic at 8192×4096, approximately 2.6 km/pixel.
- Global elevation/height: MOLA at 8192×4096, approximately 2.6 km/pixel. The mesh uses this height texture for displacement.
- Five high-resolution detail regions: Jezero, Gale, Elysium, Olympus, and Valles. THEMIS context patches are 1536×1536 over roughly 6°×6° (~231.55 m/pixel); new ASU 100 m Day IR patches are used by the Day IR brightness layer. MOLA detail height/elevation is 128 ppd (~463.1 m/pixel). Detail patches activate when the view or selected coordinates fall inside a prepared region.
- Bundled SWIM 4MIM 0–1 m consistency layer: native 7200×2400, 20 ppd (~2.96 km/pixel), covering 60°S–60°N. It preserves the -30 no-data sentinel and uses a transparent global texture outside the source's latitude range. Its values are signed consistency indicators, not probability or harvestable water.
- Other available display products: TES thermal inertia (colorized, 20 ppd), MOLA roughness composite (8 ppd), TES sheet-silicate/high-silica-glass and hematite maps (4 ppd). Their textures remain at their published source resolution; the browser does not create finer measurements by resampling them. Colorized maps must not be used to derive numeric values.
- No validated global radiation raster is bundled. Do not present Curiosity site radiation as global coverage; the backend may provide a separately labeled model estimate.

The prepared global route grid is approximately 0.1° (about 5.93 km per cell at the equator). This is a broad planning grid and cannot certify local hazards or short-range rover safety. Keep the team’s November 3, 2026 cutoff for newly acquired datasets.

## Interaction and UI behavior

- The welcome copy appears only before the first pointer or keyboard interaction. Any normal interaction stops globe auto-rotation.
- The rotation button in the map controls explicitly toggles rotation after interaction. Reduced-motion preference still disables it.
- Survival-guide sections are tabs: Environment, Hazards, Resources, Travel, Equipment, and Emergency. Route planning is nested in Travel.
- Small text in the global stylesheet has been raised to improve readability. Check narrow mobile layouts when adding dense metadata.

## Integration status

- `GET /api/analysis/location` and `POST /api/routes` now match the frontend fetch adapter. Start the API and frontend separately; set `VITE_API_BASE_URL` when they are hosted on different origins.
- Analysis returns sampled MOLA elevation, slope, local relief, and SWIM consistency with provenance. Values without a validated numeric input (temperature, pressure, dust, solar flux at arbitrary coordinates, and radiation) are explicitly null/unavailable.
- Route variants run against the prepared grid. `resource` selects the highest-ranked reachable nearby SWIM consistency cell; SWIM consistency does not establish water presence or extraction feasibility.
- Keep API types and this handoff synchronized. Keep null/no-data distinct from zero, and include source, resolution, coverage, and caveats with spatial values.
- The 0.1° route grid is exploratory planning only and cannot certify rover-scale safety.
