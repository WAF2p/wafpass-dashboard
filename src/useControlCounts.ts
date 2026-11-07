/**
 * Live control counts for the deployment.
 *
 * The catalogue endpoint is authoritative: the Settings screen and the journey
 * page must show the pack the server actually loaded, not a hardcoded snapshot.
 * The static PILLAR_COUNTS / TOTAL_CONTROLS / SEV_COUNTS stay as an offline
 * fallback when the server is unreachable.
 *
 * The promise is deduplicated per session and the result is cached in module
 * state, so mounting several pages does not refetch the catalogue.
 */

import { useEffect, useState } from 'react'
import { fetchCatalogueControls } from './api'
import { deriveControlCounts, type ControlCounts } from './pages/settingsUtils'

let cached: ControlCounts | null = null
let inflight: Promise<ControlCounts> | null = null

function load(): Promise<ControlCounts> {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = fetchCatalogueControls({ per_page: 200 })
      .then(({ controls, total }) => {
        const counts = deriveControlCounts(controls)
        // meta.total is authoritative if the page returned fewer rows.
        counts.total = Math.max(counts.total, total)
        cached = counts
        return counts
      })
      .finally(() => { inflight = null })
  }
  return inflight
}

/**
 * Returns live counts once the server responds, or `null` while loading and on
 * error (callers fall back to the static tables).
 */
/** Drop the session cache after a control-pack import so the next mount refetches. */
export function invalidateControlCounts(): void {
  cached = null
  inflight = null
}

export function useControlCounts(): ControlCounts | null {
  const [counts, setCounts] = useState<ControlCounts | null>(cached)

  useEffect(() => {
    if (counts) return
    let alive = true
    load()
      .then(next => { if (alive) setCounts(next) })
      .catch(() => { /* offline — caller uses the static fallback */ })
    return () => { alive = false }
  }, [counts])

  return counts
}
