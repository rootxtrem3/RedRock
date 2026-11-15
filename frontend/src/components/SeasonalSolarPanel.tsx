import { useEffect, useState } from 'react'
import { fetchSeasonalSolar, type SolarModelResponse } from '../data/solarData'
import type { MarsLocation } from '../types'

const SITE_IDS: Record<string, string> = {
  jezero: 'jezero_crater',
  olympus: 'olympus_mons',
  gale: 'gale_crater',
  valles: 'valles_marineris',
  elysium: 'elysium_planitia',
}

function seasonLabel(season: string) {
  return season.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function SeasonalSolarPanel({ location }: { location: MarsLocation }) {
  const siteId = SITE_IDS[location.id]
  if (!siteId) {
    return (
      <section aria-label="Seasonal modeled solar flux" style={boxStyle}>
        <strong style={{ fontSize: 11 }}>Seasonal solar flux</strong>
        <p className="thermal-estimate-empty">Seasonal model samples are available for the five named reference sites.</p>
      </section>
    )
  }

  return <SolarSamples key={siteId} siteId={siteId} />
}

const boxStyle = {
  display: 'grid',
  gap: 9,
  marginTop: 12,
  padding: 12,
  border: '1px solid rgba(232, 226, 216, 0.12)',
  background: 'rgba(232, 226, 216, 0.025)',
} as const

function SolarSamples({ siteId }: { siteId: string }) {
  const [data, setData] = useState<SolarModelResponse | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetchSeasonalSolar(siteId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [siteId])

  return (
    <section aria-label="Seasonal modeled solar flux" style={boxStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontSize: 11 }}>Seasonal solar flux</strong>
        <span style={{ color: '#928980', fontSize: 9, textTransform: 'uppercase' }}>MCD model · local noon</span>
      </div>
      {loading && <p className="thermal-estimate-empty" role="status">Loading seasonal model samples…</p>}
      {error && <p className="thermal-estimate-empty" role="status">Seasonal model data could not be loaded.</p>}
      {data && (
        <>
          <div style={{ display: 'grid', gap: 6 }}>
            {data.records.map((record) => (
              <div key={record.season} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '5px 12px', alignItems: 'baseline', padding: '7px 0', borderTop: '1px solid rgba(232, 226, 216, 0.08)' }}>
                <strong style={{ color: '#c9c1b8', fontSize: 10 }}>{seasonLabel(record.season)}</strong>
                <span style={{ color: '#928980', fontSize: 9 }}>Horizontal</span>
                <strong style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{record.flux_horizontal_w_m2.toFixed(0)} W/m²</strong>
                <span />
                <span style={{ color: '#928980', fontSize: 9 }}>Local slope</span>
                <strong style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{record.flux_local_slope_w_m2.toFixed(0)} W/m²</strong>
              </div>
            ))}
          </div>
          <p className="thermal-estimate-caveat">{data.interpretation} Altitude: 10 m above the reference surface; local solar time: 12:00. These modeled instantaneous flux samples are not daily energy yield or delivered panel power.</p>
          <a className="thermal-estimate-source" href={data.source_url} target="_blank" rel="noreferrer">{data.model} source ↗</a>
        </>
      )}
    </section>
  )
}
