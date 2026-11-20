# RED ROCK Node API

TypeScript and Express API for the prepared Mars datasets. The server reads the arrays in `data/mars/processed/` into read-only buffers at startup and checks their NPY headers, shape, dtype, and byte length.

## Run locally

Requires Node.js 22 or newer.

```powershell
cd backend
npm ci
npm run dev
```

The API listens on `http://127.0.0.1:8000`. For a production build, run `npm run build` and `npm start`. Set `RED_ROCK_PORT` to change the port, `RED_ROCK_HOST` to change the bind address, and `RED_ROCK_DATA_DIR` to use a different prepared-data directory. Development CORS allows `http://localhost:5173` and `http://127.0.0.1:5173`; set `RED_ROCK_CORS_ORIGINS` to a comma-separated allowlist when needed.

## Endpoints

- `GET /api/health` — loaded datasets and data version.
- `GET /api/capabilities` — supported features and unavailable global science layers.
- `GET /api/manifest` — provenance, units, coverage, no-data values, and interpretation notes.
- `GET /api/layers` — available texture layers, source metadata, coverage counts, and display ranges.
- `GET /api/layers/{layer}/texture.png` — equirectangular 3600×1800 scientific overlay.
- `GET /api/layers/{layer}/coverage.png` — opaque teal for covered cells and coral for no-data cells.
- `GET /api/sites` — five approximate site anchors with ice samples and seasonal solar records.
- `GET /api/sample?lat=18.38&lon=77.58` — terrain and SWIM values at the nearest 0.1° cell.
- `GET /api/analysis/location?id=jezero&lat=18.38&lon=77.58` — frontend-ready location analysis with per-value provenance and explicit unavailable values.
- `GET /api/solar?site_id=jezero_crater` — modeled seasonal solar samples for one anchor.
- `GET /api/profile?start_lat=18.38&start_lon=77.58&end_lat=18.50&end_lon=77.70&samples=100` — sampled terrain profile.
- `GET /api/ice-prospects?lat=18.38&lon=77.58&radius_km=50&min_ci=0&limit=20` — nearby SWIM cells ranked by consistency.
- `GET /api/route?start_lat=18.38&start_lon=77.58&end_lat=18.21&end_lon=77.32&mode=terrain` — computed route and waypoint explanations.
- `POST /api/routes` — frontend route contract. Accepts `start`, `end`, `variant` (`recommended`, `shorter`, or `resource`), and `travelSpeedKmPerHour`. Resource mode routes to the highest-ranked reachable nearby SWIM consistency cell, not to verified or extractable water.

Available map layer IDs are `elevation`, `slope`, `local-relief`, and `ice-consistency`. Scientific textures use a linear stretch over each dataset’s global valid range; no-data pixels are transparent. Coverage textures distinguish coverage only; they do not encode scientific confidence. `/api/layers` returns the scale, units, provenance, and caveat used by each layer.

## Route and ice interpretation

Route modes are `terrain` and `shortest`. Both use the same valid-data and slope constraints; the default slope cutoff is 25° and can be set with `max_slope_degrees` (greater than 0, at most 45). Endpoints must be within 500 km and 80° latitude; search expands at most 30,000 cells. Terrain cost is distance multiplied by `1 + 1.5×min(slope/max_slope, 2) + 0.4×min(local_relief_m/1000, 2) + 2×min(absolute_grade, 0.5)`. The response includes the selected weights, path geometry, distance, and reasons. These are approved prototype settings, not validated rover mobility costs. Routes use a roughly 5.9 km equatorial grid and are not safety guarantees.

Ice-prospect radius is limited to 200 km and result count to 50. `min_ci` defaults to 0 as a query filter, not a validated science threshold. Returned distances are straight-line; SWIM consistency does not prove water presence or accessibility. To calculate a terrain route to an ice prospect, pass that prospect’s coordinates as the route destination.

There is no validated global temperature, surface-radiation, or quantitative-mineral grid in the prepared bundle. The API reports those as unavailable instead of returning synthetic maps. Seasonal solar values are modeled local-noon samples at the five anchors, not daily energy or panel output.

Location analysis also returns `roughnessProxy`, which is the MOLA 3×3-cell elevation range (~0.1° grid scale), explicitly not rover-scale surface roughness. `surfacePressurePa` is a low-confidence reference-atmosphere estimate `636 Pa × exp(−elevation / 11,000 m)` based on NASA Mars Fact Sheet mean-radius pressure and scale height; it is not a local observation or Mars GCM result and omits seasonal, diurnal, and weather variability. `seasonalSolarSamples` is populated only when the requested point is within 1 km of a named site anchor; it contains that anchor's MCD records and is not interpolated to arbitrary coordinates. Temperature, thermal inertia, dust opacity, and radiation remain unavailable where no valid prepared product exists.

## Frontend integration

The root Vercel Services configuration publishes this service at same-origin `/api/*`; the public path is preserved and already matches the Express routes above. Leave `VITE_API_BASE_URL` empty for that deployment. No service binding is used because requests originate in the user's browser rather than a server-side frontend function. During standalone local development, the backend permits `http://localhost:5173` and `http://127.0.0.1:5173`. See [`frontend/BACKEND_HANDOFF.md`](../frontend/BACKEND_HANDOFF.md) for the response contract and UI mapping.

## Development checks

```powershell
npm test
npm run typecheck
npm run build
```
