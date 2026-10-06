import { RunDetail } from '../api'
import { Map as MapGl, Source, Layer, Popup } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { REGION_COORDS, REGION_LABELS, PROVIDER_COLORS } from '../region-data'
import { useI18n } from '../i18n'
import { useMemo, useState } from 'react'

// ── Region helpers ────────────────────────────────────────────────────────────

function stripZoneSuffix(region: string): string {
  const match = region.match(/^(.+)-([a-z])$/)
  if (match) {
    const base = match[1]
    if (base.length > 0 && base[base.length - 1] >= '0' && base[base.length - 1] <= '9') {
      return base
    }
  }
  return region
}

function getSinacloudBaseRegion(region: string): string {
  const match = region.match(/^(de-[a-z]{2,3})-sinacloud-\d+$/)
  if (match) return match[1] + '-sinacloud'
  return region
}

function getSinacloudBase(region: string | null): string | null {
  if (!region || !region.includes('-sinacloud')) return null
  const match = region.match(/^(de-[a-z]{2,3})-sinacloud(-\d+)?$/)
  if (match) return match[1] + '-sinacloud'
  return null
}

function normalizeSinacloudRegion(region: string | null): string {
  if (!region) return ''
  if (region.includes('-sinacloud-') && region.match(/^de-[a-z]{2,3}-sinacloud-de-[a-z]{2,3}/)) {
    const match = region.match(/^(de-[a-z]{2,3})-sinacloud-(de-[a-z]{2,3})(-\d+)?$/)
    if (match) {
      return `${match[1]}-sinacloud${match[3] || ''}`
    }
  }
  return region
}

interface Props { run: RunDetail }

const PROVIDER_LABEL: Record<string, string> = {
  aws: 'Amazon Web Services',
  azure: 'Microsoft Azure',
  gcp: 'Google Cloud Platform',
  alicloud: 'Alibaba Cloud',
  yandex: 'Yandex Cloud',
  oci: 'Oracle Cloud Infrastructure',
  ovh: 'OVH Cloud',
  hetzner: 'Hetzner Cloud',
  stackit: 'STACKIT',
  infomaniak: 'Infomaniak',
  leafcloud: 'Leafcloud',
  tcloud: 'T Cloud Public',
  seeweb: 'Seeweb',
  exoscale: 'Exoscale',
  cyso: 'Cyso',
  numspot: 'Numspot',
  plusserver: 'plusserver',
  syselev: 'SysEleven',
  outscale: 'Outscale',
  leaseweb: 'Leaseweb',
  scaleway: 'Scaleway',
  ionos: 'IONOS',
  upcloud: 'UpCloud',
  cleura: 'Cleura',
  sinacloud: 'SINA Cloud',
}

const providerOrder = [
  'aws', 'azure', 'gcp', 'ovh', 'hetzner', 'stackit', 'sinacloud', 'oci', 'alicloud', 'yandex',
  'infomaniak', 'leafcloud', 'tcloud', 'seeweb', 'exoscale', 'cyso', 'numspot', 'plusserver',
  'syselev', 'outscale', 'leaseweb', 'scaleway', 'ionos', 'upcloud', 'cleura', 'unknown',
]

function providerRank(provider: string): number {
  const idx = providerOrder.indexOf(provider)
  return idx === -1 ? 1000 : idx
}

function extractZoneFromRegion(region: string, provider: string): string | null {
  if (provider === 'sinacloud' && region.includes('sinacloud')) {
    const match = region.match(/^(de-[a-z]{2,3})-sinacloud-(\d+)$/)
    if (match) return match[2]
  }
  if (provider === 'alicloud' && region.includes('cn-')) {
    const match = region.match(/^(cn-[a-z]+)-([a-z])$/)
    if (match) return match[2]
  }
  const match = region.match(/^(.+)-([a-z0-9]+)$/)
  if (match) {
    const base = match[1]
    const suffix = match[2]
    if (suffix.length === 1 || (suffix.length <= 2 && provider === 'azure')) {
      if (base[base.length - 1] >= '0' && base[base.length - 1] <= '9') return suffix
      if (base.match(/^[a-z]+-\d+$/)) return suffix
    }
  }
  return null
}

function needsZoneExtraction(provider: string): boolean {
  return ['sinacloud', 'stackit', 'tcloud', 'infomaniak', 'leafcloud', 'seeweb', 'exoscale', 'cyso',
    'numspot', 'plusserver', 'syselev', 'outscale', 'leaseweb', 'hetzner', 'cleura', 'scaleway',
    'ionos', 'upcloud', 'yandex'].includes(provider)
}

