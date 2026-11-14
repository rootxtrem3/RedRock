import { useCallback, useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

/** Maximum pointer travel, in CSS pixels, that still counts as a tap. */
export const GLOBE_TAP_MAX_TRAVEL_PX = 6

/** Maximum press duration, in milliseconds, that still counts as a tap. */
export const GLOBE_TAP_MAX_DURATION_MS = 600

export type GlobeTapEvent = ThreeEvent<PointerEvent>

export type GlobeTapOptions = {
  /** Maximum pointer travel, in CSS pixels, that still counts as a tap. */
  maxTravelPx?: number
  /** Maximum press duration, in milliseconds, that still counts as a tap. */
  maxDurationMs?: number
  /**
   * Stop the R3F event from reaching objects behind the tapped one.
   * Defaults to true so a marker tap does not also select the globe surface.
   */
  stopPropagation?: boolean
}

export type GlobeTapHandlers = {
  onPointerDown: (event: GlobeTapEvent) => void
  onPointerUp: (event: GlobeTapEvent) => void
  onPointerCancel: (event: GlobeTapEvent) => void
  onPointerLeave: (event: GlobeTapEvent) => void
}

type TapGesture = {
  pointerId: number | null
  startX: number
  startY: number
  startedAt: number
}

/**
 * Tap guard for R3F objects that sit under OrbitControls.
 *
 * OrbitControls consumes pointer movement on the canvas to orbit the globe, but
 * it does not suppress R3F's click events. An ordinary `onClick` therefore
 * fires at the end of a drag and selects whatever surface point the pointer
 * happens to be over. This hook records the pointer-down position and time and
 * only reports a tap when the pointer stayed within a small radius for a short
 * duration, so orbiting the globe never selects a location.
 */
export function useGlobeTap<
  TEvent extends GlobeTapEvent = GlobeTapEvent,
>(
  onTap: (event: TEvent) => void,
  options: GlobeTapOptions = {},
): GlobeTapHandlers {
  const {
    maxTravelPx = GLOBE_TAP_MAX_TRAVEL_PX,
    maxDurationMs = GLOBE_TAP_MAX_DURATION_MS,
    stopPropagation = true,
  } = options

  const gesture = useRef<TapGesture | null>(null)

  const handlePointerDown = useCallback((event: GlobeTapEvent) => {
    const nativeEvent = event.nativeEvent

    // Only the primary button/first contact can start a tap. A secondary touch
    // or a right/middle mouse button should never select a location.
    if (nativeEvent.isPrimary === false || nativeEvent.button !== 0) return

    const pointerId =
      typeof nativeEvent.pointerId === 'number' ? nativeEvent.pointerId : null
    const active = gesture.current

    // Ignore extra pointers while one gesture is already in flight.
    if (
      active &&
      active.pointerId !== null &&
      pointerId !== null &&
      active.pointerId !== pointerId
    ) {
      return
    }

    gesture.current = {
      pointerId,
      startX: nativeEvent.clientX,
      startY: nativeEvent.clientY,
      startedAt: performance.now(),
    }
  }, [])

  const handlePointerUp = useCallback(
    (event: GlobeTapEvent) => {
      const active = gesture.current
      if (!active) return

      const nativeEvent = event.nativeEvent
      const pointerId =
        typeof nativeEvent.pointerId === 'number' ? nativeEvent.pointerId : null

      // Let another pointer's release pass without consuming the active tap.
      if (
        active.pointerId !== null &&
        pointerId !== null &&
        active.pointerId !== pointerId
      ) {
        return
      }

      // Consume the gesture even when it turns out to be a drag.
      gesture.current = null

      const travel = Math.hypot(
        nativeEvent.clientX - active.startX,
        nativeEvent.clientY - active.startY,
      )
      const elapsed = performance.now() - active.startedAt

      if (travel > maxTravelPx || elapsed > maxDurationMs) return

      if (stopPropagation) event.stopPropagation()
      onTap(event as TEvent)
    },
    [maxDurationMs, maxTravelPx, onTap, stopPropagation],
  )

  const cancel = useCallback((event: GlobeTapEvent) => {
    const active = gesture.current
    if (!active) return

    const nativeEvent = event.nativeEvent
    const pointerId =
      typeof nativeEvent.pointerId === 'number' ? nativeEvent.pointerId : null

    // Do not let a different pointer's cancel/leave end this gesture.
    if (
      active.pointerId !== null &&
      pointerId !== null &&
      active.pointerId !== pointerId
    ) {
      return
    }

    gesture.current = null
  }, [])

  return useMemo(
    () => ({
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
    }),
    [cancel, handlePointerDown, handlePointerUp],
  )
}
