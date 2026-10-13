/**
 * AuthContext — token storage, user state, login/logout/refresh.
 *
 * Tokens are stored in localStorage (same pattern as the rest of the dashboard).
 * On mount we check if the stored access token is still valid; if not but a
 * refresh token exists we try a silent refresh before showing the login page.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import {
  loginUser, logoutUser, refreshAccessToken, fetchUsers,
  getMandantContext, getMandantContextName, getMandantContextLogoUrl, setMandantContext, type UserOut,
} from './api'

// ── Role hierarchy (dashboard ordering) ───────────────────────────────────
// Admin is the super-user and outranks every other role, so it sits at index 0.
// Lower index == higher rank.  hasMinRole returns true when the user rank is
// at least as high as the required minimum.
export const ROLE_HIERARCHY = ['admin', 'ciso', 'clevel', 'architect', 'engineer'] as const
export type Role = typeof ROLE_HIERARCHY[number]

export function roleIndex(role: string): number {
  const i = ROLE_HIERARCHY.indexOf(role as Role)
  return i >= 0 ? i : -1
}

export function hasMinRole(userRole: string, minimum: string): boolean {
  return roleIndex(userRole) <= roleIndex(minimum)
}

// ── Storage keys ───────────────────────────────────────────────────────────
const ACCESS_KEY  = 'wafpass_access_token'
const REFRESH_KEY = 'wafpass_refresh_token'
const USER_KEY    = 'wafpass_auth_user'

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    // Treat as expired 30 s before actual expiry (clock-skew margin)
    return payload.exp * 1000 - 30_000 < Date.now()
  } catch {
    return true
  }
}

// ── Context type ───────────────────────────────────────────────────────────
export interface AuthContextValue {
  user: UserOut | null
  accessToken: string | null
  role: string | null
  isLoading: boolean
  // Multi-mandant (Phase 1/3) — mirrors the server's AuthContext. Always
  // false/null while instance_mode is "single_tenant", same as the server.
  mandantId: string | null
  isHoldingAdmin: boolean
  isHoldingViewer: boolean
  // Phase 6b / ADR-004 — scoped to the user's own mandate plus its
  // descendants (mandant_ancestry), not the whole holding. Deliberately
  // separate booleans, not folded into isHoldingAdmin/isHoldingViewer:
  // mandant CRUD and the Mandates/Mandate-Administration pages stay
  // holding_admin-only, a decision ADR-004 doesn't change.
  isGroupAdmin: boolean
  isGroupViewer: boolean
  // Phase 6a — Global Context Switcher. A holding_admin/holding_viewer's
  // chosen "viewing as" mandate (null = their default full cross-mandate
  // view). Persisted via api.ts's getMandantContext()/setMandantContext()
  // (localStorage) and sent as X-Mandant-Context on every request by
  // _authHeaders() — the server validates it fresh on every request
  // (auth/deps.py's get_auth_context()/require_ingest()), so a non-holding
  // user or a stale id here is simply ignored server-side, not a privilege
  // escalation risk client-side.
  effectiveMandantId: string | null
  // Display name only, for the switcher/impersonation banner — never used
  // for access control (the server re-validates the id itself on every
  // request regardless of what name was passed here).
  effectiveMandantName: string | null
  // Logo URL only, for the top-bar active-mandate logo — same
  // never-trusted-for-access-control caveat as the name above.
  effectiveMandantLogoUrl: string | null
  setEffectiveMandantId(mandantId: string | null, name?: string | null, logoUrl?: string | null): void
  login(username: string, password: string): Promise<void>
  loginWithTokens(accessToken: string, refreshToken: string, userObj: UserOut): void
  logout(): Promise<void>
  // Re-fetches the current user's own profile and updates `user` in place —
  // for cases where something the user themself just did changes their own
  // row (e.g. activating multi-mandant mode makes the acting admin the
  // first holding_admin server-side; nothing re-fetches `user` on its own
  // afterward, so isHoldingAdmin would otherwise stay stale until the next
  // login or page reload).
  refreshUser(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

// ── Provider ───────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<UserOut | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [role, setRole]               = useState<string | null>(null)
  const [isLoading, setIsLoading]     = useState(true)
  const [effectiveMandantId, setEffectiveMandantIdState] = useState<string | null>(() => getMandantContext())
  const [effectiveMandantName, setEffectiveMandantNameState] = useState<string | null>(() => getMandantContextName())
  const [effectiveMandantLogoUrl, setEffectiveMandantLogoUrlState] = useState<string | null>(() => getMandantContextLogoUrl())

  function setEffectiveMandantId(mandantId: string | null, name?: string | null, logoUrl?: string | null) {
    setMandantContext(mandantId, name, logoUrl)
    setEffectiveMandantIdState(mandantId)
    setEffectiveMandantNameState(mandantId ? (name ?? null) : null)
    setEffectiveMandantLogoUrlState(mandantId ? (logoUrl ?? null) : null)
  }

  function _applyTokens(access: string, userObj: UserOut) {
    setAccessToken(access)
    setUser(userObj)
    setRole(userObj.role)
  }

  function _fetchFullProfile(username: string): Promise<void> {
    return fetchUsers()
      .then(users => {
        const fullUser = users.find(u => u.username === username)
        if (fullUser) {
          localStorage.setItem(USER_KEY, JSON.stringify(fullUser))
          setUser(fullUser)
        }
      })
      .catch(() => {})
  }

  function _clearAll() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    setAccessToken(null)
    setUser(null)
    setRole(null)
    setEffectiveMandantId(null)
  }

  // Restore session on mount — also handles SSO token handoff via query params
  useEffect(() => {
    // Check for SSO callback: ?sso_ok=1&at=ACCESS&rt=REFRESH&u=USER_B64
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('sso_ok') === '1') {
      const at  = urlParams.get('at')
      const rt  = urlParams.get('rt')
      const uB64 = urlParams.get('u')
      if (at && rt && uB64) {
        try {
          const raw = uB64.replace(/-/g, '+').replace(/_/g, '/')
          const u = JSON.parse(atob(raw)) as UserOut
          localStorage.setItem(ACCESS_KEY, at)
          localStorage.setItem(REFRESH_KEY, rt)
          localStorage.setItem(USER_KEY, JSON.stringify(u))
          _applyTokens(at, u)
          window.history.replaceState(null, '', window.location.pathname + '#/dashboard')
          setIsLoading(false)
          return
        } catch {
          // fall through to normal session restore
        }
      }
    }

    const access    = localStorage.getItem(ACCESS_KEY)
    const refreshTk = localStorage.getItem(REFRESH_KEY)
    const userStr   = localStorage.getItem(USER_KEY)

    if (access && userStr && !isTokenExpired(access)) {
      const u = JSON.parse(userStr) as UserOut
      _applyTokens(access, u)
      setIsLoading(false)
      // Fetch full user profile to get image_url and other potentially missing fields
      void _fetchFullProfile(u.username)
      return
    }

    if (refreshTk && userStr) {
      refreshAccessToken(refreshTk)
        .then(({ access_token, refresh_token }) => {
          localStorage.setItem(ACCESS_KEY, access_token)
          localStorage.setItem(REFRESH_KEY, refresh_token)
          const u = JSON.parse(userStr) as UserOut
          _applyTokens(access_token, u)
          // Fetch full user profile to get image_url and other potentially missing fields
          void _fetchFullProfile(u.username)
        })
        .catch(() => _clearAll())
        .finally(() => setIsLoading(false))
    } else {
      _clearAll()
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function login(username: string, password: string) {
    const resp = await loginUser(username, password)
    localStorage.setItem(ACCESS_KEY, resp.access_token)
    localStorage.setItem(REFRESH_KEY, resp.refresh_token)
    localStorage.setItem(USER_KEY, JSON.stringify(resp.user))
    _applyTokens(resp.access_token, resp.user)
    // Fetch full user profile to get image_url and other potentially missing fields
    void _fetchFullProfile(username)
  }

  function refreshUser(): Promise<void> {
    return user ? _fetchFullProfile(user.username) : Promise.resolve()
  }

  function loginWithTokens(accessToken: string, refreshToken: string, userObj: UserOut) {
    localStorage.setItem(ACCESS_KEY, accessToken)
    localStorage.setItem(REFRESH_KEY, refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(userObj))
    _applyTokens(accessToken, userObj)
  }

  async function logout() {
    const refreshTk = localStorage.getItem(REFRESH_KEY)
    if (refreshTk) await logoutUser(refreshTk).catch(() => {})
    _clearAll()
  }

  return (
    <AuthContext.Provider value={{
      user, accessToken, role, isLoading,
      // Derived from `user` directly, not separate state — there is
      // nothing to keep in sync; whenever `user` updates (login, profile
      // refresh, a holding_admin elsewhere reassigning this account) these
      // follow automatically.
      mandantId: user?.mandant_id ?? null,
      isHoldingAdmin: user?.holding_role === 'holding_admin',
      isHoldingViewer: user?.holding_role === 'holding_viewer',
      isGroupAdmin: user?.holding_role === 'group_admin',
      isGroupViewer: user?.holding_role === 'group_viewer',
      effectiveMandantId, effectiveMandantName, effectiveMandantLogoUrl, setEffectiveMandantId,
      login, loginWithTokens, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
