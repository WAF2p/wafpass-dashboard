import { useI18n } from '../../i18n'
import { FilterState, Page, scoreColor } from '../../routing'
import { RunDetail, RunSummary } from '../../api'
import { aggregateScore, latestRunByProject, stageFor } from '../journeyUtils'
import JourneyTimeline from './JourneyTimeline'
import { JourneyView } from './JourneyPage'
import StageBadge from './components/StageBadge'

export interface JourneyShellProps {
  view: JourneyView
  project: string | null
  run: RunDetail | null
  runs: RunSummary[]
  onSetFilters: (filters: FilterState) => void
  onNavigate: (page: Page) => void
  children: React.ReactNode
}

export default function JourneyShell({ view, project, run, runs, onSetFilters, onNavigate, children }: JourneyShellProps) {
  const { t } = useI18n()

  const headlineScore = view === 'project' && project
    ? latestRunByProject(runs)[project]?.score ?? 0
    : view === 'company'
      ? aggregateScore(runs)
      : run?.score ?? aggregateScore(runs)
  const activeStage = stageFor(headlineScore).idx

  const projects = Object.keys(latestRunByProject(runs)).sort()

  const tabBtn = (label: string, target: JourneyView, extra?: FilterState, active = false) => (
    <button
      key={label}
      onClick={() => onSetFilters({ view: target, ...extra })}
      style={{
        padding: '0.45rem 0.9rem',
        borderRadius: 999,
        fontSize: '0.78rem',
        fontWeight: active ? 700 : 600,
        cursor: 'pointer',
        border: '1px solid var(--border)',
        background: active ? 'var(--waf-brand)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#DA2C38',
                boxShadow: '0 0 8px #DA2C38',
              }}
            />
            <span
              style={{
                fontSize: '0.6rem',
                fontWeight: 800,
                color: '#DA2C38',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {t('pages.journey.threadLabel')}
            </span>
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
            {view === 'frontpage' && t('pages.journey.frontpageTitle')}
            {view === 'company' && t('pages.journey.companyTitle')}
            {view === 'project' && project && t('pages.journey.projectTitle', { project })}
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
            {view === 'frontpage' && t('pages.journey.frontpageSubtitle')}
            {view === 'company' && t('pages.journey.companySubtitle')}
            {view === 'project' && project && t('pages.journey.projectSubtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>
              {t('pages.journey.currentScore')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreColor(headlineScore) }}>{headlineScore}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/100</span>
            </div>
          </div>
          <StageBadge score={headlineScore} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {tabBtn(t('pages.journey.tabFrontpage'), 'frontpage', {}, view === 'frontpage')}
        {tabBtn(t('pages.journey.tabCompany'), 'company', { view: 'company' }, view === 'company')}
        {projects.length > 0 && (
          <select
            value={view === 'project' && project ? project : ''}
            onChange={e => {
              const p = e.target.value
              if (p) onSetFilters({ project: p })
            }}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: 999,
              fontSize: '0.78rem',
              fontWeight: view === 'project' ? 700 : 600,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: view === 'project' ? 'var(--waf-brand)' : 'var(--surface)',
              color: view === 'project' ? '#fff' : 'var(--text)',
            }}
          >
            <option value="">{t('pages.journey.selectProject')}</option>
            {projects.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => onNavigate('leaderboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.4rem 0.8rem',
            borderRadius: 999,
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--muted)',
          }}
        >
          {t('pages.journey.hallOfFame')}
        </button>
      </div>

      {/* Mobile timeline strip */}
      <div className="j-timeline-strip">
        <JourneyTimeline activeStage={activeStage} orientation="horizontal" compact />
      </div>

      {/* Main layout */}
      <div className="j-layout">
        <div className="j-timeline-col">
          <JourneyTimeline activeStage={activeStage} orientation="vertical" />
        </div>
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>

      <style>{`
        .j-timeline-strip { display: block; overflow: hidden; }
        .j-timeline-col { display: none; }
        .j-layout { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
        @media (min-width: 1024px) {
          .j-timeline-strip { display: none; }
          .j-timeline-col { display: flex !important; justify-content: center; overflow: hidden; width: 180px; min-width: 0; }
          .j-layout { grid-template-columns: 180px 1fr; }
        }
      `}</style>
    </div>
  )
}
