import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Line, OrbitControls } from '@react-three/drei'
import {
  Canvas,
  useFrame,
  useLoader,
  useThree,
} from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  MathUtils,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { useGlobeTap } from '../hooks/useGlobeTap'
import { GlobeLighting } from './GlobeLighting'
import { GlobalLayerSphere } from './GlobalLayerSphere'
import { MapLocationPin } from './MapLocationPin'
import {
  GLOBAL_TERRAIN,
  MARS_MEAN_RADIUS_METERS,
  MOLA_ELEVATION_MAX_METERS,
  MOLA_ELEVATION_MIN_METERS,
  getTerrainPatch,
  getTerrainPatchAt,
  type TerrainPatchDefinition,
} from '../data/terrain'
import { LAYER_DEFINITIONS } from '../data/layers'
import { sharedHeightTexture } from '../data/textureCache'
import type { BackendRoutePlan } from '../data/backend'
import type { CameraAction, LayerId, MarsLocation, Station } from '../types'

const MARS_RADIUS = 1.16
const MARKER_SURFACE_CLEARANCE = 0.0015
let heightSampleCanvas: HTMLCanvasElement | null = null
const ORIGIN = new Vector3(0, 0, 0)
const TERRAIN_DISPLACEMENT_SCALE =
  ((MOLA_ELEVATION_MAX_METERS - MOLA_ELEVATION_MIN_METERS) /
    MARS_MEAN_RADIUS_METERS) *
  MARS_RADIUS
const TERRAIN_DISPLACEMENT_BIAS =
  (MOLA_ELEVATION_MIN_METERS / MARS_MEAN_RADIUS_METERS) * MARS_RADIUS

type MarsGlobeProps = {
  selected: MarsLocation | null
  station: Station
  cameraAction: CameraAction
  focusToken: number
  layer: LayerId
  missionSitesVisible: boolean
  routeVisible: boolean
  routePlan: BackendRoutePlan | null
  knownLocations: MarsLocation[]
  reducedMotion: boolean
  autoRotate: boolean
  onSelect: (location: MarsLocation) => void
  onCoordinateSelect: (lat: number, lon: number) => void
  onReady: () => void
  onZoomChange: (zoom: number) => void
}

function latLonVector(lat: number, lon: number, radius = MARS_RADIUS) {
  const latRadians = MathUtils.degToRad(lat)
  const lonRadians = MathUtils.degToRad(lon)
  return new Vector3(
    radius * Math.cos(latRadians) * Math.cos(lonRadians),
    radius * Math.sin(latRadians),
    -radius * Math.cos(latRadians) * Math.sin(lonRadians),
  )
}

function terrainVector(lat: number, lon: number, image?: HTMLImageElement | null) {
  if (!image?.naturalWidth || !image.naturalHeight) {
    return latLonVector(lat, lon, MARS_RADIUS + 0.012)
  }

  heightSampleCanvas ??= document.createElement('canvas')
  heightSampleCanvas.width = 2
  heightSampleCanvas.height = 2
  const context = heightSampleCanvas.getContext('2d', { willReadFrequently: true })
  if (!context) return latLonVector(lat, lon, MARS_RADIUS + 0.012)

  const width = image.naturalWidth
  const height = image.naturalHeight
  const x = ((lon + 180) / 360) * width
  const y = ((90 - MathUtils.clamp(lat, -90, 90)) / 180) * height
  const x0 = Math.floor(x) % width
  const x1 = (x0 + 1) % width
  const y0 = MathUtils.clamp(Math.floor(y), 0, height - 1)
  const y1 = MathUtils.clamp(y0 + 1, 0, height - 1)
  const xMix = x - Math.floor(x)
  const yMix = MathUtils.clamp(y - Math.floor(y), 0, 1)

  context.clearRect(0, 0, 2, 2)
  context.drawImage(image, x0, y0, 1, 1, 0, 0, 1, 1)
  context.drawImage(image, x1, y0, 1, 1, 1, 0, 1, 1)
  context.drawImage(image, x0, y1, 1, 1, 0, 1, 1, 1)
  context.drawImage(image, x1, y1, 1, 1, 1, 1, 1, 1)
  const pixels = context.getImageData(0, 0, 2, 2).data
  const top = pixels[0] * (1 - xMix) + pixels[4] * xMix
  const bottom = pixels[8] * (1 - xMix) + pixels[12] * xMix
  const gray = top * (1 - yMix) + bottom * yMix
  const elevation =
    MOLA_ELEVATION_MIN_METERS +
    (gray / 255) * (MOLA_ELEVATION_MAX_METERS - MOLA_ELEVATION_MIN_METERS)
  const radius =
    MARS_RADIUS * (1 + elevation / MARS_MEAN_RADIUS_METERS) +
    MARKER_SURFACE_CLEARANCE
  return latLonVector(lat, lon, radius)
}

