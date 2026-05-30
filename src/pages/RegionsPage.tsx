import { RunDetail } from '../api'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { REGION_COORDS, REGION_LABELS, PROVIDER_COLORS } from '../region-data'
import { useI18n } from '../i18n'

interface Props { run: RunDetail }

const PROVIDER_LABEL: Record<string, string> = {
  aws:      'Amazon Web Services',
  azure:    'Microsoft Azure',
  gcp:      'Google Cloud Platform',
  alicloud: 'Alibaba Cloud',
  yandex:   'Yandex Cloud',
  oci:      'Oracle Cloud Infrastructure',
  ovh:      'OVH Cloud',
  hetzner:  'Hetzner Cloud',
  stackit:  'STACKIT',
  infomaniak: 'Infomaniak',
  leafcloud:  'Leafcloud',
  tcloud:     'T Cloud Public',
  seeweb:     'Seeweb',
  exoscale:   'Exoscale',
  cyso:       'Cyso',
  numspot:    'Numspot',
  plusserver: 'plusserver',
  syselev:    'SysEleven',
  outscale:   'Outscale',
  leaseweb:   'Leaseweb',
  scaleway:   'Scaleway',
  ionos:      'IONOS',
  upcloud:    'UpCloud',
  cleura:     'Cleura',
  sinacloud:  'SINA Cloud',
}

function detectProvider(entry: string[]): string {
  if (entry.length > 1 && entry[1]) return entry[1].toLowerCase()
  const r = entry[0] ?? ''
  if (r.match(/^(eu-|us-|ap-|sa-|ca-|me-|af-|il-)/)) return 'aws'
  if (r.match(/^(westeurope|eastus|northeurope|germanywest|southeastasia|australiaeast|japaneast|brazilsouth|uksouth|francecentral)/)) return 'azure'
  if (r.match(/^(europe-|us-central|asia-|southamerica-|northamerica-|australia-southeast|africa-south)/)) return 'gcp'
  if (r.match(/^(eu-frankfurt|us-ashburn|us-phoenix|uk-london|ap-tokyo|ap-sydney|ap-mumbai|sa-saopaulo|ca-toronto)/)) return 'oci'
  if (r.match(/^cn-/)) return 'alicloud'
  if (r.match(/^(chi|zrh|gva)-[0-9]+(-infomaniak)?$/) || r.match(/^(chi|zrh|gva)-[0-9]+-infomaniak$/)) return 'infomaniak'
  if (r.match(/^(bru|ams|fra|mad|mil|par)-[0-9]+(-leafcloud)?$/) || r.match(/^(bru|ams|fra|mad|mil|par)-[0-9]+-leafcloud$/)) return 'leafcloud'
  if (r.match(/^(ts|os|hk)-[0-9]+(-tcloud)?$/) || r.match(/^(ts|os|hk)-[0-9]+-tcloud$/)) return 'tcloud'
  if (r.match(/^(mep|mil|rom)-[0-9]+(-seeweb)?$/) || r.match(/^(mep|mil|rom)-[0-9]+-seeweb$/)) return 'seeweb'
  if (r.match(/^(ch-dk-[0-9]|de-fra-[0-9]|uk-lon-[0-9]|fr-par-[0-9])-([0-9]+-)?exoscale$/)) return 'exoscale'
  if (r.match(/^(ams|bru|fra)-[0-9]+(-cyso)?$/) || r.match(/^(ams|bru|fra)-[0-9]+-cyso$/)) return 'cyso'
  if (r.match(/^(ams|den)-[0-9]+(-numspot)?$/) || r.match(/^(ams|den)-[0-9]+-numspot$/)) return 'numspot'
  if (r.match(/^(bgm|fxh)-[0-9]+(-plusserver)?$/) || r.match(/^(bgm|fxh)-[0-9]+-plusserver$/)) return 'plusserver'
  if (r.match(/^(fra|muc)-[0-9]+(-syselev)?$/) || r.match(/^(fra|muc)-[0-9]+-syselev$/)) return 'syselev'
  if (r.match(/^(stg|par)-[0-9]+(-outscale)?$/) || r.match(/^(stg|par)-[0-9]+-outscale$/)) return 'outscale'
  if (r.match(/^(ams|fwm)-[0-9]+(-leaseweb)?$/) || r.match(/^(ams|fwm)-[0-9]+-leaseweb$/)) return 'leaseweb'
  if (r.match(/^(par|ams|fr-gra)-[0-9]+(-scaleway)?$/) || r.match(/^(par|ams|fr-gra)-[0-9]+-scaleway$/)) return 'scaleway'
  if (r.match(/^(de-fra|de-muc|de-ber|gb-lon|se-sto|es-bar|us-las)-[0-9]+(-ionos)?$/) || r.match(/^(de-fra|de-muc|de-ber|gb-lon|se-sto|es-bar|us-las)-[0-9]+-ionos$/)) return 'ionos'
  if (r.match(/^(fi-hel|de-fra|uk-lon|us-iad|us-sjo|nl-ams)[0-9]+(-upcloud)?$/) || r.match(/^(fi-hel|de-fra|uk-lon|us-iad|us-sjo|nl-ams)[0-9]+-upcloud$/)) return 'upcloud'
  if (r.match(/^(se-sto|se-Gothenburg|fi-hel|de-fra|nl-ams|uk-lon)-[0-9]+(-cleura)?$/) || r.match(/^(se-sto|se-Gothenburg|fi-hel|de-fra|nl-ams|uk-lon)-[0-9]+-cleura$/)) return 'cleura'
  // SINA Cloud - Germany-based cloud by secunet (must be checked before generic de-* patterns)
  if (r.match(/^(de-ham-[0-9]+|de-du-[0-9]+|de-fra-[0-9]+)-sinacloud$/)) return 'sinacloud'
  if (r.match(/^(de|fr|nl|uk|us|ca|br|pl|se|it|es|at|ch|be|ie|dk|no|fi|lt|lv|ee|bg|ro|hr|sk|cz|hu|gr|pt|ie|ru|tr|ua|by|kz|md|uz|tj|kg|am|az|ge|mk|rs|ba|me|al|gr|tr|il|ae|sa|qa|in|jp|cn|sg|my|th|vn|ph|id|nz|au)(-ovh|-stackit|-hetzner)?$/)) return 'ovh'
  if (r.match(/^(fs|hi|nbg|us|ca|eu|)(-ovh|-stackit|-hetzner)?$/)) return 'hetzner'
  if (r.match(/^(de|eu|us|ca|apac|)(-ovh|-stackit|-hetzner)?$/)) return 'stackit'
  return 'unknown'
}

