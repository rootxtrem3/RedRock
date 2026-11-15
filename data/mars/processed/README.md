# RED ROCK backend data handoff

Prepared from the source rasters already stored under `Data/`. Original source files were left intact. The NumPy files use the standard `.npy` format and can be opened with `numpy.load(..., mmap_mode="r")`.

## Ready-to-use grids

All four grids have shape **(1800 rows, 3600 columns)** at 0.1° spacing.

| File | Data | Type / units | No-data | Intended use |
|---|---|---|---:|---|
| `elevation_m_mola_3600x1800.npy` | MOLA elevation sampled from the actual global DEM | little-endian int16, meters | -32768 | Global site lookups and route overview |
| `slope_degrees_mola_3600x1800.npy` | Slope derived from the coarse MOLA grid | little-endian float32, degrees | -9999 | Route explanation and broad avoidance costs |
| `local_relief_m_mola_3600x1800.npy` | 3×3-cell elevation range derived from MOLA | little-endian float32, meters | -9999 | Terrain explanation and broad route costs |
| `swim_ci_0_1m_3600x1800.npy` | SWIM combined ice consistency for the 0–1 m depth interval | little-endian float32, dimensionless | -30 | Ice evidence lookup and coverage display |
| `seasonal_solar_mcd_v6_2.json` | MCD modeled flux for five site points and four Mars seasons | JSON records, W/m² | n/a | Seasonal solar comparison, clearly labeled as modeled |

Index a point by wrapping east longitude into `[-180, 180)`, then:

```text
row = clamp(floor((90 - latitude) / 0.1), 0, 1799)
col = clamp(floor((longitude_east + 180) / 0.1), 0, 3599)
```

Row 0 is near 90°N and rows run south. Column 0 is near 180°W and columns run east. Grid cells are sampled at their centers. The approximate east-west cell width shrinks by `cos(latitude)`; the equatorial cell width is about 5.93 km.

## Site point samples

`site_samples.json` contains each map anchor coordinate, its MOLA source-pixel elevation, the nearest SWIM source-pixel consistency value, and its coarse-grid index. The anchor coordinates came from the project’s earlier site catalog; treat them as approximate map points, not official boundaries or landing recommendations. The samples are not region-wide summaries.

The five anchor-point SWIM values are raw consistency scores, not water amounts. They are kept signed and can be negative. The source product covers 60°S–60°N; cells outside that range use the source `-30` no-data sentinel.

## Backend integration starting point

- Load `manifest.json` once at startup and keep the source/interpretation metadata attached to layer responses.
- For point queries, sample all four arrays with the shared row/column convention above and return each field's value, unit, source, and data status. Report SWIM `-30` as `no_data`, not as a low score.
- For route calculation, use the coarse slope and local-relief grids to prototype costs, but keep weights configurable and report route distance plus the terrain reasons at waypoints. Use the original MOLA DEM for detailed local route profiles.
- Return SWIM as `ice_consistency_0_1m`, never as `water_available` or a percentage.
- Keep the Curiosity RAD series as a Gale-only reference until the accompanying note resolves the six-column records.
- Keep seasonal solar output typed as a model estimate with its season and atmospheric assumptions; the included MCD values are site-season samples, not a validated global solar grid.

## Seasonal solar model records

`seasonal_solar_mcd_v6_2.json` contains 20 MCD v6.2 point outputs: five site anchors at solar longitude 0°, 90°, 180°, and 270°. Each point includes the model's horizontal-surface flux and its high-resolution local-slope flux at local solar noon, 10 m above the local surface, using the climatology-average-solar scenario. Longitude is converted to 0–360°E for the model request and the original project longitude is retained in the record.

These are **instantaneous modeled noon fluxes**, not daily integrated sunlight or electrical panel output. Use them for a seasonal context card or point comparison; do not interpolate them into a high-resolution global map. The local-slope values use the model's high-resolution MOLA topography. The MCD web interface provides this flux in W/m² and notes that its web requests are intended for moderate use.

## Provenance and limits

See `manifest.json` for per-grid provenance, source paths, methods, checksums, source links, and the reference-only radiation record.

- The 463 m MOLA source GeoTIFF remains at `Data/raw_asu_usgs/mola_dem/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif`. The global backend grid samples the source pixel nearest each 0.1° cell center. Use the original raster for detailed regional route calculations; a 0.1° grid is too coarse to certify local hazards.
- Slope uses centered finite differences with latitude-adjusted horizontal spacing. Local relief is a coarse 3×3 neighborhood range. These are transparent terrain indicators; route weights and route-safety wording still need team/science review.
- SWIM consistency is not a direct observation of harvestable water and is not a calibrated probability. Preserve the signed score, depth band, and no-data mask.
- `Data/grids/` includes older prototype temperature, water-ice, mineral, and radiation grids. The manifest lists the formula-based outputs that must not be served as scientific measurements.
- Curiosity RAD is a Gale-site time series only and stays raw until its column/header mismatch is resolved against its documentation.
- A validated global solar-resource grid, a global ionizing-radiation layer, and numeric global mineral-abundance data are not included in this package.

## Rebuild

From the RED ROCK project root, run:

```powershell
python scripts\prepare_backend_data.py
```

The script uses only Python's standard library, reads the local MOLA and SWIM GeoTIFFs, writes these backend grids and samples, and updates the manifest. It does not overwrite or remove the original downloads.

To refresh the seasonal solar samples, run `powershell -ExecutionPolicy Bypass -File scripts\prepare_seasonal_solar.ps1` from the project root. It makes 20 sequential requests to the public MCD interface. Then rerun `python scripts\prepare_backend_data.py` to refresh the manifest and checksums.
