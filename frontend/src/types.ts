export type ResourceFinding = {
  name: string
  status: string
  confidence: 'High' | 'Moderate' | 'Low' | 'Unknown'
  evidence: string
}

export type Hazard = {
  name: string
  level: 'High' | 'Medium' | 'Low'
  note: string
}

export type MarsLocation = {
  id: string
  name: string
  type: 'Location' | 'Mission site' | 'Geological feature' | 'Coordinates' | 'Station'
  mission?: string
  lat: number
  lon: number
  elevation: string
  terrain: string
  temperature: string
  surface: string
  region: string
  geology: string
  overview: string
  roughness: string
  thermalInertia: string
  dust: string
  solar: string
  pressure: string
  resources: ResourceFinding[]
  hazards: Hazard[]
}

export type Station = {
  id: string
  name: string
  code: string
  lat: number
  lon: number
  support: string[]
  isHome: boolean
}

export type LayerId =
  | 'visual'
  | 'elevation'
  | 'roughness'
  | 'day-temperature'
  | 'thermal-inertia'
  | 'ice-consistency'
  | 'hydrated-minerals'
  | 'hematite'

export type CameraAction = {
  type: 'zoom-in' | 'zoom-out' | 'reset' | 'focus' | 'route'
  nonce: number
}
