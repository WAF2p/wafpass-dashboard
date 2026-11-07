import { useEffect, useState } from 'react'
import {
  fetchMfaStatus, fetchSessions, mfaDisable, mfaSetup, mfaVerify,
  revokeOtherSessions, revokeSession,
  type MfaSetup, type MfaStatus, type SessionInfo,
} from '../api'
import { PageHeader } from '../ui'

/** Self-service MFA enrollment and active-session management. */
export default function SecuritySettingsPage() {
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState<MfaSetup | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [mfa, activeSessions] = await Promise.all([fetchMfaStatus(), fetchSessions()])
      setStatus(mfa)
      setSessions(activeSessions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load security settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  async function startSetup() {
    await run(async () => {
      const result = await mfaSetup(password)
      setSetup(result)
      setRecoveryCodes(null)
      setCode('')
    })
  }

  async function verifySetup() {
    await run(async () => {
      const result = await mfaVerify(code)
      setRecoveryCodes(result.recovery_codes)
      setSetup(null)
      setCode('')
      await load()
    })
  }

  async function disableMfa() {
    await run(async () => {
      await mfaDisable(password, code)
      setPassword('')
      setCode('')
      setRecoveryCodes(null)
      await load()
    })
  }

  async function revoke(id: string) {
    await run(async () => {
      await revokeSession(id)
      await load()
    })
  }

  async function revokeOthers() {
    await run(async () => {
      await revokeOtherSessions()
      await load()
    })
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--input-bg)', color: 'var(--input-text)',
    border: '1px solid var(--input-border)', borderRadius: '8px',
    padding: '0.55rem 0.8rem', fontSize: '0.85rem',
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <PageHeader
        title="Security"
        description="Multi-factor authentication and active sessions for your account."
      />

      {error && (
        <div role="alert" className="card" style={{ padding: '0.75rem 1rem', color: 'var(--fail-ink)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <section className="card" style={{ padding: '1.25rem' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.35rem' }}>
          Two-factor authentication
        </h2>
        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>Loading…</p>
        ) : status?.enabled ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.84rem', margin: 0 }}>
              Enabled ({status.methods.join(', ')}). Recovery codes remaining: {status.recovery_codes_remaining}.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Current password" autoComplete="current-password" style={{ ...input, maxWidth: '260px' }}
              />
              <input
                type="text" value={code} onChange={e => setCode(e.target.value)}
                placeholder="TOTP or recovery code" style={{ ...input, maxWidth: '220px' }}
              />
              <button
                type="button" onClick={() => void disableMfa()}
                disabled={busy || !password || !code}
                style={{ padding: '0.55rem 0.9rem', borderRadius: '8px', border: '1px solid var(--fail)', background: 'transparent', color: 'var(--fail-ink)', fontWeight: 600, cursor: 'pointer' }}
              >
                Disable MFA
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.84rem', margin: 0 }}>
              Add a TOTP authenticator app as a second factor.
              {status?.required ? ' This role requires MFA.' : ''}
            </p>
            {!setup && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Current password" autoComplete="current-password" style={{ ...input, maxWidth: '260px' }}
                />
                <button
                  type="button" onClick={() => void startSetup()}
                  disabled={busy || !password}
                  style={{ padding: '0.55rem 0.9rem', borderRadius: '8px', border: '1px solid var(--waf-brand)', background: 'var(--waf-brand)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Start setup
                </button>
              </div>
            )}
            {setup && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {setup.qr_svg && (
                  <div
                    style={{ width: 180, height: 180, background: '#fff', padding: 8, borderRadius: 8 }}
                    dangerouslySetInnerHTML={{ __html: setup.qr_svg }}
                  />
                )}
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
                  Secret: <code>{setup.secret}</code>
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="text" value={code} onChange={e => setCode(e.target.value)}
                    placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code"
                    style={{ ...input, maxWidth: '180px' }}
                  />
                  <button
                    type="button" onClick={() => void verifySetup()}
                    disabled={busy || code.trim().length < 6}
                    style={{ padding: '0.55rem 0.9rem', borderRadius: '8px', border: '1px solid var(--waf-brand)', background: 'var(--waf-brand)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Verify and enable
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {recoveryCodes && (
          <div style={{ marginTop: '0.9rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
              Recovery codes — store these now; they are shown once.
            </div>
            <pre style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
              {recoveryCodes.join('\n')}
            </pre>
          </div>
        )}
      </section>

      <section className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.35rem' }}>
              Active sessions
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.84rem', margin: 0 }}>
              Revoke any device you do not recognize.
            </p>
          </div>
          <button
            type="button" onClick={() => void revokeOthers()}
            disabled={busy || sessions.length <= 1}
            style={{ padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
          >
            Revoke all other sessions
          </button>
        </div>
        <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sessions.map(session => (
            <div
              key={session.id}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '8px' }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                  {session.label || 'Unknown device'} {session.current && <span style={{ color: 'var(--waf-brand)', fontSize: '0.75rem' }}>· this device</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Last seen {new Date(session.last_seen_at).toLocaleString()} · expires {new Date(session.expires_at).toLocaleDateString()}
                </div>
              </div>
              <button
                type="button" onClick={() => void revoke(session.id)}
                disabled={busy}
                style={{ padding: '0.4rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.78rem', cursor: 'pointer' }}
              >
                Revoke
              </button>
            </div>
          ))}
          {!loading && sessions.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.84rem', margin: 0 }}>No active sessions.</p>
          )}
        </div>
      </section>
    </div>
  )
}
