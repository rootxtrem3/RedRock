import { ArrowLeft, ArrowRight, Database, Shield, X } from 'lucide-react'
import { formatLatitude, formatLongitude } from '../data/marsData'
import type { MarsLocation } from '../types'

type LocationPanelProps = {
  location: MarsLocation
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
          <DataRow label="Elevation" value={location.elevation} />
          <DataRow label="Terrain" value={location.terrain} />
          <DataRow label="Temperature" value={location.temperature} />
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
          <DataRow label="Elevation" value={location.elevation} />
          <DataRow label="Roughness" value={location.roughness} />
          <DataRow label="Thermal inertia" value={location.thermalInertia} />
          <DataRow label="Surface class" value={location.surface} />
        </section>

        <section className="panel-section">
          <div className="section-label"><span>03</span> Environment</div>
          <DataRow label="Surface temperature" value={location.temperature} />
          <DataRow label="Dust" value={location.dust} />
          <DataRow label="Solar exposure" value={location.solar} />
          <DataRow label="Pressure" value={location.pressure} />
        </section>

        <section className="panel-section">
          <div className="section-label"><span>04</span> Resource indicators</div>
          <div className="resource-list">
            {location.resources.map((resource) => (
              <div className="resource-row" key={resource.name}>
                <div>
                  <strong>{resource.name}</strong>
                  <small>{resource.evidence}</small>
                </div>
                <div className="resource-status">
                  <span>{resource.status}</span>
                  <small>{resource.confidence} confidence</small>
                </div>
              </div>
            ))}
          </div>
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
