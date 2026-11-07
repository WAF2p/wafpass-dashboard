/** Runtime API configuration. Kept separate from the API modules so the HTTP
 *  client can resolve a base URL without importing domain code. */

const ENV_API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const ENV_VALIDATION_BASE = (import.meta.env.VITE_VALIDATION_URL as string | undefined) ?? ''

export const SERVER_URL_KEY = 'wombat_server_url'
export const VALIDATION_URL_KEY = 'wombat_validation_url'

export function getApiBase(): string {
  try {
    const stored = localStorage.getItem(SERVER_URL_KEY)
    if (stored?.trim()) return stored.trim().replace(/\/$/, '')
  } catch {
    /* private window / blocked storage */
  }
  return ENV_API_BASE
}

export function getValidationGatewayBase(): string {
  try {
    const stored = localStorage.getItem(VALIDATION_URL_KEY)
    if (stored?.trim()) return stored.trim().replace(/\/$/, '')
  } catch {
    /* private window / blocked storage */
  }
  return ENV_VALIDATION_BASE
}

export function getServerUrl(): string {
  const base = getApiBase()
  if (base) return base
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}
