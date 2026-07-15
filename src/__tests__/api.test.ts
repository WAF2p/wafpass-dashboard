import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchServerAuditEvents,
  getApiBase,
  pushAuditEvent,
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
