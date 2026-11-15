export type SolarModelRecord = {
  site_id: string
  site_name: string
  season: string
  solar_longitude_degrees: number
  local_solar_time_hours: number
  altitude_m_above_local_surface: number
  dust_scenario: string
  flux_horizontal_w_m2: number
  flux_local_slope_w_m2: number
}

export type SolarModelResponse = {
  site_id: string
  model: string
  source_url: string
  interpretation: string
  records: SolarModelRecord[]
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export async function fetchSeasonalSolar(siteId: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ site_id: siteId })
  const response = await fetch(`${API_BASE}/api/solar?${query}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error(`Solar model request failed (${response.status})`)
  return (await response.json()) as SolarModelResponse
}
