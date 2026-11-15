import type { MarsLocation, Station } from '../types'

export const locations: MarsLocation[] = [
  {
    id: 'jezero',
    name: 'Jezero Crater',
    type: 'Mission site',
    mission: 'Mars 2020 / Perseverance',
    lat: 18.38,
    lon: 77.58,
    elevation: '−2,550 m',
    terrain: 'Ancient lakebed',
    temperature: '−63°C',
    surface: 'Rocky / sedimentary',
    region: 'Isidis Planitia margin',
    geology: 'Deltaic crater basin',
    overview:
      'Ancient impact crater containing a preserved river delta and sedimentary terrain shaped by a long-vanished lake system.',
    roughness: 'Moderate',
    thermalInertia: '250 J m⁻² K⁻¹ s⁻½',
    dust: 'Moderate',
    solar: 'High',
    pressure: '~0.6 kPa',
    resources: [
      {
        name: 'Water ice',
        status: 'Possible',
        confidence: 'Moderate',
        evidence: 'SHARAD / MARSIS indicators',
      },
      {
        name: 'Hydrated minerals',
        status: 'Detected',
        confidence: 'High',
        evidence: 'CRISM spectral analysis',
      },
      {
        name: 'Solar energy',
        status: 'High potential',
        confidence: 'Moderate',
        evidence: 'Orbital illumination model',
      },
    ],
    hazards: [
      { name: 'Dust accumulation', level: 'High', note: 'Exposed delta surface' },
      { name: 'Extreme cold', level: 'Medium', note: 'Rapid night cooling' },
      { name: 'Terrain instability', level: 'Medium', note: 'Loose sediment slopes' },
      { name: 'Rockfall', level: 'Low', note: 'Localized crater margins' },
    ],
  },
  {
    id: 'olympus',
    name: 'Olympus Mons',
    type: 'Geological feature',
    lat: 18.65,
    lon: -133.8,
    elevation: '+21,229 m',
    terrain: 'Shield volcano',
    temperature: 'Data unavailable',
    surface: 'Basaltic volcanic rock',
    region: 'Tharsis Montes',
    geology: 'Volcanic shield / caldera',
    overview:
      'The largest known volcano in the Solar System, bordered by a steep basal escarpment and extensive lava plains.',
    roughness: 'High near escarpment',
    thermalInertia: 'Data unavailable',
    dust: 'Variable',
    solar: 'High',
    pressure: '<0.1 kPa at summit',
    resources: [
      {
        name: 'Lava-tube shelter',
        status: 'Possible',
        confidence: 'Low',
        evidence: 'Orbital morphology',
      },
      {
        name: 'Accessible regolith',
        status: 'Likely',
        confidence: 'Moderate',
        evidence: 'Surface imagery',
      },
      {
        name: 'Solar energy',
        status: 'High potential',
        confidence: 'Moderate',
        evidence: 'Elevation and illumination model',
      },
    ],
    hazards: [
      { name: 'Low atmospheric pressure', level: 'High', note: 'Extreme summit altitude' },
      { name: 'Steep terrain', level: 'High', note: 'Basal escarpment' },
      { name: 'Long-distance travel', level: 'Medium', note: 'Vast volcanic slopes' },
      { name: 'Loose regolith', level: 'Low', note: 'Localized deposits' },
    ],
  },
  {
    id: 'gale',
    name: 'Gale Crater',
    type: 'Mission site',
    mission: 'Mars Science Laboratory / Curiosity',
    lat: -5.4,
    lon: 137.8,
    elevation: '−4,500 m',
    terrain: 'Crater basin / mound',
    temperature: 'Variable',
    surface: 'Rocky / layered sediment',
    region: 'Aeolis quadrangle',
    geology: 'Sedimentary crater basin',
    overview:
      'A deep impact basin dominated by Aeolis Mons, whose layered deposits preserve a long record of changing Martian environments.',
    roughness: 'Moderate to high',
    thermalInertia: 'Variable by terrain',
    dust: 'Moderate',
    solar: 'Moderate',
    pressure: '~0.7 kPa',
    resources: [
      {
        name: 'Hydrated minerals',
        status: 'Detected',
        confidence: 'High',
        evidence: 'Curiosity / CRISM observations',
      },
      {
        name: 'Accessible regolith',
        status: 'Present',
        confidence: 'High',
        evidence: 'Surface mission observations',
      },
      {
        name: 'Natural shelter',
        status: 'Limited',
        confidence: 'Moderate',
        evidence: 'Orbital terrain model',
      },
    ],
    hazards: [
      { name: 'Extreme cold', level: 'High', note: 'Large diurnal range' },
      { name: 'Rugged terrain', level: 'Medium', note: 'Layered mound approaches' },
      { name: 'Dust accumulation', level: 'Medium', note: 'Crater floor deposits' },
      { name: 'Rockfall', level: 'Low', note: 'Near exposed scarps' },
    ],
  },
  {
    id: 'valles',
    name: 'Valles Marineris',
    type: 'Geological feature',
    lat: -14,
    lon: -70,
    elevation: 'Up to −7,000 m',
    terrain: 'Canyon system',
    temperature: 'Data unavailable',
    surface: 'Rock / landslide deposits',
    region: 'Equatorial highlands',
    geology: 'Tectonic canyon complex',
    overview:
      'A vast interconnected canyon system extending thousands of kilometers, with steep walls, layered deposits, and landslide terrain.',
    roughness: 'Very high',
    thermalInertia: 'Variable by slope',
    dust: 'Moderate to high',
    solar: 'Low on canyon floor',
    pressure: 'Variable with depth',
    resources: [
      {
        name: 'Hydrated minerals',
        status: 'Detected locally',
        confidence: 'High',
        evidence: 'CRISM spectral analysis',
      },
      {
        name: 'Potential shelter terrain',
        status: 'Possible',
        confidence: 'Low',
        evidence: 'Orbital morphology',
      },
      {
        name: 'Solar energy',
        status: 'Terrain limited',
        confidence: 'Moderate',
        evidence: 'Topographic shadow model',
      },
    ],
    hazards: [
      { name: 'Steep terrain', level: 'High', note: 'Multi-kilometer canyon walls' },
      { name: 'Rockfall', level: 'High', note: 'Active slope processes possible' },
      { name: 'Communication limits', level: 'Medium', note: 'Terrain occlusion' },
      { name: 'Low solar exposure', level: 'Medium', note: 'Deep canyon shadows' },
    ],
  },
  {
    id: 'elysium',
    name: 'Elysium Planitia',
    type: 'Mission site',
    mission: 'InSight landing region',
    lat: 4.5,
    lon: 135.9,
    elevation: '−2,600 m',
    terrain: 'Broad volcanic plain',
    temperature: 'Variable',
    surface: 'Regolith / volcanic plain',
    region: 'Elysium quadrangle',
    geology: 'Volcanic lowland',
    overview:
      'A comparatively smooth equatorial plain selected for its accessible terrain and studied in depth by the InSight lander.',
    roughness: 'Low',
    thermalInertia: 'Moderate',
    dust: 'Moderate',
    solar: 'High',
    pressure: '~0.7 kPa',
    resources: [
      {
        name: 'Accessible regolith',
        status: 'Present',
        confidence: 'High',
        evidence: 'InSight surface observations',
      },
      {
        name: 'Solar energy',
        status: 'High potential',
        confidence: 'Moderate',
        evidence: 'Equatorial illumination model',
      },
      {
        name: 'Water ice',
        status: 'Unconfirmed',
        confidence: 'Low',
        evidence: 'No local validated detection',
      },
    ],
    hazards: [
      { name: 'Dust accumulation', level: 'High', note: 'Solar array exposure' },
      { name: 'Extreme cold', level: 'Medium', note: 'Night surface conditions' },
      { name: 'Loose regolith', level: 'Low', note: 'Shallow surface layer' },
    ],
  },
]

