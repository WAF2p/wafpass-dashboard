/**
 * Access & Roles — role definitions, auth provider roadmap, and admin user management.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { fetchUsers, createUser, updateUser, deleteUser, type UserOut } from '../api'

// ── Role definitions ──────────────────────────────────────────────────────────

const ROLES = [
  {
    id: 'clevel',
    label: 'C-Level',
    subtitle: 'CEO · COO · CFO · CTO · Board',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.30)',
    access: 'Read-only',
    accessColor: '#64748b',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
    description: 'Strategic leadership. Business risk posture, regulatory status, financial impact, and board-level compliance reporting.',
    pages: [
      { name: 'Dashboard',         note: 'Overall WAF++ risk posture' },
      { name: 'Compliance Matrix',  note: 'Regulatory framework coverage' },
      { name: 'Cost Impact',        note: 'Financial exposure from failing controls' },
      { name: 'Gap Analysis',       note: 'Shortest path to full compliance' },
    ],
    restriction: 'No scan or remediation actions.',
  },
  {
    id: 'ciso',
    label: 'CISO',
    subtitle: 'Chief Information Security Officer',
    color: '#0094ff',
    bg: 'rgba(0,148,255,0.08)',
    border: 'rgba(0,148,255,0.28)',
    access: 'Governance R/W',
    accessColor: '#0094ff',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
      </svg>
    ),
    description: 'Security governance and accountability. Manages risk decisions, waiver approvals, and audit evidence for compliance frameworks.',
    pages: [
      { name: 'Risk Acceptance',   note: 'Formal risk decisions with approver & expiry' },
      { name: 'Waivers',           note: 'Suppress controls with justification' },
      { name: 'Skipped Controls',  note: 'Coverage gap visibility' },
      { name: 'Audit Log',         note: 'Tamper-evident governance record' },
      { name: 'Evidence Package',  note: 'SOC2 / ISO27001 artifacts' },
      { name: 'Deployed Regions',  note: 'Data residency & sovereignty' },
    ],
    restriction: 'Cannot trigger scans.',
  },
  {
    id: 'architect',
    label: 'Architect',
    subtitle: 'Solutions · Cloud · Platform Architect',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.28)',
    access: 'Design R/W',
    accessColor: '#8b5cf6',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    description: 'Infrastructure design. Control coverage, resource topology, attack surfaces, and module-level compliance for architecture decisions.',
    pages: [
      { name: 'Controls Catalogue', note: 'Browse, filter & author controls' },
      { name: 'Exploit Paths',      note: 'Attack chain from internet surfaces' },
      { name: 'Blast Radius',       note: 'Failure propagation analysis' },
      { name: 'Dependency Graph',   note: 'Full resource topology' },
      { name: 'Module Scores',      note: 'Per-module pass rate & score drag' },
      { name: 'Changes & Drift',    note: 'Plan changes and control regressions' },
      { name: 'Sandbox',            note: 'Live HCL evaluation' },
    ],
    restriction: 'Cannot approve governance records.',
  },
  {
    id: 'engineer',
    label: 'Engineer',
    subtitle: 'DevOps · DevSecOps · Platform · App Engineer',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.28)',
    access: 'Full Scan R/W',
    accessColor: '#22c55e',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    description: 'Hands-on engineering. Fix prioritisation, secret hygiene, and the full scan lifecycle from trigger to resolution.',
    pages: [
      { name: 'Findings',           note: 'Per-check results with remediation' },
      { name: 'Secret Scanner',     note: 'Hardcoded credentials in IaC' },
      { name: 'Remediation Sprint', note: 'Prioritised fix queue' },
      { name: 'Run Scan',           note: 'Trigger scans or generate CLI command' },
      { name: 'Run History',        note: 'All recorded runs with stage & branch' },
      { name: 'Run Comparison',     note: 'Finding-level diff between runs' },
    ],
    restriction: 'Cannot approve risk acceptances or manage users.',
  },
  {
    id: 'admin',
    label: 'Admin',
    subtitle: 'System Administrator',
    color: '#DA2C38',
    bg: 'rgba(218,44,56,0.08)',
    border: 'rgba(218,44,56,0.30)',
    access: 'Full Access',
    accessColor: '#DA2C38',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        <path d="M16 11l1.5 1.5L21 9" />
      </svg>
    ),
    description: 'Full system access plus user lifecycle management. Exclusive right to create accounts, reset passwords, assign any role, and grant or revoke admin privileges.',
    pages: [
      { name: 'All pages',        note: 'Inherits full engineer access' },
      { name: 'User Management',  note: 'Create, edit, activate/deactivate, delete users' },
      { name: 'Role Assignment',  note: 'Exclusive right to grant the admin role' },
    ],
    restriction: 'Only admins can modify other admin accounts.',
  },
]

// ── Auth providers ────────────────────────────────────────────────────────────

const AUTH_PROVIDERS = [
  {
    id: 'entraid',
    label: 'Microsoft Entra ID',
    sublabel: 'Azure AD · Microsoft 365',
    color: '#0078d4',
    bg: 'rgba(0,120,212,0.08)',
    border: 'rgba(0,120,212,0.25)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
    protocol: 'OAuth 2.0 · OIDC',
    notes: ['Group → role mapping via tenant config', 'MFA & Conditional Access support', 'Service principal for CI/CD pipelines'],
  },
  {
    id: 'localdc',
    label: 'Local Domain Controller',
    sublabel: 'Active Directory · LDAP / Kerberos',
    color: '#475569',
    bg: 'rgba(71,85,105,0.08)',
    border: 'rgba(71,85,105,0.25)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
    protocol: 'LDAPS · Kerberos',
    notes: ['LDAP over TLS with certificate pinning', 'AD security group → role mapping', 'Kerberos pass-through for domain clients'],
  },
  {
    id: 'keycloak',
    label: 'Keycloak',
    sublabel: 'Self-hosted OIDC / SAML Identity Provider',
    color: '#4a90d9',
    bg: 'rgba(74,144,217,0.08)',
    border: 'rgba(74,144,217,0.25)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l10 6v8l-10 6L2 16V8l10-6z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
    protocol: 'OIDC · SAML 2.0',
    notes: ['Realm role → WAF++ role via JWT claims', 'SAML 2.0 fallback for legacy IdP federations', 'Client credentials for service accounts'],
  },
]

// ── Implementation notes ──────────────────────────────────────────────────────

const IMPL_NOTES = [
  { label: 'Current state',         body: 'Phase 1 live — local JWT authentication with bcrypt passwords. Roles are enforced on every API request by wafpass-server. The dashboard sidebar adapts to the signed-in user\'s role.' },
  { label: 'Role claim source',     body: 'In Phase 1 roles are stored in the users table. In future LDAP/OIDC phases, roles will come from the IdP — JWT claim, LDAP group, or SAML attribute — mapped server-side.' },
  { label: 'Enforcement boundary',  body: 'wafpass-server enforces roles via middleware on every request. The dashboard reflects roles returned by the server after token exchange — no role logic lives in the frontend.' },
  { label: 'Session model',         body: 'Short-lived JWT access tokens (60 min default) with silent refresh via a long-lived refresh token. Both stored in localStorage for session persistence across page reloads.' },
  { label: 'Multi-provider',        body: 'One primary provider per deployment, configured via environment variables. Provider federation (e.g. Entra ID + Keycloak in parallel) is out of scope for v1.' },
  { label: 'Service accounts',      body: 'CI/CD pipelines use the X-Api-Key header (set WAFPASS_API_KEY on the server), bypassing the interactive browser login flow entirely.' },
]

// ── Role badge colours ────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  admin:    { bg: 'rgba(218,44,56,0.15)',   text: '#DA2C38', border: 'rgba(218,44,56,0.35)' },
  engineer: { bg: 'rgba(34,197,94,0.12)',   text: '#16a34a', border: 'rgba(34,197,94,0.30)' },
  architect:{ bg: 'rgba(139,92,246,0.12)',  text: '#7c3aed', border: 'rgba(139,92,246,0.30)' },
  ciso:     { bg: 'rgba(0,148,255,0.12)',   text: '#0094ff', border: 'rgba(0,148,255,0.30)' },
  clevel:   { bg: 'rgba(245,158,11,0.12)',  text: '#b45309', border: 'rgba(245,158,11,0.30)' },
}

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLOR[role] ?? { bg: 'rgba(100,116,139,.1)', text: '#64748b', border: 'rgba(100,116,139,.2)' }
  return (
    <span style={{
      display: 'inline-flex', padding: '0.1rem 0.5rem', borderRadius: '999px',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontWeight: 700, fontSize: '0.68rem', whiteSpace: 'nowrap',
    }}>
      {role}
    </span>
  )
}

// ── User management (admin only) ──────────────────────────────────────────────

const ALL_ROLES = ['clevel', 'ciso', 'architect', 'engineer', 'admin'] as const

interface UserFormState {
  username: string
  display_name: string
  role: string
  password: string
  is_active: boolean
}

const EMPTY_FORM: UserFormState = { username: '', display_name: '', role: 'engineer', password: '', is_active: true }

function UserManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers]       = useState<UserOut[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [editId, setEditId]     = useState<string | null>(null)   // null = create mode
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<UserFormState>(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [saveErr, setSaveErr]   = useState<string | null>(null)

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

  function openEdit(u: UserOut) {
    setEditId(u.id)
    setForm({ username: u.username, display_name: u.display_name, role: u.role, password: '', is_active: u.is_active })
    setSaveErr(null)
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveErr(null)
    try {
      if (editId) {
        const payload: { display_name?: string; role?: string; is_active?: boolean; password?: string } = {
          display_name: form.display_name,
          role: form.role,
          is_active: form.is_active,
        }
        if (form.password) payload.password = form.password
        await updateUser(editId, payload)
      } else {
        await createUser({ username: form.username, password: form.password, display_name: form.display_name, role: form.role })
      }
      setShowForm(false)
      loadUsers()
    } catch (e) {
      setSaveErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u: UserOut) {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return
    try {
      await deleteUser(u.id)
      loadUsers()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function handleToggleActive(u: UserOut) {
    try {
      await updateUser(u.id, { is_active: !u.is_active })
      loadUsers()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.4rem 0.6rem', borderRadius: '7px',
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: '0.82rem', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem',
    display: 'block',
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          User Management
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.3rem 0.7rem', borderRadius: '7px',
            background: 'var(--waf-brand)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
          }}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New User
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="card" style={{ padding: '1rem', marginBottom: '0.75rem', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem' }}>
            {editId ? 'Edit User' : 'Create New User'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {!editId && (
              <div>
                <label style={labelStyle}>Username *</label>
                <input
                  style={inputStyle}
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  autoComplete="off"
                  placeholder="jdoe"
                />
              </div>
            )}
            <div>
              <label style={labelStyle}>Display Name</label>
              <input
                style={inputStyle}
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                {ALL_ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{editId ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input
                style={inputStyle}
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
                placeholder={editId ? '••••••••' : 'min. 8 characters'}
              />
            </div>
            {editId && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={labelStyle}>Active</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  />
                  Account active
                </label>
              </div>
            )}
          </div>
          {saveErr && (
            <div style={{ fontSize: '0.78rem', color: '#f87171', marginBottom: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(248,113,113,.08)', borderRadius: '6px', border: '1px solid rgba(248,113,113,.2)' }}>
              {saveErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSave}
              disabled={saving || (!editId && (!form.username || !form.password))}
              style={{
                padding: '0.35rem 0.875rem', borderRadius: '7px',
                background: saving ? 'rgba(0,148,255,.4)' : 'var(--waf-brand)', color: '#fff',
                border: 'none', cursor: saving ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 600,
              }}
            >
              {saving ? 'Saving…' : (editId ? 'Save Changes' : 'Create User')}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: '0.35rem 0.875rem', borderRadius: '7px',
                background: 'transparent', color: 'var(--muted)',
                border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.8rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /></div>
        ) : error ? (
          <div style={{ padding: '1rem', color: '#f87171', fontSize: '0.82rem' }}>{error}</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.82rem' }}>No users found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['Username', 'Display Name', 'Role', 'Provider', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.875rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border)' : undefined, opacity: u.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: '0.55rem 0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(0,148,255,.12)', border: '1px solid rgba(0,148,255,.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.62rem', fontWeight: 700, color: 'var(--waf-brand)',
                      }}>
                        {(u.display_name || u.username).charAt(0).toUpperCase()}
                      </div>
                      {u.username}
                      {u.id === currentUserId && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--muted)', background: 'rgba(100,116,139,.1)', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>you</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '0.55rem 0.875rem', color: 'var(--muted)' }}>{u.display_name || '—'}</td>
                  <td style={{ padding: '0.55rem 0.875rem' }}><RoleBadge role={u.role} /></td>
                  <td style={{ padding: '0.55rem 0.875rem', color: 'var(--muted)', fontSize: '0.75rem' }}>{u.auth_provider}</td>
                  <td style={{ padding: '0.55rem 0.875rem' }}>
                    <span style={{
                      display: 'inline-flex', padding: '0.1rem 0.45rem', borderRadius: '999px',
                      background: u.is_active ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.1)',
                      color: u.is_active ? '#16a34a' : '#64748b',
                      fontWeight: 600, fontSize: '0.68rem',
                    }}>
                      {u.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '0.55rem 0.875rem' }}>
                    {u.id !== currentUserId && (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => openEdit(u)}
                          title="Edit"
                          style={{ padding: '0.25rem 0.55rem', borderRadius: '6px', background: 'rgba(0,148,255,.1)', color: '#0094ff', border: '1px solid rgba(0,148,255,.2)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          style={{ padding: '0.25rem 0.55rem', borderRadius: '6px', background: u.is_active ? 'rgba(245,158,11,.1)' : 'rgba(34,197,94,.1)', color: u.is_active ? '#b45309' : '#16a34a', border: `1px solid ${u.is_active ? 'rgba(245,158,11,.25)' : 'rgba(34,197,94,.25)'}`, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="Delete"
                          style={{ padding: '0.25rem 0.55rem', borderRadius: '6px', background: 'rgba(218,44,56,.08)', color: '#DA2C38', border: '1px solid rgba(218,44,56,.2)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccessRolesPage() {
  const { role, user } = useAuth()
  const isAdmin = role === 'admin'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Top banner ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        padding: '0.875rem 1.1rem', borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(34,197,94,0.07) 0%, rgba(0,148,255,0.05) 100%)',
        border: '1px solid rgba(34,197,94,0.22)',
      }}>
        <div style={{
          flexShrink: 0, width: '32px', height: '32px', borderRadius: '8px',
          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a',
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>
            Phase 1 authentication active.{' '}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            Local JWT auth is live. Roles are enforced on every API request. Entra ID, LDAP, and Keycloak support planned for future phases.
          </span>
        </div>
        <span style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center',
          padding: '0.18rem 0.65rem', borderRadius: '999px',
          background: 'rgba(34,197,94,0.12)', color: '#16a34a',
          fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap',
          border: '1px solid rgba(34,197,94,0.25)',
        }}>
          Auth: Phase 1 Live
        </span>
      </div>

      {/* ── User Management (admin only) ───────────────────────────────────── */}
      {isAdmin && user && <UserManagement currentUserId={user.id} />}

      {/* ── Roles & Navigation Access ──────────────────────────────────────── */}
      <section>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
          Roles &amp; Navigation Access
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
          {ROLES.map(role => (
            <div key={role.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              {/* Role header */}
              <div style={{
                padding: '0.75rem 0.875rem',
                background: role.bg,
                borderBottom: `1px solid ${role.border}`,
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              }}>
                <div style={{
                  flexShrink: 0, width: '32px', height: '32px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.7)', border: `1px solid ${role.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: role.color,
                }}>
                  {role.icon}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: role.color }}>{role.label}</span>
                    <span style={{
                      display: 'inline-flex', padding: '0.1rem 0.45rem', borderRadius: '999px',
                      background: `${role.accessColor}18`, color: role.accessColor,
                      fontWeight: 600, fontSize: '0.65rem', whiteSpace: 'nowrap',
                    }}>
                      {role.access}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.1rem', lineHeight: 1.3 }}>{role.subtitle}</div>
                </div>
              </div>

              {/* Description */}
              <div style={{ padding: '0.6rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
                <p style={{ margin: 0, fontSize: '0.77rem', color: 'var(--muted)', lineHeight: 1.5 }}>{role.description}</p>
              </div>

              {/* Page list */}
              <div style={{ flex: 1, padding: '0.5rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {role.pages.map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                    <svg width="10" height="10" fill="none" stroke={role.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '1px' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.note}</span>
                  </div>
                ))}
              </div>

              {/* Footer restriction */}
              <div style={{
                padding: '0.4rem 0.875rem',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg)',
                fontSize: '0.69rem', color: 'var(--muted)',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}>
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {role.restriction}
              </div>

            </div>
          ))}
        </div>
      </section>

      {/* ── Auth providers + Impl notes side-by-side ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'start' }}>

        {/* Auth providers */}
        <section>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
            Planned Authentication Providers
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {AUTH_PROVIDERS.map(p => (
              <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  padding: '0.65rem 0.875rem',
                  borderBottom: '1px solid var(--border)',
                  background: p.bg,
                  display: 'flex', alignItems: 'center', gap: '0.65rem',
                }}>
                  <div style={{
                    flexShrink: 0, width: '30px', height: '30px', borderRadius: '7px',
                    background: 'rgba(255,255,255,0.65)', border: `1px solid ${p.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color,
                  }}>
                    {p.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.83rem', color: p.color }}>{p.label}</span>
                      <span style={{
                        display: 'inline-flex', padding: '0.1rem 0.45rem', borderRadius: '999px',
                        background: 'rgba(100,116,139,0.10)', color: '#64748b',
                        fontWeight: 600, fontSize: '0.62rem',
                      }}>
                        Roadmap
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{p.sublabel} · <strong style={{ color: 'var(--text)' }}>{p.protocol}</strong></div>
                  </div>
                </div>
                <ul style={{ margin: 0, padding: '0.5rem 0.875rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
                  {p.notes.map(note => (
                    <li key={note} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.76rem', color: 'var(--text)' }}>
                      <span style={{ flexShrink: 0, color: p.color, fontWeight: 700, lineHeight: 1.4 }}>›</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Implementation notes */}
        <section>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
            Implementation Notes
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {IMPL_NOTES.map((note, i) => (
              <div key={note.label} style={{
                display: 'grid', gridTemplateColumns: '130px 1fr', gap: '0.75rem',
                padding: '0.65rem 0.875rem',
                borderBottom: i < IMPL_NOTES.length - 1 ? '1px solid var(--border)' : undefined,
                alignItems: 'start',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', paddingTop: '0.05rem', lineHeight: 1.35 }}>
                  {note.label}
                </div>
                <div style={{ fontSize: '0.77rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {note.body}
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

    </div>
  )
}
