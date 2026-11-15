import type { LayerId } from '../../types'

export type CoverageAvailability = 'global' | 'regional' | 'site' | 'not-bundled'

export type LayerCoverage = {
  id: string
  label: string
  availability: CoverageAvailability
  resolution: string
  sourceName: string
  sourceUrl?: string
  noDataTreatment: string
  evidenceType: string
  caveat: string
  lastChecked: string
}

export type CoverageLayerId =
  | LayerId
  | 'ice-consistency'
  | 'radiation'
  | 'quantitative-minerals'

export type CoverageSummary = {
  global: number
  regional: number
  site: number
  notBundled: number
  total: number
}

export const AVAILABILITY_LABELS: Record<CoverageAvailability, string> = {
  global: 'Global',
  regional: 'Regional',
  site: 'Site',
  'not-bundled': 'Not bundled',
}

/**
 * Registry of products this build can actually draw, plus the products it
 * deliberately does not ship. Availability describes spatial coverage of the
 * bundled artifact — not confidence, validation, or resource certainty.
 */
export const COVERAGE_REGISTRY = {
  visual: {
    id: 'visual',
    label: 'Visual Mars (Viking color)',
    availability: 'global',
    resolution: '8K globe texture · ~2.6 km/pixel',
    sourceName: 'NASA Viking Orbiter color mosaic / ASU Mars Global Data Sets',
    sourceUrl: 'https://www.mars.asu.edu/data/mdim_color/',
    noDataTreatment: 'Mosaic seams and coverage gaps are left dark; no imagery is synthesized to fill them.',
    evidenceType: 'Orbital color imagery mosaic',
    caveat:
      'Viking-era basemap. Colour is processed and not a true human-view scene; ~2.6 km/pixel cannot resolve landing hazards or meter-scale ice.',
    lastChecked: '2026-11-15',
  },
  elevation: {
    id: 'elevation',
    label: 'Elevation (MOLA)',
    availability: 'global',
    resolution: '8K texture · 32 ppd MOLA source (~2.6 km/pixel)',
    sourceName: 'NASA MGS MOLA MEGDR v2.0 / PDS Geosciences Node',
    sourceUrl:
      'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/',
    noDataTreatment: 'Source voids are filled in the published MEGDR; this build adds no synthetic relief.',
    evidenceType: 'Measured laser altimetry',
    caveat:
      'MOLA footprints and 32 ppd sampling cannot resolve meter-scale slopes. Elevation is referenced to the Mars datum.',
    lastChecked: '2026-11-15',
  },
  roughness: {
    id: 'roughness',
    label: 'Surface roughness (MOLA baselines)',
    availability: 'global',
    resolution: '8 ppd source · ~7.5 km/pixel',
    sourceName: 'MOLA vertical roughness composite / Kreslavsky & Head 2002',
    sourceUrl: 'https://www.mars.asu.edu/data/mola_roughness/',
    noDataTreatment: 'Uncovered areas stay dark; no interpolation is applied.',
    evidenceType: 'Altimetry-derived roughness composite (0.6, 2.4, 9.2 km baselines)',
    caveat:
      'The published product is an RGB baseline composite, not a single scalar. It is not slope, bearing strength, or trafficability.',
    lastChecked: '2026-11-15',
  },
  'day-temperature': {
    id: 'day-temperature',
    label: 'Day IR brightness (THEMIS)',
    availability: 'global',
    resolution: '8K texture · 256 ppd published THEMIS mosaic',
    sourceName: 'NASA/JPL-Caltech/ASU THEMIS Day IR Global Mosaic v2.0',
    sourceUrl: 'https://www.mars.asu.edu/data/thm_dir/',
    noDataTreatment: 'No-data gores remain transparent; values are not interpolated across them.',
    evidenceType: 'Orbital thermal-infrared brightness mosaic (12.57 µm)',
    caveat:
      'The published global mosaic is an 8-bit relative brightness product, not calibrated kinetic temperature and not a subsurface temperature model.',
    lastChecked: '2026-11-15',
  },
  'thermal-inertia': {
    id: 'thermal-inertia',
    label: 'Thermal inertia (TES)',
    availability: 'global',
    resolution: '20 ppd source · ~3 km/pixel',
    sourceName: 'NASA/JPL/ASU MGS TES nighttime thermal inertia (Putzig et al. 2005)',
    sourceUrl: 'https://www.mars.asu.edu/data/tes_putzigti/nighttime2005/',
    noDataTreatment: 'Retrieval gaps and high-latitude no-data remain unfilled.',
    evidenceType: 'Model retrieval from orbital thermal-infrared observations',
    caveat:
      'A 20 ppd retrieval smooths local heterogeneity and depends on atmospheric and dust assumptions. It is not a direct surface measurement.',
    lastChecked: '2026-11-15',
  },
  'hydrated-minerals': {
    id: 'hydrated-minerals',
    label: 'Sheet silicates / high-silica glass (TES)',
    availability: 'global',
    resolution: '4 ppd source · ~16 km/pixel',
    sourceName:
      'NASA/JPL/ASU MGS TES sheet-silicate / high-silica-glass abundance (Bandfield 2002)',
    sourceUrl: 'https://www.mars.asu.edu/data/tes_silicates/',
    noDataTreatment:
      'Below-detection and no-retrieval areas are shown as no indicator, not zero abundance.',
    evidenceType: 'Spectral abundance indicator (TES deconvolution)',
    caveat:
      'A TES 4 ppd indicator map, not CRISM hydration mapping and not quantitative water content. "No indicator" does not prove the mineral is absent.',
    lastChecked: '2026-11-15',
  },
  hematite: {
    id: 'hematite',
    label: 'Hematite abundance (TES)',
    availability: 'global',
    resolution: '4 ppd source · ~16 km/pixel',
    sourceName: 'NASA/JPL/ASU MGS TES hematite abundance (Bandfield 2002)',
    sourceUrl: 'https://www.mars.asu.edu/data/tes_hematite/',
    noDataTreatment:
      'Below-detection and no-retrieval areas are shown as no indicator, not zero abundance.',
    evidenceType: 'Spectral abundance indicator (TES deconvolution)',
    caveat:
      'Indicator strength is not a reserve estimate or in-situ confirmation. A 16 km footprint mixes distinct surfaces.',
    lastChecked: '2026-11-15',
  },
  'ice-consistency': {
    id: 'ice-consistency',
    label: 'Shallow ice consistency, 0–1 m (SWIM)',
    availability: 'not-bundled',
    resolution: 'Not bundled · SWIM 0–1 m consistency grid required',
    sourceName: 'NASA SWIM (Subsurface Water Ice Mapping) project — product not bundled',
    sourceUrl: 'https://swim.psi.edu/',
    noDataTreatment:
      'Nothing to render: no consistency raster is present. Absence is shown explicitly as "not bundled", never as zero ice.',
    evidenceType: 'Geophysical consistency index (radar, neutron and thermal integration)',
    caveat:
      'Without the SWIM grid and a prospect-search service, no shallow-ice consistency can be shown here. A missing layer option is not evidence that ice is absent.',
    lastChecked: '2026-11-15',
  },
  radiation: {
    id: 'radiation',
    label: 'Global surface radiation',
    availability: 'not-bundled',
    resolution: 'Not bundled · no global radiation raster',
    sourceName: 'NASA MSL RAD measurements and Mars atmospheric models (no bundled raster)',
    sourceUrl: 'https://mars.nasa.gov/msl/spacecraft/instruments/rad/',
    noDataTreatment: 'No raster is available; no radiation value is estimated or substituted.',
    evidenceType: 'In-situ dosimetry plus atmospheric model (not bundled)',
    caveat:
      'Surface radiation varies with atmospheric depth, season, altitude and terrain shielding. No global raster or site value is bundled in this build.',
    lastChecked: '2026-11-15',
  },
  'quantitative-minerals': {
    id: 'quantitative-minerals',
    label: 'Quantitative global mineral abundance',
    availability: 'not-bundled',
    resolution: 'Not bundled beyond published TES 4 ppd indicator maps',
    sourceName:
      'Published TES 4 ppd mineral indicator maps (Bandfield 2002); no quantitative grid bundled',
    sourceUrl: 'https://www.mars.asu.edu/data/tes_silicates/',
    noDataTreatment:
      'No quantitative abundance raster is present; indicator maps are not converted into weight-percent values.',
    evidenceType: 'Published TES spectral indicator maps (qualitative or semi-quantitative)',
    caveat:
      'No global quantitative abundance grid is bundled. TES indicator strength is not wt% and must not be read as grade, reserve, or resource volume.',
    lastChecked: '2026-11-15',
  },
} satisfies Record<CoverageLayerId, LayerCoverage>

/** Registry in stable display order (insertion order). */
export const COVERAGE_ENTRIES: readonly LayerCoverage[] = Object.values(COVERAGE_REGISTRY)

export function coverageForLayer(id: string): LayerCoverage | undefined {
  return COVERAGE_ENTRIES.find((entry) => entry.id === id)
}

export function coverageSummary(): CoverageSummary {
  const counts: Record<CoverageAvailability, number> = {
    global: 0,
    regional: 0,
    site: 0,
    'not-bundled': 0,
  }

  for (const entry of COVERAGE_ENTRIES) {
    counts[entry.availability] += 1
  }

  return {
    global: counts.global,
    regional: counts.regional,
    site: counts.site,
    notBundled: counts['not-bundled'],
    total: COVERAGE_ENTRIES.length,
  }
}
