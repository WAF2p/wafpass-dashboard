/**
 * User Management — create, edit, activate/deactivate, and delete user accounts.
 * Click a user row to see their extended profile and audit trail.
 * Requires admin role.
 */
import { Fragment, useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { fetchUsers, createUser, updateUser, deleteUser, fetchUserLogs, type UserOut, type UserAuditLogEntry } from '../api'
import { useI18n } from '../i18n'

const ALL_ROLES = ['clevel', 'ciso', 'architect', 'engineer', 'admin'] as const

// Role accent: hue only — used for avatar dot, left accent stripe, and badge.
// Everything else stays neutral so color doesn't dominate.
const ROLE_COLOR: Record<string, { accent: string; subtle: string; text: string }> = {
  admin:    { accent: '#DA2C38', subtle: 'rgba(218,44,56,0.08)',  text: '#DA2C38' },
  engineer: { accent: '#16a34a', subtle: 'rgba(22,163,74,0.08)',  text: '#16a34a' },
  architect:{ accent: '#7c3aed', subtle: 'rgba(124,58,237,0.08)', text: '#7c3aed' },
  ciso:     { accent: '#0078d4', subtle: 'rgba(0,120,212,0.08)',  text: '#0078d4' },
  clevel:   { accent: '#b45309', subtle: 'rgba(180,83,9,0.08)',   text: '#b45309' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLOR[role] ?? { accent: '#64748b', subtle: 'rgba(100,116,139,0.08)', text: '#64748b' }
  return (
    <span style={{
      display: 'inline-flex', padding: '0.15rem 0.55rem', borderRadius: '6px',
      background: c.subtle, color: c.text,
      fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.03em',
    }}>
      {role}
    </span>
  )
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Action badge ──────────────────────────────────────────────────────────────

const ACTION_STYLE: Record<string, { color: string; bg: string }> = {
  'login':       { color: '#059669', bg: 'rgba(5,150,105,0.09)' },
  'logout':      { color: '#64748b', bg: 'rgba(100,116,139,0.09)' },
  'run.push':    { color: '#0078d4', bg: 'rgba(0,120,212,0.09)' },
  'user.create': { color: '#7c3aed', bg: 'rgba(124,58,237,0.09)' },
  'user.update': { color: '#b45309', bg: 'rgba(180,83,9,0.09)' },
  'user.delete': { color: '#DA2C38', bg: 'rgba(218,44,56,0.09)' },
}

function ActionBadge({ action }: { action: string }) {
  const { t } = useI18n()
  const labelMap: Record<string, string> = {
    'login':       t('pages.users.actionLogin'),
    'logout':      t('pages.users.actionLogout'),
    'run.push':    t('pages.users.actionRunPush'),
    'user.create': t('pages.users.actionUserCreate'),
    'user.update': t('pages.users.actionUserUpdate'),
    'user.delete': t('pages.users.actionUserDelete'),
  }
  const s = ACTION_STYLE[action] ?? { color: '#64748b', bg: 'rgba(100,116,139,0.08)' }
  return (
    <span style={{
      display: 'inline-flex', padding: '0.15rem 0.5rem', borderRadius: '6px',
      background: s.bg, color: s.color,
      fontWeight: 600, fontSize: '0.69rem', letterSpacing: '0.02em',
    }}>
      {labelMap[action] ?? action}
    </span>
  )
}

function ActionDetail({ action, detail }: { action: string; detail: Record<string, unknown> }) {
  const { t } = useI18n()
  const muted: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--muted)' }
  if (action === 'run.push') {
    const score = detail.score as number | undefined
    return (
      <span style={muted}>
        {detail.project
          ? <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{String(detail.project)}</strong>
          : t('pages.users.unnamedProject')}
        {detail.branch ? <> · <code style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{String(detail.branch)}</code></> : null}
        {score != null && (
          <span style={{
            marginLeft: '0.4rem', padding: '0.1rem 0.35rem', borderRadius: '5px',
            background: score >= 80 ? 'rgba(5,150,105,.1)' : score >= 60 ? 'rgba(180,83,9,.1)' : 'rgba(218,44,56,.1)',
            color: score >= 80 ? '#059669' : score >= 60 ? '#b45309' : '#DA2C38',
            fontWeight: 700, fontSize: '0.68rem',
          }}>
            {score}/100
          </span>
        )}
      </span>
    )
  }
  if (action === 'user.create') {
    return (
      <span style={muted}>
        {t('pages.users.createdAction')} <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{String(detail.target_username ?? '?')}</strong>
        {' '}as <RoleBadge role={String(detail.target_role ?? '')} />
      </span>
    )
  }
  if (action === 'user.update') {
    const fields = detail.fields as string[] | undefined
    return (
      <span style={muted}>
        {t('pages.users.updatedAction')} <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{String(detail.target_username ?? '?')}</strong>
        {fields?.length ? (
          <span style={{ marginLeft: '0.35rem' }}>
            {fields.map(f => (
              <code key={f} style={{ marginLeft: '0.2rem', fontSize: '0.68rem', background: 'var(--bg)', color: 'var(--text)', padding: '0.05rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border)' }}>{f}</code>
            ))}
          </span>
        ) : null}
      </span>
    )
  }
  if (action === 'user.delete') {
    return (
      <span style={muted}>
        {t('pages.users.deletedAction')} <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{String(detail.target_username ?? '?')}</strong>
        {detail.target_role ? <> · <RoleBadge role={String(detail.target_role)} /></> : null}
      </span>
    )
  }
  return <span style={muted}>—</span>
}

// ── Profile meta tile ─────────────────────────────────────────────────────────

function MetaTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: 500 }}>
        {children}
      </div>
    </div>
  )
}

