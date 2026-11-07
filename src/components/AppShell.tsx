import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import {
  createDemoRun,
  fetchRisks,
  fetchUserPrefsFromServer,
  fetchWaivers,
  pushUserPrefsToServer,
  type ControlMeta,
} from '../api'
import { AppContextProvider, type AppContextValue } from '../appContext'
import { useAuth } from '../AuthContext'
import { BetaFeaturesProvider } from '../beta/BetaFeaturesContext'
import { I18nProvider } from '../i18n'
import { NotificationProvider } from '../notifications/context'
import { DEFAULT_USER_PREFS, loadUserPrefs, saveUserPrefs, type UserPreferences } from '../pages/userPrefsUtils'
import { loadMaturityState, saveMaturityState, type Settings } from '../pages/settingsUtils'
import { pageFromPath, parseHash, type FilterState, type Page } from '../routing'
import { useControlsCatalogue } from '../useControlsCatalogue'
import { useRunLoader } from '../useRunLoader'
import BriefingMode from './BriefingMode'
import Footer from './Footer'
import ImpersonationBanner from './ImpersonationBanner'
import OnboardingTour from './OnboardingTour'
import PdfReport from './PdfReport'
import RunSelectorModal from './RunSelectorModal'
import TopNavigation from './TopNavigation'
import WidgetWall from './WidgetWall'

/**
 * Authenticated application shell.
 *
 * Holds the cross-page state (run selection, preferences, maturity settings,
 * counts) and renders the navigation plus the routed page. Page definitions
 * live in routes.tsx; this component is layout and state only.
 */
