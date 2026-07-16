import { useState } from 'react'
import { useTheme } from '../theme'
import { UserPreferences, saveUserPrefs, DEFAULT_USER_PREFS } from '../pages/userPrefsUtils'

interface Props {
  prefs: UserPreferences
  onChange: (prefs: UserPreferences) => void
  onClose: () => void
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '36px', height: '20px', borderRadius: '999px', border: 'none',
        cursor: 'pointer', background: checked ? 'var(--waf-brand)' : '#475569',
        transition: 'background 0.2s', position: 'relative', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: '2px', left: checked ? '18px' : '2px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

function PrefRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.71rem', color: 'var(--muted)', marginTop: '0.1rem', lineHeight: 1.4 }}>{desc}</div>}
      </div>
      {children}
    </div>
  )
}

function SectionHead({ label }: { label: string }) {
  return (
    <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', paddingTop: '0.75rem', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: '0.1rem' }}>
      {label}
    </div>
  )
}

const DATE_FORMAT_LABELS: Record<UserPreferences['dateFormat'], string> = {
  relative: 'Relative (2 hours ago)',
  absolute: 'Short (Apr 26, 2026)',
  full: 'Full (2026-04-26 14:30)',
}

const PAGE_OPTIONS = [
  { value: 'dashboard',  label: 'Executive Dashboard' },
  { value: 'findings',   label: 'Scan Findings' },
  { value: 'compliance', label: 'Compliance Matrix' },
  { value: 'runs',       label: 'Run History' },
  { value: 'journey',    label: 'Maturity Journey' },
]

const selectStyle: React.CSSProperties = {
  background: 'var(--bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: '7px',
  padding: '0.3rem 0.55rem', fontSize: '0.78rem', outline: 'none', cursor: 'pointer',
}

export default function UserPreferencesModal({ prefs, onChange, onClose }: Props) {
  const { themeName, toggleTheme } = useTheme()
  const [p, setP] = useState<UserPreferences>(prefs)
  const [saved, setSaved] = useState(false)

  function update(partial: Partial<UserPreferences>) {
    setP(prev => ({ ...prev, ...partial }))
  }

  function handleSave() {
    saveUserPrefs(p)
    onChange(p)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  function handleReset() {
    setP({ ...DEFAULT_USER_PREFS })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      {/* Panel — anchored bottom-left, beside the sidebar */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '320px', maxHeight: 'calc(100vh - 2rem)',
        marginLeft: '0.75rem', marginBottom: '0.75rem',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '14px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.1rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>User Preferences</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>Personal — saved to this browser only</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0.2rem', borderRadius: '4px' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.1rem' }}>

          <SectionHead label="Appearance" />
          <PrefRow label="Theme" desc="Switch between dark and light mode">
            <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              {(['dark', 'light'] as const).map(t => (
                <button key={t} onClick={() => { if (themeName !== t) toggleTheme() }}
                  style={{
                    padding: '0.25rem 0.6rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${themeName === t ? 'var(--waf-brand)' : 'var(--border)'}`,
                    background: themeName === t ? 'rgba(0,148,255,0.15)' : 'var(--bg)',
                    color: themeName === t ? 'var(--waf-brand)' : 'var(--muted)',
                  }}>
                  {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </button>
              ))}
            </div>
          </PrefRow>
          <PrefRow label="Compact Sidebar" desc="Tighter spacing in the navigation sidebar">
            <Toggle checked={p.sidebarCompact} onChange={v => update({ sidebarCompact: v })} />
          </PrefRow>
          <PrefRow label="Hide Disabled Items" desc="Remove sidebar entries for features turned off in system settings">
            <Toggle checked={p.hideDisabledMenuItems} onChange={v => update({ hideDisabledMenuItems: v })} />
          </PrefRow>

          <SectionHead label="Navigation" />
          <PrefRow label="Default Landing Page" desc="Page shown after login or logo click">
            <select value={p.defaultPage} onChange={e => update({ defaultPage: e.target.value })} style={selectStyle}>
              {PAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </PrefRow>

          <SectionHead label="Dates & Display" />
          <PrefRow label="Date Format" desc="How timestamps are displayed throughout the app">
            <select value={p.dateFormat} onChange={e => update({ dateFormat: e.target.value as UserPreferences['dateFormat'] })} style={selectStyle}>
              {(Object.entries(DATE_FORMAT_LABELS) as [UserPreferences['dateFormat'], string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </PrefRow>
          <PrefRow label="Inline Help Text" desc="Show descriptive hints below settings and form fields">
            <Toggle checked={p.showInlineHelp} onChange={v => update({ showInlineHelp: v })} />
          </PrefRow>

          <SectionHead label="Reports & Export" />
          <PrefRow label="Auto-open PDF" desc="Open generated PDF report in a new tab immediately after export">
            <Toggle checked={p.pdfAutoOpen} onChange={v => update({ pdfAutoOpen: v })} />
          </PrefRow>

          <SectionHead label="Help Tour" />
          <PrefRow label="Show onboarding tour again" desc="Reset the guided tour so it appears automatically on next login">
            <button
              onClick={() => update({ hasSeenOnboarding: false })}
              style={{
                background: 'var(--bg)', color: 'var(--muted)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reset tour
            </button>
          </PrefRow>

          <div style={{ height: '0.75rem' }} />
        </div>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={handleSave} style={{
            flex: 1, background: 'var(--waf-brand)', color: '#fff',
            border: 'none', borderRadius: '8px', padding: '0.5rem 1rem',
            fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
          }}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
          <button onClick={handleReset} style={{
            background: 'var(--bg)', color: 'var(--muted)',
            border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.75rem',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
          }}>
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
