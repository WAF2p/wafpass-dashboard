import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchRun, fetchRuns, type RunDetail, type RunSummary } from './api'
import { emitScanReceived, recordFirstSeenFailures } from './audit'
import { qk } from './lib/queryKeys'

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

async function fetchAllRuns(): Promise<RunSummary[]> {
  let cursor: string | null = null
  let total = 0
  const all: RunSummary[] = []
  do {
    const { items, nextCursor } = await fetchRuns({ limit: PAGE_SIZE, cursor: cursor ?? undefined })
    all.push(...items)
    total += items.length
    cursor = nextCursor
  } while (cursor !== null && total < MAX_RUNS)
  return all
}

/**
 * Run list + selected run detail, backed by TanStack Query.
 *
 * The public shape is unchanged so existing pages and AppShell do not care
 * where the data comes from. Query owns deduplication, caching, and retry.
 */
export function useRunLoader(initialRunId: string | null): RunLoaderResult {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(initialRunId)

  const runsQuery = useQuery({
    queryKey: qk.runs.all,
    queryFn: fetchAllRuns,
    staleTime: 15_000,
  })
  const runs = runsQuery.data ?? []

  // Auto-select the most recent run when there is no deep link.
  useEffect(() => {
    if (!selectedId && runs.length > 0) setSelectedId(runs[0].id)
  }, [runs, selectedId])

  const runQuery = useQuery({
    queryKey: qk.runs.detail(selectedId ?? 'none'),
    queryFn: () => fetchRun(selectedId as string),
    enabled: !!selectedId,
    staleTime: 30_000,
  })
  const run = selectedId ? (runQuery.data ?? null) : null

  useEffect(() => {
    if (!run) return
    emitScanReceived(run)
    recordFirstSeenFailures(run.findings, run)
  }, [run])

  const refetchRuns = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.runs.all })
  }

  return {
    runs,
    selectedId,
    setSelectedId,
    run,
    loadingRun: !!selectedId && runQuery.isLoading,
    runsError: runsQuery.error
      ? runsQuery.error instanceof Error
        ? runsQuery.error.message
        : String(runsQuery.error)
      : null,
    refetchRuns,
  }
}
