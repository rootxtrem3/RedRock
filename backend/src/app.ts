import express, { type NextFunction, type Request, type Response } from 'express'
import { z, type ZodType } from 'zod'
import { MarsDataStore } from './data/marsData.js'
import { getLayerImage, isLayerId, layerCatalog } from './domain/layerImages.js'
import { distanceKm, gridIndex, iceProspects, samplePoint, terrainProfile } from './domain/geospatial.js'
import { planRoute } from './domain/routePlanner.js'

const coordinateSchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lon: z.coerce.number().finite(),
})
const profileSchema = z.object({
  start_lat: z.coerce.number().finite().min(-90).max(90),
  start_lon: z.coerce.number().finite(),
  end_lat: z.coerce.number().finite().min(-90).max(90),
  end_lon: z.coerce.number().finite(),
  samples: z.coerce.number().int().min(2).max(500).default(100),
})
const iceSchema = coordinateSchema.extend({
  radius_km: z.coerce.number().finite().positive().max(200).default(50),
  min_ci: z.coerce.number().finite().min(-30).max(30).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
const routeSchema = z.object({
  start_lat: z.coerce.number().finite().min(-90).max(90),
  start_lon: z.coerce.number().finite(),
  end_lat: z.coerce.number().finite().min(-90).max(90),
  end_lon: z.coerce.number().finite(),
  mode: z.enum(['terrain', 'shortest']).default('terrain'),
  max_slope_degrees: z.coerce.number().finite().positive().max(45).default(25),
})
const frontendRouteSchema = z.object({
  start: z.object({ lat: z.number().finite().min(-90).max(90), lon: z.number().finite() }),
  end: z.object({ lat: z.number().finite().min(-90).max(90), lon: z.number().finite() }),
  variant: z.enum(['recommended', 'shorter', 'resource']),
  travelSpeedKmPerHour: z.number().finite().positive().max(100),
})

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly details?: unknown) {
    super(code)
  }
}

function parseQuery<T>(schema: ZodType<T>, query: Request['query']): T {
  const parsed = schema.safeParse(query)
  if (!parsed.success) {
    throw new ApiError(400, 'invalid_query', parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })))
  }
  return parsed.data
}

function corsMiddleware(request: Request, response: Response, next: NextFunction) {
  const allowedOrigins = (process.env.RED_ROCK_CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean)
  const origin = request.header('Origin')
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }
  next()
}

