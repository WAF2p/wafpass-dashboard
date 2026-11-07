import { createContext, useContext } from 'react'
import type { ControlMeta, RunDetail, RunSummary, UserOut } from './api'
import type { Settings } from './pages/settingsUtils'
import type { UserPreferences } from './pages/userPrefsUtils'
import type { FilterState, Page } from './routing'

export interface AppContextValue {
  user: UserOut
  role: string
  onLogout(): Promise<void>
  run: RunDetail | null
  runs: RunSummary[]
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  refetchRuns: () => Promise<void>
  loadingRun: boolean
  waiverCount: number
  setWaiverCount: React.Dispatch<React.SetStateAction<number>>
  riskCount: number
  setRiskCount: React.Dispatch<React.SetStateAction<number>>
  maturityLevel: number
  settings: Settings
  userPrefs: UserPreferences
  prefsSyncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  handleUserPrefsChange: (prefs: UserPreferences) => void
  handleSettingsChange: (level: number, settings: Settings) => void
  availableControls: Pick<ControlMeta, 'id' | 'title'>[]
  filters: FilterState
  navigate: (page: Page, filters?: FilterState) => void
  selectedProject: string | null
  setSelectedProject: React.Dispatch<React.SetStateAction<string | null>>
  handleRunDemo: () => Promise<void>
  demoLoading: boolean
  demoError: string | null
  demoRunId: string | null
  showAdvancedOnboarding: boolean
  setShowAdvancedOnboarding: React.Dispatch<React.SetStateAction<boolean>>
  setShowBriefing: React.Dispatch<React.SetStateAction<boolean>>
  setShowWidgetWall: React.Dispatch<React.SetStateAction<boolean>>
  setShowOnboarding: React.Dispatch<React.SetStateAction<boolean>>
  setShowRunModal: React.Dispatch<React.SetStateAction<boolean>>
  failCount: number
}

const AppContext = createContext<AppContextValue | null>(null)

export const AppContextProvider = AppContext.Provider

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside <AppShell>')
  return ctx
}
