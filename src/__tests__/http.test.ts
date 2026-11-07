import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, authFetch } from '../lib/http'
import { ApiError } from '../lib/errors'

const realFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('http client', () => {
  beforeEach(() => {
    document.cookie = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    globalThis.fetch = realFetch
  })

  it('sends credentials, CSRF, and a request ID on unsafe requests', async () => {
    document.cookie = 'wombat_csrf=csrf-token'
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await authFetch('/api/v1/test', { method: 'POST', body: '{}' })

    expect(response.status).toBe(200)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.credentials).toBe('include')
    const headers = new Headers(init.headers)
    expect(headers.get('X-CSRF-Token')).toBe('csrf-token')
    expect(headers.get('X-Request-ID')).toBeTruthy()
  })

  it('does not send CSRF on GET', async () => {
    document.cookie = 'wombat_csrf=csrf-token'
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await authFetch('/api/v1/test')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBeNull()
  })

  it('refreshes once and retries after a 401', async () => {
    let privateCalls = 0
    let refreshCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1
        return new Response(null, { status: 200 })
      }
      privateCalls += 1
      return privateCalls <= 2
        ? new Response(null, { status: 401 })
        : new Response(null, { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const [a, b] = await Promise.all([
      authFetch('/api/v1/private'),
      authFetch('/api/v1/private'),
    ])

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(refreshCalls).toBe(1)
    expect(privateCalls).toBe(4)
  })

  it('does not refresh on the auth endpoints themselves', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await authFetch('/api/v1/auth/login', { method: 'POST', body: '{}' })

    expect(response.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries idempotent requests on 503', async () => {
    vi.useFakeTimers()
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls += 1
      return calls === 1
        ? new Response(null, { status: 503 })
        : new Response(null, { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const pending = authFetch('/api/v1/health')
    await vi.advanceTimersByTimeAsync(1000)
    const response = await pending

    expect(response.status).toBe(200)
    expect(calls).toBe(2)
  })

  it('aborts a request that exceeds its timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      }),
    ))

    const pending = authFetch('/api/v1/slow', { timeoutMs: 10 })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(20)
    await assertion
  })

  it('normalizes failures into ApiError with detail and request ID', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(
      { detail: 'bad thing' },
      400,
      { 'X-Request-ID': 'rid-1' },
    )))

    await expect(apiFetch('/api/v1/test')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      detail: 'bad thing',
      requestId: 'rid-1',
    })
  })

  it('turns FastAPI validation arrays into a readable message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(
      { detail: [{ msg: 'field required' }, { msg: 'invalid value' }] },
      422,
    )))

    await expect(apiFetch('/api/v1/test')).rejects.toThrow('field required; invalid value')
  })

  it('returns parsed JSON and handles 204', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: true })))
    await expect(apiFetch<{ ok: boolean }>('/api/v1/test')).resolves.toEqual({ ok: true })

    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    await expect(apiFetch('/api/v1/test')).resolves.toBeUndefined()
  })

  it('exposes ApiError as an Error subclass', () => {
    const error = new ApiError(403, 'forbidden', 'rid')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
  })
})
