import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteMandantSsoConfig,
  fetchComplianceReadiness,
  fetchMandantSsoConfigs,
  fetchServerAuditEvents,
  fetchSsoProviders,
  getApiBase,
  getSsoAuthorizeUrl,
  pushAuditEvent,
  upsertMandantSsoConfig,
} from '../api'

const SERVER_URL_KEY = 'wafpass_server_url'
const ACCESS_TOKEN_KEY = 'wafpass_access_token'

// ── getApiBase ────────────────────────────────────────────────────────────────

describe('getApiBase', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty string by default (no env, no localStorage)', () => {
    expect(getApiBase()).toBe('')
  })

  it('returns trimmed stored URL without trailing slash', () => {
    localStorage.setItem(SERVER_URL_KEY, '  http://myserver:8000/  ')
    expect(getApiBase()).toBe('http://myserver:8000')
  })

  it('ignores whitespace-only stored value', () => {
    localStorage.setItem(SERVER_URL_KEY, '   ')
    expect(getApiBase()).toBe('')
  })
})

// ── pushAuditEvent ────────────────────────────────────────────────────────────

describe('pushAuditEvent', () => {
  const eventPayload = {
    client_id: 'cid-1',
    actor: 'alice',
    category: 'waiver',
    action: 'waiver_created',
    subject_id: 'ctrl1',
    subject_type: 'waiver',
    summary: 'Waiver created',
    timestamp: '2024-06-01T12:00:00Z',
  }

  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('does nothing and never throws when no access token is stored', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(pushAuditEvent(eventPayload)).resolves.toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('POSTs to /audit/events when a token is present', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'tok123')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }))

    await pushAuditEvent(eventPayload)

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/audit/events')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ client_id: 'cid-1', actor: 'alice' })
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok123')
  })

  it('never throws even when fetch rejects (fire-and-forget)', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'tok')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
    await expect(pushAuditEvent(eventPayload)).resolves.toBeUndefined()
  })

  it('never throws when server returns a non-2xx status', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'tok')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    await expect(pushAuditEvent(eventPayload)).resolves.toBeUndefined()
  })
})

// ── fetchServerAuditEvents ────────────────────────────────────────────────────

describe('fetchServerAuditEvents', () => {
  const serverEvents = [
    { id: 's1', client_id: 'c1', actor: 'alice', category: 'waiver', action: 'waiver_created', subject_id: 'ctrl1', subject_type: 'waiver', summary: 'ok', before: null, after: null, timestamp: '2024-06-01T10:00:00Z', created_by: null },
  ]

  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('returns parsed events on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: serverEvents }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )
    const result = await fetchServerAuditEvents()
    expect(result).toEqual(serverEvents)
  })

  it('returns empty array on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Forbidden', { status: 403 }))
    await expect(fetchServerAuditEvents()).resolves.toEqual([])
  })

  it('passes limit query param', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    )
    await fetchServerAuditEvents({ limit: 100 })
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('limit=100')
  })

  it('passes category query param when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    )
    await fetchServerAuditEvents({ category: 'scan' })
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('category=scan')
  })

  it('omits category param when not provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    )
    await fetchServerAuditEvents({ limit: 50 })
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).not.toContain('category')
  })

  it('sends stored access token as Authorization header', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'mytoken')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    )
    await fetchServerAuditEvents()
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer mytoken')
  })
})

// ── Per-mandant SSO config (ADR-005) ─────────────────────────────────────────

describe('fetchSsoProviders / getSsoAuthorizeUrl — mandant scoping', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

  it('omits ?mandant= when no mandate is given', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    )
    await fetchSsoProviders()
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).not.toContain('mandant')
  })

  it('sends the slug as ?mandant=<slug>', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    )
    await fetchSsoProviders('acme')
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('/api/v1/sso/providers?mandant=acme')
  })

  it('getSsoAuthorizeUrl appends ?mandant= for oidc and saml2 alike', () => {
    expect(getSsoAuthorizeUrl('oidc')).toBe('/api/v1/auth/oidc/authorize')
    expect(getSsoAuthorizeUrl('oidc', 'acme')).toBe('/api/v1/auth/oidc/authorize?mandant=acme')
    expect(getSsoAuthorizeUrl('saml2', 'acme')).toBe('/api/v1/auth/saml/login?mandant=acme')
  })
})

describe('per-mandant SSO config CRUD', () => {
  afterEach(() => vi.restoreAllMocks())

  it('fetchMandantSsoConfigs hits the mandate-scoped endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    )
    await fetchMandantSsoConfigs('m1')
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('/api/v1/sso/config/mandant/m1')
  })

  it('upsertMandantSsoConfig PUTs to the mandate+provider endpoint with the config body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'oidc:m1', provider: 'oidc', mandant_id: 'm1', enabled: true, config: {}, updated_at: null }), { status: 200 })
    )
    await upsertMandantSsoConfig('m1', 'oidc', true, { client_id: 'acme-client' })
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/v1/sso/config/mandant/m1/oidc')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ enabled: true, config: { client_id: 'acme-client' } })
  })

  it('deleteMandantSsoConfig DELETEs the mandate+provider endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    await deleteMandantSsoConfig('m1', 'saml2')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/v1/sso/config/mandant/m1/saml2')
    expect(init.method).toBe('DELETE')
  })
})

// ── Compliance readiness ──────────────────────────────────────────────────────

describe('fetchComplianceReadiness', () => {
  const mockData = {
    totalFrameworkCoverage: 80,
    frameworkCount: 3,
    evidenceCompleteness: 40,
    findingsWithoutRemediation: 2,
    readinessScore: 42,
    frameworks: [],
    controlsWithoutRemediation: [],
  }

  afterEach(() => vi.restoreAllMocks())

  it('fetches the run-scoped endpoint and returns data', async () => {
    localStorage.setItem('wafpass_server_url', 'http://server:8000')
    localStorage.setItem('wafpass_access_token', 'tok')

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: mockData }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )

    const result = await fetchComplianceReadiness('run-123')
    expect(result).toEqual(mockData)
  })

  it('uses the configured API base and sends auth headers', async () => {
    localStorage.setItem('wafpass_server_url', 'http://server:8000')
    localStorage.setItem('wafpass_access_token', 'tok')

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: mockData }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )

    await fetchComplianceReadiness('run-123')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://server:8000/api/v1/runs/run-123/compliance-readiness')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok')
  })

  it('throws on non-ok response', async () => {
    localStorage.setItem('wafpass_server_url', 'http://server:8000')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not found', { status: 404 }))
    await expect(fetchComplianceReadiness('run-123')).rejects.toThrow('Failed to fetch compliance readiness')
  })
})
