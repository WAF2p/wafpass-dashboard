/**
 * Group → Role Mappings — centralized IdP group-to-WAF++ role resolution table.
 * Mappings are evaluated during SSO login before per-provider role_mapping config.
 * Higher priority = evaluated first; first match wins.
 * Requires admin role.
 */
import { Fragment, useEffect, useState } from 'react'
import {
  fetchGroupMappings, createGroupMapping, updateGroupMapping, deleteGroupMapping,
  type GroupRoleMappingOut, type GroupRoleMappingCreate,
} from '../api'
import { useI18n } from '../i18n'

const ALL_ROLES = ['clevel', 'ciso', 'architect', 'engineer', 'admin'] as const
const ALL_PROVIDERS = ['*', 'oidc', 'saml2'] as const

const ROLE_COLOR: Record<string, { accent: string; subtle: string; text: string }> = {
  admin:    { accent: '#DA2C38', subtle: 'rgba(218,44,56,0.08)',  text: '#DA2C38' },
  engineer: { accent: '#16a34a', subtle: 'rgba(22,163,74,0.08)',  text: '#16a34a' },
  architect:{ accent: '#7c3aed', subtle: 'rgba(124,58,237,0.08)', text: '#7c3aed' },
  ciso:     { accent: '#0078d4', subtle: 'rgba(0,120,212,0.08)',  text: '#0078d4' },
  clevel:   { accent: '#b45309', subtle: 'rgba(180,83,9,0.08)',   text: '#b45309' },
}

const PROVIDER_COLOR: Record<string, { accent: string; subtle: string; text: string }> = {
  '*':    { accent: '#64748b', subtle: 'rgba(100,116,139,0.08)', text: '#64748b' },
  oidc:   { accent: '#0094ff', subtle: 'rgba(0,148,255,0.08)',   text: '#0094ff' },
  saml2:  { accent: '#7c3aed', subtle: 'rgba(124,58,237,0.08)', text: '#7c3aed' },
}

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLOR[role] ?? { subtle: 'rgba(100,116,139,0.08)', text: '#64748b' }
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

