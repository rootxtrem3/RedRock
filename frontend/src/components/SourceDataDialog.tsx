import { Database, ExternalLink, X } from 'lucide-react'

type SourceDataDialogProps = {
  onClose: () => void
}

const sources = [
  ['Mars surface texture', 'Viking imagery processed by USGS', 'NASA / JPL-Caltech'],
  ['Elevation & terrain', 'Mars Orbiter Laser Altimeter', 'MOLA / MGS'],
  ['Thermal context', 'Thermal Emission Imaging System', 'THEMIS / Mars Odyssey'],
  ['Mineral indicators', 'Compact Reconnaissance Imaging Spectrometer', 'CRISM / MRO'],
  ['Subsurface indicators', 'Orbital radar sounding', 'SHARAD / MARSIS'],
]

export function SourceDataDialog({ onClose }: SourceDataDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="source-dialog panel-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-heading">
          <div>
            <span className="eyebrow"><Database size={13} /> Scientific provenance</span>
            <h2 id="source-dialog-title">Source data</h2>
          </div>
          <button type="button" className="icon-button subtle" onClick={onClose} aria-label="Close source data">
            <X size={18} />
          </button>
        </div>
        <p className="drawer-intro">The interface distinguishes direct observations, derived indicators, and unavailable local data.</p>
        <div className="source-list">
          {sources.map(([name, detail, provider], index) => (
            <div className="source-row" key={name}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{name}</strong><p>{detail}</p><small>{provider}</small></div>
              <ExternalLink size={14} />
            </div>
          ))}
        </div>
        <div className="source-disclaimer">
          <strong>Operational notice</strong>
          <p>This frontend is a mission-interface prototype, not a validated navigation system. “Possible” findings remain scientific inferences, never certainties.</p>
        </div>
        <button type="button" className="secondary-action wide" onClick={onClose}>Close dataset record</button>
      </section>
    </div>
  )
}
