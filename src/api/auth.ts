/** Authentication and session API. One domain module of the api.ts split. */
import { getApiBase } from '../lib/config'
import { apiFetch, apiGet, apiPost, authFetch } from '../lib/http'

export interface UserOut {
  id: string
  username: string
  display_name: string
  image_url: string
  role: string
  auth_provider: string
  is_active: boolean
  last_login_at: string | null
  created_at: string | null
  updated_at: string | null
  mandant_id: string | null
  holding_role: string | null // null | 'holding_admin' | 'holding_viewer' | 'group_admin' | 'group_viewer'
  must_change_password: boolean
}

export interface LoginResponse {
  access_token?: string
  refresh_token?: string
  token_type?: string
  user?: UserOut
  mfa_required?: boolean
  mfa_token?: string
  methods?: string[]
  mfa_enrollment_required?: boolean
}

export interface MfaStatus {
  enabled: boolean
  methods: string[]
  recovery_codes_remaining: number
  required: boolean
}

export interface MfaSetup {
  secret: string
  otpauth_uri: string
  qr_svg?: string | null
}

export interface SessionInfo {
  id: string
  created_at: string
  last_seen_at: string
  expires_at: string
  revoked_at: string | null
  label: string
  user_agent: string
  current: boolean
}

export function fetchMfaStatus(): Promise<MfaStatus> {
  return apiGet<MfaStatus>('/api/v1/auth/mfa')
}

export function mfaSetup(currentPassword: string): Promise<MfaSetup> {
  return apiPost<MfaSetup>('/api/v1/auth/mfa/totp/setup', {
    current_password: currentPassword,
  })
}

export function mfaVerify(code: string): Promise<{ recovery_codes: string[] }> {
  return apiPost<{ recovery_codes: string[] }>('/api/v1/auth/mfa/totp/verify', { code })
}

export function mfaDisable(currentPassword: string, code: string): Promise<void> {
  return apiPost<void>('/api/v1/auth/mfa/disable', {
    current_password: currentPassword,
    code,
  })
}

export function mfaChallenge(
  mfaToken: string,
  code: string,
  method = 'totp',
): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/v1/auth/mfa/challenge', {
    mfa_token: mfaToken,
    code,
    method,
  })
}

export function fetchSessions(): Promise<SessionInfo[]> {
  return apiGet<SessionInfo[]>('/api/v1/auth/sessions')
}

export function revokeSession(sessionId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
}

export function revokeOtherSessions(): Promise<{ revoked: number }> {
  return apiFetch<{ revoked: number }>('/api/v1/auth/sessions', { method: 'DELETE' })
}

export async function loginUser(username: string, password: string): Promise<LoginResponse> {
  const res = await authFetch(`${getApiBase()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Login failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Login failed')
  }
  return res.json() as Promise<LoginResponse>
}

export async function refreshAccessToken(
  refreshToken?: string,
): Promise<{ access_token: string; refresh_token: string; token_type: string }> {
  const res = await authFetch(`${getApiBase()}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  return res.json() as Promise<{ access_token: string; refresh_token: string; token_type: string }>
}

export async function logoutUser(refreshToken?: string): Promise<void> {
  await authFetch(`${getApiBase()}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
  })
}

/** Return the currently authenticated profile, or throw on 401. */
export async function fetchCurrentUser(): Promise<UserOut> {
  const res = await authFetch(`${getApiBase()}/api/v1/auth/me`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<UserOut>
}

/** Rotate the caller's password. The server revokes other sessions. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await authFetch(`${getApiBase()}/api/v1/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Password change failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Password change failed')
  }
}
