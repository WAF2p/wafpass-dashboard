import { useState } from 'react'
import { useAuth } from '../AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

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
    background: '#f8fafc', color: '#1e293b',
    border: '1px solid #e2e8f0', borderRadius: '8px',
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
            Controls Dashboard
          </div>
        </div>

        {/* Login card */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1.25rem' }}>
            Sign in
          </h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.35rem' }}>
                Username
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
                Password
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
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer hint */}
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          Local authentication — Phase 1.<br />
          Entra ID / LDAP / Keycloak support coming in future releases.<br />
          Contact your administrator to create or reset your account.
        </div>
      </div>
    </div>
  )
}