// ── User detail & audit panel ─────────────────────────────────────────────────

function UserDetailPanel({ user }: { user: UserOut }) {
  const { t } = useI18n()
  const [logs, setLogs]       = useState<UserAuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchUserLogs(user.id)
      .then(setLogs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user.id])

  const roleC = ROLE_COLOR[user.role] ?? { accent: '#64748b', subtle: 'rgba(100,116,139,0.08)', text: '#64748b' }

  return (
    <tr>
      <td colSpan={7} style={{ padding: '0 1rem 0.875rem', background: 'var(--bg)' }}>
        <div style={{
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
          overflow: 'hidden',
          borderLeft: `3px solid ${roleC.accent}`,
        }}>

          {/* ── Profile strip ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '1rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center',
          }}>
            {/* Avatar */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
              background: roleC.subtle,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 800, color: roleC.accent,
              overflow: 'hidden',
            }}>
              {user.image_url ? (
                <img src={user.image_url} alt={user.display_name || user.username} style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                }} />
              ) : (
                <span>{(user.display_name || user.username).charAt(0).toUpperCase()}</span>
              )}
            </div>

            {/* Name + meta grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,2fr) repeat(5, minmax(110px,1fr))', gap: '0.5rem 1.25rem', alignItems: 'center' }}>
              {/* Name + role */}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.2 }}>
                  {user.display_name || user.username}
                </div>
                {user.display_name && user.display_name !== user.username && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.1rem' }}>@{user.username}</div>
                )}
                <div style={{ marginTop: '0.3rem' }}>
                  <RoleBadge role={user.role} />
                </div>
              </div>

              <MetaTile label={t('pages.users.colUserId')}>
                <code style={{ fontSize: '0.69rem', color: 'var(--muted)', fontFamily: 'ui-monospace,monospace' }}>
                  {user.id.slice(0, 8)}…
                </code>
              </MetaTile>

              <MetaTile label={t('pages.users.colAuthProvider')}>
                <span style={{ textTransform: 'capitalize' }}>{user.auth_provider}</span>
              </MetaTile>

              <MetaTile label={t('pages.users.colStatus')}>
                <span style={{
                  display: 'inline-flex', padding: '0.12rem 0.5rem', borderRadius: '5px',
                  background: user.is_active ? 'rgba(5,150,105,0.1)' : 'rgba(100,116,139,0.09)',
                  color: user.is_active ? '#059669' : '#64748b',
                  fontWeight: 600, fontSize: '0.7rem',
                }}>
                  {user.is_active ? t('pages.users.active') : t('pages.users.inactive')}
                </span>
              </MetaTile>

              <MetaTile label={t('pages.users.colLastLogin')}>
                {user.last_login_at ? (
                  <>
                    <span style={{ color: '#059669', fontWeight: 600 }}>{timeAgo(user.last_login_at)}</span>
                    <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{fmtDate(user.last_login_at)}</div>
                  </>
                ) : <span style={{ color: 'var(--muted)' }}>{t('pages.users.never')}</span>}
              </MetaTile>

              <MetaTile label={t('pages.users.colCreated')}>
                {user.created_at ? (
                  <>
                    <span>{timeAgo(user.created_at)}</span>
                    <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{fmtDate(user.created_at)}</div>
                  </>
                ) : '—'}
              </MetaTile>
            </div>
          </div>

          {/* ── Audit log header ── */}
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
              {t('pages.users.auditTrailLabel')}
            </span>
            {!loading && !error && (
              <span style={{
                marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--muted)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                padding: '0.1rem 0.5rem', borderRadius: '5px', fontWeight: 600,
              }}>
                {logs.length} {logs.length === 1 ? t('pages.users.eventSingular') : t('pages.users.eventPlural')}
              </span>
            )}
          </div>

          {/* ── Audit log body ── */}
          {loading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center' }}><div className="spinner" /></div>
          ) : error ? (
            <div style={{ padding: '0.875rem 1.25rem', color: '#DA2C38', fontSize: '0.78rem', background: 'rgba(218,44,56,0.04)' }}>{error}</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '1.5rem 1.25rem', color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'center' }}>
              {t('pages.users.noAuditEvents')}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {[t('pages.users.colTimestamp'), t('pages.users.colAction'), t('pages.users.colDetail'), t('pages.users.colIp')].map(h => (
                    <th key={h} style={{
                      padding: '0.45rem 1.25rem', textAlign: 'left',
                      fontSize: '0.63rem', fontWeight: 700, color: 'var(--muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} style={{
                    borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : undefined,
                  }}>
                    <td style={{ padding: '0.5rem 1.25rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.76rem' }}>{timeAgo(log.timestamp)}</div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{fmtDate(log.timestamp)}</div>
                    </td>
                    <td style={{ padding: '0.5rem 1.25rem' }}>
                      <ActionBadge action={log.action} />
                    </td>
                    <td style={{ padding: '0.5rem 1.25rem', maxWidth: '360px' }}>
                      <ActionDetail action={log.action} detail={log.detail} />
                    </td>
                    <td style={{ padding: '0.5rem 1.25rem', color: 'var(--muted)', fontSize: '0.72rem', fontFamily: 'ui-monospace,monospace' }}>
                      {log.ip || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Form styles ───────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.82rem', boxSizing: 'border-box',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem',
  display: 'block',
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface UserFormState {
  username: string
  display_name: string
  image_url: string
  role: string
  password: string
  is_active: boolean
}

const EMPTY_FORM: UserFormState = { username: '', display_name: '', image_url: '', role: 'engineer', password: '', is_active: true }

export default function UserManagementPage() {
  const { t } = useI18n()
  const { role, user } = useAuth()
  const isAdmin = role === 'admin'

  const [users, setUsers]           = useState<UserOut[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [editId, setEditId]         = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState<UserFormState>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [saveErr, setSaveErr]       = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function loadUsers() {
    setLoading(true)
    fetchUsers()
      .then(setUsers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setSaveErr(null)
    setShowForm(true)
  }

  function openEdit(u: UserOut, e: React.MouseEvent) {
    e.stopPropagation()
    setEditId(u.id)
    setForm({ username: u.username, display_name: u.display_name, image_url: u.image_url || '', role: u.role, password: '', is_active: u.is_active })
    setSaveErr(null)
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveErr(null)
    try {
      if (editId) {
        const payload: { display_name?: string; image_url?: string; role?: string; is_active?: boolean; password?: string } = {
          display_name: form.display_name,
          image_url: form.image_url || undefined,
          role: form.role,
          is_active: form.is_active,
        }
        if (form.password) payload.password = form.password
        await updateUser(editId, payload)
      } else {
        await createUser({ username: form.username, password: form.password, display_name: form.display_name, image_url: form.image_url, role: form.role })
      }
      setShowForm(false)
      loadUsers()
    } catch (e) {
      setSaveErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: UserOut, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(t('pages.users.deleteConfirm', { username: u.username }))) return
    try {
      await deleteUser(u.id)
      if (expandedId === u.id) setExpandedId(null)
      loadUsers()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function handleToggleActive(u: UserOut, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await updateUser(u.id, { is_active: !u.is_active })
      loadUsers()
    } catch (e) {
      alert((e as Error).message)
    }
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
        <span style={{ fontSize: '0.83rem', color: '#DA2C38', fontWeight: 600 }}>{t('pages.users.adminRequired')}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {[
          { label: t('pages.users.totalUsers'), value: users.length, color: 'var(--text)' },
          { label: t('pages.users.active'),     value: users.filter(u => u.is_active).length,  color: '#059669' },
          { label: t('pages.users.inactive'),   value: users.filter(u => !u.is_active).length, color: 'var(--muted)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {t('pages.users.accountsHeader')}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '0.5rem', opacity: 0.7 }}>{t('pages.users.clickToInspect')}</span>
          </div>
          <button
            onClick={openCreate}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.35rem 0.75rem', borderRadius: '8px',
              background: 'var(--waf-brand)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              boxShadow: '0 1px 4px rgba(0,148,255,0.25)',
            }}
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {t('pages.users.newUserBtn')}
          </button>
        </div>

        {/* Create / Edit form */}
        {showForm && (
          <div className="card" style={{ padding: '1.1rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.875rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
              {editId ? t('pages.users.editUserTitle') : t('pages.users.newUserTitle')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.875rem' }}>
              {!editId && (
                <div>
                  <label style={labelStyle}>{t('pages.users.usernameLabel')}</label>
                  <input style={inputStyle} value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    autoComplete="off" placeholder="jdoe" />
                </div>
              )}
              <div>
                <label style={labelStyle}>{t('pages.users.displayNameLabel')}</label>
                <input style={inputStyle} value={form.display_name}
                  onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="Jane Doe" />
              </div>
              <div>
                <label style={labelStyle}>{t('pages.users.roleLabel')}</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('pages.users.imageUrlLabel')}</label>
                <input style={inputStyle} value={form.image_url}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://example.com/avatar.png" />
                <div style={{ marginTop: '0.4rem' }}>
                  <label htmlFor={`file-upload-${editId || 'create'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text)' }}>
                    <svg width="14" height="14" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span style={{ color: 'var(--muted)' }}>Upload image</span>
                    <input type="file" accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (ev) => {
                            const result = ev.target?.result as string
                            setForm(f => ({ ...f, image_url: result }))
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                      style={{ display: 'none' }}
                      id={`file-upload-${editId || 'create'}`} />
                  </label>
                </div>
              </div>
              <div>
                <label style={labelStyle}>{editId ? t('pages.users.newPasswordLabel') : t('pages.users.passwordLabel')}</label>
                <input style={{ ...inputStyle, borderColor: form.password && form.password.length < 8 ? '#ef4444' : undefined }} type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="new-password"
                  placeholder={editId ? '••••••••' : 'min. 8 characters'} />
                {form.password && form.password.length < 8 && (
                  <div style={{ fontSize: '0.68rem', color: '#ef4444', marginTop: '0.2rem' }}>
                    {t('pages.users.passwordTooShort')}
                  </div>
                )}
              </div>
              {editId && (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={labelStyle}>{t('pages.users.activeLabel')}</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input type="checkbox" checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    {t('pages.users.accountActiveLabel')}
                  </label>
                </div>
              )}
            </div>
            {saveErr && (
              <div style={{ fontSize: '0.78rem', color: '#DA2C38', marginBottom: '0.65rem', padding: '0.45rem 0.75rem', background: 'rgba(218,44,56,0.06)', borderRadius: '7px', border: '1px solid rgba(218,44,56,0.15)' }}>
                {saveErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleSave}
                disabled={saving || (!editId && (!form.username || !form.password || form.password.length < 8)) || (!!form.password && form.password.length < 8)}
                style={{
                  padding: '0.4rem 1rem', borderRadius: '8px',
                  background: saving ? 'rgba(0,148,255,.4)' : 'var(--waf-brand)', color: '#fff',
                  border: 'none', cursor: saving ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600,
                }}
              >
                {saving ? t('common.saving') : (editId ? t('pages.users.saveChangesBtn') : t('pages.users.createUserBtn'))}
              </button>
              <button onClick={() => setShowForm(false)} style={{
                padding: '0.4rem 1rem', borderRadius: '8px',
                background: 'transparent', color: 'var(--muted)',
                border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.8rem',
              }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}><div className="spinner" /></div>
          ) : error ? (
            <div style={{ padding: '1rem', color: '#DA2C38', fontSize: '0.82rem' }}>{error}</div>
          ) : users.length === 0 ? (
            <div style={{ padding: '1.5rem', color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center' }}>No users found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['', t('pages.users.colUser'), t('pages.users.colRole'), t('pages.users.colStatus'), t('pages.users.colLastLogin'), t('pages.users.colActions')].map(h => (
                    <th key={h} style={{
                      padding: '0.55rem 0.875rem', textAlign: 'left',
                      fontSize: '0.63rem', fontWeight: 700, color: 'var(--muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const isExpanded = expandedId === u.id
                  const isLast = i === users.length - 1
                  const roleC = ROLE_COLOR[u.role] ?? { accent: '#64748b', subtle: 'rgba(100,116,139,0.08)', text: '#64748b' }
                  return (
                    <Fragment key={u.id}>
                      <tr
                        onClick={() => toggleExpand(u.id)}
                        style={{
                          borderBottom: isExpanded ? 'none' : (isLast && !isExpanded ? undefined : '1px solid var(--border)'),
                          opacity: u.is_active ? 1 : 0.6,
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.018)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                      >
                        {/* Chevron + accent */}
                        <td style={{ padding: '0.6rem 0.5rem 0.6rem 0.875rem', width: '28px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <div style={{ width: '3px', height: '24px', borderRadius: '2px', background: isExpanded ? roleC.accent : 'var(--border)', flexShrink: 0, transition: 'background 0.15s' }} />
                            <svg
                              width="11" height="11" fill="none" stroke="var(--muted)" strokeWidth="2.5"
                              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
                              style={{ display: 'block', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </div>
                        </td>

                        {/* User identity cell */}
                        <td style={{ padding: '0.6rem 0.875rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                              background: roleC.subtle,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.65rem', fontWeight: 800, color: roleC.accent,
                              overflow: 'hidden',
                            }}>
                              {u.image_url ? (
                                <img src={u.image_url} alt={u.display_name || u.username} style={{
                                  width: '100%', height: '100%', objectFit: 'cover',
                                }} />
                              ) : (
                                <span>{(u.display_name || u.username).charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--text)', fontSize: '0.83rem' }}>
                                {u.username}
                                {u.id === user?.id && (
                                  <span style={{ fontSize: '0.6rem', color: 'var(--muted)', background: 'var(--bg)', padding: '0.08rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border)', fontWeight: 600 }}>you</span>
                                )}
                              </div>
                              {u.display_name && u.display_name !== u.username && (
                                <div style={{ fontSize: '0.71rem', color: 'var(--muted)', marginTop: '0.05rem' }}>{u.display_name}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.6rem 0.875rem' }}>
                          <RoleBadge role={u.role} />
                        </td>

                        <td style={{ padding: '0.6rem 0.875rem' }}>
                          <span style={{
                            display: 'inline-flex', padding: '0.12rem 0.5rem', borderRadius: '5px',
                            background: u.is_active ? 'rgba(5,150,105,0.09)' : 'rgba(100,116,139,0.09)',
                            color: u.is_active ? '#059669' : '#64748b',
                            fontWeight: 600, fontSize: '0.69rem',
                          }}>
                            {u.is_active ? t('pages.users.active') : t('pages.users.inactive')}
                          </span>
                        </td>

                        <td style={{ padding: '0.6rem 0.875rem', fontSize: '0.77rem' }}>
                          {u.last_login_at ? (
                            <div>
                              <span style={{ color: '#059669', fontWeight: 600 }}>{timeAgo(u.last_login_at)}</span>
                              <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{fmtDate(u.last_login_at)}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted)', opacity: 0.6 }}>{t('pages.users.never')}</span>
                          )}
                        </td>

                        <td style={{ padding: '0.6rem 0.875rem' }} onClick={e => e.stopPropagation()}>
                          {u.id !== user?.id ? (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={e => openEdit(u, e)} style={{ padding: '0.22rem 0.55rem', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>{t('pages.users.editBtn')}</button>
                              <button onClick={e => handleToggleActive(u, e)} style={{ padding: '0.22rem 0.55rem', borderRadius: '6px', background: 'var(--bg)', color: u.is_active ? '#b45309' : '#059669', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                                {u.is_active ? t('pages.users.disableBtn') : t('pages.users.enableBtn')}
                              </button>
                              <button onClick={e => handleDelete(u, e)} style={{ padding: '0.22rem 0.55rem', borderRadius: '6px', background: 'var(--bg)', color: '#DA2C38', border: '1px solid rgba(218,44,56,0.25)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>{t('pages.users.delBtn')}</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && <UserDetailPanel user={u} />}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
