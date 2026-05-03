import { useEffect, useRef, useState } from 'react'
import { fetchRun, fetchRuns, RunDetail, RunSummary } from './api'
import { emitScanReceived, recordFirstSeenFailures } from './audit'

// Fetch up to this many runs total; each page is PAGE_SIZE rows.
// Keyset pagination means each page is O(1) regardless of depth.
const PAGE_SIZE = 200
const MAX_RUNS = 1000

export interface RunLoaderResult {
  runs: RunSummary[]
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  run: RunDetail | null
  loadingRun: boolean
  runsError: string | null
  refetchRuns: () => Promise<void>
}

export function useRunLoader(initialRunId: string | null): RunLoaderResult {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [run, setRun] = useState<RunDetail | null>(null)
  const [loadingRun, setLoadingRun] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [runsVersion, setRunsVersion] = useState(0)  // Increment to trigger reload

  const savedInitialId = useRef(initialRunId)

  useEffect(() => {
    let cancelled = false

    // If we have a deep-linked run ID, select it immediately so the detail
    // load starts in parallel with the runs-list fetch.
    if (savedInitialId.current) {
      setSelectedId(savedInitialId.current)
    }

    async function loadPages() {
      let cursor: string | null = null
      let total = 0
      let autoSelected = !!savedInitialId.current

      do {
        const { items, nextCursor } = await fetchRuns({ limit: PAGE_SIZE, cursor: cursor ?? undefined })
        if (cancelled) return

        setRuns(prev => [...prev, ...items])
        total += items.length
        cursor = nextCursor

        // Auto-select the most recent run when there is no deep link
        if (!autoSelected && items.length > 0) {
          autoSelected = true
          setSelectedId(items[0].id)
        }
      } while (cursor !== null && total < MAX_RUNS)
    }

    loadPages().catch((e: unknown) => {
      if (!cancelled) setRunsError((e as Error).message)
    })

    return () => { cancelled = true }
  }, [runsVersion])

  const refetchRuns = async () => {
    setRuns([])  // Clear current runs first
    setRunsVersion(v => v + 1)  // Trigger reload effect to re-fetch runs
  }

  useEffect(() => {
    if (!selectedId) return
    setLoadingRun(true)
    setRun(null)
    fetchRun(selectedId)
      .then(r => {
        setRun(r)
        emitScanReceived(r)
        recordFirstSeenFailures(r.findings, r)
      })
      .catch(() => setRun(null))
      .finally(() => setLoadingRun(false))
  }, [selectedId])

  return { runs, selectedId, setSelectedId, run, loadingRun, runsError, refetchRuns }
}
