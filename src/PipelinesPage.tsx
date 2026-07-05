import { useMemo, useState } from 'react'
import { RunSummary, fetchRuns } from './api'
import { useI18n } from './i18n'
import { buildHash } from './routing'


// ── Helper functions ──────────────────────────────────────────────────────────

// WAF++ Brand Colors - pastel/lighter versions
const WAF_COLORS = [
  '#93c5fd', // Light Blue
  '#c4b5fd', // Light Violet
  '#67e8f9', // Light Cyan
  '#6ee7b7', // Light Emerald
  '#fcd34d', // Light Amber
  '#fca5a5', // Light Red
  '#60a5fa', // Light Blue
  '#a78bfa', // Light Violet
  '#818cf8', // Light Indigo
  '#f9a8d4', // Light Pink
  '#5eead4', // Light Teal
  '#fb923c', // Light Orange
  '#a3e635', // Light Lime
  '#fcd34d', // Light Amber
  '#5eead4', // Light Teal
  '#94a3b8', // Light Slate
]

// Generate a consistent color for each project using WAF++ brand colors
function getProjectColor(project: string): string {
  // Simple hash function to generate consistent color from project name
  let hash = 0
  for (let i = 0; i < project.length; i++) {
    hash = ((hash << 5) - hash) + project.charCodeAt(i)
    hash |= 0
  }
  // Select color from WAF brand palette based on hash
  const colorIndex = Math.abs(hash) % WAF_COLORS.length
  const color = WAF_COLORS[colorIndex]
  console.log(`Project: ${project} -> color: ${color}, index: ${colorIndex}`)
  return color
}

