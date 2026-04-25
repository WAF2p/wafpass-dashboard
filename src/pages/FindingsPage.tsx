import { useState, useMemo, useCallback } from 'react'
import { Finding, RunDetail, upsertWaiver } from '../api'
import { appendAuditEvent } from '../audit'

interface Props { run: RunDetail }

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#22c55e',
}

const STATUS_COLOR: Record<string, string> = {
  PASS:   '#22c55e',
  FAIL:   '#DA2C38',
  SKIP:   '#94a3b8',
  WAIVED: '#a78bfa',
  ERROR:  '#f97316',
}

function rowKey(f: Finding) { return `${f.check_id}||${f.resource}` }

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.15rem 0.55rem', borderRadius: '999px',
      background: `${color}22`, color, fontSize: '0.72rem', fontWeight: 700,
    }}>
      {label}
    </span>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ finding, onClose }: { finding: Finding; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '600px', maxWidth: '92vw', maxHeight: '85vh',
      background: 'var(--surface)', borderRadius: '14px',
      boxShadow: '0 24px 64px rgba(15,23,42,.18)',
      display: 'flex', flexDirection: 'column', zIndex: 100,
      overflowY: 'auto',
    }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{finding.check_title || finding.check_id}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem', fontFamily: 'monospace' }}>{finding.check_id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0.25rem', flexShrink: 0, fontSize: '1.1rem' }}>✕</button>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Pill label={finding.status} color={STATUS_COLOR[finding.status] ?? '#94a3b8'} />
          <Pill label={finding.severity} color={SEVERITY_COLOR[finding.severity] ?? '#94a3b8'} />
          {finding.pillar && <Pill label={finding.pillar} color="var(--waf-brand)" />}
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Resource</div>
          <code style={{ fontSize: '0.8rem', color: 'var(--text)', wordBreak: 'break-all' }}>{finding.resource}</code>
        </div>
        {finding.message && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Message</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{finding.message}</p>
          </div>
        )}
        {finding.remediation && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Remediation</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{finding.remediation}</p>
          </div>
        )}
        {finding.example && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Example Fix</div>
            <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem', overflowX: 'auto', margin: 0, color: 'var(--text)', lineHeight: 1.6 }}>
              {JSON.stringify(finding.example, null, 2)}
            </pre>
          </div>
        )}
        {finding.control_id && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Control ID</div>
            <code style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{finding.control_id}</code>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Waive modal ──────────────────────────────────────────────────────────────

interface WaiveModalProps {
  controlIds: string[]
  project: string
  onClose: () => void
  onDone: () => void
}

function WaiveModal({ controlIds, project, onClose, onDone }: WaiveModalProps) {
  const [reason, setReason] = useState('')
  const [owner, setOwner] = useState('')
  const [expires, setExpires] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function submit() {
    if (!reason.trim()) return
    setStatus('saving')
    try {
      for (const id of controlIds) {
        await upsertWaiver(id, { reason: reason.trim(), owner: owner.trim(), expires: expires.trim(), project })
        appendAuditEvent({
          actor: owner.trim() || 'user',
          category: 'waiver',
          action: 'waiver_created',
          subject_id: id,
          subject_type: 'waiver',
          summary: `Bulk waiver: ${reason.trim()}`,
          after: { id, reason, owner, expires, project },
        })
      }
      // keep localStorage in sync
      try {
        const stored = JSON.parse(localStorage.getItem('wafpass_waivers') ?? '{}') as Record<string, unknown>
        for (const id of controlIds) stored[id] = { id, reason: reason.trim(), owner: owner.trim(), expires: expires.trim(), project }
        localStorage.setItem('wafpass_waivers', JSON.stringify(stored))
      } catch {}
      setStatus('done')
      setTimeout(onDone, 900)
    } catch (e) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.45rem 0.7rem', borderRadius: '8px',
    border: '1px solid var(--border)', background: 'var(--input-bg)',
    color: 'var(--text)', fontSize: '0.82rem', boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: 480, maxWidth: '92vw', background: 'var(--surface)', borderRadius: '14px',
      boxShadow: '0 24px 64px rgba(15,23,42,.2)', zIndex: 200,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
            Waive {controlIds.length} control{controlIds.length !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
            Creates or updates a waiver entry for each selected control
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.1rem', padding: '0.25rem' }}>✕</button>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

        {/* Affected controls preview */}
        <div style={{ maxHeight: 80, overflowY: 'auto', background: 'var(--bg)', borderRadius: 7, padding: '0.5rem 0.75rem', border: '1px solid var(--border)' }}>
          {controlIds.map(id => (
            <div key={id} style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--muted)', lineHeight: 1.8 }}>{id}</div>
          ))}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            Reason <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why are these controls being waived?"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Owner</label>
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="name or team" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Expires</label>
            <input type="date" value={expires} onChange={e => setExpires(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {status === 'error' && (
          <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)', borderRadius: 7, fontSize: '0.8rem', color: '#dc2626' }}>
            {errorMsg}
          </div>
        )}

        {status === 'done' && (
          <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 7, fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>
            ✓ {controlIds.length} waiver{controlIds.length !== 1 ? 's' : ''} saved
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!reason.trim() || status === 'saving' || status === 'done'}
            style={{
              padding: '0.5rem 1.25rem', border: 'none', borderRadius: 8,
              background: !reason.trim() || status === 'saving' || status === 'done' ? '#94a3b8' : 'var(--waf-brand)',
              color: '#fff', fontSize: '0.82rem', cursor: !reason.trim() || status !== 'idle' ? 'default' : 'pointer', fontWeight: 700,
            }}
          >
            {status === 'saving' ? 'Saving…' : status === 'done' ? 'Saved!' : `Waive ${controlIds.length} control${controlIds.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(findings: Finding[], filename: string) {
  const esc = (v: string | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`
  const header = ['check_id', 'check_title', 'control_id', 'pillar', 'severity', 'status', 'resource', 'message', 'remediation'].join(',')
  const rows = findings.map(f =>
    [f.check_id, f.check_title, f.control_id, f.pillar, f.severity, f.status, f.resource, f.message, f.remediation]
      .map(v => esc(v ?? '')).join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FindingsPage({ run }: Props) {
  const findings = run.findings
  const [statusFilter, setStatusFilter]     = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [pillarFilter, setPillarFilter]     = useState('')
  const [search, setSearch]                 = useState('')
  const [detail, setDetail]                 = useState<Finding | null>(null)
  const [checked, setChecked]               = useState<Set<string>>(new Set())
  const [showWaiveModal, setShowWaiveModal] = useState(false)

  const pillars = useMemo(() => Array.from(new Set(findings.map(f => f.pillar).filter(Boolean))).sort(), [findings])

  const filtered = useMemo(() => findings.filter(f =>
    (!statusFilter   || f.status.toUpperCase()   === statusFilter) &&
    (!severityFilter || f.severity.toUpperCase() === severityFilter) &&
    (!pillarFilter   || f.pillar === pillarFilter) &&
    (!search         || f.check_title?.toLowerCase().includes(search.toLowerCase()) ||
                        f.check_id?.toLowerCase().includes(search.toLowerCase()) ||
                        f.resource?.toLowerCase().includes(search.toLowerCase()))
  ), [findings, statusFilter, severityFilter, pillarFilter, search])

  const allFilteredKeys = useMemo(() => new Set(filtered.map(rowKey)), [filtered])
  const checkedInView   = useMemo(() => filtered.filter(f => checked.has(rowKey(f))), [filtered, checked])
  const allSelected     = filtered.length > 0 && checkedInView.length === filtered.length
  const someSelected    = checkedInView.length > 0

  // Unique control ids for selected rows (waivers are per-control)
  const selectedControlIds = useMemo(() =>
    Array.from(new Set(checkedInView.map(f => f.control_id).filter(Boolean))),
    [checkedInView]
  )

  function toggleRow(key: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setChecked(prev => { const next = new Set(prev); allFilteredKeys.forEach(k => next.delete(k)); return next })
    } else {
      setChecked(prev => new Set([...prev, ...allFilteredKeys]))
    }
  }, [allSelected, allFilteredKeys])

  function clearSelection() { setChecked(new Set()) }

  const selectStyle = {
    background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none',
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* ── Filter bar ────────────────────────────────────────────────────── */}
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Search checks, resources…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...selectStyle, flex: '1', minWidth: '180px' }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">All statuses</option>
            {['PASS', 'FAIL', 'SKIP', 'WAIVED', 'ERROR'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={selectStyle}>
            <option value="">All severities</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => <option key={s}>{s}</option>)}
          </select>
          {pillars.length > 0 && (
            <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)} style={selectStyle}>
              <option value="">All pillars</option>
              {pillars.map(p => <option key={p}>{p}</option>)}
            </select>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {filtered.length} / {findings.length}
          </span>

          {/* Export filtered CSV — always available */}
          <button
            onClick={() => exportCsv(filtered, `findings-${run.project || 'run'}-${today}.csv`)}
            title="Export filtered view as CSV"
            style={{ ...selectStyle, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600, color: '#059669', borderColor: 'rgba(5,150,105,.35)' }}
          >
            ↓ CSV
          </button>
        </div>

        {/* ── Bulk action bar — shown when rows are checked ─────────────────── */}
        {someSelected && (
          <div style={{
            padding: '0.6rem 1.25rem',
            background: 'rgba(0,148,255,.06)', borderBottom: '1px solid rgba(0,148,255,.2)',
            display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--waf-brand)' }}>
              {checkedInView.length} finding{checkedInView.length !== 1 ? 's' : ''} selected
              {selectedControlIds.length !== checkedInView.length && (
                <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: '0.4rem' }}>
                  · {selectedControlIds.length} unique control{selectedControlIds.length !== 1 ? 's' : ''}
                </span>
              )}
            </span>

            <button
              onClick={() => setShowWaiveModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.85rem', borderRadius: '7px', border: 'none',
                background: 'var(--waf-brand)', color: '#fff',
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Waive {selectedControlIds.length} control{selectedControlIds.length !== 1 ? 's' : ''}
            </button>

            <button
              onClick={() => exportCsv(checkedInView, `findings-selected-${today}.csv`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.85rem', borderRadius: '7px',
                border: '1px solid rgba(5,150,105,.35)', background: 'rgba(5,150,105,.06)',
                color: '#059669', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              ↓ Export selection
            </button>

            <button
              onClick={clearSelection}
              style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Clear selection
            </button>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {/* Select-all checkbox */}
                <th style={{ padding: '0.65rem 0.75rem 0.65rem 1.25rem', width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                    onChange={toggleAll}
                    style={{ accentColor: 'var(--waf-brand)', cursor: 'pointer' }}
                  />
                </th>
                {['Check', 'Resource', 'Pillar', 'Severity', 'Status'].map(h => (
                  <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => {
                const key = rowKey(f)
                const isChecked = checked.has(key)
                const isDetail = detail ? rowKey(detail) === key : false
                return (
                  <tr
                    key={i}
                    style={{
                      borderTop: '1px solid var(--border)',
                      background: isChecked ? 'rgba(0,148,255,.05)' : isDetail ? 'rgba(0,148,255,.04)' : undefined,
                    }}
                    onMouseEnter={e => { if (!isChecked && !isDetail) (e.currentTarget as HTMLElement).style.background = 'var(--bg)' }}
                    onMouseLeave={e => { if (!isChecked && !isDetail) (e.currentTarget as HTMLElement).style.background = '' }}
                  >
                    {/* Checkbox cell — clicking here only toggles selection */}
                    <td
                      style={{ padding: '0.75rem 0.75rem 0.75rem 1.25rem', width: 36 }}
                      onClick={e => { e.stopPropagation(); toggleRow(key) }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRow(key)}
                        onClick={e => e.stopPropagation()}
                        style={{ accentColor: 'var(--waf-brand)', cursor: 'pointer' }}
                      />
                    </td>
                    {/* Content cells — clicking opens detail panel */}
                    <td style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => setDetail(isDetail ? null : f)}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{f.check_id}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{f.check_title}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => setDetail(isDetail ? null : f)}>
                      {f.resource}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => setDetail(isDetail ? null : f)}>
                      {f.pillar && <Pill label={f.pillar} color="var(--waf-brand)" />}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => setDetail(isDetail ? null : f)}>
                      <Pill label={f.severity} color={SEVERITY_COLOR[f.severity] ?? '#94a3b8'} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem', cursor: 'pointer' }} onClick={() => setDetail(isDetail ? null : f)}>
                      <Pill label={f.status} color={STATUS_COLOR[f.status] ?? '#94a3b8'} />
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                    No findings match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel overlay */}
      {detail && (
        <>
          <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 99 }} />
          <DetailPanel finding={detail} onClose={() => setDetail(null)} />
        </>
      )}

      {/* Waive modal overlay */}
      {showWaiveModal && (
        <>
          <div onClick={() => setShowWaiveModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199 }} />
          <WaiveModal
            controlIds={selectedControlIds}
            project={run.project ?? ''}
            onClose={() => setShowWaiveModal(false)}
            onDone={() => { setShowWaiveModal(false); clearSelection() }}
          />
        </>
      )}
    </>
  )
}
