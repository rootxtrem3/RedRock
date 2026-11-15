import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { MathUtils, SRGBColorSpace, TextureLoader } from 'three'
import { sharedHeightTexture } from '../data/textureCache'
import {
  MARS_MEAN_RADIUS_METERS,
  MOLA_ELEVATION_MAX_METERS,
  MOLA_ELEVATION_MIN_METERS,
} from '../data/terrain'

export type GlobalLayerSphereProps = {
  /** Equirectangular texture, normally `/terrain/layers/<id>.webp`. */
  textureUrl: string
  layerId: string
  visible: boolean
  /** Optional MOLA height map used for displacement and bump shading. */
  heightUrl?: string
  /** Overlay opacity. Defaults to a restrained per-layer value. */
  opacity?: number
  /** Optional restrained tint. Defaults to white (no tint). */
  color?: string
}

// Must stay in sync with MarsGlobe so the layer conforms to the base surface.
const MARS_RADIUS = 1.16
const LAYER_OFFSET = 0.0002

const TERRAIN_DISPLACEMENT_SCALE =
  ((MOLA_ELEVATION_MAX_METERS - MOLA_ELEVATION_MIN_METERS) /
    MARS_MEAN_RADIUS_METERS) *
  MARS_RADIUS
const TERRAIN_DISPLACEMENT_BIAS =
  (MOLA_ELEVATION_MIN_METERS / MARS_MEAN_RADIUS_METERS) * MARS_RADIUS

// Without a height map the overlay cannot follow the displaced base surface.
// Lift it above MOLA's maximum positive displacement so highlands do not clip it.
const MAX_SURFACE_DISPLACEMENT =
  TERRAIN_DISPLACEMENT_SCALE + TERRAIN_DISPLACEMENT_BIAS
const NO_HEIGHT_LAYER_OFFSET = MAX_SURFACE_DISPLACEMENT + 0.0012

const DEFAULT_LAYER_OPACITY: Record<string, number> = {
  visual: 1,
  elevation: 0.86,
  roughness: 0.78,
  'day-temperature': 0.74,
  'thermal-inertia': 0.74,
  'ice-consistency': 0.9,
  'hydrated-minerals': 0.82,
}

function layerMayUseAlpha(layerId: string) {
  const id = layerId.toLowerCase()
  return (
    id.includes('mineral') ||
    id.includes('thermal') ||
    id.includes('temperature') ||
    id.includes('ice') ||
    id.includes('hematite')
  )
}

/**
 * Loader failures inside Suspense would otherwise crash the whole canvas.
 * Keying this boundary by URL resets it when the requested layer changes.
 */
class TextureErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state: { failed: boolean } = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

type LayerSphereSurfaceProps = Omit<GlobalLayerSphereProps, 'visible'>

function LayerSphereSurface({
  textureUrl,
  heightUrl,
  layerId,
  opacity,
  color = '#ffffff',
}: LayerSphereSurfaceProps) {
  const { gl } = useThree()

  // The fallback URL keeps the hook call unconditional; the loader caches it,
  // so no extra network request is made when no height map is supplied.
  const [sourceTexture, sourceHeight] = useLoader(TextureLoader, [
    textureUrl,
    heightUrl ?? textureUrl,
  ])

  const texture = useMemo(() => {
    const configured = sourceTexture.clone()
    configured.colorSpace = SRGBColorSpace
    configured.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    configured.needsUpdate = true
    return configured
  }, [gl, sourceTexture])

  // Every overlay shares one configured 8K MOLA height texture.
  const height = useMemo(
    () =>
      heightUrl
        ? sharedHeightTexture(sourceHeight, gl.capabilities.getMaxAnisotropy())
        : null,
    [gl, heightUrl, sourceHeight],
  )

  useEffect(() => () => texture.dispose(), [texture])

  const usesAlpha = layerMayUseAlpha(layerId)
  const effectiveOpacity = MathUtils.clamp(
    opacity ?? DEFAULT_LAYER_OPACITY[layerId] ?? 0.85,
    0,
    1,
  )
  const transparent = usesAlpha || effectiveOpacity < 1
  const surfaceRadius =
    MARS_RADIUS + (height ? LAYER_OFFSET : NO_HEIGHT_LAYER_OFFSET)

  return (
    <mesh renderOrder={1}>
      {/* Full-sphere UVs, identical to MarsSurface: 0..2π longitude, 0..π latitude. */}
      <sphereGeometry
        args={[surfaceRadius, 384, 192, 0, Math.PI * 2, 0, Math.PI]}
      />
      <meshStandardMaterial
        map={texture}
        displacementMap={height ?? undefined}
        displacementScale={height ? TERRAIN_DISPLACEMENT_SCALE : 0}
        displacementBias={height ? TERRAIN_DISPLACEMENT_BIAS : 0}
        bumpMap={height ?? undefined}
        bumpScale={height ? 0.0022 : 0}
        color={color}
        roughness={1}
        metalness={0}
        transparent={transparent}
        opacity={effectiveOpacity}
        alphaTest={usesAlpha ? 0.02 : 0}
        depthWrite={!transparent}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  )
}

export function GlobalLayerSphere({
  visible,
  textureUrl,
  heightUrl,
  layerId,
  opacity,
  color,
}: GlobalLayerSphereProps) {
  if (!visible) return null

  return (
    <TextureErrorBoundary key={`${textureUrl}::${heightUrl ?? ''}`}>
      <Suspense fallback={null}>
        <LayerSphereSurface
          textureUrl={textureUrl}
          heightUrl={heightUrl}
          layerId={layerId}
          opacity={opacity}
          color={color}
        />
      </Suspense>
    </TextureErrorBoundary>
  )
}