function scoreColor(s: number, opacity = 0.8) {
  const color = s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

function scoreLabel(s: number) {
  return s >= 80 ? 'Excellent' : s >= 60 ? 'Needs Attention' : 'High Risk'
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function getTimeAgo(iso: string): string {
  try {
    const date = new Date(iso)
    const diff = Date.now() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return formatDate(iso)
  } catch {
    return iso
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({ title, value, subtitle, color = 'var(--waf-brand)' }: { title: string; value: string | number; subtitle?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem 1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color }}>{value}</div>
      {subtitle && <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{subtitle}</div>}
    </div>
  )
}

function StatusBadge({ score }: { score: number }) {
  const color = scoreColor(score)
  const label = scoreLabel(score)
  return (
    <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: `${color}1a`, color, fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function CICDBadge({ isCICD }: { isCICD: boolean }) {
  if (!isCICD) return <span style={{ fontSize: '0.62rem', fontWeight: 400, color: 'var(--muted)' }}>manual</span>
  return (
    <span style={{ padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#10b9811a', color: '#10b981', fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      CI/CD
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PipelinesPage() {
  const { t } = useI18n()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [showManualRuns, setShowManualRuns] = useState(false)
  const PAGE_SIZE = 50

  // Fetch runs on mount
  useMemo(async () => {
    let cancelled = false
    setLoading(true)
    setError(null)

    try {
      let allRuns: RunSummary[] = []
      let cursor: string | null = null

      // Fetch multiple pages
      for (let i = 0; i < 3; i++) { // Up to 3 pages
        const result = await fetchRuns({ limit: PAGE_SIZE, cursor: cursor ?? undefined })
        if (cancelled) break

        allRuns = [...allRuns, ...result.items]
        cursor = result.nextCursor
        if (!cursor) break
      }

      if (!cancelled) {
        console.log('PipelinesPage: fetched runs count:', allRuns.length)
        setRuns(allRuns)
        setPage(page + 1)
      }
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to load pipeline data')
        setLoading(false)
      }
    } finally {
      if (!cancelled) setLoading(false)
    }

    return () => { cancelled = true }
  }, [])

  // Filter runs based on showManualRuns state
  const filteredRuns = useMemo(() => {
    return showManualRuns ? runs : runs.filter(r => r.is_cicd)
  }, [runs, showManualRuns])

  // Derived metrics
  const metrics = useMemo(() => {
    if (filteredRuns.length === 0) {
      return {
        totalRuns: 0,
        passRate: 0,
        avgScore: 0,
        projects: 0,
        recentRuns: [],
      }
    }

    const totalRuns = filteredRuns.length
    const passCount = filteredRuns.filter(r => r.score >= 80).length
    const passRate = Math.round((passCount / totalRuns) * 100)
    const avgScore = Math.round(filteredRuns.reduce((sum, r) => sum + r.score, 0) / totalRuns)
    const projects = new Set(filteredRuns.map(r => r.project)).size

    // Get recent runs (last 7 days)
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const recentRuns = filteredRuns.filter(r => new Date(r.created_at) > oneWeekAgo)

    return { totalRuns, passRate, avgScore, projects, recentRuns }
  }, [filteredRuns])

  // Group runs by day for chart - track all run data per day for individual colors
  const runsByDay = useMemo(() => {
    console.log('Building runsByDay, runs count:', filteredRuns.length)
    if (filteredRuns.length > 0) {
      console.log('Sample run:', filteredRuns[0])
    }
    const byDay: Record<string, { runs: RunSummary[] }> = {}
    filteredRuns.forEach(r => {
      const date = new Date(r.created_at)
      const dayKey = date.toISOString().split('T')[0]
      if (!byDay[dayKey]) {
        byDay[dayKey] = { runs: [] }
      }
      byDay[dayKey].runs.push(r)
    })
    console.log('byDay keys:', Object.keys(byDay))
    // Fill in empty days (last 30 days)
    const result: { day: string; runs: RunSummary[]; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayKey = date.toISOString().split('T')[0]
      const dayData = byDay[dayKey]
      result.push({
        day: dayKey,
        count: dayData?.runs.length || 0,
        runs: dayData?.runs || []
      })
    }
    return result
  }, [filteredRuns])

  // Top projects by score
  const topProjects = useMemo(() => {
    const projectScores: Record<string, { scores: number[]; latest: RunSummary }> = {}
    filteredRuns.forEach(r => {
      if (!projectScores[r.project]) {
        projectScores[r.project] = { scores: [], latest: r }
      }
      projectScores[r.project].scores.push(r.score)
      if (new Date(r.created_at) > new Date(projectScores[r.project].latest.created_at)) {
        projectScores[r.project].latest = r
      }
    })

    return Object.entries(projectScores)
      .map(([project, data]) => ({
        project,
        avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        latestScore: data.latest.score,
        runCount: data.scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5)
  }, [filteredRuns])

  if (loading && filteredRuns.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>Failed to load pipeline data</div>
        <div>{error}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'var(--waf-brand)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          Try Again
        </button>
      </div>
    )
  }


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px', margin: '0 auto', padding: '1rem' }}>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>
          {t('nav.items.pipelines')}
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
          Track your WAF++ scan performance across all projects and CI/CD pipelines
        </p>
      </div>

      {/* ── Key Metrics Row ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <MetricCard
          title={t('pages.pipelines.totalScans')}
          value={metrics.totalRuns}
          subtitle={t('pages.pipelines.allTimeExecutions')}
          color="var(--waf-brand)"
        />
        <MetricCard
          title={t('pages.pipelines.passRate')}
          value={`${metrics.passRate}%`}
          subtitle={`${metrics.totalRuns - Math.round((metrics.passRate / 100) * metrics.totalRuns)} ${t('pages.pipelines.scansNeedingAttention')}`}
          color={metrics.passRate >= 80 ? '#059669' : '#d97706'}
        />
        <MetricCard
          title={t('pages.pipelines.averageScore')}
          value={metrics.avgScore}
          subtitle={scoreLabel(metrics.avgScore)}
          color={scoreColor(metrics.avgScore)}
        />
        <MetricCard
          title={t('pages.pipelines.activeProjects')}
          value={metrics.projects}
          subtitle={t('pages.pipelines.uniqueProjectsScanned')}
          color="#8b5cf6"
        />
      </div>

      {/* ── Recent Activity Section ─────────────────────────────────────────────── */}
      {metrics.totalRuns > 0 && (
        <>
          {/* ── Runs Over Time Chart ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ padding: '1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
                {t('pages.pipelines.scanFrequency')}
                <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 400, color: 'var(--muted)' }}>
                  ({t('pages.pipelines.last30Days')})
                </span>
              </h3>
              {runsByDay.every(d => d.count === 0) ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📊</div>
                  <p>{t('pages.pipelines.noScanDataLast30Days')}</p>
                </div>
              ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', padding: '1rem 0' }}>
                {runsByDay.map((day, daysAgo) => {
                  console.log('Rendering day:', day.day, 'runs:', day.runs.length)
                  return (
                    <div key={day.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      {/* Stacked horizontal bars for each run - colored by project */}
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '60px', gap: '2px' }}>
                        {day.runs.map((run, j) => (
                          <div
                            key={j}
                            onClick={() => window.location.hash = buildHash('dashboard', run.id)}
                            style={{
                              width: '100%',
                              height: '14px',
                              background: getProjectColor(run.project),
                              borderRadius: '2px',
                              cursor: 'pointer'
                            }}
                            title={`Project: ${run.project}, Score: ${run.score} (click to view details)`}
                          />
                        ))}
                      </div>
                      {day.count > 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>{day.count}</span>
                      )}
                      <span style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>
                        {new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )
                })}
              </div>
              )}
            </div>

            {/* ── Top Projects Table ────────────────────────────────────────────── */}
            <div style={{ padding: '1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
                {t('pages.pipelines.topPerformingProjects')}
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('common.project')}</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('pages.pipelines.averageScore')}</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('pages.pipelines.score')}</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('pages.pipelines.runs')}</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('pages.pipelines.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProjects.map((proj, i) => {
                      const latestRun = runs.find(r => r.project === proj.project && r.score === proj.latestScore)
                      const projectColor = getProjectColor(proj.project)
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: projectColor, flex: 'none' }} />
                              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{proj.project}</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ display: 'inline-block', width: '40px', padding: '0.25rem 0.5rem', borderRadius: '4px', background: `${scoreColor(proj.avgScore)}20`, color: scoreColor(proj.avgScore), textAlign: 'center', fontWeight: 700 }}>
                              {proj.avgScore}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ display: 'inline-block', width: '40px', padding: '0.25rem 0.5rem', borderRadius: '4px', background: `${scoreColor(proj.latestScore)}20`, color: scoreColor(proj.latestScore), textAlign: 'center', fontWeight: 700 }}>
                              {proj.latestScore}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{proj.runCount} runs</td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>
                            {latestRun?.created_at ? formatDate(latestRun.created_at) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                    {topProjects.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '1rem', color: 'var(--muted)', textAlign: 'center' }}>
                          {t('common.noData')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Recent Runs List ──────────────────────────────────────────────────── */}
      {metrics.totalRuns > 0 && (
        <div style={{ padding: '1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
            {t('pages.pipelines.recentRuns')}
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('pages.pipelines.date')}</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('common.project')}</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('pages.pipelines.branch')}</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('pages.pipelines.score')}</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('pages.pipelines.pillars')}</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('pages.pipelines.status')}</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: 600 }}>{t('pages.pipelines.source')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.slice(0, 20).map((run, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => window.location.hash = buildHash('dashboard', run.id)}>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.8rem' }}>
                      {formatDate(run.created_at)}<br />
                      <span style={{ fontSize: '0.7rem' }}>{getTimeAgo(run.created_at)}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text)' }}>{run.project}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text)' }}>{run.branch}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ display: 'inline-block', width: '45px', padding: '0.25rem 0.5rem', borderRadius: '4px', background: `${scoreColor(run.score)}20`, color: scoreColor(run.score), textAlign: 'center', fontWeight: 700 }}>
                        {run.score}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>
                      {run.controls_run}/{run.controls_loaded} {t('pages.pipelines.pillars')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <StatusBadge score={run.score} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <CICDBadge isCICD={run.is_cicd} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty State ──────────────────────────────────────────────────────── */}
      {metrics.totalRuns === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>
            {t('pages.pipelines.noPipelineData')}
          </h2>
          <p style={{ maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
            {t('pages.pipelines.noPipelineDataHint')}
          </p>
        </div>
      )}

      {/* ── Run Filtering & CI/CD Flag Information ──────────────────────────────── */}
      <div style={{ padding: '1.5rem', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('pages.pipelines.cicdFlagInfo')}
          </h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showManualRuns}
              onChange={e => setShowManualRuns(e.target.checked)}
              style={{ accentColor: 'var(--waf-brand)' }}
            />
            Show manual runs
          </label>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
          {t('pages.pipelines.cicdFlagDescription')}
        </p>
        <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {"run: { is_cicd: true }"}
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '1rem' }}>
          Use <code style={{ background: '#e5e7eb', padding: '0.15rem 0.4rem', borderRadius: '4px', fontFamily: 'monospace' }}>--is-cicd</code> flag to mark your runs as coming from a CI/CD pipeline.
        </p>
      </div>
    </div>
  )
}