// ── Data model ────────────────────────────────────────────────────────────────

interface ProviderData {
  provider: string
  label: string
  color: string
  regions: string[]   // deduplicated base region keys
  azs: string[]     // availability zones (or full region names if none)
  entries: Array<{ normalized: string; az: string | null }>
}

function buildProviderData(detectedRegions: Array<[string, string, string | null]>): ProviderData[] {
  // Normalize raw entries
  const normalized = detectedRegions
    .filter(entry => Array.isArray(entry) && entry.length >= 3)
    .map(entry => {
      const [rawRegion, rawProvider, rawAz] = entry
      const region = typeof rawRegion === 'string'
        ? (rawRegion.includes('sinacloud') ? normalizeSinacloudRegion(rawRegion) : rawRegion)
        : ''
      return {
        region,
        provider: typeof rawProvider === 'string' ? rawProvider.toLowerCase() : '',
        az: typeof rawAz === 'string' && rawAz.trim() ? rawAz.trim() : null,
      }
    })

  // Collect AZs per exact region name
  const azsByRegion: Record<string, string[]> = {}
  for (const r of normalized) {
    if (!r.region) continue
    if (!azsByRegion[r.region]) azsByRegion[r.region] = []
    if (r.az && !azsByRegion[r.region].includes(r.az)) {
      azsByRegion[r.region].push(r.az)
    } else if (!r.az && needsZoneExtraction(r.provider)) {
      const zone = extractZoneFromRegion(r.region, r.provider)
      if (zone && !azsByRegion[r.region].includes(zone)) azsByRegion[r.region].push(zone)
    }
  }

  const providerMap: Map<string, ProviderData> = new Map()
  for (const r of normalized) {
    if (!r.provider || !r.region) continue
    const color = PROVIDER_COLORS[r.provider] ?? '#94a3b8'
    if (!providerMap.has(r.provider)) {
      providerMap.set(r.provider, {
        provider: r.provider,
        label: PROVIDER_LABEL[r.provider] ?? r.provider.toUpperCase(),
        color,
        regions: [],
        azs: [],
        entries: [],
      })
    }
    const pd = providerMap.get(r.provider)!

    // For SINA Cloud group by datacenter base
    let base = r.region
    if (r.provider === 'sinacloud') {
      const sinabase = getSinacloudBase(r.region)
      if (sinabase) base = sinabase
    } else {
      base = stripZoneSuffix(r.region)
    }

    if (!pd.regions.includes(base)) {
      pd.regions.push(base)
      pd.entries.push({ normalized: base, az: null })
    }

    const regionAzs = azsByRegion[r.region] ?? []
    // Every region counts as at least one availability zone
    if (regionAzs.length === 0) regionAzs.push(r.region)
    for (const az of regionAzs) {
      if (!pd.azs.includes(az)) pd.azs.push(az)
    }
  }

  return Array.from(providerMap.values()).sort((a, b) => providerRank(a.provider) - providerRank(b.provider)) as ProviderData[]
}

