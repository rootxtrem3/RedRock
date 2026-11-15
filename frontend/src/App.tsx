import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Database,
  Layers3,
  LocateFixed,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Satellite,
  Shield,
  Target,
} from 'lucide-react'
import './App.css'
import { LayersPanel } from './components/LayersPanel'
import { LocationPanel } from './components/LocationPanel'
import { MarsGlobe } from './components/MarsGlobe'
import {
  SearchNavigator,
  type SearchNavigatorHandle,
} from './components/SearchNavigator'
import { SitesPanel } from './components/SitesPanel'
import { SourceDataDialog } from './components/SourceDataDialog'
import { StationsPanel } from './components/StationsPanel'
import { SurvivalPanel } from './components/SurvivalPanel'
import {
  formatLatitude,
  formatLongitude,
  initialStations,
  locations,
  makeCoordinateLocation,
} from './data/marsData'
import { LAYER_DEFINITIONS, QUICK_LAYERS } from './data/layers'
import { getTerrainPatch, getTerrainPatchAt } from './data/terrain'
import {
  fetchLocationAnalysis,
  fetchRoutePlan,
  type BackendLocationAnalysis,
  type BackendRoutePlan,
} from './data/backend'
import type { CameraAction, LayerId, MarsLocation, Station } from './types'

type Drawer = 'sites' | 'stations' | 'layers' | null
type RouteVariant = 'recommended' | 'shorter' | 'resource'

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reducedMotion
}

