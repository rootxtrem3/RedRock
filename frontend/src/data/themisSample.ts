import { useEffect, useState } from 'react'
import { getTerrainPatchAt } from './terrain'

export type ThemisPixelSample = {
  kind: 'sample'
  rgb: [number, number, number]
  resolution: string
  product: string
} | { kind: 'no-coverage' } | { kind: 'load-error' }

const imageCache = new Map<string, Promise<ImageBitmap | null>>()

function loadImage(url: string) {
  const cached = imageCache.get(url)
  if (cached) return cached
  const pending = fetch(url)
    .then((response) => response.ok ? response.blob() : null)
    .then((blob) => blob ? createImageBitmap(blob) : null)
    .catch(() => null)
  imageCache.set(url, pending)
  return pending
}

function normalizedLongitude(lon: number) {
  return ((lon + 180) % 360 + 360) % 360 - 180
}

async function samplePixel(lat: number, lon: number): Promise<ThemisPixelSample> {
  const normalizedLon = normalizedLongitude(lon)
  const patch = getTerrainPatchAt(lat, normalizedLon)
  const source = patch?.dayTemperature
    ? {
        url: patch.dayTemperature,
        bounds: patch.bounds,
        resolution: `${patch.dayTemperatureResolutionMeters ?? 100} m regional source`,
        product: 'THEMIS Day IR 100 m regional mosaic v11',
      }
    : {
        url: '/terrain/layers/themis-day-ir.webp',
        bounds: { north: 90, south: -90, west: -180, east: 180 },
        resolution: '8K global display texture (~2.6 km per pixel)',
        product: 'THEMIS Day IR global mosaic v2.0',
      }
  const bitmap = await loadImage(source.url)
  if (!bitmap) return { kind: 'load-error' }

  const { north, south, west, east } = source.bounds
  const x = Math.floor(((normalizedLon - west) / (east - west)) * bitmap.width)
  const y = Math.floor(((north - lat) / (north - south)) * bitmap.height)
  if (x < 0 || x >= bitmap.width || y < 0 || y >= bitmap.height) return { kind: 'no-coverage' }

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return { kind: 'load-error' }
  context.drawImage(bitmap, x, y, 1, 1, 0, 0, 1, 1)
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
  if (alpha === 0) return { kind: 'no-coverage' }
  return { kind: 'sample', rgb: [red, green, blue], resolution: source.resolution, product: source.product }
}

export function useThemisPixelSample(lat: number, lon: number) {
  const key = `${lat}:${lon}`
  const [result, setResult] = useState<{ key: string; sample: ThemisPixelSample } | null>(null)
  useEffect(() => {
    let active = true
    samplePixel(lat, lon).then((value) => {
      if (active) setResult({ key, sample: value })
    })
    return () => { active = false }
  }, [key, lat, lon])
  return result?.key === key ? result.sample : undefined
}
