import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// ── Static controls used by the mock ─────────────────────────────────────────

const MOCK_STATIC = [
  {
    id: 'ctrl1',
    pillar: 'static-pillar',
    severity: 'LOW',
    category: 'storage',
    title: 'Static Title',
    description: 'static description',
    rationale: 'why it matters',
    threat: ['data-loss'],
    checks_count: 3,
    automated_checks: [{ id: 'chk1', title: 'Check One', severity: 'HIGH', remediation: 'fix it' }],
    regulatory_mapping: [{ framework: 'SOC2', controls: ['CC6.1'] }],
  },
  {
    id: 'ctrl2',
    pillar: 'network',
    severity: 'MEDIUM',
    category: 'network',
    title: 'Local-only Control',
    description: 'only in static file',
    rationale: 'rationale',
    threat: [],
    checks_count: 1,
    automated_checks: [],
    regulatory_mapping: [],
  },
]

vi.mock('../controls-data', () => ({
  CONTROLS: MOCK_STATIC,
}))

const mockFetchCatalogue = vi.fn()

vi.mock('../api', () => ({
  fetchCatalogueControls: (...args: unknown[]) => mockFetchCatalogue(...args),
  pushAuditEvent: vi.fn().mockResolvedValue(undefined),
  getAccessToken: vi.fn().mockReturnValue(null),
}))

const CACHE_KEY = 'wafpass_controls_cache'

// Import after mocks are established
const { useControlsCatalogue } = await import('../useControlsCatalogue')

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshServer(overrides = {}) {
  return {
    id: 'ctrl1',
    pillar: 'encryption',          // should win over static 'static-pillar'
    severity: 'CRITICAL',          // should win over static 'LOW'
    type: ['kms'],
    description: 'server description',
    checks: [{ id: 'chk1', engine: 'wafpass', description: 'd', expected: 'true' }],
    source: 'wafpass',
    created_at: '',
    updated_at: '',
    regulatory_mapping: [],
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useControlsCatalogue', () => {
  beforeEach(() => {
    localStorage.clear()
    mockFetchCatalogue.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns static CONTROLS immediately before server responds', () => {
    mockFetchCatalogue.mockResolvedValue({ controls: [], total: 0, page: 1, per_page: 0 })
    const { result } = renderHook(() => useControlsCatalogue())
    // Synchronous initial state must equal the static list
    expect(result.current).toEqual(MOCK_STATIC)
  })

  it('server fields (pillar, severity, description) win over static after fetch', async () => {
    mockFetchCatalogue.mockResolvedValue({ controls: [freshServer()], total: 1, page: 1, per_page: 1 })
    const { result } = renderHook(() => useControlsCatalogue())

    await waitFor(() => expect(result.current[0].pillar).toBe('encryption'))

    const ctrl = result.current.find(c => c.id === 'ctrl1')!
    expect(ctrl.pillar).toBe('encryption')
    expect(ctrl.severity).toBe('CRITICAL')
    expect(ctrl.description).toBe('server description')
  })

  it('static-only fields (title, rationale, regulatory_mapping) are preserved from static file', async () => {
    mockFetchCatalogue.mockResolvedValue({ controls: [freshServer()], total: 1, page: 1, per_page: 1 })
    const { result } = renderHook(() => useControlsCatalogue())

    await waitFor(() => expect(result.current[0].title).toBe('Static Title'))

    const ctrl = result.current.find(c => c.id === 'ctrl1')!
    expect(ctrl.title).toBe('Static Title')
    expect(ctrl.rationale).toBe('why it matters')
    expect(ctrl.regulatory_mapping).toEqual([{ framework: 'SOC2', controls: ['CC6.1'] }])
    expect(ctrl.automated_checks).toHaveLength(1)
  })

  it('controls present only in static list are kept as offline fallback', async () => {
    mockFetchCatalogue.mockResolvedValue({ controls: [freshServer()], total: 1, page: 1, per_page: 1 })
    const { result } = renderHook(() => useControlsCatalogue())

    await waitFor(() => expect(result.current.length).toBe(2))

    const ctrl2 = result.current.find(c => c.id === 'ctrl2')
    expect(ctrl2).toBeDefined()
    expect(ctrl2!.title).toBe('Local-only Control')
  })

  it('uses static CONTROLS as fallback when server fetch fails', async () => {
    mockFetchCatalogue.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useControlsCatalogue())

    // After rejection the state should remain equal to the static list
    await waitFor(() => expect(mockFetchCatalogue).toHaveBeenCalled())
    expect(result.current).toEqual(MOCK_STATIC)
  })

  it('serves cached data immediately when cache is fresh', async () => {
    const cachedControls = [{ ...MOCK_STATIC[0], pillar: 'cached-pillar' }]
    const cacheEntry = { ts: Date.now(), data: cachedControls }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry))

    const { result } = renderHook(() => useControlsCatalogue())

    expect(result.current[0].pillar).toBe('cached-pillar')
    // Fetch should NOT be called because cache is fresh
    expect(mockFetchCatalogue).not.toHaveBeenCalled()
  })

  it('fetches and updates cache when cache is expired', async () => {
    const staleEntry = { ts: Date.now() - 2 * 60 * 60 * 1000, data: MOCK_STATIC }
    localStorage.setItem(CACHE_KEY, JSON.stringify(staleEntry))

    mockFetchCatalogue.mockResolvedValue({ controls: [freshServer()], total: 1, page: 1, per_page: 1 })
    const { result } = renderHook(() => useControlsCatalogue())

    await waitFor(() => expect(mockFetchCatalogue).toHaveBeenCalled())
    await waitFor(() => expect(result.current.find(c => c.id === 'ctrl1')?.pillar).toBe('encryption'))

    // Cache should be refreshed
    const newCache = JSON.parse(localStorage.getItem(CACHE_KEY)!)
    expect(newCache.data.find((c: { id: string }) => c.id === 'ctrl1').pillar).toBe('encryption')
  })

  it('uses server description only when non-empty, falls back to static', async () => {
    mockFetchCatalogue.mockResolvedValue({
      controls: [freshServer({ description: '' })],  // empty server description
      total: 1, page: 1, per_page: 1,
    })
    const { result } = renderHook(() => useControlsCatalogue())

    await waitFor(() => expect(mockFetchCatalogue).toHaveBeenCalled())
    const ctrl = result.current.find(c => c.id === 'ctrl1')!
    expect(ctrl.description).toBe('static description')
  })
})
