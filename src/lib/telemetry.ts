import { sendTelemetry } from './http'

/**
 * Lightweight error reporting.
 *
 * Set VITE_TELEMETRY_URL to a collector endpoint to receive reports. Without
 * it, errors are logged to the console only. Never send tokens or user data.
 */
const TELEMETRY_URL = (import.meta.env.VITE_TELEMETRY_URL as string | undefined) ?? ''

export interface ErrorContext {
  route?: string
  componentStack?: string
  type?: string
  [key: string]: unknown
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
  const payload = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    route: typeof window !== 'undefined' ? window.location.hash : undefined,
    release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev',
    ts: new Date().toISOString(),
    ...context,
  }

  if (TELEMETRY_URL) {
    try {
      const body = JSON.stringify(payload)
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        navigator.sendBeacon(TELEMETRY_URL, body)
      } else {
        void sendTelemetry(TELEMETRY_URL, body).catch(() => {})
      }
    } catch {
      /* telemetry must never break the app */
    }
  }

  // Keep a local breadcrumb; no secrets are included.
  console.error('[wombat]', error, payload)
}

let installed = false

export function initTelemetry(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', event => {
    reportError(event.error ?? event.message, { type: 'window.error' })
  })
  window.addEventListener('unhandledrejection', event => {
    reportError(event.reason, { type: 'unhandledrejection' })
  })
}
