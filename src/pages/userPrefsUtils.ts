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
}

const PREFS_KEY = 'wafpass_user_prefs'

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