function App() {
  const reducedMotion = useReducedMotion()
  const searchRef = useRef<SearchNavigatorHandle>(null)
  const routeRequest = useRef<AbortController | null>(null)
  const [selected, setSelected] = useState<MarsLocation | null>(null)
  const [stations, setStations] = useState<Station[]>(initialStations)
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [layer, setLayer] = useState<LayerId>('visual')
  const [missionSitesVisible, setMissionSitesVisible] = useState(true)
  const [globeReady, setGlobeReady] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(!reducedMotion)
  const [locationAnalysis, setLocationAnalysis] = useState<BackendLocationAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [focusToken, setFocusToken] = useState(0)
  const [zoom, setZoom] = useState(5.1)
  const [cameraAction, setCameraAction] = useState<CameraAction>({ type: 'reset', nonce: 0 })
  const [routeBusy, setRouteBusy] = useState(false)
  const [routeVisible, setRouteVisible] = useState(false)
  const [routeVariant, setRouteVariant] = useState<RouteVariant>('recommended')
  const [routePlan, setRoutePlan] = useState<BackendRoutePlan | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)

  const activeStation = useMemo(
    () => stations.find((station) => station.isHome) ?? stations[0],
    [stations],
  )
  const activeTerrainPatch =
    getTerrainPatch(selected?.id) ??
    (selected ? getTerrainPatchAt(selected.lat, selected.lon) : undefined)
  const activeLayer = LAYER_DEFINITIONS[layer]

  useEffect(() => {
    if (!selected) {
      setLocationAnalysis(null)
      setAnalysisLoading(false)
      return
    }
    const controller = new AbortController()
    setLocationAnalysis(null)
    setAnalysisLoading(true)
    fetchLocationAnalysis(selected, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setLocationAnalysis(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setLocationAnalysis(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnalysisLoading(false)
      })
    return () => controller.abort()
  }, [selected?.id, selected?.lat, selected?.lon])

  const handleGlobeReady = useCallback(() => setGlobeReady(true), [])

  useEffect(() => {
    const stopIntroMotion = (event: Event) => {
      if ((event.target as HTMLElement | null)?.closest('[data-auto-rotate-toggle]')) return
      setHasInteracted(true)
      setAutoRotateEnabled(false)
    }
    window.addEventListener('pointerdown', stopIntroMotion, true)
    window.addEventListener('keydown', stopIntroMotion, true)
    return () => {
      window.removeEventListener('pointerdown', stopIntroMotion, true)
      window.removeEventListener('keydown', stopIntroMotion, true)
    }
  }, [])

  const dispatchCamera = (type: CameraAction['type']) => {
    setCameraAction((current) => ({ type, nonce: current.nonce + 1 }))
  }

  const clearRouteCalculation = () => {
    routeRequest.current?.abort()
    routeRequest.current = null
    setRouteBusy(false)
  }

  const resetRoute = () => {
    clearRouteCalculation()
    setRouteVisible(false)
    setRoutePlan(null)
    setRouteError(null)
    setRouteVariant('recommended')
  }

  const selectLocation = (location: MarsLocation, openGuide = false) => {
    setSelected(location)
    setDetailExpanded(false)
    setGuideOpen(openGuide)
    setDrawer(null)
    resetRoute()
    setFocusToken((current) => current + 1)
  }

  const closeSelection = () => {
    setSelected(null)
    setGuideOpen(false)
    setDetailExpanded(false)
    resetRoute()
  }

  const calculateRoute = async (variant = routeVariant) => {
    if (!selected) return
    clearRouteCalculation()
    const controller = new AbortController()
    routeRequest.current = controller
    setRouteVisible(false)
    setRouteError(null)
    setRouteBusy(true)
    setRouteVariant(variant)
    try {
      const plan = await fetchRoutePlan({
        start: { id: selected.id, lat: selected.lat, lon: selected.lon },
        end: { id: activeStation.id, lat: activeStation.lat, lon: activeStation.lon },
        variant,
        travelSpeedKmPerHour: 5,
      }, controller.signal)
      if (controller.signal.aborted) return
      setRoutePlan(plan)
      setRouteVisible(true)
      dispatchCamera('route')
    } catch (error) {
      if (!controller.signal.aborted) {
        setRouteError(error instanceof Error ? error.message : 'Route service unavailable')
      }
    } finally {
      if (!controller.signal.aborted) {
        routeRequest.current = null
        setRouteBusy(false)
      }
    }
  }

  const chooseRouteVariant = (variant: RouteVariant) => {
    setRouteVariant(variant)
    void calculateRoute(variant)
  }

  const setHomeStation = (stationId: string) => {
    setStations((current) =>
      current.map((station) => ({ ...station, isHome: station.id === stationId })),
    )
    resetRoute()
  }

  const saveStation = (updatedStation: Station) => {
    setStations((current) => {
      const exists = current.some((station) => station.id === updatedStation.id)
      if (!exists) return [...current, updatedStation]
      return current.map((station) =>
        station.id === updatedStation.id ? { ...updatedStation, isHome: station.isHome } : station,
      )
    })
    resetRoute()
  }

  const toggleDrawer = (next: Exclude<Drawer, null>) => {
    setDrawer((current) => (current === next ? null : next))
  }

  const openSurvivalFromNavigation = () => {
    if (selected) {
      setGuideOpen(true)
      setDetailExpanded(false)
      setDrawer(null)
    } else {
      const jezero = locations.find((location) => location.id === 'jezero') ?? locations[0]
      selectLocation(jezero, true)
    }
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') {
        if (sourcesOpen) setSourcesOpen(false)
        else if (drawer) setDrawer(null)
        else if (guideOpen) setGuideOpen(false)
        else if (detailExpanded) setDetailExpanded(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [detailExpanded, drawer, guideOpen, sourcesOpen])

  useEffect(
    () => () => {
      routeRequest.current?.abort()
    },
    [],
  )

  const currentCoordinates = selected
    ? { lat: formatLatitude(selected.lat), lon: formatLongitude(selected.lon) }
    : { lat: '—', lon: '—' }

  return (
    <main className={`app-shell ${guideOpen ? 'guide-active' : ''} ${routeVisible ? 'route-active' : ''}`}>
      <MarsGlobe
        selected={selected}
        station={activeStation}
        cameraAction={cameraAction}
        focusToken={focusToken}
        layer={layer}
        missionSitesVisible={missionSitesVisible}
        routeVisible={routeVisible}
        routePlan={routePlan}
        knownLocations={locations}
        reducedMotion={reducedMotion}
        autoRotate={autoRotateEnabled}
        onSelect={selectLocation}
        onCoordinateSelect={(lat, lon) => selectLocation(makeCoordinateLocation(lat, lon))}
        onReady={handleGlobeReady}
        onZoomChange={setZoom}
      />

      <div className="screen-vignette" aria-hidden="true" />
      <div className="viewport-reticle" aria-hidden="true">
        <i className="reticle-top" /><i className="reticle-right" /><i className="reticle-bottom" /><i className="reticle-left" />
      </div>

      <header className="top-navigation">
        <button
          type="button"
          className="brand"
          onClick={() => {
            closeSelection()
            setDrawer(null)
            dispatchCamera('reset')
          }}
          aria-label="Return to planetary view"
        >
          <img
            className="brand-mark"
            src="/icon/red-rock-newer.png"
            alt=""
            aria-hidden="true"
          />
          <span className="brand-copy"><strong>RED-ROCK</strong><small>Mars operations</small></span>
        </button>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <button type="button" className={!drawer && !guideOpen ? 'is-active' : ''} onClick={() => { setDrawer(null); setGuideOpen(false); setDetailExpanded(false) }}>
            Explore
          </button>
          <button type="button" className={drawer === 'sites' ? 'is-active' : ''} onClick={() => toggleDrawer('sites')}>Sites</button>
          <button type="button" className={guideOpen ? 'is-active' : ''} onClick={openSurvivalFromNavigation}>Survival</button>
          <button type="button" className={drawer === 'stations' ? 'is-active' : ''} onClick={() => toggleDrawer('stations')}>Stations</button>
          <button type="button" className={drawer === 'layers' ? 'is-active' : ''} onClick={() => toggleDrawer('layers')}>Data</button>
        </nav>

        <div className="nav-operations">
          <div className="system-state"><span /><div><small>LINK</small><strong>ACTIVE</strong></div></div>
          <SearchNavigator ref={searchRef} locations={locations} onSelect={selectLocation} />
        </div>
      </header>

      {!hasInteracted && !selected && !drawer && (
        <section className="planet-intro panel-enter" aria-label="Mars planetary view">
          <span className="intro-index">01 / PLANETARY VIEW</span>
          <h1>Mars</h1>
          <p>Explore the surface. Assess the risk.<br />Find a safe route home.</p>
          <div className="intro-instruction"><Target size={15} /><span>Search or select a point on the globe</span></div>
        </section>
      )}

      {!drawer && selected && !guideOpen && (
        <LocationPanel
          location={selected}
          analysis={locationAnalysis}
          analysisLoading={analysisLoading}
          expanded={detailExpanded}
          onExpand={() => setDetailExpanded(true)}
          onCollapse={() => setDetailExpanded(false)}
          onClose={closeSelection}
          onSurvival={() => { setGuideOpen(true); setDetailExpanded(false) }}
          onSources={() => setSourcesOpen(true)}
        />
      )}

      {!drawer && selected && guideOpen && (
        <SurvivalPanel
          location={selected}
          station={activeStation}
          routeVisible={routeVisible}
          routeBusy={routeBusy}
          routeVariant={routeVariant}
          routePlan={routePlan}
          routeError={routeError}
          analysis={locationAnalysis}
          analysisLoading={analysisLoading}
          onBack={() => { setGuideOpen(false); resetRoute() }}
          onCalculateRoute={calculateRoute}
          onRouteVariant={chooseRouteVariant}
          onChooseStation={() => setDrawer('stations')}
          onSources={() => setSourcesOpen(true)}
        />
      )}

      {drawer === 'layers' && (
        <LayersPanel
          activeLayer={layer}
          missionSitesVisible={missionSitesVisible}
          onLayerChange={setLayer}
          onMissionSitesChange={setMissionSitesVisible}
          onClose={() => setDrawer(null)}
        />
      )}
      {drawer === 'sites' && (
        <SitesPanel locations={locations} onSelect={selectLocation} onClose={() => setDrawer(null)} />
      )}
      {drawer === 'stations' && (
        <StationsPanel
          stations={stations}
          activeStation={activeStation}
          onSetHome={setHomeStation}
          onSave={saveStation}
          onClose={() => setDrawer(null)}
        />
      )}

      <section className="orbital-data-widget" aria-label="Orbital data quick layers">
        <div className="orbital-widget-head">
          <Satellite size={15} />
          <div><strong>Mars orbital data</strong><span>LIVE DATASET 04</span></div>
        </div>
        <div className="quick-layers">
          {QUICK_LAYERS.map(({ id, label }) => (
            <button
              type="button"
              key={id}
              className={layer === id ? 'is-active' : ''}
              onClick={() => setLayer(id)}
            >
              <i />{label}
            </button>
          ))}
        </div>
        <button type="button" className="all-layers" onClick={() => setDrawer('layers')}>
          <Layers3 size={13} /> All layers
        </button>
      </section>

      {!drawer && layer !== 'visual' && activeLayer.legend && (
        <section className="layer-readout" aria-label={`${activeLayer.label} legend`}>
          <div className="layer-readout-head">
            <span>ACTIVE DATASET</span>
            <strong>{activeLayer.label}</strong>
          </div>
          <div
            className="layer-readout-scale"
            style={{
              backgroundImage: `linear-gradient(90deg, ${activeLayer.legend.stops.join(', ')})`,
            }}
          />
          <div className="layer-readout-labels">
            <span>{activeLayer.legend.low}</span>
            <span>{activeLayer.legend.high}</span>
          </div>
          <small>{activeLayer.legend.unit ?? activeLayer.resolution}</small>
        </section>
      )}

      <div className="compass-widget" aria-hidden="true">
        <span>N</span><i /><small>{selected ? 'TARGET' : 'ORBIT'}</small>
      </div>

      {activeTerrainPatch && (layer === 'visual' || layer === 'elevation') && (
        <div className="terrain-detail-indicator" aria-label="Local terrain resolution">
          <span />
          <div>
            <small>Local terrain loaded</small>
            <strong>{Math.round(activeTerrainPatch.imageryResolutionMeters)} m / pixel</strong>
          </div>
        </div>
      )}

      <div className="map-controls" aria-label="Map controls">
        <button type="button" onClick={() => dispatchCamera('zoom-in')} aria-label="Zoom in"><Plus size={19} /></button>
        <button type="button" onClick={() => dispatchCamera('zoom-out')} aria-label="Zoom out"><Minus size={19} /></button>
        <button type="button" onClick={() => dispatchCamera('reset')} aria-label="Center Mars"><RotateCcw size={17} /></button>
        <button type="button" className={selected ? 'is-active' : ''} onClick={() => dispatchCamera('focus')} disabled={!selected} aria-label="Focus selected location"><LocateFixed size={18} /></button>
        <button
          type="button"
          data-auto-rotate-toggle
          className={autoRotateEnabled ? 'is-active' : ''}
          onClick={() => {
            setHasInteracted(true)
            setAutoRotateEnabled((enabled) => !enabled)
          }}
          aria-label={autoRotateEnabled ? 'Stop Mars rotation' : 'Start Mars rotation'}
          aria-pressed={autoRotateEnabled}
          disabled={reducedMotion}
        ><RotateCw size={17} /></button>
      </div>

      <footer className="telemetry-bar">
        <div className="telemetry-primary">
          <span>LAT <strong>{currentCoordinates.lat}</strong></span>
          <span>LON <strong>{currentCoordinates.lon}</strong></span>
          <span className="telemetry-elevation">ELEV <strong>{selected?.elevation ?? '—'}</strong></span>
          <span>ZOOM <strong>{zoom.toFixed(1)}</strong></span>
        </div>
        <div className="telemetry-center">
          <span />
          <strong>
            {activeTerrainPatch &&
            (layer === 'visual' || layer === 'elevation') &&
            zoom >= 7
              ? `THEMIS ${Math.round(activeTerrainPatch.imageryResolutionMeters)} M/PIX`
              : activeLayer.label.toUpperCase()}
          </strong>
          <small>
            {activeTerrainPatch &&
            (layer === 'visual' || layer === 'elevation') &&
            zoom >= 7
              ? 'LOCAL DETAIL'
              : activeLayer.note.toUpperCase()}
          </small>
        </div>
        <div className="telemetry-source"><Database size={12} /><span>DATA</span><strong>MOLA / THEMIS / TES / CRISM</strong></div>
      </footer>

      <nav className="mobile-navigation" aria-label="Mobile navigation">
        <button type="button" className={!drawer && !guideOpen ? 'is-active' : ''} onClick={() => { setDrawer(null); setGuideOpen(false) }}><Target size={18} /><span>Explore</span></button>
        <button type="button" className={drawer === 'sites' ? 'is-active' : ''} onClick={() => toggleDrawer('sites')}><Satellite size={18} /><span>Sites</span></button>
        <button type="button" className={guideOpen ? 'is-active' : ''} onClick={openSurvivalFromNavigation}><Shield size={18} /><span>Survival</span></button>
        <button type="button" className={drawer === 'stations' ? 'is-active' : ''} onClick={() => toggleDrawer('stations')}><LocateFixed size={18} /><span>Stations</span></button>
      </nav>

      {!globeReady && (
        <div className="context-loading" role="status">
          <span className="loading-orbit"><i /></span>
          <div><strong>Loading planetary model</strong><small>NASA / JPL surface mosaic</small></div>
        </div>
      )}

      {analysisLoading && globeReady && (
        <div className="analysis-status" role="status">
          <span className="analysis-icon"><i /><i /></span>
          <div><strong>Loading site data</strong><small>Waiting for backend analysis</small></div>
        </div>
      )}

      {sourcesOpen && <SourceDataDialog onClose={() => setSourcesOpen(false)} />}
    </main>
  )
}

export default App
