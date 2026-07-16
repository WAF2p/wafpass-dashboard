import { useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { RunSummary } from '../../api'
import { useI18n } from '../../i18n'
import { FilterState, Page, scoreColor } from '../../routing'
import { controlsForLevel, MATURITY_META } from '../settingsUtils'
import { nextStage, pointsToNextStage, runsForProject, stageFor } from '../journeyUtils'
import JourneyCard from './components/JourneyCard'
import StageBadge from './components/StageBadge'

export interface ProjectJourneyProps {
  project: string
  runs: RunSummary[]
  onSetFilters: (filters: FilterState) => void
  onNavigate: (page: Page) => void
}

const PILLAR_META = [
  { key: 'security',       label: 'Security',       color: '#DA2C38' },
  { key: 'cost',           label: 'Cost',           color: '#0094FF' },
  { key: 'operations',     label: 'Operations',     color: '#8b5cf6' },
  { key: 'performance',    label: 'Performance',    color: '#f97316' },
  { key: 'reliability',    label: 'Reliability',    color: '#22c55e' },
  { key: 'sovereign',      label: 'Sovereignty',    color: '#eab308' },
  { key: 'sustainability', label: 'Sustainability', color: '#14b8a6' },
  { key: 'agentic',        label: 'Agentic',        color: '#ec4899' },
]

function normalizePillarName(pillar: string): string {
  if (pillar === 'operational') return 'operations'
  return pillar
}

function fmt(iso: string) { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
function fmtFull(iso: string) { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }

const ACHIEVEMENTS = [
  { id: 'first_scan', title: 'First Scan', description: 'Complete your first WAF++ scan', check: (rs: RunSummary[]) => rs.length >= 1 },
  { id: 'score_60', title: 'Above Average', description: 'Achieve a score of 60 or higher', check: (rs: RunSummary[]) => rs.some(r => r.score >= 60) },
  { id: 'score_80', title: 'High Performer', description: 'Achieve a score of 80 or higher', check: (rs: RunSummary[]) => rs.some(r => r.score >= 80) },
  { id: 'score_90', title: 'Security Champion', description: 'Achieve a score of 90 or higher', check: (rs: RunSummary[]) => rs.some(r => r.score >= 90) },
  { id: 'five_scans', title: 'Regular Cadence', description: 'Complete 5 or more scans', check: (rs: RunSummary[]) => rs.length >= 5 },
  { id: 'ten_scans', title: 'Consistent Reviewer', description: 'Complete 10 or more scans', check: (rs: RunSummary[]) => rs.length >= 10 },
  { id: 'improving', title: 'On the Up', description: '3 consecutive score improvements', check: (rs: RunSummary[]) => {
    if (rs.length < 3) return false
    const sorted = [...rs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    for (let i = sorted.length - 1; i >= 2; i--) {
      if (sorted[i].score > sorted[i - 1].score && sorted[i - 1].score > sorted[i - 2].score) return true
    }
    return false
  }},
  { id: 'multi_branch', title: 'Branch Coverage', description: 'Scans across 3 or more branches', check: (rs: RunSummary[]) => new Set(rs.map(r => r.branch).filter(Boolean)).size >= 3 },
  { id: 'multi_stage', title: 'Pipeline Pro', description: 'Scans across 3 or more pipeline stages', check: (rs: RunSummary[]) => new Set(rs.map(r => r.stage).filter(Boolean)).size >= 3 },
]

export default function ProjectJourney({
  project, runs, onSetFilters, onNavigate,
}: ProjectJourneyProps) {
  const { t } = useI18n()
  const projectRuns = useMemo(() => runsForProject(runs, project), [runs, project])
  const latestRun = projectRuns[projectRuns.length - 1] ?? null
  const prevRun = projectRuns[projectRuns.length - 2] ?? null
  const scoreDelta = latestRun && prevRun ? latestRun.score - prevRun.score : null
  const bestScore = projectRuns.reduce((best, r) => Math.max(best, r.score), 0)

  const st = stageFor(latestRun?.score ?? 0)
  const next = nextStage(latestRun?.score ?? 0)
  const pts = pointsToNextStage(latestRun?.score ?? 0)

  const trendData = useMemo(
    () => projectRuns.map(r => ({ date: fmt(r.created_at), score: r.score, branch: r.branch, id: r.id })),
    [projectRuns],
  )

  const pillarData = useMemo(() => {
    if (!latestRun) return []
    const normalizedScores: Record<string, number> = {}
    if (latestRun.pillar_scores) {
      for (const [key, value] of Object.entries(latestRun.pillar_scores)) {
        normalizedScores[normalizePillarName(key)] = value
      }
    }
    return PILLAR_META.map(p => ({ pillar: p.label, score: normalizedScores[p.key] ?? 0, color: p.color }))
  }, [latestRun])

  const achievementBadges = useMemo(
    () => ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(projectRuns) })),
    [projectRuns],
  )
  const earnedCount = achievementBadges.filter(b => b.earned).length

  const maturityBadges = useMemo(
    () => MATURITY_META.map(m => {
      const thresholds: Record<number, number> = { 1: 0, 2: 40, 3: 60, 4: 75, 5: 90 }
      return { ...m, earned: bestScore >= thresholds[m.level] }
    }),
    [bestScore],
  )
  const earnedMaturityCount = maturityBadges.filter(b => b.earned).length

  const branchCount = new Set(projectRuns.map(r => r.branch).filter(Boolean)).size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header / project selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={() => onSetFilters({ view: 'frontpage' })}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.35rem 0.75rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
            cursor: 'pointer', border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--muted)',
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('pages.journey.backToJourney')}
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', minWidth: 0 }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--muted)', flexShrink: 0 }}>{t('pages.journey.projectViewLabel')}</span>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <JourneyCard accent={st.color}>
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{t('pages.journey.latestScore')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: scoreColor(latestRun?.score ?? 0) }}>{latestRun?.score ?? '—'}</span>
              {latestRun && <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>/100</span>}
            </div>
            {scoreDelta !== null && (
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: scoreDelta >= 0 ? '#22c55e' : '#f87171' }}>
                {scoreDelta >= 0 ? '+' : ''}{scoreDelta}
              </span>
            )}
          </div>
        </JourneyCard>

        <JourneyCard accent={st.color}>
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{t('pages.journey.bestScore')}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: scoreColor(bestScore) }}>{bestScore}</div>
          </div>
        </JourneyCard>

        <JourneyCard accent={st.color}>
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{t('pages.journey.totalScans')}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>{projectRuns.length}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{branchCount} {t('pages.journey.branches')}</div>
          </div>
        </JourneyCard>

        <JourneyCard accent={st.color}>
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{t('pages.journey.badgesEarned')}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>
              {earnedMaturityCount + earnedCount}
              <span style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: 400 }}>/{MATURITY_META.length + ACHIEVEMENTS.length}</span>
            </div>
          </div>
        </JourneyCard>
      </div>

      {/* Progress to next stage */}
      {latestRun && next && (
        <JourneyCard accent={st.color}>
          <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <StageBadge score={latestRun.score} />
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>→</span>
                <StageBadge score={next.min} />
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)' }}>{pts} {t('pages.journey.pointsNeeded')}</span>
            </div>
            <div style={{ height: 10, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${latestRun.score}%`, background: `linear-gradient(90deg, ${st.color}, ${next.color})`, borderRadius: 999 }} />
            </div>
          </div>
        </JourneyCard>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <JourneyCard style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>{t('pages.journey.scoreTrend')}</div>
          {trendData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} onClick={d => { if (d?.activePayload?.[0]?.payload?.id) onNavigate('dashboard') }} style={{ cursor: 'pointer' }}>
                <defs>
                  <linearGradient id="j-proj-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={st.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={st.color} stopOpacity={0.02} />
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
                        <div style={{ color: 'var(--muted)', marginBottom: '0.2rem' }}>{d.date}{d.branch ? ` · ${d.branch}` : ''}</div>
                        <div style={{ fontWeight: 800, color: scoreColor(d.score), fontSize: '1rem' }}>{d.score}/100</div>
                      </div>
                    )
                  }}
                />
                <ReferenceLine y={80} stroke="#059669" strokeDasharray="4 4" strokeOpacity={0.5} />
                <ReferenceLine y={60} stroke="#d97706" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Area type="monotone" dataKey="score" stroke={st.color} strokeWidth={2} fill="url(#j-proj-grad)"
                  dot={{ r: 4, fill: st.color }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>
              {t('pages.journey.needMoreRuns')}
            </div>
          )}
        </JourneyCard>

        <JourneyCard style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>{t('pages.journey.pillarScores')}</div>
          {pillarData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {pillarData.map(p => (
                <div key={p.pillar} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '112px', fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>{p.pillar}</div>
                  <div style={{ flex: 1, height: '9px', background: 'var(--bg)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.score}%`, background: p.color, borderRadius: '999px', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ width: '36px', fontSize: '0.75rem', fontWeight: 700, color: p.color, textAlign: 'right', flexShrink: 0 }}>{p.score}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>
              {t('pages.journey.noPillarData')}
            </div>
          )}
        </JourneyCard>
      </div>

      {/* Maturity badges */}
      <JourneyCard>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>{t('pages.journey.maturityBadges')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
            {maturityBadges.map(m => (
              <div key={m.level} style={{ textAlign: 'center', padding: '0.75rem', borderRadius: 12, background: m.earned ? `${m.color}10` : 'var(--bg)', border: `1px solid ${m.earned ? `${m.color}44` : 'var(--border)'}` }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${m.color}20`, border: `2px solid ${m.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', fontSize: '0.75rem', fontWeight: 800, color: m.textColor }}>
                  L{m.level}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: m.earned ? 'var(--text)' : 'var(--muted)' }}>{m.short}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{m.earned ? t('pages.journey.earned') : t('pages.journey.requires')} 90+</div>
              </div>
            ))}
          </div>
        </div>
      </JourneyCard>

      {/* Achievements */}
      <JourneyCard>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>{t('pages.journey.achievements')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.625rem' }}>
            {achievementBadges.map(a => (
              <div key={a.id} style={{ textAlign: 'center', padding: '0.75rem', borderRadius: 12, background: a.earned ? 'rgba(0,148,255,0.08)' : 'var(--bg)', border: `1px solid ${a.earned ? 'rgba(0,148,255,0.25)' : 'var(--border)'}` }}>
                <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>{a.earned ? '✓' : '○'}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: a.earned ? 'var(--text)' : 'var(--muted)' }}>{a.title}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{a.description}</div>
              </div>
            ))}
          </div>
        </div>
      </JourneyCard>

      {/* Next recommended controls */}
      {next && (
        <JourneyCard accent={next.color}>
          <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{t('pages.journey.nextControls')}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{t('pages.journey.nextControlsSub', { stage: next.label })}</div>
              </div>
              <StageBadge score={next.min} size="sm" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: next.color }}>{controlsForLevel(next.maturityLevel)}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('pages.journey.estimatedControls')}</span>
            </div>
          </div>
        </JourneyCard>
      )}

      {/* Recent scans */}
      {projectRuns.length > 0 && (
        <JourneyCard>
          <div style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>{t('pages.journey.recentScans')}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Score', 'Branch', 'Stage', 'Date'].map(h => (
                    <th key={h} style={{ padding: '0.55rem 1rem', textAlign: 'left', fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{t(`pages.journey.col${h}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...projectRuns].reverse().slice(0, 10).map((r, i, arr) => (
                  <tr key={r.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '0.65rem 1rem', fontWeight: 800, color: scoreColor(r.score) }}>{r.score}</td>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--muted)' }}>{r.branch || '—'}</td>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--muted)' }}>{r.stage || '—'}</td>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--muted)' }}>{fmtFull(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </JourneyCard>
      )}
    </div>
  )
}
