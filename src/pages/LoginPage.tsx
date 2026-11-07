import { useEffect, useState } from 'react'
import { fetchSsoProviders, getSsoAuthorizeUrl, type SsoProviderInfo } from '../api'
import { useAuth } from '../AuthContext'
import { useI18n } from '../i18n'
import BrandLogo from '../components/BrandLogo'

// ADR-005: a per-viewer convenience only (not a source of truth) — the
// company ID typed here just gets re-sent on the next visit so returning
// users of a dedicated per-mandant IdP don't have to retype it.
const MANDANT_STORAGE_KEY = 'wombat_login_mandant'

export default function LoginPage() {
  const { login, completeMfa } = useAuth()
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode]   = useState('')
  const [mfaMethod, setMfaMethod] = useState<'totp' | 'recovery'>('totp')
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
      const outcome = await login(username.trim(), password)
      if (outcome.mfaRequired && outcome.mfaToken) {
        setMfaToken(outcome.mfaToken)
        setMfaCode('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaToken || !mfaCode.trim()) return
    setError(null)
    setLoading(true)
    try {
      await completeMfa(mfaToken, mfaCode.trim(), mfaMethod)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed')
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
          <div style={{ marginBottom: '0.75rem' }}>
            <BrandLogo height={40} />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            {t('pages.login.productLabel')}
          </div>
        </div>

        {/* Login card */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1.25rem' }}>
            {t('pages.login.title')}
          </h1>

          {mfaToken ? (
            <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                {t('pages.login.mfaHint')}
              </p>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.35rem' }}>
                  {t('pages.login.mfaCodeLabel')}
                </label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  autoFocus
                  style={inputStyle}
                  disabled={loading}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  checked={mfaMethod === 'recovery'}
                  onChange={e => setMfaMethod(e.target.checked ? 'recovery' : 'totp')}
                  disabled={loading}
                />
                {t('pages.login.mfaUseRecovery')}
              </label>
              {error && (
                <div style={{
                  padding: '0.5rem 0.75rem', borderRadius: '6px',
                  background: 'color-mix(in srgb, #ef4444 8%, transparent)', border: '1px solid color-mix(in srgb, #ef4444 25%, transparent)',
                  fontSize: '0.78rem', color: '#ef4444',
                }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !mfaCode.trim()}
                style={{
                  padding: '0.6rem 1rem', borderRadius: '8px',
                  background: loading || !mfaCode.trim() ? 'var(--bg)' : 'var(--waf-brand)',
                  color: loading || !mfaCode.trim() ? 'var(--muted)' : '#fff',
                  border: '1px solid',
                  borderColor: loading || !mfaCode.trim() ? 'var(--border)' : 'var(--waf-brand)',
                  fontWeight: 700, fontSize: '0.875rem', cursor: loading ? 'wait' : 'pointer',
                }}
              >
                {loading ? t('pages.login.signingIn') : t('pages.login.mfaVerify')}
              </button>
              <button
                type="button"
                onClick={() => { setMfaToken(null); setError(null) }}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                {t('pages.login.mfaBack')}
              </button>
            </form>
          ) : (
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
                background: 'color-mix(in srgb, #ef4444 8%, transparent)', border: '1px solid color-mix(in srgb, #ef4444 25%, transparent)',
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
                transition: 'background-color .15s, border-color .15s, color .15s',
              }}
            >
              {loading ? t('pages.login.signingIn') : t('pages.login.signIn')}
            </button>
          </form>
          )}
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
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 500 }}>({mandant.trim()})</span>
                )}
              </a>
            ))}
          </div>
        )}

        {/* ADR-005: optional per-mandant SSO — most deployments never touch this */}
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
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
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
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
