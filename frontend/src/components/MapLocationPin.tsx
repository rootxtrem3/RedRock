import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Group,
} from 'three'
import { useGlobeTap, type GlobeTapEvent } from '../hooks/useGlobeTap'

const MARS_RED = '#A94732'
const FADED_WHITE = '#E8E2D8'

const PIN_TEXTURE_SIZE = 256
const PIN_SCALE = 10.25
const PIN_OFFSET_X = 5
const PIN_OFFSET_Y = 22.5
const PIN_HEAD = { x: 12, y: 9 }
const PIN_HOLE_RADIUS = 2.7
const PIN_HALO_WIDTH = 1.6
const PIN_RING_RADIUS = 10.4

// Classic map-location silhouette: rounded head with a tapered tail.
const PIN_PATH =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z'

// Anchoring the sprite at its bottom edge puts the pin tip on the surface.
const PIN_CENTER = new Vector2(0.5, 0)
const PIN_BASE_HEIGHT = 0.036
// Small bias above the supplied point; keep world-space lift tiny so pins do
// not visibly hover when the camera is close to the surface.
const DEFAULT_LIFT = 0.0015
const FRONT_FACING_THRESHOLD = 0.015
const DEFAULT_POSITION: [number, number, number] = [0, 0, 0]

type PinTextureCacheKey = `pin:${'selected' | 'default'}:${string}`
const pinTextureCache = new Map<PinTextureCacheKey, CanvasTexture>()

function drawPin(
  context: CanvasRenderingContext2D,
  selected: boolean,
  accent: string,
) {
  const bodyColor = selected ? FADED_WHITE : accent
  const holeColor = selected ? accent : FADED_WHITE
  const haloColor = selected ? accent : FADED_WHITE

  context.clearRect(0, 0, PIN_TEXTURE_SIZE, PIN_TEXTURE_SIZE)
  context.save()
  context.translate(PIN_OFFSET_X, PIN_OFFSET_Y)
  context.scale(PIN_SCALE, PIN_SCALE)
  context.lineJoin = 'round'
  context.lineCap = 'round'

  if (selected) {
    // Halo ring behind the pin makes the selected state read at a glance.
    context.beginPath()
    context.arc(PIN_HEAD.x, PIN_HEAD.y, PIN_RING_RADIUS, 0, Math.PI * 2)
    context.globalAlpha = 0.92
    context.lineWidth = 0.62
    context.strokeStyle = accent
    context.stroke()
    context.globalAlpha = 1
  }

  const pin = new Path2D(PIN_PATH)

  // Stroke first so half of the outline acts as a contrast halo.
  context.lineWidth = PIN_HALO_WIDTH
  context.strokeStyle = haloColor
  context.stroke(pin)

  context.fillStyle = bodyColor
  context.fill(pin)

  // The counter of a location pin: a contrasting circular center.
  context.beginPath()
  context.arc(PIN_HEAD.x, PIN_HEAD.y, PIN_HOLE_RADIUS, 0, Math.PI * 2)
  context.fillStyle = holeColor
  context.fill()

  context.restore()
}

function getPinTexture(selected: boolean, accent: string) {
  const key: PinTextureCacheKey = `pin:${selected ? 'selected' : 'default'}:${accent}`
  const cached = pinTextureCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = PIN_TEXTURE_SIZE
  canvas.height = PIN_TEXTURE_SIZE

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = 4

  const context = canvas.getContext('2d')
  if (context) {
    drawPin(context, selected, accent)
    texture.needsUpdate = true
  }

  pinTextureCache.set(key, texture)
  return texture
}

export type MapLocationPinProps = {
  /**
   * Surface point, normally on the Mars sphere (origin-centered scene).
   * Include any terrain clearance in this point; `lift` only adds a tiny bias.
   */
  position?: [number, number, number] | Vector3
  selected?: boolean
  prominent?: boolean
  /** Accent color for the default pin body and the selected pin center/ring. */
  color?: string
  /** Passed through as the Three.js object name; three objects have no CSS class. */
  className?: string
  /** Overall size multiplier on top of the selected/prominent sizing. */
  scale?: number
  /** Tiny radial bias above the supplied point (default 0.0015). */
  lift?: number
  /** Tap guard: ignores pointer travel so orbiting the globe never selects. */
  onTap?: (event: GlobeTapEvent) => void
  visible?: boolean
  renderOrder?: number
  depthTest?: boolean
  depthWrite?: boolean
}

/**
 * A camera-facing map-location pin for catalogued locations and mission sites.
 *
 * Uses a generated 256x256 CanvasTexture so no network or SVG assets are
 * required. The pin is a sprite anchored at its tip, which keeps it above the
 * terrain while always facing the camera. `sizeAttenuation={false}` preserves a
 * legible screen size at every zoom level. Depth testing against the globe
 * hides pins on the far hemisphere, and a per-frame front-facing check avoids
 * sprites peeking over the limb.
 */
export function MapLocationPin({
  position = DEFAULT_POSITION,
  selected = false,
  prominent = false,
  color = MARS_RED,
  className,
  scale = 1,
  lift = DEFAULT_LIFT,
  onTap,
  visible = true,
  renderOrder = 4,
  depthTest = true,
  depthWrite = false,
}: MapLocationPinProps) {
  const groupRef = useRef<Group>(null)
  const worldPosition = useMemo(() => new Vector3(), [])
  const surfaceNormal = useMemo(() => new Vector3(), [])
  const cameraDirection = useMemo(() => new Vector3(), [])
  const tap = useGlobeTap((event) => onTap?.(event))

  const basePosition = useMemo(
    () =>
      Array.isArray(position)
        ? new Vector3(position[0], position[1], position[2])
        : position.clone(),
    [position],
  )

  const anchoredPosition = useMemo(() => {
    if (lift === 0 || basePosition.lengthSq() === 0) return basePosition
    return basePosition
      .clone()
      .addScaledVector(basePosition.clone().normalize(), lift)
  }, [basePosition, lift])

  const texture = useMemo(
    () => getPinTexture(selected, color),
    [color, selected],
  )

  const size =
    PIN_BASE_HEIGHT * scale * (selected ? 1.42 : prominent ? 1.16 : 1)

  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group) return

    if (!visible) {
      group.visible = false
      return
    }

    group.getWorldPosition(worldPosition)
    surfaceNormal.copy(worldPosition)

    if (surfaceNormal.lengthSq() === 0) {
      group.visible = true
      return
    }

    surfaceNormal.normalize()
    cameraDirection.copy(camera.position).sub(worldPosition)

    if (cameraDirection.lengthSq() === 0) {
      group.visible = true
      return
    }

    cameraDirection.normalize()
    group.visible =
      surfaceNormal.dot(cameraDirection) > FRONT_FACING_THRESHOLD
  })

  return (
    <group
      ref={groupRef}
      position={anchoredPosition}
      name={className}
      userData={className ? { className } : undefined}
    >
      <sprite
        center={PIN_CENTER}
        scale={[size, size, 1]}
        renderOrder={renderOrder}
        frustumCulled={false}
        {...(onTap ? tap : {})}
      >
        <spriteMaterial
          map={texture}
          transparent
          depthTest={depthTest}
          depthWrite={depthWrite}
          sizeAttenuation={false}
          toneMapped={false}
          fog={false}
        />
      </sprite>
    </group>
  )
}
