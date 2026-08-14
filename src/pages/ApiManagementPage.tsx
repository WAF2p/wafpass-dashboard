/**
 * API Key Management — create, list, and revoke DB-stored API keys for CI/CD
 * service accounts. Requires admin role.
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import { useAuth } from '../AuthContext'
import { useI18n } from '../i18n'
import {
  fetchApiKeys, createApiKey, revokeApiKey, fetchApiKeyLogs,
  type ApiKeyOut, type ApiKeyCreateResponse, type ApiKeyUsageLogEntry,
} from '../api'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function scoreColor(s: number | null): { color: string; bg: string } {
  if (s === null) return { color: '#64748b', bg: 'rgba(100,116,139,0.09)' }
  if (s >= 80) return { color: '#059669', bg: 'rgba(5,150,105,0.09)' }
  if (s >= 60) return { color: '#b45309', bg: 'rgba(180,83,9,0.09)' }
  return { color: '#DA2C38', bg: 'rgba(218,44,56,0.09)' }
}

// ── Usage log panel ───────────────────────────────────────────────────────────

function KeyLogPanel({ keyId, keyName }: { keyId: string; keyName: string }) {
  const { t } = useI18n()
  const [logs, setLogs]       = useState<ApiKeyUsageLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchApiKeyLogs(keyId)
      .then(setLogs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [keyId])

  return (
    <tr>
      <td colSpan={5} style={{ padding: '0 1rem 0.875rem', background: 'var(--bg)' }}>
        <div style={{
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
          overflow: 'hidden',
          borderLeft: '3px solid #7c3aed',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg)',
          }}>
            <svg width="13" height="13" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('pages.apikeys.usageLogHeader')}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>— {keyName}</span>
            {!loading && !error && (
              <span style={{
                marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--muted)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                padding: '0.1rem 0.5rem', borderRadius: '5px', fontWeight: 600,
              }}>
                {logs.length} {logs.length === 1 ? t('pages.apikeys.entrySingular') : t('pages.apikeys.entryPlural')}
              </span>
            )}
          </div>

          {/* Body */}
          {loading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center' }}><div className="spinner" /></div>
          ) : error ? (
            <div style={{ padding: '0.875rem 1.25rem', color: '#DA2C38', fontSize: '0.78rem' }}>{error}</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '1.5rem 1.25rem', color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'center' }}>
              {t('pages.apikeys.noUsageYet')}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {[t('pages.apikeys.colTimestamp'), t('pages.apikeys.colEndpoint'), t('pages.apikeys.colProject'), t('pages.apikeys.colBranch'), t('pages.apikeys.colScore'), t('pages.apikeys.colRunId'), t('pages.apikeys.colIp')].map(h => (
                    <th key={h} style={{
                      padding: '0.45rem 1.25rem', textAlign: 'left',
                      fontSize: '0.63rem', fontWeight: 700, color: 'var(--muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const sc = scoreColor(log.score)
                  return (
                    <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <td style={{ padding: '0.5rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.76rem' }}>{timeAgo(log.used_at)}</div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{fmtDate(log.used_at)}</div>
                      </td>
                      <td style={{ padding: '0.5rem 1.25rem' }}>
                        <code style={{
                          background: 'rgba(124,58,237,0.08)', color: '#7c3aed',
                          padding: '0.12rem 0.4rem', borderRadius: '5px', fontSize: '0.71rem', fontWeight: 600,
                        }}>
                          {log.endpoint}
                        </code>
                      </td>
                      <td style={{ padding: '0.5rem 1.25rem', fontWeight: 600, color: 'var(--text)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.project || <span style={{ color: 'var(--muted)', fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ padding: '0.5rem 1.25rem', color: 'var(--muted)', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'ui-monospace,monospace', fontSize: '0.72rem' }}>
                        {log.branch || '—'}
                      </td>
                      <td style={{ padding: '0.5rem 1.25rem' }}>
                        {log.score !== null ? (
                          <span style={{
                            display: 'inline-flex', padding: '0.12rem 0.45rem', borderRadius: '5px',
                            background: sc.bg, color: sc.color,
                            fontWeight: 700, fontSize: '0.71rem',
                          }}>
                            {log.score}/100
                          </span>
                        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.5rem 1.25rem' }}>
                        {log.run_id ? (
                          <code style={{ fontSize: '0.69rem', color: 'var(--muted)', background: 'var(--bg)', padding: '0.08rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            {log.run_id.slice(0, 8)}…
                          </code>
                        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.5rem 1.25rem', color: 'var(--muted)', fontSize: '0.72rem', fontFamily: 'ui-monospace,monospace' }}>
                        {log.ip || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApiManagementPage() {
  const { role } = useAuth()
  const { t } = useI18n()
  const isAdmin = role === 'admin'

  const [keys, setKeys]           = useState<ApiKeyOut[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [newKey, setNewKey]       = useState<ApiKeyCreateResponse | null>(null)
  const [copied, setCopied]       = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const rawKeyRef = useRef<HTMLInputElement>(null)

  function loadKeys() {
    setLoading(true)
    fetchApiKeys()
      .then(setKeys)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (isAdmin) loadKeys() }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    setCreateErr(null)
    try {
      const result = await createApiKey(newName.trim())
      setNewKey(result)
      setNewName('')
      loadKeys()
    } catch (e) {
      setCreateErr((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(k: ApiKeyOut) {
    if (!confirm(t('pages.apikeys.revokeConfirm', { name: k.name }))) return
    try {
      await revokeApiKey(k.id)
      if (expandedId === k.id) setExpandedId(null)
      loadKeys()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  function copyKey() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey.raw_key).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      rawKeyRef.current?.select()
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '1rem 1.25rem', borderRadius: '10px',
        background: 'rgba(218,44,56,0.06)', border: '1px solid rgba(218,44,56,0.18)',
      }}>
        <svg width="16" height="16" fill="none" stroke="#DA2C38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ fontSize: '0.83rem', color: '#DA2C38', fontWeight: 600 }}>{t('pages.apikeys.adminRequired')}</span>
      </div>
    )
  }

  const activeKeys  = keys.filter(k => k.is_active)
  const revokedKeys = keys.filter(k => !k.is_active)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {[
          { label: t('pages.apikeys.totalKeys'),  value: keys.length,         color: 'var(--text)' },
          { label: t('common.active'),             value: activeKeys.length,   color: '#059669' },
          { label: t('pages.apikeys.statRevoked'), value: revokedKeys.length,  color: 'var(--muted)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── New key reveal ── */}
      {newKey && (
        <div style={{
          padding: '1rem 1.25rem', borderRadius: '12px',
          background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
            <svg width="14" height="14" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>
              {t('pages.apikeys.keyCreatedMsg', { name: newKey.name })}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              ref={rawKeyRef}
              readOnly
              value={newKey.raw_key}
              style={{
                flex: 1, padding: '0.45rem 0.75rem', borderRadius: '8px',
                border: '1px solid rgba(5,150,105,0.25)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: '0.79rem', fontFamily: 'ui-monospace,monospace',
                outline: 'none',
              }}
              onFocus={e => e.target.select()}
            />
            <button onClick={copyKey} style={{
              padding: '0.42rem 0.875rem', borderRadius: '8px', flexShrink: 0,
              background: copied ? 'rgba(5,150,105,0.18)' : 'rgba(5,150,105,0.1)',
              color: '#059669', border: '1px solid rgba(5,150,105,0.25)',
              cursor: 'pointer', fontSize: '0.79rem', fontWeight: 600,
            }}>
              {copied ? t('common.copied') : t('common.copy')}
            </button>
            <button onClick={() => setNewKey(null)} style={{
              padding: '0.42rem 0.875rem', borderRadius: '8px', flexShrink: 0,
              background: 'transparent', color: 'var(--muted)',
              border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.79rem',
            }}>
              {t('pages.apikeys.dismiss')}
            </button>
          </div>
          <div style={{ marginTop: '0.65rem', padding: '0.5rem 0.75rem', borderRadius: '7px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.69rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{t('pages.apikeys.quickStart')}</div>
            <code style={{ fontSize: '0.74rem', color: 'var(--text)' }}>
              WAFPASS_API_KEY={newKey.raw_key.slice(0, 20)}… wafpass check ./iac --push https://your-server/api/v1/runs
            </code>
          </div>
        </div>
      )}

      {/* ── Create new key ── */}
      <section>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
          {t('pages.apikeys.createHeader')}
        </div>
        <div className="card" style={{ padding: '0.875rem 1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.28rem', display: 'block' }}>
                {t('pages.apikeys.keyNameLabel')}
              </label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                placeholder="e.g. github-actions-prod, gitlab-ci-staging"
                style={{
                  width: '100%', padding: '0.42rem 0.65rem', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none',
                }}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.42rem 0.875rem', borderRadius: '8px',
                background: creating || !newName.trim() ? 'rgba(0,148,255,.35)' : 'var(--waf-brand)',
                color: '#fff', border: 'none',
                cursor: creating || !newName.trim() ? 'default' : 'pointer',
                fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap',
                boxShadow: creating || !newName.trim() ? 'none' : '0 1px 4px rgba(0,148,255,0.25)',
              }}
            >
              <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {creating ? t('pages.apikeys.creating') : t('pages.apikeys.generateBtn')}
            </button>
          </div>
          {createErr && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#DA2C38', padding: '0.4rem 0.65rem', background: 'rgba(218,44,56,0.06)', borderRadius: '7px', border: '1px solid rgba(218,44,56,0.15)' }}>
              {createErr}
            </div>
          )}
        </div>
      </section>

      {/* ── Active keys ── */}
      <section>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
          {t('pages.apikeys.activeKeysHeader')}
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '0.5rem', opacity: 0.7 }}>{t('pages.apikeys.clickToInspect')}</span>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}><div className="spinner" /></div>
          ) : error ? (
            <div style={{ padding: '1rem', color: '#DA2C38', fontSize: '0.82rem' }}>{error}</div>
          ) : activeKeys.length === 0 ? (
            <div style={{ padding: '1.5rem', color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center' }}>
              {t('pages.apikeys.noActiveKeys')}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {[t('pages.apikeys.colKey'), t('pages.apikeys.colPrefix'), t('pages.apikeys.colCreated'), t('pages.apikeys.colLastUsed'), ''].map(h => (
                    <th key={h} style={{
                      padding: '0.55rem 0.875rem', textAlign: 'left',
                      fontSize: '0.63rem', fontWeight: 700, color: 'var(--muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeKeys.map((k, i) => {
                  const isExpanded = expandedId === k.id
                  const isLast = i === activeKeys.length - 1
                  return (
                    <Fragment key={k.id}>
                      <tr
                        onClick={() => toggleExpand(k.id)}
                        style={{
                          borderBottom: isExpanded ? 'none' : (isLast ? undefined : '1px solid var(--border)'),
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.018)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                      >
                        <td style={{ padding: '0.6rem 0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <div style={{ width: '3px', height: '22px', borderRadius: '2px', background: isExpanded ? '#7c3aed' : 'var(--border)', flexShrink: 0, transition: 'background 0.15s' }} />
                              <svg
                                width="11" height="11" fill="none" stroke="var(--muted)" strokeWidth="2.5"
                                strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
                                style={{ transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </div>
                            <div style={{
                              width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
                              background: 'rgba(124,58,237,0.08)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed',
                            }}>
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                              </svg>
                            </div>
                            {k.name}
                          </div>
                        </td>
                        <td style={{ padding: '0.6rem 0.875rem' }}>
                          <code style={{
                            background: 'var(--bg)', border: '1px solid var(--border)',
                            padding: '0.1rem 0.4rem', borderRadius: '5px',
                            fontSize: '0.72rem', color: 'var(--muted)',
                          }}>
                            {k.key_prefix}…
                          </code>
                        </td>
                        <td style={{ padding: '0.6rem 0.875rem', color: 'var(--muted)', fontSize: '0.76rem' }}>
                          {timeAgo(k.created_at)}
                          <div style={{ fontSize: '0.67rem', marginTop: '0.05rem' }}>{fmtDate(k.created_at)}</div>
                        </td>
                        <td style={{ padding: '0.6rem 0.875rem', fontSize: '0.76rem' }}>
                          {k.last_used_at ? (
                            <div>
                              <span style={{ color: '#059669', fontWeight: 600 }}>{timeAgo(k.last_used_at)}</span>
                              <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.05rem' }}>{fmtDate(k.last_used_at)}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted)', opacity: 0.6 }}>{t('pages.apikeys.never')}</span>
                          )}
                        </td>
                        <td style={{ padding: '0.6rem 0.875rem' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleRevoke(k)}
                            style={{
                              padding: '0.22rem 0.55rem', borderRadius: '6px',
                              background: 'var(--bg)', color: '#DA2C38',
                              border: '1px solid rgba(218,44,56,0.25)',
                              cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                            }}
                          >
                            {t('pages.apikeys.revokeBtn')}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && <KeyLogPanel keyId={k.id} keyName={k.name} />}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Revoked keys ── */}
      {revokedKeys.length > 0 && (
        <section>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
            {t('pages.apikeys.revokedKeysHeader', { count: revokedKeys.length })}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden', opacity: 0.55 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {[t('pages.apikeys.colName'), t('pages.apikeys.colPrefix'), t('pages.apikeys.colCreated')].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.875rem', textAlign: 'left', fontSize: '0.63rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {revokedKeys.map((k, i) => (
                  <tr key={k.id} style={{ borderBottom: i < revokedKeys.length - 1 ? '1px solid var(--border)' : undefined }}>
                    <td style={{ padding: '0.55rem 0.875rem', color: 'var(--muted)', textDecoration: 'line-through' }}>{k.name}</td>
                    <td style={{ padding: '0.55rem 0.875rem' }}>
                      <code style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '0.1rem 0.4rem', borderRadius: '5px', fontSize: '0.72rem', color: 'var(--muted)' }}>
                        {k.key_prefix}…
                      </code>
                    </td>
                    <td style={{ padding: '0.55rem 0.875rem', color: 'var(--muted)', fontSize: '0.75rem' }}>{timeAgo(k.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Usage reference ── */}
      <section>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
          {t('pages.apikeys.usageRefHeader')}
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { label: 'CLI flag',       body: 'wafpass check ./iac --push https://your-server/api/v1/runs --api-key <key>' },
            { label: 'Env var',        body: 'WAFPASS_API_KEY=<key>  wafpass check ./iac --push https://your-server/api/v1/runs' },
            { label: 'GitHub Actions', body: 'Set WAFPASS_API_KEY as a repository secret → ${{ secrets.WAFPASS_API_KEY }}' },
            { label: 'HTTP header',    body: 'X-Api-Key: <key>' },
          ].map((row, i, arr) => (
            <div key={row.label} style={{
              display: 'grid', gridTemplateColumns: '140px 1fr',
              padding: '0.6rem 0.875rem',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : undefined,
              gap: '0.875rem', alignItems: 'center',
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{row.label}</div>
              <code style={{ fontSize: '0.75rem', color: 'var(--text)', background: 'var(--bg)', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', display: 'block' }}>{row.body}</code>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
