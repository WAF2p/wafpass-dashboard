export interface ThemeTokens {
  // Page & surface backgrounds
  bg:              string
  surface:         string
  surfaceElevated: string
  headerBg:        string
  inputBg:         string
  inputText:       string
  inputBorder:     string
  // Borders, tracks, interactive backgrounds
  border:          string
  track:           string   // progress-bar / gauge ring background
  rowHover:        string
  scoreInner:      string   // gauge inner circle
  // Typography
  text:            string
  muted:           string
  // Shadows
  shadowSm:        string
  shadowMd:        string
  // Brand — theme-invariant
  brand:           string
  brandHover:      string
  accent:          string
  danger:          string
  // Sidebar — always dark, listed here for a single source of truth
  sidebarBg:       string
  sidebarSurf:     string
  sidebarBorder:   string
  sidebarText:     string
  sidebarMuted:    string
  // Semantic status — theme-invariant
  pass:            string
  fail:            string
  skip:            string
  waived:          string
  scoreHigh:       string
  scoreMid:        string
  scoreLow:        string
}

export const lightTheme: ThemeTokens = {
  bg:              '#f7f8fb',
  surface:         '#ffffff',
  surfaceElevated: '#ffffff',
  headerBg:        'rgba(247,248,251,.95)',
  inputBg:         '#f8fafc',
  inputText:       '#1e293b',
  inputBorder:     '#e2e8f0',
  border:          'rgba(15,23,42,.09)',
  track:           '#e5e7eb',
  rowHover:        '#f8fafc',
  scoreInner:      '#ffffff',
  text:            '#0b1220',
  muted:           '#5b6474',
  shadowSm:        '0 1px 3px rgba(15,23,42,.06)',
  shadowMd:        '0 4px 24px rgba(15,23,42,.09)',
  brand:           '#0094FF',
  brandHover:      '#21A5FF',
  accent:          '#FFCF63',
  danger:          '#DA2C38',
  sidebarBg:       '#070a12',
  sidebarSurf:     '#0f1630',
  sidebarBorder:   'rgba(238,242,255,.10)',
  sidebarText:     '#b4c0d6',
  sidebarMuted:    '#64748b',
  pass:            '#22c55e',
  fail:            '#DA2C38',
  skip:            '#94a3b8',
  waived:          '#a78bfa',
  scoreHigh:       '#059669',
  scoreMid:        '#d97706',
  scoreLow:        '#DA2C38',
}

export const darkTheme: ThemeTokens = {
  bg:              '#0d1117',
  surface:         '#161b22',
  surfaceElevated: '#1c2230',
  headerBg:        'rgba(13,17,23,.92)',
  inputBg:         '#1c2230',
  inputText:       '#e6edf3',
  inputBorder:     'rgba(255,255,255,.12)',
  border:          'rgba(255,255,255,.08)',
  track:           'rgba(255,255,255,.08)',
  rowHover:        'rgba(255,255,255,.03)',
  scoreInner:      '#1c2230',
  text:            '#e6edf3',
  muted:           '#8b949e',
  shadowSm:        '0 1px 3px rgba(0,0,0,.30)',
  shadowMd:        '0 4px 24px rgba(0,0,0,.50)',
  brand:           '#0094FF',
  brandHover:      '#21A5FF',
  accent:          '#FFCF63',
  danger:          '#DA2C38',
  sidebarBg:       '#010409',
  sidebarSurf:     '#0d1117',
  sidebarBorder:   'rgba(238,242,255,.07)',
  sidebarText:     '#8b949e',
  sidebarMuted:    '#484f58',
  pass:            '#22c55e',
  fail:            '#DA2C38',
  skip:            '#94a3b8',
  waived:          '#a78bfa',
  scoreHigh:       '#059669',
  scoreMid:        '#d97706',
  scoreLow:        '#DA2C38',
}

export const themes = { light: lightTheme, dark: darkTheme } as const
export type ThemeName = keyof typeof themes