export default function AppShell() {
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const routerNavigate = useNavigate()

  const page = pageFromPath(location.pathname)
  const filters = useMemo<FilterState>(
    () => Object.fromEntries(new URLSearchParams(location.search)) as FilterState,
    [location.search],
  )

  const [initialRunId] = useState(() => parseHash().runId)
  const { runs, selectedId, setSelectedId, run, loadingRun, refetchRuns } = useRunLoader(initialRunId)

  const [showRunModal, setShowRunModal] = useState(false)
  const [showBriefing, setShowBriefing] = useState(false)
  const [showWidgetWall, setShowWidgetWall] = useState(false)
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(loadUserPrefs)
  const [prefsSyncStatus, setPrefsSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const prefsSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [waiverCount, setWaiverCount] = useState(0)
  const [riskCount, setRiskCount] = useState(0)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const onboardingAutoLaunched = useRef(false)

  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const [demoRunId, setDemoRunId] = useState<string | null>(null)
  const [showAdvancedOnboarding, setShowAdvancedOnboarding] = useState(false)

  const initialMaturity = loadMaturityState()
  const [maturityLevel, setMaturityLevel] = useState(initialMaturity.level)
  const [settings, setSettings] = useState<Settings>(initialMaturity.settings)

  const navigate = useCallback(
    (newPage: Page, nextFilters?: FilterState) => {
      const params = new URLSearchParams()
      if (selectedId) params.set('run', selectedId)
      const merged = nextFilters ?? filters
      for (const [key, value] of Object.entries(merged)) {
        if (value !== undefined && value !== '') params.set(key, value)
      }
      const search = params.toString()
      routerNavigate({ pathname: `/${newPage}`, search: search ? `?${search}` : '' })
    },
    [routerNavigate, selectedId, filters],
  )

  // Keep the selected run in the URL without creating a history entry.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (selectedId) params.set('run', selectedId)
    else params.delete('run')
    const search = params.toString()
    routerNavigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true },
    )
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reflect back/forward navigation in the run selection.
  useEffect(() => {
    const runId = new URLSearchParams(location.search).get('run')
    if (runId && runId !== selectedId) setSelectedId(runId)
  }, [location.search, selectedId])

  async function handleRunDemo() {
    setDemoLoading(true)
    setDemoError(null)
    try {
      const summary = await createDemoRun()
      setDemoRunId(summary.id)
      await refetchRuns()
    } catch (e: unknown) {
      setDemoError(e instanceof Error ? e.message : String(e))
    } finally {
      setDemoLoading(false)
    }
  }

  // Fetch counts from the server on mount. Never read a cross-user cache.
  useEffect(() => {
    Promise.all([fetchWaivers(), fetchRisks()])
      .then(([w, r]) => {
        setWaiverCount(w.length)
        setRiskCount(r.length)
      })
      .catch(() => {
        /* scoped fetch failed — leave counts at zero */
      })
  }, [])

  function handleSettingsChange(level: number, s: Settings) {
    setMaturityLevel(level)
    setSettings(s)
    saveMaturityState(level, s)
  }

  // Server preferences win over localStorage, except language.
  useEffect(() => {
    fetchUserPrefsFromServer().then(serverPrefs => {
      if (serverPrefs && Object.keys(serverPrefs).length > 0) {
        const localPrefs = loadUserPrefs()
        const serverPrefsTyped = serverPrefs as Partial<UserPreferences>
        const merged: UserPreferences = {
          ...DEFAULT_USER_PREFS,
          ...serverPrefsTyped,
          language: localPrefs.language && localPrefs.language !== ''
            ? localPrefs.language
            : (serverPrefsTyped.language || ''),
        }
        setUserPrefs(merged)
        saveUserPrefs(merged)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (onboardingAutoLaunched.current) return
    if (!user?.created_at || !user?.last_login_at) return
    if (userPrefs.hasSeenOnboarding) return
    const created = new Date(user.created_at).getTime()
    const lastLogin = new Date(user.last_login_at).getTime()
    const isFirstLogin = Math.abs(created - lastLogin) <= 5 * 60 * 1000
    if (isFirstLogin) {
      onboardingAutoLaunched.current = true
      setShowOnboarding(true)
    }
  }, [user, userPrefs.hasSeenOnboarding])

  const debouncedServerPush = useCallback((p: UserPreferences) => {
    if (prefsSyncTimer.current) clearTimeout(prefsSyncTimer.current)
    setPrefsSyncStatus('syncing')
    prefsSyncTimer.current = setTimeout(() => {
      pushUserPrefsToServer(p as unknown as Record<string, unknown>)
        .then(() => setPrefsSyncStatus('synced'))
        .catch(() => setPrefsSyncStatus('error'))
    }, 600)
  }, [])

  function handleUserPrefsChange(p: UserPreferences) {
    setUserPrefs(p)
    saveUserPrefs(p)
    debouncedServerPush(p)
  }

  const catalogue = useControlsCatalogue()
  const failCount = run ? run.findings.filter(f => f.status?.toUpperCase() === 'FAIL').length : 0
  const availableControls: Pick<ControlMeta, 'id' | 'title'>[] =
    run && run.controls_meta.length > 0
      ? run.controls_meta.map(c => ({ id: c.id, title: c.title }))
      : catalogue.map(c => ({ id: c.id, title: c.title }))

  const effectiveLang = userPrefs.language || settings.defaultLanguage || 'en'

  if (!user) return null

  const effectiveRole = role ?? 'clevel'
  const ctx: AppContextValue = {
    user,
    role: effectiveRole,
    onLogout: logout,
    run,
    runs,
    selectedId,
    setSelectedId,
    refetchRuns,
    loadingRun,
    waiverCount,
    setWaiverCount,
    riskCount,
    setRiskCount,
    maturityLevel,
    settings,
    userPrefs,
    prefsSyncStatus,
    handleUserPrefsChange,
    handleSettingsChange,
    availableControls,
    filters,
    navigate,
    selectedProject,
    setSelectedProject,
    handleRunDemo,
    demoLoading,
    demoError,
    demoRunId,
    showAdvancedOnboarding,
    setShowAdvancedOnboarding,
    setShowBriefing,
    setShowWidgetWall,
    setShowOnboarding,
    setShowRunModal,
    failCount,
  }

  return (
    <AppContextProvider value={ctx}>
      <I18nProvider lang={effectiveLang}>
        <BetaFeaturesProvider prefs={userPrefs} onChange={handleUserPrefsChange}>
          <NotificationProvider>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <ImpersonationBanner />

              {showRunModal && (
                <RunSelectorModal
                  runs={runs}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onClose={() => setShowRunModal(false)}
                  role={effectiveRole}
                />
              )}

              <OnboardingTour
                open={showOnboarding}
                onClose={() => {
                  handleUserPrefsChange({ ...userPrefs, hasSeenOnboarding: true })
                  setShowOnboarding(false)
                }}
                onComplete={() => {
                  handleUserPrefsChange({ ...userPrefs, hasSeenOnboarding: true })
                  setShowOnboarding(false)
                }}
              />

              <div className="app-main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <TopNavigation
                  run={run}
                  runs={runs}
                  page={page}
                  role={effectiveRole}
                  user={user}
                  maturityLevel={maturityLevel}
                  settings={settings}
                  waiverCount={waiverCount}
                  riskCount={riskCount}
                  failCount={failCount}
                  controls={availableControls}
                  navigate={navigate}
                  onSelectRun={id => { setSelectedId(id); navigate('dashboard') }}
                  onOpenUserPrefs={() => navigate('userprefs')}
                  onLogout={logout}
                  onShowRunModal={() => setShowRunModal(true)}
                  onStartBriefing={() => setShowBriefing(true)}
                  onStartWidgetWall={() => setShowWidgetWall(true)}
                  onOpenOnboarding={() => setShowOnboarding(true)}
                />

                <main>
                  <Suspense
                    fallback={(
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                        <div className="spinner" />
                      </div>
                    )}
                  >
                    <Outlet />
                  </Suspense>
                </main>
              </div>

              {showBriefing && run && <BriefingMode run={run} onClose={() => setShowBriefing(false)} />}
              {showWidgetWall && run && <WidgetWall run={run} runs={runs} onClose={() => setShowWidgetWall(false)} />}

              {run && (
                <div id="wombat-pdf-root" style={{ display: 'none' }}>
                  <PdfReport
                    run={run}
                    settings={settings}
                    maturityLevel={maturityLevel}
                    darkMode={userPrefs.pdfDarkMode}
                  />
                </div>
              )}

              <Footer />
            </div>
          </NotificationProvider>
        </BetaFeaturesProvider>
      </I18nProvider>
    </AppContextProvider>
  )
}
