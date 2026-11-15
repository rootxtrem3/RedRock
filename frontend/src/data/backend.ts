export type EvidenceKind =
  | 'measured'
  | 'derived'
  | 'modeled'
  | 'published-map'
  | 'authored-scenario'
  | 'unavailable'

export type BackendValue<T> = {
  value: T | null
  unit?: string
  evidenceKind: EvidenceKind
  sourceName?: string
  sourceUrl?: string
  version?: string
  coverage?: 'global' | 'regional' | 'site' | 'none'
  confidence?: 'high' | 'moderate' | 'low' | 'unknown'
  resolution?: string
  caveat?: string
}

export type BackendLocationAnalysis = {
  locationId: string
  elevationMeters?: BackendValue<number>
  slopeDegrees?: BackendValue<number>
  localReliefMeters?: BackendValue<number>
  thermalInertia?: BackendValue<number>
  surfacePressurePa?: BackendValue<number>
  dustOpacity?: BackendValue<number>
  surfaceTemperature?: {
    currentCelsius: number | null
    minimumCelsius: number | null
    maximumCelsius: number | null
    seasonLsDegrees: number
    localSolarTimeHours: number
    modelName: string
    assumptions: string[]
    caveat: string
    sourceName?: string
    sourceUrl?: string
  } | null
  solarFlux?: BackendValue<number>
  radiation?: BackendValue<number>
  resources?: Array<{
    name: string
    status: string
    evidence: BackendValue<string>
  }>
  hazards?: Array<{
    name: string
    level: 'high' | 'medium' | 'low' | 'unknown'
    evidence: BackendValue<string>
  }>
  unknowns?: string[]
  updatedAt?: string
}

export type BackendRoutePlan = {
  routeId: string
  variant: 'recommended' | 'shorter' | 'resource'
  algorithm: string
  coverage: 'terrain-sampled' | 'geometry-only' | 'unavailable'
  points: Array<{
    lat: number
    lon: number
    elevationMeters: number | null
    slopeDegrees: number | null
  }>
  distanceKm: number
  estimatedTravelHours: number | null
  climbMeters: number | null
  descentMeters: number | null
  maximumSlopeDegrees: number | null
  waypoints: Array<{
    lat: number
    lon: number
    distanceKm: number
    title: string
    reason: string
    elevationMeters: number | null
  }>
  assumptions: string[]
  caveats: string[]
}

export type RouteRequest = {
  start: { id?: string; lat: number; lon: number }
  end: { id?: string; lat: number; lon: number }
  variant: BackendRoutePlan['variant']
  travelSpeedKmPerHour: number
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })
  if (!response.ok) throw new Error(`Backend request failed (${response.status})`)
  return (await response.json()) as T
}

export function fetchLocationAnalysis(
  location: { id?: string; lat: number; lon: number },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ lat: String(location.lat), lon: String(location.lon) })
  if (location.id) query.set('id', location.id)
  return request<BackendLocationAnalysis>(`/api/analysis/location?${query}`, { signal })
}

export function fetchRoutePlan(input: RouteRequest, signal?: AbortSignal) {
  return request<BackendRoutePlan>('/api/routes', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
