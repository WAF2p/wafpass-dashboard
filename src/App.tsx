import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ControlMeta, fetchWaivers, fetchRisks, fetchUserPrefsFromServer, pushUserPrefsToServer } from './api'
import { useAuth } from './AuthContext'
import { useTheme } from './theme'
import { I18nProvider } from './i18n'
import LoginPage from './pages/LoginPage'
import RunSelectorModal from './components/RunSelectorModal'
const UserPreferencesPage    = lazy(() => import('./pages/UserPreferencesPage'))
import Sidebar from './components/Sidebar'
import PdfReport from './components/PdfReport'
import { loadMaturityState, saveMaturityState, Settings } from './pages/settingsUtils'
import { DEFAULT_USER_PREFS, loadUserPrefs, saveUserPrefs, UserPreferences } from './pages/userPrefsUtils'
import { buildHash, Page, PAGE_SUBTITLE, PAGE_TITLE, parseHash } from './routing'
import { useControlsCatalogue } from './useControlsCatalogue'
import { useRunLoader } from './useRunLoader'

const ControlsCataloguePage  = lazy(() => import('./pages/ControlsCataloguePage'))
const DashboardPage          = lazy(() => import('./pages/DashboardPage'))
const FindingsPage           = lazy(() => import('./pages/FindingsPage'))
const CompliancePage         = lazy(() => import('./pages/CompliancePage'))
const RegionsPage            = lazy(() => import('./pages/RegionsPage'))
const ExploitPathsPage       = lazy(() => import('./pages/ExploitPathsPage'))
const RunsListPage           = lazy(() => import('./pages/RunsListPage'))
const SettingsPage           = lazy(() => import('./pages/SettingsPage'))
const RunScanPage            = lazy(() => import('./pages/RunScanPage'))
const SandboxPage            = lazy(() => import('./pages/SandboxPage'))
const WaiversPage            = lazy(() => import('./pages/WaiversPage'))
const RiskAcceptancePage     = lazy(() => import('./pages/RiskAcceptancePage'))
const ChangesPage            = lazy(() => import('./pages/ChangesPage'))
const BlastRadiusPage        = lazy(() => import('./pages/BlastRadiusPage'))
const RemediationSprintPage  = lazy(() => import('./pages/RemediationSprintPage'))
const RunDiffPage            = lazy(() => import('./pages/RunDiffPage'))
const SecretScanPage         = lazy(() => import('./pages/SecretScanPage'))
const ModuleScorePage        = lazy(() => import('./pages/ModuleScorePage'))
const DependencyGraphPage    = lazy(() => import('./pages/DependencyGraphPage'))
const FeedbackPage           = lazy(() => import('./pages/FeedbackPage'))
const EvidencePage           = lazy(() => import('./pages/EvidencePage'))
const SkippedControlsPage    = lazy(() => import('./pages/SkippedControlsPage'))
const AuditLogPage           = lazy(() => import('./pages/AuditLogPage'))
const GapAnalysisPage        = lazy(() => import('./pages/GapAnalysisPage'))
const CostImpactPage         = lazy(() => import('./pages/CostImpactPage'))
const AccessRolesPage        = lazy(() => import('./pages/AccessRolesPage'))
const UserManagementPage     = lazy(() => import('./pages/UserManagementPage'))
const ApiManagementPage      = lazy(() => import('./pages/ApiManagementPage'))
const SsoSettingsPage        = lazy(() => import('./pages/SsoSettingsPage'))
const GroupMappingsPage      = lazy(() => import('./pages/GroupMappingsPage'))
const ProjectOverviewPage    = lazy(() => import('./pages/ProjectOverviewPage'))
const PassportDashboardPage  = lazy(() => import('./pages/PassportDashboardPage'))
const BadgePage              = lazy(() => import('./pages/BadgePage'))
const LeaderboardPage        = lazy(() => import('./pages/LeaderboardPage'))
const MaturityJourneyPage    = lazy(() => import('./pages/MaturityJourneyPage'))
const ControlsPacksPage      = lazy(() => import('./pages/ControlsPacksPage'))
const GlobalDashboardPage    = lazy(() => import('./pages/GlobalDashboardPage'))
const ReferenceArchitecturePage = lazy(() => import('./pages/ReferenceArchitecturePage'))
const AntiPatternMuseumPage = lazy(() => import('./pages/AntiPatternMuseumPage'))

export default function App() {
  const { user, role, isLoading, logout } = useAuth()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <LoginPage />

  return <AuthenticatedApp user={user} role={role ?? 'clevel'} onLogout={logout} />
}