function buildGeoJSON(detectedRegions: Array<[string, string, string | null]>) {
  const seen = new Set<string>()
  const azsByRegion: Record<string, string[]> = {}
  for (const [rawRegion, rawProvider, rawAz] of detectedRegions) {
    if (!Array.isArray(rawRegion) && !Array.isArray(rawProvider)) continue
    const provider = typeof rawProvider === 'string' ? rawProvider.toLowerCase() : ''
    const region = typeof rawRegion === 'string'
      ? (rawRegion.includes('sinacloud') ? normalizeSinacloudRegion(rawRegion) : rawRegion)
      : ''
    if (!region || !provider) continue
    if (!azsByRegion[region]) azsByRegion[region] = []
    const az = typeof rawAz === 'string' && rawAz.trim() ? rawAz.trim() : null
    if (az && !azsByRegion[region].includes(az)) azsByRegion[region].push(az)
    else if (!az && needsZoneExtraction(provider)) {
      const zone = extractZoneFromRegion(region, provider)
      if (zone && !azsByRegion[region].includes(zone)) azsByRegion[region].push(zone)
    }
  }

  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const [rawRegion, rawProvider] of detectedRegions) {
    const provider = typeof rawProvider === 'string' ? rawProvider.toLowerCase() : ''
    const region = typeof rawRegion === 'string'
      ? (rawRegion.includes('sinacloud') ? normalizeSinacloudRegion(rawRegion) : rawRegion)
      : ''
    if (!region || !provider) continue
    const baseRegion = provider === 'sinacloud' ? getSinacloudBaseRegion(region) : stripZoneSuffix(region)
    const coords = REGION_COORDS[baseRegion]
    if (!coords) continue
    const key = `${region}:${provider}`
    if (seen.has(key)) continue
    seen.add(key)
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coords[1], coords[0]] },
      properties: {
        key,
        region,
        baseRegion,
        provider,
        color: PROVIDER_COLORS[provider] ?? '#94a3b8',
        azs: azsByRegion[region] ?? [],
      },
    })
  }
  return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection<GeoJSON.Point>
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  const accent = color ?? 'var(--waf-brand)'
  return (
    <div style={{
      borderRadius: '12px', padding: '1rem 1.25rem',
      background: `${accent}0d`,
      border: `1px solid ${accent}30`,
      display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0,
    }}
    >
      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: typeof value === 'number' ? '1.75rem' : '1.1rem', fontWeight: 800, color: accent, lineHeight: 1.1, wordBreak: 'break-word' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.64rem', color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

function ProviderCard({
  data, active, onHover, onClick,
}: {
  data: ProviderData
  active: boolean
  onHover: (provider: string | null) => void
  onClick: () => void
}) {
  const { t } = useI18n()
  const azCount = data.azs.length

  return (
    <button
      onMouseEnter={() => onHover(data.provider)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: '0.4rem',
        padding: '0.9rem 1rem', borderRadius: '12px', textAlign: 'left',
        background: active ? `${data.color}12` : 'var(--surface)',
        border: `2px solid ${active ? data.color : 'var(--border)'}`,
        cursor: 'pointer', transition: 'all .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: data.color, flexShrink: 0 }} />
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: active ? data.color : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.label}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.2rem' }}>
        <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>{data.regions.length}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.regions.regionsLabel')}</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--muted)', marginLeft: '0.25rem' }}>·</span>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: data.color }}>{azCount}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.regions.azsLabel')}</span>
      </div>
    </button>
  )
}

