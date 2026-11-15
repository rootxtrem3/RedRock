import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { PNG } from 'pngjs'
import { createApp } from '../src/app.js'
import { MarsDataStore } from '../src/data/marsData.js'
import { getLayerImage } from '../src/domain/layerImages.js'
import { gridIndex } from '../src/domain/geospatial.js'

const store = new MarsDataStore()
const app = createApp(store)

async function withApi(run: (baseUrl: string) => Promise<void>) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as AddressInfo
  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('grid indexing wraps east longitude and clamps the polar rows', () => {
  assert.deepEqual(gridIndex(0, 180), gridIndex(0, -180))
  assert.equal(gridIndex(90, 0).row, 0)
  assert.equal(gridIndex(-90, 0).row, 1799)
})

test('SWIM texture preserves no-data transparency and coverage mask', () => {
  const texture = PNG.sync.read(getLayerImage(store, 'ice-consistency'))
  const coverage = PNG.sync.read(getLayerImage(store, 'ice-consistency', true))
  assert.equal(texture.width, 3600)
  assert.equal(texture.height, 1800)
  assert.equal(texture.data[3], 0)
  assert.equal(coverage.data[3], 220)
  assert.deepEqual([...coverage.data.subarray(0, 3)], [224, 100, 86])
})

test('API returns data-backed samples, bounded profiles, and SWIM candidates', async () => {
  await withApi(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json()) as Record<string, any>
    assert.equal(health.status, 'ok')
    assert.equal(health.site_count, 5)

    const sample = await fetch(`${baseUrl}/api/sample?lat=18.38&lon=77.58`).then((response) => response.json()) as Record<string, any>
    assert.equal(sample.terrain.mola_elevation.status, 'sampled')
    assert.equal(sample.ice.status, 'sampled_consistency_index')

    const missingIce = await fetch(`${baseUrl}/api/sample?lat=70&lon=0`).then((response) => response.json()) as Record<string, any>
    assert.equal(missingIce.ice.ci_0_1m, null)
    assert.equal(missingIce.ice.status, 'no_data')

    const profile = await fetch(`${baseUrl}/api/profile?start_lat=18.38&start_lon=77.58&end_lat=18.5&end_lon=77.7&samples=8`).then((response) => response.json()) as Record<string, any>
    assert.equal(profile.points.length, 8)
    assert.ok(profile.distance_km > 0)

    const prospects = await fetch(`${baseUrl}/api/ice-prospects?lat=18.38&lon=77.58&radius_km=50&min_ci=-30&limit=5`).then((response) => response.json()) as Record<string, any>
    assert.ok(prospects.coverage.sampled_cells_with_data > 0)
    assert.ok(prospects.candidates.length <= 5)
    assert.ok(prospects.candidates.every((candidate: Record<string, any>) => candidate.distance_type.includes('straight_line')))
  })
})

test('route modes return computed geometry and reject long or invalid requests', async () => {
  await withApi(async (baseUrl) => {
    const start = 'start_lat=18.38&start_lon=77.58'
    const end = 'end_lat=18.21&end_lon=77.32'
    for (const mode of ['terrain', 'shortest']) {
      const response = await fetch(`${baseUrl}/api/route?${start}&${end}&mode=${mode}`)
      assert.equal(response.status, 200)
      const route = await response.json() as Record<string, any>
      assert.equal(route.mode, mode)
      assert.ok(route.path.length > 1)
      assert.ok(route.geometry.length >= route.path.length)
      assert.ok(route.waypoints.every((waypoint: Record<string, any>) => typeof waypoint.reason === 'string'))
      assert.match(route.caveat, /not a safe-route guarantee/i)
    }
    const tooFar = await fetch(`${baseUrl}/api/route?start_lat=0&start_lon=0&end_lat=30&end_lon=30`)
    assert.equal(tooFar.status, 422)
    const invalid = await fetch(`${baseUrl}/api/route?start_lat=0&start_lon=0&end_lat=0&end_lon=0&mode=resource`)
    assert.equal(invalid.status, 400)
  })
})

test('frontend analysis and route contracts return sampled values and computed paths', async () => {
  await withApi(async (baseUrl) => {
    const analysisResponse = await fetch(`${baseUrl}/api/analysis/location?id=jezero&lat=18.38&lon=77.58`)
    assert.equal(analysisResponse.status, 200)
    const analysis = await analysisResponse.json() as Record<string, any>
    assert.equal(analysis.locationId, 'jezero')
    assert.equal(analysis.elevationMeters.evidenceKind, 'published-map')
    assert.equal(typeof analysis.elevationMeters.value, 'number')
    assert.equal(analysis.radiation.value, null)
    assert.equal(analysis.radiation.evidenceKind, 'unavailable')
    assert.ok(analysis.resources.length > 0)

    const request = {
      start: { lat: 18.38, lon: 77.58 },
      end: { lat: 18.21, lon: 77.32 },
      variant: 'recommended',
      travelSpeedKmPerHour: 5,
    }
    const routeResponse = await fetch(`${baseUrl}/api/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    assert.equal(routeResponse.status, 200)
    const route = await routeResponse.json() as Record<string, any>
    assert.equal(route.coverage, 'terrain-sampled')
    assert.ok(route.points.length > 1)
    assert.ok(route.waypoints.every((waypoint: Record<string, any>) => typeof waypoint.reason === 'string'))

    const resourceRoute = await fetch(`${baseUrl}/api/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, variant: 'resource' }),
    })
    assert.equal(resourceRoute.status, 200, await resourceRoute.clone().text())
    const resource = await resourceRoute.json() as Record<string, any>
    assert.ok(resource.assumptions.some((assumption: string) => assumption.includes('SWIM consistency cell')))
  })
})

test('layer catalogue and PNG endpoints expose metadata and correctly sized equirectangular images', async () => {
  await withApi(async (baseUrl) => {
    const catalogResponse = await fetch(`${baseUrl}/api/layers`)
    assert.equal(catalogResponse.status, 200)
    const catalog = await catalogResponse.json() as Record<string, any>
    assert.equal(catalog.width, 3600)
    assert.equal(catalog.height, 1800)
    assert.ok(catalog.layers.some((layer: Record<string, any>) => layer.id === 'ice-consistency'))

    const texture = await fetch(`${baseUrl}/api/layers/ice-consistency/texture.png`)
    assert.equal(texture.headers.get('content-type'), 'image/png')
    const image = PNG.sync.read(Buffer.from(await texture.arrayBuffer()))
    assert.equal(image.width, 3600)
    assert.equal(image.height, 1800)

    const unsupported = await fetch(`${baseUrl}/api/layers/radiation/texture.png`)
    assert.equal(unsupported.status, 404)
  })
})

test('API validates coordinates and applies local frontend CORS policy', async () => {
  await withApi(async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/api/sample?lat=91&lon=0`)
    assert.equal(invalid.status, 400)
    const allowed = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://localhost:5173' } })
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173')
    const disallowed = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://example.invalid' } })
    assert.equal(disallowed.headers.get('access-control-allow-origin'), null)
  })
})
