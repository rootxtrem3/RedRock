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
  type TerrainPatchDefinition,
} from '../data/terrain'
import { LAYER_DEFINITIONS } from '../data/layers'
import { sharedHeightTexture } from '../data/textureCache'
import type { CameraAction, LayerId, MarsLocation, Station } from '../types'

const MARS_RADIUS = 1.16
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
  routeVariant: 'recommended' | 'shorter' | 'resource'
  knownLocations: MarsLocation[]
  reducedMotion: boolean
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
  onCoordinateSelect,
  onReady,
}: {
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

  const tap = useGlobeTap((event) => {
    const coordinates = vectorLatLon(event.point)
    onCoordinateSelect(coordinates.lat, coordinates.lon)
  })

  return (
    <group>
      <mesh {...tap}>
        <sphereGeometry args={[MARS_RADIUS, 384, 192]} />
        <meshStandardMaterial
          map={texture}
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
  onSelect,
}: {
  location: MarsLocation
  selected: boolean
  prominent: boolean
  onSelect: (location: MarsLocation) => void
}) {
  const position = useMemo(
    () => latLonVector(location.lat, location.lon, MARS_RADIUS + 0.009),
    [location.lat, location.lon],
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

function StationMarker({ station }: { station: Station }) {
  const position = useMemo(
    () => latLonVector(station.lat, station.lon, MARS_RADIUS + 0.009),
    [station.lat, station.lon],
  )

  return <MapLocationPin position={position} prominent color="#C7654C" />
}

function greatCirclePoints(
  start: Vector3,
  end: Vector3,
  variant: 'recommended' | 'shorter' | 'resource',
) {
  const startNormal = start.clone().normalize()
  const endNormal = end.clone().normalize()
  const angle = startNormal.angleTo(endNormal)
  const points: Vector3[] = []
  const count = 80
  const detour =
    variant === 'recommended'
      ? angle * 0.16
      : variant === 'resource'
        ? angle * -0.32
        : 0
  const tangent = new Vector3().crossVectors(startNormal, endNormal).normalize()

  for (let index = 0; index <= count; index += 1) {
    const progress = index / count
    let normal: Vector3
    if (angle < 0.0001) {
      normal = startNormal.clone()
    } else {
      const firstWeight = Math.sin((1 - progress) * angle) / Math.sin(angle)
      const secondWeight = Math.sin(progress * angle) / Math.sin(angle)
      normal = startNormal
        .clone()
        .multiplyScalar(firstWeight)
        .add(endNormal.clone().multiplyScalar(secondWeight))
        .normalize()
    }
    if (detour !== 0) {
      normal.addScaledVector(tangent, Math.sin(progress * Math.PI) * detour).normalize()
    }
    points.push(normal.multiplyScalar(MARS_RADIUS + 0.0045))
  }
  return points
}

function Route({
  selected,
  station,
  variant,
}: {
  selected: MarsLocation
  station: Station
  variant: 'recommended' | 'shorter' | 'resource'
}) {
  const points = useMemo(
    () =>
      greatCirclePoints(
        latLonVector(selected.lat, selected.lon),
        latLonVector(station.lat, station.lon),
        variant,
      ),
    [selected.lat, selected.lon, station.lat, station.lon, variant],
  )

  const emergencyPoints = useMemo(
    () => [points[Math.floor(points.length * 0.34)], points[Math.floor(points.length * 0.72)]],
    [points],
  )

  return (
    <group>
      <Line
        points={points}
        color={variant === 'recommended' ? '#c7654c' : '#e8e2d8'}
        lineWidth={variant === 'recommended' ? 2.2 : 1.4}
        transparent
        opacity={0.95}
      />
      {variant === 'recommended' &&
        emergencyPoints.map((point, index) => (
          <mesh key={index} position={point}>
            <sphereGeometry args={[0.0015, 12, 12]} />
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
  onZoomChange,
}: Pick<
  MarsGlobeProps,
  | 'selected'
  | 'station'
  | 'cameraAction'
  | 'focusToken'
  | 'reducedMotion'
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
      autoRotate={!selected && !reducedMotion && !animating}
      autoRotateSpeed={0.16}
      onStart={() => {
        animation.current = null
        setAnimating(false)
      }}
    />
  )
}

function GlobeScene(props: MarsGlobeProps) {
  const showKnownLocations = props.missionSitesVisible || Boolean(props.selected)
  const terrainPatch = getTerrainPatch(props.selected?.id)

  return (
    <>
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 7, 13]} />
      <GlobeLighting />
      <StaticStars />
      <Suspense fallback={null}>
        <MarsSurface
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
            onSelect={props.onSelect}
          />
        ))}
      {props.selected && !props.knownLocations.some((item) => item.id === props.selected?.id) && (
        <Marker
          location={props.selected}
          selected
          prominent
          onSelect={props.onSelect}
        />
      )}
      <StationMarker station={props.station} />
      {props.routeVisible && props.selected && (
        <Route selected={props.selected} station={props.station} variant={props.routeVariant} />
      )}
      <CameraRig
        selected={props.selected}
        station={props.station}
        cameraAction={props.cameraAction}
        focusToken={props.focusToken}
        reducedMotion={props.reducedMotion}
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
