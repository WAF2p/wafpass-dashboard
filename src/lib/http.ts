/**
 * The single HTTP client for the dashboard.
 *
 * - HttpOnly cookie sessions; every request sends credentials.
 * - Double-submit CSRF token on unsafe methods.
 * - Request ID on every call and a normalized ApiError for callers that use
 *   apiFetch().
 * - Timeout, single-flight 401 refresh, and bounded retry for idempotent
 *   requests.
 *
 * authFetch() returns the raw Response and is the compatibility layer used by
 * the existing domain functions. apiFetch<T>() is the typed path for new code.
 */
import { getApiBase } from './config'
import { ApiError } from './errors'

const DEFAULT_TIMEOUT_MS = 30_000
const RETRY_STATUSES = new Set([429, 502, 503, 504])
const AUTH_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
])

export interface FetchOptions extends RequestInit {
  timeoutMs?: number
  retry?: boolean
}

function readCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isAuthPath(url: string): boolean {
  try {
    return AUTH_PATHS.has(new URL(url, window.location.origin).pathname)
  } catch {
    return false
  }
}

function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const anySignal = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any
  if (typeof anySignal === 'function') return anySignal([a, b])
  const controller = new AbortController()
  const abort = () => controller.abort()
  a.addEventListener('abort', abort, { once: true })
  b.addEventListener('abort', abort, { once: true })
  return controller.signal
}

function retryAfterMs(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  if (Number.isNaN(date)) return null
  return Math.max(0, date - Date.now())
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

let refreshPromise: Promise<void> | null = null

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await globalThis.fetch(`${getApiBase()}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (!response.ok) throw new ApiError(response.status, 'Session refresh failed')
    })().finally(() => {
      refreshPromise = null
    })
  }
  try {
    await refreshPromise
    return true
  } catch {
    return false
  }
}

function extractDetail(body: unknown): string {
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map(item => {
          if (item && typeof item === 'object' && 'msg' in item) {
            return String((item as { msg: unknown }).msg)
          }
          return String(item)
        })
        .join('; ')
    }
  }
  return 'Request failed'
}

/** Compatibility fetch wrapper: returns the raw Response. */
export async function authFetch(input: RequestInfo | URL, init: FetchOptions = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = readCookie('wombat_csrf')
    if (csrf) headers.set('X-CSRF-Token', csrf)
  }
  headers.set('X-Request-ID', newRequestId())

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const signal = init.signal ? combineSignals(init.signal, controller.signal) : controller.signal
  const requestInit: RequestInit = { credentials: 'include', ...init, headers, signal }
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

  try {
    let response = await globalThis.fetch(input, requestInit)

    if (response.status === 401 && !isAuthPath(url)) {
      const refreshed = await refreshSession()
      if (refreshed) response = await globalThis.fetch(input, requestInit)
    }

    if ((method === 'GET' || method === 'HEAD') && init.retry !== false) {
      let attempt = 0
      while (attempt < 2 && RETRY_STATUSES.has(response.status)) {
        const wait = retryAfterMs(response.headers.get('retry-after'))
          ?? 250 * 2 ** attempt + Math.random() * 100
        await sleep(wait)
        response = await globalThis.fetch(input, requestInit)
        attempt += 1
      }
    }

    return response
  } finally {
    clearTimeout(timer)
  }
}

/** Typed request: throws ApiError with status, detail, and request ID. */
export async function apiFetch<T>(path: string, init: FetchOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${getApiBase()}${path}`
  const response = await authFetch(url, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(
      response.status,
      extractDetail(body),
      response.headers.get('x-request-id') ?? undefined,
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function apiGet<T>(path: string, init: FetchOptions = {}): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'GET' })
}

export function apiPost<T>(path: string, body: unknown, init: FetchOptions = {}): Promise<T> {
  return apiFetch<T>(path, {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    body: JSON.stringify(body),
  })
}

/**
 * Public/external request helper. Does not send cookies, CSRF, or a request ID:
 * use it for health checks and third-party endpoints, never for the wombat API.
 */
export async function externalFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return globalThis.fetch(input, init)
}

/**
 * Fire-and-forget telemetry POST. Deliberately does not send cookies or CSRF:
 * the collector is a separate origin, not the wombat API.
 */
export async function sendTelemetry(url: string, body: string): Promise<void> {
  await globalThis.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  })
}
