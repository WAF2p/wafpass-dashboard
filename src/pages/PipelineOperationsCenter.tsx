import { useEffect, useMemo, useState } from 'react'
import { fetchPipelineMetrics, fetchPipelineTrends, fetchRuns, PipelineMetrics, PipelineTrends, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { Page, scoreColor } from '../routing'
import { CenterHero, Icon, KpiCard, MiniBadge, PriorityRow, RightRail, SectionCard } from './OperationsCenterShell'

const WAF_COLORS = [
  'var(--waf-brand)', 'var(--waf-info)', 'var(--score-high)', 'var(--waf-warn)',
  'var(--waived)', 'var(--pass)', 'var(--fail)', 'var(--muted)',
  'var(--waf-brand)', 'var(--waf-info)', 'var(--score-high)', 'var(--waf-warn)',
  'var(--waived)', 'var(--pass)',
]

function getProjectColor(project: string): string {
  let hash = 0
  for (let i = 0; i < project.length; i++) {
    hash = ((hash << 5) - hash) + project.charCodeAt(i)
    hash |= 0
  }
  return WAF_COLORS[Math.abs(hash) % WAF_COLORS.length]
}

function scoreLabel(s: number) {
  return s >= 80 ? 'Excellent' : s >= 60 ? 'Needs Attention' : 'High Risk'
}

interface FlakyProject {
  project: string
  switches: number
  recentRuns: number
  passCount: number
  failCount: number
}

function detectFlakyProjects(runs: RunSummary[], windowSize = 5): FlakyProject[] {
  const byProject: Record<string, RunSummary[]> = {}
  for (const r of runs) {
    if (!r.is_cicd) continue
    ;(byProject[r.project] ??= []).push(r)
  }
  const flaky: FlakyProject[] = []
  for (const [project, list] of Object.entries(byProject)) {
    const sorted = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, windowSize)
    if (sorted.length < 3) continue
    let switches = 0
    let prevPass: boolean | null = null
    let passCount = 0
    let failCount = 0
    for (const r of sorted) {
      const isPass = r.score >= 80
      if (isPass) passCount++
      else failCount++
      if (prevPass !== null && prevPass !== isPass) switches++
      prevPass = isPass
    }
    if (passCount > 0 && failCount > 0 && switches >= 1) {
      flaky.push({ project, switches, recentRuns: sorted.length, passCount, failCount })
    }
  }
  return flaky.sort((a, b) => b.switches - a.switches)
}

