import { useState, useEffect, useCallback } from 'react'
import { appendAuditEvent } from '../audit'
import { fetchRisks, upsertRisk, deleteRisk } from '../api'

export interface RiskAcceptance {
  id: string
  reason: string
  approver: string
  owner: string
  rfc: string
  jira_link: string
  other_link: string
  notes: string
  risk_level: 'accepted' | 'mitigated'
  residual_risk: 'low' | 'medium' | 'high'
  expires: string
  accepted_at: string
  project?: string
}

const STORAGE_KEY = 'wafpass_risk_acceptances'

function loadLocal(): Record<string, RiskAcceptance> {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? JSON.parse(s) : {}
  } catch { return {} }
}

function saveLocal(d: Record<string, RiskAcceptance>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) } catch {}
}

const EMPTY: Omit<RiskAcceptance, 'id'> = {
  reason: '', approver: '', owner: '', rfc: '', jira_link: '', other_link: '',
  notes: '', risk_level: 'accepted', residual_risk: 'medium', expires: '',
  accepted_at: new Date().toISOString().slice(0, 10),
  project: '',
}

const RESIDUAL_COLOR: Record<string, string> = {
  low: '#22c55e', medium: '#eab308', high: '#DA2C38',
}

const LEVEL_COLOR: Record<string, string> = {
  accepted: '#a78bfa', mitigated: '#22c55e',
}

type SyncStatus = 'loading' | 'synced' | 'offline' | 'saving' | 'error'

interface Props {
  controls: { id: string; title: string }[]
}

