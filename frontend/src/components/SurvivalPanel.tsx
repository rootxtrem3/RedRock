import {
  ArrowLeft,
  Check,
  ChevronRight,
  Database,
  Gauge,
  Navigation,
  Radio,
  Route,
  Shield,
  Sun,
  Thermometer,
  TriangleAlert,
  Wind,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  formatLatitude,
  formatLongitude,
  marsDistanceKm,
} from '../data/marsData'
import type { MarsLocation, Station } from '../types'

type RouteVariant = 'recommended' | 'shorter' | 'resource'

type SurvivalPanelProps = {
  location: MarsLocation
  station: Station
  routeVisible: boolean
  routeBusy: boolean
  routeStage: number
  routeVariant: RouteVariant
  onBack: () => void
  onCalculateRoute: () => void
  onRouteVariant: (variant: RouteVariant) => void
  onChooseStation: () => void
  onSources: () => void
}

const routeStages = [
  'Evaluating terrain…',
  'Checking hazard fields…',
  'Locating resource points…',
  'Optimizing safe corridor…',
]

const GUIDE_TABS = ['Environment', 'Hazards', 'Resources', 'Travel', 'Equipment', 'Emergency'] as const
type GuideTab = (typeof GUIDE_TABS)[number]

function parseThermalInertia(value: string) {
  const match = value.match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function estimateSurfaceTemperature(
  latitude: number,
  thermalInertia: number,
  seasonLs: number,
  localTime: number,
) {
  const radians = Math.PI / 180
  const obliquity = 25.19 * radians
  const eccentricity = 0.0934
  const solarLongitude = seasonLs * radians
  const perihelionLongitude = 251 * radians
  const distanceAu =
    1.523679 * (1 - eccentricity ** 2) /
    (1 + eccentricity * Math.cos(solarLongitude - perihelionLongitude))
  const solarFlux = 1361 / distanceAu ** 2
  const latitudeRadians = latitude * radians
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(solarLongitude))
  const sampleCount = 48
  let meanFlux = 0
  let cosineFlux = 0
  let sineFlux = 0

  for (let index = 0; index < sampleCount; index += 1) {
    const hourAngle = ((index / sampleCount) * 24 - 12) * (Math.PI / 12)
    const cosineZenith =
      Math.sin(latitudeRadians) * Math.sin(declination) +
      Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle)
    const absorbedFlux = Math.max(0, cosineZenith) * solarFlux * (1 - 0.25)
    meanFlux += absorbedFlux / sampleCount
    cosineFlux += (2 / sampleCount) * absorbedFlux * Math.cos(hourAngle)
    sineFlux += (2 / sampleCount) * absorbedFlux * Math.sin(hourAngle)
  }

  const emissivity = 0.95
  const stefanBoltzmann = 5.670374419e-8
  const assumedDownwellingInfrared = 10
  const meanKelvin = Math.pow(
    (meanFlux + assumedDownwellingInfrared) / (emissivity * stefanBoltzmann),
    0.25,
  )
  const marsSolSeconds = 88775
  const angularFrequency = (2 * Math.PI) / marsSolSeconds
  const radiativeConductance =
    4 * emissivity * stefanBoltzmann * meanKelvin ** 3
  const conductiveImpedance = thermalInertia * Math.sqrt(angularFrequency / 2)
  const forcingAmplitude = Math.hypot(cosineFlux, sineFlux)
  const temperatureAmplitude =
    forcingAmplitude /
    Math.hypot(radiativeConductance, conductiveImpedance)
  const forcingPhase = Math.atan2(sineFlux, cosineFlux)
  const thermalLag = Math.atan2(conductiveImpedance, radiativeConductance)
  const hourAngle = (localTime - 12) * (Math.PI / 12)
  const currentKelvin =
    meanKelvin + temperatureAmplitude * Math.cos(hourAngle - forcingPhase - thermalLag)

  return {
    currentCelsius: currentKelvin - 273.15,
    minimumCelsius: meanKelvin - temperatureAmplitude - 273.15,
    maximumCelsius: meanKelvin + temperatureAmplitude - 273.15,
  }
}

