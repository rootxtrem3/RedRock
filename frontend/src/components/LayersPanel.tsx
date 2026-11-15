import { Check, ExternalLink, Layers3, X } from 'lucide-react'
import { LAYER_DEFINITIONS, type LayerDefinition } from '../data/layers'
import type { LayerId } from '../types'

type LayersPanelProps = {
  activeLayer: LayerId
  missionSitesVisible: boolean
  onLayerChange: (layer: LayerId) => void
  onMissionSitesChange: (visible: boolean) => void
  onClose: () => void
}

const layerGroups: Array<{
  name: LayerDefinition['group']
  ids: LayerId[]
}> = [
  { name: 'Base', ids: ['visual'] },
  { name: 'Terrain', ids: ['elevation', 'roughness'] },
  { name: 'Thermal', ids: ['day-temperature', 'thermal-inertia'] },
]

export function LayersPanel({
  activeLayer,
  missionSitesVisible,
  onLayerChange,
  onMissionSitesChange,
  onClose,
}: LayersPanelProps) {
  const active = LAYER_DEFINITIONS[activeLayer]
  const legend = active.legend

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
      <p className="drawer-intro">
        Measured NASA products rendered on the displaced MOLA surface. Select one
        primary layer to keep the planetary view legible.
      </p>

      <div className="layer-groups">
        {layerGroups.map((group) => (
          <div className="layer-group" key={group.name}>
            <span className="layer-group-name">{group.name}</span>
            {group.ids.map((id) => {
              const option = LAYER_DEFINITIONS[id]
              return (
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
                    <small>{option.note}</small>
                  </span>
                  {activeLayer === option.id && <Check size={15} />}
                </button>
              )
            })}
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
          <div className="section-label"><span>LEG</span> {active.label}</div>
          <div
            className="legend-scale"
            role="img"
            aria-label={`${legend.low} to ${legend.high}`}
            style={{
              backgroundImage: `linear-gradient(90deg, ${legend.stops.join(', ')})`,
            }}
          />
          <div className="legend-labels"><span>{legend.low}</span><span>{legend.high}</span></div>
          {legend.unit && <div className="legend-unit">{legend.unit}</div>}
          {legend.caption && <p className="legend-caption">{legend.caption}</p>}
          <p className="legend-description">{active.description}</p>
          <a
            className="legend-source"
            href={active.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span>{active.source}</span>
            <ExternalLink size={11} />
          </a>
          <div className="legend-resolution">{active.resolution}</div>
        </div>
      )}
    </aside>
  )
}
