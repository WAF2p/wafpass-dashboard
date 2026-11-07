import { lazy } from 'react'
import { getServerUrl } from './api'
import { useAppContext } from './appContext'
import { hasMinRole } from './AuthContext'
import WelcomeChecklist from './components/WelcomeChecklist'
import { ForbiddenPage } from './components/RequireRole'
import { ALL_PAGES, type Page } from './routing'

const UserPreferencesPage         = lazy(() => import('./pages/UserPreferencesPage'))
const NotificationsPage           = lazy(() => import('./pages/NotificationsPage'))
const ControlsCataloguePage       = lazy(() => import('./pages/ControlsCataloguePage'))
const DashboardPage               = lazy(() => import('./pages/DashboardPage'))
const FindingsPage                = lazy(() => import('./pages/FindingsPage'))
const CompliancePage              = lazy(() => import('./pages/CompliancePage'))
const ComplianceReadinessPage     = lazy(() => import('./pages/ComplianceReadinessPage'))
const FrameworkDetailPage         = lazy(() => import('./pages/FrameworkDetailPage'))
const RegionsPage                 = lazy(() => import('./pages/RegionsPage'))
const ExploitPathsPage            = lazy(() => import('./pages/ExploitPathsPage'))
const RunsListPage                = lazy(() => import('./pages/RunsListPage'))
const SettingsPage                = lazy(() => import('./pages/SettingsPage'))
const SecuritySettingsPage        = lazy(() => import('./pages/SecuritySettingsPage'))
const RunScanPage                 = lazy(() => import('./pages/RunScanPage'))
const SandboxPage                 = lazy(() => import('./pages/SandboxPage'))
const WaiversPage                 = lazy(() => import('./pages/WaiversPage'))
const RiskAcceptancePage          = lazy(() => import('./pages/RiskAcceptancePage'))
const ChangesPage                 = lazy(() => import('./pages/ChangesPage'))
const BlastRadiusPage             = lazy(() => import('./pages/BlastRadiusPage'))
const RemediationSprintPage       = lazy(() => import('./pages/RemediationSprintPage'))
const RunDiffPage                 = lazy(() => import('./pages/RunDiffPage'))
const SecretScanPage              = lazy(() => import('./pages/SecretScanPage'))
const ModuleScorePage             = lazy(() => import('./pages/ModuleScorePage'))
const DependencyGraphPage         = lazy(() => import('./pages/DependencyGraphPage'))
const FeedbackPage                = lazy(() => import('./pages/FeedbackPage'))
const EvidencePage                = lazy(() => import('./pages/EvidencePage'))
const SkippedControlsPage         = lazy(() => import('./pages/SkippedControlsPage'))
const AuditLogPage                = lazy(() => import('./pages/AuditLogPage'))
const GapAnalysisPage             = lazy(() => import('./pages/GapAnalysisPage'))
const CostImpactPage              = lazy(() => import('./pages/CostImpactPage'))
const AccessRolesPage             = lazy(() => import('./pages/AccessRolesPage'))
const UserManagementPage          = lazy(() => import('./pages/UserManagementPage'))
const MandateManagementPage       = lazy(() => import('./pages/MandateManagementPage'))
const MandateAdministrationPage   = lazy(() => import('./pages/MandateAdministrationPage'))
const ApiManagementPage           = lazy(() => import('./pages/ApiManagementPage'))
const SsoSettingsPage             = lazy(() => import('./pages/SsoSettingsPage'))
const GroupMappingsPage           = lazy(() => import('./pages/GroupMappingsPage'))
const ProjectOverviewPage         = lazy(() => import('./pages/ProjectOverviewPage'))
const PassportDashboardPage       = lazy(() => import('./pages/PassportDashboardPage'))
const BadgePage                   = lazy(() => import('./pages/BadgePage'))
const LeaderboardPage             = lazy(() => import('./pages/LeaderboardPage'))
const JourneyPage                 = lazy(() => import('./pages/journey/JourneyPage'))
const ControlsPacksPage           = lazy(() => import('./pages/ControlsPacksPage'))
const GlobalDashboardPage         = lazy(() => import('./pages/GlobalDashboardPage'))
const EngineeringOperationsCenter = lazy(() => import('./pages/EngineeringOperationsCenter'))
const ArchitectureOperationsCenter = lazy(() => import('./pages/ArchitectureOperationsCenter'))
const MaturityOperationsCenter    = lazy(() => import('./pages/MaturityOperationsCenter'))
const ReferenceArchitecturePage   = lazy(() => import('./pages/ReferenceArchitecturePage'))
const AntiPatternMuseumPage       = lazy(() => import('./pages/AntiPatternMuseumPage'))
const LegalPage                   = lazy(() => import('./pages/LegalPage'))
const ProjectGroupsPage           = lazy(() => import('./pages/ProjectGroupsPage'))
const PipelineOperationsCenter    = lazy(() => import('./pages/PipelineOperationsCenter'))
const AutoFixPage                 = lazy(() => import('./pages/AutoFixPage'))
const ValidationCenterPage        = lazy(() => import('./pages/ValidationCenterPage'))
const AboutPage                   = lazy(() => import('./pages/AboutPage'))
const BetaFeaturesPage            = lazy(() => import('./pages/BetaFeaturesPage'))
const MyDashboardPage             = lazy(() => import('./pages/MyDashboardPage'))