function formatTravelTime(distance: number) {
  const totalMinutes = Math.round((distance / 5) * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`
}

export function SurvivalPanel({
  location,
  station,
  routeVisible,
  routeBusy,
  routeStage,
  routeVariant,
  onBack,
  onCalculateRoute,
  onRouteVariant,
  onChooseStation,
  onSources,
}: SurvivalPanelProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>('Environment')
  const directDistance = useMemo(() => {
    return Math.max(0.1, marsDistanceKm(location, station))
  }, [location, station])
  const distance = directDistance * 1.08

  useEffect(() => {
    if (routeVisible) setActiveTab('Travel')
  }, [routeVisible])

  const routeOptions: Array<{
    id: RouteVariant
    label: string
    distance: number
    risk: string
    note: string
  }> = [
    { id: 'recommended', label: 'Recommended', distance, risk: 'Low', note: 'Safety prioritized' },
    { id: 'shorter', label: 'Shorter', distance: directDistance * 1.01, risk: 'High', note: 'Crosses unstable terrain' },
    { id: 'resource', label: 'Resource route', distance: directDistance * 1.25, risk: 'Low', note: 'Two supply points' },
  ]

  return (
    <aside className="floating-panel survival-panel panel-enter" aria-label={`Survival guide for ${location.name}`}>
      <header className="survival-header">
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeft size={16} /> Return to location
        </button>
        <div className="survival-title">
          <span className="eyebrow"><Shield size={13} /> Location-specific analysis</span>
          <h2>Survival guide</h2>
          <h3>{location.name}</h3>
          <p>{formatLatitude(location.lat)} · {formatLongitude(location.lon)}</p>
        </div>
        <div className="guide-status"><span /> Analysis ready <small>MGS-{location.id.slice(0, 3).toUpperCase()}</small></div>
      </header>

      <nav className="guide-index" role="tablist" aria-label="Survival guide sections">
        {GUIDE_TABS.map((item) => (
          <button
            type="button"
            key={item}
            role="tab"
            id={`guide-tab-${item.toLowerCase()}`}
            aria-selected={activeTab === item}
            aria-controls={`guide-${item.toLowerCase()}`}
            onClick={() => setActiveTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="survival-scroll">
        <section className="guide-section" id="guide-environment" role="tabpanel" aria-labelledby="guide-tab-environment" hidden={activeTab !== 'Environment'}>
          <div className="guide-section-heading">
            <span>01</span><div><small>Local conditions</small><h4>Environment</h4></div>
          </div>
          <div className="environment-grid">
            <article className="environment-primary">
              <Thermometer size={17} />
              <span>Prototype catalog temperature</span>
              <strong>{location.temperature}</strong>
            </article>
            <article><Gauge size={16} /><span>Pressure</span><strong>{location.pressure}</strong></article>
            <article><Navigation size={16} /><span>Gravity</span><strong>3.71 m/s²</strong></article>
            <article><Sun size={16} /><span>Solar exposure</span><strong>{location.solar}</strong></article>
            <article><Wind size={16} /><span>Dust</span><strong>{location.dust}</strong></article>
          </div>
          <ThermalEstimate key={location.id} location={location} />
          <p className="data-caveat">Orbital and mission observations. Conditions vary by season and local solar time.</p>
        </section>

        <section className="guide-section" id="guide-hazards" role="tabpanel" aria-labelledby="guide-tab-hazards" hidden={activeTab !== 'Hazards'}>
          <div className="guide-section-heading">
            <span>02</span><div><small>Ranked analysis</small><h4>Hazards</h4></div>
          </div>
          <div className="hazard-summary">
            <div className="hazard-level-mark"><TriangleAlert size={18} /><span>Overall hazard</span><strong>Elevated</strong></div>
            <p>Route planning should account for {location.hazards[0]?.name.toLowerCase() ?? 'local terrain'}.</p>
          </div>
          <div className="hazard-list">
            {(['High', 'Medium', 'Low'] as const).map((level) => {
              const matchingHazards = location.hazards.filter((hazard) => hazard.level === level)
              if (!matchingHazards.length) return null
              return (
                <div className={`hazard-group level-${level.toLowerCase()}`} key={level}>
                  <span className="hazard-rank">{level}</span>
                  <div>
                    {matchingHazards.map((hazard) => (
                      <div className="hazard-item" key={hazard.name}>
                        <strong>{hazard.name}</strong><small>{hazard.note}</small>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="guide-section" id="guide-resources" role="tabpanel" aria-labelledby="guide-tab-resources" hidden={activeTab !== 'Resources'}>
          <div className="guide-section-heading">
            <span>03</span><div><small>Evidence-based findings</small><h4>Resources</h4></div>
          </div>
          <div className="survival-resource-list">
            {location.resources.map((resource) => (
              <article key={resource.name}>
                <div className="resource-evidence-mark" />
                <div><span>{resource.name}</span><strong>{resource.status}</strong><small>Evidence: {resource.evidence}</small></div>
                <div className="confidence-badge"><span>{resource.confidence}</span><small>Confidence</small></div>
              </article>
            ))}
          </div>
          <button type="button" className="text-action" onClick={onSources}><Database size={14} /> Source data</button>
        </section>

        <section className="guide-section" id="guide-travel" role="tabpanel" aria-labelledby="guide-tab-travel" hidden={activeTab !== 'Travel'}>
          <div className="guide-section-heading">
            <span>04</span><div><small>Surface mobility</small><h4>Travel & shelter</h4></div>
          </div>
          <div className="travel-advice-grid">
            <article><Route size={17} /><strong>Traverse</strong><p>Avoid abrupt elevation changes and exposed sediment margins.</p></article>
            <article><Shield size={17} /><strong>Shelter</strong><p>Prioritize terrain depressions with stable access and relay visibility.</p></article>
            <article><Radio size={17} /><strong>Comms</strong><p>Maintain line-of-sight to the configured station relay network.</p></article>
          </div>
        </section>

        <section className="guide-section" id="guide-equipment" role="tabpanel" aria-labelledby="guide-tab-equipment" hidden={activeTab !== 'Equipment'}>
          <div className="guide-section-heading">
            <span>05</span><div><small>Mission loadout</small><h4>Equipment</h4></div>
          </div>
          <div className="equipment-list">
            {[
              ['Thermal survival layer', 'Required'],
              ['Dust-sealed power system', 'Required'],
              ['Radiation dosimeter', 'Required'],
              ['Terrain anchors', location.roughness.includes('Low') ? 'Optional' : 'Recommended'],
              ['72-hour emergency oxygen', 'Required'],
            ].map(([name, status]) => (
              <div key={name}><Check size={14} /><span>{name}</span><strong>{status}</strong></div>
            ))}
          </div>
        </section>

        <section className="guide-section emergency-section" id="guide-emergency" role="tabpanel" aria-labelledby="guide-tab-emergency" hidden={activeTab !== 'Emergency'}>
          <div className="guide-section-heading">
            <span>06</span><div><small>Contingency protocol</small><h4>Emergency</h4></div>
          </div>
          <div className="emergency-callout">
            <TriangleAlert size={19} />
            <div><strong>If mobility is lost</strong><p>Establish a relay beacon, conserve thermal power, and avoid unsurveyed slopes. Route markers identify two provisional refuge points.</p></div>
          </div>
        </section>

        {activeTab === 'Travel' && <section className="guide-section return-section" id="guide-return">
          <div className="guide-section-heading">
            <span>07</span><div><small>Safety-first navigation</small><h4>Return to station</h4></div>
          </div>

          <div className="route-endpoints">
            <div><span>Current</span><strong>{location.name}</strong><small>{formatLatitude(location.lat)} · {formatLongitude(location.lon)}</small></div>
            <div className="route-connector"><i /><ChevronRight size={15} /><i /></div>
            <button type="button" onClick={onChooseStation}>
              <span>Destination <em>Change</em></span><strong>{station.name}</strong><small>{formatLatitude(station.lat)} · {formatLongitude(station.lon)}</small>
            </button>
          </div>

          <div className="route-summary-grid">
            <div><span>Safe route</span><strong>{distance.toFixed(1)} km</strong></div>
            <div><span>Est. travel</span><strong>{formatTravelTime(distance)}</strong></div>
            <div><span>Initial risk</span><strong>Moderate</strong></div>
          </div>

          {routeBusy ? (
            <div className="route-calculating" aria-live="polite">
              <div className="route-progress-head"><span>Calculating safe route</span><strong>{Math.min(100, (routeStage + 1) * 25)}%</strong></div>
              <div className="route-progress-track"><span style={{ width: `${Math.min(100, (routeStage + 1) * 25)}%` }} /></div>
              <ul>
                {routeStages.map((stage, index) => (
                  <li className={index <= routeStage ? 'is-complete' : ''} key={stage}>
                    <span>{index < routeStage ? <Check size={11} /> : index + 1}</span>{stage}
                  </li>
                ))}
              </ul>
            </div>
          ) : !routeVisible ? (
            <button type="button" className="primary-action wide calculate-route" onClick={onCalculateRoute}>
              <Navigation size={16} /> Calculate safe route
            </button>
          ) : (
            <div className="route-results">
              <div className="route-optimized"><Shield size={15} /><span>Route optimized for safety</span><small>Distance is secondary</small></div>
              <div className="route-options">
                {routeOptions.map((route) => (
                  <button
                    type="button"
                    key={route.id}
                    className={routeVariant === route.id ? 'is-selected' : ''}
                    onClick={() => onRouteVariant(route.id)}
                  >
                    <span className="route-option-radio">{routeVariant === route.id && <i />}</span>
                    <span className="route-option-copy"><em>{route.label}</em><strong>{route.distance.toFixed(1)} km</strong><small>{route.note}</small></span>
                    <span className={`risk-tag risk-${route.risk.toLowerCase()}`}>Risk {route.risk}</span>
                    <span className="route-time">{formatTravelTime(route.distance)}</span>
                  </button>
                ))}
              </div>
              <div className="route-map-key"><span><i className="key-current" /> Current</span><span><i className="key-route" /> Safe route</span><span><i className="key-station" /> Station</span></div>
            </div>
          )}
        </section>}
      </div>
    </aside>
  )
}

function ThermalEstimate({ location }: { location: MarsLocation }) {
  const [thermalInertiaInput, setThermalInertiaInput] = useState(() => {
    const value = parseThermalInertia(location.thermalInertia)
    return value === null ? '' : String(value)
  })
  const [seasonLs, setSeasonLs] = useState(90)
  const [localTime, setLocalTime] = useState(14)
  const thermalInertia = Number(thermalInertiaInput)
  const estimate = useMemo(
    () =>
      Number.isFinite(thermalInertia) && thermalInertia >= 20 && thermalInertia <= 1500
        ? estimateSurfaceTemperature(location.lat, thermalInertia, seasonLs, localTime)
        : null,
    [localTime, location.lat, seasonLs, thermalInertia],
  )

  return (
    <section className="thermal-estimate" aria-label="Thermal inertia temperature estimate">
      <div className="thermal-estimate-heading">
        <div><span>SIMPLIFIED MODEL</span><strong>Thermal response estimate</strong></div>
        <Thermometer size={15} />
      </div>
      <label className="thermal-estimate-input">
        Thermal inertia <small>J m⁻² K⁻¹ s⁻½</small>
        <input
          type="number"
          min="20"
          max="1500"
          step="10"
          value={thermalInertiaInput}
          onChange={(event) => setThermalInertiaInput(event.target.value)}
          placeholder="Enter published value"
        />
      </label>
      <div className="thermal-estimate-controls">
        <label>Season, Ls <input type="range" min="0" max="360" step="5" value={seasonLs} onChange={(event) => setSeasonLs(Number(event.target.value))} /><small>{seasonLs}°</small></label>
        <label>Local solar time <select value={localTime} onChange={(event) => setLocalTime(Number(event.target.value))}>{[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}</select></label>
      </div>
      {estimate ? (
        <div className="thermal-estimate-results">
          <div><span>At selected time</span><strong>{estimate.currentCelsius.toFixed(0)}°C</strong></div>
          <div><span>First-harmonic range</span><strong>{estimate.minimumCelsius.toFixed(0)}° to {estimate.maximumCelsius.toFixed(0)}°C</strong></div>
        </div>
      ) : (
        <p className="thermal-estimate-empty">No numeric thermal-inertia sample is bundled for this site. Enter a published value to calculate an estimate.</p>
      )}
      <p className="thermal-estimate-caveat">First-harmonic surface energy-balance estimate. Assumes albedo 0.25, emissivity 0.95, and fixed 10 W/m² atmospheric infrared. Ignores slope, local shadows, dust opacity, weather, subsurface layering, and seasonal frost; not an observed temperature or mission-safety forecast. Pre-filled inertia values come from prototype site content and are not API-validated.</p>
      <a className="thermal-estimate-source" href="https://www.mars.asu.edu/data/tes_putzigti/nighttime2005/" target="_blank" rel="noreferrer">MGS TES nighttime thermal-inertia product ↗</a>
    </section>
  )
}
