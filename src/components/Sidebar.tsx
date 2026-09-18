import { useEffect, useRef, useState } from 'react'
import { RunDetail, RunSummary, getActiveControlPack } from '../api'
import { hasMinRole } from '../AuthContext'
import { getMaturityMeta, Settings } from '../pages/settingsUtils'
import { Page, scoreColor } from '../routing'
import { useI18n } from '../i18n'
import { loadUserPrefs, saveUserPrefs, UserPreferences } from '../pages/userPrefsUtils'
import { NavEntry, buildNavSections } from '../navigation/navModel'

export interface SidebarProps {
  run: RunDetail | null
  runs: RunSummary[]
  runsError: string | null
  page: Page
  role: string
  user: { username: string; display_name: string; image_url: string; role: string }
  maturityLevel: number
  settings: Settings
  hideDisabledMenuItems: boolean
  waiverCount: number
  riskCount: number
  failCount: number
  navigate: (page: Page) => void
  onShowRunModal: () => void
  onOpenUserPrefs: () => void
  onLogout: () => Promise<void>
}

function NavItem({ item, page, navigate }: { item: NavEntry; page: Page; navigate: (p: Page) => void }) {
  return (
    <button
      key={item.page}
      onClick={() => navigate(item.page)}
      className={`sidebar-link${page === item.page ? ' active' : ''}`}
      style={item.danger && page !== item.page ? { color: '#f87171' } : undefined}
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
      </svg>
      {item.label}
      {item.badge && (
        <span style={{
          marginLeft: 'auto', fontSize: '0.65rem', borderRadius: '999px', padding: '0.1rem 0.45rem',
          background: item.badge.variant === 'fail' ? 'rgba(218,44,56,.25)' : 'rgba(255,255,255,.08)',
          color: item.badge.variant === 'fail' ? '#fca5a5' : 'var(--sidebar-text)',
        }}>
          {item.badge.label}
        </span>
      )}
      {!item.badge && item.count != null && item.count > 0 && (
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', borderRadius: '999px', padding: '0.1rem 0.45rem', background: 'rgba(255,255,255,.08)', color: 'var(--sidebar-text)' }}>
          {item.count}
        </span>
      )}
    </button>
  )
}

