# RED ROCK backend handoff

## Data and source conventions

Prepared arrays and provenance are in [`data/mars/processed/`](data/mars/processed/). The grids use 1800×3600 cells at 0.1°: rows run south from 90°N and columns east from 180°W. Normalize east longitude to `[-180, 180)` before indexing. No-data values become `null` and a `no_data` status in API responses.

| Prepared input | Intended use | Important limit |
|---|---|---|
| MOLA elevation | Point samples, profiles, route overview | About 5.93 km per cell at the equator |
| MOLA-derived slope and local relief | Route cost and explanations | Coarse derivatives; local relief is not instrument roughness |
| SWIM 0–1 m consistency | Ice context and nearby candidates | Signed indicator; `-30` is no-data, not “no ice” |
| Five site samples | Approximate anchor comparisons | Not region summaries or landing recommendations |
| Seasonal solar model samples | Five-site seasonal view | Local-noon model outputs, not daily energy or panel output |

See the data README and manifest for product sources, units, checksums, and interpretation limits. The prepared grid bundle is about 91 MB and is loaded read-only at API startup.

## API and local commands

The API is TypeScript/Express under `backend/`. From that directory run `npm ci`, `npm run dev`, `npm test`, `npm run typecheck`, or `npm run build`; `npm start` serves the compiled build. Local API port is 8000.

It exposes health, capabilities, manifest, layer catalog and equirectangular texture/coverage PNGs, site and solar samples, point samples, terrain profiles, nearby ice prospects, and calculated routes. Exact query limits and response fields are documented in [`backend/README.md`](backend/README.md).

## Route behavior

Route modes are `terrain` and `shortest`. Both use MOLA-derived slope constraints and valid terrain coverage. The default slope cutoff is 25°, configurable up to 45°; routes are limited to 500 km and 30,000 expanded cells. Terrain mode also applies explicit slope, local-relief, and elevation-change costs. The API returns the chosen weights, path geometry, distance, sampled values, and waypoint explanations. These are prototype mobility costs over a coarse grid, not safety guarantees.

Ice-prospect distance is straight-line and must not be described as traversal reachability. A route to a prospect is calculated only when the prospect coordinate is explicitly supplied as the destination. SWIM consistency is not confirmed, accessible water.

## Integration order and gaps

1. Keep API contracts covered by backend tests, type checking, and builds.
2. Have the frontend consume returned route geometry, layer textures, source metadata, profiles, prospects, and solar records instead of placeholders.
3. Present the grid resolution and model caveats wherever users see route or resource claims.
4. Defer cache reach until the team chooses travel-budget assumptions; keep site-story claims source-cited.

No validated global temperature, surface-radiation, or quantitative-mineral grid is in the prepared bundle. Capabilities reports these layers unavailable rather than serving synthetic values. Curiosity radiation is Gale-specific reference data and is not a global layer.
