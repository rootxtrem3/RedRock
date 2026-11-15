import { Database, ExternalLink, X } from 'lucide-react'

type SourceDataDialogProps = {
  onClose: () => void
}

const sources = [
  {
    name: 'Surface imagery',
    detail: 'Viking Orbiter color mosaic · 8K globe texture',
    provider: 'NASA / USGS / ASU Mars Global Data Sets',
    url: 'https://www.mars.asu.edu/data/mdim_color/',
  },
  {
    name: 'Elevation & terrain',
    detail: 'MOLA MEGDR 32 ppd · 8K height + colorized relief',
    provider: 'NASA MGS / PDS Geosciences Node',
    url: 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/',
  },
  {
    name: 'Daytime thermal',
    detail: 'THEMIS Day IR global mosaic · 256 ppd source',
    provider: 'NASA / JPL-Caltech / Arizona State University',
    url: 'https://www.mars.asu.edu/data/thm_dir/',
  },
  {
    name: 'Thermal inertia',
    detail: 'TES nighttime retrieval · Putzig et al. (2005)',
    provider: 'NASA / JPL / Arizona State University',
    url: 'https://www.mars.asu.edu/data/tes_putzigti/nighttime2005/',
  },
  {
    name: 'Mineral indicators',
    detail: 'TES sheet silicates & high-silica glass · Bandfield (2002)',
    provider: 'NASA / JPL / Arizona State University',
    url: 'https://www.mars.asu.edu/data/tes_silicates/',
  },
  {
    name: 'Hematite abundance',
    detail: 'TES hematite indicator · Bandfield (2002)',
    provider: 'NASA / JPL / Arizona State University',
    url: 'https://www.mars.asu.edu/data/tes_hematite/',
  },
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
          {sources.map((source, index) => (
            <a
              className="source-row"
              key={source.name}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{source.name}</strong><p>{source.detail}</p><small>{source.provider}</small></div>
              <ExternalLink size={14} />
            </a>
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
