import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchRuns, RunSummary } from '../api'

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#68d391' : score >= 60 ? '#f6ad55' : '#fc8181'
  return (
    <span style={{
      display: 'inline-block', minWidth: '3rem', textAlign: 'center',
      padding: '0.2rem 0.6rem', borderRadius: '999px',
      background: color + '22', color, fontWeight: 700, fontSize: '0.9rem',
    }}>
      {score}
    </span>
  )
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRuns({ limit: 50 })
      .then(setRuns)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: '#718096' }}>Loading runs…</p>
  if (error) return <p style={{ color: '#fc8181' }}>Error: {error}</p>
  if (!runs.length) return (
    <p style={{ color: '#718096' }}>
      No runs yet. Run <code>wafpass check</code> and POST the result to <code>/runs</code>.
    </p>
  )

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Recent Runs</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2d3748', color: '#718096', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem 0.75rem' }}>Project</th>
            <th style={{ padding: '0.5rem 0.75rem' }}>Branch</th>
            <th style={{ padding: '0.5rem 0.75rem' }}>Score</th>
            <th style={{ padding: '0.5rem 0.75rem' }}>Triggered by</th>
            <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #1a1f2e' }}>
              <td style={{ padding: '0.75rem' }}>
                <Link to={`/runs/${r.id}`} style={{ fontWeight: 600 }}>{r.project || '—'}</Link>
              </td>
              <td style={{ padding: '0.75rem', color: '#a0aec0' }}>{r.branch || '—'}</td>
              <td style={{ padding: '0.75rem' }}><ScoreBadge score={r.score} /></td>
              <td style={{ padding: '0.75rem', color: '#a0aec0' }}>{r.triggered_by}</td>
              <td style={{ padding: '0.75rem', color: '#718096' }}>
                {new Date(r.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
