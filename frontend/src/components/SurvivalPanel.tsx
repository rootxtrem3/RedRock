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
  TriangleAlert,
  Wind,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  formatLatitude,
  formatLongitude,
} from '../data/marsData'
import type { MarsLocation, Station } from '../types'
import type { BackendLocationAnalysis, BackendRoutePlan } from '../data/backend'
import { SeasonalSolarPanel } from './SeasonalSolarPanel'
import { useThemisPixelSample } from '../data/themisSample'

type RouteVariant = 'recommended' | 'shorter' | 'resource'
const ROUTE_VARIANTS: Array<{ id: RouteVariant; label: string }> = [
  { id: 'recommended', label: 'Balanced' },
  { id: 'shorter', label: 'Shortest' },
  { id: 'resource', label: 'SWIM consistency' },
]

function formatHours(hours: number | null | undefined) {
  if (hours == null || !Number.isFinite(hours)) return 'Unavailable'
  const minutes = Math.round(hours * 60)
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

type SurvivalPanelProps = {
  location: MarsLocation
  station: Station
  routeVisible: boolean
  routeBusy: boolean
  routeVariant: RouteVariant
  routePlan: BackendRoutePlan | null
  routeError: string | null
  analysis: BackendLocationAnalysis | null
  analysisLoading: boolean
  onBack: () => void
  onCalculateRoute: () => void
  onRouteVariant: (variant: RouteVariant) => void
  onChooseStation: () => void
  onSources: () => void
}

const GUIDE_TABS = ['Environment', 'Hazards', 'Resources', 'Travel', 'Equipment', 'Emergency'] as const
type GuideTab = (typeof GUIDE_TABS)[number]

export function SurvivalPanel({
  location,
  station,
  routeVisible,
  routeBusy,
  routeVariant,
  routePlan,
  routeError,
  analysis,
  analysisLoading,
  onBack,
  onCalculateRoute,
  onRouteVariant,
  onChooseStation,
  onSources,
}: SurvivalPanelProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>('Environment')
  const themisSample = useThemisPixelSample(location.lat, location.lon)
  const hazards = analysis?.hazards !== undefined
    ? analysis.hazards.map((hazard) => ({
        name: hazard.name,
        level: hazard.level === 'high' ? 'High' as const : hazard.level === 'medium' ? 'Medium' as const : hazard.level === 'low' ? 'Low' as const : 'Unknown' as const,
        note: hazard.evidence.value ?? hazard.evidence.caveat ?? 'No supporting detail returned',
      }))
    : location.hazards
  const hazardLevel = hazards.some((hazard) => hazard.level === 'High')
    ? 'High'
    : hazards.some((hazard) => hazard.level === 'Medium')
      ? 'Medium'
      : hazards.some((hazard) => hazard.level === 'Low')
        ? 'Low'
        : 'Unknown'
  useEffect(() => {
    if (routeVisible) setActiveTab('Travel')
  }, [routeVisible])

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
        <div className="guide-status"><span /> {analysisLoading ? 'Loading backend analysis' : analysis ? 'Backend analysis received' : 'Backend data unavailable'} <small>MGS-{location.id.slice(0, 3).toUpperCase()}</small></div>
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
              <Sun size={17} />
              <span>THEMIS Day IR pixel</span>
              <strong>{themisSample === undefined ? 'Loading…' : themisSample.kind === 'no-coverage' ? 'No coverage' : themisSample.kind === 'load-error' ? 'Image failed to load' : `RGB ${themisSample.rgb.join(' / ')}`}</strong>
            </article>
            <article><Gauge size={16} /><span>MOLA slope</span><strong>{analysis?.slopeDegrees?.value == null ? 'No coverage' : `${analysis.slopeDegrees.value.toFixed(1)}°`}</strong></article>
            <article><Navigation size={16} /><span>Gravity</span><strong>3.71 m/s²</strong></article>
            <article><Sun size={16} /><span>Seasonal solar flux</span><strong>See MCD samples below</strong></article>
            <article><Wind size={16} /><span>SWIM consistency · 0–1 m</span><strong>{analysis?.iceConsistency01m?.value == null ? 'No coverage' : `Ci ${analysis.iceConsistency01m.value.toFixed(3)}`}</strong></article>
          </div>
          <SeasonalSolarPanel location={location} />
          <ThemisObservation sample={themisSample} />
          <p className="data-caveat">MOLA slope is a coarse global indicator, SWIM Ci is an ice-consistency index rather than water certainty, and THEMIS pixels are colorized brightness—not temperature. MCD solar flux is modeled at local noon.</p>
        </section>

        <section className="guide-section" id="guide-hazards" role="tabpanel" aria-labelledby="guide-tab-hazards" hidden={activeTab !== 'Hazards'}>
          <div className="guide-section-heading">
            <span>02</span><div><small>Ranked analysis</small><h4>Hazards</h4></div>
          </div>
          <div className="hazard-summary">
          <div className="hazard-level-mark"><TriangleAlert size={18} /><span>Highest listed hazard</span><strong>{hazardLevel}</strong></div>
          <p>{analysis?.hazards ? 'Hazards returned by backend analysis.' : 'Prototype catalog hazards; backend assessment unavailable.'}</p>
          </div>
          <div className="hazard-list">
            {(['High', 'Medium', 'Low', 'Unknown'] as const).map((level) => {
              const matchingHazards = hazards.filter((hazard) => hazard.level === level)
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
            {analysis?.resources !== undefined
              ? analysis.resources.map((resource) => (
                  <article key={resource.name}>
                    <div className="resource-evidence-mark" />
                    <div><span>{resource.name}</span><strong>{resource.status}</strong><small>{resource.evidence.value ?? resource.evidence.caveat ?? 'No evidence detail returned'}</small></div>
                    <div className="confidence-badge"><span>{resource.evidence.confidence ?? 'Unknown'}</span><small>{resource.evidence.evidenceKind}</small></div>
                  </article>
                ))
              : location.resources.map((resource) => (
                  <article key={resource.name}>
                    <div className="resource-evidence-mark" />
                    <div><span>{resource.name}</span><strong>{resource.status}</strong><small>Prototype evidence: {resource.evidence}</small></div>
                    <div className="confidence-badge"><span>{resource.confidence}</span><small>Catalog confidence</small></div>
                  </article>
                ))}
          </div>
          {!analysis?.resources && <p className="data-caveat">These catalog findings are authored prototype content and have not been returned by the backend.</p>}
          <button type="button" className="text-action" onClick={onSources}><Database size={14} /> Source data</button>
        </section>

        <section className="guide-section" id="guide-travel" role="tabpanel" aria-labelledby="guide-tab-travel" hidden={activeTab !== 'Travel'}>
          <div className="guide-section-heading">
            <span>04</span><div><small>Surface mobility</small><h4>{routeVariant === 'resource' ? 'Prospect route' : 'Travel & shelter'}</h4></div>
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
            <div><strong>If mobility is lost</strong><p>Use established mission contingency procedures. Route waypoints here are exploratory map outputs, not verified navigation instructions, and this prototype does not identify validated refuge points.</p></div>
          </div>
        </section>

        {activeTab === 'Travel' && <section className="guide-section return-section" id="guide-return">
          <div className="guide-section-heading">
            <span>07</span><div><small>Exploratory route planning</small><h4>{routeVariant === 'resource' ? 'Route to a SWIM consistency cell' : 'Route to station'}</h4></div>
          </div>

          <div className="route-endpoints">
            <div><span>Current</span><strong>{location.name}</strong><small>{formatLatitude(location.lat)} · {formatLongitude(location.lon)}</small></div>
            <div className="route-connector"><i /><ChevronRight size={15} /><i /></div>
            {(routePlan?.variant === 'resource' && routePlan.destination?.type === 'swim-cell') ? (
              <div className="route-destination">
                <span>Destination</span>
                <strong>SWIM consistency cell</strong>
                <small>{formatLatitude(routePlan.destination.lat)} · {formatLongitude(routePlan.destination.lon)}</small>
                {routePlan.destination.swimCi01m != null && <small>Consistency index {routePlan.destination.swimCi01m.toFixed(2)} · {routePlan.destination.swimCi01m >= 0.3 ? 'positive indicator, not confirmed water' : 'below 0.3 positive-indicator threshold'}</small>}
                {routePlan.destination.straightLineDistanceKm != null && <small>{routePlan.destination.straightLineDistanceKm.toFixed(1)} km straight-line from start</small>}
              </div>
            ) : routeVariant === 'resource' ? (
              <div className="route-destination">
                <span>Destination</span>
                <strong>Nearby SWIM consistency cell</strong>
                <small>Route target is selected from reachable cells; it may be below the positive-indicator threshold.</small>
              </div>
            ) : (
              <button type="button" onClick={onChooseStation}>
                <span>Destination <em>Change</em></span><strong>{station.name}</strong><small>{formatLatitude(station.lat)} · {formatLongitude(station.lon)}</small>
              </button>
            )}
          </div>

          {routeBusy ? (
            <div className="route-calculating" aria-live="polite">Requesting the backend route planner…</div>
          ) : !routeVisible || !routePlan ? (
            <>
              {routeError && <p className="thermal-estimate-empty" role="alert">Route unavailable: {routeError}</p>}
            <button type="button" className="primary-action wide calculate-route" onClick={() => onCalculateRoute()}>
              <Navigation size={16} /> Request route plan
            </button>
            </>
          ) : (
            <div className="route-results">
              <div className="route-optimized"><Shield size={15} /><span>{routePlan.coverage === 'terrain-sampled' ? 'Terrain sampled' : routePlan.coverage === 'geometry-only' ? 'Geometry only' : 'Coverage unavailable'}</span><small>{routePlan.algorithm}</small></div>
              <div className="route-summary-grid">
                <div><span>Route distance</span><strong>{routePlan.distanceKm.toFixed(1)} km</strong></div>
                <div><span>Planning estimate</span><strong>{formatHours(routePlan.estimatedTravelHours)}</strong></div>
                <div><span>Max slope</span><strong>{routePlan.maximumSlopeDegrees == null ? 'Unavailable' : `${routePlan.maximumSlopeDegrees.toFixed(1)}°`}</strong></div>
              </div>
              <div className="route-options">
                {ROUTE_VARIANTS.map((route) => (
                  <button
                    type="button"
                    key={route.id}
                    className={routeVariant === route.id ? 'is-selected' : ''}
                    onClick={() => onRouteVariant(route.id)}
                  >
                    <span className="route-option-radio">{routeVariant === route.id && <i />}</span>
                    <span className="route-option-copy"><em>{route.label}</em><small>Recalculate with backend</small></span>
                  </button>
                ))}
              </div>
              <ol className="route-waypoints">{routePlan.waypoints.map((waypoint, index) => <li key={`${waypoint.lat}-${waypoint.lon}-${index}`}><strong>{waypoint.title}</strong><span>{waypoint.distanceKm.toFixed(1)} km</span><small>{waypoint.reason}</small></li>)}</ol>
              {routePlan.assumptions.map((assumption) => <p className="thermal-estimate-caveat" key={assumption}>Assumption: {assumption}</p>)}
              {routePlan.caveats.map((caveat) => <p className="thermal-estimate-caveat" key={caveat}>{caveat}</p>)}
            </div>
          )}
        </section>}
      </div>
    </aside>
  )
}

function ThemisObservation({
  sample,
}: {
  sample: ReturnType<typeof useThemisPixelSample>
}) {
  return (
    <section className="thermal-estimate" aria-label="THEMIS daytime thermal-infrared observation">
      <div className="thermal-estimate-heading">
        <div><span>ORBITAL OBSERVATION</span><strong>Daytime infrared at this point</strong></div>
        <Sun size={15} />
      </div>
      <div className="thermal-estimate-results">
        <div><span>Sampled image pixel</span><strong>{sample === undefined ? 'Loading…' : sample.kind === 'no-coverage' ? 'No coverage' : sample.kind === 'load-error' ? 'Image failed to load' : `RGB ${sample.rgb.join(' / ')}`}</strong></div>
        <div><span>Source resolution</span><strong>{sample?.kind === 'sample' ? sample.resolution : 'THEMIS Day IR'}</strong></div>
        <div><span>Surface temperature</span><strong>Not inferred from image color</strong></div>
      </div>
      <p className="thermal-estimate-caveat">{sample?.kind === 'sample' ? sample.product : 'NASA/JPL-Caltech/Arizona State University THEMIS Day IR'}; daytime 12.57 µm thermal-infrared brightness mosaic. This sampled RGB is a colorized display pixel, not a calibrated temperature in °C.</p>
      <a className="thermal-estimate-source" href="https://www.mars.asu.edu/data/thm_dir/" target="_blank" rel="noreferrer">THEMIS Day IR source ↗</a>
    </section>
  )
}
