import { RunDetail } from '../api'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { REGION_COORDS, REGION_LABELS, PROVIDER_COLORS } from '../region-data'
import { useI18n } from '../i18n'
import { useState } from 'react'

// Helper to strip zone suffix (single letter like -a, -b) for region lookup
function stripZoneSuffix(region: string): string {
  // Check if region ends with a single lowercase letter (zone suffix)
  // Pattern: region-letter where region is alphanumeric with hyphens
  const match = region.match(/^(.+)-([a-z])$/)
  if (match) {
    const base = match[1]
    // Only strip if the base doesn't already end with a digit (which would be part of region name)
    // e.g., "eu-central-1" has a digit, so "eu-central-1-a" is region+zone
    // but "us" doesn't have a digit, so "us-a" would NOT be region+zone
    if (base.length > 0 && base[base.length - 1] >= '0' && base[base.length - 1] <= '9') {
      return base
    }
  }
  return region
}

// Helper to get the base region for SINA Cloud (strip numeric zone suffix)
// e.g., "de-ham-sinacloud-1" -> "de-ham-sinacloud"
function getSinacloudBaseRegion(region: string): string {
  // Check if this is a SINA Cloud region with a numeric zone suffix
  const match = region.match(/^(de-[a-z]{2,3})-sinacloud-\d+$/)
  if (match) {
    return match[1] + '-sinacloud'
  }
  return region
}

// Helper to get the datacenter base for SINA Cloud regions (without zone number)
// e.g., "de-ham-sinacloud-1" -> "de-ham-sinacloud", "de-du-sinacloud-3" -> "de-du-sinacloud"
function getSinacloudBase(region: string | null): string | null {
  if (!region || !region.includes('-sinacloud')) {
    return null
  }
  // Match patterns like de-ham-sinacloud-1, de-du-sinacloud-2, de-fra-sinacloud-3
  // Region prefix can be 2 or 3 letters (de-ham, de-du, de-fra)
  const match = region.match(/^(de-[a-z]{2,3})-sinacloud(-\d+)?$/)
  if (match) {
    return match[1] + '-sinacloud'  // e.g., "de-ham-sinacloud", "de-du-sinacloud"
  }
  return null
}

// Helper to normalize SINA Cloud region names that may have malformed format
// e.g., "de-ham-sinacloud-de-ham-1" -> "de-ham-sinacloud-1"
// e.g., "de-fra-sinacloud-de-fra" -> "de-fra-sinacloud" (no zone)
function normalizeSinacloudRegion(region: string | null): string {
  if (!region) return ''
  // Check if this looks like a malformed SINA Cloud region (contains "-sinacloud-" pattern)
  // Region prefix can be 2 or 3 letters (de-ham, de-du, de-fra)
  if (region.includes('-sinacloud-') && region.match(/^-de-[a-z]{2,3}-sinacloud-de-[a-z]{2,3}/)) {
    // Extract the base (de-ham, de-du, de-fra) and the zone
    const match = region.match(/^(de-[a-z]{2,3})-sinacloud-(de-[a-z]{2,3})(-\d+)?$/)
    if (match) {
      const base = match[1] // de-ham, de-du, or de-fra
      const zone = match[3] || '' // -1, -2, -3, or empty
      return `${base}-sinacloud${zone}`
    }
  }
  return region
}

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

