import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DirectionalLight, Vector3 } from 'three'

const BASE_INTENSITY = {
  ambient: 0.58,
  hemisphere: 0.34,
  key: 0.72,
  fill: 0.32,
} as const

export type GlobeLightingProps = {
  intensity?: number
  ambientScale?: number
}

/**
 * A soft, camera-relative light rig for scientific map reading.
 *
 * The directional lights follow the viewer instead of remaining on one side
 * of Mars. Rotating to any longitude therefore keeps the visible hemisphere
 * readable. A broad ambient base removes the artificial night side, while the
 * low-intensity key and fill retain enough directionality to show relief.
 */
export function GlobeLighting({
  intensity = 1,
  ambientScale = 1,
}: GlobeLightingProps) {
  const key = useRef<DirectionalLight>(null)
  const fill = useRef<DirectionalLight>(null)
  const viewDirection = useMemo(() => new Vector3(), [])
  const cameraRight = useMemo(() => new Vector3(), [])
  const cameraUp = useMemo(() => new Vector3(), [])

  useFrame(({ camera }) => {
    viewDirection.copy(camera.position).normalize()
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    cameraUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize()

    key.current?.position
      .copy(viewDirection)
      .multiplyScalar(5)
      .addScaledVector(cameraRight, -1.15)
      .addScaledVector(cameraUp, 0.9)

    fill.current?.position
      .copy(viewDirection)
      .multiplyScalar(4.5)
      .addScaledVector(cameraRight, 1.3)
      .addScaledVector(cameraUp, -0.2)
  })

  return (
    <>
      <ambientLight
        color="#E8E2D8"
        intensity={BASE_INTENSITY.ambient * intensity * ambientScale}
      />
      <hemisphereLight
        color="#E8E2D8"
        groundColor="#8D8178"
        intensity={BASE_INTENSITY.hemisphere * intensity * ambientScale}
      />
      <directionalLight
        ref={key}
        color="#E8E2D8"
        intensity={BASE_INTENSITY.key * intensity}
        position={[0, 0, 5]}
        castShadow={false}
      />
      <directionalLight
        ref={fill}
        color="#D6CFC4"
        intensity={BASE_INTENSITY.fill * intensity}
        position={[1, 0, 4]}
        castShadow={false}
      />
    </>
  )
}
