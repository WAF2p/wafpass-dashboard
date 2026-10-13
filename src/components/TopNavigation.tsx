import { useState, useEffect, useRef } from 'react'
import { Page } from '../routing'
import { NotificationBell } from './NotificationBell'
import { hasMinRole } from '../AuthContext'
import { Settings, getMaturityMeta } from '../pages/settingsUtils'
import { RunDetail, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { loadUserPrefs, saveUserPrefs } from '../pages/userPrefsUtils'
import { NavEntry, NavSection, buildNavSections, categoryDescriptions } from '../navigation/navModel'

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

export interface TopNavigationProps {
  run: RunDetail | null
  runs: RunSummary[]
  page: Page
  role: string
  user: { username: string; display_name: string; image_url: string; role: string }
  maturityLevel: number
  settings: Settings
  waiverCount: number
  riskCount: number
  failCount: number
  navigate: (page: Page) => void
  onOpenUserPrefs: () => void
  onLogout: () => Promise<void>
  onShowRunModal: () => void
  onOpenOnboarding?: () => void
}

// Role icons from AccessRolesPage (ROLES array)
const roleIcons: Record<string, string> = {
  overview: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  journey: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  bestpractices: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7 M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4 M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
  ciso: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  architect: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  engineer: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  runs: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zH21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  admin: 'M12 8c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 12c-6.627 0-12-5.373-12-12s5.373-12 12-12 12 5.373 12 12-5.373 12-12 12z',
  system: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

function NavItem({ item, page, navigate }: { item: NavEntry; page: Page; navigate: (p: Page) => void }) {
  const isActive = page === item.page

  return (
    <button
      key={item.page}
      onClick={() => navigate(item.page)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.65rem 0.9rem',
        borderRadius: '8px',
        background: isActive ? 'rgba(0,148,255,0.15)' : 'transparent',
        border: isActive ? '1px solid var(--nav-border)' : '1px solid transparent',
        cursor: 'pointer',
        fontSize: '0.85rem',
        color: isActive ? 'var(--waf-brand)' : (item.danger ? 'var(--waf-danger)' : 'var(--nav-text)'),
        fontWeight: isActive ? 600 : 400,
        transition: 'all 0.15s',
        width: '100%',
        textAlign: 'left',
        lineHeight: 1.4,
        minHeight: '40px',
      }}
    >
      <span
        style={{
          width: '22px',
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
        </svg>
      </span>
      <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap' }}>
        {item.label}
        {item.count != null && item.count > 0 && (
          <span style={{ fontSize: '0.65rem', borderRadius: '999px', padding: '0.1rem 0.45rem', marginLeft: '0.4rem', background: 'var(--nav-surf)', color: 'var(--nav-text)' }}>
            {item.count}
          </span>
        )}
      </span>
    </button>
  )
}

function NavSectionDropdown({ section, page, navigate, role }: { section: NavSection; page: Page; navigate: (p: Page) => void; role: string }) {
  const [expanded, setExpanded] = useState(false)
  const [dropdownLeft, setDropdownLeft] = useState('1rem')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const visibleItems = section.items.filter(item => !item.minRole || hasMinRole(role, item.minRole))
  const hasActive = visibleItems.some(item => item.page === page)

  useEffect(() => {
    if (!expanded || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const maxWidth = Math.min(1200, vw - 32)
    let left = rect.left
    if (left + maxWidth > vw - 16) {
      left = Math.max(16, vw - 16 - maxWidth)
    }
    setDropdownLeft(`${left}px`)
  }, [expanded])

  const openMenu = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setExpanded(true)
  }

  const closeMenu = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      setExpanded(false)
      closeTimerRef.current = null
    }, 250)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  return (
    <div
      onMouseEnter={openMenu}
      onMouseLeave={closeMenu}
      style={{ position: 'relative' }}
    >
      <button
        ref={triggerRef}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem', borderRadius: '6px',
          background: expanded || hasActive ? 'rgba(0,148,255,0.15)' : 'transparent',
          border: expanded ? '1px solid var(--nav-border)' : (hasActive ? '1px solid var(--waf-brand)' : '1px solid transparent'),
          cursor: 'pointer', color: hasActive ? 'var(--waf-brand)' : 'var(--nav-text)',
          fontSize: '0.85rem', fontWeight: hasActive ? 600 : 500,
          transition: 'all 0.15s',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: hasActive ? 'var(--waf-brand)' : section.color, flexShrink: 0 }} />
        {section.label}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div
          onMouseEnter={openMenu}
          onMouseLeave={closeMenu}
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: 'calc(var(--top-nav-height, 64px) + 6px)',
            left: dropdownLeft,
            minWidth: '560px',
            maxWidth: 'min(1200px, calc(100vw - 2rem))',
            background: 'var(--nav-bg-opaque)',
            border: '1px solid var(--nav-border)',
            borderRadius: '14px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
            padding: '1.5rem 1.75rem',
            zIndex: 100,
            display: 'flex',
            gap: '2rem',
          }}
        >
          {/* Left: User image + description (block text) */}
          <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* User image icon alone */}
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--nav-surf)', border: '2px solid var(--nav-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: section.color,
              flexShrink: 0,
            }}>
              <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={roleIcons[section.id] || roleIcons['overview']} />
              </svg>
            </div>

            {/* Description in block text (no ellipsis, full text) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--nav-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {section.label}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--nav-text)', lineHeight: 1.6 }}>
                {categoryDescriptions[section.id] || section.description}
              </p>
            </div>
          </div>

          {/* Right: Navigation items - 3 per column, next columns for more items */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '2rem' }}>
            {chunkArray(visibleItems, 3).map((chunk, chunkIdx) => (
              <div key={chunkIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 0', minWidth: '200px' }}>
                {chunk.map((item) => (
                  <NavItem
                    key={item.page}
                    item={item}
                    page={page}
                    navigate={navigate}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LanguageSwitcher({ currentLang, onChange }: { currentLang: string; onChange: (code: string) => void }) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const languages = [
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'pt', flag: '🇵🇹', label: 'Português' },
    { code: 'br', flag: '🇧🇷', label: 'Português BR' },
    { code: 'el', flag: '🇬🇷', label: 'Ελληνικά' },
  ]

  const currentLanguage = languages.find(l => l.code === currentLang) || languages[0]

  const handleSelect = (code: string) => {
    setShowMenu(false)
    onChange(code)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        title="Language"
        style={{
          background: 'var(--nav-surf)',
          border: '1px solid var(--nav-border)',
          cursor: 'pointer',
          color: 'var(--nav-text)',
          padding: '0.5rem',
          borderRadius: '8px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.75rem',
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>{currentLanguage.flag}</span>
      </button>
      {showMenu && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '0.25rem',
            maxHeight: '240px',
            overflow: 'auto',
            minWidth: '160px',
            maxWidth: '200px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={(e) => {
                e.stopPropagation()
                handleSelect(l.code)
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: currentLang === l.code ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
              {currentLang === l.code && (
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--waf-brand)' }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TopNavigation({
  run, runs, page, role, user, maturityLevel,
  settings, waiverCount, riskCount, failCount,
  navigate, onOpenUserPrefs, onLogout, onShowRunModal,
  onOpenOnboarding,
}: TopNavigationProps) {
  const { t, lang } = useI18n()
  const [linkCopied, setLinkCopied] = useState(false)
  const showNotifications = role === 'admin'


  const allSections = buildNavSections(run, runs, settings, waiverCount, riskCount, failCount, t)
  const visibleSections = allSections.filter(s => hasMinRole(role, s.minRole ?? 'admin'))

  const currentRunLabel = run ? `${run.project || 'unnamed'} · ${new Date(run.created_at).toLocaleDateString()}` : 'Select run…'

  const handleLanguageChange = (code: string) => {
    const prefs = { ...loadUserPrefs(), language: code }
    saveUserPrefs(prefs)
    window.location.reload()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) })
      .catch(() => {})
  }

  return (
    <header className="app-top-nav">
      {/* Logo */}
      <div className="app-top-nav-logo">
        <img src="/logo.png" alt="WAF++ PASS" style={{ height: '32px', width: 'auto', objectFit: 'contain', filter: 'brightness(1.05)' }} />
      </div>

      {/* Navigation - only on large screens */}
      <div className="app-top-nav-items">
        {visibleSections.map(section => (
          <NavSectionDropdown
            key={section.id}
            section={section}
            page={page}
            navigate={navigate}
            role={role}
          />
        ))}
      </div>

      {/* Right side - User controls */}
      <div className="app-top-nav-controls">
        {/* Run selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onShowRunModal}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem', borderRadius: '8px',
              background: 'var(--nav-surf)',
              border: '1px solid var(--nav-border)',
              cursor: 'pointer',
              fontSize: '0.75rem', color: 'var(--nav-text)',
            }}
          >
            {run ? (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minWidth: 0 }}>
                  {currentRunLabel}
                </span>
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L16 14M7 18l-4.553-2.276A1 1 0 012 15.382V8.618a1 1 0 011.447-.894L7 10m0 0l4.553 2.276A1 1 0 0012 12.382V8" />
                </svg>
                <span>No runs selected</span>
              </>
            )}
          </button>
        </div>

        {/* Dark mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Notifications bell (admin only) */}
          {showNotifications && <NotificationBell navigate={navigate} />}

          {/* Dark mode toggle */}
          <button
            onClick={() => {
              const html = document.documentElement
              const isDark = html.getAttribute('data-theme') === 'dark'
              html.setAttribute('data-theme', isDark ? 'light' : 'dark')
            }}
            title={document.documentElement.getAttribute('data-theme') === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.5rem', borderRadius: '8px',
              background: 'var(--nav-surf)', color: 'var(--nav-text)',
              border: '1px solid var(--nav-border)',
              cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
            }}
          >
            {document.documentElement.getAttribute('data-theme') === 'dark'
              ? <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" strokeWidth={2}/><path strokeLinecap="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
            }
          </button>
        </div>

        {/* Copy link */}
        <button
          onClick={copyLink}
          title="Copy link to this page"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.5rem', borderRadius: '8px',
            background: linkCopied ? 'rgba(34,197,94,.12)' : 'var(--nav-surf)',
            color: linkCopied ? '#15803d' : 'var(--nav-muted)',
            border: `1px solid ${linkCopied ? 'rgba(34,197,94,.4)' : 'var(--nav-border)'}`,
            cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {linkCopied
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            }
          </svg>
        </button>

        {/* PDF Export */}
        <button
          onClick={() => window.print()}
          title="Export as PDF"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.5rem', borderRadius: '8px',
            background: 'var(--nav-surf)',
            color: 'var(--nav-muted)',
            border: '1px solid var(--nav-border)',
            cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#22d3ee'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(34,211,238,0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--nav-muted)'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>

        {/* Help / onboarding tour */}
        {onOpenOnboarding && (
          <button
            onClick={onOpenOnboarding}
            title={t('onboarding.openHelp')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--nav-surf)', color: 'var(--nav-muted)',
              border: '1px solid var(--nav-border)', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 700, flexShrink: 0,
            }}
          >
            ?
          </button>
        )}

        {/* Maturity level */}
        {(() => {
          const meta = getMaturityMeta(maturityLevel)
          return (
            <button
              onClick={() => navigate('settings')}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                background: meta.color,
                borderRadius: '999px', padding: '0.4rem 0.9rem',
                fontSize: '0.75rem', fontWeight: 700,
                color: '#ffffff',
                cursor: 'pointer', flexShrink: 0,
                border: 'none',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff', flexShrink: 0, opacity: 0.5 }} />
              <span>{meta.short}</span>
            </button>
          )
        })()}

        {/* Language switcher */}
        <LanguageSwitcher currentLang={lang} onChange={handleLanguageChange} />

        {/* User dropdown - avatar with hover menu */}
        <div className="top-nav-wrapper" style={{ position: 'relative' }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--nav-surf)',
              border: '1px solid var(--nav-border)',
              cursor: 'pointer', transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--nav-bg)'
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.borderColor = 'var(--waf-brand)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--nav-surf)'
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.borderColor = 'var(--nav-border)'
            }}
          >
            {user.image_url && user.image_url !== '' ? (
              <img src={user.image_url} alt={user.display_name || user.username} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0094FF' }}>
                {user.display_name ? user.display_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
              </span>
            )}
          </button>

          {/* Hover menu */}
          <div className="user-menu-hover" style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            width: '200px',
            background: 'var(--card-bg)',
            border: '1px solid var(--nav-border)',
            borderRadius: '8px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            zIndex: 100,
            display: 'none',
          }}>
            {/* User info header */}
            <div style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--nav-border)',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--nav-text)' }}>
                {user.display_name || user.username}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--nav-muted)' }}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </div>
            </div>

            {/* User preferences */}
            <button
              onClick={onOpenUserPrefs}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.5rem 1rem',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', color: 'var(--nav-text)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,148,255,0.1)'
                e.currentTarget.style.color = 'var(--waf-brand)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.color = 'var(--nav-text)'
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>User Preferences</span>
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.5rem 1rem',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', color: 'var(--waf-danger)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(218,44,56,0.1)'
                e.currentTarget.style.color = 'var(--waf-danger)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.color = 'var(--waf-danger)'
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* CSS for hover menu display */}
        <style>{`
          .top-nav-wrapper:hover .user-menu-hover {
            display: block !important;
          }
        `}</style>
      </div>
    </header>
  )
}
