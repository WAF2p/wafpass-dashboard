import type { Page } from '../routing'
import { INITIAL_DASHBOARD_WIDGETS, type DashboardWidget } from '../widgets/types'

export interface SavedView {
  id: string
  name: string
  page: Page
  filters: Record<string, unknown>
  createdAt: string
}

export type PersonaHomeId = 'ciso' | 'architect' | 'engineer'

/** Maximum number of pages that can be pinned next to the category launcher. */
export const MAX_PINNED_PAGES = 15

export interface UserPreferences {
  pdfAutoOpen: boolean
  hideDisabledMenuItems: boolean
  defaultPage: string
  dateFormat: 'relative' | 'absolute' | 'full'
  showInlineHelp: boolean
  sidebarCompact: boolean
  language: string  // '' means "use system/org default"
  pdfDarkMode: boolean
  hasSeenOnboarding: boolean
  /** Opt-in ids of experimental features enabled for this user. */
  betaFeatures: string[]
  /** Pages pinned next to the category launcher, in display order. */
  pinnedPages: Page[]
  /** Named filter presets, scoped to the page they were saved on. */
  savedViews: SavedView[]
  /** Run ids bookmarked for the multi-run trend overlay (max 5). */
  bookmarkedRuns: string[]
  /** Persona landing-page preset; empty means the default home. */
  personaHome: PersonaHomeId | ''
  /** Display name of the user's own widget dashboard. */
  dashboardName: string
  /** Per-user widget layout for the "My Dashboard" beta page. */
  dashboardWidgets: DashboardWidget[]
}

/** Beta feature ids. Keep strings stable — they are persisted per user. */
export const BETA_CATEGORY_LAUNCHER = 'category-launcher'
export const BETA_COMMAND_PALETTE = 'command-palette'
export const BETA_SAVED_VIEWS = 'saved-views'
export const BETA_PINNED_PAGES = 'pinned-pages'
export const BETA_PERSONA_HOME = 'persona-home'
export const BETA_FINDINGS_TRIAGE = 'findings-triage'
export const BETA_RUN_BOOKMARKS = 'run-bookmarks'
export const BETA_BRIEFING_MODE = 'briefing-mode'
export const BETA_WIDGET_WALL = 'widget-wall'
export const BETA_MY_DASHBOARD = 'my-dashboard'
export const BETA_FEATURES = [
  BETA_CATEGORY_LAUNCHER,
  BETA_COMMAND_PALETTE,
  BETA_SAVED_VIEWS,
  BETA_PINNED_PAGES,
  BETA_PERSONA_HOME,
  BETA_FINDINGS_TRIAGE,
  BETA_RUN_BOOKMARKS,
  BETA_BRIEFING_MODE,
  BETA_WIDGET_WALL,
  BETA_MY_DASHBOARD,
] as const
export type BetaFeatureId = typeof BETA_FEATURES[number]

export function isBetaFeatureEnabled(prefs: Pick<UserPreferences, 'betaFeatures'>, id: BetaFeatureId): boolean {
  return (prefs.betaFeatures ?? []).includes(id)
}

export const DEFAULT_USER_PREFS: UserPreferences = {
  pdfAutoOpen: false,
  hideDisabledMenuItems: false,
  defaultPage: 'globaldashboard',
  dateFormat: 'absolute',
  showInlineHelp: true,
  sidebarCompact: false,
  language: '',
  pdfDarkMode: false,
  hasSeenOnboarding: false,
  betaFeatures: [],
  pinnedPages: [],
  savedViews: [],
  personaHome: '',
  bookmarkedRuns: [],
  dashboardName: '',
  dashboardWidgets: INITIAL_DASHBOARD_WIDGETS,
}

const PREFS_KEY = 'wombat_user_prefs'

export function loadUserPrefs(): UserPreferences {
  try {
    const s = localStorage.getItem(PREFS_KEY)
    if (s) return { ...DEFAULT_USER_PREFS, ...JSON.parse(s) }
  } catch {}
  return { ...DEFAULT_USER_PREFS }
}

export function saveUserPrefs(prefs: UserPreferences): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {}
}
