import { ArrowLeft, ArrowRight, Database, Shield, X } from 'lucide-react'
import { formatLatitude, formatLongitude } from '../data/marsData'
import type { MarsLocation } from '../types'
import type { BackendLocationAnalysis } from '../data/backend'

type LocationPanelProps = {
  location: MarsLocation
  analysis: BackendLocationAnalysis | null
  analysisLoading: boolean
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onClose: () => void
  onSurvival: () => void
  onSources: () => void
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="data-row">
      <span>{label}</span>
      <strong className={value.toLowerCase().includes('unavailable') ? 'is-unavailable' : ''}>
        {value}
      </strong>
    </div>
  )
}

export function LocationPanel({
  location,
  analysis,
  analysisLoading,
  expanded,
  onExpand,
  onCollapse,
  onClose,
  onSurvival,
  onSources,
}: LocationPanelProps) {
  if (!expanded) {
    return (
      <aside className="floating-panel location-card panel-enter" aria-label="Selected location">
        <div className="panel-kicker-row">
          <span className="eyebrow"><span className="status-pip" />Selected location</span>
          <button type="button" className="icon-button subtle" onClick={onClose} aria-label="Close location">
            <X size={17} />
          </button>
        </div>
        <div className="location-title-row">
          <div>
            <h2>{location.name}</h2>
            <p className="coordinate-line">
              {formatLatitude(location.lat)} <span /> {formatLongitude(location.lon)}
            </p>
          </div>
          <span className="location-index">{location.id === 'jezero' ? 'JZ-01' : 'MR-PT'}</span>
        </div>
        {location.mission && <p className="mission-tag">{location.mission}</p>}
        <div className="location-summary-grid">
          <DataRow label={analysis?.elevationMeters?.value == null ? 'Elevation (catalog)' : 'Elevation'} value={analysis?.elevationMeters?.value == null ? location.elevation : `${analysis.elevationMeters.value.toLocaleString()} ${analysis.elevationMeters.unit ?? 'm'}`} />
          <DataRow label="Terrain" value={location.terrain} />
          <DataRow label="Temperature estimate" value={analysis?.surfaceTemperature?.currentCelsius == null ? (analysisLoading ? 'Loading backend data' : 'Unavailable') : `${analysis.surfaceTemperature.currentCelsius.toFixed(1)}°C`} />
          <DataRow label="Surface" value={location.surface} />
        </div>
        <div className="panel-actions">
          <button type="button" className="primary-action" onClick={onSurvival}>
            <Shield size={16} />
            Survival
          </button>
          <button type="button" className="secondary-action" onClick={onExpand}>
            Details
            <ArrowRight size={16} />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="floating-panel detail-panel panel-enter" aria-label="Location details">
      <div className="detail-panel-header">
        <button type="button" className="back-button" onClick={onCollapse}>
          <ArrowLeft size={16} /> Compact view
        </button>
        <button type="button" className="icon-button subtle" onClick={onClose} aria-label="Close details">
          <X size={18} />
        </button>
      </div>
      <div className="detail-heading">
        <span className="eyebrow"><span className="status-pip" />Location dossier</span>
        <h2>{location.name}</h2>
        <p>{formatLatitude(location.lat)} · {formatLongitude(location.lon)}</p>
      </div>

      <div className="detail-scroll">
        <section className="panel-section">
          <div className="section-label"><span>01</span> Overview</div>
          <p className="overview-copy">{location.overview}</p>
          <div className="classification-line">
            <span>{location.region}</span>
            <span>{location.geology}</span>
          </div>
        </section>

        <section className="panel-section">
          <div className="section-label"><span>02</span> Terrain</div>
          <DataRow label={analysis?.elevationMeters?.value == null ? 'Elevation (catalog)' : 'Elevation'} value={analysis?.elevationMeters?.value == null ? location.elevation : `${analysis.elevationMeters.value.toLocaleString()} ${analysis.elevationMeters.unit ?? 'm'}`} />
          <DataRow label="Roughness" value={location.roughness} />
          <DataRow label={analysis?.thermalInertia?.value == null ? 'Thermal inertia (catalog)' : 'Thermal inertia'} value={analysis?.thermalInertia?.value == null ? location.thermalInertia : `${analysis.thermalInertia.value} ${analysis.thermalInertia.unit ?? 'J m⁻² K⁻¹ s⁻½'}`} />
          <DataRow label="Slope" value={analysis?.slopeDegrees?.value == null ? 'Unavailable' : `${analysis.slopeDegrees.value.toFixed(1)}°`} />
          <DataRow label="Local relief" value={analysis?.localReliefMeters?.value == null ? 'Unavailable' : `${analysis.localReliefMeters.value.toFixed(0)} ${analysis.localReliefMeters.unit ?? 'm'}`} />
          <DataRow label="Surface class" value={location.surface} />
        </section>

        <section className="panel-section">
          <div className="section-label"><span>03</span> Environment</div>
          <DataRow label="Surface temperature estimate" value={analysis?.surfaceTemperature?.currentCelsius == null ? (analysisLoading ? 'Loading backend data' : 'Unavailable') : `${analysis.surfaceTemperature.currentCelsius.toFixed(1)}°C`} />
          <DataRow label="Dust" value={location.dust} />
          <DataRow label="Solar flux" value={analysis?.solarFlux?.value == null ? location.solar : `${analysis.solarFlux.value.toLocaleString()} ${analysis.solarFlux.unit ?? 'W/m²'}`} />
          <DataRow label={analysis?.surfacePressurePa?.value == null ? 'Pressure (catalog)' : 'Pressure'} value={analysis?.surfacePressurePa?.value == null ? location.pressure : `${analysis.surfacePressurePa.value.toLocaleString()} ${analysis.surfacePressurePa.unit ?? 'Pa'}`} />
          <DataRow label="Dust opacity" value={analysis?.dustOpacity?.value == null ? 'Unavailable' : `${analysis.dustOpacity.value} ${analysis.dustOpacity.unit ?? ''}`} />
          <DataRow label="Radiation" value={analysis?.radiation?.value == null ? 'Unavailable' : `${analysis.radiation.value} ${analysis.radiation.unit ?? ''}`} />
        </section>

        <section className="panel-section">
          <div className="section-label"><span>04</span> Resource indicators</div>
          <div className="resource-list">
            {analysis?.resources !== undefined
              ? analysis.resources.map((resource) => (
                  <div className="resource-row" key={resource.name}>
                    <div><strong>{resource.name}</strong><small>{resource.evidence.sourceName ?? resource.evidence.value ?? resource.evidence.caveat ?? 'No evidence details returned'}</small></div>
                    <div className="resource-status"><span>{resource.status}</span><small>{resource.evidence.confidence ?? resource.evidence.evidenceKind}</small></div>
                  </div>
                ))
              : location.resources.map((resource) => (
                  <div className="resource-row" key={resource.name}>
                    <div><strong>{resource.name}</strong><small>Prototype evidence: {resource.evidence}</small></div>
                    <div className="resource-status"><span>{resource.status}</span><small>{resource.confidence} catalog confidence</small></div>
                  </div>
                ))}
          </div>
          {!analysis?.resources && <p className="data-caveat">Catalog resource rows are prototype content, not backend findings.</p>}
          <button type="button" className="text-action" onClick={onSources}>
            <Database size={14} /> Source data
          </button>
        </section>
      </div>

      <div className="detail-footer">
        <button type="button" className="primary-action wide" onClick={onSurvival}>
          Open survival guide <ArrowRight size={16} />
        </button>
      </div>
    </aside>
  )
}