function RegionChip({
  region, provider, color, hovered,
}: {
  region: string
  provider: string
  color: string
  hovered: boolean
}) {
  const baseRegion = provider === 'sinacloud' ? getSinacloudBaseRegion(region) : stripZoneSuffix(region)
  const label = REGION_LABELS[baseRegion]
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.4rem 0.75rem', borderRadius: '8px',
      background: hovered ? `${color}18` : 'var(--bg)',
      border: `1px solid ${hovered ? color : `${color}40`}`,
      fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text)',
      transition: 'all .15s',
    }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span>{region}</span>
      {label && (
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'sans-serif' }}>
          · {label}
        </span>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RegionsPage({ run }: Props) {
  const { t } = useI18n()
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null)
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [popup, setPopup] = useState<{ region: string; provider: string; azs: string[]; baseRegion: string; color: string } | null>(null)

  const providers = useMemo(() => buildProviderData(run.detected_regions ?? []), [run.detected_regions])
  const geojson = useMemo(() => buildGeoJSON(run.detected_regions ?? []), [run.detected_regions])

  const totalRegions = useMemo(() => providers.reduce((sum, p) => sum + p.regions.length, 0), [providers])
  const totalAZs = useMemo(() => providers.reduce((sum, p) => sum + p.azs.length, 0), [providers])

  if (providers.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        {t('pages.regions.noRegions')}
      </div>
    )
  }

  const displayedProvider = activeProvider || hoveredProvider

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.35rem' }}>
            {t('pages.regions.pageTitle')}
          </h1>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', maxWidth: '520px', lineHeight: 1.5 }}>
            {t('pages.regions.pageSubtitle')}
          </div>
        </div>
        {run.source_paths && run.source_paths.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600 }}>{t('pages.regions.scannedPaths')}</span>
            {run.source_paths.map(p => (
              <code key={p} style={{
                fontSize: '0.7rem', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '4px', padding: '0.15em 0.45em', color: 'var(--text)',
              }}
              >{p}</code>
            ))}
          </div>
        )}
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.875rem' }}>
        <KPI label={t('pages.regions.totalRegions')} value={totalRegions} sub={`${totalRegions} ${t('pages.regions.regionsLabel')}`} />
        <KPI label={t('pages.regions.totalAZs')} value={totalAZs} sub={`${totalAZs} ${t('pages.regions.azsLabel')}`} color="#8b5cf6" />
        <KPI label={t('pages.regions.providers')} value={providers.length} sub={t('pages.regions.providersDetected')} color="#f59e0b" />
        <KPI label={t('pages.regions.totalResources')} value={run.findings?.length ?? 0} sub="Total" color="#14b8a6" />
      </div>

      {/* ── Provider selector grid ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('pages.regions.providerBreakdown')}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
            {t('pages.regions.hoverHint')}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {providers.map(p => (
            <ProviderCard
              key={p.provider}
              data={p}
              active={displayedProvider === p.provider}
              onHover={setHoveredProvider}
              onClick={() => setActiveProvider(prev => prev === p.provider ? null : p.provider)}
            />
          ))}
        </div>
      </div>

      {/* ── Map ── */}
      {geojson.features.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap',
          }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.regions.deploymentMap')}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {providers.map(p => (
                <span
                  key={p.provider}
                  onMouseEnter={() => setHoveredProvider(p.provider)}
                  onMouseLeave={() => setHoveredProvider(null)}
                  onClick={() => setActiveProvider(prev => prev === p.provider ? null : p.provider)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    fontSize: '0.72rem', color: displayedProvider === p.provider ? 'var(--text)' : 'var(--muted)',
                    cursor: 'pointer', fontWeight: displayedProvider === p.provider ? 700 : 500,
                    transition: 'color 0.2s',
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                  {p.provider.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: '460px', width: '100%' }}>
            <MapGl
              initialViewState={{ latitude: 25, longitude: 15, zoom: 2 }}
              style={{ width: '100%', height: '100%' }}
              mapStyle={{
                version: 8,
                sources: {
                  osm: {
                    type: 'raster',
                    tiles: [
                      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    ],
                    tileSize: 256,
                    attribution: t('pages.regions.mapAttribution'),
                    maxzoom: 19,
                  },
                },
                layers: [
                  { id: 'osm', type: 'raster', source: 'osm' },
                ],
              }}
              scrollZoom={false}
            >
              <Source id="regions" type="geojson" data={geojson}>
                <Layer
                  id="region-points"
                  type="circle"
                  paint={{
                    'circle-radius': [
                      'case',
                      ['any', ['!', ['has', 'provider']], ['==', ['get', 'provider'], '']],
                      7,
                      ['==', ['to-string', ['get', 'provider']], displayedProvider ?? ''],
                      9,
                      7,
                    ],
                    'circle-color': ['get', 'color'],
                    'circle-opacity': [
                      'case',
                      ['==', displayedProvider ?? '', ''],
                      0.85,
                      ['==', ['to-string', ['get', 'provider']], displayedProvider ?? ''],
                      0.85,
                      0.25,
                    ],
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': [
                      'case',
                      ['==', ['to-string', ['get', 'provider']], displayedProvider ?? ''],
                      4,
                      2,
                    ],
                  }}
                />
              </Source>
              {popup && (
                <Popup
                  latitude={REGION_COORDS[popup.baseRegion]?.[0] ?? 0}
                  longitude={REGION_COORDS[popup.baseRegion]?.[1] ?? 0}
                  onClose={() => setPopup(null)}
                  closeButton={false}
                  offset={12}
                >
                  <div style={{ fontSize: '0.8rem' }}>
                    <strong style={{ color: popup.color }}>{popup.region}</strong><br />
                    <span style={{ color: 'var(--muted)' }}>{REGION_LABELS[popup.baseRegion] ?? ''}</span><br />
                    <span style={{ fontWeight: 600 }}>{PROVIDER_LABEL[popup.provider] ?? popup.provider}</span>
                    {popup.azs.length > 0 && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>
                        {t('pages.regions.azsLabel')}: {popup.azs.slice(0, 6).join(', ')}
                        {popup.azs.length > 6 && ` +${popup.azs.length - 6}`}
                      </div>
                    )}
                  </div>
                </Popup>
              )}
            </MapGl>
          </div>
        </div>
      )}

      {/* ── Provider region detail ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {providers.map(p => {
          const expanded = !activeProvider || activeProvider === p.provider
          if (!expanded) return null
          return (
            <div
              key={p.provider}
              onMouseEnter={() => setHoveredProvider(p.provider)}
              onMouseLeave={() => setHoveredProvider(null)}
              className="card"
              style={{
                borderLeft: `4px solid ${p.color}`,
                transition: 'all .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color }} />
                  <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                    {p.label}
                  </h2>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    {p.regions.length} {t('pages.regions.regionsLabel')} · {p.azs.length} {t('pages.regions.azsLabel')}
                  </span>
                </div>
                {activeProvider === p.provider && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveProvider(null) }}
                    style={{
                      fontSize: '0.7rem', color: 'var(--muted)', background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: '6px', padding: '0.25rem 0.55rem',
                      cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    {t('common.showLess')}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {p.regions.map(region => (
                  <RegionChip
                    key={region}
                    region={region}
                    provider={p.provider}
                    color={p.color}
                    hovered={hoveredProvider === p.provider}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
