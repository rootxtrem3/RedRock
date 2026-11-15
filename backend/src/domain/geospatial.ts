import { MarsDataStore } from '../data/marsData.js'

export const GRID_ROWS = 1800
export const GRID_COLUMNS = 3600
export const CELL_DEGREES = 0.1
export const MARS_RADIUS_KM = 3389.5

export type GeoPoint = { lat: number; lon_east: number }

export function normalizeLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180
}

export function gridIndex(lat: number, longitude: number): { row: number; col: number } {
  const lon = normalizeLongitude(longitude)
  return {
    row: Math.min(GRID_ROWS - 1, Math.max(0, Math.floor((90 - lat) / CELL_DEGREES))),
    col: Math.min(GRID_COLUMNS - 1, Math.max(0, Math.floor((lon + 180) / CELL_DEGREES))),
  }
}

export function cellCenter(row: number, col: number): GeoPoint {
  return {
    lat: 90 - (row + 0.5) * CELL_DEGREES,
    lon_east: normalizeLongitude(-180 + (col + 0.5) * CELL_DEGREES),
  }
}

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const phi1 = (a.lat * Math.PI) / 180
  const phi2 = (b.lat * Math.PI) / 180
  const dPhi = phi2 - phi1
  const dLon = (normalizeLongitude(b.lon_east - a.lon_east) * Math.PI) / 180
  const haversine = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2
  return 2 * MARS_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)))
}

function dataField(store: MarsDataStore, datasetId: string, value: number | null) {
  const metadata = store.metadata.get(datasetId)
  return {
    value,
    unit: metadata?.units ?? 'unknown',
    status: value === null ? 'no_data' : 'sampled',
    source_id: datasetId,
  }
}

export function samplePoint(store: MarsDataStore, lat: number, longitude: number) {
  const lon = normalizeLongitude(longitude)
  const { row, col } = gridIndex(lat, lon)
  const elevation = store.value('mola_elevation', row, col)
  const slope = store.value('mola_slope', row, col)
  const relief = store.value('mola_local_relief', row, col)
  const iceValue = store.value('swim_ci_0_1m', row, col)
  const iceMetadata = store.metadata.get('swim_ci_0_1m')
  return {
    location: { lat, lon_east: lon },
    grid: { row, col, resolution_degrees: CELL_DEGREES },
    terrain: {
      mola_elevation: dataField(store, 'mola_elevation', elevation),
      mola_slope: dataField(store, 'mola_slope', slope),
      mola_local_relief: dataField(store, 'mola_local_relief', relief),
    },
    ice: {
      ci_0_1m: iceValue,
      unit: iceMetadata?.units ?? 'dimensionless consistency index',
      status: iceValue === null ? 'no_data' : 'sampled_consistency_index',
      source_id: 'swim_ci_0_1m',
      interpretation: 'Consistency indicator for possible near-surface ice, not water volume or a calibrated probability.',
    },
    sources: ['mola_elevation', 'mola_slope', 'mola_local_relief', 'swim_ci_0_1m'],
  }
}

function sampleCell(store: MarsDataStore, row: number, col: number) {
  const elevation = store.value('mola_elevation', row, col)
  const slope = store.value('mola_slope', row, col)
  const relief = store.value('mola_local_relief', row, col)
  const ice = store.value('swim_ci_0_1m', row, col)
  return {
    center: cellCenter(row, col),
    terrain: { elevation_m: elevation, slope_degrees: slope, local_relief_m: relief },
    terrain_status: elevation === null || slope === null || relief === null ? 'no_data' : 'sampled',
    ice: { ci_0_1m: ice, status: ice === null ? 'no_data' : 'sampled_consistency_index' },
  }
}

