import { useMemo } from 'react'
import { RunDetail, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { Page, scoreColor } from '../routing'
import { aggregateScore, companyTrend, JOURNEY_STAGES, latestRunByProject, nextStage, pointsToNextStage, stageFor } from './journeyUtils'
import { CenterHero, Icon, KpiCard, MiniBadge, PriorityRow, RightRail, SectionCard, TwoColumnGrid } from './OperationsCenterShell'
import StageBadge from './journey/components/StageBadge'

function TrendLineChart({ data }: { data: { date: string; score: number }[] }) {
  const padding = { top: 28, right: 28, bottom: 42, left: 44 }
  const width = 800
  const height = 360
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const xFor = (i: number) => padding.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2)
  const yFor = (score: number) => padding.top + chartH - (score / 100) * chartH

  const points = data.map((d, i) => ({ x: xFor(i), y: yFor(d.score), ...d }))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
      {/* Background grid lines */}
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={padding.left}
            y1={yFor(tick)}
            x2={width - padding.right}
            y2={yFor(tick)}
            stroke="var(--border)"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <text x={padding.left - 10} y={yFor(tick) + 4} textAnchor="end" fontSize={12} fill="var(--muted)">{tick}</text>
        </g>
      ))}

      {/* Area under the line */}
      <path
        d={`${linePath} L ${points[points.length - 1]?.x ?? xFor(0)} ${padding.top + chartH} L ${points[0]?.x ?? xFor(0)} ${padding.top + chartH} Z`}
        fill="rgba(218, 44, 56, 0.1)"
      />

      {/* Trend line */}
      <path
        d={linePath}
        fill="none"
        stroke="#DA2C38"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={p.x} cy={p.y} r={7} fill={scoreColor(p.score)} stroke="var(--surface)" strokeWidth={3} />
          <text x={p.x} y={p.y - 16} textAnchor="middle" fontSize={13} fontWeight={800} fill={scoreColor(p.score)}>{p.score}</text>
          <text
            x={p.x}
            y={height - 14}
            textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
            fontSize={11}
            fill="var(--muted)"
          >
            {p.date.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function MaturityOperationsCenter({
  run,
  runs,
  navigate,
}: {
  run: RunDetail | null
  runs: RunSummary[]
  navigate: (page: Page) => void
}) {
  const { t } = useI18n()

  const companyScore = useMemo(() => aggregateScore(runs), [runs])
  const companyStage = stageFor(companyScore)
  const next = nextStage(companyScore)
  const pts = pointsToNextStage(companyScore)
  const trend = useMemo(() => companyTrend(runs), [runs])
  const latest = useMemo(() => latestRunByProject(runs), [runs])
  const projects = Object.entries(latest)

  const stageDistribution = useMemo(() => {
    const counts = Array(JOURNEY_STAGES.length).fill(0)
    for (const [, r] of projects) {
      counts[stageFor(r.score).idx] += 1
    }
    return JOURNEY_STAGES.map((s, i) => ({ ...s, count: counts[i] }))
  }, [projects])

  const topProjects = useMemo(() => {
    return [...projects]
      .map(([, r]) => r)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
  }, [projects])

  const bottomProjects = useMemo(() => {
    return [...projects]
      .map(([, r]) => r)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6)
  }, [projects])

  const linkCard = (page: Page, label: string, icon: string, color: string) => (
    <button
      key={page}
      onClick={() => navigate(page)}
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
        title={t('pages.maturityOps.title')}
        subtitle={t('pages.maturityOps.subtitle')}
        accent="#DA2C38"
      >
        {runs.length > 0 && (
          <div style={{ textAlign: 'right', minWidth: '180px' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>
              {t('pages.journey.companyAverage')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreColor(companyScore) }}>{companyScore}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/100</span>
            </div>
            <div style={{ marginTop: '0.25rem' }}>
              <StageBadge score={companyScore} size="sm" />
            </div>
          </div>
        )}
      </CenterHero>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <KpiCard
          label={t('pages.journey.companyAverage')}
          value={companyScore}
          sub={t('pages.journey.companyStage')}
          color={companyStage.color}
          icon="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
        />
        <KpiCard
          label={t('pages.journey.projectsTracked')}
          value={projects.length}
          sub={t('common.projects')}
          color="#0094ff"
          icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
        <KpiCard
          label={t('pages.journey.totalRuns')}
          value={runs.length}
          sub={t('pages.runs.runs')}
          color="#22c55e"
          icon="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KpiCard
          label={t('pages.maturityOps.selectedProject')}
          value={run?.project ?? '—'}
          sub={run ? `${run.score}/100 · ${stageFor(run.score).shortLabel}` : t('pages.costImpact.noRun')}
          color="#8b5cf6"
          icon="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
        />
      </div>

      {runs.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <Icon path="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" size={32} />
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>{t('pages.journey.noProjects')}</div>
        </div>
      ) : (
        <TwoColumnGrid>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: 0 }}>
            {/* Stage distribution */}
            <SectionCard title={t('pages.journey.stageDistribution')} icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {stageDistribution.map((s) => {
                  const pct = projects.length ? (s.count / projects.length) * 100 : 0
                  return (
                    <div key={s.idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '110px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '1rem' }}>{s.icon}</span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)' }}>{s.shortLabel}</span>
                            <span style={{ fontSize: '0.58rem', color: 'var(--muted)' }}>{s.range}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ flex: 1, height: '10px', background: 'var(--bg)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: '999px' }} />
                      </div>
                      <div style={{ width: '50px', textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)' }}>{s.count}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)', marginLeft: '0.15rem' }}>{pct >= 10 ? `${Math.round(pct)}%` : ''}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {next && (
                <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.journey.companyNextMilestone')}</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>{t('pages.journey.pointsToNext', { points: String(pts), stage: next.label })}</div>
                </div>
              )}
            </SectionCard>

            {/* Company score trend */}
            <SectionCard
              title={t('pages.journey.companyTrend')}
              icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              style={{ minHeight: '420px' }}
            >
              {trend.length > 1 ? (
                <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
                  <TrendLineChart data={trend} />
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>{t('pages.journey.needMoreRuns')}</div>
              )}
            </SectionCard>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: 0 }}>
            {/* Top projects */}
            <SectionCard
              title={t('pages.globaldashboard.topProjects')}
              icon="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              action={
                <button onClick={() => navigate('leaderboard')} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--waf-brand)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {t('common.view')} →
                </button>
              }
            >
              {topProjects.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>{t('common.noData')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {topProjects.map((r) => (
                    <PriorityRow
                      key={r.project}
                      label={r.project}
                      count={r.score}
                      total={100}
                      color={scoreColor(r.score)}
                      meta={stageFor(r.score).shortLabel}
                      badge={<MiniBadge color={scoreColor(r.score)}>{r.score}</MiniBadge>}
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Bottom projects */}
            <SectionCard
              title={t('pages.dashboard.needsAttention')}
              icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            >
              {bottomProjects.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>{t('pages.remediation.allPassing')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {bottomProjects.map((r) => (
                    <PriorityRow
                      key={r.project}
                      label={r.project}
                      count={100 - r.score}
                      total={100}
                      color="#DA2C38"
                      meta={stageFor(r.score).shortLabel}
                      badge={<MiniBadge color="#DA2C38">{r.score}</MiniBadge>}
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            <RightRail>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '0.25rem' }}>
                {t('common.view')}
              </div>
              {linkCard('journey', t('nav.items.journey'), 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8', '#DA2C38')}
              {linkCard('passports', t('nav.items.passports'), 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2', '#0094ff')}
              {linkCard('leaderboard', t('nav.items.leaderboard'), 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', '#8b5cf6')}
              {linkCard('projectoverview', t('nav.items.dashboard'), 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', '#22c55e')}
            </RightRail>
          </div>
        </TwoColumnGrid>
      )}
    </div>
  )
}
