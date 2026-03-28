import { useState } from 'react'
import { Finding, RunDetail } from '../api'

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

function DetailPanel({ finding, onClose }: { finding: Finding; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '600px', maxWidth: '92vw', maxHeight: '85vh',
      background: '#fff', borderRadius: '14px',
      boxShadow: '0 24px 64px rgba(15,23,42,.18)',
      display: 'flex', flexDirection: 'column', zIndex: 100,
      overflowY: 'auto',
    }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{finding.check_title || finding.check_id}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem', fontFamily: 'monospace' }}>{finding.check_id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0.25rem', flexShrink: 0, fontSize: '1.1rem' }}>
          ✕
        </button>
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
            <pre style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px',
              padding: '0.75rem', fontSize: '0.75rem', overflowX: 'auto', margin: 0,
              color: 'var(--text)', lineHeight: 1.6,
            }}>
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

export default function FindingsPage({ run }: Props) {
  const findings = run.findings
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [pillarFilter, setPillarFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Finding | null>(null)

  const pillars = Array.from(new Set(findings.map(f => f.pillar).filter(Boolean))).sort()

  const filtered = findings.filter(f =>
    (!statusFilter   || f.status.toUpperCase()   === statusFilter) &&
    (!severityFilter || f.severity.toUpperCase() === severityFilter) &&
    (!pillarFilter   || f.pillar === pillarFilter) &&
    (!search         || f.check_title?.toLowerCase().includes(search.toLowerCase()) ||
                        f.check_id?.toLowerCase().includes(search.toLowerCase()) ||
                        f.resource?.toLowerCase().includes(search.toLowerCase()))
  )

  const selectStyle = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none',
  }

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Filter bar */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {filtered.length} / {findings.length}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Check', 'Resource', 'Pillar', 'Severity', 'Status'].map(h => (
                  <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr
                  key={i}
                  onClick={() => setSelected(selected?.check_id === f.check_id && selected?.resource === f.resource ? null : f)}
                  style={{
                    borderTop: '1px solid var(--border)', cursor: 'pointer',
                    background: selected === f ? 'rgba(0,148,255,.04)' : undefined,
                  }}
                  onMouseEnter={e => { if (selected !== f) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)' }}
                  onMouseLeave={e => { if (selected !== f) (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                >
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{f.check_id}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{f.check_title}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.resource}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {f.pillar && <Pill label={f.pillar} color="var(--waf-brand)" />}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Pill label={f.severity} color={SEVERITY_COLOR[f.severity] ?? '#94a3b8'} />
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Pill label={f.status} color={STATUS_COLOR[f.status] ?? '#94a3b8'} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                    No findings match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 99 }} />
          <DetailPanel finding={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </>
  )
}
