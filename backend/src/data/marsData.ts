import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NpyGrid, type NpyKind } from './npyGrid.js'

const sourceDirectoryCandidates = [
  resolve(process.cwd(), 'data/mars/processed'),
  resolve(__dirname, '../../data/mars/processed'),
]

export type DatasetMetadata = {
  id: string
  path: string
  dtype?: string
  format?: string
  units: string
  no_data?: number
  source: string
  source_url?: string
  method?: string
  resolution_note?: string
  interpretation?: string
  [key: string]: unknown
}

export type SolarRecord = {
  site_id: string
  site_name: string
  season: string
  solar_longitude_degrees: number
  [key: string]: unknown
}

export type SiteSample = {
  id: string
  name: string
  lat: number
  lon_east: number
  swim_ci_0_1m: number | null
  [key: string]: unknown
}

export class MarsDataStore {
  readonly directory: string
  readonly manifest: Record<string, any>
  readonly siteSamples: SiteSample[]
  readonly solar: Record<string, any>
  readonly solarBySite = new Map<string, SolarRecord[]>()
  readonly grids: Record<string, NpyGrid>
  readonly metadata: Map<string, DatasetMetadata>

  constructor(directory = process.env.RED_ROCK_DATA_DIR ?? sourceDirectoryCandidates.find((candidate) => existsSync(resolve(candidate, 'manifest.json'))) ?? sourceDirectoryCandidates[0]) {
    this.directory = directory
    for (const required of ['manifest.json', 'site_samples.json', 'seasonal_solar_mcd_v6_2.json']) {
      if (!existsSync(resolve(directory, required))) throw new Error(`Required backend data is missing: ${resolve(directory, required)}`)
    }
    this.manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'))
    this.siteSamples = JSON.parse(readFileSync(resolve(directory, 'site_samples.json'), 'utf8')) as SiteSample[]
    this.solar = JSON.parse(readFileSync(resolve(directory, 'seasonal_solar_mcd_v6_2.json'), 'utf8'))
    this.metadata = new Map((this.manifest.datasets as DatasetMetadata[]).map((dataset) => [dataset.id, dataset]))

    const definitions: Array<[string, string, NpyKind]> = [
      ['mola_elevation', 'elevation_m_mola_3600x1800.npy', 'int16'],
      ['mola_slope', 'slope_degrees_mola_3600x1800.npy', 'float32'],
      ['mola_local_relief', 'local_relief_m_mola_3600x1800.npy', 'float32'],
      ['swim_ci_0_1m', 'swim_ci_0_1m_3600x1800.npy', 'float32'],
    ]
    this.grids = Object.fromEntries(definitions.map(([id, filename, kind]) => {
      const metadata = this.metadata.get(id)
      if (!metadata || typeof metadata.no_data !== 'number') throw new Error(`Manifest entry is missing for ${id}`)
      return [id, NpyGrid.load(directory, filename, kind, metadata.no_data)]
    }))
    for (const record of this.solar.records as SolarRecord[]) {
      const records = this.solarBySite.get(record.site_id) ?? []
      records.push(record)
      this.solarBySite.set(record.site_id, records)
    }
  }

  value(dataset: string, row: number, column: number): number | null {
    return this.grids[dataset]?.value(row, column) ?? null
  }

  site(id: string): SiteSample | undefined {
    return this.siteSamples.find((site) => site.id === id)
  }
}
