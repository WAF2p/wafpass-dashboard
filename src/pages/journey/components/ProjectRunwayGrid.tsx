import { useI18n } from '../../../i18n'
import { RunSummary } from '../../../api'
import { latestRunByProject, nextStage, pointsToNextStage, stageFor } from '../../journeyUtils'
import JourneyCard from './JourneyCard'
import StageBadge from './StageBadge'

export interface ProjectRunwayGridProps {
  runs: RunSummary[]
  onSelectProject: (project: string) => void
}

export default function ProjectRunwayGrid({ runs, onSelectProject }: ProjectRunwayGridProps) {
  const { t } = useI18n()
  const latest = latestRunByProject(runs)
  const projects = Object.entries(latest).map(([project, run]) => ({ project, run, stage: stageFor(run.score) }))

  if (!projects.length) {
    return (
      <JourneyCard style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)' }}>{t('pages.journey.noProjects')}</div>
      </JourneyCard>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
      {projects.map(({ project, run }) => {
        const st = stageFor(run.score)
        const pts = pointsToNextStage(run.score)
        const next = nextStage(run.score)
        return (
          <JourneyCard
            key={project}
            accent={st.color}
            style={{ transition: 'border-color 0.15s' }}
            onClick={() => onSelectProject(project)}
          >
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={project}
              >
                {project}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <StageBadge score={run.score} size="sm" />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: st.color }}>{run.score}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>/100</span>
                </div>
              </div>

              <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
                {next ? t('pages.journey.pointsToNext', { points: String(pts), stage: next.label }) : t('pages.journey.atFinalApproach')}
              </div>

              <div style={{ height: 6, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${run.score}%`, background: st.color, borderRadius: 999 }} />
              </div>
            </div>
          </JourneyCard>
        )
      })}
    </div>
  )
}
