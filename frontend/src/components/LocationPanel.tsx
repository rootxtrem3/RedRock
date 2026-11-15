import { ArrowLeft, ArrowRight, Database, Shield, X } from 'lucide-react'
import { formatLatitude, formatLongitude } from '../data/marsData'
import type { MarsLocation } from '../types'
import type { BackendLocationAnalysis } from '../data/backend'
import { useThemisPixelSample } from '../data/themisSample'

type LocationPanelProps = {
  location: MarsLocation
  analysis: BackendLocationAnalysis | null
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
  expanded,
  onExpand,
  onCollapse,
  onClose,
  onSurvival,
  onSources,
}: LocationPanelProps) {
  const themisSample = useThemisPixelSample(location.lat, location.lon)
  const themisValue = themisSample === undefined
    ? 'Loading orbital pixel'
    : themisSample.kind === 'no-coverage'
      ? 'No THEMIS coverage at this point'
      : themisSample.kind === 'load-error'
        ? 'THEMIS image failed to load'
      : `RGB ${themisSample.rgb.join(' / ')}`
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
          <DataRow label="THEMIS Day IR pixel" value={themisValue} />
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
          <DataRow label={analysis?.roughnessProxy?.value == null ? 'Roughness (catalog)' : 'Topographic relief proxy'} value={analysis?.roughnessProxy?.value == null ? 'Unavailable — no validated numeric global layer' : `${analysis.roughnessProxy.value.toFixed(0)} m (coarse MOLA)`} />
          <DataRow label="Thermal inertia" value={analysis?.thermalInertia?.value == null ? 'Unavailable — no validated numeric global layer' : `${analysis.thermalInertia.value} ${analysis.thermalInertia.unit ?? 'J m⁻² K⁻¹ s⁻½'}`} />
          <DataRow label="Slope" value={analysis?.slopeDegrees?.value == null ? 'Unavailable' : `${analysis.slopeDegrees.value.toFixed(1)}°`} />
          <DataRow label="Local relief" value={analysis?.localReliefMeters?.value == null ? 'Unavailable' : `${analysis.localReliefMeters.value.toFixed(0)} ${analysis.localReliefMeters.unit ?? 'm'}`} />
          {analysis?.roughnessProxy?.caveat && <p className="data-caveat">{analysis.roughnessProxy.caveat}</p>}
          <DataRow label="Surface class (catalog)" value={location.surface} />
        </section>

        <section className="panel-section">
          <div className="section-label"><span>03</span> Environment</div>
          <DataRow label="THEMIS Day IR pixel" value={themisValue} />
          <DataRow label="Dust level" value="Unavailable — no validated numeric global layer" />
          <DataRow label={analysis?.seasonalSolarSamples?.records?.length ? 'Modeled seasonal noon solar flux' : 'Solar potential'} value={analysis?.seasonalSolarSamples?.records?.length ? analysis.seasonalSolarSamples.records.map((sample) => `${sample.season.replaceAll('_', ' ')} ${Math.round(sample.flux_horizontal_w_m2)} W/m²`).join(' · ') : analysis?.solarFlux?.value == null ? 'Unavailable — no coordinate-specific model sample' : `${analysis.solarFlux.value.toLocaleString()} ${analysis.solarFlux.unit ?? 'W/m²'}`} />
          <DataRow label={analysis?.surfacePressurePa?.evidenceKind === 'modeled-estimate' ? 'Estimated surface pressure' : 'Surface pressure'} value={analysis?.surfacePressurePa?.value == null ? 'Unavailable — no estimate at this coordinate' : `${analysis.surfacePressurePa.value.toLocaleString()} ${analysis.surfacePressurePa.unit ?? 'Pa'}`} />
          <DataRow label="Dust opacity" value={analysis?.dustOpacity?.value == null ? 'Unavailable — no validated global map' : `${analysis.dustOpacity.value} ${analysis.dustOpacity.unit ?? ''}`} />
          <DataRow label="Radiation exposure" value={analysis?.radiation?.value == null ? location.id === 'gale' ? 'Unavailable globally — Curiosity RAD is a site reference' : 'Unavailable — no validated global map' : `${analysis.radiation.value} ${analysis.radiation.unit ?? ''}`} />
          {analysis?.surfacePressurePa?.caveat && <p className="data-caveat">{analysis.surfacePressurePa.caveat}</p>}
          {analysis?.seasonalSolarSamples?.caveat && <p className="data-caveat">{analysis.seasonalSolarSamples.caveat}</p>}
          {themisSample?.kind === 'sample' && <p className="data-caveat">Sampled from {themisSample.product} · {themisSample.resolution}. RGB is the colorized image pixel, not a temperature measurement.</p>}
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
