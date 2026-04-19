/**
 * AuthContext — token storage, user state, login/logout/refresh.
 *
 * Tokens are stored in localStorage (same pattern as the rest of the dashboard).
 * On mount we check if the stored access token is still valid; if not but a
 * refresh token exists we try a silent refresh before showing the login page.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { loginUser, logoutUser, refreshAccessToken, type UserOut } from './api'

// ── Role hierarchy (mirrors backend ROLE_HIERARCHY) ────────────────────────
export const ROLE_HIERARCHY = ['clevel', 'ciso', 'architect', 'engineer', 'admin'] as const
export type Role = typeof ROLE_HIERARCHY[number]

export function roleIndex(role: string): number {
  const i = ROLE_HIERARCHY.indexOf(role as Role)
  return i >= 0 ? i : -1
}

export function hasMinRole(userRole: string, minimum: string): boolean {
  return roleIndex(userRole) >= roleIndex(minimum)
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
  login(username: string, password: string): Promise<void>
  loginWithTokens(accessToken: string, refreshToken: string, userObj: UserOut): void
  logout(): Promise<void>
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

  function _applyTokens(access: string, userObj: UserOut) {
    setAccessToken(access)
    setUser(userObj)
    setRole(userObj.role)
  }

  function _clearAll() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    setAccessToken(null)
    setUser(null)
    setRole(null)
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
      return
    }

    if (refreshTk && userStr) {
      refreshAccessToken(refreshTk)
        .then(({ access_token }) => {
          localStorage.setItem(ACCESS_KEY, access_token)
          const u = JSON.parse(userStr) as UserOut
          _applyTokens(access_token, u)
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
    <AuthContext.Provider value={{ user, accessToken, role, isLoading, login, loginWithTokens, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
