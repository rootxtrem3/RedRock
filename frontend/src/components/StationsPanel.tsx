import { Check, Home, MapPin, Pencil, Plus, Radio, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { formatLatitude, formatLongitude } from '../data/marsData'
import type { Station } from '../types'

type StationDraft = {
  id?: string
  name: string
  code: string
  lat: string
  lon: string
}

type StationsPanelProps = {
  stations: Station[]
  activeStation: Station
  onSetHome: (stationId: string) => void
  onSave: (station: Station) => void
  onClose: () => void
}

const emptyDraft: StationDraft = {
  name: '',
  code: '',
  lat: '18.00',
  lon: '77.00',
}

export function StationsPanel({
  stations,
  activeStation,
  onSetHome,
  onSave,
  onClose,
}: StationsPanelProps) {
  const [draft, setDraft] = useState<StationDraft | null>(null)

  const editStation = (station: Station) => {
    setDraft({
      id: station.id,
      name: station.name,
      code: station.code,
      lat: station.lat.toString(),
      lon: station.lon.toString(),
    })
  }

  const submitStation = (event: FormEvent) => {
    event.preventDefault()
    if (!draft?.name.trim()) return
    const latitude = Number(draft.lat)
    const longitude = Number(draft.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

    onSave({
      id: draft.id ?? `station-${Date.now()}`,
      name: draft.name.trim(),
      code: (draft.code.trim() || draft.name.trim().charAt(0)).slice(0, 2).toUpperCase(),
      lat: Math.max(-90, Math.min(90, latitude)),
      lon: Math.max(-180, Math.min(180, longitude)),
      support: draft.id
        ? stations.find((station) => station.id === draft.id)?.support ?? ['Communication', 'Shelter']
        : ['Communication', 'Emergency shelter'],
      isHome: draft.id === activeStation.id,
    })
    setDraft(null)
  }

  return (
    <aside className="floating-panel stations-panel panel-enter" aria-label="Stations">
      <div className="drawer-heading">
        <div>
          <span className="eyebrow"><Radio size={13} /> Operational network</span>
          <h2>Stations</h2>
        </div>
        <button type="button" className="icon-button subtle" onClick={onClose} aria-label="Close stations">
          <X size={18} />
        </button>
      </div>

      {!draft ? (
        <>
          <div className="station-distinction">
            <div>
              <span>Selected map point</span>
              <strong>Surface target</strong>
            </div>
            <div>
              <span>Your station</span>
              <strong>{activeStation.name}</strong>
            </div>
          </div>

          <div className="station-list">
            {stations.map((station) => (
              <article className={`station-card ${station.isHome ? 'is-home' : ''}`} key={station.id}>
                <div className="station-card-top">
                  <span className="station-marker">{station.code}</span>
                  <div>
                    <span className="station-state">
                      {station.isHome ? <><Home size={12} /> Home station</> : 'Relay station'}
                    </span>
                    <h3>{station.name}</h3>
                    <p>{formatLatitude(station.lat)} · {formatLongitude(station.lon)}</p>
                  </div>
                  <button type="button" className="icon-button subtle" onClick={() => editStation(station)} aria-label={`Edit ${station.name}`}>
                    <Pencil size={15} />
                  </button>
                </div>
                <div className="support-list">
                  {station.support.map((item) => <span key={item}>{item}</span>)}
                </div>
                {!station.isHome && (
                  <button type="button" className="text-action" onClick={() => onSetHome(station.id)}>
                    <MapPin size={14} /> Set as home station
                  </button>
                )}
              </article>
            ))}
          </div>

          <button type="button" className="secondary-action wide create-station" onClick={() => setDraft(emptyDraft)}>
            <Plus size={16} /> Create station
          </button>
          <p className="station-note">Stations are configured operational points. Browser geolocation is not used.</p>
        </>
      ) : (
        <form className="station-form" onSubmit={submitStation}>
          <button type="button" className="back-button" onClick={() => setDraft(null)}>← Station network</button>
          <div>
            <span className="eyebrow">{draft.id ? 'Edit station' : 'New operational point'}</span>
            <h3>{draft.id ? 'Station information' : 'Create station'}</h3>
          </div>
          <label>
            <span>Station name</span>
            <input
              required
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Ares Base Alpha"
            />
          </label>
          <label>
            <span>Marker code</span>
            <input
              maxLength={2}
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              placeholder="A"
            />
          </label>
          <div className="form-coordinates">
            <label>
              <span>Latitude</span>
              <input
                type="number"
                min="-90"
                max="90"
                step="0.01"
                value={draft.lat}
                onChange={(event) => setDraft({ ...draft, lat: event.target.value })}
              />
            </label>
            <label>
              <span>Longitude</span>
              <input
                type="number"
                min="-180"
                max="180"
                step="0.01"
                value={draft.lon}
                onChange={(event) => setDraft({ ...draft, lon: event.target.value })}
              />
            </label>
          </div>
          <div className="coordinate-warning">
            <Check size={15} /> Coordinates are entered manually and treated as configured mission data.
          </div>
          <button type="submit" className="primary-action wide">Save station</button>
        </form>
      )}
    </aside>
  )
}