export default function RegionsPage({ run }: Props) {
  const { t } = useI18n()
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null)
  const detectedRegions = run.detected_regions ?? []

  // Normalize all region names first to handle malformed SINA Cloud formats
  const normalizedRegions: { original: string; normalized: string; provider: string; az: string | null }[] = detectedRegions
    .filter(entry => Array.isArray(entry) && entry.length >= 3)
    .map(entry => {
      const region = entry[0]
      const provider = entry[1]
      const az = entry[2]
      const normalized = typeof region === 'string' && region.includes('sinacloud')
        ? normalizeSinacloudRegion(region)
        : region
      return { original: region, normalized: typeof normalized === 'string' ? normalized : (typeof region === 'string' ? region : ''), provider: typeof provider === 'string' ? provider : '', az: typeof az === 'string' ? az : null }
    })

  // Helper to extract zone from region name when az field is None
  function extractZoneFromRegion(region: string, provider: string): string | null {
    // For SINA Cloud, extract numeric zone: "de-ham-sinacloud-1" -> "1"
    if (provider === 'sinacloud' && region.includes('sinacloud')) {
      const match = region.match(/^(de-[a-z]{2,3})-sinacloud-(\d+)$/)
      if (match) return match[2]
    }
    // For Alibaba Cloud, extract zone: "cn-hangzhou-a" -> "a"
    if (provider === 'alicloud' && region.includes('cn-')) {
      const match = region.match(/^(cn-[a-z]+)-([a-z])$/)
      if (match) return match[2]
    }
    // For providers with zone suffix like "-a", "-b", "-1"
    // Check if region ends with hyphen + letter/number
    const match = region.match(/^(.+)-([a-z0-9]+)$/)
    if (match) {
      const base = match[1]
      const suffix = match[2]
      // Only treat as zone if base doesn't already end with a digit (e.g., "eu-central-1-a")
      // or if it's a known zone pattern
      if (suffix.length === 1 || (suffix.length <= 2 && provider === 'azure')) {
        // Check if base ends with digit (common for regions like "us-east-1")
        if (base[base.length - 1] >= '0' && base[base.length - 1] <= '9') {
          return suffix
        }
        // Also check if base looks like a region with common patterns
        // e.g., "europe-west4", "us-central1", "asia-southeast1"
        if (base.match(/^[a-z]+-\d+$/)) {
          return suffix
        }
      }
    }
    return null
  }

  // Track AZs per region for display
  // For regions that already contain the zone in their name (like "de-ham-sinacloud-1"),
  // use the full region name as the AZ. For regions with separate zone (like "europe-west4" + "a"),
  // use the zone letter.
  const azsByRegion: Record<string, string[]> = {}
  for (const r of normalizedRegions) {
    // First, check if az field has the zone
    if (r.az) {
      if (!azsByRegion[r.normalized]) azsByRegion[r.normalized] = []
      if (!azsByRegion[r.normalized].includes(r.az)) azsByRegion[r.normalized].push(r.az)
    } else {
      // No separate az field - extract zone from region name if embedded
      // Pattern 1: zone suffix like "europe-west1-a", "us-east1-b"
      // Pattern 2: SINA Cloud style "de-ham-sinacloud-1"
      // Pattern 3: Alibaba Cloud style "cn-hangzhou-a"
      const zoneFromRegion = extractZoneFromRegion(r.normalized, r.provider)
      if (zoneFromRegion) {
        if (!azsByRegion[r.normalized]) azsByRegion[r.normalized] = []
        if (!azsByRegion[r.normalized].includes(zoneFromRegion)) azsByRegion[r.normalized].push(zoneFromRegion)
      }
    }
  }

  // Extract unique regions for the count and map
  // For SINA Cloud, group by datacenter base (without zone number) so de-ham-1, de-ham-2, de-ham-3 become just "de-ham"
  const seenRegionKeys = new Set<string>()
  const uniqueRegions: string[] = []
  for (const r of normalizedRegions) {
    let regionKey = r.normalized
    // For SINA Cloud, use the datacenter base without zone for grouping
    if (r.provider === 'sinacloud') {
      const base = getSinacloudBase(r.normalized)
      if (base) regionKey = base
    }
    if (!seenRegionKeys.has(regionKey)) {
      seenRegionKeys.add(regionKey)
      uniqueRegions.push(regionKey)
    }
  }

  // Also track unique region+provider pairs for map markers
  // Include all regions that have zone info (either from az field or embedded in region name)
  // For regions without zones, still include them but use empty/placeholder azs
  const seenRegionProvider = new Set<string>()
  const uniqueMarkers: { region: string; provider: string; azs: string[] }[] = []
  for (const r of normalizedRegions) {
    const key = `${r.normalized.toLowerCase()}:${r.provider.toLowerCase()}`
    if (!seenRegionProvider.has(key)) {
      seenRegionProvider.add(key)
      const azs = azsByRegion[r.normalized] || []
      uniqueMarkers.push({ region: r.normalized, provider: r.provider, azs })
    }
  }

  if (uniqueRegions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        {t('pages.regions.noRegions')}
      </div>
    )
  }

  // Helper to check if provider needs zone extraction from region name
  function needsZoneExtraction(provider: string): boolean {
    // These providers have zones embedded in the region name
    const providersWithEmbeddedZones = ['sinacloud', 'stackit', 'tcloud', 'infomaniak', 'leafcloud', 'seeweb', 'exoscale', 'cyso', 'numspot', 'plusserver', 'syselev', 'outscale', 'leaseweb', 'ionos', 'upcloud', 'hetzner', 'cleura', 'scaleway', 'yandex']
    return providersWithEmbeddedZones.includes(provider)
  }

  // Group by provider using the normalized regions
  // For SINA Cloud, group by datacenter base (without zone number)
  const grouped: Record<string, { base: string; entries: typeof normalizedRegions; azs: string[] }> = {}
  for (const entry of normalizedRegions) {
    if (!entry.provider) continue
    const entryBase = entry.provider === 'sinacloud' && entry.normalized ? getSinacloudBase(entry.normalized) : null
    const base = entryBase ? entryBase : entry.normalized
    if (!grouped[entry.provider]) grouped[entry.provider] = { base, entries: [], azs: [] }
    // For SINA Cloud, only add unique base entries (deduplicate by base region)
    // Store the full region name with zone in entries for display
    if (entry.provider === 'sinacloud' && entryBase) {
      const existingBase = grouped[entry.provider].entries.find(e => getSinacloudBase(e.normalized) === entryBase)
      if (!existingBase) {
        // For SINA Cloud, store the base region (without zone) as normalized
        // but keep the original region name in entries array for AZ display
        grouped[entry.provider].entries.push({ ...entry, normalized: entryBase, az: null })
      }
    } else {
      grouped[entry.provider].entries.push(entry)
    }
    // Collect all AZs for this provider - extract zone from region name when az field is None
    if (entry.normalized && entry.az === null && needsZoneExtraction(entry.provider)) {
      const zone = extractZoneFromRegion(entry.normalized, entry.provider)
      if (zone && !grouped[entry.provider].azs.includes(zone)) {
        grouped[entry.provider].azs.push(zone)
      }
    } else if (entry.az && !grouped[entry.provider].azs.includes(entry.az)) {
      // For providers with separate az field (like Azure, GCP, Alibaba)
      grouped[entry.provider].azs.push(entry.az)
    }
  }

  const providerOrder = ['aws', 'azure', 'gcp', 'ovh', 'hetzner', 'stackit', 'sinacloud', 'oci', 'alicloud', 'yandex', 'infomaniak', 'leafcloud', 'tcloud', 'seeweb', 'exoscale', 'cyso', 'numspot', 'plusserver', 'syselev', 'outscale', 'leaseweb', 'scaleway', 'ionos', 'upcloud', 'cleura', 'unknown']
  const sortedProviders = Object.keys(grouped).sort(
    (a, b) => providerOrder.indexOf(a) - providerOrder.indexOf(b)
  )

  const markers: { region: string; provider: string; coords: [number, number]; azs?: string[] }[] = []
  for (const m of uniqueMarkers) {
    // Look up coordinates using the base region (strip zone suffix)
    // For SINA Cloud, strip numeric zone suffix; for others, strip letter zone suffix
    const baseRegion = m.provider === 'sinacloud'
      ? getSinacloudBaseRegion(m.region)
      : stripZoneSuffix(m.region)
    const coords = REGION_COORDS[baseRegion]
    if (coords) markers.push({ region: m.region, provider: m.provider, coords })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem 1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('pages.regions.totalRegions')}</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--waf-brand)' }}>{uniqueRegions.length}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
            {t('pages.regions.totalAZs', { count: String(Object.values(azsByRegion).flat().length) })}
          </div>
        </div>
        {sortedProviders.map(provider => {
          const groupData = grouped[provider]
          // For SINA Cloud, use the pre-computed grouped data with deduped regions and all AZs
          let dedupedRegionCount = 0
          let azs: string[] = []
          if (provider === 'sinacloud' && groupData) {
            dedupedRegionCount = groupData.entries.length  // 3 datacenters
            azs = groupData.azs  // All 3 AZs (zone numbers "1", "2", "3")
          } else {
            // Deduplicate entries by base region name (strip zone suffix) for other providers
            const seenRegions = new Set<string>()
            for (const entry of groupData?.entries ?? []) {
              if (entry.normalized) {
                const baseRegion = stripZoneSuffix(entry.normalized)
                seenRegions.add(baseRegion)
              }
            }
            dedupedRegionCount = seenRegions.size
            // Use pre-computed AZs from azsByRegion which extracts zones from region names
            azs = azsByRegion[groupData?.base ?? ''] || []
            // For providers where zones are embedded in region names (like europe-west1-a),
            // show the full region name as the AZ display instead of just the zone letter
            if (azs.length === 0) {
              azs = Array.from(new Set(
                (groupData?.entries ?? [])
                  .map((e: any) => e.normalized)
              ))
            }
          }
          return (
            <div
              key={provider}
              onMouseEnter={() => setHoveredProvider(provider)}
              onMouseLeave={() => setHoveredProvider(null)}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem 1.5rem', background: 'var(--surface)', borderRadius: '16px', border: `1px solid ${hoveredProvider === provider ? PROVIDER_COLORS[provider] : 'var(--border)'}`, borderLeft: `3px solid ${PROVIDER_COLORS[provider] ?? '#94a3b8'}`, cursor: 'pointer', transition: 'border-color 0.2s' }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {PROVIDER_LABEL[provider] ?? provider.toUpperCase()}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: hoveredProvider === provider ? PROVIDER_COLORS[provider] : (PROVIDER_COLORS[provider] ?? '#94a3b8') }}>
                {dedupedRegionCount}/{azs.length}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                regions / AZs
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
                <span
                  key={p}
                  onMouseEnter={() => setHoveredProvider(p)}
                  onMouseLeave={() => setHoveredProvider(null)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: hoveredProvider === p ? 'var(--text)' : 'var(--muted)', cursor: 'pointer', transition: 'color 0.2s' }}
                >
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
              // Use base region for label lookup
              // For SINA Cloud, strip numeric zone suffix; for others, strip letter zone suffix
              const baseRegion = m.provider === 'sinacloud'
                ? getSinacloudBaseRegion(m.region)
                : stripZoneSuffix(m.region)
              // For display, show just the zone (not the full region name)
              // For providers with embedded zones (like SINA Cloud "de-ham-sinacloud-1"),
              // extract just the zone number/letter ("1")
              // For others (like GCP "europe-west1-a"), use the first az from azs array
              // If no azs available, show "N/A"
              const azDisplay = m.azs && m.azs.length > 0
                ? (m.provider === 'sinacloud'
                    ? m.azs[0].replace(/^(de-[a-z]{2,3})-sinacloud-/, '') // Just the number: "1", "2", "3"
                    : m.azs[0]) // For others, use the zone from azs array
                : 'N/A'
              const isHovered = hoveredProvider === m.provider
              const providerColor = PROVIDER_COLORS[m.provider] ?? '#94a3b8'
              return (
                <CircleMarker
                  key={i}
                  center={m.coords}
                  radius={8}
                  pathOptions={{
                    color: isHovered ? '#ffffff' : providerColor,
                    fillColor: providerColor,
                    fillOpacity: 0.75,
                    weight: isHovered ? 5 : 2,
                  }}
                >
                  <Tooltip>
                    <div style={{ fontSize: '0.8rem' }}>
                      <strong>{m.region}</strong><br />
                      {REGION_LABELS[baseRegion] ?? ''}<br />
                      <span style={{ color: providerColor }}>{PROVIDER_LABEL[m.provider] ?? m.provider}</span>
                      <div style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>
                        Availability Zone: {azDisplay}
                      </div>
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
        const groupData = grouped[provider]
        // For SINA Cloud, show 3 datacenter entries (de-ham-sinacloud, de-du-sinacloud, de-fra-sinacloud)
        // Each with all 3 of its AZs. For other providers, show each unique region.
        const uniqueEntries: Array<{ normalized: string; provider: string; az: string | null; isSinacloudBase?: boolean }> = []
        const seenRegions = new Set<string>()
        if (groupData) {
          for (const entry of groupData.entries) {
            if (entry.normalized && !seenRegions.has(entry.normalized)) {
              seenRegions.add(entry.normalized)
              // For SINA Cloud, entries have az: null since we're storing base regions
              // For other providers, keep the original az
              uniqueEntries.push({
                ...entry,
                isSinacloudBase: provider === 'sinacloud',
                // For SINA Cloud base entries, we'll use groupData.azs instead of entry.az
                az: provider === 'sinacloud' ? null : entry.az
              })
            }
          }
        }
        return (
          <div
            key={provider}
            onMouseEnter={() => setHoveredProvider(provider)}
            onMouseLeave={() => setHoveredProvider(null)}
            style={{ padding: '1.25rem 1.5rem', background: 'var(--surface)', borderRadius: '16px', border: `1px solid ${hoveredProvider === provider ? color : 'var(--border)'}`, cursor: 'pointer', transition: 'border-color 0.2s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0, boxShadow: hoveredProvider === provider ? `0 0 10px ${color}aa` : `0 0 6px ${color}88` }} />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: hoveredProvider === provider ? color : 'var(--text)', margin: 0 }}>{label}</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                {t('pages.regions.regionsCount', { count: String(uniqueEntries.length) })}
              </span>
              {provider === 'sinacloud' && groupData && groupData.azs.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  ({groupData.azs.length} AZs)
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {uniqueEntries.map((entry, i) => {
                const regionName = entry.normalized
                if (!regionName || typeof regionName !== 'string') return null
                // Use base region for label lookup (strip zone suffix)
                const baseRegion = stripZoneSuffix(regionName)
                // For SINA Cloud, show all 3 AZs for each datacenter
                // For other providers, show the region as the AZ indicator
                const azsToShow = provider === 'sinacloud' && groupData ? groupData.azs : [regionName]
                return (
                  <div key={i} style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem', padding: '0.35rem 0.75rem', borderRadius: '8px', background: 'var(--bg)', border: `1px solid ${hoveredProvider === provider ? color : `${color}33`}`, fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                      {regionName}
                      {(() => {
                        // For SINA Cloud, use base region (without zone) for label lookup
                        // For other providers, use the base region from stripZoneSuffix
                        const lookupRegion = provider === 'sinacloud' ? getSinacloudBaseRegion(regionName) : baseRegion
                        const label = REGION_LABELS[lookupRegion]
                        return label && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                            · {label}
                          </span>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {azsToShow.map((az, azIdx) => (
                        <span key={azIdx} style={{ fontSize: '0.65rem', color: 'var(--muted)', opacity: 0.8 }}>
                          {az}
                        </span>
                      ))}
                    </div>
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
