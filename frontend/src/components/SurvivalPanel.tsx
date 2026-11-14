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
import { useEffect, useMemo, useRef } from 'react'
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
  const routeSection = useRef<HTMLElement>(null)
  const directDistance = useMemo(() => {
    return Math.max(0.1, marsDistanceKm(location, station))
  }, [location, station])
  const distance = directDistance * 1.08

  useEffect(() => {
    if (routeVisible) routeSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

      <nav className="guide-index" aria-label="Survival guide sections">
        {['Environment', 'Hazards', 'Resources', 'Travel', 'Equipment', 'Emergency'].map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => document.getElementById(`guide-${item.toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth' })}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="survival-scroll">
        <section className="guide-section" id="guide-environment">
          <div className="guide-section-heading">
            <span>01</span><div><small>Local conditions</small><h4>Environment</h4></div>
          </div>
          <div className="environment-grid">
            <article className="environment-primary">
              <Thermometer size={17} />
              <span>Surface temperature</span>
              <strong>{location.temperature}</strong>
            </article>
            <article><Gauge size={16} /><span>Pressure</span><strong>{location.pressure}</strong></article>
            <article><Navigation size={16} /><span>Gravity</span><strong>3.71 m/s²</strong></article>
            <article><Sun size={16} /><span>Solar exposure</span><strong>{location.solar}</strong></article>
            <article><Wind size={16} /><span>Dust</span><strong>{location.dust}</strong></article>
          </div>
          <p className="data-caveat">Orbital and mission observations. Conditions vary by season and local solar time.</p>
        </section>

        <section className="guide-section" id="guide-hazards">
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

        <section className="guide-section" id="guide-resources">
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

        <section className="guide-section" id="guide-travel">
          <div className="guide-section-heading">
            <span>04</span><div><small>Surface mobility</small><h4>Travel & shelter</h4></div>
          </div>
          <div className="travel-advice-grid">
            <article><Route size={17} /><strong>Traverse</strong><p>Avoid abrupt elevation changes and exposed sediment margins.</p></article>
            <article><Shield size={17} /><strong>Shelter</strong><p>Prioritize terrain depressions with stable access and relay visibility.</p></article>
            <article><Radio size={17} /><strong>Comms</strong><p>Maintain line-of-sight to the configured station relay network.</p></article>
          </div>
        </section>

        <section className="guide-section" id="guide-equipment">
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

        <section className="guide-section emergency-section" id="guide-emergency">
          <div className="guide-section-heading">
            <span>06</span><div><small>Contingency protocol</small><h4>Emergency</h4></div>
          </div>
          <div className="emergency-callout">
            <TriangleAlert size={19} />
            <div><strong>If mobility is lost</strong><p>Establish a relay beacon, conserve thermal power, and avoid unsurveyed slopes. Route markers identify two provisional refuge points.</p></div>
          </div>
        </section>

        <section className="guide-section return-section" id="guide-return" ref={routeSection}>
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
        </section>
      </div>
    </aside>
  )
}
