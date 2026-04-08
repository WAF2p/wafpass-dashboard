import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { RunSummary } from '../api'

interface Props {
  runs: RunSummary[]
  onSelect: (id: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PROJECT_COLORS = [
  '#0094FF', '#f97316', '#a855f7', '#22c55e', '#eab308', '#ec4899', '#14b8a6',
]
const PILLAR_META: { key: string; label: string; color: string }[] = [
  { key: 'security',       label: 'Security',       color: '#DA2C38' },
  { key: 'cost',           label: 'Cost',           color: '#0094FF' },
  { key: 'operations',     label: 'Operations',     color: '#8b5cf6' },
  { key: 'performance',    label: 'Performance',    color: '#f97316' },
  { key: 'reliability',    label: 'Reliability',    color: '#22c55e' },
  { key: 'sovereign',      label: 'Sovereignty',    color: '#eab308' },
  { key: 'sustainability', label: 'Sustainability', color: '#14b8a6' },
]

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function fmtFull(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ScoreTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)', borderRadius: '10px',
      padding: '0.75rem 0.875rem', boxShadow: '0 4px 16px rgba(15,23,42,.12)',
      fontSize: '0.78rem', minWidth: '160px',
    }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
          <span style={{ fontWeight: 800, color: scoreColor(entry.value) }}>{entry.value}</span>
          {entry.payload?.branch && (
            <span style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>· {entry.payload.branch}</span>
          )}
        </div>
      ))}
      <div style={{ marginTop: '0.4rem', fontSize: '0.65rem', color: 'var(--muted)' }}>Click dot to open run</div>
    </div>
  )
}

function PillarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)', borderRadius: '8px',
      padding: '0.5rem 0.75rem', boxShadow: '0 4px 12px rgba(15,23,42,.1)',
      fontSize: '0.75rem',
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontWeight: 800, color: scoreColor(v) }}>{v}</div>
    </div>
  )
}

