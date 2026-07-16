import { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { RunSummary } from '../../api'
import { useI18n } from '../../i18n'
import { FilterState, scoreColor } from '../../routing'
import { aggregateScore, companyTrend, JOURNEY_STAGES, latestRunByProject, nextStage, pointsToNextStage, stageFor } from '../journeyUtils'
import JourneyCard from './components/JourneyCard'
import ProjectRunwayGrid from './components/ProjectRunwayGrid'
import StageBadge, { StageBadgeByIdx } from './components/StageBadge'

export interface CompanyJourneyProps {
  runs: RunSummary[]
  onSetFilters: (filters: FilterState) => void
}

export default function CompanyJourney({ runs, onSetFilters }: CompanyJourneyProps) {
  const { t } = useI18n()
  const score = aggregateScore(runs)
  const st = stageFor(score)
  const next = nextStage(score)
  const pts = pointsToNextStage(score)
  const trend = useMemo(() => companyTrend(runs), [runs])
  const latest = latestRunByProject(runs)
  const projects = Object.entries(latest)

  const stageDistribution = useMemo(() => {
    const counts = Array(JOURNEY_STAGES.length).fill(0)
    for (const [, run] of projects) {
      counts[stageFor(run.score).idx] += 1
    }
    return JOURNEY_STAGES.map((s, i) => ({ ...s, count: counts[i] }))
  }, [projects])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <JourneyCard accent={st.color}>
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{t('pages.journey.companyAverage')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: scoreColor(score) }}>{score}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>/100</span>
            </div>
          </div>
        </JourneyCard>

        <JourneyCard accent={st.color}>
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{t('pages.journey.companyStage')}</div>
            <StageBadge score={score} />
          </div>
        </JourneyCard>

        <JourneyCard accent={st.color}>
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{t('pages.journey.projectsTracked')}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>{projects.length}</div>
          </div>
        </JourneyCard>

        <JourneyCard accent={st.color}>
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{t('pages.journey.totalRuns')}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>{runs.length}</div>
          </div>
        </JourneyCard>
      </div>

      {/* Trend chart + stage distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <JourneyCard
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>{t('pages.journey.companyTrend')}</div>
          {trend.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="j-company-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DA2C38" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#DA2C38" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={28} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.75rem' }}>
                        <div style={{ color: 'var(--muted)', marginBottom: '0.2rem' }}>{d.date}</div>
                        <div style={{ fontWeight: 800, color: scoreColor(d.score), fontSize: '1rem' }}>{d.score}/100</div>
                      </div>
                    )
                  }}
                />
                <ReferenceLine y={80} stroke="#059669" strokeDasharray="4 4" strokeOpacity={0.5} />
                <ReferenceLine y={60} stroke="#d97706" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#DA2C38"
                  strokeWidth={2}
                  fill="url(#j-company-grad)"
                  dot={{ r: 4, fill: '#DA2C38' }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>
              {t('pages.journey.needMoreRuns')}
            </div>
          )}
        </JourneyCard>

        <JourneyCard
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>{t('pages.journey.stageDistribution')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {stageDistribution.map(s => (
              <div key={s.idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '150px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <StageBadgeByIdx idx={s.idx} size="sm" short />
                </div>
                <div style={{ flex: 1, height: 10, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${projects.length ? (s.count / projects.length) * 100 : 0}%`, background: s.color, borderRadius: 999 }} />
                </div>
                <div style={{ width: 36, textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>{s.count}</div>
              </div>
            ))}
          </div>

          {next && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.journey.companyNextMilestone')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{t('pages.journey.pointsToNext', { points: String(pts), stage: next.label })}</span>
              </div>
            </div>
          )}
        </JourneyCard>
      </div>

      {/* Project runway */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('pages.journey.projectRunway')}</h3>
        </div>
        <ProjectRunwayGrid runs={runs} onSelectProject={p => onSetFilters({ project: p })} />
      </div>
    </div>
  )
}