function LanguageSwitcher() {
  const { lang } = useI18n()
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

  const currentLang = languages.find(l => l.code === lang) || languages[0]

  const handleSelect = (code: string) => {
    setShowMenu(false)
    const prefs: UserPreferences = { ...loadUserPrefs(), language: code }
    saveUserPrefs(prefs)
    window.location.reload()
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
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--sidebar-muted)',
          padding: '0.2rem',
          borderRadius: '4px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>{currentLang.flag}</span>
      </button>
      {showMenu && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 0,
            bottom: '100%',
            marginBottom: '0.25rem',
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
                  color: lang === l.code ? 'var(--text)' : 'var(--text-secondary)',
                }}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
                {lang === l.code && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--waf-brand)' }}>✓</span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({
  run, runs, runsError, page, role, user,
  maturityLevel, settings, hideDisabledMenuItems, waiverCount, riskCount, failCount,
  navigate, onShowRunModal, onOpenUserPrefs, onLogout,
}: SidebarProps) {
  const matMeta = getMaturityMeta(maturityLevel)
  const hide = hideDisabledMenuItems
  const { t } = useI18n()

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('wafpass_nav_expanded') ?? '{}') } catch { return {} }
  })

  const [controlsCount, setControlsCount] = useState<number>(0)
  const [packControlCount, setPackControlCount] = useState<number>(0)

  const allSections = buildNavSections(run, runs, settings, waiverCount, riskCount, failCount, t)
  const visibleSections = allSections.filter(s =>
    hasMinRole(role, s.minRole ?? 'admin'))

  // Use max of run count and pack count for accurate display
  useEffect(() => {
    if (run) {
      const runCount = run.controls_meta?.length || run.controls_loaded || 0
      const count = Math.max(runCount, packControlCount || 0)
      setControlsCount(count)
    } else {
      setControlsCount(packControlCount || 0)
    }
  }, [run?.id, run?.controls_meta?.length, run?.controls_loaded, packControlCount])

  // Fetch active control pack to get the current control count
  useEffect(() => {
    getActiveControlPack().then(pack => {
      if (pack) {
        setPackControlCount(pack.control_count)
      }
    }).catch(() => {
      // Ignore errors
    })
  }, [])

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem('wafpass_nav_expanded', JSON.stringify(next)) } catch {}
      return next
    })
  }

  return (
    <aside className="app-sidebar" style={{
      width: '16rem', flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)',
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--sidebar-border)' }}>
        <img src="/logo.png" alt="WAF++ PASS" style={{ height: '32px', width: 'auto', objectFit: 'contain', filter: 'brightness(1.05)' }} />
        <div style={{ marginTop: '0.375rem', fontSize: '0.62rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          Controls Dashboard
        </div>
      </div>

      {/* Run selector */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', fontWeight: 600 }}>
          Active Run
        </div>
        {runsError ? (
          <div style={{ fontSize: '0.75rem', color: '#f87171' }}>API unreachable</div>
        ) : runs.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--sidebar-muted)' }}>No runs yet</div>
        ) : (
          <button
            onClick={onShowRunModal}
            style={{
              width: '100%', background: 'var(--sidebar-surf)', color: 'var(--sidebar-text)',
              border: '1px solid var(--sidebar-border)', borderRadius: '8px',
              padding: '0.4rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {run ? `${run.project || 'unnamed'} · ${new Date(run.created_at).toLocaleDateString()}` : 'Select run…'}
            </span>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.6 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </button>
        )}
      </div>

      {/* Score badge */}
      {run && (
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Overall Score</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: scoreColor(run.score) }}>{run.score}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-muted)' }}>/100</span>
          </div>
          {run.path && (
            <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', marginTop: '0.2rem', wordBreak: 'break-all' }}>{run.path}</div>
          )}
        </div>
      )}

      {/* Maturity level */}
      <div style={{ padding: '0.625rem 1.25rem', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem', fontWeight: 600 }}>Maturity</div>
        <button
          onClick={() => navigate('settings')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: `${matMeta.color}18`, border: `1px solid ${matMeta.color}40`,
            borderRadius: '999px', padding: '0.18rem 0.6rem',
            fontSize: '0.72rem', fontWeight: 700, color: matMeta.textColor,
            cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: matMeta.textColor, flexShrink: 0 }} />
          {matMeta.label}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {visibleSections.map((section, si) => {
          const items = (hide ? section.items.filter(i => i.gate === undefined || i.gate) : section.items)
            .filter(i => !i.minRole || hasMinRole(role, i.minRole))
          if (items.length === 0) return null

          const threshold = items.length - 2 >= 2 ? 2 : items.length
          const visibleItems = items.slice(0, threshold)
          const hiddenItems = items.slice(threshold)
          const activeInHidden = hiddenItems.some(i => i.page === page)
          const isExpanded = !!(expandedSections[section.id] || activeInHidden)

          return (
            <div key={section.id}>
              {si > 0 && <div style={{ borderTop: '1px solid var(--sidebar-border)', margin: '0.35rem 0' }} />}
              <div style={{
                fontSize: '0.58rem', color: section.color,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                fontWeight: 700, padding: '0.25rem 0.5rem 0.15rem',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: section.color, flexShrink: 0 }} />
                {section.label}
              </div>

              {visibleItems.map(item => (
                <NavItem key={item.page} item={item} page={page} navigate={navigate} />
              ))}

              {hiddenItems.length > 0 && (
                <>
                  <button
                    onClick={() => toggleSection(section.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '0.22rem 0.5rem', borderRadius: '6px',
                      fontSize: '0.65rem', fontWeight: 600,
                      color: activeInHidden ? section.color : 'var(--sidebar-muted)',
                      opacity: 0.8, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
                  >
                    <svg
                      width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                    {isExpanded ? 'Show less' : `${hiddenItems.length} more…`}
                  </button>
                  {isExpanded && hiddenItems.map(item => (
                    <NavItem key={item.page} item={item} page={page} navigate={navigate} />
                  ))}
                </>
              )}
            </div>
          )
        })}
      </nav>

      {/* Policy version footer */}
      {run && (
        <div style={{ padding: '0.625rem 1.25rem', borderTop: '1px solid var(--sidebar-border)' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Policy Version</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              background: 'rgba(0,148,255,0.15)', border: '1px solid rgba(0,148,255,0.35)',
              borderRadius: '999px', padding: '0.18rem 0.6rem',
              fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.02em',
            }}>
              v1.0.0
            </span>
            {controlsCount > 0 && (
              <span style={{ fontSize: '0.65rem', color: 'var(--sidebar-muted)' }}>{controlsCount} controls</span>
            )}
          </div>
        </div>
      )}

      {/* User widget */}
      <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
          background: 'rgba(0,148,255,.15)', border: '1px solid rgba(0,148,255,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.65rem', fontWeight: 700, color: 'var(--waf-brand)',
          overflow: 'hidden',
        }}>
          {user.image_url ? (
            <img src={user.image_url} alt={user.display_name || user.username} style={{
              width: '100%', height: '100%', objectFit: 'cover',
            }} />
          ) : (
            <span>{(user.display_name || user.username).charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--sidebar-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.display_name || user.username}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{role}</div>
        </div>
        <button
          onClick={onOpenUserPrefs}
          title="User preferences"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-muted)', padding: '0.2rem', borderRadius: '4px', flexShrink: 0 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <LanguageSwitcher />
        <button
          onClick={onLogout}
          title="Sign out"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-muted)', padding: '0.2rem', borderRadius: '4px', flexShrink: 0 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid var(--sidebar-border)', fontSize: '0.65rem', color: 'var(--sidebar-muted)' }}>
        WAF++ PASS v1.0.0
      </div>
    </aside>
  )
}
