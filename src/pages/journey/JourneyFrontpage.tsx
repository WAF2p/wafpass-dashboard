import { RunDetail, RunSummary } from '../../api'
import { useI18n } from '../../i18n'
import { FilterState, Page, scoreColor } from '../../routing'
import { aggregateScore, latestRunByProject, nextStage, pointsToNextStage, stageFor } from '../journeyUtils'
import JourneyCard from './components/JourneyCard'
import ProjectRunwayGrid from './components/ProjectRunwayGrid'
import StageBadge from './components/StageBadge'
import JourneyTimeline from './JourneyTimeline'

export interface JourneyFrontpageProps {
  run: RunDetail | null
  runs: RunSummary[]
  onSetFilters: (filters: FilterState) => void
  onNavigate: (page: Page) => void
}

export default function JourneyFrontpage({ run, runs, onSetFilters, onNavigate }: JourneyFrontpageProps) {
  const { t } = useI18n()
  const score = run?.score ?? aggregateScore(runs)
  const st = stageFor(score)
  const next = nextStage(score)
  const pts = pointsToNextStage(score)
  const companyScore = aggregateScore(runs)
  const companyStage = stageFor(companyScore)
  const projectCount = Object.keys(latestRunByProject(runs)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Hero text */}
      <JourneyCard accent="#DA2C38">
        <div style={{ padding: '1.75rem 2rem', background: 'linear-gradient(135deg, rgba(218,44,56,0.08) 0%, transparent 60%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#DA2C38', boxShadow: '0 0 8px #DA2C38' }} />
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#DA2C38', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('pages.journey.heroEyebrow')}
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 0.5rem', lineHeight: 1.2 }}>
            {t('pages.journey.heroTitle')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
            {t('pages.journey.heroBody')}
          </p>
        </div>
      </JourneyCard>

      {/* Hero timeline — full width so the arc renders cleanly */}
      <JourneyCard accent="#DA2C38" style={{ overflow: 'visible', padding: '1.25rem' }}>
        <JourneyTimeline activeStage={st.idx} orientation="horizontal" />
      </JourneyCard>

      {/* Quick-access cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Company card */}
        <JourneyCard
          accent="#DA2C38"
          style={{ transition: 'border-color 0.15s' }}
          onClick={() => onSetFilters({ view: 'company' })}
        >
          <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#DA2C38', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {t('pages.journey.companyCardLabel')}
              </span>
              <StageBadge score={companyScore} size="sm" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(companyScore) }}>{companyScore}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/100</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {next ? t('pages.journey.pointsToNext', { points: String(pts), stage: next.label }) : t('pages.journey.atFinalApproach')}
            </div>
            <div style={{ marginTop: '0.75rem', height: 5, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${companyScore}%`, background: `linear-gradient(90deg, #DA2C38, ${companyStage.color})`, borderRadius: 999 }} />
            </div>
          </div>
        </JourneyCard>

        {/* Project count card */}
        <JourneyCard accent={st.color}>
          <div style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: st.color, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              {t('pages.journey.projectsCardLabel')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)' }}>{projectCount}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{t('pages.journey.projectsTracked')}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {t('pages.journey.projectsCardBody')}
            </div>
          </div>
        </JourneyCard>

        {/* Current run / selected project card */}
        {run && (
          <JourneyCard accent={st.color} onClick={() => onSetFilters({ project: run.project })}>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: st.color, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                {t('pages.journey.selectedRunLabel')}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {run.project || run.path.split('/').pop() || '—'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: scoreColor(run.score) }}>{run.score}</span>
                <StageBadge score={run.score} size="sm" />
              </div>
            </div>
          </JourneyCard>
        )}
      </div>

      {/* Project runway */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t('pages.journey.projectRunway')}</h3>
          <button
            onClick={() => onNavigate('passports')}
            style={{
              fontSize: '0.72rem', fontWeight: 600, color: 'var(--waf-brand)', background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            {t('pages.journey.viewPassports')}
          </button>
        </div>
        <ProjectRunwayGrid runs={runs} onSelectProject={p => onSetFilters({ project: p })} />
      </div>
    </div>
  )
}
