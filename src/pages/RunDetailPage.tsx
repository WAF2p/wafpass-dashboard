import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { fetchRun, Finding, RunDetail } from '../api'

const STATUS_COLOR: Record<string, string> = {
  PASS:   '#68d391',
  FAIL:   '#fc8181',
  SKIP:   '#718096',
  WAIVED: '#b794f4',
  ERROR:  '#f6ad55',
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#fc8181',
  HIGH:     '#f6ad55',
  MEDIUM:   '#fbd38d',
  LOW:      '#68d391',
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: '0.15rem 0.5rem', borderRadius: '4px',
      background: color + '22', color, fontSize: '0.75rem', fontWeight: 700,
    }}>
      {label}
    </span>
  )
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [run, setRun] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [pillarFilter, setPillarFilter] = useState('')

  useEffect(() => {
    if (!id) return
    fetchRun(id)
      .then(setRun)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p style={{ color: '#718096' }}>Loading run…</p>
  if (error) return <p style={{ color: '#fc8181' }}>Error: {error}</p>
  if (!run) return null

  const radarData = Object.entries(run.pillar_scores).map(([pillar, score]) => ({ pillar, score }))

  const findings: Finding[] = run.findings
  const pillars = Array.from(new Set(findings.map(f => f.pillar).filter(Boolean))).sort()

  const filtered = findings.filter(f =>
    (!statusFilter || f.status === statusFilter) &&
    (!severityFilter || f.severity === severityFilter) &&
    (!pillarFilter || f.pillar === pillarFilter)
  )

  const scoreColor = run.score >= 80 ? '#68d391' : run.score >= 60 ? '#f6ad55' : '#fc8181'

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/" style={{ color: '#718096', fontSize: '0.85rem' }}>← All Runs</Link>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <div style={{ flex: '1', minWidth: '200px', background: '#1e2130', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ color: '#718096', fontSize: '0.8rem', marginBottom: '0.5rem' }}>PROJECT</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{run.project || '—'}</div>
          <div style={{ color: '#a0aec0', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {run.branch} {run.git_sha ? `· ${run.git_sha.slice(0, 7)}` : ''}
          </div>
        </div>
        <div style={{ flex: '0 0 120px', background: '#1e2130', borderRadius: '8px', padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ color: '#718096', fontSize: '0.8rem', marginBottom: '0.5rem' }}>SCORE</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: scoreColor }}>{run.score}</div>
        </div>
        <div style={{ flex: '1', minWidth: '200px', background: '#1e2130', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ color: '#718096', fontSize: '0.8rem', marginBottom: '0.5rem' }}>RUN INFO</div>
          <div style={{ fontSize: '0.85rem', color: '#a0aec0', lineHeight: 1.7 }}>
            <div>Framework: {run.iac_framework}</div>
            <div>Triggered by: {run.triggered_by}</div>
            <div>Date: {new Date(run.created_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {radarData.length > 0 && (
        <div style={{ background: '#1e2130', borderRadius: '8px', padding: '1.25rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#a0aec0' }}>Pillar Scores</h2>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#2d3748" />
              <PolarAngleAxis dataKey="pillar" tick={{ fill: '#a0aec0', fontSize: 12 }} />
              <Radar dataKey="score" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.25} />
              <Tooltip
                contentStyle={{ background: '#1e2130', border: '1px solid #2d3748', borderRadius: '6px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ background: '#1e2130', borderRadius: '8px', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1rem', color: '#a0aec0', flex: '1' }}>
            Findings ({filtered.length} / {findings.length})
          </h2>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ background: '#0f1117', color: '#e2e8f0', border: '1px solid #2d3748', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
            <option value="">All statuses</option>
            {['PASS', 'FAIL', 'SKIP', 'WAIVED'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
            style={{ background: '#0f1117', color: '#e2e8f0', border: '1px solid #2d3748', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
            <option value="">All severities</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => <option key={s}>{s}</option>)}
          </select>
          {pillars.length > 0 && (
            <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)}
              style={{ background: '#0f1117', color: '#e2e8f0', border: '1px solid #2d3748', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
              <option value="">All pillars</option>
              {pillars.map(p => <option key={p}>{p}</option>)}
            </select>
          )}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2d3748', color: '#718096', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem 0.75rem' }}>Check</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Resource</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Pillar</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Severity</th>
              <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1a1f2e' }}>
                <td style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: 600 }}>{f.check_id}</div>
                  <div style={{ color: '#718096', fontSize: '0.8rem' }}>{f.check_title}</div>
                </td>
                <td style={{ padding: '0.75rem', color: '#a0aec0', fontFamily: 'monospace', fontSize: '0.8rem' }}>{f.resource}</td>
                <td style={{ padding: '0.75rem' }}>{f.pillar && <Badge label={f.pillar} color="#60a5fa" />}</td>
                <td style={{ padding: '0.75rem' }}><Badge label={f.severity} color={SEVERITY_COLOR[f.severity] ?? '#a0aec0'} /></td>
                <td style={{ padding: '0.75rem' }}><Badge label={f.status} color={STATUS_COLOR[f.status] ?? '#a0aec0'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
