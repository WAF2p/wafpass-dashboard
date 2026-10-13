import { useEffect, useState } from 'react'
import { fetchSsoProviders, getSsoAuthorizeUrl, type SsoProviderInfo } from '../api'
import { useAuth } from '../AuthContext'
import { useI18n } from '../i18n'

// ADR-005: a per-viewer convenience only (not a source of truth) — the
// company ID typed here just gets re-sent on the next visit so returning
// users of a dedicated per-mandant IdP don't have to retype it.
const MANDANT_STORAGE_KEY = 'wafpass_login_mandant'

export default function LoginPage() {
  const { login } = useAuth()
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [ssoProviders, setSsoProviders] = useState<SsoProviderInfo[]>([])
  const [mandant, setMandant] = useState(() => {
    try { return localStorage.getItem(MANDANT_STORAGE_KEY) ?? '' } catch { return '' }
  })

  useEffect(() => {
    fetchSsoProviders(mandant.trim() || undefined).then(setSsoProviders).catch(() => {})
  }, [mandant])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ssoErr = params.get('sso_error')
    if (ssoErr) setError(`SSO error: ${ssoErr.replace(/_/g, ' ')}`)
  }, [])

  function handleMandantChange(value: string) {
    setMandant(value)
    try {
      if (value.trim()) localStorage.setItem(MANDANT_STORAGE_KEY, value.trim())
      else localStorage.removeItem(MANDANT_STORAGE_KEY)
    } catch { /* private window / blocked storage — fine, just not remembered */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError(null)
    setLoading(true)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--input-bg)', color: 'var(--input-text)',
    border: '1px solid var(--input-border)', borderRadius: '8px',
    padding: '0.6rem 0.85rem', fontSize: '0.875rem',
    outline: 'none', transition: 'border-color .15s',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{ width: '360px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Logo + product name */}
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="WAF++ PASS" style={{ height: '40px', objectFit: 'contain', marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            {t('pages.login.productLabel')}
          </div>
        </div>

        {/* Login card */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1.25rem' }}>
            {t('pages.login.title')}
          </h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.35rem' }}>
                {t('pages.login.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                style={inputStyle}
                placeholder="admin"
                disabled={loading}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.35rem' }}>
                {t('pages.login.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={inputStyle}
                disabled={loading}
              />
            </div>

            {error && (
              <div style={{
                padding: '0.5rem 0.75rem', borderRadius: '6px',
                background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
                fontSize: '0.78rem', color: '#ef4444',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              style={{
                marginTop: '0.25rem',
                padding: '0.6rem 1rem', borderRadius: '8px',
                background: loading || !username.trim() || !password ? 'var(--bg)' : 'var(--waf-brand)',
                color: loading || !username.trim() || !password ? 'var(--muted)' : '#fff',
                border: '1px solid',
                borderColor: loading || !username.trim() || !password ? 'var(--border)' : 'var(--waf-brand)',
                fontWeight: 700, fontSize: '0.875rem', cursor: loading ? 'wait' : 'pointer',
                transition: 'all .15s',
              }}
            >
              {loading ? t('pages.login.signingIn') : t('pages.login.signIn')}
            </button>
          </form>
        </div>

        {/* SSO providers */}
        {ssoProviders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('pages.login.or')}</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            {ssoProviders.map(p => (
              <a
                key={p.provider}
                href={getSsoAuthorizeUrl(p.provider as 'oidc' | 'saml2', mandant.trim() || undefined)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                  padding: '0.6rem 1rem', borderRadius: '8px',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem',
                  textDecoration: 'none', transition: 'border-color .15s',
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {p.label}
                {p.scope === 'mandant' && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 500 }}>({mandant.trim()})</span>
                )}
              </a>
            ))}
          </div>
        )}

        {/* ADR-005: optional per-mandant SSO — most deployments never touch this */}
        <div>
          <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
            {t('pages.login.mandantLabel')}
          </label>
          <input
            type="text"
            value={mandant}
            onChange={e => handleMandantChange(e.target.value)}
            placeholder={t('pages.login.mandantPlaceholder')}
            autoComplete="organization"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--input-bg)', color: 'var(--input-text)',
              border: '1px solid var(--input-border)', borderRadius: '8px',
              padding: '0.4rem 0.7rem', fontSize: '0.78rem',
              outline: 'none',
            }}
            disabled={loading}
          />
          <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
            {t('pages.login.mandantHint')}
          </div>
        </div>

        {/* Footer hint */}
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          {ssoProviders.length === 0
            ? t('pages.login.footerLocal')
            : t('pages.login.footerSso')
          }
        </div>
      </div>

    </div>
  )
}