export function terrainProfile(
  store: MarsDataStore,
  start: GeoPoint,
  end: GeoPoint,
  sampleCount: number,
) {
  const longitudeDelta = normalizeLongitude(end.lon_east - start.lon_east)
  const points = []
  let distanceAlong = 0
  let previous: GeoPoint | undefined
  for (let index = 0; index < sampleCount; index += 1) {
    const fraction = index / (sampleCount - 1)
    const point = {
      lat: start.lat + (end.lat - start.lat) * fraction,
      lon_east: normalizeLongitude(start.lon_east + longitudeDelta * fraction),
    }
    if (previous) distanceAlong += distanceKm(previous, point)
    const { row, col } = gridIndex(point.lat, point.lon_east)
    points.push({
      distance_along_km: Number(distanceAlong.toFixed(3)),
      location: point,
      ...sampleCell(store, row, col),
    })
    previous = point
  }
  return {
    start: { lat: start.lat, lon_east: normalizeLongitude(start.lon_east) },
    end: { lat: end.lat, lon_east: normalizeLongitude(end.lon_east) },
    distance_km: Number(distanceAlong.toFixed(3)),
    sampling: {
      method: 'Evenly spaced coordinate samples along a straight latitude/shortest-longitude line; nearest 0.1-degree grid cell.',
      requested_samples: sampleCount,
      grid_resolution_degrees: CELL_DEGREES,
      units: {
        distance_along_km: 'km',
        elevation_m: 'm',
        slope_degrees: 'degrees',
        local_relief_m: 'm',
        ice_ci_0_1m: 'dimensionless consistency index',
      },
    },
    source_ids: ['mola_elevation', 'mola_slope', 'mola_local_relief', 'swim_ci_0_1m'],
    points,
  }
}

export function iceProspects(
  store: MarsDataStore,
  origin: GeoPoint,
  radiusKm: number,
  minCi: number,
  limit: number,
) {
  const { row: centerRow, col: centerCol } = gridIndex(origin.lat, origin.lon_east)
  const rowRadius = Math.ceil(radiusKm / (MARS_RADIUS_KM * (Math.PI / 180) * CELL_DEGREES)) + 1
  const cosine = Math.max(0.15, Math.abs(Math.cos((origin.lat * Math.PI) / 180)))
  const colRadius = Math.ceil(radiusKm / (MARS_RADIUS_KM * (Math.PI / 180) * CELL_DEGREES * cosine)) + 1
  let covered = 0
  let noData = 0
  const candidates: Array<Record<string, unknown> & { ci_0_1m: number; distance_km: number }> = []
  for (let row = Math.max(0, centerRow - rowRadius); row <= Math.min(GRID_ROWS - 1, centerRow + rowRadius); row += 1) {
    for (let offset = -colRadius; offset <= colRadius; offset += 1) {
      const col = (centerCol + offset + GRID_COLUMNS) % GRID_COLUMNS
      const point = cellCenter(row, col)
      const distance = distanceKm(origin, point)
      if (distance > radiusKm) continue
      const ci = store.value('swim_ci_0_1m', row, col)
      if (ci === null) {
        noData += 1
        continue
      }
      covered += 1
      if (ci < minCi) continue
      candidates.push({
        location: point,
        distance_km: Number(distance.toFixed(2)),
        distance_type: 'straight_line_great_circle; terrain traversability not evaluated',
        ci_0_1m: ci,
        unit: store.metadata.get('swim_ci_0_1m')?.units ?? 'dimensionless consistency index',
        source_id: 'swim_ci_0_1m',
        interpretation: 'Higher SWIM consistency is an orbital indicator for possible shallow ice, not confirmed or harvestable water.',
      })
    }
  }
  candidates.sort((a, b) => b.ci_0_1m - a.ci_0_1m || a.distance_km - b.distance_km)
  return {
    origin: { lat: origin.lat, lon_east: normalizeLongitude(origin.lon_east) },
    search: { radius_km: radiusKm, minimum_ci: minCi, limit },
    coverage: { sampled_cells_with_data: covered, sampled_no_data_cells: noData },
    source: store.metadata.get('swim_ci_0_1m'),
    candidates: candidates.slice(0, limit),
    caveat: 'The result ranks SWIM consistency cells within the search radius. Distances are straight-line and do not establish route traversability. SWIM does not establish water presence, concentration, accessibility, or extraction feasibility.',
  }
}
