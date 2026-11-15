# RED ROCK frontend feature readiness

Historical baseline assessment of the frontend against the agreed survival-map features, written before the latest backend integration. It records gaps at that point in time; it is not a claim about the current deployment. Re-check each item against the running app before using it as a status report.

## Baseline frontend foundation

The app already has a 3D Mars globe, coordinate/site selection, site details, a survival guide, a layer selector, a source dialog, and a route display. These are useful foundations for the feature work.

Important gaps in the current implementation:

- The route flow uses a timed animation and draws a great-circle line. Its route distances, risks, and alternatives are illustrative placeholders, not terrain-derived results.
- Several layer options point to expected texture files under `frontend/public/terrain/layers/`, but those files are not currently present. The UI lists roughness, temperature, thermal inertia, and hydrated-mineral layers; ice and radiation are not listed.
- Site facts and survival values are primarily authored strings in frontend data. They are not yet connected to the prepared backend API.
- The source dialog has generic entries rather than source metadata attached to each displayed fact.

## Feature-by-feature readiness

| Feature | Existing frontend support | Frontend work needed | Backend/data dependency |
|---|---|---|---|
| **Shallow-ice reachability** | Resource text is shown in site details; no ice map or nearby-prospect UI. | Add an ice layer and legend, no-data styling, nearby prospect list/markers, and distance/context in the selected-point panel. | SWIM 0–1 m consistency data and a prospect-search endpoint. Preserve signed values and no-data cells; consistency is not water certainty. |
| **Explain routes and waypoints** | Survival guide has a route section, destination selection, route alternatives, and the globe can draw a route line. | Replace placeholder results with API geometry, real distance and terrain summaries, waypoint markers, and a reason for each waypoint/avoidance. | Route calculation endpoint returning geometry, cost assumptions, sampled terrain values, and reasons. Current coarse grid is only a broad planning prototype. |
| **Local terrain profile** | Globe supports coordinate selection; no line-drawing interaction or chart exists. | Add start/end selection or map line drawing, an elevation chart, steep-section highlighting, and sample-resolution labels. | Terrain-profile endpoint or client sampling over prepared elevation/slope grids. |
| **Emergency cache planner** | Stations can be selected and edited; there is no cache placement or support-area view. | Add cache/shelter placement, a range control, map coverage, and a panel explaining the assumed support reach. | Reachability calculation and explicit travel-range/terrain assumptions. |
| **Compare five regions** | The five named regions are in the site catalog and selectable on the globe. | Add a side-by-side comparison panel/table with comparable fields and citations. | Bereket-reviewed facts and consistent data fields; can begin with vetted static content. |
| **Crew site briefing** | Survival guide already has environment, hazards, resources, travel, equipment, and emergency sections. | Shape these into a mission briefing with resources, terrain concerns, unknowns, and supplies to bring. Clearly label it as a scenario brief, not a safety verdict. | Reviewed site content and citations; dynamic measured fields can come from the sample API. |
| **Science-to-survival lens** | Resource rows show a status and short evidence label. | Add concise “what this suggests” and “what this does not establish” cards with source links. | Bereket-reviewed interpretation and citations. |
| **Seasonal solar view** | Site details contain static solar text; there is no season selector or model-value presentation. | Add a season selector and seasonal comparison card/chart; label modeled local-noon flux and its assumptions. | Existing MCD seasonal site samples from the backend. These are not daily energy, panel output, or a global solar map. |
| **Source and confidence per fact** | Resource findings have confidence labels; a generic source dialog exists. | Attach source, evidence type, units, date/version, confidence/coverage, and caveat to each relevant value. | API responses should return provenance metadata for each field; reviewed claims need source URLs. |
| **Data confidence / unknowns map** | No coverage or unknowns view exists. | Add a coverage layer and legend separating data coverage, weak evidence, and no data. Make unavailable areas visually distinct from low values. | Per-layer coverage/no-data masks and evidence categories. Avoid inventing numeric confidence where the source provides none. |

## Suggested frontend build order

1. **Connect location facts to the API.** Replace hardcoded terrain samples where prepared data exists and show units, resolution, source, and no-data status.
2. **Make the route flow data-driven.** Preserve the existing survival-guide interaction, but remove simulated distance/risk labels and draw returned route geometry with waypoint explanations.
3. **Add shallow-ice exploration.** Add layer selection, an honest legend/no-data treatment, and nearby consistency candidates.
4. **Add the terrain profile.** Reuse globe coordinate selection and add a dedicated chart/panel.
5. **Add evidence UI.** Upgrade fact rows and the source dialog to show per-value provenance and caveats.
6. **Add the comparison and briefing views.** Use content reviewed by the science lead before publishing claims.
7. **Add seasonal solar and cache planning.** Present the model limits and travel assumptions beside the outputs.

## Data and layer limitations to keep visible

- Prepared backend data includes MOLA elevation, derived coarse slope and local relief, SWIM 0–1 m ice consistency, five site anchor samples, and seasonal solar model samples.
- The prepared global route grid is approximately 0.1° (about 5.93 km per cell at the equator). It is not detailed enough to certify local hazards or short-range rover safety.
- There is no validated global surface-radiation raster in the prepared bundle. Curiosity radiation data are site-specific to Gale and should not be displayed as a global layer.
- There are no verified numeric global mineral-abundance grids in the prepared bundle. Existing mineral imagery/indicators must not be presented as quantitative abundance without appropriate sources.
- The frontend currently expects some global layer texture assets that are missing. Do not treat a visible layer-control option as proof the underlying map layer is available or scientifically validated.
- Keep the team’s November 3, 2026 cutoff for newly acquired datasets.

## Relevant frontend files

- `frontend/src/App.tsx` — app state and panel wiring; current route trigger is simulated.
- `frontend/src/types.ts` — site, layer, and station data types.
- `frontend/src/data/marsData.ts` — current authored site facts and display values.
- `frontend/src/components/LayersPanel.tsx` — current map-layer selector and legend labels.
- `frontend/src/components/SurvivalPanel.tsx` — survival guide and current route UI.
- `frontend/src/components/LocationPanel.tsx` — location facts and resource findings.
- `frontend/src/components/SourceDataDialog.tsx` — current generic source list.
- `frontend/src/components/MarsGlobe.tsx` — globe, overlays, and illustrative route geometry.

See [`BACKEND_PLAN.md`](BACKEND_PLAN.md) for the API/data handoff and [`FEATURES.md`](FEATURES.md) for the agreed feature scope.
