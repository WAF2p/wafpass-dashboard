import { useState } from 'react'
import { Page } from '../routing'
import { hasMinRole } from '../AuthContext'
import { Settings } from '../pages/settingsUtils'
import { RunDetail, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { scoreColor } from '../routing'
import { NavEntry, NavSection, buildNavSections } from '../navigation/navModel'

function NavItem({ item, page, navigate, onClose }: { item: NavEntry; page: Page; navigate: (p: Page) => void; onClose: () => void }) {
  return (
    <button
      key={item.page}
      onClick={() => {
        navigate(item.page)
        onClose()
      }}
      className={`sidebar-link${page === item.page ? ' active' : ''}`}
      style={{
        ...navItemStyle,
        ...(item.danger && page !== item.page ? { color: '#f87171' } : undefined),
      }}
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
      </svg>
      <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
      {item.count != null && item.count > 0 && (
        <span style={{ fontSize: '0.65rem', borderRadius: '999px', padding: '0.1rem 0.45rem', background: 'rgba(255,255,255,.15)', color: '#fff' }}>
          {item.count}
        </span>
      )}
    </button>
  )
}

export interface MobileMenuProps {
  mobileMenuOpen: boolean
  onMobileMenuToggle: () => void
  page: Page
  navigate: (page: Page) => void
  run: RunDetail | null
  runs: RunSummary[]
  runsError: string | null
  role: string
  maturityLevel: number
  settings: Settings
  waiverCount: number
  riskCount: number
  failCount: number
  onLogout: () => Promise<void>
  onShowRunModal: () => void
}

function NavSectionItem({ section, onSectionClick, page, role }: { section: NavSection; onSectionClick: () => void; page: Page; role: string }) {
  const visibleItems = section.items.filter(i => !i.minRole || hasMinRole(role, i.minRole))
  const activeInSection = visibleItems.some(i => i.page === page)

  return (
    <button
      onClick={onSectionClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
        background: activeInSection ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: 'none', cursor: 'pointer', color: 'var(--text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: section.color, flexShrink: 0 }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{section.label}</span>
      </div>
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.5 }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

export default function MobileMenu({
  mobileMenuOpen,
  onMobileMenuToggle,
  page,
  navigate,
  run,
  runs,
  runsError,
  role,
  maturityLevel,
  settings,
  waiverCount,
  riskCount,
  failCount,
  onLogout,
  onShowRunModal,
}: MobileMenuProps) {
  const { t } = useI18n()
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  if (!mobileMenuOpen) return null

  const allSections = buildNavSections(run, runs, settings, waiverCount, riskCount, failCount, t)
  const visibleSections = allSections.filter(s => hasMinRole(role, s.minRole ?? 'admin'))

  // Only show on mobile devices - use matchMedia for reliable detection
  if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
    return null
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
      background: 'var(--sidebar-bg)',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--sidebar-border)',
        background: 'var(--sidebar-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <img src="/logo.png" alt="WAF++ PASS" style={{ height: '30px', width: 'auto', objectFit: 'contain' }} />
          <div style={{ fontSize: '0.6rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginTop: '0.2rem' }}>
            Controls Dashboard
          </div>
        </div>
        <button
          onClick={onMobileMenuToggle}
          style={{
            background: 'var(--sidebar-surf)',
            border: 'none', cursor: 'pointer',
            color: 'var(--sidebar-text)', padding: '0.5rem', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Run selector (if available) */}
      {runs.length > 0 && (
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--sidebar-border)' }}>
          <button
            onClick={() => {
              onMobileMenuToggle()
              // Show run selector modal after menu closes
              setTimeout(() => onShowRunModal(), 300)
            }}
            style={{
              width: '100%', background: 'var(--sidebar-surf)', color: 'var(--sidebar-text)',
              border: '1px solid var(--sidebar-border)', borderRadius: '8px',
              padding: '0.5rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {run ? `${run.project || 'unnamed'} · ${new Date(run.created_at).toLocaleDateString()}` : 'Select run…'}
            </span>
          </button>
        </div>
      )}

      {/* Score (if available) */}
      {run && (
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Overall Score</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreColor(run.score) }}>{run.score}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--sidebar-muted)' }}>/100</span>
          </div>
          {run.path && (
            <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-muted)', marginTop: '0.25rem', wordBreak: 'break-all' }}>{run.path}</div>
          )}
        </div>
      )}

      {/* Maturity level */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Maturity</div>
        <button
          onClick={() => {
            navigate('settings')
            onMobileMenuToggle()
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            background: 'rgba(0,148,255,0.15)', border: '1px solid rgba(0,148,255,0.35)',
            borderRadius: '999px', padding: '0.25rem 0.75rem',
            fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa',
            cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
          {maturityLevel <= 1 ? 'Basic' : maturityLevel <= 2 ? 'Intermediate' : 'Advanced'}
        </button>
      </div>

      {/* Navigation - Two Layer Menu */}
      <div style={{ padding: '0.5rem' }}>
        {/* Layer 1: Category selection */}
        {visibleSections.map((section) => (
          <NavSectionItem
            key={section.id}
            section={section}
            onSectionClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
            page={page}
            role={role}
          />
        ))}
      </div>

      {/* Layer 2: Section items (shown below) */}
      {expandedSection && (
        <div style={{ padding: '0.5rem' }}>
          <div style={{
            fontSize: '0.58rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
            fontWeight: 700, padding: '0.5rem 0.75rem 0.25rem', marginBottom: '0.25rem',
          }}>
            {allSections.find(s => s.id === expandedSection)?.label}
          </div>
          {allSections.find(s => s.id === expandedSection)?.items
            .filter(item => !item.minRole || hasMinRole(role, item.minRole))
            .map(item => (
              <NavItem
                key={item.page}
                item={item}
                page={page}
                navigate={navigate}
                onClose={() => setExpandedSection(null)}
              />
            ))}
        </div>
      )}

      {/* User info footer */}
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--sidebar-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'rgba(0,148,255,.15)', border: '1px solid rgba(0,148,255,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700, color: 'var(--waf-brand)',
            overflow: 'hidden',
          }}>
            {runsError ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            ) : (
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {role}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {runs.length > 0 ? `${runs.length} run${runs.length !== 1 ? 's' : ''}` : 'No runs'}
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-muted)', padding: '0.5rem', borderRadius: '8px',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

const navItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '0.65rem 0.75rem',
  borderRadius: '8px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--sidebar-text)',
  fontSize: '0.85rem',
  fontWeight: 500,
  marginBottom: '2px',
}