export function createApp(store = new MarsDataStore()) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))
  app.use(corsMiddleware)

  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      data_version: store.manifest.generated_date,
      datasets_loaded: Object.keys(store.grids),
      site_count: store.siteSamples.length,
      solar_record_count: store.solar.records.length,
    })
  })

  app.get('/api/capabilities', (_request, response) => {
    response.json({
      api_features: ['point_sample', 'site_samples', 'seasonal_solar_samples', 'terrain_profile', 'ice_prospects', 'route_estimates', 'layer_textures', 'layer_coverage'],
      route_modes: ['terrain', 'shortest'],
      sampled_layers: ['mola_elevation', 'mola_slope', 'mola_local_relief', 'swim_ci_0_1m'],
      map_raster_tiles: false,
      not_available_as_validated_global_layers: [
        { id: 'surface_temperature', reason: 'No validated global temperature grid is included in the prepared backend bundle.' },
        { id: 'radiation', reason: 'No validated global surface-radiation grid is included; Curiosity RAD is Gale-site reference data only.' },
        { id: 'quantitative_minerals', reason: 'No verified global mineral-abundance grids are included.' },
      ],
      solar: 'Five site anchors x four modeled solar-longitude samples; not a global map, daily energy, or panel output.',
    })
  })

  app.get('/api/manifest', (_request, response) => response.json(store.manifest))
  app.get('/api/layers', (_request, response) => response.json({
    projection: 'Equirectangular; 1800 rows from 90N southward, 3600 columns eastward from 180W.',
    width: 3600,
    height: 1800,
    no_data: 'Transparent pixels in scientific textures; inspect coverage texture to see unknown areas.',
    layers: layerCatalog(store),
  }))

  app.get('/api/layers/:layer/:kind.png', (request, response) => {
    const { layer, kind } = request.params
    if (!isLayerId(layer)) throw new ApiError(404, 'unknown_layer', { layer })
    if (kind !== 'texture' && kind !== 'coverage') throw new ApiError(404, 'unknown_layer_image', { kind })
    const image = getLayerImage(store, layer, kind === 'coverage')
    response.setHeader('Cache-Control', 'public, max-age=3600')
    response.type('png').send(image)
  })

  app.get('/api/sites', (_request, response) => {
    response.json({
      sites: store.siteSamples.map((site) => ({
        ...site,
        solar_model_records: store.solarBySite.get(site.id) ?? [],
      })),
    })
  })

  app.get('/api/solar', (request, response) => {
    const parsed = z.object({ site_id: z.string().min(1) }).safeParse(request.query)
    if (!parsed.success) throw new ApiError(400, 'site_id_required')
    const records = store.solarBySite.get(parsed.data.site_id)
    if (!records) throw new ApiError(404, 'unknown_site_id', { site_id: parsed.data.site_id })
    response.json({
      site_id: parsed.data.site_id,
      model: store.solar.model,
      source_url: store.solar.source_url,
      interpretation: store.solar.interpretation,
      records,
    })
  })

  app.get('/api/sample', (request, response) => {
    const point = parseQuery(coordinateSchema, request.query)
    response.json(samplePoint(store, point.lat, point.lon))
  })

  app.get('/api/analysis/location', (request, response) => {
    const parsed = coordinateSchema.extend({ id: z.string().optional() }).safeParse(request.query)
    if (!parsed.success) throw new ApiError(400, 'invalid_query', parsed.error.issues)
    const { id, lat, lon } = parsed.data
    const sample = samplePoint(store, lat, lon)
    const datasetValue = (datasetId: string, field: { value: number | null; unit: string }) => {
      const source = store.metadata.get(datasetId)
      return {
        value: field.value,
        unit: field.unit,
        evidenceKind: 'published-map',
        sourceName: source?.source ?? datasetId,
        sourceUrl: source?.source_url,
        version: source?.version,
        coverage: field.value === null ? 'none' : 'global',
        confidence: field.value === null ? 'unknown' : 'moderate',
        resolution: source?.resolution_note ?? '0.1° grid (~5.9 km at the equator)',
        caveat: field.value === null ? 'Source has no valid value at this coordinate.' : source?.interpretation,
      }
    }
    const elevation = sample.terrain.mola_elevation
    const slope = sample.terrain.mola_slope
    const relief = sample.terrain.mola_local_relief
    const ice = sample.ice.ci_0_1m
    // First-order reference-atmosphere estimate. MOLA elevation is relative to
    // the areoid; this intentionally omits seasonal, diurnal, and weather effects.
    const pressureEstimate = elevation.value === null
      ? null
      : 636 * Math.exp(-elevation.value / 11_000)
    const nearestSolarSite = store.siteSamples
      .map((site) => ({ site, distanceKm: distanceKm({ lat, lon_east: lon }, { lat: site.lat, lon_east: site.lon_east }) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0]
    const localSolarSamples = nearestSolarSite && nearestSolarSite.distanceKm <= 1
      ? store.solarBySite.get(nearestSolarSite.site.id) ?? []
      : []
    const hazards = []
    if (slope.value !== null) hazards.push({ name: 'Slope', level: slope.value >= 15 ? 'high' : slope.value >= 8 ? 'medium' : 'low', evidence: { value: `${slope.value.toFixed(1)}° slope on a coarse MOLA grid`, unit: 'degrees', evidenceKind: 'published-map', sourceName: 'MOLA derived slope', coverage: 'global', confidence: 'moderate', resolution: '0.1° grid', caveat: 'Not a rover-scale hazard survey.' } })
    if (ice !== null) hazards.push({ name: 'Subsurface ice uncertainty', level: ice >= 0.3 ? 'medium' : 'unknown', evidence: { value: `SWIM consistency index ${ice.toFixed(3)}`, unit: 'dimensionless', evidenceKind: 'published-map', sourceName: 'NASA SWIM 4MIM 0–1 m', sourceUrl: 'https://swim.psi.edu/SWIM4MIMProducts.php', coverage: 'global', confidence: 'low', resolution: '20 ppd (~2.96 km/pixel)', caveat: 'Consistency is not confirmation of accessible water.' } })
    const resources = ice === null ? [] : [{ name: 'Possible shallow ice', status: ice >= 0.3 ? 'positive consistency indicator' : 'lower consistency', evidence: { value: `SWIM Ci ${ice.toFixed(3)}`, unit: 'dimensionless consistency index', evidenceKind: 'published-map', sourceName: 'NASA SWIM 4MIM', sourceUrl: 'https://swim.psi.edu/SWIM4MIMProducts.php', coverage: 'global', confidence: 'low', resolution: '20 ppd (~2.96 km/pixel)', caveat: 'Ci ≥ 0.3 is an indicator threshold, not probability, water quantity, or accessibility.' } }]
    response.json({
      locationId: id ?? 'coordinate',
      elevationMeters: datasetValue('mola_elevation', elevation),
      slopeDegrees: datasetValue('mola_slope', slope),
      localReliefMeters: datasetValue('mola_local_relief', relief),
      roughnessProxy: {
        value: relief.value,
        unit: 'm',
        evidenceKind: relief.value === null ? 'unavailable' : 'derived-proxy',
        sourceName: 'MOLA 0.1° 3×3-cell elevation range',
        sourceUrl: store.metadata.get('mola_local_relief')?.source_url,
        coverage: relief.value === null ? 'none' : 'global',
        confidence: relief.value === null ? 'unknown' : 'low',
        resolution: '0.1° grid (~5.9 km at the equator); 3×3 cell neighborhood',
        caveat: 'Broad topographic relief proxy only. It is not instrument-measured surface roughness and does not resolve rover-scale rocks or hazards.',
      },
      iceConsistency01m: {
        ...datasetValue('swim_ci_0_1m', { value: ice, unit: store.metadata.get('swim_ci_0_1m')?.units ?? 'dimensionless consistency index' }),
        confidence: ice === null ? 'unknown' : 'low',
      },
      thermalInertia: { value: null, unit: 'J m⁻² K⁻¹ s⁻½', evidenceKind: 'unavailable', coverage: 'none', confidence: 'unknown', caveat: 'A numeric thermal-inertia raster is not included in the prepared backend grid.' },
      surfaceTemperature: null,
      surfacePressurePa: {
        value: pressureEstimate === null ? null : Math.round(pressureEstimate * 10) / 10,
        unit: 'Pa',
        evidenceKind: pressureEstimate === null ? 'unavailable' : 'modeled-estimate',
        sourceName: 'NASA Mars Fact Sheet mean surface pressure and scale height; exponential reference-atmosphere approximation',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
        coverage: pressureEstimate === null ? 'none' : 'global',
        confidence: pressureEstimate === null ? 'unknown' : 'low',
        model: { equation: 'p(z) = 636 Pa × exp(−z / 11000 m)', referenceElevationMeters: 0, scaleHeightMeters: 11000 },
        caveat: 'Climatological first-order estimate from MOLA elevation, not a local measurement or Mars GCM output. Omits seasonal CO₂ frost exchange, dust, latitude, local time, and weather; NASA reports mean-radius pressure varies seasonally (about 400–870 Pa).',
      },
      dustOpacity: { value: null, unit: 'dimensionless', evidenceKind: 'unavailable', coverage: 'none', confidence: 'unknown', caveat: 'No validated dust-opacity grid is included.' },
      solarFlux: { value: null, unit: 'W/m²', evidenceKind: 'unavailable', coverage: 'none', confidence: 'unknown', caveat: 'The available solar model contains seasonal samples only at five named site anchors; it is not a coordinate-wide solar map.' },
      seasonalSolarSamples: localSolarSamples.length ? {
        evidenceKind: 'modeled-point-samples',
        siteId: nearestSolarSite?.site.id,
        siteName: nearestSolarSite?.site.name,
        distanceFromAnchorKm: Number(nearestSolarSite?.distanceKm.toFixed(3)),
        records: localSolarSamples,
        sourceUrl: store.solar.source_url,
        caveat: 'Seasonal MCD point samples at the named site anchor, not a measurement at the query coordinate or a coordinate-wide solar map. Noon flux is not daily energy or panel output.',
      } : null,
      radiation: { value: null, unit: 'mSv/year', evidenceKind: 'unavailable', coverage: 'none', confidence: 'unknown', caveat: 'No validated global radiation grid is included; rover readings are local observations.' },
      resources,
      hazards,
      unknowns: [
        'No validated local temperature, thermal inertia, dust opacity, or radiation value is available at this coordinate.',
        ...(localSolarSamples.length ? [] : ['No coordinate-specific solar model value is available; seasonal samples exist only at the five named site anchors.']),
        'Surface pressure is a low-confidence reference-atmosphere estimate, not a local observation.',
      ],
      updatedAt: new Date().toISOString(),
    })
  })

  app.post('/api/routes', (request, response) => {
    const parsed = frontendRouteSchema.safeParse(request.body)
    if (!parsed.success) throw new ApiError(400, 'invalid_route_request', parsed.error.issues)
    const input = parsed.data
    let destination = { lat: input.end.lat, lon: input.end.lon }
    let prospect: Record<string, unknown> | undefined
    let resourceCandidates: Array<{ location: { lat: number; lon_east: number }; ci_0_1m: number }> = []
    if (input.variant === 'resource') {
      resourceCandidates = iceProspects(store, { lat: input.start.lat, lon_east: input.start.lon }, 200, -30, 50).candidates as unknown as Array<{
        location: { lat: number; lon_east: number }
        ci_0_1m: number
      }>
      if (!resourceCandidates.length) throw new ApiError(422, 'no_swim_coverage_within_200_km')
    }
    try {
      const start = { lat: input.start.lat, lon_east: input.start.lon }
      let route: ReturnType<typeof planRoute> | undefined
      if (input.variant === 'resource') {
        for (const candidate of resourceCandidates) {
          try {
            route = planRoute(store, start, candidate.location, 'terrain', 25)
            destination = { lat: candidate.location.lat, lon: candidate.location.lon_east }
            prospect = candidate as unknown as Record<string, unknown>
            break
          } catch (error) {
            if (!(error instanceof RangeError)) throw error
          }
        }
        if (!route || !prospect) throw new ApiError(422, 'no_reachable_swim_cell_within_200_km')
      } else {
        route = planRoute(store,
          start,
          { lat: destination.lat, lon_east: destination.lon },
          input.variant === 'shorter' ? 'shortest' : 'terrain', 25)
      }
      let distance = 0
      const points = route.geometry.map((point: { lat: number; lon_east: number }, index: number) => {
        if (index) distance += distanceKm(route.geometry[index - 1], point)
        const sampled = samplePoint(store, point.lat, point.lon_east)
        return { lat: point.lat, lon: point.lon_east, elevationMeters: sampled.terrain.mola_elevation.value, slopeDegrees: sampled.terrain.mola_slope.value }
      })
      const waypoints = route.waypoints.map((point: { lat: number; lon_east: number; path_index: number; reason: string; elevation_m: number | null; slope_degrees: number | null }) => ({
        lat: point.lat, lon: point.lon_east,
        distanceKm: Number(route.path.slice(0, point.path_index + 1).reduce((sum: number, item: { lat: number; lon_east: number }, index: number, all: Array<{ lat: number; lon_east: number }>) => index ? sum + distanceKm(all[index - 1], item) : sum, 0).toFixed(1)),
        title: point.slope_degrees !== null && point.slope_degrees >= 18.75 ? 'Slope caution' : 'Terrain checkpoint',
        reason: point.reason,
        elevationMeters: point.elevation_m,
      }))
      response.json({
        routeId: `${input.variant}-${Date.now()}`,
        variant: input.variant,
        destination: prospect
          ? {
              type: 'swim-cell',
              lat: destination.lat,
              lon: destination.lon,
              label: 'Reachable SWIM consistency cell',
              swimCi01m: Number(prospect.ci_0_1m),
              straightLineDistanceKm: Number(prospect.distance_km),
            }
          : {
              type: 'station',
              lat: destination.lat,
              lon: destination.lon,
              label: 'Configured station',
            },
        algorithm: 'A* over MOLA elevation, slope, and local-relief grid',
        coverage: 'terrain-sampled',
        points,
        distanceKm: Number(route.distance_km),
        estimatedTravelHours: Number((route.distance_km / input.travelSpeedKmPerHour).toFixed(1)),
        climbMeters: null,
        descentMeters: null,
        maximumSlopeDegrees: route.path.reduce((maximum: number, point: { slope_degrees: number | null }) => Math.max(maximum, point.slope_degrees ?? 0), 0),
        waypoints,
        assumptions: [`Constant planning speed of ${input.travelSpeedKmPerHour} km/h; no stops or energy limits included.`, ...(prospect ? [`Destination is the highest-ranked reachable SWIM consistency cell among the sampled candidates (Ci ${Number(prospect.ci_0_1m).toFixed(2)}); this does not confirm water. ${Number(prospect.ci_0_1m) >= 0.3 ? 'It meets' : 'It is below'} the published positive-indicator threshold of Ci 0.3.`] : [])],
        caveats: [route.caveat, 'This is an exploratory terrain-cost route, not a certified safe route. MOLA grid is roughly 5.9 km/cell at the equator.'],
      })
    } catch (error) {
      if (error instanceof RangeError) throw new ApiError(422, error.message)
      throw error
    }
  })

  app.get('/api/profile', (request, response) => {
    const query = parseQuery(profileSchema, request.query)
    response.json(terrainProfile(
      store,
      { lat: query.start_lat, lon_east: query.start_lon },
      { lat: query.end_lat, lon_east: query.end_lon },
      query.samples,
    ))
  })

  app.get('/api/ice-prospects', (request, response) => {
    const query = parseQuery(iceSchema, request.query)
    response.json(iceProspects(
      store,
      { lat: query.lat, lon_east: query.lon },
      query.radius_km,
      query.min_ci,
      query.limit,
    ))
  })

  app.get('/api/route', (request, response) => {
    const query = parseQuery(routeSchema, request.query)
    try {
      response.json(planRoute(
        store,
        { lat: query.start_lat, lon_east: query.start_lon },
        { lat: query.end_lat, lon_east: query.end_lon },
        query.mode,
        query.max_slope_degrees,
      ))
    } catch (error) {
      if (error instanceof RangeError) throw new ApiError(422, error.message)
      throw error
    }
  })

  app.use((_request, _response, next) => next(new ApiError(404, 'not_found')))
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      response.status(error.status).json({ error: error.code, ...(error.details ? { details: error.details } : {}) })
      return
    }
    console.error('[RED ROCK API]', error)
    response.status(500).json({ error: 'internal_server_error' })
  })
  return app
}
