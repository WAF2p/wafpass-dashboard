/**
 * AuthContext — cookie-backed session state.
 *
 * The server sets HttpOnly session cookies; the dashboard never stores an
 * access or refresh token. On mount we ask /auth/me, and if the access cookie
 * has expired we try a cookie-backed refresh once before showing the login
 * page.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import {
  fetchCurrentUser, loginUser, logoutUser, mfaChallenge, refreshAccessToken,
  getMandantContext, getMandantContextName, getMandantContextLogoUrl, setMandantContext, type UserOut,
} from './api'

// ── Role hierarchy (dashboard ordering) ───────────────────────────────────
// Mirrors the server's cumulative hierarchy:
//   clevel < ciso < architect < engineer < admin
// Lower index == higher rank. hasMinRole returns true when the user's rank is
// at least as high as the required minimum.
export const ROLE_HIERARCHY = ['admin', 'engineer', 'architect', 'ciso', 'clevel'] as const
export type Role = typeof ROLE_HIERARCHY[number]

export function roleIndex(role: string): number {
  const i = ROLE_HIERARCHY.indexOf(role as Role)
  return i >= 0 ? i : -1
}

export function hasMinRole(userRole: string, minimum: string): boolean {
  return roleIndex(userRole) <= roleIndex(minimum)
}

export interface LoginOutcome {
  mfaRequired?: boolean
  mfaToken?: string
}

// ── Context type ───────────────────────────────────────────────────────────
export interface AuthContextValue {
  user: UserOut | null
  /** Deprecated: always null. Retained for one release for mocks/callers. */
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
  login(username: string, password: string): Promise<LoginOutcome>
  completeMfa(mfaToken: string, code: string, method?: string): Promise<void>
  /** Deprecated: tokens are no longer stored. Kept for one release. */
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

  function _applyUser(userObj: UserOut) {
    setUser(userObj)
    setRole(userObj.role)
  }

  function _clearAll() {
    setUser(null)
    setRole(null)
    setEffectiveMandantId(null)
  }

  // Restore session on mount. The server may have set cookies via password
  // login or an SSO callback; /auth/me is the single source of truth.
  useEffect(() => {
    let cancelled = false
    async function restore() {
      try {
        const current = await fetchCurrentUser()
        if (!cancelled) _applyUser(current)
      } catch {
        try {
          await refreshAccessToken()
          const current = await fetchCurrentUser()
          if (!cancelled) _applyUser(current)
        } catch {
          if (!cancelled) _clearAll()
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void restore()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function login(username: string, password: string): Promise<LoginOutcome> {
    const resp = await loginUser(username, password)
    if (resp.mfa_required && resp.mfa_token) {
      return { mfaRequired: true, mfaToken: resp.mfa_token }
    }
    if (resp.user) {
      _applyUser(resp.user)
      try {
        _applyUser(await fetchCurrentUser())
      } catch {
        /* keep the login response */
      }
    }
    return {}
  }

  async function completeMfa(mfaToken: string, code: string, method = 'totp'): Promise<void> {
    const resp = await mfaChallenge(mfaToken, code, method)
    if (resp.user) {
      _applyUser(resp.user)
      try {
        _applyUser(await fetchCurrentUser())
      } catch {
        /* keep the challenge response */
      }
    }
  }

  function refreshUser(): Promise<void> {
    return fetchCurrentUser()
      .then(_applyUser)
      .catch(() => {})
  }

  function loginWithTokens(_accessToken: string, _refreshToken: string, userObj: UserOut) {
    // Deprecated: the server sets cookies; tokens are ignored here.
    _applyUser(userObj)
  }

  async function logout() {
    await logoutUser().catch(() => {})
    _clearAll()
  }

  return (
    <AuthContext.Provider value={{
      user, accessToken: null, role, isLoading,
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
      login, completeMfa, loginWithTokens, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