export const initialStations: Station[] = [
  {
    id: 'ares-alpha',
    name: 'Ares Base Alpha',
    code: 'A',
    lat: 18.21,
    lon: 77.32,
    support: ['Communication', 'Shelter', 'Power', 'Water', 'Medical'],
    isHome: true,
  },
  {
    id: 'isidis-relay',
    name: 'Isidis Relay Outpost',
    code: 'I',
    lat: 12.9,
    lon: 87.1,
    support: ['Communication', 'Power', 'Emergency shelter'],
    isHome: false,
  },
  {
    id: 'olympus-support',
    name: 'Olympus Mons Survey Hub',
    code: 'O',
    lat: 17.2,
    lon: -132.4,
    support: ['Communication', 'Power', 'Emergency shelter'],
    isHome: false,
  },
  {
    id: 'gale-support',
    name: 'Gale Crater Survey Hub',
    code: 'G',
    lat: -4.8,
    lon: 138.1,
    support: ['Communication', 'Shelter', 'Medical'],
    isHome: false,
  },
  {
    id: 'valles-support',
    name: 'Valles Marineris Survey Hub',
    code: 'V',
    lat: -13.6,
    lon: -68.2,
    support: ['Communication', 'Emergency shelter'],
    isHome: false,
  },
  {
    id: 'elysium-support',
    name: 'Elysium Planitia Survey Hub',
    code: 'E',
    lat: 4.8,
    lon: 136.4,
    support: ['Communication', 'Power', 'Emergency shelter'],
    isHome: false,
  },
]

export function makeCoordinateLocation(lat: number, lon: number): MarsLocation {
  const latText = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`
  const lonText = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`

  return {
    id: `coordinates-${lat.toFixed(3)}-${lon.toFixed(3)}`,
    name: `${latText}, ${lonText}`,
    type: 'Coordinates',
    lat,
    lon,
    elevation: 'Data unavailable',
    terrain: 'Unsurveyed map point',
    temperature: 'Data unavailable',
    surface: 'Orbital raster data; ground class not inferred',
    region: 'Uncatalogued map point',
    geology: 'Data unavailable',
    overview:
      'A user-selected surface coordinate. Validated local datasets have not yet been attached to this point.',
    roughness: 'Data unavailable',
    thermalInertia: 'Data unavailable',
    dust: 'Data unavailable',
    solar: 'Data unavailable',
    pressure: 'Data unavailable',
    resources: [
      {
        name: 'Local resources',
        status: 'Analysis required',
        confidence: 'Unknown',
        evidence: 'No validated dataset loaded',
      },
    ],
    hazards: [
      { name: 'Unsurveyed terrain', level: 'High', note: 'Local data unavailable' },
      { name: 'Extreme cold', level: 'Medium', note: 'Planetary baseline hazard' },
      { name: 'Radiation exposure', level: 'Medium', note: 'Planetary baseline hazard' },
    ],
  }
}

export function formatLatitude(value: number) {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? 'N' : 'S'}`
}

export function formatLongitude(value: number) {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? 'E' : 'W'}`
}

export function marsDistanceKm(
  from: Pick<MarsLocation, 'lat' | 'lon'>,
  to: Pick<Station, 'lat' | 'lon'>,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = radians(to.lat - from.lat)
  const dLon = radians(to.lon - from.lon)
  const lat1 = radians(from.lat)
  const lat2 = radians(to.lat)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * 3389.5 * Math.asin(Math.sqrt(a))
}