// ── Trend view ────────────────────────────────────────────────────────────────
function TrendView({ runs, onSelect }: Props) {
  const sorted = useMemo(
    () => [...runs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [runs]
  )

  const projects = useMemo(
    () => [...new Set(sorted.map(r => r.project || '(no project)'))],
    [sorted]
  )

  // Per-project series for the main chart
  const projectSeries = useMemo(() =>
    projects.map((proj, i) => ({
      proj,
      color: PROJECT_COLORS[i % PROJECT_COLORS.length],
      data: sorted
        .filter(r => (r.project || '(no project)') === proj)
        .map(r => ({
          date: fmt(r.created_at),
          dateFull: fmtFull(r.created_at),
          score: r.score,
          id: r.id,
          branch: r.branch,
          sha: r.git_sha?.slice(0, 7),
        })),
    })),
    [projects, sorted]
  )

  // Per-pillar series (all runs, combined)
  const pillarSeries = useMemo(() =>
    PILLAR_META.map(pm => ({
      ...pm,
      data: sorted
        .filter(r => pm.key in r.pillar_scores)
        .map(r => ({
          date: fmt(r.created_at),
          score: r.pillar_scores[pm.key] ?? null,
          id: r.id,
        })),
    })).filter(p => p.data.length > 0),
    [sorted]
  )

  // Summary stats
  const firstRun = sorted[0]
  const lastRun  = sorted[sorted.length - 1]
  const overallDelta = lastRun.score - firstRun.score
  const dateRange = sorted.length > 1
    ? `${fmt(firstRun.created_at)} – ${fmt(lastRun.created_at)}`
    : fmt(firstRun.created_at)

  // Branch filter
  const branches = useMemo(
    () => [...new Set(sorted.map(r => r.branch).filter(Boolean))].sort(),
    [sorted]
  )
  const [branchFilter, setBranchFilter] = useState('')
  const filteredSeries = useMemo(() =>
    branchFilter
      ? projectSeries.map(ps => ({ ...ps, data: ps.data.filter(d => d.branch === branchFilter) }))
      : projectSeries,
    [projectSeries, branchFilter]
  )

  function handleDotClick(_: any, payload: any) {
    const id = payload?.payload?.id
    if (id) onSelect(id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Summary strip ── */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, color: 'var(--text)' }}>{sorted.length}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.35rem' }}>runs</span>
        </div>
        <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{dateRange}</div>
        <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: scoreColor(firstRun.score), lineHeight: 1 }}>{firstRun.score}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>first</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
            <svg width="28" height="12" viewBox="0 0 28 12">
              <line x1="0" y1="6" x2="20" y2="6" stroke="#94a3b8" strokeWidth="1.5" />
              <polygon points="20,2 28,6 20,10" fill="#94a3b8" />
            </svg>
            <span style={{
              fontSize: '0.68rem', fontWeight: 700,
              color: overallDelta > 0 ? '#059669' : overallDelta < 0 ? '#DC2626' : 'var(--muted)',
            }}>
              {overallDelta > 0 ? '+' : ''}{overallDelta} pts
            </span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: scoreColor(lastRun.score), lineHeight: 1 }}>{lastRun.score}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>latest</div>
          </div>
        </div>
        <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </div>
        {branches.length > 1 && (
          <>
            <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />
            <select
              value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
              className="filter-select" style={{ fontSize: '0.75rem' }}
            >
              <option value="">All branches</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </>
        )}
      </div>

      {/* ── Overall score trend ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Overall Score Over Time
          </span>
          <div style={{ display: 'flex', gap: '1.25rem', marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '20px', height: '1.5px', background: '#059669', display: 'inline-block', borderTop: '1.5px dashed #059669' }} /> 80
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '20px', height: '1.5px', background: '#d97706', display: 'inline-block', borderTop: '1.5px dashed #d97706' }} /> 60
            </span>
          </div>
        </div>
        <div style={{ padding: '1rem 0.5rem 0.5rem' }}>
          {sorted.length < 2 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
              Run at least 2 scans to see a trend.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date" type="category" allowDuplicatedCategory={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  interval="preserveStartEnd" padding={{ left: 16, right: 16 }}
                />
                <YAxis
                  domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false} axisLine={false} width={28}
                />
                <Tooltip content={<ScoreTooltip />} />
                {projects.length > 1 && (
                  <Legend
                    wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }}
                    formatter={(v) => v.length > 24 ? v.slice(0, 23) + '…' : v}
                  />
                )}
                <ReferenceLine y={80} stroke="#059669" strokeDasharray="4 4" strokeWidth={1} />
                <ReferenceLine y={60} stroke="#d97706" strokeDasharray="4 4" strokeWidth={1} />
                {filteredSeries.map(({ proj, color, data }) => (
                  data.length > 0 && (
                    <Line
                      key={proj}
                      data={data}
                      dataKey="score"
                      name={proj}
                      stroke={color}
                      strokeWidth={2}
                      type="monotone"
                      dot={{ r: 4, fill: color, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: color, strokeWidth: 2, stroke: '#fff', onClick: handleDotClick, style: { cursor: 'pointer' } }}
                      connectNulls
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Pillar sparklines ── */}
      {pillarSeries.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pillar Scores Over Time
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1px', background: 'var(--border)' }}>
            {pillarSeries.map(({ key, label, color, data }) => {
              const latest  = data[data.length - 1]?.score ?? 0
              const first   = data[0]?.score ?? 0
              const delta   = data.length > 1 ? latest - first : null
              return (
                <div key={key} style={{ background: 'var(--surface)', padding: '0.875rem 1rem 0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                      {delta !== null && (
                        <span style={{
                          marginLeft: '0.4rem', fontSize: '0.65rem', fontWeight: 700,
                          color: delta > 0 ? '#059669' : delta < 0 ? '#DC2626' : 'var(--muted)',
                        }}>
                          {delta > 0 ? '↑' : delta < 0 ? '↓' : '—'}{delta !== 0 ? Math.abs(delta) : ''}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: scoreColor(latest), lineHeight: 1 }}>{latest}</span>
                  </div>
                  {data.length < 2 ? (
                    <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>single run</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={72}>
                      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={color} stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" hide />
                        <YAxis domain={[0, 100]} hide />
                        <Tooltip content={<PillarTooltip />} />
                        <Area
                          type="monotone" dataKey="score" name={label}
                          stroke={color} strokeWidth={1.75}
                          fill={`url(#grad-${key})`}
                          dot={false}
                          activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
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

// ── Table components (unchanged) ──────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = scoreColor(score)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '2.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px',
      background: `${color}18`, color, fontWeight: 700, fontSize: '0.85rem',
    }}>
      {score}
    </span>
  )
}

const COL_HEADERS = ['Project', 'Branch', 'Score', 'Framework', 'Triggered by', 'Controls', 'Date']

function RunRow({ r, onSelect }: { r: RunSummary; onSelect: (id: string) => void }) {
  return (
    <tr
      onClick={() => onSelect(r.id)}
      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)'}
      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
    >
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ fontWeight: 600, color: 'var(--waf-brand)' }}>{r.project || '—'}</div>
        {r.git_sha && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'monospace', marginTop: '0.15rem' }}>{r.git_sha.slice(0, 7)}</div>}
      </td>
      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{r.branch || '—'}</td>
      <td style={{ padding: '0.75rem 1rem' }}><ScoreBadge score={r.score} /></td>
      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.iac_framework}</td>
      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{r.triggered_by}</td>
      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>
        {r.controls_run > 0 ? `${r.controls_run} / ${r.controls_loaded}` : '—'}
      </td>
      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
        {new Date(r.created_at).toLocaleString()}
      </td>
    </tr>
  )
}

