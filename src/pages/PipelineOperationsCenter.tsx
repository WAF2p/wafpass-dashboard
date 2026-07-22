import { useEffect, useMemo, useState } from 'react'
import { fetchRuns, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { Page, scoreColor } from '../routing'
import { CenterHero, Icon, KpiCard, MiniBadge, PriorityRow, RightRail, SectionCard, StubBanner } from './OperationsCenterShell'

const WAF_COLORS = [
  '#93c5fd', '#c4b5fd', '#67e8f9', '#6ee7b7', '#fcd34d', '#fca5a5',
  '#60a5fa', '#a78bfa', '#818cf8', '#f9a8d4', '#5eead4', '#fb923c',
  '#a3e635', '#94a3b8',
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
    <span style={{ padding: '0.1rem 0.45rem', borderRadius: '4px', background: '#10b9811a', color: '#10b981', fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      CI/CD
    </span>
  )
}

export default function PipelineOperationsCenter({ navigate }: { navigate?: (page: Page) => void }) {
  const { t } = useI18n()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showManualRuns, setShowManualRuns] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const all: RunSummary[] = []
        let cursor: string | null = null
        for (let i = 0; i < 3; i++) {
          const result = await fetchRuns({ limit: 50, cursor: cursor ?? undefined })
          if (cancelled) return
          all.push(...result.items)
          cursor = result.nextCursor
          if (!cursor) break
        }
        if (!cancelled) {
          setRuns(all)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load pipeline data')
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filteredRuns = useMemo(() => showManualRuns ? runs : runs.filter(r => r.is_cicd), [runs, showManualRuns])

  const metrics = useMemo(() => {
    if (filteredRuns.length === 0) {
      return { totalRuns: 0, passRate: 0, avgScore: 0, projects: 0, recentRuns: 0, needingAttention: 0 }
    }
    const totalRuns = filteredRuns.length
    const passCount = filteredRuns.filter(r => r.score >= 80).length
    const passRate = Math.round((passCount / totalRuns) * 100)
    const avgScore = Math.round(filteredRuns.reduce((sum, r) => sum + r.score, 0) / totalRuns)
    const projects = new Set(filteredRuns.map(r => r.project)).size
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const recentRuns = filteredRuns.filter(r => new Date(r.created_at) > oneWeekAgo).length
    const needingAttention = totalRuns - passCount
    return { totalRuns, passRate, avgScore, projects, recentRuns, needingAttention }
  }, [filteredRuns])

  const runsByDay = useMemo(() => {
    const byDay: Record<string, RunSummary[]> = {}
    for (const r of filteredRuns) {
      const dayKey = r.created_at.slice(0, 10)
      ;(byDay[dayKey] ??= []).push(r)
    }
    const result: { day: string; count: number; runs: RunSummary[] }[] = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayKey = date.toISOString().split('T')[0]
      const dayData = byDay[dayKey]
      result.push({ day: dayKey, count: dayData?.length || 0, runs: dayData || [] })
    }
    return result
  }, [filteredRuns])

  const topProjects = useMemo(() => {
    const projectScores: Record<string, { scores: number[]; latest: RunSummary }> = {}
    for (const r of filteredRuns) {
      if (!projectScores[r.project]) projectScores[r.project] = { scores: [], latest: r }
      projectScores[r.project].scores.push(r.score)
      if (new Date(r.created_at) > new Date(projectScores[r.project].latest.created_at)) {
        projectScores[r.project].latest = r
      }
    }
    return Object.entries(projectScores)
      .map(([project, data]) => ({
        project,
        avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        latestScore: data.latest.score,
        runCount: data.scores.length,
        latestAt: data.latest.created_at,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 6)
  }, [filteredRuns])

  const recentRuns = useMemo(() => filteredRuns.slice(0, 5), [filteredRuns])

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
        e.currentTarget.style.background = `${color}10`
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
        accent="#f59e0b"
      >
        {!loading && (
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

      <StubBanner
        title={t('pages.pipelineOps.stubsInProgress')}
        description={t('pages.pipelineOps.stubsVoteRfc')}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <KpiCard
          label={t('pages.pipelines.totalScans')}
          value={metrics.totalRuns}
          sub={t('pages.pipelines.allTimeExecutions')}
          color="var(--waf-brand)"
          icon="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KpiCard
          label={t('pages.pipelines.passRate')}
          value={`${metrics.passRate}%`}
          sub={`${metrics.needingAttention} ${t('pages.pipelines.scansNeedingAttention')}`}
          color={metrics.passRate >= 80 ? '#059669' : '#d97706'}
          icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KpiCard
          label={t('pages.pipelines.averageScore')}
          value={metrics.avgScore}
          sub={scoreLabel(metrics.avgScore)}
          color={scoreColor(metrics.avgScore)}
          icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
        <KpiCard
          label={t('pages.pipelines.activeProjects')}
          value={metrics.projects}
          sub={t('pages.pipelines.uniqueProjectsScanned')}
          color="#8b5cf6"
          icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
        <KpiCard
          label={t('pages.pipelineOps.recentRuns')}
          value={metrics.recentRuns}
          sub={t('pages.pipelineOps.last7Days')}
          color="#22c55e"
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          demo
        />
        <KpiCard
          label={t('pages.pipelineOps.durationRange')}
          value="2–9m"
          sub={t('pages.pipelineOps.scanDuration')}
          color="#f97316"
          icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          demo
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
      ) : filteredRuns.length === 0 ? (
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
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', padding: '0.5rem 0', height: 160 }}>
                  {runsByDay.map((day) => (
                    <div key={day.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '48px', gap: '2px', justifyContent: 'flex-end', height: '100%' }}>
                        {day.runs.map((run, j) => (
                          <div
                            key={j}
                            onClick={() => navigate?.('dashboard')}
                            style={{
                              width: '100%',
                              height: '14px',
                              background: getProjectColor(run.project),
                              borderRadius: '2px',
                              cursor: 'pointer',
                              opacity: 0.92,
                            }}
                            title={`${run.project}: ${run.score}`}
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
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--muted)' }}>
                  <span>{runsByDay[0]?.day ? new Date(runsByDay[0].day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span>
                  <span>{t('pages.pipelines.last30Days')}</span>
                  <span>{runsByDay[runsByDay.length - 1]?.day ? new Date(runsByDay[runsByDay.length - 1].day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span>
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
              {linkCard('runs', t('nav.items.runs'), 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z', '#0094ff')}
              {linkCard('dashboard', t('nav.items.dashboard'), 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', '#22c55e')}
              {linkCard('projectoverview', t('nav.items.projectoverview'), 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2', '#8b5cf6')}
              {linkCard('runscan', t('nav.items.runscan'), 'M13 10V3L4 14h7v7l9-11h-7z', '#f59e0b')}
            </RightRail>
          </div>
        </div>
      )}
    </div>
  )
}
