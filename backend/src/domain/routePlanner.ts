import { MarsDataStore } from '../data/marsData.js'
import { cellCenter, distanceKm, GRID_COLUMNS, GRID_ROWS, gridIndex, normalizeLongitude, type GeoPoint } from './geospatial.js'

export type RouteMode = 'terrain' | 'shortest'

type Cell = { row: number; col: number }
type QueueEntry = { priority: number; sequence: number; cell: Cell }

class MinQueue {
  private values: QueueEntry[] = []

  get length() { return this.values.length }

  push(entry: QueueEntry) {
    this.values.push(entry)
    let index = this.values.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.values[parent].priority <= entry.priority) break
      this.values[index] = this.values[parent]
      index = parent
    }
    this.values[index] = entry
  }

  pop(): QueueEntry | undefined {
    const first = this.values[0]
    const last = this.values.pop()
    if (!first || !last || this.values.length === 0) return first
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      if (left >= this.values.length) break
      const child = right < this.values.length && this.values[right].priority < this.values[left].priority ? right : left
      if (this.values[child].priority >= last.priority) break
      this.values[index] = this.values[child]
      index = child
    }
    this.values[index] = last
    return first
  }
}

function cellKey(cell: Cell) { return `${cell.row}:${cell.col}` }

export function planRoute(
  store: MarsDataStore,
  startPoint: GeoPoint,
  endPoint: GeoPoint,
  mode: RouteMode,
  maxSlopeDegrees: number,
) {
  const directDistance = distanceKm(startPoint, endPoint)
  if (directDistance > 500) throw new RangeError('route_endpoints_must_be_within_500_km')
  if (Math.max(Math.abs(startPoint.lat), Math.abs(endPoint.lat)) > 80) {
    throw new RangeError('route_latitude_must_be_within_80_degrees_of_equator')
  }

  const startIndex = gridIndex(startPoint.lat, startPoint.lon_east)
  const endIndex = gridIndex(endPoint.lat, endPoint.lon_east)
  const endColumnUnwrapped = startIndex.col + Math.round(normalizeLongitude(endPoint.lon_east - startPoint.lon_east) / 0.1)
  const meanLatitude = (startPoint.lat + endPoint.lat) / 2
  const rowPadding = Math.max(12, Math.ceil((directDistance * 0.2) / 5.9276))
  const columnCellKm = 5.9276 * Math.max(0.15, Math.abs(Math.cos((meanLatitude * Math.PI) / 180)))
  const columnPadding = Math.max(12, Math.ceil((directDistance * 0.2) / columnCellKm))
  const bounds = {
    minRow: Math.max(0, Math.min(startIndex.row, endIndex.row) - rowPadding),
    maxRow: Math.min(GRID_ROWS - 1, Math.max(startIndex.row, endIndex.row) + rowPadding),
    minCol: Math.min(startIndex.col, endColumnUnwrapped) - columnPadding,
    maxCol: Math.max(startIndex.col, endColumnUnwrapped) + columnPadding,
  }
  const start = { row: startIndex.row, col: startIndex.col }
  const goal = { row: endIndex.row, col: endColumnUnwrapped }
  for (const [label, cell] of [['start', start], ['end', goal]] as const) {
    const col = ((cell.col % GRID_COLUMNS) + GRID_COLUMNS) % GRID_COLUMNS
    const elevation = store.value('mola_elevation', cell.row, col)
    const slope = store.value('mola_slope', cell.row, col)
    const relief = store.value('mola_local_relief', cell.row, col)
    if (elevation === null || slope === null || relief === null) throw new RangeError(`${label}_terrain_data_unavailable`)
    if (slope > maxSlopeDegrees) throw new RangeError(`${label}_exceeds_max_slope`)
  }

  const queue = new MinQueue()
  let sequence = 0
  const cameFrom = new Map<string, Cell | null>([[cellKey(start), null]])
  const costs = new Map<string, number>([[cellKey(start), 0]])
  const closed = new Set<string>()
  const blockedBySlope = new Set<string>()
  let expandedCells = 0
  const maximumExpansions = 30000
  const neighborDeltas = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]] as const
  const geo = (cell: Cell) => cellCenter(cell.row, ((cell.col % GRID_COLUMNS) + GRID_COLUMNS) % GRID_COLUMNS)
  const goalGeo = geo(goal)
  queue.push({ priority: distanceKm(geo(start), goalGeo), sequence: sequence++, cell: start })

  while (queue.length > 0 && expandedCells < maximumExpansions) {
    const currentEntry = queue.pop()
    if (!currentEntry) break
    const current = currentEntry.cell
    const currentKey = cellKey(current)
    if (closed.has(currentKey)) continue
    closed.add(currentKey)
    if (current.row === goal.row && current.col === goal.col) break
    expandedCells += 1

    const currentElevation = store.value('mola_elevation', current.row, ((current.col % GRID_COLUMNS) + GRID_COLUMNS) % GRID_COLUMNS)
    if (currentElevation === null) continue
    const currentGeo = geo(current)
    for (const [dRow, dCol] of neighborDeltas) {
      const neighbor = { row: current.row + dRow, col: current.col + dCol }
      if (neighbor.row < bounds.minRow || neighbor.row > bounds.maxRow || neighbor.col < bounds.minCol || neighbor.col > bounds.maxCol) continue
      const col = ((neighbor.col % GRID_COLUMNS) + GRID_COLUMNS) % GRID_COLUMNS
      const elevation = store.value('mola_elevation', neighbor.row, col)
      const slope = store.value('mola_slope', neighbor.row, col)
      const relief = store.value('mola_local_relief', neighbor.row, col)
      if (elevation === null || slope === null || relief === null) continue
      if (slope > maxSlopeDegrees) {
        blockedBySlope.add(cellKey(neighbor))
        continue
      }

      const neighborGeo = geo(neighbor)
      const segmentKm = distanceKm(currentGeo, neighborGeo)
      const grade = Math.abs(elevation - currentElevation) / Math.max(1, segmentKm * 1000)
      let factor = 1
      if (mode === 'terrain') {
        factor += Math.min(slope / maxSlopeDegrees, 2) * 1.5
        factor += Math.min(relief / 1000, 2) * 0.4
        factor += Math.min(grade, 0.5) * 2
      }
      const neighborKey = cellKey(neighbor)
      const nextCost = (costs.get(currentKey) ?? 0) + segmentKm * factor
      if (nextCost >= (costs.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue
      costs.set(neighborKey, nextCost)
      cameFrom.set(neighborKey, current)
      queue.push({
        priority: nextCost + distanceKm(neighborGeo, goalGeo),
        sequence: sequence++,
        cell: neighbor,
      })
    }
  }

  if (!cameFrom.has(cellKey(goal))) {
    if (expandedCells >= maximumExpansions) throw new RangeError('route_search_limit_reached_try_closer_endpoints')
    throw new RangeError('no_route_found_within_terrain_and_slope_constraints')
  }

  const cells: Cell[] = []
  let cursor: Cell | null | undefined = goal
  while (cursor) {
    cells.push(cursor)
    cursor = cameFrom.get(cellKey(cursor))
  }
  cells.reverse()
  const path = cells.map((cell, index) => {
    const col = ((cell.col % GRID_COLUMNS) + GRID_COLUMNS) % GRID_COLUMNS
    const point = cellCenter(cell.row, col)
    const elevation = store.value('mola_elevation', cell.row, col)
    const slope = store.value('mola_slope', cell.row, col)
    const relief = store.value('mola_local_relief', cell.row, col)
    const ice = store.value('swim_ci_0_1m', cell.row, col)
    const previousElevation = index === 0 ? null : store.value('mola_elevation', cells[index - 1].row, ((cells[index - 1].col % GRID_COLUMNS) + GRID_COLUMNS) % GRID_COLUMNS)
    const elevationChange = elevation === null || previousElevation === null ? null : Math.abs(elevation - previousElevation)
    let reason = 'Selected by the configured distance and terrain cost.'
    if (slope === null || relief === null) reason = 'Terrain inputs unavailable at this grid cell.'
    else if (slope >= maxSlopeDegrees * 0.75) reason = 'Near the configured maximum slope; inspect this coarse-grid section.'
    else if (relief >= 500) reason = 'Higher coarse local relief; route cost reflects terrain variability.'
    else if (elevationChange !== null && elevationChange >= 150) reason = 'Elevation change adds a grade penalty to this route segment.'
    return {
      lat: point.lat,
      lon_east: point.lon_east,
      elevation_m: elevation,
      slope_degrees: slope,
      elevation_change_m: elevationChange,
      local_relief_m: relief,
      ice_ci_0_1m: ice,
      reason,
    }
  })
  const geometry = [
    { lat: startPoint.lat, lon_east: normalizeLongitude(startPoint.lon_east) },
    ...cells.map(geo),
    { lat: endPoint.lat, lon_east: normalizeLongitude(endPoint.lon_east) },
  ].filter((point, index, all) => index === 0 || distanceKm(point, all[index - 1]) > 0.001)
  const pathDistance = geometry.slice(1).reduce((sum, point, index) => sum + distanceKm(geometry[index], point), 0)
  const stride = Math.max(1, Math.ceil(path.length / 80))
  const waypoints = path.flatMap((point, index) => index % stride === 0 || index === path.length - 1 ? [{ ...point, path_index: index }] : [])

  return {
    mode,
    start: { requested: startPoint, grid_cell: cellCenter(start.row, start.col) },
    end: { requested: endPoint, grid_cell: cellCenter(goal.row, goal.col % GRID_COLUMNS) },
    distance_km: Number(pathDistance.toFixed(3)),
    direct_distance_km: Number(directDistance.toFixed(3)),
    geometry,
    grid_resolution_degrees: 0.1,
    search: { expanded_cells: expandedCells, slope_cutoff_degrees: maxSlopeDegrees, blocked_slope_cells: blockedBySlope.size },
    weights: {
      slope_penalty: 1.5,
      slope_normalization_degrees: maxSlopeDegrees,
      local_relief_penalty: 0.4,
      local_relief_normalization_m: 1000,
      elevation_grade_penalty: 2,
      grade_fraction_cap: 0.5,
    },
    cost_model: mode === 'terrain'
      ? 'Distance multiplied by slope, coarse local-relief, and elevation-change penalties; cells above the slope cutoff are excluded.'
      : 'Distance only, with missing terrain cells and cells above the slope cutoff excluded.',
    path,
    waypoints,
    caveat: 'Exploratory route over a roughly 5.9 km equatorial grid. Not a safe-route guarantee and too coarse to identify local hazards.',
  }
}
