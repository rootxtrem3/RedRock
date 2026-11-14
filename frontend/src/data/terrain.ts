export type TerrainPatchDefinition = {
  id: string
  bounds: {
    north: number
    south: number
    west: number
    east: number
  }
  texture: string
  height: string
  imageryResolutionMeters: number
  elevationResolutionMeters: number
}

export const MOLA_ELEVATION_MIN_METERS = -8177
export const MOLA_ELEVATION_MAX_METERS = 21171
export const MARS_MEAN_RADIUS_METERS = 3_389_500

export const GLOBAL_TERRAIN = {
  texture: '/terrain/global/viking-global.webp',
  height: '/terrain/global/mola-height.png',
  textureResolutionMeters: 920,
  elevationResolutionMeters: 3705,
}

export const TERRAIN_PATCHES: Record<string, TerrainPatchDefinition> = {
  jezero: {
    id: 'jezero',
    bounds: { north: 21.3, south: 15.3, west: 74.45, east: 80.45 },
    texture: '/terrain/patches/jezero/themis.webp',
    height: '/terrain/patches/jezero/mola-height.png',
    imageryResolutionMeters: 231.55,
    elevationResolutionMeters: 463.1,
  },
  gale: {
    id: 'gale',
    bounds: { north: -2.4, south: -8.4, west: 134.8, east: 140.8 },
    texture: '/terrain/patches/gale/themis.webp',
    height: '/terrain/patches/gale/mola-height.png',
    imageryResolutionMeters: 231.55,
    elevationResolutionMeters: 463.1,
  },
  elysium: {
    id: 'elysium',
    bounds: { north: 7.5, south: 1.5, west: 132.9, east: 138.9 },
    texture: '/terrain/patches/elysium/themis.webp',
    height: '/terrain/patches/elysium/mola-height.png',
    imageryResolutionMeters: 231.55,
    elevationResolutionMeters: 463.1,
  },
  olympus: {
    id: 'olympus',
    bounds: { north: 21.65, south: 15.65, west: -136.8, east: -130.8 },
    texture: '/terrain/patches/olympus/themis.webp',
    height: '/terrain/patches/olympus/mola-height.png',
    imageryResolutionMeters: 231.55,
    elevationResolutionMeters: 463.1,
  },
  valles: {
    id: 'valles',
    bounds: { north: -11, south: -17, west: -73, east: -67 },
    texture: '/terrain/patches/valles/themis.webp',
    height: '/terrain/patches/valles/mola-height.png',
    imageryResolutionMeters: 231.55,
    elevationResolutionMeters: 463.1,
  },
}

export function getTerrainPatch(locationId?: string) {
  return locationId ? TERRAIN_PATCHES[locationId] : undefined
}