export default function RegionsPage({ run }: Props) {
  const { t } = useI18n()
  const detectedRegions = run.detected_regions ?? []

  // Convert detected_regions (now [region, provider, az]) to just region names for grouping
  // Handle both old 2-element format and new 3-element format
  const regions: string[] = detectedRegions.map(entry => {
    if (Array.isArray(entry) && entry.length >= 1) {
      return entry[0]
    }
    return ''
  }).filter(r => r !== '')

  // Track AZs per region for display
  // detectedRegions is now [[region, provider, az], ...]
  const azsByRegion: Record<string, string[]> = {}
  for (const entry of detectedRegions) {
    if (Array.isArray(entry) && entry.length >= 3) {
      const region = entry[0]
      const az = entry[2]
      if (region && az) {
        if (!azsByRegion[region]) azsByRegion[region] = []
        if (!azsByRegion[region].includes(az)) azsByRegion[region].push(az)
      }
    }
  }

  // Extract unique regions for the count and map (deduplicate by region only)
  const uniqueRegions = Array.from(new Set(regions))

  // Also track unique region+provider pairs for map markers
  const seenRegionProvider = new Set<string>()
  const uniqueMarkers: { region: string; provider: string; azs: string[] }[] = []
  for (const entry of detectedRegions) {
    if (Array.isArray(entry) && entry.length >= 3) {
      const region = entry[0]
      const provider = entry[1]
      const key = `${region.toLowerCase()}:${provider.toLowerCase()}`
      if (!seenRegionProvider.has(key)) {
        seenRegionProvider.add(key)
        const azs = azsByRegion[region] || []
        uniqueMarkers.push({ region, provider, azs })
      }
    }
  }

  if (uniqueRegions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        {t('pages.regions.noRegions')}
      </div>
    )
  }

  // Group by provider using the original detectedRegions which has provider info
  const grouped: Record<string, string[][]> = {}
  for (const entry of detectedRegions) {
    if (!Array.isArray(entry) || entry.length === 0) continue
    const provider = detectProvider(entry)
    if (!grouped[provider]) grouped[provider] = []
    grouped[provider].push(entry)
  }

  const providerOrder = ['aws', 'azure', 'gcp', 'ovh', 'hetzner', 'stackit', 'sinacloud', 'oci', 'alicloud', 'yandex', 'infomaniak', 'leafcloud', 'tcloud', 'seeweb', 'exoscale', 'cyso', 'numspot', 'plusserver', 'syselev', 'outscale', 'leaseweb', 'scaleway', 'ionos', 'upcloud', 'cleura', 'unknown']
  const sortedProviders = Object.keys(grouped).sort(
    (a, b) => providerOrder.indexOf(a) - providerOrder.indexOf(b)
  )

  const markers: { region: string; provider: string; coords: [number, number] }[] = []
  for (const m of uniqueMarkers) {
    const coords = REGION_COORDS[m.region]
    if (coords) markers.push({ region: m.region, provider: m.provider, coords })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem 1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('pages.regions.totalRegions')}</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--waf-brand)' }}>{uniqueRegions.length}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{t('pages.regions.totalAZs', { count: String(detectedRegions.length) })}</div>
        </div>
        {sortedProviders.map(provider => {
          // Deduplicate entries by region name
          const seenRegions = new Set<string>()
          for (const entry of grouped[provider]) {
            seenRegions.add(entry[0])
          }
          const dedupedRegionCount = seenRegions.size

          const azs = Array.from(new Set(
            grouped[provider]
              .filter((e: any) => Array.isArray(e) && e.length >= 3 && e[2])
              .map((e: any) => e[2])
          ));
          return (
            <div key={provider} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem 1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', borderLeft: `3px solid ${PROVIDER_COLORS[provider] ?? '#94a3b8'}` }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {PROVIDER_LABEL[provider] ?? provider.toUpperCase()}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: PROVIDER_COLORS[provider] ?? '#94a3b8' }}>
                {azs.length}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                {dedupedRegionCount} regions / {azs.length} AZs
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                {azs.slice(0, 10).map((az, i) => (
                  <span key={i} style={{ display: 'inline-block', padding: '0.15rem 0.4rem', borderRadius: '4px', background: `${PROVIDER_COLORS[provider]}1a`, color: 'var(--muted)', fontSize: '0.62rem', fontFamily: 'monospace' }}>
                    {az}
                  </span>
                ))}
                {azs.length > 10 && (
                  <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--bg)', color: 'var(--muted)', fontSize: '0.62rem' }}>
                    +{azs.length - 10} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {markers.length > 0 && (
        <div style={{ padding: 0, overflow: 'hidden', borderRadius: '16px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.regions.deploymentMap')}
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
          <MapContainer center={[20, 10]} zoom={2} style={{ height: '420px', width: '100%' }} scrollWheelZoom={false}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/developers/cartodb-js/">CARTO</a>'
              className="light-mode-tiles"
            />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/developers/cartodb-js/">CARTO</a>'
              className="dark-mode-tiles"
            />
            {markers.map((m, i) => {
              const azs = azsByRegion[m.region] || []
              return (
                <CircleMarker key={i} center={m.coords} radius={8} pathOptions={{ color: PROVIDER_COLORS[m.provider] ?? '#94a3b8', fillColor: PROVIDER_COLORS[m.provider] ?? '#94a3b8', fillOpacity: 0.75, weight: 2 }}>
                  <Tooltip>
                    <div style={{ fontSize: '0.8rem' }}>
                      <strong>{m.region}</strong><br />
                      {REGION_LABELS[m.region] ?? ''}<br />
                      <span style={{ color: PROVIDER_COLORS[m.provider] }}>{PROVIDER_LABEL[m.provider] ?? m.provider}</span>
                      {azs.length > 0 && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>
                          {azs.length} AZ{azs.length > 1 ? 's' : ''}: {azs.join(', ')}
                        </div>
                      )}
                    </div>
                  </Tooltip>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>
      )}

      {sortedProviders.map(provider => {
        const color = PROVIDER_COLORS[provider] ?? '#94a3b8'
        const label = PROVIDER_LABEL[provider] ?? provider.toUpperCase()
        // Deduplicate entries by region name within this provider's group
        // Each unique region should only appear once, with all its AZs combined
        const seenRegions = new Set<string>()
        const uniqueEntries: string[][] = []
        for (const entry of grouped[provider]) {
          const regionName = entry[0]
          if (!seenRegions.has(regionName)) {
            seenRegions.add(regionName)
            uniqueEntries.push(entry)
          }
        }
        return (
          <div key={provider} style={{ padding: '1.25rem 1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}88` }} />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{label}</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                {t('pages.regions.regionsCount', { count: String(uniqueEntries.length) })}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {uniqueEntries.map((entry, i) => {
                const regionName = entry[0]
                const az = entry.length >= 3 ? entry[2] : undefined
                const azs = azsByRegion[regionName] || (az ? [az] : [])
                return (
                  <div key={i} style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem', padding: '0.35rem 0.75rem', borderRadius: '8px', background: 'var(--bg)', border: `1px solid ${color}33`, fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                      {regionName}
                      {REGION_LABELS[regionName] && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                          · {REGION_LABELS[regionName]}
                        </span>
                      )}
                    </div>
                    {azs.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {azs.map((a, ai) => (
                          <span key={ai} style={{ fontSize: '0.7rem', color: 'var(--muted)', opacity: 0.8 }}>
                            AZ: {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {run.source_paths && run.source_paths.length > 0 && (
        <div style={{ padding: '1.25rem 1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
            {t('pages.regions.scannedPaths')}
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
