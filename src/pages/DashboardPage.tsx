import {
  Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { RunDetail } from '../api'

interface Props { run: RunDetail }

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#22c55e',
}

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: accent ?? 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage({ run }: Props) {
  const findings = run.findings
  // Normalise casing so comparisons are case-insensitive
  const total   = findings.length
  const pass    = findings.filter(f => f.status?.toUpperCase() === 'PASS').length
  const fail    = findings.filter(f => f.status?.toUpperCase() === 'FAIL').length
  const waived  = findings.filter(f => f.status?.toUpperCase() === 'WAIVED').length
  const passRate = total > 0 ? Math.round((pass / total) * 100) : 0

  // Severity breakdown for failing findings
  const severityCounts = SEVERITIES.map(s => ({
    name: s,
    value: findings.filter(f =>
      f.status?.toUpperCase() === 'FAIL' &&
      f.severity?.toUpperCase() === s
    ).length,
  })).filter(d => d.value > 0)

  // Pillar bar chart
  const pillarData = Object.entries(run.pillar_scores).map(([p, s]) => ({ pillar: p, score: s }))

  // Heatmap: collect unique pillars, normalise to how they appear in findings
  const pillars = Array.from(new Set(
    findings.map(f => f.pillar).filter((p): p is string => Boolean(p))
  )).sort()

  type HeatCell = { pillar: string; severity: string; count: number }
  const heatmap: HeatCell[] = []
  for (const p of pillars) {
    for (const s of SEVERITIES) {
      heatmap.push({
        pillar: p,
        severity: s,
        count: findings.filter(f =>
          f.pillar === p &&
          f.severity?.toUpperCase() === s &&
          f.status?.toUpperCase() === 'FAIL'
        ).length,
      })
    }
  }
  const heatMax = heatmap.reduce((m, c) => Math.max(m, c.count), 1)

  // Quick wins: FAIL findings sorted by severity weight
  const SWEIGHT: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
  const quickWins = findings
    .filter(f => f.status?.toUpperCase() === 'FAIL')
    .sort((a, b) =>
      (SWEIGHT[a.severity?.toUpperCase() ?? ''] ?? 0) >
      (SWEIGHT[b.severity?.toUpperCase() ?? ''] ?? 0) ? -1 : 1
    )
    .slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <KpiCard label="Score" value={run.score} sub="out of 100" accent={scoreColor(run.score)} />
        <KpiCard label="Pass Rate" value={`${passRate}%`} sub={`${pass} / ${total} checks`} />
        <KpiCard label="Failing" value={fail} sub="checks need attention" accent={fail > 0 ? '#DA2C38' : undefined} />
        <KpiCard label="Controls Run" value={run.controls_run || total} sub={`${run.controls_loaded || '—'} loaded`} />
        {waived > 0 && <KpiCard label="Waived" value={waived} sub="intentional skips" accent="#a78bfa" />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Pillar scores */}
        {pillarData.length > 0 && (
          <div className="card">
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
              Pillar Scores
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pillarData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <YAxis type="category" dataKey="pillar" width={90} tick={{ fontSize: 11, fill: 'var(--text)' }} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem' }}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {pillarData.map(d => (
                    <Cell key={d.pillar} fill={scoreColor(d.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Severity breakdown */}
        {severityCounts.length > 0 && (
          <div className="card">
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
              Failing by Severity
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={severityCounts} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={70}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {severityCounts.map(d => (
                    <Cell key={d.name} fill={SEVERITY_COLOR[d.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Debt Heatmap */}
      {pillars.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
            Failure Heatmap — Pillar × Severity
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Pillar</th>
                  {SEVERITIES.map(s => (
                    <th key={s} style={{ padding: '0.4rem 0.75rem', textAlign: 'center', color: SEVERITY_COLOR[s], fontWeight: 700, fontSize: '0.7rem' }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pillars.map(p => (
                  <tr key={p} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{p}</td>
                    {SEVERITIES.map(s => {
                      const cell = heatmap.find(c => c.pillar === p && c.severity === s)
                      const count = cell?.count ?? 0
                      const intensity = count === 0 ? 0 : 0.15 + (count / heatMax) * 0.75
                      const col = SEVERITY_COLOR[s] ?? '#94a3b8'
                      return (
                        <td key={s} style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: '2rem', height: '1.75rem', borderRadius: '6px',
                            background: count === 0 ? 'transparent' : hexToRgba(col, intensity),
                            color: count === 0 ? 'var(--muted)' : col,
                            fontWeight: count > 0 ? 700 : 400,
                          }}>
                            {count === 0 ? '—' : count}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick wins */}
      {quickWins.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
            Top Priority Findings
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {quickWins.map((f, i) => {
              const sev = f.severity?.toUpperCase() ?? 'UNKNOWN'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  padding: '0.75rem', borderRadius: '10px', background: 'var(--bg)',
                  border: '1px solid var(--border)',
                }}>
                  <span style={{
                    flexShrink: 0, padding: '0.15rem 0.5rem', borderRadius: '999px',
                    background: hexToRgba(SEVERITY_COLOR[sev] ?? '#94a3b8', 0.13),
                    color: SEVERITY_COLOR[sev] ?? '#94a3b8',
                    fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    {sev}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{f.check_title || f.check_id}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem', fontFamily: 'monospace' }}>{f.resource}</div>
                  </div>
                  {f.pillar && (
                    <span style={{
                      flexShrink: 0, padding: '0.15rem 0.5rem', borderRadius: '999px',
                      background: 'rgba(0,148,255,.12)', color: 'var(--waf-brand)',
                      fontSize: '0.7rem', fontWeight: 600,
                    }}>
                      {f.pillar}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