function ProviderBadge({ provider }: { provider: string }) {
  const c = PROVIDER_COLOR[provider] ?? PROVIDER_COLOR['*']
  const label = provider === '*' ? 'any' : provider
  return (
    <span style={{
      display: 'inline-flex', padding: '0.12rem 0.5rem', borderRadius: '6px',
      background: c.subtle, color: c.text,
      fontWeight: 600, fontSize: '0.67rem', letterSpacing: '0.03em',
    }}>
      {label}
    </span>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: '8px',
  padding: '0.45rem 0.65rem', fontSize: '0.82rem',
  outline: 'none', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer', appearance: 'auto',
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateForm({ onCreated }: { onCreated: (m: GroupRoleMappingOut) => void }) {
  const { t } = useI18n()
  const blank: GroupRoleMappingCreate = { provider: '*', group_name: '', role: 'clevel', description: '', priority: 0 }
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleSave() {
    if (!form.group_name.trim()) { setErr(t('pages.groupMappings.groupRequired')); return }
    setSaving(true); setErr(null)
    try {
      const created = await createGroupMapping({ ...form, group_name: form.group_name.trim() })
      onCreated(created)
      setForm(blank)
      setOpen(false)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to create mapping') }
    finally { setSaving(false) }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.45rem 1rem', borderRadius: '8px',
          background: 'var(--waf-brand)', color: '#fff',
          border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
          boxShadow: '0 2px 8px rgba(0,148,255,.25)',
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t('pages.groupMappings.addBtn')}
      </button>
    )
  }

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
      padding: '1.25rem 1.5rem',
    }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
        {t('pages.groupMappings.addTitle')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.groupMappings.groupNameLabel')}</span>
          <input
            style={inputStyle} placeholder="e.g. wafpass-admins"
            value={form.group_name}
            onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.groupMappings.providerLabel')}</span>
          <select style={selectStyle} value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
            {ALL_PROVIDERS.map(p => <option key={p} value={p}>{p === '*' ? '* (any)' : p}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.groupMappings.roleLabel')}</span>
          <select style={selectStyle} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.groupMappings.priorityLabel')}</span>
          <input
            type="number" style={inputStyle} placeholder="0"
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSave} disabled={saving}
            style={{
              padding: '0.45rem 1rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem',
              background: 'var(--waf-brand)', color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? t('pages.sso.saving') : t('pages.groupMappings.saveBtn')}
          </button>
          <button
            onClick={() => { setOpen(false); setErr(null); setForm(blank) }}
            style={{
              padding: '0.45rem 0.75rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem',
              background: 'none', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            {t('pages.groupMappings.cancelBtn')}
          </button>
        </div>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.75rem' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.groupMappings.descriptionLabel')}</span>
        <input
          style={inputStyle} placeholder="e.g. Azure AD group for WAF++ platform admins"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
      </label>
      {err && <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#f87171' }}>{err}</div>}
    </div>
  )
}

// ── Edit form (inline in expanded row) ───────────────────────────────────────

function EditForm({ mapping, onSaved, onCancel }: { mapping: GroupRoleMappingOut; onSaved: (m: GroupRoleMappingOut) => void; onCancel: () => void }) {
  const { t } = useI18n()
  const [form, setForm] = useState({
    provider: mapping.provider,
    group_name: mapping.group_name,
    role: mapping.role,
    description: mapping.description,
    priority: mapping.priority,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSave() {
    if (!form.group_name.trim()) { setErr(t('pages.groupMappings.groupRequired')); return }
    setSaving(true); setErr(null)
    try {
      const updated = await updateGroupMapping(mapping.id, { ...form, group_name: form.group_name.trim() })
      onSaved(updated)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.groupMappings.colGroupName')}</span>
          <input style={inputStyle} value={form.group_name} onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.groupMappings.providerLabel')}</span>
          <select style={selectStyle} value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
            {ALL_PROVIDERS.map(p => <option key={p} value={p}>{p === '*' ? '* (any)' : p}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.groupMappings.roleLabel')}</span>
          <select style={selectStyle} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.groupMappings.priorityLabel')}</span>
          <input type="number" style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
        </label>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.groupMappings.descriptionLabel')}</span>
        <input style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </label>
      {err && <div style={{ marginBottom: '0.5rem', fontSize: '0.78rem', color: '#f87171' }}>{err}</div>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={handleSave} disabled={saving}
          style={{ padding: '0.4rem 0.9rem', borderRadius: '7px', fontWeight: 600, fontSize: '0.8rem', background: 'var(--waf-brand)', color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer' }}
        >
          {saving ? t('pages.sso.saving') : t('pages.groupMappings.saveChangesBtn')}
        </button>
        <button
          onClick={onCancel}
          style={{ padding: '0.4rem 0.75rem', borderRadius: '7px', fontWeight: 600, fontSize: '0.8rem', background: 'none', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
        >
          {t('pages.groupMappings.cancelBtn')}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GroupMappingsPage() {
  const { t } = useI18n()
  const [mappings, setMappings] = useState<GroupRoleMappingOut[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchGroupMappings()
      .then(setMappings)
      .catch(e => setErr(e instanceof Error ? e.message : 'Failed to load mappings'))
      .finally(() => setLoading(false))
  }, [])

  function handleCreated(m: GroupRoleMappingOut) {
    setMappings(prev => [m, ...prev])
  }

  function handleSaved(updated: GroupRoleMappingOut) {
    setMappings(prev => prev.map(m => m.id === updated.id ? updated : m))
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    try {
      await deleteGroupMapping(id)
      setMappings(prev => prev.filter(m => m.id !== id))
      setDeletingId(null)
      if (expandedId === id) setExpandedId(null)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to delete') }
  }

  const byProvider = (p: string) => mappings.filter(m => m.provider === p).length

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Info banner */}
      <div style={{
        display: 'flex', gap: '1rem', padding: '0.9rem 1.25rem',
        background: 'rgba(0,148,255,0.06)', border: '1px solid rgba(0,148,255,0.2)',
        borderRadius: '10px', alignItems: 'flex-start',
      }}>
        <svg width="18" height="18" fill="none" stroke="#0094ff" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '1px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6 }}>
          <strong>Centralized role resolution.</strong> During SSO login, group memberships from the IdP token are
          matched against these mappings <em>before</em> the per-provider <code style={{ fontSize: '0.78rem', background: 'rgba(0,148,255,0.08)', padding: '0.05rem 0.3rem', borderRadius: '4px' }}>role_mapping</code> config.
          Higher priority = evaluated first; the first match wins. Provider <strong>*</strong> matches both OIDC and SAML2.
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {[
          { label: t('pages.groupMappings.statTotal'), value: mappings.length, color: 'var(--waf-brand)' },
          { label: t('pages.groupMappings.statAny'), value: byProvider('*'), color: '#64748b' },
          { label: t('pages.groupMappings.statOidc'), value: byProvider('oidc'), color: '#0094ff' },
          { label: t('pages.groupMappings.statSaml2'), value: byProvider('saml2'), color: '#7c3aed' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px',
            padding: '0.75rem 1rem',
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Create form */}
      <CreateForm onCreated={handleCreated} />

      {err && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(218,44,56,0.06)', border: '1px solid rgba(218,44,56,0.2)', borderRadius: '8px', fontSize: '0.82rem', color: '#f87171' }}>
          {err}
        </div>
      )}

      {/* Table */}
      {mappings.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          color: 'var(--muted)', fontSize: '0.85rem',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
        }}>
          {t('pages.groupMappings.emptyState')}
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px 1fr 80px',
            gap: '1rem', padding: '0.6rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700,
          }}>
            <span>{t('pages.groupMappings.colGroupName')}</span>
            <span>{t('pages.groupMappings.colProvider')}</span>
            <span>{t('pages.groupMappings.colMapsTo')}</span>
            <span>{t('pages.groupMappings.colPriority')}</span>
            <span>{t('pages.groupMappings.colDescription')}</span>
            <span />
          </div>

          {/* Rows */}
          {mappings.map((m, idx) => (
            <Fragment key={m.id}>
              <div
                onClick={() => setExpandedId(prev => prev === m.id ? null : m.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px 1fr 80px',
                  gap: '1rem', padding: '0.75rem 1.25rem',
                  borderBottom: idx < mappings.length - 1 || expandedId === m.id ? '1px solid var(--border)' : 'none',
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: expandedId === m.id ? 'rgba(0,148,255,0.03)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <svg
                    width="14" height="14" fill="none" stroke="var(--muted)" viewBox="0 0 24 24"
                    style={{ flexShrink: 0, transition: 'transform 0.15s', transform: expandedId === m.id ? 'rotate(90deg)' : 'none' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.group_name}
                  </span>
                </div>
                <ProviderBadge provider={m.provider} />
                <RoleBadge role={m.role} />
                <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600 }}>{m.priority}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.description || '—'}
                </span>
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setEditingId(m.id); setExpandedId(m.id) }}
                    title={t('pages.groupMappings.editBtn')}
                    style={{ padding: '0.3rem 0.55rem', borderRadius: '6px', background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                  >
                    {t('pages.groupMappings.editBtn')}
                  </button>
                  <button
                    onClick={() => setDeletingId(m.id)}
                    title={t('pages.groupMappings.deleteBtn')}
                    style={{ padding: '0.3rem 0.55rem', borderRadius: '6px', background: 'none', border: '1px solid rgba(218,44,56,0.3)', color: '#f87171', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                  >
                    {t('pages.groupMappings.deleteBtn')}
                  </button>
                </div>
              </div>

              {/* Expanded panel */}
              {expandedId === m.id && (
                <div style={{ padding: '0.75rem 1.25rem 1rem', borderBottom: idx < mappings.length - 1 ? '1px solid var(--border)' : 'none', background: 'rgba(0,0,0,0.015)' }}>
                  {editingId === m.id ? (
                    <EditForm
                      mapping={m}
                      onSaved={handleSaved}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : deletingId === m.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(218,44,56,0.06)', border: '1px solid rgba(218,44,56,0.2)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
                        {t('pages.groupMappings.deleteConfirmText', { group: m.group_name, role: m.role })}
                      </span>
                      <button
                        onClick={() => handleDelete(m.id)}
                        style={{ padding: '0.35rem 0.8rem', borderRadius: '7px', background: '#DA2C38', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      >
                        {t('pages.groupMappings.confirmDeleteBtn')}
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        style={{ padding: '0.35rem 0.7rem', borderRadius: '7px', background: 'none', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                      >
                        {t('pages.groupMappings.cancelBtn')}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.2rem' }}>{t('pages.groupMappings.fieldId')}</div>
                        <code style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{m.id}</code>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.2rem' }}>{t('pages.groupMappings.fieldCreated')}</div>
                        {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.2rem' }}>{t('pages.groupMappings.fieldCreatedBy')}</div>
                        {m.created_by ?? '—'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
