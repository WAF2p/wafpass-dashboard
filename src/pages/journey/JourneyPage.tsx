import { useEffect, useMemo, useState } from 'react'
import { RunDetail, RunSummary } from '../../api'
import { buildJourneyHash, FilterState, Page, parseHash } from '../../routing'
import CompanyJourney from './CompanyJourney'
import JourneyFrontpage from './JourneyFrontpage'
import JourneyShell from './JourneyShell'
import ProjectJourney from './ProjectJourney'

export interface JourneyPageProps {
  run: RunDetail | null
  runs: RunSummary[]
  navigate: (page: Page) => void
}

export type JourneyView = 'frontpage' | 'company' | 'project'

export default function JourneyPage({ run, runs, navigate }: JourneyPageProps) {
  const [filters, setFilters] = useState<FilterState>(() => parseHash().filters)

  useEffect(() => {
    function onHashChange() {
      setFilters(parseHash().filters)
    }
    window.addEventListener('popstate', onHashChange)
    return () => window.removeEventListener('popstate', onHashChange)
  }, [])

  const setJourneyFilters = (next: FilterState) => {
    const url = buildJourneyHash(next)
    window.history.replaceState(null, '', url)
    setFilters(next)
  }

  const view: JourneyView = useMemo(() => {
    if (filters.project) return 'project'
    if (filters.view === 'company') return 'company'
    return 'frontpage'
  }, [filters])

  const activeProject = filters.project || null

  return (
    <JourneyShell
      view={view}
      project={activeProject}
      run={run}
      runs={runs}
      onSetFilters={setJourneyFilters}
      onNavigate={navigate}
    >
      {view === 'frontpage' && (
        <JourneyFrontpage
          run={run}
          runs={runs}
          onSetFilters={setJourneyFilters}
          onNavigate={navigate}
        />
      )}
      {view === 'company' && (
        <CompanyJourney
          runs={runs}
          onSetFilters={setJourneyFilters}
        />
      )}
      {view === 'project' && activeProject && (
        <ProjectJourney
          project={activeProject}
          runs={runs}
          onSetFilters={setJourneyFilters}
          onNavigate={navigate}
        />
      )}
      {view === 'project' && !activeProject && (
        <JourneyFrontpage
          run={run}
          runs={runs}
          onSetFilters={setJourneyFilters}
          onNavigate={navigate}
        />
      )}
    </JourneyShell>
  )
}