function RunsTable({ runs, onSelect }: { runs: RunSummary[]; onSelect: (id: string) => void }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            {COL_HEADERS.map(h => (
              <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map(r => <RunRow key={r.id} r={r} onSelect={onSelect} />)}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RunsListPage({ runs, onSelect }: Props) {
  const [viewMode, setViewMode] = useState<'all' | 'project' | 'trend'>('all')

  if (runs.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        No runs yet. Run <code>wafpass check --push http://localhost:8000</code> to record your first scan.
      </div>
    )
  }

  const btnBase: React.CSSProperties = {
    padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem',
    fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
  }
  const btnActive: React.CSSProperties   = { ...btnBase, background: 'var(--waf-brand)', color: '#fff', borderColor: 'var(--waf-brand)' }
  const btnInactive: React.CSSProperties = { ...btnBase, background: '#fff', color: 'var(--muted)' }

  const vm = viewMode as string
  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginRight: '0.35rem' }}>View:</span>
      <button style={vm === 'all'     ? btnActive : btnInactive} onClick={() => setViewMode('all')}>All runs</button>
      <button style={vm === 'project' ? btnActive : btnInactive} onClick={() => setViewMode('project')}>Project</button>
      <button style={vm === 'trend'   ? btnActive : btnInactive} onClick={() => setViewMode('trend')}>Trend</button>
    </div>
  )

  if (viewMode === 'trend') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', alignSelf: 'center', marginRight: '0.35rem' }}>View:</span>
          <button style={btnInactive} onClick={() => setViewMode('all')}>All runs</button>
          <button style={btnInactive} onClick={() => setViewMode('project')}>Project</button>
          <button style={btnActive}   onClick={() => setViewMode('trend')}>Trend</button>
        </div>
        <TrendView runs={runs} onSelect={onSelect} />
      </div>
    )
  }

  if (viewMode === 'all') {
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {toolbar}
        <RunsTable runs={runs} onSelect={onSelect} />
      </div>
    )
  }

  // Group by project
  const groupMap = new Map<string, RunSummary[]>()
  for (const r of runs) {
    const key = r.project || '(no project)'
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(r)
  }
  const groups = Array.from(groupMap.entries()).sort(([a], [b]) => {
    if (a === '(no project)') return 1
    if (b === '(no project)') return -1
    return a.localeCompare(b)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {toolbar}
      </div>
      {groups.map(([project, groupRuns]) => {
        const scores   = groupRuns.map(r => r.score)
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        const color    = scoreColor(avgScore)
        const isUnnamed = project === '(no project)'
        return (
          <div key={project} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg)' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isUnnamed ? 'var(--muted)' : 'var(--waf-brand)', fontStyle: isUnnamed ? 'italic' : undefined }}>
                {project}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                {groupRuns.length} run{groupRuns.length !== 1 ? 's' : ''}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
                avg score <span style={{ fontWeight: 700, color, fontSize: '0.8rem' }}>{avgScore}</span>
              </span>
            </div>
            <RunsTable runs={groupRuns} onSelect={onSelect} />
          </div>
        )
      })}
    </div>
  )
}
