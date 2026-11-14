import { Check, Layers3, X } from 'lucide-react'
import type { LayerId } from '../types'

type LayersPanelProps = {
  activeLayer: LayerId
  missionSitesVisible: boolean
  onLayerChange: (layer: LayerId) => void
  onMissionSitesChange: (visible: boolean) => void
  onClose: () => void
}

const layerGroups: Array<{
  name: string
  options: Array<{ id: LayerId; label: string; note?: string }>
}> = [
  { name: 'Base', options: [{ id: 'visual', label: 'Visual Mars', note: 'Viking / JPL mosaic' }] },
  {
    name: 'Terrain',
    options: [
      { id: 'elevation', label: 'Elevation', note: 'MOLA' },
      { id: 'roughness', label: 'Surface roughness', note: 'Derived model' },
    ],
  },
  {
    name: 'Thermal',
    options: [
      { id: 'day-temperature', label: 'Day temperature', note: 'THEMIS' },
      { id: 'thermal-inertia', label: 'Thermal inertia', note: 'TES / THEMIS' },
    ],
  },
  {
    name: 'Minerals',
    options: [{ id: 'hydrated-minerals', label: 'Hydrated minerals', note: 'CRISM indicators' }],
  },
]

const legendLabels: Record<LayerId, [string, string] | null> = {
  visual: null,
  elevation: ['LOW', 'HIGH'],
  roughness: ['SMOOTH', 'ROUGH'],
  'day-temperature': ['COLD', 'WARM'],
  'thermal-inertia': ['LOW', 'HIGH'],
  'hydrated-minerals': ['NO INDICATOR', 'INDICATOR'],
}

export function LayersPanel({
  activeLayer,
  missionSitesVisible,
  onLayerChange,
  onMissionSitesChange,
  onClose,
}: LayersPanelProps) {
  const legend = legendLabels[activeLayer]

  return (
    <aside className="floating-panel layers-panel panel-enter" aria-label="Map layers">
      <div className="drawer-heading">
        <div>
          <span className="eyebrow"><Layers3 size={13} /> Orbital datasets</span>
          <h2>Map layers</h2>
        </div>
        <button type="button" className="icon-button subtle" onClick={onClose} aria-label="Close layers">
          <X size={18} />
        </button>
      </div>
      <p className="drawer-intro">Select one primary scientific layer to keep the planetary view legible.</p>

      <div className="layer-groups">
        {layerGroups.map((group) => (
          <div className="layer-group" key={group.name}>
            <span className="layer-group-name">{group.name}</span>
            {group.options.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`layer-option ${activeLayer === option.id ? 'is-active' : ''}`}
                onClick={() => onLayerChange(option.id)}
              >
                <span className="layer-radio">
                  {activeLayer === option.id && <span />}
                </span>
                <span>
                  <strong>{option.label}</strong>
                  {option.note && <small>{option.note}</small>}
                </span>
                {activeLayer === option.id && <Check size={15} />}
              </button>
            ))}
          </div>
        ))}
        <div className="layer-group">
          <span className="layer-group-name">Historical</span>
          <button
            type="button"
            className={`layer-option ${missionSitesVisible ? 'is-active' : ''}`}
            onClick={() => onMissionSitesChange(!missionSitesVisible)}
            aria-pressed={missionSitesVisible}
          >
            <span className="layer-checkbox">{missionSitesVisible && <Check size={12} />}</span>
            <span>
              <strong>Mission sites</strong>
              <small>Surface missions</small>
            </span>
          </button>
        </div>
      </div>

      {legend && (
        <div className="layer-legend">
          <div className="section-label"><span>LEG</span> {activeLayer.replaceAll('-', ' ')}</div>
          <div className={`legend-scale legend-${activeLayer}`}>
            {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
          </div>
          <div className="legend-labels"><span>{legend[0]}</span><span>{legend[1]}</span></div>
        </div>
      )}
    </aside>
  )
}
