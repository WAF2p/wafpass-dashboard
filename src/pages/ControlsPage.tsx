import { useState } from 'react'
import { ControlMeta, Finding } from '../api'
import { CONTROLS, PILLAR_COLOR } from '../controls-data'

interface Props {
  controls: ControlMeta[]   // from active run API — empty when no run selected
  findings: Finding[]       // from active run, used for pass/fail overlay
}

const SEV_COLOR: Record<string, string> = {
  critical: '#DA2C38',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
}

const STATUS_COLOR: Record<string, string> = {
  PASS: '#22c55e', FAIL: '#DA2C38', SKIP: '#94a3b8', WAIVED: '#a78bfa',
}

function pillarColor(pillar: string): string {
  return PILLAR_COLOR[pillar.toLowerCase()] ?? '#94a3b8'
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

function controlStatus(ctrlId: string, checks: { id: string }[], findings: Finding[]): 'PASS' | 'FAIL' | 'SKIP' | null {
  if (!findings.length) return null
  const related = findings.filter(f =>
    checks.some(c => c.id === f.check_id) || f.control_id === ctrlId
  )
  if (!related.length) return null
  if (related.some(f => f.status?.toUpperCase() === 'FAIL')) return 'FAIL'
  if (related.every(f => f.status?.toUpperCase() === 'PASS')) return 'PASS'
  return 'SKIP'
}

function DetailPanel({ ctrl, status, onClose }: { ctrl: ControlMeta; status: 'PASS' | 'FAIL' | 'SKIP' | null; onClose: () => void }) {
  const pc = pillarColor(ctrl.pillar)
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '440px',
      background: '#fff', borderLeft: '1px solid var(--border)',
      boxShadow: '-4px 0 24px rgba(15,23,42,.1)',
      display: 'flex', flexDirection: 'column', zIndex: 100,
      overflowY: 'auto',
    }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--muted)', marginBottom: '0.25rem' }}>{ctrl.id}</div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{ctrl.title}</div>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <Pill label={ctrl.pillar} color={pc} />
            <Pill label={ctrl.severity} color={SEV_COLOR[ctrl.severity?.toLowerCase()] ?? '#94a3b8'} />
            {status && <Pill label={status} color={STATUS_COLOR[status] ?? '#94a3b8'} />}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0.25rem', flexShrink: 0, fontSize: '1.1rem' }}>✕</button>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {ctrl.description && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Description</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{ctrl.description}</p>
          </div>
        )}

        {ctrl.rationale && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Rationale</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{ctrl.rationale}</p>
          </div>
        )}

        {ctrl.threat && ctrl.threat.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Threat Scenarios</div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {ctrl.threat.map((t, i) => (
                <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {ctrl.checks.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              Automated Checks ({ctrl.checks.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {ctrl.checks.map((chk, i) => (
                <div key={i} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>{chk.id}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)', marginBottom: '0.35rem' }}>{chk.title}</div>
                  <Pill label={chk.severity} color={SEV_COLOR[chk.severity?.toLowerCase()] ?? '#94a3b8'} />
                  {chk.remediation && (
                    <p style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--muted)', margin: '0.5rem 0 0' }}>{chk.remediation}</p>
                  )}
                  {chk.example?.compliant && (
                    <pre style={{ marginTop: '0.5rem', background: '#0f172a', color: '#e2e8f0', borderRadius: '6px', padding: '0.75rem', fontSize: '0.72rem', overflowX: 'auto', lineHeight: 1.6 }}>
                      {chk.example.compliant}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {ctrl.regulatory_mapping.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Regulatory Mapping</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ctrl.regulatory_mapping.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ flexShrink: 0, fontWeight: 700, fontSize: '0.78rem', color: 'var(--waf-brand)', minWidth: '120px' }}>{m.framework}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{m.controls.join(', ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ControlsPage({ controls, findings }: Props) {
  // Use live run controls when available, fall back to static reference set
  const source: ControlMeta[] = controls.length > 0
    ? controls
    : CONTROLS.map(c => ({
        id: c.id,
        title: c.title,
        pillar: c.pillar,
        severity: c.severity,
        category: c.category,
        description: c.description,
        rationale: c.rationale ?? '',
        threat: c.threat ?? [],
        regulatory_mapping: c.regulatory_mapping,
        checks: c.automated_checks.map(chk => ({
          id: chk.id,
          title: chk.title,
          severity: chk.severity,
          remediation: chk.remediation ?? '',
          example: chk.example ?? null,
        })),
      }))

  const isLive = controls.length > 0

  const [search, setSearch] = useState('')
  const [pillarFilter, setPillarFilter] = useState('')
  const [sevFilter, setSevFilter] = useState('')
  const [selected, setSelected] = useState<ControlMeta | null>(null)

  const pillars = Array.from(new Set(source.map(c => c.pillar))).sort()

  const filtered = source.filter(c =>
    (!pillarFilter || c.pillar.toLowerCase() === pillarFilter.toLowerCase()) &&
    (!sevFilter    || c.severity.toLowerCase() === sevFilter.toLowerCase()) &&
    (!search       || c.title.toLowerCase().includes(search.toLowerCase()) ||
                      c.id.toLowerCase().includes(search.toLowerCase()) ||
                      c.category.toLowerCase().includes(search.toLowerCase()))
  )

  const selectStyle = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none',
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Source indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.6rem 0.875rem', borderRadius: '10px', fontSize: '0.8rem',
          background: isLive ? 'rgba(0,148,255,.06)' : 'rgba(148,163,184,.08)',
          border: `1px solid ${isLive ? 'rgba(0,148,255,.2)' : 'rgba(148,163,184,.2)'}`,
          color: isLive ? 'var(--waf-brand)' : 'var(--muted)',
        }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isLive ? 'var(--waf-brand)' : '#94a3b8', flexShrink: 0 }} />
          {isLive
            ? <><strong>{source.length} controls</strong> loaded from the active run</>
            : <>Showing reference set — run <code style={{ fontSize: '0.75rem' }}>wafpass check --output json --push …</code> to see your actual loaded controls</>
          }
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Search by ID, title, category…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...selectStyle, flex: '1', minWidth: '180px' }}
          />
          <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)} style={selectStyle}>
            <option value="">All pillars</option>
            {pillars.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} style={selectStyle}>
            <option value="">All severities</option>
            {['critical', 'high', 'medium', 'low'].map(s => <option key={s}>{s}</option>)}
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {filtered.length} / {source.length}
          </span>
        </div>

        {/* Controls grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {filtered.map(ctrl => {
            const status = controlStatus(ctrl.id, ctrl.checks, findings)
            const pc = pillarColor(ctrl.pillar)
            const sc = SEV_COLOR[ctrl.severity?.toLowerCase()] ?? '#94a3b8'
            return (
              <div
                key={ctrl.id}
                className="card"
                onClick={() => setSelected(selected?.id === ctrl.id ? null : ctrl)}
                style={{ cursor: 'pointer', borderLeft: `3px solid ${pc}`, transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--muted)' }}>{ctrl.id}</div>
                  {status && (
                    <span style={{
                      flexShrink: 0, padding: '0.1rem 0.45rem', borderRadius: '999px',
                      background: `${STATUS_COLOR[status]}22`, color: STATUS_COLOR[status],
                      fontSize: '0.65rem', fontWeight: 700,
                    }}>
                      {status}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '0.4rem', lineHeight: 1.4 }}>
                  {ctrl.title}
                </div>
                {ctrl.description && (
                  <p style={{
                    fontSize: '0.78rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {ctrl.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <Pill label={ctrl.pillar} color={pc} />
                  <Pill label={ctrl.severity} color={sc} />
                  {ctrl.checks.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--muted)' }}>
                      {ctrl.checks.length} check{ctrl.checks.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 99 }} />
          <DetailPanel
            ctrl={selected}
            status={controlStatus(selected.id, selected.checks, findings)}
            onClose={() => setSelected(null)}
          />
        </>
      )}
    </>
  )
}
