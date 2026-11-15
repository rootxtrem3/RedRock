import type { LayerId } from '../types'

export type LayerLegend = {
  /** Colors ordered low → high (or cold → warm). */
  stops: string[]
  low: string
  high: string
  unit?: string
  caption?: string
}

export type LayerDefinition = {
  id: LayerId
  label: string
  shortLabel: string
  group: 'Base' | 'Terrain' | 'Thermal' | 'Minerals'
  note: string
  /** Globe overlay texture. The visual base layer is rendered separately. */
  texture: string | null
  opacity: number
  source: string
  sourceUrl: string
  resolution: string
  description: string
  legend?: LayerLegend
}

/**
 * All globe layers share the same 8K MOLA height map so every overlay
 * conforms to the displaced terrain instead of floating on a smooth sphere.
 */
export const LAYER_DEFINITIONS: Record<LayerId, LayerDefinition> = {
  visual: {
    id: 'visual',
    label: 'Visual Mars',
    shortLabel: 'Imagery',
    group: 'Base',
    note: 'Viking / JPL mosaic',
    texture: null,
    opacity: 1,
    source: 'NASA Viking Orbiter color mosaic / ASU Mars Global Data Sets',
    sourceUrl: 'https://www.mars.asu.edu/data/mdim_color/',
    resolution: '8K globe · ~2.6 km/pixel',
    description:
      'Colour mosaic from the Viking Orbiter imagers, resampled to a full-globe equirectangular texture.',
  },
  elevation: {
    id: 'elevation',
    label: 'Elevation',
    shortLabel: 'Elevation',
    group: 'Terrain',
    note: 'MOLA · 32 ppd',
    texture: '/terrain/global/mola-elevation.webp',
    opacity: 1,
    source: 'NASA MGS MOLA MEGDR v2.0 / PDS Geosciences Node',
    sourceUrl:
      'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/',
    resolution: '8K elevation · 32 ppd MOLA source',
    description:
      'Hypsometric color ramp over the measured MOLA global topography, with subtle northwest relief shading. The same 8K height map displaces the globe geometry, so relief is real rather than painted. Elevation is referenced to the Mars datum; negative values mark basins below it.',
    legend: {
      stops: [
        '#0c1f3f',
        '#183e6e',
        '#246492',
        '#3e8c96',
        '#78a587',
        '#b0b285',
        '#cba66c',
        '#be7b50',
        '#a64f39',
        '#c67056',
        '#f4ebdd',
      ],
      low: '−8,177 m',
      high: '+21,171 m',
      unit: 'MOLA elevation',
      caption: 'Measured laser altimetry · not a model',
    },
  },
  roughness: {
    id: 'roughness',
    label: 'Surface roughness',
    shortLabel: 'Roughness',
    group: 'Terrain',
    note: 'MOLA · 8 ppd',
    texture: '/terrain/layers/mola-roughness.webp',
    opacity: 1,
    source: 'MOLA vertical roughness composite / Kreslavsky & Head 2002',
    sourceUrl: 'https://www.mars.asu.edu/data/mola_roughness/',
    resolution: '8 ppd source · ~7.5 km/pixel',
    description:
      'RGB composite of MOLA vertical roughness at 0.6, 2.4 and 9.2 km baselines. Colours follow the published composite and are not a single scalar ramp.',
    legend: {
      stops: ['#171412', '#3d2c27', '#684638', '#95624a', '#c58b6a', '#efd2b4'],
      low: 'SMOOTH',
      high: 'ROUGH',
      caption: 'Published RGB baseline composite',
    },
  },
  'day-temperature': {
    id: 'day-temperature',
    label: 'Day IR brightness',
    shortLabel: 'Thermal',
    group: 'Thermal',
    note: 'THEMIS · 256 ppd',
    texture: '/terrain/layers/themis-day-ir.webp',
    opacity: 1,
    source:
      'NASA/JPL-Caltech/Arizona State University, Mars Odyssey THEMIS Day IR Global Mosaic v2.0',
    sourceUrl: 'https://www.mars.asu.edu/data/thm_dir/',
    resolution: '8K globe · 22.8 ppd from a 256 ppd published mosaic',
    description:
      'Daytime thermal infrared (12.57 µm) brightness mosaic. The published product is an 8-bit relative brightness image, so it is shown as a thermal ramp rather than as calibrated kinetic temperature. No-data gores stay transparent.',
    legend: {
      stops: [
        '#09081c',
        '#2b1146',
        '#6b1c52',
        '#b2313a',
        '#e76227',
        '#fab042',
        '#fff6d0',
      ],
      low: 'COOL / DARK',
      high: 'WARM / BRIGHT',
      unit: 'Relative day-IR brightness',
      caption: 'THEMIS 12.57 µm daytime mosaic',
    },
  },
  'thermal-inertia': {
    id: 'thermal-inertia',
    label: 'Thermal inertia',
    shortLabel: 'Inertia',
    group: 'Thermal',
    note: 'TES · 20 ppd',
    texture: '/terrain/layers/tes-thermal-inertia.webp',
    opacity: 1,
    source:
      'NASA/JPL/Arizona State University, MGS TES nighttime thermal inertia (Putzig et al. 2005)',
    sourceUrl: 'https://www.mars.asu.edu/data/tes_putzigti/nighttime2005/',
    resolution: '20 ppd source · ~3 km/pixel',
    description:
      'Nighttime thermal inertia retrieval from MGS TES, colorized with the published Putzig et al. (2005) scale. High inertia marks rock, indurated ground or sloping terrain; low inertia marks fine dust and loose regolith.',
    legend: {
      stops: ['#23202b', '#3d3a5a', '#6a657f', '#a89a86', '#d8bd8c', '#f1e2bd'],
      low: 'LOW · dust-like',
      high: 'HIGH · rock-like',
      unit: 'Thermal inertia (published color scale)',
      caption: 'TES nighttime retrieval · not a temperature map',
    },
  },
  'hydrated-minerals': {
    id: 'hydrated-minerals',
    label: 'Sheet silicates / glass',
    shortLabel: 'Mineral',
    group: 'Minerals',
    note: 'TES · 4 ppd',
    texture: '/terrain/layers/tes-sheet-silicates.webp',
    opacity: 1,
    source:
      'NASA/JPL/Arizona State University, MGS TES sheet-silicate / high-silica-glass abundance (Bandfield 2002)',
    sourceUrl: 'https://www.mars.asu.edu/data/tes_silicates/',
    resolution: '4 ppd source · ~16 km/pixel',
    description:
      'TES mineral-abundance indicator for sheet silicates and high-silica glass. This is a TES abundance product, not a CRISM hydration map.',
    legend: {
      stops: ['#5000d1', '#1936e3', '#066fd6', '#2adbf5', '#11e290', '#6fee63', '#ff000f'],
      low: '0%',
      high: '20%',
      unit: 'TES mineral abundance',
      caption: 'Source-colored scale · transparent pixels are no-data',
    },
  },
  hematite: {
    id: 'hematite',
    label: 'Hematite',
    shortLabel: 'Hematite',
    group: 'Minerals',
    note: 'TES · 4 ppd',
    texture: '/terrain/layers/tes-hematite.webp',
    opacity: 1,
    source:
      'NASA/JPL/Arizona State University, MGS TES hematite abundance (Bandfield 2002)',
    sourceUrl: 'https://www.mars.asu.edu/data/tes_hematite/',
    resolution: '4 ppd source · ~16 km/pixel',
    description:
      'TES hematite-abundance map. Distinct from the sheet-silicate product and useful for locating oxidized, dust-free surfaces.',
    legend: {
      stops: ['#5000d1', '#1936e3', '#066fd6', '#2adbf5', '#11e290', '#6fee63', '#ff000f'],
      low: '0%',
      high: '20%',
      unit: 'TES mineral abundance',
      caption: 'Source-colored scale · transparent pixels are no-data',
    },
  },
}

export const QUICK_LAYERS: Array<{ id: LayerId; label: string }> = [
  { id: 'elevation', label: 'Elevation' },
  { id: 'thermal-inertia', label: 'Thermal' },
  { id: 'visual', label: 'Imagery' },
]