export default function RiskAcceptancePage({ controls }: Props) {
  const [data, setData] = useState<Record<string, RiskAcceptance>>(loadLocal)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [idInput, setIdInput] = useState('')
  const [form, setForm] = useState<Omit<RiskAcceptance, 'id'>>(EMPTY)
  const [search, setSearch] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const [syncError, setSyncError] = useState<string | null>(null)

  // Fetch from server on mount
  useEffect(() => {
    setSyncStatus('loading')
    fetchRisks()
      .then(records => {
        const map: Record<string, RiskAcceptance> = {}
        for (const r of records) {
          map[r.id] = {
            id: r.id, reason: r.reason, approver: r.approver, owner: r.owner,
            rfc: r.rfc, jira_link: r.jira_link, other_link: r.other_link,
            notes: r.notes, risk_level: r.risk_level as RiskAcceptance['risk_level'],
            residual_risk: r.residual_risk as RiskAcceptance['residual_risk'],
            expires: r.expires, accepted_at: r.accepted_at, project: r.project,
          }
        }
        setData(map)
        saveLocal(map)
        setSyncStatus('synced')
      })
      .catch((e: unknown) => {
        setSyncStatus('offline')
        if (e instanceof TypeError) {
          setSyncError(`Cannot reach server — using local cache. Check the server URL in Settings.`)
        } else {
          setSyncError(`Server error loading risks (${e instanceof Error ? e.message : String(e)}) — using local cache.`)
        }
      })
  }, [])

  const entries = Object.values(data)
    .filter(r => !search || r.id.toLowerCase().includes(search.toLowerCase()) || r.reason.toLowerCase().includes(search.toLowerCase()) || r.owner.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.accepted_at.localeCompare(a.accepted_at))

  function openAdd() {
    setEditId(null)
    setIdInput('')
    setForm(EMPTY)
    setShowModal(true)
  }

  function openEdit(r: RiskAcceptance) {
    setEditId(r.id)
    setIdInput(r.id)
    const { id: _, ...rest } = r
    setForm(rest)
    setShowModal(true)
  }

  const submit = useCallback(async () => {
    const id = editId ?? idInput.trim()
    if (!id) return
    const existing = data[id]
    const record: RiskAcceptance = { id, ...form }
    setSyncStatus('saving')
    setSyncError(null)
    try {
      await upsertRisk(id, {
        reason: form.reason, approver: form.approver, owner: form.owner,
        rfc: form.rfc, jira_link: form.jira_link, other_link: form.other_link,
        notes: form.notes, risk_level: form.risk_level, residual_risk: form.residual_risk,
        expires: form.expires, accepted_at: form.accepted_at, project: form.project ?? '',
      })
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
      setSyncError(e instanceof TypeError
        ? `Cannot reach server — saved locally only. Check the server URL in Settings.`
        : `Server error saving risk (${e instanceof Error ? e.message : String(e)}) — saved locally only.`)
    }
    appendAuditEvent({
      actor: form.approver || form.owner || 'unknown',
      category: 'risk',
      action: existing ? 'risk_updated' : 'risk_created',
      subject_id: id,
      subject_type: 'risk_acceptance',
      summary: existing
        ? `Risk acceptance updated for ${id} — level: ${form.risk_level}, residual: ${form.residual_risk}, approver: ${form.approver}`
        : `Risk acceptance recorded for ${id} — level: ${form.risk_level}, approver: ${form.approver}, expires: ${form.expires}`,
      before: existing ?? undefined,
      after: record,
    })
    setData(prev => {
      const next = { ...prev, [id]: record }
      saveLocal(next)
      return next
    })
    setShowModal(false)
  }, [editId, idInput, form, data])

  const remove = useCallback(async (id: string) => {
    const existing = data[id]
    setSyncStatus('saving')
    setSyncError(null)
    try {
      await deleteRisk(id)
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('offline')
      setSyncError(e instanceof TypeError
        ? `Cannot reach server — removed locally only. Check the server URL in Settings.`
        : `Server error deleting risk (${e instanceof Error ? e.message : String(e)}) — removed locally only.`)
    }
    if (existing) {
      appendAuditEvent({
        actor: existing.approver || existing.owner || 'unknown',
        category: 'risk',
        action: 'risk_deleted',
        subject_id: id,
        subject_type: 'risk_acceptance',
        summary: `Risk acceptance removed for ${id} (approver: ${existing.approver}, level: ${existing.risk_level})`,
        before: existing,
      })
    }
    setData(prev => {
      const d = { ...prev }
      delete d[id]
      saveLocal(d)
      return d
    })
  }, [data])

  const inputStyle = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.82rem',
    outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }

  const isExpired = (expires: string) => expires && new Date(expires) < new Date()

  const syncPill = (() => {
    if (syncStatus === 'loading') return { label: 'Loading…', color: '#94a3b8' }
    if (syncStatus === 'saving') return { label: 'Saving…', color: '#0094ff' }
    if (syncStatus === 'synced') return { label: 'Synced', color: '#22c55e' }
    if (syncStatus === 'offline') return { label: 'Offline — local cache', color: '#eab308' }
    return { label: 'Sync error', color: '#DA2C38' }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={openAdd}
          style={{
            background: 'var(--waf-brand)', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          + Record Risk Acceptance
        </button>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by ID, reason, owner…"
          style={{ ...inputStyle, width: '220px' }}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{entries.length} record{entries.length !== 1 ? 's' : ''}</span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, color: syncPill.color,
          background: `${syncPill.color}18`, border: `1px solid ${syncPill.color}40`,
          borderRadius: '999px', padding: '0.2rem 0.7rem',
        }}>
          {syncPill.label}
        </span>
      </div>

      {/* Sync error banner */}
      {syncError && (
        <div style={{
          background: 'rgba(218,44,56,.08)', border: '1px solid rgba(218,44,56,.3)',
          borderRadius: '8px', padding: '0.6rem 0.875rem', fontSize: '0.78rem', color: '#DA2C38',
        }}>
          {syncError}
        </div>
      )}


      {syncStatus === 'loading' ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>No risk acceptances recorded</div>
          <div style={{ fontSize: '0.78rem' }}>
            Document formal risk acceptance decisions with approver, expiry, and linked tickets.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map(r => {
            const expired = isExpired(r.expires)
            return (
              <div key={r.id} className="card" style={{ borderLeft: `3px solid ${expired ? '#DA2C38' : LEVEL_COLOR[r.risk_level] ?? '#94a3b8'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <code style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--waf-brand)' }}>{r.id}</code>
                      <span style={{
                        padding: '0.08rem 0.45rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700,
                        background: `${LEVEL_COLOR[r.risk_level]}22`, color: LEVEL_COLOR[r.risk_level],
                      }}>
                        {r.risk_level}
                      </span>
                      <span style={{
                        padding: '0.08rem 0.45rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700,
                        background: `${RESIDUAL_COLOR[r.residual_risk]}22`, color: RESIDUAL_COLOR[r.residual_risk],
                      }}>
                        residual: {r.residual_risk}
                      </span>
                      {expired && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#DA2C38', background: 'rgba(218,44,56,.15)', padding: '0.08rem 0.4rem', borderRadius: '999px' }}>
                          EXPIRED
                        </span>
                      )}
                      {r.project && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--muted)', background: 'var(--bg-secondary)', borderRadius: '4px', padding: '0.08rem 0.4rem' }}>
                          {r.project}
                        </span>
                      )}
                    </div>

                    {r.reason && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.35rem', lineHeight: 1.5 }}>
                        {r.reason}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
                      {r.approver && <span>Approver: <strong style={{ color: 'var(--text)' }}>{r.approver}</strong></span>}
                      {r.owner && <span>Owner: <strong style={{ color: 'var(--text)' }}>{r.owner}</strong></span>}
                      {r.rfc && <span>RFC: <strong style={{ color: 'var(--text)' }}>{r.rfc}</strong></span>}
                      {r.accepted_at && <span>Accepted: {r.accepted_at}</span>}
                      {r.expires && <span>Expires: {r.expires}</span>}
                    </div>

                    {(r.jira_link || r.other_link) && (
                      <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.75rem', fontSize: '0.72rem' }}>
                        {r.jira_link && (
                          <a href={r.jira_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--waf-brand)' }}>
                            Jira ticket
                          </a>
                        )}
                        {r.other_link && (
                          <a href={r.other_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--waf-brand)' }}>
                            Reference
                          </a>
                        )}
                      </div>
                    )}

                    {r.notes && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                        {r.notes}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(r)}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.72rem', cursor: 'pointer', color: 'var(--muted)' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void remove(r.id)}
                      style={{ background: 'none', border: '1px solid rgba(218,44,56,.3)', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.72rem', cursor: 'pointer', color: '#DA2C38' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 99 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            padding: '1.5rem', width: '520px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
            zIndex: 100, display: 'flex', flexDirection: 'column', gap: '0.875rem',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {editId ? 'Edit Risk Acceptance' : 'Record Risk Acceptance'}
            </h2>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Control *</label>
              {editId ? (
                <input value={idInput} disabled style={{ ...inputStyle, opacity: 0.6 }} />
              ) : (
                <select value={idInput} onChange={e => setIdInput(e.target.value)} style={inputStyle}>
                  <option value="">— select a control —</option>
                  {controls.map(c => (
                    <option key={c.id} value={c.id}>{c.id} — {c.title}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Reason</label>
              <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                placeholder="Why is this risk being accepted?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Approver</label>
                <input value={form.approver} onChange={e => setForm({ ...form, approver: e.target.value })} placeholder="Name / role" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Owner</label>
                <input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder="Team or person" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>RFC</label>
                <input value={form.rfc} onChange={e => setForm({ ...form, rfc: e.target.value })} placeholder="RFC-2025-001" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Accepted At</label>
                <input type="date" value={form.accepted_at} onChange={e => setForm({ ...form, accepted_at: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Expires</label>
                <input type="date" value={form.expires} onChange={e => setForm({ ...form, expires: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Risk Level</label>
                <select value={form.risk_level} onChange={e => setForm({ ...form, risk_level: e.target.value as RiskAcceptance['risk_level'] })} style={inputStyle}>
                  <option value="accepted">Accepted</option>
                  <option value="mitigated">Mitigated</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Residual Risk</label>
                <select value={form.residual_risk} onChange={e => setForm({ ...form, residual_risk: e.target.value as RiskAcceptance['residual_risk'] })} style={inputStyle}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Jira Link</label>
              <input value={form.jira_link} onChange={e => setForm({ ...form, jira_link: e.target.value })} placeholder="https://jira.example.com/browse/…" style={inputStyle} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Other Reference Link</label>
              <input value={form.other_link} onChange={e => setForm({ ...form, other_link: e.target.value })} placeholder="https://…" style={inputStyle} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional context…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 1rem', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--muted)' }}>
                Cancel
              </button>
              <button
                onClick={() => void submit()}
                disabled={!idInput.trim()}
                style={{
                  background: idInput.trim() ? 'var(--waf-brand)' : '#94a3b8', color: '#fff',
                  border: 'none', borderRadius: '8px', padding: '0.45rem 1rem',
                  fontSize: '0.82rem', fontWeight: 700, cursor: idInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {editId ? 'Save Changes' : 'Record'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
