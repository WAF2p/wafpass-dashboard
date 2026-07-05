/**
 * Hook that returns the full control catalogue, preferring server data over the
 * static fallback in controls-data.ts.
 *
 * Strategy:
 *  1. Serve the localStorage cache immediately (no render flash).
 *  2. In a background effect, fetch /controls from the server.
 *  3. Merge: server fields (pillar, severity, description) win for basic metadata;
 *     static file fills in UI-only fields (title, rationale, threat, regulatory_mapping,
 *     automated_checks) that the catalogue endpoint does not store.
 *  4. Write the merged result back to the cache (1-hour TTL).
 *
 * Result: controls-data.ts no longer needs updating whenever basic control metadata
 * changes — only the rich UI annotations (regulatory_mapping, remediation examples, etc.)
 * still need manual maintenance there.
 */

import { useEffect, useState } from 'react'
import { type CatalogueControl, fetchCatalogueControls } from './api'
import { CONTROLS, type Control } from './controls-data'

const CACHE_KEY = 'wafpass_controls_cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// ── Cache helpers ─────────────────────────────────────────────────────────────

interface CacheEntry {
  ts: number
  data: Control[]
}

function readCache(): Control[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null
    return entry.data
  } catch {
    return null
  }
}

function writeCache(controls: Control[]): void {
  try {
    const entry: CacheEntry = { ts: Date.now(), data: controls }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {}
}

// ── Server → Control merge ────────────────────────────────────────────────────

/**
 * Merge server catalogue controls with the static rich-metadata from controls-data.ts.
 * Server fields (id, pillar, severity, description, regulatory_mapping) are authoritative.
 * Static fields (title, category, rationale, threat, automated_checks) fill gaps the server does not store.
 */
function mergeWithServer(serverControls: CatalogueControl[]): Control[] {
  const staticById = new Map(CONTROLS.map(c => [c.id, c]))
  const merged: Control[] = []

  for (const sc of serverControls) {
    const s = staticById.get(sc.id)
    merged.push({
      id: sc.id,
      pillar: sc.pillar,
      severity: sc.severity,
      category: s?.category ?? (sc.type?.[0] ?? 'general'),
      title: s?.title ?? sc.id,
      description: sc.description ? sc.description : (s?.description ?? ''),
      rationale: s?.rationale,
      threat: s?.threat,
      checks_count: s?.checks_count ?? sc.checks?.length ?? 0,
      automated_checks: s?.automated_checks ?? [],
      regulatory_mapping: sc.regulatory_mapping.length > 0 ? sc.regulatory_mapping : (s?.regulatory_mapping ?? []),
    })
    staticById.delete(sc.id)
  }

  // Controls in static list but absent from server (offline fallback, custom controls)
  for (const c of staticById.values()) {
    merged.push(c)
  }

  return merged
}

// ── Module-level deduplication: only one in-flight fetch per session ──────────

let _inflight: Promise<Control[]> | null = null

function ensureFetched(): Promise<Control[]> {
  if (_inflight) return _inflight
  _inflight = fetchCatalogueControls({ per_page: 200 })
    .then(({ controls: sc }) => {
      const result = mergeWithServer(sc)
      writeCache(result)
      return result
    })
    .catch(() => CONTROLS)
    .finally(() => { _inflight = null })
  return _inflight
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the merged control catalogue. On first render within a session the
 * cached value (or static fallback) is returned synchronously; the server fetch
 * updates the state in the background and writes a fresh cache entry.
 */
export function useControlsCatalogue(): Control[] {
  const [controls, setControls] = useState<Control[]>(
    () => readCache() ?? CONTROLS,
  )

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      // Cache is fresh — use it immediately, skip network call
      setControls(cached)
      return
    }
    ensureFetched().then(setControls)
  }, [])

  return controls
}