function forecastDuration(runs: RunSummary[], trends?: PipelineTrends | null): { predicted: string; trend: 'up' | 'down' | 'flat'; confidence: string } {
  const stats = trends?.durationStats
  if (!stats || stats.avg === 0) {
    return { predicted: '—', trend: 'flat', confidence: '' }
  }
  // Simple trend: compare avg of last 7 days vs previous 7 days from raw runs
  const now = Date.now()
  const recent = runs.filter(r => r.completed_at && now - new Date(r.completed_at).getTime() <= 7 * 86400 * 1000)
  const previous = runs.filter(r => {
    if (!r.completed_at) return false
    const ms = now - new Date(r.completed_at).getTime()
    return ms > 7 * 86400 * 1000 && ms <= 14 * 86400 * 1000
  })
  const avg = (arr: RunSummary[]) => {
    const vals = arr.map(r => new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime()).filter(v => v > 0)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }
  const recentAvg = avg(recent)
  const previousAvg = avg(previous)
  let trend: 'up' | 'down' | 'flat' = 'flat'
  if (recentAvg && previousAvg) {
    const change = (recentAvg - previousAvg) / previousAvg
    if (change > 0.1) trend = 'up'
    else if (change < -0.1) trend = 'down'
  }
  return { predicted: stats.avgLabel, trend, confidence: `${stats.minLabel} – ${stats.maxLabel}` }
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
    const diff = Date.now() - new Date(iso).getTime()
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

function CICDBadge({ isCICD }: { isCICD: boolean }) {
  if (!isCICD) return <span style={{ fontSize: '0.62rem', fontWeight: 400, color: 'var(--muted)' }}>manual</span>
  return (
    <span style={{ padding: '0.1rem 0.45rem', borderRadius: '4px', background: 'color-mix(in srgb, var(--pass) 10%, transparent)', color: 'var(--pass)', fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      CI/CD
    </span>
  )
}

export default function PipelineOperationsCenter({ navigate }: { navigate?: (page: Page) => void }) {
  const { t } = useI18n()
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null)
  const [trends, setTrends] = useState<PipelineTrends | null>(null)
  const [chartRuns, setChartRuns] = useState<RunSummary[]>([])
  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showManualRuns, setShowManualRuns] = useState(false)

  const isCicdFilter = showManualRuns ? undefined : true

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [m, tr, allRuns] = await Promise.all([
          fetchPipelineMetrics(isCicdFilter),
          fetchPipelineTrends(isCicdFilter),
          fetchRuns({ limit: 200 }),
        ])
        if (cancelled) return
        setMetrics(m)
        setTrends(tr)
        const filteredRuns = isCicdFilter === true
          ? allRuns.items.filter(r => r.is_cicd)
          : isCicdFilter === false
            ? allRuns.items.filter(r => !r.is_cicd)
            : allRuns.items
        setChartRuns(filteredRuns)
        setRecentRuns(filteredRuns.slice(0, 8))
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load pipeline data')
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [isCicdFilter])

  const topProjects = useMemo(() => metrics?.projectsList ?? [], [metrics])

  const runsByDay = useMemo(() => {
    const byDay: Record<string, RunSummary[]> = {}
    for (const r of chartRuns) {
      const dayKey = r.created_at.slice(0, 10)
      ;(byDay[dayKey] ??= []).push(r)
    }
    const result: { day: string; count: number; visible: number; runs: RunSummary[] }[] = []
    for (let i = 30; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayKey = date.toISOString().split('T')[0]
      const dayData = byDay[dayKey] ?? []
      const sorted = [...dayData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      result.push({ day: dayKey, count: dayData.length, visible: 7, runs: sorted.slice(0, 7) })
    }
    return result
  }, [chartRuns])

  const durationRange = useMemo(() => {
    const stats = trends?.durationStats
    if (!stats || stats.min === 0 && stats.max === 0) return '—'
    if (stats.min === stats.max) return stats.avgLabel
    return `${stats.minLabel} – ${stats.maxLabel}`
  }, [trends])

  const flakyProjects = useMemo(() => detectFlakyProjects(chartRuns), [chartRuns])
  const durationForecast = useMemo(() => forecastDuration(chartRuns, trends), [chartRuns, trends])

  const linkCard = (page: Page, label: string, icon: string, color: string) => (
    <button
      key={page}
      onClick={() => navigate?.(page)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.9rem 1rem',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color
        e.currentTarget.style.background = `color-mix(in srgb, ${color} 6%, transparent)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'var(--surface)'
      }}
    >
      <div style={{ color, flexShrink: 0 }}><Icon path={icon} size={20} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('common.view')} →</div>
      </div>
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <CenterHero
        eyebrow="Operations Center"
        title={t('pages.pipelineOps.title')}
        subtitle={t('pages.pipelineOps.subtitle')}
        accent="var(--waf-warn)"
      >
        {!loading && metrics && (
          <div style={{ textAlign: 'right', minWidth: '140px' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>
              {t('pages.pipelines.averageScore')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreColor(metrics.avgScore) }}>{metrics.avgScore}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/100</span>
            </div>
          </div>
        )}
      </CenterHero>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <KpiCard
          label={t('pages.pipelines.totalScans')}
          value={metrics?.totalRuns ?? '—'}
          sub={t('pages.pipelines.allTimeExecutions')}
          color="var(--waf-brand)"
          icon="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KpiCard
          label={t('pages.pipelines.passRate')}
          value={metrics ? `${metrics.passRate}%` : '—'}
          sub={`${metrics?.failedRuns ?? 0} ${t('pages.pipelines.scansNeedingAttention')}`}
          color={metrics && metrics.passRate >= 80 ? 'var(--score-high)' : 'var(--waf-warn)'}
          icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KpiCard
          label={t('pages.pipelines.averageScore')}
          value={metrics?.avgScore ?? '—'}
          sub={metrics ? scoreLabel(metrics.avgScore) : ''}
          color={scoreColor(metrics?.avgScore ?? 0)}
          icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
        <KpiCard
          label={t('pages.pipelines.activeProjects')}
          value={metrics?.projects ?? '—'}
          sub={t('pages.pipelines.uniqueProjectsScanned')}
          color="var(--waf-info)"
          icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
        <KpiCard
          label={t('pages.pipelineOps.recentRuns')}
          value={metrics?.recentRuns ?? '—'}
          sub={t('pages.pipelineOps.last7Days')}
          color="var(--pass)"
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KpiCard
          label={t('pages.pipelineOps.durationRange')}
          value={durationRange}
          sub={t('pages.pipelineOps.scanDuration')}
          color="var(--waf-warn)"
          icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '260px', color: 'var(--muted)' }}>
          <div className="spinner" />
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <Icon path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" size={32} />
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>{error}</div>
        </div>
      ) : metrics?.totalRuns === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <Icon path="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={32} />
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>{t('pages.pipelines.noPipelineData')}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>{t('pages.pipelines.noPipelineDataHint')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem' }}>
          {/* Scan frequency */}
          <SectionCard
            title={t('pages.pipelines.scanFrequency')}
            icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            action={
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={showManualRuns} onChange={e => setShowManualRuns(e.target.checked)} style={{ accentColor: 'var(--waf-brand)' }} />
                {t('pages.pipelineOps.showManualRuns')}
              </label>
            }
          >
            {runsByDay.every(d => d.count === 0) ? (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>
                {t('pages.pipelines.noScanDataLast30Days')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: '2px', padding: '0.5rem 0', height: 160 }}>
                  {runsByDay.map((day) => {
                    const visibleCount = day.runs.length
                    const hiddenCount = Math.max(0, day.count - visibleCount)
                    return (
                      <div
                        key={day.day}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: 0, height: '100%' }}
                        title={`${new Date(day.day).toLocaleDateString('en-GB')}: ${day.count} runs${hiddenCount > 0 ? ` (${visibleCount} shown, +${hiddenCount} more)` : ''}`}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flexWrap: 'wrap',
                            justifyContent: 'flex-end',
                            alignContent: 'center',
                            width: '100%',
                            maxWidth: '48px',
                            height: '100%',
                            gap: '2px',
                          }}
                        >
                          {day.runs.map((run, j) => (
                            <button
                              key={run.id ?? j}
                              onClick={() => navigate?.('runs')}
                              title={`${run.project}: ${run.score}`}
                              style={{
                                width: 9,
                                height: 9,
                                minWidth: 9,
                                minHeight: 9,
                                borderRadius: '50%',
                                border: '1.5px solid var(--card-bg)',
                                background: getProjectColor(run.project),
                                boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                                cursor: 'pointer',
                                padding: 0,
                                transition: 'transform 0.15s ease',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.35)' }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                            />
                          ))}
                        </div>
                        {day.count > 0 && (
                          <span style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700 }}>{day.count}</span>
                        )}
                        <span style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>
                          {new Date(day.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.65rem', color: 'var(--muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--waf-brand)' }} /> run by project</span>
                  <span style={{ marginLeft: 'auto' }}>{t('pages.pipelines.last30Days')}</span>
                </div>
              </div>
            )}
          </SectionCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem', alignItems: 'start' }}>
            {/* Top projects */}
            <SectionCard
              title={t('pages.pipelines.topPerformingProjects')}
              icon="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            >
              {topProjects.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>{t('common.noData')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {topProjects.map((proj) => (
                    <PriorityRow
                      key={proj.project}
                      label={proj.project}
                      count={proj.avgScore}
                      total={100}
                      color={scoreColor(proj.avgScore)}
                      meta={`${proj.runCount} runs · latest ${proj.latestScore}`}
                      badge={
                        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: getProjectColor(proj.project), flexShrink: 0 }} />
                      }
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Recent runs */}
            <SectionCard
              title={t('pages.pipelines.recentRuns')}
              icon="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              action={
                <button onClick={() => navigate?.('runs')} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--waf-brand)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {t('common.view')} →
                </button>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {recentRuns.map((run) => (
                  <div key={run.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.7rem', borderRadius: '8px', background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{run.project}</span>
                        <CICDBadge isCICD={run.is_cicd} />
                      </div>
                      <span style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>{getTimeAgo(run.created_at)}</span>
                    </div>
                    <MiniBadge color={scoreColor(run.score)}>{run.score}</MiniBadge>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Quick links */}
            <RightRail>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '0.25rem' }}>
                {t('common.view')}
              </div>
              {linkCard('runs', t('nav.items.runs'), 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z', 'var(--waf-brand)')}
              {linkCard('dashboard', t('nav.items.dashboard'), 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', 'var(--pass)')}
              {linkCard('projectoverview', t('nav.items.projectoverview'), 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2', 'var(--waived)')}
              {linkCard('runscan', t('nav.items.runscan'), 'M13 10V3L4 14h7v7l9-11h-7z', 'var(--waf-warn)')}
            </RightRail>
          </div>

          {/* Predictive analytics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem', alignItems: 'start' }}>
            <SectionCard title={t('pages.pipelineOps.flakyPipelines')} icon="M13 10V3L4 14h7v7l9-11h-7z">
              {flakyProjects.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={20} />
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{t('pages.pipelineOps.flakyNoIssues')}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--waf-warn)' }}>
                    {t('pages.pipelineOps.flakyCount', { count: flakyProjects.length })}
                  </div>
                  {flakyProjects.slice(0, 4).map((fp) => (
                    <PriorityRow
                      key={fp.project}
                      label={fp.project}
                      count={fp.switches}
                      total={fp.recentRuns - 1}
                      color={getProjectColor(fp.project)}
                      meta={t('pages.pipelineOps.flakySwitches', { count: fp.switches, window: fp.recentRuns })}
                      badge={
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <span style={{ fontSize: '0.6rem', color: 'var(--pass)', fontWeight: 700 }}>{fp.passCount}P</span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--fail)', fontWeight: 700 }}>{fp.failCount}F</span>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title={t('pages.pipelineOps.durationForecast')} icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('pages.pipelineOps.predictedDuration')}</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>{durationForecast.predicted}</div>
                  </div>
                  <MiniBadge color={durationForecast.trend === 'up' ? 'var(--waf-warn)' : durationForecast.trend === 'down' ? 'var(--pass)' : 'var(--waf-info)'}>
                    {durationForecast.trend === 'up' ? t('pages.pipelineOps.durationTrendUp') : durationForecast.trend === 'down' ? t('pages.pipelineOps.durationTrendDown') : t('pages.pipelineOps.durationTrendFlat')}
                  </MiniBadge>
                </div>
                {durationForecast.confidence && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    {t('pages.pipelineOps.durationConfidence', { range: durationForecast.confidence })}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.65rem', color: 'var(--muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pass)' }} /> faster</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--waf-warn)' }} /> slower</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--waf-info)' }} /> stable</span>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  )
}
