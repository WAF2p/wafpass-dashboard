import { RunDetail } from '../api'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { REGION_COORDS, REGION_LABELS, PROVIDER_COLORS } from '../region-data'

interface Props { run: RunDetail }

const PROVIDER_LABEL: Record<string, string> = {
  aws:      'Amazon Web Services',
  azure:    'Microsoft Azure',
  gcp:      'Google Cloud Platform',
  alicloud: 'Alibaba Cloud',
  yandex:   'Yandex Cloud',
  oci:      'Oracle Cloud Infrastructure',
}

function detectProvider(entry: string[]): string {
  if (entry.length > 1 && entry[1]) return entry[1].toLowerCase()
  const r = entry[0] ?? ''
  if (r.match(/^(eu-|us-|ap-|sa-|ca-|me-|af-|il-)/)) return 'aws'
  if (r.match(/^(westeurope|eastus|northeurope|germanywest|southeastasia|australiaeast|japaneast|brazilsouth|uksouth|francecentral)/)) return 'azure'
  if (r.match(/^(europe-|us-central|asia-|southamerica-|northamerica-|australia-southeast|africa-south)/)) return 'gcp'
  if (r.match(/^(eu-frankfurt|us-ashburn|us-phoenix|uk-london|ap-tokyo|ap-sydney|ap-mumbai|sa-saopaulo|ca-toronto)/)) return 'oci'
  if (r.match(/^cn-/)) return 'alicloud'
  return 'unknown'
}

export default function RegionsPage({ run }: Props) {
  const regions = run.detected_regions ?? []

  if (regions.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        No deployed regions detected for this run.
      </div>
    )
  }

  // Group by provider
  const grouped: Record<string, string[][]> = {}
  for (const entry of regions) {
    if (!Array.isArray(entry) || entry.length === 0) continue
    const provider = detectProvider(entry)
    if (!grouped[provider]) grouped[provider] = []
    grouped[provider].push(entry)
  }

  const providerOrder = ['aws', 'azure', 'gcp', 'oci', 'alicloud', 'yandex', 'unknown']
  const sortedProviders = Object.keys(grouped).sort(
    (a, b) => providerOrder.indexOf(a) - providerOrder.indexOf(b)
  )

  // Build map markers
  const markers: { region: string; provider: string; coords: [number, number] }[] = []
  for (const entry of regions) {
    if (!Array.isArray(entry) || entry.length === 0) continue
    const region = entry[0]
    const provider = detectProvider(entry)
    const coords = REGION_COORDS[region]
    if (coords) markers.push({ region, provider, coords })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Summary KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Regions</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--waf-brand)' }}>{regions.length}</div>
        </div>
        {sortedProviders.map(provider => (
          <div key={provider} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderLeft: `3px solid ${PROVIDER_COLORS[provider] ?? '#94a3b8'}` }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {PROVIDER_LABEL[provider] ?? provider.toUpperCase()}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: PROVIDER_COLORS[provider] ?? '#94a3b8' }}>
              {grouped[provider].length}
            </div>
          </div>
        ))}
      </div>

      {/* World map */}
      {markers.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px' }}>
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Deployment Map
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {sortedProviders.map(p => (
                <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PROVIDER_COLORS[p] ?? '#94a3b8', display: 'inline-block' }} />
                  {PROVIDER_LABEL[p] ?? p}
                </span>
              ))}
            </div>
          </div>
          <MapContainer
            center={[20, 10]}
            zoom={2}
            style={{ height: '420px', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {markers.map((m, i) => (
              <CircleMarker
                key={i}
                center={m.coords}
                radius={8}
                pathOptions={{
                  color: PROVIDER_COLORS[m.provider] ?? '#94a3b8',
                  fillColor: PROVIDER_COLORS[m.provider] ?? '#94a3b8',
                  fillOpacity: 0.75,
                  weight: 2,
                }}
              >
                <Tooltip>
                  <div style={{ fontSize: '0.8rem' }}>
                    <strong>{m.region}</strong><br />
                    {REGION_LABELS[m.region] ?? ''}<br />
                    <span style={{ color: PROVIDER_COLORS[m.provider] }}>{PROVIDER_LABEL[m.provider] ?? m.provider}</span>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Provider sections */}
      {sortedProviders.map(provider => {
        const color = PROVIDER_COLORS[provider] ?? '#94a3b8'
        const label = PROVIDER_LABEL[provider] ?? provider.toUpperCase()
        return (
          <div key={provider} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}88` }} />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{label}</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{grouped[provider].length} regions</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {grouped[provider].map((entry, i) => (
                <div key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.75rem', borderRadius: '8px',
                  background: 'var(--bg)', border: `1px solid ${color}33`,
                  fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text)',
                }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {entry[0]}
                  {REGION_LABELS[entry[0]] && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                      · {REGION_LABELS[entry[0]]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Source paths */}
      {run.source_paths && run.source_paths.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
            Scanned Source Paths
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {run.source_paths.map((p, i) => (
              <code key={i} style={{ fontSize: '0.82rem', color: 'var(--text)', padding: '0.3rem 0.6rem', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                {p}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
