import { useState } from 'react'
import { RunDetail } from '../api'
import { FRAMEWORKS, PILLAR_COLOR } from '../controls-data'
import { useControlsCatalogue } from '../useControlsCatalogue'

interface Props { run: RunDetail }

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

function ProgressBar({ value }: { value: number }) {
  const color = scoreColor(value)
  return (
    <div style={{ height: '6px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
    </div>
  )
}

export default function CompliancePage({ run }: Props) {
  const [tab, setTab] = useState<'pillars' | 'frameworks'>('pillars')
  const catalogue = useControlsCatalogue()
  const findings = run.findings
  const pillars = Array.from(new Set(findings.map(f => f.pillar).filter((p): p is string => Boolean(p)))).sort()

  // ── Pillar tab ──────────────────────────────────────────────────────────
  const pillarStats = pillars.map(p => {
    const pf = findings.filter(f => f.pillar === p)
    const total  = pf.length
    const pass   = pf.filter(f => f.status?.toUpperCase() === 'PASS').length
    const fail   = pf.filter(f => f.status?.toUpperCase() === 'FAIL').length
    const waived = pf.filter(f => f.status?.toUpperCase() === 'WAIVED').length
    const passRate = total > 0 ? Math.round((pass / total) * 100) : 0
    const score  = run.pillar_scores[p] ?? passRate
    return { pillar: p, total, pass, fail, waived, passRate, score }
  })

  const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const sevColor: Record<string, string> = {
    CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
  }

  // ── Frameworks tab ──────────────────────────────────────────────────────
  // For each framework, find controls that map to it and their run status
  function controlRunStatus(ctrlId: string): 'PASS' | 'FAIL' | 'SKIP' | 'UNKNOWN' {
    const ctrl = catalogue.find(c => c.id === ctrlId)
    if (!ctrl) return 'UNKNOWN'
    const related = findings.filter(f =>
      ctrl.automated_checks.some(c => c.id === f.check_id) || f.control_id === ctrlId
    )
    if (!related.length) return 'UNKNOWN'
    if (related.some(f => f.status?.toUpperCase() === 'FAIL')) return 'FAIL'
    if (related.every(f => f.status?.toUpperCase() === 'PASS')) return 'PASS'
    return 'SKIP'
  }

  const STATUS_COLOR: Record<string, string> = {
    PASS: '#22c55e', FAIL: '#DA2C38', SKIP: '#94a3b8', UNKNOWN: '#cbd5e1',
  }

  const tabStyle = (active: boolean) => ({
    padding: '0.5rem 1.25rem', border: 'none', cursor: 'pointer', fontWeight: 600,
    fontSize: '0.85rem', background: 'transparent',
    color: active ? 'var(--waf-brand)' : 'var(--muted)',
    borderBottom: active ? '2px solid var(--waf-brand)' : '2px solid transparent',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '0' }}>
        <button style={tabStyle(tab === 'pillars')}    onClick={() => setTab('pillars')}>Pillar Compliance</button>
        <button style={tabStyle(tab === 'frameworks')} onClick={() => setTab('frameworks')}>Regulatory Frameworks</button>
      </div>

      {tab === 'pillars' && (
        <>
          {pillars.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              No pillar data available for this run.
            </div>
          ) : (
            <>
              {/* Pillar cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {pillarStats.map(s => {
                  const pc = PILLAR_COLOR[s.pillar] ?? 'var(--waf-brand)'
                  return (
                    <div key={s.pillar} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: `3px solid ${pc}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{s.pillar}</div>
                        <div style={{ fontWeight: 800, fontSize: '1.25rem', color: scoreColor(s.score) }}>{s.score}</div>
                      </div>
                      <ProgressBar value={s.score} />
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                        <span style={{ color: '#22c55e' }}>✓ {s.pass}</span>
                        {s.fail > 0 && <span style={{ color: '#DA2C38' }}>✗ {s.fail}</span>}
                        {s.waived > 0 && <span style={{ color: '#a78bfa' }}>~ {s.waived}</span>}
                        <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{s.total} total</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Severity breakdown table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                  <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Failing Findings — Pillar × Severity
                  </h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)' }}>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pillar</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pass Rate</th>
                        {severities.map(s => (
                          <th key={s} style={{ padding: '0.65rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: sevColor[s], textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s}</th>
                        ))}
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pillarStats.map(s => (
                        <tr key={s.pillar} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{s.pillar}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: scoreColor(s.passRate) }}>{s.passRate}%</span>
                          </td>
                          {severities.map(sev => {
                            const count = findings.filter(f =>
                              f.pillar === s.pillar &&
                              f.severity?.toUpperCase() === sev &&
                              f.status?.toUpperCase() === 'FAIL'
                            ).length
                            return (
                              <td key={sev} style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                {count > 0
                                  ? <span style={{ fontWeight: 700, color: sevColor[sev] }}>{count}</span>
                                  : <span style={{ color: 'var(--muted)' }}>—</span>
                                }
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>{s.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'frameworks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {FRAMEWORKS.map(fw => {
            const mappedControls = catalogue.filter(c =>
              c.regulatory_mapping.some(m => m.framework === fw.id)
            )
            const statuses = mappedControls.map(c => controlRunStatus(c.id))
            const passCount  = statuses.filter(s => s === 'PASS').length
            const failCount  = statuses.filter(s => s === 'FAIL').length
            const knownCount = statuses.filter(s => s !== 'UNKNOWN').length
            const passRate   = knownCount > 0 ? Math.round((passCount / knownCount) * 100) : null

            return (
              <div key={fw.id} className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{fw.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{fw.desc}</div>
                  </div>
                  {passRate !== null && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.5rem', color: scoreColor(passRate) }}>{passRate}%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>pass rate</div>
                    </div>
                  )}
                </div>

                {passRate !== null && (
                  <div style={{ marginBottom: '1rem' }}>
                    <ProgressBar value={passRate} />
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.75rem' }}>
                      <span style={{ color: '#22c55e' }}>✓ {passCount} pass</span>
                      {failCount > 0 && <span style={{ color: '#DA2C38' }}>✗ {failCount} fail</span>}
                      <span style={{ color: 'var(--muted)' }}>{mappedControls.length} controls mapped</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {mappedControls.map(ctrl => {
                    const st = controlRunStatus(ctrl.id)
                    const sc = STATUS_COLOR[st]
                    const mapping = ctrl.regulatory_mapping.find(m => m.framework === fw.id)
                    return (
                      <div key={ctrl.id} style={{
                        padding: '0.35rem 0.65rem', borderRadius: '8px',
                        background: `${sc}12`, border: `1px solid ${sc}33`,
                        fontSize: '0.75rem',
                      }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.1rem' }}>{ctrl.id}</div>
                        {mapping && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{mapping.controls.join(', ')}</div>
                        )}
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: sc, marginTop: '0.2rem' }}>{st}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
