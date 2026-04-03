import { useState } from 'react'
import { RunSummary } from '../api'

interface Props {
  runs: RunSummary[]
  onSelect: (id: string) => void
}

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

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

export default function RunsListPage({ runs, onSelect }: Props) {
  const [groupBy, setGroupBy] = useState<'all' | 'project'>('all')

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
  const btnActive: React.CSSProperties = {
    ...btnBase, background: 'var(--waf-brand)', color: '#fff', borderColor: 'var(--waf-brand)',
  }
  const btnInactive: React.CSSProperties = {
    ...btnBase, background: '#fff', color: 'var(--muted)',
  }

  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginRight: '0.35rem' }}>Group by:</span>
      <button style={groupBy === 'all' ? btnActive : btnInactive} onClick={() => setGroupBy('all')}>All runs</button>
      <button style={groupBy === 'project' ? btnActive : btnInactive} onClick={() => setGroupBy('project')}>Project</button>
    </div>
  )

  if (groupBy === 'all') {
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
        const scores = groupRuns.map(r => r.score)
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        const color = scoreColor(avgScore)
        const isUnnamed = project === '(no project)'
        return (
          <div key={project} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Group header */}
            <div style={{
              padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              background: 'var(--bg)',
            }}>
              <span style={{
                fontWeight: 700, fontSize: '0.85rem',
                color: isUnnamed ? 'var(--muted)' : 'var(--waf-brand)',
                fontStyle: isUnnamed ? 'italic' : undefined,
              }}>
                {project}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                {groupRuns.length} run{groupRuns.length !== 1 ? 's' : ''}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
                avg score
                <span style={{ fontWeight: 700, color, fontSize: '0.8rem' }}>{avgScore}</span>
              </span>
            </div>
            <RunsTable runs={groupRuns} onSelect={onSelect} />
          </div>
        )
      })}
    </div>
  )
}