// Pages that show no run metadata chip in the header
const PAGES_WITHOUT_RUN_META = new Set<Page>([
  'runs', 'diff', 'catalogue', 'settings', 'runscan', 'sandbox',
  'waivers', 'risk', 'audit', 'evidence', 'feedback',
  'projectoverview', 'passports', 'badge', 'leaderboard', 'journey', 'userprefs',
  'reference', 'antipattern', 'globaldashboard',
])

function AuthenticatedApp({ user, role, onLogout }: {
  user: { username: string; display_name: string; image_url: string; role: string }
  role: string
  onLogout(): Promise<void>
}) {
  const { themeName, toggleTheme } = useTheme()
  // Capture the hash run ID once on mount for deep-link restoration
  const [initialRunId] = useState(() => parseHash().runId)
  const [page, setPage] = useState<Page>(() => parseHash().page)
  const [showRunModal, setShowRunModal] = useState(false)
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(loadUserPrefs)
  const [prefsSyncStatus, setPrefsSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const prefsSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [waiverCount, setWaiverCount] = useState(0)
  const [riskCount, setRiskCount] = useState(0)
  const mounted = useRef(false)

  const { runs, selectedId, setSelectedId, run, loadingRun, runsError, refetchRuns } = useRunLoader(initialRunId)

  function navigate(newPage: Page) {
    setPage(newPage)
    window.history.pushState(null, '', buildHash(newPage, selectedId))
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
      .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) })
      .catch(() => {})
  }

  // Keep URL in sync with page changes
  useEffect(() => {
    if (!mounted.current) return
    window.history.pushState(null, '', buildHash(page, selectedId))
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reflect run selection in URL without creating a new history entry
  useEffect(() => {
    window.history.replaceState(null, '', buildHash(page, selectedId))
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle browser back/forward and initialise URL on bare root
  useEffect(() => {
    function onPopState() {
      const { page: p, runId } = parseHash()
      setPage(p)
      if (runId) setSelectedId(runId)
    }
    window.addEventListener('popstate', onPopState)
    mounted.current = true
    if (!window.location.hash || window.location.hash === '#') {
      window.history.replaceState(null, '', buildHash(page, selectedId))
    }
    return () => window.removeEventListener('popstate', onPopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch counts from server on mount; fall back to localStorage cache if unreachable
  useEffect(() => {
    Promise.all([fetchWaivers(), fetchRisks()])
      .then(([w, r]) => { setWaiverCount(w.length); setRiskCount(r.length) })
      .catch(() => {
        try { setWaiverCount(Object.keys(JSON.parse(localStorage.getItem('wafpass_waivers') ?? '{}')).length) } catch {}
        try { setRiskCount(Object.keys(JSON.parse(localStorage.getItem('wafpass_risk_acceptances') ?? '{}')).length) } catch {}
      })
  }, [])

  const initialMaturity = loadMaturityState()
  const [maturityLevel, setMaturityLevel] = useState(initialMaturity.level)
  const [settings, setSettings] = useState<Settings>(initialMaturity.settings)

  function handleSettingsChange(level: number, s: Settings) {
    setMaturityLevel(level)
    setSettings(s)
    saveMaturityState(level, s)
  }

  // On mount: pull server prefs in background, merge over localStorage (server wins)
  useEffect(() => {
    fetchUserPrefsFromServer().then(serverPrefs => {
      if (serverPrefs && Object.keys(serverPrefs).length > 0) {
        // Get local prefs first to preserve language preference
        const localPrefs = loadUserPrefs()
        // Server prefs win for all keys EXCEPT language (local preference takes priority)
        const serverPrefsTyped = serverPrefs as Partial<UserPreferences>
        const merged: UserPreferences = {
          ...DEFAULT_USER_PREFS,
          ...serverPrefsTyped,
          language: localPrefs.language && localPrefs.language !== '' ? localPrefs.language : (serverPrefsTyped.language || ''),
        }
        setUserPrefs(merged)
        saveUserPrefs(merged)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const debouncedServerPush = useCallback((p: UserPreferences) => {
    if (prefsSyncTimer.current) clearTimeout(prefsSyncTimer.current)
    setPrefsSyncStatus('syncing')
    prefsSyncTimer.current = setTimeout(() => {
      pushUserPrefsToServer(p as unknown as Record<string, unknown>)
        .then(() => setPrefsSyncStatus('synced'))
        .catch(() => setPrefsSyncStatus('error'))
    }, 600)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleUserPrefsChange(p: UserPreferences) {
    setUserPrefs(p)
    saveUserPrefs(p)           // localStorage: immediate
    debouncedServerPush(p)     // server: debounced 600 ms
  }

  const catalogue = useControlsCatalogue()
  const failCount = run ? run.findings.filter(f => f.status?.toUpperCase() === 'FAIL').length : 0

  const availableControls: Pick<ControlMeta, 'id' | 'title'>[] = run && run.controls_meta.length > 0
    ? run.controls_meta.map(c => ({ id: c.id, title: c.title }))
    : catalogue.map(c => ({ id: c.id, title: c.title }))

  const effectiveLang = userPrefs.language || settings.defaultLanguage || 'en'

  return (
    <I18nProvider lang={effectiveLang}>
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {showRunModal && (
        <RunSelectorModal
          runs={runs}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onClose={() => setShowRunModal(false)}
        />
      )}

      <Sidebar
        run={run}
        runs={runs}
        runsError={runsError}
        page={page}
        role={role}
        user={user}
        maturityLevel={maturityLevel}
        settings={settings}
        hideDisabledMenuItems={userPrefs.hideDisabledMenuItems}
        waiverCount={waiverCount}
        riskCount={riskCount}
        failCount={failCount}
        navigate={navigate}
        onShowRunModal={() => setShowRunModal(true)}
        onOpenUserPrefs={() => navigate('userprefs')}
        onLogout={onLogout}
      />

      <div className="app-main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        {/* Header */}
        <header style={{
          background: 'var(--header-bg)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {PAGE_TITLE[page]}
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>
              {PAGE_SUBTITLE[page]}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {run && !PAGES_WITHOUT_RUN_META.has(page) && (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {run.project && <><strong style={{ color: 'var(--text)' }}>{run.project}</strong> · </>}
                {run.branch && <>{run.branch} · </>}
                {new Date(run.created_at).toLocaleString()}
              </span>
            )}
            <button
              onClick={toggleTheme}
              title={themeName === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '30px', height: '30px', borderRadius: '8px',
                background: 'var(--bg)', color: 'var(--muted)',
                border: '1px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
              }}
            >
              {themeName === 'dark'
                ? <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" strokeWidth={2}/><path strokeLinecap="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                : <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
              }
            </button>
            <button
              onClick={copyLink}
              title="Copy link to this page"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.7rem', borderRadius: '8px',
                background: linkCopied ? 'rgba(34,197,94,.12)' : 'var(--bg)',
                color: linkCopied ? '#15803d' : 'var(--muted)',
                border: `1px solid ${linkCopied ? 'rgba(34,197,94,.4)' : 'var(--border)'}`,
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {linkCopied
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                }
              </svg>
              {linkCopied ? 'Copied!' : 'Copy link'}
            </button>
            {run && page === 'dashboard' && (
              <button
                onClick={() => window.print()}
                title={userPrefs.pdfAutoOpen ? 'Share as PDF (auto-open enabled in preferences)' : 'Share as PDF'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.4rem 0.875rem', borderRadius: '8px',
                  background: userPrefs.pdfDarkMode ? 'rgba(34,197,94,.2)' : 'var(--waf-brand)',
                  color: userPrefs.pdfDarkMode ? '#22c55e' : '#fff',
                  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                  boxShadow: '0 2px 8px rgba(0,148,255,.30)',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Share as PDF
                {userPrefs.pdfDarkMode && <span style={{ fontSize: '0.6rem', fontWeight: 400, opacity: 0.8 }}>DM</span>}
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <div className="spinner" />
          </div>
        }>
          {page === 'userprefs' ? (
            <UserPreferencesPage prefs={userPrefs} user={user} syncStatus={prefsSyncStatus} onChange={handleUserPrefsChange} />
          ) : page === 'journey' ? (
            <MaturityJourneyPage run={run} runs={runs} maturityLevel={maturityLevel} settings={settings} waiverCount={waiverCount} riskCount={riskCount} navigate={navigate} />
          ) : page === 'globaldashboard' ? (
            <GlobalDashboardPage runs={runs} navigate={navigate} />
          ) : page === 'leaderboard' ? (
            <LeaderboardPage />
          ) : page === 'badge' ? (
            <BadgePage runs={runs} />
          ) : page === 'passports' ? (
            <PassportDashboardPage
              runs={runs}
              role={role}
              onOpenProject={project => { setSelectedProject(project); navigate('projectoverview') }}
              onRefetchRuns={refetchRuns}
            />
          ) : page === 'projectoverview' ? (
            <ProjectOverviewPage
              runs={runs}
              role={role}
              initialProject={selectedProject ?? undefined}
              onSelect={id => { setSelectedId(id); navigate('dashboard') }}
              onBack={() => navigate('passports')}
            />
          ) : page === 'controlspacks' ? (
            <ControlsPacksPage />
          ) : page === 'users' ? (
            <UserManagementPage />
          ) : page === 'groupmappings' ? (
            <GroupMappingsPage />
          ) : page === 'apikeys' ? (
            <ApiManagementPage />
          ) : page === 'sso' ? (
            <SsoSettingsPage />
          ) : page === 'access' ? (
            <AccessRolesPage />
          ) : page === 'feedback' ? (
            <FeedbackPage />
          ) : page === 'settings' ? (
            <SettingsPage maturityLevel={maturityLevel} settings={settings} onChange={handleSettingsChange} />
          ) : page === 'runscan' ? (
            <RunScanPage />
          ) : page === 'sandbox' ? (
            <SandboxPage />
          ) : page === 'waivers' ? (
            <WaiversPage controls={availableControls} onCountChange={setWaiverCount} />
          ) : page === 'risk' ? (
            <RiskAcceptancePage controls={availableControls} onCountChange={setRiskCount} />
          ) : page === 'audit' ? (
            <AuditLogPage />
          ) : page === 'evidence' ? (
            <EvidencePage run={run} />
          ) : page === 'runs' ? (
            <RunsListPage runs={runs} onSelect={id => { setSelectedId(id); navigate('dashboard') }} />
          ) : page === 'diff' ? (
            <RunDiffPage runs={runs} />
          ) : page === 'catalogue' ? (
            <ControlsCataloguePage key="catalogue" coreControls={run?.controls_meta ?? []} />
          ) : page === 'skipped' ? (
            <SkippedControlsPage run={run} />
          ) : loadingRun ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <div className="spinner" />
            </div>
          ) : !run && runs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '1.25rem',
                padding: '1.25rem 1.5rem', borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(0,148,255,.08) 0%, rgba(124,58,237,.06) 100%)',
                border: '1px solid rgba(0,148,255,.25)',
              }}>
                <div style={{
                  flexShrink: 0, width: '40px', height: '40px', borderRadius: '10px',
                  background: 'rgba(0,148,255,.15)', border: '1px solid rgba(0,148,255,.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.3rem' }}>
                    Welcome to WAF++ PASS
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                    No scan results yet. Run your first <code style={{ color: 'var(--waf-brand)', background: 'rgba(0,148,255,.08)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.78rem' }}>wafpass check</code> and push the results here to see your compliance dashboard — follow the guide below to get started in under 2 minutes.
                  </div>
                </div>
              </div>
              <RunScanPage />
            </div>
          ) : !run ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '4rem', fontSize: '0.85rem' }}>
              Select a run to view results.
            </div>
          ) : page === 'dashboard' ? (
            <DashboardPage run={run} onNav={p => navigate(p as Page)} waiverCount={waiverCount} riskCount={riskCount} runCount={runs.length} />
          ) : page === 'findings' ? (
            <FindingsPage run={run} />
          ) : page === 'compliance' ? (
            <CompliancePage run={run} settings={settings} />
          ) : page === 'gapanalysis' ? (
            <GapAnalysisPage run={run} />
          ) : page === 'changes' ? (
            <ChangesPage run={run} runs={runs} />
          ) : page === 'regions' ? (
            <RegionsPage run={run} />
          ) : page === 'exploitpath' ? (
            <ExploitPathsPage run={run} />
          ) : page === 'blastradius' ? (
            <BlastRadiusPage run={run} />
          ) : page === 'depgraph' ? (
            <DependencyGraphPage run={run} />
          ) : page === 'remediation' ? (
            <RemediationSprintPage run={run} />
          ) : page === 'secrets' ? (
            <SecretScanPage run={run} />
          ) : page === 'modules' ? (
            <ModuleScorePage run={run} />
          ) : page === 'cost' ? (
            <CostImpactPage run={run} />
          ) : page === 'reference' ? (
            <ReferenceArchitecturePage />
          ) : page === 'antipattern' ? (
            <AntiPatternMuseumPage />
          ) : null}
        </Suspense>
        </main>
      </div>

      {/* PDF report — hidden in normal view, printed only */}
      {run && (
        <div id="wafpass-pdf-root" style={{ display: 'none' }}>
          <PdfReport run={run} settings={settings} maturityLevel={maturityLevel} darkMode={userPrefs.pdfDarkMode} />
        </div>
      )}
    </div>
    </I18nProvider>
  )
}
