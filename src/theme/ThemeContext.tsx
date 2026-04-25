import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { themes, type ThemeName, type ThemeTokens } from './tokens'

interface ThemeCtx {
  themeName: ThemeName
  theme: ThemeTokens
  toggleTheme(): void
}

const ThemeContext = createContext<ThemeCtx>({
  themeName: 'light',
  theme: themes.light,
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const stored = localStorage.getItem('wafpass_theme') as ThemeName | null
    if (stored && stored in themes) return stored
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeName)
    localStorage.setItem('wafpass_theme', themeName)
  }, [themeName])

  function toggleTheme() {
    setThemeName(n => n === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ themeName, theme: themes[themeName], toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() { return useContext(ThemeContext) }