/** Client-side route gates. The API enforces the same permissions. */
const PAGE_MIN_ROLE: Partial<Record<Page, string>> = {
  users: 'admin',
  mandates: 'admin',
  mandateadmin: 'admin',
  apikeys: 'admin',
  sso: 'admin',
  groupmappings: 'admin',
  controlspacks: 'admin',
  settings: 'clevel',
  security: 'clevel',
  access: 'clevel',
}

/**
 * Renders one routed page. Kept in a single module so the route table and the
 * page-to-prop mapping cannot drift.
 */
export function PageElement({ page }: { page: Page }) {
  const ctx = useAppContext()
  const minimum = PAGE_MIN_ROLE[page]
  if (minimum && !hasMinRole(ctx.role, minimum)) return <ForbiddenPage />

  const run = ctx.run
  const runs = ctx.runs
  const navigate = ctx.navigate

  // Pages that do not require a selected run.
  switch (page) {
    case 'userprefs':
      return (
        <UserPreferencesPage
          prefs={ctx.userPrefs}
          user={ctx.user}
          syncStatus={ctx.prefsSyncStatus}
          onChange={ctx.handleUserPrefsChange}
        />
      )
    case 'mydashboard':
      return (
        <MyDashboardPage
          run={run}
          runs={runs}
          waiverCount={ctx.waiverCount}
          riskCount={ctx.riskCount}
          maturityLevel={ctx.maturityLevel}
          settings={ctx.settings}
          prefs={ctx.userPrefs}
          onChange={ctx.handleUserPrefsChange}
          navigate={navigate}
          onSelectRun={id => { ctx.setSelectedId(id); navigate('dashboard') }}
        />
      )
    case 'journey':
      return <JourneyPage run={run} runs={runs} navigate={navigate} />
    case 'globaldashboard':
      return <GlobalDashboardPage run={run} runs={runs} navigate={navigate} />
    case 'leaderboard':
      return <LeaderboardPage />
    case 'badge':
      return <BadgePage runs={runs} />
    case 'passports':
      return (
        <PassportDashboardPage
          runs={runs}
          role={ctx.role}
          onOpenProject={project => {
            ctx.setSelectedProject(project)
            navigate('projectoverview')
          }}
          onRefetchRuns={ctx.refetchRuns}
        />
      )
    case 'projectoverview':
      return (
        <ProjectOverviewPage
          runs={runs}
          role={ctx.role}
          initialProject={ctx.selectedProject ?? undefined}
          onSelect={id => { ctx.setSelectedId(id); navigate('dashboard') }}
          onBack={() => navigate('passports')}
        />
      )
    case 'controlspacks':
      return <ControlsPacksPage navigate={p => navigate(p as Page)} />
    case 'users':
      return <UserManagementPage />
    case 'mandates':
      return <MandateManagementPage />
    case 'mandateadmin':
      return <MandateAdministrationPage />
    case 'groupmappings':
      return <GroupMappingsPage />
    case 'apikeys':
      return <ApiManagementPage />
    case 'sso':
      return <SsoSettingsPage />
    case 'access':
      return <AccessRolesPage />
    case 'feedback':
      return <FeedbackPage />
    case 'notifications':
      return <NotificationsPage />
    case 'settings':
      return <SettingsPage maturityLevel={ctx.maturityLevel} settings={ctx.settings} onChange={ctx.handleSettingsChange} />
    case 'security':
      return <SecuritySettingsPage />
    case 'betafeatures':
      return (
        <BetaFeaturesPage
          prefs={ctx.userPrefs}
          onChange={ctx.handleUserPrefsChange}
          onOpenSettings={() => navigate('settings')}
          onNavigate={navigate}
          hasRun={!!run}
          onStartBriefing={() => ctx.setShowBriefing(true)}
          onStartWidgetWall={() => ctx.setShowWidgetWall(true)}
        />
      )
    case 'runscan':
      return <RunScanPage />
    case 'sandbox':
      return <SandboxPage />
    case 'waivers':
      return <WaiversPage controls={ctx.availableControls} onCountChange={ctx.setWaiverCount} />
    case 'risk':
      return <RiskAcceptancePage controls={ctx.availableControls} onCountChange={ctx.setRiskCount} />
    case 'audit':
      return <AuditLogPage />
    case 'evidence':
      return <EvidencePage run={run} />
    case 'runs':
      return <RunsListPage runs={runs} onSelect={id => { ctx.setSelectedId(id); navigate('dashboard') }} />
    case 'diff':
      return <RunDiffPage runs={runs} />
    case 'catalogue':
      return <ControlsCataloguePage key="catalogue" coreControls={run?.controls_meta ?? []} />
    case 'skipped':
      return <SkippedControlsPage run={run} />
    case 'reference':
      return <ReferenceArchitecturePage />
    case 'antipattern':
      return <AntiPatternMuseumPage />
    case 'legal':
      return <LegalPage />
    case 'projectgroups':
      return <ProjectGroupsPage />
    case 'pipelines':
      return <PipelineOperationsCenter navigate={navigate} />
    case 'validations':
    case 'shiprun':
      return <ValidationCenterPage initialTab={page === 'shiprun' ? 'ship' : 'registry'} />
    case 'about':
      return <AboutPage />
    default:
      break
  }

  // Pages after this point need a run.
  if (ctx.loadingRun) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!run && runs.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <WelcomeChecklist
          serverUrl={getServerUrl()}
          demoLoading={ctx.demoLoading}
          demoError={ctx.demoError}
          demoRunId={ctx.demoRunId}
          onRunDemo={ctx.handleRunDemo}
          onOpenRunHistory={() => navigate('runs')}
          onShowAdvanced={() => ctx.setShowAdvancedOnboarding(v => !v)}
        />
        {ctx.showAdvancedOnboarding && <RunScanPage />}
      </div>
    )
  }

  if (!run) {
    return (
      <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '4rem', fontSize: '0.85rem' }}>
        Select a run to view results.
      </div>
    )
  }

  switch (page) {
    case 'dashboard':
      return (
        <DashboardPage
          run={run}
          onNav={p => navigate(p as Page)}
          waiverCount={ctx.waiverCount}
          riskCount={ctx.riskCount}
          runCount={runs.length}
        />
      )
    case 'findings':
      return <FindingsPage run={run} onNavigate={navigate} />
    case 'compliance':
      return <CompliancePage run={run} settings={ctx.settings} navigate={navigate} />
    case 'compliance-readiness':
      return <ComplianceReadinessPage run={run} />
    case 'framework-detail':
      return <FrameworkDetailPage run={run} navigate={p => navigate(p as Page)} frameworkId={ctx.filters.framework} />
    case 'gapanalysis':
      return <GapAnalysisPage run={run} navigate={p => navigate(p as Page)} frameworkId={ctx.filters.framework} />
    case 'changes':
      return <ChangesPage run={run} runs={runs} />
    case 'regions':
      return <RegionsPage run={run} />
    case 'exploitpath':
      return <ExploitPathsPage run={run} />
    case 'blastradius':
      return <BlastRadiusPage run={run} />
    case 'depgraph':
      return <DependencyGraphPage run={run} />
    case 'remediation':
      return <RemediationSprintPage run={run} />
    case 'secrets':
      return <SecretScanPage run={run} />
    case 'modules':
      return <ModuleScorePage run={run} />
    case 'cost':
      return <CostImpactPage run={run} />
    case 'engineering':
      return <EngineeringOperationsCenter run={run} runs={runs} navigate={navigate} />
    case 'architecture':
      return <ArchitectureOperationsCenter run={run} navigate={navigate} />
    case 'maturity':
      return <MaturityOperationsCenter run={run} runs={runs} navigate={navigate} />
    case 'autofix':
      return <AutoFixPage run={run} onBack={() => navigate('dashboard')} />
    default:
      return null
  }
}

/** One route per page slug. AppShell renders the matched element in <Outlet/>. */
export const pageRoutes = ALL_PAGES.map(page => ({
  path: page,
  element: <PageElement page={page} />,
}))
