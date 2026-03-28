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

export default function RunsListPage({ runs, onSelect }: Props) {
  if (runs.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        No runs yet. Run <code>wafpass check --push http://localhost:8000</code> to record your first scan.
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Project', 'Branch', 'Score', 'Framework', 'Triggered by', 'Controls', 'Date'].map(h => (
                <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <tr
                key={r.id}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
