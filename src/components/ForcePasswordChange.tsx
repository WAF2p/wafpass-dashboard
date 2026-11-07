import { useState } from 'react'
import { changePassword } from '../api'
import { useAuth } from '../AuthContext'
import { useI18n } from '../i18n'
import BrandLogo from './BrandLogo'

/**
 * Blocking screen shown when the server marks an account's password as
 * bootstrap/admin-reset. The user cannot reach any route until they rotate it.
 */
export default function ForcePasswordChange() {
  const { user, refreshUser, logout } = useAuth()
  const { t } = useI18n()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--input-bg)', color: 'var(--input-text)',
    border: '1px solid var(--input-border)', borderRadius: '8px',
    padding: '0.6rem 0.85rem', fontSize: '0.875rem',
    outline: 'none',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 12) {
      setError(t('pages.forcePassword.tooShort'))
      return
    }
    if (next !== confirm) {
      setError(t('pages.forcePassword.mismatch'))
      return
    }
    setSaving(true)
    try {
      await changePassword(current, next)
      await refreshUser()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.forcePassword.failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1rem',
    }}>
      <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ textAlign: 'center' }}>
          <BrandLogo height={40} />
        </div>
        <div className="card" style={{ padding: '1.75rem' }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem' }}>
            {t('pages.forcePassword.title')}
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
            {t('pages.forcePassword.subtitle')}
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>
              {t('pages.forcePassword.currentLabel')}
              <input
                type="password" value={current} autoComplete="current-password" autoFocus
                onChange={e => setCurrent(e.target.value)} style={{ ...inputStyle, marginTop: '0.35rem' }}
                disabled={saving}
              />
            </label>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>
              {t('pages.forcePassword.newLabel')}
              <input
                type="password" value={next} autoComplete="new-password"
                onChange={e => setNext(e.target.value)} style={{ ...inputStyle, marginTop: '0.35rem' }}
                disabled={saving}
              />
            </label>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>
              {t('pages.forcePassword.confirmLabel')}
              <input
                type="password" value={confirm} autoComplete="new-password"
                onChange={e => setConfirm(e.target.value)} style={{ ...inputStyle, marginTop: '0.35rem' }}
                disabled={saving}
              />
            </label>
            {error && (
              <div style={{
                padding: '0.5rem 0.75rem', borderRadius: '6px',
                background: 'color-mix(in srgb, #ef4444 8%, transparent)',
                border: '1px solid color-mix(in srgb, #ef4444 25%, transparent)',
                fontSize: '0.78rem', color: '#ef4444',
              }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={saving || !current || !next || !confirm}
              style={{
                padding: '0.6rem 1rem', borderRadius: '8px',
                background: saving ? 'var(--bg)' : 'var(--waf-brand)',
                color: saving ? 'var(--muted)' : '#fff',
                border: '1px solid var(--waf-brand)',
                fontWeight: 700, fontSize: '0.875rem',
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? t('pages.forcePassword.updating') : t('pages.forcePassword.submit')}
            </button>
          </form>
          <button
            type="button"
            onClick={() => void logout()}
            style={{
              marginTop: '1rem', width: '100%', background: 'none', border: 'none',
              color: 'var(--muted)', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            {t('pages.forcePassword.signOut')}
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center' }}>
          {user?.username}
        </p>
      </div>
    </div>
  )
}
