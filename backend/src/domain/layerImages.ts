import { PNG } from 'pngjs'
import { MarsDataStore } from '../data/marsData.js'
import type { NpyGrid } from '../data/npyGrid.js'

const ramp = {
  elevation: [[22, 39, 58], [61, 128, 120], [242, 194, 119]],
  slope: [[39, 111, 95], [231, 184, 92], [174, 60, 54]],
  'local-relief': [[37, 53, 79], [116, 135, 151], [241, 202, 121]],
  'ice-consistency': [[58, 43, 116], [75, 137, 180], [212, 233, 184]],
} as const

const layerDefinitions = {
  elevation: { dataset: 'mola_elevation', label: 'MOLA elevation', caveat: 'Orbital laser-altimetry elevations sampled to the coarse global grid.' },
  slope: { dataset: 'mola_slope', label: 'MOLA-derived slope', caveat: 'Slope is derived from the coarse MOLA elevation grid.' },
  'local-relief': { dataset: 'mola_local_relief', label: 'Coarse local relief', caveat: '3×3-cell elevation range; not an instrument roughness measurement.' },
  'ice-consistency': { dataset: 'swim_ci_0_1m', label: 'SWIM 0–1 m consistency', caveat: 'Signed orbital consistency indicator, not water volume or calibrated probability.' },
} as const

export type LayerId = keyof typeof layerDefinitions
const encodedCache = new Map<string, Buffer>()

export function isLayerId(value: string): value is LayerId {
  return Object.hasOwn(layerDefinitions, value)
}

export function layerCatalog(store: MarsDataStore) {
  return Object.entries(layerDefinitions).map(([id, definition]) => {
    const grid = store.grids[definition.dataset]
    const dataset = store.metadata.get(definition.dataset)
    return {
      id,
      label: definition.label,
      units: dataset?.units,
      source: dataset,
      coverage: {
        valid_cells: grid.validCount,
        no_data_cells: grid.missingCount,
        width: grid.columns,
        height: grid.rows,
      },
      display_scale: { min: grid.min, max: grid.max, method: 'linear stretch over all valid global cells' },
      texture_url: `/api/layers/${id}/texture.png`,
      coverage_url: `/api/layers/${id}/coverage.png`,
      caveat: definition.caveat,
    }
  })
}

function colorAt(t: number, stops: readonly (readonly number[])[]): [number, number, number] {
  const position = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const start = Math.floor(position)
  const end = Math.min(stops.length - 1, start + 1)
  const blend = position - start
  return [0, 1, 2].map((channel) => Math.round(stops[start][channel] * (1 - blend) + stops[end][channel] * blend)) as [number, number, number]
}

function encode(grid: NpyGrid, id: LayerId, coverage: boolean): Buffer {
  const cacheKey = `${id}:${coverage ? 'coverage' : 'texture'}`
  const cached = encodedCache.get(cacheKey)
  if (cached) return cached

  const image = new PNG({ width: grid.columns, height: grid.rows, colorType: 6 })
  const scale = grid.max - grid.min || 1
  const colors = ramp[id]
  for (let index = 0; index < grid.rows * grid.columns; index += 1) {
    const value = grid.valueAt(index)
    const offset = index * 4
    if (coverage) {
      image.data[offset] = value === null ? 224 : 39
      image.data[offset + 1] = value === null ? 100 : 181
      image.data[offset + 2] = value === null ? 86 : 157
      image.data[offset + 3] = 220
    } else if (value === null) {
      image.data[offset] = 0
      image.data[offset + 1] = 0
      image.data[offset + 2] = 0
      image.data[offset + 3] = 0
    } else {
      const [red, green, blue] = colorAt((value - grid.min) / scale, colors)
      image.data[offset] = red
      image.data[offset + 1] = green
      image.data[offset + 2] = blue
      image.data[offset + 3] = 235
    }
  }
  const result = PNG.sync.write(image, { deflateLevel: 6 })
  encodedCache.set(cacheKey, result)
  return result
}

export function getLayerImage(store: MarsDataStore, id: LayerId, coverage = false): Buffer {
  const definition = layerDefinitions[id]
  return encode(store.grids[definition.dataset], id, coverage)
}