function vectorLatLon(point: Vector3) {
  const normalized = point.clone().normalize()
  return {
    lat: MathUtils.radToDeg(Math.asin(normalized.y)),
    lon: MathUtils.radToDeg(Math.atan2(-normalized.z, normalized.x)),
  }
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 97.31) * 43758.5453
  return value - Math.floor(value)
}

function StaticStars() {
  const geometry = useMemo(() => {
    const positions: number[] = []
    for (let index = 0; index < 340; index += 1) {
      const radius = 7 + seededRandom(index + 1) * 5
      const theta = seededRandom(index + 12) * Math.PI * 2
      const phi = Math.acos(2 * seededRandom(index + 23) - 1)
      positions.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      )
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return result
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#b8b1a7"
        size={0.012}
        opacity={0.48}
        transparent
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function ScientificLayerGlobe({ layer }: { layer: LayerId }) {
  if (layer === 'visual') return null

  const definition = LAYER_DEFINITIONS[layer]
  const textureUrl =
    layer === 'elevation' ? GLOBAL_TERRAIN.elevation : definition.texture
  if (!textureUrl) return null

  return (
    <GlobalLayerSphere
      layerId={layer}
      visible
      textureUrl={textureUrl}
      heightUrl={GLOBAL_TERRAIN.height}
      opacity={definition.opacity}
    />
  )
}

function MarsSurface({
  layer,
  onHeightImage,
  onCoordinateSelect,
  onReady,
}: {
  layer: LayerId
  onHeightImage: (image: HTMLImageElement) => void
  onCoordinateSelect: (lat: number, lon: number) => void
  onReady: () => void
}) {
  const [sourceTexture, sourceHeight] = useLoader(TextureLoader, [
    GLOBAL_TERRAIN.texture,
    GLOBAL_TERRAIN.height,
  ])
  const { gl } = useThree()

  const texture = useMemo(() => {
    const configuredTexture = sourceTexture.clone()
    configuredTexture.colorSpace = SRGBColorSpace
    configuredTexture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    configuredTexture.needsUpdate = true
    return configuredTexture
  }, [gl, sourceTexture])

  // One shared 8K height texture serves the base globe and every overlay.
  const height = useMemo(
    () => sharedHeightTexture(sourceHeight, gl.capabilities.getMaxAnisotropy()),
    [gl, sourceHeight],
  )

  useEffect(() => {
    onReady()
  }, [onReady])

  useEffect(() => {
    onHeightImage(sourceHeight.image as HTMLImageElement)
  }, [onHeightImage, sourceHeight])

  const tap = useGlobeTap((event) => {
    const coordinates = vectorLatLon(event.point)
    onCoordinateSelect(coordinates.lat, coordinates.lon)
  })

  return (
    <group>
      <mesh {...tap}>
        <sphereGeometry args={[MARS_RADIUS, 384, 192]} />
        <meshStandardMaterial
          // Keep the Viking mosaic as the visual layer. Scientific overlays
          // have their own color ramps; leaving the red mosaic underneath
          // tints and obscures those measurements, especially at partial
          // opacity and around transparent no-data pixels.
          map={layer === 'visual' ? texture : undefined}
          color={layer === 'visual' ? '#ffffff' : '#252321'}
          displacementMap={height}
          displacementScale={TERRAIN_DISPLACEMENT_SCALE}
          displacementBias={TERRAIN_DISPLACEMENT_BIAS}
          bumpMap={height}
          bumpScale={0.0022}
          roughness={0.96}
          metalness={0}
        />
      </mesh>
    </group>
  )
}

function DetailTerrainPatch({
  patch,
  layer,
}: {
  patch: TerrainPatchDefinition
  layer: LayerId
}) {
  const [sourceTexture, sourceHeight, sourceElevation] = useLoader(TextureLoader, [
    patch.texture,
    patch.height,
    patch.elevation,
  ])
  const { gl } = useThree()

  const texture = useMemo(() => {
    const configuredTexture = sourceTexture.clone()
    configuredTexture.colorSpace = SRGBColorSpace
    configuredTexture.anisotropy = Math.min(12, gl.capabilities.getMaxAnisotropy())
    configuredTexture.needsUpdate = true
    return configuredTexture
  }, [gl, sourceTexture])

  const height = useMemo(
    () => sharedHeightTexture(sourceHeight, gl.capabilities.getMaxAnisotropy()),
    [gl, sourceHeight],
  )

  const elevation = useMemo(() => {
    const configuredElevation = sourceElevation.clone()
    configuredElevation.colorSpace = SRGBColorSpace
    configuredElevation.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    configuredElevation.needsUpdate = true
    return configuredElevation
  }, [gl, sourceElevation])

  useEffect(() => () => elevation.dispose(), [elevation])
  useEffect(() => () => texture.dispose(), [texture])

  const geometryArgs = useMemo(() => {
    const phiStart = MathUtils.degToRad(patch.bounds.west + 180)
    const phiLength = MathUtils.degToRad(patch.bounds.east - patch.bounds.west)
    const thetaStart = MathUtils.degToRad(90 - patch.bounds.north)
    const thetaLength = MathUtils.degToRad(patch.bounds.north - patch.bounds.south)
    return [
      MARS_RADIUS + 0.00015,
      192,
      192,
      phiStart,
      phiLength,
      thetaStart,
      thetaLength,
    ] as const
  }, [patch])

  return (
    <mesh renderOrder={2}>
      <sphereGeometry args={geometryArgs} />
      <meshStandardMaterial
        map={layer === 'elevation' ? elevation : texture}
        displacementMap={height}
        displacementScale={TERRAIN_DISPLACEMENT_SCALE}
        displacementBias={TERRAIN_DISPLACEMENT_BIAS}
        bumpMap={height}
        bumpScale={0.0035}
        color="#e8e2d8"
        roughness={1}
        metalness={0}
        transparent
        alphaTest={0.025}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  )
}

function Marker({
  location,
  selected,
  prominent,
  heightImage,
  onSelect,
}: {
  location: MarsLocation
  selected: boolean
  prominent: boolean
  heightImage: HTMLImageElement | null
  onSelect: (location: MarsLocation) => void
}) {
  const position = useMemo(
    () => terrainVector(location.lat, location.lon, heightImage),
    [heightImage, location.lat, location.lon],
  )

  return (
    <MapLocationPin
      position={position}
      selected={selected}
      prominent={prominent}
      onTap={() => onSelect(location)}
    />
  )
}

function StationMarker({
  station,
  heightImage,
}: {
  station: Station
  heightImage: HTMLImageElement | null
}) {
  const position = useMemo(
    () => terrainVector(station.lat, station.lon, heightImage),
    [heightImage, station.lat, station.lon],
  )

  return <MapLocationPin position={position} prominent color="#C7654C" />
}

function Route({ plan }: { plan: BackendRoutePlan }) {
  const points = useMemo(
    () => plan.points.map((point) => {
      const elevation = point.elevationMeters ?? 0
      const radius =
        MARS_RADIUS +
        (elevation / MARS_MEAN_RADIUS_METERS) * MARS_RADIUS +
        (point.elevationMeters == null ? 0.012 : 0.004)
      return latLonVector(point.lat, point.lon, radius)
    }),
    [plan.points],
  )
  const waypoints = useMemo(
    () => plan.waypoints.map((point) => latLonVector(point.lat, point.lon, MARS_RADIUS + 0.012)),
    [plan.waypoints],
  )

  if (points.length < 2) return null

  return (
    <group>
      <Line
        points={points}
        color={plan.coverage === 'terrain-sampled' ? '#c7654c' : '#c3a56b'}
        lineWidth={2.2}
        transparent
        opacity={0.95}
      />
      {waypoints.map((point, index) => (
          <mesh key={index} position={point}>
            <sphereGeometry args={[0.0022, 12, 12]} />
            <meshBasicMaterial color="#e8e2d8" />
          </mesh>
        ))}
    </group>
  )
}

function CameraRig({
  selected,
  station,
  cameraAction,
  focusToken,
  reducedMotion,
  autoRotate,
  onZoomChange,
}: Pick<
  MarsGlobeProps,
  | 'selected'
  | 'station'
  | 'cameraAction'
  | 'focusToken'
  | 'reducedMotion'
  | 'autoRotate'
  | 'onZoomChange'
>) {
  const { camera } = useThree()
  const controls = useRef<OrbitControlsType>(null)
  const animation = useRef<{
    from: Vector3
    to: Vector3
    elapsed: number
    duration: number
  } | null>(null)
  const [animating, setAnimating] = useState(false)
  const lastZoomUpdate = useRef(0)

  const beginMove = (target: Vector3, duration = 1.45) => {
    if (reducedMotion) {
      camera.position.copy(target)
      camera.lookAt(ORIGIN)
      controls.current?.update()
      return
    }
    animation.current = {
      from: camera.position.clone(),
      to: target,
      elapsed: 0,
      duration,
    }
    setAnimating(true)
  }

  useEffect(() => {
    if (!selected || focusToken === 0) return
    beginMove(latLonVector(selected.lat, selected.lon, 1.58))
    // beginMove intentionally follows an external navigation token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken])

  useEffect(() => {
    if (cameraAction.nonce === 0) return
    const currentDirection = camera.position.clone().normalize()
    const currentDistance = camera.position.length()
    const currentAltitude = Math.max(0.018, currentDistance - MARS_RADIUS)
    if (cameraAction.type === 'zoom-in') {
      const altitude = Math.max(0.018, currentAltitude * 0.58)
      beginMove(currentDirection.multiplyScalar(MARS_RADIUS + altitude), 0.42)
    } else if (cameraAction.type === 'zoom-out') {
      const altitude = Math.min(4.24, currentAltitude * 1.72)
      beginMove(currentDirection.multiplyScalar(MARS_RADIUS + altitude), 0.42)
    } else if (cameraAction.type === 'reset') {
      beginMove(new Vector3(0, 0.18, 3.72), 1.2)
    } else if (cameraAction.type === 'route' && selected) {
      const midpoint = latLonVector(selected.lat, selected.lon, 1)
        .add(latLonVector(station.lat, station.lon, 1))
        .normalize()
      beginMove(midpoint.multiplyScalar(MARS_RADIUS + 0.024), 1.2)
    } else if (selected) {
      beginMove(latLonVector(selected.lat, selected.lon, MARS_RADIUS + 0.075), 0.9)
    }
    // Camera actions are event objects keyed by nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraAction.nonce])

  useFrame((state, delta) => {
    if (animation.current) {
      animation.current.elapsed += delta
      const rawProgress = Math.min(
        animation.current.elapsed / animation.current.duration,
        1,
      )
      const progress = rawProgress * rawProgress * (3 - 2 * rawProgress)
      camera.position.lerpVectors(animation.current.from, animation.current.to, progress)
      camera.lookAt(ORIGIN)
      controls.current?.update()
      if (rawProgress >= 1) {
        animation.current = null
        setAnimating(false)
      }
    }

    const altitude = Math.max(0.018, camera.position.length() - MARS_RADIUS)
    const altitudeRatio = MathUtils.clamp(altitude / 2.56, 0, 1)

    if (controls.current) {
      // OrbitControls normally rotates by the same angle per pointer pixel at
      // every distance. Near the surface that feels dramatically accelerated,
      // so scale rotation down with altitude and shed inertia more quickly.
      controls.current.rotateSpeed = MathUtils.lerp(
        0.028,
        0.42,
        Math.pow(altitudeRatio, 0.75),
      )
      controls.current.dampingFactor = MathUtils.lerp(
        0.2,
        0.055,
        Math.sqrt(altitudeRatio),
      )
    }

    if (state.clock.elapsedTime - lastZoomUpdate.current > 0.24) {
      const zoom = MathUtils.clamp(2 + Math.log2(2.56 / altitude) * 1.6, 2, 16)
      onZoomChange(zoom)
      lastZoomUpdate.current = state.clock.elapsedTime
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.055}
      minDistance={MARS_RADIUS + 0.018}
      maxDistance={5.5}
      rotateSpeed={0.42}
      zoomSpeed={0.65}
      autoRotate={autoRotate && !selected && !reducedMotion && !animating}
      autoRotateSpeed={0.16}
      onStart={() => {
        animation.current = null
        setAnimating(false)
      }}
    />
  )
}

function GlobeScene(props: MarsGlobeProps) {
  const [heightImage, setHeightImage] = useState<HTMLImageElement | null>(null)
  const [cameraPatch, setCameraPatch] = useState<TerrainPatchDefinition | undefined>()
  const patchCheckTime = useRef(0)
  const { camera } = useThree()
  const showKnownLocations = props.missionSitesVisible || Boolean(props.selected)
  const selectedPatch =
    getTerrainPatch(props.selected?.id) ??
    (props.selected
      ? getTerrainPatchAt(props.selected.lat, props.selected.lon)
      : undefined)
  const terrainPatch = selectedPatch ?? cameraPatch

  useFrame((state) => {
    if (state.clock.elapsedTime - patchCheckTime.current < 0.4) return
    patchCheckTime.current = state.clock.elapsedTime
    if (selectedPatch) return
    const altitude = Math.max(0.018, camera.position.length() - MARS_RADIUS)
    const zoom = MathUtils.clamp(2 + Math.log2(2.56 / altitude) * 1.6, 2, 16)
    if (zoom < 7) {
      setCameraPatch((current) => current ? undefined : current)
      return
    }
    const viewCenter = vectorLatLon(camera.position)
    const nextPatch = getTerrainPatchAt(viewCenter.lat, viewCenter.lon)
    setCameraPatch((current) => current?.id === nextPatch?.id ? current : nextPatch)
  })

  return (
    <>
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 7, 13]} />
      <GlobeLighting />
      <StaticStars />
      <Suspense fallback={null}>
        <MarsSurface
          layer={props.layer}
          onHeightImage={setHeightImage}
          onCoordinateSelect={props.onCoordinateSelect}
          onReady={props.onReady}
        />
      </Suspense>
      <ScientificLayerGlobe layer={props.layer} />
      {terrainPatch &&
        (props.layer === 'visual' || props.layer === 'elevation') && (
          <Suspense fallback={null}>
            <DetailTerrainPatch
              key={terrainPatch.id}
              patch={terrainPatch}
              layer={props.layer}
            />
          </Suspense>
        )}
      {showKnownLocations &&
        props.knownLocations.map((location) => (
          <Marker
            key={location.id}
            location={location}
            selected={props.selected?.id === location.id}
            prominent={props.missionSitesVisible && location.type === 'Mission site'}
            heightImage={heightImage}
            onSelect={props.onSelect}
          />
        ))}
      {props.selected && !props.knownLocations.some((item) => item.id === props.selected?.id) && (
        <Marker
          location={props.selected}
          selected
          prominent
          heightImage={heightImage}
          onSelect={props.onSelect}
        />
      )}
      <StationMarker station={props.station} heightImage={heightImage} />
      {props.routeVisible && props.routePlan && (
        <Route plan={props.routePlan} />
      )}
      <CameraRig
        selected={props.selected}
        station={props.station}
        cameraAction={props.cameraAction}
        focusToken={props.focusToken}
        reducedMotion={props.reducedMotion}
        autoRotate={props.autoRotate}
        onZoomChange={props.onZoomChange}
      />
    </>
  )
}

export function MarsGlobe(props: MarsGlobeProps) {
  return (
    <div className="globe-canvas" aria-label="Interactive three-dimensional map of Mars">
      <Canvas
        camera={{ position: [0, 0.18, 3.72], fov: 42, near: 0.002, far: 40 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(new Color('#050505'))
        }}
      >
        <GlobeScene {...props} />
      </Canvas>
    </div>
  )
}
