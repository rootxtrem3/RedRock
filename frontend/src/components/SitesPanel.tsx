import { ArrowUpRight, Flag, X } from 'lucide-react'
import { formatLatitude, formatLongitude } from '../data/marsData'
import type { MarsLocation } from '../types'

type SitesPanelProps = {
  locations: MarsLocation[]
  onSelect: (location: MarsLocation) => void
  onClose: () => void
}

export function SitesPanel({ locations, onSelect, onClose }: SitesPanelProps) {
  return (
    <aside className="floating-panel sites-panel panel-enter" aria-label="Mars sites">
      <div className="drawer-heading">
        <div>
          <span className="eyebrow"><Flag size={13} /> Surface catalog</span>
          <h2>Mission sites</h2>
        </div>
        <button type="button" className="icon-button subtle" onClick={onClose} aria-label="Close sites">
          <X size={18} />
        </button>
      </div>
      <p className="drawer-intro">Select a catalogued surface mission or geological landmark.</p>
      <div className="site-list">
        {locations.map((location, index) => (
          <button type="button" className="site-row" key={location.id} onClick={() => onSelect(location)}>
            <span className="site-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="site-row-copy">
              <strong>{location.mission?.split('/')[1]?.trim() ?? location.name}</strong>
              <span>{location.name}</span>
              <small>{formatLatitude(location.lat)} · {formatLongitude(location.lon)}</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
    </aside>
  )
}
